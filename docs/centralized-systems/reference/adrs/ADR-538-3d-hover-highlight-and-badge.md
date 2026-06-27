# ADR-538 — Hover-φωτισμός DXF+BIM & «+» badge στην 3D προβολή (ίδιος 2D κώδικας)

**Status:** 🟢 IMPLEMENTED (UNCOMMITTED) — DXF glow + BIM yellow silhouette + «+» badge · **Date:** 2026-06-27
**Type:** Feature (DXF Viewer — 3D viewport hover). Full SSoT με το 2D.
**Builds on:** ADR-536 (3D selection silhouette outline — `SelectionOutlinePass`) · ADR-537 (raw DXF picking στο 3D) · ADR-535 (Canvas2D overlay projection) · ADR-040 (micro-leaf) · ADR-515 (crosshair badge)
**Related:** HoverStore (systems/hover)

---

## 1. Πρόβλημα / Ζητούμενο (Giorgio 2026-06-27)

Στον 2D κάμβα, hover πάνω σε DXF/BIM οντότητα → **κίτρινο glow** (#FFFF00) + μικρό **«+» badge** ΒΑ του
σταυρονήματος. Στο 3D: **τίποτα** (μόνο debounced popover). Ζητούμενο: στο 3D, hover → **φωτισμός όπως 2D** +
**«+» badge**, με **τον ίδιο κώδικα / μία πηγή αλήθειας**.

**Αποφάσεις (ερωτήσεις στον Giorgio):**
- **BIM φωτισμός** → «τι θα έκαναν Autodesk/Revit/Maxon;» → **φωτίζουν το πραγματικό 3D σώμα με silhouette
  περίγραμμα** → 3D περίγραμμα στο **ίδιο κίτρινο hover χρώμα**, reuse του `SelectionOutlinePass` (ADR-536).
- **«+» badge** → **μόνο το badge** ΒΑ του κανονικού κέρσορα (όχι ολόκληρο σταυρόνημα).
- **Ωμές DXF** → αυτούσιο 2D κίτρινο glow (canvas-2D, projected Canvas2D overlay).

---

## 2. Αρχιτεκτονική — μία πηγή αλήθειας

| Επίπεδο | SSoT |
|---|---|
| **Hover state** | `systems/hover/HoverStore.ts` (ΤΟ ΙΔΙΟ store με το 2D → ενοποιημένο 2D↔3D hover) |
| **«+» badge λογική/χρώματα** | `systems/hover/hover-add-badge.ts` `resolveHoverBadge` (εξήχθη από `CrosshairOverlay.applyBadge`· το 2D τώρα το καλεί κι αυτό) |
| **2D κίτρινο glow** | `rendering/entities/base-entity-style-helpers.ts` `drawEntityGlowPrePass` + `HOVER_HIGHLIGHT.ENTITY` |
| **BIM 3D περίγραμμα** | `bim-3d/systems/selection/SelectionOutlinePass.ts` (ΕΝΑ pass ζωγραφίζει ΔΥΟ silhouettes: selection gold + hover yellow) + `BimSelectionHighlighter` (generic apply → reuse για hover) |
| **Pick** | BIM: `raycastBimEntities` · DXF: `pickDxfEntityAt` (ADR-537) |

### Ροή

`use-bim3d-pointer-handlers handleMouseMove` (throttle ~50ms, όπως 2D) → `pickHover`:
- BIM hit → `setHoveredEntity(bimId)` + `manager.setHoveredBimEntity(bimId)` (κίτρινο silhouette, skip αν selected).
- DXF hit → `setHoveredEntity(dxfId)` + `setHoveredBimEntity(null)` → ο `DxfHoverGlowOverlay2D` ζωγραφίζει glow.
- miss/leave → όλα null.

3 καταναλωτές του HoverStore: (Α) `HoverAddBadge3D` «+» badge· (Β) `DxfHoverGlowOverlay2D` glow· (Γ) `manager.setHoveredBimEntity` → `hoverHighlighter` → yellow silhouette.

---

## 3. Νέα αρχεία

- `systems/hover/hover-add-badge.ts` — pure `resolveHoverBadge` + χρώματα badge.
- `bim-3d/grips/dxf-entity-outline.ts` — pure `dxfEntityOutlineSegments` (line/polyline/circle/arc → plan polylines).
- `bim-3d/viewport/grips/DxfHoverGlowOverlay2D.tsx` — Canvas2D RAF overlay, projected 2D glow.
- `bim-3d/viewport/HoverAddBadge3D.tsx` — DOM «+»/«−» badge, κοινό SSoT, ΒΑ του κέρσορα.

## 4. Τροποποιημένα

- `SelectionOutlinePass.ts` — `setHovered` + `_renderSilhouette` helper· ΕΝΑ pass ζωγραφίζει selection (gold) + hover (yellow).
- `selection-outline-tokens.ts` — `BIM_HOVER_OUTLINE_COLOR_THREE = 0xffff00`.
- `BimSelectionHighlighter.ts` — optional `apply` param (default `setSelected`· hover → `setHovered`). Ίδια διπλή κλάση.
- `ThreeJsSceneManager.ts` — `hoverHighlighter` + `setHoveredBimEntity(bimId|null)` (skip selected) + clear-on-rebuild.
- `scene-manager-actions.ts` — `hoverHighlighter` στο sync deps + `onClear()` στο rebuild (μηδέν stale mesh ref).
- `use-bim3d-pointer-handlers.ts` — throttled `pickHover` → HoverStore + setHoveredBimEntity· clear σε leave.
- `BimViewport3D.tsx` — mount `<DxfHoverGlowOverlay2D>` + `<HoverAddBadge3D>`.
- `CrosshairOverlay.tsx` — `applyBadge` καλεί το κοινό `resolveHoverBadge` (boy-scout SSoT, μηδέν αλλαγή συμπεριφοράς).

---

## 5. Όρια / σημειώσεις

- Selected ≠ hover-outlined (κρατά το gold· κανόνας `!selected` όπως το 2D `determinePhase`).
- DXF glow: mm scenes (gate `pickDxfEntityAt`, ADR-537). Arc/circle ναι· text όχι (δεν έχει 3D wireframe).
- Throttle ~50ms (όχι το 800ms του popover).
- **Pre-commit CHECK 6B/6D:** stage ADR-538 (+ ADR-536 — άλλαξε το SelectionOutlinePass).

## 6. Tests

- 2 νέα pure suites (18 tests μαζί με τα regression): `resolveHoverBadge`, `dxfEntityOutlineSegments`.
- Τα υπάρχοντα `SelectionOutlinePass`/`BimSelectionHighlighter` GREEN (backward-compatible).
- 🔴 Browser-verify (Giorgio): DXF glow + BIM yellow περίγραμμα + «+» badge + Shift→«−» + selected/hover coexist.

## Changelog

- **2026-06-27** — Φ1 implemented (uncommitted). Ενοποιημένο 3D hover πάνω στο HoverStore + reuse 2D glow/badge +
  ADR-536 outline pass (δεύτερο κίτρινο silhouette). 18 jest GREEN. Browser-verify + commit εκκρεμούν.
- **2026-06-27** — Φ1b refinement (Giorgio «τι θα έκαναν Revit/Maxon;»): το hover silhouette έγινε **λεπτότερο
  (1.4px vs 2.0px) + αχνότερο (alpha 0.65)** ώστε να διαβάζεται ως **παροδικό** έναντι του δεσμευμένου selection
  (Revit/C4D rollover-vs-selection). Νέο `uAlpha` uniform + per-draw `uRadius` στο `SelectionOutlinePass` (ΕΝΑ
  material reused, μηδέν νέο pass). Selection αμετάβλητο (gold 2px solid). 5/5 SelectionOutlinePass tests GREEN.
