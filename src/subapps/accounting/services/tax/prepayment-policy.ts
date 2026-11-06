/**
 * @fileoverview Πολιτική προκαταβολής φόρου — SSoT «πόση προκαταβολή, και ΓΙΑΤΙ»
 * @description Ο βασικός συντελεστής ανά νομική μορφή (`tax-config`) και η μείωση στο μισό που
 *   **υπολογίζεται** από την έναρξη εργασιών της επιχείρησης — ποτέ χειροκίνητη επιλογή ανά εταίρο.
 *
 *   - Φυσικό πρόσωπο (ατομική) — ν.4172/2013 άρθρο 69 §1: μισή **μόνο** το έτος που αποκτάται για πρώτη
 *     φορά επιχειρηματικό εισόδημα.
 *   - Νομικό πρόσωπο/οντότητα (ΟΕ/ΕΠΕ/ΑΕ) — άρθρο 71 §3: μισή τα **τρία πρώτα** φορολογικά έτη από την
 *     έναρξη, όχι για εταιρείες από μετατροπή/συγχώνευση.
 *
 *   Ως τις 2026-11-06: checkbox `isFirstFiveYears` ανά εταίρο/μέλος/μέτοχο → 27,5% για πέντε έτη, και καμία
 *   μείωση σε ΕΠΕ/ΑΕ (ADR-ACC-023 §1-2 · ADR-ACC-024 §6.1 α).
 *
 *   Κάθε αποτέλεσμα φέρει τη **βάση** (`PrepaymentBasis`): η οθόνη εξηγεί τον αριθμό, δεν τον δείχνει σκέτο.
 *   Χωρίς έναρξη ⇒ πλήρης προκαταβολή: η εφαρμογή δεν δείχνει ποτέ μικρότερη υποχρέωση από την πραγματική.
 *
 * @see ADR-ACC-009 Tax Engine · ADR-ACC-023 · ADR-ACC-024
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, SSoT, pure
 */

import { parseCalendarDay } from '@/lib/date/calendar-day';

import type { BusinessStart } from '../../types/company';
import type { EntityType } from '../../types/entity';
import type { PrepaymentBasis, PrepaymentReason, PrepaymentReductionRule } from '../../types/tax';
import { getPrepaymentRateForEntity } from '../config/tax-config';

/** Μήκος παραθύρου μείωσης (φορολογικά έτη, συμπεριλαμβανομένου του έτους έναρξης) ανά κανόνα. */
const REDUCTION_WINDOW_YEARS: Readonly<Record<PrepaymentReductionRule, number>> = {
  natural_person_first_year: 1,
  legal_entity_first_three_years: 3,
};

/** Η μείωση είναι «στο μισό» και για τους δύο κανόνες (άρθρο 69 §1 · άρθρο 71 §3). */
const REDUCTION_FACTOR = 0.5;

/** Ποιος κανόνας ισχύει για τη νομική μορφή — φυσικό πρόσωπο ή νομικό πρόσωπο/οντότητα. */
function prepaymentRuleFor(entityType: EntityType): PrepaymentReductionRule {
  return entityType === 'sole_proprietor' ? 'natural_person_first_year' : 'legal_entity_first_three_years';
}

/** Έτος από ημερολογιακή ημέρα `YYYY-MM-DD` — `null` αν η μέρα δεν υπάρχει (ένας κριτής, ADR-919). */
function yearOf(isoDate: string): number | null {
  return parseCalendarDay(isoDate)?.year ?? null;
}

/** Χωρίς (αναγνώσιμη) έναρξη ⇒ `missing_start` · συνέχεια ⇒ `continuation` · αλλιώς παράθυρο ναι/όχι. */
function reasonFor(
  businessStart: BusinessStart | null,
  startYear: number | null,
  yearSinceStart: number | null,
  windowYears: number,
): PrepaymentReason {
  if (businessStart === null || startYear === null) return 'missing_start';
  if (businessStart.origin === 'continuation') return 'continuation';
  return yearSinceStart !== null && yearSinceStart <= windowYears ? 'reduced' : 'outside_window';
}

/**
 * Η προκαταβολή της επιχείρησης για ένα φορολογικό έτος — συντελεστής **και** αιτία.
 *
 * `yearSinceStart`: 1 = το έτος της έναρξης· `null` όταν δεν δηλώθηκε έναρξη ή το έτος είναι πριν από αυτή.
 */
export function resolvePrepayment(
  entityType: EntityType,
  fiscalYear: number,
  businessStart: BusinessStart | null,
): PrepaymentBasis {
  const baseRate = getPrepaymentRateForEntity(entityType);
  const rule = prepaymentRuleFor(entityType);
  const windowYears = REDUCTION_WINDOW_YEARS[rule];
  const startYear = businessStart === null ? null : yearOf(businessStart.date);
  const yearSinceStart = startYear !== null && fiscalYear >= startYear ? fiscalYear - startYear + 1 : null;
  const reason = reasonFor(businessStart, startYear, yearSinceStart, windowYears);
  const rate = reason === 'reduced' ? baseRate * REDUCTION_FACTOR : baseRate;

  return { rate, baseRate, rule, reason, windowYears, startYear, yearSinceStart };
}
