'use client';

import React from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";
import type { FilterFieldConfig } from './types';
import { useIconSizes } from '@/hooks/useIconSizes';

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
  const iconSizes = useIconSizes();
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
              placeholder={config.placeholder}
              className="pl-9 h-9"
              value={value || ''}
              onChange={(e) => onValueChange(e.target.value)}
            />
          </div>
        );

      case 'range':
        return (
          <div className="flex gap-2">
            <Input
              type="number"
              aria-label={`Ελάχιστη ${config.label?.toLowerCase()}`}
              placeholder="Από"
              className="h-9"
              value={value?.min ?? ''}
              onChange={(e) => onRangeChange?.('min', e.target.value)}
              min={config.min}
              max={config.max}
            />
            <Input
              type="number"
              aria-label={`Μέγιστη ${config.label?.toLowerCase()}`}
              placeholder="Έως"
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
              <SelectValue placeholder={config.placeholder} />
            </SelectTrigger>
            <SelectContent>
              {config.options?.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
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
                  ? `${value.length} επιλεγμένα`
                  : config.placeholder
              } />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Όλα</SelectItem>
              {config.options?.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label} {Array.isArray(value) && value.includes(option.value) ? '✓' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'checkbox':
        return (
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id={config.id}
              checked={value || false}
              onChange={(e) => onValueChange(e.target.checked)}
              aria-label={config.ariaLabel}
              className="rounded border border-input"
            />
            <Label htmlFor={config.id} className="text-sm font-normal">
              {config.label}
            </Label>
          </div>
        );

      default:
        return (
          <Input
            id={config.id}
            aria-label={config.ariaLabel}
            placeholder={config.placeholder}
            className="h-9"
            value={value || ''}
            onChange={(e) => onValueChange(e.target.value)}
          />
        );
    }
  };

  return (
    <div className={`flex items-center gap-2 ${getColumnSpan(config.width)}`}>
      <Label htmlFor={config.id} className="text-xs font-medium shrink-0">
        {config.label}
      </Label>
      {renderField()}
    </div>
  );
}