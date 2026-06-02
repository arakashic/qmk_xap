// Minimal ambient WebHID declarations — only the subset used by webhid.ts.
// (Avoids a dependency on @types/w3c-web-hid.)

interface HIDDeviceFilter {
    vendorId?: number
    productId?: number
    usagePage?: number
    usage?: number
}

interface HIDDeviceRequestOptions {
    filters: HIDDeviceFilter[]
}

interface HIDInputReportEvent extends Event {
    readonly device: HIDDevice
    readonly reportId: number
    readonly data: DataView
}

interface HIDConnectionEvent extends Event {
    readonly device: HIDDevice
}

interface HIDDevice {
    readonly opened: boolean
    open(): Promise<void>
    close(): Promise<void>
    sendReport(reportId: number, data: BufferSource): Promise<void>
    addEventListener(
        type: 'inputreport',
        listener: (event: HIDInputReportEvent) => void,
    ): void
    removeEventListener(
        type: 'inputreport',
        listener: (event: HIDInputReportEvent) => void,
    ): void
}

interface HID {
    requestDevice(options: HIDDeviceRequestOptions): Promise<HIDDevice[]>
    getDevices(): Promise<HIDDevice[]>
    addEventListener(
        type: 'connect' | 'disconnect',
        listener: (event: HIDConnectionEvent) => void,
    ): void
}

interface Navigator {
    readonly hid: HID
}
