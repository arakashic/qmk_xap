//! Ported from src/utils/deviceStore.ts (Pinia "xap-device-store").
//!
//! The TS store keeps the selected device as a full object (`device`) aliasing
//! the map entry, so secure-status updates to the map are visible through the
//! selection. Here selection is the device id and [`DeviceStoreData::selected_state`]
//! derives the object from the map, which preserves that behavior.

use std::collections::HashMap;

use dioxus::prelude::*;
use uuid::Uuid;
use xap_core::XapDeviceState;
use xap_specs::XapSecureStatus;

/// Pure store state + logic; unit-testable without a Dioxus runtime.
#[derive(Clone, Debug, Default)]
pub struct DeviceStoreData {
    pub selected: Option<Uuid>,
    pub devices: HashMap<Uuid, XapDeviceState>,
}

impl DeviceStoreData {
    /// true if the device was new; auto-selects when nothing is selected
    /// (TS `addDevice`: insert if unknown, select if `!this.device`).
    pub fn add_device(&mut self, state: XapDeviceState) -> bool {
        if self.devices.contains_key(&state.id) {
            return false;
        }
        if self.selected.is_none() {
            self.selected = Some(state.id);
        }
        self.devices.insert(state.id, state);
        true
    }

    /// Removes; if it was selected, selects a remaining device (or None).
    ///
    /// TS picks `devices.values().next()`, i.e. the first JS Map entry in
    /// insertion order. HashMap is unordered, so this is "any remaining
    /// device"; callers only rely on "some remaining device or null".
    pub fn remove_device(&mut self, id: Uuid) {
        self.devices.remove(&id);
        if self.selected == Some(id) {
            self.selected = self.devices.keys().next().copied();
        }
    }

    /// No-op when the id is unknown (TS `updateSecureStatus`).
    pub fn update_secure_status(&mut self, id: Uuid, status: XapSecureStatus) {
        if let Some(device) = self.devices.get_mut(&id) {
            device.secure_status = status;
        }
    }

    pub fn selected_state(&self) -> Option<&XapDeviceState> {
        self.selected.and_then(|id| self.devices.get(&id))
    }

    /// Select a known device (the device-picker `v-model` in baseContainer.vue).
    /// No-op for an unknown id.
    pub fn select_device(&mut self, id: Uuid) {
        if self.devices.contains_key(&id) {
            self.selected = Some(id);
        }
    }
}

/// Thin reactive wrapper; construct inside a component (e.g. `use_hook`),
/// `Signal::new` panics outside the Dioxus runtime.
#[derive(Clone, Copy)]
pub struct DeviceStore(pub Signal<DeviceStoreData>);

impl Default for DeviceStore {
    fn default() -> Self {
        Self::new()
    }
}

impl DeviceStore {
    pub fn new() -> Self {
        Self(Signal::new(DeviceStoreData::default()))
    }

    /// true if the device was new; auto-selects when nothing is selected.
    pub fn add_device(&mut self, state: XapDeviceState) -> bool {
        // Read-first: `write()` schedules a rerender even when nothing changes.
        if self.0.read().devices.contains_key(&state.id) {
            return false;
        }
        self.0.write().add_device(state)
    }

    /// removes; if it was selected, selects any remaining device (or None).
    pub fn remove_device(&mut self, id: Uuid) {
        self.0.write().remove_device(id);
    }

    pub fn select_device(&mut self, id: Uuid) {
        if self.0.read().selected == Some(id) {
            return;
        }
        self.0.write().select_device(id);
    }

    pub fn update_secure_status(&mut self, id: Uuid, status: XapSecureStatus) {
        // Skip the write (and rerender) when the device is unknown or already
        // has that status. XapSecureStatus lacks PartialEq; the enum is
        // fieldless, so the discriminant comparison is exact.
        let unchanged = match self.0.read().devices.get(&id) {
            None => true,
            Some(device) => {
                std::mem::discriminant(&device.secure_status) == std::mem::discriminant(&status)
            }
        };
        if unchanged {
            return;
        }
        self.0.write().update_secure_status(id, status);
    }

    /// Clones the selected device state - useful when pages need owned state
    /// across awaits (the clone is per-render). Render-only readers should
    /// prefer reading the signal directly (`store.0.read()`) and borrowing.
    pub fn selected_state(&self) -> Option<XapDeviceState> {
        self.0.read().selected_state().cloned()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use xap_core::Keymap;

    fn device(id: Uuid) -> XapDeviceState {
        XapDeviceState {
            id,
            info: None,
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
    fn add_selects_first_device_and_second_does_not_steal_selection() {
        let mut store = DeviceStoreData::default();
        let (a, b) = (Uuid::new_v4(), Uuid::new_v4());

        assert!(store.add_device(device(a)));
        assert_eq!(store.selected, Some(a));

        assert!(store.add_device(device(b)));
        assert_eq!(store.selected, Some(a));
        assert_eq!(store.devices.len(), 2);
    }

    #[test]
    fn add_returns_false_for_known_id() {
        let mut store = DeviceStoreData::default();
        let a = Uuid::new_v4();

        assert!(store.add_device(device(a)));
        assert!(!store.add_device(device(a)));
        assert_eq!(store.devices.len(), 1);
    }

    #[test]
    fn select_device_switches_to_known_id_only() {
        let mut store = DeviceStoreData::default();
        let (a, b) = (Uuid::new_v4(), Uuid::new_v4());
        store.add_device(device(a));
        store.add_device(device(b));
        assert_eq!(store.selected, Some(a));

        store.select_device(b);
        assert_eq!(store.selected, Some(b));

        store.select_device(Uuid::new_v4()); // unknown id is a no-op
        assert_eq!(store.selected, Some(b));
    }

    #[test]
    fn remove_non_selected_keeps_selection() {
        let mut store = DeviceStoreData::default();
        let (a, b) = (Uuid::new_v4(), Uuid::new_v4());
        store.add_device(device(a));
        store.add_device(device(b));

        store.remove_device(b);

        assert_eq!(store.selected, Some(a));
        assert_eq!(store.devices.len(), 1);
    }

    #[test]
    fn remove_selected_selects_a_remaining_device() {
        let mut store = DeviceStoreData::default();
        let (a, b) = (Uuid::new_v4(), Uuid::new_v4());
        store.add_device(device(a));
        store.add_device(device(b));

        store.remove_device(a);

        assert_eq!(store.selected, Some(b));
        assert_eq!(store.selected_state().map(|s| s.id), Some(b));
    }

    #[test]
    fn remove_last_clears_selection() {
        let mut store = DeviceStoreData::default();
        let a = Uuid::new_v4();
        store.add_device(device(a));

        store.remove_device(a);

        assert_eq!(store.selected, None);
        assert!(store.selected_state().is_none());
    }

    #[test]
    fn update_secure_status_touches_only_the_right_device() {
        let mut store = DeviceStoreData::default();
        let (a, b) = (Uuid::new_v4(), Uuid::new_v4());
        store.add_device(device(a));
        store.add_device(device(b));

        store.update_secure_status(b, XapSecureStatus::Unlocked);

        assert!(matches!(store.devices[&a].secure_status, XapSecureStatus::Locked));
        assert!(matches!(store.devices[&b].secure_status, XapSecureStatus::Unlocked));

        // Unknown id is a no-op.
        store.update_secure_status(Uuid::new_v4(), XapSecureStatus::Unlocking);
        assert_eq!(store.devices.len(), 2);
    }
}
