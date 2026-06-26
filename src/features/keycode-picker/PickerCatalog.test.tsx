import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { PickerCatalog } from './PickerCatalog'
import { ugoConstants } from '@/xap/mock/constants'

const noop = () => {}

const tabs = ugoConstants.keycode_view.tabs
const basicTabId = tabs.find((t) => t.subgroups.some((s) => s.render_mode === 'ansi'))!.id

// Task-4 integration tests (verbatim from brief)
it('Basic tab with no query renders the physical layout (positioned keys), not flat rows', () => {
  render(<PickerCatalog tabs={tabs} layerCount={8} activeTab={basicTabId} query="" onPick={() => {}} onHover={() => {}} />)
  // physical layout renders matched keys with the layout-key testid
  expect(screen.getAllByTestId('layout-key').length).toBeGreaterThan(20)
})

it('Basic tab with a query renders the flat filtered grid (no positioned canvas)', () => {
  render(<PickerCatalog tabs={tabs} layerCount={8} activeTab={basicTabId} query="esc" onPick={() => {}} onHover={() => {}} />)
  expect(screen.queryAllByTestId('layout-key')).toHaveLength(0)
  expect(screen.getByText('Esc')).toBeInTheDocument()
})

// Pre-existing tests (kept)
describe('PickerCatalog', () => {
  it('basic tab (render_mode:ansi) renders ANSI keys', () => {
    render(
      <PickerCatalog
        tabs={ugoConstants.keycode_view.tabs}
        layerCount={4}
        activeTab="basic"
        query=""
        onPick={noop}
        onHover={noop}
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
    render(
      <PickerCatalog
        tabs={ugoConstants.keycode_view.tabs}
        layerCount={4}
        activeTab="layer"
        query=""
        onPick={noop}
        onHover={noop}
      />,
    )
    // MO subgroup should expand 4 keys labeled L0..L3
    expect(screen.getAllByText('L0').length).toBeGreaterThan(0)
    expect(screen.getAllByText('L3').length).toBeGreaterThan(0)
    // No L4 since layerCount=4
    expect(screen.queryByText('L4')).toBeNull()
  })

  it('modtap tab expands MT mods', () => {
    render(
      <PickerCatalog
        tabs={ugoConstants.keycode_view.tabs}
        layerCount={4}
        activeTab="modtap"
        query=""
        onPick={noop}
        onHover={noop}
      />,
    )
    // MT subgroup has Ctrl, Shift, Alt, GUI, Meh, Hyper (human-readable labels)
    expect(screen.getByText('Ctrl')).toBeInTheDocument()
    expect(screen.getByText('Hyper')).toBeInTheDocument()
  })

  it('query filters codes in plain grid', () => {
    render(
      <PickerCatalog
        tabs={ugoConstants.keycode_view.tabs}
        layerCount={4}
        activeTab="lighting"
        query="hue"
        onPick={noop}
        onHover={noop}
      />,
    )
    // Hue+ and Hue- should appear, RGB Toggle should not
    expect(screen.getByText('Hue+')).toBeInTheDocument()
    expect(screen.queryByText('RGB Toggle')).toBeNull()
  })
})
