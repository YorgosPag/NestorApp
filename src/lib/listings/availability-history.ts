/**
 * @fileoverview **Η ΚΡΙΣΗ «ΜΕΤΑΤΕΘΗΚΕ Η ΥΠΟΣΧΕΣΗ;»**: καθαρή, χωρίς Firestore και χωρίς ρολόι.
 * @related ADR-919 §10 · ADR-777 §8.99.4 (Δ3) · types/availability-history.ts · lib/listings/price-history.ts
 * @module lib/listings/availability-history
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΕΣΣΕΡΙΣ ΕΡΩΤΗΣΕΙΣ, ΜΙΑ ΘΕΣΗ (δίδυμο του `price-history.ts`)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | Ερώτηση | Συνάρτηση | Καλών |
 * |---|---|---|
 * | «τι είδε το κοινό; άλλαξε; τι γράφω;» | {@link publicAvailabilityOf} · {@link nextAvailabilityHistory} | η σφραγίδα |
 * | «τι λέει η ιστορία;» | {@link availabilityTrackForListing} | η προβολή |
 * | «λέγεται το "μετατέθηκε N";» | {@link slipNoticeOf} | η οθόνη (βήμα 7) |
 * | «είναι ακόμη είδηση;» | {@link isAvailabilityChangeFresh} | ο ειδοποιητής |
 *
 * 🔴 **ΜΟΝΟ ΔΗΜΟΣΙΕΣ ΤΙΜΕΣ.** Η είσοδος είναι η `PublicListing.availability` που βγάζει ο επιλυτής, και
 * μόνο όταν η αγγελία περνά το `isPubliclyListed`. Τίποτα από φάσεις, πρόβλεψη ή `completionDate`
 * (ADR-777 §8.99.4 «Ιδιωτικότητα»).
 *
 * 🔑 **Κρίνεται το ΤΕΛΟΣ του διαστήματος** (Δ2), το ίδιο κριτήριο με το `timingBlockers`. Το «Γ' τρίμηνο» →
 * «Σεπτέμβριος» είναι εξειδίκευση, όχι μετάθεση. Το «Γ' τρίμηνο» → «Οκτώβριος» είναι μετάθεση.
 */

import { z } from 'zod';

import { canonicalJson } from '@/lib/legal/canonical-json';
import { MS_PER_DAY } from '@/lib/date-local';
import {
  AVAILABILITY_REVISION_KINDS,
  type AvailabilityChange,
  type AvailabilityObservation,
  type AvailabilityRevisionKind,
  type AvailabilityTrack,
  type ScheduledAvailability,
} from '@/types/availability-history';
import type { ListingAvailability } from '@/types/listing-availability';

import { isoInstant } from './price-history';
import { readStoredAvailability } from './public-listing-shape-judges';

// ============================================================================
// ΟΙ ΣΤΑΘΕΡΕΣ: μία θέση
// ============================================================================

/**
 * Άνω φράγμα εγγραφών. Η δημόσια υπόσχεση αλλάζει με **ανθρώπινη** πράξη, οπότε 24 αλλαγές είναι πολύ
 * πάνω από κάθε πραγματικό έργο. Στην υπέρβαση κρατιέται η **αρχή του επεισοδίου** (δες {@link capHistory}).
 */
export const AVAILABILITY_HISTORY_MAX_ENTRIES = 24;

/**
 * **Πόσο μένει «είδηση» μια αλλαγή** για τον ειδοποιητή. Το ωριαίο πέρασμα την πιάνει σε μία ώρα, άρα το
 * παράθυρο είναι **φράχτης backfill**: η πρώτη ανάπτυξη δεν στέλνει μηνύματα για αλλαγές μηνών.
 *
 * ⚠️ **Αφορά ΜΟΝΟ την ειδοποίηση, όχι την οθόνη**: το «μετατέθηκε 1 φορά» μένει αληθές για πάντα (αντίθετα με
 * τη μείωση τιμής, που κατά Omnibus αφορά την **τρέχουσα** προσφορά).
 */
export const AVAILABILITY_CHANGE_NEWS_WINDOW_DAYS = 30;

// ============================================================================
// ΑΝΑΓΝΩΣΗ: το σύνορο του αποθηκευμένου
// ============================================================================

const observationShape = z.object({ at: isoInstant, availability: z.unknown() });

function sameAvailability(a: ListingAvailability, b: ListingAvailability): boolean {
  return canonicalJson(a) === canonicalJson(b);
}

/** Αποθηκευμένη τιμή που ο κριτής του σχήματος ξαναβγάζει **ταυτόσημη**, ή `null`. */
function canonicalAvailability(raw: unknown): ListingAvailability | null {
  const read = readStoredAvailability(raw);
  return canonicalJson(read) === canonicalJson(raw) ? read : null;
}

/**
 * **Το αποθηκευμένο ιστορικό**, ή κενό όταν λείπει ή δεν στέκει.
 *
 * ⚠️ **Μία κακή εγγραφή ⇒ ΟΛΟ κενό, και αυτή είναι η συντηρητική κατεύθυνση.** Ο κριτής του σχήματος
 * διαβάζει το σκουπίδι ως `unknown`, και ένα κατασκευασμένο `unknown` θα έβγαζε ψεύτικη «απόσυρση». Το κενό
 * ιστορικό δεν γεννά **ποτέ** ισχυρισμό «μετατέθηκε» προς τον κόσμο.
 */
export function readAvailabilityHistory(value: unknown): readonly AvailabilityObservation[] {
  const parsed = z.array(observationShape).safeParse(value);
  if (!parsed.success) return [];
  const entries: AvailabilityObservation[] = [];
  for (const entry of parsed.data) {
    const availability = canonicalAvailability(entry.availability);
    if (availability === null) return [];
    entries.push({ at: entry.at, availability });
  }
  return entries.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

// ============================================================================
// Η ΕΓΓΡΑΦΗ: τι είδε το κοινό, και τι προστίθεται
// ============================================================================

/**
 * **Τι υποσχέθηκε η αγγελία στο κοινό αυτή τη στιγμή**, ή `null` όταν δεν είναι δημόσια (τίποτα προς καταγραφή).
 *
 * ⚠️ **Το «δημόσια;» ΔΕΝ κρίνεται εδώ.** Έρχεται ως όρισμα από το `isPubliclyListed`, τον **έναν** κριτή
 * δημοσίευσης, όπως στο `marketPriceOf`.
 */
export function publicAvailabilityOf(
  availability: ListingAvailability,
  publiclyListed: boolean,
): ListingAvailability | null {
  return publiclyListed ? availability : null;
}

/**
 * **Το ιστορικό μετά από αυτό το πέρασμα**, ή `null` όταν **δεν αλλάζει τίποτα** (η σφραγίδα δεν ανοίγει
 * τότε καν συναλλαγή).
 *
 * 🔑 **Το ιστορικό ξεκινά στην πρώτη δημόσια ΥΠΟΣΧΕΣΗ (`scheduled`).** Ένα έτοιμο ή άγνωστο ακίνητο δεν
 * υποσχέθηκε ποτέ τίποτα. Αλλιώς κάθε μεταπώληση θα γέμιζε εγγραφές `ready`.
 *
 * 🔴 **Μόνο προς τα εμπρός στον χρόνο**, όπως το `nextPriceHistory`: πέρασμα με στιγμή όχι μεταγενέστερη της
 * τελευταίας παρατήρησης δεν γράφει.
 */
export function nextAvailabilityHistory(
  history: readonly AvailabilityObservation[],
  availability: ListingAvailability | null,
  at: string,
): readonly AvailabilityObservation[] | null {
  if (availability === null) return null;
  const last = history.at(-1);
  if (last === undefined && availability.kind !== 'scheduled') return null;
  if (last !== undefined && sameAvailability(last.availability, availability)) return null;
  if (last !== undefined && Date.parse(at) <= Date.parse(last.at)) return null;
  return capHistory([...history, { at, availability }]);
}

/** Η αρχή του τελευταίου επεισοδίου: μετά το τελευταίο `ready` που **δεν** είναι η τελευταία εγγραφή. */
function episodeStartOf(entries: readonly AvailabilityObservation[]): number {
  for (let index = entries.length - 2; index >= 0; index -= 1) {
    if (entries[index].availability.kind === 'ready') return index + 1;
  }
  return 0;
}

/**
 * Κρατά τις τελευταίες {@link AVAILABILITY_HISTORY_MAX_ENTRIES} εγγραφές, **μαζί με την αρχική υπόσχεση** του
 * επεισοδίου. Χωρίς αυτήν, το «αρχικά …» θα έδειχνε μια μεταγενέστερη υπόσχεση ως αρχική.
 *
 * 🔶 **Δηλωμένο όριο**: όταν κόβονται ενδιάμεσες εγγραφές, το πλήθος μεταθέσεων μπορεί να βγει **μικρότερο**,
 * ποτέ μεγαλύτερο. Ο κόσμος δεν ακούει ποτέ ισχυρισμό που δεν τεκμηριώνεται.
 */
function capHistory(entries: readonly AvailabilityObservation[]): readonly AvailabilityObservation[] {
  if (entries.length <= AVAILABILITY_HISTORY_MAX_ENTRIES) return entries;
  const tail = entries.slice(-(AVAILABILITY_HISTORY_MAX_ENTRIES - 1));
  const episodeStart = episodeStartOf(entries);
  const start = entries.findIndex(
    (entry, index) => index >= episodeStart && entry.availability.kind === 'scheduled',
  );
  const startCut = start !== -1 && start < entries.length - tail.length;
  return startCut ? [entries[start], ...tail] : entries.slice(-AVAILABILITY_HISTORY_MAX_ENTRIES);
}

// ============================================================================
// Η ΚΡΙΣΗ: τι είδους αλλαγή, και τι λέει η ιστορία
// ============================================================================

/**
 * **Τι είδους αλλαγή** είναι μια νέα δημόσια τιμή. Το `scheduled` συγκρίνεται με την **προηγούμενη υπόσχεση**
 * του επεισοδίου (όχι απλώς την προηγούμενη τιμή): το Β' τρ. → «άγνωστο» → Δ' τρ. **είναι** μετάθεση για όποιον
 * είδε το Β' τρίμηνο.
 */
export function availabilityRevisionOf(
  previousPromise: ScheduledAvailability | null,
  to: ListingAvailability,
): AvailabilityRevisionKind {
  if (to.kind === 'ready') return 'delivered';
  if (to.kind === 'unknown') return 'withdrawn';
  if (previousPromise === null) return 'promised';
  if (to.window.end > previousPromise.window.end) return 'slipped';
  return to.window.end < previousPromise.window.end ? 'advanced' : 'refined';
}

interface TrackDraft {
  originally: ScheduledAvailability | null;
  promise: ScheduledAvailability | null;
  slips: number;
  lastChange: AvailabilityChange | null;
}

function absorbObservation(
  draft: TrackDraft,
  previous: AvailabilityObservation | undefined,
  entry: AvailabilityObservation,
): void {
  const { availability } = entry;
  if (previous !== undefined && draft.originally !== null) {
    const kind = availabilityRevisionOf(draft.promise, availability);
    draft.lastChange = { kind, from: previous.availability, at: entry.at };
    if (kind === 'slipped') draft.slips += 1;
  }
  if (availability.kind !== 'scheduled') return;
  draft.originally ??= availability;
  draft.promise = availability;
}

/**
 * **Η ιστορία του τελευταίου επεισοδίου**, ή `null` όταν η αγγελία δεν υποσχέθηκε ποτέ κάτι.
 *
 * 🔑 Ένα κλειστό επεισόδιο (τελευταία εγγραφή `ready`) **κρατά** την ιστορία του: ο ειδοποιητής χρειάζεται
 * το `lastChange: delivered` για να πει «ταιριάζει ξανά». Την οθόνη τη φράζει το {@link slipNoticeOf}.
 */
export function availabilityTrackOf(history: readonly AvailabilityObservation[]): AvailabilityTrack | null {
  const episode = history.slice(episodeStartOf(history));
  const draft: TrackDraft = { originally: null, promise: null, slips: 0, lastChange: null };
  episode.forEach((entry, index) => absorbObservation(draft, episode[index - 1], entry));
  if (draft.originally === null) return null;
  return { originally: draft.originally, slips: draft.slips, lastChange: draft.lastChange };
}

/**
 * **Η ιστορία που γράφεται στη δημόσια αγγελία**: μόνο αν λέει την **ίδια** τιμή με την αγγελία.
 *
 * 🔴 **ΤΟ ΔΙΧΤΥ (N.7.2 #4)**, ίδιο με το `reductionForListing`: αν η σφραγίδα απέτυχε, το ιστορικό μένει **πίσω**
 * και η τελευταία του παρατήρηση **δεν** είναι η τρέχουσα τιμή. Τότε η κάρτα θα έγραφε «μετατέθηκε» δίπλα σε
 * υπόσχεση που δεν το ξέρει. Ασυμφωνία ⇒ `null`: η σιωπή είναι αληθής.
 */
export function availabilityTrackForListing(
  storedHistory: unknown,
  availability: ListingAvailability,
): AvailabilityTrack | null {
  const history = readAvailabilityHistory(storedHistory);
  const last = history.at(-1);
  if (last === undefined || !sameAvailability(last.availability, availability)) return null;
  return availabilityTrackOf(history);
}

const storedTrackShape = z.object({
  originally: z.unknown(),
  slips: z.number().int().min(0),
  lastChange: z
    .object({ kind: z.enum(AVAILABILITY_REVISION_KINDS), from: z.unknown(), at: isoInstant })
    .nullable(),
});

/**
 * **Η αποθηκευμένη δημόσια ιστορία** (κρίκος σχήματος 27): έλεγχος **ΒΑΘΥΣ**, ή `null`.
 *
 * 🔑 Κάθε διαθεσιμότητα μέσα της περνά από τον **ίδιο** κριτή με το `availability` (`readStoredAvailability`) και
 * κρατιέται μόνο αν βγαίνει ταυτόσημη. Η αρχική υπόσχεση πρέπει να είναι `scheduled`. Σκουπίδι ⇒ `null`
 * («δεν υπάρχει ιστορία»), ποτέ ψεύτικο πλήθος μεταθέσεων. **Ιδιοδύναμο (Κ3).**
 */
export function readStoredAvailabilityTrack(value: unknown): AvailabilityTrack | null {
  const parsed = storedTrackShape.safeParse(value);
  if (!parsed.success) return null;
  const originally = canonicalAvailability(parsed.data.originally);
  if (originally === null || originally.kind !== 'scheduled') return null;
  const stored = parsed.data.lastChange;
  if (stored === null) return { originally, slips: parsed.data.slips, lastChange: null };
  const from = canonicalAvailability(stored.from);
  if (from === null) return null;
  return { originally, slips: parsed.data.slips, lastChange: { kind: stored.kind, from, at: stored.at } };
}

/** Η δημόσια σήμανση «αρχικά Χ · μετατέθηκε N φορές». */
export interface SlipNotice {
  readonly originally: ScheduledAvailability;
  readonly slips: number;
}

/**
 * **Λέγεται το «μετατέθηκε N»;** Μόνο όσο η αγγελία **υπόσχεται** ακόμη (`scheduled`) και υπήρξε τουλάχιστον μία
 * μετάθεση. Μετά την παράδοση η υπόσχεση εκπληρώθηκε και η ιστορία δεν αφορά πια τον αγοραστή.
 */
export function slipNoticeOf(
  track: AvailabilityTrack | null,
  availability: ListingAvailability,
): SlipNotice | null {
  if (track === null || availability.kind !== 'scheduled' || track.slips < 1) return null;
  return { originally: track.originally, slips: track.slips };
}

/** **Είναι ακόμη είδηση η αλλαγή;** Το «τώρα» είναι όρισμα, όπως σε όλη τη μηχανή ζήτησης. */
export function isAvailabilityChangeFresh(change: AvailabilityChange, nowMs: number): boolean {
  const atMs = Date.parse(change.at);
  return Number.isFinite(atMs) && nowMs - atMs <= AVAILABILITY_CHANGE_NEWS_WINDOW_DAYS * MS_PER_DAY;
}
