/**
 * BIM 3D Converter Types — SSoT των entity types που παράγουν 3D geometry μέσω
 * `BimSceneLayer.syncFloorEntities()` (ADR-550 Φ3 introspection).
 *
 * Το 3D dispatch είναι imperative per-family sync loops (όχι introspectable map
 * όπως το 2D `EntityRendererComposite`). Αυτή η λίστα κωδικοποιεί ρητά ποια types
 * χτίζονται, ώστε το coverage test να μπορεί να επιβεβαιώσει τη συμμετρία 2D↔3D.
 *
 * ⚠️ SSoT συντήρησης: όταν προστίθεται/αφαιρείται `sync*()` στο `BimSceneLayer`,
 * ΕΝΗΜΕΡΩΣΕ αυτή τη λίστα. Το `__tests__/entity-render-coverage.test.ts` (μέσω
 * του `ENTITY_RENDER_SURFACES.d3`) σπάει αν αποκλίνει από το δηλωτικό μητρώο.
 *
 * @see BimSceneLayer.syncFloorEntities — η πηγή αλήθειας του dispatch
 * @see rendering/contract/entity-render-surfaces.ts — το δηλωτικό μητρώο
 */

import type { BimRenderableType } from '../../rendering/contract/renderable-entity-type';

/** Entity types με ζωντανό 3D converter στο `BimSceneLayer` (αλφαβητικά). */
export const BIM_3D_CONVERTER_TYPES: readonly BimRenderableType[] = [
  'beam',
  'column',
  'electrical-panel',
  'floor-finish',
  'foundation',
  'furniture',
  'mep-boiler',
  'mep-fitting',
  'mep-fixture',
  'mep-manifold',
  'mep-radiator',
  'mep-segment',
  'mep-underfloor',
  'mep-water-heater',
  'opening', // cutout/reveal μέσα στο wall group (syncWalls)
  'railing',
  'roof',
  'slab',
  'slab-opening', // pick-mesh στο κενό (syncSlabs, ADR-535 Φ3b)
  'stair',
  'wall',
];
