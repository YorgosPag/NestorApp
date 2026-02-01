# ADR-140: Angle Measurement Visualization Constants

| Metadata | Value |
|----------|-------|
| **Status** | IMPLEMENTED |
| **Date** | 2026-01-01 |
| **Category** | Canvas & Rendering |
| **Canonical Location** | `RENDER_GEOMETRY` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `RENDER_GEOMETRY` extension in `config/text-rendering-config.ts`
- **Decision**: Centralize angle measurement arc radius and text distance constants
- **Status**: ✅ IMPLEMENTED
- **Problem**: Hardcoded values scattered across 2 files with identical values:
  - `AngleMeasurementRenderer.ts`: `arcRadius = 40`, `textDistance = 50`
  - `PreviewRenderer.ts`: `arcRadius = 40`, `textDistance = 50`
  - No documentation why 40 and 50 pixels were chosen
  - Risk: Updates require changes in 2 files (easy to miss one)
- **Solution**: Extended `RENDER_GEOMETRY` with semantic constants:
  ```typescript
  // 🏢 ADR-140: ANGLE MEASUREMENT VISUALIZATION
  ANGLE_ARC_RADIUS: 40,      // Arc radius in screen pixels for angle indicator
  ANGLE_TEXT_DISTANCE: 50,   // Text distance for angle label positioning (e.g., "45.0°")
  ```
- **Files Migrated**:
  - `rendering/entities/AngleMeasurementRenderer.ts` - arcRadius, textDistance
  - `canvas-v2/preview-canvas/PreviewRenderer.ts` - arcRadius, textDistance
- **Benefits**:
  - Eliminates 4 hardcoded magic numbers (2 per file)
  - Single source of truth for angle measurement visualization
  - CAD-standard documentation (AutoCAD dimension arc patterns)
  - Easy to adjust values globally (e.g., for different screen DPIs)
- **Companion**: ADR-048 (Rendering Geometry), ADR-124 (Renderer Constants)
