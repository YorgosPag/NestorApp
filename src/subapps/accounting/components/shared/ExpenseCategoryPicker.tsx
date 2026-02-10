'use client';

import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AccountCategory } from '@/subapps/accounting/types';

interface ExpenseCategoryPickerProps {
  value: AccountCategory;
  onValueChange: (category: AccountCategory) => void;
  type: 'income' | 'expense';
  disabled?: boolean;
}

const INCOME_CATEGORY_CODES: AccountCategory[] = [
  'service_income',
  'construction_income',
  'construction_res_income',
  'asset_sale_income',
  'other_income',
];

const EXPENSE_CATEGORY_CODES: AccountCategory[] = [
  'third_party_fees',
  'rent',
  'utilities',
  'telecom',
  'fuel',
  'vehicle_expenses',
  'vehicle_insurance',
  'office_supplies',
  'software',
  'equipment',
  'travel',
  'training',
  'advertising',
  'efka',
  'professional_tax',
  'bank_fees',
  'tee_fees',
  'depreciation',
  'other_expense',
];

export function ExpenseCategoryPicker({
  value,
  onValueChange,
  type,
  disabled,
}: ExpenseCategoryPickerProps) {
  const { t } = useTranslation('accounting');
  const codes = type === 'income' ? INCOME_CATEGORY_CODES : EXPENSE_CATEGORY_CODES;
  const i18nSection = type === 'income' ? 'categories.income' : 'categories.expense';

  return (
    <Select
      value={value}
      onValueChange={(v) => onValueChange(v as AccountCategory)}
      disabled={disabled}
    >
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {codes.map((code) => (
          <SelectItem key={code} value={code}>
            {t(`${i18nSection}.${code}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
