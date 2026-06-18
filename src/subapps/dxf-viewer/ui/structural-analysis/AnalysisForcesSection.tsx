'use client';

/**
 * AnalysisForcesSection — ADR-482 (T3-UI, read-only εντατικά μεγέθη readout).
 *
 * Επιφανειακό read-only section (mirror του `EntityWarningsSection`): δείχνει το
 * envelope N_Ed/V_Ed/M_Ed/T_Ed ενός μέλους από τον στατικό FEM solver (ADR-481).
 * ΕΝΑ component για ΟΛΑ τα φέροντα kinds (κολόνα/δοκάρι) — reused στα advanced
 * panels (μηδέν duplicate, N.0.2). Όταν δεν έχει τρέξει ανάλυση → δεν αποδίδεται
 * (null). Τα μεγέθη είναι **πληροφοριακά** (δεν αντικαθιστούν το tributary takedown).
 *
 * @see ./useEntityAnalysisForces.ts
 * @see ../structural-warnings/EntityWarningsSection.tsx — το πρότυπο read-only section
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useEntityAnalysisForces } from './useEntityAnalysisForces';

export interface AnalysisForcesSectionProps {
  /** Entity id (κολόνα/δοκάρι) του οποίου τα εντατικά μεγέθη εμφανίζονται. */
  readonly entityId: string;
}

/** kN/kNm σε 2 δεκαδικά (DERIVED — μηδέν persistence). */
function fmt(value: number): string {
  return value.toFixed(2);
}

export function AnalysisForcesSection({
  entityId,
}: AnalysisForcesSectionProps): React.ReactElement | null {
  const { t } = useTranslation('dxf-viewer-shell');
  const extrema = useEntityAnalysisForces(entityId);
  if (!extrema) return null;

  const rows = [
    { key: 'axial', value: extrema.maxAbsAxialN },
    { key: 'shear', value: extrema.maxAbsShear },
    { key: 'moment', value: extrema.maxAbsMoment },
    { key: 'torsion', value: extrema.maxAbsTorsion },
  ] as const;

  return (
    <section
      aria-label={t('staticAnalysis.forces.title')}
      className="flex flex-col gap-1 rounded border border-border bg-muted/30 p-2"
    >
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t('staticAnalysis.forces.title')}
      </h4>
      <ul className="flex flex-col gap-0.5 text-xs text-foreground">
        {rows.map((row) => (
          <li key={row.key} className="font-mono tabular-nums">
            {t(`staticAnalysis.forces.${row.key}`, { value: fmt(row.value) })}
          </li>
        ))}
      </ul>
    </section>
  );
}
