# HANDOFF — Structural Organism: Phase 4c (Organism Reinforcement Continuity) → 4d (warnings + auto-apply)

**Ημερομηνία:** 2026-06-15
**Συντάκτης:** Opus 4.8 (συνεδρία Phase 4b)
**Θέμα νέας συνεδρίας:** **Phase 4c — η ΚΑΡΔΙΑ του ADR-459.** Ο αυτόματος οπλισμός να υπολογίζεται σαν **ΕΝΑΣ ενιαίος στατικός οργανισμός**: προεκτάσεις / ματίσεις / αγκυρώσεις / αναμονές (dowels) **αμφίδρομα** στις συνδέσεις του graph — πρότυπο **Revit Structural / Analytical Rebar coupling (lap & anchorage σε joints)**. **FULL ENTERPRISE + FULL SSoT + Revit-grade.**

> ⚠️ **ΓΛΩΣΣΑ:** Απαντάς ΠΑΝΤΑ Ελληνικά (CLAUDE.md LANGUAGE RULE).
> ⚠️ **COMMIT:** Ο Giorgio κάνει τα commit/push, ΟΧΙ εσύ. Ποτέ `git commit`/`push` χωρίς ρητή εντολή (N.(-1)).
> ⚠️ **SHARED WORKING TREE:** Δουλεύει κι άλλος agent ταυτόχρονα. `git add` ΜΟΝΟ τα δικά σου αρχεία — ΠΟΤΕ `git add -A`.
> ⚠️ **TSC (N.17):** Πριν τρέξεις `tsc` έλεγξε ότι δεν τρέχει ήδη άλλος (Get-CimInstance node.exe …*tsc*). Ένα tsc τη φορά.
> ⚠️ **MODEL (N.14):** architecture/cross-cutting → **Opus**. Δήλωσέ το.

---

## ΜΕΡΟΣ 0 — UNCOMMITTED ΑΠΟ ΤΙΣ ΠΡΟΗΓΟΥΜΕΝΕΣ ΣΥΝΕΔΡΙΕΣ

- **Phase 0+1+2 = COMMITTED `f23becb8`** (graph + «λείπει το πέδιλο» + explicit FK κολόνα↔πέδιλο).
- **Phase 4a (beam) + 4b (footing) reinforcement = DONE, UNCOMMITTED** — **177 structural jest GREEN, tsc-clean** (touched files). Ο Giorgio θα κάνει browser-verify + commit.

**Αν δεν έγινε ακόμη commit, `git add` ΜΟΝΟ αυτά (4a+4b, shared tree):**
- NEW `src/subapps/dxf-viewer/bim/structural/reinforcement/beam-reinforcement-types.ts`, `beam-reinforcement-compute.ts` (+2 `__tests__`)
- NEW `…/bim/structural/reinforcement/footing-reinforcement-types.ts`, `footing-reinforcement-compute.ts` (+2 `__tests__`)
- MOD `…/bim/structural/codes/structural-code-types.ts`, `suggest-reinforcement.ts`, `eurocode-provider.ts`, `greek-legacy-provider.ts`
- MOD `…/bim/types/beam-types.ts`, `beam.schemas.ts`, `foundation-types.ts`, `foundation.schemas.ts`
- DOC `docs/centralized-systems/reference/adrs/ADR-459-structural-organism-connectivity.md` (§6c/§6d + changelog v3/v4), `…/adr-index.md`, `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`

> 💡 Ιδανικά το 4c χτίζεται **πάνω σε committed 4a/4b**. Αν δεν έχει γίνει commit, λειτουργεί κανονικά στο ίδιο working tree — απλά πρόσεξε το `git add` ΜΟΝΟ δικά σου.

---

## ΜΕΡΟΣ 1 — GROUND TRUTH (διάβασε ΠΡΙΝ κώδικα — code = source of truth, N.0.1)

### Ο DERIVED graph (Phase 0-2, COMMITTED) — `bim/structural/organism/`
- **`structural-organism-types.ts`** (ακριβή symbols):
  - `StructuralNode { id, memberKind:'footing'|'column'|'beam', entityType, footprint?, axis?, supportType?, footingId?, baseZmm, topZmm }`.
  - `StructuralEdge { id:'${supportId}->${supportedId}:${kind}', supportId, supportedId, kind }` — **κατεύθυνση = load-path**: `supportId`=κάτω/στηρίζον, `supportedId`=άνω/στηριζόμενο.
  - `StructuralConnectionKind = 'footing-bearing' | 'column-bearing' | 'top-attachment'`.
  - `StructuralGraph { nodes, edges }`.
- **`structural-graph.ts`** → `buildStructuralGraph(entities: readonly Entity[]): StructuralGraph` (DERIVED, ΠΟΤΕ persisted). REUSE `resolveColumnBaseZmm` κ.ά. **Ο graph ΔΕΝ φέρει reinforcement** — τα node carry geometry/Z/FK μόνο. Το reinforcement διαβάζεται από τα entities (params.reinforcement).
- **`organism-checks.ts`** → `const CHECKS: ReadonlyArray<(g: StructuralGraph) => StructuralDiagnostic[]>` + `runOrganismChecks(graph): StructuralDiagnostic[]`. **Επεκτείνεται registry-style στο 4d.**
- Surfacing: `structural-diagnostics-store.ts` (low-freq, ADR-040-safe) + `useEntityStructuralDiagnostics.ts` + shell `hooks/useStructuralOrganism.ts` (ακούει structural events, coalesced recompute, emit `bim:structural-organism-updated`) + generic `ui/structural-warnings/EntityWarningsSection.tsx`.

### Reinforcement subsystem (κολόνα + δοκάρι + πέδιλο — Phase 4a/4b)
- **Data models (persisted intent):** `reinforcement/column-reinforcement-types.ts` (`ColumnReinforcement`: longitudinal{Ø,count}+stirrups+cover+crossTiePattern), `beam-reinforcement-types.ts` (`BeamReinforcement`: bottom+top layers+stirrups+cover), `footing-reinforcement-types.ts` (`FootingReinforcement` discriminated: pad mesh / strip / **tie-beam extends BeamReinforcement**).
- **Compute (derived μήκη/βάρος/ρ):** `column-reinforcement-compute.ts`, `beam-reinforcement-compute.ts`, `footing-reinforcement-compute.ts`. **🚨 ΚΑΙ ΤΑ ΤΡΙΑ έχουν flat `const LONGITUDINAL_LAP_FACTOR = 50` (× Ø)** προστιθέμενο στο καθαρό μήκος ράβδου. **ΑΥΤΟ ΑΝΤΙΚΑΘΙΣΤΑΤΑΙ από την οργανική συνέχεια όπου υπάρχει πραγματικό joint.** (footing pad mat έχει ΚΑΙ `MAT_END_ANCHORAGE_FACTOR=12·Ø` τελικούς γάντζους.)
- **Persisted intent στα params:** `ColumnParams.reinforcement?`, `BeamParams.reinforcement?`, `FoundationParams.reinforcement?` (per-kind). Όλα optional/non-breaking.

### Code providers — SSoT limits + suggest
- `codes/structural-code-types.ts` — **`StructuralCodeProvider` interface**: column/beam/footing limits + suggesters + contexts (`ColumnSectionContext`/`BeamSectionContext`/`FootingSectionContext` discriminated). **ΕΔΩ προσθέτεις `lapLengthMm` + `anchorageLengthMm` (4c).**
- `codes/eurocode-provider.ts` (EC2/EC8 + Greek NA, σεισμός→EC8 DCM), `codes/greek-legacy-provider.ts` (ΕΚΩΣ 2000 + ΕΑΚ 2003, συντηρητικότερα). **Κάθε νέα μέθοδος interface → υλοποίηση ΚΑΙ στους 2.**
- `codes/suggest-reinforcement.ts` — SSoT επιλογής ράβδων: `resolveBarSet` (count-based), `resolveMatMesh` (spacing-based), `suggest{Column|Beam|Footing}ReinforcementFrom`.
- `codes/index.ts` — `resolveStructuralCode(id)` → provider. `rebar-catalog.ts` (`barAreaMm2`, `barMassPerMeterKg`, `nextRebarDiameterMm`, B500C, `REBAR_FYK_MPA`, `rebarFydMpa`), `concrete-grades.ts`, `structural-settings.ts` (building-level code selection SSoT).

### 🚨 ΜΑΘΗΜΑΤΑ-ΚΛΕΙΔΙΑ (Phase 2/4a/4b)
1. **`column.schemas.ts` + `beam.schemas.ts` + `foundation.schemas.ts` είναι ΟΛΑ `.strict()`.** Κάθε νέο **persisted** πεδίο → +Zod schema αλλιώς silent reject στο persist/load. **ΑΛΛΑ: το 4c είναι DERIVED — ΔΕΝ προσθέτει persisted πεδία, άρα ΔΕΝ αγγίζει schemas** (αν χρειαστείς persisted κάπου → σταμάτα, είναι λάθος).
2. **Reinforcement intent = persisted· continuity (ματίσεις/αναμονές/αγκυρώσεις) = DERIVED, ΠΟΤΕ persisted** (φιλοσοφία graph/ADR-458).
3. **SSoT bar-selection** = `resolveBarSet`/`resolveMatMesh`. **SSoT lap/anchorage** = ΝΕΕΣ provider μέθοδοι (4c) — αντικαθιστούν το flat 50·Ø σε ΟΛΑ τα compute.

---

## ΜΕΡΟΣ 2 — PHASE 4c: ORGANISM REINFORCEMENT CONTINUITY (ο σχεδιασμός)

**Στόχος (Revit-grade):** για κάθε στατική σύνδεση του graph, να παράγονται **αμφίδρομα** οι αναγκαίες προεκτάσεις οπλισμού (dowels/αναμονές, ματίσεις ορόφου, αγκυρώσεις στον κόμβο), ώστε το takeoff κάθε μέλους να αντανακλά τον **ΕΝΙΑΙΟ οργανισμό** — όχι μεμονωμένα στοιχεία με flat 50·Ø. Πρότυπο: Revit rebar coupling / lap & anchorage σε joints (EC2 §8.4/§8.7, EC8 §5.6 beam-column joints).

### 1. Lap/anchorage SSoT στον provider (αντικαθιστά το flat `LONGITUDINAL_LAP_FACTOR`)
Πρόσθεσε στο `StructuralCodeProvider` (interface + ΚΑΙ στους 2 providers):
```ts
/** Προαιρετικό context ανάπτυξης ράβδου (συνθήκες συνάφειας/σκυρόδεμα). */
export interface BarDevelopmentContext {
  readonly concreteGrade?: string;        // π.χ. 'C25/30' — αν absent → default code grade
  readonly bondCondition?: 'good' | 'poor'; // EC2 §8.4.2 — default 'good'
  readonly inTension?: boolean;           // default true (δυσμενέστερο)
}
/** EC2 §8.7.3 μήκος ματίσματος l0 (mm). Eurocode ~50·Ø· legacy συντηρητικότερα ~55-60·Ø. */
lapLengthMm(diameterMm: number, ctx?: BarDevelopmentContext): number;
/** EC2 §8.4.4 μήκος αγκύρωσης lbd (mm). Eurocode ~40·Ø· legacy ~50·Ø. */
anchorageLengthMm(diameterMm: number, ctx?: BarDevelopmentContext): number;
```
- **Μοντέλο:** simplified `factor·Ø` (κατηγοριοποιημένο ανά bond/tension), με σχόλιο ότι το πλήρες `lb,rqd = (Ø/4)(σsd/fbd)` (fbd από fctd, EC2 §8.4.2) είναι DEFER. Χρησιμοποίησε `REBAR_FYK_MPA`/`rebarFydMpa` + concrete-grades αν θες πιο ακριβές — αλλά **κράτα το ΕΝΑ SSoT στον provider**, μηδέν διασκορπισμένα factors.
- **SSoT cleanup (N.0.2):** το flat `LONGITUDINAL_LAP_FACTOR=50` στα 3 compute → **καταργείται ως default όπου τρέχει continuity**· παραμένει ΜΟΝΟ ως isolated-member fallback (ή, ακόμη καλύτερα, ο continuity layer τροφοδοτεί το lap στο compute — βλ. §3).

### 2. NEW `organism/reinforcement-continuity.ts` (pure, DERIVED)
```ts
export type ContinuityKind = 'dowel' | 'lap' | 'anchorage';
export interface ReinforcementContinuityItem {
  readonly kind: ContinuityKind;
  readonly count: number;
  readonly diameterMm: number;
  readonly lengthMm: number;
  readonly fromMemberId: string;   // μέλος-πηγή (π.χ. κολόνα για dowel)
  readonly toMemberId: string;     // όμορο μέλος (π.χ. πέδιλο)
  readonly edgeId: string;         // back-ref στο StructuralEdge
}
export interface OrganismContinuityResult {
  /** Per-member items (αμφίδρομο: το ΙΔΙΟ item εμφανίζεται και στα δύο μέλη). */
  readonly byMember: ReadonlyMap<string, readonly ReinforcementContinuityItem[]>;
  readonly items: readonly ReinforcementContinuityItem[];
}
export function computeOrganismReinforcementContinuity(
  graph: StructuralGraph,
  entities: readonly Entity[],
  provider: StructuralCodeProvider,
): OrganismContinuityResult;
```
**Ανά edge (κατεύθυνση load-path supportId→supportedId):**
- **`footing-bearing`** (πέδιλο `supportId` → κολόνα `supportedId`): η κολόνα απαιτεί **αναμονές/dowels** από το πέδιλο. `count` = column longitudinal count, `diameterMm` = column Ø, `lengthMm` = `anchorageLengthMm(colØ)` (αγκύρωση μέσα στο πέδιλο) **+** `lapLengthMm(colØ)` (προέκταση πάνω, μάτισμα με ράβδους κολόνας). `kind:'dowel'`, `fromMemberId`=column, `toMemberId`=footing. **Το πέδιλο «μαθαίνει» ότι φιλοξενεί dowels** (item μπαίνει ΚΑΙ στο footing byMember).
- **`column-bearing`** (κολόνα `supportId` → δοκάρι `supportedId`): οι ράβδοι δοκαριού αγκυρώνονται στον κόμβο/κολόνα (EC8 §5.6.2.2). `count` = beam bottom (+top) count, `Ø` = beam Ø, `lengthMm` = `anchorageLengthMm(beamØ)`, `kind:'anchorage'`. **Αυτό αντικαθιστά το flat 50·Ø στο ΑΝΤΙΣΤΟΙΧΟ άκρο** του δοκαριού.
- **`top-attachment`** (κολόνα κάτω ορόφου → κολόνα/μέλος πάνω): **μάτισμα ορόφου** (lap splice) στη στάθμη. `count` = min(longitudinal counts), `Ø` = column Ø, `lengthMm` = `lapLengthMm(colØ)`, `kind:'lap'`.
- **Skip** edge αν λείπει reinforcement intent σε κάποιο εμπλεκόμενο μέλος (→ flag στο 4d `memberMissingReinforcement`).
- **Pure:** διαβάζει `params.reinforcement` από τα entities, ΜΗΔΕΝ mutation, ΜΗΔΕΝ persisted.

### 3. Compute integration (continuity-aware, χωρίς να σπάσει το pure compute)
- Πρόσθεσε **optional** param στα `compute{Column|Beam|Footing}ReinforcementQuantities(ctx, r, continuity?)`. Όταν δοθεί continuity → οι αντίστοιχες ράβδοι παίρνουν το **πραγματικό** μήκος joint αντί για flat 50·Ø· αλλιώς flat fallback (back-compat — όλα τα υπάρχοντα tests περνούν χωρίς αλλαγή).
- Το compute παραμένει **provider-free/pure** (ο continuity layer είναι ο provider-aware). Μηδέν cycle.

### 4. Tests (μηδέν browser)
- dowel pairing πεδίλου↔κολόνας (count/Ø/length = anchorage+lap), αμφίδρομη παρουσία (byMember και στα δύο ids).
- top-attachment lap ορόφου· column-bearing anchorage δοκαριού στον κόμβο.
- DERIVED invariant: τα entity params **δεν** μεταβάλλονται (deep-equal πριν/μετά).
- isolated μέλος → flat fallback (compute χωρίς continuity == παλιά τιμή).
- provider `lapLengthMm`/`anchorageLengthMm`: eurocode < legacy (συντηρητικότητα), monotonic στο Ø.

---

## ΜΕΡΟΣ 3 — PHASE 4d: WARNINGS + AUTO-APPLY (επόμενο μετά το 4c)
1. **Reinforcement διαγνωστικά** στο `organism-checks` registry (επέκταση `StructuralDiagnosticCode` + i18n keys el+en ΠΡΩΤΑ, N.11): `memberMissingReinforcement` (info), `ratioOutOfRange` (ρ<ρ_min ή >ρ_max), `barMismatchAtJoint` (dowel count/Ø πεδίλου↔κολόνας ή ράβδος δοκαριού δεν αναπτύσσεται). Διαβάζουν 4c continuity + per-member reinforcement → surfacing μέσω `StructuralDiagnosticsStore` + `EntityWarningsSection` (ήδη generic).
2. **Auto-apply:** NEW undoable `AutoReinforceOrganismCommand` (mirror `AttachColumnFootingCommand`): κάθε μέλος χωρίς `reinforcement` → `provider.suggest*` → set `params.reinforcement` (batch, undoable, persist via `signalEntitiesAttached`). Προαιρετικό ribbon «Αυτόματος Οπλισμός» (Ανάλυση). Emit ORGANISM_EVENTS.

---

## ΜΕΡΟΣ 4 — ENTERPRISE/SSoT ΑΡΧΕΣ (ΑΠΑΡΑΒΑΤΕΣ)
- **Continuity = DERIVED, ΠΟΤΕ persisted.** Reinforcement intent = persisted (4a/4b). Αν βρεθείς να προσθέτεις persisted πεδίο για continuity → λάθος προσέγγιση.
- **ΕΝΑ SSoT lap/anchorage** = οι 2 provider μέθοδοι (υλοποιούν ΚΑΙ οι 2 κανονισμοί). **Αντικαθιστούν** το flat 50·Ø σε column/beam/footing compute (μηδέν διασκορπισμένα factors — N.0.2).
- **Pure layers:** graph (DERIVED), continuity (pure, provider-aware), compute (pure, provider-free). Μηδέν React/DOM/Firestore στα pure modules.
- **N.7.1:** αρχεία ≤500 γρ., functions ≤40 (σπάσε per-edge handlers). **N.2:** no `any`. **N.11:** i18n keys el+en ΠΡΩΤΑ (μόνο 4d). **ADR-040 safe** (organism = discrete EventBus, όχι high-freq).
- **N.0.2 Boy Scout:** αν δεις duplicate lap/anchorage logic κάπου → centralize στον provider.

---

## ΜΕΡΟΣ 5 — ΠΡΩΤΑ ΒΗΜΑΤΑ ΝΕΑΣ ΣΥΝΕΔΡΙΑΣ
1. Διάβασε αυτό το handoff + **ADR-459** (§5/§6/§6c/§6d) + το reinforcement subsystem (ΜΕΡΟΣ 1: organism/, codes/, reinforcement/).
2. **Δήλωσε μοντέλο** (Opus).
3. **PHASE 1 (N.0.1):** διάβασε `structural-organism-types.ts` + `structural-graph.ts` + τα 3 compute (επιβεβαίωσε το flat `LONGITUDINAL_LAP_FACTOR`) + τους 2 providers. Επιβεβαίωσε ground truth.
4. **Πρότεινε plan Phase 4c** (provider lap/anchorage SSoT → `reinforcement-continuity.ts` → compute integration → tests) + ζήτα έγκριση. **ΜΗΝ γράψεις κώδικα πριν εγκρίνει ο Giorgio.** Μετά 4d (warnings+auto-apply) σειριακά με έγκριση.
5. commit = Giorgio· shared tree → `git add` ΜΟΝΟ δικά σου· ένα tsc τη φορά (N.17).

**ADR αναφορές:** ADR-459 (master), ADR-456 (στατικά/ποσότητες SSoT), ADR-458 (DERIVED geometry philosophy), ADR-436 (foundation discipline), ADR-040 (canvas perf — μην αγγίξεις high-freq).
