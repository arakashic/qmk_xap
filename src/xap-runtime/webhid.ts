// Thin WebHID transport. No protocol/keycode/framing logic — that lives in wasm.

const XAP_FILTERS: HIDDeviceRequestOptions = {
    filters: [{ usagePage: 0xff51, usage: 0x0058 }],
}

export function isWebHIDSupported(): boolean {
    return typeof navigator !== 'undefined' && 'hid' in navigator
}

export class WebHIDTransport {
    private devices = new Map<string, HIDDevice>()
    private disconnectListenerRegistered = false
    private onDisconnect?: (deviceId: string) => void

    async requestAndOpen(
        onInput: (deviceId: string, bytes: Uint8Array) => void,
        onDisconnect: (deviceId: string) => void,
    ): Promise<string[]> {
        this.onDisconnect = onDisconnect
        this.registerDisconnectListener()

        const requested = await navigator.hid.requestDevice(XAP_FILTERS)
        const newIds: string[] = []

        for (const device of requested) {
            if (this.findId(device) != null) continue
            if (!device.opened) await device.open()

            const id = crypto.randomUUID()
            this.devices.set(id, device)
            device.addEventListener('inputreport', (event: HIDInputReportEvent) => {
                const d = new Uint8Array(
                    event.data.buffer,
                    event.data.byteOffset,
                    event.data.byteLength,
                )
                onInput(id, d)
            })
            newIds.push(id)
        }

        return newIds
    }

    // wasm hands a 65-byte report: report[0] is the report id (0), report[1..] the 64-byte payload.
    async sendReport(deviceId: string, report: Uint8Array): Promise<void> {
        const device = this.devices.get(deviceId)
        if (device == null) throw new Error(`unknown device ${deviceId}`)
        await device.sendReport(report[0], report.slice(1))
    }

    getOpenedDevices(): string[] {
        return Array.from(this.devices.keys())
    }

    async close(deviceId: string): Promise<void> {
        const device = this.devices.get(deviceId)
        if (device == null) return
        this.devices.delete(deviceId)
        await device.close()
    }

    private findId(device: HIDDevice): string | undefined {
        for (const [id, d] of this.devices) {
            if (d === device) return id
        }
        return undefined
    }

    private registerDisconnectListener() {
        if (this.disconnectListenerRegistered) return
        this.disconnectListenerRegistered = true
        navigator.hid.addEventListener('disconnect', (event: HIDConnectionEvent) => {
            const id = this.findId(event.device)
            if (id == null) return
            this.devices.delete(id)
            this.onDisconnect?.(id)
        })
    }
}
