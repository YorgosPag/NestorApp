/**
 * SSoT ΚΑΤΑΛΟΓΟΣ των contextual ribbon tabs — pure data, μηδέν runtime εξάρτηση.
 *
 * Ο κατάλογος ζούσε inline μέσα στο `app/ribbon-contextual-config.ts`, το οποίο εισάγει
 * React + πέντε zustand stores για να λύσει ΠΟΙΟ tab είναι ενεργό. Η ίδια η λίστα όμως
 * είναι σκέτα δεδομένα: εξάγοντάς τη εδώ, ένα test μπορεί να διατρέξει κάθε contextual tab
 * χωρίς να στήσει stores — και ο έλεγχος πληρότητας του ADR-677 Φάση 2β (κάθε αριθμητικό
 * combobox δηλώνει `quantityKind`) γίνεται εφικτός.
 *
 * ⚠️ Νέο contextual tab → πρόσθεσέ το ΕΔΩ. Το `ribbon-contextual-config.ts` καταναλώνει
 * αυτή τη λίστα, οπότε μια παράλειψη σημαίνει ότι το tab δεν εμφανίζεται ΚΑΘΟΛΟΥ — ορατή
 * αστοχία, όχι σιωπηλό κενό κάλυψης.
 *
 * @see ../../../app/ribbon-contextual-config.ts — ο resolver ενεργού tab (stateful)
 * @see ./__tests__/ribbon-quantity-kind-coverage.test.ts — ο έλεγχος πληρότητας
 */

import type { RibbonTab } from '../types/ribbon-types';
import { CONTEXTUAL_TEXT_EDITOR_TAB } from './contextual-text-editor-tab';
import {
  CONTEXTUAL_ARRAY_RECT_TAB, CONTEXTUAL_ARRAY_POLAR_TAB, CONTEXTUAL_ARRAY_PATH_TAB,
} from './contextual-array-tab';
import { CONTEXTUAL_STAIR_TAB } from './contextual-stair-tab';
import { CONTEXTUAL_WALL_TAB } from './contextual-wall-tab';
import { CONTEXTUAL_OPENING_TAB } from './contextual-opening-tab';
import { CONTEXTUAL_SLAB_TAB } from './contextual-slab-tab';
import { CONTEXTUAL_ROOF_TAB } from './contextual-roof-tab';
import { CONTEXTUAL_COLUMN_TAB } from './contextual-column-tab';
import { CONTEXTUAL_BEAM_TAB } from './contextual-beam-tab';
import { CONTEXTUAL_FOUNDATION_TAB } from './contextual-foundation-tab';
import { CONTEXTUAL_SLAB_OPENING_TAB } from './contextual-slab-opening-tab';
import { DIMENSION_CONTEXTUAL_TAB } from './contextual-dimension-tab';
import { CONTEXTUAL_LINE_TOOL_TAB } from './contextual-line-tool-tab';
import { CONTEXTUAL_BLOCK_TAB } from './contextual-block-tab';
import { CONTEXTUAL_IMAGE_TAB } from './contextual-image-tab';
import { CONTEXTUAL_XLINE_MODE_TAB } from './contextual-xline-mode-tab';
import { CONTEXTUAL_SKETCH_TAB } from './contextual-sketch-tab';
import { CONTEXTUAL_SCALE_TOOL_TAB } from './contextual-scale-tool-tab';
import { CONTEXTUAL_MULTI_SELECTION_TAB } from './contextual-multi-selection-tab';
import { CONTEXTUAL_MEP_CIRCUIT_TAB } from './contextual-mep-circuit-tab';
import { CONTEXTUAL_MEP_PIPE_NETWORK_TAB } from './contextual-mep-pipe-network-tab';
import { CONTEXTUAL_MEP_FIXTURE_TAB } from './contextual-mep-fixture-tab';
import { CONTEXTUAL_MEP_FLOOR_DRAIN_TAB } from './contextual-mep-floor-drain-tab';
import { CONTEXTUAL_MEP_SANITARY_FIXTURE_TAB } from './contextual-mep-sanitary-fixture-tab';
import { CONTEXTUAL_MEP_APPLIANCE_FIXTURE_TAB } from './contextual-mep-appliance-fixture-tab';
import { CONTEXTUAL_MEP_SOCKET_TAB } from './contextual-mep-socket-tab';
import { CONTEXTUAL_MEP_DATA_OUTLET_TAB } from './contextual-mep-data-outlet-tab';
import { CONTEXTUAL_ELECTRICAL_PANEL_TAB } from './contextual-electrical-panel-tab';
import { CONTEXTUAL_MEP_MANIFOLD_TAB } from './contextual-mep-manifold-tab';
import { CONTEXTUAL_DRAINAGE_COLLECTOR_TAB } from './contextual-drainage-collector-tab';
import { CONTEXTUAL_MEP_RADIATOR_TAB } from './contextual-mep-radiator-tab';
import { CONTEXTUAL_MEP_BOILER_TAB } from './contextual-mep-boiler-tab';
import { CONTEXTUAL_MEP_WATER_HEATER_TAB } from './contextual-mep-water-heater-tab';
import { CONTEXTUAL_MEP_UNDERFLOOR_TAB } from './contextual-mep-underfloor-tab';
import { CONTEXTUAL_MEP_SEGMENT_TAB } from './contextual-mep-segment-tab';
import { CONTEXTUAL_MEP_FIXTURE_LIBRARY_TAB } from './contextual-mep-fixture-library-tab';
import { CONTEXTUAL_MEP_RISER_TAB } from './contextual-mep-riser-tab';
import { CONTEXTUAL_FURNITURE_TAB } from './contextual-furniture-tab';
import { CONTEXTUAL_GENERIC_SOLID_TAB } from './contextual-generic-solid-tab';
import { CONTEXTUAL_BLOCK_LIBRARY_TAB } from './contextual-block-library-tab';
import { CONTEXTUAL_TITLE_BLOCK_TAB } from './contextual-title-block-tab';
import { CONTEXTUAL_FLOORPLAN_SYMBOL_TAB } from './contextual-floorplan-symbol-tab';
import { CONTEXTUAL_ANNOTATION_SYMBOL_TAB } from './contextual-annotation-symbol-tab';
import { CONTEXTUAL_SCALE_BAR_TAB } from './contextual-scale-bar-tab';
import { CONTEXTUAL_FLOOR_FINISH_TAB } from './contextual-floor-finish-tab';
import { CONTEXTUAL_WALL_COVERING_TAB } from './contextual-wall-covering-tab';
import { CONTEXTUAL_HATCH_TAB } from './contextual-hatch-tab';
import { CONTEXTUAL_THERMAL_SPACE_TAB } from './contextual-thermal-space-tab';
import { ANIMATION_CONTEXTUAL_TAB } from './contextual-animation-tab';
import { CONTEXTUAL_GUIDES_TAB } from './contextual-guides-tab';
import { CONTEXTUAL_DIMENSIONS_TAB } from './contextual-dimensions-tab';
import { CONTEXTUAL_TOPO_SURFACE_TAB } from './contextual-topo-surface-tab';
import { CONTEXTUAL_IMPORTED_MESH_TAB } from './contextual-imported-mesh-tab';

/**
 * Κάθε contextual tab, ΠΡΙΝ το `withStandardLeadPanel` (ADR-581) προσθέσει το κοινό
 * αριστερό panel «Κλείσιμο + σύριγγα». Η κανονικοποιημένη μορφή που καταναλώνει το UI
 * είναι το `RIBBON_CONTEXTUAL_TABS` του `ribbon-contextual-config.ts`.
 */
export const RAW_RIBBON_CONTEXTUAL_TABS: readonly RibbonTab[] = [
  CONTEXTUAL_TEXT_EDITOR_TAB,
  CONTEXTUAL_ARRAY_RECT_TAB,
  CONTEXTUAL_ARRAY_POLAR_TAB,
  CONTEXTUAL_ARRAY_PATH_TAB,
  CONTEXTUAL_STAIR_TAB,
  CONTEXTUAL_WALL_TAB,
  CONTEXTUAL_OPENING_TAB,
  CONTEXTUAL_SLAB_TAB,
  CONTEXTUAL_ROOF_TAB,
  CONTEXTUAL_COLUMN_TAB,
  CONTEXTUAL_BEAM_TAB,
  CONTEXTUAL_FOUNDATION_TAB,
  CONTEXTUAL_SLAB_OPENING_TAB,
  DIMENSION_CONTEXTUAL_TAB,
  CONTEXTUAL_LINE_TOOL_TAB,
  CONTEXTUAL_BLOCK_TAB,
  CONTEXTUAL_IMAGE_TAB,
  CONTEXTUAL_XLINE_MODE_TAB,
  CONTEXTUAL_SKETCH_TAB,
  CONTEXTUAL_SCALE_TOOL_TAB,
  CONTEXTUAL_MULTI_SELECTION_TAB,
  CONTEXTUAL_MEP_CIRCUIT_TAB,
  CONTEXTUAL_MEP_PIPE_NETWORK_TAB,
  CONTEXTUAL_MEP_FIXTURE_TAB,
  CONTEXTUAL_MEP_FLOOR_DRAIN_TAB,
  CONTEXTUAL_MEP_SANITARY_FIXTURE_TAB,
  CONTEXTUAL_MEP_APPLIANCE_FIXTURE_TAB,
  CONTEXTUAL_MEP_SOCKET_TAB,
  CONTEXTUAL_MEP_DATA_OUTLET_TAB,
  CONTEXTUAL_ELECTRICAL_PANEL_TAB,
  CONTEXTUAL_MEP_MANIFOLD_TAB,
  CONTEXTUAL_DRAINAGE_COLLECTOR_TAB,
  CONTEXTUAL_MEP_RADIATOR_TAB,
  CONTEXTUAL_MEP_BOILER_TAB,
  CONTEXTUAL_MEP_WATER_HEATER_TAB,
  CONTEXTUAL_MEP_UNDERFLOOR_TAB,
  CONTEXTUAL_MEP_SEGMENT_TAB,
  CONTEXTUAL_MEP_FIXTURE_LIBRARY_TAB,
  CONTEXTUAL_MEP_RISER_TAB,
  CONTEXTUAL_FURNITURE_TAB,
  CONTEXTUAL_GENERIC_SOLID_TAB,
  CONTEXTUAL_BLOCK_LIBRARY_TAB,
  CONTEXTUAL_TITLE_BLOCK_TAB,
  CONTEXTUAL_FLOORPLAN_SYMBOL_TAB,
  CONTEXTUAL_ANNOTATION_SYMBOL_TAB,
  CONTEXTUAL_SCALE_BAR_TAB,
  CONTEXTUAL_FLOOR_FINISH_TAB,
  CONTEXTUAL_WALL_COVERING_TAB,
  CONTEXTUAL_HATCH_TAB,
  CONTEXTUAL_THERMAL_SPACE_TAB,
  ANIMATION_CONTEXTUAL_TAB,
  CONTEXTUAL_GUIDES_TAB,
  CONTEXTUAL_DIMENSIONS_TAB,
  // ADR-662 Φ2β Stage C — επιλεγμένη τοπογραφική επιφάνεια → «Τοπογραφική Επιφάνεια» tab.
  CONTEXTUAL_TOPO_SURFACE_TAB,
  // ADR-683 Φ3.1β — επιλεγμένο εισαγόμενο πλέγμα → «Εισαγόμενο Πλέγμα» tab (ανάθεση προμέτρησης).
  CONTEXTUAL_IMPORTED_MESH_TAB,
];
