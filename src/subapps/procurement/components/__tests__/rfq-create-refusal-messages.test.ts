/**
 * ADR-923 §5.13 Τ6 — οι αρνήσεις της δημιουργίας RFQ φτάνουν στον άνθρωπο με λέξεις, από το σύρμα ως την οθόνη.
 *
 * Ο δρόμος που ελέγχεται είναι ο αληθινός: `fetch` → `fetchJson` → `explainProcurementError` → μήνυμα. Πριν από το Τ6 το
 * `fetchJson` πετούσε απλό `Error` και ο κωδικός χανόταν, οπότε η φόρμα του RFQ δεν θα μπορούσε ποτέ να ονομάσει άρνηση.
 */

jest.mock('@/i18n/hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

/* eslint-disable import/first -- τα mocks πρέπει να δηλωθούν πριν φορτωθούν οι μονάδες */
import { explainProcurementError } from '@/components/procurement/explain-procurement-error';
import { ApiClientError } from '@/lib/api/api-client-types';
import { fetchJson } from '@/lib/api/fetch-json';
import { RFQ_CREATE_REFUSALS } from '../../types/rfq-create-refusal';
import {
  catalogDraftApiPath, catalogDraftMessage, catalogDraftOutcome, catalogDraftRefusalOf, useRfqCatalogDraft,
} from '../../hooks/useRfqCatalogDraft';
import { renderHook, waitFor } from '@testing-library/react';
import { rfqCreateRefusalMessages } from '../rfq-create-refusal-messages';
/* eslint-enable import/first */

const t = (key: string) => `«${key}»`;
const messages = rfqCreateRefusalMessages(t);

function respond(status: number, body: unknown): void {
  global.fetch = jest.fn(async () => ({ ok: status < 400, status, json: async () => body })) as unknown as typeof fetch;
}

describe('rfqCreateRefusalMessages', () => {
  it('κάθε κωδικός του διακομιστή έχει δικό του κλειδί, χωρίς κενά και χωρίς επαναλήψεις', () => {
    expect(Object.keys(messages).sort()).toEqual([...RFQ_CREATE_REFUSALS].sort());
    expect(new Set(Object.values(messages)).size).toBe(RFQ_CREATE_REFUSALS.length);
    expect(messages.supplierNotAcceptingQuotes).toBe('«quotes:rfqs.errors.refusals.supplierNotAcceptingQuotes»');
  });
});

describe('fetchJson → explainProcurementError', () => {
  it.each(RFQ_CREATE_REFUSALS)('%s από το σύρμα ⇒ η μεταφρασμένη πρόταση, όχι το αγγλικό του server', async (code) => {
    respond(409, { success: false, error: `RFQ create refused (${code}): x`, errorCode: code });
    await expect(explainProcurementError(() => fetchJson('/api/rfqs'), messages)).rejects.toThrow(messages[code]);
  });

  it('το fetchJson κρατά μήνυμα, κατάσταση και κωδικό', async () => {
    respond(422, { error: 'nope', errorCode: 'catalogSkuUnavailable' });
    const caught = await fetchJson('/api/rfqs').catch((e: unknown) => e);
    expect(caught).toBeInstanceOf(ApiClientError);
    expect(caught).toMatchObject({ message: 'nope', statusCode: 422, errorCode: 'catalogSkuUnavailable' });
  });

  it('χωρίς φάκελο σφάλματος ⇒ HTTP <κωδικός>, όπως πριν', async () => {
    global.fetch = jest.fn(async () => ({ ok: false, status: 503, json: async () => { throw new Error('x'); } })) as unknown as typeof fetch;
    await expect(fetchJson('/api/rfqs')).rejects.toThrow('Unknown error');
  });
});

describe('προσυμπλήρωση ?catalog=', () => {
  it('έγκυρη διεύθυνση ⇒ GET /api/rfqs/from-catalog με το ίδιο ερώτημα', () => {
    expect(catalogDraftApiPath('comp_a.cpmod_1.v1')).toBe('/api/rfqs/from-catalog?catalog=comp_a.cpmod_1.v1');
  });

  it('απούσα ⇒ τίποτα · άκυρη ⇒ άρνηση χωρίς δίκτυο · έγκυρη χωρίς αποτέλεσμα ⇒ φόρτωση', () => {
    expect(catalogDraftOutcome(null, null)).toEqual({ status: 'none' });
    expect(catalogDraftOutcome('a.b', null)).toEqual({ status: 'refused', refusal: 'catalogSkuUnavailable' });
    expect(catalogDraftApiPath('a.b')).toBeNull();
    expect(catalogDraftOutcome('a.b.c', null)).toEqual({ status: 'loading' });
  });

  it('🔑 αλλαγή του ?catalog= ⇒ ξανά φόρτωση: το αποτέλεσμα της ΠΑΛΙΑΣ διαδρομής δεν δείχνεται για νέο SKU', () => {
    const ready = { status: 'ready' as const, draft: { address: { supplierCompanyId: 'a', modelId: 'b', variantId: 'c' }, description: 'x', supplierName: 'y' } };
    const settled = { path: catalogDraftApiPath('a.b.c') as string, outcome: ready };
    expect(catalogDraftOutcome('a.b.c', settled)).toBe(ready);
    expect(catalogDraftOutcome('a.b.d', settled)).toEqual({ status: 'loading' });
  });

  it('ονομασμένη άρνηση ⇒ ο κωδικός της · δίκτυο, 500, άγνωστος κωδικός ⇒ failed', () => {
    expect(catalogDraftRefusalOf(new ApiClientError('raw', 409, 'supplierNotAcceptingQuotes'))).toBe('supplierNotAcceptingQuotes');
    expect(catalogDraftRefusalOf(new TypeError('Failed to fetch'))).toBe('failed');
    expect(catalogDraftRefusalOf(new ApiClientError('raw server text', 500))).toBe('failed');
    expect(catalogDraftRefusalOf(new ApiClientError('raw', 409, 'SOMETHING_ELSE'))).toBe('failed');
  });

  it('το hook: νέο `t` σε κάθε απόδοση ΔΕΝ ξαναζητά · νέο ?catalog= ⇒ φόρτωση και ΕΝΑ νέο GET', async () => {
    const draft = { address: { supplierCompanyId: 'a', modelId: 'b', variantId: 'c' }, description: 'x', supplierName: 'y' };
    respond(200, { data: draft });
    const { result, rerender } = renderHook(({ raw }) => useRfqCatalogDraft(raw), { initialProps: { raw: 'a.b.c' } });
    await waitFor(() => expect(result.current).toEqual({ status: 'ready', draft }));
    rerender({ raw: 'a.b.c' });
    rerender({ raw: 'a.b.c' });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    rerender({ raw: 'a.b.d' });
    expect(result.current).toEqual({ status: 'loading' });
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
  });

  it('🔒 ποτέ ωμό αγγλικό: failed ⇒ catalogDraftFailed · κωδικός ⇒ η πρότασή του, στη γλώσσα της απόδοσης', () => {
    expect(catalogDraftMessage('failed', t)).toBe('«quotes:rfqs.errors.catalogDraftFailed»');
    expect(catalogDraftMessage('rfqTooLarge', t)).toBe(messages.rfqTooLarge);
    expect(catalogDraftMessage('rfqTooLarge', (key) => `[en] ${key}`)).toBe('[en] quotes:rfqs.errors.refusals.rfqTooLarge');
  });
});
