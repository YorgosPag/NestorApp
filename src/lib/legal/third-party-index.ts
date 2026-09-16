/**
 * @fileoverview SSoT — **ο αναγνώστης του παραγόμενου καταλόγου αποδόσεων** που διαβάζει
 *   η δημόσια σελίδα `/open-source`. ADR-863 Φ3.
 * @related scripts/lib/third-party-notices/render.js (ο γεννήτορας · `renderIndex`) ·
 *   lib/data/lazy-json-snapshot.ts (ο μηχανισμός) · components/legal/ThirdPartyComponentTable.tsx
 * @module lib/legal/third-party-index
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΤΕΜΠΕΛΙΚΑ ΑΠΟ ΤΟ `public/` ΚΑΙ ΟΧΙ ΣΤΑΤΙΚΗ ΕΙΣΑΓΩΓΗ — ΜΕΤΡΗΜΕΝΟ
 * ─────────────────────────────────────────────────────────────────────────────
 * Ο κατάλογος είναι **1.071 στοιχεία / 61.035 bytes** ωμά. Στατική εισαγωγή θα τα
 * προσγείωνε στο chunk της διαδρομής, δηλαδή **6,8%** του συνολικού περιθωρίου της
 * ratchet μεγέθους (`.bundle-size-baseline.json`: 44.867.887 × 2% = **897.358 bytes**),
 * για σελίδα που ανοίγει **σπάνια**. Μένοντας στο `public/`, το κόστος στη ratchet είναι
 * **μηδέν**: ο `analyzeNextBuild` μετρά **μόνο** `.next/static`.
 *
 * ⚠️ **ΚΑΙ Η ΝΟΜΙΚΗ ΥΠΟΧΡΕΩΣΗ ΔΕΝ ΕΞΑΡΤΑΤΑΙ ΑΠΟ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ.** Ο άνθρωπος χωρίς
 * JavaScript βλέπει ούτως ή άλλως την εξήγηση **και** τον σύνδεσμο προς τα πλήρη κείμενα
 * (`/third-party/THIRD_PARTY_NOTICES.txt`, σερβιρισμένο από το ίδιο origin). Αυτός ο
 * κατάλογος είναι **ευκολία ανάγνωσης**, ποτέ ο φορέας της συμμόρφωσης — γι' αυτό μια
 * αποτυχία φόρτωσης εδώ είναι ανεκτή, και λέγεται **ρητά** στην οθόνη.
 *
 * ⚠️ **Ο ΜΗΧΑΝΙΣΜΟΣ ΔΕΝ ΓΡΑΦΕΤΑΙ ΕΔΩ** (N.18): cache + single-flight + «η αποτυχία αφήνει
 * το cache άδειο» ζουν στο {@link module:lib/data/lazy-json-snapshot}, εξαγμένα ήδη για
 * τη διοικητική ιεραρχία και τα γεωγραφικά αποτυπώματα. Τρίτη γραφή τους θα ήταν το
 * sibling clone που μετρά το CHECK 3.28.
 */

import { createLazyJsonSnapshot } from '@/lib/data/lazy-json-snapshot';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('third-party-index');

/**
 * Πού καταλήγει ένα στοιχείο.
 *
 * 🔑 **Τα ίδια ακριβώς ονόματα με το `SURFACE` του γεννήτορα**
 * (`scripts/lib/third-party-notices/judge.js`). Δεύτερο λεξιλόγιο εδώ θα σήμαινε ότι το
 * ίδιο byte διαβάζεται αλλιώς στις δύο άκρες του σύρματος.
 */
export type ThirdPartySurface = 'browser' | 'server' | 'unknown';

/** Ένα στοιχείο ανοιχτού κώδικα, όπως το βλέπει η οθόνη. */
export interface ThirdPartyComponent {
  readonly name: string;
  readonly version: string;
  /** Αναγνωριστικό SPDX — **δεν μεταφράζεται** σε καμία γλώσσα. */
  readonly license: string;
  readonly surface: ThirdPartySurface;
}

/** Ο κατάλογος, μαζί με ό,τι χρειάζεται η οθόνη για να πει την αλήθεια για τον εαυτό του. */
export interface ThirdPartyIndex {
  /** Το αποτύπωμα των εισόδων — **το ίδιο** με τα άλλα δύο παραδοτέα. */
  readonly fingerprint: string;
  readonly generatedAt: string;
  /**
   * **Έχει μετρηθεί ποια στοιχεία κατεβαίνουν στον browser;**
   *
   * 🔴 Όσο είναι `false`, κάθε στοιχείο είναι `unknown`. Η οθόνη **οφείλει** να το πει:
   * ένα «0 διανέμονται» θα ήταν *«κανείς δεν κοίταξε»* ντυμένο ως *«καμία υποχρέωση»*.
   */
  readonly measured: boolean;
  readonly components: readonly ThirdPartyComponent[];
}

/**
 * **Η κατάσταση «ρώτησα και δεν έμαθα»** — ίδιο ιδίωμα με το `EMPTY_FOOTPRINTS`.
 *
 * ⚠️ `measured: false` **επίτηδες**: αν ο κατάλογος δεν φορτώσει, δεν ξέρουμε τίποτα για
 * τις επιφάνειες — και το «δεν ξέρω» δεν επιτρέπεται να μοιάζει με μέτρηση.
 */
export const EMPTY_THIRD_PARTY_INDEX: ThirdPartyIndex = {
  fingerprint: '',
  generatedAt: '',
  measured: false,
  components: [],
};

function isSurface(value: unknown): value is ThirdPartySurface {
  return value === 'browser' || value === 'server' || value === 'unknown';
}

const asText = (value: unknown): string => (typeof value === 'string' ? value : '');

/**
 * Μία γραμμή του παραγόμενου αρχείου → στοιχείο· `null` αν δεν είναι γραμμή.
 *
 * ⚠️ **Η ΑΓΝΩΣΤΗ ΕΠΙΦΑΝΕΙΑ ΓΙΝΕΤΑΙ `unknown`, ΠΟΤΕ `server` — fail-closed.** Η αντίστροφη
 * επιλογή θα έλεγε στον αναγνώστη *«δεν διανέμεται»* για κάτι που κανείς δεν μέτρησε,
 * δηλαδή θα παρουσίαζε **άγνοια ως απαλλαγή**. Ίδιος κανόνας με το `surfaceOf` του
 * γεννήτορα, στην άλλη άκρη του σύρματος.
 *
 * ⚠️ Στοιχείο χωρίς όνομα **απορρίπτεται**: μια κενή γραμμή στον πίνακα δεν αποδίδει
 * τίποτα σε κανέναν, και κρύβει ότι το αρχείο ήρθε χαλασμένο.
 */
function readComponent(value: unknown): ThirdPartyComponent | null {
  if (typeof value !== 'object' || value === null) return null;
  const row: Record<string, unknown> = { ...value };
  const name = asText(row.n);
  if (name === '') return null;
  return {
    name,
    version: asText(row.v),
    license: asText(row.l),
    surface: isSurface(row.s) ? row.s : 'unknown',
  };
}

/**
 * **Ωμό φορτίο → κατάλογος.** Πετά αν το σχήμα δεν είναι το αναμενόμενο.
 *
 * 🔴 **Ο ΕΛΕΓΧΟΣ ΣΧΗΜΑΤΟΣ ΔΕΝ ΕΙΝΑΙ ΤΥΠΙΚΟΤΗΤΑ** (το ίδιο μάθημα με το
 * `buildFootprintSnapshot`): ένα `fetch(...).json()` επιστρέφει χαρούμενα τη σελίδα
 * σφάλματος του διακομιστή ή το HTML fallback, και ο επόμενος βρόχος πετά μέσα σε
 * render — σε **δημόσια, ανώνυμη** σελίδα. Εδώ πετάμε **πριν** μπει τίποτα στο cache.
 *
 * ⚠️ **Απόρριψη ΑΝΑ ΓΡΑΜΜΗ, όχι όλα-ή-τίποτα**: κάθε στοιχείο είναι ανεξάρτητη μαρτυρία.
 */
export function buildThirdPartyIndex(payload: unknown): ThirdPartyIndex {
  if (typeof payload !== 'object' || payload === null) {
    throw new TypeError('Ο κατάλογος αποδόσεων δεν έχει το αναμενόμενο σχήμα');
  }
  const raw: Record<string, unknown> = { ...payload };
  if (!Array.isArray(raw.rows)) {
    throw new TypeError('Ο κατάλογος αποδόσεων δεν περιέχει γραμμές (`rows`)');
  }

  const components: ThirdPartyComponent[] = [];
  let rejected = 0;
  for (const entry of raw.rows) {
    const component = readComponent(entry);
    if (component === null) {
      rejected += 1;
      continue;
    }
    components.push(component);
  }

  if (rejected > 0) {
    logger.warn('Γραμμές του καταλόγου αποδόσεων που δεν διαβάστηκαν — δεν εμφανίζονται', {
      rejected,
      accepted: components.length,
    });
  }

  return {
    fingerprint: asText(raw.fingerprint),
    generatedAt: asText(raw.generatedAt),
    measured: raw.measured === true,
    components,
  };
}

/**
 * Ο τεμπέλης αναγνώστης — **ένα** στιγμιότυπο ανά σελίδα.
 *
 * ⚠️ Η διαδρομή είναι **του `public/`**, όχι διαδρομή σελίδας: το `Dockerfile` την
 * αντιγράφει (`COPY public ./public`) και ο matcher του middleware εξαιρεί ρητά `.json`.
 * Γι' αυτό το `third-party` είναι δηλωμένο στο `NOT_A_PAGE` της άγκυρας `Ν1`
 * (`route-catalogue-anchor.test.ts`) — **αρχείο, όχι οθόνη**.
 */
export const THIRD_PARTY_INDEX_SOURCE = createLazyJsonSnapshot<ThirdPartyIndex>({
  url: '/third-party/index.json',
  build: buildThirdPartyIndex,
  onFailure: (error) => {
    logger.warn('Δεν φορτώθηκε ο κατάλογος αποδόσεων — τα πλήρη κείμενα παραμένουν διαθέσιμα', {
      error: error instanceof Error ? error.message : String(error),
    });
  },
});
