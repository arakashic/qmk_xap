use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use specta::Type;

use crate::aggregation::Point2D;

#[derive(Clone, Debug, Serialize, Deserialize, Type)]
pub struct Config {
    pub layouts: HashMap<String, Layout>,
    pub matrix_size: Point2D,
    #[serde(default)]
    pub encoder: EncoderInfo,
    #[serde(default)]
    pub split: SplitInfo,
    /// Total encoder count (`NUM_ENCODERS`), computed from `encoder` + `split`
    /// via [`Config::compute_encoder_count`]. The blob never carries this field
    /// (so it defaults to 0 on deserialize); [`query_config`] sets it once after
    /// deserialization and it is serialized out so every consumer (both backends
    /// and the frontend) shares one authoritative number.
    ///
    /// [`query_config`]: crate::session::query_config
    #[serde(default)]
    pub encoder_count: u8,
}

impl Config {
    /// Reconstruct the firmware's `NUM_ENCODERS` from the config blob. The blob
    /// never carries the right half's mirror, so we replicate QMK's own logic
    /// (`quantum/encoder.h` and `info.py::_find_invalid_encoder_index`):
    /// the top-level `encoder` block is always the left/primary half; on a split
    /// board the right half is `split.encoder.right` when present, otherwise it
    /// mirrors the left. Encoder indices are left-first then right, contiguous.
    pub fn compute_encoder_count(&self) -> u8 {
        let left = self.encoder.rotary.len();
        let total = if self.split.enabled {
            let right = match &self.split.encoder.right {
                Some(right) => right.rotary.len(),
                None => left,
            };
            left + right
        } else {
            left
        };
        u8::try_from(total).unwrap_or(u8::MAX)
    }
}

/// Mirrors the parts of QMK's `split` block we need. Only `split.encoder.right`
/// is modelled; the rest of the split config is irrelevant to the client.
#[derive(Clone, Debug, Default, Serialize, Deserialize, Type)]
pub struct SplitInfo {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub encoder: SplitEncoderInfo,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, Type)]
pub struct SplitEncoderInfo {
    /// `None` means the blob carried no right block, so the firmware mirrors the
    /// left half. `Some` (including an empty `rotary`) is taken as authoritative.
    #[serde(default)]
    pub right: Option<EncoderInfo>,
}

/// Mirrors QMK's `encoder` block in info.json (see
/// `qmk_firmware_ref/data/schemas/keyboard.jsonschema`). `rotary.len()` is the
/// authoritative encoder count for boards that ship the field; `enabled`
/// reflects the build-time flag separately.
#[derive(Clone, Debug, Default, Serialize, Deserialize, Type)]
pub struct EncoderInfo {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub rotary: Vec<RotaryEncoder>,
}

#[derive(Clone, Debug, Serialize, Deserialize, Type)]
pub struct RotaryEncoder {
    pub pin_a: String,
    pub pin_b: String,
    #[serde(default)]
    pub resolution: Option<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct Layout {
    #[serde(skip)]
    pub name: String,
    pub layout: Vec<LayoutEntry>,
}

impl Layout {
    pub fn find(&self, position: Point2D) -> Option<&LayoutEntry> {
        self.layout.iter().find(|entry| entry.matrix == position)
    }
}

#[derive(Debug, Default, Clone, Serialize, Deserialize, Type)]
pub struct LayoutEntry {
    pub matrix: Point2D,
    pub x: f64,
    pub y: f64,
    #[serde(default = "default_wh")]
    pub w: f64,
    #[serde(default = "default_wh")]
    pub h: f64,
    #[serde(default)]
    pub r: f64,
    #[serde(default)]
    pub rx: f64,
    #[serde(default)]
    pub ry: f64,
}

fn default_wh() -> f64 {
    1.0
}

#[cfg(test)]
mod test {
    use crate::aggregation::config::Config;

    #[test]
    fn deserialize() {
        let input = r#"{
"layouts" : {
    "LAYOUT_75": {
        "layout": [
            {"matrix": [5, 2], "x": 0, "y": 0},
            {"matrix": [5, 3], "x": 1.25, "y": 0},
            {"matrix": [5, 4], "x": 2.25, "y": 0},
            {"matrix": [5, 5], "x": 3.25, "y": 0},
            {"matrix": [5, 6], "x": 4.25, "y": 0},
            {"matrix": [5, 7], "x": 5.5, "y": 0},
            {"matrix": [5, 8], "x": 6.5, "y": 0},

            {"matrix": [11, 1], "x": 8.5, "y": 0},
            {"matrix": [11, 2], "x": 9.5, "y": 0},
            {"matrix": [11, 3], "x": 10.75, "y": 0},
            {"matrix": [11, 4], "x": 11.75, "y": 0},
            {"matrix": [11, 5], "x": 12.75, "y": 0},
            {"matrix": [11, 6], "x": 13.75, "y": 0},
            {"matrix": [11, 7], "x": 15, "y": 0},

            {"matrix": [0, 2], "x": 0, "y": 1.25},
            {"matrix": [0, 3], "x": 1, "y": 1.25},
            {"matrix": [0, 4], "x": 2, "y": 1.25},
            {"matrix": [0, 5], "x": 3, "y": 1.25},
            {"matrix": [0, 6], "x": 4, "y": 1.25},
            {"matrix": [0, 7], "x": 5, "y": 1.25},
            {"matrix": [0, 8], "x": 6, "y": 1.25},

            {"matrix": [6, 0], "x": 8, "y": 1.25},
            {"matrix": [6, 1], "x": 9, "y": 1.25},
            {"matrix": [6, 2], "x": 10, "y": 1.25},
            {"matrix": [6, 3], "x": 11, "y": 1.25},
            {"matrix": [6, 4], "x": 12, "y": 1.25},
            {"matrix": [6, 5], "x": 13, "y": 1.25},
            {"matrix": [6, 6], "x": 14, "y": 1.25},
            {"matrix": [6, 7], "x": 15, "y": 1.25},

            {"matrix": [1, 2], "x": 0, "y": 2.25, "w": 1.5},
            {"matrix": [1, 3], "x": 1.5, "y": 2.25},
            {"matrix": [1, 4], "x": 2.5, "y": 2.25},
            {"matrix": [1, 5], "x": 3.5, "y": 2.25},
            {"matrix": [1, 6], "x": 4.5, "y": 2.25},
            {"matrix": [1, 7], "x": 5.5, "y": 2.25},

            {"matrix": [7, 0], "x": 7.5, "y": 2.25},
            {"matrix": [7, 1], "x": 8.5, "y": 2.25},
            {"matrix": [7, 2], "x": 9.5, "y": 2.25},
            {"matrix": [7, 3], "x": 10.5, "y": 2.25},
            {"matrix": [7, 4], "x": 11.5, "y": 2.25},
            {"matrix": [7, 5], "x": 12.5, "y": 2.25},
            {"matrix": [7, 6], "x": 13.5, "y": 2.25},
            {"matrix": [7, 7], "x": 14.5, "y": 2.25, "w": 1.5},

            {"matrix": [2, 2], "x": 0, "y": 3.25, "w": 1.75},
            {"matrix": [2, 3], "x": 1.75, "y": 3.25},
            {"matrix": [2, 4], "x": 2.75, "y": 3.25},
            {"matrix": [2, 5], "x": 3.75, "y": 3.25},
            {"matrix": [2, 6], "x": 4.75, "y": 3.25},
            {"matrix": [2, 7], "x": 5.75, "y": 3.25},

            {"matrix": [8, 0], "x": 7.75, "y": 3.25},
            {"matrix": [8, 1], "x": 8.75, "y": 3.25},
            {"matrix": [8, 2], "x": 9.75, "y": 3.25},
            {"matrix": [8, 3], "x": 10.75, "y": 3.25},
            {"matrix": [8, 4], "x": 11.75, "y": 3.25},
            {"matrix": [8, 5], "x": 12.75, "y": 3.25},
            {"matrix": [8, 7], "x": 13.75, "y": 3.25, "w": 2.25},

            {"matrix": [3, 2], "x": 0, "y": 4.25, "w": 2.25},
            {"matrix": [3, 4], "x": 2.25, "y": 4.25},
            {"matrix": [3, 5], "x": 3.25, "y": 4.25},
            {"matrix": [3, 6], "x": 4.25, "y": 4.25},
            {"matrix": [3, 7], "x": 5.25, "y": 4.25},
            {"matrix": [3, 8], "x": 6.25, "y": 4.25},

            {"matrix": [9, 0], "x": 8.25, "y": 4.25},
            {"matrix": [9, 1], "x": 9.25, "y": 4.25},
            {"matrix": [9, 2], "x": 10.25, "y": 4.25},
            {"matrix": [9, 3], "x": 11.25, "y": 4.25},
            {"matrix": [9, 4], "x": 12.25, "y": 4.25},
            {"matrix": [9, 6], "x": 13.25, "y": 4.25, "w": 1.75},
            {"matrix": [9, 7], "x": 15, "y": 4.25},

            {"matrix": [4, 2], "x": 0, "y": 5.25, "w": 1.25},
            {"matrix": [4, 3], "x": 1.25, "y": 5.25, "w": 1.25},
            {"matrix": [4, 4], "x": 2.5, "y": 5.25, "w": 1.25},
            {"matrix": [4, 5], "x": 3.75, "y": 5.25, "w": 1.25},
            {"matrix": [4, 6], "x": 5, "y": 5.25},
            {"matrix": [4, 7], "x": 6, "y": 5.25, "w": 1.25},

            {"matrix": [10, 0], "x": 8.25, "y": 5.25, "w": 1.25},
            {"matrix": [10, 1], "x": 9.5, "y": 5.25, "w": 1.5},
            {"matrix": [10, 2], "x": 11, "y": 5.25},
            {"matrix": [10, 3], "x": 12, "y": 5.25},
            {"matrix": [10, 4], "x": 13, "y": 5.25},
            {"matrix": [10, 6], "x": 14, "y": 5.25},
            {"matrix": [10, 7], "x": 15, "y": 5.25}
        ]
    },
    "LAYOUT_75_iso": {
        "layout": [
            {"matrix": [5, 2], "x": 0, "y": 0},
            {"matrix": [5, 3], "x": 1.25, "y": 0},
            {"matrix": [5, 4], "x": 2.25, "y": 0},
            {"matrix": [5, 5], "x": 3.25, "y": 0},
            {"matrix": [5, 6], "x": 4.25, "y": 0},
            {"matrix": [5, 7], "x": 5.5, "y": 0},
            {"matrix": [5, 8], "x": 6.5, "y": 0},

            {"matrix": [11, 1], "x": 8.5, "y": 0},
            {"matrix": [11, 2], "x": 9.5, "y": 0},
            {"matrix": [11, 3], "x": 10.75, "y": 0},
            {"matrix": [11, 4], "x": 11.75, "y": 0},
            {"matrix": [11, 5], "x": 12.75, "y": 0},
            {"matrix": [11, 6], "x": 13.75, "y": 0},
            {"matrix": [11, 7], "x": 15, "y": 0},

            {"matrix": [0, 2], "x": 0, "y": 1.25},
            {"matrix": [0, 3], "x": 1, "y": 1.25},
            {"matrix": [0, 4], "x": 2, "y": 1.25},
            {"matrix": [0, 5], "x": 3, "y": 1.25},
            {"matrix": [0, 6], "x": 4, "y": 1.25},
            {"matrix": [0, 7], "x": 5, "y": 1.25},
            {"matrix": [0, 8], "x": 6, "y": 1.25},

            {"matrix": [6, 0], "x": 8, "y": 1.25},
            {"matrix": [6, 1], "x": 9, "y": 1.25},
            {"matrix": [6, 2], "x": 10, "y": 1.25},
            {"matrix": [6, 3], "x": 11, "y": 1.25},
            {"matrix": [6, 4], "x": 12, "y": 1.25},
            {"matrix": [6, 5], "x": 13, "y": 1.25},
            {"matrix": [6, 6], "x": 14, "y": 1.25},
            {"matrix": [6, 7], "x": 15, "y": 1.25},

            {"matrix": [1, 2], "x": 0, "y": 2.25, "w": 1.5},
            {"matrix": [1, 3], "x": 1.5, "y": 2.25},
            {"matrix": [1, 4], "x": 2.5, "y": 2.25},
            {"matrix": [1, 5], "x": 3.5, "y": 2.25},
            {"matrix": [1, 6], "x": 4.5, "y": 2.25},
            {"matrix": [1, 7], "x": 5.5, "y": 2.25},

            {"matrix": [7, 0], "x": 7.5, "y": 2.25},
            {"matrix": [7, 1], "x": 8.5, "y": 2.25},
            {"matrix": [7, 2], "x": 9.5, "y": 2.25},
            {"matrix": [7, 3], "x": 10.5, "y": 2.25},
            {"matrix": [7, 4], "x": 11.5, "y": 2.25},
            {"matrix": [7, 5], "x": 12.5, "y": 2.25},
            {"matrix": [7, 6], "x": 13.5, "y": 2.25},

            {"matrix": [2, 2], "x": 0, "y": 3.25, "w": 1.75},
            {"matrix": [2, 3], "x": 1.75, "y": 3.25},
            {"matrix": [2, 4], "x": 2.75, "y": 3.25},
            {"matrix": [2, 5], "x": 3.75, "y": 3.25},
            {"matrix": [2, 6], "x": 4.75, "y": 3.25},
            {"matrix": [2, 7], "x": 5.75, "y": 3.25},

            {"matrix": [8, 0], "x": 7.75, "y": 3.25},
            {"matrix": [8, 1], "x": 8.75, "y": 3.25},
            {"matrix": [8, 2], "x": 9.75, "y": 3.25},
            {"matrix": [8, 3], "x": 10.75, "y": 3.25},
            {"matrix": [8, 4], "x": 11.75, "y": 3.25},
            {"matrix": [8, 5], "x": 12.75, "y": 3.25},
            {"matrix": [8, 6], "x": 13.75, "y": 3.25},
            {"matrix": [7, 7], "x": 14.75, "y": 2.25, "w": 1.25, "h": 2},

            {"matrix": [3, 2], "x": 0, "y": 4.25, "w": 1.25},
            {"matrix": [3, 3], "x": 1.25, "y": 4.25},
            {"matrix": [3, 4], "x": 2.25, "y": 4.25},
            {"matrix": [3, 5], "x": 3.25, "y": 4.25},
            {"matrix": [3, 6], "x": 4.25, "y": 4.25},
            {"matrix": [3, 7], "x": 5.25, "y": 4.25},
            {"matrix": [3, 8], "x": 6.25, "y": 4.25},

            {"matrix": [9, 0], "x": 8.25, "y": 4.25},
            {"matrix": [9, 1], "x": 9.25, "y": 4.25},
            {"matrix": [9, 2], "x": 10.25, "y": 4.25},
            {"matrix": [9, 3], "x": 11.25, "y": 4.25},
            {"matrix": [9, 4], "x": 12.25, "y": 4.25},
            {"matrix": [9, 6], "x": 13.25, "y": 4.25, "w": 1.75},
            {"matrix": [9, 7], "x": 15, "y": 4.25},

            {"matrix": [4, 2], "x": 0, "y": 5.25, "w": 1.25},
            {"matrix": [4, 3], "x": 1.25, "y": 5.25, "w": 1.25},
            {"matrix": [4, 4], "x": 2.5, "y": 5.25, "w": 1.25},
            {"matrix": [4, 5], "x": 3.75, "y": 5.25, "w": 1.25},
            {"matrix": [4, 6], "x": 5, "y": 5.25},
            {"matrix": [4, 7], "x": 6, "y": 5.25, "w": 1.25},

            {"matrix": [10, 0], "x": 8.25, "y": 5.25, "w": 1.25},
            {"matrix": [10, 1], "x": 9.5, "y": 5.25, "w": 1.5},
            {"matrix": [10, 2], "x": 11, "y": 5.25},
            {"matrix": [10, 3], "x": 12, "y": 5.25},
            {"matrix": [10, 4], "x": 13, "y": 5.25},
            {"matrix": [10, 6], "x": 14, "y": 5.25},
            {"matrix": [10, 7], "x": 15, "y": 5.25}
        ]
    },
    "LAYOUT_75_iso_with_macro": {
        "layout": [
            {"matrix": [5, 0], "x": 0, "y": 0},
            {"matrix": [5, 2], "x": 2.25, "y": 0},
            {"matrix": [5, 3], "x": 3.5, "y": 0},
            {"matrix": [5, 4], "x": 4.5, "y": 0},
            {"matrix": [5, 5], "x": 5.5, "y": 0},
            {"matrix": [5, 6], "x": 6.5, "y": 0},
            {"matrix": [5, 7], "x": 7.75, "y": 0},
            {"matrix": [5, 8], "x": 8.75, "y": 0},

            {"matrix": [11, 1], "x": 10.75, "y": 0},
            {"matrix": [11, 2], "x": 11.75, "y": 0},
            {"matrix": [11, 3], "x": 13, "y": 0},
            {"matrix": [11, 4], "x": 14, "y": 0},
            {"matrix": [11, 5], "x": 15, "y": 0},
            {"matrix": [11, 6], "x": 16, "y": 0},
            {"matrix": [11, 7], "x": 17.25, "y": 0},

            {"matrix": [0, 0], "x": 0, "y": 1.25},
            {"matrix": [0, 1], "x": 1, "y": 1.25},
            {"matrix": [0, 2], "x": 2.25, "y": 1.25},
            {"matrix": [0, 3], "x": 3.25, "y": 1.25},
            {"matrix": [0, 4], "x": 4.25, "y": 1.25},
            {"matrix": [0, 5], "x": 5.25, "y": 1.25},
            {"matrix": [0, 6], "x": 6.25, "y": 1.25},
            {"matrix": [0, 7], "x": 7.25, "y": 1.25},
            {"matrix": [0, 8], "x": 8.25, "y": 1.25},

            {"matrix": [6, 0], "x": 10.25, "y": 1.25},
            {"matrix": [6, 1], "x": 11.25, "y": 1.25},
            {"matrix": [6, 2], "x": 12.25, "y": 1.25},
            {"matrix": [6, 3], "x": 13.25, "y": 1.25},
            {"matrix": [6, 4], "x": 14.25, "y": 1.25},
            {"matrix": [6, 5], "x": 15.25, "y": 1.25},
            {"matrix": [6, 6], "x": 16.25, "y": 1.25},
            {"matrix": [6, 7], "x": 17.25, "y": 1.25},

            {"matrix": [1, 0], "x": 0, "y": 2.25},
            {"matrix": [1, 1], "x": 1, "y": 2.25},
            {"matrix": [1, 2], "x": 2.25, "y": 2.25, "w": 1.5},
            {"matrix": [1, 3], "x": 3.75, "y": 2.25},
            {"matrix": [1, 4], "x": 4.75, "y": 2.25},
            {"matrix": [1, 5], "x": 5.75, "y": 2.25},
            {"matrix": [1, 6], "x": 6.75, "y": 2.25},
            {"matrix": [1, 7], "x": 7.75, "y": 2.25},

            {"matrix": [7, 0], "x": 9.75, "y": 2.25},
            {"matrix": [7, 1], "x": 10.75, "y": 2.25},
            {"matrix": [7, 2], "x": 11.75, "y": 2.25},
            {"matrix": [7, 3], "x": 12.75, "y": 2.25},
            {"matrix": [7, 4], "x": 13.75, "y": 2.25},
            {"matrix": [7, 5], "x": 14.75, "y": 2.25},
            {"matrix": [7, 6], "x": 15.75, "y": 2.25},

            {"matrix": [2, 0], "x": 0, "y": 3.25},
            {"matrix": [2, 1], "x": 1, "y": 3.25},
            {"matrix": [2, 2], "x": 2.25, "y": 3.25, "w": 1.75},
            {"matrix": [2, 3], "x": 4, "y": 3.25},
            {"matrix": [2, 4], "x": 5, "y": 3.25},
            {"matrix": [2, 5], "x": 6, "y": 3.25},
            {"matrix": [2, 6], "x": 7, "y": 3.25},
            {"matrix": [2, 7], "x": 8, "y": 3.25},

            {"matrix": [8, 0], "x": 10, "y": 3.25},
            {"matrix": [8, 1], "x": 11, "y": 3.25},
            {"matrix": [8, 2], "x": 12, "y": 3.25},
            {"matrix": [8, 3], "x": 13, "y": 3.25},
            {"matrix": [8, 4], "x": 14, "y": 3.25},
            {"matrix": [8, 5], "x": 15, "y": 3.25},
            {"matrix": [8, 6], "x": 16, "y": 3.25},
            {"matrix": [7, 7], "x": 17, "y": 2.25, "w": 1.25, "h": 2},

            {"matrix": [3, 0], "x": 0, "y": 4.25},
            {"matrix": [3, 1], "x": 1, "y": 4.25},
            {"matrix": [3, 2], "x": 2.25, "y": 4.25, "w": 1.25},
            {"matrix": [3, 3], "x": 3.5, "y": 4.25},
            {"matrix": [3, 4], "x": 4.5, "y": 4.25},
            {"matrix": [3, 5], "x": 5.5, "y": 4.25},
            {"matrix": [3, 6], "x": 6.5, "y": 4.25},
            {"matrix": [3, 7], "x": 7.5, "y": 4.25},
            {"matrix": [3, 8], "x": 8.5, "y": 4.25},

            {"matrix": [9, 0], "x": 10.5, "y": 4.25},
            {"matrix": [9, 1], "x": 11.5, "y": 4.25},
            {"matrix": [9, 2], "x": 12.5, "y": 4.25},
            {"matrix": [9, 3], "x": 13.5, "y": 4.25},
            {"matrix": [9, 4], "x": 14.5, "y": 4.25},
            {"matrix": [9, 6], "x": 15.5, "y": 4.25, "w": 1.75},
            {"matrix": [9, 7], "x": 17.25, "y": 4.25},

            {"matrix": [4, 0], "x": 0, "y": 5.25},
            {"matrix": [4, 1], "x": 1, "y": 5.25},
            {"matrix": [4, 2], "x": 2.25, "y": 5.25, "w": 1.25},
            {"matrix": [4, 3], "x": 3.5, "y": 5.25, "w": 1.25},
            {"matrix": [4, 4], "x": 4.75, "y": 5.25, "w": 1.25},
            {"matrix": [4, 5], "x": 6, "y": 5.25, "w": 1.25},
            {"matrix": [4, 6], "x": 7.25, "y": 5.25},
            {"matrix": [4, 7], "x": 8.25, "y": 5.25, "w": 1.25},

            {"matrix": [10, 0], "x": 10.5, "y": 5.25, "w": 1.25},
            {"matrix": [10, 1], "x": 11.75, "y": 5.25, "w": 1.5},
            {"matrix": [10, 2], "x": 13.25, "y": 5.25},
            {"matrix": [10, 3], "x": 14.25, "y": 5.25},
            {"matrix": [10, 4], "x": 15.25, "y": 5.25},
            {"matrix": [10, 6], "x": 16.25, "y": 5.25},
            {"matrix": [10, 7], "x": 17.25, "y": 5.25}
        ]
    },
    "LAYOUT_75_with_macro": {
        "layout": [
            {"matrix": [5, 0], "x": 0, "y": 0},
            {"matrix": [5, 2], "x": 2.25, "y": 0},
            {"matrix": [5, 3], "x": 3.5, "y": 0},
            {"matrix": [5, 4], "x": 4.5, "y": 0},
            {"matrix": [5, 5], "x": 5.5, "y": 0},
            {"matrix": [5, 6], "x": 6.5, "y": 0},
            {"matrix": [5, 7], "x": 7.75, "y": 0},
            {"matrix": [5, 8], "x": 8.75, "y": 0},

            {"matrix": [11, 1], "x": 10.75, "y": 0},
            {"matrix": [11, 2], "x": 11.75, "y": 0},
            {"matrix": [11, 3], "x": 13, "y": 0},
            {"matrix": [11, 4], "x": 14, "y": 0},
            {"matrix": [11, 5], "x": 15, "y": 0},
            {"matrix": [11, 6], "x": 16, "y": 0},
            {"matrix": [11, 7], "x": 17.25, "y": 0},

            {"matrix": [0, 0], "x": 0, "y": 1.25},
            {"matrix": [0, 1], "x": 1, "y": 1.25},
            {"matrix": [0, 2], "x": 2.25, "y": 1.25},
            {"matrix": [0, 3], "x": 3.25, "y": 1.25},
            {"matrix": [0, 4], "x": 4.25, "y": 1.25},
            {"matrix": [0, 5], "x": 5.25, "y": 1.25},
            {"matrix": [0, 6], "x": 6.25, "y": 1.25},
            {"matrix": [0, 7], "x": 7.25, "y": 1.25},
            {"matrix": [0, 8], "x": 8.25, "y": 1.25},

            {"matrix": [6, 0], "x": 10.25, "y": 1.25},
            {"matrix": [6, 1], "x": 11.25, "y": 1.25},
            {"matrix": [6, 2], "x": 12.25, "y": 1.25},
            {"matrix": [6, 3], "x": 13.25, "y": 1.25},
            {"matrix": [6, 4], "x": 14.25, "y": 1.25},
            {"matrix": [6, 5], "x": 15.25, "y": 1.25},
            {"matrix": [6, 6], "x": 16.25, "y": 1.25},
            {"matrix": [6, 7], "x": 17.25, "y": 1.25},

            {"matrix": [1, 0], "x": 0, "y": 2.25},
            {"matrix": [1, 1], "x": 1, "y": 2.25},
            {"matrix": [1, 2], "x": 2.25, "y": 2.25, "w": 1.5},
            {"matrix": [1, 3], "x": 3.75, "y": 2.25},
            {"matrix": [1, 4], "x": 4.75, "y": 2.25},
            {"matrix": [1, 5], "x": 5.75, "y": 2.25},
            {"matrix": [1, 6], "x": 6.75, "y": 2.25},
            {"matrix": [1, 7], "x": 7.75, "y": 2.25},

            {"matrix": [7, 0], "x": 9.75, "y": 2.25},
            {"matrix": [7, 1], "x": 10.75, "y": 2.25},
            {"matrix": [7, 2], "x": 11.75, "y": 2.25},
            {"matrix": [7, 3], "x": 12.75, "y": 2.25},
            {"matrix": [7, 4], "x": 13.75, "y": 2.25},
            {"matrix": [7, 5], "x": 14.75, "y": 2.25},
            {"matrix": [7, 6], "x": 15.75, "y": 2.25},
            {"matrix": [7, 7], "x": 16.75, "y": 2.25, "w": 1.5},

            {"matrix": [2, 0], "x": 0, "y": 3.25},
            {"matrix": [2, 1], "x": 1, "y": 3.25},
            {"matrix": [2, 2], "x": 2.25, "y": 3.25, "w": 1.75},
            {"matrix": [2, 3], "x": 4, "y": 3.25},
            {"matrix": [2, 4], "x": 5, "y": 3.25},
            {"matrix": [2, 5], "x": 6, "y": 3.25},
            {"matrix": [2, 6], "x": 7, "y": 3.25},
            {"matrix": [2, 7], "x": 8, "y": 3.25},

            {"matrix": [8, 0], "x": 10, "y": 3.25},
            {"matrix": [8, 1], "x": 11, "y": 3.25},
            {"matrix": [8, 2], "x": 12, "y": 3.25},
            {"matrix": [8, 3], "x": 13, "y": 3.25},
            {"matrix": [8, 4], "x": 14, "y": 3.25},
            {"matrix": [8, 5], "x": 15, "y": 3.25},
            {"matrix": [8, 7], "x": 16, "y": 3.25, "w": 2.25},

            {"matrix": [3, 0], "x": 0, "y": 4.25},
            {"matrix": [3, 1], "x": 1, "y": 4.25},
            {"matrix": [3, 2], "x": 2.25, "y": 4.25, "w": 2.25},
            {"matrix": [3, 4], "x": 4.5, "y": 4.25},
            {"matrix": [3, 5], "x": 5.5, "y": 4.25},
            {"matrix": [3, 6], "x": 6.5, "y": 4.25},
            {"matrix": [3, 7], "x": 7.5, "y": 4.25},
            {"matrix": [3, 8], "x": 8.5, "y": 4.25},

            {"matrix": [9, 0], "x": 10.5, "y": 4.25},
            {"matrix": [9, 1], "x": 11.5, "y": 4.25},
            {"matrix": [9, 2], "x": 12.5, "y": 4.25},
            {"matrix": [9, 3], "x": 13.5, "y": 4.25},
            {"matrix": [9, 4], "x": 14.5, "y": 4.25},
            {"matrix": [9, 6], "x": 15.5, "y": 4.25, "w": 1.75},
            {"matrix": [9, 7], "x": 17.25, "y": 4.25},

            {"matrix": [4, 0], "x": 0, "y": 5.25},
            {"matrix": [4, 1], "x": 1, "y": 5.25},
            {"matrix": [4, 2], "x": 2.25, "y": 5.25, "w": 1.25},
            {"matrix": [4, 3], "x": 3.5, "y": 5.25, "w": 1.25},
            {"matrix": [4, 4], "x": 4.75, "y": 5.25, "w": 1.25},
            {"matrix": [4, 5], "x": 6, "y": 5.25, "w": 1.25},
            {"matrix": [4, 6], "x": 7.25, "y": 5.25},
            {"matrix": [4, 7], "x": 8.25, "y": 5.25, "w": 1.25},

            {"matrix": [10, 0], "x": 10.5, "y": 5.25, "w": 1.25},
            {"matrix": [10, 1], "x": 11.75, "y": 5.25, "w": 1.5},
            {"matrix": [10, 2], "x": 13.25, "y": 5.25},
            {"matrix": [10, 3], "x": 14.25, "y": 5.25},
            {"matrix": [10, 4], "x": 15.25, "y": 5.25},
            {"matrix": [10, 6], "x": 16.25, "y": 5.25},
            {"matrix": [10, 7], "x": 17.25, "y": 5.25}
        ]
    },
    "LAYOUT_all": {
        "layout": [
            {"matrix": [5, 0], "x": 0, "y": 0},
            {"matrix": [5, 2], "x": 2.25, "y": 0},
            {"matrix": [5, 3], "x": 3.5, "y": 0},
            {"matrix": [5, 4], "x": 4.5, "y": 0},
            {"matrix": [5, 5], "x": 5.5, "y": 0},
            {"matrix": [5, 6], "x": 6.5, "y": 0},
            {"matrix": [5, 7], "x": 7.75, "y": 0},
            {"matrix": [5, 8], "x": 8.75, "y": 0},

            {"matrix": [11, 1], "x": 10.75, "y": 0},
            {"matrix": [11, 2], "x": 11.75, "y": 0},
            {"matrix": [11, 3], "x": 13, "y": 0},
            {"matrix": [11, 4], "x": 14, "y": 0},
            {"matrix": [11, 5], "x": 15, "y": 0},
            {"matrix": [11, 6], "x": 16, "y": 0},
            {"matrix": [11, 7], "x": 17.25, "y": 0},
            {"matrix": [11, 8], "x": 18.25, "y": 0},

            {"matrix": [0, 0], "x": 0, "y": 1.25},
            {"matrix": [0, 1], "x": 1, "y": 1.25},
            {"matrix": [0, 2], "x": 2.25, "y": 1.25},
            {"matrix": [0, 3], "x": 3.25, "y": 1.25},
            {"matrix": [0, 4], "x": 4.25, "y": 1.25},
            {"matrix": [0, 5], "x": 5.25, "y": 1.25},
            {"matrix": [0, 6], "x": 6.25, "y": 1.25},
            {"matrix": [0, 7], "x": 7.25, "y": 1.25},
            {"matrix": [0, 8], "x": 8.25, "y": 1.25},

            {"matrix": [6, 0], "x": 10.25, "y": 1.25},
            {"matrix": [6, 1], "x": 11.25, "y": 1.25},
            {"matrix": [6, 2], "x": 12.25, "y": 1.25},
            {"matrix": [6, 3], "x": 13.25, "y": 1.25},
            {"matrix": [6, 4], "x": 14.25, "y": 1.25},
            {"matrix": [6, 5], "x": 15.25, "y": 1.25},
            {"matrix": [6, 6], "x": 16.25, "y": 1.25},
            {"matrix": [6, 7], "x": 17.25, "y": 1.25},
            {"matrix": [6, 8], "x": 18.25, "y": 1.25},

            {"matrix": [1, 0], "x": 0, "y": 2.25},
            {"matrix": [1, 1], "x": 1, "y": 2.25},
            {"matrix": [1, 2], "x": 2.25, "y": 2.25, "w": 1.5},
            {"matrix": [1, 3], "x": 3.75, "y": 2.25},
            {"matrix": [1, 4], "x": 4.75, "y": 2.25},
            {"matrix": [1, 5], "x": 5.75, "y": 2.25},
            {"matrix": [1, 6], "x": 6.75, "y": 2.25},
            {"matrix": [1, 7], "x": 7.75, "y": 2.25},

            {"matrix": [7, 0], "x": 9.75, "y": 2.25},
            {"matrix": [7, 1], "x": 10.75, "y": 2.25},
            {"matrix": [7, 2], "x": 11.75, "y": 2.25},
            {"matrix": [7, 3], "x": 12.75, "y": 2.25},
            {"matrix": [7, 4], "x": 13.75, "y": 2.25},
            {"matrix": [7, 5], "x": 14.75, "y": 2.25},
            {"matrix": [7, 6], "x": 15.75, "y": 2.25},
            {"matrix": [7, 7], "x": 16.75, "y": 2.25, "w": 1.5},
            {"matrix": [7, 8], "x": 18.25, "y": 2.25},

            {"matrix": [2, 0], "x": 0, "y": 3.25},
            {"matrix": [2, 1], "x": 1, "y": 3.25},
            {"matrix": [2, 2], "x": 2.25, "y": 3.25, "w": 1.75},
            {"matrix": [2, 3], "x": 4, "y": 3.25},
            {"matrix": [2, 4], "x": 5, "y": 3.25},
            {"matrix": [2, 5], "x": 6, "y": 3.25},
            {"matrix": [2, 6], "x": 7, "y": 3.25},
            {"matrix": [2, 7], "x": 8, "y": 3.25},

            {"matrix": [8, 0], "x": 10, "y": 3.25},
            {"matrix": [8, 1], "x": 11, "y": 3.25},
            {"matrix": [8, 2], "x": 12, "y": 3.25},
            {"matrix": [8, 3], "x": 13, "y": 3.25},
            {"matrix": [8, 4], "x": 14, "y": 3.25},
            {"matrix": [8, 5], "x": 15, "y": 3.25},
            {"matrix": [8, 6], "x": 16, "y": 3.25},
            {"matrix": [8, 7], "x": 17, "y": 3.25, "w": 1.25},
            {"matrix": [8, 8], "x": 18.25, "y": 3.25},

            {"matrix": [3, 0], "x": 0, "y": 4.25},
            {"matrix": [3, 1], "x": 1, "y": 4.25},
            {"matrix": [3, 2], "x": 2.25, "y": 4.25, "w": 1.25},
            {"matrix": [3, 3], "x": 3.5, "y": 4.25},
            {"matrix": [3, 4], "x": 4.5, "y": 4.25},
            {"matrix": [3, 5], "x": 5.5, "y": 4.25},
            {"matrix": [3, 6], "x": 6.5, "y": 4.25},
            {"matrix": [3, 7], "x": 7.5, "y": 4.25},
            {"matrix": [3, 8], "x": 8.5, "y": 4.25},

            {"matrix": [9, 0], "x": 10.5, "y": 4.25},
            {"matrix": [9, 1], "x": 11.5, "y": 4.25},
            {"matrix": [9, 2], "x": 12.5, "y": 4.25},
            {"matrix": [9, 3], "x": 13.5, "y": 4.25},
            {"matrix": [9, 4], "x": 14.5, "y": 4.25},
            {"matrix": [9, 6], "x": 15.5, "y": 4.25, "w": 1.75},
            {"matrix": [9, 7], "x": 17.25, "y": 4.25},
            {"matrix": [9, 8], "x": 18.25, "y": 4.25},

            {"matrix": [4, 0], "x": 0, "y": 5.25},
            {"matrix": [4, 1], "x": 1, "y": 5.25},
            {"matrix": [4, 2], "x": 2.25, "y": 5.25, "w": 1.25},
            {"matrix": [4, 3], "x": 3.5, "y": 5.25, "w": 1.25},
            {"matrix": [4, 4], "x": 4.75, "y": 5.25, "w": 1.25},
            {"matrix": [4, 5], "x": 6, "y": 5.25, "w": 1.25},
            {"matrix": [4, 6], "x": 7.25, "y": 5.25},
            {"matrix": [4, 7], "x": 8.25, "y": 5.25, "w": 1.25},

            {"matrix": [10, 0], "x": 10.5, "y": 5.25, "w": 1.25},
            {"matrix": [10, 1], "x": 11.75, "y": 5.25, "w": 1.5},
            {"matrix": [10, 2], "x": 13.25, "y": 5.25},
            {"matrix": [10, 3], "x": 14.25, "y": 5.25},
            {"matrix": [10, 4], "x": 15.25, "y": 5.25},
            {"matrix": [10, 6], "x": 16.25, "y": 5.25},
            {"matrix": [10, 7], "x": 17.25, "y": 5.25},
            {"matrix": [10, 8], "x": 18.25, "y": 5.25}
        ]
    }
},
"matrix_size": {
    "cols": 9,
    "rows": 12
}
}"#;

        let _layout: Config = serde_json::from_str(input).unwrap();
    }

    #[test]
    fn deserialize_encoder_block() {
        let input = r#"{
"layouts": {},
"matrix_size": { "cols": 0, "rows": 0 },
"encoder": {
    "enabled": true,
    "rotary": [
        { "pin_a": "B4", "pin_b": "B5" },
        { "pin_a": "B6", "pin_b": "B7", "resolution": 4 }
    ]
}
}"#;
        let config: Config = serde_json::from_str(input).unwrap();
        assert!(config.encoder.enabled);
        assert_eq!(config.encoder.rotary.len(), 2);
        assert_eq!(config.encoder.rotary[0].pin_a, "B4");
        assert_eq!(config.encoder.rotary[0].resolution, None);
        assert_eq!(config.encoder.rotary[1].resolution, Some(4));
    }

    #[test]
    fn deserialize_without_encoder_block() {
        let input = r#"{
"layouts": {},
"matrix_size": { "cols": 0, "rows": 0 }
}"#;
        let config: Config = serde_json::from_str(input).unwrap();
        assert!(!config.encoder.enabled);
        assert!(config.encoder.rotary.is_empty());
    }

    fn config_with(extra: &str) -> Config {
        let input = format!(
            r#"{{ "layouts": {{}}, "matrix_size": {{ "cols": 0, "rows": 0 }}{extra} }}"#
        );
        serde_json::from_str(&input).unwrap()
    }

    // QMK's authoritative count (quantum/encoder.h + info.py
    // _find_invalid_encoder_index): non-split -> len(encoder.rotary).
    #[test]
    fn encoder_count_non_split() {
        let config = config_with(
            r#", "encoder": { "rotary": [
                { "pin_a": "B4", "pin_b": "B5" },
                { "pin_a": "B6", "pin_b": "B7" }
            ] }"#,
        );
        assert_eq!(config.compute_encoder_count(), 2);
    }

    // Djinn shape: explicit split.encoder.right -> left + right.
    #[test]
    fn encoder_count_split_explicit_right() {
        let config = config_with(
            r#", "encoder": { "rotary": [ { "pin_a": "C14", "pin_b": "C15" } ] },
                "split": { "enabled": true, "encoder": { "right": { "rotary": [
                    { "pin_a": "C15", "pin_b": "C14" }
                ] } } }"#,
        );
        assert_eq!(config.compute_encoder_count(), 2);
    }

    // Mirror: split board with no split.encoder.right -> right mirrors left.
    #[test]
    fn encoder_count_split_mirror() {
        let config = config_with(
            r#", "encoder": { "rotary": [
                { "pin_a": "B4", "pin_b": "B5" },
                { "pin_a": "B6", "pin_b": "B7" }
            ] },
                "split": { "enabled": true }"#,
        );
        assert_eq!(config.compute_encoder_count(), 4);
    }

    // no_left: empty left, explicit right -> right only (page must NOT be 0).
    #[test]
    fn encoder_count_split_no_left() {
        let config = config_with(
            r#", "encoder": { "rotary": [] },
                "split": { "enabled": true, "encoder": { "right": { "rotary": [
                    { "pin_a": "A0", "pin_b": "A1" },
                    { "pin_a": "A2", "pin_b": "A3" }
                ] } } }"#,
        );
        assert_eq!(config.compute_encoder_count(), 2);
    }

    // Asymmetric: left 3, explicit right 2 -> 5.
    #[test]
    fn encoder_count_split_asymmetric() {
        let config = config_with(
            r#", "encoder": { "rotary": [
                { "pin_a": "B0", "pin_b": "B1" },
                { "pin_a": "B2", "pin_b": "B3" },
                { "pin_a": "B4", "pin_b": "B5" }
            ] },
                "split": { "enabled": true, "encoder": { "right": { "rotary": [
                    { "pin_a": "A0", "pin_b": "A1" },
                    { "pin_a": "A2", "pin_b": "A3" }
                ] } } }"#,
        );
        assert_eq!(config.compute_encoder_count(), 5);
    }

    // A stray split.encoder.right on a non-split board is ignored (matches the
    // firmware, which only doubles when SPLIT_KEYBOARD is set).
    #[test]
    fn encoder_count_stray_right_when_not_split() {
        let config = config_with(
            r#", "encoder": { "rotary": [ { "pin_a": "B4", "pin_b": "B5" } ] },
                "split": { "enabled": false, "encoder": { "right": { "rotary": [
                    { "pin_a": "A0", "pin_b": "A1" }
                ] } } }"#,
        );
        assert_eq!(config.compute_encoder_count(), 1);
    }
}
