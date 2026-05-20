<script setup lang="ts">
    import { storeToRefs } from 'pinia'
    import { ref, watch, onMounted, computed } from 'vue'
    import type { Ref, StyleValue } from 'vue'

    import { useXapDeviceStore } from '@/utils/deviceStore'
    import {
        LayoutEntry,
        MappedKeymap,
        Point3D,
        XapConstants,
        XapDeviceState,
    } from '@generated/xap'
    import { commands } from '@/utils/commands'
    import { notifyDeviceLocked, notifyError } from '@/utils/utils'
    import BasicKeyboardLayout from '@/components/BasicKeyboardLayout.vue'

    const store = useXapDeviceStore()
    const { device } = storeToRefs(store) as { device: Ref<XapDeviceState | null> }

    const keycodeTab: Ref<string> = ref('basic')
    const layerTab: Ref<number> = ref(0)
    const selectedKey: Ref<Point3D | null> = ref(null)
    const selectedLayout: Ref<string | null> = ref(null)
    const xapConstants: Ref<XapConstants | null> = ref(null)
    const keymap: Ref<MappedKeymap | null> = ref(null)

    const keycodeTabs = computed(() => xapConstants.value?.keycode_view?.tabs ?? [])

    const keycodeTabRows = computed(() => {
        const tabs = keycodeTabs.value
        const mid = Math.ceil(tabs.length / 2)
        return [tabs.slice(0, mid), tabs.slice(mid)]
    })

    async function remapKey(code: number) {
        if (!device.value || !selectedLayout.value || !selectedKey.value) {
            return
        }
        if (device.value.secure_status !== 'Unlocked') {
            notifyDeviceLocked()
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

    watch(device, async () => {
        selectedKey.value = null
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

        if (!device.value) {
            return
        }

        let layouts = getLayouts()

        if (layouts.length != 0) {
            selectedLayout.value = layouts[0]
        }
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
                                ]"
                                :style="applyLayout(col!.layout)"
                                @click="() => (selectedKey = col!.key.position)"
                            >
                                <template v-if="col!.key.code.top && col!.key.code.bottom">
                                    <span class="split-top">{{ col!.key.code.top }}</span>
                                    <span class="split-divider"></span>
                                    <span class="split-bottom">{{ col!.key.code.bottom }}</span>
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
            <!-- Keycodes -->
            <q-tabs
                v-for="(row, rowIdx) in keycodeTabRows"
                :key="rowIdx"
                v-model="keycodeTab"
                class="text-primary"
                align="left"
                inline-label
                outside-arrows
                dense
            >
                <q-tab
                    v-for="tab in row"
                    :key="tab.id"
                    :name="tab.id"
                    :class="{ 'fallback-tab': tab.is_fallback }"
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
                        v-for="subgroup in tab.subgroups"
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
                        <BasicKeyboardLayout
                            v-if="subgroup.render_mode === 'ansi'"
                            :codes="subgroup.codes"
                            @select="remapKey"
                        />
                        <div v-else class="flex flex-wrap gap-2">
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

.split-divider {
    flex: 0 0 auto;
    width: 100%;
    border-top: 1px solid rgba(0, 0, 0, 0.35);
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
</style>
