/**
 * @fileoverview Report Tax Basis — κοινή βάση των αναφορών P&L και Σύνοψης Φόρων (SSoT)
 * @description Καθολικό περιόδου + σύνολα φόρου του βιβλίου (έσοδα · έξοδα χωρίς ΕΦΚΑ · εισφορές ΕΦΚΑ) +
 *   εκτιμώμενος φόρος εισοδήματος.
 *
 * 📘 ΕΦΚΑ (2026-11-07): ΜΙΑ πηγή, το Βιβλίο Ε-Ε (`ledgerTaxTotals`, κατηγορία `efka`). Ως τώρα αφαιρούνταν
 *   ΚΑΙ οι εγγραφές πληρωμών ΕΦΚΑ της περιόδου ⇒ η εισφορά θα έφευγε δύο φορές (ADR-ACC-006 §7.1).
 *
 * Ο φόρος ακολουθεί το **IAS 34 §30(γ) / B12–B16**: φόρος ενδιάμεσης περιόδου = κέρδος περιόδου × ΕΚΤΙΜΩΜΕΝΟΣ
 * ΜΕΣΟΣ ΕΤΗΣΙΟΣ πραγματικός συντελεστής της χρήσης. Ο συντελεστής βγαίνει από τον `TaxEngine` (κλίμακα του ΕΤΟΥΣ,
 * κατά νομική μορφή — SSoT `entity-tax-profile.ts`) πάνω στα ετήσια σύνολα: πραγματικά για κλεισμένη χρήση,
 * ανηγμένα από «έως σήμερα» για τρέχουσα. Περίοδος που διασχίζει χρήσεις ⇒ κάθε κομμάτι με τον συντελεστή του έτους του.
 *
 * 🔴 ΓΙΑΤΙ (2026-10-14): ζούσε εδώ μια δεύτερη, «απλοποιημένη» κλίμακα ατομικής (9/22/28/36/44) για ΟΛΑ τα έτη
 *   και ΟΛΕΣ τις μορφές, εφαρμοσμένη στο κέρδος ΤΡΙΜΗΝΟΥ σαν να ήταν ετήσιο: το τρίμηνο έπεφτε στα χαμηλά κλιμάκια
 *   (υποεκτίμηση), μια ΕΠΕ έβλεπε έως 44% αντί 22%, το 2026 έβλεπε την κλίμακα του 2024, και ο ΕΦΚΑ ΟΛΟΥ του έτους
 *   αφαιρούνταν από το κέρδος του τριμήνου.
 *
 * @see ADR-ACC-010 §2.1.1 · ADR-ACC-009 Tax Engine · DECISIONS-PHASE-2.md Q6
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, SSoT
 */

import type { PeriodRange } from '../../types/common';
import type { ITaxEngine } from '../../types/interfaces';
import type { ReportGeneratorDeps } from '../../types/reports';
import type { JournalEntry } from '../../types/journal';
import { accountingToday } from '../../utils/accounting-day';
import { roundToTwo } from '../../utils/math';
import {
  filterLedgerEntries,
  ledgerTaxTotals,
  loadLedger,
  scaleLedgerTaxTotals,
  type JournalLedger,
  type LedgerTaxTotals,
} from '../journal/journal-ledger';
import { TaxEngine } from '../engines/tax-engine';
import { yearToDateProgress } from '../engines/helpers/tax-date-utils';
import { incomeTaxOf, loadEntityTaxProfile } from '../tax/entity-tax-profile';

/** Το καθολικό της περιόδου, τα σύνολα φόρου του, και ο φόρος εισοδήματος κατά IAS 34. */
export interface PeriodTaxBasis {
  readonly ledger: JournalLedger;
  /** Σύνολα φόρου του βιβλίου της περιόδου — η ΕΦΚΑ χωριστά, ΟΧΙ μέσα στα έξοδα (`ledgerTaxTotals`). */
  readonly totals: LedgerTaxTotals;
  /** Κέρδος περιόδου × εκτιμώμενος ετήσιος πραγματικός συντελεστής (IAS 34). Ζημιά με κερδοφόρο έτος ⇒ αρνητικός. */
  readonly estimatedIncomeTax: number;
}

/** Φορτωτής βάσεων για ΜΙΑ αναφορά: τρεις περίοδοι μοιράζονται τον συντελεστή κάθε έτους (μία σάρωση ανά έτος). */
export type PeriodTaxBasisLoader = (period: PeriodRange) => Promise<PeriodTaxBasis>;

interface YearTaxContext {
  /** Εκτιμώμενος μέσος ετήσιος πραγματικός συντελεστής φόρου εισοδήματος (0…1). */
  readonly effectiveRate: number;
}

/** Τα έτη που αγγίζει η περίοδος, με το κομμάτι της περιόδου μέσα σε καθένα. */
function yearSegments(period: PeriodRange): Array<{ fiscalYear: number; segment: PeriodRange }> {
  const first = Number(period.from.slice(0, 4));
  const last = Number(period.to.slice(0, 4));
  const segments: Array<{ fiscalYear: number; segment: PeriodRange }> = [];
  for (let year = first; year <= last; year += 1) {
    const from = year === first ? period.from : `${year}-01-01`;
    const to = year === last ? period.to : `${year}-12-31`;
    segments.push({ fiscalYear: year, segment: { from, to } });
  }
  return segments;
}

const within = (segment: PeriodRange) => (entry: JournalEntry) => entry.date >= segment.from && entry.date <= segment.to;

/** IAS 34 B13: ο συντελεστής αντανακλά ΟΛΗ την προοδευτική κλίμακα πάνω στο εκτιμώμενο ετήσιο κέρδος. */
async function loadYearTaxContext(
  deps: ReportGeneratorDeps,
  engine: ITaxEngine,
  fiscalYear: number,
  asOf: string
): Promise<YearTaxContext> {
  const [profile, ledger] = await Promise.all([
    loadEntityTaxProfile(deps.repository),
    loadLedger(deps.repository, { kind: 'fiscalYear', fiscalYear }),
  ]);
  const { cutoff, factor } = yearToDateProgress(fiscalYear, asOf);
  const toDate = ledgerTaxTotals(filterLedgerEntries(ledger, within({ from: `${fiscalYear}-01-01`, to: cutoff })));
  const outcome = incomeTaxOf(engine, profile, fiscalYear, scaleLedgerTaxTotals(toDate, factor));
  const effectiveRate = outcome.profitBeforeTax > 0 ? outcome.incomeTax / outcome.profitBeforeTax : 0;
  return { effectiveRate };
}

/**
 * Φορτωτής βάσεων φόρου για μία αναφορά. Σφάλμα ανάγνωσης = σφάλμα της αναφοράς, ποτέ σύνολα μηδέν.
 * Storno: αρχική + αντιλογιστική μετρούν, η καθεμία στην περίοδό της (βλ. `journal-ledger.ts`).
 */
export function createPeriodTaxBasisLoader(deps: ReportGeneratorDeps): PeriodTaxBasisLoader {
  const engine = deps.taxEngine ?? new TaxEngine(deps.repository);
  const asOf = deps.asOf ?? accountingToday();
  const years = new Map<number, Promise<YearTaxContext>>();
  const yearContext = (fiscalYear: number) => {
    let context = years.get(fiscalYear);
    if (!context) {
      context = loadYearTaxContext(deps, engine, fiscalYear, asOf);
      years.set(fiscalYear, context);
    }
    return context;
  };

  return async (period) => {
    const segments = yearSegments(period);
    const [ledger, contexts] = await Promise.all([
      loadLedger(deps.repository, { kind: 'period', period }),
      Promise.all(segments.map((s) => yearContext(s.fiscalYear))),
    ]);

    let estimatedIncomeTax = 0;
    segments.forEach(({ segment }, i) => {
      const part = ledgerTaxTotals(filterLedgerEntries(ledger, within(segment)));
      const profit = part.totalIncome - part.totalExpenses - part.efkaContributions;
      estimatedIncomeTax += roundToTwo(profit * contexts[i]!.effectiveRate);
    });

    return { ledger, totals: ledgerTaxTotals(ledger), estimatedIncomeTax: roundToTwo(estimatedIncomeTax) };
  };
}
