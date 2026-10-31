/**
 * BOQPriceSourceField — «Από τιμοκατάλογο»: δέσιμο μίας γραμμής BOQ με εργασία του master (ADR-923 §5.11 «3ε»).
 *
 * Διαλέγεις εργασία ⇒ η φόρμα παίρνει τιμές και φύρα, και η γραμμή κρατά στιγμιότυπο + δεσμό με την έκδοση. Πληκτρολογείς
 * άλλη τιμή ⇒ ο δεσμός φεύγει, γιατί η τιμή δεν κληρονομείται πια. Νέα έκδοση ⇒ απόκλιση εδώ, ποτέ σιωπηλή αλλαγή.
 * Οι τιμές έρχονται μόνο από τον διακομιστή, με κριτή `catalog:pricing:view`· χωρίς δικαίωμα η οθόνη το λέει.
 *
 * @module components/building-management/tabs/MeasurementsTabContent/BOQPriceSourceField
 */

'use client';

import { useMemo } from 'react';
import { Unlink } from 'lucide-react';
import { useCatalogAccess, useLocalizedTextReader } from '@/components/catalog/shared/catalog-neutral-hooks';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useCostRateBook } from '@/hooks/catalog/usePriceListViews';
import { nowISO } from '@/lib/date-local';
import { formatCurrency } from '@/lib/intl-utils';
import { majorFromMinor } from '@/lib/money/money';
import { cn } from '@/lib/utils';
import { costRatesForLine, priceSourceOf } from '@/services/measurements/boq-price-source';
import { judgeCostDrift, type CostDrift } from '@/subapps/catalog/pricing/cost-rate';
import type { CostRate, CostRateBook } from '@/subapps/catalog/types/cost-rate';
import type { FieldsetCommon } from './BOQEditorFieldsets';
import type { EditorFormState } from './useBOQEditorState';

interface BOQPriceSourceFieldProps extends FieldsetCommon {
  form: EditorFormState;
  onUpdateField: <K extends keyof EditorFormState>(key: K, value: EditorFormState[K]) => void;
}

const rateLabel = (rate: CostRate, name: string): string => {
  const place = rate.region === null ? '' : ` · ${rate.region}`;
  const price = formatCurrency(majorFromMinor(rate.netPrice) / rate.priceQuantity);
  return `${rate.atoeCode}${place} — ${rate.breakdown.description ?? name} — ${price}`;
};

function driftMessage(drift: CostDrift, t: FieldsetCommon['t']): string | null {
  switch (drift.kind) {
    case 'current': return null;
    case 'listGone': return t('tabs.measurements.editor.priceSource.listGone');
    case 'lineGone': return t('tabs.measurements.editor.priceSource.lineGone');
    case 'unitChanged': return t('tabs.measurements.editor.priceSource.unitChanged');
    case 'changed': return t('tabs.measurements.editor.priceSource.changed', { version: drift.rate.versionNumber });
    case 'upcoming': return t('tabs.measurements.editor.priceSource.upcoming', { version: drift.rate.versionNumber });
  }
}

function LinkedSource({ form, book, onUpdateField, colors, t }: BOQPriceSourceFieldProps & { book: CostRateBook | null }) {
  const source = form.priceSource;
  if (source === null) return null;
  const notice = book === null ? null : driftMessage(judgeCostDrift(source, book), t);
  return (
    <section className="flex flex-wrap items-center gap-2 text-xs">
      <p className={cn('m-0 flex-1', colors.text.muted)}>{t('tabs.measurements.editor.priceSource.linked', { version: source.versionNumber })}</p>
      {notice ? <p className="m-0 basis-full" role="status">{notice}</p> : null}
      <Button type="button" variant="ghost" size="sm" onClick={() => onUpdateField('priceSource', null)}>
        <Unlink className="mr-1 h-3.5 w-3.5" aria-hidden />{t('tabs.measurements.editor.priceSource.detach')}
      </Button>
    </section>
  );
}

export function BOQPriceSourceField(props: BOQPriceSourceFieldProps) {
  const { form, onUpdateField, colors, t } = props;
  const { user } = useAuth();
  const { i18n } = useTranslation('building-tabs');
  const { text } = useLocalizedTextReader(i18n.language);
  const access = useCatalogAccess('pricingView');
  const api = useCostRateBook(access === 'granted' && form.projectId !== '' ? form.projectId : null);
  const book = api.current.state === 'ready' ? api.current.view : null;
  const categoryCode = form.subCategoryCode || form.categoryCode;
  const rates = useMemo(() => costRatesForLine(book?.current ?? [], { categoryCode, unit: form.unit }), [book, categoryCode, form.unit]);
  if (access !== 'granted') return <p className={cn('m-0 text-xs', colors.text.muted)}>{t('tabs.measurements.editor.priceSource.noAccess')}</p>;
  const pick = (lineId: string) => {
    const rate = rates.find((candidate) => candidate.lineId === lineId);
    if (rate) onUpdateField('priceSource', priceSourceOf(rate, form.unit, { appliedAt: nowISO(), appliedBy: user?.uid ?? '' }));
  };
  return (
    <section className="space-y-1.5">
      <Label>{t('tabs.measurements.editor.priceSource.label')}</Label>
      <Select value={form.priceSource?.lineId} onValueChange={pick} disabled={form.status !== 'draft' || rates.length === 0}>
        <SelectTrigger><SelectValue placeholder={t(rates.length === 0 ? 'tabs.measurements.editor.priceSource.empty' : 'tabs.measurements.editor.priceSource.placeholder')} /></SelectTrigger>
        <SelectContent>
          {rates.map((rate) => <SelectItem key={rate.lineId} value={rate.lineId}>{rateLabel(rate, text(rate.priceListLabels, rate.priceListCode))}</SelectItem>)}
        </SelectContent>
      </Select>
      <LinkedSource {...props} book={book} />
    </section>
  );
}
