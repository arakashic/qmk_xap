//! Native backend smoke test: drive `NativeBackend` against a running XAP
//! simulator with no UI. Proves enumerate -> worker -> session::initialize ->
//! aggregation end-to-end. Run with a sim up:
//!
//!   cd ~/projects/qmk_firmware_priv && qmk xap-sim -kb xap_sim/ugo_rev3_full -km default start --hid
//!   cargo run -p xap-ui --example native_smoke
//!
//! Exits non-zero on failure.

use std::time::{Duration, Instant};

use futures::executor::block_on;

use xap_ui::backend::native::NativeBackend;
use xap_ui::backend::XapBackend;

fn main() {
    env_logger::init();
    let backend = NativeBackend::new();

    // Poll for a device for up to 15s.
    let deadline = Instant::now() + Duration::from_secs(15);
    let id = loop {
        let devices = block_on(backend.devices_get()).unwrap_or_default();
        if let Some(state) = devices.first() {
            break state.id;
        }
        if Instant::now() >= deadline {
            eprintln!("FAIL: no XAP device enumerated within 15s (is a sim running?)");
            std::process::exit(1);
        }
        std::thread::sleep(Duration::from_millis(500));
    };

    let state = match block_on(backend.device_get(id)) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("FAIL: device_get: {e}");
            std::process::exit(1);
        }
    };

    let info = state.info.as_ref().expect("initialized device has info");
    println!("device id:      {id}");
    println!("manufacturer:   {}", info.qmk.manufacturer);
    println!("product:        {}", info.qmk.product_name);
    println!("xap version:    0x{:08X}", info.xap.version);
    println!("qmk version:    {}", info.qmk.version);
    println!("encoder_count:  {}", state.config.encoder_count);

    let layout = match state.config.layouts.keys().next() {
        Some(l) => l.clone(),
        None => {
            eprintln!("FAIL: device reports no layouts");
            std::process::exit(1);
        }
    };

    match block_on(backend.keymap_get(id, layout.clone())) {
        Ok(keymap) => {
            let d = &keymap.dimensions;
            println!(
                "keymap[{layout}]:  layers={} rows={} cols={}",
                d.z, d.y, d.x
            );
            if d.x == 0 || d.y == 0 || d.z == 0 {
                eprintln!("FAIL: keymap has a zero dimension");
                std::process::exit(1);
            }
        }
        Err(e) => {
            eprintln!("FAIL: keymap_get: {e}");
            std::process::exit(1);
        }
    }

    // Encoders (present on split/encoder boards; empty is acceptable).
    match block_on(backend.encoder_keymap_get(id)) {
        Ok(enc) => {
            let layers = enc.len();
            let encoders = enc.first().map(|l| l.len()).unwrap_or(0);
            println!("encoder keymap: layers={layers} encoders_per_layer={encoders}");
        }
        Err(e) => {
            eprintln!("FAIL: encoder_keymap_get: {e}");
            std::process::exit(1);
        }
    }

    println!("OK");
}
