/**
 * Wall ↔ Structural-Host Coordinator — ADR-401 Phase C (attach-to-structural).
 *
 * Walls can "attach" their top to a structural host (beam / slab) via
 * `WallParams.attachTopToIds` (Revit "Attach Top"). The wall's vertical extent
 * is a PURE derivation of the live scene: `BimSceneLayer.syncWalls` (3D),
 * `section-intersect` (2D section) and `wall-boq-feed` (BOQ) each rebuild the
 * `WallTopProfile` from the CURRENT beams/slabs on every resync — so a host
 * *move / rotate / resize* already flows to the wall with zero extra wiring
 * (`use-bim3d-sync` re-runs on any entity change). That associative behaviour
 * needs no persisted cascade.
 *
 * The ONE gap is host *deletion*: when a host that a wall attaches to is
 * removed, `resolveWallTopProfile` reports it via `missingHostIds` and falls
 * back to the baseline top — correct, but SILENT. This module closes that gap:
 * it detects the affected walls and emits a single decoupled event so the UI
 * can warn the user (Revit "Wall's Top Constraint is no longer valid").
 *
 * Deliberately NO mutation of `attachTopToIds`: the dangling ref is harmless
 * (the resolver neutralises missing hosts every recompute) and keeping it lets
 * an *undo* of the delete re-attach the wall automatically — removing it would
 * break that round-trip for zero functional gain.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-401-bim-wall-top-base-constraints-attach-to-structural.md
 * @see bim/cascade/bim-cascade-resolver.ts — `findAttachedWalls` (reverse lookup)
 * @see bim/geometry/wall-top-profile.ts — `missingHostIds` (graceful fallback)
 */

import type { ISceneManager, SceneEntity } from '../../core/commands/interfaces';
import type { Entity } from '../../types/entities';
import { isBeamEntity, isSlabEntity, isWallEntity, isRoofEntity } from '../../types/entities';
import { findAttachedWalls } from '../cascade/bim-cascade-resolver';
import { EventBus } from '../../systems/events/EventBus';
import {
  beamHostInput,
  slabHostInput,
  roofHostInput,
  buildHostUndersidePlans,
  buildHostTopsidePlans,
  type HostFootprintInput,
} from '../geometry/wall-host-plan-builder';
import { resolveWallBaseZmm } from '../geometry/wall-top-profile';

/**
 * Minimal scene-manager surface the coordinator needs. `getEntities` is
 * optional (real adapters implement it; lightweight test mocks may omit it →
 * the helper no-ops safely).
 */
type CoordinatorSceneManager = Pick<ISceneManager, 'getEntity'> & {
  getEntities?(): readonly SceneEntity[];
};

/**
 * After one or more structural hosts have been deleted, find every `attached`
 * wall that referenced any of them and emit a single
 * `bim:wall-attach-host-missing` event (no-op when none are affected). Pure
 * detection + signal — does not mutate the scene. Returns the affected wall
 * ids (for callers / tests).
 *
 * Call this AFTER the host removal has landed: the affected walls remain in the
 * scene (only their host is gone), so the reverse lookup still resolves them.
 */
export function notifyWallsOnHostDeletion(
  deletedHostIds: readonly string[],
  sceneManager: CoordinatorSceneManager,
): string[] {
  if (deletedHostIds.length === 0) return [];
  const all = sceneManager.getEntities?.();
  if (!all) return [];

  const wallIds = findAttachedWalls(
    new Set(deletedHostIds),
    all as unknown as readonly Entity[],
  );
  if (wallIds.length > 0) {
    EventBus.emit('bim:wall-attach-host-missing', {
      wallIds,
      deletedHostIds: [...deletedHostIds],
    });
  }
  return wallIds;
}

// ─── ADR-401 Phase D — auto-attach detection (host → walls below) ─────────────

/**
 * mm. Ένας host μετράει ως «πάνω» από τον τοίχο μόνο αν η κάτω-παρειά του είναι
 * τουλάχιστον τόσο πάνω από τη βάση του τοίχου — έτσι μια πλάκα-ΠΑΤΩΜΑ (κάτω-
 * παρειά κάτω από τη βάση) ΔΕΝ προσελκύει την κορυφή προς τα κάτω.
 */
const AUTO_ATTACH_Z_GATE_MM = 1;

/**
 * Active level scene σύμβαση: όλα τα entity elevations είναι level-relative με
 * datum 0 (ίδιο με `wall-boq-feed` / `envelope-boq-sync`). Άρα ο Z gate τρέχει
 * με `floorElevationMm: 0`.
 */
const ACTIVE_LEVEL_FLOOR_MM = 0;

/**
 * ADR-401 Phase D — όταν δημιουργείται structural host (δοκάρι/πλάκα), βρες τους
 * τοίχους που πρέπει να «κολλήσουν» αυτόματα την κορυφή τους από κάτω του. Pure
 * detection (μηδέν mutation) — ο καλών εκτελεί `AttachWallsTopCommand`.
 *
 * Κριτήρια (Revit "Attach Top" parity, Z-gated — επιλογή Giorgio 2026-05-31):
 *   1. Μόνο τοίχοι με `topBinding='storey-ceiling'` (το default) — δεν πειράζουμε
 *      ήδη-attached / unconnected / absolute (ρητή πρόθεση χρήστη).
 *   2. **Κάτοψη**: ο host περνά πάνω από τον άξονα του τοίχου (≥1 covered span,
 *      μέσω `buildHostUndersidePlans` — ο ΙΔΙΟΣ projector με τον resolver).
 *   3. **Ύψος (Z gate)**: η κάτω-παρειά του host είναι πάνω από τη βάση του τοίχου
 *      (οροφή/δοκάρι, ΟΧΙ η πλάκα-πάτωμα από κάτω → §παράδειγμα δωματίου).
 *
 * Host που δεν είναι δοκάρι/πλάκα → κενό (early return, O(1)).
 */
/**
 * Entity → top-attach `HostFootprintInput` (κάτω-παρειά: δοκάρι/πλάκα/στέγη), αλλιώς
 * `null`. ΕΝΑΣ τόπος αναγνώρισης host-type — καταναλώνεται και από τη φορά
 * host→walls (`findWallsToAutoAttachToHost`) και από την αντίστροφη wall→hosts
 * (`findHostsToAttachWallTop`) ώστε τα δύο paths να μένουν συμμετρικά (N.0.2).
 */
function topHostInputFor(entity: Entity): HostFootprintInput | null {
  if (isBeamEntity(entity)) return beamHostInput(entity);
  if (isSlabEntity(entity)) return slabHostInput(entity);
  if (isRoofEntity(entity)) return roofHostInput(entity);
  return null;
}

/**
 * Entity → base-attach `HostFootprintInput` (άνω-παρειά: θεμέλιο δοκάρι/πλάκα),
 * αλλιώς `null`. Στέγη ΔΕΝ φιλοξενεί βάση (mirror του base-φιλτραρίσματος του
 * `findWallsToAutoAttachBaseToHost`).
 */
function baseHostInputFor(entity: Entity): HostFootprintInput | null {
  if (isBeamEntity(entity)) return beamHostInput(entity);
  // ADR-441 GEN-SLAB — η εδαφόπλακα-θεμελίωσης (kind='foundation') ΔΕΝ είναι auto
  // base-host: κάθεται στη στάθμη θεμελίωσης, οι τοίχοι ισογείου δεν «κατεβαίνουν»
  // αυτόματα πάνω της (explicit/manual attach μόνο). Mirror του hook host-skip.
  if (isSlabEntity(entity) && entity.kind !== 'foundation') return slabHostInput(entity);
  return null;
}

export function findWallsToAutoAttachToHost(
  host: Entity,
  entities: readonly Entity[],
): string[] {
  const hostInput = topHostInputFor(host);
  if (!hostInput) return [];

  const out: string[] = [];
  for (const e of entities) {
    if (!isWallEntity(e)) continue;
    if (e.params.topBinding !== 'storey-ceiling') continue;
    const start = { x: e.params.start.x, y: e.params.start.y };
    const end = { x: e.params.end.x, y: e.params.end.y };
    // (2) plan overlap — ο host πρέπει να καλύπτει τμήμα του άξονα.
    if (buildHostUndersidePlans(start, end, [hostInput]).length === 0) continue;
    // (3) Z gate — host πάνω από τη ΣΤΑΘΜΗ ΙΣΟΓΕΙΟΥ (FFL), όχι απλώς πάνω από τη βάση:
    // εδαφόπλακα/δάπεδο (κάτω από FFL) δεν είναι ταβάνι. max(base, FFL) → podium-safe.
    const baseZmm = resolveWallBaseZmm(e.params, { floorElevationMm: ACTIVE_LEVEL_FLOOR_MM });
    if (hostInput.undersideZmm <= Math.max(baseZmm, ACTIVE_LEVEL_FLOOR_MM) + AUTO_ATTACH_Z_GATE_MM) continue;
    out.push(e.id);
  }
  return out;
}

/**
 * ADR-401 (γ) — mirror του `findWallsToAutoAttachToHost` για **base** auto-attach.
 * Όταν δημιουργείται δοκός/πλάκα-θεμέλιο, βρες τους τοίχους που πρέπει να
 * «κατεβάσουν» τη βάση τους πάνω της. Pure detection — ο καλών εκτελεί
 * `AttachWallsBaseCommand`.
 *
 * Κριτήρια (συντηρητικό auto, ΟΧΙ το πλήρες bidirectional manual attach):
 *   1. Μόνο τοίχοι με `baseBinding='storey-floor'` (default — δεν πειράζουμε
 *      ήδη-attached / absolute).
 *   2. **Κάτοψη**: ο host περνά κάτω από τον άξονα του τοίχου (plan overlap).
 *   3. **Ύψος (Z gate)**: η ΑΝΩ-παρειά του host είναι **κάτω** από τη βάση του
 *      τοίχου (θεμέλιο/πεδιλοδοκός από κάτω → η βάση κατεβαίνει να πατήσει).
 *      Αντίστροφο gate από το top (όπου ο host είναι ΠΑΝΩ από τη βάση).
 */
export function findWallsToAutoAttachBaseToHost(
  host: Entity,
  entities: readonly Entity[],
): string[] {
  const hostInput = baseHostInputFor(host);
  if (!hostInput || hostInput.topsideZmm === undefined) return [];

  const out: string[] = [];
  for (const e of entities) {
    if (!isWallEntity(e)) continue;
    if (e.params.baseBinding !== 'storey-floor') continue;
    const start = { x: e.params.start.x, y: e.params.start.y };
    const end = { x: e.params.end.x, y: e.params.end.y };
    // (2) plan overlap.
    if (buildHostTopsidePlans(start, end, [hostInput]).length === 0) continue;
    // (3) inverted Z gate — host ΚΑΤΩ από τη βάση (θεμέλιο, όχι ταβάνι/ίδιο πάτωμα).
    const baseZmm = resolveWallBaseZmm(e.params, { floorElevationMm: ACTIVE_LEVEL_FLOOR_MM });
    if (hostInput.topsideZmm >= baseZmm - AUTO_ATTACH_Z_GATE_MM) continue;
    out.push(e.id);
  }
  return out;
}

// ─── ADR-401 Phase D (αντίστροφη φορά) — auto-attach detection (wall → hosts) ──

/**
 * ADR-401 Phase D (reverse) — όταν δημιουργείται **ΤΟΙΧΟΣ** (manual draw Ή «Τοίχοι
 * από κάναβο»), βρες τους structural hosts (δοκάρι/πλάκα/στέγη) που τρέχουν ΠΑΝΩ
 * του ώστε η κορυφή του να «κολλήσει» στην κάτω-παρειά τους (το δοκάρι «κουρώνει»
 * τον τοίχο). Καθρέφτης/inverse του `findWallsToAutoAttachToHost`: ΙΔΙΑ κάτοψη
 * (`buildHostUndersidePlans`) + ΙΔΙΟΣ Z-gate — μηδέν duplication των κριτηρίων.
 *
 * Λύνει την ασυμμετρία: το host-created path έτρεχε auto-attach μόνο όταν
 * δημιουργείται ο host· εδώ καλύπτεται και η σειρά host-πρώτα → τοίχος-μετά.
 *
 * Pure detection (μηδέν mutation) — ο καλών εκτελεί ένα `AttachWallsTopCommand`
 * ανά hostId (το command κάνει union στο `attachTopToIds` → σκαλωτή κορυφή).
 *
 * Επιστρέφει `[]` αν το entity δεν είναι τοίχος ή ο τοίχος δεν είναι
 * `topBinding='storey-ceiling'` (idempotent: ήδη-attached → skip).
 */
export function findHostsToAttachWallTop(
  wall: Entity,
  entities: readonly Entity[],
): string[] {
  if (!isWallEntity(wall)) return [];
  if (wall.params.topBinding !== 'storey-ceiling') return [];
  const start = { x: wall.params.start.x, y: wall.params.start.y };
  const end = { x: wall.params.end.x, y: wall.params.end.y };
  const baseZmm = resolveWallBaseZmm(wall.params, { floorElevationMm: ACTIVE_LEVEL_FLOOR_MM });

  const out: string[] = [];
  for (const e of entities) {
    const hostInput = topHostInputFor(e);
    if (!hostInput) continue;
    // (2) plan overlap — ο host περνά πάνω από τον άξονα του τοίχου.
    if (buildHostUndersidePlans(start, end, [hostInput]).length === 0) continue;
    // (3) Z gate — κάτω-παρειά host πάνω από τη ΣΤΑΘΜΗ ΙΣΟΓΕΙΟΥ (max(base, FFL), βλ. forward).
    if (hostInput.undersideZmm <= Math.max(baseZmm, ACTIVE_LEVEL_FLOOR_MM) + AUTO_ATTACH_Z_GATE_MM) continue;
    out.push(hostInput.hostId);
  }
  return out;
}

/**
 * ADR-401 (γ) (reverse) — mirror του `findHostsToAttachWallTop` για **base**: όταν
 * δημιουργείται τοίχος πάνω από θεμέλιο δοκάρι/πλάκα, βρες τους hosts στους
 * οποίους πρέπει να κατέβει η βάση του. ΙΔΙΑ κάτοψη (`buildHostTopsidePlans`) +
 * ΙΔΙΟΣ inverted Z-gate με το `findWallsToAutoAttachBaseToHost`.
 */
export function findHostsToAttachWallBase(
  wall: Entity,
  entities: readonly Entity[],
): string[] {
  if (!isWallEntity(wall)) return [];
  if (wall.params.baseBinding !== 'storey-floor') return [];
  const start = { x: wall.params.start.x, y: wall.params.start.y };
  const end = { x: wall.params.end.x, y: wall.params.end.y };
  const baseZmm = resolveWallBaseZmm(wall.params, { floorElevationMm: ACTIVE_LEVEL_FLOOR_MM });

  const out: string[] = [];
  for (const e of entities) {
    const hostInput = baseHostInputFor(e);
    if (!hostInput || hostInput.topsideZmm === undefined) continue;
    // (2) plan overlap.
    if (buildHostTopsidePlans(start, end, [hostInput]).length === 0) continue;
    // (3) inverted Z gate — άνω-παρειά host κάτω από τη βάση του τοίχου (θεμέλιο).
    if (hostInput.topsideZmm >= baseZmm - AUTO_ATTACH_Z_GATE_MM) continue;
    out.push(hostInput.hostId);
  }
  return out;
}
