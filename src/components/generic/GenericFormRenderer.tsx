'use client';

import React from 'react';
import { FormField, FormInput } from '@/components/ui/form/FormComponents';
import {
  createFieldRenderer,
  type FieldRenderStrategy,
  type FormFieldChangeHandler,
  type FormFieldDataRecord,
  type FormFieldBlurHandler,
  type FormPhotoData,
  type FormSelectChangeHandler,
} from './form-field-primitives';
import { resolveI18nKeyLabel } from './form-tabs-shell';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import type { FieldConfig, SectionConfig } from '@/config/company-gemi';
import { getIconComponent } from './utils/IconMapping';
// 🏢 ENTERPRISE: i18n support - Direct useTranslation for reliability
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { createModuleLogger } from '@/lib/telemetry';
import '@/lib/design-system';
import { buildSelectPlaceholder } from './i18n/select-placeholder';

const logger = createModuleLogger('GenericFormRenderer');

// ============================================================================
// INTERFACES
// ============================================================================

/** Form data type - flexible string values for form fields */
export type FormDataRecord = FormFieldDataRecord;

/** Change handler type for input/textarea elements */
export type FormChangeHandler = FormFieldChangeHandler;

/** Select change handler type */
export type SelectChangeHandler = FormSelectChangeHandler;

/** Field blur handler type */
export type FieldBlurHandler = FormFieldBlurHandler;

/** Photo data type */
export type PhotoData = FormPhotoData;

/** Custom renderer function type */
export type CustomRendererFn = (
  field: FieldConfig,
  formData: FormDataRecord,
  onChange: FormChangeHandler,
  onSelectChange: SelectChangeHandler,
  disabled: boolean
) => React.ReactNode;

export interface GenericFormRendererProps {
  /** Sections configuration from config file */
  sections: SectionConfig[];
  /** Form data object */
  formData: FormDataRecord;
  /** Input change handler */
  onChange: FormChangeHandler;
  /** Select change handler */
  onSelectChange: SelectChangeHandler;
  /** Disabled state */
  disabled?: boolean;
  /** Multiple photos change handler */
  onPhotosChange?: (photos: PhotoData[]) => void;
  /** Custom field renderers */
  customRenderers?: Record<string, CustomRendererFn>;
  /** Optional section footer renderers (rendered below section fields) */
  sectionFooterRenderers?: Record<string, CustomRendererFn>;
  /** Field-level validation errors */
  fieldErrors?: Record<string, string>;
  /** Field blur handler */
  onFieldBlur?: FieldBlurHandler;
}

// ============================================================================
// FIELD STRATEGY
// ============================================================================
// Field JSX + type dispatch are delegated to the shared `renderFormField`
// dispatcher (ADR-595). Only the GEMI-specific i18n behaviour lives here:
// placeholders/labels are resolved via the "dot → t() → last-segment" helper.

/** Exported for testing — το placeholder contract είναι η επιφάνεια ρίσκου (ADR-666). */
export function buildGenericFieldStrategy(
  t: (key: string, options?: { label: string }) => string,
): FieldRenderStrategy<FieldConfig> {
  return {
    selectPlaceholder: (field) =>
      buildSelectPlaceholder(resolveI18nKeyLabel(field.placeholder ?? field.label, t), t),
    optionLabel: (label) => resolveI18nKeyLabel(label, t),
    selectFallbackValue: (field) => field.initialValue,
    textareaRows: 3,
  };
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * Generic Form Renderer που δημιουργεί forms από configuration
 *
 * @example
 * ```tsx
 * import { getSortedSections } from '@/config/company-gemi';
 *
 * function MyForm() {
 *   const sections = getSortedSections();
 *
 *   return (
 *     <GenericFormRenderer
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
export function GenericFormRenderer({
  sections,
  formData,
  onChange,
  onSelectChange,
  disabled = false,
  customRenderers,
  sectionFooterRenderers,
  fieldErrors,
  onFieldBlur
}: GenericFormRendererProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  // 🏢 ENTERPRISE: i18n - Direct translation with forms namespace
  const { t, isNamespaceReady } = useTranslation('forms');
  const renderField = createFieldRenderer({
    formData,
    onChange,
    onSelectChange,
    disabled,
    strategy: buildGenericFieldStrategy(t),
    customRenderers,
    fieldErrors,
    onFieldBlur,
  });

  /**
   * Translate a string if it's an i18n key (contains '.')
   * Otherwise return as-is for backward compatibility
   * Uses direct t() function for reliable translation
   *
   * 🏢 ENTERPRISE: Proper i18n key detection and translation
   */
  const translate = (text: string | undefined): string => {
    if (!text) return '';

    // i18n keys contain dots (e.g., 'sections.basicInfoGemi', 'company.companyName')
    if (text.includes('.')) {
      // Wait for namespace to be ready before translating
      if (!isNamespaceReady) {
        // Return loading placeholder while namespace loads
        return '...';
      }

      // Attempt translation
      const translated = t(text);

      // If translation returns the key itself, it means the key wasn't found
      // This can happen if the key structure is wrong
      if (translated === text) {
        // Log warning for debugging (only in development)
        if (process.env.NODE_ENV === 'development') {
          logger.warn('i18n key not found in forms namespace', { key: text });
        }
        // Return the key's last part as fallback (e.g., 'basicInfoGemi' from 'sections.basicInfoGemi')
        const parts = text.split('.');
        return parts[parts.length - 1];
      }

      return translated;
    }

    return text;
  };

  if (!sections || sections.length === 0) {
    logger.warn('No sections provided');
    return null;
  }

  return (
    <div className="space-y-8 md:space-y-6">
      {sections.map((section, _sectionIndex) => {
        const IconComponent = getIconComponent(section.icon);

        return (
          <div key={section.id} className="space-y-6 md:space-y-4">
            {/* Section Header - i18n translated */}
            <div className="flex items-center gap-2 pb-2 border-b">
              <IconComponent className={iconSizes.sm} />
              <h3 className="font-semibold text-sm">{translate(section.title)}</h3>
            </div>
            {section.description && (
              <p className={cn("text-xs -mt-2", colors.text.muted)}>{translate(section.description)}</p>
            )}

            {/* Section Fields - Enhanced Mobile Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-4">
              {section.fields.map(field => (
                <FormField
                  key={field.id}
                  label={translate(field.label)}
                  htmlFor={field.id}
                  required={field.required}
                  errorText={fieldErrors?.[field.id] ? t(fieldErrors[field.id]) : undefined}
                >
                  <FormInput>
                    {renderField(field)}
                  </FormInput>
                  {field.helpText && (
                    <p className={cn("text-xs mt-1 whitespace-nowrap overflow-hidden text-ellipsis", colors.text.muted)}>{translate(field.helpText)}</p>
                  )}
                </FormField>
              ))}

              {sectionFooterRenderers && sectionFooterRenderers[section.id] ? (
                <div className="w-full col-span-full">
                  {sectionFooterRenderers[section.id]({} as FieldConfig, formData, onChange, onSelectChange, disabled)}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default GenericFormRenderer;