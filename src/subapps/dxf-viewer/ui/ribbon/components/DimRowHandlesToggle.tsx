'use client';

/**
 * ADR-362 Round 35 — «Λαβές Μετακίνησης Σειρών» ribbon toggle.
 *
 * Flips `DimRowHandleModeStore`: when ON, the `DimRowHandleOverlay` shows ONE handle
 * per dimension row docked at the viewport edge; dragging a handle offsets the whole
 * row perpendicular to its axis. `useDimRowHandleModeActive` self-subscribes the
 * store so the pressed state is LIVE.
 *
 * ADR-599: toggle markup ενοποιήθηκε στο `<RibbonToggleWidget config>`. Ένα μόνο
 * εικονίδιο (`MoveVertical`) και στις δύο καταστάσεις — inactive πλέον opacity-60
 * (πρώην σταθερά 80): αβαρές affordance dimming, ευθυγραμμισμένο με τα υπόλοιπα toggles.
 */

import React from 'react';
import { MoveVertical } from 'lucide-react';
import {
  DimRowHandleModeStore,
  useDimRowHandleModeActive,
} from '../../../systems/dimensions/DimRowHandleModeStore';
import { RibbonToggleWidget, type RibbonToggleConfig } from './RibbonToggleWidget';

const DIM_ROW_HANDLES_TOGGLE: RibbonToggleConfig = {
  useToggleState: () => {
    const value = useDimRowHandleModeActive();
    return { value, toggle: () => DimRowHandleModeStore.toggle() };
  },
  labelKey: 'ribbon.commands.dimRowHandles.label',
  activeIcon: MoveVertical,
  inactiveIcon: MoveVertical,
  activeLabelKey: 'ribbon.commands.dimRowHandles.on',
  inactiveLabelKey: 'ribbon.commands.dimRowHandles.off',
  activeTooltipKey: 'ribbon.commands.dimRowHandles.tooltipOff',
  inactiveTooltipKey: 'ribbon.commands.dimRowHandles.tooltipOn',
};

export const DimRowHandlesToggle: React.FC = () => (
  <RibbonToggleWidget config={DIM_ROW_HANDLES_TOGGLE} />
);
