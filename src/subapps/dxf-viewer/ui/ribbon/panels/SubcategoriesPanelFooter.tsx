'use client';

/**
 * ADR-377 Phase D — Subcategories dialog footer actions.
 *
 * - Reset {Category}  → `resetCategorySubcategories(activeTab.category)`.
 * - Reset All         → `resetAllSubcategories()` behind an AlertDialog confirm (Q15).
 * - Apply to All Levels → fan-out current subcategories to every sibling level (Q16)
 *   via `applySubcategoriesToLevels` (preserves each target's own scale/pens).
 */

import React, { useCallback, useMemo, useState } from 'react';
import { RotateCcw, Trash2, Layers } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { PANEL_LAYOUT } from '../../../config/panel-tokens';
import { useBimRenderSettingsStore } from '../../../state/bim-render-settings-store';
import { useLevels } from '../../../systems/levels';
import { applySubcategoriesToLevels } from '../../../services/subcategory-propagation.service';
import type { SubcategoryTab } from './subcategory-tabs';

interface SubcategoriesPanelFooterProps {
  activeTab: SubcategoryTab;
}

export const SubcategoriesPanelFooter: React.FC<SubcategoriesPanelFooterProps> = ({ activeTab }) => {
  const { t } = useTranslation('dxf-viewer-shell');
  const colors = useSemanticColors();

  const objectStyles = useBimRenderSettingsStore((s) => s.objectStyles);
  const resetCategory = useBimRenderSettingsStore((s) => s.resetCategorySubcategories);
  const resetAll = useBimRenderSettingsStore((s) => s.resetAllSubcategories);

  const { levels, currentLevelId } = useLevels();
  const siblings = useMemo(
    () => levels.filter((l) => l.id !== currentLevelId),
    [levels, currentLevelId],
  );
  const [applying, setApplying] = useState(false);

  const handleApplyToAll = useCallback(async () => {
    if (siblings.length === 0) return;
    setApplying(true);
    try {
      await applySubcategoriesToLevels(objectStyles, siblings);
    } finally {
      setApplying(false);
    }
  }, [objectStyles, siblings]);

  const btn = `flex items-center gap-1.5 ${PANEL_LAYOUT.SPACING.COMPACT} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.secondary} rounded ${HOVER_BACKGROUND_EFFECTS.MUTED} disabled:opacity-40 ${PANEL_LAYOUT.TRANSITION.COLORS}`;

  return (
    <footer className={`flex items-center justify-between gap-2 mt-3 pt-3 border-t ${colors.border.default}`}>
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => resetCategory(activeTab.category)} className={btn}>
          <RotateCcw className="w-3 h-3" />
          {t('ribbon.commands.subcategories.resetCategory', { category: t(activeTab.labelKey) })}
        </button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button type="button" className={btn}>
              <Trash2 className="w-3 h-3" />
              {t('ribbon.commands.subcategories.resetAll')}
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t('ribbon.commands.subcategories.resetAllConfirmTitle')}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t('ribbon.commands.subcategories.resetAllConfirmBody')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('ribbon.commands.subcategories.cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={() => resetAll()}>
                {t('ribbon.commands.subcategories.resetAll')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <button
        type="button"
        onClick={() => void handleApplyToAll()}
        disabled={siblings.length === 0 || applying}
        className={btn}
      >
        <Layers className="w-3 h-3" />
        {t('ribbon.commands.subcategories.applyToAllLevels')}
      </button>
    </footer>
  );
};
