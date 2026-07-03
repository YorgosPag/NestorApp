/**
 * Column Tool — state machine types + hook contract (split από `useColumnTool.ts`, N.7.1).
 *
 * Καθαρά types/interfaces + το `INITIAL_STATE` (data, μηδέν logic) του column placement FSM.
 * Κρατήθηκαν σε ξεχωριστό αρχείο ώστε ο orchestrator hook να μένει <500 γραμμές. Re-exported
 * από `useColumnTool.ts` → οι υπάρχοντες consumers (`import … from './useColumnTool'`) δεν αλλάζουν.
 *
 * @see ./useColumnTool.ts — ο hook που τα υλοποιεί
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.6 §6 Phase 4
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import type {
  ColumnAnchor,
  ColumnEntity,
  ColumnKind,
} from '../../bim/types/column-types';
import type { ColumnParamOverrides, SceneUnits } from './column-completion';
import type { RegionLineSeg } from '../../bim/walls/wall-in-region';
import type { RegionMethod } from '../../systems/tools/region-tool-ids';

/**
 * ADR-363 Φάση 3 / 3c — column placement mode:
 *   - 'freehand'          — single-click placement (default, Phase 4).
 *   - 'outer-perimeter'   — box-select παρειές → ΕΝΑ τοιχίο (ColumnEntity) ανά
 *                           κλειστή περίμετρο, ΜΕ ένωση γειτονικών (Φάση 3).
 *   - 'discrete-perimeter'— box-select παρειές → ΧΩΡΙΣ ένωση (κάθε περίγραμμα
 *                           ξεχωριστό)· αυτόματη ταξινόμηση κολώνα/τοιχίο ανά
 *                           αναλογία πλευρών + ενημερωτικό confirm (Φάση 3c).
 *   - 'in-region'         — ADR-419 «Κολώνα σε περιοχή (4 γραμμές)»: 4 κλικ σε
 *                           γραμμές / 1 κλικ μέσα / box-select → ΕΝΑ ColumnEntity
 *                           ανά εσώκλειστο ορθογώνιο (ΙΔΙΑ SSoT με «Τοίχος σε περιοχή»).
 *   - 'polygon'           — ADR-363 §column-polygon-sketch «Κολώνα από σχεδιασμένο
 *                           πολύγωνο»: ο χρήστης σχεδιάζει ελεύθερα κλειστό περίγραμμα
 *                           με διαδοχικά κλικ (ΙΔΙΟ vertex-chain engine με το slab) →
 *                           ΕΝΑ ColumnEntity (auto shape: rectangular/L/composite/U).
 */
export type ColumnPlacementMode =
  | 'freehand'
  | 'outer-perimeter'
  | 'discrete-perimeter'
  | 'in-region'
  | 'polygon';

// ─── State machine types ─────────────────────────────────────────────────────

export type ColumnToolPhase =
  | 'idle'
  | 'awaitingPosition'
  | 'awaitingRotation' // ADR-508 §column place+rotate — μετά το 1ο κλικ: ορισμός γωνίας με 2ο κλικ
  | 'awaitingTopLean' // ADR-404 Φ5 §slanted — slant mode: μετά το 1ο κλικ (βάση), το 2ο ορίζει την κλίση
  | 'committed';

export interface ColumnToolState {
  readonly phase: ColumnToolPhase;
  readonly kind: ColumnKind;
  readonly anchor: ColumnAnchor;
  /** ADR-363 Φάση 3 — 'freehand' (single-click) ή 'outer-perimeter' (από περίγραμμα). */
  readonly placementMode: ColumnPlacementMode;
  /**
   * ADR-419 — όταν `placementMode === 'in-region'`, ποιον τρόπο δέχεται το εργαλείο:
   * 'lines' (4 γραμμές) / 'inside' (κλικ μέσα) / 'box' (πλαίσιο). Οδηγείται από το
   * active tool id (column-region-lines/inside/box). Αδιάφορο στα άλλα modes.
   */
  readonly regionMethod: RegionMethod;
  /**
   * ADR-419 — όταν `placementMode === 'discrete-perimeter'`, η πρόθεση του χρήστη:
   * 'columns' («Πολλαπλή δημιουργία κολωνών») ή 'walls' («…τοιχίων»). Καθορίζει τι
   * δημιουργείται κατευθείαν vs τι ζητά επιβεβαίωση (intent-aware confirm).
   */
  readonly discreteIntent: 'columns' | 'walls';
  /**
   * ADR-404 Φ5 — όταν true, το εργαλείο σχεδιάζει ΚΕΚΛΙΜΕΝΗ κολώνα: το 1ο κλικ
   * κλειδώνει τη βάση, το 2ο ορίζει πού πέφτει η κορυφή (κλίση). Driven by το
   * ribbon toggle «Κεκλιμένη». Μόνο σε freehand + ελεύθερη τοποθέτηση (όχι face-snap).
   */
  readonly slantMode: boolean;
  readonly overrides: ColumnParamOverrides;
  /** ADR-419 «Κολώνα σε περιοχή» — accumulated 4-line picks (mirror του τοίχου). */
  readonly regionPicks: readonly RegionLineSeg[];
  readonly error: string | null;
}

export const INITIAL_STATE: ColumnToolState = {
  phase: 'idle',
  kind: 'rectangular',
  anchor: 'center',
  placementMode: 'freehand',
  regionMethod: 'lines',
  discreteIntent: 'columns',
  slantMode: false,
  overrides: {},
  regionPicks: [],
  error: null,
};

// ─── Hook options + return ───────────────────────────────────────────────────

export interface UseColumnToolOptions {
  /** Callback fired μετά από επιτυχές build + commit (single placement). */
  readonly onColumnCreated?: (entity: ColumnEntity) => void;
  /**
   * ADR-524 — batch callback: προσθέτει ΠΟΛΛΕΣ κολόνες ΜΑΖΙ (ΕΝΑΣ adapter, ΕΝΑ undo).
   * Χρησιμοποιείται από τα multi-column paths (region box / discrete-perimeter /
   * batch-fill) ΑΝΤΙ N× `onColumnCreated` — αλλιώς N adapters → stale-scene race.
   * Omit ⇒ τα batch paths πέφτουν πίσω σε per-entity `onColumnCreated`.
   */
  readonly onColumnsCreated?: (entities: readonly ColumnEntity[]) => void;
  /** Layer ID στο οποίο γράφεται η νέα column. */
  readonly currentLevelId?: string;
  /** Returns the active scene's coordinate units for correct mm→canvas conversion. */
  readonly getSceneUnits?: () => SceneUnits;
  /**
   * ADR-363 Φάση 3 — live scene entities getter για το 'outer-perimeter' mode
   * (ανάλυση των παρειών στο box-select / click-inside). Omit ⇒ το «από
   * περίγραμμα» γίνεται no-op.
   */
  readonly getSceneEntities?: () => readonly Entity[];
}

export interface UseColumnToolResult {
  readonly state: ColumnToolState;
  activate(): void;
  /** Switch active kind (4 kinds). Resets the state machine. */
  setKind(kind: ColumnKind): void;
  /**
   * ADR-363 Φάση 3 — switch placement mode ('freehand' ⇄ 'outer-perimeter').
   * Resets the state machine (κρατά kind + anchor + overrides). Driven by the
   * active tool id ('column' → freehand, 'column-from-perimeter' → outer-perimeter).
   */
  setPlacementMode(mode: ColumnPlacementMode): void;
  /** ADR-419 — in-region method ('lines' | 'inside' | 'box'), driven by tool id. */
  setRegionMethod(method: RegionMethod): void;
  /** ADR-419 — discrete-from-perimeter intent ('columns' | 'walls'), driven by tool id. */
  setDiscreteIntent(intent: 'columns' | 'walls'): void;
  /** Explicit anchor selector (used από ribbon combobox). */
  setAnchor(anchor: ColumnAnchor): void;
  /** ADR-404 Φ5 — toggle «Κεκλιμένη» (slanted column 2-click placement). */
  setSlantMode(slantMode: boolean): void;
  /** Tab cycles through 9-state ring (ANCHOR_CYCLE_ORDER). */
  cycleAnchor(direction?: 1 | -1): void;
  deactivate(): void;
  reset(): void;
  /** Returns true αν το click commit-άρισε νέα column. */
  onCanvasClick(point: Readonly<Point2D>): boolean;
  /** ADR-419 — deduped ids των accumulated in-region picks (selection highlight). */
  getRegionPickIds(): string[];
  /** Dynamic Input field overrides (width / depth / height / rotation). */
  setParamOverrides(overrides: ColumnParamOverrides): void;
  /** Status text για status-bar / Dynamic Input prompt (i18n key). */
  getStatusText(): string;
  readonly isActive: boolean;
  readonly isAwaitingPosition: boolean;
}
