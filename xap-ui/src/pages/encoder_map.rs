//! EncoderMapView port: per-layer encoder cards with CCW/CW slots, the same
//! parameterised-template remap flow as KeymapView, and a write-then-readback
//! per slot. Reuses the KeycodePicker.

use std::rc::Rc;

use dioxus::prelude::*;
use uuid::Uuid;
use xap_specs::constants::keycode::KeyCode;
use xap_specs::constants::keycode_encoder::KeycodeTemplate;
use xap_specs::spec::keymap::KeymapGetEncoderKeycodeArg;
use xap_specs::spec::remapping::RemappingSetEncoderKeycodeArg;
use xap_specs::XapSecureStatus;

use crate::app::Backend;
use crate::components::keycode_picker::KeycodePicker;
use crate::components::Constants;
use crate::store::device::DeviceStore;
use crate::store::ui::UiState;
use crate::util::keycode_family::{keymap_key_family_class, mod_mask_for};

type EncoderKeymap = Vec<Vec<Vec<KeyCode>>>;

#[derive(Clone, Copy, PartialEq)]
struct EncoderSlot {
    encoder: u8,
    clockwise: u8,
}

#[derive(Clone, PartialEq)]
struct PendingAssignment {
    layer: usize,
    slot: EncoderSlot,
    template: KeycodeTemplate,
}

#[derive(Clone)]
struct Actions {
    backend: Backend,
    ui: UiState,
    device_store: DeviceStore,
    encoder_keymap: Signal<Option<EncoderKeymap>>,
    selected_slot: Signal<Option<EncoderSlot>>,
    pending: Signal<Option<PendingAssignment>>,
    layer_tab: Signal<usize>,
}

impl Actions {
    fn device_id(&self) -> Option<Uuid> {
        self.device_store.0.peek().selected
    }
    fn is_unlocked(&self) -> bool {
        matches!(
            self.device_store.0.peek().selected_state().map(|d| &d.secure_status),
            Some(XapSecureStatus::Unlocked)
        )
    }

    fn fetch_encoder_keymap(&self) {
        let Some(id) = self.device_id() else {
            let mut ek = self.encoder_keymap;
            ek.set(None);
            return;
        };
        let backend = self.backend.clone();
        let mut encoder_keymap = self.encoder_keymap;
        let mut ui = self.ui;
        spawn(async move {
            match backend.0.encoder_keymap_get(id).await {
                Ok(km) => encoder_keymap.set(if km.is_empty() { None } else { Some(km) }),
                Err(e) => {
                    ui.notify_error(e);
                    encoder_keymap.set(None);
                }
            }
        });
    }

    async fn write_slot(&self, layer: usize, slot: EncoderSlot, keycode: u16) -> bool {
        let Some(id) = self.device_id() else { return false };
        let arg = RemappingSetEncoderKeycodeArg {
            layer: layer as u8,
            encoder: slot.encoder,
            clockwise: slot.clockwise,
            keycode,
        };
        let mut ui = self.ui;
        if let Err(e) = self.backend.0.encoder_keycode_set(id, arg).await {
            ui.notify_error(e);
            return false;
        }
        // Read the slot back and update the local tensor (Vue refreshSlot).
        let get = KeymapGetEncoderKeycodeArg {
            layer: layer as u8,
            encoder: slot.encoder,
            clockwise: slot.clockwise,
        };
        let raw = match self.backend.0.encoder_keycode_get(id, get).await {
            Ok(c) => c,
            Err(e) => {
                ui.notify_error(e);
                return true;
            }
        };
        let decoded = match self.backend.0.decode_keycode(raw).await {
            Ok(c) => c,
            Err(e) => {
                ui.notify_error(e);
                return true;
            }
        };
        let mut encoder_keymap = self.encoder_keymap;
        if let Some(km) = encoder_keymap.write().as_mut() {
            if let Some(cell) = km
                .get_mut(layer)
                .and_then(|e| e.get_mut(slot.encoder as usize))
                .and_then(|p| p.get_mut(slot.clockwise as usize))
            {
                *cell = decoded;
            }
        }
        true
    }

    fn apply_template(&self, template: KeycodeTemplate, layer: usize, slot: EncoderSlot) {
        let mut ui = self.ui;
        if !self.is_unlocked() {
            ui.notify_device_locked();
            return;
        }
        let backend = self.backend.clone();
        let this = self.clone();
        let mut pending = self.pending;
        spawn(async move {
            let code = match backend.0.keycode_template_encode(template).await {
                Ok(c) => c,
                Err(e) => {
                    ui.notify_error(e);
                    return;
                }
            };
            if this.write_slot(layer, slot, code).await {
                pending.set(None);
            }
        });
    }

    fn on_picker_select(&self, code: u16) {
        let mut ui = self.ui;
        let Some(selected) = *self.selected_slot.peek() else {
            ui.notify_info("Select an encoder direction first");
            return;
        };
        if !self.is_unlocked() {
            ui.notify_device_locked();
            return;
        }
        let pending = self.pending.peek().clone();
        let layer = pending.as_ref().map(|p| p.layer).unwrap_or(*self.layer_tab.peek());
        let slot = pending.as_ref().map(|p| p.slot).unwrap_or(selected);
        if let Some(p) = pending {
            if code > 0xff {
                ui.notify_info("Pick a basic key (code <= 0xFF) to complete the tap slot");
                return;
            }
            let tap = (code & 0xff) as u8;
            let filled = match p.template {
                KeycodeTemplate::ModTap { mod_mask, .. } => {
                    KeycodeTemplate::ModTap { mod_mask, tap_kc: Some(tap) }
                }
                KeycodeTemplate::LayerTap { layer, .. } => {
                    KeycodeTemplate::LayerTap { layer, tap_kc: Some(tap) }
                }
                KeycodeTemplate::Modified { mod_mask, .. } => {
                    KeycodeTemplate::Modified { mod_mask, base_kc: Some(tap) }
                }
                _ => {
                    ui.notify_info("Pick a modifier from the panel to complete LM");
                    return;
                }
            };
            self.apply_template(filled, layer, slot);
            return;
        }
        let this = self.clone();
        spawn(async move {
            this.write_slot(layer, slot, code).await;
        });
    }

    fn on_start_template(&self, template: KeycodeTemplate, complete: bool) {
        let mut ui = self.ui;
        if self.device_id().is_none() {
            ui.notify_info("Connect a device first");
            return;
        }
        let Some(slot) = *self.selected_slot.peek() else {
            ui.notify_info("Select an encoder direction first");
            return;
        };
        if !self.is_unlocked() {
            ui.notify_device_locked();
            return;
        }
        let layer = *self.layer_tab.peek();
        if complete {
            self.apply_template(template, layer, slot);
            return;
        }
        let mut pending = self.pending;
        pending.set(Some(PendingAssignment { layer, slot, template }));
    }

    fn on_fill_layer_mod(&self, name: String) {
        let Some(mask) = mod_mask_for(&name) else { return };
        let Some(pending) = self.pending.peek().clone() else { return };
        let KeycodeTemplate::LayerMod { layer, .. } = pending.template else {
            return;
        };
        self.apply_template(
            KeycodeTemplate::LayerMod { layer, mod_mask: Some(mask) },
            pending.layer,
            pending.slot,
        );
    }

    fn cancel_pending(&self, reason: Option<String>) {
        if self.pending.peek().is_none() {
            return;
        }
        let mut pending = self.pending;
        let mut ui = self.ui;
        pending.set(None);
        ui.notify_info(format!(
            "Setup cancelled: {}",
            reason.unwrap_or_else(|| "user cancelled".to_string())
        ));
    }

    fn select_slot(&self, slot: EncoderSlot) {
        if let Some(p) = self.pending.peek().clone() {
            if p.layer != *self.layer_tab.peek() || p.slot != slot {
                self.cancel_pending(Some("selected a different slot".to_string()));
            }
        }
        let mut selected_slot = self.selected_slot;
        selected_slot.set(Some(slot));
    }

    fn start_tap_slot_edit(&self, layer: usize, slot: EncoderSlot) {
        let mut ui = self.ui;
        if !self.is_unlocked() {
            ui.notify_device_locked();
            return;
        }
        let code = self
            .encoder_keymap
            .peek()
            .as_ref()
            .and_then(|km| {
                km.get(layer)
                    .and_then(|e| e.get(slot.encoder as usize))
                    .and_then(|p| p.get(slot.clockwise as usize))
                    .cloned()
            });
        let Some(template) = code.and_then(|c| c.template) else { return };
        let incomplete = match template {
            KeycodeTemplate::ModTap { mod_mask, .. } => {
                KeycodeTemplate::ModTap { mod_mask, tap_kc: None }
            }
            KeycodeTemplate::LayerTap { layer, .. } => {
                KeycodeTemplate::LayerTap { layer, tap_kc: None }
            }
            KeycodeTemplate::LayerMod { layer, .. } => {
                KeycodeTemplate::LayerMod { layer, mod_mask: None }
            }
            _ => return,
        };
        let mut selected_slot = self.selected_slot;
        let mut pending = self.pending;
        selected_slot.set(Some(slot));
        pending.set(Some(PendingAssignment { layer, slot, template: incomplete }));
    }
}

fn slot_label(code: &KeyCode) -> String {
    code.label
        .clone()
        .or_else(|| Some(code.key.clone()))
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "unknown".to_string())
}

#[component]
pub fn EncoderMapPage() -> Element {
    let device_store = use_context::<DeviceStore>();
    let backend = use_context::<Backend>();
    let ui = use_context::<UiState>();

    let layer_tab = use_signal(|| 0usize);
    let xap_constants = use_signal(|| None::<Constants>);
    let encoder_keymap = use_signal(|| None::<EncoderKeymap>);
    let selected_slot = use_signal(|| None::<EncoderSlot>);
    let pending = use_signal(|| None::<PendingAssignment>);

    let actions = Actions {
        backend: backend.clone(),
        ui,
        device_store,
        encoder_keymap,
        selected_slot,
        pending,
        layer_tab,
    };

    use_hook(move || {
        let backend = backend.clone();
        let mut xap_constants = xap_constants;
        spawn(async move {
            match backend.0.xap_constants_get().await {
                Ok(c) => xap_constants.set(Some(Constants(Rc::new(c)))),
                Err(e) => log::error!("xap_constants_get failed: {e}"),
            }
        });
    });

    let selected_id = use_memo(move || device_store.0.read().selected);
    {
        let actions = actions.clone();
        use_effect(move || {
            let _ = selected_id();
            let mut selected_slot = selected_slot;
            let mut pending = pending;
            let mut layer_tab = layer_tab;
            selected_slot.set(None);
            pending.set(None);
            layer_tab.set(0);
            actions.fetch_encoder_keymap();
        });
    }

    let device = device_store.0.read().selected_state().cloned();
    let encoder_count = device.as_ref().map(|d| d.config.encoder_count).unwrap_or(0);
    let layer_count = device
        .as_ref()
        .and_then(|d| d.info.as_ref())
        .map(|i| {
            i.keymap
                .as_ref()
                .and_then(|k| k.layer_count)
                .or_else(|| i.remap.as_ref().and_then(|r| r.layer_count))
                .unwrap_or(0)
        })
        .unwrap_or(0);
    let picker_disabled = device
        .as_ref()
        .map(|d| {
            !matches!(d.secure_status, XapSecureStatus::Unlocked)
                || d.info
                    .as_ref()
                    .and_then(|i| i.remap.as_ref())
                    .map(|r| !r.set_encoder_keycode_enabled)
                    .unwrap_or(false)
        })
        .unwrap_or(true);

    let km = encoder_keymap.read();
    let layers_len = km.as_ref().map(|k| k.len()).unwrap_or(0);
    let current_layer = *layer_tab.read();
    let pending_template = pending.read().as_ref().map(|p| p.template.clone());

    let onkeydown = {
        let actions = actions.clone();
        move |e: KeyboardEvent| {
            if e.key() == Key::Escape && pending.peek().is_some() {
                actions.cancel_pending(Some("Esc pressed".to_string()));
            }
        }
    };

    rsx! {
        div {
            class: "encoder-page",
            tabindex: 0,
            onkeydown,

            div { class: "layer-tabs",
                span { class: "layer-tabs-label", "Layer" }
                for i in 0..layers_len {
                    button {
                        key: "{i}",
                        class: if i == current_layer { "layer-tab layer-tab-active" } else { "layer-tab" },
                        onclick: move |_| {
                            let mut layer_tab = layer_tab;
                            layer_tab.set(i);
                        },
                        "{i}"
                    }
                }
            }

            if let Some(km) = km.as_ref() {
                if let Some(layer) = km.get(current_layer) {
                    div { class: "encoder-card-grid",
                        for (enc_idx, pair) in layer.iter().enumerate() {
                            div { key: "{enc_idx}", class: "encoder-card",
                                div { class: "encoder-card-header", "Encoder {enc_idx}" }
                                for (cw_idx, code) in pair.iter().enumerate() {
                                    {
                                        let slot = EncoderSlot { encoder: enc_idx as u8, clockwise: cw_idx as u8 };
                                        let selected = *selected_slot.read() == Some(slot);
                                        let is_pending = pending
                                            .read()
                                            .as_ref()
                                            .map(|p| p.layer == current_layer && p.slot == slot)
                                            .unwrap_or(false);
                                        let sel_cls = if selected { "border-amber-500 ring-amber-300" } else { "border-black ring-neutral-300" };
                                        let pending_cls = if is_pending { "pending-key" } else { "" };
                                        let fam_cls = keymap_key_family_class(code);
                                        let arrow = if cw_idx == 0 { "↺" } else { "↻" };
                                        let label = slot_label(code);
                                        let title = if code.key.is_empty() {
                                            String::new()
                                        } else {
                                            match &code.description {
                                                Some(d) if !d.is_empty() => format!("{}\n{}", code.key, d),
                                                _ => code.key.clone(),
                                            }
                                        };
                                        let actions_sel = actions.clone();
                                        let actions_edit = actions.clone();
                                        rsx! {
                                            button {
                                                key: "{cw_idx}",
                                                class: "encoder-slot key-name-button rounded-lg p-2 text-black border-2 ring-4 ring-inset shadow-md {fam_cls} {sel_cls} {pending_cls}",
                                                title: "{title}",
                                                onclick: move |_| actions_sel.select_slot(slot),
                                                ondoubleclick: move |_| actions_edit.start_tap_slot_edit(current_layer, slot),
                                                span { class: "slot-direction", "{arrow}" }
                                                span { class: "slot-label", "{label}" }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            if encoder_count == 0 {
                div { class: "empty-hint", "This keyboard reports no encoders in its config blob." }
            }

            KeycodePicker {
                constants: xap_constants.read().clone(),
                layer_count: layer_count,
                pending_template,
                disabled: picker_disabled,
                onselect: {
                    let actions = actions.clone();
                    move |code: u16| actions.on_picker_select(code)
                },
                onstart_template: {
                    let actions = actions.clone();
                    move |(t, complete): (KeycodeTemplate, bool)| actions.on_start_template(t, complete)
                },
                onfill_layer_mod: {
                    let actions = actions.clone();
                    move |name: String| actions.on_fill_layer_mod(name)
                },
                oncancel: {
                    let actions = actions.clone();
                    move |reason: Option<String>| actions.cancel_pending(reason)
                },
            }
        }
    }
}
