/**
 * ADR-366 §C.6.Q4 — Crop Region Tool FSM.
 *
 * Pointer + keyboard event handler for the crop rectangle marquee tool.
 * Reads canvas bounding rect to convert DOM coords to normalized [0,1].
 * Delegates all state mutations to CropRegionStore.
 *
 * Lifecycle (managed by SectionSceneController / BimViewport3D):
 *  - `activate(canvas)` → attach pointer/keyboard listeners
 *  - `deactivate()`     → detach listeners, leave committed state intact
 *
 * FSM transitions (mirrors CropRegionStore.editState):
 *  idle      → pointerdown                  → dragging
 *  dragging  → pointerup                    → editing
 *  editing   → handle pointerdown+pointermove+up → editing
 *  editing   → Enter                        → committed
 *  dragging/editing → Escape                → idle
 */

import * as THREE from 'three';
import { useCropRegionStore, type HandleId } from './CropRegionStore';
import { buildCropPlanes } from './crop-frustum-builder';
import { escapeBus } from '@/subapps/dxf-viewer/systems/escape-bus/EscapeCommandBus';
import { ESC_PRIORITY } from '@/subapps/dxf-viewer/systems/escape-bus/escape-priority';

interface CropRegionToolDeps {
  readonly getCamera: () => THREE.Camera;
  readonly onCommit: (planes: THREE.Plane[]) => void;
}

export class CropRegionTool {
  private readonly deps: CropRegionToolDeps;
  private canvas: HTMLElement | null = null;
  private active = false;
  private escapeUnregister: (() => void) | null = null;

  private readonly onPointerDown: (e: PointerEvent) => void;
  private readonly onPointerMove: (e: PointerEvent) => void;
  private readonly onPointerUp: (e: PointerEvent) => void;
  private readonly onKeyDown: (e: KeyboardEvent) => void;

  constructor(deps: CropRegionToolDeps) {
    this.deps = deps;
    this.onPointerDown = (e) => this.handlePointerDown(e);
    this.onPointerMove = (e) => this.handlePointerMove(e);
    this.onPointerUp = (e) => this.handlePointerUp(e);
    this.onKeyDown = (e) => this.handleKeyDown(e);
  }

  activate(canvas: HTMLElement): void {
    if (this.active) return;
    this.canvas = canvas;
    this.active = true;
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('keydown', this.onKeyDown);
    this.escapeUnregister = escapeBus.register({
      id: 'bim-3d/crop-region',
      priority: ESC_PRIORITY.CROP_TOOL,
      canHandle: () => {
        const s = useCropRegionStore.getState();
        return s.editState === 'dragging' || s.editState === 'editing';
      },
      handle: () => {
        useCropRegionStore.getState().cancelEdit();
        return true;
      },
    });
  }

  deactivate(): void {
    if (!this.active || !this.canvas) return;
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('keydown', this.onKeyDown);
    this.escapeUnregister?.();
    this.escapeUnregister = null;
    this.active = false;
    this.canvas = null;
  }

  private toNorm(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas!.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top) / rect.height,
    };
  }

  private handlePointerDown(e: PointerEvent): void {
    const state = useCropRegionStore.getState();
    if (state.editState === 'idle') {
      const { x, y } = this.toNorm(e.clientX, e.clientY);
      state.startDrag(x, y);
      this.canvas!.setPointerCapture(e.pointerId);
      e.stopImmediatePropagation();
    }
  }

  private handlePointerMove(e: PointerEvent): void {
    const state = useCropRegionStore.getState();
    if (state.editState === 'dragging') {
      const { x, y } = this.toNorm(e.clientX, e.clientY);
      state.updateDrag(x, y);
      e.stopImmediatePropagation();
    } else if (state.editState === 'editing' && state.selectedHandle) {
      const { x, y } = this.toNorm(e.clientX, e.clientY);
      state.updateHandleDrag(x, y);
      e.stopImmediatePropagation();
    }
  }

  private handlePointerUp(e: PointerEvent): void {
    const state = useCropRegionStore.getState();
    if (state.editState === 'dragging') {
      state.commitDrag();
      try { this.canvas!.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      e.stopImmediatePropagation();
    } else if (state.editState === 'editing' && state.selectedHandle) {
      useCropRegionStore.setState({ selectedHandle: null });
    }
  }

  private handleKeyDown(e: KeyboardEvent): void {
    const state = useCropRegionStore.getState();
    if (e.key === 'Enter') {
      if (state.editState === 'editing' && state.rectangle) {
        const camera = this.deps.getCamera();
        const depthRange = state.depthRangeEnabled
          ? { near: state.nearNorm, far: state.farNorm }
          : undefined;
        const planes = buildCropPlanes(state.rectangle, camera, depthRange);
        state.commitEdit();
        this.deps.onCommit(planes);
        e.preventDefault();
      }
    }
  }
}

/** Mounts handle drag from the overlay component. */
export function startHandleDrag(handle: HandleId): void {
  useCropRegionStore.getState().startHandleDrag(handle);
}
