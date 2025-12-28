/**
 * COMPANY GEMI ACTIVITIES SECTION
 *
 * Section 2: Δραστηριότητες & ΚΑΔ
 * ENTERPRISE: Modular section με centralized systems integration
 *
 * @version 1.0.0 - ENTERPRISE SECTION
 * @updated 2025-12-28 - Split from monolithic company-gemi-config.ts
 */

import { SectionConfig } from '../core/field-types';
import { fieldLabels } from '../labels/field-labels';
import { gemiHelps } from '../labels/help-texts';
import { ACTIVITY_TYPE_OPTIONS } from '../options';

// ============================================================================
// ACTIVITIES SECTION DEFINITION
// ============================================================================

/**
 * Section 2: Δραστηριότητες & ΚΑΔ
 * ENTERPRISE: Uses centralized labels, help texts, και options
 */
export const activitiesSection: SectionConfig = {
  id: 'activities',
  title: 'Δραστηριότητες & ΚΑΔ',
  icon: 'file-text',
  description: 'Κωδικοί και περιγραφές επιχειρηματικής δραστηριότητας',
  order: 2,
  fields: [
    {
      id: 'activityCodeKAD',
      label: fieldLabels.activityCode,
      type: 'input',
      placeholder: 'π.χ. 47.11.10',
      helpText: gemiHelps.kad_code_help,
    },
    {
      id: 'activityDescription',
      label: fieldLabels.activityDescription,
      type: 'input',
      helpText: gemiHelps.business_description_help,
    },
    {
      id: 'activityType',
      label: fieldLabels.activityType,
      type: 'select',
      options: ACTIVITY_TYPE_OPTIONS,
      defaultValue: 'main',
      helpText: gemiHelps.activity_category_help,
    },
    {
      id: 'chamber',
      label: fieldLabels.chamber,
      type: 'input',
      helpText: gemiHelps.chamber_office_help,
    },
  ],
};