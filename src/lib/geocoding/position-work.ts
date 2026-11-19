/**
 * **ΠΟΙΑ ΔΙΕΥΘΥΝΣΗ ΠΕΡΙΜΕΝΕΙ ΘΕΣΗ, ΚΑΙ ΠΟΤΕ ΞΑΝΑΡΩΤΙΕΤΑΙ** — ADR-332 §D33.
 *
 * Καθαρή λογική, χωρίς βάση και χωρίς ρολόι: τη μοιράζονται ο γραφέας ολοκλήρωσης, το μητρώο
 * εργασίας και η σάρωση, ώστε «εκκρεμεί» να σημαίνει **ένα** πράγμα σε όλο το σύστημα.
 *
 * 🔑 **Καμία νέα κρίση**: «εκκρεμεί» = υπάρχει κείμενο που μπορεί να ρωτηθεί **και** η θέση δεν
 * έχει κριθεί γι' αυτό (`positionSettled`, §D32). Διεύθυνση χωρίς οδό και πόλη δεν εκκρεμεί ποτέ —
 * ο γραφέας δεν θα τη ρωτούσε (`insufficient-address`), άρα θα έμενε στην ουρά για πάντα.
 *
 * 🏆 Πρακτική: GitLab Geo registry (`retry_at` με εκθετική αναμονή, κατάσταση **έξω** από το μοντέλο) ·
 * Salesforce Geocode Data Integration Rules (θέση σε αλλαγή + πέρασμα στις υπάρχουσες εγγραφές).
 *
 * @module lib/geocoding/position-work
 */

import { positionSettled, toQuery } from './address-position-rules';
import type { AddressLike } from './address-position-types';

/** Διεύθυνση με ταυτότητα — μόνο αυτές μπορεί να ολοκληρώσει ο γραφέας (ταιριάζει **μόνο** με `id`). */
type IdentifiedAddress = AddressLike & { readonly id?: string };

const HOUR_MS = 60 * 60 * 1000;

/**
 * Η αναμονή μετά από κάθε **αναπάντητη** δοκιμή (πάροχος μη διαθέσιμος · εξαντλημένη προθεσμία).
 *
 * 🔑 Η τελευταία βαθμίδα **επαναλαμβάνεται** — ποτέ εγκατάλειψη: η άγνοια δεν είναι απάντηση, και μια
 * διεύθυνση που ο πάροχος δεν προλάβαινε σήμερα θα την προλάβει αύριο. Το «δεν βρέθηκε» **δεν**
 * περνά από εδώ· είναι απάντηση (`geocodeAttempt`) και ξαναρωτιέται μόνο με νέα έκδοση πολιτικής.
 */
export const POSITION_WORK_BACKOFF_MS: readonly number[] = [HOUR_MS, 6 * HOUR_MS, 24 * HOUR_MS, 7 * 24 * HOUR_MS];

/** Μπορεί αυτή η διεύθυνση να ρωτηθεί, και δεν έχει ακόμη απάντηση για το κείμενό της; */
export function addressNeedsPosition(address: AddressLike): boolean {
  const query = toQuery(address);
  if (!query.street && !query.city) return false;
  return !positionSettled(address);
}

/** Οι ταυτότητες των διευθύνσεων που περιμένουν θέση — η είσοδος του γραφέα ολοκλήρωσης. */
export function unsettledAddressIds(addresses: readonly IdentifiedAddress[]): string[] {
  return addresses.flatMap((address) => (address.id && addressNeedsPosition(address) ? [address.id] : []));
}

/** Πόση αναμονή μετά την `attempts`-οστή αναπάντητη δοκιμή (`attempts ≥ 1`). */
export function positionRetryDelayMs(attempts: number): number {
  const step = Math.min(Math.max(attempts, 1), POSITION_WORK_BACKOFF_MS.length) - 1;
  return POSITION_WORK_BACKOFF_MS[step];
}
