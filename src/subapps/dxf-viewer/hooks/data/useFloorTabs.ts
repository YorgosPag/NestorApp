'use client';

/**
 * ADR-399 — Building Floor Navigation Tabs (reconciliation hook).
 *
 * Δίνει στη μπάρα πλοήγησης ορόφων (`FloorTabBar`) μία καρτέλα ανά **όροφο του
 * κτιρίου** (SSoT = `useFloorsByBuilding`), αντιστοιχισμένη σε ένα DXF `Level`:
 *   - Υπάρχει level με `level.floorId === floor.id` → η καρτέλα κάνει switch.
 *   - Δεν υπάρχει → **virtual** καρτέλα (κενός όροφος)· κλικ = lazy provision
 *     ενός level μέσω του ADR-286 SSoT gateway (`addLevel`) + `updateLevelContext`.
 *
 * Ορατότητα: όταν ο τρέχων level **ανήκει σε συγκεκριμένο κτίριο** (`buildingId`).
 * Δείκτης = `buildingId`, ΟΧΙ `floorplanType` — τα κενά building-storeys (που
 * φτιάχνονται από το building setup μέσω `findOrCreateLevelForFloor` και ΔΕΝ
 * φέρουν `floorplanType:'floor'`) ανήκουν εξίσου σε κτίριο και πρέπει να δείχνουν
 * τη strip. Το default «Επίπεδο 1» (χωρίς `buildingId`) δεν τη δείχνει.
 *
 * @module subapps/dxf-viewer/hooks/data/useFloorTabs
 * @see docs/centralized-systems/reference/adrs/ADR-399-dxf-floor-navigation-tabs.md
 */

import { useCallback, useMemo, useRef } from 'react';
import { useLevelsContext } from '../../systems/levels/LevelsSystem';
import { useFloorsByBuilding, type FloorOption } from '@/components/properties/shared/useFloorsByBuilding';
import { generateAutoLongName, inferKindFromNumber } from '@/utils/floor-naming';
import { useViewMode3DStore, type Floor3DScope } from '../../bim-3d/stores/ViewMode3DStore';
import type { FloorVisMode } from '../../bim-3d/utils/floor-visibility-state';

export interface FloorTab {
  /** Firestore floor document id (SSoT key). */
  readonly floorId: string;
  /** Signed floor number (-N basement … 0 ground … +N standard). */
  readonly number: number;
  /** Greek canonical label («Ισόγειο», «1ος Όροφος», …). */
  readonly label: string;
  /** Linked DXF level id, or null when the floor has no level yet (virtual tab). */
  readonly levelId: string | null;
  /** True when the linked level already carries a floorplan (scene file or entities). */
  readonly hasFloorplan: boolean;
}

export interface UseFloorTabsResult {
  /** Whether the floor strip should render at all (floor-plan context only). */
  readonly visible: boolean;
  /** One tab per building floor, ascending by number (basement → roof). */
  readonly tabs: readonly FloorTab[];
  /** floorId of the active tab (the floor of the current level), or null. */
  readonly activeFloorId: string | null;
  /** Switch to / lazily provision the level for a tab. */
  readonly onSelectTab: (tab: FloorTab) => void;
  /** ADR-399 Phase B — current 3D floor source scope ('single' | 'all'). */
  readonly floor3DScope: Floor3DScope;
  /** ADR-399 Phase B — activate the "Όλοι οι όροφοι" tab (scope='all' + enter 3D). */
  readonly onSelectAllFloors: () => void;
  /** ADR-399 Phase C — per-level visibility modes (SSoT with Floor3DPanel). */
  readonly floorVisibilityModes: ReadonlyMap<string, FloorVisMode>;
  /** ADR-399 Phase C — toggle whether a floor is shown inside "Όλοι οι όροφοι". */
  readonly onToggleFloorVisible: (tab: FloorTab) => void;
}

/** Resolve the Greek label for a floor, reusing the ADR-369 naming SSoT. */
function floorLabel(floor: FloorOption): string {
  if (floor.longName) return floor.longName;
  if (floor.name) return floor.name;
  return generateAutoLongName(floor.kind ?? inferKindFromNumber(floor.number), floor.number);
}

export function useFloorTabs(): UseFloorTabsResult {
  const {
    levels,
    currentLevelId,
    addLevel,
    setCurrentLevel,
    updateLevelContext,
    getLevelScene,
  } = useLevelsContext();

  const currentLevel = useMemo(
    () => levels.find((l) => l.id === currentLevelId) ?? null,
    [levels, currentLevelId],
  );

  const buildingId = currentLevel?.buildingId ?? null;
  // Show the strip whenever the active level belongs to a building. Gating on
  // `buildingId` (not `floorplanType`) keeps empty building storeys — created via
  // `findOrCreateLevelForFloor` without a `floorplanType:'floor'` tag — visible,
  // while the building-less default «Επίπεδο 1» stays hidden.
  const visible = !!buildingId;

  // Subscribe to the building's floors only while the strip is relevant.
  const { floors } = useFloorsByBuilding(buildingId, visible);

  // floorId → linked level (first match wins; subscription keeps it fresh).
  const levelByFloorId = useMemo(() => {
    const map = new Map<string, string>();
    for (const lvl of levels) {
      if (lvl.floorId && !map.has(lvl.floorId)) map.set(lvl.floorId, lvl.id);
    }
    return map;
  }, [levels]);

  const tabs = useMemo<FloorTab[]>(() => {
    return floors.map((floor) => {
      const levelId = levelByFloorId.get(floor.id) ?? null;
      const linked = levelId ? levels.find((l) => l.id === levelId) : undefined;
      const hasFloorplan = !!linked
        && (!!linked.sceneFileId || (getLevelScene(linked.id)?.entities.length ?? 0) > 0);
      return { floorId: floor.id, number: floor.number, label: floorLabel(floor), levelId, hasFloorplan };
    });
  }, [floors, levelByFloorId, levels, getLevelScene]);

  // ADR-399 Phase B/C — 3D scope + per-level visibility (SSoT = ViewMode3DStore).
  const floor3DScope = useViewMode3DStore((s) => s.floor3DScope);
  const floorVisibilityModes = useViewMode3DStore((s) => s.floorVisibilityModes);

  const onSelectAllFloors = useCallback(() => {
    // Scope only — the current render mode decides what «Όλοι» shows:
    //   3D → BimSceneLayer.syncMultiFloor stacks the building by elevation (Phase B).
    //   2D → FloorUnderlayOverlay draws every floor's plan, faded, behind the active
    //        editable floor (Phase D). Stay in 2D (no longer enters raster mode).
    useViewMode3DStore.getState().setFloor3DScope('all');
  }, []);

  const onToggleFloorVisible = useCallback((tab: FloorTab) => {
    if (!tab.levelId) return; // virtual floors have no level / geometry yet
    const vm = useViewMode3DStore.getState();
    const current = vm.floorVisibilityModes.get(tab.levelId) ?? 'show';
    vm.setFloorMode(tab.levelId, current === 'hide' ? 'show' : 'hide');
  }, []);

  // Guard: in-flight provisions per floorId — blocks double-click duplicates.
  const provisioningRef = useRef<Set<string>>(new Set());

  const onSelectTab = useCallback(
    async (tab: FloorTab) => {
      // Selecting a specific floor returns to single-floor scope (exits "all floors").
      useViewMode3DStore.getState().setFloor3DScope('single');
      if (tab.levelId) {
        setCurrentLevel(tab.levelId);
        return;
      }
      if (!buildingId || provisioningRef.current.has(tab.floorId)) return;
      provisioningRef.current.add(tab.floorId);
      try {
        const newId = await addLevel(tab.label, false, tab.floorId);
        if (newId) {
          // floorplanType:'floor' keeps the strip visible after switching to
          // the freshly-provisioned (empty) level; addLevel auto-selects it.
          await updateLevelContext(newId, {
            floorplanType: 'floor',
            entityLabel: tab.label,
            buildingId,
            floorId: tab.floorId,
          });
          setCurrentLevel(newId);
        }
      } finally {
        provisioningRef.current.delete(tab.floorId);
      }
    },
    [buildingId, addLevel, updateLevelContext, setCurrentLevel],
  );

  return {
    visible,
    tabs,
    activeFloorId: currentLevel?.floorId ?? null,
    onSelectTab: onSelectTab as (tab: FloorTab) => void,
    floor3DScope,
    onSelectAllFloors,
    floorVisibilityModes,
    onToggleFloorVisible,
  };
}
