'use client';

/**
 * @fileoverview **Ο ΚΑΜΒΑΣ ΤΟΥ ΜΟΝΤΕΛΟΥ** — το μόνο αρχείο που αγγίζει τη βιβλιοθήκη 3Δ.
 * @related ADR-845 §7.6 (Φ4.3) · ADR-841 §6 · CHECK 3.65 (πύλη της μίας έκδοσης)
 * @module components/listing-detail/ListingModelCanvas
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⛔⛔ Η ΕΙΣΑΓΩΓΗ ΕΙΝΑΙ ΒΑΘΙΑ ΕΠΙΤΗΔΕΣ. ΜΗΝ ΤΗΝ «ΑΠΛΟΠΟΙΗΣΕΙΣ» ΣΕ `@google/model-viewer`.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το πακέτο δημοσιεύει **δύο** builds, και η επιλογή ανάμεσά τους **δεν είναι γούστο**:
 *
 * | build | μέγεθος | three |
 * |---|---|---|
 * | `dist/model-viewer.min.js` | **1.068.903** bytes | **ενσωματωμένο**, ταιριασμένο από τη Google |
 * | `dist/model-viewer-module.min.js` | **475.096** bytes | **εξωτερικό** — το `peerDependency` |
 *
 * Η διαφορά των **594 KB είναι το three**. *(Μετρημένο στο unpkg, 2026-09-08.)*
 *
 * 🔴 **ΚΑΙ ΕΔΩ ΕΙΝΑΙ Η ΠΑΓΙΔΑ**: το `package.json` του πακέτου έχει
 * `main: dist/model-viewer.min.js` *(αυτοτελές)* αλλά `module: lib/model-viewer.js`
 * *(εξωτερικό three)* — και **το webpack προτιμά το `module`**. Ένα σκέτο
 * `import '@google/model-viewer'` παίρνει **σιωπηλά το λάθος build**, και το λάθος build
 * ζητά `three@^0.183`, ενώ το έργο τρέχει **`0.170.0`** σε **511 αρχεία** του DXF viewer.
 *
 * 🔑 **ΓΙΑΤΙ ΑΥΤΟ ΕΙΝΑΙ ΤΟ ΣΩΣΤΟ, ΟΧΙ ΤΟ ΒΟΛΙΚΟ**: το `<model-viewer>` σε **καμία** έκδοση
 * δεν δέχεται `three@0.170` *(`4.0.0` → `^0.169.0` · `4.1.0` → `^0.172.0` · οι ενδιάμεσες
 * **δεν υπάρχουν**)*. Το αυτοτελές build **αποσυνδέει** τη δημόσια σελίδα από τη μηχανή
 * CAD αντί να τις δέσει σε κοινή έκδοση — που είναι και αρχιτεκτονικά σωστό: **καμία** από
 * τις 511 εισαγωγές του three δεν ζει έξω από το subapp, και η δημόσια σελίδα **δεν
 * κουβαλά σήμερα καθόλου three**.
 *
 * ⚠️ Ο `pnpm.overrides.three` υπάρχει **μόνο** για να μείνει το lockfile μονοσήμαντο
 * *(CHECK 3.65, κανόνας Κ2 — το `.one-version.json` καλύπτει μόνο τον Κ1)*. Η βιβλιοθήκη
 * **δεν διαβάζει ποτέ** το `node_modules/three`, άρα ο override δεν την επηρεάζει.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΔΕΝ ΥΠΑΡΧΕΙ ΕΔΩ `reveal="interaction"` — ΚΑΝΟΥΜΕ ΚΑΤΙ ΑΥΣΤΗΡΟΤΕΡΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η επίσημη συνταγή της Google *(modelviewer.dev/examples/lighthouse.html)* βάζει το
 * στοιχείο στη σελίδα από την αρχή και αναβάλλει την **αποκάλυψη**. Εμείς δεν βάζουμε καν
 * **το στοιχείο**: αυτό το αρχείο φορτώνεται με `next/dynamic({ ssr: false })` **μόνο μετά
 * το κλικ** *(δες `ListingModelStage`)*. ⇒ Το κομμάτι του megabyte **δεν ζητιέται ποτέ**
 * από επισκέπτη που δεν ζήτησε 3Δ, και το LCP της σελίδας μένει **η κορυφαία φωτογραφία**
 * *(Α2.4)*. Άρα τη στιγμή που τρέχει αυτός ο κώδικας ο άνθρωπος **έχει ήδη ζητήσει** το
 * μοντέλο ⇒ `loading="eager"` και `reveal="auto"` είναι το **τίμιο** ζευγάρι.
 */

// eslint-disable-next-line import/no-unresolved -- βαθιά εισαγωγή του αυτοτελούς build· δες την κεφαλίδα
import '@google/model-viewer/dist/model-viewer.min.js';

import React from 'react';

import { MESHOPT_DECODER_URL } from '@/config/vendored-public-assets';

// ⛔ **ΑΠΟ ΕΔΩ, ΠΟΤΕ ΑΝΤΙΣΤΡΟΦΑ**: η σταθερά ζει σε αρχείο **χωρίς παρενέργειες**, γιατί τη
//    χρειάζεται και η **άλλη** πλευρά του συνόρου `dynamic()`. Αν επιστρέψει εδώ, το σκαλί θα
//    την εισάγει στατικά και το megabyte θα μπει στο ΚΥΡΙΟ πακέτο — δες την κεφαλίδα εκείνου.
import { MODEL_STAGE_ASPECT_CLASS } from './listing-model-stage-metrics';

/**
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴🔴 Ο-22 — ΧΩΡΙΣ ΑΥΤΕΣ ΤΙΣ ΔΥΟ ΓΡΑΜΜΕΣ **ΚΑΝΕΝΑ** ΜΟΝΤΕΛΟ ΜΑΣ ΔΕΝ ΑΝΟΙΓΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * **Μετρημένο ζωντανά (2026-09-09)**, με το CORS ήδη λυμένο και το `.glb` να κατεβαίνει:
 *
 * ```
 * THREE.GLTFLoader: setMeshoptDecoder must be called before loading compressed files
 * ```
 *
 * 🔑 **Η ΡΑΦΗ, ΟΧΙ ΤΟ ΑΚΡΟ**: ο ψήστης μας συμπιέζει **πάντα** με `EXT_meshopt_compression`
 * *(`public-shelf-model-bake`, βήμα ④ «κβάντιση+meshopt» — μετρημένο **112.980 → 32.928 bytes**,
 * −71%)*. Ο θεατής δεν είχε **ποτέ** αποκωδικοποιητή. Δύο άκρα, καθένα σωστό μόνο του, και η
 * ραφή τους δεν ρωτήθηκε ποτέ — **ακριβώς** το σχήμα του Ο-13.
 *
 * 🔴 **ΚΑΙ ΤΟ `<model-viewer>` ΔΕΝ ΕΧΕΙ ΠΡΟΕΠΙΛΟΓΗ** *(μετρημένο μέσα στο 4.3.1: το bundle
 * γράφει `c.meshoptDecoderLocation && Pg.setMeshoptDecoderLocation(…)`)*. Δηλαδή η σιωπή **δεν**
 * σημαίνει «θα φορτώσει από CDN» — σημαίνει «**ποτέ**». Δομικό, όχι ρύθμιση περιβάλλοντος.
 *
 * ⚠️ **Ενίει ΚΛΑΣΙΚΟ `<script src>`** και περιμένει καθολικό `MeshoptDecoder`. Γι' αυτό το
 * αντίγραφό μας είναι το **`.cjs`** *(UMD footer)* και όχι το `.mjs` — δες το μητρώο.
 *
 * ⚠️ **ΓΙΑΤΙ ΣΕ `useState` ΚΑΙ ΟΧΙ ΣΕ `useEffect`**: η ανάθεση πρέπει να έχει γίνει **πριν** το
 * στοιχείο δει το `src`. Ένα `useEffect` τρέχει **μετά** το commit, δηλαδή αφού το
 * `<model-viewer>` έχει ήδη ξεκινήσει τη φόρτωση — και η πρώτη προβολή θα αποτύγχανε, με τη
 * δεύτερη να «διορθώνεται» μυστηριωδώς. Η αρχικοποίηση `useState` τρέχει **στο render**, μία
 * φορά ανά προσάρτηση, πριν από κάθε DOM.
 *
 * ⛔ **Η διεύθυνση ΔΕΝ γράφεται εδώ ως λεκτικό** — έρχεται από το μητρώο που φυλάει η πύλη.
 */
function useMeshoptDecoderRegistered(): void {
  React.useState(() => {
    const element = customElements.get('model-viewer') as
      | { meshoptDecoderLocation?: string }
      | undefined;
    if (element !== undefined && element.meshoptDecoderLocation !== MESHOPT_DECODER_URL) {
      element.meshoptDecoderLocation = MESHOPT_DECODER_URL;
    }
    return null;
  });
}

interface ListingModelCanvasProps {
  readonly src: string;
  readonly alt: string;
  /** Καλείται όταν η σκηνή απέτυχε — το σκαλί δείχνει ονομασμένη αποτυχία, ποτέ κενό. */
  readonly onFailed: () => void;
}

/**
 * Ένα μοντέλο, ζωντανό.
 *
 * ⚠️ **Οι ακροατές μπαίνουν με `ref`, όχι με `onLoad`/`onError` του JSX**: τα γεγονότα
 * `load`/`error` **δεν αναδύονται**, και ο React δεν τα προωθεί αξιόπιστα σε custom
 * elements. Ένας ακροατής που δεν καλείται ποτέ είναι **σιωπηλή** αποτυχία — η κλάση που
 * αυτό το ADR κυνηγά από την πρώτη του γραμμή.
 */
export default function ListingModelCanvas({ src, alt, onFailed }: ListingModelCanvasProps) {
  useMeshoptDecoderRegistered();
  const ref = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    const element = ref.current;
    if (element === null) return undefined;
    element.addEventListener('error', onFailed);
    return () => element.removeEventListener('error', onFailed);
  }, [onFailed]);

  // ⚠️ `touch-action="pan-y"`: χωρίς αυτό ο καμβάς τρώει την κατακόρυφη κύλιση της σελίδας
  //    σε κινητό — ο επισκέπτης **παγιδεύεται** μέσα στο μοντέλο και δεν διαβάζει την αγγελία.
  return (
    <model-viewer
      ref={ref}
      src={src}
      alt={alt}
      camera-controls=""
      touch-action="pan-y"
      environment-image="neutral"
      shadow-intensity="1"
      loading="eager"
      reveal="auto"
      className={`w-full rounded-lg border border-border bg-card ${MODEL_STAGE_ASPECT_CLASS}`}
    />
  );
}
