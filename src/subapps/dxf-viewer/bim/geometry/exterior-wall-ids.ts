/**
 * **Εξωτερικοί τοίχοι** = όσοι έχουν παρειά σε δακτύλιο του κελύφους που βλέπει **έξω αέρα**
 * (`envelope-topology.ts` — το ΕΝΑ SSoT κελύφους: ένωση τοίχων + κολωνών + δοκαριών).
 *
 * Το ίδιο ερώτημα «ποιος τοίχος βλέπει έξω;» το κάνουν δύο καταναλωτές: τα θερμικά φορτία (ADR-422) και η πρόταση
 * προσανατολισμού ακινήτου (ADR-937). Μία απάντηση — η ίδια που μονώνει το ETICS (ADR-396).
 *
 * `resolveExteriorEnvelope` δίνει **και** τα όρια που περικλείουν χώρο (το όριο του ακινήτου σε κάτοψη ακινήτου,
 * ADR-937 §2.2 — με τις εσοχές του, π.χ. κοινόχρηστη σκάλα μένει ΕΞΩ) **και** τα id των τοίχων, από **έναν**
 * υπολογισμό.
 */

import type { BimPoint } from '../types/bim-base';
import { isBeamEntity, isColumnEntity, isWallEntity, type Entity } from '../../types/entities';
import type { SceneUnits } from '../../utils/scene-units';
import type { BeamForFootprint } from './building-footprint';
import type { SlabRegionFootprint } from './footprint-region-classifier';
import type { ColumnForEnvelope, WallForEnvelope } from './envelope-types';
import {
  enclosedExteriorRings,
  hasOpenStructure,
  outsideAirEntityIds,
  resolveEnvelopeTopology,
} from './envelope-topology';

/** Τα στοιχεία του επιπέδου που συμμετέχουν στο κέλυφος (ό,τι μπαίνει στην ένωση αποτυπωμάτων). */
export interface EnvelopeElements {
  readonly walls: readonly WallForEnvelope[];
  readonly columns: readonly ColumnForEnvelope[];
  readonly beams: readonly BeamForFootprint[];
}

/** Τοίχοι + κολώνες + δοκάρια μιας σκηνής — η ΜΙΑ επιλογή εισόδων του κελύφους για κάθε καταναλωτή. */
export function collectEnvelopeElements(entities: readonly Entity[]): EnvelopeElements {
  return {
    walls: entities.filter(isWallEntity),
    columns: entities.filter(isColumnEntity),
    beams: entities.filter(isBeamEntity),
  };
}

export interface ExteriorEnvelope {
  /** Εξώτατα όρια που **περικλείουν** χώρο (κλειστά πολύγωνα, canvas units). */
  readonly boundaries: readonly (readonly BimPoint[])[];
  /** Τοίχοι με παρειά προς έξω αέρα (εξώτατο όριο κάθε συνιστώσας + ακάλυπτα αίθρια). */
  readonly wallIds: ReadonlySet<string>;
  /** Υπάρχει δομή που **δεν** κλείνει χώρο («Not Enclosed»). */
  readonly hasOpenStructure: boolean;
}

export function resolveExteriorEnvelope(
  elements: EnvelopeElements,
  sceneUnits: SceneUnits,
  slabsAbove: readonly SlabRegionFootprint[] = [],
): ExteriorEnvelope {
  const topology = resolveEnvelopeTopology(elements.walls, elements.columns, elements.beams, slabsAbove, {
    sceneUnits,
  });
  return {
    boundaries: enclosedExteriorRings(topology).map((ring) => ring.points.points),
    wallIds: outsideAirEntityIds(topology, 'wall'),
    hasOpenStructure: hasOpenStructure(topology),
  };
}

export function resolveExteriorWallIds(
  elements: EnvelopeElements,
  sceneUnits: SceneUnits,
  slabsAbove: readonly SlabRegionFootprint[] = [],
): Set<string> {
  return new Set(resolveExteriorEnvelope(elements, sceneUnits, slabsAbove).wallIds);
}
