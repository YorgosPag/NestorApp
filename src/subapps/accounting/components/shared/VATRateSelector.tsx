'use client';

import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface VATRateSelectorProps {
  value: number;
  onValueChange: (rate: number) => void;
  disabled?: boolean;
}

const VAT_RATES = [
  { rate: 24, key: 'standard' },
  { rate: 13, key: 'reduced' },
  { rate: 6, key: 'superReduced' },
  { rate: 0, key: 'exempt' },
] as const;

export function VATRateSelector({ value, onValueChange, disabled }: VATRateSelectorProps) {
  const { t } = useTranslation('accounting');

  return (
    <Select
      value={String(value)}
      onValueChange={(v) => onValueChange(Number(v))}
      disabled={disabled}
    >
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {VAT_RATES.map(({ rate, key }) => (
          <SelectItem key={rate} value={String(rate)}>
            {t(`common.vatRates.${key}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
