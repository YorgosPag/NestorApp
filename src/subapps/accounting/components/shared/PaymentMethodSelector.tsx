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
}

const PAYMENT_METHODS: PaymentMethod[] = [
  'bank_transfer',
  'card',
  'cash',
  'check',
  'credit',
  'mixed',
];

export function PaymentMethodSelector({ value, onValueChange, disabled }: PaymentMethodSelectorProps) {
  const { t } = useTranslation('accounting');

  return (
    <Select
      value={value}
      onValueChange={(v) => onValueChange(v as PaymentMethod)}
      disabled={disabled}
    >
      <SelectTrigger>
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
