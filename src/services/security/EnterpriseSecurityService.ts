/**
 * 🔒 ENTERPRISE SECURITY SERVICE
 *
 * Database-driven security management service for enterprise applications.
 *
 * Types: ./security-types.ts
 * Default configs: ./security-defaults.ts
 *
 * @enterprise-ready true
 * @security-critical true
 * @multi-tenant true
 */

import { where, orderBy } from 'firebase/firestore';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import { normalizeToDate } from '@/lib/date-local';
import { createModuleLogger } from '@/lib/telemetry';

import type {
  SecurityRole,
  EmailDomainPolicy,
  CountrySecurityPolicy,
  SecurityCacheEntry,
  EnterpriseSecurityCache,
} from './security-types';

import {
  getDefaultSecurityRoles,
  getDefaultEmailDomainPolicies,
  getDefaultCountryPolicies,
} from './security-defaults';

// Re-export types for consumers
export type * from './security-types';

const logger = createModuleLogger('EnterpriseSecurityService');

// ============================================================================
// ENTERPRISE SECURITY SERVICE
// ============================================================================

export class EnterpriseSecurityService {
  private static instance: EnterpriseSecurityService;
  private cache: EnterpriseSecurityCache;

  private constructor() {
    this.cache = {
      configurations: new Map(),
      roles: new Map(),
      permissions: new Map(),
      emailPolicies: new Map(),
      countryPolicies: new Map(),
    };
  }

  static getInstance(): EnterpriseSecurityService {
    if (!EnterpriseSecurityService.instance) {
      EnterpriseSecurityService.instance = new EnterpriseSecurityService();
    }
    return EnterpriseSecurityService.instance;
  }

  // ============================================================================
  // CACHE MANAGEMENT (SECURITY-ENHANCED)
  // ============================================================================

  private isSecurityCacheValid<T>(entry: SecurityCacheEntry<T>): boolean {
    const age = Date.now() - entry.timestamp;
    const maxAge = entry.securityLevel === 'high'
      ? Math.min(entry.ttl, 60000)
      : entry.ttl;
    return age < maxAge;
  }

  private getSecurityCacheEntry<T>(
    cache: Map<string, SecurityCacheEntry<T>>,
    key: string
  ): T | null {
    const entry = cache.get(key);
    if (entry && this.isSecurityCacheValid(entry)) {
      return entry.data;
    }
    if (entry) {
      cache.delete(key);
    }
    return null;
  }

  private setSecurityCacheEntry<T>(
    cache: Map<string, SecurityCacheEntry<T>>,
    key: string,
    data: T,
    securityLevel: 'low' | 'medium' | 'high' = 'medium',
    ttlSeconds: number = 300
  ): void {
    const adjustedTtl = securityLevel === 'high'
      ? Math.min(ttlSeconds, 60)
      : ttlSeconds;

    cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: adjustedTtl * 1000,
      key,
      securityLevel,
    });
  }

  clearSecurityCache(): void {
    this.cache.configurations.clear();
    this.cache.roles.clear();
    this.cache.permissions.clear();
    this.cache.emailPolicies.clear();
    this.cache.countryPolicies.clear();
    logger.info('🔒 Security cache cleared');
  }

  // ============================================================================
  // ROLE MANAGEMENT
  // ============================================================================

  async loadSecurityRoles(
    tenantId: string = 'default',
    environment: string = 'production'
  ): Promise<SecurityRole[]> {
    const cacheKey = `roles-${tenantId}-${environment}`;

    const cached = this.getSecurityCacheEntry(this.cache.roles, cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const result = await firestoreQueryService.getAll<SecurityRole>(
        'SECURITY_ROLES', {
          constraints: [
            where('tenantId', '==', tenantId),
            where('environment', '==', environment),
            where('isActive', '==', true),
            orderBy('level', 'asc'),
          ],
          tenantOverride: 'skip',
        }
      );

      const roles: SecurityRole[] = result.documents.map(data => ({
        ...data,
        createdAt: normalizeToDate(data.createdAt) ?? new Date(),
        lastUpdated: normalizeToDate(data.lastUpdated) ?? new Date(),
        expiryDate: normalizeToDate(data.expiryDate) ?? undefined,
      }));

      this.setSecurityCacheEntry(this.cache.roles, cacheKey, roles, 'high', 120);

      logger.info(`🔒 Loaded ${roles.length} security roles from database`);
      return roles;
    } catch (error) {
      logger.error('❌ Failed to load security roles:', error);
      return getDefaultSecurityRoles(tenantId, environment);
    }
  }

  async getSecurityRole(
    roleId: string,
    tenantId?: string,
    environment?: string
  ): Promise<SecurityRole | null> {
    const roles = await this.loadSecurityRoles(tenantId, environment);
    return roles.find(role => role.id === roleId) || null;
  }

  async getUserRoles(
    _userId: string,
    tenantId?: string,
    environment?: string
  ): Promise<SecurityRole[]> {
    const roles = await this.loadSecurityRoles(tenantId, environment);
    return roles.filter(role => role.category === 'user').slice(0, 1);
  }

  /**
   * 🔒 Check user role based on email (REPLACES HARDCODED ADMIN ARRAYS)
   */
  async checkUserRole(
    email: string,
    tenantId: string = 'default',
    environment: string = 'production'
  ): Promise<'admin' | 'authenticated' | 'public'> {
    if (!email) {
      return 'public';
    }

    try {
      await this.loadSecurityRoles(tenantId, environment);

      const envAdminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS;

      if (envAdminEmails) {
        const adminEmails = envAdminEmails
          .split(',')
          .map(e => e.trim().toLowerCase())
          .filter(Boolean);

        if (adminEmails.includes(email.toLowerCase())) {
          logger.info(`🔐 Admin access granted for: ${email}`);
          return 'admin';
        }
      }

      if (process.env.NODE_ENV === 'development') {
        const devAdminEmails = ['admin@company.local', 'developer@company.local'];
        if (devAdminEmails.includes(email.toLowerCase())) {
          logger.warn(`⚠️ Development admin access granted for: ${email}`);
          return 'admin';
        }
      }

      logger.info(`🔐 Authenticated access granted for: ${email}`);
      return 'authenticated';
    } catch (error) {
      logger.error('❌ Failed to check user role:', error);
      return email ? 'authenticated' : 'public';
    }
  }

  async isAdminUser(
    email: string,
    tenantId?: string,
    environment?: string
  ): Promise<boolean> {
    const role = await this.checkUserRole(email, tenantId, environment);
    return role === 'admin';
  }

  // ============================================================================
  // EMAIL DOMAIN POLICIES
  // ============================================================================

  async loadEmailDomainPolicies(
    tenantId: string = 'default',
    environment: string = 'production'
  ): Promise<EmailDomainPolicy[]> {
    const cacheKey = `email-policies-${tenantId}-${environment}`;

    const cached = this.getSecurityCacheEntry(this.cache.emailPolicies, cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const result = await firestoreQueryService.getAll<EmailDomainPolicy>(
        'EMAIL_DOMAIN_POLICIES', {
          constraints: [
            where('tenantId', '==', tenantId),
            where('environment', '==', environment),
            where('isActive', '==', true),
            orderBy('riskLevel', 'desc'),
          ],
          tenantOverride: 'skip',
        }
      );

      const policies: EmailDomainPolicy[] = result.documents.map(data => ({
        ...data,
        effectiveDate: normalizeToDate(data.effectiveDate) ?? new Date(),
        expiryDate: normalizeToDate(data.expiryDate) ?? undefined,
        lastVerified: normalizeToDate(data.lastVerified) ?? undefined,
      }));

      this.setSecurityCacheEntry(this.cache.emailPolicies, cacheKey, policies, 'high', 180);

      logger.info(`🔒 Loaded ${policies.length} email domain policies from database`);
      return policies;
    } catch (error) {
      logger.error('❌ Failed to load email domain policies:', error);
      return getDefaultEmailDomainPolicies();
    }
  }

  async validateEmailDomain(
    email: string,
    tenantId?: string,
    environment?: string
  ): Promise<{
    isAllowed: boolean;
    policy?: EmailDomainPolicy;
    actions: Array<{ action: string; severity: string; message?: string }>;
    riskScore: number;
  }> {
    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain) {
      return {
        isAllowed: false,
        actions: [{ action: 'block', severity: 'error', message: 'Invalid email format' }],
        riskScore: 100,
      };
    }

    const policies = await this.loadEmailDomainPolicies(tenantId, environment);
    const policy = policies.find(p => p.domain === domain);

    if (!policy) {
      return { isAllowed: true, actions: [], riskScore: 0 };
    }

    const riskScores = { low: 25, medium: 50, high: 75, critical: 100 };

    return {
      isAllowed: policy.type !== 'blacklist',
      policy,
      actions: policy.actions,
      riskScore: riskScores[policy.riskLevel],
    };
  }

  async getEmailDomainBlacklist(
    tenantId?: string,
    environment?: string
  ): Promise<string[]> {
    const policies = await this.loadEmailDomainPolicies(tenantId, environment);
    return policies.filter(p => p.type === 'blacklist').map(p => p.domain);
  }

  // ============================================================================
  // COUNTRY POLICIES
  // ============================================================================

  async loadCountryPolicies(
    tenantId: string = 'default',
    environment: string = 'production'
  ): Promise<CountrySecurityPolicy[]> {
    const cacheKey = `country-policies-${tenantId}-${environment}`;

    const cached = this.getSecurityCacheEntry(this.cache.countryPolicies, cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const result = await firestoreQueryService.getAll<CountrySecurityPolicy>(
        'COUNTRY_SECURITY_POLICIES', {
          constraints: [
            where('tenantId', '==', tenantId),
            where('environment', '==', environment),
            where('isActive', '==', true),
            orderBy('securityClass', 'desc'),
          ],
          tenantOverride: 'skip',
        }
      );

      const policies: CountrySecurityPolicy[] = result.documents.map(data => ({
        ...data,
        lastReviewed: normalizeToDate(data.lastReviewed) ?? new Date(),
        nextReview: normalizeToDate(data.nextReview) ?? new Date(),
      }));

      this.setSecurityCacheEntry(this.cache.countryPolicies, cacheKey, policies, 'medium', 300);

      logger.info(`🔒 Loaded ${policies.length} country security policies from database`);
      return policies;
    } catch (error) {
      logger.error('❌ Failed to load country security policies:', error);
      return getDefaultCountryPolicies();
    }
  }

  async getSecureCountryOptions(
    tenantId?: string,
    environment?: string,
    userSecurityLevel: 'low' | 'medium' | 'high' = 'medium'
  ): Promise<Array<{ value: string; label: string; restricted?: boolean }>> {
    const policies = await this.loadCountryPolicies(tenantId, environment);

    const allowedClasses = userSecurityLevel === 'high'
      ? ['unrestricted', 'restricted', 'confidential', 'secret']
      : userSecurityLevel === 'medium'
      ? ['unrestricted', 'restricted']
      : ['unrestricted'];

    return policies
      .filter(policy => allowedClasses.includes(policy.securityClass))
      .map(policy => ({
        value: policy.countryCode,
        label: policy.countryName,
        restricted: policy.securityClass !== 'unrestricted',
      }));
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default EnterpriseSecurityService;

export const securityService = EnterpriseSecurityService.getInstance();
