use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc::{channel, Sender},
        Arc, Mutex,
    },
    thread::JoinHandle,
    time::Duration,
};

use anyhow::{anyhow, Result};
use async_trait::async_trait;
use hidapi::{DeviceInfo, HidApi};
use uuid::Uuid;

use xap_specs::{
    constants::{keycode::KeyCode, XapConstants},
    request::XapRequest,
    spec::remapping::RemappingSetKeycodeArg,
};

use xap_core::aggregation::keymap::MappedKeymap;
use xap_core::transport::XapQueryExecutor;
use xap_core::XapDeviceState;

use tauri::AppHandle;

use crate::rpc::events::XapEvent;

use super::device::{device_matches, is_xap_device, spawn_worker, HidWriter};

pub(crate) struct XapClient {
    core: Arc<Mutex<xap_core::XapClient>>,
    hid: HidApi,
    constants: Arc<XapConstants>,
    writers: HashMap<Uuid, Sender<Vec<u8>>>,
    waiters: Arc<Mutex<HashMap<Uuid, Sender<()>>>>,
    workers: HashMap<Uuid, (JoinHandle<()>, Arc<AtomicBool>)>,
    device_infos: HashMap<Uuid, DeviceInfo>,
    handle: AppHandle,
}

/// Adapter that lets the `xap_core::session` free functions run a synchronous
/// query against this client's per-device submit/wait machinery.
struct ClientExecutor<'a> {
    client: &'a mut XapClient,
    id: Uuid,
}

#[async_trait(?Send)]
impl XapQueryExecutor for ClientExecutor<'_> {
    async fn query<T: XapRequest>(&mut self, request: T) -> Result<T::Response> {
        // Synchronous body: blocks on the worker channel. Driven by block_on at
        // the call site; the future resolves on first poll (no suspension).
        self.client.query(self.id, request)
    }
}

impl XapClient {
    pub fn new(constants: XapConstants, handle: AppHandle) -> Result<Self> {
        let core = Arc::new(Mutex::new(xap_core::XapClient::new(Arc::new(
            constants.clone(),
        ))));
        Ok(Self {
            core,
            hid: HidApi::new_without_enumerate()?,
            constants: Arc::new(constants),
            writers: HashMap::new(),
            waiters: Arc::new(Mutex::new(HashMap::new())),
            workers: HashMap::new(),
            device_infos: HashMap::new(),
            handle,
        })
    }

    pub fn xap_constants(&self) -> XapConstants {
        self.constants.as_ref().clone()
    }

    /// Submit a request, wait for the worker to signal a matching response, then
    /// decode it. The `core` lock is held ONLY across `submit` (step 4) and
    /// `take_response` (step 8), NEVER across the wait (step 5). `submit` only
    /// enqueues bytes onto the worker channel, so it performs no HID I/O.
    pub fn query<T>(&mut self, id: Uuid, request: T) -> Result<T::Response>
    where
        T: XapRequest,
    {
        let writer = HidWriter {
            tx: self
                .writers
                .get(&id)
                .ok_or_else(|| anyhow!("unknown device id: {id}"))?
                .clone(),
        };
        let (tx, rx) = channel();
        self.waiters.lock().unwrap().insert(id, tx);

        let token = { self.core.lock().unwrap().device_mut(id)?.submit(&writer, request)? };

        let waited = rx.recv_timeout(Duration::from_secs(5));
        self.waiters.lock().unwrap().remove(&id);
        waited.map_err(|_| anyhow!("timeout waiting for response to request"))?;

        let resp = { self.core.lock().unwrap().device_mut(id)?.take_response::<T>(&token)? };
        resp.ok_or_else(|| anyhow!("response missing after wakeup"))
    }

    pub fn device_state(&self, id: Uuid) -> Result<XapDeviceState> {
        Ok(self.core.lock().unwrap().device(id)?.state().clone())
    }

    pub fn device_states(&self) -> Vec<XapDeviceState> {
        self.core
            .lock()
            .unwrap()
            .get_devices()
            .iter()
            .map(|device| device.state().clone())
            .collect()
    }

    pub fn keymap_with_layout(&self, id: Uuid, layout: String) -> Result<MappedKeymap> {
        self.core
            .lock()
            .unwrap()
            .device(id)?
            .keymap_with_layout(layout)
    }

    pub fn remap_key(&mut self, id: Uuid, arg: RemappingSetKeycodeArg) -> Result<()> {
        let constants = Arc::clone(&self.constants);
        let key = {
            let mut exec = ClientExecutor { client: self, id };
            pollster::block_on(xap_core::session::remap_key(&mut exec, &constants, arg))?
        };
        self.core
            .lock()
            .unwrap()
            .device_mut(id)?
            .state_mut()
            .keymap
            .remap_key(&key)
    }

    pub fn encoder_keymap_get(&mut self, id: Uuid) -> Result<Vec<Vec<Vec<KeyCode>>>> {
        let state = self.device_state(id)?;
        let layer_count = state
            .info
            .as_ref()
            .and_then(|i| i.keymap.as_ref().and_then(|k| k.layer_count))
            .or_else(|| {
                state
                    .info
                    .as_ref()
                    .and_then(|i| i.remap.as_ref().and_then(|r| r.layer_count))
            })
            .unwrap_or(0);
        let encoder_count = state.config.encoder_count;
        if layer_count == 0 || encoder_count == 0 {
            return Ok(Vec::new());
        }
        let constants = Arc::clone(&self.constants);
        let mut exec = ClientExecutor { client: self, id };
        pollster::block_on(xap_core::session::query_encoder_keymap(
            &mut exec,
            &constants,
            layer_count,
            encoder_count,
        ))
    }

    pub fn enumerate_xap_devices(&mut self) -> Result<Vec<XapEvent>> {
        let mut events = Vec::new();
        self.hid.refresh_devices()?;

        let candidates: Vec<DeviceInfo> = self
            .hid
            .device_list()
            .filter(|info| is_xap_device(info))
            .cloned()
            .collect();

        // Removal: any known device whose interface is gone.
        let removed: Vec<Uuid> = self
            .device_infos
            .iter()
            .filter(|(_, known)| {
                !candidates
                    .iter()
                    .any(|candidate| device_matches(known, candidate))
            })
            .map(|(id, _)| *id)
            .collect();

        for id in removed {
            if let Some((handle, running)) = self.workers.remove(&id) {
                running.store(false, Ordering::SeqCst);
                let _ = handle.join();
            }
            self.writers.remove(&id);
            self.waiters.lock().unwrap().remove(&id);
            self.device_infos.remove(&id);
            self.core.lock().unwrap().remove_device(id);
            events.push(XapEvent::RemovedDevice { id });
        }

        // Addition: any candidate not already matching a known device.
        for candidate in candidates {
            if self
                .device_infos
                .values()
                .any(|known| device_matches(known, &candidate))
            {
                continue;
            }

            let id = Uuid::new_v4();
            let hid_device = candidate.open_device(&self.hid)?;

            let (wtx, wrx) = channel();
            self.writers.insert(id, wtx);

            let running = Arc::new(AtomicBool::new(true));
            let worker = spawn_worker(
                id,
                hid_device,
                wrx,
                Arc::clone(&self.core),
                Arc::clone(&self.waiters),
                self.handle.clone(),
                Arc::clone(&running),
            );
            self.workers.insert(id, (worker, running));
            self.device_infos.insert(id, candidate);

            self.core
                .lock()
                .unwrap()
                .add_device(xap_core::XapDevice::new(id, Arc::clone(&self.constants)));

            // Worker is now running, so the init queries get serviced.
            let constants = Arc::clone(&self.constants);
            let state = {
                let mut exec = ClientExecutor { client: self, id };
                pollster::block_on(xap_core::session::initialize(&mut exec, constants, id))?
            };
            self.core.lock().unwrap().device_mut(id)?.set_state(state);

            events.push(XapEvent::NewDevice { id });
        }

        Ok(events)
    }
}
