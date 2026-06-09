/**
 * ADR-435 — Clash severity → colour, SSoT (Slice 1b, Boy-Scout N.0.2).
 *
 * ONE palette shared by every clash surface so they can never drift:
 *   - the shared ⊙ glyph (`components/dxf-layout/clash-markers/ClashMarkerGlyph.tsx`),
 *     used by BOTH the 2D and the 3D camera-projected overlay
 *   - DOM report panel  (`components/dxf-layout/ClashReportPanel.tsx`)
 *
 * Navisworks-style triage: structural penetration = high (red), MEP↔MEP = medium
 * (amber), clearance = low (yellow). Pure data + a hex→THREE-int converter reused
 * from the MEP colour SSoT — THREE-free, so the engine layer stays headless.
 *
 * @see ./clash-types.ts (ClashSeverity)
 */

import type { ClashSeverity } from './clash-types';
import { hexToThreeInt } from '../../bim/mep-systems/mep-system-color';

/** Severity → CSS hex (the single palette; everything else reads this). */
export const CLASH_SEVERITY_COLOR: Readonly<Record<ClashSeverity, string>> = {
  high: '#dc2626',
  medium: '#f59e0b',
  low: '#eab308',
};

/** Severity → THREE colour int (for 3D materials). Falls back to red on a bad hex. */
export function clashSeverityColorInt(severity: ClashSeverity): number {
  return hexToThreeInt(CLASH_SEVERITY_COLOR[severity]) ?? 0xdc2626;
}
