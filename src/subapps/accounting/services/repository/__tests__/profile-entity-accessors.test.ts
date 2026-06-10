/**
 * Unit tests for the profile entity accessors (ADR-440).
 *
 * Pins the SSoT semantics: partners / members / shareholders are read from the
 * company profile (`accounting_settings/{companyId}`) by entityType discrimination.
 * A non-matching form (e.g. shareholders on an ΟΕ profile) MUST return `[]`.
 *
 * @module subapps/accounting/services/repository/__tests__/profile-entity-accessors
 * @enterprise ADR-440 — Accounting Entity-Data SSoT
 */

import {
  getProfilePartners,
  getProfileMembers,
  getProfileShareholders,
} from '@/subapps/accounting/services/repository/profile-entity-accessors';
import type {
  OECompanyProfile,
  EPECompanyProfile,
  AECompanyProfile,
  SoleProprietorProfile,
} from '@/subapps/accounting/types/company';
import type { Partner, Member, Shareholder } from '@/subapps/accounting/types/entity';

// ── Minimal valid fixtures ─────────────────────────────────────────────────

const partner: Partner = {
  partnerId: 'prt_1',
  fullName: 'Α. Εταίρος',
  vatNumber: '123456789',
  taxOffice: 'Α ΑΘΗΝΩΝ',
  profitSharePercent: 100,
  efkaConfig: {
    selectedMainPensionCode: 'main_1',
    selectedSupplementaryCode: 'supplementary_1',
    selectedLumpSumCode: 'lump_sum_1',
    efkaRegistrationNumber: '',
    activityStartDate: '',
    notes: null,
  },
  isFirstFiveYears: false,
  joinDate: '2024-01-01',
  exitDate: null,
  isActive: true,
};

const member: Member = {
  memberId: 'mbr_1',
  fullName: 'Β. Μέλος',
  vatNumber: '234567891',
  taxOffice: 'Α ΑΘΗΝΩΝ',
  sharesCount: 100,
  shareNominalValue: 30,
  capitalContribution: 3000,
  dividendSharePercent: 100,
  isManager: true,
  efkaConfig: null,
  isFirstFiveYears: false,
  joinDate: '2024-01-01',
  exitDate: null,
  isActive: true,
};

const shareholder: Shareholder = {
  shareholderId: 'shr_1',
  fullName: 'Γ. Μέτοχος',
  vatNumber: '345678912',
  taxOffice: 'Α ΑΘΗΝΩΝ',
  sharesCount: 1000,
  shareNominalValue: 1,
  capitalContribution: 1000,
  dividendSharePercent: 100,
  isBoardMember: true,
  boardRole: 'ceo',
  monthlyCompensation: 2000,
  efkaMode: 'self_employed',
  efkaConfig: null,
  isFirstFiveYears: false,
  joinDate: '2024-01-01',
  exitDate: null,
  isActive: true,
};

const base = {
  businessName: 'Test ΑΕ',
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
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
};

const oeProfile: OECompanyProfile = { ...base, entityType: 'oe', gemiNumber: null, partners: [partner] };
const epeProfile: EPECompanyProfile = { ...base, entityType: 'epe', gemiNumber: '123', members: [member], shareCapital: 3000 };
const aeProfile: AECompanyProfile = { ...base, entityType: 'ae', gemiNumber: '456', shareholders: [shareholder], shareCapital: 25000 };
const soleProfile: SoleProprietorProfile = { ...base, entityType: 'sole_proprietor', efkaCategory: 1 };

describe('profile-entity-accessors (ADR-440)', () => {
  describe('getProfilePartners', () => {
    it('returns partners for an ΟΕ profile', () => {
      expect(getProfilePartners(oeProfile)).toEqual([partner]);
    });
    it('returns [] for non-ΟΕ profiles', () => {
      expect(getProfilePartners(aeProfile)).toEqual([]);
      expect(getProfilePartners(epeProfile)).toEqual([]);
      expect(getProfilePartners(soleProfile)).toEqual([]);
    });
    it('returns [] for null profile', () => {
      expect(getProfilePartners(null)).toEqual([]);
    });
  });

  describe('getProfileMembers', () => {
    it('returns members for an ΕΠΕ profile', () => {
      expect(getProfileMembers(epeProfile)).toEqual([member]);
    });
    it('returns [] for non-ΕΠΕ profiles and null', () => {
      expect(getProfileMembers(oeProfile)).toEqual([]);
      expect(getProfileMembers(aeProfile)).toEqual([]);
      expect(getProfileMembers(null)).toEqual([]);
    });
  });

  describe('getProfileShareholders', () => {
    it('returns shareholders for an ΑΕ profile', () => {
      expect(getProfileShareholders(aeProfile)).toEqual([shareholder]);
    });
    it('returns [] for non-ΑΕ profiles and null (semantics: shareholders ≠ partners ≠ members)', () => {
      expect(getProfileShareholders(oeProfile)).toEqual([]);
      expect(getProfileShareholders(epeProfile)).toEqual([]);
      expect(getProfileShareholders(soleProfile)).toEqual([]);
      expect(getProfileShareholders(null)).toEqual([]);
    });
  });
});
