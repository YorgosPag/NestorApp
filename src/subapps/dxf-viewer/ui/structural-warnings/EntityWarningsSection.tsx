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

export interface EntityWarningsSectionProps {
  /** Entity id (κολόνα/δοκάρι/πέδιλο) του οποίου τα διαγνωστικά εμφανίζονται. */
  readonly entityId: string;
}

export function EntityWarningsSection({
  entityId,
}: EntityWarningsSectionProps): React.ReactElement | null {
  const { t } = useTranslation('dxf-viewer-shell');
  const diagnostics = useEntityStructuralDiagnostics(entityId);
  if (diagnostics.length === 0) return null;

  const hasError = diagnostics.some((d) => d.severity === 'error');
  const tone = hasError ? '--text-error' : '--text-warning';

  return (
    <section
      role="alert"
      aria-label={t('structuralOrganism.diagnostics.title')}
      className={`flex flex-col gap-1.5 rounded border border-[hsl(var(${tone}))]/40 bg-[hsl(var(${tone}))]/10 p-2`}
    >
      <header className="flex items-center gap-2">
        <span aria-hidden="true" className={`text-[hsl(var(${tone}))]`}>
          !
        </span>
        <h4 className={`text-xs font-semibold uppercase tracking-wide text-[hsl(var(${tone}))]`}>
          {t('structuralOrganism.diagnostics.title')}
        </h4>
      </header>
      <ul className={`flex flex-col gap-1 text-xs text-[hsl(var(${tone}))]`}>
        {diagnostics.map((d) => (
          <li key={d.id} className="leading-snug">
            {t(d.messageKey, { defaultValue: '' }) || d.messageKey}
          </li>
        ))}
      </ul>
    </section>
  );
}
