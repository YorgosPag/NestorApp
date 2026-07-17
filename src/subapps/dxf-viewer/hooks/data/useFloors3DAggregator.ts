'use client';

/**
 * ADR-399 Phase B — multi-floor 3D aggregator.
 *
 * Producer for the {@link multi-floor-3d-source} SSoT consumed by the "Όλοι οι
 * όροφοι" (all floors) 3D scope. While `active`, it builds one
 * {@link FloorStackEntry} per floor of the **active building**:
 *
 *   - The active floor's entities come LIVE from `Bim3DEntitiesStore` (freshest).
 *   - Other floors come from the in-memory level scene (`getLevelScene`) when the
 *     user has already visited them, otherwise a one-shot
 *     `DxfFirestoreService.loadFileV2(sceneFileId)` snapshot (cached). BIM entities
 *     live inside the persisted scene (`scene.entities`), keyed-by-floorplanId =
 *     the level's `sceneFileId`, so each floor's geometry is self-contained.
 *
 * Each entry carries `floorElevationMm = floor.elevation (m, ADR-369) × 1000` so
 * `BimSceneLayer.syncMultiFloor` stacks them at the right height.
 *
 * When `active` is false (single-floor scope) the source is cleared. The hook is
 * a no-op outside `LevelsSystem` (ADR-371 read-only Properties pipeline).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-399-dxf-floor-navigation-tabs.md
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import { useLevelsOptional } from '../../systems/levels/useLevels';
import { useFloorsByBuilding } from '@/components/properties/shared/useFloorsByBuilding';
import { DxfFirestoreService } from '../../services/dxf-firestore.service';
import { useBim3DEntitiesStore } from '../../bim-3d/stores/Bim3DEntitiesStore';
import { EMPTY_BIM_ENTITIES, type Bim3DEntities } from '../../bim-3d/stores/Bim3DEntitiesStore';
import {
  setMultiFloorStack,
  type FloorStackEntry,
} from '../../bim-3d/scene/multi-floor-3d-source';
import {
  extractBim3DEntities,
  resolveSnapshotFoundations,
} from '../../bim-3d/scene/extract-bim3d-entities';
import {
  resolveBuildingDatumElevationM,
  resolveFloorDatumRelativeElevationMm,
} from '../../bim-3d/scene/floor-stack-elevation';
import { buildActiveStoreyContext } from '../../systems/levels/active-storey-context';
// ADR-459 Φ7 — foreign-floor BIM guard: το stack entry κάθε ορόφου περιέχει ΜΟΝΟ τα
// δικά του entities (cross-level πέδιλο baked σε λάθος snapshot δεν εμφανίζεται 3Δ).
import { stripForeignFloorBim } from '../../systems/levels/scene-bim-load-policy';
// ADR-484 Slice 3 — file-level cross-floor guard: skip a snapshot whose fileRecord
// belongs to ANOTHER floor (legacy shared `sceneFileId`), independent of entity tags.
import { resolveFloorScopedScene } from '../../systems/levels/cross-floor-link';
// ADR-469 — file-less / orphaned floor fallback: one-shot per-entity BIM source so
// a floor with no `.scene.json` snapshot still shows its entities in «all floors» 3Δ.
import { resolveBimPersistenceScope } from '../../bim/persistence/bim-floor-scope';
import { loadFloorBimEntities } from '../../bim/persistence/cross-floor-bim-loader';
import { EMPTY_BOUNDS } from '../../config/geometry-constants';
import { useFoundationLevelStore } from '../../state/foundation-level-store';
// ADR-668 — τα υπόλοιπα type guards μετακόμισαν μαζί με το `extractBim3DEntities` στο SSoT.
import { isFoundationEntity } from '../../types/entities';
import type { SceneModel } from '../../types/scene';

interface TargetFloor {
  readonly levelId: string;
  readonly floorId: string;
  readonly sceneFileId: string | null;
  /** ADR-469 — for the per-entity fallback persistence scope. */
  readonly projectId: string | null;
  readonly floorElevationMm: number;
  /** ADR-448 Phase 1b — datum-relative FFL of the next floor up (storey ceiling). */
  readonly nextFloorElevationMm?: number;
}

// ADR-668 — `extractBim3DEntities` / `resolveSnapshotFoundations` ζουν πλέον στο SSoT
// `bim-3d/scene/extract-bim3d-entities.ts`, ώστε ο headless 3Δ exporter (OBJ/glTF) να
// εφαρμόζει ΤΟΝ ΙΔΙΟ κανόνα και όχι ένα αντίγραφο που θα αποκλίνει.

export function useFloors3DAggregator(active: boolean): void {
  const levelsCtx = useLevelsOptional();
  const levels = levelsCtx?.levels;
  const currentLevelId = levelsCtx?.currentLevelId ?? null;
  const getLevelScene = levelsCtx?.getLevelScene;

  const activeLevelId = useBim3DEntitiesStore((s) => s.activeLevelId);

  // ADR-469 — identity for the per-entity fallback scope (companyId/userId).
  const { user } = useAuth();
  const companyId = user?.companyId ?? null;
  const userId = user?.uid ?? null;

  // ADR-459 Φ7 — ο όροφος Θεμελίωσης + τα πέδιλά του από το model SSoT
  // (foundation-level-store). `target` null ⇒ ο όροφος Θεμελίωσης είναι ο ενεργός
  // (τα πέδιλα έρχονται live) ή single-level → μηδέν injection.
  const foundationLevelId = useFoundationLevelStore((s) => s.target?.levelId ?? null);
  const foundationStoreEntities = useFoundationLevelStore((s) => s.entities);
  const modelFootings = useMemo(
    () => foundationStoreEntities.filter(isFoundationEntity),
    [foundationStoreEntities],
  );

  // ADR-399 Phase B — building of the active level. Drives the canonical floor
  // elevation lookup below.
  const buildingId = useMemo(
    () => (active && levels ? levels.find((l) => l.id === currentLevelId)?.buildingId ?? null : null),
    [active, levels, currentLevelId],
  );
  // 🏢 ADR-369 storey elevations from the SAME canonical Firestore source as the
  // floor tabs (`useFloorsByBuilding` → FLOORS doc). NOT `Bim3DEntitiesStore.floors`,
  // whose `elevation` arrives undefined (ProjectHierarchyContext drops it + the
  // by-company API never returns it) → previously every floor stacked at Y=0.
  const { floors: buildingFloors } = useFloorsByBuilding(buildingId, active);
  // Individual array selectors keep stable refs (no re-render unless changed).
  const walls = useBim3DEntitiesStore((s) => s.walls);
  const columns = useBim3DEntitiesStore((s) => s.columns);
  const beams = useBim3DEntitiesStore((s) => s.beams);
  const slabs = useBim3DEntitiesStore((s) => s.slabs);
  const slabOpenings = useBim3DEntitiesStore((s) => s.slabOpenings);
  const openings = useBim3DEntitiesStore((s) => s.openings);
  const stairs = useBim3DEntitiesStore((s) => s.stairs);
  const fixtures = useBim3DEntitiesStore((s) => s.fixtures);
  const panels = useBim3DEntitiesStore((s) => s.panels);
  const railings = useBim3DEntitiesStore((s) => s.railings);
  const furnitures = useBim3DEntitiesStore((s) => s.furnitures);
  const roofs = useBim3DEntitiesStore((s) => s.roofs);
  const floorFinishes = useBim3DEntitiesStore((s) => s.floorFinishes);
  const mepSegments = useBim3DEntitiesStore((s) => s.mepSegments);
  const mepFittings = useBim3DEntitiesStore((s) => s.mepFittings);
  const manifolds = useBim3DEntitiesStore((s) => s.manifolds);
  const radiators = useBim3DEntitiesStore((s) => s.radiators);
  const boilers = useBim3DEntitiesStore((s) => s.boilers);
  const waterHeaters = useBim3DEntitiesStore((s) => s.waterHeaters);
  const underfloors = useBim3DEntitiesStore((s) => s.underfloors);
  const foundations = useBim3DEntitiesStore((s) => s.foundations);

  // Firestore snapshots for floors the user has not visited this session.
  const [loaded, setLoaded] = useState<ReadonlyMap<string, Bim3DEntities>>(new Map());

  const liveActive = useMemo<Bim3DEntities>(
    () => ({ walls, columns, beams, foundations, slabs, slabOpenings, openings, stairs, fixtures, panels, railings, furnitures, roofs, floorFinishes, mepSegments, mepFittings, manifolds, radiators, boilers, waterHeaters, underfloors }),
    [walls, columns, beams, foundations, slabs, slabOpenings, openings, stairs, fixtures, panels, railings, furnitures, roofs, floorFinishes, mepSegments, mepFittings, manifolds, radiators, boilers, waterHeaters, underfloors],
  );

  // One target per building floor (first level wins for a floor with duplicates).
  const targets = useMemo<TargetFloor[]>(() => {
    if (!active || !levels || !buildingId) return [];
    // 🏢 Revit-grade datum: stack relative to the building's ground floor (or the
    // lowest storey when no ground floor exists) so the model rests on the ground
    // (world 0) instead of floating at the lowest storey's raw elevation. The
    // building-base offset is applied downstream by the per-entity converters.
    const datumM = resolveBuildingDatumElevationM(buildingFloors);
    const elevByFloorId = new Map(buildingFloors.map((f) => [f.id, f.elevation ?? 0] as const));
    const seen = new Set<string>();
    const out: TargetFloor[] = [];
    for (const lvl of levels) {
      if (lvl.buildingId !== buildingId || !lvl.floorId || seen.has(lvl.floorId)) continue;
      seen.add(lvl.floorId);
      const elevationM = elevByFloorId.get(lvl.floorId) ?? 0;
      // ADR-448 1b — reuse the storey-context SSoT for the next-floor (ceiling) FFL
      // so the "all floors" stack matches single-floor storey-ceiling resolution.
      const storey = buildActiveStoreyContext(buildingFloors, lvl.floorId);
      out.push({
        levelId: lvl.id,
        floorId: lvl.floorId,
        sceneFileId: lvl.sceneFileId ?? null,
        projectId: lvl.projectId ?? null,
        floorElevationMm: resolveFloorDatumRelativeElevationMm(elevationM, datumM),
        nextFloorElevationMm: storey?.nextFloorElevationMm ?? undefined,
      });
    }
    return out;
  }, [active, levels, currentLevelId, buildingId, buildingFloors]);

  // Resolve a floor's entities: live (active) → in-memory scene → loaded snapshot.
  const resolveEntities = useCallback(
    (t: TargetFloor): Bim3DEntities | null => {
      if (t.levelId === activeLevelId) {
        // ADR-484 Slice 5 — Revit-canonical: τα πέδιλα ζουν ΜΟΝΟ στον foundation level.
        // Όταν ο ενεργός όροφος ΔΕΝ είναι αυτός (`foundationLevelId != null` ⟺ ο foundation
        // level είναι ΑΛΛΟΣ· επιβεβαιωμένο: target=null μόνο όταν ενεργός=Θεμελίωση), drop
        // τυχόν baked/legacy footings από τη live σκηνή (π.χ. πεδιλοδοκοί στο Ισόγειο).
        if (foundationLevelId != null && liveActive.foundations.length > 0) {
          return { ...liveActive, foundations: [] };
        }
        return liveActive;
      }
      const scene = getLevelScene?.(t.levelId);
      const base =
        scene && scene.entities.length > 0
          ? extractBim3DEntities(stripForeignFloorBim(scene, t.floorId))
          : loaded.get(t.levelId) ?? null;
      // ADR-459 Φ7 / ADR-484 Slice 5 — Revit-canonical foundation rule (SSoT, ADR-668):
      // πέδιλα ΜΟΝΟ στον foundation level, με override από τα authoritative model footings.
      return resolveSnapshotFoundations(base, t.levelId, foundationLevelId, modelFootings);
    },
    [activeLevelId, liveActive, getLevelScene, loaded, foundationLevelId, modelFootings],
  );

  // Lazily fetch snapshots for unvisited, file-linked floors.
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const missing = targets.filter(
      (t) =>
        t.levelId !== activeLevelId &&
        !loaded.has(t.levelId) &&
        !((getLevelScene?.(t.levelId)?.entities.length ?? 0) > 0),
    );
    if (missing.length === 0) return;

    void (async () => {
      const entries: [string, Bim3DEntities][] = [];
      for (const t of missing) {
        try {
          let scene: SceneModel | null = null;
          // 1. `.scene.json` snapshot (file-linked, has a valid record). ADR-484
          // Slice 3 — null when the record belongs to another floor (shared fileId)
          // → falls through to the ADR-469 own-floor per-entity fallback below.
          if (t.sceneFileId) {
            const rec = await DxfFirestoreService.loadFileV2(t.sceneFileId);
            if (cancelled) return;
            scene = resolveFloorScopedScene(rec, t.floorId);
          }
          // 2. ADR-469 — no snapshot (file-less or orphaned): one-shot per-entity BIM.
          if (!scene) {
            const scope = resolveBimPersistenceScope({
              companyId,
              projectId: t.projectId,
              userId,
              floorId: t.floorId,
              floorplanId: t.sceneFileId,
            });
            const entities = scope ? await loadFloorBimEntities(scope) : [];
            if (cancelled) return;
            scene =
              entities.length > 0
                ? ({ entities, layersById: {}, bounds: { ...EMPTY_BOUNDS }, units: 'mm' } as unknown as SceneModel)
                : null;
          }
          entries.push([
            t.levelId,
            scene ? extractBim3DEntities(stripForeignFloorBim(scene, t.floorId)) : EMPTY_BIM_ENTITIES,
          ]);
        } catch {
          entries.push([t.levelId, EMPTY_BIM_ENTITIES]);
        }
      }
      if (cancelled || entries.length === 0) return;
      setLoaded((prev) => {
        const next = new Map(prev);
        for (const [k, v] of entries) next.set(k, v);
        return next;
      });
    })();

    return () => { cancelled = true; };
  }, [active, targets, activeLevelId, loaded, getLevelScene, companyId, userId]);

  // Compose + publish the stack to the SSoT source (skip floors still loading).
  const stack = useMemo<FloorStackEntry[]>(() => {
    if (!active) return [];
    const out: FloorStackEntry[] = [];
    for (const t of targets) {
      const entities = resolveEntities(t);
      if (!entities) continue;
      out.push({ levelId: t.levelId, floorElevationMm: t.floorElevationMm, nextFloorElevationMm: t.nextFloorElevationMm, entities });
    }
    return out;
  }, [active, targets, resolveEntities]);

  useEffect(() => {
    setMultiFloorStack(active ? stack : []);
  }, [active, stack]);
}
