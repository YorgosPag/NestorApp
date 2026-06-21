/**
 * Wall Covering — Room-use → Assembly defaults (ADR-511 Slice C «το μαγικό»).
 *
 * Auto-πρόταση compound assembly **ανά χρήση δωματίου** (`ThermalSpaceUseType`): υγροί χώροι
 * (μπάνιο/wc) → κόλλα + πλακίδια· κουζίνα → σοβάς + πλακίδια· ξηροί χώροι (υπνοδωμάτιο/σαλόνι/
 * γραφείο/διάδρομος) → σοβάς + λευκή μπογιά· generic → σοβάς + λευκή μπογιά. Αυτό λύνει «τα
 * χέρια» (Giorgio): ένα κλικ γεμίζει κάθε δωμάτιο με το σωστό φινίρισμα, editable per region.
 *
 * Reuse catalog defaults (`getWallCoveringDefault*`) — μηδέν hardcoded πάχη. Pure.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-511-wall-finish-per-room.md
 * @see bim/types/thermal-space-types.ts — ThermalSpaceUseType (ΤΟΤΕΕ)
 */

import type { ThermalSpaceUseType } from '../types/thermal-space-types';
import type { WallCoveringLayer } from '../types/wall-covering-types';
import { DEFAULT_WALL_COVERING_LAYERS } from '../types/wall-covering-types';
import { makeWallCoveringLayer } from './wall-covering-layers';

/** Πλακιδιωμένος τοίχος (υγρός χώρος): κόλλα + κεραμικό πλακίδιο. */
const TILED_WET: readonly WallCoveringLayer[] = [
  makeWallCoveringLayer('adhesive-mortar'),
  makeWallCoveringLayer('tile-ceramic'),
];

/** Κουζίνα: σοβάς + πλακίδιο (splashback-grade). */
const KITCHEN: readonly WallCoveringLayer[] = [
  makeWallCoveringLayer('plaster-traditional'),
  makeWallCoveringLayer('tile-ceramic'),
];

/**
 * Επιστρέφει το προτεινόμενο assembly για μια χρήση δωματίου. Pure & deterministic.
 * Άγνωστη/generic χρήση → `DEFAULT_WALL_COVERING_LAYERS` (σοβάς + λευκή μπογιά).
 */
export function wallCoveringLayersForUseType(useType: ThermalSpaceUseType): readonly WallCoveringLayer[] {
  switch (useType) {
    case 'bathroom':
    case 'wc':
      return TILED_WET;
    case 'kitchen':
      return KITCHEN;
    case 'bedroom':
    case 'living-room':
    case 'office':
    case 'hallway':
    case 'generic':
    default:
      return DEFAULT_WALL_COVERING_LAYERS;
  }
}
