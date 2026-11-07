/**
 * ADR-929 Φ5.2 — από «ό,τι έδωσε ο άνθρωπος» (σημεία σκηνής + πληκτρολογημένα μήκη) σε είσοδο του
 * επιλυτή και σε εγγραφή βαθμονόμησης. Καθαρό: το καλεί ο διάλογος για ζωντανή προεπισκόπηση **και** η
 * πράξη εγγραφής, ώστε αυτό που βλέπει ο χρήστης να είναι ακριβώς αυτό που γράφεται.
 *
 * - Τα μήκη διαβάζονται με το SSoT `parseLocaleNumber` («10,30» και «10.30» = 10,3)· ένα
 *   `<input type="number">` με ελληνικό κόμμα έδινε σιωπηλά 10.
 * - Μονάδα → χιλιοστά με το SSoT `realDistanceToModelMm` (οι μονάδες βαθμονόμησης είναι οι ίδιες με τις
 *   μονάδες σκηνής). Ο παλιός πίνακας `UNIT_TO_MM` του `useCalibration` ήταν δεύτερη δήλωση.
 * - Σημεία σκηνής → pixel εικόνας με το SSoT `sceneToRasterPixel` (Δ3: καμία δεύτερη αντιστοίχιση).
 *
 * @module subapps/dxf-viewer/floorplan-background/geometry/calibration-draft
 */

import type { Point2D } from '../../rendering/types/Types';
import { parseLocaleNumber } from '@/lib/number/locale-number';
import { realDistanceToModelMm, type SceneUnits } from '../../utils/scene-units';
import type { CalibrationData, CalibrationOrigin, CalibrationReferenceRecord, CalibrationUnit } from '../providers/types';
import { sceneToRasterPixel, type RasterPlacement } from './raster-scene-mapping';
import type { CalibrationReferences, CalibrationSolution } from './calibration-solve';

/** Ένα πληκτρολογημένο μήκος του διαλόγου, όπως το έγραψε ο άνθρωπος. */
export interface CalibrationLengthDraft {
  readonly text: string;
  readonly unit: CalibrationUnit;
}

/** Το μήκος σε θετικά χιλιοστά, ή `null` όταν το κείμενο δεν είναι θετικός αριθμός. */
export function parseCalibrationLengthMm(draft: CalibrationLengthDraft): number | null {
  const value = parseLocaleNumber(draft.text);
  if (value === null || !(value > 0)) return null;
  return realDistanceToModelMm(value, draft.unit);
}

/** Οι αναφορές με τα σημεία τους σε pixel εικόνας — η μορφή που αποθηκεύεται. */
export interface CalibrationDraftReference {
  readonly record: CalibrationReferenceRecord;
  readonly lengthMm: number;
}

/**
 * Ζευγαρώνει σημεία (A,B[,C,D]) με μήκη. `null` όταν λείπει μήκος, όταν τα σημεία δεν φτάνουν, ή όταν η
 * τοποθέτηση είναι εκφυλισμένη (δεν υπάρχει pixel κάτω από το σημείο).
 */
export function toCalibrationReferences(
  worldPoints: readonly Point2D[],
  lengths: readonly CalibrationLengthDraft[],
  placement: RasterPlacement,
): CalibrationDraftReference[] | null {
  const refs: CalibrationDraftReference[] = [];
  for (let i = 0; i < lengths.length; i++) {
    const [wa, wb] = [worldPoints[2 * i], worldPoints[2 * i + 1]];
    const lengthMm = parseCalibrationLengthMm(lengths[i]);
    if (!wa || !wb || lengthMm === null) return null;
    const [pa, pb] = [sceneToRasterPixel(wa, placement), sceneToRasterPixel(wb, placement)];
    if (!pa || !pb) return null;
    const value = parseLocaleNumber(lengths[i].text) ?? 0;
    refs.push({ lengthMm, record: { pointA: pa, pointB: pb, realDistance: value, unit: lengths[i].unit } });
  }
  return refs.length > 0 ? refs : null;
}

/** Η μορφή που ζητά ο επιλυτής (1 ή 2 αναφορές). */
export function toSolverReferences(refs: readonly CalibrationDraftReference[]): CalibrationReferences | null {
  const toInput = (r: CalibrationDraftReference) => ({ a: r.record.pointA, b: r.record.pointB, lengthMm: r.lengthMm });
  if (refs.length === 1) return [toInput(refs[0])];
  if (refs.length === 2) return [toInput(refs[0]), toInput(refs[1])];
  return null;
}

/**
 * Η εγγραφή βαθμονόμησης. Το `calibratedBy` το συμπληρώνει ο **server** από την ταυτότητα του αιτήματος
 * (ADR-929 Φ5.2) — εδώ μένει κενό, και ο server δεν εμπιστεύεται ό,τι στείλει ο πελάτης.
 * ADR-929 Φ5.3γ: η προέλευση γράφεται **πάντα** ρητά (`manual` από τον διάλογο, `plan-dimensions` από την κάρτα).
 */
export function buildCalibrationData(
  refs: readonly CalibrationDraftReference[],
  solution: CalibrationSolution,
  sceneUnits: SceneUnits,
  alignToAxis: boolean,
  now: number,
  origin: CalibrationOrigin,
): CalibrationData {
  const first = refs[0].record;
  return {
    method: 'two-point',
    pointA: first.pointA,
    pointB: first.pointB,
    realDistance: first.realDistance,
    unit: first.unit,
    rotationDerived: alignToAxis,
    calibratedAt: now,
    calibratedBy: '',
    sceneUnits,
    references: refs.map((r) => r.record),
    scaleMode: solution.mode,
    origin,
  };
}
