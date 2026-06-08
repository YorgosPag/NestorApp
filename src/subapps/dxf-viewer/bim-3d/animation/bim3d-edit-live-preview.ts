'use client';

/**
 * bim3d-edit-live-preview.ts — live "the entity follows the cursor" preview for
 * the 3D BIM gizmo drag (ADR-402, live move/rotate/resize preview).
 *
 * Before this, the gizmo overlay followed the cursor during a drag but the entity
 * itself stayed put and "jumped" to the new place only on pointer-up (single-
 * commit-on-release). Giorgio asked the entity to follow live (Revit/Forge style).
 *
 * Two kinds of preview, both honouring single-commit-on-release (the real command
 * still fires once on release; this only changes what the user SEES mid-drag):
 *
 *   • RIGID transform (move / vertical move / rotate) — mutate the edited entities'
 *     top-level meshes (`position` / `quaternion`) directly. Each BIM entity is a
 *     DIRECT child of `bimLayer.group` tagged with `userData['bimId']` (a stair is
 *     several children sharing the id); the group sits at identity, so the meshes
 *     live in world space and a world-space translate/rotate applies as-is. For the
 *     selected entity this is EXACTLY what the command produces (walls/columns
 *     translate & rotate rigidly), so ghost === commit for that entity.
 *
 *   • RESIZE — a dimension change is not a transform, so the caller rebuilds the
 *     single entity's geometry via the converter SSoT and hands the fresh object
 *     here; we hide the originals and swap it in. This object keeps THIS class pure
 *     (THREE only, no converter import → trivially testable).
 *
 * Lifecycle (driven by the interaction handlers):
 *   pointerdown → captureTransform / captureResize
 *   pointermove → applyMove / applyRotate / applyResize   (+ manager.markSceneDirty)
 *   pointerup,  committed   → commit()  (drop refs; the command's resync replaces the meshes)
 *   pointerup,  no command  → reset()   (restore; no resync is coming)
 *   pointercancel / Esc     → reset()
 *
 * Render happens through the shared rAF SSoT (markSceneDirty + UnifiedFrameScheduler,
 * ADR-040/366) — this class never spins its own requestAnimationFrame.
 */

import * as THREE from 'three';

interface CapturedTransform {
  readonly obj: THREE.Object3D;
  readonly position: THREE.Vector3;
  readonly quaternion: THREE.Quaternion;
}

const UP = new THREE.Vector3(0, 1, 0);

export class Bim3DEditLivePreview {
  /** Originals captured for a rigid move/rotate preview (restored on cancel). */
  private transforms: CapturedTransform[] = [];
  /** Originals hidden for a resize preview (un-hidden on cancel). */
  private hidden: THREE.Object3D[] = [];
  /** The swapped-in resize preview object (removed + disposed on cancel). */
  private previewObject: THREE.Object3D | null = null;
  /** The `bimLayer.group` the resize preview is parented to. */
  private parent: THREE.Object3D | null = null;

  // ── ADR-401 — live attached-dependent re-clip (host move → attached wall) ──────
  /** Original meshes of the attached dependents, hidden during a host move (restored on cancel). */
  private dependentHidden: THREE.Object3D[] = [];
  /** The swapped-in dependent preview objects (removed + disposed each frame / on cancel). */
  private dependentObjects: THREE.Object3D[] = [];
  /** Ids of the attached dependent walls to rebuild per frame (caller builds the meshes). */
  private depWallIds: string[] = [];
  /** Ids of the dragged structural hosts whose live transform the dependents must follow. */
  private depHostIds: ReadonlySet<string> = new Set();

  // ── ADR-408 Φ7 P2 — live circuit-wire follow (host move → conduit re-route) ───
  /** Original conduit meshes of the affected circuits, hidden during the move (restored on cancel). */
  private wireHidden: THREE.Object3D[] = [];
  /** The swapped-in wire preview meshes (removed + disposed each frame / on cancel). */
  private wireObjects: THREE.Object3D[] = [];
  /** Ids of the circuits to rebuild per frame (a dragged host is their source/member). */
  private wireSystemIds: string[] = [];

  // ── ADR-408 Φ-C — live connected-pipe follow (host/pipe move → pipe ends stretch) ──
  /** Original meshes of the connected pipe segments, hidden during the edit (restored on cancel). */
  private pipeHidden: THREE.Object3D[] = [];
  /** The swapped-in pipe-follow preview meshes (removed + disposed each frame / on cancel). */
  private pipeObjects: THREE.Object3D[] = [];
  /** Ids of the connected pipe segments to rebuild per frame (snapped to a dragged MEP entity). */
  private pipeSegmentIds: string[] = [];

  /** True while a preview is in effect (capture done, not yet committed/reset). */
  get isActive(): boolean {
    return (
      this.transforms.length > 0 ||
      this.hidden.length > 0 ||
      this.previewObject !== null ||
      this.dependentHidden.length > 0 ||
      this.dependentObjects.length > 0 ||
      this.wireSystemIds.length > 0 ||
      this.wireObjects.length > 0 ||
      this.pipeSegmentIds.length > 0 ||
      this.pipeObjects.length > 0
    );
  }

  /** Affected circuit ids captured for this drag (empty when no dragged host is wired). */
  get circuitWireSystemIds(): readonly string[] {
    return this.wireSystemIds;
  }

  /** Connected pipe-segment ids captured for this drag (empty when nothing connects). */
  get connectedPipeSegmentIds(): readonly string[] {
    return this.pipeSegmentIds;
  }

  /** Attached dependent wall ids captured for this drag (empty when none / not a host move). */
  get dependentWallIds(): readonly string[] {
    return this.depWallIds;
  }

  /** Dragged host ids the dependents follow (the ones whose footprint moved). */
  get movedHostIds(): ReadonlySet<string> {
    return this.depHostIds;
  }

  /**
   * Capture the edited entities' top-level meshes for a rigid move/rotate preview.
   * Scans the DIRECT children of `group` (one per entity, several for a stair) and
   * stores each one's original world transform.
   */
  captureTransform(group: THREE.Object3D, ids: ReadonlySet<string>): void {
    this.reset();
    for (const child of group.children) {
      const id = child.userData['bimId'] as string | undefined;
      if (id !== undefined && ids.has(id)) {
        this.transforms.push({
          obj: child,
          position: child.position.clone(),
          quaternion: child.quaternion.clone(),
        });
      }
    }
  }

  /** Live move: each captured mesh sits at `original + translation` (world space). */
  applyMove(translation: THREE.Vector3): void {
    for (const t of this.transforms) t.obj.position.copy(t.position).add(translation);
  }

  /**
   * Live rotate about the world-Y axis through `pivot` by `angleRad`. Rotates both
   * the position (orbit around the pivot) and the orientation of every captured mesh.
   * DXF-plan CCW rotation maps 1:1 to world +Y rotation (see coordinate-transforms),
   * so this matches the `RotateEntityCommand` result on release.
   */
  applyRotate(pivot: THREE.Vector3, angleRad: number): void {
    const q = new THREE.Quaternion().setFromAxisAngle(UP, angleRad);
    for (const t of this.transforms) {
      t.obj.position.copy(t.position).sub(pivot).applyQuaternion(q).add(pivot);
      t.obj.quaternion.copy(q).multiply(t.quaternion);
    }
  }

  /**
   * ADR-401 — begin a live re-clip of the attached dependents of a moving host
   * (beam/slab move → attached wall top-clip follows). Called AFTER
   * `captureTransform` (the dragged host is captured there for the rigid move),
   * so this does NOT reset: it only records the dependent walls' original meshes
   * (to hide + restore) plus the ids the caller needs to rebuild them each frame.
   * The fresh dependent meshes are supplied per-frame to `applyDependents` (built
   * via the converter SSoT — kept out of this THREE-only class).
   */
  captureDependents(group: THREE.Object3D, wallIds: readonly string[], hostIds: ReadonlySet<string>): void {
    this.parent = group;
    this.depWallIds = [...wallIds];
    this.depHostIds = hostIds;
    const idSet = new Set(wallIds);
    for (const child of group.children) {
      const id = child.userData['bimId'] as string | undefined;
      if (id !== undefined && idSet.has(id)) this.dependentHidden.push(child);
    }
  }

  /**
   * Swap in the freshly rebuilt dependent objects for this frame: hide the
   * originals, remove + dispose the previous frame's dependents, parent the new
   * ones. `null` entries (a dependent that could not be rebuilt) are skipped.
   */
  applyDependents(rebuilt: readonly (THREE.Object3D | null)[]): void {
    if (!this.parent) return;
    for (const o of this.dependentHidden) o.visible = false;
    for (const o of this.dependentObjects) {
      this.parent.remove(o);
      disposeObject(o);
    }
    this.dependentObjects = [];
    for (const o of rebuilt) {
      if (!o) continue;
      this.dependentObjects.push(o);
      this.parent.add(o);
    }
  }

  /**
   * ADR-408 Φ7 P2 — begin a live re-route of the affected circuit conduits of a
   * moving fixture/panel. Called AFTER `captureTransform` (so it does NOT reset):
   * records the conduit meshes of `systemIds` (the direct children tagged with
   * `mepWireSystemId`) to hide + restore. Fresh meshes are supplied per-frame to
   * `applyWires` (built via the routing + converter SSoT — kept out of this class).
   */
  captureWires(group: THREE.Object3D, systemIds: readonly string[]): void {
    this.parent = group;
    this.wireSystemIds = [...systemIds];
    const idSet = new Set(systemIds);
    for (const child of group.children) {
      const sid = child.userData['mepWireSystemId'] as string | undefined;
      if (sid !== undefined && idSet.has(sid)) this.wireHidden.push(child);
    }
  }

  /**
   * Swap in the freshly re-routed conduit meshes for this frame: hide the
   * originals, remove + dispose the previous frame's wires, parent the new ones.
   */
  applyWires(rebuilt: readonly THREE.Object3D[]): void {
    if (!this.parent) return;
    for (const o of this.wireHidden) o.visible = false;
    for (const o of this.wireObjects) {
      this.parent.remove(o);
      disposeObject(o);
    }
    this.wireObjects = [];
    for (const o of rebuilt) {
      this.wireObjects.push(o);
      this.parent.add(o);
    }
  }

  /**
   * ADR-408 Φ-C — begin a live follow of the pipe segments connected to a dragged
   * MEP entity (host move/rotate/vertical → snapped pipe ends stretch). Called AFTER
   * `captureTransform` (so it does NOT reset): records the connected pipe meshes
   * (`segmentIds`, direct children tagged with `bimId`) to hide + restore. Fresh
   * meshes are supplied per-frame to `applyPipes` (built via the converter SSoT).
   */
  capturePipes(group: THREE.Object3D, segmentIds: readonly string[]): void {
    this.parent = group;
    this.pipeSegmentIds = [...segmentIds];
    const idSet = new Set(segmentIds);
    for (const child of group.children) {
      const id = child.userData['bimId'] as string | undefined;
      if (id !== undefined && idSet.has(id)) this.pipeHidden.push(child);
    }
  }

  /**
   * Swap in the freshly rebuilt connected-pipe meshes for this frame: hide the
   * originals, remove + dispose the previous frame's pipes, parent the new ones.
   */
  applyPipes(rebuilt: readonly THREE.Object3D[]): void {
    if (!this.parent) return;
    for (const o of this.pipeHidden) o.visible = false;
    for (const o of this.pipeObjects) {
      this.parent.remove(o);
      disposeObject(o);
    }
    this.pipeObjects = [];
    for (const o of rebuilt) {
      this.pipeObjects.push(o);
      this.parent.add(o);
    }
  }

  /**
   * Begin a resize preview: remember (and prepare to hide) the original direct
   * children that render `entityId` under `group`. The fresh geometry is supplied
   * per-frame to `applyResize` by the caller (built via the converter SSoT).
   */
  captureResize(group: THREE.Object3D, entityId: string): void {
    this.reset();
    this.parent = group;
    for (const child of group.children) {
      if ((child.userData['bimId'] as string | undefined) === entityId) this.hidden.push(child);
    }
  }

  /**
   * Swap in the freshly rebuilt resize object: hide the originals, replace the
   * previous preview object (disposing it). A `null` object (no-op resize frame)
   * leaves the last preview standing.
   */
  applyResize(rebuilt: THREE.Object3D | null): void {
    if (!rebuilt || !this.parent) return;
    for (const o of this.hidden) o.visible = false;
    if (this.previewObject) {
      this.parent.remove(this.previewObject);
      disposeObject(this.previewObject);
    }
    this.previewObject = rebuilt;
    this.parent.add(rebuilt);
  }

  /**
   * Commit: the real command ran, so its scene re-sync will rebuild every mesh.
   * Drop the captured refs WITHOUT touching the scene — the preview already shows
   * the final result, so there is no jump (the rebuilt meshes replace it).
   */
  commit(): void {
    this.clearState();
  }

  /**
   * Cancel / no-op release: restore everything to its pre-drag state. Rigid
   * transforms snap back to the captured pose; hidden originals re-appear; the
   * resize preview object is removed and disposed. No command runs.
   */
  reset(): void {
    for (const t of this.transforms) {
      t.obj.position.copy(t.position);
      t.obj.quaternion.copy(t.quaternion);
    }
    for (const o of this.hidden) o.visible = true;
    if (this.previewObject) {
      this.parent?.remove(this.previewObject);
      disposeObject(this.previewObject);
    }
    // ADR-401 — un-hide the dependents and drop their swapped-in preview meshes.
    for (const o of this.dependentHidden) o.visible = true;
    for (const o of this.dependentObjects) {
      this.parent?.remove(o);
      disposeObject(o);
    }
    // ADR-408 Φ7 P2 — un-hide the circuit conduits and drop their re-routed meshes.
    for (const o of this.wireHidden) o.visible = true;
    for (const o of this.wireObjects) {
      this.parent?.remove(o);
      disposeObject(o);
    }
    // ADR-408 Φ-C — un-hide the connected pipes and drop their stretched preview meshes.
    for (const o of this.pipeHidden) o.visible = true;
    for (const o of this.pipeObjects) {
      this.parent?.remove(o);
      disposeObject(o);
    }
    this.clearState();
  }

  private clearState(): void {
    this.transforms = [];
    this.hidden = [];
    this.previewObject = null;
    this.parent = null;
    this.dependentHidden = [];
    this.dependentObjects = [];
    this.depWallIds = [];
    this.depHostIds = new Set();
    this.wireHidden = [];
    this.wireObjects = [];
    this.wireSystemIds = [];
    this.pipeHidden = [];
    this.pipeObjects = [];
    this.pipeSegmentIds = [];
  }
}

/** Recursively dispose a temporary preview object's geometries (materials are shared SSoT). */
function disposeObject(obj: THREE.Object3D): void {
  obj.traverse((o) => {
    if (o instanceof THREE.Mesh) o.geometry.dispose();
  });
}
