/**
 * @fileoverview **Ό,τι διαβάστηκε + ό,τι επιβεβαίωσε ο άνθρωπος → σημεία σε mm** (ADR-920 Β4.7).
 * @related ./survey-file-read (οι δρόμοι) · ./survey-units (η πρόταση μονάδας) · ./dxf-survey-points (`scaleSurveyPoints`) ·
 *   ./survey-upload-preparation (το επόμενο βήμα: η ετυμηγορία της πόρτας)
 * @module lib/terrain/survey-import/survey-points
 *
 * 🔑 **Η μονάδα δεν μαντεύεται ποτέ σιωπηλά.** Τρεις περιπτώσεις, με αυτή τη σειρά:
 *   1. **Δηλωμένη** — DXF με `$INSUNITS` που σημαίνει μονάδα μήκους: το αρχείο τη λέει, δεν ρωτάμε.
 *   2. **Προτεινόμενη** — πίνακας, ή DXF που δεν λέει (απόν / `0` = «χωρίς μονάδες»): `suggestSurveyUnit` με αιτιολόγηση
 *      (ΕΓΣΑ'87 / έκταση) — η οθόνη την προεπιλέγει, ο άνθρωπος την επιβεβαιώνει.
 *   3. **Άγνωστη** — καμία ένδειξη: δεν βγαίνει κανένα σημείο ώσπου να διαλέξει ο άνθρωπος.
 *   *(Ο viewer κρατά τις ιστορικές του προεπιλογές `0` → m · απόν → mm — η πολιτική είναι του καλούντα, §13.2.)*
 *
 * 🔑 **Ένας δρόμος κλίμακας**: οι γραμμές του πίνακα διαβάζονται σε μονάδες αρχείου (κλίμακα 1) και μετά κλιμακώνονται
 * από το **ίδιο** `scaleSurveyPoints` με το DXF — η πρόταση μονάδας και τα τελικά σημεία βλέπουν τα ίδια νούμερα.
 */

import { INSUNITS_TO_MM } from '@/lib/dxf/dxf-insunits';

import type { TopoPoint } from '../terrain-types';
import { scaleSurveyPoints } from './dxf-survey-points';
import type { SurveyFileRead } from './survey-file-read';
import { suggestSurveyUnit, type SurveyUnitSuggestion } from './survey-units';
import { applyColumnMapping, hasPositionMapping } from './topo-column-mapping';
import { TOPO_UNIT_SCALE_TO_MM, type ColumnMapping, type TopoUnit } from './topo-import-types';

/** Τα κωδικοποιημένα `$INSUNITS` που ΔΕΝ λένε μονάδα: «χωρίς μονάδες». */
const UNITLESS_INSUNITS = 0;

export type SurveyUnitDecision =
  | { readonly kind: 'declared'; readonly insunits: number; readonly scaleToMm: number }
  | { readonly kind: 'to-confirm'; readonly suggestion: SurveyUnitSuggestion | null };

/** Τα σημεία σε ΜΟΝΑΔΕΣ ΑΡΧΕΙΟΥ, με τις γραμμές πίνακα που δεν είναι σημεία (1-based). */
interface FileUnitPoints {
  readonly points: readonly TopoPoint[];
  readonly skippedRows: readonly number[];
}

export interface SurveyPoints {
  /** WORLD mm — ό,τι παίρνει το `prepareSurveyUpload`. Κενό όσο λείπει μονάδα ή θέση. */
  readonly points: readonly TopoPoint[];
  readonly skippedRows: readonly number[];
}

/** `$INSUNITS` → mm ανά μονάδα σχεδίου, ή `null` όταν το αρχείο δεν δηλώνει μονάδα μήκους. */
export function declaredDxfScaleToMm(insunits: number | null): number | null {
  if (insunits === null || insunits === UNITLESS_INSUNITS) return null;
  return INSUNITS_TO_MM[insunits] ?? null;
}

function fileUnitPointsOf(read: SurveyFileRead, mapping: ColumnMapping): FileUnitPoints {
  if (read.road === 'dxf') return { points: read.scan.points, skippedRows: [] };
  if (read.road !== 'table' || !hasPositionMapping(mapping)) return { points: [], skippedRows: [] };
  const mapped = applyColumnMapping(read.table, mapping, 'mm'); // mm → mm = κλίμακα 1: τα νούμερα του αρχείου
  return { points: mapped.points, skippedRows: mapped.skipped };
}

/** **Ποια μονάδα, και ποιος τη λέει** — το αρχείο (DXF) ή ο άνθρωπος, με την πρόταση και την αιτιολόγησή της. */
export function surveyUnitDecision(read: SurveyFileRead, mapping: ColumnMapping): SurveyUnitDecision {
  if (read.road === 'dxf') {
    const scaleToMm = declaredDxfScaleToMm(read.scan.declaredInsunits);
    if (scaleToMm !== null && read.scan.declaredInsunits !== null) {
      return { kind: 'declared', insunits: read.scan.declaredInsunits, scaleToMm };
    }
  }
  return { kind: 'to-confirm', suggestion: suggestSurveyUnit(fileUnitPointsOf(read, mapping).points) };
}

/**
 * **Τα σημεία που θα δημοσιευτούν**, σε mm. `unit` είναι η επιβεβαίωση του ανθρώπου — αγνοείται όταν το αρχείο δηλώνει
 * μονάδα, και όσο είναι `null` δεν βγαίνει κανένα σημείο (ποτέ σιωπηλή προεπιλογή).
 */
export function surveyPointsOf(read: SurveyFileRead, mapping: ColumnMapping, unit: TopoUnit | null): SurveyPoints {
  const declared = read.road === 'dxf' ? declaredDxfScaleToMm(read.scan.declaredInsunits) : null;
  const scaleToMm = declared ?? (unit === null ? null : TOPO_UNIT_SCALE_TO_MM[unit]);
  const raw = fileUnitPointsOf(read, mapping);
  if (scaleToMm === null) return { points: [], skippedRows: raw.skippedRows };
  return { points: scaleSurveyPoints(raw.points, scaleToMm), skippedRows: raw.skippedRows };
}
