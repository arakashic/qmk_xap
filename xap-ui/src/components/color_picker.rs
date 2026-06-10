//! Hand-built radial hue picker, a port of the gold
//! `@radial-color-picker/vue-color-picker` look: a conic-gradient hue ring with
//! a center well showing the selected color and a draggable knob on the ring.
//!
//! Geometry matches the gold picker's defaults: a 280px ring, ~52px thick, with
//! a small knob riding the ring's mid-radius. The selected angle is derived from
//! the pointer position relative to the element center via `atan2`. We use
//! Dioxus' cross-target `element_coordinates()` (pointer offset from the
//! element's top-left) rather than web-sys' `get_bounding_client_rect`, because
//! `web-sys` is a wasm-only dependency in this crate; the ring's pixel size is
//! fixed in CSS so the center is known (RING_PX / 2).

use dioxus::prelude::*;

/// Outer ring diameter in px (gold picker default).
const RING_PX: f64 = 280.0;

/// Convert a hue (0..360) to a CSS hsl() string at full saturation/value.
fn hue_color(hue: f32) -> String {
    format!("hsl({}, 100%, 50%)", hue.rem_euclid(360.0))
}

/// Map a pointer offset (relative to the element top-left) to a hue 0..360.
/// 0deg points up (12 o'clock) and increases clockwise, matching the gold
/// picker, where the knob sits at the top for hue 0.
fn angle_to_hue(x: f64, y: f64) -> f32 {
    let cx = RING_PX / 2.0;
    let cy = RING_PX / 2.0;
    // atan2(dx, -dy): 0 at top, growing clockwise.
    let mut deg = (y - cy).atan2(x - cx).to_degrees() + 90.0;
    if deg < 0.0 {
        deg += 360.0;
    }
    deg.rem_euclid(360.0) as f32
}

/// Radial hue picker. `hue` is the current hue in degrees (0..360); `onchange`
/// fires with the new hue while dragging.
#[component]
pub fn ColorPicker(hue: f32, onchange: EventHandler<f32>) -> Element {
    let mut dragging = use_signal(|| false);

    // Knob position on the ring mid-line. The ring is RING_PX wide; the knob
    // rides at the outer-edge mid-radius. Angle 0 = top, clockwise.
    let angle = hue as f64;
    let rad = (angle - 90.0).to_radians();
    let r = RING_PX / 2.0 - 13.0; // mid of the ~52px ring band, in from edge
    let knob_x = RING_PX / 2.0 + r * rad.cos();
    let knob_y = RING_PX / 2.0 + r * rad.sin();

    let center_color = hue_color(hue);

    rsx! {
        div { class: "rcp",
            // Center well (sibling of the rotator so the ring's center mask
            // doesn't clip it); shows the selected color through the ring hole.
            div { class: "rcp__well", style: "background:{center_color};" }
            // Conic hue ring with a punched-out center.
            div {
                class: "rcp__rotator",
                style: "touch-action:none;",
                onpointerdown: move |e| {
                    dragging.set(true);
                    let p = e.element_coordinates();
                    onchange.call(angle_to_hue(p.x, p.y));
                },
                onpointermove: move |e| {
                    if dragging() {
                        let p = e.element_coordinates();
                        onchange.call(angle_to_hue(p.x, p.y));
                    }
                },
                onpointerup: move |_| dragging.set(false),
                onpointerleave: move |_| dragging.set(false),
                div {
                    class: "rcp__knob",
                    style: "left:{knob_x}px; top:{knob_y}px;",
                }
            }
        }
    }
}
