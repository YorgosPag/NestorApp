/**
 * Η ένδειξη αποθήκευσης του ΣΧΕΔΙΟΥ στην πλαϊνή στήλη (ADR-914 §8.19).
 *
 * Μία καθαρή κατάσταση, όπως το Figma: τι αποθηκεύεται (τίτλος + αρχείο) και σε ποια κατάσταση.
 * Η κατάσταση αποδίδεται από τον ΕΝΑ δείκτη αποθήκευσης της εφαρμογής (`AutoSaveStatusIndicator`,
 * ADR-248) — όχι από δικά της κείμενα. Κανένα κουμπί: η αποθήκευση είναι αυτόματη, και ένα κουμπί
 * που δεν εκτελεί τίποτα είναι υπόσχεση που δεν κρατιέται.
 *
 * Η διπλανή ένδειξη (`CentralizedAutoSaveStatus`) αφορά τις ΡΥΘΜΙΣΕΙΣ — γι' αυτό έχουν τίτλο και οι δύο.
 */

import React from 'react';
import { FileText } from 'lucide-react';
import { useAutoSaveStatus } from '../../stores/AutoSaveStatusStore';
import { AutoSaveStatusIndicator } from '@/components/shared/AutoSaveStatusIndicator';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../../config/panel-tokens';

export function AutoSaveStatus() {
  const { t } = useTranslation('dxf-viewer-shell');
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();
  // 🚀 Ribbon-cascade fix (profiler 2026-06-28): read the volatile save-status from
  // its dedicated reactive store instead of LevelsSystem getters, so a save cycle
  // re-renders only this widget — not the levels context / whole ribbon.
  const { currentFileName, lastSaveTime, saveStatus } = useAutoSaveStatus();

  if (!currentFileName) {
    return null; // No file loaded, don't show anything
  }

  return (
    // 🏢 ENTERPRISE: bg.hover (bg-accent) for consistency with cards and CentralizedAutoSaveStatus
    <section
      aria-label={t('autoSave.drawingLabel')}
      className={`flex flex-col ${PANEL_LAYOUT.GAP.XS} ${PANEL_LAYOUT.SPACING.SM} ${colors.bg.hover} ${quick.card} ${PANEL_LAYOUT.TYPOGRAPHY.XS}`}
    >
      <header className={`flex items-center ${PANEL_LAYOUT.FLEX_UTILS.FLEX_1_MIN_0}`}>
        <FileText className={`${iconSizes.xs} ${PANEL_LAYOUT.MARGIN.RIGHT_XS} ${PANEL_LAYOUT.FLEX_SHRINK.NONE}`} />
        <span className={`${colors.text.muted} ${PANEL_LAYOUT.MARGIN.RIGHT_SM}`}>{t('autoSave.drawingLabel')}</span>
        <span className={`${colors.text.secondary} truncate`}>{currentFileName}</span>
      </header>
      <AutoSaveStatusIndicator status={saveStatus} lastSaved={lastSaveTime} />
    </section>
  );
}
