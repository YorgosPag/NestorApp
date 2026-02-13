# ADR-160: Internal Angle Arc Rendering (dot product logic)

| Metadata | Value |
|----------|-------|
| **Status** | IMPLEMENTED |
| **Date** | 2026-02-01 |
| **Category** | Drawing System |
| **Canonical Location** | `drawInternalAngleArc()` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `drawInternalAngleArc()` from `rendering/entities/BaseEntityRenderer.ts`
- **Decision**: Use dot product logic for ALWAYS rendering INTERNAL angle arcs
- **Status**: ✅ IMPLEMENTED
- **Date**: 2026-02-01
- **Problem**: `AngleMeasurementRenderer` used simple arc logic (angle1 → angle2), sometimes rendering EXTERNAL arcs
- **Existing Correct Logic**: `drawInternalArc()` (lines 667-718) uses dot product to select correct CCW/CW direction
- **Solution**: New method `drawInternalAngleArc(vertex, point1, point2, radiusWorld)` that:
  1. Calculates unit vectors from vertex to each point
  2. Delegates to `drawInternalArc()` which uses dot product for correct direction
- **Algorithm** (from drawInternalArc — **FIXED 2026-02-13**):
  ```typescript
  // dCCW = CW angular distance in canvas coords (Y-down, increasing angle = CW)
  const dCCW = norm(a2 - a1);
  // Σχεδίασε ΠΑΝΤΑ το μικρότερο τόξο:
  // - dCCW < π → CW path μικρό → useCCW = false (σχέδιασε CW)
  // - dCCW > π → CW path μεγάλο → useCCW = true (σχέδιασε CCW)
  const useCCW = dCCW > Math.PI;
  addArcPath(ctx, v, rPx, a1, a2, useCCW);
  ```
- **Files Changed**:
  - `BaseEntityRenderer.ts`: Added `drawInternalAngleArc()` method
  - `AngleMeasurementRenderer.ts`: Changed from `drawCentralizedArc()` to `drawInternalAngleArc()`
- **Benefits**:
  - Τόξα ΠΑΝΤΑ εσωτερικά (μικρότερη γωνία)
  - Consistent με Polyline/Rectangle angle rendering
  - CAD-standard behavior (AutoCAD dimension arcs)
- **Companion**: ADR-140 (Angle Measurement Constants), ADR-159 (Measurement Colors)

---

## Changelog

### 2026-02-13 — Fix: Τόξα γωνιών σχεδιάζονταν εξωτερικά αντί εσωτερικά

| Field | Value |
|-------|-------|
| **Bug** | Τα τόξα γωνιών (σε angle-measurement ΚΑΙ polygon vertices) σχεδιάζονταν στην εξωτερική πλευρά (μεγαλύτερο τόξο) αντί στην εσωτερική (μικρότερο τόξο) |
| **Root Cause** | Η συνθήκη `useCCW = dCCW < Math.PI` στο `drawInternalArc()` ήταν **ανεστραμμένη**. Στο canvas coordinate system (Y-down), `dCCW` είναι η CW angular distance. Όταν `dCCW < π` (CW path κοντό), ο κώδικας χρησιμοποιούσε `useCCW = true` (CCW path = μακρύ τόξο) αντί `useCCW = false` (CW path = κοντό τόξο) |
| **Fix** | Αλλαγή `dCCW < Math.PI` → `dCCW > Math.PI` — μία γραμμή, ένα χαρακτήρα |
| **File** | `src/subapps/dxf-viewer/rendering/entities/BaseEntityRenderer.ts` (γραμμή ~721) |
| **Impact** | Διορθώνει ΟΛΑ τα τόξα γωνιών: standalone angle-measurement, polygon vertex angles, area measurement angles — όλα περνούν από τη μοναδική `drawInternalArc()` |
