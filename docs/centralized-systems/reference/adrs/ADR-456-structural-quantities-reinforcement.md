# ADR-456 — Στατικά: Ποσότητες Σκυροδέματος & Οπλισμός (Structural Quantities & Reinforcement)

**Status:** 🟢 Slice 1 (1A + 1B) + Slice 2 (2a UI + 2b building-level κανονισμός) + Slice 3 (2Δ/3Δ σχεδίαση οπλισμού) + Slice 3b (καμπύλες γωνίες στεφανιών, EC2 rounded bends) IMPLEMENTED 2026-06-14 — UNCOMMITTED (🔴 browser-verify + commit)
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

## 4ter. Slice 3 — 2Δ/3Δ σχεδίαση οπλισμού (2026-06-14)

**Geometry-is-SSoT:** οι θέσεις ράβδων/στεφανιών ΠΟΤΕ δεν αποθηκεύονται — re-derived on-demand από ΕΝΑ pure SSoT και για 2Δ και για 3Δ (ίδιες θέσεις, μηδέν διπλή τοποθέτηση). Mirror του ADR-449 σοβά (derived overlay + 2Δ&3Δ + view toggle).

- **`bim/structural/reinforcement/column-rebar-layout.ts`** (NEW, pure SSoT) — `computeColumnRebarLayout(reinforcement, widthMm, depthMm)` → θέσεις διαμήκων (4 γωνίες + `count-4` ομοιόμορφα στην περίμετρο, largest-remainder ανά πλευρά) + κλειστό ορθογώνιο στεφανιού, σε **LOCAL mm** (κεντραρισμένα). `computeStirrupLevelsMm(...)` → στάθμες z με πύκνωση στις 2 κρίσιμες ζώνες `lcr` (συνεπές με `computeStirrupCount`).
- **`column-geometry.ts`** (MOD) — NEW εξαγόμενο `columnLocalMmToWorld(params, localMm[])`: μεταφέρει local-mm σημεία σε world μέσω του ΙΔΙΟΥ `centredLocalToWorld` SSoT με το footprint → ο οπλισμός ακολουθεί rotation/anchor.
- **2Δ:** `bim/renderers/column-rebar-2d.ts` (NEW, pure ctx) — γεμάτες Ø-scaled κουκκίδες + στεφάνι + γωνιακό γαντζάκι 135°. Κλήση ως scene-level pass `DxfRenderer.drawColumnReinforcement2D` μέσα στο cached normal-state bitmap (ίδιο pattern με τον σοβά).
- **3Δ/τομή:** `bim-3d/converters/column-rebar-3d.ts` (NEW) — `buildColumnRebarCage` (κατακόρυφες ράβδες + οριζόντιοι δακτύλιοι ως **κύλινδροι με πραγματική Ø**, InstancedMesh ανά κατηγορία· ράβδος ακτίνα=Ø_διαμ/2, στεφάνι=Ø_συνδ/2 → διακριτό πάχος όπως στο 2Δ· plan(sx,sy)→three(sx,y,−sy) σύμβαση/baseY με τον πυρήνα). `attachColumnRebar` στο `columnToMesh` (flat + attached paths). **ΚΡΙΣΙΜΟ:** ο rebar είναι **ΑΝΕΞΑΡΤΗΤΟΣ** από το `suppressFinishSkin` (το scene path το θέτει `true` γιατί ο ενιαίος silhouette σοβάς αναλαμβάνει το σκιν — ADR-449 Slice X1· ο rebar gate-άρεται ΜΟΝΟ στο `showReinforcement`). **3Δ rebuild-on-toggle:** `use-bim3d-vg-resync` απέκτησε subscription (g) σε `showReinforcement` (+ Boy-Scout `showFinishSkin`) → flip διακόπτη ξανα-χτίζει τη σκηνή (ο κλωβός χτίζεται σε scene-build time, ΟΧΙ imperative overlay).
- **Toggle:** `showReinforcement` per-view (default **OFF**, opt-in) — config/store/store-types + `rebar-visibility.ts` (event-time gate) + ribbon View tab `REINFORCEMENT_BUTTON` + `ShowReinforcementToggle.tsx` + i18n `ribbon.commands.reinforcement.*`.
- **ADR-040 fix (Boy-Scout):** ο `bimSettingsHash` του bitmap cache πήρε `rebar` (showReinforcement) **+** `fs` (showFinishSkin — ήταν latent gap του ADR-449) → οι διακόπτες σπάνε σωστά το cached bitmap.
- **Πεδίο:** ορθογωνική κολώνα με ορισμένο `reinforcement`. 11 jest GREEN.

### Τύποι συνδετήρων (stirrup types) — ποσότητα + σχέδιο + περίσφιγξη

`ColumnStirrups.type?: StirrupType` = `'closed-hooked'` (default) | `'closed-welded'` | `'spiral'`:
- **Ποσότητα** (`column-reinforcement-compute`): hooked = περίμετρος + 2×10·Ø γάντζοι· welded = περίμετρος μόνο (λιγότερο σίδερο)· spiral = συνεχές ελικοειδές μήκος `Σ√(περίμετρος²+βήμα²)` ανά στροφή (reuse `computeStirrupLevelsMm` ⇒ πύκνωση άκρων) + 1.5 στροφές αγκύρωσης.
- **Σχέδιο**: 2Δ γάντζος 135° μόνο σε hooked· 3Δ hooked=δαχτυλίδια+γάντζος προς κέντρο, welded=καθαρά δαχτυλίδια, spiral=**συνεχής ανερχόμενη έλικα**.
- **Στατική** (NEW `column-confinement.ts`): συντελεστής περίσφιγξης EC8 §5.4.3.2.2(8) α=αₙ·αₛ (αₛ κατά ύψος, αₙ στην κάτοψη από θέσεις ράβδων· spiral αₙ=1). Welded = ίδιο α με hooked + `ductilityWarning` (συγκόλληση περιορίζεται αντισεισμικά). Readout «Περίσφιγξη α» στο panel.
- **UI**: combo «Τύπος συνδετήρα» (`stirrupType` string key, bridge-handled όπως `concreteGrade`) + i18n `stirrupTypeOption.*`. Zod `+type` enum (.strict). 9 jest (ποσότητα ανά τύπο + α).

**Slice 3 DEFER:** cross-ties/εσωτερικοί δεσμοί· μη-ορθογωνικές διατομές (κυκλική/L/T)· scale-aware LOD (κρύψε ράβδες σε πολύ μικρό zoom)· clipping των ράβδων από το cut-plane (τώρα διατρέχουν όλο το ύψος → φαίνονται μέσα από την τομή). *(στρογγυλεμένες γωνίες στεφανιού → ΕΓΙΝΕ Slice 3b)*

## 4bis. DEFER (επόμενα slices)

- **Slice 4** — Στατικός υπολογισμός (φορτία, αξονική/ροπές, M-N interaction, fcd/fyd capacity checks — `concreteFcdMpa`/`rebarFydMpa` έτοιμα).
- **Slice 5+** — Επέκταση σε δοκούς/πέδιλα/πλάκες/τοιχεία (reuse code providers + concrete grades + StructuralSettings).
- ρ-check για μη-ορθογωνικές διατομές (χρειάζεται `geometry.area` αντί width·depth).
- Πραγματικό BOQ row για χάλυβα οπλισμού (ξεχωριστή ΑΤΟΕ γραμμή OIK-2.0x).
- Project-level Structural Settings panel (πέρα από το column dropdown) + `defaultConcreteGrade` UI.

---

## 5. Changelog

- **2026-06-16 (b)** — **Real-time αυτόματος οπλισμός — PENDING (α)+(β) DONE (live ghost during drag + detail-sheet/continuity/checks routing), UNCOMMITTED:** ολοκληρώθηκαν τα δύο εκκρεμή του πυρήνα. **(α) Live ghost rebar ΚΑΤΑ ΤΟ DRAG**: το grip-drag/resize ghost (`rendering/ghost/draw-ghost-entity.ts`, column case) ζωγράφιζε μόνο περίγραμμα· πλέον καλεί το **ΙΔΙΟ pure SSoT** `drawColumnRebar2D(ctx, params, pxPerMm, toScreen)` με τα previewed (auto-aware) params → ο resolver re-derive-άρει φρέσκο design από τη DRAGGED γεωμετρία σε πραγματικό χρόνο (auto), ή ζωγραφίζει το κλειδωμένο stored (manual). Ίδιο visibility-gate (`isReinforcementVisible()`) + κληρονομεί το translucent alpha του ghost (μηδέν style override → διαβάζεται ως ghost). Το ghost ρέει `applyEntityPreview`→`useGripGhostPreview`→`drawGhostEntity` — **καμία νέα subscription** (ADR-040-safe· stage ADR-040 για CHECK 6B/6D μαζί με αυτό το αρχείο rendering). **(β) Routing μέσω resolver**: (i) `ui/components/column-detail/ColumnDetailHost.tsx` — NEW `toEffectiveColumn()` resolve-άρει τον ενεργό οπλισμό **ΜΙΑ φορά** (store convenience) και τον περνά ΚΑΙ στο `buildColumnDetailSheet` ΚΑΙ στο `captureColumnDetail3d` → όλα τα pure leaf builders (plan/elevation/schedule/titleblock/3D-marks) μένουν αμετάβλητα & συνεπή· (ii) `organism/reinforcement-continuity.ts` — `columnReinforcement(e, provider)` → `resolveActiveColumnReinforcement` (lap/anchorage/dowels από το ΕΝΕΡΓΟ design)· (iii) `organism/reinforcement-checks.ts` — `ratioBoundsOf` (column) + `columnReinforcementOf(e, provider)` (joint mismatch) routed → auto κολόνα με stale stored design **δεν** παράγει πλέον ψευδές `ratioOutOfRange`/`barMismatchAtJoint`. **Invariant**: ΟΛΟΙ οι consumers (render/quantify/validate/detail/continuity/checks) περνούν από τον resolver → το stale stored snapshot παραμένει ΑΒΛΑΒΕΣ. +2 jest (`reinforcement-checks` auto-routing). 41 organism+active jest + 66 detail/ghost jest GREEN. 🔴 tsc (Giorgio) + browser-verify (drag κολόνα→ζωντανός οπλισμός· detail-sheet auto) + commit.
- **2026-06-16** — **Real-time αυτόματος οπλισμός σε αλλαγή διαστάσεων — DERIVED-when-auto SSoT (Giorgio· πυρήνας DONE 301 jest· UNCOMMITTED· live-during-drag ghost + detail-sheet/continuity PENDING):** Giorgio: «αλλάζω διαστάσεις κολόνας → κρατάει τον τελευταίο οπλισμό· πρέπει να ξαναπατήσω το κουμπί. Θέλω real-time αυτόματο οπλισμό σε ΟΛΑ τα shapes, και live στην προεπισκόπηση». ΑΙΤΙΑ: ο οπλισμός = persisted design στο `params.reinforcement` (παγωμένο)· `buildReinforcePatch` αγνοούσε ήδη-οπλισμένα μέλη. **Λύση (αρχιτεκτονική εγκεκριμένη: DERIVED-when-auto, 1 SSoT):** NEW `auto?:boolean` στο `ColumnReinforcement` (button→`auto:true`· χειροκίνητη αλλαγή design πεδίου→`auto:false`, Revit «by code vs manual»). NEW **`resolveActiveColumnReinforcement(params, provider)`** (PURE, στο `section-context.ts`): `auto`→φρέσκο `suggestColumnReinforcement` από την ΤΡΕΧΟΥΣΑ γεωμετρία· `manual`→stored· διατηρεί detailing prefs (stirrup type+crossTiePattern). NEW `buildColumnSectionContextFromParams`. NEW store-coupled convenience `bim/structural/active-reinforcement.ts` `resolveActiveColumnReinforcementForParams(params)` (active code από `useStructuralSettingsStore.getState()`) — **ξεχωριστό module ώστε το `section-context` να μένει pure** (import store→σέρνει Firestore→σπάει unit tests· lesson). Δρομολογήθηκαν ΟΛΟΙ οι render/quantify/validate consumers: 2Δ `column-rebar-2d`, 3Δ `column-rebar-3d`, `column-validator` (έλεγχος ρ), bridge `effectiveReinforcement` (panel combos/readouts/ποσότητες). +4 jest `active-column-reinforcement.test.ts`. **Αποτέλεσμα**: resize→αυτόματος οπλισμός παντού (κάτοψη/3Δ/BOQ/ρ%) ΧΩΡΙΣ επανάκληση κουμπιού. **PENDING**: (α) **live ghost rebar ΚΑΤΑ ΤΟ DRAG** — ο οπλισμός ζωγραφίζεται μόνο στο committed cache (`DxfRenderer.drawColumnReinforcement2D`)· το grip-drag ghost (`rendering/ghost/apply-entity-preview.ts` column branch) δείχνει μόνο περίγραμμα → hook `drawColumnRebar2D` στο ghost render leaf (ADR-040-critical→stage ADR-040)· (β) route detail-sheet + `organism/reinforcement-continuity` μέσω resolver. Handoff: `HANDOFFS/HANDOFF-realtime-auto-reinforce-2026-06-16.md`. 🔴 (μετά το ghost) tsc+browser-verify+commit.
- **2026-06-14** — Slice 3b fix #5 (browser-verified ΣΩΣΤΟ, γάντζοι): η πλευρική μετατόπιση του #4 έβγαλε τα τόξα εκτός κέντρου από τη ράβδο → «ασύμβατες/αποσυνδεδεμένες καμπύλες». FIX (τελικό): και τα δύο άκρα τυλίγουν την ΙΔΙΑ ράβδο πάνω στον **ΙΔΙΟ κύκλο** (κέντρο=ράβδος, ακτίνα `wrapR=dbL/2+dbw/2` = ακριβώς η απόσταση ράβδου↔centerline στεφανιού → το τόξο **ξεκινά πάνω στη γραμμή στεφανιού**), φεύγουν **εφαπτομενικά** προς τον πυρήνα από **αντίθετες παρειές** → δύο **παράλληλες** ουρές φυσικά διαχωρισμένες (offset=2·wrapR), τόξα που **ταυτίζονται** στον ίδιο κύκλο, γωνία ακριβώς 135° διατηρείται. Καμία πλευρική μετατόπιση. 56 jest GREEN. ✅ Giorgio: «τώρα είναι σωστό».
- **2026-06-14** — Slice 3b fix #4 (γωνία γάντζου = **ΑΚΡΙΒΩΣ 135°**): το splay ±12° του #3 έκανε τις ουρές 33°/57° από την πλευρά → γάντζοι **147°** (όχι 135°). FIX: η ουρά βγαίνει **ακτινικά προς το κέντρο** (`aLeave = aCore`) → **45° με κάθε πλευρά → ακριβώς 135°**· τα δύο (πλέον παράλληλα) άκρα διαχωρίζονται με **πλευρική μετατόπιση** κάθετα στη διαγώνιο (`STIRRUP_HOOK_SEPARATION_FACTOR=0.5·dbw`, < ακτίνας τυλίγματος → το τόξο μένει γύρω από τη ράβδο) αντί για γωνιακό splay. NEW jest επαληθεύει αριθμητικά acute(tail,side)=45°±1°. 56 jest GREEN.
- **2026-06-14** — Slice 3b fix #3 (browser-verify, γάντζος **τυλίγει το κολωνοσίδερο**): το #2 έκανε μικρό 45° fillet στη γωνία στεφανιού → το ένα άκρο «έστριβε 135° πριν αγκαλιάσει τη ράβδο». FIX: το τόξο κάμψης **κεντράρεται στο γωνιακό κολωνοσίδερο** (`buildStirrupHookEndsMm` πλέον δέχεται `bar`+`dbL`· wrapR = dbL/2 + dbw/2 → ο συνδετήρας εφάπτεται στη ράβδο) και τυλίγει ~135° γύρω της (`hookWrapArc`: από το σημείο επαφής με την πλευρά, μέσω της εξωτερικής παρειάς που περνά από τη γωνία, ως τη φορά εξόδου) πριν την ευθεία ουρά 10·dbw. Τα δύο άκρα τυλίγουν συμμετρικά (ένα ανά πλευρά) → και τα δύο αγκαλιάζουν τη ράβδο. 55 jest (+wrap-span test) GREEN.
- **2026-06-14** — Slice 3b fix #2 (browser-verify, γάντζος 135° — δομοστατικά σωστός): (α) **ΔΥΟ άκρα** αντί ενός (ο κλειστός συνδετήρας έχει 2 άκρα που γαντζώνουν γύρω από το γωνιακό κολωνοσίδερο)· (β) **πραγματικό τόξο κάμψης** στη στροφή αντί αιχμηρού ευθύγραμμου kink. NEW SSoT `buildStirrupHookEndsMm(ring, center, dbw, seg)` → 2 πολυγραμμές [fillet τόξο κάμψης ακτίνας 2.5·dbw + ευθεία ουρά 10·dbw], τα δύο άκρα splayed (`STIRRUP_HOOK_SPLAY_RAD≈12°`) ώστε να φαίνονται ξεχωριστά· `ColumnRebarLayout.stirrupHookEndsMm`· καταναλώνεται από 2Δ (polyline stroke) + 3Δ (κύλινδροι/άκρο/στάθμη)· αντικατέστησε το single straight `drawCornerHook`/`hookSegments`. 54 jest (+5 hook tests) GREEN.
- **2026-06-14** — Slice 3b fix #1 (browser-verify, γάντζος 135°): ο 2Δ γάντζος ζωγραφιζόταν ως 2 μικρά τμήματα **κατά μήκος των πλευρών** (όχι προς το κέντρο) → δεν φαινόταν η ουρά να μπαίνει στον πυρήνα· επιπλέον **3 ασύμφωνα μήκη** (2Δ 6·dbw, 3Δ 8·dbw, ποσότητα 10·dbw). FIX: ΕΝΑ SSoT `STIRRUP_HOOK_EXTENSION_FACTOR=10` (EC8 §5.4.3.2.2 / EC2 §8.5 αγκύρωση γάντζου 135° = 10·dbw) σε `column-rebar-layout` → καταναλώνεται από 2Δ + 3Δ + `compute`· ο 2Δ `drawCornerHook` ζωγραφίζει πλέον **διαγώνια προς το κέντρο** (ίδια φορά/μήκος με το 3Δ `hookSegments`). geometry-is-SSoT: η ουρά που μετριέται = αυτή που σχεδιάζεται. 49 jest GREEN (αμετάβλητα — η ποσότητα ήταν ήδη 10·dbw).
- **2026-06-14** — **Slice 3b (καμπύλες/στρογγυλεμένες γωνίες στεφανιών, Revit-grade, FULL SSoT)**: στις 4 γωνίες ο συνδετήρας **λυγίζει με ακτίνα κάμψης** (EC2 EN 1992-1-1 §8.3 / Table 8.1N: φm,min=4·dbw → ακτίνα **άξονα** r_cl=**2.5·dbw**) και **αγκαλιάζει** τη γωνιακή διαμήκη ράβδο — όχι αιχμηρή 90°. **ΕΝΑ SSoT path generator** `buildRoundedStirrupPath(corners, rMm, segPerArc)` → κλειστή tessellated polyline (`STIRRUP_BEND_ARC_SEGMENTS=6`/γωνία· τόξο εφαπτόμενο, κέντρο=εσωτ. offset)· το `ColumnRebarLayout` απέκτησε `stirrupPathMm` + `stirrupCornerRadiusMm` (clamp ≤ μισό κοντύτερης πλευράς· **κρατήθηκε** το `stirrupRingMm` 4-corner για hook-anchor/back-compat). **2Δ** (`column-rebar-2d`) στρώνει το `stirrupPathMm` (lineTo loop)· **3Δ** (`column-rebar-3d`) το ΙΔΙΟ path ως αλυσίδα κυλίνδρων στον προϋπάρχοντα InstancedMesh αγωγό (μηδέν `mergeGeometries`/jsm· κρατήθηκαν `MeshBasicMaterial` singleton + `frustumCulled=false`)· spiral=rounded γωνίες ανά στροφή. **Geometry-is-SSoT μήκος:** NEW `stirrupCenterlinePerimeterMm` (centerline inset=cover+dbw/2 + στρογγυλεμένες γωνίες: 2(W+D)−8r+2πr) αντικατέστησε το cover-based `stirrupPerimeterMm` στο `compute` → το βάρος χάλυβα ταιριάζει ΑΚΡΙΒΩΣ με τη σχεδίαση (hooked/welded/spiral). **ΔΕΝ** άγγιξε `DxfRenderer.ts` (μόνο ο 2Δ helper) → χωρίς ADR-040 stage. +12 jest (49 layout-suite GREEN· stirrup-types & structural-quantities relative→αμετάβλητα). ΜΑΘΗΜΑ: tessellated polyline ως κοινό SSoT 2Δ/3Δ = λεία γωνία χωρίς νέο geometry type/merge/jsm, διατηρεί άθικτο τον InstancedMesh αγωγό + τα material/culling fixes Slice 3. UNCOMMITTED (🔴 browser-verify + commit).
- **2026-06-14** — Slice 3 fix #5 (Η ΑΙΤΙΑ: 3Δ rebar «δεν ξεσκάλωνε» στο μπες-στο-3Δ — μόνο toggle OFF→ON ή slider τομής το έδειχνε): repro έδειξε ότι ο κλωβός **χτίζεται** (OFF→ON δουλεύει) αλλά **δεν ζωγραφίζεται στο πρώτο frame**· ο slider (markDirty) τον αποκάλυπτε. ΑΙΤΙΑ = `MeshStandardMaterial` (φωτιζόμενο→async shader compile/lights/envmap→skip στο πρώτο frame). FIX: **`MeshBasicMaterial` κοινό module-singleton** (άφωτο, compiled once, reused· mirror του παλιού working `LineBasicMaterial`). ΜΑΘΗΜΑ: για overlay geometry που μπαίνει σε on-demand-render σκηνή, χρησιμοποίησε άφωτο/pre-compiled υλικό — το lit material μπορεί να χαθεί στο πρώτο frame.
- **2026-06-14** — Slice 3 fix #4 (defensive): τα rebar **InstancedMesh** έχουν bounding sphere από το unit geometry στο origin (ΟΧΙ από τα instance matrices) → `frustumCulled=false` (απέτρεψε πιθανό culling όταν η κολώνα είναι μακριά από το origin· τα παλιά LineSegments είχαν baked bounds). ΜΑΘΗΜΑ: InstancedMesh με per-instance transforms → frustumCulled=false ή χειροκίνητο boundingSphere.
- **2026-06-14** — Slice 3 fix #3 (toggle «Οπλισμός» απενεργοποιούνταν μετά από κάθε εντολή): ΑΙΤΙΑ = το server persist schema `app/api/dxf-levels/dxf-levels.schemas.ts` (whitelist) **έκοβε** το `showReinforcement` → `useBimRenderSettingsSync` ξαναφόρτωνε stale settings (μετά το 2s quiet-window) → default OFF. FIX: `+showReinforcement: z.boolean().optional()` στο schema (+ regression test). Επίσης: προστέθηκε το toggle «Οπλισμός» ΚΑΙ στο contextual tab «Ιδιότητες Κολώνας» (panel Στατικά/Οπλισμός, ίδιο widget `show-reinforcement-toggle`). ΜΑΘΗΜΑ: per-view toggle = 3 σημεία (config resolve + store buildRaw + **server schema whitelist**)· αν λείπει το 3ο, default-OFF flags «επανέρχονται».
- **2026-06-14** — Slice 3 + στατική: **τύποι συνδετήρων** (`StirrupType`: closed-hooked/closed-welded/spiral). Ποσότητα ανά τύπο (`compute`: welded χωρίς γάντζους· spiral ελικοειδές via `computeStirrupLevelsMm`)· σχέδιο 2Δ/3Δ ανά τύπο (3Δ spiral=έλικα, hooked=δαχτυλίδια+γάντζος)· **περίσφιγξη** NEW `column-confinement.ts` (EC8 α=αₙ·αₛ· spiral αₙ=1· welded ductilityWarning) + readout «Περίσφιγξη α»· UI combo `stirrupType` + i18n + Zod `+type`. 9 νέα jest (39 σύνολο reinforcement GREEN).
- **2026-06-14** — Slice 3 fix #2 (3Δ ίδιο πάχος): οι ράβδες/στεφάνια ήταν LineSegments (WebGL αγνοεί `linewidth` → ομοιόμορφο 1px). Αντικαταστάθηκαν με **κυλίνδρους InstancedMesh** (ακτίνα=Ø/2 ανά τύπο) → διακριτό πάχος όπως στο 2Δ.
- **2026-06-14** — Slice 3 fix (3Δ δεν φαινόταν): (α) ο rebar αποσυνδέθηκε από το `suppressFinishSkin` (το scene path το θέτει true → ο rebar καταπιεζόταν λάθος)· (β) `use-bim3d-vg-resync` +subscription σε `showReinforcement`/`showFinishSkin` → toggle ξανα-χτίζει 3Δ (πριν: μόνο 2Δ live-update μέσω bitmap cache key). 22 jest GREEN.
- **2026-06-14** — Slice 3 (2Δ/3Δ σχεδίαση οπλισμού) IMPLEMENTED (Opus). NEW `column-rebar-layout.ts` (pure geometry SSoT: θέσεις διαμήκων/στεφανιών + stirrup levels) + `column-geometry.columnLocalMmToWorld` + `column-rebar-2d.ts` (scene-pass στο `DxfRenderer`) + `column-rebar-3d.ts` (`buildColumnRebarCage` + `attachColumnRebar` στο `columnToMesh`) + `rebar-visibility.ts`. Toggle `showReinforcement` (default OFF) σε config/store/store-types + ribbon `REINFORCEMENT_BUTTON` + `ShowReinforcementToggle.tsx` + i18n `ribbon.commands.reinforcement.*`. ADR-040 Boy-Scout fix: `bimSettingsHash` += `rebar` + `fs` (latent ADR-449 gap). Πεδίο=ορθογωνική κολώνα με `reinforcement`. 11 νέα jest GREEN. UNCOMMITTED (🔴 browser-verify + commit). DEFER: 3Δ κύλινδροι με Ø, cross-ties, μη-ορθογωνικές, LOD.
- **2026-06-14** — Slice 2 (2a UI οπλισμού + 2b building-level κανονισμός SSoT) IMPLEMENTED (Opus). 2a: `column-structural` ribbon panel + `structural-param.ts` + `column-structural-bridge.ts` + `struct-auto-reinforce` icon + i18n (`ribbon.commands.columnStructural.*`, `ribbon.panels.columnStructural`, `structural.code.*`). 2b: `structural-settings.ts` + store + service + `useStructuralSettingsSync` (building doc `subscribeDoc`) + Building contract/payload `structuralSettings?` + validator threading στο `UpdateColumnParamsCommand`. 15 νέα jest (param helper + store), 50 regression GREEN. Reconcile numbering (UI=Slice 2· εμφάνιση→3· static→4). UNCOMMITTED (🔴 browser-verify + commit).
- **2026-06-14** — Slice 1 (1A ποσότητες + 1B οπλισμός) IMPLEMENTED (Opus). Νέο `bim/structural/` module (9 αρχεία), wiring σε column types/schemas/validator/schedule + i18n. Jest coverage. UNCOMMITTED.
