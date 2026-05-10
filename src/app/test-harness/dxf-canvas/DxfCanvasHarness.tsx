'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import type { DxfScene } from '@/subapps/dxf-viewer/canvas-v2/dxf-canvas/dxf-types';
import type { ViewTransform, Point2D } from '@/subapps/dxf-viewer/rendering/types/Types';
import type { DxfCanvas as DxfCanvasType, DxfCanvasRef } from '@/subapps/dxf-viewer/canvas-v2/dxf-canvas/DxfCanvas';
import type { GridSettings, RulerSettings } from '@/subapps/dxf-viewer/canvas-v2/layer-canvas/layer-types';
import { PreviewCanvas } from '@/subapps/dxf-viewer/canvas-v2/preview-canvas/PreviewCanvas';
import type { PreviewCanvasHandle } from '@/subapps/dxf-viewer/canvas-v2/preview-canvas/PreviewCanvas';
import type { ExtendedSceneEntity } from '@/subapps/dxf-viewer/hooks/drawing/drawing-types';

declare global {
  interface Window {
    __dxfTest: {
      fitToView: () => void;
      zoomIn: () => void;
      zoomOut: () => void;
      getRef: () => DxfCanvasRef | null;
      isReady: () => boolean;
      selectEntities: (ids: string[]) => void;
      clearSelection: () => void;
      getSelectedEntityIds: () => string[];
      worldToScreen: (wx: number, wy: number) => { x: number; y: number };
      drawPreview: (entity: Record<string, unknown>) => void;
      clearPreview: () => void;
      setActiveTool: (tool: string) => void;
    };
  }
}

const HARNESS_VIEWPORT = { width: 1280, height: 800 };

const DxfCanvas = dynamic(
  () => import('@/subapps/dxf-viewer/canvas-v2/dxf-canvas/DxfCanvas').then(m => m.DxfCanvas),
  { ssr: false }
) as typeof DxfCanvasType;

const INITIAL_TRANSFORM: ViewTransform = { scale: 1, offsetX: 0, offsetY: 0 };

const GRID_SETTINGS: GridSettings = {
  enabled: true,
  visible: true,
  color: '#333333',
  size: 10,
  style: 'lines',
  lineWidth: 1,
  majorGridColor: '#444444',
  minorGridColor: '#2a2a2a',
  majorInterval: 5,
  showMajorGrid: true,
  showMinorGrid: true,
  adaptiveOpacity: false,
  minVisibleSize: 5,
  majorGridWeight: 2,
  minorGridWeight: 1,
  smoothFade: false,
  smoothFadeMinPx: 2,
  smoothFadeMaxPx: 10,
  smoothFadeDurationMs: 0,
  showOrigin: false,
  showAxes: false,
  axesColor: '#555555',
  axesWeight: 1,
  opacity: 0.3,
};

const RULER_SETTINGS: RulerSettings = {
  enabled: true,
  visible: true,
  unit: 'mm',
};

export default function DxfCanvasHarness() {
  const canvasRef = useRef<DxfCanvasRef>(null);
  const previewCanvasRef = useRef<PreviewCanvasHandle>(null);
  const [scene, setScene] = useState<DxfScene | null>(null);
  const [transform, setTransform] = useState<ViewTransform>(INITIAL_TRANSFORM);
  const [error, setError] = useState<string | null>(null);
  const [urlParams, setUrlParams] = useState({ rulers: false, grid: false, fixture: 'regression-scene' });
  const [activeTool, setActiveTool] = useState<string>('select');
  const [selectedEntityIds, setSelectedEntityIds] = useState<string[]>([]);
  const selectedEntityIdsRef = useRef<string[]>([]);
  selectedEntityIdsRef.current = selectedEntityIds;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setUrlParams({
      rulers: params.get('rulers') === '1',
      grid: params.get('grid') === '1',
      fixture: params.get('fixture') ?? 'regression-scene',
    });
  }, []);

  useEffect(() => {
    fetch(`/test-fixtures/dxf/${urlParams.fixture}.json`)
      .then(r => r.json())
      .then((data: DxfScene) => setScene(data))
      .catch(e => setError(String(e)));
  }, [urlParams.fixture]);

  const handleTransformChange = useCallback((t: ViewTransform) => {
    setTransform(t);
  }, []);

  const handleEntitySelect = useCallback((entityId: string | null) => {
    setSelectedEntityIds(entityId ? [entityId] : []);
  }, []);

  const handleEntitiesSelected = useCallback((ids: string[]) => {
    setSelectedEntityIds(ids);
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Delete') {
      const ids = selectedEntityIdsRef.current;
      if (ids.length === 0) return;
      setScene(s => s ? { ...s, entities: s.entities.filter(ent => !ids.includes(ent.id)) } : null);
      setSelectedEntityIds([]);
    } else if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      setScene(s => {
        if (!s) return s;
        setSelectedEntityIds(s.entities.map(ent => ent.id));
        return s;
      });
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const renderOptions = useMemo(() => ({
    showGrid: false,
    showLayerNames: false,
    wireframeMode: false,
    selectedEntityIds,
  }), [selectedEntityIds]);

  const handleWheelZoom = useCallback((wheelDelta: number, center: Point2D) => {
    setTransform(prev => {
      const factor = wheelDelta < 0 ? 1.5 : 0.667;
      const newScale = Math.max(0.001, Math.min(500, prev.scale * factor));
      const ratio = newScale / prev.scale;
      return {
        scale: newScale,
        offsetX: center.x - (center.x - prev.offsetX) * ratio,
        offsetY: center.y - (center.y - prev.offsetY) * ratio,
      };
    });
  }, []);

  useEffect(() => {
    window.__dxfTest = {
      fitToView: () => canvasRef.current?.fitToView(),
      zoomIn: () => canvasRef.current?.zoomAtScreenPoint(2, { x: 640, y: 400 }),
      zoomOut: () => canvasRef.current?.zoomAtScreenPoint(0.5, { x: 640, y: 400 }),
      getRef: () => canvasRef.current,
      isReady: () => !!(canvasRef.current && scene),
      selectEntities: (ids: string[]) => setSelectedEntityIds(ids),
      clearSelection: () => setSelectedEntityIds([]),
      getSelectedEntityIds: () => selectedEntityIdsRef.current,
      worldToScreen: (wx: number, wy: number) => {
        const t = canvasRef.current?.getTransform() ?? transform;
        return { x: wx * t.scale + t.offsetX, y: t.offsetY - wy * t.scale };
      },
      drawPreview: (entity: Record<string, unknown>) =>
        previewCanvasRef.current?.drawPreview(entity as unknown as ExtendedSceneEntity),
      clearPreview: () => previewCanvasRef.current?.clear(),
      setActiveTool: (tool: string) => setActiveTool(tool),
    };
  });

  if (error) {
    return (
      <main className="fixed inset-0 flex items-center justify-center bg-gray-900">
        <p data-testid="error" className="text-red-400 font-mono text-sm">{error}</p>
      </main>
    );
  }

  return (
    <main className="fixed inset-0 overflow-hidden bg-gray-900">
      {scene ? (
        <section data-testid="dxf-canvas-ready" className="relative w-full h-full">
          <DxfCanvas
            ref={canvasRef}
            scene={scene}
            transform={transform}
            onTransformChange={handleTransformChange}
            onWheelZoom={handleWheelZoom}
            onEntitySelect={handleEntitySelect}
            onEntitiesSelected={handleEntitiesSelected}
            renderOptions={renderOptions}
            rulerSettings={urlParams.rulers ? RULER_SETTINGS : undefined}
            gridSettings={urlParams.grid ? GRID_SETTINGS : undefined}
            activeTool={activeTool}
          />
          <PreviewCanvas
            ref={previewCanvasRef}
            transform={transform}
            viewport={HARNESS_VIEWPORT}
            isActive
          />
        </section>
      ) : (
        <div data-testid="loading" className="fixed inset-0" />
      )}
    </main>
  );
}
