import type { Contact, IndividualContact } from '@/types/contacts';
import { isIndividualContact } from '@/types/contacts';
import type { ContactFormData } from '@/types/ContactFormTypes';
import { initialFormData } from '@/types/ContactFormTypes';
import type { PhotoSlot } from '@/components/ui/MultiplePhotosUpload';
import { getSafeFieldValue, getSafeArrayValue } from '../contactMapper';
// 🎭 ENTERPRISE: Contact Persona System (ADR-121)
import type { PersonaType, PersonaData } from '@/types/contacts/personas';
import { getPersonaFields } from '@/config/persona-config';

import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('IndividualMapper');

// ============================================================================
// INDIVIDUAL CONTACT MAPPER
// ============================================================================

/**
 * Map Individual Contact to ContactFormData
 *
 * Specialized mapper για φυσικά πρόσωπα (individuals).
 * Χειρίζεται όλα τα individual-specific fields με type safety.
 *
 * @param contact - Individual contact object
 * @returns ContactFormData for individual
 */
export function mapIndividualContactToFormData(contact: Contact): ContactFormData {

  logger.info('INDIVIDUAL MAPPER: Starting mapping for contact', { contactId: contact.id });

  // 🏢 ENTERPRISE: Type-safe access to individual contact fields
  if (!isIndividualContact(contact)) {
    logger.warn('INDIVIDUAL MAPPER: Contact is not an individual, returning minimal form data');
    return {
      ...initialFormData,
      type: contact.type,
      id: contact.id
    };
  }

  const individualContact: IndividualContact = contact;

  // 📸 MULTIPLE PHOTOS - ENTERPRISE SOLUTION (2025 STANDARD)
  const rawUrls = getSafeArrayValue(individualContact, 'multiplePhotoURLs') || [];

  logger.info('INDIVIDUAL MAPPER: rawUrls from database', { rawUrls });

  // 🚨 CRITICAL FIX - ΜΗ ΑΛΛΑΞΕΙΣ ΑΥΤΗ ΤΗ ΛΟΓΙΚΗ! 🚨
  // BUG HISTORY: Πριν από αυτή τη διόρθωση, το filtering αφαίρεσε κενά arrays
  // ΠΡΟΒΛΗΜΑ: Τα κενά arrays δεν έφταναν ποτέ στη βάση δεδομένων
  // ΛΥΣΗ: Explicit handling για empty arrays ώστε να διαγράφονται οι φωτογραφίες
  // TESTED: 2025-12-04 - Επιτυχής διόρθωση μετά από 5+ ώρες debugging
  // 🔥 ΚΡΙΣΙΜΗ ΔΙΟΡΘΩΣΗ: Preserve empty arrays for proper database deletion
  let multiplePhotos: PhotoSlot[] = [];

  if (rawUrls.length === 0) {
    // ✅ ΚΕΝΟ ARRAY: Κρατάμε κενό για proper deletion στη βάση
    multiplePhotos = [];
    logger.info('INDIVIDUAL MAPPER: Empty photos array - will delete from database');
    logger.info('INDIVIDUAL MAPPER: Also clearing photoURL field for complete deletion');
  } else {
    // ✅ ΥΠΑΡΧΟΥΝ ΦΩΤΟΓΡΑΦΙΕΣ: Normal processing
    multiplePhotos = rawUrls
      // Βήμα 1: Κρατάμε ΜΟΝΟ strings
      .filter((url): url is string => typeof url === 'string')
      // Βήμα 2: Αφαιρούμε blob URLs και invalid formats (αλλά ΟΧΙ κενά strings)
      .filter(url => {
        const trimmed = url.trim();
        return trimmed !== '' &&
               !trimmed.startsWith('blob:') &&
               (trimmed.startsWith('data:') || trimmed.startsWith('https://'));
      })
      // Βήμα 3: Μετατρέπουμε σε PhotoSlot με απόλυτη ασφάλεια
      .map(url => ({
        preview: url.trim(),
        uploadUrl: url.trim(),
        isUploading: false,
        error: undefined,
        file: null
      }));
  }


  // 🎭 ENTERPRISE: Extract persona data from contact (ADR-121)
  const rawPersonas = getSafeArrayValue<PersonaData>(individualContact, 'personas');
  console.log('🎭 MAPPER PERSONA DEBUG', {
    rawPersonasCount: rawPersonas.length,
    rawPersonas: rawPersonas.map(p => ({ type: p?.personaType, status: p?.status })),
    hasPersonasField: 'personas' in individualContact,
  });
  const activePersonas: PersonaType[] = rawPersonas
    .filter(p => p && p.status === 'active')
    .map(p => p.personaType);

  const personaData: Partial<Record<PersonaType, Record<string, string | number | null>>> = {};
  for (const persona of rawPersonas.filter(p => p && p.status === 'active')) {
    // Use persona field config as SSoT to extract only role-specific fields
    const fieldConfigs = getPersonaFields(persona.personaType);
    const fields: Record<string, string | number | null> = {};
    const personaRecord = persona as unknown as Record<string, unknown>;

    for (const config of fieldConfigs) {
      const raw = personaRecord[config.id];
      fields[config.id] = (typeof raw === 'string' || typeof raw === 'number') ? raw : null;
    }

    personaData[persona.personaType] = fields;
  }

  const formData: ContactFormData = {
    ...initialFormData,
    // Basic info
    type: contact.type,
    id: contact.id, // 🔥 CRITICAL FIX: Include contact ID for relationship management

    // 👤 Βασικά Στοιχεία Φυσικού Προσώπου
    firstName: getSafeFieldValue(individualContact, 'firstName'),
    lastName: getSafeFieldValue(individualContact, 'lastName'),
    fatherName: getSafeFieldValue(individualContact, 'fatherName'),
    motherName: getSafeFieldValue(individualContact, 'motherName'),
    birthDate: getSafeFieldValue(individualContact, 'birthDate'),
    birthCountry: getSafeFieldValue(individualContact, 'birthCountry'),
    gender: getSafeFieldValue(individualContact, 'gender'),
    amka: getSafeFieldValue(individualContact, 'amka'),

    // 💳 Ταυτότητα & ΑΦΜ
    documentType: getSafeFieldValue(individualContact, 'documentType'),
    documentIssuer: getSafeFieldValue(individualContact, 'documentIssuer'),
    documentNumber: getSafeFieldValue(individualContact, 'documentNumber'),
    documentIssueDate: getSafeFieldValue(individualContact, 'documentIssueDate'),
    documentExpiryDate: getSafeFieldValue(individualContact, 'documentExpiryDate'),
    vatNumber: getSafeFieldValue(individualContact, 'vatNumber'),
    taxOffice: getSafeFieldValue(individualContact, 'taxOffice'),

    // 💼 Επαγγελματικά Στοιχεία
    profession: getSafeFieldValue(individualContact, 'profession'),
    specialty: getSafeFieldValue(individualContact, 'specialty'),
    employer: getSafeFieldValue(individualContact, 'employer'),
    // 🏢 ENTERPRISE: Employer Entity Linking (ADR-177)
    employerId: getSafeFieldValue(individualContact, 'employerId'),
    position: getSafeFieldValue(individualContact, 'position'),
    workAddress: getSafeFieldValue(individualContact, 'workAddress'),
    workWebsite: getSafeFieldValue(individualContact, 'workWebsite'),
    // 🇪🇺 ESCO Professional Classification (ADR-034)
    escoUri: getSafeFieldValue(individualContact, 'escoUri'),
    escoLabel: getSafeFieldValue(individualContact, 'escoLabel'),
    iscoCode: getSafeFieldValue(individualContact, 'iscoCode'),
    // 🇪🇺 ESCO Skills (ADR-132)
    escoSkills: individualContact.escoSkills ?? [],

    // 📞 Επικοινωνία - ENTERPRISE Arrays Structure
    street: contact.addresses?.[0]?.street || '',
    streetNumber: contact.addresses?.[0]?.number || '',
    city: contact.addresses?.[0]?.city || '',
    postalCode: contact.addresses?.[0]?.postalCode || '',
    // Administrative Hierarchy from addresses[0]
    municipality: contact.addresses?.[0]?.municipality || '',
    municipalityId: contact.addresses?.[0]?.municipalityId ?? null,
    regionalUnit: contact.addresses?.[0]?.regionalUnit || '',
    region: contact.addresses?.[0]?.region || '',
    decentAdmin: contact.addresses?.[0]?.decentAdmin || '',
    majorGeo: contact.addresses?.[0]?.majorGeo || '',
    settlement: contact.addresses?.[0]?.settlement || '',
    settlementId: contact.addresses?.[0]?.settlementId ?? null,
    community: contact.addresses?.[0]?.community || '',
    municipalUnit: contact.addresses?.[0]?.municipalUnit || '',

    // 🚀 DYNAMIC ARRAYS: Pass full arrays for dynamic management
    phones: contact.phones || [],
    emails: contact.emails || [],
    websites: contact.websites || [],
    socialMediaArray: contact.socialMedia || [],

    // Legacy fields for backward compatibility
    phone: contact.phones?.[0]?.number || '',
    email: contact.emails?.[0]?.email || '',
    website: contact.websites?.[0]?.url || '',

    // 🌐 Social Media
    socialMedia: {
      facebook: getSafeFieldValue(individualContact.socialMedia, 'facebook'),
      instagram: getSafeFieldValue(individualContact.socialMedia, 'instagram'),
      linkedin: getSafeFieldValue(individualContact.socialMedia, 'linkedin'),
      twitter: getSafeFieldValue(individualContact.socialMedia, 'twitter'),
    },

    // 📷 Φωτογραφίες
    photoFile: null,
    // 🔥 CRITICAL FIX: Clear photoURL όταν δεν υπάρχουν φωτογραφίες
    photoPreview: multiplePhotos.length === 0 ? '' : getSafeFieldValue(individualContact, 'photoURL'),
    photoURL: multiplePhotos.length === 0 ? '' : getSafeFieldValue(individualContact, 'photoURL'),
    multiplePhotos: multiplePhotos.length > 0 ? multiplePhotos : [], // 📸 Multiple photos array

    // 📝 Notes
    notes: getSafeFieldValue(contact, 'notes'),

    // 🎭 ENTERPRISE: Persona System (ADR-121)
    activePersonas,
    personaData,

    // Company & service fields παραμένουν από initialFormData
  };


  return formData;
}
