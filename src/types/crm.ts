
'use client';

import type { TriageStatus } from '@/constants/triage-statuses';
import type { MessageIntentAnalysis } from '@/schemas/ai-analysis';
import type { OpportunityStage } from '@/config/crm/opportunity-stages';
import type { OpportunityLostReason } from '@/config/crm/opportunity-lost-reasons';

export type FirestoreishTimestamp = Date | string | { toDate(): Date };

// Main Opportunity/Lead type
export interface Opportunity {
  id?: string;
  companyId?: string; // Tenant isolation — απαιτείται από τον κανόνα `crmCanCreate`
  title: string;
  contactId: string; // Ref to contacts collection
  fullName?: string;
  email?: string;
  phone?: string;
  notes?: string;
  interestedIn?: {
    projectIds?: string[];
    buildingIds?: string[];
    propertyIds?: string[];
    propertyType?: 'apartment' | 'maisonette' | 'store' | 'office' | 'parking' | 'storage';
    budget?: {
      min?: number;
      max?: number;
    };
    desiredArea?: {
      min?: number;
      max?: number;
    };
    locations?: string[];
  };
  /** Η ΜΙΑ ρίζα: `@/config/crm/opportunity-stages` (ADR-930). Γράφεται ΜΟΝΟ από την πόρτα αλλαγής σταδίου. */
  stage: OpportunityStage;
  /** Πότε μπήκε στο τρέχον στάδιο — για «μέρες στο στάδιο» / παγωμένη ευκαιρία (ADR-930). */
  stageChangedAt?: FirestoreishTimestamp;
  /** Πότε έκλεισε (won/lost)· καθαρίζει στο επανάνοιγμα. */
  closedAt?: FirestoreishTimestamp;
  /** Λόγος απώλειας — κλειστός κατάλογος `OPPORTUNITY_LOST_REASONS`. */
  lostReason?: OpportunityLostReason;
  lostReasonNote?: string;
  /** Πόσες φορές ξανάνοιξε από κλειστό στάδιο — ώστε οι αναφορές να μη διαστρεβλώνονται. */
  reopenCount?: number;
  /** Έκδοση εγγράφου για έλεγχο σύγκρουσης (`version-check.ts`). */
  _v?: number;
  probability?: number;
  estimatedValue?: number;
  expectedCloseDate?: FirestoreishTimestamp;
  assignedTo: string; // User ID — ο ΚΑΤΟΧΟΣ: κινεί/επεξεργάζεται τη δική του (ADR-930 «Εξουσία κατόχου»)
  /** Ποιος τη δημιούργησε (γράφεται από τον server στη δημιουργία). Κρίνει επεξεργασία **και** διαγραφή (ADR-930). */
  createdBy?: string;
  team?: string[]; // Array of User IDs
  lastActivity?: FirestoreishTimestamp;
  nextAction?: string;
  nextActionDate?: FirestoreishTimestamp;
  source?: 'website' | 'referral' | 'agent' | 'social' | 'phone' | 'walkin';
  campaign?: string;
  referredBy?: string; // Contact ID
  status: 'active' | 'on_hold' | 'lost' | 'won';
  wonDate?: FirestoreishTimestamp;
  createdAt: FirestoreishTimestamp;
  updatedAt: FirestoreishTimestamp;
}

// Communications
export interface Communication {
  id?: string;
  companyId?: string; // 🏢 ENTERPRISE: Tenant isolation (added 2026-02-03)
  contactId: string;
  projectId?: string;
  propertyId?: string;
  opportunityId?: string;
  type: 'email' | 'phone' | 'sms' | 'whatsapp' | 'telegram' | 'meeting' | 'note';
  direction: 'inbound' | 'outbound';
  from?: string;
  to?: string;
  subject?: string;
  content: string;
  attachments?: string[];
  duration?: number; // for phone calls in seconds
  meetingDate?: FirestoreishTimestamp;
  location?: string;
  attendees?: string[];
  createdBy: string; // User ID
  createdAt: FirestoreishTimestamp;
  updatedAt: FirestoreishTimestamp;
  status: 'completed' | 'scheduled' | 'cancelled' | 'pending' | 'sent' | 'delivered' | 'failed';
  requiresFollowUp?: boolean;
  followUpDate?: FirestoreishTimestamp;
  metadata?: Record<string, unknown>;

  // =========================================================================
  // 🏢 ENTERPRISE: AI ANALYSIS FIELDS (Phase 1 - Omnichannel Intake)
  // =========================================================================

  /**
   * AI analysis result for message intent extraction
   * @enterprise Only present for inbound messages με AI processing
   * @see src/schemas/ai-analysis.ts - MessageIntentAnalysis type (SSoT)
   *
   * Structure:
   * - kind: 'message_intent' (discriminator)
   * - intentType: IntentTypeValue (SSoT enum)
   * - extractedEntities: ExtractedBusinessEntities
   * - confidence: number (0-1 validated)
   * - needsTriage: boolean
   * - aiModel: string
   * - analysisTimestamp: string (ISO 8601)
   */
  intentAnalysis?: MessageIntentAnalysis;

  /**
   * Triage status for manual review
   * @enterprise Workflow states for communications requiring human review
   */
  triageStatus?: TriageStatus;

  /**
   * Linked CRM task ID (if auto-created)
   * @enterprise Links communication → task for audit trail
   */
  linkedTaskId?: string;
}

// Triage status (SSoT)
// 🏢 ENTERPRISE: Re-export από centralized constants (Single Source of Truth)
// Pattern: Google Cloud, AWS, Microsoft Azure - Isomorphic constants
export { TRIAGE_STATUSES, TRIAGE_STATUS_VALUES, type TriageStatus } from '@/constants/triage-statuses';

// Task enums (SSoT)
// 🏢 ENTERPRISE: Re-export από centralized constants (Single Source of Truth)
// Τα unions του CrmTask παράγονται ΑΠΟ αυτούς τους πίνακες → μηδενικό drift.
export {
  CRM_TASK_TYPES,
  CRM_TASK_TYPE_VALUES,
  CRM_TASK_TYPE_CREATABLE_VALUES,
  CRM_TASK_STATUSES,
  CRM_TASK_STATUS_VALUES,
  CRM_TASK_PRIORITIES,
  CRM_TASK_PRIORITY_VALUES,
  type CrmTaskType,
  type CrmTaskStatus,
  type CrmTaskPriority,
} from '@/constants/crm-task-enums';

import type {
  CrmTaskType,
  CrmTaskStatus,
  CrmTaskPriority,
} from '@/constants/crm-task-enums';

// Tasks
export interface CrmTask {
  id?: string;
  companyId?: string; // 🏢 ENTERPRISE: Tenant isolation
  title: string;
  description?: string | null;
  type: CrmTaskType;
  leadId?: string;
  opportunityId?: string;
  contactId?: string | null;
  projectId?: string | null;
  propertyId?: string;
  assignedTo: string; // User ID
  assignedBy?: string; // User ID
  dueDate?: FirestoreishTimestamp | null;
  reminderDate?: FirestoreishTimestamp | null;
  completedAt?: FirestoreishTimestamp;
  status: CrmTaskStatus;
  priority: CrmTaskPriority;
  viewingDetails?: {
    location: string;
    units: string[];
    attendees: string[];
    notes: string;
  };
  createdAt: FirestoreishTimestamp;
  updatedAt: FirestoreishTimestamp;
  reminderSent?: boolean;
  metadata?: Record<string, unknown>;
  endDate?: string | null; // ISO date for multi-day events
  recurrence?: import('./recurrence').RecurrencePattern; // For recurring events (Phase 3)
  attendees?: string[]; // User IDs for attendees (Phase 3)
}
