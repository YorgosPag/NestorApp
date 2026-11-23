import type { Contact, CompanyContact, SocialMediaInfo } from '@/types/contacts';
import type { ContactFormData, KadActivity } from '@/types/ContactFormTypes';
import { initialFormData, toLegacyKadActivityType } from '@/types/ContactFormTypes';
import { isNonEmptyArray } from '@/lib/type-guards';
import { canonicalLegalForm } from '@/lib/contact/legal-form-vocabulary';
import { getSafeFieldValue } from '../contactMapper';
// ADR-332 D18: η ανάγνωση της λίστας διευθύνσεων ζει σε ΕΝΑ σημείο και για τα
// τρία είδη επαφής — ήταν ιδιωτική εδώ, ενώ individual/service δεν είχαν καμία.
import { resolveContactAddresses } from '@/utils/contacts/contact-addresses-reader';
import { readCompanyScalarFields } from '../schema/company-field-schema';

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


  // ADR-332 §D30 Φάση 2: η έδρα ΕΙΝΑΙ η θέση 0 της λίστας — η φόρμα δεν κρατά δεύτερο αντίγραφο.
  const companyAddresses = resolveContactAddresses(contact, 'company');
  const rootRecord = contact as unknown as Record<string, unknown>;
  // ADR-332 §D30: ΚΑΘΕ βαθμωτό πεδίο από τον ΕΝΑ πίνακα (εκεί ζει και η Δ.Ο.Υ.).
  const scalars = readCompanyScalarFields(rootRecord);

  const formData: ContactFormData = {
    ...initialFormData,
    type: 'company',
    id: contact.id,

    ...scalars,
    // ADR-948 §8 — ανεκτική ανάγνωση: παλιό `AE`/`ΑΕ` ⇒ `ae`, ώστε το select να δείχνει την επιλογή και η επόμενη
    // αποθήκευση να γράψει τον κωδικό της ρίζας (αυτο-θεραπεία). Άγνωστη τιμή ⇒ κενό, ποτέ μαντεψιά.
    legalForm: canonicalLegalForm(scalars.legalForm) ?? '',
    activityType: toLegacyKadActivityType(scalars.activityType),
    companyVatNumber: getSafeFieldValue(companyContact, 'vatNumber') ||
      getSafeFieldValue(companyContact, 'companyVatNumber'),

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

    activities: resolveActivities(companyContact),
    activityValidFrom: getContactValue(companyContact, 'activityValidFrom'),
    activityValidTo: getContactValue(companyContact, 'activityValidTo'),
  };


  return formData;
}
