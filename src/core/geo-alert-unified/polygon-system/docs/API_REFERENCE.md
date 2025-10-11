# 📚 Universal Polygon System - API Reference

## 🔷 Core Types

### UniversalPolygon
```typescript
interface UniversalPolygon {
  /** Unique polygon identifier */
  id: string;

  /** Polygon type/category */
  type: PolygonType;

  /** Array of polygon points */
  points: PolygonPoint[];

  /** Is polygon geometrically closed? */
  isClosed: boolean;

  /** Visual styling configuration */
  style: PolygonStyle;

  /** Optional metadata */
  metadata?: {
    createdAt: Date;
    modifiedAt: Date;
    createdBy?: string;
    description?: string;
    area?: number;
    perimeter?: number;
    properties?: Record<string, any>;
  };
}
```

### PolygonPoint
```typescript
interface PolygonPoint {
  /** X coordinate (or longitude) */
  x: number;

  /** Y coordinate (or latitude) */
  y: number;

  /** Optional point identifier */
  id?: string;

  /** Optional point label */
  label?: string;
}
```

### PolygonType
```typescript
type PolygonType =
  | 'simple'         // Απλό σχέδιο
  | 'georeferencing' // Control points για georeferencing
  | 'alert-zone'     // Alert zone definitions
  | 'measurement'    // Μετρήσεις
  | 'annotation';    // Σχόλια
```

### PolygonStyle
```typescript
interface PolygonStyle {
  strokeColor: string;      // Stroke color (hex)
  fillColor: string;        // Fill color (hex)
  strokeWidth: number;      // Stroke width in pixels
  fillOpacity: number;      // Fill opacity (0-1)
  strokeOpacity: number;    // Stroke opacity (0-1)
  strokeDash?: number[];    // Line dash pattern
  pointRadius?: number;     // Point radius for vertices
  pointColor?: string;      // Point color
}
```

## 🎨 Drawing Classes

### SimplePolygonDrawer

#### Constructor
```typescript
constructor(canvas?: HTMLCanvasElement)
```

#### Methods

##### setCanvas()
```typescript
setCanvas(canvas: HTMLCanvasElement): void
```
Ορισμός canvas element για rendering.

##### startDrawing()
```typescript
startDrawing(type?: PolygonType, style?: Partial<PolygonStyle>): void
```
Ξεκινάει νέο polygon drawing session.

##### addPoint()
```typescript
addPoint(x: number, y: number): PolygonPoint | null
```
Προσθέτει σημείο στο τρέχον polygon.

##### removeLastPoint()
```typescript
removeLastPoint(): PolygonPoint | null
```
Αφαιρεί το τελευταίο σημείο.

##### closePolygon()
```typescript
closePolygon(): UniversalPolygon | null
```
Κλείνει το τρέχον polygon (3+ points απαιτούνται).

##### finishDrawing()
```typescript
finishDrawing(): UniversalPolygon | null
```
Ολοκληρώνει το drawing session.

##### cancelDrawing()
```typescript
cancelDrawing(): void
```
Ακυρώνει το τρέχον drawing.

##### getState()
```typescript
getState(): PolygonDrawingState
```
Επιστρέφει το τρέχον drawing state.

##### setOptions()
```typescript
setOptions(options: Partial<PolygonDrawingState>): void
```
Ενημερώνει τις drawing επιλογές.

### ControlPointDrawer extends SimplePolygonDrawer

#### Additional Methods

##### addControlPoint()
```typescript
addControlPoint(
  x: number,
  y: number,
  geoCoords?: { lng: number; lat: number },
  label?: string
): PolygonPoint | null
```
Προσθέτει control point με geographic coordinates.

##### setGeoReference()
```typescript
setGeoReference(pointId: string, geoCoords: { lng: number; lat: number }): boolean
```
Ορίζει geographic coordinates για υπάρχον point.

##### getGeoReference()
```typescript
getGeoReference(pointId: string): { lng: number; lat: number } | null
```
Λαμβάνει geographic coordinates για point.

##### exportForTransformation()
```typescript
exportForTransformation(): Array<{
  id: string;
  floor: { x: number; y: number };
  geo: { lng: number; lat: number };
  label?: string;
}>
```
Εξάγει control points για transformation calculation.

##### validateForTransformation()
```typescript
validateForTransformation(): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  controlPointCount: number;
  geoReferencedCount: number;
}
```
Επικυρώνει control points για transformation.

## 🔧 Utility Functions

### validatePolygon()
```typescript
function validatePolygon(polygon: UniversalPolygon): PolygonValidationResult
```
Επικυρώνει polygon structure και geometry.

**Returns:**
```typescript
interface PolygonValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}
```

### calculatePolygonArea()
```typescript
function calculatePolygonArea(polygon: UniversalPolygon): number
```
Υπολογίζει polygon area (absolute value).

### calculatePolygonPerimeter()
```typescript
function calculatePolygonPerimeter(polygon: UniversalPolygon): number
```
Υπολογίζει polygon perimeter.

### isPolygonClosed()
```typescript
function isPolygonClosed(polygon: UniversalPolygon): boolean
```
Ελέγχει αν το polygon είναι κλειστό geometrically.

### closePolygon()
```typescript
function closePolygon(polygon: UniversalPolygon): UniversalPolygon
```
Κλείνει polygon προσθέτοντας closing point.

### getPolygonBounds()
```typescript
function getPolygonBounds(polygon: UniversalPolygon): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}
```
Υπολογίζει polygon bounding box.

### isPointInPolygon()
```typescript
function isPointInPolygon(point: PolygonPoint, polygon: UniversalPolygon): boolean
```
Ελέγχει αν point βρίσκεται μέσα στο polygon (ray casting).

### simplifyPolygon()
```typescript
function simplifyPolygon(
  polygon: UniversalPolygon,
  tolerance?: number
): UniversalPolygon
```
Απλοποιεί polygon με Douglas-Peucker algorithm.

## 🔄 Converter Functions

### polygonToGeoJSON()
```typescript
function polygonToGeoJSON(
  polygon: UniversalPolygon,
  options?: Partial<PolygonExportOptions>
): GeoJSON.Feature
```
Μετατρέπει UniversalPolygon σε GeoJSON Feature.

### geoJSONToPolygon()
```typescript
function geoJSONToPolygon(feature: GeoJSON.Feature): UniversalPolygon
```
Μετατρέπει GeoJSON Feature σε UniversalPolygon.

### polygonToSVG()
```typescript
function polygonToSVG(
  polygon: UniversalPolygon,
  options?: {
    viewBox?: { width: number; height: number };
    strokeWidth?: number;
    className?: string;
  }
): string
```
Μετατρέπει polygon σε SVG path string.

### polygonToCSV()
```typescript
function polygonToCSV(
  polygons: UniversalPolygon[],
  options?: Partial<PolygonExportOptions>
): string
```
Εξάγει polygons σε CSV format.

### importPolygonsFromCSV()
```typescript
function importPolygonsFromCSV(csvData: string): PolygonImportResult
```
Εισάγει polygons από CSV data.

### polygonsToGeoJSONCollection()
```typescript
function polygonsToGeoJSONCollection(
  polygons: UniversalPolygon[],
  options?: Partial<PolygonExportOptions>
): GeoJSON.FeatureCollection
```
Μετατρέπει array από polygons σε GeoJSON FeatureCollection.

## 🗺️ Integration Classes

### GeoCanvasPolygonManager

#### Constructor
```typescript
constructor(options?: GeoCanvasIntegrationOptions)
```

#### Methods

##### startDrawing()
```typescript
startDrawing(type?: PolygonType, style?: Partial<PolygonStyle>): void
```

##### addPoint()
```typescript
addPoint(x: number, y: number, geoCoords?: { lng: number; lat: number }): PolygonPoint | null
```

##### finishDrawing()
```typescript
finishDrawing(): UniversalPolygon | null
```

##### setMode()
```typescript
setMode(mode: PolygonType): void
```

##### getPolygons()
```typescript
getPolygons(): UniversalPolygon[]
```

##### getPolygonsByType()
```typescript
getPolygonsByType(type: PolygonType): UniversalPolygon[]
```

##### deletePolygon()
```typescript
deletePolygon(id: string): boolean
```

##### clearAll()
```typescript
clearAll(): void
```

##### exportAsGeoJSON()
```typescript
exportAsGeoJSON(): GeoJSON.FeatureCollection
```

##### addPolygonToMap()
```typescript
addPolygonToMap(polygon: UniversalPolygon): void
```

##### removePolygonFromMap()
```typescript
removePolygonFromMap(polygonId: string): void
```

## 🪝 React Hooks

### usePolygonSystem()

#### Parameters
```typescript
interface UsePolygonSystemOptions {
  autoInit?: boolean;
  debug?: boolean;
  defaultMode?: PolygonType;
  autoSave?: boolean;
  storageKey?: string;
}
```

#### Returns
```typescript
interface UsePolygonSystemReturn {
  manager: GeoCanvasPolygonManager | null;
  polygons: UniversalPolygon[];
  currentMode: PolygonType;
  isDrawing: boolean;
  stats: {
    totalPolygons: number;
    byType: Record<PolygonType, number>;
  };

  // Actions
  initialize: (canvas: HTMLCanvasElement, map?: any) => void;
  startDrawing: (type?: PolygonType, style?: Partial<PolygonStyle>) => void;
  addPoint: (x: number, y: number, geoCoords?: { lng: number; lat: number }) => PolygonPoint | null;
  finishDrawing: () => UniversalPolygon | null;
  cancelDrawing: () => void;
  setMode: (mode: PolygonType) => void;
  deletePolygon: (id: string) => boolean;
  clearAll: () => void;

  // Export/Import
  exportAsGeoJSON: () => GeoJSON.FeatureCollection;
  exportByType: (type: PolygonType) => GeoJSON.FeatureCollection;
  importFromGeoJSON: (geojson: GeoJSON.FeatureCollection) => { imported: number; errors: string[] };

  // Map integration
  addPolygonToMap: (polygon: UniversalPolygon) => void;
  removePolygonFromMap: (polygonId: string) => void;

  // Utilities
  getPolygon: (id: string) => UniversalPolygon | null;
  getPolygonsByType: (type: PolygonType) => UniversalPolygon[];
}
```

## 🎯 Constants

### DEFAULT_POLYGON_STYLES
```typescript
const DEFAULT_POLYGON_STYLES: Record<PolygonType, PolygonStyle>
```
Default styling για κάθε polygon type.

### TRANSFORMATION_QUALITY_THRESHOLDS
```typescript
const TRANSFORMATION_QUALITY_THRESHOLDS = {
  excellent: 0.5,   // < 0.5m
  good: 2.0,        // < 2.0m
  fair: 5.0,        // < 5.0m
  // poor: >= 5.0m
} as const;
```

### MIN_CONTROL_POINTS
```typescript
const MIN_CONTROL_POINTS = 3;
```
Minimum control points για affine transformation.

## 📱 Event Handling

### Keyboard Shortcuts

**Drawing Mode:**
- `Click` - Add point
- `Right-click` - Close polygon (3+ points)
- `Enter` - Finish drawing
- `Escape` - Cancel drawing
- `Backspace` - Remove last point

**Mode Switching:**
- `1` - Simple mode
- `2` - Georeferencing mode
- `3` - Alert-zone mode
- `4` - Measurement mode
- `5` - Annotation mode

**Global:**
- `Ctrl+S` / `Cmd+S` - Save to storage
- `Ctrl+Z` / `Cmd+Z` - Undo last point

## 🚨 Error Handling

### Common Errors

#### PolygonValidationError
```typescript
class PolygonValidationError extends Error {
  constructor(message: string, public polygon: UniversalPolygon) {
    super(message);
  }
}
```

#### TransformationError
```typescript
class TransformationError extends Error {
  constructor(message: string, public controlPoints: number) {
    super(message);
  }
}
```

### Error Codes
- `INSUFFICIENT_POINTS` - Less than minimum required points
- `INVALID_COORDINATES` - NaN or Infinite coordinates
- `SELF_INTERSECTION` - Polygon self-intersects
- `COLLINEAR_POINTS` - Control points are collinear
- `TRANSFORMATION_FAILED` - Matrix calculation failed

---

*📚 Complete API Reference | 🏢 Enterprise Grade | 🎯 Production Ready*