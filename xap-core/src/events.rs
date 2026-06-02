use anyhow::Result;
use serde::{Deserialize, Serialize};
use specta::Type;
use uuid::Uuid;

use xap_specs::{
    broadcast::{BroadcastRaw, BroadcastType, LogBroadcast},
    XapSecureStatus,
};

#[derive(Clone, Copy, Serialize, Deserialize, Type, Debug, PartialEq)]
pub enum RawBroadcastType {
    Keyboard,
    User,
}

#[derive(Clone, Serialize, Deserialize, Type, Debug)]
#[serde(tag = "kind", content = "data")]
pub enum XapEvent {
    LogReceived {
        id: Uuid,
        log: String,
    },
    SecureStatusChanged {
        id: Uuid,
        secure_status: XapSecureStatus,
    },
    RawBroadcastReceived {
        id: Uuid,
        broadcast_type: RawBroadcastType,
        payload: Vec<u8>,
    },
    NewDevice {
        id: Uuid,
    },
    RemovedDevice {
        id: Uuid,
    },
}

pub fn broadcast_event(
    id: Uuid,
    secure_status: XapSecureStatus,
    broadcast: BroadcastRaw,
) -> Result<XapEvent> {
    match broadcast.broadcast_type() {
        BroadcastType::Log => {
            let log: LogBroadcast = broadcast.into_xap_broadcast()?;
            Ok(XapEvent::LogReceived { id, log: log.0 })
        }
        BroadcastType::SecureStatus => Ok(XapEvent::SecureStatusChanged { id, secure_status }),
        BroadcastType::Keyboard => Ok(XapEvent::RawBroadcastReceived {
            id,
            broadcast_type: RawBroadcastType::Keyboard,
            payload: broadcast.payload().to_vec(),
        }),
        BroadcastType::User => Ok(XapEvent::RawBroadcastReceived {
            id,
            broadcast_type: RawBroadcastType::User,
            payload: broadcast.payload().to_vec(),
        }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_user_payload_to_raw_broadcast_event() {
        let id = Uuid::new_v4();
        let report = [
            0xFF,
            0xFF,
            BroadcastType::User as u8,
            0x03,
            0x01,
            0x2A,
            0xFF,
        ];
        let broadcast = BroadcastRaw::from_raw_report(&report).expect("failed to read broadcast");

        let event =
            broadcast_event(id, XapSecureStatus::Locked, broadcast).expect("failed to map event");

        match event {
            XapEvent::RawBroadcastReceived {
                id: event_id,
                broadcast_type: RawBroadcastType::User,
                payload,
            } => {
                assert_eq!(event_id, id);
                assert_eq!(payload, vec![0x01, 0x2A, 0xFF]);
            }
            _ => panic!("expected raw user broadcast event"),
        }
    }

    #[test]
    fn maps_log_payload_to_decoded_log_event() {
        let id = Uuid::new_v4();
        let report = [0xFF, 0xFF, BroadcastType::Log as u8, 0x02, b'o', b'k'];
        let broadcast = BroadcastRaw::from_raw_report(&report).expect("failed to read broadcast");

        let event =
            broadcast_event(id, XapSecureStatus::Locked, broadcast).expect("failed to map event");

        match event {
            XapEvent::LogReceived { id: event_id, log } => {
                assert_eq!(event_id, id);
                assert_eq!(log, "ok");
            }
            _ => panic!("expected decoded log event"),
        }
    }
}
