//! Backend actor: a dedicated thread owns `XapClient` (holds `HidApi`, which is
//! not shareable). The UI thread sends boxed jobs; replies travel back through
//! oneshot channels captured inside each job. A ~1s tick enumerates devices and
//! forwards NewDevice/RemovedDevice into the event channel; broadcasts flow from
//! the per-device workers into the same channel (see hid.rs).

use std::sync::mpsc::{Receiver, RecvTimeoutError};
use std::time::{Duration, Instant};

use super::client::XapClient;

pub struct Job(pub Box<dyn FnOnce(&mut XapClient) + Send>);

pub fn run(mut client: XapClient, jobs: Receiver<Job>) {
    let mut last_enum = Instant::now() - Duration::from_secs(2);
    loop {
        if last_enum.elapsed() >= Duration::from_secs(1) {
            last_enum = Instant::now();
            match client.enumerate_xap_devices() {
                Ok(events) => {
                    for ev in events {
                        let _ = client.events_sink().unbounded_send(ev);
                    }
                }
                Err(e) => log::error!("enumerate failed: {e}"),
            }
        }
        match jobs.recv_timeout(Duration::from_millis(100)) {
            Ok(Job(f)) => f(&mut client),
            Err(RecvTimeoutError::Timeout) => {}
            Err(RecvTimeoutError::Disconnected) => return,
        }
    }
}
