/**
 * ADR-739 Φ.Γ — **οι 8 περιμετρικές λαβές του πίνακα** (4 γωνιακές + 4 μεσοπλευρικές).
 *
 * Giorgio 2026-08-03 («οι λαβές όπως σου τις δείχνω»): ο πίνακας απέκτησε το ΙΔΙΟ λεξιλόγιο
 * κουτιού με την εικόνα (ADR-654) και το block (ADR-641) — γωνία = 2-DOF με την **αντίθετη
 * γωνία σταθερή**, ακμή = 1-άξονα με την **αντίθετη ακμή σταθερή**.
 *
 * ## Γιατί ξεχωριστό αρχείο και όχι επέκταση του `table-entity-grips.ts`
 * Εκείνο απαντά «**πού** είναι οι λαβές»· εδώ απαντιέται «**τι σημαίνει** να τις σύρεις».
 * Η δεύτερη ερώτηση φέρνει τον adapter πλαισίου + την κλιμάκωση μοντέλου, που μαζί θα
 * διπλασίαζαν το αρχείο (N.7.1). **Καμία** νέα γεωμετρία γεννιέται εδώ: το ορθογώνιο
 * περιγράφεται με το κοινό `RectFrame` και το resize τρέχει στον κοινό `rect-grip-engine` —
 * τον ίδιο κώδικα που κινεί τοίχο, κολόνα, εικόνα και block (N.18).
 *
 * ## Τι σημαίνει «resize» σε πίνακα
 * Ο πίνακας **δεν έχει** `width`/`height` ως παραμέτρους: το `layout.widthMm` είναι το
 * άθροισμα των πλατών στηλών και το `layout.heightMm` των υψών γραμμών. Άρα ένα σύρσιμο
 * κουτιού μεταφράζεται σε **αναλογική κλιμάκωση**:
 *   - οριζόντια → κάθε στήλη παίρνει ρητό `sizing: fixed` (ίδια σημασιολογία με το
 *     υπάρχον σύρσιμο ορίου στήλης: «το σύρσιμο **κλειδώνει** πλάτος», Figma Auto Layout)·
 *   - κατακόρυφα → κάθε γραμμή παίρνει ρητό `heightMm` (το πεδίο υπήρχε ήδη στο μοντέλο).
 *
 * Οι λόγοι `sx`/`sy` βγαίνουν από τον engine και είναι **scale-free** — ο `mmToWorld` είναι
 * κοινός παράγοντας και απλοποιείται — άρα το drag δεν διαβάζει καμία κλίμακα, ίδιο μοτίβο
 * με το `scale-bar-height`.
 *
 * ⚠️ Ο κανόνας «καμία λαβή ανάλογη των δεδομένων» (ADR-735) **μένει ακέραιος**: αυτές είναι
 * **8 σταθερές** λαβές, όχι μία ανά γραμμή. Το ύψος **μιας** γραμμής εξακολουθεί να αλλάζει
 * μόνο από τον επεξεργαστή κελιού της Φ.Δ.
 *
 * @module subapps/dxf-viewer/bim/table/table-box-grips
 * @see bim/grips/rect-frame.ts — RectFrame + corner/edge world readers (κοινά)
 * @see bim/grips/rect-grip-engine.ts — opposite-corner-fixed resize (κοινό)
 * @see bim/image/image-grips.ts — ο άμεσος αδελφός (flat params αντί για διάταξη)
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §8
 */

import type { Point2D } from '../../rendering/types/Types';
import type { TableBoxGripKind } from '../../hooks/grip-kinds-primitives';
import type { TableEntity, TableEntityGeometry } from '../../types/table-entity';
import {
  MIN_TABLE_COLUMN_WIDTH_MM,
  MIN_TABLE_ROW_HEIGHT_MM,
} from '../../types/table-entity';
import type { TableLayout } from './table-layout-types';
import { computeTableEntityGeometryLive, tableFrameToWorld } from './table-entity-geometry';
import {
  rectCornerWorld,
  rectEdgeWorld,
  type RectCorner,
  type RectEdge,
  type RectFrame,
} from '../grips/rect-frame';
import {
  applyRectCornerDrag,
  applyRectEdgeDrag,
  type RectResizeLimits,
} from '../grips/rect-grip-engine';

// ──────────────────────────────────────────────────────────────────────────────
// kind → στόχος στο τοπικό πλαίσιο
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Ποιο σημείο του `RectFrame` πιάνει κάθε λαβή.
 *
 * Το πλαίσιο του πίνακα μετρά `+u` δεξιά και `+v` **κάτω** από την πάνω-αριστερή άγκυρα,
 * ενώ το `RectFrame` είναι κεντραρισμένο με `+Y` **πάνω** — η αναστροφή γίνεται μία φορά,
 * στο {@link tableRectFrame}. Μετά από αυτήν τα local πρόσημα διαβάζονται όπως παντού:
 * **ne = πάνω-δεξιά, nw = πάνω-αριστερά (η ΑΓΚΥΡΑ), sw = κάτω-αριστερά, se = κάτω-δεξιά**.
 *
 * `Record<TableBoxGripKind, …>` ⇒ ο compiler απαιτεί εγγραφή για **κάθε** νέο kind: μια
 * λαβή δεν μπορεί να γεννηθεί χωρίς να δηλώσει τι πιάνει.
 */
export const TABLE_BOX_TARGETS: Readonly<Record<TableBoxGripKind, RectCorner | RectEdge>> = {
  'table-corner-ne': { sx: 1, sy: 1 },
  'table-corner-nw': { sx: -1, sy: 1 },
  'table-corner-sw': { sx: -1, sy: -1 },
  'table-corner-se': { sx: 1, sy: -1 },
  'table-edge-n': { axis: 'y', sign: 1 },
  'table-edge-e': { axis: 'x', sign: 1 },
  'table-edge-s': { axis: 'y', sign: -1 },
  'table-edge-w': { axis: 'x', sign: -1 },
};

/**
 * Η **σειρά** με την οποία εκπέμπονται οι 8 λαβές — δηλαδή οι δείκτες τους (`gripIndex`).
 * Ζει δίπλα στο {@link TABLE_BOX_TARGETS} ώστε τα δύο να μη μπορούν να ξεχαστούν χωριστά·
 * ένα anchor test επιβεβαιώνει ότι καλύπτει **ακριβώς** τα κλειδιά του πίνακα στόχων.
 * Πρώτα οι 4 γωνίες (δομικές, πάντα ορατές), μετά οι 4 ακμές (gated από την προτίμηση
 * «Midpoints») — ίδια διάταξη με εικόνα / block.
 */
export const TABLE_BOX_KIND_ORDER: readonly TableBoxGripKind[] = [
  'table-corner-ne',
  'table-corner-nw',
  'table-corner-sw',
  'table-corner-se',
  'table-edge-n',
  'table-edge-e',
  'table-edge-s',
  'table-edge-w',
];

/** Η γωνία του πλαισίου που **είναι** η άγκυρα του πίνακα (πάνω-αριστερά, τοπικά −X/+Y). */
export const TABLE_ANCHOR_CORNER: RectCorner = { sx: -1, sy: 1 };

/** Η θέση σκηνής μιας λαβής κουτιού — η **ίδια** έκφραση που θα δει και ο engine στο drag. */
export function tableBoxGripPosition(frame: RectFrame, kind: TableBoxGripKind): Point2D {
  const target = TABLE_BOX_TARGETS[kind];
  return isRectEdge(target) ? rectEdgeWorld(frame, target) : rectCornerWorld(frame, target);
}

/** `true` για μεσοπλευρικό στόχο. Διακρίνει τα δύο μέλη της ένωσης χωρίς cast. */
function isRectEdge(target: RectCorner | RectEdge): target is RectEdge {
  return 'axis' in target;
}

/** `true` αν το kind ανήκει στο λεξιλόγιο κουτιού (γωνία ή ακμή). */
export function isTableBoxGripKind(kind: string): kind is TableBoxGripKind {
  return Object.prototype.hasOwnProperty.call(TABLE_BOX_TARGETS, kind);
}

// ──────────────────────────────────────────────────────────────────────────────
// Ο adapter πλαισίου
// ──────────────────────────────────────────────────────────────────────────────

/**
 * `TableEntity` → `RectFrame` (κεντραρισμένο, μονάδες σκηνής).
 *
 * Η άγκυρα είναι η **πάνω-αριστερή** γωνία και η περιστροφή γίνεται γύρω από αυτήν, οπότε
 * το κέντρο είναι το σημείο πλαισίου `(W/2, H/2)` περασμένο από την ίδια — και **μόνη** —
 * μετατροπή που χρησιμοποιούν ο ζωγράφος και το hit-test ({@link tableFrameToWorld}).
 * Δεύτερη έκφραση του ίδιου κέντρου θα ήταν ακριβώς η απόκλιση που το §4.1 απαγορεύει.
 *
 * Το αντίστροφο είναι `rectCornerWorld(frame, TABLE_ANCHOR_CORNER)`.
 */
export function tableRectFrame(entity: TableEntity, geometry: TableEntityGeometry): RectFrame {
  const { layout, mmToWorld, worldWidth, worldHeight } = geometry;
  return {
    center: tableFrameToWorld(entity, layout.widthMm / 2, layout.heightMm / 2, mmToWorld),
    rotationDeg: (entity.angleRad * 180) / Math.PI,
    halfWidth: worldWidth / 2,
    halfLength: worldHeight / 2,
  };
}

/**
 * Τα όρια συρρίκνωσης σε μονάδες σκηνής: «**κάθε** στήλη/γραμμή στο ελάχιστό της».
 *
 * Χτισμένα από τα ίδια `MIN_TABLE_COLUMN_WIDTH_MM` / `MIN_TABLE_ROW_HEIGHT_MM` που φυλάει
 * ήδη το σύρσιμο ορίου στήλης — ένα δεύτερο κατώφλι εδώ θα σήμαινε ότι ο πίνακας έχει άλλο
 * ελάχιστο ανάλογα με **ποια** λαβή τον συρρίκνωσε.
 */
function tableResizeLimits(layout: TableLayout, mmToWorld: number): RectResizeLimits {
  return {
    minHalfWidth: (layout.columns.length * MIN_TABLE_COLUMN_WIDTH_MM * mmToWorld) / 2,
    minHalfLength: (layout.rows.length * MIN_TABLE_ROW_HEIGHT_MM * mmToWorld) / 2,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Η κλιμάκωση του μοντέλου
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Τα πλάτη στηλών **κλειδωμένα** στο `sx`-πλάσιο των τρεχόντων. Οι στήλες που δεν
 * εμφανίζονται στη διάταξη (δεν συμβαίνει σε υγιές μοντέλο) μένουν άθικτες αντί να
 * μαντέψουμε πλάτος γι' αυτές.
 */
function scaleColumns(entity: TableEntity, layout: TableLayout, sx: number): TableEntity['model']['columns'] {
  const widthById = new Map(layout.columns.map((c) => [c.id, c.widthMm]));
  return entity.model.columns.map((col) => {
    const widthMm = widthById.get(col.id);
    if (widthMm === undefined) return col;
    return {
      ...col,
      sizing: {
        kind: 'fixed' as const,
        widthMm: Math.max(widthMm * sx, MIN_TABLE_COLUMN_WIDTH_MM),
      },
    };
  });
}

/**
 * Τα ύψη γραμμών **ρητά**, στο `sy`-πλάσιο των τρεχόντων. Το τρέχον ύψος διαβάζεται από τη
 * **διάταξη** (όπου το `row.heightMm ?? style.defaultRowHeightMm` έχει ήδη επιλυθεί) και όχι
 * από το μοντέλο: αλλιώς μια γραμμή που κληρονομεί ύψος από την κλάση της θα κλιμακωνόταν
 * από το `undefined`.
 */
function scaleRows(entity: TableEntity, layout: TableLayout, sy: number): TableEntity['model']['rows'] {
  const heightById = new Map(layout.rows.map((r) => [r.id, r.heightMm]));
  return entity.model.rows.map((row) => {
    const heightMm = heightById.get(row.id);
    if (heightMm === undefined) return row;
    return { ...row, heightMm: Math.max(heightMm * sy, MIN_TABLE_ROW_HEIGHT_MM) };
  });
}

/**
 * Το κλιμακωμένο μοντέλο, ή `null` όταν **κανένας** άξονας δεν άλλαξε.
 *
 * Οι δύο άξονες κλιμακώνονται **ανεξάρτητα**, και αυτό είναι ουσιώδες: το
 * `applyRectEdgeDrag` επιστρέφει το ανέγγιχτο μισό **κατά ταυτότητα** (`{...frame, center,
 * halfLength}`), άρα ένα κατακόρυφο σύρσιμο δίνει `sx === 1` **ακριβώς** — όχι «περίπου».
 * Χωρίς αυτόν τον έλεγχο, τραβώντας την κάτω ακμή θα μετατρέπαμε σιωπηλά κάθε `hug`/`fill`
 * στήλη σε `fixed`, δηλαδή θα παγώναμε πλάτη που ο χρήστης δεν άγγιξε.
 */
function scaleTableModel(
  entity: TableEntity,
  layout: TableLayout,
  sx: number,
  sy: number,
): TableEntity['model'] | null {
  if (sx === 1 && sy === 1) return null;
  return {
    ...entity.model,
    ...(sx === 1 ? {} : { columns: scaleColumns(entity, layout, sx) }),
    ...(sy === 1 ? {} : { rows: scaleRows(entity, layout, sy) }),
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Ο μετασχηματισμός
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Το params patch ενός συρσίματος γωνιακής/μεσοπλευρικής λαβής — **καθαρό**, ώστε να το
 * τρέχουν κατά ταυτότητα και το commit και το ζωντανό φάντασμα («προεπισκόπηση ≡ commit»).
 *
 * ## Λόγος πλευρών (Giorgio 2026-08-03)
 * **ΕΛΕΥΘΕΡΟΣ** εξ ορισμού· το **Shift τον ΚΛΕΙΔΩΝΕΙ**. Είναι η **αντίστροφη** πολικότητα
 * από την εικόνα (ADR-654), και σκόπιμα: μια φωτογραφία που παραμορφώνεται είναι σφάλμα,
 * ένας πίνακας που αλλάζει πλάτος χωρίς να ψηλώσει είναι η **κανονική** πράξη — Excel και
 * AutoCAD δεν κλειδώνουν αναλογία σε πίνακα. Το `shiftHeld` το περνούν **και οι δύο** καλούντες
 * διαβάζοντας το ίδιο `ShiftKeyTracker` SSoT.
 *
 * ## Πότε η γωνία δεν ακολουθεί τον κέρσορα 1:1
 * Όταν μια **μεμονωμένη** στήλη/γραμμή χτυπήσει το ελάχιστό της ενώ το σύνολο έχει ακόμη
 * περιθώριο, το `Math.max` την κρατά και ο πίνακας βγαίνει ελαφρώς πλατύτερος από το κουτί
 * που ζήτησε ο κέρσορας. Αυτό είναι η **ίδια** ανοχή που έχει ήδη ο engine στο clamp
 * recovery — προτιμότερη από στήλη που εξαφανίζεται.
 */
export function applyTableBoxDrag(
  kind: TableBoxGripKind,
  entity: TableEntity,
  delta: Point2D,
  shiftHeld?: boolean,
): Partial<TableEntity> {
  const geometry = computeTableEntityGeometryLive(entity);
  const { layout } = geometry;
  const frame = tableRectFrame(entity, geometry);
  // Εκφυλισμένος πίνακας (καμία στήλη/γραμμή, ή μηδενική κλίμακα): δεν υπάρχει λόγος να
  // διατηρηθεί — και θα διαιρούσαμε με το μηδέν παρακάτω.
  if (frame.halfWidth <= 0 || frame.halfLength <= 0) return {};

  const target = TABLE_BOX_TARGETS[kind];
  const limits = tableResizeLimits(layout, geometry.mmToWorld);
  const next = isRectEdge(target)
    ? applyRectEdgeDrag(frame, target, delta, limits)
    // `ortho: undefined` — ο πίνακας δεν δεσμεύεται σε άξονα από το F8 (εικόνα parity).
    : applyRectCornerDrag(frame, target, delta, limits, undefined, shiftHeld);

  const model = scaleTableModel(
    entity,
    layout,
    next.halfWidth / frame.halfWidth,
    next.halfLength / frame.halfLength,
  );
  return {
    position: rectCornerWorld(next, TABLE_ANCHOR_CORNER),
    ...(model ? { model } : {}),
  };
}
