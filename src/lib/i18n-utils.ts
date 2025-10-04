/**
 * Utility functions for i18n that can be used outside React components
 * These functions provide translations for utility/helper functions
 */

import i18n from '@/i18n/config';

// Helper to get translations in non-React contexts
export const getTranslation = (namespace: string, key: string, options?: any) => {
  return i18n.t(`${namespace}.${key}`, options);
};

// Building-specific utility translations
export const getBuildingTranslations = () => ({
  // Floor labels
  formatFloorLabel: (floor: number): string => {
    if (floor === 0) return getTranslation('building', 'floors.ground');
    if (floor < 0) return getTranslation('building', 'floors.basement', { number: Math.abs(floor) });
    if (floor === 1) return getTranslation('building', 'floors.firstFloor');
    if (floor === 2) return getTranslation('building', 'floors.secondFloor');
    if (floor === 3) return getTranslation('building', 'floors.thirdFloor');
    return getTranslation('building', 'floors.floor', { number: floor });
  },

  // Category labels
  getCategoryLabel: (category: string): string => {
    const key = `categories.${category}`;
    const translated = getTranslation('building', key);
    return translated !== key ? translated : category;
  },

  // Status labels
  getStatusLabel: (status: string): string => {
    const key = `status.${status}`;
    const translated = getTranslation('building', key);
    return translated !== key ? translated : status;
  },

  // Units
  getPricePerSqmUnit: (): string => {
    return getTranslation('building', 'units.pricePerSqm');
  },

  getSqmUnit: (): string => {
    return getTranslation('building', 'units.sqm');
  }
});

// Export individual functions for easier imports
export const formatFloorLabel = (floor: number): string => {
  return getBuildingTranslations().formatFloorLabel(floor);
};

export const getCategoryLabel = (category: string): string => {
  return getBuildingTranslations().getCategoryLabel(category);
};

export const getStatusLabel = (status: string): string => {
  return getBuildingTranslations().getStatusLabel(status);
};

export const getPricePerSqmUnit = (): string => {
  return getBuildingTranslations().getPricePerSqmUnit();
};

export const getSqmUnit = (): string => {
  return getBuildingTranslations().getSqmUnit();
};