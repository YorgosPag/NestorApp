/**
 * @fileoverview **ΕΙΝΑΙ ΑΝΘΡΩΠΟΣ ΑΥΤΟΣ ΠΟΥ ΡΩΤΑ;** — η φθηνή, πρώτη κρίση (ADR-777 §8.72).
 * @module lib/http/automated-request
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΡΙΑ ΦΙΛΤΡΑ, ΚΑΙ ΤΟ ΠΙΟ ΙΣΧΥΡΟ ΔΕΝ ΕΙΝΑΙ ΕΔΩ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * 1. **Ο μετρητής ζει σε JavaScript που τρέχει ΜΕΤΑ την απόδοση.** Οι ανιχνευτές ευρετηρίασης
 *    που δεν εκτελούν JS (η πλειονότητα) **δεν φτάνουν ποτέ** στη διαδρομή. Αυτό είναι το κύριο
 *    φίλτρο — και ζει στον πελάτη (`useListingViewBeacon`), όχι εδώ.
 * 2. **Προ-φόρτωση** (`Sec-Purpose: prefetch` / `Purpose: prefetch`): ο φυλλομετρητής ζήτησε κάτι
 *    που ο άνθρωπος **ίσως** δει. Δεν είναι προβολή.
 * 3. **User-Agent που δηλώνει αυτοματισμό** — εδώ. Όσοι εκτελούν JS (Googlebot, headless Chrome)
 *    τον δηλώνουν σχεδόν πάντα.
 *
 * ⛔ **ΓΙΑΤΙ ΟΧΙ το πακέτο `isbot`**: είναι **Unlicense**, εκτός της λίστας MIT/Apache/BSD του N.5.
 * Η λίστα εδώ είναι μικρή επίτηδες — κάθε λέξη είναι **αυτοδήλωση**, όχι εικασία.
 *
 * ⚠️ **Δεν είναι ασφάλεια.** Όποιος θέλει να φουσκώσει προβολές αλλάζει το UA — τον σταματά το
 * σημάδι «ένας επισκέπτης / ημέρα» και το όριο ρυθμού, όχι αυτό το αρχείο.
 */

/** Λέξεις που **αυτοδηλώνουν** αυτοματισμό. Πεζά — η σύγκριση γίνεται σε πεζά. */
const AUTOMATION_TOKENS = [
  'bot', 'crawl', 'spider', 'slurp', 'headless', 'lighthouse', 'pagespeed', 'preview',
  'facebookexternalhit', 'embedly', 'python-requests', 'curl/', 'wget/', 'httpclient',
  'go-http-client', 'node-fetch', 'axios/', 'okhttp', 'java/', 'phantomjs', 'puppeteer', 'playwright',
] as const;

/** Ο UA δηλώνει αυτοματισμό — ή λείπει εντελώς (κανένας φυλλομετρητής δεν στέλνει κενό). */
export function isAutomatedUserAgent(userAgent: string | null): boolean {
  if (userAgent === null || userAgent.trim() === '') return true;
  const ua = userAgent.toLowerCase();
  return AUTOMATION_TOKENS.some((token) => ua.includes(token));
}

/** Ο φυλλομετρητής **προ-φορτώνει** — ο άνθρωπος δεν έχει δει ακόμη τίποτα. */
export function isPrefetchRequest(headers: Headers): boolean {
  const purpose = `${headers.get('sec-purpose') ?? ''} ${headers.get('purpose') ?? ''}`.toLowerCase();
  return purpose.includes('prefetch') || purpose.includes('prerender');
}
