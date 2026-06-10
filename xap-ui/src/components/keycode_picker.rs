//! KeycodePicker: tabbed catalog of keycodes + parameterised templates (layer
//! ops, mod-tap, layer-mod, etc). Emits raw codes or partially-filled templates
//! that the owning page completes. Port of KeycodePicker.vue.

use dioxus::prelude::*;

use xap_specs::constants::keycode_display::SubgroupTemplate;
use xap_specs::constants::keycode_encoder::{KeycodeTemplate, LayerOp};

use crate::components::key_label::KeyLabel;
use crate::components::keyboard_layout::BasicKeyboardLayout;
use crate::components::Constants;
use crate::components::primitives::Btn;
use crate::util::keycode_family::{
    mod_mask_for, mod_name, tab_family_class, template_family_class,
};

const PICKER_KEY_SIZE_REM: f32 = 3.5;

/// Curated mod options for the LM step-2 mini picker.
const LM_MOD_OPTIONS: &[&str] = &[
    "LCTL", "LSFT", "LALT", "LGUI", "RCTL", "RSFT", "RALT", "RGUI", "LCA", "LCAG", "MEH", "HYPR",
];

struct TemplateButton {
    label: String,
    title: String,
    template: KeycodeTemplate,
    complete: bool,
}

fn layer_op_name(op: LayerOp) -> &'static str {
    match op {
        LayerOp::MO => "MO",
        LayerOp::TG => "TG",
        LayerOp::TO => "TO",
        LayerOp::DF => "DF",
        LayerOp::OSL => "OSL",
        LayerOp::TT => "TT",
        LayerOp::PDF => "PDF",
    }
}

fn template_label(t: &KeycodeTemplate) -> String {
    match t {
        KeycodeTemplate::LayerOp { op, layer } => format!("{}({layer})", layer_op_name(*op)),
        KeycodeTemplate::OneShotMod { mod_mask } => format!("OSM({})", mod_name(*mod_mask)),
        KeycodeTemplate::LayerTap { layer, tap_kc } => {
            if tap_kc.is_none() {
                format!("LT({layer})")
            } else {
                format!("LT({layer}, ?)")
            }
        }
        KeycodeTemplate::ModTap { mod_mask, .. } => format!("{}_T", mod_name(*mod_mask)),
        KeycodeTemplate::LayerMod { layer, mod_mask } => {
            if mod_mask.is_none() {
                format!("LM({layer})")
            } else {
                format!("LM({layer}, ?)")
            }
        }
        KeycodeTemplate::Modified { mod_mask, .. } => mod_name(*mod_mask),
    }
}

fn slot_prompt(t: &KeycodeTemplate) -> &'static str {
    match t {
        KeycodeTemplate::ModTap { .. }
        | KeycodeTemplate::LayerTap { .. }
        | KeycodeTemplate::Modified { .. } => "pick a basic key to complete",
        KeycodeTemplate::LayerMod { .. } => "pick a modifier to complete",
        _ => "",
    }
}

fn expand_template(sub: &SubgroupTemplate, layer_count: u8) -> Vec<TemplateButton> {
    let layer_op = |op: LayerOp, desc: &str| -> Vec<TemplateButton> {
        let name = layer_op_name(op);
        (0..layer_count)
            .map(|i| TemplateButton {
                label: format!("{name}({i})"),
                title: format!("{name}({i}) - {desc}"),
                template: KeycodeTemplate::LayerOp { op, layer: i },
                complete: true,
            })
            .collect()
    };
    match sub {
        SubgroupTemplate::Mo => layer_op(LayerOp::MO, "momentarily activate layer while held"),
        SubgroupTemplate::Tg => layer_op(LayerOp::TG, "toggle layer on press"),
        SubgroupTemplate::To => {
            layer_op(LayerOp::TO, "switch to layer (turn off others above default)")
        }
        SubgroupTemplate::Df => layer_op(LayerOp::DF, "set the default base layer"),
        SubgroupTemplate::Osl => {
            layer_op(LayerOp::OSL, "activate layer until the next key is tapped")
        }
        SubgroupTemplate::Tt => layer_op(
            LayerOp::TT,
            "tap-toggle layer (hold = momentary, tap repeatedly = toggle)",
        ),
        SubgroupTemplate::Pdf => layer_op(LayerOp::PDF, "persist new default layer to EEPROM"),
        SubgroupTemplate::Lt => (0..layer_count)
            .map(|i| TemplateButton {
                label: format!("LT({i})"),
                title: format!("LT({i}, kc): hold for layer {i}, tap to send kc - pick a basic key next"),
                template: KeycodeTemplate::LayerTap { layer: i, tap_kc: None },
                complete: false,
            })
            .collect(),
        SubgroupTemplate::Lm => (0..layer_count)
            .map(|i| TemplateButton {
                label: format!("LM({i})"),
                title: format!("LM({i}, mod): activate layer {i} while holding mod - pick a modifier next"),
                template: KeycodeTemplate::LayerMod { layer: i, mod_mask: None },
                complete: false,
            })
            .collect(),
        SubgroupTemplate::Mt { mods } => mods
            .iter()
            .filter_map(|name| {
                mod_mask_for(name).map(|mask| TemplateButton {
                    label: format!("{name}_T"),
                    title: format!("{name}_T(kc): hold for {name}, tap to send kc - pick a basic key next"),
                    template: KeycodeTemplate::ModTap { mod_mask: mask, tap_kc: None },
                    complete: false,
                })
            })
            .collect(),
        SubgroupTemplate::QkMods { mods } => mods
            .iter()
            .filter_map(|name| {
                mod_mask_for(name).map(|mask| TemplateButton {
                    label: name.clone(),
                    title: format!("{name}(kc): press kc while holding {name} - pick a basic key next"),
                    template: KeycodeTemplate::Modified { mod_mask: mask, base_kc: None },
                    complete: false,
                })
            })
            .collect(),
    }
}

#[component]
pub fn KeycodePicker(
    constants: Option<Constants>,
    layer_count: u8,
    pending_template: Option<KeycodeTemplate>,
    #[props(default)] disabled: bool,
    onselect: EventHandler<u16>,
    onstart_template: EventHandler<(KeycodeTemplate, bool)>,
    onfill_layer_mod: EventHandler<String>,
    oncancel: EventHandler<Option<String>>,
) -> Element {
    let constants_rc = constants.as_ref().map(|c| c.0.clone());

    // The user's tab choice; empty until they click. The active tab is resolved
    // per-render against the (async-loaded) tab list so it can't get stuck on a
    // value picked before the catalog arrived.
    let selected_tab = use_signal(String::new);
    let active_tab = constants_rc
        .as_ref()
        .map(|c| {
            let tabs = &c.keycode_view.tabs;
            let sel = selected_tab.read().clone();
            if tabs.iter().any(|t| t.id == sel) {
                sel
            } else if tabs.iter().any(|t| t.id == "basic") {
                "basic".to_string()
            } else {
                tabs.first().map(|t| t.id.clone()).unwrap_or_default()
            }
        })
        .unwrap_or_default();

    let pending_is_layer_mod = matches!(pending_template, Some(KeycodeTemplate::LayerMod { .. }));

    rsx! {
        // Pending banner
        if let Some(pending) = pending_template.as_ref() {
            div {
                class: "pending-banner {template_family_class(pending)}",
                span { class: "material-icons", style: "font-size:18px;margin-right:8px;", "adjust" }
                span {
                    "Setting up "
                    b { "{template_label(pending)}" }
                    " - {slot_prompt(pending)} (Esc or click another key to cancel)"
                }
                span { style: "flex:1 1 auto;" }
                Btn {
                    flat: true,
                    label: "Cancel",
                    onclick: move |_| oncancel.call(Some("user cancelled".to_string())),
                }
            }
        }

        div {
            class: "keycode-area",
            style: "--picker-key-size:{PICKER_KEY_SIZE_REM}rem;--picker-key-gap:0.5rem;",

            if pending_is_layer_mod {
                // Layer-Mod mini picker
                div { class: "mod-mini-picker",
                    div { class: "text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide",
                        "Pick a modifier"
                    }
                    div { class: "keycode-grid",
                        for m in LM_MOD_OPTIONS.iter() {
                            button {
                                key: "{m}",
                                class: "keycode-button key-name-button rounded-lg p-2 text-black border-2 ring-4 ring-inset shadow-md border-black ring-neutral-300 family-layermod",
                                onclick: {
                                    let m = m.to_string();
                                    move |_| {
                                        if !disabled {
                                            onfill_layer_mod.call(m.clone());
                                        }
                                    }
                                },
                                KeyLabel { class: "picker-key-label", label: "{m}" }
                            }
                        }
                    }
                }
            } else if let Some(c) = constants_rc.as_ref() {
                // Tabs
                div { class: "keycode-tabs",
                    for tab in c.keycode_view.tabs.iter() {
                        {
                            let id = tab.id.clone();
                            let active = active_tab == id;
                            let fallback = if tab.is_fallback { "fallback-tab" } else { "" };
                            let active_cls = if active { "keycode-tab-active" } else { "" };
                            rsx! {
                                button {
                                    key: "{tab.id}",
                                    class: "keycode-tab {fallback} {active_cls} {tab_family_class(tab.color.as_deref())}",
                                    onclick: move |_| {
                                        let mut selected_tab = selected_tab;
                                        selected_tab.set(id.clone());
                                    },
                                    span { "{tab.label}" }
                                    if tab.is_fallback {
                                        span { class: "fallback-marker", "(unmapped)" }
                                    }
                                }
                            }
                        }
                    }
                }
                // Active tab panel
                div { class: "keycode-tab-panel",
                    for tab in c.keycode_view.tabs.iter().filter(|t| t.id == active_tab) {
                        for sub in tab.subgroups.iter().filter(|s| !s.codes.is_empty() || s.template.is_some()) {
                            div {
                                key: "{sub.id}",
                                class: if sub.is_fallback { "subgroup w-full fallback-subgroup" } else { "subgroup w-full" },
                                if sub.label.is_some() || tab.subgroups.len() > 1 || sub.is_fallback {
                                    div { class: "text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide",
                                        "{sub.label.clone().unwrap_or_else(|| sub.id.clone())}"
                                        if sub.is_fallback {
                                            span { class: "fallback-marker", " (unmapped)" }
                                        }
                                    }
                                }

                                if sub.render_mode.as_deref() == Some("ansi") {
                                    BasicKeyboardLayout {
                                        codes: sub.codes.clone(),
                                        key_size_rem: PICKER_KEY_SIZE_REM,
                                        onselect: move |code| { if !disabled { onselect.call(code); } },
                                    }
                                } else if let Some(template) = sub.template.as_ref() {
                                    {
                                        let buttons = expand_template(template, layer_count);
                                        let color_cls = tab_family_class(tab.color.as_deref());
                                        let empty = buttons.is_empty();
                                        let sub_name = sub.label.clone().unwrap_or_else(|| sub.id.clone());
                                        rsx! {
                                            div { class: "keycode-grid",
                                                for (idx, btn) in buttons.into_iter().enumerate() {
                                                    button {
                                                        key: "{sub.id}-{idx}",
                                                        class: "keycode-button key-name-button rounded-lg p-2 text-black border-2 ring-4 ring-inset shadow-md border-black ring-neutral-300 {color_cls}",
                                                        title: "{btn.label}\n{btn.title}",
                                                        onclick: {
                                                            let template = btn.template.clone();
                                                            let complete = btn.complete;
                                                            move |_| {
                                                                if !disabled {
                                                                    onstart_template.call((template.clone(), complete));
                                                                }
                                                            }
                                                        },
                                                        KeyLabel { class: "picker-key-label", label: btn.label.clone() }
                                                    }
                                                }
                                                if empty {
                                                    div { class: "text-xs text-gray-500",
                                                        "Connect a device with at least one layer to see {sub_name} options."
                                                    }
                                                }
                                            }
                                        }
                                    }
                                } else {
                                    div { class: "keycode-grid",
                                        for code in sub.codes.iter() {
                                            {
                                                let value = code.code;
                                                let label = code.label.clone().unwrap_or_else(|| code.key.clone());
                                                let title = match &code.description {
                                                    Some(d) if !d.is_empty() => format!("{}\n{}", code.key, d),
                                                    _ => code.key.clone(),
                                                };
                                                rsx! {
                                                    button {
                                                        key: "{code.code}",
                                                        class: "keycode-button key-name-button rounded-lg p-2 text-black border-2 ring-4 ring-inset shadow-md border-black ring-neutral-300",
                                                        title: "{title}",
                                                        onclick: move |_| { if !disabled { onselect.call(value); } },
                                                        KeyLabel { class: "picker-key-label", label }
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
