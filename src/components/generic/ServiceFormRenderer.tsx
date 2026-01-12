'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { FormField, FormInput } from '@/components/ui/form/FormComponents';
import { UniversalClickableField } from '@/components/ui/form/UniversalClickableField';
import { useIconSizes } from '@/hooks/useIconSizes';
import type { ServiceFieldConfig, ServiceSectionConfig } from '@/config/service-config';
import { getIconComponent } from './utils/IconMapping';

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

/** Custom field renderer function type */
export type CustomFieldRenderer = (
  field: ServiceFieldConfig,
  formData: ServiceFormData,
  onChange: InputChangeHandler,
  onSelectChange: SelectChangeHandler,
  disabled: boolean
) => React.ReactNode;

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
}

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
  disabled: boolean
): React.ReactNode {
  const value = formData[field.id] ?? '';

  // 🎯 DEBUG: Log για contact fields
  if (['phone', 'email', 'website'].includes(field.id)) {
    console.log('🔍 CONTACT FIELD DEBUG:', { fieldId: field.id, fieldType: field.type, value, disabled });
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
 * Renders a select field for services
 */
function renderSelectField(
  field: ServiceFieldConfig,
  formData: ServiceFormData,
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
  field: ServiceFieldConfig,
  formData: ServiceFormData,
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
    case 'url':
      return renderInputField(field, formData, onChange, disabled);
    case 'textarea':
      return renderTextareaField(field, formData, onChange, disabled);
    case 'select':
      return renderSelectField(field, formData, onSelectChange, disabled);
    default:
      return renderInputField(field, formData, onChange, disabled);
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
  onPhotosChange,
  customRenderers
}: ServiceFormRendererProps) {
  const iconSizes = useIconSizes();

  if (!sections || sections.length === 0) {
    return null;
  }

  return (
    <div className="space-y-8 md:space-y-6">
      {sections.map((section) => (
        <div key={section.id} className="space-y-6 md:space-y-4">
          {/* Section Header */}
          <div className="flex items-center gap-2 pb-2 border-b">
            {getIconComponent(section.icon) && React.createElement(getIconComponent(section.icon), { className: iconSizes.sm })}
            <h3 className="font-semibold text-sm">{section.title}</h3>
          </div>

          {/* Section Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-4">
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

export default ServiceFormRenderer;