'use client';

/**
 * ADR-362 (Path B) — «＋ Νέος τύπος γραμμής» ribbon launcher.
 *
 * Self-contained widget (mirror of `DimRowHandlesToggle`): a small button that
 * opens the reusable `LinePatternEditorDialog` locally. On save the editor
 * registers the user-created linetype in `LinetypeRegistry`; because the ribbon
 * «Τύπος» dropdown reads that live registry, the new pattern appears there
 * automatically — no selection/override plumbing needed here. Sits right beside
 * «Τύπος» (what it creates), on the Dimension contextual tab.
 */

import React, { useState, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { PANEL_LAYOUT } from '../../../config/panel-tokens';
import { LinePatternEditorDialog } from '../../panels/dimensions/LinePatternEditorDialog';

export const DimNewLinePatternWidget: React.FC = () => {
  const { t } = useTranslation('dxf-viewer-shell');
  const colors = useSemanticColors();
  const [open, setOpen] = useState(false);
  const openDialog = useCallback(() => setOpen(true), []);

  return (
    <span className="dxf-ribbon-combobox-row">
      <button
        type="button"
        onClick={openDialog}
        aria-label={t('ribbon.commands.dimNewLineType')}
        className={`flex items-center gap-1 ${PANEL_LAYOUT.SPACING.COMPACT} ${colors.bg.backgroundSecondary} ${colors.text.secondary} ${PANEL_LAYOUT.TYPOGRAPHY.XS} rounded ${HOVER_BACKGROUND_EFFECTS.MUTED} ${PANEL_LAYOUT.TRANSITION.COLORS} select-none`}
      >
        <Plus className="w-3 h-3 opacity-80" />
        <span>{t('ribbon.commands.dimNewLineType')}</span>
      </button>
      <LinePatternEditorDialog open={open} onOpenChange={setOpen} />
    </span>
  );
};
