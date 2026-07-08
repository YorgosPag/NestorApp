'use client';

import React from 'react';
import { FormGrid } from '@/components/ui/form/FormComponents';
import { getIconComponent } from './utils/IconMapping';
import { GenericFormRenderer, type FormDataRecord, type PhotoData, type CustomRendererFn } from './GenericFormRenderer';
import {
  FormLogoUploadSection,
  FormTabsShell,
  resolveI18nKeyLabel,
} from './form-tabs-shell';
import type { PhotoSlot } from '@/components/ui/MultiplePhotosUpload';
import type { SectionConfig } from '@/config/company-gemi';
// 🏢 ENTERPRISE: i18n support for tab labels
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { ContactFormData } from '@/types/ContactFormTypes';
import { createModuleLogger } from '@/lib/telemetry';
import '@/lib/design-system';

const logger = createModuleLogger('GenericFormTabRenderer');

// ============================================================================
// INTERFACES
// ============================================================================

/** Photo slot data for multiple photos */
interface PhotoSlotData {
  uploadUrl?: string;
  url?: string;
  fileName?: string;
  [key: string]: unknown;
}

/** Form field data for custom renderers */
interface FormFieldData {
  name: string;
  type?: string;
  label?: string;
  [key: string]: unknown;
}

/** Local custom renderer function type (parameterless for special sections) */
type LocalCustomRendererFn = () => React.ReactNode;

/** Field renderer function type */
type FieldRendererFn = (field: FormFieldData, formData: ContactFormData, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void, onSelectChange: (name: string, value: string) => void, disabled: boolean) => React.ReactNode;

export interface GenericFormTabRendererProps {
  /** Sections configuration from config file */
  sections: SectionConfig[];
  /** Form data object */
  formData: ContactFormData;
  /** Input change handler */
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  /** Select change handler */
  onSelectChange: (name: string, value: string) => void;
  /** Disabled state */
  disabled?: boolean;
  /** Multiple photos change handler (now used for logos too) */
  onPhotosChange?: (photos: PhotoSlotData[]) => void;
  /** Custom field renderers for forms */
  customRenderers?: Record<string, FieldRendererFn | LocalCustomRendererFn>;
  /** Optional section footer renderers (rendered below section fields) */
  sectionFooterRenderers?: Record<string, FieldRendererFn>;
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
 * Creates form tabs from configuration sections
 * 🏢 ENTERPRISE: Now accepts translate function for i18n support
 */
function createFormTabsFromConfig(
  props: GenericFormTabRendererProps,
  t: (key: string) => string,
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
    // ========================================================================
    // 🏢 ENTERPRISE: Translate section title using i18n
    // ========================================================================

    let displayLabel = resolveI18nKeyLabel(section.title, t);

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
      // Check for custom renderer FIRST (but exclude companyPhotos and relationships which have special logic)
      if (customRenderers?.[section.id] && section.id !== 'companyPhotos' && section.id !== 'relationships') {
        logger.info('Using generic custom renderer for section', { sectionId: section.id });
        const renderer = customRenderers[section.id] as LocalCustomRendererFn;
        const customContent = renderer();

        // 🗺️ Also render section footer (e.g. map preview) after custom section content
        const footerFn = sectionFooterRenderers?.[section.id] as LocalCustomRendererFn | undefined;
        if (footerFn) {
          return (
            <>
              {customContent}
              <div className="w-full mt-4">
                {footerFn()}
              </div>
            </>
          );
        }

        return customContent;
      }

      // 🏢 ENTERPRISE: Custom renderer for relationships tab
      if (section.id === 'relationships' && customRenderers && customRenderers.relationships) {
        logger.info('Using relationships custom renderer');
        const renderer = customRenderers.relationships as LocalCustomRendererFn;
        return renderer();
      }

      if (section.id === 'companyPhotos' && customRenderers && customRenderers.companyPhotos) {
        // 🏢 ENTERPRISE: Custom renderer για companyPhotos (UnifiedPhotoManager)
        logger.info('Using companyPhotos custom renderer');
        const renderer = customRenderers.companyPhotos as LocalCustomRendererFn;
        return renderer();
      }

      if (section.id === 'logo') {
        // 🏢 ENTERPRISE CENTRALIZED: Logo upload (single slot) — shared SSoT primitive
        const multiplePhotos = (formData.multiplePhotos as PhotoSlot[] | undefined) || [];
        return (
          <FormLogoUploadSection
            uploadKey="company-logo-upload"
            photos={multiplePhotos}
            onPhotosChange={onPhotosChange as ((photos: PhotoSlot[]) => void) | undefined}
            disabled={disabled}
            contactData={formData}
          />
        );
      }

      // Regular rendering for other sections
      return (
        <FormGrid>
          <GenericFormRenderer
            sections={[section]} // Single section per tab
            formData={formData as unknown as FormDataRecord} // 🏢 ENTERPRISE: Type assertion - formData is compatible
            onChange={onChange}
            onSelectChange={onSelectChange}
            disabled={disabled}
            onPhotosChange={onPhotosChange as ((photos: PhotoData[]) => void) | undefined} // 🏢 ENTERPRISE: Type assertion
            customRenderers={customRenderers as Record<string, CustomRendererFn> | undefined} // 🏢 ENTERPRISE: Type assertion
            sectionFooterRenderers={sectionFooterRenderers as Record<string, CustomRendererFn> | undefined}
            fieldErrors={fieldErrors}
            onFieldBlur={onFieldBlur}
          />
        </FormGrid>
      );
    })()
    };
  });
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * Generic Form Tab Renderer που δημιουργεί tabbed forms από configuration
 *
 * @example
 * ```tsx
 * import { getSortedSections } from '@/config/company-gemi';
 *
 * function MyTabbedForm() {
 *   const sections = getSortedSections();
 *
 *   return (
 *     <GenericFormTabRenderer
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
export function GenericFormTabRenderer(props: GenericFormTabRendererProps) {
  // 🏢 ENTERPRISE: i18n support for tab labels
  const { t } = useTranslation('forms');

  if (!props.sections || props.sections.length === 0) {
    logger.warn('No sections provided');
    return null;
  }

  // Create tabs from sections - 🏢 ENTERPRISE: Pass translate function
  const tabs = createFormTabsFromConfig(props, t);

  return (
    <FormTabsShell
      tabs={tabs}
      initialTab={props.initialTab}
      onActiveTabChange={props.onActiveTabChange}
      contentClassName="mt-4"
    />
  );
}

export default GenericFormTabRenderer;
