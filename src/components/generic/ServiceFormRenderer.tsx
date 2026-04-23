'use client';

import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { FormField, FormInput } from '@/components/ui/form/FormComponents';
import { UniversalClickableField } from '@/components/ui/form/UniversalClickableField';
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
import { createModuleLogger } from '@/lib/telemetry';
import '@/lib/design-system';

const logger = createModuleLogger('ServiceFormRenderer');

// ============================================================================
// 🏢 ENTERPRISE: Type Definitions (ADR-compliant - NO any)
// ============================================================================

/** Form data type for service forms */
export type ServiceFormData = Record<string, string | number | boolean | null | undefined>;

/** Photo data structure */
export interface PhotoData {
  url: string;
  name?: string;
  size?: number;
}

/** Input change handler type */
export type InputChangeHandler = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;

/** Select change handler type */
export type SelectChangeHandler = (name: string, value: string) => void;

/** Field blur handler type */
export type FieldBlurHandler = (fieldName: string) => void;

/** Custom field renderer function type */
export type CustomFieldRenderer = (
  field: ServiceFieldConfig,
  formData: ServiceFormData,
  onChange: InputChangeHandler,
  onSelectChange: SelectChangeHandler,
  disabled: boolean
) => React.ReactNode;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * 🏢 ENTERPRISE: Helper to convert form data value to string for input fields
 * Handles string | number | boolean types safely
 */
function toStringValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

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
// FIELD RENDERER FUNCTIONS
// ============================================================================

/**
 * Renders an input field for services - NOW USING UNIVERSAL CLICKABLE FIELD
 */
function renderInputField(
  field: ServiceFieldConfig,
  formData: ServiceFormData,
  onChange: InputChangeHandler,
  disabled: boolean,
  fieldError?: string,
  onFieldBlur?: FieldBlurHandler
): React.ReactNode {
  const value = toStringValue(formData[field.id]);

  // 🎯 DEBUG: Log για contact fields
  if (['phone', 'email', 'website'].includes(field.id)) {
    logger.info('Contact field debug', { fieldId: field.id, fieldType: field.type, value, disabled });
  }

  // 🏢 ENTERPRISE: Use Universal Clickable Field - ZERO διασπορά!
  return (
    <UniversalClickableField
      id={field.id}
      name={field.id}
      type={field.type}
      value={value}
      onChange={onChange}
      disabled={disabled}
      required={field.required}
      placeholder={field.placeholder}
      maxLength={field.maxLength}
      className={field.className}
      onBlur={onFieldBlur ? () => onFieldBlur(field.id) : undefined}
      error={fieldError}
    />
  );
}

/**
 * Renders a textarea field for services
 */
function renderTextareaField(
  field: ServiceFieldConfig,
  formData: ServiceFormData,
  onChange: InputChangeHandler,
  disabled: boolean,
  fieldError?: string,
  onFieldBlur?: FieldBlurHandler
): React.ReactNode {
  return (
    <Textarea
      id={field.id}
      name={field.id}
      value={toStringValue(formData[field.id])}
      onChange={onChange}
      disabled={disabled}
      required={field.required}
      placeholder={field.placeholder}
      rows={4}
      className={field.className}
    />
  );
}

/**
 * Renders a select field for services
 * 🏢 ENTERPRISE: Uses translated placeholder and option labels
 * 🔧 FIX: Now translates option labels (2026-01-19)
 */
function renderSelectField(
  field: ServiceFieldConfig,
  formData: ServiceFormData,
  onSelectChange: SelectChangeHandler,
  disabled: boolean,
  t: TFunction
): React.ReactNode {
  const currentValue = formData[field.id];
  const valueStr = currentValue !== null && currentValue !== undefined ? String(currentValue) : (field.defaultValue ?? '');

  // 🌐 Use translated placeholder from field (already translated by parent)
  const placeholder = field.placeholder || field.label;

  return (
    <Select
      name={field.id}
      value={valueStr}
      onValueChange={(value) => onSelectChange(field.id, value)}
      disabled={disabled}
      required={field.required}
    >
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {field.options?.map((option) => {
          // 🔧 FIX: Translate option labels using the same logic as field labels
          const translatedLabel = translateFieldValue(option.label, t) || option.label;
          return (
            <SelectItem key={option.value} value={option.value}>
              {translatedLabel}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

/**
 * Renders a field based on its type
 * 🔧 FIX: Added t parameter for translating select options (2026-01-19)
 */
function renderField(
  field: ServiceFieldConfig,
  formData: ServiceFormData,
  onChange: InputChangeHandler,
  onSelectChange: SelectChangeHandler,
  disabled: boolean,
  t: TFunction,
  customRenderers?: Record<string, CustomFieldRenderer>,
  fieldErrors?: Record<string, string>,
  onFieldBlur?: FieldBlurHandler
): React.ReactNode {
  // Check for custom renderer first
  if (customRenderers && customRenderers[field.id]) {
    return customRenderers[field.id](field, formData, onChange, onSelectChange, disabled);
  }

  // Default rendering based on field type
  switch (field.type) {
    case 'input':
    case 'email':
    case 'tel':
    case 'date':
    case 'number':
    case 'url':
      return renderInputField(field, formData, onChange, disabled, fieldErrors?.[field.id], onFieldBlur);
    case 'textarea':
      return renderTextareaField(field, formData, onChange, disabled);
    case 'select':
      return renderSelectField(field, formData, onSelectChange, disabled, t);
    default:
      return renderInputField(field, formData, onChange, disabled, fieldErrors?.[field.id], onFieldBlur);
  }
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

  if (!sections || sections.length === 0) {
    return null;
  }

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
                // `label` is translated too so that renderSelectField's placeholder
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
                      {renderField(translatedField, formData, onChange, onSelectChange, disabled, t, customRenderers, fieldErrors, onFieldBlur)}
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