//! DeviceInfoView port: device identity fields, firmware-config expansion with
//! copy, and the secure actions (lock/unlock, bootloader, EEPROM reset).

use dioxus::prelude::*;
use uuid::Uuid;
use xap_specs::XapSecureStatus;

use crate::app::Backend;
use crate::components::primitives::{Btn, ExpansionItem, Field};
use crate::store::device::DeviceStore;
use crate::util::format::format_bcd_version;

/// QMK version is stored as a decimal string of the BCD u32; XAP version is the
/// u32 directly. Mirrors `formatBcdVersion(number | string)`.
fn format_qmk_version(raw: &str) -> String {
    raw.parse::<u32>()
        .map(format_bcd_version)
        .unwrap_or_else(|_| raw.to_string())
}

#[component]
pub fn DeviceInfoPage() -> Element {
    let device_store = use_context::<DeviceStore>();
    let backend = use_context::<Backend>();

    let data = device_store.0.read();
    let Some(device) = data.selected_state().cloned() else {
        return rsx! {};
    };
    drop(data);

    let id = device.id;
    let info = device.info.clone();
    let secure_status = device.secure_status;
    let is_unlocked = matches!(secure_status, XapSecureStatus::Unlocked);
    let is_unlocking = matches!(secure_status, XapSecureStatus::Unlocking);
    let config_json = device.config_json.clone();

    let secure_label = match secure_status {
        XapSecureStatus::Locked => "Locked",
        XapSecureStatus::Unlocking => "Unlocking",
        XapSecureStatus::Unlocked => "Unlocked",
    };

    rsx! {
        div { class: "flex flex-col gap-4 p-4",
            h5 { class: "qx-h5", "Device Information" }

            if let Some(info) = info.as_ref() {
                Field { label: "Manufacturer", value: info.qmk.manufacturer.clone() }
                Field { label: "Product", value: info.qmk.product_name.clone() }
                Field { label: "XAP Version", value: format_bcd_version(info.xap.version) }
                Field { label: "QMK Version", value: format_qmk_version(&info.qmk.version) }
                Field { label: "Hardware Id", value: info.qmk.hardware_id.clone() }
            }

            if !config_json.is_empty() {
                ExpansionItem { title: "Firmware Config",
                    div { class: "qx-config-card",
                        div { class: "qx-config-copy",
                            CopyButton { text: config_json.clone() }
                        }
                        pre { class: "config-json", "{config_json}" }
                    }
                }
            }

            h5 { class: "qx-h5", "Secure Actions" }
            Field { label: "Secure Status", value: secure_label.to_string() }

            div {
                if is_unlocked {
                    Btn {
                        class: "qx-btn-block",
                        label: "Lock",
                        onclick: secure_action(backend.clone(), id, SecureAction::Lock),
                    }
                } else {
                    Btn {
                        class: "qx-btn-block",
                        label: "Unlock",
                        loading: is_unlocking,
                        onclick: secure_action(backend.clone(), id, SecureAction::Unlock),
                    }
                }
            }

            if info.as_ref().map(|i| i.qmk.jump_to_bootloader_enabled).unwrap_or(false) {
                div {
                    Btn {
                        class: "qx-btn-block",
                        label: "Jump to Bootloader",
                        disabled: !is_unlocked,
                        title: if is_unlocked { None } else { Some("Device is locked".to_string()) },
                        onclick: secure_action(backend.clone(), id, SecureAction::Bootloader),
                    }
                }
            }

            if info.as_ref().map(|i| i.qmk.eeprom_reset_enabled).unwrap_or(false) {
                div {
                    Btn {
                        class: "qx-btn-block",
                        label: "Reset EEPROM",
                        disabled: !is_unlocked,
                        title: if is_unlocked { None } else { Some("Device is locked".to_string()) },
                        onclick: secure_action(backend.clone(), id, SecureAction::ResetEeprom),
                    }
                }
            }
        }
    }
}

#[derive(Clone, Copy)]
enum SecureAction {
    Lock,
    Unlock,
    Bootloader,
    ResetEeprom,
}

/// Build an onclick handler that runs the given backend secure action.
fn secure_action(backend: Backend, id: Uuid, action: SecureAction) -> EventHandler<MouseEvent> {
    EventHandler::new(move |_| {
        let backend = backend.clone();
        spawn(async move {
            let res = match action {
                SecureAction::Lock => backend.0.secure_lock(id).await.map(|_| ()),
                SecureAction::Unlock => backend.0.secure_unlock(id).await.map(|_| ()),
                SecureAction::Bootloader => backend.0.jump_to_bootloader(id).await.map(|_| ()),
                SecureAction::ResetEeprom => backend.0.reinitialize_eeprom(id).await.map(|_| ()),
            };
            if let Err(e) = res {
                log::error!("secure action failed: {e}");
            }
        });
    })
}

/// Flat dense copy button; writes `text` to the clipboard via the webview's
/// `navigator.clipboard` (works on both web and desktop wry).
#[component]
fn CopyButton(text: String) -> Element {
    rsx! {
        Btn {
            flat: true,
            icon: "content_copy",
            title: "Copy",
            onclick: move |_| {
                let escaped = serde_json::to_string(&text).unwrap_or_else(|_| "\"\"".to_string());
                let _ = document::eval(&format!("navigator.clipboard.writeText({escaped});"));
            },
        }
    }
}
