/**
 * snap-description-keys.ts — SSoT map: snap-candidate `description` → i18n label key.
 *
 * Extracted from `canvas-v2/overlays/SnapIndicatorOverlay.tsx` (ADR-363 Φ1G.5 Slice 2i)
 * so BOTH the 2D snap indicator AND the 3D gizmo snap-type label resolve the same Greek
 * labels ("Γωνία τοίχου", "Παρειά τοίχου", …) from one place — no duplicated map.
 *
 * BIM snap engines emit a stable `description` (e.g. 'bim-wall-corner'); generic engines
 * emit a free label. For generic types prefer `snapModes.labels.<ExtendedSnapType>` —
 * see `resolveSnapLabelKey`.
 */

import { ExtendedSnapType } from './extended-types';

/** BIM description → i18n key under `snapModes.labels.bim.*`. */
export const BIM_SNAP_DESCRIPTION_KEY: Readonly<Record<string, string>> = {
  'bim-wall':           'snapModes.labels.bim.wallAxis',
  'bim-slab':           'snapModes.labels.bim.slabEdge',
  'bim-opening':        'snapModes.labels.bim.openingJamb',
  'bim-column':         'snapModes.labels.bim.columnAxis',
  'bim-wall-corner':    'snapModes.labels.bim.wallCorner',
  // ADR-363 Φ1G.5 Slice 2i: wall FACE line (face-to-face magnetism)
  'bim-wall-face':      'snapModes.labels.bim.wallFace',
  'bim-beam-corner':    'snapModes.labels.bim.beamCorner',
  'bim-slab-corner':    'snapModes.labels.bim.slabCorner',
  'bim-column-corner':  'snapModes.labels.bim.columnCorner',
  'bim-opening-corner': 'snapModes.labels.bim.openingCorner',
  'bim-mep-connector':  'snapModes.labels.bim.mepConnector',
};

/**
 * Resolve the i18n key for a snap result. Prefers the BIM description map (precise
 * "Παρειά τοίχου" etc.); falls back to the generic `snapModes.labels.<type>` key
 * (endpoint / midpoint / grid / nearest …) which all exist in the locales.
 */
export function resolveSnapLabelKey(type: ExtendedSnapType, description?: string): string {
  if (description && BIM_SNAP_DESCRIPTION_KEY[description]) return BIM_SNAP_DESCRIPTION_KEY[description];
  return `snapModes.labels.${type}`;
}
