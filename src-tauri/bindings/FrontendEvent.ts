// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import type { XAPDeviceInfo } from "./XAPDeviceInfo";
import type { XAPSecureStatus } from "./XAPSecureStatus";

export type FrontendEvent = { id: string, device: XAPDeviceInfo, } | { id: string, } | { id: string, status: XAPSecureStatus, } | { id: string, log: string, };