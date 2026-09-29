/**
 * @fileoverview **ΤΟ YUNET ΣΕ ΑΡΙΘΜΟΥΣ** — εικόνα → blob εισόδου, και έξοδοι του δικτύου → πλαίσια προσώπων (ADR-884 Φ2ζ ζ4).
 * Καθαρό: κανένα runtime, κανένα αρχείο — τα tensors έρχονται από το `yunet-session.ts`.
 * @related `yunet-session.ts` (η εκτέλεση) · `../tour-face-scan.ts` (ο καταναλωτής) · `data/models/face-detection/README.md`
 * @module server/spatial-tour/face-detection/yunet-decode
 *
 * 📐 **Πιστό στο OpenCV** (`modules/objdetect/src/face_detect.cpp`, `FaceDetectorYN`): είσοδος **BGR 0–255 χωρίς κανονικοποίηση**
 *   (`blobFromImage` με τις προεπιλογές του), συμπλήρωση με μηδενικά δεξιά/κάτω ως το πολλαπλάσιο του 32· ανά βήμα `s ∈ {8,16,32}`
 *   και κελί `(r, c)`: `score = √(clamp(cls)·clamp(obj))`, `cx = (c + dx)·s`, `w = e^dw·s`. Μετρημένο 2026-09-29: στο επίσημο
 *   `largest_selfie.jpg` τα πλαίσια συμπίπτουν με τα σημεία του OpenCV.
 */

import { clamp01 } from '@/lib/geometry/scalar';
import { TOUR_FACE_NMS_IOU, TOUR_FACE_SCORE_THRESHOLD } from '@/constants/spatial-tour-vocabulary';
import type { RawImage } from '@/lib/spatial-tour/tileset/equirect-to-cube';
import type { FaceBox } from '@/lib/spatial-tour/tileset/tour-face-regions';

/** Τα βήματα των τριών κεφαλών του YuNet. */
const YUNET_STRIDES = [8, 16, 32] as const;
/** Οι διαστάσεις εισόδου πρέπει να διαιρούνται με το μεγαλύτερο βήμα. */
const YUNET_DIVISOR = 32;

/** Ό,τι χρειάζεται από μια έξοδο: τα δεδομένα της (αριθμοί ανά κελί). */
export type YunetOutputs = Readonly<Record<string, { readonly data: ArrayLike<number> }>>;

/** Ένα ορθογώνιο μέσα σε εικόνα (pixel). */
export interface PixelRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** Η είσοδος του δικτύου: επίπεδα B, G, R (`[1, 3, H, W]`), με τη συμπλήρωση — δικό της `ArrayBuffer` (μεταφέρεται στον worker). */
export interface YunetInput {
  readonly data: Float32Array<ArrayBuffer>;
  readonly width: number;
  readonly height: number;
}

const padded = (n: number): number => Math.ceil(n / YUNET_DIVISOR) * YUNET_DIVISOR;

/** **Το blob εισόδου** για ένα ορθογώνιο της εικόνας: BGR επίπεδα, 0–255, μηδενική συμπλήρωση δεξιά/κάτω (όπως το OpenCV). */
export function yunetInputOf(image: RawImage, rect: PixelRect): YunetInput {
  const width = padded(rect.width);
  const height = padded(rect.height);
  const plane = width * height;
  const data = new Float32Array(3 * plane);
  for (let y = 0; y < rect.height; y++) {
    const row = ((rect.top + y) * image.width + rect.left) * image.channels;
    for (let x = 0; x < rect.width; x++) {
      const s = row + x * image.channels;
      const d = y * width + x;
      data[d] = image.data[s + 2];
      data[plane + d] = image.data[s + 1];
      data[2 * plane + d] = image.data[s];
    }
  }
  return { data, width, height };
}

function outputOf(outputs: YunetOutputs, name: string): ArrayLike<number> {
  const output = outputs[name];
  if (output === undefined) throw new Error(`YuNet output missing: ${name}`);
  return output.data;
}

/** Τα πλαίσια μίας κεφαλής (βήμα `stride`) πάνω από το κατώφλι. */
function boxesOfStride(outputs: YunetOutputs, stride: number, input: YunetInput, threshold: number): FaceBox[] {
  const [cls, obj, bbox] = ['cls', 'obj', 'bbox'].map((head) => outputOf(outputs, `${head}_${stride}`));
  const cols = input.width / stride;
  const rows = input.height / stride;
  const boxes: FaceBox[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const score = Math.sqrt(clamp01(cls[i]) * clamp01(obj[i]));
      if (score < threshold) continue;
      const w = Math.exp(bbox[i * 4 + 2]) * stride;
      const h = Math.exp(bbox[i * 4 + 3]) * stride;
      boxes.push({ x: (c + bbox[i * 4]) * stride - w / 2, y: (r + bbox[i * 4 + 1]) * stride - h / 2, w, h, score });
    }
  }
  return boxes;
}

function iou(a: FaceBox, b: FaceBox): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  const inter = Math.max(0, w) * Math.max(0, h);
  return inter / (a.w * a.h + b.w * b.h - inter);
}

/** Μη-μέγιστη καταστολή: από τον μεγαλύτερο βαθμό, κρατά ό,τι δεν επικαλύπτει πάνω από `threshold` κάτι που κράτησε. */
export function suppressOverlaps(boxes: readonly FaceBox[], threshold = TOUR_FACE_NMS_IOU): readonly FaceBox[] {
  const kept: FaceBox[] = [];
  for (const box of [...boxes].sort((a, b) => b.score - a.score)) {
    if (kept.every((k) => iou(k, box) <= threshold)) kept.push(box);
  }
  return kept;
}

/** **Οι έξοδοι του δικτύου → τα πρόσωπα** (σε pixel της εισόδου, με NMS). */
export function decodeYunet(outputs: YunetOutputs, input: YunetInput, threshold = TOUR_FACE_SCORE_THRESHOLD): readonly FaceBox[] {
  return suppressOverlaps(YUNET_STRIDES.flatMap((stride) => boxesOfStride(outputs, stride, input, threshold)));
}
