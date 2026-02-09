'use client';

/**
 * ============================================================================
 * ESCO Occupation Picker (ADR-034)
 * ============================================================================
 *
 * Autocomplete component for selecting ESCO-standardized occupations.
 *
 * Features:
 * - Debounced search (300ms, min 2 chars)
 * - Bilingual display (EL/EN with ISCO code)
 * - Free text fallback (backward compatible)
 * - Radix Popover + Input (ADR-001 compliant — no custom dropdown)
 * - Keyboard navigation (ArrowUp/Down, Enter, Escape)
 *
 * Architecture:
 * - Uses EscoService for Firestore-cached search
 * - Emits EscoPickerValue with profession text + optional ESCO metadata
 * - Integrates with config-driven form system via custom renderer
 *
 * @module components/shared/EscoOccupationPicker
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Loader2, Search, PenLine, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EscoService } from '@/services/esco.service';
import type {
  EscoOccupationPickerProps,
  EscoPickerValue,
  EscoSearchResult,
  EscoLanguage,
} from '@/types/contacts/esco-types';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Debounce delay in milliseconds */
const DEBOUNCE_MS = 300;

/** Minimum characters to trigger search */
const MIN_CHARS = 2;

/** Maximum results to display */
const MAX_RESULTS = 10;

// ============================================================================
// COMPONENT
// ============================================================================

export function EscoOccupationPicker({
  value,
  escoUri,
  iscoCode,
  onChange,
  disabled = false,
  placeholder,
  language,
}: EscoOccupationPickerProps) {
  const { t, i18n } = useTranslation('contacts');
  const resolvedLanguage: EscoLanguage = language ?? (i18n.language === 'el' ? 'el' : 'en');

  // State
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value ?? '');
  const [results, setResults] = useState<EscoSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [hasEscoSelection, setHasEscoSelection] = useState(!!escoUri);

  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Sync external value changes
  useEffect(() => {
    setInputValue(value ?? '');
    setHasEscoSelection(!!escoUri);
  }, [value, escoUri]);

  // ========================================================================
  // SEARCH LOGIC
  // ========================================================================

  const performSearch = useCallback(async (query: string) => {
    if (query.trim().length < MIN_CHARS) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const response = await EscoService.searchOccupations({
        query,
        language: resolvedLanguage,
        limit: MAX_RESULTS,
      });

      setResults(response.results);
      setHighlightedIndex(-1);
    } catch (error) {
      console.error('[EscoOccupationPicker] Search error:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [resolvedLanguage]);

  const debouncedSearch = useCallback((query: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      performSearch(query);
    }, DEBOUNCE_MS);
  }, [performSearch]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // ========================================================================
  // EVENT HANDLERS
  // ========================================================================

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setHasEscoSelection(false);

    // Emit free text change immediately
    onChange({
      profession: newValue,
      escoUri: undefined,
      escoLabel: undefined,
      iscoCode: undefined,
    });

    // Trigger debounced search
    if (newValue.trim().length >= MIN_CHARS) {
      setIsOpen(true);
      debouncedSearch(newValue);
    } else {
      setResults([]);
      setIsOpen(false);
    }
  }, [onChange, debouncedSearch]);

  const handleSelectOccupation = useCallback((result: EscoSearchResult) => {
    const label = resolvedLanguage === 'el'
      ? result.occupation.preferredLabel.el
      : result.occupation.preferredLabel.en;

    setInputValue(label);
    setHasEscoSelection(true);
    setIsOpen(false);
    setResults([]);

    onChange({
      profession: label,
      escoUri: result.occupation.uri,
      escoLabel: label,
      iscoCode: result.occupation.iscoCode,
    });
  }, [resolvedLanguage, onChange]);

  const handleUseFreeText = useCallback(() => {
    setIsOpen(false);
    setResults([]);
    setHasEscoSelection(false);

    onChange({
      profession: inputValue,
      escoUri: undefined,
      escoLabel: undefined,
      iscoCode: undefined,
    });
  }, [inputValue, onChange]);

  const handleClearSelection = useCallback(() => {
    setInputValue('');
    setHasEscoSelection(false);
    setResults([]);

    onChange({
      profession: '',
      escoUri: undefined,
      escoLabel: undefined,
      iscoCode: undefined,
    });

    inputRef.current?.focus();
  }, [onChange]);

  // ========================================================================
  // KEYBOARD NAVIGATION
  // ========================================================================

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || results.length === 0) return;

    // Total items = results + 1 (free text option)
    const totalItems = results.length + 1;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev < totalItems - 1 ? prev + 1 : 0
        );
        break;

      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev > 0 ? prev - 1 : totalItems - 1
        );
        break;

      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < results.length) {
          handleSelectOccupation(results[highlightedIndex]);
        } else if (highlightedIndex === results.length) {
          handleUseFreeText();
        }
        break;

      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setResults([]);
        break;
    }
  }, [isOpen, results, highlightedIndex, handleSelectOccupation, handleUseFreeText]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[role="option"]');
      const item = items[highlightedIndex];
      if (item) {
        item.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  // ========================================================================
  // RENDER HELPERS
  // ========================================================================

  const getDisplayLabel = (result: EscoSearchResult): string => {
    return resolvedLanguage === 'el'
      ? result.occupation.preferredLabel.el
      : result.occupation.preferredLabel.en;
  };

  const getSecondaryLabel = (result: EscoSearchResult): string => {
    return resolvedLanguage === 'el'
      ? result.occupation.preferredLabel.en
      : result.occupation.preferredLabel.el;
  };

  // ========================================================================
  // RENDER
  // ========================================================================

  return (
    <Popover open={isOpen && !disabled} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (inputValue.trim().length >= MIN_CHARS && !hasEscoSelection) {
                setIsOpen(true);
                debouncedSearch(inputValue);
              }
            }}
            disabled={disabled}
            placeholder={placeholder ?? t('individual.placeholders.profession')}
            hasLeftIcon
            hasRightIcon={!!inputValue || isLoading}
            className={cn(
              hasEscoSelection && 'pr-16'
            )}
            aria-expanded={isOpen}
            aria-haspopup="listbox"
            aria-autocomplete="list"
            role="combobox"
          />
          {/* ESCO badge when selection is active */}
          {hasEscoSelection && !disabled && (
            <span className="absolute right-10 top-1/2 -translate-y-1/2 text-xs font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
              ESCO
            </span>
          )}
          {/* Loading / Clear buttons */}
          {isLoading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
          {!isLoading && inputValue && !disabled && (
            <button
              type="button"
              onClick={handleClearSelection}
              className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={t('common.clear', 'Clear')}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </PopoverTrigger>

      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0 max-h-80 overflow-y-auto"
        align="start"
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <ul
          ref={listRef}
          role="listbox"
          aria-label={t('esco.searchResults', 'Search results')}
          className="py-1"
        >
          {/* Search results */}
          {results.map((result, index) => (
            <li
              key={result.occupation.uri}
              role="option"
              aria-selected={highlightedIndex === index}
              className={cn(
                'flex flex-col px-3 py-2 cursor-pointer transition-colors',
                highlightedIndex === index
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-muted'
              )}
              onClick={() => handleSelectOccupation(result)}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              <span className="text-sm font-medium">
                {getDisplayLabel(result)}
                <span className="ml-2 text-xs text-muted-foreground font-mono">
                  ({result.occupation.iscoCode})
                </span>
              </span>
              <span className="text-xs text-muted-foreground">
                {getSecondaryLabel(result)}
              </span>
            </li>
          ))}

          {/* No results message */}
          {!isLoading && results.length === 0 && inputValue.trim().length >= MIN_CHARS && (
            <li className="px-3 py-2 text-sm text-muted-foreground text-center">
              {t('esco.noResults', 'No occupations found')}
            </li>
          )}

          {/* Separator */}
          {results.length > 0 && (
            <li role="separator" className="border-t border-border my-1" />
          )}

          {/* Free text fallback option */}
          {inputValue.trim().length >= MIN_CHARS && (
            <li
              role="option"
              aria-selected={highlightedIndex === results.length}
              className={cn(
                'flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors',
                highlightedIndex === results.length
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-muted'
              )}
              onClick={handleUseFreeText}
              onMouseEnter={() => setHighlightedIndex(results.length)}
            >
              <PenLine className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm">
                {t('esco.useFreeText', 'Use as free text')}: &quot;{inputValue}&quot;
              </span>
            </li>
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

export default EscoOccupationPicker;
