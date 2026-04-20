'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import { Loader2, FileWarning } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useFloorplanSceneLoader } from '@/components/shared/files/media/useFloorplanSceneLoader';
import { renderDxfToCanvas } from '@/components/shared/files/media/floorplan-dxf-renderer';
import type { FileRecord } from '@/types/file-record';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 10;
const WHEEL_FACTOR = 1.15;

interface DxfPreviewProps {
  url: string;
  fileName: string;
  title: string;
}

export function DxfPreview({ url, fileName, title }: DxfPreviewProps) {
  const { t } = useTranslation(['files', 'files-media']);
  const colors = useSemanticColors();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });

  // Drag-to-pan state
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const panAtDragStartRef = useRef({ x: 0, y: 0 });

  // Build minimal FileRecord for the SSoT loader (PATH D: client-side parse)
  const minimalRecord: FileRecord = {
    id: '',
    companyId: '',
    displayName: fileName,
    originalFilename: fileName,
    contentType: 'image/vnd.dxf',
    sizeBytes: 0,
    storageProvider: 'firebase',
    storagePath: '',
    downloadUrl: url,
    status: 'ready',
    createdAt: '',
    updatedAt: '',
    uploadedBy: '',
  } as unknown as FileRecord;

  const { loadedScene, isLoading, sceneError } = useFloorplanSceneLoader(
    minimalRecord,
    true,
    'dxf',
  );

  const redraw = useCallback(() => {
    if (!loadedScene || !canvasRef.current) return;
    renderDxfToCanvas(canvasRef.current, loadedScene, zoomRef.current, panRef.current, 'light');
  }, [loadedScene]);

  // Initial render
  useEffect(() => {
    redraw();
  }, [redraw]);

  // Wheel zoom — cursor-centered (point under cursor stays fixed)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !loadedScene) return;

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      if (!canvas) return;

      const factor = e.deltaY < 0 ? WHEEL_FACTOR : 1 / WHEEL_FACTOR;
      const oldZoom = zoomRef.current;
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, oldZoom * factor));

      // Cursor position relative to canvas element
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const W = rect.width;
      const H = rect.height;

      // Keep the drawing point under the cursor fixed after zoom.
      // renderDxfToCanvas centers the drawing then adds panOffset,
      // so the transform origin is (W/2, H/2).
      const ratio = newZoom / oldZoom;
      panRef.current = {
        x: (mx - W / 2) * (1 - ratio) + panRef.current.x * ratio,
        y: (my - H / 2) * (1 - ratio) + panRef.current.y * ratio,
      };
      zoomRef.current = newZoom;

      renderDxfToCanvas(canvas, loadedScene!, newZoom, panRef.current, 'light');
    }

    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [loadedScene]);

  // Drag-to-pan
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !loadedScene) return;

    function onMouseDown(e: MouseEvent) {
      isDraggingRef.current = true;
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      panAtDragStartRef.current = { ...panRef.current };
      canvas!.style.cursor = 'grabbing';
    }

    function onMouseMove(e: MouseEvent) {
      if (!isDraggingRef.current || !canvas) return;
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      panRef.current = {
        x: panAtDragStartRef.current.x + dx,
        y: panAtDragStartRef.current.y + dy,
      };
      renderDxfToCanvas(canvas, loadedScene!, zoomRef.current, panRef.current, 'light');
    }

    function onMouseUp() {
      isDraggingRef.current = false;
      if (canvas) canvas.style.cursor = 'grab';
    }

    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    canvas.style.cursor = 'grab';

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [loadedScene]);

  if (sceneError) {
    return (
      <section className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
        <FileWarning className="h-8 w-8 text-destructive" aria-hidden="true" />
        <p className={cn('text-sm font-medium', colors.text.muted)}>
          {t('preview.dxfError')}
        </p>
      </section>
    );
  }

  if (isLoading || !loadedScene) {
    return (
      <section className="flex-1 flex flex-col items-center justify-center gap-3 p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden="true" />
        <p className={cn('text-sm', colors.text.muted)}>{t('preview.dxfLoading')}</p>
      </section>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white" aria-label={title}>
      <canvas ref={canvasRef} className="flex-1 w-full h-full" />
    </div>
  );
}
