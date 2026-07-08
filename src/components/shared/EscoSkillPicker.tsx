/* eslint-disable design-system/enforce-semantic-colors */
'use client';

/**
 * ============================================================================
 * ESCO Skill Picker (ADR-132 · ADR-601)
 * ============================================================================
 *
 * Multi-select autocomplete for ESCO-standardized skills (chips + max limit).
 * Search/debounce/keyboard/listbox mechanics come from the shared picker SSoT;
 * this component owns the multi-select value model (append-on-commit, dedupe,
 * max limit, Backspace removal) via injected commit callbacks + onBackspaceEmpty.
 *
 * @module components/shared/EscoSkillPicker
 */

import React, { useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Search, X } from 'lucide-react';
import { EscoService } from '@/services/esco.service';
import type {
  EscoSkillPickerProps,
  EscoSkillValue,
  EscoSkillSearchResult,
} from '@/types/contacts/esco-types';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { pickBilingualLabel, resolveEscoLang } from '@/components/shared/esco/esco-label';
import {
  PickerPopoverShell,
  PickerSearchInput,
  PickerResultsList,
  useAsyncPickerSearch,
  useContactPickerTranslation,
} from '@/components/shared/pickers';
import '@/lib/design-system';

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
  const { t, i18n } = useContactPickerTranslation();
  const colors = useSemanticColors();
  const { lang, otherLang } = resolveEscoLang(language, i18n.language);

  const isMaxReached = value.length >= maxSkills;

  const handleRemoveSkill = useCallback((index: number) => {
    onChange(value.filter((_, i) => i !== index));
  }, [value, onChange]);

  const search = useCallback(async (query: string): Promise<EscoSkillSearchResult[]> => {
    const response = await EscoService.searchSkills({ query, language: lang, limit: MAX_RESULTS });
    const selectedUris = new Set(value.map(s => s.uri));
    return response.results.filter(r => !selectedUris.has(r.skill.uri));
  }, [lang, value]);

  const picker = useAsyncPickerSearch<EscoSkillSearchResult>({
    search,
    onSelectResult: (result, ctx) => {
      if (isMaxReached) return;
      const label = pickBilingualLabel(result.skill.preferredLabel, lang);
      onChange([...value, { uri: result.skill.uri, label }]);
      ctx.setInputValue('');
      ctx.resetResults();
      ctx.inputRef.current?.focus();
    },
    onFreeText: (ctx) => {
      const text = ctx.inputValue.trim();
      if (isMaxReached || !text) return;
      const alreadyExists = value.some(s => s.label.toLowerCase() === text.toLowerCase());
      if (alreadyExists) return;
      const newSkill: EscoSkillValue = { uri: '', label: text };
      onChange([...value, newSkill]);
      ctx.setInputValue('');
      ctx.resetResults();
      ctx.inputRef.current?.focus();
    },
    onBackspaceEmpty: () => {
      if (value.length > 0) handleRemoveSkill(value.length - 1);
    },
  });

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    picker.setInputValue(newValue);
    if (isMaxReached) return;
    picker.syncQuery(newValue);
  }, [isMaxReached, picker.setInputValue, picker.syncQuery]);

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
                  ? 'bg-[hsl(var(--bg-info))]/20 text-primary border border-border'
                  : 'bg-muted text-foreground border border-border'
              )}
            >
              {skill.uri && (
                <span className="text-[10px] font-semibold text-primary">
                  {t('esco.skills.badge')}
                </span>
              )}
              <span>{skill.label}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemoveSkill(index)}
                  className="ml-0.5 h-3.5 w-3.5 rounded-full hover:bg-black/10 inline-flex items-center justify-center transition-colors"
                  aria-label={`${t('esco.skills.removeSkill')}: ${skill.label}`}
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
        <PickerPopoverShell open={picker.isOpen && !disabled} onOpenChange={picker.setIsOpen}
          anchor={
            <PickerSearchInput
              picker={picker}
              onChange={handleInputChange}
              onFocus={() => picker.handleFocus(!isMaxReached)}
              disabled={disabled}
              placeholder={placeholder ?? t('esco.skills.searchPlaceholder')}
              hasRightIcon={picker.isLoading}
              leftIcon={<Search className={cn("absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none", colors.text.muted)} />}
            />
          }
        >
          <PickerResultsList<EscoSkillSearchResult>
            picker={picker}
            getKey={(r) => r.skill.uri}
            renderItemContent={(result) => (
              <>
                <span className="text-sm font-medium">
                  {pickBilingualLabel(result.skill.preferredLabel, lang)}
                </span>
                <span className={cn("text-xs", colors.text.muted)}>
                  {pickBilingualLabel(result.skill.preferredLabel, otherLang)}
                </span>
              </>
            )}
            labels={{
              searchResults: t('esco.searchResults'),
              noResults: t('esco.skills.noResults'),
              useFreeText: t('esco.skills.useFreeText'),
            }}
          />
        </PickerPopoverShell>
      )}

      {/* Max reached message */}
      {isMaxReached && !disabled && (
        <p className={cn("text-xs", colors.text.muted)}>
          {t('esco.skills.maxReached', { max: maxSkills })}
        </p>
      )}
    </section>
  );
}

export default EscoSkillPicker;
