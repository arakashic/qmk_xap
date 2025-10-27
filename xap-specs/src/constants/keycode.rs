use std::{
    collections::HashMap,
    fs::{self, read_to_string},
    path::Path,
};

use anyhow::Result;
use log::error;
use serde::{de::Error, Deserialize, Deserializer, Serialize};
use serde_json::Value;
use serde_with::{serde_as, skip_serializing_none, NoneAsEmptyString};
use specta::Type;

#[serde_as]
#[skip_serializing_none]
#[derive(Deserialize, Clone, Serialize, Default, Debug, PartialEq, Eq, Type)]
pub struct KeyCode {
    #[serde(default)]
    pub code: u16,
    pub key: String,
    #[serde(default)]
    pub group: Option<String>,
    #[serde(default)]
    #[serde_as(as = "NoneAsEmptyString")]
    pub label: Option<String>,
    #[serde(default)]
    pub aliases: Vec<String>,
}

#[derive(Debug, Serialize, Clone, Type)]
pub struct XapKeyCodeCategory {
    pub name: String,
    pub codes: Vec<KeyCode>,
}

impl KeyCode {
    pub fn new_custom(code: u16) -> Self {
        Self {
            code,
            key: format!("USER-CUSTOM-{code}"),
            group: Some("USER-CUSTOM".to_owned()),
            label: Some(format!("{code}")),
            aliases: vec![],
        }
    }
}

#[derive(Debug)]
struct KeyCodes {
    keycodes: HashMap<u16, KeyCode>,
    reset: bool,
    deletions: Vec<u16>,
}

impl<'de> Deserialize<'de> for KeyCodes {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        #[derive(Deserialize)]
        struct RawKeyCodes {
            #[serde(default)]
            keycodes: HashMap<String, Value>,
        }

        let raw = RawKeyCodes::deserialize(deserializer)?;

        let mut reset = false;
        let mut deletions = Vec::new();
        let mut keycodes = HashMap::new();

        for (key, value) in raw.keycodes {
            // Handle special !reset! key
            if key == "!reset!" {
                reset = true;
                continue;
            }

            // Parse the hex code
            let code = u16::from_str_radix(key.trim_start_matches("0x"), 16)
                .map_err(|_| D::Error::custom(format!("invalid hex code: {}", key)))?;

            // Handle special !delete! value
            if let Value::String(s) = &value {
                if s == "!delete!" {
                    deletions.push(code);
                    continue;
                }
            }

            // Deserialize as KeyCode
            let mut keycode: KeyCode = serde_json::from_value(value)
                .map_err(|e| D::Error::custom(format!("failed to parse keycode: {}", e)))?;
            keycode.code = code;
            keycodes.insert(code, keycode);
        }

        Ok(KeyCodes {
            keycodes,
            reset,
            deletions,
        })
    }
}

pub(crate) fn read_xap_keycodes(path: impl AsRef<Path>) -> Result<Vec<XapKeyCodeCategory>> {
    let mut all = HashMap::new();

    // Collect and sort entries by filename to ensure version ordering
    let mut entries: Vec<_> = fs::read_dir(path)?
        .filter_map(|e| e.ok())
        .filter(|entry| {
            let path = entry.path();
            !path.is_dir()
                && path
                    .file_name()
                    .is_some_and(|filename| filename.to_string_lossy().starts_with("keycodes"))
        })
        .collect();

    entries.sort_by_key(|e| e.file_name());

    for entry in entries {
        let path = entry.path();
        let raw_hjson = read_to_string(&path)?;

        match deser_hjson::from_str::<KeyCodes>(&raw_hjson) {
            Ok(codes) => {
                // Handle reset: clear all existing keycodes if reset flag is set
                if codes.reset {
                    all.clear();
                }

                // Add new keycodes
                all.extend(codes.keycodes);

                // Handle deletions: remove keys marked with !delete!
                for code in codes.deletions {
                    all.remove(&code);
                }
            }
            Err(err) => {
                error!("failed to deserialize keycodes from file {path:?} with error: {err}",);
            }
        }
    }

    let keycodes = all
        .into_iter()
        .fold(HashMap::new(), |mut category, (_, keycode)| {
            category
                .entry(keycode.group.clone().unwrap_or("other".to_owned()))
                .or_insert(Vec::new())
                .push(keycode);

            category
        });

    let keycodes = keycodes
        .into_iter()
        .map(|(name, mut codes)| {
            codes.sort_by_key(|code| code.code);
            XapKeyCodeCategory { name, codes }
        })
        .collect();

    Ok(keycodes)
}

#[cfg(test)]
mod test {
    use similar_asserts::assert_eq;

    use super::*;

    #[test]
    pub fn deserialize() {
        let input = r#"{
            "keycodes": {
                "0x0000": {
                    "group": "internal",
                    "key": "KC_NO",
                    "label": "",
                    "aliases": [
                        "XXXXXXX"
                    ]
                },
                "0x0001": {
                    "group": "internal",
                    "key": "KC_TRANSPARENT",
                    "label": "",
                    "aliases": [
                        "_______",
                        "KC_TRNS"
                    ]
                },
                "0x0004": {
                    "group": "basic",
                    "key": "KC_A",
                    "label": "A"
                },
                "0x0005": {
                    "group": "basic",
                    "key": "KC_B",
                    "label": "B"
                }
            }
        }"#;

        let codes: KeyCodes = deser_hjson::from_str(input).expect("deserialization failed");

        assert_eq!(codes.keycodes.len(), 4);

        assert_eq!(
            codes.keycodes[&0],
            KeyCode {
                code: 0,
                group: Some("internal".to_owned()),
                key: "KC_NO".to_owned(),
                label: None,
                aliases: vec!["XXXXXXX".to_owned()]
            }
        );

        assert_eq!(
            codes.keycodes[&1],
            KeyCode {
                code: 1,
                group: Some("internal".to_owned()),
                key: "KC_TRANSPARENT".to_owned(),
                label: None,
                aliases: vec!["_______".to_owned(), "KC_TRNS".to_owned()]
            }
        );

        assert_eq!(
            codes.keycodes[&4],
            KeyCode {
                code: 4,
                group: Some("basic".to_owned()),
                key: "KC_A".to_owned(),
                label: Some("A".to_owned()),
                aliases: vec![]
            }
        );

        assert_eq!(
            codes.keycodes[&5],
            KeyCode {
                code: 5,
                group: Some("basic".to_owned()),
                key: "KC_B".to_owned(),
                label: Some("B".to_owned()),
                aliases: vec![]
            }
        );
    }
}
