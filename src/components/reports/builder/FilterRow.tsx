/**
 * @module components/reports/builder/FilterRow
 * @enterprise ADR-268 — Single Filter Row (Field + Operator + Value)
 *
 * Uses Radix Select for field and operator pickers.
 * Value input changes type based on field type.
 */

'use client';

import '@/lib/design-system';
import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, X } from 'lucide-react';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  OPERATORS_BY_TYPE,
  type DomainDefinition,
  type ReportBuilderFilter,
  type FilterOperator,
  type FilterValue,
  type FieldDefinition,
} from '@/config/report-builder/report-builder-types';
import { getFilterableFields } from '@/config/report-builder/domain-definitions';

interface FilterRowProps {
  domainDefinition: DomainDefinition;
  existingFilter?: ReportBuilderFilter;
  onConfirm: (filter: Omit<ReportBuilderFilter, 'id'>) => void;
  onCancel: () => void;
}

export function FilterRow({
  domainDefinition,
  existingFilter,
  onConfirm,
  onCancel,
}: FilterRowProps) {
  const { t } = useTranslation('report-builder');
  const { t: tDomains } = useTranslation('report-builder-domains');

  const filterableFields = useMemo(
    () => getFilterableFields(domainDefinition.id),
    [domainDefinition.id],
  );

  const [fieldKey, setFieldKey] = useState(existingFilter?.fieldKey ?? '');
  const [operator, setOperator] = useState<FilterOperator>(
    existingFilter?.operator ?? 'eq',
  );
  const [value, setValue] = useState<string>(
    existingFilter ? String(existingFilter.value) : '',
  );
  const [valueTo, setValueTo] = useState<string>(''); // for 'between'

  const selectedField = useMemo(
    () => filterableFields.find((f) => f.key === fieldKey),
    [filterableFields, fieldKey],
  );

  const availableOperators = useMemo(
    () => (selectedField ? OPERATORS_BY_TYPE[selectedField.type] : []),
    [selectedField],
  );

  // Reset operator when field changes
  const handleFieldChange = useCallback(
    (newFieldKey: string) => {
      setFieldKey(newFieldKey);
      const field = filterableFields.find((f) => f.key === newFieldKey);
      if (field) {
        const ops = OPERATORS_BY_TYPE[field.type];
        setOperator(ops[0]);
      }
      setValue('');
      setValueTo('');
    },
    [filterableFields],
  );

  const handleConfirm = useCallback(() => {
    if (!fieldKey || !value) return;

    const parsedValue = parseFilterValue(selectedField, operator, value, valueTo);
    if (parsedValue === null) return;

    onConfirm({ fieldKey, operator, value: parsedValue });
  }, [fieldKey, operator, value, valueTo, selectedField, onConfirm]);

  const isValid = fieldKey && value && (operator !== 'between' || valueTo);

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-md border p-3">
      {/* Field selector */}
      <div className="min-w-[160px] flex-1">
        <label className="mb-1 block text-xs text-muted-foreground">
          {t('filters.field')}
        </label>
        <Select value={fieldKey} onValueChange={handleFieldChange}>
          <SelectTrigger>
            <SelectValue placeholder={t('filters.selectField')} />
          </SelectTrigger>
          <SelectContent>
            {filterableFields.map((f) => (
              <SelectItem key={f.key} value={f.key}>
                {tDomains(f.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Operator selector */}
      <div className="min-w-[120px]">
        <label className="mb-1 block text-xs text-muted-foreground">
          {t('filters.operator')}
        </label>
        <Select
          value={operator}
          onValueChange={(val) => setOperator(val as FilterOperator)}
          disabled={!fieldKey}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {availableOperators.map((op) => (
              <SelectItem key={op} value={op}>
                {t(`operators.${op}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Value input */}
      <div className="min-w-[140px] flex-1">
        <label className="mb-1 block text-xs text-muted-foreground">
          {t('filters.value')}
        </label>
        <ValueInput
          field={selectedField}
          operator={operator}
          value={value}
          valueTo={valueTo}
          onChange={setValue}
          onChangeTo={setValueTo}
          disabled={!fieldKey}
        />
      </div>

      {/* Confirm / Cancel */}
      <div className="flex gap-1">
        <Button
          size="icon"
          variant="ghost"
          onClick={handleConfirm}
          disabled={!isValid}
          aria-label={t('filters.confirm')}
        >
          <Check className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={onCancel}
          aria-label={t('filters.cancel')}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Value Input — adapts to field type
// ============================================================================

interface ValueInputProps {
  field: FieldDefinition | undefined;
  operator: FilterOperator;
  value: string;
  valueTo: string;
  onChange: (val: string) => void;
  onChangeTo: (val: string) => void;
  disabled: boolean;
}

function ValueInput({
  field, operator, value, valueTo, onChange, onChangeTo, disabled,
}: ValueInputProps) {
  const { t } = useTranslation('report-builder');
  const { t: tDomains } = useTranslation('report-builder-domains');

  if (!field || disabled) {
    return <Input disabled placeholder="..." />;
  }

  // Enum — dropdown
  if (field.type === 'enum' && field.enumValues && operator !== 'in') {
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="..." />
        </SelectTrigger>
        <SelectContent>
          {field.enumValues.map((ev) => (
            <SelectItem key={ev} value={ev}>
              {field.enumLabelPrefix ? tDomains(`${field.enumLabelPrefix}.${ev}`) : ev}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  // Boolean
  if (field.type === 'boolean') {
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="true">{t('filters.boolTrue')}</SelectItem>
          <SelectItem value="false">{t('filters.boolFalse')}</SelectItem>
        </SelectContent>
      </Select>
    );
  }

  // Between — two inputs
  if (operator === 'between') {
    return (
      <div className="flex items-center gap-1">
        <Input
          type={field.type === 'date' ? 'date' : 'number'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="from"
          className="w-1/2"
        />
        <span className="text-xs text-muted-foreground">–</span>
        <Input
          type={field.type === 'date' ? 'date' : 'number'}
          value={valueTo}
          onChange={(e) => onChangeTo(e.target.value)}
          placeholder="to"
          className="w-1/2"
        />
      </div>
    );
  }

  // Date
  if (field.type === 'date') {
    return (
      <Input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  // Number / Currency / Percentage
  if (['number', 'currency', 'percentage'].includes(field.type)) {
    return (
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        step={field.type === 'percentage' ? '0.01' : '1'}
      />
    );
  }

  // Text (default)
  return (
    <Input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

// ============================================================================
// Parse Filter Value
// ============================================================================

function parseFilterValue(
  field: FieldDefinition | undefined,
  operator: FilterOperator,
  value: string,
  valueTo: string,
): FilterValue | null {
  if (!field) return null;

  if (operator === 'between') {
    if (!value || !valueTo) return null;
    if (field.type === 'date') return [value, valueTo];
    return [Number(value), Number(valueTo)];
  }

  if (operator === 'in') {
    return value.split(',').map((v) => v.trim()).filter(Boolean);
  }

  if (field.type === 'boolean') {
    return value === 'true';
  }

  if (['number', 'currency', 'percentage'].includes(field.type)) {
    const num = Number(value);
    return isNaN(num) ? null : num;
  }

  return value;
}
