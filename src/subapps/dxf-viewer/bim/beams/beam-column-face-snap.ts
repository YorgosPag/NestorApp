/**
 * Beam→Column face snap — pure SSoT (ADR-398 §Smart beam ghost, mirror του column ghost).
 *
 * Όταν το εργαλείο «Δοκάρι» είναι ενεργό, **πριν το 1ο κλικ** εμφανίζεται ένα μικρό
 * έξυπνο φάντασμα δοκαριού. Κοντά σε **ορθογώνια κολόνα** ο cursor «κουμπώνει» σε μία
 * από 12 διακριτές θέσεις (4 παρειές × 3 αγκυρώσεις) — το φάντασμα ΠΗΔΑΕΙ, δεν γλιστρά.
 * Μακριά από κάθε κολόνα → `null` (ελεύθερη κίνηση, ο caller δείχνει default ghost).
 *
 * Σημασιολογία (Revit/ETABS-grade): το δοκάρι βγαίνει **κάθετα προς τα έξω** από την
 * παρειά, με το κοντινό short-end να πατά flush στην παρειά (full bearing):
 *   · E (ανατ.) / W (δυτ.)  → δοκάρι ΟΡΙΖΟΝΤΙΟ (άξονας κατά X)
 *   · N (βόρ.) / S (νότ.)   → δοκάρι ΚΑΘΕΤΟ   (άξονας κατά Y)
 * Τα 3 thirds κατά μήκος της παρειάς:
 *   · `lo`  → γωνία-flush στη μία άκρη (η πλάγια παρειά δοκαριού ≡ γωνιακή παρειά κολόνας)
 *   · `mid` → centerline ≡ κέντρο κολόνας
 *   · `hi`  → γωνία-flush στην άλλη άκρη
 *
 * **Επιστρέφει το ΤΕΛΙΚΟ centerline** `start`/`end` (όχι location-line). Ο caller κλειδώνει
 * το `start` στο 1ο κλικ ως centerline (`startAnchored`) → το 2ο κλικ τραβά ελεύθερα από
 * αυτό το σταθερό σημείο (centerline mode, ΟΧΙ auto-flush justification — αλλιώς το start
 * θα μετατοπιζόταν ±width/2 σε διαγώνιο τράβηγμα).
 *
 * Pure — zero React/DOM/store. Reuse `projectPolygonOnAxis` (polygon-vs-axis SSoT, N.0.2)
 * για τα world-aligned extents (όχι hand-rolled bbox loop). Μονάδες: **scene units**
 * (footprints world-baked· ο caller μετατρέπει mm→scene μέσω `resolveBeamGhostSnapFromStore`).
 *
 * @see ./beam-column-flush.ts — η location-line (auto-flush) αδελφή για το free placement
 * @see ../geometry/shared/polygon-axis-projection.ts — projectPolygonOnAxis (extents SSoT)
 * @see ../../hooks/drawing/beam-preview-helpers.ts — preview consumer (ghost-before-click)
 * @see ../../hooks/drawing/useBeamTool.ts — click consumer (1ο κλικ κλειδώνει το start)
 * @see docs/centralized-systems/reference/adrs/ADR-398-column-placement-snap.md
 */

import type { Point2D } from '../../rendering/types/Types';
import { projectPolygonOnAxis } from '../geometry/shared/polygon-axis-projection';
import { mmToSceneUnits } from '../../utils/scene-units';
import type { SceneUnits } from '../../utils/scene-units';

/** Παρειά κολόνας στην οποία κουμπώνει το φάντασμα (world-aligned). */
export type BeamGhostFace = 'E' | 'W' | 'N' | 'S';
/** Αγκύρωση κατά μήκος της παρειάς: γωνία / κέντρο / γωνία. */
export type BeamGhostThird = 'lo' | 'mid' | 'hi';

/** Πλήρες αποτέλεσμα face-snap: ποια παρειά + ποιο third + το centerline start/end. */
export interface BeamColumnFaceSnap {
  readonly face: BeamGhostFace;
  readonly third: BeamGhostThird;
  /** Centerline START (κλειδώνει το 1ο κλικ, πατά flush στην παρειά). */
  readonly start: Point2D;
  /** Centerline END (μικρό ghost, `ghostLenScene` προς τα έξω, κάθετα στην παρειά). */
  readonly end: Point2D;
}

/** Παράμετροι (όλες σε **scene units**) — ο caller κάνει το mm→scene conversion. */
export interface BeamFaceSnapOptions {
  /** Πλάτος δοκαριού (perpendicular) → half = offset των flush anchors. */
  readonly beamWidthScene: number;
  /** Μήκος του μικρού φαντάσματος προς τα έξω από την παρειά. */
  readonly ghostLenScene: number;
  /** Μέγιστη απόσταση cursor→παρειά για να ενεργοποιηθεί το snap. */
  readonly captureScene: number;
}

/** Default μήκος του ghost-before-click (mm) — μικρό, ίσα με ~μισό τυπικό άνοιγμα. */
export const BEAM_GHOST_LEN_MM = 1200;
/** Default capture (mm) από την παρειά της κολόνας. */
export const BEAM_GHOST_CAPTURE_MM = 600;

interface ColumnBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

/** World-aligned extents πολυγώνου μέσω του `projectPolygonOnAxis` SSoT (X + Y άξονες). */
function columnBounds(verts: readonly { readonly x: number; readonly y: number }[]): ColumnBounds {
  const xp = projectPolygonOnAxis(verts, 0, 0, 1, 0); // along = v.x
  const yp = projectPolygonOnAxis(verts, 0, 0, 0, 1); // along = v.y
  return { minX: xp.alongMin, maxX: xp.alongMax, minY: yp.alongMin, maxY: yp.alongMax };
}

/** Απόσταση σημείου από (clamped) bbox — 0 όταν εντός. */
function distanceToBounds(c: Readonly<Point2D>, b: ColumnBounds): number {
  const dx = Math.max(b.minX - c.x, 0, c.x - b.maxX);
  const dy = Math.max(b.minY - c.y, 0, c.y - b.maxY);
  return Math.hypot(dx, dy);
}

/** Third επιλογή κατά μήκος μιας παρειάς από κανονικοποιημένη θέση `[lo, hi]`. */
function pickThird(value: number, lo: number, hi: number): BeamGhostThird {
  const span = hi - lo;
  if (span <= 0) return 'mid';
  const t = Math.min(1, Math.max(0, (value - lo) / span));
  return t < 1 / 3 ? 'lo' : t < 2 / 3 ? 'mid' : 'hi';
}

/**
 * Επίλεξε face-snap για το ghost-before-click. Pure. `null` όταν καμία κολόνα δεν είναι
 * εντός `captureScene` (ελεύθερη κίνηση).
 */
export function resolveBeamColumnFaceSnap(
  cursor: Readonly<Point2D>,
  columnFootprints: readonly (readonly Point2D[])[],
  opts: Readonly<BeamFaceSnapOptions>,
): BeamColumnFaceSnap | null {
  // ── πλησιέστερη κολόνα εντός capture ──────────────────────────────────────
  let best: ColumnBounds | null = null;
  let bestDist = Infinity;
  for (const fp of columnFootprints) {
    if (fp.length < 3) continue;
    const b = columnBounds(fp);
    const d = distanceToBounds(cursor, b);
    if (d <= opts.captureScene && d < bestDist) {
      bestDist = d;
      best = b;
    }
  }
  if (!best) return null;

  const { minX, maxX, minY, maxY } = best;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const halfX = (maxX - minX) / 2;
  const halfY = (maxY - minY) / 2;
  const half = opts.beamWidthScene / 2;
  const len = opts.ghostLenScene;

  // ── ποια παρειά: κανονικοποιημένη θέση cursor → κυρίαρχος άξονας → πλευρά ──
  const ex = halfX > 0 ? (cursor.x - cx) / halfX : 0;
  const ey = halfY > 0 ? (cursor.y - cy) / halfY : 0;
  const face: BeamGhostFace =
    Math.abs(ex) >= Math.abs(ey) ? (ex >= 0 ? 'E' : 'W') : ey >= 0 ? 'N' : 'S';

  // ── E/W: οριζόντιο δοκάρι (άξονας X), thirds κατά Y ───────────────────────
  if (face === 'E' || face === 'W') {
    const third = pickThird(cursor.y, minY, maxY);
    const y = third === 'lo' ? minY + half : third === 'hi' ? maxY - half : cy;
    const faceX = face === 'E' ? maxX : minX;
    const tip = face === 'E' ? faceX + len : faceX - len;
    return { face, third, start: { x: faceX, y }, end: { x: tip, y } };
  }

  // ── N/S: κάθετο δοκάρι (άξονας Y), thirds κατά X ──────────────────────────
  const third = pickThird(cursor.x, minX, maxX);
  const x = third === 'lo' ? minX + half : third === 'hi' ? maxX - half : cx;
  const faceY = face === 'N' ? maxY : minY;
  const tip = face === 'N' ? faceY + len : faceY - len;
  return { face, third, start: { x, y: faceY }, end: { x, y: tip } };
}

/**
 * Wrapper που κάνει το mm→scene conversion και καλεί τον pure resolver. **ΕΝΑ SSoT**
 * για preview (`beam-preview-helpers`) ΚΑΙ click (`useBeamTool`) ώστε το φάντασμα να
 * είναι ταυτόσημο με το σημείο που κλειδώνει το 1ο κλικ (preview === commit).
 *
 * @param beamWidthMm  `overrides.width ?? DEFAULT_BEAM_WIDTH_MM` (mm).
 */
export function resolveBeamGhostSnapFromStore(
  cursor: Readonly<Point2D>,
  columnFootprints: readonly (readonly Point2D[])[],
  beamWidthMm: number,
  sceneUnits: SceneUnits,
): BeamColumnFaceSnap | null {
  if (columnFootprints.length === 0) return null;
  const f = mmToSceneUnits(sceneUnits);
  return resolveBeamColumnFaceSnap(cursor, columnFootprints, {
    beamWidthScene: beamWidthMm * f,
    ghostLenScene: BEAM_GHOST_LEN_MM * f,
    captureScene: BEAM_GHOST_CAPTURE_MM * f,
  });
}
