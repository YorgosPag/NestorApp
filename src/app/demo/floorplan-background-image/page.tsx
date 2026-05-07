/* eslint-disable custom/no-hardcoded-strings, design-system/enforce-semantic-colors */
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  registerProviders,
  useFloorplanBackground,
  FloorplanBackgroundCanvas,
} from '@/subapps/dxf-viewer/floorplan-background';

const DEMO_FLOOR = 'demo-floor';
const CANVAS_W = 800;
const CANVAS_H = 600;
const WORLD_TO_CANVAS = { scale: 0.3, offsetX: 20, offsetY: 20 } as const;
const VIEWPORT = { width: CANVAS_W, height: CANVAS_H } as const;

export default function FloorplanBackgroundImageDemoPage() {
  const {
    background,
    isLoading,
    error,
    addBackground,
    removeBackground,
    setOpacity,
    setVisible,
    setTransform,
  } = useFloorplanBackground(DEMO_FLOOR);

  const [pendingFile, setPendingFile] = useState<File | null>(null);

  // Register providers once on mount (idempotent)
  useEffect(() => {
    registerProviders();
  }, []);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setPendingFile(file);
      await addBackground({ kind: 'file', file }, 'image');
    },
    [addBackground],
  );

  const handleScaleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const scale = parseFloat(e.target.value);
      setTransform({ scaleX: scale, scaleY: scale });
    },
    [setTransform],
  );

  const handleRotationChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setTransform({ rotation: parseInt(e.target.value, 10) });
    },
    [setTransform],
  );

  const handleOpacityChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setOpacity(parseFloat(e.target.value));
    },
    [setOpacity],
  );

  return (
    <main style={{ padding: 24, fontFamily: 'monospace', background: '#0f0f23', minHeight: '100vh', color: '#e0e0e0' }}>
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>ADR-340 Phase 3 — Store + Hook + Canvas Demo</h1>
      <p style={{ fontSize: 12, color: '#888', marginBottom: 24 }}>
        floorplanBackgroundStore · useFloorplanBackground · FloorplanBackgroundCanvas
        · PNG / JPEG / WEBP / TIFF
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
        {background && (
          <button
            onClick={() => { void removeBackground(); setPendingFile(null); }}
            style={{ marginTop: 8, padding: '4px 12px', cursor: 'pointer' }}
          >
            Remove background
          </button>
        )}
      </section>

      {isLoading && <p style={{ color: '#ffd700' }}>Loading…</p>}
      {error && <p style={{ color: '#ff4444' }}>Error: {error}</p>}

      {background && (
        <>
          <section style={{ marginBottom: 12, fontSize: 12, color: '#aaa' }}>
            <p>File: {pendingFile?.name ?? '(from store)'}</p>
            <p>Natural bounds: {background.naturalBounds.width} × {background.naturalBounds.height} px</p>
            <p>
              EXIF orientation: {background.providerMetadata.imageOrientation ?? 1}
              {(background.providerMetadata.imageOrientation ?? 1) !== 1 ? ' (auto-rotated ✓)' : ' (normal)'}
            </p>
            <p>ID: <code>{background.id}</code></p>
          </section>

          <section style={{ marginBottom: 16, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <label style={{ fontSize: 12 }}>
              Scale: {background.transform.scaleX.toFixed(2)}×
              <input
                type="range" min="0.1" max="5" step="0.05"
                value={background.transform.scaleX}
                onChange={handleScaleChange}
                style={{ display: 'block', width: 180 }}
              />
            </label>
            <label style={{ fontSize: 12 }}>
              Rotation: {background.transform.rotation}°
              <input
                type="range" min="0" max="360" step="1"
                value={background.transform.rotation}
                onChange={handleRotationChange}
                style={{ display: 'block', width: 180 }}
              />
            </label>
            <label style={{ fontSize: 12 }}>
              Opacity: {background.opacity.toFixed(2)}
              <input
                type="range" min="0" max="1" step="0.01"
                value={background.opacity}
                onChange={handleOpacityChange}
                style={{ display: 'block', width: 180 }}
              />
            </label>
            <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={background.visible}
                onChange={(e) => setVisible(e.target.checked)}
              />
              Visible
            </label>
          </section>
        </>
      )}

      <div style={{ position: 'relative', width: CANVAS_W, height: CANVAS_H, border: '1px solid #333', background: '#1a1a2e' }}>
        <FloorplanBackgroundCanvas
          floorId={DEMO_FLOOR}
          worldToCanvas={WORLD_TO_CANVAS}
          viewport={VIEWPORT}
        />
      </div>
    </main>
  );
}
