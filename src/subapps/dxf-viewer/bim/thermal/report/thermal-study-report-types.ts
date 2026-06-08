/**
 * ADR-422 L5 — Μηχανολογική Μελέτη Θέρμανσης: Report type schema (PURE).
 *
 * Αναλυτικό (analytical) report contract — ΟΧΙ entity-based (`Schedule`). Τα δεδομένα
 * θέρμανσης (per-space φορτία / per-radiator sizing / per-segment sizing / per-circuit
 * balancing) είναι read-models, όχι raw BIM entities. Γι' αυτό ΔΕΝ επεκτείνουμε το shared
 * `ScheduleEntityType` union (αποφυγή σύγκρουσης με BOQ/schedule). Reuse-άρουμε ΜΟΝΟ τους
 * value-formatter primitives (`ScheduleCellValue`/`ScheduleColumnValueType`/`ScheduleColumnAlign`).
 *
 * SSoT: ο builder (`thermal-study-report.ts`) παράγει i18n **keys** (μηδέν t() μέσα — η
 * μετάφραση γίνεται στο export από τον injected translator). Όλα derived, μηδέν persist.
 *
 * @see ./thermal-study-report (pure builder) · ./thermal-study-pdf-exporter (printout)
 * @see docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md §3 (L5)
 */

import type {
  ScheduleCellValue,
  ScheduleColumnAlign,
  ScheduleColumnValueType,
} from '../../schedule/types';

/** Μία στήλη ενός report section — i18nKey (resolved @export) + value-type/alignment. */
export interface ReportColumn {
  readonly key: string;
  /** i18n key (namespace-relative) — resolved μέσω translator στο export. */
  readonly i18nKey: string;
  readonly valueType: ScheduleColumnValueType;
  readonly align: ScheduleColumnAlign;
}

/** Μία γραμμή — cells keyed από `ReportColumn.key`. */
export type ReportRow = Readonly<Record<string, ScheduleCellValue>>;

/** Ένα τμήμα του report (σύνοψη ή πίνακας) — τίτλος (i18nKey) + στήλες + γραμμές. */
export interface ReportSection {
  /** i18n key τίτλου τμήματος. */
  readonly titleKey: string;
  readonly columns: readonly ReportColumn[];
  readonly rows: readonly ReportRow[];
}

/** Resolved header context (ήδη μεταφρασμένα labels — δεν περνούν από translator). */
export interface ThermalStudyHeader {
  readonly buildingLabel: string;
  readonly floorLabel: string;
}

/** Πλήρες report: header + σύνοψη + 5 πίνακες (ΟΛΑ ως sections). */
export interface ThermalStudyReport {
  readonly header: ThermalStudyHeader;
  /** [σύνοψη, φορτία, σώματα, σωληνώσεις, εξισορρόπηση, ΚΕΝΑΚ-κέλυφος]. */
  readonly sections: readonly ReportSection[];
  /** true ⇒ δεν υπάρχει μοντέλο θέρμανσης στον όροφο (όλοι οι πίνακες κενοί). */
  readonly isEmpty: boolean;
}
