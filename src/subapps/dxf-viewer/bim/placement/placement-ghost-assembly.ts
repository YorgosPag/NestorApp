/**
 * PLACEMENT GHOST ASSEMBLY — κοινό SSoT συναρμολόγησης φαντάσματος τοποθέτησης (ADR-514 Φ6d).
 *
 * **Το «πώς συναρμολογείται το placement ghost + οι ενδείξεις + το πλέγμα» — entity-agnostic, ΜΙΑ
 * φορά.** Πριν, η assembly ζούσε column-only μέσα στο `generateColumnPreview`, και το πέδιλο είχε ένα
 * φτωχό αντίγραφο που κρατούσε μόνο το `snap.point`. Εδώ ζει ΕΝΑΣ κώδικας που μοιράζονται **κολώνα ΚΑΙ
 * πέδιλο** (Giorgio 2026-06-24, «ίδιο σύστημα από μία πηγή αλήθειας, Revit-grade»):
 *
 *   1. **`assemblePlacementGhost`** (awaitingPosition): δοθέντος resolved `BimCursorSnap` (toolKind +
 *      magnet opts διαλέγει ο caller), παράγει το WYSIWYG ghost + **CL listening dimensions** (centerline,
 *      σιελ) ή **καρτεσιανά dx/dy dims** + **polar/rect grid** overlay. Θέση/λαβή/γωνία/status έρχονται
 *      ΟΛΑ από το ΕΝΑ `ColumnFaceSnap` (ο `foundation-pad` toolKind delegate-άρει στον ΙΔΙΟ resolver).
 *   2. **`assemblePlacementRotationGhost`** (awaitingRotation): δοθέντος locked origin+anchor, ζωγραφίζει
 *      την οντότητα στη σταθερή θέση, **περιστρεφόμενη** live προς τον κέρσορα (+ κρατά το grid).
 *
 * Η ΜΟΝΗ entity-specific παράμετρος είναι ο injected `buildEntity(position, anchor, rotation)` (χτίζει
 * `ColumnEntity` vs `FoundationEntity` μέσω των ΙΔΙΩΝ builders με το commit) + το `ghostId` + τα magnet
 * `polarOpts` (διαστάσεις διατομής). **Καμία νέα γεωμετρία** — reuse `resolveGhostFaceDimensionsMeta` +
 * `resolveRectCartesianDims` + `buildPlacementGridMeta` + `toWysiwygPreviewEntity` (όλα ήδη SSoT).
 *
 * Pure-ish: zero React/DOM· διαβάζει μόνο το live `ImmediateTransformStore` (zoom) για τα offsets
 * (όπως ΟΛΑ τα member ghosts). `anchor` typed ως `ColumnAnchor` γιατί αυτό ΑΚΡΙΒΩΣ παράγει ο resolver
 * (`ColumnFaceSnap`)· το `FoundationAnchor` είναι ταυτόσημο string union → ο pad builder το δέχεται.
 *
 * @see ./bim-cursor-snap.ts — ο εγκέφαλος που παράγει το `BimCursorSnap` (column + foundation-pad)
 * @see ../../hooks/drawing/wysiwyg-preview-shared.ts — toWysiwygPreviewEntity / resolveGhostFaceDimensionsMeta
 * @see ./placement-grid-meta.ts — buildPlacementGridMeta (polar/rect grid overlay)
 * @see ../../hooks/drawing/column-preview-helpers.ts · ../../hooks/drawing/foundation-preview-helpers.ts — consumers
 * @see docs/centralized-systems/reference/adrs/ADR-514-unified-bim-cursor-snap.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { SceneUnits } from '../../utils/scene-units';
import type { ExtendedSceneEntity } from '../../hooks/drawing/drawing-types';
import type { ColumnAnchor } from '../types/column-types';
import type { ColumnFaceSnap } from '../columns/column-face-snap';
import type { LCornerSizing } from '../columns/column-beam-corner-snap';
import type { BimCursorSnap } from './bim-cursor-snap';
import type { SceneSnapTargets } from '../framing/scene-snap-targets';
import type { PolarDiskSnapOptions } from '../columns/polar-disk-snap';
import type { GhostFaceDimensionsMeta } from '../framing/ghost-face-dim-references';
import { resolveColumnRotationDeg } from '../columns/column-rotation';
import { resolveGhostStatusColor } from '../ghosts/ghost-status-color';
import { findRectContaining, resolveRectCartesianDims } from '../columns/rect-cartesian-snap';
import { buildPlacementGridMeta } from './placement-grid-meta';
import {
  resolveGhostFaceDimensionsMeta,
  toWysiwygPreviewEntity,
  GHOST_DIM_GAP_OFFSET_PX,
  GHOST_DIM_MIN_PX,
} from '../../hooks/drawing/wysiwyg-preview-shared';
import {
  resolveNeighborClearanceDims,
  resolveGapStepShift,
  NEIGHBOR_DIM_MAX_CLEARANCE_PX,
} from '../framing/neighbor-clearance-dims';
import { resolveMemberFootprintVertices } from '../structural/member-footprint-2d';
// ADR-363 §neighbor-gap-step — Q κρατιέται → στρογγύλεμα του παρειά-προς-παρειά διάκενου (όχι της
// απόστασης κέντρου-από-anchor) προς τη μεριά κίνησης· κοινό shift preview↔commit.
import { activeStepSceneUnits } from '../grips/grip-step-quantize';
import {
  trackGapPlacementCursor,
  getGapPlacementMoveDir,
  setGapPlacementShift,
} from '../../systems/cursor/GapStepPlacementStore';
import type { Entity } from '../../types/entities';
import { worldPerPixel } from '../../rendering/utils/viewport-scale';
import { getImmediateTransform } from '../../systems/cursor/ImmediateTransformStore';

/**
 * Entity-specific builder: χτίζει την ΤΕΛΙΚΗ BIM οντότητα στη θέση/λαβή/γωνία (μέσω των ΙΔΙΩΝ builders
 * με το commit → preview ≡ commit). `rotation: null` = ελεύθερη (ο caller βάζει ribbon rotation στα
 * overrides)· `number` = flush-to-edge (face-snap) ή live (awaitingRotation). Επιστρέφει `null` σε
 * validation fail → το ghost καθαρίζει αυτό το frame. Generic επιστροφή (`object`) → wrapped από το
 * `toWysiwygPreviewEntity` χωρίς `any`.
 *
 * ADR-525 — `sizing` (4ο, optional): auto-διαστασιολόγηση L-κολόνας (corner-gap junction) ως one-shot
 * override· `null`/absent = κρατά τις διαστάσεις του ribbon (μηδέν αλλαγή· ο pad builder το αγνοεί).
 */
export type PlacementGhostEntityBuilder = (
  position: Readonly<Point2D>,
  anchor: ColumnAnchor,
  rotation: number | null,
  sizing?: LCornerSizing | null,
) => object | null;

/** Είσοδος του awaitingPosition assembly. */
export interface PlacementGhostArgs {
  /** Already-resolved snap — ο caller διάλεξε toolKind ('column' | 'foundation-pad') + magnet opts. */
  readonly snap: BimCursorSnap;
  /** OSNAP-snapped cursor που τροφοδότησε το snap (rect-containment ref + grid ref + fallback θέση). */
  readonly effectiveCursor: Readonly<Point2D>;
  readonly targets: Readonly<SceneSnapTargets>;
  readonly sceneUnits: SceneUnits;
  /** Polar/Rect magnet opts (οδηγεί το grid overlay). */
  readonly polarOpts: Readonly<PolarDiskSnapOptions>;
  /** Λαβή όταν ΔΕΝ υπάρχει face-snap (ribbon/Tab λαβή). */
  readonly fallbackAnchor: ColumnAnchor;
  readonly ghostId: string;
  readonly buildEntity: PlacementGhostEntityBuilder;
}

/** Είσοδος του awaitingRotation assembly (locked θέση → live περιστροφή). */
export interface PlacementRotationGhostArgs {
  readonly origin: Readonly<Point2D>;
  readonly anchor: ColumnAnchor;
  /** Raw cursor — η γωνία = origin → cursor (`resolveColumnRotationDeg`, snapped). */
  readonly cursor: Readonly<Point2D>;
  readonly targets: Readonly<SceneSnapTargets>;
  readonly sceneUnits: SceneUnits;
  readonly polarOpts: Readonly<PolarDiskSnapOptions>;
  readonly ghostId: string;
  readonly buildEntity: PlacementGhostEntityBuilder;
}

/**
 * awaitingPosition — συναρμολόγησε το ghost + CL/καρτεσιανά dims + polar/rect grid από το ΕΝΑ snap.
 * `null` όταν ο builder αποτύχει (validation) → το ghost καθαρίζει αυτό το frame (mirror beam).
 */
export function assemblePlacementGhost(args: PlacementGhostArgs): ExtendedSceneEntity | null {
  const { snap, effectiveCursor, targets, sceneUnits, polarOpts, fallbackAnchor, ghostId, buildEntity } = args;

  // θέση + λαβή + status + flush-rotation απευθείας από το ΕΝΑ αποτέλεσμα (ΟΧΙ από stores).
  const faceSnap: ColumnFaceSnap | null = snap.kind === 'column-placement' ? snap.placement : null;
  const position: Point2D = faceSnap ? faceSnap.position : { x: effectiveCursor.x, y: effectiveCursor.y };
  const status = faceSnap?.status ?? 'neutral';
  const anchor: ColumnAnchor = faceSnap?.anchor ?? fallbackAnchor;
  // λοξή ακμή → flush (faceSnap.rotation)· axis-aligned → 0· ελεύθερη → null (ribbon rotation).
  const rotation: number | null = faceSnap ? faceSnap.rotation : null;

  // ADR-525 — auto-διαστασιολόγηση L corner-gap (one-shot)· `null` σε κάθε άλλο snap → ribbon διαστάσεις.
  let entity = buildEntity(position, anchor, rotation, faceSnap?.sizing ?? null);
  if (!entity) return null;

  // 🔴 overlap → status schematic· 🟢/neutral → πλήρες WYSIWYG.
  const isOverlap = status === 'overlap';
  const ghostStatusColor = isOverlap ? resolveGhostStatusColor('overlap') : null;
  const wpp = worldPerPixel(getImmediateTransform().scale);
  // cursor μέσα σε ορθογώνιο → 4 καρτεσιανά dx/dy dims· αλλιώς → CL listening dims (faceFrame, σιελ).
  const rect = findRectContaining(effectiveCursor, targets.rectTargets);
  let faceDimensions: GhostFaceDimensionsMeta | null = (rect && faceSnap && !isOverlap)
    ? { sceneUnits, dims: resolveRectCartesianDims(rect, faceSnap.position) }
    : resolveGhostFaceDimensionsMeta(faceSnap?.faceFrame, isOverlap, sceneUnits, wpp);

  // ADR-363 §neighbor-gap-step — default: το commit δεν μετακινεί (καθαρό κάθε frame· το free+Q block
  // από κάτω το ξαναγράφει). Ώστε ένα προηγούμενο shift να μη «μολύνει» face-snap / non-Q frames.
  setGapPlacementShift({ x: 0, y: 0 });

  // ADR-508 §neighbor-clearance — ΕΛΕΥΘΕΡΟ ghost (κανένα κούμπωμα): έξυπνες προσωρινές διαστάσεις προς
  // τον πλησιέστερο γείτονα ανά κατεύθυνση (Revit temporary dims). Fallback-only → μηδέν διπλή ένδειξη.
  if (!faceDimensions && !isOverlap) {
    let ghostFootprint = resolveMemberFootprintVertices(entity as unknown as Entity);
    // ADR-363 §neighbor-gap-step — Q κρατιέται → στρογγύλεψε το διάκενο προς τη μεριά κίνησης (επιλογή
    // β) μετακινώντας τη θέση· ξαναχτίζει την οντότητα/footprint ΠΡΙΝ τις dims ώστε ο αριθμός που θα
    // δει ο χρήστης να είναι το στρογγυλεμένο. Το ίδιο shift εφαρμόζει και το commit (preview ≡ commit).
    const stepScene = ghostFootprint ? activeStepSceneUnits() : 0;
    if (ghostFootprint && stepScene > 0) {
      trackGapPlacementCursor(position);
      const shift = resolveGapStepShift(ghostFootprint, targets, stepScene, NEIGHBOR_DIM_MAX_CLEARANCE_PX * wpp, getGapPlacementMoveDir());
      setGapPlacementShift(shift ?? { x: 0, y: 0 });
      if (shift && (shift.x !== 0 || shift.y !== 0)) {
        const shifted = buildEntity({ x: position.x + shift.x, y: position.y + shift.y }, anchor, rotation, faceSnap?.sizing ?? null);
        if (shifted) {
          entity = shifted;
          ghostFootprint = resolveMemberFootprintVertices(shifted as unknown as Entity) ?? ghostFootprint;
        }
      }
    }
    if (ghostFootprint) {
      faceDimensions = resolveNeighborClearanceDims(ghostFootprint, targets, sceneUnits, {
        gapOffsetScene: GHOST_DIM_GAP_OFFSET_PX * wpp,
        minValueScene: GHOST_DIM_MIN_PX * wpp,
        maxClearanceScene: NEIGHBOR_DIM_MAX_CLEARANCE_PX * wpp,
        orthoToleranceDeg: 1,
      });
    }
  }

  const ghost = toWysiwygPreviewEntity(entity, ghostId, ghostStatusColor, faceDimensions);
  // polar/rect grid overlay (ΙΔΙΟΣ resolver με το snap → μηδέν απόκλιση πλέγματος↔snap).
  const extra = buildPlacementGridMeta(effectiveCursor, targets, sceneUnits, polarOpts);
  // ADR-398 §3.20 — γραμμή-οδηγός ευθυγράμμισης (τεταρτημόριο κυκλικής ↔ άκρο/μέσον παρειάς), preview-only.
  const guide = (faceSnap && !isOverlap && faceSnap.alignmentGuide) ? { alignmentGuide: faceSnap.alignmentGuide } : {};
  const merged = { ...extra, ...guide };
  return Object.keys(merged).length ? ({ ...ghost, ...merged } as typeof ghost) : ghost;
}

/**
 * awaitingRotation — η οντότητα μένει στην ΚΛΕΙΔΩΜΕΝΗ θέση και ΠΕΡΙΣΤΡΕΦΕΤΑΙ live προς τον κέρσορα.
 * Κρατά την πολική/καρτεσιανή καθοδήγηση γύρω από την κλειδωμένη θέση (ΕΝΑ SSoT helper με το
 * awaitingPosition path). `null` όταν ο builder αποτύχει.
 */
export function assemblePlacementRotationGhost(args: PlacementRotationGhostArgs): ExtendedSceneEntity | null {
  const { origin, anchor, cursor, targets, sceneUnits, polarOpts, ghostId, buildEntity } = args;
  const rotationDeg = resolveColumnRotationDeg(origin, cursor, worldPerPixel(getImmediateTransform().scale));
  const entity = buildEntity(origin, anchor, rotationDeg);
  if (!entity) return null;
  const ghost = toWysiwygPreviewEntity(entity, ghostId, null);
  const grid = buildPlacementGridMeta(origin, targets, sceneUnits, polarOpts);
  return Object.keys(grid).length ? ({ ...ghost, ...grid } as typeof ghost) : ghost;
}
