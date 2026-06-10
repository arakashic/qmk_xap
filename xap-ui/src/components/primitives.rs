//! Quasar-look primitives recreating the q-* widgets the shell uses. Page-only
//! primitives (Field, ExpansionItem, Slider, BtnToggle, Badge, Tooltip) are
//! added alongside the pages that need them in Phase 5.

use dioxus::prelude::*;

use crate::app::Route;
use crate::store::ui::UiState;

/// Material-icons ligature span (q-icon).
#[component]
pub fn Icon(name: String, #[props(default)] class: String) -> Element {
    rsx! {
        span { class: "material-icons {class}", "{name}" }
    }
}

/// q-btn. Standard filled button, or a round FAB when `fab` is set. `loading`
/// swaps the content for a spinner (the secure FAB's Unlocking state).
#[component]
pub fn Btn(
    #[props(default)] label: String,
    #[props(default)] icon: Option<String>,
    #[props(default)] fab: bool,
    #[props(default)] flat: bool,
    #[props(default)] loading: bool,
    #[props(default)] disabled: bool,
    #[props(default)] title: Option<String>,
    #[props(default)] class: String,
    onclick: EventHandler<MouseEvent>,
) -> Element {
    let base = if fab {
        "qx-fab"
    } else if flat {
        "qx-btn-flat"
    } else {
        "qx-btn"
    };
    rsx! {
        button {
            class: "{base} {class}",
            disabled,
            title: title.unwrap_or_default(),
            onclick: move |e| onclick.call(e),
            if loading {
                span { class: "qx-spinner", style: "width:24px;height:24px;border-width:3px;" }
            } else {
                if let Some(name) = icon {
                    span { class: "material-icons", "{name}" }
                }
                if !label.is_empty() {
                    span { "{label}" }
                }
            }
        }
    }
}

/// q-field (filled, stack-label, readonly): a labelled value display.
#[component]
pub fn Field(label: String, value: String) -> Element {
    rsx! {
        div { class: "qx-field",
            div { class: "qx-field-label", "{label}" }
            div { class: "qx-field-value", "{value}" }
        }
    }
}

/// q-expansion-item: a titled, collapsible section (collapsed by default).
#[component]
pub fn ExpansionItem(title: String, children: Element) -> Element {
    let mut open = use_signal(|| false);
    let wrap = if open() { "qx-expansion-open" } else { "" };
    rsx! {
        div { class: "{wrap}",
            div {
                class: "qx-expansion-header",
                onclick: move |_| open.toggle(),
                span { class: "qx-expansion-title", "{title}" }
                span { class: "material-icons qx-expansion-chevron", "expand_more" }
            }
            if open() {
                div { class: "qx-expansion-body", {children} }
            }
        }
    }
}

/// q-route-tab: a router link styled as a tab, with an active underline.
/// `disabled` renders inert (Quasar `:disable`).
#[component]
pub fn Tab(to: Route, label: String, #[props(default)] disabled: bool) -> Element {
    if disabled {
        return rsx! {
            span { class: "qx-tab qx-tab-disabled", "{label}" }
        };
    }
    rsx! {
        Link {
            class: "qx-tab",
            active_class: "qx-tab-active",
            to,
            "{label}"
        }
    }
}

/// q-select (filled). Native `<select>` styled to match; `readonly` (single
/// device) shows the value without a usable dropdown, `disabled` greys it out.
#[component]
pub fn Select(
    label: String,
    value: Option<String>,
    options: Vec<(String, String)>,
    #[props(default)] disabled: bool,
    #[props(default)] readonly: bool,
    onselect: EventHandler<String>,
) -> Element {
    let wrap_class = if disabled { "qx-select qx-select-disabled" } else { "qx-select" };
    let selected = value.clone().unwrap_or_default();
    rsx! {
        div { class: "{wrap_class}",
            label { class: "qx-select-label", "{label}" }
            select {
                class: "qx-select-native",
                disabled: disabled || readonly,
                onchange: move |e| onselect.call(e.value()),
                for (val, lbl) in options.iter() {
                    option {
                        value: "{val}",
                        selected: *val == selected,
                        "{lbl}"
                    }
                }
            }
            span { class: "material-icons qx-select-arrow", "arrow_drop_down" }
        }
    }
}

/// Toast stack + loading overlay, mounted once at the layout root. Renders from
/// the [`UiState`] context (Quasar Notify / Loading).
#[component]
pub fn FeedbackLayer() -> Element {
    let ui = use_context::<UiState>();
    let toasts = ui.toasts.read();
    let loading = ui.loading.read();
    rsx! {
        div { class: "qx-toast-stack",
            for toast in toasts.iter() {
                div { key: "{toast.id}", class: "{toast.kind.class()}",
                    if let Some(icon) = toast.icon {
                        span { class: "material-icons", "{icon}" }
                    }
                    span { "{toast.message}" }
                }
            }
        }
        if let Some(message) = loading.as_ref() {
            div { class: "qx-loading",
                div { class: "qx-spinner" }
                div { "{message}" }
            }
        }
    }
}
