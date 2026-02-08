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
import { PROPERTY_TYPE_LABELS, PROPERTY_FILTER_LABELS } from '@/constants/property-statuses-enterprise';
// 🏢 ENTERPRISE: Use centralized property type options - NO MORE HARDCODED VALUES
import { getPropertyTypeOptions } from '@/subapps/dxf-viewer/config/modal-select';

// 🗑️ REMOVED: TYPE_OPTIONS - Use EnterprisePropertyTypesService
//
// Migration completed to enterprise service.
// Use: await propertyTypesService.getPropertyTypesForSelect(tenantId, locale, environment)

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

    // Fallback to centralized labels
    return [
      { value: 'all', label: PROPERTY_FILTER_LABELS.ALL_TYPES, category: 'mixed' },
      ...Object.entries(PROPERTY_TYPE_LABELS).map(([value, label]) => ({
        value,
        label,
        category: 'mixed'
      }))
    ];
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

      const result: Array<{ value: string; label: string; category?: string }> = propertyTypes.map(pt => ({
        value: pt.value,
        label: pt.label,
        category: pt.category
      }));

      if (includeAll) {
        result.unshift({
          value: 'all',
          label: PROPERTY_FILTER_LABELS.ALL_TYPES,
          category: category ?? 'mixed'
        });
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

    // ✅ ENTERPRISE: Enhanced fallback using centralized property types - NO MORE HARDCODED VALUES
    const fallbackTypes = getPropertyTypeOptions().map(option => ({
      value: option.value,
      label: option.label,
      category: 'mixed'
    }));

    let filteredTypes = category
      ? fallbackTypes.filter(type => type.category === category)
      : fallbackTypes;

    if (includeAll) {
      filteredTypes = [
        { value: 'all', label: PROPERTY_FILTER_LABELS.ALL_TYPES, category: category ?? 'mixed' },
        ...filteredTypes
      ];
    }

    return filteredTypes;
  }
}

// 🗑️ REMOVED: getLegacyTypeOptions - Use getEnterprisePropertyTypes
//
// Migration completed to enterprise service.

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
  loadPropertyTypes,
  getEnterprisePropertyTypes,
  migratePropertyTypeValue
};
