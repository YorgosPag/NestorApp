/**
 * Org Structure SSoT Types (ADR-326)
 * Shared schema for L1 (Tenant) and L2 (CompanyContact) org hierarchies.
 * L3 (ServiceContact) uses responsiblePersons[] — NOT this type.
 */

import type { FirestoreishTimestamp } from '@/types/contacts/contracts';
import type { DepartmentCode } from '@/config/department-codes';
import type { NotificationEventCode } from '@/config/notification-events';

// ─── Extended contact info types ─────────────────────────────────────────────
// Superset of EmailInfo/PhoneInfo from contracts.ts — adds org-routing literals.

export interface OrgEmailInfo {
  email: string;
  type: 'personal' | 'work' | 'invoice' | 'notification' | 'support' | 'other';
  isPrimary: boolean;
  label?: string;
}

export interface OrgPhoneInfo {
  number: string;
  type: 'mobile' | 'home' | 'work' | 'fax' | 'internal' | 'other';
  isPrimary: boolean;
  label?: string;
  countryCode?: string;
  extension?: string;
}

// ─── Aggregate ────────────────────────────────────────────────────────────────

/** Root aggregate — stored at companies/{id}.settings.orgStructure (L1) or contacts/{id}.orgStructure (L2). */
export interface OrgStructure {
  /** Enterprise ID: org_xxx */
  id: string;
  departments: OrgDepartment[];
  /** Per-event routing overrides. When absent, DEFAULT_EVENT_TO_DEPARTMENT applies. */
  notificationRouting?: NotificationRoutingRule[];
  updatedAt: FirestoreishTimestamp;
  updatedBy: string;
}

// ─── Department ───────────────────────────────────────────────────────────────

export interface OrgDepartment {
  /** Enterprise ID: odep_xxx */
  id: string;
  /** Canonical code (see DEPARTMENT_CODES) or 'custom' for user-defined */
  code: DepartmentCode;
  /** i18n key for canonical; free-text label for code='custom' */
  label?: string;
  phones?: OrgPhoneInfo[];
  emails?: OrgEmailInfo[];
  members: OrgMember[];
  status: 'active' | 'archived';
  createdAt: FirestoreishTimestamp;
}

// ─── Member ───────────────────────────────────────────────────────────────────

export type OrgMemberRole =
  | 'head'      // Επικεφαλής τμήματος — max 1, reportsTo === null
  | 'manager'   // Προϊστάμενος υπο-ομάδας
  | 'senior'    // Senior εργαζόμενος
  | 'employee'  // Εργαζόμενος
  | 'intern'    // Ασκούμενος / Stagiaire
  | 'custom';   // User-defined role — positionLabel required

export type OrgMemberMode = 'linked' | 'created' | 'plain';

export interface OrgMember {
  /** Enterprise ID: omem_xxx */
  id: string;
  displayName: string;
  /** Declaration mode (§3.10): linked/created → contactId set; plain → null */
  mode: OrgMemberMode;
  /** Set for 'linked' and 'created' modes; null for 'plain' */
  contactId?: string | null;
  /** Firebase Auth user link — L1 only. Server rejects non-null on L2 (G8). */
  userId?: string | null;
  positionLabel?: string;
  role: OrgMemberRole;
  /** Manager pointer (Google pattern §3.11): null = department head */
  reportsTo: string | null;
  /** Exactly 1 per department must be true. Invariant: isDepartmentHead ↔ reportsTo === null */
  isDepartmentHead: boolean;
  /** Backup routing candidate when head is archived (G3). Default: true if isDepartmentHead. */
  receivesNotifications: boolean;
  emails: OrgEmailInfo[];
  phones: OrgPhoneInfo[];
  preferredChannel?: 'email' | 'mobile' | 'landline' | 'extension';
  availableHours?: string;
  notes?: string;
  status: 'active' | 'archived';
}

// ─── Notification routing ─────────────────────────────────────────────────────

export interface NotificationRoutingRule {
  event: NotificationEventCode;
  targetDepartmentCode: DepartmentCode;
  /** Per-event override: bypasses head lookup entirely */
  overrideEmail?: string;
}

// ─── Tree view (read-side only, never stored) ─────────────────────────────────

export interface OrgNode {
  member: OrgMember;
  children: OrgNode[];
  depth: number;
}
