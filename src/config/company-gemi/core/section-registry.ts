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
import { capitalSection } from '../sections/capital';

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

// Temporary sections που θα μπορούσαν να γίνουν μελλοντικά modular αν χρειαστεί
// 🏢 i18n: Uses i18n keys that are translated at runtime by GenericFormRenderer
const datesLocationSection: SectionConfig = {
  id: 'datesLocation',
  title: 'sections.datesLocation', // i18n key
  icon: 'calendar',
  description: 'sectionDescriptions.datesLocation', // i18n key
  order: 5, // 🔄 Moved from 4 to 5 (addresses is now 2nd)
  fields: [
    {
      id: 'registrationDate',
      label: fieldLabels.registrationDate,
      type: 'date',
      helpText: gemiHelps.registration_date_help,
    },
    {
      id: 'gemiStatusDate',
      label: fieldLabels.statusDate,
      type: 'date',
      helpText: gemiHelps.last_change_date_help,
    },
    {
      id: 'prefecture',
      label: fieldLabels.prefecture,
      type: 'input',
      helpText: gemiHelps.region_help,
    },
    {
      id: 'municipality',
      label: fieldLabels.municipality,
      type: 'input',
      helpText: gemiHelps.municipality_help,
    },
    {
      id: 'gemiDepartment',
      label: fieldLabels.gemiDepartment,
      type: 'input',
      helpText: gemiHelps.local_office_help,
    },
  ],
};

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
  order: 2.5, // Between addresses (2) and activities (3)
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
const documentsSection: SectionConfig = { id: 'documents', title: 'sections.documentsCertificates', icon: 'file-text', order: 7, fields: [], description: 'sectionDescriptions.documentsCertificates' };
const decisionsSection: SectionConfig = { id: 'decisions', title: 'sections.organDecisions', icon: 'gavel', order: 8, fields: [], description: 'sectionDescriptions.organDecisions' };
const historySection: SectionConfig = { id: 'companyVersions', title: 'sections.historyChanges', icon: 'history', order: 9, fields: [], description: 'sectionDescriptions.historyChanges' };
const representativesSection: SectionConfig = { id: 'representatives', title: 'sections.representativesManagement', icon: 'user-check', order: 10, fields: [], description: 'sectionDescriptions.representativesManagement' };
const announcementsSection: SectionConfig = { id: 'announcements', title: 'sections.announcementsPublications', icon: 'megaphone', order: 11, fields: [], description: 'sectionDescriptions.announcementsPublications' };
const statusesSection: SectionConfig = { id: 'statuses', title: 'sections.statusesLifecycle', icon: 'activity', order: 12, fields: [], description: 'sectionDescriptions.statusesLifecycle' };
const photosSection: SectionConfig = { id: 'companyPhotos', title: 'sections.logoPhotos', icon: 'image', order: 13, fields: [], description: 'sectionDescriptions.logoPhotos' };
const relationshipsSection: SectionConfig = { id: 'relationships', title: 'sections.shareholdersEmployees', icon: 'users', order: 14, fields: [], description: 'sectionDescriptions.shareholdersPartners' };

// 🏢 ENTERPRISE: Banking System (ADR-126)
const bankingSection: SectionConfig = { id: 'banking', title: 'sections.banking', icon: 'credit-card', order: 15, fields: [], description: 'sectionDescriptions.banking' };

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
  capitalSection,

  // Remaining sections (simplified για demo)
  datesLocationSection,
  addressesSection,
  communicationSection, // 🏢 ENTERPRISE: Communication tab for companies (phones, emails, websites, social media)
  shareholdersSection,
  documentsSection,
  decisionsSection,
  historySection,
  representativesSection,
  announcementsSection,
  statusesSection,
  photosSection,
  relationshipsSection,
  bankingSection, // 🏢 ENTERPRISE: Banking System (ADR-126)
].sort((a, b) => a.order - b.order); // Auto-sort by order