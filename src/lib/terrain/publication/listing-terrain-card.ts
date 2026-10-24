/**
 * ADR-920 Β3β — the **card** of a published terrain: what the listing document carries next to the URL
 * of the baked snapshot, so a result card or a detail header can say «1.240 m², relief 6,4 m, mean slope
 * 11 %, surveyed by X on Y» without downloading megabytes of mesh.
 *
 * 🔑 **ONE derivation, ONE reader.** `listingTerrainCardOf` is the only way a card is made (from the
 * snapshot the shelf just baked + the Δ2 declaration), and `readListingTerrainCard` is the only way one
 * is trusted back (the listing schema judge, link 26, and the shelf's cache hit both call it).
 *
 * ⛔ **Never a position.** Stats are areas, elevations and slopes; the snapshot frame is already
 * relative (Β2). Absolute elevations stay, as in the snapshot: an elevation alone locates nothing.
 *
 * Pure: no I/O.
 *
 * @module lib/terrain/publication/listing-terrain-card
 */

import { z } from 'zod';

import { readTerrainSurveyDeclaration, type TerrainSurveyDeclaration } from './terrain-survey-declaration';
import type {
  ListingTerrainEnvelopeOmission,
  ListingTerrainSnapshot,
  ListingTerrainStats,
} from './listing-terrain-types';

/** Who measured and when — the provenance the buyer reads (Δ2, Α3). Never the rights answer itself. */
export interface ListingTerrainSurvey {
  readonly surveyorName: string;
  /** `YYYY-MM-DD`. */
  readonly surveyedOn: string;
}

/**
 * What the indicative building envelope amounts to (Α3) — named, never a silent guess:
 * a prism only with a declared numeric height, the footprint alone without one, and an omission
 * with its reason when the builder refused to stand it on the ground.
 */
export type ListingTerrainEnvelopeSummary =
  | { readonly kind: 'volume'; readonly maxHeightM: number }
  | { readonly kind: 'footprint' }
  | { readonly kind: 'omitted'; readonly reason: ListingTerrainEnvelopeOmission };

export interface ListingTerrainCard {
  /** The snapshot contract version the URL points to. */
  readonly snapshotVersion: number;
  readonly stats: ListingTerrainStats;
  readonly contourIntervalM: number;
  /** `null` ⇒ no envelope was requested. */
  readonly envelope: ListingTerrainEnvelopeSummary | null;
  readonly survey: ListingTerrainSurvey;
}

function envelopeSummaryOf(snapshot: ListingTerrainSnapshot): ListingTerrainEnvelopeSummary | null {
  if (snapshot.envelopeOmission !== null) return { kind: 'omitted', reason: snapshot.envelopeOmission };
  if (snapshot.envelope === null) return null;
  const { maxHeightM } = snapshot.envelope;
  return maxHeightM === null ? { kind: 'footprint' } : { kind: 'volume', maxHeightM };
}

/** The card of a baked snapshot — the ONE derivation. */
export function listingTerrainCardOf(
  snapshot: ListingTerrainSnapshot,
  declaration: TerrainSurveyDeclaration,
): ListingTerrainCard {
  return {
    snapshotVersion: snapshot.version,
    stats: snapshot.stats,
    contourIntervalM: snapshot.contourIntervalM,
    envelope: envelopeSummaryOf(snapshot),
    survey: { surveyorName: declaration.surveyorName, surveyedOn: declaration.surveyedOn },
  };
}

const finite = z.number().finite();

const statsShape = z.object({
  planAreaM2: finite.nonnegative(),
  minElevationM: finite,
  maxElevationM: finite,
  reliefM: finite.nonnegative(),
  meanSlopePct: finite.nonnegative(),
  maxSlopePct: finite.nonnegative(),
  downslopeAzimuthDeg: finite.min(0).lt(360).nullable(),
});

const envelopeShape = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('volume'), maxHeightM: finite.positive() }),
  z.object({ kind: z.literal('footprint') }),
  z.object({ kind: z.literal('omitted'), reason: z.enum(['outside-surface', 'degenerate-footprint']) }),
]);

const cardShape = z.object({
  snapshotVersion: z.number().int().positive(),
  stats: statsShape,
  contourIntervalM: finite.positive(),
  envelope: envelopeShape.nullable(),
  survey: z.unknown(),
});

/**
 * A stored card back as a card, or `null` when it is not one — deep, never a default. The survey is
 * judged by the Δ2 reader itself (same name limit, same real-calendar-day rule), not by a mirror of it.
 * Idempotent: a valid card comes out structurally identical (unknown keys dropped).
 */
export function readListingTerrainCard(value: unknown): ListingTerrainCard | null {
  const parsed = cardShape.safeParse(value);
  if (!parsed.success) return null;
  const survey = readTerrainSurveyDeclaration({
    ...(typeof parsed.data.survey === 'object' && parsed.data.survey !== null ? parsed.data.survey : {}),
    rightsAffirmed: true,
  });
  if (survey === null) return null;
  const { snapshotVersion, stats, contourIntervalM, envelope } = parsed.data;
  return {
    snapshotVersion,
    stats,
    contourIntervalM,
    envelope,
    survey: { surveyorName: survey.surveyorName, surveyedOn: survey.surveyedOn },
  };
}
