/**
 * ADR-650 M8α — Ground classification entry point (the pipeline calls THIS, not the CSF directly).
 *
 * The whole point of this file is one decision that a naive implementation gets wrong:
 *
 *   A cloud from DJI Terra / Pix4D / Terrasolid arrives ALREADY classified (ASPRS class 2 =
 *   Ground). ReCap and Civil 3D HONOUR that classification instead of re-deriving it — the vendor
 *   filtered with the raw return/intensity data, we only ever see XYZ, so re-running CSF over an
 *   already-classified cloud is both slower AND worse. We do the same: source classification wins,
 *   CSF is the fallback (and the engineer's explicit override, `forceCsf`).
 *
 * Everything else lives elsewhere: the cloth is `csf-cloth.ts`, the class codes are
 * `asprs-las-spec.ts`. This file only chooses.
 */

import { ASPRS_CLASS } from './asprs-las-spec';
import { csfClassify } from './csf-cloth';
import type { CsfOptions, GroundClassifyResult, PointCloudData } from './pointcloud-types';

/**
 * Decide which points are bare earth.
 *
 * @param forceCsf engineer's override — run the cloth even on a classified cloud.
 * @param onProgress 0..1, only ever fired by the CSF branch (the source branch is instantaneous).
 */
export function classifyGround(
  data: PointCloudData,
  opts: CsfOptions,
  forceCsf: boolean,
  onProgress?: (ratio: number) => void,
): GroundClassifyResult {
  if (!forceCsf && data.classification !== null) {
    const fromSource = collectSourceGround(data.classification, data.count);
    if (fromSource.length > 0) {
      onProgress?.(1);
      return toResult(fromSource, 'source-classification', data.count);
    }
    // Classified, but nobody is class 2 (e.g. every point still «unclassified») → fall through.
  }

  return toResult(csfClassify(data, opts, onProgress), 'csf', data.count);
}

/** Two passes so the output is exactly-sized (a 30M cloud must not over-allocate 120 MB). */
function collectSourceGround(classification: Uint8Array, count: number): Uint32Array {
  let groundCount = 0;
  for (let i = 0; i < count; i++) if (classification[i] === ASPRS_CLASS.GROUND) groundCount++;

  const out = new Uint32Array(groundCount);
  let cursor = 0;
  for (let i = 0; i < count; i++) {
    if (classification[i] === ASPRS_CLASS.GROUND) out[cursor++] = i;
  }
  return out;
}

function toResult(
  groundIndices: Uint32Array,
  method: GroundClassifyResult['method'],
  totalCount: number,
): GroundClassifyResult {
  return {
    groundIndices,
    method,
    groundCount: groundIndices.length,
    nonGroundCount: totalCount - groundIndices.length,
  };
}
