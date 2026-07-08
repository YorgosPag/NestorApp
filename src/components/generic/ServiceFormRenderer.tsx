'use client';

import React from 'react';
import { FormField, FormInput } from '@/components/ui/form/FormComponents';
import {
  buildSectionFormRenderer,
  type FieldRenderStrategy,
  type FormFieldChangeHandler,
  type FormFieldDataRecord,
  type FormFieldBlurHandler,
  type FormPhotoData,
  type FormSelectChangeHandler,
} from './form-field-primitives';
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: i18n support for service forms
import { useTranslation } from 'react-i18next';
import {
  SERVICE_FORM_NAMESPACES,
  translateFieldValue,
  type FieldTranslator,
} from './i18n/translate-field-value';
import type { ServiceFieldConfig, ServiceSectionConfig } from '@/config/service-config';
import { getIconComponent } from './utils/IconMapping';
import '@/lib/design-system';

// ============================================================================
// 🏢 ENTERPRISE: Type Definitions (ADR-compliant - NO any)
// ============================================================================

/** Form data type for service forms */
export type ServiceFormData = FormFieldDataRecord;

/** Photo data structure */
export type PhotoData = FormPhotoData;

/** Input change handler type */
export type InputChangeHandler = FormFieldChangeHandler;

/** Select change handler type */
export type SelectChangeHandler = FormSelectChangeHandler;

/** Field blur handler type */
export type FieldBlurHandler = FormFieldBlurHandler;

/** Custom field renderer function type */
export type CustomFieldRenderer = (
  field: ServiceFieldConfig,
  formData: ServiceFormData,
  onChange: InputChangeHandler,
  onSelectChange: SelectChangeHandler,
  disabled: boolean
) => React.ReactNode;

// ============================================================================
// INTERFACES
// ============================================================================

export interface ServiceFormRendererProps {
  /** Sections configuration from service config file */
  sections: ServiceSectionConfig[];
  /** Form data object */
  formData: ServiceFormData;
  /** Input change handler */
  onChange: InputChangeHandler;
  /** Select change handler */
  onSelectChange: SelectChangeHandler;
  /** Disabled state */
  disabled?: boolean;
  /** Multiple photos change handler (now used for logos too) */
  onPhotosChange?: (photos: PhotoData[]) => void;
  /** Custom field renderers */
  customRenderers?: Record<string, CustomFieldRenderer>;
  /** Optional section footer renderers (rendered below section fields) */
  sectionFooterRenderers?: Record<string, CustomFieldRenderer>;
  /** Field-level validation errors */
  fieldErrors?: Record<string, string>;
  /** Field blur handler */
  onFieldBlur?: FieldBlurHandler;
}

// ============================================================================
// 🏢 ENTERPRISE: i18n resolver — shared with ServiceFormTabRenderer.
// See ./i18n/translate-field-value.ts for the full contract and rationale.
// ============================================================================

type TFunction = FieldTranslator;

// ============================================================================
// FIELD STRATEGY
// ============================================================================
// Field JSX + type dispatch are delegated to the shared `renderFormField`
// dispatcher (ADR-595). Service forms pre-translate placeholders in the parent,
// so raw `field.placeholder` passes through; option labels use the shared
// multi-namespace resolver.

function buildServiceFieldStrategy(
  t: TFunction,
): FieldRenderStrategy<ServiceFieldConfig> {
  return {
    selectPlaceholder: (field) => field.placeholder || field.label,
    optionLabel: (label) => translateFieldValue(label, t) || label,
    selectFallbackValue: (field) => field.defaultValue,
  };
}


// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * Generic Form Renderer for Service Contacts (Δημόσιες Υπηρεσίες)
 *
 * Renders form fields based on service configuration
 * Supports all field types: input, email, tel, date, number, textarea, select
 * Includes integrated logo upload section
 */
export function ServiceFormRenderer({
  sections,
  formData,
  onChange,
  onSelectChange,
  disabled = false,
  onPhotosChange: _onPhotosChange,
  customRenderers,
  sectionFooterRenderers,
  fieldErrors,
  onFieldBlur
}: ServiceFormRendererProps) {
  const iconSizes = useIconSizes();
  // 🏢 ENTERPRISE: Multi-namespace resolution — service forms pull labels from
  // `contacts` (field names), `contacts-form` (option catalogs) and `forms`
  // (shared section titles). i18next cascades through them in order.
  const { t } = useTranslation(SERVICE_FORM_NAMESPACES as unknown as string[]);
  const { renderField, hasSections } = buildSectionFormRenderer(
    { formData, onChange, onSelectChange, disabled, strategy: buildServiceFieldStrategy(t), customRenderers, fieldErrors, onFieldBlur },
    sections,
  );
  if (!hasSections) return null;

  return (
    <div className="space-y-8 md:space-y-6">
      {sections.map((section) => {
        // 🌐 Translate section title if it's an i18n key
        const translatedTitle = translateFieldValue(section.title, t) || section.title;

        return (
          <div key={section.id} className="space-y-6 md:space-y-4">
            {/* Section Header */}
            <div className="flex items-center gap-2 pb-2 border-b">
              {getIconComponent(section.icon) && React.createElement(getIconComponent(section.icon), { className: iconSizes.sm })}
              <h3 className="font-semibold text-sm">{translatedTitle}</h3>
            </div>

            {/* Section Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-4">
              {section.fields.map((field) => {
                // 🌐 Translate field label, placeholder, helpText if they're i18n keys
                const translatedLabel = translateFieldValue(field.label, t) || field.label;
                const translatedPlaceholder = translateFieldValue(field.placeholder, t) || field.placeholder;
                const translatedHelpText = translateFieldValue(field.helpText, t) || field.helpText;

                // Create translated field config for rendering.
                // `label` is translated too so that the select placeholder
                // fallback (`field.placeholder || field.label`) does not leak the
                // raw i18n key when the select has no explicit placeholder.
                const translatedField: ServiceFieldConfig = {
                  ...field,
                  label: translatedLabel,
                  placeholder: translatedPlaceholder,
                  helpText: translatedHelpText
                };

                return (
                  <FormField
                    key={field.id}
                    label={translatedLabel}
                    htmlFor={field.id}
                    required={field.required}
                    helpText={translatedHelpText}
                    errorText={fieldErrors?.[field.id] ? t(fieldErrors[field.id]) : undefined}
                  >
                    <FormInput>
                      {renderField(translatedField)}
                    </FormInput>
                  </FormField>
                );
              })}

              {sectionFooterRenderers && sectionFooterRenderers[section.id] ? (
                <div className="w-full col-span-full">
                  {sectionFooterRenderers[section.id]({} as ServiceFieldConfig, formData, onChange, onSelectChange, disabled)}
                </div>
              ) : null}
            </div>

          </div>
        );
      })}
    </div>
  );
}

export default ServiceFormRenderer;