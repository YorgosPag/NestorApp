/**
 * **Το ΕΝΑ SSoT κελύφους** (ADR-937 2026-11-13 · ADR-396 §3.1.4 · ADR-422).
 *
 * «Πού τελειώνει το κτίριο και πού αρχίζει ο έξω αέρας;» — μία απάντηση για όλους:
 * ETICS (2D/3D/BOQ/IFC), προσανατολισμό ακινήτου, θερμικά φορτία, μάζες γειτονικών κτιρίων.
 *
 * = ένωση αποτυπωμάτων **τοίχων + κολωνών + δοκαριών** (`computeBuildingFootprint`, polygon-clipping)
 *   + ταξινόμηση δακτυλίων (`classifyFootprintRegions`: εξωτερικός · αίθριο · δωμάτιο · ανοιχτή δομή).
 *
 * Γιατί ένωση και όχι γράφος τοίχων (το αποσυρμένο `computeEnvelopePerimeter`):
 * - οι **κολώνες** κλείνουν το κέλυφος όπως στην πραγματικότητα (live 2026-11-13: κάθε ανοιχτό άκρο τοίχου
 *   κάθονταν πάνω σε κολώνα του σχεδίου που ο γράφος δεν έβλεπε)·
 * - οι **εσοχές** μένουν εσοχές (κανένα convex hull) ⇒ κοινόχρηστη σκάλα σε λωρίδα ανάμεσα σε τοίχους μένει
 *   ΕΞΩ από το όριο (απόφαση Giorgio (ii) — Revit Room Bounding / ArchiCAD Zone: το όριο ακολουθεί τα στοιχεία)·
 * - **εσωτερικός** τοίχος που ακουμπά το κέλυφος βλέπει δωμάτια (τρύπες), όχι έξω αέρα ⇒ δεν μετρά εξωτερικός.
 *
 * Pure — canvas units in/out. Μηδέν React / Firestore.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-937-property-orientation-sun-exposure.md §2.2
 */

import type { SceneUnits } from '../../utils/scene-units';
import {
  computeBuildingFootprint,
  type BeamForFootprint,
  type BuildingFootprintResult,
  type FootprintRing,
  type FootprintSourceType,
} from './building-footprint';
import {
  classifyFootprintRegions,
  type ClassifiedFootprintRing,
  type FootprintClassificationResult,
  type SlabRegionFootprint,
} from './footprint-region-classifier';
import type { ColumnForEnvelope, WallForEnvelope } from './envelope-types';

export interface EnvelopeTopology {
  readonly footprint: BuildingFootprintResult;
  readonly classification: FootprintClassificationResult;
}

export interface EnvelopeTopologyOptions {
  readonly sceneUnits?: SceneUnits;
  readonly coverageThreshold?: number;
}

const EMPTY_TOPOLOGY: EnvelopeTopology = {
  footprint: { components: [], outerRings: [], holes: [] },
  classification: { rings: [], exterior: [], atria: [], interiorRooms: [], openStructures: [] },
};

/**
 * @param slabsAbove - αποτυπώματα πλακών ψηλότερων ορόφων (`resolveSlabsAboveForLevel`). Κενό ⇒ κάθε τρύπα
 *                     = δωμάτιο (κανένα αίθριο) — η ασφαλής προεπιλογή του classifier.
 */
export function resolveEnvelopeTopology(
  walls: readonly WallForEnvelope[],
  columns: readonly ColumnForEnvelope[],
  beams: readonly BeamForFootprint[],
  slabsAbove: readonly SlabRegionFootprint[] = [],
  options?: EnvelopeTopologyOptions,
): EnvelopeTopology {
  if (walls.length === 0 && columns.length === 0 && beams.length === 0) return EMPTY_TOPOLOGY;
  const units =
    options?.sceneUnits ?? walls[0]?.params.sceneUnits ?? columns[0]?.params.sceneUnits ?? beams[0]?.params.sceneUnits;
  const footprint = computeBuildingFootprint(walls, columns, beams, units);
  const classification = classifyFootprintRegions(footprint, slabsAbove, {
    coverageThreshold: options?.coverageThreshold,
  });
  return { footprint, classification };
}

/**
 * Δακτύλιοι που **βλέπουν έξω αέρα**: το εξώτατο όριο κάθε συνιστώσας (κλειστής **ή** ανοιχτής — μια ανοιχτή
 * δομή έχει έξω αέρα και στις δύο πλευρές) + τα ακάλυπτα αίθρια. Τα δωμάτια (σκεπασμένες τρύπες) εξαιρούνται.
 */
function outsideAirRings(topology: EnvelopeTopology): readonly ClassifiedFootprintRing[] {
  const c = topology.classification;
  return [...c.exterior, ...c.openStructures, ...c.atria];
}

/** Id των στοιχείων του τύπου `type` που έχουν ≥1 ακμή σε δακτύλιο προς έξω αέρα. */
export function outsideAirEntityIds(
  topology: EnvelopeTopology,
  type: FootprintSourceType = 'wall',
): Set<string> {
  const ids = new Set<string>();
  for (const cr of outsideAirRings(topology)) {
    for (const edge of cr.ring.edges) {
      if (edge.sourceEntityType === type && edge.sourceEntityId) ids.add(edge.sourceEntityId);
    }
  }
  return ids;
}

/** Τα εξώτατα όρια των συνιστωσών που **περικλείουν χώρο** — το όριο ενός κτιρίου/ακινήτου σε κάτοψη. */
export function enclosedExteriorRings(topology: EnvelopeTopology): readonly FootprintRing[] {
  return topology.classification.exterior.map((cr) => cr.ring);
}

/** Υπάρχει δομή (τοίχοι/κολώνες) που **δεν** κλείνει χώρο; Το ερώτημα του «Not Enclosed». */
export function hasOpenStructure(topology: EnvelopeTopology): boolean {
  return topology.classification.openStructures.length > 0;
}
