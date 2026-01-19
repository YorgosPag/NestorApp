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
    {
      id: 'unit-contract',
      purpose: 'contract',
      domain: 'sales',
      category: 'contracts',
      label: {
        el: 'Συμβόλαιο Μονάδας',
        en: 'Unit Contract',
      },
      icon: 'FileText',
      order: 1,
    },
    {
      id: 'unit-photo',
      purpose: 'interior',
      domain: 'sales',
      category: 'photos',
      label: {
        el: 'Φωτογραφία Εσωτερικού',
        en: 'Interior Photo',
      },
      icon: 'Camera',
      order: 2,
    },
    {
      id: 'generic-unit-doc',
      purpose: 'generic',
      domain: 'sales',
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
  // PROJECT ENTRY POINTS
  // ==========================================================================
  project: [
    {
      id: 'project-contract',
      purpose: 'contract',
      domain: 'construction',
      category: 'contracts',
      label: {
        el: 'Συμβόλαιο Έργου',
        en: 'Project Contract',
      },
      icon: 'FileText',
      order: 1,
    },
    {
      id: 'project-report',
      purpose: 'report',
      domain: 'construction',
      category: 'documents', // 🏢 ENTERPRISE: Reports are documents category
      label: {
        el: 'Αναφορά Έργου',
        en: 'Project Report',
      },
      icon: 'FileBarChart',
      order: 2,
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
      icon: 'File',
      order: 99,
      requiresCustomTitle: true, // 🏢 ENTERPRISE: Mandatory title field (ΤΕΛΕΙΩΤΙΚΗ ΕΝΤΟΛΗ)
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
