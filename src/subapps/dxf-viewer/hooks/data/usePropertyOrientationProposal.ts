/**
 * **Η πρόταση προσανατολισμού για ένα ακίνητο στην κάτοψη** (ADR-937 Φάση Β) — ζωντανά, από τη σκηνή του ενεργού
 * επιπέδου και τη γεωαναφορά του έργου.
 *
 * Το **όριο** του ακινήτου έρχεται από δύο πηγές (ADR-937 §2.2):
 * - `polygon`  — κάτοψη ορόφου: το πολύγωνο του overlay `kind:'property'`·
 * - `envelope` — κάτοψη ακινήτου (`floorplanType: 'unit'`): όλη η κάτοψη **είναι** το ακίνητο ⇒ όριο = το εξώτατο όριο
 *   κάθε συνιστώσας του κελύφους που περικλείει χώρο (Revit Gross Area · ArchiCAD Zone «Gross»). Πηγή = το ΕΝΑ SSoT
 *   κελύφους (`envelope-topology.ts`: ένωση τοίχων + κολωνών + δοκαριών) — οι εσοχές μένουν εσοχές, άρα κοινόχρηστη
 *   σκάλα σε λωρίδα ανάμεσα σε τοίχους μένει ΕΞΩ από το ακίνητο (ADR-937 2026-11-13, απόφαση (ii)).
 *
 * 🔑 Χαμηλής συχνότητας συνδρομές μόνο (σκηνή · γεωαναφορά) — καταναλωτής είναι πάνελ, όχι ορχηστρωτής του καμβά
 *    (ADR-040).
 * 🔑 Χωρίς γεωαναφορά ο Βορράς **θεωρείται** +Y και το λέμε (`northAssumed`) — ο άνθρωπος αποφασίζει αν εμπιστεύεται.
 */

import { useMemo, useSyncExternalStore } from 'react';

import type { OrientationType } from '@/constants/property-features-enterprise';
import type { PlanarPoint } from '@/lib/geometry/planar-polygon';

import { deriveOrientationsOverBoundaries } from '../../bim/orientation-proposal/derive-property-orientations';
import {
  collectEnvelopeElements,
  resolveExteriorEnvelope,
  type ExteriorEnvelope,
} from '../../bim/geometry/exterior-wall-ids';
import { resolveSlabsAboveForLevel } from '../../bim/geometry/footprint-region-classifier';
import { getEnvelopeFloorSlabs, subscribeEnvelopeFloorSlabs } from '../../bim/stores/envelope-floor-slabs-store';
import { getGeoReference, subscribeGeoReference } from '../../systems/geo-referencing/geo-reference-store';
import { useCurrentLevelScene } from '../../systems/levels/useCurrentLevelScene';
import { isOpeningEntity } from '../../types/entities';
import { overlayVertexToPoint2D } from '../../utils/entity-conversion';
import { resolveSceneUnits, sceneUnitsToMeters } from '../../utils/scene-units';

/**
 * Ανοχή «το άνοιγμα κάθεται στο όριο του ακινήτου» (m). Το όριο είναι συνήθως στην εξωτερική ή στην εσωτερική παρειά,
 * ενώ η θέση του ανοίγματος είναι στον άξονα του τοίχου ⇒ αρκεί λίγο πάνω από το μισό πάχος ενός χοντρού τοίχου.
 */
const OPENING_ON_BOUNDARY_TOL_M = 0.6;

/**
 * **Γιατί** η λίστα είναι ό,τι είναι — η κενή λίστα έχει τρεις διαφορετικές αιτίες και ο άνθρωπος πρέπει να τις ξεχωρίζει
 * (live 2026-11-11: κάτοψη μόνο με γραμμές DXF έλεγε «δεν βρέθηκαν ανοίγματα» ενώ έλειπε όλο το μοντέλο). Όπως Revit
 * («Use Building Elements») και ArchiCAD (Energy Evaluation): ο προσανατολισμός βγαίνει **μόνο** από στοιχεία μοντέλου.
 * - `no-model`    — καμία οντότητα τοίχου BIM στη σκηνή (σκέτες γραμμές DXF)·
 * - `no-envelope`   — υπάρχουν τοίχοι, αλλά κανένας δεν αναγνωρίστηκε εξωτερικός (`resolveExteriorEnvelope`)·
 * - `open-envelope` — κάτοψη ακινήτου: υπάρχουν εξωτερικοί τοίχοι, αλλά **καμία** συνιστώσα του κελύφους δεν κλείνει ⇒ δεν
 *   ορίζεται όριο (Revit «Not Enclosed» για Room/Area). Live 2026-11-12: 38 τοίχοι από το σχέδιο με ανένωτες γωνίες (κενά
 *   0,1–1,45 m) έλεγαν «δεν βρέθηκαν ανοίγματα» ενώ 12 ανοίγματα κάθονταν στην περίμετρο·
 * - `derived`       — υπάρχει όριο· οι `values` μπορεί να είναι κενές (κανένα άνοιγμα στο όριο).
 */
export type FloorplanOrientationProposalStatus = 'no-model' | 'no-envelope' | 'open-envelope' | 'derived';

export interface FloorplanOrientationProposal {
  readonly status: FloorplanOrientationProposalStatus;
  readonly values: readonly OrientationType[];
  readonly northAssumed: boolean;
}

/** Από πού έρχεται το όριο του ακινήτου (δες την κεφαλίδα). */
export type PropertyBoundarySource =
  | { readonly kind: 'polygon'; readonly polygon: ReadonlyArray<[number, number]> }
  | { readonly kind: 'envelope' };

/** Σταθερή αναφορά για την κάτοψη ακινήτου — ώστε το `useMemo` να μην ξαναϋπολογίζει σε κάθε render. */
export const ENVELOPE_BOUNDARY: PropertyBoundarySource = { kind: 'envelope' };

/**
 * Τα όρια σε σημεία σκηνής. Στο `envelope` μετρούν μόνο όρια που **περικλείουν** χώρο: η «εξωτερική κάθετος» μιας
 * ανοιχτής δομής (Π / L) δεν ορίζεται — καμία μαντεψιά.
 */
function boundaryPolygons(source: PropertyBoundarySource, envelope: ExteriorEnvelope): PlanarPoint[][] {
  if (source.kind === 'polygon') return [source.polygon.map(overlayVertexToPoint2D)];
  return envelope.boundaries
    .filter((ring) => ring.length >= 3)
    .map((ring) => ring.map((p) => ({ x: p.x, y: p.y })));
}

function isDegenerate(source: PropertyBoundarySource | undefined): boolean {
  return !source || (source.kind === 'polygon' && source.polygon.length < 3);
}

export function usePropertyOrientationProposal(
  source: PropertyBoundarySource | undefined,
): FloorplanOrientationProposal | null {
  const scene = useCurrentLevelScene();
  const geo = useSyncExternalStore(subscribeGeoReference, getGeoReference, getGeoReference);
  // Πλάκες ψηλότερων ορόφων ⇒ ακάλυπτο αίθριο = έξω αέρας (ίδια πηγή με το ETICS, ADR-396 §3.1.5).
  const floorSlabs = useSyncExternalStore(subscribeEnvelopeFloorSlabs, getEnvelopeFloorSlabs, getEnvelopeFloorSlabs);

  return useMemo(() => {
    if (!scene || !source || isDegenerate(source)) return null;
    const northAssumed = geo === null;
    const elements = collectEnvelopeElements(scene.entities);
    if (elements.walls.length === 0) return { status: 'no-model', values: [], northAssumed };
    const sceneUnits = resolveSceneUnits(scene);
    const slabsAbove = resolveSlabsAboveForLevel(floorSlabs.slabs, floorSlabs.floors, floorSlabs.activeFloorId);
    const envelope = resolveExteriorEnvelope(elements, sceneUnits, slabsAbove);
    if (envelope.wallIds.size === 0) return { status: 'no-envelope', values: [], northAssumed };
    const polygons = boundaryPolygons(source, envelope);
    if (polygons.length === 0) return { status: 'open-envelope', values: [], northAssumed };
    const values = deriveOrientationsOverBoundaries({
      polygons,
      openings: scene.entities.filter(isOpeningEntity),
      exteriorWallIds: envelope.wallIds,
      tol: OPENING_ON_BOUNDARY_TOL_M / sceneUnitsToMeters(sceneUnits),
      northRotationDeg: geo?.rotationDeg ?? 0,
    });
    return { status: 'derived', values, northAssumed };
  }, [scene, source, geo, floorSlabs]);
}
