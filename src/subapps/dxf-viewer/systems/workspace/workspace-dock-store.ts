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
 * ⓘ Το `'floating'` (Φ3) **δεν** είναι ακόμη δυνατή τιμή του `mode` — βλ. `workspace-dock-mode.ts`.
 */

import { clearAllPanelGeometry } from '@/components/ui/floating';
import { createPersistedValue } from '../../stores/createPersistedValue';
import { STORAGE_KEYS } from '../../utils/storage-utils';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
import { clampDockWidth, parseDockWidth } from './workspace-dock-geometry';
import { DOCK_MODE_DEFAULT, parseDockMode, type WorkspaceDockMode } from './workspace-dock-mode';

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
 * Αλλάζει πλευρά. Ίδια τιμή ⇒ πλήρες no-op (ούτε notify ούτε εγγραφή).
 *
 * ⚠️ Το **πλάτος δεν αλλάζει** (ADR-724 §7): αλλάζοντας πλευρά ο χρήστης δεν ζήτησε άλλο
 * μέγεθος. Αυτό είναι και ο λόγος που τα δύο πεδία είναι ανεξάρτητα.
 */
export function setDockMode(mode: WorkspaceDockMode): void {
  dockModeStore.set(mode);
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
  setDockMode(DOCK_MODE_DEFAULT);
  clearAllPanelGeometry();
}
