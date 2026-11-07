/**
 * @fileoverview Φορολογικό προφίλ οντότητας — SSoT «φόρος εισοδήματος ανά νομική μορφή»
 * @description Ποιος πληρώνει φόρο εισοδήματος και με ποια κλίμακα — για ατομική, ΟΕ, ΕΠΕ και ΑΕ. Το ρωτούν
 *   το tax dashboard (ετήσιος φόρος) ΚΑΙ οι αναφορές P&L / Σύνοψη Φόρων (ενδιάμεσος φόρος κατά IAS 34). Πριν:
 *   οι αναφορές είχαν δική τους κλίμακα ατομικής για ΟΛΕΣ τις μορφές (μια ΕΠΕ έβλεπε 44% αντί 22%).
 *
 * 📘 ΕΦΚΑ (2026-11-07): οι εκπιπτόμενες εισφορές έρχονται ΜΟΝΟ από το Βιβλίο Ε-Ε (`ledgerTaxTotals`, κατηγορία
 *   `efka`). Ως τώρα το προφίλ φόρτωνε ΚΑΙ τις εγγραφές πληρωμών ΕΦΚΑ και τις αφαιρούσε **επιπλέον** από το
 *   κέρδος ⇒ κρυφή διπλομέτρηση μόλις υπήρχε πληρωμή. Οι πληρωμές = βοηθητικό βιβλίο (ADR-ACC-006 §7.1).
 *
 * Μόνο ΦΟΡΟΣ ΕΙΣΟΔΗΜΑΤΟΣ (IAS 12): χωρίς προκαταβολή (ταμειακή υποχρέωση του επόμενου έτους) και χωρίς τέλος
 * επιτηδεύματος (δεν εξαρτάται από τα κέρδη). Οι υπολογισμοί γίνονται από τον `TaxEngine` — εδώ μόνο η διανομή.
 *
 * @see ADR-ACC-010 §2.1.1 (Φάση 2) · ADR-ACC-009 Tax Engine · ADR-ACC-006 §7.1 · ADR-ACC-012/014/016
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, SSoT
 */

import type { IAccountingRepository, ITaxEngine } from '../../types/interfaces';
import type { Member, Partner, Shareholder } from '../../types/entity';
import type { BookCategory, BusinessStart, CompanyProfile } from '../../types/company';
import type { EntityHolder, EntityTaxInput } from '../../types/tax';
import type { LedgerTaxTotals } from '../journal/journal-ledger';
import { roundToTwo } from '../../utils/math';

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
// ΠΡΟΦΙΛ ΑΝΑ ΝΟΜΙΚΗ ΜΟΡΦΗ — φορολογική θέση + δικαιούχοι διανομής (ΟΧΙ εισφορές)
// ============================================================================

export type EntityTaxProfile =
  | { readonly kind: 'sole_proprietor'; readonly standing: TaxStanding }
  | { readonly kind: 'oe'; readonly standing: TaxStanding; readonly partners: readonly Partner[] }
  | { readonly kind: 'epe'; readonly standing: TaxStanding; readonly members: readonly Member[] }
  | { readonly kind: 'ae'; readonly standing: TaxStanding; readonly shareholders: readonly Shareholder[] };

/** Προφίλ οντότητας (ΟΕ/ΕΠΕ/ΑΕ) — φορολογείται με τον φόρο οντότητας. */
export type LegalEntityTaxProfile = Exclude<EntityTaxProfile, { kind: 'sole_proprietor' }>;

/** ΟΕ: οι εταίροι (δικαιούχοι διανομής). */
export async function loadPartnershipProfile(
  repo: IAccountingRepository,
  standing: TaxStanding
): Promise<Extract<EntityTaxProfile, { kind: 'oe' }>> {
  return { kind: 'oe', standing, partners: await repo.getPartners() };
}

/** ΕΠΕ: τα ενεργά μέλη (δικαιούχοι μερίσματος). */
export async function loadEpeProfile(
  repo: IAccountingRepository,
  standing: TaxStanding
): Promise<Extract<EntityTaxProfile, { kind: 'epe' }>> {
  const members = await repo.getMembers();
  return { kind: 'epe', standing, members: members.filter((m) => m.isActive) };
}

/** ΑΕ: οι ενεργοί μέτοχοι (δικαιούχοι μερίσματος). */
export async function loadAeProfile(
  repo: IAccountingRepository,
  standing: TaxStanding
): Promise<Extract<EntityTaxProfile, { kind: 'ae' }>> {
  const shareholders = await repo.getShareholders();
  return { kind: 'ae', standing, shareholders: shareholders.filter((s) => s.isActive) };
}

/** Το προφίλ της εταιρείας του μισθωτή, κατά τη νομική μορφή της (προεπιλογή: ατομική, όπως ο TaxEngine). */
export async function loadEntityTaxProfile(repo: IAccountingRepository): Promise<EntityTaxProfile> {
  const setup = await repo.getCompanySetup();
  const standing = taxStandingOf(setup);
  switch (setup?.entityType ?? 'sole_proprietor') {
    case 'oe': return loadPartnershipProfile(repo, standing);
    case 'epe': return loadEpeProfile(repo, standing);
    case 'ae': return loadAeProfile(repo, standing);
    default: return { kind: 'sole_proprietor', standing };
  }
}

// ============================================================================
// ΕΙΣΟΔΟΙ ΤΟΥ ΦΟΡΟΥ ΟΝΤΟΤΗΤΑΣ — ΕΝΑ σημείο για service και αναφορές
// ============================================================================

/** Η είσοδος του `computeEntityTax` από προφίλ οντότητας + σύνολα του Βιβλίου Ε-Ε. */
export function entityTaxInputOf(
  profile: LegalEntityTaxProfile,
  fiscalYear: number,
  totals: LedgerTaxTotals
): EntityTaxInput {
  return {
    fiscalYear,
    totalIncome: totals.totalIncome,
    totalExpenses: totals.totalExpenses,
    deductibleEfka: totals.efkaContributions,
    businessStart: profile.standing.businessStart,
    bookCategory: profile.standing.bookCategory,
  };
}

/** Οι δικαιούχοι διανομής του προφίλ (εταίροι / μέλη / μέτοχοι) στο ουδέτερο σχήμα της μηχανής. */
export function entityHoldersOf(profile: LegalEntityTaxProfile): EntityHolder[] {
  switch (profile.kind) {
    case 'oe':
      return profile.partners.map((partner) => ({
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
  /** Κέρδος μετά τις εισφορές ΕΦΚΑ του βιβλίου (= έσοδα − ΟΛΑ τα έξοδα), πριν από τον φόρο εισοδήματος. */
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
  totals: LedgerTaxTotals
): IncomeTaxOutcome {
  const { totalIncome, totalExpenses, efkaContributions } = totals;
  const profitBeforeTax = totalIncome - totalExpenses - efkaContributions;

  if (profile.kind === 'sole_proprietor') {
    const result = engine.calculateAnnualTax({
      fiscalYear, totalIncome, totalDeductibleExpenses: totalExpenses, totalEfkaContributions: efkaContributions,
      professionalTax: 0, totalWithholdings: 0, previousYearPrepayment: 0,
      businessStart: profile.standing.businessStart,
    });
    return { profitBeforeTax, incomeTax: roundToTwo(result.incomeTax + result.solidarityContribution) };
  }
  const input = entityTaxInputOf(profile, fiscalYear, totals);
  return { profitBeforeTax, incomeTax: legalEntityCorporateTax(engine, profile, input) };
}
