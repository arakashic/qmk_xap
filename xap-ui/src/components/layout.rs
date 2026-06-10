//! BaseContainer: header (logo, tabs, device select), routed body, secure FAB,
//! and the feedback layer. Port of src/layouts/baseContainer.vue.

use dioxus::prelude::*;
use uuid::Uuid;
use xap_specs::XapSecureStatus;

use crate::app::{Backend, Route, QMK_LOGO};
use crate::components::primitives::{Btn, FeedbackLayer, Icon, Select, Tab};
use crate::store::device::DeviceStore;

#[component]
pub fn BaseContainer() -> Element {
    let device_store = use_context::<DeviceStore>();
    let backend = use_context::<Backend>();
    let caps = backend.0.capabilities();
    let backend_connect = backend.clone();
    let backend_fab = backend.clone();

    let data = device_store.0.read();
    let device = data.selected_state().cloned();
    let device_count = data.devices.len();
    let options: Vec<(String, String)> = data
        .devices
        .values()
        .map(|d| {
            let label = d
                .info
                .as_ref()
                .map(|i| format!("{} - {}", i.qmk.manufacturer, i.qmk.product_name))
                .unwrap_or_else(|| d.id.to_string());
            (d.id.to_string(), label)
        })
        .collect();
    let selected_id = data.selected.map(|id| id.to_string());
    drop(data);

    // Tab gating (baseContainer.vue).
    let has_device = device.is_some();
    let info = device.as_ref().and_then(|d| d.info.as_ref());
    let keymap_disabled = info.map(|i| i.keymap.is_none()).unwrap_or(true);
    let show_encoder = info
        .and_then(|i| i.keymap.as_ref())
        .map(|k| k.get_encoder_keycode_enabled)
        .unwrap_or(false)
        && device.as_ref().map(|d| d.config.encoder_count).unwrap_or(0) > 0;
    let show_rgb = info
        .and_then(|i| i.lighting.as_ref())
        .map(|l| l.rgblight.is_some())
        .unwrap_or(false);

    let route = use_route::<Route>();
    let show_secure = has_device && matches!(route, Route::KeymapPage {});
    let secure_status = device.as_ref().map(|d| &d.secure_status);
    let secure_loading = matches!(secure_status, Some(XapSecureStatus::Unlocking));
    let secure_icon = if matches!(secure_status, Some(XapSecureStatus::Unlocked)) {
        "lock"
    } else {
        "lock_open"
    };
    let secure_id = device.as_ref().map(|d| d.id);
    let is_unlocked = matches!(secure_status, Some(XapSecureStatus::Unlocked));

    rsx! {
        div { class: "min-h-screen flex flex-col",
            header { class: "qx-header",
                div { class: "qx-toolbar",
                    div { class: "qx-title",
                        span { class: "qx-avatar", img { src: QMK_LOGO } }
                        "QMK XAP GUI"
                    }
                    nav { class: "qx-tabs",
                        Tab { to: Route::KeymapPage {}, label: "Keymap", disabled: keymap_disabled }
                        if show_encoder {
                            Tab { to: Route::EncoderMapPage {}, label: "Encoder" }
                        }
                        if show_rgb {
                            Tab { to: Route::RgbPage {}, label: "RGB" }
                        }
                        Tab { to: Route::BroadcastPage {}, label: "Broadcast", disabled: !has_device }
                        Tab { to: Route::DeviceInfoPage {}, label: "Info", disabled: !has_device }
                    }
                }
                div { class: "bg-white",
                    Select {
                        label: "XAP device",
                        value: selected_id,
                        options,
                        disabled: !has_device,
                        readonly: device_count == 1,
                        onselect: move |val: String| {
                            if let Ok(id) = Uuid::parse_str(&val) {
                                let mut device_store = device_store;
                                device_store.select_device(id);
                            }
                        },
                    }
                }
            }

            main { class: "flex-1",
                if has_device {
                    Outlet::<Route> {}
                } else if let Some(reason) = caps.unsupported_reason.clone() {
                    div { class: "qx-empty",
                        Icon { name: "usb_off", class: "qx-icon-usb-off", }
                        div { class: "qx-empty-title", "{reason}" }
                    }
                } else if caps.requires_user_connect {
                    div { class: "qx-empty",
                        Icon { name: "usb", class: "qx-icon-usb", }
                        div { class: "qx-empty-title", "Connect an XAP keyboard" }
                        Btn {
                            label: "Connect",
                            onclick: move |_| {
                                let backend = backend_connect.clone();
                                spawn(async move {
                                    if let Err(e) = backend.0.connect_device().await {
                                        log::error!("connect_device failed: {e}");
                                    }
                                });
                            },
                        }
                    }
                }
            }

            if show_secure {
                Btn {
                    fab: true,
                    loading: secure_loading,
                    icon: secure_icon.to_string(),
                    onclick: move |_| {
                        let Some(id) = secure_id else { return };
                        let backend = backend_fab.clone();
                        spawn(async move {
                            let res = if is_unlocked {
                                backend.0.secure_lock(id).await
                            } else {
                                backend.0.secure_unlock(id).await
                            };
                            if let Err(e) = res {
                                log::error!("secure toggle failed: {e}");
                            }
                        });
                    },
                }
            }

            FeedbackLayer {}
        }
    }
}
