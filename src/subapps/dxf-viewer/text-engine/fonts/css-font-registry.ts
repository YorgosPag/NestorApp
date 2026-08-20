/**
 * 🔴 ADR-786 §4 — **ΜΙΑ εγγραφή γραμματοσειράς, ΔΥΟ καταναλωτές**: ό,τι μπορεί να ζωγραφίσει
 * ο καμβάς ως περιγράμματα glyph, μπορεί να ζωγραφίσει και το DOM ως CSS γραμματοσειρά —
 * **από τα ίδια bytes**.
 *
 * ## Το ελάττωμα που το γέννησε
 *
 * Ο καμβάς λύνει «arial» μέσα από το `FONT_SUBSTITUTION_TABLE` (catch-all `'*'`) στο λογικό
 * **`Liberation Sans`**, το οποίο το `CAD_SUBSTITUTE_FONTS` υλοποιεί σήμερα με το φυσικό
 * `/fonts/Roboto-Regular.ttf`. Ο in-cell επεξεργαστής όμως είναι **DOM**: το `buildUIFont`
 * του έδινε τη σκέτη αιτούμενη οικογένεια (`arial`), δηλαδή ο browser ζωγράφιζε **Arial**
 * ενώ ο καμβάς από κάτω ζωγράφιζε **Roboto**. Δύο διαφορετικά περιγράμματα για το ίδιο
 * γράμμα, στην ίδια θέση, εναλλάξ στο διπλό κλικ (ADR-786 §4, αναλλοίωτη Α2).
 *
 * ## 🔑 Γιατί η λύση είναι ΕΔΩ και όχι στο CSS
 *
 * Η προφανής λύση είναι ένας κανόνας `@font-face` σε stylesheet. Θα ήταν **δεύτερος
 * κατάλογος**: το ζεύγος «λογικό όνομα → φυσικό αρχείο» ζει ήδη στο {@link
 * CAD_SUBSTITUTE_FONTS} και θα το ξανάγραφε ένα `.css` που **κανένας μεταγλωττιστής δεν
 * συγκρίνει** με εκείνο. Είναι ακριβώς το σχήμα των δύο χειρόγραφων λιστών namespace του
 * CHECK 3.34, που είχαν αποκλίνει κατά **63** χωρίς καμία πύλη να τις ρωτήσει.
 *
 * Εδώ δεν υπάρχει δεύτερος κατάλογος **επειδή δεν υπάρχει κατάλογος**: η εγγραφή γίνεται
 * μέσα στο {@link loadFontFromBuffer}, δηλαδή στο **ίδιο** σημείο και από τα **ίδια**
 * `ArrayBuffer` bytes που ήδη διάβασε το opentype. Η αναλλοίωτη «ό,τι είναι στο `fontCache`
 * είναι και στο `document.fonts`» δεν συντηρείται — **ισχύει δομικά**.
 *
 * ## Πού πάμε πάνω από τους μεγάλους
 * Revit / AutoCAD / Figma κρατούν **έναν** μηχανισμό γραμματοσειράς για κάθε επιφάνεια
 * (κάτοψη, 3D, in-place editor) — αλλά τους είναι εύκολο: ζωγραφίζουν οι ίδιοι παντού. Εδώ
 * οι δύο επιφάνειες είναι **δύο διαφορετικές μηχανές** (opentype.js σε `Path2D` και ο
 * rasterizer του browser), και δεν μπορούν να ενοποιηθούν. Το ισοδύναμο της ενοποίησης είναι
 * να ταΐζονται από την **ίδια πηγή bytes** — που είναι ακριβώς ό,τι κάνει αυτό το module.
 *
 * @module text-engine/fonts/css-font-registry
 * @see text-engine/fonts/cad-font-preload.ts — «ποιο λογικό όνομα, ποιο αρχείο» (η αυθεντία)
 * @see rendering/entities/table/table-text-font.ts — ο καταναλωτής: ποιο CSS family γράφεται
 */

import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('CssFontRegistry');

/**
 * Τα ονόματα που έχουν ήδη δηλωθεί στο `document.fonts`, **πεζά** — η ίδια κανονικοποίηση με
 * το `FontCache`, ώστε τα δύο μητρώα να μη μπορούν να διαφωνήσουν για το τι είναι «ίδιο όνομα».
 *
 * ⚠️ Το CSS ταιριάζει ονόματα οικογένειας **χωρίς διάκριση πεζών/κεφαλαίων**, οπότε η πεζή
 * μορφή είναι το σωστό κλειδί και όχι απλοποίηση.
 */
const registered = new Set<string>();

/** Οι φορτώσεις που τρέχουν αυτή τη στιγμή — δες {@link whenCssFontFacesReady}. */
const pending = new Set<Promise<unknown>>();

/** Ο κατασκευαστής `FontFace`, ή `undefined` σε SSR / jsdom / παλιό περιβάλλον. */
function fontFaceCtor(): typeof FontFace | undefined {
  if (typeof document === 'undefined' || !document.fonts) return undefined;
  return (globalThis as { FontFace?: typeof FontFace }).FontFace;
}

/**
 * Δήλωσε τη γραμματοσειρά `family` στο CSS σύστημα του εγγράφου, από τα **ίδια** bytes με τα
 * οποία την παρέλαβε το opentype.
 *
 * Ιδεμποτεντ ανά όνομα: δεύτερη κλήση για το ίδιο όνομα δεν κάνει τίποτα. Σιωπηλά ανενεργό
 * χωρίς DOM (SSR, jest, worker) — εκεί απλώς **δεν υπάρχει** DOM να ζωγραφίσει, οπότε η
 * απουσία δεν είναι υποβάθμιση αλλά η σωστή απάντηση.
 *
 * ⚠️ **Δεν πετά ποτέ.** Μια αποτυχία εδώ σημαίνει ότι ο επεξεργαστής κελιού θα δείξει
 * γραμματοσειρά συστήματος — ενοχλητικό αλλά όχι μοιραίο· μια εξαίρεση θα κατέβαζε ολόκληρη
 * τη φόρτωση της γραμματοσειράς **του καμβά**, που είναι το κύριο έργο του καλούντος.
 */
export function registerCssFontFace(family: string, buffer: ArrayBuffer): void {
  const key = family.trim().toLowerCase();
  if (!key || registered.has(key)) return;
  const Ctor = fontFaceCtor();
  if (!Ctor) return;

  registered.add(key);
  try {
    const face = new Ctor(family, buffer);
    document.fonts.add(face);
    // Με δυαδική πηγή το `load()` δεν κάνει δικτυακό αίτημα — αναλύει ό,τι ήδη κρατάμε. Το
    // περιμένουμε μόνο για να ξέρει το `whenCssFontFacesReady` πότε είναι ασφαλές να μετρήσει
    // κανείς με αυτό το όνομα (δες εκεί γιατί η μέτρηση δεν επιτρέπεται να προηγηθεί).
    const loading = face.load().catch((error: unknown) => {
      registered.delete(key);
      logger.warn('CSS FontFace failed to load', { family, error });
    });
    pending.add(loading);
    void loading.finally(() => pending.delete(loading));
  } catch (error) {
    registered.delete(key);
    logger.warn('CSS FontFace could not be registered', { family, error });
  }
}

/**
 * Περίμενε να ολοκληρωθεί κάθε εγγραφή που τρέχει.
 *
 * 🔴 **Δεν είναι ευλάβεια — είναι ο φύλακας μιας απομνημόνευσης που δεν ακυρώνεται.** Ο
 * επεξεργαστής κελιού μετρά τη ζώνη ascent/descent **μία φορά ανά οικογένεια** και την κρατά
 * (`table-cell-text-metrics.ts`, `BAND_CACHE`). Αν κάποιος μετρήσει με το όνομα πριν η
 * γραμματοσειρά υπάρξει, ο browser απαντά για την **εφεδρική** γραμματοσειρά και η λάθος
 * απάντηση κλειδώνεται για όλη τη συνεδρία — δηλαδή η γραμμή βάσης του πεδίου θα έπεφτε
 * μόνιμα αλλού από αυτήν του καμβά, χωρίς κανένα σφάλμα πουθενά.
 */
export async function whenCssFontFacesReady(): Promise<void> {
  if (pending.size === 0) return;
  await Promise.all([...pending]);
}

/** Είναι το `family` δηλωμένο στο CSS σύστημα; (παρατηρησιμότητα + άγκυρες) */
export function isCssFontFaceRegistered(family: string): boolean {
  return registered.has(family.trim().toLowerCase());
}

/** Test helper — καθάρισμα ανάμεσα σε σουίτες. */
export function __resetCssFontRegistryForTests(): void {
  registered.clear();
  pending.clear();
}
