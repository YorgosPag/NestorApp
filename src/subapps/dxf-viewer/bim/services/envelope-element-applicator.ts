/**
 * ADR-396 Phase P7 Part B — Per-element envelope applicator (PURE SSoT).
 *
 * Παίρνει ένα `ThermalEnvelopeSpec` ορόφου + τα entities του ορόφου και
 * αποφασίζει ποιο δομικό στοιχείο παίρνει στρώση μόνωσης (per-element = source
 * of truth, Revit pattern — ADR-396 OQ-A/OQ-B):
 *   - **Z1** κολώνες/δοκάρια: εξωτερικά ⟺ ανήκουν στο footprint κέλυφος (διαβάζεται
 *     απευθείας από `chain.columnIds`/`beamIds` του `computeEnvelopeShell`, v2 Φ5B).
 *   - **Z2/Z3** πλάκες: μέσω `classifyExposedSlab` (πιλοτή soffit / δώμα top).
 *   - **Z4** ανοίγματα: σε εξωτερικό host wall → reveal μόνωση περβαζιών.
 * Κάθε ζώνη gated από `spec.zones[Zx]`. Στοιχείο που δεν qualify-άρει πλέον (ή
 * ζώνη off) → **καθαρίζεται** η στρώση του (idempotent — επαναληπτικό apply
 * συγκλίνει). ΚΑΜΙΑ Firestore/scene/render — pure (test-friendly, no globals).
 *
 * ΜΟΝΑΔΕΣ: τα vertex coords (footprint/axis/face loop) είναι σε canvas units —
 * ΙΔΙΟΣ χώρος με `WallGeometry.outerEdge` (το `computeEnvelopePerimeter` τα
 * παράγει εκεί), άρα η σύγκριση απόστασης γίνεται winding/scale-consistent.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-396-bim-external-thermal-envelope-etics.md §7 (P7 Part B)
 * @see ./envelope-boq-sync (καταναλώνει το ίδιο classification για BOQ rows)
 */

import { dequal } from 'dequal';

import type { AnySceneEntity } from '../../types/entities';
import {
  isWallEntity,
  isColumnEntity,
  isBeamEntity,
  isSlabEntity,
  isOpeningEntity,
} from '../../types/entities';
import type {
  EnvelopeLayer,
  EnvelopeZoneId,
  ThermalEnvelopeSpec,
} from '../types/thermal-envelope-types';
import type { StoreyRef } from '../utils/bim-floor-utils';
import type { SceneUnits } from '../../utils/scene-units';
import { computeEnvelopeShell, collectEnvelopeOverrides } from '../geometry/envelope-shell';
import type { WallForEnvelope, ColumnForEnvelope } from '../geometry/envelope-perimeter';
import type { BeamForFootprint } from '../geometry/building-footprint';
import { filterExposedSlabs, type SlabForZoneClassification } from '../geometry/exposed-slab-classifier';

// ============================================================================
// PUBLIC TYPES
// ============================================================================

/**
 * Επιθυμητή κατάσταση μόνωσης ενός στοιχείου. `layer`/`reveal` === undefined =
 * «να μην έχει στρώση» (clear). Το πεδίο εξαρτάται από το `entityType`:
 * columns/beams/slabs → `layer` (envelopeLayer)· openings → `reveal`
 * (revealInsulation, πάντα zone Z4).
 */
export interface ElementEnvelopeAssignment {
  readonly entityId: string;
  readonly entityType: 'column' | 'beam' | 'slab' | 'opening';
  readonly layer?: EnvelopeLayer;
  readonly reveal?: EnvelopeLayer;
}

// ============================================================================
// SHELL MEMBERSHIP (footprint-driven exterior element ids — ADR-396 v2 Φ5B)
// ============================================================================

interface ShellMembership {
  readonly exteriorWallIds: ReadonlySet<string>;
  readonly exteriorColumnIds: ReadonlySet<string>;
  readonly exteriorBeamIds: ReadonlySet<string>;
}

const EMPTY_MEMBERSHIP: ShellMembership = {
  exteriorWallIds: new Set(),
  exteriorColumnIds: new Set(),
  exteriorBeamIds: new Set(),
};

/**
 * Ποια στοιχεία ανήκουν στο μονωμένο κέλυφος — διαβασμένα ΑΠΕΥΘΕΙΑΣ από τα
 * `EnvelopeChain` ids του `computeEnvelopeShell` (footprint union + hole-gate +
 * per-element override). Αντικαθιστά το παλιό proximity heuristic: το footprint
 * ορίζει πλέον ρητά τη συμμετοχή (απλούστερο, SSoT, σέβεται αυτόματα τα overrides).
 * Στοιχείο εκτός κάθε chain → δεν μονώνεται. Mirror 2D/3D render — full parity.
 */
function buildShellMembership(
  walls: readonly WallForEnvelope[],
  columns: readonly ColumnForEnvelope[],
  beams: readonly BeamForFootprint[],
  spec: ThermalEnvelopeSpec,
  units: SceneUnits,
): ShellMembership {
  const overrides = collectEnvelopeOverrides([...walls, ...columns, ...beams]);
  const { chains } = computeEnvelopeShell(walls, columns, beams, spec, overrides, [], {
    sceneUnits: units,
  });
  return {
    exteriorWallIds: new Set(chains.flatMap((c) => c.wallIds)),
    exteriorColumnIds: new Set(chains.flatMap((c) => c.columnIds)),
    exteriorBeamIds: new Set(chains.flatMap((c) => c.beamIds ?? [])),
  };
}

// ============================================================================
// ASSIGNMENT COMPUTATION
// ============================================================================

function facadeLayer(spec: ThermalEnvelopeSpec, zone: EnvelopeZoneId): EnvelopeLayer {
  return { materialId: spec.materialId, thickness_m: spec.thickness_m, zone };
}

/**
 * Υπολογίζει την επιθυμητή κατάσταση μόνωσης ΟΛΩΝ των candidate στοιχείων του
 * ορόφου (όχι μόνο όσων αλλάζουν — το dequal-filtering γίνεται στο
 * `applyAssignmentsToEntities`). Pure.
 */
export function computeEnvelopeAssignments(
  spec: ThermalEnvelopeSpec,
  entities: readonly AnySceneEntity[],
  storeys: readonly StoreyRef[],
  sceneUnits?: SceneUnits,
): ElementEnvelopeAssignment[] {
  const walls = entities.filter(isWallEntity);
  const columns = entities.filter(isColumnEntity);
  const beams = entities.filter(isBeamEntity);
  const units = sceneUnits ?? walls[0]?.params.sceneUnits ?? 'mm';
  const needShell = spec.zones.Z1 || spec.zones.Z4;
  const ctx = needShell
    ? buildShellMembership(walls, columns, beams, spec, units)
    : EMPTY_MEMBERSHIP;

  const out: ElementEnvelopeAssignment[] = [];

  for (const e of entities) {
    if (isColumnEntity(e) || isBeamEntity(e)) {
      // Z1 κολώνας/δοκαριού: εξωτερικό ⟺ ανήκει στο footprint κέλυφος (chain ids).
      const want =
        spec.zones.Z1 && (ctx.exteriorColumnIds.has(e.id) || ctx.exteriorBeamIds.has(e.id));
      out.push({
        entityId: e.id,
        entityType: e.type,
        layer: want ? facadeLayer(spec, 'Z1') : undefined,
      });
    }
  }

  const slabs = entities.filter(isSlabEntity);
  const exposed = new Map(
    filterExposedSlabs(slabs as unknown as SlabForZoneClassification[], storeys).map(
      (r) => [(r.slab as unknown as { id: string }).id, r.zone] as const,
    ),
  );
  for (const slab of slabs) {
    const zone = exposed.get(slab.id);
    const want = zone !== undefined && spec.zones[zone];
    out.push({
      entityId: slab.id,
      entityType: 'slab',
      layer: want && zone ? facadeLayer(spec, zone) : undefined,
    });
  }

  for (const op of entities.filter(isOpeningEntity)) {
    const want = spec.zones.Z4 && ctx.exteriorWallIds.has(op.params.wallId);
    out.push({
      entityId: op.id,
      entityType: 'opening',
      reveal: want
        ? { materialId: spec.materialId, thickness_m: spec.revealThickness_m, zone: 'Z4' }
        : undefined,
    });
  }

  return out;
}

// ============================================================================
// APPLY (dequal-filtered patch)
// ============================================================================

/** Patch ενός optional param field· επιστρέφει το ίδιο entity αν δεν αλλάζει (dequal). */
function patchEntityField<T extends AnySceneEntity>(
  entity: T,
  field: 'envelopeLayer' | 'revealInsulation',
  value: EnvelopeLayer | undefined,
): T {
  // Μόνο BIM entities (column/beam/slab/opening) φτάνουν εδώ — assignment-gated
  // στον caller· όλα έχουν `params`. Type-safe narrowing (ΟΧΙ `any`).
  if (
    !isColumnEntity(entity) && !isBeamEntity(entity) &&
    !isSlabEntity(entity) && !isOpeningEntity(entity)
  ) {
    return entity;
  }
  const params = entity.params as unknown as Readonly<Record<string, unknown>>;
  if (dequal(params[field], value)) return entity;
  const nextParams: Record<string, unknown> = { ...params };
  if (value === undefined) delete nextParams[field];
  else nextParams[field] = value;
  return { ...entity, params: nextParams } as T;
}

/**
 * Εφαρμόζει τα assignments στα scene entities. Επιστρέφει το νέο entity array +
 * ΜΟΝΟ όσα entities πραγματικά άλλαξαν (`changed`) ώστε ο caller να persist-άρει
 * + audit-άρει + emit-άρει αποκλειστικά αυτά (zero περιττές εγγραφές). Pure.
 */
export function applyAssignmentsToEntities(
  entities: readonly AnySceneEntity[],
  assignments: readonly ElementEnvelopeAssignment[],
): { entities: AnySceneEntity[]; changed: AnySceneEntity[] } {
  const byId = new Map(assignments.map((a) => [a.entityId, a] as const));
  const changed: AnySceneEntity[] = [];
  const next = entities.map((e) => {
    const a = byId.get(e.id);
    if (!a) return e;
    const updated =
      a.entityType === 'opening'
        ? patchEntityField(e, 'revealInsulation', a.reveal)
        : patchEntityField(e, 'envelopeLayer', a.layer);
    if (updated !== e) changed.push(updated);
    return updated;
  });
  return { entities: next, changed };
}
