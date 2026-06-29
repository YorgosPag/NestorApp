/**
 * ADR-516 — INPUT PREDICTION (latency compensation) for the 3D gizmo-move drag.
 *
 * The OS hardware cursor is composited at 0ms, but the BIM entity is WebGL content
 * that appears ~1 frame later (measured ~28ms present/compositor latency — ADR-549,
 * `scene-setup.ts`). During a gizmo-axis drag the entity therefore *trails* the cursor.
 *
 * The physical present-latency cannot drop below vsync, so — like Microsoft "Zero-Latency
 * Inking", Apple PencilKit predicted touches and Chrome `getPredictedEvents` — we do the
 * inverse: draw the entity at the position the cursor *will* reach in `PRESENT_LATENCY_MS`,
 * extrapolated from its EMA-smoothed velocity. When the frame presents, the cursor has
 * arrived there → they coincide.
 *
 * Pure & stateful-per-instance (one predictor per drag session). Decay-to-zero on settle
 * (velocity → 0 ⇒ prediction → 0) so a stopped/slow cursor sits EXACTLY on the entity with
 * zero overshoot/jitter. This is lag «type A» solved architecturally (ADR-516 §1), NOT config.
 *
 * IMPORTANT: prediction is VISUAL-ONLY during the move — the pointer-up commit uses the RAW
 * position, so the final written transform never carries the predicted overshoot.
 *
 * @module bim-3d/gizmo/pointer-prediction
 */

export interface PointerPredictionConfig {
  /** Horizon (ms) — how far ahead to extrapolate. The measured WebGL present latency. */
  readonly PRESENT_LATENCY_MS: number;
  /** EMA smoothing factor (0..1) — higher = more responsive, lower = smoother. */
  readonly EMA_ALPHA: number;
  /** Clamp: max prediction distance (px) — caps overshoot on sharp moves. */
  readonly MAX_AHEAD_PX: number;
  /** Below this speed (px/ms) the prediction is zeroed (settle exactly on the cursor). */
  readonly STOP_VEL_PX_PER_MS: number;
  /** A/B toggle — when false the caller should pass the raw position instead. */
  readonly ENABLED: boolean;
}

export interface PredictedPoint {
  readonly x: number;
  readonly y: number;
}

export interface PointerPredictor {
  /** Drop velocity + history. Call at drag begin/end so the next drag starts clean. */
  reset(): void;
  /** Feed the latest raw client position + event timestamp; returns the predicted position. */
  predict(clientX: number, clientY: number, tMs: number): PredictedPoint;
}

/**
 * Velocity-based pointer predictor. `cfg` is read live (the caller may pass the
 * `DXF_TIMING.prediction` object directly so tuning takes effect without re-creation).
 */
export function createPointerPredictor(cfg: PointerPredictionConfig): PointerPredictor {
  let lastX = 0;
  let lastY = 0;
  let lastT = 0;
  let velX = 0;
  let velY = 0;
  let primed = false;

  const reset = (): void => {
    primed = false;
    velX = 0;
    velY = 0;
  };

  const predict = (clientX: number, clientY: number, tMs: number): PredictedPoint => {
    // First sample of a drag (or just after reset) → no velocity yet, return raw.
    if (!primed) {
      primed = true;
      lastX = clientX;
      lastY = clientY;
      lastT = tMs;
      return { x: clientX, y: clientY };
    }
    const dt = tMs - lastT;
    // Same-timestamp (coalesced) or clock anomaly → keep position, never extrapolate on ÷0.
    if (dt <= 0) {
      lastX = clientX;
      lastY = clientY;
      return { x: clientX, y: clientY };
    }
    const a = cfg.EMA_ALPHA;
    velX = a * ((clientX - lastX) / dt) + (1 - a) * velX;
    velY = a * ((clientY - lastY) / dt) + (1 - a) * velY;
    lastX = clientX;
    lastY = clientY;
    lastT = tMs;

    // Settle: a slow/stopped cursor sits EXACTLY on the entity (zero jitter/overshoot).
    if (Math.hypot(velX, velY) < cfg.STOP_VEL_PX_PER_MS) {
      return { x: clientX, y: clientY };
    }
    let aheadX = velX * cfg.PRESENT_LATENCY_MS;
    let aheadY = velY * cfg.PRESENT_LATENCY_MS;
    const aheadLen = Math.hypot(aheadX, aheadY);
    if (aheadLen > cfg.MAX_AHEAD_PX) {
      const scale = cfg.MAX_AHEAD_PX / aheadLen;
      aheadX *= scale;
      aheadY *= scale;
    }
    return { x: clientX + aheadX, y: clientY + aheadY };
  };

  return { reset, predict };
}
