'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { FormField, FormInput } from '@/components/ui/form/FormComponents';
import type { IndividualFieldConfig, IndividualSectionConfig } from '@/config/individual-config';
import { getIconComponent } from './utils/IconMapping';

// ============================================================================
// INTERFACES
// ============================================================================

export interface IndividualFormRendererProps {
  /** Sections configuration from individual config file */
  sections: IndividualSectionConfig[];
  /** Form data object */
  formData: Record<string, any>;
  /** Input change handler */
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  /** Select change handler */
  onSelectChange: (name: string, value: string) => void;
  /** Disabled state */
  disabled?: boolean;
  /** Custom field renderers */
  customRenderers?: Record<string, (field: IndividualFieldConfig, formData: any, onChange: any, onSelectChange: any, disabled: boolean) => React.ReactNode>;
}

// ============================================================================
// FIELD RENDERER FUNCTIONS
// ============================================================================

/**
 * Renders an input field for individuals
 */
function renderInputField(field: IndividualFieldConfig, formData: any, onChange: any, disabled: boolean): React.ReactNode {
  const value = formData[field.id] || '';

  // 🎯 CLICKABLE LINKS: Όταν disabled και έχουμε email/tel, εμφάνισε clickable link
  if (disabled && value) {
    if (field.type === 'email') {
      return (
        <div className="min-h-10 flex items-center px-3 py-2 border border-input bg-background rounded-md text-sm">
          <a
            href={`https://mail.google.com/mail/?view=cm&to=${value}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
            onClick={(e) => e.stopPropagation()}
            title={`Αποστολή email στο ${value} μέσω Gmail`}
          >
            {value}
          </a>
        </div>
      );
    }

    if (field.type === 'tel') {
      return (
        <div className="min-h-10 flex items-center px-3 py-2 border border-input bg-background rounded-md text-sm">
          <a
            href={`tel:${value}`}
            className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
            onClick={(e) => e.stopPropagation()}
            title={`Κλήση στο ${value}`}
          >
            {value}
          </a>
        </div>
      );
    }
  }

  // 📝 NORMAL INPUT: Για edit mode ή άδεια values ή άλλους τύπους
  const inputType = field.type === 'email' ? 'email' : field.type === 'tel' ? 'tel' : field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text';

  return (
    <Input
      id={field.id}
      name={field.id}
      type={inputType}
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
function renderTextareaField(field: IndividualFieldConfig, formData: any, onChange: any, disabled: boolean): React.ReactNode {
  return (
    <Textarea
      id={field.id}
      name={field.id}
      value={formData[field.id] || ''}
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
function renderSelectField(field: IndividualFieldConfig, formData: any, onSelectChange: any, disabled: boolean): React.ReactNode {
  return (
    <Select
      name={field.id}
      value={formData[field.id] || field.defaultValue || ''}
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
  formData: any,
  onChange: any,
  onSelectChange: any,
  disabled: boolean,
  customRenderers?: Record<string, any>
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
    <div className="space-y-6">
      {sections.map((section) => (
        <div key={section.id} className="space-y-4">
          {/* Section Header αφαιρέθηκε - δεν θέλουμε το Camera εικονίδιο και το κείμενο "Φωτογραφία" */}

          {/* Section Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {section.fields.map((field) => (
              <FormField
                key={field.id}
                label={field.label}
                htmlFor={field.id}
                required={field.required}
                helpText={field.helpText}
              >
                <FormInput>
                  {renderField(field, formData, onChange, onSelectChange, disabled, customRenderers)}
                </FormInput>
              </FormField>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default IndividualFormRenderer;