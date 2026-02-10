/**
 * @fileoverview Journal Entry Form — Φόρμα δημιουργίας/επεξεργασίας εγγραφής Ε-Ε
 * @description Φόρμα με auto-calculate VAT, submit σε POST /api/accounting/journal-entries
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-09
 * @version 1.0.0
 * @see ADR-ACC-001 Chart of Accounts
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles
 */

'use client';

import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { useAuth } from '@/hooks/useAuth';
import { VATRateSelector } from '../shared/VATRateSelector';
import { PaymentMethodSelector } from '../shared/PaymentMethodSelector';
import { ExpenseCategoryPicker } from '../shared/ExpenseCategoryPicker';
import type {
  EntryType,
  AccountCategory,
  PaymentMethod,
  FiscalQuarter,
  CreateJournalEntryInput,
} from '@/subapps/accounting/types';
import { getCategoryByCode } from '../../config/account-categories';
import { formatCurrency } from '../../utils/format';
import { formatCurrency } from '../../utils/format';

// ============================================================================
// TYPES
// ============================================================================

interface JournalEntryFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

interface JournalEntryFormState {
  date: string;
  type: EntryType;
  category: AccountCategory;
  description: string;
  netAmount: string;
  vatRate: number;
  paymentMethod: PaymentMethod;
  contactName: string;
  notes: string;
}

// ============================================================================
// HELPERS
// ============================================================================

function getQuarterFromDate(dateStr: string): FiscalQuarter {
  const month = new Date(dateStr).getMonth() + 1;
  if (month <= 3) return 1;
  if (month <= 6) return 2;
  if (month <= 9) return 3;
  return 4;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function JournalEntryForm({ onSuccess, onCancel }: JournalEntryFormProps) {
  const { t } = useTranslation('accounting');
  const { user } = useAuth();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<JournalEntryFormState>({
    date: new Date().toISOString().split('T')[0],
    type: 'income',
    category: 'service_income',
    description: '',
    netAmount: '',
    vatRate: 24,
    paymentMethod: 'bank_transfer',
    contactName: '',
    notes: '',
  });

  const updateField = useCallback(<K extends keyof JournalEntryFormState>(
    key: K,
    value: JournalEntryFormState[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Auto-calculate VAT and Gross from net + rate
  const calculations = useMemo(() => {
    const net = parseFloat(form.netAmount) || 0;
    const vatAmount = Math.round(net * (form.vatRate / 100) * 100) / 100;
    const grossAmount = Math.round((net + vatAmount) * 100) / 100;
    return { netAmount: net, vatAmount, grossAmount };
  }, [form.netAmount, form.vatRate]);

  const handleTypeChange = useCallback((newType: EntryType) => {
    const defaultCategory: AccountCategory = newType === 'income' ? 'service_income' : 'third_party_fees';
    setForm((prev) => ({ ...prev, type: newType, category: defaultCategory }));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!user) return;

    // Validation
    if (!form.description.trim()) {
      setError(t('forms.validation.required'));
      return;
    }
    if (calculations.netAmount <= 0) {
      setError(t('forms.validation.positiveNumber'));
      return;
    }
    if (form.paymentMethod === 'cash' && calculations.grossAmount > 500) {
      setError(t('forms.validation.cashLimit'));
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const token = await user.getIdToken();
      const categoryDef = getCategoryByCode(form.category);
      const quarter = getQuarterFromDate(form.date);
      const fiscalYear = new Date(form.date).getFullYear();

      const body: CreateJournalEntryInput = {
        date: form.date,
        type: form.type,
        category: form.category,
        description: form.description.trim(),
        netAmount: calculations.netAmount,
        vatRate: form.vatRate,
        vatAmount: calculations.vatAmount,
        grossAmount: calculations.grossAmount,
        vatDeductible: categoryDef?.vatDeductible ?? false,
        paymentMethod: form.paymentMethod,
        contactId: null,
        contactName: form.contactName.trim() || null,
        invoiceId: null,
        mydataCode: categoryDef?.mydataCode ?? 'category1_3',
        e3Code: categoryDef?.e3Code ?? '',
        fiscalYear,
        quarter,
        notes: form.notes.trim() || null,
      };

      const res = await fetch('/api/accounting/journal', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errJson: { error?: string } | null = await res.json().catch(() => null);
        throw new Error(errJson?.error ?? `HTTP ${res.status}`);
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  }, [user, form, calculations, t, onSuccess]);

  return (
    <section className="space-y-6" aria-label={t('journal.newEntry')}>
      {/* Type, Date & Category */}
      <Card>
        <CardHeader>
          <CardTitle>{t('journal.newEntry')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <fieldset>
              <Label htmlFor="entryType">{t('journal.type')}</Label>
              <Select
                value={form.type}
                onValueChange={(v) => handleTypeChange(v as EntryType)}
              >
                <SelectTrigger id="entryType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">{t('journal.income')}</SelectItem>
                  <SelectItem value="expense">{t('journal.expense')}</SelectItem>
                </SelectContent>
              </Select>
            </fieldset>

            <fieldset>
              <Label htmlFor="entryDate">{t('journal.date')}</Label>
              <Input
                id="entryDate"
                type="date"
                value={form.date}
                onChange={(e) => updateField('date', e.target.value)}
              />
            </fieldset>

            <fieldset>
              <Label>{t('journal.category')}</Label>
              <ExpenseCategoryPicker
                value={form.category}
                onValueChange={(cat) => updateField('category', cat)}
                type={form.type}
              />
            </fieldset>
          </div>
        </CardContent>
      </Card>

      {/* Description & Contact */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <fieldset>
              <Label htmlFor="description">{t('journal.description_label')}</Label>
              <Input
                id="description"
                value={form.description}
                onChange={(e) => updateField('description', e.target.value)}
                placeholder={t('journal.description_label')}
              />
            </fieldset>

            <fieldset>
              <Label htmlFor="contactName">{t('journal.contact')}</Label>
              <Input
                id="contactName"
                value={form.contactName}
                onChange={(e) => updateField('contactName', e.target.value)}
                placeholder={t('journal.contact')}
              />
            </fieldset>
          </div>
        </CardContent>
      </Card>

      {/* Amounts & VAT */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <fieldset>
              <Label htmlFor="netAmount">{t('journal.netAmount')}</Label>
              <Input
                id="netAmount"
                type="number"
                min="0"
                step="0.01"
                value={form.netAmount}
                onChange={(e) => updateField('netAmount', e.target.value)}
                placeholder="0.00"
              />
            </fieldset>

            <fieldset>
              <Label>{t('journal.vatRate')}</Label>
              <VATRateSelector
                value={form.vatRate}
                onValueChange={(rate) => updateField('vatRate', rate)}
              />
            </fieldset>

            <fieldset>
              <Label>{t('journal.paymentMethod')}</Label>
              <PaymentMethodSelector
                value={form.paymentMethod}
                onValueChange={(method) => updateField('paymentMethod', method)}
              />
            </fieldset>
          </div>

          <Separator className="my-4" />

          {/* Auto-calculated totals */}
          <dl className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground">{t('journal.vatAmount')}</dt>
              <dd className="text-lg font-semibold">{formatCurrency(calculations.vatAmount)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('journal.grossAmount')}</dt>
              <dd className="text-lg font-bold">{formatCurrency(calculations.grossAmount)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardContent className="pt-6">
          <fieldset>
            <Label htmlFor="entryNotes">{t('forms.notes')}</Label>
            <Textarea
              id="entryNotes"
              value={form.notes}
              onChange={(e) => updateField('notes', e.target.value)}
              rows={3}
              className="mt-1"
            />
          </fieldset>
        </CardContent>
      </Card>

      {/* Error + Actions */}
      {error && (
        <p className="text-sm text-destructive" role="alert">{error}</p>
      )}

      <footer className="flex justify-end gap-3">
        <Button variant="outline" onClick={onCancel} disabled={submitting}>
          {t('forms.cancel')}
        </Button>
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? <Spinner size="small" className="mr-2" /> : null}
          {t('forms.create')}
        </Button>
      </footer>
    </section>
  );
}
