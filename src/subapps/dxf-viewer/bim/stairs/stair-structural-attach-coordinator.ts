/**
 * Stair ↔ Structural-Host Coordinator — ADR-401 Phase G.3 (auto-attach).
 *
 * Mirror του `column-structural-attach-coordinator` για **σκάλες**. Όταν
 * δημιουργείται structural host (δοκάρι / πλάκα), βρες τις σκάλες που πρέπει να
 * «κολλήσουν» αυτόματα την κορυφή (ή τη βάση) τους πάνω/κάτω του. Pure detection
 * (μηδέν mutation) — ο καλών εκτελεί `AttachStairsCommand`.
 *
 * Διαφορά από κολώνα/τοίχο: η σκάλα έχει **run-άξονα** (όχι σημειακό footprint ή
 * γραμμή). Plan-overlap = το footprint του host καλύπτει ≥1 από τα αντιπροσωπευτικά
 * plan-points (κέντρο + γωνίες πλάτους) στο πάνω άκρο (top-attach) ή στο κάτω άκρο
 * (base-attach) του run — τα ΙΔΙΑ samples (`stairPlanSamples`) που τρώει ο resolver
 * στο `BimSceneLayer.syncStairs`, ώστε η ανίχνευση να μην «attach-άρει» όταν ο
 * resolver δεν θα άλλαζε τίποτα.
 *
 * Z-gate (Revit "Attach Top/Base" parity, ίδιο με κολώνα/τοίχο):
 *   • top  → η κάτω-παρειά του host είναι ΠΑΝΩ από τη βάση της σκάλας (ταβάνι/δοκάρι).
 *   • base → η άνω-παρειά του host είναι ΚΑΤΩ από τη βάση της σκάλας (θεμέλιο/landing).
 *
 * Σύμβαση datum (G.2): η βάση της σκάλας είναι level-relative (`basePoint.z`, ΧΩΡΙΣ
 * ±floorElevationMm — αντίθετα με την κολώνα). Άρα ο Z gate τρέχει με `basePoint.z`.
 *
 * Triggers (mirror κολώνα): top → `topBinding==='storey-ceiling'` (η σκάλα default =
 * 'unconnected' → ΔΕΝ auto-attach-άρει αυθαίρετα την κορυφή· safe), base →
 * `baseBinding==='storey-floor'` (default → η βάση κάθεται στο νέο θεμέλιο/landing).
 *
 * @see bim/columns/column-structural-attach-coordinator.ts — ο δίδυμος της κολώνας
 * @see bim/geometry/stair-vertical-profile.ts — stairPlanSamples (κοινά samples)
 * @see docs/centralized-systems/reference/adrs/ADR-401-bim-wall-top-base-constraints-attach-to-structural.md §5 (Phase G)
 */

import type { Entity } from '../../types/entities';
import { isBeamEntity, isSlabEntity, isStairEntity } from '../../types/entities';
import { isPointInPolygon } from '../../utils/geometry/GeometryUtils';
import {
  beamHostInput,
  slabHostInput,
  type HostFootprintInput,
} from '../geometry/wall-host-plan-builder';
import { stairPlanSamples } from '../geometry/stair-vertical-profile';
import type { StairParams } from '../types/stair-types';
import type { EntityAttachSide } from '../entities/entity-attach-detach';

/**
 * mm. Ένας host μετράει ως «πάνω/κάτω» από τη βάση της σκάλας μόνο όταν απέχει
 * τουλάχιστον τόσο — έτσι μια πλάκα στο ίδιο επίπεδο με τη βάση δεν προσελκύεται.
 */
const AUTO_ATTACH_Z_GATE_MM = 1;

/** Host footprint-input από beam/slab, αλλιώς null (όχι structural). */
function hostInputOf(host: Entity): HostFootprintInput | null {
  if (isBeamEntity(host)) return beamHostInput(host);
  if (isSlabEntity(host)) return slabHostInput(host);
  return null;
}

/**
 * True αν το footprint του host καλύπτει τη σκάλα στη δοθείσα πλευρά: ≥1 plan-sample
 * (κέντρο ή γωνία πλάτους στο άκρο του run) πέφτει μέσα στο host footprint.
 */
function hostCoversStair(
  hostFootprint: readonly { x: number; y: number }[],
  params: StairParams,
  side: EntityAttachSide,
): boolean {
  if (hostFootprint.length < 3) return false;
  const poly = [...hostFootprint];
  return stairPlanSamples(params, side).some((s) => isPointInPolygon({ x: s.x, y: s.y }, poly));
}

/**
 * ADR-401 Phase G.3 — όταν δημιουργείται structural host (δοκάρι/πλάκα), βρες τις
 * σκάλες που πρέπει να auto-attach-άρουν την ΚΟΡΥΦΗ τους από κάτω του. Pure
 * detection. Host που δεν είναι δοκάρι/πλάκα → κενό (O(1)).
 *
 * Κριτήρια: (1) `topBinding==='storey-ceiling'`, (2) plan overlap στο top-edge,
 * (3) host underside πάνω από τη βάση της σκάλας.
 */
export function findStairsToAutoAttachToHost(host: Entity, entities: readonly Entity[]): string[] {
  const hostInput = hostInputOf(host);
  if (!hostInput) return [];

  const out: string[] = [];
  for (const e of entities) {
    if (!isStairEntity(e)) continue;
    if (e.params.topBinding !== 'storey-ceiling') continue;
    if (!hostCoversStair(hostInput.footprint, e.params, 'top')) continue;
    const baseZmm = e.params.basePoint.z;
    if (hostInput.undersideZmm <= baseZmm + AUTO_ATTACH_Z_GATE_MM) continue;
    out.push(e.id);
  }
  return out;
}

/**
 * ADR-401 Phase G.3 — mirror του παραπάνω για **base** auto-attach. Όταν
 * δημιουργείται δοκός/πλάκα-θεμέλιο/landing, βρες τις σκάλες που πρέπει να
 * «κατεβάσουν» τη βάση τους πάνω της. Pure detection.
 *
 * Κριτήρια: (1) `baseBinding==='storey-floor'`, (2) plan overlap στο base-edge,
 * (3) inverted Z gate — η άνω-παρειά του host είναι ΚΑΤΩ από τη βάση της σκάλας.
 */
export function findStairsToAutoAttachBaseToHost(host: Entity, entities: readonly Entity[]): string[] {
  const hostInput = hostInputOf(host);
  if (!hostInput || hostInput.topsideZmm === undefined) return [];

  const out: string[] = [];
  for (const e of entities) {
    if (!isStairEntity(e)) continue;
    // base default = 'storey-floor' (undefined → εξ ορισμού, ΗΔΗ-υπάρχουσες σκάλες).
    if (e.params.baseBinding !== undefined && e.params.baseBinding !== 'storey-floor') continue;
    if (!hostCoversStair(hostInput.footprint, e.params, 'base')) continue;
    const baseZmm = e.params.basePoint.z;
    if (hostInput.topsideZmm >= baseZmm - AUTO_ATTACH_Z_GATE_MM) continue;
    out.push(e.id);
  }
  return out;
}
