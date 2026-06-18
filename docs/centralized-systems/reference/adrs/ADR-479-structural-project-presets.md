# ADR-479 — Structural Project Presets (Revit-grade templates) + reference cross-check

**Status:** 🟢 Slices 1-2-2b-2c DONE 2026-06-18 (Opus), UNCOMMITTED & jest-verified (44 tests GREEN: 21 cross-check + 12 store + 6 active-preset + 5 recompute-guard). 🔴 tsc-confirm (Giorgio full) + browser-verify (preset → confirm → settings + persist + **οπλισμός/σχέδια ανανεώνονται**· cancel → revert) + commit. DEFER: Slice 3 (persisted user/company presets — mirror `StairPresetsService`).
**Discipline:** Δομοστατικά / Structural Engineering
**Scope:** Μετατροπή των canonical structural defaults — μαζί με τις τιμές πραγματικής εγκεκριμένης μελέτης (STATICS 2025, Θέρμη 288/08, Κ1/Κ2/Κ3) — σε **named, applicable Structural Presets** που αρχικοποιούν τα building-level `StructuralSettings` (σαν Revit project template). + **cross-check regression test** που εγγυάται ότι τα engine defaults είναι συνεπή με την πραγματική μελέτη (το reference γίνεται ζωντανό συμβόλαιο). Συμπληρώνει ADR-456 (structural settings SSoT), ADR-474 (occupancy auto loads), ADR-477 (σεισμικές παράμετροι).

---

## 1. Context & Problem

Κωδικοποιήσαμε 3 πραγματικά εγκεκριμένα τεύχη STATICS 2025 σε υβριδικό reference
(`docs/centralized-systems/reference/structural-guides/`: MD οδηγός + JSON
παραμέτρων). Ο Giorgio ζήτησε να γίνει **ενεργό, όπως οι μεγάλοι παίκτες (Revit)**:
full enterprise + full SSoT.

**Τι κάνει η Revit:** δεν κρατά μελέτες ως PDF — τις «σπάει» σε **Project Template
(.rte)** που προ-φορτώνει defaults (υλικά, covers, φορτία, σεισμικά, συνδυασμούς)
σε κάθε νέο έργο. Το τεύχος είναι το **OUTPUT** μιας μελέτης· το template το **INPUT**.
(Η ιδιομορφική/σεισμική ανάλυση = Robot Structural Analysis — εκτός scope, βλ. §5.)

**Εύρημα έρευνας (100% ειλικρίνεια):** το `StructuralSettings` (ADR-456) **ήδη** έχει
όλα τα απαραίτητα πεδία (`codeId, defaultConcreteGrade, occupancy, seismicGroundType,
seismicGroundAccelRatio, soilBearingCapacityKpa, ...`) + SSoT normalizer
`resolveStructuralSettings`. Δεν υπήρχε όμως **κανένα** named preset/template — μόνο
το γυμνό `DEFAULT_STRUCTURAL_SETTINGS`. Επίσης οι τιμές της μελέτης κουμπώνουν 1:1 με
τα engine defaults (C25/30, B500C, residential q=2.0, ground B, a_gR 0.16, ULS
1.35/1.50) — επομένως ένα preset = **σύνθεση** υπαρχόντων SSoT, ΟΧΙ re-hardcode.

---

## 2. Decision

Νέο `bim/structural/presets/` module + store apply action + cross-check test.
**Αρχή SSoT:** το engine ορίζει τις τιμές (providers/constants)· το preset τις
**συνθέτει**· το test γεφυρώνει engine ↔ πραγματική μελέτη.

### Slice 1 — preset SSoT + apply + cross-check (✅ DONE)

| Αλλαγή | Αρχείο | Τι κάνει |
|---|---|---|
| **NEW** `THERMI_288_08: StaticReportReference` (frozen) | `bim/structural/presets/reference-static-report.ts` | machine SSoT της πραγματικής μελέτης — υλικά/φορτία/σεισμικά/έδαφος/επικαλύψεις/ιδιοπεριόδους Κ1-Κ3 |
| **NEW** `StructuralPresetKind`, `StructuralPresetDefinition` (+ DEFER scope/doc types) | `bim/structural/presets/structural-preset-types.ts` | τύποι preset· persisted scope types δηλωμένα έτοιμα για Slice 3 |
| **NEW** `buildStructuralSettingsForPreset(kind)`, `STRUCTURAL_PRESET_DEFINITIONS`, `STRUCTURAL_PRESET_ORDER`, `isStructuralPresetKind` | `bim/structural/presets/structural-preset-defaults.ts` | pure factory (mirror `buildDefaultVariantFor`)· συνθέτει `greekRcSettings(codeId)` από `THERMI_288_08` + `DEFAULT_STRUCTURAL_SETTINGS` |
| **NEW** barrel | `bim/structural/presets/index.ts` | exports |
| **NEW** cross-check + docs-sync + preset test (22) | `bim/structural/presets/__tests__/reference-static-report.test.ts` | equality (engine==μελέτη), `engineMin ≤ study` covers (2 providers via public limits API), preset correctness, docs JSON ↔ code sync guard, `it.todo` ψ1/ψ2 gap |
| `setSeismicGroundType/AccelRatio` (missing setters) + **`applyStructuralPreset(kind)`** | `state/structural-settings-store.ts` | apply preset = resolve→set all fields→debounced persist (reuse υπάρχον path· omit-when-absent invariant) |
| store test +6 | `state/__tests__/structural-settings-store.test.ts` | σεισμικοί setters + apply preset (state + persist) |
| docs SSoT note | `structural-guides/{README.md, static-report-reference-parameters.json}` | «machine SSoT = `reference-static-report.ts`· JSON = human mirror, guarded από test» |

**Built-in presets:** `greek-rc-ec8` (eurocode + τιμές Θέρμη), `greek-rc-legacy`
(ΕΚΩΣ-ΕΑΚ, ίδιες φυσικές τιμές, μόνο `codeId` αλλάζει), `blank` (= defaults).

### Slice 2 — UI preset selector (✅ DONE)

| Αλλαγή | Αρχείο | Τι κάνει |
|---|---|---|
| **NEW** `resolveActivePresetKind(settings)` (pure) | `bim/structural/presets/resolve-active-preset.ts` | ποιο preset ταυτίζεται με τα τρέχοντα settings (resolve+full-field equality)· `null` = «Προσαρμοσμένο» (Revit απόκλιση από template) |
| barrel export | `bim/structural/presets/index.ts` | + `resolveActivePresetKind` |
| **NEW** `StructuralPresetSelector` | `ui/components/StructuralPresetSelector.tsx` | canonical `@/components/ui/select` (ADR-001· ΟΧΙ RibbonCombobox—ribbon-context-bound)· value=active kind, onChange→`applyStructuralPreset` (recompute = κεντρικός, βλ. Slice 2b) |
| **NEW** `useStructuralSettingsRecompute` (+`shouldRecomputeOnSettingsChange` pure) | `hooks/useStructuralSettingsRecompute.ts` | **Slice 2b** — κεντρικός store subscriber· κάθε user-initiated settings change (preset/ribbon/Slice 3) → `bim:compute-loads-requested`· mounted στο `DxfViewerContent` |
| mount + 5 jest | `app/DxfViewerContent.tsx`, `hooks/__tests__/useStructuralSettingsRecompute.test.ts` | δίπλα στους proactive hooks· guard predicate tests |
| mount | `ui/components/FloorManagementDialog.tsx` | selector πάνω από `FloorsTabContent` (building present)· building-wide = σωστή Revit-αντιστοιχία (ADR-468 modal) |
| i18n keys `structural.preset.*` | `i18n/locales/{el,en}/dxf-viewer-shell.json` | selectorLabel/sectionDescription/custom + `confirm.*` + 3 presets label/description (N.11 ΠΡΩΤΑ) |
| **Confirm πριν το full-replace** | `StructuralPresetSelector` (`pendingKind` state) | reuse `BuildingSpaceConfirmDialog` (SSoT confirm, ΟΧΙ νέο dialog)· cancel/ESC → store αμετάβλητο → controlled Select revert φυσικά· variant="warning" |
| **NEW** test (6) | `bim/structural/presets/__tests__/resolve-active-preset.test.ts` | exact-match κάθε preset, blank=defaults, custom=null, EC8≠legacy, omit-invariant |

**Revit-grade:** ο selector δείχνει **κατάσταση** (active preset ή «Προσαρμοσμένο»),
δεν είναι fire-and-forget. Apply = full-replace building settings (ήδη persist) → **confirm
dialog** (reuse `BuildingSpaceConfirmDialog`, SSoT) πριν το destructive replace· cancel/ESC →
store αμετάβλητο → controlled Select revert χωρίς χειροκίνητο reset.

**Άμεσος επανυπολογισμός — Slice 2b (Revit «αλλαγή building setting = μελέτη ενημερώνεται»):**
ο `applyStructuralPreset` + ΟΛΟΙ οι building-level setters (store) μένουν **pure** (μόνο
set+persist, μηδέν event — zero-React import-graph invariant). **ΕΝΑΣ** κεντρικός subscriber
`useStructuralSettingsRecompute` (mounted στο `DxfViewerContent`) ανιχνεύει κάθε
**user-initiated** μεταβολή και εκπέμπει `bim:compute-loads-requested` — **το ίδιο event** με
το ρητό ribbon «Υπολογισμός Φορτίων», μηδέν νέο event type / μηδέν άγγιγμα στο
`drawing-event-map-bim.ts`, μηδέν σκόρπιο emit στα bridges. Αλυσίδα: `compute-loads-requested`
→ `useStructuralLoadTakedown` → `runStructuralLoadTakedown` → `bim:structural-loads-computed` →
proactive reinforce / auto-foundation / tie-force / member-sizing → re-render 2Δ/3Δ οπλισμού +
readouts/BOQ + live detail sheets.

**User-vs-sync guard:** οι setters ορίζουν `lastLocalMutationAt = Date.now()` (>0)· ο
`loadForBuilding` (server echo) → `0`. Το `shouldRecomputeOnSettingsChange(state,prev)` εκπέμπει
μόνο όταν `lastLocalMutationAt > 0 && ≠ prev` → ΟΧΙ recompute σε κάθε φόρτωση/sync. Coalesced
ανά microtask (batched set → ΕΝΑ recompute). **Loop-safe:** η αλυσίδα γράφει σε entities, ΟΧΙ
settings → ο subscriber δεν re-fire-άρει. Καλύπτει preset + ribbon setters + Slice 3 από ΕΝΑ
σημείο (SSoT). ADR-040 safe: store.subscribe + useEffect (μηδέν re-render orchestrator).

### Slice 3 — persisted user/company presets (DEFER)
Mirror `StairPresetsService` (scope user/company/project, Firestore
`companies/{id}/structural_presets/{id}`, enterprise IDs). Types δηλωμένα έτοιμα.

---

## 3. SSoT map (μηδέν διπλότυπο)

| Τιμή | SSoT (single owner) | Consumers |
|---|---|---|
| Concrete grade | `DEFAULT_CONCRETE_GRADE` (concrete-grades) | preset, μελέτη reference, test |
| Occupancy q_k | `OCCUPANCY_IMPOSED_KPA` (occupancy-loads) | preset (via THERMI), test |
| Σεισμικά defaults | `DEFAULT_SEISMIC_*` (seismic-params) | preset, store setters, test |
| ULS factors | `EN1990_ULS_FACTORS` (load-combinations) | providers, test |
| Covers (code-min) | provider `*ReinforcementLimits().nominalCoverMm` | test (≤ study) |
| Settings normalize | `resolveStructuralSettings` (structural-settings) | store apply, loadForBuilding |
| Τιμές μελέτης | `THERMI_288_08` (reference-static-report) | preset factory, test, docs JSON mirror |

**Insight (Revit-grade):** οι επικαλύψεις της μελέτης (col/beam 35, slab 30, found 60)
είναι **≥** τα code minima των providers (30/30/25/50) — σχέση `engineMin ≤ study`.
Σωστό: η μελέτη επιλέγει cover ≥ ελάχιστο. Το test το επιβάλλει (όχι equality).

## 4. Documented gap
ψ1/ψ2 (frequent/quasi-permanent, ψ1=0.5, ψ2=0.3 στη μελέτη) ΔΕΝ υπάρχουν στο engine
(μόνο θεμελιώδης συνδυασμός 6.10). `it.todo` στο test. Robot-equivalent gap.

## 5. Verification
- `npx jest reference-static-report structural-settings-store` → 33 GREEN (21+12).
- tsc: targeted clean (jest ts compile passed)· full = Giorgio (N.17).
- Browser (Slice 2 only): preset «Ελληνικό RC (EC8)» → panel C25/30/eurocode/ground B/soil 150· persist+reload κρατά.

---

## Changelog
- **2026-06-18 (Opus):** Slice 2c — confirm dialog πριν το destructive full-replace. Reuse
  `BuildingSpaceConfirmDialog` (SSoT confirm, μηδέν νέο dialog)· `pendingKind` state στο selector·
  cancel/ESC → store αμετάβλητο → controlled Select revert φυσικά· i18n `structural.preset.confirm.*`
  (EL+EN). UNCOMMITTED.
- **2026-06-18 (Opus):** Slice 2 — UI preset selector. `resolveActivePresetKind` (pure,
  active-state detection) + `StructuralPresetSelector` (canonical `ui/select`, ADR-001) mounted
  στο `FloorManagementDialog` (building-wide, ADR-468)· i18n `structural.preset.*` (EL+EN, N.11)·
  +6 jest. onChange→`applyStructuralPreset` (Slice 1 path). UNCOMMITTED.
- **2026-06-18 (Opus):** Slice 2b — συμμετρία recompute. NEW `useStructuralSettingsRecompute`
  (κεντρικός store subscriber· `shouldRecomputeOnSettingsChange` pure guard via `lastLocalMutationAt`)
  mounted στο `DxfViewerContent` → ΚΑΘΕ user-initiated building-level settings change (preset ΚΑΙ
  ribbon setters codeId/occupancy/soil/seismic) εκπέμπει `bim:compute-loads-requested` (reuse ρητού
  ribbon event· μηδέν νέο event type, μηδέν άγγιγμα bridges). Ο selector ΔΕΝ εκπέμπει πια (ΕΝΑ
  σημείο, SSoT). +5 jest. UNCOMMITTED.
- **2026-06-18 (Opus):** Slice 1 — preset SSoT (`reference-static-report.ts`,
  `structural-preset-{types,defaults}.ts`, index), `applyStructuralPreset` +
  σεισμικοί setters στο store, cross-check regression test (22) + store test (+6),
  docs SSoT note. 33 jest GREEN. UNCOMMITTED. ADR-478 ήταν πιασμένο (Wall Line-Loads)
  → renumbered ADR-479.
