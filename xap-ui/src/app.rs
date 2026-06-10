//! App root: provides the backend + stores via context, wires the `XapEvent`
//! handler (port of `src/App.vue`'s `onXapEvent` + startup flow), pumps native
//! events into it (desktop), seeds known devices, and mounts the router.

use std::rc::Rc;

use dioxus::prelude::*;

use xap_core::{RawBroadcastType, XapDeviceState, XapEvent};

use crate::backend::XapBackend;
use crate::store::broadcast::BroadcastStore;
use crate::store::device::DeviceStore;
use crate::store::ui::UiState;
use crate::util::broadcast::BroadcastKind;

static TAILWIND_CSS: Asset = asset!("/assets/tailwind.css");
pub static QMK_LOGO: Asset = asset!("/assets/qmk.svg");
// Referenced from tailwind.css @font-face url()s, not from rust code; #[used]
// keeps the linker section so dx still bundles the folder (unhashed paths).
#[used]
static FONTS: Asset = asset!("/assets/fonts", AssetOptions::folder());

/// Context-shared backend handle (a `Rc<dyn XapBackend>` newtype so it can be
/// cloned into closures and provided via context).
#[derive(Clone)]
pub struct Backend(pub Rc<dyn XapBackend>);

#[derive(Routable, Clone, PartialEq)]
pub enum Route {
    #[layout(crate::components::BaseContainer)]
        #[redirect("/", || Route::KeymapPage {})]
        #[route("/keymap")]
        KeymapPage {},
        #[route("/info")]
        DeviceInfoPage {},
        #[route("/encoder")]
        EncoderMapPage {},
        #[route("/rgb")]
        RgbPage {},
        #[route("/broadcast")]
        BroadcastPage {},
}

// Re-export the page components under the names the Route variants expect.
pub use crate::pages::{BroadcastPage, DeviceInfoPage, EncoderMapPage, KeymapPage, RgbPage};

/// Port of App.vue's `addDevice`: remember the source name, insert into the
/// device store, and toast when the device is newly added.
fn add_device(
    mut device_store: DeviceStore,
    mut broadcast_store: BroadcastStore,
    mut ui: UiState,
    state: XapDeviceState,
) {
    broadcast_store.remember_device(&state);
    let product = state
        .info
        .as_ref()
        .map(|i| i.qmk.product_name.clone())
        .unwrap_or_default();
    if device_store.add_device(state) {
        ui.notify_with_icon(format!("New Device {product}"), Some("power"));
    }
}

#[component]
pub fn App() -> Element {
    let backend = use_context_provider(|| Backend(crate::backend::select_backend()));
    let device_store = use_context_provider(DeviceStore::new);
    let broadcast_store = use_context_provider(BroadcastStore::new);
    let ui = use_context_provider(UiState::new);

    // One-time startup: build the handler, register it, pump native events, and
    // seed known devices (App.vue's onMounted).
    use_hook(move || {
        let handler: Rc<dyn Fn(XapEvent)> = {
            let backend = backend.clone();
            Rc::new(move |ev: XapEvent| match ev {
                XapEvent::NewDevice { id } => {
                    // device_get over WebHID is slow (keymap sweep); show the
                    // overlay only when the backend requires a user connect.
                    let client = backend.0.clone();
                    let mut ui = ui;
                    spawn(async move {
                        let requires_connect = client.capabilities().requires_user_connect;
                        if requires_connect {
                            ui.show_loading("Connecting to keyboard…");
                        }
                        match client.device_get(id).await {
                            Ok(state) => add_device(device_store, broadcast_store, ui, state),
                            Err(e) => log::error!("device_get failed for {id}: {e}"),
                        }
                        if requires_connect {
                            ui.hide_loading();
                        }
                    });
                }
                XapEvent::RemovedDevice { id } => {
                    let mut device_store = device_store;
                    let mut ui = ui;
                    let product = device_store
                        .0
                        .read()
                        .devices
                        .get(&id)
                        .and_then(|d| d.info.as_ref())
                        .map(|i| i.qmk.product_name.clone())
                        .unwrap_or_else(|| "Unknown".to_string());
                    ui.notify_with_icon(format!("Removed Device {product}"), Some("power_off"));
                    device_store.remove_device(id);
                }
                XapEvent::SecureStatusChanged { id, secure_status } => {
                    let mut device_store = device_store;
                    device_store.update_secure_status(id, secure_status);
                }
                XapEvent::LogReceived { id, log } => {
                    let mut broadcast_store = broadcast_store;
                    broadcast_store.append_log(id.to_string(), log);
                }
                XapEvent::RawBroadcastReceived {
                    id,
                    broadcast_type,
                    payload,
                } => {
                    let mut broadcast_store = broadcast_store;
                    let kind = match broadcast_type {
                        RawBroadcastType::User => BroadcastKind::User,
                        RawBroadcastType::Keyboard => BroadcastKind::Keyboard,
                    };
                    broadcast_store.append_raw(id.to_string(), kind, payload);
                }
            })
        };

        backend.0.set_event_listener(handler.clone());

        // Desktop: drain the actor's event channel into the handler, keeping
        // signal writes inside the Dioxus runtime.
        #[cfg(not(target_arch = "wasm32"))]
        {
            use futures::StreamExt;
            if let Some(native) = backend
                .0
                .as_any()
                .downcast_ref::<crate::backend::native::NativeBackend>()
            {
                if let Some(mut rx) = native.take_event_rx() {
                    let handler = handler.clone();
                    spawn(async move {
                        while let Some(ev) = rx.next().await {
                            handler(ev);
                        }
                    });
                }
            }
        }

        // Seed already-known devices (desktop auto-enumerates).
        let client = backend.0.clone();
        spawn(async move {
            match client.devices_get().await {
                Ok(devices) => {
                    for state in devices {
                        add_device(device_store, broadcast_store, ui, state);
                    }
                }
                Err(e) => log::error!("initial devices_get failed: {e}"),
            }
        });
    });

    rsx! {
        document::Stylesheet { href: TAILWIND_CSS }
        Router::<Route> {}
    }
}
