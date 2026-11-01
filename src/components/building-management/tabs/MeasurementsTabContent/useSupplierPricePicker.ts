/**
 * useSupplierPricePicker — προμηθευτής → SKU → τιμή → εφαρμογή (ADR-923 §5.12 τμήμα 4), χωρίς καμία δική του κρίση.
 *
 * Κάθε απάντηση έρχεται από τον διακομιστή. Η **τελευταία** ερώτηση κερδίζει: αργή απάντηση παλιού όρου ή παλιού SKU δεν γράφει ποτέ
 * πάνω από νεότερη. Η ποσότητα είναι της αποθηκευμένης γραμμής, αυτή που θα τιμολογήσει και ο γραφέας.
 *
 * @module components/building-management/tabs/MeasurementsTabContent/useSupplierPricePicker
 */

'use client';

import { useCallback, useRef, useState } from 'react';
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback';
import { applySupplierPriceToLine, quoteForeignSku, searchForeignSkus } from '@/services/catalog/supply-api.client';
import { supplierLineQuantity } from '@/services/measurements/boq-price-source';
import type { ForeignPrice } from '@/subapps/catalog/pricing/foreign-quote';
import type { ForeignSkuRow } from '@/subapps/catalog/pricing/foreign-sku-search';
import type { BOQItem, BoqSupplierPriceSource } from '@/types/boq';

const SEARCH_DELAY_MS = 350;

export type PickerNotice = 'unavailable' | 'requestQuote' | 'unitMismatch' | 'notApplicable' | 'priceMoved' | 'fenceRequired' | 'failed';

export interface SupplierPickerState {
  readonly relationshipId: string | undefined;
  readonly term: string;
  readonly rows: readonly ForeignSkuRow[] | null;
  readonly selected: ForeignSkuRow | null;
  readonly price: ForeignPrice | null;
  readonly notice: PickerNotice | null;
  /** Ο διακομιστής ζήτησε επιβεβαίωση φράχτη για αυτή την επιλογή. */
  readonly fenceAsked: boolean;
  readonly busy: boolean;
}

const EMPTY: SupplierPickerState = { relationshipId: undefined, term: '', rows: null, selected: null, price: null, notice: null, fenceAsked: false, busy: false };

export function useSupplierPricePicker(item: BOQItem | null, onApplied: (source: BoqSupplierPriceSource) => void) {
  const [state, setState] = useState<SupplierPickerState>(EMPTY);
  const merge = useCallback((next: Partial<SupplierPickerState>) => setState((current) => ({ ...current, ...next })), []);
  const ticket = useRef(0);
  const nextTicket = () => { ticket.current += 1; return ticket.current; };

  const search = useDebouncedCallback(async (relationshipId: string, term: string) => {
    const mine = nextTicket();
    try {
      const { rows } = await searchForeignSkus(relationshipId, term);
      if (mine === ticket.current) merge({ rows, notice: null });
    } catch {
      if (mine === ticket.current) merge({ rows: null, notice: 'failed' });
    }
  }, SEARCH_DELAY_MS);

  const chooseSupplier = useCallback((relationshipId: string) => {
    nextTicket();
    search.cancel();
    setState({ ...EMPTY, relationshipId });
  }, [search]);

  const changeTerm = (term: string) => {
    nextTicket();
    merge({ term, rows: null, selected: null, price: null, notice: null, fenceAsked: false });
    if (state.relationshipId !== undefined && term.trim() !== '') search(state.relationshipId, term.trim());
    else search.cancel();
  };

  const chooseSku = async (row: ForeignSkuRow) => {
    if (state.relationshipId === undefined || item === null) return;
    const mine = nextTicket();
    merge({ selected: row, price: null, fenceAsked: false, notice: row.priced ? null : 'requestQuote' });
    if (!row.priced) return;
    try {
      const quote = await quoteForeignSku(state.relationshipId, row.variantId, supplierLineQuantity(item));
      if (mine !== ticket.current) return;
      merge(quote.kind === 'priced' ? { price: quote.price } : { notice: quote.kind });
    } catch {
      if (mine === ticket.current) merge({ notice: 'failed' });
    }
  };

  const apply = async () => {
    const { relationshipId, selected, price } = state;
    if (relationshipId === undefined || selected === null || price === null || item === null) return;
    merge({ busy: true, notice: null });
    try {
      const acknowledged = { netAmount: price.netAmount, quantity: price.quantity };
      const outcome = await applySupplierPriceToLine(relationshipId, { boqItemId: item.id, variantId: selected.variantId, acknowledged, confirmFence: state.fenceAsked });
      if (outcome.kind === 'applied') {
        setState(EMPTY);
        onApplied(outcome.source);
      } else if (outcome.kind === 'priceMoved') {
        merge({ price: outcome.price, notice: 'priceMoved', busy: false });
      } else if (outcome.kind === 'fenceRequired') {
        // Ίδιο SKU, αποσυνδεδεμένο στη φόρμα αλλά όχι στη βάση: το δεύτερο πάτημα είναι η ρητή επιβεβαίωση.
        merge({ fenceAsked: true, notice: 'fenceRequired', busy: false });
      } else {
        merge({ price: null, notice: outcome.kind, busy: false });
      }
    } catch {
      merge({ notice: 'failed', busy: false });
    }
  };

  return { state, chooseSupplier, changeTerm, chooseSku, apply };
}
