/**
 * @fileoverview Φορολογικό προφίλ οντότητας — SSoT «φόρος εισοδήματος ανά νομική μορφή»
 * @description Ποιος πληρώνει φόρο εισοδήματος, με ποια κλίμακα, και ποιες εισφορές ΕΦΚΑ εκπίπτουν — για
 *   ατομική, ΟΕ, ΕΠΕ και ΑΕ. Το ρωτούν το tax dashboard (ετήσιος φόρος) ΚΑΙ οι αναφορές P&L / Σύνοψη Φόρων
 *   (ενδιάμεσος φόρος κατά IAS 34). Πριν: οι αναφορές είχαν δική τους κλίμακα ατομικής για ΟΛΕΣ τις μορφές
 *   (μια ΕΠΕ έβλεπε 44% αντί 22%), και η φόρτωση ΕΦΚΑ ζούσε τρεις φορές στο `accounting-service`.
 *
 * Μόνο ΦΟΡΟΣ ΕΙΣΟΔΗΜΑΤΟΣ (IAS 12): χωρίς προκαταβολή (ταμειακή υποχρέωση του επόμενου έτους) και χωρίς τέλος
 * επιτηδεύματος (δεν εξαρτάται από τα κέρδη). Οι υπολογισμοί γίνονται από τον `TaxEngine` — εδώ μόνο η διανομή.
 *
 * @see ADR-ACC-010 §2.1.1 (Φάση 2) · ADR-ACC-009 Tax Engine · ADR-ACC-012/014/016
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, SSoT
 */

import type { IAccountingRepository, ITaxEngine } from '../../types/interfaces';
import type { EFKAPayment } from '../../types/efka';
import type { Member, Partner, Shareholder } from '../../types/entity';
import type { PeriodRange } from '../../types/common';
import type { PartnerTaxInput } from '../../types/tax';
import { roundToTwo } from '../../utils/math';

// ============================================================================
// ΕΦΚΑ — ποιες πληρωμές εκπίπτουν, και πότε
// ============================================================================

/**
 * Πότε «πληρώθηκε» μια εισφορά: η ημερομηνία πληρωμής, αλλιώς η λήξη (παλιές εγγραφές χωρίς `paidDate`).
 * Οι εισφορές εκπίπτουν στο έτος που ΚΑΤΑΒΑΛΛΟΝΤΑΙ.
 */
function paidOn(payment: EFKAPayment): string {
  return (payment.paidDate ?? payment.dueDate).slice(0, 10);
}

/** Άθροισμα πληρωμένων εισφορών — όλων, ή μόνο όσων πληρώθηκαν μέσα στην περίοδο. */
export function sumPaidEfka(payments: readonly EFKAPayment[], period?: PeriodRange): number {
  return roundToTwo(
    payments
      .filter((p) => p.status === 'paid')
      .filter((p) => !period || (paidOn(p) >= period.from && paidOn(p) <= period.to))
      .reduce((sum, p) => sum + p.amount, 0)
  );
}

// ============================================================================
// ΠΡΟΦΙΛ ΑΝΑ ΝΟΜΙΚΗ ΜΟΡΦΗ
// ============================================================================

export interface PartnerTaxProfile {
  readonly partner: Partner;
  readonly efka: readonly EFKAPayment[];
}

export type EntityTaxProfile =
  | { readonly kind: 'sole_proprietor'; readonly efka: readonly EFKAPayment[] }
  | { readonly kind: 'oe'; readonly partners: readonly PartnerTaxProfile[] }
  | { readonly kind: 'epe'; readonly members: readonly Member[]; readonly managerEfka: readonly EFKAPayment[] }
  | { readonly kind: 'ae'; readonly shareholders: readonly Shareholder[]; readonly boardEfka: readonly EFKAPayment[] };

export async function loadSoleProprietorProfile(repo: IAccountingRepository, fiscalYear: number): Promise<EntityTaxProfile> {
  return { kind: 'sole_proprietor', efka: await repo.getEFKAPayments(fiscalYear) };
}

export async function loadPartnershipProfile(
  repo: IAccountingRepository,
  fiscalYear: number
): Promise<Extract<EntityTaxProfile, { kind: 'oe' }>> {
  const partners = await repo.getPartners();
  const withEfka = await Promise.all(
    partners.map(async (partner) => ({ partner, efka: await repo.getPartnerEFKAPayments(partner.partnerId, fiscalYear) }))
  );
  return { kind: 'oe', partners: withEfka };
}

/** ΕΠΕ: εκπίπτουν μόνο οι εισφορές των ενεργών διαχειριστών. */
export async function loadEpeProfile(
  repo: IAccountingRepository,
  fiscalYear: number
): Promise<Extract<EntityTaxProfile, { kind: 'epe' }>> {
  const members = await repo.getMembers();
  const managers = members.filter((m) => m.isManager && m.isActive);
  const efka = await Promise.all(managers.map((m) => repo.getMemberEFKAPayments(m.memberId, fiscalYear)));
  return { kind: 'epe', members: members.filter((m) => m.isActive), managerEfka: efka.flat() };
}

/**
 * ΑΕ: εκπίπτουν μόνο οι εισφορές μελών ΔΣ με αμοιβή ως ΑΥΤΟΑΠΑΣΧΟΛΟΥΜΕΝΩΝ — σε σχέση εργασίας είναι κόστος
 * εργοδότη, όχι έκπτωση από τον εταιρικό φόρο (ADR-ACC-017).
 */
export async function loadAeProfile(
  repo: IAccountingRepository,
  fiscalYear: number
): Promise<Extract<EntityTaxProfile, { kind: 'ae' }>> {
  const shareholders = await repo.getShareholders();
  const board = shareholders.filter(
    (s) => s.isBoardMember && s.isActive && s.monthlyCompensation !== null && s.monthlyCompensation > 0 &&
      s.efkaMode === 'self_employed'
  );
  const efka = await Promise.all(board.map((s) => repo.getShareholderEFKAPayments(s.shareholderId, fiscalYear)));
  return { kind: 'ae', shareholders: shareholders.filter((s) => s.isActive), boardEfka: efka.flat() };
}

/** Το προφίλ της εταιρείας του μισθωτή, κατά τη νομική μορφή της (προεπιλογή: ατομική, όπως ο TaxEngine). */
export async function loadEntityTaxProfile(repo: IAccountingRepository, fiscalYear: number): Promise<EntityTaxProfile> {
  const setup = await repo.getCompanySetup();
  switch (setup?.entityType ?? 'sole_proprietor') {
    case 'oe': return loadPartnershipProfile(repo, fiscalYear);
    case 'epe': return loadEpeProfile(repo, fiscalYear);
    case 'ae': return loadAeProfile(repo, fiscalYear);
    default: return loadSoleProprietorProfile(repo, fiscalYear);
  }
}

/** Οι εκπιπτόμενες εισφορές ΕΦΚΑ της οντότητας — όλες, ή όσες πληρώθηκαν μέσα στην περίοδο. */
export function deductibleEfka(profile: EntityTaxProfile, period?: PeriodRange): number {
  switch (profile.kind) {
    case 'sole_proprietor': return sumPaidEfka(profile.efka, period);
    case 'oe': return roundToTwo(profile.partners.reduce((sum, p) => sum + sumPaidEfka(p.efka, period), 0));
    case 'epe': return sumPaidEfka(profile.managerEfka, period);
    case 'ae': return sumPaidEfka(profile.boardEfka, period);
  }
}

/** Είσοδοι του `TaxEngine.calculatePartnershipTax` από το προφίλ ΟΕ (εισφορές × `efkaScale`). */
export function partnershipTaxInputs(
  profile: Extract<EntityTaxProfile, { kind: 'oe' }>,
  efkaScale = 1
): { efkaByPartner: Map<string, number>; partners: PartnerTaxInput[] } {
  return {
    efkaByPartner: new Map(profile.partners.map((p) => [p.partner.partnerId, roundToTwo(sumPaidEfka(p.efka) * efkaScale)])),
    partners: profile.partners.map(({ partner }) => ({
      partnerId: partner.partnerId,
      partnerName: partner.fullName,
      profitSharePercent: partner.profitSharePercent,
      withholdings: 0,
      previousPrepayment: 0,
      isFirstFiveYears: partner.isFirstFiveYears,
    })),
  };
}

// ============================================================================
// ΦΟΡΟΣ ΕΙΣΟΔΗΜΑΤΟΣ ΑΠΟ ΣΥΝΟΛΑ
// ============================================================================

export interface IncomeTaxTotals {
  readonly totalIncome: number;
  readonly totalExpenses: number;
  /** Πολλαπλασιαστής των εισφορών (αναγωγή σε έτος — IAS 34)· 1 = όπως πληρώθηκαν. */
  readonly efkaScale?: number;
}

export interface IncomeTaxOutcome {
  /** Κέρδος μετά τις εκπιπτόμενες εισφορές, πριν από τον φόρο εισοδήματος. */
  readonly profitBeforeTax: number;
  /** Φόρος εισοδήματος (ατομική / εταίροι: κλίμακα + αλληλεγγύη· ΕΠΕ / ΑΕ: εταιρικός συντελεστής). */
  readonly incomeTax: number;
}

/** Ο ετήσιος φόρος εισοδήματος της οντότητας για αυτά τα σύνολα — μέσω του `TaxEngine`, ποτέ δεύτερη κλίμακα. */
export function incomeTaxOf(
  engine: ITaxEngine,
  profile: EntityTaxProfile,
  fiscalYear: number,
  totals: IncomeTaxTotals
): IncomeTaxOutcome {
  const scale = totals.efkaScale ?? 1;
  const { totalIncome, totalExpenses } = totals;
  const efka = roundToTwo(deductibleEfka(profile) * scale);

  switch (profile.kind) {
    case 'sole_proprietor': {
      const result = engine.calculateAnnualTax({
        fiscalYear, totalIncome, totalDeductibleExpenses: totalExpenses, totalEfkaContributions: efka,
        professionalTax: 0, totalWithholdings: 0, previousYearPrepayment: 0, isFirstFiveYears: false,
      });
      return { profitBeforeTax: totalIncome - totalExpenses - efka, incomeTax: roundToTwo(result.incomeTax + result.solidarityContribution) };
    }
    case 'oe': {
      const { efkaByPartner, partners } = partnershipTaxInputs(profile, scale);
      const result = engine.calculatePartnershipTax(fiscalYear, totalIncome, totalExpenses, efkaByPartner, partners);
      const incomeTax = result.partnerResults.reduce(
        (sum, p) => sum + p.taxResult.incomeTax + p.taxResult.solidarityContribution, 0);
      return { profitBeforeTax: totalIncome - totalExpenses - efka, incomeTax: roundToTwo(incomeTax) };
    }
    case 'epe':
    case 'ae': {
      const result = engine.calculateCorporateTax(fiscalYear, totalIncome, totalExpenses, efka, [], 100, profile.kind);
      return { profitBeforeTax: totalIncome - totalExpenses - efka, incomeTax: result.corporateTax.corporateTaxAmount };
    }
  }
}
