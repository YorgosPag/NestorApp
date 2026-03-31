'use client';
/* eslint-disable custom/no-hardcoded-strings */

import React from 'react';
import type { FieldConfig, SectionConfig } from '@/config/company-gemi';
import { getIconComponent } from './utils/IconMapping';
import { useIconSizes } from '@/hooks/useIconSizes';
import { formatCurrency, formatDate, formatNumber } from '@/lib/intl-utils';
import { createModuleLogger } from '@/lib/telemetry';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import '@/lib/design-system';

const logger = createModuleLogger('GenericTabRenderer');

// ============================================================================
// 🏢 ENTERPRISE: Type Definitions (ADR-compliant - NO any)
// ============================================================================

/** Data record type for tab display */
export type TabDataRecord = Record<string, string | number | boolean | Date | null | undefined | Record<string, unknown>>;

/** Field value type */
export type FieldValue = string | number | boolean | Date | null | undefined;

/** Custom field renderer function */
export type CustomFieldRenderer = (field: FieldConfig, data: TabDataRecord) => React.ReactNode;

/** Custom value formatter function */
export type ValueFormatter = (value: FieldValue, field: FieldConfig) => string;

export interface GenericTabRendererProps {
  /** Section configuration */
  section: SectionConfig;
  /** Data object to display */
  data: TabDataRecord;
  /** Display mode */
  mode?: 'display' | 'compact';
  /** Custom field renderers for complex data */
  customRenderers?: Record<string, CustomFieldRenderer>;
  /** Custom value formatters */
  valueFormatters?: Record<string, ValueFormatter>;
}

// ============================================================================
// VALUE FORMATTING FUNCTIONS
// ============================================================================

/**
 * ✅ ENTERPRISE MIGRATION: Using centralized formatDate for consistent formatting
 * Formats a date value for display
 */
function formatDateValue(value: FieldValue): string {
  if (!value) return 'Δεν έχει οριστεί';

  try {
    const date = value instanceof Date ? value : new Date(String(value));
    return formatDate(date); // ✅ Using centralized function
  } catch {
    return 'Άκυρη ημερομηνία';
  }
}

/**
 * Formats a number value for display
 */
function formatNumberValue(value: FieldValue, field: FieldConfig): string {
  if (!value && value !== 0) return 'Δεν έχει οριστεί';

  const numValue = Number(value);
  if (isNaN(numValue)) return 'Άκυρη τιμή';

  // Special formatting for currency amounts
  if (field.id.includes('capital') || field.id.includes('amount')) {
    return formatCurrency(numValue, 'EUR');
  }

  return formatNumber(numValue);
}

/**
 * Formats a select value for display
 */
function formatSelectValue(value: FieldValue, field: FieldConfig): string {
  if (!value) return 'Δεν έχει οριστεί';

  if (field.options) {
    const option = field.options.find(opt => opt.value === value);
    return option ? option.label : String(value);
  }

  return String(value);
}

/**
 * Formats any field value for display
 */
function formatFieldValue(
  value: FieldValue,
  field: FieldConfig,
  customFormatters?: Record<string, ValueFormatter>
): string {
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
  data: TabDataRecord;
  customRenderers?: Record<string, CustomFieldRenderer>;
  valueFormatters?: Record<string, ValueFormatter>;
}) {
  const colors = useSemanticColors();
  // Check for custom renderer
  if (customRenderers && customRenderers[field.id]) {
    return customRenderers[field.id](field, data);
  }

  // 🔍 Enhanced value lookup: Check both root level and customFields
  let value = data[field.id] as FieldValue;

  // If value not found at root level, check customFields
  if ((value === undefined || value === null || value === '') && data.customFields) {
    const customFields = data.customFields as Record<string, FieldValue>;
    value = customFields[field.id];
  }

  const formattedValue = formatFieldValue(value, field, valueFormatters);

  return (
    <div>
      <label className="text-sm font-medium">{field.label}</label>
      <p className={cn("text-sm", colors.text.muted)}>{formattedValue}</p>
      {field.helpText && (
        <p className={cn("text-xs /60 mt-1 whitespace-nowrap overflow-hidden text-ellipsis", colors.text.muted)}>{field.helpText}</p>
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
  data: TabDataRecord;
  customRenderers?: Record<string, CustomFieldRenderer>;
  valueFormatters?: Record<string, ValueFormatter>;
}) {
  const iconSizes = useIconSizes();
  const _colors = useSemanticColors();
  const IconComponent = getIconComponent(section.icon);

  return (
    <div className="space-y-2">
      <h5 className="font-medium text-sm flex items-center gap-2">
        <IconComponent className={iconSizes.sm} />
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
  data: TabDataRecord;
  customRenderers?: Record<string, CustomFieldRenderer>;
  valueFormatters?: Record<string, ValueFormatter>;
}) {
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();
  const IconComponent = getIconComponent(section.icon);

  return (
    <div className="p-4 border rounded-lg space-y-4">
      <h4 className="font-semibold mb-3 flex items-center gap-2">
        <IconComponent className={iconSizes.md} />
        {section.title}
      </h4>
      {section.description && (
        <p className={cn("text-sm mb-4", colors.text.muted)}>{section.description}</p>
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
 * import { getCompanySection } from '@/config/company-gemi';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
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
  const colors = useSemanticColors();
  if (!section) {
    logger.warn('No section provided');
    return <div className={cn("text-center", colors.text.muted)}>Δεν υπάρχουν διαθέσιμα δεδομένα</div>;
  }

  if (!data) {
    return (
      <div className={cn("text-center p-8", colors.text.muted)}>
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
