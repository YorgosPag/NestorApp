/**
 * COMPANY GEMI CAPITAL SECTION
 *
 * Section 3: Κεφάλαιο & Οικονομικά
 * ENTERPRISE: Modular section με centralized systems integration
 *
 * @version 1.0.0 - ENTERPRISE SECTION
 * @updated 2025-12-28 - Split from monolithic company-gemi-config.ts
 */

import { SectionConfig } from '../core/field-types';
import { fieldLabels } from '../labels/field-labels';
import { gemiHelps } from '../labels/help-texts';
import { CURRENCY_OPTIONS } from '../options';

// ============================================================================
// CAPITAL SECTION DEFINITION
// ============================================================================

/**
 * Section 3: Κεφάλαιο & Οικονομικά
 * ENTERPRISE: Uses centralized labels, help texts, και options
 * 🏢 i18n: Uses i18n keys that are translated at runtime by GenericFormRenderer
 */
export const capitalSection: SectionConfig = {
  id: 'capital',
  title: 'sections.capitalFinancials', // i18n key
  icon: 'dollar-sign',
  description: 'sectionDescriptions.capitalFinancials', // i18n key (will fallback if not exists)
  order: 4, // 🔄 Moved from 3 to 4 (addresses is now 2nd)
  fields: [
    {
      id: 'capitalAmount',
      label: fieldLabels.capitalAmount,
      type: 'number',
      placeholder: 'π.χ. 50000',
      helpText: gemiHelps.capital_amount_help,
    },
    {
      id: 'currency',
      label: fieldLabels.currency,
      type: 'select',
      options: CURRENCY_OPTIONS,
      defaultValue: 'EUR',
      helpText: gemiHelps.currency_help,
    },
    {
      id: 'extraordinaryCapital',
      label: fieldLabels.extraordinaryCapital,
      type: 'number',
      helpText: gemiHelps.guarantee_capital_help,
    },
  ],
};