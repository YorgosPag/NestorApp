# HANDOFF — ADR-493: Κυκλική κολώνα — (A) το δοκάρι δεν κολλάει στην παρειά + (B) επαλήθευση ορθότητας υπολογισμών κυκλικής

**Ημ/νία:** 2026-06-18 · **Από:** Opus session (μόλις ολοκλήρωσε ADR-491 FEM-driven column M-N + διόρθωση infinite-loop) · **Γλώσσα:** ΠΑΝΤΑ Ελληνικά.
**Τύπος:** 🔴 PLAN-FIRST. **SSoT AUDIT (GREP) ΥΠΟΧΡΕΩΤΙΚΟ ΠΡΙΝ ΚΩΔΙΚΑ.** ΜΗΝ γράψεις πριν εγκριθεί το plan από τον Giorgio.

> ⚠️ **Shared working tree** με άλλον agent. **git add ΜΟΝΟ τα δικά σου αρχεία, ΠΟΤΕ -A.** **commit = ο Giorgio (ΟΧΙ εσύ). tsc = ο Giorgio** (N.17, ένα tsc τη φορά). **jest = τρέξε από repo ROOT.**
> **Full Enterprise + Full SSOT + Revit/Robot-grade (GOL).** ≤40γρ/func, ≤500γρ/file, μηδέν `any`/`as any`/`@ts-ignore`, μηδέν hardcoded strings (i18n el+en), Select=`@/components/ui/select` (ADR-001).
> 🧭 **ΔΙΑΒΑΣΕ ΠΡΩΤΑ ΤΟ ΟΡΑΜΑ:** `docs/centralized-systems/reference/adrs/ADR-487-living-structural-organism-vision.md` (§3 «ΕΝΑΣ οργανισμός», §4 «σε κάθε κίνηση recompute»).
> 🖼️ **Screenshot αναφοράς:** `C:\Nestor_Pagonis\Στιγμιότυπο οθόνης 2026-06-18 223040.jpg` (κυκλική Ø400 + δοκάρι με ΚΕΝΟ στην παρειά).

---

## 0. ΤΟ ΣΕΝΑΡΙΟ (τι παρατήρησε ο Giorgio)

Έστησε πλήρη οργανισμό: **2 ορθογώνιες κολώνες + πέδιλα + δοκάρι** που τις ενώνει. Μετά **άλλαξε τον τύπο της μίας κολώνας σε ΚΥΚΛΙΚΗ** (Ø400, anchor=Κέντρο). Δύο ζητήματα:

- **(A) ΓΕΩΜΕΤΡΙΑ — το δοκάρι ΔΕΝ κολλάει σωστά στην παρειά της κυκλικής κολώνας** (ορατό **κενό** ανάμεσα στο άκρο του δοκαριού και το χείλος του κύκλου — βλ. screenshot).
- **(B) ΟΡΘΟΤΗΤΑ ΥΠΟΛΟΓΙΣΜΩΝ — γίνονται σωστά οι υπολογισμοί με κυκλική κολώνα ή μόνο με ορθογώνια;** (στατικά / οπλισμός / M-N / utilization / ποσότητες).

---

## 1. 🔑 ΑΡΧΙΚΑ ΕΥΡΗΜΑΤΑ AUDIT (από τον προηγούμενο agent — ΕΠΑΛΗΘΕΥΣΕ ΤΑ, μη τα εμπιστευτείς τυφλά)

### (B) Υπολογισμοί κυκλικής — **ΦΑΙΝΟΝΤΑΙ ΣΩΣΤΟΙ** (shape-aware SSoT ADR-460)
- `bim/structural/reinforcement/column-section-outline.ts` → `resolveColumnReinforcementSection(params)` είναι **shape-aware**: κυκλική → `grossAreaMm2 = π·(d/2)²` (ακριβές, ΟΧΙ 32-γωνο underestimate), `perimeterMm = π·d`, `mode='circular'`, `minThicknessMm = bbox = d`.
- Αυτό τροφοδοτεί το `buildColumnSectionContext` → `suggestColumnReinforcement` / `asStrengthColumnMm2` → άρα **οπλισμός + M-N + utilization + ποσότητες είναι shape-aware**.
- **Αριθμητική επαλήθευση από το screenshot:** Ø400, 7Ø16 → As=7·201=1407mm², Ac=π·200²=125664mm² → **ρ=1.12% ✓** (ταιριάζει με το panel). Όγκος καθαρός 0.368 m³ ≈ Ac·h − cutback ✓. FEM δίνει M_Ed=39.58 kNm.
- ⚠️ **ΕΚΚΡΕΜΕΙ deeper verify (Β):** ο M-N (`asMomentColumnMm2`) χρησιμοποιεί `z ≈ 0.81·minThicknessMm` ως μοχλοβραχίονα — για **κυκλική** ο σωστός μοχλοβραχίονας/ενεργό βάθος είναι διαφορετικός (EC2 §6.1, circular section · συντηρητικό αλλά ΟΧΙ ακριβές). Επίσης η περίσφιγξη (στεφάνι vs σπείρα), το `spacingBarCount` (perimeter branch), και το `nominalColumnEccentricityMm(d)` για κύκλο. **Παραδοτέο: τεκμηριωμένος πίνακας «τι είναι σωστό / τι είναι conservative-approx / τι είναι λάθος» για κυκλική, με αναφορές EC2/EC8.**

### (A) Γεωμετρία attachment — το cutback είναι **footprint-based & shape-agnostic** (άρα η ρίζα είναι αλλού)
- `bim/geometry/beam-column-cutback.ts` → `computeBeamCutbackOutline` + `computeBeamAxisToColumnContact` δουλεύουν με **column footprints (polygons)** + `safeDifference`. DERIVED, re-derive σε κάθε render. **Αν το footprint του κύκλου είναι σωστό polygon, το cutback ΑΚΟΛΟΥΘΕΙ αυτόματα** → η ρίζα του κενού είναι αλλού.
- **Ύποπτες ρίζες (διερεύνησε με σειρά):**
  1. **Persisted beam centerline (edge-anchor):** το δοκάρι δημιουργήθηκε όταν η κολώνα ήταν **ορθογώνια** → το persisted centerline τραβήχτηκε στην παρειά ορθογωνίου (`beam-completion.ts` edge-anchor / `column-face-trim.ts columnSupportAlong`). Αλλαγή τύπου → **το persisted ΔΕΝ ξανα-υπολογίζεται** → stub/κενό. (Για Ø400 vs 400×400 η παρειά κατά τον άξονα είναι ίδια =200, ΑΡΑ αν το κενό είναι μεγάλο, η ρίζα ΔΕΝ είναι αυτή — verify το repro.)
  2. **ADR-492 associative reframe (ΑΛΛΟΥ agent, shared tree):** `bim/beams/beam-column-reframe.ts` + `-cascade.ts` ξανα-κόβει persisted άκρα σε **MoveEntityCommand** — ΟΧΙ σε `bim:column-params-updated` (αλλαγή τύπου). Πιθανώς λείπει trigger «reframe σε αλλαγή τύπου/διαστάσεων κολώνας». ⚠️ ΜΗΝ το αλλάξεις χωρίς συνεννόηση (άλλου agent)· συντόνισε.
  3. **Circular footprint generation:** `bim/geometry/column-geometry.ts` → `buildCircularLocal(width, s)` (πόσα segments; κεντράρισμα;) + `columnLocalMmToWorld`/transform για κυκλική χρησιμοποιούν **απλό center-offset** (αγνοούν `CentredAnchorFrame`/anchor, σε αντίθεση με τα άλλα kinds — γρ. 332-333, 366-367). Έλεγξε: undersegmented κύκλος ή off-center footprint → λάθος cutback contact.
  4. **Rebar extent του δοκαριού** (πορτοκαλί) vs **body outline**: μήπως σταματούν σε διαφορετικό σημείο (διαφορετικό SSoT); Verify ότι το rebar layout του δοκαριού χρησιμοποιεί το cutback outline.

---

## 2. ⚖️ ΑΡΧΙΤΕΚΤΟΝΙΚΗ ΕΝΤΑΣΗ (απάντησέ τη ΠΡΙΝ το plan)

**DERIVED (cutback, re-derive σε κάθε render) vs PERSISTED (beam centerline + ADR-492 reframe).** Η Revit κρατά το **location line** persisted αλλά το **join-geometry** derived. Ερώτημα: η παρειά της κυκλικής πρέπει να επηρεάζει το **persisted** άκρο (reframe σε αλλαγή τύπου) ή μόνο το **derived** display (cutback);
- **(A)** Καθαρά DERIVED: το cutback/contact ΗΔΗ ακολουθεί την κυκλική (αν το footprint είναι σωστό) → η διόρθωση = εξασφάλισε σωστό circular footprint + εφάρμοσε το `computeBeamAxisToColumnContact` ΚΑΙ στο display path της αλλαγής τύπου. Μηδέν persisted churn. **Πιθανώς το πιο SSoT-καθαρό.**
- **(B)** Persisted reframe σε `bim:column-params-updated` (επέκταση ADR-492): το άκρο ξανα-κόβεται persisted. Ρίσκο: επικάλυψη/σύγκρουση με άλλου agent (ADR-492) + persisted churn.
- **(C)** Hybrid: persisted location-line αμετάβλητο· derived cutback shape-aware (κανόνας «κολώνα νικάει»). 

> Σύσταση (μη δεσμευτική): **(A/C)** — η παρειά είναι **derived join geometry**, ΟΧΙ persisted location line (Revit). Εξασφάλισε ότι ο DERIVED cutback είναι shape-correct για κύκλο ΚΑΙ ότι ενεργοποιείται/repaint-άρει στην αλλαγή τύπου. Συντονίσου με ADR-492 για να μη διπλο-λυθεί.

**Κρίσιμα sub-ζητήματα στο plan:** (1) ποιο SSoT παράγει το circular footprint & πόσα segments· (2) γιατί το κενό είναι μεγαλύτερο από το αναμενόμενο (Ø400 παρειά=200=ορθογώνιο)· (3) ποιος path (derived cutback ή persisted reframe) είναι ενεργός στο σενάριο· (4) repaint trigger στην αλλαγή τύπου.

---

## 3. 🔴 SSOT AUDIT (GREP) — ΤΡΕΞΕ ΞΑΝΑ ΟΛΑ ΠΡΙΝ ΓΡΑΨΕΙΣ. Παραδοτέο: πίνακας reuse vs new + απάντηση §2 + repro-confirmed root cause.

### 3.1 Γεωμετρία attachment / cutback (REUSE — μην ξαναφτιάξεις)
```
src/subapps/dxf-viewer/bim/geometry/beam-column-cutback.ts          ← DERIVED outline + axis-contact (footprint-based, shape-agnostic)
src/subapps/dxf-viewer/bim/geometry/column-geometry.ts              ← buildCircularLocal / materializeColumnLocalPolygonMm / columnLocalMmToWorld (circular footprint)
src/subapps/dxf-viewer/bim/columns/column-face-trim.ts              ← columnSupportAlong (footprint proj) + projectColumnCenterOnAxis (center-only)
src/subapps/dxf-viewer/hooks/drawing/beam-completion.ts             ← edge-anchor persisted centerline
src/subapps/dxf-viewer/hooks/canvas/dxf-scene-beam-cutback.ts       ← ο consumer του cutback στο 2Δ scene
src/subapps/dxf-viewer/bim/beams/beam-column-reframe.ts (+cascade)  ← ADR-492 persisted reframe (ΑΛΛΟΥ agent — ΜΗΝ ΑΓΓΙΞΕΙΣ χωρίς συνεννόηση)
src/subapps/dxf-viewer/bim/walls/wall-column-trim.ts                ← αναλογία (τοίχος→κολώνα), ίδιο SSoT face-trim
grep -rn "footprint\|columnSupportAlong\|computeBeamAxisToColumnContact\|buildCircularLocal" src/subapps/dxf-viewer/bim
```

### 3.2 Ορθότητα υπολογισμών κυκλικής (REUSE — verify, μην ξαναγράψεις engine)
```
src/subapps/dxf-viewer/bim/structural/reinforcement/column-section-outline.ts  ← resolveColumnReinforcementSection (shape-aware: grossArea/perimeter/mode κυκλικής)
src/subapps/dxf-viewer/bim/structural/codes/suggest-reinforcement.ts           ← asStrengthColumnMm2 / asMomentColumnMm2 / spacingBarCount (perimeter branch) / nominalColumnEccentricityMm
src/subapps/dxf-viewer/bim/structural/section-context.ts                        ← buildColumnSectionContext (καταναλώνει το section)
src/subapps/dxf-viewer/bim/structural/reinforcement/column-rebar-layout-resolve.ts  ← circular rebar layout (ακτινικές + δακτύλιος/σπείρα)
src/subapps/dxf-viewer/bim/structural/utilization/member-utilization.ts        ← columnUtilization (FEM-aware, ADR-491)
grep -rn "isCircular\|mode === 'circular'\|diameterMm\|COLUMN_LEVER_ARM" src/subapps/dxf-viewer/bim/structural
```

### 3.3 ADR-040 (αν αγγίξεις render/overlay)
```
docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md  ← CHECK 6B/6C/6D (canvas drawing files → stage ADR)
```

---

## 4. ΣΧΕΤΙΚΑ ADR (διάβασε όσα αγγίζεις· code = source of truth)
**ADR-487 (ΟΡΑΜΑ — ΠΡΩΤΟ)** · **ADR-458** (beam-column cutback — «κολώνα νικάει») · **ADR-460** (multi-shape column reinforcement — shape-aware section, το Β στηρίζεται εδώ) · **ADR-441** (column-face-trim / frame-into) · **ADR-492** (associative beam reframe — ΑΛΛΟΥ agent, επικάλυψη με Α) · **ADR-363 §5.7** (beam edge-anchor / flush) · ADR-491 (FEM-driven column M-N — μόλις ολοκληρώθηκε).

## 5. ΚΑΤΑΣΤΑΣΗ TREE (UNCOMMITTED — ΜΗΝ τα πειράξεις, είναι άλλων/προηγούμενων)
- **Προηγούμενα δικά μου (UNCOMMITTED, μπορείς REUSE):** ADR-491 (FEM-driven column M-N + `column-fem-moment.ts` + `engaged-analysis-result.ts` SSoT gate + active-resolver FEM-aware), ADR-486 §C, ADR-488, ADR-490.
- **Άλλου agent (shared tree, ΜΗΝ ΑΓΓΙΞΕΙΣ):** **ADR-492** (associative beam reframe — `beam-column-reframe*.ts`, `MoveEntityCommand`, `column-face-trim` projectColumnCenterOnAxis), ADR-489, ADR-484/483.
- **Επόμενος ελεύθερος ADR ≈ 493** (487=όραμα· 488/490/491=δικά μου· 489/492=άλλου). **ΕΠΙΒΕΒΑΙΩΣΕ με `ls docs/centralized-systems/reference/adrs/` πριν δεσμεύσεις** — ο άλλος agent είναι ενεργός.
- Γνωστά **pre-existing jest failures** (ΟΧΙ δικά σου): 2 raft/slab (ADR-476).

## 6. ΚΑΝΟΝΕΣ (ΑΠΑΡΑΒΑΤΟΙ — CLAUDE.md)
- **PLAN-FIRST:** ADR-487 read → SSoT audit (grep §3) → **repro-confirm τη ρίζα** (ζήτα από Giorgio το ακριβές gesture αν χρειαστεί) → πίνακας reuse vs new + απάντηση §2 (A/B/C & γιατί) → plan → **περίμενε «προχώρα»** → code.
- **ADR-driven (N.0.1):** PHASE 1 read CURRENT code (code wins) → PHASE 3 update ADR-493 (+ ADR-458/460 cross-ref) + adr-index + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + MEMORY (ίδιο commit).
- **Full SSoT (N.0.2):** ΜΗΝ φτιάξεις νέο cutback/section engine — υπάρχουν (ADR-458/460). Πρόσεξε ΕΠΙΚΑΛΥΨΗ με ADR-492 (άλλου agent) — συντονίσου, μη διπλο-λύσεις.
- **Β = επαλήθευση, ΟΧΙ ανακατασκευή:** στόχος = τεκμηριωμένος πίνακας ορθότητας κυκλικής (σωστό/approx/λάθος + EC2/EC8 refs)· διόρθωσε ΜΟΝΟ ό,τι είναι πραγματικά λάθος.
- **commit/tsc = ο Giorgio.** jest = από ROOT. **Shared tree: git add ΜΟΝΟ δικά σου.** **Απάντα ΠΑΝΤΑ Ελληνικά.**

## 7. ΕΡΓΑΛΕΙΟ ΕΠΑΛΗΘΕΥΣΗΣ
2 κολώνες (ορθογώνιες) + πέδιλα + δοκάρι → άλλαξε τη μία σε **κυκλική** (Ø400) → **(A)** το δοκάρι πρέπει να κολλάει ΑΚΡΙΒΩΣ στην παρειά του κύκλου (μηδέν κενό/stub, όπως στην ορθογώνια) σε 2Δ ΚΑΙ 3Δ· δοκίμασε ΚΑΙ διάφορες γωνίες δοκαριού (όχι μόνο οριζόντιο). **(B)** Σύγκρινε στατικά/οπλισμό/utilization ορθογώνιας vs κυκλικής ίδιας Ac → λογικές, EC-σύμφωνες τιμές (ρ, As, M_Rd, utilization ≤1 όταν επαρκεί).

## 8. ΑΡΧΗ ΣΧΕΔΙΑΣΗΣ (ADR-487 §3)
«ΕΝΑΣ οργανισμός»: αλλαγή τύπου κολώνας = μεταβολή του οργανισμού → ο cutback/οπλισμός/στατικά ΟΛΟΥ του πλαισίου πρέπει να ακολουθήσουν shape-aware, σε κάθε κίνηση. Καθαρός διαχωρισμός: persisted location-line vs derived join-geometry — ΕΝΑ source of truth ανά concern.
