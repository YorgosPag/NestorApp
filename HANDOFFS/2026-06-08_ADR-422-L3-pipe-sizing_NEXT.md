# HANDOFF — ADR-422 L3: Pipe Sizing (Διαστασιολόγηση Σωληνώσεων Θέρμανσης, velocity + friction / D5)

**Ημερομηνία:** 2026-06-08
**Μοντέλο:** Opus 4.8
**Εντολή Giorgio:** «ΟΠΩΣ ΟΙ ΜΕΓΑΛΟΙ ΠΑΙΧΤΕΣ (Revit «Pipe Sizing» / 4M-FineHEAT) — **FULL ENTERPRISE + FULL SSOT**. Πλήρης συμμόρφωση.»
**Εκτέλεση:** **Plan Mode πρώτα** (πάρε ΕΣΥ τις Revit-grade αποφάσεις + ζήτα έγκριση plan· μην ρωτάς τετριμμένα standard επιλογές — [[feedback_make_revit_grade_decisions_yourself]]). Μετά υλοποίηση στρώμα-στρώμα.
**⚠️ SHARED working tree** με άλλον agent (δουλεύει ΠΑΡΑΛΛΗΛΑ στον **ΛΕΒΗΤΑ** `mep-boiler` — DHW/BOQ/3D). `git add` **ΜΟΝΟ** δικά σου αρχεία — **ΠΟΤΕ `-A`**. **COMMIT τα κάνει ο Giorgio, ΟΧΙ εσύ** (N.(-1)).
**Απάντα στα ελληνικά.**

---

## 0) ΤΙ ΘΑ ΚΑΝΕΙΣ

Υλοποίηση **L3 — Pipe Sizing** του ADR-422: παίρνεις ένα **υπάρχον** δίκτυο θέρμανσης (σωλήνες `mep-segment` + καλοριφέρ `mep-radiator` + πηγή λέβητας/συλλέκτης που έχει σχεδιάσει ο χρήστης) και **διαστασιολογείς τη διάμετρο (DN) κάθε τμήματος σωλήνα** — όπως Revit «Pipe Sizing» / 4M-FineHEAT.

**Πυρήνας (locked, ADR-422 §3 L3 / D5):**
```
ṁ_branch = Φ_downstream / (c · ΔΤ)          παροχή μάζας (kg/s) — c=ειδ. θερμότητα νερού, ΔΤ=regime
Q_branch = ṁ / ρ                            παροχή όγκου (m³/s)
DN = επιλογή ώστε ταχύτητα v ≤ v_max ΚΑΙ τριβή R ≤ R_max (Pa/m)   ← D5 «velocity + friction»
```
- `Φ_downstream` = ΣΦ ΟΛΩΝ των τερματικών (καλοριφέρ) κατάντη του τμήματος — ο κορμός κοντά στην πηγή κουβαλά το άθροισμα → μεγάλο DN· ο κλάδος προς ένα σώμα κουβαλά μόνο το `Φ_share` του → μικρό DN. **Οι διάμετροι ΜΙΚΡΑΙΝΟΥΝ προς τα τερματικά** (ίδια αρχή με την ύδρευση ADR-426).
- `ΔΤ` = το regime του συστήματος (π.χ. 75/65 → ΔΤ=10K) — **reuse το config SSoT του L2** (βλ. §2).
- `c` ≈ 4187 J/(kg·K), `ρ` ≈ 1000 kg/m³ (νερό @~70°C — config SSoT, editable).

**Αποτέλεσμα:** ο μελετητής βλέπει/εφαρμόζει τη σωστή DN ανά σωλήνα. Γράφει το `mep-segment.params.diameter` (βλ. απόφαση D-F παρακάτω).

**ΠΡΩΤΟ ΒΗΜΑ: Plan Mode** — διάβασε κώδικα (code = source of truth), σχεδίασε engine + network walk + apply/preview + UI, πάρε τις αποφάσεις, ζήτα έγκριση.

---

## 1) ΑΠΟΦΑΣΕΙΣ ΝΑ ΚΛΕΙΔΩΣΕΙΣ ΣΤΟ PLAN MODE (πρότεινε + δικαιολόγησε, μη ρωτάς τετριμμένα)

- **D-A (sizing standard):** **velocity + friction** (D5, Revit «Velocity and Friction»). Πρότεινε **pluggable `SizingStandard` interface** ΟΠΩΣ το ADR-426 (`water-sizing.ts` → `diameterForLU`)· εδώ `diameterForFlow(flowM3s)` με DN ladder + έλεγχο v_max (~1.0 m/s residential, ~1.5 m/s κορμός) και R_max (~100–150 Pa/m). Η ladder = config SSoT, swappable (μελλοντικά Colebrook/CIBSE).
- **D-B (ΔΤ source):** το regime του δικτύου. **Reuse `resolveSystemRegime` / `SYSTEM_REGIME_PRESETS` (L2 config).** ΠΡΟΣΟΧΗ: το ΔΤ_pipe = `supplyC − returnC` (π.χ. 10K), ΟΧΙ το AMTD του L2 (50/ΔΤ_actual είναι άλλο πράγμα — το L2 διορθώνει ισχύ σώματος, το L3 υπολογίζει παροχή). Μην τα μπερδέψεις.
- **D-C (network walk):** πώς αθροίζεις Φ_downstream ανά τμήμα. Πρότεινε: από `derivePipeNetworks` (τοπολογία, βλ. §2) → ρίζα = πηγή (boiler/manifold connector) → BFS/DFS από τη ρίζα· κάθε τμήμα κουβαλά το ΣΦ των τερματικών στο υποδέντρο του. Χειρίσου loops (δαχτυλίδι) τεκμηριωμένα (tree assumption v1· flag αν βρεθεί cycle).
- **D-D (supply vs return):** το δίκτυο έχει supply + return κλάδους (hydronic). Πρότεινε: διαστασιολόγηση με βάση την ίδια παροχή και στους δύο (συμμετρικό)· documented.
- **D-E (terminal load source):** **reuse `useRadiatorSizing` (L2)** για το `Φ_share` ανά καλοριφέρ → φύλλα του δέντρου. Μηδέν επανυπολογισμός φορτίου.
- **D-F (πού γράφεται η DN — ΚΡΙΣΙΜΟ SSoT):** δύο νόμιμες οδοί, **διάλεξε & δικαιολόγησε**:
  - **(A) Transient read-model + explicit «Apply»** (προτεινόμενο, Revit-true): υπολόγισε DN ως derived (mirror L1/L2 readout/overlay)· νέα ribbon action «Διαστασιολόγηση δικτύου» → γράφει `mep-segment.params.diameter` με **`UpdateMepSegmentParamsCommand`** (undoable, batch/CompoundCommand). Καθαρό SSoT: το diameter είναι input-after-apply, η πρόταση είναι derived.
  - **(B) Pure transient overlay** (καμία εγγραφή): μόνο εμφάνιση DN ανά σωλήνα (badge/readout), ο χρήστης δεν «κλειδώνει». Λιγότερο χρήσιμο.
  - **ΜΗΝ** γράφεις derived DN σιωπηλά σε κάθε render (anti-SSoT race με τον χρήστη/persistence).

---

## 2) SSoT ΘΕΜΕΛΙΟ — REUSE, ΜΗΝ FORK (επιβεβαιωμένο code)

- **Τοπολογία δικτύου:** `bim/mep-systems/mep-pipe-network-derive.ts` → `derivePipeNetworks(entities, tol)` → `PipeNetworkDraft[]` (`{ members, root connector, segments component }`, union-find στα coincident endpoints). `resolvePipeJoinTolerance(entities)` για το tol. **Αυτός είναι ο γράφος σου.**
- **Source→δίκτυο→τερματικοί:** `bim/mep-systems/mep-circuit-editor.ts` → `resolveManagedSystems(...)` (το χρησιμοποίησε το boiler L2). `bim/thermal/resolve-source-served-spaces.ts` → `resolveSourceServedSpaces` + `sumServedHeatLoadW` (πηγή→τερματικοί→χώροι→ΣΦ — reuse/extend).
- **Per-terminal φορτίο (Φ_share):** `hooks/data/useRadiatorSizing.ts` (L2 — δικό μου) → `Map<radiatorId, { shareW, requiredNominalW, ... }>`. Reuse για τα φύλλα.
- **ΔΤ regime config (L2):** `bim/thermal/sizing/radiator-sizing-config.ts` → `SYSTEM_REGIME_PRESETS` / `resolveSystemRegime` / `SystemRegimePresetId`. Το regime ζει per-radiator (`MepRadiatorParams.systemRegimePreset`) ή default 75/65.
- **Sizing-standard ΠΡΟΤΥΠΟ (ADR-426 ύδρευση):** `systems/mep-design/water/water-sizing.ts` → pluggable `SizingStandard` { `diameterForLU(sumLU)` } + DN ladder + `DIN1988_SIZING_STANDARD`. **Mirror-αρε το pattern** για velocity+friction (μην το κάνεις fork — δικό σου thermal namespace).
- **Auto-design orchestration ΠΡΟΤΥΠΟ:** `systems/mep-design/water/design-water-supply.ts` + `water-proposal-store.ts` + ghost (`MepSegmentGhostRenderer` reuse) + accept→`CompoundCommand` (ADR-426 Slice 2). Αν πας προς preview-then-apply, αυτό είναι το πρότυπο.
- **Το πεδίο που γράφεις:** `bim/types/mep-segment-types.ts` → `MepSegmentParams.diameter?` (mm, round only· υπάρχει `resolveMepSegmentSection` SSoT για width/height/diameter). Command: ψάξε `UpdateMepSegmentParamsCommand` (mirror των άλλων Update*ParamsCommand).
- **Νερό c/ρ:** ΔΕΝ υπάρχει thermal water-props config → **NEW config SSoT** (βλ. §3). (Τα 4186/4187 σε floor/wall catalogs είναι άσχετα — υλικά δόμησης.)

---

## 3) ΚΕΝΑ ΠΟΥ ΠΡΟΣΘΕΤΕΙ ΤΟ L3

1. **NEW pure config** `bim/thermal/sizing/pipe-sizing-config.ts` — `WATER_SPECIFIC_HEAT_J_KGK=4187`, `WATER_DENSITY_KG_M3=1000`, `DN_LADDER` (DN15…DN50+ με εσωτ. διαμέτρους), `MAX_VELOCITY_M_S` (branch/trunk), `MAX_FRICTION_PA_M`.
2. **NEW pure engine** `bim/thermal/sizing/pipe-sizing.ts` — `computePipeMassFlow({ loadW, deltaTK })` → kg/s· `computePipeVolumeFlow` → m³/s· `selectPipeDiameter(flowM3s, standard)` → `{ dnMm, velocityMS, frictionPaM }`. Pure, idempotent, **full unit-tests** (worked: γνωστό Φ+ΔΤ → ṁ → v → DN· έλεγχος ότι v≤v_max).
3. **NEW pure SizingStandard** `velocity-friction-standard.ts` (ή μέσα στο config) — `diameterForFlow(flowM3s)` με DN ladder + v/R guards. Mirror `water-sizing.ts`.
4. **NEW network walk** `bim/thermal/sizing/pipe-network-sizing.ts` — `sizePipeNetwork(network, terminalLoads, regime, standard)` → `Map<segmentId, { dnMm, flowM3s, velocityMS, cumulativeLoadW }>`. Reuse `derivePipeNetworks` topology + BFS από source. Pure.
5. **NEW hook** (reactive) `hooks/data/usePipeSizing.ts` — συνδυάζει scene + `derivePipeNetworks` + `useRadiatorSizing` + engine → per-segment sizing read-model. Mirror `useRadiatorSizing`.
6. **UI:** ανά απόφαση D-F — είτε per-segment overlay/readout (mirror `HeatLoadOverlay` L1) είτε ribbon action «Διαστασιολόγηση δικτύου» + `UpdateMepSegmentParamsCommand` batch. i18n el+en (keys ΠΡΩΤΑ στα locales).

---

## 4) ΜΟΝΑΔΕΣ + SSoT ΠΑΓΙΔΕΣ

- `Φ` σε **W** (J/s) — με `c` σε J/(kg·K) και ΔΤ σε **K**: `ṁ [kg/s] = Φ / (c·ΔΤ)`. ΜΗΝ μετατρέψεις σε kW κατά λάθος.
- ΔΤ_pipe = `supplyC − returnC` (regime), **ΟΧΙ** το AMTD/«50/ΔΤ» του L2 (διαφορετικό concept — L2=ισχύς σώματος, L3=παροχή).
- DN/diameter σε **mm**· το `mep-segment.params.diameter` είναι **εξωτερική** διάμετρος (δες σχόλιο type) — η ταχύτητα θέλει **εσωτερική** (config ladder = εσωτ.→εξωτ. mapping).
- `position`/endpoints σε **scene units**· οι μήκη/τριβές θέλουν **m** → χρησιμοποίησε `mmScaleFor`/`sceneToM` (ίδια παγίδα με L0/underfloor — δες `computeThermalSpaceGeometry`).
- **ΜΗΝ persist-άρεις derived DN σιωπηλά** — D-F (apply-via-command ή transient).
- **ΜΗΝ** ξαναγράψεις topology/load — reuse `derivePipeNetworks` + `useRadiatorSizing`.

## 5) ΚΑΝΟΝΕΣ ΠΟΙΟΤΗΤΑΣ (CLAUDE.md)

- **FULL ENTERPRISE + FULL SSOT**, Revit/4M-FineHEAT grade. No `any`/`as any`/`@ts-ignore`. Functions **≤40 γρ.**, code files **≤500 γρ.** (engines/config/types εξαιρούνται). Semantic HTML, no inline styles.
- **i18n SSoT:** όλα τα labels `t('...')`, keys πρώτα σε `el` **και** `en`. Numeric+unit («mm»/«m/s»/«Pa/m») επιτρέπονται (μοτίβο `HeatLoadOverlay`).
- **TSC (N.17):** ΠΡΙΝ τρέξεις `tsc` έλεγξε ότι δεν τρέχει άλλος. **PowerShell check (escaping που δούλεψε):** `powershell -NoProfile -Command 'Get-CimInstance Win32_Process | Where-Object { $_.Name -eq "node.exe" -and $_.CommandLine -like "*tsc*--noEmit*" } | Select-Object ProcessId'` (outer single-quotes· ΟΧΙ WMI `-Filter` με escaped quotes — σπάει στο bash). Αν τρέχει → **περίμενε** (PowerShell loop με `Start-Sleep`, ΟΧΙ foreground bash sleep). ΕΝΑ tsc τη φορά, background.
- **ADR-040:** το L3 πιθανότατα **ΕΚΤΟΣ** (pure engine + readout/apply). Αν προσθέσεις **overlay** στο `CanvasLayerStack` (mount, mirror `HeatLoadOverlay`) → **STAGE ADR-040** (CHECK 6B/6D).
- **N.15 (μετά):** `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + **ADR-422 changelog (L3 entry)** + memory `project_adr422_thermal_space.md` + MEMORY.md. **ΜΗΝ** `adr-index.md` (shared tree).

## 6) PENDING COMMIT (ο Giorgio θα κάνει commit — εσύ ΟΧΙ)

- **L2 radiator sizing (ΗΔΗ committed** στο shared tree, commits `8c44b8af` + `0b2c6cd8` από Giorgio/άλλο party): pure `bim/thermal/sizing/{radiator-sizing-config,radiator-sizing,space-radiator-assignment}.ts` + `hooks/data/useRadiatorSizing.ts` + tests (16/16) + UI (`mep-radiator-*`, `contextual-mep-radiator-tab`, `useRibbonMepRadiatorBridge`, **routing fix στο `useRibbonCommands.ts`**) + i18n.
- **UNCOMMITTED (για το επόμενο commit του Giorgio):** ADR-422 **L2 changelog** + το `useRibbonCommands.ts` routing fix (string+readout keys) αν δεν μπήκε στο τελευταίο commit. **Επιβεβαίωσε με `git status` στην αρχή.**
- ⚠️ Παράλληλος agent στον **λέβητα** — απομόνωση: εσύ σωλήνες/segments + νέο thermal/sizing· αυτός `mep-boiler` entity. Κοινά αρχεία ~μηδέν, αλλά `useRibbonCommands.ts` / i18n είναι shared → πρόσεξε τα δικά σου lines.

## 7) ROADMAP (μετά το L3)

L4 hydraulic balancing (Darcy-Weisbach + τοπικές αντιστάσεις → index circuit → valve presets) → **Report PDF** (reuse `bim/schedule/*` + `registerGreekFont`).

## 8) ΠΗΓΕΣ ΝΑ ΔΙΑΒΑΣΕΙΣ ΠΡΩΤΑ

- `docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md` (§2 D5, §3 L3, §4 changelog L0/L1/L2 radiator + boiler).
- memory `project_adr422_thermal_space.md` (L0+L1+L2 + μαθήματα μονάδων/SSoT).
- `systems/mep-design/water/{water-sizing,design-water-supply,water-proposal-store}.ts` (ADR-426 — το ΠΡΟΤΥΠΟ sizing + preview/apply).
- `bim/mep-systems/mep-pipe-network-derive.ts` (τοπολογία) + `bim/mep-systems/mep-circuit-editor.ts` (`resolveManagedSystems`).
- `bim/thermal/sizing/*` (L2 — config/engine/hook που καταναλώνεις) + `bim/thermal/resolve-source-served-spaces.ts`.
- `bim/types/mep-segment-types.ts` (`MepSegmentParams.diameter`, `resolveMepSegmentSection`).
- ADR-040 list στο `CLAUDE.md` (επιβεβαίωσε εκτός ή STAGE).
