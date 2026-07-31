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
  tableWorldToFrame,
} from '../../bim/table/table-entity-geometry';
import { visibleRowRange } from '../../bim/table/table-layout';
import { tableRenderIndex, visibleHorizontals } from '../../bim/table/table-render-index';
import { hitTestTable } from '../../bim/table/table-entity-hit';
import { getTableGrips } from '../../bim/table/table-entity-grips';
import type { TableCellLayout } from '../../bim/table/table-layout-types';
import { stampTableBorders, stampTableFills, stampTableText } from './table/stamp-table-layout';
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
    this.renderWithPhases(entity, options, () => this.drawTable(e));
  }

  /** Γεμίσματα → πλέγμα → κείμενο, μόνο για ό,τι φαίνεται. */
  private drawTable(e: TableEntity): void {
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

    const rc = {
      ctx: this.ctx,
      toScreen: (u: number, v: number): Point2D =>
        this.worldToScreen(tableFrameToWorld(e, u, v, geometry.mmToWorld)),
      pxPerMm: geometry.mmToWorld * this.transform.scale,
      // Η φάση (hover/επιλογή) έχει ήδη θέσει το `strokeStyle`· όταν είναι η κανονική
      // φάση, το `undefined` αφήνει τα χρώματα του στυλ να περάσουν αυτούσια.
      phaseColor: this.tablePhaseColor(),
    };

    stampTableFills(rc, cells);
    stampTableBorders(rc, visibleHorizontals(index, window.topMm, window.bottomMm));
    stampTableBorders(rc, index.verticals);
    stampTableText(rc, cells);
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

  /** Οι λαβές, από το ΙΔΙΟ SSoT που καταναλώνει η αλληλεπίδραση (render ≡ interaction). */
  getGrips(entity: EntityModel): GripInfo[] {
    if (!isTableEntity(entity as Entity)) return [];
    const e = entity as unknown as TableEntity;
    return getTableGrips(e).map((g) => toRenderGripInfo(g, gripGlyphShape(gripKindOf(g, 'table'))));
  }

  /** Ακριβής επιλογή — delegate στο `hitTestTable` SSoT (N.18, κοινό με τη στενή φάση). */
  hitTest(entity: EntityModel, point: Point2D, tolerance: number): boolean {
    if (!isTableEntity(entity as Entity)) return false;
    return hitTestTable(entity as unknown as TableEntity, point, tolerance, this._sceneUnits);
  }
}
