/**
 * ADR-915 §16 · ADR-901 §5.5 — γεγονότα της υπόθεσης: παραγόμενα, απαντημένα, και όσα επιβάλλει ο νόμος.
 *
 * Η ασφαλιστική ενημερότητα ΕΦΚΑ ζητείται όταν ο πωλητής «είναι ή ήταν» υπόχρεος εισφορών · εταίρος/διαχειριστής ·
 * υπόχρεος εισφορών οικοδομικού έργου (ΥΑ 15435/913/2020 άρθρο 1 περ. 6) — **όχι** μόνο για νομικά πρόσωπα.
 */

import { getChecklistItem } from '@/config/conveyance-checklist/catalog';
import { FACT_ENTAILMENTS } from '@/config/conveyance-checklist/fact-entailments';
import type { ConveyanceFactId } from '@/config/conveyance-checklist/types';
import type { ConveyanceFactAnswer } from '@/types/conveyance-case';
import { deriveChecklist } from '../derive-checklist';
import { applyFactEntailments, deriveFacts, factEntailedBy, resolveFacts, type FactSources, type FactValues } from '../derive-facts';

const COMPANY: FactSources = { profile: 'new_build_company', propertyType: 'apartment', appurtenanceCount: 0, landownerCount: 0 };

const answer = (value: boolean): ConveyanceFactAnswer => ({ value, answeredBy: 'u1', answeredAt: '2026-10-16T10:00:00Z' });

function insuranceRowStatus(facts: FactValues): string {
  const item = getChecklistItem('seller_insurance_clearance');
  if (!item) throw new Error('missing catalog item seller_insurance_clearance');
  return deriveChecklist({
    items: [item], facts, overrides: {}, evidence: [], sealed: [], today: '2026-10-16', targetSigningDate: null, viewer: 'host',
  }).rows[0].status;
}

describe('seller_insurance_liable — συνεπαγωγή από νομικό πρόσωπο', () => {
  it('παραγόμενο νομικό πρόσωπο (εργολάβος) ⇒ υπόχρεος, χωρίς ερώτηση', () => {
    expect(deriveFacts(COMPANY)).toMatchObject({ seller_is_legal_entity: true, seller_insurance_liable: true });
  });

  it('ΑΠΑΝΤΗΜΕΝΟ νομικό πρόσωπο ⇒ υπόχρεος (η συνεπαγωγή εφαρμόζεται μετά τις απαντήσεις)', () => {
    expect(resolveFacts({}, { seller_is_legal_entity: answer(true) }).seller_insurance_liable).toBe(true);
  });

  it('η ρητή απάντηση «όχι» ΔΕΝ ανατρέπει τον νόμο για νομικό πρόσωπο', () => {
    const resolved = resolveFacts(deriveFacts(COMPANY), { seller_insurance_liable: answer(false) });
    expect(resolved.seller_insurance_liable).toBe(true);
    expect(factEntailedBy(resolved, 'seller_insurance_liable')).toBe('seller_is_legal_entity');
  });

  it('φυσικό πρόσωπο: τίποτα δεν συνάγεται — η απάντηση αποφασίζει', () => {
    const asked = resolveFacts({}, { seller_is_legal_entity: answer(false) });
    expect(asked.seller_insurance_liable).toBeUndefined();
    expect(factEntailedBy(asked, 'seller_insurance_liable')).toBeNull();
    expect(resolveFacts({}, { seller_is_legal_entity: answer(false), seller_insurance_liable: answer(true) }).seller_insurance_liable).toBe(true);
    expect(resolveFacts({}, { seller_is_legal_entity: answer(false), seller_insurance_liable: answer(false) }).seller_insurance_liable).toBe(false);
  });

  it('ιδεμπότητη: δεύτερη εφαρμογή = ίδιο αποτέλεσμα', () => {
    const once = applyFactEntailments({ seller_is_legal_entity: true });
    expect(applyFactEntailments(once)).toEqual(once);
  });
});

describe('ασφαλιστική ενημερότητα στον κατάλογο', () => {
  it('φυσικό πρόσωπο που ΗΤΑΝ επαγγελματίας ⇒ η γραμμή ζητείται', () => {
    expect(insuranceRowStatus(resolveFacts({}, { seller_is_legal_entity: answer(false), seller_insurance_liable: answer(true) }))).toBe('missing');
  });

  it('φυσικό πρόσωπο χωρίς καμία ιδιότητα (άρθρο 2 αρ. 7) ⇒ δεν εφαρμόζεται', () => {
    expect(insuranceRowStatus(resolveFacts({}, { seller_is_legal_entity: answer(false), seller_insurance_liable: answer(false) }))).toBe('not_applicable');
  });

  it('φυσικό πρόσωπο, αναπάντητο ⇒ ερώτηση (ποτέ σιωπηλό «δεν χρειάζεται»)', () => {
    expect(insuranceRowStatus(resolveFacts({}, { seller_is_legal_entity: answer(false) }))).toBe('needs_answer');
  });

  it('νομικό πρόσωπο ⇒ ζητείται, ό,τι κι αν απαντήθηκε στην ερώτηση ιδιοτήτων', () => {
    expect(insuranceRowStatus(resolveFacts(deriveFacts(COMPANY), { seller_insurance_liable: answer(false) }))).toBe('missing');
  });
});

describe('FACT_ENTAILMENTS — άγκυρες του πίνακα', () => {
  it('κάθε συνεπαγωγή έχει πηγή', () => {
    expect(FACT_ENTAILMENTS.filter((rule) => rule.statute.trim() === '')).toEqual([]);
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
