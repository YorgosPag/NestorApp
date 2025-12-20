// Mock DXF Loader - Προσωρινή λύση χωρίς dxf-parser
import type {
  Point2D,
  SceneModel,
  SceneLayer,
  AnySceneEntity,
  DxfImportResult,
} from '../types/scene';

function genId(prefix = 'e'): string {
  // ✅ ENTERPRISE MIGRATION: Using centralized ID generation
  const { generateRandomId } = require('@/lib/obligations/utils');
  return generateRandomId(prefix, 8); // Same length as original (slice(2, 10) = 8 chars)
}

export async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ''));
    r.onerror = reject;
    r.readAsText(file);
  });
}

// Mock DXF Parser για testing
function createMockScene(): SceneModel {
  const entities: AnySceneEntity[] = [];
  const layers: Record<string, SceneLayer> = {
    '0': {
      name: '0',
      color: '7',
      visible: true,
      locked: false,
    }
  };

  // Δημιουργία μερικών test entities
  entities.push({
    id: genId('line'),
    type: 'line',
    layer: '0',
    visible: true,
    start: { x: 10, y: 10 },
    end: { x: 90, y: 90 }
  });

  entities.push({
    id: genId('circle'),
    type: 'circle',
    layer: '0',
    visible: true,
    center: { x: 50, y: 50 },
    radius: 20
  });

  entities.push({
    id: genId('rect'),
    type: 'polyline',
    layer: '0',
    visible: true,
    vertices: [
      { x: 20, y: 20 },
      { x: 80, y: 20 },
      { x: 80, y: 80 },
      { x: 20, y: 80 },
      { x: 20, y: 20 }
    ],
    closed: true
  });

  return {
    entities,
    layers,
    bounds: {
      min: { x: 0, y: 0 },
      max: { x: 100, y: 100 }
    },
    units: 'mm'
  };
}

export async function parseDxfToScene(
  dxfText: string,
  opts?: { sceneId?: string }
): Promise<DxfImportResult> {
  const t0 = performance.now();

  // Προσομοίωση parsing delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const scene = createMockScene();
  const t1 = performance.now();

  return {
    success: true,
    scene,
    warnings: ['Χρησιμοποιείται sample parser - όχι πραγματικό DXF parsing'],
    stats: {
      entityCount: scene.entities.length,
      layerCount: Object.keys(scene.layers).length,
      parseTimeMs: Math.round(t1 - t0),
    },
  };
}
