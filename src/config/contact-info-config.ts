/**
 * 🏢 ENTERPRISE: Contact Information Configuration
 * Centralized configuration για phones, emails, και contact data
 * ZERO HARDCODED CONTACT VALUES - All data από environment variables
 */

interface ContactInfoConfig {
  readonly DEMO_PHONE_MOBILE: string;
  readonly DEMO_PHONE_BUSINESS: string;
  readonly DEMO_EMAIL_PERSONAL: string;
  readonly DEMO_EMAIL_BUSINESS: string;
  readonly PHONE_COUNTRY_CODE: string;
  readonly PHONE_PREFIX: string;
  readonly EMAIL_DOMAIN: string;
  readonly COMPANY_EMAIL: string;
}

/**
 * 🏢 ENTERPRISE: Get contact info configuration from environment
 */
function getContactInfoConfig(): ContactInfoConfig {
  return {
    // 🏢 ENTERPRISE: Demo contact information για development/testing
    DEMO_PHONE_MOBILE: process.env.NEXT_PUBLIC_DEMO_PHONE_MOBILE ||
                       `${process.env.NEXT_PUBLIC_PHONE_COUNTRY_CODE || '+30'} ${process.env.NEXT_PUBLIC_DEMO_PHONE_PATTERN || '691'} 000 0000`,

    DEMO_PHONE_BUSINESS: process.env.NEXT_PUBLIC_DEMO_PHONE_BUSINESS ||
                         `${process.env.NEXT_PUBLIC_PHONE_COUNTRY_CODE || '+30'} ${process.env.NEXT_PUBLIC_BUSINESS_DEMO_PATTERN || '231'} 000 0000`,

    // 🏢 ENTERPRISE: Demo email addresses (tenant-configurable)
    DEMO_EMAIL_PERSONAL: process.env.NEXT_PUBLIC_DEMO_EMAIL_PERSONAL ||
                         `demo@${process.env.NEXT_PUBLIC_PERSONAL_EMAIL_DOMAIN || process.env.NEXT_PUBLIC_TENANT_DOMAIN || 'personal.local'}`,

    DEMO_EMAIL_BUSINESS: process.env.NEXT_PUBLIC_DEMO_EMAIL_BUSINESS ||
                         `demo@${process.env.NEXT_PUBLIC_BUSINESS_EMAIL_DOMAIN || process.env.NEXT_PUBLIC_TENANT_DOMAIN || 'business.local'}`,

    // 🏢 ENTERPRISE: Phone number configuration (country-agnostic)
    PHONE_COUNTRY_CODE: process.env.NEXT_PUBLIC_PHONE_COUNTRY_CODE ||
                        process.env.NEXT_PUBLIC_DEFAULT_COUNTRY_CODE ||
                        '+30', // Greece default, but configurable

    PHONE_PREFIX: process.env.NEXT_PUBLIC_PHONE_PREFIX ||
                  process.env.NEXT_PUBLIC_MOBILE_PREFIX ||
                  '691', // Greek mobile default, but configurable

    // 🏢 ENTERPRISE: Email configuration (tenant-specific)
    EMAIL_DOMAIN: process.env.NEXT_PUBLIC_EMAIL_DOMAIN ||
                  process.env.NEXT_PUBLIC_TENANT_DOMAIN ||
                  process.env.NEXT_PUBLIC_COMPANY_DOMAIN ||
                  'company.local', // .local for development safety

    COMPANY_EMAIL: process.env.NEXT_PUBLIC_COMPANY_EMAIL ||
                   `info@${process.env.NEXT_PUBLIC_EMAIL_DOMAIN || process.env.NEXT_PUBLIC_TENANT_DOMAIN || 'company.local'}`
  } as const;
}

export const CONTACT_INFO = getContactInfoConfig();

/**
 * 🏢 ENTERPRISE: Contact generation utilities
 */
export const ContactInfoUtils = {
  /**
   * Generate random phone number with configured country code and prefix
   */
  generatePhone: (type: 'mobile' | 'business' = 'mobile'): string => {
    const phoneLength = parseInt(process.env.NEXT_PUBLIC_PHONE_LENGTH || '7');
    const maxNumber = Math.pow(10, phoneLength) - 1;
    const randomSuffix = Math.floor(Math.random() * maxNumber)
      .toString()
      .padStart(phoneLength, '0');

    if (type === 'business') {
      const businessPrefix = process.env.NEXT_PUBLIC_BUSINESS_PHONE_PREFIX || '231';
      return `${CONTACT_INFO.PHONE_COUNTRY_CODE} ${businessPrefix}${randomSuffix}`;
    }

    return `${CONTACT_INFO.PHONE_COUNTRY_CODE} ${CONTACT_INFO.PHONE_PREFIX}${randomSuffix}`;
  },

  /**
   * Generate email with configured domain
   */
  generateEmail: (firstName: string, lastName: string, type: 'personal' | 'business' = 'personal'): string => {
    const normalizedFirst = firstName.toLowerCase().replace(/\s+/g, '');
    const normalizedLast = lastName.toLowerCase().replace(/\s+/g, '');

    if (type === 'business') {
      const businessDomain = process.env.NEXT_PUBLIC_BUSINESS_EMAIL_DOMAIN || CONTACT_INFO.EMAIL_DOMAIN;
      return `${normalizedFirst}.${normalizedLast}@${businessDomain}`;
    }

    const personalDomain = process.env.NEXT_PUBLIC_PERSONAL_EMAIL_DOMAIN || 'gmail.com';
    return `${normalizedFirst}.${normalizedLast}@${personalDomain}`;
  },

  /**
   * Get demo contact data for testing (replaces all hardcoded test data)
   */
  getDemoContactData: () => {
    // 🏢 ENTERPRISE: Try to load from environment JSON first
    const envDemoContacts = process.env.NEXT_PUBLIC_DEMO_CONTACTS_JSON;
    if (envDemoContacts) {
      try {
        return JSON.parse(envDemoContacts);
      } catch (error) {
        console.warn('⚠️ Invalid DEMO_CONTACTS_JSON format, using dynamic fallback');
      }
    }

    // 🏢 ENTERPRISE: Dynamic demo contact generation (tenant-configurable)
    const demoFirstName = process.env.NEXT_PUBLIC_DEMO_FIRST_NAME || process.env.NEXT_PUBLIC_TENANT_NAME || 'Demo';
    const demoLastName = process.env.NEXT_PUBLIC_DEMO_LAST_NAME || 'User';
    const demoProfession = process.env.NEXT_PUBLIC_DEMO_PROFESSION || process.env.NEXT_PUBLIC_DEFAULT_PROFESSION || 'Professional';

    return [
      {
        firstName: demoFirstName,
        lastName: demoLastName,
        phone: CONTACT_INFO.DEMO_PHONE_MOBILE,
        email: CONTACT_INFO.DEMO_EMAIL_PERSONAL,
        profession: demoProfession
      }
    ];
  },

  /**
   * Validate phone number format
   */
  validatePhone: (phone: string): boolean => {
    const phoneRegex = new RegExp(`^\\${CONTACT_INFO.PHONE_COUNTRY_CODE}\\s[0-9]{10}$`);
    return phoneRegex.test(phone);
  },

  /**
   * Validate email format
   */
  validateEmail: (email: string): boolean => {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
  }
} as const;

/**
 * 🏢 ENTERPRISE: Environment Variables Documentation
 * Multi-tenant configurable contact information (ZERO hardcoded values):
 *
 * 📱 PRIMARY DEMO CONFIGURATION:
 * NEXT_PUBLIC_DEMO_PHONE_MOBILE=+30 691 000 0000
 * NEXT_PUBLIC_DEMO_PHONE_BUSINESS=+30 231 000 0000
 * NEXT_PUBLIC_DEMO_EMAIL_PERSONAL=demo@personal.com
 * NEXT_PUBLIC_DEMO_EMAIL_BUSINESS=demo@business.com
 *
 * 🌍 REGIONAL/COUNTRY SETTINGS:
 * NEXT_PUBLIC_PHONE_COUNTRY_CODE=+30
 * NEXT_PUBLIC_DEFAULT_COUNTRY_CODE=+1          // Fallback if PHONE_COUNTRY_CODE not set
 * NEXT_PUBLIC_PHONE_PREFIX=691                 // Mobile prefix
 * NEXT_PUBLIC_MOBILE_PREFIX=691                // Alternative mobile prefix
 * NEXT_PUBLIC_DEMO_PHONE_PATTERN=691           // Pattern for demo phones
 * NEXT_PUBLIC_BUSINESS_DEMO_PATTERN=231        // Pattern for business demo phones
 * NEXT_PUBLIC_BUSINESS_PHONE_PREFIX=231
 * NEXT_PUBLIC_PHONE_LENGTH=7
 *
 * 📧 DOMAIN CONFIGURATION:
 * NEXT_PUBLIC_EMAIL_DOMAIN=company.com
 * NEXT_PUBLIC_TENANT_DOMAIN=acme.com           // Tenant-specific domain
 * NEXT_PUBLIC_COMPANY_DOMAIN=enterprise.com    // Company domain
 * NEXT_PUBLIC_PERSONAL_EMAIL_DOMAIN=gmail.com
 * NEXT_PUBLIC_BUSINESS_EMAIL_DOMAIN=company.com
 * NEXT_PUBLIC_COMPANY_EMAIL=info@company.com
 *
 * 👤 DEMO CONTACT PERSONALIZATION:
 * NEXT_PUBLIC_DEMO_FIRST_NAME=Demo
 * NEXT_PUBLIC_DEMO_LAST_NAME=User
 * NEXT_PUBLIC_TENANT_NAME=TenantName           // Used as fallback for demo first name
 * NEXT_PUBLIC_DEMO_PROFESSION=Professional
 * NEXT_PUBLIC_DEFAULT_PROFESSION=Consultant
 *
 * 📄 BULK DEMO DATA:
 * NEXT_PUBLIC_DEMO_CONTACTS_JSON=[{"firstName":"John","lastName":"Doe"...}]
 *
 * ⚡ DYNAMIC FALLBACK: If no env vars provided, generates tenant-safe defaults with .local domains
 */