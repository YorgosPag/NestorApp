'use client';

import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface FiscalYearPickerProps {
  value: number;
  onValueChange: (year: number) => void;
  disabled?: boolean;
}

function getAvailableYears(): number[] {
  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let y = currentYear; y >= currentYear - 5; y--) {
    years.push(y);
  }
  return years;
}

export function FiscalYearPicker({ value, onValueChange, disabled }: FiscalYearPickerProps) {
  const { t } = useTranslation('accounting');
  const years = getAvailableYears();

  return (
    <Select
      value={String(value)}
      onValueChange={(v) => onValueChange(Number(v))}
      disabled={disabled}
    >
      <SelectTrigger>
        <SelectValue placeholder={t('common.fiscalYear')} />
      </SelectTrigger>
      <SelectContent>
        {years.map((year) => (
          <SelectItem key={year} value={String(year)}>
            {year}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
