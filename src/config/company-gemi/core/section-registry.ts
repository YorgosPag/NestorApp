/**
 * COMPANY GEMI SECTION REGISTRY
 *
 * Κεντρικός registry όλων των GEMI sections
 * ENTERPRISE: Centralized section management με auto-sorting
 *
 * @version 1.0.0 - ENTERPRISE REGISTRY
 * @updated 2025-12-28 - Split from monolithic company-gemi-config.ts
 */

import { SectionConfig } from './field-types';

// Import modular sections
import { basicInfoSection } from '../sections/basic-info';
import { activitiesSection } from '../sections/activities';
// capitalSection removed — tab αφαιρέθηκε κατόπιν αιτήματος

// ENTERPRISE: Import remaining sections από original config
import { fieldLabels } from '../labels/field-labels';
import { gemiHelps } from '../labels/help-texts';
import {
  ADDRESS_TYPE_OPTIONS,
  SHAREHOLDER_TYPE_OPTIONS
} from '../options';

// ============================================================================
// REMAINING SECTIONS (TO BE SPLIT FURTHER IF NEEDED)
// ============================================================================

const addressesSection: SectionConfig = {
  id: 'addresses',
  title: 'sections.addressesBranches', // i18n key
  icon: 'map-pin',
  description: 'sectionDescriptions.addressesBranches', // i18n key
  order: 2, // 🔄 Moved to 2nd position after basicInfo (per user request)
  fields: [
    {
      id: 'addressType',
      label: fieldLabels.addressType,
      type: 'select',
      options: [...ADDRESS_TYPE_OPTIONS],
      helpText: gemiHelps.address_type_help,
    },
    {
      id: 'street',
      label: fieldLabels.street,
      type: 'input',
      helpText: gemiHelps.street_help,
    },
    {
      id: 'streetNumber',
      label: fieldLabels.streetNumber,
      type: 'input',
      helpText: gemiHelps.street_number_help,
    },
    {
      id: 'postalCode',
      label: fieldLabels.postalCode,
      type: 'input',
      maxLength: 5,
      helpText: gemiHelps.postal_code_help,
    },
    {
      id: 'city',
      label: fieldLabels.city,
      type: 'input',
      helpText: gemiHelps.city_help,
    },
    {
      id: 'region',
      label: fieldLabels.region,
      type: 'input',
      helpText: gemiHelps.region_address_help,
    },
  ],
};

// 🏢 ENTERPRISE: Communication section for company contacts (phones, emails, websites, social media)
const communicationSection: SectionConfig = {
  id: 'communication',
  title: 'sections.communication',
  icon: 'smartphone',
  description: 'sectionDescriptions.communication',
  order: 3,
  fields: [
    {
      id: 'communication', // Triggers existing custom renderer in UnifiedContactTabbedSection
      label: 'sections.communication',
      type: 'input',
    }
  ],
};

// Add more simplified sections για demonstration...
const shareholdersSection: SectionConfig = {
  id: 'shareholders',
  title: 'sections.shareholdersPartners', // i18n key
  icon: 'users',
  description: 'sectionDescriptions.shareholdersPartners', // i18n key
  order: 6,
  fields: [
    {
      id: 'shareholderName',
      label: 'company.shareholderType', // i18n key
      type: 'input',
      helpText: gemiHelps.shareholder_name_help,
    },
    {
      id: 'shareholderType',
      label: fieldLabels.shareholderType,
      type: 'select',
      options: [...SHAREHOLDER_TYPE_OPTIONS],
      helpText: gemiHelps.shareholder_type_help,
    },
    // Additional fields...
  ],
};

// Quick simplified sections για completeness - 🏢 i18n keys
const photosSection: SectionConfig = { id: 'companyPhotos', title: 'sections.logoPhotos', icon: 'image', order: 5, fields: [], description: 'sectionDescriptions.logoPhotos' };
const bankingSection: SectionConfig = { id: 'banking', title: 'sections.banking', icon: 'credit-card', order: 6, fields: [], description: 'sectionDescriptions.banking' };
const relationshipsSection: SectionConfig = { id: 'relationships', title: 'sections.peopleRoles', icon: 'users', order: 7, fields: [], description: 'sectionDescriptions.peopleRoles' };
const filesSection: SectionConfig = { id: 'files', title: 'sections.files', icon: 'file-text', order: 8, fields: [], description: 'sectionDescriptions.files' };
const historySection: SectionConfig = { id: 'history', title: 'sections.history', icon: 'history', order: 9, fields: [], description: 'sectionDescriptions.history' };
// representativesSection REMOVED — merged into relationshipsSection (Πρόσωπα & Ρόλοι)
const decisionsSection: SectionConfig = { id: 'decisions', title: 'sections.organDecisions', icon: 'gavel', order: 10, fields: [], description: 'sectionDescriptions.organDecisions' };
const announcementsSection: SectionConfig = { id: 'announcements', title: 'sections.announcementsPublications', icon: 'megaphone', order: 11, fields: [], description: 'sectionDescriptions.announcementsPublications' };
const statusesSection: SectionConfig = { id: 'statuses', title: 'sections.statusesLifecycle', icon: 'activity', order: 12, fields: [], description: 'sectionDescriptions.statusesLifecycle' };

// ============================================================================
// SECTION REGISTRY
// ============================================================================

/**
 * Master registry όλων των GEMI sections
 * ENTERPRISE: Auto-sorted sections με modular imports
 */
export const COMPANY_GEMI_SECTIONS: SectionConfig[] = [
  // Modular sections (fully implemented)
  basicInfoSection,
  activitiesSection,

  // Remaining sections
  addressesSection,
  communicationSection, // 🏢 ENTERPRISE: Communication tab for companies (phones, emails, websites, social media)
  filesSection,
  photosSection,
  relationshipsSection,
  bankingSection, // 🏢 ENTERPRISE: Banking System (ADR-126)
  historySection, // 📜 Unified History: Audit Trail + Photo Shares (reuses ContactHistoryTab)
].sort((a, b) => a.order - b.order); // Auto-sort by order