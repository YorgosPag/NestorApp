'use client';

/**
 * SlabTypePreviewPanel (ADR-412/ADR-414) — live 3D preview for the «Edit Slab
 * Type» dialog. Renders the draft `SlabDna` as a synthetic slab stub with one
 * textured band per layer (real PBR textures), updating as the layers are edited.
 * Slab analogue of `WallTypePreviewPanel`.
 *
 * Bidirectional highlight: `highlightLayerId` (row hover) outlines the band; band
 * hover calls `onHighlightLayer` to light the editor row.
 *
 * The heavy lifting lives in `SlabTypePreviewRenderer` (standalone mini THREE
 * scene, OUTSIDE the ADR-040 high-frequency canvas path).
 *
 * @see SlabTypePreviewRenderer.ts — the mini renderer
 */

import React, { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { SlabDna } from '../../../bim/types/slab-dna-types';
import { useBim3DEntitiesStore } from '../../../bim-3d/stores/Bim3DEntitiesStore';
import { SlabTypePreviewRenderer } from '../../../bim-3d/preview/SlabTypePreviewRenderer';

export interface SlabTypePreviewPanelProps {
  readonly dna: SlabDna | undefined;
  readonly highlightLayerId: string | null;
  readonly onHighlightLayer: (layerId: string | null) => void;
}

export function SlabTypePreviewPanel({
  dna,
  highlightLayerId,
  onHighlightLayer,
}: SlabTypePreviewPanelProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<SlabTypePreviewRenderer | null>(null);
  const lastPickedRef = useRef<string | null>(null);
  const textureVersion = useBim3DEntitiesStore((s) => s.textureAssetVersion);

  // Mount the renderer once; dispose (free WebGL context) on unmount.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const renderer = new SlabTypePreviewRenderer(container);
    rendererRef.current = renderer;
    const observer = new ResizeObserver(() => {
      renderer.resize(container.clientWidth, container.clientHeight);
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
      renderer.dispose();
      rendererRef.current = null;
    };
  }, []);

  // Live composition + texture-load swap.
  useEffect(() => {
    rendererRef.current?.setDna(dna);
  }, [dna]);
  useEffect(() => {
    rendererRef.current?.applyTextures();
  }, [textureVersion]);

  // Right → left highlight.
  useEffect(() => {
    rendererRef.current?.setHighlight(highlightLayerId);
  }, [highlightLayerId]);

  const toNdc = useCallback((e: React.PointerEvent<HTMLDivElement>): [number, number] => {
    const rect = e.currentTarget.getBoundingClientRect();
    return [
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    ];
  }, []);

  // Left → right highlight (hover the band → light the row), de-duplicated.
  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>): void => {
      const renderer = rendererRef.current;
      if (!renderer) return;
      const [x, y] = toNdc(e);
      const picked = renderer.pickLayerAt(x, y);
      if (picked !== lastPickedRef.current) {
        lastPickedRef.current = picked;
        onHighlightLayer(picked);
      }
    },
    [toNdc, onHighlightLayer],
  );

  const onPointerLeave = useCallback((): void => {
    if (lastPickedRef.current !== null) {
      lastPickedRef.current = null;
      onHighlightLayer(null);
    }
  }, [onHighlightLayer]);

  return (
    <section
      aria-label={t('ribbon.commands.slabFamilyType.preview.title')}
      className="flex min-h-[34rem] flex-col gap-1"
    >
      <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground">
        {t('ribbon.commands.slabFamilyType.preview.title')}
      </h4>
      <div
        ref={containerRef}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        className="relative flex-1 overflow-hidden rounded border border-border bg-[hsl(var(--bg-canvas,0_0%_10%))]"
      >
        {!dna && (
          <p className="absolute inset-0 flex items-center justify-center p-4 text-center text-xs text-muted-foreground">
            {t('ribbon.commands.slabFamilyType.preview.emptyHint')}
          </p>
        )}
      </div>
    </section>
  );
}
