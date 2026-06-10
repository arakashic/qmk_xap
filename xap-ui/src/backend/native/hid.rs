//! Thin hidapi transport adapter for the desktop runtime.
//!
//! All protocol/state-machine logic now lives in `xap_core`. This module owns
//! only HID I/O: a `HidWriter` that enqueues outbound report bytes onto a
//! channel, and a per-device worker thread (`spawn_worker`) that drains those
//! writes onto the wire, performs non-blocking reads, and feeds inbound reports
//! into the core via `ingest`.

use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc::{Receiver, Sender},
        Arc, Mutex,
    },
    thread::JoinHandle,
    time::Duration,
};

use anyhow::{anyhow, Result};
use hidapi::{DeviceInfo, HidDevice};
use log::{error, trace};
use uuid::Uuid;

use xap_core::transport::{IngestOutcome, XapWriter};
use xap_core::XAP_REPORT_SIZE;

const XAP_USAGE_PAGE: u16 = 0xFF51;
const XAP_USAGE: u16 = 0x0058;

/// Outbound side of the transport: `submit` (in the core) calls `write_report`,
/// which only enqueues the bytes onto the worker's channel. No HID I/O happens
/// here, so submitting never blocks and never deadlocks against the core lock.
pub struct HidWriter {
    pub tx: Sender<Vec<u8>>,
}

impl XapWriter for HidWriter {
    fn write_report(&self, report: &[u8]) -> Result<()> {
        self.tx
            .send(report.to_vec())
            .map_err(|err| anyhow!("failed to enqueue HID report: {err}"))
    }
}

/// True if a HID interface advertises the XAP usage page + usage.
pub fn is_xap_device(info: &DeviceInfo) -> bool {
    info.usage_page() == XAP_USAGE_PAGE && info.usage() == XAP_USAGE
}

/// Whether a freshly enumerated `candidate` is the same physical interface as a
/// previously known device (port of the old `XapDevice::is_hid_device`). Used by
/// the adapter to map enumeration results back to device ids.
pub fn device_matches(known: &DeviceInfo, candidate: &DeviceInfo) -> bool {
    candidate.path() == known.path()
        && candidate.product_id() == known.product_id()
        && candidate.vendor_id() == known.vendor_id()
        && candidate.usage_page() == known.usage_page()
        && candidate.usage() == known.usage()
}

/// Spawn the per-device HID I/O worker. Owns the `HidDevice`; runs until
/// `running` is cleared.
///
/// Lock rule (R2-1): the `core` mutex is held ONLY across the single `ingest`
/// call and the single `drain_broadcasts` call. It is NEVER held across
/// `hid_device.read`/`write` or across the event-channel send.
pub fn spawn_worker(
    id: Uuid,
    hid_device: HidDevice,
    write_rx: Receiver<Vec<u8>>,
    core: Arc<Mutex<xap_core::XapClient>>,
    waiters: Arc<Mutex<HashMap<Uuid, Sender<()>>>>,
    events: futures::channel::mpsc::UnboundedSender<xap_core::XapEvent>,
    running: Arc<AtomicBool>,
) -> JoinHandle<()> {
    std::thread::spawn(move || {
        if let Err(err) = hid_device.set_blocking_mode(false) {
            error!("device {id}: failed to set non-blocking mode: {err}");
            return;
        }

        while running.load(Ordering::SeqCst) {
            // 1. Drain queued writes onto the wire.
            while let Ok(report) = write_rx.try_recv() {
                if let Err(err) = hid_device.write(&report) {
                    error!("device {id}: HID write failed: {err}");
                    return;
                }
            }

            // 2. Non-blocking read; feed any inbound report into the core.
            let mut buf = [0u8; XAP_REPORT_SIZE];
            match hid_device.read(&mut buf) {
                Ok(0) => {}
                Ok(_len) => {
                    let outcome = { core.lock().unwrap().ingest(id, &buf) };
                    match outcome {
                        Ok(IngestOutcome::Response { .. }) => {
                            if let Some(tx) = waiters.lock().unwrap().get(&id) {
                                let _ = tx.send(());
                            }
                        }
                        Ok(IngestOutcome::Broadcast) => {
                            let drained = { core.lock().unwrap().drain_broadcasts() };
                            for (_eid, ev) in drained {
                                let _ = events.unbounded_send(ev);
                            }
                        }
                        Ok(IngestOutcome::Unmatched) => {
                            trace!("device {id}: unmatched inbound report");
                        }
                        Err(err) => {
                            error!("device {id}: ingest failed: {err}");
                        }
                    }
                }
                Err(err) => {
                    error!("device {id}: HID read failed: {err}");
                    return;
                }
            }

            // 3. Idle.
            std::thread::sleep(Duration::from_millis(1));
        }
    })
}
