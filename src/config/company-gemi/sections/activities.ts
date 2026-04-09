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

// ============================================================================
// ACTIVITIES SECTION DEFINITION
// ============================================================================

/**
 * Section 2: Δραστηριότητες & ΚΑΔ
 * ENTERPRISE: Uses section-level custom renderer (ContactKadSection)
 * The 'activities' trigger field is intercepted by GenericFormTabRenderer
 * and replaced with the multi-KAD section component.
 *
 * @see ContactKadSection — dynamic array of primary + secondary ΚΑΔ
 */
export const activitiesSection: SectionConfig = {
  id: 'activities',
  title: 'sections.activitiesKad', // i18n key
  icon: 'file-text',
  description: 'sectionDescriptions.activitiesKad', // i18n key
  order: 4,
  fields: [
    {
      id: 'activities',
      label: 'kad.primaryActivity',
      type: 'input', // Placeholder — section-level custom renderer intercepts this
    },
  ],
};