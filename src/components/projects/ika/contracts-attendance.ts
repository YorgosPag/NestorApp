/**
 * =============================================================================
 * IKA/EFKA Labor Compliance — Attendance Types
 * =============================================================================
 *
 * Extracted from contracts.ts (C.5.23 SRP split) — ADR-314.
 * Forward-compatible attendance event + view model definitions (Phase 2).
 *
 * @module components/projects/ika/contracts-attendance
 * @enterprise ADR-090 — IKA/EFKA Labor Compliance System
 */

import type { ProjectWorker } from './contracts';

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
