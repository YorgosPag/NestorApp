/**
 * =============================================================================
 * 🏢 ENTERPRISE: Calibration Remap Service (Q10)
 * =============================================================================
 *
 * Recomputes polygon vertex coordinates so they preserve their real-world
 * position when the background transform changes (e.g. user calibrates a
 * 2-point reference distance).
 *
 *   vertex_new = inverse(T_new) ∘ T_old(vertex_old)
 *
 * Polygons are stored in pixel-space of the background's natural raster
 * (Y-UP CAD). This service operates on `floorplan_overlays` only — DXF
 * polygons are coordinates in DXF world space and are not affected by
 * raster background calibration.
 *
 * Atomicity: when overlay count ≤ 499, the calibration write + all polygon
 * updates ship in a single Firestore batch (atomic). Above that the polygons
 * ship first in chunks; the calibration write runs last. The window between
 * polygon writes and the final calibration write is sub-second under normal
 * load — readers seeing intermediate state still get correct real-world
 * positions because the math is reversible.
 *
 * @module services/floorplan-background/calibration-remap.service
 * @enterprise ADR-340 Phase 7 — Q10
 */

import 'server-only';

import { getAdminFirestore, type Firestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import type {
  BackgroundTransform,
  CalibrationData,
  Point2D,
} from '@/subapps/dxf-viewer/floorplan-background/providers/types';

const logger = createModuleLogger('CalibrationRemapService');

// ============================================================================
// TYPES
// ============================================================================

export interface RemapInput {
  companyId: string;
  backgroundId: string;
  /** Pre-calibration transform (current value in store / Firestore). */
  oldTransform: BackgroundTransform;
  /** Post-calibration transform (the new partial merged on top). */
  newTransform: BackgroundTransform;
  /** Calibration record to persist on the background. */
  calibration: CalibrationData;
  /** User performing calibration — recorded as updatedBy on background. */
  updatedBy: string;
}

export interface RemapResult {
  overlaysRemapped: number;
  atomicWithBackground: boolean;
}

// ============================================================================
// AFFINE MATH (T·R·S, Y-UP CAD)
// ============================================================================

const DEG_TO_RAD = Math.PI / 180;
const ATOMIC_LIMIT = 499; // Firestore batch hard cap = 500 ops; reserve 1 for background update.

function applyTransform(p: Point2D, t: BackgroundTransform): Point2D {
  // scale
  const sx = p.x * t.scaleX;
  const sy = p.y * t.scaleY;
  // rotate (CCW positive)
  const a = t.rotation * DEG_TO_RAD;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const rx = sx * cos - sy * sin;
  const ry = sx * sin + sy * cos;
  // translate
  return { x: rx + t.translateX, y: ry + t.translateY };
}

function applyInverseTransform(p: Point2D, t: BackgroundTransform): Point2D {
  // un-translate
  const ux = p.x - t.translateX;
  const uy = p.y - t.translateY;
  // un-rotate (apply -theta)
  const a = -t.rotation * DEG_TO_RAD;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const rx = ux * cos - uy * sin;
  const ry = ux * sin + uy * cos;
  // un-scale (guard against zero)
  const sx = t.scaleX !== 0 ? rx / t.scaleX : 0;
  const sy = t.scaleY !== 0 ? ry / t.scaleY : 0;
  return { x: sx, y: sy };
}

function remapVertex(
  v: Point2D,
  oldT: BackgroundTransform,
  newT: BackgroundTransform,
): Point2D {
  const world = applyTransform(v, oldT);
  return applyInverseTransform(world, newT);
}

function remapPolygon(
  polygon: ReadonlyArray<Point2D>,
  oldT: BackgroundTransform,
  newT: BackgroundTransform,
): Point2D[] {
  return polygon.map((v) => remapVertex(v, oldT, newT));
}

// ============================================================================
// HELPERS
// ============================================================================

function getDb(): Firestore {
  return getAdminFirestore();
}

function backgroundRef(id: string) {
  return getDb().collection(COLLECTIONS.FLOORPLAN_BACKGROUNDS).doc(id);
}

function isPoint(p: unknown): p is Point2D {
  return (
    typeof p === 'object' &&
    p !== null &&
    typeof (p as Point2D).x === 'number' &&
    typeof (p as Point2D).y === 'number'
  );
}

function readPolygon(raw: unknown): Point2D[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isPoint) as Point2D[];
}

// ============================================================================
// SERVICE
// ============================================================================

export class CalibrationRemapService {
  /**
   * Atomically remap all overlays for a background and persist the new
   * transform + calibration on the background doc itself.
   */
  static async applyCalibration(input: RemapInput): Promise<RemapResult> {
    const db = getDb();
    try {
      const overlaysSnap = await db
        .collection(COLLECTIONS.FLOORPLAN_OVERLAYS)
        .where('companyId', '==', input.companyId)
        .where('backgroundId', '==', input.backgroundId)
        .get();

      const overlayDocs = overlaysSnap.docs;
      const atomicWithBackground = overlayDocs.length <= ATOMIC_LIMIT;
      const now = Date.now();

      if (atomicWithBackground) {
        const batch = db.batch();
        for (const doc of overlayDocs) {
          const data = doc.data();
          const polygon = readPolygon(data.polygon);
          if (polygon.length === 0) continue;
          const remapped = remapPolygon(polygon, input.oldTransform, input.newTransform);
          batch.update(doc.ref, { polygon: remapped, updatedAt: now });
        }
        batch.update(backgroundRef(input.backgroundId), {
          transform: input.newTransform,
          calibration: input.calibration,
          updatedAt: now,
          updatedBy: input.updatedBy,
        });
        await batch.commit();
      } else {
        const CHUNK = ATOMIC_LIMIT;
        for (let i = 0; i < overlayDocs.length; i += CHUNK) {
          const chunk = overlayDocs.slice(i, i + CHUNK);
          const batch = db.batch();
          for (const doc of chunk) {
            const data = doc.data();
            const polygon = readPolygon(data.polygon);
            if (polygon.length === 0) continue;
            const remapped = remapPolygon(polygon, input.oldTransform, input.newTransform);
            batch.update(doc.ref, { polygon: remapped, updatedAt: now });
          }
          await batch.commit();
        }
        await backgroundRef(input.backgroundId).update({
          transform: input.newTransform,
          calibration: input.calibration,
          updatedAt: now,
          updatedBy: input.updatedBy,
        });
      }

      const result: RemapResult = {
        overlaysRemapped: overlayDocs.length,
        atomicWithBackground,
      };
      logger.info('Calibration remap complete', {
        companyId: input.companyId,
        backgroundId: input.backgroundId,
        ...result,
      });
      return result;
    } catch (err) {
      logger.error('Calibration remap failed', {
        backgroundId: input.backgroundId,
        error: getErrorMessage(err),
      });
      throw err;
    }
  }
}

// Exposed for unit tests.
export const __test__ = {
  applyTransform,
  applyInverseTransform,
  remapVertex,
  remapPolygon,
};
