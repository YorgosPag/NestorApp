'use client';

/**
 * @fileoverview **«ΘΑ ΕΙΜΑΣΤΕ ΚΛΕΙΣΤΑ / ΚΑΝΟΝΙΚΑ» — ΤΟ ΚΟΥΜΠΙ ΤΗΣ ΣΕΛΙΔΑΣ** (ADR-841 §7 Α21.21 Φάση Β).
 * @related app/api/holiday-hours-questions/[token]/route.ts · components/mandate/HolidayQuestionContent.tsx ·
 *   hooks/mandate/useEmailConfirmationSend.ts (το πρότυπο)
 * @module hooks/mandate/useHolidayQuestionDecision
 *
 * 🔑 **Ρητές φάσεις, ποτέ `isLoading` + `error` μαζί**. ⚠️ **Αναμονή, όχι αισιόδοξη ενημέρωση** (N.7.2 #6): μια μέρα που
 * «φάνηκε» να δηλώθηκε κλειστή ενώ δεν γράφτηκε θα έδειχνε στο κοινό ανοιχτό κατάστημα την ημέρα της αργίας.
 *
 * ⚠️ Το `decide` **επιστρέφει** τη φάση: η οθόνη αφαιρεί τις γραμμές που απαντήθηκαν **μόνο** μετά από επιτυχία, χωρίς effect
 * που θα ξανάτρεχε σε κάθε απόδοση.
 */

import { useCallback, useState } from 'react';

import { holidayQuestionDecisionPath } from '@/components/mandate/showcase-card-paths';
import type { HolidayAnswer, HolidayAnswerOutcome } from '@/lib/agency/showcase-holiday-answers';
import { refusalOf } from '@/lib/http/response-refusal';
import {
  HOLIDAY_HOURS_QUESTION_REFUSALS,
  type HolidayHoursQuestionRefusal,
  type HolidayQuestionDecisionResponse,
} from '@/types/holiday-hours-question';

export type HolidayQuestionFailure = HolidayHoursQuestionRefusal | 'unavailable';

const FAILURES: readonly HolidayQuestionFailure[] = [...HOLIDAY_HOURS_QUESTION_REFUSALS, 'unavailable'];

export type HolidayQuestionDecisionPhase =
  | { readonly kind: 'idle' }
  | { readonly kind: 'sending' }
  | { readonly kind: 'answered'; readonly outcomes: readonly HolidayAnswerOutcome[]; readonly remaining: number }
  | { readonly kind: 'failed'; readonly reason: HolidayQuestionFailure };

/** Η απάντηση **ελέγχεται**, ποτέ δεν πιστεύεται: `200` χωρίς αριθμό ή πίνακα είναι «δεν ξέρουμε», όχι επιτυχία. */
function answeredOf(body: unknown): HolidayQuestionDecisionPhase | null {
  if (typeof body !== 'object' || body === null) return null;
  const { remaining, outcomes } = body as HolidayQuestionDecisionResponse;
  return typeof remaining === 'number' && Array.isArray(outcomes) ? { kind: 'answered', outcomes, remaining } : null;
}

async function postAnswers(token: string, answers: readonly HolidayAnswer[]): Promise<HolidayQuestionDecisionPhase> {
  try {
    const response = await fetch(holidayQuestionDecisionPath(token), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers }),
    });
    const body: unknown = await response.json().catch(() => null);
    const answered = response.ok ? answeredOf(body) : null;
    return answered ?? { kind: 'failed', reason: refusalOf(body, FAILURES) ?? 'unavailable' };
  } catch {
    return { kind: 'failed', reason: 'unavailable' };
  }
}

export function useHolidayQuestionDecision(token: string): {
  readonly phase: HolidayQuestionDecisionPhase;
  readonly decide: (answers: readonly HolidayAnswer[]) => Promise<HolidayQuestionDecisionPhase>;
} {
  const [phase, setPhase] = useState<HolidayQuestionDecisionPhase>({ kind: 'idle' });

  const decide = useCallback(async (answers: readonly HolidayAnswer[]) => {
    setPhase({ kind: 'sending' });
    const next = await postAnswers(token, answers);
    setPhase(next);
    return next;
  }, [token]);

  return { phase, decide };
}
