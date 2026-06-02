use std::{
    collections::VecDeque,
    io::Cursor,
    sync::Arc,
    vec,
};

use anyhow::{anyhow, Result};
use binrw::{BinRead, BinWriterExt};
use serde::Serialize;
use specta::Type;
use uuid::Uuid;

use xap_specs::{
    broadcast::{BroadcastRaw, BroadcastType, SecureStatusBroadcast},
    constants::{keycode::KeyCode, XapConstants},
    request::{RawRequest, XapRequest},
    response::RawResponse,
    token::Token,
    XapSecureStatus,
};

use crate::aggregation::{
    config::Config, keymap::MappedKeymap, Point2D, Point3D, XapDeviceInfo,
};
use crate::transport::{IngestOutcome, XapWriter};

#[derive(Clone, Debug, Serialize, Type)]
pub struct Keymap {
    keys: Vec<Vec<Vec<KeymapKey>>>,
    dimensions: Point3D,
}

#[derive(Debug, Default, Clone, Serialize, Type)]
pub struct KeymapKey {
    pub code: KeyCode,
    pub position: Point3D,
}

impl Keymap {
    pub fn new(layers: u64, rows: u64, columns: u64) -> Self {
        Self {
            keys: vec![
                vec![vec![KeymapKey::default(); columns as usize]; rows as usize];
                layers as usize
            ],
            dimensions: Point3D {
                z: layers,
                y: rows,
                x: columns,
            },
        }
    }

    pub fn remap_key(&mut self, key: &KeymapKey) -> Result<()> {
        if key.position.z >= self.dimensions.z
            || key.position.y >= self.dimensions.y
            || key.position.x >= self.dimensions.x
        {
            anyhow::bail!(
                "key position {:?} out of bounds for keymap with dimensions {:?}",
                key.position,
                self.dimensions
            )
        }

        self.keys[key.position.z as usize][key.position.y as usize][key.position.x as usize] =
            key.clone();

        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Type)]
pub struct XapDeviceState {
    pub id: Uuid,
    pub info: Option<XapDeviceInfo>,
    #[serde(skip)]
    pub keymap: Keymap,
    pub config: Config,
    pub config_json: String,
    pub secure_status: XapSecureStatus,
}

pub const XAP_REPORT_SIZE: usize = 64;

/// Non-blocking push-driven XAP device state machine. The core never reads,
/// never blocks: callers `submit` requests (writer puts bytes on the wire) and
/// feed inbound reports back via `ingest`. One in-flight request per device
/// (Locked Decision 3).
pub struct XapDevice {
    id: Uuid,
    constants: Arc<XapConstants>,
    state: XapDeviceState,
    broadcast_queue: VecDeque<BroadcastRaw>,
    pending: Option<(Token, Option<Result<RawResponse>>)>,
}

impl XapDevice {
    pub fn new(id: Uuid, constants: Arc<XapConstants>) -> Self {
        let state = XapDeviceState {
            id,
            info: None,
            keymap: Keymap::new(0, 0, 0),
            config: Config {
                layouts: std::collections::HashMap::new(),
                matrix_size: Point2D { x: 0, y: 0 },
                encoder: Default::default(),
            },
            config_json: String::new(),
            secure_status: XapSecureStatus::Locked,
        };

        Self {
            id,
            constants,
            state,
            broadcast_queue: VecDeque::new(),
            pending: None,
        }
    }

    pub fn id(&self) -> Uuid {
        self.id
    }

    pub fn state(&self) -> &XapDeviceState {
        &self.state
    }

    pub fn state_mut(&mut self) -> &mut XapDeviceState {
        &mut self.state
    }

    pub fn set_state(&mut self, state: XapDeviceState) {
        self.state = state;
    }

    pub fn secure_status(&self) -> &XapSecureStatus {
        &self.state.secure_status
    }

    pub fn keymap(&self) -> &Keymap {
        &self.state.keymap
    }

    pub fn xap_info(&self) -> XapDeviceInfo {
        self.state
            .info
            .clone()
            .expect("XAP device wasn't properly initialized")
    }

    pub fn keymap_with_layout(&self, layout: String) -> Result<MappedKeymap> {
        let layout = self
            .state
            .config
            .layouts
            .get(&layout)
            .ok_or_else(|| anyhow!("layout {layout} not found in device {}", self.id))?;

        let mut keymap = MappedKeymap::new(
            self.state.keymap.dimensions.z,
            self.state.keymap.dimensions.y,
            self.state.keymap.dimensions.x,
        );

        for (_layer, keys) in self.keymap().keys.iter().enumerate() {
            for (row, keys) in keys.iter().enumerate() {
                for (column, key) in keys.iter().enumerate() {
                    if let Some(entry) = layout.find(Point2D {
                        x: column as u64,
                        y: row as u64,
                    }) {
                        keymap.insert(key.clone(), entry.clone());
                    }
                }
            }
        }

        Ok(keymap)
    }

    /// Frame a request, record it as the single in-flight pending token, and
    /// hand the report bytes to the writer. Returns the token. Never blocks.
    pub fn submit<T: XapRequest>(&mut self, writer: &dyn XapWriter, request: T) -> Result<Token> {
        if let Some(xap_info) = &self.state.info {
            if T::xap_version() > xap_info.xap.version {
                return Err(anyhow!(
                    "can't do xap request [{:?}] with client of version {}",
                    T::id(),
                    xap_info.xap.version
                ));
            }
        }

        let request = RawRequest::new(request);
        let mut report = [0; XAP_REPORT_SIZE + 1];

        // Leading zero byte is the HID report id.
        let mut writer_cursor = Cursor::new(&mut report[1..]);
        writer_cursor.write_le(&request)?;

        let token = request.token().clone();
        self.pending = Some((token.clone(), None));
        writer.write_report(&report)?;

        Ok(token)
    }

    /// Feed one inbound report into the state machine. Decodes the token: a
    /// broadcast is enqueued (secure-status side effect applied), a response is
    /// matched against the single pending token.
    pub fn ingest(&mut self, report: &[u8]) -> Result<IngestOutcome> {
        let mut reader = Cursor::new(report);
        let token = Token::read_le(&mut reader)?;

        if let Token::Broadcast = token {
            let broadcast = BroadcastRaw::from_raw_report(report)?;

            if matches!(broadcast.broadcast_type(), BroadcastType::SecureStatus) {
                broadcast
                    .clone()
                    .into_xap_broadcast::<SecureStatusBroadcast>()
                    .map(|broadcast| {
                        self.state.secure_status = broadcast.0;
                    })?;
            }

            self.broadcast_queue.push_back(broadcast);
            return Ok(IngestOutcome::Broadcast);
        }

        // Correlate the token FIRST, then store the decode RESULT in the slot so
        // a secure-failure/malformed response surfaces through `take_response`
        // instead of returning Err here and wedging the pending slot forever.
        match &mut self.pending {
            Some((pending_token, slot @ None)) if *pending_token == token => {
                *slot = Some(RawResponse::from_raw_report(report));
                Ok(IngestOutcome::Response { token })
            }
            _ => Ok(IngestOutcome::Unmatched),
        }
    }

    /// If the pending response matches `token` and has arrived, take it, clear
    /// the pending slot, and decode it as `T::Response`. A stored decode error
    /// (e.g. "device is locked") surfaces here.
    pub fn take_response<T: XapRequest>(&mut self, token: &Token) -> Result<Option<T::Response>> {
        match &self.pending {
            Some((t, Some(_))) if t == token => {
                let (_, slot) = self.pending.take().expect("just matched");
                let raw = slot.expect("slot just checked Some")?;
                Ok(Some(raw.into_xap_response::<T>()?))
            }
            _ => Ok(None),
        }
    }

    pub fn take_broadcasts(&mut self) -> Vec<BroadcastRaw> {
        self.broadcast_queue.drain(..).collect()
    }

    pub fn constants(&self) -> &Arc<XapConstants> {
        &self.constants
    }
}

pub(crate) fn format_hardware_id(hardware_id: [u32; 4]) -> String {
    hardware_id
        .iter()
        .map(|word| format!("0x{word:08X}"))
        .collect::<Vec<_>>()
        .join(" ")
}

#[cfg(test)]
mod test {
    use std::cell::RefCell;

    use super::*;
    use binrw::BinWrite;
    use xap_specs::spec::xap::{XapSecureStatusRequest, XapVersionRequest};

    struct FakeWriter {
        last: RefCell<Vec<u8>>,
    }

    impl FakeWriter {
        fn new() -> Self {
            Self {
                last: RefCell::new(Vec::new()),
            }
        }
    }

    impl XapWriter for FakeWriter {
        fn write_report(&self, report: &[u8]) -> Result<()> {
            *self.last.borrow_mut() = report.to_vec();
            Ok(())
        }
    }

    fn constants() -> Arc<XapConstants> {
        Arc::new(XapConstants::from_embedded().expect("embedded constants"))
    }

    fn token_value(token: &Token) -> u16 {
        match token {
            Token::WithResponse(v) => *v,
            _ => panic!("expected WithResponse token"),
        }
    }

    /// Build a success RawResponse report for `token` with the given payload.
    fn response_report(token: &Token, payload: &[u8]) -> Vec<u8> {
        response_report_with_flags(token, 1, payload)
    }

    fn response_report_with_flags(token: &Token, flags: u8, payload: &[u8]) -> Vec<u8> {
        let mut report = Vec::new();
        let mut cursor = Cursor::new(&mut report);
        token.write_le(&mut cursor).unwrap();
        cursor.write_le(&flags).unwrap();
        cursor.write_le(&(payload.len() as u8)).unwrap();
        cursor.write_le(&payload.to_vec()).unwrap();
        report
    }

    #[test]
    fn submit_sets_pending_and_writes_framed_report() {
        let writer = FakeWriter::new();
        let mut device = XapDevice::new(Uuid::new_v4(), constants());

        let token = device
            .submit(&writer, XapSecureStatusRequest(()))
            .expect("submit");

        assert!(matches!(token, Token::WithResponse(_)));
        assert!(device.pending.is_some());

        let report = writer.last.borrow();
        assert_eq!(report.len(), XAP_REPORT_SIZE + 1);
        assert_eq!(report[0], 0); // report id
        // report[1..3] encode the token little-endian
        let encoded = u16::from_le_bytes([report[1], report[2]]);
        assert_eq!(encoded, token_value(&token));
    }

    #[test]
    fn ingest_matches_response_and_take_decodes() {
        let writer = FakeWriter::new();
        let mut device = XapDevice::new(Uuid::new_v4(), constants());

        let token = device
            .submit(&writer, XapVersionRequest(()))
            .expect("submit");

        // XapVersionResponse is a u32 newtype.
        let version: u32 = 0x03020115;
        let report = response_report(&token, &version.to_le_bytes());

        let outcome = device.ingest(&report).expect("ingest");
        match outcome {
            IngestOutcome::Response { token: t } => assert_eq!(t, token),
            other => panic!("expected Response, got {other:?}"),
        }

        let decoded = device
            .take_response::<XapVersionRequest>(&token)
            .expect("take")
            .expect("present");
        assert_eq!(decoded.0, version);

        // Pending cleared.
        assert!(device.pending.is_none());
        assert!(device
            .take_response::<XapVersionRequest>(&token)
            .expect("take2")
            .is_none());
    }

    #[test]
    fn ingest_secure_status_broadcast_applies_and_queues() {
        let mut device = XapDevice::new(Uuid::new_v4(), constants());
        assert!(matches!(device.secure_status(), XapSecureStatus::Locked));

        // Broadcast token = 0xFFFF, type = SecureStatus (1), len = 1, payload = 2 (Unlocked).
        let report = [0xFF, 0xFF, BroadcastType::SecureStatus as u8, 0x01, 0x02];

        let outcome = device.ingest(&report).expect("ingest");
        assert!(matches!(outcome, IngestOutcome::Broadcast));
        assert!(matches!(device.secure_status(), XapSecureStatus::Unlocked));

        let broadcasts = device.take_broadcasts();
        assert_eq!(broadcasts.len(), 1);
        assert!(device.take_broadcasts().is_empty());
    }

    #[test]
    fn ingest_unmatched_token_returns_unmatched() {
        let mut device = XapDevice::new(Uuid::new_v4(), constants());

        // No pending: any response is unmatched.
        let token = Token::WithResponse(0x0123);
        let report = response_report(&token, &[0u8; 4]);
        let outcome = device.ingest(&report).expect("ingest");
        assert!(matches!(outcome, IngestOutcome::Unmatched));

        // With a pending token, a different token is still unmatched.
        let writer = FakeWriter::new();
        let pending = device
            .submit(&writer, XapVersionRequest(()))
            .expect("submit");
        let other = Token::WithResponse(token_value(&pending).wrapping_add(1).max(0x0100));
        let report = response_report(&other, &[0u8; 4]);
        let outcome = device.ingest(&report).expect("ingest");
        assert!(matches!(outcome, IngestOutcome::Unmatched));
    }

    #[test]
    fn duplicate_response_is_unmatched_and_does_not_clobber() {
        let writer = FakeWriter::new();
        let mut device = XapDevice::new(Uuid::new_v4(), constants());

        let token = device
            .submit(&writer, XapVersionRequest(()))
            .expect("submit");

        let first: u32 = 0x03020115;
        let report = response_report(&token, &first.to_le_bytes());
        assert!(matches!(
            device.ingest(&report).expect("ingest"),
            IngestOutcome::Response { .. }
        ));

        // Same matching token again: slot already filled -> Unmatched, no clobber.
        let second: u32 = 0xDEADBEEF;
        let dup = response_report(&token, &second.to_le_bytes());
        assert!(matches!(
            device.ingest(&dup).expect("ingest dup"),
            IngestOutcome::Unmatched
        ));

        let decoded = device
            .take_response::<XapVersionRequest>(&token)
            .expect("take")
            .expect("present");
        assert_eq!(decoded.0, first);
    }

    #[test]
    fn secure_failure_surfaces_at_take_and_clears_pending() {
        let writer = FakeWriter::new();
        let mut device = XapDevice::new(Uuid::new_v4(), constants());

        let token = device
            .submit(&writer, XapVersionRequest(()))
            .expect("submit");

        // flags: SECURE_FAILURE = 0b10.
        let report = response_report_with_flags(&token, 0b10, &[]);
        assert!(matches!(
            device.ingest(&report).expect("ingest"),
            IngestOutcome::Response { .. }
        ));

        let err = device
            .take_response::<XapVersionRequest>(&token)
            .expect_err("expected device-locked error");
        assert!(err.to_string().contains("device is locked"), "{err}");

        // Pending cleared: device not wedged.
        assert!(device.pending.is_none());
        assert!(device
            .take_response::<XapVersionRequest>(&token)
            .expect("take2")
            .is_none());
    }

    #[test]
    fn hardware_id_uses_four_hex_words() {
        assert_eq!(
            format_hardware_id([0x00000001, 0x0000000A, 0x000000FF, 0x12345678]),
            "0x00000001 0x0000000A 0x000000FF 0x12345678"
        );
    }
}
