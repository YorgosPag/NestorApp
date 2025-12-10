'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { FormField, FormInput } from '@/components/ui/form/FormComponents';
import type { ServiceFieldConfig, ServiceSectionConfig } from '@/config/service-config';
import { getIconComponent } from './utils/IconMapping';

// ============================================================================
// INTERFACES
// ============================================================================

export interface ServiceFormRendererProps {
  /** Sections configuration from service config file */
  sections: ServiceSectionConfig[];
  /** Form data object */
  formData: Record<string, any>;
  /** Input change handler */
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  /** Select change handler */
  onSelectChange: (name: string, value: string) => void;
  /** Disabled state */
  disabled?: boolean;
  /** Multiple photos change handler (now used for logos too) */
  onPhotosChange?: (photos: any[]) => void;
  /** Custom field renderers */
  customRenderers?: Record<string, (field: ServiceFieldConfig, formData: any, onChange: any, onSelectChange: any, disabled: boolean) => React.ReactNode>;
}

// ============================================================================
// FIELD RENDERER FUNCTIONS
// ============================================================================

/**
 * Renders an input field for services
 */
function renderInputField(field: ServiceFieldConfig, formData: any, onChange: any, disabled: boolean): React.ReactNode {
  const value = formData[field.id] || '';

  // 🎯 CLICKABLE LINKS: Όταν disabled και έχουμε email/tel/website, εμφάνισε clickable link
  // Debug μόνο για contact fields
  if (['phone', 'email', 'website'].includes(field.id)) {
    console.log('🔍 CONTACT FIELD DEBUG:', { fieldId: field.id, fieldType: field.type, value, disabled });
  }

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

    // 🌐 WEBSITE/URL LINKS: Για ιστοσελίδες
    if (field.id === 'website' || field.id === 'websiteURL' || field.type === 'url') {
      const websiteUrl = value.startsWith('http') ? value : `https://${value}`;
      return (
        <div className="min-h-10 flex items-center px-3 py-2 border border-input bg-background rounded-md text-sm">
          <a
            href={websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
            onClick={(e) => e.stopPropagation()}
            title={`Άνοιγμα ιστοσελίδας ${value}`}
          >
            {value}
          </a>
        </div>
      );
    }
  }

  // 📝 NORMAL INPUT: Για edit mode ή άδεια values ή άλλους τύπους
  const inputType = field.type === 'email' ? 'email' : field.type === 'tel' ? 'tel' : field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : field.type === 'url' ? 'url' : 'text';

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
 * Renders a textarea field for services
 */
function renderTextareaField(field: ServiceFieldConfig, formData: any, onChange: any, disabled: boolean): React.ReactNode {
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
 * Renders a select field for services
 */
function renderSelectField(field: ServiceFieldConfig, formData: any, onSelectChange: any, disabled: boolean): React.ReactNode {
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
  field: ServiceFieldConfig,
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
  if (!sections || sections.length === 0) {
    return null;
  }

  return (
    <div className="space-y-8 md:space-y-6">
      {sections.map((section) => (
        <div key={section.id} className="space-y-6 md:space-y-4">
          {/* Section Header */}
          <div className="flex items-center gap-2 pb-2 border-b">
            {getIconComponent(section.icon) && React.createElement(getIconComponent(section.icon), { className: "w-4 h-4" })}
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