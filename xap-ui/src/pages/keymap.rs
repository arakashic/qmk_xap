//! KeymapView port: per-layer key grid with selection, split tap/hold faces,
//! the parameterised-template remap state machine, and the keycode picker.
//!
//! The desktop window auto-resize (`windowFit` / display-fit / ResizeObserver
//! in KeymapView.vue) is intentionally NOT ported — it's a desktop ergonomic
//! that was never ported to the prior stack either; the keymap renders and
//! remaps correctly without it.

use std::rc::Rc;

use dioxus::prelude::*;
use uuid::Uuid;
use xap_core::aggregation::config::LayoutEntry;
use xap_core::aggregation::keymap::MappedKeymap;
use xap_core::aggregation::Point3D;
use xap_core::{XapDeviceState};
use xap_specs::constants::keycode::KeyCode;
use xap_specs::constants::keycode_encoder::KeycodeTemplate;
use xap_specs::spec::remapping::RemappingSetKeycodeArg;
use xap_specs::XapSecureStatus;

use crate::app::Backend;
use crate::components::keycode_picker::KeycodePicker;
use crate::components::key_label::KeyLabel;
use crate::components::Constants;
use crate::store::device::DeviceStore;
use crate::store::ui::UiState;
use crate::util::keycode_family::{keymap_key_family_class, mod_mask_for};

const KEY_UNIT_REM: f64 = 4.5;
const KEY_GAP_REM: f64 = 0.5;
const KEY_MARGIN_REM: f64 = KEY_GAP_REM / 2.0;

#[derive(Clone, PartialEq)]
struct PendingAssignment {
    position: Point3D,
    template: KeycodeTemplate,
}

fn points_equal(a: &Point3D, b: &Point3D) -> bool {
    a.x == b.x && a.y == b.y && a.z == b.z
}

struct Bounds {
    min_x: f64,
    min_y: f64,
    width: f64,
    height: f64,
}

fn keymap_bounds(keymap: &MappedKeymap) -> Bounds {
    let (mut min_x, mut min_y) = (f64::INFINITY, f64::INFINITY);
    let (mut max_x, mut max_y) = (f64::NEG_INFINITY, f64::NEG_INFINITY);
    for layer in &keymap.keys {
        for row in layer {
            for col in row.iter().flatten() {
                let l = &col.layout;
                min_x = min_x.min(l.x);
                min_y = min_y.min(l.y);
                max_x = max_x.max(l.x + l.w);
                max_y = max_y.max(l.y + l.h);
            }
        }
    }
    if !min_x.is_finite() || !min_y.is_finite() {
        return Bounds { min_x: 0.0, min_y: 0.0, width: 1.0, height: 1.0 };
    }
    Bounds {
        min_x,
        min_y,
        width: (max_x - min_x).max(1.0),
        height: (max_y - min_y).max(1.0),
    }
}

fn layout_style(layout: &LayoutEntry, bounds: &Bounds) -> String {
    format!(
        "position:absolute;top:{}rem;left:{}rem;width:{}rem;height:{}rem;margin:{}rem;",
        (layout.y - bounds.min_y) * KEY_UNIT_REM,
        (layout.x - bounds.min_x) * KEY_UNIT_REM,
        layout.w * KEY_UNIT_REM - KEY_GAP_REM,
        layout.h * KEY_UNIT_REM - KEY_GAP_REM,
        KEY_MARGIN_REM,
    )
}

/// Shared action surface; cloned into each event handler.
#[derive(Clone)]
struct Actions {
    backend: Backend,
    ui: UiState,
    device_store: DeviceStore,
    keymap: Signal<Option<MappedKeymap>>,
    pending: Signal<Option<PendingAssignment>>,
    selected_key: Signal<Option<Point3D>>,
    selected_layout: Signal<Option<String>>,
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

    fn update_keymap(&self) {
        let (Some(id), Some(layout)) = (self.device_id(), self.selected_layout.peek().clone())
        else {
            return;
        };
        let backend = self.backend.clone();
        let mut keymap = self.keymap;
        let mut ui = self.ui;
        spawn(async move {
            match backend.0.keymap_get(id, layout).await {
                Ok(km) => keymap.set(Some(km)),
                Err(e) => ui.notify_error(e),
            }
        });
    }

    fn apply_template(&self, template: KeycodeTemplate, position: Point3D) {
        let mut ui = self.ui;
        if !self.is_unlocked() {
            ui.notify_device_locked();
            return;
        }
        let Some(id) = self.device_id() else { return };
        let backend = self.backend.clone();
        let mut pending = self.pending;
        let this = self.clone();
        spawn(async move {
            let code = match backend.0.keycode_template_encode(template).await {
                Ok(c) => c,
                Err(e) => {
                    ui.notify_error(e);
                    return;
                }
            };
            let arg = RemappingSetKeycodeArg {
                layer: position.z as u8,
                row: position.y as u8,
                column: position.x as u8,
                keycode: code,
            };
            if let Err(e) = backend.0.remap_key(id, arg).await {
                ui.notify_error(e);
                return;
            }
            pending.set(None);
            this.update_keymap();
        });
    }

    fn remap_key(&self, code: u16) {
        let mut ui = self.ui;
        let (Some(id), Some(_layout), Some(pos)) = (
            self.device_id(),
            self.selected_layout.peek().clone(),
            *self.selected_key.peek(),
        ) else {
            return;
        };
        if !self.is_unlocked() {
            ui.notify_device_locked();
            return;
        }
        if let Some(pending) = self.pending.peek().clone() {
            // Second step of a parameterised template.
            if code > 0xff {
                ui.notify_info("Pick a basic key (code <= 0xFF) to complete the tap slot");
                return;
            }
            let tap = (code & 0xff) as u8;
            let filled = match pending.template {
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
            self.apply_template(filled, pending.position);
            return;
        }
        // Direct remap.
        let backend = self.backend.clone();
        let this = self.clone();
        let arg = RemappingSetKeycodeArg {
            layer: pos.z as u8,
            row: pos.y as u8,
            column: pos.x as u8,
            keycode: code,
        };
        spawn(async move {
            if let Err(e) = backend.0.remap_key(id, arg).await {
                ui.notify_error(e);
                return;
            }
            this.update_keymap();
        });
    }

    fn start_template(&self, template: KeycodeTemplate, complete: bool) {
        let mut ui = self.ui;
        if self.device_id().is_none() {
            ui.notify_info("Connect a device first");
            return;
        }
        let Some(pos) = *self.selected_key.peek() else {
            ui.notify_info("Select a key on the layer first");
            return;
        };
        if !self.is_unlocked() {
            ui.notify_device_locked();
            return;
        }
        if complete {
            self.apply_template(template, pos);
            return;
        }
        let mut pending = self.pending;
        pending.set(Some(PendingAssignment { position: pos, template }));
    }

    fn fill_layer_mod(&self, name: String) {
        let Some(mask) = mod_mask_for(&name) else { return };
        let Some(pending) = self.pending.peek().clone() else { return };
        let KeycodeTemplate::LayerMod { layer, .. } = pending.template else {
            return;
        };
        self.apply_template(
            KeycodeTemplate::LayerMod { layer, mod_mask: Some(mask) },
            pending.position,
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

    fn select_bottom_half(&self, position: Point3D, code: KeyCode) {
        let mut ui = self.ui;
        if !self.is_unlocked() {
            ui.notify_device_locked();
            return;
        }
        let Some(t) = code.template else { return };
        let incomplete = match t {
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
        let mut selected_key = self.selected_key;
        let mut pending = self.pending;
        selected_key.set(Some(position));
        pending.set(Some(PendingAssignment { position, template: incomplete }));
    }

    fn select_position(&self, position: Point3D) {
        if let Some(p) = self.pending.peek().clone() {
            if !points_equal(&p.position, &position) {
                self.cancel_pending(Some("selected a different key".to_string()));
            }
        }
        let mut selected_key = self.selected_key;
        selected_key.set(Some(position));
    }
}

#[component]
pub fn KeymapPage() -> Element {
    let device_store = use_context::<DeviceStore>();
    let backend = use_context::<Backend>();
    let ui = use_context::<UiState>();

    let selected_layout = use_signal(|| None::<String>);
    let selected_key = use_signal(|| None::<Point3D>);
    let layer_tab = use_signal(|| 0u64);
    let keymap = use_signal(|| None::<MappedKeymap>);
    let pending = use_signal(|| None::<PendingAssignment>);
    let xap_constants = use_signal(|| None::<Constants>);

    let actions = Actions {
        backend: backend.clone(),
        ui,
        device_store,
        keymap,
        pending,
        selected_key,
        selected_layout,
    };

    // Fetch the keycode catalog once.
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

    // React to a device change: reset selection, pick the first layout, refetch.
    let selected_id = use_memo(move || device_store.0.read().selected);
    {
        let actions = actions.clone();
        use_effect(move || {
            let _ = selected_id(); // dependency: re-run only when the device id changes
            let mut selected_key = selected_key;
            let mut pending = pending;
            let mut layer_tab = layer_tab;
            let mut selected_layout = selected_layout;
            selected_key.set(None);
            pending.set(None);
            layer_tab.set(0);
            let layouts: Vec<String> = device_store
                .0
                .peek()
                .selected_state()
                .map(|d| d.config.layouts.keys().cloned().collect())
                .unwrap_or_default();
            selected_layout.set(layouts.first().cloned());
            actions.update_keymap();
        });
    }

    let data = device_store.0.read();
    let device: Option<XapDeviceState> = data.selected_state().cloned();
    drop(data);

    let layouts: Vec<(String, String)> = device
        .as_ref()
        .map(|d| {
            let mut ls: Vec<String> = d.config.layouts.keys().cloned().collect();
            ls.sort();
            ls.into_iter().map(|l| (l.clone(), l)).collect()
        })
        .unwrap_or_default();

    let km = keymap.read();
    let layer_count = km.as_ref().map(|k| k.keys.len()).unwrap_or(0);
    let picker_disabled = device
        .as_ref()
        .map(|d| {
            !matches!(d.secure_status, XapSecureStatus::Unlocked)
                || d.info
                    .as_ref()
                    .and_then(|i| i.remap.as_ref())
                    .map(|r| !r.set_keycode_enabled)
                    .unwrap_or(false)
        })
        .unwrap_or(true);
    let pending_template = pending.read().as_ref().map(|p| p.template.clone());
    let current_layer = *layer_tab.read();

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
            class: "keymap-page",
            tabindex: 0,
            onkeydown,

            // Toolbar: layout select + layer tabs
            div { class: "keymap-toolbar",
                div { class: "layout-select",
                    crate::components::primitives::Select {
                        label: "Layout",
                        value: selected_layout.read().clone(),
                        options: layouts,
                        disabled: device.is_none(),
                        onselect: {
                            let actions = actions.clone();
                            move |val: String| {
                                let mut selected_layout = selected_layout;
                                selected_layout.set(Some(val));
                                actions.update_keymap();
                            }
                        },
                    }
                }
                div { class: "layer-tabs",
                    span { class: "layer-tabs-label", "Layer" }
                    for i in 0..layer_count as u64 {
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
            }

            // Keymap canvas for the active layer
            if let Some(km) = km.as_ref() {
                {
                    let bounds = keymap_bounds(km);
                    let canvas_style = format!(
                        "width:{}rem;height:{}rem;",
                        bounds.width * KEY_UNIT_REM,
                        bounds.height * KEY_UNIT_REM
                    );
                    let layer = km.keys.get(current_layer as usize);
                    rsx! {
                        div { class: "keymap-panels",
                            div { class: "keymap-tab-panel",
                                div { class: "keymap-stage",
                                    div { class: "keymap-canvas relative", style: "{canvas_style}",
                                        if let Some(layer) = layer {
                                            for row in layer.iter() {
                                                for col in row.iter().flatten() {
                                                    {
                                                        let code = col.key.code.clone();
                                                        let position = col.key.position;
                                                        let style = layout_style(&col.layout, &bounds);
                                                        let is_split = code.top.is_some() && code.bottom.is_some();
                                                        let selected = selected_key
                                                            .read()
                                                            .as_ref()
                                                            .map(|s| points_equal(s, &position))
                                                            .unwrap_or(false);
                                                        let is_pending = pending
                                                            .read()
                                                            .as_ref()
                                                            .map(|p| points_equal(&p.position, &position))
                                                            .unwrap_or(false);
                                                        let sel_cls = if selected { "border-amber-500 ring-amber-300" } else { "border-black ring-neutral-300" };
                                                        let split_cls = if is_split { "split-key" } else { "" };
                                                        let fam_cls = keymap_key_family_class(&code);
                                                        let pending_cls = if is_pending { "pending-key" } else { "" };
                                                        let title = if code.key.is_empty() {
                                                            String::new()
                                                        } else {
                                                            match &code.description {
                                                                Some(d) if !d.is_empty() => format!("{}\n{}", code.key, d),
                                                                _ => code.key.clone(),
                                                            }
                                                        };
                                                        let key_id = format!("{}-{}-{}", position.x, position.y, position.z);
                                                        let actions_click = actions.clone();
                                                        let click_pos = position;
                                                        let actions_bottom = actions.clone();
                                                        let bottom_pos = position;
                                                        let bottom_code = code.clone();
                                                        rsx! {
                                                            button {
                                                                key: "{key_id}",
                                                                class: "key-button key-name-button rounded-lg p-2 absolute align-middle text-black border-2 ring-4 ring-inset shadow-md {sel_cls} {split_cls} {fam_cls} {pending_cls}",
                                                                style: "{style}",
                                                                title: "{title}",
                                                                onclick: move |_| actions_click.select_position(click_pos),
                                                                if is_split {
                                                                    KeyLabel { class: "split-top", label: code.top.clone().unwrap_or_default() }
                                                                    span { class: "split-divider" }
                                                                    span {
                                                                        class: "split-bottom split-bottom-clickable",
                                                                        onclick: move |e| {
                                                                            e.stop_propagation();
                                                                            actions_bottom.select_bottom_half(bottom_pos, bottom_code.clone());
                                                                        },
                                                                        KeyLabel { label: code.bottom.clone().unwrap_or_default() }
                                                                    }
                                                                } else {
                                                                    KeyLabel {
                                                                        label: code.label.clone().or_else(|| Some(code.key.clone())).filter(|s| !s.is_empty()).unwrap_or_else(|| "unknown".to_string())
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Keycode picker
            KeycodePicker {
                constants: xap_constants.read().clone(),
                layer_count: layer_count as u8,
                pending_template,
                disabled: picker_disabled,
                onselect: {
                    let actions = actions.clone();
                    move |code: u16| actions.remap_key(code)
                },
                onstart_template: {
                    let actions = actions.clone();
                    move |(t, complete): (KeycodeTemplate, bool)| actions.start_template(t, complete)
                },
                onfill_layer_mod: {
                    let actions = actions.clone();
                    move |name: String| actions.fill_layer_mod(name)
                },
                oncancel: {
                    let actions = actions.clone();
                    move |reason: Option<String>| actions.cancel_pending(reason)
                },
            }
        }
    }
}
