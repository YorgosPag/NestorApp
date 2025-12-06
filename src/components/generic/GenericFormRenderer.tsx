'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { FormField, FormInput } from '@/components/ui/form/FormComponents';
import type { FieldConfig, SectionConfig } from '@/config/company-gemi-config';
import { getIconComponent } from './utils/IconMapping';

// ============================================================================
// INTERFACES
// ============================================================================

export interface GenericFormRendererProps {
  /** Sections configuration from config file */
  sections: SectionConfig[];
  /** Form data object */
  formData: Record<string, any>;
  /** Input change handler */
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  /** Select change handler */
  onSelectChange: (name: string, value: string) => void;
  /** Disabled state */
  disabled?: boolean;
  /** Multiple photos change handler */
  onPhotosChange?: (photos: any[]) => void;
  /** Custom field renderers */
  customRenderers?: Record<string, (field: FieldConfig, formData: any, onChange: any, onSelectChange: any, disabled: boolean) => React.ReactNode>;
}

// ============================================================================
// FIELD RENDERER FUNCTIONS
// ============================================================================

/**
 * Renders an input field
 */
function renderInputField(field: FieldConfig, formData: any, onChange: any, disabled: boolean): React.ReactNode {
  return (
    <Input
      id={field.id}
      name={field.id}
      value={formData[field.id] || ''}
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
function renderSelectField(field: FieldConfig, formData: any, onSelectChange: any, disabled: boolean): React.ReactNode {
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
function renderTextareaField(field: FieldConfig, formData: any, onChange: any, disabled: boolean): React.ReactNode {
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
 * Renders a date field
 */
function renderDateField(field: FieldConfig, formData: any, onChange: any, disabled: boolean): React.ReactNode {
  return (
    <Input
      id={field.id}
      name={field.id}
      type="date"
      value={formData[field.id] || ''}
      onChange={onChange}
      disabled={disabled}
      required={field.required}
      className={field.className}
    />
  );
}

/**
 * Renders a number field
 */
function renderNumberField(field: FieldConfig, formData: any, onChange: any, disabled: boolean): React.ReactNode {
  return (
    <Input
      id={field.id}
      name={field.id}
      type="number"
      value={formData[field.id] || ''}
      onChange={onChange}
      disabled={disabled}
      required={field.required}
      placeholder={field.placeholder}
      className={field.className}
    />
  );
}

/**
 * Renders an email field
 */
function renderEmailField(field: FieldConfig, formData: any, onChange: any, disabled: boolean): React.ReactNode {
  return (
    <Input
      id={field.id}
      name={field.id}
      type="email"
      value={formData[field.id] || ''}
      onChange={onChange}
      disabled={disabled}
      required={field.required}
      placeholder={field.placeholder}
      className={field.className}
    />
  );
}

/**
 * Renders a tel field
 */
function renderTelField(field: FieldConfig, formData: any, onChange: any, disabled: boolean): React.ReactNode {
  return (
    <Input
      id={field.id}
      name={field.id}
      type="tel"
      value={formData[field.id] || ''}
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
 * import { getSortedSections } from '@/config/company-gemi-config';
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
  if (!sections || sections.length === 0) {
    console.warn('GenericFormRenderer: No sections provided');
    return null;
  }

  return (
    <>
      {sections.map((section, sectionIndex) => {
        const IconComponent = getIconComponent(section.icon);

        return (
          <React.Fragment key={section.id}>
            {/* Section Header */}
            <div className="col-span-2 border-t pt-4 mt-4">
              <h4 className="font-semibold mb-3 text-sm flex items-center gap-2">
                <IconComponent className="h-4 w-4" />
                {section.title}
              </h4>
              {section.description && (
                <p className="text-xs text-muted-foreground mb-2">{section.description}</p>
              )}
            </div>

            {/* Section Fields */}
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
                  <div className="col-span-4">
                    <p className="text-xs text-muted-foreground mt-1">{field.helpText}</p>
                  </div>
                )}
              </FormField>
            ))}
          </React.Fragment>
        );
      })}
    </>
  );
}

export default GenericFormRenderer;