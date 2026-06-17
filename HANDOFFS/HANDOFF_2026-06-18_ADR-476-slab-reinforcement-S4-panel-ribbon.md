# HANDOFF — ADR-476 Unified Slab Reinforcement → Slice 4 (Properties panel + Ribbon)

**Ημερομηνία:** 2026-06-18 (Opus) · **Επόμενη δουλειά:** Slice 4 (UI) · **Status εισόδου:** Slices 0-3 DONE UNCOMMITTED, tsc-clean (για τα δικά μας αρχεία)

> ⚠️ **COMMIT/PUSH = ΜΟΝΟ ο Giorgio** (N.(-1)). Το **working tree μοιράζεται με άλλον agent** → `git add` ΜΟΝΟ τα δικά σου αρχεία, ΠΟΤΕ `git add -A`.
> 🎯 Εντολή Giorgio: **«όπως η Revit — full enterprise + full SSOT, μηδέν διπλότυπα.»**

---

## 1. Τι έγινε ήδη (ADR-476 Slices 0-3) — μην το ξανακάνεις

Ενοποιημένος οπλισμός **ΟΛΩΝ** των ειδών πλάκας (εδαφόπλακα/raft + αναρτημένη δάπεδο/οροφή). Πλήρες ADR: `docs/centralized-systems/reference/adrs/ADR-476-unified-slab-reinforcement.md`.

**Αρχή SSoT:** το `SlabFoundationReinforcement` (4 σχάρες `bottomMeshX/Y`+`topMeshX/Y` + `coverMm` + `auto?`) είναι **ήδη γενικό μοντέλο** → γενικεύθηκε **επιτόπου** (additive, ΟΧΙ rename· το όνομα μένει ιστορικά — 22 callers). **kind-aware ΜΟΝΟ ο suggester.**

Backend έτοιμο & type-clean:
- **Data/suggester** (`bim/structural/`): kind-aware context `SlabFoundationSectionContext` (+`kind`/`maxFreeSpanMm`/`designLoadKpa`/`concreteGrade`, optional)· `auto?` flag· kind-aware όρια στους 2 providers· suggester (αναρτημένη: κάτω σχάρα=`max(ρ_min,As(q·L²/8))`, άνω=min· εδαφόπλακα αμετάβλητη).
- **Auto re-study** (`section-context.ts`): `resolveActiveSlabReinforcement` + overload στο `resolveActiveMemberReinforcement` + `slabReinforcementMateriallyDiffers` + γενικευμένο `buildReinforcePatch` slab branch (όλα τα kinds, auto-aware). `resolveActiveSlabReinforcementForEntity` (store-coupled) στο `active-reinforcement.ts`. `bim:slab-params-updated` ήδη στα proactive event lists → **η σχάρα ξαναϋπολογίζεται σε κάθε αλλαγή διάστασης**.
- **2Δ** (`bim/renderers/slab-rebar-2d.ts` + `canvas-v2/dxf-canvas/dxf-slab-reinforcement-overlay.ts` + wiring `DxfRenderer.render()` βήμα 7): δι-διευθυντικές σχάρες polygon-clipped, κάτω συμπαγείς/άνω διακεκομμένες.
- **3Δ** (`bim-3d/converters/slab-rebar-3d.ts` `buildSlabRebarCage` + `attachSlabRebar` στο `slabToMesh`): οριζόντιες σχάρες κάτω+άνω.

**Το feature ΔΟΥΛΕΥΕΙ ήδη end-to-end** χωρίς το panel: οι πλάκες auto-οπλίζονται σε δημιουργία/resize και ο καθολικός διακόπτης «Οπλισμός» (`showReinforcement`) τις εμφανίζει 2Δ+3Δ. Το S4 = UX surface (επεξεργασία/readouts/ribbon).

**Πλήρης λίστα αρχείων Slices 0-3** (για `git add` του Giorgio): βλ. `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (entry ADR-476).

---

## 2. ⚠️ ΠΡΟΣΟΧΗ πριν ξεκινήσεις S4

- **Τρέξε πρώτα `tsc` (N.17 — ένα instance, έλεγξε ότι δεν τρέχει άλλος).** Στο S0-3 υπήρχαν **4 σφάλματα σε beam αρχεία** (`beam-command-keys.ts` broken import `../../../bim/types/beam-types`, `beam-structural-bridge.ts` `concreteGrade` σε BeamParams, `beam-structural-param.ts` `BeamSectionContext` export) — **WIP άλλου agent (ADR-471 beam panel), ΟΧΙ δικά μας.** Αν παραμένουν, **ΜΗΝ τα διορθώσεις** (δεν είναι δικά σου· feedback «don't touch / only X»). Απλώς μην βασιστείς στα beam αρχεία ως «σωστό» analog αν είναι σπασμένα.
- **Προτιμώμενο analog = COLUMN panel** (`ui/column-advanced-panel/*` + `column-structural-bridge.ts` + `column-command-keys.ts`) — σταθερό & committed. Ο beam panel είναι ίδιο pattern αλλά μπορεί να είναι in-flux.
- **SSoT generic descriptors:** χρησιμοποίησε `ui/bim-properties/{bim-property-types.ts (BimPropertyGroup/BimPropertyField/BimPropertyOption), BimPropertyRow.tsx}` (ADR-471 S5 SSoT) — ΟΧΙ νέο row component.

---

## 3. Slice 4 — τι να φτιάξεις (mirror column/beam, full SSoT)

### Μοντέλο πλάκας (διαφέρει από κολόνα/δοκό!)
`SlabFoundationReinforcement` = **4 σχάρες** (ΟΧΙ stirrups, ΟΧΙ longitudinal count):
`bottomMeshX/Y`, `topMeshX/Y` → `RebarMesh { diameterMm, spacingMm }` + `coverMm` + `auto?`.
`concreteGrade` ζει στο `SlabParams.concreteGrade` (το πρόσθεσα στο S0). Code (κανονισμός) = building-level στο `structural-settings-store` (όπως κολόνα/δοκό).

### Πεδία panel (group «Στατικά»)
- `code` (κανονισμός — building-level store), `concreteGrade` (→ `SlabParams.concreteGrade`)
- `bottomMeshDiameter` + `bottomMeshSpacing` (→ `structuralReinforcement.bottomMeshX/Y`· τα X/Y ίδια στο default UI — ένα ζεύγος combos· DEFER ξεχωριστά X/Y)
- `topMeshDiameter` + `topMeshSpacing` (→ `topMeshX/Y`)
- `cover` (→ `coverMm`)
- **Read-only readouts:** κάτω σχάρα label «Ø12/200», άνω σχάρα label, συνολικό βάρος χάλυβα (kg), ρ% — μέσω `computeSlabFoundationReinforcementQuantities(buildSlabFoundationSectionContext(slab), r)` + `formatSlabFoundationMainLabel`.
- Group «Φορτίο Σχεδιασμού» (read-only): G/Q/q_Ed από `slab.params.appliedLoad` (mirror beam loads group· «—» όταν απών).

### Αρχεία να δημιουργήσεις/αλλάξεις
| Αρχείο | Ενέργεια | Mirror |
|---|---|---|
| `ui/ribbon/hooks/bridge/slab-structural-command-keys.ts` (ή πρόσθεσε σε υπάρχον `slab-command-keys.ts`) | NEW keys: `SLAB_STRUCTURAL_KEYS` (code/concreteGrade/bottomMeshDiameter/bottomMeshSpacing/topMeshDiameter/topMeshSpacing/cover) + `SLAB_STRUCTURAL_READOUT_KEYS` + `SLAB_STRUCTURAL_VISIBILITY_KEYS.structural` + `resolveSlabPanelVisibility` + `isSlabStructuralReadoutKey` | `beam-command-keys.ts` |
| `ui/ribbon/hooks/bridge/slab-structural-bridge.ts` | NEW: `resolveSlabStructuralState` / `resolveSlabStructuralReadoutState` / `applySlabStructuralChange` (γράφει με `auto:false`) / `autoReinforceSlab` (suggest + `auto:true`) | `column-structural-bridge.ts` / `beam-structural-bridge.ts` |
| `ui/ribbon/hooks/bridge/useSlabParamsDispatcher.ts` | NEW: `DispatchSlabParams` — wrap undoable slab-params command + emit `bim:slab-params-updated`. **ΠΡΩΤΑ grep** για υπάρχον slab params command (βλ. `useRibbonSlabBridge.ts` που ήδη emit-άρει `bim:slab-params-updated` — reuse το ίδιο command, ΜΗΝ φτιάξεις δεύτερο) | `useColumnParamsDispatcher.ts` |
| `ui/slab-advanced-panel/slab-property-fields.ts` | NEW: `SLAB_PROPERTY_GROUPS: readonly BimPropertyGroup[]` (generic descriptor) | `beam-property-fields.ts` |
| `ui/slab-advanced-panel/SlabAdvancedPanel.tsx` | NEW (reuse `BimPropertyRow` + `EntityWarningsSection`) | `BeamAdvancedPanel.tsx` |
| `ui/slab-advanced-panel/SlabPropertiesTab.tsx` | NEW (reuse `useSlabParamsDispatcher`, subscribe `structuralSettingsStore`) | `BeamPropertiesTab.tsx` |
| `ui/wall-advanced-panel/BimPropertiesRouter.tsx` | EDIT: πρόσθεσε `isSlabEntity` branch → `<SlabPropertiesTab/>` | υπάρχοντα branches |
| `ui/ribbon/data/contextual-slab-tab.ts` | EDIT: panel `slab-reinforcement-actions` (widget `show-reinforcement-toggle` + κουμπί «Auto Οπλισμός» → `autoReinforceSlab` / event) gated σε RC kind· (DEFER `slab-detail` button → S5 PDF) | `contextual-column-tab.ts` panels `column-reinforcement-actions` |
| `src/i18n/locales/el/*.json` + `en/*.json` | **ΠΡΩΤΑ** πρόσθεσε ΟΛΑ τα νέα keys (N.11): `slabAdvancedPanel.sections.{structural,loads}.title` + `slabAdvancedPanel.{title,emptyState}` + `ribbon.commands.slabStructural.*` (+ tooltips) + `ribbon.panels.slabStructural` + `slab.actions.autoReinforce` | column/beam keys |

### Επιλογές combos (reuse, ΟΧΙ νέες)
`STRUCTURAL_CODE_OPTIONS`, `CONCRETE_GRADE_OPTIONS`, `COVER_OPTIONS` από `beam-structural-param.ts` / `structural-param.ts`. Για mesh: reuse `LONGITUDINAL_DIAMETER_OPTIONS` (διάμετροι) + `STIRRUP_SPACING_OPTIONS` (βήμα) ή φτιάξε `MESH_SPACING_OPTIONS` αν χρειάζεται μεγαλύτερο εύρος (100-300). **Grep πρώτα** για υπάρχον spacing options πριν φτιάξεις νέο.

---

## 4. Verification (browser, http://localhost:3000/dxf/viewer)
1. Επίλεξε πλάκα → δεξί panel «Ιδιότητες» → group «Στατικά» με code/grade/κάτω+άνω σχάρα/cover + read-only βάρος/ρ%.
2. Επεξεργασία πεδίου (π.χ. βήμα κάτω σχάρας) → `auto:false` + 2Δ/3Δ ενημερώνεται.
3. Ribbon «Auto Οπλισμός» → `auto:true` + re-derive.
4. Άλλαξε πάχος/outline → η σχάρα ξαναϋπολογίζεται (S1 ήδη)· edited field μένει (manual).
5. tsc (ένα instance, N.17) clean (πλην beam WIP που δεν είναι δικό σου).

---

## 5. Μετά το S4
- **S5 PENDING:** PDF detail sheet πλάκας (`bim/structural/detail-sheet/slab-detail-*` → `buildSlabDetailSheet` reuse `DetailSheetModel`/layout/canvas+pdf/`DetailSheetDialog`/`detail-3d-capture-core` + `SlabDetailHost`). + ribbon «Λεπτομέρεια Οπλισμού» button.
- **DEFER:** suspended top-mesh continuity hogging· multilayer-DNA 3Δ rebar· δι-διευθυντικός coefficient method· ξεχωριστά X/Y mesh combos.

## 6. Υποχρεώσεις τέλους (N.0.1 / N.15)
Ενημέρωσε στο ίδιο πακέτο: ADR-476 (changelog: S4 DONE) + adr-index (status) + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (τι μένει) + MEMORY entry. Stage **ADR-040** μόνο αν ξανα-αγγίξεις canvas-critical αρχεία (το S4 είναι UI panel/ribbon → πιθανότατα ΔΕΝ χρειάζεται). **ΜΗΝ commit** — ο Giorgio το κάνει.
