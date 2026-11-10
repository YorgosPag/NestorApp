'use client';

import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { PaymentMethod } from '@/subapps/accounting/types';

interface PaymentMethodSelectorProps {
  value: PaymentMethod;
  onValueChange: (method: PaymentMethod) => void;
  disabled?: boolean;
  /** `id` του trigger — για `<Label htmlFor>` και για τη «μετάβαση στο πεδίο» του ελέγχου τιμολογίου. */
  id?: string;
}

const PAYMENT_METHODS: PaymentMethod[] = [
  'bank_transfer',
  'card',
  'cash',
  'check',
  'credit',
  'mixed',
];

export function PaymentMethodSelector({ value, onValueChange, disabled, id }: PaymentMethodSelectorProps) {
  const { t } = useTranslation(['accounting', 'accounting-tax-offices']);

  return (
    <Select
      value={value}
      onValueChange={(v) => onValueChange(v as PaymentMethod)}
      disabled={disabled}
    >
      <SelectTrigger id={id}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PAYMENT_METHODS.map((method) => (
          <SelectItem key={method} value={method}>
            {t(`common.paymentMethods.${method}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
