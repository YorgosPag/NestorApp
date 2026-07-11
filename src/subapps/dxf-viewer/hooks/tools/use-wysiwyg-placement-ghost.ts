/**
 * SSOT — WYSIWYG placement-ghost hook family (ADR-624).
 *
 * ΕΝΑ σημείο για το `draw` skeleton που μοιράζονταν copy-paste τα 2D placement
 * ghost hooks (`use*GhostPreview.ts`). Μετά το ADR-398 §4 (`useCanvasGhostPreview`,
 * που έλυσε το RAF/clear/viewport/cursor scaffolding) και το ADR-574 (WYSIWYG ghost:
 * χτίσε την ΠΛΗΡΗ οντότητα με τους commit builders και ζωγράφισέ την μέσω του
 * ΠΡΑΓΜΑΤΙΚΟΥ renderer, `renderWysiwygPlacementGhost`), κάθε hook είχε πλέον ΤΟΝ ΙΔΙΟ
 * σκελετό draw:
 *
 *   draw = (frame) => {
 *     if (!effectiveCursor) return;
 *     const entity = build…(effectiveCursor);   // ← το ΜΟΝΟ που διέφερε
 *     if (!entity) return;
 *     renderWysiwygPlacementGhost(ctx, entity, transform, viewport);
 *   }
 *
 * Δύο επίπεδα SSoT εδώ:
 *   1. {@link useWysiwygPlacementGhost} — το γενικό primitive: κρατά ΜΟΝΟ το «build →
 *      paint» skeleton πάνω από το `useCanvasGhostPreview` harness. Το χρησιμοποιούν
 *      όλα τα variants (opening/slab-opening/segment) που έχουν bespoke build.
 *   2. {@link createBridgeStorePlacementGhostHook} — factory για την υπο-οικογένεια
 *      «single-point από tool-bridge store» (electrical-panel / mep boiler / manifold /
 *      radiator / water-heater / fixture): διαβάζει `overrides` + `sceneUnits` από το
 *      bridge store, τρέχει `buildDefaultParams` + `buildEntity`, και επιστρέφει έτοιμο
 *      hook. Κάθε consumer γίνεται thin binding 3 γραμμών.
 *
 * @see hooks/tools/useCanvasGhostPreview — shared RAF/clear/viewport harness (ADR-398 §4)
 * @see bim/ghosts/wysiwyg-placement-ghost — renderWysiwygPlacementGhost SSoT (ADR-574)
 * @see docs/centralized-systems/reference/adrs/ADR-624-wysiwyg-placement-ghost-ssot.md
 */

import { useCallback, type DependencyList } from 'react';
import type { Entity, Point2D, ViewTransform } from '../../rendering/types/Types';
import type { SceneUnits } from '../../utils/scene-units';
import { getDefaultLayerId } from '../../stores/LayerStore';
import { renderWysiwygPlacementGhost } from '../../bim/ghosts/wysiwyg-placement-ghost';
import { useCanvasGhostPreview } from './useCanvasGhostPreview';
import type { GhostDrawFrame } from '../../systems/preview/ghost-preview-frame';

// ─── Level 1: the generic placement-ghost primitive ─────────────────────────────

export interface WysiwygPlacementGhostConfig<TBuild = Entity> {
  /** Gate — true ⇒ ενεργό preview (κανονικά `isAwaitingPosition` / `isAwaitingEnd`). */
  readonly isActive: boolean;
  /** Legacy transform prop (ADR-398 §4: το harness διαβάζει live transform). */
  readonly transform: ViewTransform;
  getCanvas(): HTMLCanvasElement | null;
  getViewportElement?(): HTMLElement | null;
  /**
   * Χτίσε το placement payload στον (snapped) effective cursor του frame. Επίστρεψε
   * `null` για να παραλείψεις το WYSIWYG paint αυτού του frame (π.χ. no host / invalid
   * / no cursor). Το ίδιο build που τρέχει το commit → preview ≡ commit by identity.
   */
  buildGhostEntity(frame: GhostDrawFrame): TBuild | null;
  /**
   * Paint του built payload. Default: `TBuild extends Entity` → `renderWysiwygPlacementGhost`.
   * Override για bespoke paint (π.χ. slab-opening out-of-slab 🔴 status schematic).
   */
  paintGhost?(frame: GhostDrawFrame, build: TBuild): void;
  /**
   * Bespoke overlay που ζωγραφίζεται σε ΚΑΘΕ ενεργό frame, ανεξάρτητα από το built
   * payload (π.χ. slab-opening edge-midpoint hover «+» indicator).
   */
  drawOverlay?(frame: GhostDrawFrame): void;
  /**
   * Deps που invalidate-άρουν το draw closure — καθρέφτης του `useCallback` deps array
   * κάθε hook (κενό όταν το build διαβάζει ό,τι χρειάζεται fresh στο call time).
   */
  readonly drawDeps?: DependencyList;
  /**
   * ADR-624 — αν το ghost κάθεται στο snapped commit point (`getImmediateSnap`, ~30fps
   * async) ή ακολουθεί τον raw 60fps κέρσορα. Default `true` (WYSIWYG: preview στο σημείο
   * που θα κουμπώσει). Θέσε `false` για **free-point** placement (το commit χρησιμοποιεί
   * τον RAW κέρσορα, π.χ. floorplan-symbol/furniture): αλλιώς το ghost lag-άρει πίσω από
   * τον κέρσορα όταν το snap/grid είναι ON (30fps) ΚΑΙ αποκλίνει από το raw commit.
   */
  readonly useImmediateSnap?: boolean;
}

/**
 * Το «build → paint (+overlay)» skeleton πάνω από το `useCanvasGhostPreview` harness.
 * `useImmediateSnap: true` πάντα (WYSIWYG previews κάθονται στο snapped commit point).
 */
export function useWysiwygPlacementGhost<TBuild = Entity>(
  config: Readonly<WysiwygPlacementGhostConfig<TBuild>>,
): void {
  const { isActive, transform, getCanvas, getViewportElement, buildGhostEntity, paintGhost, drawOverlay, drawDeps, useImmediateSnap } = config;

  const draw = useCallback((frame: GhostDrawFrame) => {
    const build = buildGhostEntity(frame);
    if (build != null) {
      if (paintGhost) paintGhost(frame, build);
      else renderWysiwygPlacementGhost(frame.ctx, build as unknown as Entity, frame.transform, frame.viewport);
    }
    if (drawOverlay) drawOverlay(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller-controlled via drawDeps (mirrors legacy per-hook useCallback deps)
  }, drawDeps ?? []);

  useCanvasGhostPreview({
    isActive,
    getCanvas,
    getViewportElement,
    transform,
    // Default true (snapped WYSIWYG). Free-point placement passes false → raw 60fps cursor.
    useImmediateSnap: useImmediateSnap ?? true,
    draw,
  });
}

// ─── Level 2: single-point bridge-store placement-ghost factory ──────────────────

/** Το handle shape που διαβάζει το factory: overrides snapshot + optional scene-units. */
export interface BridgeStorePlacementGhostHandle<TOverrides> {
  readonly overrides?: TOverrides;
  getSceneUnits?(): SceneUnits;
}

/** Το κοινό `build*Entity` Result shape (ok/entity | hardErrors). */
export type BuildPlacementEntityResult<TEntity> =
  | { readonly ok: true; readonly entity: TEntity }
  | { readonly ok: false; readonly hardErrors?: readonly string[] };

/** Public props ΚΑΘΕ generated single-point bridge-store placement-ghost hook. */
export interface BridgeStorePlacementGhostProps {
  readonly isAwaitingPosition: boolean;
  readonly transform: ViewTransform;
  getCanvas(): HTMLCanvasElement | null;
  getViewportElement?(): HTMLElement | null;
}

export interface BridgeStorePlacementGhostSpec<
  THandle extends BridgeStorePlacementGhostHandle<TOverrides>,
  TOverrides,
  TParams,
  TEntity,
> {
  /**
   * Το tool-bridge store — μόνο ο imperative `get()` reader χρειάζεται (event-time
   * read, ίδιο source με το commit). Direct method type (όχι `Pick<…>`) για αξιόπιστη
   * `THandle` inference από το call site.
   */
  readonly bridgeStore: { get(): THandle | null };
  /** Ο ίδιος default-params builder που τρέχει το commit path. */
  buildDefaultParams(cursor: Point2D, overrides: TOverrides | undefined, sceneUnits: SceneUnits): TParams;
  /** Ο ίδιος entity builder που τρέχει το commit path. */
  buildEntity(params: TParams, layerId: string): BuildPlacementEntityResult<TEntity>;
  /**
   * ADR-624 — default `true` (snapped WYSIWYG). Θέσε `false` για free-point placement
   * (commit = RAW κέρσορας, π.χ. floorplan-symbol) ώστε το ghost να ακολουθεί τον raw
   * 60fps κέρσορα → ghost ≡ commit + μηδέν lag όταν snap/grid ON. Βλ. `WysiwygPlacementGhostConfig.useImmediateSnap`.
   */
  readonly useImmediateSnap?: boolean;
}

/**
 * Factory: επιστρέφει ένα single-point placement-ghost hook που χτίζει την ΠΛΗΡΗ
 * οντότητα από το bridge store (overrides + sceneUnits) με τους ΙΔΙΟΥΣ commit builders
 * και τη ζωγραφίζει WYSIWYG. Ίδιο public API με τα legacy `use*GhostPreview` hooks.
 */
export function createBridgeStorePlacementGhostHook<
  THandle extends BridgeStorePlacementGhostHandle<TOverrides>,
  TOverrides,
  TParams,
  TEntity,
>(
  spec: Readonly<BridgeStorePlacementGhostSpec<THandle, TOverrides, TParams, TEntity>>,
): (props: Readonly<BridgeStorePlacementGhostProps>) => void {
  const { bridgeStore, buildDefaultParams, buildEntity } = spec;

  return function useBridgeStorePlacementGhost(props: Readonly<BridgeStorePlacementGhostProps>): void {
    const { isAwaitingPosition, transform, getCanvas, getViewportElement } = props;

    useWysiwygPlacementGhost({
      isActive: isAwaitingPosition,
      transform,
      getCanvas,
      getViewportElement,
      buildGhostEntity: (frame): Entity | null => {
        if (!frame.effectiveCursor) return null;
        // ADR-574 — build the FULL entity με τους ΙΔΙΟΥΣ commit builders + overrides
        // source (bridge `.overrides` mirrors the tool state), so preview ≡ commit.
        const h = bridgeStore.get();
        const sceneUnits: SceneUnits = h?.getSceneUnits?.() ?? 'mm';
        const params = buildDefaultParams(frame.effectiveCursor, h?.overrides, sceneUnits);
        const built = buildEntity(params, getDefaultLayerId());
        return built.ok ? (built.entity as unknown as Entity) : null;
      },
      drawDeps: [],
    });
  };
}
