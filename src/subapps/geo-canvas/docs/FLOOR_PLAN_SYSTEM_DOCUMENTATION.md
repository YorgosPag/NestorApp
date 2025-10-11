# 🏗️ FLOOR PLAN SYSTEM - ΠΛΗΡΗΣ ΤΕΚΜΗΡΙΩΣΗ

**Enterprise Floor Plan Upload & Georeferencing System**

---

## 📋 ΠΕΡΙΕΧΟΜΕΝΑ

1. [🎯 Επισκόπηση Συστήματος](#overview)
2. [🏗️ Αρχιτεκτονική](#architecture)
3. [📦 Components](#components)
4. [🔄 Parsers](#parsers)
5. [🛠️ Utils](#utils)
6. [📊 Types](#types)
7. [✅ Implementation Status](#status)
8. [🐛 Known Issues](#issues)

---

## 🎯 ΕΠΙΣΚΟΠΗΣΗ ΣΥΣΤΗΜΑΤΟΣ {#overview}

### Τι είναι το Floor Plan System

Το **Floor Plan System** επιτρέπει στους χρήστες να ανεβάζουν κατόψεις (DXF, DWG, PNG, JPG, PDF, TIFF) για georeferencing στο Geo-Canvas platform.

### Βασικές Λειτουργίες

#### 📤 **File Upload**
- Drag & Drop interface
- Multiple format support (DXF, DWG, PNG, JPG, PDF, TIFF)
- File validation & error handling
- Progress indicators

#### 📐 **Vector Parsing (DXF/DWG)**
- DXF entity parsing (LINE, ARC, CIRCLE, POLYLINE, TEXT)
- GeoJSON conversion
- Layer extraction
- Bounds calculation
- Thumbnail generation

#### 🖼️ **Raster Parsing (Images)**
- Image validation
- EXIF metadata extraction
- Dimension detection
- Thumbnail generation

#### 🔍 **Preview System**
- Thumbnail preview (400×400px)
- File metadata display
- DXF-specific info (entities, layers, dimensions)
- Image-specific info (resolution, size)

---

## 🏗️ ΑΡΧΙΤΕΚΤΟΝΙΚΗ {#architecture}

### System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     FLOOR PLAN SYSTEM                           │
├─────────────────────────────────────────────────────────────────┤
│                        UI LAYER                                 │
│  ┌─────────────────┬──────────────────┬─────────────────────┐   │
│  │  Upload Button  │   Upload Modal   │    Preview Display  │   │
│  │  (Trigger)      │   (Dialog)       │    (Metadata)       │   │
│  └─────────────────┴──────────────────┴─────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│                      PARSER LAYER                               │
│  ┌─────────────────┬──────────────────┬─────────────────────┐   │
│  │  DxfParser      │   DwgParser      │   ImageParser       │   │
│  │  (Vector)       │   (Vector)       │   (Raster)          │   │
│  └─────────────────┴──────────────────┴─────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│                      UTILS LAYER                                │
│  ┌─────────────────┬──────────────────┬─────────────────────┐   │
│  │  Format         │   Thumbnail      │   File              │   │
│  │  Detection      │   Generator      │   Validation        │   │
│  └─────────────────┴──────────────────┴─────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### File Flow

```
User selects file
      ↓
Format Detection (detectFormat)
      ↓
  ┌───┴───────────────┐
  │                   │
DXF/DWG          PNG/JPG/PDF/TIFF
  │                   │
DxfParser         ImageParser
  │                   │
  └───┬───────────────┘
      ↓
ParserResult (success/error)
      ↓
Preview Display (thumbnail + metadata)
```

---

## 📦 COMPONENTS {#components}

### 1. FloorPlanUploadButton.tsx

**Purpose**: Trigger button για το upload modal

**Props**:
```typescript
interface FloorPlanUploadButtonProps {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}
```

**Features**:
- Icon: 📐 (floor plan symbol)
- Tooltip support
- Disabled state
- Custom styling support

**Location**: `floor-plan-system/components/FloorPlanUploadButton.tsx`

---

### 2. FloorPlanUploadModal.tsx

**Purpose**: Modal dialog για file upload & preview

**Props**:
```typescript
interface FloorPlanUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFileSelect: (file: File) => void;
  parserResult?: ParserResult | null;
  selectedFile?: File | null;
  isParsing?: boolean;
}
```

**States**:
1. **Upload Form** - Initial state, file selection
2. **Parsing** - Loading state during file parsing
3. **Preview** - Shows thumbnail & metadata after parsing

**Features**:
- Radix UI Dialog (enterprise-class)
- Drag & Drop support
- File input fallback
- Format validation
- Conditional rendering (upload/loading/preview)
- Close button (closes on preview, cancels on upload)

**Location**: `floor-plan-system/components/FloorPlanUploadModal.tsx`

**Critical Fix (2025-10-11)**:
- **Issue**: Modal was closing immediately after file selection
- **Cause**: Line 140 had `onClose()` call in `handleFileSelection`
- **Fix**: Removed `onClose()` to keep modal open for preview display

---

### 3. FloorPlanPreview.tsx

**Purpose**: Display parsed file preview & metadata

**Props**:
```typescript
interface FloorPlanPreviewProps {
  result: ParserResult;
  file: File;
  className?: string;
}
```

**Sections**:

#### A) Thumbnail Section
- Displays result.thumbnail (base64 data URL)
- Gray background, rounded border
- Fixed size: 400×400px (responsive)

#### B) File Info Card
- File name
- Format (DXF, PNG, etc.)
- File size (formatted: KB, MB)

#### C) DXF-Specific Metadata (only for DXF files)
- **Οντότητες**: Entity count (LINE, ARC, CIRCLE, etc.)
- **Επίπεδα**: Layer count
- **Χαρακτηριστικά**: GeoJSON feature count
- **Διαστάσεις**: Drawing bounds (width × height in meters)
- **Λίστα Επιπέδων**: Layer names (truncated if >10, with "Show all" button)

#### D) Image-Specific Metadata (only for images)
- **Διαστάσεις**: Width × Height pixels
- **Μέγεθος Αρχείου**: File size

**Location**: `floor-plan-system/components/FloorPlanPreview.tsx`

**Translations**: `i18n/locales/{en,el}/geo-canvas.json` → `floorPlan.preview.*`

---

## 🔄 PARSERS {#parsers}

### 1. DxfParser.ts

**Purpose**: Parse DXF files (AutoCAD Drawing Exchange Format)

**Library**: `dxf-parser` (npm package)

**Process**:
1. Read file as text
2. Parse με dxf-parser library
3. Extract entities (LINE, ARC, CIRCLE, POLYLINE, TEXT, MTEXT)
4. Extract layers
5. Convert to GeoJSON FeatureCollection
6. Calculate bounds
7. Generate thumbnail (400×400px)

**Supported Entities**:
- ✅ **LINE** → GeoJSON LineString
- ✅ **POLYLINE** → LineString or Polygon (if closed)
- ✅ **LWPOLYLINE** → LineString or Polygon
- ✅ **ARC** → LineString (32 segments approximation)
- ✅ **CIRCLE** → Polygon (64 segments approximation)
- ✅ **TEXT/MTEXT** → Point (not rendered in thumbnail - intentional)

**Entity Conversion Details**:

#### LINE Entity
```typescript
private lineToGeoJSON(entity: ILineEntity, properties: any): GeoJSON.Feature {
  const start = entity.vertices[0];
  const end = entity.vertices[1];

  return {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: [[start.x, start.y], [end.x, end.y]]
    },
    properties
  };
}
```

#### ARC Entity (with 0° crossing fix)
```typescript
private arcToGeoJSON(entity: IArcEntity, properties: any): GeoJSON.Feature {
  let startAngle = (entity.startAngle * Math.PI) / 180;
  let endAngle = (entity.endAngle * Math.PI) / 180;

  // Handle arcs that cross 0° (e.g., 350° to 10°)
  if (endAngle < startAngle) {
    endAngle += 2 * Math.PI;
  }

  // Generate 32 segments
  const angleStep = (endAngle - startAngle) / 32;
  // ... generate coordinates
}
```

**ParserResult**:
```typescript
{
  success: true,
  format: 'DXF',
  geoJSON: FeatureCollection,
  bounds: { minX, minY, maxX, maxY },
  layers: string[],
  entities: number,
  thumbnail: string // base64 data URL
}
```

**Location**: `floor-plan-system/parsers/vector/DxfParser.ts`

**Debug Logging**:
- Entity type counts (LINE: X, ARC: Y, etc.)
- Geometry type counts (LineString: X, Polygon: Y, Point: Z)
- ARC details (center, radius, angles, layer) - Added 2025-10-11
- CIRCLE details (center, radius, layer) - Added 2025-10-11

**Known Issues**:
- **Small ARCs (<10°)** may be invisible in thumbnail due to thin lines
- **TEXT entities** not rendered (would require font support)
- See [Known Issues](#issues) section

---

### 2. DwgParser.ts

**Purpose**: Parse DWG files (AutoCAD native format)

**Status**: ⚠️ **NOT IMPLEMENTED** (stub only)

**Reason**: DWG is proprietary format, requires paid library or server-side conversion

**Current Implementation**:
```typescript
export class DwgParser {
  async parse(file: File): Promise<ParserResult> {
    console.warn('⚠️ DWG parsing not yet implemented');
    return {
      success: false,
      format: 'DWG',
      errors: ['DWG parsing not yet implemented. Please convert to DXF format.']
    };
  }
}
```

**Future Options**:
1. Use `libredwg` (open-source, server-side)
2. Use commercial API (Autodesk Forge, etc.)
3. Prompt user to convert DWG → DXF in AutoCAD

**Location**: `floor-plan-system/parsers/vector/DwgParser.ts`

---

### 3. ImageParser.ts

**Purpose**: Parse raster images (PNG, JPG, PDF, TIFF)

**Status**: ⚠️ **PARTIALLY IMPLEMENTED**

**Current Implementation**:
```typescript
export class ImageParser {
  async parse(file: File): Promise<ParserResult> {
    // STEP A: Validate image
    const isValid = await this.validateImage(file);
    if (!isValid) {
      return { success: false, format: 'IMAGE', errors: ['Invalid image'] };
    }

    // STEP B: Read as data URL
    const dataUrl = await this.readAsDataURL(file);

    // STEP C: Get dimensions
    const dimensions = await this.getImageDimensions(dataUrl);

    return {
      success: true,
      format: 'IMAGE',
      thumbnail: dataUrl,
      metadata: {
        width: dimensions.width,
        height: dimensions.height
      }
    };
  }
}
```

**Missing Features**:
- EXIF metadata extraction
- PDF page extraction
- TIFF multi-page support
- GeoTIFF coordinate extraction

**Location**: `floor-plan-system/parsers/raster/ImageParser.ts`

---

## 🛠️ UTILS {#utils}

### 1. format-detection.ts

**Purpose**: Detect file format από extension

```typescript
export function detectFormat(file: File): FloorPlanFormat | null {
  const extension = file.name.split('.').pop()?.toLowerCase();

  switch (extension) {
    case 'dxf': return 'DXF';
    case 'dwg': return 'DWG';
    case 'png': return 'PNG';
    case 'jpg':
    case 'jpeg': return 'JPG';
    case 'pdf': return 'PDF';
    case 'tiff':
    case 'tif': return 'TIFF';
    default: return null;
  }
}
```

**Supported Formats**:
- **Vector**: DXF, DWG
- **Raster**: PNG, JPG/JPEG, PDF, TIFF/TIF

**Location**: `floor-plan-system/utils/format-detection.ts`

---

### 2. dxf-thumbnail-generator.ts

**Purpose**: Generate thumbnail preview από DXF GeoJSON data

**Options**:
```typescript
interface ThumbnailOptions {
  width?: number;           // Default: 400px
  height?: number;          // Default: 400px
  backgroundColor?: string; // Default: '#ffffff'
  strokeColor?: string;     // Default: '#000000'
  strokeWidth?: number;     // Default: 1
  padding?: number;         // Default: 20px
  quality?: number;         // Default: 0.9
}
```

**Process**:
1. Create HTML5 Canvas (400×400)
2. Fill background
3. Calculate scaling to fit drawing (με padding)
4. Calculate adaptive line width: `strokeWidth / scale`
5. Transform coordinate system (DXF Y↑ → Canvas Y↓)
6. Render GeoJSON features
7. Convert to base64 data URL

**Coordinate Transformation**:
```typescript
ctx.save();
ctx.translate(offsetX, offsetY);          // Center drawing
ctx.scale(scale, -scale);                 // Flip Y axis
ctx.translate(-bounds.minX, -bounds.maxY); // Move origin
// ... render features
ctx.restore();
```

**Adaptive Line Width** (Critical Feature):
```typescript
// Lines stay constant thickness in screen pixels
const adaptiveLineWidth = opts.strokeWidth / scale;
ctx.lineWidth = adaptiveLineWidth;
```

**Example**:
- Drawing: 21m × 15m
- Canvas: 400×400px (with 20px padding)
- Scale: 17.1429 (fits 21m → 360px)
- strokeWidth: 0.8
- adaptiveLineWidth: 0.8 / 17.1429 = **0.0467 drawing units** = **0.8px on screen**

**Rendered Geometry Types**:
- ✅ **LineString** - Rendered με ctx.stroke()
- ✅ **Polygon** - Rendered με ctx.stroke() (no fill)
- ❌ **Point** - Skipped (TEXT entities - would clutter drawing)

**Location**: `floor-plan-system/utils/dxf-thumbnail-generator.ts`

**Advanced Function**: `generateDxfThumbnailWithLayers()`
- Renders each layer με different color
- Takes `layerColors: Map<string, string>` parameter
- Useful για layer visualization

---

## 📊 TYPES {#types}

### FloorPlanFormat

```typescript
export type FloorPlanFormat =
  | 'DXF'
  | 'DWG'
  | 'PNG'
  | 'JPG'
  | 'PDF'
  | 'TIFF';
```

---

### ParserResult

```typescript
export interface ParserResult {
  success: boolean;
  format: FloorPlanFormat;

  // Success fields
  geoJSON?: GeoJSON.FeatureCollection;
  bounds?: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
  layers?: string[];
  entities?: number;
  thumbnail?: string; // base64 data URL
  metadata?: Record<string, any>;

  // Error fields
  errors?: string[];
}
```

**Success Example** (DXF):
```typescript
{
  success: true,
  format: 'DXF',
  geoJSON: { type: 'FeatureCollection', features: [...] },
  bounds: { minX: -21, minY: -15, maxX: 0, maxY: 0 },
  layers: ['COLOR_1', 'COLOR_10', ...],
  entities: 3262,
  thumbnail: 'data:image/png;base64,...'
}
```

**Error Example** (DWG):
```typescript
{
  success: false,
  format: 'DWG',
  errors: ['DWG parsing not yet implemented. Please convert to DXF.']
}
```

---

## ✅ IMPLEMENTATION STATUS {#status}

### Phase 1: Core Upload System (STEP 1.1-1.8)

#### STEP 1.1: Types & Interfaces ✅ **COMPLETE**
- [x] FloorPlanFormat type
- [x] ParserResult interface
- [x] Component props interfaces

#### STEP 1.2: Format Detection ✅ **COMPLETE**
- [x] detectFormat() function
- [x] Support για 6 formats (DXF, DWG, PNG, JPG, PDF, TIFF)

#### STEP 1.3: Basic Parsers ✅ **COMPLETE**
- [x] DxfParser (fully functional)
- [x] DwgParser (stub - not implemented)
- [x] ImageParser (basic implementation)

#### STEP 1.4: Upload Button ✅ **COMPLETE**
- [x] FloorPlanUploadButton component
- [x] Icon, styling, tooltip
- [x] Integration με GeoCanvasContent

#### STEP 1.5: Upload Modal ✅ **COMPLETE**
- [x] FloorPlanUploadModal component
- [x] Radix UI Dialog
- [x] Drag & Drop support
- [x] File input fallback
- [x] Format validation
- [x] Conditional rendering (upload/loading/preview)

#### STEP 1.6: Preview & Metadata ✅ **COMPLETE**
- [x] FloorPlanPreview component
- [x] Thumbnail display
- [x] File info card
- [x] DXF-specific metadata
- [x] Image-specific metadata
- [x] Layer list με truncation
- [x] Translations (EN/EL)
- [x] Modal workflow fix (stays open after upload)

**Critical Fix (2025-10-11)**:
- [x] Fixed modal closing issue (removed onClose() from handleFileSelection)
- [x] Changed footer button text (Cancel → Close when preview shown)

#### STEP 1.7: useFloorPlanUpload Hook ⏳ **PENDING**
- [ ] Custom hook για state management
- [ ] Upload workflow logic
- [ ] Error handling
- [ ] Progress tracking

#### STEP 1.8: Wire Everything Together ⏳ **PENDING**
- [ ] Complete integration με GeoCanvasContent
- [ ] Error boundaries
- [ ] Loading states
- [ ] Success notifications
- [ ] Error notifications

---

### Phase 2: Georeferencing Integration (Future)

#### STEP 2.1: Floor Plan Canvas Layer
- [ ] Render floor plan on separate canvas layer
- [ ] Overlay on MapLibre map
- [ ] Opacity control
- [ ] Show/hide toggle

#### STEP 2.2: Control Point System
- [ ] Place control points on floor plan
- [ ] Match με map coordinates
- [ ] Transformation calculation
- [ ] Accuracy validation

#### STEP 2.3: Transformation Application
- [ ] Apply affine transformation
- [ ] Real-time preview
- [ ] Save transformation matrix
- [ ] Export georeferenced data

---

## 🐛 KNOWN ISSUES {#issues}

### Issue #1: Small ARCs Not Visible in Thumbnail

**Problem**: ARCs με μικρές γωνίες (<10°) δεν φαίνονται στο thumbnail

**Example από _AfrPolGD.dxf**:
- ARC #1: 4.8° arc, radius 0.999m
- ARC #2: 4.8° arc, radius 1.001m
- ARC #3: 1.5° arc, radius 0.700m
- ARC #4: 1.5° arc, radius 0.800m

**Why**:
- Drawing size: 21m × 15m
- Thumbnail: 400×400px
- Scale: 17.1429
- strokeWidth: 0.8px → adaptive = 0.0467 drawing units
- Small arc (1.5°, 0.7m radius) = **~2-3 pixels** (barely visible)

**Possible Solutions**:
1. **Increase strokeWidth** globally (2.0-3.0px) - makes ALL lines thicker
2. **Adaptive stroke for small ARCs** - Only ARCs <10° get thicker stroke
3. **Zoom-in thumbnail** - Focus on area with ARCs
4. **Multiple thumbnails** - Full view + zoomed views

**Status**: ⏸️ **DEFERRED** (Γιώργος decided to postpone)

**Debug Logging Added** (2025-10-11):
```typescript
console.log('🔵 ARC Entity:', {
  center: `(${entity.center.x.toFixed(2)}, ${entity.center.y.toFixed(2)})`,
  radius: entity.radius.toFixed(3),
  startAngle: `${startDeg.toFixed(1)}°`,
  endAngle: `${endDeg.toFixed(1)}°`,
  angleDiff: `${angleDiff.toFixed(1)}°`,
  isFullCircle,
  layer: properties.layer
});
```

---

### Issue #2: TEXT Entities Not Rendered

**Problem**: TEXT/MTEXT entities δεν εμφανίζονται στο thumbnail

**Why**: **INTENTIONAL DECISION**
- TEXT rendering requires font support
- Canvas text API needs font family, size, rotation
- DXF text has complex styling (fonts, heights, angles)
- Would clutter technical drawings

**Current Behavior**:
- TEXT/MTEXT converted to GeoJSON Point
- Point geometry skipped in renderPoint() function
- Console shows Point count in geometry types

**Possible Solutions**:
1. **Skip** (current approach) - Clean technical drawings
2. **Render as "X" marks** - Simple visual indicator
3. **Full text rendering** - Complex, requires font library
4. **Text outline boxes** - Rectangle showing text bounds

**Status**: ⏸️ **DEFERRED** (Acceptable for now)

---

### Issue #3: DWG Format Not Supported

**Problem**: DWG files cannot be parsed

**Why**: DWG is proprietary AutoCAD format
- No reliable browser-based parser
- libredwg exists but requires server-side processing
- Commercial APIs (Autodesk Forge) are paid

**Workaround**: Ask users to convert DWG → DXF in AutoCAD

**Future Solutions**:
1. **Server-side conversion** - libredwg backend service
2. **Cloud API** - Autodesk Forge integration
3. **User conversion** - Provide instructions for DWG→DXF

**Status**: ⏳ **FUTURE ENHANCEMENT**

---

### Issue #4: Image Parser Missing Features

**Problem**: ImageParser lacks EXIF, PDF, TIFF support

**Missing**:
- EXIF metadata extraction
- PDF page rendering
- TIFF multi-page support
- GeoTIFF coordinate extraction

**Status**: ⏳ **FUTURE ENHANCEMENT**

---

## 🎓 TECHNICAL INSIGHTS

### Why Adaptive Line Width?

**Problem**: Fixed lineWidth in canvas means:
- Small drawings → thick lines
- Large drawings → thin lines

**Solution**: Divide strokeWidth by scale
```typescript
const adaptiveLineWidth = strokeWidth / scale;
```

**Result**: Lines are **constant thickness in screen pixels** regardless of drawing size

**Example**:
- Drawing A: 1m × 1m, scale: 360 → lineWidth: 0.8/360 = 0.0022 → 0.8px screen
- Drawing B: 100m × 100m, scale: 3.6 → lineWidth: 0.8/3.6 = 0.222 → 0.8px screen

---

### Why Flip Y Axis?

**DXF Coordinate System**: Y increases **upward** (mathematical standard)
**Canvas Coordinate System**: Y increases **downward** (screen standard)

**Solution**: Negative scale on Y axis
```typescript
ctx.scale(scale, -scale); // Flip Y
```

---

### Why 32 Segments for ARCs?

**Trade-off**: Smoothness vs. Performance
- Too few segments (8): Jagged arcs
- Too many segments (128): Slow rendering

**Industry Standard**: 32-64 segments for arcs in CAD thumbnails

**Current**:
- ARC: 32 segments
- CIRCLE: 64 segments (smoother - full circle more noticeable)

---

## 📚 REFERENCES

### External Libraries
- **dxf-parser** - DXF parsing: https://www.npmjs.com/package/dxf-parser
- **Radix UI Dialog** - Modal component: https://www.radix-ui.com/primitives/docs/components/dialog

### Standards
- **DXF Format**: AutoCAD DXF Reference (Autodesk)
- **GeoJSON**: RFC 7946 - https://tools.ietf.org/html/rfc7946
- **HTML5 Canvas**: MDN Web Docs - https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API

---

## 🚀 NEXT STEPS

### Immediate (STEP 1.7-1.8)
1. Create `useFloorPlanUpload` hook
2. Complete integration με GeoCanvasContent
3. Add error boundaries
4. Add notifications (success/error)

### Phase 2 (Georeferencing)
1. Floor plan canvas layer
2. Control point placement
3. Transformation calculation
4. Export georeferenced data

### Future Enhancements
1. Fix small ARC visibility (adaptive stroke)
2. DWG support (server-side conversion)
3. Enhanced image parser (EXIF, PDF, TIFF)
4. Layer color customization
5. Multiple thumbnail views
6. Text rendering (optional)

---

**Last Updated**: 2025-10-11
**Author**: Claude & Γιώργος
**Status**: STEP 1.6 Complete, STEP 1.7-1.8 Pending

---

## 🔧 RECENT UPDATES (2025-10-11)

### ✅ **TRANSFORMATION CONSTANTS & TYPES ADDITION**

**Problem Fixed**: Missing export errors για geo-canvas transformation system
```
- MIN_CONTROL_POINTS is not exported from '../types'
- TRANSFORMATION_QUALITY_THRESHOLDS is not exported from '../types'
```

**Added to `types.ts`**:
- `MIN_CONTROL_POINTS = 3` - Minimum control points για transformation
- `TRANSFORMATION_QUALITY_THRESHOLDS` - Quality assessment thresholds
- `FloorPlanControlPoint` interface - Control point structure
- `AffineTransformMatrix` interface - 2D transformation matrix
- `TransformationResult` interface - Calculation results
- `TransformationOptions` interface - Configuration options
- `CoordinateTransformer` interface - Utility functions

**Files Updated**:
- `src/subapps/geo-canvas/floor-plan-system/types.ts` - Added constants & interfaces
- `src/subapps/geo-canvas/floor-plan-system/utils/transformation-calculator.ts` - Fixed property names (floorPlan → floor)
- `src/subapps/geo-canvas/floor-plan-system/hooks/useGeoTransformation.ts` - Updated imports

**Result**: All compilation errors resolved, dev server runs successfully

---
