/**
 * ⚓ ADR-915 §22 — παλιές υποθέσεις (ένας `seller`) διαβάζονται στο νέο σχήμα **χωρίς script μετάπτωσης**, και οι εντολές
 * σε γεγονότα προσώπου δηλώνουν **ποιο** πρόσωπο. Συνθετικά αναγνωριστικά.
 */

import type { ConveyanceCase, EvidenceFile } from '@/types/conveyance-case';
import { findEntryPoint } from '@/config/upload-entry-points/queries';
import { applyConveyanceCommand, type CommandContext } from '../apply-command';
import { sellerParty } from '../case-parties';
import { upcastStoredCase } from '../case-upcast';
import { parseConveyanceCase } from '../conveyance-case-schema';

const answer = { value: true, answeredBy: 'u1', answeredAt: 't1' };
const review = {
  verdict: 'accepted', fileId: null, fileFingerprint: null, issuedOn: '2026-09-20', printedValidUntil: null,
  reason: null, reviewedBy: 'u1', reviewedAt: 't1',
};

/** Ένα έγγραφο `conveyance_cases` όπως το έγραφε ο κώδικας ΠΡΙΝ από την §22. */
function legacyStored(sellerContactId: string | null = 'cont_co'): Record<string, unknown> {
  return {
    id: 'cvc_1', companyId: 'comp_a',
    subject: { kind: 'property', propertyId: 'prop_1', buildingId: null, projectId: null, appurtenances: [] },
    profile: 'new_build_company',
    parties: { seller: { contactId: sellerContactId, kind: 'legal_entity' }, buyers: [{ contactId: 'cont_b' }] },
    facts: { seller_by_proxy: answer, buyer_has_mortgage: answer },
    overrides: { seller_tax_clearance: { review }, title_deed: { review } },
    storedState: 'open', targetSigningDate: null, catalogVersion: '0.4.0', version: 2,
    createdBy: 'u1', createdAt: 't0', updatedAt: 't0', cancellation: null,
  };
}

describe('upcastStoredCase — παλιό σχήμα ⇒ σχήμα §22', () => {
  it('ο μοναδικός `seller` γίνεται λίστα ενός, με κλειδί την επαφή του', () => {
    const parsed = parseConveyanceCase(legacyStored());
    expect(parsed?.parties).toEqual({ sellers: [{ key: 'cont_co', contactId: 'cont_co', kind: 'legal_entity' }], buyers: [{ contactId: 'cont_b' }] });
  });

  it('οι απαντήσεις σε γεγονότα προσώπου πάνε στο πρόσωπο· της υπόθεσης μένουν', () => {
    const parsed = parseConveyanceCase(legacyStored());
    expect(parsed?.facts).toEqual({ buyer_has_mortgage: answer });
    expect(parsed?.partyFacts).toEqual({ cont_co: { seller_by_proxy: answer } });
  });

  it('ο έλεγχος της γραμμής πωλητή μένει στον ΙΔΙΟ πωλητή · της υπόθεσης δεν αγγίζεται', () => {
    const parsed = parseConveyanceCase(legacyStored());
    expect(Object.keys(parsed?.overrides ?? {}).sort()).toEqual(['seller_tax_clearance@cont_co', 'title_deed']);
  });

  it('πωλητής χωρίς επαφή ⇒ σταθερό κλειδί (ίδιο σε κάθε ανάγνωση)', () => {
    const first = parseConveyanceCase(legacyStored(null));
    const second = parseConveyanceCase(legacyStored(null));
    expect(first?.parties.sellers[0].key).toBe('seller');
    expect(Object.keys(first?.overrides ?? {})).toEqual(Object.keys(second?.overrides ?? {}));
  });

  it('ιδεμπότητο: ήδη νέο έγγραφο περνά αναλλοίωτο · χωρίς `partyFacts` ⇒ {}', () => {
    const once = upcastStoredCase(legacyStored());
    expect(upcastStoredCase(once)).toEqual(once);
    const parsed: ConveyanceCase | null = parseConveyanceCase(legacyStored());
    const withoutPartyFacts = Object.fromEntries(Object.entries(parsed ?? {}).filter(([key]) => key !== 'partyFacts'));
    expect(parseConveyanceCase(withoutPartyFacts)?.partyFacts).toEqual({});
  });

  it('αλλοιωμένο έγγραφο (ούτε `seller` ούτε `sellers`) ⇒ απορρίπτεται, όχι «μαντεύεται»', () => {
    const corrupt = { ...legacyStored(), parties: { buyers: [] } };
    expect(parseConveyanceCase(corrupt)).toBeNull();
  });
});

describe('εντολές σε γεγονότα προσώπου', () => {
  const COMPANY = sellerParty('cont_co', 'legal_entity');
  const PERSON = sellerParty('cont_p', 'person');
  const purpose = findEntryPoint('contact', 'tax-clearance')?.purpose ?? 'missing-entry-point';
  const companyTax: EvidenceFile = {
    source: { kind: 'owned' }, fileId: 'f_co', displayName: 'f.pdf', entityType: 'contact', entityId: 'cont_co', purpose,
    level: 'seller_contact', fingerprint: 'f_co:0:t', createdAt: '2026-10-01T00:00:00Z', documentFacts: null,
  };
  const ctx: CommandContext = { actorUid: 'u2', now: '2026-10-16T10:00:00Z', today: '2026-10-16', evidence: [companyTax] };
  const record = (() => {
    const parsed = parseConveyanceCase(legacyStored());
    if (parsed === null) throw new Error('fixture');
    return { ...parsed, parties: { ...parsed.parties, sellers: [COMPANY, PERSON] } };
  })();

  it('απάντηση με πρόσωπο ⇒ γράφεται ΜΟΝΟ στο πρόσωπο', () => {
    const result = applyConveyanceCommand(record, { type: 'answer_fact', factId: 'seller_by_proxy', value: false, partyKey: 'cont_p' }, ctx);
    if (!result.ok) throw new Error(result.rejection);
    expect(result.next.partyFacts.cont_p?.seller_by_proxy?.value).toBe(false);
    expect(result.next.partyFacts.cont_co?.seller_by_proxy?.value).toBe(true);
    expect(result.next.facts).toEqual(record.facts);
    expect(result.changes).toEqual([{ field: 'partyFacts.cont_p.seller_by_proxy', oldValue: null, newValue: false }]);
  });

  it('απόσυρση της μόνης απάντησης ⇒ το πρόσωπο φεύγει από το `partyFacts` (καμία κενή εγγραφή)', () => {
    const result = applyConveyanceCommand(record, { type: 'answer_fact', factId: 'seller_by_proxy', value: null, partyKey: 'cont_co' }, ctx);
    if (!result.ok) throw new Error(result.rejection);
    expect(result.next.partyFacts.cont_co).toBeUndefined();
  });

  it('γεγονός προσώπου χωρίς πρόσωπο ή με ξένο πρόσωπο ⇒ party_required', () => {
    expect(applyConveyanceCommand(record, { type: 'answer_fact', factId: 'seller_by_proxy', value: true }, ctx))
      .toEqual({ ok: false, rejection: 'party_required' });
    expect(applyConveyanceCommand(record, { type: 'answer_fact', factId: 'seller_by_proxy', value: true, partyKey: 'cont_x' }, ctx))
      .toEqual({ ok: false, rejection: 'party_required' });
  });

  it('γεγονός της υπόθεσης με πρόσωπο ⇒ party_not_applicable', () => {
    expect(applyConveyanceCommand(record, { type: 'answer_fact', factId: 'buyer_has_mortgage', value: true, partyKey: 'cont_p' }, ctx))
      .toEqual({ ok: false, rejection: 'party_not_applicable' });
  });

  it('έγκριση της φορολογικής της εταιρείας στη γραμμή του ιδιώτη ⇒ file_not_evidence', () => {
    const accept = { type: 'review' as const, verdict: 'accepted' as const, fileId: 'f_co', issuedOn: null, reason: null };
    expect(applyConveyanceCommand(record, { ...accept, itemId: 'seller_tax_clearance@cont_p' }, ctx))
      .toEqual({ ok: false, rejection: 'file_not_evidence' });
    expect(applyConveyanceCommand(record, { ...accept, itemId: 'seller_tax_clearance@cont_co' }, ctx).ok).toBe(true);
  });

  it('σκέτο κλειδί προτύπου σε υπόθεση με δύο πωλητές ⇒ unknown_item (ποτέ «του πρώτου»)', () => {
    expect(applyConveyanceCommand(record, { type: 'mark_not_applicable', itemId: 'seller_e9', reason: 'r' }, ctx))
      .toEqual({ ok: false, rejection: 'unknown_item' });
  });
});
