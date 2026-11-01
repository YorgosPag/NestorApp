/**
 * BOQSupplierLinkedSource — η τιμή προμηθευτή μιας γραμμής στη φόρμα (ADR-923 §5.12 Δ9 · Σ7).
 *
 * Παλιό δίπλα σε νέο, ανανέωση **μόνο ρητή**, και πάνω από τον φράχτη με επιβεβαίωση. Μη διαθέσιμη πηγή ⇒ χωρίς λόγο, και το
 * στιγμιότυπο μένει. Η αποσύνδεση κρατά τις τιμές, όπως και στον τιμοκατάλογο.
 *
 * @module components/building-management/tabs/MeasurementsTabContent/BOQSupplierLinkedSource
 */

'use client';

import { useState } from 'react';
import { Unlink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { formatCurrency } from '@/lib/intl-utils';
import { cn } from '@/lib/utils';
import { applySupplierPriceToLine } from '@/services/catalog/supply-api.client';
import { unitCostsOf } from '@/services/measurements/boq-price-source';
import { foreignUnitPrice } from '@/services/measurements/boq-supplier-review';
import type { SupplierDrift } from '@/subapps/catalog/pricing/supplier-drift';
import type { BOQItem, BoqSupplierPriceSource } from '@/types/boq';
import type { FieldsetCommon } from './BOQEditorFieldsets';
import { signedPercent } from './BOQPriceReviewTable';
import { useSupplierDrift } from './useSupplierDrift';

const KEY = 'tabs.measurements.editor.priceSource.supplier';

interface BOQSupplierLinkedSourceProps extends FieldsetCommon {
  source: BoqSupplierPriceSource;
  item: BOQItem | null;
  onApplied: (source: BoqSupplierPriceSource) => void;
  onDetach: () => void;
}

type ChangedDrift = Extract<SupplierDrift, { kind: 'changed' }>;

interface RefreshProps extends Pick<FieldsetCommon, 't'> {
  source: BoqSupplierPriceSource;
  itemId: string;
  relationshipId: string;
  drift: ChangedDrift;
  onApplied: (source: BoqSupplierPriceSource) => void;
  onStale: () => void;
}

function RefreshOffer({ source, itemId, relationshipId, drift, onApplied, onStale, t }: RefreshProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const refresh = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const acknowledged = { netAmount: drift.price.netAmount, quantity: drift.price.quantity };
      const outcome = await applySupplierPriceToLine(relationshipId, { boqItemId: itemId, variantId: source.variantId, acknowledged, confirmFence: confirmed });
      if (outcome.kind === 'applied') {
        onApplied(outcome.source);
      } else {
        setNotice(outcome.kind);
        onStale();
      }
    } catch {
      setNotice('failed');
    } finally {
      setBusy(false);
    }
  };
  const before = formatCurrency(unitCostsOf(source).materialUnitCost);
  return (
    <section className="basis-full space-y-1">
      <p className="m-0" role="status">{t(`${KEY}.changed`, { before, after: formatCurrency(foreignUnitPrice(drift.price)), change: signedPercent(drift.changeBp) })}</p>
      {drift.exceedsFence ? (
        <label className="flex items-center gap-2">
          <Checkbox checked={confirmed} onCheckedChange={(next) => setConfirmed(next === true)} />
          {t(`${KEY}.confirmFence`)}
        </label>
      ) : null}
      <Button type="button" size="sm" disabled={busy || (drift.exceedsFence && !confirmed)} onClick={() => void refresh()}>{t(`${KEY}.refresh`)}</Button>
      {notice === null ? null : <p className="m-0" role="status">{t(`${KEY}.notices.${notice}`)}</p>}
    </section>
  );
}

export function BOQSupplierLinkedSource({ source, item, onApplied, onDetach, colors, t }: BOQSupplierLinkedSourceProps) {
  const id = item?.id ?? null;
  const key = id === null ? '' : `${id}:${source.appliedAt}`;
  const review = useSupplierDrift(id === null ? [] : [id], key);
  const [row] = review.rows;
  const drift = row?.drift ?? null;
  const locked = item?.status !== 'draft';
  return (
    <section className="flex flex-wrap items-center gap-2 text-xs">
      <p className={cn('m-0 flex-1', colors.text.muted)}>{t(`${KEY}.linked`, { version: source.versionNumber })}</p>
      {drift !== null && drift.kind !== 'current' && drift.kind !== 'changed' ? <p className="m-0 basis-full" role="status">{t(`${KEY}.notices.${drift.kind}`)}</p> : null}
      {drift?.kind === 'changed' && id !== null && row && !locked ? (
        <RefreshOffer source={source} itemId={id} relationshipId={row.relationshipId} drift={drift} onApplied={onApplied} onStale={review.recheck} t={t} />
      ) : null}
      <Button type="button" variant="ghost" size="sm" onClick={onDetach}>
        <Unlink className="mr-1 h-3.5 w-3.5" aria-hidden />{t('tabs.measurements.editor.priceSource.detach')}
      </Button>
    </section>
  );
}
