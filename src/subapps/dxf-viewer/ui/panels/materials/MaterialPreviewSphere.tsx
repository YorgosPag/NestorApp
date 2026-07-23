'use client';

/**
 * MaterialPreviewSphere — React shell for the Material Editor «Εμφάνιση» live 3D
 * sphere preview (ADR-687 Φ1). Owns only the React lifecycle: mount/dispose the
 * self-contained mini-THREE renderer, a ResizeObserver, and a `def`→renderer effect
 * (live re-render on colour/gloss/metalness change). The WebGL work lives in the
 * renderer SSoT, OUTSIDE the ADR-040 high-frequency canvas path.
 *
 * Mirrors `BandStackPreviewPanel`'s mount/dispose/resize pattern (the wall/slab
 * «Edit Type» preview shell), for a single sphere instead of a band stack.
 *
 * @see ../../../bim-3d/preview/material-preview-sphere-renderer.ts — the renderer SSoT
 */

import React, { useEffect, useRef } from 'react';
import type { PbrMaterialDef } from '../../../bim/materials/material-catalog-defs';
import { MaterialPreviewSphereRenderer } from '../../../bim-3d/preview/material-preview-sphere-renderer';

export interface MaterialPreviewSphereProps {
  /** Flat PBR def to preview. Memoise upstream so unrelated re-renders don't rebuild. */
  readonly def: PbrMaterialDef;
  readonly ariaLabel: string;
  readonly className?: string;
}

export function MaterialPreviewSphere({
  def,
  ariaLabel,
  className,
}: MaterialPreviewSphereProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<MaterialPreviewSphereRenderer | null>(null);

  // Mount the renderer once; dispose (free WebGL context) on unmount.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const renderer = new MaterialPreviewSphereRenderer(container);
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

  // Live material swap on colour/gloss/metalness change.
  useEffect(() => {
    rendererRef.current?.setDef(def);
  }, [def]);

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={ariaLabel}
      className={className ?? 'h-32 w-full overflow-hidden rounded border border-border bg-[hsl(var(--bg-canvas,0_0%_10%))]'}
    />
  );
}
