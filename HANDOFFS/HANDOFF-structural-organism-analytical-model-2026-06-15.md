# HANDOFF — Structural Organism / Analytical Connectivity Model (Revit-grade)

**Ημερομηνία:** 2026-06-15
**Συντάκτης:** Opus 4.8 (προηγούμενη συνεδρία)
**Θέμα νέας συνεδρίας:** Νέο μεγάλο subsystem — οι συνδεδεμένες οντότητες BIM (πέδιλο → κολόνα → δοκάρι) να αντιμετωπίζονται ως **ΕΝΑΣ στατικός οργανισμός**, με cross-entity validation («λείπει πέδιλο», «μικρή διατομή»), προτάσεις διατομών & αυτόματο οπλισμό. **Full enterprise + full SSoT + Revit-grade.**

> ⚠️ **ΓΛΩΣΣΑ:** Απαντάς ΠΑΝΤΑ στα Ελληνικά (κανόνας CLAUDE.md).
> ⚠️ **COMMIT:** Ο Giorgio κάνει τα commit, ΟΧΙ εσύ. Μην κάνεις `git commit`/`push` ποτέ χωρίς ρητή εντολή.
> ⚠️ **SHARED WORKING TREE:** Δουλεύει κι άλλος agent ταυτόχρονα στο ίδιο repo. `git add` ΜΟΝΟ τα δικά σου αρχεία — ΠΟΤΕ `git add -A`.
> ⚠️ **TSC (N.17):** Πριν τρέξεις `tsc` έλεγξε ότι δεν τρέχει ήδη άλλος (ένα tsc τη φορά). Ο Η/Υ είναι αδύναμος.

---

## ΜΕΡΟΣ 0 — ΕΚΚΡΕΜΟΤΗΤΑ ΑΠΟ ΤΗΝ ΠΡΟΗΓΟΥΜΕΝΗ ΣΥΝΕΔΡΙΑ (ADR-458 v2 — UNCOMMITTED)

Ολοκληρώθηκε & επαληθεύτηκε στον browser (ο Giorgio είδε τη γραμμή να φτάνει στην κολόνα), **εκκρεμεί ΜΟΝΟ commit από Giorgio.** Είναι ανεξάρτητο από το νέο θέμα — μπορεί να γίνει commit όποτε θέλει.

**Τι:** ο διακεκομμένος **κεντρικός άξονας δοκαριού** καταλήγει πλέον ακριβώς στην **παρειά της κολόνας** (Revit location-line· pull-back όταν έμπαινε μέσα, extend όταν σταματούσε πριν). DERIVED, ποτέ persisted (καθρέφτης του `displayOutline`). 2Δ-only — 3Δ/BOQ αμετάβλητα. ADR-040 safe. tsc clean, 18 jest.

**Αρχεία (git add ΜΟΝΟ αυτά):**
- `src/subapps/dxf-viewer/bim/types/beam-types.ts` (νέο `geometry.displayAxisPolyline?`)
- `src/subapps/dxf-viewer/bim/geometry/beam-column-cutback.ts` (νέα pure `computeBeamAxisToColumnContact`)
- `src/subapps/dxf-viewer/hooks/canvas/dxf-scene-beam-cutback.ts` (post-pass θέτει `displayAxisPolyline`)
- `src/subapps/dxf-viewer/bim/renderers/BeamRenderer.ts` (line ~177 reads `displayAxisPolyline ?? axisPolyline`)
- `src/subapps/dxf-viewer/bim/geometry/__tests__/beam-column-cutback.test.ts` (+5 jest)
- `docs/centralized-systems/reference/adrs/ADR-458-beam-column-cutback.md` (§3.5 + changelog v2)
- `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (γραμμή 29)

> ΣΗΜ: τα **grips ΠΑΡΑΜΕΝΟΥΝ στο ορθογώνιο** — Revit-correct (editable location-line geometry, όχι το visual cut). Συνειδητή απόφαση Giorgio 2026-06-15. ΜΗΝ τα μετακινήσεις στο τραπέζιο.

---

## ΜΕΡΟΣ 1 — ΤΟ ΝΕΟ ΘΕΜΑ: ΣΤΑΤΙΚΟΣ ΟΡΓΑΝΙΣΜΟΣ

### Τι ζητάει ο Giorgio (με δικά του λόγια, αποσταγμένα)
1. Κάθε φορά που σχεδιάζει οντότητες BIM στον καμβά → να θεωρούνται **ένας οργανισμός**, όχι μεμονωμένες, ώστε να βγαίνει σωστή στατική μελέτη.
2. **Σκέτη κολόνα** → το σύστημα να λέει «**λείπει το πέδιλο**» (η κολόνα δεν στηρίζεται χωρίς βάση).
3. Βάλει πέδιλο + κολόνα από πάνω → να «κουμπώνουν» ως οργανισμός → σωστός υπολογισμός **συνολικού οπλισμού**.
4. Καρφώσει δοκάρι πάνω στην κολόνα → **πέδιλο + κολόνα + δοκάρι = ένας οργανισμός** → ενημερώνονται τα στατικά/διατομές.
5. Το σύστημα να **προειδοποιεί**: «η κολόνα έχει μικρή διατομή», «το δοκάρι δεν έχει σωστή διατομή», να **προτείνει** σωστές διατομές, και μετά να **οπλίζει**. Ο μηχανικός να μην κάνει αυθαιρεσίες.
6. Πρότυπο: **Revit / μεγάλοι παίκτες** (analytical model + structural connectivity + warnings + sizing + reinforcement).

### Honest assessment (να το πεις στον Giorgio στην αρχή)
**ΝΑΙ, καταλαβαίνω απόλυτα — και είναι η σωστή Revit-grade κατεύθυνση.** ΑΛΛΑ **ΔΕΝ είναι εύκολο/μικρό**: είναι **μεγάλο multi-phase enterprise subsystem** (στο Revit είναι ο Analytical Model + σύνδεση με Robot για sizing/reinforcement). ΟΜΩΣ τα **θεμέλια υπάρχουν ήδη** (βλ. inventory κάτω) → είναι απολύτως εφικτό **σταδιακά, ανά slice**. ΜΗΝ υποσχεθείς «όλα μαζί». Πρότεινε phased plan και ξεκίνα από το πιο χρήσιμο & εφικτό (validation «λείπει πέδιλο»).

---

## ΜΕΡΟΣ 2 — GROUND TRUTH INVENTORY (τι ΥΠΑΡΧΕΙ / τι ΛΕΙΠΕΙ)

> ⚠️ **PHASE 1 (ADR-driven N.0.1):** ΠΡΙΝ γράψεις κώδικα, **διάβασε ο ίδιος** τα παρακάτω αρχεία (CODE = source of truth· το inventory είναι snapshot 2026-06-15, μπορεί να άλλαξε από parallel agent). Επιβεβαίωσε & ενημέρωσε τα σχετικά ADR.

### ΥΠΑΡΧΕΙ (τα building blocks — REUSE, μην ξαναγράψεις):
**Structural SSoT — `src/subapps/dxf-viewer/bim/structural/`:**
- `concrete-grades.ts` — EN1992 C12/15…C50/60 (fck/Ecm/density· `concreteFcdMpa` υπάρχει αλλά unused, για strength Slice 3+).
- `rebar-catalog.ts` — B500C (Ø6–32, area/mass, `nextRebarDiameterMm`).
- `structural-settings.ts` — building-level `StructuralSettings` (codeId+defaultGrade), persisted `buildings/{id}.structuralSettings`.
- `codes/` — `StructuralCodeProvider` interface + `eurocode-provider` (EC2/EC8 DCM) + `greek-legacy-provider` (ΕΚΩΣ2000/ΕΑΚ2003) + registry `resolveStructuralCode`. + `suggest-reinforcement.ts` (Revit-grade auto-suggest: ικανοποιεί ρ_min ΚΑΙ max-bar-spacing).
- `reinforcement/` — **ΜΟΝΟ κολόνα**: `column-reinforcement-compute.ts` (bar lengths+laps, stirrups 2 critical+mid zones, cross-ties, spiral, steel weight, ρ), `column-rebar-layout.ts` (2Δ/3Δ bar geometry), `column-cross-ties.ts`, `column-confinement.ts`, `rebar-visibility.ts`. **Inputs = ΜΟΝΟ geometry/section (widthMm/depthMm/heightMm), ΚΑΘΟΛΟΥ loads** — μόνο detailing limits.
- `detail-sheet/` (ADR-457) — A3 sheet κολόνας (plan/elevation/3D/schedule/PDF).

**Validation (per-entity, ΟΧΙ cross-entity) — `bim/validators/`:**
- `column-validator.ts` (dims/slenderness/ρ_min/ρ_max + code provider), `beam-validator.ts` (width≥150, span/depth≤20, ≤10 cantilever), `foundation-validator.ts`, wall/slab/opening/stair validators.
- Κάθε BIM entity έχει `validation: BimValidation` ({hasCodeViolations, violationKeys[], lastValidatedAt}) από το `BimEntity<>` base. `DxfBeam` κ.λπ. έχουν `validation?` mirror.
- UI: `WallWarningsSection.tsx`, `StairWarningsSection.tsx` (διάβασέ τα ως pattern). **ΔΕΝ υπάρχει** Column/Beam/FoundationWarningsSection ούτε structural diagnostics panel.

**Connectivity / attach / hosting (το «κουμπώνουν» υπάρχει ήδη!):**
- `hooks/useStructuralAutoAttach.ts` — listener στο EventBus `drawing:entity-created`· νέο beam/slab → attach σε column top/base (`findColumnsToAutoAttachToHost`, `findColumnsFramedByBeam`)· νέος wall → attach σε hosts· dispatch undoable commands.
- `bim/columns/column-structural-attach-coordinator.ts` — `findColumnsFramedByBeam` (κέντρο κολώνας πάνω στον άξονα δοκαριού ±halfWidth → `topBinding='attached'`). **Το πιο κοντινό σε «structural connection» που υπάρχει.**
- `bim/hosting/hosting-strategy.ts` — `STRATEGIES {foundation,column,wall,beam,slab}` registry (ADR-441 grid hosting)· `HostingStrategy` βγάζει και `nextValidation`.
- `ColumnParams.attachTopToIds/attachBaseToIds` (FK σε hosts, persisted)· `BeamParams.supportType` ('simple'/'fixed'/'cantilever')· `BimEntity.guideBindings`.

**Foundation — `bim/types/foundation-types.ts`, `bim/foundations/` (ADR-436):**
- `FoundationKind` 'pad'|'strip'|'tie-beam'· `PadFootingParams` (position, w×l, thickness, anchor, profile flat/stepped/sloped)· strip/tie-beam line-based· `ifcType='IfcFooting'`. Foundation slab (raft) = `SlabEntity kind='foundation'`.
- Grid generation από guides, hosting, junctions, rehost commands.

### ΛΕΙΠΕΙ ΕΝΤΕΛΩΣ (αυτό είναι το νέο subsystem):
- ❌ **Structural graph / analytical model** (nodes/edges/supports/connections). Καμία έννοια «support/reaction/node». (Το μόνο graph είναι `pipe-network-graph.ts` — MEP, άσχετο.)
- ❌ **Cross-entity validation**: «κολόνα χωρίς πέδιλο», «δοκάρι χωρίς στήριξη και στα 2 άκρα», «μεμονωμένο μέλος».
- ❌ **Column ↔ Footing explicit FK** (κανένα `columnId` στο πέδιλο, κανένα `padId` στην κολόνα· μόνο implicit spatial coincidence).
- ❌ **Beam reinforcement** & **Footing reinforcement** (μόνο κολόνα υπάρχει).
- ❌ **Strength design** (M-N interaction, axial capacity) — deferred Slice 3+ στα codes.
- ❌ **Loads** (dead/live/wind/seismic), load cases, internal forces, analysis engine. Εντελώς ανύπαρκτα.

---

## ΜΕΡΟΣ 3 — ΠΡΟΤΕΙΝΟΜΕΝΟ PHASED PLAN (Revit-grade, ανά slice — ζήτα έγκριση plan από Giorgio)

> Νέο ADR απαιτείται. **Επιβεβαίωσε τον υψηλότερο υπάρχοντα ADR πριν διαλέξεις νούμερο** (το CLAUDE.md λέει «next free» αλλά είναι παρωχημένο· highest = 458 → πιθανό **ADR-459**, αλλά grep `adr-index.md` ΠΡΩΤΑ). Πιθανός τίτλος: «Structural Organism / Analytical Connectivity Model».

**Phase 0 — Structural Connectivity Graph SSoT (DERIVED, ΠΟΤΕ persisted).**
Pure module που χτίζει graph (nodes=μέλη footing/column/beam, edges=συνδέσεις support/framing) από τα ΥΠΑΡΧΟΝΤΑ FKs (`attachTopToIds/BaseToIds`, `findColumnsFramedByBeam`, spatial coincidence πεδίλου-κολόνας). Re-derive σε κάθε scene reconcile (φιλοσοφία `displayOutline`). Αυτό είναι ο «οργανισμός». **Ξεκίνα από εδώ — όλα τα υπόλοιπα διαβάζουν αυτό.**

**Phase 1 — Cross-entity validation / diagnostics (Revit warnings) — ΤΟ ΠΙΟ ΧΡΗΣΙΜΟ ΓΡΗΓΟΡΑ.**
Checks registry πάνω στο graph: «κολόνα χωρίς πέδιλο/στήριξη από κάτω», «δοκάρι χωρίς στήριξη σε άκρο», «μεμονωμένο μέλος». Surface σε **Structural Diagnostics panel** (επέκτεινε το pattern `WallWarningsSection` + φτιάξε Column/Beam/FoundationWarningsSection)· emit στο EventBus. **Αυτό υλοποιεί το «λείπει το πέδιλο».**

**Phase 2 — Column↔Footing explicit relationship.**
Πέδιλο+κολόνα συμπίπτουν → establish support FK (auto-attach style, mirror useStructuralAutoAttach). Validation «column needs footing» γίνεται hard.

**Phase 3 — Section adequacy advisories.**
«μικρή διατομή» — αρχικά geometry/detailing heuristics (slenderness, span/depth — ΥΠΑΡΧΟΥΝ ήδη στους validators)· πρόταση διατομής. Πραγματικό strength check (M-N) μόνο αφού μπουν loads (Phase 5).

**Phase 4 — Auto-reinforcement σε όλο τον οργανισμό.**
Reuse `column-reinforcement-compute` + `suggest-reinforcement`· επέκταση σε **beam reinforcement** + **footing reinforcement** (νέα modules, ίδιο pattern με κολόνα).

**Phase 5 (βαρύ, αργότερα) — Loads + analysis.**
Dead/live/seismic, load path, πραγματικά M-N checks. Στο Revit το αναθέτει στο Robot· εμείς απλοποιημένο gravity load path πρώτα. **Μην το ξεκινήσεις χωρίς ρητή εντολή — είναι ξεχωριστό μεγάλο έργο.**

### Enterprise/SSoT αρχές (απαράβατες)
- **DERIVED-never-persisted** για τον graph & τα διαγνωστικά (όπως `displayOutline`/`displayAxisPolyline`). Persisted = μόνο τα params (SSoT).
- **ADR-040 safe** (pure, zero high-freq subscriptions στους orchestrators).
- **N.7.1**: αρχεία ≤500 γρ., functions ≤40 γρ.
- **N.0.2 Boy Scout**: REUSE υπάρχοντα SSoT (codes, rebar, attach coordinator, hosting registry) — μηδέν duplicate.
- **i18n (N.11)**: όλα τα warning labels → keys σε `el/*.json` + `en/*.json` ΠΡΩΤΑ.
- **Enterprise IDs (N.6)** αν δημιουργείς Firestore docs.

---

## ΜΕΡΟΣ 4 — ΠΡΩΤΑ ΒΗΜΑΤΑ ΝΕΑΣ ΣΥΝΕΔΡΙΑΣ
1. Διάβασε αυτό το handoff + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + `docs/centralized-systems/reference/adr-index.md`.
2. **Δήλωσε μοντέλο** (N.14): αυτό είναι architecture/cross-cutting → **Opus**. Ζήτα επιβεβαίωση.
3. **PHASE 1 (N.0.1)**: διάβασε τα code αρχεία του inventory (επιβεβαίωσε ground truth), βρες/επιβεβαίωσε ADRs.
4. **Πρότεινε plan** (phased, ξεκινώντας Phase 0+1) + **ζήτα έγκριση** (Plan Mode / ExitPlanMode). ΜΗΝ γράψεις κώδικα πριν εγκρίνει ο Giorgio το plan & το ADR νούμερο.
5. Θυμήσου: commit = Giorgio· shared tree → `git add` μόνο δικά σου· ένα tsc τη φορά.
