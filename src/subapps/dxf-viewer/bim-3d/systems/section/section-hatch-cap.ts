/**
 * SectionHatchCap — per-material CanvasTexture hatch patterns για ADR-366 §A.3 Phase 7.1.
 *
 * Architectural convention (Revit/AutoCAD plan & section view):
 *   rc      → dot grid (reinforced concrete / σκυρόδεμα)
 *   steel   → cross-hatch × (χάλυβας)
 *   masonry → horizontal brick courses (τοιχοποιία / οπλισμένη)
 *   wood    → diagonal parallel lines (ξύλο / glulam)
 *   insulation → batt zig-zag (μόνωση — ADR-416 composite slab layers)
 *   null    → grey solid fallback (glass / unknown)
 *
 * @see ADR-366 §A.3 Phase 7.1 — Hatched per-material cut surface
 */

import * as THREE from 'three';
import { SECTION_CUT_SURFACE } from '../../../config/color-config';
import { createCutCapMaterial } from './section-stencil-materials';

export type SectionHatchKey = 'rc' | 'steel' | 'masonry' | 'wood' | 'insulation';

/** World-space metres per hatch texture tile. */
const TILE_M = 0.25;

const SZ = 128;
const BG = SECTION_CUT_SURFACE.color;
const STROKE = 'rgba(0,0,0,0.35)';
const STEP = 16;

// ── Material ID → hatch key lookup ────────────────────────────────────────────

const MAT_PREFIX_TO_HATCH: ReadonlyArray<readonly [string, SectionHatchKey]> = [
  ['mat-concrete', 'rc'],
  ['mat-plaster',  'rc'],
  ['mat-brick',    'masonry'],
  ['mat-stone',    'masonry'],
  ['mat-tile',     'rc'],
  ['mat-wood',     'wood'],
  ['mat-metal',    'steel'],
  // ADR-416 — composite slab build-up layers. Cementitious finishes read as RC
  // dots; gravel ballast as coarse masonry courses; thin membranes as dense steel
  // cross-hatch; insulation gets the dedicated batt zig-zag.
  ['mat-screed',     'rc'],
  ['mat-finish',     'rc'],
  ['mat-gravel',     'masonry'],
  ['mat-membrane',   'steel'],
  ['mat-insulation', 'insulation'],
  ['elem-column',  'rc'],
  ['elem-beam',    'rc'],
  ['elem-slab',    'rc'],
];

const ENTITY_MAT_TO_HATCH: Readonly<Record<string, SectionHatchKey>> = {
  rc: 'rc', steel: 'steel', masonry: 'masonry', wood: 'wood', glulam: 'wood',
};

/**
 * Resolve SectionHatchKey from a raw material ID string.
 * Returns null for glass or unknown → grey solid fallback in caller.
 */
export function resolveHatchKey(raw: string | undefined): SectionHatchKey | null {
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (lower.startsWith('mat-glass')) return null;
  const entityKey = ENTITY_MAT_TO_HATCH[lower];
  if (entityKey !== undefined) return entityKey;
  for (const [prefix, key] of MAT_PREFIX_TO_HATCH) {
    if (lower.startsWith(prefix)) return key;
  }
  return null;
}

// ── Canvas texture builders ───────────────────────────────────────────────────

/**
 * ADR-621 — SSoT preamble for every hatch texture: an `SZ`×`SZ` canvas pre-filled
 * with the cut-surface background. Each builder then draws only its own pattern.
 */
function createHatchCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = SZ; canvas.height = SZ;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = BG; ctx.fillRect(0, 0, SZ, SZ);
  return { canvas, ctx };
}

function buildRcTexture(): HTMLCanvasElement {
  const { canvas, ctx } = createHatchCanvas();
  ctx.fillStyle = STROKE;
  for (let x = STEP / 2; x < SZ; x += STEP) {
    for (let y = STEP / 2; y < SZ; y += STEP) {
      ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill();
    }
  }
  return canvas;
}

function buildSteelTexture(): HTMLCanvasElement {
  const { canvas, ctx } = createHatchCanvas();
  ctx.strokeStyle = STROKE; ctx.lineWidth = 1.2;
  for (let i = -SZ; i < SZ * 2; i += STEP) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + SZ, SZ); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(i, SZ); ctx.lineTo(i + SZ, 0); ctx.stroke();
  }
  return canvas;
}

function buildMasonryTexture(): HTMLCanvasElement {
  const { canvas, ctx } = createHatchCanvas();
  ctx.strokeStyle = STROKE; ctx.lineWidth = 1;
  const brickH = 20; const brickW = 40;
  for (let row = 0; row * brickH < SZ + brickH; row++) {
    const y = row * brickH;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(SZ, y); ctx.stroke();
    const offset = (row % 2) * (brickW / 2);
    for (let x = offset; x < SZ; x += brickW) {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + brickH); ctx.stroke();
    }
  }
  return canvas;
}

function buildWoodTexture(): HTMLCanvasElement {
  const { canvas, ctx } = createHatchCanvas();
  ctx.strokeStyle = STROKE; ctx.lineWidth = 1;
  for (let i = -SZ; i < SZ * 2; i += STEP - 2) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + SZ, SZ); ctx.stroke();
  }
  return canvas;
}

/**
 * Insulation batt — the architectural zig-zag symbol (Revit / AutoCAD `INSUL`):
 * a continuous triangular wave repeated in horizontal rows. Reads instantly as
 * "thermal/acoustic insulation" in a section cut (ADR-416 composite slab layers).
 */
function buildInsulationTexture(): HTMLCanvasElement {
  const { canvas, ctx } = createHatchCanvas();
  ctx.strokeStyle = STROKE; ctx.lineWidth = 1.2;
  const rowH = 24; const amp = rowH * 0.4; const step = 8;
  for (let y = rowH / 2; y < SZ + rowH; y += rowH) {
    ctx.beginPath();
    for (let x = 0; x <= SZ; x += step) {
      const dy = ((x / step) % 2 === 0 ? -amp : amp);
      x === 0 ? ctx.moveTo(x, y + dy) : ctx.lineTo(x, y + dy);
    }
    ctx.stroke();
  }
  return canvas;
}

const BUILDERS: Readonly<Record<SectionHatchKey, () => HTMLCanvasElement>> = {
  rc: buildRcTexture, steel: buildSteelTexture, masonry: buildMasonryTexture,
  wood: buildWoodTexture, insulation: buildInsulationTexture,
};

// ── Lazy caches ───────────────────────────────────────────────────────────────

const TEX_CACHE = new Map<SectionHatchKey, THREE.CanvasTexture>();
const MAT_CACHE = new Map<SectionHatchKey, THREE.MeshBasicMaterial>();

function getHatchTexture(key: SectionHatchKey): THREE.CanvasTexture {
  let tex = TEX_CACHE.get(key);
  if (!tex) {
    const canvas = BUILDERS[key]();
    tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    TEX_CACHE.set(key, tex);
  }
  return tex;
}

/**
 * Retrieve (or lazily create) a stencil cap material with hatch texture.
 * Stencil config mirrors the solid capMat: NotEqual(0) → fill cap area.
 */
export function getHatchCapMaterial(key: SectionHatchKey): THREE.MeshBasicMaterial {
  let mat = MAT_CACHE.get(key);
  if (!mat) {
    // Same NotEqual(0)→Replace cap mask as the solid caps (SSoT), textured with the
    // per-material hatch pattern; depthTest off like the box `createCapMaterial`.
    mat = createCutCapMaterial({ map: getHatchTexture(key), depthTest: false });
    MAT_CACHE.set(key, mat);
  }
  return mat;
}

/** Update UV repeat so one tile = TILE_M world-metres (called per cap render). */
export function setHatchRepeat(key: SectionHatchKey, capSize: number): void {
  const tex = TEX_CACHE.get(key);
  if (!tex) return;
  const repeat = capSize / TILE_M;
  tex.repeat.set(repeat, repeat);
}

/** Dispose all cached textures and materials. Call only on full teardown. */
export function disposeHatchCap(): void {
  for (const mat of MAT_CACHE.values()) mat.dispose();
  for (const tex of TEX_CACHE.values()) tex.dispose();
  MAT_CACHE.clear();
  TEX_CACHE.clear();
}
