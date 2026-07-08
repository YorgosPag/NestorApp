'use client';

/**
 * ADR-485 (T3-UI / Slice 4c) — «Επάρκεια/Utilization» ribbon toggle (View tab).
 *
 * One-click master switch για το canvas overlay επάρκειας οπλισμού (Robot/SAP2000
 * stress map): ON → κάθε φέρον μέλος βάφεται πράσινο/πορτοκαλί/κόκκινο ανά
 * As,req/As,prov· OFF → κανονικό σχέδιο. Thin reader/writer του `showUtilization`
 * flag στο TRANSIENT `useAnalysisDiagramViewStore`, διαβασμένο από το
 * `StructuralUtilizationOverlay`.
 *
 * ADR-599: toggle markup ενοποιήθηκε στο `<RibbonToggleWidget config>`.
 */

import React from 'react';
import { Gauge, Ban } from 'lucide-react';
import { useAnalysisDiagramViewStore } from '../../../state/analysis-diagram-view-store';
import { RibbonToggleWidget, type RibbonToggleConfig } from './RibbonToggleWidget';

const UTILIZATION_TOGGLE: RibbonToggleConfig = {
  useToggleState: () => {
    const value = useAnalysisDiagramViewStore((s) => s.showUtilization);
    const set = useAnalysisDiagramViewStore((s) => s.setShowUtilization);
    return { value, toggle: () => set(!value) };
  },
  labelKey: 'ribbon.commands.utilization.label',
  activeIcon: Gauge,
  inactiveIcon: Ban,
  activeLabelKey: 'ribbon.commands.utilization.disable',
  inactiveLabelKey: 'ribbon.commands.utilization.enable',
  activeTooltipKey: 'ribbon.commands.utilization.tooltipDisable',
  inactiveTooltipKey: 'ribbon.commands.utilization.tooltipEnable',
};

export const ShowUtilizationToggle: React.FC = () => (
  <RibbonToggleWidget config={UTILIZATION_TOGGLE} />
);
