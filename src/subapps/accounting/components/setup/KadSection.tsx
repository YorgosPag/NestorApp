'use client';

/**
 * @fileoverview Company Setup — KAD (Activity Codes) Section
 * @description Κωδικοί Δραστηριότητας (ΚΑΔ): κύρια + δευτερεύουσες
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-09
 * @version 1.0.0
 * @see ADR-ACC-000 §2 Company Data
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles, semantic HTML
 */

import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2 } from 'lucide-react';
import type { CompanySetupInput, KadEntry } from '../../types';

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

// ============================================================================
// COMPONENT
// ============================================================================

export function KadSection({ data, onChange, errors }: KadSectionProps) {
  const { t } = useTranslation('accounting');

  const handleMainKadChange = (field: keyof KadEntry, value: string) => {
    onChange({
      mainKad: {
        ...data.mainKad,
        [field]: value,
      },
    });
  };

  const handleSecondaryKadChange = (index: number, field: keyof KadEntry, value: string) => {
    const updated = [...data.secondaryKads];
    updated[index] = { ...updated[index], [field]: value };
    onChange({ secondaryKads: updated });
  };

  const addSecondaryKad = () => {
    onChange({ secondaryKads: [...data.secondaryKads, createEmptyKad()] });
  };

  const removeSecondaryKad = (index: number) => {
    const updated = data.secondaryKads.filter((_, i) => i !== index);
    onChange({ secondaryKads: updated });
  };

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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="mainKadCode">{t('setup.kadCode')}</Label>
                <Input
                  id="mainKadCode"
                  value={data.mainKad.code}
                  onChange={(e) => handleMainKadChange('code', e.target.value)}
                  placeholder="71112000"
                  aria-invalid={!!errors.mainKad}
                />
                {errors.mainKad && (
                  <p className="text-sm text-destructive">{errors.mainKad}</p>
                )}
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="mainKadDescription">{t('setup.kadDescription')}</Label>
                <Input
                  id="mainKadDescription"
                  value={data.mainKad.description}
                  onChange={(e) => handleMainKadChange('description', e.target.value)}
                  placeholder={t('setup.kadDescription')}
                />
              </div>
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
                  <li key={index} className="grid grid-cols-1 md:grid-cols-[1fr_2fr_auto] gap-3 items-end">
                    <div className="space-y-1">
                      <Label>{t('setup.kadCode')}</Label>
                      <Input
                        value={kad.code}
                        onChange={(e) => handleSecondaryKadChange(index, 'code', e.target.value)}
                        placeholder="71112000"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>{t('setup.kadDescription')}</Label>
                      <Input
                        value={kad.description}
                        onChange={(e) =>
                          handleSecondaryKadChange(index, 'description', e.target.value)
                        }
                        placeholder={t('setup.kadDescription')}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeSecondaryKad(index)}
                      aria-label={t('setup.removeKad')}
                      className="text-destructive hover:text-destructive"
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
