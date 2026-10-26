/**
 * ADR-650 M2-Β · ADR-920 Β4.8 Γ — το status-prompt του εργαλείου «Γραμμές ασυνέχειας», **παραγόμενο από το store**.
 *
 * Κείμενο = f(τελευταία ενέργεια, ζωντανό πλήθος). Το πλήθος δεν το κρατά ΚΑΝΕΙΣ — διαβάζεται πάντα από το
 * `TopoPointStore`. Πέντε δρόμοι γράφουν ασυνέχειες (κλικ · ribbon «Καθαρισμός» · έγκριση αυτόματων ·
 * επαναφορά επιπέδου · cascade νέας εισαγωγής)· μόνο το κλικ ήξερε να ξαναγράψει το μήνυμα, οπότε τα άλλα
 * τέσσερα άφηναν μπαγιάτικο «σύνολο». Εδώ τους παρακολουθεί ΕΝΑΣ παρατηρητής — κανένας γραφέας δεν καλεί hint.
 *
 * Η ενέργεια είναι εφήμερη: κάθε αλλαγή του πίνακα ασυνεχειών την επαναφέρει στο idle. Το κλικ γράφει
 * τη δική του ΜΕΤΑ τη μετάλλαξη (το notify του store είναι σύγχρονο), άρα κερδίζει χωρίς ειδική περίπτωση.
 *
 * ADR-920 Β3.4 — Revit «το στοιχείο που δημιουργήθηκε δεν είναι ορατό στην όψη»: όσο οι ασυνέχειες είναι
 * κρυμμένες (`topo-breakline-display-store`), το ίδιο μήνυμα τυλίγεται στο `whileHidden` — ο μηχανικός πατά
 * γραμμή και ΞΕΡΕΙ γιατί δεν βλέπει τίποτα. Το εργαλείο ΔΕΝ ανάβει το μάτι μόνο του (Surface ↔ Style: ο
 * ορισμός δεν γράφει την εμφάνιση). Το μάτι αλλάζει με το εργαλείο ενεργό ⇒ ξαναγράφεται, ίδια ενέργεια.
 *
 * @see ../drawing/useTopoBreaklineTool — ο κάτοχος του lifecycle (ξεκινά/σταματά τη συνδρομή)
 */
import { i18n } from '@/i18n';
import { toolHintOverrideStore } from '../toolHintOverrideStore';
import { getTopoBreaklines, subscribeTopo } from '../../systems/topography/TopoPointStore';
import {
  getBreaklineDisplayState, subscribeBreaklineDisplay,
} from '../../systems/topography/topo-breakline-display-store';

const NS = 'dxf-viewer-shell';

export type TopoBreaklineHintKey =
  | 'awaitingEntity'
  | 'addedElevation'
  | 'addedProximity'
  | 'removed'
  | 'needsPoints';

let lastKey: TopoBreaklineHintKey = 'awaitingEntity';

function render(): void {
  const message = i18n.t(`topoBreakline.status.${lastKey}`, { ns: NS, count: getTopoBreaklines().length });
  toolHintOverrideStore.setOverride(
    getBreaklineDisplayState().visible ? message : i18n.t('topoBreakline.status.whileHidden', { ns: NS, message }),
  );
}

/** Το αποτέλεσμα μιας ενέργειας του εργαλείου, με το ζωντανό πλήθος. */
export function showTopoBreaklineHint(key: TopoBreaklineHintKey): void {
  lastKey = key;
  render();
}

/**
 * Ξεκινά το prompt (idle) και το κρατά αληθινό όσο είναι ενεργό το εργαλείο. Ξαναγράφει ΜΟΝΟ όταν αλλάξει
 * ο πίνακας ασυνεχειών (ταυτότητα αναφοράς) — αλλαγή σημείων/ορίου/crop δεν σβήνει το μήνυμα ενέργειας.
 * Επιστρέφει το unsubscribe.
 */
export function startTopoBreaklineHintSync(): () => void {
  let seen = getTopoBreaklines();
  let seenVisible = getBreaklineDisplayState().visible;
  showTopoBreaklineHint('awaitingEntity');
  const unsubscribeTopo = subscribeTopo(() => {
    const current = getTopoBreaklines();
    if (current === seen) return;
    seen = current;
    showTopoBreaklineHint('awaitingEntity');
  });
  // Μόνο το μάτι (όχι η εστίαση): ίδια ενέργεια, ξανατυλιγμένη ή ξετυλιγμένη.
  const unsubscribeDisplay = subscribeBreaklineDisplay(() => {
    const visible = getBreaklineDisplayState().visible;
    if (visible === seenVisible) return;
    seenVisible = visible;
    render();
  });
  return () => { unsubscribeTopo(); unsubscribeDisplay(); };
}
