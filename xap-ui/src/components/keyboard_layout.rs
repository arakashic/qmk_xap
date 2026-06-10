//! BasicKeyboardLayout: a hardcoded 104-key ANSI layout placing each available
//! KeyCode at its physical position with gap-compressed clusters. Port of
//! BasicKeyboardLayout.vue.

use std::collections::HashMap;

use dioxus::prelude::*;
use xap_specs::constants::keycode::KeyCode;

use crate::components::key_label::KeyLabel;

const KEY_GAP_REM: f32 = 0.25;
const COMPACT_GROUP_GAP_UNITS: f32 = 0.25;
const RIGHT_REGION_START_X: f32 = 15.5;
const NUMPAD_START_X: f32 = 19.0;
const ANSI_WIDTH_UNITS: f32 = 22.5;
const ANSI_HEIGHT_UNITS: f32 = 6.25;

struct KeyPos {
    key: &'static str,
    x: f32,
    y: f32,
    w: f32,
    h: f32,
}

const fn k(key: &'static str, x: f32, y: f32, w: f32, h: f32) -> KeyPos {
    KeyPos { key, x, y, w, h }
}

#[rustfmt::skip]
const ANSI_LAYOUT: &[KeyPos] = &[
    // Function row (y=0)
    k("KC_ESCAPE", 0.0, 0.0, 1.0, 1.0),
    k("KC_F1", 2.0, 0.0, 1.0, 1.0),
    k("KC_F2", 3.0, 0.0, 1.0, 1.0),
    k("KC_F3", 4.0, 0.0, 1.0, 1.0),
    k("KC_F4", 5.0, 0.0, 1.0, 1.0),
    k("KC_F5", 6.5, 0.0, 1.0, 1.0),
    k("KC_F6", 7.5, 0.0, 1.0, 1.0),
    k("KC_F7", 8.5, 0.0, 1.0, 1.0),
    k("KC_F8", 9.5, 0.0, 1.0, 1.0),
    k("KC_F9", 11.0, 0.0, 1.0, 1.0),
    k("KC_F10", 12.0, 0.0, 1.0, 1.0),
    k("KC_F11", 13.0, 0.0, 1.0, 1.0),
    k("KC_F12", 14.0, 0.0, 1.0, 1.0),
    k("KC_PRINT_SCREEN", 15.5, 0.0, 1.0, 1.0),
    k("KC_SCROLL_LOCK", 16.5, 0.0, 1.0, 1.0),
    k("KC_PAUSE", 17.5, 0.0, 1.0, 1.0),

    // Number row (y=1.5)
    k("KC_GRAVE", 0.0, 1.5, 1.0, 1.0),
    k("KC_1", 1.0, 1.5, 1.0, 1.0),
    k("KC_2", 2.0, 1.5, 1.0, 1.0),
    k("KC_3", 3.0, 1.5, 1.0, 1.0),
    k("KC_4", 4.0, 1.5, 1.0, 1.0),
    k("KC_5", 5.0, 1.5, 1.0, 1.0),
    k("KC_6", 6.0, 1.5, 1.0, 1.0),
    k("KC_7", 7.0, 1.5, 1.0, 1.0),
    k("KC_8", 8.0, 1.5, 1.0, 1.0),
    k("KC_9", 9.0, 1.5, 1.0, 1.0),
    k("KC_0", 10.0, 1.5, 1.0, 1.0),
    k("KC_MINUS", 11.0, 1.5, 1.0, 1.0),
    k("KC_EQUAL", 12.0, 1.5, 1.0, 1.0),
    k("KC_BACKSPACE", 13.0, 1.5, 2.0, 1.0),

    // QWERTY row (y=2.5)
    k("KC_TAB", 0.0, 2.5, 1.5, 1.0),
    k("KC_Q", 1.5, 2.5, 1.0, 1.0),
    k("KC_W", 2.5, 2.5, 1.0, 1.0),
    k("KC_E", 3.5, 2.5, 1.0, 1.0),
    k("KC_R", 4.5, 2.5, 1.0, 1.0),
    k("KC_T", 5.5, 2.5, 1.0, 1.0),
    k("KC_Y", 6.5, 2.5, 1.0, 1.0),
    k("KC_U", 7.5, 2.5, 1.0, 1.0),
    k("KC_I", 8.5, 2.5, 1.0, 1.0),
    k("KC_O", 9.5, 2.5, 1.0, 1.0),
    k("KC_P", 10.5, 2.5, 1.0, 1.0),
    k("KC_LEFT_BRACKET", 11.5, 2.5, 1.0, 1.0),
    k("KC_RIGHT_BRACKET", 12.5, 2.5, 1.0, 1.0),
    k("KC_BACKSLASH", 13.5, 2.5, 1.5, 1.0),

    // Caps row (y=3.5)
    k("KC_CAPS_LOCK", 0.0, 3.5, 1.75, 1.0),
    k("KC_A", 1.75, 3.5, 1.0, 1.0),
    k("KC_S", 2.75, 3.5, 1.0, 1.0),
    k("KC_D", 3.75, 3.5, 1.0, 1.0),
    k("KC_F", 4.75, 3.5, 1.0, 1.0),
    k("KC_G", 5.75, 3.5, 1.0, 1.0),
    k("KC_H", 6.75, 3.5, 1.0, 1.0),
    k("KC_J", 7.75, 3.5, 1.0, 1.0),
    k("KC_K", 8.75, 3.5, 1.0, 1.0),
    k("KC_L", 9.75, 3.5, 1.0, 1.0),
    k("KC_SEMICOLON", 10.75, 3.5, 1.0, 1.0),
    k("KC_QUOTE", 11.75, 3.5, 1.0, 1.0),
    k("KC_ENTER", 12.75, 3.5, 2.25, 1.0),

    // Shift row (y=4.5)
    k("KC_LEFT_SHIFT", 0.0, 4.5, 2.25, 1.0),
    k("KC_Z", 2.25, 4.5, 1.0, 1.0),
    k("KC_X", 3.25, 4.5, 1.0, 1.0),
    k("KC_C", 4.25, 4.5, 1.0, 1.0),
    k("KC_V", 5.25, 4.5, 1.0, 1.0),
    k("KC_B", 6.25, 4.5, 1.0, 1.0),
    k("KC_N", 7.25, 4.5, 1.0, 1.0),
    k("KC_M", 8.25, 4.5, 1.0, 1.0),
    k("KC_COMMA", 9.25, 4.5, 1.0, 1.0),
    k("KC_DOT", 10.25, 4.5, 1.0, 1.0),
    k("KC_SLASH", 11.25, 4.5, 1.0, 1.0),
    k("KC_RIGHT_SHIFT", 12.25, 4.5, 2.75, 1.0),

    // Bottom row (y=5.5)
    k("KC_LEFT_CTRL", 0.0, 5.5, 1.25, 1.0),
    k("KC_LEFT_GUI", 1.25, 5.5, 1.25, 1.0),
    k("KC_LEFT_ALT", 2.5, 5.5, 1.25, 1.0),
    k("KC_SPACE", 3.75, 5.5, 6.25, 1.0),
    k("KC_RIGHT_ALT", 10.0, 5.5, 1.25, 1.0),
    k("KC_RIGHT_GUI", 11.25, 5.5, 1.25, 1.0),
    k("KC_APPLICATION", 12.5, 5.5, 1.25, 1.0),
    k("KC_RIGHT_CTRL", 13.75, 5.5, 1.25, 1.0),

    // Edit cluster (x offset = 15.5)
    k("KC_INSERT", 15.5, 1.5, 1.0, 1.0),
    k("KC_HOME", 16.5, 1.5, 1.0, 1.0),
    k("KC_PAGE_UP", 17.5, 1.5, 1.0, 1.0),
    k("KC_DELETE", 15.5, 2.5, 1.0, 1.0),
    k("KC_END", 16.5, 2.5, 1.0, 1.0),
    k("KC_PAGE_DOWN", 17.5, 2.5, 1.0, 1.0),

    // Arrow keys
    k("KC_UP", 16.5, 4.5, 1.0, 1.0),
    k("KC_LEFT", 15.5, 5.5, 1.0, 1.0),
    k("KC_DOWN", 16.5, 5.5, 1.0, 1.0),
    k("KC_RIGHT", 17.5, 5.5, 1.0, 1.0),

    // Numpad (x offset = 19)
    k("KC_NUM_LOCK", 19.0, 1.5, 1.0, 1.0),
    k("KC_KP_SLASH", 20.0, 1.5, 1.0, 1.0),
    k("KC_KP_ASTERISK", 21.0, 1.5, 1.0, 1.0),
    k("KC_KP_MINUS", 22.0, 1.5, 1.0, 1.0),
    k("KC_KP_7", 19.0, 2.5, 1.0, 1.0),
    k("KC_KP_8", 20.0, 2.5, 1.0, 1.0),
    k("KC_KP_9", 21.0, 2.5, 1.0, 1.0),
    k("KC_KP_PLUS", 22.0, 2.5, 1.0, 2.0),
    k("KC_KP_4", 19.0, 3.5, 1.0, 1.0),
    k("KC_KP_5", 20.0, 3.5, 1.0, 1.0),
    k("KC_KP_6", 21.0, 3.5, 1.0, 1.0),
    k("KC_KP_1", 19.0, 4.5, 1.0, 1.0),
    k("KC_KP_2", 20.0, 4.5, 1.0, 1.0),
    k("KC_KP_3", 21.0, 4.5, 1.0, 1.0),
    k("KC_KP_ENTER", 22.0, 4.5, 1.0, 2.0),
    k("KC_KP_0", 19.0, 5.5, 2.0, 1.0),
    k("KC_KP_DOT", 21.0, 5.5, 1.0, 1.0),
];

fn compact_x(x: f32) -> f32 {
    let mut result = x;
    if x >= RIGHT_REGION_START_X {
        result -= COMPACT_GROUP_GAP_UNITS;
    }
    if x >= NUMPAD_START_X {
        result -= COMPACT_GROUP_GAP_UNITS;
    }
    result
}

#[component]
pub fn BasicKeyboardLayout(
    codes: Vec<KeyCode>,
    key_size_rem: f32,
    onselect: EventHandler<u16>,
) -> Element {
    let code_map: HashMap<&str, &KeyCode> =
        codes.iter().map(|c| (c.key.as_str(), c)).collect();
    let unit_rem = key_size_rem + KEY_GAP_REM;
    let canvas_style = format!(
        "width:{}rem;height:{}rem;",
        ANSI_WIDTH_UNITS * unit_rem,
        ANSI_HEIGHT_UNITS * unit_rem
    );

    rsx! {
        div { class: "ansi-keyboard-scroll",
            div { class: "ansi-keyboard-canvas relative", style: "{canvas_style}",
                for pos in ANSI_LAYOUT.iter() {
                    {
                        let code = code_map.get(pos.key).copied();
                        let x = compact_x(pos.x);
                        let y = if pos.y > 0.0 { pos.y - COMPACT_GROUP_GAP_UNITS } else { pos.y };
                        let style = format!(
                            "position:absolute;top:{}rem;left:{}rem;width:{}rem;height:{}rem;",
                            y * unit_rem,
                            x * unit_rem,
                            pos.w * unit_rem - KEY_GAP_REM,
                            pos.h * unit_rem - KEY_GAP_REM,
                        );
                        let disabled = code.is_none();
                        let dim = if disabled { "opacity-30 cursor-default" } else { "" };
                        let label = code
                            .and_then(|c| c.label.clone())
                            .or_else(|| code.map(|c| c.key.clone()))
                            .unwrap_or_else(|| pos.key.to_string());
                        let title = code.map(|c| match &c.description {
                            Some(d) if !d.is_empty() => format!("{}\n{}", c.key, d),
                            _ => c.key.clone(),
                        });
                        let selected = code.map(|c| c.code);
                        rsx! {
                            button {
                                key: "{pos.key}",
                                class: "key-name-button absolute rounded-lg p-1 border-2 ring-4 ring-inset shadow-md border-black ring-neutral-300 text-black {dim}",
                                style: "{style}",
                                disabled,
                                title: title.unwrap_or_default(),
                                onclick: move |_| {
                                    if let Some(code) = selected {
                                        onselect.call(code);
                                    }
                                },
                                KeyLabel { class: "text-xs leading-tight", label }
                            }
                        }
                    }
                }
            }
        }
    }
}
