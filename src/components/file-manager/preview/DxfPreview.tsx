'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { Loader2, FileWarning, FileQuestion } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  useFloorplanSceneLoader,
  type FloorplanSceneSource,
} from '@/components/shared/files/media/useFloorplanSceneLoader';
import { renderDxfToCanvas } from '@/components/shared/files/media/floorplan-dxf-renderer';
import type { FileRecord } from '@/types/file-record';
import { useZoomPan } from '@/hooks/useZoomPan';

/** Όρια zoom του DXF preview — ο τροχός/σύρση από το ΕΝΑ `useZoomPan` (ADR-899 §9 θέμα 3· πριν, χειρόγραφο αντίγραφο). */
const DXF_PREVIEW_ZOOM = { minZoom: 0.1, maxZoom: 10 } as const;

interface DxfPreviewProps {
  /** Το URL των bytes — η πηγή **μόνο** όταν δεν υπάρχει εγγραφή (σελίδα κοινοποίησης, υπογεγραμμένο URL). */
  url: string;
  fileName: string;
  title: string;
  /**
   * Η **πραγματική** εγγραφή, όταν ο οικοδεσπότης την έχει (ADR-899 §9 θέμα 8). Τότε η σκηνή ζητείται από τον ίδιο
   * δρόμο με το `FloorplanGallery` (`processedData` ⇒ scene API). 🔴 Πριν, εδώ χτιζόταν «ελάχιστη εγγραφή» με
   * διπλό cast σε `FileRecord` ⇒ το `downloadUrl` των εγγραφών CAD (`.scene.json`) διαβαζόταν ως DXF ⇒ λευκό.
   */
  record?: FileRecord | null;
}

export function DxfPreview({ url, fileName, title, record }: DxfPreviewProps) {
  const { t } = useTranslation(['files', 'files-media']);
  const colors = useSemanticColors();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // `contentKey` — άλλο σχέδιο ⇒ ουδέτερη όψη (ADR-899 §9 θέμα 7· το πάνελ κρατά το component ζωντανό ανάμεσα σε αρχεία).
  const zp = useZoomPan({ ...DXF_PREVIEW_ZOOM, contentKey: record?.id ?? url });

  const source = useMemo<FloorplanSceneSource>(
    () => record ?? { kind: 'bytes', url, fileName },
    [record, url, fileName],
  );
  const { loadedScene, isLoading, sceneError, isEmpty } = useFloorplanSceneLoader(source, true, 'dxf');

  // Ο καμβάς ξανασχεδιάζεται σε κάθε αλλαγή όψης — όπως το `FloorplanGallery` (renderDxfToCanvas: κέντρο + panOffset).
  const { zoom, panOffset } = zp;
  useEffect(() => {
    if (!loadedScene || isEmpty || !canvasRef.current) return;
    renderDxfToCanvas(canvasRef.current, loadedScene, zoom, panOffset, 'light');
  }, [loadedScene, isEmpty, zoom, panOffset]);

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

  // Σκηνή με 0 οντότητες: ρητή κατάσταση, ποτέ άδειος καμβάς που μοιάζει με σφάλμα (ADR-899 §9 θέμα 8).
  if (isEmpty) {
    return (
      <section className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
        <FileQuestion className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        <p className={cn('text-sm font-medium', colors.text.muted)}>{t('preview.dxfEmpty')}</p>
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
