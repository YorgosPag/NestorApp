/**
 * SEARCH SYSTEM — Input & Filter Components
 *
 * SearchInput with suggestions and keyboard navigation.
 * Filter component supporting select, multiselect, range, date, boolean, text.
 * Extracted from SearchSystem (ADR-065).
 *
 * @module ui/design-system/search/search-system-inputs
 * @see SearchSystem.tsx
 */

import React, { useState, useRef } from 'react';
import { Search, Clock } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTheme } from '../theme/ThemeProvider';
import {
  searchSystemClasses,
  getSearchInputClassName,
  getSuggestionItemClassName,
} from './SearchSystem.styles';
import { cn } from '@/lib/utils';
import { SELECT_CLEAR_VALUE, isSelectClearValue } from '@/config/domain-constants';
import type { FilterConfig, FilterValue } from './search-engine';

// ============================================================================
// SEARCH INPUT COMPONENT
// ============================================================================

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  placeholder?: string;
  suggestions?: string[];
  showSuggestions?: boolean;
  loading?: boolean;
  className?: string;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  onFocus,
  onBlur,
  placeholder = 'Search...',
  suggestions = [],
  showSuggestions = true,
  loading = false,
  className = ''
}) => {
  const iconSizes = useIconSizes();
  const [focused, setFocused] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFocus = () => {
    setFocused(true);
    onFocus?.();
  };

  const handleBlur = () => {
    setTimeout(() => {
      setFocused(false);
      setSelectedSuggestion(-1);
      onBlur?.();
    }, 200);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setSelectedSuggestion(prev =>
          prev < suggestions.length - 1 ? prev + 1 : -1
        );
        break;
      case 'ArrowUp':
        event.preventDefault();
        setSelectedSuggestion(prev =>
          prev > -1 ? prev - 1 : suggestions.length - 1
        );
        break;
      case 'Enter':
        event.preventDefault();
        if (selectedSuggestion >= 0) {
          onChange(suggestions[selectedSuggestion]);
          setSelectedSuggestion(-1);
          inputRef.current?.blur();
        }
        break;
      case 'Escape':
        setSelectedSuggestion(-1);
        inputRef.current?.blur();
        break;
    }
  };

  return (
    <div className={cn(searchSystemClasses.searchInput.container, 'search-input', className)}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={getSearchInputClassName(focused)}
      />

      <div className={searchSystemClasses.searchInput.icon}>
        {loading ? <Clock className={iconSizes.sm} /> : <Search className={iconSizes.sm} />}
      </div>

      {focused && showSuggestions && suggestions.length > 0 && (
        <div className={searchSystemClasses.searchInput.suggestionsContainer}>
          {suggestions.map((suggestion, index) => (
            <div
              key={index}
              onClick={() => {
                onChange(suggestion);
                setSelectedSuggestion(-1);
                inputRef.current?.blur();
              }}
              className={getSuggestionItemClassName(selectedSuggestion === index)}
              onMouseEnter={() => setSelectedSuggestion(index)}
            >
              {suggestion}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// FILTER COMPONENT
// ============================================================================

interface FilterProps {
  config: FilterConfig;
  value: FilterValue;
  onChange: (value: FilterValue) => void;
  className?: string;
}

export const Filter: React.FC<FilterProps> = ({
  config,
  value,
  onChange,
  className = ''
}) => {
  const renderFilter = () => {
    switch (config.type) {
      case 'select': {
        const selectVal = typeof value === 'string' ? value : '';
        return (
          <Select
            value={selectVal}
            onValueChange={(val) => onChange(isSelectClearValue(val) ? null : val)}
          >
            <SelectTrigger className={searchSystemClasses.filter.select}>
              <SelectValue placeholder={`All ${config.label}`} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SELECT_CLEAR_VALUE}>All {config.label}</SelectItem>
              {config.options?.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label} {option.count && `(${option.count})`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      }

      case 'multiselect':
        return (
          <div className={searchSystemClasses.filter.container}>
            {config.options?.map(option => (
              <label key={option.value} className={searchSystemClasses.filter.multiselectLabel}>
                <input
                  type="checkbox"
                  className={searchSystemClasses.filter.checkbox}
                  checked={Array.isArray(value) ? value.includes(option.value) : false}
                  onChange={(e) => {
                    const currentValue = Array.isArray(value) ? value : [];
                    if (e.target.checked) {
                      onChange([...currentValue, option.value]);
                    } else {
                      onChange(currentValue.filter(v => v !== option.value));
                    }
                  }}
                />
                {option.label} {option.count && `(${option.count})`}
              </label>
            ))}
          </div>
        );

      case 'range': {
        const rangeVal = (value !== null && typeof value === 'object' && 'min' in value && 'max' in value)
          ? value as { min: number; max: number }
          : { min: config.min || 0, max: config.max || 100 };
        return (
          <div className={searchSystemClasses.filter.rangeContainer}>
            <input
              type="number"
              min={config.min} max={config.max} step={config.step}
              value={rangeVal.min}
              onChange={(e) => onChange({ min: Number(e.target.value), max: rangeVal.max })}
              className={searchSystemClasses.filter.rangeInput}
            />
            <span className={searchSystemClasses.filter.rangeLabel}>to</span>
            <input
              type="number"
              min={config.min} max={config.max} step={config.step}
              value={rangeVal.max}
              onChange={(e) => onChange({ min: rangeVal.min, max: Number(e.target.value) })}
              className={searchSystemClasses.filter.rangeInput}
            />
          </div>
        );
      }

      case 'date': {
        const dateVal = typeof value === 'string' ? value : '';
        return (
          <input
            type="date"
            value={dateVal}
            onChange={(e) => onChange(e.target.value || null)}
            className={searchSystemClasses.filter.input}
          />
        );
      }

      case 'boolean':
        return (
          <label className={searchSystemClasses.filter.label}>
            <input
              type="checkbox"
              className={searchSystemClasses.filter.checkbox}
              checked={Boolean(value)}
              onChange={(e) => onChange(e.target.checked)}
            />
            {config.label}
          </label>
        );

      case 'text': {
        const textVal = typeof value === 'string' ? value : '';
        return (
          <input
            type="text"
            value={textVal}
            onChange={(e) => onChange(e.target.value || null)}
            placeholder={config.placeholder}
            className={searchSystemClasses.filter.input}
          />
        );
      }

      default:
        return null;
    }
  };

  return (
    <div className={cn(searchSystemClasses.filter.container, 'filter', className)}>
      {config.type !== 'boolean' && (
        <label className={searchSystemClasses.filter.label}>
          {config.label}
        </label>
      )}
      {renderFilter()}
    </div>
  );
};
