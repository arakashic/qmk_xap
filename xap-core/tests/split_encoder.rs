//! End-to-end check against a real config blob captured from the
//! `xap_sim/tzarc_djinn_rev2` split simulator (left encoder in `encoder.rotary`,
//! right encoder in `split.encoder.right.rotary`). Proves the actual `Config`
//! deserialization + count path matches the firmware's `NUM_ENCODERS = 2`.

use xap_core::aggregation::config::Config;

#[test]
fn djinn_rev2_blob_reports_both_encoders() {
    let json = include_str!("fixtures/djinn_rev2_blob.json");
    let config: Config = serde_json::from_str(json).expect("real blob deserializes into Config");

    assert!(config.split.enabled, "djinn rev2 is a split board");
    assert_eq!(config.encoder.rotary.len(), 1, "one left encoder");
    assert_eq!(
        config
            .split
            .encoder
            .right
            .as_ref()
            .map(|r| r.rotary.len()),
        Some(1),
        "one explicit right encoder",
    );
    assert_eq!(
        config.compute_encoder_count(),
        2,
        "left + right == firmware NUM_ENCODERS",
    );
}
