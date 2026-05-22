/**
 * ADR-366 §C.6.Q4 — React hook για CropRegionTool lifecycle.
 *
 * Instantiates the tool once, activates/deactivates it based on editState,
 * and returns the toggle callback for use3DShortcuts.
 */

import { useEffect, useRef, useCallback } from 'react';
import type { MutableRefObject } from 'react';
import { CropRegionTool } from './CropRegionTool';
import { useCropRegionStore } from './CropRegionStore';
import type { ThreeJsSceneManager } from '../../scene/ThreeJsSceneManager';

interface UseCropRegionToolConfig {
  managerRef: MutableRefObject<ThreeJsSceneManager | null>;
  active: boolean;
}

/**
 * Manages CropRegionTool lifecycle. Returns the keyboard-shortcut toggle callback.
 * Tool is deactivated + store reset when `active` becomes false (viewport hides).
 */
export function useCropRegionTool({ managerRef, active }: UseCropRegionToolConfig): () => void {
  const toolRef = useRef<CropRegionTool | null>(null);

  useEffect(() => {
    toolRef.current = new CropRegionTool({
      // Called lazily (Enter key in editing state) — manager is guaranteed alive.
      getCamera: () => managerRef.current!.getCamera(),
      // SectionSceneController reacts to editState==='committed' via store subscription.
      onCommit: () => undefined,
    });
    return () => {
      toolRef.current?.deactivate();
      toolRef.current = null;
      useCropRegionStore.getState().reset();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!active) {
      toolRef.current?.deactivate();
      useCropRegionStore.getState().reset();
    }
  }, [active]);

  return useCallback(() => {
    const store = useCropRegionStore.getState();
    if (store.editState !== 'idle') {
      store.cancelEdit();
      toolRef.current?.deactivate();
      return;
    }
    const canvas = managerRef.current?.getRendererCanvas() ?? null;
    if (canvas) toolRef.current?.activate(canvas);
  }, [managerRef]);
}
