'use client';

import React, { useEffect, useRef } from 'react';
import { Loader2, FileWarning } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useFloorplanSceneLoader } from '@/components/shared/files/media/useFloorplanSceneLoader';
import { renderDxfToCanvas } from '@/components/shared/files/media/floorplan-dxf-renderer';
import type { FileRecord } from '@/types/file-record';
import { useZoomPan } from '@/hooks/useZoomPan';

/** Όρια zoom του DXF preview — ο τροχός/σύρση από το ΕΝΑ `useZoomPan` (ADR-899 §9 θέμα 3· πριν, χειρόγραφο αντίγραφο). */
const DXF_PREVIEW_ZOOM = { minZoom: 0.1, maxZoom: 10 } as const;

interface DxfPreviewProps {
  url: string;
  fileName: string;
  title: string;
}

export function DxfPreview({ url, fileName, title }: DxfPreviewProps) {
  const { t } = useTranslation(['files', 'files-media']);
  const colors = useSemanticColors();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // `contentKey: url` — άλλο σχέδιο ⇒ ουδέτερη όψη (ADR-899 §9 θέμα 7· το πάνελ κρατά το component ζωντανό ανάμεσα σε αρχεία).
  const zp = useZoomPan({ ...DXF_PREVIEW_ZOOM, contentKey: url });

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

  // Ο καμβάς ξανασχεδιάζεται σε κάθε αλλαγή όψης — όπως το `FloorplanGallery` (renderDxfToCanvas: κέντρο + panOffset).
  const { zoom, panOffset } = zp;
  useEffect(() => {
    if (!loadedScene || !canvasRef.current) return;
    renderDxfToCanvas(canvasRef.current, loadedScene, zoom, panOffset, 'light');
  }, [loadedScene, zoom, panOffset]);

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
    <figure ref={zp.containerRef} {...zp.handlers}
      className={cn('flex-1 flex flex-col overflow-hidden bg-white select-none', zp.cursorClass)} aria-label={title}>
      <canvas ref={canvasRef} className="flex-1 w-full h-full" />
    </figure>
  );
}
