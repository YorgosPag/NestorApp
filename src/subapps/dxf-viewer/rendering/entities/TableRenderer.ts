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
import type { TableCellLayout, TableRectMm } from '../../bim/table/table-layout-types';
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
import { tableColumnTicks, tableRowTicks } from '../../bim/table/table-cell-reference';
// ADR-739 Φ.Δ βήμα 2 — ο δρομέας διαβάζεται με getter τη στιγμή του καρέ (ADR-040), ποτέ
// ως συνδρομή: ο ζωγράφος μένει καθαρό φύλλο.
import { getTableCellCursor, type TableCellCursorState } from '../../state/table-cell-cursor-store';
// ADR-739 §30 — η λωρίδα κάτω από το ποντίκι, με τον ΙΔΙΟ κανόνα: getter τη στιγμή του
// καρέ, καμία συνδρομή. Ο γραφέας ζητά καρέ μόνο όταν αλλάζει υποδιαίρεση.
import { getTableIndicatorHover } from '../../state/table-indicator-hover-store';
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
      // Η φάση (hover/επιλογή) έχει ήδη θέσει το `strokeStyle`· όταν είναι η κανονική
      // φάση, το `undefined` αφήνει τα χρώματα του στυλ να περάσουν αυτούσια.
      phaseColor: this.tablePhaseColor(),
    });

    // ΕΝΑ σημείο απόφασης για τον δρομέα: και «ποιο κελί πλαισιώνεται» και «ποιο κελί δεν
    // ζωγραφίζεται» βγαίνουν από την ίδια ανάγνωση — δύο αναγνώσεις θα μπορούσαν να δουν
    // διαφορετική κατάσταση μέσα στο ίδιο καρέ.
    const cursor = selected ? this.cursorOf(e.id) : null;

    stampTableFills(rc, cells);
    // ADR-739 Φ.Δ βήμα 8 — η επιλογή **πάνω από τα γεμίσματα, κάτω από το πλέγμα και το
    // κείμενο**: είναι ημιδιαφανής, οπότε ένα στρώμα πάνω από τα γράμματα θα τα θόλωνε —
    // και η επιλογή υπάρχει ακριβώς για να διαβάσεις τι μάρκαρες.
    const selection = cursor ? this.selectionOf(e, cursor) : null;
    if (selection) stampTableSelection(rc, selection.rectMm);
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
      stampTableModeOutline(rc, { x: 0, y: 0, w: layout.widthMm, h: layout.heightMm });
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
      this.drawCellCursor(cursor, rc, index);
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
  ): { readonly rectMm: TableRectMm; readonly membership: TableRangeMembership } | null {
    if (!cursor.selection) return null;
    const model = resolveTableModel(e.model);
    // ADR-739 §27.15 — ο ζωγράφος **δεν ερμηνεύει**: ρωτά τον ΕΝΑ δρόμο «τι διάλεξε ο
    // χρήστης → ποια κελιά είναι μέσα», που ξέρει μόνος του πότε κουμπώνει.
    const bounds = resolveTableSelectionBounds(model, cursor.selection);
    if (!bounds) return null;
    const layout = computeTableEntityGeometryLive(e, this._sceneUnits).layout;
    const rectMm = tableRangeRectMm(layout, bounds);
    return rectMm ? { rectMm, membership: tableRangeMembership(model, bounds) } : null;
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
   * Το ορθογώνιο του τρέχοντος κελιού. Η αναζήτηση περνά από το **ήδη υπολογισμένο**
   * ευρετήριο (`cellsByRowId`): O(στήλες) αντί για γραμμική σάρωση όλων των κελιών σε
   * κάθε καρέ — το μάθημα του ADR-735.
   */
  private drawCellCursor(
    cursor: TableCellCursorState,
    rc: StampTableContext,
    index: TableRenderIndex,
  ): void {
    const bucket = index.cellsByRowId.get(cursor.position.rowId);
    const cell = bucket?.find((c) => c.colId === cursor.position.colId);
    if (cell) stampTableCellCursor(rc, cell.rect);
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
