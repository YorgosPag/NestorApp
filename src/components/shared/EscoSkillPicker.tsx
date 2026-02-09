'use client';

/**
 * ============================================================================
 * ESCO Skill Picker (ADR-132)
 * ============================================================================
 *
 * Multi-select autocomplete component for selecting ESCO-standardized skills.
 *
 * Features:
 * - Multi-select with chips/tags for selected skills
 * - Debounced search (300ms, min 2 chars)
 * - Bilingual display (EL/EN)
 * - Free text fallback (custom skills without ESCO URI)
 * - Radix Popover + Input (ADR-001 compliant)
 * - Keyboard navigation (ArrowUp/Down, Enter, Escape)
 * - Configurable max skills limit (default: 20)
 *
 * Architecture:
 * - Uses EscoService.searchSkills() for Firestore-cached search
 * - Emits EscoSkillValue[] array
 * - Integrates with config-driven form system via custom renderer
 *
 * @module components/shared/EscoSkillPicker
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Loader2, Search, PenLine, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EscoService } from '@/services/esco.service';
import type {
  EscoSkillPickerProps,
  EscoSkillValue,
  EscoSkillSearchResult,
  EscoLanguage,
} from '@/types/contacts/esco-types';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Debounce delay in milliseconds */
const DEBOUNCE_MS = 300;

/** Minimum characters to trigger search */
const MIN_CHARS = 2;

/** Maximum results to display in dropdown */
const MAX_RESULTS = 10;

/** Default maximum skills allowed */
const DEFAULT_MAX_SKILLS = 20;

// ============================================================================
// COMPONENT
// ============================================================================

export function EscoSkillPicker({
  value,
  onChange,
  disabled = false,
  placeholder,
  language,
  maxSkills = DEFAULT_MAX_SKILLS,
}: EscoSkillPickerProps) {
  const { t, i18n } = useTranslation('contacts');
  const resolvedLanguage: EscoLanguage = language ?? (i18n.language === 'el' ? 'el' : 'en');

  // State
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [results, setResults] = useState<EscoSkillSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Derived
  const isMaxReached = value.length >= maxSkills;

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
      const response = await EscoService.searchSkills({
        query,
        language: resolvedLanguage,
        limit: MAX_RESULTS,
      });

      // Filter out already-selected skills
      const selectedUris = new Set(value.map(s => s.uri));
      const filtered = response.results.filter(r => !selectedUris.has(r.skill.uri));

      setResults(filtered);
      setHighlightedIndex(-1);
    } catch (error) {
      console.error('[EscoSkillPicker] Search error:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [resolvedLanguage, value]);

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

    if (isMaxReached) return;

    if (newValue.trim().length >= MIN_CHARS) {
      setIsOpen(true);
      debouncedSearch(newValue);
    } else {
      setResults([]);
      setIsOpen(false);
    }
  }, [debouncedSearch, isMaxReached]);

  const handleSelectSkill = useCallback((result: EscoSkillSearchResult) => {
    if (isMaxReached) return;

    const label = resolvedLanguage === 'el'
      ? result.skill.preferredLabel.el
      : result.skill.preferredLabel.en;

    const newSkill: EscoSkillValue = {
      uri: result.skill.uri,
      label,
    };

    onChange([...value, newSkill]);
    setInputValue('');
    setIsOpen(false);
    setResults([]);
    inputRef.current?.focus();
  }, [resolvedLanguage, onChange, value, isMaxReached]);

  const handleUseFreeText = useCallback(() => {
    if (isMaxReached || !inputValue.trim()) return;

    // Check if already selected (by label)
    const alreadyExists = value.some(
      s => s.label.toLowerCase() === inputValue.trim().toLowerCase()
    );
    if (alreadyExists) return;

    const newSkill: EscoSkillValue = {
      uri: '',
      label: inputValue.trim(),
    };

    onChange([...value, newSkill]);
    setInputValue('');
    setIsOpen(false);
    setResults([]);
    inputRef.current?.focus();
  }, [inputValue, onChange, value, isMaxReached]);

  const handleRemoveSkill = useCallback((index: number) => {
    const updated = value.filter((_, i) => i !== index);
    onChange(updated);
  }, [value, onChange]);

  // ========================================================================
  // KEYBOARD NAVIGATION
  // ========================================================================

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || results.length === 0) {
      // Handle backspace to remove last skill
      if (e.key === 'Backspace' && !inputValue && value.length > 0) {
        e.preventDefault();
        handleRemoveSkill(value.length - 1);
      }
      return;
    }

    const totalItems = results.length + (inputValue.trim().length >= MIN_CHARS ? 1 : 0);

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => (prev < totalItems - 1 ? prev + 1 : 0));
        break;

      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : totalItems - 1));
        break;

      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < results.length) {
          handleSelectSkill(results[highlightedIndex]);
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
  }, [isOpen, results, highlightedIndex, handleSelectSkill, handleUseFreeText, inputValue, value, handleRemoveSkill]);

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

  const getDisplayLabel = (result: EscoSkillSearchResult): string => {
    return resolvedLanguage === 'el'
      ? result.skill.preferredLabel.el
      : result.skill.preferredLabel.en;
  };

  const getSecondaryLabel = (result: EscoSkillSearchResult): string => {
    return resolvedLanguage === 'el'
      ? result.skill.preferredLabel.en
      : result.skill.preferredLabel.el;
  };

  // ========================================================================
  // RENDER
  // ========================================================================

  return (
    <section className="w-full space-y-2">
      {/* Selected Skills as Chips */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5" role="list" aria-label={t('individual.fields.skills')}>
          {value.map((skill, index) => (
            <span
              key={`${skill.uri || 'custom'}-${index}`}
              role="listitem"
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium',
                skill.uri
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'bg-gray-100 text-gray-700 border border-gray-200'
              )}
            >
              {skill.uri && (
                <span className="text-[10px] font-semibold text-blue-500">
                  {t('esco.skills.badge', 'ESCO')}
                </span>
              )}
              <span>{skill.label}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemoveSkill(index)}
                  className="ml-0.5 h-3.5 w-3.5 rounded-full hover:bg-black/10 inline-flex items-center justify-center transition-colors"
                  aria-label={`${t('esco.skills.removeSkill', 'Remove skill')}: ${skill.label}`}
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Search Input with Popover */}
      {!isMaxReached && (
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
                  if (inputValue.trim().length >= MIN_CHARS && !isMaxReached) {
                    setIsOpen(true);
                    debouncedSearch(inputValue);
                  }
                }}
                disabled={disabled}
                placeholder={placeholder ?? t('esco.skills.searchPlaceholder', 'Search ESCO skills...')}
                hasLeftIcon
                hasRightIcon={isLoading}
                aria-expanded={isOpen}
                aria-haspopup="listbox"
                aria-autocomplete="list"
                role="combobox"
              />
              {isLoading && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
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
                  key={result.skill.uri}
                  role="option"
                  aria-selected={highlightedIndex === index}
                  className={cn(
                    'flex flex-col px-3 py-2 cursor-pointer transition-colors',
                    highlightedIndex === index
                      ? 'bg-accent text-accent-foreground'
                      : 'hover:bg-muted'
                  )}
                  onClick={() => handleSelectSkill(result)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                >
                  <span className="text-sm font-medium">
                    {getDisplayLabel(result)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {getSecondaryLabel(result)}
                  </span>
                </li>
              ))}

              {/* No results message */}
              {!isLoading && results.length === 0 && inputValue.trim().length >= MIN_CHARS && (
                <li className="px-3 py-2 text-sm text-muted-foreground text-center">
                  {t('esco.skills.noResults', 'No skills found')}
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
                    {t('esco.skills.useFreeText', 'Add as free text')}: &quot;{inputValue}&quot;
                  </span>
                </li>
              )}
            </ul>
          </PopoverContent>
        </Popover>
      )}

      {/* Max reached message */}
      {isMaxReached && !disabled && (
        <p className="text-xs text-muted-foreground">
          {t('esco.skills.maxReached', 'Maximum skills reached ({{max}})', { max: maxSkills })}
        </p>
      )}
    </section>
  );
}

export default EscoSkillPicker;
