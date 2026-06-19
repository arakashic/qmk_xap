import { render, screen } from '@testing-library/react'
import { PickerCatalog } from './PickerCatalog'
import { ugoConstants } from '@/xap/mock/constants'

const noop = () => {}

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
    // basic tab has letters A-Z in the ANSI layout
    expect(screen.getAllByRole('button').length).toBeGreaterThan(10)
    // Tab chips are rendered
    expect(screen.getByText('Basic')).toBeInTheDocument()
    expect(screen.getByText('Layer')).toBeInTheDocument()
    expect(screen.getByText('Mod-Tap')).toBeInTheDocument()
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
