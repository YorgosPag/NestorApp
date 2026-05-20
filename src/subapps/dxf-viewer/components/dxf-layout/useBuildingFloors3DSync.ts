import { useEffect } from 'react';
import { useFirestoreBuildings } from '@/hooks/useFirestoreBuildings';
import { useProjectHierarchyOptional } from '../../contexts/ProjectHierarchyContext';
import { useBim3DEntitiesStore } from '../../bim-3d/stores/Bim3DEntitiesStore';
import type { BuildingRef, FloorRef } from '../../bim/utils/bim-floor-utils';

// ADR-369 Q2.2 — Feed buildings + floors to 3D entities store.
// Shell WRITES to store (no useSyncExternalStore — ADR-040 CHECK 6C compliant).
// Buildings source: useFirestoreBuildings (has baseElevation).
// Floors source: ProjectHierarchyContext.buildings[].floors (has elevation in metres).
export function useBuildingFloors3DSync(projectId: string | null): void {
  const { buildings: firestoreBuildings } = useFirestoreBuildings();
  const hierarchy = useProjectHierarchyOptional();

  useEffect(() => {
    const projectBuildings = projectId
      ? firestoreBuildings.filter((b) => b.projectId === projectId)
      : firestoreBuildings;

    const buildingRefs: BuildingRef[] = projectBuildings.map((b) => ({
      id: b.id,
      baseElevation: b.baseElevation,
      name: b.name,
    }));

    const hierarchyBuildings = hierarchy?.selectedProject?.buildings ?? [];
    const floorRefs: FloorRef[] = hierarchyBuildings.flatMap((b) =>
      b.floors.map((f) => ({
        id: f.id,
        elevation: f.elevation,
        buildingId: b.id,
      })),
    );

    const store = useBim3DEntitiesStore.getState();
    store.setBuildings(buildingRefs);
    store.setFloors(floorRefs);
  }, [firestoreBuildings, projectId, hierarchy?.selectedProject]);
}
