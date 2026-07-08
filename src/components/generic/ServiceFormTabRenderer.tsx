'use client';

import React from 'react';
import { getIconComponent } from './utils/IconMapping';
import { ServiceFormRenderer, type ServiceFormData, type PhotoData, type CustomFieldRenderer } from './ServiceFormRenderer';
import { FormLogoUploadSection, FormTabsShell, type TabFieldCustomRenderer } from './form-tabs-shell';
import type { PhotoSlot as UploadPhotoSlot } from '@/components/ui/MultiplePhotosUpload';
import type { ServiceSectionConfig } from '@/config/service-config';
// 🏢 ENTERPRISE: i18n support for tab labels
import { useTranslation } from 'react-i18next';
import {
  SERVICE_FORM_NAMESPACES,
  translateFieldValue,
  type FieldTranslator,
} from './i18n/translate-field-value';
import type { ContactFormData } from '@/types/ContactFormTypes';
import { createModuleLogger } from '@/lib/telemetry';
import '@/lib/design-system';

const logger = createModuleLogger('ServiceFormTabRenderer');

// ============================================================================
// INTERFACES
// ============================================================================

/** Photo slot data structure */
interface PhotoSlot {
  uploadUrl?: string;
  url?: string;
  fileName?: string;
  [key: string]: unknown;
}

/** Custom renderer function type (shared tab contract). */
type CustomRendererFn = TabFieldCustomRenderer;

export interface ServiceFormTabRendererProps {
  /** Sections configuration from service config file */
  sections: ServiceSectionConfig[];
  /** Form data object */
  formData: ContactFormData;
  /** Input change handler */
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  /** Select change handler */
  onSelectChange: (name: string, value: string) => void;
  /** Disabled state */
  disabled?: boolean;
  /** Multiple photos change handler (now used for logos too) */
  onPhotosChange?: (photos: PhotoSlot[]) => void;
  /** Custom field renderers for forms */
  customRenderers?: Record<string, CustomRendererFn | (() => React.ReactNode)>;
  /** Optional section footer renderers (rendered below section fields) */
  sectionFooterRenderers?: Record<string, CustomRendererFn>;
  fieldErrors?: Record<string, string>;
  onFieldBlur?: (fieldName: string) => void;
  /** 🏢 ENTERPRISE: Callback when active tab changes (for parent state management) */
  onActiveTabChange?: (tabId: string) => void;
  initialTab?: string;
}

// ============================================================================
// TAB CREATION HELPER
// ============================================================================

/**
 * Creates service form tabs from configuration sections
 * 🔧 FIX: Now accepts t function parameter for translating tab labels (2026-01-19)
 */
function createServiceFormTabsFromConfig(
  props: ServiceFormTabRendererProps,
  t: FieldTranslator,
) {
  const {
    sections,
    formData,
    onChange,
    onSelectChange,
    disabled = false,
    onPhotosChange,
    customRenderers,
    sectionFooterRenderers,
    fieldErrors,
    onFieldBlur,
  } = props;
  return sections.map(section => {
    // Shared multi-namespace resolver — same contract as ServiceFormRenderer.
    let displayLabel = translateFieldValue(section.title, t) ?? section.title;

    // Αν είναι relationships section και υπάρχει custom renderer, προσθέτουμε indicator
    if (section.id === 'relationships' && customRenderers?.relationships) {
      // Προσθέτουμε ένα visual indicator που δείχνει ότι υπάρχει ενεργό content
      displayLabel = `${displayLabel} 🔗`;
    }

    return {
      id: section.id,
      label: displayLabel,
      icon: getIconComponent(section.icon),
    content: (() => {
      // 🔍 DEBUG: Log which section we're rendering
      logger.info('Rendering section', { sectionId: section.id, title: section.title });

      // Check for custom renderer FIRST (but exclude logo and relationships which have special logic)
      if (customRenderers?.[section.id] && section.id !== 'logo' && section.id !== 'relationships') {
        logger.info('Using service custom renderer for section', { sectionId: section.id });
        const renderer = customRenderers[section.id] as (() => React.ReactNode);
        return renderer();
      }

      // 🏢 ENTERPRISE: Custom renderer for relationships tab
      if (section.id === 'relationships' && customRenderers && customRenderers.relationships) {
        logger.info('Using relationships custom renderer');
        const renderer = customRenderers.relationships as (() => React.ReactNode);
        return renderer();
      }

      if (section.id === 'logo') {
        // 🏢 ENTERPRISE CENTRALIZED: Logo upload (single slot) — shared SSoT primitive
        const multiplePhotos = (formData.multiplePhotos as UploadPhotoSlot[] | undefined) || [];
        logger.info('Rendering LOGO section with MultiplePhotosUpload', {
          photosCount: multiplePhotos.length,
          hasOnPhotosChange: !!onPhotosChange,
          disabled
        });
        return (
          <FormLogoUploadSection
            uploadKey="service-logo-upload"
            photos={multiplePhotos}
            onPhotosChange={onPhotosChange as ((photos: UploadPhotoSlot[]) => void) | undefined}
            disabled={disabled}
            contactData={formData}
            showPhotosWhenDisabled // 🔧 FIX: Show upload slot even in disabled/read-only mode
          />
        );
      }

      // 🎯 CRITICAL: Use ServiceFormRenderer (not GenericFormRenderer) for clickable links!
      return (
        <div className="space-y-8 md:space-y-6">
          <ServiceFormRenderer
            sections={[section]} // Single section per tab
            formData={formData as unknown as ServiceFormData} // 🏢 ENTERPRISE: Type assertion
            onChange={onChange}
            onSelectChange={onSelectChange}
            disabled={disabled}
            onPhotosChange={onPhotosChange as ((photos: PhotoData[]) => void) | undefined} // 🏢 ENTERPRISE: Type assertion
            customRenderers={customRenderers as Record<string, CustomFieldRenderer> | undefined} // 🏢 ENTERPRISE: Type assertion
            sectionFooterRenderers={sectionFooterRenderers as Record<string, CustomFieldRenderer> | undefined}
            fieldErrors={fieldErrors}
            onFieldBlur={onFieldBlur}
          />
        </div>
      );
    })()
    };
  });
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * Service Form Tab Renderer που δημιουργεί tabbed forms από service configuration
 *
 * 🎯 KEY DIFFERENCE: Uses ServiceFormRenderer instead of GenericFormRenderer
 * This ensures that email, phone, and website fields are clickable in disabled mode!
 *
 * @example
 * ```tsx
 * import { getServiceSortedSections } from '@/config/service-config';
 *
 * function MyServiceTabbedForm() {
 *   const sections = getServiceSortedSections();
 *
 *   return (
 *     <ServiceFormTabRenderer
 *       sections={sections}
 *       formData={formData}
 *       onChange={handleChange}
 *       onSelectChange={handleSelectChange}
 *       disabled={loading}
 *     />
 *   );
 * }
 * ```
 */
export function ServiceFormTabRenderer(props: ServiceFormTabRendererProps) {
  // 🏢 ENTERPRISE: i18n hook for translating tab labels
  const { t } = useTranslation(SERVICE_FORM_NAMESPACES as unknown as string[]);

  if (!props.sections || props.sections.length === 0) {
    logger.warn('No sections provided');
    return null;
  }

  // Create tabs from service sections
  const tabs = createServiceFormTabsFromConfig(props, t);

  return (
    <FormTabsShell
      tabs={tabs}
      initialTab={props.initialTab}
      onActiveTabChange={props.onActiveTabChange}
      contentClassName="mt-4"
    />
  );
}

export default ServiceFormTabRenderer;
