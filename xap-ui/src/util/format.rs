//! Ported from src/utils/format.ts. The TS string-input overload is dropped:
//! Rust callers always pass the numeric version.

/// Format a BCD-encoded version (e.g. XAP/QMK versions) as `major.minor.patch`.
/// The 8 hex digits are grouped 2/2/4 and each group is read as a decimal
/// number. If any nibble is not a decimal digit, fall back to `0x`-prefixed,
/// zero-padded uppercase hex.
pub fn format_bcd_version(value: u32) -> String {
    let hex = format!("{value:08X}");

    if !hex.bytes().all(|b| b.is_ascii_digit()) {
        return format!("0x{hex}");
    }

    let major: u32 = hex[0..2].parse().unwrap();
    let minor: u32 = hex[2..4].parse().unwrap();
    let patch: u32 = hex[4..8].parse().unwrap();
    format!("{major}.{minor}.{patch}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn formats_bcd_encoded_xap_and_qmk_versions_as_dotted_versions() {
        assert_eq!(format_bcd_version(0x03020115), "3.2.115");
        assert_eq!(format_bcd_version(0x00030000), "0.3.0");
        assert_eq!(format_bcd_version(0x00000001), "0.0.1");
    }

    #[test]
    fn falls_back_to_hex_for_invalid_bcd_values() {
        assert_eq!(format_bcd_version(0x03020A15), "0x03020A15");
    }
}
