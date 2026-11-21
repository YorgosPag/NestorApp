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

import { useCallback, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2 } from 'lucide-react';
import type { CompanySetupInput, KadEntry } from '../../types';
// Ο ΕΝΑΣ επιλογέας ΚΑΔ 2025 (κοινός με τις επαφές): δέσμευση μόνο με επιλογή ή ακριβή κωδικό.
import { KadCodePicker } from '@/components/shared/KadCodePicker';
import type { KadSelection } from '@/lib/kad/kad-types';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

import { cn } from '@/lib/utils';
import { calendarDayOf } from '@/constants/platform-operator';

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
    // Operator calendar day (Europe/Athens) — not the UTC day of an ISO instant.
    activeFrom: calendarDayOf(new Date()),
  };
}

/** Η επιλογή του καταλόγου πάνω σε γραμμή· `null` = καθαρισμός (χωρίς σημαία καταλόγου). */
function applySelection(entry: KadEntry, selection: KadSelection | null): KadEntry {
  const base: KadEntry = { code: '', description: '', type: entry.type, activeFrom: entry.activeFrom };
  return selection === null ? base : { ...base, ...selection };
}

// ============================================================================
// COMPONENT
// ============================================================================

export function KadSection({ data, onChange, errors }: KadSectionProps) {
  const { t } = useTranslation(['accounting', 'accounting-tax-offices']);
  const idBase = useId(); // `${idBase}-<πεδίο>`: η <Label> ονομάζει το combobox (ADR-598 G11)
  const colors = useSemanticColors();

  const handleMainKadSelect = useCallback(
    (selection: KadSelection | null) => onChange({ mainKad: applySelection(data.mainKad, selection) }),
    [data.mainKad, onChange],
  );

  const handleSecondaryKadSelect = useCallback(
    (index: number, selection: KadSelection | null) => {
      const updated = [...data.secondaryKads];
      updated[index] = applySelection(updated[index], selection);
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
              <Label htmlFor={`${idBase}-main`}>{t('setup.kadCode')}</Label>
              <KadCodePicker
                id={`${idBase}-main`}
                value={data.mainKad.code}
                catalog={data.mainKad.catalog}
                onChange={handleMainKadSelect}
                error={errors.mainKad}
              />
              {errors.mainKad && (
                <p className="text-sm text-destructive">{errors.mainKad}</p>
              )}
              {data.mainKad.description && (
                <p className={cn("text-sm", colors.text.muted)}>
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
              <p className={cn("text-sm py-4 text-center", colors.text.muted)}>
                {t('setup.noSecondaryKads')}
              </p>
            ) : (
              <ul className="space-y-3">
                {data.secondaryKads.map((kad, index) => (
                  <li key={index} className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-start">
                    <div className="space-y-1">
                      <Label htmlFor={`${idBase}-secondary-${index}`}>{t('setup.kadCode')}</Label>
                      <KadCodePicker
                        id={`${idBase}-secondary-${index}`}
                        value={kad.code}
                        catalog={kad.catalog}
                        onChange={(selection) => handleSecondaryKadSelect(index, selection)}
                      />
                      {kad.description && (
                        <p className={cn("text-sm", colors.text.muted)}>
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
