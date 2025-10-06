# 📂 Entity Management

> **Centralized entity rendering, validation, και lifecycle management**
> Registry-based pattern για extensible entity support

---

## 📋 Table of Contents

- [Overview](#overview)
- [Entity Types](#entity-types)
- [Rendering System](#rendering-system)
- [Entity Services](#entity-services)
- [Validation System](#validation-system)
- [API Reference](#api-reference)
- [Usage Examples](#usage-examples)
- [Adding New Entity Types](#adding-new-entity-types)

---

## Overview

Το **Entity Management System** είναι υπεύθυνο για:
- ✅ Rendering όλων των DXF entity types
- ✅ Validation entity data
- ✅ Merging και consolidation operations
- ✅ Entity lifecycle management

### 🎯 Design Pattern: Registry-Based Rendering

**Κάθε entity type έχει dedicated renderer που καταχωρείται στο RendererRegistry**

```typescript
// Registration
RendererRegistry.register('LINE', new LineRenderer())
RendererRegistry.register('CIRCLE', new CircleRenderer())

// Usage
const renderer = RendererRegistry.getRenderer(entity.type)
renderer.render(ctx, entity, renderContext)
```

**Benefits**:
- ✅ Easy extensibility (add new types without touching core)
- ✅ Type safety με TypeScript
- ✅ Performance optimization (renderer caching)
- ✅ Separation of concerns

---

## Entity Types

### Supported DXF Entities

| Entity Type | Renderer | Complexity | Status |
|-------------|----------|------------|--------|
| **LINE** | `LineRenderer` | Simple | ✅ Complete |
| **CIRCLE** | `CircleRenderer` | Simple | ✅ Complete |
| **ARC** | `ArcRenderer` | Medium | ✅ Complete |
| **POLYLINE** | `PolylineRenderer` | Medium | ✅ Complete |
| **LWPOLYLINE** | `PolylineRenderer` | Medium | ✅ Complete |
| **RECTANGLE** | `RectangleRenderer` | Simple | ✅ Complete |
| **ELLIPSE** | `EllipseRenderer` | Medium | ✅ Complete |
| **SPLINE** | `SplineRenderer` | Complex | ✅ Complete |
| **TEXT** | `TextRenderer` | Medium | ✅ Complete |
| **MTEXT** | `TextRenderer` | Complex | ✅ Complete |
| **POINT** | `PointRenderer` | Simple | ✅ Complete |
| **ANGLE_MEASUREMENT** | `AngleMeasurementRenderer` | Custom | ✅ Complete |

### Entity Data Structure

```typescript
interface Entity {
  id: string              // Unique identifier
  type: string            // Entity type (LINE, CIRCLE, etc)
  layer: string           // Layer name
  color?: number          // AutoCAD color index (0-255)
  colorRGB?: string       // Direct RGB color (#RRGGBB)
  lineType?: string       // Line type (CONTINUOUS, DASHED, etc)
  lineWeight?: number     // Line weight
  visible?: boolean       // Visibility flag
  selected?: boolean      // Selection state

  // Type-specific data
  vertices?: Point2D[]    // For polylines
  center?: Point2D        // For circles, arcs
  radius?: number         // For circles, arcs
  startAngle?: number     // For arcs
  endAngle?: number       // For arcs
  text?: string           // For text entities
  // ... more properties
}
```

---

## Rendering System

### Architecture

```
RendererRegistry (Singleton)
    │
    ├─ LineRenderer
    ├─ CircleRenderer
    ├─ ArcRenderer
    ├─ PolylineRenderer
    ├─ TextRenderer
    └─ ... more renderers

Each renderer implements:
    interface EntityRenderer {
      render(ctx: CanvasRenderingContext2D, entity: Entity, renderContext: IRenderContext): void
      calculateBounds(entity: Entity): Bounds
      hitTest(entity: Entity, point: Point2D, tolerance: number): boolean
    }
```

### A. RendererRegistry

**Path**: `src/subapps/dxf-viewer/rendering/RendererRegistry.ts`

**Responsibility**: Centralized registry για όλους τους entity renderers

**API**:
```typescript
class RendererRegistry {
  // Registration
  static register(entityType: string, renderer: EntityRenderer): void

  // Retrieval
  static getRenderer(entityType: string): EntityRenderer | null

  // Initialization
  static registerStandardRenderers(): void

  // Query
  static hasRenderer(entityType: string): boolean
  static getSupportedTypes(): string[]
}
```

**Usage**:
```typescript
// Initialize (called once at app startup)
RendererRegistry.registerStandardRenderers()

// Get renderer for entity
const renderer = RendererRegistry.getRenderer('LINE')
if (renderer) {
  renderer.render(ctx, entity, renderContext)
}
```

### B. IRenderContext

**Path**: `src/subapps/dxf-viewer/rendering/core/IRenderContext.ts`

**Responsibility**: Shared context για rendering operations

**Interface**:
```typescript
interface IRenderContext {
  transform: ViewTransform        // Current zoom/pan transform
  viewport: Viewport              // Canvas dimensions
  selectedIds: Set<string>        // Selected entity IDs
  hoveredId: string | null        // Hovered entity ID
  colorLayers: ColorLayer[]       // Layer visibility/color overrides
  settings: RenderSettings        // Global render settings

  // Helper methods
  worldToScreen(worldPoint: Point2D): Point2D
  screenToWorld(screenPoint: Point2D): Point2D
  getEntityColor(entity: Entity): string
  isEntityVisible(entity: Entity): boolean
}
```

### C. Entity Renderers

#### LineRenderer

**Path**: `src/subapps/dxf-viewer/rendering/entities/line/LineRenderer.ts`

**Responsibility**: Render LINE entities

```typescript
class LineRenderer implements EntityRenderer {
  render(ctx: CanvasRenderingContext2D, entity: LineEntity, renderContext: IRenderContext) {
    const { start, end } = entity.vertices
    const startScreen = renderContext.worldToScreen(start)
    const endScreen = renderContext.worldToScreen(end)

    ctx.strokeStyle = renderContext.getEntityColor(entity)
    ctx.lineWidth = entity.lineWeight || 1

    ctx.beginPath()
    ctx.moveTo(startScreen.x, startScreen.y)
    ctx.lineTo(endScreen.x, endScreen.y)
    ctx.stroke()
  }

  calculateBounds(entity: LineEntity): Bounds {
    const { start, end } = entity.vertices
    return {
      min: { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y) },
      max: { x: Math.max(start.x, end.x), y: Math.max(start.y, end.y) }
    }
  }

  hitTest(entity: LineEntity, point: Point2D, tolerance: number): boolean {
    return distanceToLineSegment(point, entity.vertices.start, entity.vertices.end) <= tolerance
  }
}
```

#### CircleRenderer

**Path**: `src/subapps/dxf-viewer/rendering/entities/circle/CircleRenderer.ts`

```typescript
class CircleRenderer implements EntityRenderer {
  render(ctx: CanvasRenderingContext2D, entity: CircleEntity, renderContext: IRenderContext) {
    const centerScreen = renderContext.worldToScreen(entity.center)
    const radiusScreen = entity.radius * renderContext.transform.scale

    ctx.strokeStyle = renderContext.getEntityColor(entity)
    ctx.lineWidth = entity.lineWeight || 1

    ctx.beginPath()
    ctx.arc(centerScreen.x, centerScreen.y, radiusScreen, 0, Math.PI * 2)
    ctx.stroke()
  }

  calculateBounds(entity: CircleEntity): Bounds {
    const { center, radius } = entity
    return {
      min: { x: center.x - radius, y: center.y - radius },
      max: { x: center.x + radius, y: center.y + radius }
    }
  }

  hitTest(entity: CircleEntity, point: Point2D, tolerance: number): boolean {
    const dist = distance(point, entity.center)
    return Math.abs(dist - entity.radius) <= tolerance
  }
}
```

#### PolylineRenderer

**Path**: `src/subapps/dxf-viewer/rendering/entities/polyline/PolylineRenderer.ts`

```typescript
class PolylineRenderer implements EntityRenderer {
  render(ctx: CanvasRenderingContext2D, entity: PolylineEntity, renderContext: IRenderContext) {
    const vertices = entity.vertices.map(v => renderContext.worldToScreen(v))

    ctx.strokeStyle = renderContext.getEntityColor(entity)
    ctx.lineWidth = entity.lineWeight || 1

    ctx.beginPath()
    ctx.moveTo(vertices[0].x, vertices[0].y)

    for (let i = 1; i < vertices.length; i++) {
      ctx.lineTo(vertices[i].x, vertices[i].y)
    }

    if (entity.closed) {
      ctx.closePath()
    }

    ctx.stroke()
  }

  calculateBounds(entity: PolylineEntity): Bounds {
    const xs = entity.vertices.map(v => v.x)
    const ys = entity.vertices.map(v => v.y)

    return {
      min: { x: Math.min(...xs), y: Math.min(...ys) },
      max: { x: Math.max(...xs), y: Math.max(...ys) }
    }
  }

  hitTest(entity: PolylineEntity, point: Point2D, tolerance: number): boolean {
    // Test each segment
    for (let i = 0; i < entity.vertices.length - 1; i++) {
      if (distanceToLineSegment(point, entity.vertices[i], entity.vertices[i + 1]) <= tolerance) {
        return true
      }
    }
    return false
  }
}
```

---

## Entity Services

### A. EntityMergeService

**Path**: `src/subapps/dxf-viewer/services/EntityMergeService.ts`

**Responsibility**: Merge entities από multiple sources (scene + layers)

**API**:
```typescript
export const EntityMergeService = {
  /**
   * Merge scene entities με layer entities
   */
  mergeEntities(
    sceneEntities: Entity[],
    layerEntities: Entity[]
  ): Entity[] {
    const merged = new Map<string, Entity>()

    // Add scene entities
    sceneEntities.forEach(entity => {
      merged.set(entity.id, entity)
    })

    // Overlay layer entities (can override scene entities)
    layerEntities.forEach(entity => {
      merged.set(entity.id, entity)
    })

    return Array.from(merged.values())
  },

  /**
   * Remove duplicate entities (same geometry)
   */
  deduplicateEntities(entities: Entity[]): Entity[] {
    const seen = new Set<string>()
    return entities.filter(entity => {
      const hash = this.geometryHash(entity)
      if (seen.has(hash)) return false
      seen.add(hash)
      return true
    })
  },

  /**
   * Calculate geometry hash για deduplication
   */
  geometryHash(entity: Entity): string {
    // Implementation depends on entity type
    switch (entity.type) {
      case 'LINE':
        return `LINE:${entity.vertices.start.x},${entity.vertices.start.y}-${entity.vertices.end.x},${entity.vertices.end.y}`
      case 'CIRCLE':
        return `CIRCLE:${entity.center.x},${entity.center.y},${entity.radius}`
      // ... more types
      default:
        return entity.id
    }
  }
}
```

**Usage**:
```typescript
import { EntityMergeService } from '../services/EntityMergeService'

const sceneEntities = currentScene.entities
const layerEntities = colorLayers.flatMap(layer => layer.entities)

const merged = EntityMergeService.mergeEntities(sceneEntities, layerEntities)
const unique = EntityMergeService.deduplicateEntities(merged)
```

---

## Validation System

### A. Entity Validation

**Path**: `src/subapps/dxf-viewer/utils/entity-validation-utils.ts`

**Responsibility**: Validate entity data integrity

**API**:
```typescript
export const EntityValidation = {
  /**
   * Validate entity has required fields
   */
  isValid(entity: Entity): boolean {
    if (!entity.id || !entity.type) return false

    switch (entity.type) {
      case 'LINE':
        return this.validateLine(entity as LineEntity)
      case 'CIRCLE':
        return this.validateCircle(entity as CircleEntity)
      case 'POLYLINE':
        return this.validatePolyline(entity as PolylineEntity)
      default:
        return true  // Unknown types assumed valid
    }
  },

  validateLine(entity: LineEntity): boolean {
    return !!(
      entity.vertices &&
      entity.vertices.start &&
      entity.vertices.end &&
      this.isValidPoint(entity.vertices.start) &&
      this.isValidPoint(entity.vertices.end)
    )
  },

  validateCircle(entity: CircleEntity): boolean {
    return !!(
      entity.center &&
      this.isValidPoint(entity.center) &&
      typeof entity.radius === 'number' &&
      entity.radius > 0
    )
  },

  validatePolyline(entity: PolylineEntity): boolean {
    return !!(
      entity.vertices &&
      Array.isArray(entity.vertices) &&
      entity.vertices.length >= 2 &&
      entity.vertices.every(v => this.isValidPoint(v))
    )
  },

  isValidPoint(point: Point2D): boolean {
    return !!(
      point &&
      typeof point.x === 'number' &&
      typeof point.y === 'number' &&
      Number.isFinite(point.x) &&
      Number.isFinite(point.y)
    )
  },

  /**
   * Sanitize entity data (fix common issues)
   */
  sanitize(entity: Entity): Entity {
    // Remove NaN/Infinity values
    // Set defaults for missing fields
    // Normalize coordinates
    return {
      ...entity,
      color: entity.color ?? 7,  // Default white
      lineWeight: entity.lineWeight ?? 1,
      visible: entity.visible ?? true,
      selected: entity.selected ?? false
    }
  }
}
```

**Usage**:
```typescript
import { EntityValidation } from '../utils/entity-validation-utils'

// Before rendering
const validEntities = entities.filter(e => EntityValidation.isValid(e))

// Sanitize imported data
const sanitized = entities.map(e => EntityValidation.sanitize(e))
```

---

## API Reference

### RendererRegistry

```typescript
class RendererRegistry {
  static register(entityType: string, renderer: EntityRenderer): void
  static getRenderer(entityType: string): EntityRenderer | null
  static registerStandardRenderers(): void
  static hasRenderer(entityType: string): boolean
  static getSupportedTypes(): string[]
}
```

### EntityRenderer Interface

```typescript
interface EntityRenderer {
  render(
    ctx: CanvasRenderingContext2D,
    entity: Entity,
    renderContext: IRenderContext
  ): void

  calculateBounds(entity: Entity): Bounds

  hitTest(
    entity: Entity,
    point: Point2D,
    tolerance: number
  ): boolean
}
```

### EntityMergeService

```typescript
const EntityMergeService = {
  mergeEntities(sceneEntities: Entity[], layerEntities: Entity[]): Entity[]
  deduplicateEntities(entities: Entity[]): Entity[]
  geometryHash(entity: Entity): string
}
```

### EntityValidation

```typescript
const EntityValidation = {
  isValid(entity: Entity): boolean
  validateLine(entity: LineEntity): boolean
  validateCircle(entity: CircleEntity): boolean
  validatePolyline(entity: PolylineEntity): boolean
  isValidPoint(point: Point2D): boolean
  sanitize(entity: Entity): Entity
}
```

---

## Usage Examples

### Basic Rendering

```typescript
import { RendererRegistry } from '../rendering/RendererRegistry'
import type { IRenderContext } from '../rendering/core/IRenderContext'

// Initialize once at startup
RendererRegistry.registerStandardRenderers()

// Render entities
function renderEntities(
  ctx: CanvasRenderingContext2D,
  entities: Entity[],
  renderContext: IRenderContext
) {
  entities.forEach(entity => {
    if (!renderContext.isEntityVisible(entity)) return

    const renderer = RendererRegistry.getRenderer(entity.type)
    if (renderer) {
      renderer.render(ctx, entity, renderContext)
    } else {
      console.warn(`No renderer for entity type: ${entity.type}`)
    }
  })
}
```

### Custom Renderer

```typescript
import type { EntityRenderer } from '../rendering/EntityRenderer'

class CustomShapeRenderer implements EntityRenderer {
  render(ctx: CanvasRenderingContext2D, entity: CustomEntity, renderContext: IRenderContext) {
    // Custom rendering logic
    const points = entity.points.map(p => renderContext.worldToScreen(p))

    ctx.fillStyle = renderContext.getEntityColor(entity)
    ctx.beginPath()
    // ... custom drawing
    ctx.fill()
  }

  calculateBounds(entity: CustomEntity): Bounds {
    // Calculate bounds
    return { min: {...}, max: {...} }
  }

  hitTest(entity: CustomEntity, point: Point2D, tolerance: number): boolean {
    // Custom hit testing
    return false
  }
}

// Register
RendererRegistry.register('CUSTOM_SHAPE', new CustomShapeRenderer())
```

### Entity Validation Pipeline

```typescript
import { EntityValidation } from '../utils/entity-validation-utils'

function importEntities(rawData: any[]): Entity[] {
  return rawData
    .map(raw => parseEntity(raw))        // Parse from DXF
    .map(e => EntityValidation.sanitize(e))  // Fix common issues
    .filter(e => EntityValidation.isValid(e)) // Remove invalid
}
```

---

## Adding New Entity Types

### Step-by-Step Guide

**1. Define Entity Interface**
```typescript
// types/entities.ts
export interface MyCustomEntity extends Entity {
  type: 'MY_CUSTOM'
  customProperty: number
  customPoints: Point2D[]
}
```

**2. Create Renderer**
```typescript
// rendering/entities/mycustom/MyCustomRenderer.ts
export class MyCustomRenderer implements EntityRenderer {
  render(ctx, entity: MyCustomEntity, renderContext) {
    // Rendering logic
  }

  calculateBounds(entity: MyCustomEntity): Bounds {
    // Bounds calculation
  }

  hitTest(entity: MyCustomEntity, point, tolerance): boolean {
    // Hit testing
  }
}
```

**3. Register Renderer**
```typescript
// rendering/RendererRegistry.ts
import { MyCustomRenderer } from './entities/mycustom/MyCustomRenderer'

export function registerStandardRenderers() {
  // ... existing renderers
  this.register('MY_CUSTOM', new MyCustomRenderer())
}
```

**4. Add Validation (Optional)**
```typescript
// utils/entity-validation-utils.ts
validateMyCustom(entity: MyCustomEntity): boolean {
  return !!(
    entity.customProperty > 0 &&
    entity.customPoints.length > 0
  )
}
```

**5. Use New Entity**
```typescript
const customEntity: MyCustomEntity = {
  id: 'custom-1',
  type: 'MY_CUSTOM',
  layer: 'Layer1',
  customProperty: 42,
  customPoints: [{ x: 0, y: 0 }, { x: 100, y: 100 }]
}

scene.entities.push(customEntity)
```

---

## Performance Considerations

### 1. Renderer Caching

Renderers είναι singleton instances - δεν δημιουργούνται νέα objects σε κάθε render:

```typescript
// ✅ GOOD - Reuse renderer
const renderer = RendererRegistry.getRenderer('LINE')
entities.forEach(e => renderer.render(ctx, e, renderContext))

// ❌ BAD - New lookup each time
entities.forEach(e => {
  const renderer = RendererRegistry.getRenderer(e.type)  // Wasteful!
  renderer.render(ctx, e, renderContext)
})
```

### 2. Bounds Caching

Calculate bounds once και cache:

```typescript
const boundsCache = new Map<string, Bounds>()

function getEntityBounds(entity: Entity): Bounds {
  if (boundsCache.has(entity.id)) {
    return boundsCache.get(entity.id)!
  }

  const renderer = RendererRegistry.getRenderer(entity.type)
  const bounds = renderer?.calculateBounds(entity) || defaultBounds
  boundsCache.set(entity.id, bounds)

  return bounds
}
```

### 3. Viewport Culling

Render μόνο visible entities:

```typescript
function renderVisibleEntities(ctx, entities, renderContext) {
  const visibleBounds = getViewportBounds(renderContext)

  const visibleEntities = entities.filter(entity => {
    const bounds = getEntityBounds(entity)
    return boundsIntersect(bounds, visibleBounds)
  })

  visibleEntities.forEach(entity => {
    const renderer = RendererRegistry.getRenderer(entity.type)
    renderer?.render(ctx, entity, renderContext)
  })
}
```

---

## Related Documentation

- [Architecture Overview](./overview.md)
- [Coordinate Systems](./coordinate-systems.md)
- [Rendering Pipeline](./rendering-pipeline.md)
- [Selection System](../systems/selection.md)

---

**📂 Centralized Entity Management**
*Registry-Based • Extensible • Type-Safe*

Last Updated: 2025-10-03
