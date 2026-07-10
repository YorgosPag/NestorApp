/**
 * ADR-363 Phase 3.7 — Pure builders για slab-opening entity creation.
 *
 * SSoT:
 *   - IDs via `generateSlabOpeningId()` (SOS N.6 enterprise-id, ADR-017/210/294).
 *   - Geometry via `computeSlabOpeningGeometry()` — pure function, SSoT για
 *     polygon / area / perimeter / bbox.
 *   - Validation via `validateSlabOpeningParams()` — hardErrors block; code
 *     violations surface ως red badge.
 *   - Types via `bim/types/slab-opening-types.ts`.
 *
 * Click-to-place flow (Phase 3.7):
 *   - User επιλέγει host slab (state: awaitingHostSlab).
 *   - Δεύτερο click ορίζει κέντρο cutout — rectangular default ανά kind.
 *   - Outline auto-clamped εντός slab footprint όταν το rectangle "βγαίνει
 *     παραέξω" (simple bbox shift, validator πιάνει τα υπόλοιπα).
 *
 * Scene-units (ADR-370): default rectangle size είναι mm-baked
 * (`SLAB_OPENING_DEFAULT_SIZES`). Όταν το active scene δηλώνει m/cm/in/ft, ο
 * builder converts width/depth στις scene units πριν φτιάξει το polygon, ώστε
 * η οπή να μην βγει σε άλλη κλίμακα από το host slab (mirror του
 * `slab-completion` Phase 8 fix).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.5 §11.Q3
 * @see docs/centralized-systems/reference/adrs/ADR-370-bim-readonly-visualization.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { BimValidation, Point3D, Polygon3D } from '../../bim/types/bim-base';
import type {
  SlabOpeningEntity,
  SlabOpeningKind,
  SlabOpeningParams,
} from '../../bim/types/slab-opening-types';
import { SLAB_OPENING_DEFAULT_SIZES } from '../../bim/types/slab-opening-types';
import type { SlabEntity } from '../../bim/types/slab-types';
import { computeSlabOpeningGeometry } from '../../bim/geometry/slab-opening-geometry';
import { validateSlabOpeningParams } from '../../bim/validators/slab-opening-validator';
import { generateSlabOpeningId } from '@/services/enterprise-id-convenience';
import { detectSceneUnits, mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';

export type { SceneUnits };

// ─── Param overrides accepted by the builder ────────────────────────────────

/**
 * Field overrides για `buildDefaultSlabOpeningParams`. Ribbon contextual
 * panel (Phase 3.7b) τροφοδοτεί kind / width / depth / fireRating.
 */
export interface SlabOpeningParamOverrides {
  readonly kind?: SlabOpeningKind;
  /** mm — rectangle width across X. */
  readonly width?: number;
  /** mm — rectangle depth across Y. */
  readonly depth?: number;
  readonly elevationOverride?: number;
  readonly fireRating?: SlabOpeningParams['fireRating'];
  readonly material?: SlabOpeningParams['material'];
  readonly multiStoreyStackGroupId?: string;
}

// ─── Defaults factory ───────────────────────────────────────────────────────

/**
 * Build `SlabOpeningParams` από host slab + anchor click + optional overrides.
 *
 * Algorithm:
 *   1. Resolve kind (override → 'shaft' default).
 *   2. Resolve rect size από `SLAB_OPENING_DEFAULT_SIZES[kind]` (overrides win).
 *   3. Convert width/depth (mm) → scene-units πολλαπλασιάζοντας με
 *      `mmToSceneUnits(sceneUnits)` — anchorPoint είναι ήδη σε scene-units.
 *   4. Build rectangular outline centered στο `anchorPoint` (CCW).
 *   5. Πρόσθεση optional overrides (fireRating, elevationOverride, ...) +
 *      propagation του `sceneUnits` ώστε geometry/validator να ξέρουν την
 *      κλίμακα των vertices.
 */
export function buildDefaultSlabOpeningParams(
  hostSlab: SlabEntity,
  anchorPoint: Readonly<Point2D>,
  overrides: SlabOpeningParamOverrides = {},
  sceneUnits: SceneUnits = 'mm',
): SlabOpeningParams {
  const kind = overrides.kind ?? 'shaft';
  const defaults = SLAB_OPENING_DEFAULT_SIZES[kind];
  const widthMm = overrides.width ?? defaults.width;
  const depthMm = overrides.depth ?? defaults.depth;

  // Priority για το coordinate system του cutout (most → least reliable):
  //   1. host slab's frozen `sceneUnits` — εγγυάται ίδιο coordinate space με
  //      το slab outline που τρυπάμε.
  //   2. caller-provided `sceneUnits` από resolveSceneUnits(scene).
  //   3. bounds heuristic πάνω στο host slab bbox — σώζει legacy docs που
  //      δεν έχουν sceneUnits αλλά έχουν αξιόπιστα coords.
  //   4. 'mm' default.
  const effectiveUnits: SceneUnits =
    hostSlab.params.sceneUnits
    ?? sceneUnits
    ?? inferUnitsFromBbox(hostSlab)
    ?? 'mm';

  const mmFactor = mmToSceneUnits(effectiveUnits);
  const widthScene = widthMm * mmFactor;
  const depthScene = depthMm * mmFactor;

  const outline = buildRectangleCcw(anchorPoint, widthScene, depthScene);

  const params: SlabOpeningParams = {
    kind,
    slabId: hostSlab.id,
    outline,
    sceneUnits: effectiveUnits,
    ...(overrides.elevationOverride !== undefined
      ? { elevationOverride: overrides.elevationOverride }
      : {}),
    ...(overrides.multiStoreyStackGroupId !== undefined
      ? { multiStoreyStackGroupId: overrides.multiStoreyStackGroupId }
      : {}),
    ...(overrides.fireRating !== undefined ? { fireRating: overrides.fireRating } : {}),
    ...(overrides.material !== undefined ? { material: overrides.material } : {}),
  };
  return params;
}

// ─── Entity builder ─────────────────────────────────────────────────────────

export type BuildSlabOpeningEntityResult =
  | { readonly ok: true; readonly entity: SlabOpeningEntity }
  | { readonly ok: false; readonly hardErrors: readonly string[] };

/** Hard-error i18n key για outline εκτός host slab — το ΜΟΝΟ preview-tolerable. */
const OUTLINE_OUTSIDE_SLAB_KEY = 'slabOpening.validation.hardErrors.outlineOutsideSlab';

/**
 * Assemble the final `SlabOpeningEntity` από validated params + geometry (SSoT
 * `computeSlabOpeningGeometry`) + enterprise id. Shared από τον strict commit
 * builder (`buildSlabOpeningEntity`) ΚΑΙ τον preview-tolerant builder
 * (`buildSlabOpeningPreviewEntity`) → μηδέν διπλότυπη construction (N.0.2).
 */
function assembleSlabOpeningEntity(
  params: Readonly<SlabOpeningParams>,
  layerId: string,
  bimValidation: BimValidation,
  idOverride?: string,
): SlabOpeningEntity {
  return {
    // ADR-632 Φ5 — auto stairwell openings περνούν deterministic-stable id (σταθερό ανά
    // (autoStairId, slabId)) ώστε undo→redo να μην αλλάζει doc id· χειροκίνητα → random.
    id: idOverride ?? generateSlabOpeningId(),
    type: 'slab-opening',
    kind: params.kind,
    layerId,
    params,
    geometry: computeSlabOpeningGeometry(params),
    validation: bimValidation,
    visible: true,
  };
}

/**
 * Build `SlabOpeningEntity` από `SlabOpeningParams + hostSlab`. Geometry
 * recomputed via SSoT pure functions. Hard errors short-circuit creation.
 *
 * `idOverride` (ADR-632 Φ5): deterministic id για derived/managed openings (auto
 * stairwell). Απόν → random enterprise id (χειροκίνητο placement, αμετάβλητη συμπεριφορά).
 */
export function buildSlabOpeningEntity(
  params: Readonly<SlabOpeningParams>,
  hostSlab: SlabEntity,
  layerId: string,
  idOverride?: string,
): BuildSlabOpeningEntityResult {
  const validation = validateSlabOpeningParams(params, hostSlab);
  if (validation.hardErrors.length > 0) {
    return { ok: false, hardErrors: validation.hardErrors };
  }
  return { ok: true, entity: assembleSlabOpeningEntity(params, layerId, validation.bimValidation, idOverride) };
}

// ─── Preview-tolerant builder (ADR-574 Σ2b) ─────────────────────────────────

export interface SlabOpeningPreviewBuild {
  readonly entity: SlabOpeningEntity;
  /** True όταν το outline βγαίνει εκτός host slab → preview δείχνει 🔴 schematic. */
  readonly isOutsideSlab: boolean;
}

/**
 * Preview-tolerant build (ADR-574 Σ2b): ΙΔΙΟ geometry pipeline με το commit
 * (`buildSlabOpeningEntity`) — ίδιοι `params`/`geometry`/`validator` SSoT — αλλά
 * ΔΕΝ κάνει hard-reject στο `outlineOutsideSlab`, ώστε το placement ghost ΠΟΤΕ να
 * μην εξαφανίζεται στις άκρες της πλάκας (big-player: Revit δείχνει το opening +
 * warning, δεν το σβήνει). Κάθε ΑΛΛΟ hard error (self-intersecting / zero-area /
 * missing host) → `null` (τίποτα valid προς ζωγράφισμα). PREVIEW-ONLY — ο commit
 * μένει strict μέσω `buildSlabOpeningEntity`.
 */
export function buildSlabOpeningPreviewEntity(
  params: Readonly<SlabOpeningParams>,
  hostSlab: SlabEntity,
  layerId: string,
): SlabOpeningPreviewBuild | null {
  const validation = validateSlabOpeningParams(params, hostSlab);
  const blocking = validation.hardErrors.filter((k) => k !== OUTLINE_OUTSIDE_SLAB_KEY);
  if (blocking.length > 0) return null;
  const entity = assembleSlabOpeningEntity(params, layerId, validation.bimValidation);
  return { entity, isOutsideSlab: validation.hardErrors.includes(OUTLINE_OUTSIDE_SLAB_KEY) };
}

// ─── Click-to-place completion helper ───────────────────────────────────────

/**
 * High-level convenience bridging tool state machine + builder pipeline.
 * Returns fully-formed entity ή validator error list. Pure — no side effects.
 */
export function completeSlabOpeningFromClick(
  hostSlab: SlabEntity,
  anchorPoint: Readonly<Point2D>,
  layerId: string,
  overrides: SlabOpeningParamOverrides = {},
  sceneUnits: SceneUnits = 'mm',
): BuildSlabOpeningEntityResult {
  const params = buildDefaultSlabOpeningParams(hostSlab, anchorPoint, overrides, sceneUnits);
  return buildSlabOpeningEntity(params, hostSlab, layerId);
}

// ─── Internal helpers ───────────────────────────────────────────────────────

/**
 * Bounds-diagonal heuristic — όταν το host slab δεν φέρει `sceneUnits` (legacy
 * Firestore doc), η μαγνητούδα του bbox δίνει αξιόπιστη ένδειξη της κλίμακας:
 * ένα slab 5×5m έχει diagonal ≈ 7 σε `'m'`, ≈ 707 σε `'cm'`, ≈ 7070 σε `'mm'`.
 * Επιστρέφει `null` όταν bbox άκυρο — caller πέφτει στο `'mm'` default.
 */
function inferUnitsFromBbox(hostSlab: SlabEntity): SceneUnits | null {
  const bb = hostSlab.geometry?.bbox;
  if (!bb) return null;
  const dx = bb.max.x - bb.min.x;
  const dy = bb.max.y - bb.min.y;
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || dx <= 0 || dy <= 0) return null;
  return detectSceneUnits({ min: { x: bb.min.x, y: bb.min.y }, max: { x: bb.max.x, y: bb.max.y } });
}

/**
 * Build axis-aligned rectangle (CCW) centered στο anchor. Vertices στις
 * ίδιες units με το `anchor` + `width`/`depth` (caller responsible για
 * conversion από mm-baked defaults). Order: bottom-left → bottom-right →
 * top-right → top-left.
 */
function buildRectangleCcw(
  center: Readonly<Point2D>,
  width: number,
  depth: number,
): Polygon3D {
  const halfW = width / 2;
  const halfD = depth / 2;
  const vertices: Point3D[] = [
    { x: center.x - halfW, y: center.y - halfD, z: 0 },
    { x: center.x + halfW, y: center.y - halfD, z: 0 },
    { x: center.x + halfW, y: center.y + halfD, z: 0 },
    { x: center.x - halfW, y: center.y + halfD, z: 0 },
  ];
  return { vertices };
}
