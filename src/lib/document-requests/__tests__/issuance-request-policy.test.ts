/**
 * ADR-942 Φ1 — «Ζήτησε έγγραφο» στην ανάθεση έκδοσης: ο ΚΑΤΑΛΟΓΟΣ (δεδομένα) και ο ΕΝΑΣ κριτής (server + client).
 *
 * - **Δ6 / αντιστοίχιση με δήλωση**: κάθε αιτήσιμο είδος ΕΙΝΑΙ υπάρχον είδος του καταλόγου ανεβάσματος με σκοπό —
 *   αλλιώς το «το έχει ήδη» δεν θα έβρισκε ποτέ τίποτα και το ανέβασμα θα πήγαινε σε λάθος θέση.
 * - **Λέξεις (§45.21)**: κάθε είδος έχει ετικέτα στον πίνακα της οθόνης **και** κλειδί στο locale (el + en) στη διαδρομή
 *   που διαβάζει το ιστορικό — αλλιώς το ιστορικό δείχνει ωμό id.
 * - **Κριτής**: σειρά αρνήσεων και παραλήπτης **πάντα** το γραφείο (Α29).
 *
 * Κάθε `it` ονομάζει τη μετάλλαξη που πρέπει να πιάσει.
 */

import {
  ISSUANCE_REQUEST_CATALOG,
  ISSUANCE_REQUEST_ITEM_IDS,
  asIssuanceRequestItemId,
  issuanceRequestItemsOf,
} from '@/config/document-requests/issuance-request-catalog';
import { getAuditValueCatalog } from '@/config/audit-value-catalogs';
import { DOCUMENT_KINDS } from '@/config/document-validity/document-validity';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { findCatalogEntryForFile } from '@/config/upload-entry-points/queries';
import { ISSUANCE_REQUEST_ITEM_KEYS } from '@/components/document-registry/issuance-request-labels';
import elRegistry from '@/i18n/locales/el/document-registry.json';
import enRegistry from '@/i18n/locales/en/document-registry.json';
import { ISSUANCE_AUDIT_FIELDS } from '@/lib/document-validity/issuance-audit-fields';
import { toCatalogKey } from '@/lib/string/catalog-key';
import type { IssuanceRequestItemView, IssuanceRequestView } from '@/types/issuance-document-request';
import {
  issuancePendingOf,
  issuanceRequestableNow,
  issuanceRequestTargetOf,
} from '../issuance-request-policy';

const TODAY = '2026-11-17';

function item(itemId: IssuanceRequestItemView['itemId'], providedAt: string | null = null): IssuanceRequestItemView {
  return { itemId, tier: 'A', providedAt, given: [], candidates: [] };
}

function asked(itemId: string, dayKey: string, byViewer: boolean): IssuanceRequestView {
  const base = { itemId, recipient: 'host' as const, requestedAt: `${dayKey}T09:00:00.000Z`, dayKey };
  return byViewer ? { ...base, byViewer: true } : { ...base, byViewer: false, requester: 'document_issuer' };
}

function itemsLocale(locale: typeof elRegistry): Readonly<Record<string, string>> {
  return locale.issuance.documentRequest.items;
}

describe('κατάλογος αιτήσιμων εγγράφων (Δ6)', () => {
  it('κάθε είδος του κλειστού συνόλου είναι υπάρχον είδος ανεβάσματος ΜΕ σκοπό (μετάλλαξη: id που δεν λύνεται)', () => {
    for (const itemId of ISSUANCE_REQUEST_ITEM_IDS) {
      const entry = findCatalogEntryForFile(ENTITY_TYPES.PROPERTY, { entryPointId: itemId });
      expect(entry?.id).toBe(itemId);
      expect(entry?.purpose).toEqual(expect.any(String));
    }
  });

  it('δύο είδη δεν μοιράζονται σκοπό — αλλιώς το «το έχει ήδη» του ενός θα έκλεινε και το άλλο', () => {
    const purposes = ISSUANCE_REQUEST_ITEM_IDS.map((id) => findCatalogEntryForFile(ENTITY_TYPES.PROPERTY, { entryPointId: id })?.purpose);
    expect(new Set(purposes).size).toBe(purposes.length);
  });

  it('ο πίνακας είναι ολικός: κάθε είδος εγγράφου απαντά, και το ΠΕΑ έχει όλα τα είδη μία φορά', () => {
    expect(Object.keys(ISSUANCE_REQUEST_CATALOG).sort()).toEqual([...DOCUMENT_KINDS].sort());
    const pea = issuanceRequestItemsOf('energy-certificate').map((entry) => entry.itemId);
    expect([...pea].sort()).toEqual([...ISSUANCE_REQUEST_ITEM_IDS].sort());
  });

  it('στενεύει ΜΟΝΟ γνωστά ids (μετάλλαξη: δεκτό αυθαίρετο id από το σώμα του αιτήματος)', () => {
    expect(asIssuanceRequestItemId('unit-permit')).toBe('unit-permit');
    expect(asIssuanceRequestItemId('unit-contract')).toBeNull();
  });
});

describe('λέξεις — οθόνη και ιστορικό διαβάζουν τον ΙΔΙΟ κατάλογο (§45.21)', () => {
  it('κάθε είδος έχει ετικέτα στην οθόνη που λύνεται σε el ΚΑΙ en', () => {
    for (const itemId of ISSUANCE_REQUEST_ITEM_IDS) {
      const key = ISSUANCE_REQUEST_ITEM_KEYS[itemId];
      expect(key).toBe(`document-registry:issuance.documentRequest.items.${toCatalogKey(itemId)}`);
      expect(itemsLocale(elRegistry)[toCatalogKey(itemId)]).toEqual(expect.any(String));
      expect(itemsLocale(enRegistry)[toCatalogKey(itemId)]).toEqual(expect.any(String));
    }
  });

  it('το πεδίο ιστορικού κάθε είδους ανάθεσης δείχνει τον κατάλογο των ειδών (μετάλλαξη: «— → unit-permit»)', () => {
    for (const fields of Object.values(ISSUANCE_AUDIT_FIELDS)) {
      if (fields === null) continue;
      expect(getAuditValueCatalog(fields.documentRequest)).toEqual({ ns: 'document-registry', path: 'issuance.documentRequest.items' });
    }
  });
});

describe('ο κριτής (server + client)', () => {
  it('ανάθεση που δεν εκτελείται ⇒ case-closed, πριν από κάθε άλλη ερώτηση', () => {
    expect(issuanceRequestTargetOf({ stage: 'quoted', item: item('unit-permit', 'x'), hasOfficeRecipient: false }))
      .toEqual({ ok: false, refusal: 'case-closed' });
  });

  it('υπάρχει ήδη στον φάκελο ⇒ δεν ζητείται (μετάλλαξη: αίτημα για κάτι που υπάρχει)', () => {
    expect(issuanceRequestTargetOf({ stage: 'accepted', item: item('unit-permit', '2026-11-01T00:00:00.000Z'), hasOfficeRecipient: true }))
      .toEqual({ ok: false, refusal: 'not-requestable' });
  });

  it('κανένας λογαριασμός γραφείου ⇒ no-recipient (μετάλλαξη: αίτημα που δεν θα το δει κανείς)', () => {
    expect(issuanceRequestTargetOf({ stage: 'accepted', item: item('unit-permit'), hasOfficeRecipient: false }))
      .toEqual({ ok: false, refusal: 'no-recipient' });
  });

  it('αλλιώς ο παραλήπτης είναι ΠΑΝΤΑ το γραφείο (Α29)', () => {
    expect(issuanceRequestTargetOf({ stage: 'accepted', item: item('unit-permit'), hasOfficeRecipient: true }))
      .toEqual({ ok: true, recipient: 'host' });
  });
});

describe('«εκκρεμεί» και «Ζήτησε όλα» — παράγονται', () => {
  it('ό,τι υπάρχει ήδη δεν εκκρεμεί, ακόμη κι αν ζητήθηκε', () => {
    expect(issuancePendingOf(item('unit-permit', '2026-11-16T00:00:00.000Z'), [asked('unit-permit', '2026-11-15', true)], TODAY)).toBeNull();
  });

  it('προς το γραφείο: «το ζήτησε ο μηχανικός» · από τον μηχανικό: «εκκρεμεί από το γραφείο»', () => {
    expect(issuancePendingOf(item('unit-permit'), [asked('unit-permit', TODAY, false)], TODAY)?.askedOfViewerBy).toBe('document_issuer');
    const mine = issuancePendingOf(item('unit-permit'), [asked('unit-permit', TODAY, true)], TODAY);
    expect(mine).toMatchObject({ recipient: 'host', askedOfViewerBy: null, requestedTodayByViewer: true });
  });

  it('«Ζήτησε όλα» παραλείπει όσα ζήτησε ήδη σήμερα και όσα δεν έχουν παραλήπτη', () => {
    const items = [item('unit-permit'), item('unit-floor-plan'), item('study-admin-cadastre')];
    const targets = {
      'unit-permit': { ok: true, recipient: 'host' } as const,
      'unit-floor-plan': { ok: true, recipient: 'host' } as const,
      'study-admin-cadastre': { ok: false, refusal: 'no-recipient' } as const,
    };
    const ids = issuanceRequestableNow(items, targets, [asked('unit-permit', TODAY, true)], TODAY).map((entry) => entry.itemId);
    expect(ids).toEqual(['unit-floor-plan']);
  });
});
