// ============================================================================
// 🏢 ENTERPRISE COMMUNICATION CONFIGURATIONS - ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΑ CONFIGS
// ============================================================================
//
// 📍 EXTRACTED FROM: UniversalCommunicationManager.tsx
// 🎯 PURPOSE: Centralized configuration για όλα τα communication types
// 🔗 USED BY: Communication components, forms, validation systems
//
// ============================================================================

import { Globe, User, Briefcase } from 'lucide-react';
// 🏢 ENTERPRISE: Centralized entity icons (ZERO hardcoded values)
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import type { CommunicationType, CommunicationConfig, CommunicationConfigRecord } from '../types/CommunicationTypes';
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
 * Contact entity type — determines which communication type options to show
 */
export type ContactEntityType = 'individual' | 'company' | 'service';

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
    icon: NAVIGATION_ENTITIES.phone.icon,
    fields: { primary: 'number', secondary: 'countryCode' },
    types: [
      { value: 'mobile', label: PHONE_TYPE_LABELS.mobile },
      { value: 'home', label: PHONE_TYPE_LABELS.home },
      { value: 'work', label: PHONE_TYPE_LABELS.work },
      { value: 'fax', label: PHONE_TYPE_LABELS.fax },
      { value: 'other', label: PHONE_TYPE_LABELS.other }
    ],
    defaultType: 'mobile',
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
    icon: NAVIGATION_ENTITIES.email.icon,
    fields: { primary: 'email' },
    types: [
      { value: 'personal', label: EMAIL_TYPE_LABELS.personal },
      { value: 'work', label: EMAIL_TYPE_LABELS.work },
      { value: 'other', label: EMAIL_TYPE_LABELS.other }
    ],
    defaultType: 'personal',
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
    icon: Globe,
    fields: { primary: 'url' },
    types: [
      { value: 'personal', label: WEBSITE_TYPE_LABELS.personal },
      { value: 'company', label: WEBSITE_TYPE_LABELS.company },
      { value: 'portfolio', label: WEBSITE_TYPE_LABELS.portfolio },
      { value: 'blog', label: WEBSITE_TYPE_LABELS.blog },
      { value: 'other', label: WEBSITE_TYPE_LABELS.other }
    ],
    defaultType: 'personal',
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
    icon: Globe,
    fields: { primary: 'username', secondary: 'platform' },
    // 🎯 ΤΥΠΟΙ ΧΡΗΣΗΣ για το "Τύπος" dropdown
    types: [
      { value: 'personal', label: SOCIAL_MEDIA_TYPE_LABELS.personal },
      { value: 'professional', label: SOCIAL_MEDIA_TYPE_LABELS.professional },
      { value: 'business', label: SOCIAL_MEDIA_TYPE_LABELS.business },
      { value: 'other', label: SOCIAL_MEDIA_TYPE_LABELS.other }
    ],
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
    defaultType: 'personal',
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
    icon: User,
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
    icon: Briefcase,
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
    icon: NAVIGATION_ENTITIES.location.icon,
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
    types: [
      { value: 'main', label: SERVICE_PHONE_TYPE_LABELS.main },
      { value: 'department', label: SERVICE_PHONE_TYPE_LABELS.department },
      { value: 'secretariat', label: SERVICE_PHONE_TYPE_LABELS.secretariat },
      { value: 'helpdesk', label: SERVICE_PHONE_TYPE_LABELS.helpdesk },
      { value: 'fax', label: SERVICE_PHONE_TYPE_LABELS.fax },
      { value: 'other', label: SERVICE_PHONE_TYPE_LABELS.other }
    ],
    defaultType: 'main'
  },
  email: {
    types: [
      { value: 'general', label: SERVICE_EMAIL_TYPE_LABELS.general },
      { value: 'department', label: SERVICE_EMAIL_TYPE_LABELS.department },
      { value: 'secretariat', label: SERVICE_EMAIL_TYPE_LABELS.secretariat },
      { value: 'info', label: SERVICE_EMAIL_TYPE_LABELS.info },
      { value: 'other', label: SERVICE_EMAIL_TYPE_LABELS.other }
    ],
    defaultType: 'general'
  },
  website: {
    types: [
      { value: 'official', label: SERVICE_WEBSITE_TYPE_LABELS.official },
      { value: 'eServices', label: SERVICE_WEBSITE_TYPE_LABELS.eServices },
      { value: 'portal', label: SERVICE_WEBSITE_TYPE_LABELS.portal },
      { value: 'other', label: SERVICE_WEBSITE_TYPE_LABELS.other }
    ],
    defaultType: 'official'
  },
  social: {
    types: [
      { value: 'official', label: SERVICE_SOCIAL_MEDIA_TYPE_LABELS.official },
      { value: 'informational', label: SERVICE_SOCIAL_MEDIA_TYPE_LABELS.informational },
      { value: 'other', label: SERVICE_SOCIAL_MEDIA_TYPE_LABELS.other }
    ],
    defaultType: 'official'
  }
};

const COMPANY_TYPE_OVERRIDES: Partial<Record<CommunicationType, { types: { value: string; label: string }[]; defaultType: string }>> = {
  phone: {
    types: [
      { value: 'main', label: COMPANY_PHONE_TYPE_LABELS.main },
      { value: 'department', label: COMPANY_PHONE_TYPE_LABELS.department },
      { value: 'secretariat', label: COMPANY_PHONE_TYPE_LABELS.secretariat },
      { value: 'sales', label: COMPANY_PHONE_TYPE_LABELS.sales },
      { value: 'support', label: COMPANY_PHONE_TYPE_LABELS.support },
      { value: 'fax', label: COMPANY_PHONE_TYPE_LABELS.fax },
      { value: 'other', label: COMPANY_PHONE_TYPE_LABELS.other }
    ],
    defaultType: 'main'
  },
  email: {
    types: [
      { value: 'general', label: COMPANY_EMAIL_TYPE_LABELS.general },
      { value: 'department', label: COMPANY_EMAIL_TYPE_LABELS.department },
      { value: 'sales', label: COMPANY_EMAIL_TYPE_LABELS.sales },
      { value: 'support', label: COMPANY_EMAIL_TYPE_LABELS.support },
      { value: 'info', label: COMPANY_EMAIL_TYPE_LABELS.info },
      { value: 'other', label: COMPANY_EMAIL_TYPE_LABELS.other }
    ],
    defaultType: 'general'
  },
  website: {
    types: [
      { value: 'corporate', label: COMPANY_WEBSITE_TYPE_LABELS.corporate },
      { value: 'eshop', label: COMPANY_WEBSITE_TYPE_LABELS.eshop },
      { value: 'blog', label: COMPANY_WEBSITE_TYPE_LABELS.blog },
      { value: 'other', label: COMPANY_WEBSITE_TYPE_LABELS.other }
    ],
    defaultType: 'corporate'
  },
  social: {
    types: [
      { value: 'corporate', label: COMPANY_SOCIAL_MEDIA_TYPE_LABELS.corporate },
      { value: 'marketing', label: COMPANY_SOCIAL_MEDIA_TYPE_LABELS.marketing },
      { value: 'other', label: COMPANY_SOCIAL_MEDIA_TYPE_LABELS.other }
    ],
    defaultType: 'corporate'
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