'use client';

/**
 * @fileoverview Company Setup — KAD (Activity Codes) Section with Searchable Dropdowns
 * @description Κωδικοί Δραστηριότητας (ΚΑΔ): κύρια + δευτερεύουσες, searchable from ~700 entries
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-09
 * @updated 2026-02-10
 * @version 2.0.0 — ADR-ACC-013: Searchable ΚΑΔ dropdowns
 * @see ADR-ACC-000 §2 Company Data
 * @see ADR-ACC-013 Searchable ΔΟΥ + ΚΑΔ Dropdowns
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles, semantic HTML
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { SearchableCombobox } from '@/components/ui/searchable-combobox';
import type { ComboboxOption } from '@/components/ui/searchable-combobox';
import { Plus, Trash2 } from 'lucide-react';
import type { CompanySetupInput, KadEntry } from '../../types';
import type { KadCode } from '../../data/greek-kad-codes';

// ============================================================================
// TYPES
// ============================================================================

interface KadSectionProps {
  data: CompanySetupInput;
  onChange: (updates: Partial<CompanySetupInput>) => void;
  errors: Record<string, string>;
}

// ============================================================================
// HELPERS
// ============================================================================

function createEmptyKad(): KadEntry {
  return {
    code: '',
    description: '',
    type: 'secondary',
    activeFrom: new Date().toISOString().split('T')[0],
  };
}

/**
 * Convert KadCode[] to ComboboxOption[] for the SearchableCombobox.
 * Label = "code — description", value = code, secondaryLabel = description.
 */
function kadCodesToOptions(codes: KadCode[]): ComboboxOption[] {
  return codes.map((kad) => ({
    value: kad.code,
    label: `${kad.code} — ${kad.description}`,
    secondaryLabel: kad.description,
  }));
}

// ============================================================================
// HOOK: Lazy-load ΚΑΔ data
// ============================================================================

function useKadOptions() {
  const [options, setOptions] = useState<ComboboxOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadKadCodes() {
      try {
        const { GREEK_KAD_CODES } = await import('../../data/greek-kad-codes');
        if (!cancelled) {
          setOptions(kadCodesToOptions(GREEK_KAD_CODES));
        }
      } catch (error) {
        console.error('Failed to load ΚΑΔ codes:', error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadKadCodes();
    return () => { cancelled = true; };
  }, []);

  return { options, isLoading };
}

// ============================================================================
// COMPONENT
// ============================================================================

export function KadSection({ data, onChange, errors }: KadSectionProps) {
  const { t } = useTranslation('accounting');
  const { options: kadOptions, isLoading: kadLoading } = useKadOptions();

  /**
   * Handle main ΚΑΔ selection — auto-fills both code + description
   */
  const handleMainKadSelect = useCallback(
    (value: string, option: ComboboxOption | null) => {
      if (option) {
        // Selected from dropdown → fill code + description
        onChange({
          mainKad: {
            ...data.mainKad,
            code: value,
            description: option.secondaryLabel ?? '',
          },
        });
      } else {
        // Free text → treat as code
        onChange({
          mainKad: {
            ...data.mainKad,
            code: value,
          },
        });
      }
    },
    [data.mainKad, onChange],
  );

  /**
   * Handle secondary ΚΑΔ selection — auto-fills both code + description
   */
  const handleSecondaryKadSelect = useCallback(
    (index: number, value: string, option: ComboboxOption | null) => {
      const updated = [...data.secondaryKads];
      if (option) {
        updated[index] = {
          ...updated[index],
          code: value,
          description: option.secondaryLabel ?? '',
        };
      } else {
        updated[index] = {
          ...updated[index],
          code: value,
        };
      }
      onChange({ secondaryKads: updated });
    },
    [data.secondaryKads, onChange],
  );

  const addSecondaryKad = useCallback(() => {
    onChange({ secondaryKads: [...data.secondaryKads, createEmptyKad()] });
  }, [data.secondaryKads, onChange]);

  const removeSecondaryKad = useCallback(
    (index: number) => {
      const updated = data.secondaryKads.filter((_, i) => i !== index);
      onChange({ secondaryKads: updated });
    },
    [data.secondaryKads, onChange],
  );

  // Memoize currently selected display for main KAD
  const mainKadDisplayValue = useMemo(() => {
    if (!data.mainKad.code) return '';
    if (data.mainKad.description) {
      return `${data.mainKad.code} — ${data.mainKad.description}`;
    }
    return data.mainKad.code;
  }, [data.mainKad.code, data.mainKad.description]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('setup.kadSection')}</CardTitle>
      </CardHeader>
      <CardContent>
        <fieldset className="space-y-6">
          {/* Κύρια Δραστηριότητα */}
          <section aria-label={t('setup.mainKad')}>
            <h3 className="text-sm font-semibold text-foreground mb-3">
              {t('setup.mainKad')} *
            </h3>
            <div className="space-y-2">
              <Label>{t('setup.kadCode')}</Label>
              <SearchableCombobox
                value={data.mainKad.code}
                onValueChange={handleMainKadSelect}
                options={kadOptions}
                placeholder={t('setup.searchKad')}
                emptyMessage={t('setup.noKadFound')}
                isLoading={kadLoading}
                allowFreeText
                maxDisplayed={30}
                error={errors.mainKad}
              />
              {errors.mainKad && (
                <p className="text-sm text-destructive">{errors.mainKad}</p>
              )}
              {data.mainKad.description && (
                <p className="text-sm text-muted-foreground">
                  {data.mainKad.description}
                </p>
              )}
            </div>
          </section>

          <Separator />

          {/* Δευτερεύουσες Δραστηριότητες */}
          <section aria-label={t('setup.secondaryKads')}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">
                {t('setup.secondaryKads')}
              </h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addSecondaryKad}
              >
                <Plus className="mr-1 h-4 w-4" />
                {t('setup.addKad')}
              </Button>
            </div>

            {data.secondaryKads.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                {t('setup.noSecondaryKads')}
              </p>
            ) : (
              <ul className="space-y-3">
                {data.secondaryKads.map((kad, index) => (
                  <li key={index} className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-start">
                    <div className="space-y-1">
                      <Label>{t('setup.kadCode')}</Label>
                      <SearchableCombobox
                        value={kad.code}
                        onValueChange={(value, option) =>
                          handleSecondaryKadSelect(index, value, option)
                        }
                        options={kadOptions}
                        placeholder={t('setup.searchKad')}
                        emptyMessage={t('setup.noKadFound')}
                        isLoading={kadLoading}
                        allowFreeText
                        maxDisplayed={30}
                      />
                      {kad.description && (
                        <p className="text-sm text-muted-foreground">
                          {kad.description}
                        </p>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeSecondaryKad(index)}
                      aria-label={t('setup.removeKad')}
                      className="text-destructive hover:text-destructive mt-6"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </fieldset>
      </CardContent>
    </Card>
  );
}
