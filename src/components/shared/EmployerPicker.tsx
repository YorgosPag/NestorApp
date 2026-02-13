'use client';

/**
 * ============================================================================
 * Employer Picker — Entity-Linked Autocomplete (ADR-177)
 * ============================================================================
 *
 * Autocomplete component for selecting an employer from existing Company contacts.
 *
 * Features:
 * - Debounced search (300ms, min 2 chars)
 * - Searches Company contacts: companyName, tradeName, vatNumber
 * - LINKED badge when a Company contact is selected
 * - Free text fallback (backward compatible)
 * - Radix Popover + Input (ADR-001 compliant — no custom dropdown)
 * - Keyboard navigation (ArrowUp/Down, Enter, Escape)
 *
 * Architecture:
 * - Uses ContactsService.getAllContacts({ type: 'company' }) + client-side filtering
 * - Emits EmployerPickerValue with employer text + optional employerId
 * - Integrates with config-driven form system via custom renderer
 *
 * @module components/shared/EmployerPicker
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createModuleLogger } from '@/lib/telemetry';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Building2, Loader2, PenLine, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ContactsService } from '@/services/contacts.service';
import type { CompanyContact } from '@/types/contacts';

// ============================================================================
// TYPES
// ============================================================================

/** Value emitted by EmployerPicker */
export interface EmployerPickerValue {
  /** Human-readable employer text (always set) */
  employer: string;
  /** Linked Company contact ID (set only when user selects from autocomplete) */
  employerId?: string;
}

/** Props for EmployerPicker */
interface EmployerPickerProps {
  /** Current employer text value */
  value: string;
  /** Linked Company contact ID (undefined = free text) */
  employerId?: string;
  /** Callback when value changes */
  onChange: (value: EmployerPickerValue) => void;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** Custom placeholder text */
  placeholder?: string;
}

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
// MODULE LOGGER
// ============================================================================

const logger = createModuleLogger('EmployerPicker');

// ============================================================================
// SEARCH RESULT TYPE (internal)
// ============================================================================

interface CompanySearchResult {
  id: string;
  companyName: string;
  tradeName?: string;
  vatNumber?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function EmployerPicker({
  value,
  employerId,
  onChange,
  disabled = false,
  placeholder,
}: EmployerPickerProps) {
  const { t } = useTranslation('contacts');

  // State
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value ?? '');
  const [results, setResults] = useState<CompanySearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [hasLinkedSelection, setHasLinkedSelection] = useState(!!employerId);

  // Cache: all company contacts (fetched once, filtered client-side)
  const companyCacheRef = useRef<CompanySearchResult[] | null>(null);
  const fetchingRef = useRef(false);

  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Sync external value changes
  useEffect(() => {
    setInputValue(value ?? '');
    setHasLinkedSelection(!!employerId);
  }, [value, employerId]);

  // ========================================================================
  // COMPANY CONTACTS CACHE
  // ========================================================================

  const fetchCompanyContacts = useCallback(async (): Promise<CompanySearchResult[]> => {
    if (companyCacheRef.current) return companyCacheRef.current;
    if (fetchingRef.current) return [];

    fetchingRef.current = true;
    try {
      const { contacts } = await ContactsService.getAllContacts({
        type: 'company',
        limitCount: 500,
      });

      const mapped: CompanySearchResult[] = contacts
        .filter((c): c is CompanyContact => c.type === 'company')
        .map((c) => ({
          id: c.id ?? '',
          companyName: c.companyName ?? '',
          tradeName: c.tradeName,
          vatNumber: c.vatNumber,
        }))
        .filter((c) => c.id && c.companyName);

      companyCacheRef.current = mapped;
      logger.info('Company contacts cached', { count: mapped.length });
      return mapped;
    } catch (error) {
      logger.error('Failed to fetch company contacts', { error });
      return [];
    } finally {
      fetchingRef.current = false;
    }
  }, []);

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
      const companies = await fetchCompanyContacts();
      const term = query.toLowerCase().trim();

      const filtered = companies
        .filter((c) => {
          const nameMatch = c.companyName.toLowerCase().includes(term);
          const tradeMatch = c.tradeName?.toLowerCase().includes(term) ?? false;
          const vatMatch = c.vatNumber?.includes(term) ?? false;
          return nameMatch || tradeMatch || vatMatch;
        })
        .slice(0, MAX_RESULTS);

      setResults(filtered);
      setHighlightedIndex(-1);
    } catch (error) {
      logger.error('Search error', { error });
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [fetchCompanyContacts]);

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
    setHasLinkedSelection(false);

    // Emit free text change immediately
    onChange({
      employer: newValue,
      employerId: undefined,
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

  const handleSelectCompany = useCallback((result: CompanySearchResult) => {
    setInputValue(result.companyName);
    setHasLinkedSelection(true);
    setIsOpen(false);
    setResults([]);

    onChange({
      employer: result.companyName,
      employerId: result.id,
    });
  }, [onChange]);

  const handleUseFreeText = useCallback(() => {
    setIsOpen(false);
    setResults([]);
    setHasLinkedSelection(false);

    onChange({
      employer: inputValue,
      employerId: undefined,
    });
  }, [inputValue, onChange]);

  const handleClearSelection = useCallback(() => {
    setInputValue('');
    setHasLinkedSelection(false);
    setResults([]);

    onChange({
      employer: '',
      employerId: undefined,
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
          handleSelectCompany(results[highlightedIndex]);
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
  }, [isOpen, results, highlightedIndex, handleSelectCompany, handleUseFreeText]);

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
  // RENDER
  // ========================================================================

  return (
    <Popover open={isOpen && !disabled} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <div className="relative w-full">
          <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (inputValue.trim().length >= MIN_CHARS && !hasLinkedSelection) {
                setIsOpen(true);
                debouncedSearch(inputValue);
              }
            }}
            disabled={disabled}
            placeholder={placeholder ?? t('individual.placeholders.employer', 'Αναζήτηση εταιρείας...')}
            hasLeftIcon
            hasRightIcon={!!inputValue || isLoading}
            className={cn(
              hasLinkedSelection && 'pr-20'
            )}
            aria-expanded={isOpen}
            aria-haspopup="listbox"
            aria-autocomplete="list"
            role="combobox"
          />
          {/* LINKED badge when a company is selected */}
          {hasLinkedSelection && !disabled && (
            <span className="absolute right-10 top-1/2 -translate-y-1/2 text-xs font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
              LINKED
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
          aria-label={t('employer.searchResults', 'Search results')}
          className="py-1"
        >
          {/* Search results */}
          {results.map((result, index) => (
            <li
              key={result.id}
              role="option"
              aria-selected={highlightedIndex === index}
              className={cn(
                'flex flex-col px-3 py-2 cursor-pointer transition-colors',
                highlightedIndex === index
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-muted'
              )}
              onClick={() => handleSelectCompany(result)}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              <span className="text-sm font-medium">
                {result.companyName}
                {result.tradeName && result.tradeName !== result.companyName && (
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    ({result.tradeName})
                  </span>
                )}
              </span>
              {result.vatNumber && (
                <span className="text-xs text-muted-foreground">
                  {t('employer.vat', 'ΑΦΜ')}: {result.vatNumber}
                </span>
              )}
            </li>
          ))}

          {/* No results message */}
          {!isLoading && results.length === 0 && inputValue.trim().length >= MIN_CHARS && (
            <li className="px-3 py-2 text-sm text-muted-foreground text-center">
              {t('employer.noResults', 'Δεν βρέθηκαν εταιρείες')}
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
                {t('employer.useFreeText', 'Χρήση ελεύθερου κειμένου')}: &quot;{inputValue}&quot;
              </span>
            </li>
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

export default EmployerPicker;
