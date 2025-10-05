# ⚠️ ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΑ ΣΥΣΤΗΜΑΤΑ - NAVIGATION POINTER

> **ΣΗΜΑΝΤΙΚΟ**: Αυτό το αρχείο είναι **υπενθύμιση** για την τεκμηρίωση των κεντρικοποιημένων συστημάτων.
>
> Η πλήρης Enterprise documentation βρίσκεται στο **`docs/`** directory.

---

## 🎯 ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ = SINGLE SOURCE OF TRUTH

Όλα τα συστήματα σε αυτό το project είναι **κεντρικοποιημένα**.

Για να δεις **ΠΩΣ** και **ΠΟΥ** είναι κεντρικοποιημένα, πήγαινε στα:

---

## 📚 ENTERPRISE DOCUMENTATION

### 🗺️ **Ξεκίνα από εδώ:**
→ **[docs/README.md](./docs/README.md)** - Navigation index

### 🚨 **ΚΟΙΝΑ BUGS & ΛΥΣΕΙΣ:**
→ **[DXF_LOADING_FLOW.md](./DXF_LOADING_FLOW.md)** - DXF Loading Bug Fix Guide (4 μήνες lost time!)

### 🏗️ **Architecture (Πώς λειτουργεί το σύστημα):**

1. **[docs/architecture/overview.md](./docs/architecture/overview.md)**
   - Design Principles (Single Source of Truth, Context-based DI, Fallback chains)
   - System Architecture
   - Core Patterns (Manager classes, Services, Hooks)
   - Data Flow

2. **[docs/architecture/entity-management.md](./docs/architecture/entity-management.md)**
   - Registry-based Rendering (RendererRegistry)
   - Entity Renderers (LINE, CIRCLE, ARC, TEXT, κλπ.)
   - EntityMergeService
   - Entity Validation

3. **[docs/architecture/coordinate-systems.md](./docs/architecture/coordinate-systems.md)**
   - Coordinate Spaces (World, Screen, Viewport)
   - CoordinateTransforms (το ΜΟΝΟ σημείο για transforms)
   - Y-axis flip behavior
   - Transform mathematics

4. **[docs/architecture/state-management.md](./docs/architecture/state-management.md)**
   - Context Providers (CanvasContext, SelectionContext, GripContext)
   - Zustand Stores
   - Custom Stores (OverlayStore pattern)
   - State Flow

### ⚙️ **Systems (Κεντρικοποιημένα συστήματα):**

1. **[docs/systems/zoom-pan.md](./docs/systems/zoom-pan.md)**
   - ZoomManager (το ΜΟΝΟ σημείο για zoom)
   - Enterprise Features (Ctrl+Wheel, Shift+Wheel)
   - DPI-aware 100% zoom
   - Browser conflict resolution

### 📖 **Reference (Αναφορές classes):**

1. **[docs/reference/class-index.md](./docs/reference/class-index.md)**
   - Alphabetical index (100+ classes)
   - Quick lookup by feature
   - "I want to..." guide

---

## ✅ ΚΑΝΟΝΕΣ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗΣ

### 1️⃣ **ZOOM & PAN**
- ❌ ΟΧΙ custom zoom logic
- ❌ ΟΧΙ duplicate zoom transform calculations
- ✅ ΜΟΝΟ `ZoomManager` από `CanvasContext`
- ✅ ΜΟΝΟ `CoordinateTransforms.calculateZoomTransform()` για zoom-to-cursor calculations
- 🏢 **ENTERPRISE (2025-10-04)**: Viewport Dependency Injection
  - ZoomManager αποθηκεύει viewport reference (constructor injection)
  - `setViewport()` για canvas resize updates
  - Εξάλειψη hardcoded `{ width: 800, height: 600 }`
- 🏢 **ENTERPRISE (2025-10-04)**: Zoom Transform Centralization
  - Αφαιρέθηκε duplicate `calculateZoomTransform()` από `systems/zoom/utils/calculations.ts`
  - ZoomManager χρησιμοποιεί πλέον `CoordinateTransforms.calculateZoomTransform()` (single source of truth)
  - Εξάλειψη διπλότυπης zoom-to-cursor formula (2 διαφορετικές formulas → 1 centralized)
- 🎯 **CRITICAL FIX (2025-10-04)**: Zoom-to-Cursor με Margins Adjustment
  - **Το Πρόβλημα**: zoomCenter είναι canvas-relative (0,0 = top-left), αλλά world (0,0) εμφανίζεται στο (80, 30)
  - **Η Λύση**: Adjust zoomCenter για MARGINS πριν εφαρμόσουμε CAD zoom formula
  - **Αλγόριθμος**:
    1. Adjust zoomCenter: `adjustedCenter = zoomCenter - MARGINS`
    2. Classic CAD formula: `offsetNew = adjustedCenter - (adjustedCenter - offsetOld) * zoomFactor`
    3. Το world point κάτω από cursor παραμένει σταθερό! ✅
  - **Based on**: StackOverflow CAD best practices & FreeCAD implementation pattern
  - **Αποτέλεσμα**: Zoom-to-cursor δουλεύει σωστά με margins! 🎯
  - **Duplicate Removed**: Fallback zoom formula στο `useCentralizedMouseHandlers.ts` → Uses CoordinateTransforms
  - Fixed hardcoded margins στο `LayerRenderer.ts` (line 442, 444)
- 📍 Δες: `docs/systems/zoom-pan.md`
- 📍 **Fix 2025-10-04**: Enterprise viewport injection + centralized zoom calculations + margins adjustment για accurate zoom-to-cursor

### 2️⃣ **ENTITY RENDERING**
- ❌ ΟΧΙ custom renderers
- ✅ ΜΟΝΟ `RendererRegistry.getRenderer(type)`
- 📍 Δες: `docs/architecture/entity-management.md`

### 3️⃣ **COORDINATE TRANSFORMS**
- ❌ ΟΧΙ manual transforms
- ❌ ΟΧΙ hardcoded margins (left: 80, top: 30)
- ✅ ΜΟΝΟ `CoordinateTransforms.worldToScreen()` / `screenToWorld()`
- ✅ ΜΟΝΟ `COORDINATE_LAYOUT.MARGINS` για ruler offsets
- 📍 Δες: `docs/architecture/coordinate-systems.md`
- 📍 **Fix 2025-10-04**: Removed hardcoded margins από zoom calculations

### 4️⃣ **STATE MANAGEMENT**
- ❌ ΟΧΙ local state για shared data
- ✅ ΜΟΝΟ Context API ή Zustand stores
- 📍 Δες: `docs/architecture/state-management.md`

### 5️⃣ **SELECTION**
- ❌ ΟΧΙ custom selection logic
- ✅ ΜΟΝΟ `SelectionManager` από `SelectionContext`
- 📍 Δες: `docs/architecture/overview.md`

### 6️⃣ **HIT TESTING**
- ❌ ΟΧΙ manual hit detection
- ✅ ΜΟΝΟ `HitTestingService.findEntityAt()`
- 📍 Δες: `docs/reference/class-index.md`

### 7️⃣ **SNAP ENGINES**
- ❌ ΟΧΙ duplicate spatial index logic
- ✅ ΜΟΝΟ `BaseSnapEngine.initializeSpatialIndex()`
- ✅ ΜΟΝΟ `BaseSnapEngine.calculateBoundsFromPoints()`
- 📍 **Κεντρικοποίηση 2025-10-03**: Εξάλειψη 236 γραμμών duplicates

### 8️⃣ **GEOMETRY UTILITIES (2025-10-03)**
- ❌ ΟΧΙ duplicate distance calculations
- ✅ ΜΟΝΟ `calculateDistance()` από `rendering/entities/shared/geometry-rendering-utils.ts`
- ✅ ΜΟΝΟ `getBoundsCenter()` από `systems/zoom/utils/bounds.ts`
- 📍 **Κεντρικοποίηση 2025-10-03**:
  - Επαναφορά missing `calculateDistance()` function
  - Εξάλειψη 3 duplicate `distance()` implementations
  - Εξάλειψη 2 duplicate `getBounds*()` implementations
  - Re-exports για backward compatibility

### 9️⃣ **TRANSFORM CONSTANTS (2025-10-04)**
- ❌ ΟΧΙ hardcoded transform/zoom limits
- ✅ ΜΟΝΟ `config/transform-config.ts` (Single source of truth)
- 📍 **Κεντρικοποίηση 2025-10-04**:
  - Unified transform config (scale limits, zoom factors, pan speeds)
  - Resolved critical inconsistency (MIN_SCALE: 0.01 vs 0.1 - 10x conflict!)
  - Industry-standard zoom factors (AutoCAD/Blender/Figma: 1.1)
  - Validation helpers με epsilon tolerance
  - Complete backward compatibility (zoom-constants.ts re-exports)
- 📄 **Migration Status**:
  - ✅ `hooks/state/useCanvasTransformState.ts` → Using transform-config
  - ✅ `systems/zoom/zoom-constants.ts` → Re-exports from transform-config
  - ✅ `systems/zoom/ZoomManager.ts` → Auto-updated via re-exports
  - ✅ `ui/toolbar/ZoomControls.tsx` → Using ZOOM_FACTORS.BUTTON_IN (20%)

---

## 🚨 ΠΡΙΝ ΓΡΑΨΕΙΣ ΚΩΔΙΚΑ

**ΠΑΝΤΑ** ελέγξε πρώτα:

1. ✅ Υπάρχει ήδη κεντρικοποιημένο σύστημα για αυτό;
2. ✅ Ψάξε στο `docs/reference/class-index.md`
3. ✅ Διάβασε το αντίστοιχο `docs/architecture/` ή `docs/systems/`
4. ✅ ΜΗΝ δημιουργήσεις διπλότυπο!

---

## 📊 ΣΤΑΤΙΣΤΙΚΑ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗΣ

| Σύστημα | Κεντρικό Class/Hook | Path | Docs |
|---------|-------------------|------|------|
| **Zoom** | `ZoomManager` | `systems/zoom/` | [zoom-pan.md](./docs/systems/zoom-pan.md) |
| **Entities** | `RendererRegistry` | `rendering/` | [entity-management.md](./docs/architecture/entity-management.md) |
| **Transforms** | `CoordinateTransforms` + `COORDINATE_LAYOUT` | `rendering/core/` | [coordinate-systems.md](./docs/architecture/coordinate-systems.md) |
| **State** | `CanvasContext` | `contexts/` | [state-management.md](./docs/architecture/state-management.md) |
| **Selection** | `SelectionManager` | `systems/selection/` | [overview.md](./docs/architecture/overview.md) |
| **Hit Test** | `HitTestingService` | `services/` | [class-index.md](./docs/reference/class-index.md) |
| **Drawing** | `useDrawingHandlers` | `hooks/drawing/` | [state-management.md](./docs/architecture/state-management.md#usedrawinghandlers-κεντρικο---2025-10-03) |
| **Snap** | `SnapContext` | `snapping/context/` | [state-management.md](./docs/architecture/state-management.md#f-snapcontext-κεντρικο---2025-10-03) |
| **Snap Engines** | `BaseSnapEngine` | `snapping/shared/` | - Spatial index initialization<br>- Bounds calculation |
| **Distance** | `calculateDistance` | `rendering/entities/shared/geometry-rendering-utils.ts` | Single source of truth για distance calculations |
| **Bounds Utilities** | `getBoundsCenter` | `systems/zoom/utils/bounds.ts` | Κεντρικό bounds utilities |
| **Transform Constants** | `TRANSFORM_CONFIG` | `config/transform-config.ts` | All transform/zoom/pan constants centralized |
| **Layer Colors** | `getLayerColor` | `config/color-config.ts` | DXF layer color assignment (hash-based) |
| **Entity Rendering** | `PhaseManager` | `systems/phase-manager/PhaseManager.ts` | 3-phase rendering system (preview/normal/interactive) |
| **Arc Rendering** | `drawCentralizedArc` | `rendering/entities/BaseEntityRenderer.ts` | Y-axis flip για DXF arcs |

---

## 🎯 QUICK LOOKUP

**"Θέλω να..."**

- **...προσθέσω zoom** → `ZoomManager` από `CanvasContext` → [zoom-pan.md](./docs/systems/zoom-pan.md)
- **...render entity** → `RendererRegistry` → [entity-management.md](./docs/architecture/entity-management.md)
- **...transform coordinates** → `CoordinateTransforms` + `COORDINATE_LAYOUT.MARGINS` → [coordinate-systems.md](./docs/architecture/coordinate-systems.md)
- **...detect click** → `HitTestingService` → [class-index.md](./docs/reference/class-index.md)
- **...manage state** → Context API / Zustand → [state-management.md](./docs/architecture/state-management.md)
- **...add drawing/measurement** → `useDrawingHandlers` από `useDxfViewerState` → [state-management.md](./docs/architecture/state-management.md#usedrawinghandlers-κεντρικο---2025-10-03)
- **...enable/disable snap** → `SnapContext` → [state-management.md](./docs/architecture/state-management.md#f-snapcontext-κεντρικο---2025-10-03)
- **...υπολογίσω απόσταση** → `calculateDistance()` από `geometry-rendering-utils.ts`
- **...υπολογίσω bounds center** → `getBoundsCenter()` από `systems/zoom/utils/bounds.ts`

---

## 💡 REMEMBER

> **Κεντρικοποίηση** = Single Source of Truth = Zero Duplication
>
> Πριν γράψεις νέο κώδικα, **ΠΑΝΤΑ** ψάξε πρώτα στα docs!

---

## 🏢 ENTERPRISE FEATURES (2025-10-03)

### Zoom & Pan:
✅ **Ctrl+Wheel** → Fast zoom (2x speed)
✅ **Shift+Wheel** → Horizontal pan
✅ **ZoomManager** → Centralized zoom control
✅ **DPI-aware 100%** → True 1:1 zoom
✅ **Browser conflicts** → Resolved

📍 Δες όλα: [docs/systems/zoom-pan.md](./docs/systems/zoom-pan.md)

### Snap Engines (2025-10-03):
✅ **BaseSnapEngine** → Single source of truth για spatial indexing
✅ **initializeSpatialIndex()** → Κεντρικοποιημένη spatial index δημιουργία
✅ **calculateBoundsFromPoints()** → Κεντρικοποιημένος bounds calculation
✅ **~236 γραμμές duplicates εξαλείφθηκαν** → Zero duplication

**Engines κεντρικοποιημένα:**
- EndpointSnapEngine → BaseSnapEngine
- MidpointSnapEngine → BaseSnapEngine
- CenterSnapEngine → BaseSnapEngine
- NodeSnapEngine → BaseSnapEngine

### Geometry Utilities (2025-10-03):
✅ **calculateDistance()** → Single source of truth για distance calculations
✅ **Re-exports** → Backward compatibility διατηρημένη
✅ **Zero breaking changes** → Όλα τα existing imports λειτουργούν

**Κεντρικοποιημένες functions:**
- `distance()` από `GeometryUtils.ts` → Re-export calculateDistance
- `distance()` από `zoom/utils/calculations.ts` → Re-export calculateDistance
- `calculateGripDistance()` από `grips/utils.ts` → Re-export calculateDistance
- `getBoundsCenter()` από `calculations.ts` → Moved to `bounds.ts`

**Αποτέλεσμα:**
- 🔥 **CRITICAL FIX**: calculateDistance restored (20+ broken imports fixed)
- ♻️ **4 duplicates eliminated**: All distance calculations now centralized
- ✅ **Backward compatible**: All existing code continues to work

---

## 📁 DIRECTORY STRUCTURE

```
src/subapps/dxf-viewer/
├── docs/                           ← 🎯 ENTERPRISE DOCUMENTATION
│   ├── README.md                   ← Ξεκίνα εδώ!
│   ├── architecture/               ← Πώς λειτουργεί
│   ├── systems/                    ← Κεντρικοποιημένα συστήματα
│   └── reference/                  ← Class index
├── systems/                        ← Κώδικας κεντρικών συστημάτων
│   ├── zoom/
│   ├── selection/
│   └── ...
├── rendering/                      ← Entity rendering + transforms
├── services/                       ← Stateless utilities
└── contexts/                       ← State management
```

---

## ⚡ ΤΕΛΕΥΤΑΙΑ ΥΠΕΝΘΥΜΙΣΗ

Αυτό το αρχείο είναι **pointer**, όχι documentation.

Για **πλήρη τεκμηρίωση**, πήγαινε πάντα στο:

### → **[docs/README.md](./docs/README.md)** ←

---

## 🔧 CRITICAL FIXES (2025-10-04)

### 🎨 **Layer Colors Fix**
**Πρόβλημα**: DXF entities εμφανίζονταν ΟΛΕΣ λευκές, αγνοούσαν τα layer colors

**Root Cause**:
1. Entities δεν είχαν `color` property → **Fixed in**: `dxf-scene-builder.ts`
2. PhaseManager αγνοούσε το `entity.color` → **Fixed in**: `PhaseManager.ts`

**Λύση**:
- `DxfSceneBuilder`: Προσθήκη layer color σε κάθε entity κατά την δημιουργία
- `PhaseManager`: Χρήση `entity.color` για normal phase rendering

**Files Changed**:
- `utils/dxf-scene-builder.ts` (lines 31-41)
- `systems/phase-manager/PhaseManager.ts` (lines 154-161)

### 🔄 **Arc Y-Axis Flip Fix**
**Πρόβλημα**: Τα τεταρτημόρια πορτών ήταν ανάποδα

**Root Cause**: DXF coordinate system (Y πάνω) vs Canvas (Y κάτω)

**Λύση**: Αντιστροφή γωνιών για canvas rendering
```typescript
const canvasStartAngle = -startAngle;  // Flip Y-axis
const canvasEndAngle = -endAngle;
```

**Files Changed**:
- `rendering/entities/BaseEntityRenderer.ts` (lines 467-476)

### 🗑️ **Cleanup: Unused Rendering System**
**Διαγραφή**: ~800 γραμμές διπλότυπου/unused code

**Deleted**:
- `rendering/passes/EntityPass.ts` (438 lines)
- `rendering/passes/BackgroundPass.ts`
- `rendering/passes/OverlayPass.ts`
- `rendering/passes/index.ts`
- `rendering/core/RenderPipeline.ts` (~300 lines)

**Αιτιολογία**: Experimental code που ΠΟΤΕ δεν χρησιμοποιήθηκε. Το actual rendering χρησιμοποιεί:
`DxfRenderer` → `EntityRendererComposite` → `BaseEntityRenderer` → `PhaseManager`

### 📝 **Text Rendering Fix (2025-10-04)**
**Πρόβλημα**: Τα κείμενα από DXF εμφανίζονταν **πολύ μικρά** (4 μήνες debugging!)

**Root Cause**: `renderStyledTextWithOverride()` αγνοούσε το DXF entity height
- TextRenderer υπολόγιζε σωστά `screenHeight = height * scale`
- **ΑΛΛΑ** το `renderStyledTextWithOverride()` χρησιμοποιούσε `textStyleStore.fontSize` (default 12px)
- Αποτέλεσμα: DXF text heights (0.132 units) → ΑΓΝΟΟΥΝΤΑΝ!

**Λύση**: Άμεση χρήση `ctx.fillText()` με το DXF entity height
```typescript
// ΠΡΙΝ (ΛΑΘΟΣ):
this.ctx.font = `${screenHeight}px Arial`;
renderStyledTextWithOverride(this.ctx, text, x, y);  // ΑΓΝΟΟΥΣΕ το font!

// ΤΩΡΑ (ΣΩΣΤΟ):
this.ctx.font = `${screenHeight}px Arial`;
this.ctx.fillText(text, screenPos.x, screenPos.y);  // ✅ Χρησιμοποιεί DXF height!
```

**Files Changed**:
- `rendering/entities/TextRenderer.ts` (lines 34-63)

**Console Log Evidence**:
```
📝 TEXT: "www.pagonis.com.gr", height=0.10575, scale=50.00, screenHeight=5.3px  ← ΠΟΛΥ ΜΙΚΡΟ!
```

**Αποτέλεσμα**: Τα κείμενα τώρα εμφανίζονται με το **σωστό μέγεθος** από το DXF! ✅

---

*Ημερομηνία δημιουργίας modular docs: 2025-10-03*
*Τελευταία ενημέρωση: 2025-10-04 - Layer colors, Arc flip, Text rendering fix*
*Αρχείο υπενθύμισης κεντρικοποίησης - Μη διαγράψεις!*
