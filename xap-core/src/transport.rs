use anyhow::Result;
use async_trait::async_trait;

use xap_specs::request::XapRequest;

/// A submit+wait+decode primitive, implemented by each platform adapter
/// (desktop: blocking on a channel inside a single-threaded `block_on`; wasm:
/// awaiting a WebHID round-trip). The core's orchestration is generic over this
/// so protocol knowledge lives in one place. `?Send`: both drivers are
/// single-threaded, so futures need not be `Send`.
#[async_trait(?Send)]
pub trait XapQueryExecutor {
    async fn query<T: XapRequest>(&mut self, request: T) -> Result<T::Response>;
}

/// The core hands the adapter bytes to put on the wire. The adapter feeds
/// received reports back in via XapDevice::ingest. No read method: the core
/// never pulls, never blocks (Locked Decisions 1, 9).
pub trait XapWriter {
    fn write_report(&self, report: &[u8]) -> Result<()>;
}

/// Result of feeding one inbound report into the core.
#[derive(Debug)]
pub enum IngestOutcome {
    /// A pending request's token was matched; response bytes are ready.
    Response { token: xap_specs::token::Token },
    /// A broadcast was decoded and enqueued (secure status already applied).
    Broadcast,
    /// Report did not correspond to a pending token (ignored).
    Unmatched,
}
