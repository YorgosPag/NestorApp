/**
 * SSoT — «είναι αυτό έγκυρη εγγραφή βαθμονόμησης;». Ο έλεγχος που κάνει ο διακομιστής στο
 * `PATCH /api/floorplan-backgrounds/[id]` (`kind: 'calibration'`) πριν γράψει οτιδήποτε.
 *
 * 🔴 **Γιατί βγήκε από το route (ADR-929 Φ5.3γ, 2026-11-07).** Ζούσε μέσα στο `route.ts`, άρα κανένα test δεν μπορούσε
 * να τον κρίνει χωρίς να στήσει ολόκληρο αίτημα. Η Φ5.3γ τον αλλάζει (N αναφορές, προέλευση, πηγή ανά αναφορά): χωρίς
 * test, ένα λάθος εδώ σημαίνει είτε απόρριψη κάθε κάρτας κλίμακας είτε αποδοχή σκουπιδιών στη βάση.
 *
 * 🔑 **Παλιές εγγραφές μένουν έγκυρες.** Κάθε προαιρετικό πεδίο είναι απόν ή έγκυρο, ποτέ κάτι ενδιάμεσο.
 * 🔑 **Ένα όριο.** Το πλήθος των αναφορών κρίνεται με το `CALIBRATION_LIMITS.maxReferences`, τη δήλωση που διαβάζει
 * και η κάρτα κλίμακας.
 *
 * ΚΑΘΑΡΟ (pure).
 *
 * @module subapps/dxf-viewer/floorplan-background/geometry/calibration-record-guard
 */

import { isFiniteNumber } from '@/lib/type-guards';
import {
  isCalibrationOrigin,
  isCalibrationUnit,
  type CalibrationData,
  type CalibrationReferenceRecord,
} from '../providers/types';
import { CALIBRATION_LIMITS } from './calibration-solve';

/** Το μέγιστο μήκος ταυτότητας κειμένου (`PlanText.id`) που δεχόμαστε ως πηγή αναφοράς. */
export const MAX_SOURCE_TEXT_ID_LENGTH = 64;

function isPoint(p: unknown): boolean {
  if (!p || typeof p !== 'object') return false;
  const q = p as { x?: unknown; y?: unknown };
  return isFiniteNumber(q.x) && isFiniteNumber(q.y);
}

function isSourceTextId(v: unknown): boolean {
  return v === undefined || (typeof v === 'string' && v.length > 0 && v.length <= MAX_SOURCE_TEXT_ID_LENGTH);
}

/** Μία αναφορά: δύο σημεία, θετικό μήκος, γνωστή μονάδα (κοινό για την πρώτη και τις `references`). */
function isReference(v: unknown): v is CalibrationReferenceRecord {
  if (!v || typeof v !== 'object') return false;
  const r = v as CalibrationReferenceRecord;
  return isPoint(r.pointA) && isPoint(r.pointB)
    && isFiniteNumber(r.realDistance) && r.realDistance > 0 && isCalibrationUnit(r.unit);
}

function isStoredReference(v: unknown): v is CalibrationReferenceRecord {
  return isReference(v) && isSourceTextId(v.sourceTextId);
}

/** ADR-929 Φ5.2/Φ5.3γ — τα προαιρετικά πεδία: απόντα (παλιός πελάτης) ή έγκυρα, ποτέ κάτι ενδιάμεσο. */
function hasValidExtensions(c: CalibrationData): boolean {
  if (c.sceneUnits !== undefined && !isCalibrationUnit(c.sceneUnits)) return false;
  if (c.scaleMode !== undefined && c.scaleMode !== 'uniform' && c.scaleMode !== 'per-axis') return false;
  if (c.origin !== undefined && !isCalibrationOrigin(c.origin)) return false;
  if (c.references === undefined) return true;
  return Array.isArray(c.references)
    && c.references.length >= 1 && c.references.length <= CALIBRATION_LIMITS.maxReferences
    && c.references.every(isStoredReference);
}

/** Έγκυρη εγγραφή βαθμονόμησης; Το `calibratedBy` δεν κρίνεται εδώ: το γράφει ο διακομιστής από την ταυτότητα. */
export function isCalibrationData(v: unknown): v is CalibrationData {
  if (!v || typeof v !== 'object') return false;
  const c = v as CalibrationData;
  if (c.method !== 'two-point') return false;
  return isReference(c) && hasValidExtensions(c);
}
