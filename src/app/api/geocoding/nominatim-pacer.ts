/**
 * **Ο ΡΥΘΜΟΣ ΤΩΝ ΚΛΗΣΕΩΝ ΠΡΟΣ ΤΟ NOMINATIM** — λωρίδα παρασκηνίου που υποχωρεί πάντα (ADR-332 §D33).
 *
 * 🔴 Ως το §D33 δεν υπήρχε **κανένας** ρυθμιστής στον διακομιστή: η σκάλα ρωτά ως 8 παραλλαγές στη σειρά,
 * χωρίς παύση. Όσο ρωτούσαν μόνο άνθρωποι, οι ριπές ήταν σπάνιες. Μια σάρωση που ολοκληρώνει θέσεις
 * όλης της βάσης είναι ακριβώς η «μαζική γεωκωδικοποίηση» που η πολιτική χρήσης του Nominatim
 * αποθαρρύνει — και η αιτία των περισσότερων αποκλεισμών IP είναι η υπέρβαση του 1 αιτήματος/δευτ.
 *
 * 🔑 **Δύο λωρίδες, μία μνήμη τελευταίας κλήσης:**
 * - **Ανθρώπινη** (προεπιλογή): **δεν καθυστερεί ποτέ** — η αποθήκευση έχει προθεσμία 9″ (Ζ5), και μια
 *   παύση εδώ θα μετέτρεπε απαντήσεις σε `budget-exhausted`. Καταγράφει όμως τη στιγμή της.
 * - **Παρασκηνίου** (`inBackgroundGeocodingLane`): περιμένει ώσπου να περάσει το ελάχιστο διάστημα από
 *   την τελευταία κλήση **οποιασδήποτε** λωρίδας. Άρα η μηχανή δεν προσθέτει ποτέ φορτίο πάνω σε ριπή
 *   ανθρώπου, και μόνη της μένει κάτω από 1 αίτημα/δευτ.
 *
 * Η λωρίδα ταξιδεύει με `AsyncLocalStorage` — όχι παράμετρος σε κάθε επίπεδο της σκάλας: ο καλών δηλώνει
 * **μία** φορά «ό,τι ρωτήσεις από εδώ και κάτω είναι παρασκήνιο».
 *
 * ⚠️ Μία διεργασία (Netcup). Με πολλές, η μνήμη τελευταίας κλήσης πρέπει να γίνει κοινή (π.χ. Redis).
 *
 * @module app/api/geocoding/nominatim-pacer
 */

import 'server-only';

import { AsyncLocalStorage } from 'node:async_hooks';

/** Ελάχιστο διάστημα ανάμεσα σε δύο κλήσεις, για τη λωρίδα παρασκηνίου — 1 αίτημα/δευτ. + περιθώριο. */
export const NOMINATIM_BACKGROUND_INTERVAL_MS = 1_100;

const lane = new AsyncLocalStorage<'background'>();
let lastRequestAt = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Τρέχει το `work` στη λωρίδα παρασκηνίου: κάθε κλήση προς το Nominatim μέσα του υποχωρεί. */
export function inBackgroundGeocodingLane<T>(work: () => Promise<T>): Promise<T> {
  return lane.run('background', work);
}

/**
 * Καλείται **ακριβώς πριν** από κάθε κλήση προς το Nominatim. Η κρυφή μνήμη δεν περνά από εδώ — μόνο
 * όσα φτάνουν πράγματι στον πάροχο.
 *
 * @param now Το ρολόι, ως όρισμα για τα tests.
 */
export async function paceNominatimRequest(now: () => number = Date.now): Promise<void> {
  if (lane.getStore() === 'background') {
    // Βρόχος, όχι μία αναμονή: μια ανθρώπινη κλήση μπορεί να πάρει τη θέση στο μεταξύ.
    for (let wait = lastRequestAt + NOMINATIM_BACKGROUND_INTERVAL_MS - now(); wait > 0;
      wait = lastRequestAt + NOMINATIM_BACKGROUND_INTERVAL_MS - now()) {
      await sleep(wait);
    }
  }
  lastRequestAt = now();
}
