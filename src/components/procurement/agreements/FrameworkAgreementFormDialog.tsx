'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { SearchableCombobox } from '@/components/ui/searchable-combobox';
import type { ComboboxOption } from '@/components/ui/searchable-combobox-types';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { usePOSupplierContacts } from '@/hooks/procurement/usePOSupplierContacts';
import { getContactDisplayName } from '@/types/contacts/helpers';
import { nowISO } from '@/lib/date-local';
import { BreakpointsEditor } from './BreakpointsEditor';
import {
  FRAMEWORK_AGREEMENT_STATUSES,
  DISCOUNT_TYPES,
  type FrameworkAgreement,
  type CreateFrameworkAgreementDTO,
  type UpdateFrameworkAgreementDTO,
  type FrameworkAgreementStatus,
  type DiscountType,
  type VolumeBreakpoint,
} from '@/subapps/procurement/types/framework-agreement';

interface FormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: FrameworkAgreement | null;
  onSubmit: (
    payload: CreateFrameworkAgreementDTO | UpdateFrameworkAgreementDTO,
    agreementId?: string,
  ) => Promise<void>;
}

interface FormState {
  agreementNumber: string;
  title: string;
  description: string;
  vendorContactId: string;
  status: FrameworkAgreementStatus;
  validFrom: string;
  validUntil: string;
  totalCommitment: string;
  currency: string;
  discountType: DiscountType;
  flatDiscountPercent: string;
  volumeBreakpoints: VolumeBreakpoint[];
}

function emptyState(): FormState {
  const today = nowISO().slice(0, 10);
  const yearLater = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  return {
    agreementNumber: '',
    title: '',
    description: '',
    vendorContactId: '',
    status: 'draft',
    validFrom: today,
    validUntil: yearLater,
    totalCommitment: '',
    currency: 'EUR',
    discountType: 'flat',
    flatDiscountPercent: '',
    volumeBreakpoints: [],
  };
}

function tsToIso(ts: { seconds?: number } | null): string {
  if (!ts || typeof ts.seconds !== 'number') return '';
  return new Date(ts.seconds * 1000).toISOString().slice(0, 10);
}

function fromAgreement(a: FrameworkAgreement): FormState {
  return {
    agreementNumber: a.agreementNumber,
    title: a.title,
    description: a.description ?? '',
    vendorContactId: a.vendorContactId,
    status: a.status,
    validFrom: tsToIso(a.validFrom as unknown as { seconds?: number }),
    validUntil: tsToIso(a.validUntil as unknown as { seconds?: number }),
    totalCommitment: a.totalCommitment !== null ? String(a.totalCommitment) : '',
    currency: a.currency,
    discountType: a.discountType,
    flatDiscountPercent:
      a.flatDiscountPercent !== null ? String(a.flatDiscountPercent) : '',
    volumeBreakpoints: [...a.volumeBreakpoints],
  };
}

function numOrNull(s: string): number | null {
  const trimmed = s.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

export function FrameworkAgreementFormDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
}: FormDialogProps) {
  const { t } = useTranslation('procurement');
  const { suppliers } = usePOSupplierContacts();

  const [form, setForm] = useState<FormState>(emptyState());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(initial ? fromAgreement(initial) : emptyState());
      setError(null);
    }
  }, [open, initial]);

  const supplierOptions = useMemo<ComboboxOption[]>(
    () =>
      suppliers
        .filter((c): c is typeof c & { id: string } => typeof c.id === 'string')
        .map((c) => ({
          value: c.id,
          label: getContactDisplayName(c),
        })),
    [suppliers],
  );

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function buildPayload(): CreateFrameworkAgreementDTO | UpdateFrameworkAgreementDTO {
    return {
      agreementNumber: form.agreementNumber.trim(),
      title: form.title.trim(),
      description: form.description.trim() || null,
      vendorContactId: form.vendorContactId,
      status: form.status,
      validFrom: form.validFrom,
      validUntil: form.validUntil,
      currency: form.currency.trim() || 'EUR',
      totalCommitment: numOrNull(form.totalCommitment),
      discountType: form.discountType,
      flatDiscountPercent:
        form.discountType === 'flat' ? numOrNull(form.flatDiscountPercent) : null,
      volumeBreakpoints:
        form.discountType === 'volume_breakpoints' ? form.volumeBreakpoints : [],
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(buildPayload(), initial?.id);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  const isEdit = initial !== null;
  const canSubmit =
    !!form.agreementNumber.trim() &&
    !!form.title.trim() &&
    !!form.vendorContactId &&
    !!form.validFrom &&
    !!form.validUntil;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? t('hub.frameworkAgreements.form.editTitle')
              : t('hub.frameworkAgreements.form.createTitle')}
          </DialogTitle>
          <DialogDescription>
            {t('hub.frameworkAgreements.form.description')}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 max-h-[70vh] overflow-y-auto pr-2"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="fwa-number">
                {t('hub.frameworkAgreements.form.agreementNumber')} *
              </Label>
              <Input
                id="fwa-number"
                value={form.agreementNumber}
                onChange={(e) => update('agreementNumber', e.target.value)}
                placeholder="FWA-2026-001"
                maxLength={50}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fwa-status">
                {t('hub.frameworkAgreements.form.status')} *
              </Label>
              <Select
                value={form.status}
                onValueChange={(v) => update('status', v as FrameworkAgreementStatus)}
              >
                <SelectTrigger id="fwa-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FRAMEWORK_AGREEMENT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {t(`hub.frameworkAgreements.status.${s}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fwa-title">
              {t('hub.frameworkAgreements.form.title')} *
            </Label>
            <Input
              id="fwa-title"
              value={form.title}
              onChange={(e) => update('title', e.target.value)}
              maxLength={200}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fwa-vendor">
              {t('hub.frameworkAgreements.form.vendor')} *
            </Label>
            <SearchableCombobox
              value={form.vendorContactId}
              onValueChange={(v) => update('vendorContactId', v)}
              options={supplierOptions}
              placeholder={t('hub.frameworkAgreements.form.vendorPlaceholder')}
              emptyMessage={t('hub.frameworkAgreements.form.noVendor')}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fwa-desc">
              {t('hub.frameworkAgreements.form.descriptionField')}
            </Label>
            <Textarea
              id="fwa-desc"
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              maxLength={2000}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="fwa-from">
                {t('hub.frameworkAgreements.form.validFrom')} *
              </Label>
              <Input
                id="fwa-from"
                type="date"
                value={form.validFrom}
                onChange={(e) => update('validFrom', e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fwa-until">
                {t('hub.frameworkAgreements.form.validUntil')} *
              </Label>
              <Input
                id="fwa-until"
                type="date"
                value={form.validUntil}
                onChange={(e) => update('validUntil', e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="fwa-commitment">
                {t('hub.frameworkAgreements.form.totalCommitment')}
              </Label>
              <Input
                id="fwa-commitment"
                type="number"
                min="0"
                step="0.01"
                value={form.totalCommitment}
                onChange={(e) => update('totalCommitment', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fwa-currency">
                {t('hub.frameworkAgreements.form.currency')}
              </Label>
              <Input
                id="fwa-currency"
                value={form.currency}
                onChange={(e) => update('currency', e.target.value)}
                maxLength={8}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fwa-discount-type">
              {t('hub.frameworkAgreements.form.discountType')} *
            </Label>
            <Select
              value={form.discountType}
              onValueChange={(v) => update('discountType', v as DiscountType)}
            >
              <SelectTrigger id="fwa-discount-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DISCOUNT_TYPES.map((d) => (
                  <SelectItem key={d} value={d}>
                    {t(`hub.frameworkAgreements.discount.type.${d}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {form.discountType === 'flat' && (
            <div className="space-y-1.5">
              <Label htmlFor="fwa-flat-percent">
                {t('hub.frameworkAgreements.form.flatDiscountPercent')}
              </Label>
              <Input
                id="fwa-flat-percent"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={form.flatDiscountPercent}
                onChange={(e) => update('flatDiscountPercent', e.target.value)}
              />
            </div>
          )}

          {form.discountType === 'volume_breakpoints' && (
            <BreakpointsEditor
              breakpoints={form.volumeBreakpoints}
              onChange={(next) => update('volumeBreakpoints', next)}
            />
          )}

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            {t('hub.frameworkAgreements.form.cancel')}
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={submitting || !canSubmit}
          >
            {submitting
              ? t('hub.frameworkAgreements.form.saving')
              : isEdit
                ? t('hub.frameworkAgreements.form.save')
                : t('hub.frameworkAgreements.form.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
