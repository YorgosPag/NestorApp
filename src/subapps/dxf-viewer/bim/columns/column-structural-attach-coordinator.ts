/**
 * Column ↔ Structural-Host Coordinator — ADR-401 Phase F.3 (auto-attach).
 *
 * Mirror του `wall-structural-attach-coordinator` για **κολώνες**. Όταν
 * δημιουργείται structural host (δοκάρι / πλάκα), βρες τις κολώνες που πρέπει να
 * «κολλήσουν» αυτόματα την κορυφή (ή τη βάση) τους πάνω/κάτω του. Pure detection
 * (μηδέν mutation) — ο καλών εκτελεί `AttachColumns{Top|Base}Command`.
 *
 * Διαφορά από τον τοίχο: η κολώνα έχει **σημειακό footprint** (πολύγωνο) αντί για
 * άξονα. Plan-overlap = το footprint του host καλύπτει το κέντρο ή ≥1 γωνία του
 * footprint της κολώνας (`isPointInPolygon` — ίδιο point-in-polygon που κάνει το
 * per-corner matching ο `resolveColumnTopProfile`). Footprint + host footprint
 * μοιράζονται το ΙΔΙΟ plan space (η ίδια σύζευξη που τρέχει ο resolver στο
 * `BimSceneLayer.syncColumns`).
 *
 * Z-gate (Revit "Attach Top/Base" parity, επιλογή Giorgio — ίδιο με τον τοίχο):
 *   • top  → η κάτω-παρειά του host είναι ΠΑΝΩ από τη βάση της κολώνας (ταβάνι/δοκάρι,
 *            όχι η πλάκα-πάτωμα από κάτω).
 *   • base → η άνω-παρειά του host είναι ΚΑΤΩ από τη βάση της κολώνας (θεμέλιο).
 *
 * @see bim/walls/wall-structural-attach-coordinator.ts — ο δίδυμος του τοίχου
 * @see bim/geometry/column-vertical-profile.ts — resolveColumnBaseZmm
 * @see docs/centralized-systems/reference/adrs/ADR-401-bim-wall-top-base-constraints-attach-to-structural.md §5 (Phase F)
 */

import type { Entity } from '../../types/entities';
import { isBeamEntity, isSlabEntity, isColumnEntity } from '../../types/entities';
import { isPointInPolygon } from '../../utils/geometry/GeometryUtils';
import {
  beamHostInput,
  slabHostInput,
  type HostFootprintInput,
  type Pt2,
} from '../geometry/wall-host-plan-builder';
import { resolveColumnBaseZmm } from '../geometry/column-vertical-profile';
import { columnSupportAlong } from './column-face-trim';
import { mmToSceneUnits } from '../../utils/scene-units';
import type { ColumnEntity } from '../types/column-types';
import type { BeamEntity } from '../types/beam-types';

/**
 * mm. Ένας host μετράει ως «πάνω/κάτω» από τη βάση της κολώνας μόνο όταν απέχει
 * τουλάχιστον τόσο — έτσι μια πλάκα στο ίδιο επίπεδο με τη βάση δεν προσελκύεται.
 */
const AUTO_ATTACH_Z_GATE_MM = 1;

/**
 * Active level scene σύμβαση: όλα τα entity elevations είναι level-relative με
 * datum 0 (ίδιο με `wall-structural-attach-coordinator`). Άρα ο Z gate τρέχει με
 * `floorElevationMm: 0`.
 */
const ACTIVE_LEVEL_FLOOR_MM = 0;

/** Host footprint-input από beam/slab, αλλιώς null (όχι structural). */
function hostInputOf(host: Entity): HostFootprintInput | null {
  if (isBeamEntity(host)) return beamHostInput(host);
  if (isSlabEntity(host)) return slabHostInput(host);
  return null;
}

/** Κέντρο (centroid) του footprint πολυγώνου. */
function footprintCentroid(verts: readonly Pt2[]): Pt2 {
  let x = 0;
  let y = 0;
  for (const v of verts) {
    x += v.x;
    y += v.y;
  }
  return { x: x / verts.length, y: y / verts.length };
}

/**
 * True αν το footprint του host καλύπτει την κολώνα.
 *
 * - **Πλάκα** (`requireCentroid=false`): κέντρο **Ή** τουλάχιστον μία γωνία μέσα στο host
 *   footprint. Η πλάκα είναι **επίπεδη** → όλες οι γωνίες παίρνουν το ίδιο soffit → flat
 *   top, οπότε το corner-overlap είναι ασφαλές (μηδέν κλίση).
 * - **Δοκάρι** (`requireCentroid=true`): **ΜΟΝΟ** το κέντρο. Το δοκάρι είναι **στενή λωρίδα**·
 *   ένα απλό corner-graze (το δοκάρι ακουμπά μία γωνία κι «φεύγει») δεν στηρίζει την κολώνα
 *   από πάνω → ο per-corner resolver θα κατέβαζε ΜΟΝΟ αυτή τη γωνία → **κεκλιμένη κορυφή**
 *   (ADR-449 wall→beam test 2026-06-14, Giorgio). Η γνήσια στήριξη δοκαριού→κολώνας
 *   ανιχνεύεται από το `findColumnsFramedByBeam` (framing → flat top), ΟΧΙ από εδώ.
 */
function hostCoversColumn(
  hostFootprint: readonly Pt2[],
  columnFootprint: readonly Pt2[],
  requireCentroid: boolean,
): boolean {
  if (hostFootprint.length < 3 || columnFootprint.length < 3) return false;
  const poly = [...hostFootprint];
  if (isPointInPolygon(footprintCentroid(columnFootprint), poly)) return true;
  if (requireCentroid) return false; // δοκάρι: corner-graze ΔΕΝ στηρίζει (framing το πιάνει)
  return columnFootprint.some((v) => isPointInPolygon({ x: v.x, y: v.y }, poly));
}

/**
 * ADR-401 Phase F.3 — όταν δημιουργείται structural host (δοκάρι/πλάκα), βρες τις
 * κολώνες που πρέπει να auto-attach-άρουν την ΚΟΡΥΦΗ τους από κάτω του. Pure
 * detection. Host που δεν είναι δοκάρι/πλάκα → κενό (O(1)).
 *
 * Κριτήρια: (1) `topBinding==='storey-ceiling'` (default — δεν πειράζουμε ήδη-
 * attached / unconnected / absolute), (2) plan overlap, (3) host underside πάνω
 * από τη βάση της κολώνας.
 */
export function findColumnsToAutoAttachToHost(host: Entity, entities: readonly Entity[]): string[] {
  const hostInput = hostInputOf(host);
  if (!hostInput) return [];

  const out: string[] = [];
  for (const e of entities) {
    if (!isColumnEntity(e)) continue;
    if (e.params.topBinding !== 'storey-ceiling') continue;
    const footprint = e.geometry?.footprint?.vertices;
    if (!footprint || footprint.length < 3) continue;
    if (!hostCoversColumn(hostInput.footprint, footprint, isBeamEntity(host))) continue;
    const baseZmm = resolveColumnBaseZmm(e.params, { floorElevationMm: ACTIVE_LEVEL_FLOOR_MM });
    // ADR-441 GEN-COL — top host πρέπει να είναι πάνω από τη ΣΤΑΘΜΗ ΙΣΟΓΕΙΟΥ (FFL), όχι
    // απλώς πάνω από τη βάση: μια κολώνα που κατεβαίνει στη θεμελίωση (base<FFL) ΔΕΝ
    // κρεμά την κορυφή της από εδαφόπλακα/δάπεδο (που είναι κάτω από το FFL, ΟΧΙ ταβάνι).
    // `max(base, FFL)` → και podium-safe (base>FFL → κρατά τη βάση).
    const topRefZmm = Math.max(baseZmm, ACTIVE_LEVEL_FLOOR_MM);
    if (hostInput.undersideZmm <= topRefZmm + AUTO_ATTACH_Z_GATE_MM) continue;
    out.push(e.id);
  }
  return out;
}

/**
 * ADR-401 Phase F.3 — mirror του παραπάνω για **base** auto-attach. Όταν
 * δημιουργείται δοκός/πλάκα-θεμέλιο, βρες τις κολώνες που πρέπει να «κατεβάσουν»
 * τη βάση τους πάνω της. Pure detection.
 *
 * Κριτήρια: (1) `baseBinding==='storey-floor'`, (2) plan overlap, (3) inverted Z
 * gate — η άνω-παρειά του host είναι ΚΑΤΩ από τη βάση της κολώνας (θεμέλιο).
 */
export function findColumnsToAutoAttachBaseToHost(host: Entity, entities: readonly Entity[]): string[] {
  const hostInput = hostInputOf(host);
  if (!hostInput || hostInput.topsideZmm === undefined) return [];

  const out: string[] = [];
  for (const e of entities) {
    if (!isColumnEntity(e)) continue;
    if (e.params.baseBinding !== 'storey-floor') continue;
    const footprint = e.geometry?.footprint?.vertices;
    if (!footprint || footprint.length < 3) continue;
    if (!hostCoversColumn(hostInput.footprint, footprint, isBeamEntity(host))) continue;
    const baseZmm = resolveColumnBaseZmm(e.params, { floorElevationMm: ACTIVE_LEVEL_FLOOR_MM });
    if (hostInput.topsideZmm >= baseZmm - AUTO_ATTACH_Z_GATE_MM) continue;
    out.push(e.id);
  }
  return out;
}

// ─── ADR-441/401 — framing-based column→beam attach (frame-into) ──────────────
// Διαφορά από `findColumnsToAutoAttachToHost`: ένα δοκάρι «από κάναβο» frame-into-άρει
// στην ΠΑΡΕΙΑ της κολώνας (`trimSegmentEndpointsToColumns`) → το footprint του δεν
// ΚΑΛΥΠΤΕΙ την κολώνα (`hostCoversColumn=false`) → το slab-style covering attach είναι
// αδρανές. Εδώ ανιχνεύουμε «framing»: το κέντρο της κολώνας κάθεται ΠΑΝΩ στον άξονα
// του δοκαριού (perp≈0), εντός του span + της support distance (το ίδιο κριτήριο με το
// frame-into trim). Τέτοιες κολώνες υποστηρίζουν το δοκάρι → top = beam-top (flat).

/** mm. Ανοχή collinearity/span-extent (grid κολώνες κάθονται ακριβώς στην τομή). */
const FRAMING_TOL_MM = 5;

/**
 * True αν το δοκάρι frame-into-άρει στην κολώνα: το κέντρο της κολώνας προβάλλεται
 * στον άξονα του δοκαριού με κάθετη απόσταση ≤ (μισό πλάτος δοκαριού) και διαμήκη
 * θέση εντός [−support, L+support] (η support distance είναι το ίδιο μισό-πλάτος
 * κολώνας που τραβά το frame-into trim → πιάνει τα trimmed άκρα).
 */
function beamFramesColumn(beam: BeamEntity, column: ColumnEntity): boolean {
  const s = beam.params.startPoint;
  const e = beam.params.endPoint;
  const dx = e.x - s.x;
  const dy = e.y - s.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return false;
  const ux = dx / len;
  const uy = dy / len;
  const perScene = mmToSceneUnits(beam.params.sceneUnits ?? 'mm');
  const halfWidth = (beam.params.width / 2) * perScene;
  const tol = FRAMING_TOL_MM * perScene;
  const rx = column.params.position.x - s.x;
  const ry = column.params.position.y - s.y;
  const t = rx * ux + ry * uy;
  const perp = Math.abs(rx * uy - ry * ux);
  if (perp > halfWidth + tol) return false;
  const support = columnSupportAlong(column, ux, uy);
  return t >= -support - tol && t <= len + support + tol;
}

/**
 * ADR-441/401 — όταν δημιουργείται δοκάρι, βρες τις κολώνες που το **υποστηρίζουν**
 * (frame-into) ώστε να attach-άρουν την κορυφή τους στο beam-top (associative).
 * Pure detection — ο καλών εκτελεί `AttachColumnsCommand('top', …)`.
 *
 * Κριτήρια: (1) `topBinding==='storey-ceiling'` (default — δεν πειράζουμε ήδη-
 * attached/absolute/unconnected), (2) frame-into (`beamFramesColumn`), (3) Z-gate:
 * beam-top πάνω από τη ΣΤΑΘΜΗ ΙΣΟΓΕΙΟΥ / βάση κολώνας (όχι δοκάρι κάτω από το πάτωμα).
 */
export function findColumnsFramedByBeam(host: Entity, entities: readonly Entity[]): string[] {
  if (!isBeamEntity(host)) return [];
  const beamTop = beamHostInput(host).topsideZmm;
  if (beamTop === undefined) return [];

  const out: string[] = [];
  for (const e of entities) {
    if (!isColumnEntity(e)) continue;
    if (e.params.topBinding !== 'storey-ceiling') continue;
    if (!beamFramesColumn(host, e)) continue;
    const baseZmm = resolveColumnBaseZmm(e.params, { floorElevationMm: ACTIVE_LEVEL_FLOOR_MM });
    if (beamTop <= Math.max(baseZmm, ACTIVE_LEVEL_FLOOR_MM) + AUTO_ATTACH_Z_GATE_MM) continue;
    out.push(e.id);
  }
  return out;
}

/**
 * Organism-graph variant — pure geometric framing check WITHOUT the `topBinding`
 * filter. Used ONLY by `buildStructuralGraph` to detect column-bearing edges.
 *
 * `findColumnsFramedByBeam` skips columns whose `topBinding !== 'storey-ceiling'`,
 * which is correct for auto-attach (avoids re-attaching already-attached columns)
 * but WRONG for connectivity: a column attached to this beam (`topBinding='beam'`)
 * IS structurally supported by it and must appear as a `column-bearing` edge.
 */
export function findColumnsFramedByBeamForGraph(beam: Entity, entities: readonly Entity[]): string[] {
  if (!isBeamEntity(beam)) return [];
  const out: string[] = [];
  for (const e of entities) {
    if (!isColumnEntity(e)) continue;
    if (!beamFramesColumn(beam, e)) continue;
    out.push(e.id);
  }
  return out;
}
