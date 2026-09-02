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
import { sleep } from '@/lib/async-utils';
import { calculateBackoffDelay } from '@/services/entity-linking/utils/retry';

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

// =============================================================================
// ΕΠΑΝΑΛΗΨΗ — γιατί «άλλοτε το εντοπίζει και άλλοτε όχι»
// =============================================================================

/**
 * 🔴 **Η ΑΝΑΦΟΡΑ ΠΟΥ ΤΟ ΓΕΝΝΗΣΕ (Giorgio, 2026-09-02)**: *«όταν κάνω κλικ στο ίδιο
 * σημείο, άλλοτε το εντοπίζει και άλλοτε όχι»*.
 *
 * Δεν ήταν σφάλμα του ερωτήματος — το ερώτημα είναι **μικρό και σταθερό**
 * (`way["building"](around:50,…)`). Είναι ο **κοινός** διακομιστής:
 *
 * | Τι συμβαίνει | Απάντηση | Πόσο συχνά |
 * |---|---|---|
 * | Ξεπεράστηκαν τα **slots** της IP μας | **429** | σε γρήγορα διαδοχικά κλικ |
 * | Ο διακομιστής είναι φορτωμένος | **504** / αργή απάντηση | απρόβλεπτα |
 * | Η απάντηση αργεί πάνω από το δικό μας χρονόμετρο | `AbortError` | στα 6 s |
 *
 * 🔑 **Και οι τρεις σημαίνουν «ΞΑΝΑΡΩΤΑ», όχι «δεν υπάρχει κτίριο»** — διάκριση που ο
 * {@link runOverpassQueryStrict} ήδη έκανε σωστά, αλλά **την πλήρωνε ο άνθρωπος**: του
 * ζητούσαμε να ξαναπατήσει κάτι που θα μπορούσαμε να ξαναρωτήσουμε μόνοι μας.
 *
 * ⚠️ **Η ΕΠΑΝΑΛΗΨΗ ΔΕΝ ΠΑΡΑΒΙΑΖΕΙ ΤΟ §13.4 (ODbL)**, και ο λόγος είναι ακριβής: η
 * άμυνά μας είναι *«κάθε κλήση αντιστοιχεί σε **μία ανθρώπινη χειρονομία**»*. Μια
 * επανάληψη είναι **η ίδια** χειρονομία που δεν απαντήθηκε — όχι δεύτερη. Το
 * απαγορευμένο (σάρωση πλέγματος, μαζική άντληση) παραμένει απαγορευμένο: το όριο
 * είναι **σταθερό και μικρό**, και δεν υπάρχει διαδρομή που το πολλαπλασιάζει.
 *
 * 🔑 **Το πρότυπο δεν το επινοήσαμε**: *«read the `Retry-After` header in 429 responses
 * … exponential backoff with jitter distributes retry attempts across time, preventing
 * synchronized retry storms»*. Το jitter είναι το κρίσιμο — χωρίς αυτό, δύο πελάτες που
 * κόπηκαν μαζί ξαναρωτούν **μαζί**.
 */
const RETRY_ATTEMPTS = 3;

/** Οι κωδικοί που σημαίνουν «ξαναρώτα». Ό,τι άλλο είναι **απάντηση**, όχι εμπόδιο. */
const RETRYABLE_STATUS = new Set([429, 502, 503, 504]);

/**
 * ⚠️ **Ταβάνι στην αναμονή που ζητά ο διακομιστής.** Το `Retry-After` είναι υπόδειξη
 * **του Overpass** και τη σεβόμαστε — αλλά ένας φορτωμένος διακομιστής μπορεί να πει
 * «σε 60 δευτερόλεπτα», και **κανείς άνθρωπος δεν περιμένει ένα λεπτό με έναν
 * δείκτη φόρτωσης**. Πάνω από αυτό το όριο η ειλικρινής απάντηση είναι «δεν
 * απάντησε, ξαναδοκίμασε» — που η οθόνη **ήδη** ξέρει να πει.
 */
const MAX_HONOURED_RETRY_AFTER_MS = 3_000;

const BACKOFF = {
  maxAttempts: RETRY_ATTEMPTS,
  baseDelayMs: 400,
  maxDelayMs: 2_000,
  backoffMultiplier: 2,
  useJitter: true,
} as const;

/**
 * Πόσο περιμένουμε πριν την επόμενη προσπάθεια.
 *
 * 🔑 **Ο διακομιστής προηγείται του υπολογισμού μας**: αν είπε `Retry-After`, ξέρει
 * καλύτερα από κάθε εκθετική φόρμουλα πότε θα έχει θέση. Ο υπολογισμός είναι η
 * απάντηση στο *«δεν μου είπε»*, και έρχεται από τον **SSoT** του έργου
 * ({@link calculateBackoffDelay}) — καμία δεύτερη φόρμουλα εκθετικής υποχώρησης.
 */
function retryDelayMs(response: Response | null, attempt: number): number {
  const header = response?.headers.get('retry-after');
  if (header !== null && header !== undefined) {
    const seconds = Number.parseFloat(header);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(seconds * 1000, MAX_HONOURED_RETRY_AFTER_MS);
    }
  }
  return calculateBackoffDelay(attempt, BACKOFF);
}

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
  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt += 1) {
    const outcome = await attemptOverpass(query);

    if (outcome.kind === 'ok') return { ok: true, elements: outcome.elements };

    // ⚠️ **Μη επαναλήψιμο ⇒ σταματάμε αμέσως.** Ένα 400 (κακό ερώτημα) δεν γίνεται
    //    καλό επειδή περιμέναμε — και η επανάληψή του είναι σπατάλη πόρων του κοινού
    //    διακομιστή για βεβαιότητα που ήδη έχουμε.
    if (!outcome.retryable || attempt === RETRY_ATTEMPTS) break;

    const delay = retryDelayMs(outcome.response, attempt);
    logger.warn('Overpass — ξαναρωτάμε', {
      data: { attempt, of: RETRY_ATTEMPTS, delayMs: delay, status: outcome.status },
    });
    await sleep(delay);
  }

  return { ok: false, reason: 'unavailable' };
}

/**
 * Μία προσπάθεια — **και η ετυμηγορία της είναι λέξιμη**.
 *
 * 🔑 Εξήχθη ώστε ο βρόχος του {@link runOverpassQueryStrict} να μένει *«πόσες φορές και
 * πότε»* και αυτό *«τι απάντησε»*. Ενωμένα, η συνθήκη επαναληψιμότητας θα ζούσε μέσα σε
 * `catch` — δηλαδή θα κρινόταν από **κείμενο σφάλματος** αντί από κωδικό κατάστασης.
 */
async function attemptOverpass(
  query: string,
): Promise<
  | { readonly kind: 'ok'; readonly elements: readonly OverpassElement[] }
  | {
      readonly kind: 'failed';
      readonly retryable: boolean;
      readonly status: number | null;
      readonly response: Response | null;
    }
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
      return {
        kind: 'failed',
        retryable: RETRYABLE_STATUS.has(response.status),
        status: response.status,
        response,
      };
    }

    const data = (await response.json()) as OverpassResponse;
    return { kind: 'ok', elements: data.elements ?? [] };
  } catch (error) {
    // 🔑 **Δίκτυο και λήξη χρόνου ΕΙΝΑΙ επαναλήψιμα** — είναι ακριβώς η περίπτωση
    //    «ο διακομιστής άργησε», που ήταν και η συχνότερη στην αναφορά της 02/09.
    logger.warn('Overpass fetch error', { error: getErrorMessage(error) });
    return { kind: 'failed', retryable: true, status: null, response: null };
  }
}
