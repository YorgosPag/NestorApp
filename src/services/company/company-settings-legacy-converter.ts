/**
 * 🔄 COMPANY SETTINGS — LEGACY CONTACT CONVERTER
 *
 * Converts legacy contact documents from the contacts collection
 * into the enterprise settings format.
 *
 * @module services/company/company-settings-legacy-converter
 * @see EnterpriseCompanySettingsService.ts
 */

import { designTokens } from '@/styles/design-tokens';
import type { EnterpriseCompanySettings } from './company-settings-types';

// ============================================================================
// LEGACY CONTACT DATA SHAPE
// ============================================================================

export interface LegacyContactData {
  tenantId?: string;
  companyName?: string;
  name?: string;
  displayName?: string;
  legalName?: string;
  description?: string;
  notes?: string;
  website?: string;
  companyWebsite?: string;
  email?: string;
  companyEmail?: string;
  phone?: string;
  companyPhone?: string;
  supportEmail?: string;
  salesEmail?: string;
  address?: string;
  street?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  zipCode?: string;
  country?: string;
  brandColor?: string;
  primaryColor?: string;
  logo?: string;
  logoUrl?: string;
  defaultFromEmail?: string;
  defaultFromName?: string;
  industry?: string;
  businessType?: string;
  domain?: string;
  createdAt?: { toDate?: () => Date };
}

// ============================================================================
// NORMALIZERS
// ============================================================================

export function normalizeBusinessType(
  value?: string
): EnterpriseCompanySettings['businessSettings']['businessType'] {
  if (!value) return 'other';

  const allowed = [
    'corporation', 'llc', 'partnership',
    'sole_proprietorship', 'nonprofit', 'other'
  ] as const;

  return (allowed as readonly string[]).includes(value)
    ? (value as EnterpriseCompanySettings['businessSettings']['businessType'])
    : 'other';
}

export function normalizeEnvironment(
  value?: string
): EnterpriseCompanySettings['environment'] {
  if (!value) return 'all';

  const allowed = ['development', 'staging', 'production', 'all'] as const;
  return (allowed as readonly string[]).includes(value)
    ? (value as EnterpriseCompanySettings['environment'])
    : 'all';
}

// ============================================================================
// CONVERTER
// ============================================================================

/**
 * 🔄 Convert legacy contact document to enterprise settings
 */
export function convertLegacyContactToSettings(
  contactData: LegacyContactData,
  contactId: string
): EnterpriseCompanySettings {
  const defaultFromEmail =
    contactData.defaultFromEmail ||
    contactData.email ||
    contactData.companyEmail ||
    'info@company.local';
  const defaultFromName =
    contactData.defaultFromName ||
    contactData.companyName ||
    contactData.name ||
    'Company';
  const businessType = normalizeBusinessType(contactData.businessType);

  return {
    id: `legacy-${contactId}`,
    tenantId: contactData.tenantId,

    companyInfo: {
      name: contactData.companyName || contactData.name || 'Company',
      displayName: contactData.displayName || contactData.companyName || contactData.name,
      legalName: contactData.legalName || contactData.companyName,
      description: contactData.description || contactData.notes,
      website: contactData.website || contactData.companyWebsite
    },

    contactInfo: {
      email: contactData.email || contactData.companyEmail || 'info@company.local',
      phone: contactData.phone || contactData.companyPhone || '+30 210 000 0000',
      supportEmail: contactData.supportEmail,
      salesEmail: contactData.salesEmail,
      countryCode: '+30',
      phonePattern: '210 000 0000',
      locale: 'el-GR',
      timezone: 'Europe/Athens'
    },

    addressInfo: {
      street: contactData.address || contactData.street || 'Company Street 1',
      city: contactData.city || 'Athens',
      region: contactData.region || 'Attica',
      postalCode: contactData.postalCode || contactData.zipCode || '10001',
      country: contactData.country || 'Greece'
    },

    brandSettings: {
      primaryColor: contactData.brandColor || contactData.primaryColor || designTokens.colors.blue['500'],
      logoUrl: contactData.logo || contactData.logoUrl
    },

    communicationSettings: {
      defaultFromEmail,
      defaultFromName,
      phoneFormats: {
        local: '210 000 0000',
        international: '+30 210 000 0000',
        display: '+30 210 000 0000'
      }
    },

    businessSettings: {
      industry: contactData.industry,
      businessType,
      defaultCurrency: 'EUR',
      defaultLanguage: 'el'
    },

    technicalSettings: {
      domain: contactData.domain || 'company.local'
    },

    metadata: {
      createdBy: 'legacy-conversion',
      createdAt: contactData.createdAt?.toDate?.() || new Date(),
      updatedAt: new Date(),
      version: 1,
      isActive: true,
      notes: 'Converted από legacy contact document'
    }
  };
}
