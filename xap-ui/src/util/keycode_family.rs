//! Ported from src/utils/keycodeFamily.ts. Family class names tint keys in the
//! keymap and picker; the strings are referenced by CSS, keep them exact.

use xap_specs::constants::keycode::KeyCode;
use xap_specs::constants::keycode_encoder::KeycodeTemplate;

// QMK modifier mask table (qmk_firmware_ref/quantum/modifiers.h).
// Right-side flag is bit 4; bits 0-3 are CTRL/SHIFT/ALT/GUI.
// Order matters: `mod_name` returns the first match (TS object insertion
// order), e.g. LCSA over MEH for 0x07.
pub const MOD_MASK: &[(&str, u8)] = &[
    ("LCTL", 0x01),
    ("LSFT", 0x02),
    ("LALT", 0x04),
    ("LGUI", 0x08),
    ("RCTL", 0x11),
    ("RSFT", 0x12),
    ("RALT", 0x14),
    ("RGUI", 0x18),
    ("LCS", 0x03),
    ("LCA", 0x05),
    ("LCG", 0x09),
    ("LSA", 0x06),
    ("LSG", 0x0a),
    ("LAG", 0x0c),
    ("LCAG", 0x0d),
    ("LCSG", 0x0b),
    ("LSAG", 0x0e),
    ("LCSA", 0x07),
    ("LCSAG", 0x0f),
    ("MEH", 0x07),
    ("HYPR", 0x0f),
    ("RCS", 0x13),
    ("RCA", 0x15),
    ("RCG", 0x19),
    ("RSA", 0x16),
    ("RSG", 0x1a),
    ("RAG", 0x1c),
    ("RCAG", 0x1d),
    ("RCSG", 0x1b),
    ("RSAG", 0x1e),
    ("RCSA", 0x17),
    ("RCSAG", 0x1f),
];

/// Look up a modifier mask by its mnemonic (TS `MOD_MASK[name]`). Used by the
/// keycode picker to expand MT / QK_MODS subgroups.
pub fn mod_mask_for(name: &str) -> Option<u8> {
    MOD_MASK
        .iter()
        .find(|(n, _)| *n == name)
        .map(|(_, value)| *value)
}

pub fn mod_name(mask: u8) -> String {
    for (name, value) in MOD_MASK {
        if *value == mask & 0x1f {
            return (*name).to_string();
        }
    }
    format!("0x{mask:X}")
}

pub fn template_family_class(template: &KeycodeTemplate) -> &'static str {
    match template {
        KeycodeTemplate::LayerOp { .. } | KeycodeTemplate::LayerTap { .. } => "family-layer",
        KeycodeTemplate::ModTap { .. } | KeycodeTemplate::OneShotMod { .. } => "family-modtap",
        KeycodeTemplate::LayerMod { .. } => "family-layermod",
        KeycodeTemplate::Modified { .. } => "family-modified",
    }
}

pub fn keymap_key_family_class(code: &KeyCode) -> &'static str {
    code.template.as_ref().map_or("", template_family_class)
}

pub fn tab_family_class(color: Option<&str>) -> &'static str {
    match color {
        Some("blue") => "family-layer",
        Some("purple") => "family-modtap",
        Some("cyan") => "family-layermod",
        Some("orange") => "family-modified",
        _ => "",
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use xap_specs::constants::keycode::KeyCode;
    use xap_specs::constants::keycode_encoder::{KeycodeTemplate, LayerOp};

    #[test]
    fn mod_name_resolves_masks_in_table_order_with_hex_fallback() {
        assert_eq!(mod_name(0x12), "RSFT");
        // 0x07 is both LCSA and MEH; LCSA wins by table order (TS object
        // insertion order).
        assert_eq!(mod_name(0x07), "LCSA");
        // Only the low 5 bits are matched; 0x20 & 0x1f == 0 has no entry.
        assert_eq!(mod_name(0x20), "0x20");
    }

    #[test]
    fn template_family_class_maps_template_kinds_to_tint_classes() {
        assert_eq!(
            template_family_class(&KeycodeTemplate::LayerOp { op: LayerOp::MO, layer: 1 }),
            "family-layer"
        );
        assert_eq!(
            template_family_class(&KeycodeTemplate::LayerTap { layer: 2, tap_kc: Some(0x04) }),
            "family-layer"
        );
        assert_eq!(
            template_family_class(&KeycodeTemplate::OneShotMod { mod_mask: 0x02 }),
            "family-modtap"
        );
        assert_eq!(
            template_family_class(&KeycodeTemplate::LayerMod { layer: 3, mod_mask: Some(0x03) }),
            "family-layermod"
        );
        assert_eq!(
            template_family_class(&KeycodeTemplate::Modified { mod_mask: 0x02, base_kc: Some(0x04) }),
            "family-modified"
        );
    }

    #[test]
    fn keymap_key_family_class_falls_back_to_empty_without_template() {
        let templated = KeyCode {
            template: Some(KeycodeTemplate::ModTap { mod_mask: 0x02, tap_kc: Some(0x04) }),
            ..Default::default()
        };
        assert_eq!(keymap_key_family_class(&templated), "family-modtap");
        assert_eq!(keymap_key_family_class(&KeyCode::default()), "");
    }

    #[test]
    fn tab_family_class_maps_picker_tab_colors() {
        assert_eq!(tab_family_class(Some("blue")), "family-layer");
        assert_eq!(tab_family_class(Some("purple")), "family-modtap");
        assert_eq!(tab_family_class(Some("cyan")), "family-layermod");
        assert_eq!(tab_family_class(Some("orange")), "family-modified");
        assert_eq!(tab_family_class(Some("green")), "");
        assert_eq!(tab_family_class(None), "");
    }
}
