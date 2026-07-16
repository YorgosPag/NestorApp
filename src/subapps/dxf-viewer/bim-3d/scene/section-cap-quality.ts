/**
 * section-cap-quality — ADR-452 v2.7/v2.9/v2.12 — the stencil-cap quality tier picker.
 *
 * N.7.1 size split (ADR-665): extracted from `SectionSceneController`, which grew past the
 * 500-line cap. Self-contained by nature — it owns the motion-detection state (last camera pose +
 * last rendered cut constants) that nothing else reads, and answers one question per frame:
 * how expensive may this frame's caps be?
 *
 * @module bim-3d/scene/section-cap-quality
 */

import * as THREE from 'three';
import { detectCutMoving } from './axis-cut-composer';
import { isPointerActive } from '../systems/pointer-activity';
import type { SectionCapQuality } from '../systems/section/section-stencil-renderer';
import { DXF_TIMING } from '../../config/dxf-timing';

/**
 * ADR-452 — a cursor sweep within this window counts as motion → cheap grey caps. MUST stay
 * below `REFINE_DELAY_MS` so the refine frame (fired after the cursor stops) reads as settled.
 */
const POINTER_SETTLE_MS = DXF_TIMING.gesture.POINTER_SETTLE; // ADR-516

export interface CapQualityDecision {
  readonly quality: SectionCapQuality;
  /** True when a cut constant changed since the last rendered frame (slider drag). */
  readonly cutMoving: boolean;
}

/**
 * Tracks the per-frame motion signals that drive cap quality. One instance per controller.
 *
 * ADR-452 v2.7 — the camera pose is tracked so ANY camera navigation counts as a draft frame:
 * `isInteracting` only flips for orbit/pan/tumble (OrbitControls `start`/`end`); **wheel-zoom and
 * animated moves call `onRenderNeeded` WITHOUT it**, so they would otherwise hit the expensive
 * full-quality cap path every frame. NaN seed → the first frame always counts as moved.
 */
export class SectionCapQualityTracker {
  private lastRenderedCutConstants: number[] = [];
  private readonly lastCamPos = new THREE.Vector3(NaN, NaN, NaN);
  private readonly lastCamQuat = new THREE.Quaternion(NaN, NaN, NaN, NaN);
  private lastCamZoom = NaN;

  /**
   * ADR-452 cap-quality tiering, from three independent motion signals:
   *  • cutMoving   — cut-plane constant changed (slider drag fires applyState→markDirty).
   *  • camMoved    — camera pose changed since last frame: covers wheel-zoom and animated
   *                  moves, which mark the scene dirty WITHOUT `interacting`.
   *  • interacting — orbit/pan/tumble (the only gestures that set the flag).
   *
   * The ladder:
   *  • cut-slider drag (cutMoving) → 'colors' — live coloured cut faces while the cut constant
   *    changes (Giorgio 2026-06-19 «κράτα τα χρώματα στο σύρσιμο»).
   *  • camera orbit / zoom (interacting || camMoved) → 'fast' — grey base ONLY. The coloured
   *    poché re-renders the whole BIM scene ~2×(1+N_colours) times/frame; that is the section-nav
   *    lag. Dropping it to grey during camera motion is the big perf win (Giorgio 2026-06-26 «γκρι
   *    στην περιστροφή»). The coloured 'full' frame snaps back the instant motion settles, via the
   *    controller's on-demand refine (armRefine).
   *  • settled → 'full' — + hatch overlays + selection emphasis.
   *
   * ADR-452 (2026-06-28) — a moving cursor (hover sweep) is a motion signal too: the per-hover
   * markSceneDirty repaints the whole frame, and an active axis-cut would otherwise run the
   * 2×(1+N) coloured 'full' caps on EVERY hover frame (the «swim»). Treat it like camera motion →
   * cheap grey 'fast' caps while sweeping; the existing refine-on-settle restores colour the
   * instant the cursor stops. POINTER_SETTLE_MS < REFINE_DELAY_MS → the refine frame reads settled.
   */
  pick(camera: THREE.Camera, cutConstants: number[], interacting: boolean): CapQualityDecision {
    const cutMoving = detectCutMoving(cutConstants, this.lastRenderedCutConstants);
    this.lastRenderedCutConstants = cutConstants;

    const camZoom = (camera as THREE.Camera & { zoom?: number }).zoom ?? 1;
    const camMoved =
      !camera.position.equals(this.lastCamPos) ||
      !camera.quaternion.equals(this.lastCamQuat) ||
      camZoom !== this.lastCamZoom;
    this.lastCamPos.copy(camera.position);
    this.lastCamQuat.copy(camera.quaternion);
    this.lastCamZoom = camZoom;

    const pointerActive = isPointerActive(
      typeof performance !== 'undefined' ? performance.now() : 0,
      POINTER_SETTLE_MS,
    );

    const quality: SectionCapQuality = cutMoving
      ? 'colors'
      : (interacting || camMoved || pointerActive)
        ? 'fast'
        : 'full';

    return { quality, cutMoving };
  }
}
