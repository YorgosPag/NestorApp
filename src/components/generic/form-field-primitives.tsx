'use client';

/**
 * Form field primitives — SSoT (ADR-595).
 *
 * The three config-driven form renderers (`IndividualFormRenderer`,
 * `ServiceFormRenderer`, `GenericFormRenderer`) each used to re-implement an
 * identical set of field-render functions (input / textarea / select) plus the
 * same handler type aliases, `PhotoData` shape and `toStringValue` helper. That
 * produced the bulk of the `components/generic` token clones (jscpd, CHECK 3.28).
 *
 * This module owns those primitives ONCE. Each renderer keeps its own thin
 * `renderField` dispatcher + section shell (because their i18n strategy and
 * section headers genuinely diverge) but delegates the actual field JSX here.
 *
 * The primitives are deliberately *presentational* — they receive already
 * i18n-resolved strings (placeholder, option labels) so no translation
 * strategy leaks into the shared layer (no God-shell). The prop contracts live
 * here too, so a divergent type declaration can never re-introduce the clone.
 *
 * @module components/generic/form-field-primitives
 * @see form-select-helpers (clearable-select SSoT, ADR-324)
 * @see components/ui/form/UniversalClickableField
 */

import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ClearableSelectSection,
  shouldAllowClearForField,
  wrapClearableSelectHandler,
} from './form-select-helpers';
import { Textarea } from '@/components/ui/textarea';
import { UniversalClickableField } from '@/components/ui/form/UniversalClickableField';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('form-field-primitives');

// ============================================================================
// SHARED TYPES (owned here so no renderer re-declares them → no type clone)
// ============================================================================

/** Primitive form value stored per field. */
export type FormFieldValue = string | number | boolean | null | undefined;

/** Form data object keyed by field id. */
export type FormFieldDataRecord = Record<string, FormFieldValue>;

/** Change handler for input / textarea elements. */
export type FormFieldChangeHandler = (
  e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
) => void;

/** Change handler for <Select> fields. */
export type FormSelectChangeHandler = (name: string, value: string) => void;

/** Blur handler keyed by field id. */
export type FormFieldBlurHandler = (fieldName: string) => void;

/** Uploaded photo descriptor (shared across form renderers). */
export interface FormPhotoData {
  url: string;
  name?: string;
  size?: number;
}

/**
 * Structural subset shared by `FieldConfig`, `IndividualFieldConfig` and
 * `ServiceFieldConfig`. All three are assignable to this shape, so the
 * primitives stay config-agnostic. Fields that differ only in NAME between the
 * configs (`defaultValue` vs `initialValue`) are intentionally omitted — the
 * caller passes them explicitly via `fallbackValue`.
 */
export interface FormFieldDescriptor {
  id: string;
  type: string;
  label: string;
  required?: boolean;
  placeholder?: string;
  maxLength?: number;
  options?: ReadonlyArray<{ value: string; label: string }>;
  className?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Convert any form value to a safe string for controlled inputs.
 * Handles string | number | boolean | null | undefined.
 */
export function toStringValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

// ============================================================================
// FIELD PRIMITIVES
// ============================================================================

export interface FormTextFieldProps {
  field: FormFieldDescriptor;
  value: FormFieldValue;
  onChange: FormFieldChangeHandler;
  disabled: boolean;
  /** Override the rendered input type (defaults to `field.type`). */
  type?: string;
  /** Pre-resolved placeholder (already i18n-translated by the caller). */
  placeholder?: string;
  error?: string;
  onFieldBlur?: FormFieldBlurHandler;
}

/**
 * Single text-like field primitive covering input / date / number / email /
 * tel via `type={field.type}`. Replaces the five near-identical
 * `UniversalClickableField` wrappers that previously self-cloned inside
 * `GenericFormRenderer`.
 */
export function FormTextField({
  field,
  value,
  onChange,
  disabled,
  type,
  placeholder,
  error,
  onFieldBlur,
}: FormTextFieldProps): React.ReactNode {
  return (
    <UniversalClickableField
      id={field.id}
      name={field.id}
      type={type ?? field.type}
      value={toStringValue(value)}
      onChange={onChange}
      disabled={disabled}
      required={field.required}
      placeholder={placeholder ?? field.placeholder}
      maxLength={field.maxLength}
      className={field.className}
      onBlur={onFieldBlur ? () => onFieldBlur(field.id) : undefined}
      error={error}
    />
  );
}

export interface FormTextAreaFieldProps {
  field: FormFieldDescriptor;
  value: FormFieldValue;
  onChange: FormFieldChangeHandler;
  disabled: boolean;
  /** Row count (defaults to 4). */
  rows?: number;
  /** Pre-resolved placeholder (already i18n-translated by the caller). */
  placeholder?: string;
}

/** Multi-line textarea field primitive. */
export function FormTextAreaField({
  field,
  value,
  onChange,
  disabled,
  rows = 4,
  placeholder,
}: FormTextAreaFieldProps): React.ReactNode {
  return (
    <Textarea
      id={field.id}
      name={field.id}
      value={toStringValue(value)}
      onChange={onChange}
      disabled={disabled}
      required={field.required}
      placeholder={placeholder ?? field.placeholder}
      rows={rows}
      className={field.className}
    />
  );
}

export interface FormSelectFieldProps {
  field: FormFieldDescriptor;
  value: FormFieldValue;
  onSelectChange: FormSelectChangeHandler;
  disabled: boolean;
  /** Fallback value when the form has none (config `defaultValue`/`initialValue`). */
  fallbackValue?: string;
  /** Pre-resolved trigger placeholder. */
  placeholder?: React.ReactNode;
  /** Optional option-label resolver (identity when omitted). */
  renderOptionLabel?: (label: string) => React.ReactNode;
}

/**
 * Clearable <Select> field primitive. Reuses the clearable-select SSoT
 * (`form-select-helpers`) for the sentinel item + change wrapping.
 */
export function FormSelectField({
  field,
  value,
  onSelectChange,
  disabled,
  fallbackValue,
  placeholder,
  renderOptionLabel,
}: FormSelectFieldProps): React.ReactNode {
  const valueStr =
    value !== null && value !== undefined ? String(value) : (fallbackValue ?? '');
  const allowClear = shouldAllowClearForField(field);

  return (
    <Select
      name={field.id}
      value={valueStr}
      onValueChange={wrapClearableSelectHandler((v) => onSelectChange(field.id, v))}
      disabled={disabled}
      required={field.required}
    >
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <ClearableSelectSection shouldAllowClear={allowClear} />
        {field.options?.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {renderOptionLabel ? renderOptionLabel(option.label) : option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ============================================================================
// FIELD DISPATCHER (SSoT) — one type→primitive switch for every form renderer
// ============================================================================

const TEXT_FIELD_TYPES = new Set([
  'input',
  'date',
  'number',
  'email',
  'tel',
  'url',
]);

/**
 * Per-renderer i18n / config strategy injected into `renderFormField`. Keeps
 * the (genuinely divergent) translation behaviour out of the shared dispatcher
 * so the switch stays identical for every renderer.
 */
export interface FieldRenderStrategy<F extends FormFieldDescriptor = FormFieldDescriptor> {
  /** Text-input placeholder (undefined → falls back to `field.placeholder`). */
  inputPlaceholder?: (field: F) => string | undefined;
  /** Textarea placeholder (undefined → `field.placeholder`). */
  textareaPlaceholder?: (field: F) => string | undefined;
  /** Trigger placeholder for selects. */
  selectPlaceholder: (field: F) => React.ReactNode;
  /** Option-label resolver for selects (identity when omitted). */
  optionLabel?: (label: string) => React.ReactNode;
  /** Fallback select value from the config (`defaultValue`/`initialValue`). */
  selectFallbackValue?: (field: F) => string | undefined;
  /** Textarea row count (default 4). */
  textareaRows?: number;
}

/** Custom per-field renderer signature (shared by all renderers). */
export type FormCustomFieldRenderer<F extends FormFieldDescriptor = FormFieldDescriptor> = (
  field: F,
  formData: FormFieldDataRecord,
  onChange: FormFieldChangeHandler,
  onSelectChange: FormSelectChangeHandler,
  disabled: boolean,
) => React.ReactNode;

export interface RenderFormFieldArgs<F extends FormFieldDescriptor> {
  field: F;
  formData: FormFieldDataRecord;
  onChange: FormFieldChangeHandler;
  onSelectChange: FormSelectChangeHandler;
  disabled: boolean;
  strategy: FieldRenderStrategy<F>;
  customRenderers?: Record<string, FormCustomFieldRenderer<F>>;
  fieldError?: string;
  onFieldBlur?: FormFieldBlurHandler;
}

/**
 * Shared field dispatcher: `select` → `FormSelectField`, `textarea` →
 * `FormTextAreaField`, everything text-like (and any unknown type) →
 * `FormTextField`. A `select` with no options degrades to a text input, and an
 * unrecognised type is logged. This is the single switch that every
 * `*FormRenderer` shares (ADR-595).
 */
export function renderFormField<F extends FormFieldDescriptor>({
  field,
  formData,
  onChange,
  onSelectChange,
  disabled,
  strategy,
  customRenderers,
  fieldError,
  onFieldBlur,
}: RenderFormFieldArgs<F>): React.ReactNode {
  if (customRenderers && customRenderers[field.id]) {
    return customRenderers[field.id](field, formData, onChange, onSelectChange, disabled);
  }

  const value = formData[field.id];

  if (field.type === 'select' && field.options && field.options.length > 0) {
    return (
      <FormSelectField
        field={field}
        value={value}
        onSelectChange={onSelectChange}
        disabled={disabled}
        fallbackValue={strategy.selectFallbackValue?.(field)}
        placeholder={strategy.selectPlaceholder(field)}
        renderOptionLabel={strategy.optionLabel}
      />
    );
  }

  if (field.type === 'textarea') {
    return (
      <FormTextAreaField
        field={field}
        value={value}
        onChange={onChange}
        disabled={disabled}
        rows={strategy.textareaRows}
        placeholder={strategy.textareaPlaceholder?.(field)}
      />
    );
  }

  if (field.type !== 'select' && !TEXT_FIELD_TYPES.has(field.type)) {
    logger.warn('Unknown field type', { fieldType: field.type, fieldId: field.id });
  }

  return (
    <FormTextField
      field={field}
      value={value}
      onChange={onChange}
      disabled={disabled}
      placeholder={strategy.inputPlaceholder?.(field)}
      error={fieldError}
      onFieldBlur={onFieldBlur}
    />
  );
}

/**
 * Bind a field renderer to a form's shared context so section render loops only
 * pass the per-field `field`. This keeps the dispatch call out of each
 * renderer's JSX (avoiding an identical prop-forwarding clone across files).
 */
export interface FieldRendererContext<F extends FormFieldDescriptor> {
  formData: FormFieldDataRecord;
  onChange: FormFieldChangeHandler;
  onSelectChange: FormSelectChangeHandler;
  disabled: boolean;
  strategy: FieldRenderStrategy<F>;
  customRenderers?: Record<string, FormCustomFieldRenderer<F>>;
  fieldErrors?: Record<string, string>;
  onFieldBlur?: FormFieldBlurHandler;
}

export function createFieldRenderer<F extends FormFieldDescriptor>(
  ctx: FieldRendererContext<F>,
): (field: F) => React.ReactNode {
  return (field) =>
    renderFormField({
      field,
      formData: ctx.formData,
      onChange: ctx.onChange,
      onSelectChange: ctx.onSelectChange,
      disabled: ctx.disabled,
      strategy: ctx.strategy,
      customRenderers: ctx.customRenderers,
      fieldError: ctx.fieldErrors?.[field.id],
      onFieldBlur: ctx.onFieldBlur,
    });
}

export interface SectionFormRendererSetup<F extends FormFieldDescriptor> {
  /** Per-field renderer bound to the supplied strategy + shared context. */
  renderField: (field: F) => React.ReactNode;
  /** False when there are no sections to render (caller should return null). */
  hasSections: boolean;
}

/**
 * Shared setup for the section-based form renderers (`IndividualFormRenderer` /
 * `ServiceFormRenderer`): build the field renderer for the given strategy and validate
 * that sections exist. The two renderers differ ONLY in their strategy and their
 * section-body layout — this owns the identical `createFieldRenderer` wiring + the
 * empty-sections guard once (jscpd, CHECK 3.28).
 */
export function buildSectionFormRenderer<F extends FormFieldDescriptor>(
  ctx: FieldRendererContext<F>,
  sections: readonly unknown[] | undefined,
): SectionFormRendererSetup<F> {
  const renderField = createFieldRenderer(ctx);
  const hasSections = Array.isArray(sections) && sections.length > 0;
  if (!hasSections) {
    logger.warn('No sections provided');
  }
  return { renderField, hasSections };
}
