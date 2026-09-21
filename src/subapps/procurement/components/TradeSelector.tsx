'use client';

import { useMemo } from 'react';
import { SearchableCombobox, type FieldAccessibleName } from '@/components/ui/searchable-combobox';
import type { ComboboxOption } from '@/components/ui/searchable-combobox-types';
import { TRADE_SEED_DATA } from '@/subapps/procurement/data/trades';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { TradeCode, TradeGroup } from '@/subapps/procurement/types/trade';

interface TradeSelectorOwnProps {
  value: TradeCode | '';
  onChange: (code: TradeCode) => void;
  disabled?: boolean;
  error?: string;
  className?: string;
}

/** Own props + the combobox NAME, forwarded untouched (ADR-598 G11 · `FieldAccessibleName`). */
type TradeSelectorProps = TradeSelectorOwnProps & FieldAccessibleName;

export function TradeSelector({
  value,
  onChange,
  disabled,
  error,
  className,
  ...accessibleName
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
      {...accessibleName}
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
