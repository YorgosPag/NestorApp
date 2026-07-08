/**
 * ADR-599 — Tests for the store-backed ribbon-toggle SSoT
 * (`RibbonInlineToggleButton` atom + `RibbonToggleWidget` config shell).
 *
 * Guarantees the invariants every one of the 12 single toggles now inherits:
 *   • the row renders its constant label + a single `aria-pressed` button;
 *   • `value=true` selects the active icon (opacity-80) / active label / active
 *     tooltip / semantic `info` colour, and `value=false` the inactive branch
 *     (opacity-60 / secondary) — including the visibility-inverted mapping where
 *     `value="visible"` and the active action is "hide";
 *   • clicking invokes the config's `toggle`.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { Flame, Ban } from 'lucide-react';
import { RibbonInlineToggleButton } from '../RibbonInlineToggleButton';
import { RibbonToggleWidget, type RibbonToggleConfig } from '../RibbonToggleWidget';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/ui-adapters/react/useSemanticColors', () => ({
  useSemanticColors: () => ({
    bg: { backgroundSecondary: 'bg-secondary' },
    text: { info: 'text-info', secondary: 'text-secondary', muted: 'text-muted' },
  }),
}));

describe('ADR-599 — RibbonInlineToggleButton (atom)', () => {
  it('renders an aria-pressed button with the resolved colour + label and fires onClick', () => {
    const onClick = jest.fn();
    const { getByRole } = render(
      <RibbonInlineToggleButton
        pressed
        onClick={onClick}
        ariaLabel="tip"
        icon={<Flame />}
        label="Θερμικό"
        colorClass="text-info"
      />,
    );
    const btn = getByRole('button');
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    expect(btn.getAttribute('aria-label')).toBe('tip');
    expect(btn.className).toContain('text-info');
    expect(btn.className).toContain('bg-secondary');
    expect(btn.textContent).toContain('Θερμικό');
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

/** Builds a config whose reactive state is driven by a caller-held ref. */
function makeConfig(value: boolean, toggle: () => void): RibbonToggleConfig {
  return {
    useToggleState: () => ({ value, toggle }),
    labelKey: 'row.label',
    activeIcon: Flame,
    inactiveIcon: Ban,
    activeLabelKey: 'inner.active',
    inactiveLabelKey: 'inner.inactive',
    activeTooltipKey: 'tip.active',
    inactiveTooltipKey: 'tip.inactive',
  };
}

describe('ADR-599 — RibbonToggleWidget (config shell)', () => {
  it('renders the constant row label plus one toggle button', () => {
    const { getByRole, container } = render(
      <RibbonToggleWidget config={makeConfig(false, () => {})} />,
    );
    expect(container.querySelector('.dxf-ribbon-combobox-label')?.textContent).toBe('row.label');
    expect(getByRole('button')).not.toBeNull();
  });

  it('selects the ACTIVE branch (icon opacity-80, active label + tooltip, info colour) when value=true', () => {
    const { getByRole } = render(<RibbonToggleWidget config={makeConfig(true, () => {})} />);
    const btn = getByRole('button');
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    expect(btn.getAttribute('aria-label')).toBe('tip.active');
    expect(btn.textContent).toContain('inner.active');
    expect(btn.className).toContain('text-info');
    expect(btn.querySelector('svg')?.getAttribute('class')).toContain('opacity-80');
  });

  it('selects the INACTIVE branch (icon opacity-60, inactive label + tooltip, secondary colour) when value=false', () => {
    const { getByRole } = render(<RibbonToggleWidget config={makeConfig(false, () => {})} />);
    const btn = getByRole('button');
    expect(btn.getAttribute('aria-pressed')).toBe('false');
    expect(btn.getAttribute('aria-label')).toBe('tip.inactive');
    expect(btn.textContent).toContain('inner.inactive');
    expect(btn.className).toContain('text-secondary');
    expect(btn.querySelector('svg')?.getAttribute('class')).toContain('opacity-60');
  });

  it('invokes the config toggle on click', () => {
    const toggle = jest.fn();
    const { getByRole } = render(<RibbonToggleWidget config={makeConfig(true, toggle)} />);
    fireEvent.click(getByRole('button'));
    expect(toggle).toHaveBeenCalledTimes(1);
  });

  it('supports visibility-inverted configs (value="visible" → active action = hide)', () => {
    // Mirrors DrainPipe/MepWire: value models "visible", active label is the
    // "hide" action, pressed=visible.
    const config: RibbonToggleConfig = {
      useToggleState: () => ({ value: true, toggle: () => {} }),
      labelKey: 'drain.label',
      activeIcon: Flame,
      inactiveIcon: Ban,
      activeLabelKey: 'drain.hide',
      inactiveLabelKey: 'drain.show',
      activeTooltipKey: 'drain.tooltipHide',
      inactiveTooltipKey: 'drain.tooltipShow',
    };
    const { getByRole } = render(<RibbonToggleWidget config={config} />);
    const btn = getByRole('button');
    expect(btn.getAttribute('aria-pressed')).toBe('true'); // visible → pressed
    expect(btn.textContent).toContain('drain.hide'); // offers the turn-off action
    expect(btn.getAttribute('aria-label')).toBe('drain.tooltipHide');
  });
});
