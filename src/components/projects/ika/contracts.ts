/**
 * =============================================================================
 * IKA/EFKA Labor Compliance — TypeScript Interfaces (Barrel)
 * =============================================================================
 *
 * Enterprise-grade types for the IKA tab system.
 * Covers: Workers, EFKA Declaration, Employment Records, Stamps.
 *
 * Re-exports from sibling modules:
 * - contracts-attendance.ts → AttendanceEvent + view models
 * - contracts-qr.ts         → QR token + geofence + photo verification
 * - contracts-defaults.ts   → default rates/classes + createDefaultEfkaDeclaration
 *
 * @module components/projects/ika/contracts
 * @enterprise ADR-090 — IKA/EFKA Labor Compliance System
 *
 * Design principles:
 * - NO `any` types — all strictly typed
 * - Nullable fields use `| null` (Firestore compatible)
 * - Reuses existing Contact/Relationship types
 * - Config-driven insurance classes (from system/settings)
 */

import type { ContactRelationship } from '@/types/contacts/relationships/interfaces/relationship';

// ============================================================================
// EFKA DECLARATION (Αναγγελία Έργου)
// ============================================================================

/** Status lifecycle for EFKA project declaration */
export type EfkaDeclarationStatus =
  | 'draft'           // Πρόχειρη — αρχική κατάσταση
  | 'preparation'     // Σε Προετοιμασία — συμπληρώνονται στοιχεία
  | 'submitted'       // Υποβλήθηκε στο e-ΕΦΚΑ
  | 'active'          // Ενεργή — ΑΜΟΕ εκδόθηκε
  | 'amended'         // Τροποποιημένη
  | 'closed';         // Κλειστή — έργο ολοκληρώθηκε

/** EFKA document types (Ε.1, Ε.3, Ε.4) */
export type EfkaDocumentType = 'E1' | 'E3' | 'E4';

/** Status of an individual EFKA document */
export type EfkaDocumentStatus = 'pending' | 'uploaded' | 'submitted' | 'approved';

/** Project category for EFKA declaration */
export type EfkaProjectCategory = 'construction' | 'technical';

/** Individual EFKA document tracking */
export interface EfkaDocument {
  /** Document type identifier */
  type: EfkaDocumentType;
  /** Human-readable label (e.g., "Ε.1 — Αναγγελία Πρόσληψης") */
  label: string;
  /** Current status */
  status: EfkaDocumentStatus;
  /** URL to uploaded file (null if not yet uploaded) */
  fileUrl: string | null;
  /** Upload timestamp (ISO string) */
  uploadedAt: string | null;
  /** Submission timestamp to EFKA (ISO string) */
  submittedAt: string | null;
  /** Additional notes */
  notes: string | null;
}

/**
 * EFKA Declaration data — stored as field on Project document
 * (1:1 relationship: one declaration per project)
 *
 * Contains the 7 required fields for ΕΦΚΑ project declaration → ΑΜΟΕ
 */
export interface EfkaDeclarationData {
  // === 7 REQUIRED FIELDS FOR ΕΦΚΑ ===

  /** 1. ΑΦΜ Εργοδότη (employer VAT number) */
  employerVatNumber: string | null;
  /** 2. Διεύθυνση Έργου */
  projectAddress: string | null;
  /** 3. Περιγραφή Έργου */
  projectDescription: string | null;
  /** 4. Ημερομηνία Έναρξης (ISO string) */
  startDate: string | null;
  /** 5. Εκτιμώμενη Ημερομηνία Λήξης (ISO string) */
  estimatedEndDate: string | null;
  /** 6. Εκτιμώμενος Αριθμός Εργαζομένων */
  estimatedWorkerCount: number | null;
  /** 7. Κατηγορία Έργου */
  projectCategory: EfkaProjectCategory | null;

  // === ΑΜΟΕ (Αριθμός Μητρώου Οικοδομοτεχνικού Έργου) ===

  /** ΑΜΟΕ — assigned by ΕΦΚΑ after successful submission */
  amoe: string | null;
  /** Date ΑΜΟΕ was assigned (ISO string) */
  amoeAssignedDate: string | null;

  // === STATUS & TRACKING ===

  /** Current declaration status */
  status: EfkaDeclarationStatus;

  // === DOCUMENT TRACKING ===

  /** Tracked EFKA documents (Ε.1, Ε.3, Ε.4) */
  documents: EfkaDocument[];

  // === AUDIT FIELDS ===

  /** Creation timestamp (ISO string) */
  createdAt: string;
  /** Created by user ID */
  createdBy: string;
  /** Last update timestamp (ISO string) */
  updatedAt: string;
  /** Updated by user ID */
  updatedBy: string;
  /** Submission timestamp (ISO string) */
  submittedAt: string | null;
  /** Submitted by user ID */
  submittedBy: string | null;

  // === NOTES ===

  /** Free-text notes about the declaration */
  notes: string | null;
}

// ============================================================================
// PROJECT WORKER (View Model for IKA Tab)
// ============================================================================

/**
 * Enriched worker view for IKA tab display.
 * Combines data from Contact + ContactRelationship + ContactLink.
 */
export interface ProjectWorker {
  /** Contact document ID */
  contactId: string;
  /** Full name (firstName + lastName) */
  name: string;
  /** Worker specialty (e.g., "Τεχνίτης σκυροδέματος") */
  specialty: string | null;
  /** Company/contractor name the worker belongs to */
  company: string | null;
  /** Company contact ID */
  companyContactId: string | null;
  /** Insurance class ID (for stamps calculation) */
  insuranceClassId: string | null;
  /** ΑΜΚΑ (Social Security Number) */
  amka: string | null;
  /** ΑΦΜ (Tax ID) */
  afm: string | null;
  /** Employment status */
  employmentStatus: string | null;
  /** Employment type */
  employmentType: string | null;
  /** Job position/title */
  position: string | null;
  /** Hire date (ISO string) */
  hireDate: string | null;
  /** Termination date (ISO string) */
  terminationDate: string | null;
  /** Contact link document ID (for unlinking) */
  linkId: string;
  /** Original relationship data (for detailed view) */
  relationship: ContactRelationship | null;
}

// ============================================================================
// INSURANCE CLASSES (Config-driven from system/settings)
// ============================================================================

/** Insurance class as defined by EFKA regulations */
export interface InsuranceClass {
  /** Class number (e.g., 1, 5, 10, 14) */
  classNumber: number;
  /** Minimum daily wage for this class */
  minDailyWage: number;
  /** Maximum daily wage for this class */
  maxDailyWage: number;
  /** Imputed daily wage (τεκμαρτό ημερομίσθιο) */
  imputedDailyWage: number;
  /** Effective year */
  year: number;
}

/** Contribution rates (employer + employee) */
export interface ContributionRates {
  mainPension: { employer: number; employee: number };
  health: { employer: number; employee: number };
  supplementary: { employer: number; employee: number };
  unemployment: { employer: number; employee: number };
  iek: { employer: number; employee: number };
  oncePayment: { employee: number };
}

/** Full labor compliance config (from system/settings) */
export interface LaborComplianceConfig {
  insuranceClasses: InsuranceClass[];
  contributionRates: ContributionRates;
  lastUpdated: string;
}

// ============================================================================
// EMPLOYMENT RECORD (Phase 3 — forward-compatible type definitions)
// ============================================================================

/** APD submission status */
export type ApdStatus = 'pending' | 'submitted' | 'accepted' | 'rejected' | 'corrected';

/** Monthly employment record per worker per project */
export interface EmploymentRecord {
  id: string;
  projectId: string;
  contactId: string;
  /** Month (1-12) */
  month: number;
  /** Year */
  year: number;
  /** Total days worked in this month */
  totalDaysWorked: number;
  /** Total hours worked */
  totalHoursWorked: number;
  /** Overtime hours */
  overtimeHours: number;
  /** Insurance class number */
  insuranceClassNumber: number;
  /** Number of stamps (ένσημα) */
  stampsCount: number;
  /** Daily wage used for calculation */
  dailyWage: number;
  /** Employer contribution amount (€) */
  employerContribution: number;
  /** Employee contribution amount (€) */
  employeeContribution: number;
  /** Total contribution amount (€) */
  totalContribution: number;
  /** APD submission status */
  apdStatus: ApdStatus;
  /** APD submission date (ISO string) */
  apdSubmissionDate: string | null;
  /** APD reference number */
  apdReferenceNumber: string | null;
  /** Audit */
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// STAMPS CALCULATION COMPUTED TYPES (Phase 3 — UI view models)
// ============================================================================

/** Per-worker stamps summary for a given month */
export interface WorkerStampsSummary {
  /** Worker contact ID */
  contactId: string;
  /** Worker display name */
  workerName: string;
  /** Company name (null for independent) */
  companyName: string | null;
  /** Assigned insurance class number (null = not assigned) */
  insuranceClassNumber: number | null;
  /** Imputed daily wage from insurance class (null if no class) */
  imputedDailyWage: number | null;
  /** Days worked in the month (from attendance events) */
  daysWorked: number;
  /** Number of stamps = daysWorked */
  stampsCount: number;
  /** Employer contribution amount (€) */
  employerContribution: number;
  /** Employee contribution amount (€) */
  employeeContribution: number;
  /** Total contribution amount (€) */
  totalContribution: number;
  /** Whether this record has issues */
  hasIssues: boolean;
  /** Human-readable issue description */
  issueDescription: string | null;
}

/** Monthly stamps summary per project (dashboard data) */
export interface StampsMonthSummary {
  /** Project ID */
  projectId: string;
  /** Month (1-12) */
  month: number;
  /** Year */
  year: number;
  /** Total workers linked to project */
  totalWorkers: number;
  /** Total stamps for the month */
  totalStamps: number;
  /** Sum of employer contributions (€) */
  totalEmployerContribution: number;
  /** Sum of employee contributions (€) */
  totalEmployeeContribution: number;
  /** Sum of all contributions (€) */
  totalContribution: number;
  /** Per-worker summaries */
  workerSummaries: WorkerStampsSummary[];
  /** Count of records with issues (missing class, missing days) */
  recordsWithIssues: number;
}

// ============================================================================
// HELPER TYPES
// ============================================================================

/** Checklist item for EFKA declaration form */
export interface EfkaChecklistItem {
  /** Field key matching EfkaDeclarationData property */
  fieldKey: keyof Pick<
    EfkaDeclarationData,
    'employerVatNumber' | 'projectAddress' | 'projectDescription' |
    'startDate' | 'estimatedEndDate' | 'estimatedWorkerCount' | 'projectCategory'
  >;
  /** Whether this field has a value */
  completed: boolean;
}

// ============================================================================
// RE-EXPORTS (C.5.23 SRP split — ADR-314)
// ============================================================================

export type {
  AttendanceEventType,
  AttendanceMethod,
  AttendanceEvent,
  AttendanceViewMode,
  WorkerAttendanceStatus,
  AttendanceAnomalyType,
  AttendanceAnomaly,
  WorkerDailySummary,
  ProjectDailySummary,
  CrewGroup,
} from './contracts-attendance';

export type {
  QrTokenStatus,
  AttendanceQrToken,
  GeofenceConfig,
  AttendancePhotoMetadata,
  GeofenceVerificationResult,
  QrCheckInPayload,
  QrCheckInResponse,
} from './contracts-qr';

export {
  DEFAULT_CONTRIBUTION_RATES,
  DEFAULT_INSURANCE_CLASSES,
  DEFAULT_LABOR_COMPLIANCE_CONFIG,
  DEFAULT_EFKA_DOCUMENTS,
  createDefaultEfkaDeclaration,
} from './contracts-defaults';
