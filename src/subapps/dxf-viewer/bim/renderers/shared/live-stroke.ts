/**
 * ADR-909 Γ2.2 / Γ2.3 — **το ΕΝΑ σημείο όπου ένας ζωγράφος με δικό του χρώμα αποκτά μελάνι και πάχος**.
 *
 * Για ζωγράφους που το χρώμα τους είναι του **συστήματος ή του συμβόλου** (Η/Μ, σχήματα 3Δ) και το πάχος τους
 * σταθερό σε px (`RENDER_LINE_WIDTHS`) — δηλαδή έξω από τον `applyBimContentStroke` των Object Styles.
 *
 *  - Οθόνη ⇒ `color` και `widthPx` **αυτούσια** (καμία αλλαγή).
 *  - Print pass ⇒ η πολιτική εκτύπωσης ({@link liveStrokeInk}: άχρωμο σε «Ασπρόμαυρο» / «Γκρι», δάπεδο
 *    αντίθεσης όπου δηλώνεται) και το δάπεδο πάχους ({@link liveStrokeWidthPx}).
 *
 * 🔴 Πριν: ωμά `ctx.strokeStyle = …` + `ctx.lineWidth = …` σε κάθε ζωγράφο — ο θερμοσίφωνας έβγαινε μπλε
 * `#1d4ed8` 2 px στη δημόσια κάτοψη «Ασπρόμαυρο» (πύλη pixels 3.101, ADR-909 §6.9).
 *
 * ⚠️ ΟΧΙ για chrome (λάμψη hover, λαβές, marquee): αυτά δεν τυπώνονται και μένουν σταθερά.
 */
import { liveStrokeInk, liveStrokeWidthPx } from '../../../config/adaptive-entity-color';

export function applyLiveStroke(ctx: CanvasRenderingContext2D, color: string, widthPx: number): void {
  ctx.strokeStyle = liveStrokeInk(color);
  ctx.lineWidth = liveStrokeWidthPx(widthPx);
}
