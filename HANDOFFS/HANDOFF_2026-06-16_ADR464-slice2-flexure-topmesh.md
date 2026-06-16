# HANDOFF — ADR-464 Slice 2 (Flexure + Unified Top-Mesh + Eccentric-Hogging)

**Ημερομηνία:** 2026-06-16 · **Συντάκτης:** Opus 4.8 (συνεδρία ADR-464 Slices 0-1-1b)
**Μοντέλο νέας συνεδρίας:** Opus · **Discipline:** Δομοστατικά — Θεμελίωση
**Στόχος νέας συνεδρίας:** **Slice 2** — κάμψη πεδίλου (EC2 §9.8.2) + **ενοποιημένος κανόνας άνω σχάρας** (top mesh) + warning έκκεντρου πεδίλου. FULL ENTERPRISE + FULL SSOT, Revit-grade.

---

## ⚠️ ΚΑΝΟΝΕΣ (απαράβατοι)
- **Ελληνικά** πάντα στις απαντήσεις.
- **COMMIT/PUSH τα κάνει ΜΟΝΟ ο Giorgio.** Shared working tree με άλλον agent → `git add` **ΜΟΝΟ τα δικά σου αρχεία**, ΠΟΤΕ `git add -A`.
- **GOL + SSOT**: ΠΡΙΝ γράψεις κώδικα → `grep`/`Glob` για υπάρχοντα (reuse-map παρακάτω), ΜΗΔΕΝ διπλότυπα, function ≤40 γρ., file ≤500 γρ., zero `any`/`as any`/`@ts-ignore`, i18n keys (όχι hardcoded).
- **N.17 single-tsc**: ΕΝΑ `tsc` τη φορά — έλεγξε ότι δεν τρέχει άλλος πριν ξεκινήσεις (`Get-CimInstance Win32_Process … *tsc*`).
- **Plan-first** ΔΕΝ χρειάζεται ξανά — ο Giorgio έχει εγκρίνει το slicing· προχώρα Slice 2 με grep-first.

## 📌 ΚΑΤΑΣΤΑΣΗ TREE (κρίσιμο)
- **ADR-464 Slices 0-1-1b = UNCOMMITTED** (ο Giorgio θα κάνει commit). Χτίζεις ΠΑΝΩ.
- **ADR-463 + άλλα ADR = UNCOMMITTED** στο shared tree.
- **tsc errors που ΔΕΝ είναι δικά σου** (WIP άλλων agents — ΜΗΝ τα αγγίξεις/διορθώσεις): `useBeamPersistence.ts` (`beamDocToEntity` missing), `beam-persistence-helpers.ts`, `bim-3d/placement/BeamFromWallGhost.ts`, `bim-3d/proposal/*`, `bim-3d/converters/mesh-to-object3d.ts`, `bim/foundations/foundation-level.ts`, `bim/slabs/slab-grid-commit.ts`, `useDxfSceneConversion.ts`, `useFloors3DAggregator.ts`. Επιβεβαίωσε ότι τα δικά σου αρχεία είναι clean (grep το tsc output για τα paths σου).

---

## ✅ ΤΙ ΕΓΙΝΕ ΗΔΗ (Slices 0-1-1b — μην το ξαναφτιάξεις)

### Loads model `bim/structural/loads/` (FEM-free)
- `structural-loads-types.ts` — `AppliedMemberLoad` (persisted G/Q: deadAxialKn/liveAxialKn + optional deadMomentX/Y, liveMomentX/Y), `MemberLoad` (πλήρες), `CombinedLoad`, `ZERO_MEMBER_LOAD`, `isZeroMemberLoad`, `resolveAppliedMemberLoad`. **Σύμβαση:** momentX→εκκεντρότητα κατά X (e_x=Mx/N), momentY→e_y. Axial kN θλίψη θετική.
- `load-combinations.ts` — EN1990: `combineUls(load, {gammaG,gammaQ})` (1.35G+1.5Q), `combineSls(load)` (G+Q). `LoadCombinationFactors`.

### Footing design engine `bim/structural/footing-design/` (pure, DERIVED, ΠΟΤΕ persisted)
- `footing-design-types.ts` — `FootingDesignInput` (widthMm/lengthMm/thicknessMm/columnWidthMm/columnDepthMm/serviceLoad/ulsLoad/soilBearingCapacityKpa/footingSelfWeightKn), `DesignCheck` (demand/capacity/utilization/adequate), `BearingResult`, **`FootingDesignResult { bearing }`** (← Slice 2 προσθέτει `flexure`).
- `footing-bearing.ts` — EC7 κατανομή πίεσης: concentric/εντός-kern **ΑΚΡΙΒΕΣ** (p=N/A(1±6e_x/W±6e_y/L)), μονοαξονική αποκόλληση **ΑΚΡΙΒΗΣ** τριγωνική (p_max=2N/(3·B·(D/2−e))), διαξονική γωνιακή **ΣΥΝΤΗΡΗΤΙΚΗ** (max με ελαστική). `KERN_RATIO=1/6`.
- `footing-design.ts` — orchestrator `computeFootingDesign(input)` → `{ bearing }` (Slice 2: +flexure).
- `footing-design-input.ts` — **κοινό SSoT builder** `buildPadFootingDesignInput(footing, provider, soilKpa)` (runner + UI readouts το μοιράζονται). Διαβάζει `footing.params.appliedLoad`, column dims=0 (Slices 2-3 τα χρειάζονται).
- `footing-design-checks.ts` — `runFootingDesignChecks(entities, provider, soilKpa?)` → `bearingInadequate` (error). Iterate-άρει foundations (pad), αδρανές χωρίς σ_allow/φορτίο. **Όχι graph** (πιο robust).
- `__tests__/footing-bearing.test.ts` — 11 jest (bearing+combinations+resolver). +8 settings = **19 GREEN**.

### Providers / settings / wiring
- `codes/structural-code-types.ts` — `FootingDesignFactors { combination }` + `StructuralCodeProvider.footingDesignFactors()`.
- `eurocode-provider.ts` + `greek-legacy-provider.ts` — `footingDesignFactors()` (γ_G=1.35, γ_Q=1.5).
- `structural-settings.ts` — `soilBearingCapacityKpa?` + resolver (omit-when-invalid).
- `structural-settings-store.ts` — μεταφέρει σ_allow + setter `setSoilBearingCapacityKpa`.
- `organism/structural-organism-types.ts` — `StructuralDiagnosticCode += 'bearingInadequate'`.
- `hooks/useStructuralOrganism.ts` — καλεί `runFootingDesignChecks(entities, provider, settings.soilBearingCapacityKpa)`.

### Types & UI
- **`PadFootingParams.appliedLoad?: AppliedMemberLoad`** (foundation-types.ts) — **SSoT απόφαση: το φορτίο ζει στο ΠΕΔΙΛΟ, ΟΧΙ column** (single source, runner χωρίς graph· Slice 4 takedown θα γράφει footing.appliedLoad source='takedown'). (Αφαιρέθηκε από ColumnParams.)
- Foundation panel group **«Φορτία & Έδραση»** (pad-only): `foundation-command-keys.ts` (soilBearing/padAxialLoad/padMomentX/padMomentY + readouts bearingPMax/bearingUtilization), `foundation-structural-param.ts` (option presets + `readFoundationLoadField`/`patchFoundationLoadField`/`isFoundationLoadKey`), `foundation-structural-bridge.ts` (σ_allow→store, φορτία→params, readouts→`computeFootingDesign`), `foundation-property-fields.ts` (`PAD_LOADS_GROUP`), `FoundationPropertiesTab.tsx` (reactive σ_allow), i18n el/en.
- **Warning** ανεπάρκειας surface-άρει αυτόματα μέσω υπάρχοντος `EntityWarningsSection`.
- **Manual entry = G μόνο** (Q=0· πλήρης G/Q split = DEFER). Presets αντί free-numeric (panel=combobox-only· free-numeric input = DEFER polish).

---

## 🎯 SLICE 2 — ΤΙ ΠΡΕΠΕΙ ΝΑ ΚΑΝΕΙΣ

### Στόχος (Revit-grade, EC2 §9.8.2)
Κάμψη πεδίλου από την πίεση εδάφους → απαιτούμενος As κάτω (sagging)· σε εκκεντρότητα/αποκόλληση → As **άνω** (hogging) → **ενεργοποίηση & διαστασιολόγηση άνω σχάρας**. + warning έκκεντρου πεδίλου.

### Reuse-map (ΧΡΗΣΙΜΟΠΟΙΗΣΕ — grep πρώτα, ΜΗΝ διπλασιάσεις)
- **`PadReinforcement.topMesh?`** (`reinforcement/footing-reinforcement-types.ts`) — **ΥΠΑΡΧΕΙ ΗΔΗ**· compute/2Δ/3Δ/detail/panel το χειρίζονται. **Το κενό = ο suggester δεν το προτείνει ποτέ.**
- **`suggest-reinforcement.ts`** → `suggestFootingReinforcementFrom` **pad branch** (γρ. ~252): παράγει μόνο bottomMeshX/Y. `resolveMatMesh(asPerMetre, seedDia, maxSpacing)` = SSoT sizing σχάρας. `suggestSlabFoundationReinforcementFrom` (raft) ΗΔΗ δίνει top=bottom=min mesh → **mirror το** για το pad top.
- **`structural-code-types.ts`** → `FootingReinforcementLimits` (πρόσθεσε `padTopMeshMinThicknessMm` + `padTopMeshKernRatio`)· `PadSectionContext` (πρόσθεσε `eccentricityRatio?`). 2 providers δίνουν τιμές (EC: 600mm / 1/6).
- **`section-context.ts`** → `buildFootingSectionContext(footing)` pad branch: υπολόγισε `eccentricityRatio` από `footing.params.appliedLoad` (e=M/N, ratio=max(e_x/W, e_y/L) με SLS combine). `buildFoundationReinforcePatch` ΗΔΗ καλεί `suggestFootingReinforcement` → auto-reinforce θα συμπεριλάβει topMesh αυτόματα.
- **`footing-design/`** → νέο `footing-flexure.ts` (As_bottom/As_top/hoggingGoverns από πίεση εδάφους + ULS) + πρόσθεσε `flexure` στο `FootingDesignResult` + orchestrator. Reuse `concreteFcdMpa`/`rebarFydMpa`/`barAreaMm2`.
- **`footing-design-checks.ts`** → νέο `padEccentricHogging` (warning) όταν e>kern (από flexure result).
- **`organism/structural-organism-types.ts`** → `StructuralDiagnosticCode += 'padEccentricHogging'`.

### Σχέδιο (κανόνας ενεργοποίησης top-mesh)
- **Με φορτίο (e>kern):** flexure → hoggingGoverns → topMesh (sized από As_top ή min mesh).
- **Χωρίς φορτίο:** geometric κανόνας στον suggester pad branch → `thickness ≥ padTopMeshMinThicknessMm` (skin EC2 §9.7) **Ή** `eccentricityRatio > padTopMeshKernRatio` (kern). topMesh = min mesh (mirror raft).
- **Default 1.5×1.5×0.5 concentric → ΚΑΜΙΑ άνω σχάρα** (0.5<0.6 & e=0) → **μηδέν regression** (κρίσιμο — verify με jest).

### Παραδοτέα
jest (flexure + top-mesh rule on/off + eccentricity + μηδέν-regression default pad) · ADR-464 §3 slices + §5 changelog + status header · `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` · MEMORY (`project_adr464_advanced_footing_design.md` + index) · ΕΝΑ tsc (N.17) · `git add` ΜΟΝΟ δικά σου.

---

## 📋 ΥΠΟΛΟΙΠΑ SLICES (μετά το 2)
- **Slice 3:** Punching (EC2 §6.4) + one-way shear + diagnostics (`punchingInadequate`/`oneWayShearInadequate`). Χρειάζεται column dims → resolve supporting column μέσω organism FK (`footing-bearing` edge / `footingId`).
- **Slice 4:** Tributary load takedown (επιφάνεια ευθύνης κολόνας × ορόφους × area loads + ίδιο βάρος) → γράφει `footing.appliedLoad` source='takedown'. + EN1990 combinations ήδη έτοιμα. Building-level `AreaLoadSettings`.
- **Slice 5:** Raft (slab-foundation) bearing parity + detail-sheet design summary.
- **DEFER (ξεχωριστά ADR):** πλήρες FEM analysis engine· σεισμικοί συνδυασμοί EC8· settlement εδάφους· πλήρης G/Q split στο UI· free-numeric input.

## 🔑 Reference
- ADR: `docs/centralized-systems/reference/adrs/ADR-464-advanced-footing-reinforcement.md`
- Memory: `~/.claude/projects/C--Nestor-Pagonis/memory/project_adr464_advanced_footing_design.md`
