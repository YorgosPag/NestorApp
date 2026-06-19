# HANDOFF — ADR-504 ΦΑΣΗ 2: Opt-in εισαγωγή ενδιάμεσων κολωνών (Revit-grade, FULL ENTERPRISE + FULL SSOT)

> 🧭 **ΔΙΑΒΑΣΕ ΠΡΩΤΑ (με τη σειρά):**
> 1. `docs/centralized-systems/reference/adrs/ADR-487-living-structural-organism-vision.md` — **§8.4 (ο άνθρωπος υπογράφει, το σύστημα προειδοποιεί), §9 (scope guard: Revit-grade, ΟΧΙ Robot/SAP)**.
> 2. `docs/centralized-systems/reference/adrs/ADR-504-practical-span-intermediate-columns.md` — **ΟΛΟ**, ιδίως **§5 (η κρίσιμη απόφαση Α vs Β)** + §4 (τι έκανε η Φάση 1).
> 3. Αυτό το handoff ΟΛΟΚΛΗΡΟ.

**Ημ/νία:** 2026-06-19 · **Γλώσσα:** ΠΑΝΤΑ Ελληνικά · **PLAN-FIRST** (plan σε φάσεις/sub-slices → «προχώρα» → κώδικας).
**🚨 commit + tsc = ο GIORGIO (ΟΧΙ εσύ).** jest = repo ROOT. Επαλήθευση: live DB Firestore MCP `proj_12788b6a`.
**⚠️ SHARED TREE (μοιράζεται με άλλον agent):** `git add` **ΜΟΝΟ** τα δικά σου. **ΜΗΝ** αγγίξεις `bim/columns/column-beam-align*` (ADR-496), `bim-3d/diagrams/*` (ADR-483), ούτε ό,τι έχει σχέση με ADR-503 (sizing locks) εκτός αν χρειαστεί ρητά.
**🚨 FULL SSOT / N.0.2:** ΠΡΙΝ γράψεις ΟΤΙΔΗΠΟΤΕ, **ξανα-grep** — η §3 είναι το audit μου (2026-06-19, confirmed), αλλά **επιβεβαίωσέ το** (shared tree αλλάζει). Revit-grade, full enterprise, μηδέν `any`/inline-style, ≤40γρ/func, ≤500γρ/file, **i18n keys ΠΡΩΤΑ (N.11)**, Enterprise IDs (N.6).
**ADR:** συνεχίζεις το **ADR-504** (νέο status/changelog στη Φάση 2) — ΟΧΙ νέος αριθμός.

---

## 0. ΚΑΤΑΣΤΑΣΗ — Φάση 1 COMMITTED ✅

Η Φάση 1 (practical-span advisory, soft warning + πρόταση «πόσες κολώνες») **έγινε commit από τον Giorgio**. Λειτουργεί: όταν τραβάς κολώνες μακριά → `StructuralWarningOverlay` δείχνει «Δοκός … άνοιγμα Xm απαιτεί ύψος Ymm (μη-πρακτικό)· πρότεινε K ενδιάμεσες κολώνες → υπο-ανοίγματα ~Zm». Δες ADR-504 §4 για τα αρχεία (`clear-height-under-beam.ts`, `practical-span-checks.ts`, `runPracticalSpanChecks` wired στον organism core).

**Η Φάση 2 = να γίνει η πρόταση ΠΡΑΞΗ** (opt-in action), Revit-grade.

---

## 1. ΣΤΟΧΟΣ ΦΑΣΗΣ 2

Κουμπί/💡 (contextual στον δοκό **ή** action μέσα από το warning) που, **ΜΕ ΡΗΤΗ ΣΥΓΚΑΤΑΘΕΣΗ** του μηχανικού (confirm dialog — ΠΟΤΕ σιωπηλά, ADR-487 §8.4):
1. Δημιουργεί **K ισαπέχουσες ενδιάμεσες κολώνες** πάνω στον άξονα του δοκού (K = η πρόταση της Φάσης 1, `suggestIntermediateColumnCount`).
2. Τα **πέδιλα** μπαίνουν αυτόματα μέσω του υπάρχοντος reconciler (`runAutoFoundationDesign`, gated `autoDesigned`).
3. Ο δοκός **μικραίνει** (ο `useProactiveMemberSizing` ξανα-διαστασιολογεί) — **ΕΦΟΣΟΝ** το span που βλέπει ο sizer πέσει (βλ. §2, η κρίσιμη απόφαση).
4. **ΕΝΑ atomic undo** (`CompoundCommand`) για όλη την ενέργεια.

**Scope guard (ADR-487 §9):** Revit-grade «πρότεινε + εκτέλεσε με confirm», ΟΧΙ Robot/SAP auto-optimization. Layout = απόφαση μηχανικού.

---

## 2. 🔴 Η ΚΡΙΣΙΜΗ ΑΝΟΙΧΤΗ ΑΠΟΦΑΣΗ (ΑΠΟΦΑΣΙΣΕ ΜΕ ΤΟΝ GIORGIO ΠΡΙΝ ΤΟΝ ΚΩΔΙΚΑ)

**Το κλειδί:** `buildBeamSectionContext` (`section-context.ts:~219`) παίρνει `spanMm = beam.geometry.length·1000` (**πλήρες μήκος άξονα**). Άρα **σκέτη** προσθήκη κολώνας **ΔΕΝ** μικραίνει τον δοκό — ο sizer βλέπει ακόμα 16m. Δύο δρόμοι:

### Επιλογή Α — Inter-support span derivation (✅ ΣΥΝΙΣΤΩ, SSoT-friendly)
Ο δοκός μένει **ΕΝΑ** element. Αλλάζεις το sizing-span σε «**μέγιστο καθαρό υπο-άνοιγμα μεταξύ διαδοχικών στηρίξεων**» (reuse `beamSupportColumnIds` + προβολή θέσεων κολωνών στον άξονα του δοκού).
- **+** Μικρό scope· μηδέν νέο subsystem· ο δοκός παραμένει ΕΝΑ entity (μηδέν persistence/grip/merge complexity).
- **−** Ο δοκός γίνεται **συνεχής σε πολλές στηρίξεις** → αλλάζει το **μοντέλο ροπών**: συνεχής δοκός ≈ `wL²/10..12` (άνοιγμα) + **hogging πάνω από τις στηρίξεις**, ΟΧΙ `wL²/8`.
- **Τι θέλει:** επέκταση `spanMomentDivisor` (σήμερα: simple=8, fixed=12, cantilever=2 — `suggest-reinforcement.ts:273`) με **continuous** divisor (~10-12) + χειρισμό hogging πάνω από ενδιάμεσες στηρίξεις (άνω οπλισμός). **Αυτό είναι το πραγματικό μηχανικό περιεχόμενο της Φάσης 2.**

### Επιλογή Β — Beam-split (Revit-explicit)
Σπας τον 16m δοκό σε **K+1 αμφιέρειστα** δοκάρια (mirror του wall-split, ADR-363 Phase X) — καθένα column-to-column, απλό `wL²/8`.
- **+** «Καθαρό» μοντέλο (κάθε δοκός απλός)· κάθε άνοιγμα ανεξάρτητο.
- **−** **Πολύ μεγαλύτερο scope:** νέο split command + undo + persistence (K+1 entities, νέα IDs μέσω `enterprise-id.service`) + grip/merge complexity + associative reframe σε κάθε νέο άκρο. **ΔΕΝ** υπάρχει beam-split σήμερα (μόνο wall-split).

### 📌 Σύστασή μου: **Επιλογή Α** — λιγότερο scope, SSoT, ο δοκός μένει ΕΝΑ element· το μηχανικό βάρος (continuous moment model) είναι το «σωστό» Revit-grade. **ΑΛΛΑ** χρειάζεται ρητή απόφαση Giorgio για το μοντέλο ροπών συνεχούς δοκού (continuous divisor + hogging) **πριν** γράψεις.

---

## 3. 🔍 SSOT AUDIT (grep 2026-06-19 — confirmed· ΞΑΝΑ-grep πριν τον κώδικα)

### Action / command (η εκτέλεση)
| Concern | SSoT (υπάρχει) | Πού |
|---|---|---|
| Προγραμματική δημιουργία κολώνας (entity → scene) | `addColumnToScene(columnEntity, accessor)` | `bim/columns/add-column-to-scene.ts:22` |
| Undoable command δημιουργίας entity | `CreateEntityCommand` | `core/commands/entity-commands/CreateEntityCommand.ts:17` |
| Undoable command **πολλών** κολωνών | `CreateColumnsCommand` | `core/commands/entity-commands/CreateColumnsCommand.ts:29` |
| **ΕΝΑ atomic undo** για σύνθετη ενέργεια | `CompoundCommand` | `core/commands/CompoundCommand.ts:20` |
| Born-bound κολώνα ανά τομή κανάβου (mirror «βάλε σε θέσεις») | `column-from-grid.ts`, `column-grid-commit.ts` | `bim/columns/` |
| Enterprise IDs (N.6 — υποχρεωτικό για νέα entities) | `@/services/enterprise-id.service` | — |

### Auto-follow (τρέχουν μόνα τους μετά την εισαγωγή — ΜΗΝ προσθέσεις νέο reactive trigger)
| Concern | SSoT | Πού |
|---|---|---|
| Αυτόματο πέδιλο για νέα κολώνα (reconciler, gated `autoDesigned`) | `runAutoFoundationDesign` | `hooks/auto-foundation-design-core.ts:208` |
| Proactive re-sizing (events entity-created/entities-moved/loads-computed) | `useProactiveMemberSizing` | `hooks/useProactiveMemberSizing.ts` |
| Member-generic auto-size command | `AutoSizeMembersCommand` | `core/commands/entity-commands/AutoSizeMembersCommand.ts:60` |
| Associative reframe άκρων δοκού σε κολώνες | `reframeBeamEndpointsToColumns` / `cascadeBeamReframe` | `bim/beams/beam-column-reframe.ts:98` / `beam-column-reframe-cascade.ts:57` |

### Μηχανική (Επιλογή Α)
| Concern | SSoT | Πού |
|---|---|---|
| **span = `geometry.length`** (το κλειδί — εδώ αλλάζει η Α) | `buildBeamSectionContext` | `section-context.ts:~219` |
| Πλήθος/ids στηριζουσών κολωνών | `beamSupportColumnIds(graph, beamId)` | `loads/load-path-walk.ts:69` |
| DERIVED τύπος/πλήθος στήριξης | `resolveBeamSupportCondition` | `organism/derive-beam-support.ts:51` |
| Μοντέλο ροπών (ΕΠΕΚΤΑΣΗ για continuous) | `spanMomentDivisor` (simple=8/fixed=12/cantilever=2) | `codes/suggest-reinforcement.ts:273` |
| Η πρόταση «πόσες κολώνες + θέσεις» (Φάση 1 — reuse) | `suggestIntermediateColumnCount` | `organism/practical-span-checks.ts` |

### UX (opt-in confirm)
| Concern | SSoT | Πού |
|---|---|---|
| Generic confirm dialog | `components/ui/ConfirmDialog.tsx` | — |
| Precedent opt-in suggestion (mirror) | i18n `structuralOrganism.addFootingTitle/Message/Confirm` + `proactiveCancel` | `dxf-viewer-shell.json` |

### ⚠️ ΔΕΝ υπάρχει
- **Beam-split command** (μόνο wall-split ADR-363 Phase X). Αν επιλεγεί Β → νέο subsystem.
- **Continuous beam moment model** (μόνο simple/fixed/cantilever). Αν επιλεγεί Α → επέκταση `spanMomentDivisor` + hogging.

---

## 4. PLAN (μετά την απόφαση Α/Β — ενδεικτικό για Α)

> Δώσε **PLAN-FIRST** σε sub-slices, περίμενε «προχώρα», μετά κώδικας.

**Αν Α (inter-support span):**
1. **i18n ΠΡΩΤΑ** (N.11, el+en): `structuralOrganism.addIntermediateColumnsTitle/Message/Confirm` (mirror `addFooting*`).
2. **Pure SSoT** «θέσεις K κολωνών» πάνω στον άξονα δοκού (even split start→end· reuse axis geometry) → επιστρέφει K σημεία mm-world.
3. **Sizing-span = inter-support:** νέα pure «max clear sub-span μεταξύ διαδοχικών στηρίξεων» (reuse `beamSupportColumnIds` + projection θέσεων κολωνών στον άξονα)· wire στο `buildBeamSectionContext` ως **override** (mirror του `supportTypeOverride`/`designTorsionKnm` pattern — graphless callers fallback στο full span, μηδέν regression).
4. **Continuous moment model:** επέκταση `spanMomentDivisor` (continuous ~10-12) + hogging πάνω από ενδιάμεσες στηρίξεις (άνω οπλισμός) — **απόφαση Giorgio για τις τιμές**.
5. **Action command:** `CompoundCommand` = `CreateColumnsCommand`(K, enterprise IDs) → (reconciler πέδιλα auto) → (proactive re-size auto). ΕΝΑ atomic undo. Opt-in confirm dialog.
6. **Jest** (από repo ROOT) + **ADR-504 Φάση 2** changelog + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + MEMORY (N.15).

**Αν Β (beam-split):** ξεχωριστό, μεγαλύτερο plan — νέο split command + persistence + grip + reframe (μην ξεκινήσεις χωρίς ρητή προτίμηση Giorgio λόγω scope).

---

## 5. ΚΡΙΣΙΜΑ ΜΑΘΗΜΑΤΑ / GOTCHAS
- 🚨 **span = `geometry.length`** (ΟΧΙ inter-support) — το κλειδί όλης της Φάσης 2 (§2).
- 🚨 **ΠΟΤΕ σιωπηλή/υποχρεωτική εισαγωγή** — πάντα opt-in confirm (αίθριο/πυλωτή θέλουν το μεγάλο δοκάρι, ADR-487 §8.4/§9).
- 🚨 **Μην προσθέσεις νέο reactive trigger** — ο proactive κύκλος (sizing+οπλισμός+πέδιλα) τρέχει μόνος μετά την εισαγωγή (μάθημα ADR-491/502).
- 🚨 **Enterprise IDs (N.6)** για τις νέες κολώνες — `setDoc()` + id από `enterprise-id.service`, ΠΟΤΕ `addDoc`/`Date.now()`.
- 🚨 **Reuse, μηδέν διπλότυπα:** `suggestIntermediateColumnCount` (Φάση 1) δίνει ήδη K· οι θέσεις = even split· οι override-mechanisms = mirror `supportTypeOverride`.
- GOL: ≤40γρ/func, ≤500γρ/file, μηδέν `any`/inline-style, i18n keys ΠΡΩΤΑ.

## 6. PRE-EXISTING jest fails (baseline, ΟΧΙ δικά σου)
6 raft (ADR-476) + 1 `AssignWallTypeCommand`. Αν τα δεις → αγνόησέ τα.

## 7. ΜΕΤΑ ΤΗΝ ΥΛΟΠΟΙΗΣΗ (N.15 — ίδιο commit, αλλά COMMIT = GIORGIO)
Ενημέρωσε: **ADR-504** (Φάση 2 status/changelog) · `adr-index.md` (status → Φάση 1+2) · `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (1-2 γραμμές, ΜΟΝΟ τι εκκρεμεί) · MEMORY (`reference_practical_span_advisory.md` update). **ΜΗΝ** commit/push.
