/**
 * Text / MText grip-kind discriminator union — extracted from `grip-kinds.ts`
 * (SRP / Google file-size standard N.7.1). Re-exported from `grip-kinds.ts` for
 * backward compatibility, so existing `import { TextGripKind } from '../grip-kinds'`
 * call-sites keep working.
 */

/**
 * ADR-557 — Text / MText grip kind (parametric grip type). Routes commit through
 * `applyTextGripDrag()` + `UpdateTextTransformCommand` instead of the standard
 * `StretchEntityCommand` vertex path. FULL rectangular-box parity με τον τοίχο /
 * κολόνα (Giorgio 2026-06-30: «ίδιες λαβές, ίδιος κώδικας»): 4 γωνίες (opposite
 * corner fixed) + 4 μεσοπλευρικές (opposite edge fixed) + center MOVE + rotation,
 * όλα μέσω του κοινού `rect-grip-engine` SSoT. ΧΩΡΙΣ mirror (δεν ζητήθηκε).
 *
 * Grips exposed by `getTextGrips` (`bim/text/text-grips.ts`):
 *   - `text-move`     → translate `position` (4-arrow MOVE glyph)
 *   - `text-rotation` → rotate γύρω από το bbox-center (re-homes `position`)
 *   - `text-corner-{ne,nw,sw,se}` → 2-DOF γωνία resize (opposite corner fixed)
 *   - `text-edge-{e,w,n,s}`       → edge-midpoint resize (opposite edge fixed):
 *       e/w → πλάτος (MTEXT `width` / TEXT `widthFactor`), n/s → ύψος (`height`).
 */
export type TextGripKind =
  | 'text-move'
  | 'text-rotation'
  | 'text-corner-ne'
  | 'text-corner-nw'
  | 'text-corner-sw'
  | 'text-corner-se'
  | 'text-edge-e'
  | 'text-edge-w'
  | 'text-edge-n'
  | 'text-edge-s';
