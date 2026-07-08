'use client';

/**
 * ADR-456 Slice 3 — "Οπλισμός" ribbon toggle (View tab).
 *
 * One-click master switch για τη σχεδίαση οπλισμού κολώνας (διαμήκεις ράβδες +
 * στεφάνια): ON → κάθε ορθογωνική κολώνα με ορισμένο `reinforcement` δείχνει τις
 * ράβδες/στεφάνια σε 2D κάτοψη + 3D/τομή· OFF → γυμνή διατομή. Thin reader/writer
 * του `showReinforcement` per-view flag στο `useBimRenderSettingsStore` (SSoT,
 * Firestore-persisted), διαβασμένο event-time από τον 2D orchestrator + 3D
 * converter. Visibility-only (Revit): το schedule μετράει πάντα τον οπλισμό.
 *
 * ADR-599: toggle markup ενοποιήθηκε στο `<RibbonToggleWidget config>`.
 */

import React from 'react';
import { Grid2x2Check, Grid2x2X } from 'lucide-react';
import { useBimRenderSettingsStore } from '../../../state/bim-render-settings-store';
import { RibbonToggleWidget, type RibbonToggleConfig } from './RibbonToggleWidget';

const REINFORCEMENT_TOGGLE: RibbonToggleConfig = {
  useToggleState: () => {
    const value = useBimRenderSettingsStore((s) => s.showReinforcement);
    const set = useBimRenderSettingsStore((s) => s.setShowReinforcement);
    return { value, toggle: () => set(!value) };
  },
  labelKey: 'ribbon.commands.reinforcement.label',
  activeIcon: Grid2x2Check,
  inactiveIcon: Grid2x2X,
  activeLabelKey: 'ribbon.commands.reinforcement.disable',
  inactiveLabelKey: 'ribbon.commands.reinforcement.enable',
  activeTooltipKey: 'ribbon.commands.reinforcement.tooltipDisable',
  inactiveTooltipKey: 'ribbon.commands.reinforcement.tooltipEnable',
};

export const ShowReinforcementToggle: React.FC = () => (
  <RibbonToggleWidget config={REINFORCEMENT_TOGGLE} />
);
