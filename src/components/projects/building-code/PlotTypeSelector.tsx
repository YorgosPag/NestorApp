/**
 * @related ADR-186 §8 Q4 — Plot type dropdown (5 + custom)
 */
'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { PlotType } from '@/services/building-code/types/site.types';

interface PlotTypeSelectorProps {
  value: PlotType;
  onChange(value: PlotType): void;
  disabled?: boolean;
}

const PLOT_TYPE_OPTIONS: ReadonlyArray<{ value: PlotType; i18nKey: string }> = [
  { value: 'mesaio', i18nKey: 'plotType.options.mesaio' },
  { value: 'goniako', i18nKey: 'plotType.options.goniako' },
  { value: 'disgoniaio', i18nKey: 'plotType.options.disgoniaio' },
  { value: 'four_sided', i18nKey: 'plotType.options.fourSided' },
  { value: 'diamperes', i18nKey: 'plotType.options.diamperes' },
  { value: 'custom', i18nKey: 'plotType.options.custom' },
];

export function PlotTypeSelector({
  value,
  onChange,
  disabled = false,
}: PlotTypeSelectorProps) {
  const { t } = useTranslation('buildingCode');

  return (
    <Select
      value={value}
      onValueChange={(next) => onChange(next as PlotType)}
      disabled={disabled}
    >
      <SelectTrigger aria-label={t('plotType.label')}>
        <SelectValue placeholder={t('plotType.placeholder')} />
      </SelectTrigger>
      <SelectContent>
        {PLOT_TYPE_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {t(opt.i18nKey)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
