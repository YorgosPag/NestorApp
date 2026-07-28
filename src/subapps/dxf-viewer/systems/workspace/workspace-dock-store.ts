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
 * ── ΓΙΑΤΙ ΔΕΝ ΕΚΤΙΘΕΤΑΙ `subscribe` ──
 *
 * ADR-040: το πλάτος αλλάζει ~60 φορές/δευτ. κατά το σύρσιμο. Αν υπήρχε συνδρομητής, κάθε
 * pixel θα ξαναρενδάριζε υποδέντρο του viewer. Κατά τη χειρονομία το πλάτος ζει **στο DOM**
 * (η βιβλιοθήκη γράφει `flex-grow`)· το store το μαθαίνει **μία φορά**, στο τέλος. Όταν η Φ2
 * χρειαστεί αντιδραστικό `mode`, ο subscriber θα προστεθεί για το `mode` — **όχι** για το πλάτος.
 *
 * ── ΓΙΑΤΙ ΑΝΑ ΧΡΗΣΤΗ ΚΑΙ ΟΧΙ ΑΝΑ ΕΡΓΟ ──
 *
 * Ίδιο σκεπτικό με το ADR-723: η διάταξη είναι ιδιότητα του χώρου εργασίας του χρήστη (μέγεθος
 * οθόνης, συνήθεια), όχι του σχεδίου. Revit / AutoCAD / Photoshop αποθηκεύουν διάταξη παλετών
 * στο προφίλ — ποτέ στο αρχείο.
 *
 * ⚠️ **Πεδίο `mode` (αγκύρωση αριστερά/δεξιά/αιώρηση): ΔΕΝ υπάρχει ακόμη.** Το ADR-724 §6.1 το
 * περιγράφει ως μέρος αυτού του store, αλλά η Φ1 έχει **μία** δυνατή τιμή (`docked-left`) — ένα
 * πεδίο με μία τιμή είναι νεκρός κώδικας, όχι αρχιτεκτονική. Μπαίνει στη Φ2, μαζί με τον
 * πρώτο πραγματικό αναγνώστη του.
 */

import { createPersistedValue } from '../../stores/createPersistedValue';
import { STORAGE_KEYS } from '../../utils/storage-utils';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
import { clampDockWidth, parseDockWidth } from './workspace-dock-geometry';

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

// ⓘ Δεν υπάρχει `resetDockedWidth`: στη Φ1 η επαναφορά είναι **χειρονομία της βιβλιοθήκης**
// (διπλό κλικ στο διαχωριστικό → `defaultSize`), και το store απλώς ακολουθεί μέσω
// `setDockedWidth`. Ρητή εντολή «Επαναφορά» αποκτά νόημα στη Φ2, μαζί με το μενού αγκύρωσης
// (ADR-724 §7) — τότε προστίθεται μαζί με τον πρώτο καλούντα της, όχι πριν.
