//! BroadcastView port: message feed with filter controls, hex display, and
//! auto-scroll. Ported from src/pages/BroadcastView.vue.

use dioxus::prelude::*;

use crate::store::broadcast::{format_connection_id, BroadcastStore};
use crate::util::broadcast::{
    filter_broadcast_messages, format_broadcast_date_time, format_broadcast_time, format_hex_rows,
    BroadcastFilters, BroadcastKind, BroadcastTypeFilter, BROADCAST_HISTORY_LIMIT,
};

#[component]
pub fn BroadcastPage() -> Element {
    let broadcast_store = use_context::<BroadcastStore>();

    let query = use_signal(String::new);
    let source_id: Signal<Option<String>> = use_signal(|| None);
    let type_filter = use_signal(|| BroadcastTypeFilter::All);
    let auto_scroll = use_signal(|| true);

    // Snapshot store data for this render.
    let store_data = broadcast_store.0.read();
    let messages = store_data.messages.clone();
    let source_names = store_data.source_names.clone();
    drop(store_data);

    // Build source options: "All devices" + sorted known sources.
    let mut source_options: Vec<(String, String)> = source_names
        .iter()
        .map(|(id, name)| {
            (
                id.clone(),
                format!("Source: {} ({})", name, format_connection_id(id)),
            )
        })
        .collect();
    source_options.sort_by(|(_, a), (_, b)| a.cmp(b));
    // Prepend "All devices" sentinel (empty string = None).
    source_options.insert(0, (String::new(), "Source: All devices".to_string()));

    let current_source = source_id.read().clone();
    let current_type = type_filter.read().clone();
    let current_query = query.read().clone();

    let visible_messages = filter_broadcast_messages(
        &messages,
        &BroadcastFilters {
            query: current_query.clone(),
            source_id: current_source.clone(),
            type_filter: current_type.clone(),
        },
        |device_id| {
            source_names
                .get(device_id)
                .cloned()
                .unwrap_or_else(|| "Unknown device".to_string())
        },
    );

    let total = messages.len();
    let visible_count = visible_messages.len();
    let status_message = if visible_count == total {
        format!(
            "Showing {} of up to {:} session messages",
            visible_count,
            format_with_commas(BROADCAST_HISTORY_LIMIT)
        )
    } else {
        format!(
            "Showing {} of {} captured messages (up to {:} retained)",
            visible_count,
            total,
            format_with_commas(BROADCAST_HISTORY_LIMIT)
        )
    };

    // Auto-scroll: after render, scroll feed to bottom when auto_scroll is on.
    // Uses web_sys Element.set_scroll_top on wasm; eval()-based fallback on desktop.
    let last_seq = visible_messages.last().map(|m| m.sequence);
    let auto_scroll_val = *auto_scroll.read();
    use_effect(move || {
        if !auto_scroll_val {
            return;
        }
        // Scroll the feed div to its bottom.
        // TODO: This runs after every render when auto_scroll is on, not only
        // on new messages. A use_memo on last_seq would be cleaner but requires
        // use_effect with a dep tracking approach. Acceptable for now since the
        // scroll is a no-op when already at the bottom.
        let _ = last_seq; // capture so effect re-runs when last_seq changes
        scroll_feed_to_bottom();
    });

    rsx! {
        div { class: "broadcast-page-root",
            section { class: "broadcast-page",
                header { class: "broadcast-header",
                    div { class: "broadcast-page-heading",
                        h5 { "Broadcast Messages" }
                        span { class: "listening-status",
                            span { class: "listening-dot" }
                            "Listening"
                        }
                    }

                    div { class: "broadcast-controls",
                        // Search / filter input
                        div { class: "bc-search-wrap",
                            span { class: "material-icons bc-search-icon", "search" }
                            input {
                                class: "bc-search-input",
                                r#type: "text",
                                placeholder: "Filter messages",
                                value: "{current_query}",
                                oninput: move |e| {
                                    let mut q = query;
                                    q.set(e.value());
                                },
                            }
                            if !current_query.is_empty() {
                                button {
                                    class: "bc-search-clear",
                                    onclick: move |_| {
                                        let mut q = query;
                                        q.set(String::new());
                                    },
                                    span { class: "material-icons", style: "font-size:1rem;", "close" }
                                }
                            }
                        }

                        // Source select
                        div { class: "bc-source-select-wrap",
                            select {
                                class: "bc-source-select",
                                onchange: move |e| {
                                    let val = e.value();
                                    let mut sid = source_id;
                                    sid.set(if val.is_empty() { None } else { Some(val) });
                                },
                                for (val, lbl) in source_options.iter() {
                                    option {
                                        value: "{val}",
                                        selected: *val == current_source.as_deref().unwrap_or(""),
                                        "{lbl}"
                                    }
                                }
                            }
                            span { class: "material-icons bc-source-arrow", "arrow_drop_down" }
                        }

                        // Type-filter toggle (All / Log / Raw)
                        div { class: "bc-type-filter",
                            button {
                                class: if matches!(current_type, BroadcastTypeFilter::All) {
                                    "bc-type-btn bc-type-btn-active"
                                } else {
                                    "bc-type-btn"
                                },
                                onclick: move |_| {
                                    let mut tf = type_filter;
                                    tf.set(BroadcastTypeFilter::All);
                                },
                                "All"
                            }
                            button {
                                class: if matches!(current_type, BroadcastTypeFilter::Log) {
                                    "bc-type-btn bc-type-btn-active"
                                } else {
                                    "bc-type-btn"
                                },
                                onclick: move |_| {
                                    let mut tf = type_filter;
                                    tf.set(BroadcastTypeFilter::Log);
                                },
                                "Log"
                            }
                            button {
                                class: if matches!(current_type, BroadcastTypeFilter::Raw) {
                                    "bc-type-btn bc-type-btn-active"
                                } else {
                                    "bc-type-btn"
                                },
                                onclick: move |_| {
                                    let mut tf = type_filter;
                                    tf.set(BroadcastTypeFilter::Raw);
                                },
                                "Raw"
                            }
                        }

                        // Clear button
                        button {
                            class: "bc-clear-btn",
                            onclick: move |_| {
                                let mut bs = broadcast_store;
                                bs.clear_messages();
                            },
                            "Clear"
                        }
                    }
                }

                // Console panel
                div { class: "console-panel",
                    div { id: "bc-message-feed", class: "message-feed",
                        if visible_messages.is_empty() {
                            div { class: "empty-feed",
                                span { class: "material-icons", style: "font-size:2rem;color:#d1d5db;", "sensors" }
                                div { "No broadcast messages captured." }
                                div { class: "empty-detail",
                                    "Log, keyboard, and user broadcasts will appear here."
                                }
                            }
                        }

                        for message in visible_messages.iter() {
                            {
                                let kind_class = match message.kind {
                                    BroadcastKind::Log => "message-block message-log",
                                    BroadcastKind::User => "message-block message-user",
                                    BroadcastKind::Keyboard => "message-block message-keyboard",
                                };
                                let badge_label = match message.kind {
                                    BroadcastKind::Log => "LOG".to_string(),
                                    BroadcastKind::User => "USER / RAW".to_string(),
                                    BroadcastKind::Keyboard => "KEYBOARD / RAW".to_string(),
                                };
                                let time_str = format_broadcast_time(message.timestamp_ms);
                                let datetime_str = format_broadcast_date_time(message.timestamp_ms);
                                let source_name = source_names
                                    .get(&message.device_id)
                                    .cloned()
                                    .unwrap_or_else(|| "Unknown device".to_string());
                                let conn_id = format_connection_id(&message.device_id);
                                let seq = message.sequence;

                                rsx! {
                                    article {
                                        key: "{seq}",
                                        class: "{kind_class}",
                                        div { class: "message-meta",
                                            time {
                                                class: "message-time",
                                                title: "{datetime_str}",
                                                "{time_str}"
                                            }
                                            span { class: "message-badge", "{badge_label}" }
                                            span { class: "source-name", "{source_name}" }
                                            code { class: "source-id", "{conn_id}" }
                                        }

                                        if message.kind == BroadcastKind::Log {
                                            p { class: "log-payload",
                                                "{message.log.as_deref().unwrap_or(\"\")}"
                                            }
                                        } else {
                                            {
                                                let payload = message.payload.as_deref().unwrap_or_default();
                                                let rows = format_hex_rows(payload);
                                                rsx! {
                                                    div { class: "raw-payload",
                                                        if payload.is_empty() {
                                                            div { class: "empty-payload", "Empty payload" }
                                                        } else {
                                                            for row in rows.iter() {
                                                                div {
                                                                    key: "{row.offset}",
                                                                    class: "hex-row",
                                                                    span { class: "hex-offset", "{row.offset}" }
                                                                    span { class: "hex-bytes", "{row.bytes}" }
                                                                    span { class: "hex-ascii", "{row.ascii}" }
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

                    // Footer
                    div { class: "console-footer",
                        span { "{status_message}" }
                        span {
                            class: "material-icons history-info",
                            title: "Session history is currently limited to 1,000 messages.",
                            "info_outline"
                        }
                        div { class: "footer-spacer" }
                        label { class: "bc-autoscroll-label",
                            div {
                                class: if auto_scroll_val {
                                    "bc-toggle-track bc-toggle-track-on"
                                } else {
                                    "bc-toggle-track"
                                },
                                onclick: move |_| {
                                    let mut a = auto_scroll;
                                    a.toggle();
                                },
                                div {
                                    class: if auto_scroll_val {
                                        "bc-toggle-thumb bc-toggle-thumb-on"
                                    } else {
                                        "bc-toggle-thumb"
                                    }
                                }
                            }
                            "Auto-scroll"
                        }
                    }
                }
            }
        }
    }
}

/// Scroll the message feed element to the bottom.
///
/// On wasm: uses `web_sys` `Element.set_scroll_top`.
/// On desktop: uses `document::eval` (dioxus desktop JS bridge).
///
/// TODO: The id-based lookup works for a single BroadcastPage in the tree
/// (which is always the case here). If multiple instances were mounted the id
/// would collide; switch to a use_node_ref approach when Dioxus 0.7 exposes it
/// stably.
fn scroll_feed_to_bottom() {
    #[cfg(target_arch = "wasm32")]
    {
        if let Some(window) = web_sys::window() {
            if let Some(doc) = window.document() {
                if let Some(el) = doc.get_element_by_id("bc-message-feed") {
                    el.set_scroll_top(el.scroll_height().into());
                }
            }
        }
    }
    #[cfg(not(target_arch = "wasm32"))]
    {
        let _ = document::eval(
            "{ const el = document.getElementById('bc-message-feed'); \
             if (el) el.scrollTop = el.scrollHeight; }",
        );
    }
}

fn format_with_commas(n: usize) -> String {
    let s = n.to_string();
    let mut result = String::new();
    for (i, ch) in s.chars().rev().enumerate() {
        if i > 0 && i % 3 == 0 {
            result.push(',');
        }
        result.push(ch);
    }
    result.chars().rev().collect()
}
