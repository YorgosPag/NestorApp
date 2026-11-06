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
import type { BookCategory, BusinessStart, CompanyProfile } from '../../types/company';
import type { PeriodRange } from '../../types/common';
import type { EntityHolder, EntityTaxInput } from '../../types/tax';
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
// ΦΟΡΟΛΟΓΙΚΗ ΘΕΣΗ ΤΗΣ ΕΠΙΧΕΙΡΗΣΗΣ — έναρξη + βιβλία
// ============================================================================

/**
 * Ό,τι χρειάζεται ο φόρος από το προφίλ πέρα από τα πρόσωπα: η **έναρξη εργασιών** (μειωμένη προκαταβολή,
 * `prepayment-policy`) και η **κατηγορία βιβλίων** (παρακράτηση στη διανομή της ΟΕ).
 */
export interface TaxStanding {
  readonly businessStart: BusinessStart | null;
  readonly bookCategory: BookCategory;
}

/** Η φορολογική θέση από το προφίλ — χωρίς προφίλ: χωρίς έναρξη, απλογραφικά (προεπιλογή setup). */
export function taxStandingOf(setup: CompanyProfile | null): TaxStanding {
  return { businessStart: setup?.businessStart ?? null, bookCategory: setup?.bookCategory ?? 'simplified' };
}

// ============================================================================
// ΠΡΟΦΙΛ ΑΝΑ ΝΟΜΙΚΗ ΜΟΡΦΗ
// ============================================================================

export interface PartnerTaxProfile {
  readonly partner: Partner;
  readonly efka: readonly EFKAPayment[];
}

export type EntityTaxProfile =
  | { readonly kind: 'sole_proprietor'; readonly standing: TaxStanding; readonly efka: readonly EFKAPayment[] }
  | { readonly kind: 'oe'; readonly standing: TaxStanding; readonly partners: readonly PartnerTaxProfile[] }
  | {
      readonly kind: 'epe'; readonly standing: TaxStanding;
      readonly members: readonly Member[]; readonly managerEfka: readonly EFKAPayment[];
    }
  | {
      readonly kind: 'ae'; readonly standing: TaxStanding;
      readonly shareholders: readonly Shareholder[]; readonly boardEfka: readonly EFKAPayment[];
    };

/** Προφίλ οντότητας (ΟΕ/ΕΠΕ/ΑΕ) — φορολογείται με τον φόρο οντότητας. */
export type LegalEntityTaxProfile = Exclude<EntityTaxProfile, { kind: 'sole_proprietor' }>;

export async function loadSoleProprietorProfile(
  repo: IAccountingRepository,
  fiscalYear: number,
  standing: TaxStanding
): Promise<EntityTaxProfile> {
  return { kind: 'sole_proprietor', standing, efka: await repo.getEFKAPayments(fiscalYear) };
}

/** ΟΕ: εκπίπτουν οι εισφορές **όλων** των εταίρων, από τα έσοδα της εταιρείας (ΠΟΛ.1113/2015 — ADR-ACC-024 §6.1 β). */
export async function loadPartnershipProfile(
  repo: IAccountingRepository,
  fiscalYear: number,
  standing: TaxStanding
): Promise<Extract<EntityTaxProfile, { kind: 'oe' }>> {
  const partners = await repo.getPartners();
  const withEfka = await Promise.all(
    partners.map(async (partner) => ({ partner, efka: await repo.getPartnerEFKAPayments(partner.partnerId, fiscalYear) }))
  );
  return { kind: 'oe', standing, partners: withEfka };
}

/** ΕΠΕ: εκπίπτουν μόνο οι εισφορές των ενεργών διαχειριστών. */
export async function loadEpeProfile(
  repo: IAccountingRepository,
  fiscalYear: number,
  standing: TaxStanding
): Promise<Extract<EntityTaxProfile, { kind: 'epe' }>> {
  const members = await repo.getMembers();
  const managers = members.filter((m) => m.isManager && m.isActive);
  const efka = await Promise.all(managers.map((m) => repo.getMemberEFKAPayments(m.memberId, fiscalYear)));
  return { kind: 'epe', standing, members: members.filter((m) => m.isActive), managerEfka: efka.flat() };
}

/**
 * ΑΕ: εκπίπτουν μόνο οι εισφορές μελών ΔΣ με αμοιβή ως ΑΥΤΟΑΠΑΣΧΟΛΟΥΜΕΝΩΝ — σε σχέση εργασίας είναι κόστος
 * εργοδότη, όχι έκπτωση από τον εταιρικό φόρο (ADR-ACC-017).
 */
export async function loadAeProfile(
  repo: IAccountingRepository,
  fiscalYear: number,
  standing: TaxStanding
): Promise<Extract<EntityTaxProfile, { kind: 'ae' }>> {
  const shareholders = await repo.getShareholders();
  const board = shareholders.filter(
    (s) => s.isBoardMember && s.isActive && s.monthlyCompensation !== null && s.monthlyCompensation > 0 &&
      s.efkaMode === 'self_employed'
  );
  const efka = await Promise.all(board.map((s) => repo.getShareholderEFKAPayments(s.shareholderId, fiscalYear)));
  return { kind: 'ae', standing, shareholders: shareholders.filter((s) => s.isActive), boardEfka: efka.flat() };
}

/** Το προφίλ της εταιρείας του μισθωτή, κατά τη νομική μορφή της (προεπιλογή: ατομική, όπως ο TaxEngine). */
export async function loadEntityTaxProfile(repo: IAccountingRepository, fiscalYear: number): Promise<EntityTaxProfile> {
  const setup = await repo.getCompanySetup();
  const standing = taxStandingOf(setup);
  switch (setup?.entityType ?? 'sole_proprietor') {
    case 'oe': return loadPartnershipProfile(repo, fiscalYear, standing);
    case 'epe': return loadEpeProfile(repo, fiscalYear, standing);
    case 'ae': return loadAeProfile(repo, fiscalYear, standing);
    default: return loadSoleProprietorProfile(repo, fiscalYear, standing);
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

// ============================================================================
// ΕΙΣΟΔΟΙ ΤΟΥ ΦΟΡΟΥ ΟΝΤΟΤΗΤΑΣ — ΕΝΑ σημείο για service και αναφορές
// ============================================================================

export interface IncomeTaxTotals {
  readonly totalIncome: number;
  readonly totalExpenses: number;
  /** Πολλαπλασιαστής των εισφορών (αναγωγή σε έτος — IAS 34)· 1 = όπως πληρώθηκαν. */
  readonly efkaScale?: number;
}

/** Η είσοδος του `computeEntityTax` από προφίλ οντότητας + σύνολα. */
export function entityTaxInputOf(
  profile: LegalEntityTaxProfile,
  fiscalYear: number,
  totals: IncomeTaxTotals
): EntityTaxInput {
  return {
    fiscalYear,
    totalIncome: totals.totalIncome,
    totalExpenses: totals.totalExpenses,
    deductibleEfka: roundToTwo(deductibleEfka(profile) * (totals.efkaScale ?? 1)),
    businessStart: profile.standing.businessStart,
    bookCategory: profile.standing.bookCategory,
  };
}

/** Οι δικαιούχοι διανομής του προφίλ (εταίροι / μέλη / μέτοχοι) στο ουδέτερο σχήμα της μηχανής. */
export function entityHoldersOf(profile: LegalEntityTaxProfile): EntityHolder[] {
  switch (profile.kind) {
    case 'oe':
      return profile.partners.map(({ partner }) => ({
        id: partner.partnerId, name: partner.fullName, sharePercent: partner.profitSharePercent,
      }));
    case 'epe':
      return profile.members.map((m) => ({ id: m.memberId, name: m.fullName, sharePercent: m.dividendSharePercent }));
    case 'ae':
      return profile.shareholders.map((s) => ({
        id: s.shareholderId, name: s.fullName, sharePercent: s.dividendSharePercent,
      }));
  }
}

// ============================================================================
// ΦΟΡΟΣ ΕΙΣΟΔΗΜΑΤΟΣ ΑΠΟ ΣΥΝΟΛΑ
// ============================================================================

export interface IncomeTaxOutcome {
  /** Κέρδος μετά τις εκπιπτόμενες εισφορές, πριν από τον φόρο εισοδήματος. */
  readonly profitBeforeTax: number;
  /** Φόρος εισοδήματος (ατομική: κλίμακα + αλληλεγγύη· ΟΕ / ΕΠΕ / ΑΕ: συντελεστής οντότητας). */
  readonly incomeTax: number;
}

/** Ο φόρος οντότητας για το προφίλ — η μέθοδος του `TaxEngine` που αντιστοιχεί στη μορφή. */
function legalEntityCorporateTax(engine: ITaxEngine, profile: LegalEntityTaxProfile, input: EntityTaxInput): number {
  switch (profile.kind) {
    case 'oe': return engine.calculatePartnershipTax(input, []).corporateTax.corporateTaxAmount;
    case 'epe': return engine.calculateCorporateTax(input, []).corporateTax.corporateTaxAmount;
    case 'ae': return engine.calculateAETax(input, []).corporateTax.corporateTaxAmount;
  }
}

/** Ο ετήσιος φόρος εισοδήματος της οντότητας για αυτά τα σύνολα — μέσω του `TaxEngine`, ποτέ δεύτερη κλίμακα. */
export function incomeTaxOf(
  engine: ITaxEngine,
  profile: EntityTaxProfile,
  fiscalYear: number,
  totals: IncomeTaxTotals
): IncomeTaxOutcome {
  const { totalIncome, totalExpenses } = totals;
  const efka = roundToTwo(deductibleEfka(profile) * (totals.efkaScale ?? 1));
  const profitBeforeTax = totalIncome - totalExpenses - efka;

  if (profile.kind === 'sole_proprietor') {
    const result = engine.calculateAnnualTax({
      fiscalYear, totalIncome, totalDeductibleExpenses: totalExpenses, totalEfkaContributions: efka,
      professionalTax: 0, totalWithholdings: 0, previousYearPrepayment: 0,
      businessStart: profile.standing.businessStart,
    });
    return { profitBeforeTax, incomeTax: roundToTwo(result.incomeTax + result.solidarityContribution) };
  }
  const input = entityTaxInputOf(profile, fiscalYear, totals);
  return { profitBeforeTax, incomeTax: legalEntityCorporateTax(engine, profile, input) };
}
