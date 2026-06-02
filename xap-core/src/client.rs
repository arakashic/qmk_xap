use std::{collections::HashMap, sync::Arc};

use anyhow::{anyhow, Result};
use uuid::Uuid;

use xap_specs::constants::XapConstants;

use crate::device::XapDevice;
use crate::events::{broadcast_event, XapEvent};
use crate::transport::IngestOutcome;

/// Transport-independent registry of XAP devices. Enumeration and HID ownership
/// live in the platform adapter (desktop/wasm); this client just stores devices,
/// routes inbound reports through `ingest`, and drains broadcasts into events.
pub struct XapClient {
    devices: HashMap<Uuid, XapDevice>,
    constants: Arc<XapConstants>,
}

impl XapClient {
    pub fn new(constants: Arc<XapConstants>) -> Self {
        Self {
            devices: HashMap::new(),
            constants,
        }
    }

    pub fn constants(&self) -> Arc<XapConstants> {
        Arc::clone(&self.constants)
    }

    pub fn xap_constants(&self) -> XapConstants {
        self.constants.as_ref().clone()
    }

    pub fn add_device(&mut self, device: XapDevice) {
        self.devices.insert(device.id(), device);
    }

    pub fn remove_device(&mut self, id: Uuid) -> Option<XapDevice> {
        self.devices.remove(&id)
    }

    pub fn device(&self, id: Uuid) -> Result<&XapDevice> {
        self.devices
            .get(&id)
            .ok_or_else(|| anyhow!("unknown device id: {id}"))
    }

    pub fn device_mut(&mut self, id: Uuid) -> Result<&mut XapDevice> {
        self.devices
            .get_mut(&id)
            .ok_or_else(|| anyhow!("unknown device id: {id}"))
    }

    pub fn get_devices(&self) -> Vec<&XapDevice> {
        self.devices.values().collect()
    }

    pub fn ingest(&mut self, id: Uuid, report: &[u8]) -> Result<IngestOutcome> {
        self.device_mut(id)?.ingest(report)
    }

    /// Drain queued broadcasts from every device and map each through
    /// `broadcast_event`. A `broadcast_event` error is logged and the offending
    /// broadcast skipped so one bad broadcast doesn't abort the whole drain.
    pub fn drain_broadcasts(&mut self) -> Vec<(Uuid, XapEvent)> {
        let mut events = Vec::new();
        for device in self.devices.values_mut() {
            let id = device.id();
            let secure_status = *device.secure_status();
            for broadcast in device.take_broadcasts() {
                match broadcast_event(id, secure_status, broadcast) {
                    Ok(event) => events.push((id, event)),
                    Err(err) => log::error!("failed to map broadcast for device {id}: {err}"),
                }
            }
        }
        events
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::events::RawBroadcastType;
    use xap_specs::broadcast::BroadcastType;

    fn constants() -> Arc<XapConstants> {
        Arc::new(XapConstants::from_embedded().expect("embedded constants"))
    }

    #[test]
    fn ingest_routes_to_device_and_drains_broadcast() {
        let mut client = XapClient::new(constants());
        let id = Uuid::new_v4();
        client.add_device(XapDevice::new(id, client.constants()));

        let report = [
            0xFF,
            0xFF,
            BroadcastType::User as u8,
            0x03,
            0x01,
            0x2A,
            0xFF,
        ];

        let outcome = client.ingest(id, &report).expect("ingest");
        assert!(matches!(outcome, IngestOutcome::Broadcast));

        let events = client.drain_broadcasts();
        assert_eq!(events.len(), 1);
        let (event_id, event) = &events[0];
        assert_eq!(*event_id, id);
        match event {
            XapEvent::RawBroadcastReceived {
                id: e_id,
                broadcast_type: RawBroadcastType::User,
                payload,
            } => {
                assert_eq!(*e_id, id);
                assert_eq!(*payload, vec![0x01, 0x2A, 0xFF]);
            }
            other => panic!("expected raw user broadcast event, got {other:?}"),
        }

        // Drain is idempotent once empty.
        assert!(client.drain_broadcasts().is_empty());
    }

    #[test]
    fn ingest_unknown_id_errors() {
        let mut client = XapClient::new(constants());
        let report = [0xFF, 0xFF, BroadcastType::User as u8, 0x00];
        let err = client
            .ingest(Uuid::new_v4(), &report)
            .expect_err("expected unknown device error");
        assert!(err.to_string().contains("unknown device id"), "{err}");
    }
}
