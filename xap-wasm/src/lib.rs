//! xap-wasm: a `wasm-bindgen` wrapper over `xap-core` that bridges the core's
//! non-blocking push model to JS Promises for the browser.
//!
//! The core is single-threaded; the browser cannot block to await each request.
//! `xap_core::session`'s orchestration is now `async` over the `XapQueryExecutor`
//! seam, so we reuse it directly: [`WasmExecutor`] implements that seam (one
//! in-flight query per device, resolved when `handle_input_report` lands the
//! matching response), and `device_get`/`remap_key`/`encoder_keymap_get` route
//! through `xap_core::session::*`. No request sequences are re-implemented here.
//!
//! Threading model: single-threaded browser, so `Rc<RefCell<Inner>>` (not
//! Arc/Mutex). A RefCell borrow is NEVER held across an `.await` or across a JS
//! call that might reenter the client. The one unavoidable JS call under a
//! borrow is `submit -> writer.write_report -> send_report`; the documented
//! contract is that `send_report` (WebHID `sendReport`, which returns a Promise)
//! must not synchronously reenter `handle_input_report`.

use std::cell::RefCell;
use std::collections::HashMap;
use std::rc::Rc;
use std::sync::Arc;

use anyhow::anyhow;
use async_trait::async_trait;
use uuid::Uuid;
use wasm_bindgen::prelude::*;

use xap_specs::constants::keycode_encoder::KeycodeTemplate;
use xap_specs::constants::keycode::KeyCode;
use xap_specs::constants::XapConstants;
use xap_specs::request::XapRequest;

use xap_specs::spec::remapping::RemappingSetKeycodeArg;

use xap_core::transport::{IngestOutcome, XapQueryExecutor, XapWriter};
use xap_core::{XapClient, XapDevice, XapDeviceState};

fn jserr(e: anyhow::Error) -> JsValue {
    JsValue::from_str(&e.to_string())
}

fn jserr_str(e: impl std::fmt::Display) -> JsValue {
    JsValue::from_str(&e.to_string())
}

/// Serialize to a JsValue via `serde_json` + `JSON.parse`, producing exactly the
/// shape the desktop (tauri serde_json) path yields — plain JS objects, and
/// integer map keys (e.g. lighting effects `HashMap<u16, _>`) stringified into
/// object keys. `serde_wasm_bindgen` instead emits JS `Map`s and rejects
/// non-string map keys, which diverges from the UI's contract.
fn to_js<T: serde::Serialize + ?Sized>(value: &T) -> Result<JsValue, JsValue> {
    let json = serde_json::to_string(value).map_err(jserr_str)?;
    js_sys::JSON::parse(&json)
}

struct Inner {
    client: XapClient,
    constants: Arc<XapConstants>,
    /// One in-flight query per device. `handle_input_report` resolves the
    /// pending query by sending on this channel when a matching response lands.
    waiters: HashMap<Uuid, futures::channel::oneshot::Sender<()>>,
    /// JS: `(deviceId: string, data: Uint8Array) => void`
    send_report: js_sys::Function,
    /// JS: `(event: any) => void`
    emit_event: js_sys::Function,
}

#[wasm_bindgen]
pub struct XapWasmClient {
    inner: Rc<RefCell<Inner>>,
}

/// Hands report bytes to the JS `send_report` callback (WebHID `sendReport`).
struct WasmWriter {
    device_id: String,
    send_report: js_sys::Function,
}

impl XapWriter for WasmWriter {
    fn write_report(&self, report: &[u8]) -> anyhow::Result<()> {
        let array = js_sys::Uint8Array::from(report);
        self.send_report
            .call2(
                &JsValue::NULL,
                &JsValue::from_str(&self.device_id),
                &array,
            )
            .map_err(|e| anyhow!("send_report failed: {:?}", e))?;
        Ok(())
    }
}

#[wasm_bindgen]
impl XapWasmClient {
    #[wasm_bindgen(constructor)]
    pub fn new(
        send_report: js_sys::Function,
        emit_event: js_sys::Function,
    ) -> Result<XapWasmClient, JsValue> {
        console_error_panic_hook::set_once();

        let constants = Arc::new(XapConstants::from_embedded().map_err(jserr)?);
        let client = XapClient::new(Arc::clone(&constants));

        Ok(XapWasmClient {
            inner: Rc::new(RefCell::new(Inner {
                client,
                constants,
                waiters: HashMap::new(),
                send_report,
                emit_event,
            })),
        })
    }

    /// Register a device after the browser has opened it over WebHID. Must be
    /// called before `device_get`.
    pub fn add_device(&self, device_id: String) -> Result<(), JsValue> {
        let id = Uuid::parse_str(&device_id).map_err(jserr_str)?;
        let mut inner = self.inner.borrow_mut();
        let constants = Arc::clone(&inner.constants);
        inner.client.add_device(XapDevice::new(id, constants));
        Ok(())
    }

    pub fn remove_device(&self, device_id: String) {
        if let Ok(id) = Uuid::parse_str(&device_id) {
            let mut inner = self.inner.borrow_mut();
            inner.client.remove_device(id);
            inner.waiters.remove(&id);
        }
    }

    /// Counterpart of core `ingest`: feed one inbound report from the browser.
    pub fn handle_input_report(&self, device_id: String, report: &[u8]) -> Result<(), JsValue> {
        let id = Uuid::parse_str(&device_id).map_err(jserr_str)?;

        // Decide what to do under a tight borrow; collect any JS work to run
        // after the borrow drops (never hold the borrow across a JS call).
        let events = {
            let mut inner = self.inner.borrow_mut();
            let outcome = inner.client.ingest(id, report).map_err(jserr)?;
            match outcome {
                IngestOutcome::Response { .. } => {
                    if let Some(tx) = inner.waiters.remove(&id) {
                        let _ = tx.send(());
                    }
                    None
                }
                IngestOutcome::Broadcast => Some(inner.client.drain_broadcasts()),
                IngestOutcome::Unmatched => None,
            }
        };

        if let Some(events) = events {
            let emit = self.inner.borrow().emit_event.clone();
            for (_id, ev) in events {
                let value = to_js(&ev)?;
                emit.call1(&JsValue::NULL, &value)?;
            }
        }

        Ok(())
    }

    /// Full async device-info + keymap + secure-status flow; stores the result
    /// as the device state and returns it as JS.
    pub fn device_get(&self, device_id: String) -> js_sys::Promise {
        let inner = self.inner.clone();
        wasm_bindgen_futures::future_to_promise(async move {
            let id = Uuid::parse_str(&device_id).map_err(jserr_str)?;
            let constants = inner.borrow().constants.clone();
            let mut exec = WasmExecutor {
                inner: inner.clone(),
                id,
            };
            let state = xap_core::session::initialize(&mut exec, constants, id)
                .await
                .map_err(jserr)?;
            inner
                .borrow_mut()
                .client
                .device_mut(id)
                .map_err(jserr)?
                .set_state(state.clone());
            to_js(&state)
        })
    }

    /// Synchronous getter: all device states.
    pub fn devices(&self) -> Result<JsValue, JsValue> {
        let inner = self.inner.borrow();
        let states: Vec<XapDeviceState> = inner
            .client
            .get_devices()
            .into_iter()
            .map(|d| d.state().clone())
            .collect();
        to_js(&states)
    }

    /// Synchronous getter: one device's current state.
    pub fn device_state(&self, device_id: String) -> Result<JsValue, JsValue> {
        let id = Uuid::parse_str(&device_id).map_err(jserr_str)?;
        let inner = self.inner.borrow();
        let state = inner.client.device(id).map_err(jserr)?.state().clone();
        to_js(&state)
    }

    /// Pure (no I/O), but returns a Promise for API uniformity.
    pub fn keymap_get(&self, device_id: String, layout: String) -> js_sys::Promise {
        let inner = self.inner.clone();
        wasm_bindgen_futures::future_to_promise(async move {
            let id = Uuid::parse_str(&device_id).map_err(jserr_str)?;
            let mapped = {
                let inner = inner.borrow();
                inner
                    .client
                    .device(id)
                    .map_err(jserr)?
                    .keymap_with_layout(layout)
                    .map_err(jserr)?
            };
            to_js(&mapped)
        })
    }

    /// Set a keycode, read it back, and update the device's keymap. Mirrors
    /// `session::remap_key` + `query_key`.
    pub fn remap_key(&self, device_id: String, arg: JsValue) -> js_sys::Promise {
        let inner = self.inner.clone();
        wasm_bindgen_futures::future_to_promise(async move {
            let id = Uuid::parse_str(&device_id).map_err(jserr_str)?;
            let arg: RemappingSetKeycodeArg =
                serde_wasm_bindgen::from_value(arg).map_err(jserr_str)?;

            let constants = inner.borrow().constants.clone();
            let mut exec = WasmExecutor {
                inner: inner.clone(),
                id,
            };
            let key = xap_core::session::remap_key(&mut exec, &constants, arg)
                .await
                .map_err(jserr)?;

            inner
                .borrow_mut()
                .client
                .device_mut(id)
                .map_err(jserr)?
                .state_mut()
                .keymap
                .remap_key(&key)
                .map_err(jserr)?;
            to_js(&key)
        })
    }

    // --- Pure (synchronous) getters -----------------------------------------

    /// JS `decodeKeycode(code)` -> KeyCode.
    pub fn decode_keycode(&self, code: u16) -> Result<JsValue, JsValue> {
        let inner = self.inner.borrow();
        let keycode = inner.constants.get_keycode(code);
        to_js(&keycode)
    }

    /// JS `keycodeTemplateEncode(template)` -> u16.
    pub fn keycode_template_encode(&self, template: JsValue) -> Result<JsValue, JsValue> {
        let template: KeycodeTemplate =
            serde_wasm_bindgen::from_value(template).map_err(jserr_str)?;
        let code = template
            .encode()
            .ok_or_else(|| JsValue::from_str("keycode template is incomplete"))?;
        to_js(&code)
    }

    /// JS `xapConstantsGet()` -> XapConstants.
    pub fn xap_constants(&self) -> Result<JsValue, JsValue> {
        let inner = self.inner.borrow();
        to_js(inner.constants.as_ref())
    }

    // --- Async orchestration ------------------------------------------------

    /// JS `encoderKeymapGet(id)` -> KeyCode[][][]. Sweeps every
    /// (layer, encoder, clockwise) slot, decoding each against the catalog.
    pub fn encoder_keymap_get(&self, device_id: String) -> js_sys::Promise {
        let inner = self.inner.clone();
        wasm_bindgen_futures::future_to_promise(async move {
            let id = Uuid::parse_str(&device_id).map_err(jserr_str)?;

            let (layer_count, encoder_count) = {
                let inner_ref = inner.borrow();
                let state = inner_ref.client.device(id).map_err(jserr)?.state();
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
                let encoder_count = state.config.encoder_count;
                (layer_count, encoder_count)
            };

            if layer_count == 0 || encoder_count == 0 {
                return to_js(&Vec::<Vec<Vec<KeyCode>>>::new());
            }

            let constants = inner.borrow().constants.clone();
            let mut exec = WasmExecutor {
                inner: inner.clone(),
                id,
            };
            let out = xap_core::session::query_encoder_keymap(
                &mut exec,
                &constants,
                layer_count,
                encoder_count,
            )
            .await
            .map_err(jserr)?;
            to_js(&out)
        })
    }
}

/// Async executor: one in-flight query per device, resolved when
/// `handle_input_report` lands the matching response. This is the former free
/// `query` fn, returning `anyhow::Result` so it satisfies the shared seam.
struct WasmExecutor {
    inner: Rc<RefCell<Inner>>,
    id: Uuid,
}

#[async_trait(?Send)]
impl XapQueryExecutor for WasmExecutor {
    async fn query<T: XapRequest>(&mut self, request: T) -> anyhow::Result<T::Response> {
        let (tx, rx) = futures::channel::oneshot::channel();

        let token = {
            let mut inner = self.inner.borrow_mut();
            // A pre-existing waiter means a protocol violation of one-in-flight;
            // overwriting cancels the stale one, which is fine.
            inner.waiters.insert(self.id, tx);

            let writer = WasmWriter {
                device_id: self.id.to_string(),
                send_report: inner.send_report.clone(),
            };
            // NOTE: submit calls writer.write_report -> send_report synchronously
            // while this borrow is held. send_report must NOT reenter the client
            // synchronously (WebHID sendReport returns a Promise and won't).
            inner
                .client
                .device_mut(self.id)
                .map_err(|e| anyhow!("{e}"))?
                .submit(&writer, request)
                .map_err(|e| anyhow!("{e}"))?
        };

        rx.await.map_err(|_| anyhow!("request canceled"))?;

        let resp = {
            let mut inner = self.inner.borrow_mut();
            inner
                .client
                .device_mut(self.id)
                .map_err(|e| anyhow!("{e}"))?
                .take_response::<T>(&token)
                .map_err(|e| anyhow!("{e}"))?
        };
        resp.ok_or_else(|| anyhow!("missing response"))
    }
}

/// Thin free wrapper kept for the Layer 1 generated passthrough methods, which
/// call `query(inner, id, request)` and expect a `Result<_, JsValue>`. Delegates
/// to `WasmExecutor` so the borrow/submit/await logic lives in one place.
async fn query<T: XapRequest>(
    inner: Rc<RefCell<Inner>>,
    id: Uuid,
    request: T,
) -> Result<T::Response, JsValue> {
    let mut exec = WasmExecutor { inner, id };
    exec.query(request).await.map_err(jserr)
}

// Layer 1 generated passthrough methods (second #[wasm_bindgen] impl block).
include!("generated.rs");
