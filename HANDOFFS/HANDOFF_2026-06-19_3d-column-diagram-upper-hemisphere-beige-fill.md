# HANDOFF — 3Δ διαγράμματα M/V/N κολώνας: **«μπεζ» γέμισμα όταν κοιτάς από το ΠΑΝΩ ημισφαίριο** (ADR-483 Slice 5)

**Ημ/νία:** 2026-06-19 · **Γλώσσα: ΠΑΝΤΑ Ελληνικά στον Giorgio.** · **Commit/push = ΜΟΝΟ ο Giorgio (N.-1).**
> ⚠️ **Shared working tree** με άλλον agent (ADR-499). `git add` **ΜΟΝΟ δικά σου αρχεία**, **ΠΟΤΕ `git add -A`**. tsc = **ένας τη φορά** (N.17 — έλεγξε running tsc ΠΡΩΤΑ με `Get-CimInstance`). **ΜΗΝ αγγίξεις** uncommitted αρχεία του ADR-499 agent (λίστα §6).

**Απαιτήσεις Giorgio (αυτολεξεί):** «ΟΠΩΣ Η REVIT, ΜΕ ΣΥΣΤΗΜΑ FULL ENTERPRISE + FULL SSOT». **ΠΡΙΝ γράψεις κώδικα → πραγματικό SSoT audit (grep)** για να μη δημιουργήσεις διπλότυπα — χρησιμοποίησε υπάρχοντα. **Plan mode** πριν υλοποιήσεις, **ζήτα έγκριση**.

---

## 1. ΤΟ ΖΗΤΟΥΜΕΝΟ (το ΜΟΝΟ που εκκρεμεί)

**Bug (repro, αυτολεξεί Giorgio):** *«Αν θεωρήσουμε πως η κατασκευή βρίσκεται μέσα σε μια σφαίρα: όταν την περιστρέφω και κοιτάζω το **πάνω ημισφαίριο** (κάμερα από ψηλά προς τα κάτω), τα **γεμίσματα του διαγράμματος εμφανίζονται με μπεζ χρώμα**. Όταν την κοιτάζω από το **κάτω ημισφαίριο**, όλα λειτουργούν σωστά.»*

**Καθαρό από:** πρόσοψη/περιμετρικές 2Δ όψεις (ViewCube faces) → ΟΚ. Από κάτω → ΟΚ. **Μόνο από πάνω → μπεζ γέμισμα.**

**Στόχος:** το γέμισμα (μπλε hogging / κόκκινο sagging, V/N μονόχρωμα) να φαίνεται **σωστό από ΚΑΘΕ γωνία**, συμπεριλαμβανομένου του πάνω ημισφαιρίου — Revit/Robot-grade.

---

## 2. ΔΙΑΓΝΩΣΗ — leading hypothesis (επιβεβαίωσέ την ΠΡΩΤΑ με στιγμιότυπο + grep)

Η **ασυμμετρία πάνω/κάτω** είναι το κρίσιμο στοιχείο. Με `MeshBasicMaterial` (unlit) + `side: THREE.DoubleSide` + **opaque**, το χρώμα είναι **ανεξάρτητο γωνίας** — άρα το «μπεζ» **ΔΕΝ** μπορεί να είναι το ίδιο το υλικό του γεμίσματος. Κάτι **beige** μπαίνει ανάμεσα/πίσω **μόνο από πάνω**:

- **#1 (πιθανότερο) — η ΠΛΑΚΑ (σκυρόδεμα, beige) αποκρύπτει το διάγραμμα από πάνω.** Η κατασκευή έχει πλάκα ΠΑΝΩ από τις κολώνες (φαίνεται στα στιγμιότυπα). Το γέμισμα είναι **opaque + depth-tested** (+`polygonOffset` που το σπρώχνει ελαφρά πίσω) → από το πάνω ημισφαίριο η πλάκα είναι μπροστά → occlusion → ο χρήστης βλέπει **beige πλάκα** αντί για το διάγραμμα. Από κάτω δεν παρεμβάλλεται τίποτα → καθαρό. **Αυτό εξηγεί ΤΕΛΕΙΑ την ασυμμετρία.**
- **#2** — το φόντο/σκηνή (ground/sky) είναι beige και το επίπεδο διάγραμμα γίνεται **edge-on** από κατακόρυφες γωνίες (το billboard διορθώνει ΜΟΝΟ yaw, ΟΧΙ pitch· βλ. §3 «billboard») → φαίνεται το beige πίσω.
- **#3** — renderer toneMapping/environment tint ή winding/culling (λιγότερο πιθανό λόγω DoubleSide).

**ΕΠΑΛΗΘΕΥΣΗ ΠΡΙΝ ΥΛΟΠΟΙΗΣΕΙΣ:** ζήτα στιγμιότυπο από την «κακή» πάνω γωνία· grep το χρώμα της πλάκας/σκηνής:
- `material-catalog-defs` / `getElementMaterial3D('slab')` / `scene-setup.ts` (background) — δες αν το beige = πλάκα ή φόντο.
- Αν beige == πλάκα → επιβεβαιώνεται η #1.

---

## 3. ΛΥΣΗ (Revit/Robot-grade — διάλεξε με Giorgio στο plan)

Στη Revit/Robot τα **analysis diagrams είναι overlay που σχεδιάζεται ΠΑΝΩ από το μοντέλο** (πάντα ορατό, δεν το κρύβει πλάκα/τοίχος). Το **2Δ** overlay μας (`StructuralDiagramOverlay`) ήδη είναι always-on-top (ξεχωριστό canvas). Το 3Δ πρέπει να κάνει το ίδιο.

- **Option A (προτείνεται, matches 2Δ + label):** το γέμισμα (+outline) **always-on-top** — `material.depthTest=false` + `depthWrite=false` + υψηλό `renderOrder` (όπως ΗΔΗ κάνει το sprite-label, που φαίνεται σωστά από παντού). Έτσι το διάγραμμα είναι **πάντα ορατό** από κάθε ημισφαίριο, δεν το κρύβει η πλάκα. ⚠️ Παρενέργεια: θα ζωγραφίζεται και πάνω από κοντινότερες κολώνες (floating-overlay look) — **αυτό είναι το αναμενόμενο για analysis overlay** (Robot το κάνει). Κράτα opaque ώστε να μη γίνει μπεζ από blending (μάθημα fix #2).
- **Option B:** κράτα depth-tested (η απόκρυψη από πλάκα είναι «φυσικά σωστή»), αλλά τότε ο Giorgio ΔΕΝ το θέλει (το θεωρεί bug).
- **(προαιρετικό) full-billboard pitch:** αν θέλει να μη γίνεται edge-on ποτέ ούτε από πάνω/κάτω, το pivot πρέπει να στρέφεται και κατά pitch — ΑΛΛΑ τότε χάνεται η κατακόρυφη αναφορά. Πρότεινε στον Giorgio: «κρατάμε κατακόρυφο άξονα (σωστό δομικά)· για να φαίνεται από πάνω κάνουμε το γέμισμα always-on-top». Μη φτιάξεις full-billboard χωρίς έγκριση.

**Πρόταση:** Option A (always-on-top opaque). Είναι μικρή, στοχευμένη αλλαγή στο `column-diagram-3d-mesh.ts` (στο `fillMesh` + στο `LineBasicMaterial` του outline: `depthTest:false, depthWrite:false` + `renderOrder` στα fills/line μικρότερο από το label ώστε label > fill > outline order). Επιβεβαίωσε με Giorgio + στιγμιότυπο.

---

## 4. ΤΙ ΕΧΕΙ ΓΙΝΕΙ ΗΔΗ (ADR-483 Slice 5 — UNCOMMITTED, ΧΤΙΣΕ ΕΠΑΝΩ, ΜΗΝ ξαναγράψεις)

3Δ διαγράμματα M/V/N κολώνας κατά τον κατακόρυφο άξονα (το 2Δ overlay = δοκάρια/κάτοψη· κολώνα=σημείο σε plan → 3Δ). **ΕΝΑ toggle** «Διαγράμματα M/V/N» (`showAnalysisDiagrams`) + selector `diagramComponent`: 2Δ δοκάρια όταν `mode==='2d'`, 3Δ κολώνες όταν `mode!=='2d'`. Το FEM (ADR-481) λύνει ΗΔΗ τις κολώνες (per-station M/V/N)· τα νούμερα/επάρκεια υπήρχαν (ADR-482/491).

**Αρχεία (ΟΛΑ δικά μου, UNCOMMITTED):**
- **NEW** `bim/structural/analytical/diagrams/member-diagram-sampling.ts` — SSoT de-dup των sampling helpers (`selectCombination`/`dominantMomentKey`/`dominantShearKey`/`stationValue`/`recoverUdlKnM`/`clamp01`), κοινό 2Δ+3Δ.
- **MOD** `bim/structural/analytical/diagrams/member-diagram-geometry.ts` — import sampling + re-export `DiagramComponent`/`DiagramSample` (zero behaviour change).
- **NEW** `bim-3d/diagrams/column-diagram-3d-geometry.ts` — pure `buildColumnDiagram3DPaths` (column-only· άξονας base→top· f=xM/L· extremum· domain-agnostic μέτρα).
- **NEW** `bim-3d/diagrams/column-diagram-3d-mesh.ts` — `buildColumnDiagram3DGroup` (γέμισμα signed δίχρωμο + outline + sprite label) + `billboardColumnDiagrams(group,camera)` + exported `COLUMN_DIAGRAM_COLORS`/`COLUMN_DIAGRAM_PIVOT_FLAG`/`COLUMN_DIAGRAM_3D_GROUP_NAME`. **← ΕΔΩ θα κάνεις τη διόρθωση (always-on-top fill).**
- **NEW** `bim-3d/diagrams/ColumnDiagram3DOverlay.tsx` — lifecycle (mirror `ProposalGhost3DOverlay`) + billboard via `UnifiedFrameScheduler` LOW + camera-dirty.
- **MOD** `bim-3d/viewport/BimViewport3D.tsx` — mount `<ColumnDiagram3DOverlay managerRef={managerRef}/>` μετά το `ProposalGhost3DMount`.
- **NEW tests** `bim-3d/diagrams/__tests__/column-diagram-3d-{geometry,mesh}.test.ts` (14 GREEN).
- **MOD** ADR-483 (§10 Slice 5 + changelog fix#1/#2), adr-index (2 γραμμές), `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`.

**Ιστορικό διορθώσεων (ΜΗΝ τα ξανακάνεις):**
- fix#1: signed δίχρωμο γέμισμα (μπλε hogging/κόκκινη sagging, split zero-crossings, mirror 2Δ `fillSignedRibbon`)· label always-on-top.
- fix#2: opaque + `polygonOffset` (translucent DoubleSide blending → μπεζ)· απαλοί τόνοι `COLUMN_DIAGRAM_COLORS` SSoT· **billboard** γύρω από κατακόρυφο άξονα (pivot/κολώνα· edge-on foreshortening στο orbit).
- label fix: διαφανές φόντο + λευκό κείμενο + σκούρο halo (το κρεμ κουτί φαινόταν «μπεζ»).

> **Το παρόν bug (πάνω ημισφαίριο) ΔΕΝ έχει λυθεί** — είναι το επόμενο βήμα.

---

## 5. SSoT ANCHORS (REUSE — μηδέν διπλότυπα· ΚΑΝΕ ΚΑΙ ΔΙΚΟ ΣΟΥ grep)

| Concept | SSoT (reuse/extend) |
|---|---|
| **3Δ γέμισμα/mesh κολώνας (EDIT εδώ)** | `bim-3d/diagrams/column-diagram-3d-mesh.ts` (`fillMesh`, `buildPathFill`, `buildColumnDiagram3DGroup`, `billboardColumnDiagrams`). Η διόρθωση always-on-top = εδώ. |
| **3Δ overlay lifecycle (REFERENCE)** | `bim-3d/proposal/ProposalGhost3DOverlay.tsx` + `coordination/ClashMarkers3DOverlay.tsx` (camera-aware per-frame, `UnifiedFrameScheduler` LOW + camera-dirty). |
| **Always-on-top precedent** | το sprite-label μου (depthTest:false + renderOrder) ΗΔΗ φαίνεται σωστά από παντού· **το ίδιο pattern** εφάρμοσε στα fills/outline. Δες και 2Δ `StructuralDiagramOverlay` (always-on-top canvas). |
| **3Δ υλικά/χρώμα πλάκας (διάγνωση beige)** | `bim-3d/converters/*` `getElementMaterial3D`, `material-catalog-defs`, `scene-setup.ts` (background). Grep για να επιβεβαιώσεις ότι beige = πλάκα. |
| **Sampling (μη ξαναγράψεις)** | `member-diagram-sampling.ts`. |
| **Camera/scene API** | `ThreeJsSceneManager.getCamera()` / `.scene` / `.getRendererCanvas()`. |
| **Frame scheduler** | `rendering/core/UnifiedFrameScheduler` (`register(id,name,RENDER_PRIORITIES.LOW,tick,shouldRun)`). |

---

## 6. ❌ ΜΗΝ ΑΓΓΙΞΕΙΣ (ADR-499 agent — shared tree, uncommitted)

`bim/structural/codes/*` (flexural-capacity, suggest-reinforcement, suggest-slab-reinforcement, structural-code-types, eurocode/greek-legacy-provider), `bim/structural/sizing/*`, `core/commands/entity-commands/AutoSizeMembersCommand.ts`, `hooks/member-auto-size-core.ts`, `bim/types/column-types.ts`, `bim/types/slab-types.ts`, `bim/structural/__tests__/topology-aware-beam-support.test.ts`, `ADR-499-*.md`.
⚠️ **`adr-index.md` το επεξεργαζόμαστε ΚΑΙ οι δύο** (εγώ ADR-483/496, αυτός ADR-499) — διαφορετικές γραμμές· συντονισμός στο `git add` (πρόσθεσε ΜΟΝΟ τις δικές σου γραμμές, ή stage το αρχείο γνωρίζοντας ότι περιέχει και τις δικές του).

**Επίσης UNCOMMITTED δικό μου (άσχετο, μη το μπερδέψεις):** **ADR-496 Phase 3** (L-shape dual-leg corner) — `bim/columns/column-beam-align.ts` (+test), `ADR-496.md`. Ολοκληρωμένο, περιμένει commit Giorgio. Μην το αγγίξεις εκτός αν στο πει.

---

## 7. ΕΚΤΕΛΕΣΗ (νέα συνεδρία)

1. Διάβασε: αυτό το handoff + `docs/.../adrs/ADR-483-static-analysis-canvas-diagrams.md` (§10 Slice 5 + changelog) + `~/.claude/.../memory/reference_column_mvn_3d_diagrams.md`.
2. **Ζήτα στιγμιότυπο** από την πάνω-ημισφαίριο «κακή» γωνία (confirm repro) + **grep** το χρώμα πλάκας/σκηνής (επιβεβαίωσε hypothesis #1).
3. **SSoT grep audit** (§5· always-on-top precedent = label + 2Δ overlay).
4. **Plan mode** → Option A (always-on-top opaque fill+outline· renderOrder: label > fill > outline) ή ό,τι δείξει η διάγνωση → **έγκριση Giorgio**.
5. Υλοποίηση (στοχευμένη στο `column-diagram-3d-mesh.ts`) + jest update (αν χρειαστεί assert depthTest:false στα fills) + tsc background (N.17, ένας τη φορά).
6. **ADR-483 changelog** (fix#3) + adr-index (αν αλλάξει status) + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + MEMORY (`reference_column_mvn_3d_diagrams`). N.15.
7. **ΜΗΝ** commit — ο Giorgio.

**Commands:** jest `npx jest src/subapps/dxf-viewer/bim-3d/diagrams/__tests__` (14 GREEN τώρα)· tsc `npx tsc --noEmit` (έλεγξε running πρώτα, N.17).

## 8. ΜΑΘΗΜΑΤΑ (από αυτή τη συνεδρία)
- **«μπεζ» σε 3Δ analysis overlay** πέρασε 3 φάσεις: (α) translucent blending → opaque· (β) κρεμ label-background → διαφανές· (γ) **occlusion από πλάκα στο πάνω ημισφαίριο → (επόμενο) always-on-top**. Μάθημα: 3Δ analysis diagram = overlay ΠΑΝΩ από το μοντέλο (όπως το 2Δ), ΟΧΙ depth-tested geometry.
- **billboard κατακόρυφου άξονα** (yaw) κρατά τον άξονα κατακόρυφο (σωστό δομικά)· δεν λύνει pitch edge-on — γι' αυτό always-on-top, ΟΧΙ full-billboard.
- per-frame camera-aware 3Δ = `UnifiedFrameScheduler` LOW + camera-dirty signature (mirror ClashMarkers), ΟΧΙ React state.
- `MeshBasicMaterial` = unlit → χρώμα ανεξάρτητο γωνίας· αν δεις γωνιακή διαφορά χρώματος → occlusion/blending/background, ΟΧΙ το υλικό.
