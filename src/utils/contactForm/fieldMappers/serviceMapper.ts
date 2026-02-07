import type { Contact, SocialMediaInfo } from '@/types/contacts';
import type { ContactFormData } from '@/types/ContactFormTypes';
import { initialFormData } from '@/types/ContactFormTypes';
import { getSafeFieldValue, getSafeArrayValue, getSafeNestedValue } from '../contactMapper';

// ============================================================================
// SERVICE CONTACT MAPPER
// ============================================================================

/**
 * Map Service Contact to ContactFormData
 *
 * Specialized mapper για δημόσιες υπηρεσίες (services).
 * Χειρίζεται όλα τα service-specific fields με type safety.
 *
 * @param contact - Service contact object
 * @returns ContactFormData for service
 */
export function mapServiceContactToFormData(contact: Contact): ContactFormData {

  // Cast for service-specific field access using type-safe approach
  const serviceContact = contact as unknown as Record<string, unknown>;
  const socialMediaFallback = ('socialMedia' in contact && Array.isArray(contact.socialMedia))
    ? (contact.socialMedia as SocialMediaInfo[])
    : [];

  // 🔍 QUICK FIX: Find email/phone/website from any possible location
  const contactRecord = contact as unknown as Record<string, unknown>;

  // Try multiple sources for email
  const foundEmail = contact.emails?.[0]?.email ||
                    (contactRecord.email as string) ||
                    (contactRecord.contactEmail as string) ||
                    (contactRecord.officialEmail as string) || '';

  // Try multiple sources for phone
  const foundPhone = contact.phones?.[0]?.number ||
                    (contactRecord.phone as string) ||
                    (contactRecord.telephone as string) ||
                    (contactRecord.centralPhone as string) || '';

  // Try multiple sources for website
  const foundWebsite = (contactRecord.website as string) ||
                      (contactRecord.officialWebsite as string) ||
                      (contactRecord.url as string) || '';

  console.log('🔧 QUICK FIX - FOUND DATA:', {
    contactId: contact.id,
    contactType: contact.type,
    foundEmail,
    foundPhone,
    foundWebsite,
    rawContact: JSON.stringify(contactRecord, null, 2)
  });

  const formData: ContactFormData = {
    ...initialFormData,
    type: 'service',
    id: contact.id,

    serviceName: getSafeFieldValue(serviceContact, 'serviceName'),
    name: getSafeFieldValue(serviceContact, 'serviceName'),
    serviceType: getSafeFieldValue(serviceContact, 'serviceType', 'other'),
    shortName: getSafeFieldValue(serviceContact, 'shortName'),
    category: getSafeFieldValue(serviceContact, 'category'),
    supervisionMinistry: getSafeFieldValue(serviceContact, 'supervisionMinistry'),
    legalStatus: getSafeFieldValue(serviceContact, 'legalStatus'),
    establishmentLaw: getSafeFieldValue(serviceContact, 'establishmentLaw'),
    headTitle: getSafeFieldValue(serviceContact, 'headTitle'),
    headName: getSafeFieldValue(serviceContact, 'headName'),

    email: foundEmail,
    phone: foundPhone,

    photoFile: null,
    photoPreview: getSafeFieldValue(serviceContact, 'photoURL'),
    photoURL: getSafeFieldValue(serviceContact, 'photoURL'),
    logoFile: null,
    logoPreview: getSafeFieldValue(serviceContact, 'logoURL'),
    logoURL: getSafeFieldValue(serviceContact, 'logoURL'),

    gemiNumber: getSafeFieldValue(serviceContact, 'gemiNumber'),
    serviceVatNumber: getSafeFieldValue(serviceContact, 'serviceVatNumber'),
    serviceTaxOffice: getSafeFieldValue(serviceContact, 'serviceTaxOffice'),
    serviceTitle: getSafeFieldValue(serviceContact, 'serviceTitle'),
    tradeName: getSafeFieldValue(serviceContact, 'tradeName'),
    legalForm: getSafeFieldValue(serviceContact, 'legalForm'),
    gemiStatus: getSafeFieldValue(serviceContact, 'gemiStatus'),
    gemiStatusDate: getSafeFieldValue(serviceContact, 'gemiStatusDate'),
    chamber: getSafeFieldValue(serviceContact, 'chamber'),
    isBranch: getSafeFieldValue(serviceContact, 'isBranch', false),
    registrationMethod: getSafeFieldValue(serviceContact, 'registrationMethod'),
    registrationDate: getSafeFieldValue(serviceContact, 'registrationDate'),
    lastUpdateDate: getSafeFieldValue(serviceContact, 'lastUpdateDate'),
    gemiDepartment: getSafeFieldValue(serviceContact, 'gemiDepartment'),
    prefecture: getSafeFieldValue(serviceContact, 'prefecture'),
    municipality: getSafeFieldValue(serviceContact, 'municipality'),
    activityCodeKAD: getSafeFieldValue(serviceContact, 'activityCodeKAD'),
    activityDescription: getSafeFieldValue(serviceContact, 'activityDescription'),
    activityType: getSafeFieldValue(serviceContact, 'activityType', 'main'),
    activityValidFrom: getSafeFieldValue(serviceContact, 'activityValidFrom'),
    activityValidTo: getSafeFieldValue(serviceContact, 'activityValidTo'),
    capitalAmount: getSafeFieldValue(serviceContact, 'capitalAmount'),
    currency: getSafeFieldValue(serviceContact, 'currency'),
    extraordinaryCapital: getSafeFieldValue(serviceContact, 'extraordinaryCapital'),
    serviceCode: getSafeFieldValue(serviceContact, 'serviceCode'),
    parentMinistry: getSafeFieldValue(serviceContact, 'parentMinistry'),
    serviceCategory: getSafeFieldValue(serviceContact, 'serviceCategory'),
    officialWebsite: getSafeFieldValue(serviceContact, 'officialWebsite'),

    street: contact.addresses?.[0]?.street || '',
    streetNumber: contact.addresses?.[0]?.number || '',
    city: contact.addresses?.[0]?.city || '',
    postalCode: contact.addresses?.[0]?.postalCode || '',
    fax: getSafeFieldValue(serviceContact, 'fax'),
    website: contact.websites?.[0]?.url || foundWebsite,

    mainResponsibilities: getSafeFieldValue(serviceContact, 'mainResponsibilities'),
    citizenServices: getSafeFieldValue(serviceContact, 'citizenServices'),
    onlineServices: getSafeFieldValue(serviceContact, 'onlineServices'),
    serviceHours: getSafeFieldValue(serviceContact, 'serviceHours'),

    serviceAddress: {
      street: getSafeNestedValue(serviceContact, 'serviceAddress.street'),
      number: getSafeNestedValue(serviceContact, 'serviceAddress.number'),
      postalCode: getSafeNestedValue(serviceContact, 'serviceAddress.postalCode'),
      city: getSafeNestedValue(serviceContact, 'serviceAddress.city')
    },

    representatives: getSafeArrayValue(serviceContact, 'representatives'),
    shareholders: getSafeArrayValue(serviceContact, 'shareholders'),
    branches: getSafeArrayValue(serviceContact, 'branches'),
    documents: getSafeFieldValue(serviceContact, 'documents', {
      announcementDocs: [],
      registrationDocs: []
    }),
    decisions: getSafeArrayValue(serviceContact, 'decisions'),
    announcements: getSafeArrayValue(serviceContact, 'announcements'),

    notes: getSafeFieldValue(contact, 'notes'),

    phones: contact.phones ?? [],
    emails: contact.emails ?? [],
    websites: contact.websites ?? [],
    socialMediaArray: contact.socialMediaArray ?? socialMediaFallback,

    multiplePhotos: getSafeFieldValue(serviceContact, 'logoURL') ?
      [
        {
          file: null,
          preview: undefined,
          uploadUrl: getSafeFieldValue(serviceContact, 'logoURL'),
          isUploading: false,
          uploadProgress: 0,
          error: undefined
        }
      ] : []
  };

  // 🔍 DEBUG: Final formData values for clickable fields
  console.log('🔍 SERVICE MAPPER FINAL RESULT:', {
    email: formData.email,
    phone: formData.phone,
    website: formData.website,
    serviceName: formData.serviceName,
    id: formData.id
  });

  return formData;
}
