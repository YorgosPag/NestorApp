/**
 * ADR-920 Β6.4 — the ONE reader of a published terrain snapshot (the gzip JSON on the public shelf).
 *
 * The browser receives bytes from Storage; nothing guarantees they are what the builder wrote (an older version, a
 * truncated upload, a hand-edited file). The reader answers ONE question — «is this a snapshot this code can draw?» —
 * and refuses with a NAMED reason otherwise. It never fills in a default: a missing field is a refusal, not a guess.
 *
 * Two layers, on purpose:
 *   1. **zod** for the shape (the same tool as `listing-terrain-source.ts`): object fields, scalars, contours, stats.
 *   2. **one tight loop** for the large flat arrays (`positions` · `triangles` · `slopeClass`, up to ~540 000
 *      numbers): structural invariants zod cannot state — triples, indices in range, one class per triangle.
 *
 * Pure — zero DOM / React / three.
 *
 * @module lib/terrain/publication/listing-terrain-snapshot-reader
 */

import { z } from 'zod';

import { LISTING_TERRAIN_MAX_TRIANGLES } from './listing-terrain-config';
import {
  LISTING_TERRAIN_SNAPSHOT_LEGACY_VERSION,
  LISTING_TERRAIN_SNAPSHOT_VERSION,
  type ListingTerrainMesh,
  type ListingTerrainSnapshot,
} from './listing-terrain-types';

/** Why a fetched snapshot cannot be drawn. */
export type ListingTerrainSnapshotRefusal =
  | 'unknown-version'
  | 'malformed'
  | 'non-finite'
  | 'positions-not-triples'
  | 'index-out-of-range'
  | 'slope-class-mismatch'
  | 'empty-mesh'
  | 'too-dense'
  | 'inconsistent-stats';

export type ListingTerrainSnapshotRead =
  | { readonly ok: true; readonly snapshot: ListingTerrainSnapshot }
  | { readonly ok: false; readonly reason: ListingTerrainSnapshotRefusal };

/** A flat array of plain numbers — finiteness is judged by the loop, so the refusal can be named. */
const flat = z.array(z.number());
const finite = z.number().finite();

const meshSchema = z.object({ positions: flat, triangles: flat, slopeClass: flat });

const contourSchema = z.object({
  levelM: finite,
  major: z.boolean(),
  closed: z.boolean(),
  points: flat.refine((points) => points.length >= 4 && points.length % 2 === 0),
});

const statsSchema = z.object({
  planAreaM2: finite.nonnegative(),
  minElevationM: finite,
  maxElevationM: finite,
  reliefM: finite.nonnegative(),
  meanSlopePct: finite.nonnegative(),
  maxSlopePct: finite.nonnegative(),
  downslopeAzimuthDeg: finite.nullable(),
});

const envelopeSchema = z
  .object({ footprint: flat, groundM: flat, maxHeightM: finite.positive().nullable() })
  .refine((e) => e.footprint.length >= 6 && e.footprint.length % 2 === 0 && e.groundM.length === e.footprint.length / 2);

const ringSchema = flat.refine((ring) => ring.length >= 6 && ring.length % 2 === 0);

const plotOutlineSchema = z.object({
  ring: ringSchema,
  areaM2: finite.nonnegative(),
  coverage: z.enum(['covered', 'partial']),
  coveredFraction: finite.min(0).max(1),
});

/** The fields both versions share. */
const sharedShape = {
  mesh: meshSchema,
  contours: z.array(contourSchema),
  contourIntervalM: finite.positive(),
  contourMajorEvery: z.number().int().positive(),
  slopeBandsPct: z.array(finite),
  boundary: ringSchema.nullable(),
  stats: statsSchema,
  envelope: envelopeSchema.nullable(),
  envelopeOmission: z.enum(['outside-surface', 'degenerate-footprint']).nullable(),
};

/**
 * ADR-920 §14.11 Ζ2 — v2 adds the plot outline; v1 (published before it) is read as v2 WITHOUT one. That is the version
 * speaking, not a default filling a hole: a v2 file missing the fields is still `malformed`.
 */
const snapshotSchema = z.discriminatedUnion('version', [
  z.object({ version: z.literal(LISTING_TERRAIN_SNAPSHOT_LEGACY_VERSION), ...sharedShape }),
  z.object({
    version: z.literal(LISTING_TERRAIN_SNAPSHOT_VERSION),
    ...sharedShape,
    plotOutline: plotOutlineSchema.nullable(),
    plotOutlineOmission: z.enum(['outside-surface', 'degenerate-outline']).nullable(),
  }),
]);

type ParsedSnapshot = z.infer<typeof snapshotSchema>;

/** One in-memory shape for both versions (the readers downstream know only the current one). */
function currentShapeOf(parsed: ParsedSnapshot): ListingTerrainSnapshot {
  if (parsed.version === LISTING_TERRAIN_SNAPSHOT_VERSION) return parsed;
  return { ...parsed, version: LISTING_TERRAIN_SNAPSHOT_VERSION, plotOutline: null, plotOutlineOmission: null };
}

function allFinite(values: readonly number[]): boolean {
  for (let i = 0; i < values.length; i++) if (!Number.isFinite(values[i])) return false;
  return true;
}

/** Structural invariants of the mesh (the part zod cannot say), first failure wins. */
function meshRefusal(mesh: ListingTerrainMesh, slopeClassCount: number): ListingTerrainSnapshotRefusal | null {
  const { positions, triangles, slopeClass } = mesh;
  if (!allFinite(positions)) return 'non-finite';
  if (positions.length % 3 !== 0) return 'positions-not-triples';
  if (triangles.length === 0) return 'empty-mesh';
  if (triangles.length % 3 !== 0) return 'malformed';
  if (triangles.length / 3 > LISTING_TERRAIN_MAX_TRIANGLES) return 'too-dense';
  const vertexCount = positions.length / 3;
  for (let i = 0; i < triangles.length; i++) {
    const index = triangles[i];
    if (!Number.isInteger(index) || index < 0 || index >= vertexCount) return 'index-out-of-range';
  }
  if (slopeClass.length !== triangles.length / 3) return 'slope-class-mismatch';
  for (let i = 0; i < slopeClass.length; i++) {
    const cls = slopeClass[i];
    if (!Number.isInteger(cls) || cls < 0 || cls >= slopeClassCount) return 'slope-class-mismatch';
  }
  return null;
}

function hasNonFiniteOutsideMesh(snapshot: ListingTerrainSnapshot): boolean {
  if (snapshot.boundary && !allFinite(snapshot.boundary)) return true;
  if (snapshot.plotOutline && !allFinite(snapshot.plotOutline.ring)) return true;
  if (snapshot.contours.some((contour) => !allFinite(contour.points))) return true;
  const envelope = snapshot.envelope;
  return envelope !== null && (!allFinite(envelope.footprint) || !allFinite(envelope.groundM));
}

function isUnknownVersion(raw: unknown): boolean {
  return typeof raw === 'object' && raw !== null && 'version' in raw
    && raw.version !== LISTING_TERRAIN_SNAPSHOT_VERSION && raw.version !== LISTING_TERRAIN_SNAPSHOT_LEGACY_VERSION;
}

/** Read a fetched (already JSON-parsed) snapshot. Never throws. */
export function readListingTerrainSnapshot(raw: unknown): ListingTerrainSnapshotRead {
  if (isUnknownVersion(raw)) return { ok: false, reason: 'unknown-version' };
  const parsed = snapshotSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: 'malformed' };
  const snapshot = currentShapeOf(parsed.data);
  const meshProblem = meshRefusal(snapshot.mesh, snapshot.slopeBandsPct.length + 1);
  if (meshProblem) return { ok: false, reason: meshProblem };
  if (hasNonFiniteOutsideMesh(snapshot)) return { ok: false, reason: 'non-finite' };
  const { minElevationM, maxElevationM } = snapshot.stats;
  if (minElevationM > maxElevationM) return { ok: false, reason: 'inconsistent-stats' };
  return { ok: true, snapshot };
}
