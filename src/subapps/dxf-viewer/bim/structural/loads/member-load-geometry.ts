/**
 * Member load geometry — SSoT για τα γεωμετρικά μεγέθη που τροφοδοτούν το tributary
 * load takedown (ADR-467). Δύο concerns, μία πηγή (N.0.2):
 *
 *   1. Κέντρο διατομής κολώνας (m) → tributary grid (`computeGridTributaryAreas`).
 *   2. Ίδιο βάρος κατακόρυφου/γραμμικού μέλους (kN) → extra μόνιμο φορτίο.
 *
 * Pure — zero React/DOM/Firestore. Μονάδες: μήκη m, φορτία kN. Πριν το ADR-467 αυτά
 * ζούσαν private μέσα στο `footing-design/footing-load-takedown.ts`· εξήχθησαν εδώ
 * (loads/ = κάτω layer) ώστε να τα μοιράζονται footing takedown ΚΑΙ load-path walk.
 *
 * @see ./load-takedown.ts — TributaryColumn / computeGridTributaryAreas
 * @see docs/centralized-systems/reference/adrs/ADR-467-load-path-engine.md
 */

import type { ColumnEntity } from '../../types/column-types';
import type { BeamEntity } from '../../types/beam-types';
import { buildColumnSectionContext } from '../section-context';
import { concreteWeightKg } from '../concrete-grades';
import { mmToSceneUnits } from '../../../utils/scene-units';
import type { TributaryColumn } from './load-takedown';

/** Επιτάχυνση βαρύτητας (m/s²) — μάζα σκυροδέματος → φορτίο. */
export const GRAVITY_MS2 = 9.81;

/** mm² · mm → m³ (όγκος διατομής × ύψος). */
const MM2_MM_TO_M3 = 1 / 1e9;

/** kg → kN (× g / 1000). */
function concreteSelfWeightKn(volumeM3: number): number {
  const v = Number.isFinite(volumeM3) && volumeM3 > 0 ? volumeM3 : 0;
  return (concreteWeightKg(v) * GRAVITY_MS2) / 1000;
}

/** Κέντρο διατομής κολώνας (m) από το bbox του footprint (canvas units → m). */
export function columnCenterM(c: ColumnEntity): TributaryColumn | null {
  const verts = c.geometry?.footprint?.vertices;
  if (!verts || verts.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const v of verts) {
    if (v.x < minX) minX = v.x;
    if (v.x > maxX) maxX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.y > maxY) maxY = v.y;
  }
  const perScene = mmToSceneUnits(c.params.sceneUnits ?? 'mm');
  const toM = (canvas: number): number => canvas / perScene / 1000;
  return { id: c.id, xM: toM((minX + maxX) / 2), yM: toM((minY + maxY) / 2) };
}

/** Ίδιο βάρος μίας κολώνας ανά όροφο (kN) από τη διατομή × ύψος της. */
export function columnSelfWeightPerStoreyKn(c: ColumnEntity): number {
  const s = buildColumnSectionContext(c);
  const volumeM3 = Math.max(0, s.grossAreaMm2) * Math.max(0, s.heightMm) * MM2_MM_TO_M3;
  return concreteSelfWeightKn(volumeM3);
}

/** Ίδιο βάρος δοκαριού (kN) από τον αποθηκευμένο όγκο γεωμετρίας (m³). */
export function beamSelfWeightKn(b: BeamEntity): number {
  return concreteSelfWeightKn(b.geometry?.volume ?? 0);
}
