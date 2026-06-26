// Structural XapCommands (what RealXapClient consumes) backed by the xap-wasm
// client. Mirrors the Tauri `commands` shape: RAW methods return data directly,
// the rest return the Result<T, string> union. Ported from the Vue app's
// src/xap-runtime/{browser,generated-commands}.ts.
import type { XapWasmClient } from '@gen/xap-wasm/xap_wasm.js'
import type { XapCommands } from '../real-client'

type Result<T> = { status: 'ok'; data: T } | { status: 'error'; error: string }

const wrap = <T>(p: Promise<T>): Promise<Result<T>> =>
  p
    .then((data) => ({ status: 'ok' as const, data }))
    .catch((e) => ({ status: 'error' as const, error: String((e as Error)?.message ?? e) }))

export function makeWasmCommands(ensureClient: () => Promise<XapWasmClient>): XapCommands {
  const c = ensureClient
  const cmds = {
    // RAW (the wasm caches device state; these return data directly)
    devicesGet: async () => (await c()).devices() ?? [],
    xapConstantsGet: async () => (await c()).xap_constants(),

    // RESULT-wrapped
    deviceGet: (id: string) => wrap(c().then((x) => x.device_get(id))),
    keymapGet: (id: string, layout: string) => wrap(c().then((x) => x.keymap_get(id, layout))),
    remapKey: (id: string, arg: unknown) => wrap(c().then((x) => x.remap_key(id, arg))),
    keycodeTemplateEncode: (t: unknown) => wrap(c().then((x) => x.keycode_template_encode(t))),
    encoderKeymapGet: (id: string) => wrap(c().then((x) => x.encoder_keymap_get(id))),
    remappingSetEncoderKeycode: (id: string, arg: unknown) => wrap(c().then((x) => x.remapping_set_encoder_keycode(id, arg))),
    xapSecureLock: (id: string) => wrap(c().then((x) => x.xap_secure_lock(id))),
    xapSecureUnlock: (id: string) => wrap(c().then((x) => x.xap_secure_unlock(id))),
    qmkJumpToBootloader: (id: string) => wrap(c().then((x) => x.qmk_jump_to_bootloader(id))),
    qmkReinitializeEeprom: (id: string) => wrap(c().then((x) => x.qmk_reinitialize_eeprom(id))),
    backlightGetConfig: (id: string) => wrap(c().then((x) => x.backlight_get_config(id))),
    backlightSetConfig: (id: string, arg: unknown) => wrap(c().then((x) => x.backlight_set_config(id, arg))),
    backlightSaveConfig: (id: string) => wrap(c().then((x) => x.backlight_save_config(id))),
    rgblightGetConfig: (id: string) => wrap(c().then((x) => x.rgblight_get_config(id))),
    rgblightSetConfig: (id: string, arg: unknown) => wrap(c().then((x) => x.rgblight_set_config(id, arg))),
    rgblightSaveConfig: (id: string) => wrap(c().then((x) => x.rgblight_save_config(id))),
    rgbmatrixGetConfig: (id: string) => wrap(c().then((x) => x.rgbmatrix_get_config(id))),
    rgbmatrixSetConfig: (id: string, arg: unknown) => wrap(c().then((x) => x.rgbmatrix_set_config(id, arg))),
    rgbmatrixSaveConfig: (id: string) => wrap(c().then((x) => x.rgbmatrix_save_config(id))),
  }
  // The wasm returns `any` (serde_wasm_bindgen) but the shapes are the same
  // xap-specs codegen the generated TS types come from, so this is sound.
  return cmds as unknown as XapCommands
}
