/**
 * ADR-723 — Μόνιμη γεωμετρία παλέτας: **μία** πόρτα ανάγνωσης/εγγραφής για ΟΛΕΣ τις
 * floating παλέτες της εφαρμογής.
 *
 * ── ΓΙΑΤΙ ΕΔΩ ΚΑΙ ΟΧΙ ΣΤΟ SUBAPP ──
 *
 * Το `FloatingPanel` είναι κοινό primitive (`src/components/ui/floating`) με **17** καταναλωτές,
 * εκ των οποίων ένας (`GlobalPerformanceDashboard`) ζει **εκτός** του DXF subapp. Αν το persist
 * έμπαινε στο `subapps/dxf-viewer/stores/createPersistedValue`, το κοινό primitive θα εισήγαγε
 * subapp — αντιστροφή επιπέδων. Άρα χρησιμοποιείται το κοινό
 * `@/lib/storage` (`safeGetItem` / `safeSetItem`), που είναι ο SSR-safe + quota-safe SSoT
 * του **κοινού** επιπέδου.
 *
 * ── ΓΙΑΤΙ ΑΝΑ ΧΡΗΣΤΗ ΚΑΙ ΟΧΙ ΑΝΑ ΕΡΓΟ ──
 *
 * Η θέση μιας παλέτας είναι ιδιότητα του **χώρου εργασίας** του χρήστη (μέγεθος οθόνης,
 * συνήθεια, δεξιόχειρας/αριστερόχειρας), όχι του σχεδίου. Revit, AutoCAD και Photoshop
 * αποθηκεύουν layout παλετών στο προφίλ/workspace — **ποτέ** στο αρχείο. Το ίδιο εδώ:
 * localStorage ανά περιηγητή, ουδέτερο ως προς έργο/όροφο.
 *
 * ── ΓΙΑΤΙ ΔΕΝ ΕΠΙΣΤΡΕΦΕΤΑΙ ΠΟΤΕ ΩΜΗ Η ΑΠΟΘΗΚΕΥΜΕΝΗ ΤΙΜΗ ──
 *
 * Δες {@link floating-panel-geometry}. Η αποθηκευμένη θέση είναι **ιστορικό**, όχι αλήθεια: η
 * οθόνη μπορεί να έχει αλλάξει. Ο καλών περνά πάντα από `clampPanelGeometry` με το τρέχον
 * viewport. Εδώ γίνεται μόνο ο έλεγχος **σχήματος**.
 */

import { safeGetItem, safeSetItem, safeRemoveItem, safeRemoveItemsByPrefix } from '@/lib/storage';
import { parsePanelGeometry, type PanelGeometry } from './floating-panel-geometry';

/**
 * Πρόθεμα κλειδιού, **με έκδοση σχήματος**.
 *
 * Το `v1` δεν είναι διακοσμητικό: αν αύριο η γεωμετρία αποκτήσει πεδίο (π.χ. `docked`,
 * `collapsed`), το `v2` αγνοεί σιωπηλά τα παλιά record αντί να τα διαβάσει μισά. Η εναλλακτική
 * — migration κώδικας για δεδομένα διάταξης — κοστίζει περισσότερο απ' όσο αξίζει: το χειρότερο
 * που παθαίνει ο χρήστης είναι μία παλέτα στην προεπιλεγμένη θέση.
 */
const GEOMETRY_KEY_PREFIX = 'nestor:floating-panel-geometry:v1:';

/**
 * Ταυτότητα παλέτας μέσα στο persist namespace.
 *
 * Σύμβαση ονοματοδοσίας: `<subapp>.<panel>` (π.χ. `dxf.layer-manager`). Σταθερή για πάντα —
 * αλλαγή του id ισοδυναμεί με «ξέχασε τη θέση όλων των χρηστών».
 */
export type FloatingPanelId = string;

function keyFor(panelId: FloatingPanelId): string {
  return `${GEOMETRY_KEY_PREFIX}${panelId}`;
}

/**
 * Διαβάζει την αποθηκευμένη γεωμετρία, ή `null` αν δεν υπάρχει / είναι κατεστραμμένη.
 *
 * ⚠️ Το αποτέλεσμα **δεν** είναι έτοιμο για χρήση: πέρασέ το από `clampPanelGeometry` με το
 * τρέχον viewport πριν το εφαρμόσεις.
 */
export function readPanelGeometry(panelId: FloatingPanelId): PanelGeometry | null {
  // `safeGetItem` με object fallback κάνει JSON.parse και επιστρέφει το fallback σε κάθε
  // σφάλμα (SSR, corrupt JSON, storage κλειδωμένο) — άρα το `null` εδώ σημαίνει «τίποτα
  // αξιοποιήσιμο», χωρίς try/catch στο call site.
  const raw = safeGetItem<unknown>(keyFor(panelId), null);
  return parsePanelGeometry(raw);
}

/**
 * Γράφει τη γεωμετρία. Σιωπηλά no-op σε SSR ή γεμάτο quota — η θέση μιας παλέτας δεν αξίζει
 * ούτε exception ούτε toast.
 */
export function writePanelGeometry(panelId: FloatingPanelId, geometry: PanelGeometry): void {
  safeSetItem(keyFor(panelId), geometry);
}

/**
 * Σβήνει την αποθηκευμένη γεωμετρία ⇒ η επόμενη εμφάνιση χρησιμοποιεί τις προεπιλογές.
 *
 * Το ισοδύναμο του «Reset palette locations» (AutoCAD) / «Reset Essentials» (Photoshop):
 * η μία εντολή που πρέπει να υπάρχει όταν ο χρήστης έχει μπερδέψει τη διάταξή του.
 */
export function clearPanelGeometry(panelId: FloatingPanelId): void {
  safeRemoveItem(keyFor(panelId));
}

/**
 * Σβήνει τη γεωμετρία **ΟΛΩΝ** των παλετών ⇒ η επόμενη εμφάνιση καθεμιάς χρησιμοποιεί τις
 * προεπιλογές της. Επιστρέφει πόσες καθαρίστηκαν.
 *
 * ── ΓΙΑΤΙ ΧΡΕΙΑΖΕΤΑΙ ΞΕΧΩΡΙΣΤΗ ΣΥΝΑΡΤΗΣΗ ──
 *
 * Το {@link clearPanelGeometry} απαιτεί `panelId`. Ο καλών της «Επαναφοράς» (ADR-724 §7) **δεν
 * μπορεί να ξέρει** τη λίστα: τα ids δηλώνονται από 17 ανεξάρτητους καταναλωτές, ένας από τους
 * οποίους ζει εκτός του DXF subapp. Ένα χειρόγραφο μητρώο ids στο call site θα ξεχνούσε σιωπηλά
 * κάθε νέα παλέτα — και η σιωπή είναι ακριβώς ο τρόπος που «Επαναφορά» γίνεται ψέμα.
 *
 * Το πρόθεμα **είναι** ήδη το μητρώο: ό,τι έγραψε το {@link writePanelGeometry} το φέρει. Άρα
 * η ερώτηση απαντιέται εκεί που ζει το πρόθεμα — εδώ — και όχι στον καλούντα.
 *
 * ⓘ Σβήνει μόνο το τρέχον `:v1` namespace: εγγραφές παλαιότερου σχήματος είναι ήδη νεκρές
 * (κανείς δεν τις διαβάζει) και δεν αξίζει να μαντέψουμε προθέματα που δεν ελέγχουμε.
 */
export function clearAllPanelGeometry(): number {
  return safeRemoveItemsByPrefix(GEOMETRY_KEY_PREFIX);
}
