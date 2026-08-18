import type { ReactElement } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { PickerCatalog } from './PickerCatalog'
import { ugoConstants } from '@/xap/mock/constants'

const noop = () => {}

function renderCatalog(ui: ReactElement) {
  return render(<TooltipProvider delayDuration={0}>{ui}</TooltipProvider>)
}

const tabs = ugoConstants.keycode_view.tabs
const basicTabId = tabs.find((t) => t.subgroups.some((s) => s.render_mode === 'ansi'))!.id

// Task-4 integration tests (verbatim from brief)
it('Basic tab with no query renders the physical layout (positioned keys), not flat rows', () => {
  renderCatalog(<PickerCatalog tabs={tabs} layerCount={8} activeTab={basicTabId} query="" onPick={() => {}} />)
  // physical layout renders matched keys with the layout-key testid
  expect(screen.getAllByTestId('layout-key').length).toBeGreaterThan(20)
})

it('Basic tab with a query renders the flat filtered grid (no positioned canvas)', () => {
  renderCatalog(<PickerCatalog tabs={tabs} layerCount={8} activeTab={basicTabId} query="esc" onPick={() => {}} />)
  expect(screen.queryAllByTestId('layout-key')).toHaveLength(0)
  expect(screen.getByText('Esc')).toBeInTheDocument()
})

// End-to-end coverage for the mock catalog's seeded cap_label (KC_BACKSPACE):
// proves cap_label actually reaches the rendered cap through the real
// PickerCatalog -> BasicKeyboardLayout -> KeyCap -> legendOf path, not just
// the Rust catalog and the KeyCap unit test in isolation.
it('Basic tab physical layout renders the mock KC_BACKSPACE cap_label wrapped', () => {
  renderCatalog(<PickerCatalog tabs={tabs} layerCount={8} activeTab={basicTabId} query="" onPick={() => {}} />)
  const legend = screen.getByText((_, el) => el?.getAttribute('data-testid') === 'cap-legend' && el?.textContent === 'Back\nSpace')
  expect(legend).toBeInTheDocument()
})

// Pre-existing tests (kept)
describe('PickerCatalog', () => {
  it('basic tab (render_mode:ansi) renders ANSI keys', () => {
    renderCatalog(
      <PickerCatalog
        tabs={ugoConstants.keycode_view.tabs}
        layerCount={4}
        activeTab="basic"
        query=""
        onPick={noop}
      />,
    )
    // physical layout renders buttons with layout-key testid
    expect(screen.getAllByTestId('layout-key').length).toBeGreaterThan(10)
    // Tab chips are no longer rendered by PickerCatalog — owned by PickerDock
    expect(screen.queryByText('Basic')).toBeNull()
    expect(screen.queryByText('Layer')).toBeNull()
    expect(screen.queryByText('Mod-Tap')).toBeNull()
  })

  it('layer tab expands MO(0)..MO(layerCount-1)', () => {
    renderCatalog(
      <PickerCatalog
        tabs={ugoConstants.keycode_view.tabs}
        layerCount={4}
        activeTab="layer"
        query=""
        onPick={noop}
      />,
    )
    // MO subgroup should expand 4 keys labeled L0..L3
    expect(screen.getAllByText('L0').length).toBeGreaterThan(0)
    expect(screen.getAllByText('L3').length).toBeGreaterThan(0)
    // No L4 since layerCount=4
    expect(screen.queryByText('L4')).toBeNull()
  })

  it('modtap tab expands MT mods', () => {
    renderCatalog(
      <PickerCatalog
        tabs={ugoConstants.keycode_view.tabs}
        layerCount={4}
        activeTab="modtap"
        query=""
        onPick={noop}
      />,
    )
    // MT subgroup has Ctrl, Shift, Alt, GUI, Meh, Hyper (human-readable labels)
    expect(screen.getByText('Ctrl')).toBeInTheDocument()
    expect(screen.getByText('Hyper')).toBeInTheDocument()
  })

  it('query filters codes in plain grid', () => {
    renderCatalog(
      <PickerCatalog
        tabs={ugoConstants.keycode_view.tabs}
        layerCount={4}
        activeTab="lighting"
        query="hue"
        onPick={noop}
      />,
    )
    // Hue+ and Hue- should appear, RGB Toggle should not
    expect(screen.getByText('Hue+')).toBeInTheDocument()
    expect(screen.queryByText('RGB Toggle')).toBeNull()
  })
})
