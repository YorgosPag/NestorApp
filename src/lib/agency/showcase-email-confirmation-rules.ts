/**
 * @fileoverview **ΤΙ ΣΗΜΑΙΝΕΙ «ΕΠΙΒΕΒΑΙΩΘΗΚΕ»** — οι κανόνες της επιβεβαίωσης email της κάρτας (ADR-841 §7 Α21.18).
 * @related services/mandate/showcase-email-confirmation.service.ts (η εξαργύρωση) ·
 *   lib/agency/showcase-card-form.ts (η κάρτα) · lib/agency/showcase-card-channels-read.ts (ο αναγνώστης)
 * @module lib/agency/showcase-email-confirmation-rules
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΡΕΙΣ ΓΡΑΦΕΙΣ ΡΩΤΟΥΝ ΤΟ ΙΔΙΟ — ΓΙ' ΑΥΤΟ Η ΑΠΑΝΤΗΣΗ ΖΕΙ ΕΔΩ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η αποθήκευση κάρτας, η εξαργύρωση συνδέσμου και ο αναγνώστης καναλιών ρωτούν *«ποιες
 * επιβεβαιώσεις ισχύουν για αυτά τα email;»* και *«ποια είναι η νεότερη;»*. Τρεις διατυπώσεις θα
 * διαφωνούσαν στην πρώτη αλλαγή — π.χ. η κάρτα θα κρατούσε το σήμα μιας διεύθυνσης που ο
 * αναγνώστης πετά, και το δημόσιο `emailConfirmedAt` θα έδειχνε ημερομηνία που καμία διεύθυνση
 * δεν δικαιολογεί (ADR-749).
 *
 * 🏆 **ΦΘΟΡΑ, ΟΧΙ ΛΗΞΗ** (απόφαση Giorgio 2026-09-14): μετά από {@link EMAIL_CONFIRMATION_FRESH_MONTHS}
 * μήνες το σήμα **δεν κρύβεται** — γίνεται `aged`. Η ημερομηνία λέει ήδη την αλήθεια· η φθορά
 * απλώς σταματά να τη **φωνάζει**. Κανένας από τους μεγάλους δεν δείχνει φρεσκάδα σε σήμα καναλιού.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, κανένα I/O, **κανένα ρολόι** (το «τώρα» περνιέται).
 */

import { sameChannelEmail } from '@/lib/contact/channel-email';
import { addMonthsUTC } from '@/lib/date-local';
import type { ShowcaseEmailConfirmation } from '@/types/showcase-card';

/** Πόσο ζει ο σύνδεσμος. 72ω: το επαγγελματικό email της Παρασκευής ανοίγει τη Δευτέρα. */
export const EMAIL_CONFIRMATION_LIFETIME_HOURS = 72;

/** Μετά από πόσους μήνες μια επιβεβαίωση παύει να είναι «φρέσκια». */
export const EMAIL_CONFIRMATION_FRESH_MONTHS = 12;

export type EmailConfirmationFreshness = 'fresh' | 'aged';

const HOUR_MS = 60 * 60 * 1000;

function instantOf(iso: string): number | null {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

/** Η νεότερη **αναγνώσιμη** επιβεβαίωση για αυτή τη διεύθυνση — ή `null`. */
function latestFor(confirmations: readonly ShowcaseEmailConfirmation[], email: string): string | null {
  let latest: string | null = null;
  for (const confirmation of confirmations) {
    const at = instantOf(confirmation.confirmedAt);
    if (at === null || !sameChannelEmail(confirmation.email, email)) continue;
    if (latest === null || at > (instantOf(latest) ?? 0)) latest = confirmation.confirmedAt;
  }
  return latest;
}

/**
 * **Ποιες επιβεβαιώσεις επιβιώνουν** για τα τρέχοντα email — μία ανά διεύθυνση, η νεότερη, στη
 * σειρά των email.
 *
 * 🔴 Μια διεύθυνση που **έφυγε** από την κάρτα χάνει την επιβεβαίωση **οριστικά**: αν ξαναμπεί,
 * ξαναποδεικνύεται. Αλλιώς «έβγαλα το email και το ξανάβαλα» θα μετέφερε σήμα σε γραμματοκιβώτιο
 * που μπορεί να έχει αλλάξει κάτοχο στο μεταξύ.
 */
export function carryConfirmations(
  previous: readonly ShowcaseEmailConfirmation[],
  currentEmails: readonly string[],
): readonly ShowcaseEmailConfirmation[] {
  const carried: ShowcaseEmailConfirmation[] = [];
  for (const email of currentEmails) {
    const confirmedAt = latestFor(previous, email);
    if (confirmedAt !== null) carried.push({ email, confirmedAt });
  }
  return carried;
}

/** **Η νεότερη επιβεβαίωση** — ό,τι δημοσιεύεται ως `ShowcaseLocation.emailConfirmedAt`. */
export function latestConfirmedAt(confirmations: readonly ShowcaseEmailConfirmation[]): string | null {
  let latest: string | null = null;
  for (const { confirmedAt } of confirmations) {
    const at = instantOf(confirmedAt);
    if (at !== null && (latest === null || at > (instantOf(latest) ?? 0))) latest = confirmedAt;
  }
  return latest;
}

/** **Νέα επιβεβαίωση** — αντικαθιστά τυχόν παλιότερη της **ίδιας** διεύθυνσης, ποτέ δεύτερη γραμμή. */
export function withConfirmation(
  confirmations: readonly ShowcaseEmailConfirmation[],
  email: string,
  confirmedAt: string,
): readonly ShowcaseEmailConfirmation[] {
  return [...confirmations.filter((entry) => !sameChannelEmail(entry.email, email)), { email, confirmedAt }];
}

/**
 * **Το γραμματοκιβώτιο αποδείχθηκε ανύπαρκτο** (ADR-841 §7 Α21.20) — αφαιρεί την επιβεβαίωση αυτής της
 * διεύθυνσης **μόνο** αν είναι **παλαιότερη** από την απόδειξη.
 *
 * 🏆 **ΑΥΤΟΘΕΡΑΠΕΙΑ ΚΑΤΑ ΚΑΤΑΣΚΕΥΗ**: επιβεβαίωση **νεότερη** από το bounce σημαίνει ότι κάποιος πάτησε
 * σύνδεσμο που **έφτασε** μετά — το γραμματοκιβώτιο ξαναζεί, και καμία καθυστερημένη επανάληψη του
 * παλιού bounce δεν επιτρέπεται να τη σβήσει.
 *
 * ⚠️ Μη αναγνώσιμη ημερομηνία επιβεβαίωσης ⇒ αφαιρείται (η αστοχία πηγαίνει προς το **να μη φωνάξουμε**)·
 * μη αναγνώσιμη απόδειξη ⇒ **τίποτα** (ποτέ αφαίρεση σήματος χωρίς απόδειξη).
 */
export function withoutConfirmationBefore(
  confirmations: readonly ShowcaseEmailConfirmation[],
  email: string,
  evidenceAt: string,
): readonly ShowcaseEmailConfirmation[] {
  const evidence = instantOf(evidenceAt);
  if (evidence === null) return confirmations;
  return confirmations.filter((entry) => {
    if (!sameChannelEmail(entry.email, email)) return true;
    const confirmed = instantOf(entry.confirmedAt);
    return confirmed !== null && confirmed > evidence;
  });
}

/**
 * **Ισχύει ακόμη η επιστροφή;** (Α21.20) — ο ίδιος κανόνας με το {@link withoutConfirmationBefore}, από την
 * πλευρά της οθόνης: επιβεβαίωση **νεότερη** από την επιστροφή ⇒ η επιστροφή είναι ιστορία.
 */
export function returnStands(returnedAt: string | null, confirmedAt: string | null): boolean {
  const returned = returnedAt === null ? null : instantOf(returnedAt);
  if (returned === null) return false;
  const confirmed = confirmedAt === null ? null : instantOf(confirmedAt);
  return confirmed === null || returned >= confirmed;
}

/**
 * **Φρέσκια ή παλιά;** — ημερολογιακοί μήνες σε UTC (`addMonthsUTC`, το SSoT με το σωστό κόψιμο
 * στο τέλος του μήνα).
 *
 * ⚠️ Μη αναγνώσιμη ημερομηνία ⇒ `aged`: η αστοχία πηγαίνει προς το **να μη φωνάξουμε**, ποτέ
 * προς σήμα που δεν στηρίζεται σε τίποτα.
 */
export function confirmationFreshness(confirmedAt: string, nowISO: string): EmailConfirmationFreshness {
  const boundary = addMonthsUTC(confirmedAt, EMAIL_CONFIRMATION_FRESH_MONTHS);
  const now = instantOf(nowISO);
  if (boundary === null || now === null) return 'aged';
  return now < (instantOf(boundary) ?? 0) ? 'fresh' : 'aged';
}

/** **Πότε λήγει** σύνδεσμος που εκδίδεται τώρα — ISO, ή `null` αν το «τώρα» δεν διαβάζεται. */
export function confirmationLinkExpiresAt(nowISO: string): string | null {
  const now = instantOf(nowISO);
  return now === null ? null : new Date(now + EMAIL_CONFIRMATION_LIFETIME_HOURS * HOUR_MS).toISOString();
}
