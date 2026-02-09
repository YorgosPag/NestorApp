'use client';

/**
 * @fileoverview Company Setup — Invoice Series Section
 * @description Σειρές τιμολογίων: δημιουργία, ενεργοποίηση/απενεργοποίηση
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-09
 * @version 1.0.0
 * @see ADR-ACC-002 Invoicing System
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles, semantic HTML, ADR-001 Radix Select
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Plus } from 'lucide-react';
import type { CompanySetupInput, InvoiceSeries } from '../../types';

// ============================================================================
// TYPES
// ============================================================================

interface InvoiceSeriesSectionProps {
  data: CompanySetupInput;
  onChange: (updates: Partial<CompanySetupInput>) => void;
}

// ============================================================================
// HELPERS
// ============================================================================

function createEmptySeries(): InvoiceSeries {
  return {
    code: '',
    prefix: '',
    nextNumber: 1,
    documentTypes: [],
    isActive: true,
    description: '',
  };
}

// ============================================================================
// COMPONENT
// ============================================================================

export function InvoiceSeriesSection({ data, onChange }: InvoiceSeriesSectionProps) {
  const { t } = useTranslation('accounting');
  const [showNewForm, setShowNewForm] = useState(false);
  const [newSeries, setNewSeries] = useState<InvoiceSeries>(createEmptySeries);

  const handleToggleActive = (index: number) => {
    const updated = [...data.invoiceSeries];
    updated[index] = { ...updated[index], isActive: !updated[index].isActive };
    onChange({ invoiceSeries: updated });
  };

  const handleAddSeries = () => {
    if (!newSeries.code.trim() || !newSeries.prefix.trim()) return;

    onChange({
      invoiceSeries: [...data.invoiceSeries, newSeries],
    });
    setNewSeries(createEmptySeries());
    setShowNewForm(false);
  };

  const handleCancelNew = () => {
    setNewSeries(createEmptySeries());
    setShowNewForm(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{t('setup.invoiceSeriesSection')}</CardTitle>
          {!showNewForm && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowNewForm(true)}
            >
              <Plus className="mr-1 h-4 w-4" />
              {t('setup.addSeries')}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <section className="space-y-4">
          {/* Existing Series */}
          {data.invoiceSeries.length === 0 && !showNewForm ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {t('setup.noSeries')}
            </p>
          ) : (
            <ul className="space-y-3">
              {data.invoiceSeries.map((series, index) => (
                <li
                  key={series.code}
                  className="flex items-center justify-between rounded-md border border-border p-3"
                >
                  <div className="flex-1">
                    <p className="font-medium text-foreground">
                      {series.prefix} ({series.code})
                    </p>
                    {series.description && (
                      <p className="text-sm text-muted-foreground">{series.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('setup.nextNumber')}: {series.nextNumber}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`series-active-${index}`} className="text-sm text-muted-foreground">
                      {t('setup.seriesActive')}
                    </Label>
                    <Switch
                      id={`series-active-${index}`}
                      checked={series.isActive}
                      onCheckedChange={() => handleToggleActive(index)}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* New Series Form */}
          {showNewForm && (
            <>
              <Separator />
              <fieldset className="space-y-4 rounded-md border border-border p-4">
                <legend className="text-sm font-semibold text-foreground px-1">
                  {t('setup.addSeries')}
                </legend>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="newSeriesCode">{t('setup.seriesCode')}</Label>
                    <Input
                      id="newSeriesCode"
                      value={newSeries.code}
                      onChange={(e) =>
                        setNewSeries((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))
                      }
                      placeholder="A"
                      maxLength={10}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newSeriesPrefix">{t('setup.seriesPrefix')}</Label>
                    <Input
                      id="newSeriesPrefix"
                      value={newSeries.prefix}
                      onChange={(e) =>
                        setNewSeries((prev) => ({ ...prev, prefix: e.target.value }))
                      }
                      placeholder="ΤΠΥ-Α"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newSeriesDescription">{t('setup.seriesDescription')}</Label>
                    <Input
                      id="newSeriesDescription"
                      value={newSeries.description}
                      onChange={(e) =>
                        setNewSeries((prev) => ({ ...prev, description: e.target.value }))
                      }
                      placeholder={t('setup.seriesDescription')}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={handleCancelNew}>
                    {t('forms.cancel')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddSeries}
                    disabled={!newSeries.code.trim() || !newSeries.prefix.trim()}
                  >
                    {t('forms.create')}
                  </Button>
                </div>
              </fieldset>
            </>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
