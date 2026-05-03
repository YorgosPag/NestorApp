'use client';

import { useState, useEffect, useMemo } from 'react';
import { X, Plus } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
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
import { ATOE_MASTER_CATEGORIES } from '@/config/boq-categories';
import { usePOSupplierContacts } from '@/hooks/procurement/usePOSupplierContacts';
import { getContactDisplayName } from '@/types/contacts/helpers';
import {
  MAX_PREFERRED_SUPPLIERS,
  type Material,
  type CreateMaterialDTO,
  type UpdateMaterialDTO,
} from '@/subapps/procurement/types/material';
import type { BOQMeasurementUnit } from '@/types/boq';

const BOQ_UNITS: BOQMeasurementUnit[] = [
  'm', 'm2', 'm3', 'kg', 'ton', 'pcs', 'lt', 'set', 'hr', 'day', 'lump',
];

interface MaterialFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: Material | null;                                  // null = create, Material = edit
  onSubmit: (
    payload: CreateMaterialDTO | UpdateMaterialDTO,
    materialId?: string,
  ) => Promise<void>;
}

interface FormState {
  code: string;
  name: string;
  unit: BOQMeasurementUnit;
  atoeCategoryCode: string;
  description: string;
  preferredSupplierContactIds: string[];
  avgPrice: string;
  lastPrice: string;
  lastPurchaseDate: string;
}

function emptyState(): FormState {
  return {
    code: '',
    name: '',
    unit: 'pcs',
    atoeCategoryCode: 'OIK-1',
    description: '',
    preferredSupplierContactIds: [],
    avgPrice: '',
    lastPrice: '',
    lastPurchaseDate: '',
  };
}

function fromMaterial(m: Material): FormState {
  return {
    code: m.code,
    name: m.name,
    unit: m.unit,
    atoeCategoryCode: m.atoeCategoryCode,
    description: m.description ?? '',
    preferredSupplierContactIds: [...m.preferredSupplierContactIds],
    avgPrice: m.avgPrice !== null ? String(m.avgPrice) : '',
    lastPrice: m.lastPrice !== null ? String(m.lastPrice) : '',
    lastPurchaseDate: m.lastPurchaseDate
      ? toIsoDateInput(m.lastPurchaseDate)
      : '',
  };
}

function toIsoDateInput(ts: { seconds?: number } | null): string {
  if (!ts || typeof ts.seconds !== 'number') return '';
  return new Date(ts.seconds * 1000).toISOString().slice(0, 10);
}

export function MaterialFormDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
}: MaterialFormDialogProps) {
  const { t } = useTranslation('procurement');
  const { suppliers } = usePOSupplierContacts();

  const [form, setForm] = useState<FormState>(emptyState());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supplierPick, setSupplierPick] = useState<string>('');

  useEffect(() => {
    if (open) {
      setForm(initial ? fromMaterial(initial) : emptyState());
      setError(null);
      setSupplierPick('');
    }
  }, [open, initial]);

  const supplierOptions = useMemo<ComboboxOption[]>(
    () =>
      suppliers
        .filter((c): c is typeof c & { id: string } => typeof c.id === 'string')
        .filter((c) => !form.preferredSupplierContactIds.includes(c.id))
        .map((c) => ({
          value: c.id,
          label: getContactDisplayName(c),
        })),
    [suppliers, form.preferredSupplierContactIds],
  );

  const supplierNameById = useMemo(() => {
    const map = new Map<string, string>();
    suppliers.forEach((c) => {
      if (c.id) map.set(c.id, getContactDisplayName(c));
    });
    return map;
  }, [suppliers]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function addSupplier(id: string) {
    if (!id) return;
    if (form.preferredSupplierContactIds.length >= MAX_PREFERRED_SUPPLIERS) return;
    if (form.preferredSupplierContactIds.includes(id)) return;
    update('preferredSupplierContactIds', [
      ...form.preferredSupplierContactIds,
      id,
    ]);
    setSupplierPick('');
  }

  function removeSupplier(id: string) {
    update(
      'preferredSupplierContactIds',
      form.preferredSupplierContactIds.filter((s) => s !== id),
    );
  }

  function buildPayload(): CreateMaterialDTO | UpdateMaterialDTO {
    const numOrNull = (s: string): number | null => {
      const trimmed = s.trim();
      if (!trimmed) return null;
      const n = Number(trimmed);
      return Number.isFinite(n) ? n : null;
    };

    return {
      code: form.code.trim(),
      name: form.name.trim(),
      unit: form.unit,
      atoeCategoryCode: form.atoeCategoryCode,
      description: form.description.trim() || null,
      preferredSupplierContactIds: form.preferredSupplierContactIds,
      avgPrice: numOrNull(form.avgPrice),
      lastPrice: numOrNull(form.lastPrice),
      lastPurchaseDate: form.lastPurchaseDate || null,
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload = buildPayload();
      await onSubmit(payload, initial?.id);
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  const isEdit = initial !== null;
  const reachedSupplierCap =
    form.preferredSupplierContactIds.length >= MAX_PREFERRED_SUPPLIERS;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? t('hub.materialCatalog.form.editTitle')
              : t('hub.materialCatalog.form.createTitle')}
          </DialogTitle>
          <DialogDescription>
            {t('hub.materialCatalog.form.description')}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 max-h-[70vh] overflow-y-auto pr-2"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="material-code">
                {t('hub.materialCatalog.form.code')} *
              </Label>
              <Input
                id="material-code"
                value={form.code}
                onChange={(e) => update('code', e.target.value)}
                placeholder={t('hub.materialCatalog.form.codePlaceholder')}
                maxLength={50}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="material-unit">
                {t('hub.materialCatalog.form.unit')} *
              </Label>
              <Select
                value={form.unit}
                onValueChange={(v) => update('unit', v as BOQMeasurementUnit)}
              >
                <SelectTrigger id="material-unit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BOQ_UNITS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {t(`hub.materialCatalog.units.${u}`, { defaultValue: '' }) || u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="material-name">
              {t('hub.materialCatalog.form.name')} *
            </Label>
            <Input
              id="material-name"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              placeholder={t('hub.materialCatalog.form.namePlaceholder')}
              maxLength={200}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="material-atoe">
              {t('hub.materialCatalog.form.atoeCategory')} *
            </Label>
            <Select
              value={form.atoeCategoryCode}
              onValueChange={(v) => update('atoeCategoryCode', v)}
            >
              <SelectTrigger id="material-atoe">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ATOE_MASTER_CATEGORIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    <span className="font-mono text-xs mr-2">{c.code}</span>
                    {t(`categories.${c.code}`, { defaultValue: '' }) || c.nameEL}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="material-desc">
              {t('hub.materialCatalog.form.descriptionField')}
            </Label>
            <Textarea
              id="material-desc"
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              placeholder={t('hub.materialCatalog.form.descriptionPlaceholder')}
              maxLength={2000}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="material-last-price">
                {t('hub.materialCatalog.lastPrice')}
              </Label>
              <Input
                id="material-last-price"
                type="number"
                min="0"
                step="0.01"
                value={form.lastPrice}
                onChange={(e) => update('lastPrice', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="material-avg-price">
                {t('hub.materialCatalog.avgPrice')}
              </Label>
              <Input
                id="material-avg-price"
                type="number"
                min="0"
                step="0.01"
                value={form.avgPrice}
                onChange={(e) => update('avgPrice', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="material-last-purchase">
                {t('hub.materialCatalog.form.lastPurchaseDate')}
              </Label>
              <Input
                id="material-last-purchase"
                type="date"
                value={form.lastPurchaseDate}
                onChange={(e) => update('lastPurchaseDate', e.target.value)}
              />
            </div>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">
              {t('hub.materialCatalog.form.preferredSuppliers')}{' '}
              <span className="text-xs text-muted-foreground font-normal">
                ({form.preferredSupplierContactIds.length}/{MAX_PREFERRED_SUPPLIERS})
              </span>
            </legend>

            {form.preferredSupplierContactIds.length > 0 && (
              <ul className="flex flex-wrap gap-1.5">
                {form.preferredSupplierContactIds.map((id) => (
                  <li key={id}>
                    <Badge variant="secondary" className="gap-1 pr-1">
                      {supplierNameById.get(id) ?? id}
                      <button
                        type="button"
                        onClick={() => removeSupplier(id)}
                        className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-destructive/20"
                        aria-label={t('hub.materialCatalog.form.removeSupplier')}
                      >
                        <X className="h-3 w-3" aria-hidden />
                      </button>
                    </Badge>
                  </li>
                ))}
              </ul>
            )}

            {!reachedSupplierCap && (
              <div className="flex gap-2 items-stretch">
                <div className="flex-1">
                  <SearchableCombobox
                    value={supplierPick}
                    onValueChange={(v) => setSupplierPick(v)}
                    options={supplierOptions}
                    placeholder={t('hub.materialCatalog.form.addSupplierPlaceholder')}
                    emptyMessage={t('hub.materialCatalog.form.noSupplier')}
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => addSupplier(supplierPick)}
                  disabled={!supplierPick}
                >
                  <Plus className="h-4 w-4 mr-1" aria-hidden />
                  {t('hub.materialCatalog.form.addSupplier')}
                </Button>
              </div>
            )}
          </fieldset>

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
            {t('hub.materialCatalog.form.cancel')}
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={submitting || !form.code.trim() || !form.name.trim()}
          >
            {submitting
              ? t('hub.materialCatalog.form.saving')
              : isEdit
                ? t('hub.materialCatalog.form.save')
                : t('hub.materialCatalog.form.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
