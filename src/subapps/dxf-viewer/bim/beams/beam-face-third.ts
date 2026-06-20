/**
 * Beam ghost anchor-third — thin alias (ADR-508). Η λογική ζει στο generic SSoT
 * `bim/framing/member-face-third` (κοινό δοκάρι+τοίχος)· εδώ μένει η ιστορική beam ταυτότητα.
 *
 * @see ../framing/member-face-third.ts — canonical SSoT (`pickThird`)
 */

export { pickThird, type MemberGhostThird as BeamGhostThird } from '../framing/member-face-third';
