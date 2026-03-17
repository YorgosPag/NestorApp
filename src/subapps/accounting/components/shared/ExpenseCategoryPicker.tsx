'use client';

import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AccountCategory } from '@/subapps/accounting/types';
import type { CustomCategoryDocument } from '@/subapps/accounting/types/custom-category';

interface ExpenseCategoryPickerProps {
  value: AccountCategory;
  onValueChange: (category: AccountCategory) => void;
  type: 'income' | 'expense';
  /** Custom categories από useCustomCategories hook */
  customCategories?: CustomCategoryDocument[];
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
  customCategories = [],
  disabled,
}: ExpenseCategoryPickerProps) {
  const { t } = useTranslation('accounting');

  const builtInCodes = type === 'income' ? INCOME_CATEGORY_CODES : EXPENSE_CATEGORY_CODES;
  const i18nSection = type === 'income' ? 'categories.income' : 'categories.expense';

  const activeCustom = customCategories.filter((c) => c.type === type && c.isActive);
  const hasCustom = activeCustom.length > 0;

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
        {hasCustom ? (
          <>
            <SelectGroup>
              <SelectLabel>{t('categories.groups.standard', 'Τυπικές Κατηγορίες')}</SelectLabel>
              {builtInCodes.map((code) => (
                <SelectItem key={code} value={code}>
                  {t(`${i18nSection}.${code}`)}
                </SelectItem>
              ))}
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>{t('categories.groups.custom', 'Προσαρμοσμένες Κατηγορίες')}</SelectLabel>
              {activeCustom.map((cat) => (
                <SelectItem key={cat.code} value={cat.code}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </>
        ) : (
          builtInCodes.map((code) => (
            <SelectItem key={code} value={code}>
              {t(`${i18nSection}.${code}`)}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}
