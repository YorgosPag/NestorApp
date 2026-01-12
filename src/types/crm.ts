
'use client';

import { Timestamp } from 'firebase/firestore';

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
}

// Tasks
export interface CrmTask {
  id?: string;
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
