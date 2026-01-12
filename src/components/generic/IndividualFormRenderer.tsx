'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { FormField, FormInput } from '@/components/ui/form/FormComponents';
import { UniversalClickableField } from '@/components/ui/form/UniversalClickableField';
import type { IndividualFieldConfig, IndividualSectionConfig } from '@/config/individual-config';
import { getIconComponent } from './utils/IconMapping';

// ============================================================================
// 🏢 ENTERPRISE: Type Definitions (ADR-compliant - NO any)
// ============================================================================

/** Form data type for individual forms */
export type IndividualFormData = Record<string, string | number | boolean | null | undefined>;

/** Input change handler type */
export type InputChangeHandler = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;

/** Select change handler type */
export type SelectChangeHandler = (name: string, value: string) => void;

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
}

// ============================================================================
// FIELD RENDERER FUNCTIONS
// ============================================================================

/**
 * Renders an input field for individuals
 */
function renderInputField(
  field: IndividualFieldConfig,
  formData: IndividualFormData,
  onChange: InputChangeHandler,
  disabled: boolean
): React.ReactNode {
  const value = formData[field.id] ?? '';

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
 * Renders a textarea field for individuals
 */
function renderTextareaField(
  field: IndividualFieldConfig,
  formData: IndividualFormData,
  onChange: InputChangeHandler,
  disabled: boolean
): React.ReactNode {
  return (
    <Textarea
      id={field.id}
      name={field.id}
      value={formData[field.id] ?? ''}
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
 * Renders a select field for individuals
 */
function renderSelectField(
  field: IndividualFieldConfig,
  formData: IndividualFormData,
  onSelectChange: SelectChangeHandler,
  disabled: boolean
): React.ReactNode {
  const currentValue = formData[field.id];
  const valueStr = currentValue !== null && currentValue !== undefined ? String(currentValue) : (field.defaultValue ?? '');

  return (
    <Select
      name={field.id}
      value={valueStr}
      onValueChange={(value) => onSelectChange(field.id, value)}
      disabled={disabled}
      required={field.required}
    >
      <SelectTrigger>
        <SelectValue placeholder={field.placeholder || `Επιλέξτε ${field.label}`} />
      </SelectTrigger>
      <SelectContent>
        {field.options?.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Renders a field based on its type
 */
function renderField(
  field: IndividualFieldConfig,
  formData: IndividualFormData,
  onChange: InputChangeHandler,
  onSelectChange: SelectChangeHandler,
  disabled: boolean,
  customRenderers?: Record<string, CustomFieldRenderer>
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
      return renderInputField(field, formData, onChange, disabled);
    case 'textarea':
      return renderTextareaField(field, formData, onChange, disabled);
    case 'select':
      return renderSelectField(field, formData, onSelectChange, disabled);
    default:
      console.warn(`Unknown field type: ${field.type} for field ${field.id}`);
      return renderInputField(field, formData, onChange, disabled);
  }
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
  customRenderers
}: IndividualFormRendererProps) {
  if (!sections || sections.length === 0) {
    console.warn('IndividualFormRenderer: No sections provided');
    return null;
  }

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
                  label={field.label}
                  htmlFor={field.id}
                  required={field.required}
                  helpText={field.helpText}
                  className={section.id === 'communication' ? "w-full max-w-none block" : "w-full"}
                >
                  <FormInput>
                    {renderField(field, formData, onChange, onSelectChange, disabled, customRenderers)}
                  </FormInput>
                </FormField>
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default IndividualFormRenderer;