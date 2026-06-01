/**
 * BIM Copy Builder — clones BIM entities with kind-specific enterprise IDs
 * and host-reference rewiring (SSoT).
 *
 * ADR-363 Phase 7.2 — Transform BIM (Copy).
 *
 * Responsibilities:
 *
 *   1. **ID regeneration (SOS N.6)** — every clone gets a kind-specific
 *      enterprise ID + a fresh IFC GlobalId via the shared `mintBimCloneIdentity`
 *      SSoT (`bim-clone-persistence`). Inline UUID / timestamp IDs forbidden.
 *
 *   2. **Host rewire** — when a copied opening's host wall is ALSO in the
 *      selection, the clone opening's `wallId` is remapped to the clone wall.
 *      Same for slab-opening → slab. If the host is NOT in the selection, the
 *      clone keeps the original `hostId` (the copy lives on the same host).
 *
 *   3. **Transform application** — sources are first transformed (translate /
 *      mirror / rotate) via the existing Phase 7.1/7.2 SSoTs
 *      (`bim-move-geometry`, `bim-mirror-geometry`, `bim-rotate-geometry`),
 *      ensuring geometry is atomically recomputed.
 *
 *   4. **Per-type Firestore writes** — NOT handled here. The clones are
 *      returned as `SceneEntity[]`; the caller adds them to the scene AND must
 *      broadcast `drawing:entity-created` per clone (`BimCopyCommand` does this
 *      via `bim-clone-persistence`). A fresh enterprise ID alone is NOT enough —
 *      the `use*Persistence` subscription drops any scene entity it has no doc /
 *      dirty / pending record for on the next snapshot (ADR-363 §7.2).
 *
 * Pure function — no React, no IO. Imported by `BimCopyCommand`.
 *
 * @see bim/utils/bim-move-geometry.ts
 * @see bim/transforms/bim-mirror-geometry.ts
 * @see bim/transforms/bim-rotate-geometry.ts
 */
import type { ISceneManager, SceneEntity } from '../../core/commands/interfaces';
import type { Point2D } from '../../rendering/types/Types';
import type { Entity, EntityType } from '../../types/entities';
import type { MirrorAxis } from '../../utils/mirror-math';
import { calculateBimMovedGeometry } from '../utils/bim-move-geometry';
import { calculateBimMirroredGeometry } from './bim-mirror-geometry';
import { calculateBimRotatedGeometry } from './bim-rotate-geometry';
// N.0.2 — kind-specific enterprise ID + fresh IFC GlobalId minting is the shared
// clone-identity SSoT (was a duplicate ID_GENERATORS map here before).
import { mintBimCloneIdentity } from './bim-clone-persistence';

// ─── Public types ───────────────────────────────────────────────────────────

/** Transform applied to each source before cloning. */
export type BimCopyTransform =
  | { readonly kind: 'translate'; readonly delta: Point2D }
  | { readonly kind: 'mirror'; readonly axis: MirrorAxis }
  | { readonly kind: 'rotate'; readonly pivot: Point2D; readonly angleDeg: number };

export interface BimCopyResult {
  /** New entities to add to the scene (kind-specific IDs, transformed params). */
  readonly clones: readonly SceneEntity[];
  /** `sourceId` → `cloneId`. Used by callers that need to highlight the result selection. */
  readonly sourceToCloneId: ReadonlyMap<string, string>;
  /** Source IDs that were skipped (entity missing, non-BIM, or unsupported kind). */
  readonly skipped: readonly string[];
}

// ─── Transform dispatch ─────────────────────────────────────────────────────

function applyTransform(
  entity: Entity,
  transform: BimCopyTransform,
): Partial<SceneEntity> | null {
  switch (transform.kind) {
    case 'translate':
      return calculateBimMovedGeometry(entity, transform.delta);
    case 'mirror':
      return calculateBimMirroredGeometry(entity, transform.axis);
    case 'rotate':
      return calculateBimRotatedGeometry(entity, transform.pivot, transform.angleDeg);
  }
}

// ─── Host rewire ────────────────────────────────────────────────────────────

/**
 * Rewires `wallId` (opening) and `slabId` (slab-opening) on a clone whose host
 * is ALSO in the source-to-clone map. Returns the input clone unchanged if the
 * host is not in scope (clone lives on the original host).
 */
function rewireHost(
  clone: SceneEntity,
  sourceToCloneId: ReadonlyMap<string, string>,
): SceneEntity {
  const type = clone.type as EntityType;

  if (type === 'opening') {
    const params = (clone as unknown as { params?: { wallId?: string } }).params;
    const originalWallId = params?.wallId;
    if (!originalWallId) return clone;
    const cloneWallId = sourceToCloneId.get(originalWallId);
    if (!cloneWallId) return clone;
    return {
      ...clone,
      params: { ...params, wallId: cloneWallId },
    } as unknown as SceneEntity;
  }

  if (type === 'slab-opening') {
    const params = (clone as unknown as { params?: { slabId?: string } }).params;
    const originalSlabId = params?.slabId;
    if (!originalSlabId) return clone;
    const cloneSlabId = sourceToCloneId.get(originalSlabId);
    if (!cloneSlabId) return clone;
    return {
      ...clone,
      params: { ...params, slabId: cloneSlabId },
    } as unknown as SceneEntity;
  }

  return clone;
}

// ─── Top-level builder ──────────────────────────────────────────────────────

/**
 * Builds clone entities for the given source IDs by applying `transform` and
 * regenerating kind-specific enterprise IDs. Host references (wallId / slabId)
 * are rewired when their hosts are also in the source set.
 *
 * The clones are NOT added to the scene by this function — caller's choice
 * (typically wrapped in a `BimCopyCommand` for undo/redo).
 */
export function buildBimCopyClones(
  ids: readonly string[],
  transform: BimCopyTransform,
  sceneManager: ISceneManager,
): BimCopyResult {
  const clones: SceneEntity[] = [];
  const sourceToCloneId = new Map<string, string>();
  const skipped: string[] = [];

  // Pass 1 — build clones with new IDs. Build source→clone map for pass 2.
  for (const id of ids) {
    const source = sceneManager.getEntity(id);
    if (!source) { skipped.push(id); continue; }

    // Fresh per-type enterprise ID + NEW IFC GlobalId (null ⇒ non-BIM → skip).
    const identity = mintBimCloneIdentity(source.type);
    if (identity === null) { skipped.push(id); continue; }

    const patch = applyTransform(source as unknown as Entity, transform);
    if (patch === null) { skipped.push(id); continue; }

    sourceToCloneId.set(id, identity.id);

    const clone: SceneEntity = {
      ...source,
      ...patch,
      id: identity.id,
      ifcGuid: identity.ifcGuid,
    } as unknown as SceneEntity;
    clones.push(clone);
  }

  // Pass 2 — rewire opening.wallId / slab-opening.slabId for clones whose
  // hosts are also in the selection.
  const rewired = clones.map((c) => rewireHost(c, sourceToCloneId));

  return {
    clones: rewired,
    sourceToCloneId,
    skipped,
  };
}
