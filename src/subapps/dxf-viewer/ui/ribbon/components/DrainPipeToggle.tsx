'use client';

/**
 * ADR-408 Φ14 — "Show / hide drainage" ribbon toggle (View tab).
 *
 * One-click show/hide of sanitary drainage pipe runs. Mirrors {@link MepWireToggle}:
 * a thin reader/writer of the single `'drain-pipe'` BIM category visibility — no
 * bespoke flag, the existing per-view `objectStyles` machinery is the SSoT (so it
 * is also caught by "Show only DXF" and the plumbing discipline filter). A drainage
 * pipe earns the `'drain-pipe'` category via `resolveSegmentBimCategory` (its
 * classification is 'sanitary-drainage') while staying `domain:'pipe'` elsewhere.
 */

import React, { useCallback } from 'react';
import { Droplets, EyeOff } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useBimRenderSettingsStore } from '../../../state/bim-render-settings-store';
import { HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../../../config/panel-tokens';

export const DrainPipeToggle: React.FC = () => {
  const { t } = useTranslation('dxf-viewer-shell');
  const colors = useSemanticColors();

  const objectStyles = useBimRenderSettingsStore((s) => s.objectStyles);
  const setObjectStyleVisibility = useBimRenderSettingsStore((s) => s.setObjectStyleVisibility);

  // Default (undefined) = visible, mirroring the renderer's `!== false` gate.
  const isDrainHidden = objectStyles['drain-pipe']?.visible === false;

  const handleToggle = useCallback(() => {
    setObjectStyleVisibility('drain-pipe', isDrainHidden);
  }, [isDrainHidden, setObjectStyleVisibility]);

  const label = t('ribbon.commands.drainPipe.label');
  const title = isDrainHidden
    ? t('ribbon.commands.drainPipe.tooltipShow')
    : t('ribbon.commands.drainPipe.tooltipHide');

  return (
    <span className="dxf-ribbon-combobox-row">
      <span className="dxf-ribbon-combobox-label">{label}</span>
      <button
        type="button"
        onClick={handleToggle}
        aria-pressed={!isDrainHidden}
        aria-label={title}
        className={`flex items-center gap-1 ${PANEL_LAYOUT.SPACING.COMPACT} ${colors.bg.backgroundSecondary} ${isDrainHidden ? colors.text.secondary : colors.text.info} ${PANEL_LAYOUT.TYPOGRAPHY.XS} rounded ${HOVER_BACKGROUND_EFFECTS.MUTED} ${PANEL_LAYOUT.TRANSITION.COLORS} select-none`}
      >
        {isDrainHidden
          ? <EyeOff className="w-3 h-3 opacity-60" />
          : <Droplets className="w-3 h-3 opacity-80" />}
        <span>{isDrainHidden ? t('ribbon.commands.drainPipe.show') : t('ribbon.commands.drainPipe.hide')}</span>
      </button>
    </span>
  );
};
