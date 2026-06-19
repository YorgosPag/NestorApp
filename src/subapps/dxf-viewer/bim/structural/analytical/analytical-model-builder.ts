/**
 * Analytical Model builder — pure SSoT (ADR-480, T2).
 *
 * `buildAnalyticalModel({ entities, graph, getOffset? })` → DERIVED `AnalyticalModel`
 * από τον στατικό οργανισμό (ADR-459 `StructuralGraph`). Revit physical→analytical:
 *
 *   · Κόμβοι: κάθε κολόνα → βάση+κορυφή (κέντρο μέσω `columnCenterM`, grid-anchored
 *     όταν δοθεί `getOffset`)· κάθε δοκάρι → 2 άκρα (`beamEndpointsM`). Z από τον graph
 *     (baseZmm/topZmm — ήδη απόλυτα αν ο graph χτίστηκε cross-level).
 *   · Μέλη: κατακόρυφο (κολόνα) / οριζόντιο (δοκάρι), `id` = entityId (1:1 physical).
 *   · Merge: `column-bearing` ακμή → το πλησιέστερο άκρο δοκαριού «κουμπώνει» στην
 *     κορυφή της κολόνας (priority-aware union)· επιπλέον spatial merge εντός ανοχής.
 *   · Στηρίξεις: `footing-bearing` ακμή → πάκτωση στη βάση της κολόνας (FK πεδίλου).
 *   · Διάφραγμα: οι κόμβοι-δοκαριών κάθε στάθμης → ένα `RigidDiaphragm`.
 *
 * Pure — zero React/DOM/Firestore. Δεν μεταλλάσσει entities/graph· δεν επιλύει
 * (solver = T3). Μονάδες: μέτρα (m).
 *
 * @see ./analytical-model-types.ts
 * @see ./analytical-node-merge.ts — union-find + level clustering
 * @see ../organism/structural-graph.ts — η πηγή connectivity
 * @see docs/centralized-systems/reference/adrs/ADR-480-analytical-model-ssot.md
 */

import type { Entity } from '../../../types/entities';
import { isColumnEntity, isBeamEntity } from '../../../types/entities';
import type { ColumnEntity } from '../../types/column-types';
import type { BeamEntity } from '../../types/beam-types';
import type { GuideOffsetLookup } from '../../hosting/derive-slots';
import { columnCenterM, beamEndpointsM } from '../loads/member-load-geometry';
import type { StructuralGraph, StructuralNode } from '../organism/structural-organism-types';
import { beamInteriorSupports, type BeamInteriorSupport } from './beam-interior-supports';
import {
  NodeUnionFind,
  mergeByProximity,
  clusterElevations,
  type RawNode,
  type ElevationClustering,
} from './analytical-node-merge';
import {
  FIXED_DOF,
  FREE_DOF,
  EMPTY_ANALYTICAL_MODEL,
  type AnalyticalModel,
  type AnalyticalNode,
  type AnalyticalMember,
  type AnalyticalMemberType,
  type AnalyticalSupport,
  type AnalyticalPoint3D,
  type RigidDiaphragm,
  type AnalyticalLevel,
} from './analytical-model-types';

const MM_TO_M = 1 / 1000;
/** Προτεραιότητες merge: η κορυφή/βάση κολόνας «νικά» το άκρο δοκαριού. */
const COLUMN_PRIORITY = 2;
const BEAM_PRIORITY = 1;

/** Είσοδος του builder. */
export interface BuildAnalyticalModelInput {
  readonly entities: readonly Entity[];
  readonly graph: StructuralGraph;
  /** Guide-store axis lookup → grid-anchored κόμβοι κολόνας (αλλιώς κεντροειδές). */
  readonly getOffset?: GuideOffsetLookup;
}

/**
 * Ακατέργαστο μέλος (raw άκρα) πριν την επίλυση τελικών κόμβων. `memberId` = μοναδικό
 * αναλυτικό id (1:1 με στοιχείο solver/διαγράμματος)· `entityId` = το physical entity
 * (πολλά υπο-μέλη συνεχούς δοκού μοιράζονται το ίδιο `entityId`, ADR-504 Φ2 S5).
 */
interface RawMember {
  readonly entityId: string;
  readonly memberId: string;
  readonly memberType: AnalyticalMemberType;
  readonly iRaw: string;
  readonly jRaw: string;
}

/** Συσσωρευτής raw κόμβων/μελών + βοηθητικά indexes για merge/supports. */
interface RawAccumulator {
  readonly raws: RawNode[];
  readonly members: RawMember[];
  readonly columnTopRaw: Map<string, string>;
  readonly columnBaseRaw: Map<string, string>;
  readonly beamEnds: Map<string, RawNode[]>;
  readonly rawById: Map<string, RawNode>;
  /** `${beamId}|${columnId}` → raw id ενδιάμεσου κόμβου (ADR-504 S5 — interior-support merge). */
  readonly beamInteriorRaw: Map<string, string>;
}

function emptyAccumulator(): RawAccumulator {
  return {
    raws: [], members: [],
    columnTopRaw: new Map(), columnBaseRaw: new Map(),
    beamEnds: new Map(), rawById: new Map(),
    beamInteriorRaw: new Map(),
  };
}

function pushRaw(acc: RawAccumulator, raw: RawNode): void {
  acc.raws.push(raw);
  acc.rawById.set(raw.id, raw);
}

/** Κόμβοι/μέλος κολόνας: βάση (baseZ) + κορυφή (topZ) στο plan-κέντρο. */
function appendColumn(
  acc: RawAccumulator, node: StructuralNode, c: ColumnEntity, getOffset?: GuideOffsetLookup,
): void {
  const centre = columnCenterM(c, getOffset);
  if (!centre) return;
  const baseId = `${node.id}:base`;
  const topId = `${node.id}:top`;
  pushRaw(acc, { id: baseId, priority: COLUMN_PRIORITY, position: { xM: centre.xM, yM: centre.yM, zM: node.baseZmm * MM_TO_M } });
  pushRaw(acc, { id: topId, priority: COLUMN_PRIORITY, position: { xM: centre.xM, yM: centre.yM, zM: node.topZmm * MM_TO_M } });
  acc.columnBaseRaw.set(node.id, baseId);
  acc.columnTopRaw.set(node.id, topId);
  acc.members.push({ entityId: node.id, memberId: node.id, memberType: 'column', iRaw: baseId, jRaw: topId });
}

/**
 * Κόμβοι/μέλος δοκαριού στο υψόμετρο της άνω παρειάς (framing datum). Όταν ο δοκός έχει
 * **εσωτερικές** στηρίξεις (ADR-504 Φ2 S5 — συνεχής δοκός), εισάγονται ενδιάμεσοι κόμβοι
 * στα κλάσματά τους και το member σπάει σε υπο-μέλη `i→s1→…→j` (κοινό `entityId`, μοναδικά
 * `memberId`) → ο solver βγάζει sagging+hogging envelope. Χωρίς εσωτερικές → ΕΝΑ member.
 */
function appendBeam(
  acc: RawAccumulator, node: StructuralNode, b: BeamEntity, interior: readonly BeamInteriorSupport[],
): void {
  const ends = beamEndpointsM(b);
  const zM = node.topZmm * MM_TO_M;
  const at = (t: number): { xM: number; yM: number; zM: number } => ({
    xM: ends.start.xM + (ends.end.xM - ends.start.xM) * t,
    yM: ends.start.yM + (ends.end.yM - ends.start.yM) * t,
    zM,
  });
  const iRaw: RawNode = { id: `${node.id}:i`, priority: BEAM_PRIORITY, position: at(0) };
  const jRaw: RawNode = { id: `${node.id}:j`, priority: BEAM_PRIORITY, position: at(1) };
  pushRaw(acc, iRaw);
  pushRaw(acc, jRaw);
  acc.beamEnds.set(node.id, [iRaw, jRaw]);

  const seq: RawNode[] = [iRaw];
  interior.forEach((sup, k) => {
    const raw: RawNode = { id: `${node.id}:s${k}`, priority: BEAM_PRIORITY, position: at(sup.t) };
    pushRaw(acc, raw);
    acc.beamInteriorRaw.set(`${node.id}|${sup.columnId}`, raw.id);
    seq.push(raw);
  });
  seq.push(jRaw);
  for (let k = 0; k < seq.length - 1; k++) {
    const memberId = seq.length === 2 ? node.id : `${node.id}#${k}`;
    acc.members.push({ entityId: node.id, memberId, memberType: 'beam', iRaw: seq[k].id, jRaw: seq[k + 1].id });
  }
}

/** Συγκέντρωσε raw κόμβους/μέλη από τα graph nodes (κολόνες + δοκάρια). */
function collectRaws(input: BuildAnalyticalModelInput): RawAccumulator {
  const acc = emptyAccumulator();
  const byId = new Map(input.entities.map((e) => [e.id, e]));
  for (const node of input.graph.nodes) {
    const entity = byId.get(node.id);
    if (node.memberKind === 'column' && entity && isColumnEntity(entity)) appendColumn(acc, node, entity, input.getOffset);
    else if (node.memberKind === 'beam' && entity && isBeamEntity(entity)) {
      appendBeam(acc, node, entity, beamInteriorSupports(entity, input.graph, input.entities));
    }
  }
  return acc;
}

/** Απόσταση plan (m) μεταξύ δύο σημείων (για το nearest-endpoint matching). */
function planDist(a: AnalyticalPoint3D, b: AnalyticalPoint3D): number {
  return Math.hypot(a.xM - b.xM, a.yM - b.yM);
}

/**
 * Connectivity merge: για κάθε `column-bearing` ακμή, ένωσε την κορυφή της στηρίζουσας
 * κολόνας με τον κόμβο του δοκαριού. **Εσωτερική** στήριξη (ADR-504 Φ2 S5) → ο ειδικός
 * ενδιάμεσος κόμβος της (από το subdivision)· αλλιώς → το πλησιέστερο (στο plan) άκρο.
 */
function mergeFramingEdges(acc: RawAccumulator, graph: StructuralGraph, uf: NodeUnionFind): void {
  for (const edge of graph.edges) {
    if (edge.kind !== 'column-bearing') continue;
    const topId = acc.columnTopRaw.get(edge.supportId);
    if (!topId) continue;
    const interiorId = acc.beamInteriorRaw.get(`${edge.supportedId}|${edge.supportId}`);
    if (interiorId) {
      uf.union(interiorId, topId);
      continue;
    }
    const ends = acc.beamEnds.get(edge.supportedId);
    if (!ends || ends.length === 0) continue;
    const top = acc.rawById.get(topId);
    if (!top) continue;
    const nearest = ends.reduce((best, e) =>
      planDist(e.position, top.position) < planDist(best.position, top.position) ? e : best);
    uf.union(nearest.id, topId);
  }
}

/** Επιλυμένοι τελικοί κόμβοι: root→nodeId, nodeId→θέση, raw→root. */
interface ResolvedNodes {
  readonly nodeIdByRoot: Map<string, string>;
  readonly positionByNode: Map<string, AnalyticalPoint3D>;
  readonly rootByRaw: Map<string, string>;
}

/** Επίλυσε τα union sets σε τελικούς κόμβους (ντετερμινιστικά `an-<n>`). */
function resolveNodes(acc: RawAccumulator, uf: NodeUnionFind): ResolvedNodes {
  const rootByRaw = new Map<string, string>();
  for (const raw of acc.raws) rootByRaw.set(raw.id, uf.find(raw.id));
  const roots = [...new Set(rootByRaw.values())].sort();
  const nodeIdByRoot = new Map<string, string>();
  const positionByNode = new Map<string, AnalyticalPoint3D>();
  roots.forEach((root, i) => {
    const nodeId = `an-${i}`;
    nodeIdByRoot.set(root, nodeId);
    positionByNode.set(nodeId, (acc.rawById.get(root) as RawNode).position);
  });
  return { nodeIdByRoot, positionByNode, rootByRaw };
}

/** nodeId ενός raw μέσω των resolved maps. */
function nodeOf(resolved: ResolvedNodes, rawId: string): string {
  return resolved.nodeIdByRoot.get(resolved.rootByRaw.get(rawId) as string) as string;
}

/** Στηρίξεις (πάκτωση) από τις `footing-bearing` ακμές + set δεσμευμένων κόμβων. */
function buildSupports(
  acc: RawAccumulator, graph: StructuralGraph, resolved: ResolvedNodes,
): { supports: AnalyticalSupport[]; restrained: Set<string> } {
  const supports: AnalyticalSupport[] = [];
  const restrained = new Set<string>();
  for (const edge of graph.edges) {
    if (edge.kind !== 'footing-bearing') continue;
    const baseRaw = acc.columnBaseRaw.get(edge.supportedId);
    if (!baseRaw) continue;
    const nodeId = nodeOf(resolved, baseRaw);
    if (restrained.has(nodeId)) continue;
    restrained.add(nodeId);
    supports.push({ nodeId, supportType: 'fixed', entityId: edge.supportId });
  }
  return { supports, restrained };
}

/** Τελικοί κόμβοι (θέση + restraint + στάθμη). */
function buildNodes(
  resolved: ResolvedNodes, restrained: Set<string>, clustering: ElevationClustering,
): AnalyticalNode[] {
  const nodes: AnalyticalNode[] = [];
  for (const [id, position] of resolved.positionByNode) {
    nodes.push({
      id, position,
      restraint: restrained.has(id) ? FIXED_DOF : FREE_DOF,
      levelId: `lvl-${clustering.indexOf(position.zM)}`,
    });
  }
  return nodes;
}

/** Τελικά μέλη (i/j τελικοί κόμβοι + αναλυτικό μήκος από τις θέσεις τους). */
function buildMembers(acc: RawAccumulator, resolved: ResolvedNodes): AnalyticalMember[] {
  return acc.members.map((m) => {
    const iNodeId = nodeOf(resolved, m.iRaw);
    const jNodeId = nodeOf(resolved, m.jRaw);
    const pi = resolved.positionByNode.get(iNodeId) as AnalyticalPoint3D;
    const pj = resolved.positionByNode.get(jNodeId) as AnalyticalPoint3D;
    const lengthM = Math.hypot(pi.xM - pj.xM, pi.yM - pj.yM, pi.zM - pj.zM);
    return { id: m.memberId, entityId: m.entityId, memberType: m.memberType, iNodeId, jNodeId, lengthM };
  });
}

/** Άκαμπτα διαφράγματα: οι κόμβοι-δοκαριών κάθε στάθμης (≥2) → ένα διάφραγμα. */
function buildDiaphragms(
  members: readonly AnalyticalMember[], nodes: readonly AnalyticalNode[],
  levels: readonly AnalyticalLevel[],
): RigidDiaphragm[] {
  const levelByNode = new Map(nodes.map((n) => [n.id, n.levelId]));
  const beamNodesByLevel = new Map<string, Set<string>>();
  for (const m of members) {
    if (m.memberType !== 'beam') continue;
    for (const nodeId of [m.iNodeId, m.jNodeId]) {
      const levelId = levelByNode.get(nodeId);
      if (!levelId) continue;
      const set = beamNodesByLevel.get(levelId) ?? new Set<string>();
      set.add(nodeId);
      beamNodesByLevel.set(levelId, set);
    }
  }
  const diaphragms: RigidDiaphragm[] = [];
  for (const level of levels) {
    const nodeIds = [...(beamNodesByLevel.get(level.id) ?? [])].sort();
    if (nodeIds.length < 2) continue;
    diaphragms.push({ levelId: level.id, nodeIds, masterNodeId: nodeIds[0] });
  }
  return diaphragms;
}

/**
 * Build the DERIVED analytical model. Κενό όταν δεν υπάρχουν φέροντα μέλη
 * (κολόνες/δοκάρια) — advisory, μηδέν side-effects.
 */
export function buildAnalyticalModel(input: BuildAnalyticalModelInput): AnalyticalModel {
  const acc = collectRaws(input);
  if (acc.raws.length === 0) return EMPTY_ANALYTICAL_MODEL;

  const uf = new NodeUnionFind();
  for (const raw of acc.raws) uf.add(raw.id, raw.priority);
  mergeFramingEdges(acc, input.graph, uf);
  mergeByProximity(acc.raws, uf);

  const resolved = resolveNodes(acc, uf);
  const clustering = clusterElevations([...resolved.positionByNode.values()].map((p) => p.zM));
  const levels: AnalyticalLevel[] = clustering.clusters.map((c, i) => ({ id: `lvl-${i}`, elevationM: c.elevationM }));
  const { supports, restrained } = buildSupports(acc, input.graph, resolved);
  const nodes = buildNodes(resolved, restrained, clustering);
  const members = buildMembers(acc, resolved);
  const diaphragms = buildDiaphragms(members, nodes, levels);
  return { nodes, members, supports, diaphragms, levels };
}
