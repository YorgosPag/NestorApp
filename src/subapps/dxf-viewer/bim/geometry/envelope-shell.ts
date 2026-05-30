/**
 * ADR-396 v2 Phase 5 — Envelope shell builder (ETICS) geometry SSoT.
 *
 * Αντικαθιστά το `computeEnvelopePerimeter` ως πηγή της **ορατής** μόνωσης: αντί
 * για centroid heuristic σε σειριακή ένωση παρειών τοίχων, χτίζει το κέλυφος από
 * το ΠΡΑΓΜΑΤΙΚΟ περίγραμμα του κτιρίου (boolean union τοίχων+κολωνών+δοκαριών,
 * `building-footprint.ts` Φ2) + την αυτόματη ταξινόμηση αίθριο/δωμάτιο
 * (`footprint-region-classifier.ts` Φ3) + την per-element χειροκίνητη παράκαμψη
 * (`envelopeFunction`, Φ4). Κολώνες/δοκάρια που προεξέχουν τυλίγονται αυτόματα
 * ως μέρος του ενιαίου κελύφους («ίδια με τοίχους»).
 *
 * Το μοντέλο είναι «ring → runs → offset», ΠΟΛΥ απλούστερο από το
 * `envelope-perimeter.ts`: το footprint pipeline έχει ήδη λύσει όλη την τοπολογία
 * (καμία adjacency graph / face-corner keys / selectExteriorFace / column arcs).
 *
 * **Override σημασιολογία (απόφαση Giorgio, Φάση 5):**
 *   - `'interior'` = **αφαιρετικό**: η ακμή του στοιχείου εξαιρείται από το
 *     μονωμένο όριο → η συνεχής γραμμή **σπάει** σε ΑΝΟΙΧΤΑ runs (κενό μπροστά του).
 *   - `'exterior'` = **προσθετικό**: στοιχείο εκτός κάθε auto-μονωμένου ορίου παίρνει
 *     **δικό του** κλειστό τύλιγμα (orphan wrap) — δεν αγγίζει ring edges, ώστε ένας
 *     ήδη-εξωτερικός τοίχος να ΜΗΝ μονώνεται και στην εσωτ. (room) όψη του.
 *
 * Offset direction: ΔΕΝ εμπιστευόμαστε το `sign` του `offsetPolyline` (αναξιόπιστο
 * σε notched γωνίες) — δοκιμάζουμε **και τα δύο πρόσημα** και διαλέγουμε με mean
 * distance προς το κέντρο του ring (outer → πιο μακριά = έξω· τρύπα → πιο κοντά =
 * προς το κενό). Ίδιο pattern με `offsetLoopOutward`/`insetClosedPolygon`.
 *
 * Έξοδος = `EnvelopeChain[]` (reuse verbatim — drop-in για `envelope-render-plan`,
 * `envelope-opening-cuts`, `EnvelopeToThree`). Pure SSoT — canvas-unit in/out,
 * meters μόνο στο `spec.thickness_m` boundary. Μηδέν globals / React / Firestore.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-396-bim-external-thermal-envelope-etics.md §3.1
 */

import type { Point3D } from '../types/bim-base';
import type { EnvelopeFunction, ThermalEnvelopeSpec } from '../types/thermal-envelope-types';
import type { SceneUnits } from '../../utils/scene-units';
import { mmToSceneUnits } from '../../utils/scene-units';
import {
  offsetPolyline,
  polygonCentroid,
  polylinePerimeterMeters,
  stripClosingDuplicate,
} from './shared/polygon-utils';
import {
  computeBuildingFootprint,
  type BeamForFootprint,
  type BuildingFootprintResult,
  type FootprintEdge,
  type FootprintRing,
  type FootprintSourceType,
} from './building-footprint';
import {
  classifyFootprintRegions,
  type ClassifiedFootprintRing,
  type FootprintClassificationResult,
  type SlabRegionFootprint,
} from './footprint-region-classifier';
import type { ColumnForEnvelope, EnvelopeChain, WallForEnvelope } from './envelope-perimeter';

// ============================================================================
// PUBLIC TYPES
// ============================================================================

export interface EnvelopeShellResult {
  readonly chains: readonly EnvelopeChain[];
  /** Μεγαλύτερο (κατά perimeter) ΚΛΕΙΣΤΟ chain — mirror του παλιού API. */
  readonly primaryChain: EnvelopeChain | null;
}

// ============================================================================
// INTERNAL TYPES
// ============================================================================

type Ref = { readonly x: number; readonly y: number };

/** Μία ακμή ring με την effective απόφαση μόνωσης + provenance. */
interface ShellEdge {
  readonly a: Point3D;
  readonly b: Point3D;
  readonly insulated: boolean;
  readonly sourceEntityId: string | null;
  readonly sourceEntityType: FootprintSourceType | null;
}

/** Είτε ολόκληρο μονωμένο ring (closed) είτε ένα ανοιχτό run μονωμένων ακμών. */
interface ShellRun {
  readonly edges: readonly ShellEdge[];
  readonly closed: boolean;
}

interface ShellIds {
  readonly wallIds: string[];
  readonly columnIds: string[];
  readonly beamIds: string[];
}

// ============================================================================
// PER-EDGE INSULATION (auto ring role − 'interior' override)
// ============================================================================

/**
 * Effective μόνωση μιας ακμής. `'interior'` αφαιρεί (force-off). `'exterior'` ΔΕΝ
 * αγγίζει εδώ (γίνεται orphan wrap — αλλιώς ένας εξωτ. τοίχος θα μόνωνε και την
 * room όψη του). `undefined`/κορυφή τομής (`sourceEntityId===null`) → ρόλος ring.
 */
function resolveEdgeInsulation(
  edge: FootprintEdge,
  ringInsulated: boolean,
  overrides: ReadonlyMap<string, EnvelopeFunction>,
): boolean {
  if (edge.sourceEntityId && overrides.get(edge.sourceEntityId) === 'interior') return false;
  return ringInsulated;
}

function toRingEdges(
  classified: ClassifiedFootprintRing,
  overrides: ReadonlyMap<string, EnvelopeFunction>,
): ShellEdge[] {
  return classified.ring.edges.map((e) => ({
    a: e.a,
    b: e.b,
    insulated: resolveEdgeInsulation(e, classified.insulated, overrides),
    sourceEntityId: e.sourceEntityId,
    sourceEntityType: e.sourceEntityType,
  }));
}

// ============================================================================
// RUN EXTRACTION (contiguous insulated edges, wrap-around safe)
// ============================================================================

function extractRuns(edges: readonly ShellEdge[]): ShellRun[] {
  if (edges.length === 0) return [];
  if (edges.every((e) => e.insulated)) return [{ edges, closed: true }];
  if (!edges.some((e) => e.insulated)) return [];

  const n = edges.length;
  const start = edges.findIndex((e) => !e.insulated); // ξεκίνα μετά από κενό → κανένα run στο seam
  const runs: ShellEdge[][] = [];
  let cur: ShellEdge[] = [];
  for (let k = 0; k < n; k++) {
    const e = edges[(start + k) % n];
    if (e.insulated) cur.push(e);
    else if (cur.length > 0) {
      runs.push(cur);
      cur = [];
    }
  }
  if (cur.length > 0) runs.push(cur);
  return runs.map((r) => ({ edges: r, closed: false }));
}

/** Polyline ενός run: closed → οι αρχές των ακμών· open → +η τελευταία απόληξη. */
function runPolyline(run: ShellRun): Point3D[] {
  const pts = run.edges.map((e) => e.a);
  if (!run.closed) pts.push(run.edges[run.edges.length - 1].b);
  return pts;
}

function runEntityIds(edges: readonly ShellEdge[]): ShellIds {
  const w = new Set<string>();
  const c = new Set<string>();
  const b = new Set<string>();
  for (const e of edges) {
    if (!e.sourceEntityId) continue;
    if (e.sourceEntityType === 'wall') w.add(e.sourceEntityId);
    else if (e.sourceEntityType === 'column') c.add(e.sourceEntityId);
    else if (e.sourceEntityType === 'beam') b.add(e.sourceEntityId);
  }
  return { wallIds: [...w], columnIds: [...c], beamIds: [...b] };
}

// ============================================================================
// OFFSET (try both signs, pick by distance to ring centroid)
// ============================================================================

function meanDistToRef(pts: readonly Point3D[], ref: Ref): number {
  let s = 0;
  for (const v of pts) s += Math.hypot(v.x - ref.x, v.y - ref.y);
  return pts.length > 0 ? s / pts.length : 0;
}

/**
 * Offset μιας face προς τα έξω (`outward`) ή προς το κενό, χωρίς να εμπιστευόμαστε
 * το sign convention: δοκιμάζει +1/−1 και κρατά το πιο μακρινό/κοντινό προς το
 * `reference` (= κέντρο του ring). Δουλεύει για closed rings ΚΑΙ open runs.
 */
function offsetFace(
  face: readonly Point3D[],
  thicknessCanvas: number,
  closed: boolean,
  outward: boolean,
  reference: Ref,
): Point3D[] {
  if (thicknessCanvas <= 0 || face.length < 2) {
    return face.map((p) => ({ x: p.x, y: p.y, z: p.z ?? 0 }));
  }
  const plus = offsetPolyline(face, thicknessCanvas, 1, closed);
  const minus = offsetPolyline(face, thicknessCanvas, -1, closed);
  const farther = meanDistToRef(plus, reference) >= meanDistToRef(minus, reference) ? plus : minus;
  const closer = farther === plus ? minus : plus;
  return outward ? farther : closer;
}

// ============================================================================
// CHAIN ASSEMBLY (face loop → offset band)
// ============================================================================

function buildChain(
  facePts: readonly Point3D[],
  closed: boolean,
  outward: boolean,
  reference: Ref,
  thicknessCanvas: number,
  ids: ShellIds,
  sceneScale: number,
): EnvelopeChain | null {
  const face = closed ? stripClosingDuplicate(facePts) : facePts;
  if (face.length < 2) return null;
  const offset = offsetFace(face, thicknessCanvas, closed, outward, reference);
  return {
    exteriorFaceLoop: { points: [...face], closed },
    insulationOuterLoop: { points: offset, closed },
    closed,
    enclosesRegion: closed,
    perimeterM: polylinePerimeterMeters(offset, closed, sceneScale),
    wallIds: ids.wallIds,
    columnIds: ids.columnIds,
    beamIds: ids.beamIds,
  };
}

function buildRingChains(
  classified: ClassifiedFootprintRing,
  overrides: ReadonlyMap<string, EnvelopeFunction>,
  thicknessCanvas: number,
  sceneScale: number,
): EnvelopeChain[] {
  // outer ring → προς τα έξω· τρύπα (αίθριο) → προς το κενό κέντρο της.
  const outward = !classified.ring.isHole;
  const reference = polygonCentroid(classified.ring.points.points);
  const chains: EnvelopeChain[] = [];
  for (const run of extractRuns(toRingEdges(classified, overrides))) {
    const chain = buildChain(
      runPolyline(run), run.closed, outward, reference, thicknessCanvas, runEntityIds(run.edges), sceneScale,
    );
    if (chain) chains.push(chain);
  }
  return chains;
}

// ============================================================================
// ORPHAN `exterior` WRAPS (στοιχείο μονωμένο χειροκίνητα εκτός κάθε ορίου)
// ============================================================================

/** Σύνολο ids που κατέληξαν μονωμένα σε κάποιο ring edge (auto − 'interior'). */
function collectInsulatedIds(
  classification: FootprintClassificationResult,
  overrides: ReadonlyMap<string, EnvelopeFunction>,
): Set<string> {
  const ids = new Set<string>();
  for (const cr of classification.rings) {
    for (const e of cr.ring.edges) {
      if (e.sourceEntityId && resolveEdgeInsulation(e, cr.insulated, overrides)) {
        ids.add(e.sourceEntityId);
      }
    }
  }
  return ids;
}

function largestOuterRing(footprint: BuildingFootprintResult): FootprintRing | null {
  let best: FootprintRing | null = null;
  for (const r of footprint.outerRings) {
    if (!best || r.areaCanvas > best.areaCanvas) best = r;
  }
  return best;
}

/** Κλειστό τύλιγμα γύρω από το footprint ενός μεμονωμένου στοιχείου (έξω). */
function orphanWrap(
  footprint: BuildingFootprintResult,
  ids: ShellIds,
  thicknessCanvas: number,
  sceneScale: number,
): EnvelopeChain | null {
  const ring = largestOuterRing(footprint);
  if (!ring) return null;
  const pts = stripClosingDuplicate(ring.points.points);
  if (pts.length < 3) return null;
  return buildChain(pts, true, true, polygonCentroid(pts), thicknessCanvas, ids, sceneScale);
}

function buildOrphanExteriorWraps(
  walls: readonly WallForEnvelope[],
  columns: readonly ColumnForEnvelope[],
  beams: readonly BeamForFootprint[],
  overrides: ReadonlyMap<string, EnvelopeFunction>,
  insulatedIds: ReadonlySet<string>,
  thicknessCanvas: number,
  sceneScale: number,
  units: SceneUnits,
): EnvelopeChain[] {
  const isOrphan = (id: string): boolean =>
    overrides.get(id) === 'exterior' && !insulatedIds.has(id);
  const out: EnvelopeChain[] = [];
  const push = (chain: EnvelopeChain | null): void => {
    if (chain) out.push(chain);
  };
  for (const w of walls.filter((x) => isOrphan(x.id))) {
    push(orphanWrap(computeBuildingFootprint([w], [], [], units), { wallIds: [w.id], columnIds: [], beamIds: [] }, thicknessCanvas, sceneScale));
  }
  for (const c of columns.filter((x) => isOrphan(x.id))) {
    push(orphanWrap(computeBuildingFootprint([], [c], [], units), { wallIds: [], columnIds: [c.id], beamIds: [] }, thicknessCanvas, sceneScale));
  }
  for (const b of beams.filter((x) => isOrphan(x.id))) {
    push(orphanWrap(computeBuildingFootprint([], [], [b], units), { wallIds: [], columnIds: [], beamIds: [b.id] }, thicknessCanvas, sceneScale));
  }
  return out;
}

// ============================================================================
// PUBLIC ENTRY
// ============================================================================

/**
 * Χτίζει το ETICS κέλυφος ως `EnvelopeChain[]` από το πραγματικό περίγραμμα +
 * την auto ταξινόμηση + το per-element override.
 *
 * @param overridesById - entity id → `envelopeFunction` (απών = auto).
 * @param slabsAbove    - footprints πλακών ψηλότερων ορόφων (αίθριο vs δωμάτιο).
 *                        Δες `selectSlabsAboveFloor`. Κενό → όλες οι τρύπες = αίθρια.
 */
export function computeEnvelopeShell(
  walls: readonly WallForEnvelope[],
  columns: readonly ColumnForEnvelope[],
  beams: readonly BeamForFootprint[],
  spec: ThermalEnvelopeSpec,
  overridesById: ReadonlyMap<string, EnvelopeFunction>,
  slabsAbove: readonly SlabRegionFootprint[] = [],
  options?: { readonly sceneUnits?: SceneUnits; readonly coverageThreshold?: number },
): EnvelopeShellResult {
  if (walls.length === 0 && columns.length === 0 && beams.length === 0) {
    return { chains: [], primaryChain: null };
  }
  const units =
    options?.sceneUnits ??
    walls[0]?.params.sceneUnits ??
    columns[0]?.params.sceneUnits ??
    beams[0]?.params.sceneUnits ??
    'mm';
  const sceneScale = mmToSceneUnits(units);
  const thicknessCanvas = Math.max(0, spec.thickness_m) * 1000 * sceneScale;

  const footprint = computeBuildingFootprint(walls, columns, beams, units);
  const classification = classifyFootprintRegions(footprint, slabsAbove, {
    coverageThreshold: options?.coverageThreshold,
  });

  const chains: EnvelopeChain[] = [];
  for (const cr of classification.rings) {
    chains.push(...buildRingChains(cr, overridesById, thicknessCanvas, sceneScale));
  }
  const insulatedIds = collectInsulatedIds(classification, overridesById);
  chains.push(
    ...buildOrphanExteriorWraps(walls, columns, beams, overridesById, insulatedIds, thicknessCanvas, sceneScale, units),
  );

  const closed = chains.filter((c) => c.closed);
  const primaryChain =
    closed.length > 0 ? closed.reduce((a, b) => (b.perimeterM > a.perimeterM ? b : a)) : null;
  return { chains, primaryChain };
}
