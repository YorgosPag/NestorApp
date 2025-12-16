/**
 * 🏠 PROPERTY GRID CONSTANTS
 *
 * Enterprise-ready property grid configuration using database-driven property types.
 * Replaces hardcoded TYPE_OPTIONS with EnterprisePropertyTypesService.
 *
 * @deprecated Use EnterprisePropertyTypesService.getPropertyTypesForSelect() instead
 * @enterprise-migration true
 * @version 2.0.0
 */

import { propertyTypesService } from '@/services/property/EnterprisePropertyTypesService';

/**
 * @deprecated Hardcoded property types - Use EnterprisePropertyTypesService instead
 *
 * MIGRATION PATH:
 * Before: TYPE_OPTIONS
 * After: await propertyTypesService.getPropertyTypesForSelect(tenantId, locale, environment)
 *
 * This fallback will be removed in v3.0.0
 */
export const TYPE_OPTIONS = [
  { value: 'all', label: 'Όλοι οι τύποι' },
  { value: 'studio', label: 'Στούντιο' },
  { value: 'garsoniera', label: 'Γκαρσονιέρα' },
  { value: 'apartment', label: 'Διαμέρισμα' },
  { value: 'maisonette', label: 'Μεζονέτα' },
  { value: 'warehouse', label: 'Αποθήκη' },
  { value: 'parking', label: 'Parking' },
] as const;

/**
 * Enterprise property types loader function
 *
 * @example
 * ```typescript
 * const propertyTypes = await loadPropertyTypes('my-tenant', 'el');
 * ```
 */
export async function loadPropertyTypes(
  tenantId: string = 'default',
  locale: string = 'el',
  environment: string = 'production',
  includeAll: boolean = true
): Promise<Array<{ value: string; label: string; category?: string }>> {
  try {
    // Try to load from enterprise service
    return await propertyTypesService.getPropertyTypesForSelect(
      tenantId,
      locale,
      environment,
      includeAll
    );
  } catch (error) {
    console.warn('🏠 Failed to load property types from service, using fallback:', error);

    // Fallback to hardcoded values
    return TYPE_OPTIONS.map(option => ({
      value: option.value,
      label: option.label
    }));
  }
}

/**
 * Get property types with enterprise support and fallback
 *
 * @param options Configuration options
 * @returns Promise resolving to property types array
 */
export async function getEnterprisePropertyTypes(options: {
  tenantId?: string;
  locale?: string;
  environment?: string;
  category?: 'residential' | 'commercial' | 'industrial' | 'special' | 'mixed';
  includeAll?: boolean;
} = {}): Promise<Array<{ value: string; label: string; category?: string }>> {
  const {
    tenantId = 'default',
    locale = 'el',
    environment = 'production',
    category,
    includeAll = true
  } = options;

  try {
    if (category) {
      // Get property types for specific category
      const propertyTypes = await propertyTypesService.getPropertyTypes(
        tenantId,
        locale,
        environment,
        category
      );

      const result = propertyTypes.map(pt => ({
        value: pt.value,
        label: pt.label,
        category: pt.category
      }));

      if (includeAll) {
        result.unshift({ value: 'all', label: 'Όλοι οι τύποι' });
      }

      return result;
    } else {
      // Get all property types
      return await propertyTypesService.getPropertyTypesForSelect(
        tenantId,
        locale,
        environment,
        includeAll
      );
    }
  } catch (error) {
    console.warn('🏠 Failed to load enterprise property types, using fallback:', error);

    // Enhanced fallback with categories
    const fallbackTypes = [
      { value: 'studio', label: 'Στούντιο', category: 'residential' },
      { value: 'garsoniera', label: 'Γκαρσονιέρα', category: 'residential' },
      { value: 'apartment', label: 'Διαμέρισμα', category: 'residential' },
      { value: 'maisonette', label: 'Μεζονέτα', category: 'residential' },
      { value: 'warehouse', label: 'Αποθήκη', category: 'commercial' },
      { value: 'parking', label: 'Parking', category: 'commercial' },
    ];

    let filteredTypes = category
      ? fallbackTypes.filter(type => type.category === category)
      : fallbackTypes;

    if (includeAll) {
      filteredTypes = [{ value: 'all', label: 'Όλοι οι τύποι' }, ...filteredTypes];
    }

    return filteredTypes;
  }
}

/**
 * Legacy type options getter with deprecation warning
 * @deprecated Use getEnterprisePropertyTypes() instead
 */
export function getLegacyTypeOptions() {
  console.warn(
    '⚠️ TYPE_OPTIONS is deprecated. Use getEnterprisePropertyTypes() for database-driven property types.'
  );
  return TYPE_OPTIONS;
}

/**
 * Migration helper to convert old type values to new format
 */
export function migratePropertyTypeValue(oldValue: string): string {
  const migrations: Record<string, string> = {
    'Στούντιο': 'studio',
    'Γκαρσονιέρα': 'garsoniera',
    'Διαμέρισμα': 'apartment',
    'Μεζονέτα': 'maisonette',
    'Αποθήκη': 'warehouse',
    'Parking': 'parking'
  };

  return migrations[oldValue] || oldValue;
}

// Default export
export default {
  TYPE_OPTIONS, // @deprecated
  loadPropertyTypes,
  getEnterprisePropertyTypes,
  getLegacyTypeOptions,
  migratePropertyTypeValue
};
