/**
 * Unit tests for the entity-arrays validator (ADR-440).
 *
 * Pins the money-affecting guarantees on the live company-setup write path:
 * dividend/profit sums = 100% (when non-empty), valid ΑΦΜ, board-role coherence,
 * empty-array-allowed (incremental setup), and server-authoritative ΑΕ EFKA mode.
 *
 * @module subapps/accounting/services/validation/__tests__/entity-arrays-validator
 * @enterprise ADR-440 — Accounting Entity-Data SSoT
 */

import {
  validateCompanyEntityArrays,
  deriveShareholderEfkaModes,
} from '@/subapps/accounting/services/validation/entity-arrays-validator';
import type {
  OESetupInput,
  EPESetupInput,
  AESetupInput,
  SoleProprietorSetupInput,
} from '@/subapps/accounting/types/company';
import type { Partner, Member, Shareholder } from '@/subapps/accounting/types/entity';

// ── Fixtures ────────────────────────────────────────────────────────────────

const base = {
  businessName: 'Test',
  profession: 'Αρχιτέκτονας',
  vatNumber: '999999999',
  taxOffice: 'Α ΑΘΗΝΩΝ',
  address: 'Οδός 1',
  city: 'Αθήνα',
  postalCode: '10000',
  phone: null,
  mobile: null,
  email: null,
  website: null,
  mainKad: { code: '71112000', description: 'Αρχιτέκτονες', type: 'primary' as const, activeFrom: '2024-01-01' },
  secondaryKads: [],
  bookCategory: 'double_entry' as const,
  vatRegime: 'normal' as const,
  fiscalYearEnd: 12,
  currency: 'EUR' as const,
  invoiceSeries: [],
};

function partner(over: Partial<Partner> = {}): Partner {
  return {
    partnerId: 'prt_1', fullName: 'Α', vatNumber: '123456789', taxOffice: 'Α',
    profitSharePercent: 100, isFirstFiveYears: false, joinDate: '2024-01-01',
    exitDate: null, isActive: true,
    efkaConfig: {
      selectedMainPensionCode: 'main_1', selectedSupplementaryCode: 'supplementary_1',
      selectedLumpSumCode: 'lump_sum_1', efkaRegistrationNumber: '', activityStartDate: '', notes: null,
    },
    ...over,
  };
}

function member(over: Partial<Member> = {}): Member {
  return {
    memberId: 'mbr_1', fullName: 'Β', vatNumber: '234567891', taxOffice: 'Α',
    sharesCount: 100, shareNominalValue: 30, capitalContribution: 3000,
    dividendSharePercent: 100, isManager: true, efkaConfig: null,
    isFirstFiveYears: false, joinDate: '2024-01-01', exitDate: null, isActive: true,
    ...over,
  };
}

function shareholder(over: Partial<Shareholder> = {}): Shareholder {
  return {
    shareholderId: 'shr_1', fullName: 'Γ', vatNumber: '345678912', taxOffice: 'Α',
    sharesCount: 1000, shareNominalValue: 1, capitalContribution: 1000,
    dividendSharePercent: 100, isBoardMember: false, boardRole: null,
    monthlyCompensation: null, efkaMode: 'none', efkaConfig: null,
    isFirstFiveYears: false, joinDate: '2024-01-01', exitDate: null, isActive: true,
    ...over,
  };
}

const oe = (partners: Partner[]): OESetupInput => ({ ...base, entityType: 'oe', gemiNumber: null, partners });
const epe = (members: Member[]): EPESetupInput => ({ ...base, entityType: 'epe', gemiNumber: '1', members, shareCapital: 3000 });
const ae = (shareholders: Shareholder[]): AESetupInput => ({ ...base, entityType: 'ae', gemiNumber: '1', shareholders, shareCapital: 25000 });
const sole: SoleProprietorSetupInput = { ...base, entityType: 'sole_proprietor', efkaCategory: 1 };

// ── validateCompanyEntityArrays ─────────────────────────────────────────────

describe('validateCompanyEntityArrays (ADR-440)', () => {
  it('sole proprietor → always valid (no entity arrays)', () => {
    expect(validateCompanyEntityArrays(sole)).toBeNull();
  });

  it('empty array → valid (incremental setup allowed)', () => {
    expect(validateCompanyEntityArrays(oe([]))).toBeNull();
    expect(validateCompanyEntityArrays(epe([]))).toBeNull();
    expect(validateCompanyEntityArrays(ae([]))).toBeNull();
  });

  it('ΟΕ: valid when active profit shares sum to 100%', () => {
    expect(validateCompanyEntityArrays(oe([
      partner({ partnerId: 'prt_1', profitSharePercent: 60 }),
      partner({ partnerId: 'prt_2', vatNumber: '234567891', profitSharePercent: 40 }),
    ]))).toBeNull();
  });

  it('ΟΕ: rejects when profit shares do not sum to 100% (silent-miscalc guard)', () => {
    expect(validateCompanyEntityArrays(oe([partner({ profitSharePercent: 80 })])))
      .toMatch(/sum must equal 100%/);
  });

  it('ΟΕ: rejects malformed ΑΦΜ', () => {
    expect(validateCompanyEntityArrays(oe([partner({ vatNumber: '123' })])))
      .toMatch(/vatNumber must be 9 digits/);
  });

  it('ΕΠΕ: rejects dividend sum ≠ 100%', () => {
    expect(validateCompanyEntityArrays(epe([member({ dividendSharePercent: 50 })])))
      .toMatch(/sum must equal 100%/);
  });

  it('ΑΕ: valid when dividends sum to 100%', () => {
    expect(validateCompanyEntityArrays(ae([shareholder({ dividendSharePercent: 100 })]))).toBeNull();
  });

  it('ΑΕ: rejects board member without boardRole', () => {
    expect(validateCompanyEntityArrays(ae([shareholder({ isBoardMember: true, boardRole: null })])))
      .toMatch(/boardRole is required/);
  });

  it('inactive members are excluded from the 100% sum', () => {
    expect(validateCompanyEntityArrays(oe([
      partner({ partnerId: 'prt_1', profitSharePercent: 100 }),
      partner({ partnerId: 'prt_2', vatNumber: '234567891', profitSharePercent: 25, isActive: false }),
    ]))).toBeNull();
  });
});

// ── deriveShareholderEfkaModes ──────────────────────────────────────────────

describe('deriveShareholderEfkaModes (ADR-440 — server authority)', () => {
  it('non-board → none', () => {
    const [s] = deriveShareholderEfkaModes([shareholder({ isBoardMember: false, monthlyCompensation: 2000 })]);
    expect(s.efkaMode).toBe('none');
  });

  it('board + compensation + shares ≥ 3% → self_employed', () => {
    const result = deriveShareholderEfkaModes([
      shareholder({ shareholderId: 'shr_1', sharesCount: 50, isBoardMember: true, boardRole: 'ceo', monthlyCompensation: 2000 }),
      shareholder({ shareholderId: 'shr_2', sharesCount: 950, vatNumber: '234567891' }),
    ]);
    expect(result[0].efkaMode).toBe('self_employed'); // 50/1000 = 5% ≥ 3%
  });

  it('board + compensation + shares < 3% → employee', () => {
    const result = deriveShareholderEfkaModes([
      shareholder({ shareholderId: 'shr_1', sharesCount: 20, isBoardMember: true, boardRole: 'member', monthlyCompensation: 1500 }),
      shareholder({ shareholderId: 'shr_2', sharesCount: 980, vatNumber: '234567891' }),
    ]);
    expect(result[0].efkaMode).toBe('employee'); // 20/1000 = 2% < 3%
  });

  it('corrects a wrong client-supplied efkaMode', () => {
    const [s] = deriveShareholderEfkaModes([
      shareholder({ isBoardMember: false, monthlyCompensation: null, efkaMode: 'self_employed' }),
    ]);
    expect(s.efkaMode).toBe('none');
  });
});
