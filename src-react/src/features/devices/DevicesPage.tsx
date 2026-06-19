import { useDevices } from '@/queries/devices'

export function DevicesPage() {
  const { data: devices } = useDevices()

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: 'hsl(var(--foreground))' }}>
        Devices
      </h2>
      {devices?.map((d) => (
        <div
          key={d.id}
          style={{
            padding: '10px 14px',
            marginBottom: 8,
            borderRadius: 'calc(var(--radius) - 2px)',
            border: '1px solid hsl(var(--border))',
            background: 'hsl(var(--card))',
            fontSize: 12,
            color: 'hsl(var(--foreground))',
          }}
        >
          {d.product} · {d.manufacturer} · {d.secureStatus}
        </div>
      ))}
    </div>
  )
}
