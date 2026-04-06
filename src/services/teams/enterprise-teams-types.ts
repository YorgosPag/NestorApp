/**
 * Enterprise Teams — Type Definitions
 *
 * All interfaces and type aliases for the Enterprise Teams Management system.
 * GDPR-compliant, multi-tenant, role-based.
 *
 * @see EnterpriseTeamsService.ts — main service class
 * @see enterprise-teams-defaults.ts — fallback data factories
 */

// ============================================================================
// CORE ENTITY INTERFACES
// ============================================================================

/**
 * Enterprise Team Member with GDPR compliance
 */
export interface EnterpriseTeamMember {
  id: string;
  employeeId: string; // Internal employee ID (not real name)
  displayName: string; // Configurable display name
  role: string;
  department: string;

  // Professional information
  position: EnterprisePosition;
  level: EmployeeLevel;
  responsibilities: string[];
  skills: string[];

  // Team relationships
  managerId?: string;
  directReports: string[];

  // Status and availability
  isActive: boolean;
  availabilityStatus: AvailabilityStatus;
  startDate: Date;
  endDate?: Date;

  // Contact information (optional, role-based)
  contact?: {
    email?: string;
    phone?: string;
    location?: string;
  };

  // Metadata
  lastUpdated: Date;
  updatedBy: string;

  // Privacy and compliance
  privacyLevel: PrivacyLevel;
  gdprConsent: boolean;
  dataRetentionPolicy: string;

  // Multi-tenant support
  tenantId?: string;
  organizationId: string;
}

/**
 * Enterprise Team/Department Structure
 */
export interface EnterpriseTeam {
  id: string;
  name: string;
  displayName: string; // Localized display name
  description: string;

  // Organizational structure
  type: TeamType;
  parentTeamId?: string;
  childTeamIds: string[];

  // Team configuration
  budget: TeamBudget;
  headCount: number;
  maxCapacity: number;

  // Leadership
  managerId?: string;
  leadIds: string[];

  // Operational data
  objectives: string[];
  kpis: TeamKPI[];
  projects: string[];

  // Location and settings
  location: TeamLocation;
  workingHours: WorkingHours;

  // Status
  isActive: boolean;
  createdAt: Date;
  lastRestructured?: Date;

  // Multi-tenant support
  tenantId?: string;
  organizationId: string;

  // Compliance
  complianceLevel: ComplianceLevel;
  auditTrail: TeamAuditEntry[];
}

/**
 * Enterprise Position Definition
 */
export interface EnterprisePosition {
  id: string;
  title: string;
  level: EmployeeLevel;
  department: string;

  // Position details
  description: string;
  requirements: string[];
  responsibilities: string[];

  // Compensation (optional, role-restricted)
  salaryRange?: {
    min: number;
    max: number;
    currency: string;
  };

  // Career progression
  nextPositions: string[];
  requiredExperience: number; // years

  // Approval workflow
  isApproved: boolean;
  approvedBy?: string;
  approvalDate?: Date;

  // Multi-tenant support
  tenantId?: string;
  organizationId: string;
}

/**
 * Enterprise Organizational Chart
 */
export interface EnterpriseOrganizationChart {
  id: string;
  name: string;
  version: string;

  // Structure
  rootTeamId: string;
  teams: EnterpriseTeam[];
  positions: EnterprisePosition[];

  // Hierarchy mapping
  reportingStructure: ReportingRelationship[];

  // Metadata
  effectiveDate: Date;
  expiryDate?: Date;
  isActive: boolean;

  // Compliance
  lastAudit?: Date;
  complianceStatus: ComplianceStatus;

  // Multi-tenant support
  tenantId?: string;
  organizationId: string;
}

// ============================================================================
// SUPPORTING TYPES & ENUMS
// ============================================================================

export type TeamType = 'department' | 'team' | 'squad' | 'committee' | 'project_team' | 'cross_functional';
export type EmployeeLevel = 'intern' | 'junior' | 'mid' | 'senior' | 'lead' | 'manager' | 'director' | 'vp' | 'executive';
export type AvailabilityStatus = 'available' | 'busy' | 'away' | 'offline' | 'vacation' | 'sick_leave';
export type PrivacyLevel = 'public' | 'internal' | 'team_only' | 'manager_only' | 'hr_only';
export type ComplianceLevel = 'basic' | 'standard' | 'high' | 'maximum';
export type ComplianceStatus = 'compliant' | 'pending_review' | 'non_compliant' | 'under_audit';

export interface TeamBudget {
  annual: number;
  currency: string;
  allocated: number;
  spent: number;
  fiscalYear: number;
}

export interface TeamKPI {
  id: string;
  name: string;
  target: number;
  current: number;
  unit: string;
  period: 'monthly' | 'quarterly' | 'yearly';
}

export interface TeamLocation {
  office: string;
  floor?: string;
  building?: string;
  remote: boolean;
  hybrid: boolean;
}

export interface WorkingHours {
  timezone: string;
  standard: {
    start: string; // HH:MM
    end: string;   // HH:MM
  };
  flexible: boolean;
  coreHours?: {
    start: string;
    end: string;
  };
}

export interface ReportingRelationship {
  managerId: string;
  employeeId: string;
  relationship: 'direct' | 'dotted_line' | 'matrix' | 'project_based';
  effectiveDate: Date;
  endDate?: Date;
}

export interface TeamAuditEntry {
  timestamp: Date;
  action: string;
  userId: string;
  changes: Record<string, unknown>;
  reason: string;
}

// ============================================================================
// CONFIGURATION INTERFACES
// ============================================================================

/**
 * Enterprise Teams Configuration
 */
export interface EnterpriseTeamsConfiguration {
  configId: string;
  version: string;
  organizationId: string;
  tenantId?: string;

  // Core configuration
  teams: EnterpriseTeam[];
  positions: EnterprisePosition[];
  organizationChart: EnterpriseOrganizationChart;

  // Access control
  rolePermissions: TeamRolePermission[];

  // Display settings
  displaySettings: TeamDisplaySettings;

  // Compliance settings
  complianceSettings: TeamComplianceSettings;

  // Automation rules
  automationRules: TeamAutomationRule[];

  // Metadata
  lastUpdated: Date;
  updatedBy: string;
  approvedBy?: string;

  // Features
  features: TeamFeatureFlags;
}

export interface TeamRolePermission {
  role: string;
  permissions: string[];
  teamsAccess: string[]; // Team IDs this role can access
  dataAccess: PrivacyLevel[];
}

export interface TeamDisplaySettings {
  showPhotos: boolean;
  showContactInfo: boolean;
  showOrgChart: boolean;
  showBudgets: boolean;
  defaultView: 'grid' | 'list' | 'org_chart';
  locale: string;
}

export interface TeamComplianceSettings {
  gdprEnabled: boolean;
  dataRetentionPeriod: number; // days
  auditLogRetention: number; // days
  anonymizeAfterTermination: boolean;
  requireConsentForDisplay: boolean;
}

export interface TeamAutomationRule {
  id: string;
  name: string;
  trigger: string;
  action: string;
  conditions: Record<string, unknown>;
  isActive: boolean;
}

export interface TeamFeatureFlags {
  enableOrgChart: boolean;
  enableBudgetTracking: boolean;
  enablePerformanceMetrics: boolean;
  enableProjectAssignment: boolean;
  enableSkillsManagement: boolean;
  enableSuccessionPlanning: boolean;
}
