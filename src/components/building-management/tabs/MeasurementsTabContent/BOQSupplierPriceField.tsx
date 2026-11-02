/**
 * BOQSupplierPriceField — «Από προμηθευτή»: SKU ξένου καταλόγου σε γραμμή BOQ (ADR-923 §5.12 τμήμα 4).
 *
 * Προμηθευτής → SKU → τιμή → ρητή εφαρμογή. Η εφαρμογή γίνεται στον διακομιστή και **ισχύει αμέσως**, ανεξάρτητα από το «Αποθήκευση»
 * της φόρμας, γιατί κανένας πελάτης δεν γράφει ποτέ αυτόν τον δεσμό. Η φόρμα παίρνει το στιγμιότυπο που γράφτηκε.
 * Χωρίς ενεργό προμηθευτή δεν εμφανίζεται τίποτα. `unavailable` δεν λέει ποτέ λόγο (Σ7).
 *
 * @module components/building-management/tabs/MeasurementsTabContent/BOQSupplierPriceField
 */

'use client';

import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useBuyerSupplyView } from '@/hooks/catalog/useSupplyViews';
import { formatCurrency, formatNumber } from '@/lib/intl-utils';
import { cn } from '@/lib/utils';
import { foreignUnitPrice, supplierPickerGate } from '@/services/measurements/boq-supplier-review';
import type { ForeignPrice } from '@/subapps/catalog/pricing/foreign-quote';
import { foreignSkuRowText, type ForeignSkuRow } from '@/subapps/catalog/pricing/foreign-sku-search';
import type { BOQItem, BoqSupplierPriceSource } from '@/types/boq';
import type { FieldsetCommon } from './BOQEditorFieldsets';
import type { EditorFormState } from './useBOQEditorState';
import { useSupplierPricePicker } from './useSupplierPricePicker';

const KEY = 'tabs.measurements.editor.priceSource.supplier';

interface BOQSupplierPriceFieldProps extends FieldsetCommon {
  form: EditorFormState;
  item: BOQItem | null;
  onApplied: (source: BoqSupplierPriceSource) => void;
}

function SkuResults({ rows, onChoose, colors, t }: FieldsetCommon & { rows: readonly ForeignSkuRow[]; onChoose: (row: ForeignSkuRow) => void }) {
  if (rows.length === 0) return <p className={cn('m-0 text-xs', colors.text.muted)}>{t(`${KEY}.noResults`)}</p>;
  return (
    <ul className="m-0 max-h-48 list-none space-y-0.5 overflow-y-auto p-0">
      {rows.map((row) => (
        <li key={row.variantId}>
          <Button type="button" variant="ghost" size="sm" className="h-auto w-full justify-between whitespace-normal text-left" onClick={() => onChoose(row)}>
            <span>{foreignSkuRowText(row)}</span>
            {row.priced ? null : <span className={cn('shrink-0 text-xs', colors.text.muted)}>{t(`${KEY}.onRequest`)}</span>}
          </Button>
        </li>
      ))}
    </ul>
  );
}

function PriceOffer({ price, unit, busy, onApply, t }: Pick<FieldsetCommon, 't'> & { price: ForeignPrice; unit: string; busy: boolean; onApply: () => void }) {
  const fits = price.unitCode === unit;
  return (
    <section className="flex flex-wrap items-center gap-2 text-xs">
      <p className="m-0 flex-1">
        {t(`${KEY}.offer`, { price: formatCurrency(foreignUnitPrice(price)), quantity: formatNumber(price.quantity, { maximumFractionDigits: 3 }) })}
      </p>
      {fits ? (
        <Button type="button" size="sm" disabled={busy} onClick={onApply}>{t(`${KEY}.apply`)}</Button>
      ) : (
        <p className="m-0 basis-full" role="status">{t(`${KEY}.notices.unitMismatch`)}</p>
      )}
    </section>
  );
}

function ActivePicker({ form, item, onApplied, relationships, colors, t }: BOQSupplierPriceFieldProps & { relationships: readonly { readonly id: string; readonly supplierName: string | null }[] }) {
  const { state, chooseSupplier, changeTerm, chooseSku, apply } = useSupplierPricePicker(item, onApplied);
  const common = { colors, t };
  return (
    <section className="space-y-1.5">
      <Label>{t(`${KEY}.label`)}</Label>
      <Select value={state.relationshipId} onValueChange={chooseSupplier}>
        <SelectTrigger><SelectValue placeholder={t(`${KEY}.pickSupplier`)} /></SelectTrigger>
        <SelectContent>
          {relationships.map((row) => <SelectItem key={row.id} value={row.id}>{row.supplierName ?? t(`${KEY}.unnamed`)}</SelectItem>)}
        </SelectContent>
      </Select>
      {state.relationshipId === undefined ? null : (
        <Input value={state.term} onChange={(event) => changeTerm(event.target.value)} placeholder={t(`${KEY}.searchPlaceholder`)} aria-label={t(`${KEY}.searchPlaceholder`)} />
      )}
      {state.rows !== null && state.selected === null ? <SkuResults {...common} rows={state.rows} onChoose={(row) => void chooseSku(row)} /> : null}
      {state.selected === null ? null : <p className="m-0 text-xs font-medium">{foreignSkuRowText(state.selected)}</p>}
      {state.price === null ? null : <PriceOffer price={state.price} unit={form.unit} busy={state.busy} onApply={() => void apply()} t={t} />}
      {state.notice === null ? null : <p className="m-0 text-xs" role="status">{t(`${KEY}.notices.${state.notice}`)}</p>}
      <p className={cn('m-0 text-xs', colors.text.muted)}>{t(`${KEY}.immediate`)}</p>
    </section>
  );
}

export function BOQSupplierPriceField(props: BOQSupplierPriceFieldProps) {
  const { form, item, colors, t } = props;
  const api = useBuyerSupplyView();
  const relationships = useMemo(
    () => (api.current.state === 'ready' ? api.current.view.relationships.filter((row) => row.state === 'active') : []),
    [api],
  );
  if (relationships.length === 0) return null;
  const gate = supplierPickerGate(item, form);
  if (gate !== 'ready') return <p className={cn('m-0 text-xs', colors.text.muted)}>{t(`${KEY}.gate.${gate}`)}</p>;
  return <ActivePicker {...props} relationships={relationships} />;
}
