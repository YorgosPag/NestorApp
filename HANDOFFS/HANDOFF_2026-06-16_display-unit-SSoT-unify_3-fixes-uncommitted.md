# HANDOFF — Display-unit SSoT ενοποίηση (Revit-grade, FULL ENTERPRISE + FULL SSOT) + 3 fixes UNCOMMITTED

**Ημερομηνία:** 2026-06-16
**Συντάκτης:** Opus 4.8 (συνεδρία «3 σταδιακές διορθώσεις DXF» — βλ. HANDOFF_2026-06-16_dxf-three-staged-fixes.md)
**Στόχος νέας συνεδρίας:** Ενοποίηση του display-unit formatter σε **ΕΝΑ** SSoT (Revit/AutoCAD-grade), αφού πρώτα γίνει commit/verify ό,τι είναι ήδη έτοιμο.

> ⚠️ **ΓΛΩΣΣΑ:** Απαντάς ΠΑΝΤΑ Ελληνικά (CLAUDE.md LANGUAGE RULE).
> ⚠️ **COMMIT/PUSH:** Τα κάνει ο **Giorgio**, ΟΧΙ εσύ (N.(-1)). ΠΟΤΕ `git add -A` — μόνο τα δικά σου αρχεία.
> ⚠️ **SHARED WORKING TREE:** Δουλεύει κι άλλος agent. **ΜΗΝ αγγίξεις:** `docs/.../ADR-040-*.md`, `canvas-v2/layer-canvas/LayerCanvas.tsx`, `systems/cursor/snap-scheduler.ts`, και τα HANDOFF_*cursor-lag* / *snap* αρχεία.
> ⚠️ **MODEL (N.14):** δήλωσε μοντέλο & περίμενε «ok» πριν αρχίσεις.
> ⚠️ **TSC (N.17):** ΕΝΑ tsc τη φορά — έλεγξε ότι δεν τρέχει ήδη άλλος πριν ξεκινήσεις.
> ⚠️ **i18n (N.11):** unit symbols ("m"/"cm"/"mm") ΔΕΝ είναι i18n strings (όπως το "°") — επιτρέπονται.

---

## ΜΕΡΟΣ 0 — ΤΙ ΕΙΝΑΙ ΗΔΗ ΕΤΟΙΜΟ (UNCOMMITTED, jest+tsc verified)

Τρία θέματα + ruler round ολοκληρώθηκαν αυτή τη συνεδρία. **Όλα UNCOMMITTED** — ο Giorgio κάνει commit όταν θέλει.

### ΘΕΜΑ 1 — Infinite-loop false positive (ADR-341)
**Αιτία:** ο render-counter στο `EnterpriseDxfSettingsProvider` ήταν **σωρευτικός σε όλη τη ζωή του component, ποτέ reset** → μετά ~100 νόμιμα re-renders (StrictMode×2 + floor/settings/hydration) έβγαζε «INFINITE LOOP DETECTED» (το `derr` τυπώνει ΠΑΝΤΑ, ακόμη & σε prod). **Δεν υπάρχει πραγματικός loop** (LOAD_SUCCESS αποθηκεύει verbatim → hash match → mirror early-return).
**Fix:** rate-based detector (counter μηδενίζει αν περάσει `RENDER_LOOP_WINDOW_MS=2000` χωρίς burst).
**Αρχεία (δικά μου):** `settings-provider/constants.ts`, `settings-provider/EnterpriseDxfSettingsProvider.tsx`, ADR-341 changelog.

### ΘΕΜΑ 2 — Στάθμες strip δεν φαινόταν σε κενά building-storeys (ADR-399)
**Αιτία (Firestore-verified, building `bldg_b4d3cecb`):** ο gate ήταν `floorplanType==='floor' && buildingId`. Όροφοι με imported κάτοψη πέρναγαν από wizard `updateLevelContext({floorplanType:'floor'})` → φαίνονταν· κενοί building-όροφοι (από `findOrCreateLevelForFloor`) έχουν `buildingId` αλλά **όχι** `floorplanType` → κρυφοί.
**Fix:** gate → `!!buildingId` (ανήκει σε κτίριο). Επίπεδο 1 (χωρίς buildingId) μένει κρυφό (απόφαση Giorgio).
**Αρχεία:** `hooks/data/useFloorTabs.ts` (+test, 16/16), ADR-399.
**DEFER (data-hygiene, όχι blocker):** `findOrCreateLevelForFloor` να θέτει & `floorplanType:'floor'` (επηρεάζει τίτλο LevelPanel, ADR-309).

### ΘΕΜΑ 3 — Display-unit wiring (ADR-462 Phase 2, Revit-grade ΕΝΑ unit SoT + live)
Ο status-bar επιλογέας (cm/m/mm/in/ft) ήταν ασύνδετος. Φτιάχτηκε:
- **NEW** `config/display-unit-state.ts` — non-React subscribable store (μοτίβο `cadToggleState`, init από localStorage)
- **NEW** `config/display-length-format.ts` — `formatLengthMm(mm)` → unit + locale + label
- **NEW** `config/__tests__/display-length-format.test.ts`
- `hooks/common/useDisplayUnit.ts` → `useSyncExternalStore` πάνω στο store + `markAllCanvasDirty()` (live redraw)
- Wired: `bim/labels/move-readout.ts` (+test), `bim/labels/bim-dim-labels.ts` (+test, wall/foundation L), `bim/columns/column-dim-labels.ts` (+test, shear-wall L), `systems/phase-manager/drag-measurements/BaseDragMeasurementRenderer.ts` (όλα drag-measure), ruler (`systems/rulers-grid/grid-calculations.ts` [UnitConversion.format→deprecated adapter→SSoT], `ruler-calculations.ts`, `RulersGridSystem.tsx`), `rendering/entities/shared/distance-label-utils.ts` (`renderDistanceLabel`/`renderDistanceLabelStyled` → Line/Circle/Arc/Ellipse/Polyline/Rectangle+preview)
- ADR-462 changelog + §4 + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`
**Απόφαση Giorgio:** μήκη (L) → επιλεγμένη μονάδα· διατομές (t/w/d/h, pad footprint) → mm. Canonical-mm αμετάβλητο.

**Σύνολο jest αυτής της συνεδρίας:** 16 (useFloorTabs) + 44 (display/labels) = **60 PASS**. **tsc:** καθαρό για ΟΛΑ τα δικά μου αρχεία.

---

## ΜΕΡΟΣ 1 — 🎯 ΚΥΡΙΑ ΔΟΥΛΕΙΑ ΝΕΑΣ ΣΥΝΕΔΡΙΑΣ: ΕΝΟΠΟΙΗΣΗ display-unit formatter (FULL SSOT)

**Το πρόβλημα (βρέθηκε σε self-audit, ο Giorgio το ζήτησε):** Υπάρχουν **δύο παράλληλοι** display-unit formatters → divergence:

| Formatter | Πού | Έξοδος | Σκοπός |
|---|---|---|---|
| `formatDisplayValue(mm,unit)` (υπάρχον, `config/units.ts`) | dynamic-input, entity-property-schema, **QuickPropertiesHoverPopover**, QuickPropertiesMiniPanel, PropertiesPalette | `.toFixed()` (τελεία, **χωρίς** label) | parseable (editable inputs round-trip με `fromDisplay`) |
| `formatLengthMm(mm)` (νέο, `config/display-length-format.ts`) | move/dim/ruler/drag/entity labels (αυτή η συνεδρία) | **locale** (κόμμα) + label | read-only display |

➡️ Ασυνέπεια: Properties palette «500.00 cm» (τελεία) vs δικά μου dim-pills «500,00 cm» (κόμμα).

**⚠️ ΚΡΙΣΙΜΟ — γιατί ΔΕΝ είναι «σβήσε το ένα»:** τα **editable inputs** ΠΡΕΠΕΙ να μένουν locale-free/parseable (αλλιώς σπάει `parseFloat`/`fromDisplay` όταν ο χρήστης γράφει τιμή). Άρα χρειάζονται **δύο λειτουργίες**, αλλά **ΕΝΑ module / ΜΙΑ υλοποίηση μετατροπής**.

### Σχέδιο ενοποίησης (Google/Revit-correct) — προτεινόμενο
1. **`config/units.ts` = το ΕΝΑ home.** Πρόσθεσε `formatLengthForDisplay(mm, {unit?, precision?, withUnit?})` = locale-aware (FormatterRegistry) + label, πάνω στο κοινό `toDisplay`. (Μετέφερε εκεί τη λογική που τώρα ζει στο `formatLengthMm`.)
2. **`formatDisplayValue`** μένει ως έχει (parseable, για inputs) — ΜΟΝΟ τεκμηρίωσέ το ρητά ως «input/parseable» SSoT.
3. **`config/display-length-format.ts` `formatLengthMm`** → γίνεται **thin wrapper**: διαβάζει `displayUnitState.getUnit()` + καλεί `units.formatLengthForDisplay`. **Μηδέν δική του locale-logic.** (Ή κατάργησέ το τελείως και κάλεσε `formatLengthForDisplay` με store-unit παντού — απόφαση δική σου, αλλά ΕΝΑ impl.)
4. **Migrate read-only display consumers** που κάνουν χειροκίνητα `formatDisplayValue + DISPLAY_UNIT_LABELS` → στο `formatLengthForDisplay` (locale+label):
   - `systems/properties/QuickPropertiesHoverPopover.tsx:72`
   - (έλεγξε & QuickPropertiesMiniPanel/άλλα read-only spots — ΟΧΙ τα editable PropertiesPalette/dynamic-input inputs)
5. **Τελείωσε το DEFER sliver** (inline `formatDistance(` εκτός του `renderDistanceLabel` chokepoint) → ίδια διαδρομή SSoT:
   - `systems/dynamic-input/` (read-only display μέρη — ΟΧΙ τα editable input fields)
   - `utils/hover/edge-utils.ts`, `radius-utils.ts`, `text-labeling-utils.ts`, `render-utils.ts`
   - `systems/guides/guide-annotations-renderer.ts`
   - cursor **coordinate readout** (βρες το· πιθανόν `CoordinateCalibrationOverlay` ή στα canvas-v2 overlays)
6. **Επαλήθευση:** ΕΝΑ formatter impl· όλα τα read-only display ίδιο locale+label· τα inputs ασφαλή parseable. tsc + jest. Browser-verify (άλλαξε cm↔m → ΟΛΑ — properties, ruler, dim-pills, dynamic-input, hover — αλλάζουν συνεπώς & live).

**Default unit = 'cm'** (`DEFAULT_DISPLAY_UNIT`, `DISPLAY_UNIT_STORAGE_KEY='dxf:displayUnit'`). Precision: `DEFAULT_DISPLAY_PRECISION` (mm=0, cm=2, m=3). Locale: `FormatterRegistry.getInstance().formatDistance(value, precision)`. Live redraw: `markAllCanvasDirty()` (re-export από `rendering/core/UnifiedFrameScheduler`).

**Mode (N.8):** ~5-7 αρχεία, 1 domain → Plan Mode. Όχι orchestrator.

---

## ΜΕΡΟΣ 2 — ΛΟΙΠΕΣ ΕΚΚΡΕΜΟΤΗΤΕΣ
- 🔴 **browser-verify + commit** των 3 θεμάτων + ruler (ο Giorgio).
- 🔴 **Χαμένος ξυλότυπος θεμελίωσης** μετά hard-refresh = **ξεχωριστό scene-persistence θέμα (data-loss)**, ΟΧΙ display-units, ΟΧΙ settings-provider. Πιθανόν canonical-mm uncommitted ή dual-persistence snapshot (βλ. MEMORY `reference_bim_dual_persistence_load_ssot`). Χρειάζεται δική του διερεύνηση (Firestore-first).

---

## ΜΕΡΟΣ 3 — git add (ΜΟΝΟ δικά μου· ο Giorgio κάνει commit)
```
# ΘΕΜΑ 1
src/subapps/dxf-viewer/settings-provider/constants.ts
src/subapps/dxf-viewer/settings-provider/EnterpriseDxfSettingsProvider.tsx
docs/centralized-systems/reference/adrs/ADR-341-user-settings-ssot.md   (⚠️ MIXED — μόνο το changelog entry 2026-06-16)
# ΘΕΜΑ 2
src/subapps/dxf-viewer/hooks/data/useFloorTabs.ts
src/subapps/dxf-viewer/hooks/data/__tests__/useFloorTabs.test.ts
docs/centralized-systems/reference/adrs/ADR-399-dxf-floor-navigation-tabs.md
# ΘΕΜΑ 3 + ruler (render-path → CHECK 6D: stage & ADR-462)
src/subapps/dxf-viewer/config/display-unit-state.ts                      (NEW)
src/subapps/dxf-viewer/config/display-length-format.ts                   (NEW)
src/subapps/dxf-viewer/config/__tests__/display-length-format.test.ts    (NEW)
src/subapps/dxf-viewer/hooks/common/useDisplayUnit.ts
src/subapps/dxf-viewer/bim/labels/move-readout.ts
src/subapps/dxf-viewer/bim/labels/__tests__/move-readout.test.ts
src/subapps/dxf-viewer/bim/labels/bim-dim-labels.ts
src/subapps/dxf-viewer/bim/labels/__tests__/bim-dim-labels.test.ts
src/subapps/dxf-viewer/bim/columns/column-dim-labels.ts
src/subapps/dxf-viewer/bim/columns/__tests__/column-dim-labels.test.ts
src/subapps/dxf-viewer/systems/phase-manager/drag-measurements/BaseDragMeasurementRenderer.ts
src/subapps/dxf-viewer/systems/rulers-grid/grid-calculations.ts
src/subapps/dxf-viewer/systems/rulers-grid/ruler-calculations.ts
src/subapps/dxf-viewer/systems/rulers-grid/RulersGridSystem.tsx
src/subapps/dxf-viewer/rendering/entities/shared/distance-label-utils.ts
docs/centralized-systems/reference/adrs/ADR-462-canonical-mm-units.md    (⚠️ MIXED αν την αγγίζει & ο ADR-462 Phase-1 commit)
local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt                                                    (⚠️ MIXED — μόνο sub-items 1/2/3)
```
**ΠΡΟΣΟΧΗ shared tree:** το αρχικό git status είχε & άλλα M (dxf-import.ts, dxf-scene-builder.ts, scene-units.ts, dxf-parser.worker.ts = ADR-462 Phase 1 / άλλος agent). ΜΗΝ τα stage-άρεις χωρίς να ξέρεις.

## ΜΕΡΟΣ 4 — Γνωστά pre-existing tsc errors (ΟΧΙ δικά μου — μην τα «διορθώσεις»)
14 errors σε: `bim-3d/converters/BimToThreeConverter.ts`, `bim-3d/converters/mesh-to-object3d.ts`, `bim-3d/placement/BeamFromWallGhost.ts`, `bim-3d/proposal/proposal-ghost-3d-builders.ts`, `bim-3d/proposal/ProposalGhost3DMount.tsx`, `bim/foundations/foundation-level.ts`, `bim/slabs/slab-grid-commit.ts`, `hooks/canvas/useDxfSceneConversion.ts`, `hooks/data/useFloors3DAggregator.ts`. Shared-tree (άλλος agent, ADR-459/460/461). Άστα.

## ΜΕΡΟΣ 5 — BROWSER-VERIFY βήματα
- **Θ1:** κανονική χρήση viewer → καμία «INFINITE LOOP DETECTED» στην κονσόλα (αν εμφανιστεί τώρα γράφει `within 2000ms` = αληθινός loop).
- **Θ2:** πλοήγηση σε κενό building-όροφο (π.χ. «2ος Όροφος») → strip ορατή· «Επίπεδο 1» → strip κρυφή.
- **Θ3:** άλλαξε cm↔m στον status-bar επιλογέα → move readout / dim-pills (hover/select) / drag-measure / **ruler ticks** / entity distance labels αλλάζουν μονάδα **live** (χωρίς refresh).

## ΜΕΡΟΣ 6 — BASELINE ΒΑΣΗΣ (test data, ζωντανά)
- company `comp_9c7c1a50-...` · user `WKBWEg3DSfcdSbLNJfzGEW3vkct1` · project `proj_0df5af7a-...` · building `bldg_b4d3cecb-...`
- Levels (όλα buildingId): Ισόγειο (floorplanType:'floor', _AfrPolGD) · F/Θεμελίωση (floorplanType:'floor', ΞΥΛΟΤΥΠΟΣ) · 1ος/2ος Όροφος + Απόληξη Κλιμακοστασίου (κενά, χωρίς floorplanType). Επίπεδο 1 = default χωρίς buildingId.
- Firestore MCP διαθέσιμο για diagnosis.
