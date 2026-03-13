import type { Contact, CompanyContact, SocialMediaInfo } from '@/types/contacts';
import type { ContactFormData, KadActivity, CompanyAddress } from '@/types/ContactFormTypes';
import { initialFormData } from '@/types/ContactFormTypes';
import { isNonEmptyArray } from '@/lib/type-guards';
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
// HELPERS
// ============================================================================

/**
 * Resolve activities array from Firestore contact.
 * Reads `customFields.activities[]` first; falls back to legacy singular fields.
 */
function resolveActivities(contact: ExtendedCompanyContact): KadActivity[] {
  // Primary: customFields.activities
  const stored = contact.customFields?.activities;
  if (isNonEmptyArray(stored)) {
    return stored as KadActivity[];
  }

  // Secondary fallback: root-level activities (legacy data from EnterpriseContactSaver)
  const rootActivities = (contact as unknown as Record<string, unknown>).activities;
  if (isNonEmptyArray(rootActivities)) {
    return rootActivities as KadActivity[];
  }

  // Tertiary fallback: build from legacy singular fields
  const code = getContactValue(contact, 'activityCodeKAD');
  if (code) {
    return [{
      code,
      description: getContactValue(contact, 'activityDescription'),
      type: 'primary',
    }];
  }

  return [];
}

/**
 * Resolve company addresses from Firestore contact.
 * Reads `customFields.companyAddresses[]` first; falls back to root-level,
 * then Contact.addresses[].
 */
function resolveCompanyAddresses(contact: ExtendedCompanyContact): CompanyAddress[] {
  // Primary: customFields.companyAddresses
  const stored = contact.customFields?.companyAddresses;
  if (isNonEmptyArray(stored)) {
    return stored as CompanyAddress[];
  }

  // Secondary fallback: root-level companyAddresses (legacy data from EnterpriseContactSaver)
  const rootAddresses = (contact as unknown as Record<string, unknown>).companyAddresses;
  if (isNonEmptyArray(rootAddresses)) {
    return rootAddresses as CompanyAddress[];
  }

  // Tertiary fallback: build from Contact.addresses[]
  const contactAddresses = contact.addresses;
  if (isNonEmptyArray(contactAddresses)) {
    return contactAddresses.map((addr, i) => ({
      type: (i === 0 ? 'headquarters' : 'branch') as 'headquarters' | 'branch',
      street: addr.street || '',
      number: addr.number || '',
      postalCode: addr.postalCode || '',
      city: addr.city || '',
      region: addr.region,
    }));
  }

  return [];
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


  const companyAddresses = resolveCompanyAddresses(companyContact);
  // HQ address: prioritize companyAddresses[0] (has hierarchy), fallback to legacy addresses[0]
  const hqAddr = companyAddresses.find(a => a.type === 'headquarters') ?? companyAddresses[0];
  const legacyAddr = contact.addresses?.[0];
  // Root-level flat fields (saved by UnifiedContactTabbedSection)
  const rootRecord = contact as unknown as Record<string, unknown>;

  const formData: ContactFormData = {
    ...initialFormData,
    type: 'company',
    id: contact.id,

    companyName: getSafeFieldValue(companyContact, 'companyName'),
    vatNumber: getSafeFieldValue(companyContact, 'vatNumber'),
    taxOffice: getSafeFieldValue(companyContact, 'taxOffice'),
    companyVatNumber: getSafeFieldValue(companyContact, 'vatNumber') ||
      getSafeFieldValue(companyContact, 'companyVatNumber'),

    street: hqAddr?.street || legacyAddr?.street || '',
    streetNumber: hqAddr?.number || legacyAddr?.number || '',
    city: hqAddr?.city || legacyAddr?.city || '',
    postalCode: hqAddr?.postalCode || legacyAddr?.postalCode || '',
    // Administrative Hierarchy: companyAddresses[0] → root-level flat fields → legacy addresses[0]
    municipality: hqAddr?.municipalityName || (rootRecord.municipality as string) || legacyAddr?.municipality || '',
    municipalityId: hqAddr?.municipalityId ?? (rootRecord.municipalityId as string | null) ?? legacyAddr?.municipalityId ?? null,
    regionalUnit: hqAddr?.regionalUnitName || (rootRecord.regionalUnit as string) || legacyAddr?.regionalUnit || '',
    region: hqAddr?.regionName || hqAddr?.region || (rootRecord.region as string) || legacyAddr?.region || '',
    decentAdmin: hqAddr?.decentAdminName || (rootRecord.decentAdmin as string) || legacyAddr?.decentAdmin || '',
    majorGeo: hqAddr?.majorGeoName || (rootRecord.majorGeo as string) || legacyAddr?.majorGeo || '',
    settlement: hqAddr?.city || (rootRecord.settlement as string) || legacyAddr?.settlement || '',
    settlementId: hqAddr?.settlementId ?? (rootRecord.settlementId as string | null) ?? legacyAddr?.settlementId ?? null,
    community: hqAddr?.communityName || (rootRecord.community as string) || legacyAddr?.community || '',
    municipalUnit: hqAddr?.municipalUnitName || (rootRecord.municipalUnit as string) || legacyAddr?.municipalUnit || '',
    companyAddresses,
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
    activities: resolveActivities(companyContact),
    activityValidFrom: getContactValue(companyContact, 'activityValidFrom'),
    activityValidTo: getContactValue(companyContact, 'activityValidTo'),
    capitalAmount: getContactValue(companyContact, 'capitalAmount'),
    currency: getContactValue(companyContact, 'currency'),
    extraordinaryCapital: getContactValue(companyContact, 'extraordinaryCapital')
  };


  return formData;
}
