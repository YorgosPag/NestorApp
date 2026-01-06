================================================================================
🎯 ΑΝΑΦΟΡΑ ΕΥΡΗΜΑΤΩΝ: CURSOR-SNAP ALIGNMENT INVESTIGATION
================================================================================
Ημερομηνία: 2025-10-03
Θέμα: Ανάλυση "κόκκινου σταυρουδάκι με κίτρινη μπαλίτσα" alignment issue

================================================================================
📌 ΕΡΩΤΗΜΑ 1: ΠΟΙΟΣ ΣΧΕΔΙΑΖΕΙ ΤΟ ΚΟΚΚΙΝΟ ΣΤΑΥΡΟ ΜΕ ΤΗΝ ΚΙΤΡΙΝΗ ΜΠΑΛΑ;
================================================================================

✅ ΑΠΑΝΤΗΣΗ:
------------
Το "κόκκινο σταυρουδάκι με κίτρινη μπαλίτσα" σχεδιάζεται από τον **SnapRenderer**.

📁 LOCATION:
-----------
File: src/subapps/dxf-viewer/rendering/ui/snap/SnapRenderer.ts
Γραμμές: 136-225 (renderSnapShape method)

🎨 ΤΙ ΕΙΝΑΙ ΣΤΗΝ ΠΡΑΓΜΑΤΙΚΟΤΗΤΑ:
--------------------------------
Όχι "σταυρός" αλλά **ΤΕΤΡΑΓΩΝΟ** (square) για endpoint snaps:
- **Κόκκινο τετράγωνο** = Endpoint snap indicator (γραμμή 148-149)
- **Κίτρινη μπάλα** = Default snap color ή Center snap indicator

📊 SNAP COLORS (από SnapTypes.ts γραμμές 84-104):
-------------------------------------------------
DEFAULT_SNAP_SETTINGS:
  - color: '#ffff00'              // ΚΙΤΡΙΝΟ (default)
  - endpointColor: '#ff0000'      // ΚΟΚΚΙΝΟ (endpoints)
  - midpointColor: '#00ff00'      // ΠΡΑΣΙΝΟ (midpoints)
  - centerColor: '#0000ff'        // ΜΠΛΕ (centers)
  - intersectionColor: '#ff00ff'  // MAGENTA (intersections)

🔍 SNAP SHAPES (SnapRenderer.ts γραμμές 146-220):
--------------------------------------------------
'endpoint'     → SQUARE (τετράγωνο - ctx.rect)
'midpoint'     → TRIANGLE (τρίγωνο)
'center'       → CIRCLE (κύκλος - ctx.arc)
'intersection' → X SHAPE (διασταύρωση)
'perpendicular'→ RIGHT ANGLE (ορθή γωνία)
'parallel'     → PARALLEL LINES (παράλληλες γραμμές)
'tangent'      → CIRCLE WITH LINE (κύκλος με εφαπτομένη)
'quadrant'     → DIAMOND (ρόμβος)

🚀 RENDERING CALL CHAIN:
------------------------
1. LayerRenderer.ts:336
   └─> this.snapRenderer.render(options.snapResults, viewport, snapSettings)

2. SnapRenderer.ts:73 (renderSnapIndicators)
   └─> Loop through all snap results
       └─> this.renderSnapIndicator(ctx, snap, viewport, settings, mode)

3. SnapRenderer.ts:99 (renderSnapIndicator)
   └─> Get color: this.getSnapColor(snap.type, settings) [γραμμή 109]
   └─> Set styles: ctx.strokeStyle = color [γραμμή 110]
   └─> Render shape: this.renderSnapShape(ctx, snap, actualSize) [γραμμή 123]

4. SnapRenderer.ts:136 (renderSnapShape)
   └─> Extract position: const { x, y } = snap.point [γραμμή 141]
   └─> Switch case based on snap.type
   └─> For 'endpoint': ctx.rect(x - halfSize, y - halfSize, size, size) [γραμμή 149]

================================================================================
📌 ΕΡΩΤΗΜΑ 2: ΠΟΙΟ ΣΥΣΤΗΜΑ ΣΥΝΤΕΤΑΓΜΕΝΩΝ ΧΡΗΣΙΜΟΠΟΙΕΙ;
================================================================================

✅ ΑΠΑΝΤΗΣΗ:
------------
Ο SnapRenderer χρησιμοποιεί **SCREEN COORDINATES** (pixel coordinates).

🔬 ΑΠΟΔΕΙΞΗ:
------------

1️⃣ DIRECT CANVAS USAGE (χωρίς μετατροπή):
------------------------------------------
File: SnapRenderer.ts γραμμή 141
```typescript
const { x, y } = snap.point;
```

Στη γραμμή 149 (για endpoint):
```typescript
ctx.rect(x - halfSize, y - halfSize, size, size);
```

Στη γραμμή 162 (για center):
```typescript
ctx.arc(x, y, halfSize, 0, Math.PI * 2);
```

❌ ΔΕΝ ΥΠΑΡΧΕΙ καμία μετατροπή συντεταγμένων!
❌ ΔΕΝ χρησιμοποιεί CoordinateTransforms.worldToScreen()
❌ ΔΕΝ χρησιμοποιεί viewport transformations

Τα (x, y) πηγαίνουν **ΑΠΕΥΘΕΙΑΣ** στο canvas context.

2️⃣ CANVAS 2D CONTEXT RENDERING:
--------------------------------
Το Canvas 2D context σχεδιάζει πάντα σε **screen pixels** (device coordinates).
Δεν υπάρχει world coordinate system στο native canvas API.

3️⃣ SNAP ORCHESTRATOR FLOW:
---------------------------
File: snapping/orchestrator/SnapOrchestrator.ts

Γραμμή 69: findSnapPoint(cursorPoint: Point2D, ...)
Γραμμή 90: const context = this.contextManager.createEngineContext(cursorPoint, ...)
Γραμμή 105: const result = engine.findSnapCandidates(cursorPoint, context)
Γραμμή 131: return this.processor.processResults(cursorPoint, allCandidates, settings)

File: snapping/orchestrator/SnapCandidateProcessor.ts
Γραμμή 37: snappedPoint: bestCandidate.point

Το cursorPoint που μπαίνει είναι σε **screen coordinates**.
Το snappedPoint που βγαίνει είναι σε **screen coordinates**.

4️⃣ DEBUG OVERLAY VERIFICATION:
-------------------------------
File: debug/CursorSnapAlignmentDebugOverlay.ts

Γραμμή 115-130 (trackSnap method):
```typescript
const snapResults = (window as any).__debugSnapResults || [];
if (snapResults.length > 0) {
  const primarySnap = snapResults[0];
  // ✅ CORRECTION: snapResults.point is ALREADY in screen coordinates!
  // NO transformation needed - use as-is
  this.state.snapPos = primarySnap.point;
}
```

Το comment στη γραμμή 127-128 ΕΠΙΒΕΒΑΙΩΝΕΙ:
"snapResults.point is ALREADY in screen coordinates!"

5️⃣ LAYERRENDERER EXPOSURE:
---------------------------
File: canvas-v2/layer-canvas/LayerRenderer.ts γραμμές 331-335

```typescript
if (typeof window !== 'undefined') {
  (window as any).__debugSnapResults = options.snapResults;
  (window as any).__debugViewport = viewport;
}
this.snapRenderer.render(options.snapResults, viewport, snapSettings);
```

Τα snapResults περνάνε **ΑΠΕΥΘΕΙΑΣ** στον renderer χωρίς μετατροπή.

================================================================================
🎯 ΣΥΜΠΕΡΑΣΜΑ
================================================================================

**ΤΙ ΣΧΕΔΙΑΖΕΤΑΙ:**
- Κόκκινο τετράγωνο = Endpoint snap indicator (#ff0000)
- Κίτρινη μπάλα = Default/Center snap indicator (#ffff00)

**ΠΟΥ ΣΧΕΔΙΑΖΕΤΑΙ:**
- SnapRenderer.ts:136-225 (renderSnapShape method)

**ΠΟΙΟΣ ΤΟ ΚΑΛΕΙ:**
- LayerRenderer.ts:336 → snapRenderer.render()

**ΣΥΣΤΗΜΑ ΣΥΝΤΕΤΑΓΜΕΝΩΝ:**
- **SCREEN COORDINATES** (pixel coordinates)
- Χωρίς καμία μετατροπή world ↔ screen
- Direct rendering στο canvas context

**ΓΙΑΤΙ ΕΙΝΑΙ ΣΗΜΑΝΤΙΚΟ:**
- Για να φτιάξουμε το alignment, πρέπει να εξασφαλίσουμε ότι:
  1. Cursor/Crosshair σχεδιάζονται στις ΙΔΙΕΣ screen coordinates
  2. Snap indicators σχεδιάζονται στις ΙΔΙΕΣ screen coordinates
  3. Debug overlay canvas έχει το ΙΔΙΟ HiDPI scaling (0.75 DPR)

**Η ΔΙΟΡΘΩΣΗ ΠΟΥ ΕΚΑΝΑΜΕ:**
- File: debug/CursorSnapAlignmentDebugOverlay.ts:79-88
- Εφαρμόσαμε το ίδιο HiDPI setup (enableHiDPI: true)
- Χρησιμοποιήσαμε CanvasUtils.setupCanvasContext() για consistency
- Αυτό εξασφαλίζει ότι όλα τα canvas έχουν το ίδιο transform (0.75, 0, 0, 0.75)

================================================================================
📚 ΑΡΧΕΙΑ ΑΝΑΦΟΡΑΣ
================================================================================

RENDERING:
- src/subapps/dxf-viewer/rendering/ui/snap/SnapRenderer.ts
- src/subapps/dxf-viewer/rendering/ui/snap/SnapTypes.ts
- src/subapps/dxf-viewer/canvas-v2/layer-canvas/LayerRenderer.ts

SNAPPING ORCHESTRATION:
- src/subapps/dxf-viewer/snapping/orchestrator/SnapOrchestrator.ts
- src/subapps/dxf-viewer/snapping/orchestrator/SnapCandidateProcessor.ts
- src/subapps/dxf-viewer/snapping/orchestrator/SnapContextManager.ts

DEBUG:
- src/subapps/dxf-viewer/debug/CursorSnapAlignmentDebugOverlay.ts

UTILITIES:
- src/subapps/dxf-viewer/rendering/canvas/utils/CanvasUtils.ts
- src/subapps/dxf-viewer/rendering/core/CoordinateTransforms.ts

================================================================================
✅ ΤΕΛΟΣ ΑΝΑΦΟΡΑΣ
================================================================================

================================================================================
ΕΡΩΤΗΜΑ 3: ΠΟΙΟ ΑΡΧΕΙΟ ΣΧΕΔΙΑΖΕΙ ΣΤΑΥΡΟΝΗΜΑ ΚΑΙ ΚΕΡΣΟΡΑ ΜΕΤΑ ΤΟ REFRESH;
================================================================================

ΑΠΑΝΤΗΣΗ: DxfCanvas.tsx
Location: canvas-v2/dxf-canvas/DxfCanvas.tsx (γραμμές 330-382)

RENDERING:
- Crosshair: LegacyCrosshairAdapter.renderWithGap() (γραμμή 363)
- Cursor: LegacyCursorAdapter.render() (γραμμή 373)

ΡΥΘΜΙΣΕΙΣ (Settings Flow):
1. localStorage: "autocad_cursor_settings"
2. CursorConfiguration (systems/cursor/config.ts)
3. CursorSystem Context
4. useCursorSettings() hook
5. CanvasSection mapping
6. DxfCanvas rendering
7. Adapters → Core Renderers

ΣΗΜΑΝΤΙΚΟ: Crosshair ΚΑΙ Cursor από ΤΟ ΙΔΙΟ unified system!

================================================================================
ΕΡΩΤΗΜΑ 4: ΠΟΙΟ ΣΥΣΤΗΜΑ ΣΥΝΤΕΤΑΓΜΕΝΩΝ ΧΡΗΣΙΜΟΠΟΙΟΥΝ;
================================================================================

ΑΠΑΝΤΗΣΗ: SCREEN COORDINATES (pixel coordinates)

ΑΠΟΔΕΙΞΗ:
1. CursorState interface (config.ts:76): "Screen coordinates"
2. Mouse handler (useCentralizedMouseHandlers.ts:103-106):
   screenPos = { x: e.clientX - rect.left, y: e.clientY - rect.top }
3. CrosshairRenderer (γραμμή 157-159): ctx.moveTo(0, position.y) - ΑΠΕΥΘΕΙΑΣ
4. CursorRenderer (γραμμή 164): ctx.arc(position.x, position.y, ...) - ΑΠΕΥΘΕΙΑΣ
5. Adapters: Περνάνε position ΧΩΡΙΣ μετατροπή

ΣΥΜΠΕΡΑΣΜΑ:
- Crosshair + Cursor + Snap = SCREEN COORDINATES
- Ίδιο σύστημα συντεταγμένων
- Ίδιες πηγές ρυθμίσεων
- Ίδιο HiDPI scaling (0.75 DPR)

================================================================================

================================================================================
ΜΗΧΑΝΙΣΜΟΣ RENDERING: ΚΟΚΚΙΝΟ ΣΤΑΥΡΟΥΔΑΚΙ ΜΕ ΚΙΤΡΙΝΗ ΜΠΑΛΑ
================================================================================

🎯 ΠΛΗΡΗΣ PIPELINE (Step-by-Step):
-----------------------------------

1️⃣ MOUSE EVENT (Η αρχή του pipeline)
   File: systems/cursor/useCentralizedMouseHandlers.ts
   
   handleMouseMove(e) →
   const screenPos = {
     x: e.clientX - rect.left,
     y: e.clientY - rect.top
   }
   → cursor.updatePosition(screenPos)  // Screen coordinates!

2️⃣ SNAP DETECTION SYSTEM
   Το cursor position πηγαίνει στο Snap System:
   
   A) Snap Orchestrator (snapping/orchestrator/SnapOrchestrator.ts)
      - findSnapPoint(cursorPoint, excludeEntityId)
      - Συντονίζει όλους τους snap engines
   
   B) Snap Engines (snapping/engines/*.ts)
      - EndpointSnapEngine → Βρίσκει endpoints
      - CenterSnapEngine → Βρίσκει κέντρα κύκλων
      - MidpointSnapEngine → Βρίσκει midpoints
      - IntersectionSnapEngine → Βρίσκει intersections
      - κ.λπ. (10+ engines)
   
   C) Snap Candidate Processor
      - processResults() → Ταξινομεί candidates
      - Επιλέγει το καλύτερο snap (κοντινότερο στο cursor)
   
   OUTPUT: SnapResult[] με:
      - point: Point2D (SCREEN COORDINATES!)
      - type: SnapType ('endpoint', 'center', etc.)
      - distance: number
      - priority: number

3️⃣ LAYER CANVAS (Receiver)
   File: canvas-v2/layer-canvas/LayerCanvas.tsx
   
   Δέχεται snapResults μέσω renderOptions prop:
   renderOptions = {
     snapResults: [...],  // Από snap system
     showSnapIndicators: true
   }

4️⃣ LAYER RENDERER (Coordinator)
   File: canvas-v2/layer-canvas/LayerRenderer.ts:330-336
   
   render(layers, transform, viewport, ..., renderOptions) {
     // Expose snap results για debugging
     if (typeof window !== 'undefined') {
       (window as any).__debugSnapResults = options.snapResults;
       (window as any).__debugViewport = viewport;
     }
     
     // Render snap indicators
     if (options.showSnapIndicators && snapResults.length) {
       this.snapRenderer.render(snapResults, viewport, snapSettings);
     }
   }

5️⃣ SNAP RENDERER (Drawer)
   File: rendering/ui/snap/SnapRenderer.ts
   
   A) renderSnapIndicators() - γραμμές 73-94
      - Loop σε όλα τα snap results
      - Sort by priority
      - Για κάθε snap: renderSnapIndicator()
   
   B) renderSnapIndicator() - γραμμές 99-131
      - Get color based on type: getSnapColor()
      - Set canvas styles
      - Call renderSnapShape()
   
   C) renderSnapShape() - γραμμές 136-225
      - Extract position: const { x, y } = snap.point
      - Switch based on snap.type:
   
      ΚΟΚΚΙΝΟ ΤΕΤΡΑΓΩΝΟ (endpoint):
      γραμμές 148-149
      case 'endpoint':
        ctx.rect(x - halfSize, y - halfSize, size, size);
        break;
      
      ΚΙΤΡΙΝΗ ΜΠΑΛΑ (center ή default):
      γραμμές 161-162
      case 'center':
        ctx.arc(x, y, halfSize, 0, Math.PI * 2);
        break;
      
      default:
        ctx.arc(x, y, halfSize, 0, Math.PI * 2);
   
   D) ctx.stroke() - Actual drawing στο canvas

6️⃣ CANVAS CONTEXT (Final rendering)
   - Χρησιμοποιεί SCREEN COORDINATES απευθείας
   - HiDPI scaling (0.75 DPR) εφαρμοσμένο από CanvasUtils.setupCanvasContext
   - Direct pixel drawing

🎨 ΧΡΩΜΑΤΑ & ΣΧΗΜΑΤΑ:
---------------------
File: rendering/ui/snap/SnapTypes.ts:84-104

DEFAULT_SNAP_SETTINGS = {
  color: '#ffff00',              // ΚΙΤΡΙΝΟ (default)
  endpointColor: '#ff0000',      // ΚΟΚΚΙΝΟ (endpoints)
  midpointColor: '#00ff00',      // ΠΡΑΣΙΝΟ (midpoints)
  centerColor: '#0000ff',        // ΜΠΛΕ (centers)
  intersectionColor: '#ff00ff',  // MAGENTA (intersections)
  size: 8,
  lineWidth: 2
}

SHAPES:
- endpoint → SQUARE (τετράγωνο)
- midpoint → TRIANGLE (τρίγωνο)
- center → CIRCLE (κύκλος)
- intersection → X SHAPE
- perpendicular → RIGHT ANGLE
- parallel → PARALLEL LINES
- tangent → CIRCLE WITH LINE
- quadrant → DIAMOND

🔍 ΤΙ ΒΛΕΠΕΙΣ ΣΤΗΝ ΟΘΟΝΗ:
--------------------------
Όταν βλέπεις "κόκκινο σταυρουδάκι με κίτρινη μπαλίτσα":

1. ΚΟΚΚΙΝΟ ΤΕΤΡΑΓΩΝΟ = Endpoint snap
   - Snap type: 'endpoint'
   - Color: #ff0000 (κόκκινο)
   - Shape: ctx.rect() (τετράγωνο)
   - Position: Endpoint of a line/arc/polyline

2. ΚΙΤΡΙΝΗ ΜΠΑΛΑ = Center snap ή Default snap
   - Snap type: 'center' (ή άλλο)
   - Color: #ffff00 (κίτρινο) ή #0000ff (μπλε για center)
   - Shape: ctx.arc() (κύκλος)
   - Position: Center of circle/arc

Αν βλέπεις ΔΥΟΤΕΡΑ ταυτόχρονα:
- Πολλαπλά snap points κοντά στο cursor
- Snap orchestrator τα σχεδιάζει όλα
- Το πιο κοντινό έχει υψηλότερο priority

🔄 60FPS RENDERING LOOP:
------------------------
Το snap rendering ΔΕΝ τρέχει σε κάθε frame!
Τρέχει ΜΟΝΟ όταν:
- Κινείται το mouse (mousemove event)
- Αλλάζει το snap result
- Re-render του LayerCanvas

Optimizations:
- Throttled mouse events (16ms = 60fps)
- Conditional rendering (if snapResults.length > 0)
- RAF-based updates

📊 ΣΥΣΤΗΜΑ ΣΥΝΤΕΤΑΓΜΕΝΩΝ:
--------------------------
ΟΛΟΚΛΗΡΟ ΤΟ PIPELINE χρησιμοποιεί SCREEN COORDINATES:

Mouse (clientX, clientY)
  ↓ (- rect.left/top)
screenPos (canvas pixels)
  ↓
Snap Engines (find snaps σε screen coords)
  ↓
SnapResult.point (screen coordinates)
  ↓
SnapRenderer (direct ctx.rect/arc με screen coords)
  ↓
Canvas pixels (HiDPI scaled 0.75)

ΔΕΝ ΥΠΑΡΧΕΙ world ↔ screen conversion στο snap rendering!

🛠️ DEBUG:
----------
Για να δεις τα snap results:
console.log(window.__debugSnapResults)
console.log(window.__debugViewport)

Για να ενεργοποιήσεις το alignment debug overlay:
- Click "🎯 Alignment" button στο DebugToolbar
- Θα δεις markers: Blue (cursor), Green (crosshair), Red (snap)

================================================================================
ΤΕΛΟΣ ΑΝΑΦΟΡΑΣ ΜΗΧΑΝΙΣΜΟΥ
================================================================================

================================================================================
ΚΡΙΣΙΜΗ ΔΙΕΥΚΡΙΝΙΣΗ: ΠΟΥ ΔΗΜΙΟΥΡΓΟΥΝΤΑΙ ΤΑ SNAP RESULTS;
================================================================================

⚠️ ΣΗΜΑΝΤΙΚΗ ΠΑΡΑΤΗΡΗΣΗ:
Τα snapResults που περνάνε στο LayerRenderer μπορεί να μην έρχονται από
εξωτερικό σύστημα! Πιθανόν να δημιουργούνται LIVE κατά την κίνηση του mouse.

ΤΟ ΣΙΓΟΥΡΟ ΠΟΥ ΞΕΡΟΥΜΕ:
1. Snap Orchestrator (snapping/orchestrator/SnapOrchestrator.ts)
   - findSnapPoint(cursorPoint) → Βρίσκει snap
   - Χρησιμοποιεί 10+ SnapEngines

2. useSnapManager hook (snapping/hooks/useSnapManager.tsx)
   - Wrapper για SnapOrchestrator
   - Χρησιμοποιείται από useDrawingHandlers

3. LayerRenderer (canvas-v2/layer-canvas/LayerRenderer.ts:330-336)
   - Δέχεται snapResults από renderOptions
   - Expose στο window: window.__debugSnapResults
   - Καλεί: snapRenderer.render(snapResults)

4. SnapRenderer (rendering/ui/snap/SnapRenderer.ts)
   - Σχεδιάζει τα snap indicators
   - ΚΟΚΚΙΝΟ τετράγωνο για endpoints
   - ΚΙΤΡΙΝΗ μπάλα για center/default

ΤΟ ΣΥΜΠΕΡΑΣΜΑ:
Το rendering pipeline είναι ΣΙΓΟΥΡΟ (LayerRenderer → SnapRenderer → Canvas).
Το detection pipeline (πού/πότε καλείται findSnapPoint) χρειάζεται περισσότερη έρευνα.

Το σημαντικό: ΟΛΑ χρησιμοποιούν SCREEN COORDINATES!

================================================================================

================================================================================
ΕΡΩΤΗΣΗ 5: ΠΟΥ ΔΗΜΙΟΥΡΓΟΥΝΤΑΙ ΤΑ snapResults; (Final Investigation)
================================================================================

🔍 ΔΙΑΔΡΟΜΗ ΕΡΕΥΝΑΣ:

1. LayerCanvas.tsx (γραμμή 100)
   ✅ Default prop: snapResults: []
   ✅ CanvasSection.tsx ΔΕΝ περνάει snapResults!
   ✅ Άρα χρησιμοποιεί το default κενό array

2. LayerRenderer.ts (γραμμή 330-336)
   ✅ Δέχεται options.snapResults
   ✅ ΑΝ έχει snapResults → καλεί snapRenderer.render()
   ✅ Expose: window.__debugSnapResults = options.snapResults

3. SnapRenderer ΜΟΝΟ στο LayerRenderer
   ✅ Dynamic import: require('../../rendering/ui/snap/SnapRenderer')
   ✅ Μόνο το LayerRenderer τον φορτώνει
   ✅ Κανένα άλλο σύστημα δεν κάνει snap rendering

❌ ΚΡΙΣΙΜΗ ΔΙΑΠΙΣΤΩΣΗ:
ΤΑ snapResults ΕΙΝΑΙ ΠΑΝΤΑ ΚΕΝΑ (empty array [])!
Το CanvasSection ΔΕΝ περνάει snapResults στο LayerCanvas.
Το LayerCanvas χρησιμοποιεί το default: snapResults: [].

🤔 ΤΟ ΠΑΡΑΔΟΞΟ:
Αν τα snapResults είναι κενά, ΠΩΣ φαίνεται το κόκκινο σταυρουδάκι με την κίτρινη μπάλα;

💡 ΠΙΘΑΝΕΣ ΕΞΗΓΗΣΕΙΣ:

1. ΔΕΝ ΥΠΑΡΧΕΙ SNAP RENDERING ΠΡΑΓΜΑΤΙΚΑ
   Αυτό που βλέπουμε ίσως είναι:
   - Cursor (τετράγωνο/κύκλος από CursorRenderer)
   - Crosshair (σταυρός από CrosshairRenderer)
   - ΟΧΙ snap indicators

2. ΥΠΑΡΧΕΙ ΑΛΛΟ SNAP SYSTEM
   Που δεν βρήκαμε ακόμα (πιθανό αλλά απίθανο)

3. LIVE SNAP DETECTION ΣΤΟ LayerRenderer
   Το LayerRenderer ίσως κάνει snap detection ΕΣΩΤΕΡΙΚΑ
   κατά το render και δεν εξαρτάται από external snapResults

🔍 ΓΙΑ ΕΠΑΛΗΘΕΥΣΗ:
1. Έλεγξε αν βλέπεις ΠΡΑΓΜΑΤΙΚΑ snap indicators (κόκκινο τετράγωνο, κίτρινη μπάλα)
2. Άνοιξε console → window.__debugSnapResults → θα δεις []
3. Αν δεν βλέπεις snap indicators, τότε το σύστημα ΔΕΝ δουλεύει
4. Αν τα βλέπεις, τότε χρειάζεται βαθύτερη έρευνα στο LayerRenderer

================================================================================
ΤΕΛΙΚΟ ΣΥΜΠΕΡΑΣΜΑ:
================================================================================

✅ ΣΙΓΟΥΡΑ ΞΕΡΟΥΜΕ:

1. COORDINATE SYSTEM
   - Crosshair: SCREEN coordinates (DxfCanvas.tsx:330-382)
   - Cursor: SCREEN coordinates (DxfCanvas.tsx:330-382)
   - Snap: SCREEN coordinates (SnapRenderer.ts:136-225)
   - ΟΛΑ χρησιμοποιούν position.x/y ΑΠΕΥΘΕΙΑΣ

2. SETTINGS PIPELINE
   localStorage → CursorConfiguration → CursorSystem → useCursorSettings → CanvasSection → DxfCanvas

3. SNAP RENDERING PIPELINE
   LayerRenderer.ts:330-336 → SnapRenderer.render() → Canvas Context

❓ ΔΕΝ ΞΕΡΟΥΜΕ ΑΚΟΜΑ:
   ΠΟΥ δημιουργούνται τα snapResults (φαίνεται να είναι ΠΑΝΤΑ κενά!)

🚨 ΧΡΕΙΑΖΕΤΑΙ:
   Runtime verification - Έλεγξε αν τα snap indicators φαίνονται ΠΡΑΓΜΑΤΙΚΑ
   ή αν αυτό που βλέπουμε είναι cursor/crosshair!

================================================================================
================================================================================
🎯 ΤΕΛΙΚΟ ΕΥΡΗΜΑ: ΤΟ ΠΛΗΡΕΣ ΣΥΣΤΗΜΑ RENDERING ΣΤΑΥΡΟΝΗΜΑ & ΚΕΡΣΟΡΑ
================================================================================

✅ ΤΟ ΚΕΝΤΡΙΚΟ ΣΥΣΤΗΜΑ RENDERING:
---------------------------------

📁 File: canvas-v2/dxf-canvas/DxfCanvas.tsx
📍 Lines: 330-382 (useEffect για UI rendering)

🔄 RENDERING LOOP (60fps via React RAF):
-----------------------------------------

useEffect(() => {
  // 1️⃣ ΠΑΙΡΝΕΙ POSITION ΑΠΟ CENTRALIZED SYSTEM
  const centralizedPosition = cursor.position;  // από CursorSystem!

  // 2️⃣ ΠΑΙΡΝΕΙ SETTINGS ΑΠΟ CURSOR CONFIGURATION
  const cursorSystemSettings = getCursorSettings();  // από CursorConfiguration!

  // 3️⃣ RENDER CROSSHAIR (middle layer)
  if (crosshairRenderer && crosshairSettings?.enabled && centralizedPosition) {
    crosshairRenderer.renderWithGap(
      centralizedPosition,  // SCREEN COORDINATES
      viewport,
      crosshairSettings,    // ΑΠΟ FLOATING PANEL!
      10                    // gap size
    );
  }

  // 4️⃣ RENDER CURSOR (top layer)
  if (cursorRenderer && centralizedPosition) {
    cursorRenderer.render(
      centralizedPosition,      // SCREEN COORDINATES
      viewport,
      cursorSystemSettings      // ΑΠΟ CURSOR CONFIGURATION!
    );
  }
}, [cursor.position, crosshairSettings, activeTool, viewport]);

================================================================================
📊 CROSSHAIR SETTINGS PIPELINE (Floating Panel → Canvas)
================================================================================

1️⃣ FLOATING PANEL
   User αλλάζει crosshair settings στο floating panel

   ↓

2️⃣ CURSOR SYSTEM
   File: systems/cursor/CursorSystem.tsx
   Hook: useCursorSettings()

   Επιστρέφει: { settings: cursorSettings }

   ↓

3️⃣ CANVAS SECTION MAPPING
   File: components/dxf-layout/CanvasSection.tsx
   Lines: 93-103

   const crosshairSettings: CrosshairSettings = {
     enabled: cursorSettings.crosshair.enabled,        // ✅ ΑΠΟ FLOATING PANEL
     color: cursorSettings.crosshair.color,            // ✅ ΑΠΟ FLOATING PANEL
     size: cursorSettings.crosshair.size_percent,      // ✅ ΑΠΟ FLOATING PANEL
     opacity: cursorSettings.crosshair.opacity,        // ✅ ΑΠΟ FLOATING PANEL
     style: cursorSettings.crosshair.line_style,       // ✅ ΑΠΟ FLOATING PANEL
     lineWidth: cursorSettings.crosshair.line_width,   // ✅ ΑΠΟ FLOATING PANEL
     useCursorGap: cursorSettings.crosshair.use_cursor_gap,  // ✅ ΑΠΟ FLOATING PANEL
     centerGapPx: cursorSettings.crosshair.center_gap_px     // ✅ ΑΠΟ FLOATING PANEL
   };

   ↓

4️⃣ DXF CANVAS (PROP)
   <DxfCanvas
     crosshairSettings={crosshairSettings}  // ✅ ΠΕΡΝΑΕΙ ΤΙΣ ΡΥΘΜΙΣΕΙΣ
     ...
   />

   ↓

5️⃣ DXF CANVAS RENDERING
   File: canvas-v2/dxf-canvas/DxfCanvas.tsx:362-368

   crosshairRenderer.renderWithGap(
     centralizedPosition,
     viewport,
     crosshairSettings,  // ✅ ΧΡΗΣΙΜΟΠΟΙΕΙ ΤΙΣ ΡΥΘΜΙΣΕΙΣ ΑΠΟ FLOATING PANEL!
     10
   );

   ↓

6️⃣ LEGACY ADAPTER
   File: rendering/ui/crosshair/LegacyCrosshairAdapter.ts

   renderWithGap(position, viewport, settings, gapSize) {
     // Converts to new UIRenderer interface
     this.coreRenderer.renderDirect(ctx, position, viewport, settings, 'with-gap');
   }

   ↓

7️⃣ CROSSHAIR RENDERER
   File: rendering/ui/crosshair/CrosshairRenderer.ts

   renderDirect(ctx, position, viewport, settings, mode) {
     // Σχεδιάζει σταυρόνημα με τις ρυθμίσεις από floating panel
     ctx.strokeStyle = settings.color;      // ✅ ΑΠΟ FLOATING PANEL
     ctx.globalAlpha = settings.opacity;    // ✅ ΑΠΟ FLOATING PANEL
     ctx.lineWidth = settings.lineWidth;    // ✅ ΑΠΟ FLOATING PANEL

     // Horizontal line
     ctx.moveTo(0, position.y);                    // SCREEN COORDINATES
     ctx.lineTo(viewport.width, position.y);

     // Vertical line
     ctx.moveTo(position.x, 0);                    // SCREEN COORDINATES
     ctx.lineTo(position.x, viewport.height);

     ctx.stroke();
   }

================================================================================
📊 CURSOR SETTINGS PIPELINE (DXEF Settings → Canvas)
================================================================================

1️⃣ DXEF SETTINGS (localStorage)
   Key: "autocad_cursor_settings"

   ↓

2️⃣ CURSOR CONFIGURATION
   File: systems/cursor/config.ts

   Class: CursorConfiguration (Singleton)
   Method: getCursorSettings()

   Διαβάζει από localStorage ή defaults

   ↓

3️⃣ DXF CANVAS
   File: canvas-v2/dxf-canvas/DxfCanvas.tsx:341

   const cursorSystemSettings = getCursorSettings();  // ✅ ΑΠΟ CURSOR CONFIGURATION

   ↓

4️⃣ DXF CANVAS RENDERING
   Lines: 372-378

   cursorRenderer.render(
     centralizedPosition,
     viewport,
     cursorSystemSettings  // ✅ ΧΡΗΣΙΜΟΠΟΙΕΙ ΡΥΘΜΙΣΕΙΣ ΑΠΟ DXEF!
   );

   ↓

5️⃣ LEGACY ADAPTER
   File: rendering/ui/cursor/LegacyCursorAdapter.ts

   render(position, viewport, settings) {
     // Converts nested SystemCursorSettings to flat UICursorSettings
     const flatSettings = {
       enabled: settings.cursor.enabled,      // ✅ ΑΠΟ DXEF
       color: settings.cursor.color,          // ✅ ΑΠΟ DXEF
       size: settings.cursor.size,            // ✅ ΑΠΟ DXEF
       opacity: settings.cursor.opacity,      // ✅ ΑΠΟ DXEF
       shape: settings.cursor.shape,          // ✅ ΑΠΟ DXEF
       lineWidth: settings.cursor.line_width, // ✅ ΑΠΟ DXEF
       ...
     };

     this.coreRenderer.render(uiContext, viewport, flatSettings);
   }

   ↓

6️⃣ CURSOR RENDERER
   File: rendering/ui/cursor/CursorRenderer.ts

   render(uiContext, viewport, settings) {
     const position = (uiContext as any).mousePosition;

     // Σχεδιάζει cursor με ρυθμίσεις από DXEF
     ctx.strokeStyle = settings.color;      // ✅ ΑΠΟ DXEF
     ctx.globalAlpha = settings.opacity;    // ✅ ΑΠΟ DXEF
     ctx.lineWidth = settings.lineWidth;    // ✅ ΑΠΟ DXEF

     switch (settings.shape) {
       case 'circle':
         ctx.arc(position.x, position.y, radius, 0, Math.PI * 2);  // SCREEN COORDS
         break;
       case 'square':
         ctx.rect(position.x - halfSize, position.y - halfSize, size, size);  // SCREEN COORDS
         break;
     }

     ctx.stroke();
   }

================================================================================
🔑 ΚΡΙΣΙΜΑ ΣΗΜΕΙΑ
================================================================================

1. ✅ **ΕΝΙΑΙΟ COORDINATE SYSTEM**
   - Crosshair: SCREEN COORDINATES (position.x, position.y)
   - Cursor: SCREEN COORDINATES (position.x, position.y)
   - Από το ΙΔΙΟ cursor.position (CursorSystem)

2. ✅ **ΔΥΟ ΠΗΓΕΣ ΡΥΘΜΙΣΕΩΝ**
   - **Crosshair**: Από Floating Panel → useCursorSettings() → crosshairSettings prop
   - **Cursor**: Από DXEF localStorage → getCursorSettings() → cursorSystemSettings

3. ✅ **ΕΝΑΣ CANVAS**
   - DxfCanvas.tsx κάνει ΟΛΟ το UI rendering
   - useEffect loop με dependencies: [cursor.position, crosshairSettings, activeTool, viewport]
   - 60fps updates όταν αλλάζει position

4. ✅ **ADAPTERS ΓΙΑ COMPATIBILITY**
   - LegacyCrosshairAdapter: Παλιά interface → Νέα CrosshairRenderer
   - LegacyCursorAdapter: Παλιά interface → Νέα CursorRenderer

5. ✅ **HIDPI SCALING**
   - Όλα τα canvas έχουν 0.75 DPR transform
   - CanvasUtils.setupCanvasContext() εφαρμόζει το scaling
   - Consistent rendering σε όλα τα layers

================================================================================
💡 ΣΥΜΠΕΡΑΣΜΑ
================================================================================

**ΤΟ ΣΥΣΤΗΜΑ ΠΟΥ ΚΑΝΕΙ RENDERING:**
File: canvas-v2/dxf-canvas/DxfCanvas.tsx (γραμμές 330-382)

**CROSSHAIR ΡΥΘΜΙΣΕΙΣ:**
Floating Panel → useCursorSettings() → CanvasSection mapping → DxfCanvas prop → Renderer

**CURSOR ΡΥΘΜΙΣΕΙΣ:**
DXEF localStorage → CursorConfiguration → getCursorSettings() → DxfCanvas → Renderer

**COORDINATE SYSTEM:**
SCREEN COORDINATES (από CursorSystem.position) - ΙΔΙΟ για crosshair & cursor

**RENDERING FREQUENCY:**
React useEffect με dependencies - Re-render όταν αλλάζει cursor.position

================================================================================
