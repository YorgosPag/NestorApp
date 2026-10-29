// ============================================================================
// 🏢 ENTERPRISE COMMUNICATION CONFIGURATIONS - ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΑ CONFIGS
// ============================================================================
//
// 📍 EXTRACTED FROM: UniversalCommunicationManager.tsx
// 🎯 PURPOSE: Centralized configuration για όλα τα communication types
// 🔗 USED BY: Communication components, forms, validation systems
//
// ============================================================================

// 🏢 ENTERPRISE: Single source of truth for communication icons
import { COMMUNICATION_ICONS } from './CommunicationIcons';
import type { CommunicationType, CommunicationConfig, CommunicationConfigRecord } from '../types/CommunicationTypes';
import { DEFAULT_PHONE_TYPE, PHONE_TYPES_BY_OWNER } from '@/lib/contact/phone-type-vocabulary';
import { DEFAULT_EMAIL_TYPE, EMAIL_TYPES_BY_OWNER } from '@/lib/contact/email-type-vocabulary';
import { DEFAULT_WEBSITE_TYPE, WEBSITE_TYPES_BY_OWNER } from '@/lib/contact/website-type-vocabulary';
import { DEFAULT_SOCIAL_MEDIA_TYPE, SOCIAL_MEDIA_TYPES_BY_OWNER } from '@/lib/contact/social-media-type-vocabulary';
import type { ContactOwnerKind } from '@/lib/contact/contact-owner-kind';
import {
  PHONE_TYPE_LABELS,
  EMAIL_TYPE_LABELS,
  WEBSITE_TYPE_LABELS,
  SOCIAL_MEDIA_TYPE_LABELS,
  SOCIAL_PLATFORM_LABELS,
  IDENTITY_TYPE_LABELS,
  PROFESSIONAL_TYPE_LABELS,
  ADDRESS_TYPE_LABELS,
  SERVICE_PHONE_TYPE_LABELS,
  SERVICE_EMAIL_TYPE_LABELS,
  SERVICE_WEBSITE_TYPE_LABELS,
  SERVICE_SOCIAL_MEDIA_TYPE_LABELS,
  COMPANY_PHONE_TYPE_LABELS,
  COMPANY_EMAIL_TYPE_LABELS,
  COMPANY_WEBSITE_TYPE_LABELS,
  COMPANY_SOCIAL_MEDIA_TYPE_LABELS
} from '@/constants/property-statuses-enterprise';

/**
 * Επιλογές λίστας από ένα **λεξιλόγιο-ρίζα** και τον πίνακα ετικετών του: ο τύπος `T` βγαίνει από τις τιμές, άρα τιμή
 * χωρίς ετικέτα είναι σφάλμα μεταγλώττισης, όχι κενή γραμμή στη φόρμα (ADR-327 §8.5.4).
 */
function typeOptions<T extends string>(values: readonly T[], labels: Readonly<Record<T, string>>): { value: T; label: string }[] {
  return values.map((value) => ({ value, label: labels[value] }));
}

/**
 * Contact entity type — determines which communication type options to show.
 * Ψευδώνυμο του ΕΝΟΣ άξονα κατόχου (`lib/contact/contact-owner-kind.ts`, ADR-327 §8.5.4).
 */
export type ContactEntityType = ContactOwnerKind;

// ============================================================================
// MAIN COMMUNICATION CONFIGURATIONS
// ============================================================================

/**
 * 🎛️ ENTERPRISE COMMUNICATION CONFIGURATIONS
 *
 * Complete configuration object που περιγράφει κάθε communication type
 * με consistency, validation rules, και UI configuration across το system.
 *
 * Each config includes:
 * - Visual elements (title, icon)
 * - Field configuration (primary/secondary fields)
 * - Type options (dropdown choices)
 * - Validation settings
 * - UI text και placeholders
 */
export const COMMUNICATION_CONFIGS: CommunicationConfigRecord = {
  // === ΤΗΛΕΦΩΝΑ ===
  // 🌐 i18n: All labels converted to i18n keys - 2026-01-18
  phone: {
    type: 'phone',
    title: 'communication.sections.phones',
    icon: COMMUNICATION_ICONS.phone,
    fields: { primary: 'number', secondary: 'countryCode' },
    types: typeOptions(PHONE_TYPES_BY_OWNER.individual, PHONE_TYPE_LABELS),
    defaultType: DEFAULT_PHONE_TYPE.individual,
    placeholder: 'communication.placeholders.phone',
    labelPlaceholder: 'communication.placeholders.phoneLabel',
    supportsPrimary: true,
    emptyStateText: 'communication.emptyStates.phones',
    addButtonText: 'communication.buttons.addPhone'
  },

  // === E-MAILS ===
  // 🌐 i18n: All labels converted to i18n keys - 2026-01-18
  email: {
    type: 'email',
    title: 'communication.sections.emails',
    icon: COMMUNICATION_ICONS.email,
    fields: { primary: 'email' },
    types: typeOptions(EMAIL_TYPES_BY_OWNER.individual, EMAIL_TYPE_LABELS),
    defaultType: DEFAULT_EMAIL_TYPE.individual,
    placeholder: 'communication.placeholders.email',
    labelPlaceholder: 'communication.placeholders.emailLabel',
    supportsPrimary: true,
    emptyStateText: 'communication.emptyStates.emails',
    addButtonText: 'communication.buttons.addEmail'
  },

  // === ΙΣΤΟΣΕΛΙΔΕΣ ===
  // 🌐 i18n: All labels converted to i18n keys - 2026-01-18
  website: {
    type: 'website',
    title: 'communication.sections.websites',
    icon: COMMUNICATION_ICONS.website,
    fields: { primary: 'url' },
    types: typeOptions(WEBSITE_TYPES_BY_OWNER.individual, WEBSITE_TYPE_LABELS),
    defaultType: DEFAULT_WEBSITE_TYPE.individual,
    placeholder: 'communication.placeholders.website',
    labelPlaceholder: 'communication.placeholders.websiteLabel',
    supportsPrimary: false,
    emptyStateText: 'communication.emptyStates.websites',
    addButtonText: 'communication.buttons.addWebsite'
  },

  // === SOCIAL MEDIA ===
  // 🌐 i18n: All labels converted to i18n keys - 2026-01-18
  social: {
    type: 'social',
    title: 'communication.sections.socialMedia',
    icon: COMMUNICATION_ICONS.social,
    fields: { primary: 'username', secondary: 'platform' },
    // 🎯 ΤΥΠΟΙ ΧΡΗΣΗΣ για το "Τύπος" dropdown
    types: typeOptions(SOCIAL_MEDIA_TYPES_BY_OWNER.individual, SOCIAL_MEDIA_TYPE_LABELS),
    // 🎯 ΠΛΑΤΦΟΡΜΕΣ για το "Πλατφόρμα" dropdown
    platformTypes: [
      { value: 'linkedin', label: SOCIAL_PLATFORM_LABELS.linkedin },
      { value: 'facebook', label: SOCIAL_PLATFORM_LABELS.facebook },
      { value: 'instagram', label: SOCIAL_PLATFORM_LABELS.instagram },
      { value: 'twitter', label: SOCIAL_PLATFORM_LABELS.twitter },
      { value: 'youtube', label: SOCIAL_PLATFORM_LABELS.youtube },
      { value: 'github', label: SOCIAL_PLATFORM_LABELS.github },
      { value: 'tiktok', label: SOCIAL_PLATFORM_LABELS.tiktok },
      { value: 'whatsapp', label: SOCIAL_PLATFORM_LABELS.whatsapp },
      { value: 'telegram', label: SOCIAL_PLATFORM_LABELS.telegram },
      { value: 'other', label: SOCIAL_PLATFORM_LABELS.other }
    ],
    defaultType: DEFAULT_SOCIAL_MEDIA_TYPE.individual,
    placeholder: 'communication.placeholders.username',
    labelPlaceholder: 'communication.placeholders.socialLabel',
    supportsPrimary: false,
    emptyStateText: 'communication.emptyStates.socialMedia',
    addButtonText: 'communication.buttons.addSocial'
  },

  // === ΤΑΥΤΟΤΗΤΑ & ΑΦΜ ===
  // 🌐 i18n: All labels converted to i18n keys - 2026-01-18
  identity: {
    type: 'identity',
    title: 'communication.sections.identity',
    icon: COMMUNICATION_ICONS.identity,
    fields: { primary: 'number', secondary: 'type' },
    types: [
      { value: 'id_card', label: IDENTITY_TYPE_LABELS.id_card },
      { value: 'passport', label: IDENTITY_TYPE_LABELS.passport },
      { value: 'afm', label: IDENTITY_TYPE_LABELS.afm },
      { value: 'amka', label: IDENTITY_TYPE_LABELS.amka },
      { value: 'license', label: IDENTITY_TYPE_LABELS.license },
      { value: 'other', label: IDENTITY_TYPE_LABELS.other }
    ],
    defaultType: 'id_card',
    placeholder: 'communication.placeholders.documentNumber',
    labelPlaceholder: 'communication.placeholders.identityLabel',
    supportsPrimary: true,
    emptyStateText: 'communication.emptyStates.identity',
    addButtonText: 'communication.buttons.addIdentity'
  },

  // === ΕΠΑΓΓΕΛΜΑΤΙΚΑ ===
  // 🌐 i18n: All labels converted to i18n keys - 2026-01-18
  professional: {
    type: 'professional',
    title: 'communication.sections.professional',
    icon: COMMUNICATION_ICONS.professional,
    fields: { primary: 'value', secondary: 'type' },
    types: [
      { value: 'company_phone', label: PROFESSIONAL_TYPE_LABELS.company_phone },
      { value: 'company_email', label: PROFESSIONAL_TYPE_LABELS.company_email },
      { value: 'company_website', label: PROFESSIONAL_TYPE_LABELS.company_website },
      { value: 'linkedin', label: PROFESSIONAL_TYPE_LABELS.linkedin },
      { value: 'position', label: PROFESSIONAL_TYPE_LABELS.position },
      { value: 'department', label: PROFESSIONAL_TYPE_LABELS.department },
      { value: 'other', label: PROFESSIONAL_TYPE_LABELS.other }
    ],
    defaultType: 'company_phone',
    placeholder: 'communication.placeholders.value',
    labelPlaceholder: 'communication.placeholders.professionalLabel',
    supportsPrimary: true,
    emptyStateText: 'communication.emptyStates.professional',
    addButtonText: 'communication.buttons.addProfessional'
  },

  // === ΔΙΕΥΘΥΝΣΕΙΣ ===
  // 🌐 i18n: All labels converted to i18n keys - 2026-01-18
  address: {
    type: 'address',
    title: 'communication.sections.addresses',
    icon: COMMUNICATION_ICONS.address,
    fields: { primary: 'address', secondary: 'type' },
    types: [
      { value: 'home', label: ADDRESS_TYPE_LABELS.home },
      { value: 'work', label: ADDRESS_TYPE_LABELS.work },
      { value: 'mailing', label: ADDRESS_TYPE_LABELS.mailing },
      { value: 'billing', label: ADDRESS_TYPE_LABELS.billing },
      { value: 'other', label: ADDRESS_TYPE_LABELS.other }
    ],
    defaultType: 'home',
    placeholder: 'communication.placeholders.address',
    labelPlaceholder: 'communication.placeholders.addressLabel',
    supportsPrimary: true,
    emptyStateText: 'communication.emptyStates.addresses',
    addButtonText: 'communication.buttons.addAddress'
  }
};

// ============================================================================
// CONFIGURATION UTILITIES
// ============================================================================

/**
 * 🔍 Get Configuration by Type
 *
 * Helper function για να πάρουμε configuration για συγκεκριμένο communication type
 */
export function getCommunicationConfig(type: CommunicationType): CommunicationConfig {
  const config = COMMUNICATION_CONFIGS[type];
  if (!config) {
    throw new Error(`Unknown communication type: ${type}`);
  }
  return config;
}

/**
 * 📋 Get All Communication Types
 *
 * Returns array με όλα τα available communication types
 */
export function getAllCommunicationTypes(): CommunicationType[] {
  return Object.keys(COMMUNICATION_CONFIGS) as CommunicationType[];
}

/**
 * 🏷️ Get Type Options for Communication Type
 *
 * Returns τα available type options για συγκεκριμένο communication type
 */
export function getTypeOptions(type: CommunicationType): { value: string; label: string; }[] {
  return getCommunicationConfig(type).types;
}

/**
 * 🌐 Get Platform Options for Social Media
 *
 * Returns τα available platform options για social media (if applicable)
 */
export function getPlatformOptions(type: CommunicationType): { value: string; label: string; }[] | undefined {
  const config = getCommunicationConfig(type);
  return config.platformTypes;
}

// ============================================================================
// ENTITY-AWARE TYPE OVERRIDES
// ============================================================================

/**
 * Type options per entity type — overrides the default individual-oriented labels
 * with context-appropriate labels for services and companies.
 */
const SERVICE_TYPE_OVERRIDES: Partial<Record<CommunicationType, { types: { value: string; label: string }[]; defaultType: string }>> = {
  phone: {
    types: typeOptions(PHONE_TYPES_BY_OWNER.service, SERVICE_PHONE_TYPE_LABELS),
    defaultType: DEFAULT_PHONE_TYPE.service
  },
  email: {
    types: typeOptions(EMAIL_TYPES_BY_OWNER.service, SERVICE_EMAIL_TYPE_LABELS),
    defaultType: DEFAULT_EMAIL_TYPE.service
  },
  website: {
    types: typeOptions(WEBSITE_TYPES_BY_OWNER.service, SERVICE_WEBSITE_TYPE_LABELS),
    defaultType: DEFAULT_WEBSITE_TYPE.service
  },
  social: {
    types: typeOptions(SOCIAL_MEDIA_TYPES_BY_OWNER.service, SERVICE_SOCIAL_MEDIA_TYPE_LABELS),
    defaultType: DEFAULT_SOCIAL_MEDIA_TYPE.service
  }
};

const COMPANY_TYPE_OVERRIDES: Partial<Record<CommunicationType, { types: { value: string; label: string }[]; defaultType: string }>> = {
  phone: {
    types: typeOptions(PHONE_TYPES_BY_OWNER.company, COMPANY_PHONE_TYPE_LABELS),
    defaultType: DEFAULT_PHONE_TYPE.company
  },
  email: {
    types: typeOptions(EMAIL_TYPES_BY_OWNER.company, COMPANY_EMAIL_TYPE_LABELS),
    defaultType: DEFAULT_EMAIL_TYPE.company
  },
  website: {
    types: typeOptions(WEBSITE_TYPES_BY_OWNER.company, COMPANY_WEBSITE_TYPE_LABELS),
    defaultType: DEFAULT_WEBSITE_TYPE.company
  },
  social: {
    types: typeOptions(SOCIAL_MEDIA_TYPES_BY_OWNER.company, COMPANY_SOCIAL_MEDIA_TYPE_LABELS),
    defaultType: DEFAULT_SOCIAL_MEDIA_TYPE.company
  }
};

/**
 * Returns communication config with entity-appropriate type options.
 *
 * - individual: personal/home/work types (default)
 * - service: main/department/secretariat/helpdesk types
 * - company: main/department/sales/support types
 */
export function getEntityAwareCommunicationConfig(
  commType: CommunicationType,
  entityType: ContactEntityType
): CommunicationConfig {
  const baseConfig = getCommunicationConfig(commType);

  if (entityType === 'individual') {
    return baseConfig;
  }

  const overrides = entityType === 'service'
    ? SERVICE_TYPE_OVERRIDES[commType]
    : COMPANY_TYPE_OVERRIDES[commType];

  if (!overrides) {
    return baseConfig;
  }

  return {
    ...baseConfig,
    types: overrides.types,
    defaultType: overrides.defaultType
  };
}