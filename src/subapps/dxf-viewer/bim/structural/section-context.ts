/**
 * Entity → structural section-context SSoT (ADR-459 Phase 4d).
 *
 * ΕΝΑ μέρος που χτίζει το `…SectionContext` (mm/mm²) που χρειάζονται οι code
 * providers (limits + suggest) ΑΠΟ μια δομική οντότητα (κολόνα / δοκάρι / πέδιλο).
 * Πριν το Φ4d ο column builder ζούσε inline στο ribbon bridge (`column-structural-
 * bridge.ts`)· εδώ εξάγεται (boy-scout, N.0.2) ώστε να τον μοιράζονται ΚΑΙ ο
 * bridge, ΚΑΙ τα reinforcement διαγνωστικά (`organism/reinforcement-checks.ts`),
 * ΚΑΙ το `AutoReinforceOrganismCommand` — μηδέν duplicate.
 *
 * geometry-is-SSoT: όλα τα μεγέθη παράγονται από `params` (+ `geometry` cache).
 * Pure — zero React/DOM/Firestore. Όλες οι μετρήσεις σε mm (Nestor convention).
 *
 * @see ./codes/structural-code-types.ts — τα SectionContext schemas
 * @see ./codes/suggest-reinforcement.ts — οι suggesters που τα καταναλώνουν
 * @see docs/centralized-systems/reference/adrs/ADR-459-structural-organism-connectivity.md §Phase 4d
 */

import type { Entity } from '../../types/entities';
import { isColumnEntity, isBeamEntity, isFoundationEntity, isSlabEntity } from '../../types/entities';
import type { ColumnEntity, ColumnParams } from '../types/column-types';
import type { BeamEntity, BeamParams } from '../types/beam-types';
import type { FoundationEntity, FoundationParams } from '../types/foundation-types';
import type { SlabEntity, SlabParams } from '../types/slab-types';
import { mmToSceneUnits } from '../../utils/scene-units';
import { resolveColumnReinforcementSection } from './reinforcement/column-section-outline';
import type {
  BeamSectionContext,
  ColumnSectionContext,
  FootingSectionContext,
  SlabFoundationSectionContext,
  StructuralCodeProvider,
} from './codes/structural-code-types';

const M_TO_MM = 1000;

/** True αν η πλάκα είναι εδαφόπλακα/raft (kind foundation/ground) — δέχεται οπλισμό. */
export function isFoundationSlabEntity(e: Entity): e is SlabEntity {
  return isSlabEntity(e) && (e.kind === 'foundation' || e.kind === 'ground');
}

/** Μήκος άξονα (mm) από δύο σημεία mm-world (πεδιλοδοκός/συνδετήρια). */
function axisLengthMm(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * Κολόνα → `ColumnSectionContext`. shape-aware (ADR-460): bbox dims + ελάχιστο
 * πάχος/μέγιστη διάσταση/περίμετρος/mode από το ΕΝΑ `resolveColumnReinforcementSection`
 * → δουλεύει ορθά σε ορθογ./κυκλική/τοίχωμα. (SSoT — πρώην inline στο
 * `column-structural-bridge`· εξήχθη εδώ, N.0.2.)
 */
export function buildColumnSectionContext(column: ColumnEntity): ColumnSectionContext {
  const section = resolveColumnReinforcementSection(column.params);
  return {
    widthMm: section.bboxWidthMm,
    depthMm: section.bboxDepthMm,
    heightMm: column.params.height,
    grossAreaMm2: section.grossAreaMm2,
    minThicknessMm: section.minThicknessMm,
    maxDimensionMm: section.maxDimensionMm,
    perimeterMm: section.perimeterMm,
    mode: section.mode,
  };
}

/**
 * Δοκάρι → `BeamSectionContext`. Το άνοιγμα = γεωμετρικό μήκος άξονα (m→mm,
 * curve-aware). `supportType` default 'simple' (απών = αμφιέρειστη).
 */
export function buildBeamSectionContext(beam: BeamEntity): BeamSectionContext {
  const p = beam.params;
  const spanMm = beam.geometry.length * M_TO_MM;
  return {
    widthMm: p.width,
    depthMm: p.depth,
    spanMm,
    grossAreaMm2: Math.max(0, p.width) * Math.max(0, p.depth),
    supportType: p.supportType ?? 'simple',
  };
}

/**
 * Πέδιλο/πεδιλοδοκός/συνδετήρια → discriminated `FootingSectionContext`. pad =
 * ορθογώνιο ίχνος width×length· strip/tie-beam = band πλάτους width κατά τον
 * άξονα start→end (tie-beam ΕΙΝΑΙ δοκός → reuse beam ctx fields).
 */
export function buildFootingSectionContext(footing: FoundationEntity): FootingSectionContext {
  const p = footing.params;
  switch (p.kind) {
    case 'pad':
      return {
        kind: 'pad',
        widthMm: p.width,
        lengthMm: p.length,
        thicknessMm: p.thicknessMm,
        grossAreaMm2: Math.max(0, p.width) * Math.max(0, p.length),
      };
    case 'strip':
      return {
        kind: 'strip',
        widthMm: p.width,
        thicknessMm: p.thicknessMm,
        spanMm: axisLengthMm(p.start, p.end),
      };
    case 'tie-beam':
      return {
        kind: 'tie-beam',
        widthMm: p.width,
        depthMm: p.thicknessMm,
        spanMm: axisLengthMm(p.start, p.end),
        grossAreaMm2: Math.max(0, p.width) * Math.max(0, p.thicknessMm),
        supportType: 'simple',
      };
  }
}

/**
 * Εδαφόπλακα/raft → `SlabFoundationSectionContext`. bbox dims από το `outline`
 * (canvas units → mm μέσω `sceneUnits`, geometry-is-SSoT — όπως ο graph footprint).
 * Οι σχάρες τρέχουν στο περιβάλλον ορθογώνιο (πλακοειδής σύμβαση).
 */
export function buildSlabFoundationSectionContext(slab: SlabEntity): SlabFoundationSectionContext {
  const perScene = mmToSceneUnits(slab.params.sceneUnits ?? 'mm');
  const verts = slab.params.outline.vertices;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const v of verts) {
    if (v.x < minX) minX = v.x;
    if (v.x > maxX) maxX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.y > maxY) maxY = v.y;
  }
  const widthMm = verts.length > 0 ? (maxX - minX) / perScene : 0;
  const lengthMm = verts.length > 0 ? (maxY - minY) / perScene : 0;
  return {
    widthMm,
    lengthMm,
    thicknessMm: slab.params.thickness,
    grossAreaMm2: Math.max(0, widthMm) * Math.max(0, lengthMm),
  };
}

/** Params οποιουδήποτε δομικού μέλους που δέχεται οπλισμό. */
export type ReinforceableParams = ColumnParams | BeamParams | FoundationParams | SlabParams;

/**
 * Patch params ενός μέλους για auto-reinforce. `prev` = τα τρέχοντα params
 * (ΧΩΡΙΣ κλειδί `reinforcement` — idempotent skip το εγγυάται)· `next` = με το
 * code-suggested `reinforcement`. Το `prev` κρατιέται αυτούσιο (ΟΧΙ explicit
 * `reinforcement: undefined`) ώστε το undo→persist να μη σπάει το Firestore.
 */
export interface ReinforcePatch {
  readonly prev: ReinforceableParams;
  readonly next: ReinforceableParams;
}

/**
 * Code-suggested ελάχιστος-έγκυρος οπλισμός → `{prev, next}` patch (SSoT dispatcher
 * κολόνα/δοκάρι/πέδιλο). Επιστρέφει `null` αν το entity δεν είναι δομικό μέλος **ή**
 * έχει ήδη οπλισμό (idempotent). Geometry-neutral — additive, δεν αλλάζει διαστάσεις.
 */
export function buildReinforcePatch(
  entity: Entity,
  provider: StructuralCodeProvider,
): ReinforcePatch | null {
  if (isColumnEntity(entity)) {
    if (entity.params.reinforcement) return null;
    const r = provider.suggestColumnReinforcement(buildColumnSectionContext(entity));
    return { prev: entity.params, next: { ...entity.params, reinforcement: r } };
  }
  if (isBeamEntity(entity)) {
    if (entity.params.reinforcement) return null;
    const r = provider.suggestBeamReinforcement(buildBeamSectionContext(entity));
    return { prev: entity.params, next: { ...entity.params, reinforcement: r } };
  }
  if (isFoundationEntity(entity)) return buildFoundationReinforcePatch(entity, provider);
  if (isFoundationSlabEntity(entity)) {
    if (entity.params.structuralReinforcement) return null;
    const r = provider.suggestSlabFoundationReinforcement(buildSlabFoundationSectionContext(entity));
    return { prev: entity.params, next: { ...entity.params, structuralReinforcement: r } };
  }
  return null;
}

/**
 * Foundation per-kind narrowing — το `suggestFootingReinforcement` επιστρέφει
 * discriminated `FootingReinforcement`· ο discriminator ταιριάζει με το ctx (άρα
 * με το `params.kind`), αλλά ο compiler το διασφαλίζει ρητά (μηδέν cast, N.2).
 */
function buildFoundationReinforcePatch(
  footing: FoundationEntity,
  provider: StructuralCodeProvider,
): ReinforcePatch | null {
  const p = footing.params;
  if (p.reinforcement) return null;
  const r = provider.suggestFootingReinforcement(buildFootingSectionContext(footing));
  switch (p.kind) {
    case 'pad':
      return r.kind === 'pad' ? { prev: p, next: { ...p, reinforcement: r } } : null;
    case 'strip':
      return r.kind === 'strip' ? { prev: p, next: { ...p, reinforcement: r } } : null;
    case 'tie-beam':
      return r.kind === 'tie-beam' ? { prev: p, next: { ...p, reinforcement: r } } : null;
  }
}
