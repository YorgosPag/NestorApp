/**
 * Φόρτωση και συγκράτηση πλακιδίων — το **μόνο** σημείο που αγγίζει δίκτυο.
 *
 * ## Γιατί `Image` και όχι `fetch`
 * Ο κώδικας **δεν** διαχειρίζεται δικό του HTTP cache, και αυτό είναι απόφαση, όχι παράλειψη. Η
 * πολιτική του OSMF απαιτεί σεβασμό στις κεφαλίδες cache του παρόχου και **απαγορεύει** τις
 * κεφαλίδες παράκαμψης. Ο cache του browser κάνει ακριβώς αυτό, σωστά, και επιβιώνει ανάμεσα σε
 * φορτώσεις σελίδας — ενώ ένας δικός μας cache θα ήταν μια δεύτερη πολιτική που θα απέκλινε από
 * την πρώτη. Ένα `<img>` κληρονομεί την υποδομή δωρεάν· ένα `fetch` θα μας έβαζε στη θέση να την
 * ξαναγράψουμε και να τη διατηρήσουμε σύμφωνη.
 *
 * Ο cache **εδώ** είναι άλλο πράγμα: κρατά τις ήδη αποκωδικοποιημένες εικόνες στη μνήμη ώστε το
 * καρέ να μην πληρώνει αποκωδικοποίηση PNG σε κάθε μετακίνηση. Είναι cache **αποκωδικοποίησης**,
 * όχι δικτύου.
 *
 * ## ⚠️ Καμία προληπτική φόρτωση
 * Δεν υπάρχει συνάρτηση prefetch, και δεν πρόκειται να προστεθεί χωρίς να αλλάξει το
 * `maxPrefetchRing` του παρόχου: η πολιτική απαγορεύει *«any pre-emptive fetching of tiles other
 * than those a user is actively viewing»*. Ζητείται **μόνο** ό,τι ζωγραφίζεται τώρα.
 *
 * `crossOrigin='anonymous'` — απαραίτητο ώστε η ίδια εικόνα να μπορεί να γίνει υφή WebGL στην
 * τρισδιάστατη προβολή· χωρίς αυτό ο καμβάς «μολύνεται» και το 3Δ θα αποτύγχανε αργότερα, σε
 * σημείο μακριά από την αιτία.
 */

import { createExternalStore } from '../../stores/createExternalStore';
import { tileUrl, type BasemapSource } from './basemap-source';
import type { TileId } from './web-mercator';

/**
 * Πόσες αποκωδικοποιημένες εικόνες κρατιούνται. Με 256 px πλακίδιο, **384** εικόνες είναι
 * ~100 MB στη χειρότερη — αρκετά ώστε ένα πλήρες καρέ (έως {@link MAX_TILES_PER_FRAME}) να
 * επιβιώνει μαζί με το προηγούμενο, δηλαδή το pan να μην ξαναζητά ό,τι μόλις εγκατέλειψε.
 */
const MAX_CACHED_TILES = 384;

/** Το κλειδί ταυτότητας ενός πλακιδίου μέσα στον cache — πάροχος **και** θέση. */
function cacheKey(sourceId: string, tile: TileId): string {
  return `${sourceId}/${tile.z}/${tile.x}/${tile.y}`;
}

interface CacheEntry {
  readonly image: HTMLImageElement;
  /** `true` μόλις η εικόνα είναι σχεδιάσιμη. */
  ready: boolean;
  /** `true` όταν η φόρτωση απέτυχε — δεν ξαναζητείται μέσα στην ίδια συνεδρία. */
  failed: boolean;
}

/** Map με σειρά εισαγωγής ⇒ ο πρώτος κόμβος είναι ο παλαιότερος (LRU χωρίς δεύτερη δομή). */
const cache = new Map<string, CacheEntry>();

/**
 * **Σήμα έκδοσης** (SSoT `createExternalStore`) — ο `cache` από πάνω μένει η αλήθεια· αυτό εδώ
 * μετρά μόνο «κάτι άλλαξε». Ο cache είναι `Map` επιτάχυνσης, άρα δεν χωράει σε μονοτιμή
 * κατάσταση: το πρότυπο version-signal είναι ακριβώς η περίπτωσή του.
 */
const readySignal = createExternalStore<number>(0);

/**
 * Ειδοποίηση ότι **κάποιο** πλακίδιο έγινε σχεδιάσιμο.
 *
 * Σκόπιμα χωρίς όρισμα: ο ζωγράφος δεν χρειάζεται να ξέρει ποιο ήρθε — ζωγραφίζει ούτως ή άλλως
 * ολόκληρο το ορατό. Ένα συμβάν ανά πλακίδιο με ταυτότητα θα καλούσε τον καταναλωτή να χτίσει
 * λογιστική «ποια έχω ήδη», δηλαδή δεύτερη καταγραφή δίπλα σε αυτόν εδώ τον cache.
 */
export function subscribeTileReady(listener: () => void): () => void {
  return readySignal.subscribe(listener);
}

function notifyReady(): void {
  readySignal.set(readySignal.get() + 1);
}

/** Πέταγμα των παλαιότερων εγγραφών μέχρι να χωρέσει το ταβάνι. */
function evictOverflow(): void {
  while (cache.size > MAX_CACHED_TILES) {
    const oldest = cache.keys().next();
    if (oldest.done) return;
    cache.delete(oldest.value);
  }
}

/** Σήμανση πρόσφατης χρήσης: επανεισαγωγή στο τέλος της σειράς. */
function touch(key: string, entry: CacheEntry): void {
  cache.delete(key);
  cache.set(key, entry);
}

/**
 * Η σχεδιάσιμη εικόνα του πλακιδίου, ή `null` όσο δεν είναι έτοιμη.
 *
 * **Παρενέργεια εκ σχεδιασμού**: η πρώτη κλήση για άγνωστο πλακίδιο ξεκινά τη φόρτωσή του. Αυτό
 * κρατά τη σύμβαση «ζητάμε μόνο ό,τι ζωγραφίζεται» **δομική** αντί για συμφωνία κυρίων: το
 * αίτημα γεννιέται από την πράξη της ζωγραφικής και από πουθενά αλλού.
 */
export function getTileImage(source: BasemapSource, tile: TileId): HTMLImageElement | null {
  const key = cacheKey(source.id, tile);
  const existing = cache.get(key);
  if (existing) {
    touch(key, existing);
    return existing.ready ? existing.image : null;
  }

  const image = new Image();
  const entry: CacheEntry = { image, ready: false, failed: false };
  cache.set(key, entry);
  evictOverflow();

  image.crossOrigin = 'anonymous';
  image.decoding = 'async';
  image.addEventListener('load', () => {
    entry.ready = true;
    notifyReady();
  });
  image.addEventListener('error', () => {
    entry.failed = true;
  });
  image.src = tileUrl(source, tile.z, tile.x, tile.y);
  return null;
}

// ADR-700 §4 (2026-08-24): clearTileCache() ΔΙΑΓΡΑΦΗΚΕ — test helper ΧΩΡΙΣ ΚΑΝΕΝΑ test.
