// ============================================================================
// INDIVIDUAL CONTACT MAPPER - ENTERPRISE MODULE
// ============================================================================
//
// 👤 Individual contact form data mapping utilities
// Transforms individual contact form data to Contact model structure
// Part of modular Enterprise form data mapping architecture
//
// ============================================================================

import type { ContactFormData } from '@/types/ContactFormTypes';
import type { AddressInfo, EmailInfo, PhoneInfo, SocialMediaInfo, WebsiteInfo } from '@/types/contacts';
import { extractPhotoURL, extractMultiplePhotoURLs } from '../extractors/photo-urls';
import { buildEnterpriseContactArrays } from '../extractors/arrays';
// 🎭 ENTERPRISE: Contact Persona System (ADR-121)
import type { PersonaData } from '@/types/contacts/personas';
import { createDefaultPersonaData } from '@/types/contacts/personas';
import { getPersonaFields } from '@/config/persona-config';

import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('MapIndividual');

/** Mapped individual contact data (partial, without timestamps) */
interface MappedIndividualContactData {
  type: 'individual';
  firstName?: string;
  lastName?: string;
  fatherName?: string;
  motherName?: string;
  birthDate?: string;
  birthCountry?: string;
  gender?: string;
  amka?: string;
  documentType?: string;
  documentIssuer?: string;
  documentNumber?: string;
  documentIssueDate?: string;
  documentExpiryDate?: string;
  vatNumber?: string;
  taxOffice?: string;
  profession?: string;
  specialty?: string;
  employer?: string;
  employerId?: string | null;
  position?: string;
  workAddress?: string;
  workWebsite?: string;
  // 🇪🇺 ESCO Professional Classification (ADR-034)
  escoUri?: string | null;
  escoLabel?: string | null;
  iscoCode?: string | null;
  // 🇪🇺 ESCO Skills (ADR-132)
  escoSkills?: Array<{ uri: string; label: string }>;
  socialMedia?: SocialMediaInfo[];
  websites?: WebsiteInfo[];
  photoURL?: string;
  multiplePhotoURLs: string[];
  emails?: EmailInfo[];
  phones?: PhoneInfo[];
  addresses?: AddressInfo[];
  /** Ένθετα πεδία — αυθεντική λίστα διευθύνσεων (ADR-332 D18). */
  customFields?: Record<string, unknown>;
  isFavorite: boolean;
  status: 'active' | 'inactive' | 'archived';
  notes?: string;
  // 🎭 ENTERPRISE: Contact Persona System (ADR-121)
  personas?: PersonaData[];
}

// ============================================================================
// 🎭 PERSONA MAPPING HELPER
// ============================================================================

/**
 * Map active persona form data to PersonaData[] for Firestore persistence.
 * Uses createDefaultPersonaData as base, then overlays form field values.
 * All optional fields use ?? null (ΚΡΙΣΙΜΟ — Firestore rejects undefined).
 */
export function mapActivePersonas(formData: ContactFormData): PersonaData[] {
  const activePersonas = formData.activePersonas ?? [];
  if (activePersonas.length === 0) return [];

  return activePersonas.map(personaType => {
    const base = createDefaultPersonaData(personaType);
    const formValues = formData.personaData?.[personaType] ?? {};

    // Overlay form values onto typed defaults using persona field config as SSoT
    const fieldConfigs = getPersonaFields(personaType);
    const merged = { ...base };
    const mergedRecord = merged as Record<string, string | number | null>;

    for (const config of fieldConfigs) {
      mergedRecord[config.id] = formValues[config.id] ?? null;
    }

    return merged;
  });
}

/**
 * Map Individual Contact form data to Contact object
 *
 * @param formData - Contact form data
 * @returns Individual contact data
 */
export function mapIndividualFormData(formData: ContactFormData): MappedIndividualContactData {
  const multiplePhotoURLs = extractMultiplePhotoURLs(formData);
  const photoURL = extractPhotoURL(formData, 'individual');
  const { enterpriseData, emails, phones } = buildEnterpriseContactArrays(formData, 'mobile');

  logger.info('MAP INDIVIDUAL: extractPhotoURL returned', {
    photoURLValue: photoURL,
    photoURLType: typeof photoURL,
    isEmptyString: photoURL === '',
    isUndefined: photoURL === undefined,
    isNull: photoURL === null
  });

  logger.info('MAP INDIVIDUAL: Final mapped object photoURL', {
    returnedPhotoURL: photoURL,
    returnedMultiplePhotoURLsCount: multiplePhotoURLs.length
  });

  return {
    type: 'individual',
    firstName: formData.firstName,
    lastName: formData.lastName,
    fatherName: formData.fatherName,
    motherName: formData.motherName,
    birthDate: formData.birthDate,
    birthCountry: formData.birthCountry,
    gender: formData.gender,
    amka: formData.amka,
    documentType: formData.documentType,
    documentIssuer: formData.documentIssuer,
    documentNumber: formData.documentNumber,
    documentIssueDate: formData.documentIssueDate,
    documentExpiryDate: formData.documentExpiryDate,
    vatNumber: formData.vatNumber,
    taxOffice: formData.taxOffice,
    profession: formData.profession,
    specialty: formData.specialty,
    employer: formData.employer,
    // 🏢 ENTERPRISE: Employer Entity Linking (ADR-177)
    // ΚΡΙΣΙΜΟ: Firestore rejects undefined — use null for empty employerId
    employerId: formData.employerId || null,
    position: formData.position,
    workAddress: formData.workAddress,
    workWebsite: formData.workWebsite,
    // 🇪🇺 ESCO Professional Classification (ADR-034)
    // ΚΡΙΣΙΜΟ: Firestore rejects undefined — use null for empty ESCO fields
    escoUri: formData.escoUri || null,
    escoLabel: formData.escoLabel || null,
    iscoCode: formData.iscoCode || null,
    // 🇪🇺 ESCO Skills (ADR-132)
    escoSkills: formData.escoSkills?.length ? formData.escoSkills : [],
    socialMedia: enterpriseData.socialMedia,
    websites: enterpriseData.websites,
    photoURL,
    multiplePhotoURLs, // 📸 Multiple photos array
    emails,
    phones,
    addresses: enterpriseData.addresses,
    // ADR-332 D18: η αυθεντική λίστα διευθύνσεων ζει στα `customFields`. Χωρίς
    // αυτή τη γραμμή, μια νέα επαφή με δεύτερη διεύθυνση αποθηκευόταν με μόνο
    // την πρώτη — το `addresses[]` είναι παράγωγο και δεν διαβάζεται πίσω ως
    // λίστα φόρμας παρά μόνο ως έσχατη λύση.
    ...(enterpriseData.customFields ? { customFields: enterpriseData.customFields } : {}),
    isFavorite: false,
    status: 'active',
    notes: formData.notes,
    // 🎭 ENTERPRISE: Persona data (ADR-121) — only include if any personas are active
    ...(formData.activePersonas && formData.activePersonas.length > 0
      ? { personas: mapActivePersonas(formData) }
      : {}),
  };
}
