'use client';

import React from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";
import type { FilterFieldConfig } from './types';
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

/** Range value for filter fields */
interface RangeValue {
  min?: number;
  max?: number;
}

/** Possible filter field values */
type FilterFieldValue = string | string[] | boolean | number | RangeValue | undefined;

interface FilterFieldProps {
  config: FilterFieldConfig;
  value: FilterFieldValue;
  onValueChange: (value: FilterFieldValue) => void;
  onRangeChange?: (subKey: 'min' | 'max', value: string) => void;
}

export function FilterField({ config, value, onValueChange, onRangeChange }: FilterFieldProps) {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('building');
  const iconSizes = useIconSizes();
  const spacing = useSpacingTokens();

  // 🏢 ENTERPRISE: Helper to translate option labels
  // Supports both translation keys (e.g., 'filters.allStatuses') and direct values
  const translateLabel = (label: string): string => {
    // If it's a translation key (contains a dot), translate it
    if (label.includes('.')) {
      return t(label);
    }
    // Otherwise return as-is (for dynamic values like city names from env)
    return label;
  };
  const getColumnSpan = (width?: number) => {
    switch (width) {
      case 1: return 'col-span-1';
      case 2: return 'col-span-2';
      case 3: return 'col-span-3';
      case 4: return 'col-span-4';
      default: return 'col-span-1';
    }
  };

  const renderField = () => {
    switch (config.type) {
      case 'search':
        return (
          <div className="relative w-full">
            <Search className={`absolute left-2.5 top-2.5 ${iconSizes.sm} text-muted-foreground`} />
            <Input
              id={config.id}
              aria-label={config.ariaLabel}
              placeholder={translateLabel(config.placeholder || '')}
              className="pl-9 h-9"
              value={value || ''}
              onChange={(e) => onValueChange(e.target.value)}
            />
          </div>
        );

      case 'range':
        return (
          <div className={`flex ${spacing.gap.sm}`}>
            <Input
              type="number"
              aria-label={`${t('filters.minimum')} ${config.label?.toLowerCase()}`}
              placeholder={t('filters.from')}
              className="h-9"
              value={value?.min ?? ''}
              onChange={(e) => onRangeChange?.('min', e.target.value)}
              min={config.min}
              max={config.max}
            />
            <Input
              type="number"
              aria-label={`${t('filters.maximum')} ${config.label?.toLowerCase()}`}
              placeholder={t('filters.to')}
              className="h-9"
              value={value?.max ?? ''}
              onChange={(e) => onRangeChange?.('max', e.target.value)}
              min={config.min}
              max={config.max}
            />
          </div>
        );

      case 'select':
        return (
          <Select
            onValueChange={(newValue) => onValueChange(newValue)}
            value={Array.isArray(value) && value.length === 1 ? value[0] : (Array.isArray(value) ? 'all' : value || 'all')}
          >
            <SelectTrigger className="h-9 w-full" aria-label={config.ariaLabel}>
              <SelectValue placeholder={translateLabel(config.placeholder || '')} />
            </SelectTrigger>
            <SelectContent>
              {config.options?.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {translateLabel(option.label)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'multiselect':
        // For multiselect, we'll use a simple select for now but could expand to a more complex component
        return (
          <Select
            onValueChange={(newValue) => {
              const currentValues = Array.isArray(value) ? value : [];
              if (newValue === 'all') {
                onValueChange([]);
              } else {
                const newValues = currentValues.includes(newValue)
                  ? currentValues.filter(v => v !== newValue)
                  : [...currentValues, newValue];
                onValueChange(newValues);
              }
            }}
            value="placeholder"
          >
            <SelectTrigger className="h-9 w-full" aria-label={config.ariaLabel}>
              <SelectValue placeholder={
                Array.isArray(value) && value.length > 0
                  ? t('filters.selectedCount', { count: value.length })
                  : translateLabel(config.placeholder || '')
              } />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('filters.all')}</SelectItem>
              {config.options?.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {translateLabel(option.label)} {Array.isArray(value) && value.includes(option.value) ? '✓' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'checkbox':
        // 🏢 ENTERPRISE: Using centralized Checkbox component (Radix UI)
        return (
          <div className={`flex items-center ${spacing.gap.sm}`}>
            <Checkbox
              id={config.id}
              checked={Boolean(value)}
              onCheckedChange={(checked) => onValueChange(checked === true)}
              aria-label={config.ariaLabel}
            />
            <Label
              htmlFor={config.id}
              className="text-sm font-normal cursor-pointer"
            >
              {translateLabel(config.label || '')}
            </Label>
          </div>
        );

      default:
        return (
          <Input
            id={config.id}
            aria-label={config.ariaLabel}
            placeholder={translateLabel(config.placeholder || '')}
            className="h-9"
            value={value || ''}
            onChange={(e) => onValueChange(e.target.value)}
          />
        );
    }
  };

  // 🏢 ENTERPRISE: Checkboxes have their own internal label, so we skip the external label
  const isCheckbox = config.type === 'checkbox';

  return (
    <div className={`flex items-center ${spacing.gap.sm} ${getColumnSpan(config.width)}`}>
      {!isCheckbox && (
        <Label htmlFor={config.id} className="text-xs font-medium shrink-0">
          {translateLabel(config.label || '')}
        </Label>
      )}
      {renderField()}
    </div>
  );
}