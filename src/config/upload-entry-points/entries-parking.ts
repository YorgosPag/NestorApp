/**
 * =============================================================================
 * Upload Entry Points — Parking Spot Entries
 * =============================================================================
 *
 * @module config/upload-entry-points/entries-parking
 * @enterprise ADR-031 (Canonical File Storage) + ADR-187 (Space Floorplans)
 */

import type { UploadEntryPoint } from './types';
import { FLOORPLAN_PURPOSES } from '@/config/domain-constants';

/**
 * Parking spot upload entry points.
 * Mirrors PROPERTY_ENTRY_POINTS floorplan structure for SSoT parity.
 */
export const PARKING_ENTRY_POINTS: UploadEntryPoint[] = [
    // ------------------------------------------------------------------------
    // ΣΧΕΔΙΑ ΘΕΣΗΣ ΣΤΑΘΜΕΥΣΗΣ (Floorplans)
    // ------------------------------------------------------------------------
    {
      id: 'parking-floor-plan',
      purpose: FLOORPLAN_PURPOSES.PARKING,
      domain: 'construction',
      category: 'floorplans',
      label: {
        el: 'Κάτοψη',
        en: 'Floor Plan',
      },
      description: {
        el: 'Αρχιτεκτονική κάτοψη θέσης στάθμευσης (DXF/PDF)',
        en: 'Parking spot architectural floor plan (DXF/PDF)',
      },
      icon: 'LayoutGrid',
      order: 1,
    },
    {
      id: 'parking-section-drawing',
      purpose: FLOORPLAN_PURPOSES.PARKING_SECTION,
      domain: 'construction',
      category: 'floorplans',
      label: {
        el: 'Τομή',
        en: 'Section Drawing',
      },
      description: {
        el: 'Αρχιτεκτονική τομή θέσης στάθμευσης',
        en: 'Parking spot architectural section',
      },
      icon: 'Scissors',
      order: 2,
    },
    {
      id: 'parking-electrical-plan',
      purpose: FLOORPLAN_PURPOSES.PARKING_ELECTRICAL,
      domain: 'construction',
      category: 'floorplans',
      label: {
        el: 'Ηλεκτρολογικά',
        en: 'Electrical Plan',
      },
      description: {
        el: 'Σχέδια ηλεκτρολογικών εγκαταστάσεων θέσης στάθμευσης',
        en: 'Parking spot electrical installation drawings',
      },
      icon: 'Zap',
      order: 3,
    },
    {
      id: 'parking-plumbing-plan',
      purpose: FLOORPLAN_PURPOSES.PARKING_PLUMBING,
      domain: 'construction',
      category: 'floorplans',
      label: {
        el: 'Υδραυλικά',
        en: 'Plumbing Plan',
      },
      description: {
        el: 'Σχέδια υδραυλικών εγκαταστάσεων θέσης στάθμευσης',
        en: 'Parking spot plumbing installation drawings',
      },
      icon: 'Droplets',
      order: 4,
    },

    // ------------------------------------------------------------------------
    // ΦΩΤΟΓΡΑΦΙΕΣ ΘΕΣΗΣ ΣΤΑΘΜΕΥΣΗΣ (Photos) — SSoT mirror of PROPERTY_ENTRY_POINTS
    // NOTE: No "view" category for parking spots (per user spec)
    // ------------------------------------------------------------------------
    {
      id: 'parking-interior-photo',
      purpose: 'interior',
      domain: 'construction',
      category: 'photos',
      label: {
        el: 'Εσωτερικό',
        en: 'Interior',
      },
      description: {
        el: 'Φωτογραφία από το εσωτερικό της θέσης στάθμευσης',
        en: 'Photo from inside the parking spot',
      },
      icon: 'Home',
      order: 20,
    },
    {
      id: 'parking-exterior-photo',
      purpose: 'exterior',
      domain: 'construction',
      category: 'photos',
      label: {
        el: 'Εξωτερικό',
        en: 'Exterior',
      },
      description: {
        el: 'Φωτογραφία από το εξωτερικό της θέσης στάθμευσης',
        en: 'Photo from outside the parking spot',
      },
      icon: 'Building',
      order: 21,
    },
    {
      id: 'parking-progress-photo',
      purpose: 'progress',
      domain: 'construction',
      category: 'photos',
      label: {
        el: 'Πρόοδος Κατασκευής',
        en: 'Construction Progress',
      },
      description: {
        el: 'Φωτογραφία προόδου κατασκευής της θέσης στάθμευσης',
        en: 'Construction progress photo of the parking spot',
      },
      icon: 'HardHat',
      order: 22,
    },
];
