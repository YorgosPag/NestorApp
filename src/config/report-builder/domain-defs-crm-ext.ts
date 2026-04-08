/**
 * @module config/report-builder/domain-defs-crm-ext
 * @enterprise ADR-268 Phase 6d — CRM Extended Domain Definitions
 *
 * E3: Communications (Επικοινωνίες) — 2 computed fields (G6, G15)
 * E4: Appointments (Ραντεβού) — 4 computed fields (G7, G8, G16, G17)
 *
 * CRM Gap Analysis (2026-03-30) — research across:
 * Salesforce, HubSpot, Pipedrive, Zoho CRM, Microsoft Dynamics 365
 *
 * Enterprise computed fields:
 * - G6:  Days Since Contact (all platforms)
 * - G15: Is Going Cold boolean flag (Pipedrive "rotting", Salesforce Einstein)
 * - G7:  Is Stale / forgotten appointment (Salesforce, HubSpot)
 * - G8:  Waiting Days since creation (Pipedrive, Zoho)
 * - G16: Reschedule Count — COMPETITIVE ADVANTAGE (no CRM does this natively)
 * - G17: Days To Approval / response time (Dynamics 365 SLA, Salesforce)
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { TRIAGE_STATUS_VALUES } from '@/constants/triage-statuses';
import type { DomainDefinition } from './report-builder-types';

// ============================================================================
// Enum Constants (SSoT — match Firestore data & crm.ts / appointment.ts types)
// ============================================================================

const COMMUNICATION_TYPES = [
  'email', 'phone', 'sms', 'whatsapp', 'telegram', 'meeting', 'note',
] as const;

const COMMUNICATION_DIRECTIONS = ['inbound', 'outbound'] as const;

const COMMUNICATION_STATUSES = [
  'completed', 'scheduled', 'cancelled', 'pending',
  'sent', 'delivered', 'failed',
] as const;

const APPOINTMENT_STATUSES = [
  'pending_approval', 'approved', 'rejected', 'cancelled', 'completed',
] as const;

/** Threshold in days for "going cold" — industry standard: 30 days */
const COLD_THRESHOLD_DAYS = 30;

// ============================================================================
// Computed Field Helpers — Communications
// ============================================================================

/** G6: Days since this communication was created */
function computeDaysSinceContact(doc: Record<string, unknown>): number | null {
  const created = doc['createdAt'] as string | undefined;
  if (!created) return null;
  const ms = Date.now() - new Date(created).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

/** G15: Is the contact going cold (no recent communication) */
function computeIsGoingCold(doc: Record<string, unknown>): boolean {
  const created = doc['createdAt'] as string | undefined;
  if (!created) return false;
  const days = Math.round(
    (Date.now() - new Date(created).getTime()) / 86_400_000,
  );
  return days > COLD_THRESHOLD_DAYS;
}

// ============================================================================
// Computed Field Helpers — Appointments
// ============================================================================

/** G7: Is appointment stale (approved but date passed without completion) */
function computeIsStale(doc: Record<string, unknown>): boolean {
  const status = doc['status'] as string | undefined;
  if (status !== 'approved') return false;

  const requestedDate = doc['appointment.requestedDate'] as string | undefined
    ?? (doc['appointment'] as Record<string, unknown> | undefined)?.['requestedDate'] as string | undefined;
  if (!requestedDate) return false;

  return new Date(requestedDate).getTime() < Date.now();
}

/** G8: Waiting days since creation (for non-terminal statuses) */
function computeWaitingDays(doc: Record<string, unknown>): number | null {
  const status = doc['status'] as string | undefined;
  if (status === 'completed' || status === 'rejected' || status === 'cancelled') {
    return null;
  }
  const created = doc['createdAt'] as string | undefined;
  if (!created) return null;
  const ms = Date.now() - new Date(created).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

/** G17: Days from creation to approval */
function computeDaysToApproval(doc: Record<string, unknown>): number | null {
  const created = doc['createdAt'] as string | undefined;
  const approved = doc['approvedAt'] as string | undefined;
  if (!created || !approved) return null;
  const ms = new Date(approved).getTime() - new Date(created).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

// ============================================================================
// E3: Communications (Επικοινωνίες)
// ============================================================================

export const COMMUNICATIONS_DEFINITION: DomainDefinition = {
  id: 'communications',
  collection: COLLECTIONS.COMMUNICATIONS,
  group: 'crm',
  labelKey: 'domains.communications.label',
  descriptionKey: 'domains.communications.description',
  // eslint-disable-next-line custom/no-hardcoded-strings -- route template
  entityLinkPath: '/crm/communications/{id}',
  defaultSortField: 'createdAt',
  defaultSortDirection: 'desc',
  fields: [
    // Identity
    { key: 'subject', labelKey: 'domains.communications.fields.subject', type: 'text', filterable: true, sortable: true, defaultVisible: true },
    { key: 'type', labelKey: 'domains.communications.fields.type', type: 'enum', filterable: true, sortable: true, defaultVisible: true, enumValues: COMMUNICATION_TYPES, enumLabelPrefix: 'domains.communications.enums.type' },
    { key: 'direction', labelKey: 'domains.communications.fields.direction', type: 'enum', filterable: true, sortable: true, defaultVisible: true, enumValues: COMMUNICATION_DIRECTIONS, enumLabelPrefix: 'domains.communications.enums.direction' },
    { key: 'status', labelKey: 'domains.communications.fields.status', type: 'enum', filterable: true, sortable: true, defaultVisible: true, enumValues: COMMUNICATION_STATUSES, enumLabelPrefix: 'domains.communications.enums.status' },
    // Sender / Receiver
    { key: 'from', labelKey: 'domains.communications.fields.from', type: 'text', filterable: true, sortable: true, defaultVisible: false },
    { key: 'to', labelKey: 'domains.communications.fields.to', type: 'text', filterable: true, sortable: true, defaultVisible: false },
    // Details
    { key: 'duration', labelKey: 'domains.communications.fields.duration', type: 'number', filterable: true, sortable: true, defaultVisible: false, format: 'number' },
    { key: 'location', labelKey: 'domains.communications.fields.location', type: 'text', filterable: true, sortable: false, defaultVisible: false },
    // Follow-up
    { key: 'requiresFollowUp', labelKey: 'domains.communications.fields.requiresFollowUp', type: 'boolean', filterable: true, sortable: true, defaultVisible: false },
    { key: 'followUpDate', labelKey: 'domains.communications.fields.followUpDate', type: 'date', filterable: true, sortable: true, defaultVisible: false, format: 'date' },
    // Triage & AI
    { key: 'triageStatus', labelKey: 'domains.communications.fields.triageStatus', type: 'enum', filterable: true, sortable: true, defaultVisible: false, enumValues: TRIAGE_STATUS_VALUES, enumLabelPrefix: 'domains.communications.enums.triageStatus' },
    // Dates
    { key: 'createdAt', labelKey: 'domains.communications.fields.createdAt', type: 'date', filterable: true, sortable: true, defaultVisible: true, format: 'date' },
    // References
    { key: 'contactId', labelKey: 'domains.communications.fields.contact', type: 'text', filterable: true, sortable: false, defaultVisible: true, refDomain: 'individuals', refDisplayField: 'displayName' },
    { key: 'projectId', labelKey: 'domains.communications.fields.project', type: 'text', filterable: true, sortable: false, defaultVisible: false, refDomain: 'projects', refDisplayField: 'name' },
    { key: 'propertyId', labelKey: 'domains.communications.fields.property', type: 'text', filterable: true, sortable: false, defaultVisible: false, refDomain: 'properties', refDisplayField: 'name' },
    { key: 'opportunityId', labelKey: 'domains.communications.fields.opportunity', type: 'text', filterable: true, sortable: false, defaultVisible: false, refDomain: 'opportunities', refDisplayField: 'title' },
    // --- Computed: G6 — Days Since Contact (all platforms) ---
    {
      key: 'daysSinceContact',
      labelKey: 'domains.communications.fields.daysSinceContact',
      type: 'number',
      filterable: true,
      sortable: true,
      defaultVisible: true,
      format: 'number',
      computed: true,
      computeFn: computeDaysSinceContact,
    },
    // --- Computed: G15 — Going Cold (Pipedrive "rotting", Salesforce Einstein) ---
    {
      key: 'isGoingCold',
      labelKey: 'domains.communications.fields.isGoingCold',
      type: 'boolean',
      filterable: true,
      sortable: true,
      defaultVisible: true,
      computed: true,
      computeFn: computeIsGoingCold,
    },
  ],
};

// ============================================================================
// E4: Appointments (Ραντεβού)
// ============================================================================

export const APPOINTMENTS_DEFINITION: DomainDefinition = {
  id: 'appointments',
  collection: COLLECTIONS.APPOINTMENTS,
  group: 'crm',
  labelKey: 'domains.appointments.label',
  descriptionKey: 'domains.appointments.description',
  // eslint-disable-next-line custom/no-hardcoded-strings -- route template
  entityLinkPath: '/crm/appointments/{id}',
  defaultSortField: 'createdAt',
  defaultSortDirection: 'desc',
  fields: [
    // Identity
    { key: 'appointment.description', labelKey: 'domains.appointments.fields.description', type: 'text', filterable: true, sortable: true, defaultVisible: true },
    { key: 'status', labelKey: 'domains.appointments.fields.status', type: 'enum', filterable: true, sortable: true, defaultVisible: true, enumValues: APPOINTMENT_STATUSES, enumLabelPrefix: 'domains.appointments.enums.status' },
    // Source
    { key: 'source.channel', labelKey: 'domains.appointments.fields.channel', type: 'text', filterable: true, sortable: true, defaultVisible: true },
    // Requester
    { key: 'requester.name', labelKey: 'domains.appointments.fields.requesterName', type: 'text', filterable: true, sortable: true, defaultVisible: true },
    { key: 'requester.email', labelKey: 'domains.appointments.fields.requesterEmail', type: 'text', filterable: true, sortable: false, defaultVisible: false },
    { key: 'requester.isKnownContact', labelKey: 'domains.appointments.fields.isKnownContact', type: 'boolean', filterable: true, sortable: true, defaultVisible: false },
    // Schedule — Requested
    { key: 'appointment.requestedDate', labelKey: 'domains.appointments.fields.requestedDate', type: 'date', filterable: true, sortable: true, defaultVisible: true, format: 'date' },
    { key: 'appointment.requestedTime', labelKey: 'domains.appointments.fields.requestedTime', type: 'text', filterable: false, sortable: false, defaultVisible: false },
    // Schedule — Confirmed
    { key: 'appointment.confirmedDate', labelKey: 'domains.appointments.fields.confirmedDate', type: 'date', filterable: true, sortable: true, defaultVisible: false, format: 'date' },
    { key: 'appointment.confirmedTime', labelKey: 'domains.appointments.fields.confirmedTime', type: 'text', filterable: false, sortable: false, defaultVisible: false },
    // Assignment
    { key: 'assignedRole', labelKey: 'domains.appointments.fields.assignedRole', type: 'text', filterable: true, sortable: true, defaultVisible: false },
    { key: 'assignedTo', labelKey: 'domains.appointments.fields.assignedTo', type: 'text', filterable: true, sortable: true, defaultVisible: false },
    // Approval
    { key: 'approvedBy', labelKey: 'domains.appointments.fields.approvedBy', type: 'text', filterable: true, sortable: false, defaultVisible: false },
    { key: 'approvedAt', labelKey: 'domains.appointments.fields.approvedAt', type: 'date', filterable: true, sortable: true, defaultVisible: false, format: 'date' },
    // Notes
    { key: 'appointment.notes', labelKey: 'domains.appointments.fields.notes', type: 'text', filterable: false, sortable: false, defaultVisible: false },
    // Dates
    { key: 'createdAt', labelKey: 'domains.appointments.fields.createdAt', type: 'date', filterable: true, sortable: true, defaultVisible: false, format: 'date' },
    // References
    { key: 'requester.contactId', labelKey: 'domains.appointments.fields.contact', type: 'text', filterable: true, sortable: false, defaultVisible: false, refDomain: 'individuals', refDisplayField: 'displayName' },
    // --- Computed: G7 — Stale/Forgotten Appointment (Salesforce, HubSpot) ---
    {
      key: 'isStale',
      labelKey: 'domains.appointments.fields.isStale',
      type: 'boolean',
      filterable: true,
      sortable: true,
      defaultVisible: true,
      computed: true,
      computeFn: computeIsStale,
    },
    // --- Computed: G8 — Waiting Days (Pipedrive, Zoho) ---
    {
      key: 'waitingDays',
      labelKey: 'domains.appointments.fields.waitingDays',
      type: 'number',
      filterable: true,
      sortable: true,
      defaultVisible: true,
      format: 'number',
      computed: true,
      computeFn: computeWaitingDays,
    },
    // --- G16: Reschedule Count — COMPETITIVE ADVANTAGE (no CRM native) ---
    { key: 'rescheduleCount', labelKey: 'domains.appointments.fields.rescheduleCount', type: 'number', filterable: true, sortable: true, defaultVisible: false, format: 'number' },
    // --- Computed: G17 — Days To Approval (Dynamics 365 SLA, Salesforce) ---
    {
      key: 'daysToApproval',
      labelKey: 'domains.appointments.fields.daysToApproval',
      type: 'number',
      filterable: true,
      sortable: true,
      defaultVisible: false,
      format: 'number',
      computed: true,
      computeFn: computeDaysToApproval,
    },
  ],
};
