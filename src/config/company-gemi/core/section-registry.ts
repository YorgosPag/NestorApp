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
  SHAREHOLDER_TYPE_OPTIONS,
  DOCUMENT_TYPE_OPTIONS,
  BOARD_TYPE_OPTIONS,
  REPRESENTATIVE_POSITION_OPTIONS,
  getLifecycleGemiStatuses
} from '../options';

// ============================================================================
// REMAINING SECTIONS (TO BE SPLIT FURTHER IF NEEDED)
// ============================================================================

// Temporary sections που θα μπορούσαν να γίνουν μελλοντικά modular αν χρειαστεί
const datesLocationSection: SectionConfig = {
  id: 'datesLocation',
  title: 'Ημερομηνίες & Τοποθεσία',
  icon: 'calendar',
  description: 'Χρονολογικά και γεωγραφικά στοιχεία',
  order: 4,
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
  title: 'Διευθύνσεις & Υποκαταστήματα',
  icon: 'map-pin',
  description: 'Έδρα και υποκαταστήματα εταιρείας',
  order: 5,
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

// Add more simplified sections για demonstration...
const shareholdersSection: SectionConfig = {
  id: 'shareholders',
  title: 'Μετοχική Σύνθεση & Εταίροι',
  icon: 'users',
  description: 'Μέτοχοι και εταιρική σύνθεση',
  order: 6,
  fields: [
    {
      id: 'shareholderName',
      label: 'Όνομα Μετόχου',
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

// Quick simplified sections για completeness
const documentsSection: SectionConfig = { id: 'documents', title: 'Έγγραφα & Πιστοποιητικά', icon: 'file-text', order: 7, fields: [], description: 'Έγγραφα ΓΕΜΗ' };
const decisionsSection: SectionConfig = { id: 'decisions', title: 'Αποφάσεις Οργάνων', icon: 'gavel', order: 8, fields: [], description: 'Αποφάσεις συμβουλίων' };
const historySection: SectionConfig = { id: 'companyVersions', title: 'Ιστορικό & Μεταβολές', icon: 'history', order: 9, fields: [], description: 'Ιστορικό εκδόσεων' };
const representativesSection: SectionConfig = { id: 'representatives', title: 'Εκπρόσωποι & Διοίκηση', icon: 'user-check', order: 10, fields: [], description: 'Νόμιμοι εκπρόσωποι' };
const announcementsSection: SectionConfig = { id: 'announcements', title: 'Ανακοινώσεις & Δημοσιεύσεις', icon: 'megaphone', order: 11, fields: [], description: 'Ανακοινώσεις εταιρείας' };
const statusesSection: SectionConfig = { id: 'statuses', title: 'Καταστάσεις & Lifecycle', icon: 'activity', order: 12, fields: [], description: 'Ιστορικό καταστάσεων' };
const photosSection: SectionConfig = { id: 'companyPhotos', title: 'Λογότυπο & Φωτογραφίες', icon: 'image', order: 13, fields: [], description: 'Λογότυπο εταιρείας' };
const relationshipsSection: SectionConfig = { id: 'relationships', title: 'Μέτοχοι & Εργαζόμενοι', icon: 'users', order: 14, fields: [], description: 'Διαχείριση μετόχων' };

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
  shareholdersSection,
  documentsSection,
  decisionsSection,
  historySection,
  representativesSection,
  announcementsSection,
  statusesSection,
  photosSection,
  relationshipsSection,
].sort((a, b) => a.order - b.order); // Auto-sort by order