/**
 * Structural Organism — reinforcement continuity (ADR-459 Phase 4c).
 *
 * Η ΚΑΡΔΙΑ του οργανισμού: ο αυτόματος οπλισμός υπολογίζεται σαν **ΕΝΑΣ ενιαίος
 * οργανισμός**. Για κάθε στατική σύνδεση του graph παράγονται **αμφίδρομα** οι
 * αναγκαίες προεκτάσεις οπλισμού — αναμονές/dowels (πέδιλο↔κολόνα), αγκυρώσεις
 * δοκαριού στον κόμβο (κολόνα↔δοκάρι) και ματίσεις ορόφου (κολόνα↔κολόνα). Πρότυπο
 * Revit Structural / Analytical Rebar coupling (EC2 §8.4/§8.7, EC8 §5.6).
 *
 * **Pure, DERIVED, ΠΟΤΕ persisted** (φιλοσοφία graph/ADR-458): διαβάζει το
 * `params.reinforcement` των entities + τα μήκη ανάπτυξης από τον code provider
 * (ΕΝΑ SSoT, `lapLengthMm`/`anchorageLengthMm`). Μηδέν mutation, μηδέν React/DOM/
 * Firestore. Το flat `LONGITUDINAL_LAP_FACTOR=50` των compute αντικαθίσταται όπου
 * υπάρχει πραγματικό joint· αλλιώς παραμένει ως isolated-member fallback.
 *
 * @see ./structural-graph.ts — ο DERIVED graph (input)
 * @see ../codes/structural-code-types.ts — provider lap/anchorage SSoT
 * @see ../reinforcement/*-reinforcement-compute.ts — οι continuity-aware overrides
 * @see docs/centralized-systems/reference/adrs/ADR-459-structural-organism-connectivity.md §6c
 */

import type { Entity } from '../../../types/entities';
import { isColumnEntity, isBeamEntity } from '../../../types/entities';
import type { StructuralCodeProvider } from '../codes/structural-code-types';
import type { ColumnReinforcement } from '../reinforcement/column-reinforcement-types';
import type { BeamReinforcement } from '../reinforcement/beam-reinforcement-types';
import type { StructuralEdge, StructuralGraph, StructuralNode } from './structural-organism-types';

/** Είδος οργανικής συνέχειας. */
export type ContinuityKind = 'dowel' | 'lap' | 'anchorage';

/** Μία προέκταση οπλισμού σε στατική σύνδεση (αμφίδρομη — ανήκει και στα δύο μέλη). */
export interface ReinforcementContinuityItem {
  readonly kind: ContinuityKind;
  /** Πλήθος ράβδων που συμμετέχουν. */
  readonly count: number;
  /** Διάμετρος ράβδου (mm). */
  readonly diameterMm: number;
  /** Μήκος προέκτασης ανά ράβδο (mm). */
  readonly lengthMm: number;
  /** Μέλος-πηγή (π.χ. κολόνα για dowel, δοκάρι για anchorage). */
  readonly fromMemberId: string;
  /** Όμορο μέλος (π.χ. πέδιλο για dowel, κολόνα για anchorage). */
  readonly toMemberId: string;
  /** Back-ref στο {@link StructuralEdge}. */
  readonly edgeId: string;
}

/** Ανά κάτω/άνω στρώση ανάπτυξη διαμήκους οπλισμού δοκού (mm). */
export interface BeamMemberDevelopment {
  readonly bottomMm: number;
  readonly topMm: number;
}

/** Αποτέλεσμα: items + αμφίδρομο per-member index + compute-ready overrides. */
export interface OrganismContinuityResult {
  /** Per-member items (το ΙΔΙΟ item εμφανίζεται και στα δύο εμπλεκόμενα μέλη). */
  readonly byMember: ReadonlyMap<string, readonly ReinforcementContinuityItem[]>;
  /** Όλα τα items (flat). */
  readonly items: readonly ReinforcementContinuityItem[];
  /** Compute override: κολόνα id → συνολική ανάπτυξη ανά διαμήκη ράβδο (mm). */
  readonly columnDevelopmentMm: ReadonlyMap<string, number>;
  /** Compute override: δοκάρι id → ανάπτυξη κάτω/άνω ράβδων (mm). */
  readonly beamDevelopmentMm: ReadonlyMap<string, BeamMemberDevelopment>;
}

// ─── Reinforcement readers (pure — από τα persisted params) ───────────────────

function columnReinforcement(e: Entity | undefined): ColumnReinforcement | undefined {
  return e && isColumnEntity(e) ? e.params.reinforcement : undefined;
}

function beamReinforcement(e: Entity | undefined): BeamReinforcement | undefined {
  return e && isBeamEntity(e) ? e.params.reinforcement : undefined;
}

// ─── Per-edge handler output ──────────────────────────────────────────────────

interface ColumnDevContribution {
  readonly id: string;
  readonly addMm: number;
}

interface EdgeContinuity {
  readonly item: ReinforcementContinuityItem;
  /** Μέλη όπου εμφανίζεται το item (αμφίδρομα — και τα δύο άκρα). */
  readonly memberIds: readonly string[];
  readonly columnDev?: readonly ColumnDevContribution[];
  readonly beamDev?: { readonly id: string; readonly dev: BeamMemberDevelopment };
}

// ─── Per-edge continuity (κάθε handler ≤40 γρ.) ───────────────────────────────

/**
 * `footing-bearing` (πέδιλο→κολόνα): η κολόνα απαιτεί **αναμονές/dowels** από το
 * πέδιλο. Dowel = αγκύρωση μέσα στο πέδιλο (lbd) + προέκταση/μάτισμα με τις ράβδους
 * της κολόνας (l₀). Το ίδιο το όπλισμα της κολόνας ματίζεται στη βάση (l₀).
 */
function footingBearingContinuity(
  edge: StructuralEdge,
  entityById: ReadonlyMap<string, Entity>,
  provider: StructuralCodeProvider,
): EdgeContinuity | null {
  const col = columnReinforcement(entityById.get(edge.supportedId));
  if (!col) return null;
  const diameterMm = col.longitudinal.diameterMm;
  const lap = provider.lapLengthMm(diameterMm);
  const anchorage = provider.anchorageLengthMm(diameterMm);
  const item: ReinforcementContinuityItem = {
    kind: 'dowel',
    count: col.longitudinal.count,
    diameterMm,
    lengthMm: anchorage + lap,
    fromMemberId: edge.supportedId, // κολόνα
    toMemberId: edge.supportId, // πέδιλο
    edgeId: edge.id,
  };
  return {
    item,
    memberIds: [edge.supportedId, edge.supportId],
    columnDev: [{ id: edge.supportedId, addMm: lap }],
  };
}

/**
 * `column-bearing` (κολόνα→δοκάρι): οι κάτω/άνω ράβδοι του δοκαριού **αγκυρώνονται
 * στον κόμβο/κολόνα** (EC8 §5.6.2.2). Κάθε τέτοια ακμή = ένα στηριζόμενο άκρο →
 * προσθέτει μία αγκύρωση (lbd) ανά στρώση.
 */
function columnBearingContinuity(
  edge: StructuralEdge,
  entityById: ReadonlyMap<string, Entity>,
  provider: StructuralCodeProvider,
): EdgeContinuity | null {
  const beam = beamReinforcement(entityById.get(edge.supportedId));
  if (!beam) return null;
  const bottomMm = provider.anchorageLengthMm(beam.bottom.diameterMm);
  const topMm = provider.anchorageLengthMm(beam.top.diameterMm);
  const item: ReinforcementContinuityItem = {
    kind: 'anchorage',
    count: beam.bottom.count + beam.top.count,
    diameterMm: beam.bottom.diameterMm,
    lengthMm: bottomMm,
    fromMemberId: edge.supportedId, // δοκάρι
    toMemberId: edge.supportId, // κολόνα
    edgeId: edge.id,
  };
  return {
    item,
    memberIds: [edge.supportedId, edge.supportId],
    beamDev: { id: edge.supportedId, dev: { bottomMm, topMm } },
  };
}

/**
 * `top-attachment` (host από πάνω ↔ κολόνα): **μάτισμα ορόφου** (lap splice) στη
 * στάθμη — μόνο κολόνα↔κολόνα· το μάτισμα προστίθεται στην κορυφή της κάτω κολόνας
 * ΚΑΙ στη βάση της άνω (αμφίδρομα). Host μη-κολόνα (δοκάρι/πλάκα) → **αγκύρωση**
 * των διαμήκων της κολόνας μέσα στον host (ADR-459 Φ4e/E1, EC8 §5.6).
 */
function topAttachmentContinuity(
  edge: StructuralEdge,
  entityById: ReadonlyMap<string, Entity>,
  provider: StructuralCodeProvider,
): EdgeContinuity | null {
  // supportedId = πάντα η κολόνα (μόνο isColumnEntity παράγει top-attachment ακμή).
  const lower = columnReinforcement(entityById.get(edge.supportedId));
  if (!lower) return null;
  const upper = columnReinforcement(entityById.get(edge.supportId));
  return upper
    ? columnLapContinuity(edge, lower, upper, provider)
    : columnTopAnchorageContinuity(edge, lower, provider);
}

/** Κολόνα↔κολόνα (στάθμη ορόφου): μάτισμα l₀ αμφίδρομα (κορυφή κάτω + βάση άνω). */
function columnLapContinuity(
  edge: StructuralEdge,
  lower: ColumnReinforcement,
  upper: ColumnReinforcement,
  provider: StructuralCodeProvider,
): EdgeContinuity {
  const lowerLap = provider.lapLengthMm(lower.longitudinal.diameterMm);
  const upperLap = provider.lapLengthMm(upper.longitudinal.diameterMm);
  const item: ReinforcementContinuityItem = {
    kind: 'lap',
    count: Math.min(lower.longitudinal.count, upper.longitudinal.count),
    diameterMm: lower.longitudinal.diameterMm,
    lengthMm: lowerLap,
    fromMemberId: edge.supportedId, // κάτω κολόνα
    toMemberId: edge.supportId, // άνω κολόνα
    edgeId: edge.id,
  };
  return {
    item,
    memberIds: [edge.supportedId, edge.supportId],
    columnDev: [
      { id: edge.supportedId, addMm: lowerLap },
      { id: edge.supportId, addMm: upperLap },
    ],
  };
}

/**
 * Κολόνα→μη-κολόνα host (δοκάρι/πλάκα από πάνω, ADR-459 Φ4e/E1): οι διαμήκεις
 * αγκυρώνονται μέσα στον host με lbd αντί για μάτισμα. Reuse `anchorageLengthMm`
 * (ΕΝΑ SSoT). Η αναπτυξη προστίθεται μόνο στην κολόνα.
 */
function columnTopAnchorageContinuity(
  edge: StructuralEdge,
  lower: ColumnReinforcement,
  provider: StructuralCodeProvider,
): EdgeContinuity {
  const anchorage = provider.anchorageLengthMm(lower.longitudinal.diameterMm);
  const item: ReinforcementContinuityItem = {
    kind: 'anchorage',
    count: lower.longitudinal.count,
    diameterMm: lower.longitudinal.diameterMm,
    lengthMm: anchorage,
    fromMemberId: edge.supportedId, // κολόνα
    toMemberId: edge.supportId, // host (δοκάρι/πλάκα)
    edgeId: edge.id,
  };
  return {
    item,
    memberIds: [edge.supportedId, edge.supportId],
    columnDev: [{ id: edge.supportedId, addMm: anchorage }],
  };
}

function continuityForEdge(
  edge: StructuralEdge,
  entityById: ReadonlyMap<string, Entity>,
  provider: StructuralCodeProvider,
): EdgeContinuity | null {
  switch (edge.kind) {
    case 'footing-bearing':
      return footingBearingContinuity(edge, entityById, provider);
    case 'column-bearing':
      return columnBearingContinuity(edge, entityById, provider);
    case 'top-attachment':
      return topAttachmentContinuity(edge, entityById, provider);
  }
}

// ─── Accumulator (merge per-edge results σε per-member index + overrides) ──────

class ContinuityAccumulator {
  readonly items: ReinforcementContinuityItem[] = [];
  private readonly byMember = new Map<string, ReinforcementContinuityItem[]>();
  private readonly columnDev = new Map<string, number>();
  private readonly beamDev = new Map<string, BeamMemberDevelopment>();

  add(result: EdgeContinuity): void {
    this.items.push(result.item);
    for (const id of result.memberIds) {
      const list = this.byMember.get(id) ?? [];
      list.push(result.item);
      this.byMember.set(id, list);
    }
    for (const c of result.columnDev ?? []) {
      this.columnDev.set(c.id, (this.columnDev.get(c.id) ?? 0) + c.addMm);
    }
    if (result.beamDev) {
      const prev = this.beamDev.get(result.beamDev.id) ?? { bottomMm: 0, topMm: 0 };
      this.beamDev.set(result.beamDev.id, {
        bottomMm: prev.bottomMm + result.beamDev.dev.bottomMm,
        topMm: prev.topMm + result.beamDev.dev.topMm,
      });
    }
  }

  toResult(): OrganismContinuityResult {
    return {
      byMember: this.byMember,
      items: this.items,
      columnDevelopmentMm: this.columnDev,
      beamDevelopmentMm: this.beamDev,
    };
  }
}

/**
 * Υπολογισμός της οργανικής συνέχειας οπλισμού για όλον τον graph (DERIVED, pure).
 * Επιστρέφει τα cross-member items (αμφίδρομα) + compute-ready development overrides
 * ανά μέλος. Edges με μέλος χωρίς reinforcement intent παραλείπονται (→ flag 4d).
 */
export function computeOrganismReinforcementContinuity(
  graph: StructuralGraph,
  entities: readonly Entity[],
  provider: StructuralCodeProvider,
): OrganismContinuityResult {
  const entityById = new Map<string, Entity>(entities.map((e) => [e.id, e]));
  const nodeById = new Map<string, StructuralNode>(graph.nodes.map((n) => [n.id, n]));
  const acc = new ContinuityAccumulator();
  for (const edge of graph.edges) {
    if (!nodeById.has(edge.supportId) || !nodeById.has(edge.supportedId)) continue;
    const result = continuityForEdge(edge, entityById, provider);
    if (result) acc.add(result);
  }
  return acc.toResult();
}
