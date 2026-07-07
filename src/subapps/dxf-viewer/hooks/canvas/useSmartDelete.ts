/**
 * 🏢 ENTERPRISE: useSmartDelete Hook
 *
 * @description Context-aware deletion with intelligent priority:
 * 1. Selected grip vertices → delete vertices (highest index first)
 * 2. Selected overlays → delete entire overlays
 * 3. Selected DXF entities → delete entities via LevelSceneManagerAdapter
 *
 * All deletions go through Command History for Ctrl+Z undo support.
 *
 * EXTRACTED FROM: CanvasSection.tsx — ~85 lines of delete logic + event bus listener
 *
 * @see ADR-030: Universal Selection System
 * @see ADR-032: Command History / Undo-Redo
 */

'use client';

import { useCallback, useEffect, type MutableRefObject } from 'react';

import {
  DeleteOverlayCommand,
  DeleteMultipleOverlaysCommand,
  DeleteOverlayVertexCommand,
  DeleteMultipleOverlayVerticesCommand,
  CompoundCommand,
  type ICommand,
} from '../../core/commands';
import { LevelSceneManagerAdapter, createLevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
// ADR-032/390/401 — canonical command-based delete (SSoT shared with ribbon «Διαγραφή»).
import { deleteEntitiesById } from './delete-entities-core';
// ADR-459 Φ7 — cross-level (Θεμελίωση) footing delete: επιλογή πεδίλου στο 3Δ + Delete
// ενώ ο ενεργός όροφος είναι άλλος → ο level-scoped adapter δεν το βρίσκει.
import { DeleteCrossLevelFootingsCommand } from '../../core/commands/entity-commands/DeleteCrossLevelFootingsCommand';
import { useFoundationLevelStore } from '../../state/foundation-level-store';
import { resolveFoundationCrossLevelWriter } from '../../bim/foundations/foundation-write-scope';
import { useSelection3DStore } from '../../bim-3d/stores/Selection3DStore';
import { isFoundationEntity, type Entity } from '../../types/entities';
import type { FoundationEntity } from '../../bim/types/foundation-types';
import { useAuth } from '@/auth/hooks/useAuth';
// ADR-408 Φ-C EXT — circuit dissolve still lives here (PRIORITY 4); the entity
// MEP cascade moved into delete-entities-core.ts with the rest of PRIORITY 3.
import { useMepSystemStore } from '../../bim/mep-systems/mep-system-store';
import { DissolveMepSystemCommand } from '../../core/commands/entity-commands/DissolveMepSystemCommand';
// ADR-408 Φ-C EXT — Delete on a selected electrical CIRCUIT (the home-run wire is a
// derived MepSystem visualization, not an entity → circuit lives in this store).
import { useMepCircuitEditorStore } from '../../bim/mep-systems/mep-circuit-editor-store';
// ADR-363 Phase 3.8 — slab vertex removal
import { removeVertexFromSlab } from '../../bim/slabs/slab-grips';
import { UpdateSlabParamsCommand } from '../../core/commands/entity-commands/UpdateSlabParamsCommand';
import type { SlabEntity } from '../../bim/types/slab-types';
// ADR-417 Φ1-part-2 #2 — roof vertex removal (mirror slab).
import { removeVertexFromRoof } from '../../bim/roofs/roof-grips';
import { UpdateRoofParamsCommand } from '../../core/commands/entity-commands/UpdateRoofParamsCommand';
import type { RoofEntity } from '../../bim/types/roof-types';
// ADR-507 / ADR-501 EXT — hatch boundary vertex delete: hovered single (reuse the context-menu
// SSoT builder) + armed/marquee bulk (GripArmedStore → one CompoundCommand, single undo).
import { GripArmedStore } from '../../systems/grip/GripArmedStore';
import { buildHatchVertexOpCommand, buildArmedHatchVertexDeleteCommand } from '../../systems/grip/hatch-grip-ops';
import type { SelectedGrip, UnifiedGripInfo } from '../grips/unified-grip-types';
import type { useOverlayStore } from '../../overlays/overlay-store';
import type { UniversalSelectionHook } from '../../systems/selection/SelectionSystem';
import type { LevelsHookReturn } from '../../systems/levels/useLevels';
import type { useEventBus } from '../../systems/events';

// ============================================================================
// TYPES
// ============================================================================

export interface UseSmartDeleteParams {
  /** Selected grip vertices */
  selectedGrips: SelectedGrip[];
  /** Clear grip selection after vertex deletion */
  setSelectedGrips: (grips: SelectedGrip[]) => void;
  /** Command history execute function */
  executeCommand: (command: ICommand) => void;
  /** Overlay store ref (avoids stale closures) */
  overlayStoreRef: MutableRefObject<ReturnType<typeof useOverlayStore>>;
  /** Universal selection ref (avoids stale closures) */
  universalSelectionRef: MutableRefObject<UniversalSelectionHook>;
  /** Level manager for DXF entity deletion */
  levelManager: LevelsHookReturn;
  /** Clear selected entity IDs after DXF deletion */
  setSelectedEntityIds: (ids: string[]) => void;
  /** Event bus for toolbar:delete event */
  eventBus: ReturnType<typeof useEventBus>;
  /**
   * ADR-363 Phase 3.8 — currently hovered DXF grip. When set and it resolves
   * to a slab vertex, Delete removes that vertex (PRIORITY 0.5).
   */
  hoveredDxfGrip?: UnifiedGripInfo | null;
}

export interface UseSmartDeleteReturn {
  /** Smart delete handler — call from keyboard shortcuts or toolbar */
  handleSmartDelete: () => Promise<boolean>;
}

// ============================================================================
// HOOK
// ============================================================================

export function useSmartDelete({
  selectedGrips,
  setSelectedGrips,
  executeCommand,
  overlayStoreRef,
  universalSelectionRef,
  levelManager,
  setSelectedEntityIds,
  eventBus,
  hoveredDxfGrip,
}: UseSmartDeleteParams): UseSmartDeleteReturn {
  const { user } = useAuth();

  const handleSmartDelete = useCallback(async () => {
    const overlayStoreInstance = overlayStoreRef.current;

    // PRIORITY 0.5: ADR-363 Phase 3.8 — Delete hovered slab vertex
    if (hoveredDxfGrip?.slabGripKind?.startsWith('slab-vertex-') && hoveredDxfGrip.entityId && levelManager.currentLevelId) {
      const idx = parseInt(hoveredDxfGrip.slabGripKind.slice('slab-vertex-'.length), 10);
      if (Number.isFinite(idx)) {
        const adapter = createLevelSceneManagerAdapter(
          levelManager.getLevelScene,
          levelManager.setLevelScene,
          levelManager.currentLevelId,
        );
        const raw = adapter.getEntity(hoveredDxfGrip.entityId);
        const candidate = raw as unknown as Partial<SlabEntity>;
        if (candidate?.type === 'slab' && candidate.params) {
          const slab = candidate as SlabEntity;
          const newParams = removeVertexFromSlab(slab.params, idx);
          if (newParams !== slab.params) {
            const command = new UpdateSlabParamsCommand(
              hoveredDxfGrip.entityId,
              newParams,
              slab.params,
              adapter,
              false,
            );
            if (command.validate() === null) {
              executeCommand(command);
              return true;
            }
          }
        }
      }
    }

    // PRIORITY 0.5b: ADR-417 Φ1-part-2 #2 — Delete hovered roof footprint vertex.
    // Mirror of the slab block above (roof is a DIRECT entity; removeVertexFromRoof
    // filters BOTH outline.vertices AND the parallel edges array in lockstep).
    if (hoveredDxfGrip?.roofGripKind?.startsWith('roof-vertex-') && hoveredDxfGrip.entityId && levelManager.currentLevelId) {
      const idx = parseInt(hoveredDxfGrip.roofGripKind.slice('roof-vertex-'.length), 10);
      if (Number.isFinite(idx)) {
        const adapter = createLevelSceneManagerAdapter(
          levelManager.getLevelScene,
          levelManager.setLevelScene,
          levelManager.currentLevelId,
        );
        const raw = adapter.getEntity(hoveredDxfGrip.entityId);
        const candidate = raw as unknown as Partial<RoofEntity>;
        if (candidate?.type === 'roof' && candidate.params) {
          const roof = candidate as RoofEntity;
          const newParams = removeVertexFromRoof(roof.params, idx);
          if (newParams !== roof.params) {
            const command = new UpdateRoofParamsCommand(
              hoveredDxfGrip.entityId,
              newParams,
              roof.params,
              adapter,
              false,
            );
            if (command.validate() === null) {
              executeCommand(command);
              return true;
            }
          }
        }
      }
    }

    // PRIORITY 0.5c: ADR-507 — Delete a hovered hatch boundary vertex (mirror slab/roof).
    // Reuses the SAME context-menu SSoT builder (`buildHatchVertexOpCommand`) → identical
    // remove-vertex semantics (min-triangle guard) whether triggered by menu or Delete key.
    if (hoveredDxfGrip?.hatchGripKind?.startsWith('hatch-vertex-') && hoveredDxfGrip.entityId && levelManager.currentLevelId) {
      const adapter = createLevelSceneManagerAdapter(
        levelManager.getLevelScene, levelManager.setLevelScene, levelManager.currentLevelId,
      );
      const command = buildHatchVertexOpCommand(hoveredDxfGrip, 'remove-vertex', adapter);
      if (command) { executeCommand(command); return true; }
    }

    // PRIORITY 0.6: ADR-501 EXT — BULK delete of armed/marquee-selected hatch vertices.
    // Both selection paths (marquee `armMany` + Shift-click `toggle`) publish to
    // `GripArmedStore`; here Delete removes ALL armed boundary vertices in ONE undo step
    // (grouped per hatch, ≥3-per-ring guard). Must precede the entity-delete tiers below so
    // arming vertices deletes the VERTICES, not the whole hatch. Non-hatch armed grips → skip.
    if (GripArmedStore.size > 0 && levelManager.currentLevelId) {
      const adapter = createLevelSceneManagerAdapter(
        levelManager.getLevelScene, levelManager.setLevelScene, levelManager.currentLevelId,
      );
      const command = buildArmedHatchVertexDeleteCommand(GripArmedStore.getRefsSnapshot(), adapter);
      if (command) {
        executeCommand(command);
        GripArmedStore.clear();
        return true;
      }
    }

    // PRIORITY 1: Delete selected grips (vertices) with UNDO SUPPORT
    if (selectedGrips.length > 0) {
      // Sort by index DESCENDING to avoid index shifting
      const vertexGrips = selectedGrips
        .filter(g => g.type === 'vertex')
        .sort((a, b) => {
          if (a.overlayId !== b.overlayId) return a.overlayId.localeCompare(b.overlayId);
          return b.index - a.index;
        });

      if (vertexGrips.length > 0) {
        if (vertexGrips.length === 1) {
          executeCommand(new DeleteOverlayVertexCommand(
            vertexGrips[0].overlayId,
            vertexGrips[0].index,
            overlayStoreInstance,
          ));
        } else {
          executeCommand(new DeleteMultipleOverlayVerticesCommand(
            vertexGrips.map(g => ({ overlayId: g.overlayId, vertexIndex: g.index })),
            overlayStoreInstance,
          ));
        }
        setSelectedGrips([]);
        return true;
      }
    }

    // PRIORITY 2: Delete selected overlays (entire entities) with UNDO SUPPORT
    const selectedOverlayIds = universalSelectionRef.current.getIdsByType('overlay');
    if (selectedOverlayIds.length > 0) {
      if (selectedOverlayIds.length === 1) {
        executeCommand(new DeleteOverlayCommand(selectedOverlayIds[0], overlayStoreInstance));
      } else {
        executeCommand(new DeleteMultipleOverlaysCommand(selectedOverlayIds, overlayStoreInstance));
      }
      universalSelectionRef.current.clearAll();
      return true;
    }

    // PRIORITY 2.7: ADR-459 Φ7 — cross-level foundation (πέδιλο) delete. Επιλογή
    // πεδίλου στο 3Δ (ζει στον όροφο Θεμελίωσης) + Delete ενώ ο ενεργός όροφος είναι
    // άλλος → ο level-scoped adapter (PRIORITY 3) δεν το βρίσκει → silent fail. Εδώ το
    // διαγράφουμε cross-level (writer) + αποσυνδέουμε τα FK των κολωνών (undoable).
    {
      const fl = useFoundationLevelStore.getState();
      const selIds = universalSelectionRef.current.getSelectedEntityIds();
      if (fl.target && selIds.length > 0 && levelManager.currentLevelId) {
        const activeScene = levelManager.getLevelScene(levelManager.currentLevelId);
        const activeEntities = (activeScene?.entities ?? []) as unknown as readonly Entity[];
        const activeIds = new Set(activeEntities.map((e) => e.id));
        const crossFootings = selIds
          .filter((id) => !activeIds.has(id))
          .map((id) => fl.entities.find((e) => e.id === id))
          .filter((e): e is FoundationEntity => e !== undefined && isFoundationEntity(e));
        if (crossFootings.length > 0) {
          const writer = resolveFoundationCrossLevelWriter({
            user,
            levels: levelManager.levels,
            levelId: levelManager.currentLevelId,
            io: levelManager,
            target: fl.target,
          });
          if (writer) {
            const footingIds = new Set(crossFootings.map((f) => f.id));
            const adapter = createLevelSceneManagerAdapter(
              levelManager.getLevelScene, levelManager.setLevelScene, levelManager.currentLevelId,
            );
            const detachColumnIds = activeEntities
              .filter((e) => e.type === 'column' && footingIds.has(
                (e as { params?: { footingId?: string } }).params?.footingId ?? '',
              ))
              .map((e) => e.id);
            executeCommand(new DeleteCrossLevelFootingsCommand(crossFootings, detachColumnIds, writer, adapter));
            if (detachColumnIds.length > 0) {
              eventBus.emit('bim:column-footing-detached', { columnIds: detachColumnIds });
            }
            const remaining = selIds.filter((id) => !footingIds.has(id));
            universalSelectionRef.current.replaceEntitySelection(remaining);
            setSelectedEntityIds(remaining);
            useSelection3DStore.getState().clearSelection();
            if (remaining.length === 0) return true;
          }
        }
      }
    }

    // PRIORITY 3: Delete selected DXF entities with UNDO SUPPORT.
    // SSoT: delete-entities-core.ts — the SAME canonical path the ribbon
    // «Διαγραφή» now uses (cascades + ADR-401 host-detach + MEP cascade +
    // undoable + synchronous scene removal before the Firestore events).
    const selectedDxfEntityIds = universalSelectionRef.current.getSelectedEntityIds();
    if (selectedDxfEntityIds.length > 0 && levelManager.currentLevelId) {
      const adapter = createLevelSceneManagerAdapter(
        levelManager.getLevelScene,
        levelManager.setLevelScene,
        levelManager.currentLevelId,
      );
      const scene = levelManager.getLevelScene(levelManager.currentLevelId);
      const deleted = await deleteEntitiesById(selectedDxfEntityIds, {
        adapter,
        sceneEntities: scene?.entities ?? [],
        executeCommand,
      });
      // `false` ⇒ user cancelled the wall-opening cascade prompt — keep selection.
      if (!deleted) return false;
      universalSelectionRef.current.clearByType('dxf-entity');
      setSelectedEntityIds([]);
      return true;
    }

    // PRIORITY 4: ADR-408 Φ-C EXT — delete the selected electrical CIRCUIT(s).
    // The home-run wire is a DERIVED visualization of a MepSystem (not a scene
    // entity), so selecting a wire selects the circuit (`selectedSystemIds` in the
    // circuit editor store) and `universalSelection` stays empty — every entity
    // priority above misses. Detect the circuit selection at event time (getState
    // getter, ADR-040: no React subscription) and dissolve each via the SAME
    // `DissolveMepSystemCommand` SSoT the entity-delete cascade uses above (members
    // — panel / sockets / lights — stay; only the circuit + its derived wire go).
    // Multi-select aware (marquee), one CompoundCommand = single undo. Then clear
    // the circuit selection, mirroring the ESC `clearEntitySelection`.
    const circuitStore = useMepCircuitEditorStore.getState();
    const selectedCircuitIds = [...circuitStore.selectedSystemIds];
    if (selectedCircuitIds.length > 0) {
      const systems = useMepSystemStore.getState().getSystems();
      const snapshots = selectedCircuitIds
        .map((id) => systems.find((s) => s.id === id))
        .filter((s): s is NonNullable<typeof s> => s != null);
      if (snapshots.length > 0) {
        const commands = snapshots.map((s) => new DissolveMepSystemCommand(s));
        executeCommand(
          commands.length === 1 ? commands[0] : new CompoundCommand('Delete circuits', commands),
        );
        circuitStore.setActiveSystemId(null);
        return true;
      }
    }

    return false;
  }, [selectedGrips, executeCommand, levelManager, overlayStoreRef, universalSelectionRef, setSelectedGrips, setSelectedEntityIds, hoveredDxfGrip, user]);

  // Listen for delete command from floating toolbar
  useEffect(() => {
    const cleanupDelete = eventBus.on('toolbar:delete', () => {
      handleSmartDelete();
    });
    return () => { cleanupDelete(); };
  }, [eventBus, handleSmartDelete]);

  return { handleSmartDelete };
}
