/**
 * snap-description-keys.ts — SSoT: snap-candidate `description` → human i18n label.
 *
 * Used by BOTH the 2D snap indicator AND the 3D gizmo snap-type label so they resolve
 * the same Greek labels ("Γωνία τοίχου", "Παρειά τοίχου", …) from one place.
 *
 * Two description shapes:
 *   - **Characteristic points** (ADR-370): `bim-<root>-<corner|mid|center>` — composed
 *     at render time from a CATEGORY noun («Γωνία/Μέσο/Κέντρο») + an ENTITY noun
 *     («τοίχου/δοκαριού/θεμελίωσης»…) so 3 categories × ~20 entities need ~23 keys, not
 *     60. Empty description (`''`) → «περίεργο σχήμα» → no label (req #4).
 *   - **Legacy single-key** snaps (`bim-wall` axis, `bim-wall-face`, `bim-mep-connector`,
 *     …) → a fixed `BIM_SNAP_DESCRIPTION_KEY` entry.
 */

import type { TFunction } from 'i18next';
import { ExtendedSnapType } from './extended-types';

/** BIM (non-characteristic) description → i18n key under `snapModes.labels.bim.*`. */
export const BIM_SNAP_DESCRIPTION_KEY: Readonly<Record<string, string>> = {
  'bim-wall':           'snapModes.labels.bim.wallAxis',
  'bim-slab':           'snapModes.labels.bim.slabEdge',
  'bim-opening':        'snapModes.labels.bim.openingJamb',
  'bim-column':         'snapModes.labels.bim.columnAxis',
  // ADR-363 Φ1G.5 Slice 2i: wall FACE line (face-to-face magnetism)
  'bim-wall-face':      'snapModes.labels.bim.wallFace',
  'bim-mep-connector':  'snapModes.labels.bim.mepConnector',
};

/** Characteristic-point category suffix → category-noun i18n key («Γωνία/Μέσο/Κέντρο»). */
const BIM_CHAR_CATEGORY_KEY: Readonly<Record<string, string>> = {
  corner: 'snapModes.labels.bim.category.corner',
  mid: 'snapModes.labels.bim.category.midpoint',
  center: 'snapModes.labels.bim.category.center',
};

/**
 * Parse a `bim-<root>-<cat>` characteristic-point description into its category +
 * entity-noun i18n keys, or `null` if it is not a characteristic-point description
 * (legacy axis/face/connector descriptions, or a free generic label).
 */
function parseBimCharDescription(description: string): { categoryKey: string; nounKey: string } | null {
  const parts = description.split('-');
  if (parts.length !== 3 || parts[0] !== 'bim') return null;
  const categoryKey = BIM_CHAR_CATEGORY_KEY[parts[2]!];
  if (!categoryKey) return null;
  return { categoryKey, nounKey: `snapModes.labels.bim.noun.${parts[1]}` };
}

/**
 * Resolve the BIM-specific human label for a snap candidate (characteristic-point
 * composition OR a legacy fixed key), or `null` if the description carries no BIM
 * label — the 2D overlay then renders the glyph WITHOUT text (req #4).
 */
export function resolveBimSnapLabelText(t: TFunction, description?: string): string | null {
  if (!description) return null;
  const char = parseBimCharDescription(description);
  if (char) return `${t(char.categoryKey)} ${t(char.nounKey)}`;
  const key = BIM_SNAP_DESCRIPTION_KEY[description];
  return key ? t(key) : null;
}

/**
 * Resolve the full human label for ANY snap candidate: BIM-specific when available,
 * else the generic `snapModes.labels.<type>` (endpoint / midpoint / grid …). Used by the
 * 3D gizmo, which always shows a label.
 */
export function resolveSnapLabelText(t: TFunction, type: ExtendedSnapType, description?: string): string {
  return resolveBimSnapLabelText(t, description) ?? t(`snapModes.labels.${type}`);
}

/**
 * Legacy key resolver (kept for back-compat with callers that need a KEY, not text).
 * Prefers the BIM description map; falls back to the generic `snapModes.labels.<type>`.
 * Characteristic-point descriptions are composed (two keys) so they are NOT resolvable to
 * a single key here — use {@link resolveSnapLabelText} for those.
 */
export function resolveSnapLabelKey(type: ExtendedSnapType, description?: string): string {
  if (description && BIM_SNAP_DESCRIPTION_KEY[description]) return BIM_SNAP_DESCRIPTION_KEY[description];
  return `snapModes.labels.${type}`;
}
