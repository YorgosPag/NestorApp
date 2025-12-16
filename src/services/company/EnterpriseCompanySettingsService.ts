/**
 * 🏢 ENTERPRISE COMPANY SETTINGS SERVICE
 *
 * Database-driven company configuration για multi-tenant deployments.
 * Αντικατέστησε τα hardcoded company details με configurable Firebase collections.
 *
 * Features:
 * - Multi-tenant company settings
 * - Environment-specific configurations
 * - Contact information management
 * - Branding & identity settings
 * - Real-time settings updates
 * - Fallback support για offline mode
 * - Performance-optimized caching
 */

import { collection, doc, getDoc, getDocs, setDoc, updateDoc, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';

// ============================================================================
// ENTERPRISE COMPANY TYPES
// ============================================================================

export interface EnterpriseCompanySettings {
  id: string;
  tenantId?: string;
  environment?: 'development' | 'staging' | 'production' | 'all';

  // Company Identity
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

  // Contact Information
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

  // Address Information
  addressInfo: {
    street: string;
    city: string;
    region?: string;
    postalCode: string;
    country: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
    googleMapsPlaceId?: string;
  };

  // Brand Settings
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

  // Communication Settings
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

  // Business Settings
  businessSettings: {
    industry?: string;
    businessType?: 'corporation' | 'llc' | 'partnership' | 'sole_proprietorship' | 'nonprofit' | 'other';
    employeeCount?: number;
    workingHours?: {
      [key: string]: {
        open: string;
        close: string;
        closed?: boolean;
      };
    };
    holidays?: Date[];
    currencies?: string[];
    defaultCurrency?: string;
    languages?: string[];
    defaultLanguage?: string;
  };

  // Technical Settings
  technicalSettings: {
    domain: string;
    subdomains?: string[];
    apiEndpoints?: {
      [key: string]: string;
    };
    integrations?: {
      [key: string]: {
        enabled: boolean;
        apiKey?: string;
        settings?: Record<string, any>;
      };
    };
  };

  // Metadata
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
// DEFAULT/FALLBACK CONFIGURATION
// ============================================================================

/**
 * 🏢 Fallback company configuration για offline mode
 */
const FALLBACK_COMPANY_SETTINGS: EnterpriseCompanySettings = {
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
    primaryColor: process.env.NEXT_PUBLIC_BRAND_PRIMARY_COLOR || '#3b82f6',
    secondaryColor: process.env.NEXT_PUBLIC_BRAND_SECONDARY_COLOR || '#64748b',
    accentColor: process.env.NEXT_PUBLIC_BRAND_ACCENT_COLOR || '#10b981',
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
    businessType: (process.env.NEXT_PUBLIC_BUSINESS_TYPE as any) || 'corporation',
    defaultCurrency: process.env.NEXT_PUBLIC_DEFAULT_CURRENCY || 'EUR',
    defaultLanguage: process.env.NEXT_PUBLIC_DEFAULT_LANGUAGE || 'el'
  },

  technicalSettings: {
    domain: process.env.NEXT_PUBLIC_TENANT_DOMAIN || 'company.local'
  },

  metadata: {
    createdBy: 'system',
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
    isActive: true,
    notes: 'Fallback configuration από environment variables'
  }
};

// ============================================================================
// ENTERPRISE COMPANY SETTINGS SERVICE CLASS
// ============================================================================

export class EnterpriseCompanySettingsService {
  private static instance: EnterpriseCompanySettingsService;
  private settingsCache: Map<string, EnterpriseCompanySettings> = new Map();
  private cacheTimestamp: Map<string, number> = new Map();
  private readonly CACHE_DURATION = 15 * 60 * 1000; // 15 minutes (settings cache longer)

  constructor() {
    if (EnterpriseCompanySettingsService.instance) {
      return EnterpriseCompanySettingsService.instance;
    }
    EnterpriseCompanySettingsService.instance = this;
  }

  // ========================================================================
  // SETTINGS LOADING & MANAGEMENT
  // ========================================================================

  /**
   * 🏢 Load company settings για specific tenant and environment
   */
  async loadCompanySettings(
    tenantId?: string,
    environment?: string
  ): Promise<EnterpriseCompanySettings> {
    try {
      const cacheKey = `${tenantId || 'default'}-${environment || 'default'}`;

      // Check cache first
      if (this.isCacheValid(cacheKey)) {
        console.debug('🚀 Using cached company settings:', cacheKey);
        return this.settingsCache.get(cacheKey)!;
      }

      console.log('🏢 Loading company settings from Firebase...', { tenantId, environment });

      // Try to load από system collection
      let settings = await this.loadFromSystemCollection(tenantId, environment);

      // If not found, try to load από contacts collection (legacy)
      if (!settings) {
        settings = await this.loadFromContactsCollection(tenantId);
      }

      // If still not found, initialize default settings
      if (!settings) {
        console.warn('⚠️ No company settings found, initializing defaults');
        settings = await this.initializeDefaultSettings(tenantId, environment);
      }

      // Cache the results
      this.settingsCache.set(cacheKey, settings);
      this.cacheTimestamp.set(cacheKey, Date.now());

      console.log(`✅ Loaded company settings for tenant: ${tenantId || 'default'}`);
      return settings;

    } catch (error) {
      console.error('❌ Error loading company settings:', error);
      return this.getFallbackSettings(tenantId);
    }
  }

  /**
   * 📥 Load settings από system collection
   */
  private async loadFromSystemCollection(
    tenantId?: string,
    environment?: string
  ): Promise<EnterpriseCompanySettings | null> {
    try {
      // Try tenant-specific document first
      if (tenantId) {
        const tenantDocRef = doc(db, COLLECTIONS.SYSTEM, `company-${tenantId}`);
        const tenantDoc = await getDoc(tenantDocRef);

        if (tenantDoc.exists()) {
          const data = tenantDoc.data();
          if (this.isValidForEnvironment(data, environment)) {
            return { id: tenantDoc.id, ...data } as EnterpriseCompanySettings;
          }
        }
      }

      // Try default company document
      const defaultDocRef = doc(db, COLLECTIONS.SYSTEM,
        process.env.NEXT_PUBLIC_COMPANY_CONFIG_DOC || 'company'
      );
      const defaultDoc = await getDoc(defaultDocRef);

      if (defaultDoc.exists()) {
        const data = defaultDoc.data();
        if (this.isValidForEnvironment(data, environment)) {
          return { id: defaultDoc.id, ...data } as EnterpriseCompanySettings;
        }
      }

      return null;
    } catch (error) {
      console.error('❌ Error loading από system collection:', error);
      return null;
    }
  }

  /**
   * 📥 Load settings από contacts collection (legacy support)
   */
  private async loadFromContactsCollection(tenantId?: string): Promise<EnterpriseCompanySettings | null> {
    try {
      const constraints = [
        where('type', '==', 'company'),
        orderBy('createdAt', 'desc'),
        limit(1)
      ];

      if (tenantId) {
        constraints.unshift(where('tenantId', '==', tenantId));
      }

      const companiesQuery = query(collection(db, COLLECTIONS.CONTACTS), ...constraints);
      const companiesSnapshot = await getDocs(companiesQuery);

      if (!companiesSnapshot.empty) {
        const companyData = companiesSnapshot.docs[0].data();
        return this.convertLegacyContactToSettings(companyData, companiesSnapshot.docs[0].id);
      }

      return null;
    } catch (error) {
      console.error('❌ Error loading από contacts collection:', error);
      return null;
    }
  }

  /**
   * 🔄 Convert legacy contact document to enterprise settings
   */
  private convertLegacyContactToSettings(
    contactData: any,
    contactId: string
  ): EnterpriseCompanySettings {
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
        primaryColor: contactData.brandColor || contactData.primaryColor || '#3b82f6',
        logoUrl: contactData.logo || contactData.logoUrl
      },

      communicationSettings: {
        defaultFromEmail: contactData.defaultFromEmail || contactData.email,
        defaultFromName: contactData.defaultFromName || contactData.companyName || contactData.name,
        phoneFormats: {
          local: '210 000 0000',
          international: '+30 210 000 0000',
          display: '+30 210 000 0000'
        }
      },

      businessSettings: {
        industry: contactData.industry,
        businessType: contactData.businessType || 'corporation',
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

  // ========================================================================
  // QUICK ACCESS METHODS
  // ========================================================================

  /**
   * 📞 Get quick contact information
   */
  async getQuickContact(tenantId?: string): Promise<CompanyQuickContact> {
    const settings = await this.loadCompanySettings(tenantId);

    return {
      name: settings.companyInfo.name,
      email: settings.contactInfo.email,
      phone: settings.contactInfo.phone,
      website: settings.companyInfo.website,
      domain: settings.technicalSettings.domain
    };
  }

  /**
   * 🎨 Get brand information
   */
  async getBrandInfo(tenantId?: string): Promise<CompanyBrandInfo> {
    const settings = await this.loadCompanySettings(tenantId);

    return {
      name: settings.companyInfo.name,
      displayName: settings.companyInfo.displayName || settings.companyInfo.name,
      logo: settings.brandSettings.logoUrl,
      primaryColor: settings.brandSettings.primaryColor,
      secondaryColor: settings.brandSettings.secondaryColor,
      theme: settings.brandSettings.theme
    };
  }

  /**
   * 📧 Get communication template variables
   */
  async getTemplateVariables(tenantId?: string): Promise<Record<string, string>> {
    const settings = await this.loadCompanySettings(tenantId);

    return {
      companyName: settings.companyInfo.name,
      companyDisplayName: settings.companyInfo.displayName || settings.companyInfo.name,
      companyEmail: settings.contactInfo.email,
      companyPhone: settings.contactInfo.phone,
      companyWebsite: settings.companyInfo.website || '',
      companyAddress: `${settings.addressInfo.street}, ${settings.addressInfo.city}`,
      companySupportEmail: settings.contactInfo.supportEmail || settings.contactInfo.email,
      companySalesEmail: settings.contactInfo.salesEmail || settings.contactInfo.email
    };
  }

  // ========================================================================
  // SETTINGS MANAGEMENT
  // ========================================================================

  /**
   * 📝 Update company settings
   */
  async updateCompanySettings(
    updates: Partial<EnterpriseCompanySettings>,
    tenantId?: string
  ): Promise<boolean> {
    try {
      const docId = tenantId ? `company-${tenantId}` : (process.env.NEXT_PUBLIC_COMPANY_CONFIG_DOC || 'company');
      const docRef = doc(db, COLLECTIONS.SYSTEM, docId);

      const updateData = {
        ...updates,
        metadata: {
          ...updates.metadata,
          updatedAt: new Date(),
          version: (updates.metadata?.version || 0) + 1
        }
      };

      await updateDoc(docRef, updateData);

      // Invalidate cache
      this.invalidateCache(tenantId);

      console.log(`✅ Updated company settings: ${docId}`);
      return true;
    } catch (error) {
      console.error(`❌ Error updating company settings:`, error);
      return false;
    }
  }

  /**
   * 🏗️ Initialize default company settings στη Firebase
   */
  async initializeDefaultSettings(
    tenantId?: string,
    environment?: string
  ): Promise<EnterpriseCompanySettings> {
    try {
      console.log('🏗️ Initializing default company settings in Firebase...');

      const settings = {
        ...FALLBACK_COMPANY_SETTINGS,
        tenantId,
        environment: environment || 'all',
        metadata: {
          ...FALLBACK_COMPANY_SETTINGS.metadata,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      };

      const docId = tenantId ? `company-${tenantId}` : (process.env.NEXT_PUBLIC_COMPANY_CONFIG_DOC || 'company');
      const docRef = doc(db, COLLECTIONS.SYSTEM, docId);

      await setDoc(docRef, settings, { merge: true });

      console.log('✅ Default company settings initialized in Firebase');
      return settings;
    } catch (error) {
      console.error('❌ Error initializing default settings:', error);
      return this.getFallbackSettings(tenantId);
    }
  }

  // ========================================================================
  // UTILITIES
  // ========================================================================

  /**
   * 🔄 Get fallback settings
   */
  getFallbackSettings(tenantId?: string): EnterpriseCompanySettings {
    console.log('📋 Using fallback company settings');
    return {
      ...FALLBACK_COMPANY_SETTINGS,
      tenantId
    };
  }

  /**
   * ✅ Check if settings are valid for environment
   */
  private isValidForEnvironment(data: any, environment?: string): boolean {
    if (!environment) return true;

    const dataEnv = data.environment;
    return !dataEnv || dataEnv === 'all' || dataEnv === environment;
  }

  /**
   * ⏰ Check if cache is valid
   */
  private isCacheValid(cacheKey: string): boolean {
    const timestamp = this.cacheTimestamp.get(cacheKey);
    if (!timestamp) return false;

    return (Date.now() - timestamp) < this.CACHE_DURATION;
  }

  /**
   * 🗑️ Invalidate cache
   */
  invalidateCache(tenantId?: string): void {
    if (tenantId) {
      // Clear specific tenant cache
      const keys = Array.from(this.settingsCache.keys()).filter(key => key.includes(tenantId));
      keys.forEach(key => {
        this.settingsCache.delete(key);
        this.cacheTimestamp.delete(key);
      });
    } else {
      // Clear all cache
      this.settingsCache.clear();
      this.cacheTimestamp.clear();
    }

    console.log(`🗑️ Company settings cache invalidated ${tenantId ? `για tenant: ${tenantId}` : '(all)'}`);
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const companySettingsService = new EnterpriseCompanySettingsService();

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * 🏢 Get company name
 */
export async function getCompanyName(tenantId?: string): Promise<string> {
  const settings = await companySettingsService.loadCompanySettings(tenantId);
  return settings.companyInfo.name;
}

/**
 * 📧 Get company email
 */
export async function getCompanyEmail(tenantId?: string): Promise<string> {
  const settings = await companySettingsService.loadCompanySettings(tenantId);
  return settings.contactInfo.email;
}

/**
 * 📞 Get company phone
 */
export async function getCompanyPhone(tenantId?: string): Promise<string> {
  const settings = await companySettingsService.loadCompanySettings(tenantId);
  return settings.contactInfo.phone;
}

/**
 * 🏢 Get company domain
 */
export async function getCompanyDomain(tenantId?: string): Promise<string> {
  const settings = await companySettingsService.loadCompanySettings(tenantId);
  return settings.technicalSettings.domain;
}

/**
 * 📧 Get template variables για communications
 */
export async function getCommunicationTemplateVars(tenantId?: string): Promise<Record<string, string>> {
  return companySettingsService.getTemplateVariables(tenantId);
}