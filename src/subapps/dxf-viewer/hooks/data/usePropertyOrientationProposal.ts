/**
 * **Η πρόταση προσανατολισμού για το πολύγωνο ενός ακινήτου στην κάτοψη** (ADR-937 Φάση Β) — ζωντανά, από τη σκηνή του
 * ενεργού ορόφου και τη γεωαναφορά του έργου.
 *
 * 🔑 Χαμηλής συχνότητας συνδρομές μόνο (σκηνή · γεωαναφορά) — καταναλωτής είναι το πάνελ ιδιοτήτων του overlay, όχι
 *    ορχηστρωτής του καμβά (ADR-040).
 * 🔑 Χωρίς γεωαναφορά ο Βορράς **θεωρείται** +Y και το λέμε (`northAssumed`) — ο άνθρωπος αποφασίζει αν εμπιστεύεται.
 */

import { useMemo, useSyncExternalStore } from 'react';

import type { OrientationType } from '@/constants/property-features-enterprise';

import { derivePropertyOrientations } from '../../bim/orientation-proposal/derive-property-orientations';
import { resolveExteriorWallIds } from '../../bim/geometry/exterior-wall-ids';
import { getGeoReference, subscribeGeoReference } from '../../systems/geo-referencing/geo-reference-store';
import { useCurrentLevelScene } from '../../systems/levels/useCurrentLevelScene';
import { isOpeningEntity, isWallEntity } from '../../types/entities';
import { overlayVertexToPoint2D } from '../../utils/entity-conversion';
import { resolveSceneUnits, sceneUnitsToMeters } from '../../utils/scene-units';

/**
 * Ανοχή «το άνοιγμα κάθεται στο όριο του ακινήτου» (m). Το πολύγωνο σχεδιάζεται συνήθως στην εξωτερική ή στην εσωτερική
 * παρειά, ενώ η θέση του ανοίγματος είναι στον άξονα του τοίχου ⇒ αρκεί λίγο πάνω από το μισό πάχος ενός χοντρού τοίχου.
 */
const OPENING_ON_BOUNDARY_TOL_M = 0.6;

export interface FloorplanOrientationProposal {
  readonly values: readonly OrientationType[];
  readonly northAssumed: boolean;
}

export function usePropertyOrientationProposal(
  polygon: ReadonlyArray<[number, number]> | undefined,
): FloorplanOrientationProposal | null {
  const scene = useCurrentLevelScene();
  const geo = useSyncExternalStore(subscribeGeoReference, getGeoReference, getGeoReference);

  return useMemo(() => {
    if (!scene || !polygon || polygon.length < 3) return null;
    const walls = scene.entities.filter(isWallEntity);
    const sceneUnits = resolveSceneUnits(scene);
    const values = derivePropertyOrientations({
      polygon: polygon.map(overlayVertexToPoint2D),
      openings: scene.entities.filter(isOpeningEntity),
      exteriorWallIds: resolveExteriorWallIds(walls, sceneUnits),
      tol: OPENING_ON_BOUNDARY_TOL_M / sceneUnitsToMeters(sceneUnits),
      northRotationDeg: geo?.rotationDeg ?? 0,
    });
    return { values, northAssumed: geo === null };
  }, [scene, polygon, geo]);
}
