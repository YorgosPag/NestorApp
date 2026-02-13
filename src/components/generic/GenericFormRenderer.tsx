'use client';

import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { FormField, FormInput } from '@/components/ui/form/FormComponents';
import { UniversalClickableField } from '@/components/ui/form/UniversalClickableField';
import { useIconSizes } from '@/hooks/useIconSizes';
import type { FieldConfig, SectionConfig } from '@/config/company-gemi';
import { getIconComponent } from './utils/IconMapping';
// 🏢 ENTERPRISE: i18n support - Direct useTranslation for reliability
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('GenericFormRenderer');

// ============================================================================
// INTERFACES
// ============================================================================

/** Form data type - flexible string values for form fields */
export type FormDataRecord = Record<string, string | number | boolean | null | undefined>;

/** Change handler type for input/textarea elements */
export type FormChangeHandler = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;

/** Select change handler type */
export type SelectChangeHandler = (name: string, value: string) => void;

/** Photo data type */
export interface PhotoData {
  url: string;
  name?: string;
  size?: number;
}

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
}

// ============================================================================
// FIELD RENDERER FUNCTIONS
// ============================================================================

/**
 * Renders an input field - NOW USING UNIVERSAL CLICKABLE FIELD
 */
function renderInputField(field: FieldConfig, formData: FormDataRecord, onChange: FormChangeHandler, disabled: boolean): React.ReactNode {
  const value = formData[field.id] || '';

  // 🏢 ENTERPRISE: Use Universal Clickable Field - ZERO διασπορά!
  return (
    <UniversalClickableField
      id={field.id}
      name={field.id}
      type={field.type}
      value={toStringValue(value)}
      onChange={onChange}
      disabled={disabled}
      required={field.required}
      placeholder={field.placeholder}
      maxLength={field.maxLength}
      className={field.className}
    />
  );
}

/**
 * 🏢 ENTERPRISE: Helper function to translate text if it's an i18n key
 * Used for option labels that may be i18n keys (contain '.')
 */
function translateText(text: string, t: (key: string) => string): string {
  if (!text) return '';
  // i18n keys contain dots (e.g., 'options.legalForms.ae')
  if (text.includes('.')) {
    const translated = t(text);
    // If translation returns the key itself, use the last part as fallback
    if (translated === text) {
      const parts = text.split('.');
      return parts[parts.length - 1];
    }
    return translated;
  }
  return text;
}

/**
 * 🏢 ENTERPRISE: Helper to convert form data value to string for input fields
 * Handles string | number | boolean | true types safely
 */
function toStringValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

/**
 * Renders a select field
 * 🏢 ENTERPRISE: Now accepts translate function for i18n option labels
 */
function renderSelectField(
  field: FieldConfig,
  formData: FormDataRecord,
  onSelectChange: SelectChangeHandler,
  disabled: boolean,
  t: (key: string) => string
): React.ReactNode {
  if (!field.options || field.options.length === 0) {
    logger.warn('Select field has no options defined', { fieldId: field.id });
    return renderInputField(field, formData, () => {}, disabled);
  }

  // Translate placeholder if it's an i18n key
  const placeholder = field.placeholder
    ? translateText(field.placeholder, t)
    : translateText(field.label, t).toLowerCase();

  return (
    <Select
      name={field.id}
      value={toStringValue(formData[field.id] || field.defaultValue)}
      onValueChange={(value) => onSelectChange(field.id, value)}
      disabled={disabled}
    >
      <SelectTrigger>
        <SelectValue placeholder={`Select ${placeholder}`} />
      </SelectTrigger>
      <SelectContent>
        {field.options.map(option => (
          <SelectItem key={option.value} value={option.value}>
            {translateText(option.label, t)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Renders a textarea field
 */
function renderTextareaField(field: FieldConfig, formData: FormDataRecord, onChange: FormChangeHandler, disabled: boolean): React.ReactNode {
  return (
    <Textarea
      id={field.id}
      name={field.id}
      value={toStringValue(formData[field.id])}
      onChange={onChange}
      disabled={disabled}
      required={field.required}
      placeholder={field.placeholder}
      className={field.className}
      rows={3}
    />
  );
}

/**
 * Renders a date field - NOW USING UNIVERSAL CLICKABLE FIELD
 */
function renderDateField(field: FieldConfig, formData: FormDataRecord, onChange: FormChangeHandler, disabled: boolean): React.ReactNode {
  const value = toStringValue(formData[field.id]);

  return (
    <UniversalClickableField
      id={field.id}
      name={field.id}
      type="date"
      value={value}
      onChange={onChange}
      disabled={disabled}
      required={field.required}
      className={field.className}
    />
  );
}

/**
 * Renders a number field - NOW USING UNIVERSAL CLICKABLE FIELD
 */
function renderNumberField(field: FieldConfig, formData: FormDataRecord, onChange: FormChangeHandler, disabled: boolean): React.ReactNode {
  const value = toStringValue(formData[field.id]);

  return (
    <UniversalClickableField
      id={field.id}
      name={field.id}
      type="number"
      value={value}
      onChange={onChange}
      disabled={disabled}
      required={field.required}
      placeholder={field.placeholder}
      className={field.className}
    />
  );
}

/**
 * Renders an email field - NOW USING UNIVERSAL CLICKABLE FIELD
 */
function renderEmailField(field: FieldConfig, formData: FormDataRecord, onChange: FormChangeHandler, disabled: boolean): React.ReactNode {
  const value = toStringValue(formData[field.id]);

  return (
    <UniversalClickableField
      id={field.id}
      name={field.id}
      type="email"
      value={value}
      onChange={onChange}
      disabled={disabled}
      required={field.required}
      placeholder={field.placeholder}
      className={field.className}
    />
  );
}

/**
 * Renders a tel field - NOW USING UNIVERSAL CLICKABLE FIELD
 */
function renderTelField(field: FieldConfig, formData: FormDataRecord, onChange: FormChangeHandler, disabled: boolean): React.ReactNode {
  const value = toStringValue(formData[field.id]);

  return (
    <UniversalClickableField
      id={field.id}
      name={field.id}
      type="tel"
      value={value}
      onChange={onChange}
      disabled={disabled}
      required={field.required}
      placeholder={field.placeholder}
      maxLength={field.maxLength}
      className={field.className}
    />
  );
}

/**
 * Main field renderer function
 * 🏢 ENTERPRISE: Now accepts translate function for i18n support
 */
function renderField(
  field: FieldConfig,
  formData: FormDataRecord,
  onChange: FormChangeHandler,
  onSelectChange: SelectChangeHandler,
  disabled: boolean,
  t: (key: string) => string,
  customRenderers?: Record<string, CustomRendererFn>
): React.ReactNode {
  // Check for custom renderer first
  if (customRenderers && customRenderers[field.id]) {
    return customRenderers[field.id](field, formData, onChange, onSelectChange, disabled);
  }

  // Use built-in renderers based on field type
  switch (field.type) {
    case 'input':
      return renderInputField(field, formData, onChange, disabled);
    case 'select':
      return renderSelectField(field, formData, onSelectChange, disabled, t);
    case 'textarea':
      return renderTextareaField(field, formData, onChange, disabled);
    case 'date':
      return renderDateField(field, formData, onChange, disabled);
    case 'number':
      return renderNumberField(field, formData, onChange, disabled);
    case 'email':
      return renderEmailField(field, formData, onChange, disabled);
    case 'tel':
      return renderTelField(field, formData, onChange, disabled);
    default:
      logger.warn('Unknown field type', { fieldType: field.type, fieldId: field.id });
      return renderInputField(field, formData, onChange, disabled);
  }
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
  sectionFooterRenderers
}: GenericFormRendererProps) {
  const iconSizes = useIconSizes();
  // 🏢 ENTERPRISE: i18n - Direct translation with forms namespace
  const { t, isNamespaceReady } = useTranslation('forms');

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
      {sections.map((section, sectionIndex) => {
        const IconComponent = getIconComponent(section.icon);

        return (
          <div key={section.id} className="space-y-6 md:space-y-4">
            {/* Section Header - i18n translated */}
            <div className="flex items-center gap-2 pb-2 border-b">
              <IconComponent className={iconSizes.sm} />
              <h3 className="font-semibold text-sm">{translate(section.title)}</h3>
            </div>
            {section.description && (
              <p className="text-xs text-muted-foreground -mt-2">{translate(section.description)}</p>
            )}

            {/* Section Fields - Enhanced Mobile Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-4">
              {section.fields.map(field => (
                <FormField
                  key={field.id}
                  label={translate(field.label)}
                  htmlFor={field.id}
                  required={field.required}
                >
                  <FormInput>
                    {renderField(field, formData, onChange, onSelectChange, disabled, t, customRenderers)}
                  </FormInput>
                  {field.helpText && (
                    <p className="text-xs text-muted-foreground mt-1 whitespace-nowrap overflow-hidden text-ellipsis">{translate(field.helpText)}</p>
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