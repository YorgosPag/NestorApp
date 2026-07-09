/**
 * Opening doc → entity hydration + type guards.
 * Extracted from `useOpeningPersistence` to keep the hook under the 500-line
 * cap (CLAUDE.md N.7.1). Pure functions, no React state.
 */

import type { AnySceneEntity, SceneModel } from '../../types/entities';
import type { SceneWriteOrigin } from '../../hooks/scene/scene-write-origin';
import type { OpeningEntity } from '../types/opening-types';
import { isSelfHostedOpening } from '../types/opening-types';
import type { WallEntity } from '../types/wall-types';
import { computeOpeningGeometry } from '../geometry/opening-geometry';
import { selfOpeningHost } from '../geometry/opening-host';
import { validateOpeningParams } from '../validators/opening-validator';
import { inferOpeningIfcType } from '@/services/factories/opening.factory';
import { resolveSceneUnits, type SceneUnits } from '../../utils/scene-units';
// ADR-421 SLICE C — «type always wins» resolution at hydrate time.
import { resolveOpeningEffective, openingEntityDiffersFromDoc, type OpeningTypeLink } from '../family-types/opening-type-resolution';
import { resolveAutoOpeningTypeId } from '../family-types/auto-opening-type';
import type { OpeningDoc } from './opening-firestore-service';
import { mergeDocsIntoScene } from '../../hooks/data/merge-docs-into-scene';

export function isOpening(entity: AnySceneEntity): entity is OpeningEntity {
  return (entity as { type?: string }).type === 'opening';
}

export function isWall(entity: AnySceneEntity): entity is WallEntity {
  return (entity as { type?: string }).type === 'wall';
}

/**
 * Build a scene-side `OpeningEntity` από persisted `OpeningDoc` + host.
 *
 * WALL-HOSTED (`params.wallId` set): returns `null` όταν ο host wall δεν είναι
 * ακόμα στο scene — caller skips την snapshot entry μέχρι το επόμενο round-trip.
 *
 * SELF-HOSTED (ADR-615, `params.selfHost` set, no `wallId`): NEVER returns null
 * for a missing wall — synthesizes a straight host axis via `selfOpeningHost()`
 * (§Decision 1) and feeds the SAME `computeOpeningGeometry` engine. Without this
 * branch a free-standing κούφωμα hydrated to `null` on every Firestore snapshot →
 * vanished on reload (the host wall it never had could never be found).
 *
 * @param sceneUnits scene coordinate units — used ONLY for the self-hosted axis
 *   synthesis (wall-hosted derives units from `hostWall.params.sceneUnits`).
 */
export function openingDocToEntity(
  doc: OpeningDoc,
  hostWall: WallEntity | null,
  sceneUnits: SceneUnits = 'mm',
): OpeningEntity | null {
  const selfHosted = isSelfHostedOpening(doc.params);
  // Wall-hosted: the host wall MUST already be in the scene (retry next snapshot).
  // Self-hosted: no BIM wall exists — the host is synthesized below, never awaited.
  if (!selfHosted && !hostWall) return null;
  // ADR-421 SLICE C follow-up — auto-type-on-load (Revit «Generic»): a legacy
  // untyped opening whose nominal kind+width+height equal the kind default self-
  // links to the read-only built-in opening type on hydrate (custom-dimensioned
  // openings stay ad-hoc). Mirror of `wall-persistence-helpers.ts`
  // (`doc.typeId ?? resolveAutoWallTypeId`). For a built-in match the effective
  // params equal the cache → non-destructive (zero geometry change).
  const typeId = doc.typeId ?? resolveAutoOpeningTypeId(doc.params);
  // ADR-421 SLICE C — resolve EFFECTIVE params («type always wins») before any
  // derivation. Untyped/unresolved-type openings return their cached params
  // unchanged (legacy fast-path = zero regression). For typed openings the
  // type-governed fields (kind/width/height/frame/glazing) + re-derived
  // operationType flow in, so a stale drift-cache doc self-heals on hydrate.
  // `selfHost` (instance-level, outside OpeningTypeParams) survives the merge, so
  // a self-hosted opening stays self-hosted even after auto-type resolution.
  const params = resolveOpeningEffective(doc.params, {
    typeId,
    typeOverrides: doc.typeOverrides,
  });
  const typeResolved = params !== doc.params;
  // ADR-615 §Decision 1 — one geometry/validation engine, two host providers.
  // Self-hosted → synthetic straight axis; wall-hosted → the real WallEntity.
  const host = selfHosted ? selfOpeningHost(params, sceneUnits) : hostWall!;
  const units = selfHosted ? sceneUnits : (hostWall!.params.sceneUnits ?? 'mm');
  const validation = (!typeResolved && doc.geometry ? doc.validation : undefined)
    ?? validateOpeningParams(params, selfHosted ? null : hostWall).bimValidation;
  // ADR-363 §5.4 — `params.kind` is the SINGLE source of truth; top-level `kind`
  // (+ `ifcType`) are DERIVED mirrors. Legacy docs whose top-level `doc.kind`
  // diverged self-heal here.
  const kind = params.kind;
  return {
    id: doc.id,
    type: 'opening',
    kind,
    layerId: doc.layerId ?? '0',
    params,
    // Reuse the cached geometry only for untyped docs (params unchanged); typed
    // openings recompute from the resolved (type-governed) params.
    geometry:
      !typeResolved && doc.geometry
        ? doc.geometry
        : computeOpeningGeometry(params, host, units),
    validation,
    ifcType: inferOpeningIfcType(kind),
    visible: true,
    // `typeId` carries the auto-resolved built-in id for legacy untyped openings
    // (self-heal migration), so they gain «Edit Type» + read-only type-gating.
    ...(typeId !== undefined && { typeId }),
    ...(doc.typeOverrides !== undefined && { typeOverrides: doc.typeOverrides }),
  } as OpeningEntity;
}

/** Minimal level-manager surface used by the opening snapshot merge. */
export interface OpeningMergeLevelManager {
  getLevelScene(levelId: string): SceneModel | null;
  setLevelScene(levelId: string, scene: SceneModel, origin?: SceneWriteOrigin): void;
}

/**
 * Per-snapshot merge context built once by `prepareContext`: the host-wall
 * lookup (wall-hosted openings) + the resolved scene units (ADR-615 self-hosted
 * axis synthesis). Replaces the bare `Map<string, WallEntity>` context so the
 * self-hosted branch can synthesize its host without a wall.
 */
interface OpeningMergeContext {
  readonly wallsById: Map<string, WallEntity>;
  readonly sceneUnits: SceneUnits;
}

/** Mutable bookkeeping the opening snapshot merge consults (owned by hook refs). */
export interface OpeningMergeRefs {
  readonly dirty: Set<string>;
  readonly deleted: Set<string>;
  readonly pending: Set<string>;
  readonly lastSavedParams: Map<string, OpeningEntity['params']>;
  readonly lastSavedLink: Map<string, OpeningTypeLink>;
}

/**
 * Diff-merge a Firestore opening snapshot into the active scene (host-aware
 * hydration + selective skip of dirty/pending). Thin opening adapter πάνω από το
 * `mergeDocsIntoScene` SSoT (μηδέν copy-pasted loop):
 *   - `prepareContext` = build του host-wall lookup μία φορά (walls μένουν στα
 *     `others` αυτόματα, αφού `isOpening(wall) === false`).
 *   - `docToEntity → null` = ADR-440 host-wall lookup: αν ο host wall δεν είναι
 *     ακόμα στο scene, ο generic κάνει skip (retry στο επόμενο snapshot).
 *   - `differs` = `openingEntityDiffersFromDoc` (ADR-421 «type always wins»).
 *   - `seedExtraBaseline` = seed του δεύτερου `lastSavedLink` map.
 *   - `shouldDropOrphan` = deleted-wins (ADR-390).
 */
export function mergeOpeningDocsIntoScene(
  docs: readonly OpeningDoc[],
  levelId: string,
  lm: OpeningMergeLevelManager,
  refs: OpeningMergeRefs,
): void {
  mergeDocsIntoScene<OpeningDoc, OpeningEntity, OpeningEntity['params'], OpeningMergeContext>(
    docs,
    levelId,
    lm,
    {
      isEntity: isOpening,
      prepareContext: (scene) => {
        const wallsById = new Map<string, WallEntity>();
        for (const e of scene.entities) if (isWall(e)) wallsById.set(e.id, e);
        // ADR-615 — sceneUnits resolved once per snapshot (self-hosted axis synth).
        return { wallsById, sceneUnits: resolveSceneUnits(scene) };
      },
      // ADR-615 — self-hosted openings have no `wallId`: skip the (undefined) wall
      // lookup and hydrate them via the synthetic host, so they survive reload.
      docToEntity: (doc, _existing, ctx) =>
        isSelfHostedOpening(doc.params)
          ? openingDocToEntity(doc, null, ctx.sceneUnits)
          : openingDocToEntity(doc, ctx.wallsById.get(doc.params.wallId ?? '') ?? null, ctx.sceneUnits),
      entityComparable: (e) => e.params, // unused (differs override provided)
      docComparable: (d) => d.params, // baseline seed = raw cached doc.params
      differs: (existing, doc) => openingEntityDiffersFromDoc(existing, doc),
      seedExtraBaseline: (doc) => {
        // ADR-421 SLICE C — track the persisted Family/Type link too.
        if (!refs.lastSavedLink.has(doc.id)) {
          refs.lastSavedLink.set(doc.id, { typeId: doc.typeId, typeOverrides: doc.typeOverrides });
        }
      },
      shouldDropOrphan: (id, r) =>
        r.deleted.has(id) || (!r.dirty.has(id) && !r.pending.has(id)),
    },
    {
      dirty: refs.dirty,
      deleted: refs.deleted,
      pending: refs.pending,
      isWithinGrace: () => false, // opening has no write-grace in the original loop
      lastSavedBaseline: refs.lastSavedParams,
    },
  );
}
