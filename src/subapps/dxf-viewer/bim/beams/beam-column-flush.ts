/**
 * Beam side-face auto-flush — thin alias (ADR-508). Η λογική ζει στο generic SSoT
 * `bim/framing/member-column-flush` (κοινό δοκάρι+τοίχος, γενίκευση του ADR-363 §5.7).
 *
 * @see ../framing/member-column-flush.ts — canonical SSoT (`resolveMemberColumnFlushJustification`)
 */

export { resolveMemberColumnFlushJustification as resolveBeamColumnFlushJustification } from '../framing/member-column-flush';
