/**
 * Συνθετικά δείγματα κάτοψης για jest (ADR-929 Δ13.1): «δικό μας σχέδιο αποδοσμένο ως εικόνα + θόρυβος /
 * κλίση / κιτρίνισμα».
 *
 * 🔑 **Η αλήθεια ορίζεται από το ίδιο SSoT που θα ελέγξει.** Η εικόνα αποδίδεται **ανάποδα**: για κάθε pixel
 * ρωτάμε το `rasterToSceneAffine` πού πέφτει στη σκηνή, και το βάφουμε αν πέφτει πάνω σε τοίχο. Άρα η
 * {@link SyntheticPlan.placement} δεν είναι προσέγγιση. Είναι **ακριβώς** η απεικόνιση που θα εφαρμόσει
 * η παραγωγή, και ένα τμήμα που η Φ2 βρίσκει στα px `(x, y)` έχει αναμενόμενη θέση
 * `rasterPixelToScene((x, y), placement)` σε mm, χωρίς δεύτερο τύπο μέσα στα tests.
 *
 * 🔑 **Ντετερμινιστικό.** Ο θόρυβος βγαίνει από το SSoT `utils/seeded-prng` (mulberry32): ίδιος σπόρος ⇒
 * ίδια εικόνα, byte προς byte, σε κάθε μηχάνημα. Κανένα δυαδικό αρχείο στο repo.
 *
 * ⚠️ Μόνο για tests και σενάρια μέτρησης (`testing/`, εκτός του γραφήματος της εφαρμογής).
 *
 * @module subapps/dxf-viewer/bim/plan-recognition/testing/synthetic-plan-raster
 */

import type { Point2D } from '../../../rendering/types/Types';
import { type Affine2x3, applyAffine, invertAffine } from '@/lib/geometry/affine-2x3';
import {
  backgroundPlacementAffine,
  rasterToSceneAffine,
  type RasterPlacement,
} from '../../../floorplan-background/geometry/raster-scene-mapping';
import type { BackgroundTransform } from '../../../floorplan-background/providers/types';
import { createPrng } from '../../../utils/seeded-prng';
import type { PlanRaster } from '@/lib/geometry/raster/plan-raster';
import {
  dimensionInk,
  isDimensionInk,
  type DimensionInk,
  type SyntheticDimension,
  type SyntheticDimensionTruth,
} from './synthetic-dimensions';

/** Τοίχος σε mm κάτοψης (Y πάνω): άξονας από `start` σε `end`, συνολικό πάχος `thicknessMm`. */
export interface SyntheticWall {
  readonly start: Point2D;
  readonly end: Point2D;
  readonly thicknessMm: number;
}

export interface SyntheticDegradation {
  readonly seed: number;
  /** Ομοιόμορφος θόρυβος ανά κανάλι, ±τιμή στο [0, 255]. */
  readonly noiseAmplitude: number;
  /** 0 = λευκό χαρτί, 1 = πλήρως κιτρινισμένο (παλιά σάρωση, Δ14 β). */
  readonly yellowing: number;
}

export interface SyntheticPlanSpec {
  readonly walls: readonly SyntheticWall[];
  /** Ανάλυση: px ανά mm (π.χ. 0,05 = 50 px/m). */
  readonly pxPerMm: number;
  readonly marginMm: number;
  /** `filled`: γεμάτος τοίχος (poché). `outlined`: το όριο της ένωσης με πινελιά `strokePx` (συνήθης σάρωση). */
  readonly wallStyle: 'filled' | 'outlined';
  readonly strokePx: number;
  /** Στραβή σάρωση: περιστροφή του χαρτιού ως προς την κάτοψη, σε μοίρες. */
  readonly rotationDeg: number;
  readonly degradation: SyntheticDegradation | null;
  /** ADR-929 Φ5.4: διαστάσεις με την ίδια πινελιά (`strokePx`). */
  readonly dimensions?: readonly SyntheticDimension[];
  /** mm κάτοψης ανά mm χαρτιού (1:100 ⇒ 100): τα μεγέθη των διαστάσεων. */
  readonly paperScale?: number;
}

export interface SyntheticPlan {
  readonly image: PlanRaster;
  /** Η **ακριβής** τοποθέτηση: `rasterPixelToScene(px, placement)` = mm της κάτοψης. */
  readonly placement: RasterPlacement;
  readonly walls: readonly SyntheticWall[];
  /** Η αλήθεια των διαστάσεων σε mm κάτοψης (κενή χωρίς διαστάσεις). */
  readonly dimensions: SyntheticDimensionTruth;
}

const DEFAULT_PAPER_SCALE = 100;

type Rgb = readonly [number, number, number];
const PAPER_WHITE: Rgb = [255, 255, 255];
const PAPER_YELLOW: Rgb = [238, 226, 178];
const INK: Rgb = [28, 28, 28];

interface MmBox { minX: number; minY: number; maxX: number; maxY: number }

function wallsBox(spec: SyntheticPlanSpec, extra: readonly Point2D[]): MmBox {
  const box: MmBox = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  const grow = (p: Point2D, pad: number): void => {
    box.minX = Math.min(box.minX, p.x - pad); box.maxX = Math.max(box.maxX, p.x + pad);
    box.minY = Math.min(box.minY, p.y - pad); box.maxY = Math.max(box.maxY, p.y + pad);
  };
  for (const w of spec.walls) for (const p of [w.start, w.end]) grow(p, w.thicknessMm / 2 + spec.marginMm);
  for (const p of extra) grow(p, spec.marginMm);
  return box;
}

/**
 * Η τοποθέτηση που χωρά την κάτοψη στην εικόνα. Με `U = R·S` (χωρίς μετατόπιση), οι γωνίες της κάτοψης
 * πέφτουν στις τοπικές συντεταγμένες `U⁻¹·γωνία`. Η εικόνα καλύπτει το εύρος τους, και η μετατόπιση
 * `U·(min)` φέρνει την ελάχιστη γωνία στο pixel (0, h).
 */
function fitPlacement(spec: SyntheticPlanSpec, extra: readonly Point2D[]): RasterPlacement {
  const s = 1 / spec.pxPerMm;
  const shape: BackgroundTransform = { translateX: 0, translateY: 0, scaleX: s, scaleY: s, rotation: spec.rotationDeg };
  const u = backgroundPlacementAffine(shape);
  const uInv = invertAffine(u);
  if (!uInv) throw new Error('synthetic plan: degenerate resolution');
  const b = wallsBox(spec, extra);
  const local = [
    { x: b.minX, y: b.minY }, { x: b.maxX, y: b.minY }, { x: b.minX, y: b.maxY }, { x: b.maxX, y: b.maxY },
  ].map((p) => applyAffine(uInv, p));
  const minL = { x: Math.min(...local.map((p) => p.x)), y: Math.min(...local.map((p) => p.y)) };
  const width = Math.ceil(Math.max(...local.map((p) => p.x)) - minL.x);
  const height = Math.ceil(Math.max(...local.map((p) => p.y)) - minL.y);
  const t = applyAffine(u, minL);
  return { transform: { ...shape, translateX: t.x, translateY: t.y }, naturalBounds: { width, height } };
}

/** Θέση σημείου ως προς τον τοίχο: απόσταση κατά μήκος του άξονα και κάθετα σε αυτόν, σε mm. */
function wallLocal(w: SyntheticWall, p: Point2D): { along: number; across: number; length: number } {
  const dx = w.end.x - w.start.x;
  const dy = w.end.y - w.start.y;
  const length = Math.hypot(dx, dy);
  const rx = p.x - w.start.x;
  const ry = p.y - w.start.y;
  return { along: (rx * dx + ry * dy) / length, across: Math.abs(rx * dy - ry * dx) / length, length };
}

/**
 * Επέκταση κάθε άκρου κατά μήκος του άξονα: στους **κόμβους** (το άκρο πέφτει πάνω στον άξονα άλλου τοίχου) ο
 * τοίχος φτάνει ως την εξωτερική παρειά του παχύτερου γείτονα, όπως η ένωση τοίχων Revit/ArchiCAD. Χωρίς αυτό η
 * εξωτερική γωνία του L μένει με **εγκοπή** ένα τετράγωνο `t/2 × t/2`, γεωμετρία που κανένα σχέδιο δεν έχει.
 * Ελεύθερο άκρο ⇒ καμία επέκταση.
 */
interface WallReach { readonly wall: SyntheticWall; readonly startExt: number; readonly endExt: number }

function jointExtension(w: SyntheticWall, end: Point2D, walls: readonly SyntheticWall[]): number {
  let ext = 0;
  for (const other of walls) {
    if (other === w) continue;
    const { along, across, length } = wallLocal(other, end);
    if (across <= 1e-6 && along >= -1e-6 && along <= length + 1e-6) ext = Math.max(ext, other.thicknessMm / 2);
  }
  return ext;
}

function wallReaches(walls: readonly SyntheticWall[]): readonly WallReach[] {
  return walls.map((wall) => ({
    wall,
    startExt: jointExtension(wall, wall.start, walls),
    endExt: jointExtension(wall, wall.end, walls),
  }));
}

function insideWall(r: WallReach, p: Point2D, grow: number): boolean {
  const { along, across, length } = wallLocal(r.wall, p);
  const half = r.wall.thicknessMm / 2 + grow;
  return half > 0 && across <= half && along >= -r.startExt - grow && along <= length + r.endExt + grow;
}

/**
 * `filled`: η ένωση των σωμάτων. `outlined`: μόνο το **όριο της ένωσης**, πάχους `strokePx`, όπως σχεδιάζεται μια
 * κάτοψη: καμία γραμμή δεν περνά μέσα από διασταυρούμενο τοίχο.
 */
function isInk(spec: SyntheticPlanSpec, reaches: readonly WallReach[], dims: DimensionInk, p: Point2D): boolean {
  if (isDimensionInk(dims, p)) return true;
  if (spec.wallStyle === 'filled') return reaches.some((r) => insideWall(r, p, 0));
  const halfStrokeMm = spec.strokePx / spec.pxPerMm / 2;
  return reaches.some((r) => insideWall(r, p, halfStrokeMm)) && !reaches.some((r) => insideWall(r, p, -halfStrokeMm));
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function paint(spec: SyntheticPlanSpec, dims: DimensionInk, toScene: Affine2x3, width: number, height: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  const d = spec.degradation;
  const paper = mix(PAPER_WHITE, PAPER_YELLOW, d?.yellowing ?? 0);
  const ink = mix(INK, PAPER_YELLOW, (d?.yellowing ?? 0) * 0.15);
  const rng = d ? createPrng(d.seed) : null;
  const reaches = wallReaches(spec.walls);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const rgb = isInk(spec, reaches, dims, applyAffine(toScene, { x: x + 0.5, y: y + 0.5 })) ? ink : paper;
      const i = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) {
        const noise = rng && d ? (rng() * 2 - 1) * d.noiseAmplitude : 0;
        data[i + c] = rgb[c] + noise;
      }
      data[i + 3] = 255;
    }
  }
  return data;
}

/** Αποδίδει την κάτοψη ως εικόνα RGBA, μαζί με την ακριβή τοποθέτησή της. */
export function renderSyntheticPlan(spec: SyntheticPlanSpec): SyntheticPlan {
  if (spec.walls.length === 0) throw new Error('synthetic plan: no walls');
  const dims = dimensionInk(spec.dimensions ?? [], spec.paperScale ?? DEFAULT_PAPER_SCALE, spec.strokePx / spec.pxPerMm / 2);
  const placement = fitPlacement(spec, dims.extent);
  const { width, height } = placement.naturalBounds;
  const data = paint(spec, dims, rasterToSceneAffine(placement), width, height);
  return { image: { rgba: data, width, height }, placement, walls: spec.walls, dimensions: dims.truth };
}

/** Σπίτι 6 × 4 m με εσωτερικό τοίχο: το βασικό δείγμα των tests. Τοίχοι 25 cm έξω, 10 cm μέσα. */
export const SAMPLE_HOUSE_WALLS: readonly SyntheticWall[] = [
  { start: { x: 0, y: 0 }, end: { x: 6000, y: 0 }, thicknessMm: 250 },
  { start: { x: 6000, y: 0 }, end: { x: 6000, y: 4000 }, thicknessMm: 250 },
  { start: { x: 6000, y: 4000 }, end: { x: 0, y: 4000 }, thicknessMm: 250 },
  { start: { x: 0, y: 4000 }, end: { x: 0, y: 0 }, thicknessMm: 250 },
  { start: { x: 3500, y: 0 }, end: { x: 3500, y: 4000 }, thicknessMm: 100 },
];

/**
 * Το ίδιο σπίτι με **άνοιγμα 900 mm** στον νότιο τοίχο (δύο συγγραμμικοί τοίχοι με κενό) και **λοξό** τοίχο 45° στο
 * ανατολικό δωμάτιο: η αλήθεια για τα κενά (Φ6) και για τους μη ορθογώνιους άξονες (Φ2: οι λοξοί δεν σβήνονται).
 */
export const SAMPLE_HOUSE_OPENING_OBLIQUE_WALLS: readonly SyntheticWall[] = [
  { start: { x: 0, y: 0 }, end: { x: 1500, y: 0 }, thicknessMm: 250 },
  { start: { x: 2400, y: 0 }, end: { x: 6000, y: 0 }, thicknessMm: 250 },
  ...SAMPLE_HOUSE_WALLS.slice(1), // ίδιο σπίτι: ανατολικός, βόρειος, δυτικός, εσωτερικός
  { start: { x: 3500, y: 2500 }, end: { x: 5000, y: 4000 }, thicknessMm: 100 },
];
