/**
 * @jest-environment node
 *
 * 🔒 ΑΓΚΥΡΕΣ Α1 · Α2 — ADR-866 §7 · **ΣΕ ΠΟΙΟΝ ΑΝΗΚΕΙ ΕΝΑ ΕΓΓΡΑΦΟ**
 *
 * Το πρωτογενές που μοιράζονται το ιστορικό (ADR-864 Φ1β) και τα αρχεία (ADR-866 Φ0).
 *
 * | Μετάλλαξη | Αποτέλεσμα |
 * |---|---|
 * | αφαίρεση του `?: never` | Α1 ⇒ 🔴 στον έλεγχο τύπων (`@ts-expect-error` χωρίς σφάλμα) |
 * | ανταλλαγή κλάδων στο `custodyScopeOf` / `custodyKindOf` | Α2 ⇒ 🔴 |
 * | το σύνορο αποδίδει έγγραφο χωρίς ή με δύο κατόχους | Α2.γ ⇒ 🔴 |
 * | άγνωστη παράμετρος ⇒ προεπιλογή αντί άρνησης | Α2.δ ⇒ 🔴 |
 *
 * ⚠️ Το Α1 το επικυρώνει **μόνο** ο έλεγχος τύπων (pre-commit hook / CI, N.17) — το jest δεν
 * ελέγχει τύπους. Η συνάρτηση δεν εκτελείται· υπάρχει για να **μη μεταγλωττίζεται** η παράβαση.
 */

import {
  CUSTODY_KINDS,
  custodyKindFromParam,
  custodyKindOf,
  custodyKindOfScope,
  custodyScopeFromData,
  custodyScopeOf,
  isWritableCustodyScope,
  type CustodyScope,
} from '@/lib/workspace/custody-scope';
import { orgWorkspace, personalWorkspace } from '@/types/workspace-membership';

/** Α1 — κάτοχος **και** με τα δύο πεδία δεν μεταγλωττίζεται. */
export function a1BothOwnersDoNotCompile(): readonly CustodyScope[] {
  return [
    // @ts-expect-error — εταιρεία ΚΑΙ άνθρωπος: ο φρουρός `?: never`
    { companyId: 'comp_1', userId: 'user_1' },
    // @ts-expect-error — κανένας κάτοχος
    {},
  ];
}

describe('Α2 — η ΜΙΑ μετάφραση χώρου → κατόχου', () => {
  it('χώρος γραφείου ⇒ `{ companyId }`, είδος `company`', () => {
    const workspace = orgWorkspace('comp_1');
    expect(custodyScopeOf(workspace)).toEqual({ companyId: 'comp_1' });
    expect(custodyKindOf(workspace)).toBe('company');
  });

  it('🔴 προσωπικός χώρος ⇒ `{ userId }` ΧΩΡΙΣ `companyId`, είδος `personal`', () => {
    const workspace = personalWorkspace('user_1');
    const scope = custodyScopeOf(workspace);
    expect(scope).toEqual({ userId: 'user_1' });
    expect('companyId' in scope).toBe(false);
    expect(custodyKindOf(workspace)).toBe('personal');
  });

  it('το είδος ενός κατόχου συμφωνεί με το είδος του χώρου του', () => {
    for (const workspace of [orgWorkspace('comp_1'), personalWorkspace('user_1')]) {
      expect(custodyKindOfScope(custodyScopeOf(workspace))).toBe(custodyKindOf(workspace));
    }
  });

  it('τα είδη είναι ακριβώς δύο, με σταθερή σειρά (όποιος σαρώνει, σαρώνει και τα δύο)', () => {
    expect(CUSTODY_KINDS).toEqual(['company', 'personal']);
  });
});

describe('Α2.γ — το σύνορο ανάγνωσης: ΑΚΡΙΒΩΣ ένας κάτοχος ή τίποτα', () => {
  it.each([
    ['μόνο εταιρεία', { companyId: 'comp_1' }, { companyId: 'comp_1' }],
    ['μόνο άνθρωπος', { userId: 'user_1' }, { userId: 'user_1' }],
    ['🔴 και οι δύο', { companyId: 'comp_1', userId: 'user_1' }, null],
    ['🔴 κανένας', {}, null],
    ['🔴 κενά = απουσία', { companyId: '', userId: '' }, null],
    ['κενή εταιρεία + άνθρωπος ⇒ άνθρωπος', { companyId: '', userId: 'user_1' }, { userId: 'user_1' }],
    ['🔴 μη συμβολοσειρά', { companyId: 42 }, null],
  ])('%s', (_label, data, expected) => {
    expect(custodyScopeFromData(data)).toEqual(expected);
  });

  it('🔴 ο φρουρός γραφής αρνείται κενό κάτοχο που ο τύπος αφήνει να περάσει', () => {
    expect(isWritableCustodyScope({ userId: '' })).toBe(false);
    expect(isWritableCustodyScope({ companyId: '' })).toBe(false);
    expect(isWritableCustodyScope({ userId: 'user_1' })).toBe(true);
    expect(isWritableCustodyScope({ companyId: 'comp_1' })).toBe(true);
  });
});

describe('Α2.δ — παράμετρος σύρματος: fail closed', () => {
  it('απουσία ⇒ `company` (ό,τι ίσχυε πάντα)', () => {
    expect(custodyKindFromParam(null)).toBe('company');
  });

  it.each(['company', 'personal'] as const)('γνωστή τιμή `%s` ⇒ η ίδια', (value) => {
    expect(custodyKindFromParam(value)).toBe(value);
  });

  it.each(['Personal', '', 'org', 'userId'])('🔴 άγνωστη τιμή `%s` ⇒ άρνηση, ΠΟΤΕ προεπιλογή', (value) => {
    expect(custodyKindFromParam(value)).toBeNull();
  });
});
