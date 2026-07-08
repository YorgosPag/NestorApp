'use client';

/**
 * ADR-408 Φ14 — "Show / hide drainage" ribbon toggle (View tab).
 *
 * One-click show/hide of sanitary drainage pipe runs. A thin reader/writer of the
 * single `'drain-pipe'` BIM category visibility — no bespoke flag, the existing
 * per-view `objectStyles` machinery is the SSoT (so it is also caught by "Show
 * only DXF" and the plumbing discipline filter). A drainage pipe earns the
 * `'drain-pipe'` category via `resolveSegmentBimCategory` (its classification is
 * 'sanitary-drainage') while staying `domain:'pipe'` elsewhere.
 *
 * ADR-599: toggle markup ενοποιήθηκε στο `<RibbonToggleWidget config>` — `value`
 * μοντελοποιεί το "visible" (aria-pressed = ορατό), οπότε active=κρύψε / inactive=δείξε.
 */

import React from 'react';
import { Droplets, EyeOff } from 'lucide-react';
import { useBimRenderSettingsStore } from '../../../state/bim-render-settings-store';
import { RibbonToggleWidget, type RibbonToggleConfig } from './RibbonToggleWidget';

const DRAIN_PIPE_TOGGLE: RibbonToggleConfig = {
  useToggleState: () => {
    const objectStyles = useBimRenderSettingsStore((s) => s.objectStyles);
    const setObjectStyleVisibility = useBimRenderSettingsStore((s) => s.setObjectStyleVisibility);
    // Default (undefined) = visible, mirroring the renderer's `!== false` gate.
    const isHidden = objectStyles['drain-pipe']?.visible === false;
    return {
      value: !isHidden,
      toggle: () => setObjectStyleVisibility('drain-pipe', isHidden),
    };
  },
  labelKey: 'ribbon.commands.drainPipe.label',
  activeIcon: Droplets,
  inactiveIcon: EyeOff,
  activeLabelKey: 'ribbon.commands.drainPipe.hide',
  inactiveLabelKey: 'ribbon.commands.drainPipe.show',
  activeTooltipKey: 'ribbon.commands.drainPipe.tooltipHide',
  inactiveTooltipKey: 'ribbon.commands.drainPipe.tooltipShow',
};

export const DrainPipeToggle: React.FC = () => (
  <RibbonToggleWidget config={DRAIN_PIPE_TOGGLE} />
);
