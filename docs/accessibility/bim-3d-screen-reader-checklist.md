# BIM 3D Viewer — Screen Reader QA Checklist

**ADR-366 Phase 8 (8.0 + 8.1) — Manual verification guide**

Tested with: NVDA 2024.x (Windows/Chrome), VoiceOver (macOS/Safari + iOS/Safari)

---

## How to use

1. Open `/dxf/viewer` or `/properties` → toggle to 3D mode.
2. Enable screen reader. Navigate with keyboard only (no mouse).
3. Verify each row below.

---

## Checklist

| # | Element / Action | Keys | Expected SR Announcement |
|---|---|---|---|
| 1 | Viewport container | Tab to canvas | "Viewport 3D — use arrow keys to orbit, Tab to focus entities" (or locale equivalent) |
| 2 | Mode toggle button (2D→3D) | Click / Enter | "Switched to 3D mode" |
| 3 | Mode toggle button (3D→2D) | Click / Enter | "Switched to 2D mode" |
| 4 | First Tab into 3D viewport | Tab | Entity description announced (e.g. "Wall Wall_A12") |
| 5 | Tab to next entity | Tab | Description of next entity announced |
| 6 | Shift+Tab to previous entity | Shift+Tab | Description of previous entity announced |
| 7 | Wall with full geometry data | Tab to wall | "Wall, length Xm, height Ym, material Z, level W" |
| 8 | Wall with no geometry data | Tab to wall | "Wall WallName" (fallback to entityName) |
| 9 | Column focus | Tab to column | "Column ColName" or with geometry if available |
| 10 | Beam focus | Tab to beam | "Beam BeamName" or with geometry |
| 11 | Slab focus | Tab to slab | "Slab SlabName" or "Slab, area Xm², thickness Ym" |
| 12 | Opening focus | Tab to opening | "Opening OpeningName" or with dimensions |
| 13 | Slab opening focus | Tab to slab opening | "Slab opening Name" or with dimensions |
| 14 | Stair focus | Tab to stair | "Stair StairName" or "Stair, level L" |
| 15 | Unknown entity type | Tab to unknown | "BIM entity EntityName" |
| 16 | Entity selection via Enter | Enter on focused | "Wall selected" (selection announcement) |
| 17 | Selection cleared via Esc | Esc | "Selection cleared" |
| 18 | Focus cleared via Esc | Esc (no selection) | No announcement (focus silently cleared) |
| 19 | Entity with level name | Tab to leveled entity | Level name fragment included: "..., level Ground Floor" |
| 20 | Entity with material | Tab to material entity | Material fragment included: "..., material Concrete" |
| 21 | Re-focus same entity | Tab away then Tab back | Description announced again (not deduplicated by SR) |
| 22 | Viewport role announcement | First focus into container | "Application" role announced |
| 23 | Live region polite | Selection change | Announcement does not interrupt ongoing speech |
| 24 | Live region assertive | Error state (if any) | Announcement interrupts ongoing speech |
| 25 | Multiple Tab presses | Rapid Tab | Announcements queue (not overlap) |
| 26 | 3D mode unavailable | Property-only viewer | No focus navigation crash, graceful fallback |
| 27 | Empty scene (no entities) | Tab in 3D viewport | No focus cycling, no announcement |
| 28 | Hidden floor entities | Floor hidden via panel | Hidden entities skipped in Tab order |
| 29 | Hidden building entities | Building hidden via panel | Hidden entities skipped in Tab order |
| 30 | VoiceOver iOS — swipe navigation | Swipe right | Entity description readable via VoiceOver |

---

## Phase 8.0 UI Controls

| # | Element / Action | Keys | Expected SR Announcement |
|---|---|---|---|
| 31 | 3D Controls panel (aside) | Tab into panel | "3D Controls" landmark announced |
| 32 | Tab strip role | Focus tablist | SR announces "tablist" role |
| 33 | Active tab (Floors) | Tab to tab | "Floors tab, selected, 1 of 4" (or locale equivalent) |
| 34 | Inactive tab (Lighting) | Tab to tab | "Lighting tab, not selected, 2 of 4" |
| 35 | Switch tab | Arrow keys / click | New tab "selected" state announced |
| 36 | Tab panel content | Auto-focus after tab change | Content landmark announced |
| 37 | Section mode Box button | Tab to button | "Box, toggle button, pressed" |
| 38 | Section mode Plane button | Tab to button | "Plane, toggle button, not pressed" |
| 39 | Toggle Section mode | Click / Enter | aria-pressed state flips — SR announces new state |

---

## Known limitations (Phase 8.1)

- Geometry data (length, height, area, etc.) is only available if the 3D mesh `userData` exposes it. Currently meshes expose `bimType` + `entityName` only → descriptions use entityName fallback.
- Future improvement: extend `findFocusedEntityData` to extract geometry fields from mesh userData when IFC property sets are available.
- VoiceOver iOS: `role="application"` may suppress swipe navigation in some VoiceOver versions. Use VoiceOver container navigation as workaround.

---

## WCAG compliance targets

| Criterion | Target | Phase 8.1 status |
|---|---|---|
| 1.3.1 Info and Relationships | A | ✅ Semantic roles (application, status, alert, tablist/tab/tabpanel, region) |
| 4.1.2 Name, Role, Value | A | ✅ aria-selected on tabs, aria-pressed on mode buttons, aria-label on all interactive elements |
| 4.1.3 Status Messages | AA | ✅ aria-live polite/assertive regions |
| 2.1.1 Keyboard | A | ✅ Tab/Shift-Tab/Enter/Esc navigation |
| 1.4.1 Use of Color | A | ✅ Selection also announced as text |
