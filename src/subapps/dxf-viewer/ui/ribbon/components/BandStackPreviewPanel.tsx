'use client';

/**
 * BandStackPreviewPanel (ADR-412/ADR-414) — SSoT React shell for every «Edit …
 * Type» dialog's live 3D preview. The wall and slab panels were twins down to the
 * markup (jscpd: 60L/370T clone); this owns the shared lifecycle and they supply
 * only their renderer + i18n keys.
 *
 * Renders the draft DNA as a synthetic stub with one textured band per layer (real
 * PBR textures via the shared texture-aware material catalog), updating as the
 * layers are edited on the right.
 *
 * Bidirectional highlight:
 *   - right → left: `highlightLayerId` (driven by row hover/focus) outlines the
 *     matching band.
 *   - left → right: hovering a band calls `onHighlightLayer(layerId)`, which
 *     lights the corresponding editor row.
 *
 * The heavy lifting lives in the renderer (a standalone mini THREE scene, OUTSIDE
 * the ADR-040 high-frequency canvas path). This component only owns the React
 * lifecycle: mount/dispose, prop→renderer effects, a texture-version subscription
 * (async load → re-apply materials), and pointer→pick.
 *
 * @see ../../../bim-3d/preview/band-stack-preview-renderer.ts — the renderer SSoT
 */

import React, { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useBim3DEntitiesStore } from '../../../bim-3d/stores/Bim3DEntitiesStore';
import type {
  BandStackPreviewHandle,
  PreviewDnaLike,
} from '../../../bim-3d/preview/band-stack-preview-renderer';

export interface BandStackPreviewPanelProps<TDna extends PreviewDnaLike> {
  readonly dna: TDna | undefined;
  readonly highlightLayerId: string | null;
  readonly onHighlightLayer: (layerId: string | null) => void;
  /** Constructs the mini renderer into the container. Must be stable per mount. */
  readonly createRenderer: (container: HTMLElement) => BandStackPreviewHandle<TDna>;
  /** i18n key (namespace `dxf-viewer-shell`) for the section heading + aria-label. */
  readonly titleKey: string;
  /** i18n key (namespace `dxf-viewer-shell`) shown while there is no DNA yet. */
  readonly emptyHintKey: string;
}

export function BandStackPreviewPanel<TDna extends PreviewDnaLike>({
  dna,
  highlightLayerId,
  onHighlightLayer,
  createRenderer,
  titleKey,
  emptyHintKey,
}: BandStackPreviewPanelProps<TDna>): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<BandStackPreviewHandle<TDna> | null>(null);
  const lastPickedRef = useRef<string | null>(null);
  const textureVersion = useBim3DEntitiesStore((s) => s.textureAssetVersion);

  // The factory is only ever read at mount — keep it in a ref so a caller passing
  // an inline arrow can never force a remount (which would drop the WebGL context).
  const createRendererRef = useRef(createRenderer);
  createRendererRef.current = createRenderer;

  // Mount the renderer once; dispose (free WebGL context) on unmount.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const renderer = createRendererRef.current(container);
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
      if (e.buttons !== 0) return; // a drag (pan/rotate) owns the pointer — don't re-pick
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
    <section aria-label={t(titleKey)} className="flex min-h-[34rem] flex-col gap-1">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground">
        {t(titleKey)}
      </h4>
      <div
        ref={containerRef}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        className="relative flex-1 overflow-hidden rounded border border-border bg-[hsl(var(--bg-canvas,0_0%_10%))]"
      >
        {!dna && (
          <p className="absolute inset-0 flex items-center justify-center p-4 text-center text-xs text-muted-foreground">
            {t(emptyHintKey)}
          </p>
        )}
      </div>
    </section>
  );
}
