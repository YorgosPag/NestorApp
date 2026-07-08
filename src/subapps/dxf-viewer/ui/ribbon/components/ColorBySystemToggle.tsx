'use client';

/**
 * ADR-408 Φ7 — "Colour by system" ribbon toggle (View tab).
 *
 * One-click master switch for the colour-by-system graphics (Revit's "Color
 * circuits by system" view option): ON → circuit fixtures / panels / home-run
 * wires paint with their owning System's colour; OFF → they fall back to the
 * renderer default colour. Thin reader/writer of the single `colorBySystem`
 * per-view flag on `useBimRenderSettingsStore` (the SSoT, Firestore-persisted),
 * read by every 2D + 3D colour gate.
 *
 * ADR-599: toggle markup ενοποιήθηκε στο `<RibbonToggleWidget config>`.
 */

import React from 'react';
import { Palette, Ban } from 'lucide-react';
import { useBimRenderSettingsStore } from '../../../state/bim-render-settings-store';
import { RibbonToggleWidget, type RibbonToggleConfig } from './RibbonToggleWidget';

const COLOR_BY_SYSTEM_TOGGLE: RibbonToggleConfig = {
  useToggleState: () => {
    const value = useBimRenderSettingsStore((s) => s.colorBySystem);
    const set = useBimRenderSettingsStore((s) => s.setColorBySystem);
    return { value, toggle: () => set(!value) };
  },
  labelKey: 'ribbon.commands.colorBySystem.label',
  activeIcon: Palette,
  inactiveIcon: Ban,
  activeLabelKey: 'ribbon.commands.colorBySystem.disable',
  inactiveLabelKey: 'ribbon.commands.colorBySystem.enable',
  activeTooltipKey: 'ribbon.commands.colorBySystem.tooltipDisable',
  inactiveTooltipKey: 'ribbon.commands.colorBySystem.tooltipEnable',
};

export const ColorBySystemToggle: React.FC = () => (
  <RibbonToggleWidget config={COLOR_BY_SYSTEM_TOGGLE} />
);
