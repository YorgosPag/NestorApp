'use client';

/**
 * useImportedMeshPlacementContext — ADR-683 Φ3β: το πλαίσιο συντεταγμένων του **ορόφου υποδοχής**.
 *
 * **Γιατί δεν αρκεί «βάλ' το στο 0»:** το `.glb` που γυρίζει ο συνεργάτης εξήχθη από τον Νέστορα με
 * απόλυτα υψόμετρα — ο exporter στοιβάζει τους ορόφους με
 * `resolveFloorDatumRelativeElevationMm(floor.elevation, datum)` + `baseElevation` του κτηρίου
 * (`export/core/mesh3d/build-mesh3d-scene.ts:60-70`). Αν η εισαγωγή αγνοήσει το ίδιο datum, ένα
 * κάγκελο του 3ου ορόφου θα ξαναμπεί **9 μέτρα πάνω** από το πάτωμά του.
 *
 * Γι' αυτό καλούνται εδώ **οι ίδιες** συναρτήσεις με τον exporter: έξοδος και είσοδος συμφωνούν
 * εξ ορισμού, όχι κατά σύμπτωση.
 *
 * Ο υπολογισμός του ενεργού κτηρίου αντιγράφει σκόπιμα το `ExportHost.tsx:82-100` (από τον **ενεργό
 * όροφο**, όχι από prop), ώστε η εισαγωγή να δουλεύει στο ίδιο πλαίσιο με ό,τι βλέπει ο χρήστης.
 *
 * @see ../../../export/core/mesh3d/build-mesh3d-scene — η ευθεία πράξη (εξαγωγή)
 * @see ../../../io/mesh3d-roundtrip/gltf-node-placement — ο καταναλωτής του πλαισίου
 */

import { useMemo } from 'react';
import { useFloorsByBuilding } from '@/components/properties/shared/useFloorsByBuilding';
import { useFirestoreBuildings } from '@/hooks/useFirestoreBuildings';
import { useLevels } from '../../../systems/levels';
import {
  resolveBuildingDatumElevationM,
  resolveFloorDatumRelativeElevationMm,
} from '../../../bim-3d/scene/floor-stack-elevation';
import { resolveSceneUnits } from '../../../utils/scene-units';
import type { GltfPlacementContext } from '../../../io/mesh3d-roundtrip/gltf-node-placement';

export interface ImportedMeshPlacementContext {
  readonly placement: GltfPlacementContext;
  /** Ο όροφος υποδοχής (= `layerId` της οντότητας, όπως και στα έπιπλα). */
  readonly layerId: string | null;
  readonly floorId?: string;
}

/** Το πλαίσιο τοποθέτησης για εισαγωγή στον **ενεργό** όροφο. */
export function useImportedMeshPlacementContext(): ImportedMeshPlacementContext {
  const { levels, currentLevelId, getLevelScene } = useLevels();

  const activeLevel = useMemo(
    () => levels.find((l) => l.id === currentLevelId) ?? null,
    [levels, currentLevelId],
  );
  const { floors: buildingFloors } = useFloorsByBuilding(activeLevel?.buildingId ?? null, true);
  const { buildings } = useFirestoreBuildings();

  return useMemo(() => {
    const datumM = resolveBuildingDatumElevationM(buildingFloors);
    const floorRef = buildingFloors.find((f) => f.id === activeLevel?.floorId);
    const building = buildings.find((b) => b.id === activeLevel?.buildingId);
    const scene = currentLevelId ? getLevelScene(currentLevelId) : null;

    return {
      placement: {
        // Οι διαστάσεις του κόμβου είναι σε μέτρα· η θέση πρέπει να εκφραστεί στις μονάδες ΤΟΥ
        // ΚΑΜΒΑ αυτής της σκηνής, αλλιώς ένα κάγκελο 2m προσγειώνεται 2 χιλιοστά μακριά.
        sceneUnits: resolveSceneUnits(scene ?? {}),
        floorElevationMm: resolveFloorDatumRelativeElevationMm(floorRef?.elevation, datumM),
        buildingBaseElevationM: building?.baseElevation ?? 0,
      },
      layerId: currentLevelId,
      floorId: activeLevel?.floorId,
    };
  }, [buildingFloors, buildings, activeLevel, currentLevelId, getLevelScene]);
}
