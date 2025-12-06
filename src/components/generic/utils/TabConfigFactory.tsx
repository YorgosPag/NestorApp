import React from 'react';
import type { SectionConfig } from '@/config/company-gemi-config';
import type { IndividualSectionConfig } from '@/config/individual-config';
import type { ServiceSectionConfig } from '@/config/service-config';
import { getIconComponent } from './IconMapping';
import { CompanyPhotosPreview, IndividualPhotosPreview, ServiceLogoPreview } from './PhotosPreview';
import { GenericTabRenderer } from '../GenericTabRenderer';

// Re-export IconMapping για convenience
export { getIconComponent } from './IconMapping';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface TabConfig {
  id: string;
  label: string;
  icon: React.ComponentType<any> | React.FC<any>;
  content: React.ReactNode;
}

export type ContactType = 'company' | 'individual' | 'service';

export interface TabFactoryOptions {
  data: Record<string, any>;
  customRenderers?: Record<string, any>;
  valueFormatters?: Record<string, any>;
  onPhotoClick?: (photoUrl: string, photoIndex: number, galleryPhotos?: (string | null)[]) => void;
}

// Union type για all section configs
type AnySectionConfig = SectionConfig | IndividualSectionConfig | ServiceSectionConfig;

// ============================================================================
// 🔥 UNIFIED TAB CONFIG FACTORY
// ============================================================================

/**
 * ENTERPRISE TAB CONFIG FACTORY
 *
 * Εξαλείφει τα τριπλότυπα από ConfigTabsHelper:
 * - createTabsFromConfig() ❌ → createTabsFromConfig() ✅
 * - createIndividualTabsFromConfig() ❌ → createTabsFromConfig() ✅
 * - createServiceTabsFromConfig() ❌ → createTabsFromConfig() ✅
 *
 * Single generic factory που handle όλους τους contact types με:
 * - Generic type-safe section config handling
 * - Unified photo preview rendering
 * - Contact type-specific data mapping
 * - Zero code duplication
 * - Consistent tab creation logic
 *
 * Features:
 * - Type-safe section config processing
 * - Automatic photo tab detection και rendering
 * - Data field mapping για service compatibility
 * - Unified icon resolution
 * - Reusable PhotosPreview integration
 */
export function createTabsFromConfig(
  contactType: ContactType,
  sections: AnySectionConfig[],
  options: TabFactoryOptions
): TabConfig[] {
  // Enterprise: Defensive programming - null safety
  if (!options || !options.data) {
    console.error('TabConfigFactory: Invalid options provided', { contactType, options });
    throw new Error(`TabConfigFactory: options.data is required for contactType "${contactType}"`);
  }

  // Enterprise: Avoid naming conflicts
  const contactData = options.data;
  const customRenderers = options.customRenderers;
  const valueFormatters = options.valueFormatters;
  const onPhotoClick = options.onPhotoClick;

  // ========================================================================
  // DATA MAPPING για SERVICE COMPATIBILITY
  // ========================================================================

  const getMappedData = () => {
    if (contactType === 'service') {
      // 🔧 Service Field Mapping Adapter
      // Το service-config χρησιμοποιεί 'name' ενώ η βάση δεδομένων αποθηκεύει 'serviceName'
      return {
        ...contactData,
        name: contactData.serviceName || contactData.name,
        email: contactData.emails?.[0]?.email || '',
        phone: contactData.phones?.[0]?.number || '',
        logoPreview: contactData.logoPreview || contactData.logoURL || '',
        logoURL: contactData.logoURL || '',
        photoPreview: contactData.photoPreview || contactData.photoURL || '',
        photoURL: contactData.photoURL || '',
      };
    }
    return contactData;
  };

  const mappedData = getMappedData();

  // ========================================================================
  // PHOTO TAB DETECTION & RENDERING
  // ========================================================================

  const getPhotoTabContent = (section: AnySectionConfig) => {
    // Company photos tab
    if (contactType === 'company' && section.id === 'companyPhotos') {
      return (
        <CompanyPhotosPreview
          logoUrl={mappedData.logoPreview || mappedData.logoURL}
          photoUrl={mappedData.photoPreview || mappedData.photoURL || mappedData.representativePhotoURL}
          onPhotoClick={onPhotoClick}
        />
      );
    }

    // Individual photos tab
    if (contactType === 'individual' && section.id === 'photo') {
      return (
        <IndividualPhotosPreview
          photoUrl={mappedData.photoPreview || mappedData.photoURL}
          multiplePhotoURLs={mappedData.multiplePhotoURLs || []}
          onPhotoClick={(photoUrl, photoIndex) => onPhotoClick?.(photoUrl, photoIndex)}
        />
      );
    }

    // Service logo tab
    if (contactType === 'service' && section.id === 'logo') {
      return (
        <ServiceLogoPreview
          logoUrl={mappedData.logoPreview || mappedData.logoURL}
          onPhotoClick={onPhotoClick}
        />
      );
    }

    // Default generic tab rendering
    return (
      <GenericTabRenderer
        section={section}
        data={mappedData}
        mode="display"
        customRenderers={customRenderers}
        valueFormatters={valueFormatters}
      />
    );
  };

  // ========================================================================
  // TAB CREATION LOGIC
  // ========================================================================

  return sections.map((section: AnySectionConfig) => {
    // ========================================================================
    // SMART LABEL LOGIC για relationships tab
    // ========================================================================

    let displayLabel = section.title;

    // Αν είναι relationships section και υπάρχει custom renderer, προσθέτουμε indicator
    if (section.id === 'relationships' && customRenderers?.relationships) {
      // Προσθέτουμε ένα visual indicator που δείχνει ότι υπάρχει ενεργό content
      displayLabel = `${section.title} 🔗`;
    }

    return {
      id: section.id,
      label: displayLabel,
      icon: getIconComponent(section.icon),
      content: getPhotoTabContent(section),
    };
  });
}

// ============================================================================
// LEGACY COMPATIBILITY FUNCTIONS (για backward compatibility)
// ============================================================================

/**
 * Company tabs creation (legacy compatibility)
 */
export function createCompanyTabsFromConfig(
  sections: SectionConfig[],
  data: Record<string, any>,
  customRenderers?: Record<string, any>,
  valueFormatters?: Record<string, any>,
  onPhotoClick?: (photoUrl: string, photoIndex: number, galleryPhotos?: (string | null)[]) => void
): TabConfig[] {
  return createTabsFromConfig('company', sections, {
    data,
    customRenderers,
    valueFormatters,
    onPhotoClick
  });
}

/**
 * Individual tabs creation (legacy compatibility)
 */
export function createIndividualTabsFromConfig(
  sections: IndividualSectionConfig[],
  data: Record<string, any>,
  customRenderers?: Record<string, any>,
  valueFormatters?: Record<string, any>,
  onPhotoClick?: (photoUrl: string, photoIndex: number) => void
): TabConfig[] {
  return createTabsFromConfig('individual', sections, {
    data,
    customRenderers,
    valueFormatters,
    onPhotoClick: onPhotoClick ? (photoUrl, photoIndex) => onPhotoClick(photoUrl, photoIndex) : undefined
  });
}

/**
 * Service tabs creation (legacy compatibility)
 */
export function createServiceTabsFromConfig(
  sections: ServiceSectionConfig[],
  data: Record<string, any>,
  customRenderers?: Record<string, any>,
  valueFormatters?: Record<string, any>,
  onPhotoClick?: (photoUrl: string, photoIndex: number, galleryPhotos?: (string | null)[]) => void
): TabConfig[] {
  return createTabsFromConfig('service', sections, {
    data,
    customRenderers,
    valueFormatters,
    onPhotoClick
  });
}

/**
 * Single tab creation (legacy compatibility)
 */
export function createTabFromSection(
  section: SectionConfig,
  data: Record<string, any>,
  customRenderers?: Record<string, any>,
  valueFormatters?: Record<string, any>
): TabConfig {
  return {
    id: section.id,
    label: section.title,
    icon: getIconComponent(section.icon),
    content: (
      <GenericTabRenderer
        section={section}
        data={data}
        mode="display"
        customRenderers={customRenderers}
        valueFormatters={valueFormatters}
      />
    ),
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  createTabsFromConfig,
  createCompanyTabsFromConfig,
  createIndividualTabsFromConfig,
  createServiceTabsFromConfig,
  createTabFromSection
};