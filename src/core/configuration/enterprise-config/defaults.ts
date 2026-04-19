/**
 * ============================================================================
 * 🏢 ENTERPRISE CONFIGURATION DEFAULTS
 * ============================================================================
 *
 * Production-ready defaults with validation.
 * Extracted from enterprise-config-management.ts (ADR-314 C.5.43 SRP split).
 *
 * ============================================================================
 */

import { designTokens, borderColors } from '@/styles/design-tokens';
import type { CompanyConfiguration, SystemConfiguration } from './types';

/**
 * Default Company Configuration
 * Production-ready defaults με validation
 */
export const DEFAULT_COMPANY_CONFIG: CompanyConfiguration = {
  id: 'default',
  name: 'Your Company',
  legalName: 'Your Company Ltd.',
  email: process.env.NEXT_PUBLIC_COMPANY_DEFAULT_EMAIL || 'info@company.com',
  phone: '+30 210 1234567',
  website: 'https://company.com',
  address: {
    street: 'Main Street',
    number: '1',
    city: 'Athens',
    postalCode: '10431',
    country: 'Greece'
  },
  branding: {
    logoUrl: '',
    primaryColor: borderColors.info.dark,
    secondaryColor: designTokens.colors.text.secondary,
    accentColor: designTokens.colors.green['600']
  },
  tax: {
    vatNumber: '123456789',
    taxOffice: 'Athens Tax Office',
    gemiNumber: '123456789'
  }
} as const;

/**
 * Default System Configuration
 * Enterprise-grade system defaults
 */
export const DEFAULT_SYSTEM_CONFIG: SystemConfiguration = {
  app: {
    name: 'Nestor Enterprise',
    version: '1.0.0',
    environment: 'development',
    baseUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001',
    apiUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/api`
  },
  admin: {
    primaryAdminUid: process.env.NEXT_PUBLIC_ADMIN_UID || '',
    adminEmail: process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'georgios.pagonis@gmail.com',
    additionalAdminUids: [],
    enableErrorReporting: true
  },
  security: {
    sessionTimeoutMinutes: 480,
    maxLoginAttempts: 5,
    passwordExpiryDays: 90,
    enableTwoFactor: false
  },
  features: {
    enableNotifications: true,
    enableFileUpload: true,
    enableReporting: true,
    maxFileUploadMB: 50
  },
  integrations: {
    webhooks: {
      telegram: '',
      slack: '',
      email: ''
    },
    apis: {
      maps: '',
      weather: '',
      notifications: ''
    }
  },
  businessRules: {
    obligations: {
      qualityThreshold: 50,
      progressThresholds: {
        excellent: 90,
        good: 70,
        moderate: 50
      },
      wordCountThresholds: {
        minimum: 10,
        excellent: 200
      },
      defaultReadingSpeed: 200
    }
  }
} as const;
