/**
 * 🎯 TEST DATA HELPERS - Centralized Test Data Generation
 *
 * Single source of truth για test data creation.
 * Χρησιμοποιείται από όλα τα tests (integration, unit, E2E).
 *
 * @module __tests__/helpers/testData
 */

import type { Point2D, Entity } from '../../rendering/types/Types';

// 🎯 TEST-SPECIFIC TYPES
// These types are used ONLY in tests - not in production code

/**
 * Layer type για tests
 */
export interface Layer {
  name: string;
  visible: boolean;
  locked: boolean;
  color: string;
}

/**
 * Scene type για tests
 */
export interface Scene {
  entities: Entity[];
  layers: Layer[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  metadata: { fileName: string; units: string };
}

/**
 * 🎯 CREATE TEST SCENE - Minimal DXF Scene για testing
 *
 * Creates a minimal but complete DXF scene με:
 * - 3 entities (2 lines, 1 circle)
 * - 2 layers (Layer-1, Layer-2)
 * - Scene bounds
 * - Metadata
 *
 * @returns {Scene} Complete test scene
 *
 * @example
 * ```typescript
 * const scene = createTestScene();
 * expect(scene.entities).toHaveLength(3);
 * expect(scene.layers).toHaveLength(2);
 * ```
 */
export const createTestScene = (): Scene => ({
  entities: [
    {
      id: 'line-1',
      type: 'line',
      layer: 'Layer-1',
      color: '#FF0000',
      start: { x: 100, y: 100 },
      end: { x: 200, y: 200 },
      selected: false,
      hovered: false
    },
    {
      id: 'line-2',
      type: 'line',
      layer: 'Layer-1',
      color: '#FF0000',
      start: { x: 150, y: 150 },
      end: { x: 250, y: 250 },
      selected: false,
      hovered: false
    },
    {
      id: 'circle-1',
      type: 'circle',
      layer: 'Layer-2',
      color: '#00FF00',
      center: { x: 300, y: 300 },
      radius: 50,
      selected: false,
      hovered: false
    }
  ],
  layers: [
    { name: 'Layer-1', visible: true, locked: false, color: '#FF0000' },
    { name: 'Layer-2', visible: true, locked: false, color: '#00FF00' }
  ],
  bounds: { minX: 0, minY: 0, maxX: 500, maxY: 500 },
  metadata: { fileName: 'test.dxf', units: 'mm' }
});

/**
 * 🎯 CREATE TEST ENTITIES - Generate multiple entities για performance tests
 *
 * @param {number} count - Number of entities to create
 * @param {string} layerName - Layer name για όλα τα entities
 * @returns {Entity[]} Array of test entities
 *
 * @example
 * ```typescript
 * const entities = createTestEntities(1000, 'Layer-1');
 * expect(entities).toHaveLength(1000);
 * ```
 */
export const createTestEntities = (count: number, layerName: string = 'Layer-1'): Entity[] => {
  const entities: Entity[] = [];

  for (let i = 0; i < count; i++) {
    entities.push({
      id: `entity-${i}`,
      type: 'line',
      layer: layerName,
      color: '#FF0000',
      start: { x: i * 10, y: i * 10 },
      end: { x: i * 10 + 50, y: i * 10 + 50 },
      selected: false,
      hovered: false
    });
  }

  return entities;
};

/**
 * 🎯 CREATE TEST LAYER - Create single test layer
 *
 * @param {string} name - Layer name
 * @param {Partial<Layer>} options - Optional layer properties
 * @returns {Layer} Test layer
 *
 * @example
 * ```typescript
 * const layer = createTestLayer('Layer-1', { visible: false });
 * expect(layer.visible).toBe(false);
 * ```
 */
export const createTestLayer = (
  name: string,
  options?: Partial<Layer>
): Layer => ({
  name,
  visible: true,
  locked: false,
  color: '#FF0000',
  ...options
});

/**
 * 🎯 CREATE TEST POINT - Create test point
 *
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @returns {Point2D} Test point
 */
export const createTestPoint = (x: number, y: number): Point2D => ({ x, y });

/**
 * 🎯 FILTER ENTITIES BY LAYER - Get entities για specific layer
 *
 * @param {Scene} scene - Test scene
 * @param {string} layerName - Layer name
 * @returns {Entity[]} Entities σε αυτό το layer
 */
export const filterEntitiesByLayer = (scene: Scene, layerName: string): Entity[] => {
  return scene.entities.filter((e: Entity) => e.layer === layerName);
};

/**
 * 🎯 GET ENTITY IDS BY LAYER - Get entity IDs για specific layer
 *
 * @param {Scene} scene - Test scene
 * @param {string} layerName - Layer name
 * @returns {string[]} Entity IDs
 */
export const getEntityIdsByLayer = (scene: Scene, layerName: string): string[] => {
  return filterEntitiesByLayer(scene, layerName).map((e: Entity) => e.id);
};
