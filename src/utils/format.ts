export function formatBcdVersion(version: number | string | null | undefined): string {
    if (version == null) {
        return ''
    }

    const raw = typeof version === 'string' ? Number(version) : version

    if (!Number.isFinite(raw) || raw < 0) {
        return String(version)
    }

    const hex = Math.trunc(raw).toString(16).padStart(8, '0').slice(-8).toUpperCase()

    if (!/^[0-9]{8}$/.test(hex)) {
        return `0x${hex}`
    }

    return `${Number(hex.slice(0, 2))}.${Number(hex.slice(2, 4))}.${Number(hex.slice(4, 8))}`
}
