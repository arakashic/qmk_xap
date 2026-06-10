use std::any::Any;
use std::rc::Rc;

use async_trait::async_trait;
use uuid::Uuid;

use xap_core::aggregation::keymap::MappedKeymap;
use xap_core::{XapDeviceState, XapEvent};
use xap_specs::constants::keycode::KeyCode;
use xap_specs::constants::keycode_encoder::KeycodeTemplate;
use xap_specs::constants::XapConstants;
use xap_specs::spec::keymap::KeymapGetEncoderKeycodeArg;
use xap_specs::spec::types::RgbLightConfig;
use xap_specs::spec::remapping::{RemappingSetEncoderKeycodeArg, RemappingSetKeycodeArg};

pub type CmdResult<T> = Result<T, String>;

#[derive(Clone, Debug)]
pub struct BackendCapabilities {
    pub requires_user_connect: bool,
    pub unsupported_reason: Option<String>,
}

#[async_trait(?Send)]
pub trait XapBackend: Any {
    fn capabilities(&self) -> BackendCapabilities;
    fn set_event_listener(&self, handler: Rc<dyn Fn(XapEvent)>);
    fn clear_event_listener(&self);
    fn as_any(&self) -> &dyn Any;

    async fn connect_device(&self) -> CmdResult<()>;
    async fn devices_get(&self) -> CmdResult<Vec<XapDeviceState>>;
    async fn device_get(&self, id: Uuid) -> CmdResult<XapDeviceState>;
    async fn xap_constants_get(&self) -> CmdResult<XapConstants>;

    async fn secure_lock(&self, id: Uuid) -> CmdResult<()>;
    async fn secure_unlock(&self, id: Uuid) -> CmdResult<()>;
    async fn jump_to_bootloader(&self, id: Uuid) -> CmdResult<u8>;
    async fn reinitialize_eeprom(&self, id: Uuid) -> CmdResult<u8>;

    async fn keymap_get(&self, id: Uuid, layout: String) -> CmdResult<MappedKeymap>;
    async fn remap_key(&self, id: Uuid, arg: RemappingSetKeycodeArg) -> CmdResult<()>;
    async fn encoder_keymap_get(&self, id: Uuid) -> CmdResult<Vec<Vec<Vec<KeyCode>>>>;
    async fn encoder_keycode_get(&self, id: Uuid, arg: KeymapGetEncoderKeycodeArg) -> CmdResult<u16>;
    async fn encoder_keycode_set(&self, id: Uuid, arg: RemappingSetEncoderKeycodeArg) -> CmdResult<()>;

    async fn keycode_template_encode(&self, template: KeycodeTemplate) -> CmdResult<u16>;
    async fn decode_keycode(&self, code: u16) -> CmdResult<KeyCode>;

    async fn rgblight_get_config(&self, id: Uuid) -> CmdResult<RgbLightConfig>;
    async fn rgblight_set_config(&self, id: Uuid, config: RgbLightConfig) -> CmdResult<()>;
    async fn rgblight_save_config(&self, id: Uuid) -> CmdResult<()>;
}

#[cfg(not(target_arch = "wasm32"))]
pub mod native;
#[cfg(target_arch = "wasm32")]
pub mod web;

#[cfg(not(target_arch = "wasm32"))]
pub fn select_backend() -> Rc<dyn XapBackend> {
    Rc::new(native::NativeBackend::new())
}
#[cfg(target_arch = "wasm32")]
pub fn select_backend() -> Rc<dyn XapBackend> {
    Rc::new(web::WebBackend::new())
}
