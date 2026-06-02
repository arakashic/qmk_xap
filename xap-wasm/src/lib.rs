//! xap-wasm: a `wasm-bindgen` wrapper over `xap-core` that bridges the core's
//! non-blocking push model to JS Promises for the browser.
//!
//! The core is single-threaded and sync; the browser cannot block to await each
//! request. So instead of reusing `xap_core::session`'s sync `XapQueryExecutor`
//! orchestration, we re-implement the same request *sequences* asynchronously
//! (see [`device_info_flow`]) while reusing every pure piece: the spec
//! request/response types, `XapConstants::get_keycode`, `Config`/serde parsing,
//! `Keymap` building, and gzip decompression. The duplication of the request
//! order + capability gating is an accepted cost of sync-core + async-browser.
//!
//! Threading model: single-threaded browser, so `Rc<RefCell<Inner>>` (not
//! Arc/Mutex). A RefCell borrow is NEVER held across an `.await` or across a JS
//! call that might reenter the client. The one unavoidable JS call under a
//! borrow is `submit -> writer.write_report -> send_report`; the documented
//! contract is that `send_report` (WebHID `sendReport`, which returns a Promise)
//! must not synchronously reenter `handle_input_report`.

use std::cell::RefCell;
use std::collections::HashMap;
use std::io::Read;
use std::rc::Rc;
use std::sync::Arc;

use anyhow::anyhow;
use flate2::read::GzDecoder;
use uuid::Uuid;
use wasm_bindgen::prelude::*;

use xap_specs::constants::XapConstants;
use xap_specs::request::XapRequest;

use xap_specs::spec::{
    keymap::{
        KeymapCapabilitiesFlags, KeymapCapabilitiesRequest, KeymapGetKeycodeRequest,
        KeymapGetLayerCountRequest,
    },
    lighting::{
        backlight::{
            BacklightCapabilitiesFlags, BacklightCapabilitiesRequest,
            BacklightGetEnabledEffectsRequest,
        },
        rgblight::{
            RgblightCapabilitiesFlags, RgblightCapabilitiesRequest,
            RgblightGetEnabledEffectsRequest,
        },
        rgbmatrix::{
            RgbmatrixCapabilitiesFlags, RgbmatrixCapabilitiesRequest,
            RgbmatrixGetEnabledEffectsRequest,
        },
        LightingCapabilitiesFlags, LightingCapabilitiesRequest,
    },
    qmk::{
        QmkBoardIdentifiersRequest, QmkBoardManufacturerRequest, QmkCapabilitiesFlags,
        QmkCapabilitiesRequest, QmkConfigBlobChunkRequest, QmkConfigBlobLengthRequest,
        QmkHardwareIdentifierRequest, QmkProductNameRequest, QmkVersionRequest,
    },
    remapping::{
        RemappingCapabilitiesFlags, RemappingCapabilitiesRequest, RemappingGetLayerCountRequest,
        RemappingSetKeycodeArg, RemappingSetKeycodeRequest,
    },
    xap::{
        XapEnabledSubsystemCapabilitiesFlags, XapEnabledSubsystemCapabilitiesRequest,
        XapSecureLockRequest, XapSecureStatusRequest, XapSecureUnlockRequest, XapVersionRequest,
    },
};

use xap_core::aggregation::{
    config::Config, KeymapInfo, LightingCapabilities, LightingInfo, Point2D, Point3D, QmkInfo,
    RemapInfo, XapDeviceInfo, XapInfo,
};
use xap_core::transport::{IngestOutcome, XapWriter};
use xap_core::{Keymap, KeymapKey, XapClient, XapDevice, XapDeviceState};

fn jserr(e: anyhow::Error) -> JsValue {
    JsValue::from_str(&e.to_string())
}

fn jserr_str(e: impl std::fmt::Display) -> JsValue {
    JsValue::from_str(&e.to_string())
}

/// Copied byte-for-byte from `xap_core::device::format_hardware_id`, which is
/// `pub(crate)` and therefore not reachable from this crate.
fn format_hardware_id(hardware_id: [u32; 4]) -> String {
    hardware_id
        .iter()
        .map(|word| format!("0x{word:08X}"))
        .collect::<Vec<_>>()
        .join(" ")
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
                let value = serde_wasm_bindgen::to_value(&ev)?;
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
            let state = device_info_flow(inner.clone(), id).await?;
            {
                inner
                    .borrow_mut()
                    .client
                    .device_mut(id)
                    .map_err(jserr)?
                    .set_state(state.clone());
            }
            serde_wasm_bindgen::to_value(&state).map_err(jserr_str)
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
        serde_wasm_bindgen::to_value(&states).map_err(jserr_str)
    }

    /// Synchronous getter: one device's current state.
    pub fn device_state(&self, device_id: String) -> Result<JsValue, JsValue> {
        let id = Uuid::parse_str(&device_id).map_err(jserr_str)?;
        let inner = self.inner.borrow();
        let state = inner.client.device(id).map_err(jserr)?.state().clone();
        serde_wasm_bindgen::to_value(&state).map_err(jserr_str)
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
            serde_wasm_bindgen::to_value(&mapped).map_err(jserr_str)
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

            query(inner.clone(), id, RemappingSetKeycodeRequest(arg.clone())).await?;

            let position = Point3D {
                z: arg.layer as u64,
                y: arg.row as u64,
                x: arg.column as u64,
            };
            let raw = query(inner.clone(), id, KeymapGetKeycodeRequest(position.into())).await?;

            let mut inner_ref = inner.borrow_mut();
            let code = inner_ref.constants.get_keycode(raw.0);
            let key = KeymapKey { code, position };
            inner_ref
                .client
                .device_mut(id)
                .map_err(jserr)?
                .state_mut()
                .keymap
                .remap_key(&key)
                .map_err(jserr)?;
            serde_wasm_bindgen::to_value(&key).map_err(jserr_str)
        })
    }

    pub fn xap_secure_unlock(&self, device_id: String) -> js_sys::Promise {
        let inner = self.inner.clone();
        wasm_bindgen_futures::future_to_promise(async move {
            let id = Uuid::parse_str(&device_id).map_err(jserr_str)?;
            query(inner, id, XapSecureUnlockRequest(())).await?;
            Ok(JsValue::UNDEFINED)
        })
    }

    pub fn xap_secure_lock(&self, device_id: String) -> js_sys::Promise {
        let inner = self.inner.clone();
        wasm_bindgen_futures::future_to_promise(async move {
            let id = Uuid::parse_str(&device_id).map_err(jserr_str)?;
            query(inner, id, XapSecureLockRequest(())).await?;
            Ok(JsValue::UNDEFINED)
        })
    }
}

/// Submit a single request and await its response. One in-flight per device.
async fn query<T: XapRequest>(
    inner: Rc<RefCell<Inner>>,
    id: Uuid,
    request: T,
) -> Result<T::Response, JsValue> {
    let (tx, rx) = futures::channel::oneshot::channel();

    let token = {
        let mut inner = inner.borrow_mut();
        // A pre-existing waiter means a protocol violation of one-in-flight;
        // overwriting cancels the stale one, which is fine.
        inner.waiters.insert(id, tx);

        let writer = WasmWriter {
            device_id: id.to_string(),
            send_report: inner.send_report.clone(),
        };
        // NOTE: submit calls writer.write_report -> send_report synchronously
        // while this borrow is held. send_report must NOT reenter the client
        // synchronously (WebHID sendReport returns a Promise and won't).
        inner.client.device_mut(id).map_err(jserr)?.submit(&writer, request).map_err(jserr)?
    };

    rx.await.map_err(|_| JsValue::from_str("request canceled"))?;

    let resp = {
        let mut inner = inner.borrow_mut();
        inner
            .client
            .device_mut(id)
            .map_err(jserr)?
            .take_response::<T>(&token)
            .map_err(jserr)?
    };
    resp.ok_or_else(|| JsValue::from_str("missing response"))
}

/// Async re-implementation of `xap_core::session::query_config`: fetch the
/// chunked gzip config blob, decompress, and parse into `(Config, pretty_json)`.
async fn config_flow(inner: Rc<RefCell<Inner>>, id: Uuid) -> Result<(Config, String), JsValue> {
    let size = query(inner.clone(), id, QmkConfigBlobLengthRequest(()))
        .await?
        .0;

    let mut data: Vec<u8> = Vec::with_capacity(size as usize);
    let mut offset: u16 = 0;
    while offset < size {
        let chunk = query(inner.clone(), id, QmkConfigBlobChunkRequest(offset)).await?;
        data.extend(chunk.0.into_iter());
        offset += chunk.0.len() as u16;
    }

    let data = &data[..(size as usize)];

    let mut decoder = GzDecoder::new(data);
    let mut decompressed = String::new();
    decoder.read_to_string(&mut decompressed).map_err(jserr_str)?;

    let value: serde_json::Value = serde_json::from_str(&decompressed).map_err(jserr_str)?;
    let config_json = serde_json::to_string_pretty(&value).map_err(jserr_str)?;
    let config = serde_json::from_value(value).map_err(jserr_str)?;

    Ok((config, config_json))
}

/// Async re-implementation of `session::query_device_info`. Byte-faithful to the
/// sync version's request order and capability gating.
async fn device_info_flow_inner(
    inner: Rc<RefCell<Inner>>,
    id: Uuid,
) -> Result<(XapDeviceInfo, Config, String), JsValue> {
    let subsystems = query(
        inner.clone(),
        id,
        XapEnabledSubsystemCapabilitiesRequest(()),
    )
    .await?;

    let xap_info = XapInfo {
        version: query(inner.clone(), id, XapVersionRequest(())).await?.0,
    };

    let qmk_caps = query(inner.clone(), id, QmkCapabilitiesRequest(())).await?;
    let board_ids = query(inner.clone(), id, QmkBoardIdentifiersRequest(())).await?;
    let manufacturer = query(inner.clone(), id, QmkBoardManufacturerRequest(()))
        .await?
        .0
         .0
        .trim_matches('"')
        .to_owned();
    let product_name = query(inner.clone(), id, QmkProductNameRequest(()))
        .await?
        .0
         .0
        .trim_matches('"')
        .to_owned();

    let (config, config_json) = config_flow(inner.clone(), id).await?;

    let hardware_id = query(inner.clone(), id, QmkHardwareIdentifierRequest(()))
        .await?
        .0;

    let qmk_info = QmkInfo {
        version: query(inner.clone(), id, QmkVersionRequest(()))
            .await?
            .0
            .to_string(),
        board_ids,
        manufacturer,
        product_name,
        hardware_id: format_hardware_id(hardware_id),
        jump_to_bootloader_enabled: qmk_caps.contains(QmkCapabilitiesFlags::JumpToBootloader),
        eeprom_reset_enabled: qmk_caps.contains(QmkCapabilitiesFlags::ReinitializeEeprom),
    };

    let keymap_info = if subsystems.contains(XapEnabledSubsystemCapabilitiesFlags::Keymap) {
        let keymap_caps = query(inner.clone(), id, KeymapCapabilitiesRequest(())).await?;

        let layer_count = if keymap_caps.contains(KeymapCapabilitiesFlags::GetLayerCount) {
            Some(
                query(inner.clone(), id, KeymapGetLayerCountRequest(()))
                    .await?
                    .0,
            )
        } else {
            None
        };

        Some(KeymapInfo {
            layer_count,
            get_keycode_enabled: keymap_caps.contains(KeymapCapabilitiesFlags::GetKeycode),
            get_encoder_keycode_enabled: keymap_caps
                .contains(KeymapCapabilitiesFlags::GetEncoderKeycode),
        })
    } else {
        None
    };

    let remap_info = if subsystems.contains(XapEnabledSubsystemCapabilitiesFlags::Remapping) {
        let remap_caps = query(inner.clone(), id, RemappingCapabilitiesRequest(())).await?;

        let layer_count = if remap_caps.contains(RemappingCapabilitiesFlags::GetLayerCount) {
            Some(
                query(inner.clone(), id, RemappingGetLayerCountRequest(()))
                    .await?
                    .0,
            )
        } else {
            None
        };

        Some(RemapInfo {
            layer_count,
            set_keycode_enabled: remap_caps.contains(RemappingCapabilitiesFlags::SetKeycode),
            set_encoder_keycode_enabled: remap_caps
                .contains(RemappingCapabilitiesFlags::SetEncoderKeycode),
        })
    } else {
        None
    };

    let lighting_info = if subsystems.contains(XapEnabledSubsystemCapabilitiesFlags::Lighting) {
        let lighting_caps = query(inner.clone(), id, LightingCapabilitiesRequest(())).await?;

        let backlight_info = if lighting_caps.contains(LightingCapabilitiesFlags::Backlight) {
            let backlight_caps = query(inner.clone(), id, BacklightCapabilitiesRequest(())).await?;

            let effects = if backlight_caps.contains(BacklightCapabilitiesFlags::GetEnabledEffects) {
                query(inner.clone(), id, BacklightGetEnabledEffectsRequest(()))
                    .await?
                    .0
            } else {
                0
            };

            let map = {
                let inner = inner.borrow();
                inner.constants.led_matrix_modes.get_effect_map(effects as u64)
            };
            Some(LightingCapabilities::new(
                map,
                backlight_caps.contains(BacklightCapabilitiesFlags::GetConfig),
                backlight_caps.contains(BacklightCapabilitiesFlags::SetConfig),
                backlight_caps.contains(BacklightCapabilitiesFlags::SaveConfig),
            ))
        } else {
            None
        };

        let rgblight_info = if lighting_caps.contains(LightingCapabilitiesFlags::Rgblight) {
            let rgblight_caps = query(inner.clone(), id, RgblightCapabilitiesRequest(())).await?;

            let effects = if rgblight_caps.contains(RgblightCapabilitiesFlags::GetEnabledEffects) {
                query(inner.clone(), id, RgblightGetEnabledEffectsRequest(()))
                    .await?
                    .0
            } else {
                0
            };

            let map = {
                let inner = inner.borrow();
                inner.constants.rgblight_modes.get_effect_map(effects)
            };
            Some(LightingCapabilities::new(
                map,
                rgblight_caps.contains(RgblightCapabilitiesFlags::GetConfig),
                rgblight_caps.contains(RgblightCapabilitiesFlags::SetConfig),
                rgblight_caps.contains(RgblightCapabilitiesFlags::SaveConfig),
            ))
        } else {
            None
        };

        let rgbmatrix_info = if lighting_caps.contains(LightingCapabilitiesFlags::Rgbmatrix) {
            let rgbmatrix_caps = query(inner.clone(), id, RgbmatrixCapabilitiesRequest(())).await?;

            let effects = if rgbmatrix_caps.contains(RgbmatrixCapabilitiesFlags::GetEnabledEffects) {
                query(inner.clone(), id, RgbmatrixGetEnabledEffectsRequest(()))
                    .await?
                    .0
            } else {
                0
            };

            let map = {
                let inner = inner.borrow();
                inner.constants.rgb_matrix_modes.get_effect_map(effects)
            };
            Some(LightingCapabilities::new(
                map,
                rgbmatrix_caps.contains(RgbmatrixCapabilitiesFlags::GetConfig),
                rgbmatrix_caps.contains(RgbmatrixCapabilitiesFlags::SetConfig),
                rgbmatrix_caps.contains(RgbmatrixCapabilitiesFlags::SaveConfig),
            ))
        } else {
            None
        };

        Some(LightingInfo {
            backlight: backlight_info,
            rgblight: rgblight_info,
            rgbmatrix: rgbmatrix_info,
        })
    } else {
        None
    };

    let info = XapDeviceInfo {
        xap: xap_info,
        qmk: qmk_info,
        keymap: keymap_info,
        remap: remap_info,
        lighting: lighting_info,
    };

    Ok((info, config, config_json))
}

/// Async re-implementation of `session::query_keymap`.
async fn keymap_flow(
    inner: Rc<RefCell<Inner>>,
    id: Uuid,
    info: &XapDeviceInfo,
    config: &Config,
) -> Result<Keymap, JsValue> {
    let layers: u64 = if let Some(keymap) = &info.keymap {
        keymap.layer_count.unwrap_or_default() as u64
    } else {
        0
    };

    let Point2D {
        x: columns,
        y: rows,
    } = config.matrix_size;

    let mut keymap = Keymap::new(layers, rows, columns);

    for layer in 0..layers {
        for row in 0..rows {
            for column in 0..columns {
                let position = Point3D {
                    z: layer,
                    y: row,
                    x: column,
                };
                let raw = query(inner.clone(), id, KeymapGetKeycodeRequest(position.into())).await?;
                let code = {
                    let inner = inner.borrow();
                    inner.constants.get_keycode(raw.0)
                };
                keymap
                    .remap_key(&KeymapKey { code, position })
                    .map_err(jserr)?;
            }
        }
    }

    Ok(keymap)
}

/// Async re-implementation of `session::initialize`: device info, keymap,
/// secure status -> a fully assembled `XapDeviceState`.
async fn device_info_flow(
    inner: Rc<RefCell<Inner>>,
    id: Uuid,
) -> Result<XapDeviceState, JsValue> {
    let (info, config, config_json) = device_info_flow_inner(inner.clone(), id).await?;
    let keymap = keymap_flow(inner.clone(), id, &info, &config).await?;
    let secure_status = query(inner.clone(), id, XapSecureStatusRequest(()))
        .await?
        .0
        .into();

    Ok(XapDeviceState {
        id,
        info: Some(info),
        keymap,
        config,
        config_json,
        secure_status,
    })
}
