# ADR-444 — Permanent «Αρχιτεκτονικά» & «ΗΛΜ» Ribbon Tabs (Revit-grade)

**Status:** 🟢 v1 implemented — pending browser-verify + commit (2026-06-12)
**Discipline:** DXF Viewer · Ribbon UI
**Related:** ADR-443 (Structural permanent tab — direct sibling, same pattern), ADR-419 (Revit-style launcher hierarchy / `draw.arch.group` + `draw.mep.group`), ADR-345 (Ribbon data model)

---

## 1. Context / Problem

Direct continuation of ADR-443. Having moved the load-bearing tools out of the nested
`draw.bim.group` dropdown into a permanent «Δομικά» tab, the two remaining nested
cascading launchers in `home-tab-draw.ts` — **`draw.arch.group`** (Αρχιτεκτονικά) and
**`draw.mep.group`** (ΗΛΜ, ~55 commands across 16 hover-expandable submenus) — had the
same scannability problem. Giorgio approved the same Revit-grade treatment for both
(2026-06-12).

## 2. Decision

Add **two more permanent ribbon tabs**, siblings of `STRUCTURAL_TAB`, exactly mirroring
Revit's permanent **"Architecture"** and **"Systems"** tabs. Same rationale as ADR-443:
every tool's per-entity property contextual tab still surfaces on top on activation, and a
permanent tab never contends for the single contextual slot.

### `ARCHITECTURE_TAB` (`architecture-tab.ts`)

Non-load-bearing envelope/space elements from `draw.arch.group`. 2 panels:

| Panel | i18n key | Tools |
|-------|----------|-------|
| Στέγη & Δάπεδο | `ribbon.panels.archRoofFloor` | roof / floor-finish |
| Χώροι | `ribbon.panels.archSpaces` | thermal-space / space-separator |

### MEP — SIX discipline tabs (`systems-discipline-tabs.ts`)

The MEP toolset (~55 commands and growing) was too large for one tab. Giorgio
(2026-06-12) chose to split it into **SIX permanent discipline tabs**, one per Greek
engineering μελέτη (Η/Μ study). Rationale: Revit keeps ONE "Systems" tab and compresses
with discipline panels + **dropdowns**; since the product forbids dropdowns (all large),
the faithful equivalent is one tab per discipline. Auto-design triads (generate → accept →
reject) live WITH their discipline (they author model elements).

| Tab | id / i18n | Panels (tools) |
|-----|-----------|----------------|
| Ηλεκτρολογικά | `electrical` | Ισχυρά & Ασθενή (fixture/socket/panel/data-outlet/comms-rack) · Αυτόματος Σχεδιασμός (electrical-auto ×3 + weak-auto ×3) |
| Ύδρευση | `water` | Δίκτυο Ύδρευσης (manifold/pipe/derive) · Είδη Υγιεινής & Συσκευές (wc/washbasin/shower/bathtub/bidet/washing-machine) · Αυτόματη Ύδρευση (×3) |
| Αποχέτευση | `drainage` | Δίκτυο (collector/drain-pipe/floor-drain/drain-riser) · Αυτόματη Αποχέτευση (×3) |
| Θέρμανση | `heating` | Στοιχεία (radiator/boiler/water-heater/underfloor) · Αυτόματη Θέρμανση (×3) |
| Κλιματισμός | `hvac` | Στοιχεία (duct/air-terminal/ahu) · Αυτόματος Αερισμός (×3) |
| Πυρόσβεση & Αέριο | `fire-gas` | Πυρόσβεση (sprinkler/fire-riser + fire-auto ×3) · Αέριο (gas-meter/gas-cooker + gas-auto ×3) |

Plumbing fixtures (sanitary + appliances) are homed in **Ύδρευση** (water-consuming
fixtures). The cross-discipline **Clash / Συντονισμός moved OUT to the «Ανάλυση» tab**
(`CLASH_COORDINATION_PANEL` in `analyze-tab.ts`) — it is an analysis tool, not a placement
tool (Revit puts interference/clash under Analyze/Collaborate).

### Boy-Scout re-grouping (N.0.2)

The legacy `draw.mep.group` dumped air-terminal / AHU / sprinkler / fire-riser / gas-meter
/ gas-cooker INSIDE the «Ηλεκτρολογικά» submenu (taxonomically wrong). The new tabs place
them in their correct discipline (Κλιματισμός / Πυρόσβεση / Αέριο). CommandKeys / labels /
icons unchanged — only the tab they render in is corrected.

### Tab order

`['home', 'structural', 'architecture', 'electrical', 'water', 'drainage', 'heating', 'hvac', 'fire-gas', 'insert', 'analyze', 'view', 'annotate', 'settings']`.

## 3. SSoT guarantees

- **Zero new command labels / dispatch paths.** Every button reuses the exact
  `commandKey` / `action` / `icon` / `labelKey` / `shortcut` already wired by
  `home-tab-draw.ts` (`ribbon.commands.bim.*`, `floorplanSymbol.catalog.*`,
  `mepFixture.appliance.*`). Byte-identical behaviour.
- **Only 14 new container i18n keys** (2 tabs + 2 arch panels + 10 systems panels), el + en.
- Registered in `DEFAULT_RIBBON_TABS` + `DEFAULT_RIBBON_TAB_ORDER`. No
  `ribbon-contextual-config.ts` change (permanent, not contextual).

### Known faithful carry-over

The source reuses shortcut `SK` for both `mep-socket` and `mep-sprinkler` (different
disciplines). Preserved verbatim (chords are owned by the separate keyboard system); the
`SYSTEMS_TAB` test therefore does not assert shortcut uniqueness.

## 4. Files

**NEW**
- `src/subapps/dxf-viewer/ui/ribbon/data/architecture-tab.ts`
- `src/subapps/dxf-viewer/ui/ribbon/data/systems-discipline-tabs.ts` (6 MEP tabs + `MEP_DISCIPLINE_TABS`)
- `src/subapps/dxf-viewer/ui/ribbon/data/__tests__/architecture-tab.test.ts` (5 tests)
- `src/subapps/dxf-viewer/ui/ribbon/data/__tests__/systems-discipline-tabs.test.ts` (5 tests)

**MOD**
- `src/subapps/dxf-viewer/ui/ribbon/data/ribbon-default-tabs.ts` (import + spread-register 6 tabs + order)
- `src/subapps/dxf-viewer/ui/ribbon/data/analyze-tab.ts` (NEW `CLASH_COORDINATION_PANEL` — clash moved here)
- `src/subapps/dxf-viewer/ui/ribbon/data/home-tab-draw.ts` (removed `draw.arch.group` + `draw.mep.group`)
- `src/i18n/locales/el/dxf-viewer-shell.json` (7 tab + 15 panel keys: 1 arch tab + 6 MEP tabs, 2 arch + 13 MEP/coordination panels)
- `src/i18n/locales/en/dxf-viewer-shell.json` (same)

## 5. Google-level checklist (N.7.2)

✅ **Google-level: YES** — data-driven, reuses existing dispatch/SSoT, zero
performance-pipeline impact, no contextual-slot contention (permanent tabs). Boy-Scout
discipline re-grouping fixes a pre-existing mis-categorization. 49/49 ribbon-data tests green.

## 6. Out of scope / DEFER

- «Αντικείμενα» (`draw.objects.group`, furniture/symbols) intentionally stays in Home →
  Draw — it is not a BIM discipline (Revit "Component").
- Per-panel `visibilityKey` gating; merging duplicate `SK` shortcut.

## Changelog

- **2026-06-12** — v1 created (Opus 4.8). New permanent `ARCHITECTURE_TAB` + single
  `SYSTEMS_TAB` (10 discipline panels) replacing `draw.arch.group` / `draw.mep.group`.
- **2026-06-12** — v2 (Opus 4.8). Per Giorgio: the single `SYSTEMS_TAB` was too large and
  still growing → **split into SIX MEP discipline tabs** (`systems-discipline-tabs.ts`:
  electrical/water/drainage/heating/hvac/fire-gas, one per Greek Η/Μ μελέτη). Clash moved
  OUT to «Ανάλυση» (`CLASH_COORDINATION_PANEL`). `systems-tab.ts` (+ its test) removed
  (never committed). 22 i18n container keys total (7 tabs + 15 panels). 10 unit tests for
  the discipline tabs + analyze. 48/48 ribbon-data tests green. Pending browser-verify + commit.
