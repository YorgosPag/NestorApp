'use client';

/**
 * @fileoverview **Από το αρχείο στα σημεία — και τι συνέβη σε καθένα** (ADR-920 Β4.9): στήλες και μονάδες, πόσα σημεία,
 * ποιες γραμμές παραλείφθηκαν (με αριθμό), ποιες θέσεις επαναλαμβάνονται ή αντιφάσκουν, και η ετυμηγορία της πόρτας.
 * @related hooks/listings/useTerrainSurveyImport · ./SurveyColumnMapTable · ./SurveyUnitSelect ·
 *   lib/terrain/survey-import/survey-points (`SurveyUnitDecision`) · lib/terrain/survey-import/skipped-rows-summary
 * @module components/terrain/survey-import/SurveyPointsStep
 *
 * 🔑 **Καμία σιωπηλή αποτυχία** (εκεί όπου ο Civil 3D σιωπά): μονάδα που λείπει, στήλες χωρίς Χ/Ψ, γραμμές που δεν έγιναν
 *   σημεία, αντιφατικά υψόμετρα — όλα λέγονται, με αριθμό που ο άνθρωπος βρίσκει στο αρχείο του.
 * 🔑 **Η ετυμηγορία είναι της ΠΟΡΤΑΣ** (`prepareSurveyUpload`, ίδιος κώδικας με τον server): ό,τι λέει «όχι» εδώ, θα το
 *   έλεγε και ο διακομιστής — με το ίδιο μήνυμα από τον ίδιο κατάλογο.
 */

import React from 'react';

import type { TerrainSurveyImportApi } from '@/hooks/listings/useTerrainSurveyImport';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatList, formatNumber } from '@/lib/intl-formatting';
import { TERRAIN_REFUSAL_MESSAGE_LIMITS } from '@/lib/terrain/publication/terrain-publication-contract';
import { skippedRowsSummaryOf } from '@/lib/terrain/survey-import/skipped-rows-summary';
import { hasPositionMapping } from '@/lib/terrain/survey-import/topo-column-mapping';

import { SurveyColumnMapTable } from './SurveyColumnMapTable';
import { SurveyUnitSelect } from './SurveyUnitSelect';

const NS = 'terrain-survey';

type Survey = Pick<
  TerrainSurveyImportApi,
  'read' | 'mapping' | 'unit' | 'unitDecision' | 'points' | 'preparation' | 'setRole' | 'applyPreset' | 'setUnit'
>;

/** Η μονάδα: δηλωμένη από το σχέδιο · προτεινόμενη με αιτιολόγηση · ή ζητούμενη. */
function UnitNote({ survey }: { readonly survey: Survey }) {
  const { t } = useTranslation([NS]);
  const { unitDecision: decision, unit } = survey;
  if (decision === null) return null;
  if (decision.kind === 'declared') return <p className="m-0 text-sm text-muted-foreground">{t(`${NS}:unit.declared`)}</p>;
  if (unit === null) return <p role="alert" className="m-0 text-sm text-foreground">{t(`${NS}:unit.needed`)}</p>;
  const { suggestion } = decision;
  if (suggestion === null || suggestion.unit !== unit) return null;
  return (
    <p className="m-0 text-sm text-muted-foreground">
      {t(`${NS}:unit.suggested.${suggestion.evidence}`, { unit: t(`${NS}:unit.${unit}`) })}
    </p>
  );
}

/** «Παραλείφθηκαν 3 γραμμές: 4, 9 και 12» — ή «4, 9, 12, … και άλλες 40». */
function skippedRowsText(t: ReturnType<typeof useTranslation>['t'], rows: readonly number[]): string {
  const { shown, more } = skippedRowsSummaryOf(rows);
  const numbers = shown.map((row) => formatNumber(row, { useGrouping: false }));
  const listed = more === 0 ? formatList(numbers) : t(`${NS}:points.skippedMore`, { rows: numbers.join(', '), count: more });
  return t(`${NS}:points.skipped`, { count: rows.length, rows: listed });
}

/** Ό,τι έγινε στα σημεία: πλήθος, παραλείψεις, επαναλήψεις, αντιφάσεις — και η ετυμηγορία. */
function PointsFacts({ survey }: { readonly survey: Survey }) {
  const { t } = useTranslation([NS]);
  const { read, mapping, points, preparation } = survey;
  if (read?.road === 'table' && !hasPositionMapping(mapping)) {
    return <p role="alert" className="m-0 text-sm text-foreground">{t(`${NS}:points.noPosition`)}</p>;
  }
  const facts = preparation?.facts ?? null;
  const repeated = facts === null ? 0 : facts.coincident - facts.conflictingElevations;
  return (
    <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm text-foreground">
      {facts !== null && <li>{t(`${NS}:points.summary`, { points: facts.points, withElevation: facts.withElevation })}</li>}
      {points.skippedRows.length > 0 && <li className="text-muted-foreground">{skippedRowsText(t, points.skippedRows)}</li>}
      {repeated > 0 && <li className="text-muted-foreground">{t(`${NS}:points.coincident`, { count: repeated })}</li>}
      {facts !== null && facts.conflictingElevations > 0 && (
        <li>{t(`${NS}:points.conflicting`, { count: facts.conflictingElevations })}</li>
      )}
      {preparation !== null && !preparation.ok && (
        <li role="alert" className="rounded border border-destructive p-2">
          {t(`${NS}:publish.refusals.${preparation.code}`, TERRAIN_REFUSAL_MESSAGE_LIMITS)}
        </li>
      )}
    </ul>
  );
}

export function SurveyPointsStep({ survey, disabled = false }: { readonly survey: Survey; readonly disabled?: boolean }) {
  const { read, mapping, unit, unitDecision, setRole, applyPreset, setUnit } = survey;
  if (read === null || read.road === 'refused') return null;
  return (
    <section className="flex flex-col gap-3">
      {read.road === 'table' ? (
        <SurveyColumnMapTable
          headers={read.table.headers}
          rows={read.table.rows}
          mapping={mapping}
          unit={unit}
          disabled={disabled}
          onRole={setRole}
          onPreset={applyPreset}
          onUnit={setUnit}
        />
      ) : (
        unitDecision?.kind === 'to-confirm' && <SurveyUnitSelect unit={unit} disabled={disabled} onUnit={setUnit} />
      )}
      <UnitNote survey={survey} />
      <PointsFacts survey={survey} />
    </section>
  );
}
