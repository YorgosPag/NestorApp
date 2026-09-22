/**
 * @fileoverview **Η ερώτηση διαμονής στη διεύθυνση** — `in` · `out` · `guests` · `pets` ⇄ τιμές.
 * @related ADR-777 §8.60.21.7 · ADR-835 §4.6 · lib/listings/listing-filters.ts · hooks/listings/useListingStayQuestion.ts
 * @module lib/listings/listing-stay-url
 *
 * 🔑 **Ένας αναγνώστης και ο καθρέφτης του, ανά κλειδί, με τον ΙΔΙΟ κριτή.** Ό,τι ο αναγνώστης θα
 * απέρριπτε, ο γραφέας το **σβήνει** αντί να το γράψει. Έτσι ένας σύνδεσμος που χάνει την επιλογή
 * του στην ανανέωση είναι δομικά αδύνατος. Τα κλειδιά (`STAY_PARAM`) **δεν εξάγονται**: όποιος θέλει
 * να γράψει κάτι από αυτά περνά από έναν γραφέα (⛔ ποτέ `params.set('guests', …)` αλλού).
 *
 * 🏆 **Γιατί η ερώτηση ζει στη διεύθυνση και στη σελίδα της αγγελίας** (έρευνα 2026-09-22): Airbnb
 * (`/rooms/ID?check_in&check_out&adults&pets`), Booking (`checkin&checkout&group_adults`) και Vrbo
 * κουβαλούν ημερομηνίες και άτομα στη διεύθυνση της **σελίδας**, όχι σε μια φόρμα. Εμείς πάμε ένα
 * βήμα πιο πέρα: **`null` = δεν ρωτήθηκε, ποτέ «ένα»**. Το Airbnb βάζει σιωπηλά ενήλικες, ενώ εδώ ο
 * οικοδεσπότης βλέπει μόνο ό,τι δήλωσε ο επισκέπτης.
 *
 * ⚠️ **Εξήχθη από το `listing-filters.ts`** (2026-09-22), όταν εκείνο έφτασε τις 497 γραμμές και
 * χρειαζόταν δύο ακόμη καθρέφτες. Το **συνεκτικό** κομμάτι ήταν αυτό: τέσσερα κλειδιά, μία ερώτηση.
 * Η σύνθεση (`parseListingFilters` · `serializeListingFilters` · `stayQueryOf`) μένει εκεί.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις πάνω σε `URLSearchParams`.
 */

import { intervalShape } from '@/lib/date-local';
import { readFiniteNumber } from '@/lib/criteria/listing-criteria-url';
import { isWholeGuestCount, isWholePetCount } from '@/lib/offers/offer-amount';

/**
 * **Ο ΧΡΟΝΙΚΟΣ ΑΞΟΝΑΣ** — η απάντηση στο *«πότε;»* (ADR-835 §4.6).
 *
 * 🔑 **Αντικείμενο `| null`, ΠΟΤΕ δύο επίπεδα πεδία** — ίδιο ιδίωμα με το `GeoCircle`,
 * και για τον **ίδιο ακριβώς λόγο**: μια άφιξη χωρίς αναχώρηση δεν είναι «σχεδόν
 * ερώτηση», είναι **μη ερώτηση**. Δύο `string | null` πεδία θα επέτρεπαν στον τύπο να
 * εκφράσει τη μισή, και κάθε καταναλωτής θα έπρεπε να θυμάται τον έλεγχο — δηλαδή θα
 * τον ξεχνούσε κάποιος.
 *
 * ⚠️ **Ημι-ανοιχτό `[checkIn, checkOut)`** (§16 · ADR-832 §5.2): η μέρα αναχώρησης
 * **είναι** μέρα άφιξης του επόμενου. **Μην το αγγίξεις.**
 */
export interface ListingStayWindow {
  /** ISO `YYYY-MM-DD` — η άφιξη. Ανήκει στο διάστημα. */
  readonly checkIn: string;
  /** ISO `YYYY-MM-DD` — η αναχώρηση. **ΔΕΝ** ανήκει στο διάστημα. */
  readonly checkOut: string;
}

/**
 * Τα κλειδιά της ερώτησης διαμονής. Το ότι δεν συγκρούονται με τα κλειδιά κριτηρίων είναι
 * **άγκυρα** (`RESERVED_SEARCH_PARAMS` στο `listing-criteria-url`), όχι σχόλιο.
 */
const STAY_PARAM = {
  checkIn: 'in',
  checkOut: 'out',
  guests: 'guests',
  pets: 'pets',
} as const;

/**
 * **Αυστηρή ημερολογιακή μέρα `YYYY-MM-DD`** — τίποτα άλλο.
 *
 * 🔴 **ΓΙΑΤΙ REGEX ΚΑΙ ΟΧΙ ΣΚΕΤΟ `intervalShape`.** Ο αναγνώστης στιγμών δέχεται
 * **πολλές** μορφές (`2026-08-10T12:00:00Z`, `Timestamp`, …) και θα τις έκρινε μια
 * χαρά. Αλλά ο τύπος {@link ListingStayWindow} υπόσχεται **ημέρα**, και μια στιγμή με
 * **ώρα** μέσα σε ημι-ανοιχτό διάστημα νυχτών αλλάζει σιωπηλά τη σημασία της
 * αναχώρησης — δηλαδή θα έκανε τη **διαδοχή** δύο κρατήσεων να επικαλύπτεται κατά
 * μισή μέρα, στην πιο ακριβή δυνατή θέση.
 *
 * ⚠️ Ο έλεγχος είναι **μορφής**, όχι υπαρκτότητας: το `2026-02-31` περνά εδώ και
 * κόβεται από το {@link intervalShape} παρακάτω, που το διαβάζει ως στιγμή.
 */
const CALENDAR_DAY = /^\d{4}-\d{2}-\d{2}$/;

function readDay(params: URLSearchParams, key: string): string | null {
  const raw = params.get(key)?.trim() ?? '';
  return CALENDAR_DAY.test(raw) ? raw : null;
}

/**
 * **Ο ΕΝΑΣ κριτής του παραθύρου** — ο ίδιος για τον αναγνώστη και τον γραφέα.
 *
 * 🔴 **ΚΑΙ ΤΟ ΔΙΑΣΤΗΜΑ ΠΡΕΠΕΙ ΝΑ ΕΙΝΑΙ `proper`** — ο φρουρός του Ε-10, στη μία θέση
 * που ο κόσμος γράφει ημερομηνίες με το χέρι. Ένα **κενό** (`in === out`) θα ήταν
 * αίτημα **μηδέν νυχτών**· ένα **ανάποδο** (`out < in`) δεν περιγράφει διάστημα. Και
 * τα δύο θα ταξίδευαν σε κάθε κοινοποιημένο σύνδεσμο, και ο κριτής θα τα έκρινε
 * **ασυνεπώς** (§17). Απορρίπτονται **εδώ**, στην πόρτα.
 */
function isProperWindow(window: ListingStayWindow): boolean {
  return CALENDAR_DAY.test(window.checkIn)
    && CALENDAR_DAY.test(window.checkOut)
    && intervalShape(window.checkIn, window.checkOut) === 'proper';
}

/**
 * Διεύθυνση → χρονικό παράθυρο, ή `null`.
 *
 * ⚠️ **Απαιτούνται ΚΑΙ ΤΑ ΔΥΟ άκρα** — ίδιος κανόνας με το `lat`/`lng`: μισό παράθυρο
 * δεν είναι μισή ερώτηση, είναι **καμία**.
 */
export function readListingStayWindow(params: URLSearchParams): ListingStayWindow | null {
  const checkIn = readDay(params, STAY_PARAM.checkIn);
  const checkOut = readDay(params, STAY_PARAM.checkOut);
  if (checkIn === null || checkOut === null) return null;
  const window = { checkIn, checkOut };
  return isProperWindow(window) ? window : null;
}

/**
 * Παράθυρο → διεύθυνση, **επί τόπου** — ο καθρέφτης του {@link readListingStayWindow}.
 * ⚠️ **Τα δύο άκρα γράφονται μαζί ή καθόλου**: άκυρο ή `null` παράθυρο σβήνει **και τα δύο**.
 */
export function writeListingStayWindow(window: ListingStayWindow | null, params: URLSearchParams): void {
  if (window !== null && isProperWindow(window)) {
    params.set(STAY_PARAM.checkIn, window.checkIn);
    params.set(STAY_PARAM.checkOut, window.checkOut);
    return;
  }
  params.delete(STAY_PARAM.checkIn);
  params.delete(STAY_PARAM.checkOut);
}

/**
 * Διεύθυνση → πλήθος ατόμων, ή `null` — {@link isWholeGuestCount}, το **ίδιο** όριο με τη δημόσια
 * ερώτηση διαθεσιμότητας και το αίτημα.
 *
 * ⚠️ Το `0` δεν είναι «χαλαρό φίλτρο» — είναι αίτημα για **κανέναν επισκέπτη**· το `2,5` δεν είναι
 * άνθρωποι· και το `51` ήταν ερώτηση που ο διακομιστής απαντούσε `400`, ρίχνοντας **κάθε** κάρτα της
 * αναζήτησης σε «αποτυχία» (ADR-777 §8.60.21.7, μετρημένο 2026-09-22).
 */
export function readListingGuests(params: URLSearchParams): number | null {
  const value = readFiniteNumber(params, STAY_PARAM.guests);
  return isWholeGuestCount(value) ? value : null;
}

/** Πλήθος ατόμων → διεύθυνση, **επί τόπου** — ο καθρέφτης του {@link readListingGuests}. */
export function writeListingGuests(guests: number | null, params: URLSearchParams): void {
  if (isWholeGuestCount(guests)) params.set(STAY_PARAM.guests, String(guests));
  else params.delete(STAY_PARAM.guests);
}

/**
 * Διεύθυνση → πλήθος κατοικιδίων, ή `null` — ακέραιος στο `[1, 5]` ({@link isWholePetCount}),
 * το **ίδιο** κατώφλι με τον κάτοχο. `0` ή `9` ⇒ αγνοείται, όπως κάθε άκυρη παράμετρος.
 */
export function readListingPets(params: URLSearchParams): number | null {
  const value = readFiniteNumber(params, STAY_PARAM.pets);
  return value !== null && isWholePetCount(value) ? value : null;
}

/**
 * Πλήθος κατοικιδίων → διεύθυνση, **επί τόπου** — ο καθρέφτης του {@link readListingPets}, με τον **ίδιο** κριτή.
 * Το `delete` είναι για τη **μερική** γραφή (ADR-777 §8.60.21.7).
 */
export function writeListingPets(pets: number | null, params: URLSearchParams): void {
  if (pets !== null && isWholePetCount(pets)) params.set(STAY_PARAM.pets, String(pets));
  else params.delete(STAY_PARAM.pets);
}
