'use client';

/**
 * ADR-375 Phase C.8 — "Hide BIM / Show only DXF" ribbon toggle.
 *
 * One-click isolate of all structural BIM object categories
 * (`STRUCTURAL_BIM_CATEGORIES`) so only the imported DXF entities remain
 * visible. Re-clicking restores the prior per-category visibility (snapshot
 * managed by the store), mirroring Revit's "Hide in View" / AutoCAD isolate.
 *
 * SSoT: reads/writes `useBimRenderSettingsStore.objectStyles` via the batch
 * `setBimObjectsVisibility` action (single debounced Firestore write).
 *
 * ADR-599: toggle markup ενοποιήθηκε στο `<RibbonToggleWidget config>` — `value`
 * μοντελοποιεί το "BIM κρυμμένο" (active=δείξε BIM / inactive=κρύψε BIM).
 */

import React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useBimRenderSettingsStore } from '../../../state/bim-render-settings-store';
import { STRUCTURAL_BIM_CATEGORIES } from '../../../config/bim-object-styles';
import { RibbonToggleWidget, type RibbonToggleConfig } from './RibbonToggleWidget';

const HIDE_BIM_TOGGLE: RibbonToggleConfig = {
  useToggleState: () => {
    const objectStyles = useBimRenderSettingsStore((s) => s.objectStyles);
    const setBimObjectsVisibility = useBimRenderSettingsStore((s) => s.setBimObjectsVisibility);
    const isBimHidden = STRUCTURAL_BIM_CATEGORIES.every(
      (cat) => objectStyles[cat].visible === false,
    );
    return {
      value: isBimHidden,
      toggle: () => setBimObjectsVisibility(isBimHidden),
    };
  },
  labelKey: 'ribbon.commands.hideBim.label',
  activeIcon: EyeOff,
  inactiveIcon: Eye,
  activeLabelKey: 'ribbon.commands.hideBim.show',
  inactiveLabelKey: 'ribbon.commands.hideBim.hide',
  activeTooltipKey: 'ribbon.commands.hideBim.tooltipShow',
  inactiveTooltipKey: 'ribbon.commands.hideBim.tooltipHide',
};

export const HideBimToggle: React.FC = () => (
  <RibbonToggleWidget config={HIDE_BIM_TOGGLE} />
);
