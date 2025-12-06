// ============================================================================
// ENTERPRISE RELATIONSHIP MANAGEMENT TYPES
// ============================================================================
//
// 🏢 Professional-grade Contact Relationship Management System
// Handles complex relationships between Individuals, Companies, and Services
// Enterprise architecture for scalable business relationship tracking
//
// ============================================================================

import type { Contact, ContactType } from './contracts';
import type { FirestoreishTimestamp } from './contracts';

// ============================================================================
// CORE RELATIONSHIP TYPES
// ============================================================================

/**
 * 🔗 Relationship Types - Enterprise Standard Categories
 *
 * Based on industry-standard business relationship classifications
 * Used by Fortune 500 companies for contact management
 */
export type RelationshipType =
  // 👥 Employment Relationships
  | 'employee'                 // Υπάλληλος
  | 'manager'                  // Προϊστάμενος
  | 'director'                 // Διευθυντής
  | 'executive'                // Ανώτερο Στέλεχος
  | 'intern'                   // Εσωτερικός Εργαζόμενος
  | 'contractor'               // Εξωτερικός Συνεργάτης
  | 'consultant'               // Σύμβουλος

  // 🏢 Corporate Relationships
  | 'shareholder'              // Μέτοχος
  | 'board_member'             // Μέλος ΔΣ
  | 'chairman'                 // Πρόεδρος ΔΣ
  | 'ceo'                      // Γενικός Διευθυντής
  | 'representative'           // Εκπρόσωπος
  | 'partner'                  // Συνεργάτης/Εταίρος
  | 'vendor'                   // Προμηθευτής
  | 'client'                   // Πελάτης

  // 🏛️ Government/Service Relationships
  | 'civil_servant'            // Δημόσιος Υπάλληλος
  | 'elected_official'         // Εκλεγμένο Πρόσωπο
  | 'appointed_official'       // Διορισμένο Πρόσωπο
  | 'department_head'          // Προϊστάμενος Τμήματος
  | 'ministry_official'        // Στέλεχος Υπουργείου
  | 'mayor'                    // Δήμαρχος
  | 'deputy_mayor'             // Αντιδήμαρχος
  | 'regional_governor'        // Περιφερειάρχης

  // 🔗 Other Professional Relationships
  | 'advisor'                  // Σύμβουλος
  | 'mentor'                   // Μέντορας
  | 'protege'                  // Προστατευόμενος
  | 'colleague'                // Συνάδελφος
  | 'supplier'                 // Προμηθευτής
  | 'customer'                 // Πελάτης
  | 'competitor'               // Ανταγωνιστής
  | 'other';                   // Άλλο

/**
 * 📊 Relationship Status - Lifecycle Management
 *
 * Professional relationship lifecycle tracking
 * Essential for enterprise contact management
 */
export type RelationshipStatus =
  | 'active'                   // Ενεργή σχέση
  | 'inactive'                 // Αδρανής σχέση
  | 'pending'                  // Εκκρεμής σχέση
  | 'terminated'               // Τερματισμένη σχέση
  | 'suspended';               // Αναστολή σχέσης

/**
 * 💼 Employment Status - Detailed Work Classification
 *
 * Professional employment status for detailed HR tracking
 * Aligned with Greek labor law and EU standards
 */
export type EmploymentStatus =
  | 'full_time'                // Πλήρης απασχόληση
  | 'part_time'                // Μερική απασχόληση
  | 'contract'                 // Σύμβαση έργου
  | 'temporary'                // Προσωρινός
  | 'seasonal'                 // Εποχιακός
  | 'volunteer'                // Εθελοντής
  | 'retired'                  // Συνταξιούχος
  | 'on_leave'                 // Σε άδεια
  | 'terminated';              // Τερματισμένος

// ============================================================================
// CONTACT INFO INTERFACES
// ============================================================================

/**
 * 📞 Professional Contact Information
 *
 * Business-specific contact details within organizational context
 * Separate from personal contact information
 */
export interface ProfessionalContactInfo {
  /** 📞 Business phone (direct line) */
  businessPhone?: string;

  /** 📱 Business mobile */
  businessMobile?: string;

  /** 📠 Fax number */
  fax?: string;

  /** 📧 Business email (official) */
  businessEmail?: string;

  /** 📧 Alternative business email */
  alternativeEmail?: string;

  /** 🏢 Internal extension */
  extension?: string;

  /** 🏢 Office/room number */
  officeNumber?: string;

  /** 🏢 Floor/building location */
  officeLocation?: string;

  /** 🏢 Building/campus name */
  buildingName?: string;

  /** 📍 Department address (if different from main) */
  departmentAddress?: string;

  /** 🌐 Internal employee portal URL */
  intranetProfile?: string;

  /** 💬 Internal messaging handle (Slack, Teams, etc.) */
  internalMessaging?: string;

  /** ⏰ Available hours */
  availableHours?: string;

  /** 📅 Preferred contact method */
  preferredContactMethod?: 'phone' | 'email' | 'in_person' | 'messaging';

  /** 📝 Contact notes */
  contactNotes?: string;
}

/**
 * 💰 Financial Information (for shareholders, etc.)
 *
 * Financial relationship details for corporate structures
 * Handles ownership, compensation, and financial arrangements
 */
export interface FinancialInfo {
  /** 📊 Ownership percentage (for shareholders) */
  ownershipPercentage?: number;

  /** 💰 Salary range/level (for employees) */
  salaryRange?: string;

  /** 💰 Annual compensation (if known/relevant) */
  annualCompensation?: number;

  /** 📈 Stock options/equity grants */
  equityGrants?: number;

  /** 💳 Cost center code */
  costCenter?: string;

  /** 🏦 Payroll department */
  payrollDepartment?: string;

  /** 📋 Contract value (for contractors) */
  contractValue?: number;

  /** 📅 Contract duration */
  contractDuration?: string;

  /** 💸 Billing rate (for consultants) */
  billingRate?: number;

  /** 🏷️ Budget code */
  budgetCode?: string;
}

/**
 * 📊 Performance & HR Information
 *
 * Professional performance and HR-related data
 * Enterprise-grade employee relationship tracking
 */
export interface PerformanceInfo {
  /** ⭐ Performance rating */
  performanceRating?: 'excellent' | 'good' | 'satisfactory' | 'needs_improvement' | 'unsatisfactory';

  /** 📅 Last performance review date */
  lastReviewDate?: string;

  /** 📅 Next review due date */
  nextReviewDate?: string;

  /** 🎯 Goals/objectives */
  currentGoals?: string[];

  /** 🏆 Achievements/awards */
  achievements?: string[];

  /** 📚 Training/certifications */
  trainings?: string[];

  /** 📈 Career development plan */
  careerPlan?: string;

  /** 🚨 Disciplinary actions */
  disciplinaryActions?: string[];

  /** 💯 Skills assessment */
  skillsAssessment?: Record<string, number>; // skill -> rating (1-5)

  /** 📝 Manager notes */
  managerNotes?: string;
}

// ============================================================================
// MAIN RELATIONSHIP INTERFACE
// ============================================================================

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

  // ========================================================================
  // ORGANIZATIONAL DETAILS
  // ========================================================================

  /** 💼 Job title/position within organization */
  position?: string;

  /** 🏢 Department/division */
  department?: string;

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
  startDate?: string; // ISO date string

  /** 📅 Relationship end date (if terminated) */
  endDate?: string; // ISO date string

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
  contactInfo?: ProfessionalContactInfo;

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

  /** 🏷️ Tags for categorization */
  tags?: string[];

  /** ⚠️ Important notes/alerts */
  alerts?: string[];

  // ========================================================================
  // EXTENDED METADATA & FLEXIBILITY
  // ========================================================================

  /** 📦 Custom fields for organization-specific data */
  customFields?: Record<string, any>;

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
    oldValue?: any;
    newValue?: any;
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

// ============================================================================
// HELPER INTERFACES & UTILITY TYPES
// ============================================================================

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

/**
 * 📊 Organizational Hierarchy Node
 *
 * Represents a single node in an organizational hierarchy tree
 * Used for building org charts and reporting structures
 */
export interface OrganizationHierarchyNode {
  /** 👤 Contact information */
  contact: Contact;

  /** 🔗 Relationship to organization */
  relationship: ContactRelationship;

  /** 👥 Direct subordinates */
  subordinates: OrganizationHierarchyNode[];

  /** 👨‍💼 Direct manager */
  manager?: OrganizationHierarchyNode;

  /** 📊 Hierarchy level (0 = top) */
  level: number;

  /** 🏢 Department/division info */
  departmentInfo?: {
    name: string;
    size: number;
    budget?: number;
  };
}

/**
 * 🌳 Organization Tree Structure
 *
 * Complete organizational hierarchy representation
 * Enterprise-grade org chart data structure
 */
export interface OrganizationTree {
  /** 🏢 Organization (root contact) */
  organization: Contact;

  /** 👑 Top-level executives/leadership */
  topLevel: OrganizationHierarchyNode[];

  /** 📊 Organization statistics */
  statistics: {
    totalEmployees: number;
    totalDepartments: number;
    averageTeamSize: number;
    hierarchyDepth: number;
  };

  /** 🏗️ Department breakdown */
  departments: {
    [departmentName: string]: {
      head: OrganizationHierarchyNode;
      employees: OrganizationHierarchyNode[];
      subDepartments?: string[];
    };
  };

  /** 📅 Last updated */
  lastUpdated: string;
}

/**
 * 🔍 Relationship Search/Filter Criteria
 *
 * Advanced search and filtering for enterprise relationship queries
 * Supports complex organizational reporting and analytics
 */
export interface RelationshipSearchCriteria {
  /** 👤 Source contact filter */
  sourceContactIds?: string[];

  /** 👥 Target contact filter */
  targetContactIds?: string[];

  /** 🔗 Relationship types filter */
  relationshipTypes?: RelationshipType[];

  /** 📊 Status filter */
  statuses?: RelationshipStatus[];

  /** 🏢 Department filter */
  departments?: string[];

  /** 💼 Position filter (exact match) */
  positions?: string[];

  /** 👔 Seniority level filter */
  seniorityLevels?: string[];

  /** 📅 Date range filters */
  dateRanges?: {
    startDateFrom?: string;
    startDateTo?: string;
    endDateFrom?: string;
    endDateTo?: string;
  };

  /** 🏷️ Tags filter */
  tags?: string[];

  /** ⭐ Priority filter */
  priorities?: string[];

  /** 📞 Has contact info */
  hasContactInfo?: boolean;

  /** 💰 Has financial info */
  hasFinancialInfo?: boolean;

  /** 📊 Performance rating filter */
  performanceRatings?: string[];

  /** 🔍 Text search (positions, notes, etc.) */
  textSearch?: string;

  /** 📋 Custom field filters */
  customFieldFilters?: Record<string, any>;

  /** 📄 Pagination */
  limit?: number;
  offset?: number;

  /** 📊 Sorting */
  orderBy?: {
    field: keyof ContactRelationship;
    direction: 'asc' | 'desc';
  };
}

// ============================================================================
// EXPORT CONSOLIDATED TYPES
// ============================================================================


// ============================================================================
// TYPE GUARDS & VALIDATION
// ============================================================================

/**
 * 🔍 Type guard for checking if a relationship is employment-based
 */
export function isEmploymentRelationship(relationship: ContactRelationship): boolean {
  const employmentTypes: RelationshipType[] = [
    'employee', 'manager', 'director', 'executive', 'intern', 'contractor',
    'civil_servant', 'department_head', 'ministry_official'
  ];
  return employmentTypes.includes(relationship.relationshipType);
}

/**
 * 🔍 Type guard for checking if a relationship is ownership-based
 */
export function isOwnershipRelationship(relationship: ContactRelationship): boolean {
  const ownershipTypes: RelationshipType[] = [
    'shareholder', 'board_member', 'chairman', 'ceo', 'partner'
  ];
  return ownershipTypes.includes(relationship.relationshipType);
}

/**
 * 🔍 Type guard for checking if a relationship is government-based
 */
export function isGovernmentRelationship(relationship: ContactRelationship): boolean {
  const governmentTypes: RelationshipType[] = [
    'civil_servant', 'elected_official', 'appointed_official', 'department_head',
    'ministry_official', 'mayor', 'deputy_mayor', 'regional_governor'
  ];
  return governmentTypes.includes(relationship.relationshipType);
}

/**
 * ⭐ Get relationship priority score for sorting
 */
export function getRelationshipPriorityScore(relationship: ContactRelationship): number {
  const typeScores: Record<RelationshipType, number> = {
    'ceo': 100,
    'chairman': 95,
    'director': 90,
    'executive': 85,
    'manager': 80,
    'board_member': 75,
    'elected_official': 75,
    'mayor': 70,
    'regional_governor': 70,
    'department_head': 65,
    'ministry_official': 60,
    'shareholder': 55,
    'representative': 50,
    'employee': 45,
    'civil_servant': 40,
    'contractor': 35,
    'consultant': 35,
    'advisor': 30,
    'partner': 25,
    'vendor': 20,
    'client': 20,
    'colleague': 15,
    'intern': 10,
    'other': 5,
    'appointed_official': 60,
    'deputy_mayor': 65,
    'mentor': 25,
    'protege': 15,
    'supplier': 20,
    'customer': 20,
    'competitor': 5
  };

  let score = typeScores[relationship.relationshipType] || 0;

  // Boost score based on priority
  if (relationship.priority === 'critical') score += 20;
  else if (relationship.priority === 'high') score += 10;
  else if (relationship.priority === 'medium') score += 5;

  // Boost score based on relationship strength
  if (relationship.relationshipStrength === 'very_strong') score += 15;
  else if (relationship.relationshipStrength === 'strong') score += 10;
  else if (relationship.relationshipStrength === 'moderate') score += 5;

  return score;
}