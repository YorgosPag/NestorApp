/**
 * ADR-587 Φ3b-2 (Seam 2) — Tool-active → contextual-tab trigger resolver (SSoT).
 *
 * Το **tool-active** μισό του `useActiveContextualTrigger`: «ποιο contextual tab
 * ανοίγει όταν είναι ΕΝΕΡΓΟ ένα εργαλείο» (πριν το πρώτο κλικ). Ήταν ~30 σειριακά
 * `if (activeTool === 'x' || …) return X_TRIGGER`. Τα **1:1 & 1:many static**
 * tool→trigger branches γίνονται ΕΝΑ `Map` lookup· τα **μη-εκφράσιμα-ως-πίνακα**
 * (predicate / prefix / sticky) μένουν ρητά ως escape-hatch **μετά** το lookup.
 *
 * **ToolType-keyed, ΟΧΙ entity-keyed (§5.1):** μία οντότητα → ΠΟΛΛΑ tools· ο χάρτης
 * ζει στο tool layer, ΟΧΙ στον `EntityTypeDescriptor`. Layering (§5.2, mirror Φ3a):
 * τα trigger tokens είναι UI/ribbon artifacts (`ui/ribbon/data/*`)· το module ζει
 * στο app layer και δένεται στο domain μέσω coverage test — ΟΧΙ import μέσα σε
 * render/tool-definitions core (θα αντέστρεφε το dependency direction).
 *
 * **Behavior-preserving by construction:** τα static map keys είναι ΞΕΝΑ (disjoint)
 * προς τα predicate domains (`isWallDrawingTool` / `isColumnRegionTool` / `guide-` /
 * `dim-` prefixes / line-modify). Άρα το «map-first, μετά predicates» δίνει ΑΚΡΙΒΩΣ
 * το ίδιο αποτέλεσμα με το αρχικό interleaved if-chain (η disjointness καρφώνεται
 * σε coverage test).
 *
 * ⚠️ ΔΕΝ ανήκουν εδώ οι **stateful pre-rules** (animation-active, wire-selected
 * circuit, mixed electrical/plumbing selection, multi-BIM, selection-side
 * `resolveContextualTrigger`, dimension composite): εξαρτώνται από stores/selection,
 * μένουν στο hook (`useActiveContextualTrigger`). Εδώ ζει ΜΟΝΟ το pure, activeTool-only
 * mapping — που τρέχει αφού καμία pre-rule δεν έπιασε.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-587-entity-type-descriptor-registry-ssot.md
 * @see ./resolve-contextual-trigger.ts (Φ3a — το entity-keyed selection-side αδερφάκι)
 */

import { isColumnRegionTool, isWallDrawingTool } from '../systems/tools/region-tool-ids';
// ADR-587 — every contextual-tab trigger token via the shared barrel (N.18: one import instead
// of ~24 parallel `contextual-*-tab` lines duplicated with `resolve-contextual-trigger.ts`).
import {
  STAIR_CONTEXTUAL_TRIGGER,
  WALL_CONTEXTUAL_TRIGGER,
  OPENING_CONTEXTUAL_TRIGGER,
  SLAB_CONTEXTUAL_TRIGGER,
  ROOF_CONTEXTUAL_TRIGGER,
  COLUMN_CONTEXTUAL_TRIGGER,
  BEAM_CONTEXTUAL_TRIGGER,
  FOUNDATION_CONTEXTUAL_TRIGGER,
  SLAB_OPENING_CONTEXTUAL_TRIGGER,
  LINE_TOOL_CONTEXTUAL_TRIGGER,
  XLINE_MODE_CONTEXTUAL_TRIGGER,
  MEP_SEGMENT_CONTEXTUAL_TRIGGER,
  FLOOR_FINISH_CONTEXTUAL_TRIGGER,
  WALL_COVERING_CONTEXTUAL_TRIGGER,
  HATCH_CONTEXTUAL_TRIGGER,
  THERMAL_SPACE_CONTEXTUAL_TRIGGER,
  FURNITURE_CONTEXTUAL_TRIGGER,
  BLOCK_LIBRARY_CONTEXTUAL_TRIGGER,
  TITLE_BLOCK_CONTEXTUAL_TRIGGER,
  FLOORPLAN_SYMBOL_CONTEXTUAL_TRIGGER,
  ANNOTATION_SYMBOL_CONTEXTUAL_TRIGGER,
  SCALE_BAR_CONTEXTUAL_TRIGGER,
  MEP_FIXTURE_LIBRARY_CONTEXTUAL_TRIGGER,
  MEP_RISER_CONTEXTUAL_TRIGGER,
  GUIDES_CONTEXTUAL_TRIGGER,
  DIMENSIONS_CONTEXTUAL_TRIGGER,
} from '../ui/ribbon/data/contextual-triggers';
import { ANNOTATION_KIND_CONFIGS } from '../config/annotation-kind-registry';

/**
 * Static tool-id → contextual-tab trigger. Πολλαπλά tool ids → ΤΟ ΙΔΙΟ trigger όταν
 * μοιράζονται το ίδιο contextual tab (π.χ. οι 5 «κολώνα» variants, τα 14 «line» tools):
 * είναι 1:many static mapping, όχι predicate — άρα ανήκει στον πίνακα.
 */
export const TOOL_ACTIVE_TRIGGER: ReadonlyMap<string, string> = new Map<string, string>([
  ['stair', STAIR_CONTEXTUAL_TRIGGER],
  ['opening', OPENING_CONTEXTUAL_TRIGGER],
  ['slab', SLAB_CONTEXTUAL_TRIGGER],
  // ADR-417 — roof tool active → roof props (shape/slope defaults for next roof).
  ['roof', ROOF_CONTEXTUAL_TRIGGER],
  // ADR-363 Φ3/3c + ADR-419 — «Κολώνα/Τοιχίο από περίγραμμα» + «σε περιοχή» (box/polygon)
  // μοιράζονται το column tab. Οι region-3way («σε περιοχή» lines/inside/box) πάνε από
  // τον `isColumnRegionTool` escape-hatch — disjoint από αυτά τα explicit ids.
  ['column', COLUMN_CONTEXTUAL_TRIGGER],
  ['column-from-perimeter', COLUMN_CONTEXTUAL_TRIGGER],
  ['column-discrete-from-perimeter', COLUMN_CONTEXTUAL_TRIGGER],
  ['column-discrete-from-perimeter-walls', COLUMN_CONTEXTUAL_TRIGGER],
  ['column-from-polygon', COLUMN_CONTEXTUAL_TRIGGER],
  // ADR-363 «Δοκάρι από τοίχο» μοιράζεται το beam tab.
  ['beam', BEAM_CONTEXTUAL_TRIGGER],
  ['beam-from-wall', BEAM_CONTEXTUAL_TRIGGER],
  // ADR-436 — foundation tools (pad / strip / tie-beam / strip-from-wall). Το tab
  // δείχνει kind-conditional panels· το active kind ορίζεται από το tool id.
  ['foundation-pad', FOUNDATION_CONTEXTUAL_TRIGGER],
  ['foundation-strip', FOUNDATION_CONTEXTUAL_TRIGGER],
  ['foundation-tie-beam', FOUNDATION_CONTEXTUAL_TRIGGER],
  ['foundation-strip-from-wall', FOUNDATION_CONTEXTUAL_TRIGGER],
  // ADR-410 / ADR-415 / ADR-583 — library picker tabs (variant/size for next place).
  ['furniture', FURNITURE_CONTEXTUAL_TRIGGER],
  ['floorplan-symbol', FLOORPLAN_SYMBOL_CONTEXTUAL_TRIGGER],
  // ADR-652 M1.5 — Block Library tool active → «Τοποθέτηση Block» (rotation/scale του επόμενου
  // κλικ). ΧΩΡΙΣ picker: το «ποιο block» το κατέχει το palette «Τα Blocks μου», όχι το ribbon.
  ['block-library', BLOCK_LIBRARY_CONTEXTUAL_TRIGGER],
  // ADR-651 Φάση Γ — εργαλείο «Πινακίδα» ενεργό → «Πινακίδα Σχεδίου» (preset / μέγεθος
  // χαρτιού / προσανατολισμός / κορνίζα ISO 5457 + transform του επόμενου κλικ).
  ['title-block', TITLE_BLOCK_CONTEXTUAL_TRIGGER],
  // ADR-583 Φ1 — every annotation-symbol placement tool (north arrow + future kinds)
  // opens the SAME contextual tab, derived from the kind registry (no per-kind line).
  ...ANNOTATION_KIND_CONFIGS.map((c) => [c.toolId, ANNOTATION_SYMBOL_CONTEXTUAL_TRIGGER] as [string, string]),
  // ADR-583 Φ3e — graphic scale-bar tool active → «Γραφική Κλίμακα» tab (defaults for
  // the next bar: style / unit / divisions / annotative heights / label placement).
  ['scale-bar', SCALE_BAR_CONTEXTUAL_TRIGGER],
  // ADR-419 / ADR-511 — floor-finish + wall-covering (manual ή room-fill).
  ['floor-finish', FLOOR_FINISH_CONTEXTUAL_TRIGGER],
  ['wall-covering', WALL_COVERING_CONTEXTUAL_TRIGGER],
  ['wall-covering-room', WALL_COVERING_CONTEXTUAL_TRIGGER],
  // ADR-507 S2 / ADR-422 — hatch + thermal-space (defaults for next drawn entity).
  ['hatch', HATCH_CONTEXTUAL_TRIGGER],
  ['thermal-space', THERMAL_SPACE_CONTEXTUAL_TRIGGER],
  // ADR-411 — MEP fixture tool active → light-fixture library picker (ΟΧΙ ο editor
  // επιλεγμένου· εκείνος έρχεται από το selection-side resolver, νωρίτερα στο hook).
  ['mep-fixture', MEP_FIXTURE_LIBRARY_CONTEXTUAL_TRIGGER],
  // ADR-408 Φ15 — MEP riser tool active → «Κατακόρυφη Στήλη» (span + diameter).
  ['mep-drain-riser', MEP_RISER_CONTEXTUAL_TRIGGER],
  // ADR-408 Φ8 #2b — pipe/duct/drain draw tool → segment tab (draw-time «Ύψος άξονα»).
  ['mep-pipe', MEP_SEGMENT_CONTEXTUAL_TRIGGER],
  ['mep-duct', MEP_SEGMENT_CONTEXTUAL_TRIGGER],
  ['mep-drain-pipe', MEP_SEGMENT_CONTEXTUAL_TRIGGER],
  ['slab-opening', SLAB_OPENING_CONTEXTUAL_TRIGGER],
  // ADR-359 Φ10.b — xline active → mode selection panel.
  ['xline', XLINE_MODE_CONTEXTUAL_TRIGGER],
  // ADR-357 Φ17 — 2D drawing tools show the Quick Style override panel.
  ['line', LINE_TOOL_CONTEXTUAL_TRIGGER],
  ['line-perpendicular', LINE_TOOL_CONTEXTUAL_TRIGGER],
  ['line-parallel', LINE_TOOL_CONTEXTUAL_TRIGGER],
  ['circle', LINE_TOOL_CONTEXTUAL_TRIGGER],
  ['circle-diameter', LINE_TOOL_CONTEXTUAL_TRIGGER],
  ['circle-2p-diameter', LINE_TOOL_CONTEXTUAL_TRIGGER],
  ['circle-3p', LINE_TOOL_CONTEXTUAL_TRIGGER],
  ['rectangle', LINE_TOOL_CONTEXTUAL_TRIGGER],
  ['polyline', LINE_TOOL_CONTEXTUAL_TRIGGER],
  ['arc-3p', LINE_TOOL_CONTEXTUAL_TRIGGER],
  ['arc-sce', LINE_TOOL_CONTEXTUAL_TRIGGER],
  ['arc-cse', LINE_TOOL_CONTEXTUAL_TRIGGER],
  ['polygon', LINE_TOOL_CONTEXTUAL_TRIGGER],
  ['ellipse', LINE_TOOL_CONTEXTUAL_TRIGGER],
]);

/**
 * ADR-510 Φ4i — line-modify tools (Revit «Modify | Lines»: Trim/Extend/Offset/
 * Fillet/Chamfer) είναι **TAB-NEUTRAL**: πατώντας τα ΔΕΝ αλλάζει το ribbon tab —
 * διατηρούν το τρέχον context (μένουν στο «Στυλ Γραμμής» αν ήταν ανοιχτό, στο Home
 * αλλιώς) αντί να καταρρέουν το tab (trigger → null). SSoT για το set ώστε ΚΑΙ ο
 * resolver ΚΑΙ ο «record last non-modify» effect του hook να το διαβάζουν από εδώ.
 */
const LINE_MODIFY_TOOLS: ReadonlySet<string> = new Set([
  'trim', 'extend', 'offset', 'fillet', 'chamfer',
]);

/** True αν το `activeTool` είναι tab-neutral line-modify εργαλείο (ADR-510 Φ4i). */
export function isLineModifyTool(activeTool: string): boolean {
  return LINE_MODIFY_TOOLS.has(activeTool);
}

/**
 * ADR-510 Φ2E #6 — True όταν το ενεργό εργαλείο είναι primitive-drawing tool που
 * ανοίγει το «Στυλ Γραμμής» contextual tab (line/circle/rectangle/polyline/arc/…).
 * Reuse του ΙΔΙΟΥ `TOOL_ACTIVE_TRIGGER` map (SSoT) → μηδέν δεύτερη λίστα εργαλείων.
 * Το `BimPropertiesRouter` το χρησιμοποιεί για draft-mode `LinePropertiesTab`
 * (Revit «όρισε ιδιότητες → σχεδίασε», mirror τοίχου/γραμμοσκίασης).
 */
export function isLinePrimitiveDrawingTool(activeTool: string | null | undefined): boolean {
  return !!activeTool && TOOL_ACTIVE_TRIGGER.get(activeTool) === LINE_TOOL_CONTEXTUAL_TRIGGER;
}

/**
 * Το pure, activeTool-only μισό της contextual-tab επίλυσης. Καλείται από το
 * `useActiveContextualTrigger` ΑΦΟΥ καμία stateful pre-rule (animation / selection /
 * multi-select) δεν έπιασε.
 *
 * @param activeTool Το ενεργό εργαλείο.
 * @param lastNonModifyTrigger Το τελευταίο NON-modify trigger (sticky ref του hook),
 *        που επιστρέφεται αυτούσιο για τα tab-neutral line-modify εργαλεία.
 * @returns Το contextual-tab trigger, ή `null` αν κανένα εργαλείο δεν ανοίγει tab.
 */
export function resolveToolActiveTrigger(
  activeTool: string,
  lastNonModifyTrigger: string | null,
): string | null {
  const mapped = TOOL_ACTIVE_TRIGGER.get(activeTool);
  if (mapped !== undefined) return mapped;
  // ── Escape-hatch: κανόνες που ένας flat key→value πίνακας δεν εκφράζει ──────────
  // (predicate / prefix / sticky). Disjoint domains μεταξύ τους ΚΑΙ από τα map keys,
  // άρα η σειρά είναι behavior-neutral (καρφωμένο σε coverage test).
  // ADR-363 Φ1K + ADR-443 — «Τοίχος από περίγραμμα/σε περιοχή/σε οντότητα» → wall tab.
  if (isWallDrawingTool(activeTool)) return WALL_CONTEXTUAL_TRIGGER;
  // ADR-419 — «Κολώνα σε περιοχή» (region 3-way) → column tab.
  if (isColumnRegionTool(activeTool)) return COLUMN_CONTEXTUAL_TRIGGER;
  // ADR-442 — κάθε guide tool (`guide-` prefix) → «Οδηγοί» tab (καλύπτει και το
  // guide-selected case: η επιλογή ζει μόνο όσο το guide tool είναι ενεργό).
  if (activeTool.startsWith('guide-')) return GUIDES_CONTEXTUAL_TRIGGER;
  // ADR-362 ΦE3 — κάθε dim creation tool (`dim-` prefix) → «Διαστάσεις» tab.
  if (activeTool.startsWith('dim-')) return DIMENSIONS_CONTEXTUAL_TRIGGER;
  // ADR-510 Φ4i — tab-neutral line-modify: διατήρησε το προηγούμενο context.
  if (isLineModifyTool(activeTool)) return lastNonModifyTrigger;
  return null;
}
