/**
 * @fileoverview Άγκυρα του **πληθυσμού του καταλόγου** — ADR-841 §7 Α23 Φ3.3.
 * @related lib/agency/agency-directory-population.ts · services/realtime/hooks/usePublicAgencies.ts
 *
 * 🔴 **Κλείνει τον επιζώντα M9 της Α23.1**: η αφαίρεση του φίλτρου «κλειστή στο ΓΕΜΗ» από τον κατάλογο δεν
 * κοκκίνιζε τίποτα. Τα έγγραφα είναι **ωμά**, όπως στη βάση — περνούν από τον **πραγματικό** αναγνώστη.
 */

import { directoryPopulationOf, type DirectoryDocument } from '../agency-directory-population';

/** Το παλιό έγγραφο βιτρίνας (αναγνώσιμο, μεσιτικό) — ίδιο με το `showcase-read.test.ts`. */
function rawShowcase(companyId: string, registryClosure: unknown): Record<string, unknown> {
  return {
    companyId,
    alias: companyId,
    displayName: `Γραφείο ${companyId}`,
    gemiNumber: '123456789000',
    place: null,
    publishedAt: '2026-09-01T10:00:00.000Z',
    legalIdentity: {
      publicName: 'legal-name',
      legalName: 'ΔΟΚΙΜΑΣΤΙΚΟ ΜΕΣΙΤΙΚΟ Α.Ε.',
      legalForm: 'ae',
      gemiNumber: '123456789000',
      seat: { disclosure: 'municipality', streetLine: null, postalCode: null, locality: 'Θεσσαλονίκη' },
      attestation: { state: 'declared' },
      registryClosure,
    },
  };
}

function documentOf(id: string, data: unknown): DirectoryDocument {
  return { id, data: () => data };
}

const CLOSURE = { issuer: 'gemi', checkedAt: '2026-09-14T11:00:00.000Z' };

describe('Π — ποιοι μπαίνουν στον κατάλογο', () => {
  it('🔴 Π1 — κλειστή στο ΓΕΜΗ ⇒ ΕΚΤΟΣ, χωρίς να λογίζεται «μη αναγνώσιμη»', () => {
    const population = directoryPopulationOf([
      documentOf('comp_open', rawShowcase('comp_open', null)),
      documentOf('comp_closed', rawShowcase('comp_closed', CLOSURE)),
      documentOf('comp_broken', null),
    ]);

    expect(population.listed.map(({ companyId }) => companyId)).toEqual(['comp_open']);
    expect(population.unreadableCompanyIds).toEqual(['comp_broken']);
  });

  it('🔑 Π2 — Ο ΘΕΤΙΚΟΣ ΜΑΡΤΥΡΑΣ: το ΙΔΙΟ έγγραφο χωρίς κλείσιμο ⇒ ΜΕΣΑ', () => {
    // Χωρίς αυτό, ένα fixture που ο αναγνώστης απορρίπτει θα άφηνε το Π1 πράσινο για λάθος λόγο.
    const population = directoryPopulationOf([documentOf('comp_closed', rawShowcase('comp_closed', null))]);

    expect(population.listed.map(({ companyId }) => companyId)).toEqual(['comp_closed']);
    expect(population.unreadableCompanyIds).toEqual([]);
  });
});
