'use client';

import React from 'react';
import type { FieldConfig, SectionConfig } from '@/config/company-gemi-config';
import { getIconComponent } from './utils/IconMapping';

// ============================================================================
// INTERFACES
// ============================================================================

export interface GenericTabRendererProps {
  /** Section configuration */
  section: SectionConfig;
  /** Data object to display */
  data: Record<string, any>;
  /** Display mode */
  mode?: 'display' | 'compact';
  /** Custom field renderers for complex data */
  customRenderers?: Record<string, (field: FieldConfig, data: any) => React.ReactNode>;
  /** Custom value formatters */
  valueFormatters?: Record<string, (value: any, field: FieldConfig) => string>;
}

// ============================================================================
// VALUE FORMATTING FUNCTIONS
// ============================================================================

/**
 * Formats a date value for display
 */
function formatDateValue(value: any): string {
  if (!value) return 'Δεν έχει οριστεί';

  try {
    const date = new Date(value);
    return date.toLocaleDateString('el-GR');
  } catch {
    return 'Άκυρη ημερομηνία';
  }
}

/**
 * Formats a number value for display
 */
function formatNumberValue(value: any, field: FieldConfig): string {
  if (!value && value !== 0) return 'Δεν έχει οριστεί';

  const numValue = Number(value);
  if (isNaN(numValue)) return 'Άκυρη τιμή';

  // Special formatting for currency amounts
  if (field.id.includes('capital') || field.id.includes('amount')) {
    return new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR' }).format(numValue);
  }

  return numValue.toLocaleString('el-GR');
}

/**
 * Formats a select value for display
 */
function formatSelectValue(value: any, field: FieldConfig): string {
  if (!value) return 'Δεν έχει οριστεί';

  if (field.options) {
    const option = field.options.find(opt => opt.value === value);


    return option ? option.label : value;
  }

  return String(value);
}

/**
 * Formats any field value for display
 */
function formatFieldValue(value: any, field: FieldConfig, customFormatters?: Record<string, any>): string {
  // Check for custom formatter
  if (customFormatters && customFormatters[field.id]) {
    return customFormatters[field.id](value, field);
  }

  // Handle empty values
  if (value === null || value === undefined || value === '') {
    return 'Δεν έχει οριστεί';
  }

  // Format based on field type
  switch (field.type) {
    case 'date':
      return formatDateValue(value);
    case 'number':
      return formatNumberValue(value, field);
    case 'select':
      return formatSelectValue(value, field);
    case 'email':
      return value ? String(value) : 'Δεν έχει οριστεί';
    case 'tel':
      return value ? String(value) : 'Δεν έχει οριστεί';
    default:
      return String(value);
  }
}

// ============================================================================
// DISPLAY COMPONENTS
// ============================================================================

/**
 * Renders a single field in display mode
 */
function DisplayField({
  field,
  data,
  customRenderers,
  valueFormatters
}: {
  field: FieldConfig;
  data: any;
  customRenderers?: Record<string, any>;
  valueFormatters?: Record<string, any>;
}) {
  // Check for custom renderer
  if (customRenderers && customRenderers[field.id]) {
    return customRenderers[field.id](field, data);
  }

  // 🔍 Enhanced value lookup: Check both root level and customFields
  let value = data[field.id];

  // If value not found at root level, check customFields
  if ((value === undefined || value === null || value === '') && data.customFields) {
    value = data.customFields[field.id];
  }


  const formattedValue = formatFieldValue(value, field, valueFormatters);

  return (
    <div>
      <label className="text-sm font-medium">{field.label}</label>
      <p className="text-sm text-muted-foreground">{formattedValue}</p>
      {field.helpText && (
        <p className="text-xs text-muted-foreground/60 mt-1">{field.helpText}</p>
      )}
    </div>
  );
}

/**
 * Renders a section in compact mode (inline)
 */
function CompactSectionRenderer({
  section,
  data,
  customRenderers,
  valueFormatters
}: {
  section: SectionConfig;
  data: any;
  customRenderers?: Record<string, any>;
  valueFormatters?: Record<string, any>;
}) {
  const IconComponent = getIconComponent(section.icon);

  return (
    <div className="space-y-2">
      <h5 className="font-medium text-sm flex items-center gap-2">
        <IconComponent className="h-4 w-4" />
        {section.title}
      </h5>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {section.fields.map(field => (
          <DisplayField
            key={field.id}
            field={field}
            data={data}
            customRenderers={customRenderers}
            valueFormatters={valueFormatters}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Renders a section in full display mode
 */
function FullSectionRenderer({
  section,
  data,
  customRenderers,
  valueFormatters
}: {
  section: SectionConfig;
  data: any;
  customRenderers?: Record<string, any>;
  valueFormatters?: Record<string, any>;
}) {
  const IconComponent = getIconComponent(section.icon);

  return (
    <div className="p-4 border rounded-lg space-y-4">
      <h4 className="font-semibold mb-3 flex items-center gap-2">
        <IconComponent className="h-5 w-5" />
        {section.title}
      </h4>
      {section.description && (
        <p className="text-sm text-muted-foreground mb-4">{section.description}</p>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {section.fields.map(field => (
          <DisplayField
            key={field.id}
            field={field}
            data={data}
            customRenderers={customRenderers}
            valueFormatters={valueFormatters}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * Generic Tab Renderer που δημιουργεί display tabs από configuration
 *
 * @example
 * ```tsx
 * import { getCompanySection } from '@/config/company-gemi-config';
 *
 * function ContactDetailsTab() {
 *   const section = getCompanySection('basicInfo');
 *
 *   return (
 *     <GenericTabRenderer
 *       section={section}
 *       data={contact}
 *       mode="display"
 *     />
 *   );
 * }
 * ```
 */
export function GenericTabRenderer({
  section,
  data,
  mode = 'display',
  customRenderers,
  valueFormatters
}: GenericTabRendererProps) {
  if (!section) {
    console.warn('GenericTabRenderer: No section provided');
    return <div className="text-center text-muted-foreground">Δεν υπάρχουν διαθέσιμα δεδομένα</div>;
  }

  if (!data) {
    return (
      <div className="text-center text-muted-foreground p-8">
        <p>Δεν υπάρχουν δεδομένα για προβολή</p>
      </div>
    );
  }

  // Render based on mode
  switch (mode) {
    case 'compact':
      return (
        <CompactSectionRenderer
          section={section}
          data={data}
          customRenderers={customRenderers}
          valueFormatters={valueFormatters}
        />
      );
    case 'display':
    default:
      return (
        <FullSectionRenderer
          section={section}
          data={data}
          customRenderers={customRenderers}
          valueFormatters={valueFormatters}
        />
      );
  }
}

export default GenericTabRenderer;