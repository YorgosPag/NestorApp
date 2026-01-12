'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { FormField, FormInput } from '@/components/ui/form/FormComponents';
import { UniversalClickableField } from '@/components/ui/form/UniversalClickableField';
import { useIconSizes } from '@/hooks/useIconSizes';
import type { FieldConfig, SectionConfig } from '@/config/company-gemi';
import { getIconComponent } from './utils/IconMapping';

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
 * Renders a select field
 */
function renderSelectField(field: FieldConfig, formData: FormDataRecord, onSelectChange: SelectChangeHandler, disabled: boolean): React.ReactNode {
  if (!field.options || field.options.length === 0) {
    console.warn(`Select field ${field.id} has no options defined`);
    return renderInputField(field, formData, () => {}, disabled);
  }

  return (
    <Select
      name={field.id}
      value={formData[field.id] || field.defaultValue || ''}
      onValueChange={(value) => onSelectChange(field.id, value)}
      disabled={disabled}
    >
      <SelectTrigger>
        <SelectValue placeholder={field.placeholder || `Επιλέξτε ${field.label.toLowerCase()}`} />
      </SelectTrigger>
      <SelectContent>
        {field.options.map(option => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
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
      value={formData[field.id] || ''}
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
  const value = formData[field.id] || '';

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
  const value = formData[field.id] || '';

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
  const value = formData[field.id] || '';

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
  const value = formData[field.id] || '';

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
 */
function renderField(
  field: FieldConfig,
  formData: FormDataRecord,
  onChange: FormChangeHandler,
  onSelectChange: SelectChangeHandler,
  disabled: boolean,
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
      return renderSelectField(field, formData, onSelectChange, disabled);
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
      console.warn(`Unknown field type: ${field.type} for field ${field.id}`);
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
  customRenderers
}: GenericFormRendererProps) {
  const iconSizes = useIconSizes();

  if (!sections || sections.length === 0) {
    console.warn('GenericFormRenderer: No sections provided');
    return null;
  }

  return (
    <div className="space-y-8 md:space-y-6">
      {sections.map((section, sectionIndex) => {
        const IconComponent = getIconComponent(section.icon);

        return (
          <div key={section.id} className="space-y-6 md:space-y-4">
            {/* Section Header */}
            <div className="flex items-center gap-2 pb-2 border-b">
              <IconComponent className={iconSizes.sm} />
              <h3 className="font-semibold text-sm">{section.title}</h3>
            </div>
            {section.description && (
              <p className="text-xs text-muted-foreground -mt-2">{section.description}</p>
            )}

            {/* Section Fields - Enhanced Mobile Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-4">
              {section.fields.map(field => (
                <FormField
                  key={field.id}
                  label={field.label}
                  htmlFor={field.id}
                  required={field.required}
                >
                  <FormInput>
                    {renderField(field, formData, onChange, onSelectChange, disabled, customRenderers)}
                  </FormInput>
                  {field.helpText && (
                    <p className="text-xs text-muted-foreground mt-1 whitespace-nowrap overflow-hidden text-ellipsis">{field.helpText}</p>
                  )}
                </FormField>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default GenericFormRenderer;