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

/** APD period for tracking submission deadlines */
export interface ApdPeriod {
  /** Project ID */
  projectId: string;
  /** Month (1-12) */
  month: number;
  /** Year */
  year: number;
  /** APD submission status */
  status: ApdStatus;
  /** Submission date (ISO string) */
  submissionDate: string | null;
  /** ΕΦΚΑ reference number */
  referenceNumber: string | null;
  /** Mandatory submission deadline (ISO date) */
  deadline: string;
  /** Total contribution amount for this period (€) */
  totalContribution: number;
  /** Number of workers in this period */
  workerCount: number;
  /** Notes */
  notes: string | null;
}

// ============================================================================
// DEFAULT CONFIGURATION (KPK 781 — Οικοδομοτεχνικά, 01/01/2025)
// ============================================================================

/**
 * Default contribution rates for KPK 781 (construction workers).
 * Source: ΕΦΚΑ Εγκύκλιος 39/2024 — effective 01/01/2025.
 * Total: Employer 57.427%, Employee 16.820%, Combined 74.247%.
 */
export const DEFAULT_CONTRIBUTION_RATES: ContributionRates = {
  mainPension: { employer: 13.33, employee: 6.67 },
  health: { employer: 4.55, employee: 2.55 },
  supplementary: { employer: 3.25, employee: 3.25 },
  unemployment: { employer: 2.43, employee: 2.00 },
  iek: { employer: 0.837, employee: 2.32 },
  oncePayment: { employee: 4.00 },
};

/**
 * Default insurance classes for construction workers (2025).
 * Source: ΕΦΚΑ Εγκύκλιος 39/2024 — adjusted +2.4% from 01/01/2025.
 * Contains representative classes — full 28-class table loaded from config.
 */
export const DEFAULT_INSURANCE_CLASSES: InsuranceClass[] = [
  { classNumber: 1, minDailyWage: 0.01, maxDailyWage: 11.45, imputedDailyWage: 8.22, year: 2025 },
  { classNumber: 2, minDailyWage: 11.46, maxDailyWage: 13.47, imputedDailyWage: 12.46, year: 2025 },
  { classNumber: 3, minDailyWage: 13.48, maxDailyWage: 15.57, imputedDailyWage: 14.52, year: 2025 },
  { classNumber: 4, minDailyWage: 15.58, maxDailyWage: 18.57, imputedDailyWage: 17.07, year: 2025 },
  { classNumber: 5, minDailyWage: 18.58, maxDailyWage: 21.12, imputedDailyWage: 19.85, year: 2025 },
  { classNumber: 6, minDailyWage: 21.13, maxDailyWage: 24.13, imputedDailyWage: 22.63, year: 2025 },
  { classNumber: 7, minDailyWage: 24.14, maxDailyWage: 27.14, imputedDailyWage: 25.63, year: 2025 },
  { classNumber: 8, minDailyWage: 27.15, maxDailyWage: 34.52, imputedDailyWage: 30.83, year: 2025 },
  { classNumber: 9, minDailyWage: 34.53, maxDailyWage: 37.73, imputedDailyWage: 36.13, year: 2025 },
  { classNumber: 10, minDailyWage: 37.74, maxDailyWage: 40.49, imputedDailyWage: 39.08, year: 2025 },
  { classNumber: 11, minDailyWage: 40.50, maxDailyWage: 43.70, imputedDailyWage: 42.10, year: 2025 },
  { classNumber: 12, minDailyWage: 43.71, maxDailyWage: 46.90, imputedDailyWage: 45.30, year: 2025 },
  { classNumber: 13, minDailyWage: 46.91, maxDailyWage: 52.96, imputedDailyWage: 49.93, year: 2025 },
  { classNumber: 14, minDailyWage: 52.97, maxDailyWage: 56.17, imputedDailyWage: 54.57, year: 2025 },
  { classNumber: 15, minDailyWage: 56.18, maxDailyWage: 59.37, imputedDailyWage: 57.77, year: 2025 },
  { classNumber: 16, minDailyWage: 59.38, maxDailyWage: 62.57, imputedDailyWage: 60.97, year: 2025 },
  { classNumber: 17, minDailyWage: 62.58, maxDailyWage: 66.00, imputedDailyWage: 64.29, year: 2025 },
  { classNumber: 18, minDailyWage: 66.01, maxDailyWage: 69.40, imputedDailyWage: 67.70, year: 2025 },
  { classNumber: 19, minDailyWage: 69.41, maxDailyWage: 72.61, imputedDailyWage: 71.01, year: 2025 },
  { classNumber: 20, minDailyWage: 72.62, maxDailyWage: 75.81, imputedDailyWage: 74.21, year: 2025 },
  { classNumber: 21, minDailyWage: 75.82, maxDailyWage: 79.24, imputedDailyWage: 77.53, year: 2025 },
  { classNumber: 22, minDailyWage: 79.25, maxDailyWage: 84.04, imputedDailyWage: 81.64, year: 2025 },
  { classNumber: 23, minDailyWage: 84.05, maxDailyWage: 87.24, imputedDailyWage: 85.64, year: 2025 },
  { classNumber: 24, minDailyWage: 87.25, maxDailyWage: 90.44, imputedDailyWage: 88.84, year: 2025 },
  { classNumber: 25, minDailyWage: 90.45, maxDailyWage: 97.04, imputedDailyWage: 93.74, year: 2025 },
  { classNumber: 26, minDailyWage: 97.05, maxDailyWage: 100.25, imputedDailyWage: 98.65, year: 2025 },
  { classNumber: 27, minDailyWage: 100.26, maxDailyWage: 106.25, imputedDailyWage: 103.25, year: 2025 },
  { classNumber: 28, minDailyWage: 106.26, maxDailyWage: 999999, imputedDailyWage: 109.69, year: 2025 },
];

/**
 * Default labor compliance configuration.
 * Used as fallback when system/settings.laborCompliance is not yet configured.
 */
export const DEFAULT_LABOR_COMPLIANCE_CONFIG: LaborComplianceConfig = {
  insuranceClasses: DEFAULT_INSURANCE_CLASSES,
  contributionRates: DEFAULT_CONTRIBUTION_RATES,
  lastUpdated: '2025-01-01',
};

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
