# 📦 FLOOR PLAN PARSERS

**Format-specific parsers organized by complexity**

---

## 📁 FOLDER STRUCTURE

```
parsers/
├── 🎨 vector/                  # Vector Formats (Complex)
│   ├── DxfParser.ts           # DXF → GeoJSON
│   ├── DwgParser.ts           # DWG → GeoJSON
│   └── index.ts
│
├── 🖼️ raster/                  # Raster Formats (Simple)
│   ├── ImageParser.ts         # PNG/JPG/TIFF → Image URL
│   ├── PdfParser.ts           # PDF → Image (future)
│   └── index.ts
│
├── 🔧 utils/                   # Shared Utilities (future)
│   └── format-detector.ts
│
├── index.ts                    # Main export
└── README.md                   # This file
```

---

## 🎨 **VECTOR PARSERS** (Complex)

### **Τι είναι Vector Formats;**
- **CAD drawings** με geometric entities (lines, polylines, arcs, text)
- **Scalable** - μπορείς να κάνεις zoom χωρίς να χάσεις ποιότητα
- **Editable** - entities are objects, not pixels
- **Structured data** - layers, colors, line types

### **1️⃣ DXF Parser** (`vector/DxfParser.ts`)

**Format**: AutoCAD Drawing Exchange Format
**Status**: 🎯 Phase 1 (Next)

**What it does:**
- Parses DXF file structure
- Extracts entities (lines, polylines, circles, text, etc.)
- Converts to GeoJSON για vector rendering
- Preserves layer information
- Handles coordinate transformation

**Output:**
```typescript
{
  success: true,
  format: 'DXF',
  geoJSON: {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [...] },
        properties: { layer: 'WALLS', color: '#000000' }
      },
      // ... more features
    ]
  },
  layers: ['WALLS', 'DOORS', 'WINDOWS', 'TEXT'],
  entities: 1234
}
```

**Usage:**
```typescript
import { parseDxf } from './parsers';

const result = await parseDxf(dxfFile);
if (result.success) {
  // Render as MapLibre GeoJSON layer
  <Source id="dxf-layer" type="geojson" data={result.geoJSON}>
    <Layer type="line" paint={{ 'line-color': '#000' }} />
  </Source>
}
```

---

### **2️⃣ DWG Parser** (`vector/DwgParser.ts`)

**Format**: AutoCAD Drawing (Native Format)
**Status**: 📋 Phase 5 (Future)

**Challenges:**
- Proprietary format (no public spec)
- Limited browser support
- May require server-side conversion (DWG → DXF)

**Output**: Same as DXF (GeoJSON)

---

## 🖼️ **RASTER PARSERS** (Simple)

### **Τι είναι Raster Formats;**
- **Pixel-based images** (bitmap, not vector)
- **Fixed resolution** - zoom = pixelation
- **Simple structure** - just pixels
- **Universal support** - browser handles automatically

### **1️⃣ Image Parser** (`raster/ImageParser.ts`)

**Formats**: PNG, JPG, TIFF, BMP, GIF, WEBP
**Status**: ✅ **COMPLETE**

**💡 KEY INSIGHT:**
**ΕΝΑΣ parser για ΟΛΕΣ τις εικόνες!**

Γιατί;
- Όλες οι εικόνες είναι **pixel-based** (raster)
- Browser APIs (`Image`, `Canvas`) διαχειρίζονται ΟΛΕΣ τις formats αυτόματα
- **Georeferencing είναι ίδιο** για όλες (4 control points → bounds)
- **Rendering είναι ίδιο** (MapLibre Image Layer)

**What it does:**
```typescript
✅ Validates image file
✅ Detects format (PNG/JPG/TIFF)
✅ Loads image using browser Image API
✅ Extracts metadata (width, height, aspect ratio)
✅ Generates thumbnail για preview
✅ Optimizes large images (4K+ → compressed)
✅ Creates image URL για rendering
```

**Output:**
```typescript
{
  success: true,
  format: 'PNG',
  imageUrl: 'blob:http://...',  // For rendering
  thumbnail: 'data:image/png;base64,...',  // For preview
  metadata: {
    width: 2048,
    height: 1536,
    format: 'PNG',
    mimeType: 'image/png',
    size: 1234567,  // bytes
    aspectRatio: 1.333,
    hasAlpha: true  // Transparency support
  }
}
```

**Usage:**
```typescript
import { parseImage } from './parsers';

const result = await parseImage(imageFile);
if (result.success) {
  // Show thumbnail preview
  <img src={result.thumbnail} alt="Preview" />

  // After georeferencing, render as MapLibre Image Layer
  <Source
    id="floor-plan-image"
    type="image"
    url={result.imageUrl}
    coordinates={bounds.corners}
  >
    <Layer type="raster" paint={{ 'raster-opacity': 0.8 }} />
  </Source>
}
```

**Supported Formats:**
```typescript
SUPPORTED_IMAGE_FORMATS = {
  PNG: {
    useCase: 'Floor plans με text και sharp lines',
    pros: ['Lossless compression', 'Transparency support', 'Best για technical drawings'],
    cons: ['Larger files']
  },
  JPG: {
    useCase: 'Scanned floor plans, photos',
    pros: ['Small files', 'Universal support'],
    cons: ['Lossy compression', 'No transparency', 'Artifacts σε sharp lines']
  },
  TIFF: {
    useCase: 'Professional CAD exports, high-quality scans',
    pros: ['Highest quality', 'Transparency support', 'Professional standard'],
    cons: ['Very large files', 'Slower loading']
  }
}
```

---

### **2️⃣ PDF Parser** (`raster/PdfParser.ts`)

**Format**: Portable Document Format
**Status**: 📋 Phase 2 (Planned)

**What it does:**
- Uses pdf.js library
- Renders PDF page to canvas
- Exports as PNG image
- Same workflow as ImageParser after that

**Output**: Same as ImageParser (image URL + metadata)

---

## 🔧 **UTILITY FUNCTIONS**

### **Format Detection:**
```typescript
import { detectFormat } from './parsers';

const format = detectFormat(file);
// 'DXF' | 'DWG' | 'PNG' | 'JPG' | 'TIFF' | 'PDF'
```

### **Format Classification:**
```typescript
import { isVectorFormat, isRasterFormat } from './parsers';

if (isVectorFormat(format)) {
  // DXF, DWG → GeoJSON rendering
}

if (isRasterFormat(format)) {
  // PNG, JPG, TIFF, PDF → Image rendering
}
```

### **Auto Parser Selection:**
```typescript
import { getParser } from './parsers';

const parser = await getParser(format);
const result = await parser.parse(file);
```

---

## 📊 **COMPARISON: Vector vs Raster**

| Feature | Vector (DXF, DWG) | Raster (PNG, JPG, TIFF) |
|---------|-------------------|-------------------------|
| **Scalability** | ✅ Infinite zoom | ❌ Pixelation |
| **File Size** | ⚠️ Small-Medium | ✅ Small (JPG) / ❌ Large (TIFF) |
| **Editing** | ✅ Edit entities | ❌ Pixel editing only |
| **Complexity** | ❌ Complex parsing | ✅ Simple (browser handles) |
| **Rendering** | GeoJSON Layer | Image Layer |
| **Transparency** | ✅ Per entity | ⚠️ PNG/TIFF only |
| **Use Case** | CAD drawings | Scanned plans, photos |

---

## 🎯 **IMPLEMENTATION STATUS**

| Parser | Format | Status | Priority | Lines of Code |
|--------|--------|--------|----------|---------------|
| **ImageParser** | PNG/JPG/TIFF | ✅ **COMPLETE** | HIGH | ~400 lines |
| **DxfParser** | DXF | 🎯 Phase 1 | HIGH | Planned |
| **PdfParser** | PDF | 📋 Phase 2 | MEDIUM | Planned |
| **DwgParser** | DWG | 📋 Phase 5 | LOW | Planned |

---

## 🚀 **NEXT STEPS**

### **Phase 1: DXF Parser Implementation**
1. Install `dxf-parser` library
2. Implement DxfParser.parse()
3. Convert entities to GeoJSON
4. Handle layer extraction
5. Test με sample DXF files

### **Phase 2: PDF Parser Implementation**
1. Install `pdf.js` library
2. Render PDF to canvas
3. Export as PNG
4. Integrate με ImageParser

---

## 💡 **KEY INSIGHTS**

### **✅ Why ONE ImageParser για όλες τις εικόνες:**
1. **Browser APIs** διαχειρίζονται όλα τα formats (PNG, JPG, TIFF, etc.)
2. **Georeferencing** είναι **ίδιο** για όλες (4 control points → bounds)
3. **Rendering** είναι **ίδιο** (MapLibre Image Layer με image URL)
4. **Μόνη διαφορά**: Compression & quality (αλλά αυτό το κάνει ο browser)

### **❌ Why NOT separate parsers για PNG, JPG, TIFF:**
- **Code duplication** (ίδιος κώδικας 3 φορές)
- **More files to maintain**
- **No benefit** (browser handles all formats the same way)

### **✅ Why SEPARATE parsers για DXF, DWG:**
- **Different structures** (DXF = text-based, DWG = binary)
- **Different libraries** needed
- **Complex entity parsing** (lines, polylines, arcs, etc.)
- **Different output** (GeoJSON vs Image)

---

**Location**: `src/subapps/geo-canvas/floor-plan-system/parsers/`
**Status**: ✅ ImageParser Complete, DXF/DWG/PDF Planned
