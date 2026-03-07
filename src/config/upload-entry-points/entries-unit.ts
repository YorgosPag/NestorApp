/**
 * =============================================================================
 * Upload Entry Points — Unit Entries (18 entries)
 * =============================================================================
 *
 * @module config/upload-entry-points/entries-unit
 * @enterprise ADR-031
 */

import type { UploadEntryPoint } from './types';

/**
 * Unit (apartment/office/shop) upload entry points.
 */
export const UNIT_ENTRY_POINTS: UploadEntryPoint[] = [
    // ------------------------------------------------------------------------
    // ΣΧΕΔΙΑ ΜΟΝΑΔΑΣ (Floorplans) - Same as Projects
    // ------------------------------------------------------------------------
    {
      id: 'unit-floor-plan',
      purpose: 'unit-floorplan',
      domain: 'construction',
      category: 'floorplans',
      label: {
        el: 'Κάτοψη',
        en: 'Floor Plan',
      },
      description: {
        el: 'Αρχιτεκτονική κάτοψη μονάδας (DXF/PDF)',
        en: 'Unit architectural floor plan (DXF/PDF)',
      },
      icon: 'LayoutGrid',
      order: 1,
    },
    {
      id: 'unit-section-drawing',
      purpose: 'unit-section',
      domain: 'construction',
      category: 'floorplans',
      label: {
        el: 'Τομή',
        en: 'Section Drawing',
      },
      description: {
        el: 'Αρχιτεκτονική τομή μονάδας',
        en: 'Unit architectural section',
      },
      icon: 'Scissors',
      order: 2,
    },
    {
      id: 'unit-electrical-plan',
      purpose: 'unit-electrical',
      domain: 'construction',
      category: 'floorplans',
      label: {
        el: 'Ηλεκτρολογικά',
        en: 'Electrical Plan',
      },
      description: {
        el: 'Σχέδια ηλεκτρολογικών εγκαταστάσεων μονάδας',
        en: 'Unit electrical installation drawings',
      },
      icon: 'Zap',
      order: 3,
    },
    {
      id: 'unit-plumbing-plan',
      purpose: 'unit-plumbing',
      domain: 'construction',
      category: 'floorplans',
      label: {
        el: 'Υδραυλικά',
        en: 'Plumbing Plan',
      },
      description: {
        el: 'Σχέδια υδραυλικών εγκαταστάσεων μονάδας',
        en: 'Unit plumbing installation drawings',
      },
      icon: 'Droplets',
      order: 4,
    },

    // ------------------------------------------------------------------------
    // ΕΓΓΡΑΦΑ ΜΟΝΑΔΑΣ (Documents & Contracts)
    // ------------------------------------------------------------------------
    {
      id: 'unit-contract',
      purpose: 'contract',
      domain: 'sales',
      category: 'contracts',
      label: {
        el: 'Συμβόλαιο Μονάδας',
        en: 'Unit Contract',
      },
      description: {
        el: 'Συμβόλαιο αγοραπωλησίας/ενοικίασης μονάδας',
        en: 'Unit sale/rental contract',
      },
      icon: 'FileSignature',
      order: 10,
    },
    {
      id: 'unit-certificate',
      purpose: 'certificate',
      domain: 'admin',
      category: 'documents',
      label: {
        el: 'Πιστοποιητικό',
        en: 'Certificate',
      },
      description: {
        el: 'Ενεργειακό πιστοποιητικό, πιστοποιητικό ιδιοκτησίας, κτλ.',
        en: 'Energy certificate, ownership certificate, etc.',
      },
      icon: 'Award',
      order: 11,
    },
    {
      id: 'unit-permit',
      purpose: 'permit',
      domain: 'admin',
      category: 'permits',
      label: {
        el: 'Άδεια',
        en: 'Permit',
      },
      description: {
        el: 'Οικοδομική άδεια, πολεοδομική βεβαίωση, κτλ.',
        en: 'Building permit, urban planning certificate, etc.',
      },
      icon: 'FileCheck',
      order: 12,
    },
    {
      id: 'unit-invoice',
      purpose: 'invoice',
      domain: 'accounting',
      category: 'documents',
      label: {
        el: 'Τιμολόγιο/Απόδειξη',
        en: 'Invoice/Receipt',
      },
      description: {
        el: 'Τιμολόγια και αποδείξεις πληρωμών',
        en: 'Invoices and payment receipts',
      },
      icon: 'Receipt',
      order: 13,
    },
    {
      id: 'unit-deed',
      purpose: 'deed',
      domain: 'legal',
      category: 'contracts',
      label: {
        el: 'Συμβόλαιο Μεταβίβασης',
        en: 'Deed of Transfer',
      },
      description: {
        el: 'Συμβολαιογραφικό έγγραφο μεταβίβασης',
        en: 'Notarial deed of transfer',
      },
      icon: 'Scale',
      order: 14,
    },

    // ------------------------------------------------------------------------
    // ΦΩΤΟΓΡΑΦΙΕΣ ΜΟΝΑΔΑΣ (Photos)
    // ------------------------------------------------------------------------
    {
      id: 'unit-interior-photo',
      purpose: 'interior',
      domain: 'sales',
      category: 'photos',
      label: {
        el: 'Εσωτερικό',
        en: 'Interior',
      },
      description: {
        el: 'Φωτογραφία από το εσωτερικό της μονάδας',
        en: 'Photo from inside the unit',
      },
      icon: 'Home',
      order: 20,
    },
    {
      id: 'unit-exterior-photo',
      purpose: 'exterior',
      domain: 'sales',
      category: 'photos',
      label: {
        el: 'Εξωτερικό',
        en: 'Exterior',
      },
      description: {
        el: 'Φωτογραφία από το εξωτερικό/μπαλκόνι της μονάδας',
        en: 'Photo from outside/balcony of the unit',
      },
      icon: 'Building',
      order: 21,
    },
    {
      id: 'unit-view-photo',
      purpose: 'view',
      domain: 'sales',
      category: 'photos',
      label: {
        el: 'Θέα',
        en: 'View',
      },
      description: {
        el: 'Φωτογραφία της θέας από τη μονάδα',
        en: 'Photo of the view from the unit',
      },
      icon: 'Mountain',
      order: 22,
    },
    {
      id: 'unit-progress-photo',
      purpose: 'progress',
      domain: 'construction',
      category: 'photos',
      label: {
        el: 'Πρόοδος Κατασκευής',
        en: 'Construction Progress',
      },
      description: {
        el: 'Φωτογραφία προόδου κατασκευής της μονάδας',
        en: 'Construction progress photo of the unit',
      },
      icon: 'HardHat',
      order: 23,
    },

    // ------------------------------------------------------------------------
    // ΒΙΝΤΕΟ ΜΟΝΑΔΑΣ (Videos)
    // ------------------------------------------------------------------------
    {
      id: 'unit-walkthrough-video',
      purpose: 'walkthrough',
      domain: 'sales',
      category: 'videos',
      label: {
        el: 'Περιήγηση',
        en: 'Walkthrough',
      },
      description: {
        el: 'Βίντεο περιήγησης της μονάδας',
        en: 'Unit walkthrough video',
      },
      icon: 'Video',
      order: 30,
    },
    {
      id: 'unit-tour-video',
      purpose: 'tour',
      domain: 'sales',
      category: 'videos',
      label: {
        el: 'Virtual Tour',
        en: 'Virtual Tour',
      },
      description: {
        el: 'Εικονική ξενάγηση της μονάδας',
        en: 'Virtual tour of the unit',
      },
      icon: 'Eye',
      order: 31,
    },
    {
      id: 'unit-drone-video',
      purpose: 'drone',
      domain: 'sales',
      category: 'videos',
      label: {
        el: 'Drone',
        en: 'Drone',
      },
      description: {
        el: 'Βίντεο από drone με θέα της μονάδας',
        en: 'Drone video showing unit view',
      },
      icon: 'Plane',
      order: 32,
    },
    {
      id: 'unit-progress-video',
      purpose: 'construction-video',
      domain: 'construction',
      category: 'videos',
      label: {
        el: 'Πρόοδος Κατασκευής',
        en: 'Construction Progress',
      },
      description: {
        el: 'Βίντεο προόδου κατασκευής της μονάδας',
        en: 'Construction progress video of the unit',
      },
      icon: 'HardHat',
      order: 33,
    },

    // ------------------------------------------------------------------------
    // GENERIC
    // ------------------------------------------------------------------------
    {
      id: 'generic-unit-doc',
      purpose: 'generic',
      domain: 'sales',
      category: 'documents',
      label: {
        el: 'Άλλο Έγγραφο',
        en: 'Other Document',
      },
      description: {
        el: 'Γενικό έγγραφο χωρίς συγκεκριμένη κατηγορία',
        en: 'Generic document without specific category',
      },
      icon: 'File',
      order: 99,
      requiresCustomTitle: true, // 🏢 ENTERPRISE: Mandatory title field (ΤΕΛΕΙΩΤΙΚΗ ΕΝΤΟΛΗ)
    },
];
