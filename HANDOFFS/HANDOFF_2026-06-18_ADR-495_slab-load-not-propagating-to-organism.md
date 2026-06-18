# HANDOFF — ADR-495: Η προσθήκη πλάκας (οροφής/προβόλου) ΔΕΝ φορτίζει τον οργανισμό — διαγράμματα/διατομές κολώνας/δοκαριού/πεδίλου δεν αλλάζουν

> ⚠️ **ΠΡΟΣΟΧΗ ΑΡΙΘΜΟΣ:** το **ADR-494 ΠΙΑΣΤΗΚΕ** από άλλον agent (διαφορετικό θέμα: `ADR-494-footprint-based-kind-agnostic-beam-column-framing`). Αυτή η δουλειά (slab-load) = **ADR-495**. **ΕΠΙΒΕΒΑΙΩΣΕ με `ls docs/centralized-systems/reference/adrs/` πριν δεσμεύσεις** (shared tree, ενεργός άλλος agent).

**Ημ/νία:** 2026-06-18 · **Από:** Opus session (μόλις ολοκλήρωσε ADR-493 κυκλική κολώνα — uncommitted) · **Γλώσσα:** ΠΑΝΤΑ Ελληνικά.
**Τύπος:** 🔴 PLAN-FIRST. **SSoT AUDIT (GREP) ΥΠΟΧΡΕΩΤΙΚΟ ΠΡΙΝ ΚΩΔΙΚΑ.** ΜΗΝ γράψεις πριν εγκριθεί το plan από τον Giorgio.

> ⚠️ **Shared working tree** με άλλον agent. **git add ΜΟΝΟ τα δικά σου αρχεία, ΠΟΤΕ -A.** **commit = ο Giorgio (ΟΧΙ εσύ). tsc = ο Giorgio** (N.17, ένα tsc τη φορά). **jest = τρέξε από repo ROOT.**
> 🧭 **ΔΙΑΒΑΣΕ ΠΡΩΤΑ ΤΟ ΟΡΑΜΑ:** `docs/centralized-systems/reference/adrs/ADR-487-living-structural-organism-vision.md` (§3 «ΕΝΑΣ οργανισμός», §4 «σε κάθε προσθήκη/σύνδεση recompute ΟΛΑ», §5 σειρά: 7=τοιχοποιία→νέα φορτία→νέος κύκλος).
> 🖼️ **Screenshot αναφοράς:** `C:\Nestor_Pagonis\Στιγμιότυπο οθόνης 2026-06-18 233548.jpg` (2 κολώνες w=250/d=400 + δοκάρι· διάγραμμα ροπών **ΑΜΦΙΕΡΕΙΣΤΟΥ** — καμία επιρροή της πλάκας· M_Ed=62.70, N_Ed=89.34).

---

## 0. ΤΟ ΣΕΝΑΡΙΟ (τι παρατήρησε ο Giorgio)

Έστησε: **2 κολώνες + πέδιλα**, ενωμένες στην κορυφή με **δοκάρι** (συνδεδεμένο στις εσωτερικές παρειές). Μετά πρόσθεσε **πλάκα οροφής (πρόβολο)** και την **κόλλησε στο δοκάρι**.

**Πρόβλημα:** η συμπεριφορά/διαγράμματα **ΟΥΤΕ της μίας κολώνας, ΟΥΤΕ της άλλης, ΟΥΤΕ του δοκαριού άλλαξαν**. Κανονικά (ADR-487) η προσθήκη φορτιζόμενης πλάκας πρέπει να αλλάξει: διαγράμματα M/V/N, διατομές σιδήρων, διατομές κολωνών/πεδίλων/δοκαριού. **Το σύστημα μάλλον δεν «βλέπει» το φορτίο της πλάκας στον φορέα.**

---

## 1. 🔑 ROOT CAUSE — repro-confirmed ΑΠΟ ΤΟΝ ΚΩΔΙΚΑ (όχι υπόθεση). **ΕΠΑΛΗΘΕΥΣΕ τα ξανά.**

Η ρίζα **ΔΕΝ είναι ο trigger** (αρχική υπόθεση «δεν πυροδοτείται» → **απορρίφθηκε**). Είναι το **load model: slab-agnostic για δοκάρια + πλάκα εκτός graph**.

### (Α) Trigger = ΟΚ (δεν είναι εδώ η ρίζα)
- `CreateSlabsCommand` → `EventBus.emit('drawing:entity-created', {tool:'slab'})`.
- `useProactiveStructuralLoads` `PROACTIVE_LOAD_EVENTS` **ΠΕΡΙΛΑΜΒΑΝΕΙ** `'drawing:entity-created'` (γρ.53 «νέα κολόνα/δοκάρι/πλάκα») → τρέχει `runStructuralLoadTakedown`. Ομοίως `useStructuralOrganism` `ORGANISM_EVENTS` (γρ.51) + `useProactiveMemberSizing` (γρ.49). **Άρα ο recompute ΤΡΕΧΕΙ** στην προσθήκη πλάκας.

### (Β) ΡΙΖΑ #1 — το δοκάρι παίρνει φορτίο από το **column grid**, ΟΧΙ από την πλάκα
`bim/structural/loads/load-path-takedown.ts` → `beamLoad()` (γρ.117-131):
```ts
const cols = beamSupportColumnIds(graph, b.id);
const avg = μ.ό.( tributary.get(colId) )   // ← column GRID tributary των ΑΚΡΟ-ΚΟΛΟΝΩΝ
computeMemberTakedown({ tributaryAreaM2: avg, storeyCount: 1, ... })
```
- Το `tributary` = `buildColumnTributary` = `computeGridTributaryAreas(column centres)` — **εξαρτάται ΜΟΝΟ από τη γεωμετρία των κολονών (grid spacing)**, ΟΧΙ από την ύπαρξη/μέγεθος/σχήμα της πλάκας.
- **Συνέπεια:** προσθήκη/αφαίρεση/αλλαγή πλάκας → ίδιες κολώνες → ίδιο `tributary` → **ίδιο beam load → ίδιο M/V/N → ίδια διαγράμματα/διατομές**. Ακριβώς το σύμπτωμα.

### (Γ) ΡΙΖΑ #2 — η πλάκα είναι **εκτός του structural graph**
- `bim/structural/organism/structural-graph.ts`: nodes μόνο `footing` / `column` / `beam` — **κανένα slab/roof node/edge**.
- `load-path-takedown.ts` γρ.148 + 186-188: «**πλάκες ως ανεξάρτητες πηγές (εκτός graph)**» — η πλάκα παίρνει το δικό της `slabLoad` (εμβαδόν × area-loads, **πληροφοριακό**) αλλά **ΔΕΝ διοχετεύει** φορτίο σε δοκάρι/κολώνα.
- **Συνέπεια:** ο **πρόβολος** (πλάκα που προεξέχει πέρα από το δοκάρι) δεν μεταφέρει **καμία** αντίδραση/ροπή πάκτωσης στο δοκάρι ή τον κόμβο. Τελείως αόρατος στατικά.

### Συμπέρασμα
Ο μηχανισμός «recompute σε κάθε κίνηση» (ADR-487 §4) **τρέχει**, αλλά το **load model δεν είναι slab-aware**: το beam tributary είναι column-grid-derived και η πλάκα είναι εκτός graph. Άρα το αποτέλεσμα είναι ταυτόσημο με/χωρίς πλάκα. **ΕΠΑΛΗΘΕΥΣΕ** με μικρό repro/diagnostic (πρόσθεσε/σβήσε πλάκα → δες αν `appliedLoad` δοκαριού αλλάζει — αναμένεται ΟΧΙ).

---

## 2. ⚖️ ΑΡΧΙΤΕΚΤΟΝΙΚΗ ΕΝΤΑΣΗ (απάντησέ τη ΠΡΙΝ το plan)

Πώς διοχετεύεται το slab area-load στον φορέα;

- **(A) Grid-tributary mode (ΤΡΕΧΟΝ, Revit-simple):** area loads «παντού» μέσω column grid· πλάκα = πληροφοριακή. ➖ Δεν αντιδρά σε προσθήκη/σχήμα/πρόβολο πλάκας. **Αυτό είναι το bug.**
- **(B) Slab-aware load path (Revit-grade, ΣΥΣΤΑΣΗ):** η πλάκα διοχετεύει το area-load της στα **δοκάρια/κολώνες που τη στηρίζουν** → γραμμικό φορτίο δοκαριού (UDL → M_Ed → οπλισμός/sizing/διαγράμματα). **Mirror του ADR-478 `wall-beam-support`** (που ήδη κάνει τοίχος→δοκάρι). Ο **πρόβολος** = ειδική μεταχείριση (cantilever reaction + ροπή στον κόμβο). 
- **(C) FEM-coupled (ADR-481):** η πλάκα ως πλακοειδές/area element στο FEM solver. Βαρύ — **DEFER** (το διάγραμμα μπορεί να ακολουθήσει μέσω του (B) load vector).

> Σύσταση (μη δεσμευτική): **(B)**. Υπάρχει **έτοιμο precedent + SSoT** (`wall-beam-support` ADR-478): «στοιχείο που πατά/κολλά σε δοκάρι → πρόσθετο γραμμικό φορτίο». Το slab→beam = mirror. Πρώτο slice: απλό slab→beam UDL (αμφιέρειστη πλάκα μεταξύ δοκαριών). Δεύτερο slice: **πρόβολος** (cantilever moment στον κόμβο δοκαριού/κολώνας — εδώ είναι η ουσία του σεναρίου του Giorgio).

**Κρίσιμα sub-ζητήματα στο plan:** (1) ποια πλάκα→ποιο δοκάρι (host binding `attachBaseToIds` / spatial coverage `coveredIntervals`)· (2) tributary λωρίδα πλάκας ανά δοκάρι (one-way vs two-way slab)· (3) **πρόβολος**: αναγνώριση (η πλάκα προεξέχει πέρα από το δοκάρι-στήριξη) + cantilever reaction/moment· (4) πού μπαίνει το φορτίο: `beamLoad.extraDeadAxialKn` (όπως ο τοίχος, smear→UDL) **ή** ρητό line-load/moment· (5) να ΜΗΝ διπλομετρηθεί με το column-grid tributary (απόφαση: grid mode → slab-aware mode, ή συνύπαρξη).

---

## 3. 🔴 SSOT AUDIT (GREP) — ΤΡΕΞΕ ΞΑΝΑ ΟΛΑ ΠΡΙΝ ΓΡΑΨΕΙΣ. Παραδοτέο: πίνακας reuse vs new + απάντηση §2 + repro-confirmed root cause.

### 3.1 Load path / takedown (REUSE — ΜΗΝ ξαναφτιάξεις engine)
```
src/subapps/dxf-viewer/bim/structural/loads/wall-beam-support.ts        ← 🔑 PRECEDENT: στοιχείο→δοκάρι γραμμικό φορτίο (mirror για slab→beam). coveredIntervals + extraDeadAxialKn→UDL→M_Ed
src/subapps/dxf-viewer/bim/structural/loads/load-path-takedown.ts       ← computeLoadPathPatches / beamLoad / slabLoad (εδώ μπαίνει η slab→beam συνεισφορά)
src/subapps/dxf-viewer/bim/structural/loads/load-takedown.ts            ← computeMemberTakedown / computeGridTributaryAreas / TakedownSettings
src/subapps/dxf-viewer/bim/structural/loads/load-path-walk.ts           ← topologicalLoadOrder / beamSupportColumnIds / footingColumnId
src/subapps/dxf-viewer/bim/structural/loads/member-load-geometry.ts     ← self-weight/centres SSoT
src/subapps/dxf-viewer/bim/structural/loads/occupancy-loads.ts          ← resolveEffectiveAreaLoads (G/Q kPa)
src/subapps/dxf-viewer/bim/structural/organism/structural-graph.ts      ← nodes column/beam/footing (ΔΕΝ έχει slab — απόφαση: προσθήκη slab edge ή spatial-coverage εκτός graph όπως ο τοίχος)
src/subapps/dxf-viewer/bim/geometry/shared/segment-polygon-coverage.ts  ← coveredIntervals (επικάλυψη άξονα↔footprint) — REUSE για slab footprint ∩ beam
src/subapps/dxf-viewer/bim/geometry/shared/polygon-axis-projection.ts   ← 🆕 projectPolygonOnAxis (alongMin/Max + perpMin/Max· NEW SSoT από ADR-494 άλλου agent) — REUSE για slab footprint προβολή σε beam axis (tributary strip)
src/subapps/dxf-viewer/bim/geometry/wall-host-plan-builder.ts           ← beamHostInput / slabHostInput (footprint+Z)
grep -rn "slabHostInput\|attachBaseToIds\|isSlabEntity\|coveredIntervals\|computeWallBeamDeadLoads" src/subapps/dxf-viewer/bim/structural
```

### 3.2 Proactive triggers (REUSE — δουλεύουν, ΜΗΝ τα πειράξεις)
```
src/subapps/dxf-viewer/hooks/useProactiveStructuralLoads.ts   ← PROACTIVE_LOAD_EVENTS (έχει ήδη drawing:entity-created)
src/subapps/dxf-viewer/hooks/structural-load-takedown-core.ts ← runStructuralLoadTakedown (SSoT πυρήνας)
src/subapps/dxf-viewer/hooks/useStructuralOrganism.ts         ← ORGANISM_EVENTS
src/subapps/dxf-viewer/hooks/useProactiveMemberSizing.ts      ← PROACTIVE_SIZE_EVENTS
src/subapps/dxf-viewer/hooks/proactive-coalescer.ts           ← createMicrotaskCoalescer (ADR-488)
```

### 3.3 Πρόβολος / στήριξη / διαγράμματα (REUSE)
```
src/subapps/dxf-viewer/bim/structural/organism/derive-beam-support.ts   ← topology-aware support (ADR-486· cantilever detection για ΔΟΚΑΡΙ — πρότυπο για slab cantilever)
src/subapps/dxf-viewer/bim/structural/codes/suggest-reinforcement.ts    ← spanMomentDivisor (cantilever=2) — αν χρειαστεί moment από πρόβολο
src/subapps/dxf-viewer/bim/structural/analytical/solver/load-vector.ts  ← FEM load vector (αν θες το πρόβολο-moment στο διάγραμμα ADR-481/483)
src/subapps/dxf-viewer/bim/structural/loads/structural-loads-types.ts   ← AppliedMemberLoad / MemberLoad / isTakedownWritable
```

### 3.4 ADR-040 (μόνο αν αγγίξεις render/overlay — απίθανο εδώ, καθαρά load model)

---

## 4. ΣΧΕΤΙΚΑ ADR (διάβασε όσα αγγίζεις· code = source of truth)
**ADR-487 (ΟΡΑΜΑ — ΠΡΩΤΟ)** · **ADR-467** (load-path engine — ο πυρήνας) · **ADR-464** (footing tributary takedown) · **ADR-474** (occupancy area loads) · **ADR-478** (wall→beam line loads — **το precedent για slab→beam**) · **ADR-459** (structural organism / StructuralGraph) · **ADR-475** (auto member sizing — αντιδρά σε loads-computed) · **ADR-476** (slab reinforcement) · **ADR-472** (load-aware οπλισμός) · **ADR-486** (topology-aware support / πρόβολος) · **ADR-481/483/488** (FEM/διαγράμματα — αν θες το moment ορατό).

## 5. ΚΑΤΑΣΤΑΣΗ TREE (UNCOMMITTED — ΜΗΝ τα πειράξεις, είναι άλλων/προηγούμενων)
- **Προηγούμενο δικό μου (UNCOMMITTED, REUSE — ΟΧΙ σχετικό με slab):** ADR-493 (κυκλική κολώνα carve + circular M-N lever arm + spiral + NEW `projectPointOnAxis`). Committed batch1 = `e6df4aad`· batch2 (κεντρικοποίηση+σπείρα) uncommitted.
- **🆕 Άλλου agent — ADR-494 (ΕΝΕΡΓΟ, shared tree, ΜΗΝ ΑΓΓΙΞΕΙΣ):** `ADR-494-footprint-based-kind-agnostic-beam-column-framing` — ενοποίησε τη framing logic· **refactored ΚΑΙ δικά μου ADR-493 αρχεία:** εξήγαγε `projectPolygonOnAxis` σε NEW `bim/geometry/shared/polygon-axis-projection.ts`, άλλαξε το `beam-column-cutback.ts` (να το χρησιμοποιεί), wired το `column-face-trim.ts` (υλοποίησε το delegation που είχα flag-άρει). **Τα δικά μου ADR-493 jest περνούν (38/38) — δεν έσπασε.** ⚠️ ΜΗΝ αγγίξεις `polygon-axis-projection.ts`/`column-face-trim.ts`/`beam-column-cutback.ts` — δικά του τώρα· **REUSE** το `projectPolygonOnAxis`.
- **Άλλου agent (shared tree, ΜΗΝ ΑΓΓΙΞΕΙΣ):** ADR-492 (`beam-column-reframe*`, `column-structural-attach-coordinator`), ADR-489/484/483.
- **Επόμενος ελεύθερος ADR = 495** (494=άλλου agent framing· 493=δικό μου). **ΕΠΙΒΕΒΑΙΩΣΕ με `ls` πριν δεσμεύσεις.**
- Γνωστά **pre-existing jest failures** (ΟΧΙ δικά σου): 2 raft/slab (ADR-476) — `raft-bearing` + `reinforcement-checks foundation-slab raft`.

## 6. ΚΑΝΟΝΕΣ (ΑΠΑΡΑΒΑΤΟΙ — CLAUDE.md)
- **PLAN-FIRST:** ADR-487 read → SSoT audit (grep §3) → **repro-confirm τη ρίζα** (πρόσθεσε/σβήσε πλάκα· δες αν `appliedLoad` δοκαριού/M_Ed αλλάζει — αναμένεται ΟΧΙ) → πίνακας reuse vs new + απάντηση §2 (A/B/C & γιατί) → plan → **περίμενε «προχώρα»** → code.
- **Full SSoT (N.0.2):** ΜΗΝ φτιάξεις νέο load engine — **mirror του `wall-beam-support` (ADR-478)** + reuse `coveredIntervals`/`beamHostInput`/`computeMemberTakedown`/host bindings. NEW μόνο: `computeSlabBeamLoads` (ή ανάλογο) + wiring στο `beamLoad`/graph.
- **GOL:** ≤40γρ/func, ≤500γρ/file, μηδέν `any`/`as any`/`@ts-ignore`, μηδέν hardcoded strings (i18n el+en αν UI), Select=`@/components/ui/select`.
- **ADR-driven (N.0.1 + N.15):** PHASE 3 → **ADR-495** (NEW· 494 πιάστηκε) + cross-ref ADR-467/478 + adr-index + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + MEMORY (ίδιο commit).
- **commit/tsc = ο Giorgio.** jest = από ROOT. **Shared tree: git add ΜΟΝΟ δικά σου.** **Απάντα ΠΑΝΤΑ Ελληνικά.**

## 7. ΕΡΓΑΛΕΙΟ ΕΠΑΛΗΘΕΥΣΗΣ
2 κολώνες + πέδιλα + δοκάρι (διαγράμματα ενεργά) → πρόσθεσε **πλάκα προβόλου** κολλημένη στο δοκάρι → **(αναμενόμενο μετά το fix):** το δοκάρι αποκτά πρόσθετο φορτίο (UDL + πρόβολος-moment) → **αλλάζουν** M/V/N διαγράμματα, As δοκαριού, αξονικό κολονών (→ πέδιλα), διατομές. Σύγκρινε με/χωρίς πλάκα: τώρα **ταυτόσημα** (bug), μετά **διαφορετικά**. Δοκίμασε ΚΑΙ αφαίρεση πλάκας → μείωση φορτίου.

## 8. ΑΡΧΗ ΣΧΕΔΙΑΣΗΣ (ADR-487 §3-§5)
«ΕΝΑΣ οργανισμός»: η πλάκα που ενώνεται/εδράζεται σε δοκάρι **είναι μέρος του φορέα** — το area-load της πρέπει να **ρέει** στα δοκάρια→κολώνες→πέδιλα→έδαφος, σε **κάθε** προσθήκη, ώστε διατομές/οπλισμός/διαγράμματα να ακολουθούν. Ο πρόβολος ειδικά αλλάζει το moment του κόμβου — κρίσιμο για Revit/Robot-grade.
