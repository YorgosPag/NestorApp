'use client';

/**
 * NameComboboxField — Combobox UI for selecting predefined phase/task names
 *
 * Extracted from ConstructionPhaseDialog to comply with 500-line limit.
 * Renders: trigger button + popover with search, predefined options, custom entry.
 */

import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { FormField, FormInput } from '@/components/ui/form/FormComponents';
import { ChevronDown, Search, Check, PenLine } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTypography } from '@/hooks/useTypography';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { INTERACTIVE_PATTERNS, TRANSITION_PRESETS } from '@/components/ui/effects';
import type { ComboboxOption } from './usePhaseNameCombobox';

// ─── Props ──────────────────────────────────────────────────────────────

interface NameComboboxFieldProps {
  name: string;
  isPhaseMode: boolean;
  error?: string;
  popoverOpen: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  highlightedIndex: number;
  resultsRef: React.RefObject<HTMLDivElement | null>;
  filteredOptions: ComboboxOption[];
  onSelectPredefined: (option: ComboboxOption) => void;
  onUseCustomText: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onOpenChange: (open: boolean) => void;
  onHighlightChange: (index: number) => void;
  t: (key: string, params?: Record<string, string>) => string;
}

// ─── Component ──────────────────────────────────────────────────────────

export function NameComboboxField({
  name,
  isPhaseMode,
  error,
  popoverOpen,
  searchQuery,
  setSearchQuery,
  inputRef,
  highlightedIndex,
  resultsRef,
  filteredOptions,
  onSelectPredefined,
  onUseCustomText,
  onKeyDown,
  onOpenChange,
  onHighlightChange,
  t,
}: NameComboboxFieldProps) {
  const spacingTokens = useSpacingTokens();
  const iconSizes = useIconSizes();
  const typographyTokens = useTypography();
  const colors = useSemanticColors();

  return (
    <FormField
      label={t('tabs.timeline.gantt.dialog.name')}
      htmlFor="construction-name"
      required
    >
      <FormInput>
        <Popover open={popoverOpen} onOpenChange={onOpenChange}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              type="button"
              role="combobox"
              aria-expanded={popoverOpen}
              className={cn(
                'w-full justify-between h-10 px-2 py-2',
                typographyTokens.body.sm,
                error ? 'border-destructive' : 'border-input',
                INTERACTIVE_PATTERNS.ACCENT_HOVER,
                'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
              )}
            >
              <span className={name ? 'text-foreground truncate' : colors.text.muted}>
                {name || (isPhaseMode
                  ? t('tabs.timeline.gantt.dialog.phaseNamePlaceholder')
                  : t('tabs.timeline.gantt.dialog.taskNamePlaceholder')
                )}
              </span>
              <ChevronDown className={cn(
                iconSizes.sm,
                TRANSITION_PRESETS.STANDARD_TRANSFORM,
                popoverOpen ? 'rotate-180' : '',
              )} />
            </Button>
          </PopoverTrigger>

          <PopoverContent
            className="w-[var(--radix-popover-trigger-width)] p-0"
            align="start"
            sideOffset={4}
            onKeyDown={onKeyDown}
          >
            {/* Search Input */}
            <section className={cn('border-b border-border', spacingTokens.padding.sm)}>
              <div className="relative">
                <Search className={cn('absolute left-2 top-2.5', iconSizes.sm, colors.text.muted)} />
                <Input
                  ref={inputRef}
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    onHighlightChange(-1);
                  }}
                  placeholder={isPhaseMode
                    ? t('tabs.timeline.gantt.templates.combobox.searchPhase')
                    : t('tabs.timeline.gantt.templates.combobox.searchTask')
                  }
                  className="pl-8"
                />
              </div>
            </section>

            {/* Results */}
            <div
              ref={resultsRef}
              className="max-h-[250px] overflow-y-auto"
              role="listbox"
              onWheel={(e) => {
                const el = e.currentTarget;
                if (el.scrollHeight > el.clientHeight) {
                  e.stopPropagation();
                  el.scrollTop += e.deltaY;
                }
              }}
            >
              {/* Predefined Section Header */}
              {filteredOptions.length > 0 && (
                <p className={cn(
                  typographyTokens.label.sm,
                  colors.text.muted,
                  spacingTokens.padding.x.sm,
                  spacingTokens.padding.y.xs,
                  'border-b border-border bg-muted/30',
                )}>
                  {t('tabs.timeline.gantt.templates.combobox.predefined')}
                </p>
              )}

              {/* Predefined Options */}
              {filteredOptions.map((option, index) => {
                const isSelected = name === option.label;
                const isHighlighted = index === highlightedIndex;
                return (
                  <div
                    key={`${option.code}-${option.key}`}
                    data-option-index={index}
                    role="option"
                    aria-selected={isHighlighted}
                    className={cn(
                      'flex items-center justify-between cursor-pointer',
                      spacingTokens.padding.x.sm,
                      spacingTokens.padding.y.xs,
                      'border-b border-border last:border-b-0',
                      TRANSITION_PRESETS.STANDARD_COLORS,
                      isHighlighted
                        ? 'bg-accent text-accent-foreground'
                        : INTERACTIVE_PATTERNS.ACCENT_HOVER,
                    )}
                    onClick={() => onSelectPredefined(option)}
                    onMouseEnter={() => onHighlightChange(index)}
                  >
                    <span className={cn('flex items-center', spacingTokens.gap.sm)}>
                      <span className={cn(typographyTokens.body.sm, colors.text.muted)}>
                        {option.code}
                      </span>
                      <span className={typographyTokens.body.sm}>
                        {option.label}
                      </span>
                    </span>
                    {isSelected && (
                      <Check className={cn(iconSizes.sm, 'text-primary')} />
                    )}
                  </div>
                );
              })}

              {/* Custom Entry Option */}
              {searchQuery.trim() && (
                <div
                  data-option-index={filteredOptions.length}
                  role="option"
                  aria-selected={highlightedIndex === filteredOptions.length}
                  className={cn(
                    'flex items-center cursor-pointer',
                    spacingTokens.padding.x.sm,
                    spacingTokens.padding.y.xs,
                    'border-t border-border',
                    TRANSITION_PRESETS.STANDARD_COLORS,
                    highlightedIndex === filteredOptions.length
                      ? 'bg-accent text-accent-foreground'
                      : INTERACTIVE_PATTERNS.ACCENT_HOVER,
                  )}
                  onClick={onUseCustomText}
                  onMouseEnter={() => onHighlightChange(filteredOptions.length)}
                >
                  <PenLine className={cn(iconSizes.sm, colors.text.muted, spacingTokens.margin.right.sm)} />
                  <span className={typographyTokens.body.sm}>
                    {t('tabs.timeline.gantt.templates.combobox.custom', { value: searchQuery.trim() })}
                  </span>
                </div>
              )}

              {/* No Results */}
              {filteredOptions.length === 0 && !searchQuery.trim() && (
                <p className={cn(
                  typographyTokens.body.sm,
                  colors.text.muted,
                  'text-center',
                  spacingTokens.padding.md,
                )}>
                  {t('tabs.timeline.gantt.templates.combobox.noResults')}
                </p>
              )}
            </div>
          </PopoverContent>
        </Popover>
        {error && (
          <p className={cn(typographyTokens.body.sm, colors.text.error, spacingTokens.margin.top.xs)}>{error}</p>
        )}
      </FormInput>
    </FormField>
  );
}
