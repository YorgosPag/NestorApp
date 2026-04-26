'use client';

import { useMemo } from 'react';
import { SearchableCombobox } from '@/components/ui/searchable-combobox';
import type { ComboboxOption } from '@/components/ui/searchable-combobox-types';
import { TRADE_SEED_DATA } from '@/subapps/procurement/data/trades';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { TradeCode, TradeGroup } from '@/subapps/procurement/types/trade';

interface TradeSelectorProps {
  value: TradeCode | '';
  onChange: (code: TradeCode) => void;
  disabled?: boolean;
  error?: string;
  className?: string;
}

export function TradeSelector({
  value,
  onChange,
  disabled,
  error,
  className,
}: TradeSelectorProps) {
  const { t } = useTranslation('quotes');

  const options = useMemo<ComboboxOption[]>(
    () =>
      TRADE_SEED_DATA.map((trade) => ({
        value: trade.code,
        label: t(`trades.${trade.code}`),
        secondaryLabel: t(`trades.groups.${trade.group as TradeGroup}`),
      })),
    [t]
  );

  return (
    <SearchableCombobox
      value={value}
      onValueChange={(v) => {
        if (v) onChange(v as TradeCode);
      }}
      options={options}
      placeholder={t('trades.select')}
      emptyMessage={t('trades.noResults')}
      disabled={disabled}
      error={error}
      className={className}
    />
  );
}
