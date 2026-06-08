/**
 * ADR-422 L4 — Hydraulic balancing engine (index circuit + balancing valves) — PURE.
 *
 * Παίρνει το **διαστασιολογημένο** δίκτυο του L3 (per-segment R/v/DN) + την παροχή
 * κάθε τερματικού και υπολογίζει την υδραυλική εξισορρόπηση (Revit «System Inspector»
 * / 4M-FineHEAT «balancing schedule»):
 *
 *   1. ΔP ανά τμήμα `ΔP_seg = R·L + ζ·(ρ·v²/2)` (τριβή + τοπικές, D-A topology-derived).
 *   2. Cumulative drop κατεβαίνοντας το δέντρο (ρίζα→κόμβος) — ο supply & ο return
 *      κλάδος είναι ξεχωριστά δέντρα (τα σώματα δεν είναι segments). Το «κύκλωμα» κάθε
 *      σώματος = άθροισμα των paths ΟΛΩΝ των components που αγγίζουν οι connectors του
 *      (connector-agnostic: supply + return) + ονομαστική πτώση σώματος.
 *   3. Index circuit = το δυσμενέστερο (max ΔP_circuit) → ορίζει το μανομετρικό.
 *   4. Εξισορρόπηση: `surplus = pumpHead − ΔP_circuit` → απαιτ. kv balancing valve.
 *
 * ΜΟΝΑΔΕΣ: πιέσεις Pa, παροχές kg/s→m³/s, μήκη m (`computeMepSegmentGeometry`). Pure,
 * idempotent, full unit-testable. Reuse του κοινού γράφου (`../sizing/pipe-network-graph`).
 *
 * @see ./pressure-drop · ./balancing-config · ../sizing/pipe-network-sizing (L3 input)
 * @see docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md §3 (L4)
 */

import type { Entity } from '../../../types/entities';
import { isMepSegmentEntity, isMepRadiatorEntity } from '../../../types/entities';
import { isPipeNetworkSourceEntity } from '../../mep-systems/pipe-network-source';
import { resolvePipeJoinTolerance } from '../../mep-systems/mep-pipe-network-derive';
import { compareStrings } from '@/lib/array-utils';
import { computeMepSegmentGeometry } from '../../geometry/mep-segment-geometry';
import { computePipeVolumeFlow } from '../sizing/pipe-sizing';
import type { PipeSizingMap, TerminalFlowContribution } from '../sizing/pipe-network-sizing';
import {
  buildGraph,
  buildAdjacency,
  computeComponents,
  resolveComponentRoots,
  bfsTree,
  connectorWorldPoints,
  findNearestNode,
  type GraphPoint,
} from '../sizing/pipe-network-graph';
import { segmentPressureDropPa, requiredKv } from './pressure-drop';
import {
  zetaForDegree,
  BALANCING_WATER_DENSITY_KG_M3,
  TERMINAL_NOMINAL_DROP_PA,
  PUMP_HEAD_SAFETY_FACTOR,
  PA_PER_BAR,
  SECONDS_PER_HOUR,
} from './balancing-config';

/** Όρισμα του balancing engine. */
export interface BalanceNetworkInput {
  readonly entities: readonly Entity[];
  /** Per-segment sizing (R/v/DN) — από τον L3 (`sizePipeNetwork`). */
  readonly sizing: PipeSizingMap;
  /** radiatorId → παροχή/φορτίο (από `buildTerminalContributions`). */
  readonly terminals: ReadonlyMap<string, TerminalFlowContribution>;
  /** Override join tolerance (scene units)· default `resolvePipeJoinTolerance`. */
  readonly tolerance?: number;
}

/** Αποτέλεσμα εξισορρόπησης ενός τερματικού (derived). */
export interface TerminalBalancing {
  readonly terminalId: string;
  /** kg/s — μαζική παροχή του κυκλώματος. */
  readonly massFlowKgS: number;
  /** Pa — συνολική πτώση πίεσης του κυκλώματος (supply + return + σώμα). */
  readonly circuitDropPa: number;
  /** true ⇒ το δυσμενέστερο κύκλωμα (index). */
  readonly isIndex: boolean;
  /** Pa — υπερβάλλουσα πίεση προς στραγγαλισμό από τη balancing valve. */
  readonly surplusPa: number;
  /** Απαιτ. kv balancing valve· null = «πλήρως ανοιχτή» (index/αμελητέα υπερβάλλουσα). */
  readonly requiredKv: number | null;
}

/** Πλήρες αποτέλεσμα υδραυλικής εξισορρόπησης (transient read-model). */
export interface HydraulicBalancingResult {
  readonly terminals: ReadonlyMap<string, TerminalBalancing>;
  /** radiatorId του index circuit· null όταν κανένα κύκλωμα δεν διαστασιολογείται. */
  readonly indexTerminalId: string | null;
  /** Pa — απαιτούμενο μανομετρικό κυκλοφορητή (index × safety factor). */
  readonly pumpHeadPa: number;
  /** segmentId → ΔP_seg (Pa) — για overlay/debug. */
  readonly segmentDropPa: ReadonlyMap<string, number>;
}

const EMPTY_RESULT: HydraulicBalancingResult = {
  terminals: new Map(),
  indexTerminalId: null,
  pumpHeadPa: 0,
  segmentDropPa: new Map(),
};

/** Μήκος (m) ανά segment μέσω του geometry SSoT (true 3D length, κλίση-aware). */
function buildSegmentLengthsM(entities: readonly Entity[]): Map<string, number> {
  const lengths = new Map<string, number>();
  for (const e of entities) {
    if (!isMepSegmentEntity(e) || e.params.domain !== 'pipe') continue;
    lengths.set(e.id, computeMepSegmentGeometry(e.params).length);
  }
  return lengths;
}

/** ΔP ενός tree-edge segment (Pa) — τριβή + τοπικές (ζ από τον βαθμό του parent). */
function edgeDropPa(
  segId: string,
  parentDegree: number,
  sizing: PipeSizingMap,
  lengthsM: ReadonlyMap<string, number>,
): number {
  const s = sizing.get(segId);
  if (!s) return 0;
  return segmentPressureDropPa({
    frictionPaM: s.frictionPaM,
    lengthM: lengthsM.get(segId) ?? 0,
    localZetaSum: zetaForDegree(parentDegree),
    velocityMS: s.velocityMS,
    densityKgM3: BALANCING_WATER_DENSITY_KG_M3,
  });
}

interface TreeWalkInput {
  readonly root: number;
  readonly adj: ReadonlyArray<ReadonlyArray<{ segId: string; to: number }>>;
  readonly degree: readonly number[];
  readonly sizing: PipeSizingMap;
  readonly lengthsM: ReadonlyMap<string, number>;
}

/** Walk ενός δέντρου: cumulative drop ανά κόμβο + ΔP ανά tree-edge segment. */
function walkTreeDrops(
  input: TreeWalkInput,
  cumDrop: number[],
  segmentDropPa: Map<string, number>,
): void {
  const tree = bfsTree(input.root, input.adj);
  for (const node of tree.order) {
    const p = tree.parent[node]!;
    if (p < 0) continue;
    const segId = tree.edgeSeg[node]!;
    const drop = edgeDropPa(segId, input.degree[p]!, input.sizing, input.lengthsM);
    segmentDropPa.set(segId, drop);
    cumDrop[node] = cumDrop[p]! + drop;
  }
}

/** Συνολική πτώση κυκλώματος ενός σώματος: Σ max-path ανά component που αγγίζει. */
function terminalCircuitDropPa(
  radiator: Entity,
  nodes: readonly GraphPoint[],
  componentOf: readonly number[],
  cumDrop: readonly number[],
  maxDist2: number,
): number {
  const byComponent = new Map<number, number>();
  for (const p of connectorWorldPoints(radiator)) {
    const node = findNearestNode(nodes, p, maxDist2);
    if (node < 0) continue;
    const comp = componentOf[node]!;
    byComponent.set(comp, Math.max(byComponent.get(comp) ?? 0, cumDrop[node]!));
  }
  let total = TERMINAL_NOMINAL_DROP_PA;
  for (const drop of byComponent.values()) total += drop;
  return total;
}

interface RawCircuit {
  readonly terminalId: string;
  readonly massFlowKgS: number;
  readonly circuitDropPa: number;
}

/** Build raw κύκλωμα ανά σώμα (πριν τον προσδιορισμό index/kv). */
function buildRawCircuits(
  radiators: readonly Entity[],
  terminals: ReadonlyMap<string, TerminalFlowContribution>,
  nodes: readonly GraphPoint[],
  componentOf: readonly number[],
  cumDrop: readonly number[],
  maxDist2: number,
): RawCircuit[] {
  const out: RawCircuit[] = [];
  for (const rad of radiators) {
    const t = terminals.get(rad.id);
    if (!t) continue;
    out.push({
      terminalId: rad.id,
      massFlowKgS: t.massFlowKgS,
      circuitDropPa: terminalCircuitDropPa(rad, nodes, componentOf, cumDrop, maxDist2),
    });
  }
  return out;
}

/** Index circuit (max ΔP)· null όταν κανένα δεν διαστασιολογείται (όλα ≤0). */
function resolveIndex(circuits: readonly RawCircuit[]): RawCircuit | null {
  let index: RawCircuit | null = null;
  for (const c of circuits) {
    if (c.circuitDropPa <= 0) continue;
    if (!index || c.circuitDropPa > index.circuitDropPa) index = c;
  }
  return index;
}

/** Προσδιορισμός index + kv ανά κύκλωμα από το μανομετρικό. */
function assignBalancing(
  circuits: readonly RawCircuit[],
  pumpHeadPa: number,
  indexTerminalId: string | null,
): Map<string, TerminalBalancing> {
  const out = new Map<string, TerminalBalancing>();
  for (const c of circuits) {
    const surplusPa = Math.max(0, pumpHeadPa - c.circuitDropPa);
    const kv = requiredKv({
      volumeFlowM3s: computePipeVolumeFlow(c.massFlowKgS),
      surplusPa,
      paPerBar: PA_PER_BAR,
      secondsPerHour: SECONDS_PER_HOUR,
    });
    out.set(c.terminalId, {
      terminalId: c.terminalId,
      massFlowKgS: c.massFlowKgS,
      circuitDropPa: c.circuitDropPa,
      isIndex: c.terminalId === indexTerminalId,
      surplusPa,
      requiredKv: c.terminalId === indexTerminalId ? null : kv,
    });
  }
  return out;
}

/**
 * Υδραυλική εξισορρόπηση ΟΛΟΥ του δικτύου (pure). Επιστρέφει per-terminal
 * `{ circuitDropPa, isIndex, surplusPa, requiredKv }` + `indexTerminalId`/`pumpHeadPa`.
 * Άδειο όταν δεν υπάρχουν σωλήνες, τερματικά ή sizing.
 */
export function balanceNetwork(input: BalanceNetworkInput): HydraulicBalancingResult {
  const segments = input.entities
    .filter(isMepSegmentEntity)
    .filter((s) => s.params.domain === 'pipe')
    .sort((a, b) => compareStrings(a.id, b.id));
  if (segments.length === 0 || input.terminals.size === 0 || input.sizing.size === 0) {
    return EMPTY_RESULT;
  }

  const tol = input.tolerance ?? resolvePipeJoinTolerance(input.entities);
  const attachDist2 = (tol * 2) * (tol * 2);
  const lengthsM = buildSegmentLengthsM(input.entities);
  const { nodes, edges } = buildGraph(segments, tol);
  const adj = buildAdjacency(nodes.length, edges);
  const degree = adj.map((a) => a.length);
  const componentOf = computeComponents(nodes.length, edges);
  const sources = input.entities.filter(isPipeNetworkSourceEntity);
  const roots = resolveComponentRoots(nodes, componentOf, sources, attachDist2);

  const cumDrop = new Array<number>(nodes.length).fill(0);
  const segmentDropPa = new Map<string, number>();
  const walked = new Set<number>();
  for (const rootNode of roots.values()) {
    const comp = componentOf[rootNode]!;
    if (walked.has(comp)) continue;
    walked.add(comp);
    walkTreeDrops({ root: rootNode, adj, degree, sizing: input.sizing, lengthsM }, cumDrop, segmentDropPa);
  }

  const radiators = input.entities.filter(isMepRadiatorEntity);
  const circuits = buildRawCircuits(radiators, input.terminals, nodes, componentOf, cumDrop, attachDist2);
  const index = resolveIndex(circuits);
  const pumpHeadPa = index ? index.circuitDropPa * PUMP_HEAD_SAFETY_FACTOR : 0;
  const terminals = assignBalancing(circuits, pumpHeadPa, index?.terminalId ?? null);

  return { terminals, indexTerminalId: index?.terminalId ?? null, pumpHeadPa, segmentDropPa };
}
