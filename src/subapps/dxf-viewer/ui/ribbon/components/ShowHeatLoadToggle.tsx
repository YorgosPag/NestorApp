'use client';

/**
 * ADR-422 L1 — "Θερμικό Φορτίο" ribbon toggle (View tab).
 *
 * One-click master switch για το analytical heat-load overlay (Revit «Heating
 * Loads» χρωματικό φίλτρο): ON → κάθε θερμικός χώρος βάφεται με heat-map +
 * ετικέτα φορτίου· OFF → κανονικό σχέδιο. Thin reader/writer του `showHeatLoad`
 * per-view flag στο `useBimRenderSettingsStore` (SSoT, Firestore-persisted),
 * διαβασμένο από το `HeatLoadOverlay`.
 *
 * ADR-599: το markup/λογική toggle ενοποιήθηκε στο `<RibbonToggleWidget config>`
 * (store-backed inline toggle SSoT) — εδώ μένει μόνο το per-flag config.
 */

import React from 'react';
import { Flame, Ban } from 'lucide-react';
import { useBimRenderSettingsStore } from '../../../state/bim-render-settings-store';
import { RibbonToggleWidget, type RibbonToggleConfig } from './RibbonToggleWidget';

const HEAT_LOAD_TOGGLE: RibbonToggleConfig = {
  useToggleState: () => {
    const value = useBimRenderSettingsStore((s) => s.showHeatLoad);
    const set = useBimRenderSettingsStore((s) => s.setShowHeatLoad);
    return { value, toggle: () => set(!value) };
  },
  labelKey: 'ribbon.commands.heatLoad.label',
  activeIcon: Flame,
  inactiveIcon: Ban,
  activeLabelKey: 'ribbon.commands.heatLoad.disable',
  inactiveLabelKey: 'ribbon.commands.heatLoad.enable',
  activeTooltipKey: 'ribbon.commands.heatLoad.tooltipDisable',
  inactiveTooltipKey: 'ribbon.commands.heatLoad.tooltipEnable',
};

export const ShowHeatLoadToggle: React.FC = () => (
  <RibbonToggleWidget config={HEAT_LOAD_TOGGLE} />
);
