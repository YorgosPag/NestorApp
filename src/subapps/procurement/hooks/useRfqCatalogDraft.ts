'use client';

/**
 * **Η προσυμπλήρωση `?catalog=` της σελίδας `rfqs/new`** (ADR-923 §5.13 Τ6) — αδελφός του `?boqItems=` → `/api/rfqs/from-boq`.
 *
 * 🔑 Η κατάσταση **βγαίνει από την παράμετρο**: ένα αποτέλεσμα μετρά μόνο για τη διαδρομή που το ζήτησε, άρα σε κάθε αλλαγή
 *    του `?catalog=` η οθόνη γυρνά σε «φόρτωση» και μια αργή παλιά απάντηση δεν δείχνεται ποτέ για νέο SKU.
 * 🔑 Η άρνηση κρατιέται ως **κωδικός** και μεταφράζεται στην απόδοση, όχι μέσα στο αίτημα: αλλαγή γλώσσας δεν θέλει νέο GET,
 *    και το `t` δεν είναι εξάρτηση του αιτήματος.
 * 🔑 Οι κωδικοί είναι οι 4 της δημιουργίας (`rfqCreateRefusalMessages`). Ό,τι άλλο (δίκτυο, 500, `TypeError: Failed to fetch`)
 *    δείχνει τη γενική πρόταση `catalogDraftFailed`, **ποτέ** ωμό αγγλικό.
 *
 * @module subapps/procurement/hooks/useRfqCatalogDraft
 */

import { useEffect, useState } from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { ApiClientError } from '@/lib/api/api-client-types';
import { fetchJson } from '@/lib/api/fetch-json';
import { parseQuoteDraftParam, quoteDraftQuery } from '@/lib/navigation/procurement-urls';
import { rfqCreateRefusalMessages } from '@/subapps/procurement/components/rfq-create-refusal-messages';
import { RFQ_CREATE_REFUSALS, type RfqCreateRefusalCode } from '@/subapps/procurement/types/rfq-create-refusal';
import type { RfqCatalogDraft } from '@/subapps/procurement/types/rfq-line';

/** Γιατί δεν υπάρχει πρόχειρο: κωδικός της δημιουργίας, ή `failed` για ό,τι δεν είναι ονομασμένη άρνηση. */
export type CatalogDraftRefusal = RfqCreateRefusalCode | 'failed';

type Settled =
  | { readonly status: 'ready'; readonly draft: RfqCatalogDraft }
  | { readonly status: 'refused'; readonly refusal: CatalogDraftRefusal };

export type RfqCatalogDraftOutcome = { readonly status: 'none' } | { readonly status: 'loading' } | Settled;

export type RfqCatalogDraftState =
  | { readonly status: 'none' }
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly draft: RfqCatalogDraft }
  | { readonly status: 'refused'; readonly message: string };

type Translate = (key: string) => string;

/** Πού ζητείται η προσυμπλήρωση. `null` = καμία κλήση (απούσα ή άκυρη παράμετρος). */
export function catalogDraftApiPath(rawParam: string | null): string | null {
  const address = parseQuoteDraftParam(rawParam);
  return address === null ? null : `/api/rfqs/from-catalog?${quoteDraftQuery(address)}`;
}

const isRefusalCode = (value: unknown): value is RfqCreateRefusalCode =>
  (RFQ_CREATE_REFUSALS as readonly unknown[]).includes(value);

/** Μόνο ονομασμένη άρνηση του διακομιστή κρατά τον κωδικό της· όλα τα άλλα είναι `failed`. */
export function catalogDraftRefusalOf(error: unknown): CatalogDraftRefusal {
  return ApiClientError.isApiClientError(error) && isRefusalCode(error.errorCode) ? error.errorCode : 'failed';
}

/** Η πρόταση μιας άρνησης, στη γλώσσα της στιγμής. */
export function catalogDraftMessage(refusal: CatalogDraftRefusal, t: Translate): string {
  return refusal === 'failed' ? t('quotes:rfqs.errors.catalogDraftFailed') : rfqCreateRefusalMessages(t)[refusal];
}

/**
 * Η κατάσταση **από την παράμετρο** και το τελευταίο αποτέλεσμα: απούσα ⇒ τίποτα · άκυρη ⇒ άρνηση χωρίς δίκτυο · αποτέλεσμα
 * άλλης διαδρομής ⇒ φόρτωση.
 */
export function catalogDraftOutcome(
  rawParam: string | null,
  settled: { readonly path: string; readonly outcome: Settled } | null,
): RfqCatalogDraftOutcome {
  if (!rawParam) return { status: 'none' };
  const path = catalogDraftApiPath(rawParam);
  if (path === null) return { status: 'refused', refusal: 'catalogSkuUnavailable' };
  return settled?.path === path ? settled.outcome : { status: 'loading' };
}

export function useRfqCatalogDraft(rawParam: string | null): RfqCatalogDraftState {
  const { t } = useTranslation('quotes');
  const [settled, setSettled] = useState<{ readonly path: string; readonly outcome: Settled } | null>(null);
  const path = catalogDraftApiPath(rawParam);

  useEffect(() => {
    if (path === null) return;
    let live = true;
    fetchJson<{ data: RfqCatalogDraft }>(path)
      .then((json) => { if (live) setSettled({ path, outcome: { status: 'ready', draft: json.data } }); })
      .catch((error: unknown) => { if (live) setSettled({ path, outcome: { status: 'refused', refusal: catalogDraftRefusalOf(error) } }); });
    return () => { live = false; };
  }, [path]);

  const outcome = catalogDraftOutcome(rawParam, settled);
  return outcome.status === 'refused' ? { status: 'refused', message: catalogDraftMessage(outcome.refusal, t) } : outcome;
}
