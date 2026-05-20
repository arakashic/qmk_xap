<script setup lang="ts">
    import { computed } from 'vue'
    import type { StyleValue } from 'vue'
    import type { KeyCode } from '@generated/xap'

    const props = defineProps<{ codes: KeyCode[]; disabled: boolean }>()
    const emit = defineEmits<{ select: [code: number] }>()

    const UNIT = 3.5 // rem per keyboard unit

    interface KeyPos {
        key: string
        x: number
        y: number
        w: number
        h: number
    }

    const ANSI_LAYOUT: KeyPos[] = [
        // Function row (y=0)
        { key: 'KC_ESCAPE', x: 0, y: 0, w: 1, h: 1 },
        { key: 'KC_F1', x: 2, y: 0, w: 1, h: 1 },
        { key: 'KC_F2', x: 3, y: 0, w: 1, h: 1 },
        { key: 'KC_F3', x: 4, y: 0, w: 1, h: 1 },
        { key: 'KC_F4', x: 5, y: 0, w: 1, h: 1 },
        { key: 'KC_F5', x: 6.5, y: 0, w: 1, h: 1 },
        { key: 'KC_F6', x: 7.5, y: 0, w: 1, h: 1 },
        { key: 'KC_F7', x: 8.5, y: 0, w: 1, h: 1 },
        { key: 'KC_F8', x: 9.5, y: 0, w: 1, h: 1 },
        { key: 'KC_F9', x: 11, y: 0, w: 1, h: 1 },
        { key: 'KC_F10', x: 12, y: 0, w: 1, h: 1 },
        { key: 'KC_F11', x: 13, y: 0, w: 1, h: 1 },
        { key: 'KC_F12', x: 14, y: 0, w: 1, h: 1 },
        { key: 'KC_PRINT_SCREEN', x: 15.5, y: 0, w: 1, h: 1 },
        { key: 'KC_SCROLL_LOCK', x: 16.5, y: 0, w: 1, h: 1 },
        { key: 'KC_PAUSE', x: 17.5, y: 0, w: 1, h: 1 },

        // Number row (y=1.5)
        { key: 'KC_GRAVE', x: 0, y: 1.5, w: 1, h: 1 },
        { key: 'KC_1', x: 1, y: 1.5, w: 1, h: 1 },
        { key: 'KC_2', x: 2, y: 1.5, w: 1, h: 1 },
        { key: 'KC_3', x: 3, y: 1.5, w: 1, h: 1 },
        { key: 'KC_4', x: 4, y: 1.5, w: 1, h: 1 },
        { key: 'KC_5', x: 5, y: 1.5, w: 1, h: 1 },
        { key: 'KC_6', x: 6, y: 1.5, w: 1, h: 1 },
        { key: 'KC_7', x: 7, y: 1.5, w: 1, h: 1 },
        { key: 'KC_8', x: 8, y: 1.5, w: 1, h: 1 },
        { key: 'KC_9', x: 9, y: 1.5, w: 1, h: 1 },
        { key: 'KC_0', x: 10, y: 1.5, w: 1, h: 1 },
        { key: 'KC_MINUS', x: 11, y: 1.5, w: 1, h: 1 },
        { key: 'KC_EQUAL', x: 12, y: 1.5, w: 1, h: 1 },
        { key: 'KC_BACKSPACE', x: 13, y: 1.5, w: 2, h: 1 },

        // QWERTY row (y=2.5)
        { key: 'KC_TAB', x: 0, y: 2.5, w: 1.5, h: 1 },
        { key: 'KC_Q', x: 1.5, y: 2.5, w: 1, h: 1 },
        { key: 'KC_W', x: 2.5, y: 2.5, w: 1, h: 1 },
        { key: 'KC_E', x: 3.5, y: 2.5, w: 1, h: 1 },
        { key: 'KC_R', x: 4.5, y: 2.5, w: 1, h: 1 },
        { key: 'KC_T', x: 5.5, y: 2.5, w: 1, h: 1 },
        { key: 'KC_Y', x: 6.5, y: 2.5, w: 1, h: 1 },
        { key: 'KC_U', x: 7.5, y: 2.5, w: 1, h: 1 },
        { key: 'KC_I', x: 8.5, y: 2.5, w: 1, h: 1 },
        { key: 'KC_O', x: 9.5, y: 2.5, w: 1, h: 1 },
        { key: 'KC_P', x: 10.5, y: 2.5, w: 1, h: 1 },
        { key: 'KC_LEFT_BRACKET', x: 11.5, y: 2.5, w: 1, h: 1 },
        { key: 'KC_RIGHT_BRACKET', x: 12.5, y: 2.5, w: 1, h: 1 },
        { key: 'KC_BACKSLASH', x: 13.5, y: 2.5, w: 1.5, h: 1 },

        // Caps row (y=3.5)
        { key: 'KC_CAPS_LOCK', x: 0, y: 3.5, w: 1.75, h: 1 },
        { key: 'KC_A', x: 1.75, y: 3.5, w: 1, h: 1 },
        { key: 'KC_S', x: 2.75, y: 3.5, w: 1, h: 1 },
        { key: 'KC_D', x: 3.75, y: 3.5, w: 1, h: 1 },
        { key: 'KC_F', x: 4.75, y: 3.5, w: 1, h: 1 },
        { key: 'KC_G', x: 5.75, y: 3.5, w: 1, h: 1 },
        { key: 'KC_H', x: 6.75, y: 3.5, w: 1, h: 1 },
        { key: 'KC_J', x: 7.75, y: 3.5, w: 1, h: 1 },
        { key: 'KC_K', x: 8.75, y: 3.5, w: 1, h: 1 },
        { key: 'KC_L', x: 9.75, y: 3.5, w: 1, h: 1 },
        { key: 'KC_SEMICOLON', x: 10.75, y: 3.5, w: 1, h: 1 },
        { key: 'KC_QUOTE', x: 11.75, y: 3.5, w: 1, h: 1 },
        { key: 'KC_ENTER', x: 12.75, y: 3.5, w: 2.25, h: 1 },

        // Shift row (y=4.5)
        { key: 'KC_LEFT_SHIFT', x: 0, y: 4.5, w: 2.25, h: 1 },
        { key: 'KC_Z', x: 2.25, y: 4.5, w: 1, h: 1 },
        { key: 'KC_X', x: 3.25, y: 4.5, w: 1, h: 1 },
        { key: 'KC_C', x: 4.25, y: 4.5, w: 1, h: 1 },
        { key: 'KC_V', x: 5.25, y: 4.5, w: 1, h: 1 },
        { key: 'KC_B', x: 6.25, y: 4.5, w: 1, h: 1 },
        { key: 'KC_N', x: 7.25, y: 4.5, w: 1, h: 1 },
        { key: 'KC_M', x: 8.25, y: 4.5, w: 1, h: 1 },
        { key: 'KC_COMMA', x: 9.25, y: 4.5, w: 1, h: 1 },
        { key: 'KC_DOT', x: 10.25, y: 4.5, w: 1, h: 1 },
        { key: 'KC_SLASH', x: 11.25, y: 4.5, w: 1, h: 1 },
        { key: 'KC_RIGHT_SHIFT', x: 12.25, y: 4.5, w: 2.75, h: 1 },

        // Bottom row (y=5.5)
        { key: 'KC_LEFT_CTRL', x: 0, y: 5.5, w: 1.25, h: 1 },
        { key: 'KC_LEFT_GUI', x: 1.25, y: 5.5, w: 1.25, h: 1 },
        { key: 'KC_LEFT_ALT', x: 2.5, y: 5.5, w: 1.25, h: 1 },
        { key: 'KC_SPACE', x: 3.75, y: 5.5, w: 6.25, h: 1 },
        { key: 'KC_RIGHT_ALT', x: 10, y: 5.5, w: 1.25, h: 1 },
        { key: 'KC_RIGHT_GUI', x: 11.25, y: 5.5, w: 1.25, h: 1 },
        { key: 'KC_APPLICATION', x: 12.5, y: 5.5, w: 1.25, h: 1 },
        { key: 'KC_RIGHT_CTRL', x: 13.75, y: 5.5, w: 1.25, h: 1 },

        // Edit cluster (x offset = 15.5)
        { key: 'KC_INSERT', x: 15.5, y: 1.5, w: 1, h: 1 },
        { key: 'KC_HOME', x: 16.5, y: 1.5, w: 1, h: 1 },
        { key: 'KC_PAGE_UP', x: 17.5, y: 1.5, w: 1, h: 1 },
        { key: 'KC_DELETE', x: 15.5, y: 2.5, w: 1, h: 1 },
        { key: 'KC_END', x: 16.5, y: 2.5, w: 1, h: 1 },
        { key: 'KC_PAGE_DOWN', x: 17.5, y: 2.5, w: 1, h: 1 },

        // Arrow keys
        { key: 'KC_UP', x: 16.5, y: 4.5, w: 1, h: 1 },
        { key: 'KC_LEFT', x: 15.5, y: 5.5, w: 1, h: 1 },
        { key: 'KC_DOWN', x: 16.5, y: 5.5, w: 1, h: 1 },
        { key: 'KC_RIGHT', x: 17.5, y: 5.5, w: 1, h: 1 },

        // Numpad (x offset = 19)
        { key: 'KC_NUM_LOCK', x: 19, y: 1.5, w: 1, h: 1 },
        { key: 'KC_KP_SLASH', x: 20, y: 1.5, w: 1, h: 1 },
        { key: 'KC_KP_ASTERISK', x: 21, y: 1.5, w: 1, h: 1 },
        { key: 'KC_KP_MINUS', x: 22, y: 1.5, w: 1, h: 1 },
        { key: 'KC_KP_7', x: 19, y: 2.5, w: 1, h: 1 },
        { key: 'KC_KP_8', x: 20, y: 2.5, w: 1, h: 1 },
        { key: 'KC_KP_9', x: 21, y: 2.5, w: 1, h: 1 },
        { key: 'KC_KP_PLUS', x: 22, y: 2.5, w: 1, h: 2 },
        { key: 'KC_KP_4', x: 19, y: 3.5, w: 1, h: 1 },
        { key: 'KC_KP_5', x: 20, y: 3.5, w: 1, h: 1 },
        { key: 'KC_KP_6', x: 21, y: 3.5, w: 1, h: 1 },
        { key: 'KC_KP_1', x: 19, y: 4.5, w: 1, h: 1 },
        { key: 'KC_KP_2', x: 20, y: 4.5, w: 1, h: 1 },
        { key: 'KC_KP_3', x: 21, y: 4.5, w: 1, h: 1 },
        { key: 'KC_KP_ENTER', x: 22, y: 4.5, w: 1, h: 2 },
        { key: 'KC_KP_0', x: 19, y: 5.5, w: 2, h: 1 },
        { key: 'KC_KP_DOT', x: 21, y: 5.5, w: 1, h: 1 },
    ]

    const OVERFLOW_GROUPS = [
        {
            label: 'Extended F-Keys',
            keys: [
                'KC_F13', 'KC_F14', 'KC_F15', 'KC_F16', 'KC_F17', 'KC_F18',
                'KC_F19', 'KC_F20', 'KC_F21', 'KC_F22', 'KC_F23', 'KC_F24',
            ],
        },
        {
            label: 'Non-US',
            keys: ['KC_NONUS_HASH', 'KC_NONUS_BACKSLASH'],
        },
        {
            label: 'Locking Keys',
            keys: ['KC_LOCKING_CAPS_LOCK', 'KC_LOCKING_NUM_LOCK', 'KC_LOCKING_SCROLL_LOCK'],
        },
        {
            label: 'Numpad Extras',
            keys: ['KC_KP_EQUAL', 'KC_KP_EQUAL_AS400', 'KC_KP_COMMA'],
        },
        {
            label: 'Commands',
            keys: [
                'KC_KB_POWER', 'KC_EXECUTE', 'KC_HELP', 'KC_MENU', 'KC_SELECT', 'KC_STOP',
                'KC_AGAIN', 'KC_UNDO', 'KC_CUT', 'KC_COPY', 'KC_PASTE', 'KC_FIND',
                'KC_KB_MUTE', 'KC_KB_VOLUME_UP', 'KC_KB_VOLUME_DOWN',
                'KC_ALTERNATE_ERASE', 'KC_SYSTEM_REQUEST', 'KC_CANCEL', 'KC_CLEAR',
                'KC_PRIOR', 'KC_RETURN', 'KC_SEPARATOR', 'KC_OUT', 'KC_OPER',
                'KC_CLEAR_AGAIN', 'KC_CRSEL', 'KC_EXSEL',
            ],
        },
        {
            label: 'International',
            keys: [
                'KC_INTERNATIONAL_1', 'KC_INTERNATIONAL_2', 'KC_INTERNATIONAL_3',
                'KC_INTERNATIONAL_4', 'KC_INTERNATIONAL_5', 'KC_INTERNATIONAL_6',
                'KC_INTERNATIONAL_7', 'KC_INTERNATIONAL_8', 'KC_INTERNATIONAL_9',
                'KC_LANGUAGE_1', 'KC_LANGUAGE_2', 'KC_LANGUAGE_3', 'KC_LANGUAGE_4',
                'KC_LANGUAGE_5', 'KC_LANGUAGE_6', 'KC_LANGUAGE_7', 'KC_LANGUAGE_8',
                'KC_LANGUAGE_9',
            ],
        },
    ]

    const codeMap = computed(() => {
        const m = new Map<string, KeyCode>()
        for (const c of props.codes) m.set(c.key, c)
        return m
    })

    const layoutKeys = computed(() =>
        ANSI_LAYOUT.map((pos) => ({ pos, code: codeMap.value.get(pos.key) ?? null })),
    )

    const overflowGroups = computed(() =>
        OVERFLOW_GROUPS.map((g) => ({
            label: g.label,
            codes: g.keys.flatMap((k) => {
                const c = codeMap.value.get(k)
                return c ? [c] : []
            }),
        })).filter((g) => g.codes.length > 0),
    )

    function posToStyle(pos: KeyPos): StyleValue {
        const top = `${pos.y * UNIT}rem`
        const left = `${pos.x * UNIT}rem`
        const width = `${pos.w * UNIT - 0.25}rem`
        const height = `${pos.h * UNIT - 0.25}rem`
        return {
            '--key-top': top,
            '--key-left': left,
            '--key-width': width,
            '--key-height': height,
            position: 'absolute',
            top,
            left,
            width,
            height,
        } as Record<string, string>
    }
</script>

<template>
    <div style="overflow-x: auto">
        <div
            class="relative"
            :style="{ width: `${23 * UNIT}rem`, height: `${6.5 * UNIT}rem` }"
        >
            <button
                v-for="{ pos, code } in layoutKeys"
                :key="pos.key"
                class="key-button key-name-button absolute rounded-lg p-1 border-2 ring-4 ring-inset shadow-md border-black ring-neutral-300 text-black"
                :class="{ 'opacity-30 cursor-default': code === null }"
                :disabled="props.disabled || code === null || code.code === undefined"
                :style="posToStyle(pos)"
                @click="code?.code !== undefined && emit('select', code.code)"
            >
                <span class="text-xs leading-tight">{{
                    code?.label ?? code?.key ?? pos.key
                }}</span>
            </button>
        </div>
        <div
            v-for="group in overflowGroups"
            :key="group.label"
            class="mt-4"
        >
            <div class="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">
                {{ group.label }}
            </div>
            <div class="flex flex-wrap gap-2">
                <button
                    v-for="code in group.codes"
                    :key="code.code"
                    :disabled="props.disabled || code.code === undefined"
                    style="width: 3.25rem; height: 3.25rem"
                    class="keycode-button key-name-button rounded-lg p-2 border-2 ring-4 ring-inset shadow-md border-black ring-neutral-300 text-black"
                    @click="code.code !== undefined && emit('select', code.code)"
                >
                    <span>{{ code.label ?? code.key }}</span>
                </button>
            </div>
        </div>
    </div>
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
</style>
