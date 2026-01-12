'use client';

// ============================================================================
// USE PHOTOS CATEGORIES - CATEGORY FILTERING HOOK
// ============================================================================
//
// ADR-018: Upload Systems Centralization
// Category filtering and statistics for PhotosTabBase
//
// Features:
// - Active category state
// - Filtered photos based on category
// - Category statistics (count per category)
// - Memoized computations for performance
//
// ============================================================================

import { useState, useMemo, useCallback } from 'react';
import type {
  Photo,
  PhotoCategory,
  CategoryStats,
  UsePhotosCategoriesReturn,
} from '../config/photos-tab-types';

// =============================================================================
// HOOK PROPS
// =============================================================================

export interface UsePhotosCategoriesProps {
  /** Photos array to filter */
  photos: Photo[];
  /** Category definitions */
  categories?: PhotoCategory[];
  /** Whether categories are enabled */
  enabled: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Default category ID (show all)
 */
const DEFAULT_CATEGORY = 'all';

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================

/**
 * Category filtering hook for PhotosTabBase
 *
 * Provides category state management, filtering, and statistics.
 *
 * @example
 * const {
 *   activeCategory,
 *   setActiveCategory,
 *   filteredPhotos,
 *   categoryStats,
 * } = usePhotosCategories({
 *   photos,
 *   categories: STORAGE_PHOTO_CATEGORIES,
 *   enabled: config.showCategories,
 * });
 *
 * // In component:
 * <PhotosTabCategories
 *   categories={categories}
 *   activeCategory={activeCategory}
 *   onCategoryChange={setActiveCategory}
 *   categoryStats={categoryStats}
 * />
 *
 * <PhotosTabGrid photos={filteredPhotos} />
 */
export function usePhotosCategories({
  photos,
  categories,
  enabled,
}: UsePhotosCategoriesProps): UsePhotosCategoriesReturn {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const [activeCategory, setActiveCategoryState] = useState<string>(DEFAULT_CATEGORY);

  // ---------------------------------------------------------------------------
  // Set active category with validation
  // ---------------------------------------------------------------------------
  const setActiveCategory = useCallback(
    (categoryId: string) => {
      // Validate category exists
      if (!enabled || !categories) {
        return;
      }

      const categoryExists = categories.some((cat) => cat.id === categoryId);
      if (categoryExists) {
        setActiveCategoryState(categoryId);
      } else {
        console.warn(`[usePhotosCategories] Category "${categoryId}" not found`);
        setActiveCategoryState(DEFAULT_CATEGORY);
      }
    },
    [enabled, categories]
  );

  // ---------------------------------------------------------------------------
  // Calculate category statistics
  // ---------------------------------------------------------------------------
  const categoryStats = useMemo<CategoryStats[]>(() => {
    if (!enabled || !categories) {
      return [];
    }

    return categories.map((category) => ({
      categoryId: category.id,
      count: photos.filter(category.filter).length,
    }));
  }, [enabled, categories, photos]);

  // ---------------------------------------------------------------------------
  // Filter photos based on active category
  // ---------------------------------------------------------------------------
  const filteredPhotos = useMemo<Photo[]>(() => {
    if (!enabled || !categories) {
      return photos;
    }

    // Find active category
    const category = categories.find((cat) => cat.id === activeCategory);
    if (!category) {
      return photos;
    }

    // Apply filter
    return photos.filter(category.filter);
  }, [enabled, categories, activeCategory, photos]);

  // ---------------------------------------------------------------------------
  // Return API
  // ---------------------------------------------------------------------------
  return {
    activeCategory,
    setActiveCategory,
    filteredPhotos,
    categoryStats,
  };
}

export default usePhotosCategories;
