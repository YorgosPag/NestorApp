# HANDOFF — ADR-475: Αυτόματη Διαστασιολόγηση Μελών (Serviceability-Driven, Revit-grade)

**Ημ/νία:** 2026-06-17 · **Από:** Opus session (έλεγχος αυτόματου δομικού σχεδιασμού) · **Γλώσσα:** ΠΑΝΤΑ Ελληνικά.
**Τύπος:** 🟢 PLAN-FIRST — νέο feature, ΔΕΝ έχει γραφτεί κώδικας ακόμη. Ξεκίνα με **plan mode + SSOT grep**.
**Shared working tree** με άλλον agent (ADR-471/473 joint reinforcement) — **git add ΜΟΝΟ τα δικά σου, ΠΟΤΕ -A**.
**commit/push = Giorgio** (ΟΧΙ ο agent). **tsc = Giorgio** (N.17, ένα tsc τη φορά). **jest = τρέχει κανονικά.**

---

## 0. ΤΟ ΟΡΑΜΑ (Giorgio, επιβεβαιωμένο 2026-06-17)

> «Ο μηχανικός σχεδιάζει γεωμετρία — τίποτε άλλο. Φορτία + ροπές + οπλισμός + πέδιλα + **διαστάσεις μελών** =
> αυτόματα, Revit-grade. Πλήρης αυτοματοποίηση· ο μηχανικός μπορεί να επεμβαίνει, αλλά **όσο το δυνατόν
> λιγότερο ή καθόλου**.»

Σήμερα αυτόματα είναι: φορτία (ADR-467), ροπές κολόνας (ADR-472 S4), οπλισμός (ADR-471/459), **μέγεθος πεδίλου**
(ADR-464, `suggest-pad-dimensions.ts` — το πέδιλο **ήδη** μεγαλώνει μόνο του από το φορτίο, `autoDesigned:true`).
**ΛΕΙΠΕΙ:** η αυτόματη διαστασιολόγηση **δοκαριών** (και αργότερα κολόνων) — η διατομή μένει όπως τη σχεδίασε ο
μηχανικός, ακόμη κι αν είναι **ανεπαρκής**.

---

## 1. ΤΟ ΕΥΡΗΜΑ ΠΟΥ ΓΕΝΝΗΣΕ ΤΟ ADR-475 (τεκμηριωμένο από κώδικα + βάση)

**Test model στη βάση:** κάναβος 10×10 m, 4 γωνιακές κολόνες 400×400, 4 δοκάρια που τις ενώνουν, κτίριο 3 ορόφων,
`residential` (φορτία από `building.category`: g_k 7.5 / q_k 2.0 kPa).

Τα 4 δοκάρια προέκυψαν **250×500 mm, καθαρό άνοιγμα 9.6 m**, με:
- **appliedLoad** G 215.75 / Q 50.0 kN — ✅ **σωστά** (=25 m²×1 όροφο×(7.5/2.0) + ίδιο βάρος 28.25 kN).
- **οπλισμός** κάτω 4Ø32 / άνω 2Ø25 / Ø8-250 — ✅ **σωστά υπολογισμένος** (EC2 κάμψη: M_Ed=w·L²/8≈439 kNm,
  A_s≈2490 mm² → 4Ø32). Ο `asStrengthBeamMm2` δουλεύει swspan-aware.
- **`hasCodeViolations: false`** ❌ **ΛΑΘΟΣ ΣΙΩΠΗ.**

**Γιατί είναι λάθος (EC2 §7.4.2 — λειτουργικότητα/βέλος):**
- **L/d = 9600/450 = 21.3**. Όριο EC2 για αμφιέρειστη με ρ≈2.86% είναι **~11–14** → το δοκάρι **κόβεται χοντρά
  σε βέλος**. Δεν γίνεται κανένας τέτοιος έλεγχος.
- Εμπειρικό ύψος: L/12…L/10 → **~800–960 mm**. Τα 500 mm είναι ~60% του απαιτούμενου.
- **ρ = 2.86%** — οριακά κάτω από ρ_max=4% (αντιοικονομικό, στριμωγμένο).

**Συμπέρασμα:** ο οπλισμός είναι σωστός *για τη διατομή που δόθηκε*, αλλά **καμία βαθμίδα δεν λέει στον μηχανικό
ότι η διατομή είναι ανεπαρκής, ούτε τη μεγαλώνει**. Αυτό είναι το «δεν το κάνουμε όπως ο Revit/Robot».

---

## 2. ΤΙ ΝΑ ΦΤΙΑΞΕΙΣ (ADR-475 — Revit-grade, Full SSoT)

**Στόχος:** αυτόματη διαστασιολόγηση δοκαριού (depth, ίσως width) ώστε να ικανοποιεί **ULS κάμψη/διάτμηση + SLS
βέλος**, με **override** του μηχανικού (lock). Πλήρης αυτοματοποίηση, ελάχιστη επέμβαση.

### Αρχιτεκτονική πρόταση (επικύρωσέ την στο plan)
1. **ΝΕΟ SSoT module** (δικό σου, π.χ. `bim/structural/sizing/member-sizing.ts` ή `beam-sizing.ts`):
   pure function `suggestBeamSection(ctx, codeProvider) → {depthMm, widthMm}` που επιστρέφει **ελάχιστη επαρκή
   διατομή** ικανοποιώντας:
   - SLS span/effective-depth (EC2 §7.4.2, Table 7.4N — K ανά supportType: αμφιέρειστη 1.0 / ακραίο φάτνωμα 1.3 /
     εσωτερικό 1.5 / πρόβολος 0.4),
   - ULS ρ ≤ ρ_max (αλλιώς αύξησε ύψος),
   - διάτμηση V_Rd,max (θλιπτήρας — section adequacy).
   - **Στρογγύλεμα** σε constructible βήμα (π.χ. 50 mm).
2. **REUSE (μηδέν duplicate, N.0.2):**
   - `codes/suggest-reinforcement.ts`: `asStrengthBeamMm2`, `spanMomentDivisor`, `BEAM_LEVER_ARM_FACTOR`,
     `BEAM_EFFECTIVE_DEPTH_FACTOR`, `resolveBarSet`, ρ_min/limits μέσω `provider.beamReinforcementLimits`.
   - `codes/structural-code-types.ts`: `BeamSectionContext` (έχει ήδη `spanMm`, `depthMm`, `widthMm`,
     `supportType`, `designLineLoadKnM`). **ΕΠΕΚΤΕΙΝΕ** το `StructuralCodeProvider` με serviceability
     l/d-limits (νέα method, π.χ. `beamSpanDepthLimit(ctx)`), υλοποίηση και στους **δύο** providers
     (`eurocode-provider.ts` + `greek-legacy-provider.ts`).
   - **`footing-design/suggest-pad-dimensions.ts` = ΤΟ ΠΡΟΗΓΟΥΜΕΝΟ** auto-sizing pattern. Μίμησέ το
     (`autoDesigned` flag, iterate-until-adequate). ΙΔΙΑ φιλοσοφία.
   - `section-context.ts`: εκεί χτίζεται το `BeamSectionContext` + παράγεται το `designLineLoadKnM` από
     `appliedLoad`/span. **Επιβεβαίωσε** πώς (w = (G+Q)/span; ULS συντελεστές EN1990).
3. **Override / lock (Revit-grade):** νέο flag στα `BeamParams` (π.χ. `sizeLocked?: boolean` ή reuse
   `autoDesigned` σαν το πέδιλο). Όταν ο μηχανικός αλλάξει χειροκίνητα depth/width → **lock** → η auto-size
   σταματά για αυτό το μέλος (idempotent, belt-and-suspenders). Default = auto.
4. **Pipeline & σύγκλιση (ΚΡΙΣΙΜΟ):** αύξηση ύψους → ↑ίδιο βάρος → ↑φορτίο → ίσως ↑ύψος. Χρειάζεται
   **iteration + convergence guard** (μίμησε το `materiallyDiffers` του ADR-472 S3). Σειρά:
   `geometry → loads (takedown) → member-sizing → re-loads αν άλλαξε διατομή → reinforcement → footing`.
   Το proactive wiring: δες `hooks/useProactiveStructuralLoads.ts` + `useStructuralLoadTakedown.ts` (δικά σου)·
   πιθανώς νέο `useProactiveMemberSizing` ή επέκταση του υπάρχοντος proactive hook. **ΠΡΟΣΟΧΗ:** μην αλλάξεις
   σιωπηλά γεωμετρία που κλείδωσε ο χρήστης.
5. **Belt-and-suspenders violation:** ΑΚΟΜΗ κι αν auto-size, κράτα code-violation όταν locked/override = ανεπαρκές.
   ⚠️ Αυτό ζει στο **`organism/reinforcement-checks.ts` = §2β (ΑΛΛΟΣ AGENT)** — βλ. §4. ΜΗΝ το επεξεργαστείς
   μόνος σου· είτε συνεννόηση, είτε βάλε τον έλεγχο σε **δικό σου** layer (sizing/loads) και ζήτα από τον άλλον
   agent/Giorgio το wiring στο `hasCodeViolations`.

### Scope ερωτήσεις για το plan (απάντησέ τες με Revit-grade κρίση, ζήτα μόνο έγκριση):
- **(α)** Auto-size **depth μόνο** (κράτα width = αρχιτεκτονική επιλογή μηχανικού) ή **depth + width**;
  Revit-grade default: depth από span (L/12), width μόνο αν χρειαστεί για διάτμηση/χωρητικότητα ράβδων.
- **(β)** Μέλη: **δοκάρια ΤΩΡΑ**· σχεδίασε το SSoT generic ώστε να επεκταθεί σε **κολόνες** (slenderness EC2 §5.8 +
  axial) σε επόμενο slice. ΜΗΝ κάνεις κολόνες τώρα (scope creep).
- **(γ)** Βήμα στρογγυλέματος ύψους (προτείνω 50 mm) + ελάχιστο/μέγιστο πρακτικό.

---

## 3. ΚΑΤΑΣΤΑΣΗ ΒΑΣΗΣ (Firestore — fixture επαλήθευσης, ΣΩΣΤΟ SSoT state, ΜΗΝ το «διορθώσεις»)

- **Building** `bldg_58f47bf1-4d41-4276-9929-bed8f1aa1a9d` («Κτήριο Α1»): `structuralSettings = {codeId: greek-legacy,
  defaultConcreteGrade: C25/30, soilBearingCapacityKpa: 300}`. **Τα kPa είναι σκόπιμα ΣΒΗΣΤΑ** — τα φορτία
  παράγονται από `category: residential` (7.5/2.0). **ΜΗΝ επαναφέρεις kPa.** `foundationDepth:1`, 3 όροφοι.
- **Level** «Ισόγειο» `lvl_21982f3b-ecbe-46b0-b357-d13dbfb8d656`, floorId `flr_215e39f3-d958-4f97-ac59-6639131767d1`,
  project `proj_12788b6a-ea19-41cd-90a0-a340e6bacaab`, company `comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757`,
  `showReinforcement: true`.
- **Collections:** `floorplan_columns` (4), `floorplan_beams` (4), `floorplan_foundations` (4),
  `floorplan_grid_guides` (3).
- **Baseline τιμές (για regression):**
  - Κολόνες 400×400: G/Q **596.40/150.0**, 8Ø16+Ø8/225, πέδιλο 1.6×1.6×0.5 (κάτω σχάρα Ø12/150). **Αμετάβλητες**
    μετά τα δοκάρια (Revit tributary mode, μηδέν double-count — σωστό).
  - Δοκάρια 250×500, span 9.6m: G/Q **215.75/50.0**, 4Ø32/2Ø25/Ø8-250, `hasCodeViolations:false` (← το προς
    διόρθωση).
- **MCP Firestore tools** διαθέσιμα (ToolSearch: `mcp__firestore__firestore_query/get_document/update_document`).
  **Έλεγχος επιτυχίας:** μετά το feature, ξανα-σχεδίασε/τρέξε proactive → το δοκάρι πρέπει να **μεγαλώσει ύψος
  ~800 mm** (L/d ≤ όριο) και ο οπλισμός να πέσει σε λογικό ρ (~1%), `hasCodeViolations:false` πλέον **νόμιμα**.

---

## 4. ΑΡΧΕΙΑ — git add ΜΟΝΟ ΔΙΚΑ ΣΟΥ (shared tree)

**Δικά σου (loads/codes/sizing/hooks/docs) — ενδεικτικά, επιβεβαίωσε στο plan:**
```
src/subapps/dxf-viewer/bim/structural/sizing/member-sizing.ts            (NEW — το core)
src/subapps/dxf-viewer/bim/structural/sizing/__tests__/*.test.ts         (NEW)
src/subapps/dxf-viewer/bim/structural/codes/suggest-reinforcement.ts     (M? — αν εκθέσεις helper)
src/subapps/dxf-viewer/bim/structural/codes/structural-code-types.ts     (M — νέα provider method)
src/subapps/dxf-viewer/bim/structural/codes/eurocode-provider.ts         (M — l/d limit)
src/subapps/dxf-viewer/bim/structural/codes/greek-legacy-provider.ts     (M — l/d limit)
src/subapps/dxf-viewer/bim/structural/section-context.ts                 (M — αν χρειαστεί)
src/subapps/dxf-viewer/bim/types/beam-types.ts                           (M — sizeLocked/autoDesigned flag)
src/subapps/dxf-viewer/hooks/useProactiveStructuralLoads.ts              (M — wiring sizing)
src/subapps/dxf-viewer/hooks/useStructuralLoadTakedown.ts                (M — αν χρειαστεί)
docs/centralized-systems/reference/adrs/ADR-475-auto-member-sizing.md    (NEW)
docs/centralized-systems/reference/adr-index.md                          (M — shared, πρόσεξε)
local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt                                                   (M — πρόσθεσε 🔴 ADR-475)
```
**ADR αρίθμηση:** newest = ADR-474 (occupancy), ADR-473 = άλλος agent → **επόμενο ελεύθερο = ADR-475**.

### 4β. 🚫 ΜΗΝ αγγίξεις/stage-άρεις (άλλος agent — ADR-471/473 joint reinforcement)
`ADR-471-*.md`, `ADR-473-*.md`, `bim-3d/converters/joint-rebar-3d.ts`, `bim-3d/scene/bim-scene-joint-rebar-sync.ts`,
`bim-3d/scene/bim-scene-point-syncs.ts`, `bim-3d/scene/BimSceneLayer.ts`,
`bim/columns/column-structural-attach-coordinator.ts`, `bim/structural/organism/joint-reinforcement-quantities*.ts`,
**`bim/structural/organism/reinforcement-checks.ts`** (← εδώ ζει το `hasCodeViolations` — ΘΕΛΕΙ συνεννόηση για το
belt-and-suspenders violation), `bim/structural/organism/structural-graph.ts`,
`bim/structural/__tests__/active-member-reinforcement.test.ts`.

---

## 5. ΚΑΝΟΝΕΣ (ΑΠΑΡΑΒΑΤΟΙ)
- **ADR-driven (N.0.1):** PHASE 1 πρώτα — διάβασε **τον τρέχοντα κώδικα** (Grep/Glob/Read), σύγκρινε με ADR,
  ενημέρωσε ADR αν αποκλίνει, μετά plan. Code = source of truth.
- **Full Enterprise + Full SSoT, Revit-grade.** Μηδέν `any`/`as any`/`@ts-ignore`/inline styles/hardcoded strings.
  REUSE υπάρχοντα SSoT (suggest-reinforcement helpers, code providers, suggest-pad-dimensions pattern). ΜΗΝ
  διπλασιάσεις μηχανική.
- **GOL (N.7):** ≤40 γρ/function, ≤500 γρ/file (εκτός types/config), idempotent, μηδέν race, optimistic, declare
  Google-level στο τέλος.
- **ΟΧΙ commit/push (Giorgio).** **ΟΧΙ tsc (Giorgio, N.17 — ένα tsc τη φορά).** jest OK.
- **Shared tree:** git add ΜΟΝΟ δικά σου (§4), ΠΟΤΕ -A, ΜΗΝ αγγίξεις §4β.
- **ΜΗΝ επαναφέρεις kPa** στο building (§3) — τα φορτία οδηγούνται από `category`.
- **Γλώσσα: Ελληνικά πάντα.**
- **Μετά την υλοποίηση (N.15):** ενημέρωσε `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (🔴 ADR-475, μόνο τι εκκρεμεί) + ADR-475
  changelog + adr-index + MEMORY (project entry).

## 6. ΣΧΕΤΙΚΑ
- ADR-467 (load path), ADR-472 (load-aware strength + S4 moment), ADR-474 (occupancy loads), ADR-464
  (footing auto-design — το sizing precedent), ADR-471/459 (member reinforcement — άλλος agent).
- MEMORY: `reference_structural_quantities_ssot.md`, `project_adr472_load_aware_strength.md`,
  `project_adr474_occupancy_auto_loads.md`, `project_adr464_advanced_footing_design.md`.
- Προηγούμενο handoff (context): `HANDOFFS/HANDOFF_2026-06-17_ADR-472-S4_ADR-474-auto-structural-design.md`.
