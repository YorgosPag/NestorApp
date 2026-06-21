/**
 * ADR-396 Phase P4 — Envelope (ETICS) render plan (PURE SSoT).
 *
 * Καθαρός υπολογισμός του render plan ενός `EnvelopeChain` — μηδέν canvas/React/
 * transform εξάρτηση (testable χωρίς jsdom). Ο canvas drawer ζει στο
 * `EnvelopeRenderer.ts` (consumes αυτό το plan).
 *
 * Hatch SSoT: reuse `computeMaterialHatchSegments` (ADR-507 Φ7 unified material
 * poché → PAT catalog) — ΚΑΜΙΑ διπλασιασμένη hatch math.
 *
 * ΜΟΝΑΔΕΣ: τα vertices είναι σε **canvas units** (όπως βγαίνουν από το
 * `computeEnvelopePerimeter`). worldToScreen γίνεται στον renderer.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-396-bim-external-thermal-envelope-etics.md §3, §5, §7 (P4)
 */

import type { Point3D } from '../types/bim-base';
import type { EnvelopeChain } from '../geometry/envelope-perimeter';
import type { EnvelopeMaterialId } from '../types/thermal-envelope-types';
// ADR-507 Φ7 — unified material poché· η ETICS μόνωση → INSUL batting pattern
// (proper insulation, αναβάθμιση από το παλιό gypsum stand-in).
import { computeMaterialHatchSegments } from '../geometry/shared/material-hatch-geometry';
import type { HatchLineSegment } from '../geometry/shared/hatch-pattern-geometry';
import { computeRevealJambQuads } from '../geometry/reveal-lining-geometry';

/** Το υλικό μόνωσης ETICS → πάντα INSUL (batting) σε τομή. */
const ENVELOPE_HATCH_MATERIAL = 'insulation';

export interface EnvelopeRenderPlan {
  /** Κλειστό δαχτυλίδι πάχους μόνωσης (outer forward + exterior face reversed). */
  readonly bandRing: readonly Point3D[];
  /** Η εξωτ. όψη της μόνωσης (συνεχής offset polyline). */
  readonly outerLoop: readonly Point3D[];
  readonly outerClosed: boolean;
  /** Hatch segments (canvas units· ADR-507 Φ7 INSUL batting μέσω MATERIAL_HATCH_MAP). */
  readonly hatch: readonly HatchLineSegment[];
}

/**
 * Χτίζει το render plan ενός chain. Επιστρέφει null αν το chain δεν έχει αρκετές
 * κορυφές για band (π.χ. degenerate / πάχος 0 → outer === face).
 */
export function buildEnvelopeRenderPlan(
  chain: EnvelopeChain,
  _materialId: EnvelopeMaterialId,
  spacingScale = 1,
): EnvelopeRenderPlan | null {
  const outer = chain.insulationOuterLoop.points;
  const inner = chain.exteriorFaceLoop.points;
  if (outer.length < 2 || inner.length < 2) return null;

  const bandRing: Point3D[] = [...outer, ...[...inner].reverse()];
  const hatch = computeMaterialHatchSegments([bandRing], ENVELOPE_HATCH_MATERIAL, 'cut', spacingScale);
  return { bandRing, outerLoop: outer, outerClosed: chain.closed, hatch };
}

// ─── Z2 / Z3 — εκτεθειμένες πλάκες (soffit πιλοτής / δώμα top) ──────────────────

/**
 * Render plan για την επίπεδη μόνωση μιας εκτεθειμένης πλάκας (Z2/Z3). Στην
 * κάτοψη φαίνεται ως διαγράμμιση μόνωσης σε ΟΛΟ το footprint της πλάκας (απόφαση
 * Giorgio). Z2 και Z3 μοιράζονται το ίδιο 2D visual — η ζώνη μετράει μόνο για 3D.
 */
export interface EnvelopeSlabHatchPlan {
  /** Κλειστό polygon footprint πλάκας (canvas units) — clip + stroke. */
  readonly polygon: readonly Point3D[];
  /** Hatch segments (canvas units· ADR-507 Φ7 INSUL batting). */
  readonly hatch: readonly HatchLineSegment[];
}

/**
 * Χτίζει το hatch plan μιας εκτεθειμένης πλάκας. Επιστρέφει null αν το footprint
 * δεν είναι έγκυρο polygon (< 3 κορυφές).
 */
export function buildSlabHatchPlan(
  footprint: readonly Point3D[],
  _materialId: EnvelopeMaterialId,
  spacingScale = 1,
): EnvelopeSlabHatchPlan | null {
  if (footprint.length < 3) return null;
  const hatch = computeMaterialHatchSegments([footprint], ENVELOPE_HATCH_MATERIAL, 'cut', spacingScale);
  return { polygon: footprint, hatch };
}

// ─── Z4 — περβάζια κουφωμάτων (2 παραστάδες = jamb strips) ──────────────────────

/**
 * Render plans για τη μόνωση περβαζιών ενός ανοίγματος (Z4) στην **κάτοψη**.
 *
 * Η τομή κάτοψης περνά μέσα από το άνοιγμα → φαίνονται **μόνο οι 2 παραστάδες**
 * (jamb strips), ΚΑΘΕΤΕΣ στον άξονα του τοίχου, σε όλο το πάχος (πρέκι/ποδιά είναι
 * πάνω/κάτω στο Z, μόνο 3D). Κάθε παραστάδα = solid-polygon hatch (ίδιο pattern με
 * Z2/Z3, μέσω `EnvelopeSlabHatchPlan`) — ΟΧΙ inset frame (που έβγαζε 45° mitered
 * γωνίες = λοξή παρειά). Γεωμετρία παραστάδων: κοινό SSoT `computeRevealJambQuads`
 * (2D⟷3D parity με `revealLiningToMesh`). `insetCanvas` = πάχος περβαζιού σε canvas
 * units (ο caller μετατρέπει meters → canvas).
 *
 * @returns άδειο array αν degenerate (caller κάνει iterate, ασφαλές).
 */
export function buildRevealJambPlans(
  outline: readonly Point3D[],
  insetCanvas: number,
  _materialId: EnvelopeMaterialId,
  spacingScale = 1,
): EnvelopeRenderPlan[] {
  const jambs = computeRevealJambQuads(outline, insetCanvas);
  if (!jambs) return [];
  const plans: EnvelopeRenderPlan[] = [];
  for (const quad of [jambs.startJamb, jambs.endJamb]) {
    // bandRing = το ίδιο το quad (solid) → τα segments έρχονται ήδη clipped εντός·
    // outerLoop = quad κλειστό → strokeOuterLoop τραβά το περίγραμμα (ορατότητα,
    // αλλιώς το μόνο hatch σε λεπτή παραστάδα είναι σχεδόν αόρατο).
    const hatch = computeMaterialHatchSegments([quad], ENVELOPE_HATCH_MATERIAL, 'cut', spacingScale);
    plans.push({ bandRing: quad, outerLoop: quad, outerClosed: true, hatch });
  }
  return plans;
}
