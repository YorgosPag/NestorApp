/**
 * ADR-739 §43 + §66 — **το πάτημα στο τετραγωνάκι της γωνίας**, ως δικό του module.
 *
 * Εξαγωγή, **όχι κόψιμο**: ο κλάδος ζούσε αυτούσιος μέσα στο `use-table-cell-pointer`, το
 * οποίο ξαναχτύπησε τις 500 γραμμές (N.7.1) όταν η λαβή συμπλήρωσης απέκτησε τον αναγνώστη
 * σκηνής του ADR-828. Καμία γραμμή δεν άλλαξε νόημα — δες τη διπλανή `table-pointer-axis-selection`,
 * που γεννήθηκε από **την ίδια** αιτία και με το ίδιο σχήμα (`handleTableBandMouseDown`).
 *
 * ## 🔑 Γιατί `handle…` και όχι `tryTable…MouseDown`
 * Οι πέντε φρουροί της αλυσίδας (`tryTablePointMode…`, `tryTableFillHandle…`,
 * `tryTableAxisResize…`) απαντούν «**το πήρα;**» — μπορούν να παραιτηθούν. Εδώ η ερώτηση
 * έχει ήδη απαντηθεί από τον έναν αναγνώστη γεωμετρίας (`pointerHit.where`), οπότε το module
 * **δεν κρίνει** αν το συμβάν είναι δικό του: το εκτελεί. Δεύτερη κρίση εδώ θα σήμαινε
 * δεύτερη άποψη για το πού τελειώνει η γωνία.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/table-corner-pointer
 * @see ui/table-cell-editor/table-pointer-axis-selection.ts — η αδελφή εξαγωγή (ζώνες άξονα)
 * @see ui/table-cell-editor/table-move-drag.ts — ποιος οπλίζει τη μετακίνηση της οντότητας
 */

import { installTableCornerMenuSelection } from './table-context-menu-selection';
import {
  claimTableCellPointerGesture,
  claimTableCellSessionPointerDown,
} from './table-cell-session-focus';
import type { TableEntity } from '../../types/table-entity';

export interface TableCornerMouseDownParams {
  readonly entity: TableEntity;
  /** Αριστερό πλήκτρο· `false` σημαίνει δεξί — δες §68 παρακάτω. */
  readonly primary: boolean;
  readonly container: HTMLElement;
  /** §43 + §66 — μαρκάρει όλα τα κελιά **και** οπλίζει τη μετακίνηση. Ένα πάτημα, ένα prop. */
  readonly onCornerPress: (event: MouseEvent, container: HTMLElement) => void;
}

/**
 * 🔴 ADR-739 §43 — **ΤΟ ΤΕΤΡΑΓΩΝΑΚΙ ΤΗΣ ΓΩΝΙΑΣ**: όλα τα κελιά, με ένα κλικ (Excel parity).
 * 🔴 §66 — **και η μετακίνηση του πίνακα**, όταν το χέρι σύρει αντί να πατήσει.
 */
export function handleTableCornerMouseDown(
  event: MouseEvent,
  { entity, primary, container, onCornerPress }: TableCornerMouseDownParams,
): void {
  claimTableCellSessionPointerDown();
  // §27.15 — και η χειρονομία, όπως στη ζώνη: η δήλωση φυλάει τη σύρση επιλογής κελιών από
  // το body-drag του ADR-560. ⚠️ §66: **δεν** είναι αυτή που εμποδίζει τη μετακίνηση εδώ —
  // το §29 σβήνει το hover, άρα το body-drag είναι ήδη δομικά αδύνατο σε λειτουργία πίνακα.
  claimTableCellPointerGesture();

  // 🔴 §68 — το δεξί **εγκαθιστά τον στόχο του** και παραδίδεται. Η πράξη ήταν ήδη εδώ, ένα
  // στρώμα πιο πάνω (μέσα στη θύρα του μενού)· κατέβηκε ώστε **και οι τρεις** διαδρομές
  // δεξιού κλικ να γράφουν στο ίδιο σημείο. Δες την κεφαλίδα του module.
  if (!primary) {
    installTableCornerMenuSelection(entity);
    return;
  }

  // 🔑 **ΚΑΜΙΑ δέσμευση προχείρου εδώ** — και είναι μετρημένο, όχι παράλειψη: το `Ctrl+A`
  // δεν δεσμεύει (`use-table-cell-session-keys`, `case 'selectAll'`), γιατί η επιλογή είναι
  // κατάσταση **διεπαφής** και δεν αγγίζει το μοντέλο (§6.6) — ούτε μετακινεί τον δρομέα,
  // άρα το πρόχειρο μένει εκεί που το άφησε ο χρήστης. Ένα `onCommitPending()` εδώ θα έκανε
  // τη γωνία να συμπεριφέρεται **αλλιώς από το ίδιο της το πλήκτρο**. Το ίδιο ισχύει και για
  // τη μετακίνηση: αλλάζει τη **θέση** της οντότητας, όχι κελί.
  onCornerPress(event, container);
}
