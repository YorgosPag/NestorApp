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
import type { PersonaType } from '@/types/contacts/personas';
import type { ContactType } from '@/types/contacts';

// ============================================================================
// TYPES
// ============================================================================

// ============================================================================
// 🏢 ENTERPRISE: Capture Source Types (ADR-031 Extension)
// ============================================================================

/**
 * 🏢 ENTERPRISE: Allowed capture sources for Add/Capture Menu
 * Determines what capture options appear in the menu per category
 */
export type CaptureSource = 'upload' | 'camera' | 'video' | 'microphone' | 'text';

/**
 * 🏢 ENTERPRISE: Capture mode for metadata tracking
 */
export type CaptureMode = 'file' | 'photo' | 'video' | 'audio' | 'text';

/**
 * 🏢 ENTERPRISE: File capture metadata (typed, no any)
 * Attached to file records for system understanding
 */
export interface CaptureMetadata {
  /** How the file was captured */
  source: CaptureSource;
  /** Specific capture mode */
  captureMode: CaptureMode;
  /** Duration in ms for audio/video */
  durationMs?: number;
  /** Original MIME type */
  mimeType?: string;
  /** Original filename before processing */
  originalFilename?: string;
  /** Capture timestamp */
  capturedAt: string;
}

/**
 * 🏢 ENTERPRISE: Category capture capabilities
 * Defines which capture sources are allowed per file category
 */
export const CATEGORY_CAPTURE_CAPABILITIES: Record<FileCategory, CaptureSource[]> = {
  photos: ['upload', 'camera'],
  videos: ['upload', 'video'],
  documents: ['upload', 'text', 'microphone'], // Documents can include text notes and voice notes
  contracts: ['upload'],
  permits: ['upload'],
  floorplans: ['upload'],
  invoices: ['upload', 'camera'], // Can photograph receipts
  audio: ['upload', 'microphone'], // Voice recordings
  drawings: ['upload', 'camera'], // Can photograph drawings
} as const;

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
  /** 🏢 ENTERPRISE: Override default category capture capabilities */
  allowedSources?: CaptureSource[];
  /**
   * 🏢 ENTERPRISE: Restrict entry point to specific contact types.
   * If omitted → visible to ALL contact types (base entry).
   */
  contactTypes?: ContactType[];
  /**
   * 🎭 ENTERPRISE: Restrict entry point to specific personas (individual only).
   * If omitted → base entry, always visible for the matching contactTypes.
   * Requires contactTypes to include 'individual'.
   */
  personas?: PersonaType[];
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
  // 🏢 ENTERPRISE: Persona-aware entry points (ADR-121 + ADR-031)
  // - No contactTypes/personas → visible to ALL contacts (base)
  // - contactTypes only → visible to those contact types (base for that type)
  // - contactTypes + personas → visible when persona is active (individual)
  // ==========================================================================
  contact: [
    // ========================================================================
    // Α. ΒΑΣΗ — Κοινά ΟΛΩΝ (χωρίς filter)
    // ========================================================================
    {
      id: 'tax-id',
      purpose: 'tax',
      domain: 'admin',
      category: 'documents',
      label: { el: 'ΑΦΜ', en: 'Tax ID' },
      description: {
        el: 'Αριθμός Φορολογικού Μητρώου',
        en: 'Tax Identification Number',
      },
      icon: 'FileText',
      order: 1,
    },
    {
      id: 'private-agreement',
      purpose: 'private-agreement',
      domain: 'legal',
      category: 'contracts',
      label: { el: 'Ιδιωτικό Συμφωνητικό', en: 'Private Agreement' },
      description: {
        el: 'Ιδιωτικό συμφωνητικό συνεργασίας ή άλλο',
        en: 'Private cooperation or other agreement',
      },
      icon: 'Handshake',
      order: 2,
    },
    {
      id: 'generic-document',
      purpose: 'generic',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Άλλο Έγγραφο', en: 'Other Document' },
      description: {
        el: 'Γενικό έγγραφο χωρίς συγκεκριμένη κατηγορία',
        en: 'Generic document without specific category',
      },
      icon: 'File',
      order: 99,
      requiresCustomTitle: true,
    },

    // ========================================================================
    // Β. Βάση Individual (contactTypes: ['individual'], χωρίς personas)
    // ========================================================================
    {
      id: 'id-card',
      purpose: 'id',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Ταυτότητα / Διαβατήριο', en: 'ID Card / Passport' },
      description: {
        el: 'Αστυνομική ταυτότητα ή διαβατήριο',
        en: 'Police ID or passport',
      },
      icon: 'CreditCard',
      order: 10,
      contactTypes: ['individual'],
    },

    // ========================================================================
    // Γ. Persona-specific (contactTypes: ['individual'] + personas)
    // ========================================================================

    // --- construction_worker ---
    {
      id: 'amka',
      purpose: 'amka',
      domain: 'admin',
      category: 'documents',
      label: { el: 'ΑΜΚΑ', en: 'Social Security (AMKA)' },
      description: {
        el: 'Αριθμός Μητρώου Κοινωνικής Ασφάλισης',
        en: 'Social Security Number (AMKA)',
      },
      icon: 'ShieldCheck',
      order: 20,
      contactTypes: ['individual'],
      personas: ['construction_worker'],
    },
    {
      id: 'ika-registration',
      purpose: 'ika-registration',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Αρ. Μητρώου ΕΦΚΑ/ΙΚΑ', en: 'EFKA/IKA Registry Nr' },
      description: {
        el: 'Αριθμός μητρώου ασφαλιστικού φορέα',
        en: 'Insurance registry number',
      },
      icon: 'ClipboardList',
      order: 21,
      contactTypes: ['individual'],
      personas: ['construction_worker'],
    },
    {
      id: 'health-certificate',
      purpose: 'health-certificate',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Βεβαίωση Υγείας', en: 'Health Certificate' },
      description: {
        el: 'Ιατρική βεβαίωση καταλληλότητας εργασίας',
        en: 'Medical fitness-for-work certificate',
      },
      icon: 'HeartPulse',
      order: 22,
      contactTypes: ['individual'],
      personas: ['construction_worker'],
    },
    {
      id: 'work-permit',
      purpose: 'work-permit',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Άδεια Εργασίας', en: 'Work Permit' },
      description: {
        el: 'Άδεια εργασίας (για αλλοδαπούς εργαζόμενους)',
        en: 'Work permit (for foreign workers)',
      },
      icon: 'BadgeCheck',
      order: 23,
      contactTypes: ['individual'],
      personas: ['construction_worker'],
    },
    {
      id: 'specialty-certification',
      purpose: 'specialty-certification',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Πιστοποίηση Ειδικότητας', en: 'Specialty Certification' },
      description: {
        el: 'Πιστοποίηση επαγγελματικής ειδικότητας (ηλεκτρολόγος, υδραυλικός κτλ)',
        en: 'Professional specialty certification (electrician, plumber etc)',
      },
      icon: 'Award',
      order: 24,
      contactTypes: ['individual'],
      personas: ['construction_worker'],
    },

    // --- accountant ---
    {
      id: 'oee-certificate',
      purpose: 'oee-certificate',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Βεβαίωση ΟΕΕ', en: 'OEE Certificate' },
      description: {
        el: 'Βεβαίωση εγγραφής στο Οικονομικό Επιμελητήριο',
        en: 'Economic Chamber registration certificate',
      },
      icon: 'Calculator',
      order: 30,
      contactTypes: ['individual'],
      personas: ['accountant'],
    },
    {
      id: 'cooperation-contract',
      purpose: 'cooperation-contract',
      domain: 'legal',
      category: 'contracts',
      label: { el: 'Σύμβαση Συνεργασίας', en: 'Cooperation Contract' },
      description: {
        el: 'Σύμβαση παροχής λογιστικών υπηρεσιών',
        en: 'Accounting services contract',
      },
      icon: 'FileSignature',
      order: 31,
      contactTypes: ['individual'],
      personas: ['accountant'],
    },

    // --- lawyer ---
    {
      id: 'power-of-attorney',
      purpose: 'power-of-attorney',
      domain: 'legal',
      category: 'contracts',
      label: { el: 'Πληρεξούσιο', en: 'Power of Attorney' },
      description: {
        el: 'Πληρεξούσιο εκπροσώπησης',
        en: 'Power of attorney document',
      },
      icon: 'Scale',
      order: 40,
      contactTypes: ['individual'],
      personas: ['lawyer', 'client'],
    },
    {
      id: 'authorization',
      purpose: 'authorization',
      domain: 'legal',
      category: 'contracts',
      label: { el: 'Εξουσιοδότηση', en: 'Authorization' },
      description: {
        el: 'Εξουσιοδότηση για νομικές ή διοικητικές ενέργειες',
        en: 'Authorization for legal or administrative actions',
      },
      icon: 'FileCheck',
      order: 41,
      contactTypes: ['individual'],
      personas: ['lawyer', 'client'],
    },

    // --- real_estate_agent ---
    {
      id: 'agent-license',
      purpose: 'agent-license',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Άδεια Μεσίτη (ΓΕΜΗ)', en: 'Agent License (GEMI)' },
      description: {
        el: 'Άδεια άσκησης μεσιτικής δραστηριότητας',
        en: 'Real estate agent license (GEMI)',
      },
      icon: 'Key',
      order: 50,
      contactTypes: ['individual'],
      personas: ['real_estate_agent'],
    },
    {
      id: 'mediation-contract',
      purpose: 'mediation-contract',
      domain: 'legal',
      category: 'contracts',
      label: { el: 'Σύμβαση Μεσιτείας', en: 'Mediation Contract' },
      description: {
        el: 'Σύμβαση μεσιτείας ακινήτου',
        en: 'Real estate mediation contract',
      },
      icon: 'FileSignature',
      order: 51,
      contactTypes: ['individual'],
      personas: ['real_estate_agent'],
    },

    // --- client ---
    {
      id: 'address-proof',
      purpose: 'address',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Απόδειξη Διεύθυνσης', en: 'Address Proof' },
      description: {
        el: 'Λογαριασμός ΔΕΗ/ΕΥΔΑΠ ή άλλο έγγραφο με διεύθυνση',
        en: 'Utility bill or other document with address',
      },
      icon: 'Home',
      order: 42,
      contactTypes: ['individual'],
      personas: ['client'],
    },

    // ========================================================================
    // Δ. Εταιρεία (contactTypes: ['company'])
    // ========================================================================
    {
      id: 'articles-of-association',
      purpose: 'articles-of-association',
      domain: 'legal',
      category: 'contracts',
      label: { el: 'Καταστατικό', en: 'Articles of Association' },
      description: {
        el: 'Καταστατικό εταιρείας',
        en: 'Company articles of association',
      },
      icon: 'ScrollText',
      order: 60,
      contactTypes: ['company'],
    },
    {
      id: 'gemi-certificate',
      purpose: 'gemi-certificate',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Πιστοποιητικό ΓΕΜΗ', en: 'GEMI Certificate' },
      description: {
        el: 'Πιστοποιητικό Γενικού Εμπορικού Μητρώου',
        en: 'General Commercial Registry certificate',
      },
      icon: 'Award',
      order: 61,
      contactTypes: ['company'],
    },
    {
      id: 'tax-clearance',
      purpose: 'tax-clearance',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Φορολογική Ενημερότητα', en: 'Tax Clearance' },
      description: {
        el: 'Φορολογική ενημερότητα από ΑΑΔΕ',
        en: 'Tax clearance certificate from AADE',
      },
      icon: 'FileCheck',
      order: 62,
      contactTypes: ['company'],
    },
    {
      id: 'insurance-clearance',
      purpose: 'insurance-clearance',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Ασφαλιστική Ενημερότητα', en: 'Insurance Clearance' },
      description: {
        el: 'Ασφαλιστική ενημερότητα από ΕΦΚΑ',
        en: 'Insurance clearance from EFKA',
      },
      icon: 'Shield',
      order: 63,
      contactTypes: ['company'],
    },
    {
      id: 'legal-representation',
      purpose: 'legal-representation',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Νόμιμη Εκπροσώπηση', en: 'Legal Representation' },
      description: {
        el: 'Πιστοποιητικό νόμιμου εκπροσώπου',
        en: 'Legal representative certificate',
      },
      icon: 'UserCheck',
      order: 64,
      contactTypes: ['company'],
    },
    {
      id: 'site-insurance',
      purpose: 'site-insurance',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Ασφαλιστήριο Εργοταξίου', en: 'Site Insurance (CAR/EAR)' },
      description: {
        el: 'Ασφαλιστήριο συμβόλαιο εργοταξίου (CAR/EAR)',
        en: 'Construction All Risks / Erection All Risks insurance',
      },
      icon: 'ShieldCheck',
      order: 65,
      contactTypes: ['company'],
    },

    // ========================================================================
    // Ε. Δημόσια Υπηρεσία (contactTypes: ['service'])
    // ========================================================================
    {
      id: 'permit-certificate',
      purpose: 'permit-certificate',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Άδεια / Πιστοποιητικό', en: 'Permit / Certificate' },
      description: {
        el: 'Άδεια ή πιστοποιητικό από δημόσια υπηρεσία',
        en: 'Permit or certificate from public service',
      },
      icon: 'FileCheck',
      order: 70,
      contactTypes: ['service'],
    },
    {
      id: 'official-correspondence',
      purpose: 'official-correspondence',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Επίσημη Αλληλογραφία', en: 'Official Correspondence' },
      description: {
        el: 'Επίσημα έγγραφα αλληλογραφίας με δημόσια υπηρεσία',
        en: 'Official correspondence documents with public service',
      },
      icon: 'Mail',
      order: 71,
      contactTypes: ['service'],
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

// ============================================================================
// 🏢 ENTERPRISE: Contact-Specific Filtering (Persona-Aware)
// ============================================================================

/**
 * Get filtered contact entry points based on contact type and active personas.
 *
 * Filtering rules:
 * 1. No contactTypes → always visible (base entry for ALL)
 * 2. contactTypes match → check personas:
 *    a. No personas → always visible for that contact type (base entry)
 *    b. personas match at least one active persona → visible
 *    c. personas don't match → hidden
 * 3. contactTypes don't match → hidden
 *
 * Dedup by ID (e.g., power-of-attorney shared between lawyer + client)
 */
export function getFilteredContactEntryPoints(
  contactType: ContactType,
  activePersonas?: PersonaType[]
): UploadEntryPoint[] {
  const allEntryPoints = getSortedEntryPoints('contact');
  const seen = new Set<string>();

  return allEntryPoints.filter((ep) => {
    // Dedup by ID
    if (seen.has(ep.id)) return false;

    // Rule 1: No contactTypes restriction → visible to ALL
    if (!ep.contactTypes || ep.contactTypes.length === 0) {
      seen.add(ep.id);
      return true;
    }

    // Rule 3: contactTypes don't match → hidden
    if (!ep.contactTypes.includes(contactType)) {
      return false;
    }

    // Rule 2a: contactTypes match + no personas restriction → base entry for type
    if (!ep.personas || ep.personas.length === 0) {
      seen.add(ep.id);
      return true;
    }

    // Rule 2b/2c: Check if any active persona matches
    const personas = activePersonas ?? [];
    const hasMatchingPersona = ep.personas.some((p) => personas.includes(p));
    if (hasMatchingPersona) {
      seen.add(ep.id);
      return true;
    }

    return false;
  });
}

// ============================================================================
// 🏢 ENTERPRISE: Capture Capabilities Utilities
// ============================================================================

/**
 * Get allowed capture sources for a specific file category
 * Uses entry point override if available, otherwise falls back to category defaults
 */
export function getCaptureSourcesForCategory(
  category: FileCategory,
  entryPoint?: UploadEntryPoint
): CaptureSource[] {
  // Entry point can override default category capabilities
  if (entryPoint?.allowedSources) {
    return entryPoint.allowedSources;
  }
  return CATEGORY_CAPTURE_CAPABILITIES[category] || ['upload'];
}

/**
 * Check if a specific capture source is allowed for a category
 */
export function isCaptureSourceAllowed(
  category: FileCategory,
  source: CaptureSource,
  entryPoint?: UploadEntryPoint
): boolean {
  const allowedSources = getCaptureSourcesForCategory(category, entryPoint);
  return allowedSources.includes(source);
}

/**
 * Create capture metadata for a file
 */
export function createCaptureMetadata(
  source: CaptureSource,
  captureMode: CaptureMode,
  options?: {
    durationMs?: number;
    mimeType?: string;
    originalFilename?: string;
  }
): CaptureMetadata {
  return {
    source,
    captureMode,
    durationMs: options?.durationMs,
    mimeType: options?.mimeType,
    originalFilename: options?.originalFilename,
    capturedAt: new Date().toISOString(),
  };
}
