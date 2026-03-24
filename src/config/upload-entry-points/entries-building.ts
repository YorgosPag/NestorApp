/**
 * =============================================================================
 * Upload Entry Points — Building Entries (photos, videos, generic doc)
 * =============================================================================
 *
 * Study entries (ADR-191) are now in entries-studies.ts (single source of truth).
 *
 * @module config/upload-entry-points/entries-building
 * @enterprise ADR-031
 */

import type { UploadEntryPoint } from './types';
import { FLOORPLAN_PURPOSES } from '@/config/domain-constants';

/**
 * Building upload entry points (non-study).
 * Study entries merged at assembly time from entries-studies.ts.
 */
export const BUILDING_ENTRY_POINTS: UploadEntryPoint[] = [
    // ------------------------------------------------------------------------
    // ΚΑΤΟΨΕΙΣ ΚΤΗΡΙΟΥ (Floorplans)
    // ------------------------------------------------------------------------
    {
      id: 'building-floorplan',
      purpose: FLOORPLAN_PURPOSES.BUILDING,
      domain: 'construction',
      category: 'floorplans',
      label: {
        el: 'Κάτοψη Κτηρίου',
        en: 'Building Floor Plan',
      },
      description: {
        el: 'Γενική κάτοψη κτηρίου (DXF/PDF)',
        en: 'General building floor plan (DXF/PDF)',
      },
      icon: 'LayoutGrid',
      order: 1,
    },
    {
      id: 'exterior-photo',
      purpose: 'exterior',
      domain: 'construction',
      category: 'photos',
      label: {
        el: 'Φωτογραφία Εξωτερικού',
        en: 'Exterior Photo',
      },
      icon: 'Camera',
      order: 3,
    },
    // ------------------------------------------------------------------------
    // ΦΩΤΟΓΡΑΦΙΕΣ ΚΤΙΡΙΟΥ (Photos)
    // ------------------------------------------------------------------------
    {
      id: 'building-interior-photo',
      purpose: 'interior',
      domain: 'construction',
      category: 'photos',
      label: {
        el: 'Εσωτερικό Κτιρίου',
        en: 'Building Interior',
      },
      icon: 'Camera',
      order: 4,
    },
    {
      id: 'building-progress-photo',
      purpose: 'progress',
      domain: 'construction',
      category: 'photos',
      label: {
        el: 'Πρόοδος Κατασκευής',
        en: 'Construction Progress',
      },
      icon: 'Camera',
      order: 5,
    },
    {
      id: 'building-common-areas-photo',
      purpose: 'common-areas',
      domain: 'construction',
      category: 'photos',
      label: {
        el: 'Κοινόχρηστοι Χώροι',
        en: 'Common Areas',
      },
      icon: 'Camera',
      order: 6,
    },
    // ------------------------------------------------------------------------
    // ΒΙΝΤΕΟ ΚΤΙΡΙΟΥ (Videos)
    // ------------------------------------------------------------------------
    {
      id: 'building-walkthrough-video',
      purpose: 'walkthrough',
      domain: 'construction',
      category: 'videos',
      label: {
        el: 'Περιήγηση Κτιρίου',
        en: 'Building Walkthrough',
      },
      icon: 'Video',
      order: 10,
    },
    {
      id: 'building-drone-video',
      purpose: 'drone',
      domain: 'construction',
      category: 'videos',
      label: {
        el: 'Drone Κτιρίου',
        en: 'Building Drone',
      },
      icon: 'Video',
      order: 11,
    },
    {
      id: 'building-progress-video',
      purpose: 'construction-video',
      domain: 'construction',
      category: 'videos',
      label: {
        el: 'Πρόοδος Κατασκευής',
        en: 'Construction Progress',
      },
      icon: 'Video',
      order: 12,
    },
    {
      id: 'generic-building-doc',
      purpose: 'generic',
      domain: 'construction',
      category: 'documents',
      label: {
        el: 'Άλλο Έγγραφο',
        en: 'Other Document',
      },
      icon: 'File',
      order: 99,
      requiresCustomTitle: true,
    },
];
