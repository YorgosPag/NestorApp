'use client';

/**
 * ADR-483 (T3-UI / Slice 4) — "Διαγράμματα Μ/V/N" ribbon toggle (View tab).
 *
 * One-click master switch για το canvas overlay διαγραμμάτων ροπής ανά δοκάρι
 * (Revit/Robot moment diagrams): ON → κάθε φέρον δοκάρι δείχνει το διάγραμμα
 * ροπών· OFF → κανονικό σχέδιο. Mirror του {@link ShowPipeSizingToggle}: thin
 * reader/writer του `showAnalysisDiagrams` flag στο TRANSIENT
 * `useAnalysisDiagramViewStore`, διαβασμένο από το `StructuralDiagramOverlay`.
 */

import React, { useCallback } from 'react';
import { LineChart, Ban } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useAnalysisDiagramViewStore } from '../../../state/analysis-diagram-view-store';
import { HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../../../config/panel-tokens';

export const ShowAnalysisDiagramsToggle: React.FC = () => {
  const { t } = useTranslation('dxf-viewer-shell');
  const colors = useSemanticColors();

  const showDiagrams = useAnalysisDiagramViewStore((s) => s.showAnalysisDiagrams);
  const setShowDiagrams = useAnalysisDiagramViewStore((s) => s.setShowAnalysisDiagrams);

  const handleToggle = useCallback(() => {
    setShowDiagrams(!showDiagrams);
  }, [showDiagrams, setShowDiagrams]);

  const label = t('ribbon.commands.analysisDiagrams.label');
  const title = showDiagrams
    ? t('ribbon.commands.analysisDiagrams.tooltipDisable')
    : t('ribbon.commands.analysisDiagrams.tooltipEnable');

  return (
    <span className="dxf-ribbon-combobox-row">
      <span className="dxf-ribbon-combobox-label">{label}</span>
      <button
        type="button"
        onClick={handleToggle}
        aria-pressed={showDiagrams}
        aria-label={title}
        className={`flex items-center gap-1 ${PANEL_LAYOUT.SPACING.COMPACT} ${colors.bg.backgroundSecondary} ${showDiagrams ? colors.text.info : colors.text.secondary} ${PANEL_LAYOUT.TYPOGRAPHY.XS} rounded ${HOVER_BACKGROUND_EFFECTS.MUTED} ${PANEL_LAYOUT.TRANSITION.COLORS} select-none`}
      >
        {showDiagrams
          ? <LineChart className="w-3 h-3 opacity-80" />
          : <Ban className="w-3 h-3 opacity-60" />}
        <span>{showDiagrams ? t('ribbon.commands.analysisDiagrams.disable') : t('ribbon.commands.analysisDiagrams.enable')}</span>
      </button>
    </span>
  );
};
