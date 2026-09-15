/**
 * @fileoverview **Η ΕΡΩΤΗΣΗ «ΘΑ ΕΙΣΤΕ ΑΝΟΙΧΤΑ ΣΤΙΣ ΑΡΓΙΕΣ;»** — λεξιλόγιο (ADR-841 §7 Α21.21 Φάση Β).
 * @related services/mandate/holiday-hours-question.service.ts (έκδοση) ·
 *   services/mandate/holiday-hours-question-decision.ts (απάντηση) · lib/calendar/holiday-question.ts (ο πυρήνας) ·
 *   types/showcase-email-confirmation.ts (το πρότυπο)
 * @module types/holiday-hours-question
 *
 * 🔑 **Η ΕΡΩΤΗΣΗ ΔΕΝ ΕΙΝΑΙ Η ΑΛΗΘΕΙΑ.** Αλήθεια είναι οι ειδικές μέρες **της κάρτας**. Το έγγραφο κρατά μόνο «ρωτήσαμε
 * αυτό το γραφείο για αυτή την περίοδο, πότε, και τι απάντησε». Γι' αυτό η φόρμα **δεν** χρειάζεται να «κλείσει» την
 * ερώτηση: η υπενθύμιση, η σελίδα και η αποστολή ξαναρωτούν τον κριτή πάνω στην κάρτα — ό,τι απαντήθηκε αλλού δεν
 * ξαναρωτιέται.
 *
 * ⚠️ **Καμία κατάσταση `expired`** (ίδιο δόγμα με την Α21.18): η λήξη κρίνεται από το `lastDate` τη στιγμή της ερώτησης.
 *
 * **Layering**: leaf — καθαροί τύποι.
 */

import type { HolidayAnswerOutcome } from '@/lib/agency/showcase-holiday-answers';
import type { HolidayQuestionItem, SettledHolidayAnswer } from '@/lib/calendar/holiday-question';

/** ⚠️ **Ο ΠΙΝΑΚΑΣ ΕΙΝΑΙ Η ΑΥΘΕΝΤΙΑ, Ο ΤΥΠΟΣ ΠΑΡΑΓΕΤΑΙ.** */
const HOLIDAY_HOURS_QUESTION_STATES = [
  /** Περιμένει απάντηση — η **μόνη** κατάσταση που δέχεται απάντηση ή υπενθύμιση. */
  'open',
  /** Απαντήθηκαν όλες οι μέρες της περιόδου μέσω του συνδέσμου. **Τελική.** */
  'answered',
] as const;

export type HolidayHoursQuestionState = (typeof HOLIDAY_HOURS_QUESTION_STATES)[number];

/** **Fail-closed προς `answered`**: έγγραφο που δεν καταλάβαμε **δεν** γράφει ειδικές μέρες. */
export function readStoredHolidayQuestionState(value: unknown): HolidayHoursQuestionState {
  return value === 'open' ? 'open' : 'answered';
}

/** ⛔ Δεν φτάνει ποτέ σε πελάτη (`deny_all`). */
export interface HolidayHoursQuestion {
  /** `hhq_*` — **ντετερμινιστικό** ανά (γραφείο, περίοδος): δύο περάσματα του cron γεννούν **ένα** έγγραφο. */
  readonly id: string;
  readonly companyId: string;
  /** Η πρώτη αργία της περιόδου (`holidaySeasons`) — σταθερή όσο κι αν απαντηθούν οι μέρες της. */
  readonly seasonKey: string;
  /** Η τελευταία αργία της περιόδου — μετά από αυτήν ο σύνδεσμος **έληξε**. */
  readonly lastDate: string;
  /** Οι μέρες που ρωτήθηκαν **τη στιγμή της αποστολής** — ίχνος, όχι κρίση (η σελίδα ξαναρωτά την κάρτα). */
  readonly items: readonly HolidayQuestionItem[];
  /** Η ταυτότητα των συνδέσμων αυτής της ερώτησης — υπογράφεται μέσα τους. */
  readonly nonce: string;
  readonly state: HolidayHoursQuestionState;
  readonly createdAt: string;
  readonly askedAt: string;
  readonly remindedAt: string | null;
  readonly settledAt: string | null;
  /** Ό,τι απαντήθηκε μέσω συνδέσμου — και η «μνήμη πέρσι» της επόμενης χρονιάς. */
  readonly answers: readonly SettledHolidayAnswer[];
  /** Ποιος διαχειριστής πάτησε — ο σύνδεσμος είναι ανά παραλήπτη. Ίχνος, όχι κρίση. */
  readonly answeredByUid: string | null;
}

/** Το έγγραφο **όπως διαβάζεται** — ο τύπος δεν υπόσχεται εγγύηση που δεν επιβάλλει το Firestore. */
export type HolidayHoursQuestionDocument = Omit<HolidayHoursQuestion, 'state'> & { readonly state: string };

/**
 * Γιατί δεν έγινε δεκτή η απάντηση — ονομασμένοι λόγοι, **ποτέ** `boolean`. Ο καθένας στέλνει τον άνθρωπο σε άλλη κίνηση:
 * «έληξε» ⇒ η φόρμα · «ήδη απαντήθηκε» ⇒ **έγινε** · «γέμισαν οι ειδικές μέρες» ⇒ η φόρμα, να σβήσει κάποια.
 */
export const HOLIDAY_HOURS_QUESTION_REFUSALS = [
  'link-invalid',
  'question-unknown',
  'expired',
  'already-answered',
  'without-showcase',
  'special-hours-invalid',
] as const;

export type HolidayHoursQuestionRefusal = (typeof HOLIDAY_HOURS_QUESTION_REFUSALS)[number];

/**
 * Η απάντηση της πόρτας `POST /api/holiday-hours-questions/[token]` — ζει **εδώ** και όχι στο route, ώστε η σελίδα (πελάτης)
 * να τη διαβάζει χωρίς να εισάγει αρχείο διακομιστή.
 */
export interface HolidayQuestionDecisionResponse {
  readonly ok: boolean;
  /** Μετά την απάντηση: πόσες μέρες της περιόδου περιμένουν ακόμη. */
  readonly remaining?: number;
  /** Με τη **σειρά** των απαντήσεων που στάλθηκαν. */
  readonly outcomes?: readonly HolidayAnswerOutcome[];
  /** Κωδικός — γίνεται **κλειδί i18n** στην οθόνη (N.11), ποτέ ωμό κείμενο. */
  readonly reason?: HolidayHoursQuestionRefusal | 'unavailable';
}
