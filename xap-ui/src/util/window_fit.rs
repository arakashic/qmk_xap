//! Desktop window auto-resize: fit the OS window to the rendered keymap.
//!
//! Port of the Vue/Tauri `windowFit.ts` + KeymapView auto-fit. Measures the
//! rendered keymap (canvas width + picker bottom) via the desktop JS bridge,
//! resizes the window to match, clamps the result to the current monitor, and
//! keeps the window centred so growth/shrinkage doesn't pin to the top-left.
//! Debounced so a burst of reactive changes triggers a single resize.

use dioxus::desktop::tao::dpi::{LogicalSize, PhysicalPosition};
use dioxus::desktop::{use_window, DesktopContext};
use dioxus::prelude::*;

use crate::util::time::sleep_ms;

const MIN_WIDTH: f64 = 800.0;
const MIN_HEIGHT: f64 = 600.0;
const MONITOR_MARGIN: f64 = 64.0;
const DEBOUNCE_MS: u64 = 50;

// Measure the rendered keymap content in CSS px. Width comes from the keymap
// canvas (its full rendered width, even when the stage scrolls); height from
// the bottom of the keycode picker (the last content element) so the window can
// both grow and shrink. Returns [width, height], or null before mount.
const MEASURE_JS: &str = r#"
const canvas = document.querySelector('.keymap-canvas');
const page = document.querySelector('.keymap-page');
if (!canvas || !page) return null;
const SIDE_GUTTER = 32, BOTTOM_GUTTER = 40;
const bottomEl = document.querySelector('.keycode-area') || page;
const contentWidth = canvas.getBoundingClientRect().width + SIDE_GUTTER * 2;
const contentBottom = bottomEl.getBoundingClientRect().bottom + window.scrollY;
return [contentWidth, contentBottom + BOTTOM_GUTTER];
"#;

/// Resize the window to the measured content, clamped to the monitor and
/// re-centred on its previous centre point.
fn apply_fit(window: &DesktopContext, content_w: f64, content_h: f64) {
    if content_w <= 0.0 || content_h <= 0.0 {
        return;
    }

    let scale = window.scale_factor();
    let inner = window.inner_size().to_logical::<f64>(scale);
    let outer = window.outer_size().to_logical::<f64>(scale);
    let chrome_w = (outer.width - inner.width).max(0.0);
    let chrome_h = (outer.height - inner.height).max(0.0);

    // Hard cap: the outer window (inner + chrome) must never exceed the monitor.
    // On a monitor smaller than the floor the cap wins, so the floor is clamped
    // below the cap rather than pushing the window off-screen.
    let (max_inner_w, max_inner_h) = match window.current_monitor() {
        Some(m) => {
            let ms = m.size().to_logical::<f64>(m.scale_factor());
            (
                (ms.width - MONITOR_MARGIN - chrome_w).max(0.0),
                (ms.height - MONITOR_MARGIN - chrome_h).max(0.0),
            )
        }
        None => (f64::INFINITY, f64::INFINITY),
    };
    let target_w = content_w.clamp(MIN_WIDTH.min(max_inner_w), max_inner_w).ceil();
    let target_h = content_h.clamp(MIN_HEIGHT.min(max_inner_h), max_inner_h).ceil();

    // Hysteresis: skip sub-2px changes to avoid resize thrashing.
    let target_outer_w = target_w + chrome_w;
    let target_outer_h = target_h + chrome_h;
    if (outer.width - target_outer_w).abs() < 2.0 && (outer.height - target_outer_h).abs() < 2.0 {
        return;
    }

    // Preserve the window centre. The resized outer size is known up front
    // (target inner + chrome), so we avoid re-reading outer_size, whose update
    // may lag set_inner_size on the event loop.
    let pos = window.outer_position().unwrap_or(PhysicalPosition::new(0, 0));
    let prev_outer = window.outer_size();
    let prev_cx = pos.x as f64 + prev_outer.width as f64 / 2.0;
    let prev_cy = pos.y as f64 + prev_outer.height as f64 / 2.0;

    window.set_inner_size(LogicalSize::new(target_w, target_h));

    let new_outer_w = target_outer_w * scale;
    let new_outer_h = target_outer_h * scale;
    window.set_outer_position(PhysicalPosition::new(
        (prev_cx - new_outer_w / 2.0).round() as i32,
        (prev_cy - new_outer_h / 2.0).round() as i32,
    ));
}

/// Auto-resize the desktop window to the keymap whenever `deps` change.
///
/// `deps` must read the reactive values the fit depends on (device, layout,
/// layer, keymap, pending) so the effect re-subscribes to them.
pub fn use_window_autofit(deps: impl Fn() + Copy + 'static) {
    let window = use_window();
    let mut generation = use_signal(|| 0u64);

    use_effect(move || {
        deps();
        // peek (not read) so writing `generation` below doesn't re-trigger this
        // effect; only `deps` drives re-runs.
        let gen = *generation.peek() + 1;
        generation.set(gen);

        let window = window.clone();
        spawn(async move {
            sleep_ms(DEBOUNCE_MS).await;
            if *generation.peek() != gen {
                return; // superseded by a newer change
            }
            match document::eval(MEASURE_JS).join::<Option<(f64, f64)>>().await {
                Ok(Some((w, h))) => apply_fit(&window, w, h),
                Ok(None) => {}
                Err(e) => log::debug!("window autofit measure failed: {e}"),
            }
        });
    });
}
