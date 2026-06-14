# ADR-456 — Στατικά: Ποσότητες Σκυροδέματος & Οπλισμός (Structural Quantities & Reinforcement)

**Status:** 🟢 Slice 1 (1A + 1B) + Slice 2 (2a UI οπλισμού + 2b building-level κανονισμός SSoT) IMPLEMENTED 2026-06-14 — UNCOMMITTED (🔴 browser-verify + commit)
**Discipline:** Δομοστατικά / Structural Engineering
**Scope (Slice 1):** Ορθογωνική κολώνα — ποσότητες σκυροδέματος (όγκος/βάρος/κατηγορία) + βασικός οπλισμός (διαμήκης + συνδετήρες, μήκη/τεμάχια/βάρος χάλυβα) κατά επιλέξιμο κανονισμό.

---

## 1. Context & Goal

Ο Giorgio θέλει σταδιακά να προστεθεί πλήρης δομοστατικός σχεδιασμός στο BIM: διαστασιολόγηση οντοτήτων, ποσότητες & βάρος σκυροδέματος, τύπος/μήκη/τεμάχια/βάρος σιδηρού οπλισμού, εμφάνιση οπλισμού μέσα στις δομικές οντότητες, και τελικά πλήρης στατικός υπολογισμός κατά τους **ισχύοντες κανονισμούς**.

Ξεκινάμε από την **απλή ορθογωνική κολώνα** (decision: «και τα δύο μαζί» — ποσότητες **+** βασικός οπλισμός σε ένα πέρασμα).

**Decision (κανονισμός):** Ο engine υποστηρίζει **και τους δύο** κανονισμούς, επιλέξιμα ανά έργο:
- **Eurocode** — EN 1992-1-1 (EC2) + EN 1998-1 (EC8) + Ελληνικά Εθνικά Προσαρτήματα (ισχύων).
- **Greek legacy** — ΕΚΩΣ 2000 + ΕΑΚ 2003 (αποτιμήσεις/ενισχύσεις υφιστάμενων, ΚΑΝ.ΕΠΕ).

---

## 2. Architecture

Νέο SSoT module: `src/subapps/dxf-viewer/bim/structural/`

```
structural/
  concrete-grades.ts              # ConcreteGrade union + props (fck/Ecm) + CONCRETE_DENSITY_KGM3 + concreteWeightKg
  rebar-catalog.ts                # B500C: διάμετροι, barMassPerMeterKg (DERIVED area×ρ), fyd
  codes/
    structural-code-types.ts      # StructuralCodeProvider iface + ColumnReinforcementLimits + ColumnSectionContext
    eurocode-provider.ts          # EC2/EC8 detailing limits
    greek-legacy-provider.ts      # ΕΚΩΣ/ΕΑΚ detailing limits
    suggest-reinforcement.ts      # SHARED αλγόριθμος auto-suggest (boy-scout: 1 θέση)
    index.ts                      # registry + resolveStructuralCode(id) + DEFAULT_STRUCTURAL_CODE
  reinforcement/
    column-reinforcement-types.ts # ColumnReinforcement (longitudinal/stirrups/cover) — zero-dep
    column-reinforcement-compute.ts # μήκη/τεμάχια/βάρος/ρ + format labels (4Ø16, Ø8/100-200)
```

**Design principles:**
- **SSoT μονάδων:** όλα τα μήκη/διάμετροι σε **mm**, βάρη σε **kg**, αντοχές σε **MPa** — ρητά σε κάθε JSDoc.
- **Geometry-is-SSoT:** οι παράγωγες ποσότητες οπλισμού (μήκη/βάρος/ρ) **ΠΟΤΕ** δεν αποθηκεύονται — re-derived on-demand (mirror του `ColumnGeometry.volume`). Αποθηκεύεται μόνο η **πρόθεση** (`ColumnReinforcement`).
- **Code abstraction:** οι κανονισμοί διαφέρουν ΜΟΝΟ στα detailing limits (ρ_min/ρ_max, ελάχ. Ø ράβδου/συνδετήρα, βήμα, επικάλυψη) — ο αλγόριθμος επιλογής οπλισμού είναι κοινός (`suggest-reinforcement.ts`).
- **Zero circular deps:** `column-reinforcement-types.ts` είναι zero-dep ώστε να το εισάγει το `column-types.ts`. Το `compute` παίρνει `ColumnSectionContext` primitives, όχι `ColumnParams`.

### 2.1 Code provider limits (Slice 1)

| Limit | Eurocode (EC2/EC8 DCM) | Greek legacy (ΕΚΩΣ/ΕΑΚ) |
|---|---|---|
| ρ_min | 0.01 (EC8 §5.4.3.2.2) | 0.01 (ΕΚΩΣ §18.3.3) |
| ρ_max | 0.04 (EC2 §9.5.2) | 0.04 (ΕΚΩΣ §18.3.3) |
| min ράβδοι | 4 (ορθογ.) | 4 |
| min Ø ράβδου | 12mm | 14mm (ΕΚΩΣ §18.3.4) |
| min Ø συνδετήρα | max(6, 0.25·dbL) | max(8, dbL/3) |
| max βήμα συνδ. | min(20·dbL, b, 400) | min(15·dbL, b, 300) |
| κρίσιμο βήμα | min(b0/2, 175, 8·dbL) | min(b/2, 100, 8·dbL) |
| επικάλυψη cnom | 30mm | 25mm |

### 2.2 Compute (column-reinforcement-compute.ts)

- **Διαμήκης:** μήκος/ράβδο = ύψος + 50·dbL (μάτισμα/αναμονή) · βάρος = Σμήκη × barMassPerMeterKg.
- **Συνδετήρες:** πλήθος = 2 κρίσιμες ζώνες (lcr = max(bmax, h/6, 450), EC8 §5.4.3.2.2(4)) με `spacingCriticalMm` + μεσαία ζώνη με `spacingMm`. Μήκος/τεμάχιο = περίμετρος εσωτ. ορθογ. (−2·cover) + 2 γάντζοι (10·dbw).
- **ρ** = (count·area(dbL)) / Ac.
- **Σύνολο χάλυβα** = διαμήκης + συνδετήρες (kg).

---

## 3. Integration points

| Αρχείο | Αλλαγή |
|---|---|
| `bim/types/column-types.ts` | +`concreteGrade?: ConcreteGrade`, +`reinforcement?: ColumnReinforcement` στο `ColumnParams` |
| `bim/types/column.schemas.ts` | +`ConcreteGradeSchema`, +`ColumnReinforcementSchema` (Zod) |
| `bim/validators/column-validator.ts` | +`validateReinforcementRatio` (ρ_min/ρ_max code violation, optional `codeId` param, default eurocode) |
| `bim/schedule/schedule-preset-columns.ts` | +5 στήλες: concreteGrade, concreteWeight, longitudinalRebar, stirrups, steelWeight |
| `bim/schedule/schedule-presets.ts` | `mapColumn` +cells (βάρος σκυρ. = `concreteWeightKg(g.volume)`, οπλισμός labels + βάρος χάλυβα) |
| i18n `el/en/dxf-schedule.json` | +5 `col.*` keys |
| i18n `el/en/dxf-viewer-shell.json` | +2 `column.validation.codeViolations.*` keys |

**Σημείωση:** Ο όγκος σκυροδέματος (`ColumnGeometry.volume`, m³) **ήδη** υπολογιζόταν και έρεε σε schedule + BOQ — δεν χρειάστηκε αλλαγή· προστέθηκε μόνο το **βάρος** (× density). Το `CONCRETE_DENSITY_KGM3=2400` (άοπλο — ο χάλυβας μετριέται ξεχωριστά για να μη διπλομετράται) ζει στο `concrete-grades.ts` ως SSoT (όχι διπλό δίπλα στο `STEEL_DENSITY_KGM3`).

---

## 4. Slice 2 — UI οπλισμού + building-level κανονισμός (2026-06-14)

**Slice 2 = το property UI που οδηγεί το Slice 1 SSoT** (ΟΧΙ η 2Δ/3Δ εμφάνιση ράβδων — αυτή renumber→Slice 3).

### 4.1 Slice 2a — Per-element reinforcement panel (ribbon)
Νέο contextual panel `column-structural` (`contextual-column-tab.ts`, μετά το `column-material`, visible μόνο rectangular/shear-wall):
- Comboboxes: κατηγορία σκυροδέματος (per-element) + διαμήκης Ø/πλήθος + συνδετήρες Ø/βήμα/κρίσιμο + επικάλυψη + dropdown **κανονισμού** (building-level, βλ. 2b).
- Κουμπί **«Auto οπλισμός»** → `resolveStructuralCode(activeCode).suggestColumnReinforcement(ctx)`.
- **Live readouts** (read-only combobox pattern, mirror MEP radiator ADR-422): βάρος σκυρ./χάλυβα/ρ%.
- Όταν `reinforcement` απών → οι combos/readouts δείχνουν τον code-suggested ελάχιστο-έγκυρο ως live default· η 1η επεξεργασία τον υλοποιεί (Revit-grade: πάντα έγκυρη ένδειξη).
- SSoT: νέος helper `structural-param.ts` (options/read/patch/readout) + `column-structural-bridge.ts` (routing) — μηδέν inline στατική λογική· όλα από `bim/structural/`.

### 4.2 Slice 2b — StructuralSettings SSoT (building-level, Revit code-driven)
Ο κανονισμός είναι **building-wide** (ένα κτίριο = ένας κανονισμός), ΟΧΙ per-element (anti-SSoT):
- `bim/structural/structural-settings.ts` (`StructuralSettings {codeId, defaultConcreteGrade}` + resolver).
- `state/structural-settings-store.ts` (zustand· `loadForBuilding`/`setCodeId`· quiet-window guard· in-memory default όταν standalone).
- `services/structural-settings.service.ts` → persist στο `buildings/{buildingId}.structuralSettings` (sibling ADR-451 foundation datum, passthrough `updateBuildingWithPolicy`).
- `state/hooks/useStructuralSettingsSync.ts` — 3-tier buildingId (save-context→level→floor meta) + `subscribeDoc('BUILDINGS')`· wired στο `DxfViewerContent`.
- Building contract + `BuildingUpdatePayload` +`structuralSettings?` (inline shape — dependency-direction, mirror `climateZone`).
- Validator threading: `UpdateColumnParamsCommand` περνά τον ενεργό `codeId` στο `validateColumnParams` (κάθε recompute = ίδια όρια).

## 4bis. DEFER (επόμενα slices)

- **Slice 3** — 2Δ/3Δ **εμφάνιση** οπλισμού μέσα στη διατομή (διαμήκεις + συνδετήρες).
- **Slice 4** — Στατικός υπολογισμός (φορτία, αξονική/ροπές, M-N interaction, fcd/fyd capacity checks — `concreteFcdMpa`/`rebarFydMpa` έτοιμα).
- **Slice 5+** — Επέκταση σε δοκούς/πέδιλα/πλάκες/τοιχεία (reuse code providers + concrete grades + StructuralSettings).
- ρ-check για μη-ορθογωνικές διατομές (χρειάζεται `geometry.area` αντί width·depth).
- Πραγματικό BOQ row για χάλυβα οπλισμού (ξεχωριστή ΑΤΟΕ γραμμή OIK-2.0x).
- Project-level Structural Settings panel (πέρα από το column dropdown) + `defaultConcreteGrade` UI.

---

## 5. Changelog

- **2026-06-14** — Slice 2 (2a UI οπλισμού + 2b building-level κανονισμός SSoT) IMPLEMENTED (Opus). 2a: `column-structural` ribbon panel + `structural-param.ts` + `column-structural-bridge.ts` + `struct-auto-reinforce` icon + i18n (`ribbon.commands.columnStructural.*`, `ribbon.panels.columnStructural`, `structural.code.*`). 2b: `structural-settings.ts` + store + service + `useStructuralSettingsSync` (building doc `subscribeDoc`) + Building contract/payload `structuralSettings?` + validator threading στο `UpdateColumnParamsCommand`. 15 νέα jest (param helper + store), 50 regression GREEN. Reconcile numbering (UI=Slice 2· εμφάνιση→3· static→4). UNCOMMITTED (🔴 browser-verify + commit).
- **2026-06-14** — Slice 1 (1A ποσότητες + 1B οπλισμός) IMPLEMENTED (Opus). Νέο `bim/structural/` module (9 αρχεία), wiring σε column types/schemas/validator/schedule + i18n. Jest coverage. UNCOMMITTED.
