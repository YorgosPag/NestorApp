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
 * @see ../../bim/geometry/envelope-shell (computeEnvelopeShell — footprint-driven, v2 Φ5B)
 * @see ../../bim/renderers/EnvelopeRenderer (plan + draw)
 */

import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { DxfScene, DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { ViewTransform, Viewport } from '../../rendering/types/Types';
import { computeEnvelopeShell, collectEnvelopeOverrides } from '../../bim/geometry/envelope-shell';
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
import {
  getEnvelopeFloorSlabs,
  subscribeEnvelopeFloorSlabs,
} from '../../bim/stores/envelope-floor-slabs-store';
import { resolveSlabsAboveForLevel } from '../../bim/geometry/footprint-region-classifier';
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
  // ADR-396 v2 Φ5C — cross-floor slabs (αίθριο vs δωμάτιο). Leaf-only subscription
  // (ADR-040): ο classifier μέσα στο `computeEnvelopeShell` ξεχωρίζει ακάλυπτη
  // τρύπα (αίθριο → μόνωση γύρω) από σκεπασμένη (δωμάτιο). Stable snapshot ref.
  const floorSlabs = useSyncExternalStore(
    subscribeEnvelopeFloorSlabs,
    getEnvelopeFloorSlabs,
    getEnvelopeFloorSlabs,
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
    // ADR-396 v2 (Φ5B): κολώνες + δοκάρια συμμετέχουν first-class στο footprint
    // union (προεξοχές τυλίγονται «ίδια με τοίχους») — όχι απλώς bridge κενών.
    const columns = scene.entities
      .filter((e): e is Extract<DxfEntityUnion, { type: 'column' }> => e.type === 'column')
      .map((c) => ({ id: c.id, params: c.params }));
    const beams = scene.entities
      .filter((e): e is Extract<DxfEntityUnion, { type: 'beam' }> => e.type === 'beam')
      .map((b) => ({ id: b.id, params: b.params }));
    // ADR-396 — ανοίγματα για cutouts στο band μόνωσης (η Z1 δεν σκεπάζει κουφώματα).
    const openings = scene.entities
      .filter((e): e is Extract<DxfEntityUnion, { type: 'opening' }> => e.type === 'opening')
      .map((o) => o.openingEntity);

    const renderer = new EnvelopeRenderer(ctx);
    // Hatch spacing (mm) → scene units· σε meter scenes 80mm θα γινόταν 80m
    // (καμία γραμμή) — βλ. computeWallHatchPlan.
    const spacingScale = mmToSceneUnits(scene.units ?? 'mm');

    // Z1 — κατακόρυφο κέλυφος (footprint-driven shell, spec-driven).
    if (walls.length > 0 || columns.length > 0 || beams.length > 0) {
      // ADR-396 v2 (Φ5B): πηγή = `computeEnvelopeShell` (footprint union + hole-gate
      // + per-element override). Ο engine επιστρέφει ΜΟΝΟ ό,τι μονώνεται (το
      // hole-gate ζει στον classifier), οπότε ΟΛΑ τα chains ζωγραφίζονται — δεν
      // φιλτράρουμε `enclosesRegion` (θα έκοβε τα ανοιχτά runs από 'interior' override).
      const overrides = collectEnvelopeOverrides([...walls, ...columns, ...beams]);
      // Φ5C — πλάκες ψηλότερων ορόφων του ενεργού floor (αίθριο vs δωμάτιο). Κενό
      // snapshot → όλες οι τρύπες = δωμάτια (μηδέν regression, safe default).
      const slabsAbove = resolveSlabsAboveForLevel(
        floorSlabs.slabs, floorSlabs.floors, floorSlabs.activeFloorId,
      );
      const { chains } = computeEnvelopeShell(
        walls, columns, beams, spec, overrides, slabsAbove, { sceneUnits: scene.units },
      );
      for (const chain of chains) {
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
  }, [scene, transform, viewport, spec, visible, viewRange, floorSlabs]);

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
