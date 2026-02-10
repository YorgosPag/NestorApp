
'use client';

import type { TriageStatus } from '@/constants/triage-statuses';
import type { MessageIntentAnalysis } from '@/schemas/ai-analysis';

export type FirestoreishTimestamp = Date | string | { toDate(): Date };

// Main Opportunity/Lead type
export interface Opportunity {
  id?: string;
  title: string;
  contactId: string; // Ref to contacts collection
  fullName?: string;
  email?: string;
  phone?: string;
  notes?: string;
  interestedIn?: {
    projectIds?: string[];
    buildingIds?: string[];
    unitIds?: string[];
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
  stage: 'initial_contact' | 'qualification' | 'viewing' | 'proposal' | 'negotiation' | 'contract' | 'closed_won' | 'closed_lost';
  probability?: number;
  estimatedValue?: number;
  expectedCloseDate?: FirestoreishTimestamp;
  assignedTo: string; // User ID
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
  unitId?: string;
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

// Tasks
export interface CrmTask {
  id?: string;
  companyId?: string; // 🏢 ENTERPRISE: Tenant isolation
  title: string;
  description?: string;
  type: 'call' | 'email' | 'meeting' | 'viewing' | 'document' | 'follow_up' | 'other';
  leadId?: string;
  opportunityId?: string;
  contactId?: string;
  projectId?: string;
  unitId?: string;
  assignedTo: string; // User ID
  assignedBy?: string; // User ID
  dueDate?: FirestoreishTimestamp | null;
  reminderDate?: FirestoreishTimestamp;
  completedAt?: FirestoreishTimestamp;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
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
}
