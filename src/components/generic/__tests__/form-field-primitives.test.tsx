/**
 * Render-verify tests for form-field-primitives.tsx (ADR-595).
 *
 * Locks the shared field-primitive SSoT that IndividualFormRenderer,
 * ServiceFormRenderer and GenericFormRenderer all delegate to:
 *   - toStringValue coercion
 *   - FormTextField / FormTextAreaField / FormSelectField rendering + value flow
 *   - renderFormField type dispatch (select / textarea / text / unknown)
 *   - a select with no options degrades to a text input
 *   - createFieldRenderer binds shared context (fieldError + custom renderers)
 *
 * Heavy leaf components (UniversalClickableField, Radix Select, Textarea) and
 * the clearable-select helpers are mocked to plain elements so the test asserts
 * wiring, not design-system styling.
 *
 * @module components/generic/__tests__/form-field-primitives
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

// ─── Mocks (plain elements — assert wiring, not styling) ─────────────────────

jest.mock('@/components/ui/form/UniversalClickableField', () => ({
  UniversalClickableField: ({
    type,
    value,
    onChange,
    placeholder,
    error,
  }: {
    type: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
    error?: string;
  }) => (
    <input
      data-testid="text-field"
      data-type={type}
      data-error={error ?? ''}
      value={value}
      placeholder={placeholder}
      onChange={onChange}
    />
  ),
}));

jest.mock('@/components/ui/textarea', () => ({
  Textarea: ({
    value,
    onChange,
    rows,
    placeholder,
  }: {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    rows?: number;
    placeholder?: string;
  }) => (
    <textarea
      data-testid="textarea-field"
      data-rows={rows}
      value={value}
      placeholder={placeholder}
      onChange={onChange}
    />
  ),
}));

jest.mock('@/components/ui/select', () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange: (v: string) => void;
    children: React.ReactNode;
  }) => (
    <div data-testid="select-field" data-value={value}>
      <button data-testid="select-fire" onClick={() => onValueChange('picked')}>
        fire
      </button>
      {children}
    </div>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: React.ReactNode }) => (
    <span data-testid="select-placeholder">{placeholder}</span>
  ),
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <div data-testid="select-item" data-value={value}>
      {children}
    </div>
  ),
}));

jest.mock('../form-select-helpers', () => ({
  ClearableSelectSection: () => null,
  wrapClearableSelectHandler: (fn: (v: string) => void) => fn,
  shouldAllowClearForField: () => true,
}));

jest.mock('@/lib/telemetry', () => {
  const warn = jest.fn();
  return { createModuleLogger: () => ({ warn, info: jest.fn(), error: jest.fn() }) };
});

import { createModuleLogger } from '@/lib/telemetry';
// createModuleLogger returns the same captured `warn` closure on every call.
const mockWarn = createModuleLogger('t').warn as jest.Mock;

import {
  toStringValue,
  FormTextField,
  FormTextAreaField,
  FormSelectField,
  renderFormField,
  createFieldRenderer,
  type FieldRenderStrategy,
  type FormFieldDescriptor,
} from '../form-field-primitives';

const selectField: FormFieldDescriptor = {
  id: 'status',
  type: 'select',
  label: 'Status',
  options: [
    { value: 'a', label: 'Alpha' },
    { value: 'b', label: 'Beta' },
  ],
};

const strategy: FieldRenderStrategy = {
  selectPlaceholder: () => 'choose…',
  optionLabel: (label) => `T:${label}`,
  selectFallbackValue: () => 'a',
  textareaRows: 3,
};

beforeEach(() => mockWarn.mockClear());

// ─── toStringValue ───────────────────────────────────────────────────────────

describe('toStringValue', () => {
  it('coerces every supported primitive', () => {
    expect(toStringValue(null)).toBe('');
    expect(toStringValue(undefined)).toBe('');
    expect(toStringValue('hi')).toBe('hi');
    expect(toStringValue(42)).toBe('42');
    expect(toStringValue(true)).toBe('true');
    expect(toStringValue(false)).toBe('false');
  });
});

// ─── FormTextField ───────────────────────────────────────────────────────────

describe('FormTextField', () => {
  it('renders with field.type and coerced value; forwards onChange', () => {
    const onChange = jest.fn();
    render(
      <FormTextField
        field={{ id: 'age', type: 'number', label: 'Age' }}
        value={7}
        onChange={onChange}
        disabled={false}
      />,
    );
    const input = screen.getByTestId('text-field');
    expect(input).toHaveAttribute('data-type', 'number');
    expect(input).toHaveValue('7');
    fireEvent.change(input, { target: { value: '8' } });
    expect(onChange).toHaveBeenCalled();
  });

  it('prefers an explicit placeholder over field.placeholder', () => {
    render(
      <FormTextField
        field={{ id: 'x', type: 'input', label: 'X', placeholder: 'raw' }}
        value=""
        onChange={jest.fn()}
        disabled={false}
        placeholder="resolved"
      />,
    );
    expect(screen.getByTestId('text-field')).toHaveAttribute('placeholder', 'resolved');
  });
});

// ─── FormTextAreaField ───────────────────────────────────────────────────────

describe('FormTextAreaField', () => {
  it('defaults to 4 rows and honours an override', () => {
    const { rerender } = render(
      <FormTextAreaField
        field={{ id: 'notes', type: 'textarea', label: 'Notes' }}
        value="body"
        onChange={jest.fn()}
        disabled={false}
      />,
    );
    expect(screen.getByTestId('textarea-field')).toHaveAttribute('data-rows', '4');
    rerender(
      <FormTextAreaField
        field={{ id: 'notes', type: 'textarea', label: 'Notes' }}
        value="body"
        onChange={jest.fn()}
        disabled={false}
        rows={3}
      />,
    );
    expect(screen.getByTestId('textarea-field')).toHaveAttribute('data-rows', '3');
  });
});

// ─── FormSelectField ─────────────────────────────────────────────────────────

describe('FormSelectField', () => {
  it('renders options via renderOptionLabel and fires onSelectChange with field id', () => {
    const onSelectChange = jest.fn();
    render(
      <FormSelectField
        field={selectField}
        value={undefined}
        onSelectChange={onSelectChange}
        disabled={false}
        fallbackValue="a"
        placeholder="choose…"
        renderOptionLabel={(l) => `T:${l}`}
      />,
    );
    expect(screen.getByTestId('select-field')).toHaveAttribute('data-value', 'a');
    expect(screen.getByText('T:Alpha')).toBeInTheDocument();
    expect(screen.getByText('T:Beta')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('select-fire'));
    expect(onSelectChange).toHaveBeenCalledWith('status', 'picked');
  });
});

// ─── renderFormField dispatch ────────────────────────────────────────────────

describe('renderFormField', () => {
  const base = {
    formData: { status: 'b', name: 'x', bio: 'hello' } as Record<string, string>,
    onChange: jest.fn(),
    onSelectChange: jest.fn(),
    disabled: false,
    strategy,
  };

  it('routes select → select field', () => {
    render(<>{renderFormField({ ...base, field: selectField })}</>);
    expect(screen.getByTestId('select-field')).toBeInTheDocument();
  });

  it('routes textarea → textarea field with strategy rows', () => {
    render(
      <>{renderFormField({ ...base, field: { id: 'bio', type: 'textarea', label: 'Bio' } })}</>,
    );
    expect(screen.getByTestId('textarea-field')).toHaveAttribute('data-rows', '3');
  });

  it('routes text-like types → text field', () => {
    render(
      <>{renderFormField({ ...base, field: { id: 'name', type: 'email', label: 'Name' } })}</>,
    );
    expect(screen.getByTestId('text-field')).toHaveAttribute('data-type', 'email');
  });

  it('degrades a select with no options to a text input', () => {
    render(
      <>{renderFormField({ ...base, field: { id: 'name', type: 'select', label: 'Name' } })}</>,
    );
    expect(screen.getByTestId('text-field')).toBeInTheDocument();
    expect(screen.queryByTestId('select-field')).not.toBeInTheDocument();
  });

  it('logs a warning for an unknown field type and falls back to text', () => {
    render(
      <>{renderFormField({ ...base, field: { id: 'name', type: 'mystery', label: 'Name' } })}</>,
    );
    expect(screen.getByTestId('text-field')).toBeInTheDocument();
    expect(mockWarn).toHaveBeenCalledWith(
      'Unknown field type',
      expect.objectContaining({ fieldType: 'mystery', fieldId: 'name' }),
    );
  });

  it('honours a custom renderer over the built-in dispatch', () => {
    const custom = jest.fn(() => <div data-testid="custom">custom!</div>);
    render(
      <>
        {renderFormField({
          ...base,
          field: selectField,
          customRenderers: { status: custom },
        })}
      </>,
    );
    expect(screen.getByTestId('custom')).toBeInTheDocument();
    expect(screen.queryByTestId('select-field')).not.toBeInTheDocument();
  });
});

// ─── createFieldRenderer ─────────────────────────────────────────────────────

describe('createFieldRenderer', () => {
  it('binds context and forwards the per-field error', () => {
    const renderField = createFieldRenderer({
      formData: { name: 'value' },
      onChange: jest.fn(),
      onSelectChange: jest.fn(),
      disabled: false,
      strategy,
      fieldErrors: { name: 'Required' },
    });
    render(<>{renderField({ id: 'name', type: 'input', label: 'Name' })}</>);
    const input = screen.getByTestId('text-field');
    expect(input).toHaveValue('value');
    expect(input).toHaveAttribute('data-error', 'Required');
  });
});
