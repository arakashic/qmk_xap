<script setup lang="ts">
    import { storeToRefs } from 'pinia'
    import { computed } from 'vue'
    import { useRoute } from 'vue-router'
    import { useXapDeviceStore } from '@/utils/deviceStore'
    import { XapDeviceState } from '@generated/xap-types'
    import { commands, backendCapabilities, connectDevice } from '@/utils/commands'

    const store = useXapDeviceStore()
    const { device, devices } = storeToRefs(store)

    const route = useRoute()
    const showSecureButton = computed(
        () => device.value != null && route.meta.showSecureButton === true,
    )
</script>

<template>
    <q-layout view="hHh LpR fff">
        <q-header class="bg-primary text-white" height-hint="98">
            <q-toolbar>
                <q-toolbar-title>
                    <q-avatar>
                        <img src="qmk.svg" />
                    </q-avatar>
                    QMK XAP GUI
                </q-toolbar-title>
                <q-tabs align="left">
                    <q-route-tab
                        label="Keymap"
                        :disable="device?.info?.keymap == null"
                        to="/keymap"
                        exact
                    />
                    <q-route-tab
                        v-if="
                            device?.info?.keymap?.get_encoder_keycode_enabled &&
                            (device?.config?.encoder_count ?? 0) > 0
                        "
                        label="Encoder"
                        to="/encoder"
                        exact
                    />
                    <q-route-tab
                        v-if="device?.info?.lighting?.rgblight != null"
                        label="RGB"
                        to="/rgb"
                        exact
                    />
                    <q-route-tab
                        label="Broadcast"
                        :disable="device == null"
                        to="/broadcast"
                        exact
                    />
                    <q-route-tab label="Info" :disable="device == null" to="/info" exact />
                </q-tabs>
            </q-toolbar>
            <div class="bg-white">
                <q-select
                    v-model="device"
                    label="XAP device"
                    :disable="device == null"
                    :readonly="devices.size == 1"
                    filled
                    :options="() => Array.from(devices.values())"
                    :option-value="(device: XapDeviceState) => device.id"
                    :option-label="
                        (device: XapDeviceState) =>
                            device?.info?.qmk.manufacturer + ' - ' + device?.info?.qmk.product_name
                    "
                    emit-value
                />
            </div>
        </q-header>
        <q-page-container>
            <router-view v-if="device != null" />
            <div
                v-else
                class="column flex-center"
                style="min-height: 60vh; gap: 16px; padding: 24px; text-align: center"
            >
                <template v-if="backendCapabilities.unsupportedReason">
                    <q-icon name="usb_off" size="48px" color="grey" />
                    <div class="text-h6">{{ backendCapabilities.unsupportedReason }}</div>
                </template>
                <template v-else-if="backendCapabilities.requiresUserConnect">
                    <q-icon name="usb" size="48px" color="primary" />
                    <div class="text-h6">Connect an XAP keyboard</div>
                    <q-btn color="primary" label="Connect" @click="connectDevice()" />
                </template>
            </div>
        </q-page-container>
        <q-page-sticky v-if="showSecureButton" position="bottom-right" :offset="[24, 24]">
            <q-btn
                fab
                :loading="device?.secure_status == 'Unlocking'"
                color="secondary"
                text-color="white"
                :icon="device?.secure_status == 'Unlocked' ? 'lock' : 'lock_open'"
                @click="
                    async () =>
                        device?.secure_status == 'Unlocked'
                            ? commands.xapSecureLock(device!.id)
                            : commands.xapSecureUnlock(device!.id)
                "
            />
        </q-page-sticky>
    </q-layout>
</template>
