//! Ported from src/utils/broadcastStore.ts (Pinia "broadcast-store").
//!
//! Also hosts `format_connection_id` / `device_display_name` from
//! src/utils/broadcast.ts (deferred from Task 2.2): both are broadcast-source
//! display helpers (`device_display_name` feeds `remember_device`,
//! `format_connection_id` shortens source ids in BroadcastView).

use std::collections::HashMap;

use dioxus::prelude::*;
use xap_core::XapDeviceState;

use crate::util::broadcast::{
    append_capped_broadcast_message, BroadcastKind, BroadcastMessage, BROADCAST_HISTORY_LIMIT,
};
use crate::util::time::now_ms;

/// `id.length > 12 ? first4...last4 : id` (TS `formatConnectionId`).
pub fn format_connection_id(id: &str) -> String {
    let len = id.chars().count();
    if len > 12 {
        let head: String = id.chars().take(4).collect();
        let tail: String = id.chars().skip(len - 4).collect();
        format!("{head}...{tail}")
    } else {
        id.to_string()
    }
}

/// `manufacturer - product_name`, skipping blank parts; falls back to
/// "Unknown device" (TS `deviceDisplayName`).
pub fn device_display_name(device: &XapDeviceState) -> String {
    let parts: Vec<&str> = device
        .info
        .as_ref()
        .map(|info| [info.qmk.manufacturer.as_str(), info.qmk.product_name.as_str()])
        .into_iter()
        .flatten()
        .filter(|part| !part.trim().is_empty())
        .collect();
    if parts.is_empty() {
        "Unknown device".to_string()
    } else {
        parts.join(" - ")
    }
}

/// Pure store state + logic; unit-testable without a Dioxus runtime.
/// `received_at` is explicit here (epoch millis); the [`BroadcastStore`]
/// wrapper supplies `now_ms()` for `Date.now()` parity with the TS defaults.
#[derive(Clone, Debug, Default)]
pub struct BroadcastStoreData {
    pub messages: Vec<BroadcastMessage>,
    pub source_names: HashMap<String, String>,
    pub next_sequence: u64,
}

impl BroadcastStoreData {
    /// TS `sourceName` getter: remembered name or "Unknown device".
    pub fn source_name(&self, device_id: &str) -> String {
        self.source_names
            .get(device_id)
            .cloned()
            .unwrap_or_else(|| "Unknown device".to_string())
    }

    pub fn remember_device(&mut self, device: &XapDeviceState) {
        self.source_names
            .insert(device.id.to_string(), device_display_name(device));
    }

    pub fn append_log(&mut self, device_id: String, text: String, received_at: f64) {
        self.next_sequence += 1;
        self.messages = append_capped_broadcast_message(
            &self.messages,
            BroadcastMessage {
                sequence: self.next_sequence,
                device_id,
                kind: BroadcastKind::Log,
                timestamp_ms: received_at,
                log: Some(text),
                payload: None,
            },
            BROADCAST_HISTORY_LIMIT,
        );
    }

    /// `kind` is a raw variant (`User`/`Keyboard`); the TS signature takes
    /// `RawBroadcastType`, which excludes `Log` by construction.
    pub fn append_raw(
        &mut self,
        device_id: String,
        kind: BroadcastKind,
        payload: Vec<u8>,
        received_at: f64,
    ) {
        self.next_sequence += 1;
        self.messages = append_capped_broadcast_message(
            &self.messages,
            BroadcastMessage {
                sequence: self.next_sequence,
                device_id,
                kind,
                timestamp_ms: received_at,
                log: None,
                payload: Some(payload),
            },
            BROADCAST_HISTORY_LIMIT,
        );
    }

    pub fn clear_messages(&mut self) {
        self.messages.clear();
    }
}

/// Thin reactive wrapper; construct inside a component (e.g. `use_hook`),
/// `Signal::new` panics outside the Dioxus runtime.
#[derive(Clone, Copy)]
pub struct BroadcastStore(pub Signal<BroadcastStoreData>);

impl Default for BroadcastStore {
    fn default() -> Self {
        Self::new()
    }
}

impl BroadcastStore {
    pub fn new() -> Self {
        Self(Signal::new(BroadcastStoreData::default()))
    }

    pub fn source_name(&self, device_id: &str) -> String {
        self.0.read().source_name(device_id)
    }

    pub fn remember_device(&mut self, device: &XapDeviceState) {
        // Read-first: skip the write (and rerender) when the id already maps
        // to the same display name.
        let name = device_display_name(device);
        if self
            .0
            .read()
            .source_names
            .get(&device.id.to_string())
            .is_some_and(|existing| *existing == name)
        {
            return;
        }
        self.0.write().remember_device(device);
    }

    pub fn append_log(&mut self, device_id: String, text: String) {
        self.0.write().append_log(device_id, text, now_ms());
    }

    pub fn append_raw(&mut self, device_id: String, kind: BroadcastKind, payload: Vec<u8>) {
        self.0.write().append_raw(device_id, kind, payload, now_ms());
    }

    pub fn clear_messages(&mut self) {
        self.0.write().clear_messages();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;
    use xap_core::aggregation::{QmkInfo, XapDeviceInfo, XapInfo};
    use xap_core::Keymap;
    use xap_specs::XapSecureStatus;

    fn device(id: Uuid, manufacturer: &str, product_name: &str) -> XapDeviceState {
        XapDeviceState {
            id,
            info: Some(XapDeviceInfo {
                xap: XapInfo { version: 0 },
                qmk: QmkInfo {
                    version: String::new(),
                    board_ids: Default::default(),
                    manufacturer: manufacturer.to_string(),
                    product_name: product_name.to_string(),
                    hardware_id: String::new(),
                    jump_to_bootloader_enabled: false,
                    eeprom_reset_enabled: false,
                },
                keymap: None,
                remap: None,
                lighting: None,
            }),
            keymap: Keymap::new(0, 0, 0),
            config: xap_core::aggregation::config::Config {
                layouts: HashMap::new(),
                matrix_size: xap_core::aggregation::Point2D { x: 0, y: 0 },
                encoder: Default::default(),
                split: Default::default(),
                encoder_count: 0,
            },
            config_json: String::new(),
            secure_status: XapSecureStatus::Locked,
        }
    }

    #[test]
    fn format_connection_id_shortens_only_long_ids() {
        assert_eq!(format_connection_id("0123456789ab"), "0123456789ab");
        assert_eq!(format_connection_id("0123456789abc"), "0123...9abc");
    }

    #[test]
    fn device_display_name_joins_non_blank_parts() {
        let id = Uuid::new_v4();
        assert_eq!(
            device_display_name(&device(id, "Mode Designs", "SixtyFive")),
            "Mode Designs - SixtyFive"
        );
        assert_eq!(device_display_name(&device(id, "  ", "Iris")), "Iris");
        assert_eq!(device_display_name(&device(id, "", "")), "Unknown device");

        let mut no_info = device(id, "x", "y");
        no_info.info = None;
        assert_eq!(device_display_name(&no_info), "Unknown device");
    }

    #[test]
    fn append_increments_sequence_and_builds_messages() {
        let mut store = BroadcastStoreData::default();

        store.append_log("alpha".to_string(), "hello".to_string(), 100.0);
        store.append_raw("beta".to_string(), BroadcastKind::User, vec![1, 2], 200.0);

        assert_eq!(store.next_sequence, 2);
        assert_eq!(store.messages.len(), 2);
        assert_eq!(store.messages[0].sequence, 1);
        assert_eq!(store.messages[0].kind, BroadcastKind::Log);
        assert_eq!(store.messages[0].log.as_deref(), Some("hello"));
        assert_eq!(store.messages[0].timestamp_ms, 100.0);
        assert_eq!(store.messages[1].sequence, 2);
        assert_eq!(store.messages[1].kind, BroadcastKind::User);
        assert_eq!(store.messages[1].payload.as_deref(), Some(&[1u8, 2][..]));
    }

    #[test]
    fn append_caps_history_but_keeps_sequence_counting() {
        let mut store = BroadcastStoreData::default();

        for i in 0..(BROADCAST_HISTORY_LIMIT + 5) {
            store.append_log("alpha".to_string(), format!("msg {i}"), i as f64);
        }

        assert_eq!(store.messages.len(), BROADCAST_HISTORY_LIMIT);
        assert_eq!(store.next_sequence, (BROADCAST_HISTORY_LIMIT + 5) as u64);
        assert_eq!(store.messages.first().unwrap().sequence, 6);
        assert_eq!(
            store.messages.last().unwrap().sequence,
            (BROADCAST_HISTORY_LIMIT + 5) as u64
        );
    }

    #[test]
    fn remember_device_names_sources_and_unknowns_fall_back() {
        let mut store = BroadcastStoreData::default();
        let id = Uuid::new_v4();

        store.remember_device(&device(id, "Keebio", "Iris"));

        assert_eq!(store.source_name(&id.to_string()), "Keebio - Iris");
        assert_eq!(store.source_name("missing"), "Unknown device");
    }

    #[test]
    fn clear_messages_resets_history_only() {
        let mut store = BroadcastStoreData::default();
        store.append_log("alpha".to_string(), "hello".to_string(), 1.0);
        let id = Uuid::new_v4();
        store.remember_device(&device(id, "Keebio", "Iris"));

        store.clear_messages();

        assert!(store.messages.is_empty());
        // TS clearMessages leaves nextSequence and sourceNames untouched.
        assert_eq!(store.next_sequence, 1);
        assert_eq!(store.source_name(&id.to_string()), "Keebio - Iris");
    }
}
