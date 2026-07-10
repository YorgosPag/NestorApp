'use client';

/**
 * ADR-531 Φ5b.3 — «Μόνο κάτοψη DXF» (plan-lines) ribbon toggle.
 *
 * One-click εναλλαγή της όψης ΟΛΩΝ των BIM τοίχων/κουφωμάτων ανάμεσα σε πλήρη BIM
 * (γέμισμα/διαγράμμιση/λαβές) και **καθαρές γραμμές κάτοψης** (περίγραμμα παρειών
 * κομμένο στα ανοίγματα + σύμβολο πόρτας/παραθύρου) — όπως το top-view του Τέκτονα.
 * ΜΙΑ οντότητα, δύο όψεις (Revit-grade· απόφαση Giorgio 2026-07-10).
 *
 * SSoT: reads/writes `useBimRenderSettingsStore.planLinesOnly` via `setPlanLinesOnly`
 * (per-view, single debounced Firestore write). ADR-599 markup ενοποίηση μέσω
 * `<RibbonToggleWidget config>` — `value` μοντελοποιεί το «plan-lines ενεργό».
 */

import React from 'react';
import { PenLine, Box } from 'lucide-react';
import { useBimRenderSettingsStore } from '../../../state/bim-render-settings-store';
import { RibbonToggleWidget, type RibbonToggleConfig } from './RibbonToggleWidget';

const PLAN_LINES_TOGGLE: RibbonToggleConfig = {
  useToggleState: () => {
    const planLinesOnly = useBimRenderSettingsStore((s) => s.planLinesOnly);
    const setPlanLinesOnly = useBimRenderSettingsStore((s) => s.setPlanLinesOnly);
    return {
      value: planLinesOnly,
      toggle: () => setPlanLinesOnly(!planLinesOnly),
    };
  },
  labelKey: 'ribbon.commands.planLines.label',
  activeIcon: PenLine,
  inactiveIcon: Box,
  activeLabelKey: 'ribbon.commands.planLines.full',
  inactiveLabelKey: 'ribbon.commands.planLines.lines',
  activeTooltipKey: 'ribbon.commands.planLines.tooltipFull',
  inactiveTooltipKey: 'ribbon.commands.planLines.tooltipLines',
};

export const PlanLinesToggle: React.FC = () => (
  <RibbonToggleWidget config={PLAN_LINES_TOGGLE} />
);
