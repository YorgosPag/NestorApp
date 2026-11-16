/**
 * ADR-929 §6.23 — **συμφωνεί η υπάρχουσα βαθμονόμηση με τις γραμμένες διαστάσεις, ή η διαφορά είναι σημαντική;**
 *
 * 🔑 **Γιατί όχι «μέγιστη απόκλιση %».** Μια απόκλιση 3 mm σε διάσταση γραμμένη «4.12» (τελευταίο ψηφίο 10 mm) είναι
 * **μέσα** στη στρογγυλοποίηση της ίδιας της τιμής: η «διόρθωση» της κλίμακας θα κυνηγούσε θόρυβο. Bluebeam / STACK /
 * PlanSwift δείχνουν μόνο την απόκλιση και αφήνουν τον άνθρωπο να κρίνει· η τοπογραφική συνόρθωση (ICSM, Harvey/OSU)
 * κρίνει με **ολικό τεστ χ²** πριν δεχτεί διόρθωση. Αυτό κάνουμε.
 * 🔑 **Το τεστ.** Η βαθμονόμηση είναι **σταθερή** (δεν εκτιμάται εδώ) ⇒ κάθε διάσταση είναι ανεξάρτητη παρατήρηση με
 * υπόλοιπο `μετρημένο − γραμμένο` και a priori σ τη **δική της** (`FusedDimension.sigmaMm`, το βάρος της στη συνόρθωση).
 * `T = Σ (υπόλοιπο/σ)²` ακολουθεί χ² με `n` βαθμούς ελευθερίας· `T ≤ χ²(n, 95%)` ⇒ «μέσα στην ακρίβεια».
 * Το κατώφλι είναι το **ίδιο** με το ολικό τεστ της συνόρθωσης (`chiSquareQuantile`, `Z_95`): ένας ορισμός «σημαντικού».
 *
 * ΚΑΘΑΡΟ (pure) — μηδέν React/store/DOM. Ντετερμινιστικό.
 *
 * @module subapps/dxf-viewer/bim/plan-recognition/fusion/calibration-agreement
 */

import { chiSquareQuantile, Z_95 } from '@/lib/linear-algebra/weighted-least-squares';
import type { FusedDimension } from './plan-fusion-types';

/** Μία διάσταση απέναντι στη βαθμονόμηση. */
export interface CalibrationAgreementRow {
  readonly textId: string;
  readonly valueMm: number;
  /** `μετρημένο − γραμμένο` (mm), στην κλίμακα της βαθμονόμησης. */
  readonly misfitMm: number;
  readonly sigmaMm: number;
  /** Το μέγεθος του τελευταίου γραμμένου ψηφίου (mm): «±μισό» είναι το εύρος στρογγυλοποίησης. */
  readonly precisionMm: number;
}

export interface CalibrationAgreement {
  readonly rows: readonly CalibrationAgreementRow[];
  /** Το στατιστικό `Σ (υπόλοιπο/σ)²`. */
  readonly statistic: number;
  readonly degreesOfFreedom: number;
  /** Το κρίσιμο `χ²(n, 95%)`. */
  readonly critical: number;
  /** `true` ⇒ οι διαφορές εξηγούνται από την ακρίβεια των γραμμένων τιμών: η αλλαγή κλίμακας δεν βελτιώνει τη μέτρηση. */
  readonly withinPrecision: boolean;
  /** Η μεγαλύτερη σχετική απόκλιση `μετρημένο / γραμμένο − 1`. */
  readonly maxDeviationRel: number;
}

function rowOf(d: FusedDimension): CalibrationAgreementRow | null {
  if (d.status !== 'consistent' || d.measuredMm === null || !(d.sigmaMm > 0)) return null;
  return { textId: d.textId, valueMm: d.valueMm, misfitMm: d.measuredMm - d.valueMm, sigmaMm: d.sigmaMm, precisionMm: d.precisionMm };
}

/** Το ολικό τεστ πάνω στις διαστάσεις που η συνόρθωση κράτησε· `null` όταν καμία δεν ελέγχεται. */
export function calibrationAgreement(dimensions: readonly FusedDimension[]): CalibrationAgreement | null {
  const rows = dimensions.map(rowOf).filter((r): r is CalibrationAgreementRow => r !== null);
  if (rows.length === 0) return null;
  const statistic = rows.reduce((sum, r) => sum + (r.misfitMm / r.sigmaMm) ** 2, 0);
  const critical = chiSquareQuantile(rows.length, Z_95);
  const maxDeviationRel = rows.reduce((max, r) => Math.max(max, Math.abs(r.misfitMm / r.valueMm)), 0);
  return { rows, statistic, degreesOfFreedom: rows.length, critical, withinPrecision: statistic <= critical, maxDeviationRel };
}
