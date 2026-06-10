//! Ported from src/utils/broadcast.ts. The TS union message type becomes a
//! single struct with optional `log`/`payload` fields discriminated by `kind`.

pub const BROADCAST_HISTORY_LIMIT: usize = 1000;

/// `'Log'` plus the two `RawBroadcastType` variants from xap-core.
#[derive(Clone, Debug, PartialEq)]
pub enum BroadcastKind {
    Log,
    User,
    Keyboard,
}

impl BroadcastKind {
    pub fn name(&self) -> &'static str {
        match self {
            BroadcastKind::Log => "Log",
            BroadcastKind::User => "User",
            BroadcastKind::Keyboard => "Keyboard",
        }
    }
}

#[derive(Clone, Debug, PartialEq)]
pub struct BroadcastMessage {
    pub sequence: u64,
    pub device_id: String,
    pub kind: BroadcastKind,
    /// Epoch millis (JS `Date.now()` parity; TS field `receivedAt`).
    pub timestamp_ms: f64,
    /// Log text (`Log` kind).
    pub log: Option<String>,
    /// Raw payload (`User`/`Keyboard` kinds).
    pub payload: Option<Vec<u8>>,
}

#[derive(Clone, Debug, PartialEq)]
pub enum BroadcastTypeFilter {
    All,
    Log,
    Raw,
}

#[derive(Clone, Debug)]
pub struct BroadcastFilters {
    pub query: String,
    pub source_id: Option<String>,
    pub type_filter: BroadcastTypeFilter,
}

#[derive(Clone, Debug, PartialEq)]
pub struct HexRow {
    pub offset: String,
    pub bytes: String,
    pub ascii: String,
}

fn format_byte(byte: u8) -> String {
    format!("{byte:02X}")
}

fn printable_byte(byte: u8) -> char {
    if (0x20..=0x7e).contains(&byte) {
        byte as char
    } else {
        '.'
    }
}

// JS `Date` getters are local time, so broadcast timestamps display in the
// user's timezone; convert the epoch input via chrono::Local (pure conversion,
// no clock reads).
fn local_datetime(received_at: f64) -> chrono::DateTime<chrono::Local> {
    chrono::DateTime::from_timestamp_millis(received_at as i64)
        .unwrap_or(chrono::DateTime::UNIX_EPOCH)
        .with_timezone(&chrono::Local)
}

fn format_time_of_day(dt: &chrono::DateTime<chrono::Local>) -> String {
    use chrono::Timelike;
    format!(
        "{:02}:{:02}:{:02}.{:03}",
        dt.hour(),
        dt.minute(),
        dt.second(),
        dt.timestamp_subsec_millis()
    )
}

/// `HH:MM:SS.mmm` in local time.
pub fn format_broadcast_time(received_at: f64) -> String {
    format_time_of_day(&local_datetime(received_at))
}

/// `YYYY-MM-DD HH:MM:SS.mmm` in local time.
pub fn format_broadcast_date_time(received_at: f64) -> String {
    use chrono::Datelike;
    let dt = local_datetime(received_at);
    format!(
        // Unpadded year intentionally matches the TS getFullYear() behavior.
        "{}-{:02}-{:02} {}",
        dt.year(),
        dt.month(),
        dt.day(),
        format_time_of_day(&dt)
    )
}

/// 16 bytes per row as two 8-byte groups with an offset column and an ASCII
/// gutter. The bytes field is always padded to 48 chars.
pub fn format_hex_rows(payload: &[u8]) -> Vec<HexRow> {
    payload
        .chunks(16)
        .enumerate()
        .map(|(index, chunk)| {
            let first_group =
                chunk.iter().take(8).map(|b| format_byte(*b)).collect::<Vec<_>>().join(" ");
            let second_group =
                chunk.iter().skip(8).map(|b| format_byte(*b)).collect::<Vec<_>>().join(" ");
            HexRow {
                offset: format!("{:04X}", index * 16),
                bytes: format!("{:<48}", format!("{first_group:<23}  {second_group}")),
                ascii: chunk.iter().map(|b| printable_byte(*b)).collect(),
            }
        })
        .collect()
}

pub fn append_capped_broadcast_message(
    messages: &[BroadcastMessage],
    message: BroadcastMessage,
    limit: usize,
) -> Vec<BroadcastMessage> {
    if limit == 0 {
        return Vec::new();
    }

    let start = messages.len().saturating_sub(limit - 1);
    let mut retained = messages[start..].to_vec();
    retained.push(message);
    retained
}

pub fn filter_broadcast_messages(
    messages: &[BroadcastMessage],
    filters: &BroadcastFilters,
    source_name: impl Fn(&str) -> String,
) -> Vec<BroadcastMessage> {
    let query = filters.query.trim().to_lowercase();

    messages
        .iter()
        .filter(|message| {
            if let Some(source_id) = &filters.source_id {
                if &message.device_id != source_id {
                    return false;
                }
            }

            match filters.type_filter {
                BroadcastTypeFilter::Log if message.kind != BroadcastKind::Log => return false,
                BroadcastTypeFilter::Raw if message.kind == BroadcastKind::Log => return false,
                _ => {}
            }

            if query.is_empty() {
                return true;
            }

            let raw_payload;
            let payload: &str = match message.kind {
                BroadcastKind::Log => message.log.as_deref().unwrap_or(""),
                _ => {
                    let bytes = message.payload.as_deref().unwrap_or_default();
                    let hex =
                        bytes.iter().map(|b| format_byte(*b)).collect::<Vec<_>>().join(" ");
                    let ascii: String = bytes.iter().map(|b| printable_byte(*b)).collect();
                    raw_payload = format!("{hex} {ascii}");
                    &raw_payload
                }
            };
            let searchable = format!(
                "{} {} {} {}",
                source_name(&message.device_id),
                message.device_id,
                message.kind.name(),
                payload
            );
            searchable.to_lowercase().contains(&query)
        })
        .cloned()
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    fn log_message(sequence: u64, device_id: &str, text: &str) -> BroadcastMessage {
        BroadcastMessage {
            sequence,
            device_id: device_id.to_string(),
            kind: BroadcastKind::Log,
            timestamp_ms: sequence as f64,
            log: Some(text.to_string()),
            payload: None,
        }
    }

    #[test]
    fn formats_local_receive_timestamps_with_millisecond_precision() {
        // The TS test builds the epoch from local components (`new Date(y, m, d,
        // ...)` is local time); mirror that with chrono::Local so the expected
        // literals hold in any host timezone.
        let received_at = chrono::Local
            .with_ymd_and_hms(2026, 5, 26, 14, 22, 8)
            .single()
            .expect("unambiguous local time")
            .timestamp_millis() as f64
            + 143.0;

        assert_eq!(format_broadcast_time(received_at), "14:22:08.143");
        assert_eq!(format_broadcast_date_time(received_at), "2026-05-26 14:22:08.143");
    }

    #[test]
    fn renders_raw_data_as_offset_hex_rows_with_an_ascii_gutter() {
        let rows = format_hex_rows(&[0x01, 0x2a, 0x20, 0x7e, 0xff]);
        let row = &rows[0];

        assert_eq!(row.offset, "0000");
        assert_eq!(row.ascii, ".* ~.");
        assert_eq!(row.bytes.trim_end(), "01 2A 20 7E FF");
        assert_eq!(row.bytes.len(), 48);
    }

    #[test]
    fn keeps_only_the_latest_messages_when_the_history_cap_is_reached() {
        let mut messages: Vec<BroadcastMessage> = Vec::new();

        messages = append_capped_broadcast_message(&messages, log_message(1, "one", "first"), 2);
        messages = append_capped_broadcast_message(&messages, log_message(2, "two", "second"), 2);
        messages = append_capped_broadcast_message(&messages, log_message(3, "three", "third"), 2);

        assert_eq!(messages.iter().map(|m| m.sequence).collect::<Vec<_>>(), vec![2, 3]);
        assert_eq!(
            append_capped_broadcast_message(&messages, log_message(4, "four", "fourth"), 1),
            vec![log_message(4, "four", "fourth")]
        );
    }

    #[test]
    fn filters_by_source_type_and_string_or_hexadecimal_text() {
        let messages = vec![
            log_message(1, "alpha", "Layer changed to 2"),
            BroadcastMessage {
                sequence: 2,
                device_id: "beta".to_string(),
                kind: BroadcastKind::User,
                timestamp_ms: 2.0,
                log: None,
                payload: Some(vec![0x01, 0x2a, 0xff]),
            },
        ];
        let source_name = |device_id: &str| {
            if device_id == "alpha" {
                "Mode Designs - SixtyFive".to_string()
            } else {
                "Keebio - Iris".to_string()
            }
        };

        assert_eq!(
            filter_broadcast_messages(
                &messages,
                &BroadcastFilters {
                    query: "layer".to_string(),
                    source_id: None,
                    type_filter: BroadcastTypeFilter::Log,
                },
                source_name,
            )
            .len(),
            1
        );
        assert_eq!(
            filter_broadcast_messages(
                &messages,
                &BroadcastFilters {
                    query: "01 2a".to_string(),
                    source_id: Some("beta".to_string()),
                    type_filter: BroadcastTypeFilter::Raw,
                },
                source_name,
            )
            .len(),
            1
        );
        assert_eq!(
            filter_broadcast_messages(
                &messages,
                &BroadcastFilters {
                    query: "iris".to_string(),
                    source_id: None,
                    type_filter: BroadcastTypeFilter::All,
                },
                source_name,
            ),
            vec![messages[1].clone()]
        );
    }
}
