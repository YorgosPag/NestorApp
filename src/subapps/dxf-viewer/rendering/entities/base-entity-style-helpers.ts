/**
 * 🏢 ENTERPRISE: BaseEntityRenderer stateless style helpers (pure ctx ops)
 *
 * @description Stateless canvas-style helpers extracted from {@link BaseEntityRenderer}
 * to keep that file ≤500 LOC (Google SRP). Each operates on a passed-in 2D context —
 * zero renderer state, zero subscriptions (ADR-040 leaf-safe).
 */

import { HOVER_HIGHLIGHT } from '../../config/color-config';
// ADR-510 Φ2 — canvas linetype dash: resolved metric pattern (mm) → setLineDash px.
import { dashMmToScreenPx } from '../linetype-dash-resolver';
import { getLinetypeScale } from '../../stores/LinetypeScaleStore';

/**
 * ADR-510 Φ2 — apply an entity's resolved metric linetype dash to a canvas context.
 * Absent/empty `dashMm` ⇒ no-op (the line stays solid → zero regression). Total
 * scale = zoom (`scale`) × global LTSCALE × per-object CELTSCALE (`entity.ltscale`),
 * unlike the zoom-independent lineweight.
 */
export function applyEntityLinetypeDash(
  ctx: CanvasRenderingContext2D,
  entity: { dashMm?: ReadonlyArray<number>; ltscale?: number },
  scale: number,
): void {
  const dashMm = entity.dashMm;
  if (dashMm && dashMm.length > 0) {
    ctx.setLineDash(dashMmToScreenPx(dashMm, scale, getLinetypeScale(), entity.ltscale ?? 1));
  }
}

/**
 * Glow pre-pass for highlighted entities — double-stroke replaces shadowBlur (GPU-free).
 * The caller gates on `phaseState.phase === 'highlighted'`; this draws the glow stroke
 * underneath the entity geometry, fully save/restore-balanced.
 */
export function drawEntityGlowPrePass(
  ctx: CanvasRenderingContext2D,
  entity: { lineWidth?: number },
  renderGeometry: () => void,
): void {
  const entityLineWidth = Math.max(1, entity.lineWidth || 1);
  ctx.save();
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = HOVER_HIGHLIGHT.ENTITY.glowColor;
  ctx.lineWidth = entityLineWidth + HOVER_HIGHLIGHT.ENTITY.glowExtraWidth;
  ctx.globalAlpha = HOVER_HIGHLIGHT.ENTITY.glowOpacity;
  ctx.setLineDash([]);
  renderGeometry();
  ctx.restore();
}
