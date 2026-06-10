//! KeyLabel: splits a key label into whitespace segments and slash-delimited
//! parts so long labels wrap nicely on a key face. Port of KeyLabel.vue.

use dioxus::prelude::*;

#[derive(Clone, Copy, PartialEq, Default)]
pub enum KeyLabelAlign {
    #[default]
    Center,
    Left,
}

/// Split a label into segments (whitespace-separated) of parts. Each part keeps
/// its trailing `/` so wrapping happens at slash boundaries — mirrors the TS
/// `split(/\s+/).map(s => s.match(/[^/]*\/|[^/]+/g))`.
pub fn split_label(label: &str) -> Vec<Vec<String>> {
    label.split_whitespace().map(split_parts).collect()
}

fn split_parts(word: &str) -> Vec<String> {
    let mut parts = Vec::new();
    let mut cur = String::new();
    for ch in word.chars() {
        cur.push(ch);
        if ch == '/' {
            parts.push(std::mem::take(&mut cur));
        }
    }
    if !cur.is_empty() {
        parts.push(cur);
    }
    parts
}

#[component]
pub fn KeyLabel(
    label: String,
    #[props(default)] align: KeyLabelAlign,
    #[props(default)] class: String,
) -> Element {
    let align_class = match align {
        KeyLabelAlign::Center => "key-label-center",
        KeyLabelAlign::Left => "key-label-left",
    };
    let segments = split_label(&label);
    rsx! {
        span { class: "key-label {align_class} {class}",
            for parts in segments.iter() {
                span { class: "key-label-segment",
                    for part in parts.iter() {
                        span { class: "key-label-part", "{part}" }
                    }
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn splits_words_and_keeps_slashes_with_preceding_part() {
        assert_eq!(split_label("MO/1"), vec![vec!["MO/", "1"]]);
        assert_eq!(
            split_label("Ctrl/Esc"),
            vec![vec!["Ctrl/", "Esc"]]
        );
        assert_eq!(
            split_label("Page Up"),
            vec![vec!["Page"], vec!["Up"]]
        );
        assert_eq!(split_label("a//b"), vec![vec!["a/", "/", "b"]]);
    }

    #[test]
    fn blank_label_yields_no_segments() {
        assert!(split_label("   ").is_empty());
        assert!(split_label("").is_empty());
    }
}
