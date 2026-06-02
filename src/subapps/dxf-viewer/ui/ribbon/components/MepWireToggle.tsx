'use client';

/**
 * ADR-408 Φ7 — "Show / hide circuit wires" ribbon toggle (View tab).
 *
 * One-click show/hide of the derived home-run wire annotation
 * (`HomeRunWiresOverlay` 2D + `syncWires` 3D), Revit's "Wires" sub-category in a
 * view. Mirrors {@link HideBimToggle}: it is a thin reader/writer of the single
 * `'mep-wire'` BIM category visibility — no bespoke flag, the existing per-view
 * `objectStyles` machinery is the SSoT (so it is also caught by "Show only DXF"
 * and the electrical discipline filter).
 */

import React, { useCallback } from 'react';
import { Cable, EyeOff } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useBimRenderSettingsStore } from '../../../state/bim-render-settings-store';
import { HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../../../config/panel-tokens';

export const MepWireToggle: React.FC = () => {
  const { t } = useTranslation('dxf-viewer-shell');
  const colors = useSemanticColors();

  const objectStyles = useBimRenderSettingsStore((s) => s.objectStyles);
  const setObjectStyleVisibility = useBimRenderSettingsStore((s) => s.setObjectStyleVisibility);

  // Default (undefined) = visible, mirroring the renderer's `!== false` gate.
  const isWiresHidden = objectStyles['mep-wire']?.visible === false;

  const handleToggle = useCallback(() => {
    setObjectStyleVisibility('mep-wire', isWiresHidden);
  }, [isWiresHidden, setObjectStyleVisibility]);

  const label = t('ribbon.commands.mepWire.label');
  const title = isWiresHidden
    ? t('ribbon.commands.mepWire.tooltipShow')
    : t('ribbon.commands.mepWire.tooltipHide');

  return (
    <span className="dxf-ribbon-combobox-row">
      <span className="dxf-ribbon-combobox-label">{label}</span>
      <button
        type="button"
        onClick={handleToggle}
        aria-pressed={!isWiresHidden}
        aria-label={title}
        className={`flex items-center gap-1 ${PANEL_LAYOUT.SPACING.COMPACT} ${colors.bg.backgroundSecondary} ${isWiresHidden ? colors.text.secondary : colors.text.info} ${PANEL_LAYOUT.TYPOGRAPHY.XS} rounded ${HOVER_BACKGROUND_EFFECTS.MUTED} ${PANEL_LAYOUT.TRANSITION.COLORS} select-none`}
      >
        {isWiresHidden
          ? <CableCar className="w-3 h-3 opacity-60" />
          : <Cable className="w-3 h-3 opacity-80" />}
        <span>{isWiresHidden ? t('ribbon.commands.mepWire.show') : t('ribbon.commands.mepWire.hide')}</span>
      </button>
    </span>
  );
};
