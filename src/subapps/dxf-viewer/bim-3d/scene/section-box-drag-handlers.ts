/**
 * SectionBoxDragHandlers — capture-phase pointer handlers for dragging the
 * Section Box handles. Extracted from SectionSceneController (N.7.1, 500-line
 * cap) as a pure factory so the controller stays focused on clip-plane state.
 *
 * Pure ownership of the box drag gesture only — the controller wires these onto
 * the renderer DOM in capture phase and removes them on dispose.
 */

import type * as THREE from 'three';
import { useSectionStore } from '../stores/SectionStore';
import type { SectionBox } from '../systems/section/SectionBox';

export interface SectionBoxDragDeps {
  readonly sectionBox: SectionBox;
  readonly dom: HTMLCanvasElement;
  readonly getCamera: () => THREE.Camera;
}

export interface SectionBoxDragHandlers {
  readonly onPointerDown: (e: PointerEvent) => void;
  readonly onPointerMove: (e: PointerEvent) => void;
  readonly onPointerUp: (e: PointerEvent) => void;
}

export function createSectionBoxDragHandlers(deps: SectionBoxDragDeps): SectionBoxDragHandlers {
  const { sectionBox, dom, getCamera } = deps;

  const onPointerDown = (e: PointerEvent): void => {
    const { enabled, mode } = useSectionStore.getState();
    if (!enabled || mode !== 'box') return;
    const claimed = sectionBox.handlePointerDown(e.clientX, e.clientY, getCamera(), dom);
    if (!claimed) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    dom.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent): void => {
    const { enabled, mode } = useSectionStore.getState();
    if (!enabled || mode !== 'box') return;
    const wasDragging = sectionBox.isDragging();
    sectionBox.handlePointerMove(e.clientX, e.clientY, getCamera(), dom, e.shiftKey, {
      onAxisDrag: (axis, side, value) => {
        useSectionStore.getState().setBoxBoundsAxis(axis, side, value);
      },
    });
    if (wasDragging || sectionBox.isDragging()) e.stopImmediatePropagation();
  };

  const onPointerUp = (e: PointerEvent): void => {
    if (!sectionBox.isDragging()) return;
    sectionBox.handlePointerUp();
    try { dom.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    e.stopImmediatePropagation();
  };

  return { onPointerDown, onPointerMove, onPointerUp };
}
