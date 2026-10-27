/**
 * Επιλογή Σύμβασης-Πλαίσιο ανά γραμμή — ο ΕΝΑΣ επιλογέας (ADR-923 §5.11 «3γ», Α1 + Α3 + Α4).
 * Πριν: `resolveActiveFa` = «η πρώτη της λίστας», `[]` = «όλα», εύρος υλικών/ΑΤΟΕ αδιάβαστο.
 */

import {
  faDiscountRule,
  scopeCovers,
  selectLineAgreement,
  type FaLineContext,
} from '../framework-agreement-discount';
import {
  FA_INSIDE_MS,
  FA_VALID_FROM,
  FA_VALID_UNTIL,
  makeAgreement,
} from '../../__fixtures__/framework-agreement-fixture';

const LINE: FaLineContext = { supplierId: 'sup_1', projectId: 'p_1', materialId: 'm_cable', categoryCode: 'OIK-7' };

function winnerId(agreements: Parameters<typeof selectLineAgreement>[0], line = LINE, atMs = FA_INSIDE_MS): string | null {
  const selection = selectLineAgreement(agreements, line, atMs);
  return selection.kind === 'selected' ? selection.winnerId : null;
}

function verdictOf(agreements: Parameters<typeof selectLineAgreement>[0], id: string, line = LINE, atMs = FA_INSIDE_MS): string | undefined {
  return selectLineAgreement(agreements, line, atMs).trace.find((entry) => entry.id === id)?.verdict;
}

describe('scopeCovers — null = όλα · [] = κανένα · λίστα = μέλος (Α4)', () => {
  it.each([
    [null, 'x', true],
    [[], 'x', false],
    [['x'], 'x', true],
    [['y'], 'x', false],
    [['x'], null, false],
  ] as const)('scope %j, value %j ⇒ %s', (scope, value, expected) => {
    expect(scopeCovers(scope, value)).toBe(expected);
  });
});

describe('Α1 — ο ειδικότερος νικά, ανεξάρτητα από τη σειρά της λίστας', () => {
  const general = makeAgreement('general', { flatDiscountPercent: 5 });
  const forProject = makeAgreement('project', { applicableProjectIds: ['p_1'], flatDiscountPercent: 12 });

  it('ειδική για το έργο > γενική, και στις δύο σειρές', () => {
    expect(winnerId([general, forProject])).toBe('project');
    expect(winnerId([forProject, general])).toBe('project');
  });

  it('υλικό > ΑΤΟΕ > όλα (SAP access sequence)', () => {
    const byCategory = makeAgreement('category', { applicableAtoeCategoryCodes: ['OIK-7'] });
    const byMaterial = makeAgreement('material', { applicableMaterialIds: ['m_cable'] });
    expect(winnerId([general, byCategory, byMaterial])).toBe('material');
    expect(winnerId([byCategory, general])).toBe('category');
  });

  it('η ειδικότητα γραμμής μετρά ΠΡΙΝ από την ειδικότητα έργου', () => {
    const materialAllProjects = makeAgreement('material', { applicableMaterialIds: ['m_cable'] });
    expect(winnerId([forProject, materialAllProjects])).toBe('material');
  });

  it('ισοπαλία ⇒ ambiguous με ΟΛΟΥΣ τους ισόπαλους — ποτέ «η πρώτη»', () => {
    const selection = selectLineAgreement([makeAgreement('a'), makeAgreement('b')], LINE, FA_INSIDE_MS);
    expect(selection.kind).toBe('ambiguous');
    if (selection.kind === 'ambiguous') expect([...selection.tiedIds].sort()).toEqual(['a', 'b']);
  });
});

describe('Α3 + Α4 — εύρος γραμμής', () => {
  it('σύμβαση μόνο για καλώδια ΔΕΝ αφορά γραμμή τσιμέντου', () => {
    const cables = makeAgreement('cables', { applicableMaterialIds: ['m_cable'] });
    const cement = { ...LINE, materialId: 'm_cement', categoryCode: 'OIK-2' };
    expect(winnerId([cables], cement)).toBeNull();
    expect(verdictOf([cables], 'cables', cement)).toBe('itemOutOfScope');
  });

  it('γραμμή χωρίς υλικό δεν ταιριάζει σε λίστα υλικών', () => {
    const cables = makeAgreement('cables', { applicableMaterialIds: ['m_cable'] });
    expect(winnerId([cables], { ...LINE, materialId: null })).toBeNull();
  });

  it('αρκεί ΕΝΑΣ δηλωμένος περιορισμός: υλικό εκτός, ΑΤΟΕ εντός ⇒ ισχύει', () => {
    const fa = makeAgreement('mixed', { applicableMaterialIds: ['m_other'], applicableAtoeCategoryCodes: ['OIK-7'] });
    expect(winnerId([fa])).toBe('mixed');
  });

  it('`[]` = κανένα: υλικά [] χωρίς ΑΤΟΕ ⇒ η σύμβαση δεν αφορά καμία γραμμή', () => {
    expect(winnerId([makeAgreement('none', { applicableMaterialIds: [] })])).toBeNull();
  });

  it('`[]` έργων = κανένα έργο (πριν σήμαινε «όλα»)', () => {
    expect(winnerId([makeAgreement('none', { applicableProjectIds: [] })])).toBeNull();
    expect(verdictOf([makeAgreement('none', { applicableProjectIds: [] })], 'none')).toBe('projectOutOfScope');
  });
});

describe('σκληρά φίλτρα και ίχνος', () => {
  it.each([
    ['otherVendor', { vendorContactId: 'sup_2' }],
    ['inactive', { status: 'draft' as const }],
    ['deleted', { isDeleted: true }],
    ['unreadableValidity', { validUntil: 'not-a-date' }],
  ] as const)('%s', (verdict, overrides) => {
    const fa = makeAgreement('x', overrides);
    expect(winnerId([fa])).toBeNull();
    expect(verdictOf([fa], 'x')).toBe(verdict);
  });

  it('το «έως» είναι συμπεριληπτικό: ισχύει ΑΚΡΙΒΩΣ τη στιγμή validUntil, όχι 1 ms μετά', () => {
    const until = Date.parse(FA_VALID_UNTIL);
    const fa = makeAgreement('x');
    expect(winnerId([fa], LINE, until)).toBe('x');
    expect(verdictOf([fa], 'x', LINE, until + 1)).toBe('expired');
  });

  it('πριν το validFrom ⇒ notYetValid', () => {
    expect(verdictOf([makeAgreement('x')], 'x', LINE, Date.parse(FA_VALID_FROM) - 1)).toBe('notYetValid');
  });
});

describe('faDiscountRule — η σύμβαση ως κανόνας της ΜΙΑΣ μηχανής', () => {
  it('flat 10% ⇒ αλυσίδα ενός βήματος 1000 bp', () => {
    expect(faDiscountRule(makeAgreement('x'))).toEqual({ kind: 'chain', steps: [1000] });
  });

  it('κλίμακες σε λεπτά', () => {
    const fa = makeAgreement('x', {
      discountType: 'volume_breakpoints',
      flatDiscountPercent: null,
      volumeBreakpoints: [{ thresholdEur: 1000, discountPercent: 5 }, { thresholdEur: 5000, discountPercent: 10 }],
    });
    expect(faDiscountRule(fa)).toEqual({
      kind: 'tiers',
      basis: 'amount',
      tiers: [{ min: 100000, steps: [500] }, { min: 500000, steps: [1000] }],
    });
  });

  it('μη αναπαραστάσιμο ποσοστό (3ο δεκαδικό) ⇒ καμία έκπτωση, όχι σιωπηλή στρογγύλευση', () => {
    expect(faDiscountRule(makeAgreement('x', { flatDiscountPercent: 10.555 }))).toEqual({ kind: 'chain', steps: [] });
  });
});
