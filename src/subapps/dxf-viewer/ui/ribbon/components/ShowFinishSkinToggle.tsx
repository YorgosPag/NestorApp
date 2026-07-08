'use client';

/**
 * ADR-449 Slice 5 — "Σοβατισμένη Όψη" ribbon toggle (View tab).
 *
 * One-click master switch για τον δομικό σοβά (structural finish skin) κολόνων &
 * δοκαριών: ON → κάθε εκτεθειμένη παρειά αποκτά περιμετρικό δέρμα σοβά (2D finished
 * outline + 3D band skin)· OFF → προβολή γυμνού στατικού πυρήνα. Thin reader/writer
 * του `showFinishSkin` per-view flag στο `useBimRenderSettingsStore` (SSoT,
 * Firestore-persisted), διαβασμένο event-time από τον 2D orchestrator (`DxfRenderer`)
 * + 3D converter. Visibility-only (Revit): το BOQ μετράει πάντα τον σοβά.
 *
 * ADR-599: toggle markup ενοποιήθηκε στο `<RibbonToggleWidget config>`.
 */

import React from 'react';
import { PaintRoller, SquareDashed } from 'lucide-react';
import { useBimRenderSettingsStore } from '../../../state/bim-render-settings-store';
import { RibbonToggleWidget, type RibbonToggleConfig } from './RibbonToggleWidget';

const FINISH_SKIN_TOGGLE: RibbonToggleConfig = {
  useToggleState: () => {
    const value = useBimRenderSettingsStore((s) => s.showFinishSkin);
    const set = useBimRenderSettingsStore((s) => s.setShowFinishSkin);
    return { value, toggle: () => set(!value) };
  },
  labelKey: 'ribbon.commands.finishSkin.label',
  activeIcon: PaintRoller,
  inactiveIcon: SquareDashed,
  activeLabelKey: 'ribbon.commands.finishSkin.disable',
  inactiveLabelKey: 'ribbon.commands.finishSkin.enable',
  activeTooltipKey: 'ribbon.commands.finishSkin.tooltipDisable',
  inactiveTooltipKey: 'ribbon.commands.finishSkin.tooltipEnable',
};

export const ShowFinishSkinToggle: React.FC = () => (
  <RibbonToggleWidget config={FINISH_SKIN_TOGGLE} />
);
