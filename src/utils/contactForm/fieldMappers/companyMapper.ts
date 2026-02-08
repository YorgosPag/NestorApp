import type { Contact, CompanyContact, SocialMediaInfo } from '@/types/contacts';
import type { ContactFormData } from '@/types/ContactFormTypes';
import { initialFormData } from '@/types/ContactFormTypes';
import { getSafeFieldValue } from '../contactMapper';

/** Extended company contact with custom fields access */
interface ExtendedCompanyContact extends CompanyContact {
  customFields?: Record<string, unknown>;
}

/**
 * Get value from contact object or customFields
 * Tries root level first, then customFields
 */
function getContactValue(contact: ExtendedCompanyContact, fieldName: string): string {
  // Try root level first
  const rootValue = getSafeFieldValue<string>(contact, fieldName, '');
  if (rootValue) return rootValue;

  // Try customFields
  const customValue = contact.customFields?.[fieldName];
  return typeof customValue === 'string' ? customValue : '';
}

// ============================================================================
// COMPANY CONTACT MAPPER
// ============================================================================

/**
 * Map Company Contact to ContactFormData
 *
 * Specialized mapper για εταιρείες (companies).
 * Χειρίζεται όλα τα company-specific fields με type safety.
 *
 * @param contact - Company contact object
 * @returns ContactFormData for company
 */
export function mapCompanyContactToFormData(contact: Contact): ContactFormData {
  // Type-safe cast for company fields access
  const companyContact = contact as ExtendedCompanyContact;
  const socialMediaFallback = ('socialMedia' in contact && Array.isArray(contact.socialMedia))
    ? (contact.socialMedia as SocialMediaInfo[])
    : [];


  const formData: ContactFormData = {
    ...initialFormData,
    type: 'company',
    id: contact.id,

    companyName: getSafeFieldValue(companyContact, 'companyName'),
    vatNumber: getSafeFieldValue(companyContact, 'vatNumber'),
    companyVatNumber: getSafeFieldValue(companyContact, 'vatNumber') ||
      getSafeFieldValue(companyContact, 'companyVatNumber'),

    street: contact.addresses?.[0]?.street || '',
    streetNumber: contact.addresses?.[0]?.number || '',
    city: contact.addresses?.[0]?.city || '',
    postalCode: contact.addresses?.[0]?.postalCode || '',
    phone: contact.phones?.[0]?.number || '',
    email: contact.emails?.[0]?.email || '',
    website: contact.websites?.[0]?.url || '',

    phones: contact.phones ?? [],
    emails: contact.emails ?? [],
    websites: contact.websites ?? [],
    socialMediaArray: contact.socialMediaArray ?? socialMediaFallback,

    logoFile: null,
    logoPreview: getSafeFieldValue(companyContact, 'logoURL'),
    logoURL: getSafeFieldValue(companyContact, 'logoURL'),

    photoFile: null,
    photoPreview: getSafeFieldValue(companyContact, 'photoURL'),
    photoURL: getSafeFieldValue(companyContact, 'photoURL'),

    notes: getSafeFieldValue(contact, 'notes'),

    gemiNumber: getContactValue(companyContact, 'gemiNumber') || getContactValue(companyContact, 'registrationNumber'),
    tradeName: getContactValue(companyContact, 'tradeName'),
    legalForm: (getContactValue(companyContact, 'legalForm') as CompanyContact['legalForm']) || '',
    gemiStatus: getContactValue(companyContact, 'gemiStatus'),
    gemiStatusDate: getContactValue(companyContact, 'gemiStatusDate'),
    chamber: getContactValue(companyContact, 'chamber'),
    activityCodeKAD: getContactValue(companyContact, 'activityCodeKAD'),
    activityDescription: getContactValue(companyContact, 'activityDescription'),
    activityType: (getContactValue(companyContact, 'activityType') as 'main' | 'secondary') || 'main',
    activityValidFrom: getContactValue(companyContact, 'activityValidFrom'),
    activityValidTo: getContactValue(companyContact, 'activityValidTo'),
    capitalAmount: getContactValue(companyContact, 'capitalAmount'),
    currency: getContactValue(companyContact, 'currency'),
    extraordinaryCapital: getContactValue(companyContact, 'extraordinaryCapital')
  };


  return formData;
}
