# ADR-105: Hit Test Fallback Tolerance Centralization

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Category** | Canvas & Rendering |
| **Canonical Location** | `TOLERANCE_CONFIG.HIT_TEST_FALLBACK` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `TOLERANCE_CONFIG.HIT_TEST_FALLBACK` from `config/tolerance-config.ts`
- **Export Alias**: `HIT_TEST_FALLBACK` for direct import
- **Value**: 5 pixels (standard fallback for hit testing methods)
- **Impact**: 10+ hardcoded `tolerance: 5` or `tolerance = 5` patterns → centralized constant
- **Problem**: Scattered hardcoded tolerance values across 10 files:
  - `services/HitTestingService.ts` - main hit test service
  - `rendering/entities/CircleRenderer.ts` - circle hitTest method
  - `rendering/entities/SplineRenderer.ts` - spline hitTest method
  - `rendering/entities/TextRenderer.ts` - text hitTest method
  - `canvas-v2/dxf-canvas/DxfCanvas.tsx` - DXF canvas hit testing
  - `canvas-v2/layer-canvas/LayerRenderer.ts` - layer hit testing
  - `systems/constraints/useConstraintsSystemState.ts` - constraint snap settings
  - `systems/cursor/useCentralizedMouseHandlers.ts` - marquee selection
  - `systems/selection/UniversalMarqueeSelection.ts` - universal selection
  - `systems/rulers-grid/config.ts` - ruler snap settings
- **Solution**: Replace all hardcoded `5` with `TOLERANCE_CONFIG.HIT_TEST_FALLBACK`
- **Pattern**:
  ```typescript
  // Before (hardcoded - PROHIBITED)
  hitTest(entity: EntityModel, point: Point2D, tolerance: number = 5): boolean

  // After (centralized - REQUIRED)
  import { TOLERANCE_CONFIG } from '../../config/tolerance-config';
  hitTest(entity: EntityModel, point: Point2D, tolerance: number = TOLERANCE_CONFIG.HIT_TEST_FALLBACK): boolean
  ```
- **Benefits**:
  - Single Source of Truth for hit test fallback tolerance
  - Easy global adjustment if needed
  - Comment marker `// 🏢 ADR-105` for traceability
- **Companion**: ADR-095 (Snap Tolerance), ADR-099 (Polygon & Measurement Tolerances)

### 🔒 Marquee Selection Tolerance — ΛΕΙΤΟΥΡΓΕΙ ΣΩΣΤΑ (2026-02-13)

> **⚠️ ΜΗΝ ΤΡΟΠΟΠΟΙΗΘΕΙ**: Το `HIT_TEST_FALLBACK` χρησιμοποιείται από τα:
> - `useCentralizedMouseHandlers.ts` — marquee selection tolerance
> - `UniversalMarqueeSelection.ts` — universal selection bounds
>
> Το AutoCAD-style Window/Crossing selection (μπλε window + πράσινο crossing) είναι **ΠΛΗΡΩΣ ΛΕΙΤΟΥΡΓΙΚΟ** (2026-02-13).
> Υποστηρίζει: line, circle, arc, polyline, lwpolyline, rect, rectangle, angle-measurement, text.
> Αλλαγή tolerance μπορεί να επηρεάσει την ακρίβεια marquee selection.

---

## Addendum (2026-07-15) — Big-player selection model: stroke vs fill (ADR-656 M12 surface)

**Πρόβλημα (Giorgio):** hover πάνω σε **ομόκεντρες ισοϋψείς** τοπογραφικού αναγνώριζε **μόνο τον
εξωτερικό** δακτύλιο. **Ρίζα:** το `hitTestPolyline` (`rendering/hitTesting/hit-test-entity-tests.ts`)
έκανε **fill fallback** (`isPointInPolygon`) για **κάθε** κλειστή πολυγραμμή → ο εξωτερικός κύκλος
«κέρδιζε» σε **κάθε** εσωτερικό σημείο (hit≠paint: τα `PolylineEntity`/`LWPolylineEntity` δεν έχουν καν
`fillColor`, ποτέ δεν ζωγραφίζονται γεμάτα).

**Απόφαση (big-player: Revit / ArchiCAD / Figma / AutoCAD):** τα **wireframe κλειστά σχήματα
επιλέγονται από το ΠΕΡΙΓΡΑΜΜΑ** (stroke-only)· το «κλικ ΜΕΣΑ» είναι **ρητή, opt-in** δυνατότητα.

- `hitTestPolyline` → **stroke-only** (αφαιρέθηκε το fill fallback· ευθυγράμμιση με `hitTestRectangle`/
  `hitTestCircle` που ήδη ήταν stroke-only). Τα γνήσια filled entities (hatch / image / BIM solids)
  κρατούν τα δικά τους fill hit-tests.
- **Νέο SSoT** `rendering/hitTesting/enclosure-hit.ts` → `isPointInsideClosedEntity(entity, point)`
  («μέσα σε κλειστή περιοχή;», χωριστό ερώτημα από τον stroke hit-test).
- `pickTopEntityAt(..., opts?: { includeEnclosure })` → **ΕΝΑ** pick SSoT· default stroke-only (γενική
  επιλογή/hover), `includeEnclosure:true` προσθέτει το inside-hit. Καταναλωτής: `canvas-click-topo-boundary`
  (επιλογή ορίου οικοπέδου — κρατά «κλικ μέσα στο οικόπεδο», ADR-650 M6).
- **Tests:** `__tests__/stroke-vs-enclosure-hit.test.ts` (11 — stroke-only· ομόκεντρα δεν καταπίνονται·
  enclosure opt-in· εκτός/μέσα). Πλήρες hitTesting suite 120/120 πράσινο· jscpd:diff καθαρό.
