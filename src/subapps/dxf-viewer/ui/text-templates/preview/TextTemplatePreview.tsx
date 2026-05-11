/**
 * ADR-344 Phase 7.D — Mini WYSIWYG preview pane.
 *
 * Renders the selected `TextTemplate` with placeholders substituted from
 * the sample `PlaceholderScope`. The output uses the same TextRunStyle
 * attributes that the full DxfRenderer applies, so the user sees actual
 * fonts / bold / italic / colours — not a monospace approximation (Q1 → β).
 *
 * Re-renders on:
 *   - template change
 *   - scope change (locale switch)
 *   - canvas resize (ResizeObserver)
 *
 * Headless: no buttons or controls. Manager / Editor wrap it with their
 * own chrome.
 */
'use client';

import React, { useEffect, useRef } from 'react';
import {
  resolveTemplate,
  type PlaceholderScope,
  type TextTemplate,
} from '@/subapps/dxf-viewer/text-engine/templates';
import { drawTextNodePreview } from './canvas-text-renderer';

interface TextTemplatePreviewProps {
  readonly template: TextTemplate | null;
  readonly scope: PlaceholderScope;
  readonly emptyLabel?: string;
  readonly className?: string;
}

export const TextTemplatePreview: React.FC<TextTemplatePreviewProps> = ({
  template,
  scope,
  emptyLabel,
  className,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
      const cssW = wrapper.clientWidth;
      const cssH = wrapper.clientHeight;
      if (cssW <= 0 || cssH <= 0) return;
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);
      if (!template) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, cssW, cssH);
        return;
      }
      const resolved = resolveTemplate(template, scope);
      drawTextNodePreview(ctx, resolved, {
        canvasWidth: cssW,
        canvasHeight: cssH,
        background: '#ffffff',
      });
    };

    render();
    const ro = new ResizeObserver(render);
    ro.observe(wrapper);
    return () => ro.disconnect();
  }, [template, scope]);

  return (
    <section
      ref={wrapperRef}
      className={className ?? 'tt-preview-wrapper'}
      aria-label="text-template-preview"
    >
      <canvas ref={canvasRef} className="tt-preview-canvas" />
      {!template && emptyLabel ? (
        <p className="tt-preview-empty">{emptyLabel}</p>
      ) : null}
    </section>
  );
};
