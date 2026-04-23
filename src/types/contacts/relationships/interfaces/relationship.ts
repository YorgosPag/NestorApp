// ============================================================================
// MAIN CONTACT RELATIONSHIP INTERFACE - ENTERPRISE MODULE
// ============================================================================
//
// 🔗 Core relationship entity for professional contact management
// Enterprise-grade relationship management between contacts
// Part of modular Enterprise relationship types architecture
//
// ============================================================================

// Import related types from other modules
import type { Contact, ContactType } from '../../contracts';
import type { FirestoreishTimestamp } from '../../contracts';
import type { RelationshipType, RelationshipStatus, EmploymentStatus } from '../core/relationship-types';
import type { ProfessionalContactInfo } from './contact-info';
import type { FinancialInfo } from './financial';
import type { PerformanceInfo } from './performance';

/**
 * 🔗 Contact Relationship - Enterprise Core Entity
 *
 * Professional-grade relationship management between contacts
 * Supports complex organizational hierarchies and business relationships
 * Designed for scalability and enterprise requirements
 */
export interface ContactRelationship {
  /** 🆔 Unique relationship identifier */
  id: string;

  /** 👤 Source contact (who has the relationship) */
  sourceContactId: string;

  /** 👥 Target contact (with whom the relationship exists) */
  targetContactId: string;

  /** 🔗 Type of relationship */
  relationshipType: RelationshipType;

  /** 📊 Current status of relationship */
  status: RelationshipStatus;

  /**
   * 🏢 ADR-318: per-instance override for `derivesWorkAddress: 'optional'` types.
   * When the relationship type is optional-derivation (e.g. `business_contact`,
   * `consultant`, `advisor`, `representative`), setting this to `true` opts the
   * relationship into live work-address derivation. Ignored for `always` /
   * `never` types.
   */
  isWorkplace?: boolean | null;

  // ========================================================================
  // ORGANIZATIONAL DETAILS
  // ========================================================================

  /** 💼 Job title/position within organization */
  position?: string | null;

  /** 🏢 Department/division */
  department?: string | null;

  /** 🏗️ Team/unit/section */
  team?: string;

  /** 👔 Seniority level */
  seniorityLevel?: 'entry' | 'mid' | 'senior' | 'executive' | 'c_level';

  /** 📊 Reporting level (depth in org chart) */
  reportingLevel?: number;

  /** 👨‍💼 Direct manager relationship ID (if applicable) */
  directManagerRelationshipId?: string;

  /** 👥 Direct reports (array of relationship IDs) */
  directReportRelationshipIds?: string[];

  /** 💼 Employment status */
  employmentStatus?: EmploymentStatus;

  /** 📋 Employment type (full-time, contract, etc.) */
  employmentType?: 'permanent' | 'temporary' | 'contract' | 'intern' | 'volunteer';

  // ========================================================================
  // TIMELINE & LIFECYCLE
  // ========================================================================

  /** 📅 Relationship start date */
  startDate?: string | null; // ISO date string

  /** 📅 Relationship end date (if terminated) */
  endDate?: string | null; // ISO date string

  /** ⏳ Expected duration (for contracts/temporary roles) */
  expectedDuration?: string;

  /** 🔄 Renewal date (for contracts) */
  renewalDate?: string;

  /** ⚠️ Probation period end date */
  probationEndDate?: string;

  /** 🎯 Performance review dates */
  reviewSchedule?: string[]; // Array of ISO date strings

  // ========================================================================
  // PROFESSIONAL INFORMATION
  // ========================================================================

  /** 📞 Professional contact information */
  contactInfo?: ProfessionalContactInfo | null;

  /** 💰 Financial information */
  financialInfo?: FinancialInfo;

  /** 📊 Performance information */
  performanceInfo?: PerformanceInfo;

  /** 🏷️ Employee ID/badge number */
  employeeId?: string;

  /** 🔑 Access level/security clearance */
  accessLevel?: string;

  /** 📝 Job description */
  jobDescription?: string;

  /** 🎓 Required qualifications */
  requiredQualifications?: string[];

  /** 📜 Certifications held */
  certifications?: string[];

  /** 🌐 Preferred language for communication */
  preferredLanguage?: string;

  // ========================================================================
  // ORGANIZATIONAL CONTEXT
  // ========================================================================

  /** 🎯 Key responsibilities */
  responsibilities?: string[];

  /** ⚡ Authority level */
  authorityLevel?: 'none' | 'limited' | 'moderate' | 'high' | 'executive';

  /** 💰 Signing authority limit */
  signingAuthorityLimit?: number;

  /** 🏛️ Approval workflows this person is part of */
  approvalWorkflows?: string[];

  /** 🔐 System access permissions */
  systemPermissions?: string[];

  /** 📋 Committees/boards member of */
  committeeMemberships?: string[];

  // ========================================================================
  // RELATIONSHIP-SPECIFIC METADATA
  // ========================================================================

  /** 🏷️ Relationship priority (for sorting/importance) */
  priority?: 'low' | 'medium' | 'high' | 'critical';

  /** ⭐ Relationship strength/closeness */
  relationshipStrength?: 'weak' | 'moderate' | 'strong' | 'very_strong';

  /** 🔄 Communication frequency */
  communicationFrequency?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'rarely';

  /** 📅 Last interaction date */
  lastInteractionDate?: string;

  /** 💬 Last interaction type */
  lastInteractionType?: 'meeting' | 'call' | 'email' | 'message' | 'event';

  /** 📝 Relationship notes */
  relationshipNotes?: string;

  /** 📝 Notes shorthand alias for relationshipNotes */
  notes?: string | null;

  /** 🏷️ Tags for categorization */
  tags?: string[];

  /** ⚠️ Important notes/alerts */
  alerts?: string[];

  // ========================================================================
  // EXTENDED METADATA & FLEXIBILITY
  // ========================================================================

  /** 📦 Custom fields for organization-specific data */
  customFields?: Record<string, unknown>;

  /** 📄 Attached documents/contracts */
  attachedDocuments?: {
    id: string;
    name: string;
    type: 'contract' | 'nda' | 'resume' | 'evaluation' | 'other';
    url: string;
    uploadDate: string;
  }[];

  /** 🔄 Change history */
  changeHistory?: {
    changeDate: string;
    changeType: 'created' | 'updated' | 'status_change' | 'position_change';
    changedBy: string;
    oldValue?: unknown;
    newValue?: unknown;
    notes?: string;
  }[];

  // ========================================================================
  // AUDIT & COMPLIANCE
  // ========================================================================

  /** 👤 Created by user */
  createdBy: string;

  /** 👤 Last modified by user */
  lastModifiedBy: string;

  /** 📅 Creation timestamp */
  createdAt: FirestoreishTimestamp;

  /** 📅 Last update timestamp */
  updatedAt: FirestoreishTimestamp;

  /** ✅ Verification status */
  verificationStatus?: 'unverified' | 'pending' | 'verified' | 'disputed';

  /** 👤 Verified by user */
  verifiedBy?: string;

  /** 📅 Verification date */
  verifiedAt?: string;

  /** 🔒 Data sensitivity level */
  sensitivityLevel?: 'public' | 'internal' | 'confidential' | 'restricted';

  /** 📜 Legal/compliance notes */
  complianceNotes?: string;

  /** ⏳ Data retention policy */
  retentionPolicy?: string;
}

/**
 * 🔍 Enhanced Contact with Relationship Context
 *
 * Contact data enriched with relationship information
 * Used for displaying contacts within organizational context
 */
export interface ContactWithRelationship {
  /** 👤 The base contact information */
  contact: Contact;

  /** 🔗 The relationship details */
  relationship: ContactRelationship;

  /** 🏢 Organization context (if different from direct relationship) */
  organizationContext?: {
    organizationId: string;
    organizationName: string;
    organizationType: ContactType;
  };
}