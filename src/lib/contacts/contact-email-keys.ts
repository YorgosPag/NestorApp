/**
 * @fileoverview **ΤΑ ΚΛΕΙΔΙΑ EMAIL ΜΙΑΣ ΕΠΑΦΗΣ** — το ΕΝΑ σημείο που παράγει το `emailKeys` (ADR-944).
 * @module lib/contacts/contact-email-keys
 *
 * Το `emails` είναι πίνακας **αντικειμένων** (`{email, type, isPrimary, label}`) ⇒ το Firestore **δεν** μπορεί να ρωτήσει
 * «ποια επαφή έχει αυτό το email;» (`array-contains` θέλει ολόκληρο το αντικείμενο). Το παράγωγο `emailKeys: string[]`
 * το κάνει ερώτημα δείκτη: `where('companyId','==',c).where('emailKeys','array-contains',k)`.
 *
 * 🔑 **Κλειδί = πεζά + trim** (Salesforce/HubSpot: email ακριβές, χωρίς διάκριση πεζών/κεφαλαίων). **Όχι** αφαίρεση
 *    `+tag` ή τελειών Gmail: `x+arch1@gmail.com` και `x@gmail.com` είναι **διαφορετικά** γραμματοκιβώτια για την εφαρμογή
 *    (οι προσκλήσεις πάνε στο ακριβές) — το να τα ενώσουμε θα ήταν μαντεψιά για τον πάροχο.
 * 🔑 **Κάθε γραφέας επαφής** παίρνει το πεδίο από **εδώ** — πελάτης, διακομιστής, συμπλήρωση. Δεύτερη παραγωγή =
 *    δύο αλήθειες που αποκλίνουν σιωπηλά.
 * ⚠️ Καθαρό, χωρίς Firestore/React — το καλούν και ο πελάτης και ο διακομιστής.
 */

/** Το όνομα του παράγωγου πεδίου — ένα σημείο για γραφείς, ερωτήματα και δείκτη. */
export const CONTACT_EMAIL_KEYS_FIELD = 'emailKeys' as const;

/** Το κλειδί **ενός** email — `null` για κενό/μη-κείμενο (ποτέ κενό κλειδί που θα «ταίριαζε» με όλα). */
export function emailKeyOf(email: unknown): string | null {
  if (typeof email !== 'string') return null;
  const key = email.trim().toLowerCase();
  return key === '' ? null : key;
}

function entryEmailOf(entry: unknown): unknown {
  return typeof entry === 'object' && entry !== null && 'email' in entry ? entry.email : null;
}

/**
 * Όλα τα κλειδιά της επαφής: ο πίνακας `emails[]` **και** το επίπεδο `email` (παλαιό σχήμα, ακόμη γράφεται από
 * κάποιους γραφείς). Μοναδικά και ταξινομημένα ⇒ ίδια είσοδος = ίδια έξοδος (ιδεμπότητο, σταθερό diff).
 */
export function contactEmailKeys(emails: unknown, flatEmail?: unknown): string[] {
  const entries = Array.isArray(emails) ? emails.map(entryEmailOf) : [];
  const keys = [...entries, flatEmail].map(emailKeyOf).filter((key): key is string => key !== null);
  return [...new Set(keys)].sort();
}

/** Ίδια κλειδιά; — για τη συμπλήρωση (γράφει **μόνο** όπου διαφέρει). */
export function sameEmailKeys(current: unknown, next: readonly string[]): boolean {
  if (!Array.isArray(current) || current.length !== next.length) return false;
  return current.every((key, index) => key === next[index]);
}
