# HANDOFF — Structural Organism: Phase 2+ (explicit FK → adequacy → reinforcement → loads)

**Ημερομηνία:** 2026-06-15
**Συντάκτης:** Opus 4.8 (συνεδρία Phase 0+1)
**Θέμα νέας συνεδρίας:** Συνέχεια του subsystem «Στατικός Οργανισμός» (ADR-459). **Phase 0 (graph) + Phase 1 (cross-entity «λείπει το πέδιλο») ΕΓΙΝΑΝ.** Σειρά: **Phase 2 = explicit FK κολόνα↔πέδιλο**, μετά Phase 3/4/5. **Full enterprise + full SSoT + Revit-grade.**

> ⚠️ **ΓΛΩΣΣΑ:** Απαντάς ΠΑΝΤΑ Ελληνικά (CLAUDE.md).
> ⚠️ **COMMIT:** Ο Giorgio κάνει τα commit, ΟΧΙ εσύ. Ποτέ `git commit`/`push` χωρίς ρητή εντολή.
> ⚠️ **SHARED WORKING TREE:** Δουλεύει κι άλλος agent ταυτόχρονα. `git add` ΜΟΝΟ τα δικά σου αρχεία — ΠΟΤΕ `git add -A`.
> ⚠️ **TSC (N.17):** Πριν τρέξεις `tsc` έλεγξε ότι δεν τρέχει ήδη άλλος. Ένα tsc τη φορά.
> ⚠️ **MODEL (N.14):** architecture/cross-cutting → **Opus**. Δήλωσέ το, ζήτα επιβεβαίωση.

---

## ΜΕΡΟΣ 0 — UNCOMMITTED ΑΠΟ ΤΗΝ ΠΡΟΗΓΟΥΜΕΝΗ ΣΥΝΕΔΡΙΑ (ADR-459 Phase 0+1)

Ολοκληρωμένο, tsc-clean, **11 jest GREEN**, **UNCOMMITTED** (browser-verify + commit από Giorgio). Ανεξάρτητο — μπορεί να γίνει commit όποτε θέλει ο Giorgio.

**git add ΜΟΝΟ αυτά (shared tree):**
- NEW `src/subapps/dxf-viewer/bim/structural/organism/structural-organism-types.ts`
- NEW `…/bim/structural/organism/structural-graph.ts`
- NEW `…/bim/structural/organism/organism-checks.ts`
- NEW `…/bim/structural/organism/structural-diagnostics-store.ts`
- NEW `…/bim/structural/organism/useEntityStructuralDiagnostics.ts`
- NEW `…/bim/structural/organism/__tests__/structural-graph.test.ts`
- NEW `…/bim/structural/organism/__tests__/organism-checks.test.ts`
- NEW `…/hooks/useStructuralOrganism.ts`
- NEW `…/ui/structural-warnings/EntityWarningsSection.tsx`
- MOD `…/ui/column-advanced-panel/ColumnAdvancedPanel.tsx` (mount EntityWarningsSection)
- MOD `…/app/DxfViewerContent.tsx` (mount useStructuralOrganism hook)
- MOD `…/systems/events/drawing-event-map-bim.ts` (event `bim:structural-organism-updated`)
- MOD `src/i18n/locales/el/dxf-viewer-shell.json` + `…/en/dxf-viewer-shell.json` (`structuralOrganism.diagnostics.*`)
- DOC `docs/centralized-systems/reference/adrs/ADR-459-structural-organism-connectivity.md`, `…/adr-index.md`, `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`

> ⚠️ **CACHE FIX (πριν browser-verify):** Είχε εμφανιστεί CSS parse error στο `globals.css:6100` (`.text-[hsl(var(${tone}))]`) — ήταν **stale Turbopack cache** (το source globals.css = 1911 γρ., καθαρό· το TSX διορθώθηκε σε στατικές Tailwind κλάσεις `TONE`). Λύση: stop dev server → `Remove-Item -Recurse -Force .next` → `npm run dev`. ΜΗΝ ξανα-βάλεις template literals ΜΕΣΑ σε Tailwind arbitrary values — το JIT δεν κάνει interpolation.

**Επίσης UNCOMMITTED & ανεξάρτητο:** ADR-458 v2 (axis-to-contact, browser-verified) — δες το παλιό handoff. Ο Giorgio λέει πότε.

---

## ΜΕΡΟΣ 1 — ΤΙ ΥΠΑΡΧΕΙ ΤΩΡΑ (ground truth μετά Phase 0+1)

> ⚠️ **PHASE 1 (ADR-driven N.0.1):** ΠΡΙΝ γράψεις κώδικα, **διάβασε ο ίδιος** τα παρακάτω (CODE = source of truth) + το **ADR-459**. Επιβεβαίωσε & ενημέρωσε.

### Ο οργανισμός (ADR-459) — `bim/structural/organism/`
- **`structural-graph.ts` → `buildStructuralGraph(entities): StructuralGraph`** — DERIVED, ΠΟΤΕ persisted. Nodes = `footing|column|beam` (foundation pad/strip/tie-beam + foundation/ground SLAB = footing). Edges: `footing-bearing` (πέδιλο→βάση κολόνας, **spatial coincidence**: plan coverage κέντρου βάσης + footing top ≤ column base), `column-bearing` (κολόνα→δοκάρι, REUSE `findColumnsFramedByBeam`), `top-attachment` (`attachTopToIds`).
- **`organism-checks.ts` → `runOrganismChecks(graph): StructuralDiagnostic[]`** — `columnMissingFooting`(error), `beamUnsupportedEnd`(warn), `memberIsolated`(warn). Registry `CHECKS[]` — επεκτείνεται εύκολα.
- **`structural-diagnostics-store.ts`** — low-freq external store (index ανά entityId), ADR-040-safe. **`useEntityStructuralDiagnostics(id)`** selector.
- **`hooks/useStructuralOrganism.ts`** — shell hook (mounted `DxfViewerContent`, δίπλα στο `useStructuralAutoAttach`): ακούει `ORGANISM_EVENTS[]`, coalesced microtask recompute → store, emit `bim:structural-organism-updated`.
- **`ui/structural-warnings/EntityWarningsSection.tsx`** — generic per-entity warnings (κολόνα/δοκάρι/πέδιλο). Mounted ΜΟΝΟ στο `ColumnAdvancedPanel` προς το παρόν.

### Building blocks (REUSE — N.0.2, μηδέν duplicate)
- **Connectivity:** `useStructuralAutoAttach.ts` (listener `drawing:entity-created`, δύο φορές: host→entities + wall→hosts), `bim/columns/column-structural-attach-coordinator.ts` (`findColumnsFramedByBeam`, `findColumnsToAutoAttachToHost`, `hostCoversColumn`), `bim/walls/wall-structural-attach-coordinator.ts` (mirror, ΚΑΙ inverse `findHostsToAttachWallTop/Base`).
- **Commands (pattern):** `core/commands/entity-commands/AttachColumnsCommand.ts` (undoable batch attach, set `attachTopToIds`/`attachBaseToIds`), `AttachWallsTopCommand`, κ.λπ. `LevelSceneManagerAdapter` ως `ISceneManager`.
- **Foundation:** `bim/types/foundation-types.ts` (`FoundationParams` discriminated union pad/strip/tie-beam· `PadFootingParams.position/width/length/anchor`· geometry `footprint:Polygon3D`). `isFoundationEntity` (entities.ts:806).
- **Column:** `bim/types/column-types.ts` (`ColumnParams.position/width/depth/height`, `baseBinding`, `attachTopToIds`/`attachBaseToIds`, NO `footingId` ακόμη). `resolveColumnBaseZmm(params,{floorElevationMm})`.
- **Structural SSoT:** `bim/structural/` — `concrete-grades.ts`, `rebar-catalog.ts` (B500C), `structural-settings.ts` (building-level), `codes/` (`resolveStructuralCode` + eurocode/greek-legacy providers + `suggest-reinforcement.ts`), `reinforcement/` (**ΜΟΝΟ κολόνα**: `column-reinforcement-compute.ts`, `column-rebar-layout.ts`, `column-cross-ties.ts`, `column-confinement.ts`).
- **Validators (per-entity):** `bim/validators/{column,beam,foundation}-validator.ts` → `BimValidation{violationKeys[]}`. Geometry/detailing heuristics ΥΠΑΡΧΟΥΝ (slenderness, span/depth, min dims).

### ΛΕΙΠΕΙ (Phase 2+)
- ❌ **Explicit FK κολόνα↔πέδιλο** (μόνο implicit spatial coincidence στον graph).
- ❌ Section adequacy advisories («μικρή διατομή» + πρόταση διατομής) ως cross-entity diagnostics.
- ❌ Beam reinforcement & footing reinforcement (μόνο κολόνα).
- ❌ Strength design (M-N), loads, analysis.

---

## ΜΕΡΟΣ 2 — PHASE 2 (ΤΟ ΑΜΕΣΟ ΘΕΜΑ): EXPLICIT FK ΚΟΛΟΝΑ↔ΠΕΔΙΛΟ

**Στόχος (Revit-grade):** Όταν πέδιλο + κολόνα συμπίπτουν → να εδραιώνεται **persisted** σχέση στήριξης (όχι μόνο spatial), ώστε (α) ο οργανισμός να είναι ρητός (όπως στο Revit η κολόνα/foundation έχουν αναλυτική σύνδεση), (β) το «column needs footing» να γίνεται **hard/αξιόπιστο**, (γ) να κουμπώνει η μετέπειτα διαστασιολόγηση/οπλισμός (Phase 3/4).

### Προτεινόμενος σχεδιασμός (full SSoT — ζήτα έγκριση plan ΠΡΙΝ κώδικα)
1. **FK πεδίο (SSoT απόφαση):** `ColumnParams.footingId?: string` (FK → `FoundationEntity.id`) — η κολόνα δείχνει το πέδιλό της (Revit-style child→support reference). Persisted. **ΜΗΝ** προσθέσεις αμφίδρομα persisted arrays (αποφυγή drift)· το reverse (πέδιλο→κολόνες) παράγεται DERIVED στον graph.
2. **Coordinator SSoT (pure detection, mirror attach-coordinator):** NEW `bim/foundations/foundation-column-attach-coordinator.ts` — `findColumnFootingPairs(entities)` / `findFootingForColumn(column, foundations)`: pad/strip footprint καλύπτει το κέντρο βάσης κολόνας + footing top ≤ column base (ίδια κριτήρια με τη `footing-bearing` ακμή — **κοινό κριτήριο, ΟΧΙ δεύτερη υλοποίηση**: εξέτασε να βγάλεις το coverage σε ΕΝΑ shared helper που χρησιμοποιεί ΚΑΙ ο `structural-graph.ts` ΚΑΙ ο coordinator).
3. **Command (undoable):** NEW `core/commands/entity-commands/AttachColumnFootingCommand.ts` (mirror `AttachColumnsCommand`) — set `footingId` σε batch κολόνες· undo επαναφέρει.
4. **Auto-attach trigger (mirror useStructuralAutoAttach, ΑΜΦΙΔΡΟΜΑ):** στο `drawing:entity-created` — (α) νέο **πέδιλο** → attach όσες κολόνες κάθονται από πάνω· (β) νέα **κολόνα** πάνω σε υπάρχον πέδιλο → attach. Wire είτε επεκτείνοντας το `useStructuralAutoAttach` είτε νέο thin hook (προτίμησε επέκταση αν ταιριάζει· αλλιώς `useFoundationColumnAttach`). Emit `bim:column-footing-attached`.
5. **Graph integration:** ο `structural-graph.ts` να προτιμά το **explicit `footingId`** για την `footing-bearing` ακμή, με fallback στο spatial coincidence (back-compat legacy). → `columnMissingFooting` πιο αξιόπιστο.
6. **Tests:** coordinator pairing + command + graph «explicit FK wins».

### Enterprise/SSoT αρχές (απαράβατες)
- **DERIVED-never-persisted** για graph/diagnostics· persisted ΜΟΝΟ το `footingId` (SSoT FK).
- **N.0.2 Boy Scout:** το coverage-criterion ΕΝΑ SSoT (μοιράζεται graph + coordinator). ΜΗΝ διπλασιάσεις το `hostCoversColumn`/point-in-polygon λογική.
- **ADR-040 safe** (shell hook = discrete EventBus, όχι high-freq).
- **N.7.1:** αρχεία ≤500 γρ., functions ≤40 γρ. **N.6:** αν δημιουργείς Firestore docs → enterprise-id.
- **i18n (N.11):** νέα labels/toasts → keys el+en ΠΡΩΤΑ.
- **Enterprise IDs / N.2 (no any)** παντού.

---

## ΜΕΡΟΣ 3 — ROADMAP (Phase 3-5, μετά το Phase 2 — ΜΗΝ τα ξεκινήσεις χωρίς εντολή)

- **Phase 3 — Section adequacy advisories.** «μικρή διατομή κολόνας/δοκαριού» ως cross-entity diagnostics πάνω στον graph (αρχικά geometry/detailing heuristics — slenderness/span-depth ΥΠΑΡΧΟΥΝ στους validators) + **πρόταση διατομής** (next size). Νέοι checks στο `organism-checks` registry. Πραγματικό strength (M-N) μόνο μετά loads (Phase 5).
- **Phase 4 — Auto-reinforcement σε όλο τον οργανισμό.** REUSE `column-reinforcement-compute` + `suggest-reinforcement`· NEW **beam reinforcement** + **footing reinforcement** modules (ίδιο pattern με κολόνα: `bim/structural/reinforcement/beam-*`, `footing-*`). Detailing-limit driven (όχι loads).
- **Phase 5 (βαρύ, ξεχωριστό έργο) — Loads + analysis.** Dead/live/seismic, load path, πραγματικά M-N. Revit→Robot· εμείς απλοποιημένο gravity load path πρώτα. Ρητή εντολή Giorgio.

---

## ΜΕΡΟΣ 4 — ΠΡΩΤΑ ΒΗΜΑΤΑ ΝΕΑΣ ΣΥΝΕΔΡΙΑΣ
1. Διάβασε αυτό το handoff + **ADR-459** + `bim/structural/organism/*` + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`.
2. **Δήλωσε μοντέλο** (Opus), ζήτα επιβεβαίωση.
3. **PHASE 1 (N.0.1):** διάβασε τον υπάρχοντα κώδικα (attach-coordinator, foundation/column types, organism graph) — επιβεβαίωσε ground truth.
4. **Πρότεινε plan Phase 2** (FK `footingId` + coordinator + command + auto-attach + graph integration) + **ζήτα έγκριση**. ΜΗΝ γράψεις κώδικα πριν εγκρίνει ο Giorgio.
5. commit = Giorgio· shared tree → `git add` μόνο δικά σου· ένα tsc τη φορά.
