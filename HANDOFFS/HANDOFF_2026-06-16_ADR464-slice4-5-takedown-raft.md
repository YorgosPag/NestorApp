# HANDOFF — ADR-464 Slices 4 & 5 (Tributary Load Takedown + Raft Parity & Detail Summary)

**Ημερομηνία:** 2026-06-16 · **Συντάκτης:** Opus 4.8 (συνεδρία ADR-464 Slices 2-3)
**Μοντέλο νέας συνεδρίας:** Opus · **Discipline:** Δομοστατικά — Θεμελίωση
**Στόχος:** **Slice 4** = αυτόματα φορτία πεδίλου (tributary load takedown, Revit-without-Robot) · **Slice 5** = raft (εδαφόπλακα) bearing parity + design summary στο detail-sheet. **FULL ENTERPRISE + FULL SSOT, Revit-grade.**

---

## ⚠️ ΚΑΝΟΝΕΣ (απαράβατοι)
- **Ελληνικά** πάντα στις απαντήσεις.
- **COMMIT/PUSH τα κάνει ΜΟΝΟ ο Giorgio.** **Shared working tree με άλλον agent** → `git add` **ΜΟΝΟ τα δικά σου αρχεία**, ΠΟΤΕ `git add -A`.
- **GOL + SSOT**: ΠΡΙΝ γράψεις κώδικα → `grep`/`Glob` για υπάρχοντα (reuse-map παρακάτω), ΜΗΔΕΝ διπλότυπα, function ≤40 γρ., file ≤500 γρ., zero `any`/`as any`/`@ts-ignore`, i18n keys (όχι hardcoded strings — N.11).
- **N.17 single-tsc**: ΕΝΑ `tsc` τη φορά — έλεγξε ότι δεν τρέχει άλλος πριν ξεκινήσεις (`Get-CimInstance Win32_Process … *tsc*`).
- **Plan-first ΔΕΝ χρειάζεται** — ο Giorgio έχει εγκρίνει το slicing· προχώρα grep-first. (Εξαίρεση: το **tributary-area model** του Slice 4 έχει πραγματική αρχιτεκτονική επιλογή — δες §Slice 4 «Tributary area» — πάρε εσύ Revit-grade απόφαση & ζήτα μόνο έγκριση αν αμφιβάλλεις.)
- **Firestore-safe (ADR-390 Φ4)**: ΠΟΤΕ explicit `undefined` σε persisted params — omit-when-invalid (δες `resolveStructuralSettings`).

## 📌 ΚΑΤΑΣΤΑΣΗ TREE (κρίσιμο)
- **ADR-464 Slices 0-1-1b-2-3 = COMMITTED** (2026-06-16). Χτίζεις ΠΑΝΩ.
- **tsc errors που ΔΕΝ είναι δικά σου** (WIP άλλων agents — ΜΗΝ τα αγγίξεις): `useBeamPersistence.ts`, `beam-persistence-helpers.ts`, `bim-3d/placement/BeamFromWallGhost.ts`, `bim-3d/proposal/*`, `bim-3d/converters/mesh-to-object3d.ts`, `bim/foundations/foundation-level.ts`, `bim/slabs/slab-grid-commit.ts`, `hooks/canvas/useDxfSceneConversion.ts`, `hooks/data/useFloors3DAggregator.ts` (14 errors σταθερά). Επιβεβαίωσε ότι τα δικά σου αρχεία είναι clean (grep το tsc output για τα paths σου).

---

## ✅ ΤΙ ΥΠΑΡΧΕΙ ΗΔΗ (Slices 0-3 — ΜΗΝ το ξαναφτιάξεις)

### `bim/structural/loads/` (FEM-free loads model)
- `structural-loads-types.ts` — `AppliedMemberLoad` (persisted G/Q: deadAxialKn/liveAxialKn + optional ροπές), `MemberLoad`, **`MemberLoadSource = 'manual' | 'takedown'`** (ΗΔΗ ορισμένο — το Slice 4 γράφει `'takedown'`), `CombinedLoad`, `resolveAppliedMemberLoad`, `isZeroMemberLoad`, `ZERO_MEMBER_LOAD`.
- `load-combinations.ts` — EN1990 `combineUls(load, {gammaG,gammaQ})` / `combineSls(load)`. **Έτοιμα — reuse.**

### `bim/structural/footing-design/` (pure, DERIVED, ΠΟΤΕ persisted)
- `footing-design-types.ts` — `FootingDesignInput` (+`coverMm`/`concreteGrade`/`flexuralRatioL`), `FootingDesignResult { bearing, flexure, punching, oneWayShear }`, `BasePressure`, `DesignCheck`, `BearingResult`/`FlexureResult`/`PunchingResult`/`OneWayShearResult`.
- `footing-bearing.ts` — **`computeBasePressure(N, Mx, My, W, L)` SSoT κατανομής πίεσης** (το μοιράζονται bearing/flexure/shear) + `computeFootingBearing` + **`makeDesignCheck(demand, capacity)` SSoT** + export `KERN_RATIO`.
- `footing-flexure.ts` — EC2 §9.8.2 κάμψη (As κάτω/άνω, hoggingGoverns).
- `footing-shear.ts` — **`concreteShearResistanceMpa(grade, d, ρl)` SSoT v_Rd,c** (EC2 §6.2.2, κοινό one-way+punching) + `computeFootingOneWayShear`.
- `footing-punching.ts` — EC2 §6.4 διάτρηση (u1=2(cx+cy)+2π·2d, soil-relief capped στο ίχνος, β=1.15).
- `footing-design.ts` — orchestrator `computeFootingDesign(input)` → και τα 4.
- `footing-design-input.ts` — **`buildPadFootingDesignInput(footing, provider, soil, entities?)`** (κοινό builder runner+UI readout). `entities?` → **`resolveSupportingColumnDims(footingId, entities)`** μέσω explicit FK `ColumnParams.footingId`. ρl από stored/suggested footing reinforcement· **concreteGrade=DEFAULT_CONCRETE_GRADE** (foundation params ΔΕΝ έχουν grade — DEFER).
- `footing-design-checks.ts` — `runFootingDesignChecks(entities, provider, soil?)` → diagnostics `bearingInadequate`/`padEccentricHogging`/`punchingInadequate`/`oneWayShearInadequate`. **Iterate-άρει ΜΟΝΟ `isFoundationEntity` (pad)** — το Slice 5 θα επεκτείνει σε raft.

### Settings / providers / diagnostics / UI
- `structural-settings.ts` — building-level SSoT (`StructuralSettings`, persist `buildings/{id}.structuralSettings`). Έχει `soilBearingCapacityKpa?` + `resolveStructuralSettings` (omit-when-invalid). **Το Slice 4 προσθέτει εδώ `AreaLoadSettings`** (mirror σ_allow).
- `structural-settings-store.ts` + `structural-settings.service.ts` — store + Firestore round-trip (setter `setSoilBearingCapacityKpa` = το πρότυπο για το Slice 4 setter).
- 2 providers (`eurocode-provider`/`greek-legacy-provider`) — `footingDesignFactors()` (γ_G=1.35, γ_Q=1.5).
- `organism/structural-organism-types.ts` — `StructuralDiagnosticCode` union (+τα 4 ADR-464 codes).
- Foundation panel «Φορτία & Έδραση» (pad-only): `foundation-structural-bridge.ts` (σ_allow→store, appliedLoad N/Mx/My presets, bearing readouts p_max/αξιοποίηση via `computeFootingDesign`).
- `useStructuralOrganism.ts` καλεί `runFootingDesignChecks(entities, provider, settings.soilBearingCapacityKpa)`.

---

## 🎯 SLICE 4 — TRIBUTARY LOAD TAKEDOWN (αυτόματα φορτία)

### Στόχος (Revit «load takedown» χωρίς FEM)
Παρήγαγε **DERIVED** χαρακτηριστικό φορτίο κολώνας/πεδίλου:
`N = (επιφάνεια ευθύνης κολόνας) × Σ(ορόφων από πάνω) × (G_area + Q_area) + ίδιο βάρος (κολώνες/δοκάρια/πλάκες πάνω)`
→ γράφει `footing.appliedLoad` **`source: 'takedown'`** (ώστε ο υπάρχων bearing/flexure/punching engine να τρέχει αυτόματα).

### Νέα SSoT
- **`bim/structural/loads/load-takedown.ts`** (pure, DERIVED) — `computeMemberTakedown(...)` → `MemberLoad` (source='takedown'). Συνθέτει: tributary area × storeys × area loads + self-weight. Καθαρά γεωμετρικό + building settings.
- **`AreaLoadSettings`** στο `structural-settings.ts` (building-level, mirror σ_allow): `deadAreaLoadKpa?` (G: επικαλύψεις+ίδιο βάρος πλάκας), `liveAreaLoadKpa?` (Q: χρήση). + `resolveStructuralSettings` validation (omit-when-invalid) + store setter + service round-trip (mirror `setSoilBearingCapacityKpa`).

### Reuse-map (grep-confirmed — ΜΗΝ διπλασιάσεις)
- **Storey count SSoT** = `@/utils/floor-naming` → `countBuildingStoreys(floors)` + `isBuildingStorey(kind)` + `SPECIAL_LEVEL_KINDS` (ADR-461· special levels εξαιρούνται από το count). Reuse για «πόσοι όροφοι φορτίζουν την κολώνα».
- **EN1990 combos** = `load-combinations.ts` (ΗΔΗ έτοιμα).
- **Organism graph** = `organism/structural-graph.ts` `buildStructuralGraph(entities)` → column nodes με `footprint` (canvas units) + `footingId` FK. Reuse για column→footing mapping (ίδιο με `resolveSupportingColumnDims`).
- **Self-weight σκυρ.** = `concrete-grades.ts` `concreteWeightKg(volumeM3)` (+ GRAVITY pattern στο `footing-design-input.footingSelfWeightKn`).
- **appliedLoad target** = `PadFootingParams.appliedLoad` (ΗΔΗ υπάρχει). **ΚΑΝΟΝΑΣ: takedown γράφει ΜΟΝΟ όταν source απών/‘takedown’ — ΠΟΤΕ μην overwrite-άρεις χειροκίνητο (source='manual')** (ίδια αρχή με auto vs manual reinforcement).
- **Writer command/hook** = grep `AutoReinforceOrganismCommand` + `useStructuralAutoReinforce` (ADR-459 Φ4) — mirror command + ribbon κουμπί «Υπολογισμός Φορτίων» στην καρτέλα **Ανάλυση** (ίδιο μοτίβο με «Αυτόματος Οπλισμός»). Persist μέσω υπάρχουσας foundation persistence (setDoc + enterprise-id, ΠΟΤΕ addDoc).

### ⚠️ Tributary area — η ΜΟΝΗ πραγματική αρχιτεκτονική επιλογή (πάρε Revit-grade απόφαση)
Δεν υπάρχει έτοιμος tributary κώδικας (grep: μηδέν `tributary`/`influenceArea`/`voronoi`). Επιλογές:
1. **Grid half-spacing (ΠΡΟΤΕΙΝΟΜΕΝΟ, Revit-grade):** επιφάνεια ευθύνης = ορθογώνιο με πλευρές = μισή απόσταση προς γειτονικές κολώνες ανά άξονα (από τα column footprints/centroids ή τον κάναβο ADR-441). Grep `bim/grid` (ADR-441 grid system) — μπορεί να δώσει spacing έτοιμο.
2. **Per-column manual override** (input στο panel) — fallback/DEFER.
3. **Building footprint / πλήθος κολονών** — crude, μόνο fallback.
Πρότεινε #1 με fallback σε per-column manual· **irregular Voronoi = DEFER**. Τεκμηρίωσε την παραδοχή.

### Παραδοτέα Slice 4
load-takedown.ts + AreaLoadSettings (settings+store+service) + takedown command/hook + ribbon κουμπί + i18n el/en + jest (takedown math + storey count + manual-not-overwritten + zero όταν λείπουν area loads). UI readout «προτεινόμενο N» (προαιρετικό).

---

## 🎯 SLICE 5 — RAFT PARITY + DETAIL SUMMARY

### Στόχος
(α) Ο bearing έλεγχος να καλύπτει ΚΑΙ raft/εδαφόπλακα (`SlabEntity` kind foundation/ground), όχι μόνο pad. (β) Σύνοψη σχεδιασμού (bearing/flexure/punching/shear utilizations) στο detail-sheet.

### Reuse-map (grep-confirmed)
- **Raft ctx** = `section-context.ts` `buildSlabFoundationSectionContext(slab)` + `isFoundationSlabEntity(e)` (ΗΔΗ υπάρχουν).
- **Raft reinforcement** = `suggestSlabFoundationReinforcementFrom` (top+bottom σχάρα ΗΔΗ) + `slab-foundation-reinforcement-compute.ts`.
- **Bearing engine** = `computeBasePressure`/`computeFootingBearing`/`makeDesignCheck` (reuse· raft = uniform avg pressure N/A vs σ_allow· εκκεντρότητα προαιρετική).
- **Runner** = `footing-design-checks.ts` — επέκτεινε το loop να πιάνει `isFoundationSlabEntity` (νέο `buildRaftDesignInput` ή γενίκευση `buildPadFootingDesignInput`). ⚠️ Το `SlabParams` ΔΕΝ έχει `appliedLoad` — η πηγή φορτίου raft = takedown (Slice 4) ή manual· αν λείπει → engine αδρανές (advisory).
- **Detail summary** = `detail-sheet/footing-detail-sheet.ts` (`buildFootingDetailSheet`, `FootingDetailSheetInput`, `DetailSheetModel`, regions) + **mirror `footing-detail-schedule.ts`** → νέο `footing-detail-design-summary.ts` (πίνακας utilizations· reuse `detail-sheet-types.ts` + region layout). Preview===PDF (το detail-sheet είναι ΕΝΑ model→2 backends).

### Παραδοτέα Slice 5
raft bearing input/runner επέκταση + `footing-detail-design-summary.ts` region + wiring στο footing-detail-sheet + i18n + jest (raft bearing + summary region layout).

---

## 📋 ΜΑΘΗΜΑΤΑ (από Slices 1-3 — εφάρμοσέ τα)
- **suggester = ελάχιστο detailing· engines (flexure/shear/punching) = strength demand DERIVED.** Μην μπλέξεις τα δύο (καθαρό ctx contract).
- **Firestore-safe**: omit-when-invalid (ΠΟΤΕ explicit undefined). updatedAt==createdAt = το persist απέτυχε σιωπηλά.
- **punching relief capped στο ίχνος** (αλλιώς compact footing → αρνητικό).
- **concreteGrade foundation = DEFER** (DEFAULT_CONCRETE_GRADE). Το Slice 5 μπορεί προαιρετικά να προσθέσει per-footing grade input (DEFER).
- **manual vs auto**: takedown/auto-reinforce ΠΟΤΕ δεν overwrite-άρουν χειροκίνητη τιμή.

## 📋 DEFER (ξεχωριστά μελλοντικά ADR — ΟΧΙ τώρα)
Πλήρες FEM analysis engine· σεισμικοί συνδυασμοί EC8· settlement εδάφους· πλήρες β διάτρησης από M/W1· eccentric punching· spatial column fallback· irregular Voronoi tributary· per-footing concrete grade UI· free-numeric input στο panel.

## 🔑 Reference
- ADR: `docs/centralized-systems/reference/adrs/ADR-464-advanced-footing-reinforcement.md` (Slices 0-3 COMMITTED· §3 πίνακας slices· §5 changelog)
- Memory: `~/.claude/projects/C--Nestor-Pagonis/memory/project_adr464_advanced_footing_design.md`
- Tracker: `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (γραμμή ADR-464)
