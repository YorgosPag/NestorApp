'use client';

/**
 * ADR-422 L3 — «Διαστασιολόγηση Σωληνώσεων» ribbon toggle (View tab).
 *
 * One-click master switch για το pipe-sizing overlay (Revit «Pipe Sizing» preview):
 * ON → κάθε σωλήνας θέρμανσης δείχνει badge με προτεινόμενη DN + ταχύτητα· OFF →
 * κανονικό σχέδιο. Thin reader/writer του `showPipeSizing` (transient view flag,
 * `usePipeSizingViewStore`), διαβασμένο από το `PipeSizingOverlay`.
 *
 * ADR-599: toggle markup ενοποιήθηκε στο `<RibbonToggleWidget config>`.
 */

import React from 'react';
import { Gauge, Ban } from 'lucide-react';
import { usePipeSizingViewStore } from '../../../state/pipe-sizing-view-store';
import { RibbonToggleWidget, type RibbonToggleConfig } from './RibbonToggleWidget';

const PIPE_SIZING_TOGGLE: RibbonToggleConfig = {
  useToggleState: () => {
    const value = usePipeSizingViewStore((s) => s.showPipeSizing);
    const set = usePipeSizingViewStore((s) => s.setShowPipeSizing);
    return { value, toggle: () => set(!value) };
  },
  labelKey: 'ribbon.commands.pipeSizing.label',
  activeIcon: Gauge,
  inactiveIcon: Ban,
  activeLabelKey: 'ribbon.commands.pipeSizing.disable',
  inactiveLabelKey: 'ribbon.commands.pipeSizing.enable',
  activeTooltipKey: 'ribbon.commands.pipeSizing.tooltipDisable',
  inactiveTooltipKey: 'ribbon.commands.pipeSizing.tooltipEnable',
};

export const ShowPipeSizingToggle: React.FC = () => (
  <RibbonToggleWidget config={PIPE_SIZING_TOGGLE} />
);
