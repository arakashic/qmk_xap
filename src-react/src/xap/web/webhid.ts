// Thin WebHID transport. No protocol/keycode/framing logic — that lives in wasm.
// Ported from the Vue app's src/xap-runtime/webhid.ts.

const XAP_FILTERS: HIDDeviceRequestOptions = {
  filters: [{ usagePage: 0xff51, usage: 0x0058 }],
}

export function isWebHIDSupported(): boolean {
  return typeof navigator !== 'undefined' && 'hid' in navigator
}

export interface DeviceArrival {
  id: string
  productName?: string
}

export interface TransportCallbacks {
  onInput: (deviceId: string, bytes: Uint8Array) => void
  onConnect: (deviceId: string, productName?: string) => void
  onDisconnect: (deviceId: string) => void
}

export class WebHIDTransport {
  private devices = new Map<string, { device: HIDDevice; productName?: string }>()
  private listenersRegistered = false
  private cb?: TransportCallbacks

  /** Wire up callbacks and register passive connect/disconnect listeners so the
   *  transport reacts to hotplug from app load, not only after a manual connect. */
  init(cb: TransportCallbacks): void {
    this.cb = cb
    this.registerListeners()
  }

  /** Reopen devices the origin was already granted (WebHID grants persist across
   *  reloads), so a plugged-in, authorized keyboard reattaches on page load. */
  async reattachGranted(): Promise<DeviceArrival[]> {
    const granted = await navigator.hid.getDevices()
    const arrivals: DeviceArrival[] = []
    for (const device of granted) {
      if (this.findId(device) != null) continue
      arrivals.push(await this.openAndRegister(device))
    }
    return arrivals
  }

  /** Prompt the chooser (user gesture). Returns the newly-opened devices plus a
   *  flag when every picked device was already connected (so the UI can say so). */
  async requestAndOpen(): Promise<{ newDevices: DeviceArrival[]; alreadyConnected: boolean }> {
    const requested = await navigator.hid.requestDevice(XAP_FILTERS)
    const newDevices: DeviceArrival[] = []
    let alreadyConnected = false
    for (const device of requested) {
      if (this.findId(device) != null) { alreadyConnected = true; continue }
      newDevices.push(await this.openAndRegister(device))
    }
    return { newDevices, alreadyConnected }
  }

  // wasm hands a 65-byte report: report[0] is the report id (0), report[1..] the 64-byte payload.
  async sendReport(deviceId: string, report: Uint8Array): Promise<void> {
    const entry = this.devices.get(deviceId)
    if (entry == null) throw new Error(`unknown device ${deviceId}`)
    await entry.device.sendReport(report[0], report.slice(1))
  }

  private async openAndRegister(device: HIDDevice): Promise<DeviceArrival> {
    if (!device.opened) await device.open()
    const id = crypto.randomUUID()
    this.devices.set(id, { device, productName: device.productName })
    device.addEventListener('inputreport', (event: HIDInputReportEvent) => {
      const d = new Uint8Array(event.data.buffer, event.data.byteOffset, event.data.byteLength)
      this.cb?.onInput(id, d)
    })
    return { id, productName: device.productName }
  }

  private findId(device: HIDDevice): string | undefined {
    for (const [id, entry] of this.devices) {
      if (entry.device === device) return id
    }
    return undefined
  }

  private registerListeners() {
    if (this.listenersRegistered) return
    this.listenersRegistered = true
    navigator.hid.addEventListener('disconnect', (event: HIDConnectionEvent) => {
      const id = this.findId(event.device)
      if (id == null) return
      this.devices.delete(id)
      this.cb?.onDisconnect(id)
    })
    navigator.hid.addEventListener('connect', (event: HIDConnectionEvent) => {
      if (this.findId(event.device) != null) return
      void this.openAndRegister(event.device).then(({ id, productName }) => {
        this.cb?.onConnect(id, productName)
      })
    })
  }
}
