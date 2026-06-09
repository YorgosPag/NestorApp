'use client';

/**
 * ADR-435 Slice 1b — ClashMarkerLayer: the SHARED imperative positioning layer for
 * clash markers, used by BOTH the 2D and the 3D overlay. It renders one
 * {@link ClashMarkerGlyph} per clash ONCE (React), then positions them
 * **imperatively** (via refs + CSS `translate`) whenever the caller's `subscribe`
 * fires — never re-rendering on pan/zoom/orbit. That keeps the markers **zero-lag**
 * (the same reason the canvases bypass React for high-frequency transforms, ADR-040)
 * while the glyph + the layer mechanics stay a single source of truth across views.
 *
 * Only the projection differs between views and is injected:
 *   - 2D: world → screen via the immediate 2D transform.
 *   - 3D: world → screen via the camera (CSS2D-style projection).
 *
 * @see ./ClashMarkerGlyph.tsx
 * @see ../canvas-layer-stack-clash-overlay.tsx (2D caller)
 * @see ../../../bim-3d/coordination/ClashMarkers3DOverlay.tsx (3D caller)
 */

import React, { useEffect, useRef } from 'react';
import { ClashMarkerGlyph, CLASH_MARKER_HALF, type ClashMarkerGlyphProps } from './ClashMarkerGlyph';

export interface ClashMarkerLayerProps {
  /** Per-marker glyph props (severity + soft), stable per report. */
  readonly markers: readonly ClashMarkerGlyphProps[];
  /** Project marker `index` → client-space centre `{x, y}` (px), or `null` to hide it. */
  readonly project: (index: number) => { x: number; y: number } | null;
  /** Register a reproject callback (pan/zoom/orbit driver); return an unsubscribe fn. */
  readonly subscribe: (reproject: () => void) => () => void;
  /** Extra classes on the fixed container (e.g. z-index). */
  readonly className?: string;
}

export function ClashMarkerLayer(props: ClashMarkerLayerProps): React.ReactElement {
  const { markers, project, subscribe, className = '' } = props;
  const refs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const reproject = (): void => {
      for (let i = 0; i < markers.length; i++) {
        const el = refs.current[i];
        if (!el) continue;
        const p = project(i);
        if (p) {
          el.style.transform = `translate(${p.x - CLASH_MARKER_HALF}px, ${p.y - CLASH_MARKER_HALF}px)`;
          el.style.display = '';
        } else {
          el.style.display = 'none';
        }
      }
    };
    reproject();
    return subscribe(reproject);
  }, [markers, project, subscribe]);

  return (
    <div className={`pointer-events-none fixed inset-0 ${className}`} aria-hidden="true">
      {markers.map((m, i) => (
        <div
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          className="absolute left-0 top-0 will-change-transform"
        >
          <ClashMarkerGlyph severity={m.severity} soft={m.soft} />
        </div>
      ))}
    </div>
  );
}
