# HANDOFF — Κολώνα **μέσα στον δίσκο κύκλου**: «Polar Magnet» + Symmetry auto-complete (ADR-398 §3.13 + §3.14)

**Ημ/νία:** 2026-06-22
**Τύπος:** Feature (Revit-grade έξυπνη τοποθέτηση κολώνας στο ΕΣΩΤΕΡΙΚΟ ενός κυκλικού δίσκου)
**Μοντέλο:** Opus (2 domains: snap/geometry + canvas overlay· + πιθανό command για batch)
**⚠️ Working tree SHARED με άλλον agent** — `git add` ΜΟΝΟ δικά σου αρχεία, **ΠΟΤΕ** `git add -A`. **COMMIT ο Giorgio, ΟΧΙ εσύ** (N.(-1)).
**Γλώσσα:** απαντάς ΠΑΝΤΑ στα Ελληνικά (CLAUDE.md LANGUAGE RULE).

---

## 0. ΤΟ ΑΙΤΗΜΑ (Giorgio, verbatim + απόφαση)

> «Τι μαγικό, έξυπνο, μοναδικό, πρωτοπωριακό, εξελιγμένο μπορούμε να κάνουμε για την κολώνα, όταν
> ένας χρήστης θέλει να τοποθετήσει μια κολώνα ΜΕΣΑ στον δίσκο του κύκλου;»

**Απόφαση (κλειδωμένη με Giorgio):** Ο δίσκος = φυσικό **πολικό σύστημα συντεταγμένων**. Δύο επίπεδα:
- **§3.13 «Polar Magnet» (ΘΕΜΕΛΙΟ — χτίσε ΠΡΩΤΟ):** μόλις το εργαλείο Κολώνα μπει μέσα σε κυκλικό
  δίσκο, εμφανίζονται διακριτικά **κέντρο + ομόκεντροι δακτύλιοι + ακτινικές ακτίνες** σε «στρογγυλά»
  νούμερα (zoom-adaptive). Η κολώνα κουμπώνει σε **κέντρο** / **δακτύλιο ∩ ακτίνα**, με live listening
  dims **«R + θ»** (ακτίνα + γωνία) αντί x,y. Στέκει μόνο του, άμεσα χρήσιμο.
- **§3.14 Symmetry auto-complete (ΤΟ ΔΙΑΜΑΝΤΙ — το «πιο μαγικό», χτίσε ΔΕΥΤΕΡΟ):** όταν υπάρχουν ήδη
  κολώνες σε δακτύλιο, το φάντασμα **προβλέπει** τις θέσεις που διατηρούν περιστροφική συμμετρία
  (n-fold) και δείχνει ΑΧΝΑ ολόκληρο το σετ· κύλισμα → κουμπώνει σε 3/4/6/8-fold («6 @ 60°»)· ΕΝΑ
  κλικ → ή μία θέση ή όλο το δαχτυλίδι (ΕΝΑ undo). Αυτό **δεν το έχει η Revit/AutoCAD**.

> «FULL ENTERPRISE + FULL SSOT, όπως η Revit. ΠΡΙΝ τον κώδικα, ΠΡΑΓΜΑΤΙΚΟ SSoT audit (grep) ώστε να
> χρησιμοποιήσεις υπάρχοντα κώδικα και να ΜΗΝ δημιουργήσεις διπλότυπα.»

---

## 1. Η ΕΜΠΕΙΡΙΑ (concrete, σκέψου σε γεωμετρία)

**§3.13 Polar Magnet** — δίσκος R=3000 στο O:
```
            90°
        ·   ·│·   ·
      ·   ╱──┼──╲   ·       δακτύλιοι: R1000 / R2000  (nice, zoom-adaptive)
   0°┼────┼───O───┼────┼    ακτίνες: 0/30/45/60/90…
      ·   ╲──┼──╱   ·       snap = κέντρο / δακτύλιος ∩ ακτίνα
        ·   ·│·   ·         listening dim:  "⌀2000  /  45°"
```

**§3.14 Symmetry auto-complete — η «στιγμή της μαγείας»:**
```
Υπάρχουν: ● 0°, ● 120° (δακτύλιος R2000)
Πας για 3η → ghost προτείνει ΑΧΝΑ: ◌ 240° (συμπληρώνει 3-fold)
Κυλάς → κουμπώνει 3/4/6/8-fold, δείχνει "6 @ 60°".
ΕΝΑ κλικ → μία θέση Ή όλο το δαχτυλίδι (ΕΝΑ undo).
```

---

## 2. ✅ BASELINE (τι υπάρχει ΗΔΗ — UNCOMMITTED, Giorgio θα κάνει commit)

Το **column placement pipeline** είναι ώριμο (ADR-398):
- **§3.7** smart-ghost face-snap, **§3.8** WYSIWYG ghost (ΕΝΑ φάντασμα=τελική κολώνα), **§3.10**
  sync-in-preview unification (ΕΝΑ κοινό `sceneSnapTargetsStore` + `resolveColumnFaceSnapFromTargets`
  core, preview ≡ commit), **§3.11** center-on-axis slide (ακμή/δοκάρι/γραμμή/πολυγραμμή/ορθογώνιο/
  κύκλος), **§3.12** arc-length listening dims σε **κύκλο + τόξο** (καμπύλες ⌒ dims, `ArcMeta` carry).
- **§3.12 NEW SSoT (πρόσφατα, UNCOMMITTED):** `arcVisibleCcwRange` (`rendering/entities/shared/
  geometry-arc-utils.ts`) — φανερή πλευρά τόξου, μοιραζόμενο hit-test + arcTargets· `arc-listening-dim-
  config.ts` (config leaf)· `ghost-face-dim-references.ts` arc branch.

⚠️ Το §3.13/§3.14 **ΧΤΙΖΕΙ ΕΠΑΝΩ** σ' αυτά. Η κολώνα ήδη μπαίνει στο preview path με WYSIWYG ghost +
listening dims — ο polar μηχανισμός είναι **νέος κλάδος** στο `resolveColumnFaceSnapFromTargets` όταν
ο cursor είναι **εντός** ενός κυκλικού δίσκου (σήμερα ο κύκλος δίνει μόνο **circumference** targets).

⚠️ **Pending-ratchet flag (σχετικό):** `arc-strategy.ts` (array) έχει ΑΣΥΜΒΑΤΗ ερμηνεία `counterclockwise`
vs renderer/hit-test — δες `.claude-rules/pending-ratchet-work.md`. Αν αγγίξεις polar-array, ίσως
συναντηθεί· **μην** το «διορθώσεις» χωρίς browser-verify του array feature.

---

## 3. 🚨 ΑΝΟΙΧΤΑ ΣΧΕΔΙΑΣΤΙΚΑ ΕΡΩΤΗΜΑΤΑ (κλείδωσέ τα με Giorgio ΠΡΙΝ τον κώδικα — αριθμητικά παραδείγματα)

1. **Ring spacing rule:** οι δακτύλιοι σε «nice» απόλυτα νούμερα (500/1000/1500… via `adaptiveDistanceStep`)
   ή σε **κλάσματα της ακτίνας** (R/4, R/3, R/2, 2R/3, 3R/4); (Πρότεινε: nice-absolute via το υπάρχον
   SSoT, mirror §3.12 — αλλά ρώτησε.)
2. **Angle increments:** 15/30/45/90; σταθερά ή zoom-adaptive (πιο πυκνά σε zoom-in);
3. **Symmetry n-fold:** πώς επιλέγεται το n; (auto από #υπαρχουσών κολωνών στον δακτύλιο· ή ο χρήστης
   κυλά μεταξύ 3/4/6/8/12;) Τι ορίζει «ίδιος δακτύλιος» (tolerance ακτίνας);
4. **Snap precedence (Revit-grade nearest-wins):** κέντρο > δακτύλιος∩ακτίνα > μόνο-δακτύλιος >
   μόνο-ακτίνα > §3.12 circumference (όταν ο cursor φεύγει στο χείλος). Κλείδωσε τη σειρά.
5. **Edge clearance:** χρειάζεται περιθώριο/offset δακτύλιος κοντά στο χείλος (structural cover);

---

## 4. SSoT ΠΡΟΣ REUSE (ΥΠΟΧΡΕΩΤΙΚΟ grep ΠΡΙΝ κώδικα — εντολή Giorgio· grep-verified σ' αυτή τη συνεδρία)

```
# adaptive nice-number snap (ΗΔΗ χρησιμοποιείται σε §3.12 + ambient + slide-step)
grep -n "adaptiveDistanceStep\|quantizeMagnitude\|niceRound" src/subapps/dxf-viewer/systems/tracking/adaptive-distance-snap.ts
# polar math (γωνία→σημείο, σημείο→γωνία, arc length, visible side)
grep -rn "pointOnCircle\|calculateAngle\|calculateArcLength\|arcVisibleCcwRange" src/subapps/dxf-viewer/rendering/entities/shared
# υπάρχουσα ΚΑΤΑΝΟΜΗ/array/grid κολωνών (reuse για §3.14 symmetry batch + undo command)
grep -rn "intermediate\|equalSpac\|distribute" src/subapps/dxf-viewer/bim/columns/intermediate-column-placement.ts src/subapps/dxf-viewer/bim/columns/add-intermediate-columns-command.ts
# array polar/path-sampler infra
ls src/subapps/dxf-viewer/systems/array/ ; grep -rn "rotate\|polar\|PIVOT" src/subapps/dxf-viewer/systems/array/array-entity-transform.ts
# το column placement pipeline (εδώ μπαίνει ο polar κλάδος)
grep -rn "resolveColumnFaceSnapFromTargets\|collectSceneSnapTargets\|sceneSnapTargetsStore" src/subapps/dxf-viewer/bim/columns/column-face-snap.ts src/subapps/dxf-viewer/bim/framing/scene-snap-targets.ts
# listening dims + overlay painter (reuse για R/θ dims + rings/spokes overlay)
grep -rn "resolveGhostFaceDimensions\|paintGhostFaceDimensions\|applyOverlayLineStyle\|OVERLAY_LINE_COLORS" src/subapps/dxf-viewer/canvas-v2/preview-canvas
# undoable create + batch ONE undo (για §3.14 «όλο το δαχτυλίδι»)
grep -rln "CreateBimEntityCommand\|appendEntitiesToScene\|appendEntityToScene" src/subapps/dxf-viewer
```

**Επιβεβαιωμένα SSoT (μην ξαναγράψεις):**
| Τομέας | SSoT | Πού |
|--------|------|-----|
| Nice-number/zoom-adaptive βήμα | `adaptiveDistanceStep` + `quantizeMagnitude` + `niceRound` | `systems/tracking/adaptive-distance-snap.ts` |
| Πολική γεωμετρία | `pointOnCircle(center,r,rad)`, `calculateAngle(c,p)`, `calculateArcLength`, `arcVisibleCcwRange` | `rendering/entities/shared/{geometry-vector-utils,geometry-arc-utils}.ts` |
| Κατανομή κολωνών + undo command | `intermediate-column-placement.ts`, `add-intermediate-columns-command.ts` | `bim/columns/` |
| Array transform (rotate γύρω από pivot) | `array-entity-transform.ts` (`applyTransformToEntity`) | `systems/array/` |
| Column placement core (preview≡commit) | `resolveColumnFaceSnapFromTargets`, `sceneSnapTargetsStore`, `collectSceneSnapTargets` | `bim/columns/column-face-snap.ts`, `bim/framing/scene-snap-targets.ts` |
| Listening dims (R/θ) | `resolveGhostFaceDimensions` (+ `ArcMeta`/§3.12), `ghost-face-dim-references.ts` | `bim/framing/` |
| Overlay σχεδίαση (rings/spokes/dims) | `applyOverlayLineStyle`, `OVERLAY_LINE_COLORS.listeningDim`, `paintGhostFaceDimensions` | `canvas-v2/preview-canvas/` |
| Batch ΕΝΑ undo | `appendEntitiesToScene` (ADR-511), `CreateBimEntityCommand` (ADR-390 Φ5) | `bim/` |

---

## 5. ΠΡΟΤΕΙΝΟΜΕΝΗ ΑΡΧΙΤΕΚΤΟΝΙΚΗ (επιβεβαίωσε με Plan Mode)

**§3.13 Polar Magnet:**
1. **NEW pure SSoT** `bim/columns/polar-disk-snap.ts` (ή `bim/framing/polar-disk-snap.ts`):
   `resolvePolarDiskSnap(cursor, {center, radius}, sceneUnits)` → πλησιέστερο **κέντρο / δακτύλιος∩ακτίνα**
   (reuse `adaptiveDistanceStep` για ring spacing + γωνία) → `{position, ringR, angleDeg, status}`.
   Pure, zero React/DOM (mirror `resolveColumnEdgeSnap`).
2. **`resolveColumnFaceSnapFromTargets`:** NEW κλάδος — όταν ο cursor είναι **εντός** κυκλικού δίσκου
   (distance to center < radius), δοκίμασε `resolvePolarDiskSnap` ΠΡΙΝ/μαζί με το circumference (§3.12).
   Χρειάζεται οι κύκλοι να φτάνουν ως **disk targets** (ΟΧΙ μόνο circumference chords) → NEW πεδίο
   στο `SceneSnapTargets` (π.χ. `diskTargets: {center,radius}[]`) γεμισμένο στο `collectSceneSnapTargets`.
3. **Listening dims R/θ:** reuse `ghost-face-dim-references` — NEW «polar» kind ή προσάρμοσε τον arc
   branch (R = ευθεία κέντρο→κολώνα = ήδη υπάρχει ως `radius` dim· θ = angle label, ήδη υπάρχει).
4. **Overlay rings/spokes:** NEW thin painter (reuse `applyOverlayLineStyle` + `arcToPolyline` για κύκλους
   δακτυλίων + ευθείες spokes) — ΙΔΙΟ cyan dashed SSoT· ζωγραφίζεται μόνο όταν cursor εντός δίσκου.

**§3.14 Symmetry auto-complete (πάνω στο §3.13):**
5. **NEW** `polar-symmetry-detector.ts`: από τις υπάρχουσες κολώνες ανά δακτύλιο → προτεινόμενο n-fold +
   οι θέσεις (reuse `pointOnCircle` + array rotate). Ghost όλου του σετ + κύλισμα n.
6. **Batch commit:** ΕΝΑ undo μέσω `appendEntitiesToScene` / `CreateBimEntityCommand` (reuse).

**FULL SSoT στόχος:** ΜΗΔΕΝ νέα polar math (όλα από `pointOnCircle`/`calculateAngle`/`adaptiveDistanceStep`)·
ΜΗΔΕΝ νέο snap store (ρέει μέσω §3.10 `sceneSnapTargetsStore` + `resolveColumnFaceSnapFromTargets`,
preview ≡ commit)· ΜΗΔΕΝ νέο overlay style (cyan dashed SSoT).

---

## 6. ⚠️ ΜΗΝ ΧΑΣΕΙΣ (διατήρηση)
1. §3.7–§3.12 ΟΛΑ αμετάβλητα (face-snap, WYSIWYG ghost, sync-in-preview, center-on-axis, arc-length dims).
2. Circumference slide σε κύκλο/τόξο (§3.11/§3.12) — ο polar (disk-interior) είναι **νέος κλάδος**,
   gated σε «cursor εντός δίσκου»· στο χείλος επιστρέφει το circumference behavior (nearest-wins).
3. preview ≡ commit (ΕΝΑ resolver + ΙΔΙΟΙ στόχοι + `ImmediateSnap` effective cursor).
4. ADR-040: μηδέν νέο React subscription· overlay painter zero-React (reuse PreviewCanvas path).

---

## 7. ΚΑΝΟΝΕΣ ΕΚΤΕΛΕΣΗΣ
- **N.0.1 ADR-driven:** NEW **ADR-398 §3.13 (Polar Magnet) + §3.14 (symmetry)** + changelog· + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (N.15).
- **SSoT audit (grep) ΠΡΙΝ κώδικα** (§4) — εντολή Giorgio. Reuse, μην διπλασιάσεις. Απάντησε στις
  «σκληρές ναι/όχι» ερωτήσεις SSoT πριν γράψεις (κεντρικοποιημένο; υπάρχει ήδη; διπλότυπο;).
- **Plan Mode** πρώτα· κλείδωσε το §3 (5 ερωτήματα) με αριθμητικό/οπτικό παράδειγμα.
- **N.8 execution mode:** πιθανόν 5+ αρχεία/2 domains → ενημέρωσε Giorgio για mode (Plan vs Orchestrator).
- **Shared tree:** `git add` ΜΟΝΟ δικά σου· **ΟΧΙ commit** (Giorgio). ⚠️ `column-face-snap*` =
  άλλος agent (§3.11) — συντονισμός, stage μόνο δικές σου γραμμές.
- **N.17:** ΕΝΑ tsc τη φορά (έλεγχος process πριν). **N.(-1.1):** ΟΧΙ `--no-verify`. **100% ειλικρίνεια.**
- ⚠️ `canvas-v2/preview-canvas/*` + snap-scheduler = ADR-040 critical (CHECK 6B/6D) → stage ADR-040 + ADR-398.
- jest δίχτυ (polar snap nice-numbers, precedence, symmetry n-fold detection, batch undo) + browser-verify.

## 8. DEFINITION OF DONE
- **§3.13:** Κολώνα μέσα σε κυκλικό δίσκο → πολικό πλέγμα (κέντρο/δακτύλιοι/ακτίνες nice-numbers,
  zoom-adaptive)· snap σε κέντρο / δακτύλιο∩ακτίνα· live R/θ dims· στο χείλος → §3.12 circumference.
- **§3.14:** με υπάρχουσες κολώνες σε δακτύλιο → ghost προβλέπει n-fold σετ· κύλισμα n· ΕΝΑ κλικ =
  μία θέση ή όλο το δαχτυλίδι (ΕΝΑ undo).
- jest GREEN + tsc clean + browser-verify. ADR-398 §3.13/§3.14 + tracker ενημερωμένα. **Commit: Giorgio.**

## 9. DEFER (εκτός scope αρχικά)
- One-shot full distribution («3 δακτύλιοι × 8 + κέντρο») — χωριστό βήμα μετά το §3.14.
- Εγγεγραμμένα πολύγωνα / clipped rect grid μέσα στον δίσκο.
- Έλλειψη/τόξο-δίσκος (μόνο πλήρης κύκλος αρχικά).
- Mirror-across-center / -diameter intelligence.
