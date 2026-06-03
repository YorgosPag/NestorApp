# HANDOFF — ADR-408 Φ7: Colour-by-system toggle (NEXT)

**Ημερομηνία:** 2026-06-03
**Από:** Opus 4.8 session (MEP wire Φ7)
**Προς:** επόμενη συνεδρία
**Γλώσσα απαντήσεων:** Ελληνικά πάντα (CLAUDE.md LANGUAGE RULE)

---

## 0. ΚΡΙΣΙΜΟΙ ΚΑΝΟΝΕΣ (διάβασέ τους ΠΡΩΤΑ)
- ⚠️ **Working tree μοιράζεται με άλλον agent** → `git add` ΜΟΝΟ specific αρχεία, **ΠΟΤΕ `git add -A`**.
- ⚠️ **Commit/push τα κάνει Ο GIORGIO, ΟΧΙ ο agent** (N.(-1)). Μην κάνεις commit ποτέ χωρίς ρητή εντολή.
- N.14 model gate: δήλωσε μοντέλο & περίμενε «ok» πριν μη-τετριμμένη υλοποίηση.
- N.15: μετά την υλοποίηση ενημέρωσε ΕΚΚΡΕΜΟΤΗΤΕΣ + ADR + memory (ίδιο commit).
- ADR-040: αν αγγίξεις 2D micro-leaf/overlay (`MepFixtureRenderer`, `HomeRunWiresOverlay`) → STAGE ADR-040 (CHECK 6B/6D). `MepWireRenderer` (bim/renderers) = ΕΚΤΟΣ.

---

## 1. ΚΑΤΑΣΤΑΣΗ — τι έγινε στην προηγούμενη συνεδρία (ΟΛΑ pending commit, ✅ browser-verified)
Τρία items, **uncommitted στο working tree**, ο Giorgio θα κάνει commit:

1. **🐛 meter-scale 1000× fly-off** — live drag του 3D gizmo πέταγε το καλώδιο «στο άπειρο» σε σχέδια μέτρων. FIX: `applyDragXform` μετατρέπει mm→scene units μέσω `mmToSceneUnits`.
   - MOD `bim-3d/animation/bim3d-wire-preview-rebuild.ts` (+ test).
2. **🐛 3D waypoint handle z-mismatch** — η λευκή σφαίρα-λαβή ξεκόλλαγε από το καλώδιο στο orbit. FIX: εξαγωγή `splicedSegmentInterior` (arc-length z) ως SSoT· το 3D handle layer καλεί την ΙΔΙΑ συνάρτηση.
   - MOD `bim/mep-systems/mep-wire-routing.ts` + `bim-3d/animation/use-bim3d-wire-waypoint-interaction-3d.ts` (+ test).
3. **🟢 Conductor-count ticks** — Revit home-run tick marks (φάση=μακριά / ουδέτερος=κοντή / γείωση=κοντή+κουκκίδα).
   - NEW `bim/mep-systems/mep-wire-conductor-ticks.ts` (+ test), `ui/ribbon/components/RibbonMepCircuitConductorsWidget.tsx`.
   - MOD `bim/types/mep-system-types.ts`, `bim/types/mep-system.schemas.ts` (+test), `bim/mep-systems/mep-wire-routing.ts` (+test), `bim/renderers/MepWireRenderer.ts`, `ui/ribbon/components/RibbonPanel.tsx`, `ui/ribbon/data/contextual-mep-circuit-tab.ts`, i18n `el/en/dxf-viewer-shell.json`.
   - Κοινό MOD `ADR-408-mep-connectors-and-systems.md` (changelog).

**Όλα:** tsc 0, MEP-wire tests PASS. Εκτός ADR-408 changelog, κανένα από αυτά δεν χρειάστηκε ADR-040 staging.

---

## 2. ΕΠΟΜΕΝΗ ΕΡΓΑΣΙΑ — Colour-by-system toggle (ADR-408 Φ7 roadmap)

### Στόχος
View-tab διακόπτης ON/OFF για το «χρώμα ανά σύστημα». **Σήμερα είναι ΠΑΝΤΑ ON — δεν υπάρχει flag.** OFF → φωτιστικά/πίνακες/καλώδια στο default χρώμα. FULL ENTERPRISE + FULL SSOT (αίτημα Giorgio).

### SSoT flag
`colorBySystem: boolean` (default `true`) στο **`useBimRenderSettingsStore`** (`src/subapps/dxf-viewer/state/bim-render-settings-store.ts`) + στους τύπους `BimRenderSettings`/`ResolvedBimSettings` (`src/subapps/dxf-viewer/config/bim-render-settings-types.ts`), Firestore-persisted όπως τα υπόλοιπα settings (`saveBimRenderSettings`/`resolveBimSettings`). **Και τα 3 gate points ήδη διαβάζουν αυτό το store** (ως `useDrawingScaleStore`, που είναι alias).

### Gate points (όταν OFF → ΜΗΝ εφαρμόσεις χρώμα συστήματος)
1. **2D φωτιστικό** — `bim/renderers/MepFixtureRenderer.ts` ~γρ.68–74 (override stroke/fill μέσω `resolveEntitySystemColor`). Gate με `colorBySystem`.
2. **2D καλώδια** — `components/dxf-layout/HomeRunWiresOverlay.tsx` ~γρ.111–113. Το `colorHex` έρχεται embedded από το routing (`bim/mep-systems/mep-wire-routing.ts` ~γρ.237 `colorHex: systemColor(system)`). **ΑΠΟΦΑΣΗ:** ΜΗΝ αλλάξεις το pure routing SSoT· gate στον renderer/overlay (default wire colour όταν OFF — π.χ. πέρασε flag στο `drawCircuitWires`).
3. **3D** — `bim-3d/scene/BimSceneLayer.ts` `buildContext()` ~γρ.130–134: όταν OFF πέρασε **άδειο** `systemColorIndex` map στο `SyncContext` (`bim-3d/scene/bim-scene-context.ts` γρ.17) → `fixtureToMesh` πέφτει σε default material (το πιο καθαρό gate· καμία αλλαγή στους converters).

### UI toggle
NEW `ui/ribbon/components/ColorBySystemToggle.tsx` — **1:1 mirror** του `ui/ribbon/components/MepWireToggle.tsx` (reads/writes `colorBySystem` αντί `objectStyles['mep-wire']`).
- Register: `ui/ribbon/data/view-tab-bim-settings.ts` → νέο button στο `BIM_GRAPHICS_PANEL` row (δίπλα στα `MEP_WIRE_BUTTON`/`HIDE_BIM_BUTTON`/`DISCIPLINE_BUTTON`), `widgetId: 'color-by-system-toggle'`.
- Dispatch: `ui/ribbon/components/RibbonPanel.tsx` ~γρ.100 → `if (button.widgetId === 'color-by-system-toggle') return <ColorBySystemToggle … />`.

### i18n (N.11 — keys ΠΡΩΤΑ σε ΚΑΙ τα δύο locales)
`src/i18n/locales/{el,en}/dxf-viewer-shell.json` → `ribbon.commands.colorBySystem.{label,enable,disable,tooltipEnable,tooltipDisable}` (mirror shape του `ribbon.commands.mepWire.*`). el: «Χρώμα ανά Σύστημα» κ.λπ.

### Reuse / templates
- Toggle template: `MepWireToggle.tsx` (store: `useBimRenderSettingsStore`).
- Χρώμα utilities: `bim/mep-systems/mep-system-color.ts` (`systemColor`, `buildEntitySystemColorIndex`, `getEntitySystemColorIndexCached`, `buildEntitySystemColorIntIndex`).

### Tests
- store flag default `true` + toggle.
- gate behaviour: 2D fixture color resolution & 3D `buildContext` → χρώμα όταν ON, default/empty map όταν OFF.
- settings type/persistence αν προστεθεί στο `ResolvedBimSettings`.

### Verify (browser)
Κύκλωμα με χρωματισμένα μέλη → View tab → «Χρώμα ανά Σύστημα» **OFF** → φωτιστικά/καλώδια default χρώμα· **ON** → ξαναχρωματίζονται· 2D+3D parity· persist μετά reload.

### N.15 (ίδιο commit με κώδικα)
ADR-408 changelog + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (Φ7 roadmap: colour-by-system toggle ✅) + memory topic file `project_adr408_mep_connectors_systems.md`.

---

## 3. ΥΠΟΛΟΙΠΟ Φ7 roadmap (μετά από αυτό)
- per-circuit edit από φωτιστικό (system-browser panel)
- seed legacy connectors (back-fill σε παλιά φωτιστικά χωρίς connector)

## 4. Πλήρες πλάνο
Αναλυτικό plan: `C:\Users\user\.claude\plans\groovy-soaring-flute.md`. Πηγή αλήθειας = ο κώδικας· τα ~γραμμή-νούμερα είναι ενδεικτικά (επιβεβαίωσε με grep).
