/**
 * «Τι μπορεί να αλλάξει αυτό που δείχνει το υπόβαθρο;» — **ΜΙΑ** λίστα, δύο καταναλωτές.
 *
 * ## 🔴 Γιατί υπάρχει: ο ένας από τους δύο ζωγράφους δεν άκουγε ΤΙΠΟΤΑ
 * Το `basemap-paint-decision.ts` ένωσε το **κατηγόρημα** («ζωγραφίζουμε;») αφού είχε ήδη γραφτεί
 * δύο φορές. Οι **είσοδοί** του όμως έμειναν χωριστά — και εκεί η απόκλιση δεν ήταν υποθετική:
 *
 * | | ακούει |
 * |---|---|
 * | 2Δ (`useBasemapPainter`) | κατάσταση · διαθεσιμότητα · επιφάνεια απόδοσης · **άφιξη πλακιδίου** |
 * | 3Δ (`BasemapGroundLayer`) | **τίποτα** |
 *
 * Η τρισδιάστατη σκηνή είναι **on-demand** (`scene-dirty-state.ts`: «single master rAF +
 * per-subsystem dirty check»), και ο `getTileImage` **ξεκινά** τη φόρτωση επιστρέφοντας `null`.
 * Άρα το πρώτο καρέ έβρισκε μηδέν πλακίδια, τα πλακίδια έφταναν ~200 ms μετά — και **κανείς δεν
 * σήκωνε σημαία redraw**, οπότε δεύτερο καρέ δεν υπήρχε. Ο χάρτης δεν εμφανιζόταν **ποτέ**, μέχρι
 * ο χρήστης να κουνήσει την κάμερα για άλλο λόγο. Το ίδιο ίσχυε για το άναμμα του διακόπτη, την
 * αδιαφάνεια και τον πάροχο: **ό,τι άλλαζε στο 2Δ, στο 3Δ δεν άλλαζε τίποτα.**
 *
 * ⚠️ Η ίδια κλάση είναι **γραμμένη ονομαστικά** στο `scene-dirty-state.ts` (ADR-693 Φ2: «χωρίς
 * αυτή την είσοδο το fade θα πάγωνε στο πρώτο καρέ»). Δεν ήταν άγνωστο σχήμα — ήταν άγνωστο
 * **ότι το υπόβαθρο ανήκει σε αυτό**.
 *
 * ## Γιατί ΕΔΩ και όχι μέσα στην απόφαση
 * Η απόφαση είναι **καθαρή** και τη διαβάζει και η πλακέτα απόδοσης. Οι εγγραφές σύρουν μαζί τους
 * τον cache πλακιδίων (δίκτυο). Ένα ξεχωριστό αρχείο κρατά την απόφαση χωρίς αυτή την εξάρτηση,
 * και ταυτόχρονα κάνει τη λίστα εισόδων **μία**: όποιος προσθέσει πέμπτη είσοδο στην απόφαση θα
 * τη βρει εδώ ως τη μοναδική θέση όπου δηλώνεται ότι «κάτι άλλαξε».
 *
 * ## Αριθμός έκδοσης, όχι στιγμιότυπο — και ο λόγος είναι το React
 * Το `resolveBasemapPaint()` φτιάχνει **νέο αντικείμενο** σε κάθε κλήση, άρα δεν μπορεί να είναι
 * `getSnapshot` του `useSyncExternalStore` (ατέρμων βρόχος). Ο μετρητής είναι σταθερή τιμή που
 * αλλάζει **ακριβώς** όταν αλλάζει κάποια είσοδος — δηλαδή λέει «ξαναρώτησε», που είναι το μόνο
 * που χρειάζονται και οι δύο καταναλωτές.
 *
 * 🔶 **Δηλωμένη συνέπεια της τεμπέλικης προσάρτησης**: όσο κανείς δεν είναι εγγεγραμμένος, ο
 * μετρητής **δεν** προχωρά. Αυτό είναι ακίνδυνο επειδή κάθε καταναλωτής ξαναδιαβάζει την απόφαση
 * με σκέτο `resolveBasemapPaint()` τη στιγμή που ξεκινά — ο μετρητής απαντά «άλλαξε **από τότε**
 * που κοιτάς», όχι «ποια είναι η κατάσταση».
 */

import { createExternalStore } from '@/lib/state/createExternalStore';

import { subscribeBasemap } from './basemap-store';
import { subscribeBasemapAvailability } from './basemap-availability';
import { subscribeBasemapAttributionSurface } from './basemap-attribution-surface';
import { subscribeTileReady } from './basemap-tile-cache';

/**
 * Οι εγγραφές στις πηγές, με τη σειρά των όρων της {@link resolveBasemapPaint}, συν την άφιξη
 * πλακιδίου — που δεν αλλάζει την **απόφαση** αλλά αλλάζει το **αποτέλεσμα** της ζωγραφικής.
 */
const SOURCES: readonly ((listener: () => void) => () => void)[] = [
  subscribeBasemap,
  subscribeBasemapAvailability,
  subscribeBasemapAttributionSurface,
  subscribeTileReady,
];

/**
 * Ο μετρητής ζει στο SSoT `createExternalStore` (ADR-294, module `create-external-store`): το
 * κελί «τιμή + ακροατές + ειδοποίηση» γράφτηκε με το χέρι ~100 φορές πριν ενοποιηθεί, και ένα
 * σήμα έκδοσης — μονή αριθμητική τιμή — είναι **ακριβώς** η περίπτωση που περιγράφει το μητρώο.
 */
const versionSignal = createExternalStore<number>(0);

/**
 * Πλήθος εγγεγραμμένων, **όχι** `listeners.size`: το SSoT δεν εκθέτει πλήθος ακροατών, και δεν
 * πρέπει — η τεμπέλικη προσάρτηση είναι ευθύνη **αυτού** του module, όχι του κελιού pub/sub.
 */
let subscriberCount = 0;
let detachSources: (() => void) | null = null;

function bump(): void {
  versionSignal.set(versionSignal.get() + 1);
}

/**
 * Εγγραφή σε **κάθε** σήμα που μπορεί να αλλάξει το τι δείχνει το υπόβαθρο.
 *
 * Καταναλωτές: ο ζωγράφος του 2Δ και το `BasemapGroundLayer` του 3Δ. Επιστρέφει την απεγγραφή.
 */
export function subscribeBasemapPaint(listener: () => void): () => void {
  const unsubscribe = versionSignal.subscribe(listener);
  subscriberCount += 1;
  if (detachSources === null) {
    const unsubs = SOURCES.map((subscribe) => subscribe(bump));
    detachSources = () => { for (const unsub of unsubs) unsub(); };
  }

  // Φρουρός διπλής απεγγραφής: το `Set.delete` που υπήρχε πριν ήταν idempotent, ο μετρητής δεν
  // είναι — καταναλωτής που καλεί δύο φορές την απεγγραφή δεν επιτρέπεται να αποσυνδέσει τις
  // πηγές κάτω από τα πόδια του άλλου.
  let released = false;
  return () => {
    if (released) return;
    released = true;
    unsubscribe();
    subscriberCount -= 1;
    if (subscriberCount === 0) {
      detachSources?.();
      detachSources = null;
    }
  };
}

/** Ο μετρητής αλλαγών — σταθερή τιμή, κατάλληλη ως `getSnapshot`. Δες την επικεφαλίδα. */
export function getBasemapPaintVersion(): number {
  return versionSignal.get();
}
