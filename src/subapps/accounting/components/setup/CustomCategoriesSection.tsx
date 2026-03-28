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
import { useTranslation } from 'react-i18next';
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

const MYDATA_INCOME_OPTIONS: Array<{ value: MyDataIncomeType; label: string }> = [
  { value: 'category1_1', label: 'category1_1 — Πώληση αγαθών' },
  { value: 'category1_3', label: 'category1_3 — Παροχή υπηρεσιών' },
  { value: 'category1_4', label: 'category1_4 — Πώληση παγίων' },
  { value: 'category1_5', label: 'category1_5 — Λοιπά έσοδα' },
];

const MYDATA_EXPENSE_OPTIONS: Array<{ value: MyDataExpenseType; label: string }> = [
  { value: 'category2_2', label: 'category2_2 — Αγορές Α\' υλών' },
  { value: 'category2_3', label: 'category2_3 — Λήψη υπηρεσιών' },
  { value: 'category2_4', label: 'category2_4 — Γενικά έξοδα' },
  { value: 'category2_5', label: 'category2_5 — Λοιπά έξοδα' },
  { value: 'category2_6', label: 'category2_6 — Αμοιβές προσωπικού' },
  { value: 'category2_7', label: 'category2_7 — Αγορές παγίων' },
  { value: 'category2_11', label: 'category2_11 — Αποσβέσεις' },
  { value: 'category2_12', label: 'category2_12 — Λοιπές εκπιπτόμενες δαπάνες' },
  { value: 'category2_14', label: 'category2_14 — Πληροφοριακά' },
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
  const { t } = useTranslation('accounting');
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

  const mydataOptions =
    form.type === 'income' ? MYDATA_INCOME_OPTIONS : MYDATA_EXPENSE_OPTIONS;

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
      setFormError('Το όνομα κατηγορίας είναι υποχρεωτικό');
      return;
    }
    if (!form.mydataCode) {
      setFormError('Ο κωδικός myDATA είναι υποχρεωτικός');
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
      setFormError(err instanceof Error ? err.message : 'Αποτυχία αποθήκευσης');
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
        setDeleteMessage(err instanceof Error ? err.message : 'Αποτυχία διαγραφής');
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
          {t('setup.customCategories.title', 'Προσαρμοσμένες Κατηγορίες')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className={cn("text-sm mb-4", colors.text.muted)}>
          {t(
            'setup.customCategories.description',
            'Δημιουργήστε εξειδικευμένες κατηγορίες εσόδων/εξόδων για αναλυτικότερη παρακολούθηση.'
          )}
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
          <section aria-label="Λίστα custom κατηγοριών">
            {categories.length === 0 ? (
              <p className={cn("text-sm py-2", colors.text.muted)}>
                {t('setup.customCategories.empty', 'Δεν υπάρχουν custom κατηγορίες ακόμη.')}
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
                          {t('setup.customCategories.inactive', 'Ανενεργή')}
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(cat)}
                        aria-label={`Επεξεργασία ${cat.label}`}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(cat.categoryId)}
                        aria-label={`Διαγραφή ${cat.label}`}
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
          {t('setup.customCategories.addNew', 'Νέα Κατηγορία')}
        </Button>
      </CardContent>

      {/* ── Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId
                ? t('setup.customCategories.editTitle', 'Επεξεργασία Κατηγορίας')
                : t('setup.customCategories.createTitle', 'Νέα Κατηγορία')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {formError && (
              <p className="text-sm text-destructive">{formError}</p>
            )}

            {/* Τύπος */}
            {!editingId && (
              <div className="space-y-1.5">
                <Label>{t('setup.customCategories.form.type', 'Τύπος')}</Label>
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
                    <SelectItem value="income">Έσοδο</SelectItem>
                    <SelectItem value="expense">Έξοδο</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Label */}
            <div className="space-y-1.5">
              <Label htmlFor="cat-label">
                {t('setup.customCategories.form.label', 'Όνομα κατηγορίας')}
                <span className="text-destructive ml-1" aria-hidden>*</span>
              </Label>
              <Input
                id="cat-label"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="π.χ. Υπεργολαβίες Σιδηρού"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="cat-desc">
                {t('setup.customCategories.form.description', 'Περιγραφή')}
              </Label>
              <Input
                id="cat-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="π.χ. Υπεργολαβίες σιδηρού για εργοτάξια"
              />
            </div>

            {/* myDATA Code — ΥΠΟΧΡΕΩΤΙΚΟ */}
            <div className="space-y-1.5">
              <Label htmlFor="cat-mydata">
                {t('setup.customCategories.form.mydataCode', 'Κωδικός myDATA (ΑΑΔΕ)')}
                <span className="text-destructive ml-1" aria-hidden>*</span>
              </Label>
              <Select
                value={form.mydataCode}
                onValueChange={(v) => setForm((f) => ({ ...f, mydataCode: v }))}
              >
                <SelectTrigger id="cat-mydata">
                  <SelectValue placeholder="Επιλέξτε κωδικό myDATA" />
                </SelectTrigger>
                <SelectContent>
                  {mydataOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* E3 Code */}
            <div className="space-y-1.5">
              <Label htmlFor="cat-e3">
                {t('setup.customCategories.form.e3Code', 'Κωδικός Ε3')}
              </Label>
              <Input
                id="cat-e3"
                value={form.e3Code}
                onChange={(e) => setForm((f) => ({ ...f, e3Code: e.target.value }))}
                placeholder="π.χ. 585_001"
              />
            </div>

            {/* VAT Rate */}
            <div className="space-y-1.5">
              <Label htmlFor="cat-vat">
                {t('setup.customCategories.form.vatRate', 'Συντελεστής ΦΠΑ')}
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
                  <SelectItem value="0">0% (Απαλλαγή)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* VAT Deductibility */}
            <div className="space-y-1.5">
              <Label htmlFor="cat-deduct">
                {t('setup.customCategories.form.vatDeductible', 'Εκπτωσιμότητα ΦΠΑ')}
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
                  <SelectItem value="100">100% — Πλήρης έκπτωση</SelectItem>
                  <SelectItem value="50">50% — Μικτή χρήση</SelectItem>
                  <SelectItem value="0">0% — Δεν εκπίπτει</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Ακύρωση
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Spinner className="mr-2 size-4" /> : null}
              {editingId ? 'Αποθήκευση' : 'Δημιουργία'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
