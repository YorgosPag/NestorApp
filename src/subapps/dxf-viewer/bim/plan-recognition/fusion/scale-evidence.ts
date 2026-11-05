/**
 * ADR-929 Φ4 · Δ4 — **μία** κλίμακα από πολλές πηγές, και ο έλεγχος συνέπειας ανάμεσά τους.
 *
 * 🔑 **Σειρά (Δ4).** Η υπάρχουσα βαθμονόμηση **κερδίζει** (είναι αυτή που τοποθετεί την εικόνα στη σκηνή, άρα ό,τι δείχνει η
 * οθόνη συμφωνεί μαζί της). Αλλιώς: γραμμένες διαστάσεις (συναίνεση) → γραμμένη κλίμακα «1:100» με DPI → γραμμένα εμβαδά.
 * Οι υπόλοιπες γίνονται **έλεγχος**: διαφωνία πάνω από ανοχή ⇒ ερώτηση με τις δύο τιμές, ποτέ σιωπηλή επιλογή.
 * 🔑 **Χώροι pixel.** Οι πηγές μιλούν σε **αρχικά** px (βαθμονόμηση, DPI)· ο λύτης σε **ευθυγραμμισμένα**. Η μετατροπή γίνεται
 * **μόνο** με την τοπική κλίμακα της ομογραφίας στο κέντρο του σχεδίου (`FusionFrame.originalPerAlignedPx`).
 *
 * @module subapps/dxf-viewer/bim/plan-recognition/fusion/scale-evidence
 */

import type { RasterPixelScale } from '../../../floorplan-background/geometry/raster-pixel-scale';
import type { PlanWrittenScale } from '../plan-recognition-types';
import type { FusionFrame } from './fusion-frame';
import type { PlanFusionOptions, PlanQuestion, PlanScaleEvidence, PlanScaleSource } from './plan-fusion-types';

const MM_PER_INCH = 25.4;
const MM_PER_M = 1000;

/** Η σειρά προτεραιότητας του Δ4. */
const PRIORITY: readonly PlanScaleSource[] = ['known-calibration', 'dimension-consensus', 'written-scale', 'room-area'];

/** Τα εμβαδά είναι συχνά **μικτά** ή στρογγυλεμένα: η ανοχή τους είναι εκείνη του εμβαδού, στη ρίζα (κλίμακα ~ √εμβαδού). */
const conflictTolerance = (e: PlanScaleEvidence, o: PlanFusionOptions): number =>
  e.source === 'room-area' ? Math.max(o.scaleConflictRel, o.areaConflictRel / 2) : o.scaleConflictRel;

export function knownScaleEvidence(scale: RasterPixelScale | null, frame: FusionFrame): PlanScaleEvidence | null {
  if (scale === null) return null;
  const metresPerOriginalPx = Math.sqrt(scale.metresPerPixelX * scale.metresPerPixelY);
  return { source: 'known-calibration', mmPerAlignedPx: metresPerOriginalPx * MM_PER_M * frame.originalPerAlignedPx, support: 1 };
}

/** «1:100» σε εικόνα `dpi` ⇒ ένα αρχικό pixel είναι `25,4 / dpi` mm χαρτιού ⇒ × παρονομαστή mm πραγματικού κόσμου. */
export function writtenScaleEvidence(written: PlanWrittenScale | null, sourceDpi: number | null, frame: FusionFrame): PlanScaleEvidence | null {
  if (written === null || sourceDpi === null || !(sourceDpi > 0) || !(written.denominator > 0)) return null;
  const mmPerOriginalPx = (MM_PER_INCH / sourceDpi) * written.denominator;
  return { source: 'written-scale', mmPerAlignedPx: mmPerOriginalPx * frame.originalPerAlignedPx, support: 1 };
}

/** Η επιλεγμένη πηγή κατά Δ4, ή `null` χωρίς καμία. */
export function chooseScale(evidence: readonly PlanScaleEvidence[]): PlanScaleEvidence | null {
  for (const source of PRIORITY) {
    const hit = evidence.find((e) => e.source === source);
    if (hit) return hit;
  }
  return null;
}

/** Κάθε άλλη πηγή που διαφωνεί με την επιλεγμένη πάνω από την ανοχή της ⇒ ερώτηση. */
export function scaleConflicts(chosen: PlanScaleEvidence, evidence: readonly PlanScaleEvidence[], o: PlanFusionOptions): PlanQuestion[] {
  return evidence.flatMap((other) => {
    if (other.source === chosen.source) return [];
    const rel = Math.abs(Math.log(other.mmPerAlignedPx / chosen.mmPerAlignedPx));
    const tol = conflictTolerance(other, o);
    return rel > tol ? [{ kind: 'scale-conflict' as const, chosen, other, severity: rel / tol }] : [];
  });
}

/** Μέτρα ανά **αρχικό** pixel στο κέντρο του σχεδίου, από mm ανά ευθυγραμμισμένο pixel. */
export const metresPerOriginalPx = (mmPerAlignedPx: number, frame: FusionFrame): number =>
  mmPerAlignedPx / frame.originalPerAlignedPx / MM_PER_M;
