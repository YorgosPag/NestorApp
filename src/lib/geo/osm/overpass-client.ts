/**
 * @fileoverview SSoT — **πώς μιλάμε στο Overpass**. Ένας μεταφορέας, πολλές ερωτήσεις.
 * @related ADR-277 · ADR-777 · SPEC-777A §13.4 (ODbL) · §13.5 (κατ' απαίτηση)
 * @module lib/geo/osm/overpass-client
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΕΞΑΓΩΓΗ, ΟΧΙ ΔΕΥΤΕΡΟΣ ΠΕΛΑΤΗΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο κώδικας αυτός **ζούσε ήδη** μέσα στο `lib/geocoding/overpass-housenumber.ts`, ως
 * ιδιωτικός. Όταν το ADR-777 χρειάστηκε **δεύτερη** ερώτηση προς το Overpass («ποιο
 * κτίριο είναι εδώ;»), οι δύο δρόμοι ήταν: δεύτερος `fetch` με δικό του endpoint,
 * timeout και χειρισμό σφάλματος — ή **γενίκευση**. Το δεύτερο, γιατί το πρώτο θα
 * σήμαινε ότι μια αλλαγή endpoint φτάνει **στο ένα** από τα δύο.
 *
 * 🔑 **Ό,τι είναι ΜΕΤΑΦΟΡΑ ζει εδώ· ό,τι είναι ΕΡΩΤΗΣΗ ζει στον καλούντα.** Οι ακτίνες
 * της τριπλής στρατηγικής του `overpass-housenumber` **δεν** μετακόμισαν: είναι η
 * στρατηγική **εκείνης** της ερώτησης, όχι ιδιότητα του Overpass.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⚠️ ΤΟ ΝΟΜΙΚΟ ΟΡΙΟ ΠΕΡΝΑ ΑΠΟ ΕΔΩ (§13.4 — ODbL)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Αυτό το module είναι **η μόνη πόρτα** προς τα δεδομένα OSM. Ό,τι το περνά είναι
 * ερώτημα **κατ' απαίτηση**, επειδή το ζήτησε **άνθρωπος** — ποτέ σάρωση.
 *
 * ⛔ **ΜΗΝ γράψεις εδώ βρόχο πάνω σε πλέγμα, ουρά μαζικής άντλησης ή προθέρμανση
 * μνήμης.** Δεν είναι σύσταση απόδοσης: το §13.4 δείχνει ότι *«systematically reverse
 * engineering the whole or a substantial part of the OSM database … **would trigger
 * share-alike**»*, και η άμυνά μας είναι ακριβώς ότι κάθε κλήση αντιστοιχεί σε **μία
 * ανθρώπινη χειρονομία**.
 *
 * **Layering**: leaf — μόνο `fetch` + καταγραφή. Καμία εξάρτηση από Firestore/React.
 */

import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('overpass-client');

const OVERPASS_BASE_URL =
  process.env.OVERPASS_BASE_URL || 'https://overpass-api.de/api/interpreter';
const OVERPASS_TIMEOUT_MS = parseInt(process.env.OVERPASS_TIMEOUT_MS || '6000', 10);
const USER_AGENT = process.env.GEOCODING_USER_AGENT || 'NestorPagonisApp/1.0 (geocoding)';

/**
 * Το `timeout:` **μέσα** στο ερώτημα, σε δευτερόλεπτα.
 *
 * ⚠️ Δύο διαφορετικά χρονόμετρα, και **πρέπει** να είναι δύο: αυτό λέει στον
 * **διακομιστή του Overpass** πότε να παρατήσει τη δουλειά, το `AbortSignal` λέει σε
 * **εμάς** πότε να πάψουμε να περιμένουμε. Αν έλειπε το πρώτο, ένα βαρύ ερώτημα θα
 * συνέχιζε να καίει πόρους **του κοινού διακομιστή** αφού εμείς έχουμε φύγει.
 */
export const overpassQuerySeconds = (): number => Math.floor(OVERPASS_TIMEOUT_MS / 1000);

/**
 * Ένα στοιχείο OSM όπως το επιστρέφει το Overpass.
 *
 * ⚠️ **Όλα τα πεδία πλην των δύο πρώτων είναι προαιρετικά, και αυτό είναι ειλικρίνεια
 * για το πρωτόκολλο**: τι επιστρέφεται εξαρτάται από τη **φράση εξόδου** (`out center`
 * / `out geom` / `out ids`). Ένας τύπος που τα δήλωνε υποχρεωτικά θα έλεγε ψέματα σε
 * τρεις από τους τέσσερις καλούντες.
 */
export interface OverpassElement {
  readonly type: string;
  readonly id: number;
  /** Μόνο για κόμβους. */
  readonly lat?: number;
  readonly lon?: number;
  /** `out center` — το κέντρο περιβλήματος για ways/relations. */
  readonly center?: { readonly lat: number; readonly lon: number };
  /** `out geom` — οι κορυφές, σε σειρά. */
  readonly geometry?: readonly { readonly lat: number; readonly lon: number }[];
  readonly tags?: Readonly<Record<string, string>>;
}

interface OverpassResponse {
  readonly elements?: readonly OverpassElement[];
}

/**
 * Τρέχει ένα ερώτημα Overpass.
 *
 * 🔑 **Επιστρέφει κενό πίνακα σε ΚΑΘΕ αποτυχία — και ο καλών ΔΕΝ μπορεί να ξεχωρίσει
 * «δεν υπάρχει» από «δεν απάντησε».** Αυτό είναι δηλωμένο όριο και όχι παράβλεψη: για
 * τον `overpass-housenumber` η διάκριση δεν αλλάζει τίποτα (και στις δύο περιπτώσεις ο
 * άνθρωπος πληκτρολογεί τον αριθμό). Όπου **αλλάζει** — στην επαλήθευση πηγής του
 * §14.4, όπου «δεν απάντησε» δεν επιτρέπεται να διαβαστεί ως «δεν υπάρχει το κτίριο» —
 * ο καλών χρησιμοποιεί το {@link runOverpassQueryStrict}.
 */
export async function runOverpassQuery(query: string): Promise<readonly OverpassElement[]> {
  const outcome = await runOverpassQueryStrict(query);
  return outcome.ok ? outcome.elements : [];
}

/**
 * Ό,τι και το {@link runOverpassQuery}, αλλά **η αποτυχία είναι λέξιμη**.
 *
 * 🔴 **Υπάρχει επειδή το §14.4 δεν ανέχεται τη σύγχυση.** Ο γραφέας του επιπέδου Α
 * ρωτά *«υπάρχει αυτό το κτίριο;»* πριν γράψει κάτι που θα δουν **όλοι**. Ένα
 * σιωπηλό `[]` από πεσμένο δίκτυο θα απαντούσε *«όχι»* — και η σωστή απάντηση σε
 * *«δεν ξέρω»* δεν είναι ποτέ *«όχι»*, είναι **«ξαναδοκίμασε»**. Ίδια διάκριση με το
 * `not-found` ⇄ `error` του `usePlaceResolver`.
 */
export async function runOverpassQueryStrict(
  query: string,
): Promise<
  | { readonly ok: true; readonly elements: readonly OverpassElement[] }
  | { readonly ok: false; readonly reason: 'unavailable' }
> {
  try {
    const response = await fetch(OVERPASS_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': USER_AGENT,
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(OVERPASS_TIMEOUT_MS),
    });

    if (!response.ok) {
      logger.warn('Overpass non-OK response', { data: { status: response.status } });
      return { ok: false, reason: 'unavailable' };
    }

    const data = (await response.json()) as OverpassResponse;
    return { ok: true, elements: data.elements ?? [] };
  } catch (error) {
    logger.warn('Overpass fetch error', { error: getErrorMessage(error) });
    return { ok: false, reason: 'unavailable' };
  }
}
