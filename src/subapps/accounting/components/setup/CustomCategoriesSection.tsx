'use client';

/**
 * @fileoverview Company Setup — Custom Categories Section
 * @description CRUD UI για user-defined κατηγορίες εσόδων/εξόδων (ADR-ACC-021)
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-18
 * @version 1.0.0
 * @see ADR-ACC-021 Custom Expense/Income Categories
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles, semantic HTML
 */

import { useState, useCallback } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tag, Plus, Pencil, Trash2, TrendingUp, TrendingDown } from 'lucide-react';
import { useCustomCategories } from '../../hooks/useCustomCategories';
import type { CustomCategoryDocument, CreateCustomCategoryInput } from '../../types';
import type { MyDataIncomeType, MyDataExpenseType } from '../../types/common';

import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

import { cn } from '@/lib/utils';

// ============================================================================
// MYDATA OPTIONS — Dropdown για υποχρεωτικό mapping
// ============================================================================

/** myDATA code values — labels resolved via i18n at render time */
const MYDATA_INCOME_CODES: MyDataIncomeType[] = [
  'category1_1', 'category1_3', 'category1_4', 'category1_5',
];

const MYDATA_EXPENSE_CODES: MyDataExpenseType[] = [
  'category2_2', 'category2_3', 'category2_4', 'category2_5',
  'category2_6', 'category2_7', 'category2_11', 'category2_12', 'category2_14',
];

// ============================================================================
// EMPTY FORM STATE
// ============================================================================

interface CategoryFormState {
  type: 'income' | 'expense';
  label: string;
  description: string;
  mydataCode: string;
  e3Code: string;
  defaultVatRate: number;
  vatDeductiblePercent: 0 | 50 | 100;
}

function emptyForm(): CategoryFormState {
  return {
    type: 'expense',
    label: '',
    description: '',
    mydataCode: '',
    e3Code: '',
    defaultVatRate: 24,
    vatDeductiblePercent: 100,
  };
}

// ============================================================================
// COMPONENT
// ============================================================================

export function CustomCategoriesSection() {
  const { t } = useTranslation(['accounting', 'accounting-tax-offices', 'accounting-setup']);
  const colors = useSemanticColors();
  const { categories, loading, error, createCategory, updateCategory, deleteCategory } =
    useCustomCategories({ includeInactive: true });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CategoryFormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const mydataCodes =
    form.type === 'income' ? MYDATA_INCOME_CODES : MYDATA_EXPENSE_CODES;
  const mydataLabelPrefix = form.type === 'income' ? 'setup.customCategories.mydata.income' : 'setup.customCategories.mydata.expense';

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setFormError(null);
    setDialogOpen(true);
  }

  function openEdit(cat: CustomCategoryDocument) {
    setEditingId(cat.categoryId);
    setForm({
      type: cat.type,
      label: cat.label,
      description: cat.description,
      mydataCode: cat.mydataCode,
      e3Code: cat.e3Code,
      defaultVatRate: cat.defaultVatRate,
      vatDeductiblePercent: cat.vatDeductiblePercent,
    });
    setFormError(null);
    setDialogOpen(true);
  }

  // ── Save ───────────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!form.label.trim()) {
      setFormError(t('setup.customCategories.errors.labelRequired'));
      return;
    }
    if (!form.mydataCode) {
      setFormError(t('setup.customCategories.errors.mydataRequired'));
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      if (editingId) {
        await updateCategory(editingId, {
          label: form.label.trim(),
          description: form.description.trim(),
          mydataCode: form.mydataCode as MyDataIncomeType | MyDataExpenseType,
          e3Code: form.e3Code,
          defaultVatRate: form.defaultVatRate,
          vatDeductible: form.vatDeductiblePercent > 0,
          vatDeductiblePercent: form.vatDeductiblePercent,
        });
      } else {
        const input: CreateCustomCategoryInput = {
          type: form.type,
          label: form.label.trim(),
          description: form.description.trim(),
          mydataCode: form.mydataCode as MyDataIncomeType | MyDataExpenseType,
          e3Code: form.e3Code,
          defaultVatRate: form.defaultVatRate,
          vatDeductible: form.vatDeductiblePercent > 0,
          vatDeductiblePercent: form.vatDeductiblePercent,
        };
        await createCategory(input);
      }
      setDialogOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('setup.customCategories.errors.saveFailed'));
    } finally {
      setSaving(false);
    }
  }, [form, editingId, createCategory, updateCategory]);

  // ── Delete ─────────────────────────────────────────────────────────────────

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        const result = await deleteCategory(id);
        setDeleteMessage(result.message);
        setTimeout(() => setDeleteMessage(null), 4000);
      } catch (err) {
        setDeleteMessage(err instanceof Error ? err.message : t('setup.customCategories.errors.deleteFailed'));
      }
    },
    [deleteCategory]
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Tag className="size-5" />
          {t('setup.customCategories.title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className={cn("text-sm mb-4", colors.text.muted)}>
          {t('setup.customCategories.description')}
        </p>

        {deleteMessage && (
          <p className={cn("text-sm mb-3 p-2 bg-muted rounded-md", colors.text.muted)}>
            {deleteMessage}
          </p>
        )}

        {error && (
          <p className="text-sm text-destructive mb-3">{error}</p>
        )}

        {loading ? (
          <div className="flex justify-center py-4">
            <Spinner />
          </div>
        ) : (
          <section aria-label={t('setup.customCategories.listAriaLabel')}>
            {categories.length === 0 ? (
              <p className={cn("text-sm py-2", colors.text.muted)}>
                {t('setup.customCategories.empty')}
              </p>
            ) : (
              <ul className="space-y-2 mb-4" role="list">
                {categories.map((cat) => (
                  <li
                    key={cat.categoryId}
                    className="flex items-center justify-between rounded-md border p-3"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {cat.type === 'income' ? (
                        <TrendingUp className="size-4 text-green-600 shrink-0" aria-hidden />
                      ) : (
                        <TrendingDown className="size-4 text-red-500 shrink-0" aria-hidden />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{cat.label}</p>
                        <p className={cn("text-xs", colors.text.muted)}>{cat.mydataCode}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {!cat.isActive && (
                        <Badge variant="secondary" className="text-xs">
                          {t('setup.customCategories.inactive')}
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(cat)}
                        aria-label={t('setup.customCategories.editAriaLabel', { name: cat.label })}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(cat.categoryId)}
                        aria-label={t('setup.customCategories.deleteAriaLabel', { name: cat.label })}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <Separator className="my-3" />

        <Button variant="outline" size="sm" onClick={openCreate} className="gap-1">
          <Plus className="size-4" />
          {t('setup.customCategories.addNew')}
        </Button>
      </CardContent>

      {/* ── Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId
                ? t('setup.customCategories.editTitle')
                : t('setup.customCategories.createTitle')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {formError && (
              <p className="text-sm text-destructive">{formError}</p>
            )}

            {/* Τύπος */}
            {!editingId && (
              <div className="space-y-1.5">
                <Label>{t('setup.customCategories.form.type')}</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, type: v as 'income' | 'expense', mydataCode: '' }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">{t('setup.customCategories.types.income')}</SelectItem>
                    <SelectItem value="expense">{t('setup.customCategories.types.expense')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Label */}
            <div className="space-y-1.5">
              <Label htmlFor="cat-label">
                {t('setup.customCategories.form.label')}
                <span className="text-destructive ml-1" aria-hidden>*</span>
              </Label>
              <Input
                id="cat-label"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder={t('setup.customCategories.form.labelPlaceholder')}
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="cat-desc">
                {t('setup.customCategories.form.description')}
              </Label>
              <Input
                id="cat-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder={t('setup.customCategories.form.descriptionPlaceholder')}
              />
            </div>

            {/* myDATA Code — ΥΠΟΧΡΕΩΤΙΚΟ */}
            <div className="space-y-1.5">
              <Label htmlFor="cat-mydata">
                {t('setup.customCategories.form.mydataCode')}
                <span className="text-destructive ml-1" aria-hidden>*</span>
              </Label>
              <Select
                value={form.mydataCode}
                onValueChange={(v) => setForm((f) => ({ ...f, mydataCode: v }))}
              >
                <SelectTrigger id="cat-mydata">
                  <SelectValue placeholder={t('setup.customCategories.form.mydataCodePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {mydataCodes.map((code) => (
                    <SelectItem key={code} value={code}>
                      {t(`${mydataLabelPrefix}.${code}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* E3 Code */}
            <div className="space-y-1.5">
              <Label htmlFor="cat-e3">
                {t('setup.customCategories.form.e3Code')}
              </Label>
              <Input
                id="cat-e3"
                value={form.e3Code}
                onChange={(e) => setForm((f) => ({ ...f, e3Code: e.target.value }))}
                placeholder={t('setup.customCategories.form.e3CodePlaceholder')}
              />
            </div>

            {/* VAT Rate */}
            <div className="space-y-1.5">
              <Label htmlFor="cat-vat">
                {t('setup.customCategories.form.vatRate')}
              </Label>
              <Select
                value={String(form.defaultVatRate)}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, defaultVatRate: Number(v) }))
                }
              >
                <SelectTrigger id="cat-vat">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24">24%</SelectItem>
                  <SelectItem value="13">13%</SelectItem>
                  <SelectItem value="6">6%</SelectItem>
                  <SelectItem value="0">{t('setup.customCategories.vatOptions.exempt')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* VAT Deductibility */}
            <div className="space-y-1.5">
              <Label htmlFor="cat-deduct">
                {t('setup.customCategories.form.vatDeductible')}
              </Label>
              <Select
                value={String(form.vatDeductiblePercent)}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    vatDeductiblePercent: Number(v) as 0 | 50 | 100,
                  }))
                }
              >
                <SelectTrigger id="cat-deduct">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="100">{t('setup.customCategories.deductibleOptions.full')}</SelectItem>
                  <SelectItem value="50">{t('setup.customCategories.deductibleOptions.mixed')}</SelectItem>
                  <SelectItem value="0">{t('setup.customCategories.deductibleOptions.none')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t('setup.customCategories.cancel')}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Spinner className="mr-2 size-4" /> : null}
              {editingId ? t('setup.customCategories.save') : t('setup.customCategories.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
