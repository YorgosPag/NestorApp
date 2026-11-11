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

/**
 * **Γιατί** η λίστα είναι ό,τι είναι — η κενή λίστα έχει τρεις διαφορετικές αιτίες και ο άνθρωπος πρέπει να τις ξεχωρίζει
 * (live 2026-11-11: κάτοψη μόνο με γραμμές DXF έλεγε «δεν βρέθηκαν ανοίγματα» ενώ έλειπε όλο το μοντέλο). Όπως Revit
 * («Use Building Elements») και ArchiCAD (Energy Evaluation): ο προσανατολισμός βγαίνει **μόνο** από στοιχεία μοντέλου.
 * - `no-model`    — καμία οντότητα τοίχου BIM στη σκηνή (σκέτες γραμμές DXF)·
 * - `no-envelope` — υπάρχουν τοίχοι, αλλά κανένας δεν αναγνωρίστηκε εξωτερικός (`resolveExteriorWallIds`)·
 * - `derived`     — υπάρχει κέλυφος· οι `values` μπορεί να είναι κενές (κανένα άνοιγμα στο όριο).
 */
export type FloorplanOrientationProposalStatus = 'no-model' | 'no-envelope' | 'derived';

export interface FloorplanOrientationProposal {
  readonly status: FloorplanOrientationProposalStatus;
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
    const northAssumed = geo === null;
    const walls = scene.entities.filter(isWallEntity);
    if (walls.length === 0) return { status: 'no-model', values: [], northAssumed };
    const sceneUnits = resolveSceneUnits(scene);
    const exteriorWallIds = resolveExteriorWallIds(walls, sceneUnits);
    if (exteriorWallIds.size === 0) return { status: 'no-envelope', values: [], northAssumed };
    const values = derivePropertyOrientations({
      polygon: polygon.map(overlayVertexToPoint2D),
      openings: scene.entities.filter(isOpeningEntity),
      exteriorWallIds,
      tol: OPENING_ON_BOUNDARY_TOL_M / sceneUnitsToMeters(sceneUnits),
      northRotationDeg: geo?.rotationDeg ?? 0,
    });
    return { status: 'derived', values, northAssumed };
  }, [scene, polygon, geo]);
}
