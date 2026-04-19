/**
 * ============================================================================
 * 🛡️ ENTERPRISE CONFIGURATION VALIDATORS
 * ============================================================================
 *
 * Type-safe validation functions for configuration schemas.
 * Extracted from enterprise-config-management.ts (ADR-314 C.5.43 SRP split).
 * Previously class-private methods — now standalone for testability + SRP.
 *
 * ADR-209: Email validation imported from centralized location.
 *
 * ============================================================================
 */

import { isValidEmail } from '@/lib/validation/email-validation';
import { createModuleLogger } from '@/lib/telemetry';
import { isRecord } from '@/lib/type-guards';
import type {
  CompanyConfiguration,
  EnterpriseConfiguration,
  ProjectTemplateConfiguration,
  SystemConfiguration
} from './types';

const logger = createModuleLogger('enterprise-config-validators');

// ============================================================================
// PRIMITIVE TYPE GUARDS
// ============================================================================

export function hasString(record: Record<string, unknown>, key: string): boolean {
  return typeof record[key] === 'string';
}

export function hasNumber(record: Record<string, unknown>, key: string): boolean {
  return typeof record[key] === 'number';
}

export function hasBoolean(record: Record<string, unknown>, key: string): boolean {
  return typeof record[key] === 'boolean';
}

export function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

// ============================================================================
// SCHEMA TYPE GUARDS
// ============================================================================

export function isCompanyConfiguration(value: unknown): value is CompanyConfiguration {
  if (!isRecord(value)) return false;

  if (
    !hasString(value, 'id') ||
    !hasString(value, 'name') ||
    !hasString(value, 'legalName') ||
    !hasString(value, 'email') ||
    !hasString(value, 'phone') ||
    !hasString(value, 'website')
  ) {
    return false;
  }

  const address = value.address;
  if (!isRecord(address)) return false;
  if (
    !hasString(address, 'street') ||
    !hasString(address, 'number') ||
    !hasString(address, 'city') ||
    !hasString(address, 'postalCode') ||
    !hasString(address, 'country')
  ) {
    return false;
  }

  const branding = value.branding;
  if (!isRecord(branding)) return false;
  if (
    !hasString(branding, 'logoUrl') ||
    !hasString(branding, 'primaryColor') ||
    !hasString(branding, 'secondaryColor') ||
    !hasString(branding, 'accentColor')
  ) {
    return false;
  }

  const tax = value.tax;
  if (!isRecord(tax)) return false;
  if (
    !hasString(tax, 'vatNumber') ||
    !hasString(tax, 'taxOffice') ||
    !hasString(tax, 'gemiNumber')
  ) {
    return false;
  }

  return true;
}

export function isSystemConfiguration(value: unknown): value is SystemConfiguration {
  if (!isRecord(value)) return false;

  const app = value.app;
  if (!isRecord(app)) return false;
  if (
    !hasString(app, 'name') ||
    !hasString(app, 'version') ||
    !hasString(app, 'environment') ||
    !hasString(app, 'baseUrl') ||
    !hasString(app, 'apiUrl')
  ) {
    return false;
  }

  const admin = value.admin;
  if (!isRecord(admin)) return false;
  if (
    !hasString(admin, 'primaryAdminUid') ||
    !hasString(admin, 'adminEmail') ||
    !isStringArray(admin.additionalAdminUids) ||
    !hasBoolean(admin, 'enableErrorReporting')
  ) {
    return false;
  }

  const security = value.security;
  if (!isRecord(security)) return false;
  if (
    !hasNumber(security, 'sessionTimeoutMinutes') ||
    !hasNumber(security, 'maxLoginAttempts') ||
    !hasNumber(security, 'passwordExpiryDays') ||
    !hasBoolean(security, 'enableTwoFactor')
  ) {
    return false;
  }

  const features = value.features;
  if (!isRecord(features)) return false;
  if (
    !hasBoolean(features, 'enableNotifications') ||
    !hasBoolean(features, 'enableFileUpload') ||
    !hasBoolean(features, 'enableReporting') ||
    !hasNumber(features, 'maxFileUploadMB')
  ) {
    return false;
  }

  const integrations = value.integrations;
  if (!isRecord(integrations)) return false;

  const webhooks = integrations.webhooks;
  if (!isRecord(webhooks)) return false;
  if (
    !hasString(webhooks, 'telegram') ||
    !hasString(webhooks, 'slack') ||
    !hasString(webhooks, 'email')
  ) {
    return false;
  }

  const apis = integrations.apis;
  if (!isRecord(apis)) return false;
  if (
    !hasString(apis, 'maps') ||
    !hasString(apis, 'weather') ||
    !hasString(apis, 'notifications')
  ) {
    return false;
  }

  const businessRules = value.businessRules;
  if (!isRecord(businessRules)) return false;

  const obligations = businessRules.obligations;
  if (!isRecord(obligations)) return false;
  if (
    !hasNumber(obligations, 'qualityThreshold') ||
    !hasNumber(obligations, 'defaultReadingSpeed')
  ) {
    return false;
  }

  const progressThresholds = obligations.progressThresholds;
  if (!isRecord(progressThresholds)) return false;
  if (
    !hasNumber(progressThresholds, 'excellent') ||
    !hasNumber(progressThresholds, 'good') ||
    !hasNumber(progressThresholds, 'moderate')
  ) {
    return false;
  }

  const wordCountThresholds = obligations.wordCountThresholds;
  if (!isRecord(wordCountThresholds)) return false;
  if (
    !hasNumber(wordCountThresholds, 'minimum') ||
    !hasNumber(wordCountThresholds, 'excellent')
  ) {
    return false;
  }

  return true;
}

export function isProjectTemplateConfiguration(
  value: unknown
): value is ProjectTemplateConfiguration {
  if (!isRecord(value)) return false;

  if (!hasString(value, 'id') || !hasString(value, 'name') || !hasString(value, 'category')) {
    return false;
  }

  const defaultValues = value.defaultValues;
  if (!isRecord(defaultValues)) return false;
  if (
    !hasString(defaultValues, 'status') ||
    !hasString(defaultValues, 'currency') ||
    !hasNumber(defaultValues, 'taxRate') ||
    !hasNumber(defaultValues, 'paymentTerms')
  ) {
    return false;
  }

  if (!isStringArray(value.requiredFields) || !isStringArray(value.optionalFields)) {
    return false;
  }

  return true;
}

// ============================================================================
// VALIDATORS (throw on invalid)
// ============================================================================

export function validateCompanyConfig(data: unknown): CompanyConfiguration {
  if (!isCompanyConfiguration(data)) {
    throw new Error('Invalid company configuration data');
  }

  if (!isValidEmail(data.email)) {
    throw new Error('Invalid email format');
  }

  return data;
}

export function validateSystemConfig(data: unknown): SystemConfiguration {
  if (!isSystemConfiguration(data)) {
    throw new Error('Invalid system configuration data');
  }

  return data;
}

export function validateProjectTemplate(data: unknown): ProjectTemplateConfiguration | null {
  if (!isProjectTemplateConfiguration(data)) {
    logger.warn('Invalid project template data');
    return null;
  }
  return data;
}

export function parseAndValidateConfiguration(data: unknown): EnterpriseConfiguration {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid configuration data structure');
  }

  return data as EnterpriseConfiguration;
}
