'use client';

/**
 * ADR-739 Φ.Ε/Φ4 + Φ4β — **το τελευταίο χρώμα ανά εντολή** του mini toolbar: αυτό που εφαρμόζει
 * το κύριο μισό κάθε split button (`A` για κείμενο, κουβαδάκι για γέμισμα) **χωρίς** να ανοίξει
 * μενού.
 *
 * ## 🔴 Γιατί ΔΕΝ είναι το `RecentColorsStore`
 * Το `ui/color/RecentColorsStore` είναι **καθολικό LRU 10 χρωμάτων για όλο το subapp**: το
 * τροφοδοτεί κάθε επιλογέας (layer, οντότητα, κείμενο, περιγράμματα). Αν το κουμπί «Α» διάβαζε
 * από εκεί, μια επιλογή χρώματος **layer** θα άλλαζε μόνη της τι εφαρμόζει το κουμπί χρώματος
 * κειμένου — δηλαδή το πιο άμεσο χειριστήριο της γραμμής θα γινόταν απρόβλεπτο για λόγο εντελώς
 * άσχετο με τον πίνακα.
 *
 * Το Excel κρατά **ένα «τελευταίο» ανά εντολή** (χρώμα γραμματοσειράς ≠ χρώμα επισήμανσης ≠
 * χρώμα γεμίσματος) και **χωριστά** τα πρόσφατα. Δύο διαφορετικές ερωτήσεις, δύο μνήμες.
 * Γράφουμε **και** στα δύο· διαβάζουμε από εδώ.
 *
 * ## 🔴 Δύο στιγμιότυπα, μία υλοποίηση — και ΟΧΙ ένα κοινό κλειδί
 * Το κείμενο και το γέμισμα κάνουν **την ίδια** δουλειά με **άλλη** προεπιλογή και **άλλον**
 * κανόνα αποδοχής. Δύο αντιγραμμένα modules θα ήταν το sibling clone που πιάνει το CHECK 3.28
 * (N.18)· ένα κοινό κλειδί `{text, fill}` θα ήταν χειρότερο από clone — οι δύο τιμές γράφονται
 * από **διαφορετικές χειρονομίες**, οπότε μια αλλοιωμένη εγγραφή θα σκότωνε και τα δύο
 * χειριστήρια. Ένα εργοστάσιο, δύο κλειδιά.
 *
 * ## 🔴 Η ασυμμετρία του λευκού — ο λόγος που ο sanitizer είναι παράμετρος
 * Το κείμενο απορρίπτει ό,τι δεν επιβιώνει ως μελάνι (`survivesAsInk`)· **το γέμισμα δεν το
 * κάνει, και δεν επιτρέπεται να το κάνει**. Το `print-color-policy.ts` το λέει ρητά για τον
 * ρόλο `'fill'`: εκεί ο ίδιος κανόνας είναι καταστροφικός — ένα `#EDEDED` φόντο κεφαλίδας
 * τυπωνόταν συμπαγές μαύρο και κατάπινε τα ίδια του τα γράμματα. Ένα αντιγραμμένο `sanitize`
 * θα κληρονομούσε σιωπηλά το λάθος φίλτρο· εδώ ο ρόλος το αποφασίζει σε **ένα** σημείο.
 *
 * ## Γιατί store και όχι state του component
 * Η γραμμή εργαλείων ξεμοντάρει σε κάθε κλείσιμο (κρέμεται από το `target` του
 * `TableHeaderContextMenu`). Ένα `useState` θα ξεχνούσε το χρώμα ανάμεσα σε δύο δεξιά κλικ —
 * δηλαδή το «εφάρμοσε ξανά χωρίς μενού» δεν θα δούλευε ποτέ, που είναι **ολόκληρος** ο λόγος
 * ύπαρξης του split button.
 *
 * Η συχνότητα είναι **ανθρώπινη** (μία γραφή ανά επιλογή χρώματος), άρα μια συνδρομή React σε
 * φύλλο είναι απολύτως θεμιτή — ο ADR-040 απαγορεύει συνδρομές σε **orchestrators** και σε
 * ροές 60fps, όχι σε χειριστήρια που αλλάζουν όταν κάνει κλικ ο άνθρωπος.
 *
 * @module subapps/dxf-viewer/state/table-toolbar-color-store
 * @see ui/color/RecentColorsStore.ts — η **άλλη** μνήμη, καθολική και πολλαπλή
 * @see config/print-color-policy.ts — `PlotColorRole`: ποιος ρόλος ανέχεται το λευκό
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §28.14, §35
 */

import { createExternalStore } from '../stores/createExternalStore';
import { storageGetString, storageSetString, STORAGE_KEYS } from '../utils/storage-utils';
import { normalizeHexColor } from '../config/color-math';
import { survivesAsInk, type PlotColorRole } from '../config/print-color-policy';

/**
 * Το χρώμα **κειμένου** του πρώτου πατήματος, σε καθαρό σχέδιο.
 *
 * ACI 1 «Κόκκινο» — το πρώτο ονομαστικό χρώμα του AutoCAD, και το ίδιο που προεπιλέγει το Excel
 * στο κουμπί χρώματος γραμματοσειράς. Δύο ανεξάρτητες παραδόσεις συμφωνούν· δεν εφευρίσκουμε
 * τρίτη.
 */
export const DEFAULT_TABLE_TEXT_COLOR = '#ff0000';

/**
 * Το χρώμα **γεμίσματος** του πρώτου πατήματος.
 *
 * Το κουμπί «Χρώμα γεμίσματος» του Excel είναι **κίτρινο** εξ ορισμού, και **ACI 2 = `#ffff00`
 * ακριβώς**. Ίδιο επιχείρημα με το κόκκινο του κειμένου, και η ίδια σύμπτωση: οι δύο παραδόσεις
 * δίνουν το ίδιο hex, οπότε η προεπιλογή δεν είναι γούστο κανενός.
 */
export const DEFAULT_TABLE_FILL_COLOR = '#ffff00';

/** Ό,τι εκθέτει μία μνήμη «τελευταίου χρώματος» — η υπογραφή που περιμένει το `useSyncExternalStore`. */
export interface ToolbarColorStore {
  /** Το τελευταίο χρώμα, **τη στιγμή της κλήσης** — για χειριστές συμβάντων. */
  readonly get: () => string;
  /**
   * Θυμήσου αυτό το χρώμα ως «το τελευταίο». **Δεν** εφαρμόζει τίποτα — η εφαρμογή στο μοντέλο
   * είναι δουλειά του `setAxisStyleField`, και οι δύο πράξεις μένουν χωριστές ώστε το
   * «Αυτόματο» και το «Κανένα γέμισμα» (που **δεν** έχουν χρώμα) να μη χρειάζεται να εφεύρουν
   * τιμή για να αποθηκευτούν.
   */
  readonly set: (hex: string) => void;
  /** Συνδρομή για φύλλα React. */
  readonly subscribe: (listener: () => void) => () => void;
  /** Η προεπιλογή — και η τιμή του server snapshot, ώστε οι δύο αποδόσεις να συμφωνούν. */
  readonly fallback: string;
  /** Μόνο για tests — καθαρίζει και τη σημαία ενυδάτωσης, αλλιώς το επόμενο test κληρονομεί. */
  readonly resetForTest: () => void;
}

function createToolbarColorStore(
  storageKey: string,
  fallback: string,
  role: PlotColorRole,
): ToolbarColorStore {
  /**
   * 🔴 Το `localStorage` διαβάζεται **τεμπέλικα**, όχι στην αρχικοποίηση του module.
   *
   * Ο κώδικας τρέχει και στον server (Next.js): μια ανάγνωση εδώ θα έδινε στον server την
   * προεπιλογή και στον client το αποθηκευμένο ⇒ **hydration mismatch** στο πρώτο render της
   * μπάρας. Το `storageGetString` είναι SSR-safe και επιστρέφει `null` στον server, αλλά το
   * πρόβλημα δεν είναι η ασφάλεια — είναι ότι οι **δύο** αποδόσεις πρέπει να συμφωνούν. Με
   * τεμπέλικη ανάγνωση, η πρώτη κλήση συμβαίνει σε χειρισμό συμβάντος ή σε effect, ποτέ στο
   * αρχικό render του server.
   */
  let hydrated = false;
  const store = createExternalStore<string>(fallback);

  /**
   * Δεκτό μόνο έγκυρο hex — και, **στο μελάνι μόνο**, ό,τι επιβιώνει ως μελάνι: ένα αλλοιωμένο
   * `localStorage` δεν βάφει λευκό σε λευκό. Στο γέμισμα το λευκό είναι θεμιτή επιλογή, οπότε
   * το ίδιο φίλτρο θα απέρριπτε ακριβώς τη σωστή τιμή.
   */
  const sanitize = (raw: string | null): string => {
    if (!raw) return fallback;
    const hex = normalizeHexColor(raw);
    if (!/^#[0-9a-f]{6}$/.test(hex)) return fallback;
    return role === 'ink' && !survivesAsInk(hex) ? fallback : hex;
  };

  const hydrateOnce = (): void => {
    if (hydrated || typeof window === 'undefined') return;
    hydrated = true;
    const stored = sanitize(storageGetString(storageKey));
    if (stored !== store.get()) store.set(stored);
  };

  return {
    get: () => {
      hydrateOnce();
      return store.get();
    },
    set: (hex: string) => {
      hydrateOnce();
      const next = sanitize(hex);
      if (next === store.get()) return;
      store.set(next);
      storageSetString(storageKey, next);
    },
    subscribe: (listener: () => void) => {
      hydrateOnce();
      return store.subscribe(listener);
    },
    fallback,
    resetForTest: () => {
      hydrated = false;
      store.set(fallback);
    },
  };
}

/** Η μνήμη του κουμπιού `A` — χρώμα **κειμένου**. */
export const tableTextColorStore = createToolbarColorStore(
  STORAGE_KEYS.TABLE_TEXT_COLOR,
  DEFAULT_TABLE_TEXT_COLOR,
  'ink',
);

/** Η μνήμη του κουβαδιού — χρώμα **γεμίσματος**. */
export const tableFillColorStore = createToolbarColorStore(
  STORAGE_KEYS.TABLE_FILL_COLOR,
  DEFAULT_TABLE_FILL_COLOR,
  'fill',
);

/**
 * Η μνήμη που αντιστοιχεί σε έναν ρόλο.
 *
 * Ο καταναλωτής είναι **ένα** component με δύο ρόλους: ρωτά εδώ αντί να κρατά
 * `role === 'fill' ? … : …` μέσα στο JSX. Η αντιστοίχιση ανήκει στη μνήμη, όχι στη διεπαφή.
 */
export function toolbarColorStoreFor(role: PlotColorRole): ToolbarColorStore {
  return role === 'fill' ? tableFillColorStore : tableTextColorStore;
}

// ADR-700 §4 (2026-08-24): test helper ΧΩΡΙΣ ΚΑΝΕΝΑ test — διαγράφηκε (ίδιο σχήμα με
// ADR-364 §10.5). Speculative: γράφτηκε «ίδιο μοτίβο με τα αδελφά stores», ποτέ δεν κλήθηκε.
