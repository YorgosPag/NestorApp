'use client';

import React, { useState, useEffect, useRef } from 'react';
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

/** Date range value */
interface DateRangeValue {
  start?: Date;
  end?: Date;
  from?: Date;
  to?: Date;
}

/** Possible filter field values */
export type FilterFieldValue = string | string[] | boolean | number | RangeValue | DateRangeValue | undefined;

interface FilterFieldProps {
  config: FilterFieldConfig;
  value: FilterFieldValue;
  onValueChange: (value: FilterFieldValue) => void;
  onRangeChange?: (subKey: 'min' | 'max', value: string) => void;
  /** 🏢 ENTERPRISE: i18n namespace for translations (passed from parent config) */
  i18nNamespace?: string;
}

export function FilterField({ config, value, onValueChange, onRangeChange, i18nNamespace = 'building' }: FilterFieldProps) {
  // 🏢 ENTERPRISE: i18n hook with configurable namespace
  const { t } = useTranslation(i18nNamespace);
  const iconSizes = useIconSizes();
  const spacing = useSpacingTokens();

  // 🏢 ENTERPRISE: Helper to translate option labels
  // Supports both translation keys (e.g., 'units.operationalStatus.ready') and direct values
  // 🎯 PR1.2: Auto-detect namespace from key prefix (e.g., 'units.x.y' → ns:'units', key:'x.y')
  const translateLabel = (label: string | undefined): string => {
    // 🛡️ ENTERPRISE: Guard against undefined/null labels
    if (!label) return '';
    // If it's a translation key (contains a dot), translate it
    if (label.includes('.')) {
      // Check if key has namespace prefix (e.g., 'units.operationalStatus.ready')
      const parts = label.split('.');
      const knownNamespaces = ['units', 'common', 'navigation', 'properties', 'building', 'filters', 'parking', 'storage'];
      if (parts.length >= 2 && knownNamespaces.includes(parts[0])) {
        const namespace = parts[0];
        const key = parts.slice(1).join('.');
        return t(key, { ns: namespace });
      }
      // Default: use current namespace (building)
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
      case 'search': {
        const searchValue = (typeof value === 'string' || typeof value === 'number') ? value : '';
        const placeholderText = typeof config.placeholder === 'string' ? config.placeholder : '';
        return (
          <div className="relative w-full">
            <Search className={`absolute left-2.5 top-2.5 ${iconSizes.sm} text-muted-foreground`} />
            <Input
              id={config.id}
              aria-label={config.ariaLabel}
              placeholder={translateLabel(placeholderText)}
              className="pl-9 h-9"
              value={searchValue || ''}
              onChange={(e) => onValueChange(e.target.value)}
            />
          </div>
        );
      }

      case 'range': {
        const rangeValue = value as RangeValue | undefined;

        // 🏢 ENTERPRISE: Dropdown mode με predefined area values + custom input
        if (config.dropdownMode && config.id === 'areaRange') {
          const areaPresets = [
            { id: 'all', label: 'filters.areaPresets.all', min: null, max: null },
            { id: 'small', label: 'filters.areaPresets.small', min: 0, max: 50 },
            { id: 'medium', label: 'filters.areaPresets.medium', min: 50, max: 100 },
            { id: 'large', label: 'filters.areaPresets.large', min: 100, max: 200 },
            { id: 'veryLarge', label: 'filters.areaPresets.veryLarge', min: 200, max: null },
            { id: 'custom', label: 'filters.areaPresets.custom', min: null, max: null },
          ];

          // 🔧 ENTERPRISE: Determine current preset based on range value
          const getCurrentPreset = () => {
            if (!rangeValue || (rangeValue.min === undefined && rangeValue.max === undefined)) {
              return 'all';
            }

            // Check if current values match any preset exactly
            const preset = areaPresets.find(p => {
              // For 'all' preset, both min and max should be null/undefined
              if (p.id === 'all') {
                return (rangeValue.min === null || rangeValue.min === undefined) &&
                       (rangeValue.max === null || rangeValue.max === undefined);
              }
              // For other presets, compare exact values
              return p.min === rangeValue.min && p.max === rangeValue.max;
            });

            return preset ? preset.id : 'custom';
          };

          // 🔧 ENTERPRISE: Local state για dropdown value tracking
          const [selectedPreset, setSelectedPreset] = useState(getCurrentPreset());

          // 🏢 ENTERPRISE: Controlled input state με null safety
          const [minValue, setMinValue] = useState(() => {
            const min = rangeValue?.min;
            return (min !== null && min !== undefined) ? min.toString() : '';
          });
          const [maxValue, setMaxValue] = useState(() => {
            const max = rangeValue?.max;
            return (max !== null && max !== undefined) ? max.toString() : '';
          });

          // 🔧 FIX: Refs για focus management (not needed for uncontrolled anymore)
          const minInputRef = useRef<HTMLInputElement>(null);
          const maxInputRef = useRef<HTMLInputElement>(null);

          // 🏢 ENTERPRISE: Intelligent state synchronization pattern
          // ONLY syncs on external clear events, NOT during user typing
          useEffect(() => {
            const isClearEvent = !rangeValue ||
              (typeof rangeValue === 'object' && Object.keys(rangeValue).length === 0) ||
              (rangeValue.min === undefined && rangeValue.max === undefined);

            console.log('🔍 ENTERPRISE DEBUG:', {
              rangeValue,
              rangeValueType: typeof rangeValue,
              rangeValueKeys: rangeValue ? Object.keys(rangeValue) : 'null',
              hasMin: rangeValue?.min !== undefined,
              hasMax: rangeValue?.max !== undefined,
              minValue: rangeValue?.min,
              maxValue: rangeValue?.max,
              isClearEvent,
              selectedPreset,
              trigger: 'useEffect'
            });

            if (isClearEvent) {
              console.log('🔄 CLEAR EVENT DETECTED - Resetting to "all"');
              setSelectedPreset('all');
              // 🏢 ENTERPRISE: Reset controlled input state on clear
              setMinValue('');
              setMaxValue('');
            }
            // IMPORTANT: Do NOT sync during user typing (preserves custom mode)
          }, [rangeValue]);

          // 🏢 ENTERPRISE: Sync controlled state με external range changes (null safe)
          useEffect(() => {
            const min = rangeValue?.min;
            const max = rangeValue?.max;

            if (min !== null && min !== undefined) {
              const minStr = min.toString();
              if (minStr !== minValue) {
                setMinValue(minStr);
              }
            }

            if (max !== null && max !== undefined) {
              const maxStr = max.toString();
              if (maxStr !== maxValue) {
                setMaxValue(maxStr);
              }
            }
          }, [rangeValue?.min, rangeValue?.max, minValue, maxValue]);

          const isCustom = selectedPreset === 'custom' ||
                          (rangeValue && (rangeValue.min !== undefined || rangeValue.max !== undefined) &&
                           !areaPresets.some(p => p.min === rangeValue.min && p.max === rangeValue.max));

          return (
            <div className={`flex flex-col ${spacing.gap.sm}`}>
              <Select
                onValueChange={(selectedValue) => {
                  // Update local state first
                  setSelectedPreset(selectedValue);

                  const preset = areaPresets.find(p => p.id === selectedValue);

                  if (preset && selectedValue !== 'custom') {
                    // Set predefined range
                    onValueChange({ min: preset.min, max: preset.max });
                  } else if (selectedValue === 'custom') {
                    // Switch to custom mode - DON'T send undefined values that break filtering
                    // Just update the dropdown state, let user type values
                    // This avoids sending {min: undefined, max: undefined} which breaks filtering
                    console.log('🔄 SWITCHING TO CUSTOM MODE - not sending undefined values');
                  }
                }}
                value={selectedPreset}
              >
                <SelectTrigger className="h-9 w-full" aria-label={config.ariaLabel}>
                  <SelectValue placeholder={t('filters.areaPresets.all', { ns: 'units' })} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('filters.areaPresets.all', { ns: 'units' })}</SelectItem>
                  <SelectItem value="small">{t('filters.areaPresets.small', { ns: 'units' })}</SelectItem>
                  <SelectItem value="medium">{t('filters.areaPresets.medium', { ns: 'units' })}</SelectItem>
                  <SelectItem value="large">{t('filters.areaPresets.large', { ns: 'units' })}</SelectItem>
                  <SelectItem value="veryLarge">{t('filters.areaPresets.veryLarge', { ns: 'units' })}</SelectItem>
                  <SelectItem value="custom">{t('filters.areaPresets.custom', { ns: 'units' })}</SelectItem>
                </SelectContent>
              </Select>

              {/* 🔧 FIX #1: Custom input fields - shown when custom is detected */}
              {isCustom && (
                <div className={`flex ${spacing.gap.sm}`}>
                  <Input
                    ref={minInputRef}
                    type="number"
                    aria-label={`${t('filters.minimum')} ${translateLabel(config.label)?.toLowerCase()}`}
                    placeholder={t('filters.from')}
                    className="h-9 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    value={minValue}
                    onChange={(e) => {
                      const value = e.target.value;
                      console.log('🔢 CONTROLLED MIN INPUT:', {
                        value,
                        currentPreset: selectedPreset
                      });

                      // 🏢 ENTERPRISE: Update controlled state immediately (no remount)
                      setMinValue(value);

                      // 🚀 REALTIME FILTERING: Update on every keystroke
                      onRangeChange?.('min', value);

                      // Update selected preset to custom when user types
                      setSelectedPreset('custom');
                    }}
                    min={config.min}
                    max={config.max}
                  />
                  <Input
                    ref={maxInputRef}
                    type="number"
                    aria-label={`${t('filters.maximum')} ${translateLabel(config.label)?.toLowerCase()}`}
                    placeholder={t('filters.to')}
                    className="h-9 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    value={maxValue}
                    onChange={(e) => {
                      const value = e.target.value;
                      console.log('🔢 CONTROLLED MAX INPUT:', {
                        value,
                        currentPreset: selectedPreset
                      });

                      // 🏢 ENTERPRISE: Update controlled state immediately (no remount)
                      setMaxValue(value);

                      // 🚀 REALTIME FILTERING: Update on every keystroke
                      onRangeChange?.('max', value);

                      // Update selected preset to custom when user types
                      setSelectedPreset('custom');
                    }}
                    min={config.min}
                    max={config.max}
                  />
                </div>
              )}
            </div>
          );
        }

        // 🏢 ENTERPRISE: Standard range mode (Input fields)
        return (
          <div className={`flex ${spacing.gap.sm}`}>
            <Input
              type="number"
              aria-label={`${t('filters.minimum')} ${config.label?.toLowerCase()}`}
              placeholder={t('filters.from')}
              className="h-9"
              value={rangeValue?.min ?? ''}
              onChange={(e) => onRangeChange?.('min', e.target.value)}
              min={config.min}
              max={config.max}
            />
            <Input
              type="number"
              aria-label={`${t('filters.maximum')} ${config.label?.toLowerCase()}`}
              placeholder={t('filters.to')}
              className="h-9"
              value={rangeValue?.max ?? ''}
              onChange={(e) => onRangeChange?.('max', e.target.value)}
              min={config.min}
              max={config.max}
            />
          </div>
        );
      }

      case 'select': {
        const selectValue = Array.isArray(value) && value.length === 1 ? value[0] : (Array.isArray(value) ? 'all' : (typeof value === 'string' ? value : 'all'));
        const placeholderText = typeof config.placeholder === 'string' ? config.placeholder : '';
        return (
          <Select
            onValueChange={(newValue) => onValueChange(newValue)}
            value={selectValue}
          >
            <SelectTrigger className="h-9 w-full" aria-label={config.ariaLabel}>
              <SelectValue placeholder={translateLabel(placeholderText)} />
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
      }

      case 'multiselect': {
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
                  : translateLabel(typeof config.placeholder === 'string' ? config.placeholder : '')
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
      }

      case 'checkbox': {
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
      }

      default: {
        const defaultValue = (typeof value === 'string' || typeof value === 'number') ? value : '';
        const placeholderText = typeof config.placeholder === 'string' ? config.placeholder : '';
        return (
          <Input
            id={config.id}
            aria-label={config.ariaLabel}
            placeholder={translateLabel(placeholderText)}
            className="h-9"
            value={defaultValue || ''}
            onChange={(e) => onValueChange(e.target.value)}
          />
        );
      }
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