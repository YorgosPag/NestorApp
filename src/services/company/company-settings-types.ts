/**
 * 🏢 COMPANY SETTINGS — TYPE DEFINITIONS & DEFAULTS
 *
 * Types, interfaces, and fallback configuration for the
 * enterprise company settings service.
 *
 * @module services/company/company-settings-types
 * @see EnterpriseCompanySettingsService.ts
 */

import { SYSTEM_IDENTITY } from '@/config/domain-constants';
import { designTokens } from '@/styles/design-tokens';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface EnterpriseCompanySettings {
  id: string;
  tenantId?: string;
  environment?: 'development' | 'staging' | 'production' | 'all';

  companyInfo: {
    name: string;
    displayName?: string;
    legalName?: string;
    description?: string;
    website?: string;
    logo?: string;
    favicon?: string;
    established?: Date;
    vatNumber?: string;
    registrationNumber?: string;
  };

  contactInfo: {
    email: string;
    phone: string;
    fax?: string;
    supportEmail?: string;
    salesEmail?: string;
    emergencyPhone?: string;
    phonePattern?: string;
    countryCode?: string;
    locale?: string;
    timezone?: string;
  };

  addressInfo: {
    street: string;
    city: string;
    region?: string;
    postalCode: string;
    country: string;
    coordinates?: { lat: number; lng: number };
    googleMapsPlaceId?: string;
  };

  brandSettings: {
    primaryColor?: string;
    secondaryColor?: string;
    accentColor?: string;
    logoUrl?: string;
    faviconUrl?: string;
    theme?: string;
    fontFamily?: string;
    brandGuidelines?: {
      colors: string[];
      fonts: string[];
      logoVariants: string[];
    };
  };

  communicationSettings: {
    defaultFromEmail: string;
    defaultFromName: string;
    emailSignature?: string;
    phoneFormats: {
      local: string;
      international: string;
      display: string;
    };
    socialMedia?: {
      facebook?: string;
      twitter?: string;
      linkedin?: string;
      instagram?: string;
      youtube?: string;
    };
  };

  businessSettings: {
    industry?: string;
    businessType?: 'corporation' | 'llc' | 'partnership' | 'sole_proprietorship' | 'nonprofit' | 'other';
    employeeCount?: number;
    workingHours?: {
      [key: string]: { open: string; close: string; closed?: boolean };
    };
    holidays?: Date[];
    currencies?: string[];
    defaultCurrency?: string;
    languages?: string[];
    defaultLanguage?: string;
  };

  technicalSettings: {
    domain: string;
    subdomains?: string[];
    apiEndpoints?: { [key: string]: string };
    integrations?: {
      [key: string]: { enabled: boolean; apiKey?: string; settings?: Record<string, unknown> };
    };
  };

  metadata?: {
    createdBy?: string;
    createdAt?: Date;
    updatedBy?: string;
    updatedAt?: Date;
    version?: number;
    isActive?: boolean;
    notes?: string;
  };
}

export interface CompanyQuickContact {
  name: string;
  email: string;
  phone: string;
  website?: string;
  domain: string;
}

export interface CompanyBrandInfo {
  name: string;
  displayName: string;
  logo?: string;
  primaryColor?: string;
  secondaryColor?: string;
  theme?: string;
}

// ============================================================================
// FALLBACK CONFIGURATION
// ============================================================================

export const FALLBACK_COMPANY_SETTINGS: EnterpriseCompanySettings = {
  id: 'default-company',
  environment: 'all',

  companyInfo: {
    name: process.env.NEXT_PUBLIC_COMPANY_NAME || 'Company',
    displayName: process.env.NEXT_PUBLIC_COMPANY_DISPLAY_NAME || process.env.NEXT_PUBLIC_COMPANY_NAME || 'Company',
    legalName: process.env.NEXT_PUBLIC_COMPANY_LEGAL_NAME || process.env.NEXT_PUBLIC_COMPANY_NAME || 'Company Ltd.',
    description: process.env.NEXT_PUBLIC_COMPANY_DESCRIPTION || 'Professional services company',
    website: process.env.NEXT_PUBLIC_COMPANY_WEBSITE || process.env.NEXT_PUBLIC_APP_URL || 'https://company.local'
  },

  contactInfo: {
    email: process.env.NEXT_PUBLIC_COMPANY_EMAIL ||
           process.env.NEXT_PUBLIC_DEFAULT_CONTACT_EMAIL ||
           `info@${process.env.NEXT_PUBLIC_TENANT_DOMAIN || 'company.local'}`,
    phone: process.env.NEXT_PUBLIC_COMPANY_PHONE ||
           process.env.NEXT_PUBLIC_DEFAULT_CONTACT_PHONE ||
           '+30 210 000 0000',
    supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL ||
                  `support@${process.env.NEXT_PUBLIC_TENANT_DOMAIN || 'company.local'}`,
    salesEmail: process.env.NEXT_PUBLIC_SALES_EMAIL ||
                `sales@${process.env.NEXT_PUBLIC_TENANT_DOMAIN || 'company.local'}`,
    phonePattern: process.env.NEXT_PUBLIC_DEFAULT_PHONE_PATTERN || '210 000 0000',
    countryCode: process.env.NEXT_PUBLIC_PHONE_COUNTRY_CODE || '+30',
    locale: process.env.NEXT_PUBLIC_LOCALE || 'el-GR',
    timezone: process.env.NEXT_PUBLIC_TIMEZONE || 'Europe/Athens'
  },

  addressInfo: {
    street: process.env.NEXT_PUBLIC_COMPANY_ADDRESS || 'Company Street 1',
    city: process.env.NEXT_PUBLIC_COMPANY_CITY || 'Athens',
    region: process.env.NEXT_PUBLIC_COMPANY_REGION || 'Attica',
    postalCode: process.env.NEXT_PUBLIC_COMPANY_POSTAL_CODE || '10001',
    country: process.env.NEXT_PUBLIC_COMPANY_COUNTRY || 'Greece'
  },

  brandSettings: {
    primaryColor: process.env.NEXT_PUBLIC_BRAND_PRIMARY_COLOR || designTokens.colors.blue['500'],
    secondaryColor: process.env.NEXT_PUBLIC_BRAND_SECONDARY_COLOR || designTokens.colors.gray['500'],
    accentColor: process.env.NEXT_PUBLIC_BRAND_ACCENT_COLOR || designTokens.colors.green['500'],
    theme: process.env.NEXT_PUBLIC_DEFAULT_THEME || 'default'
  },

  communicationSettings: {
    defaultFromEmail: process.env.NEXT_PUBLIC_DEFAULT_FROM_EMAIL ||
                     `noreply@${process.env.NEXT_PUBLIC_TENANT_DOMAIN || 'company.local'}`,
    defaultFromName: process.env.NEXT_PUBLIC_DEFAULT_FROM_NAME ||
                     process.env.NEXT_PUBLIC_COMPANY_NAME || 'Company',
    phoneFormats: {
      local: process.env.NEXT_PUBLIC_PHONE_FORMAT_LOCAL || '210 000 0000',
      international: process.env.NEXT_PUBLIC_PHONE_FORMAT_INTL || '+30 210 000 0000',
      display: process.env.NEXT_PUBLIC_PHONE_FORMAT_DISPLAY || '+30 210 000 0000'
    }
  },

  businessSettings: {
    industry: process.env.NEXT_PUBLIC_COMPANY_INDUSTRY || 'Professional Services',
    businessType: (process.env.NEXT_PUBLIC_BUSINESS_TYPE as EnterpriseCompanySettings['businessSettings']['businessType']) || 'corporation',
    defaultCurrency: process.env.NEXT_PUBLIC_DEFAULT_CURRENCY || 'EUR',
    defaultLanguage: process.env.NEXT_PUBLIC_DEFAULT_LANGUAGE || 'el'
  },

  technicalSettings: {
    domain: process.env.NEXT_PUBLIC_TENANT_DOMAIN || 'company.local'
  },

  metadata: {
    createdBy: SYSTEM_IDENTITY.ID,
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
    isActive: true,
    notes: 'Fallback configuration από environment variables'
  }
};
