/**
 * ============================================================================
 * 🔄 HARDCODED VALUES MIGRATION — TYPES & DATA CONSTANTS
 * ============================================================================
 *
 * Type definitions and detected hardcoded data for migration engine.
 * Extracted from hardcoded-values-migration.ts (ADR-065 SRP compliance).
 *
 * ============================================================================
 */

import { designTokens, borderColors } from '@/styles/design-tokens';

// ============================================================================
// 🎯 MIGRATION DATA TYPES - FULL TYPE SAFETY
// ============================================================================

/**
 * Hardcoded Company Data που θα μεταφερθεί
 * Εντοπίστηκε από την έρευνα του κώδικα
 */
export interface HardcodedCompanyData {
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
  };
  readonly tax: {
    readonly vatNumber: string;
    readonly gemiNumber: string;
  };
}

/**
 * Hardcoded System URLs και Settings
 */
export interface HardcodedSystemData {
  readonly productionUrl: string;
  readonly developmentUrl: string;
  readonly apiEndpoints: {
    readonly notifications: string;
    readonly webhooks: string;
    readonly overpassApi: readonly string[];
  };
  readonly integrations: {
    readonly telegram: {
      readonly webhookUrl: string;
      readonly adminUserId: string;
    };
    readonly slack: {
      readonly webhookUrl: string;
    };
    readonly monitoring: {
      readonly elasticsearch: string;
      readonly prometheus: string;
      readonly jaeger: string;
    };
  };
}

/**
 * Hardcoded Project Data
 */
export interface HardcodedProjectData {
  readonly companyId: string;
  readonly projectId: string;
  readonly name: string;
  readonly category: 'residential' | 'commercial' | 'industrial';
  readonly defaultValues: Record<string, unknown>;
}

/**
 * Migration Result με comprehensive tracking
 */
export interface MigrationResult {
  readonly success: boolean;
  readonly itemsMigrated: number;
  readonly itemsFailed: number;
  readonly errors: readonly string[];
  readonly duration: number;
  readonly backupId: string;
}

/**
 * Migration Progress για real-time tracking
 */
export interface MigrationProgress {
  readonly phase: 'preparing' | 'backing_up' | 'migrating' | 'validating' | 'completed';
  readonly percentage: number;
  readonly currentItem: string;
  readonly itemsProcessed: number;
  readonly totalItems: number;
  readonly errors: readonly string[];
}

// ============================================================================
// 📊 ΣΚΛΗΡΕΣ ΤΙΜΕΣ ΠΟΥ ΕΝΤΟΠΙΣΤΗΚΑΝ - ENTERPRISE DATA CATALOG
// ============================================================================

/**
 * Company Data που βρέθηκε στον κώδικα
 */
export const DETECTED_COMPANY_DATA: HardcodedCompanyData = {
  name: process.env.NEXT_PUBLIC_COMPANY_NAME || 'Default Construction Company',
  legalName: process.env.NEXT_PUBLIC_COMPANY_LEGAL_NAME || 'Default Legal Company Name',
  email: process.env.NEXT_PUBLIC_COMPANY_EMAIL || 'info@company.gr',
  phone: process.env.NEXT_PUBLIC_COMPANY_PHONE || '+30 210 123 4567',
  website: process.env.NEXT_PUBLIC_COMPANY_WEBSITE || 'https://company.gr',
  address: {
    street: process.env.NEXT_PUBLIC_COMPANY_STREET || 'Company Street',
    number: process.env.NEXT_PUBLIC_COMPANY_NUMBER || '1',
    city: process.env.NEXT_PUBLIC_COMPANY_CITY || 'Athens',
    postalCode: process.env.NEXT_PUBLIC_COMPANY_POSTAL || '10000'
  },
  tax: {
    vatNumber: process.env.NEXT_PUBLIC_COMPANY_VAT || '123456789',
    gemiNumber: process.env.NEXT_PUBLIC_COMPANY_GEMI || '987654321'
  }
} as const;

/**
 * System URLs και endpoints που βρέθηκαν
 */
export const DETECTED_SYSTEM_DATA: HardcodedSystemData = {
  productionUrl: process.env.NEXT_PUBLIC_PRODUCTION_URL || 'https://app.company.com',
  developmentUrl: process.env.NEXT_PUBLIC_DEV_URL || 'http://localhost:3000',
  apiEndpoints: {
    notifications: process.env.NEXT_PUBLIC_NOTIFICATIONS_API || 'https://api.company.com/notifications',
    webhooks: process.env.NEXT_PUBLIC_WEBHOOKS_URL || 'https://hooks.company.com',
    overpassApi: (process.env.NEXT_PUBLIC_OVERPASS_APIS ||
      'https://overpass-api.de/api/interpreter,https://overpass.kumi.systems/api/interpreter,https://overpass.osm.ch/api/interpreter'
    ).split(',')
  },
  integrations: {
    telegram: {
      webhookUrl: process.env.NEXT_PUBLIC_TELEGRAM_WEBHOOK || 'https://api.telegram.org/webhook',
      adminUserId: process.env.NEXT_PUBLIC_TELEGRAM_ADMIN_ID || '123456789'
    },
    slack: {
      webhookUrl: process.env.NEXT_PUBLIC_SLACK_WEBHOOK || 'https://hooks.slack.com/services/...'
    },
    monitoring: {
      elasticsearch: process.env.NEXT_PUBLIC_ELASTICSEARCH_URL || 'https://elasticsearch.company.com:9200',
      prometheus: process.env.NEXT_PUBLIC_PROMETHEUS_URL || 'http://prometheus.company.com:9090',
      jaeger: process.env.NEXT_PUBLIC_JAEGER_URL || 'http://jaeger.company.com:14268/api/traces'
    }
  }
} as const;

/**
 * Project Data που βρέθηκε σε seed αρχεία
 */
export const DETECTED_PROJECT_DATA: readonly HardcodedProjectData[] = [
  // No hardcoded project data - all project templates loaded from database
] as const;

// ============================================================================
// 🎨 BRANDING DEFAULTS (from design tokens)
// ============================================================================

export const BRANDING_DEFAULTS = {
  logoUrl: '',
  primaryColor: borderColors.info.dark,
  secondaryColor: designTokens.colors.text.secondary,
  accentColor: designTokens.colors.green['600']
} as const;
