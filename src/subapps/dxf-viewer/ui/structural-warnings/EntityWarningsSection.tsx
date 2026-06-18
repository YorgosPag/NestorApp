'use client';

/**
 * ADR-459 Phase 1 — Structural Organism warnings section (generic, per-entity).
 *
 * Επιφανειακό read-only component: εμφανίζει τα DERIVED cross-entity ευρήματα του
 * στατικού οργανισμού που εμπλέκουν ένα entity (π.χ. «λείπει το πέδιλο» στην κολόνα).
 * Mirror του `WallWarningsSection` αλλά διαβάζει το `StructuralDiagnosticsStore`
 * (cross-entity) αντί για το per-entity `entity.validation`. ΕΝΑ component για ΟΛΑ
 * τα structural kinds (κολόνα/δοκάρι/πέδιλο) — μηδέν duplicate (N.0.2).
 *
 * @see ../../bim/structural/organism/useEntityStructuralDiagnostics.ts
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useEntityStructuralDiagnostics } from '../../bim/structural/organism/useEntityStructuralDiagnostics';
import { useEntityAnalysisDiagnostics } from '../structural-analysis/useEntityAnalysisDiagnostics';

export interface EntityWarningsSectionProps {
  /** Entity id (κολόνα/δοκάρι/πέδιλο) του οποίου τα διαγνωστικά εμφανίζονται. */
  readonly entityId: string;
}

/**
 * Στατικά class sets ανά severity (το Tailwind JIT ΔΕΝ κάνει interpolation — οι
 * πλήρεις κλάσεις πρέπει να υπάρχουν αυτούσιες στον κώδικα).
 */
const TONE = {
  error: {
    section: 'border-[hsl(var(--text-error))]/40 bg-[hsl(var(--text-error))]/10',
    text: 'text-[hsl(var(--text-error))]',
    glyph: '!',
  },
  warning: {
    section: 'border-[hsl(var(--text-warning))]/40 bg-[hsl(var(--text-warning))]/10',
    text: 'text-[hsl(var(--text-warning))]',
    glyph: '!',
  },
  // ADR-459 Φ4d — advisories (π.χ. «λείπει οπλισμός»): ήπιο info styling, όχι κόκκινο.
  info: {
    section: 'border-[hsl(var(--text-info))]/40 bg-[hsl(var(--bg-info))]/10',
    text: 'text-[hsl(var(--text-info))]',
    glyph: 'i',
  },
} as const;

export function EntityWarningsSection({
  entityId,
}: EntityWarningsSectionProps): React.ReactElement | null {
  const { t } = useTranslation('dxf-viewer-shell');
  // ADR-459 (οργανισμός) + ADR-482 (στατική ανάλυση): ένα warnings panel, δύο πηγές.
  // Reader-side union — ο single-writer invariant κάθε store μένει ανέπαφος.
  const organismDiagnostics = useEntityStructuralDiagnostics(entityId);
  const analysisDiagnostics = useEntityAnalysisDiagnostics(entityId);
  const diagnostics = React.useMemo(
    () => [...organismDiagnostics, ...analysisDiagnostics],
    [organismDiagnostics, analysisDiagnostics],
  );
  if (diagnostics.length === 0) return null;

  // Κυρίαρχος τόνος = υψηλότερη σοβαρότητα παρούσα (error > warning > info).
  const tone = diagnostics.some((d) => d.severity === 'error')
    ? TONE.error
    : diagnostics.some((d) => d.severity === 'warning')
      ? TONE.warning
      : TONE.info;

  return (
    <section
      role="alert"
      aria-label={t('structuralOrganism.diagnostics.title')}
      className={`flex flex-col gap-1.5 rounded border p-2 ${tone.section}`}
    >
      <header className="flex items-center gap-2">
        <span aria-hidden="true" className={tone.text}>
          {tone.glyph}
        </span>
        <h4 className={`text-xs font-semibold uppercase tracking-wide ${tone.text}`}>
          {t('structuralOrganism.diagnostics.title')}
        </h4>
      </header>
      <ul className={`flex flex-col gap-1 text-xs ${tone.text}`}>
        {diagnostics.map((d) => (
          <li key={d.id} className="leading-snug">
            {t(d.messageKey, { defaultValue: '', ...d.messageParams }) || d.messageKey}
          </li>
        ))}
      </ul>
    </section>
  );
}
