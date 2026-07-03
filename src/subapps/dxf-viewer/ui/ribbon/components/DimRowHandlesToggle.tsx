'use client';

/**
 * ADR-362 Round 35 — «Λαβές Μετακίνησης Σειρών» ribbon toggle.
 *
 * Flips `DimRowHandleModeStore`: when ON, the `DimRowHandleOverlay` shows ONE handle
 * per dimension row docked at the viewport edge; dragging a handle offsets the whole
 * row perpendicular to its axis. Self-subscribes the store (`useSyncExternalStore`)
 * so the pressed state is LIVE — mirror of the `HideBimToggle` widget pattern.
 */

import React, { useCallback } from 'react';
import { MoveVertical } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { PANEL_LAYOUT } from '../../../config/panel-tokens';
import {
  DimRowHandleModeStore,
  useDimRowHandleModeActive,
} from '../../../systems/dimensions/DimRowHandleModeStore';

export const DimRowHandlesToggle: React.FC = () => {
  const { t } = useTranslation('dxf-viewer-shell');
  const colors = useSemanticColors();
  const active = useDimRowHandleModeActive();

  const handleToggle = useCallback(() => DimRowHandleModeStore.toggle(), []);

  const title = active
    ? t('ribbon.commands.dimRowHandles.tooltipOff')
    : t('ribbon.commands.dimRowHandles.tooltipOn');

  return (
    <span className="dxf-ribbon-combobox-row">
      <span className="dxf-ribbon-combobox-label">
        {t('ribbon.commands.dimRowHandles.label')}
      </span>
      <button
        type="button"
        onClick={handleToggle}
        aria-pressed={active}
        aria-label={title}
        className={`flex items-center gap-1 ${PANEL_LAYOUT.SPACING.COMPACT} ${colors.bg.backgroundSecondary} ${active ? colors.text.info : colors.text.secondary} ${PANEL_LAYOUT.TYPOGRAPHY.XS} rounded ${HOVER_BACKGROUND_EFFECTS.MUTED} ${PANEL_LAYOUT.TRANSITION.COLORS} select-none`}
      >
        <MoveVertical className="w-3 h-3 opacity-80" />
        <span>{active ? t('ribbon.commands.dimRowHandles.on') : t('ribbon.commands.dimRowHandles.off')}</span>
      </button>
    </span>
  );
};
