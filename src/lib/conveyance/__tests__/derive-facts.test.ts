/**
 * ADR-915 §16 · ADR-901 §5.5 — γεγονότα της υπόθεσης: παραγόμενα, απαντημένα, και όσα επιβάλλει ο νόμος.
 *
 * Η ασφαλιστική ενημερότητα ΕΦΚΑ ζητείται όταν ο πωλητής «είναι ή ήταν» υπόχρεος εισφορών · εταίρος/διαχειριστής ·
 * υπόχρεος εισφορών οικοδομικού έργου (ΥΑ 15435/913/2020 άρθρο 1 περ. 6) — **όχι** μόνο για νομικά πρόσωπα.
 */

import { getChecklistItem } from '@/config/conveyance-checklist/catalog';
import { FACT_ENTAILMENTS } from '@/config/conveyance-checklist/fact-entailments';
import { isPartyFact, type ConveyanceFactId } from '@/config/conveyance-checklist/types';
import type { ConveyanceFactAnswer, ConveyancePartyKind } from '@/types/conveyance-case';
import { sellerParty } from '../case-parties';
import { deriveChecklist } from '../derive-checklist';
import {
  applyFactEntailments, deriveFacts, derivePartyFacts, factEntailedBy, resolvePartyFacts, type FactSources, type FactValues,
} from '../derive-facts';
import { testFacts, testRows } from '../__fixtures__/case-rows-fixture';

const COMPANY: FactSources = { profile: 'new_build_company', propertyType: 'apartment', appurtenanceCount: 0, landownerCount: 0 };

const answer = (value: boolean): ConveyanceFactAnswer => ({ value, answeredBy: 'u1', answeredAt: '2026-10-16T10:00:00Z' });

/** ADR-915 §22 — τα γεγονότα ΕΝΟΣ πωλητή: από το ίδιο το πρόσωπο + τις δικές του απαντήσεις. */
function sellerFacts(kind: ConveyancePartyKind, answers: Partial<Record<'seller_insurance_liable' | 'seller_by_proxy', boolean>> = {}): FactValues {
  const party = sellerParty('cont_p', kind, 'other');
  const own = Object.fromEntries(Object.entries(answers).map(([factId, value]) => [factId, answer(value)]));
  return resolvePartyFacts(party, { parties: { sellers: [party] }, partyFacts: { [party.key]: own } });
}

function insuranceRowStatus(facts: FactValues): string {
  const item = getChecklistItem('seller_insurance_clearance');
  if (!item) throw new Error('missing catalog item seller_insurance_clearance');
  return deriveChecklist({
    rows: testRows([item]), facts: testFacts(facts), overrides: {}, evidence: [], sealed: [], today: '2026-10-16', targetSigningDate: null, viewer: 'host',
  }).rows[0].status;
}

describe('seller_insurance_liable — συνεπαγωγή από νομικό πρόσωπο', () => {
  it('νομικό πρόσωπο ⇒ υπόχρεος, χωρίς ερώτηση — παράγεται από το ΠΡΟΣΩΠΟ, όχι από το προφίλ (ADR-915 §22)', () => {
    expect(derivePartyFacts({ kind: 'legal_entity', capacity: 'principal' }, [])).toMatchObject({ seller_is_legal_entity: true, seller_insurance_liable: true });
    expect(deriveFacts(COMPANY).seller_is_legal_entity).toBeUndefined();
  });

  it('η ρητή απάντηση «όχι» ΔΕΝ ανατρέπει τον νόμο για νομικό πρόσωπο', () => {
    const resolved = sellerFacts('legal_entity', { seller_insurance_liable: false });
    expect(resolved.seller_insurance_liable).toBe(true);
    expect(factEntailedBy(resolved, 'seller_insurance_liable')).toBe('seller_is_legal_entity');
  });

  it('φυσικό πρόσωπο: τίποτα δεν συνάγεται — η απάντηση αποφασίζει', () => {
    const asked = sellerFacts('person');
    expect(asked).toMatchObject({ seller_is_legal_entity: false });
    expect(asked.seller_insurance_liable).toBeUndefined();
    expect(factEntailedBy(asked, 'seller_insurance_liable')).toBeNull();
    expect(sellerFacts('person', { seller_insurance_liable: true }).seller_insurance_liable).toBe(true);
    expect(sellerFacts('person', { seller_insurance_liable: false }).seller_insurance_liable).toBe(false);
  });

  it('ιδεμπότητη: δεύτερη εφαρμογή = ίδιο αποτέλεσμα', () => {
    const once = applyFactEntailments({ seller_is_legal_entity: true });
    expect(applyFactEntailments(once)).toEqual(once);
  });
});

describe('ασφαλιστική ενημερότητα στον κατάλογο', () => {
  it('φυσικό πρόσωπο που ΗΤΑΝ επαγγελματίας ⇒ η γραμμή ζητείται', () => {
    expect(insuranceRowStatus(sellerFacts('person', { seller_insurance_liable: true }))).toBe('missing');
  });

  it('φυσικό πρόσωπο χωρίς καμία ιδιότητα (άρθρο 2 αρ. 7) ⇒ δεν εφαρμόζεται', () => {
    expect(insuranceRowStatus(sellerFacts('person', { seller_insurance_liable: false }))).toBe('not_applicable');
  });

  it('φυσικό πρόσωπο, αναπάντητο ⇒ ερώτηση (ποτέ σιωπηλό «δεν χρειάζεται»)', () => {
    expect(insuranceRowStatus(sellerFacts('person'))).toBe('needs_answer');
  });

  it('νομικό πρόσωπο ⇒ ζητείται, ό,τι κι αν απαντήθηκε στην ερώτηση ιδιοτήτων', () => {
    expect(insuranceRowStatus(sellerFacts('legal_entity', { seller_insurance_liable: false }))).toBe('missing');
  });
});

describe('FACT_ENTAILMENTS — άγκυρες του πίνακα', () => {
  it('κάθε συνεπαγωγή έχει πηγή', () => {
    expect(FACT_ENTAILMENTS.filter((rule) => rule.statute.trim() === '')).toEqual([]);
  });

  it('ADR-915 §22 — καμία συνεπαγωγή δεν διασχίζει επίπεδα (υπόθεση ↔ πρόσωπο): εφαρμόζονται ανά πλαίσιο', () => {
    expect(FACT_ENTAILMENTS.filter(({ when, then }) => isPartyFact(when.fact) !== isPartyFact(then.fact))).toEqual([]);
  });


  it('καμία συνεπαγωγή δεν αντιφάσκει με άλλη (ίδιο συμπέρασμα, αντίθετη τιμή)', () => {
    const values = new Map<ConveyanceFactId, boolean>();
    const conflicts = FACT_ENTAILMENTS.filter(({ then }) => {
      const seen = values.get(then.fact);
      values.set(then.fact, then.value);
      return seen !== undefined && seen !== then.value;
    });
    expect(conflicts).toEqual([]);
  });
});
