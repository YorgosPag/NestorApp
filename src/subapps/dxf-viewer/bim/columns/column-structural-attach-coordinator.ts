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
 * True αν το footprint του host καλύπτει την κολώνα: το κέντρο Ή τουλάχιστον μία
 * γωνία του footprint της κολώνας πέφτει μέσα στο host footprint (ίδιο point-in-
 * polygon που κάνει per-corner ο resolver → η ανίχνευση δεν «attach-άρει» όταν ο
 * resolver δεν θα άλλαζε τίποτα).
 */
function hostCoversColumn(hostFootprint: readonly Pt2[], columnFootprint: readonly Pt2[]): boolean {
  if (hostFootprint.length < 3 || columnFootprint.length < 3) return false;
  const poly = [...hostFootprint];
  if (isPointInPolygon(footprintCentroid(columnFootprint), poly)) return true;
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
    if (!hostCoversColumn(hostInput.footprint, footprint)) continue;
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
    if (!hostCoversColumn(hostInput.footprint, footprint)) continue;
    const baseZmm = resolveColumnBaseZmm(e.params, { floorElevationMm: ACTIVE_LEVEL_FLOOR_MM });
    if (hostInput.topsideZmm >= baseZmm - AUTO_ATTACH_Z_GATE_MM) continue;
    out.push(e.id);
  }
  return out;
}
