/**
 * ADR-739 Φάση Γ — **ο ζωγράφος του πίνακα** στον κύριο 2D καμβά.
 *
 * Καθαρό φύλλο: καμία συνδρομή σε store (ADR-040), καμία γεωμετρία δική του. Ό,τι
 * ζωγραφίζει βγαίνει από τη **μία** μηχανή διάταξης μέσω του
 * `computeTableEntityGeometryLive` — άρα ο ζωγράφος, το hit-test, οι λαβές και η εξαγωγή
 * διαβάζουν **το ίδιο αντικείμενο** και δεν μπορούν να αποκλίνουν.
 *
 * ## Οι δύο κανόνες απόδοσης που τηρούνται εδώ, και το κόστος τους αν σπάσουν
 * 1. **Η διάταξη ΔΕΝ τρέχει ανά καρέ.** Το `resolveTableLayout` είναι απομνημονευμένο με
 *    κλειδί την ταυτότητα του μοντέλου· ένα pan/zoom δεν την αγγίζει καν, γιατί η διάταξη
 *    είναι σε sheet-mm και η κλίμακα μπαίνει μόνο ως πολλαπλασιαστής στο τέλος.
 * 2. **Ορατές γραμμές μόνο, δυαδικά** (`visibleRowRange` + `visibleHorizontals`). Γραμμική
 *    σάρωση 500 γραμμών ανά καρέ είναι ακριβώς το σχήμα O(zoom²) που ο **ADR-735** πλήρωσε
 *    σε παραγωγή (62.500 περιττές δεσμεύσεις ανά κλήση). Το παράθυρο υπολογίζεται
 *    αντιστρέφοντας τις **τέσσερις γωνίες του καμβά** στο πλαίσιο του πίνακα — O(1) και
 *    σωστό υπό οποιαδήποτε περιστροφή, σε αντίθεση με μια απλή σύγκριση y.
 *
 * @see bim/table/table-entity-geometry.ts — η παράγωγη γεωμετρία (SSoT μονάδων/πλαισίου)
 * @see bim/table/table-render-index.ts — το ευρετήριο ορατότητας περιγραμμάτων
 * @see rendering/entities/OpeningInfoTagRenderer.ts — ο αδελφός που καθρεφτίζει
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §6
 */

import { BaseEntityRenderer } from './BaseEntityRenderer';
import type { EntityModel, Point2D, GripInfo, RenderOptions } from '../types/Types';
import type { Entity } from '../../types/entities';
import type { SceneUnits } from '../../utils/scene-units';
import type { TableEntity, TableEntityGeometry } from '../../types/table-entity';
import { isTableEntity } from '../../types/table-entity';
import {
  computeTableEntityGeometryLive,
  tableFrameToWorld,
  tablePxPerMm,
  tableWorldToFrame,
} from '../../bim/table/table-entity-geometry';
import { visibleRowRange } from '../../bim/table/table-layout';
import {
  tableRenderIndex,
  visibleHorizontals,
  type TableRenderIndex,
} from '../../bim/table/table-render-index';
import { hitTestTable } from '../../bim/table/table-entity-hit';
import { getTableGrips, tableGripCustomColor } from '../../bim/table/table-entity-grips';
import type { TableCellLayout, TableLayout, TableRectMm } from '../../bim/table/table-layout-types';
import {
  createStampTableContext,
  stampTableBorders,
  stampTableCellCursor,
  stampTableModeOutline,
  stampTableFills,
  stampTableSelection,
  stampTableText,
  type StampTableContext,
  type TableCellRef,
} from './table/stamp-table-layout';
// ADR-739 Φ.Δ βήμα 8 — ΠΟΙΑ κελιά είναι μαρκαρισμένα. Καθαρό SSoT, κοινό με την
// αντιγραφή/επικόλληση και τη γραμμή κατάστασης: ο ζωγράφος δεν κρίνει, ρωτά.
import {
  resolveTableSelectionBounds,
  tableRangeMembership,
  tableRangeRectMm,
  type TableRangeMembership,
} from '../../bim/table/table-cell-range';
import { resolveTableModel } from '../../bim/table/table-model-helpers';
// ADR-739 Φ.Δ βήμα 7 — ο δείκτης πίνακα (AutoCAD `TABLEINDICATOR`) + η ονομασία των
// υποδιαιρέσεών του. Η ονομασία ζει στο `bim/`, η ζωγραφική εδώ — ίδιος διαχωρισμός με
// τη διάταξη και τον ζωγράφο της.
import { stampTableIndicator } from './table/stamp-table-indicator';
// 🔴 ADR-739 §36 ΦΑΣΗ 3 — η προεπισκόπηση της μεταφοράς περιοχής. Ίδιος κανόνας με τον δρομέα
// και το hover: getter τη στιγμή του καρέ (ADR-040), καμία συνδρομή.
import { stampTableRangeGhost } from './table/stamp-table-range-ghost';
import { getTableRangeTransferPreview } from '../../state/table-range-transfer-store';
// 🔴 ADR-754 Β1 — τα χρωματιστά περιγράμματα των αναφορών του τύπου που γράφεται. **Κανένα
// νέο store**: οι αναφορές είναι παράγωγο του προχείρου, που ταξιδεύει ήδη μέσα στον δρομέα
// (δες την κεφαλίδα του `table-formula-reference-spans`).
// 🔴 ADR-754 — οι δύο επικαλύψεις των τύπων (Β1 περιγράμματα, Γ4 λαβή). Ζουν χωριστά γιατί
// είναι οι μόνες που ρωτούν **μοντέλο και δρομέα μαζί** — δες την κεφαλίδα τους.
import {
  stampTableFillHandleOverlay,
  stampTableFormulaReferenceOverlay,
} from './table/table-formula-overlays';
import { tableColumnTicks, tableRowTicks } from '../../bim/table/table-cell-reference';
// ADR-739 Φ.Δ βήμα 2 — ο δρομέας διαβάζεται με getter τη στιγμή του καρέ (ADR-040), ποτέ
// ως συνδρομή: ο ζωγράφος μένει καθαρό φύλλο.
import { getTableCellCursor, type TableCellCursorState } from '../../state/table-cell-cursor-store';
// ADR-739 §30 — η λωρίδα κάτω από το ποντίκι, με τον ΙΔΙΟ κανόνα: getter τη στιγμή του
// καρέ, καμία συνδρομή. Ο γραφέας ζητά καρέ μόνο όταν αλλάζει υποδιαίρεση.
import { getTableIndicatorHover } from '../../state/table-indicator-hover-store';
// 🔴 ADR-739 §40 — το ⊕ της εισαγωγής (Word parity): ζωγραφίζεται σε **επιλογή** και σε
// λειτουργία πίνακα, γι' αυτό ζει έξω από το `if (cursor)`.
import { getTableInsertControl } from '../../state/table-insert-control-store';
import { stampTableInsertControl } from './table/stamp-table-insert-control';
import { gripGlyphShape } from '../../bim/grips/grip-glyph-registry';
import { gripKindOf } from '../../hooks/grip-kinds';
import { toRenderGripInfo } from './shared/grip-utils';

/**
 * ADR-739 Φ.Δ βήμα 3 — ποιο κελί **δεν** ζωγραφίζει ο καμβάς.
 *
 * Μόνο σε κατάσταση γραφής (`enter` / `edit`). Σε `nav` το `<input>` είναι διαφανές και
 * χωρίς κέρσορα — αν παραλείπαμε και τότε, το κελί θα φαινόταν **άδειο** μόλις πατούσες
 * `Tab` πάνω του, δηλαδή θα «έσβηνε» κείμενο που κανείς δεν άλλαξε.
 */
function editedCellRef(cursor: TableCellCursorState | null): TableCellRef | null {
  if (!cursor || cursor.mode === 'nav') return null;
  return { rowId: cursor.position.rowId, colId: cursor.position.colId };
}

/**
 * 🔴 ADR-739 §41 — **το ορθογώνιο του ενεργού κελιού**, σε sheet-mm· `undefined` όταν ο
 * δρομέας δείχνει κελί εκτός του ορατού παραθύρου.
 *
 * Η αναζήτηση περνά από το **ήδη υπολογισμένο** ευρετήριο (`cellsByRowId`): O(στήλες) αντί
 * για γραμμική σάρωση όλων των κελιών σε κάθε καρέ — το μάθημα του ADR-735.
 *
 * ## Γιατί έπαψε να είναι μέθοδος που **ζωγραφίζει**
 * Ήταν `drawCellCursor`, δηλαδή «βρες το κελί **και** βάψ' το». Από τη στιγμή που το ίδιο
 * ορθογώνιο έγινε **και** η τρύπα της σκίασης (`stampTableSelection`), το «βρες» απέκτησε
 * δεύτερο καταναλωτή — και μια δεύτερη αναζήτηση θα ήταν ακριβώς το sibling clone που πιάνει
 * το CHECK 3.28 (N.18), με το επιπλέον ρίσκο να απαντήσει **αλλιώς** μέσα στο ίδιο καρέ.
 * Καθαρή συνάρτηση, όχι μέθοδος: δεν αγγίζει τίποτα του `this`.
 *
 * Το `undefined` (αντί `null`) είναι σκόπιμο — ταιριάζει με την **προαιρετική** παράμετρο
 * του `stampTableSelection`, όπου «δεν υπάρχει ενεργό κελί» σημαίνει «σκίασε τα πάντα».
 */
function activeCellRectOf(
  cursor: TableCellCursorState,
  index: TableRenderIndex,
): TableRectMm | undefined {
  const bucket = index.cellsByRowId.get(cursor.position.rowId);
  return bucket?.find((c) => c.colId === cursor.position.colId)?.rect;
}

export class TableRenderer extends BaseEntityRenderer {
  /**
   * Το σύστημα μονάδων της σκηνής — ο πίνακας είναι **annotative**, όπως το πάχος του
   * scale-bar (mirror `ScaleBarRenderer.setSceneUnits`). Το προωθεί το
   * `EntityRendererComposite.setSceneUnits`.
   */
  private _sceneUnits: SceneUnits = 'mm';

  setSceneUnits(units: SceneUnits): void {
    this._sceneUnits = units;
  }

  render(entity: EntityModel, options: RenderOptions = {}): void {
    if (!isTableEntity(entity as Entity)) return;
    const e = entity as unknown as TableEntity;
    this.renderWithPhases(entity, options, () => this.drawTable(e, options.selected === true));
  }

  /** Γεμίσματα → πλέγμα → κείμενο (→ δρομέας), μόνο για ό,τι φαίνεται. */
  private drawTable(e: TableEntity, selected: boolean): void {
    const geometry = computeTableEntityGeometryLive(e, this._sceneUnits);
    const { layout } = geometry;
    if (layout.rows.length === 0) return;

    const window = this.visibleFrameWindow(e, geometry);
    const { start, end } = visibleRowRange(layout, window.topMm, window.bottomMm);
    if (start >= end) return;

    const index = tableRenderIndex(layout);
    const cells: TableCellLayout[] = [];
    for (let i = start; i < end; i++) {
      const bucket = index.cellsByRowId.get(layout.rows[i].id);
      if (bucket) cells.push(...bucket);
    }

    // ADR-739 Φ.Δ βήμα 8 — **εργοστάσιο, όχι κυριολεκτικό αντικείμενο**: η γωνία κειμένου
    // παράγεται από το ίδιο το `toScreen` μέσα στο `createStampTableContext`, μία φορά ανά
    // καρέ. Ο ζωγράφος δεν την **ξέρει** και άρα δεν μπορεί να αποκλίνει από την προβολή.
    const rc = createStampTableContext({
      ctx: this.ctx,
      toScreen: (u: number, v: number): Point2D =>
        this.worldToScreen(tableFrameToWorld(e, u, v, geometry.mmToWorld)),
      pxPerMm: tablePxPerMm(geometry.mmToWorld, this.transform.scale),
      // 🔴 ADR-739 §41 — από τη **γεωμετρία**, ποτέ δεύτερη κλήση `liveTableSurfaceHex()`: η
      // διάταξη μόλις έβαψε τα κελιά με αυτή την επιφάνεια και η σκίαση επιλογής οφείλει να
      // δει την ίδια. Δεύτερη ανάγνωση = δεύτερο `getComputedStyle` ανά πίνακα ανά καρέ.
      surfaceHex: geometry.surfaceHex,
      // Η φάση (hover/επιλογή) έχει ήδη θέσει το `strokeStyle`· όταν είναι η κανονική
      // φάση, το `undefined` αφήνει τα χρώματα του στυλ να περάσουν αυτούσια.
      phaseColor: this.tablePhaseColor(),
    });

    // ΕΝΑ σημείο απόφασης για τον δρομέα: και «ποιο κελί πλαισιώνεται» και «ποιο κελί δεν
    // ζωγραφίζεται» βγαίνουν από την ίδια ανάγνωση — δύο αναγνώσεις θα μπορούσαν να δουν
    // διαφορετική κατάσταση μέσα στο ίδιο καρέ.
    const cursor = selected ? this.cursorOf(e.id) : null;
    // 🔴 ADR-739 §41 — **ΜΙΑ** αναζήτηση του ενεργού κελιού, **δύο** καταναλωτές: η τρύπα της
    // σκίασης και ο δρομέας. Δύο αναζητήσεις θα ήταν δύο ευκαιρίες να απαντήσουν αλλιώς μέσα
    // στο ίδιο καρέ — δηλαδή σκίαση που τρυπά ένα κελί ενώ το πλαίσιο στέκεται σε άλλο.
    const activeCellRect = cursor ? activeCellRectOf(cursor, index) : undefined;

    stampTableFills(rc, cells);
    // ADR-739 Φ.Δ βήμα 8 — η επιλογή **πάνω από τα γεμίσματα, κάτω από το πλέγμα και το
    // κείμενο**: είναι ημιδιαφανής, οπότε ένα στρώμα πάνω από τα γράμματα θα τα θόλωνε —
    // και η επιλογή υπάρχει ακριβώς για να διαβάσεις τι μάρκαρες.
    const selection = cursor ? this.selectionOf(e, cursor, layout) : null;
    if (selection) stampTableSelection(rc, selection.rectMm, activeCellRect);
    stampTableBorders(rc, visibleHorizontals(index, window.topMm, window.bottomMm));
    stampTableBorders(rc, index.verticals);
    // ADR-750 Φ5 (Α2) — οι **διαγώνιοι** κρέμονται από τα κελιά, όχι από το πλέγμα: ταξιδεύουν
    // στο `TableCellLayout` και άρα είναι ήδη κομμένες στο ορατό παράθυρο μαζί με τα κελιά
    // τους. Ζωγραφίζονται **πριν** το κείμενο, όπως κάθε άλλη γραμμή του πίνακα, ώστε ένα
    // «Ν/Α» πάνω σε διαγραμμένο κελί να παραμένει αναγνώσιμο.
    for (const cell of cells) if (cell.diagonals) stampTableBorders(rc, cell.diagonals);
    stampTableText(rc, cells, editedCellRef(cursor));
    if (cursor) {
      // ADR-739 Φ.Δ βήμα 4 — ΠΡΩΤΑ το περίγραμμα λειτουργίας, ΜΕΤΑ ο δρομέας κελιού: όταν ο
      // δρομέας κάθεται σε κελί της άκρης, οι δύο γραμμές εφάπτονται και πρέπει να νικά η
      // **συμπαγής**. Το «ποιο πλήκτρο πάει πού» είναι πιο επείγον από το «πού βρίσκομαι».
      //
      // Το ορθογώνιο είναι όλη η διάταξη από την τοπική αρχή (0,0) — οι ίδιες συντεταγμένες
      // φύλλου που χρησιμοποιούν τα κελιά, άρα καμία δεύτερη μετατροπή.
      //
      // 🔴 ADR-739 §37 — περνά το **πλέγμα**, όχι τη θέση του δείκτη: η μετατόπιση προς τα
      // έξω γεννιέται στη γεωμετρία (`tableModeOutlineRectMm`) και ο ζωγράφος τη ζητά. Το
      // παχύτερο ορατό μολύβι της περιμέτρου έρχεται από το **ήδη απομνημονευμένο**
      // ευρετήριο — καμία δεύτερη σάρωση ανά καρέ.
      stampTableModeOutline(
        rc,
        { x: 0, y: 0, w: layout.widthMm, h: layout.heightMm },
        index.perimeterMaxWidthMm,
      );
      // ADR-739 Φ.Δ βήμα 7 — οι ζώνες `A B C` / `1 2 3` γύρω από τον πίνακα. Ζωγραφίζονται
      // **έξω** από το ορθογώνιο της διάταξης (αρνητικές συντεταγμένες πλαισίου), οπότε
      // δεν επικαλύπτουν κανένα κελί και η σειρά τους ως προς τον δρομέα είναι αδιάφορη.
      //
      // Οι γραμμές περνούν με το **ορατό** παράθυρο (`start`/`end`), το ίδιο που ήδη κόβει
      // τα κελιά: ένας πίνακας 500 γραμμών δεν επιτρέπεται να ζωγραφίσει 500 αριθμούς ανά
      // καρέ για να φανούν οι 12 (ADR-735).
      // Οι ζώνες ανάβουν **ολόκληρη** την περιοχή όταν υπάρχει· αλλιώς μόνο τη στήλη/
      // γραμμή του δρομέα. Το μονοσύνολο δεν είναι ειδική περίπτωση — είναι η ίδια
      // ερώτηση με μία απάντηση (δες `TableIndicatorTick.active`).
      const bands = selection?.membership ?? {
        rowIds: new Set([cursor.position.rowId]),
        colIds: new Set([cursor.position.colId]),
      };
      // ADR-739 §30 — και η λωρίδα **κάτω από το ποντίκι**, φιλτραρισμένη ως προς ΑΥΤΟΝ τον
      // πίνακα: δύο πίνακες στην ίδια σκηνή δεν επιτρέπεται να μοιραστούν έναν δείκτη.
      const hover = getTableIndicatorHover();
      const hovered = hover?.entityId === e.id ? hover.hit : null;
      stampTableIndicator(rc, {
        columns: tableColumnTicks(
          layout.columns,
          bands.colIds,
          hovered?.axis === 'column' ? hovered.colId : null,
        ),
        rows: tableRowTicks(
          layout.rows,
          bands.rowIds,
          start,
          end,
          hovered?.axis === 'row' ? hovered.rowId : null,
        ),
        widthMm: layout.widthMm,
        heightMm: layout.heightMm,
      });
      // 🔴 ADR-739 §41 — **ο δρομέας σιωπά όσο υπάρχει επιλογή** (Excel parity, μετρημένο: η
      // ακμή `B10|C10` μέσα σε επιλεγμένο `B10:C13` είναι γραμμή πλέγματος `#ADADAD`, όχι
      // περίγραμμα). Το ενεργό κελί το δείχνει ήδη η **τρύπα** στη σκίαση, και μάλιστα με το
      // ίδιο ακριβώς ορθογώνιο — δύο δηλώσεις του ίδιου πράγματος, η μία εκ των οποίων
      // (συμπαγές μπλε πλαίσιο) θα διαβαζόταν ως *δεύτερη* επιλογή μέσα στην πρώτη.
      //
      // Δεν χάνεται κατάσταση: χωρίς επιλογή ο δρομέας ζωγραφίζεται όπως πάντα, και με
      // επιλογή 1×1 το περίγραμμα **της περιοχής** έχει ήδη το ίδιο χρώμα και πάχος
      // (`TABLE_CELL_SELECTION.outlineWidthPx` = `TABLE_CELL_CURSOR.lineWidthPx`) πάνω στο
      // ίδιο ορθογώνιο — δηλαδή η εικόνα του δρομέα, γραμμένη μία φορά.
      if (!selection && activeCellRect) stampTableCellCursor(rc, activeCellRect);
      // 🔴 ADR-754 Β1 — **μετά** τον δρομέα, ώστε ένα χρωματιστό περίγραμμα να μη χάνεται
      // κάτω από το συμπαγές μπλε όταν τα δύο εφάπτονται.
      //
      // ⚠️ **ΜΕΤΡΗΜΕΝΟ ΟΡΙΟ (ζωντανά, 04/08)**: η σειρά μέσα στον καμβά **δεν** αρκεί για την
      // κυκλική αναφορά — `=A1+B2` γραμμένο μέσα στο **B2** δείχνει το περίγραμμα του B2
      // μερικώς κομμένο (μετρήθηκε 428 px έναντι 728 του A1), γιατί το `<textarea>` του
      // επεξεργαστή είναι **DOM πάνω από τον καμβά** και κανένας κανόνας στοίβαξης εδώ δεν
      // τον φτάνει. Καταγράφεται ως όριο, όχι ως ελάττωμα: το κελί που γράφεις το δείχνει ήδη
      // ο δρομέας, και η κυκλική αναφορά είναι σφάλμα που ο χρήστης φτιάχνει κατά λάθος.
      stampTableFormulaReferenceOverlay(rc, layout, e, cursor);
      // 🔴 ADR-739 §36 ΦΑΣΗ 3 — **το φάντασμα προορισμού, τελευταίο**: απαντά «*πού θα πάει*»
      // και δεν επιτρέπεται να κρυφτεί κάτω από τα δεδομένα του προορισμού — σε αντίθεση με την
      // επιλογή, που απαντά «*τι μάρκαρα*» και μπαίνει **κάτω** από το κείμενο. Γι' αυτό το
      // γέμισμά του είναι αχνότερο. Ίδιος κανόνας ανάγνωσης με τον δρομέα: getter τη στιγμή του
      // καρέ (ADR-040), και **μόνο** σε φάση επιλογής ⇒ ποτέ ψημένο στο bitmap cache (#3).
      const transfer = getTableRangeTransferPreview();
      if (transfer?.entityId === e.id) stampTableRangeGhost(rc, layout, transfer);
      // 🔴 ADR-754 Γ4 — η λαβή συμπλήρωσης, **τελευταία μέσα στο πλέγμα**: είναι το μόνο
      // στοιχείο εδώ που λειτουργεί ως χερούλι, άρα τίποτα δεν επιτρέπεται να τη σκεπάσει.
      stampTableFillHandleOverlay(rc, layout, e, cursor, selection?.bounds);
    }

    // 🔴 ADR-739 §40 — **ΤΟ ⊕ ΤΗΣ ΕΙΣΑΓΩΓΗΣ, ΕΞΩ ΑΠΟ ΤΟ `if (cursor)`.**
    //
    // Η θέση αυτού του μπλοκ **είναι** η προδιαγραφή, όχι λεπτομέρεια στοίβαξης. Ο Giorgio το
    // ζήτησε ως full parity με το Word (04/08), όπου το ⊕ εμφανίζεται μόλις αγγίξεις τον
    // πίνακα — χωρίς να μπεις μέσα του. Μέσα στο `if (cursor)` θα ζωγραφιζόταν **μόνο** μετά
    // από διπλό κλικ, δηλαδή θα το έβρισκε μόνο όποιος ήδη ξέρει ότι υπάρχει: ακριβώς η
    // αστοχία ανακάλυψης που το §31.8 μέτρησε ζωντανά δύο φορές.
    //
    // Ο φύλακας είναι το `selected` — το ίδιο που ήδη φυλά τον δρομέα λίγες γραμμές πιο πάνω.
    // Καλύπτει **και τις δύο** καταστάσεις με μία συνθήκη, γιατί σε λειτουργία πίνακα η
    // οντότητα είναι επιλεγμένη ούτως ή άλλως (`const cursor = selected ? … : null`). Ποια από
    // τις δύο τρέχει το ξέρει η **γεωμετρία** (`TableInsertControlMode`), όχι ο ζωγράφος: εδώ
    // ζωγραφίζεται ό,τι απάντησε η σάρωση, στη θέση που εκείνη υπολόγισε.
    //
    // Τελευταίο σε ολόκληρη τη διαδρομή, και μετά το φάντασμα: κάθεται **έξω** από το πλέγμα,
    // άρα δεν σκεπάζει δεδομένα — αλλά τίποτα δεν επιτρέπεται να σκεπάσει **αυτό**, γιατί
    // είναι το μόνο στοιχείο του πίνακα που λειτουργεί ως κουμπί.
    if (selected) {
      const insert = getTableInsertControl();
      // Φιλτραρισμένο ως προς ΑΥΤΟΝ τον πίνακα: δύο πίνακες στη σκηνή δεν μοιράζονται
      // χειριστήριο — ο ίδιος έλεγχος που κάνει ήδη ο hover των ζωνών και ο δρομέας.
      if (insert?.entityId === e.id) {
        stampTableInsertControl(rc, insert.control, {
          widthMm: layout.widthMm,
          heightMm: layout.heightMm,
        });
      }
    }
  }

  /**
   * ADR-739 Φ.Δ βήμα 8 — η **επιλεγμένη περιοχή** αυτού του πίνακα, ως ορθογώνιο φύλλου
   * + ιδιότητα μέλους ανά άξονα· `null` όταν δεν υπάρχει επιλογή.
   *
   * ## Γιατί `null` χωρίς `selection`, αντί για «περιοχή ενός κελιού»
   * Το ένα κελί το δείχνει ήδη ο **δρομέας** — ένα ημιδιαφανές γέμισμα από κάτω του θα
   * ήταν δεύτερη δήλωση του ίδιου πράγματος, και θα έκανε τον πίνακα να φαίνεται μονίμως
   * «μαρκαρισμένος» από τη στιγμή που μπαίνεις μέσα του. «Καμία επιλογή» δεν είναι
   * «επιλογή 1×1»: είναι άλλη κατάσταση, και φαίνεται αλλιώς.
   *
   * Το ορθογώνιο συντίθεται από τη **διάταξη** (θέσεις/πλάτη στηλών και γραμμών) — καμία
   * δεύτερη γεωμετρία δεν γεννιέται εδώ.
   */
  private selectionOf(
    e: TableEntity,
    cursor: TableCellCursorState,
    /**
     * 🔴 ADR-739 §38 — η διάταξη **περνά ως όρισμα** αντί να ξαναζητηθεί. Ήταν δεύτερη κλήση
     * `computeTableEntityGeometryLive` μέσα στο ίδιο καρέ: η ίδια διάταξη (απομνημονευμένη),
     * αλλά **δεύτερη ανάγνωση `getComputedStyle`** για την επιφάνεια — δηλαδή διπλάσιο style
     * recalc ανά πίνακα ανά καρέ για μηδέν πληροφορία.
     */
    layout: TableLayout,
  ): {
    readonly rectMm: TableRectMm;
    readonly membership: TableRangeMembership;
    /** 🔴 ADR-754 Γ4 — τα ίδια όρια, για τη **λαβή συμπλήρωσης**: δεύτερος υπολογισμός τους
     *  θα ήταν δεύτερη απάντηση στο «τι μάρκαρε ο χρήστης», μέσα στο ίδιο καρέ. */
    readonly bounds: TableCellRangeBounds;
  } | null {
    if (!cursor.selection) return null;
    const model = resolveTableModel(e.model);
    // ADR-739 §27.15 — ο ζωγράφος **δεν ερμηνεύει**: ρωτά τον ΕΝΑ δρόμο «τι διάλεξε ο
    // χρήστης → ποια κελιά είναι μέσα», που ξέρει μόνος του πότε κουμπώνει.
    const bounds = resolveTableSelectionBounds(model, cursor.selection);
    if (!bounds) return null;
    const rectMm = tableRangeRectMm(layout, bounds);
    return rectMm ? { rectMm, membership: tableRangeMembership(model, bounds), bounds } : null;
  }

  /**
   * ADR-739 Φ.Δ βήμα 2 — ο δρομέας αυτής της οντότητας, ή `null`.
   *
   * ## Γιατί getter και όχι συνδρομή (ADR-040)
   * Ο ζωγράφος παραμένει καθαρό φύλλο: διαβάζει τον δρομέα **τη στιγμή του καρέ**, όπως
   * ήδη διαβάζει τη ζωντανή κλίμακα μέσα στο `computeTableEntityGeometryLive`. Το «πότε
   * ξαναβάφω» το λέει το store με `markSystemsDirty` — ένα καρέ ανά πάτημα πλήκτρου.
   *
   * ## Γιατί ΜΟΝΟ σε φάση επιλογής — ADR-040 κανόνας #3
   * Το normal-state pass είναι αυτό που μπαίνει στο **bitmap cache**, και εκεί το
   * `selectedEntityIds` είναι πάντα κενό (`dxf-bitmap-cache`). Ο έλεγχος `selected`
   * εγγυάται λοιπόν ότι ο δρομέας — και η παράλειψη κειμένου που τον συνοδεύει —
   * ζωγραφίζονται **μόνο** στο overlay pass, ποτέ ψημένα μέσα στο raster· αλλιώς κάθε
   * `Tab` θα ζητούσε πλήρη ανακατασκευή N οντοτήτων. Ο δρομέας υπάρχει ούτως ή άλλως μόνο
   * όσο ο πίνακας είναι επιλεγμένος, άρα η συνθήκη δεν κρύβει τίποτα.
   */
  private cursorOf(entityId: string): TableCellCursorState | null {
    const cursor = getTableCellCursor();
    return cursor && cursor.entityId === entityId ? cursor : null;
  }

  /**
   * Το χρώμα φάσης, ή `undefined` στην κανονική απόδοση.
   *
   * Ο πίνακας είναι η **μόνη** σημείωση με δικά της χρώματα ανά κελί (τα υπόλοιπα
   * annotations έχουν ένα χρώμα). Αν βάφαμε πάντα με το χρώμα φάσης, ένας πίνακας θα
   * έχανε την κεφαλίδα και τα γεμίσματά του· αν δεν βάφαμε ποτέ, δεν θα φαινόταν
   * επιλεγμένος. Γι' αυτό: βάψιμο **μόνο** όταν υπάρχει ενεργή φάση.
   */
  private tablePhaseColor(): string | undefined {
    return this._currentHovered ? (this.ctx.strokeStyle as string) : undefined;
  }

  /**
   * Το κατακόρυφο παράθυρο του καμβά σε **sheet-mm του πλαισίου του πίνακα**.
   *
   * Οι τέσσερις γωνίες του καμβά αντιστρέφονται στο πλαίσιο και κρατιέται το εύρος `v`.
   * Με περιστροφή, ο άξονας `v` δεν είναι ο άξονας οθόνης — μια σύγκριση μόνο σε `y` θα
   * έκοβε ορατές γραμμές (και θα φαινόταν ως «λείπουν γραμμές όταν γυρίζω τον πίνακα»).
   * Το αποτέλεσμα περικόπτεται στα όρια του πίνακα ώστε το εύρος να μένει πεπερασμένο.
   */
  private visibleFrameWindow(
    e: TableEntity,
    geometry: TableEntityGeometry,
  ): { readonly topMm: number; readonly bottomMm: number } {
    const { width, height } = this.ctx.canvas;
    const corners: Point2D[] = [
      this.screenToWorld({ x: 0, y: 0 }),
      this.screenToWorld({ x: width, y: 0 }),
      this.screenToWorld({ x: width, y: height }),
      this.screenToWorld({ x: 0, y: height }),
    ];

    let topMm = Infinity;
    let bottomMm = -Infinity;
    for (const corner of corners) {
      const { v } = tableWorldToFrame(e, corner, geometry.mmToWorld);
      if (v < topMm) topMm = v;
      if (v > bottomMm) bottomMm = v;
    }

    // Εκφυλισμένος καμβάς (μηδενικές διαστάσεις, offscreen pass) ⇒ ζωγράφισε τα πάντα:
    // ένα κενό παράθυρο θα έκρυβε σιωπηλά ολόκληρο τον πίνακα.
    if (!Number.isFinite(topMm) || !Number.isFinite(bottomMm) || bottomMm <= topMm) {
      return { topMm: 0, bottomMm: geometry.layout.heightMm };
    }
    return {
      topMm: Math.max(topMm, 0),
      bottomMm: Math.min(bottomMm, geometry.layout.heightMm),
    };
  }

  // ── Αλληλεπίδραση ──────────────────────────────────────────────────────────

  /**
   * Οι λαβές, από το ΙΔΙΟ SSoT που καταναλώνει η αλληλεπίδραση (render ≡ interaction).
   *
   * Το **σχήμα** και η **ταυτότητα χρώματος** αποφασίζονται και τα δύο από το grip kind,
   * μέσω των αντίστοιχων SSoT (`gripGlyphShape` / `tableGripCustomColor`) — ο ζωγράφος δεν
   * παίρνει καμία δική του απόφαση εμφάνισης, μόνο τις διοχετεύει.
   */
  getGrips(entity: EntityModel): GripInfo[] {
    if (!isTableEntity(entity as Entity)) return [];
    const e = entity as unknown as TableEntity;
    return getTableGrips(e).map((g) => {
      const kind = gripKindOf(g, 'table');
      return toRenderGripInfo(g, gripGlyphShape(kind), tableGripCustomColor(kind));
    });
  }

  /** Ακριβής επιλογή — delegate στο `hitTestTable` SSoT (N.18, κοινό με τη στενή φάση). */
  hitTest(entity: EntityModel, point: Point2D, tolerance: number): boolean {
    if (!isTableEntity(entity as Entity)) return false;
    return hitTestTable(entity as unknown as TableEntity, point, tolerance, this._sceneUnits);
  }
}
