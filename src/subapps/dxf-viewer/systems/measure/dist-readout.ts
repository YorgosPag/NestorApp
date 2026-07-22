/**
 * ADR-680 — καθαρή γεωμετρία + label formatting για την ένδειξη του εφήμερου DIST.
 *
 * No React, no DOM — unit-testable. Χρησιμοποιεί το SSoT length formatter του editor
 * (`formatSceneLengthForDisplay`) ώστε η ένδειξη να ακολουθεί τη μονάδα του status-bar
 * (m/cm/mm…), π.χ. «3,45 μ».
 *
 * @module subapps/dxf-viewer/systems/measure/dist-readout
 */

import { formatSceneLengthForDisplay } from '../../config/display-length-format';
import type { SceneUnits } from '../../utils/scene-units';
import type { DistPoint } from './dist-ephemeral-store';

export interface DistSegmentReadout {
  /** Μέσο του τμήματος (scene units, με z) — θέση για το label σε 2D **και** 3D. */
  readonly mid: DistPoint;
  readonly length: number;
  readonly label: string;
}

export interface DistReadout {
  readonly segments: readonly DistSegmentReadout[];
  readonly total: number;
  readonly totalLabel: string;
}

/**
 * Ανά-τμήμα μήκη + labels + τρέχον ΣΥΝΟΛΟ για πολυγραμμή από scene-unit σημεία.
 * Το μήκος είναι **3D** (`Math.hypot(dx, dy, dz)`)· απούσα z ⇒ 0, άρα η 2D έξοδος είναι αμετάβλητη.
 */
export function computeDistReadout(points: readonly DistPoint[], sceneUnits: SceneUnits): DistReadout {
  const segments: DistSegmentReadout[] = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const az = a.z ?? 0;
    const bz = b.z ?? 0;
    const length = Math.hypot(b.x - a.x, b.y - a.y, bz - az);
    total += length;
    const dz = (az + bz) / 2;
    segments.push({
      mid: dz !== 0
        ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: dz }
        : { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      length,
      label: formatSceneLengthForDisplay(length, sceneUnits),
    });
  }
  return { segments, total, totalLabel: formatSceneLengthForDisplay(total, sceneUnits) };
}
