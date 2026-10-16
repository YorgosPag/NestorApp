/**
 * @fileoverview Fiscal Period Service — Period State Machine + Year-End
 * @description 3-state lifecycle: OPEN → CLOSED → LOCKED (Entersoft/SAP pattern)
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-29
 * @see DECISIONS-PHASE-1b.md Q5-Q8
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, max 500 lines
 */

import type { IAccountingRepository } from '../types/interfaces';
import type {
  FiscalPeriod,
  FiscalPeriodDraft,
  PostingPeriodDenial,
  PostingValidationResult,
  YearEndChecklist,
  YearEndChecklistStep,
} from '../types/fiscal-period';
import { ADJUSTMENT_PERIOD_NUMBER, FISCAL_PERIODS_PER_YEAR, fiscalPeriodKey, fiscalPeriodKeyForDate } from './fiscal-period-keys';
import { postingPeriodDenialOf } from './fiscal-period-transitions';
import { isoNow } from './repository/firestore-helpers';

// ============================================================================
// CREATE FISCAL YEAR (Q8 — Auto-create 13 periods)
// ============================================================================

/** Οι 13 περίοδοι μιας χρήσης, πριν γραφτούν — 1–12 μήνες, 13 = κλείσιμο (ημερομηνίες Δεκεμβρίου). */
function fiscalYearPeriodDrafts(fiscalYear: number, now: string): FiscalPeriodDraft[] {
  return Array.from({ length: FISCAL_PERIODS_PER_YEAR }, (_, i) => {
    const periodNumber = i + 1;
    const month = periodNumber === ADJUSTMENT_PERIOD_NUMBER ? 12 : periodNumber;
    const mm = String(month).padStart(2, '0');
    // UTC: η τελευταία μέρα του μήνα δεν εξαρτάται από τη ζώνη του διακομιστή.
    const lastDay = new Date(Date.UTC(fiscalYear, month, 0)).getUTCDate();
    return {
      periodId: fiscalPeriodKey(fiscalYear, periodNumber),
      fiscalYear,
      periodNumber,
      startDate: `${fiscalYear}-${mm}-01`,
      endDate: `${fiscalYear}-${mm}-${String(lastDay).padStart(2, '0')}`,
      status: 'OPEN',
      closedAt: null,
      closedBy: null,
      lockedAt: null,
      lockedBy: null,
      reopenedAt: null,
      reopenedBy: null,
      reopenReason: null,
      createdAt: now,
      updatedAt: now,
    };
  });
}

/**
 * Δημιουργεί τις 13 περιόδους μιας χρήσης για τον μισθωτή του repository — ΟΛΕΣ ή ΚΑΜΙΑ. Υπάρχουσα χρήση ⇒
 * `FiscalYearExistsError` από τον γραφέα (μέσα στη συναλλαγή — ποτέ αντικατάσταση κλειδωμένης περιόδου).
 */
export async function createFiscalYear(
  repository: IAccountingRepository,
  fiscalYear: number
): Promise<FiscalPeriodDraft[]> {
  const periods = fiscalYearPeriodDrafts(fiscalYear, isoNow());
  await repository.createFiscalPeriods(fiscalYear, periods);
  return periods;
}

// ============================================================================
// PERIOD LOOKUP
// ============================================================================

/**
 * Βρίσκει σε ποια περίοδο ανήκει μία ημερομηνία
 *
 * Αν υπάρχει Period 13, προτιμά τις κανονικές μηνιαίες (1-12).
 * Η Period 13 χρησιμοποιείται μόνο με manual assignment.
 */
export async function getPeriodForDate(
  repository: IAccountingRepository,
  dateStr: string
): Promise<FiscalPeriod | null> {
  const periodId = fiscalPeriodKeyForDate(dateStr);
  return periodId === null ? null : repository.getFiscalPeriod(periodId);
}

// ============================================================================
// STATE TRANSITIONS — ΕΝΑΣ γραφέας: `repository.transitionFiscalPeriod` (απόφαση `fiscal-period-transitions.ts`)
// ============================================================================

// ============================================================================
// POSTING VALIDATION
// ============================================================================

/**
 * Επιτρέπεται καταχώρηση σε μία ημερομηνία; Πριν από κάθε εγγραφή Ε-Ε / τιμολόγιο / αντιστοίχιση τράπεζας.
 * Η άρνηση είναι ΚΩΔΙΚΟΣ + δομημένα στοιχεία (ADR-ACC-010 §2.1.1 Φ7) — το κείμενο το αποδίδει ο πελάτης.
 */
export async function validatePostingAllowed(
  repository: IAccountingRepository,
  dateStr: string
): Promise<PostingValidationResult> {
  const period = await getPeriodForDate(repository, dateStr);
  if (period === null) return deniedPosting('PERIOD_NOT_FOUND', dateStr, null);
  const denial = postingPeriodDenialOf(period);
  return denial === null
    ? { allowed: true, periodId: period.periodId, periodStatus: 'OPEN' }
    : deniedPosting(denial, dateStr, period);
}

function deniedPosting(denial: PostingPeriodDenial, postingDate: string, period: FiscalPeriod | null): PostingValidationResult {
  return {
    allowed: false,
    denial,
    postingDate,
    periodId: period?.periodId ?? null,
    periodStatus: period?.status ?? null,
    fiscalYear: period?.fiscalYear ?? null,
    periodNumber: period?.periodNumber ?? null,
  };
}

/**
 * Βρίσκει την πρώτη OPEN περίοδο (τρέχουσα ανοιχτή)
 */
export async function getCurrentOpenPeriod(
  repository: IAccountingRepository,
  fiscalYear: number
): Promise<FiscalPeriod | null> {
  const periods = await repository.listFiscalPeriods(fiscalYear);
  return periods.find((p) => p.status === 'OPEN') ?? null;
}

// ============================================================================
// YEAR-END CHECKLIST (Q8 — Entersoft 6-step)
// ============================================================================

const CHECKLIST_STEPS: Array<{ step: number; label: string }> = [
  { step: 1, label: 'Έλεγχος εκκρεμών εγγραφών' },
  { step: 2, label: 'Αποσβέσεις παγίων (DepreciationEngine)' },
  { step: 3, label: 'Τελικές διορθώσεις (Period 13)' },
  { step: 4, label: 'Ισοζύγιο κλεισίματος (αναφορά)' },
  { step: 5, label: 'Κλείδωμα periods 1-13 (CLOSED → LOCKED)' },
  { step: 6, label: 'Δημιουργία νέας χρήσης' },
];

/**
 * Επιστρέφει checklist κλεισίματος χρήσης
 *
 * Ελέγχει τη real κατάσταση: αν ΟΛΕΣ οι periods είναι LOCKED
 * → step 5 = completed, κλπ.
 */
export async function getYearEndChecklist(
  repository: IAccountingRepository,
  fiscalYear: number
): Promise<YearEndChecklist> {
  const periods = await repository.listFiscalPeriods(fiscalYear);
  const nextYearPeriods = await repository.listFiscalPeriods(fiscalYear + 1);

  const steps: YearEndChecklistStep[] = CHECKLIST_STEPS.map(({ step, label }) => {
    let completed = false;
    let completedAt: string | null = null;

    if (step === 5) {
      // All periods locked?
      const allLocked = periods.length > 0 && periods.every((p) => p.status === 'LOCKED');
      completed = allLocked;
      if (allLocked && periods.length > 0) {
        // Use the latest lockedAt as completedAt
        completedAt = periods.reduce((latest, p) =>
          p.lockedAt && (!latest || p.lockedAt > latest) ? p.lockedAt : latest
          , null as string | null);
      }
    } else if (step === 6) {
      completed = nextYearPeriods.length > 0;
      if (completed && nextYearPeriods[0]) {
        completedAt = nextYearPeriods[0].createdAt;
      }
    }

    return { step, label, completed, completedAt };
  });

  return {
    fiscalYear,
    steps,
    allComplete: steps.every((s) => s.completed),
  };
}
