/**
 * ADR-724 — Το **SSoT** του πλάτους της αγκυρωμένης κύριας παλέτας. Μηδέν React.
 *
 * ── ΓΙΑΤΙ ΔΙΚΟ ΜΑΣ STORE ΚΑΙ ΟΧΙ `useDefaultLayout` ΤΗΣ ΒΙΒΛΙΟΘΗΚΗΣ ──
 *
 * Το `react-resizable-panels` προσφέρει `useDefaultLayout({ storage })`. Απορρίπτεται ρητά
 * (ADR-724 §5.3) για δύο λόγους: (α) θα γινόταν **δεύτερος ιδιοκτήτης** του πλάτους δίπλα σε
 * αυτό εδώ — δύο αλήθειες τη στιγμή της επαναφοράς, δηλαδή το κλασικό «η παλέτα πήδηξε πίσω»·
 * (β) το `Layout` της βιβλιοθήκης είναι **ποσοστά** — αποθηκευμένο 25% δίνει άλλο πλάτος σε
 * άλλη οθόνη, ενώ τα CAD θυμούνται **pixels**.
 *
 * ── ΓΙΑΤΙ `createPersistedValue` ΚΑΙ ΟΧΙ ΧΕΙΡΟΓΡΑΦΟ localStorage ──
 *
 * Το «ενυδάτωση στο init + persist στην αλλαγή + SSR-safe + quota-safe» υπάρχει ήδη ως SSoT
 * factory (συνθέτει `createExternalStore` + `storage-utils`/ADR-092). Δεύτερη υλοποίηση θα
 * ήταν ακριβώς το boilerplate που ο factory υπάρχει για να εξαλείψει (N.12 / N.18).
 *
 * ── ΓΙΑΤΙ ΤΟ ΠΛΑΤΟΣ ΔΕΝ ΕΚΤΙΘΕΤΕΙ `subscribe` ΚΑΙ Η ΠΛΕΥΡΑ ΝΑΙ ──
 *
 * ADR-040: το πλάτος αλλάζει ~60 φορές/δευτ. κατά το σύρσιμο. Αν υπήρχε συνδρομητής, κάθε
 * pixel θα ξαναρενδάριζε υποδέντρο του viewer. Κατά τη χειρονομία το πλάτος ζει **στο DOM**
 * (η βιβλιοθήκη γράφει `flex-grow`)· το store το μαθαίνει **μία φορά**, στο τέλος.
 *
 * Η **πλευρά** (Φ2) είναι το ακριβώς αντίθετο προφίλ: αλλάζει με ένα κλικ στο μενού, ίσως
 * μία φορά στους μήνες, και **πρέπει** να ξαναρενδάρει τη διάταξη. Άρα εκτίθεται
 * {@link subscribeDockMode}. Δύο πεδία, δύο κλειδιά, δύο προφίλ — γι' αυτό **δεν** είναι ένα
 * κοινό record: θα σήμαινε ότι κάθε σύρσιμο ειδοποιεί τους συνδρομητές της πλευράς.
 *
 * ── ΓΙΑΤΙ ΑΝΑ ΧΡΗΣΤΗ ΚΑΙ ΟΧΙ ΑΝΑ ΕΡΓΟ ──
 *
 * Ίδιο σκεπτικό με το ADR-723: η διάταξη είναι ιδιότητα του χώρου εργασίας του χρήστη (μέγεθος
 * οθόνης, συνήθεια), όχι του σχεδίου. Revit / AutoCAD / Photoshop αποθηκεύουν διάταξη παλετών
 * στο προφίλ — ποτέ στο αρχείο.
 *
 * ── ΤΡΙΑ ΠΕΔΙΑ, ΤΡΙΑ ΚΛΕΙΔΙΑ (Φ3) ──
 *
 * `dockedWidth` (χωρίς συνδρομητές, ~60 εγγραφές/δευτ. κατά το σύρσιμο), `mode` (με
 * συνδρομητές, μία εγγραφή στους μήνες) και `lastDockedSide` (χωρίς συνδρομητές, γράφεται
 * **παράπλευρα** στο `mode`). Τρία προφίλ ⇒ τρία κλειδιά. Ένα κοινό record θα σήμαινε ότι κάθε
 * σύρσιμο ειδοποιεί τους συνδρομητές της κατάστασης — το ADR-040 πρόβλημα, από την πίσω πόρτα.
 *
 * ⓘ Η γεωμετρία της παλέτας **όταν αιωρείται** (x/y/w/h) **δεν** ζει εδώ: την κατέχει το
 * ADR-723 (`persistenceKey`), που ήδη κάνει clamp σε κάθε ανάγνωση. Δες ADR-724 §6.1.
 */

import { clearAllPanelGeometry } from '@/components/ui/floating';
import { createPersistedValue } from '../../stores/createPersistedValue';
import { STORAGE_KEYS } from '../../utils/storage-utils';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
import { clampDockWidth, parseDockWidth } from './workspace-dock-geometry';
import {
  DOCK_MODE_DEFAULT,
  DOCKED_SIDE_DEFAULT,
  isFloating,
  parseDockMode,
  parseDockedSide,
  toDockedSide,
  type WorkspaceDockedSide,
  type WorkspaceDockMode,
} from './workspace-dock-mode';

const { WIDTH_DEFAULT } = PANEL_LAYOUT.WORKSPACE_DOCK;

const dockedWidthStore = createPersistedValue<number>(
  STORAGE_KEYS.WORKSPACE_DOCK_WIDTH,
  WIDTH_DEFAULT,
  {
    equals: Object.is,
    // Η προεπιλογή μένει **σιωπηρή**: όποιος δεν έχει αλλάξει πλάτος δεν έχει καθόλου εγγραφή,
    // και μια μελλοντική αλλαγή του `WIDTH_DEFAULT` τον ακολουθεί αντί να τον κλειδώνει στο 384.
    removeOnDefault: true,
    // Η αποθηκευμένη τιμή είναι **ιστορικό**, όχι αλήθεια: μπορεί να γράφτηκε από άλλη έκδοση,
    // σε άλλη οθόνη, ή να έχει αλλοιωθεί. Ποτέ δεν χρησιμοποιείται ωμή.
    validate: (hydrated): number => {
      const parsed = parseDockWidth(hydrated);
      return parsed === null ? WIDTH_DEFAULT : clampDockWidth(parsed);
    },
  },
);

/** Το τρέχον αποθηκευμένο πλάτος, ήδη εντός ορίων. Ασφαλές σε SSR (επιστρέφει την προεπιλογή). */
export function getDockedWidth(): number {
  return dockedWidthStore.get();
}

/**
 * Καταγράφει το πλάτος **στο τέλος** μιας χειρονομίας του χρήστη (pointerup / πλήκτρο).
 *
 * Περνά υποχρεωτικά από {@link clampDockWidth} — ο καλών δίνει ό,τι μέτρησε το DOM, όχι
 * ό,τι είναι αποδεκτό. Ίδια τιμή ⇒ πλήρες no-op (ούτε notify ούτε εγγραφή στο localStorage).
 */
export function setDockedWidth(width: number): void {
  dockedWidthStore.set(clampDockWidth(width));
}

// ============================================================================
// ΠΛΕΥΡΑ ΑΓΚΥΡΩΣΗΣ (ADR-724 Φ2)
// ============================================================================

const dockModeStore = createPersistedValue<WorkspaceDockMode>(
  STORAGE_KEYS.WORKSPACE_DOCK_MODE,
  DOCK_MODE_DEFAULT,
  {
    equals: Object.is,
    // Ίδιο σκεπτικό με το πλάτος: όποιος δεν άλλαξε ποτέ πλευρά δεν έχει καθόλου εγγραφή.
    removeOnDefault: true,
    validate: (hydrated): WorkspaceDockMode => parseDockMode(hydrated) ?? DOCK_MODE_DEFAULT,
  },
);

/** Η τρέχουσα πλευρά αγκύρωσης. Ασφαλές σε SSR (επιστρέφει την προεπιλογή). */
export function getDockMode(): WorkspaceDockMode {
  return dockModeStore.get();
}

/**
 * Η **τελευταία πλευρά** αγκύρωσης — «πού επιστρέφει η παλέτα όταν πάψει να αιωρείται».
 *
 * Δεν εκθέτει `subscribe`: κανείς δεν **ζωγραφίζει** αυτή την τιμή. Διαβάζεται τη στιγμή της
 * μετάβασης (διπλό κλικ επικεφαλίδας) και μόνο τότε. Ένας συνδρομητής θα ήταν συνδρομή σε
 * ιστορικό.
 */
const lastDockedSideStore = createPersistedValue<WorkspaceDockedSide>(
  STORAGE_KEYS.WORKSPACE_DOCK_LAST_SIDE,
  DOCKED_SIDE_DEFAULT,
  {
    equals: Object.is,
    removeOnDefault: true,
    // Στενότερος επικυρωτής από του `mode`: ένα αποθηκευμένο `'floating'` εδώ (από
    // χειροκίνητη αλλοίωση ή από μελλοντικό σχήμα) θα σήμαινε «βγες από την αιώρηση προς την
    // αιώρηση» — δηλαδή ένα διπλό κλικ που δεν κάνει τίποτα. Δες `parseDockedSide`.
    validate: (hydrated): WorkspaceDockedSide => parseDockedSide(hydrated) ?? DOCKED_SIDE_DEFAULT,
  },
);

/** Πού θα επιστρέψει η παλέτα αν ξανα-αγκυρωθεί χωρίς να δηλωθεί πλευρά. */
export function getLastDockedSide(): WorkspaceDockedSide {
  return lastDockedSideStore.get();
}

/**
 * Αλλάζει κατάσταση αγκύρωσης. Ίδια τιμή ⇒ πλήρες no-op (ούτε notify ούτε εγγραφή).
 *
 * ⚠️ Το **πλάτος δεν αλλάζει** (ADR-724 §7): αλλάζοντας πλευρά ο χρήστης δεν ζήτησε άλλο
 * μέγεθος. Αυτό είναι και ο λόγος που τα δύο πεδία είναι ανεξάρτητα.
 *
 * ⚠️ **Η καταγραφή της τελευταίας πλευράς γίνεται ΕΔΩ, όχι στον καλούντα** (Φ3). Υπάρχουν
 * ήδη τρεις ανεξάρτητοι καλούντες (μενού «⋮», μενού δεξιού κλικ, απόθεση σε ζώνη §7.1) και
 * η Φ3 προσθέτει τέταρτο (διπλό κλικ επικεφαλίδας). Αν η καταγραφή ζούσε στον καλούντα, θα
 * αρκούσε **ένας** να την ξεχάσει ώστε η παλέτα να «γυρίζει αριστερά» ανεξήγητα — και το
 * σφάλμα θα φαινόταν μόνο στη διαδρομή που κανείς δεν δοκίμασε. Ένας γράφων, μία εγγύηση.
 */
export function setDockMode(mode: WorkspaceDockMode): void {
  const side = toDockedSide(mode);
  if (side !== null) lastDockedSideStore.set(side);
  dockModeStore.set(mode);
}

/**
 * Εναλλαγή **αγκύρωση ⇄ αιώρηση** — η χειρονομία του διπλού κλικ στην επικεφαλίδα (§8, Revit).
 *
 * Ιδεμποτεντικό ως προς το ζεύγος (δύο κλήσεις = επιστροφή στην αρχική κατάσταση) και
 * **ασύμμετρο ως προς την πληροφορία**: η έξοδος από την αιώρηση χρειάζεται προορισμό, η
 * είσοδος όχι. Γι' αυτό διαβάζει το {@link getLastDockedSide} και όχι κάποια προεπιλογή.
 */
export function toggleDockFloat(): void {
  setDockMode(isFloating(getDockMode()) ? getLastDockedSide() : 'floating');
}

/**
 * Συνδρομή στην πλευρά — **χαμηλής συχνότητας** (κλικ μενού), σε αντίθεση με το πλάτος.
 *
 * Δύο κατηγορίες συνδρομητών, και οι δύο νόμιμες:
 * 1. **leaf components** μέσω `useWorkspaceDock` (`useSyncExternalStore`)·
 * 2. **imperative** ακροατές που ΔΕΝ ξαναρενδάρουν — π.χ. ο καμβάς, που πρέπει απλώς να
 *    ξαναμετρήσει τη θέση του (`useViewportManager`, ADR-724 §4.1 / Α.0).
 */
export const subscribeDockMode = dockModeStore.subscribe;

/**
 * «Εργοστασιακές ρυθμίσεις» της διάταξης — το ισοδύναμο του «Reset palette locations»
 * (AutoCAD) / «Reset Essentials» (Photoshop). ADR-724 §7.
 *
 * Επαναφέρει **και τους δύο** μηχανισμούς του ADR-724 §6.1 σε μία πράξη: την αγκυρωμένη
 * παλέτα (πλάτος + πλευρά) **και** κάθε αιωρούμενη παλέτα (ADR-723). Μερική επαναφορά θα
 * ήταν χειρότερη από καμία: ο χρήστης που «τα έκανε θάλασσα» δεν ξέρει *ποιο* από τα δύο
 * συστήματα του χάλασε τη διάταξη — γι' αυτό η εντολή είναι **μία**.
 *
 * Ιδεμποτεντικό (N.7.2 #3): δεύτερη κλήση δεν αλλάζει τίποτα.
 *
 * ⓘ Οι **ήδη προσαρτημένες** αιωρούμενες παλέτες κρατούν τη θέση τους μέχρι να ξαναστηθούν —
 * το ADR-723 διαβάζει τη γεωμετρία στην αρχικοποίηση, όχι σε κάθε καρέ. Η αγκυρωμένη, που
 * είναι το ορατό 95% της διάταξης, επανέρχεται **αμέσως** (έχει συνδρομητές).
 */
export function resetDockLayout(): void {
  setDockedWidth(WIDTH_DEFAULT);
  // ⚠️ Ρητά **πριν** το `setDockMode`, και ρητά **χωριστά**: το `setDockMode(DOCK_MODE_DEFAULT)`
  // θα έγραφε ούτως ή άλλως την ίδια πλευρά — αλλά **μόνο επειδή** οι δύο προεπιλογές τυχαίνει
  // να συμπίπτουν σήμερα. Αν αύριο το `DOCK_MODE_DEFAULT` γίνει `'floating'`, η σιωπηρή
  // εξάρτηση θα άφηνε την «τελευταία πλευρά» άθικτη — δηλαδή η «Επαναφορά» θα ήταν μερική.
  lastDockedSideStore.set(DOCKED_SIDE_DEFAULT);
  setDockMode(DOCK_MODE_DEFAULT);
  clearAllPanelGeometry();
}
