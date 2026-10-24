/**
 * ADR-444 §Icons — MEP ribbon icon TOKENS (pure data, zero React).
 *
 * Every MEP discipline-tab button names its icon as `subject` (WHAT is placed /
 * designed) × optional `badge` (WHAT HAPPENS to it). The token string is built by
 * {@link mepIconToken} in the ribbon data files and parsed back by
 * {@link parseMepIconToken} in the icon resolver — one vocabulary, validated at both
 * ends, so a typo can never silently fall back to the generic dot icon.
 *
 * Kept React-free so `systems-discipline-tabs.ts` (pure ribbon data) can import it
 * without pulling the SVG renderer into the data chunk.
 *
 * @see ./MepToolIcon.tsx — the renderer (plan-symbol subject + action badge)
 * @see docs/centralized-systems/reference/adrs/ADR-444-architecture-systems-permanent-ribbon-tabs.md
 */

/** Every MEP icon subject — one per placeable element / designable network. */
export const MEP_ICON_SUBJECTS = [
  // Electrical — strong current
  'luminaire', 'socket', 'electrical-panel',
  // Electrical — weak current
  'data-outlet', 'comms-rack',
  // Water supply
  'manifold', 'pipe', 'pipe-network',
  'wc', 'washbasin', 'shower', 'bathtub', 'bidet', 'washing-machine', 'bathroom',
  // Drainage
  'drainage-collector', 'drain-pipe', 'floor-drain', 'drain-riser',
  // Heating
  'radiator', 'boiler', 'water-heater', 'underfloor',
  // HVAC
  'duct', 'air-terminal', 'ahu',
  // Fire protection + gas
  'sprinkler', 'fire-riser', 'gas-meter', 'gas-cooker',
] as const;

export type MepIconSubject = (typeof MEP_ICON_SUBJECTS)[number];

/**
 * Action badges (bottom-right): the auto-design triad «Δημιουργία → Αποδοχή →
 * Απόρριψη» — Revit «Finish ✓ / Cancel ✗» + Office «Accept / Reject» convention.
 */
export const MEP_ICON_BADGES = ['generate', 'accept', 'reject'] as const;

export type MepIconBadge = (typeof MEP_ICON_BADGES)[number];

export interface MepIconSpec {
  readonly subject: MepIconSubject;
  readonly badge?: MepIconBadge;
}

const TOKEN_PREFIX = 'mep-icon';
const SEP = ':';

const SUBJECT_SET: ReadonlySet<string> = new Set(MEP_ICON_SUBJECTS);
const BADGE_SET: ReadonlySet<string> = new Set(MEP_ICON_BADGES);

/** Build the ribbon `icon` token for a subject (+ optional action badge). */
export function mepIconToken(subject: MepIconSubject, badge?: MepIconBadge): string {
  return badge ? `${TOKEN_PREFIX}${SEP}${subject}${SEP}${badge}` : `${TOKEN_PREFIX}${SEP}${subject}`;
}

function isSubject(value: string): value is MepIconSubject {
  return SUBJECT_SET.has(value);
}

function isBadge(value: string): value is MepIconBadge {
  return BADGE_SET.has(value);
}

/** Parse a ribbon `icon` token; `null` when it is not a (valid) MEP icon token. */
export function parseMepIconToken(token: string | undefined): MepIconSpec | null {
  if (!token) return null;
  const [prefix, subject, badge, ...rest] = token.split(SEP);
  if (prefix !== TOKEN_PREFIX || rest.length > 0 || subject === undefined || !isSubject(subject)) return null;
  if (badge === undefined) return { subject };
  return isBadge(badge) ? { subject, badge } : null;
}
