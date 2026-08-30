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
import { tableRenderIndex, visibleHorizontals } from '../../bim/table/table-render-index';
import { hitTestTable } from '../../bim/table/table-entity-hit';
import { getTableGrips, tableGripCustomColor } from '../../bim/table/table-entity-grips';
import type { TableCellLayout } from '../../bim/table/table-layout-types';
import {
  createStampTableContext,
  stampTableBorders,
  stampTableCellCursor,
  stampTableModeOutline,
  stampTableFills,
  stampTableSelection,
  stampTableText,
  type StampTableContext,
} from './table/stamp-table-layout';
// ⛏️ N.7.1 (2026-08-04) — η ερμηνεία της επιλογής (`resolveTableSelectionBounds`,
// `tableRangeMembership`, `tableRangeRectMm`, `isTableWholeGridRange`) μετακόμισε ολόκληρη στο
// `table-frame-cursor-view`. Ο ζωγράφος δεν ρωτά πια «ποια κελιά είναι μέσα» — του το λένε.
// ADR-739 Φ.Δ βήμα 7 — ο δείκτης πίνακα (AutoCAD `TABLEINDICATOR`) + η ονομασία των
// υποδιαιρέσεών του. Η ονομασία ζει στο `bim/`, η ζωγραφική εδώ — ίδιος διαχωρισμός με
// τη διάταξη και τον ζωγράφο της.
import { stampTableIndicator } from './table/stamp-table-indicator';
import { stampTableSheet } from './table/stamp-table-sheet';
// 🔴 N.7.1 (2026-08-04, §43) — **τι σημαίνει ο δρομέας και η επιλογή για αυτό το καρέ**: τρεις
// καθαρές ερωτήσεις που δεν αγγίζουν καμβά. Εξαγωγή, όχι κόψιμο — δες την κεφαλίδα εκείνου.
import {
  activeCellRectOf,
  editedCellRef,
  tableFrameEffectiveRange,
  tableFrameSelectionView,
} from './table/table-frame-cursor-view';
// 🔴 ADR-739 §36 ΦΑΣΗ 3 — η προεπισκόπηση της μεταφοράς περιοχής. Ίδιος κανόνας με τον δρομέα
// και το hover: getter τη στιγμή του καρέ (ADR-040), καμία συνδρομή.
import { stampTableRangeGhost } from './table/stamp-table-range-ghost';
import { getTableRangeTransferPreview } from '../../state/table-range-transfer-store';
// 🔴 ADR-739 §48 — τα «μυρμήγκια» της αντιγραμμένης περιοχής. Ίδιος κανόνας ανάγνωσης με τα
// δύο από πάνω· ο ζωγράφος είναι **και** ο φρουρός της μπαγιάτικης έκδοσης (δες εκεί).
import {
  stampTableCopyMarquee,
  tableCopyMarqueeCoversRange,
} from './table/stamp-table-copy-marquee';
import { getTableCopyMarquee } from '../../state/table-copy-marquee-store';
// 🔴 ADR-754 Β1 — τα χρωματιστά περιγράμματα των αναφορών του τύπου που γράφεται. **Κανένα
// νέο store**: οι αναφορές είναι παράγωγο του προχείρου, που ταξιδεύει ήδη μέσα στον δρομέα
// (δες την κεφαλίδα του `table-formula-reference-spans`).
// 🔴 ADR-754 — οι δύο επικαλύψεις των τύπων (Β1 περιγράμματα, Γ4 λαβή). Ζουν χωριστά γιατί
// είναι οι μόνες που ρωτούν **μοντέλο και δρομέα μαζί** — δες την κεφαλίδα τους.
import {
  stampTableFillBadgeOverlay,
  stampTableFillHandleOverlay,
  stampTableFormulaReferenceOverlay,
} from './table/table-formula-overlays';
import { tableColumnTicks, tableRowTicks } from '../../bim/table/table-cell-reference';
// ADR-739 Φ.Δ βήμα 2 — ο δρομέας διαβάζεται με getter τη στιγμή του καρέ (ADR-040), ποτέ
// ως συνδρομή: ο ζωγράφος μένει καθαρό φύλλο.
import { type TableCellCursorState } from '../../state/table-cell-cursor-store';
import { tableCursorFor } from '../../state/table-cell-cursor-scope';
// ADR-739 §30 — η λωρίδα κάτω από το ποντίκι, με τον ΙΔΙΟ κανόνα: getter τη στιγμή του
// καρέ, καμία συνδρομή. Ο γραφέας ζητά καρέ μόνο όταν αλλάζει υποδιαίρεση.
import { getTableIndicatorHover } from '../../state/table-indicator-hover-store';
// 🔴 ADR-739 §40/§42 — τα χειριστήρια-κουμπιά (⊕ εισαγωγής Word-parity, ⊖ διαγραφής):
// ζωγραφίζονται σε **επιλογή** και σε λειτουργία πίνακα, γι' αυτό ζουν έξω από το `if (cursor)`.
// ADR-833 §0.2 — ένα import αντί για έξι· το σώμα και τα δύο περιστατικά ζουν στο module.
import { stampTableChromeControls } from './table/stamp-table-chrome';
// 🔴 ADR-767 Δ4 — ο δείκτης δεσμού: **λωρίδα ανά δεμένη στήλη** (Δ8) + σημάδι στα κελιά που
// αποκλίνουν. Ο ίδιος κανόνας ανάγνωσης με κάθε άλλο store εδώ: getter τη στιγμή του καρέ.
// ⚠️ Ζωγραφίζεται **έξω** από το `if (cursor)` και **έξω** από το `if (selected)`: είναι
// ιδιότητα του σχεδίου, όχι της τρέχουσας χειρονομίας — ο δεσμός φαίνεται πάντα. Ο φρουρός
// του χαρτιού ζει **μέσα** στον ζωγράφο (δες την κεφαλίδα του).
import { stampTableBoundStateOverlay } from './table/table-bound-state-overlay';
import { gripGlyphShape } from '../../bim/grips/grip-glyph-registry';
import { gripKindOf } from '../../hooks/grip-kinds';
import { toRenderGripInfo } from './shared/grip-utils';

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
      // 🔴 ADR-771 Φ.2 — από την **ίδια** γεωμετρία, για τον ίδιο λόγο με το `surfaceHex`.
      surfacePaint: geometry.surfacePaint,
      // Η φάση (hover/επιλογή) έχει ήδη θέσει το `strokeStyle`· όταν είναι η κανονική
      // φάση, το `undefined` αφήνει τα χρώματα του στυλ να περάσουν αυτούσια.
      phaseColor: this.tablePhaseColor(),
    });

    // ΕΝΑ σημείο απόφασης για τον δρομέα: και «ποιο κελί πλαισιώνεται» και «ποιο κελί δεν
    // ζωγραφίζεται» βγαίνουν από την ίδια ανάγνωση — δύο αναγνώσεις θα μπορούσαν να δουν
    // διαφορετική κατάσταση μέσα στο ίδιο καρέ.
    const cursor = selected ? this.cursorOf(e) : null;
    // 🔴 ADR-739 §41 — **ΜΙΑ** αναζήτηση του ενεργού κελιού, **δύο** καταναλωτές: η τρύπα της
    // σκίασης και ο δρομέας. Δύο αναζητήσεις θα ήταν δύο ευκαιρίες να απαντήσουν αλλιώς μέσα
    // στο ίδιο καρέ — δηλαδή σκίαση που τρυπά ένα κελί ενώ το πλαίσιο στέκεται σε άλλο.
    const activeCellRect = cursor ? activeCellRectOf(cursor, index) : undefined;

    // 🔴 ADR-771 Φ.2 — **ΠΡΩΤΟ**: το φύλλο είναι φόντο, όλα τα υπόλοιπα κάθονται από πάνω.
    // Καλείται πάντα, χωρίς συνθήκη — ο φρουρός (`surfacePaint`) ζει μέσα στον ζωγράφο.
    stampTableSheet(rc, layout);
    stampTableFills(rc, cells);
    // ADR-739 Φ.Δ βήμα 8 — η επιλογή **πάνω από τα γεμίσματα, κάτω από το πλέγμα και το
    // κείμενο**: είναι ημιδιαφανής, οπότε ένα στρώμα πάνω από τα γράμματα θα τα θόλωνε —
    // και η επιλογή υπάρχει ακριβώς για να διαβάσεις τι μάρκαρες.
    const selection = cursor ? tableFrameSelectionView(e, cursor, layout) : null;
    // 🔴 ADR-739 §48.12 — **ΜΙΑ** ανάγνωση του προχείρου για ΟΛΟ το καρέ, για τον ίδιο λόγο που
    // το `activeCellRect` διαβάζεται μία φορά παραπάνω: δύο getter κλήσεις είναι δύο ευκαιρίες
    // να απαντήσουν αλλιώς μέσα στο ίδιο καρέ — εδώ θα σήμαινε «περίγραμμα κρυμμένο επειδή
    // υπάρχει marquee» ενώ το marquee δεν ζωγραφίστηκε ποτέ, δηλαδή περιοχή **χωρίς καμία**
    // γραμμή. Ο παλμός τρέχει σε δικό του ρολόι (~12 Hz), άρα δεν είναι θεωρητικό.
    const copyMarquee = getTableCopyMarquee();
    // 🔴 ADR-739 §48.12 — **ΜΙΑ ΕΡΩΤΗΣΗ, ΤΡΕΙΣ ΚΑΤΑΝΑΛΩΤΕΣ.** Η «ενεργή περιοχή» (επιλογή, ή
    // ενεργό κελί κουμπωμένο στη συγχώνευσή του) υπολογίζεται **εδώ, μία φορά**, και την ίδια
    // απάντηση διαβάζουν και οι τρεις που ζωγραφίζουν πάνω της: το περίγραμμα της επιλογής, ο
    // δρομέας, η λαβή συμπλήρωσης.
    //
    // Πριν, καθένας ρωτούσε μόνος του — και ο δρομέας **δεν ρωτούσε καθόλου**: με σκέτο ενεργό
    // κελί ζωγράφιζε συμπαγή γραμμή ακριβώς πάνω στη διαδρομή των μυρμηγκιών (μετρημένο ζωντανά,
    // §48.12). Η ερώτηση ανέβηκε ένα επίπεδο ώστε το λάθος να γίνει **μη εκφράσιμο**: δεν υπάρχει
    // πια ζωγράφος αυτής της διαδρομής που να μπορεί να ξεχάσει να ρωτήσει.
    const effectiveRange = cursor ? tableFrameEffectiveRange(e, cursor, selection?.bounds) : null;
    const marqueeCoversRange = tableCopyMarqueeCoversRange(e, copyMarquee, effectiveRange);
    if (selection) {
      stampTableSelection(rc, selection.rectMm, activeCellRect, marqueeCoversRange);
    }
    stampTableBorders(rc, visibleHorizontals(index, window.topMm, window.bottomMm));
    stampTableBorders(rc, index.verticals);
    // ADR-750 Φ5 (Α2) — οι **διαγώνιοι** κρέμονται από τα κελιά, όχι από το πλέγμα: ταξιδεύουν
    // στο `TableCellLayout` και άρα είναι ήδη κομμένες στο ορατό παράθυρο μαζί με τα κελιά
    // τους. Ζωγραφίζονται **πριν** το κείμενο, όπως κάθε άλλη γραμμή του πίνακα, ώστε ένα
    // «Ν/Α» πάνω σε διαγραμμένο κελί να παραμένει αναγνώσιμο.
    for (const cell of cells) if (cell.diagonals) stampTableBorders(rc, cell.diagonals);
    stampTableText(rc, cells, editedCellRef(cursor));
    // 🔴 ADR-767 Δ4 — **ο δείκτης δεσμού, μετά το κείμενο και πριν κάθε δείκτη χειρονομίας.**
    //
    // Η θέση είναι η προδιαγραφή: πάνω από τα δεδομένα (αλλιώς μια λωρίδα θα κρυβόταν κάτω
    // από γέμισμα κεφαλίδας), αλλά **κάτω** από δρομέα/επιλογή/μυρμήγκια — εκείνα απαντούν
    // «τι κάνω τώρα» και δεν επιτρέπεται να τα σκεπάσει μια ιδιότητα του εγγράφου.
    //
    // Και **έξω** από τα δύο `if`: ο δεσμός δεν είναι κατάσταση της χειρονομίας. Ένας
    // δεμένος πίνακας που κανείς δεν άγγιξε οφείλει να φαίνεται δεμένος — αλλιώς η ένδειξη
    // θα τη βρήκε μόνο όποιος ήδη ξέρει ότι υπάρχει (η αστοχία ανακάλυψης του §31.8).
    stampTableBoundStateOverlay(rc, e, layout.columns, cells);
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
      // 🔴 §43 — το φιλτράρισμα γίνεται **μία** φορά, και οι δύο αναγνώστες (γράμματα, γωνία)
      // διαβάζουν το ίδιο αποτέλεσμα: δύο ξεχωριστές συγκρίσεις `entityId` θα ήταν δύο ευκαιρίες
      // να ξεχάσει κάποιος τη μία, δηλαδή γωνία που ανάβει σε **άλλον** πίνακα.
      const hover = getTableIndicatorHover();
      const hoverTarget = hover?.entityId === e.id ? hover.target : null;
      const hovered = hoverTarget?.kind === 'tick' ? hoverTarget.hit : null;
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
        // 🔴 ADR-739 §43 — το κουμπί «επιλογή όλων». Και οι δύο καταστάσεις είναι **παράγωγα**:
        // η μία της επιλογής (δες `tableFrameSelectionView`), η άλλη του ίδιου hover των γραμμάτων.
        corner: { active: selection?.whole ?? false, hovered: hoverTarget?.kind === 'select-all' },
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
      //
      // 🔴 §48.12 — **ΚΑΙ Ο ΔΡΟΜΕΑΣ ΣΙΩΠΑ ΟΤΑΝ ΤΑ ΜΥΡΜΗΓΚΙΑ ΚΑΘΟΝΤΑΙ ΣΤΗ ΘΕΣΗ ΤΟΥ.** Χωρίς
      // επιλογή, ο δρομέας **είναι** το περίγραμμα της ενεργής περιοχής — άρα διεκδικεί ακριβώς
      // την ίδια διαδρομή, και ο συλλογισμός του §48.12 τον αφορά αυτούσιο. Ο ίδιος `if` που τον
      // σβήνει μπροστά στην επιλογή τον σβήνει τώρα και μπροστά στο πρόχειρο: δύο δηλώσεις του
      // ίδιου ορθογωνίου, η μία εκ των οποίων κινείται και η άλλη το πνίγει.
      //
      // Δεν χάνεται κατάσταση και δεν χρειάζεται σβήσιμο: μόλις τα μυρμήγκια λήξουν ή ο δρομέας
      // φύγει αλλού, το `marqueeCoversRange` γίνεται `false` **μόνο του** και ο δρομέας γυρίζει.
      // Είναι παράγωγο του καρέ, όχι σημαία που κάποιος οφείλει να θυμηθεί να καθαρίσει.
      if (!selection && activeCellRect && !marqueeCoversRange) {
        stampTableCellCursor(rc, activeCellRect);
      }
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
      // 🔴 ADR-739 §48 — **τα μυρμήγκια της αντιγραφής, πάνω απ' όλα**: απαντούν «τι είναι στο
      // πρόχειρο», δηλαδή πληροφορία για μια πράξη που **δεν έχει γίνει ακόμα** — και γι' αυτό
      // δεν επιτρέπεται να κρυφτεί κάτω από κανέναν δείκτη της τρέχουσας κατάστασης.
      //
      // Ίδιος κανόνας ανάγνωσης με τον δρομέα και το φάντασμα: getter τη στιγμή του καρέ
      // (ADR-040) και **μόνο** σε φάση επιλογής ⇒ ποτέ ψημένο στο bitmap cache (κανόνας #3).
      // Εδώ ο κανόνας #3 είναι κρίσιμος όσο πουθενά αλλού: το marquee ζητά καρέ **μόνο του**
      // κάθε 80 ms, οπότε μια θέση μέσα στο cached raster θα σήμαινε πλήρη ανακατασκευή N
      // οντοτήτων 12 φορές το δευτερόλεπτο, για πάντα.
      stampTableCopyMarquee(rc, e, layout, copyMarquee, performance.now());
      // 🔴 ADR-754 Γ4 — η λαβή συμπλήρωσης, **τελευταία μέσα στο πλέγμα**: είναι το μόνο
      // στοιχείο εδώ που λειτουργεί ως χερούλι, άρα τίποτα δεν επιτρέπεται να τη σκεπάσει.
      // §48.12 — δέχεται την **ήδη λυμένη** ενεργή περιοχή αντί να την ξαναρωτήσει. Ήταν η
      // τέταρτη κλήση του `tableEffectiveRangeBounds` και η μόνη που την έκανε μόνη της· τώρα
      // η λαβή και τα δύο περιγράμματα κάθονται πάνω στο **ίδιο** ορθογώνιο εξ ορισμού, όχι
      // κατά σύμπτωση. Το πλήθος κλήσεων `resolveTableModel` ανά καρέ μένει ίδιο.
      stampTableFillHandleOverlay(rc, layout, e, cursor, effectiveRange);
      // 🔴 ADR-828 Φ4α — **το κουμπί «Επιλογές Αυτόματης Συμπλήρωσης», τελευταίο απ' όλα**:
      // είναι το μόνο στοιχείο αυτού του καρέ που λειτουργεί ως **κουμπί**, άρα τίποτα δεν
      // επιτρέπεται να το σκεπάσει. Η κρίση «ζει ακόμη;» ζει στην επικάλυψη — δες εκεί.
      stampTableFillBadgeOverlay(rc, layout, e, cursor);
    }

    // 🔴 ADR-739 §40/§42 — **τα χειριστήρια-κουμπιά (⊖ διαγραφής, ⊕ εισαγωγής), ΕΞΩ ΑΠΟ ΤΟ
    // `if (cursor)`**: εμφανίζονται μόλις αγγίξεις τον πίνακα, χωρίς να μπεις μέσα του (Word
    // parity). Ο φύλακας είναι το `selected` — το ίδιο που ήδη φυλά τον δρομέα πιο πάνω.
    //
    // ADR-833 §0.2 — το σώμα μετακόμισε στο `stamp-table-chrome.ts` (ο `TableRenderer` ήταν
    // στις 494/500 γραμμές, δηλαδή η πύλη μεγέθους θα μπλόκαρε την επόμενη κλήση). Η τομή
    // είναι σημασιολογική, όχι αριθμητική: εκεί ζει ό,τι ζωγραφίζεται **επειδή ο πίνακας
    // είναι επιλεγμένος και έξω από το πλέγμα**.
    //
    // 🔴 ADR-833 Φάση 3 — **και εκεί μπήκε η λωρίδα καρτελών φύλλων.** Ο φύλακας είναι το
    // `selected` και **όχι** το `cursor`, όπως ακριβώς για τα δύο χειριστήρια: αλλιώς οι
    // καρτέλες θα φαίνονταν μόνο αφού μπεις σε λειτουργία πίνακα, δηλαδή θα τις έβρισκε μόνο
    // όποιος ήδη ξέρει ότι υπάρχουν — η **ίδια** αστοχία ανακάλυψης που μέτρησε δύο φορές το
    // §31.8 και έκλεισε το §40. Η αλλαγή φύλλου είναι πλοήγηση, όχι επεξεργασία.
    //
    // Περνά η **οντότητα** και όχι το `e.id`: η λωρίδα ρωτά τα φύλλα της (δες εκεί).
    if (selected) stampTableChromeControls(rc, e, layout);
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
  private cursorOf(entity: TableEntity): TableCellCursorState | null {
    // 🔴 ADR-833 Φάση 2 — «δικός μου» σημαίνει **ίδιος πίνακας ΚΑΙ ίδιο ενεργό φύλλο**. Ο έλεγχος
    // δεν γράφεται εδώ: ζει στο `state/table-cell-cursor-scope.ts`, μαζί με τους υπόλοιπους
    // δρόμους «δρομέας ↔ πίνακας». Χωρίς αυτό, ο ζωγράφος θα σχεδίαζε το πλαίσιο του δρομέα του
    // φύλλου Α πάνω από τα κελιά του Β — και ο χρήστης θα πληκτρολογούσε εκεί που το βλέπει.
    return tableCursorFor(entity);
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
