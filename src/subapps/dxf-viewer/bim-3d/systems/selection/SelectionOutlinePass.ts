/**
 * SelectionOutlinePass — Cinema 4D / Revit-style silhouette outline for the
 * selected BIM entities. Thin wrapper around Three.js `OutlinePass`.
 *
 * Draws ONLY the outer silhouette of the selected objects with a gold edge —
 * the body material is left UNTOUCHED (unlike the old emissive highlight that
 * painted the whole mesh). The pass lives inside `SSAOModulator`'s EffectComposer
 * (RenderPass → SSAOPass → OutlinePass → CopyPass) so the outline composites on
 * top of whatever the scene render produced.
 *
 * `enabled` is driven by the selection: false when nothing is selected, so the
 * EffectComposer skips the pass entirely (zero cost on an empty selection).
 *
 * ADR-536. Replaces the emissive mechanism of ADR-366 A.1 (BimSelectionHighlighter).
 */

import * as THREE from 'three';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { BIM_SELECTION_OUTLINE_COLOR_THREE } from './selection-outline-tokens';

// Cinema 4D-grade tuning: crisp, strong silhouette with a subtle glow, no pulse.
const EDGE_STRENGTH = 4.0;
const EDGE_THICKNESS = 1.5;
const EDGE_GLOW = 0.3;
/** Occluded portion of the silhouette, shown faintly (× the visible color). */
const HIDDEN_EDGE_DIM = 0.25;

export class SelectionOutlinePass {
  private readonly _pass: OutlinePass;

  constructor(resolution: THREE.Vector2, scene: THREE.Scene, camera: THREE.Camera) {
    const pass = new OutlinePass(resolution, scene, camera, []);
    pass.visibleEdgeColor.set(BIM_SELECTION_OUTLINE_COLOR_THREE);
    pass.hiddenEdgeColor
      .set(BIM_SELECTION_OUTLINE_COLOR_THREE)
      .multiplyScalar(HIDDEN_EDGE_DIM);
    pass.edgeStrength = EDGE_STRENGTH;
    pass.edgeThickness = EDGE_THICKNESS;
    pass.edgeGlow = EDGE_GLOW;
    pass.pulsePeriod = 0; // static highlight (no breathing animation)
    pass.enabled = false; // nothing selected initially
    this._pass = pass;
  }

  /** The underlying pass — added to the EffectComposer chain by `SSAOModulator`. */
  get pass(): OutlinePass {
    return this._pass;
  }

  /**
   * Set the silhouetted objects. Empty array disables the pass so the composer
   * skips it (zero cost). A defensive copy is taken because OutlinePass mutates
   * its `selectedObjects` reference internally (visibility cache).
   */
  setSelected(objects: readonly THREE.Object3D[]): void {
    this._pass.selectedObjects = objects.slice();
    this._pass.enabled = objects.length > 0;
  }

  /** True when there is an active silhouette to draw (drives composer routing). */
  hasSelection(): boolean {
    return this._pass.enabled && this._pass.selectedObjects.length > 0;
  }

  /** Keep the outline camera in sync with the live viewport camera. */
  setCamera(camera: THREE.Camera): void {
    this._pass.renderCamera = camera;
  }

  setSize(width: number, height: number): void {
    this._pass.setSize(width, height);
  }

  dispose(): void {
    this._pass.dispose();
  }
}
