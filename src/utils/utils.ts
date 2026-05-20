import { Notify } from 'quasar'

export function notifyError(err: unknown) {
    Notify.create({
        type: 'negative',
        message: 'Error: ' + err,
    })
}

export function notifyDeviceLocked() {
    Notify.create({
        message: 'Device is locked',
        color: 'red',
        textColor: 'white',
        icon: 'block',
    })
}
