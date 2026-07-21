/**
 * ADR-375 — BIM Object Styles (Revit-equivalent, Tier 2)
 * ADR-377 — SubcategoryStyle extension
 *
 * Per category: { projectionPen, cutPen } pen assignments + optional subcategory overrides.
 * Defaults match Revit Architectural Template (verified 2026-05-25).
 *
 * Phase A: hard-coded defaults, SubcategoryStyle extension (ADR-377).
 * Phase B: user customization via ribbon + Firestore persistence.
 */
import type { PenIndex } from './bim-pen-table';
import type { LinePatternKey } from './bim-line-patterns';
import type { StructuralComponent } from './bim-structural-components';
// ADR-375 Phase D — equipment teal SSoT (reused for electrical-panel + thermal-space).
import { MEP_TEAL_COLOR } from './color-config';

/**
 * ADR-375 Phase C.9 — Revit-grade προκαθορισμένα ΧΡΩΜΑΤΑ γραμμής ανά κατηγορία.
 *
 * Κλειδωμένη παλέτα (Giorgio 2026-06-08, «Εξευγενισμένη της εφαρμογής»). Κοινό
 * projection/cut χρώμα ανά κατηγορία (όπως η μία στήλη «Line Color» των Revit
 * Object Styles). Η Revit default είναι κυρίως μαύρο + ιεραρχία πάχους — αυτή η
 * παλέτα είναι θεμιτή house-style επέκταση που δίνει διακριτή χρωματική ταυτότητα.
 *
 * SSoT: τα `projectionColor`/`cutColor` στο `DEFAULT_OBJECT_STYLES` οδηγούν ΚΑΙ το
 * 2D outline (resolveSubcategoryStyle) ΚΑΙ τα 3D edge overlays (resolve3DEdgeStyle)
 * — μηδέν hardcoded χρώμα στους renderers.
 */
// ADR-445 — Per-category structural colour identity (Giorgio 2026-06-12). Working-view
// convention (Revit filters / Tekla): each structural CATEGORY gets one distinct, muted,
// construction-evocative hue so types read apart at a glance instead of all-grey. Walls
// stay neutral (most numerous = background); columns blue, beams amber, foundation sienna,
// stairs teal, railings steel-grey. Sub-types are TINTS of the category base (a column
// always reads blue). These drive 2D outline + 3D edge overlays via resolveSubcategoryStyle.
export const BIM_CATEGORY_LINE_COLORS = {
  /** Εξωτερικός τοίχος — σχεδόν μαύρο, βαρύ ουδέτερο (parent `wall`). */
  wallExterior: '#2b2f36',
  /** Εσωτερικός τοίχος — γκρι μεσαίο (subcategory `wall:interior`). */
  wallInterior: '#6b7280',
  /** Κολώνα — steel blue, κρίσιμο κατακόρυφο (parent `column`). */
  column: '#2f6690',
  /** Τοιχίο Ω.Σ. — βαθύ μπλε-RC, ίδια οικογένεια με κολώνα (subcategory `column:shear-wall`). */
  shearWall: '#24506b',
  /** Δοκός — amber, οριζόντιο (αντίθεση με μπλε κολώνες, parent `beam`). */
  beam: '#b07d1f',
  /** Πλάκα — taupe, μεγάλη επιφάνεια φόντου (parent `slab`). */
  slab: '#6e6358',
  /** Πόρτα — πορτοκαλί ξύλου (opening door-* subcategories). */
  door: '#c97c2f',
  /** Παράθυρο — μπλε τζαμιού (opening window-* subcategories). */
  window: '#2d72b8',
  /** Θεμελίωση — sienna/γήινο, κάτω από τη στάθμη (parent `foundation`). */
  foundation: '#8a5a3c',
  /** Σκάλα — teal-green, κυκλοφορία (parent `stair`). */
  stair: '#2f8f6f',
  /** Κιγκλίδωμα — ψυχρό steel-grey, λεπτό μέταλλο (parent `railing`). */
  railing: '#607080',
  // ── ADR-375 Phase D — MEP / έπιπλα / σύμβολα / αναλυτικές ταυτότητες χρώματος ──
  // Μεταφέρθηκαν στο SSoT ώστε να τα οδηγεί ο resolveSubcategoryStyle (2D outline)
  // + τα 3D edge overlays, και να δουλεύουν τα per-view V/G color overrides.
  // Πριν ήταν hardcoded τοπικές σταθερές μέσα σε κάθε renderer (N.0.2 duplicate).
  /** Έπιπλο — tan ξύλου (parent `furniture`, ADR-410). */
  furniture: '#8b5e34',
  /** Παραμετρικό στερεό — indigo (parent `generic-solid`, ADR-684). */
  genericSolid: '#7b6cff',
  /** Είδος υγιεινής — cool blue (parent `sanitary`, ADR-415). */
  sanitary: '#0369a1',
  /** Στοιχείο κουζίνας — πράσινο casework (parent `kitchen`, ADR-415). */
  kitchen: '#047857',
  /** Ηλεκτρικός πίνακας — equipment teal (parent `electrical-panel`, ADR-408). */
  electricalPanel: MEP_TEAL_COLOR,
  /** Θέρμανση νερού — hydronic warm-red (καλοριφέρ/λέβητας/ενδοδαπέδια, ADR-408 Εύρος Β). */
  hydronicHeating: '#dc2626',
  /** Θερμοσίφωνας — DHW μπλε (parent `mep-water-heater`, ADR-408). */
  domesticHotWater: '#1d4ed8',
  /** Θερμικός χώρος — analytical teal (parent `thermal-space`, ADR-422/571). */
  thermalSpace: MEP_TEAL_COLOR,
  /** Διαχωριστής χώρου — analytical violet (parent `space-separator`, ADR-437). */
  spaceSeparator: '#9333ea',
} as const;

/**
 * Discriminated entity categories matching our BIM renderers.
 * Each maps to projection + cut pen indices (Revit Object Styles).
 */
export type BimCategory =
  | 'wall'
  | 'column'
  | 'beam'
  | 'slab'
  | 'opening'
  | 'slab-opening'
  | 'stair'
  | 'roof'
  | 'ceiling'
  | 'dimension'
  | 'hatch'
  | 'grip'
  // ADR-396 P4 — ETICS εξωτερική θερμοπρόσοψη (floor-overlay, V/G κατηγορία).
  | 'envelope'
  // ADR-406 — MEP point-based fixtures (electrical lighting). Granular V/G per type.
  | 'light-fixture'
  // ADR-408 Φ3 — electrical panel / distribution board (circuit source).
  | 'electrical-panel'
  // ADR-408 Φ12 — plumbing manifold / συλλέκτης (pipe-network source).
  | 'mep-manifold'
  // ADR-408 Εύρος Β — heating radiator / καλοριφέρ (hydronic terminal).
  | 'mep-radiator'
  // ADR-408 Εύρος Β #2 — heating boiler / λέβητας (hydronic source).
  | 'mep-boiler'
  // ADR-408 DHW — domestic hot water heater / θερμοσίφωνας (DHW source, plumbing).
  | 'mep-water-heater'
  // ADR-408 Εύρος Β #3 — underfloor heating loop / ενδοδαπέδια θέρμανση (hydronic terminal, area).
  | 'mep-underfloor'
  // ADR-407 — standalone path-based railing (architectural).
  | 'railing'
  // ADR-408 Φ7 — home-run circuit wires (derived electrical annotation overlay).
  | 'mep-wire'
  // ADR-410 — mesh-based CC0 furniture (interior discipline).
  | 'furniture'
  // ADR-408 Φ8 — linear MEP duct run (mechanical discipline).
  | 'duct'
  // ADR-408 Φ8 — linear MEP pipe run (plumbing discipline).
  | 'pipe'
  // ADR-408 Φ14 — sanitary drainage pipe run (plumbing); derived from a pipe whose
  // classification is 'sanitary-drainage', so it toggles independently of water pipes.
  | 'drain-pipe'
  // ADR-415 — pure-vector 2D sanitary plan symbol (WC/washbasin/…; plumbing).
  | 'sanitary'
  // ADR-415 — pure-vector 2D kitchen plan symbol (sink/stove/fridge/counter; casework).
  | 'kitchen'
  // ADR-419 — per-room floor-finish covering (IfcCovering FLOORING, architectural).
  | 'floor-finish'
  // ADR-511 — per-room/per-face wall covering (IfcCovering CLADDING/INTERIOR, architectural).
  | 'wall-covering'
  // ADR-422 — analytical thermal space / θερμικός χώρος (IfcSpace, architectural overlay).
  | 'thermal-space'
  // ADR-437 — space separator / γραμμή διαχωρισμού χώρου (IfcVirtualElement, architectural overlay).
  | 'space-separator'
  // ADR-434 — gas/oil fuel supply run (μηχανολογικό· own V/G discipline, yellow gas convention).
  | 'fuel'
  // ADR-436 — θεμελίωση / substructure (πέδιλα/πεδιλοδοκοί/συνδετήριες δοκοί, structural).
  | 'foundation'
  // ADR-684 — παραμετρικό γεωμετρικό στερεό (κουτί/σφαίρα/…/torus/πυραμίδα).
  | 'generic-solid';

/**
 * Per-subcategory style overrides (ADR-377).
 * All fields optional — absent field falls back to parent ObjectStyle value.
 * Color null → use canvas token (light/dark adaptive).
 */
export interface SubcategoryStyle {
  cutPen?: PenIndex;
  projectionPen?: PenIndex;
  /** Line pattern override (absent → 'solid'). */
  linePattern?: LinePatternKey;
  /** Cut color hex or null (null → canvas token). */
  cutColor?: string | null;
  /** Projection color hex or null (null → canvas token). */
  projectionColor?: string | null;
}

/** ADR-375 Phase C.5 — Per-element style override (Revit "Override Graphics in View by Element"). */
export interface BimElementStyleOverride {
  /** false = hide this element entirely, regardless of category/subcategory visibility. */
  visible?: boolean;
  /** Pen for projection pass. Wins over subcategory + objectStyles. */
  projectionPen?: PenIndex;
  /** Pen for cut pass. Wins over subcategory + objectStyles. */
  cutPen?: PenIndex;
  /** Color hex or null (null = canvas token). undefined = no override. */
  color?: string | null;
  /** Line pattern override. */
  linePattern?: LinePatternKey;
  /**
   * ADR-470 — per-element structural component visibility override (Revit-grade,
   * wins over the per-view `showStructuralCore`/`showFinishSkin`/`showReinforcement`
   * flags). Absent component key ⇒ fall back to the view-level flag. Resolved by
   * `bim/visibility/structural-component-visibility.ts → isStructuralComponentVisible`.
   */
  componentVisibility?: Partial<Record<StructuralComponent, boolean>>;
}

export interface ObjectStyle {
  /** Pen used when element is in projection (not cut by plane). */
  projectionPen: PenIndex;
  /** Pen used when element is cut by view plane. */
  cutPen: PenIndex;
  // ── ADR-375 Phase C.4 — Visibility/Graphics per-view overrides ────────────
  /** false = hide this category entirely for the current view. Default: true. */
  visible?: boolean;
  /** Hex color for projection lines (null = use canvas token). */
  projectionColor?: string | null;
  /** Hex color for cut lines (null = use canvas token). */
  cutColor?: string | null;
  /** Line pattern override for projection lines. */
  projectionPattern?: LinePatternKey;
  /** Line pattern override for cut lines. */
  cutPattern?: LinePatternKey;
  // ─────────────────────────────────────────────────────────────────────────
  /** Per-subcategory style overrides (ADR-377). Keys validated by SUBCATEGORY_TAXONOMY. */
  subcategories?: Partial<Record<string, SubcategoryStyle>>;
}

/**
 * Default Object Styles — Revit Architectural Template equivalent.
 *
 * Visual hierarchy (thicker → thinner):
 *   Column cut (Pen #9 ≈ 0.70mm) > Wall/Slab cut (Pen #7 ≈ 0.35mm)
 *   > Beam cut (Pen #6 ≈ 0.25mm) > Stair cut (Pen #5 ≈ 0.18mm)
 *   > Opening (Pen #4 ≈ 0.13mm) > Dimension/Annotation (Pen #3 ≈ 0.10mm)
 *
 * Per ADR-375 §3.3 + Q0 locked hierarchy.
 */
/** All BIM categories in display order (matches DEFAULT_OBJECT_STYLES keys). */
export const BIM_CATEGORIES: readonly BimCategory[] = [
  'wall', 'column', 'beam', 'slab', 'opening', 'slab-opening',
  'stair', 'roof', 'ceiling', 'dimension', 'hatch', 'grip', 'envelope',
  'light-fixture', 'electrical-panel', 'mep-manifold', 'mep-radiator', 'mep-boiler', 'mep-water-heater', 'mep-underfloor', 'railing', 'mep-wire', 'furniture', 'generic-solid',
  'duct', 'pipe', 'fuel', 'drain-pipe', 'sanitary', 'kitchen',
  // ADR-436 — θεμελίωση.
  'foundation',
] as const;

/**
 * Model BIM object categories — the elements a user places on the canvas (Revit
 * "Model Categories"), as opposed to annotation/helper categories (`dimension`,
 * `hatch`, `grip`) that are not BIM objects per se.
 *
 * SSoT for the "Hide BIM / Show only DXF" ribbon toggle (ADR-375 C.8): hiding
 * all of these leaves only the imported DXF entities visible. Consumed by
 * `setBimObjectsVisibility` in `bim-render-settings-store`.
 *
 * ADR-405: renamed from `STRUCTURAL_BIM_CATEGORIES` (misnomer — it includes BOTH
 * architectural AND structural categories). The old name is kept below as a
 * deprecated alias for zero-break.
 */
export const MODEL_BIM_CATEGORIES: readonly BimCategory[] = [
  'wall', 'column', 'beam', 'slab', 'opening', 'slab-opening',
  'stair', 'roof', 'ceiling', 'envelope',
  // ADR-406 — MEP point-based fixtures.
  'light-fixture',
  // ADR-408 Φ3 — electrical panel.
  'electrical-panel',
  // ADR-408 Φ12 — plumbing manifold (συλλέκτης).
  'mep-manifold',
  // ADR-408 Εύρος Β — heating radiator (καλοριφέρ).
  'mep-radiator',
  // ADR-408 Εύρος Β #2 — heating boiler (λέβητας, hydronic source).
  'mep-boiler',
  // ADR-408 DHW — domestic hot water heater (θερμοσίφωνας, DHW source).
  'mep-water-heater',
  // ADR-408 Εύρος Β #3 — underfloor heating loop (ενδοδαπέδια, hydronic terminal area).
  'mep-underfloor',
  // ADR-407 — standalone path-based railing.
  'railing',
  // ADR-408 Φ7 — home-run circuit wires (hidden by "Show only DXF" with the rest).
  'mep-wire',
  // ADR-410 — mesh-based CC0 furniture.
  'furniture',
  // ADR-684 — παραμετρικά γεωμετρικά στερεά.
  'generic-solid',
  // ADR-408 Φ8 — linear MEP duct + pipe runs.
  'duct', 'pipe',
  // ADR-434 — gas/oil fuel supply run.
  'fuel',
  // ADR-408 Φ14 — sanitary drainage pipe run.
  'drain-pipe',
  // ADR-415 — pure-vector 2D floorplan symbols (sanitary + kitchen).
  'sanitary', 'kitchen',
  // ADR-436 — θεμελίωση (πέδιλα/πεδιλοδοκοί/συνδετήριες δοκοί).
  'foundation',
] as const;

/**
 * @deprecated ADR-405 — use {@link MODEL_BIM_CATEGORIES}. Kept as an alias so the
 * ADR-375 C.8 consumers (store + HideBimToggle) keep working unchanged.
 */
export const STRUCTURAL_BIM_CATEGORIES = MODEL_BIM_CATEGORIES;

export const DEFAULT_OBJECT_STYLES: Readonly<Record<BimCategory, ObjectStyle>> = {
  // ADR-375 C.9 — εξωτ. τοίχος = parent χρώμα (σκούρο/βαρύ)· εσωτ. τοίχος = subcategory `interior` (γκρι).
  wall: {
    projectionPen: 5, cutPen: 7,
    projectionColor: BIM_CATEGORY_LINE_COLORS.wallExterior,
    cutColor: BIM_CATEGORY_LINE_COLORS.wallExterior,
    subcategories: {
      interior: {
        projectionColor: BIM_CATEGORY_LINE_COLORS.wallInterior,
        cutColor: BIM_CATEGORY_LINE_COLORS.wallInterior,
      },
    },
  },
  // ADR-375 C.9 — κολώνα = parent (slate)· τοιχίο Ω.Σ. = subcategory `shear-wall` (σκούρο μπλε-RC).
  column: {
    projectionPen: 5, cutPen: 9,
    projectionColor: BIM_CATEGORY_LINE_COLORS.column,
    cutColor: BIM_CATEGORY_LINE_COLORS.column,
    subcategories: {
      'shear-wall': {
        projectionColor: BIM_CATEGORY_LINE_COLORS.shearWall,
        cutColor: BIM_CATEGORY_LINE_COLORS.shearWall,
      },
    },
  },
  // ADR-445 — δοκός = amber (οριζόντιο φέρον, αντίθεση με μπλε κολώνες).
  beam: {
    projectionPen: 4, cutPen: 6,
    projectionColor: BIM_CATEGORY_LINE_COLORS.beam,
    cutColor: BIM_CATEGORY_LINE_COLORS.beam,
    subcategories: { 'hidden-lines': { linePattern: 'dashed' } },
  },
  // ADR-375 C.9 — πλάκα = taupe (μονόχρωμο· οι ανά-kind αποχρώσεις ζουν στο fill SSoT).
  slab: {
    projectionPen: 5, cutPen: 7,
    projectionColor: BIM_CATEGORY_LINE_COLORS.slab,
    cutColor: BIM_CATEGORY_LINE_COLORS.slab,
  },
  // ADR-375 C.9 — κούφωμα: πόρτα πορτοκαλί / παράθυρο μπλε ανά subcategory (ο
  // OpeningRenderer περνά ήδη per-kind subcat). Parent = ουδέτερο fallback (door tone).
  opening: {
    projectionPen: 3, cutPen: 4,
    projectionColor: BIM_CATEGORY_LINE_COLORS.door,
    cutColor: BIM_CATEGORY_LINE_COLORS.door,
    subcategories: {
      'door-opening':      { projectionColor: BIM_CATEGORY_LINE_COLORS.door,   cutColor: BIM_CATEGORY_LINE_COLORS.door },
      'door-frame':        { projectionColor: BIM_CATEGORY_LINE_COLORS.door,   cutColor: BIM_CATEGORY_LINE_COLORS.door },
      'door-glass':        { projectionColor: BIM_CATEGORY_LINE_COLORS.door,   cutColor: BIM_CATEGORY_LINE_COLORS.door },
      'door-plan-swing':   { projectionColor: BIM_CATEGORY_LINE_COLORS.door,   cutColor: BIM_CATEGORY_LINE_COLORS.door },
      'wall-cutout-jambs': { projectionColor: BIM_CATEGORY_LINE_COLORS.door,   cutColor: BIM_CATEGORY_LINE_COLORS.door },
      'sliding-track':     { projectionColor: BIM_CATEGORY_LINE_COLORS.door,   cutColor: BIM_CATEGORY_LINE_COLORS.door },
      'window-opening':    { projectionColor: BIM_CATEGORY_LINE_COLORS.window, cutColor: BIM_CATEGORY_LINE_COLORS.window },
      'window-frame':      { projectionColor: BIM_CATEGORY_LINE_COLORS.window, cutColor: BIM_CATEGORY_LINE_COLORS.window },
      'window-glass':      { projectionColor: BIM_CATEGORY_LINE_COLORS.window, cutColor: BIM_CATEGORY_LINE_COLORS.window },
    },
  },
  'slab-opening': { projectionPen: 3,  cutPen: 4  },
  // ADR-445 — σκάλα = teal-green (κυκλοφορία). Το χρώμα δίνει ΚΑΙ το 2D fill tint
  // (resolveVgFillTint) — πρώτη φορά που η σκάλα αποκτά διακριτό γέμισμα.
  stair: {
    projectionPen: 3, cutPen: 5,
    projectionColor: BIM_CATEGORY_LINE_COLORS.stair,
    cutColor: BIM_CATEGORY_LINE_COLORS.stair,
    subcategories: {
      'walkline':  { linePattern: 'dashed'  },
      'handrails': { linePattern: 'dashed2' },
    },
  },
  roof:           { projectionPen: 5,  cutPen: 6  },
  ceiling:        { projectionPen: 3,  cutPen: 4  },
  dimension:      { projectionPen: 3,  cutPen: 3  },
  hatch:          { projectionPen: 1,  cutPen: 1  },
  grip:           { projectionPen: 3,  cutPen: 3  },
  // ADR-396 P4 — ETICS θερμοπρόσοψη: λεπτή γραμμή (όπως opening), thin hatch band.
  envelope:       { projectionPen: 3,  cutPen: 4  },
  // ADR-406 — MEP φωτιστικό: λεπτή γραμμή προβολής (annotation-grade family symbol).
  'light-fixture': { projectionPen: 3, cutPen: 3 },
  // ADR-408 Φ3 — ηλεκτρικός πίνακας: μεσαία γραμμή (equipment box). ADR-375 Φ D — teal ταυτότητα.
  'electrical-panel': {
    projectionPen: 4, cutPen: 5,
    projectionColor: BIM_CATEGORY_LINE_COLORS.electricalPanel,
    cutColor: BIM_CATEGORY_LINE_COLORS.electricalPanel,
  },
  // ADR-408 Φ12 — συλλέκτης ύδρευσης: μεσαία γραμμή (plumbing equipment bar). Χρώμα per-kind
  // (νερό cyan-teal / αποχέτευση καφέ) → μένει δυναμικό στον renderer, όχι στατική ταυτότητα εδώ.
  'mep-manifold': { projectionPen: 4, cutPen: 5 },
  // ADR-408 Εύρος Β — καλοριφέρ: μεσαία γραμμή (heating equipment panel). ADR-375 Φ D — hydronic red.
  'mep-radiator': {
    projectionPen: 4, cutPen: 5,
    projectionColor: BIM_CATEGORY_LINE_COLORS.hydronicHeating,
    cutColor: BIM_CATEGORY_LINE_COLORS.hydronicHeating,
  },
  // ADR-408 Εύρος Β #2 — λέβητας: μεσαία γραμμή (heating source cabinet). ADR-375 Φ D — hydronic red.
  'mep-boiler': {
    projectionPen: 4, cutPen: 5,
    projectionColor: BIM_CATEGORY_LINE_COLORS.hydronicHeating,
    cutColor: BIM_CATEGORY_LINE_COLORS.hydronicHeating,
  },
  // ADR-408 DHW — θερμοσίφωνας: μεσαία γραμμή (plumbing equipment cabinet). ADR-375 Φ D — DHW μπλε.
  'mep-water-heater': {
    projectionPen: 4, cutPen: 5,
    projectionColor: BIM_CATEGORY_LINE_COLORS.domesticHotWater,
    cutColor: BIM_CATEGORY_LINE_COLORS.domesticHotWater,
  },
  // ADR-408 Εύρος Β #3 — ενδοδαπέδια θέρμανση: λεπτή γραμμή. ADR-375 Φ D — hydronic red.
  'mep-underfloor': {
    projectionPen: 3, cutPen: 4,
    projectionColor: BIM_CATEGORY_LINE_COLORS.hydronicHeating,
    cutColor: BIM_CATEGORY_LINE_COLORS.hydronicHeating,
  },
  // ADR-407 — κάγκελο: μεσαία γραμμή προβολής (metal members, plan symbol).
  // ADR-445 — ψυχρό steel-grey ταυτότητα (λεπτό μέταλλο).
  railing: {
    projectionPen: 4, cutPen: 5,
    projectionColor: BIM_CATEGORY_LINE_COLORS.railing,
    cutColor: BIM_CATEGORY_LINE_COLORS.railing,
  },
  // ADR-408 Φ7 — καλώδιο κυκλώματος: λεπτή γραμμή annotation (το χρώμα έρχεται
  // per-system από το `systemColor`, όχι από εδώ — η κατηγορία δίνει μόνο V/G).
  'mep-wire':     { projectionPen: 3, cutPen: 3 },
  // ADR-410 — έπιπλο: λεπτή γραμμή footprint (interior plan symbol). ADR-375 Φ D — tan ταυτότητα.
  furniture: {
    projectionPen: 3, cutPen: 3,
    projectionColor: BIM_CATEGORY_LINE_COLORS.furniture,
    cutColor: BIM_CATEGORY_LINE_COLORS.furniture,
  },
  // ADR-684 — παραμετρικό στερεό: λεπτή γραμμή footprint (κάτοψη), indigo ταυτότητα.
  'generic-solid': {
    projectionPen: 3, cutPen: 3,
    projectionColor: BIM_CATEGORY_LINE_COLORS.genericSolid,
    cutColor: BIM_CATEGORY_LINE_COLORS.genericSolid,
  },
  // ADR-408 Φ8 — αεραγωγός: μεσαία γραμμή (mechanical duct run, plan rectangle).
  duct:           { projectionPen: 4, cutPen: 5 },
  // ADR-408 Φ8 — σωλήνας: λεπτή γραμμή (plumbing pipe run, plan centerline).
  pipe:           { projectionPen: 3, cutPen: 4 },
  // ADR-434 — σωλήνας αερίου/καυσίμου: ίδιο pen με τον σωλήνα (το κίτρινο έρχεται από το
  // classification/domain, όχι από εδώ — η κατηγορία δίνει μόνο ξεχωριστό V/G).
  fuel:           { projectionPen: 3, cutPen: 4 },
  // ADR-408 Φ14 — σωλήνας αποχέτευσης: ίδιο pen με τον σωλήνα (το καφέ χρώμα έρχεται
  // από το classification, όχι από εδώ — η κατηγορία δίνει μόνο ξεχωριστό V/G).
  'drain-pipe':   { projectionPen: 3, cutPen: 4 },
  // ADR-415 — είδος υγιεινής: λεπτή γραμμή (annotation-grade plan symbol). ADR-375 Φ D — cool blue.
  sanitary: {
    projectionPen: 3, cutPen: 3,
    projectionColor: BIM_CATEGORY_LINE_COLORS.sanitary,
    cutColor: BIM_CATEGORY_LINE_COLORS.sanitary,
  },
  // ADR-415 — στοιχείο κουζίνας: λεπτή γραμμή (casework plan symbol). ADR-375 Φ D — casework green.
  kitchen: {
    projectionPen: 3, cutPen: 3,
    projectionColor: BIM_CATEGORY_LINE_COLORS.kitchen,
    cutColor: BIM_CATEGORY_LINE_COLORS.kitchen,
  },
  // ADR-419 — επικάλυψη δαπέδου ανά δωμάτιο: λεπτή γραμμή (IfcCovering FLOORING, interior hatch).
  'floor-finish': { projectionPen: 3, cutPen: 3 },
  'wall-covering': { projectionPen: 3, cutPen: 3 },
  // ADR-422 — θερμικός χώρος: λεπτή γραμμή (IfcSpace analytical overlay). ADR-375 Φ D — analytical teal.
  'thermal-space': {
    projectionPen: 3, cutPen: 3,
    projectionColor: BIM_CATEGORY_LINE_COLORS.thermalSpace,
    cutColor: BIM_CATEGORY_LINE_COLORS.thermalSpace,
  },
  // ADR-437 — διαχωριστής χώρου: λεπτή γραμμή (IfcVirtualElement). ADR-375 Φ D — analytical violet.
  'space-separator': {
    projectionPen: 3, cutPen: 3,
    projectionColor: BIM_CATEGORY_LINE_COLORS.spaceSeparator,
    cutColor: BIM_CATEGORY_LINE_COLORS.spaceSeparator,
  },
  // ADR-436 — θεμελίωση: μεσαία γραμμή (below-grade structural). Foundation-plan
  // 2Δ διακεκομμένη σύμβαση + subcategories wiring = Slice 1 (renderer).
  foundation: {
    projectionPen: 4, cutPen: 6,
    projectionColor: BIM_CATEGORY_LINE_COLORS.foundation,
    cutColor: BIM_CATEGORY_LINE_COLORS.foundation,
  },
} as const;
