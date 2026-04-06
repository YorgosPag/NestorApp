/**
 * 🔒 Enterprise Security Default Configurations
 *
 * Fallback security roles, email domain policies, and country policies.
 * Extracted from EnterpriseSecurityService.ts (ADR-065 SRP split).
 *
 * @security-critical true
 * @config-data true
 */

import { SYSTEM_IDENTITY } from '@/config/domain-constants';
import type {
  SecurityRole,
  EmailDomainPolicy,
  CountrySecurityPolicy,
} from './security-types';

// ============================================================================
// DEFAULT SECURITY ROLES
// ============================================================================

export function getDefaultSecurityRoles(tenantId: string, _environment: string): SecurityRole[] {
  return [
    {
      id: 'admin',
      name: 'System Administrator',
      description: 'Full system access with all permissions',
      level: 10,
      childRoleIds: ['operator', 'viewer'],
      permissions: ['*'],
      category: 'admin',
      maxSessionDuration: 480,
      require2FA: true,
      tenantId,
      isActive: true,
      createdAt: new Date(),
      lastUpdated: new Date(),
      createdBy: SYSTEM_IDENTITY.ID,
      requiresApproval: true,
      isEmergencyRole: true,
    },
    {
      id: 'operator',
      name: 'Alert Operator',
      description: 'Manage alerts and monitoring dashboards',
      level: 5,
      childRoleIds: ['viewer'],
      permissions: ['alert:read', 'alert:update', 'dashboard:read'],
      category: 'user',
      maxSessionDuration: 240,
      require2FA: false,
      tenantId,
      isActive: true,
      createdAt: new Date(),
      lastUpdated: new Date(),
      createdBy: SYSTEM_IDENTITY.ID,
      requiresApproval: false,
      isEmergencyRole: false,
    },
    {
      id: 'viewer',
      name: 'Dashboard Viewer',
      description: 'Read-only access to dashboards and reports',
      level: 1,
      childRoleIds: [],
      permissions: ['dashboard:read', 'report:read'],
      category: 'user',
      maxSessionDuration: 120,
      require2FA: false,
      tenantId,
      isActive: true,
      createdAt: new Date(),
      lastUpdated: new Date(),
      createdBy: SYSTEM_IDENTITY.ID,
      requiresApproval: false,
      isEmergencyRole: false,
    },
  ];
}

// ============================================================================
// DEFAULT EMAIL DOMAIN POLICIES
// ============================================================================

export function getDefaultEmailDomainPolicies(): EmailDomainPolicy[] {
  const now = new Date();

  return [
    {
      domain: 'tempmail.com',
      type: 'blacklist',
      riskLevel: 'high',
      category: 'disposable',
      description: 'Disposable email service',
      actions: [{ action: 'block', severity: 'error', message: 'Disposable email not allowed' }],
      effectiveDate: now,
      addedBy: 'system',
      source: 'internal',
      confidenceScore: 95,
      isActive: true,
    },
    {
      domain: '10minutemail.com',
      type: 'blacklist',
      riskLevel: 'high',
      category: 'disposable',
      description: 'Temporary email service',
      actions: [{ action: 'block', severity: 'error', message: 'Temporary email not allowed' }],
      effectiveDate: now,
      addedBy: 'system',
      source: 'internal',
      confidenceScore: 95,
      isActive: true,
    },
    {
      domain: 'guerrillamail.com',
      type: 'blacklist',
      riskLevel: 'high',
      category: 'disposable',
      description: 'Guerrilla mail service',
      actions: [{ action: 'block', severity: 'error', message: 'Guerrilla mail not allowed' }],
      effectiveDate: now,
      addedBy: 'system',
      source: 'internal',
      confidenceScore: 95,
      isActive: true,
    },
    {
      domain: 'mailinator.com',
      type: 'blacklist',
      riskLevel: 'medium',
      category: 'disposable',
      description: 'Public inbox service',
      actions: [{ action: 'quarantine', severity: 'warn', message: 'Public inbox detected' }],
      effectiveDate: now,
      addedBy: 'system',
      source: 'internal',
      confidenceScore: 90,
      isActive: true,
    },
  ];
}

// ============================================================================
// DEFAULT COUNTRY POLICIES
// ============================================================================

export function getDefaultCountryPolicies(): CountrySecurityPolicy[] {
  const now = new Date();
  const nextYear = new Date();
  nextYear.setFullYear(nextYear.getFullYear() + 1);

  return [
    {
      countryCode: 'GR',
      countryName: 'Ελλάδα',
      securityClass: 'unrestricted',
      riskLevel: 'low',
      dataResidency: {
        required: true,
        approvedRegions: ['eu-central-1', 'eu-south-1'],
        encryptionRequired: true,
      },
      compliance: {
        gdprRequired: true,
        localLaws: ['GDPR', 'Greek Data Protection Law'],
        retentionPeriods: { personal: 365, business: 2555 },
      },
      accessRestrictions: {
        requireVPN: false,
        allowedIpRanges: ['*'],
        requireEnhancedAuth: false,
        businessHoursOnly: false,
      },
      isActive: true,
      lastReviewed: now,
      nextReview: nextYear,
    },
    {
      countryCode: 'CY',
      countryName: 'Κύπρος',
      securityClass: 'unrestricted',
      riskLevel: 'low',
      dataResidency: {
        required: true,
        approvedRegions: ['eu-central-1', 'eu-south-1'],
        encryptionRequired: true,
      },
      compliance: {
        gdprRequired: true,
        localLaws: ['GDPR'],
        retentionPeriods: { personal: 365, business: 2555 },
      },
      accessRestrictions: {
        requireVPN: false,
        allowedIpRanges: ['*'],
        requireEnhancedAuth: false,
        businessHoursOnly: false,
      },
      isActive: true,
      lastReviewed: now,
      nextReview: nextYear,
    },
    {
      countryCode: 'US',
      countryName: 'ΗΠΑ',
      securityClass: 'restricted',
      riskLevel: 'medium',
      dataResidency: {
        required: false,
        approvedRegions: ['us-east-1', 'us-west-2', 'eu-central-1'],
        encryptionRequired: true,
      },
      compliance: {
        gdprRequired: false,
        localLaws: ['CCPA', 'COPPA', 'HIPAA'],
        retentionPeriods: { personal: 1095, business: 2555 },
      },
      accessRestrictions: {
        requireVPN: false,
        allowedIpRanges: ['*'],
        requireEnhancedAuth: false,
        businessHoursOnly: false,
      },
      isActive: true,
      lastReviewed: now,
      nextReview: nextYear,
    },
  ];
}
