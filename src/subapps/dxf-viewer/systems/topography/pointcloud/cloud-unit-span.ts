/**
 * ADR-650 M8β/Ε — the unit a binary cloud never declared, made VISIBLE and VERIFIABLE.
 *
 * The LAS/LAZ public header states no unit (it lives in an optional CRS VLR that half the
 * instruments omit — see the `LasHeader` doc). Like Civil 3D / ReCap, we ask the engineer; unlike
 * a silent default, we PROVE the choice against the data first. This module is that proof:
 *
 *   header min/max  →  raw source extent  →  what the site would MEASURE under m / mm / ft
 *
 * The engineer reads the three candidates and recognises the sane one — «200 × 180 m» is a plot,
 * «0.2 m» cannot be, «61 m» is that same plot read in feet. It never GUESSES a unit: m and ft
 * differ by only ×3.28, so both yield a plausible site, and a wrong auto-pick would reintroduce the
 * exact 3× silent-scale error this milestone removes. PDAL and CloudCompare refuse to guess for the
 * same reason; so do we — we show the evidence and let the human certify. Deterministic, zero LLM.
 *
 * Pure: no store, no DOM. `readLasHeader` lives in the same folder (the "nobody outside `pointcloud/`
 * imports a reader directly" rule is about consumers, not siblings), so parsing a header here is in
 * bounds. Nothing in `pointcloud-read` imports this file, so no new load-time cycle is introduced.
 */

import { readLasHeader } from './las-reader';
import { TOPO_UNIT_SCALE_TO_MM } from '../topo-import-types';
import type { TopoUnit } from '../topo-import-types';
import type { CloudSourceExtent, LasHeader, UnitSpanReadout } from './pointcloud-types';

/** The candidate units offered, in the order a surveyor scans them (the common one first). */
const CANDIDATE_UNITS: readonly TopoUnit[] = ['m', 'mm', 'ft'];

const MM_PER_METER = 1000;

/** Raw per-axis extent of a parsed LAS/LAZ header, in the file's own source units. */
export function cloudSourceExtentFromLasHeader(header: LasHeader): CloudSourceExtent {
  return {
    dx: Math.abs(header.max.x - header.min.x),
    dy: Math.abs(header.max.y - header.min.y),
    dz: Math.abs(header.max.z - header.min.z),
  };
}

/**
 * Parse just the public header out of a LAS/LAZ head slice and return its raw extent. Returns
 * `null` when the bytes are not a readable LAS header (an ASCII cloud, a truncated slice, an
 * AutoCAD Layer State `.las`) — the wizard then simply shows the unit dropdown without a readout,
 * which still fixes the core bug (the control existing at all for binary clouds).
 */
export function cloudSourceExtentFromBuffer(headBytes: ArrayBuffer): CloudSourceExtent | null {
  try {
    return cloudSourceExtentFromLasHeader(readLasHeader(headBytes));
  } catch {
    return null;
  }
}

/**
 * The site's WORLD extent (metres) under each candidate unit. `TOPO_UNIT_SCALE_TO_MM` is the SAME
 * scale table the reader applies — reusing it guarantees the readout the engineer certifies matches
 * exactly what the cloud will be read as.
 */
export function unitSpanReadouts(extent: CloudSourceExtent): readonly UnitSpanReadout[] {
  return CANDIDATE_UNITS.map((unit) => {
    const metersPerSourceUnit = TOPO_UNIT_SCALE_TO_MM[unit] / MM_PER_METER;
    return {
      unit,
      widthMeters: extent.dx * metersPerSourceUnit,
      depthMeters: extent.dy * metersPerSourceUnit,
      heightMeters: extent.dz * metersPerSourceUnit,
    };
  });
}
