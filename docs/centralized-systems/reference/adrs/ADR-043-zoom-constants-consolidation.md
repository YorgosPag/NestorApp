# ADR-043: Zoom Constants Consolidation

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Category** | Canvas & Rendering |
| **Canonical Location** | `transform-config.ts` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `transform-config.ts` (SSOT)
- **Deleted**: `zoom-constants.ts` middleman

---

## Changelog

- **2026-06-29** — AutoCAD-parity exponential wheel zoom + **ΕΝΑ knob για 2D & 3D**. Το πραγματικό
  ροδάκι έπαιρνε σταθερό 10% (`WHEEL_IN/OUT`) → ένιωθε αργό vs AutoCAD. Νέο SSoT `WHEEL_ZOOM_PER_NOTCH`
  (= 1.20, +20%/εγκοπή) + `WHEEL_NOTCH_DELTA_PX` (=100) στο `transform-config.ts`· από αυτό **παράγονται**
  το 2D `ZOOM_FACTORS.WHEEL_SENSITIVITY`/`CTRL_WHEEL_SENSITIVITY`/`WHEEL_MAX_DELTA` **ΚΑΙ** το 3D
  `ZOOM_WHEEL_SENSITIVITY` (`bim-3d/viewport/viewport-constants.ts`) → feel-parity, μία πηγή αλήθειας.
  Νέος SSoT helper `computeWheelZoomFactor(deltaY, ctrl)` = `exp(−deltaY×sensitivity)` (magnitude-aware,
  Figma/Google-Maps μοντέλο) + inverse `wheelDeltaForFactor(factor)` ώστε τα κουμπιά zoom
  (`zoomAtScreenPoint`/`DxfCanvas`) να τιμούν τον ΑΚΡΙΒΗ factor τους (latent bug: έκαναν 10% αντί 20%).
  Καταναλωτές: `ZoomManager.wheelZoom`, `useCentralizedMouseHandlers` (+ `deltaMode→px` normalization
  για cross-browser). Τα `WHEEL_IN/OUT/CTRL_*` μένουν ως discrete fallback. 🟡 UNCOMMITTED.
