// ============================================================================
// 🏢 ENTERPRISE COMMUNICATION CONFIGURATIONS - ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΑ CONFIGS
// ============================================================================
//
// 📍 EXTRACTED FROM: UniversalCommunicationManager.tsx
// 🎯 PURPOSE: Centralized configuration για όλα τα communication types
// 🔗 USED BY: Communication components, forms, validation systems
//
// ============================================================================

import { Phone, Mail, Globe, User, Briefcase, MapPin } from 'lucide-react';
import type { CommunicationType, CommunicationConfig, CommunicationConfigRecord } from '../types/CommunicationTypes';
import {
  PHONE_TYPE_LABELS,
  EMAIL_TYPE_LABELS,
  WEBSITE_TYPE_LABELS,
  SOCIAL_MEDIA_TYPE_LABELS,
  SOCIAL_PLATFORM_LABELS,
  IDENTITY_TYPE_LABELS,
  PROFESSIONAL_TYPE_LABELS,
  ADDRESS_TYPE_LABELS
} from '@/constants/property-statuses-enterprise';

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
  phone: {
    type: 'phone',
    title: 'Τηλέφωνα',
    icon: Phone,
    fields: { primary: 'number', secondary: 'countryCode' },
    types: [
      { value: 'mobile', label: PHONE_TYPE_LABELS.mobile },
      { value: 'home', label: PHONE_TYPE_LABELS.home },
      { value: 'work', label: PHONE_TYPE_LABELS.work },
      { value: 'fax', label: PHONE_TYPE_LABELS.fax },
      { value: 'other', label: PHONE_TYPE_LABELS.other }
    ],
    defaultType: 'mobile',
    placeholder: 'π.χ. 2310 123456',
    labelPlaceholder: 'π.χ. Προσωπικό τηλέφωνο',
    supportsPrimary: true,
    emptyStateText: 'Δεν έχουν οριστεί τηλέφωνα',
    addButtonText: 'Προσθήκη Τηλεφώνου'
  },

  // === E-MAILS ===
  email: {
    type: 'email',
    title: 'E-mails',
    icon: Mail,
    fields: { primary: 'email' },
    types: [
      { value: 'personal', label: EMAIL_TYPE_LABELS.personal },
      { value: 'work', label: EMAIL_TYPE_LABELS.work },
      { value: 'other', label: EMAIL_TYPE_LABELS.other }
    ],
    defaultType: 'personal',
    placeholder: 'π.χ. john@example.com',
    labelPlaceholder: 'π.χ. Προσωπικό e-mail',
    supportsPrimary: true,
    emptyStateText: 'Δεν έχουν οριστεί e-mails',
    addButtonText: 'Προσθήκη E-mail'
  },

  // === ΙΣΤΟΣΕΛΙΔΕΣ ===
  website: {
    type: 'website',
    title: 'Ιστοσελίδες',
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
    placeholder: 'π.χ. https://example.com',
    labelPlaceholder: 'π.χ. Προσωπική ιστοσελίδα',
    supportsPrimary: false,
    emptyStateText: 'Δεν έχουν οριστεί ιστοσελίδες',
    addButtonText: 'Προσθήκη Ιστοσελίδας'
  },

  // === SOCIAL MEDIA ===
  social: {
    type: 'social',
    title: 'Social Media',
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
    placeholder: 'π.χ. john-doe',
    labelPlaceholder: 'π.χ. Προσωπικό κοινωνικό δίκτυο',
    supportsPrimary: false,
    emptyStateText: 'Δεν έχουν οριστεί social media',
    addButtonText: 'Προσθήκη Social Media'
  },

  // === ΤΑΥΤΟΤΗΤΑ & ΑΦΜ ===
  identity: {
    type: 'identity',
    title: 'Στοιχεία Ταυτότητας',
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
    placeholder: 'Αριθμός εγγράφου',
    labelPlaceholder: 'π.χ. Κύριο ΑΦΜ',
    supportsPrimary: true,
    emptyStateText: 'Δεν έχουν οριστεί στοιχεία ταυτότητας',
    addButtonText: 'Προσθήκη Στοιχείου'
  },

  // === ΕΠΑΓΓΕΛΜΑΤΙΚΑ ===
  professional: {
    type: 'professional',
    title: 'Επαγγελματικά Στοιχεία',
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
    placeholder: 'Τιμή',
    labelPlaceholder: 'π.χ. Κύριο τηλέφωνο εταιρείας',
    supportsPrimary: true,
    emptyStateText: 'Δεν έχουν οριστεί επαγγελματικά στοιχεία',
    addButtonText: 'Προσθήκη Επαγγελματικού'
  },

  // === ΔΙΕΥΘΥΝΣΕΙΣ ===
  address: {
    type: 'address',
    title: 'Διευθύνσεις',
    icon: MapPin,
    fields: { primary: 'address', secondary: 'type' },
    types: [
      { value: 'home', label: ADDRESS_TYPE_LABELS.home },
      { value: 'work', label: ADDRESS_TYPE_LABELS.work },
      { value: 'mailing', label: ADDRESS_TYPE_LABELS.mailing },
      { value: 'billing', label: ADDRESS_TYPE_LABELS.billing },
      { value: 'other', label: ADDRESS_TYPE_LABELS.other }
    ],
    defaultType: 'home',
    placeholder: 'Οδός, αριθμός, περιοχή',
    labelPlaceholder: 'π.χ. Κύρια διεύθυνση',
    supportsPrimary: true,
    emptyStateText: 'Δεν έχουν οριστεί διευθύνσεις',
    addButtonText: 'Προσθήκη Διεύθυνσης'
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