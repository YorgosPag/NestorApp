# HANDOFF — Οπλισμός Πεδίλων / Μεμονωμένων Πεδίλων / Πεδιλοδοκών (mirror του Column Reinforcement)

**Ημερομηνία:** 2026-06-16
**Συντάκτης:** Opus 4.8 (συνεδρία ruler/level-order/foundation-warning)
**Στόχος νέας συνεδρίας:** **Deep-dive** σε ΟΛΟ το σύστημα οπλισμού **κολώνας** (τύποι/ρυθμίσεις/ribbon/Properties-panel/2D+3D render/PDF detail-sheet/auto-reinforce) → **NEW ADR** → **υλοποίηση ΙΔΙΑΣ εμπειρίας** για **πέδιλα, μεμονωμένα πέδιλα, πεδιλοδοκούς**. **FULL ENTERPRISE + FULL SSoT, Revit-grade.**

---

## ⚠️ ΚΑΝΟΝΕΣ (ΑΠΑΡΑΒΑΤΟΙ)
- 🌐 **ΓΛΩΣΣΑ:** Απαντάς ΠΑΝΤΑ **Ελληνικά** (ο Giorgio γράφει Ελληνικά).
- 🚫 **COMMIT/PUSH:** Τα κάνει **ο Giorgio**, ΠΟΤΕ εσύ (N.(-1)). ΠΟΤΕ `git add -A` — μόνο τα δικά σου αρχεία.
- 🤝 **SHARED WORKING TREE:** Δουλεύει **κι άλλος agent**. **ΜΗΝ αγγίξεις** χωρίς λόγο: `ADR-040*`, `LayerCanvas.tsx`, `systems/cursor/snap-scheduler.ts`. Στα ADR-459/460/461 αρχεία (structural organism/multishape/special-levels) **συντονισμός** — άγγιξε ΜΟΝΟ ό,τι είναι δικό σου, git add επιλεκτικά.
- 🧠 **MODEL (N.14):** δήλωσε μοντέλο (αυτό = **Opus**, cross-cutting 2+ domains) & περίμενε «ok».
- 🛠️ **TSC (N.17):** ΕΝΑ tsc τη φορά — έλεγξε ότι δεν τρέχει άλλος (`Get-CimInstance Win32_Process … node.exe … tsc`).
- 🔁 **FULL SSoT (Giorgio αυστηρός — το τόνισε):** **ΠΡΙΝ** γράψεις ΟΠΟΙΟΝΔΗΠΟΤΕ νέο compute/type/renderer/descriptor → **grep** για υπάρχον. ΜΗΝ δημιουργήσεις διπλότυπο. Αν υπάρχει SSoT → επέκτεινέ το. (Πολλά υπάρχουν ήδη — βλ. §3.)
- 📐 **ADR-driven (N.0.1):** PHASE 1 recognition (διάβασε ΚΩΔΙΚΑ=source of truth) → PHASE 2 NEW ADR → PHASE 3 υλοποίηση → PHASE 4 commit (Giorgio). **Πρώτα ADR, μετά κώδικας** (ρητή εντολή Giorgio).

---

## 🎯 Η ΑΠΟΣΤΟΛΗ (2 βήματα)

### Βήμα 1 — DEEP DIVE στον οπλισμό **ΚΟΛΩΝΑΣ** (διάβασε τα ΠΑΝΤΑ)
Χαρτογράφησε πλήρως πώς δουλεύει ο οπλισμός κολώνας end-to-end:
1. **Τύποι οπλισμού & ρυθμίσεις** — διαμήκεις ράβδοι, συνδετήρες (hoops/stirrups), cross-ties, confinement, multi-hoop, ανά διατομή (ορθογ./κυκλική/τοιχωματική/Γ-Τ-Π-Ι).
2. **Πώς ανοίγει το Ribbon ψηλά** όταν επιλέγεις ΜΙΑ κολώνα (contextual tab) — combos/εργαλεία/«Αυτόματος Οπλισμός».
3. **Πώς ανοίγει αριστερά στο Floating Panel** η καρτέλα **«Ιδιότητες»** με τις ιδιότητες οπλισμού (BimPropertiesShell → router → column tab → descriptor fields).
4. **2D render** οπλισμού (DxfRenderer) + **3D render** (column-rebar-3d / converters).
5. **PDF detail-sheet** οπλισμού επιλεγμένης κολώνας (preview === PDF· plan/elevation/perspective/schedule/titleblock).
6. **Auto-reinforce** command + organism continuity/checks (EC2/ΕΚΩΣ providers).

### Βήμα 2 — ΕΦΑΡΜΟΣΕ ΤΟΝ ΙΔΙΟ ΑΚΡΙΒΩΣ ΤΡΟΠΟ σε:
- **Πέδιλα** (footings) — μεμονωμένα/ανεξάρτητα.
- **Μεμονωμένα πέδιλα** (isolated footings).
- **Πεδιλοδοκούς** (tie-beams / συνδετήριες δοκοί θεμελίωσης).

Ίδια εμπειρία: επιλογή → contextual ribbon tab → αριστερά «Ιδιότητες» με πεδία οπλισμού → 2D+3D render οπλισμού → PDF detail-sheet → auto-reinforce. **Revit-grade.**

---

## 🗺️ ΧΑΡΤΗΣ ΑΡΧΙΤΕΚΤΟΝΙΚΗΣ (από grep αυτής της συνεδρίας — ΞΕΚΙΝΑ ΑΠΟ ΕΔΩ)

> ⚠️ Όλα κάτω από `src/subapps/dxf-viewer/`.

### A) Structural compute/types SSoT — `bim/structural/`
- **Catalogs/codes (REUSE, ΜΗΝ ξαναγράψεις):** `rebar-catalog.ts` (B500C), `concrete-grades.ts`, `codes/` (`eurocode-provider.ts`, `greek-legacy-provider.ts`, `suggest-reinforcement.ts`, `structural-code-types.ts`), `structural-settings.ts`, `section-context.ts`, `active-reinforcement.ts`.
- **Reinforcement compute/types — `bim/structural/reinforcement/`:**
  - **ΚΟΛΩΝΑ (reference):** `column-reinforcement-compute.ts` + `-types.ts`, `column-rebar-layout.ts`(+`-resolve`), `column-perimeter-layout.ts`, `column-circular-layout.ts`, `column-multihoop-layout.ts`, `column-rect-decomposition.ts`, `column-confinement.ts`, `column-cross-ties.ts`, `column-bar-distribution.ts`, `column-section-outline.ts`, `column-wall-reinforcement.ts`, `rebar-visibility.ts`.
  - **🟢 ΗΔΗ ΥΠΑΡΧΟΥΝ για στόχους (compute layer — ΕΠΕΚΤΕΙΝΕ, ΜΗΝ διπλασιάσεις):** `footing-reinforcement-compute.ts` + `-types.ts`, `beam-reinforcement-compute.ts` + `-types.ts`, `slab-foundation-reinforcement-compute.ts` + `-types.ts`.
  - 🔑 **Άρα το κενό είναι κυρίως το UX/integration chain** (ribbon/panel/render/PDF), ΟΧΙ το compute. Επιβεβαίωσέ το διαβάζοντας τα παραπάνω.
- **Organism (ADR-459):** `bim/structural/organism/reinforcement-checks.ts`, continuity. ⚠️ shared-tree — συντονισμός.

### B) PDF detail-sheet — `bim/structural/detail-sheet/`
- `column-detail-sheet.ts` (model SSoT) → `render/detail-canvas-renderer.ts` (preview) + `render/detail-pdf-renderer.ts` (jsPDF) ώστε **preview===PDF** (ADR-457).
- Όψεις: `column-detail-plan.ts` / `-elevation.ts` / `-perspective.ts` / `-schedule.ts` / `-titleblock.ts` / `column-rebar-bar-marks.ts` + `detail-sheet-dim/-fit/-layout/-types`.
- 3D capture: `render/column-detail-3d-capture.ts` (offscreen WebGL, ⚠️ dispose gotchas — βλ. ADR-457).
- 🎯 Στόχος: γενίκευσε το `DetailSheetModel` framework για footing/tie-beam (πιθανόν NEW `footing-detail-*` που REUSE το ίδιο layout/fit/dim/render SSoT).

### C) Left «Ιδιότητες» panel — `ui/`
- **Shell SSoT (ADR-366):** `ui/bim-properties/BimPropertiesShell.tsx` (ΕΝΑ palette, sub-tabs Παράμετροι|ΒΚΕ|Σχόλια|Ιστορικό) → `ui/wall-advanced-panel/BimPropertiesRouter.tsx` (route ανά BIM type).
- **Κολώνα (reference):** `ui/column-advanced-panel/` → `ColumnPropertiesTab.tsx`, `ColumnAdvancedPanel.tsx`, **`column-property-fields.ts`** (descriptor SSoT — εδώ ζουν τα πεδία οπλισμού), `ColumnPropertyRow.tsx`.
- 🎯 Στόχος: NEW `footing-advanced-panel/` (ή επέκταση router) με descriptor πεδίων οπλισμού πεδίλου — **mirror του column-property-fields pattern**.

### D) Ribbon contextual tab — `ui/ribbon/`
- **Κολώνα (reference):** `ui/ribbon/data/contextual-column-tab.ts`, `ui/ribbon/hooks/useRibbonColumnBridge.ts`, `hooks/bridge/column-structural-bridge.ts`, `column-bridge-combobox-resolvers.ts`, `column-command-keys.ts`.
- Contextual routing: `app/ribbon-contextual-config.ts` (ποια tab ανοίγει ανά selection).
- 🎯 Στόχος: contextual tab πεδίλου/πεδιλοδοκού + bridge (combos οπλισμού + «Αυτόματος Οπλισμός»).

### E) Auto-reinforce + commands
- `core/commands/entity-commands/AutoReinforceOrganismCommand.ts`, `hooks/useStructuralAutoReinforce.ts`, `hooks/useStructuralFootingConnect.ts`, `hooks/notifications/structural-attach-notifications.ts`.

### F) Render
- **2D:** `canvas-v2/dxf-canvas/DxfRenderer.ts` (entity render dispatch· βλ. πώς ζωγραφίζεται ο column rebar).
- **3D:** `bim-3d/converters/bim-three-structural-converters.ts` + `column-rebar-3d` (RebarMesh/resolveMatMesh). ⚠️ canonical-mm scaling (ADR-462 Phase 3 — sceneToM)· REUSE `scalePoints` SSoT (`rendering/entities/shared/geometry-vector-utils.ts`).

### G) 2D pipeline ανά BIM entity (ADR-436 — αν χρειαστεί νέο rebar entity type)
Νέο 2Δ BIM entity → 6 render cases (dxf-types/convertEntity/renderer-model/hit-test/culling/entity-bounds) + EntityType union + 3 spatial-index σημεία. Αλλά ο οπλισμός είναι μάλλον **derived geometry του host entity**, ΟΧΙ ξεχωριστό entity — επιβεβαίωσε πώς το κάνει η κολώνα (rebar = derived από ColumnParams.reinforcement, ΟΧΙ entity).

---

## 📋 PHASE 1 — RECOGNITION CHECKLIST (πριν γράψεις ADR)
1. Διάβασε `column-reinforcement-compute.ts` + `-types.ts` + `column-rebar-layout-resolve.ts` → κατάλαβε το reinforcement model της κολώνας.
2. Διάβασε `footing-reinforcement-compute.ts` + `-types.ts` + `beam-reinforcement-*` → **τι ΗΔΗ υπάρχει** (avoid duplicates).
3. Διάβασε `ColumnPropertiesTab.tsx` + `column-property-fields.ts` → πώς εμφανίζονται τα πεδία οπλισμού αριστερά.
4. Διάβασε `contextual-column-tab.ts` + `useRibbonColumnBridge.ts` → πώς ανοίγει το ribbon.
5. Διάβασε `column-detail-sheet.ts` + `detail-pdf-renderer.ts` → πώς βγαίνει το PDF.
6. Δες πώς γίνεται persist ο οπλισμός (ColumnParams.reinforcement; FoundationParams.reinforcement; BeamParams;) + Firestore (MCP διαθέσιμο — βλ. §Baseline).
7. **ADR index:** `docs/centralized-systems/reference/adrs/adr-index.md`. Σχετικά ADR: **460** (multi-shape column reinforcement), **459** (structural organism), **457** (column detail sheet), **456** (structural quantities), **366** (BimPropertiesShell), **363** (column panel split), **449** (finish skin pattern για adjacency). Επόμενο ελεύθερο ADR νούμερο: έλεγξε index (ήταν ~370 το 2026-05-20· τώρα μάλλον πιο ψηλά — **πάρε το επόμενο μετά το μέγιστο**).

## 📐 PHASE 2 — NEW ADR
Γράψε `docs/centralized-systems/reference/adrs/ADR-XXX-foundation-reinforcement-ux.md` (ή ανάλογο). Τεκμηρίωσε: reuse map (τι SSoT χρησιμοποιείς), τι NEW, mirror-pattern κολώνας, slices. **Πρώτα ADR → έγκριση Giorgio → υλοποίηση.**

## 🛠️ PHASE 3 — Υλοποίηση (slices, mirror column)
Πιθανές slices: (1) footing reinforcement model wiring → params/persist· (2) left Properties panel πεδία· (3) ribbon contextual tab + auto-reinforce· (4) 2D+3D rebar render· (5) PDF detail-sheet· (6) tie-beam· (7) μεμονωμένο vs άλλα. **Κάθε slice: grep-first, SSoT-reuse, jest, tsc (ένα τη φορά), git add ΜΟΝΟ δικά σου.**

---

## 🗃️ BASELINE ΔΕΔΟΜΕΝΩΝ (Firestore MCP διαθέσιμο)
- company `comp_9c7c1a50-…` · project `proj_0df5af7a-…` · building `bldg_b4d3cecb-…` (Κτήριο Α1) · user `WKBWEg3DSfcdSbLNJfzGEW3vkct1`.
- Collections: levels=`dxf_viewer_levels` (field `companyId`, ΟΧΙ `projectId` σε όλα), floors=`floors` (έχουν `kind`+`number`+`elevation`).
- Floors: Θεμελίωση(foundation,-1), Ισόγειο(ground,0), 1ος(standard,1), 2ος(standard,2), Απόληξη(stair-penthouse,3). **Δεν υπάρχει δηλωμένο πέδιλο/πεδιλοδοκός ακόμη** — μπορεί να χρειαστεί να δημιουργήσεις από το UI για verify.
- Reproduce: επίλεξε κολώνα → δες ribbon+Properties+PDF· μετά κάνε το ίδιο για πέδιλο.

---

## 🔧 ΚΑΤΑΣΤΑΣΗ WORKING TREE (UNCOMMITTED από ΤΗΝ ΠΡΟΗΓΟΥΜΕΝΗ συνεδρία — ο Giorgio θα κάνει commit)
Δικά μου αρχεία αυτής της συνεδρίας (ΜΗΝ τα μπερδέψεις με δικά σου· ο Giorgio commit-άρει):
- **Ruler unification (3→1):** `rendering/ui/ruler/RulerRenderer.ts`, `canvas-v2/layer-canvas/layer-grid-ruler-renderer.ts`, `canvas-v2/layer-canvas/LayerRenderer.ts`, `systems/rulers-grid/useRenderingCalculations.ts`, `systems/rulers-grid/utils.ts`.
- **Entity-count SSoT:** `utils/scene-entity-count.ts`(+test), `hooks/scene/useSceneManager.ts`, `ui/components/LevelPanel.tsx`, `ai-assistant/hooks/useDxfAiChat.ts`, `components/dxf-layout/FullscreenView.tsx`, `core/commands/ClipToRegionCommand.ts`.
- **Level panel ordering:** `systems/levels/level-display-order.ts`(+test), `LevelPanel.tsx`.
- **Foundation-warning fix:** `systems/levels/storey-creation-defaults.ts`(+test).
- **Docs:** `ADR-462`, `ADR-461`, `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`.
- tsc: τα δικά μου clean· σύνολο 12 pre-existing errors (bim-3d converters / proposal-ghost — ΟΧΙ δικά μου, ΟΧΙ δικά σου).

---

## 📝 ΣΗΜΕΙΩΣΗ ΟΡΟΛΟΓΙΑΣ (Giorgio)
- «ανεμομονωμένα» = **μεμονωμένα πέδιλα** (isolated footings).
- «πενυλοδοκούς» = **πεδιλοδοκούς** (tie-beams / συνδετήριες δοκοί θεμελίωσης).
