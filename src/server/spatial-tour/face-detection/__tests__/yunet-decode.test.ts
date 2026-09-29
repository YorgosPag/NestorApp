/**
 * @jest-environment node
 *
 * @fileoverview **ΤΟ YUNET ΣΕ ΑΡΙΘΜΟΥΣ** (ADR-884 Φ2ζ ζ4) — πιστότητα στο `FaceDetectorYN` του OpenCV, με συνθετικά tensors.
 *
 * - **Β** — blob: BGR (όχι RGB), 0–255 χωρίς κανονικοποίηση, μηδενική συμπλήρωση ως το πολλαπλάσιο του 32, μετατόπιση ορθογωνίου.
 * - **Α** — αποκωδικοποίηση: `score = √(clamp(cls)·clamp(obj))`, κατώφλι, `cx = (c + dx)·s`, `w = e^dw·s`, και στα τρία βήματα.
 * - **Ν** — NMS: ο μεγαλύτερος βαθμός νικά, ό,τι επικαλύπτει πάνω από το όριο φεύγει, ό,τι όχι μένει.
 */

import { decodeYunet, suppressOverlaps, yunetInputOf, type YunetInput, type YunetOutputs } from '../yunet-decode';

const STRIDES = [8, 16, 32] as const;

/** Έξοδοι γεμάτες «τίποτα» για είσοδο `size × size`, με όσα κελιά ορίσει ο καλών. */
function outputsFor(size: number, cells: readonly { s: number; r: number; c: number; cls: number; obj: number; box: readonly number[] }[]): YunetOutputs {
  const outputs: Record<string, { data: Float32Array }> = {};
  for (const s of STRIDES) {
    const n = (size / s) ** 2;
    outputs[`cls_${s}`] = { data: new Float32Array(n) };
    outputs[`obj_${s}`] = { data: new Float32Array(n) };
    outputs[`bbox_${s}`] = { data: new Float32Array(n * 4) };
    outputs[`kps_${s}`] = { data: new Float32Array(n * 10) };
  }
  for (const cell of cells) {
    const i = cell.r * (size / cell.s) + cell.c;
    outputs[`cls_${cell.s}`].data[i] = cell.cls;
    outputs[`obj_${cell.s}`].data[i] = cell.obj;
    outputs[`bbox_${cell.s}`].data.set(cell.box, i * 4);
  }
  return outputs;
}

const input = (size: number): YunetInput => ({ data: new Float32Array(3 * size * size), width: size, height: size });

describe('Β — blob εισόδου', () => {
  const image = { data: Uint8Array.from([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120]), width: 2, height: 2, channels: 3 };

  it('BGR επίπεδα, τιμές 0–255, συμπλήρωση ως το 32', () => {
    const blob = yunetInputOf(image, { left: 0, top: 0, width: 2, height: 2 });
    expect([blob.width, blob.height]).toEqual([32, 32]);
    const plane = 32 * 32;
    expect([blob.data[0], blob.data[plane], blob.data[2 * plane]]).toEqual([30, 20, 10]);
    expect([blob.data[32], blob.data[plane + 32], blob.data[2 * plane + 32]]).toEqual([90, 80, 70]);
    expect(blob.data[2]).toBe(0);
    expect(blob.data[32 * 2]).toBe(0);
  });

  it('ορθογώνιο με μετατόπιση ⇒ το pixel (1,1) γίνεται (0,0)', () => {
    const blob = yunetInputOf(image, { left: 1, top: 1, width: 1, height: 1 });
    expect([blob.data[0], blob.data[32 * 32], blob.data[2 * 32 * 32]]).toEqual([120, 110, 100]);
  });

  it('μη πολλαπλάσιο του 32 στρογγυλεύει ΠΑΝΩ (33 ⇒ 64)', () => {
    const wide = { data: new Uint8Array(33 * 3), width: 33, height: 1, channels: 3 };
    expect(yunetInputOf(wide, { left: 0, top: 0, width: 33, height: 1 }).width).toBe(64);
  });
});

describe('Α — αποκωδικοποίηση', () => {
  it('πλαίσιο από κελί (r=2, c=3) του βήματος 8: κέντρο (c+dx)·s, μέγεθος e^dw·s', () => {
    const outputs = outputsFor(64, [{ s: 8, r: 2, c: 3, cls: 0.81, obj: 1, box: [0.5, 0.25, Math.log(4), Math.log(2)] }]);
    const [box] = decodeYunet(outputs, input(64), 0.5);
    expect(box.score).toBeCloseTo(0.9, 6);
    expect(box.w).toBeCloseTo(32, 6);
    expect(box.h).toBeCloseTo(16, 6);
    expect(box.x + box.w / 2).toBeCloseTo(28, 6);
    expect(box.y + box.h / 2).toBeCloseTo(18, 6);
  });

  it('βαθμός = √(cls·obj) με σύσφιξη στο [0, 1] · κάτω από το κατώφλι ⇒ τίποτα', () => {
    const cell = { s: 16, r: 0, c: 0, box: [0, 0, 0, 0] };
    expect(decodeYunet(outputsFor(64, [{ ...cell, cls: 1.7, obj: 0.64 }]), input(64), 0.5)[0].score).toBeCloseTo(0.8, 6);
    expect(decodeYunet(outputsFor(64, [{ ...cell, cls: -0.2, obj: 1 }]), input(64), 0.01)).toEqual([]);
    expect(decodeYunet(outputsFor(64, [{ ...cell, cls: 0.2, obj: 0.2 }]), input(64), 0.5)).toEqual([]);
  });

  it('και τα τρία βήματα διαβάζονται (κελί στο 32 ⇒ πλαίσιο σε κλίμακα 32)', () => {
    const [box] = decodeYunet(outputsFor(64, [{ s: 32, r: 1, c: 1, cls: 1, obj: 1, box: [0, 0, 0, 0] }]), input(64), 0.5);
    expect([box.x, box.y, box.w, box.h]).toEqual([16, 16, 32, 32]);
  });

  it('έξοδος που λείπει ⇒ πετά (άλλο μοντέλο), ποτέ «κανένα πρόσωπο»', () => {
    const { cls_8: _dropped, ...rest } = outputsFor(64, []);
    expect(() => decodeYunet(rest, input(64))).toThrow(/cls_8/);
  });
});

describe('Ν — NMS', () => {
  const box = (x: number, score: number) => ({ x, y: 0, w: 10, h: 10, score });

  it('ο μεγαλύτερος βαθμός νικά · επικάλυψη > όριο φεύγει · ≤ όριο μένει', () => {
    expect(suppressOverlaps([box(0, 0.6), box(1, 0.9)], 0.3)).toEqual([box(1, 0.9)]);
    expect(suppressOverlaps([box(0, 0.6), box(8, 0.9)], 0.3).map((b) => b.x).sort()).toEqual([0, 8]);
  });
});
