# ADR-188: Entity Rotation System — DXF Viewer

**Status**: RESEARCH COMPLETE — Implementation Pending
**Date**: 2026-02-19
**Author**: Claude Opus 4.6 + Giorgos Pagonis
**Scope**: DXF Viewer (`src/subapps/dxf-viewer/`)
**Priority**: Medium

---

## 1. Context & Problem

Η εφαρμογή DXF Viewer δεν διαθέτει σύστημα περιστροφής (rotation) οντοτήτων.
Το AutoCAD και το MicroStation παρέχουν πλήρες rotation system ως βασική λειτουργία.

**Ερωτήματα που απαντά αυτό το ADR:**
- Τι rotation code υπάρχει ήδη στο codebase;
- Πώς υλοποιούν τα AutoCAD/MicroStation το rotation;
- Τι χρειάζεται να υλοποιηθεί;

---

## 2. Τρέχουσα Κατάσταση (Codebase Audit)

### 2.1 Rotation Code που ΥΠΑΡΧΕΙ

| Σύστημα | Status | Σημειώσεις |
|---------|--------|------------|
| **Text rendering rotation** | ✅ Πλήρης | `TextRenderer.ts` — `ctx.rotate(degToRad(-rotation))` |
| **MText rendering rotation** | ✅ Πλήρης | Ίδιο pattern με Text |
| **Ellipse rendering rotation** | ✅ Πλήρης | `EllipseRenderer.ts` — axis endpoints + `ctx.rotate()` |
| **PDF background rotation** | ✅ Πλήρης + UI | `PdfControlsPanel.tsx` — CW/CCW buttons, 15° step |

### 2.2 Rotation Code που ΛΕΙΠΕΙ

| Σύστημα | Status | Σημειώσεις |
|---------|--------|------------|
| **Rotate command/tool** | ❌ Λείπει | Δεν υπάρχει στο toolbar ή context menu |
| **Rotation UI controls** | ❌ Λείπει | Κανένα input field, slider, ή button |
| **Rotation keyboard shortcut** | ❌ Λείπει | Δεν υπάρχει `R` ή `Ctrl+R` |
| **Rotation grips** | ❌ Λείπει | Grip system handles μόνο move/stretch |
| **RotateEntityCommand** | ❌ Λείπει | Υπάρχει MoveEntityCommand αλλά ΟΧΙ rotate |
| **Rectangle rotation rendering** | ❌ Λείπει | Type `rotation` exists, rendering δεν εφαρμόζεται |
| **Block rotation rendering** | ❌ Λείπει | Type `rotation` required, rendering δεν εφαρμόζεται |
| **Hatch pattern rotation** | ❌ Λείπει | Type `patternAngle` exists, rendering δεν εφαρμόζεται |
| **Real-time rotation preview** | ❌ Λείπει | Ghost entity rendering κατά drag |
| **AI assistant rotate tool** | ❌ Λείπει | `dxf-tool-definitions.ts` δεν έχει rotate |

### 2.3 Entity Rotation Capability Matrix

| Entity | Rotation Property | Renders? | Editable? |
|--------|-------------------|----------|-----------|
| Line | ΔΕΝ εχει (vertex transform) | N/A | ❌ |
| Circle | ΔΕΝ εχει (radius δεν αλλάζει) | N/A | ❌ |
| Arc | startAngle/endAngle (offset) | N/A | ❌ |
| Polyline | ΔΕΝ εχει (vertex transform) | N/A | ❌ |
| Ellipse | ✅ `rotation` | ✅ | ❌ |
| Text | ✅ `rotation` | ✅ | ❌ |
| MText | ✅ `rotation` | ✅ | ❌ |
| Rectangle | ✅ `rotation` (type only) | ❌ | ❌ |
| Block/INSERT | ✅ `rotation` (required) | ❌ | ❌ |
| Hatch | ✅ `patternAngle` (type only) | ❌ | ❌ |
| Dimension | ΔΕΝ υλοποιημένο | ❌ | ❌ |

### 2.4 Σχετικά Αρχεία

**Existing (rotation-aware):**
- `rendering/entities/TextRenderer.ts` — rotation rendering
- `rendering/entities/EllipseRenderer.ts` — rotation rendering
- `types/entities.ts` — entity type definitions (rotation fields)
- `pdf-background/components/PdfControlsPanel.tsx` — PDF rotation UI

**To be modified/created:**
- `core/commands/entity-commands/` — πρέπει RotateEntityCommand
- `ui/toolbar/toolDefinitions.tsx` — πρέπει rotate tool
- `hooks/canvas/useCanvasKeyboardShortcuts.ts` — πρέπει shortcut
- `hooks/grips/` — πρέπει rotation grips

---

## 3. AutoCAD Rotation — Πλήρης Αναφορά

### 3.1 ROTATE Command Flow

```
Command: ROTATE (shortcut: RO)

1. Select objects → Enter
2. Specify base point (pivot)
3. Specify rotation angle:
   a) Αριθμητική εισαγωγή (π.χ. 45°) → Enter
   b) Mouse drag → real-time preview
   c) [Copy] option: δημιουργεί αντίγραφο στη νέα γωνία
   d) [Reference] option: ορίζεις αρχική + τελική γωνία
```

### 3.2 Reference Angle (Advanced)

Η πιο χρήσιμη option — επιτρέπει ακριβή περιστροφή:
```
actual_rotation = new_angle - reference_angle
```
Παράδειγμα: entity στις 23° → θέλεις 0° → rotation = -23°

### 3.3 Grip-Based Rotation

1. Click grip → γίνεται HOT (κόκκινο)
2. Cycle modes: **Stretch → Move → Rotate → Scale → Mirror**
3. Στο Rotate mode: drag ή type angle

### 3.4 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `RO` + Enter | ROTATE command |
| Grip + Enter ×3 | Cycle to Rotate grip mode |
| `C` (in ROTATE) | Copy option |
| `R` (in ROTATE) | Reference angle option |

---

## 4. MicroStation Rotation — Σύγκριση

### 4.1 Τρεις Μέθοδοι

| Method | Βήματα |
|--------|--------|
| **Active Angle** | Type angle → click pivot |
| **2 Points** | Click pivot → click point1 → click point2 |
| **3 Points** | Click pivot → click start → click end |

### 4.2 Επιπλέον Features

- **About Element Center**: Auto-rotation γύρω από κέντρο entity
- **Copies**: N αντίγραφα ταυτόχρονα (AutoCAD μόνο 1)
- **AccuDraw**: Real-time angle display + polar coords

### 4.3 AutoCAD vs MicroStation

| Feature | AutoCAD | MicroStation |
|---------|---------|--------------|
| Base Point | Χρήστης επιλέγει | Χρήστης ή Element Center |
| Angle Input | Numeric ή mouse | Active Angle ή Points |
| Reference | Reference option | 3-Point method |
| Copy | 1 αντίγραφο max | N αντίγραφα |
| Preview | Ghost + rubber band | Ghost + AccuDraw |
| Shortcut | `RO` | `<Q, R>` |

---

## 5. DXF Format — Rotation Group Codes

### 5.1 Ανά Entity Type

| Entity | Group Code | Σημασία | Μονάδα | Default |
|--------|-----------|---------|--------|---------|
| **INSERT** | 50 | Rotation angle | degrees | 0 |
| **TEXT** | 50 | Rotation angle | degrees | 0 |
| **TEXT** | 51 | Oblique angle | degrees | 0 |
| **MTEXT** | 50 | Rotation angle | radians (input) | 0 |
| **MTEXT** | 11/21/31 | Text direction vector | WCS | (1,0,0) |
| **ARC** | 50 | Start angle | degrees | — |
| **ARC** | 51 | End angle | degrees | — |
| **ELLIPSE** | 41/42 | Start/end parameter | radians | 0 / 2π |
| **DIMENSION** | 50 | Dimension line angle | degrees | 0 |
| **DIMENSION** | 53 | Text rotation | degrees | 0 |
| **LINE** | — | ΔΕΝ εχει rotation | — | — |
| **CIRCLE** | — | ΔΕΝ εχει rotation | — | — |
| **POLYLINE** | — | ΔΕΝ εχει rotation | — | — |

### 5.2 Κρίσιμος Κανόνας

- **Θετική γωνία = counterclockwise** (σύμβαση AutoCAD/DXF)
- Group codes 50-59 = angles
- Στα DXF αρχεία: **degrees**
- Μέσω AutoLISP/ARX API: **radians**

---

## 6. Μαθηματικά Μετασχηματισμών

### 6.1 Rotation γύρω από Base Point

```
// Translate-Rotate-Translate method
x' = (x - bx) · cos(θ) - (y - by) · sin(θ) + bx
y' = (x - bx) · sin(θ) + (y - by) · cos(θ) + by
```

### 6.2 Entity-Specific Transform Logic

**Γεωμετρικά entities (LINE, POLYLINE):**
- Transform **κάθε vertex** με τον τύπο 6.1
- Αποθήκευσε τα νέα coordinates
- Κανένα rotation attribute

**INSERT / TEXT / MTEXT:**
- Transform **insertion/alignment point** με 6.1
- Πρόσθεσε γωνία: `new_rotation = old_rotation + θ`

**ARC:**
- Transform **center** με 6.1
- Offset angles: `new_start = old_start + θ`, `new_end = old_end + θ`
- Radius δεν αλλάζει

**ELLIPSE:**
- Transform **center** με 6.1
- Rotate **major axis direction** vector
- Start/end parameters δεν αλλάζουν (parametric space)

**CIRCLE:**
- Transform **center** μόνο (radius αμετάβλητη)

---

## 7. Proposed Implementation Plan

### Phase 1: Core Infrastructure (Μεσαία προτεραιότητα)

1. **RotateEntityCommand** — Command class (pattern: MoveEntityCommand)
2. **rotatePoint() utility** — Translate-Rotate-Translate math
3. **rotateEntity() dispatcher** — Per-entity-type logic (6.2)
4. **Undo support** — Αποθήκευση pre-rotation state

### Phase 2: User Interface

5. **Toolbar rotate tool** — `toolDefinitions.tsx` entry
6. **Keyboard shortcut** — `R` ή `Ctrl+R`
7. **Context menu option** — "Rotate" στο DrawingContextMenu
8. **Angle input** — Modal ή inline input field

### Phase 3: Visual Feedback

9. **Ghost entity preview** — Semi-transparent clone κατά drag
10. **Rubber band line** — Base point → cursor
11. **Angle tooltip** — Degrees display κοντά στον cursor
12. **Base point marker** — Crosshair στο pivot point

### Phase 4: Advanced Features

13. **Reference angle** — Pick 2 points for reference, then new angle
14. **Copy + rotate** — Δημιουργία αντιγράφου
15. **Rotation grips** — Circular grip handles
16. **Snap angles** — 0°, 15°, 30°, 45°, 90° snap increments
17. **AI assistant integration** — `rotate_entity` tool definition

### Phase 5: Missing Renderers

18. **Rectangle rotation rendering** — Apply ctx.rotate()
19. **Block/INSERT rotation rendering** — Apply ctx.rotate() to block geometry
20. **Hatch pattern rotation rendering** — Rotate pattern fill

---

## 8. State Machine — User Interaction Flow

```
IDLE
  └── Click "Rotate" tool ──→ SELECT_ENTITIES

SELECT_ENTITIES
  └── Marquee/click selection ──→ PICK_BASE_POINT

PICK_BASE_POINT
  └── Click pivot point ──→ SPECIFY_ANGLE

SPECIFY_ANGLE
  ├── Mouse move ──→ PREVIEW (ghost + rubber band)
  ├── Type angle + Enter ──→ EXECUTE
  ├── Press 'C' ──→ COPY_MODE → SPECIFY_ANGLE
  └── Press 'R' ──→ REFERENCE_MODE

REFERENCE_MODE
  └── Pick 2 points ──→ SPECIFY_NEW_ANGLE

SPECIFY_NEW_ANGLE
  └── Pick point / type angle ──→ EXECUTE

EXECUTE
  └── Apply transform ──→ IDLE
```

---

## 9. Key Implementation Details

### 9.1 Conventions

- Θετική γωνία = **counterclockwise** (AutoCAD σύμβαση)
- Αποθήκευση σε **degrees** (DXF σύμβαση)
- Μετατροπή σε radians **μόνο** κατά Math operations
- Canvas Y-axis flip: `ctx.rotate(-angle)` αντί `ctx.rotate(angle)`

### 9.2 Existing Infrastructure

| Pattern | Location | Reusable? |
|---------|----------|-----------|
| `degToRad()` | rendering utils | ✅ Ήδη χρησιμοποιείται |
| `ctx.rotate()` | TextRenderer, EllipseRenderer | ✅ Pattern to follow |
| `ICommand` interface | core/commands | ✅ For RotateEntityCommand |
| MoveEntityCommand | entity-commands | ✅ Template to follow |
| Grip system | hooks/grips/ | ✅ Extensible for rotation |
| PDF rotation UI | PdfControlsPanel | ✅ UI pattern to follow |
| PreviewCanvas | canvas-v2/preview-canvas | ✅ For ghost rendering |

### 9.3 Performance Considerations

- Ghost rendering: Χρήση **overlay canvas** (ήδη υπάρχει PreviewCanvas)
- Real-time preview: Max 60fps, throttle mousemove events
- Multi-entity rotation: Batch transform σε requestAnimationFrame

---

## 10. Changelog

| Date | Change |
|------|--------|
| 2026-02-19 | ADR-188 created — research complete, codebase audit + AutoCAD/MicroStation comparison |
