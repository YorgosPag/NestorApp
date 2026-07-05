/**
 * ADR-534 — Orchestrator για την «Αυτόματη πλάκα οροφής ανά φάτνωμα» (member-based).
 *
 * Γέφυρα ανάμεσα στον pure builder (`ceiling-slab-from-structure.ts`) και στο command history.
 * **Idempotent create** (ξανα-πάτημα = no-op): παραλείπει φατνώματα που ήδη καλύπτονται από
 * `ceiling` πλάκα (κέντρο νέου φατνώματος μέσα σε υπάρχουσα). Mirror του `commitSlabBaysFromGuides`
 * (`slab-grid-commit.ts`), αλλά **χωρίς guide bindings** (member-based) → idempotency by centroid.
 *
 * @see ./ceiling-slab-from-structure.ts — pure builder (target)
 * @see ./slab-grid-commit.ts — grid πρότυπο (commitSlabBaysFromGuides)
 * @see docs/centralized-systems/reference/adrs/ADR-534-auto-ceiling-slab-per-bay.md
 */

import type { ICommand } from '../../core/commands/interfaces';
import type { SceneModel } from '../../types/scene';
import { createLevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import { CreateSlabsCommand } from '../../core/commands/entity-commands/CreateSlabsCommand';
import { isSlabEntity } from '../../types/entities';
import type { SlabEntity } from '../types/slab-types';
import type { SlabParamOverrides } from '../../hooks/drawing/slab-completion';
import type { SceneUnits } from '../../utils/scene-units';
import { polygonCentroid, projectVerticesTo2D } from '../geometry/shared/polygon-utils';
import { isPointInPolygon } from '../../utils/geometry/GeometryUtils';
import { buildCeilingSlabsFromStructure } from './ceiling-slab-from-structure';
import { resolveStructuralCode } from '../structural/codes';
import { useStructuralSettingsStore } from '../../state/structural-settings-store';
import { suggestCeilingBayThickness } from './ceiling-bay-thickness';

export interface CeilingSlabCommitDeps {
  readonly getLevelScene: (levelId: string) => SceneModel | null;
  readonly setLevelScene: (levelId: string, scene: SceneModel) => void;
  readonly levelId: string;
  readonly sceneUnits: SceneUnits;
  readonly executeCommand: (command: ICommand) => void;
  /** Προαιρετικά param overrides (πάχος/levelElevation — Φ1: defaults + flush top). */
  readonly overrides?: SlabParamOverrides;
}

export interface CeilingSlabCommitResult {
  readonly ok: boolean;
  readonly reason?: 'no-bays' | 'up-to-date';
  /** Νέες πλάκες οροφής που δημιουργήθηκαν. */
  readonly created: number;
  /** Φατνώματα που παραλείφθηκαν (καλύπτονταν ήδη από `ceiling` πλάκα). */
  readonly skipped: number;
}

/** `true` αν το κέντρο της `slab` πέφτει μέσα σε ≥1 από τα υπάρχοντα ceiling outlines (ήδη καλυμμένο). */
function isAlreadyCovered(slab: SlabEntity, existingCeilings: readonly SlabEntity[]): boolean {
  const c = polygonCentroid(slab.params.outline.vertices);
  for (const e of existingCeilings) {
    const ring = projectVerticesTo2D(e.params.outline.vertices);
    if (isPointInPolygon(c, ring)) return true;
  }
  return false;
}

/**
 * Δημιούργησε **per-φάτνωμα** πλάκες οροφής (`kind='ceiling'`, flush στην κορυφή των δοκαριών) από
 * τα δομικά μέλη του ενεργού ορόφου. Idempotent: skip φατνωμάτων που ήδη καλύπτονται από `ceiling`
 * πλάκα. `no-footprint`/`no-bays` όταν δεν προκύπτει γεωμετρία· `up-to-date` όταν όλα καλύπτονται ήδη.
 */
export function commitCeilingSlabsFromStructure(
  deps: CeilingSlabCommitDeps,
): CeilingSlabCommitResult {
  const entities = deps.getLevelScene(deps.levelId)?.entities ?? [];

  // ADR-534 Φ2 — per-bay πάχος (EC2 l/d) μέσω του active code provider (ίδιο SSoT με τον auto-sizer).
  const provider = resolveStructuralCode(useStructuralSettingsStore.getState().codeId);
  const target = buildCeilingSlabsFromStructure(
    entities,
    deps.overrides ?? {},
    deps.levelId,
    deps.sceneUnits,
    (bay) => suggestCeilingBayThickness(provider, { spanMm: bay.spanMm, interior: bay.interior }),
  );
  if (!target.ok || target.slabs.length === 0) {
    return { ok: false, reason: target.reason ?? 'no-bays', created: 0, skipped: 0 };
  }

  const existingCeilings = entities.filter(isSlabEntity).filter((s) => s.kind === 'ceiling');
  const toCreate = target.slabs.filter((s) => !isAlreadyCovered(s, existingCeilings));
  const skipped = target.slabs.length - toCreate.length;

  if (toCreate.length === 0) {
    return { ok: false, reason: 'up-to-date', created: 0, skipped };
  }

  const adapter = createLevelSceneManagerAdapter(deps.getLevelScene, deps.setLevelScene, deps.levelId);
  deps.executeCommand(new CreateSlabsCommand(toCreate, adapter));
  return { ok: true, created: toCreate.length, skipped };
}
