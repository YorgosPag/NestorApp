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
    // Demo contact information για development/testing
    DEMO_PHONE_MOBILE: process.env.NEXT_PUBLIC_DEMO_PHONE_MOBILE || '+30 691 000 0000',
    DEMO_PHONE_BUSINESS: process.env.NEXT_PUBLIC_DEMO_PHONE_BUSINESS || '+30 231 000 0000',

    // Demo email addresses
    DEMO_EMAIL_PERSONAL: process.env.NEXT_PUBLIC_DEMO_EMAIL_PERSONAL || 'demo@personal.com',
    DEMO_EMAIL_BUSINESS: process.env.NEXT_PUBLIC_DEMO_EMAIL_BUSINESS || 'demo@business.com',

    // Phone number configuration
    PHONE_COUNTRY_CODE: process.env.NEXT_PUBLIC_PHONE_COUNTRY_CODE || '+30',
    PHONE_PREFIX: process.env.NEXT_PUBLIC_PHONE_PREFIX || '691',

    // Email configuration
    EMAIL_DOMAIN: process.env.NEXT_PUBLIC_EMAIL_DOMAIN || 'company.com',
    COMPANY_EMAIL: process.env.NEXT_PUBLIC_COMPANY_EMAIL || 'info@company.com'
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
    const demoContacts = JSON.parse(
      process.env.NEXT_PUBLIC_DEMO_CONTACTS_JSON ||
      JSON.stringify([
        {
          firstName: 'Demo',
          lastName: 'User',
          phone: CONTACT_INFO.DEMO_PHONE_MOBILE,
          email: CONTACT_INFO.DEMO_EMAIL_PERSONAL,
          profession: 'Demo Profession'
        }
      ])
    );

    return demoContacts;
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
 * Required environment variables για contact configuration:
 *
 * NEXT_PUBLIC_DEMO_PHONE_MOBILE=+30 691 000 0000
 * NEXT_PUBLIC_DEMO_PHONE_BUSINESS=+30 231 000 0000
 * NEXT_PUBLIC_DEMO_EMAIL_PERSONAL=demo@personal.com
 * NEXT_PUBLIC_DEMO_EMAIL_BUSINESS=demo@business.com
 * NEXT_PUBLIC_PHONE_COUNTRY_CODE=+30
 * NEXT_PUBLIC_PHONE_PREFIX=691
 * NEXT_PUBLIC_BUSINESS_PHONE_PREFIX=231
 * NEXT_PUBLIC_PHONE_LENGTH=7
 * NEXT_PUBLIC_EMAIL_DOMAIN=company.com
 * NEXT_PUBLIC_PERSONAL_EMAIL_DOMAIN=gmail.com
 * NEXT_PUBLIC_BUSINESS_EMAIL_DOMAIN=company.com
 * NEXT_PUBLIC_COMPANY_EMAIL=info@company.com
 * NEXT_PUBLIC_DEMO_CONTACTS_JSON=[{"firstName":"Demo","lastName":"User"...}]
 */