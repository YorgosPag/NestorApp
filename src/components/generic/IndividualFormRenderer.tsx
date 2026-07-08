'use client';

import React from 'react';
import { FormField, FormInput } from '@/components/ui/form/FormComponents';
import {
  buildSectionFormRenderer,
  type FieldRenderStrategy,
  type FormFieldChangeHandler,
  type FormFieldDataRecord,
  type FormFieldBlurHandler,
  type FormSelectChangeHandler,
} from './form-field-primitives';
import type { IndividualFieldConfig, IndividualSectionConfig } from '@/config/individual-config';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import '@/lib/design-system';

// ============================================================================
// 🏢 ENTERPRISE: Type Definitions (ADR-compliant - NO any)
// ============================================================================

/** Form data type for individual forms */
export type IndividualFormData = FormFieldDataRecord;

/** Input change handler type */
export type InputChangeHandler = FormFieldChangeHandler;

/** Select change handler type */
export type SelectChangeHandler = FormSelectChangeHandler;

/** Field blur handler type */
export type FieldBlurHandler = FormFieldBlurHandler;

/** Custom field renderer function type */
export type CustomFieldRenderer = (
  field: IndividualFieldConfig,
  formData: IndividualFormData,
  onChange: InputChangeHandler,
  onSelectChange: SelectChangeHandler,
  disabled: boolean
) => React.ReactNode;

// ============================================================================
// INTERFACES
// ============================================================================

export interface IndividualFormRendererProps {
  /** Sections configuration from individual config file */
  sections: IndividualSectionConfig[];
  /** Form data object */
  formData: IndividualFormData;
  /** Input change handler */
  onChange: InputChangeHandler;
  /** Select change handler */
  onSelectChange: SelectChangeHandler;
  /** Disabled state */
  disabled?: boolean;
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
// FIELD STRATEGY
// ============================================================================
// Field JSX + type dispatch are delegated to the shared `renderFormField`
// dispatcher (ADR-595). Only the Individual-specific i18n behaviour lives here:
// placeholder + option labels are translated inline via `t`.

function buildIndividualFieldStrategy(
  t: TFunction,
): FieldRenderStrategy<IndividualFieldConfig> {
  return {
    inputPlaceholder: (field) => (field.placeholder ? t(field.placeholder) : undefined),
    selectPlaceholder: (field) =>
      field.placeholder ? t(field.placeholder) : `${t('common.select')} ${t(field.label)}`,
    optionLabel: (label) => t(label),
    selectFallbackValue: (field) => field.defaultValue,
  };
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * Generic Form Renderer for Individual Contacts
 *
 * Renders form fields based on individual configuration
 * Supports all field types: input, email, tel, date, number, textarea, select
 */
export function IndividualFormRenderer({
  sections,
  formData,
  onChange,
  onSelectChange,
  disabled = false,
  customRenderers,
  sectionFooterRenderers,
  fieldErrors,
  onFieldBlur
}: IndividualFormRendererProps) {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation(['contacts', 'contacts-banking', 'contacts-core', 'contacts-form', 'contacts-lifecycle', 'contacts-relationships']);
  const { renderField, hasSections } = buildSectionFormRenderer(
    { formData, onChange, onSelectChange, disabled, strategy: buildIndividualFieldStrategy(t), customRenderers, fieldErrors, onFieldBlur },
    sections,
  );
  if (!hasSections) return null;

  return (
    <div className="space-y-8 md:space-y-6">
      {sections.map((section) => (
        <div key={section.id} className="space-y-6 md:space-y-4">
          {/* Section Header αφαιρέθηκε - δεν θέλουμε το Camera εικονίδιο και το κείμενο "Φωτογραφία" */}

          {/* Section Fields - Special layout for communication section */}
          <div className={section.id === 'communication'
            ? "w-full space-y-4"
            : "w-full grid grid-cols-1 md:grid-cols-2 gap-4"
          }>
            {/* Check if this section has a custom renderer for the whole section */}
            {customRenderers && customRenderers[section.id] ? (
              <div className="w-full col-span-full">
                {customRenderers[section.id]({} as IndividualFieldConfig, formData, onChange, onSelectChange, disabled)}
              </div>
            ) : (
              section.fields.map((field) => (
                <FormField
                  key={field.id}
                  label={t(field.label)} // 🏢 ENTERPRISE: Translate field label
                  htmlFor={field.id}
                  required={field.required}
                  helpText={field.helpText ? t(field.helpText) : undefined} // 🏢 ENTERPRISE: Translate helpText if exists
                  errorText={fieldErrors?.[field.id] ? t(fieldErrors[field.id]) : undefined}
                  tooltip={field.tooltip ? t(field.tooltip) : undefined} // 🏢 ENTERPRISE: InfoLabel tooltip (ADR-242)
                  className={section.id === 'communication' ? "w-full max-w-none block" : "w-full"}
                >
                  <FormInput>
                    {renderField(field)}
                  </FormInput>
                </FormField>
              ))
            )}

            {sectionFooterRenderers && sectionFooterRenderers[section.id] ? (
              <div className="w-full col-span-full">
                {sectionFooterRenderers[section.id]({} as IndividualFieldConfig, formData, onChange, onSelectChange, disabled)}
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

export default IndividualFormRenderer;