/**
 * @jest-environment node
 *
 * =============================================================================
 * Ο ΕΝΑΣ ΤΑΞΙΝΟΜΗΤΗΣ — «ΑΠΩΝ» ≠ «ΑΚΥΡΟΣ» ΡΟΛΟΣ (ADR-853 §14 · ADR-817 §11)
 * =============================================================================
 *
 * 🔴 **ΤΟ ΓΕΓΟΝΟΣ** (μετρημένο ζωντανά 2026-09-13): ο νέος προσκεκλημένος συνδέθηκε, δεν
 * είχε claim ρόλου, και η σελίδα της πρόσκλησης του ξαναζητούσε σύνδεση **για πάντα** —
 * γιατί ο server διάβαζε το «απών» ως «άκυρο».
 *
 * 🔑 **ΓΙΑΤΙ ΚΑΜΙΑ ΑΓΚΥΡΑ ΔΕΝ ΤΟ ΕΠΙΑΣΕ**: **κάθε** fixture των σουιτών ταυτότητας είχε ρόλο.
 * Αυτή η σουίτα υπάρχει για να κάνει την απουσία **πρώτης τάξεως περίπτωση**.
 *
 * Μεταλλάξεις που ΠΡΕΠΕΙ να την κοκκινίσουν (εκτελεσμένες — ADR-853 §14):
 *   Μ1 `isAbsentRoleClaim` ⇒ πάντα `false` (απών = άκυρος — το ελάττωμα που έκλεισε)
 *   Μ2 μη-συμβολοσειρά ⇒ απουσία (άκυρος = απών — χαλάρωση ασφαλείας)
 *   Μ3 απών ρόλος + εταιρεία ⇒ `organization`
 *   Μ4 ο χώρος κρίνεται ΠΡΙΝ τον άκυρο ρόλο (παραβίαση ADR-807 §3.4β)
 */

import {
  classifyIdentityClaims,
  isAbsentRoleClaim,
  readGlobalRoleClaim,
} from '../identity-claims';
import { decideCapability } from '../authority';
import type { PermissionId } from '../types';

const COMPANY = 'comp_alpha';
const ACTION = 'admin_access' as PermissionId;

// =============================================================================
// Α — Ο ΑΝΑΓΝΩΣΤΗΣ ΤΟΥ ΡΟΛΟΥ
// =============================================================================

describe('Α. readGlobalRoleClaim — τρεις καταστάσεις, ποτέ boolean', () => {
  it.each([
    ['undefined (κανένα claim)', undefined],
    ['null (όπως το γράφει το identity-record)', null],
    ['κενή συμβολοσειρά (ADR-657 §3.5)', ''],
    ['μόνο κενά', '   '],
  ])('Α1 — %s ⇒ `absent`', (_label, raw) => {
    expect(readGlobalRoleClaim(raw)).toEqual({ kind: 'absent' });
    expect(isAbsentRoleClaim(raw)).toBe(true);
  });

  it.each(['super_admin', 'company_admin', 'internal_user', 'external_user'])(
    'Α2 — ΠΑΡΟΝΟΜΑΣΤΗΣ: «%s» ⇒ `assigned`',
    (role) => {
      expect(readGlobalRoleClaim(role)).toEqual({ kind: 'assigned', role });
    },
  );

  it.each([
    ['ρόλος εκτός λεξιλογίου', 'admin'],
    ['ρόλος με κενά γύρω — κανένας γραφέας μας δεν τον παράγει', ' company_admin'],
    ['αριθμός', 42],
    ['αντικείμενο', {}],
    ['πίνακας', ['company_admin']],
    ['boolean', true],
  ])('Α3 — 🔒 %s ⇒ `invalid`, ΠΟΤΕ `absent`', (_label, raw) => {
    expect(readGlobalRoleClaim(raw)).toEqual({ kind: 'invalid' });
    expect(isAbsentRoleClaim(raw)).toBe(false);
  });
});

// =============================================================================
// Π — Ο ΠΙΝΑΚΑΣ ΡΟΛΟΣ × ΧΩΡΟΣ
// =============================================================================

describe('Π. classifyIdentityClaims — άλλαξε ΕΝΑ κελί, και μόνο ένα', () => {
  it('Π1 — έγκυρος ρόλος + εταιρεία ⇒ `organization`', () => {
    expect(classifyIdentityClaims({ globalRole: 'company_admin', companyId: COMPANY })).toEqual({
      kind: 'organization',
      globalRole: 'company_admin',
      companyId: COMPANY,
    });
  });

  it('Π2 — έγκυρος ρόλος χωρίς εταιρεία ⇒ `personal` με τον ρόλο', () => {
    expect(classifyIdentityClaims({ globalRole: 'external_user' })).toEqual({
      kind: 'personal',
      globalRole: 'external_user',
    });
  });

  it('Π3 — 🔑 ΤΟ ΝΕΟ ΚΕΛΙ: απών ρόλος χωρίς εταιρεία ⇒ `personal` με `globalRole: null`', () => {
    expect(classifyIdentityClaims({})).toEqual({ kind: 'personal', globalRole: null });
    expect(classifyIdentityClaims({ globalRole: null, companyId: null })).toEqual({
      kind: 'personal',
      globalRole: null,
    });
    expect(classifyIdentityClaims({ globalRole: '', companyId: '' })).toEqual({
      kind: 'personal',
      globalRole: null,
    });
  });

  it('Π4 — 🔒 απών ρόλος ΜΕ εταιρεία ⇒ απόρριψη (ποτέ υποβιβασμός σε personal)', () => {
    expect(classifyIdentityClaims({ companyId: COMPANY })).toEqual({
      kind: 'rejected',
      why: 'workspace-without-role',
    });
  });

  it.each([
    ['χωρίς εταιρεία', undefined],
    ['με εταιρεία', COMPANY],
  ])('Π5 — 🔒 ADR-807 §3.4β: άκυρος ρόλος %s ⇒ `invalid-role`, ΠΡΙΝ τον χώρο', (_l, companyId) => {
    expect(classifyIdentityClaims({ globalRole: 'not_a_real_role', companyId })).toEqual({
      kind: 'rejected',
      why: 'invalid-role',
    });
    expect(classifyIdentityClaims({ globalRole: 42, companyId })).toEqual({
      kind: 'rejected',
      why: 'invalid-role',
    });
  });
});

// =============================================================================
// Ι — Ο ΠΕΛΑΤΗΣ ΚΑΙ Ο SERVER ΣΥΜΦΩΝΟΥΝ ΓΙΑ ΤΗΝ ΑΠΟΥΣΙΑ
// =============================================================================

describe('Ι. Ισοδυναμία με τον κριτή του πελάτη (authority.ts)', () => {
  it.each([null, undefined, '', '   '])(
    'Ι1 — «%p» είναι απουσία ΚΑΙ για τον κριτή: `denied-insufficient`, ΟΧΙ `denied-unknown-role`',
    (raw) => {
      expect(readGlobalRoleClaim(raw).kind).toBe('absent');
      const subject = { globalRole: raw as string | null | undefined, permissions: null };
      expect(decideCapability({ subject, action: ACTION }).verdict).toBe('denied-insufficient');
    },
  );

  it('Ι2 — ΠΑΡΟΝΟΜΑΣΤΗΣ: άγνωστος ρόλος είναι άκυρος ΚΑΙ για τους δύο', () => {
    expect(readGlobalRoleClaim('not_a_real_role').kind).toBe('invalid');
    const subject = { globalRole: 'not_a_real_role', permissions: null };
    expect(decideCapability({ subject, action: ACTION }).verdict).toBe('denied-unknown-role');
  });
});
