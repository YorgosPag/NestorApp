'use client';

// ============================================================================
// PHOTOS TAB BASE - ENTERPRISE TEMPLATE COMPONENT
// ============================================================================
//
// ADR-018: Upload Systems Centralization
// Template component for all PhotosTab implementations
//
// Features:
// - Entity-agnostic (works with Project, Building, Contact, Storage, etc.)
// - Controlled & Uncontrolled modes
// - Optional stats section
// - Optional category filtering
// - Uses existing centralized components (EnterprisePhotoUpload, PhotoItem)
//
// Enterprise Standards:
// - Zero `any` types
// - Zero inline styles
// - Semantic HTML (article, section)
// - Uses design tokens from photo-config
//
// ============================================================================

import React, { useMemo } from 'react';
import { Camera, Upload, Image } from 'lucide-react';

// Design system hooks
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

// Existing centralized components - NO DUPLICATION
import { EnterprisePhotoUpload } from '@/components/ui/EnterprisePhotoUpload';
import { PhotoItem } from '../../utils/PhotoItem';

// Local hooks and config
import { usePhotosTabState } from '../hooks/usePhotosTabState';
import { usePhotosTabUpload } from '../hooks/usePhotosTabUpload';
import { usePhotosCategories } from '../hooks/usePhotosCategories';
import { getPhotosTabConfig, getGridClasses } from '../config/photos-tab-config';

// Types
import type {
  BaseEntity,
  PhotosTabBaseProps,
  PhotoCategory,
  CategoryStats,
} from '../config/photos-tab-types';

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

/**
 * Stats section for photo categories
 */
interface StatsProps {
  totalCount: number;
  categoryStats: CategoryStats[];
  categories?: PhotoCategory[];
}

function PhotosTabStats({ totalCount, categoryStats, categories }: StatsProps) {
  const iconSizes = useIconSizes();

  if (!categories || categories.length === 0) {
    return null;
  }

  return (
    <section className="p-6">
      <h3 className="font-semibold mb-4 flex items-center gap-2">
        <Camera className={iconSizes.md} />
        Επισκόπηση Φωτογραφιών
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {categories.map((category) => {
          const stat = categoryStats.find((s) => s.categoryId === category.id);
          return (
            <div
              key={category.id}
              className="bg-card border rounded-lg p-4 text-center"
            >
              <div className={`text-2xl font-bold ${category.colorClass || 'text-blue-600'}`}>
                {stat?.count || 0}
              </div>
              <div className="text-sm text-muted-foreground">{category.label}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/**
 * Category filter navigation
 */
interface CategoriesProps {
  categories: PhotoCategory[];
  activeCategory: string;
  onCategoryChange: (categoryId: string) => void;
  categoryStats: CategoryStats[];
}

function PhotosTabCategories({
  categories,
  activeCategory,
  onCategoryChange,
  categoryStats,
}: CategoriesProps) {
  return (
    <nav className="flex flex-wrap gap-2 mb-4" role="tablist">
      {categories.map((category) => {
        const stat = categoryStats.find((s) => s.categoryId === category.id);
        const isActive = activeCategory === category.id;
        return (
          <button
            key={category.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onCategoryChange(category.id)}
            className={`
              px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${isActive
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }
            `}
          >
            {category.label} ({stat?.count || 0})
          </button>
        );
      })}
    </nav>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * PhotosTabBase - Enterprise Template Component
 *
 * Replaces all entity-specific PhotosTab implementations with a single,
 * configurable template component.
 *
 * @template TEntity - Entity type (must have id and optionally name)
 *
 * @example
 * // Simple usage (Project)
 * <PhotosTabBase
 *   entity={project}
 *   entityType="project"
 * />
 *
 * @example
 * // With categories (Storage)
 * <PhotosTabBase
 *   entity={storage}
 *   entityType="storage"
 *   entityName={storage.name}
 * />
 *
 * @example
 * // Form-controlled mode (Contact)
 * <PhotosTabBase
 *   entity={contact}
 *   entityType="contact"
 *   photos={formData.photos}
 *   onPhotosChange={(photos) => setFormData({ ...formData, photos })}
 *   disabled={isViewMode}
 * />
 */
export function PhotosTabBase<TEntity extends BaseEntity>({
  entity,
  entityType,
  entityName,
  configOverrides,
  photos: externalPhotos,
  onPhotosChange: externalOnPhotosChange,
  disabled = false,
  isLoading = false,
  className,
  onPhotoClick,
  onPhotoDelete,
}: PhotosTabBaseProps<TEntity>) {
  // ---------------------------------------------------------------------------
  // Design system hooks
  // ---------------------------------------------------------------------------
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();

  // ---------------------------------------------------------------------------
  // Get merged configuration
  // ---------------------------------------------------------------------------
  const config = useMemo(
    () => getPhotosTabConfig(entityType, configOverrides),
    [entityType, configOverrides]
  );

  // ---------------------------------------------------------------------------
  // Resolve entity name
  // ---------------------------------------------------------------------------
  const resolvedEntityName = entityName || entity.name || entity.id;

  // ---------------------------------------------------------------------------
  // State management (internal or external)
  // ---------------------------------------------------------------------------
  const {
    photos,
    setPhotos,
    currentFile,
    setCurrentFile,
    isControlled,
  } = usePhotosTabState({
    externalPhotos,
    externalOnPhotosChange,
    entityType,
    entityId: entity.id,
  });

  // ---------------------------------------------------------------------------
  // Upload logic
  // ---------------------------------------------------------------------------
  const uploadLogic = usePhotosTabUpload({
    photos,
    setPhotos,
    currentFile,
    setCurrentFile,
    config,
    entityId: entity.id,
    entityName: resolvedEntityName,
  });

  // ---------------------------------------------------------------------------
  // Category filtering
  // ---------------------------------------------------------------------------
  const {
    activeCategory,
    setActiveCategory,
    filteredPhotos,
    categoryStats,
  } = usePhotosCategories({
    photos,
    categories: config.categories,
    enabled: config.showCategories,
  });

  // ---------------------------------------------------------------------------
  // Grid classes
  // ---------------------------------------------------------------------------
  const gridClasses = getGridClasses(config.gridCols);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <article className={`space-y-6 ${className || ''}`}>
      {/* Stats Section (optional) */}
      {config.showStats && config.categories && (
        <PhotosTabStats
          totalCount={photos.length}
          categoryStats={categoryStats}
          categories={config.categories}
        />
      )}

      {/* Upload Section */}
      {!disabled && (
        <section className={`${colors.bg.primary} rounded-lg border p-6`}>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Upload className={iconSizes.md} />
            {config.title}
          </h3>

          {/* Entity info (optional) */}
          {config.showEntityInfo && (
            <div className="mb-4 p-4 bg-accent/50 rounded-lg">
              <div className="text-sm">
                <span className="font-medium text-muted-foreground">
                  {entityType === 'storage' ? 'Αποθήκη' :
                   entityType === 'building' ? 'Κτίριο' :
                   entityType === 'project' ? 'Έργο' :
                   entityType === 'unit' ? 'Μονάδα' :
                   entityType === 'parking' ? 'Θέση' : 'Entity'}:
                </span>
                <span className="ml-2">{resolvedEntityName}</span>
              </div>
            </div>
          )}

          <EnterprisePhotoUpload
            purpose={config.uploadPurpose === 'logo' ? 'logo' : 'photo'}
            maxSize={config.maxFileSize}
            photoFile={currentFile}
            onFileChange={uploadLogic.handleFileChange}
            onUploadComplete={uploadLogic.handleUploadComplete}
            disabled={disabled || isLoading}
          />
        </section>
      )}

      {/* Categories Navigation (optional) */}
      {config.showCategories && config.categories && (
        <PhotosTabCategories
          categories={config.categories}
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
          categoryStats={categoryStats}
        />
      )}

      {/* Photo Grid */}
      <section>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Image className={iconSizes.md} />
          {config.showCategories
            ? `Φωτογραφίες (${filteredPhotos.length})`
            : `Όλες οι Φωτογραφίες (${photos.length})`}
        </h3>

        {filteredPhotos.length > 0 ? (
          <div className={gridClasses}>
            {filteredPhotos.map((photo, index) => (
              <PhotoItem
                key={photo.id}
                photo={photo}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Image className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p>Δεν υπάρχουν φωτογραφίες</p>
            {!disabled && (
              <p className="text-sm mt-2">
                Χρησιμοποιήστε την περιοχή ανεβάσματος παραπάνω για να προσθέσετε φωτογραφίες
              </p>
            )}
          </div>
        )}
      </section>
    </article>
  );
}

export default PhotosTabBase;
