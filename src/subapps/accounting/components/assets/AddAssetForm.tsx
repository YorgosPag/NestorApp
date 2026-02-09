'use client';

/**
 * @fileoverview Accounting Subapp — Add Fixed Asset Form
 * @description Dialog form for creating new fixed assets
 * @author Claude Code (Anthropic AI) + Georgios Pagonis
 * @created 2026-02-09
 * @version 1.0.0
 * @see ADR-ACC-007 Fixed Assets & Depreciation
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles, semantic HTML
 */

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AssetCategory, CreateFixedAssetInput } from '@/subapps/accounting/types';

// ============================================================================
// TYPES
// ============================================================================

interface AddAssetFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateFixedAssetInput) => Promise<{ id: string } | null>;
}

interface FormState {
  description: string;
  category: AssetCategory | '';
  acquisitionDate: string;
  acquisitionCost: string;
  usefulLifeYears: string;
  residualValue: string;
  notes: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const ASSET_CATEGORIES: AssetCategory[] = [
  'buildings',
  'machinery',
  'vehicles',
  'furniture',
  'computers',
  'measurement_instruments',
  'other',
];

const DEPRECIATION_RATES: Record<AssetCategory, number> = {
  buildings: 4,
  machinery: 10,
  vehicles: 16,
  furniture: 10,
  computers: 20,
  measurement_instruments: 10,
  other: 10,
};

const INITIAL_FORM_STATE: FormState = {
  description: '',
  category: '',
  acquisitionDate: '',
  acquisitionCost: '',
  usefulLifeYears: '',
  residualValue: '0',
  notes: '',
};

// ============================================================================
// COMPONENT
// ============================================================================

export function AddAssetForm({ open, onOpenChange, onSubmit }: AddAssetFormProps) {
  const { t } = useTranslation('accounting');

  const [form, setForm] = useState<FormState>(INITIAL_FORM_STATE);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFieldChange = useCallback(
    (field: keyof FormState, value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }));
      setError(null);
    },
    [],
  );

  const handleCategoryChange = useCallback((value: AssetCategory) => {
    const rate = DEPRECIATION_RATES[value];
    const usefulLife = rate > 0 ? Math.round(100 / rate) : 10;
    setForm((prev) => ({
      ...prev,
      category: value,
      usefulLifeYears: String(usefulLife),
    }));
    setError(null);
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!form.description || !form.category || !form.acquisitionDate || !form.acquisitionCost) {
        setError(t('assets.requiredFields'));
        return;
      }

      const category = form.category as AssetCategory;
      const acquisitionCost = parseFloat(form.acquisitionCost);
      const usefulLifeYears = parseInt(form.usefulLifeYears, 10) || 10;
      const residualValue = parseFloat(form.residualValue) || 0;

      if (isNaN(acquisitionCost) || acquisitionCost <= 0) {
        setError(t('assets.invalidCost'));
        return;
      }

      const input: CreateFixedAssetInput = {
        description: form.description.trim(),
        category,
        status: 'active',
        acquisitionCost,
        residualValue,
        acquisitionDate: form.acquisitionDate,
        depreciationStartDate: form.acquisitionDate,
        depreciationRate: DEPRECIATION_RATES[category],
        depreciationMethod: 'straight_line',
        usefulLifeYears,
        purchaseInvoiceNumber: null,
        supplierName: null,
        supplierVatNumber: null,
        notes: form.notes.trim() || null,
        acquisitionFiscalYear: new Date(form.acquisitionDate).getFullYear(),
      };

      try {
        setSubmitting(true);
        setError(null);
        const result = await onSubmit(input);
        if (result) {
          setForm(INITIAL_FORM_STATE);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : t('assets.createError');
        setError(message);
      } finally {
        setSubmitting(false);
      }
    },
    [form, onSubmit, t],
  );

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        setForm(INITIAL_FORM_STATE);
        setError(null);
      }
      onOpenChange(isOpen);
    },
    [onOpenChange],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('assets.addAssetTitle')}</DialogTitle>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {/* Description */}
          <fieldset className="space-y-2">
            <Label htmlFor="asset-description">{t('assets.name')}</Label>
            <Input
              id="asset-description"
              value={form.description}
              onChange={(e) => handleFieldChange('description', e.target.value)}
              placeholder={t('assets.namePlaceholder')}
              required
            />
          </fieldset>

          {/* Category */}
          <fieldset className="space-y-2">
            <Label htmlFor="asset-category">{t('assets.category')}</Label>
            <Select
              value={form.category || undefined}
              onValueChange={(v) => handleCategoryChange(v as AssetCategory)}
            >
              <SelectTrigger id="asset-category">
                <SelectValue placeholder={t('assets.categoryPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {ASSET_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {t(`assets.categories.${cat}`)} ({DEPRECIATION_RATES[cat]}%)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </fieldset>

          {/* Acquisition Date */}
          <fieldset className="space-y-2">
            <Label htmlFor="asset-date">{t('assets.acquisitionDate')}</Label>
            <Input
              id="asset-date"
              type="date"
              value={form.acquisitionDate}
              onChange={(e) => handleFieldChange('acquisitionDate', e.target.value)}
              required
            />
          </fieldset>

          {/* Cost and Useful Life row */}
          <div className="grid grid-cols-2 gap-4">
            <fieldset className="space-y-2">
              <Label htmlFor="asset-cost">{t('assets.acquisitionCost')}</Label>
              <Input
                id="asset-cost"
                type="number"
                step="0.01"
                min="0"
                value={form.acquisitionCost}
                onChange={(e) => handleFieldChange('acquisitionCost', e.target.value)}
                placeholder="0.00"
                required
              />
            </fieldset>

            <fieldset className="space-y-2">
              <Label htmlFor="asset-life">{t('assets.usefulLife')}</Label>
              <Input
                id="asset-life"
                type="number"
                min="1"
                max="100"
                value={form.usefulLifeYears}
                onChange={(e) => handleFieldChange('usefulLifeYears', e.target.value)}
                placeholder="10"
              />
            </fieldset>
          </div>

          {/* Residual Value */}
          <fieldset className="space-y-2">
            <Label htmlFor="asset-residual">{t('assets.residualValue')}</Label>
            <Input
              id="asset-residual"
              type="number"
              step="0.01"
              min="0"
              value={form.residualValue}
              onChange={(e) => handleFieldChange('residualValue', e.target.value)}
              placeholder="0.00"
            />
          </fieldset>

          {/* Notes */}
          <fieldset className="space-y-2">
            <Label htmlFor="asset-notes">{t('assets.notes')}</Label>
            <Input
              id="asset-notes"
              value={form.notes}
              onChange={(e) => handleFieldChange('notes', e.target.value)}
              placeholder={t('assets.notesPlaceholder')}
            />
          </fieldset>

          {/* Error Message */}
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          {/* Submit */}
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? t('assets.creating') : t('assets.addAsset')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
