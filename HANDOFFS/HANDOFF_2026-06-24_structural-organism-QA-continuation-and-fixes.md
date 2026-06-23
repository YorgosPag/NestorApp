# HANDOFF — Συνέχεια QA «ενιαίου δομικού οργανισμού» + 3 διορθώσεις (Revit-grade, FULL SSoT)

**Ημ/νία:** 2026-06-24
**Τύπος:** Συνέχεια live QA session (κολώνα↔πέδιλο↔τοιχίο, Eurocode + αντισεισμικός) **+ υλοποίηση 3 διορθώσεων** μετά τους ελέγχους.
**Γλώσσα:** Απαντάς στον Giorgio **στα Ελληνικά.**
**Προηγούμενο handoff (baseline ροής):** `HANDOFF_2026-06-24_column-foundation-wall-structural-organism-QA.md` — διάβασέ το κι αυτό.

---

## 🚨 ΚΑΝΟΝΕΣ ΣΥΝΕΔΡΙΑΣ (απαράβατοι)

- **COMMIT/PUSH κάνει ΜΟΝΟ ο Giorgio.** ΠΟΤΕ εσύ. ΠΟΤΕ `git add -A` (**shared working tree — δουλεύει κι άλλος agent**).
- **Revit-grade, FULL ENTERPRISE + FULL SSoT, μηδέν διπλότυπα.**
- **ΠΡΙΝ ΑΠΟ ΚΑΘΕ ΓΡΑΜΜΗ ΚΩΔΙΚΑ → ΠΡΑΓΜΑΤΙΚΟ SSoT AUDIT (grep)** στο υπάρχον structural subsystem ώστε να **REUSE**, όχι να φτιάξεις διπλότυπο. Ο Giorgio κάνει σκληρό SSoT audit («κεντρικοποιημένο; υπάρχει ήδη; διπλότυπο; θα το έκανε έτσι η Google/Revit;»).
- **ADR-driven (N.0.1, 4 φάσεις):** code = source of truth· αν ADR≠code → ενημέρωσε ADR. Changelog + memory στο τέλος.
- **N.14:** πριν από non-trivial υλοποίηση → δήλωσε μοντέλο & **περίμενε «ok»**.
- **N.17:** ΕΝΑ tsc τη φορά (full tsc → OOM exit 134, ΟΧΙ σφάλμα κώδικα)· verify κυρίως με **jest**.
- **100% ειλικρίνεια.** (Σε αυτή τη session αναγκάστηκα να **ανακαλέσω** ένα αρχικό «bug» όταν διάβασα την ADR-474 — δες §4 #2.)

---

## 1. ΠΟΥ ΕΙΜΑΣΤΕ — τρέχουσα κατάσταση βάσης (Firestore, top-level collections)

**Settings που έθεσα ΕΓΩ** στο building `bldg_17d7b20e-81a8-4f89-83e7-0c27c855aaf2` («Κτήριο Α», project `proj_533d7d91-6824-4f03-a96c-a709dc89f004`), πεδίο `structuralSettings`:
```json
{ "soilBearingCapacityKpa": 150, "deadAreaLoadKpa": 7 }
```
- **σ_allow = 150 kPa** — όχι αυθαίρετο: είναι η πραγματική παραδοχή της reference μελέτης του project `THERMI_288_08` (`bim/structural/presets/reference-static-report.ts:120`).
- **G = 7 kPa** (τυπικό residential dead). Το live (Q) είναι auto από occupancy (residential 2.0 kPa, ADR-474).
- Ο Giorgio έκανε **hard refresh** → τα settings είναι **ενεργά** στο store.

**Υπάρχει 1 κολώνα + 1 πέδιλο (✅ verified):**
- Κολώνα `col_d90347eb-7a5a-43de-ba79-3ad8c5d96ecf`: rect **1000×250**, H=3000, rot 90, pos (776.4, 750). `footingId → fnd_ab96d0b2`. appliedLoad dead **192.66** / live **50** (takedown). Όπλιση **13Ø16**, Ø6/**125-250**, cover 30 (EC8 ✅).
- Πέδιλο `fnd_ab96d0b2-c47b-4566-964d-bfb4720364ed`: pad **1350×1300**, πάχος 500, area **1.755 m²**, autoDesigned. Όπλιση bottomMesh **12/175** both ways, cover 50.

**Πώς ελέγχεις (Firestore MCP, read-only):**
```
mcp__firestore__firestore_count { collection: "floorplan_columns" }
mcp__firestore__firestore_query { collection: "floorplan_foundations", limit: 5 }
mcp__firestore__firestore_query { collection: "floorplan_walls", limit: 5 }
```
Top-level collections → query χωρίς filter επιστρέφει όλα.

---

## 2. ✅ ΤΙ ΕΠΑΛΗΘΕΥΘΗΚΕ ΗΔΗ (μεμονωμένη κολώνα #1 — Revit-grade)

Με σ_allow=150 ενεργό, ο πλήρης κύκλος δουλεύει:
- **Bearing-sizing ΕΝΕΡΓΟ:** length 600→**1300** (κυβερνά √(N/σ)=1272→1300). Area 1.755 m².
- **Bearing EC7:** N=242.66 + ίδιο βάρος πεδίλου 21.9 = 264.6 kN → p=**150.7 kPa** vs 150 → **utilization ≈ 1.00** ✅ (ο sizer στοχεύει A=N/σ).
- **Flexure EC2 §9.8.2:** πρόβολος 525mm → As_req≈151 mm²/m < **ρmin** (585) → ρmin κυβερνά· παρεχόμενο 12/175=646 mm²/m ✅.
- **Όπλιση κολώνας EC8:** 13Ø16 ρ=1.05%≥1%· critical stirrup 125 = min(bMin/2=125, 175, 8·dbL=128) ✅ (`eurocode-provider.ts:68`)· count 13 = max(spacing-driven 12, ρmin 13) → **διπλός περιορισμός σωστά**.

**Ετυμηγορία:** μεμονωμένη κολώνα «στέκεται» ✅.

---

## 3. ➡️ ΕΠΟΜΕΝΑ ΒΗΜΑΤΑ QA (σταδιακά — απομόνωση μεταβλητών)

Ο Giorgio θα προχωρήσει **βήμα-βήμα** και θα λέει «ΔΕΣ ΒΑΣΗ». Σε κάθε βήμα: query + ανάγνωση doc + διασταύρωση με κώδικα + αναφορά ✅/⚠️/❌ με **νούμερα** (B×L×H, οπλισμός Ø/spacing, utilization) + ποιος κανονισμός αν παραβιάζεται.

1. **Κολώνα #2** (θα την βάλει κοντά στην #1, σχήμα Γ) → έλεγχος **combined πέδιλο** (union-find grouping) + αθροισμένα φορτία. *Baseline ΠΡΙΝ τη συνένωση.*
2. **Συνένωση σε τοιχίο** (`MergeColumnsCommand`) → έλεγχος:
   - δημιουργείται `floorplan_walls` doc;
   - μπαίνει **strip/συνεχές** πέδιλο με **σωστό γραμμικό φορτίο** (αυτό λύνει την «κατάρρευση» φορτίων — δες §4 #2);
   - **wall reinforcement EC8 §5.4.3.4**: boundary elements (lc=min(max(0.15·lw,1.5·bw),0.4·lw)) + web κατακόρυφος.
3. **Τοίχοι** (στη συνέχεια) → ίδιοι έλεγχοι.

---

## 4. 🔧 ΟΙ 3 ΔΙΟΡΘΩΣΕΙΣ ΠΟΥ ΕΚΚΡΕΜΟΥΝ (ΜΕΤΑ τους ελέγχους — ADR-driven, SSoT audit ΠΡΩΤΑ)

### #1 — ❌ Delete-path: διαγραφή 1 κολώνας από combined ΔΕΝ ξαναδιαστασιολογεί το πέδιλο
- **Σύμπτωμα (Giorgio, reproduced):** 2 κολώνες με combined πέδιλο· σβήνεις τη μία → το πέδιλο μένει «παγωμένο» στο combined (δεν συρρικνώνεται σε isolated για την εναπομείνασα).
- **Τι επαλήθευσα:** Subscriptions ✅ (`useAutoFoundationDesign.tsx:39` κάνει subscribe στο `bim:column-delete-requested`)· classifier ✅ (`structural-geometry-edit-triggers.ts:57`)· **reconcile logic ✅ ΘΑ δούλευε** (`auto-foundation-reconcile.ts` — η μετάβαση combined→isolated δίνει position diff 215mm > 50mm tol `geometryMatches:88` → UPDATE).
- **Ρίζα (βεβαιότητα: υψηλή για το «τι», μέτρια για ακριβές ordering):** ο planner διαβάζει **stale column set** — η διαγραμμένη κολώνα είναι ακόμα στο `activeScene.entities` (`auto-foundation-design-core.ts:237`) τη στιγμή που τρέχει η αντίδραση (το `bim:column-delete-**requested**` είναι αίτημα, emit `useRibbonColumnBridge.ts:247`)· καμία re-trigger μετά την πραγματική αφαίρεση.
- **ΕΚΚΡΕΜΕΙ ΓΙΑ 100% ΡΙΖΑ:** διάβασε τον listener που εκτελεί την `DeleteEntityCommand` για κολώνες (πριν/μετά mutate σκηνής σε σχέση με το emit) → επιβεβαίωσε ordering.
- **Κατεύθυνση fix (ADR-459 Φ7):** re-design σε **post-removal** event (ολοκληρωμένη αφαίρεση) ή ανάγνωση φρέσκιας σκηνής μετά το commit της διαγραφής. **SSoT audit ΠΡΩΤΑ** — μην φτιάξεις νέο event/path αν υπάρχει ήδη post-delete signal.

### #2 — ⚠️ Wall-load μοντέλο (ΟΧΙ takedown bug — προσοχή!)
- **ΠΡΟΣΟΧΗ / διόρθωση αρχικής εκτίμησης:** αρχικά το χαρακτήρισα bug· **διαβάζοντας την ADR-474 §3β ανακάλεσα** — το «exterior side = 0 / no mirror» είναι **σκόπιμη & σωστή** απόφαση (κλασικό 1:2:4 tributary· το mirror αφαιρέθηκε γιατί φούσκωνε γωνιακά πέδιλα). **ΜΗΝ ξαναβάλεις mirror — regression ADR-474.**
- **Πραγματική ρίζα:** δύο κολώνες σε επαφή (0.5m) = **τοιχίο**, όχι σημειακές κολώνες· το point-column tributary δίνει ~0 φορτίο ορόφου (σωστό μαθηματικά, λάθος μοντέλο). **Το σωστό μοντέλο είναι το wall load model** που εφαρμόζεται μετά τη συνένωση (βήμα §3.2).
- **Τι να ελεγχθεί/υλοποιηθεί:** μετά τη συνένωση, να μπαίνει **strip/συνεχές πέδιλο** με **γραμμικό φορτίο τοίχου** (όχι point-column). SSoT: `bim/structural/reinforcement/slab-foundation-reinforcement-compute.ts` (πεδιλοδοκός/συνεχές), `column-wall-reinforcement.ts` (boundary elements), `useProactiveStructuralLoads.ts` (έχει ήδη `bim:wall-params-updated`/`wall-delete-requested` → γραμμικό φορτίο δοκού). **Επιβεβαίωσε ότι ο wall→strip-footing δρόμος υπάρχει & δουλεύει· αν λείπει, υλοποίησε REUSE-only.**
- **Slab-derived g_k:** ADR-474 §4 DEFER (σήμερα heuristic). Δευτερεύον.

### #3 — ⚠️ Float-dust: πέδιλο 1350 αντί 1300 (50mm oversize)
- **Ρίζα:** `effectiveFaces` βγάζει `1000.0000000000146` (sub-nano dust από rotation un-rotate) → `+300=1300.0000000000146` → `roundUpTo(.,50)` με `Math.ceil` πηδά ολόκληρο module → **1350**.
- **Αρχεία:** `bim/foundations/auto-foundation-layout.ts` (`effectiveFaces` ~γρ.136-151) + `bim/structural/footing-design/suggest-pad-dimensions.ts` (`roundUpTo` γρ.43-45).
- **Κατεύθυνση fix:** epsilon-snap στο `roundUpTo` (ή snap effective faces σε ~1mm/μm ΠΡΙΝ το ceil). **SSoT audit:** υπάρχει ήδη `snapToGrid` SSoT (ADR-049) — **REUSE** (memory: είχα ξαναγράψει διπλότυπο snap, ο Giorgio το έπιασε). Συντηρητικό (oversize), χαμηλή προτεραιότητα.

---

## 5. ⛔ SSoT AUDIT MAP — structural subsystem (grep ΠΡΙΝ γράψεις· REUSE)

`src/subapps/dxf-viewer/bim/structural/` + `bim/foundations/` + `hooks/`:
- **Sizing:** `structural/sizing/{column-sizing,column-size-patch,pad-size-patch}.ts` · `structural/footing-design/suggest-pad-dimensions.ts`
- **Footing design (EC7/EC2):** `structural/footing-design/{footing-bearing,footing-flexure,footing-punching,footing-shear,footing-design,footing-design-checks,footing-design-input}.ts`
- **Reinforcement:** `structural/reinforcement/{footing-reinforcement-compute,column-reinforcement-compute,column-wall-reinforcement,slab-foundation-reinforcement-compute}.ts` · `rebar-catalog.ts` · `concrete-grades.ts`
- **Codes (providers):** `structural/codes/{eurocode-provider,greek-legacy-provider,suggest-reinforcement,suggest-footing-reinforcement,index}.ts` · `structural/structural-settings.ts` (resolver) · `structural/presets/reference-static-report.ts` (THERMI_288_08)
- **Loads/seismic:** `structural/loads/{seismic-params,load-takedown,load-combinations,occupancy-loads}.ts`
- **Organism:** `structural/organism/{structural-graph,reinforcement-continuity,derive-column-base-continuity,column-base-continuity-store}.ts`
- **Foundations coupling:** `foundations/{auto-foundation-layout,auto-foundation-reconcile,foundation-cross-level-writer,foundation-firestore-service}.ts` · `core/commands/entity-commands/{ApplyFoundationLayoutCommand,MergeColumnsCommand,DeleteEntityCommand}.ts`
- **Reactive hooks (live):** `hooks/{auto-foundation-design-core,useAutoFoundationDesign,structural-auto-study-core,useProactiveStructuralLoads,useStructuralOrganism,useGroupedStructuralReaction,structural-geometry-edit-triggers}.ts`

**Σχετικά ADR:** ADR-459 (organism connectivity / reconcile / grouped reaction), ADR-464/467 (takedown/load-path), ADR-474 (occupancy auto-loads + edge tributary — **διάβασέ το πριν αγγίξεις takedown**), ADR-472 (load-aware reinforcement), ADR-390 (symmetric create/delete), ADR-456 (structural settings), ADR-049 (snapToGrid SSoT).

---

## 6. CONTEXT HEALTH
Η προηγούμενη session έκλεισε στο 🔴 ~88% μετά 6 γύρους ελέγχων. Νέα session = καθαρό context για #2 + συνένωση + 3 διορθώσεις.
