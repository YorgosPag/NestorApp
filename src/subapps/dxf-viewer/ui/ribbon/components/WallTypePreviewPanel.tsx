'use client';

/**
 * WallTypePreviewPanel (ADR-414) — left-hand live 3D preview for the «Edit Wall
 * Type» dialog. Renders the draft `WallDna` as a synthetic wall stub with one
 * textured band per layer (real PBR textures via the shared texture-aware
 * material catalog), updating as the layers are edited on the right.
 *
 * Bidirectional highlight:
 *   - right → left: `highlightLayerId` (driven by row hover/focus) outlines the
 *     matching band.
 *   - left → right: hovering/clicking a band calls `onHighlightLayer(layerId)`,
 *     which lights the corresponding editor row.
 *
 * The heavy lifting lives in `WallTypePreviewRenderer` (a standalone mini THREE
 * scene, OUTSIDE the ADR-040 high-frequency canvas path). This component only
 * owns the React lifecycle: mount/dispose, prop→renderer effects, a texture-
 * version subscription (async load → re-apply materials), and pointer→pick.
 *
 * @see WallTypePreviewRenderer.ts — the mini renderer
 * @see ../../wall-advanced-panel/sections/WallDnaEditor.tsx — the editor (rows)
 */

import React, { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { WallDna } from '../../../bim/types/wall-dna-types';
import { useBim3DEntitiesStore } from '../../../bim-3d/stores/Bim3DEntitiesStore';
import { WallTypePreviewRenderer } from '../../../bim-3d/preview/WallTypePreviewRenderer';

export interface WallTypePreviewPanelProps {
  readonly dna: WallDna | undefined;
  readonly highlightLayerId: string | null;
  readonly onHighlightLayer: (layerId: string | null) => void;
}

export function WallTypePreviewPanel({
  dna,
  highlightLayerId,
  onHighlightLayer,
}: WallTypePreviewPanelProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<WallTypePreviewRenderer | null>(null);
  const lastPickedRef = useRef<string | null>(null);
  const textureVersion = useBim3DEntitiesStore((s) => s.textureAssetVersion);

  // Mount the renderer once; dispose (free WebGL context) on unmount.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const renderer = new WallTypePreviewRenderer(container);
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
      aria-label={t('ribbon.commands.bimFamilyType.preview.title')}
      className="flex min-h-[34rem] flex-col gap-1"
    >
      <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground">
        {t('ribbon.commands.bimFamilyType.preview.title')}
      </h4>
      <div
        ref={containerRef}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        className="relative flex-1 overflow-hidden rounded border border-border bg-[hsl(var(--bg-canvas,0_0%_10%))]"
      >
        {!dna && (
          <p className="absolute inset-0 flex items-center justify-center p-4 text-center text-xs text-muted-foreground">
            {t('ribbon.commands.bimFamilyType.preview.emptyHint')}
          </p>
        )}
      </div>
    </section>
  );
}
