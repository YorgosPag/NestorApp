/**
 * @fileoverview **«ΘΑ ΕΙΜΑΣΤΕ ΚΛΕΙΣΤΑ» / «ΚΑΝΟΝΙΚΑ»** — η απάντηση του διαχειριστή χωρίς σύνδεση (ADR-841 §7 Α21.21 Φάση Β).
 * @related app/(auth)/hours-question/[token]/page.tsx (ανάγνωση) · app/api/holiday-hours-questions/[token]/route.ts (απόφαση) ·
 *   services/mandate/showcase-email-confirmation-decision.ts (το πρότυπο) · lib/agency/showcase-holiday-answers.ts (ο κριτής)
 * @module services/mandate/holiday-hours-question-decision
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΔΥΟ ΣΥΝΑΡΤΗΣΕΙΣ — ΙΔΙΑ ΑΣΦΑΛΕΙΑ ΜΕ ΤΗΝ Α21.18
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Οι σαρωτές αλληλογραφίας ανοίγουν κάθε σύνδεσμο πριν τον άνθρωπο (Microsoft Safe Links: *«URLs are scanned prior to
 * message delivery»* · *«detonated asynchronously in the background»*). ⇒ {@link readHolidayQuestion} **μόνο διαβάζει**·
 * {@link decideHolidayQuestion} **μόνο** από κουμπί (`POST`).
 *
 * 🔑 **Η σελίδα ΔΕΝ δείχνει τις μέρες του email — δείχνει ό,τι ΑΚΟΜΗ περιμένει απάντηση στην κάρτα**: από την αποστολή ως
 * το κλικ μπορεί να δηλώθηκαν μέρες στη φόρμα, να άλλαξε το εβδομαδιαίο ωράριο ή να σβήστηκε κατάστημα. Αλήθεια είναι η κάρτα.
 *
 * 🔴 **Η ΑΠΟΦΑΣΗ ΕΙΝΑΙ ΜΙΑ ΣΥΝΑΛΛΑΓΗ**: ερώτηση · κάρτα · κριτής · ειδικές μέρες · σφράγισμα. Μια αποθήκευση της φόρμας την
 * ίδια στιγμή διαβάζει το ίδιο έγγραφο — όποιος χάσει ξαναεκτελείται, και η φόρμα βρίσκει τη μέρα ήδη δηλωμένη (ή το email
 * βρίσκει τη μέρα της φόρμας και απαντά «ήδη απαντημένη»). Διπλό γράψιμο της ίδιας μέρας είναι **αδύνατο**.
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { applyHolidayAnswers, type HolidayAnswer, type HolidayAnswerOutcome } from '@/lib/agency/showcase-holiday-answers';
import { AGENCY_SHOWCASE_CARD_ROUTE } from '@/lib/mandate/mandate-routes';
import { loginHref } from '@/lib/routes/return-path';
import { workspaceDestinationOf } from '@/lib/workspace/workspace-destination';
import { readShowcase } from '@/lib/agency/showcase-read';
import { greekPublicHolidayOn } from '@/lib/calendar/greek-public-holidays';
import {
  lastYearAnswer,
  pendingHolidayItems,
  type HolidayAnswerKind,
  type HolidayQuestionItem,
  type HoursOfLocation,
  type SettledHolidayAnswer,
} from '@/lib/calendar/holiday-question';
import { athensClockAt } from '@/lib/calendar/weekly-hours';
import { createModuleLogger } from '@/lib/telemetry';
import type { PublicShowcase } from '@/types/agency-profile';
import {
  readStoredHolidayQuestionState,
  type HolidayHoursQuestion,
  type HolidayHoursQuestionDocument,
  type HolidayHoursQuestionRefusal,
} from '@/types/holiday-hours-question';
import { holidayQuestionFactsKey, type HolidayQuestionFactsRef } from '@/types/notification-email-facts';
import type { ShowcaseLocation } from '@/types/showcase-card';

import { holidayQuestionSecret, readHolidayQuestionLink, type HolidayQuestionLinkFields } from './holiday-hours-question-token';
import { writeLocationSpecialHours } from './showcase-card-custody';

const logger = createModuleLogger('holiday-hours-question-decision');

/** Μία γραμμή της σελίδας: κατάστημα × ημερομηνία, με «πέρσι». */
export interface HolidayQuestionRow extends HolidayQuestionItem {
  readonly locationLabel: string | null;
  readonly locationRole: ShowcaseLocation['role'];
  readonly lastYear: HolidayAnswerKind | null;
}

/** Ό,τι ζωγραφίζει η σελίδα — **τίποτα** πέρα από αυτό δεν ταξιδεύει στο HTML. */
export interface HolidayQuestionView {
  readonly agencyName: string;
  readonly lastDate: string;
  readonly rows: readonly HolidayQuestionRow[];
  /**
   * «Άλλο ωράριο» ⇒ η φόρμα της κάρτας **στον χώρο του γραφείου**, μέσα από τη σύνδεση. `null` ⇒ ο χώρος δεν έχει διεύθυνση:
   * **κανένα** κουμπί προς 404 (ίδιο δόγμα με τα κουμπιά του email).
   */
  readonly cardFormPath: string | null;
}

type Refused = { readonly ok: false; readonly reason: HolidayHoursQuestionRefusal | 'unavailable' };

export type HolidayQuestionLookup = { readonly ok: true; readonly view: HolidayQuestionView } | Refused;

export type HolidayQuestionDecision =
  | {
      readonly ok: true;
      readonly outcomes: readonly { readonly answer: HolidayAnswer; readonly outcome: HolidayAnswerOutcome }[];
      /** Πόσες μέρες της περιόδου περιμένουν **ακόμη** απάντηση — `0` ⇒ η ερώτηση έκλεισε. */
      readonly remaining: number;
    }
  | Refused;

const refuse = (reason: HolidayHoursQuestionRefusal | 'unavailable'): Refused => ({ ok: false, reason });

function readQuestion(data: unknown): HolidayHoursQuestion {
  const raw = data as HolidayHoursQuestionDocument;
  return { ...raw, answers: Array.isArray(raw.answers) ? raw.answers : [], state: readStoredHolidayQuestionState(raw.state) };
}

function linkOf(token: string): HolidayQuestionLinkFields | 'unavailable' | null {
  const secret = holidayQuestionSecret();
  if (secret === null) {
    logger.error('[HOLIDAY-HOURS] Λείπει το μυστικό — κάθε σύνδεσμος φαίνεται μη διαθέσιμος');
    return 'unavailable';
  }
  return readHolidayQuestionLink(secret, token);
}

function questionRefusal(question: HolidayHoursQuestion, nonce: string, now: Date): HolidayHoursQuestionRefusal | null {
  if (question.nonce !== nonce) return 'link-invalid';
  if (question.state === 'answered') return 'already-answered';
  return athensClockAt(now).dateKey > question.lastDate ? 'expired' : null;
}

/** Ό,τι **ακόμη** περιμένει απάντηση στην κάρτα, μέσα στην περίοδο της ερώτησης — ο **ίδιος** κριτής με το cron. */
function seasonItems(question: HolidayHoursQuestion, locations: readonly HoursOfLocation[], now: Date): HolidayQuestionItem[] {
  return locations
    .flatMap((location) => pendingHolidayItems(location, now))
    .filter(({ date }) => question.seasonKey <= date && date <= question.lastDate);
}

/** Οι λυμένες απαντήσεις του γραφείου — η «μνήμη πέρσι». Το `companyId` στο ερώτημα (CHECK 3.10). */
async function historyOf(adminDb: AdminFirestore, companyId: string): Promise<SettledHolidayAnswer[]> {
  const snapshot = await adminDb.collection(COLLECTIONS.HOLIDAY_HOURS_QUESTIONS).where('companyId', '==', companyId).get();
  return snapshot.docs.flatMap((doc) => readQuestion(doc.data()).answers);
}

function rowsOf(question: HolidayHoursQuestion, showcase: PublicShowcase, history: readonly SettledHolidayAnswer[], now: Date): HolidayQuestionRow[] {
  const byId = new Map(showcase.locations.map((location) => [location.id, location]));
  return seasonItems(question, showcase.locations, now).map((item) => ({
    ...item,
    locationLabel: byId.get(item.locationId)?.label ?? null,
    locationRole: byId.get(item.locationId)?.role ?? 'headquarters',
    lastYear: lastYearAnswer(history, item),
  }));
}

/** Ένα αποθηκευμένο έγγραφο, όπως το δίνουν και η απλή ανάγνωση και η συναλλαγή. */
interface StoredSnapshot {
  readonly exists: boolean;
  data(): unknown;
}

function isRefused(value: object): value is Refused {
  return 'ok' in value && value.ok === false;
}

/**
 * **Υπάρχει, ανήκει σε αυτόν τον σύνδεσμο, ισχύει ακόμη;** — η **ίδια** ερώτηση για τη σελίδα, το κουμπί **και** την πύλη
 * της αποστολής. Κρίνεται με το `nonce`: ο σύνδεσμος και τα γεγονότα της ουράς το κουβαλούν και τα δύο.
 */
function usableQuestion(snapshot: StoredSnapshot, nonce: string, now: Date): HolidayHoursQuestion | Refused {
  if (!snapshot.exists) return refuse('question-unknown');
  const question = readQuestion(snapshot.data());
  const unusable = questionRefusal(question, nonce, now);
  return unusable === null ? question : refuse(unusable);
}

/** **Είναι ακόμη δημοσιευμένη η βιτρίνα;** — αλλιώς δεν υπάρχει κάρτα να δεχτεί ειδικές μέρες. */
function showcaseOf(profile: StoredSnapshot, companyId: string): PublicShowcase | Refused {
  const read = profile.exists ? readShowcase(profile.data(), companyId) : null;
  return read?.outcome === 'showcase' ? read.showcase : refuse('without-showcase');
}

/**
 * **Η φόρμα της κάρτας, στον χώρο του γραφείου** (ADR-849 Β1 — ποτέ στον χώρο του θεατή), **μέσα από τη σύνδεση**: το
 * `o/[workspace]/layout` στέλνει τον ανώνυμο σε σκέτο `/login` και θα έχανε τον προορισμό· το `?next=` τον κρατά, και ο
 * ήδη συνδεδεμένος περνά κατευθείαν.
 */
async function cardFormPathOf(companyId: string): Promise<string | null> {
  try {
    return loginHref(await workspaceDestinationOf({ kind: 'organization', companyId }, AGENCY_SHOWCASE_CARD_ROUTE));
  } catch (error) {
    logger.warn('[HOLIDAY-HOURS] Ο χώρος του γραφείου δεν έχει διεύθυνση — η σελίδα δεν προσφέρει «Άλλο ωράριο»', {
      companyId, error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/** **Ερώτηση που ισχύει + βιτρίνα που υπάρχει** — απλή ανάγνωση, κοινή για τη σελίδα και την πύλη της αποστολής. */
async function openQuestion(
  adminDb: AdminFirestore,
  questionId: string,
  nonce: string,
  now: Date,
): Promise<{ readonly question: HolidayHoursQuestion; readonly showcase: PublicShowcase } | Refused> {
  const question = usableQuestion(await adminDb.collection(COLLECTIONS.HOLIDAY_HOURS_QUESTIONS).doc(questionId).get(), nonce, now);
  if (isRefused(question)) return question;
  const showcase = showcaseOf(await adminDb.collection(COLLECTIONS.AGENCY_PROFILES).doc(question.companyId).get(), question.companyId);
  return isRefused(showcase) ? showcase : { question, showcase };
}

async function lookup(adminDb: AdminFirestore, link: HolidayQuestionLinkFields, now: Date): Promise<HolidayQuestionLookup> {
  const open = await openQuestion(adminDb, link.id, link.nonce, now);
  if (isRefused(open)) return open;
  const { question, showcase } = open;
  const rows = rowsOf(question, showcase, await historyOf(adminDb, question.companyId), now);
  if (rows.length === 0) return refuse('already-answered');
  const cardFormPath = await cardFormPathOf(question.companyId);
  return { ok: true, view: { agencyName: showcase.displayName, lastDate: question.lastDate, rows, cardFormPath } };
}

/** **Η σελίδα ρωτά: «τι περιμένει απάντηση;»** — ⛔ **ΚΑΜΙΑ ΕΓΓΡΑΦΗ**. Ο σαρωτής που την ανοίγει πρώτος δεν αλλάζει τίποτα. */
export async function readHolidayQuestion(adminDb: AdminFirestore, token: string, now: Date = new Date()): Promise<HolidayQuestionLookup> {
  const link = linkOf(token);
  if (link === 'unavailable') return refuse('unavailable');
  if (link === null) return refuse('link-invalid');
  try {
    return await lookup(adminDb, link, now);
  } catch (error) {
    logger.error('[HOLIDAY-HOURS] Η ανάγνωση ερώτησης απέτυχε', { error: error instanceof Error ? error.message : String(error) });
    return refuse('unavailable');
  }
}

function settledOf(outcomes: readonly { answer: HolidayAnswer; outcome: HolidayAnswerOutcome }[]): SettledHolidayAnswer[] {
  return outcomes.flatMap(({ answer, outcome }) => {
    const holiday = greekPublicHolidayOn(answer.date);
    return outcome === 'applied' && holiday !== null ? [{ ...answer, holiday }] : [];
  });
}

async function decide(adminDb: AdminFirestore, link: HolidayQuestionLinkFields, answers: readonly HolidayAnswer[], now: Date): Promise<HolidayQuestionDecision> {
  const questionRef = adminDb.collection(COLLECTIONS.HOLIDAY_HOURS_QUESTIONS).doc(link.id);
  return adminDb.runTransaction(async (tx): Promise<HolidayQuestionDecision> => {
    const question = usableQuestion(await tx.get(questionRef), link.nonce, now);
    if (isRefused(question)) return question;
    const showcase = showcaseOf(await tx.get(adminDb.collection(COLLECTIONS.AGENCY_PROFILES).doc(question.companyId)), question.companyId);
    if (isRefused(showcase)) return showcase;

    const inSeason = answers.filter(({ date }) => question.seasonKey <= date && date <= question.lastDate);
    const applied = applyHolidayAnswers(showcase.locations, inSeason, now);
    if (applied.kind === 'rejected') return refuse('special-hours-invalid');
    const settled = settledOf(applied.outcomes);
    if (settled.length > 0) writeLocationSpecialHours(adminDb, tx, question.companyId, applied.locations);
    const remaining = seasonItems(question, applied.locations, now).length;
    tx.update(questionRef, {
      answers: [...question.answers, ...settled],
      answeredByUid: link.recipientUid,
      ...(remaining === 0 ? { state: 'answered', settledAt: now.toISOString() } : {}),
    });
    return { ok: true, outcomes: applied.outcomes, remaining };
  });
}

/**
 * **Το κουμπί.** Υπογραφή πριν από κάθε ανάγνωση· όλα τα υπόλοιπα σε **μία** συναλλαγή — δύο πατήματα (διπλό κλικ, δύο
 * διαχειριστές) δίνουν **μία** ειδική μέρα και ένα «ήδη απαντημένη».
 */
export async function decideHolidayQuestion(
  adminDb: AdminFirestore,
  token: string,
  answers: readonly HolidayAnswer[],
  now: Date = new Date(),
): Promise<HolidayQuestionDecision> {
  const link = linkOf(token);
  if (link === 'unavailable') return refuse('unavailable');
  if (link === null) return refuse('link-invalid');
  try {
    return await decide(adminDb, link, answers, now);
  } catch (error) {
    logger.error('[HOLIDAY-HOURS] Η απάντηση απέτυχε', { error: error instanceof Error ? error.message : String(error) });
    return refuse('unavailable');
  }
}

async function stillAsking(adminDb: AdminFirestore, ref: HolidayQuestionFactsRef, now: Date): Promise<boolean> {
  const open = await openQuestion(adminDb, ref.questionId, ref.nonce, now);
  return !isRefused(open) && seasonItems(open.question, open.showcase.locations, now).length > 0;
}

/**
 * **Η πύλη της αποστολής ρωτά: «έχει ακόμη νόημα αυτό το email;»** — ο **ίδιος** κριτής με τη σελίδα και το κουμπί.
 * Επιστρέφει τα κλειδιά (`holidayQuestionFactsKey`) των ερωτήσεων που **ακόμη** περιμένουν απάντηση.
 *
 * ⚠️ **Δεν πιάνει σφάλματα, επίτηδες**: αποτυχία ανάγνωσης ρίχνει, και ο αγωγός αφήνει **όλα** τα μηνύματα `pending` για το
 * επόμενο πέρασμα (ADR-849 Δ4). «Στείλ' το» θα ρωτούσε ήδη απαντημένο· «σβήσ' το» θα ήταν σιωπηλή απώλεια.
 */
export async function holidayQuestionsStillAsking(
  adminDb: AdminFirestore,
  refs: readonly HolidayQuestionFactsRef[],
  now: Date = new Date(),
): Promise<ReadonlySet<string>> {
  const unique = new Map(refs.map((ref) => [holidayQuestionFactsKey(ref), ref]));
  const verdicts = await Promise.all([...unique].map(async ([key, ref]) => ((await stillAsking(adminDb, ref, now)) ? [key] : [])));
  return new Set(verdicts.flat());
}
