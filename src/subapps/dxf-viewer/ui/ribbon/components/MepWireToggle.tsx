'use client';

/**
 * ADR-408 Φ7 — "Show / hide circuit wires" ribbon toggle (View tab).
 *
 * One-click show/hide of the derived home-run wire annotation
 * (`HomeRunWiresOverlay` 2D + `syncWires` 3D), Revit's "Wires" sub-category in a
 * view. A thin reader/writer of the single `'mep-wire'` BIM category visibility —
 * no bespoke flag, the existing per-view `objectStyles` machinery is the SSoT (so
 * it is also caught by "Show only DXF" and the electrical discipline filter).
 *
 * ADR-599: toggle markup ενοποιήθηκε στο `<RibbonToggleWidget config>` — `value`
 * μοντελοποιεί το "visible" (aria-pressed = ορατό), οπότε active=κρύψε / inactive=δείξε.
 */

import React from 'react';
import { Cable, EyeOff } from 'lucide-react';
import { useBimRenderSettingsStore } from '../../../state/bim-render-settings-store';
import { RibbonToggleWidget, type RibbonToggleConfig } from './RibbonToggleWidget';

const MEP_WIRE_TOGGLE: RibbonToggleConfig = {
  useToggleState: () => {
    const objectStyles = useBimRenderSettingsStore((s) => s.objectStyles);
    const setObjectStyleVisibility = useBimRenderSettingsStore((s) => s.setObjectStyleVisibility);
    // Default (undefined) = visible, mirroring the renderer's `!== false` gate.
    const isHidden = objectStyles['mep-wire']?.visible === false;
    return {
      value: !isHidden,
      toggle: () => setObjectStyleVisibility('mep-wire', isHidden),
    };
  },
  labelKey: 'ribbon.commands.mepWire.label',
  activeIcon: Cable,
  inactiveIcon: EyeOff,
  activeLabelKey: 'ribbon.commands.mepWire.hide',
  inactiveLabelKey: 'ribbon.commands.mepWire.show',
  activeTooltipKey: 'ribbon.commands.mepWire.tooltipHide',
  inactiveTooltipKey: 'ribbon.commands.mepWire.tooltipShow',
};

export const MepWireToggle: React.FC = () => (
  <RibbonToggleWidget config={MEP_WIRE_TOGGLE} />
);
