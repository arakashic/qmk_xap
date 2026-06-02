import { XapEvent } from '@generated/xap-types'
import { addBackendListener, clearBackendListener } from '@/xap-runtime'
import { eventBus } from '@/utils/eventbus'

export function clearListener() {
    clearBackendListener()
}

export async function addListener() {
    await addBackendListener((event: XapEvent) => {
        eventBus.emit('xap', event)
    })
}
