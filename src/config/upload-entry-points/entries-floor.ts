/**
 * =============================================================================
 * Upload Entry Points — Floor Entries (4 entries)
 * =============================================================================
 *
 * Floor-level upload entry points for floorplans and construction drawings.
 * Used by FloorFloorplanInline in the Floors tab of Building Management.
 *
 * @module config/upload-entry-points/entries-floor
 * @enterprise ADR-031
 */

import type { UploadEntryPoint } from './types';
import { FLOORPLAN_PURPOSES } from '@/config/domain-constants';

/**
 * Floor (building storey) upload entry points.
 */
export const FLOOR_ENTRY_POINTS: UploadEntryPoint[] = [
  // ------------------------------------------------------------------------
  // ΣΧΕΔΙΑ ΟΡΟΦΟΥ (Floorplans)
  // ------------------------------------------------------------------------
  {
    id: 'floor-floor-plan',
    purpose: FLOORPLAN_PURPOSES.FLOOR,
    domain: 'construction',
    category: 'floorplans',
    label: {
      el: 'Κάτοψη Ορόφου',
      en: 'Floor Plan',
    },
    description: {
      el: 'Αρχιτεκτονική κάτοψη ορόφου (DXF/PDF)',
      en: 'Architectural floor plan (DXF/PDF)',
    },
    icon: 'LayoutGrid',
    order: 1,
  },
  {
    id: 'floor-section-drawing',
    purpose: FLOORPLAN_PURPOSES.FLOOR_SECTION,
    domain: 'construction',
    category: 'floorplans',
    label: {
      el: 'Τομή Ορόφου',
      en: 'Floor Section Drawing',
    },
    description: {
      el: 'Αρχιτεκτονική τομή ορόφου',
      en: 'Architectural section of floor',
    },
    icon: 'Scissors',
    order: 2,
  },
  {
    id: 'floor-electrical-plan',
    purpose: FLOORPLAN_PURPOSES.FLOOR_ELECTRICAL,
    domain: 'construction',
    category: 'floorplans',
    label: {
      el: 'Ηλεκτρολογικά Ορόφου',
      en: 'Floor Electrical Plan',
    },
    description: {
      el: 'Σχέδια ηλεκτρολογικών εγκαταστάσεων ορόφου',
      en: 'Floor electrical installation drawings',
    },
    icon: 'Zap',
    order: 3,
  },
  {
    id: 'floor-plumbing-plan',
    purpose: FLOORPLAN_PURPOSES.FLOOR_PLUMBING,
    domain: 'construction',
    category: 'floorplans',
    label: {
      el: 'Υδραυλικά Ορόφου',
      en: 'Floor Plumbing Plan',
    },
    description: {
      el: 'Σχέδια υδραυλικών εγκαταστάσεων ορόφου',
      en: 'Floor plumbing installation drawings',
    },
    icon: 'Droplets',
    order: 4,
  },
];
