/**
 * envelope-material-resolver — ADR-396 Phase P5 — material resolution για το 3D
 * κέλυφος θερμοπρόσοψης (ETICS).
 *
 * Resolution chain (mirror `stair-material-resolver`, ADR-370 Phase 5):
 *   1. ρητό `mat-*` id (pass-through στο MaterialCatalog3D PBR registry)
 *   2. element-type default (`elem-envelope` — insulation-board tint)
 *
 * Τα ETICS presets (`mat-eps-graphite` / `mat-xps`, βλ. P1 thermal-envelope-types)
 * ΔΕΝ έχουν δικό τους PBR entry — η μόνωση ζωγραφίζεται ενιαία με το `elem-envelope`
 * insulation tint (parity με το 2D που χρησιμοποιεί ένα hatch family). Dedicated
 * per-material insulation PBR = future polish αν το ζητήσει ο Giorgio.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-396-bim-external-thermal-envelope-etics.md §3, §5, §7 (P5)
 * @see ./MaterialCatalog3D (getMaterial3D / getElementMaterial3D — SSoT PBR registry)
 */

import type * as THREE from 'three';
import type { EnvelopeMaterialId } from '../../bim/types/thermal-envelope-types';
import { getMaterial3D, getElementMaterial3D } from './MaterialCatalog3D';

/**
 * Επιλύει το PBR material του κελύφους από το `ThermalEnvelopeSpec.materialId`.
 * Free-form ETICS presets (graphite EPS / XPS) → το ενιαίο `elem-envelope` tint.
 */
export function resolveEnvelopeMaterial(materialId: EnvelopeMaterialId): THREE.MeshStandardMaterial {
  // Ρητό mat-* id → απευθείας στο PBR registry (prefix-match στο MaterialCatalog3D).
  if (typeof materialId === 'string' && materialId.startsWith('mat-') && !materialId.startsWith('mat-eps') && !materialId.startsWith('mat-xps')) {
    return getMaterial3D(materialId);
  }
  // Insulation presets (mat-eps-graphite / mat-xps) + οτιδήποτε άλλο → ενιαίο tint.
  return getElementMaterial3D('envelope');
}
