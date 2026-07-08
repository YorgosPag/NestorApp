'use client';

/**
 * ADR-422 L5 — «Μηχανολογική Μελέτη Θέρμανσης» export action (View tab).
 *
 * Αυτόνομο ribbon widget (ΟΧΙ μέσω `useRibbonCommands`) που κατεβάζει πολυσέλιδο PDF report
 * (σύνοψη + 4 πίνακες L1-L4) για τον ενεργό όροφο. Mirror του {@link ShowBalancingToggle}
 * (self-contained widget) + του active-floor scene resolution των overlays L1-L4
 * (`useLevelsOptional` → `getLevelScene`).
 *
 * Arm-on-demand (Google-level, μηδέν idle cost): τα 4 read-models τρέχουν ΜΟΝΟ όταν πατηθεί
 * το κουμπί (`armed` → `active`), ένα render υπολογίζει το report, ένα effect κατεβάζει το PDF
 * και μηδενίζει το `armed`. Race-free μέσω `busyRef` (idempotent — ένα download ανά πάτημα).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileText } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useLevelsOptional } from '../../../systems/levels/useLevels';
import { useCurrentLevelScene } from '../../../systems/levels';
import { useThermalStudyReport } from '../../../hooks/data/useThermalStudyReport';
import { downloadThermalStudyAsPdf } from '../../../bim/thermal/report/thermal-study-pdf-exporter';
import type { ThermalStudyLookups } from '../../../bim/thermal/report/thermal-study-report';
import type { ThermalSpaceEntity } from '../../../bim/types/thermal-space-types';
import { PANEL_LAYOUT } from '../../../config/panel-tokens';

export const ExportThermalStudyButton: React.FC = () => {
  const { t } = useTranslation('dxf-viewer-shell');
  const colors = useSemanticColors();
  const busyRef = useRef(false);
  const [armed, setArmed] = useState(false);

  const levelsCtx = useLevelsOptional();
  const currentLevelId = levelsCtx?.currentLevelId ?? null;
  const getLevelScene = levelsCtx?.getLevelScene;
  const currentLevel = levelsCtx?.levels.find((l) => l.id === currentLevelId) ?? null;

  const liveScene = useCurrentLevelScene();
  const scene = armed ? liveScene : null;
  const active = armed && !!scene;

  const lookups = useMemo<ThermalStudyLookups>(
    () => ({
      buildingLabel: '',
      floorLabel: currentLevel?.name ?? '',
      spaceLabel: (space: ThermalSpaceEntity) =>
        space.params.name?.trim() || t(`thermalSpace.useTypes.${space.params.useType}`),
      boundaryKindLabel: (kind) => t(`thermalStudyReport.elementKinds.${kind}`),
    }),
    [currentLevel?.name, t],
  );

  const report = useThermalStudyReport(scene, active, lookups);

  // Arm → compute → download → disarm (single download per arm via busyRef).
  useEffect(() => {
    if (!armed || !active || busyRef.current) return;
    busyRef.current = true;
    void downloadThermalStudyAsPdf(
      report,
      {
        title: t('thermalStudyReport.title'),
        regulations: t('thermalStudyReport.regulations'),
        filename: t('thermalStudyReport.filename'),
      },
      (key) => t(key),
    ).finally(() => {
      busyRef.current = false;
      setArmed(false);
    });
  }, [armed, active, report, t]);

  // Armed αλλά χωρίς ενεργό όροφο/scene → μηδένισε (μην κολλήσει το κουμπί).
  useEffect(() => {
    if (armed && !active && !busyRef.current) setArmed(false);
  }, [armed, active]);

  const handleExport = useCallback(() => {
    if (currentLevelId && getLevelScene) setArmed(true);
  }, [currentLevelId, getLevelScene]);

  const label = t('ribbon.commands.thermalStudy.label');
  const title = t('ribbon.commands.thermalStudy.tooltip');

  return (
    <span className="dxf-ribbon-combobox-row">
      <span className="dxf-ribbon-combobox-label">{label}</span>
      <button
        type="button"
        onClick={handleExport}
        disabled={armed}
        aria-label={title}
        className={`flex items-center gap-1 ${PANEL_LAYOUT.SPACING.COMPACT} ${colors.bg.backgroundSecondary} ${colors.text.secondary} ${PANEL_LAYOUT.TYPOGRAPHY.XS} rounded ${HOVER_BACKGROUND_EFFECTS.MUTED} ${PANEL_LAYOUT.TRANSITION.COLORS} select-none`}
      >
        <FileText className="w-3 h-3 opacity-80" />
        <span>{t('ribbon.commands.thermalStudy.export')}</span>
      </button>
    </span>
  );
};
