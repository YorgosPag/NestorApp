/**
 * COMPANY GEMI BASIC INFO SECTION
 *
 * Section 1: Βασικά Στοιχεία ΓΕΜΗ
 * ENTERPRISE: Modular section με centralized systems integration
 *
 * @version 1.0.0 - ENTERPRISE SECTION
 * @updated 2025-12-28 - Split from monolithic company-gemi-config.ts
 */

import { SectionConfig } from '../core/field-types';
import { fieldLabels } from '../labels/field-labels';
import { gemiHelps } from '../labels/help-texts';
import { LEGAL_FORM_OPTIONS, GEMI_STATUS_OPTIONS } from '../options';

// ============================================================================
// BASIC INFO SECTION DEFINITION
// ============================================================================

/**
 * Section 1: Βασικά Στοιχεία ΓΕΜΗ
 * ENTERPRISE: Uses centralized labels, help texts, και options
 * 🏢 i18n: Uses i18n keys that are translated at runtime by GenericFormRenderer
 */
export const basicInfoSection: SectionConfig = {
  id: 'basicInfo',
  title: 'sections.basicInfoGemi', // i18n key
  icon: 'info',
  description: 'sectionDescriptions.basicInfoGemi', // i18n key
  order: 1,
  fields: [
    {
      id: 'companyName',
      label: fieldLabels.companyName,
      type: 'input',
      required: true,
      helpText: gemiHelps.company_name_help,
    },
    {
      id: 'tradeName',
      label: fieldLabels.tradeName,
      type: 'input',
      helpText: gemiHelps.trade_name_help,
    },
    {
      id: 'vatNumber', // FIX: Changed from 'companyVatNumber' to 'vatNumber' to match Contact interface
      label: fieldLabels.vatNumber,
      type: 'input',
      required: true,
      maxLength: 9,
      placeholder: '999999999',
      helpText: gemiHelps.vat_number_help,
    },
    {
      id: 'gemiNumber',
      label: fieldLabels.gemiNumber,
      type: 'input',
      helpText: gemiHelps.gemi_number_help,
    },
    {
      id: 'legalForm',
      label: fieldLabels.legalForm,
      type: 'select',
      options: LEGAL_FORM_OPTIONS,
      helpText: gemiHelps.legal_form_help,
    },
    {
      id: 'gemiStatus',
      label: fieldLabels.gemiStatus,
      type: 'select',
      options: GEMI_STATUS_OPTIONS,
      defaultValue: 'active',
      helpText: gemiHelps.company_status_help,
    },
  ],
};