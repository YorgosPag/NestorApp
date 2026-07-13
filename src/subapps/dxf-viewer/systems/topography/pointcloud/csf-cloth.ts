/**
 * ADR-650 M8α — Cloth Simulation Filter (CSF), in-house.
 *
 * Zhang, Qi, Wan, Wang, Xie, Wang, Yan (2016), «An Easy-to-Use Airborne LiDAR Data Filtering
 * Method Based on Cloth Simulation», Remote Sensing 8(6):501. This is the SAME algorithm behind
 * CloudCompare's CSF plugin and PDAL's `filters.csf`, re-implemented from the paper — zero npm
 * dependency (explicit ADR-650 M8α decision).
 *
 * THE IDEA (why an engineer trusts it): turn the point cloud upside-down and drop a piece of
 * cloth on it. The cloth drapes over what used to be the ground and BRIDGES over what used to be
 * trees and buildings (they now hang below it). Whatever ends up within `classThresholdMm` of the
 * settled cloth is bare earth. Four knobs, no training data, no per-site tuning.
 *
 *   1. invert (z → −z)                          → `csf-grid.ts` (the IHV height map)
 *   2. lay a particle lattice above the cloud   → `csf-grid.ts`
 *   3. simulate: gravity → springs → collision  → THIS FILE
 *   4. slope post-pass (optional)               → THIS FILE
 *   5. |z_point − z_cloth| ≤ threshold ⇒ ground → THIS FILE
 *
 * ⚠️ THE KEY SIMPLIFICATION (and the reason CSF is fast): particles NEVER move in x/y. Only their
 * height is integrated. The lattice is therefore a plain 2D height field the whole way through —
 * so the sim is O(particles × iterations) with zero allocation, and the 30M points only ever cost
 * the one linear rasterisation pass in `csf-grid.ts`.
 */

import { buildClothGrid, sampleClothBilinear, type ClothGrid } from './csf-grid';
import type { CsfOptions, PointCloudData } from './pointcloud-types';

// ─── Simulation constants (the paper's, expressed in canonical mm) ────────────

/**
 * Descent per squared time-step. The reference implementation uses 0.2 in a metre-based world;
 * canonical mm (ADR-462) makes that 200. It is a fall RATE, not physics — Verlet accumulates it.
 */
const GRAVITY_MM = 200;
/** Velocity bleed per step (reference: `DAMPING = 0.01`). Keeps the cloth from oscillating. */
const DAMPING = 0.01;
/** The cloth is laid this far above the highest inverted point, so it always falls onto the data. */
const CLOTH_START_OFFSET_MM = 1_000;
/** Converged when no particle moved more than this in a step (reference: 0.005 m). */
const CONVERGENCE_EPS_MM = 5;
/**
 * How far a particle closes the gap to its neighbours' mean, per relaxation pass (the reference's
 * `singleMove/doubleMove` tables collapsed into one factor). 0.5 = a springy cloth.
 *
 * ⚠️ This relaxation MUST be Jacobi (all particles read the SAME snapshot), never in-place
 * Gauss-Seidel: sweeping in place turns the pass into a full Laplace solve, the cloth becomes an
 * infinitely rigid PLATE, and it then bridges straight over a retaining wall instead of draping
 * down it. Jacobi propagates exactly one cell per pass — which is what makes `rigidness` (= passes
 * per iteration) an actual stiffness knob and not an on/off switch.
 */
const CONSTRAINT_CLOSURE = 0.5;
/** Report progress every N iterations — a callback per iteration would dominate the sim. */
const PROGRESS_EVERY = 16;
/** Slope post-pass: cloth steeper than this (Δheight / cell) is bridging a slope, not draping it. */
const SLOPE_LIMIT_RATIO = 1;
/** Relaxation passes of the slope post-pass. Enough for the correction to walk down a hillside. */
const SLOPE_SMOOTH_PASSES = 3;

/**
 * Classify a cloud into bare earth with CSF.
 *
 * @returns indices into `data`, ascending. Deterministic: same input ⇒ same output, always.
 * @throws Error with an i18n KEY when the cloth resolution is unusable (see `csf-grid.ts`).
 */
export function csfClassify(
  data: PointCloudData,
  opts: CsfOptions,
  onProgress?: (ratio: number) => void,
): Uint32Array {
  if (data.count === 0) return new Uint32Array(0);

  const grid = buildClothGrid(data, opts.clothResolutionMm);
  const cloth = simulateCloth(grid, opts, onProgress);
  if (opts.slopeSmoothing) smoothClothSlopes(grid, cloth);
  onProgress?.(1);

  return selectGround(data, grid, cloth, opts.classThresholdMm);
}

// ─── 3. The simulation ────────────────────────────────────────────────────────

/** Mutable state of the falling cloth. Typed arrays only — nothing is allocated in the loop. */
interface ClothState {
  readonly z: Float32Array;
  readonly prevZ: Float32Array;
  /** 1 = still falling, 0 = landed on the terrain (the paper's «unmovable» flag). */
  readonly movable: Uint8Array;
  /** Read-only snapshot of `z` reused by every relaxation pass. Allocated once, never in the loop. */
  readonly snapshot: Float32Array;
}

function simulateCloth(
  grid: ClothGrid,
  opts: CsfOptions,
  onProgress?: (ratio: number) => void,
): Float32Array {
  const state = initCloth(grid);
  const accelMm = -GRAVITY_MM * opts.timeStep * opts.timeStep;

  for (let iter = 0; iter < opts.maxIterations; iter++) {
    const maxDelta = applyGravity(state, accelMm);
    for (let pass = 0; pass < opts.rigidness; pass++) relaxConstraints(grid, state);
    applyCollision(grid, state);

    if (iter % PROGRESS_EVERY === 0) onProgress?.(iter / opts.maxIterations);
    if (maxDelta > 0 && maxDelta < CONVERGENCE_EPS_MM) break;
  }
  return state.z;
}

function initCloth(grid: ClothGrid): ClothState {
  const total = grid.cols * grid.rows;
  const startZ = grid.maxInvertedZ + CLOTH_START_OFFSET_MM;
  const z = new Float32Array(total).fill(startZ);
  const prevZ = new Float32Array(total).fill(startZ);
  const movable = new Uint8Array(total).fill(1);
  return { z, prevZ, movable, snapshot: new Float32Array(total) };
}

/** (a) External force. Verlet integration, vertical only: `z += (z − prevZ)·(1−damping) + a·Δt²`. */
function applyGravity(state: ClothState, accelMm: number): number {
  let maxDelta = 0;
  for (let i = 0; i < state.z.length; i++) {
    if (state.movable[i] === 0) continue;
    const cur = state.z[i];
    const next = cur + (cur - state.prevZ[i]) * (1 - DAMPING) + accelMm;
    state.prevZ[i] = cur;
    state.z[i] = next;
    const delta = Math.abs(next - cur);
    if (delta > maxDelta) maxDelta = delta;
  }
  return maxDelta;
}

/**
 * (c) Internal force. One Jacobi relaxation of the 4-neighbour springs: every movable particle
 * closes `CONSTRAINT_CLOSURE` of its gap to the MEAN of its neighbours, all of them reading the
 * same pre-pass snapshot. Landed particles do not move but still pull on their neighbours — that
 * is how the terrain, once touched, drags the rest of the cloth down onto it.
 *
 * Running this `rigidness` times per iteration IS the rigidness knob (1 = steep/loose … 3 = flat):
 * each pass carries the influence exactly one cell further, so more passes ⇒ a stiffer sheet.
 */
function relaxConstraints(grid: ClothGrid, state: ClothState): void {
  const { cols, rows } = grid;
  const before = state.snapshot;
  before.set(state.z);

  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      const i = cy * cols + cx;
      if (state.movable[i] === 0) continue;

      let sum = 0;
      let n = 0;
      if (cx > 0) {
        sum += before[i - 1];
        n++;
      }
      if (cx < cols - 1) {
        sum += before[i + 1];
        n++;
      }
      if (cy > 0) {
        sum += before[i - cols];
        n++;
      }
      if (cy < rows - 1) {
        sum += before[i + cols];
        n++;
      }
      if (n === 0) continue;

      state.z[i] = before[i] + CONSTRAINT_CLOSURE * (sum / n - before[i]);
    }
  }
}

/** (b) Collision. A particle that has reached the (inverted) terrain sticks to it, for good. */
function applyCollision(grid: ClothGrid, state: ClothState): void {
  for (let i = 0; i < state.z.length; i++) {
    if (state.movable[i] === 0) continue;
    if (state.z[i] <= grid.ihv[i]) {
      state.z[i] = grid.ihv[i];
      state.movable[i] = 0;
    }
  }
}

// ─── 4. Slope post-pass ───────────────────────────────────────────────────────

/**
 * On a steep hillside the springs hold the cloth up and it BRIDGES the slope instead of draping
 * it — in real space the cloth then sits well below the hill and its points get thrown away as
 * non-ground. This pass caps the cloth's own slope: any particle standing more than one cell-step
 * above a neighbour is pulled down towards it, never below the terrain it would collide with.
 * Repeat a few times so the correction walks all the way down the slope.
 *
 * (The reference implementation reaches the same end via its `movableFilter` connected-component
 * pass; this height-field formulation is the simplification named in the ADR.)
 */
function smoothClothSlopes(grid: ClothGrid, z: Float32Array): void {
  const limit = grid.resolutionMm * SLOPE_LIMIT_RATIO;
  const { cols, rows } = grid;
  for (let pass = 0; pass < SLOPE_SMOOTH_PASSES; pass++) {
    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        const i = cy * cols + cx;
        let lowestAllowed = Number.POSITIVE_INFINITY;
        if (cx > 0) lowestAllowed = Math.min(lowestAllowed, z[i - 1] + limit);
        if (cx < cols - 1) lowestAllowed = Math.min(lowestAllowed, z[i + 1] + limit);
        if (cy > 0) lowestAllowed = Math.min(lowestAllowed, z[i - cols] + limit);
        if (cy < rows - 1) lowestAllowed = Math.min(lowestAllowed, z[i + cols] + limit);
        if (z[i] > lowestAllowed) z[i] = Math.max(grid.ihv[i], lowestAllowed);
      }
    }
  }
}

// ─── 5. Classification ────────────────────────────────────────────────────────

/**
 * A point is ground when it lies within `thresholdMm` of the settled cloth. The cloth height is
 * bilinearly interpolated at the point's own x/y (the particle lattice is coarser than the cloud),
 * and un-inverted back to real world mm.
 */
function selectGround(
  data: PointCloudData,
  grid: ClothGrid,
  cloth: Float32Array,
  thresholdMm: number,
): Uint32Array {
  const isGround = new Uint8Array(data.count);
  let groundCount = 0;

  for (let i = 0; i < data.count; i++) {
    const clothZ = -sampleClothBilinear(grid, cloth, data.x[i], data.y[i]);
    if (Math.abs(data.z[i] - clothZ) <= thresholdMm) {
      isGround[i] = 1;
      groundCount++;
    }
  }

  const out = new Uint32Array(groundCount);
  let cursor = 0;
  for (let i = 0; i < data.count; i++) if (isGround[i] === 1) out[cursor++] = i;
  return out;
}
