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
 * a floor-linked level that has no DXF scene (i.e. the floorplan is PDF/image).
 *
 * - Level has floorId + no sceneFileId → query FloorFloorplanService
 * - fileType pdf/image → loadFromUrl into pdfBackgroundStore
 * - Level has sceneFileId (DXF) or no floorId → disable PDF background
 *
 * Race-condition safe: cancels pending loads on rapid level switches.
 */
export function useLevelPdfLoader({
  currentLevelId,
  levels,
  companyId,
}: UseLevelPdfLoaderParams): void {
  const loadFromUrl = usePdfBackgroundStore(s => s.loadFromUrl);
  const setEnabled = usePdfBackgroundStore(s => s.setEnabled);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!currentLevelId || !companyId) return;

    const level = levels.find(l => l.id === currentLevelId);
    const floorId = level?.floorId;

    if (!floorId || level?.sceneFileId) {
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

      if ((floorplan.fileType === 'pdf' || floorplan.fileType === 'image') && floorplan.pdfImageUrl) {
        loadFromUrl(floorplan.pdfImageUrl);
      }
    };

    load();

    return () => { controller.abort(); };
  }, [currentLevelId, levels, companyId, loadFromUrl, setEnabled]);
}
