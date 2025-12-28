/**
 * COMPANY GEMI CURRENCY OPTIONS
 *
 * Enterprise wrapper για currencies από centralized systems
 * ZERO HARDCODED VALUES - Uses existing modal-select system
 *
 * @version 1.0.0 - ENTERPRISE WRAPPER
 * @updated 2025-12-28 - Split from monolithic company-gemi-config.ts
 */

import { SelectOption } from '../core/field-types';

// ENTERPRISE: Import από existing centralized system - ZERO DUPLICATES
import { getCurrencyOptions } from '../../../subapps/dxf-viewer/config/modal-select';

// ============================================================================
// CURRENCY OPTIONS - ENTERPRISE WRAPPER
// ============================================================================

/**
 * Get default currencies από centralized system
 * ENTERPRISE: Uses existing getCurrencyOptions - NO HARDCODED VALUES
 */
const getDefaultCurrencies = (): SelectOption[] =>
  getCurrencyOptions().map(currency => ({
    value: currency.value,
    label: currency.label
  }));

/**
 * Currency options με environment configuration
 * ENTERPRISE: Environment-aware loading από centralized system
 */
export const CURRENCY_OPTIONS: SelectOption[] = (() => {
  try {
    // Try to load from environment variable
    const envCurrencies = process.env.NEXT_PUBLIC_CURRENCIES_JSON;
    if (envCurrencies) {
      return JSON.parse(envCurrencies);
    }

    // Or use primary currency from environment
    const primaryCurrency = process.env.NEXT_PUBLIC_PRIMARY_CURRENCY;
    if (primaryCurrency) {
      const defaults = getDefaultCurrencies();
      const primary = defaults.find(c => c.value === primaryCurrency);
      if (primary) {
        return [primary, ...defaults.filter(c => c.value !== primaryCurrency)];
      }
    }
  } catch (error) {
    console.warn('Failed to parse currency configuration, using defaults');
  }
  return getDefaultCurrencies();
})();

/**
 * Get currencies για specific region/jurisdiction
 * ENTERPRISE: Region-specific currency filtering
 */
export function getRegionalCurrencies(region: string = 'EU'): SelectOption[] {
  const allCurrencies = getDefaultCurrencies();

  switch (region.toUpperCase()) {
    case 'EU':
    case 'EUROPE':
      // Prioritize EUR για European companies
      return allCurrencies.filter(c =>
        ['EUR', 'GBP', 'CHF', 'NOK', 'SEK', 'PLN', 'CZK', 'HUF'].includes(c.value)
      );

    case 'GR':
    case 'GREECE':
      // Greece-specific currencies (EUR primary)
      const eurOption = allCurrencies.find(c => c.value === 'EUR');
      const otherOptions = allCurrencies.filter(c => c.value !== 'EUR');
      return eurOption ? [eurOption, ...otherOptions] : allCurrencies;

    default:
      return allCurrencies;
  }
}