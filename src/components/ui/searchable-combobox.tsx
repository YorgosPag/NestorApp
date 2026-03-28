'use client';

/**
 * @fileoverview SearchableCombobox — Generic searchable dropdown with keyboard navigation
 * @description Reusable combobox built on Radix Popover + Input. Supports:
 *   - Debounced client-side filtering
 *   - Keyboard navigation (ArrowUp/Down, Enter, Escape)
 *   - ARIA combobox roles
 *   - Optional free text input
 *   - Optional secondary label per option
 *   - Loading state for lazy-loaded options
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-10
 * @version 1.0.0
 * @see ADR-ACC-013 Searchable ΔΟΥ + ΚΑΔ Dropdowns
 * @compliance CLAUDE.md — Radix Popover (ADR-001), zero `any`, no inline styles, semantic HTML
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { normalizeForSearch } from '@/utils/greek-text';
import { useDropdownTokens } from '@/hooks/useDropdownTokens';
import '@/lib/design-system';
import {
  ComboboxOption,
  SearchableComboboxProps,
  DEFAULT_MAX_DISPLAYED,
  DEFAULT_DEBOUNCE_MS,
} from './searchable-combobox-types';

export type { ComboboxOption, SearchableComboboxProps } from './searchable-combobox-types';

// ============================================================================
// HELPERS
// ============================================================================

// ============================================================================
// COMPONENT
// ============================================================================

export function SearchableCombobox({
  value,
  onValueChange,
  options,
  placeholder = '',
  emptyMessage = 'No results found',
  isLoading = false,
  maxDisplayed = DEFAULT_MAX_DISPLAYED,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  allowFreeText = false,
  disabled = false,
  error,
  className,
  onAddNew,
  addNewButtonLabel = '+ Προσθήκη νέου',
}: SearchableComboboxProps) {
  const dropdown = useDropdownTokens();
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newItemInput, setNewItemInput] = useState('');
  const newInputRef = useRef<HTMLInputElement>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync input value from external value (e.g. when form resets or contact auto-fills)
  // Skip sync while popover is open — user is actively typing, don't override their input
  useEffect(() => {
    if (open) return;

    const matchingOption = options.find((o) => o.value === value);
    if (matchingOption) {
      setInputValue(matchingOption.label);
    } else if (value) {
      // Free text or value not yet in options (e.g. lazy-loading)
      setInputValue(value);
    } else {
      setInputValue('');
    }
  }, [value, options, open]);

  // Debounced filtering
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(inputValue);
    }, debounceMs);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [inputValue, debounceMs]);

  // Filtered + limited options
  const filtered = useMemo(() => {
    if (!debouncedQuery.trim()) return options.slice(0, maxDisplayed);

    const normalizedQuery = normalizeForSearch(debouncedQuery);
    const matches = options.filter((option) => {
      const normalizedLabel = normalizeForSearch(option.label);
      const normalizedSecondary = option.secondaryLabel
        ? normalizeForSearch(option.secondaryLabel)
        : '';
      const normalizedValue = normalizeForSearch(option.value);
      return (
        normalizedLabel.includes(normalizedQuery) ||
        normalizedSecondary.includes(normalizedQuery) ||
        normalizedValue.includes(normalizedQuery)
      );
    });

    return matches.slice(0, maxDisplayed);
  }, [options, debouncedQuery, maxDisplayed]);

  // Reset highlight when filtered list changes
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [filtered.length, debouncedQuery]);

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

  // Focus new item input when add-new mode is activated
  useEffect(() => {
    if (isAddingNew && newInputRef.current) {
      setTimeout(() => newInputRef.current?.focus(), 50);
    }
  }, [isAddingNew]);

  // Handle submitting a new custom item
  const handleAddNewSubmit = useCallback(() => {
    const trimmed = newItemInput.trim();
    if (!trimmed || !onAddNew) return;

    onAddNew(trimmed);
    setNewItemInput('');
    setIsAddingNew(false);
    setOpen(false);
  }, [newItemInput, onAddNew]);

  // ========================================================================
  // EVENT HANDLERS
  // ========================================================================

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setInputValue(newValue);

      if (!open) {
        setOpen(true);
      }

      // If allowFreeText, emit value immediately
      if (allowFreeText) {
        onValueChange(newValue, null);
      }
    },
    [open, allowFreeText, onValueChange],
  );

  const handleSelect = useCallback(
    (option: ComboboxOption) => {
      setInputValue(option.label);
      onValueChange(option.value, option);
      setOpen(false);
      setHighlightedIndex(-1);
    },
    [onValueChange],
  );

  const handleClear = useCallback(() => {
    setInputValue('');
    onValueChange('', null);
    setOpen(false);
    inputRef.current?.focus();
  }, [onValueChange]);

  const handleBlur = useCallback(() => {
    // Small delay to allow click on option to register
    setTimeout(() => {
      if (!allowFreeText && inputValue) {
        // If not free text, validate that the input matches an option
        const match = options.find(
          (o) => normalizeForSearch(o.label) === normalizeForSearch(inputValue),
        );
        if (match) {
          onValueChange(match.value, match);
          setInputValue(match.label);
        } else {
          // Revert to last valid value
          const currentOption = options.find((o) => o.value === value);
          setInputValue(currentOption?.label ?? value);
        }
      }
      setOpen(false);
    }, 200);
  }, [allowFreeText, inputValue, options, value, onValueChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!open) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          setOpen(true);
          setHighlightedIndex(0);
        }
        return;
      }

      if (filtered.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev < filtered.length - 1 ? prev + 1 : 0,
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev > 0 ? prev - 1 : filtered.length - 1,
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (highlightedIndex >= 0 && highlightedIndex < filtered.length) {
            const target = filtered[highlightedIndex];
            if (!target.disabled) handleSelect(target);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setOpen(false);
          setHighlightedIndex(-1);
          break;
      }
    },
    [open, filtered, highlightedIndex, handleSelect],
  );

  const handleFocus = useCallback(() => {
    if (!disabled && options.length > 0) {
      setOpen(true);
    }
  }, [disabled, options.length]);

  // ========================================================================
  // RENDER
  // ========================================================================

  return (
    <Popover open={open && !disabled} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className={cn('relative w-full', className)}>
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={placeholder}
            disabled={disabled}
            role="combobox"
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-autocomplete="list"
            aria-invalid={!!error}
            autoComplete="off"
            className={dropdown.combobox.inputPaddingRight}
          />
          {/* Loading spinner */}
          {isLoading && (
            <Spinner size="small" className="absolute right-8 top-1/2 -translate-y-1/2" />
          )}
          {/* Clear button */}
          {!isLoading && inputValue && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-8 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Clear"
              tabIndex={-1}
            >
              <X className="h-4 w-4" />
            </button>
          )}
          {/* Chevron indicator */}
          <button
            type="button"
            tabIndex={-1}
            onClick={() => { if (!disabled) setOpen(!open); }}
            className="absolute right-0 top-0 h-full px-2 flex items-center cursor-pointer"
            aria-label="Toggle dropdown"
          >
            <ChevronDown
              className={cn(
                'h-4 w-4 text-muted-foreground transition-transform',
                open && 'rotate-180',
              )}
            />
          </button>
        </div>
      </PopoverTrigger>

      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        sideOffset={dropdown.content.sideOffset}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {isLoading ? (
          <div className={`flex items-center justify-center ${dropdown.combobox.loadingState}`}>
            <Spinner />
          </div>
        ) : (
          <>
            {filtered.length === 0 && !onAddNew ? (
              <p className={`${dropdown.combobox.emptyState} text-muted-foreground text-center`}>
                {emptyMessage}
              </p>
            ) : (
              <ul ref={listRef} role="listbox" className={`${dropdown.combobox.listPadding} ${dropdown.content.maxHeightCombobox} overflow-y-auto`}>
                {filtered.length === 0 && (
                  <li className={`px-3 py-2 ${dropdown.item.fontSize} text-muted-foreground text-center`}>
                    {emptyMessage}
                  </li>
                )}
                {filtered.map((option, index) => (
                  <li
                    key={option.value}
                    role="option"
                    aria-selected={highlightedIndex === index}
                    aria-disabled={option.disabled || undefined}
                    className={cn(
                      `flex flex-col ${dropdown.item.combobox} transition-colors ${dropdown.item.fontSize}`,
                      option.disabled
                        ? 'cursor-not-allowed opacity-50'
                        : 'cursor-pointer',
                      !option.disabled && highlightedIndex === index
                        ? 'bg-accent text-accent-foreground'
                        : !option.disabled ? 'hover:bg-muted' : '',
                    )}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      if (!option.disabled) handleSelect(option);
                    }}
                    onMouseEnter={() => { if (!option.disabled) setHighlightedIndex(index); }}
                  >
                    <span className="font-medium">
                      {option.label}
                      {option.disabled && option.disabledHint && (
                        <span className={`ml-2 ${dropdown.item.fontSizeSecondary} font-normal text-muted-foreground italic`}>
                          ({option.disabledHint})
                        </span>
                      )}
                    </span>
                    {option.secondaryLabel && (
                      <span className={`${dropdown.item.fontSizeSecondary} text-muted-foreground`}>
                        {option.secondaryLabel}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {/* Add New section — shown when onAddNew prop is provided */}
            {onAddNew && (
              <div className={dropdown.combobox.addNewSection}>
                {isAddingNew ? (
                  <div className={`flex items-center ${dropdown.combobox.addNewRow}`}>
                    <Input
                      ref={newInputRef}
                      type="text"
                      value={newItemInput}
                      onChange={e => setNewItemInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          e.stopPropagation();
                          handleAddNewSubmit();
                        }
                        if (e.key === 'Escape') {
                          setIsAddingNew(false);
                          setNewItemInput('');
                        }
                      }}
                      onMouseDown={e => e.stopPropagation()}
                      placeholder={placeholder}
                      className={dropdown.combobox.addNewInput}
                    />
                    <button
                      type="button"
                      onMouseDown={e => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleAddNewSubmit();
                      }}
                      disabled={!newItemInput.trim()}
                      className={`${dropdown.combobox.addNewButton} rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50`}
                    >
                      OK
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onMouseDown={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsAddingNew(true);
                    }}
                    className={cn(
                      `flex w-full items-center ${dropdown.item.gap} rounded-sm ${dropdown.item.combobox} ${dropdown.item.fontSize} cursor-pointer`,
                      'hover:bg-accent hover:text-accent-foreground text-primary'
                    )}
                  >
                    {addNewButtonLabel}
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
