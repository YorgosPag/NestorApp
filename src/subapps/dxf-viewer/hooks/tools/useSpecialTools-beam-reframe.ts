'use client';
// 🏢 ADR-492 — Associative beam re-frame effect (mirror useWallRetrimEffect)
// Όταν μετακινείται/αλλάζει μια κολώνα, τα δοκάρια που την πλαισιώνουν (frame-into)
// επανα-κόβονται στην παρειά της (stored re-frame). Κρατά το αρχείο ≤500 LOC (Google SRP).

import { useEffect } from 'react';
import { EventBus } from '../../systems/events/EventBus';
import { isBeamEntity, isColumnEntity } from '../../types/entities';
import type { AnySceneEntity } from '../../types/entities';
import type { BeamEntity } from '../../bim/types/beam-types';
import { computeBeamGeometry } from '../../bim/geometry/beam-geometry';
import { reframeBeamEndpointsToColumns } from '../../bim/beams/beam-column-reframe';
import type { LevelsHookReturn } from '../../systems/levels';

/** Debounce (ms) — settle μετά το drag commit, ίδιο με τον wall-retrim (ADR-040 perf). */
const REFRAME_DEBOUNCE_MS = 200;

/**
 * ADR-492 — Re-frame δοκαριών στις παρειές των κολωνών αφού μια κίνηση/edit κολώνας
 * «κάτσει» (200ms). Mirror του `useWallRetrimEffect`: low-freq, debounced, καμία
 * subscription σε high-freq store. Trigger μόνο όταν άλλαξε ΚΟΛΩΝΑ (μετακίνηση δοκαριού
 * δεν re-frame-άρει — Revit: μόνο η στήριξη σύρει το άκρο).
 *
 * Persist: τα reframed δοκάρια εκπέμπονται ως `bim:entities-moved` (carries entities) →
 * ο `useBimEntityMovedPersistEffect` τα σώζει (μηδέν νέα persistence). Το payload δεν
 * περιέχει κολώνες → δεν ξανα-triggάρει re-frame (μηδέν loop· εξάλλου είναι idempotent).
 */
export function useBeamReframeEffect(levelManager: LevelsHookReturn): void {
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const schedule = (): void => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const levelId = levelManager.currentLevelId;
        if (!levelId) return;
        const scene = levelManager.getLevelScene(levelId);
        if (!scene) return;
        const columns = scene.entities.filter(isColumnEntity);
        if (columns.length === 0) return;
        const beams = scene.entities.filter(isBeamEntity);
        if (beams.length === 0) return;

        const reframed = new Map<string, BeamEntity>();
        for (const beam of beams) {
          const next = reframeBeamEndpointsToColumns(beam, columns);
          if (!next) continue;
          const newParams = { ...beam.params, startPoint: next.startPoint, endPoint: next.endPoint };
          reframed.set(beam.id, { ...beam, params: newParams, geometry: computeBeamGeometry(newParams) });
        }
        if (reframed.size === 0) return;

        const patched = scene.entities.map((e) => reframed.get(e.id) ?? e);
        levelManager.setLevelScene(levelId, { ...scene, entities: patched });
        // Persist via the shared moved-effect (entities-only payload → no re-trigger).
        EventBus.emit('bim:entities-moved', { movedEntities: [...reframed.values()] });
      }, REFRAME_DEBOUNCE_MS);
    };

    const offColumnParams = EventBus.on('bim:column-params-updated', schedule);
    const offMoved = EventBus.on('bim:entities-moved', ({ movedEntities }) => {
      // Μόνο όταν μετακινήθηκε ΚΟΛΩΝΑ (αλλιώς το δικό μας beam-emit θα έκανε loop).
      if ((movedEntities as readonly AnySceneEntity[]).some(isColumnEntity)) schedule();
    });

    return () => {
      offColumnParams();
      offMoved();
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [levelManager]);
}
