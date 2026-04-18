/**
 * =============================================================================
 * Upload Entry Points — Storage Room Entries
 * =============================================================================
 *
 * @module config/upload-entry-points/entries-storage
 * @enterprise ADR-031 (Canonical File Storage) + ADR-187 (Space Floorplans)
 */

import type { UploadEntryPoint } from './types';
import { FLOORPLAN_PURPOSES } from '@/config/domain-constants';

/**
 * Storage room upload entry points.
 * Mirrors PROPERTY_ENTRY_POINTS floorplan structure for SSoT parity.
 */
export const STORAGE_ENTRY_POINTS: UploadEntryPoint[] = [
    // ------------------------------------------------------------------------
    // ΣΧΕΔΙΑ ΑΠΟΘΗΚΗΣ (Floorplans)
    // ------------------------------------------------------------------------
    {
      id: 'storage-floor-plan',
      purpose: FLOORPLAN_PURPOSES.STORAGE,
      domain: 'construction',
      category: 'floorplans',
      label: {
        el: 'Κάτοψη',
        en: 'Floor Plan',
      },
      description: {
        el: 'Αρχιτεκτονική κάτοψη αποθήκης (DXF/PDF)',
        en: 'Storage room architectural floor plan (DXF/PDF)',
      },
      icon: 'LayoutGrid',
      order: 1,
    },
    {
      id: 'storage-section-drawing',
      purpose: FLOORPLAN_PURPOSES.STORAGE_SECTION,
      domain: 'construction',
      category: 'floorplans',
      label: {
        el: 'Τομή',
        en: 'Section Drawing',
      },
      description: {
        el: 'Αρχιτεκτονική τομή αποθήκης',
        en: 'Storage room architectural section',
      },
      icon: 'Scissors',
      order: 2,
    },
    {
      id: 'storage-electrical-plan',
      purpose: FLOORPLAN_PURPOSES.STORAGE_ELECTRICAL,
      domain: 'construction',
      category: 'floorplans',
      label: {
        el: 'Ηλεκτρολογικά',
        en: 'Electrical Plan',
      },
      description: {
        el: 'Σχέδια ηλεκτρολογικών εγκαταστάσεων αποθήκης',
        en: 'Storage room electrical installation drawings',
      },
      icon: 'Zap',
      order: 3,
    },
    {
      id: 'storage-plumbing-plan',
      purpose: FLOORPLAN_PURPOSES.STORAGE_PLUMBING,
      domain: 'construction',
      category: 'floorplans',
      label: {
        el: 'Υδραυλικά',
        en: 'Plumbing Plan',
      },
      description: {
        el: 'Σχέδια υδραυλικών εγκαταστάσεων αποθήκης',
        en: 'Storage room plumbing installation drawings',
      },
      icon: 'Droplets',
      order: 4,
    },
];
