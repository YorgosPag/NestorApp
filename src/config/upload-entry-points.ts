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
import type { StudyGroup } from './study-groups-config';

// ============================================================================
// 🏢 ENTERPRISE: Floor Info for per-floor entry point expansion (ADR-191)
// ============================================================================

export interface FloorInfo {
  id: string;
  number: number;
  name: string;
}

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
  /**
   * 🏢 ADR-191: Study group category (administrative, fiscal, architectural, etc.)
   * If omitted → entry appears in "Γενικά Έγγραφα" section (backward compatible)
   */
  group?: StudyGroup;
  /**
   * 🏢 ADR-191: Template entry that expands dynamically per floor.
   * expandFloorEntryPoints() clones this entry N times (one per floor).
   */
  perFloor?: boolean;
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
    // Α. ΒΑΣΗ — Κοινά ΟΛΩΝ (χωρίς filter) — order: 1-9
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
      id: 'sworn-statement',
      purpose: 'sworn-statement',
      domain: 'legal',
      category: 'documents',
      label: { el: 'Υπεύθυνη Δήλωση (Ν.1599/86)', en: 'Sworn Statement (L.1599/86)' },
      description: {
        el: 'Υπεύθυνη δήλωση σύμφωνα με τον Ν.1599/1986',
        en: 'Sworn statement per Law 1599/1986',
      },
      icon: 'FileWarning',
      order: 3,
    },
    {
      id: 'criminal-record',
      purpose: 'criminal-record',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Αντίγραφο Ποινικού Μητρώου', en: 'Criminal Record Certificate' },
      description: {
        el: 'Αντίγραφο ποινικού μητρώου γενικής ή δικαστικής χρήσης',
        en: 'Criminal record certificate (general or judicial use)',
      },
      icon: 'ShieldAlert',
      order: 4,
    },
    {
      id: 'written-authorization',
      purpose: 'written-authorization',
      domain: 'legal',
      category: 'documents',
      label: { el: 'Εξουσιοδότηση (γνήσιο υπογραφής)', en: 'Written Authorization' },
      description: {
        el: 'Εξουσιοδότηση με βεβαίωση γνησίου υπογραφής',
        en: 'Authorization with certified signature',
      },
      icon: 'PenLine',
      order: 5,
    },
    {
      id: 'business-start-certificate',
      purpose: 'business-start-certificate',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Βεβαίωση Έναρξης Επιτηδεύματος', en: 'Business Start-Up Certificate' },
      description: {
        el: 'Βεβαίωση έναρξης επιτηδεύματος από Δ.Ο.Υ.',
        en: 'Business start-up certificate from tax office',
      },
      icon: 'Building',
      order: 6,
    },
    {
      id: 'tax-assessment',
      purpose: 'tax-assessment',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Εκκαθαριστικό Εφορίας', en: 'Tax Assessment Notice' },
      description: {
        el: 'Εκκαθαριστικό σημείωμα φόρου εισοδήματος',
        en: 'Income tax assessment notice',
      },
      icon: 'Receipt',
      order: 7,
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
    // Β. Individual BASE — contactTypes: ['individual'] — order: 10-14
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
    {
      id: 'amka-base',
      purpose: 'amka-base',
      domain: 'admin',
      category: 'documents',
      label: { el: 'ΑΜΚΑ', en: 'Social Security (AMKA)' },
      description: {
        el: 'Αριθμός Μητρώου Κοινωνικής Ασφάλισης',
        en: 'Social Security Number (AMKA)',
      },
      icon: 'ShieldCheck',
      order: 11,
      contactTypes: ['individual'],
    },
    {
      id: 'cv-resume',
      purpose: 'cv-resume',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Βιογραφικό Σημείωμα', en: 'CV / Resume' },
      description: {
        el: 'Βιογραφικό σημείωμα (CV)',
        en: 'Curriculum vitae / resume',
      },
      icon: 'UserSquare',
      order: 12,
      contactTypes: ['individual'],
    },
    {
      id: 'degree-diploma',
      purpose: 'degree-diploma',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Αντίγραφο Πτυχίου / Τίτλου Σπουδών', en: 'Degree / Diploma Copy' },
      description: {
        el: 'Αντίγραφο πτυχίου ή τίτλου σπουδών',
        en: 'Copy of degree or educational certificate',
      },
      icon: 'GraduationCap',
      order: 13,
      contactTypes: ['individual'],
    },

    // ========================================================================
    // Γ. CONSTRUCTION_WORKER — Εργάτης Οικοδομής — order: 20-39
    // ========================================================================
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
    {
      id: 'stamp-book',
      purpose: 'stamp-book',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Βιβλιάριο Ενσήμων Οικοδόμων', en: 'Construction Stamp Book' },
      description: {
        el: 'Βιβλιάριο ενσήμων οικοδόμων (ΙΚΑ/ΕΦΚΑ)',
        en: 'Construction workers stamp book (IKA/EFKA)',
      },
      icon: 'BookOpen',
      order: 25,
      contactTypes: ['individual'],
      personas: ['construction_worker'],
    },
    {
      id: 'employment-contract',
      purpose: 'employment-contract',
      domain: 'legal',
      category: 'contracts',
      label: { el: 'Σύμβαση Εργασίας', en: 'Employment Contract' },
      description: {
        el: 'Σύμβαση εξαρτημένης εργασίας',
        en: 'Employment contract',
      },
      icon: 'FileSignature',
      order: 26,
      contactTypes: ['individual'],
      personas: ['construction_worker'],
    },
    {
      id: 'digital-work-card',
      purpose: 'digital-work-card',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Ψηφιακή Κάρτα Εργασίας', en: 'Digital Work Card' },
      description: {
        el: 'Ψηφιακή κάρτα εργασίας ΕΡΓΑΝΗ ΙΙ',
        en: 'Digital work card (ERGANI II)',
      },
      icon: 'Smartphone',
      order: 27,
      contactTypes: ['individual'],
      personas: ['construction_worker'],
    },
    {
      id: 'safety-training',
      purpose: 'safety-training',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Πιστοποιητικό Εκπαίδευσης Ασφάλειας', en: 'Safety Training Certificate' },
      description: {
        el: 'Πιστοποιητικό εκπαίδευσης ασφάλειας & υγείας εργασίας',
        en: 'Occupational health & safety training certificate',
      },
      icon: 'ShieldCheck',
      order: 28,
      contactTypes: ['individual'],
      personas: ['construction_worker'],
    },
    {
      id: 'heights-certification',
      purpose: 'heights-certification',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Πιστοποίηση Εργασίας σε Ύψος', en: 'Working at Heights Cert' },
      description: {
        el: 'Πιστοποιητικό εργασίας σε ύψος (ΠΔ 155/2004)',
        en: 'Working at heights certification (PD 155/2004)',
      },
      icon: 'ArrowUpFromLine',
      order: 29,
      contactTypes: ['individual'],
      personas: ['construction_worker'],
    },
    {
      id: 'medical-fitness',
      purpose: 'medical-fitness',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Ιατρικό Πιστοποιητικό Καταλληλότητας', en: 'Medical Fitness Certificate' },
      description: {
        el: 'Ιατρικό πιστοποιητικό καταλληλότητας από ιατρό εργασίας',
        en: 'Medical fitness certificate from occupational physician',
      },
      icon: 'Stethoscope',
      order: 30,
      contactTypes: ['individual'],
      personas: ['construction_worker'],
    },
    {
      id: 'electrician-license',
      purpose: 'electrician-license',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Άδεια Ηλεκτρολόγου Εγκαταστάτη', en: 'Licensed Electrician Permit' },
      description: {
        el: 'Άδεια ηλεκτρολόγου εγκαταστάτη (ΦΕΚ)',
        en: 'Licensed electrician installer permit',
      },
      icon: 'Zap',
      order: 31,
      contactTypes: ['individual'],
      personas: ['construction_worker'],
    },
    {
      id: 'yde-declaration',
      purpose: 'yde-declaration',
      domain: 'admin',
      category: 'documents',
      label: { el: 'ΥΔΕ (Δήλωση Εγκαταστάτη)', en: "Installer's Declaration (YDE)" },
      description: {
        el: 'Υπεύθυνη Δήλωση Εγκαταστάτη ηλεκτρολόγου',
        en: "Licensed electrician's installer declaration",
      },
      icon: 'FileCheck',
      order: 32,
      contactTypes: ['individual'],
      personas: ['construction_worker'],
    },
    {
      id: 'plumber-license',
      purpose: 'plumber-license',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Άδεια Τεχνίτη Υδραυλικού', en: 'Plumber Technician License' },
      description: {
        el: 'Άδεια τεχνίτη υδραυλικού (ΠΔ 112/2012)',
        en: 'Plumber technician license (PD 112/2012)',
      },
      icon: 'Droplets',
      order: 33,
      contactTypes: ['individual'],
      personas: ['construction_worker'],
    },
    {
      id: 'refrigeration-license',
      purpose: 'refrigeration-license',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Άδεια Ψυκτικού', en: 'Refrigeration Tech License' },
      description: {
        el: 'Άδεια τεχνίτη ψυκτικών εγκαταστάσεων',
        en: 'Refrigeration technician license',
      },
      icon: 'Snowflake',
      order: 34,
      contactTypes: ['individual'],
      personas: ['construction_worker'],
    },
    {
      id: 'welder-license',
      purpose: 'welder-license',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Άδεια Συγκολλητή (EN/ISO)', en: 'Welder License (EN/ISO)' },
      description: {
        el: 'Πιστοποίηση συγκολλητή κατά EN ISO 9606',
        en: 'Welder qualification per EN ISO 9606',
      },
      icon: 'Flame',
      order: 35,
      contactTypes: ['individual'],
      personas: ['construction_worker'],
    },
    {
      id: 'machinery-operator-license',
      purpose: 'machinery-operator-license',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Άδεια Χειριστή Μηχανημάτων Έργου', en: 'Machinery Operator License' },
      description: {
        el: 'Άδεια χειριστή μηχανημάτων έργου (ΠΔ 113/2012)',
        en: 'Construction machinery operator license (PD 113/2012)',
      },
      icon: 'Truck',
      order: 36,
      contactTypes: ['individual'],
      personas: ['construction_worker'],
    },
    {
      id: 'asbestos-certification',
      purpose: 'asbestos-certification',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Πιστοποίηση Αμιάντου', en: 'Asbestos Handling Cert' },
      description: {
        el: 'Πιστοποίηση χειρισμού αμιαντούχων υλικών',
        en: 'Asbestos-containing materials handling certification',
      },
      icon: 'AlertTriangle',
      order: 37,
      contactTypes: ['individual'],
      personas: ['construction_worker'],
    },
    {
      id: 'residence-permit',
      purpose: 'residence-permit',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Άδεια Διαμονής (αλλοδαποί)', en: 'Residence Permit (foreigners)' },
      description: {
        el: 'Άδεια διαμονής για αλλοδαπούς εργαζόμενους',
        en: 'Residence permit for foreign workers',
      },
      icon: 'Globe',
      order: 38,
      contactTypes: ['individual'],
      personas: ['construction_worker'],
    },
    {
      id: 'passport-foreign',
      purpose: 'passport-foreign',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Διαβατήριο (αλλοδαποί)', en: 'Passport (foreigners)' },
      description: {
        el: 'Διαβατήριο αλλοδαπού εργαζόμενου',
        en: 'Foreign worker passport',
      },
      icon: 'BookOpenCheck',
      order: 39,
      contactTypes: ['individual'],
      personas: ['construction_worker'],
    },

    // ========================================================================
    // Δ. ACCOUNTANT — Λογιστής — order: 50-55
    // ========================================================================
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
      order: 50,
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
      order: 51,
      contactTypes: ['individual'],
      personas: ['accountant'],
    },
    {
      id: 'accountant-class',
      purpose: 'accountant-class',
      domain: 'admin',
      category: 'documents',
      label: { el: "Τάξη Λογιστή/Φοροτεχνικού (Α'/Β')", en: 'Accountant Class (A/B)' },
      description: {
        el: "Βεβαίωση τάξης λογιστή/φοροτεχνικού (Α' ή Β')",
        en: 'Accountant/tax consultant class certificate (A or B)',
      },
      icon: 'Medal',
      order: 52,
      contactTypes: ['individual'],
      personas: ['accountant'],
    },
    {
      id: 'taxisnet-authorization',
      purpose: 'taxisnet-authorization',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Εξουσιοδότηση TAXISnet', en: 'TAXISnet Authorization' },
      description: {
        el: 'Εξουσιοδότηση πρόσβασης στο TAXISnet',
        en: 'TAXISnet access authorization',
      },
      icon: 'MonitorSmartphone',
      order: 53,
      contactTypes: ['individual'],
      personas: ['accountant'],
    },
    {
      id: 'oee-good-standing',
      purpose: 'oee-good-standing',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Βεβαίωση Ενημερότητας ΟΕΕ', en: 'OEE Good Standing' },
      description: {
        el: 'Βεβαίωση ενημερότητας οφειλών ΟΕΕ',
        en: 'OEE dues good standing certificate',
      },
      icon: 'CheckCircle',
      order: 54,
      contactTypes: ['individual'],
      personas: ['accountant'],
    },

    // ========================================================================
    // Ε. LAWYER — Δικηγόρος — order: 60-69
    // ========================================================================
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
      order: 60,
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
      order: 61,
      contactTypes: ['individual'],
      personas: ['lawyer', 'client'],
    },
    {
      id: 'lawyer-id-card',
      purpose: 'lawyer-id-card',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Ταυτότητα Δικηγόρου', en: "Lawyer's Identity Card" },
      description: {
        el: 'Ταυτότητα μέλους Δικηγορικού Συλλόγου',
        en: 'Bar association member identity card',
      },
      icon: 'BadgeCheck',
      order: 63,
      contactTypes: ['individual'],
      personas: ['lawyer'],
    },
    {
      id: 'pre-collection-receipt',
      purpose: 'pre-collection-receipt',
      domain: 'accounting',
      category: 'documents',
      label: { el: 'Γραμμάτιο Προείσπραξης', en: 'Pre-collection Fee Receipt' },
      description: {
        el: 'Γραμμάτιο προείσπραξης δικηγορικής αμοιβής',
        en: 'Pre-collection fee receipt for legal services',
      },
      icon: 'Receipt',
      order: 64,
      contactTypes: ['individual'],
      personas: ['lawyer'],
    },
    {
      id: 'lawyer-liability-insurance',
      purpose: 'lawyer-liability-insurance',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Ασφαλιστήριο Επαγγελματικής Ευθύνης', en: 'Professional Liability Ins.' },
      description: {
        el: 'Ασφαλιστήριο επαγγελματικής ευθύνης δικηγόρου',
        en: "Lawyer's professional liability insurance",
      },
      icon: 'Shield',
      order: 65,
      contactTypes: ['individual'],
      personas: ['lawyer'],
    },
    {
      id: 'bar-good-standing',
      purpose: 'bar-good-standing',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Βεβαίωση Μη Τιμωρίας ΔΣ', en: 'Bar Good Standing Certificate' },
      description: {
        el: 'Βεβαίωση μη πειθαρχικής τιμωρίας από Δικηγορικό Σύλλογο',
        en: 'Disciplinary good standing certificate from bar association',
      },
      icon: 'CheckCircle',
      order: 66,
      contactTypes: ['individual'],
      personas: ['lawyer'],
    },

    // ========================================================================
    // ΣΤ. REAL_ESTATE_AGENT — Μεσίτης — order: 70-75
    // ========================================================================
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
      order: 70,
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
      order: 71,
      contactTypes: ['individual'],
      personas: ['real_estate_agent'],
    },
    {
      id: 'exclusive-mediation',
      purpose: 'exclusive-mediation',
      domain: 'legal',
      category: 'contracts',
      label: { el: 'Σύμβαση Αποκλειστικής Μεσιτείας', en: 'Exclusive Mediation Agreement' },
      description: {
        el: 'Σύμβαση αποκλειστικής μεσιτείας ακινήτου',
        en: 'Exclusive real estate mediation agreement',
      },
      icon: 'Lock',
      order: 72,
      contactTypes: ['individual'],
      personas: ['real_estate_agent'],
    },
    {
      id: 'agent-liability-insurance',
      purpose: 'agent-liability-insurance',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Ασφαλιστήριο Επαγγελματικής Ευθύνης', en: 'Professional Liability Ins.' },
      description: {
        el: 'Ασφαλιστήριο επαγγελματικής ευθύνης μεσίτη',
        en: "Agent's professional liability insurance",
      },
      icon: 'Shield',
      order: 73,
      contactTypes: ['individual'],
      personas: ['real_estate_agent'],
    },

    // ========================================================================
    // Ζ. CLIENT — Πελάτης — order: 80-89
    // ========================================================================
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
      order: 80,
      contactTypes: ['individual'],
      personas: ['client'],
    },
    {
      id: 'client-tax-assessment',
      purpose: 'client-tax-assessment',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Εκκαθαριστικό Εφορίας', en: 'Tax Assessment Notice' },
      description: {
        el: 'Εκκαθαριστικό σημείωμα φόρου εισοδήματος',
        en: 'Income tax assessment notice',
      },
      icon: 'Receipt',
      order: 81,
      contactTypes: ['individual'],
      personas: ['client'],
    },
    {
      id: 'e9-declaration',
      purpose: 'e9-declaration',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Δήλωση Ε9', en: 'Property Declaration (E9)' },
      description: {
        el: 'Δήλωση στοιχείων ακινήτων (Ε9)',
        en: 'Real estate property declaration (E9)',
      },
      icon: 'FileSpreadsheet',
      order: 82,
      contactTypes: ['individual'],
      personas: ['client'],
    },
    {
      id: 'enfia-certificate',
      purpose: 'enfia-certificate',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Πιστοποιητικό ΕΝΦΙΑ', en: 'ENFIA Certificate' },
      description: {
        el: 'Πιστοποιητικό ΕΝΦΙΑ τελευταίου έτους',
        en: 'ENFIA certificate for the latest fiscal year',
      },
      icon: 'Landmark',
      order: 83,
      contactTypes: ['individual'],
      personas: ['client'],
    },
    {
      id: 'mortgage-preapproval',
      purpose: 'mortgage-preapproval',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Προέγκριση Στεγαστικού Δανείου', en: 'Mortgage Pre-Approval' },
      description: {
        el: 'Βεβαίωση προέγκρισης στεγαστικού δανείου',
        en: 'Mortgage loan pre-approval letter',
      },
      icon: 'Banknote',
      order: 84,
      contactTypes: ['individual'],
      personas: ['client'],
    },
    {
      id: 'loan-final-approval',
      purpose: 'loan-final-approval',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Βεβαίωση Οριστικής Έγκρισης Δανείου', en: 'Final Loan Approval' },
      description: {
        el: 'Βεβαίωση οριστικής έγκρισης δανείου από τράπεζα',
        en: 'Final loan approval certificate from bank',
      },
      icon: 'BadgeCheck',
      order: 85,
      contactTypes: ['individual'],
      personas: ['client'],
    },
    {
      id: 'family-status',
      purpose: 'family-status',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Πιστοποιητικό Οικογενειακής Κατάστασης', en: 'Family Status Certificate' },
      description: {
        el: 'Πιστοποιητικό οικογενειακής κατάστασης από δήμο',
        en: 'Family status certificate from municipality',
      },
      icon: 'Users',
      order: 86,
      contactTypes: ['individual'],
      personas: ['client'],
    },

    // ========================================================================
    // Η. ENGINEER — Μηχανικός — order: 100-109
    // ========================================================================
    {
      id: 'tee-registration',
      purpose: 'tee-registration',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Βεβαίωση Εγγραφής ΤΕΕ', en: 'TEE Registration Certificate' },
      description: {
        el: 'Βεβαίωση εγγραφής στο Τεχνικό Επιμελητήριο Ελλάδος',
        en: 'Technical Chamber of Greece registration certificate',
      },
      icon: 'Building',
      order: 100,
      contactTypes: ['individual'],
      personas: ['engineer'],
    },
    {
      id: 'engineering-license',
      purpose: 'engineering-license',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Άδεια Άσκησης Επαγγέλματος', en: 'Professional Engineering License' },
      description: {
        el: 'Άδεια άσκησης επαγγέλματος μηχανικού',
        en: 'Professional engineering practice license',
      },
      icon: 'BadgeCheck',
      order: 101,
      contactTypes: ['individual'],
      personas: ['engineer'],
    },
    {
      id: 'tee-specialty',
      purpose: 'tee-specialty',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Βεβαίωση Ειδικότητας ΤΕΕ', en: 'TEE Specialty Certificate' },
      description: {
        el: 'Βεβαίωση ειδικότητας μηχανικού από ΤΕΕ',
        en: 'TEE engineering specialty certificate',
      },
      icon: 'Layers',
      order: 102,
      contactTypes: ['individual'],
      personas: ['engineer'],
    },
    {
      id: 'energy-inspector',
      purpose: 'energy-inspector',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Πιστοποιητικό Ενεργειακού Επιθεωρητή', en: 'Energy Inspector Certificate' },
      description: {
        el: 'Πιστοποιητικό ενεργειακού επιθεωρητή (ΥΠΕΝ)',
        en: 'Energy inspector certificate (Ministry of Environment)',
      },
      icon: 'Thermometer',
      order: 103,
      contactTypes: ['individual'],
      personas: ['engineer'],
    },
    {
      id: 'designer-license',
      purpose: 'designer-license',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Μελετητικό Πτυχίο (Τάξη Α-Δ)', en: 'Designer License Class (A-D)' },
      description: {
        el: 'Μελετητικό πτυχίο τάξης Α έως Δ',
        en: 'Design license class A through D',
      },
      icon: 'Compass',
      order: 104,
      contactTypes: ['individual'],
      personas: ['engineer'],
    },
    {
      id: 'professional-liability',
      purpose: 'professional-liability',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Ασφάλιση Επαγγελματικής Ευθύνης', en: 'Professional Liability Insurance' },
      description: {
        el: 'Ασφαλιστήριο επαγγελματικής ευθύνης μηχανικού',
        en: "Engineer's professional liability insurance",
      },
      icon: 'Shield',
      order: 105,
      contactTypes: ['individual'],
      personas: ['engineer'],
    },
    {
      id: 'building-inspector',
      purpose: 'building-inspector',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Βεβαίωση Ελεγκτή Δόμησης', en: 'Building Inspector Certificate' },
      description: {
        el: 'Βεβαίωση εγγραφής στο μητρώο ελεγκτών δόμησης',
        en: 'Building inspector registry certificate',
      },
      icon: 'SearchCheck',
      order: 106,
      contactTypes: ['individual'],
      personas: ['engineer'],
    },
    {
      id: 'fire-safety-designer',
      purpose: 'fire-safety-designer',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Πιστοποίηση Πυρασφάλειας Μελετητή', en: 'Fire Safety Designer Cert' },
      description: {
        el: 'Πιστοποιητικό μελετητή πυρασφάλειας',
        en: 'Fire safety designer certification',
      },
      icon: 'Flame',
      order: 107,
      contactTypes: ['individual'],
      personas: ['engineer'],
    },
    {
      id: 'mek-registration',
      purpose: 'mek-registration',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Εγγραφή ΜΕΚ', en: 'MEK Registration' },
      description: {
        el: 'Εγγραφή στο Μητρώο Εμπειρίας Κατασκευαστών',
        en: 'Constructor Experience Registry (MEK) registration',
      },
      icon: 'ClipboardCheck',
      order: 108,
      contactTypes: ['individual'],
      personas: ['engineer'],
    },

    // ========================================================================
    // Θ. NOTARY — Συμβολαιογράφος — order: 110-115
    // ========================================================================
    {
      id: 'notary-appointment',
      purpose: 'notary-appointment',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Βεβαίωση Διορισμού Συμβολαιογράφου', en: 'Notary Appointment Cert' },
      description: {
        el: 'Βεβαίωση διορισμού συμβολαιογράφου (ΦΕΚ)',
        en: 'Notary appointment certificate (Govt Gazette)',
      },
      icon: 'Stamp',
      order: 110,
      contactTypes: ['individual'],
      personas: ['notary'],
    },
    {
      id: 'sworn-affidavit',
      purpose: 'sworn-affidavit',
      domain: 'legal',
      category: 'documents',
      label: { el: 'Ένορκη Βεβαίωση', en: 'Sworn Affidavit' },
      description: {
        el: 'Ένορκη βεβαίωση ενώπιον συμβολαιογράφου',
        en: 'Sworn affidavit before notary',
      },
      icon: 'BookOpen',
      order: 111,
      contactTypes: ['individual'],
      personas: ['notary'],
    },

    // ========================================================================
    // Ι. PROPERTY_OWNER — Ιδιοκτήτης — order: 120-140
    // ========================================================================
    {
      id: 'title-deed',
      purpose: 'title-deed',
      domain: 'legal',
      category: 'contracts',
      label: { el: 'Τίτλος Ιδιοκτησίας', en: 'Title Deed' },
      description: {
        el: 'Συμβολαιογραφικός τίτλος ιδιοκτησίας',
        en: 'Notarial title deed',
      },
      icon: 'ScrollText',
      order: 120,
      contactTypes: ['individual'],
      personas: ['property_owner'],
    },
    {
      id: 'owner-enfia',
      purpose: 'owner-enfia',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Πιστοποιητικό ΕΝΦΙΑ', en: 'ENFIA Certificate' },
      description: {
        el: 'Πιστοποιητικό ΕΝΦΙΑ ακινήτου',
        en: 'ENFIA property tax certificate',
      },
      icon: 'Landmark',
      order: 121,
      contactTypes: ['individual'],
      personas: ['property_owner'],
    },
    {
      id: 'owner-e9',
      purpose: 'owner-e9',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Δήλωση Ε9', en: 'Property Declaration (E9)' },
      description: {
        el: 'Δήλωση στοιχείων ακινήτων (Ε9)',
        en: 'Real estate property declaration (E9)',
      },
      icon: 'FileSpreadsheet',
      order: 122,
      contactTypes: ['individual'],
      personas: ['property_owner'],
    },
    {
      id: 'encumbrances-cert',
      purpose: 'encumbrances-cert',
      domain: 'legal',
      category: 'documents',
      label: { el: 'Πιστοποιητικό Βαρών', en: 'Encumbrances Certificate' },
      description: {
        el: 'Πιστοποιητικό βαρών από υποθηκοφυλακείο',
        en: 'Encumbrances certificate from land registry',
      },
      icon: 'Lock',
      order: 123,
      contactTypes: ['individual'],
      personas: ['property_owner'],
    },
    {
      id: 'ownership-cert',
      purpose: 'ownership-cert',
      domain: 'legal',
      category: 'documents',
      label: { el: 'Πιστοποιητικό Ιδιοκτησίας', en: 'Ownership Certificate' },
      description: {
        el: 'Πιστοποιητικό ιδιοκτησίας από κτηματολόγιο',
        en: 'Ownership certificate from cadastral office',
      },
      icon: 'FileCheck',
      order: 124,
      contactTypes: ['individual'],
      personas: ['property_owner'],
    },
    {
      id: 'cadastral-extract',
      purpose: 'cadastral-extract',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Κτηματολογικό Απόσπασμα', en: 'Cadastral Extract' },
      description: {
        el: 'Απόσπασμα κτηματολογικού διαγράμματος',
        en: 'Cadastral map extract',
      },
      icon: 'Map',
      order: 125,
      contactTypes: ['individual'],
      personas: ['property_owner'],
    },
    {
      id: 'engineer-certificate-4495',
      purpose: 'engineer-certificate-4495',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Βεβαίωση Μηχανικού (Ν.4495/2017)', en: "Engineer's Certificate (L.4495)" },
      description: {
        el: 'Βεβαίωση μηχανικού κατά τον Ν.4495/2017',
        en: "Engineer's certificate per Law 4495/2017",
      },
      icon: 'Building',
      order: 126,
      contactTypes: ['individual'],
      personas: ['property_owner'],
    },
    {
      id: 'topographic-survey',
      purpose: 'topographic-survey',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Τοπογραφικό Διάγραμμα', en: 'Topographic Survey' },
      description: {
        el: 'Τοπογραφικό διάγραμμα ακινήτου',
        en: 'Property topographic survey drawing',
      },
      icon: 'MapPinned',
      order: 127,
      contactTypes: ['individual'],
      personas: ['property_owner'],
    },
    {
      id: 'energy-performance-cert',
      purpose: 'energy-performance-cert',
      domain: 'admin',
      category: 'documents',
      label: { el: 'ΠΕΑ (Ενεργειακό Πιστοποιητικό)', en: 'Energy Performance Cert (EPC)' },
      description: {
        el: 'Πιστοποιητικό Ενεργειακής Απόδοσης (ΠΕΑ)',
        en: 'Energy Performance Certificate (EPC)',
      },
      icon: 'Thermometer',
      order: 128,
      contactTypes: ['individual'],
      personas: ['property_owner'],
    },
    {
      id: 'condo-regulation',
      purpose: 'condo-regulation',
      domain: 'legal',
      category: 'documents',
      label: { el: 'Κανονισμός Πολυκατοικίας', en: 'Condominium Regulation' },
      description: {
        el: 'Κανονισμός πολυκατοικίας / συνιδιοκτησίας',
        en: 'Condominium / co-ownership regulation',
      },
      icon: 'Building',
      order: 129,
      contactTypes: ['individual'],
      personas: ['property_owner'],
    },
    {
      id: 'horizontal-property',
      purpose: 'horizontal-property',
      domain: 'legal',
      category: 'contracts',
      label: { el: 'Σύσταση Οριζόντιας Ιδιοκτησίας', en: 'Horizontal Property Deed' },
      description: {
        el: 'Πράξη σύστασης οριζόντιας ιδιοκτησίας',
        en: 'Horizontal property establishment deed',
      },
      icon: 'Layers',
      order: 130,
      contactTypes: ['individual'],
      personas: ['property_owner'],
    },
    {
      id: 'municipal-tap',
      purpose: 'municipal-tap',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Βεβαίωση ΤΑΠ Δήμου', en: 'Municipal Property Tax Cert' },
      description: {
        el: 'Βεβαίωση Τέλους Ακίνητης Περιουσίας (ΤΑΠ) από δήμο',
        en: 'Municipal immovable property tax certificate',
      },
      icon: 'Landmark',
      order: 131,
      contactTypes: ['individual'],
      personas: ['property_owner'],
    },
    {
      id: 'forestry-cert',
      purpose: 'forestry-cert',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Βεβαίωση Δασαρχείου', en: 'Forestry Certificate' },
      description: {
        el: 'Βεβαίωση μη δασικού χαρακτήρα από δασαρχείο',
        en: 'Non-forest land certificate from forestry office',
      },
      icon: 'TreePine',
      order: 132,
      contactTypes: ['individual'],
      personas: ['property_owner'],
    },
    {
      id: 'archaeological-cert',
      purpose: 'archaeological-cert',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Βεβαίωση Αρχαιολογίας', en: 'Archaeological Certificate' },
      description: {
        el: 'Βεβαίωση αρχαιολογικής υπηρεσίας για το ακίνητο',
        en: 'Archaeological service certificate for the property',
      },
      icon: 'Amphora',
      order: 133,
      contactTypes: ['individual'],
      personas: ['property_owner'],
    },

    // ========================================================================
    // Κ. SUPPLIER — Προμηθευτής — order: 140-155
    // ========================================================================
    {
      id: 'ce-marking',
      purpose: 'ce-marking',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Σήμανση CE / Δήλωση Επιδόσεων (DoP)', en: 'CE Marking / Declaration of Performance' },
      description: {
        el: 'Σήμανση CE και Δήλωση Επιδόσεων (DoP) προϊόντων',
        en: 'CE marking and Declaration of Performance (DoP)',
      },
      icon: 'BadgeCheck',
      order: 140,
      contactTypes: ['individual'],
      personas: ['supplier'],
    },
    {
      id: 'supplier-iso-9001',
      purpose: 'supplier-iso-9001',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Πιστοποιητικό ISO 9001', en: 'ISO 9001 Certificate' },
      description: {
        el: 'Πιστοποιητικό διαχείρισης ποιότητας ISO 9001',
        en: 'ISO 9001 quality management certificate',
      },
      icon: 'Award',
      order: 141,
      contactTypes: ['individual'],
      personas: ['supplier'],
    },
    {
      id: 'technical-data-sheet',
      purpose: 'technical-data-sheet',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Φύλλο Τεχνικών Προδιαγραφών', en: 'Technical Data Sheet' },
      description: {
        el: 'Τεχνικό φύλλο δεδομένων προϊόντος (TDS)',
        en: 'Product technical data sheet (TDS)',
      },
      icon: 'FileText',
      order: 142,
      contactTypes: ['individual'],
      personas: ['supplier'],
    },
    {
      id: 'safety-data-sheet',
      purpose: 'safety-data-sheet',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Δελτίο Δεδομένων Ασφάλειας (SDS)', en: 'Safety Data Sheet (SDS)' },
      description: {
        el: 'Δελτίο δεδομένων ασφάλειας χημικών/υλικών',
        en: 'Chemical/material safety data sheet (SDS)',
      },
      icon: 'AlertTriangle',
      order: 143,
      contactTypes: ['individual'],
      personas: ['supplier'],
    },
    {
      id: 'manufacturer-warranty',
      purpose: 'manufacturer-warranty',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Εγγύηση Κατασκευαστή', en: "Manufacturer's Warranty" },
      description: {
        el: 'Εγγύηση κατασκευαστή προϊόντος',
        en: "Manufacturer's product warranty",
      },
      icon: 'ShieldCheck',
      order: 144,
      contactTypes: ['individual'],
      personas: ['supplier'],
    },
    {
      id: 'material-suitability',
      purpose: 'material-suitability',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Πιστοποιητικό Καταλληλότητας Υλικών', en: 'Material Suitability Cert' },
      description: {
        el: 'Πιστοποιητικό καταλληλότητας κατασκευαστικών υλικών',
        en: 'Construction material suitability certificate',
      },
      icon: 'FlaskConical',
      order: 145,
      contactTypes: ['individual'],
      personas: ['supplier'],
    },
    {
      id: 'price-list',
      purpose: 'price-list',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Τιμοκατάλογος', en: 'Price List' },
      description: {
        el: 'Τιμοκατάλογος προϊόντων/υπηρεσιών',
        en: 'Products/services price list',
      },
      icon: 'ListOrdered',
      order: 146,
      contactTypes: ['individual'],
      personas: ['supplier'],
    },

    // ========================================================================
    // Λ. ΕΤΑΙΡΕΙΑ — contactTypes: ['company'] — order: 200-299
    // ========================================================================

    // --- Βασικά εταιρικά ---
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
      order: 200,
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
      order: 201,
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
      order: 202,
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
      order: 203,
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
      order: 204,
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
      order: 205,
      contactTypes: ['company'],
    },

    // --- Νέα εταιρικά ---
    {
      id: 'contractor-license',
      purpose: 'contractor-license',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Εργοληπτικό Πτυχίο (ΜΕΕΠ)', en: 'Contractor License (MEEP)' },
      description: {
        el: 'Εργοληπτικό πτυχίο ΜΕΕΠ κατασκευαστικής εταιρείας',
        en: 'MEEP contractor license for construction company',
      },
      icon: 'Award',
      order: 206,
      contactTypes: ['company'],
    },
    {
      id: 'company-iso-9001',
      purpose: 'company-iso-9001',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Πιστοποιητικό ISO 9001', en: 'ISO 9001 Certificate' },
      description: {
        el: 'Πιστοποιητικό διαχείρισης ποιότητας ISO 9001',
        en: 'ISO 9001 quality management certificate',
      },
      icon: 'Award',
      order: 207,
      contactTypes: ['company'],
    },
    {
      id: 'company-iso-14001',
      purpose: 'company-iso-14001',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Πιστοποιητικό ISO 14001', en: 'ISO 14001 Certificate' },
      description: {
        el: 'Πιστοποιητικό περιβαλλοντικής διαχείρισης ISO 14001',
        en: 'ISO 14001 environmental management certificate',
      },
      icon: 'Leaf',
      order: 208,
      contactTypes: ['company'],
    },
    {
      id: 'company-iso-45001',
      purpose: 'company-iso-45001',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Πιστοποιητικό ISO 45001', en: 'ISO 45001 Certificate' },
      description: {
        el: 'Πιστοποιητικό υγείας & ασφάλειας ISO 45001',
        en: 'ISO 45001 occupational health & safety certificate',
      },
      icon: 'HeartPulse',
      order: 209,
      contactTypes: ['company'],
    },
    {
      id: 'performance-guarantee',
      purpose: 'performance-guarantee',
      domain: 'legal',
      category: 'documents',
      label: { el: 'Εγγυητική Επιστολή Καλής Εκτέλεσης', en: 'Performance Guarantee' },
      description: {
        el: 'Εγγυητική επιστολή καλής εκτέλεσης έργου',
        en: 'Performance guarantee letter for project execution',
      },
      icon: 'ShieldCheck',
      order: 210,
      contactTypes: ['company'],
    },
    {
      id: 'participation-guarantee',
      purpose: 'participation-guarantee',
      domain: 'legal',
      category: 'documents',
      label: { el: 'Εγγυητική Επιστολή Συμμετοχής', en: 'Participation Guarantee' },
      description: {
        el: 'Εγγυητική επιστολή συμμετοχής σε διαγωνισμό',
        en: 'Participation guarantee letter for tender',
      },
      icon: 'Ticket',
      order: 211,
      contactTypes: ['company'],
    },
    {
      id: 'board-minutes',
      purpose: 'board-minutes',
      domain: 'legal',
      category: 'documents',
      label: { el: 'Πρακτικά Δ.Σ. / Γ.Σ.', en: 'Board/Assembly Minutes' },
      description: {
        el: 'Πρακτικά Διοικητικού Συμβουλίου ή Γενικής Συνέλευσης',
        en: 'Board of Directors or General Assembly minutes',
      },
      icon: 'ClipboardList',
      order: 212,
      contactTypes: ['company'],
    },
    {
      id: 'financial-statements',
      purpose: 'financial-statements',
      domain: 'accounting',
      category: 'documents',
      label: { el: 'Δημοσιευμένες Οικονομικές Καταστάσεις', en: 'Financial Statements' },
      description: {
        el: 'Δημοσιευμένες ισολογισμοί και οικονομικές καταστάσεις',
        en: 'Published balance sheets and financial statements',
      },
      icon: 'BarChart2',
      order: 213,
      contactTypes: ['company'],
    },
    {
      id: 'government-gazette',
      purpose: 'government-gazette',
      domain: 'legal',
      category: 'documents',
      label: { el: 'ΦΕΚ Σύστασης/Τροποποίησης', en: 'Govt Gazette Publication' },
      description: {
        el: 'ΦΕΚ σύστασης ή τροποποίησης εταιρείας',
        en: 'Company establishment/amendment Govt Gazette publication',
      },
      icon: 'Newspaper',
      order: 214,
      contactTypes: ['company'],
    },
    {
      id: 'employer-liability-insurance',
      purpose: 'employer-liability-insurance',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Ασφαλιστήριο Εργοδοτικής Ευθύνης', en: "Employer's Liability Ins." },
      description: {
        el: 'Ασφαλιστήριο εργοδοτικής ευθύνης',
        en: "Employer's liability insurance policy",
      },
      icon: 'Shield',
      order: 215,
      contactTypes: ['company'],
    },
    {
      id: 'civil-liability-insurance',
      purpose: 'civil-liability-insurance',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Ασφαλιστήριο Αστικής Ευθύνης', en: 'Civil Liability Insurance' },
      description: {
        el: 'Ασφαλιστήριο αστικής ευθύνης προς τρίτους',
        en: 'Third-party civil liability insurance policy',
      },
      icon: 'Shield',
      order: 216,
      contactTypes: ['company'],
    },
    {
      id: 'apd-declaration',
      purpose: 'apd-declaration',
      domain: 'admin',
      category: 'documents',
      label: { el: 'ΑΠΔ (Αναλυτική Περιοδική Δήλωση)', en: 'Analytical Periodic Decl.' },
      description: {
        el: 'Αναλυτική Περιοδική Δήλωση ΕΦΚΑ',
        en: 'EFKA analytical periodic declaration',
      },
      icon: 'ClipboardList',
      order: 217,
      contactTypes: ['company'],
    },
    {
      id: 'chamber-registration',
      purpose: 'chamber-registration',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Βεβαίωση Εγγραφής Επιμελητηρίου', en: 'Chamber Registration Cert' },
      description: {
        el: 'Βεβαίωση εγγραφής στο αρμόδιο επιμελητήριο',
        en: 'Chamber of commerce registration certificate',
      },
      icon: 'Building',
      order: 218,
      contactTypes: ['company'],
    },
    {
      id: 'non-bankruptcy-cert',
      purpose: 'non-bankruptcy-cert',
      domain: 'legal',
      category: 'documents',
      label: { el: 'Πιστοποιητικό μη Πτώχευσης', en: 'Non-Bankruptcy Certificate' },
      description: {
        el: 'Πιστοποιητικό μη πτώχευσης από πρωτοδικείο',
        en: 'Non-bankruptcy certificate from court',
      },
      icon: 'FileCheck',
      order: 219,
      contactTypes: ['company'],
    },

    // --- Δανειακά έγγραφα εταιρείας ---
    {
      id: 'loan-agreement',
      purpose: 'loan-agreement',
      domain: 'legal',
      category: 'contracts',
      label: { el: 'Δανειακή Σύμβαση', en: 'Loan Agreement' },
      description: {
        el: 'Δανειακή σύμβαση με τράπεζα/πιστωτικό ίδρυμα',
        en: 'Loan agreement with bank/credit institution',
      },
      icon: 'Banknote',
      order: 220,
      contactTypes: ['company'],
    },
    {
      id: 'mortgage-agreement',
      purpose: 'mortgage-agreement',
      domain: 'legal',
      category: 'contracts',
      label: { el: 'Ενυπόθηκη Δανειακή Σύμβαση', en: 'Mortgage Loan Agreement' },
      description: {
        el: 'Ενυπόθηκη δανειακή σύμβαση για κατασκευαστικό έργο',
        en: 'Mortgage loan agreement for construction project',
      },
      icon: 'Landmark',
      order: 221,
      contactTypes: ['company'],
    },
    {
      id: 'bank-guarantee',
      purpose: 'bank-guarantee',
      domain: 'legal',
      category: 'documents',
      label: { el: 'Εγγυητική Επιστολή Τράπεζας', en: 'Bank Guarantee Letter' },
      description: {
        el: 'Εγγυητική επιστολή τράπεζας',
        en: 'Bank guarantee letter',
      },
      icon: 'Building',
      order: 222,
      contactTypes: ['company'],
    },
    {
      id: 'loan-repayment-cert',
      purpose: 'loan-repayment-cert',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Βεβαίωση Αποπληρωμής Δανείου', en: 'Loan Repayment Certificate' },
      description: {
        el: 'Βεβαίωση αποπληρωμής/εξόφλησης δανείου',
        en: 'Loan repayment/settlement certificate',
      },
      icon: 'CircleCheckBig',
      order: 223,
      contactTypes: ['company'],
    },
    {
      id: 'pre-notation-mortgage',
      purpose: 'pre-notation-mortgage',
      domain: 'legal',
      category: 'documents',
      label: { el: 'Προσημείωση Υποθήκης', en: 'Pre-notation of Mortgage' },
      description: {
        el: 'Προσημείωση υποθήκης επί ακινήτου',
        en: 'Pre-notation of mortgage on property',
      },
      icon: 'Lock',
      order: 224,
      contactTypes: ['company'],
    },
    {
      id: 'property-valuation',
      purpose: 'property-valuation',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Πρακτικό Εκτίμησης Ακινήτου', en: 'Property Valuation Report' },
      description: {
        el: 'Πρακτικό εκτίμησης αξίας ακινήτου',
        en: 'Property valuation appraisal report',
      },
      icon: 'FileBarChart',
      order: 225,
      contactTypes: ['company'],
    },
    {
      id: 'advance-guarantee',
      purpose: 'advance-guarantee',
      domain: 'legal',
      category: 'documents',
      label: { el: 'Εγγυητική Επιστολή Προκαταβολής', en: 'Advance Payment Guarantee' },
      description: {
        el: 'Εγγυητική επιστολή καλής χρήσης προκαταβολής',
        en: 'Advance payment guarantee letter',
      },
      icon: 'Banknote',
      order: 226,
      contactTypes: ['company'],
    },

    // ========================================================================
    // Μ. ΔΗΜΟΣΙΑ ΥΠΗΡΕΣΙΑ — contactTypes: ['service'] — order: 300-310
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
      order: 300,
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
      order: 301,
      contactTypes: ['service'],
    },
    {
      id: 'application-receipt',
      purpose: 'application-receipt',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Βεβαίωση Υποβολής Αίτησης', en: 'Application Submission Receipt' },
      description: {
        el: 'Βεβαίωση υποβολής αίτησης σε δημόσια υπηρεσία',
        en: 'Application submission receipt from public service',
      },
      icon: 'MailCheck',
      order: 302,
      contactTypes: ['service'],
    },
    {
      id: 'admin-decision',
      purpose: 'admin-decision',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Απόφαση / Διοικητική Πράξη', en: 'Administrative Decision' },
      description: {
        el: 'Απόφαση ή διοικητική πράξη δημόσιας αρχής',
        en: 'Administrative decision or act from public authority',
      },
      icon: 'Gavel',
      order: 303,
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

    // ========================================================================
    // 🏢 ADR-191: ΜΕΛΕΤΕΣ ΟΙΚΟΔΟΜΙΚΗΣ ΑΔΕΙΑΣ — BUILDING LEVEL
    // ========================================================================

    // --- ARCHITECTURAL / ΑΡΧΙΤΕΚΤΟΝΙΚΑ (300-349) ---
    {
      id: 'study-arch-coverage',
      purpose: 'study-coverage',
      domain: 'construction',
      category: 'drawings',
      label: { el: 'Διάγραμμα Κάλυψης', en: 'Coverage Diagram' },
      description: { el: 'Διάγραμμα κάλυψης / δόμησης', en: 'Site coverage / building ratio diagram' },
      icon: 'LayoutGrid',
      order: 300,
      group: 'architectural',
    },
    {
      id: 'study-arch-section',
      purpose: 'study-arch-section',
      domain: 'construction',
      category: 'drawings',
      label: { el: 'Αρχιτεκτονική Τομή', en: 'Architectural Section' },
      description: { el: 'Τομές κτιρίου (εγκάρσια, διαμήκης)', en: 'Building sections (cross, longitudinal)' },
      icon: 'Scissors',
      order: 301,
      group: 'architectural',
    },
    {
      id: 'study-arch-elevation',
      purpose: 'study-arch-elevation',
      domain: 'construction',
      category: 'drawings',
      label: { el: 'Όψεις Κτιρίου', en: 'Building Elevations' },
      description: { el: 'Αρχιτεκτονικές όψεις (Βόρεια, Νότια κ.λπ.)', en: 'Architectural elevations (North, South etc.)' },
      icon: 'Building',
      order: 302,
      group: 'architectural',
    },
    {
      id: 'study-arch-detail',
      purpose: 'study-arch-detail',
      domain: 'construction',
      category: 'drawings',
      label: { el: 'Αρχιτεκτονικές Λεπτομέρειες', en: 'Architectural Details' },
      description: { el: 'Κατασκευαστικές λεπτομέρειες', en: 'Construction detail drawings' },
      icon: 'Focus',
      order: 303,
      group: 'architectural',
    },
    {
      id: 'study-arch-3d',
      purpose: 'study-3d-render',
      domain: 'construction',
      category: 'drawings',
      label: { el: 'Τρισδιάστατα / Φωτορεαλισμός', en: '3D Renders / Visualizations' },
      description: { el: '3D απεικονίσεις κτιρίου', en: '3D building visualizations' },
      icon: 'Box',
      order: 304,
      group: 'architectural',
    },
    {
      id: 'study-arch-floorplan',
      purpose: 'study-floorplan',
      domain: 'construction',
      category: 'drawings',
      label: { el: 'Κάτοψη', en: 'Floor Plan' },
      description: { el: 'Αρχιτεκτονική κάτοψη ορόφου', en: 'Architectural floor plan' },
      icon: 'LayoutGrid',
      order: 310,
      group: 'architectural',
      perFloor: true,
    },
    {
      id: 'study-arch-other',
      purpose: 'study-arch-other',
      domain: 'construction',
      category: 'drawings',
      label: { el: 'Άλλο Αρχιτεκτονικό', en: 'Other Architectural' },
      description: { el: 'Λοιπό αρχιτεκτονικό σχέδιο', en: 'Other architectural drawing' },
      icon: 'File',
      order: 349,
      group: 'architectural',
      requiresCustomTitle: true,
    },

    // --- STRUCTURAL / ΣΤΑΤΙΚΑ (400-449) ---
    {
      id: 'study-struct-analysis',
      purpose: 'study-struct-analysis',
      domain: 'construction',
      category: 'documents',
      label: { el: 'Στατική Μελέτη (Τεύχος)', en: 'Structural Analysis Report' },
      description: { el: 'Τεύχος στατικής μελέτης / υπολογισμοί', en: 'Structural calculation report' },
      icon: 'FileBarChart',
      order: 400,
      group: 'structural',
    },
    {
      id: 'study-struct-foundation',
      purpose: 'study-struct-foundation',
      domain: 'construction',
      category: 'drawings',
      label: { el: 'Σχέδιο Θεμελίωσης', en: 'Foundation Plan' },
      description: { el: 'Ξυλότυπος θεμελίωσης', en: 'Foundation formwork plan' },
      icon: 'Layers',
      order: 401,
      group: 'structural',
    },
    {
      id: 'study-struct-reinforcement',
      purpose: 'study-reinforcement',
      domain: 'construction',
      category: 'drawings',
      label: { el: 'Σχέδιο Οπλισμού', en: 'Reinforcement Plan' },
      description: { el: 'Σχέδια σιδηρού οπλισμού', en: 'Steel reinforcement drawings' },
      icon: 'Grid3x3',
      order: 402,
      group: 'structural',
    },
    {
      id: 'study-struct-formwork',
      purpose: 'study-struct-plan',
      domain: 'construction',
      category: 'drawings',
      label: { el: 'Ξυλότυπος', en: 'Formwork Plan' },
      description: { el: 'Ξυλότυπος ορόφου', en: 'Floor formwork plan' },
      icon: 'SquareDashedBottom',
      order: 410,
      group: 'structural',
      perFloor: true,
    },
    {
      id: 'study-struct-bearing',
      purpose: 'study-bearing-plan',
      domain: 'construction',
      category: 'drawings',
      label: { el: 'Σχέδιο Φέρουσας Κατασκευής', en: 'Load-Bearing Plan' },
      description: { el: 'Φέρουσα κατασκευή ορόφου', en: 'Floor load-bearing structure plan' },
      icon: 'Building2',
      order: 411,
      group: 'structural',
      perFloor: true,
    },
    {
      id: 'study-struct-other',
      purpose: 'study-struct-other',
      domain: 'construction',
      category: 'drawings',
      label: { el: 'Άλλο Στατικό', en: 'Other Structural' },
      description: { el: 'Λοιπό στατικό σχέδιο/μελέτη', en: 'Other structural drawing/study' },
      icon: 'File',
      order: 449,
      group: 'structural',
      requiresCustomTitle: true,
    },

    // --- MECHANICAL / Η/Μ (500-549) ---
    {
      id: 'study-mep-general',
      purpose: 'study-mep-general',
      domain: 'construction',
      category: 'documents',
      label: { el: 'Η/Μ Μελέτη (Τεύχος)', en: 'MEP Study Report' },
      description: { el: 'Γενικό τεύχος Η/Μ μελέτης', en: 'General MEP study report' },
      icon: 'FileBarChart',
      order: 500,
      group: 'mechanical',
    },
    {
      id: 'study-mep-overview',
      purpose: 'study-mep-overview',
      domain: 'construction',
      category: 'drawings',
      label: { el: 'Γενικό Σχέδιο Η/Μ', en: 'MEP Overview Drawing' },
      description: { el: 'Συνολική αποτύπωση Η/Μ εγκαταστάσεων', en: 'Overall MEP installations drawing' },
      icon: 'Wrench',
      order: 501,
      group: 'mechanical',
    },
    {
      id: 'study-mep-water',
      purpose: 'study-mep-water',
      domain: 'construction',
      category: 'drawings',
      label: { el: 'Ύδρευση', en: 'Water Supply' },
      description: { el: 'Σχέδιο ύδρευσης ορόφου', en: 'Floor water supply plan' },
      icon: 'Droplets',
      order: 510,
      group: 'mechanical',
      perFloor: true,
    },
    {
      id: 'study-mep-drainage',
      purpose: 'study-mep-drainage',
      domain: 'construction',
      category: 'drawings',
      label: { el: 'Αποχέτευση', en: 'Drainage' },
      description: { el: 'Σχέδιο αποχέτευσης ορόφου', en: 'Floor drainage plan' },
      icon: 'ArrowDownToLine',
      order: 511,
      group: 'mechanical',
      perFloor: true,
    },
    {
      id: 'study-mep-heating',
      purpose: 'study-mep-heating',
      domain: 'construction',
      category: 'drawings',
      label: { el: 'Θέρμανση', en: 'Heating' },
      description: { el: 'Σχέδιο θέρμανσης ορόφου', en: 'Floor heating plan' },
      icon: 'Flame',
      order: 512,
      group: 'mechanical',
      perFloor: true,
    },
    {
      id: 'study-mep-hvac',
      purpose: 'study-mep-hvac',
      domain: 'construction',
      category: 'drawings',
      label: { el: 'Κλιματισμός / Εξαερισμός', en: 'HVAC / Ventilation' },
      description: { el: 'Σχέδιο κλιματισμού-εξαερισμού ορόφου', en: 'Floor HVAC/ventilation plan' },
      icon: 'Wind',
      order: 513,
      group: 'mechanical',
      perFloor: true,
    },
    {
      id: 'study-mep-electrical',
      purpose: 'study-mep-electrical',
      domain: 'construction',
      category: 'drawings',
      label: { el: 'Ηλεκτρολογικά', en: 'Electrical' },
      description: { el: 'Ηλεκτρολογικό σχέδιο ορόφου', en: 'Floor electrical plan' },
      icon: 'Zap',
      order: 514,
      group: 'mechanical',
      perFloor: true,
    },
    {
      id: 'study-mep-telecom',
      purpose: 'study-mep-telecom',
      domain: 'construction',
      category: 'drawings',
      label: { el: 'Τηλεπικοινωνίες / Δίκτυα', en: 'Telecom / Network' },
      description: { el: 'Τηλεφωνία, δεδομένα, δίκτυα ορόφου', en: 'Floor telecom/network plan' },
      icon: 'Wifi',
      order: 515,
      group: 'mechanical',
      perFloor: true,
    },
    {
      id: 'study-mep-other',
      purpose: 'study-mep-other',
      domain: 'construction',
      category: 'drawings',
      label: { el: 'Άλλο Η/Μ', en: 'Other MEP' },
      description: { el: 'Λοιπό ηλεκτρομηχανολογικό σχέδιο', en: 'Other MEP drawing' },
      icon: 'File',
      order: 549,
      group: 'mechanical',
      requiresCustomTitle: true,
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

    // ========================================================================
    // 🏢 ADR-191: ΜΕΛΕΤΕΣ ΟΙΚΟΔΟΜΙΚΗΣ ΑΔΕΙΑΣ — PROJECT LEVEL
    // ========================================================================

    // --- ADMINISTRATIVE / ΝΟΜΙΚΑ (100-119) ---
    {
      id: 'study-admin-application',
      purpose: 'study-application',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Αίτηση Οικοδομικής Άδειας', en: 'Building Permit Application' },
      description: { el: 'Αίτηση προς πολεοδομία', en: 'Application to planning authority' },
      icon: 'FileText',
      order: 100,
      group: 'administrative',
    },
    {
      id: 'study-admin-title-deed',
      purpose: 'study-title-deed',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Τίτλος Ιδιοκτησίας', en: 'Title Deed' },
      description: { el: 'Συμβόλαιο κτήσης / τίτλος ιδιοκτησίας', en: 'Property title deed / ownership document' },
      icon: 'ScrollText',
      order: 101,
      group: 'administrative',
    },
    {
      id: 'study-admin-cadastre',
      purpose: 'study-cadastre',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Κτηματογράφηση', en: 'Cadastre Certificate' },
      description: { el: 'Κτηματολογικό φύλλο / απόσπασμα', en: 'Cadastral map / excerpt' },
      icon: 'Map',
      order: 102,
      group: 'administrative',
    },
    {
      id: 'study-admin-topographic',
      purpose: 'study-topographic',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Τοπογραφικό Διάγραμμα', en: 'Topographic Survey' },
      description: { el: 'Τοπογραφικό διάγραμμα μηχανικού', en: 'Engineer topographic survey plan' },
      icon: 'MapPin',
      order: 103,
      group: 'administrative',
    },
    {
      id: 'study-admin-authority-approval',
      purpose: 'study-authority-approval',
      domain: 'admin',
      category: 'permits',
      label: { el: 'Εγκρίσεις Φορέων', en: 'Authority Approvals' },
      description: { el: 'Εγκρίσεις δασαρχείου, αρχαιολογίας κ.λπ.', en: 'Forestry, archaeology approvals etc.' },
      icon: 'ShieldCheck',
      order: 104,
      group: 'administrative',
    },
    {
      id: 'study-admin-urban-plan',
      purpose: 'study-urban-plan',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Βεβαίωση Χρήσεων Γης', en: 'Land Use Certificate' },
      description: { el: 'Βεβαίωση πολεοδομικών χρήσεων γης', en: 'Urban land use certification' },
      icon: 'FileCheck2',
      order: 105,
      group: 'administrative',
    },
    {
      id: 'study-admin-legal-status',
      purpose: 'study-legal-status',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Νομική Κατάσταση Ακινήτου', en: 'Property Legal Status' },
      description: { el: 'Πιστοποιητικό βαρών, υποθηκών κ.λπ.', en: 'Encumbrances, mortgages certificate' },
      icon: 'Scale',
      order: 106,
      group: 'administrative',
    },
    {
      id: 'study-admin-regulation',
      purpose: 'study-regulation',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Κανονισμός Πολυκατοικίας', en: 'Building Regulation' },
      description: { el: 'Κανονισμός συνιδιοκτησίας', en: 'Co-ownership building regulation' },
      icon: 'BookOpen',
      order: 107,
      group: 'administrative',
    },
    {
      id: 'study-admin-other',
      purpose: 'study-admin-other',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Άλλο Διοικητικό', en: 'Other Administrative' },
      description: { el: 'Λοιπό διοικητικό/νομικό έγγραφο', en: 'Other administrative/legal document' },
      icon: 'File',
      order: 119,
      group: 'administrative',
      requiresCustomTitle: true,
    },

    // --- FISCAL / ΑΣΦΑΛΙΣΤΙΚΑ (200-219) ---
    {
      id: 'study-fiscal-efka',
      purpose: 'study-efka',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Εισφορές ΕΦΚΑ', en: 'EFKA Contributions' },
      description: { el: 'Αποδεικτικό εισφορών ΕΦΚΑ (e-ΕΦΚΑ)', en: 'EFKA social insurance proof' },
      icon: 'Landmark',
      order: 200,
      group: 'fiscal',
    },
    {
      id: 'study-fiscal-engineer-fees',
      purpose: 'study-engineer-fees',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Αμοιβές Μηχανικών', en: 'Engineer Fees' },
      description: { el: 'Δήλωση αμοιβής μηχανικών (ΤΕΕ)', en: 'Engineer fee declaration (TEE)' },
      icon: 'Calculator',
      order: 201,
      group: 'fiscal',
    },
    {
      id: 'study-fiscal-fem',
      purpose: 'study-fem',
      domain: 'admin',
      category: 'documents',
      label: { el: 'ΦΕΜ (Φόρος Μηχανικού)', en: 'FEM (Engineer Tax)' },
      description: { el: 'Φορολογικό Ένσημο Μηχανικού', en: 'Engineer fiscal stamp' },
      icon: 'Stamp',
      order: 202,
      group: 'fiscal',
    },
    {
      id: 'study-fiscal-deductions',
      purpose: 'study-deductions',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Κρατήσεις / Τέλη', en: 'Deductions / Fees' },
      description: { el: 'Κρατήσεις ΤΕΕ, ΕΜΠ, ΤΣΜΕΔΕ', en: 'TEE, EMP, TSMEDE deductions' },
      icon: 'Percent',
      order: 203,
      group: 'fiscal',
    },
    {
      id: 'study-fiscal-municipal-tax',
      purpose: 'study-municipal-tax',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Δημοτικά Τέλη', en: 'Municipal Fees' },
      description: { el: 'Αποδεικτικά δημοτικών τελών', en: 'Municipal fee receipts' },
      icon: 'Building2',
      order: 204,
      group: 'fiscal',
    },
    {
      id: 'study-fiscal-insurance',
      purpose: 'study-insurance',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Ασφαλιστήριο Έργου', en: 'Project Insurance' },
      description: { el: 'Ασφαλιστήριο συμβόλαιο κατασκευής', en: 'Construction project insurance policy' },
      icon: 'ShieldCheck',
      order: 205,
      group: 'fiscal',
    },
    {
      id: 'study-fiscal-other',
      purpose: 'study-fiscal-other',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Άλλο Φορολογικό', en: 'Other Fiscal' },
      description: { el: 'Λοιπό φορολογικό/ασφαλιστικό έγγραφο', en: 'Other fiscal/insurance document' },
      icon: 'File',
      order: 219,
      group: 'fiscal',
      requiresCustomTitle: true,
    },

    // --- ENERGY / ΕΝΕΡΓΕΙΑΚΑ (600-619) ---
    {
      id: 'study-energy-mea',
      purpose: 'study-mea',
      domain: 'construction',
      category: 'documents',
      label: { el: 'ΜΕΑ / ΚΕΝΑΚ', en: 'Energy Study (KENAK)' },
      description: { el: 'Μελέτη Ενεργειακής Απόδοσης / ΚΕΝΑΚ', en: 'Energy performance study / KENAK' },
      icon: 'Zap',
      order: 600,
      group: 'energy',
    },
    {
      id: 'study-energy-certificate',
      purpose: 'study-energy-cert',
      domain: 'construction',
      category: 'documents',
      label: { el: 'Ενεργειακό Πιστοποιητικό (ΠΕΑ)', en: 'Energy Certificate (PEA)' },
      description: { el: 'Πιστοποιητικό Ενεργειακής Απόδοσης', en: 'Energy Performance Certificate' },
      icon: 'Award',
      order: 601,
      group: 'energy',
    },
    {
      id: 'study-energy-insulation',
      purpose: 'study-insulation',
      domain: 'construction',
      category: 'documents',
      label: { el: 'Μελέτη Θερμομόνωσης', en: 'Insulation Study' },
      description: { el: 'Μελέτη θερμομόνωσης κτιρίου', en: 'Building thermal insulation study' },
      icon: 'Thermometer',
      order: 602,
      group: 'energy',
    },
    {
      id: 'study-energy-other',
      purpose: 'study-energy-other',
      domain: 'construction',
      category: 'documents',
      label: { el: 'Άλλο Ενεργειακό', en: 'Other Energy' },
      description: { el: 'Λοιπό ενεργειακό έγγραφο', en: 'Other energy document' },
      icon: 'File',
      order: 619,
      group: 'energy',
      requiresCustomTitle: true,
    },

    // --- SITE / ΕΡΓΟΤΑΞΙΑΚΑ (700-719) ---
    {
      id: 'study-site-say-fay',
      purpose: 'study-say-fay',
      domain: 'construction',
      category: 'documents',
      label: { el: 'ΣΑΥ-ΦΑΥ', en: 'Safety Plan (SAY-FAY)' },
      description: { el: 'Σχέδιο Ασφάλειας & Υγείας / Φάκελος', en: 'Health & Safety Plan / File' },
      icon: 'HardHat',
      order: 700,
      group: 'site',
    },
    {
      id: 'study-site-waste',
      purpose: 'study-waste',
      domain: 'construction',
      category: 'documents',
      label: { el: 'ΣΔΑ (Διαχείριση Αποβλήτων)', en: 'Waste Management Plan' },
      description: { el: 'Σχέδιο Διαχείρισης Αποβλήτων', en: 'Construction waste management plan' },
      icon: 'Trash2',
      order: 701,
      group: 'site',
    },
    {
      id: 'study-site-schedule',
      purpose: 'study-schedule',
      domain: 'construction',
      category: 'documents',
      label: { el: 'Χρονοδιάγραμμα Κατασκευής', en: 'Construction Schedule' },
      description: { el: 'Χρονοδιάγραμμα εργασιών (Gantt)', en: 'Construction work schedule (Gantt)' },
      icon: 'CalendarRange',
      order: 702,
      group: 'site',
    },
    {
      id: 'study-site-environmental',
      purpose: 'study-env-terms',
      domain: 'construction',
      category: 'documents',
      label: { el: 'Περιβαλλοντικοί Όροι', en: 'Environmental Terms' },
      description: { el: 'Απόφαση Έγκρισης Περιβαλλοντικών Όρων', en: 'Environmental terms approval decision' },
      icon: 'TreeDeciduous',
      order: 703,
      group: 'site',
    },
    {
      id: 'study-site-fire-safety',
      purpose: 'study-fire-safety',
      domain: 'construction',
      category: 'documents',
      label: { el: 'Μελέτη Πυρασφάλειας', en: 'Fire Safety Study' },
      description: { el: 'Μελέτη πυρασφάλειας / πυροπροστασίας', en: 'Fire protection study' },
      icon: 'Flame',
      order: 704,
      group: 'site',
    },
    {
      id: 'study-site-other',
      purpose: 'study-site-other',
      domain: 'construction',
      category: 'documents',
      label: { el: 'Άλλο Εργοταξιακό', en: 'Other Site Document' },
      description: { el: 'Λοιπό εργοταξιακό/περιβαλλοντικό', en: 'Other site/environmental document' },
      icon: 'File',
      order: 719,
      group: 'site',
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

// ============================================================================
// 🏢 ADR-191: Hierarchical Study Entry Point Utilities
// ============================================================================

/**
 * Expand perFloor template entry points into concrete entries per floor.
 * Each template is cloned N times with floor info embedded in ID and label.
 */
export function expandFloorEntryPoints(
  templates: UploadEntryPoint[],
  floors: FloorInfo[]
): UploadEntryPoint[] {
  const result: UploadEntryPoint[] = [];

  for (const ep of templates) {
    if (!ep.perFloor) {
      result.push(ep);
      continue;
    }

    // perFloor template → expand one entry per floor
    for (const floor of floors) {
      result.push({
        ...ep,
        id: `${ep.id}__floor_${floor.id}`,
        perFloor: false, // expanded → no longer a template
        label: {
          el: `${ep.label.el} — ${floor.name}`,
          en: `${ep.label.en} — ${floor.name}`,
        },
        description: ep.description
          ? {
              el: `${ep.description.el} (${floor.name})`,
              en: `${ep.description.en} (${floor.name})`,
            }
          : undefined,
        order: ep.order + floor.number,
      });
    }
  }

  return result;
}

/**
 * Get entry points for a specific study group, with floor expansion.
 * Returns only entries matching the given group.
 */
export function getGroupedEntryPoints(
  entityType: EntityType,
  group: StudyGroup,
  floors?: FloorInfo[]
): UploadEntryPoint[] {
  const all = getSortedEntryPoints(entityType);
  const groupEntries = all.filter((ep) => ep.group === group);

  if (floors && floors.length > 0) {
    return expandFloorEntryPoints(groupEntries, floors);
  }

  // No floors provided: return templates as-is (UI will show warning)
  return groupEntries;
}

/**
 * Get available study groups for an entity type.
 * Returns only groups that have at least one entry point defined.
 */
export function getAvailableGroups(entityType: EntityType): StudyGroup[] {
  const all = getEntryPointsForEntity(entityType);
  const groups = new Set<StudyGroup>();

  for (const ep of all) {
    if (ep.group) {
      groups.add(ep.group);
    }
  }

  return Array.from(groups);
}

/**
 * Get entry points without a study group (legacy / general documents).
 * These are shown in the "Γενικά Έγγραφα" section.
 */
export function getUngroupedEntryPoints(entityType: EntityType): UploadEntryPoint[] {
  return getSortedEntryPoints(entityType).filter((ep) => !ep.group);
}

/**
 * Check if an entry type has any perFloor template entries.
 */
export function hasPerFloorEntries(entityType: EntityType): boolean {
  return getEntryPointsForEntity(entityType).some((ep) => ep.perFloor);
}
