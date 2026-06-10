/**
 * Unit tests for the company ownership audit diff (ADR-440).
 *
 * Pins that ownership/dividend changes (and legal-form changes) are detected and
 * summarised, while no-op edits produce no audit entry (signal-rich log).
 *
 * @module subapps/accounting/services/audit/__tests__/company-ownership-audit
 * @enterprise ADR-440 — Accounting Entity-Data SSoT
 */

import { diffCompanyOwnership } from '@/subapps/accounting/services/audit/company-ownership-audit';
import type {
  CompanyProfile,
  AESetupInput,
  OESetupInput,
} from '@/subapps/accounting/types/company';
import type { Shareholder, Partner } from '@/subapps/accounting/types/entity';

const base = {
  businessName: 'Test ΑΕ', profession: 'Αρχ', vatNumber: '999999999', taxOffice: 'Α',
  address: 'Οδ 1', city: 'Αθ', postalCode: '10000', phone: null, mobile: null, email: null, website: null,
  mainKad: { code: '71112000', description: 'Αρχ', type: 'primary' as const, activeFrom: '2024-01-01' },
  secondaryKads: [], bookCategory: 'double_entry' as const, vatRegime: 'normal' as const,
  fiscalYearEnd: 12, currency: 'EUR' as const, invoiceSeries: [],
};

function shareholder(over: Partial<Shareholder> = {}): Shareholder {
  return {
    shareholderId: 'shr_1', fullName: 'Γ', vatNumber: '345678912', taxOffice: 'Α',
    sharesCount: 1000, shareNominalValue: 1, capitalContribution: 1000, dividendSharePercent: 100,
    isBoardMember: false, boardRole: null, monthlyCompensation: null, efkaMode: 'none', efkaConfig: null,
    isFirstFiveYears: false, joinDate: '2024-01-01', exitDate: null, isActive: true, ...over,
  };
}

function partner(over: Partial<Partner> = {}): Partner {
  return {
    partnerId: 'prt_1', fullName: 'Α', vatNumber: '123456789', taxOffice: 'Α', profitSharePercent: 100,
    efkaConfig: { selectedMainPensionCode: 'main_1', selectedSupplementaryCode: 'supplementary_1', selectedLumpSumCode: 'lump_sum_1', efkaRegistrationNumber: '', activityStartDate: '', notes: null },
    isFirstFiveYears: false, joinDate: '2024-01-01', exitDate: null, isActive: true, ...over,
  };
}

const aeInput = (shareholders: Shareholder[]): AESetupInput => ({ ...base, entityType: 'ae', gemiNumber: '1', shareholders, shareCapital: 25000 });
const oeInput = (partners: Partner[]): OESetupInput => ({ ...base, entityType: 'oe', gemiNumber: null, partners });
const aeProfile = (shareholders: Shareholder[]): CompanyProfile => ({ ...aeInput(shareholders), createdAt: '2024-01-01', updatedAt: '2024-01-01' });

describe('diffCompanyOwnership (ADR-440)', () => {
  it('no change when shareholders identical → no audit', () => {
    const r = diffCompanyOwnership(aeProfile([shareholder()]), aeInput([shareholder()]));
    expect(r.changed).toBe(false);
  });

  it('first setup with shareholders → changed (all added)', () => {
    const r = diffCompanyOwnership(null, aeInput([shareholder()]));
    expect(r.changed).toBe(true);
    expect(r.metadata.addedCount).toBe(1);
  });

  it('first setup with empty array → no audit', () => {
    expect(diffCompanyOwnership(null, aeInput([])).changed).toBe(false);
  });

  it('added shareholder + dividend re-split → added + modified', () => {
    const before = aeProfile([shareholder({ shareholderId: 'shr_1', dividendSharePercent: 100 })]);
    const after = aeInput([
      shareholder({ shareholderId: 'shr_1', dividendSharePercent: 60 }),
      shareholder({ shareholderId: 'shr_2', vatNumber: '234567891', dividendSharePercent: 40 }),
    ]);
    const r = diffCompanyOwnership(before, after);
    expect(r.changed).toBe(true);
    expect(r.metadata.addedCount).toBe(1);
    expect(r.metadata.modifiedCount).toBe(1);
    const changes = JSON.parse(r.metadata.changes as string);
    expect(changes.modified[0]).toMatchObject({ id: 'shr_1', from: 100, to: 60 });
  });

  it('removed shareholder → removed count', () => {
    const before = aeProfile([
      shareholder({ shareholderId: 'shr_1', dividendSharePercent: 50 }),
      shareholder({ shareholderId: 'shr_2', vatNumber: '234567891', dividendSharePercent: 50 }),
    ]);
    const r = diffCompanyOwnership(before, aeInput([shareholder({ shareholderId: 'shr_1', dividendSharePercent: 50 })]));
    expect(r.changed).toBe(true);
    expect(r.metadata.removedCount).toBe(1);
  });

  it('legal-form change ΟΕ→ΑΕ → changed + formChanged flag', () => {
    const before: CompanyProfile = { ...oeInput([partner()]), createdAt: '2024-01-01', updatedAt: '2024-01-01' };
    const r = diffCompanyOwnership(before, aeInput([shareholder()]));
    expect(r.changed).toBe(true);
    expect(r.metadata.formChanged).toBe(true);
    expect(r.metadata.previousEntityType).toBe('oe');
    expect(r.details).toMatch(/oe→ae/);
  });

  it('sole proprietor → no ownership arrays → no audit', () => {
    const r = diffCompanyOwnership(null, { ...base, entityType: 'sole_proprietor', efkaCategory: 1 });
    expect(r.changed).toBe(false);
  });
});
