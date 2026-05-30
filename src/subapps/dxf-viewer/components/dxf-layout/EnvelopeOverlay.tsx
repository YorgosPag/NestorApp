'use client';

/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * ADR-396 Phase P4 — Envelope (ETICS) 2D overlay micro-leaf.
 *
 * Dedicated always-on overlay canvas που ζωγραφίζει το ενιαίο συνεχές εξωτερικό
 * περίγραμμα μόνωσης + insulation hatch band του τρέχοντος ορόφου. **Παράγωγο
 * floor-overlay** (ADR-396 §3 DISPLAY) — ΟΧΙ registered renderer στο
 * `EntityRendererComposite`.
 *
 * ADR-040 micro-leaf: subscribes ΜΟΝΟ εδώ (envelope-spec-store + objectStyles
 * visibility slice). Ο shell `CanvasLayerStack` / `CanvasSection` ΔΕΝ αποκτούν νέο
 * `useSyncExternalStore` (CHECK 6C safe). Repaint σε αλλαγή scene/transform/spec/
 * visibility — anchored στο world bbox, άρα pan/zoom ξαναζωγραφίζουν.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-396-bim-external-thermal-envelope-etics.md §3, §7 (P4)
 * @see ../../bim/geometry/envelope-perimeter (computeEnvelopePerimeter)
 * @see ../../bim/renderers/EnvelopeRenderer (plan + draw)
 */

import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { DxfScene, DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { ViewTransform, Viewport } from '../../rendering/types/Types';
import { computeEnvelopePerimeter } from '../../bim/geometry/envelope-perimeter';
import { computeEnvelopeOpeningCuts } from '../../bim/geometry/envelope-opening-cuts';
import {
  EnvelopeRenderer,
  buildEnvelopeRenderPlan,
  buildSlabHatchPlan,
  buildRevealJambPlans,
} from '../../bim/renderers/EnvelopeRenderer';
import {
  getEnvelopeSpec,
  subscribeEnvelopeSpec,
} from '../../bim/stores/envelope-spec-store';
import { useDrawingScaleStore } from '../../state/drawing-scale-store';
import { resolveIsEntityVisible } from '../../bim/visibility/visibility-resolver';
import { mmToSceneUnits } from '../../utils/scene-units';
import { resolveCutState, type ViewRange } from '../../config/bim-view-range';

export interface EnvelopeOverlayProps {
  readonly scene: DxfScene | null;
  readonly transform: ViewTransform;
  readonly viewport: Viewport;
  /** Τρέχων BIM όροφος — κλειδί του per-level spec store. */
  readonly currentLevelId: string | null;
}

/**
 * Z2/Z3 — διαγράμμιση μόνωσης πάνω στο footprint κάθε εκτεθειμένης πλάκας. Διαβάζει
 * το per-element `slabEntity.params.envelopeLayer` (γραμμένο από τον applicator P7B).
 */
function drawExposedSlabHatch(
  renderer: EnvelopeRenderer,
  scene: DxfScene,
  transform: ViewTransform,
  viewport: Viewport,
  spacingScale: number,
): void {
  for (const e of scene.entities) {
    if (e.type !== 'slab') continue;
    const layer = e.slabEntity.params.envelopeLayer;
    const footprint = e.slabEntity.geometry?.polygon?.vertices;
    if (!layer || !footprint) continue;
    const plan = buildSlabHatchPlan(footprint, layer.materialId, spacingScale);
    if (plan) renderer.renderSlabHatch(plan, transform, viewport);
  }
}

/**
 * Z4 — μόνωση περβαζιών γύρω από κάθε εξωτερικό άνοιγμα. Στην κάτοψη φαίνονται
 * **μόνο οι 2 παραστάδες** (jamb strips), ΚΑΘΕΤΕΣ στον άξονα του τοίχου, σε όλο το
 * πάχος (πρέκι/ποδιά είναι πάνω/κάτω στο Z, μόνο 3D). Solid-polygon hatch ανά
 * παραστάδα (όπως Z2/Z3) — όχι inset frame (που έβγαζε λοξή παρειά). Διαβάζει το
 * per-element `openingEntity.params.revealInsulation`. Το πάχος (meters) → canvas
 * units μέσω `mmToSceneUnits` (mirror του applicator `buildPerimeterContext`).
 *
 * Cut-plane gating (ADR-396): το περβάζι εμφανίζεται ΜΟΝΟ όταν η οριζόντια τομή
 * της κάτοψης περνά μέσα από το άνοιγμα (`resolveCutState === 'cut'`, ίδιο SSoT με
 * `OpeningRenderer`). Τομή κάτω από την ποδιά ή πάνω από το πρέκι → ο τοίχος είναι
 * συμπαγής εκεί → η μόνωση φαίνεται συνεχής μέσω Z1, χωρίς περβάζι.
 */
function drawOpeningReveals(
  renderer: EnvelopeRenderer,
  scene: DxfScene,
  transform: ViewTransform,
  viewport: Viewport,
  viewRange: ViewRange,
): void {
  const spacingScale = mmToSceneUnits(scene.units ?? 'mm');
  const canvasPerM = spacingScale * 1000;
  for (const e of scene.entities) {
    if (e.type !== 'opening') continue;
    const reveal = e.openingEntity.params.revealInsulation;
    const outline = e.openingEntity.geometry?.outline?.vertices;
    if (!reveal || !outline) continue;
    const { sillHeight, height } = e.openingEntity.params;
    const cutState = resolveCutState(
      { zBottomMm: sillHeight, zTopMm: sillHeight + height, category: 'opening' },
      viewRange,
    );
    if (cutState !== 'cut') continue;
    const jambPlans = buildRevealJambPlans(outline, reveal.thickness_m * canvasPerM, reveal.materialId, spacingScale);
    for (const plan of jambPlans) renderer.render(plan, transform, viewport);
  }
}

export function EnvelopeOverlay({
  scene,
  transform,
  viewport,
  currentLevelId,
}: EnvelopeOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Leaf subscriptions (ADR-040): per-level spec + V/G visibility slice.
  const spec = useSyncExternalStore(
    subscribeEnvelopeSpec,
    () => getEnvelopeSpec(currentLevelId),
    () => null,
  );
  const objectStyles = useDrawingScaleStore((s) => s.objectStyles);
  const viewRange = useDrawingScaleStore((s) => s.viewRange);
  const visible = resolveIsEntityVisible({ category: 'envelope' }, { objectStyles });

  // ADR-396 P6: ΟΧΙ auto-seed. Το envelope εμφανίζεται ΜΟΝΟ όταν ο χρήστης
  // τρέξει το command «Εφαρμογή Θερμοπρόσοψης» (ThermalEnvelopeHost → setEnvelopeSpec).
  // Το `spec` είναι null μέχρι τότε → το render path κάνει early-return.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!visible || !spec || !scene) return;
    // DxfWall (direct entity, ADR-363 §1B) έχει kind+params → structurally satisfies
    // WallForEnvelope. Filter μέσω του type discriminator (το `isWallEntity` είναι
    // typed για το Entity union, όχι για το DxfEntityUnion του render scene).
    const walls = scene.entities.filter(
      (e): e is Extract<DxfEntityUnion, { type: 'wall' }> => e.type === 'wall',
    );
    // ADR-396 gating: οι κολώνες γεφυρώνουν κενά στο περίγραμμα (Επιλογή Α).
    const columns = scene.entities
      .filter((e): e is Extract<DxfEntityUnion, { type: 'column' }> => e.type === 'column')
      .map((c) => ({ id: c.id, params: c.params }));
    // ADR-396 — ανοίγματα για cutouts στο band μόνωσης (η Z1 δεν σκεπάζει κουφώματα).
    const openings = scene.entities
      .filter((e): e is Extract<DxfEntityUnion, { type: 'opening' }> => e.type === 'opening')
      .map((o) => o.openingEntity);

    const renderer = new EnvelopeRenderer(ctx);
    // Hatch spacing (mm) → scene units· σε meter scenes 80mm θα γινόταν 80m
    // (καμία γραμμή) — βλ. computeWallHatchPlan.
    const spacingScale = mmToSceneUnits(scene.units ?? 'mm');

    // Z1 — κατακόρυφο κέλυφος (offset perimeter των τοίχων, spec-driven).
    if (walls.length > 0) {
      const { chains } = computeEnvelopePerimeter(walls, spec.thickness_m, scene.units, columns);
      for (const chain of chains) {
        // ADR-396 v2 gating (Phase 1): ETICS ΜΟΝΟ όταν οι τοίχοι **περικλείουν
        // χώρο** (κύκλος στο γράφημα). Ανοιχτή αλυσίδα (Π/L/ζιγκ-ζαγκ/μεμονωμένος)
        // → enclosesRegion=false → καμία μόνωση. Κτίριο με εσωτερικό χώρισμα
        // (T-junction) → έχει κύκλο → enclosesRegion=true → εμφάνιση. Αντικαθιστά
        // το παλιό `wallIds.length >= 3` που περνούσε λάθος τις ανοιχτές αλυσίδες.
        if (!chain.enclosesRegion) continue;
        const plan = buildEnvelopeRenderPlan(chain, spec.materialId, spacingScale);
        if (plan) renderer.render(plan, transform, viewport);
        // Τρύπησε τα ανοίγματα ΜΕΤΑ το band του ίδιου chain (πριν τα Z4 reveals).
        const cuts = computeEnvelopeOpeningCuts(chain, openings, scene.units ?? 'mm');
        renderer.renderOpeningCuts(cuts, transform, viewport);
        // Κλείσε το προφίλ μόνωσης στα άκρα κάθε cut με τις κάθετες απολήξεις
        // (ΜΕΤΑ το destination-out ώστε να μη σβηστούν).
        renderer.strokeOpeningCutCaps(cuts, transform, viewport);
      }
    }

    // Z2/Z3 — εκτεθειμένες πλάκες· Z4 — περβάζια. Pure read των per-element
    // δεδομένων (envelopeLayer / revealInsulation) — ΟΧΙ re-classify εδώ.
    drawExposedSlabHatch(renderer, scene, transform, viewport, spacingScale);
    drawOpeningReveals(renderer, scene, transform, viewport, viewRange);
  }, [scene, transform, viewport, spec, visible, viewRange]);

  return (
    <canvas
      ref={canvasRef}
      data-dxf-overlay="envelope"
      width={viewport.width}
      height={viewport.height}
      className="pointer-events-none absolute inset-0 z-[11]"
      aria-hidden="true"
    />
  );
}
