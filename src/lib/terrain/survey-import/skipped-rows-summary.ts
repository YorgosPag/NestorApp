/**
 * @fileoverview **Ποιες γραμμές του αρχείου δεν έγιναν σημεία — με αριθμό, όχι μόνο πλήθος** (ADR-920 Β4.9).
 * @related ./survey-points (`SurveyPoints.skippedRows`, 1-based) · components/terrain/survey-import/SurveyPointsReport
 * @module lib/terrain/survey-import/skipped-rows-summary
 *
 * 🔑 Ο Civil 3D αποτυγχάνει συχνά **σιωπηλά** στις γραμμές που δεν διαβάζει· εδώ ο άνθρωπος παίρνει τους αριθμούς των
 *   γραμμών για να τις βρει στο αρχείο του. Πολλές γραμμές ⇒ οι πρώτες + «και άλλες Ν», ποτέ τοίχος αριθμών.
 */

/** Πόσοι αριθμοί γραμμών γράφονται πριν το «και άλλες Ν». */
export const SKIPPED_ROWS_SHOWN = 10;

export interface SkippedRowsSummary {
  /** Οι πρώτες γραμμές, με αύξουσα σειρά. */
  readonly shown: readonly number[];
  /** Πόσες ακόμη δεν γράφονται. */
  readonly more: number;
}

export function skippedRowsSummaryOf(rows: readonly number[], shown: number = SKIPPED_ROWS_SHOWN): SkippedRowsSummary {
  const sorted = [...rows].sort((a, b) => a - b);
  return { shown: sorted.slice(0, shown), more: Math.max(0, sorted.length - shown) };
}
