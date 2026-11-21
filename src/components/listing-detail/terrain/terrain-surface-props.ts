/**
 * @fileoverview Τα **props** των τεμπέλικων επιφανειών του ανάγλυφου (ADR-920 Β6.6) — μόνο τύποι.
 * @related ./terrain-surfaces (το μητρώο) · ./TerrainSnapshotStage · ./3d/Terrain3dCanvas
 * @module components/listing-detail/terrain/terrain-surface-props
 *
 * ⚠️ **Γιατί χωριστό αρχείο**: ο γράφος της πύλης 3.34 μετρά και το `import type` ως ακμή. Αν το μητρώο εισήγαγε τον
 *   τύπο από το ίδιο το component, θα έσερνε όλη την επιφάνεια (χάρτη, 3Δ και τα κείμενά τους) πίσω στη στατική
 *   κλειστότητα της σελίδας — μετρημένο: slice της αγγελίας 26.321 bytes με την ακμή, ίδιο με χωρίς όριο. Εδώ ζουν μόνο
 *   τύποι από το `lib`, χωρίς κανένα component.
 */

import type { ListingTerrain3dExaggeration } from '@/lib/terrain/publication/listing-terrain-config';
import type { ListingTerrainSnapshot } from '@/lib/terrain/publication/listing-terrain-types';

export interface TerrainSnapshotStageProps {
  readonly snapshot: ListingTerrainSnapshot;
  /** `terrainMapWidthClassOf` του πλάτους που φαίνεται· `null` = δεν μετρήθηκε. */
  readonly widthClass: number | null;
}

export interface Terrain3dCanvasProps {
  readonly snapshot: ListingTerrainSnapshot;
  readonly exaggeration: ListingTerrain3dExaggeration;
  /** Χαμένο πλαίσιο GPU ή γεωμετρία που δεν χτίστηκε — ο καταναλωτής δείχνει ονομασμένη αποτυχία. */
  readonly onFailed: () => void;
}
