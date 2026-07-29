/**
 * ADR-724 — Ο κανόνας πλάτους της **αγκυρωμένης** κύριας παλέτας. Καθαρές συναρτήσεις.
 *
 * ── ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟ ΑΡΧΕΙΟ ΑΠΟ ΤΟ STORE ──
 *
 * Το store (`workspace-dock-store.ts`) κρατά **μια τιμή** και την επιμένει· ο *κανόνας* για το
 * τι είναι αποδεκτή τιμή έχει **τρεις** καταναλωτές που δεν έχουν κοινό γονέα: (α) η ενυδάτωση
 * από το localStorage, (β) κάθε `setDockedWidth` στο τέλος χειρονομίας, (γ) — από τη Φ3 — η
 * μετάβαση από αιωρούμενη σε αγκυρωμένη. Τρία αντίγραφα του ίδιου clamp αποκλίνουν σιωπηλά:
 * ακριβώς το σχήμα που ανέλυσε το ADR-723 για τη γεωμετρία των floating παλετών.
 *
 * Framework-free επίτηδες (μηδέν React / DOM) ⇒ πλήρως ελέγξιμο με jest χωρίς jsdom.
 *
 * ── ΠΟΙΟΣ **ΔΕΝ** ΕΠΙΒΑΛΛΕΤΑΙ ΕΔΩ: ΤΟ ΚΑΤΩ ΟΡΙΟ ΤΟΥ ΚΑΜΒΑ ──
 *
 * Το «ο καμβάς ποτέ κάτω από `CANVAS_MIN_WIDTH`» **δεν** υλοποιείται σε αυτό το αρχείο. Το
 * επιβάλλει η ίδια η βιβλιοθήκη διάταξης, μέσω `minSize` στο *panel του καμβά* — δηλαδή ο
 * περιορισμός ζει στο σημείο που **γνωρίζει** το διαθέσιμο πλάτος τη στιγμή του συρσίματος.
 * Αν τον αντιγράφαμε κι εδώ θα είχαμε δύο ιδιοκτήτες του ίδιου ορίου, που θα διαφωνούσαν σε
 * κάθε αλλαγή μεγέθους παραθύρου (το store δεν βλέπει viewport). Ένας κανόνας, ένας κάτοχος.
 *
 * @see ../../config/panel-tokens — `PANEL_LAYOUT.WORKSPACE_DOCK` (οι τιμές)
 * @see ../../../../components/ui/floating/floating-panel-geometry — ο αδελφός κανόνας για τις αιωρούμενες
 */

import {
  clampPanelGeometry,
  DEFAULT_MIN_PANEL_SIZE,
  type PanelGeometry,
  type ViewportSize,
} from '@/components/ui/floating';
import { clamp } from '../../utils/scalar-math';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
import type { WorkspaceDockedSide } from './workspace-dock-mode';

const { WIDTH_DEFAULT, WIDTH_MIN, WIDTH_MAX } = PANEL_LAYOUT.WORKSPACE_DOCK;

/**
 * Περιορίζει ένα πλάτος στο `[WIDTH_MIN, WIDTH_MAX]`.
 *
 * Μη-πεπερασμένη ή μη-θετική τιμή **δεν** «διορθώνεται» προς το πλησιέστερο όριο: επιστρέφεται
 * η προεπιλογή. Ένα `NaN` που θα γινόταν `280` θα έκρυβε ότι η πηγή του είναι χαλασμένη — ενώ
 * `384` είναι η ουδέτερη, αναγνωρίσιμη «δεν ξέρω» απάντηση (ίδιο δόγμα με το
 * `parsePanelGeometry` του ADR-723).
 */
export function clampDockWidth(width: number): number {
  if (!Number.isFinite(width) || width <= 0) return WIDTH_DEFAULT;
  return clamp(width, WIDTH_MIN, WIDTH_MAX);
}

/**
 * Επικυρώνει **άγνωστο** δεδομένο (JSON από localStorage, παλιότερο σχήμα) ως πλάτος.
 *
 * Επιστρέφει `null` σε ό,τι δεν είναι πεπερασμένος θετικός αριθμός — ο καλών οφείλει να πέσει
 * πίσω στην προεπιλογή. Χωριστό από το {@link clampDockWidth} επειδή «η αποθήκευση είναι άδεια/
 * κατεστραμμένη» και «ο χρήστης ζήτησε 5000px» είναι διαφορετικά γεγονότα, ακόμη κι αν
 * καταλήγουν στην ίδια ενέργεια.
 */
export function parseDockWidth(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  return value;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADR-724 Φ3 — ΟΙ ΚΑΝΟΝΕΣ ΜΕΤΑΒΑΣΗΣ (§7) ΚΑΙ ΟΙ ΖΩΝΕΣ ΑΠΟΘΕΣΗΣ (§7.1)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Το ορθογώνιο του **χώρου εργασίας** — δηλαδή η περιοχή που μοιράζονται παλέτα και καμβάς,
 * σε συντεταγμένες viewport.
 *
 * ⚠️ **Δεν** είναι το viewport. Ο viewer κάθεται μέσα στο κέλυφος της εφαρμογής (αριστερή
 * ράγα πλοήγησης, γραμμή εργαλείων, γραμμή κατάστασης). Αν οι ζώνες απόθεσης μετρούσαν από την
 * ακμή του **παραθύρου**, η αριστερή ζώνη θα έπεφτε πάνω στη ράγα — ο χρήστης θα «αγκύρωνε»
 * αφήνοντας την παλέτα πάνω σε άσχετο χειριστήριο.
 */
export interface WorkspaceRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Πόσο «σηκώνεται» η παλέτα όταν αιωρηθεί χωρίς αποθηκευμένη θέση.
 *
 * Μηδενική μετατόπιση θα ήταν **χειρότερη από άσχημη**: η παλέτα θα εμφανιζόταν ακριβώς πάνω
 * στο περίγραμμα που μόλις εγκατέλειψε, οπότε η μετάβαση θα φαινόταν σαν να **μην έγινε
 * τίποτα**. Οι 24px είναι η μικρότερη μετατόπιση που διαβάζεται ως «βγήκε από τη ροή» και
 * ταυτόχρονα κρατά την παλέτα στη θέση που την περιμένει το μάτι (πρακτική Revit/Photoshop:
 * «lift», όχι «τηλεμεταφορά»).
 */
export const FLOAT_SPAWN_OFFSET = 24;

/**
 * Πλάτος της ζώνης αγκύρωσης στις ακμές του χώρου εργασίας (ADR-724 §7.1, κανόνας Revit).
 *
 * 64px = περίπου ο αντίχειρας σε trackpad· αρκετά φαρδιά ώστε να χτυπιέται χωρίς ακρίβεια,
 * αρκετά στενή ώστε να μη «ρουφά» μια παλέτα που ο χρήστης θέλει απλώς κοντά στην ακμή.
 */
export const DOCK_DROP_ZONE_WIDTH = 64;

/**
 * **docked → floating**: η γεωμετρία εκκίνησης της αιωρούμενης παλέτας.
 *
 * ⚠️ Χρησιμοποιείται **μόνο όταν δεν υπάρχει αποθηκευμένη γεωμετρία** (ADR-724 §7: «η
 * αποθηκευμένη νικά» — συμπεριφορά Revit). Αυτό **δεν** ελέγχεται εδώ και δεν πρέπει: το
 * `useFloatingPanelGeometry` (ADR-723) προτιμά ήδη το αποθηκευμένο έναντι του
 * `defaultPosition`/`defaultSize`. Ένας δεύτερος έλεγχος εδώ θα ήταν δεύτερος ιδιοκτήτης του
 * ίδιου κανόνα — ακριβώς το σχήμα που το ADR-723 υπάρχει για να αποτρέψει.
 *
 * ── ΓΙΑΤΙ ΔΕΝ ΜΕΤΡΑΕΙ ΤΟ DOM ──
 *
 * Το «τρέχον rect της αγκυρωμένης παλέτας» είναι **ήδη γνωστό**: είναι το `dockedWidth` του
 * store, στην πλευρά `side`, σε όλο το ύψος του χώρου εργασίας. Μια μέτρηση θα απαιτούσε να
 * κρατηθεί το rect **πριν** την αλλαγή κατάστασης (μεταβατική κατάσταση που ζει ανάμεσα σε δύο
 * renders) — δηλαδή θα εισήγαγε ακριβώς το είδος στιγμιαίας κατάστασης που δεν έχει ιδιοκτήτη.
 * Ο υπολογισμός είναι καθαρή συνάρτηση των τιμών που **ήδη** έχουν ιδιοκτήτη.
 *
 * Το αποτέλεσμα περνά υποχρεωτικά από το `clampPanelGeometry` του ADR-723 — τον **ίδιο**
 * κανόνα ορίων που θα εφαρμοστεί και στο σύρσιμο. Δεύτερη υλοποίηση clamp εδώ θα ήταν το
 * τεκμηριωμένο «palette lost off-screen» (N.18 / CHECK 3.28).
 */
export function dockToFloatGeometry(params: {
  readonly side: WorkspaceDockedSide;
  readonly dockedWidth: number;
  readonly workspace: WorkspaceRect;
  readonly viewport: ViewportSize;
}): PanelGeometry {
  const { side, dockedWidth, workspace, viewport } = params;
  const width = clampDockWidth(dockedWidth);

  // Η μετατόπιση γίνεται **προς το εσωτερικό** του χώρου εργασίας και στις δύο πλευρές: μια
  // σταθερή «+24 δεξιά» θα έσπρωχνε τη δεξιά παλέτα εκτός οθόνης (και θα τη διέσωζε το clamp,
  // δηλαδή θα κατέληγε κολλητά στην ακμή — ορατή ασυμμετρία ανάμεσα στις δύο πλευρές).
  const x = side === 'docked-right'
    ? workspace.left + workspace.width - width - FLOAT_SPAWN_OFFSET
    : workspace.left + FLOAT_SPAWN_OFFSET;

  return clampPanelGeometry(
    {
      x,
      y: workspace.top + FLOAT_SPAWN_OFFSET,
      width,
      height: Math.max(
        DEFAULT_MIN_PANEL_SIZE.height,
        workspace.height - FLOAT_SPAWN_OFFSET * 2,
      ),
    },
    viewport,
  );
}

/**
 * **floating → docked** (§7.1): σε ποια πλευρά θα αγκυρώσει η παλέτα αν αφεθεί εδώ.
 *
 * `null` ⇒ καμία ζώνη· η παλέτα μένει αιωρούμενη.
 *
 * ── ΓΙΑΤΙ «ΠΛΗΣΙΕΣΤΕΡΗ ΑΚΜΗ» ΚΑΙ ΟΧΙ ΣΕΙΡΑ ΠΡΟΤΕΡΑΙΟΤΗΤΑΣ ──
 *
 * Όταν ο χώρος εργασίας είναι στενότερος από `2 × DOCK_DROP_ZONE_WIDTH` (128px) οι δύο ζώνες
 * **επικαλύπτονται**. Ένα `if (αριστερή) … else if (δεξιά)` θα έδινε πάντα «αριστερά» σε όλο
 * το πλάτος — δηλαδή η δεξιά αγκύρωση θα γινόταν σιωπηλά **απροσπέλαστη** σε στενή οθόνη. Η
 * σύγκριση αποστάσεων απαντά σωστά σε **κάθε** πλάτος και δεν έχει ειδική περίπτωση.
 *
 * Ισοπαλία (ο δείκτης ακριβώς στο μέσο) ⇒ αριστερά, που είναι η προεπιλογή του συστήματος.
 */
export function resolveDropTarget(
  pointerX: number,
  workspace: WorkspaceRect,
): WorkspaceDockedSide | null {
  if (!Number.isFinite(pointerX) || workspace.width <= 0) return null;

  const distanceToLeft = pointerX - workspace.left;
  const distanceToRight = workspace.left + workspace.width - pointerX;

  // Έξω από τον χώρο εργασίας (αρνητική απόσταση) ⇒ καμία αγκύρωση: ο χρήστης έσυρε την
  // παλέτα σε άλλο κομμάτι της εφαρμογής, δεν σημάδεψε ακμή.
  if (distanceToLeft < 0 || distanceToRight < 0) return null;

  const inLeftZone = distanceToLeft <= DOCK_DROP_ZONE_WIDTH;
  const inRightZone = distanceToRight <= DOCK_DROP_ZONE_WIDTH;
  if (!inLeftZone && !inRightZone) return null;
  if (inLeftZone && inRightZone) {
    return distanceToLeft <= distanceToRight ? 'docked-left' : 'docked-right';
  }
  return inLeftZone ? 'docked-left' : 'docked-right';
}

