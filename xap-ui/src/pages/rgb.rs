//! RGBView port: a radial hue picker plus Mode select and Hue/Saturation/Value/
//! Speed sliders, an Enable/Disable toggle and a Save button. Edits auto-apply
//! to the device (rgblight_set_config) except while the initial config is being
//! loaded from the device (the `watchPausable` pause-guard), and Save persists
//! via rgblight_save_config.

use dioxus::prelude::*;
use xap_specs::spec::types::RgbLightConfig;

use crate::app::Backend;
use crate::components::color_picker::ColorPicker;
use crate::components::primitives::{Btn, Select};
use crate::store::device::DeviceStore;
use crate::store::ui::UiState;
use crate::util::time::sleep_ms;

/// hue 0..255 (device) -> 0..360 (picker). Vue: `ceil(hue / 255 * 360)`.
fn hue_to_deg(hue: u8) -> f32 {
    (hue as f32 / 255.0 * 360.0).ceil()
}

/// hue 0..360 (picker) -> 0..255 (device). Vue: `ceil(h / 360 * 255)`.
fn deg_to_hue(deg: f32) -> u8 {
    (deg / 360.0 * 255.0).ceil() as u8
}

#[component]
pub fn RgbPage() -> Element {
    let device_store = use_context::<DeviceStore>();
    let backend = use_context::<Backend>();
    let mut ui = use_context::<UiState>();

    let mut config = use_signal(|| RgbLightConfig {
        enable: 1,
        mode: 1,
        hue: 255,
        sat: 255,
        val: 255,
        speed: 255,
    });
    // Pause-guard: true while loading the device config, so the auto-apply effect
    // does not echo the device's value back (mirrors watchPausable pause/resume).
    let mut loading = use_signal(|| true);

    let selected_id = device_store.0.read().selected;

    // Load on mount and whenever the selected device changes (onMounted + watch).
    let load_backend = backend.clone();
    use_effect(move || {
        let id = device_store.0.read().selected;
        let backend = load_backend.clone();
        spawn(async move {
            loading.set(true);
            if let Some(id) = id {
                match backend.0.rgblight_get_config(id).await {
                    Ok(cfg) => config.set(cfg),
                    Err(e) => {
                        ui.notify(format!("RGB get config failed: {e}"));
                        return;
                    }
                }
            }
            // nextTick analog: let the config-write's effect run (and early-return
            // under the still-true guard) before resuming auto-apply.
            sleep_ms(0).await;
            loading.set(false);
        });
    });

    // Auto-apply: re-runs on any config change. `loading` is peeked (untracked)
    // so flipping it false does not itself trigger a write.
    {
        let backend = backend.clone();
        use_effect(move || {
            let cfg = config(); // tracked
            if *loading.peek() {
                return;
            }
            let Some(id) = device_store.0.peek().selected else {
                return;
            };
            let backend = backend.clone();
            spawn(async move {
                if let Err(e) = backend.0.rgblight_set_config(id, cfg).await {
                    log::error!("rgblight_set_config failed: {e}");
                }
            });
        });
    }

    // Mode options from the selected device's enabled rgblight effects.
    let data = device_store.0.read();
    let effect_options: Vec<(String, String)> = data
        .selected_state()
        .and_then(|d| d.info.as_ref())
        .and_then(|i| i.lighting.as_ref())
        .and_then(|l| l.rgblight.as_ref())
        .map(|caps| {
            caps.effects
                .iter()
                .map(|e| (e.code.to_string(), e.label.clone()))
                .collect()
        })
        .unwrap_or_default();
    drop(data);

    let cfg = config();
    let hue_deg = hue_to_deg(cfg.hue);
    let mode_value = Some(cfg.mode.to_string());
    let enable_on = cfg.enable != 0;

    let save_backend = backend.clone();
    let save = move |_| {
        let backend = save_backend.clone();
        spawn(async move {
            if let Some(id) = selected_id {
                if let Err(e) = backend.0.rgblight_save_config(id).await {
                    ui.notify(format!("RGB save failed: {e}"));
                }
            }
        });
    };

    rsx! {
        div { class: "rgb-page",
            div { class: "rgb-picker-col",
                ColorPicker {
                    hue: hue_deg,
                    onchange: move |h: f32| {
                        config.write().hue = deg_to_hue(h);
                    },
                }
            }
            div { class: "rgb-controls-col",
                Select {
                    label: "Mode",
                    value: mode_value,
                    options: effect_options,
                    onselect: move |val: String| {
                        if let Ok(mode) = val.parse::<u16>() {
                            config.write().mode = mode as u8;
                        }
                    },
                }

                ChannelSlider {
                    label: "Hue",
                    value: cfg.hue,
                    oninput: move |v: u8| config.write().hue = v,
                }
                ChannelSlider {
                    label: "Saturation",
                    value: cfg.sat,
                    oninput: move |v: u8| config.write().sat = v,
                }
                ChannelSlider {
                    label: "Value",
                    value: cfg.val,
                    oninput: move |v: u8| config.write().val = v,
                }
                ChannelSlider {
                    label: "Speed",
                    value: cfg.speed,
                    oninput: move |v: u8| config.write().speed = v,
                }

                div { class: "rgb-toggle",
                    button {
                        class: if enable_on { "rgb-toggle-active" } else { "" },
                        onclick: move |_| config.write().enable = 1,
                        "Enable"
                    }
                    button {
                        class: if !enable_on { "rgb-toggle-active" } else { "" },
                        onclick: move |_| config.write().enable = 0,
                        "Disable"
                    }
                }

                Btn { label: "Save", onclick: save }
            }
        }
    }
}

/// A labelled 0..255 slider with the gold tick labels (0 32 64 .. 255).
#[component]
fn ChannelSlider(label: String, value: u8, oninput: EventHandler<u8>) -> Element {
    rsx! {
        span { class: "rgb-badge", "{label}" }
        div { class: "rgb-slider",
            input {
                r#type: "range",
                min: "0",
                max: "255",
                value: "{value}",
                oninput: move |e| {
                    if let Ok(v) = e.value().parse::<u8>() {
                        oninput.call(v);
                    }
                },
            }
            div { class: "rgb-slider-ticks",
                for t in [0u16, 32, 64, 96, 128, 160, 192, 224, 255] {
                    span { "{t}" }
                }
            }
        }
    }
}
