/**
 * Enterprise Teams — Fallback & Default Data Factories
 *
 * Provides offline/fallback configurations when Firestore is unavailable.
 * All functions are pure factories — no side effects, no DB access.
 *
 * @see EnterpriseTeamsService.ts — main service class
 * @see enterprise-teams-types.ts — type definitions
 */

import type {
  EnterpriseTeam,
  EnterpriseTeamMember,
  EnterpriseOrganizationChart,
  EnterprisePosition,
  EnterpriseTeamsConfiguration,
  TeamRolePermission,
  TeamDisplaySettings,
  TeamComplianceSettings,
  TeamFeatureFlags,
} from './enterprise-teams-types';

// ============================================================================
// FALLBACK CONFIGURATION
// ============================================================================

/**
 * Complete fallback configuration for offline mode
 */
export function createFallbackConfiguration(
  organizationId: string,
  tenantId?: string
): EnterpriseTeamsConfiguration {
  return {
    configId: 'fallback',
    version: '1.0.0',
    organizationId,
    tenantId,
    teams: createFallbackTeams(organizationId, tenantId),
    positions: createFallbackPositions(),
    organizationChart: createFallbackOrganizationChart(organizationId, tenantId),
    rolePermissions: createDefaultRolePermissions(),
    displaySettings: createDefaultDisplaySettings(),
    complianceSettings: createDefaultComplianceSettings(),
    automationRules: [],
    lastUpdated: new Date(),
    updatedBy: 'fallback-system',
    features: createDefaultFeatureFlags(),
  };
}

// ============================================================================
// FALLBACK TEAMS
// ============================================================================

/**
 * Default teams for offline mode (3 departments)
 */
export function createFallbackTeams(
  organizationId: string,
  tenantId?: string
): EnterpriseTeam[] {
  const now = new Date();
  const fiscalYear = now.getFullYear();
  const baseTeam = {
    childTeamIds: [] as string[],
    headCount: 0,
    leadIds: [] as string[],
    kpis: [],
    projects: [] as string[],
    isActive: true,
    createdAt: now,
    organizationId,
    complianceLevel: 'standard' as const,
    auditTrail: [],
    ...(tenantId && { tenantId }),
  };

  return [
    {
      ...baseTeam,
      id: 'sales-team',
      name: 'sales',
      displayName: 'Τμήμα Πωλήσεων',
      description: 'Υπεύθυνοι για την ανάπτυξη επιχειρηματικών ευκαιριών',
      type: 'department',
      budget: { annual: 300000, currency: 'EUR', allocated: 300000, spent: 0, fiscalYear },
      maxCapacity: 10,
      objectives: ['Αύξηση πωλήσεων', 'Διατήρηση πελατών'],
      location: { office: 'Κεντρικά Γραφεία', remote: false, hybrid: true },
      workingHours: { timezone: 'Europe/Athens', standard: { start: '09:00', end: '17:00' }, flexible: true },
    },
    {
      ...baseTeam,
      id: 'marketing-team',
      name: 'marketing',
      displayName: 'Τμήμα Marketing',
      description: 'Υπεύθυνοι για την προώθηση και τη δημιουργία brand awareness',
      type: 'department',
      budget: { annual: 200000, currency: 'EUR', allocated: 200000, spent: 0, fiscalYear },
      maxCapacity: 5,
      objectives: ['Brand awareness', 'Digital transformation'],
      location: { office: 'Κεντρικά Γραφεία', remote: true, hybrid: true },
      workingHours: { timezone: 'Europe/Athens', standard: { start: '09:00', end: '17:00' }, flexible: true },
    },
    {
      ...baseTeam,
      id: 'support-team',
      name: 'support',
      displayName: 'Τμήμα Υποστήριξης',
      description: 'Υπεύθυνοι για την εξυπηρέτηση και υποστήριξη πελατών',
      type: 'department',
      budget: { annual: 150000, currency: 'EUR', allocated: 150000, spent: 0, fiscalYear },
      maxCapacity: 8,
      objectives: ['Customer satisfaction', 'Response time optimization'],
      location: { office: 'Κεντρικά Γραφεία', remote: false, hybrid: false },
      workingHours: { timezone: 'Europe/Athens', standard: { start: '08:00', end: '18:00' }, flexible: false },
    },
  ];
}

// ============================================================================
// FALLBACK MEMBERS
// ============================================================================

/**
 * Empty fallback — real employee data should always come from database
 */
export function createFallbackTeamMembers(
  _teamId: string,
  _organizationId: string
): EnterpriseTeamMember[] {
  return [];
}

// ============================================================================
// FALLBACK ORG CHART
// ============================================================================

/**
 * Default organization chart for offline mode
 */
export function createFallbackOrganizationChart(
  organizationId: string,
  tenantId?: string
): EnterpriseOrganizationChart {
  return {
    id: 'fallback-chart',
    name: 'Default Organization Chart',
    version: '1.0.0',
    rootTeamId: 'sales-team',
    teams: createFallbackTeams(organizationId, tenantId),
    positions: createFallbackPositions(),
    reportingStructure: [],
    effectiveDate: new Date(),
    isActive: true,
    complianceStatus: 'compliant',
    organizationId,
    ...(tenantId && { tenantId }),
  };
}

// ============================================================================
// FALLBACK POSITIONS
// ============================================================================

/**
 * Default positions for offline mode
 */
export function createFallbackPositions(): EnterprisePosition[] {
  return [
    {
      id: 'sales-manager',
      title: 'Sales Manager',
      level: 'manager',
      department: 'sales-team',
      description: 'Manages sales operations and team performance',
      requirements: ['Sales experience', 'Leadership skills'],
      responsibilities: ['Team management', 'Sales strategy'],
      nextPositions: ['sales-director'],
      requiredExperience: 5,
      isApproved: true,
      organizationId: 'default',
    },
    {
      id: 'marketing-specialist',
      title: 'Marketing Specialist',
      level: 'mid',
      department: 'marketing-team',
      description: 'Develops and executes marketing campaigns',
      requirements: ['Marketing degree', 'Creative thinking'],
      responsibilities: ['Campaign management', 'Content creation'],
      nextPositions: ['marketing-manager'],
      requiredExperience: 3,
      isApproved: true,
      organizationId: 'default',
    },
  ];
}

/**
 * Default position template for members without explicit position
 */
export function createDefaultPosition(): EnterprisePosition {
  return {
    id: 'team-member',
    title: 'Team Member',
    level: 'mid',
    department: 'general',
    description: 'General team member position',
    requirements: [],
    responsibilities: [],
    nextPositions: [],
    requiredExperience: 0,
    isApproved: true,
    organizationId: 'default',
  };
}

// ============================================================================
// DEFAULT SETTINGS FACTORIES
// ============================================================================

/**
 * Default RBAC role permissions
 */
export function createDefaultRolePermissions(): TeamRolePermission[] {
  return [
    {
      role: 'admin',
      permissions: ['view_all', 'edit_all', 'delete_all'],
      teamsAccess: ['*'],
      dataAccess: ['public', 'internal', 'team_only', 'manager_only'],
    },
    {
      role: 'manager',
      permissions: ['view_team', 'edit_team'],
      teamsAccess: [],
      dataAccess: ['public', 'internal', 'team_only'],
    },
    {
      role: 'employee',
      permissions: ['view_public'],
      teamsAccess: [],
      dataAccess: ['public'],
    },
  ];
}

/**
 * Default UI display settings
 */
export function createDefaultDisplaySettings(): TeamDisplaySettings {
  return {
    showPhotos: false,
    showContactInfo: false,
    showOrgChart: true,
    showBudgets: false,
    defaultView: 'grid',
    locale: 'el',
  };
}

/**
 * Default GDPR compliance settings
 */
export function createDefaultComplianceSettings(): TeamComplianceSettings {
  return {
    gdprEnabled: true,
    dataRetentionPeriod: 365,
    auditLogRetention: 90,
    anonymizeAfterTermination: true,
    requireConsentForDisplay: true,
  };
}

/**
 * Default feature flags
 */
export function createDefaultFeatureFlags(): TeamFeatureFlags {
  return {
    enableOrgChart: true,
    enableBudgetTracking: false,
    enablePerformanceMetrics: false,
    enableProjectAssignment: true,
    enableSkillsManagement: true,
    enableSuccessionPlanning: false,
  };
}
