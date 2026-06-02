pub mod keycode;
mod keycode_decoder;
pub mod keycode_display;
pub mod keycode_encoder;
pub mod lighting;

use std::path::PathBuf;

use anyhow::{anyhow, Result};
use include_dir::{include_dir, Dir};
use serde::Serialize;
use specta::Type;

use self::keycode::{read_xap_keycode_catalog, KeyCode, XapKeyCodeCatalog};
use self::keycode_display::KeycodeView;
use self::lighting::{read_xap_lighting_effects, LightingEffects};

static EMBEDDED_ASSETS: Dir<'_> = include_dir!("$CARGO_MANIFEST_DIR/assets");

pub enum AssetSource<'a> {
    Fs(PathBuf),
    Embedded(&'a Dir<'a>),
}

impl<'a> AssetSource<'a> {
    /// `(file_name, contents)` for every top-level file.
    pub fn entries(&self) -> Result<Vec<(String, String)>> {
        match self {
            AssetSource::Fs(path) => {
                let mut entries = Vec::new();
                for entry in std::fs::read_dir(path)? {
                    let path = entry?.path();
                    if path.is_dir() {
                        continue;
                    }
                    let Some(file_name) = path.file_name().and_then(|name| name.to_str()) else {
                        continue;
                    };
                    entries.push((file_name.to_owned(), std::fs::read_to_string(&path)?));
                }
                Ok(entries)
            }
            AssetSource::Embedded(dir) => dir
                .files()
                .map(|file| {
                    let name = file
                        .path()
                        .file_name()
                        .ok_or_else(|| anyhow!("embedded asset has no file name"))?
                        .to_string_lossy()
                        .into_owned();
                    let contents = file
                        .contents_utf8()
                        .ok_or_else(|| anyhow!("embedded asset {name} is not valid UTF-8"))?
                        .to_owned();
                    Ok((name, contents))
                })
                .collect(),
        }
    }

    /// Contents of one named file; `Ok(None)` if absent.
    pub fn read(&self, name: &str) -> Result<Option<String>> {
        match self {
            AssetSource::Fs(path) => {
                let file = path.join(name);
                if file.is_file() {
                    Ok(Some(std::fs::read_to_string(&file)?))
                } else {
                    Ok(None)
                }
            }
            AssetSource::Embedded(dir) => dir
                .get_file(name)
                .map(|file| {
                    file.contents_utf8()
                        .ok_or_else(|| anyhow!("embedded asset {name} is not valid UTF-8"))
                        .map(str::to_owned)
                })
                .transpose(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Type)]
pub struct XapConstants {
    pub keycode_version: String,
    pub keycode_versions: Vec<String>,
    pub keycode_view: KeycodeView,
    pub rgblight_modes: LightingEffects,
    pub rgb_matrix_modes: LightingEffects,
    pub led_matrix_modes: LightingEffects,
    #[serde(skip)]
    #[specta(skip)]
    keycode_catalog: XapKeyCodeCatalog,
}

impl XapConstants {
    pub fn new(specs_path: PathBuf) -> Result<Self> {
        Self::from_source(&AssetSource::Fs(specs_path))
    }

    pub fn from_embedded() -> Result<Self> {
        Self::from_source(&AssetSource::Embedded(&EMBEDDED_ASSETS))
    }

    fn from_source(src: &AssetSource) -> Result<Self> {
        let keycode_catalog = read_xap_keycode_catalog(src)?;

        Ok(Self {
            keycode_version: keycode_catalog.latest.clone(),
            keycode_versions: keycode_catalog.versions.clone(),
            keycode_view: keycode_catalog.view_for_version(None),
            rgblight_modes: read_xap_lighting_effects(src, "rgblight")?,
            rgb_matrix_modes: read_xap_lighting_effects(src, "rgb_matrix")?,
            led_matrix_modes: read_xap_lighting_effects(src, "led_matrix")?,
            keycode_catalog,
        })
    }

    pub fn get_keycode(&self, code: u16) -> KeyCode {
        self.get_keycode_for_version(None, code)
    }

    pub fn get_keycode_for_version(&self, version: Option<&str>, code: u16) -> KeyCode {
        self.keycode_catalog.get_keycode(version, code)
    }
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn from_embedded_matches_filesystem() {
        let fs = XapConstants::new(
            std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("assets"),
        )
        .expect("fs load");
        let embedded = XapConstants::from_embedded().expect("embedded load");
        assert_eq!(fs.keycode_version, embedded.keycode_version);
        assert_eq!(fs.keycode_versions, embedded.keycode_versions);
    }
}
