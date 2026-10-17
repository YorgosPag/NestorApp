/**
 * ADR-915 §26 — **ο υπεύθυνος** ενός ακινήτου με πολλούς ιδιοκτήτες: ο καθαρός πυρήνας. Συνθετικά δεδομένα μόνο.
 */

import { obligorLeadOf, type ObligorLeadFacts } from '@/lib/document-validity/obligor-lead';

const BASE: ObligorLeadFacts = { owners: ['cont_a', 'cont_b'], explicitContactId: null, shares: new Map(), principalContactIds: [] };

const shares = (entries: Record<string, number>) => new Map(Object.entries(entries));

describe('obligorLeadOf — η αλυσίδα', () => {
  it('κανείς ιδιοκτήτης ⇒ `null` (το «δεν έχει οριστεί ιδιοκτήτης» το λέει ήδη η οθόνη)', () => {
    expect(obligorLeadOf({ ...BASE, owners: [] })).toBeNull();
  });

  it('ένας ιδιοκτήτης ⇒ αυτός (`sole`)', () => {
    expect(obligorLeadOf({ ...BASE, owners: ['cont_a'] })).toMatchObject({ kind: 'designated', contactId: 'cont_a', basis: 'sole' });
  });

  it('ρητή επιλογή που είναι ιδιοκτήτης ΝΙΚΑ την πλειοψηφία', () => {
    expect(obligorLeadOf({ ...BASE, explicitContactId: 'cont_b', shares: shares({ cont_a: 70, cont_b: 30 }) }))
      .toEqual({ kind: 'designated', contactId: 'cont_b', basis: 'explicit', sharePct: 30, staleContactId: null });
  });

  it('ρητή επιλογή που ΕΠΑΨΕ να είναι ιδιοκτήτης ⇒ η αλυσίδα συνεχίζει ΚΑΙ το λέει (ποτέ σιωπηλή μεταφορά)', () => {
    expect(obligorLeadOf({ ...BASE, explicitContactId: 'cont_sold', shares: shares({ cont_a: 60, cont_b: 40 }) }))
      .toEqual({ kind: 'designated', contactId: 'cont_a', basis: 'majority-share', sharePct: 60, staleContactId: 'cont_sold' });
    expect(obligorLeadOf({ ...BASE, explicitContactId: 'cont_sold' })).toEqual({ kind: 'undesignated', reason: 'unknown-shares', staleContactId: 'cont_sold' });
  });
});

describe('obligorLeadOf — πλειοψηφία κατά μερίδια (ΑΚ 789)', () => {
  it('60/40 ⇒ ο 60% — και όχι επειδή είναι πρώτος στη λίστα', () => {
    expect(obligorLeadOf({ ...BASE, owners: ['cont_b', 'cont_a'], shares: shares({ cont_a: 60, cont_b: 40 }) }))
      .toMatchObject({ kind: 'designated', contactId: 'cont_a', basis: 'majority-share', sharePct: 60 });
  });

  it('50/50 ⇒ ΚΑΜΙΑ πλειοψηφία (αυστηρά > 50%), όχι κλήρωση', () => {
    expect(obligorLeadOf({ ...BASE, shares: shares({ cont_a: 50, cont_b: 50 }) }))
      .toEqual({ kind: 'undesignated', reason: 'no-majority', staleContactId: null });
  });

  it('40/30/30 ⇒ ο μεγαλύτερος ΔΕΝ έχει πλειοψηφία', () => {
    expect(obligorLeadOf({ ...BASE, owners: ['cont_a', 'cont_b', 'cont_c'], shares: shares({ cont_a: 40, cont_b: 30, cont_c: 30 }) }))
      .toEqual({ kind: 'undesignated', reason: 'no-majority', staleContactId: null });
  });

  it('μερίδια ελλιπή χωρίς πλειοψηφία ⇒ `unknown-shares` (δεν ισχυριζόμαστε «κανείς δεν έχει πλειοψηφία»)', () => {
    expect(obligorLeadOf({ ...BASE, shares: shares({ cont_a: 40 }) })).toEqual({ kind: 'undesignated', reason: 'unknown-shares', staleContactId: null });
  });

  it('χωρίς μερίδια και χωρίς κύριο πωλητή ⇒ ΠΟΤΕ ο πρώτος της λίστας', () => {
    expect(obligorLeadOf(BASE)).toEqual({ kind: 'undesignated', reason: 'unknown-shares', staleContactId: null });
  });
});

describe('obligorLeadOf — ο κύριος μεταβιβάζων', () => {
  it('ένας κύριος πωλητής ανάμεσα στους μεταβιβάζοντες ⇒ αυτός (`contract-principal`)', () => {
    expect(obligorLeadOf({ ...BASE, owners: ['cont_land', 'cont_company'], principalContactIds: ['cont_company'] }))
      .toMatchObject({ kind: 'designated', contactId: 'cont_company', basis: 'contract-principal', sharePct: null });
  });

  it('κύριος που δεν είναι ιδιοκτήτης ή δύο κύριοι ⇒ κανείς', () => {
    expect(obligorLeadOf({ ...BASE, principalContactIds: ['cont_x'] })).toMatchObject({ kind: 'undesignated' });
    expect(obligorLeadOf({ ...BASE, principalContactIds: ['cont_a', 'cont_b'] })).toMatchObject({ kind: 'undesignated' });
  });
});
