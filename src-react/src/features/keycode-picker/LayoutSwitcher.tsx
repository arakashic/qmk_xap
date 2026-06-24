import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { listLayouts } from './layouts/index'
import { usePrefsStore } from '@/store/prefs'

const layouts = listLayouts()

export function LayoutSwitcher() {
  const basicLayout = usePrefsStore((s) => s.basicLayout)

  return (
    <Select value={basicLayout} onValueChange={usePrefsStore.getState().setBasicLayout}>
      <SelectTrigger
        data-testid="layout-switcher"
        style={{ height: 26, fontSize: 10, padding: '0 8px', width: 'auto', minWidth: 70 }}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {layouts.map((l) => (
          <SelectItem key={l.id} value={l.id}>
            {l.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
