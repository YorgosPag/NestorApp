# HANDOFF — Πορτοκαλί γραμμή-οδηγός (§3.20 quadrant-to-end) ΚΑΙ σε ΓΡΑΜΜΗ / ΠΟΛΥΓΡΑΜΜΗ / ΑΚΜΗ ΠΛΑΚΑΣ / ΟΡΘΟΓΩΝΙΟ ΠΛΑΙΣΙΟ

**Ημ/νία:** 2026-06-25
**Τύπος:** Feature (DXF/BIM Viewer — circular column placement alignment guide). Revit-grade, **FULL ENTERPRISE + FULL SSoT**.
**Γλώσσα απαντήσεων στον Giorgio: ΕΛΛΗΝΙΚΑ πάντα.**

---

## 🚨 ΚΑΝΟΝΕΣ ΣΥΝΕΔΡΙΑΣ (απαράβατοι)
- **COMMIT/PUSH κάνει ΜΟΝΟ ο Giorgio.** ΠΟΤΕ εσύ. (N.(-1))
- **Shared working tree με ΑΛΛΟΝ agent** → **ΠΟΤΕ `git add -A`**, stage ΜΟΝΟ τα δικά σου specific αρχεία. Ο άλλος agent αγγίζει ΕΝΕΡΓΑ το `bim/columns/column-face-snap.ts` (πρόσθεσε `headRefHit`/`column-reference-lines`/`columnHead`). **Re-grep/re-read στην αρχή** — γραμμές/anchors μπορεί να μετακινήθηκαν.
- **ΠΡΙΝ ΑΠΟ ΚΑΘΕ ΓΡΑΜΜΗ ΚΩΔΙΚΑ → ΠΡΑΓΜΑΤΙΚΟ SSoT AUDIT (grep)** για REUSE· ΜΗΔΕΝ διπλότυπα. Ο Giorgio κάνει σκληρό audit («κεντρικοποιημένο; υπάρχει ήδη; διπλότυπο; θα το έκανε έτσι η Revit;»).
- **FULL ENTERPRISE + FULL SSoT, όπως η Revit.** ΕΝΑ σημείο αλήθειας· preview ≡ commit by construction. Όχι `any`/`as any`· functions ≤40 γρ.· files ≤500 γρ. (N.7.1)· i18n (N.11).
- **N.14:** δήλωσε μοντέλο (**Opus** — geometry σε shared core resolver) & περίμενε «ok» πριν την υλοποίηση.
- **N.17:** ΕΝΑ tsc τη φορά (έλεγξε `Get-CimInstance … node.exe … tsc` ΠΡΙΝ). Verify με **jest** + browser.
- **ADR-driven (N.0.1):** code = source of truth· ενημέρωσε ADR + changelog στο τέλος.
- **100% ειλικρίνεια.** Boy-Scout (N.0.2).

---

## 1. ΤΟ ΖΗΤΟΥΜΕΝΟ (λόγια Giorgio)

> «Τη συμπεριφορά της πορτοκαλί γραμμής-οδηγού που μόλις υλοποίησες για τον **τοίχο**, να την έχουμε ΚΑΙ όταν ο κύκλος ολισθαίνει πάνω στον **άξονα μιας (οριζόντιας) γραμμής, ή πολυγραμμής, ή σε ακμή πλάκας, ή σε ένα ορθογωνικό πλαίσιο**.»

Δηλ. η **§3.20 quadrant-to-end alignment** (το ακραίο τεταρτημόριο της κυκλικής κουμπώνει στο **άκρο/μέσον** της αναφοράς + dashed πορτοκαλί **γραμμή-οδηγός**) να γενικευτεί από τον τοίχο σε **όλες** τις γραμμικές αναφορές + στο ορθογώνιο.

---

## 2. 🔬 SSoT AUDIT — ΤΙ ΗΔΗ ΥΠΑΡΧΕΙ (re-grep ΥΠΟΧΡΕΩΤΙΚΑ στην αρχή — anchors 2026-06-25)

### Τι ΔΟΥΛΕΥΕΙ ήδη (μην το ξαναφτιάξεις)
- **§3.20 SSoT (ΤΟ ΕΡΓΑΛΕΙΟ ΣΟΥ):** `bim/columns/column-tangent-snap.ts` →
  **`export function resolveQuadrantEndAlignment(alongFree, alongMin, alongMax, radius, a, u, halfThickness, wpp, scaleF) → { along, guide: PlacementAlignmentGuide | null }`**. Κουμπώνει το διαμήκες `along` σε `{alongMin+R, alongMax−R, μέσον}` (ζώνη `alignZone` 12px/60mm) + παράγει `perpGuide` στο άκρο/μέσον. **ΑΥΤΟ είναι το κοινό SSoT — reuse το παντού, ΜΗΝ ξαναγράψεις snap/guide math.**
- **`PlacementAlignmentGuide { a, b }`** (world segment) — export από `column-tangent-snap.ts`.
- **Render pipeline (έτοιμο):** `ColumnFaceSnap.alignmentGuide` → `placement-ghost-assembly.ts` (surface ως `alignmentGuide` στο preview entity) → `hooks/drawing/drawing-hover-handler.ts` (διαβάζει + `previewCanvasRef.current.drawAlignmentGuide(g)`) → `canvas-v2/preview-canvas/PreviewCanvas.tsx` (ref API) → `PreviewRenderer.ts` (`drawAlignmentGuide`) → `canvas-v2/preview-canvas/alignment-guide-paint.ts` (pure painter, dashed orange). **ΜΗΝ φτιάξεις νέο render path — απλώς βάλε `alignmentGuide` στο `ColumnFaceSnap` και ρέει αυτόματα.**
- **Tangent (#3/#4) σε ΓΡΑΜΜΗ/ΠΟΛΥΓΡΑΜΜΗ/ΑΚΜΗ ΠΛΑΚΑΣ → ΗΔΗ έχει οδηγό:** `resolveCircularTangentHit` → `resolveEdgeTangent` τρώει `[footprintEdgeTargets, slabTargets, lineTargets]` και ήδη καλεί την §3.20 (μέσω `snapAlongToEnds`). **Επιβεβαίωσε με grep/test — μάλλον δεν χρειάζεται αλλαγή στο tangent.**
- **Center-on-axis σε ΤΟΙΧΟ → ΗΔΗ έχει οδηγό (§3.20c):** `column-face-snap.ts` `resolveMemberAxisCenter(cursor, t, circle?: CircleGhostOpts)` καλεί `resolveQuadrantEndAlignment` όταν κυκλικό ghost. `CircleGhostOpts {radius, wpp, scaleF}` χτίζεται στο core (`resolveColumnFaceSnapFromTargets`) από `opts.circleRadiusScene`+`opts.worldPerPixel` και περνά μέσω `resolveForTarget(cursor, t, circle)`.

### ΤΑ ΚΕΝΑ (αυτό είναι το task)
- **(A) Center-on-axis (straddle) σε ΑΚΜΗ ΠΛΑΚΑΣ / ΓΡΑΜΜΗ / ΠΟΛΥΓΡΑΜΜΗ** → `column-face-snap.ts` **`resolveColumnEdgeSnap`** (γραμ. ~289) + **`buildEdgeCenterSnap`** (γραμ. ~223). Ο center-on-axis κλάδος (`foot = resolveAxisCenterFoot(...)` → `buildEdgeCenterSnap(ff, foot, rotation, face)`) **ΔΕΝ** έχει `alignmentGuide`. Αυτός είναι ο zero-width-edge ανάλογος του `resolveMemberAxisCenter` αλλά **χωρίς** το §3.20c.
- **(B) ΟΡΘΟΓΩΝΙΟ ΠΛΑΙΣΙΟ (Cartesian Magnet §3.15)** → `column-face-snap.ts` **`resolveRectHit`** (γραμ. ~401) → `bim/columns/rect-cartesian-snap.ts` **`resolveRectCartesianSnap`**. `RectFrame { center, u, v, halfW, halfV }` (`bim/framing/rect-frame.ts`). Δεν έχει quadrant-to-edge alignment/guide. Εδώ είναι **2D** (κατά u ΚΑΙ v) → το τεταρτημόριο κουμπώνει στις πλευρές `±halfW`/`±halfV` (πιθανώς 2 οδηγοί ταυτόχρονα).

---

## 3. 🎯 ΠΡΟΤΕΙΝΟΜΕΝΟ ΣΧΕΔΙΟ (FULL SSoT — επιβεβαίωσε με grep ΠΡΩΤΑ)

**Κεντρική ιδέα:** το `resolveQuadrantEndAlignment` (1D) είναι ο πυρήνας· εφάρμοσέ το στα paths που λείπει.

### Φάση A — Γραμμή/Πολυγραμμή/Ακμή πλάκας (center-on-axis), ΕΥΚΟΛΟ:
1. Πέρασε `CircleGhostOpts` (radius/wpp/scaleF) στο `resolveColumnEdgeSnap` (το core ήδη το χτίζει — δώσ' το ως param, όπως στο `resolveForTarget`).
2. Στον center-on-axis κλάδο: `resolveQuadrantEndAlignment(foot.along, ff.faceAlongMin, ff.faceAlongMax, radius, ff.origin, ff.axisDir, 0 /*zero-width edge → halfThickness 0*/, wpp, scaleF)` → snapped `along` + `guide`.
3. `buildEdgeCenterSnap` να δέχεται/εκπέμπει το `alignmentGuide` + να χρησιμοποιεί το snapped `along` για το `position`/`faceFrame` (mirror του `resolveMemberAxisCenter`). **ΠΡΟΣΟΧΗ §3.20c-core-fix:** χρησιμοποίησε τον ΑΞΟΝΑ της ακμής (perp 0), ΟΧΙ τη μπάντα ±`len·0.001` (core-not-band, βλ. ADR-398 §3.20c).
4. Reuse `buildCenteredAxisFaceFrame` με `ghostPerpOffset` αν θες ΚΑΙ κάθετη dim (προαιρετικό — ο Giorgio το ζήτησε για τοίχο· ρώτα αν το θέλει και για γραμμές).

### Φάση B — Ορθογώνιο πλαίσιο (Cartesian Magnet, ΜΕΣΑΙΟ, 2D):
1. Στο `resolveRectCartesianSnap`/`resolveRectHit`: μετά το local-frame snap (x κατά u, y κατά v), εφάρμοσε quadrant-to-edge: αν `|localX| + R ≈ halfW` → snap σε `halfW − R` (πλευρά u) + guide στην πλευρά `±halfW` (κατακόρυφο τμήμα κατά v). Ομοίως για v/`halfV`.
2. Reuse: η §3.20 λογική είναι 1D — εφάρμοσέ τη **ΞΕΧΩΡΙΣΤΑ** σε u και σε v (δύο κλήσεις `snapAlongToEnds`-style). Ίσως χρειαστεί νέο export `snapLocalToRectEdges` στο `column-tangent-snap.ts` ή γενίκευση. **ΑΠΟΦΑΣΗ Giorgio (ρώτα):** 1 guide (η πλησιέστερη πλευρά) ή 2 ταυτόχρονα (γωνία ορθογωνίου);
3. `RectFrame.localToWorld` (export στο `rect-frame.ts`) για world σημεία του οδηγού.

**ΜΗΔΕΝ νέα geometry/anchor pipeline.** Η κυκλική geometry αγνοεί anchor (ADR-363) → όλα γίνονται με `position`+`anchor:'center'`+`alignmentGuide` (όπως §3.19/§3.20).

---

## 4. ❓ ΑΝΟΙΧΤΑ ΣΗΜΕΙΑ (ρώτα τον Giorgio με ΣΥΓΚΕΚΡΙΜΕΝΟ αριθμητικό παράδειγμα ΠΡΙΝ προχωρήσεις)
- **Ορθογώνιο: 1 ή 2 οδηγοί;** Όταν το τεταρτημόριο κουμπώνει σε γωνία ορθογωνίου, να δείχνει 2 γραμμές (u-edge + v-edge) ή μόνο την πλησιέστερη; (παράδειγμα: κύκλος R=200 σε ορθογώνιο 1000×600 — quadrant στη ΝΑ γωνία → 2 οδηγοί;)
- **Κάθετη dim (§3.20b) ΚΑΙ σε γραμμές/ορθογώνιο;** Ο Giorgio τη ζήτησε για τοίχο. Για ακμές μηδενικού πάχους έχει νόημα η perp dim = R; (μάλλον ναι — δείχνει το κάθετο offset).
- **Πολυγραμμή:** ανά **τμήμα** (κάθε segment = αναφορά με δικά του άκρα) ή ως ενιαία; (το `polylineEdgeTargets` τα δίνει ανά τμήμα — μάλλον ανά τμήμα).
- **Center-on-axis threshold σε ακμή:** `SLAB_EDGE_CENTER_THRESHOLD_MM` (=150) — ίδιο για το quadrant-align ή ευρύτερο;

---

## 5. ΕΠΑΛΗΘΕΥΣΗ
- **jest:** `bim/columns/__tests__/column-tangent-snap.test.ts` (ΗΔΗ 19 tests — πρόσθεσε): (α) γραμμή οριζόντια, κύκλος R, cursor στον άξονα + along=end−R → `alignmentGuide` defined στο άκρο· (β) ορθογώνιο, quadrant στη γωνία → guide(s)· (γ) regression: μη-κυκλικό → κανένας οδηγός (gated)· tangent σε γραμμή ΑΜΕΤΑΒΛΗΤΟ.
- **Browser (Giorgio):** κυκλική κολόνα → ολίσθηση σε γραμμή/πολυγραμμή/ακμή πλάκας/ορθογώνιο → πορτοκαλί οδηγός στο άκρο/μέσον/γωνία (όπως στον τοίχο). Center-on-axis ΚΑΙ tangent.
- ⚠️ CHECK 6B/6D (snap/preview canvas) → stage **ADR-040 + ADR-398 (+ ADR-514)** μαζί.

## 6. ΣΧΕΤΙΚΑ ADR
- **ADR-398** §3.19 (circumference-tangent), §3.20 (quadrant-to-end), §3.20b (κάθετη dy dim), §3.20c (core-not-band + center-on-axis guide), §3.18b (oriented bbox slanted slide). **Εδώ ζει το νέο §3.20d (lines/polylines/slab/rect).**
- **ADR-514** (Unified BIM Cursor Snap — ο εγκέφαλος· Φ6f/g/h).
- **ADR-040** (preview canvas perf — architecture-critical, stage μαζί).

## 7. ⚠️ ΚΑΤΑΣΤΑΣΗ — ΟΛΑ UNCOMMITTED (2026-06-25)
Τα §3.18b/§3.19/§3.20/§3.20b/§3.20c είναι **υλοποιημένα + jest-verified + tsc 0 αλλά UNCOMMITTED** (ο Giorgio θα κάνει commit). Αρχεία που άγγιξα (stage ΜΟΝΟ αυτά + τα νέα του task):
`bim/columns/column-tangent-snap.ts` (NEW), `bim/columns/column-face-snap.ts`, `bim/columns/column-face-snap-helpers.ts`, `bim/columns/polar-disk-snap.ts`, `bim/columns/column-polar-opts.ts`, `bim/framing/linear-member-face-snap.ts`, `bim/framing/ghost-face-dim-references.ts`, `bim/placement/placement-ghost-assembly.ts`, `hooks/drawing/column-preview-helpers.ts`, `hooks/drawing/drawing-hover-handler.ts`, `canvas-v2/preview-canvas/PreviewCanvas.tsx`, `canvas-v2/preview-canvas/PreviewRenderer.ts`, `canvas-v2/preview-canvas/alignment-guide-paint.ts` (NEW), `systems/cursor/mouse-handler-up.ts`, `bim/columns/__tests__/column-tangent-snap.test.ts` (NEW), ADR-398/ADR-514.

## 8. EXACT ANCHORS (re-grep — μπορεί να μετακινήθηκαν, shared file)
- Κοινό SSoT: `column-tangent-snap.ts` → `resolveQuadrantEndAlignment` (export)· `snapAlongToEnds`/`perpGuide`/`alignZone` (private — εξήγαγέ τα ή γενίκευσε αν χρειαστεί για rect 2D)· `PlacementAlignmentGuide`.
- Φάση A: `column-face-snap.ts` → `resolveColumnEdgeSnap` (~289), `buildEdgeCenterSnap` (~223)· πρότυπο = `resolveMemberAxisCenter` (~183, ΗΔΗ έχει §3.20c — αντίγραψε το pattern).
- Φάση B: `column-face-snap.ts` → `resolveRectHit` (~401)· `bim/columns/rect-cartesian-snap.ts` → `resolveRectCartesianSnap`· `bim/framing/rect-frame.ts` → `RectFrame`/`localToWorld`.
- Core caller (χτίζει `CircleGhostOpts`): `resolveColumnFaceSnapFromTargets` (~490+) — `circleOpts` ήδη υπάρχει· πέρασέ το ΚΑΙ στο `resolveColumnEdgeSnap`/`resolveRectHit`.
