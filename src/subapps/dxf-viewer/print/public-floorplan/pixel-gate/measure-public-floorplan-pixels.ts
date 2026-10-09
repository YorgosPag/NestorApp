/**
 * @fileoverview **Η ΜΕΤΡΗΣΗ ΤΗΣ ΠΥΛΗΣ PIXELS** — μία στάθμη χρώματος, από το σχέδιο-δείγμα σε αριθμούς (CHECK 3.101).
 * @related ADR-909 §6.7 · ./pixel-gate-contract · ./record-canvas-strokes · ../capture-public-floorplan
 * @module subapps/dxf-viewer/print/public-floorplan/pixel-gate/measure-public-floorplan-pixels
 *
 * 🔑 Καλεί το **πραγματικό** `capturePublicFloorplan` — την ίδια συνάρτηση με το κουμπί «Δημοσίευση κάτοψης».
 * Όργανο που ζωγραφίζει με δικό του δρόμο θα έκρινε εικόνα που κανείς δεν δημοσιεύει.
 *
 * 🔑 **Όλες οι ομάδες αναμμένες**, και βγαίνουν από το `PUBLIC_FLOORPLAN_GROUPS`: ομάδα που θα προστεθεί αύριο
 * μετριέται χωρίς να τη θυμηθεί κανείς. (Το ελάττωμα των Υδραυλικών φάνηκε μόνο όταν η ομάδα άναψε — §6.6.)
 */

import { PUBLIC_FLOORPLAN_GROUPS, type FloorplanRenderRecipe } from '@/lib/listings/floorplan-render-recipe';

import { compositeOverHex, parseColor } from '../../../config/color-math';
import { PRINT_PAPER_HEX } from '../../../config/print-color-policy';
import type { SceneModel } from '../../../types/entities';
import { capturePublicFloorplan } from '../capture-public-floorplan';
import type { PublicFloorplanChoice, PublicFloorplanPlotStyle } from '../public-floorplan-presets';
import {
  CHROMA_SPREAD_THRESHOLD,
  INK_CHANNEL_THRESHOLD,
  type PixelGateCell,
  type PixelGateLevel,
  type PixelGateStroke,
} from './pixel-gate-contract';
import { recordCanvasStrokes, type RecordedStroke } from './record-canvas-strokes';

/** Το ορθογώνιο του **σχεδίου** που ανήκει σε ένα δείγμα. */
export interface PixelGateSampleCell {
  readonly sample: string;
  readonly shown: boolean;
  readonly unconvertible: boolean;
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

interface PixelRect {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

type Frame = FloorplanRenderRecipe['frame'];

/** Σχέδιο → pixels της εικόνας. Ο άξονας Υ **αντιστρέφεται** (το πάνω του σχεδίου είναι η γραμμή 0). */
function toPixelRect(cell: PixelGateSampleCell, frame: Frame, width: number, height: number): PixelRect {
  const sx = width / (frame.maxX - frame.minX);
  const sy = height / (frame.maxY - frame.minY);
  const clampX = (v: number) => Math.min(width, Math.max(0, Math.round(v)));
  const clampY = (v: number) => Math.min(height, Math.max(0, Math.round(v)));
  return {
    x0: clampX((cell.minX - frame.minX) * sx),
    x1: clampX((cell.maxX - frame.minX) * sx),
    y0: clampY((frame.maxY - cell.maxY) * sy),
    y1: clampY((frame.maxY - cell.minY) * sy),
  };
}

async function decodePixels(blob: Blob): Promise<ImageData> {
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx === null) throw new Error('pixel-gate: no 2D context available to read the image back');
    ctx.drawImage(bitmap, 0, 0);
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  } finally {
    bitmap.close();
  }
}

function censusOf(image: ImageData, rect: PixelRect): Pick<PixelGateCell, 'inkPx' | 'chromaticPx' | 'maxChannelSpread'> {
  const { data, width } = image;
  let inkPx = 0;
  let chromaticPx = 0;
  let maxChannelSpread = 0;
  for (let y = rect.y0; y < rect.y1; y += 1) {
    for (let i = (y * width + rect.x0) * 4, end = (y * width + rect.x1) * 4; i < end; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (Math.min(r, g, b) < INK_CHANNEL_THRESHOLD) inkPx += 1;
      const spread = Math.max(r, g, b) - Math.min(r, g, b);
      if (spread > CHROMA_SPREAD_THRESHOLD) chromaticPx += 1;
      if (spread > maxChannelSpread) maxChannelSpread = spread;
    }
  }
  return { inkPx, chromaticPx, maxChannelSpread };
}

/** FNV-1a πάνω σε **όλα** τα pixels — αποτύπωμα για το «δύο λήψεις, ίδια εικόνα», όχι κρυπτογραφία. */
function digestOf(image: ImageData): string {
  const words = new Uint32Array(image.data.buffer, image.data.byteOffset, image.data.byteLength >>> 2);
  let hash = 0x811c9dc5;
  for (let i = 0; i < words.length; i += 1) {
    hash = Math.imul(hash ^ words[i], 0x01000193);
  }
  return `${image.width}x${image.height}:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function sampleAt(point: RecordedStroke['at'], rects: ReadonlyArray<readonly [string, PixelRect]>): string | null {
  if (point === null) return null;
  const hit = rects.find(([, r]) => point.x >= r.x0 && point.x < r.x1 && point.y >= r.y0 && point.y < r.y1);
  return hit ? hit[0] : null;
}

/** Ομαδοποίηση: ίδιο δείγμα + ίδιο χρώμα στο χαρτί + ίδιο πάχος ⇒ μία γραμμή αναφοράς με πλήθος. */
function groupStrokes(
  strokes: readonly RecordedStroke[],
  rects: ReadonlyArray<readonly [string, PixelRect]>,
): PixelGateStroke[] {
  const groups = new Map<string, PixelGateStroke>();
  for (const stroke of strokes) {
    const colour = stroke.style === null ? null : parseColor(stroke.style);
    if (colour === null) continue; // μοτίβο / διαβάθμιση: δεν έχει ΕΝΑ χρώμα — το κρίνουν τα pixels (Κ1).
    const colourHex = compositeOverHex({ ...colour, a: colour.a * stroke.alpha }, PRINT_PAPER_HEX);
    const widthPx = Math.round(stroke.widthPx * 100) / 100;
    const sample = sampleAt(stroke.at, rects);
    const key = `${sample}|${colourHex}|${widthPx}`;
    const seen = groups.get(key);
    groups.set(key, { sample, colourHex, widthPx, count: (seen?.count ?? 0) + 1 });
  }
  return [...groups.values()];
}

async function captureOrThrow(scene: SceneModel, choice: PublicFloorplanChoice) {
  const capture = await capturePublicFloorplan({ scene, choice });
  if (!capture.ok) throw new Error(`pixel-gate: capture refused (${capture.why})`);
  return capture;
}

/**
 * **Μέτρησε μία στάθμη χρώματος**: λήψη με καταγραφή γραμμών, απογραφή pixels ανά κελί, και δεύτερη ίδια
 * λήψη για το αποτύπωμα.
 */
export async function measurePixelGateLevel(
  scene: SceneModel,
  cells: readonly PixelGateSampleCell[],
  plotStyle: PublicFloorplanPlotStyle,
): Promise<PixelGateLevel> {
  const choice: PublicFloorplanChoice = { groups: PUBLIC_FLOORPLAN_GROUPS, plotStyle };

  const { result: capture, strokes } = await recordCanvasStrokes(() => captureOrThrow(scene, choice));
  const { recipe } = capture;
  const image = await decodePixels(capture.blob);
  const rects = cells.map((cell) => [cell.sample, toPixelRect(cell, recipe.frame, image.width, image.height)] as const);
  const onImage = strokes.filter((s) => s.canvas.width === recipe.widthPx && s.canvas.height === recipe.heightPx);

  const repeat = await captureOrThrow(scene, choice);

  return {
    plotStyle,
    groups: recipe.groups,
    widthPx: image.width,
    heightPx: image.height,
    cells: cells.map((cell, index) => ({
      sample: cell.sample,
      shown: cell.shown,
      unconvertible: cell.unconvertible,
      ...censusOf(image, rects[index][1]),
    })),
    strokes: groupStrokes(onImage, rects),
    unruledTypes: capture.unruledTypes,
    digest: digestOf(image),
    repeatDigest: digestOf(await decodePixels(repeat.blob)),
  };
}
