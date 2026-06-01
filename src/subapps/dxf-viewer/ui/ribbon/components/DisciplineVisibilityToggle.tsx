'use client';

/**
 * ADR-405 §4 — Discipline visibility multi-toggle (Revit "View Discipline").
 *
 * One toggle chip per model discipline (Architectural / Structural / Mechanical
 * / Electrical / Plumbing). Toggling a discipline off hides every entity of that
 * discipline across 2D + 3D via the `disciplineVisibility` source of
 * `resolveIsEntityVisible` (ANY-hides-wins). Higher tier than the per-category
 * V/G toggle and the «Μόνο DXF» isolate — the three compose.
 *
 * SSoT: reads/writes `useBimRenderSettingsStore.disciplineVisibility` via the
 * `setDisciplineVisibility` action (single debounced Firestore write per click).
 */

import React, { useCallback } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useBimRenderSettingsStore } from '../../../state/bim-render-settings-store';
import { MODEL_DISCIPLINES, type Discipline } from '../../../bim/discipline/bim-discipline';
import { HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../../../config/panel-tokens';

/** Static i18n label key per discipline (literal keys → analyzer-reachable). */
const DISCIPLINE_LABEL_KEY: Readonly<Record<Discipline, string>> = {
  architectural: 'ribbon.commands.discipline.names.architectural',
  structural: 'ribbon.commands.discipline.names.structural',
  mechanical: 'ribbon.commands.discipline.names.mechanical',
  electrical: 'ribbon.commands.discipline.names.electrical',
  plumbing: 'ribbon.commands.discipline.names.plumbing',
  fire: 'ribbon.commands.discipline.names.fire',
  civil: 'ribbon.commands.discipline.names.civil',
  telecom: 'ribbon.commands.discipline.names.telecom',
  interior: 'ribbon.commands.discipline.names.interior',
  general: 'ribbon.commands.discipline.names.general',
};

interface DisciplineChipProps {
  readonly discipline: Discipline;
}

const DisciplineChip: React.FC<DisciplineChipProps> = ({ discipline }) => {
  const { t } = useTranslation('dxf-viewer-shell');
  const colors = useSemanticColors();
  const isVisible = useBimRenderSettingsStore(
    (s) => s.disciplineVisibility[discipline] !== false,
  );
  const setDisciplineVisibility = useBimRenderSettingsStore((s) => s.setDisciplineVisibility);

  const handleToggle = useCallback(() => {
    setDisciplineVisibility(discipline, !isVisible);
  }, [discipline, isVisible, setDisciplineVisibility]);

  const name = t(DISCIPLINE_LABEL_KEY[discipline]);
  const title = isVisible
    ? t('ribbon.commands.discipline.tooltipHide')
    : t('ribbon.commands.discipline.tooltipShow');

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-pressed={isVisible}
      aria-label={`${name} — ${title}`}
      className={`flex items-center gap-1 ${PANEL_LAYOUT.SPACING.COMPACT} ${colors.bg.backgroundSecondary} ${isVisible ? colors.text.secondary : colors.text.muted} ${PANEL_LAYOUT.TYPOGRAPHY.XS} rounded ${HOVER_BACKGROUND_EFFECTS.MUTED} ${PANEL_LAYOUT.TRANSITION.COLORS} select-none`}
    >
      {isVisible
        ? <Eye className="w-3 h-3 opacity-60" />
        : <EyeOff className="w-3 h-3 opacity-80" />}
      <span>{name}</span>
    </button>
  );
};

export const DisciplineVisibilityToggle: React.FC = () => {
  const { t } = useTranslation('dxf-viewer-shell');

  return (
    <span className="dxf-ribbon-combobox-row">
      <span className="dxf-ribbon-combobox-label">
        {t('ribbon.commands.discipline.label')}
      </span>
      {MODEL_DISCIPLINES.map((discipline) => (
        <DisciplineChip key={discipline} discipline={discipline} />
      ))}
    </span>
  );
};
