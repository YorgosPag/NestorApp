'use client';

import { useEffect, useRef } from 'react';
import type { Level } from '../config';
import { FloorFloorplanService } from '@/services/floorplans/FloorFloorplanService';
import { usePdfBackgroundStore } from '../../../pdf-background/stores/pdfBackgroundStore';

interface UseLevelPdfLoaderParams {
  currentLevelId: string | null;
  levels: Level[];
  companyId: string | null;
}

/**
 * Loads a PDF/image floorplan into the PDF background canvas when switching to
 * a floor-linked level.
 *
 * Resolution by fileType (FloorFloorplanService.loadFloorplan):
 * - pdf/image → loadFromUrl into pdfBackgroundStore
 * - dxf      → disable PDF background (DXF render takes over)
 * - none     → disable PDF background
 *
 * Note: level.sceneFileId may point to a PDF file too, so we cannot use it
 * as a "this is DXF" signal. fileType is the source of truth.
 *
 * Race-condition safe: cancels pending loads on rapid level switches.
 */
export function useLevelPdfLoader({
  currentLevelId,
  levels,
  companyId,
}: UseLevelPdfLoaderParams): void {
  const loadFromUrl = usePdfBackgroundStore(s => s.loadFromUrl);
  const loadPdf = usePdfBackgroundStore(s => s.loadPdf);
  const setEnabled = usePdfBackgroundStore(s => s.setEnabled);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!currentLevelId || !companyId) return;

    const level = levels.find(l => l.id === currentLevelId);
    const floorId = level?.floorId;

    if (!floorId) {
      setEnabled(false);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const load = async () => {
      const floorplan = await FloorFloorplanService.loadFloorplan({ companyId, floorId });

      if (controller.signal.aborted) return;

      if (!floorplan || floorplan.fileType === 'dxf') {
        setEnabled(false);
        return;
      }

      if (!floorplan.pdfImageUrl) return;

      if (floorplan.fileType === 'image') {
        loadFromUrl(floorplan.pdfImageUrl);
        return;
      }

      if (floorplan.fileType === 'pdf') {
        const response = await fetch(floorplan.pdfImageUrl, { signal: controller.signal });
        if (!response.ok) return;
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        const file = new File([blob], floorplan.fileName || 'floorplan.pdf', { type: 'application/pdf' });
        await loadPdf(file);
        if (controller.signal.aborted) return;
        setEnabled(true);
      }
    };

    load().catch((err) => {
      if (err instanceof Error && err.name === 'AbortError') return;
      // eslint-disable-next-line no-console
      console.error('[useLevelPdfLoader]', err);
    });

    return () => { controller.abort(); };
  }, [currentLevelId, levels, companyId, loadFromUrl, loadPdf, setEnabled]);
}
