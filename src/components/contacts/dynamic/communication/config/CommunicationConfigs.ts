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
      { value: 'mobile', label: 'Κινητό' },
      { value: 'home', label: 'Σπίτι' },
      { value: 'work', label: 'Εργασία' },
      { value: 'fax', label: 'Φαξ' },
      { value: 'other', label: 'Άλλο' }
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
      { value: 'personal', label: 'Προσωπικό' },
      { value: 'work', label: 'Εργασία' },
      { value: 'other', label: 'Άλλο' }
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
      { value: 'personal', label: 'Προσωπική' },
      { value: 'company', label: 'Εταιρική' },
      { value: 'portfolio', label: 'Χαρτοφυλάκιο' },
      { value: 'blog', label: 'Blog' },
      { value: 'other', label: 'Άλλη' }
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
      { value: 'personal', label: 'Προσωπικό' },
      { value: 'professional', label: 'Επαγγελματικό' },
      { value: 'business', label: 'Επιχειρησιακό' },
      { value: 'other', label: 'Άλλο' }
    ],
    // 🎯 ΠΛΑΤΦΟΡΜΕΣ για το "Πλατφόρμα" dropdown
    platformTypes: [
      { value: 'linkedin', label: 'LinkedIn' },
      { value: 'facebook', label: 'Facebook' },
      { value: 'instagram', label: 'Instagram' },
      { value: 'twitter', label: 'Twitter/X' },
      { value: 'youtube', label: 'YouTube' },
      { value: 'github', label: 'GitHub' },
      { value: 'tiktok', label: 'TikTok' },
      { value: 'whatsapp', label: 'WhatsApp' },
      { value: 'telegram', label: 'Telegram' },
      { value: 'other', label: 'Άλλη Πλατφόρμα' }
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
      { value: 'id_card', label: 'Δελτίο Ταυτότητας' },
      { value: 'passport', label: 'Διαβατήριο' },
      { value: 'afm', label: 'ΑΦΜ' },
      { value: 'amka', label: 'ΑΜΚΑ' },
      { value: 'license', label: 'Άδεια Οδήγησης' },
      { value: 'other', label: 'Άλλο' }
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
      { value: 'company_phone', label: 'Τηλέφωνο Εταιρείας' },
      { value: 'company_email', label: 'Email Εταιρείας' },
      { value: 'company_website', label: 'Website Εταιρείας' },
      { value: 'linkedin', label: 'LinkedIn' },
      { value: 'position', label: 'Θέση Εργασίας' },
      { value: 'department', label: 'Τμήμα' },
      { value: 'other', label: 'Άλλο' }
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
      { value: 'home', label: 'Κατοικία' },
      { value: 'work', label: 'Εργασία' },
      { value: 'mailing', label: 'Αλληλογραφία' },
      { value: 'billing', label: 'Χρέωση' },
      { value: 'other', label: 'Άλλο' }
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