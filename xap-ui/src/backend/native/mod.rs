pub mod actor;
pub mod client;
pub mod hid;

use std::any::Any;
use std::cell::RefCell;
use std::rc::Rc;
use std::sync::mpsc::Sender;

use async_trait::async_trait;
use futures::channel::mpsc::UnboundedReceiver;
use futures::channel::oneshot;
use uuid::Uuid;

use xap_core::aggregation::keymap::MappedKeymap;
use xap_core::{XapDeviceState, XapEvent};
use xap_specs::constants::keycode::KeyCode;
use xap_specs::constants::keycode_encoder::KeycodeTemplate;
use xap_specs::constants::XapConstants;
use xap_specs::spec::keymap::KeymapGetEncoderKeycodeArg;
use xap_specs::spec::remapping::{RemappingSetEncoderKeycodeArg, RemappingSetKeycodeArg};
use xap_specs::spec::types::RgbLightConfig;

use super::{BackendCapabilities, CmdResult, XapBackend};
use actor::Job;
use client::XapClient;

pub struct NativeBackend {
    jobs: Sender<Job>,
    event_rx: RefCell<Option<UnboundedReceiver<XapEvent>>>,
    #[allow(clippy::type_complexity)]
    handler: RefCell<Option<Rc<dyn Fn(XapEvent)>>>,
}

impl Default for NativeBackend {
    fn default() -> Self {
        Self::new()
    }
}

impl NativeBackend {
    pub fn new() -> Self {
        let (jobs_tx, jobs_rx) = std::sync::mpsc::channel::<Job>();
        let (ev_tx, ev_rx) = futures::channel::mpsc::unbounded::<XapEvent>();
        std::thread::spawn(move || {
            let constants = match XapConstants::from_embedded() {
                Ok(c) => c,
                Err(e) => {
                    log::error!("failed to load XAP constants: {e}");
                    return;
                }
            };
            match XapClient::new(constants, ev_tx) {
                Ok(client) => actor::run(client, jobs_rx),
                Err(e) => log::error!("XapClient init failed: {e}"),
            }
        });
        Self {
            jobs: jobs_tx,
            event_rx: RefCell::new(Some(ev_rx)),
            handler: RefCell::new(None),
        }
    }

    async fn exec<T, F>(&self, f: F) -> CmdResult<T>
    where
        T: Send + 'static,
        F: FnOnce(&mut XapClient) -> anyhow::Result<T> + Send + 'static,
    {
        let (tx, rx) = oneshot::channel();
        self.jobs
            .send(Job(Box::new(move |c| {
                let _ = tx.send(f(c).map_err(|e| e.to_string()));
            })))
            .map_err(|_| "backend actor gone".to_string())?;
        rx.await
            .map_err(|_| "backend actor dropped reply".to_string())?
    }

    pub fn take_event_rx(&self) -> Option<UnboundedReceiver<XapEvent>> {
        self.event_rx.borrow_mut().take()
    }
    pub fn handler(&self) -> Option<Rc<dyn Fn(XapEvent)>> {
        self.handler.borrow().clone()
    }
}

#[async_trait(?Send)]
impl XapBackend for NativeBackend {
    fn capabilities(&self) -> BackendCapabilities {
        BackendCapabilities {
            requires_user_connect: false,
            unsupported_reason: None,
        }
    }
    fn set_event_listener(&self, h: Rc<dyn Fn(XapEvent)>) {
        *self.handler.borrow_mut() = Some(h);
    }
    fn clear_event_listener(&self) {
        *self.handler.borrow_mut() = None;
    }
    fn as_any(&self) -> &dyn Any {
        self
    }

    async fn connect_device(&self) -> CmdResult<()> {
        Ok(())
    } // desktop auto-enumerates

    async fn devices_get(&self) -> CmdResult<Vec<XapDeviceState>> {
        self.exec(|c| Ok(c.device_states())).await
    }
    async fn device_get(&self, id: Uuid) -> CmdResult<XapDeviceState> {
        self.exec(move |c| c.device_state(id)).await
    }
    async fn xap_constants_get(&self) -> CmdResult<XapConstants> {
        self.exec(|c| Ok(c.xap_constants())).await
    }

    async fn secure_lock(&self, id: Uuid) -> CmdResult<()> {
        self.exec(move |c| c.secure_lock(id)).await
    }
    async fn secure_unlock(&self, id: Uuid) -> CmdResult<()> {
        self.exec(move |c| c.secure_unlock(id)).await
    }
    async fn jump_to_bootloader(&self, id: Uuid) -> CmdResult<u8> {
        self.exec(move |c| c.jump_to_bootloader(id)).await
    }
    async fn reinitialize_eeprom(&self, id: Uuid) -> CmdResult<u8> {
        self.exec(move |c| c.reinitialize_eeprom(id)).await
    }

    async fn keymap_get(&self, id: Uuid, layout: String) -> CmdResult<MappedKeymap> {
        self.exec(move |c| c.keymap_with_layout(id, layout)).await
    }
    async fn remap_key(&self, id: Uuid, arg: RemappingSetKeycodeArg) -> CmdResult<()> {
        self.exec(move |c| c.remap_key(id, arg)).await
    }
    async fn encoder_keymap_get(&self, id: Uuid) -> CmdResult<Vec<Vec<Vec<KeyCode>>>> {
        self.exec(move |c| c.encoder_keymap_get(id)).await
    }
    async fn encoder_keycode_get(
        &self,
        id: Uuid,
        arg: KeymapGetEncoderKeycodeArg,
    ) -> CmdResult<u16> {
        self.exec(move |c| c.encoder_keycode_get(id, arg)).await
    }
    async fn encoder_keycode_set(
        &self,
        id: Uuid,
        arg: RemappingSetEncoderKeycodeArg,
    ) -> CmdResult<()> {
        self.exec(move |c| c.encoder_keycode_set(id, arg)).await
    }

    async fn keycode_template_encode(&self, t: KeycodeTemplate) -> CmdResult<u16> {
        t.encode()
            .ok_or_else(|| "keycode template is incomplete".to_string())
    }
    async fn decode_keycode(&self, code: u16) -> CmdResult<KeyCode> {
        self.exec(move |c| Ok(c.xap_constants().get_keycode(code)))
            .await
    }

    async fn rgblight_get_config(&self, id: Uuid) -> CmdResult<RgbLightConfig> {
        self.exec(move |c| c.rgblight_get_config(id)).await
    }
    async fn rgblight_set_config(&self, id: Uuid, cfg: RgbLightConfig) -> CmdResult<()> {
        self.exec(move |c| c.rgblight_set_config(id, cfg)).await
    }
    async fn rgblight_save_config(&self, id: Uuid) -> CmdResult<()> {
        self.exec(move |c| c.rgblight_save_config(id)).await
    }
}
