# HANDOFF — ADR-473 Joint Rebar: Dowel anchorage μέσα στο πέδιλο (Revit-grade)

**Ημερομηνία:** 2026-06-17
**ADR:** ADR-473 (Joint Reinforcement 3D Render + BOQ Takeoff)
**Μοντέλο test:** «Π» πύλη (2 πέδιλα + 2 κολόνες + 1 δοκάρι)
**Working tree:** ΜΟΙΡΑΖΕΤΑΙ με άλλον agent → `git add` ΜΟΝΟ δικά σου αρχεία, ΠΟΤΕ `git add -A`
**Commit:** ΤΟΝ ΚΑΝΕΙ Ο GIORGIO — ΕΣΥ ΟΧΙ (N.(-1))
**Ποιότητα:** FULL ENTERPRISE + FULL SSOT, Revit-grade. ΠΡΙΝ κώδικα → πραγματικό SSoT audit (grep).

---

## 🔴 ΚΥΡΙΟ TASK (open bug)

Στο 3Δ, οι **αναμονές (dowels) κολόνας↔πεδίλου προεξέχουν ΚΑΤΩ από τη βάση του πεδίλου
και μπαίνουν στο χώμα** (screenshot `Στιγμιότυπο οθόνης 2026-06-17 230226.jpg`: κόκκινες
κατακόρυφες ράβδοι κάτω από το καφέ πέδιλο).

### Ρίζα

`src/subapps/dxf-viewer/bim-3d/converters/joint-rebar-3d.ts` → `dowelSegs()` (~γρ. 85-100):

```typescript
const anchorMm = provider.anchorageLengthMm(item.diameterMm);
const bottomY = (ftgNode.topZmm - anchorMm) * MM_TO_M;   // ← BUG
```

Το `bottomY` τοποθετείται σε **κορυφή πεδίλου − μήκος αγκύρωσης**. Όταν το `anchorMm`
(π.χ. ~640mm για Ø16 EC2) **υπερβαίνει το πάχος του πεδίλου** (π.χ. 400-500mm), το
`bottomY < ftgNode.baseZmm` → η ράβδος τρυπά τη βάση του πεδίλου προς τα κάτω.

### Revit-grade σωστή λύση (mirror του beam-anchorage fix αυτής της συνεδρίας)

Στη Revit οι starter bars (αναμονές) κατεβαίνουν μέσα στο πέδιλο και **κάμπτονται (L-foot)
στη βάση**, ακουμπώντας στην κάτω σχάρα. Το κατακόρυφο σκέλος ΔΕΝ ξεπερνά το (πάχος − cover)·
το υπόλοιπο μήκος αγκύρωσης δίνεται με οριζόντιο κάμπτη στη βάση.

1. **Clamp κατακόρυφου σκέλους:** `bottomY = max(ftgNode.topZmm − anchorMm, ftgNode.baseZmm + cover)`
2. **Οριζόντιος L-foot στη βάση** (αν `anchorMm` > διαθέσιμο βάθος): υπόλοιπο = `anchorMm − (ftgNode.topZmm − bottomZmm)`, σχεδιάζεται οριζόντια μέσα στο footprint του πεδίλου (ίδιο pattern με το `footprintFarReach` που μπήκε αυτή τη συνεδρία στο `anchorageBeamSegs`).

---

## ✅ SSoT AUDIT (κάνε ξανά grep — εδώ τα ευρήματα μέχρι τώρα: ΧΡΗΣΙΜΟΠΟΙΗΣΕ τα, ΜΗΝ διπλασιάσεις)

| Τι χρειάζεσαι | Υπάρχον SSoT | Πού |
|---|---|---|
| Βάση πεδίλου (footing bottom Z) | `StructuralNode.baseZmm` — **ήδη in scope** στο `dowelSegs` ως `ftgNode.baseZmm` | `foundations/footing-element-summary.ts` (`baseZmm = topZmm − thicknessMm`) |
| Κορυφή πεδίλου | `ftgNode.topZmm` | ίδιο |
| Cover πεδίλου + ενεργό βάθος | `footingEffectiveDepthMm(thicknessMm, coverMm)`, `r.coverMm` | `structural/reinforcement/footing-reinforcement-compute.ts` (γρ. 99-101) |
| End-anchorage/hook factor σχάρας | `MAT_END_ANCHORAGE_FACTOR` | ίδιο αρχείο |
| Μήκη ανάπτυξης (SSoT provider) | `anchorageLengthMm(d, ctx?)`, `lapLengthMm(d, ctx?)` | `structural/codes/structural-code-types.ts` (γρ. 333-339), impl: `eurocode-provider.ts`, `greek-legacy-provider.ts` |
| Θέσεις ράβδων κολόνας (cage parity) | `columnBarPositions()` helper | **ΗΔΗ μέσα** στο `joint-rebar-3d.ts` (reuse `resolveColumnRebarLayout`) |
| L-shape pattern (οριζ. σκέλος + κάμπτης) | `footprintFarReach()` + L-construct | **ΗΔΗ μέσα** στο `joint-rebar-3d.ts` `anchorageBeamSegs` (αυτή η συνεδρία) — αντέγραψε τη λογική |

> ⚠️ ΜΗΝ φτιάξεις νέο cover constant / νέο anchorage helper. Ο `dowelSegs` ΕΧΕΙ ΗΔΗ
> `ftgNode` (με baseZmm/topZmm) + `provider`. Λείπει μόνο το `coverMm` του πεδίλου —
> πάρ' το από το footing reinforcement (`r.coverMm`) ή, αν δεν είναι προσβάσιμο εκεί,
> πέρασέ το μέσω του continuity item / node. **Κάνε grep πρώτα** για το πώς ρέει το
> `coverMm` του πεδίλου ως το post-pass.

---

## 🟢 ΤΙ ΕΓΙΝΕ ΑΥΤΗ ΤΗ ΣΥΝΕΔΡΙΑ (uncommitted, ΔΙΚΑ ΣΟΥ — μένουν να γίνουν commit από Giorgio)

3 fixes — όλα στο shared tree, **μόνο αυτά τα αρχεία είναι δικά σου**:

1. **Column-bearing graph fix** → έλυσε «ΣΤΑΤΙΚΟΣ ΕΛΕΓΧΟΣ: το δοκάρι δεν στηρίζεται».
   - `bim/columns/column-structural-attach-coordinator.ts` — **NEW** `findColumnsFramedByBeamForGraph()` (geometric-only framing, ΧΩΡΙΣ το `topBinding==='storey-ceiling'` filter που έκοβε ήδη-attached κολόνες από το organism graph).
   - `bim/structural/organism/structural-graph.ts` — χρήση της νέας function αντί `findColumnsFramedByBeam`.

2. **Beam anchorage L-shape** → έλυσε «σίδερα δοκαριού προεξέχουν δεξιά/αριστερά έξω από τις κολόνες».
   - `bim-3d/converters/joint-rebar-3d.ts` — `anchorageBeamSegs` τώρα: οριζόντιο σκέλος κόβεται στην απέναντι παρειά κολόνας (`footprintFarReach`) + κατακόρυφος κάμπτης (hook) προς τα κάτω για το υπόλοιπο μήκος αγκύρωσης.

3. **`isOccupancyCategory` ReferenceError fix** → **ΗΔΗ COMMITTED** στο `47a56cc8` (inline guard στο `structural-settings.ts`, αποφυγή value-import από untracked module / Turbopack isolatedModules). ΟΛΟΚΛΗΡΩΜΕΝΟ — μην το ξαναγγίξεις.

**Uncommitted αρχεία αυτή τη στιγμή (`git status`):**
```
 M docs/centralized-systems/reference/adr-index.md            (έλεγξε αν δικό σου — shared)
 M src/subapps/dxf-viewer/bim-3d/converters/joint-rebar-3d.ts            ← δικό σου
 M src/subapps/dxf-viewer/bim/columns/column-structural-attach-coordinator.ts  ← δικό σου
 M src/subapps/dxf-viewer/bim/structural/organism/structural-graph.ts   ← δικό σου
```

---

## 🧪 VERIFICATION (μετά το dowel fix)

1. Άνοιξε το «Π» μοντέλο, BIM 3D, ribbon Προβολή → toggle **«Οπλισμός» ON** (default OFF — view-gated).
2. Οι **αναμονές πεδίλου** πρέπει να μένουν **ΕΝΤΟΣ** του πεδίλου (κατακόρυφο σκέλος + κάμπτης στη βάση), ΟΧΙ κάτω από τη βάση στο χώμα.
3. Επιβεβαίωσε ότι το beam anchorage (αυτή η συνεδρία) μένει εντός κολόνας με Γ-σχήμα.
4. Δοκάρι αναγνωρίζεται ως υποστηριζόμενο (όχι «δεν στηρίζεται»).

## ⚙️ ΚΑΝΟΝΕΣ ΣΥΝΕΔΡΙΑΣ
- Ελληνικά πάντα. N.17: ΕΝΑ tsc τη φορά (έλεγξε process πρώτα). NO commit/push χωρίς εντολή.
- Shared tree: `git add` ΜΟΝΟ τα παραπάνω δικά σου αρχεία + όσα ΕΣΥ αγγίξεις για το dowel fix.
- Μετά την υλοποίηση: ενημέρωσε `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (1-2 γρ. εκκρεμότητας) + ADR-473 changelog.

## 📎 ΣΧΕΤΙΚΑ ΑΡΧΕΙΑ
- Bug: `src/subapps/dxf-viewer/bim-3d/converters/joint-rebar-3d.ts` (`dowelSegs`)
- Math model: `src/subapps/dxf-viewer/bim/structural/organism/reinforcement-continuity.ts`
- Post-pass wiring: `src/subapps/dxf-viewer/bim-3d/scene/bim-scene-joint-rebar-sync.ts` + `BimSceneLayer.ts`
- BOQ: `src/subapps/dxf-viewer/bim/structural/organism/joint-reinforcement-quantities.ts`
- ADR: `docs/centralized-systems/reference/adrs/ADR-473-joint-reinforcement-render-takeoff.md`
