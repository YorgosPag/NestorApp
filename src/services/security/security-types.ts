/**
 * 🔒 Enterprise Security Types & Interfaces
 *
 * All type definitions for the enterprise security configuration system.
 * Extracted from EnterpriseSecurityService.ts (ADR-065 SRP split).
 *
 * @security-critical true
 * @enterprise-ready true
 */

// ============================================================================
// SECURITY ROLE & PERMISSION TYPES
// ============================================================================

/**
 * Security role definition with inheritance support
 */
export interface SecurityRole {
  id: string;
  name: string;
  description: string;
  level: number;
  parentRoleId?: string;
  childRoleIds: string[];
  permissions: string[];
  inheritedPermissions?: string[];
  category: 'system' | 'admin' | 'user' | 'guest' | 'service' | 'custom';
  maxSessionDuration: number;
  require2FA: boolean;
  ipRestrictions?: string[];
  timeRestrictions?: {
    allowedDays: number[];
    allowedHours: { start: string; end: string }[];
  };
  tenantId?: string;
  expiryDate?: Date;
  isActive: boolean;
  createdAt: Date;
  lastUpdated: Date;
  createdBy: string;
  requiresApproval: boolean;
  isEmergencyRole: boolean;
}

/**
 * Security permission definition
 */
export interface SecurityPermission {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: 'create' | 'read' | 'update' | 'delete' | 'execute' | 'admin' | '*';
  scope: 'global' | 'tenant' | 'department' | 'team' | 'personal' | 'project';
  level: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  requiresApproval: boolean;
  canDelegate: boolean;
  auditRequired: boolean;
  isActive: boolean;
  complianceRequirements?: string[];
}

// ============================================================================
// POLICY TYPES
// ============================================================================

/**
 * Email domain security policy
 */
export interface EmailDomainPolicy {
  domain: string;
  type: 'blacklist' | 'whitelist' | 'quarantine' | 'monitor';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  category: 'disposable' | 'suspicious' | 'phishing' | 'spam' | 'legitimate' | 'corporate';
  description: string;
  actions: Array<{
    action: 'block' | 'quarantine' | 'flag' | 'log' | 'notify';
    severity: 'info' | 'warn' | 'error' | 'critical';
    message?: string;
  }>;
  effectiveDate: Date;
  expiryDate?: Date;
  addedBy: string;
  source: 'manual' | 'threat_intel' | 'community' | 'vendor' | 'internal';
  confidenceScore: number;
  lastVerified?: Date;
  isActive: boolean;
}

/**
 * Country/localization security policy
 */
export interface CountrySecurityPolicy {
  countryCode: string;
  countryName: string;
  securityClass: 'unrestricted' | 'restricted' | 'confidential' | 'secret' | 'top_secret';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  dataResidency: {
    required: boolean;
    approvedRegions: string[];
    encryptionRequired: boolean;
  };
  compliance: {
    gdprRequired: boolean;
    localLaws: string[];
    retentionPeriods: Record<string, number>;
  };
  accessRestrictions: {
    requireVPN: boolean;
    allowedIpRanges: string[];
    requireEnhancedAuth: boolean;
    businessHoursOnly: boolean;
  };
  isActive: boolean;
  lastReviewed: Date;
  nextReview: Date;
}

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

/**
 * Security configuration per tenant/environment
 */
export interface EnterpriseSecurityConfiguration {
  configId: string;
  version: string;
  tenantId: string;
  environment: string;
  roles: SecurityRole[];
  permissions: SecurityPermission[];
  emailDomainPolicies: EmailDomainPolicy[];
  countryPolicies: CountrySecurityPolicy[];
  securitySettings: {
    defaultRole: string;
    passwordPolicy: {
      minLength: number;
      requireUppercase: boolean;
      requireLowercase: boolean;
      requireNumbers: boolean;
      requireSpecialChars: boolean;
      maxAge: number;
    };
    sessionPolicy: {
      defaultTimeout: number;
      maxConcurrentSessions: number;
      requireReauth: boolean;
      reAuthInterval: number;
    };
    twoFactorAuth: {
      enabled: boolean;
      required: boolean;
      methods: string[];
      backupCodes: number;
    };
    auditPolicy: {
      enabled: boolean;
      retentionPeriod: number;
      realTimeAlerts: boolean;
      sensitiveActionsLog: boolean;
    };
  };
  complianceSettings: {
    gdprEnabled: boolean;
    dataRetention: Record<string, number>;
    privacyControls: {
      dataMinimization: boolean;
      purposeLimitation: boolean;
      consentManagement: boolean;
    };
  };
  cacheSettings: {
    ttl: number;
    securityTtl: number;
    autoRefresh: boolean;
  };
  createdAt: Date;
  lastUpdated: Date;
  updatedBy: string;
  auditTrail: Array<{
    action: string;
    userId: string;
    timestamp: Date;
    changes: Record<string, unknown>;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }>;
}

// ============================================================================
// CACHE INTERFACES
// ============================================================================

export interface SecurityCacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  key: string;
  securityLevel: 'low' | 'medium' | 'high';
}

export interface EnterpriseSecurityCache {
  configurations: Map<string, SecurityCacheEntry<EnterpriseSecurityConfiguration>>;
  roles: Map<string, SecurityCacheEntry<SecurityRole[]>>;
  permissions: Map<string, SecurityCacheEntry<SecurityPermission[]>>;
  emailPolicies: Map<string, SecurityCacheEntry<EmailDomainPolicy[]>>;
  countryPolicies: Map<string, SecurityCacheEntry<CountrySecurityPolicy[]>>;
}
