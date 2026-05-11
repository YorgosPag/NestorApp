'use client';

/**
 * ADR-345 §5.1 — HTML5 drag & drop for tab reorder.
 * Keeps drag/drop state local; commits new order via setTabOrder.
 */

import { useCallback, useState } from 'react';

export interface TabDragHandlers {
  draggingId: string | null;
  dropTargetId: string | null;
  onDragStart: (id: string) => (e: React.DragEvent<HTMLElement>) => void;
  onDragOver: (id: string) => (e: React.DragEvent<HTMLElement>) => void;
  onDragLeave: () => void;
  onDrop: (id: string) => (e: React.DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
}

const DRAG_MIME = 'application/x-dxf-ribbon-tab-id';

export function useRibbonTabDrag(
  tabOrder: string[],
  setTabOrder: (order: string[]) => void,
): TabDragHandlers {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const onDragStart = useCallback(
    (id: string) => (e: React.DragEvent<HTMLElement>) => {
      setDraggingId(id);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData(DRAG_MIME, id);
    },
    [],
  );

  const onDragOver = useCallback(
    (id: string) => (e: React.DragEvent<HTMLElement>) => {
      if (!draggingId || draggingId === id) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDropTargetId(id);
    },
    [draggingId],
  );

  const onDragLeave = useCallback(() => {
    setDropTargetId(null);
  }, []);

  const onDrop = useCallback(
    (targetId: string) => (e: React.DragEvent<HTMLElement>) => {
      e.preventDefault();
      const sourceId =
        e.dataTransfer.getData(DRAG_MIME) || draggingId || '';
      setDraggingId(null);
      setDropTargetId(null);
      if (!sourceId || sourceId === targetId) return;
      const next = tabOrder.filter((id) => id !== sourceId);
      const targetIdx = next.indexOf(targetId);
      if (targetIdx === -1) {
        next.push(sourceId);
      } else {
        next.splice(targetIdx, 0, sourceId);
      }
      setTabOrder(next);
    },
    [draggingId, tabOrder, setTabOrder],
  );

  const onDragEnd = useCallback(() => {
    setDraggingId(null);
    setDropTargetId(null);
  }, []);

  return {
    draggingId,
    dropTargetId,
    onDragStart,
    onDragOver,
    onDragLeave,
    onDrop,
    onDragEnd,
  };
}
