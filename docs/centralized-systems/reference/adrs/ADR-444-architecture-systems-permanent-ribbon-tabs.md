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
| Ηλεκτρολογικά | `electrical` | Ισχυρά (fixture/socket/panel) · Ασθενή (data-outlet/comms-rack) · Αυτόματα Ισχυρά (electrical-auto ×3) · Αυτόματα Ασθενή (weak-auto ×3) — split 2026-10-24, §7 |
| Ύδρευση | `water` | Δίκτυο Ύδρευσης (manifold/pipe/derive) · Είδη Υγιεινής & Συσκευές (wc/washbasin/shower/bathtub/bidet/washing-machine/bathroom-auto-arrange) · Αυτόματη Ύδρευση (×3) |
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
  `commandKey` / `action` / `labelKey` / `shortcut` already wired by
  `home-tab-draw.ts` (`ribbon.commands.bim.*`, `floorplanSymbol.catalog.*`,
  `mepFixture.appliance.*`). Byte-identical behaviour. (The `icon` was also reused in
  v1–v2; since 2026-10-24 the MEP tabs have their own plan-symbol icons — §7.)
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
- Accept / Reject enabled only while a proposal is pending (see §7.6).

## 7. Icons — plan-symbol subject × action badge (2026-10-24)

### 7.1 Problem

Giorgio (screenshot 2026-10-24): «τα εικονίδια στα Ηλεκτρολογικά είναι όλα ίδια».
The tabs reused the legacy launcher icons, which were per-*family*, not per-*button*:

| Tab | Buttons | Distinct icons (before) |
|-----|---------|-------------------------|
| Ηλεκτρολογικά | 11 | 3 — the plug glyph ×8 (socket, data outlet, all 6 auto buttons), panel ×2 (panel + rack) |
| Πυρόσβεση & Αέριο | 10 | 1 — pipe glyph ×10 |
| Ύδρευση (fixtures) | 7 | 1 — the furniture armchair for WC / shower / washing machine … |
| Every auto triad | 3 | 1 — Δημιουργία / Αποδοχή / Απόρριψη indistinguishable |

The two electrical triads also had identical labels and sat in one panel, so «Δημιουργία»
appeared twice with nothing to tell strong from weak current.

### 7.2 What the big players do

- **Revit** (Systems → Electrical): one icon per category — Lighting Fixture, Electrical
  Equipment, Electrical Fixture, Data Device, Communication Device, Fire Alarm … never shared.
- **Revit** edit modes: green ✓ *Finish* / red ✗ *Cancel* — the action is read from shape +
  colour, not text.
- **Office** (Review → Accept / Reject): object glyph + ✓ / ✗ modifier.
- **Fluent / Material / Apple HIG**: one icon = one concept; a badge is a cut-out overlay.

### 7.3 Decision (beyond the big players)

**The ribbon icon IS the element's 2D plan symbol.** Every MEP element already has a pure
plan drawer (`socketDrawer`, `buildBoardStrokes`, `buildFinStrokes`, `SANITARY_DRAWERS`, …).
The icon runs that SAME drawer on a canonical 24×24 footprint sized from the element's
AUTHORED default dimensions (`DEFAULT_*_MM`, `SANITARY_SPEC`). The button therefore shows
exactly the symbol that lands on the drawing; change a symbol → its icon follows. Revit /
ArchiCAD hand-draw ribbon bitmaps unrelated to the annotation symbol on the sheet.

On top, an **action badge** (generalising the ADR-443 method badge) marks the auto-design
triad: ✦ generate (currentColor) · ✓ accept (`--ribbon-icon-accept`) · ✗ reject
(`--ribbon-icon-reject`). The subject is masked out under a cut-out circle. Shape alone
separates the three (colour-blind safe); colour is a redundant second cue. Contrast ≥ 4.4:1
in light and ≥ 5.4:1 in dark (WCAG 1.4.11 needs 3:1).

Strong vs weak current became their own panels (Ισχυρά / Ασθενή / Αυτόματα Ισχυρά /
Αυτόματα Ασθενή) — the triads are told apart by subject (socket ⟂ data-outlet triangle)
AND by panel title.

### 7.4 Architecture (FULL SSoT)

| Module (`ui/ribbon/components/buttons/`) | Role |
|---|---|
| `mep-icon-tokens.ts` | Vocabulary: `MEP_ICON_SUBJECTS` (30) × `MEP_ICON_BADGES` (3); `mepIconToken()` builds, `parseMepIconToken()` validates — React-free, imported by the ribbon data |
| `mep-icon-geometry.ts` | `iconFootprint()` (authored aspect, legibility floor `ICON_MIN_ASPECT` 0.5, front edge at bottom), `strokesToPathD()` |
| `mep-icon-subjects-plan.ts` | Subjects drawn by the plan-symbol SSoT drawers |
| `mep-icon-subjects-network.ts` | Linear networks & generative tools (pipe tick via `buildPipeTickScreen`, bathroom via `SANITARY_DRAWERS`) |
| `mep-icon-subjects.ts` | `Record<MepIconSubject, builder>` (compile-time completeness) + memoised `resolveMepIconGeometry()` |
| `mep-icon-badges.tsx` | Badge fragments + cut-out geometry |
| `MepToolIcon.tsx` | Renderer: subject (body 1.5 / detail 1.0 stroke, as the canvas draws gratings/fins thinner) + masked badge |
| `ribbon-icon-mep.tsx` | `resolveMepRibbonIcon()` — delegated from `RibbonButtonIcon` `default:` (same split as `ribbon-icon-table`) |

Plan-side helpers that were private/inline were **exported, not copied**, and the plan
builders now call them: `buildBoardStrokes` / `buildRackStrokes` (panel), `buildFinStrokes`
(radiator), `buildWaterHeaterTankGlyph` (water heater), `buildLuminaireCrossStrokes` +
`buildFloorDrainGridStrokes` (fixture), `buildManifoldStubStrokes` (manifold). Plan output
is unchanged (pure extraction).

### 7.5 Guards

- `systems-discipline-tabs.test.ts`: no two buttons of a tab share an icon; every icon is a
  valid MEP token; every `.actions.generate|accept|reject` carries the matching badge;
  electrical panel split.
- `MepToolIcon.test.tsx`: every subject × badge renders; all 30 subjects geometrically
  distinct; all geometry inside the viewBox; mask wiring; token round-trip + rejection.

### 7.6 Next stage (proposed, not implemented)

Revit / Office enable *Finish/Accept* and *Cancel/Reject* only while there is something to
accept. The ribbon already supports per-panel `visibilityKey`; a follow-up can expose a
«πρόταση σε εκκρεμότητα» predicate per auto-design engine and gate Accept/Reject on it.

## Changelog

- **2026-06-12** — v1 created (Opus 4.8). New permanent `ARCHITECTURE_TAB` + single
  `SYSTEMS_TAB` (10 discipline panels) replacing `draw.arch.group` / `draw.mep.group`.
- **2026-06-12** — v2 (Opus 4.8). Per Giorgio: the single `SYSTEMS_TAB` was too large and
  still growing → **split into SIX MEP discipline tabs** (`systems-discipline-tabs.ts`:
  electrical/water/drainage/heating/hvac/fire-gas, one per Greek Η/Μ μελέτη). Clash moved
  OUT to «Ανάλυση» (`CLASH_COORDINATION_PANEL`). `systems-tab.ts` (+ its test) removed
  (never committed). 22 i18n container keys total (7 tabs + 15 panels). 10 unit tests for
  the discipline tabs + analyze. 48/48 ribbon-data tests green. Pending browser-verify + commit.
- **2026-10-24** — v3 (Opus 5.5). §7 Icons: every MEP button gets its own icon = the
  element's plan symbol (same SSoT drawer) × action badge (✦ / ✓ / ✗). Electrical tab split
  into Ισχυρά / Ασθενή / Αυτόματα Ισχυρά / Αυτόματα Ασθενή (i18n: `electricalDevices` →
  `electricalStrong` + `electricalWeak`; NEW `electricalWeakAuto`; `electricalAuto` relabelled).
  New ribbon tokens `--ribbon-icon-accept|reject`. Plan helpers exported (pure extraction).
  §2 table brought in line with code (bathroom-auto-arrange was missing).
