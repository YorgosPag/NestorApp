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
 * @see ../drawing/useTopoBreaklineTool — ο κάτοχος του lifecycle (ξεκινά/σταματά τη συνδρομή)
 */
import { i18n } from '@/i18n';
import { toolHintOverrideStore } from '../toolHintOverrideStore';
import { getTopoBreaklines, subscribeTopo } from '../../systems/topography/TopoPointStore';

const NS = 'dxf-viewer-shell';

export type TopoBreaklineHintKey =
  | 'awaitingEntity'
  | 'addedElevation'
  | 'addedProximity'
  | 'removed'
  | 'needsPoints';

let lastKey: TopoBreaklineHintKey = 'awaitingEntity';

function render(): void {
  toolHintOverrideStore.setOverride(
    i18n.t(`topoBreakline.status.${lastKey}`, { ns: NS, count: getTopoBreaklines().length }),
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
  showTopoBreaklineHint('awaitingEntity');
  return subscribeTopo(() => {
    const current = getTopoBreaklines();
    if (current === seen) return;
    seen = current;
    showTopoBreaklineHint('awaitingEntity');
  });
}
