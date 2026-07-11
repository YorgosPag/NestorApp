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

- **2026-07-12** — **Διεύρυνση 2D zoom range ×10 σε κάθε κατεύθυνση** (αίτημα Giorgio). Στο
  `transform-config.ts`: `TRANSFORM_SCALE_LIMITS` & `UI_ZOOM_LIMITS` (τα δύο SSoT όρια που κλαμπάρουν
  wheel/keyboard/buttons + core transform) πάνε `MIN_SCALE 0.001 → 0.0001` (0.1% → **0.01%**, 10×
  πιο μακριά) και `MAX_SCALE 10000 → 100000` (1.000.000% → **10.000.000%**, 10× πιο κοντά). Οι τιμές
  παραμένουν άνετα εντός IEEE-754 double → μηδενικό precision loss (τα canvas transforms
  πολλαπλασιάζουν doubles). Καταναλωτές αμετάβλητοι (διαβάζουν τη σταθερά): `useCentralizedMouseHandlers`,
  `zoom/utils/calculations`, `ZoomManager` (μέσω `DEFAULT_ZOOM_CONFIG`/`ZOOM_LIMITS`), `view-scale`
  clamps. `view-scale.test.ts` (11/11) πράσινο — διαβάζει τη σταθερά δυναμικά. `PDF_SCALE_LIMITS`
  & `FIT_TO_VIEW_DEFAULTS` **αμετάβλητα** (σκόπιμα τηρημένα όρια). 🟡 UNCOMMITTED.
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
