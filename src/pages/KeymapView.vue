<script setup lang="ts">
    import { storeToRefs } from 'pinia'
    import { ref, watch, onMounted, onUnmounted, computed } from 'vue'
    import type { Ref, StyleValue } from 'vue'

    import { useXapDeviceStore } from '@/utils/deviceStore'
    import {
        KeyCode,
        KeycodeTemplate,
        KeycodeViewSubgroup,
        LayerOp,
        LayoutEntry,
        MappedKeymap,
        Point3D,
        SubgroupTemplate,
        XapConstants,
        XapDeviceState,
    } from '@generated/xap'
    import { commands } from '@/utils/commands'
    import { notifyDeviceLocked, notifyError, notifyInfo } from '@/utils/utils'
    import BasicKeyboardLayout from '@/components/BasicKeyboardLayout.vue'

    const store = useXapDeviceStore()
    const { device } = storeToRefs(store) as { device: Ref<XapDeviceState | null> }

    const keycodeTab: Ref<string> = ref('basic')
    const layerTab: Ref<number> = ref(0)
    const selectedKey: Ref<Point3D | null> = ref(null)
    const selectedLayout: Ref<string | null> = ref(null)
    const xapConstants: Ref<XapConstants | null> = ref(null)
    const keymap: Ref<MappedKeymap | null> = ref(null)

    type PendingOrigin = 'picker' | 'tap-slot'
    interface PendingAssignment {
        position: Point3D
        template: KeycodeTemplate
        origin: PendingOrigin
    }
    const pendingAssignment: Ref<PendingAssignment | null> = ref(null)

    const keycodeTabs = computed(() => xapConstants.value?.keycode_view?.tabs ?? [])
    const layerCount = computed(() => keymap.value?.keys.length ?? 0)

    // QMK modifier mask table (qmk_firmware_ref/quantum/modifiers.h).
    // The right-side flag is bit 4; bits 0-3 are CTRL/SHIFT/ALT/GUI.
    const MOD_MASK: Record<string, number> = {
        LCTL: 0x01,
        LSFT: 0x02,
        LALT: 0x04,
        LGUI: 0x08,
        RCTL: 0x11,
        RSFT: 0x12,
        RALT: 0x14,
        RGUI: 0x18,
        LCS: 0x03,
        LCA: 0x05,
        LCG: 0x09,
        LSA: 0x06,
        LSG: 0x0a,
        LAG: 0x0c,
        LCAG: 0x0d,
        LCSG: 0x0b,
        LSAG: 0x0e,
        LCSA: 0x07,
        LCSAG: 0x0f,
        MEH: 0x07,
        HYPR: 0x0f,
        RCS: 0x13,
        RCA: 0x15,
        RCG: 0x19,
        RSA: 0x16,
        RSG: 0x1a,
        RAG: 0x1c,
        RCAG: 0x1d,
        RCSG: 0x1b,
        RSAG: 0x1e,
        RCSA: 0x17,
        RCSAG: 0x1f,
    }
    // Curated mod options for the LM step-2 mini picker.
    const LM_MOD_OPTIONS = [
        'LCTL', 'LSFT', 'LALT', 'LGUI',
        'RCTL', 'RSFT', 'RALT', 'RGUI',
        'LCA', 'LCAG', 'MEH', 'HYPR',
    ]

    function pointsEqual(a: Point3D | null, b: Point3D | null): boolean {
        if (!a || !b) return false
        return a.x === b.x && a.y === b.y && a.z === b.z
    }

    function templateLabel(t: KeycodeTemplate): string {
        switch (t.kind) {
            case 'LayerOp':
                return `${t.op}(${t.layer})`
            case 'OneShotMod':
                return `OSM(${modName(t.mod_mask)})`
            case 'LayerTap':
                return t.tap_kc === null ? `LT(${t.layer})` : `LT(${t.layer}, ?)`
            case 'ModTap':
                return `${modName(t.mod_mask)}_T`
            case 'LayerMod':
                return t.mod_mask === null ? `LM(${t.layer})` : `LM(${t.layer}, ?)`
            case 'Modified':
                return modName(t.mod_mask)
        }
    }

    function modName(mask: number): string {
        for (const [name, value] of Object.entries(MOD_MASK)) {
            if (value === (mask & 0x1f)) return name
        }
        return `0x${mask.toString(16).toUpperCase()}`
    }

    function templateFamilyClass(kind: KeycodeTemplate['kind']): string {
        switch (kind) {
            case 'LayerOp':
            case 'LayerTap':
                return 'family-layer'
            case 'ModTap':
            case 'OneShotMod':
                return 'family-modtap'
            case 'LayerMod':
                return 'family-layermod'
            case 'Modified':
                return 'family-modified'
            default:
                return ''
        }
    }

    function keymapKeyFamilyClass(code: KeyCode): string {
        return code.template ? templateFamilyClass(code.template.kind) : ''
    }

    function tabFamilyClass(color: string | null | undefined): string {
        switch (color) {
            case 'blue':
                return 'family-layer'
            case 'purple':
                return 'family-modtap'
            case 'cyan':
                return 'family-layermod'
            case 'orange':
                return 'family-modified'
            default:
                return ''
        }
    }

    interface TemplateButton {
        label: string
        title: string
        template: KeycodeTemplate
        complete: boolean
    }

    function expandTemplate(sub: SubgroupTemplate): TemplateButton[] {
        const layerOpButtons = (op: LayerOp, desc: string): TemplateButton[] => {
            const out: TemplateButton[] = []
            for (let i = 0; i < layerCount.value; i++) {
                out.push({
                    label: `${op}(${i})`,
                    title: `${op}(${i}) - ${desc}`,
                    template: { kind: 'LayerOp', op, layer: i },
                    complete: true,
                })
            }
            return out
        }
        switch (sub.kind) {
            case 'MO':
                return layerOpButtons('MO', 'momentarily activate layer while held')
            case 'TG':
                return layerOpButtons('TG', 'toggle layer on press')
            case 'TO':
                return layerOpButtons('TO', 'switch to layer (turn off others above default)')
            case 'DF':
                return layerOpButtons('DF', 'set the default base layer')
            case 'OSL':
                return layerOpButtons('OSL', 'activate layer until the next key is tapped')
            case 'TT':
                return layerOpButtons('TT', 'tap-toggle layer (hold = momentary, tap repeatedly = toggle)')
            case 'PDF':
                return layerOpButtons('PDF', 'persist new default layer to EEPROM')
            case 'LT': {
                const out: TemplateButton[] = []
                for (let i = 0; i < layerCount.value; i++) {
                    out.push({
                        label: `LT(${i})`,
                        title: `LT(${i}, kc): hold for layer ${i}, tap to send kc - pick a basic key next`,
                        template: { kind: 'LayerTap', layer: i, tap_kc: null },
                        complete: false,
                    })
                }
                return out
            }
            case 'LM': {
                const out: TemplateButton[] = []
                for (let i = 0; i < layerCount.value; i++) {
                    out.push({
                        label: `LM(${i})`,
                        title: `LM(${i}, mod): activate layer ${i} while holding mod - pick a modifier next`,
                        template: { kind: 'LayerMod', layer: i, mod_mask: null },
                        complete: false,
                    })
                }
                return out
            }
            case 'MT':
                return sub.mods
                    .map((name): TemplateButton | null => {
                        const mask = MOD_MASK[name]
                        if (mask === undefined) return null
                        return {
                            label: `${name}_T`,
                            title: `${name}_T(kc): hold for ${name}, tap to send kc - pick a basic key next`,
                            template: { kind: 'ModTap', mod_mask: mask, tap_kc: null },
                            complete: false,
                        }
                    })
                    .filter((b): b is TemplateButton => b !== null)
            case 'QK_MODS':
                return sub.mods
                    .map((name): TemplateButton | null => {
                        const mask = MOD_MASK[name]
                        if (mask === undefined) return null
                        return {
                            label: name,
                            title: `${name}(kc): press kc while holding ${name} - pick a basic key next`,
                            template: { kind: 'Modified', mod_mask: mask, base_kc: null },
                            complete: false,
                        }
                    })
                    .filter((b): b is TemplateButton => b !== null)
        }
    }

    function slotPrompt(t: KeycodeTemplate): string {
        switch (t.kind) {
            case 'ModTap':
            case 'LayerTap':
                return 'pick a basic key to complete'
            case 'Modified':
                return 'pick a basic key to complete'
            case 'LayerMod':
                return 'pick a modifier to complete'
            default:
                return ''
        }
    }

    async function applyTemplate(template: KeycodeTemplate, position: Point3D) {
        if (!device.value) return
        if (device.value.secure_status !== 'Unlocked') {
            notifyDeviceLocked()
            return
        }
        const enc = await commands.keycodeTemplateEncode(template)
        if (enc.status === 'error') {
            notifyError(enc.error)
            return
        }
        const remap = await commands.remapKey(device.value.id, {
            layer: Number(position.z),
            row: Number(position.y),
            column: Number(position.x),
            keycode: enc.data,
        })
        if (remap.status === 'error') {
            notifyError(remap.error)
            return
        }
        pendingAssignment.value = null
        updateKeymap()
    }

    function startTemplate(button: TemplateButton) {
        if (!device.value) {
            notifyInfo('Connect a device first')
            return
        }
        if (!selectedKey.value) {
            notifyInfo('Select a key on the layer first')
            return
        }
        if (device.value.secure_status !== 'Unlocked') {
            notifyDeviceLocked()
            return
        }
        if (button.complete) {
            applyTemplate(button.template, selectedKey.value)
            return
        }
        pendingAssignment.value = {
            position: selectedKey.value,
            template: button.template,
            origin: 'picker',
        }
    }

    async function remapKey(code: number) {
        if (!device.value || !selectedLayout.value || !selectedKey.value) {
            return
        }
        if (device.value.secure_status !== 'Unlocked') {
            notifyDeviceLocked()
            return
        }
        const pending = pendingAssignment.value
        if (pending) {
            // The picker click is the second step of a parameterised template.
            const tap = code & 0xff
            if (code > 0xff) {
                notifyInfo('Pick a basic key (code <= 0xFF) to complete the tap slot')
                return
            }
            let filled: KeycodeTemplate
            switch (pending.template.kind) {
                case 'ModTap':
                    filled = { ...pending.template, tap_kc: tap }
                    break
                case 'LayerTap':
                    filled = { ...pending.template, tap_kc: tap }
                    break
                case 'Modified':
                    filled = { ...pending.template, base_kc: tap }
                    break
                default:
                    // LM (mod_mask slot) doesn't take a basic kc.
                    notifyInfo('Pick a modifier from the panel to complete LM')
                    return
            }
            applyTemplate(filled, pending.position)
            return
        }
        const ok = await commands.remapKey(device.value.id, {
            layer: Number(selectedKey.value.z),
            row: Number(selectedKey.value.y),
            column: Number(selectedKey.value.x),
            keycode: code,
        })
        switch (ok.status) {
            case 'ok':
                break
            case 'error':
                notifyError(ok.error)
                return
        }
        updateKeymap()
    }

    function fillLayerModMod(name: string) {
        const mask = MOD_MASK[name]
        const pending = pendingAssignment.value
        if (mask === undefined || !pending || pending.template.kind !== 'LayerMod') return
        const filled: KeycodeTemplate = { ...pending.template, mod_mask: mask }
        applyTemplate(filled, pending.position)
    }

    function cancelPending(reason: string) {
        if (!pendingAssignment.value) return
        pendingAssignment.value = null
        notifyInfo(`Setup cancelled: ${reason}`)
    }

    function selectBottomHalf(col: { key: { position: Point3D; code: KeyCode } }) {
        if (!device.value) return
        if (device.value.secure_status !== 'Unlocked') {
            notifyDeviceLocked()
            return
        }
        const t = col.key.code.template
        if (!t) return
        let incomplete: KeycodeTemplate | null = null
        switch (t.kind) {
            case 'ModTap':
                incomplete = { ...t, tap_kc: null }
                break
            case 'LayerTap':
                incomplete = { ...t, tap_kc: null }
                break
            case 'LayerMod':
                incomplete = { ...t, mod_mask: null }
                break
            default:
                return
        }
        selectedKey.value = col.key.position
        pendingAssignment.value = {
            position: col.key.position,
            template: incomplete,
            origin: 'tap-slot',
        }
    }

    function selectPosition(position: Point3D) {
        if (pendingAssignment.value && !pointsEqual(pendingAssignment.value.position, position)) {
            cancelPending('selected a different key')
        }
        selectedKey.value = position
    }

    function isPendingPosition(position: Point3D): boolean {
        return pointsEqual(pendingAssignment.value?.position ?? null, position)
    }

    function applyLayout(layout: LayoutEntry): StyleValue {
        const top = `${layout.y * 5}rem`
        const left = `${layout.x * 5}rem`
        const width = `${layout.w! * 5 - 0.5}rem`
        const height = `${layout.h! * 5 - 0.5}rem`

        return {
            '--key-top': top,
            '--key-left': left,
            '--key-width': width,
            '--key-height': height,
            top: top,
            left: left,
            width: width,
            height: height,
            margin: `0.25rem`,
        }
    }

    function applyKeySelection(position: Point3D): string {
        return selectedKey.value?.x == position.x && selectedKey.value?.y == position.y && selectedKey.value?.z == position.z
            ? 'border-amber-500 ring-amber-300'
            : 'border-black ring-neutral-300'
    }

    function getLayouts(): string[] {
        if (device.value == null) {
            return []
        }
        return Object.keys(device!.value.config!.layouts)
    }

    function updateKeymap() {
        if (!device.value || !selectedLayout.value) {
            return
        }

        commands.keymapGet(device.value.id, selectedLayout.value).then((result) => {
            switch (result.status) {
                case 'ok':
                    keymap.value = result.data
                    break
                case 'error':
                    notifyError(result.error)
                    break
            }
        })
    }

    function subgroupVisible(sub: KeycodeViewSubgroup): boolean {
        // While pending LM, hide all regular subgroups; only the mod mini-picker is shown.
        if (pendingAssignment.value?.template.kind === 'LayerMod') return false
        return sub.codes.length > 0 || sub.template !== null
    }

    function onKeyDown(e: KeyboardEvent) {
        if (e.key === 'Escape' && pendingAssignment.value) {
            cancelPending('Esc pressed')
        }
    }

    watch(device, async () => {
        selectedKey.value = null
        pendingAssignment.value = null
        updateKeymap()
    })

    watch(selectedLayout, async () => {
        if (!device.value || !selectedLayout.value) {
            return
        }

        updateKeymap()
    })

    onMounted(async () => {
        xapConstants.value = await commands.xapConstantsGet()
        window.addEventListener('keydown', onKeyDown)

        if (!device.value) {
            return
        }

        let layouts = getLayouts()

        if (layouts.length != 0) {
            selectedLayout.value = layouts[0]
        }
    })

    onUnmounted(() => {
        window.removeEventListener('keydown', onKeyDown)
    })
</script>

<template>
    <q-page>
        <div>
            <q-toolbar>
                <!-- Layouts -->
                <q-select
                    v-model="selectedLayout"
                    label="Layout"
                    :disable="device == null"
                    borderless
                    :options="getLayouts()"
                />
                <q-tabs
                    v-model="layerTab"
                    inline-label
                    outside-arrows
                    align="left"
                    class="text-primary"
                >
                    <q-btn flat label="Layer" />
                    <q-tab v-for="(_, index) in keymap?.keys" :name="index" :label="index" />
                </q-tabs>
            </q-toolbar>
            <!--   Keymap   -->
            <q-tab-panels v-model="layerTab">
                <q-tab-panel
                    :style="{ height: `${Math.max(Number(keymap?.size.y ?? 2), 2) * 6}rem` }"
                    v-for="(layer, layer_idx) in keymap?.keys"
                    :name="layer_idx"
                >
                    <div class="relative">
                        <template v-for="row in layer">
                            <button
                                v-for="col in row.filter((col) => col != null)"
                                class="key-button key-name-button rounded-lg p-2 absolute align-middle text-black border-2 ring-4 ring-inset shadow-md"
                                :class="[
                                    applyKeySelection(col!.key.position),
                                    col!.key.code.top && col!.key.code.bottom ? 'split-key' : '',
                                    keymapKeyFamilyClass(col!.key.code),
                                    isPendingPosition(col!.key.position) ? 'pending-key' : '',
                                ]"
                                :style="applyLayout(col!.layout)"
                                @click="() => selectPosition(col!.key.position)"
                            >
                                <template v-if="col!.key.code.top && col!.key.code.bottom">
                                    <span class="split-top">{{ col!.key.code.top }}</span>
                                    <span class="split-divider"></span>
                                    <span
                                        class="split-bottom split-bottom-clickable"
                                        @click.stop="selectBottomHalf(col!)"
                                    >{{ col!.key.code.bottom }}</span>
                                </template>
                                <span v-else>{{
                                    col!.key.code.label ?? col!.key.code.key ?? 'unknown'
                                }}</span>
                                <q-tooltip
                                    v-if="col!.key.code.key"
                                    class="text-xs"
                                    style="white-space: normal; max-width: 18rem"
                                >
                                    <div><b>{{ col!.key.code.key }}</b></div>
                                    <div v-if="col!.key.code.description">{{ col!.key.code.description }}</div>
                                </q-tooltip>
                            </button>
                        </template>
                    </div>
                </q-tab-panel>
            </q-tab-panels>

            <!-- Pending banner -->
            <div
                v-if="pendingAssignment"
                class="pending-banner"
                :class="templateFamilyClass(pendingAssignment.template.kind)"
            >
                <q-icon name="adjust" size="sm" class="q-mr-sm" />
                <span>
                    Setting up <b>{{ templateLabel(pendingAssignment.template) }}</b>
                    - {{ slotPrompt(pendingAssignment.template) }}
                    (Esc or click another key to cancel)
                </span>
                <q-space />
                <q-btn flat dense label="Cancel" @click="cancelPending('user cancelled')" />
            </div>

            <!-- Layer-Mod mini picker (replaces the regular picker while pending LM) -->
            <div
                v-if="pendingAssignment?.template.kind === 'LayerMod'"
                class="mod-mini-picker"
            >
                <div class="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                    Pick a modifier
                </div>
                <div class="keycode-grid">
                    <button
                        v-for="mod in LM_MOD_OPTIONS"
                        :key="mod"
                        class="keycode-button key-name-button rounded-lg p-2 text-black border-2 ring-4 ring-inset shadow-md border-black ring-neutral-300 family-layermod"
                        style="width: 4.5rem; height: 4.5rem"
                        @click="fillLayerModMod(mod)"
                    >
                        <span>{{ mod }}</span>
                    </button>
                </div>
            </div>

            <!-- Keycodes (hidden when LM mini-picker is active) -->
            <template v-if="pendingAssignment?.template.kind !== 'LayerMod'">
                <q-tabs
                    v-model="keycodeTab"
                    class="text-primary"
                    align="left"
                    inline-label
                    outside-arrows
                    dense
                >
                    <q-tab
                        v-for="tab in keycodeTabs"
                        :key="tab.id"
                        :name="tab.id"
                        :class="[
                            { 'fallback-tab': tab.is_fallback },
                            tabFamilyClass(tab.color),
                        ]"
                    >
                        <span>{{ tab.label }}</span>
                        <span v-if="tab.is_fallback" class="fallback-marker">(unmapped)</span>
                    </q-tab>
                </q-tabs>
                <q-tab-panels v-model="keycodeTab">
                    <q-tab-panel
                        v-for="tab in keycodeTabs"
                        :key="tab.id"
                        :name="tab.id"
                        class="row"
                    >
                        <div
                            v-for="subgroup in tab.subgroups.filter(subgroupVisible)"
                            :key="subgroup.id"
                            class="subgroup mt-4 w-full"
                            :class="{ 'fallback-subgroup': subgroup.is_fallback }"
                        >
                            <div
                                v-if="subgroup.label || tab.subgroups.length > 1 || subgroup.is_fallback"
                                class="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide"
                            >
                                {{ subgroup.label ?? subgroup.id
                                }}<span v-if="subgroup.is_fallback" class="fallback-marker"> (unmapped)</span>
                            </div>

                            <!-- ANSI keyboard subgroup -->
                            <BasicKeyboardLayout
                                v-if="subgroup.render_mode === 'ansi'"
                                :codes="subgroup.codes"
                                @select="remapKey"
                            />

                            <!-- Parameterised template subgroup (expanded per layer / mod) -->
                            <div
                                v-else-if="subgroup.template"
                                class="keycode-grid"
                            >
                                <button
                                    v-for="(btn, idx) in expandTemplate(subgroup.template)"
                                    :key="`${subgroup.id}-${idx}`"
                                    style="width: 4.5rem; height: 4.5rem"
                                    class="keycode-button key-name-button rounded-lg p-2 text-black border-2 ring-4 ring-inset shadow-md border-black ring-neutral-300"
                                    :class="tabFamilyClass(tab.color)"
                                    @click="startTemplate(btn)"
                                >
                                    <span>{{ btn.label }}</span>
                                    <q-tooltip
                                        class="text-xs"
                                        style="white-space: normal; max-width: 18rem"
                                    >
                                        <div><b>{{ btn.label }}</b></div>
                                        <div>{{ btn.title }}</div>
                                    </q-tooltip>
                                </button>
                                <div
                                    v-if="expandTemplate(subgroup.template).length === 0"
                                    class="text-xs text-gray-500"
                                >
                                    Connect a device with at least one layer to see {{ subgroup.label ?? subgroup.id }} options.
                                </div>
                            </div>

                            <!-- Regular keycode grid -->
                            <div v-else class="keycode-grid">
                                <button
                                    v-for="code in subgroup.codes"
                                    :key="code.code"
                                    style="width: 4.5rem; height: 4.5rem"
                                    class="keycode-button key-name-button rounded-lg p-2 text-black border-2 ring-4 ring-inset shadow-md border-black ring-neutral-300"
                                    @click="remapKey(code.code!)"
                                >
                                    <span>{{ code.label ?? code.key }}</span>
                                    <q-tooltip
                                        class="text-xs"
                                        style="white-space: normal; max-width: 18rem"
                                    >
                                        <div><b>{{ code.key }}</b></div>
                                        <div v-if="code.description">{{ code.description }}</div>
                                    </q-tooltip>
                                </button>
                            </div>
                        </div>
                    </q-tab-panel>
                </q-tab-panels>
            </template>
        </div>
    </q-page>
</template>

<style scoped>
.key-name-button {
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    text-align: center;
    white-space: normal;
    overflow-wrap: anywhere;
    word-break: break-word;
    line-height: 1.1;
}

.key-name-button span {
    display: block;
    max-width: 100%;
}

.key-button:hover {
    width: calc(var(--key-width) + 0.5rem) !important;
    height: calc(var(--key-height) + 0.5rem) !important;
    top: calc(var(--key-top) - 0.25rem) !important;
    left: calc(var(--key-left) - 0.25rem) !important;
}

.keycode-button:hover {
    background-color: rgba(0, 0, 0, 0.05);
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

.split-key {
    flex-direction: column;
}

.key-name-button .split-top,
.key-name-button .split-bottom {
    flex: 1 1 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    font-size: 0.7rem;
    line-height: 1;
}

.key-name-button .split-bottom {
    font-size: 0.85rem;
    font-weight: 600;
}

.split-bottom-clickable {
    cursor: pointer;
}

.split-bottom-clickable:hover {
    background-color: rgba(0, 0, 0, 0.06);
}

.split-divider {
    flex: 0 0 auto;
    width: 100%;
    border-top: 1px solid rgba(0, 0, 0, 0.35);
}

.keycode-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, 4.5rem);
    gap: 0.5rem;
    max-width: calc(16 * 4.5rem + 15 * 0.5rem);
}

.fallback-tab {
    border: 1px dashed #d97706;
    border-radius: 0.25rem;
}

.fallback-marker {
    margin-left: 0.25rem;
    color: #d97706;
    font-size: 0.7rem;
    font-style: italic;
}

.fallback-subgroup .fallback-marker {
    color: #d97706;
}

/* Family colour tints. Same classes apply to picker buttons AND keymap keys. */
.family-layer {
    background-color: #eff6ff;       /* blue-50 */
    --tw-ring-color: #93c5fd;         /* blue-300 */
}
.family-modtap {
    background-color: #faf5ff;       /* purple-50 */
    --tw-ring-color: #d8b4fe;         /* purple-300 */
}
.family-layermod {
    background-color: #ecfeff;       /* cyan-50 */
    --tw-ring-color: #67e8f9;         /* cyan-300 */
}
.family-modified {
    background-color: #fff7ed;       /* orange-50 */
    --tw-ring-color: #fdba74;         /* orange-300 */
}

.pending-key {
    animation: pending-pulse 1.4s ease-in-out infinite;
    border-style: dashed !important;
}

.pending-key .split-bottom {
    font-style: italic;
    color: #6b7280; /* gray-500 */
}

@keyframes pending-pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(217, 119, 6, 0.4); }
    50%      { box-shadow: 0 0 0 4px rgba(217, 119, 6, 0.1); }
}

.pending-banner {
    display: flex;
    align-items: center;
    margin: 0.5rem 1rem;
    padding: 0.5rem 0.75rem;
    border-radius: 0.5rem;
    border: 1px dashed #6b7280;
    font-size: 0.875rem;
}

.mod-mini-picker {
    margin: 0.5rem 1rem 1rem 1rem;
}
</style>
