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
  PostingValidationResult,
  YearEndChecklist,
  YearEndChecklistStep,
} from '../types/fiscal-period';
import { isoNow } from './repository/firestore-helpers';

// ============================================================================
// GREEK MONTH LABELS
// ============================================================================

const MONTH_LABELS_EL: Record<number, string> = {
  1: 'Ιανουάριος',
  2: 'Φεβρουάριος',
  3: 'Μάρτιος',
  4: 'Απρίλιος',
  5: 'Μάιος',
  6: 'Ιούνιος',
  7: 'Ιούλιος',
  8: 'Αύγουστος',
  9: 'Σεπτέμβριος',
  10: 'Οκτώβριος',
  11: 'Νοέμβριος',
  12: 'Δεκέμβριος',
  13: 'Περίοδος Κλεισίματος',
};

// ============================================================================
// CREATE FISCAL YEAR (Q8 — Auto-create 13 periods)
// ============================================================================

/**
 * Δημιουργεί 13 λογιστικές περιόδους για μία χρήση
 *
 * Periods 1-12: Ιανουάριος-Δεκέμβριος
 * Period 13: Adjustment period (μοιράζεται ημερομηνίες Δεκεμβρίου)
 */
export async function createFiscalYear(
  repository: IAccountingRepository,
  fiscalYear: number
): Promise<FiscalPeriod[]> {
  // Check if periods already exist
  const existing = await repository.listFiscalPeriods(fiscalYear);
  if (existing.length > 0) {
    throw new Error(`Fiscal year ${fiscalYear} already has ${existing.length} periods`);
  }

  const now = isoNow();
  const periods: FiscalPeriod[] = [];

  for (let month = 1; month <= 13; month++) {
    const periodId = `${fiscalYear}-${String(month).padStart(2, '0')}`;
    const label = `${MONTH_LABELS_EL[month]} ${fiscalYear}`;

    let startDate: string;
    let endDate: string;

    if (month <= 12) {
      startDate = `${fiscalYear}-${String(month).padStart(2, '0')}-01`;
      // Last day of month
      const lastDay = new Date(fiscalYear, month, 0).getDate();
      endDate = `${fiscalYear}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    } else {
      // Period 13: shares December dates
      startDate = `${fiscalYear}-12-01`;
      endDate = `${fiscalYear}-12-31`;
    }

    periods.push({
      periodId,
      fiscalYear,
      periodNumber: month,
      label,
      startDate,
      endDate,
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
    });
  }

  await repository.createFiscalPeriods(periods);
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
  const date = new Date(dateStr);
  const fiscalYear = date.getFullYear();
  const month = date.getMonth() + 1; // 1-12

  const periodId = `${fiscalYear}-${String(month).padStart(2, '0')}`;
  return repository.getFiscalPeriod(periodId);
}

// ============================================================================
// STATE TRANSITIONS
// ============================================================================

/**
 * Κλείσιμο περιόδου: OPEN → CLOSED
 *
 * Μετά υποβολή ΦΠΑ. Αναστρέψιμο (admin μπορεί να reopen).
 */
export async function closePeriod(
  repository: IAccountingRepository,
  periodId: string,
  userId: string
): Promise<void> {
  const period = await repository.getFiscalPeriod(periodId);
  if (!period) throw new Error(`Period ${periodId} not found`);
  if (period.status !== 'OPEN') {
    throw new Error(`Cannot close period ${periodId}: status is ${period.status} (expected OPEN)`);
  }

  const now = isoNow();
  await repository.updateFiscalPeriod(periodId, {
    status: 'CLOSED',
    closedAt: now,
    closedBy: userId,
    updatedAt: now,
  });
}

/**
 * Κλείδωμα περιόδου: CLOSED → LOCKED
 *
 * Permanent μετά φορολογική δήλωση (Ε3/Ε1). Κανείς δεν πειράζει.
 */
export async function lockPeriod(
  repository: IAccountingRepository,
  periodId: string,
  userId: string
): Promise<void> {
  const period = await repository.getFiscalPeriod(periodId);
  if (!period) throw new Error(`Period ${periodId} not found`);
  if (period.status !== 'CLOSED') {
    throw new Error(`Cannot lock period ${periodId}: status is ${period.status} (expected CLOSED)`);
  }

  const now = isoNow();
  await repository.updateFiscalPeriod(periodId, {
    status: 'LOCKED',
    lockedAt: now,
    lockedBy: userId,
    updatedAt: now,
  });
}

/**
 * Ξανάνοιγμα περιόδου: CLOSED → OPEN (with audit trail)
 *
 * Warning: "Θα χρειαστεί τροποποιητική ΦΠΑ"
 * LOCKED periods CANNOT be reopened.
 */
export async function reopenPeriod(
  repository: IAccountingRepository,
  periodId: string,
  userId: string,
  reason: string
): Promise<void> {
  const period = await repository.getFiscalPeriod(periodId);
  if (!period) throw new Error(`Period ${periodId} not found`);
  if (period.status === 'LOCKED') {
    throw new Error(`Cannot reopen period ${periodId}: status is LOCKED (permanent)`);
  }
  if (period.status === 'OPEN') {
    throw new Error(`Period ${periodId} is already OPEN`);
  }

  const now = isoNow();
  await repository.updateFiscalPeriod(periodId, {
    status: 'OPEN',
    reopenedAt: now,
    reopenedBy: userId,
    reopenReason: reason,
    updatedAt: now,
  });
}

// ============================================================================
// POSTING VALIDATION
// ============================================================================

/**
 * Ελέγχει αν επιτρέπεται καταχώρηση σε μία ημερομηνία
 *
 * Χρησιμοποιείται πριν δημιουργία journal entry / invoice.
 */
export async function validatePostingAllowed(
  repository: IAccountingRepository,
  dateStr: string
): Promise<PostingValidationResult> {
  const period = await getPeriodForDate(repository, dateStr);

  if (!period) {
    return {
      allowed: false,
      reason: `Δεν βρέθηκε λογιστική περίοδος για ${dateStr}. Δημιουργήστε πρώτα τη χρήση.`,
      periodId: null,
      periodStatus: null,
    };
  }

  if (period.status === 'CLOSED') {
    return {
      allowed: false,
      reason: `Η περίοδος ${period.label} είναι κλεισμένη. Ανοίξτε τη περίοδο ή καταχωρήστε στην τρέχουσα.`,
      periodId: period.periodId,
      periodStatus: 'CLOSED',
    };
  }

  if (period.status === 'LOCKED') {
    return {
      allowed: false,
      reason: `Η περίοδος ${period.label} είναι κλειδωμένη οριστικά. Καταχωρήστε στην τρέχουσα ανοιχτή περίοδο.`,
      periodId: period.periodId,
      periodStatus: 'LOCKED',
    };
  }

  return {
    allowed: true,
    reason: null,
    periodId: period.periodId,
    periodStatus: 'OPEN',
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
