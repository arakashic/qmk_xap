//! Protocol orchestration, generic over a synchronous query executor. These
//! free functions replace the blocking `query_*` methods on the desktop
//! `XapDevice`: they own the request sequence + capability gating + decoding,
//! but never block themselves -- the `XapQueryExecutor` adapter owns all
//! waiting. They return assembled data rather than mutating a device, avoiding
//! borrow conflicts since the executor wraps the device.

use std::io::Read;
use std::sync::Arc;

use anyhow::Result;
use flate2::read::GzDecoder;
use log::info;

use xap_specs::{
    constants::{keycode::KeyCode, XapConstants},
    XapSecureStatus,
};

use xap_specs::spec::{
    keymap::{
        KeymapCapabilitiesFlags, KeymapCapabilitiesRequest, KeymapGetEncoderKeycodeArg,
        KeymapGetEncoderKeycodeRequest, KeymapGetKeycodeRequest, KeymapGetLayerCountRequest,
    },
    lighting::{
        backlight::{
            BacklightCapabilitiesFlags, BacklightCapabilitiesRequest,
            BacklightGetEnabledEffectsRequest,
        },
        rgblight::{
            RgblightCapabilitiesFlags, RgblightCapabilitiesRequest,
            RgblightGetEnabledEffectsRequest,
        },
        rgbmatrix::{
            RgbmatrixCapabilitiesFlags, RgbmatrixCapabilitiesRequest,
            RgbmatrixGetEnabledEffectsRequest,
        },
        LightingCapabilitiesFlags, LightingCapabilitiesRequest,
    },
    qmk::{
        QmkBoardIdentifiersRequest, QmkBoardManufacturerRequest, QmkCapabilitiesFlags,
        QmkCapabilitiesRequest, QmkConfigBlobChunkRequest, QmkConfigBlobLengthRequest,
        QmkHardwareIdentifierRequest, QmkProductNameRequest, QmkVersionRequest,
    },
    remapping::{
        RemappingCapabilitiesFlags, RemappingCapabilitiesRequest, RemappingGetLayerCountRequest,
        RemappingSetKeycodeArg, RemappingSetKeycodeRequest,
    },
    xap::{
        XapEnabledSubsystemCapabilitiesFlags, XapEnabledSubsystemCapabilitiesRequest,
        XapSecureStatusRequest, XapVersionRequest,
    },
};

use crate::aggregation::{
    config::Config, KeymapInfo, LightingCapabilities, LightingInfo, Point2D, Point3D, QmkInfo,
    RemapInfo, XapDeviceInfo, XapInfo,
};
use crate::device::{format_hardware_id, Keymap, KeymapKey, XapDeviceState};
use crate::transport::XapQueryExecutor;

use uuid::Uuid;

pub async fn query_secure_status<E: XapQueryExecutor>(exec: &mut E) -> Result<XapSecureStatus> {
    Ok(exec.query(XapSecureStatusRequest(())).await?.0.into())
}

pub async fn query_config<E: XapQueryExecutor>(exec: &mut E) -> Result<(Config, String)> {
    //  data size
    let size = exec.query(QmkConfigBlobLengthRequest(())).await?.0;

    //  all chunks and merge them in a Vec
    let mut data: Vec<u8> = Vec::with_capacity(size as usize);
    let mut offset: u16 = 0;
    while offset < size {
        let chunk = exec.query(QmkConfigBlobChunkRequest(offset)).await?;
        data.extend(chunk.0.into_iter());
        offset += chunk.0.len() as u16;
    }

    // Trim trailing zeroes and convert Vec into array
    let data = &data[..(size as usize)];

    // Decompress data
    let mut decoder = GzDecoder::new(data);
    let mut decompressed = String::new();
    decoder.read_to_string(&mut decompressed)?;

    let value: serde_json::Value = serde_json::from_str(&decompressed)?;
    let config_json = serde_json::to_string_pretty(&value)?;
    let mut config: Config = serde_json::from_value(value)?;
    config.encoder_count = config.compute_encoder_count();

    Ok((config, config_json))
}

pub async fn query_key<E: XapQueryExecutor>(
    exec: &mut E,
    constants: &XapConstants,
    position: Point3D,
) -> Result<KeymapKey> {
    let code_raw = exec.query(KeymapGetKeycodeRequest(position.into())).await?;

    Ok(KeymapKey {
        code: constants.get_keycode(code_raw.0),
        position,
    })
}

pub async fn query_keymap<E: XapQueryExecutor>(
    exec: &mut E,
    constants: &XapConstants,
    info: &XapDeviceInfo,
    config: &Config,
) -> Result<Keymap> {
    let layers: u64 = if let Some(keymap) = &info.keymap {
        keymap.layer_count.unwrap_or_default() as u64
    } else {
        0
    };

    let Point2D {
        x: columns,
        y: rows,
    } = config.matrix_size;

    let mut keymap = Keymap::new(layers, rows, columns);

    for layer in 0..layers {
        for row in 0..rows {
            for column in 0..columns {
                let key = query_key(
                    exec,
                    constants,
                    Point3D {
                        z: layer,
                        y: row,
                        x: column,
                    },
                )
                .await?;
                keymap.remap_key(&key)?;
            }
        }
    }

    Ok(keymap)
}

/// Read every (layer, encoder, clockwise) slot via the standard XAP encoder
/// route and decode each u16 against the keycode catalog. Returns a tensor
/// indexed `[layer][encoder][clockwise]` (clockwise: 0 = CCW, 1 = CW).
pub async fn query_encoder_keymap<E: XapQueryExecutor>(
    exec: &mut E,
    constants: &XapConstants,
    layer_count: u8,
    encoder_count: u8,
) -> Result<Vec<Vec<Vec<KeyCode>>>> {
    let mut out: Vec<Vec<Vec<KeyCode>>> = Vec::with_capacity(layer_count.into());

    for layer in 0..layer_count {
        let mut layer_buf: Vec<Vec<KeyCode>> = Vec::with_capacity(encoder_count.into());
        for encoder in 0..encoder_count {
            let mut pair: Vec<KeyCode> = Vec::with_capacity(2);
            for clockwise in 0..=1u8 {
                let raw = exec
                    .query(KeymapGetEncoderKeycodeRequest(KeymapGetEncoderKeycodeArg {
                        layer,
                        encoder,
                        clockwise,
                    }))
                    .await?;
                pair.push(constants.get_keycode(raw.0));
            }
            layer_buf.push(pair);
        }
        out.push(layer_buf);
    }

    Ok(out)
}

pub async fn remap_key<E: XapQueryExecutor>(
    exec: &mut E,
    constants: &XapConstants,
    key: RemappingSetKeycodeArg,
) -> Result<KeymapKey> {
    exec.query(RemappingSetKeycodeRequest(key.clone())).await?;

    query_key(
        exec,
        constants,
        Point3D {
            z: key.layer as u64,
            y: key.row as u64,
            x: key.column as u64,
        },
    )
    .await
}

pub async fn query_device_info<E: XapQueryExecutor>(
    exec: &mut E,
    constants: &XapConstants,
) -> Result<(XapDeviceInfo, Config, String)> {
    let subsystems = exec.query(XapEnabledSubsystemCapabilitiesRequest(())).await?;

    let xap_info = XapInfo {
        version: exec.query(XapVersionRequest(())).await?.0,
    };

    let qmk_caps = exec.query(QmkCapabilitiesRequest(())).await?;
    let board_ids = exec.query(QmkBoardIdentifiersRequest(())).await?;
    // TODO: why do these strings have leading and trailing " characters -
    // should be removed in QMK
    let manufacturer = exec
        .query(QmkBoardManufacturerRequest(()))
        .await?
        .0
         .0
        .trim_matches('"')
        .to_owned();
    let product_name = exec
        .query(QmkProductNameRequest(()))
        .await?
        .0
         .0
        .trim_matches('"')
        .to_owned();

    let (config, config_json) = query_config(exec).await?;

    let hardware_id = exec.query(QmkHardwareIdentifierRequest(())).await?.0;

    let qmk_info = QmkInfo {
        version: exec.query(QmkVersionRequest(())).await?.0.to_string(),
        board_ids,
        manufacturer,
        product_name,
        hardware_id: format_hardware_id(hardware_id),
        jump_to_bootloader_enabled: qmk_caps.contains(QmkCapabilitiesFlags::JumpToBootloader),
        eeprom_reset_enabled: qmk_caps.contains(QmkCapabilitiesFlags::ReinitializeEeprom),
    };

    let keymap_info = if subsystems.contains(XapEnabledSubsystemCapabilitiesFlags::Keymap) {
        let keymap_caps = exec.query(KeymapCapabilitiesRequest(())).await?;

        let layer_count = if keymap_caps.contains(KeymapCapabilitiesFlags::GetLayerCount) {
            Some(exec.query(KeymapGetLayerCountRequest(())).await?.0)
        } else {
            None
        };

        Some(KeymapInfo {
            layer_count,
            get_keycode_enabled: keymap_caps.contains(KeymapCapabilitiesFlags::GetKeycode),
            get_encoder_keycode_enabled: keymap_caps
                .contains(KeymapCapabilitiesFlags::GetEncoderKeycode),
        })
    } else {
        info!("keymap subsystem not active!");
        None
    };

    let remap_info = if subsystems.contains(XapEnabledSubsystemCapabilitiesFlags::Remapping) {
        let keymap_caps = exec.query(RemappingCapabilitiesRequest(())).await?;

        let layer_count = if keymap_caps.contains(RemappingCapabilitiesFlags::GetLayerCount) {
            Some(exec.query(RemappingGetLayerCountRequest(())).await?.0)
        } else {
            None
        };

        Some(RemapInfo {
            layer_count,
            set_keycode_enabled: keymap_caps.contains(RemappingCapabilitiesFlags::SetKeycode),
            set_encoder_keycode_enabled: keymap_caps
                .contains(RemappingCapabilitiesFlags::SetEncoderKeycode),
        })
    } else {
        None
    };

    let lighting_info = if subsystems.contains(XapEnabledSubsystemCapabilitiesFlags::Lighting) {
        let lighting_caps = exec.query(LightingCapabilitiesRequest(())).await?;

        let backlight_info = if lighting_caps.contains(LightingCapabilitiesFlags::Backlight) {
            let backlight_caps = exec.query(BacklightCapabilitiesRequest(())).await?;

            let effects = if backlight_caps.contains(BacklightCapabilitiesFlags::GetEnabledEffects) {
                exec.query(BacklightGetEnabledEffectsRequest(())).await?.0
            } else {
                0
            };

            Some(LightingCapabilities::new(
                // Todo: implement backlight effects
                constants.led_matrix_modes.get_effect_map(effects as u64),
                backlight_caps.contains(BacklightCapabilitiesFlags::GetConfig),
                backlight_caps.contains(BacklightCapabilitiesFlags::SetConfig),
                backlight_caps.contains(BacklightCapabilitiesFlags::SaveConfig),
            ))
        } else {
            None
        };

        let rgblight_info = if lighting_caps.contains(LightingCapabilitiesFlags::Rgblight) {
            let rgblight_caps = exec.query(RgblightCapabilitiesRequest(())).await?;

            let effects = if rgblight_caps.contains(RgblightCapabilitiesFlags::GetEnabledEffects) {
                exec.query(RgblightGetEnabledEffectsRequest(())).await?.0
            } else {
                0
            };

            Some(LightingCapabilities::new(
                constants.rgblight_modes.get_effect_map(effects),
                rgblight_caps.contains(RgblightCapabilitiesFlags::GetConfig),
                rgblight_caps.contains(RgblightCapabilitiesFlags::SetConfig),
                rgblight_caps.contains(RgblightCapabilitiesFlags::SaveConfig),
            ))
        } else {
            None
        };

        let rgbmatrix_info = if lighting_caps.contains(LightingCapabilitiesFlags::Rgbmatrix) {
            let rgbmatrix_caps = exec.query(RgbmatrixCapabilitiesRequest(())).await?;

            let effects = if rgbmatrix_caps.contains(RgbmatrixCapabilitiesFlags::GetEnabledEffects) {
                exec.query(RgbmatrixGetEnabledEffectsRequest(())).await?.0
            } else {
                0
            };

            Some(LightingCapabilities::new(
                constants.rgb_matrix_modes.get_effect_map(effects),
                rgbmatrix_caps.contains(RgbmatrixCapabilitiesFlags::GetConfig),
                rgbmatrix_caps.contains(RgbmatrixCapabilitiesFlags::SetConfig),
                rgbmatrix_caps.contains(RgbmatrixCapabilitiesFlags::SaveConfig),
            ))
        } else {
            None
        };

        Some(LightingInfo {
            backlight: backlight_info,
            rgblight: rgblight_info,
            rgbmatrix: rgbmatrix_info,
        })
    } else {
        None
    };

    let info = XapDeviceInfo {
        xap: xap_info,
        qmk: qmk_info,
        keymap: keymap_info,
        remap: remap_info,
        lighting: lighting_info,
    };

    Ok((info, config, config_json))
}

/// Mirror the original `XapDevice::new` init sequence: device info, keymap,
/// secure status. Returns a fully assembled `XapDeviceState`.
pub async fn initialize<E: XapQueryExecutor>(
    exec: &mut E,
    constants: Arc<XapConstants>,
    id: Uuid,
) -> Result<XapDeviceState> {
    let (info, config, config_json) = query_device_info(exec, &constants).await?;
    let keymap = query_keymap(exec, &constants, &info, &config).await?;
    let secure_status = query_secure_status(exec).await?;

    Ok(XapDeviceState {
        id,
        info: Some(info),
        keymap,
        config,
        config_json,
        secure_status,
    })
}

#[cfg(test)]
mod test {
    use super::*;
    use flate2::write::GzEncoder;
    use flate2::Compression;
    use async_trait::async_trait;
    use std::io::Write;
    use xap_specs::request::XapRequest;

    /// A fake executor that replays canned response bytes for a programmed
    /// sequence of requests. Each entry is the little-endian payload bytes for
    /// the corresponding `T::Response`.
    struct FakeExecutor {
        responses: std::collections::VecDeque<Vec<u8>>,
    }

    #[async_trait(?Send)]
    impl XapQueryExecutor for FakeExecutor {
        async fn query<T: XapRequest>(&mut self, _request: T) -> Result<T::Response> {
            use binrw::BinRead;
            let payload = self
                .responses
                .pop_front()
                .expect("FakeExecutor ran out of canned responses");
            let mut cursor = std::io::Cursor::new(payload);
            Ok(T::Response::read_le(&mut cursor)?)
        }
    }

    fn gzip(data: &str) -> Vec<u8> {
        let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
        encoder.write_all(data.as_bytes()).unwrap();
        encoder.finish().unwrap()
    }

    #[test]
    fn query_config_decompresses_chunked_blob() {
        let json = r#"{"layouts":{},"matrix_size":{"cols":2,"rows":3}}"#;
        let gz = gzip(json);

        // QmkConfigBlobLengthResponse is a u16 newtype; chunk response is a
        // fixed-size array. Build canned payloads: first the length (u16 LE),
        // then chunks of 32 bytes each (QmkConfigBlobChunkResponse holds
        // [u8; 32]).
        let mut responses: std::collections::VecDeque<Vec<u8>> =
            std::collections::VecDeque::new();
        let len = gz.len() as u16;
        responses.push_back(len.to_le_bytes().to_vec());

        let mut offset = 0usize;
        while offset < gz.len() {
            let mut chunk = vec![0u8; 32];
            let end = (offset + 32).min(gz.len());
            chunk[..(end - offset)].copy_from_slice(&gz[offset..end]);
            responses.push_back(chunk);
            offset += 32;
        }

        let mut exec = FakeExecutor { responses };
        let (config, config_json) =
            pollster::block_on(query_config(&mut exec)).expect("query_config");

        assert_eq!(config.matrix_size.x, 2);
        assert_eq!(config.matrix_size.y, 3);
        assert!(config.layouts.is_empty());
        assert!(config_json.contains("matrix_size"));
    }

    #[test]
    fn query_secure_status_decodes_via_executor() {
        // XapSecureStatusResponse is a u8 newtype; 2 => Unlocked.
        let mut exec = FakeExecutor {
            responses: std::collections::VecDeque::from(vec![vec![2u8]]),
        };
        let status = pollster::block_on(query_secure_status(&mut exec)).expect("status");
        assert!(matches!(status, XapSecureStatus::Unlocked));
    }
}
