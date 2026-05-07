/* eslint-disable custom/no-hardcoded-strings, design-system/enforce-semantic-colors */
'use client';

import React, { useRef, useState, useCallback } from 'react';
import { ImageProvider } from '@/subapps/dxf-viewer/floorplan-background/providers/ImageProvider';
import { DEFAULT_BACKGROUND_TRANSFORM } from '@/subapps/dxf-viewer/floorplan-background';
import type { BackgroundTransform } from '@/subapps/dxf-viewer/floorplan-background';

const CANVAS_W = 800;
const CANVAS_H = 600;

interface LoadState {
  status: 'idle' | 'loading' | 'loaded' | 'error';
  bounds: { width: number; height: number } | null;
  orientation: number;
  error: string | null;
}

export default function FloorplanBackgroundImageDemoPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const providerRef = useRef<ImageProvider | null>(null);
  const [loadState, setLoadState] = useState<LoadState>({
    status: 'idle',
    bounds: null,
    orientation: 1,
    error: null,
  });
  const [transform, setTransform] = useState<BackgroundTransform>(DEFAULT_BACKGROUND_TRANSFORM);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    await providerRef.current?.dispose();
    const provider = new ImageProvider();
    providerRef.current = provider;

    setLoadState({ status: 'loading', bounds: null, orientation: 1, error: null });
    setTransform(DEFAULT_BACKGROUND_TRANSFORM);

    const result = await provider.loadAsync({ kind: 'file', file });

    if (!result.success) {
      setLoadState({ status: 'error', bounds: null, orientation: 1, error: result.error ?? 'Load failed' });
      return;
    }

    const orientation = (result.metadata?.imageOrientation as number | undefined) ?? 1;
    setLoadState({ status: 'loaded', bounds: result.bounds ?? null, orientation, error: null });
    renderFrame(provider, DEFAULT_BACKGROUND_TRANSFORM);
  }, []);

  const renderFrame = useCallback(
    (provider: ImageProvider, t: BackgroundTransform) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      provider.render(ctx, {
        transform: t,
        worldToCanvas: { scale: 0.3, offsetX: 20, offsetY: 20 },
        viewport: { width: CANVAS_W, height: CANVAS_H },
        opacity: 1,
      });
    },
    [],
  );

  const handleScaleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const scale = parseFloat(e.target.value);
    const t: BackgroundTransform = { ...transform, scaleX: scale, scaleY: scale };
    setTransform(t);
    if (providerRef.current && loadState.status === 'loaded') {
      renderFrame(providerRef.current, t);
    }
  }, [transform, loadState.status, renderFrame]);

  const handleRotationChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const rotation = parseInt(e.target.value, 10);
    const t: BackgroundTransform = { ...transform, rotation };
    setTransform(t);
    if (providerRef.current && loadState.status === 'loaded') {
      renderFrame(providerRef.current, t);
    }
  }, [transform, loadState.status, renderFrame]);

  return (
    <main style={{ padding: 24, fontFamily: 'monospace', background: '#0f0f23', minHeight: '100vh', color: '#e0e0e0' }}>
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>ADR-340 Phase 2 — ImageProvider Demo</h1>
      <p style={{ fontSize: 12, color: '#888', marginBottom: 24 }}>
        PNG / JPEG / WEBP / TIFF (utif.js) · EXIF auto-rotate (exifr)
      </p>

      <section style={{ marginBottom: 24 }}>
        <label style={{ display: 'block', marginBottom: 8 }}>
          Load image (PNG / JPEG / WEBP / TIFF):
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/tiff,.tif,.tiff"
            onChange={handleFileChange}
            style={{ display: 'block', marginTop: 4 }}
          />
        </label>
      </section>

      {loadState.status === 'loading' && (
        <p style={{ color: '#ffd700' }}>Loading…</p>
      )}

      {loadState.status === 'error' && (
        <p style={{ color: '#ff4444' }}>Error: {loadState.error}</p>
      )}

      {loadState.status === 'loaded' && loadState.bounds && (
        <section style={{ marginBottom: 16, fontSize: 12, color: '#aaa' }}>
          <p>Natural bounds (post-rotation): {loadState.bounds.width} × {loadState.bounds.height} px</p>
          <p>EXIF orientation tag: {loadState.orientation} {loadState.orientation !== 1 ? '(auto-rotated ✓)' : '(normal)'}</p>
        </section>
      )}

      {loadState.status === 'loaded' && (
        <section style={{ marginBottom: 16, display: 'flex', gap: 24 }}>
          <label style={{ fontSize: 12 }}>
            Scale: {transform.scaleX.toFixed(2)}×
            <input
              type="range" min="0.1" max="5" step="0.05"
              value={transform.scaleX}
              onChange={handleScaleChange}
              style={{ display: 'block', width: 180 }}
            />
          </label>
          <label style={{ fontSize: 12 }}>
            Rotation: {transform.rotation}°
            <input
              type="range" min="0" max="360" step="1"
              value={transform.rotation}
              onChange={handleRotationChange}
              style={{ display: 'block', width: 180 }}
            />
          </label>
        </section>
      )}

      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        style={{ border: '1px solid #333', display: 'block' }}
      />
    </main>
  );
}
