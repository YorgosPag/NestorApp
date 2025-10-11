# 🗺️ FLOOR PLAN INTEGRATION - COMPLETE IMPLEMENTATION ROADMAP

**Comprehensive Guide για Floor Plan Upload, Georeferencing, και Integration**

**Created**: 2025-10-10
**Status**: Master Implementation Guide
**Scope**: ALL formats (DXF, DWG, PDF, PNG, JPG, TIFF)

---

## 📋 TABLE OF CONTENTS

1. [Executive Summary](#executive-summary)
2. [User Workflow - Complete Journey](#user-workflow)
3. [Technical Architecture](#technical-architecture)
4. [Phase-by-Phase Implementation](#phase-implementation)
5. [Format-Specific Handling](#format-handling)
6. [Georeferencing Deep Dive](#georeferencing)
7. [Coordinate System Transformation](#transformation)
8. [UI/UX Specifications](#ui-ux)
9. [Edge Cases & Error Handling](#edge-cases)
10. [Testing Strategy](#testing)
11. [Performance Optimization](#performance)

---

## 🎯 EXECUTIVE SUMMARY {#executive-summary}

### **Τι κάνουμε;**
Επιτρέπουμε στον χρήστη να **φορτώσει αρχιτεκτονικές κατόψεις** (floor plans) σε διάφορα formats και να τις **τοποθετήσει** πάνω στον **παγκόσμιο χάρτη** (MapLibre GL JS) με **γεωγραφική ακρίβεια**.

### **Γιατί;**
- **Σχεδιασμός πολυγώνων ιδιοκτησιών** πάνω στην κάτοψη
- **Συσχέτιση αρχιτεκτονικών σχεδίων** με πραγματικές GPS συντεταγμένες
- **Οπτικοποίηση ορόφων κτιρίων** με πολλές ιδιοκτησίες (διαμερίσματα, γραφεία)

### **Πώς;**
1. **Upload** - Χρήστης ανεβάζει DXF/PNG/JPG/etc.
2. **Parse** - Αναλύουμε το αρχείο
3. **Georeference** - Χρήστης επιλέγει 3-4 control points (DXF ↔ GPS)
4. **Transform** - Υπολογίζουμε transformation matrix
5. **Render** - Εμφανίζουμε την κάτοψη πάνω στο χάρτη
6. **Interact** - Χρήστης σχεδιάζει πολύγωνα ιδιοκτησιών

---

## 👤 USER WORKFLOW - COMPLETE JOURNEY {#user-workflow}

### **🎯 COMPLETE USER JOURNEY (30 Steps)**

```
START: Χρήστης έχει DXF κάτοψη ορόφου με πολλά διαμερίσματα
  ↓
┌────────────────────────────────────────────────────────────────┐
│ PHASE 1: UPLOAD & PARSE                                       │
└────────────────────────────────────────────────────────────────┘
Step 1:  Χρήστης κάνει click "📁 Upload Floor Plan" button (Top Bar)
Step 2:  Ανοίγει File Picker dialog
Step 3:  Χρήστης επιλέγει αρχείο (π.χ., "Floor_3_Apartment_Building.dxf")
Step 4:  System auto-detects format: "DXF detected"
Step 5:  Εμφανίζεται loading spinner: "Parsing DXF file..."
Step 6:  Parser αναλύει DXF entities (lines, polylines, text, etc.)
Step 7:  Εμφανίζεται preview thumbnail της κάτοψης
Step 8:  System εμφανίζει metadata:
         - Format: DXF
         - Layers: WALLS, DOORS, WINDOWS, TEXT (20 entities)
         - Bounds: x: 0-50m, y: 0-30m
Step 9:  Χρήστης βλέπει success notification: "DXF parsed successfully! ✅"

┌────────────────────────────────────────────────────────────────┐
│ PHASE 2: GEOREFERENCING WORKFLOW                              │
└────────────────────────────────────────────────────────────────┘
Step 10: System εμφανίζει modal: "Georeference Floor Plan"
         ┌─────────────────────────────────────────────────────┐
         │ 🎯 Georeferencing Wizard                            │
         │                                                      │
         │ To place this floor plan on the map, select 3-4     │
         │ matching points between the DXF and the real map.   │
         │                                                      │
         │ [Start Georeferencing] [Cancel]                     │
         └─────────────────────────────────────────────────────┘

Step 11: Χρήστης click "Start Georeferencing"
Step 12: UI splits σε 2 panels:
         ┌─────────────────┬─────────────────┐
         │ DXF PREVIEW     │ MAP VIEW        │
         │ (Static image)  │ (Interactive)   │
         │                 │                 │
         │ [Floor plan]    │ [World map]     │
         │                 │                 │
         │ Click corners!  │ Click matching! │
         └─────────────────┴─────────────────┘

Step 13: Instruction: "Click top-left corner of building in DXF"
Step 14: Χρήστης κάνει click στο DXF preview (π.χ., x:0, y:30)
Step 15: System marks point με κόκκινο cross: "❌ DXF Point 1"
Step 16: Instruction: "Now click the same corner on the map"
Step 17: Χρήστης ψάχνει το κτίριο στο OpenStreetMap
Step 18: Χρήστης κάνει zoom in στο κτίριο (zoom level 19-20)
Step 19: Χρήστης κάνει click στη γωνία (lng: 23.7275, lat: 37.9838)
Step 20: System marks point με πράσινο marker: "✅ GPS Point 1"
Step 21: System draws line connecting DXF Point 1 ↔ GPS Point 1

Step 22: Repeat Steps 13-21 για Point 2 (top-right corner)
Step 23: Repeat Steps 13-21 για Point 3 (bottom-right corner)
Step 24: (Optional) Repeat για Point 4 (bottom-left corner)

Step 25: System calculates transformation matrix:
         - Translation: (tx, ty)
         - Rotation: θ degrees
         - Scale: (sx, sy)
         - Transformation method: Affine

Step 26: System εμφανίζει accuracy assessment:
         ┌─────────────────────────────────────────────────────┐
         │ ✅ Georeferencing Complete!                         │
         │                                                      │
         │ Accuracy Metrics:                                   │
         │ • RMS Error: ±0.8m                                  │
         │ • Max Error: ±1.2m                                  │
         │ • Confidence: 95%                                   │
         │ • Grade: A (Survey-grade)                           │
         │                                                      │
         │ [Accept & Place] [Retry] [Cancel]                  │
         └─────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│ PHASE 3: FLOOR PLAN RENDERING                                 │
└────────────────────────────────────────────────────────────────┘
Step 27: Χρήστης click "Accept & Place"
Step 28: System calculates geographic bounds:
         - North: 37.9848 lat
         - South: 37.9828 lat
         - East: 23.7285 lng
         - West: 23.7275 lng
         - Corners: [NW, NE, SE, SW] coordinates

Step 29: System renders floor plan πάνω στο χάρτη:
         ┌─────────────────────────────────────────────────────┐
         │ 🗺️ MAP VIEW                                         │
         │                                                      │
         │ [OpenStreetMap base layer - gray]                   │
         │                                                      │
         │     [Floor Plan overlay - semi-transparent]         │
         │     Opacity: 80%                                    │
         │     Z-Index: 100 (above base map, below polygons)   │
         │                                                      │
         │ User can now see:                                   │
         │ • Building outline                                  │
         │ • Apartment walls                                   │
         │ • Doors & windows                                   │
         │ • Room labels                                       │
         └─────────────────────────────────────────────────────┘

Step 30: Success notification: "Floor plan placed successfully! 🎉"
         - Layer added: "Floor_3_Apartment_Building.dxf"
         - Opacity: 80%
         - Visible: ✅

┌────────────────────────────────────────────────────────────────┐
│ PHASE 4: PROPERTY POLYGON DRAWING                             │
└────────────────────────────────────────────────────────────────┘
Step 31: Χρήστης κάνει enable "Draw Polygon" mode
Step 32: Χρήστης κάνει click γύρω από διαμέρισμα #1 (Studio)
         - Click 1: Πάνω αριστερά γωνία
         - Click 2: Πάνω δεξιά γωνία
         - Click 3: Κάτω δεξιά γωνία
         - Click 4: Κάτω αριστερά γωνία
         - Click on first point: CLOSE POLYGON ✅

Step 33: System calculates polygon area: "32.5 m²"
Step 34: Χρήστης εισάγει metadata:
         - Property Type: Studio
         - Floor: 3
         - Unit Number: 301
         - Owner: [optional]
         - Price: [optional]

Step 35: Repeat Steps 31-34 για όλα τα διαμερίσματα

END: Χρήστης έχει πλήρη κάτοψη με georeferenced floor plan + polygons!
```

---

## 🏗️ TECHNICAL ARCHITECTURE {#technical-architecture}

### **🎨 LAYER STACK (MapLibre GL JS)**

```
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 5 (TOP): 🎯 Active Drawing Tools                         │
│  - Z-Index: 10000                                               │
│  - Crosshair, ruler, measurement tools                          │
├─────────────────────────────────────────────────────────────────┤
│ LAYER 4: 🟢 Property Polygons (Interactive)                    │
│  - Z-Index: 9999                                                │
│  - Control points (red/green bouncing)                          │
│  - Polygon lines (blue dashed → green solid)                   │
│  - Click-to-close functionality                                 │
│  - GeoJSON Source + Fill/Line Layers                           │
├─────────────────────────────────────────────────────────────────┤
│ LAYER 3: 🏗️ Floor Plan Overlay (Georeferenced)                │
│  - Z-Index: 100                                                 │
│  - Opacity: 0.7-0.9 (semi-transparent)                         │
│  - 2 Rendering Options:                                         │
│    A) Raster: Image Source (PNG/JPG/TIFF/PDF)                  │
│    B) Vector: GeoJSON Source (DXF/DWG entities)                │
├─────────────────────────────────────────────────────────────────┤
│ LAYER 2: 🗺️ Georeferencing Markers (Temporary)                │
│  - Z-Index: 50                                                  │
│  - Control point markers (during georeferencing only)           │
│  - Lines connecting DXF ↔ GPS points                           │
│  - Removed after georeferencing complete                        │
├─────────────────────────────────────────────────────────────────┤
│ LAYER 1 (BOTTOM): 🗺️ Base Map (OpenStreetMap/Satellite)       │
│  - Z-Index: 0                                                   │
│  - Tile source (vector or raster)                              │
│  - CartoDB Positron, Satellite, Dark, etc.                     │
└─────────────────────────────────────────────────────────────────┘
```

### **📦 DATA FLOW**

```
┌─────────────┐
│   USER      │
│   UPLOADS   │
│   FILE      │
└──────┬──────┘
       │
       ↓
┌──────────────────────────────────────────────────────────────┐
│ 1. FILE UPLOAD & FORMAT DETECTION                           │
│    - detectFormat(file) → 'DXF' | 'PNG' | etc.             │
│    - Validate file size (< 50MB)                            │
│    - Check mime type                                         │
└──────┬──────────────────────────────────────────────────────┘
       │
       ↓
┌──────────────────────────────────────────────────────────────┐
│ 2. PARSING (Format-Specific)                                │
│    ┌──────────────┬───────────────────────────────────────┐ │
│    │ DXF/DWG      │ → DxfParser.parse()                   │ │
│    │ (Vector)     │   → Extract entities (lines, text)    │ │
│    │              │   → Convert to GeoJSON                 │ │
│    ├──────────────┼───────────────────────────────────────┤ │
│    │ PNG/JPG/TIFF │ → ImageParser.parse()                 │ │
│    │ (Raster)     │   → Load image με Image API           │ │
│    │              │   → Generate thumbnail                 │ │
│    │              │   → Optimize large images              │ │
│    ├──────────────┼───────────────────────────────────────┤ │
│    │ PDF          │ → PdfParser.parse()                   │ │
│    │ (Document)   │   → pdf.js rendering to canvas        │ │
│    │              │   → Export as PNG                      │ │
└──────┬──────────────────────────────────────────────────────┘
       │
       ↓
┌──────────────────────────────────────────────────────────────┐
│ 3. GEOREFERENCING WORKFLOW                                  │
│    A. User selects control points:                          │
│       - DXF Point 1 (x, y) ↔ GPS Point 1 (lng, lat)        │
│       - DXF Point 2 (x, y) ↔ GPS Point 2 (lng, lat)        │
│       - DXF Point 3 (x, y) ↔ GPS Point 3 (lng, lat)        │
│       - [Optional] DXF Point 4 ↔ GPS Point 4               │
│                                                              │
│    B. Calculate Transformation Matrix:                      │
│       - Method: Affine (default) | Polynomial | TPS         │
│       - Translation: (tx, ty)                               │
│       - Rotation: θ radians                                 │
│       - Scale: (sx, sy)                                     │
│       - Shear/Skew: optional                                │
│                                                              │
│    C. Validation:                                           │
│       - Calculate RMS error                                 │
│       - Check accuracy grade (A/B/C/D/F)                    │
│       - Warn if accuracy poor                               │
└──────┬──────────────────────────────────────────────────────┘
       │
       ↓
┌──────────────────────────────────────────────────────────────┐
│ 4. COORDINATE TRANSFORMATION                                │
│    For EVERY point (x, y) in DXF:                           │
│                                                              │
│    Geographic coords = TransformMatrix × DXF coords         │
│                                                              │
│    [lng]   [a  b  c]   [x]                                  │
│    [lat] = [d  e  f] × [y]                                  │
│    [1  ]   [0  0  1]   [1]                                  │
│                                                              │
│    Calculate Geographic Bounds:                             │
│    - minLng, maxLng                                         │
│    - minLat, maxLat                                         │
│    - corners: [NW, NE, SE, SW]                              │
└──────┬──────────────────────────────────────────────────────┘
       │
       ↓
┌──────────────────────────────────────────────────────────────┐
│ 5. MAP LAYER RENDERING                                      │
│    ┌──────────────┬───────────────────────────────────────┐ │
│    │ Vector (DXF) │ → MapLibre GeoJSON Source             │ │
│    │              │   <Source type="geojson">             │ │
│    │              │     <Layer type="line" />             │ │
│    │              │     <Layer type="fill" />             │ │
│    │              │   </Source>                            │ │
│    ├──────────────┼───────────────────────────────────────┤ │
│    │ Raster (IMG) │ → MapLibre Image Source               │ │
│    │              │   <Source type="image"                │ │
│    │              │     url={imageUrl}                    │ │
│    │              │     coordinates={bounds.corners}      │ │
│    │              │   >                                    │ │
│    │              │     <Layer type="raster"              │ │
│    │              │       paint={{ opacity: 0.8 }}        │ │
│    │              │     />                                 │ │
│    │              │   </Source>                            │ │
└──────┬──────────────────────────────────────────────────────┘
       │
       ↓
┌──────────────────────────────────────────────────────────────┐
│ 6. USER INTERACTION                                         │
│    - Adjust opacity (slider 0-100%)                         │
│    - Toggle visibility (checkbox)                           │
│    - Adjust z-index (up/down arrows)                        │
│    - Draw property polygons (click-to-draw)                │
│    - Edit georeferencing (re-select control points)         │
│    - Remove layer (delete button)                           │
└──────────────────────────────────────────────────────────────┘
```

---

## 🎯 PHASE-BY-PHASE IMPLEMENTATION {#phase-implementation}

### **📅 PHASE 1: Upload & Parse (DXF Only)**

**Goal**: Χρήστης μπορεί να ανεβάσει DXF file και να δει preview

**Duration**: 2-3 hours

---

#### **STEP 1.1: Create FloorPlanUploadButton Component**

**Goal**: Top Bar button για floor plan upload

**Sub-Steps**:
1. **1.1.1** - Search for existing TopBar/Header component
   - Find: `src/components/header/` ή `src/subapps/geo-canvas/components/header/`
   - Read: Current header structure
   - Identify: Where buttons are placed

2. **1.1.2** - Create `FloorPlanUploadButton.tsx`
   - Location: `src/subapps/geo-canvas/floor-plan-system/components/FloorPlanUploadButton.tsx`
   - Props: `onClick`, `disabled`, `loading`
   - Icon: 📁 (folder) ή 🏗️ (building)
   - Text: "Upload Floor Plan"
   - Styling: Match existing button styles

3. **1.1.3** - Add i18n support
   - Key: `geo-canvas:floorPlan.uploadButton`
   - Add translations: `en`, `el`, `pseudo`
   - Use: `useTranslation('geo-canvas')`

4. **1.1.4** - Integrate into Header/TopBar
   - Import: `FloorPlanUploadButton`
   - Place: Next to existing controls
   - Test: Click handler logs to console

**Files**:
```
floor-plan-system/components/FloorPlanUploadButton.tsx (new)
src/i18n/locales/en/geo-canvas.json (update)
src/i18n/locales/el/geo-canvas.json (update)
src/components/header/GeoCanvasHeader.tsx (update)
```

**Acceptance Criteria**:
- [ ] Button visible in Top Bar
- [ ] Click event fires
- [ ] Translations work (EN/EL)
- [ ] Matches existing button styles

---

#### **STEP 1.2: Create FloorPlanUploadModal Component**

**Goal**: Modal με drag-drop file upload

**Sub-Steps**:
1. **1.2.1** - Search for existing modal/dialog components
   - Look for: `Modal`, `Dialog`, `Sheet` components
   - Check: `src/subapps/geo-canvas/ui/design-system/` ή centralized UI
   - Decide: Reuse existing ή create new

2. **1.2.2** - Create `FloorPlanUploadModal.tsx`
   - Location: `src/subapps/geo-canvas/floor-plan-system/components/FloorPlanUploadModal.tsx`
   - Props: `isOpen`, `onClose`, `onFileSelect`
   - Features:
     - Drag-drop zone (react-dropzone ή native)
     - File picker button (fallback)
     - Supported formats list (DXF, DWG, PNG, JPG, TIFF, PDF)
     - File size limit warning (< 50MB)

3. **1.2.3** - Implement drag-drop functionality
   - Install: `react-dropzone` (if not exists)
   - Handle: `onDrop`, `onDragEnter`, `onDragLeave`
   - Visual feedback: Border color change on drag
   - Accept: `.dxf, .dwg, .png, .jpg, .jpeg, .tiff, .tif, .pdf`

4. **1.2.4** - Add validation
   - Check: File extension
   - Check: File size (< 50MB)
   - Check: MIME type
   - Error messages: Toast ή inline

5. **1.2.5** - Add i18n for modal
   - Keys: `uploadModal.title`, `uploadModal.dragText`, `uploadModal.formats`
   - Translations: EN/EL

**Files**:
```
floor-plan-system/components/FloorPlanUploadModal.tsx (new)
floor-plan-system/components/DragDropZone.tsx (new - optional)
src/i18n/locales/en/geo-canvas.json (update)
src/i18n/locales/el/geo-canvas.json (update)
package.json (install react-dropzone if needed)
```

**Acceptance Criteria**:
- [ ] Modal opens on button click
- [ ] Drag-drop works
- [ ] File picker button works
- [ ] File validation works (extension, size, MIME)
- [ ] Error messages shown για invalid files
- [ ] i18n works (EN/EL)

---

#### **STEP 1.3: Install DXF Parser Library**

**Goal**: Install και configure dxf-parser npm package

**Sub-Steps**:
1. **1.3.1** - Research DXF parsing libraries
   - Option A: `dxf-parser` (most popular)
   - Option B: `dxf` (alternative)
   - Decision: Choose `dxf-parser` (battle-tested)

2. **1.3.2** - Install library
   ```bash
   npm install dxf-parser
   npm install --save-dev @types/dxf-parser
   ```

3. **1.3.3** - Test basic import
   - Create test file: `parsers/vector/dxf-parser-test.ts`
   - Import: `import DxfParser from 'dxf-parser';`
   - Verify: No TypeScript errors

**Files**:
```
package.json (update)
package-lock.json (update)
floor-plan-system/parsers/vector/dxf-parser-test.ts (new - temporary test)
```

**Acceptance Criteria**:
- [ ] `dxf-parser` installed
- [ ] TypeScript types available
- [ ] Basic import works (no errors)

---

#### **STEP 1.4: Implement DxfParser.parse() Method**

**Goal**: Parse DXF file → Extract entities → Convert to GeoJSON

**Sub-Steps**:
1. **1.4.1** - Read current DxfParser placeholder
   - File: `floor-plan-system/parsers/vector/DxfParser.ts`
   - Understand: Current interface/types

2. **1.4.2** - Implement `parse()` method - Step A: Load DXF
   ```typescript
   async parse(file: File): Promise<DxfParserResult> {
     // A1. Read file as text
     const text = await file.text();

     // A2. Parse με dxf-parser library
     const parser = new DxfParser();
     const dxf = parser.parseSync(text);

     // A3. Handle parsing errors
     if (!dxf) throw new Error('DXF parsing failed');
   }
   ```

3. **1.4.3** - Implement `parse()` method - Step B: Extract Entities
   ```typescript
   // B1. Extract layers
   const layers = this.extractLayers(dxf);

   // B2. Extract entities by type
   const lines = this.extractLines(dxf);
   const polylines = this.extractPolylines(dxf);
   const arcs = this.extractArcs(dxf);
   const circles = this.extractCircles(dxf);
   const texts = this.extractTexts(dxf);
   ```

4. **1.4.4** - Implement `parse()` method - Step C: Convert to GeoJSON
   ```typescript
   // C1. Convert entities to GeoJSON features
   const features = this.entitiesToGeoJSON({
     lines,
     polylines,
     arcs,
     circles,
     texts
   });

   // C2. Create FeatureCollection
   const geoJSON: GeoJSON.FeatureCollection = {
     type: 'FeatureCollection',
     features
   };
   ```

5. **1.4.5** - Implement `parse()` method - Step D: Calculate Bounds
   ```typescript
   // D1. Calculate local coordinate bounds
   const bounds = this.calculateBounds(features);

   // D2. Extract metadata
   const metadata = {
     layers: layers.map(l => l.name),
     entityCount: features.length,
     bounds
   };
   ```

6. **1.4.6** - Implement helper methods
   - `extractLayers(dxf)` - Get layer list
   - `extractLines(dxf)` - LINE entities
   - `extractPolylines(dxf)` - POLYLINE/LWPOLYLINE entities
   - `extractArcs(dxf)` - ARC entities (convert to line segments)
   - `extractCircles(dxf)` - CIRCLE entities (convert to polygon)
   - `extractTexts(dxf)` - TEXT/MTEXT entities
   - `entitiesToGeoJSON(entities)` - Convert all to GeoJSON
   - `calculateBounds(features)` - Get bbox

**Files**:
```
floor-plan-system/parsers/vector/DxfParser.ts (implement)
floor-plan-system/types/index.ts (update if needed)
```

**Acceptance Criteria**:
- [ ] DXF file loaded as text
- [ ] dxf-parser library parses successfully
- [ ] Entities extracted (lines, polylines, arcs, circles, text)
- [ ] GeoJSON FeatureCollection created
- [ ] Bounds calculated
- [ ] Metadata extracted (layers, entity count)

---

#### **STEP 1.5: Generate Thumbnail Preview**

**Goal**: Create thumbnail image από DXF entities για preview

**Sub-Steps**:
1. **1.5.1** - Create `DxfThumbnailGenerator` utility
   - Location: `floor-plan-system/utils/thumbnail-generator.ts`
   - Method: `generateThumbnail(geoJSON, width, height)`

2. **1.5.2** - Implement canvas rendering
   ```typescript
   // A. Create offscreen canvas
   const canvas = document.createElement('canvas');
   canvas.width = width;
   canvas.height = height;
   const ctx = canvas.getContext('2d');

   // B. Calculate scale to fit bounds
   const scale = this.calculateScale(bounds, width, height);

   // C. Render entities
   features.forEach(feature => {
     if (feature.geometry.type === 'LineString') {
       this.drawLineString(ctx, feature.geometry, scale);
     }
     // ... other types
   });

   // D. Convert to data URL
   return canvas.toDataURL('image/png');
   ```

3. **1.5.3** - Handle different entity types
   - LineString → `ctx.lineTo()`
   - Polygon → `ctx.fill()`
   - Point (text) → `ctx.fillText()`

4. **1.5.4** - Add styling
   - Line color: από layer color ή default black
   - Line width: 1-2px
   - Background: White ή transparent

**Files**:
```
floor-plan-system/utils/thumbnail-generator.ts (new)
floor-plan-system/parsers/vector/DxfParser.ts (update - call thumbnail generator)
```

**Acceptance Criteria**:
- [ ] Thumbnail generated (PNG data URL)
- [ ] Entities visible (lines, polylines)
- [ ] Aspect ratio preserved
- [ ] Fits within thumbnail dimensions (200x200)

---

#### **STEP 1.6: Display Preview & Metadata in Modal**

**Goal**: Show thumbnail + metadata μετά το parsing

**Sub-Steps**:
1. **1.6.1** - Update `FloorPlanUploadModal` state
   ```typescript
   const [parsingStatus, setParsingStatus] = useState<'idle' | 'parsing' | 'success' | 'error'>('idle');
   const [parseResult, setParseResult] = useState<DxfParserResult | null>(null);
   ```

2. **1.6.2** - Add loading state UI
   - Spinner: "Parsing DXF file..."
   - Progress indicator (optional)

3. **1.6.3** - Add success state UI
   - Thumbnail preview (200x200)
   - Metadata panel:
     - Format: DXF
     - Layers: WALLS, DOORS, WINDOWS (count)
     - Entities: 1234
     - Bounds: x: 0-50m, y: 0-30m
   - "Next: Georeference" button

4. **1.6.4** - Add error state UI
   - Error message
   - "Try Again" button
   - Back to drag-drop

**Files**:
```
floor-plan-system/components/FloorPlanUploadModal.tsx (update)
floor-plan-system/components/DxfPreviewPanel.tsx (new)
```

**Acceptance Criteria**:
- [ ] Loading spinner shown during parsing
- [ ] Thumbnail visible after parsing
- [ ] Metadata displayed (format, layers, entities, bounds)
- [ ] Success notification shown
- [ ] Error handled gracefully

---

#### **STEP 1.7: Create useFloorPlanUpload Hook**

**Goal**: React hook για upload workflow state management

**Sub-Steps**:
1. **1.7.1** - Create hook file
   - Location: `floor-plan-system/hooks/useFloorPlanUpload.ts`

2. **1.7.2** - Implement hook
   ```typescript
   export function useFloorPlanUpload() {
     const [isModalOpen, setIsModalOpen] = useState(false);
     const [file, setFile] = useState<File | null>(null);
     const [parseResult, setParseResult] = useState(null);
     const [status, setStatus] = useState<'idle' | 'parsing' | 'success' | 'error'>('idle');

     const handleFileSelect = async (file: File) => {
       setFile(file);
       setStatus('parsing');

       try {
         const format = detectFormat(file);
         const parser = await getParser(format);
         const result = await parser.parse(file);

         setParseResult(result);
         setStatus('success');
       } catch (error) {
         setStatus('error');
         toast.error('Parsing failed');
       }
     };

     return {
       isModalOpen,
       openModal: () => setIsModalOpen(true),
       closeModal: () => setIsModalOpen(false),
       handleFileSelect,
       parseResult,
       status
     };
   }
   ```

**Files**:
```
floor-plan-system/hooks/useFloorPlanUpload.ts (new)
```

**Acceptance Criteria**:
- [ ] Hook manages modal state
- [ ] Hook handles file selection
- [ ] Hook calls parser
- [ ] Hook manages parsing status
- [ ] Hook provides clean API

---

#### **STEP 1.8: Wire Everything Together**

**Goal**: Connect button → modal → parser → preview

**Sub-Steps**:
1. **1.8.1** - Update `FloorPlanUploadButton`
   ```typescript
   const { openModal } = useFloorPlanUpload();
   return <button onClick={openModal}>Upload Floor Plan</button>;
   ```

2. **1.8.2** - Update `FloorPlanUploadModal`
   ```typescript
   const { isModalOpen, closeModal, handleFileSelect, parseResult, status } = useFloorPlanUpload();
   ```

3. **1.8.3** - Add to Geo-Canvas app
   - Import: `FloorPlanUploadButton`
   - Place: In header/top bar
   - Test: Full workflow

**Files**:
```
floor-plan-system/components/FloorPlanUploadButton.tsx (update)
floor-plan-system/components/FloorPlanUploadModal.tsx (update)
src/subapps/geo-canvas/GeoCanvasApp.tsx (update)
```

**Acceptance Criteria**:
- [ ] Button click opens modal
- [ ] File drop triggers parsing
- [ ] Preview shows after parsing
- [ ] Close modal resets state
- [ ] Full workflow works end-to-end

---

**PHASE 1 - TOTAL FILES**:
```
✅ Components (3):
   - FloorPlanUploadButton.tsx
   - FloorPlanUploadModal.tsx
   - DxfPreviewPanel.tsx

✅ Parsers (1):
   - DxfParser.ts (implement)

✅ Hooks (1):
   - useFloorPlanUpload.ts

✅ Utils (1):
   - thumbnail-generator.ts

✅ i18n (2):
   - en/geo-canvas.json (update)
   - el/geo-canvas.json (update)

✅ Integration (1):
   - GeoCanvasApp.tsx (update)
```

**PHASE 1 - ACCEPTANCE CRITERIA**:
- [ ] ✅ Χρήστης κάνει click "Upload Floor Plan" button (Top Bar)
- [ ] ✅ Modal ανοίγει με drag-drop area
- [ ] ✅ DXF file selected → parsing starts (loading spinner)
- [ ] ✅ Thumbnail preview εμφανίζεται
- [ ] ✅ Metadata shown (format, layers, entities, bounds)
- [ ] ✅ Success notification
- [ ] ✅ No TypeScript errors
- [ ] ✅ No runtime errors

---

### **📅 PHASE 2: Georeferencing Workflow**

**Goal**: Χρήστης μπορεί να επιλέξει control points και να georeference την κάτοψη

**Duration**: 3-4 hours

---

#### **STEP 2.1: Create Transformation Matrix Calculator**

**Goal**: Core math για coordinate transformation (DXF → GPS)

**Sub-Steps**:
1. **2.1.1** - Create utility file
   - Location: `floor-plan-system/utils/transformation-matrix-calculator.ts`

2. **2.1.2** - Implement affine transformation
   ```typescript
   // Affine transformation: 6 parameters (a, b, c, d, e, f)
   // [lng]   [a  b  c]   [x]
   // [lat] = [d  e  f] × [y]
   // [1  ]   [0  0  1]   [1]

   export function calculateAffineTransform(
     controlPoints: Array<{ dxf: {x, y}, gps: {lng, lat} }>
   ): TransformMatrix {
     // Minimum 3 points για affine
     // Solve linear system με least squares
   }
   ```

3. **2.1.3** - Implement RMS error calculation
   ```typescript
   export function calculateRMSError(
     controlPoints: ControlPoint[],
     transform: TransformMatrix
   ): number {
     // Root Mean Square error (meters)
   }
   ```

4. **2.1.4** - Implement accuracy grading
   ```typescript
   export function getAccuracyGrade(rmsError: number): 'A' | 'B' | 'C' | 'D' | 'F' {
     if (rmsError < 1.0) return 'A'; // Survey-grade
     if (rmsError < 2.0) return 'B'; // High accuracy
     if (rmsError < 5.0) return 'C'; // Good
     if (rmsError < 10.0) return 'D'; // Fair
     return 'F'; // Poor
   }
   ```

**Files**:
```
floor-plan-system/utils/transformation-matrix-calculator.ts (new)
```

**Acceptance Criteria**:
- [ ] Affine transformation math implemented
- [ ] RMS error calculation works
- [ ] Accuracy grading works
- [ ] Unit tests pass (3 control points → matrix)

---

#### **STEP 2.2: Create GeoreferencingService**

**Goal**: Service για georeferencing state & transformation management

**Sub-Steps**:
1. **2.2.1** - Create service file
   - Location: `floor-plan-system/services/GeoreferencingService.ts`

2. **2.2.2** - Implement service class
   ```typescript
   export class GeoreferencingService {
     private controlPoints: GeoControlPoint[] = [];
     private transformMatrix: GeoTransformMatrix | null = null;

     addControlPoint(dxfPoint: {x, y}, gpsPoint: {lng, lat}) { }
     removeControlPoint(index: number) { }
     calculateTransformation() { }
     validateAccuracy() { }
     reset() { }
   }
   ```

3. **2.2.3** - Add validation logic
   - Check: Minimum 3 points
   - Check: Points not collinear
   - Check: GPS points within reasonable distance

**Files**:
```
floor-plan-system/services/GeoreferencingService.ts (new)
```

**Acceptance Criteria**:
- [ ] Service manages control points
- [ ] Transformation calculation works
- [ ] Validation works
- [ ] Reset works

---

#### **STEP 2.3: Create DxfPreviewPanel Component**

**Goal**: Static DXF preview με click-to-select control points

**Sub-Steps**:
1. **2.3.1** - Create component
   - Location: `floor-plan-system/components/DxfPreviewPanel.tsx`

2. **2.3.2** - Render DXF thumbnail
   ```typescript
   // Use thumbnail από DxfParser result
   <img src={parseResult.thumbnail} alt="DXF Preview" />
   ```

3. **2.3.3** - Add click handler
   ```typescript
   const handleClick = (event: React.MouseEvent) => {
     // Calculate click position relative to image
     const rect = event.currentTarget.getBoundingClientRect();
     const x = event.clientX - rect.left;
     const y = event.clientY - rect.top;

     // Convert to DXF coordinates (scale to actual bounds)
     const dxfX = (x / rect.width) * (bounds.maxX - bounds.minX) + bounds.minX;
     const dxfY = (y / rect.height) * (bounds.maxY - bounds.minY) + bounds.minY;

     onPointSelect({ x: dxfX, y: dxfY });
   };
   ```

4. **2.3.4** - Add visual markers
   ```typescript
   // Show red cross για selected points
   {controlPoints.map((point, i) => (
     <div
       key={i}
       className="marker"
       style={{
         left: `${(point.dxf.x - bounds.minX) / (bounds.maxX - bounds.minX) * 100}%`,
         top: `${(point.dxf.y - bounds.minY) / (bounds.maxY - bounds.minY) * 100}%`
       }}
     >
       ❌ {i + 1}
     </div>
   ))}
   ```

**Files**:
```
floor-plan-system/components/DxfPreviewPanel.tsx (new)
```

**Acceptance Criteria**:
- [ ] DXF thumbnail displayed
- [ ] Click handler fires
- [ ] DXF coordinates calculated correctly
- [ ] Markers shown at click positions

---

#### **STEP 2.4: Create MapControlPointSelector Component**

**Goal**: Interactive map για GPS point selection

**Sub-Steps**:
1. **2.4.1** - Create component
   - Location: `floor-plan-system/components/MapControlPointSelector.tsx`

2. **2.4.2** - Add MapLibre map click handler
   ```typescript
   useEffect(() => {
     if (!map) return;

     const handleMapClick = (e: MapMouseEvent) => {
       const { lng, lat } = e.lngLat;
       onPointSelect({ lng, lat });
     };

     map.on('click', handleMapClick);
     return () => { map.off('click', handleMapClick); };
   }, [map, onPointSelect]);
   ```

3. **2.4.3** - Add GPS markers
   ```typescript
   // Add markers για selected GPS points
   {controlPoints.map((point, i) => (
     <Marker
       key={i}
       longitude={point.gps.lng}
       latitude={point.gps.lat}
     >
       <div className="gps-marker">✅ {i + 1}</div>
     </Marker>
   ))}
   ```

4. **2.4.4** - Add connecting lines
   ```typescript
   // Draw lines from DXF to GPS points (optional visual)
   <Source
     type="geojson"
     data={{
       type: 'FeatureCollection',
       features: controlPoints.map(cp => ({
         type: 'Feature',
         geometry: {
           type: 'LineString',
           coordinates: [
             [cp.dxf.x, cp.dxf.y],
             [cp.gps.lng, cp.gps.lat]
           ]
         }
       }))
     }}
   >
     <Layer type="line" paint={{ 'line-color': '#0080ff', 'line-width': 2 }} />
   </Source>
   ```

**Files**:
```
floor-plan-system/components/MapControlPointSelector.tsx (new)
```

**Acceptance Criteria**:
- [ ] Map click handler works
- [ ] GPS coordinates captured
- [ ] Markers shown at click positions
- [ ] Visual feedback clear

---

#### **STEP 2.5: Create GeoreferencingWorkflow Component**

**Goal**: Main workflow component με split-panel UI

**Sub-Steps**:
1. **2.5.1** - Create component
   - Location: `floor-plan-system/components/GeoreferencingWorkflow.tsx`

2. **2.5.2** - Implement split-panel layout
   ```typescript
   <div className="georef-workflow">
     <div className="left-panel">
       <h3>DXF Preview</h3>
       <DxfPreviewPanel
         parseResult={parseResult}
         controlPoints={controlPoints}
         onPointSelect={handleDxfPointSelect}
       />
     </div>
     <div className="right-panel">
       <h3>Map View</h3>
       <MapControlPointSelector
         controlPoints={controlPoints}
         onPointSelect={handleGpsPointSelect}
       />
     </div>
   </div>
   ```

3. **2.5.3** - Implement control point pairing logic
   ```typescript
   const [controlPoints, setControlPoints] = useState<GeoControlPoint[]>([]);
   const [currentDxfPoint, setCurrentDxfPoint] = useState<{x, y} | null>(null);

   const handleDxfPointSelect = (point: {x, y}) => {
     setCurrentDxfPoint(point);
     setInstructions('Now click the same location on the map');
   };

   const handleGpsPointSelect = (point: {lng, lat}) => {
     if (!currentDxfPoint) {
       setInstructions('First click a point on the DXF preview');
       return;
     }

     setControlPoints([...controlPoints, {
       dxf: currentDxfPoint,
       gps: point,
       id: Date.now()
     }]);
     setCurrentDxfPoint(null);
     setInstructions('Select another control point, or click Calculate');
   };
   ```

4. **2.5.4** - Add instruction panel
   ```typescript
   <div className="instructions-panel">
     <p>{instructions}</p>
     <p>Control Points: {controlPoints.length} / 3-4</p>
   </div>
   ```

5. **2.5.5** - Add action buttons
   ```typescript
   <div className="actions">
     <button
       onClick={calculateTransformation}
       disabled={controlPoints.length < 3}
     >
       Calculate Transformation
     </button>
     <button onClick={reset}>Reset</button>
     <button onClick={onCancel}>Cancel</button>
   </div>
   ```

**Files**:
```
floor-plan-system/components/GeoreferencingWorkflow.tsx (new)
```

**Acceptance Criteria**:
- [ ] Split-panel layout works
- [ ] DXF click → instruction changes
- [ ] GPS click → control point added
- [ ] Point pairing works correctly
- [ ] Action buttons enabled/disabled correctly

---

#### **STEP 2.6: Calculate & Display Transformation**

**Goal**: Calculate transformation and show accuracy metrics

**Sub-Steps**:
1. **2.6.1** - Implement calculation trigger
   ```typescript
   const calculateTransformation = () => {
     const service = new GeoreferencingService();
     controlPoints.forEach(cp => service.addControlPoint(cp.dxf, cp.gps));

     const matrix = service.calculateTransformation();
     const accuracy = service.validateAccuracy();

     setTransformMatrix(matrix);
     setAccuracyMetrics(accuracy);
     setShowResults(true);
   };
   ```

2. **2.6.2** - Create results modal
   ```typescript
   <Modal isOpen={showResults}>
     <h2>✅ Georeferencing Complete!</h2>

     <div className="metrics">
       <p>RMS Error: ±{accuracy.rmsError.toFixed(2)} m</p>
       <p>Max Error: ±{accuracy.maxError.toFixed(2)} m</p>
       <p>Confidence: {accuracy.confidence}%</p>
       <p>Grade: {accuracy.grade} ({getGradeLabel(accuracy.grade)})</p>
     </div>

     <div className="actions">
       <button onClick={handleAccept}>Accept & Place</button>
       <button onClick={handleRetry}>Retry</button>
       <button onClick={handleCancel}>Cancel</button>
     </div>
   </Modal>
   ```

3. **2.6.3** - Handle Accept action
   ```typescript
   const handleAccept = () => {
     onGeoreferencingComplete({
       transformMatrix,
       controlPoints,
       accuracy
     });
   };
   ```

**Files**:
```
floor-plan-system/components/GeoreferencingWorkflow.tsx (update)
floor-plan-system/components/AccuracyResultsModal.tsx (new)
```

**Acceptance Criteria**:
- [ ] Calculation triggered με 3+ points
- [ ] Results modal shown
- [ ] Accuracy metrics displayed
- [ ] Accept button triggers callback
- [ ] Retry resets workflow

---

#### **STEP 2.7: Create useGeoreferencingWorkflow Hook**

**Goal**: React hook για workflow state management

**Sub-Steps**:
1. **2.7.1** - Create hook
   - Location: `floor-plan-system/hooks/useGeoreferencingWorkflow.ts`

2. **2.7.2** - Implement hook
   ```typescript
   export function useGeoreferencingWorkflow(parseResult: DxfParserResult) {
     const [controlPoints, setControlPoints] = useState<GeoControlPoint[]>([]);
     const [currentDxfPoint, setCurrentDxfPoint] = useState(null);
     const [transformMatrix, setTransformMatrix] = useState(null);
     const [accuracy, setAccuracy] = useState(null);
     const [instructions, setInstructions] = useState('Click a corner on the DXF preview');

     const addControlPoint = (dxf, gps) => { };
     const removeControlPoint = (index) => { };
     const calculateTransformation = () => { };
     const reset = () => { };

     return {
       controlPoints,
       currentDxfPoint,
       transformMatrix,
       accuracy,
       instructions,
       addControlPoint,
       removeControlPoint,
       calculateTransformation,
       reset
     };
   }
   ```

**Files**:
```
floor-plan-system/hooks/useGeoreferencingWorkflow.ts (new)
```

**Acceptance Criteria**:
- [ ] Hook manages workflow state
- [ ] Hook provides clean API
- [ ] State updates work correctly

---

**PHASE 2 - TOTAL FILES**:
```
✅ Components (4):
   - GeoreferencingWorkflow.tsx
   - DxfPreviewPanel.tsx
   - MapControlPointSelector.tsx
   - AccuracyResultsModal.tsx

✅ Services (1):
   - GeoreferencingService.ts

✅ Hooks (1):
   - useGeoreferencingWorkflow.ts

✅ Utils (1):
   - transformation-matrix-calculator.ts
```

**PHASE 2 - ACCEPTANCE CRITERIA**:
- [ ] ✅ Split-panel UI εμφανίζεται
- [ ] ✅ Χρήστης κάνει click σε DXF → marker εμφανίζεται
- [ ] ✅ Χρήστης κάνει click σε map → GPS marker εμφανίζεται
- [ ] ✅ Line connects DXF ↔ GPS points (optional)
- [ ] ✅ After 3-4 points → transformation calculated
- [ ] ✅ Accuracy metrics shown (RMS error, grade)
- [ ] ✅ Accept/Retry/Cancel buttons work
- [ ] ✅ No TypeScript errors
- [ ] ✅ No runtime errors

---

### **📅 PHASE 3: Floor Plan Rendering**

**Goal**: Floor plan εμφανίζεται πάνω στο χάρτη με σωστή θέση

**Duration**: 2-3 hours

---

#### **STEP 3.1: Calculate Geographic Bounds**

**Goal**: Convert transformation matrix to MapLibre geographic bounds

**Sub-Steps**:
1. **3.1.1** - Create bounds calculator utility
   - Location: `floor-plan-system/utils/bounds-calculator.ts`

2. **3.1.2** - Implement bounds calculation
   ```typescript
   export function calculateGeoBounds(
     dxfBounds: { minX, minY, maxX, maxY },
     transformMatrix: GeoTransformMatrix
   ): GeoBounds {
     // Transform 4 corners από DXF → GPS
     const nw = transformPoint({ x: dxfBounds.minX, y: dxfBounds.maxY }, transformMatrix);
     const ne = transformPoint({ x: dxfBounds.maxX, y: dxfBounds.maxY }, transformMatrix);
     const se = transformPoint({ x: dxfBounds.maxX, y: dxfBounds.minY }, transformMatrix);
     const sw = transformPoint({ x: dxfBounds.minX, y: dxfBounds.minY }, transformMatrix);

     return {
       north: Math.max(nw.lat, ne.lat, se.lat, sw.lat),
       south: Math.min(nw.lat, ne.lat, se.lat, sw.lat),
       east: Math.max(nw.lng, ne.lng, se.lng, sw.lng),
       west: Math.min(nw.lng, ne.lng, se.lng, sw.lng),
       corners: [nw, ne, se, sw] // MapLibre Image Source format
     };
   }
   ```

3. **3.1.3** - Implement point transformation
   ```typescript
   function transformPoint(
     dxfPoint: { x, y },
     matrix: GeoTransformMatrix
   ): { lng, lat } {
     const lng = matrix.a * dxfPoint.x + matrix.b * dxfPoint.y + matrix.c;
     const lat = matrix.d * dxfPoint.x + matrix.e * dxfPoint.y + matrix.f;
     return { lng, lat };
   }
   ```

**Files**:
```
floor-plan-system/utils/bounds-calculator.ts (new)
```

**Acceptance Criteria**:
- [ ] Bounds calculation works
- [ ] 4 corners calculated correctly
- [ ] North/South/East/West calculated
- [ ] Matches control points

---

#### **STEP 3.2: Create FloorPlanVectorLayer Component (DXF)**

**Goal**: Render DXF entities ως MapLibre GeoJSON layer

**Sub-Steps**:
1. **3.2.1** - Create component
   - Location: `floor-plan-system/rendering/FloorPlanVectorLayer.tsx`

2. **3.2.2** - Transform DXF entities to geographic coordinates
   ```typescript
   const transformedGeoJSON = useMemo(() => {
     // Clone GeoJSON από DxfParser
     const geoJSON = JSON.parse(JSON.stringify(parseResult.geoJSON));

     // Transform ALL coordinates
     geoJSON.features.forEach(feature => {
       if (feature.geometry.type === 'LineString') {
         feature.geometry.coordinates = feature.geometry.coordinates.map(([x, y]) => {
           const { lng, lat } = transformPoint({ x, y }, transformMatrix);
           return [lng, lat];
         });
       }
       // ... handle other geometry types (Polygon, Point, etc.)
     });

     return geoJSON;
   }, [parseResult, transformMatrix]);
   ```

3. **3.2.3** - Render MapLibre GeoJSON Source + Layers
   ```typescript
   <Source
     id="floor-plan-vector"
     type="geojson"
     data={transformedGeoJSON}
   >
     {/* Walls - thicker lines */}
     <Layer
       id="floor-plan-walls"
       type="line"
       filter={['==', ['get', 'layer'], 'WALLS']}
       paint={{
         'line-color': '#000000',
         'line-width': 2,
         'line-opacity': opacity
       }}
     />

     {/* Doors - blue lines */}
     <Layer
       id="floor-plan-doors"
       type="line"
       filter={['==', ['get', 'layer'], 'DOORS']}
       paint={{
         'line-color': '#0000ff',
         'line-width': 1.5,
         'line-opacity': opacity
       }}
     />

     {/* Text labels */}
     <Layer
       id="floor-plan-text"
       type="symbol"
       filter={['==', ['get', 'type'], 'text']}
       layout={{
         'text-field': ['get', 'text'],
         'text-size': 10
       }}
       paint={{
         'text-color': '#000000',
         'text-opacity': opacity
       }}
     />
   </Source>
   ```

4. **3.2.4** - Add layer visibility control
   ```typescript
   {visible && (
     <Source ...>
       <Layer ... />
     </Source>
   )}
   ```

**Files**:
```
floor-plan-system/rendering/FloorPlanVectorLayer.tsx (new)
```

**Acceptance Criteria**:
- [ ] DXF entities transformed to GPS coordinates
- [ ] GeoJSON source added to map
- [ ] Walls, doors, windows rendered correctly
- [ ] Text labels shown
- [ ] Opacity control works
- [ ] Visibility toggle works

---

#### **STEP 3.3: Create FloorPlanImageLayer Component (PNG/JPG)**

**Goal**: Render raster images ως MapLibre Image layer

**Sub-Steps**:
1. **3.3.1** - Create component
   - Location: `floor-plan-system/rendering/FloorPlanImageLayer.tsx`

2. **3.3.2** - Render MapLibre Image Source
   ```typescript
   <Source
     id="floor-plan-image"
     type="image"
     url={parseResult.imageUrl} // από ImageParser
     coordinates={geoBounds.corners} // [NW, NE, SE, SW]
   >
     <Layer
       id="floor-plan-raster"
       type="raster"
       paint={{
         'raster-opacity': opacity,
         'raster-fade-duration': 0 // Instant (no fade animation)
       }}
     />
   </Source>
   ```

3. **3.3.3** - Add layer visibility control
   ```typescript
   {visible && (
     <Source ...>
       <Layer ... />
     </Source>
   )}
   ```

**Files**:
```
floor-plan-system/rendering/FloorPlanImageLayer.tsx (new)
```

**Acceptance Criteria**:
- [ ] Image source added to map
- [ ] 4 corners positioned correctly
- [ ] Image aligned με control points
- [ ] Opacity control works
- [ ] Visibility toggle works

---

#### **STEP 3.4: Create FloorPlanLayerControls Component**

**Goal**: UI controls για opacity, visibility, z-index

**Sub-Steps**:
1. **3.4.1** - Create component
   - Location: `floor-plan-system/components/FloorPlanLayerControls.tsx`

2. **3.4.2** - Implement opacity slider
   ```typescript
   <div className="control-group">
     <label>Opacity: {Math.round(opacity * 100)}%</label>
     <input
       type="range"
       min="0"
       max="100"
       value={opacity * 100}
       onChange={(e) => setOpacity(Number(e.target.value) / 100)}
     />
   </div>
   ```

3. **3.4.3** - Implement visibility toggle
   ```typescript
   <div className="control-group">
     <label>
       <input
         type="checkbox"
         checked={visible}
         onChange={(e) => setVisible(e.target.checked)}
       />
       Visible
     </label>
   </div>
   ```

4. **3.4.4** - Implement z-index controls (optional)
   ```typescript
   <div className="control-group">
     <label>Layer Order</label>
     <button onClick={() => moveLayerUp()}>▲</button>
     <button onClick={() => moveLayerDown()}>▼</button>
   </div>
   ```

5. **3.4.5** - Add delete button
   ```typescript
   <button onClick={onDelete} className="delete-btn">
     🗑️ Remove Floor Plan
   </button>
   ```

**Files**:
```
floor-plan-system/components/FloorPlanLayerControls.tsx (new)
```

**Acceptance Criteria**:
- [ ] Opacity slider works (0-100%)
- [ ] Visibility checkbox works
- [ ] Z-index controls work (optional)
- [ ] Delete button works
- [ ] UI matches design system

---

#### **STEP 3.5: Create LayerManager Service**

**Goal**: Service για managing multiple floor plan layers

**Sub-Steps**:
1. **3.5.1** - Create service file
   - Location: `floor-plan-system/services/LayerManager.ts`

2. **3.5.2** - Implement service
   ```typescript
   export class LayerManager {
     private layers: FloorPlanLayer[] = [];

     addLayer(layer: FloorPlanLayer) {
       this.layers.push({ ...layer, id: generateId() });
     }

     removeLayer(id: string) {
       this.layers = this.layers.filter(l => l.id !== id);
     }

     updateLayerOpacity(id: string, opacity: number) {
       const layer = this.layers.find(l => l.id === id);
       if (layer) layer.opacity = opacity;
     }

     updateLayerVisibility(id: string, visible: boolean) {
       const layer = this.layers.find(l => l.id === id);
       if (layer) layer.visible = visible;
     }

     getAllLayers() {
       return this.layers;
     }
   }
   ```

3. **3.5.3** - Add persistence (optional)
   - Save to localStorage
   - Load on app start

**Files**:
```
floor-plan-system/services/LayerManager.ts (new)
```

**Acceptance Criteria**:
- [ ] Layer management works
- [ ] Add/remove layers works
- [ ] Update opacity works
- [ ] Update visibility works

---

#### **STEP 3.6: Create useFloorPlanLayer Hook**

**Goal**: React hook για layer state management

**Sub-Steps**:
1. **3.6.1** - Create hook
   - Location: `floor-plan-system/hooks/useFloorPlanLayer.ts`

2. **3.6.2** - Implement hook
   ```typescript
   export function useFloorPlanLayer(
     parseResult: DxfParserResult | ImageParserResult,
     transformMatrix: GeoTransformMatrix,
     geoBounds: GeoBounds
   ) {
     const [opacity, setOpacity] = useState(0.8);
     const [visible, setVisible] = useState(true);
     const [zIndex, setZIndex] = useState(100);

     const handleDelete = () => {
       // Remove layer from map
       layerManager.removeLayer(layerId);
     };

     return {
       opacity,
       setOpacity,
       visible,
       setVisible,
       zIndex,
       setZIndex,
       handleDelete
     };
   }
   ```

**Files**:
```
floor-plan-system/hooks/useFloorPlanLayer.ts (new)
```

**Acceptance Criteria**:
- [ ] Hook manages layer state
- [ ] Hook provides clean API
- [ ] State updates work

---

#### **STEP 3.7: Wire Everything Together**

**Goal**: Integrate rendering με georeferencing workflow

**Sub-Steps**:
1. **3.7.1** - Update `GeoreferencingWorkflow` "Accept" handler
   ```typescript
   const handleAccept = () => {
     // Calculate geo bounds
     const geoBounds = calculateGeoBounds(
       parseResult.bounds,
       transformMatrix
     );

     // Render floor plan
     onGeoreferencingComplete({
       parseResult,
       transformMatrix,
       geoBounds,
       controlPoints
     });
   };
   ```

2. **3.7.2** - Add floor plan to map
   ```typescript
   // In GeoCanvasApp.tsx
   const [floorPlan, setFloorPlan] = useState(null);

   const handleGeoreferencingComplete = (data) => {
     setFloorPlan(data);
   };

   return (
     <Map>
       {floorPlan && (
         <>
           {floorPlan.parseResult.format === 'DXF' ? (
             <FloorPlanVectorLayer
               parseResult={floorPlan.parseResult}
               transformMatrix={floorPlan.transformMatrix}
             />
           ) : (
             <FloorPlanImageLayer
               parseResult={floorPlan.parseResult}
               geoBounds={floorPlan.geoBounds}
             />
           )}

           <FloorPlanLayerControls
             onDelete={() => setFloorPlan(null)}
           />
         </>
       )}
     </Map>
   );
   ```

**Files**:
```
floor-plan-system/components/GeoreferencingWorkflow.tsx (update)
src/subapps/geo-canvas/GeoCanvasApp.tsx (update)
```

**Acceptance Criteria**:
- [ ] Accept button → floor plan renders
- [ ] DXF → Vector layer
- [ ] PNG/JPG → Image layer
- [ ] Controls shown
- [ ] Delete removes layer

---

**PHASE 3 - TOTAL FILES**:
```
✅ Rendering (2):
   - FloorPlanVectorLayer.tsx (DXF)
   - FloorPlanImageLayer.tsx (PNG/JPG)

✅ Components (1):
   - FloorPlanLayerControls.tsx

✅ Services (1):
   - LayerManager.ts

✅ Hooks (1):
   - useFloorPlanLayer.ts

✅ Utils (1):
   - bounds-calculator.ts

✅ Integration (2):
   - GeoreferencingWorkflow.tsx (update)
   - GeoCanvasApp.tsx (update)
```

**PHASE 3 - ACCEPTANCE CRITERIA**:
- [ ] ✅ Floor plan visible πάνω στο χάρτη
- [ ] ✅ Correct position (matches control points)
- [ ] ✅ Opacity slider works (0-100%)
- [ ] ✅ Visibility toggle works
- [ ] ✅ Z-index controls work (optional)
- [ ] ✅ Delete button works
- [ ] ✅ No performance issues (smooth map interaction)
- [ ] ✅ No TypeScript errors
- [ ] ✅ No runtime errors

---

### **📅 PHASE 4: Multiple Formats (PNG, JPG, TIFF)**

**Goal**: Υποστήριξη για raster image formats

**Duration**: 1 hour (mostly testing)

---

#### **STEP 4.1: Add Image Format Support to Upload Modal**

**Goal**: Accept PNG/JPG/TIFF files

**Sub-Steps**:
1. **4.1.1** - Update `FloorPlanUploadModal` file picker
   ```typescript
   accept=".dxf,.dwg,.png,.jpg,.jpeg,.tiff,.tif"
   ```

2. **4.1.2** - Update format detection
   - Already implemented! ✅ (detectFormat utility)

3. **4.1.3** - Test με PNG file
   - Upload PNG → parseImage() → thumbnail shown ✅

4. **4.1.4** - Test με JPG file
   - Upload JPG → parseImage() → thumbnail shown ✅

5. **4.1.5** - Test με TIFF file
   - Upload TIFF → parseImage() → thumbnail shown ✅

**Files**:
```
floor-plan-system/components/FloorPlanUploadModal.tsx (update)
```

**Acceptance Criteria**:
- [ ] PNG/JPG/TIFF files accepted
- [ ] ImageParser called automatically
- [ ] Thumbnail shown για all formats

---

#### **STEP 4.2: Test Full Workflow με Images**

**Goal**: End-to-end test με PNG/JPG/TIFF

**Sub-Steps**:
1. **4.2.1** - Test PNG workflow
   - Upload PNG → Georeference → Render → Controls work ✅

2. **4.2.2** - Test JPG workflow
   - Upload JPG → Georeference → Render → Controls work ✅

3. **4.2.3** - Test TIFF workflow
   - Upload TIFF → Georeference → Render → Controls work ✅

4. **4.2.4** - Test large image optimization
   - Upload 4K+ PNG → optimizeImage() → compressed ✅

**Acceptance Criteria**:
- [ ] All formats work end-to-end
- [ ] Georeferencing reuses same workflow
- [ ] Rendering uses FloorPlanImageLayer
- [ ] Performance is good

---

**PHASE 4 - TOTAL FILES**:
```
✅ Updates (1):
   - FloorPlanUploadModal.tsx (add image support)

✅ Testing:
   - PNG/JPG/TIFF end-to-end workflows
```

**PHASE 4 - ACCEPTANCE CRITERIA**:
- [ ] ✅ PNG upload → preview → georeference → render
- [ ] ✅ JPG upload → preview → georeference → render
- [ ] ✅ TIFF upload → preview → georeference → render
- [ ] ✅ Large images optimized (< 4K)
- [ ] ✅ No performance issues

---

### **📅 PHASE 5: Property Polygon Integration**

**Goal**: Χρήστης μπορεί να σχεδιάζει πολύγωνα ιδιοκτησιών πάνω στην κάτοψη

**Duration**: 2-3 hours

---

#### **STEP 5.1: Integrate Polygon Closure System**

**Goal**: Enable polygon drawing πάνω στην κάτοψη

**Sub-Steps**:
1. **5.1.1** - Find existing polygon drawing system
   - Search: `polygon`, `draw`, `closure`
   - Location: Likely in `geo-canvas/` ή shared components

2. **5.1.2** - Enable polygon drawing mode
   ```typescript
   const [isDrawingMode, setIsDrawingMode] = useState(false);

   <button onClick={() => setIsDrawingMode(true)}>
     ✏️ Draw Property Polygon
   </button>
   ```

3. **5.1.3** - Test polygon drawing πάνω σε floor plan
   - Click corners → polygon closes → event fires ✅

**Files**:
```
src/subapps/geo-canvas/GeoCanvasApp.tsx (update - enable drawing mode)
```

**Acceptance Criteria**:
- [ ] Polygon drawing mode enabled
- [ ] Click to add vertices
- [ ] Click first point to close
- [ ] Polygon geometry captured (WGS84)

---

#### **STEP 5.2: Create PropertyMetadataForm Component**

**Goal**: Form για property details μετά το polygon close

**Sub-Steps**:
1. **5.2.1** - Create form component
   - Location: `floor-plan-system/components/PropertyMetadataForm.tsx`

2. **5.2.2** - Implement form fields
   ```typescript
   <form onSubmit={handleSubmit}>
     <label>Property Type:</label>
     <select name="propertyType">
       <option>Studio</option>
       <option>1-Bedroom</option>
       <option>2-Bedroom</option>
       <option>Office</option>
       <option>Parking</option>
       <option>Storage</option>
     </select>

     <label>Floor:</label>
     <input type="number" name="floor" />

     <label>Unit Number:</label>
     <input type="text" name="unitNumber" />

     <label>Owner (optional):</label>
     <input type="text" name="owner" />

     <label>Price (optional):</label>
     <input type="number" name="price" />

     <button type="submit">Save Property</button>
     <button type="button" onClick={onCancel}>Cancel</button>
   </form>
   ```

3. **5.2.3** - Add i18n support
   - Keys: `propertyForm.type`, `propertyForm.floor`, etc.
   - Translations: EN/EL

**Files**:
```
floor-plan-system/components/PropertyMetadataForm.tsx (new)
src/i18n/locales/en/geo-canvas.json (update)
src/i18n/locales/el/geo-canvas.json (update)
```

**Acceptance Criteria**:
- [ ] Form shown μετά polygon close
- [ ] All fields work
- [ ] Submit → data captured
- [ ] Cancel → polygon deleted

---

#### **STEP 5.3: Create PropertyManager Service**

**Goal**: Service για managing property-polygon associations

**Sub-Steps**:
1. **5.3.1** - Create service file
   - Location: `floor-plan-system/services/PropertyManager.ts`

2. **5.3.2** - Implement service
   ```typescript
   export class PropertyManager {
     private properties: Property[] = [];

     addProperty(polygon: Polygon, metadata: PropertyMetadata, floorPlanId: string) {
       this.properties.push({
         id: generateId(),
         polygon,
         metadata,
         floorPlanId,
         createdAt: new Date()
       });
     }

     removeProperty(id: string) { }
     updateProperty(id: string, updates: Partial<Property>) { }
     getPropertiesByFloorPlan(floorPlanId: string) { }
     getAllProperties() { }
   }
   ```

3. **5.3.3** - Add persistence (optional)
   - Save to localStorage
   - Load on app start

**Files**:
```
floor-plan-system/services/PropertyManager.ts (new)
```

**Acceptance Criteria**:
- [ ] Property-polygon association works
- [ ] CRUD operations work
- [ ] Filter by floor plan works

---

#### **STEP 5.4: Create Property List UI**

**Goal**: Show all properties με edit/delete

**Sub-Steps**:
1. **5.4.1** - Create component
   - Location: `floor-plan-system/components/PropertyList.tsx`

2. **5.4.2** - Implement list rendering
   ```typescript
   <div className="property-list">
     <h3>Properties ({properties.length})</h3>
     {properties.map(property => (
       <div key={property.id} className="property-item">
         <div>
           <strong>{property.metadata.propertyType}</strong>
           <p>Unit: {property.metadata.unitNumber}</p>
           <p>Floor: {property.metadata.floor}</p>
           <p>Area: {calculateArea(property.polygon)} m²</p>
         </div>
         <div className="actions">
           <button onClick={() => onEdit(property.id)}>✏️ Edit</button>
           <button onClick={() => onDelete(property.id)}>🗑️ Delete</button>
         </div>
       </div>
     ))}
   </div>
   ```

3. **5.4.3** - Add highlight on hover
   ```typescript
   const handleHover = (propertyId: string) => {
     // Highlight polygon on map
   };
   ```

**Files**:
```
floor-plan-system/components/PropertyList.tsx (new)
```

**Acceptance Criteria**:
- [ ] Property list shown
- [ ] Edit button works
- [ ] Delete button works
- [ ] Hover highlights polygon

---

#### **STEP 5.5: Wire Everything Together**

**Goal**: Connect polygon drawing → metadata form → property list

**Sub-Steps**:
1. **5.5.1** - Handle polygon close event
   ```typescript
   const handlePolygonClose = (polygon: Polygon) => {
     setCurrentPolygon(polygon);
     setShowMetadataForm(true);
   };
   ```

2. **5.5.2** - Handle metadata form submit
   ```typescript
   const handleFormSubmit = (metadata: PropertyMetadata) => {
     propertyManager.addProperty(currentPolygon, metadata, floorPlan.id);
     setShowMetadataForm(false);
     setCurrentPolygon(null);
   };
   ```

3. **5.5.3** - Update GeoCanvasApp
   ```typescript
   return (
     <Map>
       {floorPlan && <FloorPlanVectorLayer ... />}

       {isDrawingMode && <PolygonDrawingTool onClose={handlePolygonClose} />}

       {showMetadataForm && (
         <PropertyMetadataForm
           onSubmit={handleFormSubmit}
           onCancel={() => setShowMetadataForm(false)}
         />
       )}

       <PropertyList properties={properties} />
     </Map>
   );
   ```

**Files**:
```
src/subapps/geo-canvas/GeoCanvasApp.tsx (update)
```

**Acceptance Criteria**:
- [ ] Polygon close → form shown
- [ ] Form submit → property saved
- [ ] Property list updated
- [ ] Full workflow works

---

**PHASE 5 - TOTAL FILES**:
```
✅ Components (2):
   - PropertyMetadataForm.tsx
   - PropertyList.tsx

✅ Services (1):
   - PropertyManager.ts

✅ Hooks (1):
   - usePropertyPolygon.ts (optional)

✅ Integration (1):
   - GeoCanvasApp.tsx (update)

✅ i18n (2):
   - en/geo-canvas.json (update)
   - el/geo-canvas.json (update)
```

**PHASE 5 - ACCEPTANCE CRITERIA**:
- [ ] ✅ Polygon drawing works πάνω στην κάτοψη
- [ ] ✅ Metadata form appears after polygon closed
- [ ] ✅ Property saved με floor plan association
- [ ] ✅ Property list shows all properties
- [ ] ✅ Edit/delete properties works
- [ ] ✅ No TypeScript errors
- [ ] ✅ No runtime errors

---

## 📐 FORMAT-SPECIFIC HANDLING {#format-handling}

### **🎨 DXF/DWG (Vector Formats)**

**Characteristics**:
- Text-based (DXF) or binary (DWG)
- Contains geometric entities (lines, polylines, arcs, circles, text)
- Organized in layers
- Scalable (vector graphics)

**Parsing Strategy**:
```typescript
// DXF Parsing Flow
1. Read DXF file (text format)
2. Parse structure (HEADER, ENTITIES, TABLES, etc.)
3. Extract entities by layer:
   - WALLS → polylines
   - DOORS → arcs + lines
   - WINDOWS → rectangles
   - TEXT → labels
4. Convert to GeoJSON:
   {
     type: 'FeatureCollection',
     features: [
       {
         type: 'Feature',
         geometry: { type: 'LineString', coordinates: [...] },
         properties: { layer: 'WALLS', color: '#000' }
       },
       // ... more features
     ]
   }
5. Store original DXF bounds (minX, minY, maxX, maxY)
```

**Rendering**:
- MapLibre GeoJSON Source
- Multiple layers (walls, doors, windows, text)
- Style by layer properties
- Fully interactive (click, hover)

**Transformation**:
```typescript
// Transform DXF coordinate to Geographic
function transformDxfToGeo(dxfPoint: {x, y}): {lng, lat} {
  const [lng, lat] = transformMatrix.apply(dxfPoint.x, dxfPoint.y);
  return { lng, lat };
}

// Apply transformation to ALL entities
dxfEntities.forEach(entity => {
  entity.coordinates = entity.coordinates.map(([x, y]) =>
    transformDxfToGeo({x, y})
  );
});
```

---

### **🖼️ PNG/JPG/TIFF (Raster Images)**

**Characteristics**:
- Pixel-based (bitmap)
- Fixed resolution
- No geometric entities (just image)
- Simple structure

**Parsing Strategy**:
```typescript
// Image Parsing Flow (Already implemented! ✅)
1. Load image με browser Image API
2. Extract metadata:
   - width, height
   - aspect ratio
   - format (PNG/JPG/TIFF)
   - has alpha channel (transparency)
3. Generate thumbnail (200x200)
4. Optimize if large (> 4K → compress)
5. Create Object URL για rendering
```

**Rendering**:
- MapLibre Image Source
- 4 corner coordinates (geographic bounds)
- Raster layer με opacity control
- Static (non-interactive)

**Transformation**:
```typescript
// Calculate geographic bounds από control points
function calculateBounds(controlPoints: GeoControlPoint[]) {
  // Get min/max DXF coordinates
  const dxfBounds = {
    minX: Math.min(...controlPoints.map(p => p.dxfCoordinate.x)),
    maxX: Math.max(...controlPoints.map(p => p.dxfCoordinate.x)),
    minY: Math.min(...controlPoints.map(p => p.dxfCoordinate.y)),
    maxY: Math.max(...controlPoints.map(p => p.dxfCoordinate.y))
  };

  // Transform corners to geographic
  const corners = [
    transformDxfToGeo({ x: dxfBounds.minX, y: dxfBounds.maxY }), // NW
    transformDxfToGeo({ x: dxfBounds.maxX, y: dxfBounds.maxY }), // NE
    transformDxfToGeo({ x: dxfBounds.maxX, y: dxfBounds.minY }), // SE
    transformDxfToGeo({ x: dxfBounds.minX, y: dxfBounds.minY })  // SW
  ];

  return { corners };
}
```

---

## 🎯 GEOREFERENCING DEEP DIVE {#georeferencing}

### **📐 CONTROL POINTS**

**Minimum**: 3 points (affine transformation)
**Recommended**: 4 points (better accuracy)
**Maximum**: 10 points (polynomial transformation)

**Best Practices**:
1. **Spread points across entire floor plan** (not clustered)
2. **Choose distinctive features** (building corners, not random walls)
3. **Use building perimeter** (easier to locate on satellite imagery)
4. **Verify on satellite view** (not just OpenStreetMap)

**Example - Good Control Points**:
```
Building με 4 corners:
  CP1: Top-left corner (NW)
  CP2: Top-right corner (NE)
  CP3: Bottom-right corner (SE)
  CP4: Bottom-left corner (SW)

Why good?
  ✅ Spread across entire building
  ✅ Easy to identify on satellite
  ✅ Cover maximum area
  ✅ Form a rectangle (good for affine)
```

**Example - Bad Control Points**:
```
All points on one wall:
  CP1: Left end of north wall
  CP2: Middle of north wall
  CP3: Right end of north wall

Why bad?
  ❌ All on same line (no area coverage)
  ❌ Transformation unstable
  ❌ Errors amplified in uncovered areas
```

---

### **🔢 TRANSFORMATION METHODS**

#### **1️⃣ AFFINE TRANSFORMATION (Default)**

**Use Case**: Uniform scaling, rotation, translation
**Control Points**: 3-4 points
**Accuracy**: ±1-5 meters για local projects
**Performance**: Fastest (O(1) transformation)

**Formula**:
```
[x']   [a  b  c]   [x]
[y'] = [d  e  f] × [y]
[1 ]   [0  0  1]   [1]

where:
  a, e = scale factors
  b, d = rotation/shear
  c, f = translation
```

**When to use**:
- Building is rectangular
- No significant distortion
- Control points form regular shape
- Quick georeferencing needed

---

#### **2️⃣ POLYNOMIAL TRANSFORMATION**

**Use Case**: Non-linear distortions, complex mappings
**Control Points**: 6+ points recommended
**Accuracy**: ±0.5-2 meters με adequate control points
**Performance**: Medium (O(n) polynomial degree)

**Formula**:
```
x' = a0 + a1*x + a2*y + a3*x² + a4*xy + a5*y²
y' = b0 + b1*x + b2*y + b3*x² + b4*xy + b5*y²

Higher order = better fit, but risk overfitting
```

**When to use**:
- Building has curved walls
- Scan distortion present
- Control points show non-linear pattern
- High accuracy required

---

#### **3️⃣ THIN PLATE SPLINE (TPS)**

**Use Case**: Maximum flexibility, irregular distortions
**Control Points**: 10+ points recommended
**Accuracy**: Highest (sub-meter precision possible)
**Performance**: Slowest (O(n²) για n control points)

**Formula**:
```
Complex radial basis function:
  f(x,y) = a0 + a1*x + a2*y + Σ wi*U(|Pi - (x,y)|)
  where U(r) = r²*log(r)  [thin plate spline kernel]
```

**When to use**:
- Scanned floor plan με distortion
- Old drawings με warping
- Maximum accuracy required
- Computational cost acceptable

---

### **📊 ACCURACY VALIDATION**

**Metrics**:
```typescript
interface AccuracyMetrics {
  rmsError: number;         // Root Mean Square error (meters)
  maxError: number;         // Worst case error (meters)
  minError: number;         // Best case error (meters)
  averageError: number;     // Mean error (meters)
  standardDeviation: number;// Error distribution
  confidence: number;       // 0-1 confidence score
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
}
```

**Grading System**:
```
Grade A: RMS Error < 1m    (Survey-grade - Excellent)
Grade B: RMS Error < 3m    (Engineering-grade - Good)
Grade C: RMS Error < 10m   (Mapping-grade - Fair)
Grade D: RMS Error < 50m   (Planning-grade - Poor)
Grade F: RMS Error > 50m   (Unacceptable - Retry!)
```

**Validation Process**:
```typescript
1. Calculate transformation matrix από control points
2. Transform DXF points → GPS
3. Compare με actual GPS points
4. Calculate errors (distance between predicted vs actual)
5. Compute RMS error
6. Assign grade
7. If Grade < C: Warn user, suggest retry
```

---

## 🔄 COORDINATE SYSTEM TRANSFORMATION {#transformation}

### **📐 DXF COORDINATE SYSTEM**

**Origin**: Arbitrary (user-defined in CAD software)
**Units**: Typically meters, but can be inches, feet, etc.
**Axes**: X (horizontal), Y (vertical), Z (elevation)
**Handedness**: Right-handed coordinate system

**Example**:
```
DXF Building:
  - Origin: (0, 0)
  - Width: 50m (x-axis)
  - Height: 30m (y-axis)
  - Bounds: x:[0-50], y:[0-30]
```

---

### **🌍 GEOGRAPHIC COORDINATE SYSTEM**

**Standard**: WGS84 (EPSG:4326)
**Origin**: Earth's center
**Units**: Degrees (longitude, latitude)
**Axes**: Longitude (E/W), Latitude (N/S), Elevation (meters)

**Example**:
```
Athens, Greece:
  - Longitude: 23.7275° E
  - Latitude: 37.9838° N
  - Building size: ~0.0005° lng × ~0.0003° lat
```

---

### **🔄 TRANSFORMATION PROCESS**

```typescript
// Step 1: User selects control points
const controlPoints = [
  {
    dxfCoordinate: { x: 0, y: 30 },     // DXF top-left
    geoCoordinate: { lng: 23.7275, lat: 37.9838 }  // GPS top-left
  },
  {
    dxfCoordinate: { x: 50, y: 30 },    // DXF top-right
    geoCoordinate: { lng: 23.7285, lat: 37.9838 }  // GPS top-right
  },
  {
    dxfCoordinate: { x: 50, y: 0 },     // DXF bottom-right
    geoCoordinate: { lng: 23.7285, lat: 37.9828 }  // GPS bottom-right
  }
];

// Step 2: Calculate transformation matrix
const matrix = calculateAffineTransformation(controlPoints);
// Result:
// {
//   a: 0.0002,   // X scale (50m DXF → 0.001° lng)
//   b: 0,        // No rotation
//   c: 23.7275,  // X translation (origin offset)
//   d: 0,        // No shear
//   e: -0.00033, // Y scale (30m DXF → 0.001° lat, negative!)
//   f: 37.9838   // Y translation (origin offset)
// }

// Step 3: Transform any DXF point
function transformDxfToGeo(dxfPoint: {x, y}) {
  const lng = matrix.a * dxfPoint.x + matrix.b * dxfPoint.y + matrix.c;
  const lat = matrix.d * dxfPoint.x + matrix.e * dxfPoint.y + matrix.f;
  return { lng, lat };
}

// Example: Transform apartment corner
const apartmentCorner = { x: 10, y: 20 };
const geoCorner = transformDxfToGeo(apartmentCorner);
// Result: { lng: 23.7277, lat: 37.98313 }
```

---

## 🎨 UI/UX SPECIFICATIONS {#ui-ux}

### **📁 UPLOAD BUTTON (Top Bar)**

**Location**: Top Bar, right side (after Σύστημα Συντεταγμένων)

**Design**:
```tsx
<button className="btn-primary">
  <FolderIcon /> Upload Floor Plan
</button>
```

**States**:
- Default: Blue background, white text
- Hover: Darker blue
- Active/Uploading: Loading spinner + "Uploading..."
- Disabled: Gray background (when already uploading)

---

### **📤 UPLOAD MODAL**

**Design**:
```
┌─────────────────────────────────────────────────────┐
│ 📁 Upload Floor Plan                     [X] Close  │
├─────────────────────────────────────────────────────┤
│                                                      │
│ ┌─────────────────────────────────────────────────┐ │
│ │                                                  │ │
│ │        Drag & Drop Floor Plan Here              │ │
│ │                 or                               │ │
│ │           [📁 Browse Files]                      │ │
│ │                                                  │ │
│ │  Supported formats:                              │ │
│ │  • DXF (AutoCAD Drawing)                        │ │
│ │  • DWG (AutoCAD Native)                         │ │
│ │  • PNG, JPG, TIFF (Images)                      │ │
│ │  • PDF (Documents)                               │ │
│ │                                                  │ │
│ │  Max file size: 50MB                            │ │
│ └─────────────────────────────────────────────────┘ │
│                                                      │
│ [Cancel]                          [Upload & Parse]  │
└─────────────────────────────────────────────────────┘
```

---

### **🎯 GEOREFERENCING WORKFLOW UI**

**Design**:
```
┌────────────────────────────────────────────────────────────────┐
│ 🎯 Georeference Floor Plan                         Step 1 of 3 │
├────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────┬──────────────────────────────────────┐│
│ │ 📐 DXF PREVIEW       │ 🗺️ MAP VIEW                         ││
│ │                      │                                      ││
│ │ [Floor plan image]   │ [Interactive map]                   ││
│ │                      │                                      ││
│ │ Instructions:        │ Instructions:                        ││
│ │ Click top-left       │ Click matching point                ││
│ │ corner of building   │ on the map                          ││
│ │                      │                                      ││
│ │ Control Points:      │ GPS Points:                          ││
│ │ • Point 1: ❌ (0,30) │ • Point 1: ✅ (23.72, 37.98)       ││
│ │ • Point 2: -         │ • Point 2: -                        ││
│ │ • Point 3: -         │ • Point 3: -                        ││
│ └──────────────────────┴──────────────────────────────────────┘│
│                                                                 │
│ Progress: ███░░░ 1/3 points selected                           │
│                                                                 │
│ [◄ Back]                    [Skip] [Cancel]       [Next ►]    │
└────────────────────────────────────────────────────────────────┘
```

---

## ⚠️ EDGE CASES & ERROR HANDLING {#edge-cases}

### **🚨 UPLOAD ERRORS**

| Error | Cause | Solution |
|-------|-------|----------|
| File too large | > 50MB | Compress image or convert DXF to lighter format |
| Unsupported format | .dwf, .dgn, etc. | Show supported formats list |
| Corrupted file | Invalid DXF structure | Show error, ask for re-upload |
| Empty file | 0 bytes | Validate before upload |
| Network error | Upload timeout | Retry με exponential backoff |

---

### **🚨 PARSING ERRORS**

| Error | Cause | Solution |
|-------|-------|----------|
| Invalid DXF syntax | Malformed file | Show specific line number error |
| Missing entities | Empty DXF | Warn user, allow manual drawing |
| Unsupported DXF version | R12, R14 only supported | Convert to supported version |
| Large entity count | > 100k entities | Simplify or split into layers |

---

### **🚨 GEOREFERENCING ERRORS**

| Error | Cause | Solution |
|-------|-------|----------|
| < 3 control points | User skipped | Require minimum 3 points |
| Collinear points | All on same line | Warn user, suggest better points |
| RMS error > 50m (Grade F) | Bad point selection | Force retry με guidance |
| Singular matrix | Transformation undefined | Add more/better control points |
| Points outside map view | User zoomed wrong area | Auto-zoom to building location |

---

### **🚨 RENDERING ERRORS**

| Error | Cause | Solution |
|-------|-------|----------|
| Layer not visible | Z-index conflict | Auto-adjust z-index |
| Image not loading | URL expired/CORS | Regenerate image URL |
| GeoJSON parse error | Invalid coordinates | Validate before rendering |
| Performance degradation | Too many layers | Implement virtual layers |

---

## 🧪 TESTING STRATEGY {#testing}

### **✅ UNIT TESTS**

```typescript
describe('ImageParser', () => {
  it('should parse PNG file', async () => {
    const file = createMockPNGFile();
    const result = await parseImage(file);
    expect(result.success).toBe(true);
    expect(result.format).toBe('PNG');
    expect(result.metadata.width).toBeGreaterThan(0);
  });

  it('should generate thumbnail', async () => {
    const file = createMockPNGFile();
    const result = await parseImage(file);
    expect(result.thumbnail).toBeDefined();
    expect(result.thumbnail).toMatch(/^data:image\/png/);
  });

  it('should optimize large images', async () => {
    const largeFile = createMock4KImage();
    const parser = new ImageParser();
    const optimized = await parser.optimizeImage(largeFile);
    expect(optimized.size).toBeLessThan(largeFile.size);
  });
});
```

---

### **✅ INTEGRATION TESTS**

```typescript
describe('Floor Plan Upload → Georeference → Render', () => {
  it('should complete full workflow', async () => {
    // 1. Upload
    const uploadResult = await uploadFloorPlan(dxfFile);
    expect(uploadResult.success).toBe(true);

    // 2. Parse
    const parsed = await parseDxf(dxfFile);
    expect(parsed.geoJSON).toBeDefined();

    // 3. Georeference
    const controlPoints = [
      { dxfCoordinate: {x:0, y:30}, geoCoordinate: {lng:23.72, lat:37.98} },
      { dxfCoordinate: {x:50, y:30}, geoCoordinate: {lng:23.73, lat:37.98} },
      { dxfCoordinate: {x:50, y:0}, geoCoordinate: {lng:23.73, lat:37.97} }
    ];
    const matrix = calculateTransformation(controlPoints);
    expect(matrix.a).toBeDefined();

    // 4. Render
    const layer = createFloorPlanLayer(parsed, matrix);
    expect(layer.source.type).toBe('geojson');
    expect(layer.paint.opacity).toBe(0.8);
  });
});
```

---

### **✅ E2E TESTS (Playwright)**

```typescript
test('User can upload and georeference floor plan', async ({ page }) => {
  // Navigate to Geo-Canvas
  await page.goto('http://localhost:3001/geo');

  // Click Upload Floor Plan button
  await page.click('button:has-text("Upload Floor Plan")');

  // Upload file
  const fileInput = await page.locator('input[type="file"]');
  await fileInput.setInputFiles('test-assets/Floor_Plan.dxf');

  // Wait for parsing
  await page.waitForSelector('text=DXF parsed successfully');

  // Start georeferencing
  await page.click('button:has-text("Start Georeferencing")');

  // Select 3 control points
  for (let i = 0; i < 3; i++) {
    // Click on DXF preview
    await page.click('.dxf-preview', { position: getControlPoint(i) });

    // Click on map
    await page.click('.map-view', { position: getGPSPoint(i) });
  }

  // Accept georeferencing
  await page.click('button:has-text("Accept & Place")');

  // Verify layer rendered
  await expect(page.locator('.floor-plan-layer')).toBeVisible();
  await expect(page.locator('text=Floor plan placed successfully')).toBeVisible();
});
```

---

## ⚡ PERFORMANCE OPTIMIZATION {#performance}

### **🚀 OPTIMIZATION STRATEGIES**

#### **1️⃣ Image Optimization**
```typescript
// Auto-compress large images
if (image.width > 4096 || image.height > 4096) {
  const optimized = await optimizeImage(image, {
    maxDimension: 4096,
    quality: 0.85,
    format: 'jpeg'
  });
  // Result: 4K PNG (20MB) → 4K JPEG (2MB) = 10x smaller!
}
```

#### **2️⃣ Vector Simplification**
```typescript
// Simplify DXF geometry για large files
if (entities.length > 10000) {
  const simplified = simplifyGeoJSON(geoJSON, {
    tolerance: 0.001,  // 1mm tolerance
    highQuality: true
  });
  // Result: 100k entities → 10k entities = 10x fewer!
}
```

#### **3️⃣ Lazy Loading**
```typescript
// Only load floor plan when map zoomed in
if (map.getZoom() > 15) {
  loadFloorPlanLayer();
} else {
  hideFloorPlanLayer(); // Too far to see details anyway
}
```

#### **4️⃣ Caching**
```typescript
// Cache transformation matrix
const cacheKey = `floor-plan-${floorPlanId}-transform`;
const cachedMatrix = localStorage.getItem(cacheKey);
if (cachedMatrix) {
  return JSON.parse(cachedMatrix); // Instant!
} else {
  const matrix = calculateTransformation(controlPoints);
  localStorage.setItem(cacheKey, JSON.stringify(matrix));
  return matrix;
}
```

#### **5️⃣ Virtual Layers**
```typescript
// Only render visible layers
const visibleLayers = floorPlans.filter(fp => fp.visible);
const inViewLayers = visibleLayers.filter(fp =>
  isInMapBounds(fp.bounds, map.getBounds())
);

// Only render floor plans currently in view
inViewLayers.forEach(fp => renderLayer(fp));
```

---

## 🎯 SUCCESS METRICS

**How do we know we succeeded?**

✅ **User can upload DXF in < 5 seconds** (parsing time)
✅ **User can georeference in < 2 minutes** (4 control points)
✅ **Floor plan renders with < 1m accuracy** (RMS error)
✅ **Map performance stays smooth** (> 30 FPS με floor plan)
✅ **Zero compilation errors** (TypeScript strict)
✅ **Zero runtime errors** (comprehensive error handling)

---

## 📝 NEXT STEPS

1. **Review this roadmap** με Γιώργο
2. **Refine unclear sections**
3. **Start Phase 1 implementation** (Upload & Parse)
4. **Follow roadmap step-by-step**
5. **Update roadmap** as we learn

---

**📍 Location**: `src/subapps/geo-canvas/floor-plan-system/docs/`
**🚀 Status**: Master Implementation Guide
**📅 Created**: 2025-10-10
**👨‍💻 Author**: Claude Code Assistant
