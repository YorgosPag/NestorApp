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

### `SYSTEMS_TAB` (`systems-tab.ts`)

All MEP tools + auto-design actions + clash from `draw.mep.group`, as LARGE flat buttons
grouped into **discipline panels** (Revit "HVAC / Plumbing / Electrical / …"). Auto-design
triads (generate → accept → reject) are bundled into each discipline's panel. 10 panels:

| Panel | i18n key | Contents |
|-------|----------|----------|
| Ηλεκτρολογικά | `systemsElectrical` | fixture/socket/panel/data-outlet/comms-rack + electrical-auto(3) + weak-auto(3) |
| Ύδρευση | `systemsWater` | manifold/pipe/derive-networks + water-auto(3) |
| Αποχέτευση | `systemsDrainage` | collector/drain-pipe/floor-drain/drain-riser + drainage-auto(3) |
| Είδη Υγιεινής | `systemsSanitary` | wc/washbasin/shower/bathtub/bidet |
| Συσκευές | `systemsAppliances` | washing-machine |
| Θέρμανση | `systemsHeating` | radiator/boiler/water-heater/underfloor + heating-auto(3) |
| Αερισμός | `systemsHvac` | duct/air-terminal/ahu + hvac-auto(3) |
| Πυρόσβεση | `systemsFire` | sprinkler/fire-riser + fire-auto(3) |
| Αέριο | `systemsGas` | gas-meter/gas-cooker + gas-auto(3) |
| Συντονισμός | `systemsCoordination` | clash detect / clear |

### Boy-Scout re-grouping (N.0.2)

The legacy `draw.mep.group` dumped air-terminal / AHU / sprinkler / fire-riser / gas-meter
/ gas-cooker INSIDE the «Ηλεκτρολογικά» submenu (taxonomically wrong). The new tab places
them in their correct discipline panels (Αερισμός / Πυρόσβεση / Αέριο). CommandKeys /
labels / icons unchanged — only the panel they render in is corrected.

### Tab order

`['home', 'structural', 'architecture', 'systems', 'insert', 'analyze', 'view', 'annotate', 'settings']`
(Revit order: Structure / Architecture / Systems near the front).

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
- `src/subapps/dxf-viewer/ui/ribbon/data/systems-tab.ts`
- `src/subapps/dxf-viewer/ui/ribbon/data/__tests__/architecture-tab.test.ts` (5 tests)
- `src/subapps/dxf-viewer/ui/ribbon/data/__tests__/systems-tab.test.ts` (6 tests)

**MOD**
- `src/subapps/dxf-viewer/ui/ribbon/data/ribbon-default-tabs.ts` (import + register + order)
- `src/subapps/dxf-viewer/ui/ribbon/data/home-tab-draw.ts` (removed `draw.arch.group` + `draw.mep.group`)
- `src/i18n/locales/el/dxf-viewer-shell.json` (2 tab + 12 panel keys)
- `src/i18n/locales/en/dxf-viewer-shell.json` (2 tab + 12 panel keys)

## 5. Google-level checklist (N.7.2)

✅ **Google-level: YES** — data-driven, reuses existing dispatch/SSoT, zero
performance-pipeline impact, no contextual-slot contention (permanent tabs). Boy-Scout
discipline re-grouping fixes a pre-existing mis-categorization. 49/49 ribbon-data tests green.

## 6. Out of scope / DEFER

- «Αντικείμενα» (`draw.objects.group`, furniture/symbols) intentionally stays in Home →
  Draw — it is not a BIM discipline (Revit "Component").
- Per-panel `visibilityKey` gating; merging duplicate `SK` shortcut.

## Changelog

- **2026-06-12** — v1 created (Opus 4.8). New permanent `ARCHITECTURE_TAB` (2 panels, 4
  tools) + `SYSTEMS_TAB` (10 discipline panels, ~55 tools/actions, Boy-Scout re-grouped)
  replacing the nested `draw.arch.group` / `draw.mep.group` dropdowns. 14 new i18n keys
  (el+en). 11 unit tests. Pending browser-verify + commit.
