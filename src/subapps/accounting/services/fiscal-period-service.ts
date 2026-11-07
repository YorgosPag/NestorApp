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
  FiscalYearOpenOrigin,
  FiscalYearOpenOutcome,
  PostingPeriodDenial,
  PostingValidationResult,
  YearEndChecklist,
  YearEndChecklistStep,
} from '../types/fiscal-period';
import { ADJUSTMENT_PERIOD_NUMBER, FISCAL_PERIODS_PER_YEAR, fiscalPeriodKey, fiscalPeriodKeyForDate } from './fiscal-period-keys';
import { postingPeriodDenialOf } from './fiscal-period-transitions';
import { fiscalYearOfDay, isAutoOpenableFiscalYear } from './fiscal-year-window';
import { FiscalYearIncompleteError } from './repository/accounting-repo-fiscal-periods';
import { isoNow } from './repository/firestore-helpers';
import { accountingDayOf, accountingToday } from '../utils/accounting-day';
import { daysInMonth } from '@/lib/date/calendar-arithmetic';
import { isoCalendarDay } from '@/lib/date/calendar-day';
import { createModuleLogger } from '@/lib/telemetry/Logger';

const logger = createModuleLogger('ACCOUNTING_FISCAL_PERIODS');

// ============================================================================
// OPEN FISCAL YEAR (Q8 — 13 periods · ADR-ACC-010 §2.1.1 Φ9: ΕΝΑΣ γραφέας, τρεις προελεύσεις)
// ============================================================================

/** Οι 13 περίοδοι μιας χρήσης, πριν γραφτούν — 1–12 μήνες, 13 = κλείσιμο (ημερομηνίες Δεκεμβρίου). */
function fiscalYearPeriodDrafts(fiscalYear: number, now: string): FiscalPeriodDraft[] {
  return Array.from({ length: FISCAL_PERIODS_PER_YEAR }, (_, i) => {
    const periodNumber = i + 1;
    const month = periodNumber === ADJUSTMENT_PERIOD_NUMBER ? 12 : periodNumber;
    return {
      periodId: fiscalPeriodKey(fiscalYear, periodNumber),
      fiscalYear,
      periodNumber,
      startDate: isoCalendarDay(fiscalYear, month, 1),
      // Η τελευταία μέρα του μήνα από το SSoT (ADR-828 §1) — αριθμητικά, ανεξάρτητη από τη ζώνη του διακομιστή.
      endDate: isoCalendarDay(fiscalYear, month, daysInMonth(fiscalYear, month)),
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
 * ΡΗΤΗ διοικητική πράξη: οι 13 περίοδοι μιας χρήσης — ΟΛΕΣ ή ΚΑΜΙΑ, για ΟΠΟΙΟ έτος (και εκτός παραθύρου, π.χ.
 * μεταφορά ιστορικού). Υπάρχουσα χρήση ⇒ `FiscalYearExistsError` (ο χρήστης μαθαίνει ότι δεν έγινε τίποτα).
 */
export async function createFiscalYear(
  repository: IAccountingRepository,
  fiscalYear: number
): Promise<FiscalPeriodDraft[]> {
  const periods = fiscalYearPeriodDrafts(fiscalYear, isoNow());
  await repository.openFiscalYear(fiscalYear, periods, { origin: 'manual', ifExists: 'refuse' });
  return periods;
}

/**
 * ΙΔΕΜΠΟΤΗΤΗ εξασφάλιση από το σύστημα: η χρήση υπάρχει μετά την κλήση — `'created'` αν γεννήθηκε τώρα, `'existing'`
 * αν υπήρχε (καμία εγγραφή). Κλεισμένη / κλειδωμένη χρήση μένει ΑΘΙΚΤΗ. Το «επιτρέπεται αυτό το έτος;» το κρίνει ο
 * καλών με το `fiscal-year-window.ts` — εδώ μόνο ο ΕΝΑΣ γραφέας.
 */
export async function ensureFiscalYear(
  repository: IAccountingRepository,
  fiscalYear: number,
  origin: Exclude<FiscalYearOpenOrigin, 'manual'>
): Promise<FiscalYearOpenOutcome> {
  const periods = fiscalYearPeriodDrafts(fiscalYear, isoNow());
  return repository.openFiscalYear(fiscalYear, periods, { origin, ifExists: 'accept' });
}

/**
 * Το ΔΙΧΤΥ του συνόρου καταχώρησης (N.7.2 #4): ανοίγει τη χρήση μιας ημερομηνίας ΜΟΝΟ αν είναι μέσα στο παράθυρο
 * αυτόματου ανοίγματος. `true` ⇒ η χρήση υπάρχει πλέον (αξίζει νέος έλεγχος) · `false` ⇒ η άρνηση μένει.
 * Μερική χρήση ⇒ `false` + καταγραφή: αρνούμαστε την εγγραφή, ΠΟΤΕ δεν επισκευάζουμε σιωπηλά.
 */
export async function openFiscalYearAutomaticallyFor(
  repository: IAccountingRepository,
  dateStr: string,
  today: string = accountingToday()
): Promise<boolean> {
  const day = accountingDayOf(dateStr);
  if (day === null) return false;
  const fiscalYear = fiscalYearOfDay(day);
  const profile = await repository.getCompanySetup();
  if (!isAutoOpenableFiscalYear(fiscalYear, today, profile?.businessStart ?? null)) return false;
  try {
    await ensureFiscalYear(repository, fiscalYear, 'posting');
    return true;
  } catch (error) {
    if (!(error instanceof FiscalYearIncompleteError)) throw error;
    logger.error('Fiscal year incomplete — posting refused, no repair', { fiscalYear, owned: error.owned });
    return false;
  }
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
 * Καμία περίοδος ⇒ πρώτα το δίχτυ της Φ9 (χρήση μέσα στο παράθυρο ανοίγει μόνη της, όπως στο Xero), μετά άρνηση.
 */
export async function validatePostingAllowed(
  repository: IAccountingRepository,
  dateStr: string,
  today: string = accountingToday()
): Promise<PostingValidationResult> {
  let period = await getPeriodForDate(repository, dateStr);
  if (period === null && await openFiscalYearAutomaticallyFor(repository, dateStr, today)) {
    period = await getPeriodForDate(repository, dateStr);
  }
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
