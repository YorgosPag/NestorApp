/**
 * Load-path takedown — entity-aware orchestration (ADR-466).
 *
 * Γενικεύει το footing tributary takedown (ADR-464) σε **ΟΛΗ τη διαδρομή φορτίων**:
 * κάθε δομικό μέλος (πλάκα/δοκάρι/κολώνα/πέδιλο) αποκτά `appliedLoad` (source=
 * 'takedown'). FEM-free «Revit tributary mode» — διατηρητικό, μηδέν regression στο
 * κατακόρυφο μονοπάτι του ADR-464:
 *
 *   · Κολώνα/Πέδιλο → tributary area × όροφοι × area-loads + ίδιο βάρος (= ADR-464).
 *     Footing = αντίδραση βάσης της εδραζόμενης κολώνας (ίδιο φορτίο).
 *   · Δοκάρι → tributary strip πλάκας (μ.ό. ευθύνης ακρο-κολονών, 1 όροφος) + ίδιο βάρος.
 *   · Πλάκα → εμβαδόν panel × area-loads (1 όροφος) — πληροφοριακό / slab design.
 *
 * Η κολώνα **ΔΕΝ** αθροίζει αντιδράσεις δοκαριών (Revit-mode, μηδέν double-count) —
 * κρατά tributary. Πραγματικό chained reaction tree = DEFER (FEM ADR). Pure: επιστρέφει
 * patches· η εφαρμογή/undo γίνεται στο `ComputeLoadPathCommand`.
 *
 * @see ./load-path-walk.ts — topological order + edge resolvers
 * @see ./member-load-geometry.ts — κέντρα/ίδιο βάρος SSoT
 * @see docs/centralized-systems/reference/adrs/ADR-466-load-path-engine.md
 */

import type { Entity } from '../../../types/entities';
import {
  isColumnEntity,
  isBeamEntity,
  isSlabEntity,
  isFoundationEntity,
} from '../../../types/entities';
import type { ColumnEntity } from '../../types/column-types';
import type { BeamEntity } from '../../types/beam-types';
import type { SlabEntity } from '../../types/slab-types';
import type { FoundationEntity } from '../../types/foundation-types';
import type { AppliedMemberLoad, MemberLoad } from './structural-loads-types';
import { isTakedownWritable } from './structural-loads-types';
import {
  computeGridTributaryAreas,
  computeMemberTakedown,
  toAppliedTakedownLoad,
  type TributaryColumn,
  type TakedownSettings,
} from './load-takedown';
import {
  columnCenterM,
  columnSelfWeightPerStoreyKn,
  beamSelfWeightKn,
} from './member-load-geometry';
import {
  topologicalLoadOrder,
  beamSupportColumnIds,
  footingColumnId,
} from './load-path-walk';
import type { StructuralGraph } from '../organism/structural-organism-types';

/** Μέλος της διαδρομής φορτίων που μπορεί να φέρει `appliedLoad`. */
export type LoadPathMember = ColumnEntity | BeamEntity | SlabEntity | FoundationEntity;

/** Προτεινόμενο φορτίο ενός μέλους (source='takedown') έτοιμο για persist. */
export interface MemberLoadPatch {
  readonly entityId: string;
  readonly appliedLoad: AppliedMemberLoad;
}

/** Type-guard: μέλος της διαδρομής φορτίων (κολώνα/δοκάρι/πλάκα/πέδιλο-pad). */
export function isLoadPathMember(e: Entity): e is LoadPathMember {
  if (isColumnEntity(e) || isBeamEntity(e) || isSlabEntity(e)) return true;
  return isFoundationEntity(e) && e.params.kind === 'pad';
}

/** Τρέχον `appliedLoad` ενός μέλους (για τον manual-vs-takedown guard). */
export function memberAppliedLoad(e: LoadPathMember): AppliedMemberLoad | undefined {
  if (isFoundationEntity(e)) return e.params.kind === 'pad' ? e.params.appliedLoad : undefined;
  return e.params.appliedLoad;
}

/** Patch μόνο όπου `isTakedownWritable` (ΠΟΤΕ overwrite χειροκίνητου). */
function writablePatch(e: LoadPathMember, load: MemberLoad): MemberLoadPatch | null {
  if (!isTakedownWritable(memberAppliedLoad(e))) return null;
  return { entityId: e.id, appliedLoad: toAppliedTakedownLoad(load) };
}

/** Tributary area (m²) ανά κολώνα — ΕΝΑ grid pass για όλη τη σκηνή. */
function buildColumnTributary(entities: readonly Entity[]): Map<string, number> {
  const centres = entities
    .filter(isColumnEntity)
    .map(columnCenterM)
    .filter((c): c is TributaryColumn => c !== null);
  return computeGridTributaryAreas(centres);
}

/** Φορτίο κολώνας/πεδίλου: tributary × όροφοι × area-loads + ίδιο βάρος (= ADR-464). */
function columnLoad(c: ColumnEntity, tributaryM2: number, s: TakedownSettings): MemberLoad {
  return computeMemberTakedown({
    tributaryAreaM2: tributaryM2,
    storeyCount: s.storeyCount,
    deadAreaLoadKpa: s.deadAreaLoadKpa,
    liveAreaLoadKpa: s.liveAreaLoadKpa,
    extraDeadAxialKn: columnSelfWeightPerStoreyKn(c) * Math.floor(s.storeyCount),
  });
}

/** Φορτίο δοκαριού: μ.ό. tributary ακρο-κολονών (1 όροφος) + ίδιο βάρος δοκαριού. */
function beamLoad(
  b: BeamEntity, graph: StructuralGraph, tributary: ReadonlyMap<string, number>, s: TakedownSettings,
): MemberLoad {
  const cols = beamSupportColumnIds(graph, b.id);
  const sum = cols.reduce((acc, id) => acc + (tributary.get(id) ?? 0), 0);
  const avg = cols.length > 0 ? sum / cols.length : 0;
  return computeMemberTakedown({
    tributaryAreaM2: avg,
    storeyCount: 1,
    deadAreaLoadKpa: s.deadAreaLoadKpa,
    liveAreaLoadKpa: s.liveAreaLoadKpa,
    extraDeadAxialKn: beamSelfWeightKn(b),
  });
}

/** Φορτίο πλάκας: εμβαδόν panel (m²) × area-loads (1 όροφος). */
function slabLoad(slab: SlabEntity, s: TakedownSettings): MemberLoad {
  const areaM2 = slab.geometry?.netArea ?? slab.geometry?.area ?? 0;
  return computeMemberTakedown({
    tributaryAreaM2: areaM2,
    storeyCount: 1,
    deadAreaLoadKpa: s.deadAreaLoadKpa,
    liveAreaLoadKpa: s.liveAreaLoadKpa,
  });
}

/**
 * Υπολόγισε τα προτεινόμενα φορτία takedown για ΟΛΑ τα εγγράψιμα μέλη της σκηνής
 * κατά τη διαδρομή φορτίων. ΕΝΑ tributary pass· διάσχιση beams→columns→footings (το
 * πέδιλο παίρνει το ήδη-υπολογισμένο φορτίο της κολώνας του)· πλάκες ως ανεξάρτητες
 * πηγές (εκτός graph, ADR-459). Κενό όταν λείπουν area loads/όροφοι.
 */
export function computeLoadPathPatches(
  entities: readonly Entity[],
  graph: StructuralGraph,
  settings: TakedownSettings,
): MemberLoadPatch[] {
  const { storeyCount, deadAreaLoadKpa, liveAreaLoadKpa } = settings;
  if (storeyCount <= 0 || (deadAreaLoadKpa <= 0 && liveAreaLoadKpa <= 0)) return [];

  const byId = new Map(entities.map((e) => [e.id, e]));
  const tributary = buildColumnTributary(entities);
  const columnLoadById = new Map<string, MemberLoad>();
  const patches: MemberLoadPatch[] = [];

  for (const node of topologicalLoadOrder(graph)) {
    const entity = byId.get(node.id);
    if (node.memberKind === 'column' && entity && isColumnEntity(entity)) {
      const load = columnLoad(entity, tributary.get(node.id) ?? 0, settings);
      columnLoadById.set(node.id, load);
      pushPatch(patches, writablePatch(entity, load));
    } else if (node.memberKind === 'beam' && entity && isBeamEntity(entity)) {
      pushPatch(patches, writablePatch(entity, beamLoad(entity, graph, tributary, settings)));
    } else if (
      node.memberKind === 'footing' && entity &&
      isFoundationEntity(entity) && entity.params.kind === 'pad'
    ) {
      // Pad footing = αντίδραση βάσης της εδραζόμενης κολώνας. Τα rafts (foundation-
      // slabs) παίρνουν area-load στο slab loop παρακάτω (ΟΧΙ διπλό patch).
      const colId = footingColumnId(graph, node.id);
      const load = colId ? columnLoadById.get(colId) : undefined;
      if (load) pushPatch(patches, writablePatch(entity, load));
    }
  }

  for (const slab of entities.filter(isSlabEntity)) {
    pushPatch(patches, writablePatch(slab, slabLoad(slab, settings)));
  }
  return patches;
}

function pushPatch(out: MemberLoadPatch[], patch: MemberLoadPatch | null): void {
  if (patch) out.push(patch);
}
