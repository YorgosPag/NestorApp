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
import {
  transformsEqual,
  type BackgroundTransform,
  type CalibrationData,
  type NaturalBounds,
  type Point2D,
  type ProviderId,
} from '@/subapps/dxf-viewer/floorplan-background/providers/types';
import { galleryScaleForCalibration } from '@/subapps/dxf-viewer/floorplan-background/geometry/raster-pixel-scale';
import { BackgroundLockedError, CalibrationStaleError, txReadOwnedRow } from './background-ownership';
import type { OverlayGeometry } from '@/types/floorplan-overlays';
// ADR-929 Φ0 — ΕΝΑΣ ορισμός του T·R·S του υποβάθρου: ο ίδιος που ζωγραφίζει την εικόνα και που ρωτά η αναγνώριση
// κάτοψης. Ως τώρα ήταν γραμμένος εδώ με το χέρι (μαζί με τον αντίστροφο) και, ξεχωριστά, ως `ctx.rotate/scale`.
import { applyAffine, invertAffine } from '@/lib/geometry/affine-2x3';
import { backgroundPlacementAffine } from '@/subapps/dxf-viewer/floorplan-background/geometry/raster-scene-mapping';

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
  /** Overlays whose geometry was actually rewritten. Excludes skipped docs. */
  overlaysRemapped: number;
  /**
   * Overlays matched by the query but skipped because their `geometry` was
   * missing or malformed. Non-zero means data the calibration did NOT move —
   * those polygons now sit at the wrong real-world position.
   */
  overlaysSkipped: number;
  atomicWithBackground: boolean;
}

// ============================================================================
// AFFINE MATH (T·R·S, Y-UP CAD) — SSoT: floorplan-background/geometry/raster-scene-mapping
// ============================================================================

const ATOMIC_LIMIT = 499; // Firestore batch hard cap = 500 ops; reserve 1 for background update.

/** Τοπικές συντεταγμένες υποβάθρου → κόσμος: το `T·R·S` του SSoT. */
function applyTransform(p: Point2D, t: BackgroundTransform): Point2D {
  return applyAffine(backgroundPlacementAffine(t), p);
}

/**
 * Κόσμος → τοπικές συντεταγμένες υποβάθρου. Εκφυλισμένος στόχος (κλίμακα 0) ⇒ **σφάλμα**, όχι σιωπηλό μηδέν: ο
 * παλιός χειρόγραφος αντίστροφος έστελνε κάθε κορυφή στο 0, δηλαδή θα έγραφε σκουπίδια σε κάθε επικάλυψη του
 * ορόφου μέσα στην ίδια συναλλαγή με τη βαθμονόμηση.
 */
function applyInverseTransform(p: Point2D, t: BackgroundTransform): Point2D {
  const inverse = invertAffine(backgroundPlacementAffine(t));
  if (!inverse) throw new Error('Calibration remap: degenerate background transform (zero scale)');
  return applyAffine(inverse, p);
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

/**
 * Remap geometry coordinates across an affine transform change (ADR-340 Phase 9).
 *
 * Handles the discriminated union by remapping each shape's coordinate-bearing
 * fields (x,y points) via `remapVertex`. Scalar fields (radius, fontSize,
 * rotation) preserved as-is — uniform-scale calibrations keep them visually
 * consistent; non-uniform calibrations on circle/arc/text are a known v1
 * limitation (auxiliary kinds; ADR §"Out of scope").
 *
 * Returns null if the geometry is malformed; caller skips the doc.
 */
function remapGeometry(
  raw: unknown,
  oldT: BackgroundTransform,
  newT: BackgroundTransform,
): OverlayGeometry | null {
  if (!raw || typeof raw !== 'object') return null;
  const g = raw as { type?: string } & Record<string, unknown>;
  switch (g.type) {
    case 'polygon': {
      const verts = readPolygon((g as { vertices?: unknown }).vertices);
      if (verts.length === 0) return null;
      const remapped = verts.map((v) => remapVertex(v, oldT, newT));
      const out: OverlayGeometry = { type: 'polygon', vertices: remapped };
      if (typeof (g as { closed?: unknown }).closed === 'boolean') {
        (out as { closed?: boolean }).closed = (g as { closed?: boolean }).closed;
      }
      return out;
    }
    case 'line': {
      const start = (g as { start?: unknown }).start;
      const end = (g as { end?: unknown }).end;
      if (!isPoint(start) || !isPoint(end)) return null;
      return {
        type: 'line',
        start: remapVertex(start, oldT, newT),
        end: remapVertex(end, oldT, newT),
      };
    }
    case 'circle': {
      const center = (g as { center?: unknown }).center;
      const radius = (g as { radius?: unknown }).radius;
      if (!isPoint(center) || typeof radius !== 'number') return null;
      return {
        type: 'circle',
        center: remapVertex(center, oldT, newT),
        radius,
      };
    }
    case 'arc': {
      const center = (g as { center?: unknown }).center;
      const radius = (g as { radius?: unknown }).radius;
      const startAngle = (g as { startAngle?: unknown }).startAngle;
      const endAngle = (g as { endAngle?: unknown }).endAngle;
      if (
        !isPoint(center) ||
        typeof radius !== 'number' ||
        typeof startAngle !== 'number' ||
        typeof endAngle !== 'number'
      ) {
        return null;
      }
      const out: OverlayGeometry = {
        type: 'arc',
        center: remapVertex(center, oldT, newT),
        radius,
        startAngle,
        endAngle,
      };
      const ccw = (g as { counterclockwise?: unknown }).counterclockwise;
      if (typeof ccw === 'boolean') {
        (out as { counterclockwise?: boolean }).counterclockwise = ccw;
      }
      return out;
    }
    case 'dimension': {
      const from = (g as { from?: unknown }).from;
      const to = (g as { to?: unknown }).to;
      if (!isPoint(from) || !isPoint(to)) return null;
      const out: OverlayGeometry = {
        type: 'dimension',
        from: remapVertex(from, oldT, newT),
        to: remapVertex(to, oldT, newT),
      };
      const offset = (g as { offset?: unknown }).offset;
      const value = (g as { value?: unknown }).value;
      const unit = (g as { unit?: unknown }).unit;
      if (typeof offset === 'number') (out as { offset?: number }).offset = offset;
      if (typeof value === 'string') (out as { value?: string }).value = value;
      if (unit === 'm' || unit === 'cm' || unit === 'mm') {
        (out as { unit?: 'm' | 'cm' | 'mm' }).unit = unit;
      }
      return out;
    }
    case 'measurement': {
      const points = readPolygon((g as { points?: unknown }).points);
      const mode = (g as { mode?: unknown }).mode;
      const value = (g as { value?: unknown }).value;
      const unit = (g as { unit?: unknown }).unit;
      if (
        points.length === 0 ||
        (mode !== 'distance' && mode !== 'area' && mode !== 'angle') ||
        typeof value !== 'number' ||
        typeof unit !== 'string'
      ) {
        return null;
      }
      return {
        type: 'measurement',
        points: points.map((p) => remapVertex(p, oldT, newT)),
        mode,
        value,
        unit,
      };
    }
    case 'text': {
      const position = (g as { position?: unknown }).position;
      const text = (g as { text?: unknown }).text;
      if (!isPoint(position) || typeof text !== 'string') return null;
      const out: OverlayGeometry = {
        type: 'text',
        position: remapVertex(position, oldT, newT),
        text,
      };
      const fontSize = (g as { fontSize?: unknown }).fontSize;
      const rotation = (g as { rotation?: unknown }).rotation;
      if (typeof fontSize === 'number') (out as { fontSize?: number }).fontSize = fontSize;
      if (typeof rotation === 'number') (out as { rotation?: number }).rotation = rotation;
      return out;
    }
    default:
      return null;
  }
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

/** Το doc του Admin SDK, παράγωγο από τον ΗΔΗ εισαγόμενο `Firestore`. */
type OverlayDoc = Awaited<ReturnType<ReturnType<Firestore['collection']>['get']>>['docs'][number];

/**
 * ADR-929 Φ5.2γ — ό,τι κοινό έχουν batch και συναλλαγή του Admin SDK για εμάς: `update`. Ο ατομικός κλάδος
 * γράφει πλέον μέσα σε **συναλλαγή** (ανάγνωση + έλεγχος σύγκρουσης + εγγραφή), ο τμηματικός σε batches.
 */
interface GeometryWriter {
  update(ref: OverlayDoc['ref'], data: Record<string, unknown>): unknown;
}

/**
 * Βάζει στην ουρά ενός batch τις ενημερώσεις γεωμετρίας για ένα σύνολο overlay docs.
 *
 * N.18 — ο ίδιος βρόχος ζούσε δύο φορές: μία στον ατομικό κλάδο (≤500 overlays, ένα
 * batch μαζί με το background doc) και μία στον τμηματικό. Οι δύο κλάδοι διαφέρουν
 * **μόνο** στο πώς δεσμεύονται τα batches — όχι στο τι γράφεται σε κάθε overlay.
 *
 * @returns πόσα ΟΝΤΩΣ μπήκαν στην ουρά· τα malformed προσπερνιούνται και είναι η
 *          διαφορά που γίνεται `overlaysSkipped` (ΔΕΝ μετακινήθηκαν στον κόσμο).
 */
function queueGeometryRemap(
  writer: GeometryWriter, docs: readonly OverlayDoc[], input: RemapInput, now: number,
): number {
  let queued = 0;
  for (const doc of docs) {
    const remappedGeometry = remapGeometry(
      doc.data().geometry, input.oldTransform, input.newTransform,
    );
    if (!remappedGeometry) continue;
    writer.update(doc.ref, { geometry: remappedGeometry, updatedAt: now });
    queued += 1;
  }
  return queued;
}

// ============================================================================
// SERVICE
// ============================================================================

/** Το background όπως το διαβάζει η συναλλαγή — μόνο ό,τι χρειάζεται ο έλεγχος και η κλίμακα. */
interface BackgroundRow {
  readonly transform: BackgroundTransform;
  readonly locked?: boolean;
  readonly providerId?: ProviderId;
  readonly naturalBounds?: NaturalBounds;
}

/**
 * ADR-929 Φ5.2γ — έλεγχος σύγκρουσης: η βαθμονόμηση μετακινεί τα overlays από το `oldTransform` στο νέο.
 * Αν ο server έχει άλλη θέση (άλλη καρτέλα / άλλος χρήστης), η αναπροσαρμογή θα ήταν σιωπηλά λάθος.
 */
function assertCalibratable(row: BackgroundRow, input: RemapInput): void {
  if (row.locked) throw new BackgroundLockedError(input.backgroundId);
  if (!transformsEqual(row.transform, input.oldTransform)) throw new CalibrationStaleError(input.backgroundId);
}

/** Τι γράφεται στο background: θέση + βαθμονόμηση + (για εικόνες) η ίδια κλίμακα για τη συλλογή. */
function backgroundUpdate(row: BackgroundRow, input: RemapInput, now: number): Record<string, unknown> {
  // `calibratedBy` από την ταυτότητα του αιτήματος — ποτέ ό,τι έστειλε ο πελάτης.
  const calibration: CalibrationData = { ...input.calibration, calibratedBy: input.updatedBy };
  const gallery = row.providerId && row.naturalBounds
    ? galleryScaleForCalibration({
        providerId: row.providerId,
        naturalBounds: row.naturalBounds,
        transform: input.newTransform,
        calibration,
      })
    : null;
  return {
    transform: input.newTransform,
    calibration,
    ...(gallery ? { scale: { ...gallery, calibratedAt: now, calibratedBy: input.updatedBy } } : {}),
    updatedAt: now,
    updatedBy: input.updatedBy,
  };
}

type AtomicOutcome =
  | { readonly atomic: true; readonly matched: number; readonly remapped: number }
  | { readonly atomic: false; readonly row: BackgroundRow; readonly overlays: readonly OverlayDoc[] };

/** Ανάγνωση + έλεγχος + (αν χωρά) εγγραφή, όλα σε **μία** συναλλαγή. */
async function runAtomic(input: RemapInput): Promise<AtomicOutcome> {
  const db = getDb();
  const ref = backgroundRef(input.backgroundId);
  const query = db
    .collection(COLLECTIONS.FLOORPLAN_OVERLAYS)
    .where('companyId', '==', input.companyId)
    .where('backgroundId', '==', input.backgroundId);
  return db.runTransaction(async (tx): Promise<AtomicOutcome> => {
    const row = (await txReadOwnedRow(tx, ref, input.backgroundId, input.companyId, 'Cross-tenant calibration denied')) as BackgroundRow;
    assertCalibratable(row, input);
    const overlays = (await tx.get(query)).docs;
    if (overlays.length > ATOMIC_LIMIT) return { atomic: false, row, overlays };
    const now = Date.now();
    const remapped = queueGeometryRemap(tx, overlays, input, now);
    tx.update(ref, backgroundUpdate(row, input, now));
    return { atomic: true, matched: overlays.length, remapped };
  });
}

/**
 * Πάνω από 499 overlays δεν χωρούν σε μία συναλλαγή: τμήματα, και το background **τελευταίο**. Ο έλεγχος
 * σύγκρουσης έχει ήδη γίνει στη συναλλαγή· ⚠️ δηλωμένο όριο: εδώ δεν είναι ατομικό (ήταν και πριν).
 */
async function runChunked(input: RemapInput, row: BackgroundRow, overlays: readonly OverlayDoc[]): Promise<number> {
  const db = getDb();
  const now = Date.now();
  let remapped = 0;
  for (let i = 0; i < overlays.length; i += ATOMIC_LIMIT) {
    const batch = db.batch();
    remapped += queueGeometryRemap(batch, overlays.slice(i, i + ATOMIC_LIMIT), input, now);
    await batch.commit();
  }
  await backgroundRef(input.backgroundId).update(backgroundUpdate(row, input, now));
  return remapped;
}

function reportRemap(input: RemapInput, result: RemapResult, matched: number): void {
  if (result.overlaysSkipped > 0) {
    logger.warn('Calibration remap skipped overlays with malformed geometry', {
      companyId: input.companyId,
      backgroundId: input.backgroundId,
      skipped: result.overlaysSkipped,
      matched,
    });
  }
  logger.info('Calibration remap complete', { companyId: input.companyId, backgroundId: input.backgroundId, ...result });
}

export class CalibrationRemapService {
  /**
   * Atomically check the stored placement (ADR-929 Φ5.2γ: `409 CALIBRATION_STALE` on mismatch), remap all
   * overlays and persist the new transform + calibration (+ gallery scale for images) on the background.
   */
  static async applyCalibration(input: RemapInput): Promise<RemapResult> {
    try {
      const outcome = await runAtomic(input);
      const matched = outcome.atomic ? outcome.matched : outcome.overlays.length;
      const remapped = outcome.atomic ? outcome.remapped : await runChunked(input, outcome.row, outcome.overlays);
      const result: RemapResult = {
        overlaysRemapped: remapped,
        overlaysSkipped: matched - remapped,
        atomicWithBackground: outcome.atomic,
      };
      reportRemap(input, result, matched);
      return result;
    } catch (err) {
      logger.error('Calibration remap failed', { backgroundId: input.backgroundId, error: getErrorMessage(err) });
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
  remapGeometry,
};
