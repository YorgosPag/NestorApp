'use client';

/**
 * 🔴 ADR-828 **Φ4α** — **ΟΙ ΔΥΟ ΠΟΡΤΕΣ ΤΟΥ ΚΟΥΜΠΙΟΥ «ΕΠΙΛΟΓΕΣ ΑΥΤΟΜΑΤΗΣ ΣΥΜΠΛΗΡΩΣΗΣ»**: το
 * πάτημα και το `Alt+↓`. Και οι δύο ανοίγουν **το ίδιο** μενού, στο **ίδιο** παγωμένο σχέδιο.
 *
 * ## 🔴 ΜΗΔΕΝ ΝΕΕΣ ΔΙΑΔΡΟΜΕΣ — ΚΑΙ ΕΙΝΑΙ ΟΛΟ ΤΟ ΕΠΙΧΕΙΡΗΜΑ ΤΟΥ ΑΡΧΕΙΟΥ
 * Δεν γεννιέται εδώ **τίποτα** από όσα φαίνονται καινούρια:
 *
 * | «νέο» πράγμα | ποιος το είχε ήδη |
 * |---|---|
 * | το μενού και τα items | `ui/components/table-fill-menu/` (Φ3) |
 * | «ποιες εντολές έχουν νόημα;» | `tableFillMenuOffer` — **μία** ανίχνευση, ένα πέρασμα |
 * | η εγγραφή στο μοντέλο | `commitTableFill` — η **ΜΙΑ**, κοινή με τα δύο συρσίματα |
 * | η θύρα προς το μενού | `table-fill-menu-port` (Φ3) |
 * | πηγή / στόχος / γεμισμένη περιοχή | `table-fill-badge-store` — παγωμένα από τη χειρονομία |
 *
 * Άρα αυτό το module έχει **ένα** καθήκον: *«έφτασε αίτημα — είναι το κουμπί ακόμη αληθινό, και
 * πού ακριβώς να ανοίξει το μενού;»*. Ό,τι άλλο θα ήταν δεύτερη ανάγνωση της σκηνής ή δεύτερη
 * διαδρομή εγγραφής, δηλαδή δεύτερη ευκαιρία να διαφωνήσει το μενού με τη συμπλήρωση που
 * βλέπει ο άνθρωπος στην οθόνη.
 *
 * ## 🔴 ΓΙΑΤΙ Ο ΦΡΟΥΡΟΣ ΤΟΥ ΠΑΤΗΜΑΤΟΣ ΤΡΕΧΕΙ **ΠΡΙΝ** ΑΠΟ ΕΚΕΙΝΟΝ ΤΗΣ ΛΑΒΗΣ
 * Είναι η πιο **ειδική** περίπτωση: το κουμπί ζει μόνο μετά από συμπλήρωση, η λαβή ζει πάντα.
 * Η σειρά όμως **δεν λύνει διεκδίκηση** και δεν επιτρέπεται να χρειαστεί να τη λύσει: τα δύο
 * χειριστήρια είναι **χωρικά ξένα** κατά κατασκευή (`TABLE_FILL_BADGE_GAP_PX` > η εξωτερική
 * εμβέλεια της λαβής, κλειδωμένο με test). Γράφεται ως δήλωση προτεραιότητας, για την ημέρα
 * που κάποιος μεγαλώσει το ένα από τα δύο — και για να είναι η **ίδια** σειρά με εκείνη του
 * δείκτη, όπως απαιτεί το ADR-739 §31 (*ο δείκτης δεν ψεύδεται*).
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/table-fill-badge-press
 * @see bim/table/table-fill-badge.ts — πού κάθεται, και πότε είναι ακόμη αληθινό
 * @see ui/table-cell-editor/table-fill-handle-drag.ts — η **ΜΙΑ** εγγραφή (`commitTableFill`)
 * @see docs/centralized-systems/reference/adrs/ADR-828-table-autofill-series.md §8
 */

import {
  resolveTableFillBadgeBounds,
  tableFillBadgeHitAtFrame,
  tableFillBadgeRectMm,
} from '../../bim/table/table-fill-badge';
import { tableFrameClientPoint } from '../../bim/table/table-frame-screen';
import { tableFillMenuOffer, tableFillSourceTexts } from '../../bim/table/table-fill-plan';
import { autoFillListCandidates } from '../../settings/auto-fill-lists';
import { resolveTableModel } from '../../bim/table/table-model-helpers';
import {
  commitTableFill,
  tableFillFrameBasis,
  tableFillPressFrame,
  type TableFillHandlePress,
  type TableFillWriter,
} from './table-fill-handle-drag';
import { getTableFillMenuPort } from './table-fill-menu-port';
import {
  claimTableCellPointerGesture,
  claimTableCellSessionPointerDown,
} from './table-cell-session-focus';
import { getTableFillBadge, type TableFillBadgeState } from '../../state/table-fill-badge-store';
import type { TableCellCursorState } from '../../state/table-cell-cursor-store';
import type { TableEntity } from '../../types/table-entity';
import type { Point2D, ViewTransform } from '../../rendering/types/Types';

/**
 * 🔴 **Ο ΦΡΟΥΡΟΣ ΤΟΥ ΠΑΤΗΜΑΤΟΣ.** `true` ⇒ αυτό το πάτημα ήταν το κουμπί· το κατανάλωσε
 * ολόκληρο και ο καλών οφείλει να σταματήσει εκεί.
 *
 * `false` ⇒ ο κανονικός δρόμος τρέχει αυτούσιος. Η άρνηση είναι η **συνηθισμένη** έκβαση.
 *
 * ## Μόνο αριστερό πλήκτρο, και δεν είναι παράλειψη
 * Η λαβή δίπλα δέχεται **δύο** πλήκτρα επειδή έχει δύο νοήματα (το αριστερό γράφει την
 * προεπιλογή, το δεξί ρωτά). Το κουμπί έχει **ένα**: *ρωτά*. Ένα δεξί κλικ πάνω του δεν έχει
 * δεύτερη σημασία να προσφέρει, οπότε αφήνεται στον καμβά — όπου σημαίνει pan, όπως παντού
 * αλλού (υβριδική συμπεριφορά BricsCAD, δες `table-fill-menu-port`).
 */
export function tryTableFillBadgeMouseDown(
  event: MouseEvent,
  press: TableFillHandlePress,
): boolean {
  if (event.button !== 0) return false;
  const badge = getTableFillBadge();
  const filled = resolveTableFillBadgeBounds(press.entity, press.cursor, badge);
  if (!filled || !badge) return false;

  const probe = tableFillPressFrame(press);
  if (!tableFillBadgeHitAtFrame(probe.layout, probe.frame, probe.pxPerMm, filled)) return false;

  // 🔴 ADR-754 §14.9.3 — **οι δηλώσεις μετά την τελευταία άρνηση, ποτέ πριν.** Μια δήλωση πάνω
  // από έναν έλεγχο που μπορεί να γυρίσει `false` επιζεί ως σκέτο κλείδωμα του body-drag
  // (ADR-560) για χειρονομία που κανείς δεν ανέλαβε.
  claimTableCellSessionPointerDown();
  claimTableCellPointerGesture();
  openBadgeMenu(press.entity, badge, press, { x: event.clientX, y: event.clientY });
  return true;
}

/** Ό,τι χρειάζεται το πληκτρολόγιο για να ανοίξει το μενού **στη θέση του κουμπιού**. */
export interface TableFillBadgeKeyRequest {
  /** Η **ζωντανή** οντότητα — ίδια ανάγνωση με αυτή που ζωγράφισε το κουμπί. */
  readonly entity: TableEntity;
  readonly cursor: TableCellCursorState | null;
  /** Ο καμβάς, για τη μετάφραση σε συντεταγμένες παραθύρου. */
  readonly container: HTMLElement;
  readonly transform: ViewTransform;
  readonly writer: TableFillWriter;
}

/**
 * 🔴 **Η ΔΙΑΔΡΟΜΗ ΠΛΗΚΤΡΟΛΟΓΙΟΥ (`Alt+↓`) — ΕΔΩ ΞΕΠΕΡΝΑΜΕ ΤΟ EXCEL.**
 *
 * Το Excel **δεν έχει καμία** συντόμευση προς αυτό το κουμπί (επιβεβαιωμένο σε δύο ανεξάρτητες
 * αναζητήσεις): υπάρχουν `Ctrl+D` / `Ctrl+R` για fill down/right και `Ctrl+E` για Flash Fill,
 * αλλά για τις **επιλογές** της συμπλήρωσης ο μόνος δρόμος είναι το ποντίκι. Δηλαδή ολόκληρη
 * η «Συμπλήρωση καθημερινών» είναι απρόσιτη χωρίς χέρι στο ποντίκι.
 *
 * ## Γιατί `Alt+↓` και όχι κάτι δικό μας
 * Είναι η σύμβαση των Windows και του WAI-ARIA APG για «*άνοιξε το dropdown αυτού που είναι
 * εστιασμένο*», και το **ίδιο** πλήκτρο που το Excel χρησιμοποιεί ήδη για το dropdown
 * επικύρωσης δεδομένων και το μενού AutoFilter — δηλαδή ο χρήστης το ξέρει ήδη **από το ίδιο
 * το φύλλο**. Δεν συγκρούεται με τίποτα: ο κλάδος `altKey` του `table-cell-key-intent` δέχεται
 * μόνο `Alt+Enter` και όλα τα υπόλοιπα περνούσαν ως `passthrough`.
 *
 * ## 🔴 ΤΟ ΜΕΝΟΥ ΑΝΟΙΓΕΙ ΣΤΟ ΚΟΥΜΠΙ, ΟΧΙ ΣΤΟΝ ΔΕΙΚΤΗ
 * Ένα μενού πληκτρολογίου αγκυρωμένο στο ποντίκι θα εμφανιζόταν σε άσχετο σημείο της οθόνης —
 * ή, χειρότερα, εκεί που έτυχε να μείνει ο δείκτης πριν από λεπτά. Γι' αυτό η θέση προβάλλεται
 * από τη **γεωμετρία του ίδιου του κουμπιού**, με την αλυσίδα του `table-frame-screen`: το
 * μενού βγαίνει ακριβώς εκεί που θα έβγαινε αν είχε πατηθεί με το χέρι, και σε **στραμμένο**
 * πίνακα το ίδιο.
 *
 * `false` ⇒ δεν υπάρχει κουμπί αυτή τη στιγμή· το πλήκτρο δεν καταναλώθηκε και ο καλών οφείλει
 * να το αφήσει να συνεχίσει τον φυσικό του δρόμο.
 */
export function tryOpenTableFillBadgeMenuByKey(request: TableFillBadgeKeyRequest): boolean {
  const badge = getTableFillBadge();
  const filled = resolveTableFillBadgeBounds(request.entity, request.cursor, badge);
  if (!filled || !badge) return false;

  const basis = tableFillFrameBasis(request.entity, request.transform.scale);
  const rect = tableFillBadgeRectMm(basis.layout, filled, basis.pxPerMm);
  if (!rect) return false;

  // Το **κέντρο** της ζωγραφισμένης πλάκας: το μόνο σημείο που μένει «πάνω στο κουμπί» όσο κι
  // αν αλλάξει το μέγεθός του, και το ίδιο που θα διάλεγε ένα test για να το σημαδέψει.
  const at = tableFrameClientPoint(
    request.entity,
    rect.x + rect.w / 2,
    rect.y + rect.h / 2,
    basis.mmToWorld,
    request.container,
    request.transform,
  );
  openBadgeMenu(request.entity, badge, request.writer, at);
  return true;
}

/**
 * Η **μία** εντολή ανοίγματος, κοινή στις δύο πόρτες.
 *
 * ⚠️ Ο στόχος **παγώνει εδώ** (πηγή, προσφορά, πράξη), αλλά η **πράξη** διαβάζει τη σκηνή τη
 * στιγμή του πατήματος και όχι τώρα: ανάμεσα στο άνοιγμα και στην επιλογή χωρά ολόκληρο
 * `Ctrl+Z`. Ο κανόνας ζει μέσα στην `commitTableFill` και δεν ξαναγράφεται εδώ.
 */
function openBadgeMenu(
  entity: TableEntity,
  badge: TableFillBadgeState,
  writer: TableFillWriter,
  at: Point2D,
): void {
  const model = resolveTableModel(entity.model);
  getTableFillMenuPort()?.open(at.x, at.y, {
    offer: tableFillMenuOffer(model, badge.source, badge.target, autoFillListCandidates()),
    seeds: tableFillSourceTexts(model, badge.source),
    apply: (mode) => commitTableFill(writer, badge.source, badge.target, mode),
  });
}
