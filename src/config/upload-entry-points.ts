/**
 * =============================================================================
 * 🏢 ENTERPRISE: Upload Entry Points Configuration
 * =============================================================================
 *
 * Centralized configuration για upload entry points.
 * Κάθε entity type έχει specific entry points (τύπους εγγράφων).
 *
 * @module config/upload-entry-points
 * @enterprise ADR-031 - Canonical File Storage System
 *
 * Entry Point → Purpose → Display Name Pipeline:
 * - User selects "Ταυτότητα" (entry point)
 * - System uses purpose: "id"
 * - File naming: "Ταυτότητα - {entityLabel}"
 *
 * @example
 * ```typescript
 * const contactEntryPoints = UPLOAD_ENTRY_POINTS.contact;
 * const idEntry = contactEntryPoints.find(e => e.id === 'id');
 * // idEntry.purpose = "id"
 * // idEntry.category = "documents"
 * // idEntry.label.el = "Ταυτότητα"
 * ```
 */

import type { EntityType, FileDomain, FileCategory } from './domain-constants';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Upload Entry Point Definition
 * Defines what type of document the user wants to upload
 */
export interface UploadEntryPoint {
  /** Unique identifier for this entry point */
  id: string;
  /** Purpose/descriptor για file naming (used in FileRecordService) */
  purpose: string;
  /** Target domain (admin, construction, sales, etc.) */
  domain: FileDomain;
  /** Target category (documents, photos, contracts, etc.) */
  category: FileCategory;
  /** i18n labels */
  label: {
    /** Greek label */
    el: string;
    /** English label */
    en: string;
  };
  /** Optional description */
  description?: {
    el: string;
    en: string;
  };
  /** Icon identifier (lucide-react icon name) */
  icon?: string;
  /** Display order (lower = first) */
  order: number;
  /** 🏢 ENTERPRISE: Requires mandatory custom title (e.g., για "Άλλο Έγγραφο") */
  requiresCustomTitle?: boolean;
}

/**
 * Entry points grouped by entity type
 */
export type UploadEntryPointsConfig = {
  [K in EntityType]?: UploadEntryPoint[];
};

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * 🏢 ENTERPRISE: Centralized Upload Entry Points
 * Based on enterprise practices from Salesforce, Dynamics, SAP
 */
export const UPLOAD_ENTRY_POINTS: UploadEntryPointsConfig = {
  // ==========================================================================
  // CONTACT ENTRY POINTS
  // ==========================================================================
  contact: [
    // ------------------------------------------------------------------------
    // IDENTITY DOCUMENTS
    // ------------------------------------------------------------------------
    {
      id: 'id-card',
      purpose: 'id',
      domain: 'admin',
      category: 'documents',
      label: {
        el: 'Ταυτότητα',
        en: 'ID Card',
      },
      description: {
        el: 'Αστυνομική ταυτότητα ή διαβατήριο',
        en: 'Police ID or passport',
      },
      icon: 'CreditCard',
      order: 1,
    },
    {
      id: 'tax-id',
      purpose: 'tax',
      domain: 'admin',
      category: 'documents',
      label: {
        el: 'ΑΦΜ',
        en: 'Tax ID',
      },
      description: {
        el: 'Αριθμός Φορολογικού Μητρώου',
        en: 'Tax Identification Number',
      },
      icon: 'FileText',
      order: 2,
    },

    // ------------------------------------------------------------------------
    // CONTACT INFORMATION
    // ------------------------------------------------------------------------
    {
      id: 'address-proof',
      purpose: 'address',
      domain: 'admin',
      category: 'documents',
      label: {
        el: 'Απόδειξη Διεύθυνσης',
        en: 'Address Proof',
      },
      description: {
        el: 'Λογαριασμός ΔΕΗ/ΕΥΔΑΠ ή άλλο έγγραφο με διεύθυνση',
        en: 'Utility bill or other document with address',
      },
      icon: 'Home',
      order: 3,
    },
    {
      id: 'phone-verification',
      purpose: 'phone',
      domain: 'admin',
      category: 'documents',
      label: {
        el: 'Επαλήθευση Τηλεφώνου',
        en: 'Phone Verification',
      },
      description: {
        el: 'Λογαριασμός τηλεφωνίας ή συμβόλαιο',
        en: 'Phone bill or contract',
      },
      icon: 'Phone',
      order: 4,
    },

    // ------------------------------------------------------------------------
    // PHOTOS
    // ------------------------------------------------------------------------
    {
      id: 'profile-photo',
      purpose: 'profile',
      domain: 'admin',
      category: 'photos',
      label: {
        el: 'Φωτογραφία Προφίλ',
        en: 'Profile Photo',
      },
      description: {
        el: 'Προσωπική φωτογραφία για το προφίλ',
        en: 'Personal photo for profile',
      },
      icon: 'User',
      order: 5,
    },

    // ------------------------------------------------------------------------
    // CONTRACTS & LEGAL
    // ------------------------------------------------------------------------
    {
      id: 'signed-contract',
      purpose: 'signed',
      domain: 'legal',
      category: 'contracts',
      label: {
        el: 'Υπογεγραμμένο Συμβόλαιο',
        en: 'Signed Contract',
      },
      description: {
        el: 'Συμβόλαιο με υπογραφές',
        en: 'Contract with signatures',
      },
      icon: 'FileSignature',
      order: 6,
    },
    {
      id: 'draft-contract',
      purpose: 'draft',
      domain: 'legal',
      category: 'contracts',
      label: {
        el: 'Πρόχειρο Συμβόλαιο',
        en: 'Draft Contract',
      },
      description: {
        el: 'Συμβόλαιο προς υπογραφή',
        en: 'Contract pending signature',
      },
      icon: 'FilePenLine',
      order: 7,
    },

    // ------------------------------------------------------------------------
    // GENERIC
    // ------------------------------------------------------------------------
    {
      id: 'generic-document',
      purpose: 'generic',
      domain: 'admin',
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
  ],

  // ==========================================================================
  // BUILDING ENTRY POINTS
  // ==========================================================================
  building: [
    {
      id: 'building-permit',
      purpose: 'permit',
      domain: 'construction',
      category: 'permits',
      label: {
        el: 'Οικοδομική Άδεια',
        en: 'Building Permit',
      },
      icon: 'FileCheck',
      order: 1,
    },
    {
      id: 'floor-plan',
      purpose: 'floorplan',
      domain: 'construction',
      category: 'floorplans',
      label: {
        el: 'Κάτοψη',
        en: 'Floor Plan',
      },
      icon: 'LayoutGrid',
      order: 2,
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
    // ------------------------------------------------------------------------
    // ΣΥΜΒΟΛΑΙΑ ΚΤΙΡΙΟΥ (Contracts)
    // ------------------------------------------------------------------------
    {
      id: 'building-contract',
      purpose: 'contract',
      domain: 'legal',
      category: 'contracts',
      label: {
        el: 'Συμβόλαιο Κτιρίου',
        en: 'Building Contract',
      },
      icon: 'FileSignature',
      order: 20,
    },
    {
      id: 'building-lease-agreement',
      purpose: 'lease',
      domain: 'legal',
      category: 'contracts',
      label: {
        el: 'Μισθωτήριο',
        en: 'Lease Agreement',
      },
      icon: 'FileSignature',
      order: 21,
    },
    {
      id: 'building-insurance',
      purpose: 'insurance',
      domain: 'legal',
      category: 'contracts',
      label: {
        el: 'Ασφάλεια Κτιρίου',
        en: 'Building Insurance',
      },
      icon: 'Shield',
      order: 22,
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
      requiresCustomTitle: true, // 🏢 ENTERPRISE: Mandatory title field (ΤΕΛΕΙΩΤΙΚΗ ΕΝΤΟΛΗ)
    },
  ],

  // ==========================================================================
  // UNIT ENTRY POINTS
  // ==========================================================================
  unit: [
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
  ],

  // ==========================================================================
  // PROJECT ENTRY POINTS
  // ==========================================================================
  // 🏢 ENTERPRISE: Based on ΔΟΜΗ.txt - Construction Industry Standard
  // Categories: Διοίκηση, Κατασκευή, Πωλήσεις, Λογιστικά
  // ==========================================================================
  project: [
    // ------------------------------------------------------------------------
    // ΔΙΟΙΚΗΣΗ ΕΡΓΟΥ (00_Διοίκηση-Έργου)
    // ------------------------------------------------------------------------
    {
      id: 'building-permit',
      purpose: 'permit',
      domain: 'admin',
      category: 'permits',
      label: {
        el: 'Οικοδομική Άδεια',
        en: 'Building Permit',
      },
      description: {
        el: 'Άδεια δόμησης από την πολεοδομία',
        en: 'Construction permit from planning authority',
      },
      icon: 'FileCheck',
      order: 1,
    },
    {
      id: 'environmental-approval',
      purpose: 'environmental',
      domain: 'admin',
      category: 'permits',
      label: {
        el: 'Περιβαλλοντική Έγκριση',
        en: 'Environmental Approval',
      },
      description: {
        el: 'Έγκριση περιβαλλοντικών όρων',
        en: 'Environmental terms approval',
      },
      icon: 'Leaf',
      order: 2,
    },
    {
      id: 'project-contract',
      purpose: 'contract',
      domain: 'legal',
      category: 'contracts',
      label: {
        el: 'Συμβόλαιο Έργου',
        en: 'Project Contract',
      },
      description: {
        el: 'Κύρια σύμβαση έργου',
        en: 'Main project contract',
      },
      icon: 'FileSignature',
      order: 3,
    },

    // ------------------------------------------------------------------------
    // ΚΑΤΑΣΚΕΥΗ - ΣΧΕΔΙΑ (10_Κατασκευή/01_Σχέδια)
    // ------------------------------------------------------------------------
    {
      id: 'floor-plan',
      purpose: 'floorplan',
      domain: 'construction',
      category: 'floorplans',
      label: {
        el: 'Κάτοψη',
        en: 'Floor Plan',
      },
      description: {
        el: 'Αρχιτεκτονική κάτοψη (DXF/PDF)',
        en: 'Architectural floor plan (DXF/PDF)',
      },
      icon: 'LayoutGrid',
      order: 10,
    },
    {
      id: 'section-drawing',
      purpose: 'section',
      domain: 'construction',
      category: 'floorplans',
      label: {
        el: 'Τομή',
        en: 'Section Drawing',
      },
      description: {
        el: 'Αρχιτεκτονική τομή',
        en: 'Architectural section',
      },
      icon: 'Scissors',
      order: 11,
    },
    {
      id: 'electrical-plan',
      purpose: 'electrical',
      domain: 'construction',
      category: 'floorplans',
      label: {
        el: 'Ηλεκτρολογικά',
        en: 'Electrical Plan',
      },
      description: {
        el: 'Σχέδια ηλεκτρολογικών εγκαταστάσεων',
        en: 'Electrical installation drawings',
      },
      icon: 'Zap',
      order: 12,
    },
    {
      id: 'plumbing-plan',
      purpose: 'plumbing',
      domain: 'construction',
      category: 'floorplans',
      label: {
        el: 'Υδραυλικά',
        en: 'Plumbing Plan',
      },
      description: {
        el: 'Σχέδια υδραυλικών εγκαταστάσεων',
        en: 'Plumbing installation drawings',
      },
      icon: 'Droplets',
      order: 13,
    },

    // ------------------------------------------------------------------------
    // ΚΑΤΑΣΚΕΥΗ - ΗΜΕΡΟΛΟΓΙΟ (10_Κατασκευή/02_Ημερολόγιο)
    // ------------------------------------------------------------------------
    {
      id: 'construction-photo',
      purpose: 'construction',
      domain: 'construction',
      category: 'photos',
      label: {
        el: 'Φωτογραφία Εργοταξίου',
        en: 'Construction Photo',
      },
      description: {
        el: 'Φωτογραφική τεκμηρίωση κατασκευής',
        en: 'Construction progress photo documentation',
      },
      icon: 'Camera',
      order: 20,
    },
    {
      id: 'construction-video',
      purpose: 'video',
      domain: 'construction',
      category: 'videos',
      label: {
        el: 'Βίντεο Εργοταξίου',
        en: 'Construction Video',
      },
      description: {
        el: 'Βίντεο τεκμηρίωση κατασκευής',
        en: 'Construction progress video documentation',
      },
      icon: 'Video',
      order: 21,
    },
    {
      id: 'voice-note',
      purpose: 'voicenote',
      domain: 'construction',
      category: 'documents',
      label: {
        el: 'Ηχητική Σημείωση',
        en: 'Voice Note',
      },
      description: {
        el: 'Ηχητική σημείωση από εργοτάξιο',
        en: 'Voice note from construction site',
      },
      icon: 'Mic',
      order: 22,
    },
    {
      id: 'daily-report',
      purpose: 'daily',
      domain: 'construction',
      category: 'documents',
      label: {
        el: 'Ημερήσιο Δελτίο',
        en: 'Daily Report',
      },
      description: {
        el: 'Ημερήσια αναφορά εργασιών',
        en: 'Daily work report',
      },
      icon: 'ClipboardList',
      order: 23,
    },

    // ------------------------------------------------------------------------
    // ΛΟΓΙΣΤΙΚΑ (30_Λογιστικά)
    // ------------------------------------------------------------------------
    {
      id: 'invoice',
      purpose: 'invoice',
      domain: 'accounting',
      category: 'documents',
      label: {
        el: 'Τιμολόγιο',
        en: 'Invoice',
      },
      description: {
        el: 'Τιμολόγιο προμηθευτή/συνεργείου',
        en: 'Supplier/contractor invoice',
      },
      icon: 'Receipt',
      order: 30,
    },
    {
      id: 'payment-receipt',
      purpose: 'receipt',
      domain: 'accounting',
      category: 'documents',
      label: {
        el: 'Απόδειξη Πληρωμής',
        en: 'Payment Receipt',
      },
      description: {
        el: 'Απόδειξη πληρωμής/έμβασμα',
        en: 'Payment receipt/bank transfer',
      },
      icon: 'CreditCard',
      order: 31,
    },
    {
      id: 'delivery-note',
      purpose: 'delivery',
      domain: 'accounting',
      category: 'documents',
      label: {
        el: 'Δελτίο Αποστολής',
        en: 'Delivery Note',
      },
      description: {
        el: 'Δελτίο αποστολής υλικών',
        en: 'Material delivery note',
      },
      icon: 'Truck',
      order: 32,
    },

    // ------------------------------------------------------------------------
    // GENERIC
    // ------------------------------------------------------------------------
    {
      id: 'project-report',
      purpose: 'report',
      domain: 'construction',
      category: 'documents',
      label: {
        el: 'Αναφορά Έργου',
        en: 'Project Report',
      },
      description: {
        el: 'Γενική αναφορά έργου',
        en: 'General project report',
      },
      icon: 'FileBarChart',
      order: 50,
    },
    {
      id: 'generic-project-doc',
      purpose: 'generic',
      domain: 'construction',
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
      requiresCustomTitle: true,
    },
  ],
};

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Get entry points for specific entity type
 */
export function getEntryPointsForEntity(
  entityType: EntityType
): UploadEntryPoint[] {
  return UPLOAD_ENTRY_POINTS[entityType] || [];
}

/**
 * Find entry point by ID
 */
export function findEntryPoint(
  entityType: EntityType,
  entryPointId: string
): UploadEntryPoint | undefined {
  const entryPoints = getEntryPointsForEntity(entityType);
  return entryPoints.find((ep) => ep.id === entryPointId);
}

/**
 * Get entry points sorted by order
 */
export function getSortedEntryPoints(
  entityType: EntityType
): UploadEntryPoint[] {
  const entryPoints = getEntryPointsForEntity(entityType);
  return [...entryPoints].sort((a, b) => a.order - b.order);
}
