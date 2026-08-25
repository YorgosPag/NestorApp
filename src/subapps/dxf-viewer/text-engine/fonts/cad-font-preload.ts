/**
 * CadFontPreload — φορτώνει τις ενσωματωμένες όψεις υποκατάστασης στο FontCache ώστε ο κύριος
 * καμβάς να ζωγραφίζει κείμενο ως περιγράμματα glyph (ADR-530), και **όχι** ως εφεδρική του
 * browser.
 *
 * `cacheName` είναι η ΛΟΓΙΚΗ οικογένεια που καλύπτει η όψη (ταιριάζει με τους στόχους του
 * `FONT_SUBSTITUTION_TABLE`)· `url` είναι το ΦΥΣΙΚΟ αρχείο κάτω από το `public/fonts/`.
 *
 * ## 🔴 ADR-803 — ΤΟ ΨΕΜΑ ΠΟΥ ΕΚΛΕΙΣΕ ΕΔΩ, ΚΑΙ ΗΤΑΝ ΔΥΟ ΕΠΙΠΕΔΩΝ
 *
 * Μέχρι τις 2026-08-25 αυτό το αρχείο φόρτωνε **ένα** αρχείο — `Roboto-Regular.ttf` — κάτω από
 * το λογικό όνομα **«Liberation Sans»**, ενώ ο πίνακας υποκατάστασης υποσχόταν **πέντε**
 * οικογένειες. Δύο ξεχωριστές αναλήθειες, και η δεύτερη ήταν αόρατη ακόμη και στην πύλη:
 *
 * 1. **Η υπόσχεση δεν φορτωνόταν** (CHECK 3.67): `romand.shx → «Liberation Sans Bold»` δεν
 *    υπήρχε πουθενά ⇒ ο `resolveEntityFont` επέστρεφε `null` ⇒ κάθε **έντονο** CAD κείμενο
 *    έπεφτε σιωπηλά στο CSS. Το βήμα ① (SHX → υποκατάστατο) το αναφέρει ο `MissingFontBanner`·
 *    το βήμα ② (υποκατάστατο → εφεδρική) ήταν **σιωπηλό**.
 *
 * 2. **Το ΟΝΟΜΑ έλεγε ψέματα για το ΑΡΧΕΙΟ.** Ο πίνακας δηλώνει στον χρήστη *«Liberation Sans
 *    (metric-compatible sans-serif)»* — και το Roboto **δεν είναι** metric-compatible με το
 *    Arial. Μετρημένο με opentype πάνω στα ίδια bytes, πλάτη ανά 1000em:
 *
 *    | | `A` | `M` | `W` | `i` |
 *    |---|---|---|---|---|
 *    | Arial (το συμβόλαιο) | 667 | 833 | 944 | 222 |
 *    | Roboto (τι φορτώναμε) | **652** | **873** | **887** | **243** |
 *    | Liberation Sans (τώρα) | 667 ✅ | 833 ✅ | 944 ✅ | 222 ✅ |
 *
 *    Απόκλιση ως **6% ανά glyph**. Σε CAD αυτό δεν είναι αισθητική: είναι «χωράει ή δεν χωράει
 *    το κείμενο στο υπόμνημα», δηλαδή σχέδιο που τυπώνεται αλλιώς απ' ό,τι στο AutoCAD.
 *
 * ⚠️ **Γι' αυτό η θεραπεία ΔΕΝ ήταν να μπει «μια bold γραμματοσειρά».** Ήταν να μπει η
 * γραμματοσειρά **που ονομάζει ο πίνακας**: Liberation 2.1.5 (SIL OFL 1.1, εγκεκριμένη από τον
 * Giorgio 2026-08-25 — δες `.license-allowlist.json`). Το όνομα, το αρχείο και ο ισχυρισμός
 * λένε πλέον **το ίδιο πράγμα**.
 *
 * @module text-engine/fonts/cad-font-preload
 * @see font-substitution-table.ts — οι υποσχέσεις (η αυθεντία του «τι»)
 * @see css-font-registry.ts — η αυτόματη εγγραφή στο `document.fonts`, από τα ΙΔΙΑ bytes
 */

import { loadFont } from './font-loader';
import { fontCache } from './font-cache';
import { whenCssFontFacesReady } from './css-font-registry';
import { bumpFontReady } from './font-ready-store';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('CadFontPreload');

export interface CadSubstituteFont {
  /** Logical substitute family (matches FONT_SUBSTITUTION_TABLE targets). */
  readonly cacheName: string;
  /** Physical font file served from public/fonts/. */
  readonly url: string;
}

/**
 * Οι όψεις που ζωγραφίζει ο κύριος καμβάς.
 *
 * 🔑 **ΔΥΟ ΑΞΟΝΕΣ, ΚΑΙ Ο ΔΕΥΤΕΡΟΣ ΔΕΝ ΦΑΙΝΕΤΑΙ ΣΤΟΝ ΠΙΝΑΚΑ.** Ο `FONT_SUBSTITUTION_TABLE`
 * ονομάζει **οικογένειες** (`romand.shx → «Liberation Sans Bold»`)· ο `resolveEntityFont`
 * όμως συνθέτει και **όψεις από στυλ** (`faceNameFor`: `«<οικογένεια> Italic»` /
 * `«… Bold Italic»`) όταν η οντότητα DXF ζητά πλάγιο ή έντονο. Οι όψεις στυλ **δεν** είναι
 * υποσχέσεις του πίνακα — άρα η CHECK 3.67 δεν τις βλέπει — αλλά η απουσία τους παράγει
 * **ακριβώς την ίδια σιωπηλή υποβάθμιση**. Γι' αυτό είναι εδώ.
 *
 * ⚠️ **ΚΟΣΤΟΣ, ΜΕΤΡΗΜΕΝΟ**: 1.969.488 bytes έναντι 515.100 πριν (3,8×). Είναι αποδεκτό γιατί
 * η φόρτωση είναι **μη μπλοκάρουσα** (ο καλών κάνει `void preloadCadSubstituteFonts()` και το
 * κείμενο ζωγραφίζεται με CSS ώσπου να έρθουν τα glyphs), γίνεται **μία φορά ανά συνεδρία**,
 * και το `public/` σερβίρεται με μακρά κρυφή μνήμη. Το `LiberationSans-Regular` είναι μάλιστα
 * **104 KB ΜΙΚΡΟΤΕΡΟ** από το Roboto που αντικατέστησε.
 *
 * 🔶 **ΔΗΛΩΜΕΝΟ ΕΠΟΜΕΝΟ ΒΗΜΑ, ΟΧΙ ΠΑΡΑΛΕΙΨΗ**: η φόρτωση θα μπορούσε να οδηγείται από το
 * **σχέδιο** (ο `font-loader` ήδη ξέρει ποια SHX αναφέρθηκαν) και να κατεβάζει μόνο τις όψεις
 * που χρειάζονται. **ΔΕΝ έγινε εδώ επίτηδες**: το ADR-786 §4 αποδεικνύει ότι μια μέτρηση με
 * όνομα γραμματοσειράς **πριν** αυτή υπάρξει στο `document.fonts` **κλειδώνει** τη λάθος
 * απάντηση για όλη τη συνεδρία (`BAND_CACHE`). Η κατ' απαίτηση φόρτωση **επαναφέρει ακριβώς
 * αυτόν τον αγώνα**, και είναι άλλο ερώτημα από «λέει ο πίνακας την αλήθεια;».
 */
export const CAD_SUBSTITUTE_FONTS: readonly CadSubstituteFont[] = [
  // Ο catch-all στόχος του πίνακα ('*' → «Liberation Sans»): ό,τι δεν αναγνωρίζεται καταλήγει
  // εδώ, οπότε είναι η όψη με τη μεγαλύτερη κάλυψη. Metric-compatible με Arial (6/6).
  { cacheName: 'Liberation Sans', url: '/fonts/LiberationSans-Regular.ttf' },
  // romans.shx/simplex.shx + bold ⇒ «Liberation Sans Bold»· ΚΑΙ ο ρητός στόχος του romand.shx.
  { cacheName: 'Liberation Sans Bold', url: '/fonts/LiberationSans-Bold.ttf' },
  // Άξονας στυλ (δες παραπάνω) — δεν τις υπόσχεται ο πίνακας, τις ζητά ο resolver.
  { cacheName: 'Liberation Sans Italic', url: '/fonts/LiberationSans-Italic.ttf' },
  { cacheName: 'Liberation Sans Bold Italic', url: '/fonts/LiberationSans-BoldItalic.ttf' },
  // txt.shx (μονοδιάστημο) ⇒ «Liberation Mono». Metric-compatible με Courier New (600/1000).
  { cacheName: 'Liberation Mono', url: '/fonts/LiberationMono-Regular.ttf' },
];

let started = false;

/**
 * Φόρτωσε μία όψη, απομονώνοντας την αποτυχία της.
 *
 * ⚠️ **Η απομόνωση είναι το νόημα**: με `Promise.all` πάνω σε ωμά promises, **μία** αποτυχία
 * δικτύου θα κατέβαζε ολόκληρη τη δέσμη και ο καμβάς θα έμενε χωρίς **καμία** γραμματοσειρά —
 * χειρότερα από το πρόβλημα που λύνουμε.
 */
async function loadOne(entry: CadSubstituteFont): Promise<boolean> {
  if (fontCache.has(entry.cacheName)) return true;
  try {
    await loadFont(entry.url, entry.cacheName);
    return true;
  } catch (error) {
    logger.warn('CAD substitute font failed to load', { url: entry.url, error });
    return false;
  }
}

/**
 * Ιδεμποτεντ preload — φέρνει κάθε όψη μία φορά και σηματοδοτεί `bumpFontReady()` όταν έστω
 * μία είναι διαθέσιμη, ώστε ο καμβάς να ξαναχτίσει την bitmap cache του με glyph κείμενο.
 * Ασφαλές σε κάθε mount του καμβά.
 *
 * ⚠️ **ΠΑΡΑΛΛΗΛΑ, ΚΑΙ ΑΥΤΟ ΕΙΝΑΙ Ο ΛΟΓΟΣ ΠΟΥ ΤΟ ΜΕΓΑΛΥΤΕΡΟ ΣΥΝΟΛΟ ΕΙΝΑΙ ΔΩΡΕΑΝ.** Ο βρόχος
 * ήταν **σειριακός** (`for … await`), οπότε ο χρόνος ως το glyph κείμενο ήταν το **άθροισμα**
 * των μεταφορτώσεων· με πέντε όψεις θα τετραπλασιαζόταν. Παράλληλα είναι ο χρόνος της
 * **πιο αργής**. ⚠️ **ΕΝΑ batch, ΕΝΑ bump** — το συμβόλαιο του ADR-040 (μία `invalidate()` ανά
 * `bumpFontReady`) μένει **ανέγγιχτο**· δεν προστέθηκε ενδιάμεσο σήμα.
 */
export async function preloadCadSubstituteFonts(): Promise<void> {
  if (started) return;
  started = true;

  const results = await Promise.all(CAD_SUBSTITUTE_FONTS.map(loadOne));
  const loadedAny = results.some(Boolean);

  // 🔴 ADR-786 §4 — **πρώτα έτοιμη η CSS όψη, μετά το σήμα.** Το `bumpFontReady()` ξυπνά
  // καταναλωτές που μετρούν (και **απομνημονεύουν**) με το όνομα της γραμματοσειράς· αν το
  // `document.fonts` δεν την έχει ακόμη, ο browser απαντά για την εφεδρική και η λάθος
  // απάντηση κλειδώνεται για όλη τη συνεδρία. Δες `whenCssFontFacesReady`.
  await whenCssFontFacesReady();
  if (loadedAny) bumpFontReady();
}
