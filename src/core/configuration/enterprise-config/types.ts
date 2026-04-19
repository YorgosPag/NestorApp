/**
 * ============================================================================
 * 🏢 ENTERPRISE CONFIGURATION TYPES
 * ============================================================================
 *
 * Type-safe schemas for configuration system.
 * Extracted from enterprise-config-management.ts (ADR-314 C.5.43 SRP split).
 *
 * ============================================================================
 */

import type { Timestamp } from 'firebase/firestore';

/**
 * Company Configuration Schema
 * Αντικαθιστά hardcoded company data
 */
export interface CompanyConfiguration {
  readonly id: string;
  readonly name: string;
  readonly legalName: string;
  readonly email: string;
  readonly phone: string;
  readonly website: string;
  readonly address: {
    readonly street: string;
    readonly number: string;
    readonly city: string;
    readonly postalCode: string;
    readonly country: string;
  };
  readonly branding: {
    readonly logoUrl: string;
    readonly primaryColor: string;
    readonly secondaryColor: string;
    readonly accentColor: string;
  };
  readonly tax: {
    readonly vatNumber: string;
    readonly taxOffice: string;
    readonly gemiNumber: string;
  };
}

/**
 * System Configuration Schema
 * Αντικαθιστά hardcoded system settings
 */
export interface SystemConfiguration {
  readonly app: {
    readonly name: string;
    readonly version: string;
    readonly environment: 'development' | 'staging' | 'production';
    readonly baseUrl: string;
    readonly apiUrl: string;
  };
  /**
   * 🏢 ENTERPRISE: Admin & Error Reporting Configuration
   * Used for error notifications, system alerts, and admin communications
   */
  readonly admin: {
    /** Firebase UID of the primary admin user */
    readonly primaryAdminUid: string;
    /** Email address for admin notifications */
    readonly adminEmail: string;
    /** Additional admin UIDs for system notifications */
    readonly additionalAdminUids: readonly string[];
    /** Enable error report notifications to admin */
    readonly enableErrorReporting: boolean;
  };
  readonly security: {
    readonly sessionTimeoutMinutes: number;
    readonly maxLoginAttempts: number;
    readonly passwordExpiryDays: number;
    readonly enableTwoFactor: boolean;
  };
  readonly features: {
    readonly enableNotifications: boolean;
    readonly enableFileUpload: boolean;
    readonly enableReporting: boolean;
    readonly maxFileUploadMB: number;
  };
  readonly integrations: {
    readonly webhooks: {
      readonly telegram: string;
      readonly slack: string;
      readonly email: string;
    };
    readonly apis: {
      readonly maps: string;
      readonly weather: string;
      readonly notifications: string;
    };
  };
  readonly businessRules: {
    readonly obligations: {
      readonly qualityThreshold: number;
      readonly progressThresholds: {
        readonly excellent: number;
        readonly good: number;
        readonly moderate: number;
      };
      readonly wordCountThresholds: {
        readonly minimum: number;
        readonly excellent: number;
      };
      readonly defaultReadingSpeed: number;
    };
  };
}

/**
 * Project Templates Configuration
 * Αντικαθιστά hardcoded project data
 */
export interface ProjectTemplateConfiguration {
  readonly id: string;
  readonly name: string;
  readonly category: 'residential' | 'commercial' | 'industrial' | 'infrastructure';
  readonly defaultValues: {
    readonly status: string;
    readonly currency: string;
    readonly taxRate: number;
    readonly paymentTerms: number;
  };
  readonly requiredFields: readonly string[];
  readonly optionalFields: readonly string[];
}

/**
 * User Preferences Configuration
 * Αντικαθιστά hardcoded user settings
 */
export interface UserPreferencesConfiguration {
  readonly userId: string;
  readonly language: 'el' | 'en';
  readonly timezone: string;
  readonly dateFormat: string;
  readonly numberFormat: string;
  readonly theme: 'light' | 'dark' | 'auto';
  readonly notifications: {
    readonly email: boolean;
    readonly push: boolean;
    readonly sms: boolean;
  };
  readonly dashboard: {
    readonly defaultView: string;
    readonly refreshInterval: number;
    readonly itemsPerPage: number;
  };
}

/**
 * Master Configuration Interface
 * Κεντρικό interface για όλες τις configurations
 */
export interface EnterpriseConfiguration {
  readonly company: CompanyConfiguration;
  readonly system: SystemConfiguration;
  readonly projectTemplates: readonly ProjectTemplateConfiguration[];
  readonly userPreferences: UserPreferencesConfiguration;
  readonly lastUpdated: Timestamp;
  readonly version: string;
}
