'use client';

/**
 * ADR-422 L4 — «Υδραυλική Εξισορρόπηση» ribbon toggle (View tab).
 *
 * One-click master switch για το hydraulic-balancing overlay (Revit «System
 * Inspector» preview): ON → κάθε καλοριφέρ δείχνει badge με ΔP κυκλώματος + απαιτ. kv
 * balancing valve, με highlight του index circuit + μανομετρικό κυκλοφορητή στην πηγή·
 * OFF → κανονικό σχέδιο. Thin reader/writer του `showBalancing` (transient view flag,
 * `useHydraulicBalancingViewStore`), διαβασμένο από το `HydraulicBalancingOverlay`.
 *
 * ADR-599: toggle markup ενοποιήθηκε στο `<RibbonToggleWidget config>`.
 */

import React from 'react';
import { Scale, Ban } from 'lucide-react';
import { useHydraulicBalancingViewStore } from '../../../state/hydraulic-balancing-view-store';
import { RibbonToggleWidget, type RibbonToggleConfig } from './RibbonToggleWidget';

const BALANCING_TOGGLE: RibbonToggleConfig = {
  useToggleState: () => {
    const value = useHydraulicBalancingViewStore((s) => s.showBalancing);
    const set = useHydraulicBalancingViewStore((s) => s.setShowBalancing);
    return { value, toggle: () => set(!value) };
  },
  labelKey: 'ribbon.commands.balancing.label',
  activeIcon: Scale,
  inactiveIcon: Ban,
  activeLabelKey: 'ribbon.commands.balancing.disable',
  inactiveLabelKey: 'ribbon.commands.balancing.enable',
  activeTooltipKey: 'ribbon.commands.balancing.tooltipDisable',
  inactiveTooltipKey: 'ribbon.commands.balancing.tooltipEnable',
};

export const ShowBalancingToggle: React.FC = () => (
  <RibbonToggleWidget config={BALANCING_TOGGLE} />
);
