/**
 * @fileoverview Άγκυρες της **διαφοράς στιγμιοτύπου ⇄ ζωντανού καταλόγου ΓΕΜΗ** — ADR-948 §8 Βήμα 3.
 *
 * 🔴 Τα σενάρια που φυλάνε: νέος κωδικός ή αλλαγμένη περιγραφή που περνά σιωπηλά (ο φράχτης θα αρνείται και
 * κανείς δεν θα ξέρει γιατί) · ψευδής διαφορά από κενά/NFC · ο ίδιος ο χάρτης να μην είναι συνεπής με τον εαυτό του.
 */

import { diffGemiCatalog, gemiCatalogSnapshot } from '@/lib/company/gemi-catalog-drift';
import type { RegistryCatalogEntry } from '@/types/company-registry';

const row = (id: string, descr: string, descrEn: string | null = null, isActive: boolean | null = null): RegistryCatalogEntry => ({
  id,
  descr,
  descrEn,
  isActive,
});

const SNAPSHOT = [row('1', 'ΑΕ', 'SA'), row('2', 'ΕΠΕ', 'Ltd')];

describe('Α — ο χάρτης απέναντι στον εαυτό του', () => {
  it.each(['legalTypes', 'statuses'] as const)('Α1 — %s: στιγμιότυπο ⇄ ίδιο στιγμιότυπο ⇒ καμία διαφορά', (catalog) => {
    const snapshot = gemiCatalogSnapshot(catalog);
    expect(snapshot.length).toBeGreaterThan(0);
    expect(diffGemiCatalog(catalog, snapshot)).toEqual([]);
  });

  it('Α2 — καταστάσεις φέρουν isActive, νομικές μορφές όχι', () => {
    expect(gemiCatalogSnapshot('statuses').every((entry) => typeof entry.isActive === 'boolean')).toBe(true);
    expect(gemiCatalogSnapshot('legalTypes').every((entry) => entry.isActive === null)).toBe(true);
  });
});

describe('Β — κάθε είδος διαφοράς', () => {
  it('Β1 — νέος κωδικός ⇒ added', () => {
    const drifts = diffGemiCatalog('legalTypes', [...SNAPSHOT, row('99', 'ΝΕΑ ΜΟΡΦΗ', 'New')], SNAPSHOT);
    expect(drifts).toEqual([{ catalog: 'legalTypes', id: '99', kind: 'added', snapshot: null, live: 'ΝΕΑ ΜΟΡΦΗ' }]);
  });

  it('Β2 — κωδικός που λείπει ⇒ removed', () => {
    expect(diffGemiCatalog('legalTypes', [SNAPSHOT[0]], SNAPSHOT)).toEqual([
      { catalog: 'legalTypes', id: '2', kind: 'removed', snapshot: 'ΕΠΕ', live: null },
    ]);
  });

  it('Β3 — άλλη περιγραφή ⇒ descr-changed', () => {
    const drifts = diffGemiCatalog('legalTypes', [row('1', 'ΙΚΕ', 'SA'), SNAPSHOT[1]], SNAPSHOT);
    expect(drifts).toEqual([{ catalog: 'legalTypes', id: '1', kind: 'descr-changed', snapshot: 'ΑΕ', live: 'ΙΚΕ' }]);
  });

  it('Β4 — μόνο η αγγλική περιγραφή ⇒ descr-en-changed (και από/προς απουσία)', () => {
    const drifts = diffGemiCatalog('legalTypes', [row('1', 'ΑΕ', 'S.A.'), row('2', 'ΕΠΕ', null)], SNAPSHOT);
    expect(drifts.map((drift) => [drift.id, drift.kind])).toEqual([
      ['1', 'descr-en-changed'],
      ['2', 'descr-en-changed'],
    ]);
  });

  it('Β5 — isActive που άλλαξε ⇒ activity-changed, μόνο στις καταστάσεις', () => {
    const snapshot = [row('3', 'Ενεργή', 'Active', true)];
    expect(diffGemiCatalog('statuses', [row('3', 'Ενεργή', 'Active', false)], snapshot)).toEqual([
      { catalog: 'statuses', id: '3', kind: 'activity-changed', snapshot: 'true', live: 'false' },
    ]);
  });
});

describe('Γ — καμία ψευδής διαφορά', () => {
  it('Γ1 — διπλά κενά και NFD ⇒ ίδια περιγραφή (η ίδια κρίση με τον φράχτη)', () => {
    const live = [row('1', ' ΑΕ ', 'SA'), row('2', 'ΕΠΕ', 'Ltd')];
    expect(diffGemiCatalog('legalTypes', live, SNAPSHOT)).toEqual([]);
    const snapshot = [row('7', 'Λύση - Εκκαθάριση', null, false)];
    const decomposed = [row('7', 'Λύση  -  Εκκαθάριση'.normalize('NFD'), null, false)];
    expect(diffGemiCatalog('statuses', decomposed, snapshot)).toEqual([]);
  });

  it('Γ2 — ταξινόμηση αριθμητική κατά κωδικό (2 πριν από 10)', () => {
    const drifts = diffGemiCatalog('legalTypes', [...SNAPSHOT, row('10', 'Χ'), row('3', 'Ψ')], SNAPSHOT);
    expect(drifts.map((drift) => drift.id)).toEqual(['3', '10']);
  });
});
