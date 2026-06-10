//! WebHID backend: pure-Rust port of `xap-wasm/src/lib.rs` + the
//! `webhid.ts`/`browser.ts` transport. Single-threaded WASM, so `Rc<RefCell>`
//! (not Arc/Mutex).
//!
//! CRITICAL borrow discipline (from xap-wasm's header): never hold a `RefCell`
//! borrow across an `.await` or across a call that can re-enter the client. The
//! one allowed sync JS call under a borrow is `send_report` (WebHID
//! `sendReport`, which returns a Promise and cannot re-enter synchronously).

pub mod webhid;

use std::any::Any;
use std::cell::RefCell;
use std::collections::HashMap;
use std::rc::Rc;
use std::sync::Arc;

use anyhow::anyhow;
use async_trait::async_trait;
use uuid::Uuid;
use wasm_bindgen::closure::Closure;
use wasm_bindgen::JsCast;
use web_sys::{HidConnectionEvent, HidDevice, HidInputReportEvent};

use xap_core::aggregation::keymap::MappedKeymap;
use xap_core::transport::{IngestOutcome, XapQueryExecutor, XapWriter};
use xap_core::{XapClient, XapDevice, XapDeviceState, XapEvent};
use xap_specs::constants::keycode::KeyCode;
use xap_specs::constants::keycode_encoder::KeycodeTemplate;
use xap_specs::constants::XapConstants;
use xap_specs::request::XapRequest;
use xap_specs::spec::keymap::{KeymapGetEncoderKeycodeArg, KeymapGetEncoderKeycodeRequest};
use xap_specs::spec::lighting::rgblight::{
    RgblightGetConfigRequest, RgblightSaveConfigRequest, RgblightSetConfigRequest,
};
use xap_specs::spec::qmk::{QmkJumpToBootloaderRequest, QmkReinitializeEepromRequest};
use xap_specs::spec::remapping::{
    RemappingSetEncoderKeycodeArg, RemappingSetEncoderKeycodeRequest, RemappingSetKeycodeArg,
};
use xap_specs::spec::types::RgbLightConfig;
use xap_specs::spec::xap::{XapSecureLockRequest, XapSecureUnlockRequest};

use super::{BackendCapabilities, CmdResult, XapBackend};

pub struct WebState {
    pub client: XapClient,
    pub constants: Arc<XapConstants>,
    pub waiters: HashMap<Uuid, futures::channel::oneshot::Sender<()>>,
    pub devices: HashMap<Uuid, HidDevice>,
    pub handler: Option<Rc<dyn Fn(XapEvent)>>,
}

pub struct WebBackend {
    state: Rc<RefCell<WebState>>,
}

/// Hands report bytes to WebHID `sendReport`. The held device clone is the only
/// JS handle touched under a borrow (during `submit`); `send_report` returns a
/// Promise and cannot synchronously re-enter `handle_input_report`.
struct WebWriter {
    device: HidDevice,
}

impl XapWriter for WebWriter {
    fn write_report(&self, report: &[u8]) -> anyhow::Result<()> {
        webhid::send_report(&self.device, report);
        Ok(())
    }
}

/// Port of `handle_input_report`: feed one inbound report into the core, then
/// (after dropping the borrow) dispatch any drained broadcasts to the handler.
fn handle_input_report(state: &Rc<RefCell<WebState>>, id: Uuid, bytes: &[u8]) {
    let drained = {
        let mut st = state.borrow_mut();
        match st.client.ingest(id, bytes) {
            Ok(IngestOutcome::Response { .. }) => {
                if let Some(tx) = st.waiters.remove(&id) {
                    let _ = tx.send(());
                }
                None
            }
            Ok(IngestOutcome::Broadcast) => Some(st.client.drain_broadcasts()),
            Ok(IngestOutcome::Unmatched) => None,
            Err(e) => {
                log::error!("device {id}: ingest failed: {e}");
                None
            }
        }
    };

    if let Some(events) = drained {
        let handler = state.borrow().handler.clone();
        if let Some(h) = handler {
            for (_eid, ev) in events {
                h(ev);
            }
        }
    }
}

impl WebBackend {
    pub fn new() -> Self {
        let constants =
            Arc::new(XapConstants::from_embedded().expect("embedded XAP constants load"));
        let client = XapClient::new(Arc::clone(&constants));
        let state = Rc::new(RefCell::new(WebState {
            client,
            constants,
            waiters: HashMap::new(),
            devices: HashMap::new(),
            handler: None,
        }));

        // Register the navigator.hid disconnect listener ONCE (page lifetime).
        if let Some(hid) = webhid::hid() {
            let st = state.clone();
            let cb = Closure::<dyn FnMut(HidConnectionEvent)>::new(move |event: HidConnectionEvent| {
                let device = event.device();
                let found = {
                    let s = st.borrow();
                    s.devices
                        .iter()
                        .find(|(_, d)| js_sys::Object::is(d.as_ref(), device.as_ref()))
                        .map(|(id, _)| *id)
                };
                if let Some(id) = found {
                    let handler = {
                        let mut s = st.borrow_mut();
                        s.client.remove_device(id);
                        s.devices.remove(&id);
                        s.waiters.remove(&id);
                        s.handler.clone()
                    };
                    if let Some(h) = handler {
                        h(XapEvent::RemovedDevice { id });
                    }
                }
            });
            let _ = hid.add_event_listener_with_callback("disconnect", cb.as_ref().unchecked_ref());
            cb.forget(); // documented leak: one listener per app lifetime.
        }

        Self { state }
    }

    fn exec(&self, id: Uuid) -> WebExecutor {
        WebExecutor {
            state: self.state.clone(),
            id,
        }
    }
}

#[async_trait(?Send)]
impl XapBackend for WebBackend {
    fn capabilities(&self) -> BackendCapabilities {
        BackendCapabilities {
            requires_user_connect: true,
            unsupported_reason: if webhid::is_webhid_supported() {
                None
            } else {
                Some(
                    "WebHID is not supported in this browser. Use Chrome/Edge over HTTPS or \
                     localhost."
                        .to_string(),
                )
            },
        }
    }
    fn set_event_listener(&self, handler: Rc<dyn Fn(XapEvent)>) {
        self.state.borrow_mut().handler = Some(handler);
    }
    fn clear_event_listener(&self) {
        self.state.borrow_mut().handler = None;
    }
    fn as_any(&self) -> &dyn Any {
        self
    }

    async fn connect_device(&self) -> CmdResult<()> {
        let devices = webhid::request_devices().await?;
        for device in devices {
            let already = {
                let s = self.state.borrow();
                s.devices
                    .values()
                    .any(|d| js_sys::Object::is(d.as_ref(), device.as_ref()))
            };
            if already {
                continue;
            }

            webhid::open(&device).await?;
            let id = Uuid::new_v4();
            {
                let mut s = self.state.borrow_mut();
                let constants = Arc::clone(&s.constants);
                s.devices.insert(id, device.clone());
                s.client.add_device(XapDevice::new(id, constants));
            }

            // inputreport listener (page lifetime per device).
            let st = self.state.clone();
            let cb = Closure::<dyn FnMut(HidInputReportEvent)>::new(move |event: HidInputReportEvent| {
                let data = event.data();
                let len = data.byte_length();
                let mut bytes = vec![0u8; len];
                for (i, b) in bytes.iter_mut().enumerate() {
                    *b = data.get_uint8(i);
                }
                handle_input_report(&st, id, &bytes);
            });
            let _ =
                device.add_event_listener_with_callback("inputreport", cb.as_ref().unchecked_ref());
            cb.forget();

            let handler = self.state.borrow().handler.clone();
            if let Some(h) = handler {
                h(XapEvent::NewDevice { id });
            }
        }
        Ok(())
    }

    async fn devices_get(&self) -> CmdResult<Vec<XapDeviceState>> {
        let s = self.state.borrow();
        Ok(s.client
            .get_devices()
            .into_iter()
            .map(|d| d.state().clone())
            .collect())
    }

    async fn device_get(&self, id: Uuid) -> CmdResult<XapDeviceState> {
        let constants = self.state.borrow().constants.clone();
        let mut exec = self.exec(id);
        let state = xap_core::session::initialize(&mut exec, constants, id)
            .await
            .map_err(|e| e.to_string())?;
        self.state
            .borrow_mut()
            .client
            .device_mut(id)
            .map_err(|e| e.to_string())?
            .set_state(state.clone());
        Ok(state)
    }

    async fn xap_constants_get(&self) -> CmdResult<XapConstants> {
        Ok(self.state.borrow().constants.as_ref().clone())
    }

    async fn secure_lock(&self, id: Uuid) -> CmdResult<()> {
        self.exec(id)
            .query(XapSecureLockRequest(()))
            .await
            .map(|_| ())
            .map_err(|e| e.to_string())
    }
    async fn secure_unlock(&self, id: Uuid) -> CmdResult<()> {
        self.exec(id)
            .query(XapSecureUnlockRequest(()))
            .await
            .map(|_| ())
            .map_err(|e| e.to_string())
    }
    async fn jump_to_bootloader(&self, id: Uuid) -> CmdResult<u8> {
        Ok(self
            .exec(id)
            .query(QmkJumpToBootloaderRequest(()))
            .await
            .map_err(|e| e.to_string())?
            .0)
    }
    async fn reinitialize_eeprom(&self, id: Uuid) -> CmdResult<u8> {
        Ok(self
            .exec(id)
            .query(QmkReinitializeEepromRequest(()))
            .await
            .map_err(|e| e.to_string())?
            .0)
    }

    async fn keymap_get(&self, id: Uuid, layout: String) -> CmdResult<MappedKeymap> {
        let s = self.state.borrow();
        s.client
            .device(id)
            .map_err(|e| e.to_string())?
            .keymap_with_layout(layout)
            .map_err(|e| e.to_string())
    }

    async fn remap_key(&self, id: Uuid, arg: RemappingSetKeycodeArg) -> CmdResult<()> {
        let constants = self.state.borrow().constants.clone();
        let mut exec = self.exec(id);
        let key = xap_core::session::remap_key(&mut exec, &constants, arg)
            .await
            .map_err(|e| e.to_string())?;
        self.state
            .borrow_mut()
            .client
            .device_mut(id)
            .map_err(|e| e.to_string())?
            .state_mut()
            .keymap
            .remap_key(&key)
            .map_err(|e| e.to_string())
    }

    async fn encoder_keymap_get(&self, id: Uuid) -> CmdResult<Vec<Vec<Vec<KeyCode>>>> {
        let (layer_count, encoder_count) = {
            let s = self.state.borrow();
            let state = s.client.device(id).map_err(|e| e.to_string())?.state();
            let layer_count = state
                .info
                .as_ref()
                .and_then(|i| i.keymap.as_ref().and_then(|k| k.layer_count))
                .or_else(|| {
                    state
                        .info
                        .as_ref()
                        .and_then(|i| i.remap.as_ref().and_then(|r| r.layer_count))
                })
                .unwrap_or(0);
            (layer_count, state.config.encoder_count)
        };
        if layer_count == 0 || encoder_count == 0 {
            return Ok(Vec::new());
        }
        let constants = self.state.borrow().constants.clone();
        let mut exec = self.exec(id);
        xap_core::session::query_encoder_keymap(&mut exec, &constants, layer_count, encoder_count)
            .await
            .map_err(|e| e.to_string())
    }

    async fn encoder_keycode_get(
        &self,
        id: Uuid,
        arg: KeymapGetEncoderKeycodeArg,
    ) -> CmdResult<u16> {
        Ok(self
            .exec(id)
            .query(KeymapGetEncoderKeycodeRequest(arg))
            .await
            .map_err(|e| e.to_string())?
            .0)
    }
    async fn encoder_keycode_set(
        &self,
        id: Uuid,
        arg: RemappingSetEncoderKeycodeArg,
    ) -> CmdResult<()> {
        self.exec(id)
            .query(RemappingSetEncoderKeycodeRequest(arg))
            .await
            .map(|_| ())
            .map_err(|e| e.to_string())
    }

    async fn keycode_template_encode(&self, t: KeycodeTemplate) -> CmdResult<u16> {
        t.encode()
            .ok_or_else(|| "keycode template is incomplete".to_string())
    }
    async fn decode_keycode(&self, code: u16) -> CmdResult<KeyCode> {
        Ok(self.state.borrow().constants.get_keycode(code))
    }

    async fn rgblight_get_config(&self, id: Uuid) -> CmdResult<RgbLightConfig> {
        self.exec(id)
            .query(RgblightGetConfigRequest(()))
            .await
            .map_err(|e| e.to_string())
    }
    async fn rgblight_set_config(&self, id: Uuid, cfg: RgbLightConfig) -> CmdResult<()> {
        self.exec(id)
            .query(RgblightSetConfigRequest(cfg))
            .await
            .map(|_| ())
            .map_err(|e| e.to_string())
    }
    async fn rgblight_save_config(&self, id: Uuid) -> CmdResult<()> {
        self.exec(id)
            .query(RgblightSaveConfigRequest(()))
            .await
            .map(|_| ())
            .map_err(|e| e.to_string())
    }
}

/// Async executor: one in-flight query per device, resolved when
/// `handle_input_report` lands the matching response. Direct port of
/// xap-wasm's `WasmExecutor`.
struct WebExecutor {
    state: Rc<RefCell<WebState>>,
    id: Uuid,
}

#[async_trait(?Send)]
impl XapQueryExecutor for WebExecutor {
    async fn query<T: XapRequest>(&mut self, request: T) -> anyhow::Result<T::Response> {
        let (tx, rx) = futures::channel::oneshot::channel();

        let token = {
            let mut st = self.state.borrow_mut();
            // A pre-existing waiter means a one-in-flight violation; overwriting
            // cancels the stale one, which is fine.
            st.waiters.insert(self.id, tx);

            let device = st
                .devices
                .get(&self.id)
                .ok_or_else(|| anyhow!("unknown device id: {}", self.id))?
                .clone();
            let writer = WebWriter { device };
            // NOTE: submit calls writer.write_report -> send_report synchronously
            // under this borrow. send_report (WebHID sendReport) returns a Promise
            // and must NOT reenter the client synchronously.
            st.client
                .device_mut(self.id)
                .map_err(|e| anyhow!("{e}"))?
                .submit(&writer, request)
                .map_err(|e| anyhow!("{e}"))?
        };

        rx.await.map_err(|_| anyhow!("request canceled"))?;

        let resp = {
            let mut st = self.state.borrow_mut();
            st.client
                .device_mut(self.id)
                .map_err(|e| anyhow!("{e}"))?
                .take_response::<T>(&token)
                .map_err(|e| anyhow!("{e}"))?
        };
        resp.ok_or_else(|| anyhow!("missing response"))
    }
}
