/**
 * =============================================================================
 * IKA/EFKA Labor Compliance — TypeScript Interfaces
 * =============================================================================
 *
 * Enterprise-grade types for the IKA tab system.
 * Covers: Workers, EFKA Declaration, Attendance, Employment Records.
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
// ATTENDANCE EVENT (Phase 2 — forward-compatible type definitions)
// ============================================================================

/** Attendance event types */
export type AttendanceEventType =
  | 'check_in'
  | 'check_out'
  | 'break_start'
  | 'break_end'
  | 'left_site'
  | 'returned'
  | 'exit_permission';

/** Method of attendance recording */
export type AttendanceMethod = 'manual' | 'qr' | 'geofence' | 'nfc';

/** Immutable attendance event (append-only, never updated) */
export interface AttendanceEvent {
  id: string;
  projectId: string;
  contactId: string;
  eventType: AttendanceEventType;
  method: AttendanceMethod;
  /** Server timestamp — immutable */
  timestamp: string;
  /** GPS coordinates (for geofence verification) */
  coordinates: { lat: number; lng: number } | null;
  /** Device identifier */
  deviceId: string | null;
  /** User who recorded the event */
  recordedBy: string;
  /** Optional notes */
  notes: string | null;
  /** Approval reference (for exit_permission) */
  approvedBy: string | null;
  /** Immutable creation timestamp */
  createdAt: string;
}

// ============================================================================
// ATTENDANCE COMPUTED TYPES (Phase 2 — UI view models)
// ============================================================================

/** View mode for attendance tab */
export type AttendanceViewMode = 'daily' | 'weekly' | 'monthly';

/** Worker attendance status at a point in time */
export type WorkerAttendanceStatus =
  | 'present'         // Στο εργοτάξιο (last event: check_in | returned | break_end)
  | 'absent'          // Δεν ήρθε (no events today)
  | 'off_site'        // Εκτός εργοταξίου (last event: left_site)
  | 'on_break'        // Σε διάλειμμα (last event: break_start)
  | 'checked_out';    // Αποχώρησε (last event: check_out)

/** Attendance anomaly types for compliance tracking */
export type AttendanceAnomalyType =
  | 'missing_checkout'        // Check-in χωρίς check-out
  | 'missing_checkin'         // Check-out χωρίς check-in
  | 'unauthorized_absence'    // Αποχώρηση χωρίς άδεια > 30 λεπτά
  | 'overtime_undeclared'     // Υπερωρία χωρίς δήλωση ΕΡΓΑΝΗ
  | 'long_break'              // Διάλειμμα > 60 λεπτά
  | 'late_arrival';           // Καθυστερημένη άφιξη

/** Anomaly record — detected from event analysis */
export interface AttendanceAnomaly {
  /** Anomaly classification */
  type: AttendanceAnomalyType;
  /** Human-readable description */
  description: string;
  /** Severity level for UI display */
  severity: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Daily summary per worker — computed from AttendanceEvent[]
 * Used by DailyTimeline component for table rows
 */
export interface WorkerDailySummary {
  /** Worker contact ID */
  contactId: string;
  /** Worker display name */
  workerName: string;
  /** Company name (for crew grouping) */
  companyName: string | null;
  /** Company contact ID (for crew grouping) */
  companyContactId: string | null;
  /** Date in ISO format (YYYY-MM-DD) */
  date: string;
  /** Current real-time status */
  currentStatus: WorkerAttendanceStatus;
  /** First check-in timestamp (ISO) */
  firstCheckIn: string | null;
  /** Last check-out timestamp (ISO) */
  lastCheckOut: string | null;
  /** Total minutes on-site (check_in → check_out intervals) */
  totalPresenceMinutes: number;
  /** Total break minutes (break_start → break_end intervals) */
  totalBreakMinutes: number;
  /** Total off-site minutes (left_site → returned intervals) */
  totalOffSiteMinutes: number;
  /** Effective work = presence - breaks - offSite */
  effectiveWorkMinutes: number;
  /** All events for this worker on this day (ordered by timestamp) */
  events: AttendanceEvent[];
  /** Detected anomalies */
  anomalies: AttendanceAnomaly[];
  /** Primary recording method used */
  method: AttendanceMethod;
}

/**
 * Project-level daily summary — dashboard aggregate data
 * Used by AttendanceDashboard for summary cards
 */
export interface ProjectDailySummary {
  /** Date in ISO format (YYYY-MM-DD) */
  date: string;
  /** Project ID */
  projectId: string;
  /** Total workers linked to project */
  totalWorkers: number;
  /** Workers currently on-site */
  presentCount: number;
  /** Workers expected but absent */
  absentCount: number;
  /** Workers who left site */
  offSiteCount: number;
  /** Workers on break */
  onBreakCount: number;
  /** Workers who checked out */
  checkedOutCount: number;
  /** Sum of effective work hours (all workers) */
  totalHoursToday: number;
  /** Total anomalies detected */
  anomalyCount: number;
  /** Individual worker summaries */
  workerSummaries: WorkerDailySummary[];
}

/**
 * Crew grouping — workers grouped by company (συνεργείο)
 * Used by CrewGroupFilter for filtering
 */
export interface CrewGroup {
  /** Company contact ID (null for independent workers) */
  companyContactId: string | null;
  /** Company display name */
  companyName: string;
  /** Workers in this crew */
  workers: ProjectWorker[];
  /** Workers currently present */
  presentCount: number;
  /** Total workers in crew */
  totalCount: number;
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

/** Default EFKA documents template */
export const DEFAULT_EFKA_DOCUMENTS: EfkaDocument[] = [
  {
    type: 'E1',
    label: 'Ε.1 — Αναγγελία Πρόσληψης',
    status: 'pending',
    fileUrl: null,
    uploadedAt: null,
    submittedAt: null,
    notes: null,
  },
  {
    type: 'E3',
    label: 'Ε.3 — Αναγγελία Οικοδομοτεχνικού Έργου',
    status: 'pending',
    fileUrl: null,
    uploadedAt: null,
    submittedAt: null,
    notes: null,
  },
  {
    type: 'E4',
    label: 'Ε.4 — Πίνακας Προσωπικού',
    status: 'pending',
    fileUrl: null,
    uploadedAt: null,
    submittedAt: null,
    notes: null,
  },
];

/**
 * Creates a default (empty) EFKA declaration for a new project.
 */
export function createDefaultEfkaDeclaration(userId: string): EfkaDeclarationData {
  const now = new Date().toISOString();
  return {
    employerVatNumber: null,
    projectAddress: null,
    projectDescription: null,
    startDate: null,
    estimatedEndDate: null,
    estimatedWorkerCount: null,
    projectCategory: null,
    amoe: null,
    amoeAssignedDate: null,
    status: 'draft',
    documents: [...DEFAULT_EFKA_DOCUMENTS],
    createdAt: now,
    createdBy: userId,
    updatedAt: now,
    updatedBy: userId,
    submittedAt: null,
    submittedBy: null,
    notes: null,
  };
}
