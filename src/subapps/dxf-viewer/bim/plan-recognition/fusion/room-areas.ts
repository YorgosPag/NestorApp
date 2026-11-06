/**
 * ADR-929 Φ4 · Δ4 #3 · Δ17 — **γραμμένο εμβαδόν χώρου** («Σαλόνι 24 τ.μ.»): πηγή κλίμακας (η συνήθης περίπτωση της κάτοψης
 * αγγελίας, χωρίς καμία διάσταση) **και** έλεγχος συνέπειας («γράφει 24,0, μετρήθηκαν 22,6»).
 *
 * 🔑 **Κανένας δεύτερος ανιχνευτής χώρων.** Το περίγραμμα το βρίσκει ο ανιχνευτής του ADR-884 (`detectSpaceIn`: πόρτες που
 * σφραγίζονται, φρουροί διαρροής), με σπόρο το κέντρο του **ονόματος** του χώρου, πάνω στην ευθυγραμμισμένη εικόνα.
 * 🔑 **Σταθερό σημείο, όχι κύκλος.** Ο ανιχνευτής θέλει μέτρα/pixel για να ξέρει πόσο φαρδιά είναι μια πόρτα, και το εμβαδόν
 * είναι αυτό που **δίνει** τα μέτρα/pixel όταν δεν υπάρχει άλλη πηγή. Το εμβαδόν σε pixel εξαρτάται **ασθενώς** από την
 * κλίμακα (μόνο μέσω του κατωφλίου πόρτας), άρα η επανάληψη συγκλίνει σε 2–3 βήματα.
 *
 * @module subapps/dxf-viewer/bim/plan-recognition/fusion/room-areas
 */

import { prepareSpaceRaster, detectSpaceIn } from '@/lib/spatial-tour/space-detect/space-detect';
import type { PlanRaster } from '@/lib/geometry/raster/plan-raster';
import type { Homography, PlanePoint } from '@/lib/geometry/homography';
import { originalRectToAligned } from '../alignment/alignment-region';
import type { PlanReading } from '../plan-recognition-types';
import type { RasterRectPx } from '../../../types/coordinate-space';
import { median } from '../../../utils/statistics';
import type { FusedRoom, PlanFusionOptions, PlanScaleEvidence, RoomAreaProbe } from './plan-fusion-types';

/** Υπόθεση εκκίνησης όταν τίποτα άλλο δεν δίνει κλίμακα: η μικρή πλευρά του σχεδίου ≈ 12 m (κατοικία). */
const SEED_SPAN_MM = 12_000;
const FIXED_POINT_STEPS = 3;
const FIXED_POINT_CONVERGED_REL = 0.01;
const MM2_PER_M2 = 1_000_000;

/** Ο προεπιλεγμένος ανιχνευτής: ο ADR-884, προετοιμασμένος **μία** φορά για την εικόνα. */
export function createRoomAreaProbe(image: PlanRaster): RoomAreaProbe {
  const prepared = prepareSpaceRaster(image);
  return (seed, metresPerAlignedPx) => {
    const result = detectSpaceIn(prepared, { metresPerPixel: metresPerAlignedPx, seed, separations: [], otherStops: [] });
    return result.ok ? result.areaPx : null;
  };
}

interface RoomSeed {
  readonly name: string;
  readonly writtenAreaM2: number | null;
  readonly seed: PlanePoint | null;
  readonly rect: RasterRectPx | null;
}

function roomSeeds(reading: PlanReading, toAligned: Homography): RoomSeed[] {
  const texts = new Map(reading.texts.map((t) => [t.id, t]));
  return reading.rooms.map((room) => {
    const text = room.nameTextId === null ? undefined : texts.get(room.nameTextId);
    if (!text) return { name: room.name, writtenAreaM2: room.writtenAreaM2, seed: null, rect: null };
    const box = originalRectToAligned(text.rect, toAligned);
    return { name: room.name, writtenAreaM2: room.writtenAreaM2, seed: { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 }, rect: text.rect };
  });
}

export interface RoomMeasurement {
  readonly seeds: readonly RoomSeed[];
  /** Εμβαδόν σε ευθυγραμμισμένα px² ανά χώρο (ίδια σειρά με τα `seeds`). */
  readonly areasPx2: readonly (number | null)[];
}

function measureAt(seeds: readonly RoomSeed[], probe: RoomAreaProbe, mmPerPx: number): (number | null)[] {
  return seeds.map((s) => (s.seed === null ? null : probe(s.seed, mmPerPx / 1000)));
}

/** Η κλίμακα που υπονοούν τα γραμμένα εμβαδά: διάμεσος ανά χώρο (ανθεκτικό σε έναν λάθος χώρο). */
function impliedMmPerPx(seeds: readonly RoomSeed[], areas: readonly (number | null)[]): { value: number; support: number } | null {
  const implied = seeds.flatMap((s, i) => {
    const area = areas[i];
    return s.writtenAreaM2 !== null && area !== null && area > 0 ? [Math.sqrt((s.writtenAreaM2 * MM2_PER_M2) / area)] : [];
  });
  return implied.length > 0 ? { value: median(implied), support: implied.length } : null;
}

/**
 * Μέτρηση των χώρων: με γνωστή κλίμακα ⇒ ένα πέρασμα· χωρίς ⇒ σταθερό σημείο ξεκινώντας από την υπόθεση εκκίνησης.
 * Επιστρέφει και την ένδειξη κλίμακας από τα εμβαδά (Δ4 #3), όταν υπάρχει.
 */
export function measureRooms(
  reading: PlanReading,
  toAligned: Homography,
  probe: RoomAreaProbe,
  mmPerPxGuess: number | null,
  drawingSpanPx: number,
): { measurement: RoomMeasurement; evidence: PlanScaleEvidence | null } {
  const seeds = roomSeeds(reading, toAligned);
  let mmPerPx = mmPerPxGuess ?? SEED_SPAN_MM / drawingSpanPx;
  let areasPx2 = measureAt(seeds, probe, mmPerPx);
  let implied = impliedMmPerPx(seeds, areasPx2);
  for (let step = 0; mmPerPxGuess === null && implied !== null && step < FIXED_POINT_STEPS; step++) {
    const converged = Math.abs(implied.value - mmPerPx) <= FIXED_POINT_CONVERGED_REL * mmPerPx;
    mmPerPx = implied.value;
    if (converged) break;
    areasPx2 = measureAt(seeds, probe, mmPerPx);
    implied = impliedMmPerPx(seeds, areasPx2);
  }
  const evidence = implied === null ? null : { source: 'room-area' as const, mmPerAlignedPx: implied.value, support: implied.support };
  return { measurement: { seeds, areasPx2 }, evidence };
}

/** Οι χώροι στην **τελική** κλίμακα, με τον έλεγχο γραμμένου/μετρημένου εμβαδού (Δ17). */
export function fusedRooms(m: RoomMeasurement, mmPerPx: number | null, o: PlanFusionOptions): FusedRoom[] {
  return m.seeds.map((s, i) => {
    const area = m.areasPx2[i];
    const measuredAreaM2 = area === null || mmPerPx === null ? null : (area * mmPerPx * mmPerPx) / MM2_PER_M2;
    const status = measuredAreaM2 === null || s.writtenAreaM2 === null ? 'unmeasured'
      : Math.abs(measuredAreaM2 - s.writtenAreaM2) <= o.areaConflictRel * s.writtenAreaM2 ? 'consistent' : 'conflict';
    return { name: s.name, writtenAreaM2: s.writtenAreaM2, measuredAreaM2, status, rect: s.rect };
  });
}
