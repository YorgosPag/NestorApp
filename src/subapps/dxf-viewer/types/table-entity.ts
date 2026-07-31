/**
 * ADR-739 Φάση Γ — **η οντότητα πίνακα στη σκηνή** (`TableEntity`).
 *
 * Ό,τι χρειάζεται ένας πίνακας για να ζήσει στον καμβά, **γύρω** από το αναλλοίωτο
 * `TableModel` του `types/table.ts`: πού είναι, πόσο στραμμένος, με ποιο στυλ. Αδελφός
 * των `ScaleBarEntity` / `OpeningInfoTagEntity` (ADR-583 Φ2 / ADR-612): απλό
 * `extends BaseEntity`, ρέει στο generic `Entity[]` της σκηνής, **καμία** εξαγωγή IFC,
 * **κανένα** 3D mesh, **καμία** δική του συλλογή Firestore → σκόπιμα **εκτός**
 * `isBimEntityType`.
 *
 * ## Δύο χώροι μονάδων και **μία** γέφυρα (§4.1 — το μάθημα των ADR-462/716)
 * - Η **διάταξη** (`TableLayout`) είναι σε **sheet-mm**: πλάτη στηλών, ύψη γραμμών,
 *   ύψος κειμένου, πάχη μολυβιού. Χαρτί, όχι κόσμος.
 * - Η **άγκυρα** (`position`) είναι σε **μονάδες σκηνής**.
 * - Η γέφυρα είναι **αποκλειστικά** το `paperHeightToModel(mm, drawingScale, sceneUnits)`
 *   (`utils/annotation-scale.ts`) — το ΙΔΙΟ SSoT που ήδη διπλώνει το πάχος του
 *   scale-bar και το ύψος κάθε διαστασιολόγησης. **Καμία άλλη πολλαπλασιαστική
 *   μετατροπή, πουθενά.** Ο πίνακας είναι δηλαδή **annotative**: σε 1:50 δείχνει το μισό
 *   από ό,τι σε 1:100, ακριβώς όπως κάθε άλλη σημείωση του σχεδίου.
 *
 * ⚠️ Το §4 του ADR έγραφε `rotation: number`. Εδώ λέγεται **`angleRad`** — ίδιο όνομα με
 * τα δύο αδέλφια (`ScaleBarEntity.angleRad`, `OpeningInfoTagEntity.angleRad`), ώστε οι
 * κοινοί μηχανισμοί (`rotateEntityGripDrag`, `rotate-entity`, `scale-entity-transform`)
 * να διαβάζουν **ένα** όνομα σε όλες τις σημειώσεις. Η μονάδα είναι στο όνομα, όπως
 * επιβάλλει το μάθημα του ADR-716.
 *
 * ## Το `geometry` είναι ΠΑΡΑΓΩΓΟ — ποτέ πηγή
 * Πηγή αλήθειας είναι τα `position` / `angleRad` / `styleId` / `model`. Το `geometry`
 * είναι λανθάνουσα μνήμη που ξαναφτιάχνεται από το
 * `computeTableEntityGeometry` — **ποτέ** δεν γράφεται με το χέρι, **ποτέ** δεν
 * ταξιδεύει σε snapshot (ίδια σύμβαση με το `OpeningInfoTagEntity.geometry`).
 *
 * @module subapps/dxf-viewer/types/table-entity
 * @see types/table.ts — το μοντέλο (καθαρό, κοινό στα 4 backends)
 * @see bim/table/table-entity-geometry.ts — η παράγωγη γεωμετρία + frame↔world
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §4, §4.1, §6
 */

import type { Point2D } from '../rendering/types/Types';
import type { BaseEntity } from './entities';
import type { TableBinding, TableBreaking, TableColumnId, TableModel, TableRowId } from './table';
import type { TableLayout } from '../bim/table/table-layout-types';

// ──────────────────────────────────────────────────────────────────────────────
// Παράγωγη γεωμετρία
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Σημείο στο **πλαίσιο του πίνακα**: `u` κατά μήκος του πλάτους, `v` προς τα **κάτω**
 * κατά μήκος του ύψους — και τα δύο σε **sheet-mm από την πάνω-αριστερή γωνία**.
 *
 * Το `+v` δείχνει **κάτω** επειδή αυτό ακριβώς κάνει το `TableLayout` (και ο jsPDF, και
 * το `DetailPrimitive`). Η **μία** αναστροφή προς τη σκηνή (+y πάνω) ζει στο
 * `tableFrameToWorld` και πουθενά αλλού — αν κάθε καταναλωτής έκανε τη δική του, η μισή
 * εφαρμογή θα ζωγράφιζε τον πίνακα ανάποδα.
 */
export interface TableFramePoint {
  readonly u: number;
  readonly v: number;
}

/** Άξονο-ευθυγραμμισμένο κουτί σε μονάδες σκηνής (μετά την περιστροφή) για broad phase. */
export interface TableBBox {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/**
 * Το αποτέλεσμα του `computeTableEntityGeometry`. **Παράγωγο** — οι παράμετροι της
 * οντότητας είναι η πηγή. Τα `widthMm` / `heightMm` του `layout` είναι sheet-mm· ό,τι
 * λέγεται `*World` είναι μονάδες σκηνής.
 */
export interface TableEntityGeometry {
  /** Η διάταξη σε sheet-mm — απομνημονευμένη, **ποτέ** ανά καρέ (§6). */
  readonly layout: TableLayout;
  /**
   * Μονάδες σκηνής ανά sheet-mm — η **μία** γέφυρα (§4.1). Ίσο με
   * `paperHeightToModel(1, drawingScale, sceneUnits)`.
   */
  readonly mmToWorld: number;
  /** Πλάτος/ύψος του πίνακα σε **μονάδες σκηνής** (`layout.*Mm × mmToWorld`). */
  readonly worldWidth: number;
  readonly worldHeight: number;
  /**
   * Οι τέσσερις γωνίες σε μονάδες σκηνής, με τη σειρά **TL → TR → BR → BL**
   * (ξεκινώντας από την άγκυρα, δεξιόστροφα στο πλαίσιο του πίνακα).
   */
  readonly worldCorners: readonly Point2D[];
  /** Το κουτί των τεσσάρων γωνιών — αυτό που βλέπει το marquee και ο δείκτης χώρου. */
  readonly bbox: TableBBox;
}

/** Ταυτότητα κελιού όπως την επιστρέφει ένα hit-test: γραμμή + στήλη + το ορθογώνιό του. */
export interface TableCellHit {
  readonly rowId: TableRowId;
  readonly colId: TableColumnId;
  /** Το ορθογώνιο του κελιού σε sheet-mm (τοπικά, +v κάτω) — έτοιμο για inline editor. */
  readonly rectMm: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
}

// ──────────────────────────────────────────────────────────────────────────────
// Η οντότητα
// ──────────────────────────────────────────────────────────────────────────────

export interface TableEntity extends BaseEntity {
  type: 'table';

  /**
   * Η **πάνω-αριστερή** γωνία του πίνακα σε μονάδες σκηνής — σύμβαση AutoCAD (το
   * `ACAD_TABLE` αγκυρώνει επίσης πάνω-αριστερά). Είναι ταυτόχρονα ο άξονας
   * περιστροφής και η λαβή μετακίνησης.
   *
   * ⚠️ Διαφέρει από το `OpeningInfoTagEntity`, που αγκυρώνει στο **κέντρο**: εκεί το
   * κουτί έχει σταθερές αναλογίες, εδώ ο πίνακας μεγαλώνει προς τα κάτω-δεξιά καθώς
   * προστίθενται γραμμές. Άγκυρα στο κέντρο θα μετακινούσε τον πίνακα σε κάθε νέα
   * γραμμή — ακριβώς ό,τι δεν κάνει κανένα CAD.
   */
  position: Point2D;

  /** Περιστροφή γύρω από την `position`, σε **ακτίνια** (0 = όρθιος). */
  angleRad: number;

  /** Δείκτης στο `TableStyle` SSoT (`tblstyle_*`, βλ. `bim/table/table-style-registry.ts`). */
  styleId: string;

  /** Το περιεχόμενο. Το ΙΔΙΟ `TableModel` που τρέφει PDF / DXF / φύλλα λεπτομερειών. */
  model: TableModel;

  /** Απόν ⇒ `static` (ο χρήστης πληκτρολόγησε τα κελιά). Φ.ΣΤ/Η. */
  binding?: TableBinding;

  /** AutoCAD table breaking. Δηλωμένο από τη Φ.Α· ο καταναλωτής έρχεται με τη Φ.Δ. */
  breaking?: TableBreaking;

  /**
   * ΠΑΡΑΓΩΓΗ λανθάνουσα μνήμη — ποτέ δεν γράφεται με το χέρι, ποτέ δεν αποθηκεύεται.
   * Ξαναϋπολογίζεται από `computeTableEntityGeometry`.
   */
  geometry?: TableEntityGeometry;
}

// ──────────────────────────────────────────────────────────────────────────────
// Προεπιλογές
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Ελάχιστο πλάτος στήλης σε sheet-mm που δέχεται το σύρσιμο λαβής ορίου. Κάτω από
 * αυτό η στήλη παύει να είναι στήλη — δεν χωρά ούτε ένας χαρακτήρας μαζί με τα
 * περιθώριά της.
 */
export const MIN_TABLE_COLUMN_WIDTH_MM = 4;

/** Ελάχιστο ύψος γραμμής σε sheet-mm — ένα κείμενο 2.5mm με μηδενικά περιθώρια. */
export const MIN_TABLE_ROW_HEIGHT_MM = 2.5;

// ──────────────────────────────────────────────────────────────────────────────
// Type guard
// ──────────────────────────────────────────────────────────────────────────────

export const isTableEntity = (e: { type: string }): e is TableEntity => e.type === 'table';
