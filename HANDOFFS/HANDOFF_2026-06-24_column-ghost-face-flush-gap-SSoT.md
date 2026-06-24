# HANDOFF — Μικρό «κενό» ανάμεσα στο φάντασμα κολώνας και την παρειά υφιστάμενου μέλους (face-flush precision)

**Ημ/νία:** 2026-06-24
**Τύπος:** Precision / snap-precedence bug (DXF Viewer column placement). Revit-grade, FULL ENTERPRISE + FULL SSoT.
**Γλώσσα:** Απαντάς στον Giorgio **στα Ελληνικά.**
**Στιγμιότυπο:** `C:\Nestor_Pagonis\Στιγμιότυπο οθόνης 2026-06-24 115540.jpg`

---

## 🚨 ΚΑΝΟΝΕΣ ΣΥΝΕΔΡΙΑΣ (απαράβατοι)
- **COMMIT/PUSH κάνει ΜΟΝΟ ο Giorgio.** ΠΟΤΕ εσύ. ΠΟΤΕ `git add -A` (**shared working tree — δουλεύει κι άλλος agent**).
- **ΠΡΙΝ ΑΠΟ ΚΑΘΕ ΓΡΑΜΜΗ ΚΩΔΙΚΑ → ΠΡΑΓΜΑΤΙΚΟ SSoT AUDIT (grep)** για REUSE υπάρχοντος κώδικα, μηδέν διπλότυπα. Ο Giorgio κάνει σκληρό audit («κεντρικοποιημένο; υπάρχει ήδη; διπλότυπο; θα το έκανε έτσι η Revit;»).
- **ADR-driven (N.0.1):** code = source of truth· ενημέρωσε ADR + changelog στο τέλος.
- **N.14:** non-trivial υλοποίηση → δήλωσε μοντέλο (**Opus** — precision/cross-subsystem) & περίμενε «ok».
- **N.8:** αν αγγίξεις 5+ αρχεία / 2+ domains → πρότεινε Plan Mode/Orchestrator, πάρε έγκριση.
- **N.17:** ΕΝΑ tsc τη φορά (full tsc → OOM)· verify με **jest**.
- **100% ειλικρίνεια** — αν δεν ξέρεις τη ρίζα, πες το· **διάγνωσε ΕΜΠΕΙΡΙΚΑ** (console + Firestore) πριν αλλάξεις math.

---

## 1. ΤΟ ΠΡΟΒΛΗΜΑ (αναφορά Giorgio)

Οριζόντιος τοίχος προς τη βάση της οθόνης. Με το εργαλείο **Κολώνα** (anchor = **Κέντρο**, **AutoAlign ON**), όταν το φάντασμα κουμπώνει στη **βόρεια παρειά** του τοίχου — ιδίως στη **βορειοδυτική γωνία** — η **νότια παρειά της κολώνας ΔΕΝ εφάπτεται** στη βόρεια παρειά του τοίχου: μένει ένα **πολύ μικρό, ορατό κενό**.

> «Και αυτό γενικώς συμβαίνει σε **όλες τις οντότητες**. Κάποιο **γενικό κενό** υπάρχει.»

Δηλαδή ΔΕΝ είναι column-specific — είναι **συστηματικό offset** στο flush snapping όλων των μελών. Στόχος: **τέλεια συγκόλληση παρειάς-με-παρειά** όπως στη Revit (zero gap, zero overlap), με **ΕΝΑ SSoT**.

Coordinates readout στο στιγμιότυπο: `X: 1,1514 · Y: -3,0065 m` (μη-στρογγυλό → υποψία ότι παίζει ρόλο δεύτερος snapper / rounding).

---

## 2. ΑΡΧΙΤΕΚΤΟΝΙΚΗ — τι βρήκα ήδη (SSoT audit ξεκίνησε, ΣΥΝΕΧΙΣΕ τον)

Το column placement τροφοδοτείται από **ΔΥΟ snappers** που συνθέτονται:

> ⚠️ **ΔΕΝ είναι διπλότυπα — είναι layered pipeline (μην τα «ενοποιήσεις»).** Τα (A) και (B) είναι **δύο επίπεδα ΕΝΟΣ pipeline** με ξεχωριστή ευθύνη, όχι δύο αντίγραφα της ίδιας λογικής:
> - **(A)** = γενικός snap engine (endpoint/mid/center/τομή/grid/guide) — κοινός SSoT για ΟΛΑ τα εργαλεία (τοίχος/δοκάρι/κολώνα).
> - **(B)** = σημασιολογικό επίπεδο **από πάνω** στο (A): παίρνει τον ήδη-snapped cursor και υπολογίζει flush θέση παρειάς + anchor. Το core flush math είναι κι αυτό SSoT, μοιρασμένο με δοκάρι/τοίχο μέσω `linear-member-face-snap.ts` (`resolveLinearMemberFaceSnap`).
> - Αλυσίδα: `cursor → (A) snap → (B) flush`. Το (B) καλείται από την **ίδια** συνάρτηση σε preview (snap-scheduler) ΚΑΙ commit (mouse-handler-up) → **preview ≡ commit**.
> - Άρα το bug **ΔΕΝ** είναι copy-paste/διπλότυπο· είναι θέμα **precedence/σύνθεσης** (ποιο επίπεδο ορίζει την τελική θέση). Δες §3 υπόθεση #1. **Μην κάνεις «ενοποίηση διπλοτύπων» — η αρχιτεκτονική είναι ήδη SSoT-καθαρή.**

### (A) Ενιαίος snap engine → `ghostPoint`
`bim/columns/column-placement-snap-context.ts` → `resolveColumnDrawSnap(cursorPos, drawCorner, findSnapPoint)`:
- Προτεραιότητα: **ορατό corner-projection** > **ορατό cursor snap** (endpoint/mid/center/άξονας) > σιωπηλό grid/guide fallback.
- Επιστρέφει `ghostPoint` = πού κουμπώνει ο cursor (μέσω `NearestSnapEngine`/`ProSnapResult`).
- Τα `grid`/`guide` snaps είναι «σιωπηλά» (δεν ζωγραφίζουν γλυφή) αλλά **μετακινούν** τον cursor.

### (B) Exact face-flush (preview ≡ commit)
`bim/columns/column-face-snap.ts` → `resolveColumnFaceSnapFromTargets(cursor, targets, sceneUnits, opts)`:
- Πάνω σε τοίχο/δοκάρι/κολώνα: flush. Για face **N** → `position = { x: clamp(cursor.x,minX,maxX), y: maxY }`, anchor `anchorForHorizontalFace('N',third)` = `'s'`/`'sw'`/`'se'` (νότια λαβή/γωνία).
- **`maxY` είναι ΑΚΡΙΒΕΣ** (βλ. `footprintBounds` → `projectPolygonOnAxis`, καμία inset). Άρα **θεωρητικά μηδέν κενό**: η νότια λαβή της κολώνας κάθεται ακριβώς στο `maxY` = βόρεια παρειά τοίχου.
- Capture εντός `MEMBER_GHOST_CAPTURE_MM`· `nearestHit` ανάμεσα σε edge/bbox/polar/rect.

**Στόχος τοίχου** (`bim/framing/member-snap-targets.ts` → `wallTarget`): `outline = closedRingFromEdges(geometry.outerEdge, geometry.innerEdge)` → **δομικός πυρήνας** (centerline ± ημι-πάχος). ⚠️ Αν ο τοίχος **render-άρεται με σοβά/finish** πέρα από τον πυρήνα, η ορατή βόρεια παρειά ≠ `outerEdge.maxY` → αλλά αυτό θα έδινε **overlap, όχι κενό** (σημείωσέ το — μάλλον ΟΧΙ η ρίζα).

### SSoT γεωμετρίας/anchor (ΓΙΑ REUSE — μη διπλασιάσεις):
- `bim/geometry/shared/footprint-face-frame.ts` — `footprintBounds`, `distanceToFootprintBounds`, `pickDominantFace`.
- `bim/columns/column-face-snap-helpers.ts` — `anchorForHorizontalFace`/`anchorForVerticalFace`, `resolveAxisCenterFoot`, `buildCenteredAxisFaceFrame`, `buildColumnBboxFaceFrame`.
- `bim/framing/scene-snap-targets.ts` / `member-snap-targets.ts` — `collectSceneSnapTargets`, `wallTarget`/`beamTarget`/`edgeBandTarget`.
- `bim/framing/linear-member-face-snap.ts` — `resolveLinearMemberFaceSnap` (τοίχος/δοκάρι flush· το ΙΔΙΟ μοιράζεται edge/slab).
- **Grid snap SSoT**: `systems/grid/grid-snap.ts` (`snapToGrid`). **Float-drift weld SSoT**: ADR-049 snapToGrid 1μm (βλ. §4 ΜΑΘΗΜΑΤΑ).
- Downstream geometry (anchor offset → footprint): `computeColumnGeometry` (`bim/columns/…`) — **εδώ μπαίνει ο πραγματικός νότιος face**· επιβεβαίωσε ότι για anchor `'s'` ο νότιος face βγαίνει ΑΚΡΙΒΩΣ στο `position.y`.

---

## 3. ROOT-CAUSE ΥΠΟΘΕΣΕΙΣ (κατά σειρά πιθανότητας — ΔΙΑΓΝΩΣΕ ΕΜΠΕΙΡΙΚΑ ΠΡΩΤΑ)

> ⚠️ Μη «μαντέψεις» και αλλάξεις math. Οι προηγούμενες QA συνεδρίες (memory) έλυσαν ΑΚΡΙΒΩΣ τέτοια κενά με **live Firestore + console diagnostics**. Κάνε το ίδιο: log `cursor` (snapped ghostPoint), το `position` του `resolveColumnFaceSnapFromTargets`, το `wall.geometry.outerEdge` maxY, και τον τελικό **νότιο face της κολώνας** από `computeColumnGeometry`. Σύγκρινε αριθμούς.

1. **Precedence/σύνθεση των δύο snappers (πιθανότερο, «γενικό»):** ο ενιαίος snap engine (A) μετακινεί τον cursor σε corner/**grid/guide** σημείο **κοντά** (όχι ακριβώς) στην παρειά· μετά το face-snap (B) είτε δεν προλαβαίνει (cursor εκτός `MEMBER_GHOST_CAPTURE_MM`) είτε δεν είναι authoritative → το ghost κάθεται στο `ghostPoint` (rounded), όχι στο exact `maxY`. Επαλήθευσε **ποιο** από τα δύο ορίζει την τελική θέση του ghost στον scheduler (`systems/cursor/snap-scheduler.ts`) + `mouse-handler-up.ts` (commit). Αν το (A) κερδίζει → εκεί είναι το κενό.
2. **Adaptive-distance / grid rounding (επίσης «γενικό»):** ADR-357 `adaptive-distance-snap` («στρογγυλά νούμερα ανά zoom») ή το grid (ΠΛΕΓΜΑ) στρογγυλοποιεί την τελική θέση σε «nice» αριθμό **δίπλα** στην παρειά. Έλεγξε αν το flush παρακάμπτεται από distance/grid snap.
3. **Float drift (ADR-049/ADR-449 μάθημα):** οι αποθηκευμένες κορυφές έχουν drift ~1e-12..1e-9 → το `maxY` δεν «κολλάει» σε ULP με τη γειτονική παρειά. **Συνήθως αόρατο** σε κανονικό zoom — χαμηλή πιθανότητα για ΟΡΑΤΟ κενό, εκτός αν είναι πιο μεγάλο. Αν ισχύει → **reuse ADR-049 `snapToGrid` 1μm** στο σημείο σύγκρισης (ΟΧΙ νέος helper).
4. **Core-outline vs rendered-face (μόνο τοίχος):** `wallTarget` = πυρήνας· αν render = πυρήνας+σοβάς → mismatch. Αλλά δίνει **overlap**, όχι κενό· πιθανώς ΟΧΙ η ρίζα του «γενικού» κενού (ισχύει και column↔column που δεν έχει σοβά).

**Κλειδί διάκρισης:** ο Giorgio λέει «**όλες οι οντότητες**» → η ρίζα είναι **shared** (precedence/grid/float), ΟΧΙ wall-specific (σοβάς). Εστίασε σε #1/#2/#3.

---

## 4. ΜΑΘΗΜΑΤΑ ΑΠΟ MEMORY (κρίσιμα — μην τα αγνοήσεις)
- **«grep ΟΛΗ την app για snap/round ΠΡΙΝ νέο helper»** (incident: γράφτηκε διπλότυπο `snapPointsToGrid`, ο Giorgio το έπιασε στο SSoT audit → διαγράφηκε, reuse ADR-049 `snapToGrid`).
- **Σοβάς column↔column flush weld (ADR-449 X5):** δύο μέλη «από κάναβο» με float drift ~9e-13mm ΔΕΝ ένωναν στο `safeUnion` → ορατή ραφή. FIX = **snap grid 1μm ΠΡΙΝ το union, reuse ADR-049 `snapToGrid`**. Ίδια φιλοσοφία μπορεί να ισχύει εδώ.
- **SSoT audit ΠΡΙΝ νέο μηχανισμό** (feedback_giorgio_ssot_audit_before_new_mechanism): grep τον υπάρχοντα κώδικα, reuse, μη παράλληλο.

---

## 5. ΠΡΟΤΕΙΝΟΜΕΝΗ ΡΟΗ
1. **Plan Mode** (recognition): grep + read snap-scheduler / mouse-handler-up / useColumnTool — βρες ΠΟΥ ορίζεται η τελική ghost position (A vs B).
2. **Διάγνωση** (console + Firestore): μέτρησε το πραγματικό κενό σε mm· εντόπισε ποιο tier το εισάγει.
3. **FIX SSoT** (reuse, μηδέν διπλότυπο): είτε κάνε το exact face-flush authoritative όταν υπάρχει capture (το (B) να κερδίζει του grid/guide), είτε weld με ADR-049 `snapToGrid` 1μm στο σημείο σύγκρισης. Διατήρησε preview ≡ commit.
4. **jest**: επέκτεινε `bim/columns/__tests__/column-face-snap.test.ts` (flush N/S/E/W → νότια παρειά κολώνας ≡ maxY τοίχου, zero gap)· + regression.
5. **ADR-398** (`docs/centralized-systems/reference/adrs/ADR-398-column-placement-snap.md`) — ενημέρωσε §flush + changelog.

## 6. ΕΠΑΛΗΘΕΥΣΗ
- jest GREEN (column-face-snap + linear-member-face-snap suites).
- **Browser (Giorgio):** κολώνα στη ΒΔ γωνία τοίχου → νότια παρειά **εφάπτεται** (zoom in: μηδέν κενό)· ίδιο σε δοκάρι/κολώνα/πλάκα-ακμή· anchor center & corner.

---

## 7. ΓΡΗΓΟΡΟ ΞΕΚΙΝΗΜΑ
«Μικρό **γενικό κενό** ανάμεσα στη νότια παρειά του φαντάσματος κολώνας και τη βόρεια παρειά υφιστάμενου τοίχου (ΒΔ γωνία, AutoAlign ON, anchor Κέντρο) — και σε όλες τις οντότητες. Δύο snappers: ενιαίος engine (`resolveColumnDrawSnap`→ghostPoint) + exact face-flush (`resolveColumnFaceSnapFromTargets`, position.y=maxY ακριβές). Διάγνωσε ΕΜΠΕΙΡΙΚΑ (console + Firestore) ποιο tier εισάγει το κενό (precedence/grid/float), FIX με REUSE (ADR-049 `snapToGrid` 1μm ή face-flush authoritative), preview≡commit. SSoT audit (grep) ΠΡΩΤΑ — μηδέν διπλότυπο. jest + browser. Commit κάνει ο Giorgio. Shared tree — όχι git add -A. Ελληνικά.»
