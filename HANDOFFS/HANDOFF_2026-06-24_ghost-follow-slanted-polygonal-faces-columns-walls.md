# HANDOFF — Το φάντασμα (κολόνα/πέδιλο) να ΑΚΟΛΟΥΘΕΙ τις ΛΟΞΕΣ/ΠΟΛΥΓΩΝΙΚΕΣ παρειές κολόνας & τοιχίου, FULL SSoT

**Ημ/νία:** 2026-06-24
**Τύπος:** Feature / SSoT generalization (DXF/BIM Viewer — placement face-snap). Revit-grade, **FULL ENTERPRISE + FULL SSoT**.
**Γλώσσα απαντήσεων στον Giorgio: ΕΛΛΗΝΙΚΑ πάντα** (CLAUDE.md language rule).

---

## 🚨 ΚΑΝΟΝΕΣ ΣΥΝΕΔΡΙΑΣ (απαράβατοι)
- **COMMIT/PUSH κάνει ΜΟΝΟ ο Giorgio.** ΠΟΤΕ εσύ. (N.(-1))
- **Shared working tree με ΑΛΛΟΝ agent (ADR-514/ADR-398/ADR-508 area) → ΠΟΤΕ `git add -A`,** stage ΜΟΝΟ τα δικά σου specific αρχεία. Ο άλλος agent αγγίζει ΕΝΕΡΓΑ τα `bim/columns/column-face-snap*.ts`, `bim/framing/*-snap-targets.ts`, `bim/placement/*`, `column-*`, `foundation-*`, `mouse-handler-up.ts`. **Re-grep/re-read στην αρχή** — paths/ονόματα/γραμμές μπορεί να μετακινήθηκαν.
- **ΠΡΙΝ ΑΠΟ ΚΑΘΕ ΓΡΑΜΜΗ ΚΩΔΙΚΑ → ΠΡΑΓΜΑΤΙΚΟ SSoT AUDIT (grep)** για REUSE· ΜΗΔΕΝ διπλότυπα. Ο Giorgio κάνει σκληρό audit («κεντρικοποιημένο; υπάρχει ήδη; διπλότυπο; θα το έκανε έτσι η Revit;»).
- **FULL ENTERPRISE + FULL SSoT, όπως η Revit.** ΕΝΑ σημείο αλήθειας· preview ≡ commit by construction. Όχι `any`/`as any`· functions ≤40 γρ.· files ≤500 γρ. (N.7.1)· i18n (N.11).
- **N.14:** δήλωσε μοντέλο (**Opus** — cross-subsystem face-snap/geometry) & περίμενε «ok» πριν την υλοποίηση.
- **N.8:** 5+ αρχεία / 2+ domains → πιθανό Plan Mode/Orchestrator· ενημέρωσε τον Giorgio.
- **N.17:** ΕΝΑ tsc τη φορά (έλεγξε `Get-CimInstance … node.exe … tsc` ΠΡΙΝ). Verify με **jest**.
- **ADR-driven (N.0.1):** code = source of truth· ενημέρωσε ADR + changelog στο τέλος.
- **100% ειλικρίνεια.**

---

## 1. ΤΟ ΖΗΤΟΥΜΕΝΟ (λόγια Giorgio)

> «Όταν επιλέγω την εντολή **Κολόνα** και εμφανίζεται το φάντασμα, όταν πάω κοντά σε μια **πολυγωνική κολόνα**, το φάντασμα **δεν ακολουθεί τις λοξές παρειές** της. Θέλω να τις ακολουθεί. Επίσης το φάντασμα να ακολουθεί τις **λοξές παρειές ενός λοξού στοιχείου** ή ενός στοιχείου σε σχήμα **Γ/L** όπου ένα από τα δύο σκέλη **δεν είναι ορθογώνιο αλλά σε γωνία**. Το ίδιο σε **κολόνα** με τέτοια (μη ορθογώνια) σκέλη και σε **τοιχία** με τέτοια σκέλη. Όπως το κάνει η **Revit**, FULL ENTERPRISE + FULL SSoT.»

**Στόχος:** το placement ghost (κολόνα ΚΑΙ πέδιλο — μοιράζονται τον ΙΔΙΟ resolver, ADR-514 Φ6d) να κουμπώνει **flush στις ΠΡΑΓΜΑΤΙΚΕΣ παρειές** (λοξές, πολυγωνικές, Γ/Τ/Π/σύνθετες) υφιστάμενων **κολόνων, τοιχίων (shear-wall), τοίχων-σκελών** — με σωστή **στροφή (rotation)** ανά παρειά + **γωνία-με-γωνία** (όπως ήδη γίνεται στο πέδιλο), αντί να «ισιώνει» σε ορθογώνιο bbox.

---

## 2. 🔬 ΒΑΘΥ AUDIT — Η ΑΛΗΘΕΙΑ ΤΟΥ ΚΩΔΙΚΑ (2026-06-24· **re-grep για επιβεβαίωση**)

### Η ΡΙΖΑ (επιβεβαιωμένη)
Ο **κοινός** column/foundation-pad resolver `resolveColumnFaceSnapFromTargets`
(`src/subapps/dxf-viewer/bim/columns/column-face-snap.ts`, ~γρ.365) έχει tiers (nearest-wins):
- `edgeHit` = `resolveColumnEdgeSnap(slab+line edges)` — **axis-relative** (ακολουθεί λοξάδα ✅).
- `padHit` = `resolveColumnPadEdgeSnap(padEdgeTargets)` — **NEW (Φ6d)**, axis-relative, flush-beside + γωνία-με-γωνία + slant ✅ (το πρότυπο).
- **`bboxHit`** = `resolveForTarget(buildFaceTargets(footprints, beams, walls))` — **εδώ ζει το bug** ⛔.
- `polarHit` / `rectHit` — magnet δίσκου/ορθογωνίου.

**`buildFaceTargets`** (~γρ.142) → για κάθε **column footprint** + beam/wall outline καλεί
**`footprintBounds(fp)`** → επιστρέφει **world-aligned bbox** (`minX/maxX/minY/maxY`).
**`resolveForTarget`** (~γρ.193) δουλεύει ΜΟΝΟ σε bbox → παρειές **N/S/E/W** + **`rotation: 0`** πάντα.
➡️ Πολυγωνική / Γ / Τ / Π / λοξή / σύνθετη κολόνα ή τοιχίο → **το πραγματικό σχήμα χάνεται**, το φάντασμα κουμπώνει στις ίσιες πλευρές του bbox, ΟΧΙ στις λοξές παρειές.

### Τα δεδομένα ΥΠΑΡΧΟΥΝ (καλά νέα — μηδέν νέα geometry)
- **Column footprint = πραγματικό πολύγωνο, world-baked, στραμμένο, για ΟΛΑ τα kinds:**
  `src/subapps/dxf-viewer/bim/geometry/column-geometry.ts` → `footprint: { vertices: transformed }` (~γρ.115)
  (per-kind local builders → transform σε world). `ColumnKind` =
  `rectangular | circular | L-shape | T-shape | polygon | shear-wall | I-shape | U-shape | …`
  (`bim/types/column-types.ts` ~γρ.51) → όλες οι μη-κυκλικές έχουν polygon footprint με τις ΠΡΑΓΜΑΤΙΚΕΣ (πιθανόν λοξές) ακμές.
- **Τοίχοι:** `geometry.outerEdge`/`innerEdge` (`wall-geometry.ts`) → πραγματικό outline (κρατά γωνιακά/Γ σκέλη). Ήδη συλλέγονται ως `wallTargets {axis, outline}` (`member-snap-targets.ts` `wallTarget`).

### ✅ ΤΟ ΕΤΟΙΜΟ ΠΡΟΤΥΠΟ ΠΡΟΣ ΓΕΝΙΚΕΥΣΗ (Φ6d — μόλις υλοποιήθηκε για ΠΕΔΙΛΟ)
Η λύση για το πέδιλο είναι **ακριβώς** ο μηχανισμός που χρειάζεται και για κολόνες/τοιχία:
- **`collectFoundationPadEdgeTargets(entities)`** (`bim/framing/member-snap-targets.ts`) — παίρνει το pad `geometry.footprint.vertices` (world-baked, στραμμένο) → **4 zero-width edges** μέσω `polylineEdgeTargets(verts, true, id)`. **Ο ΙΔΙΟΣ collector δουλεύει για ΚΑΘΕ polygon footprint** (απλώς N edges αντί 4).
- **`SceneSnapTargets.padEdgeTargets`** (`bim/framing/scene-snap-targets.ts`) — ξεχωριστό bucket, καταναλώνεται **ΜΟΝΟ** από τον column/foundation-pad resolver (ΟΧΙ wall/beam μέσω `selectGhostMembers` → μηδέν regression σε άλλα εργαλεία).
- **`resolveColumnPadEdgeSnap(cursor, edges, sceneUnits)`** (`bim/columns/column-face-snap.ts`) — **axis-relative** μέσω `resolveLinearMemberFaceSnap`:
  · flush-beside (ΧΩΡΙΣ center-on-axis straddle)· · εξωτερικό τρίτο (`pickThird` lo/hi) → **γωνία-με-γωνία** (centerAlong → κορυφή, `edgeFlushAnchor` corner anchor)· · **`facePerp:0`** → ΑΚΡΙΒΕΣ flush (0 κενό)· · **rotation = `axisAlignmentRotationDeg(axisDir)`** → **ΑΚΟΛΟΥΘΕΙ ΤΗ ΛΟΞΑΔΑ** ✅· · faceFrame → σιελ listening dims.
  Reuse: `resolveLinearMemberFaceSnap` (`bim/framing/linear-member-face-snap.ts`, slant-capable), `pickThird`, `edgeFlushAnchor`, `edgeNearFace`, `axisAlignmentRotationDeg` (`column-face-snap-helpers.ts`).

**Συμπέρασμα:** ο axis-relative edge-snap ΗΔΗ λύνει λοξάδα + γωνία + slant — **απλώς δεν τρέχει για column/wall footprints** (αυτά πάνε στο bbox path). Το ζητούμενο = **να περάσουν ΚΑΙ τα column/wall footprints από τον ίδιο edge-snap** (όπως τα πέδιλα), αντί (ή πριν) το bbox.

---

## 3. 🎯 ΠΡΟΤΕΙΝΟΜΕΝΟ ΣΧΕΔΙΟ (FULL SSoT — επιβεβαίωσε με grep ΠΡΩΤΑ)

**Κεντρική ιδέα (Revit-grade):** ΕΝΑΣ edge-based face-snap για ΚΑΘΕ polygon footprint (κολόνα κάθε kind, τοιχίο, τοίχος-σκέλος), που ακολουθεί τις πραγματικές (λοξές/πολυγωνικές) παρειές — γενίκευση του Φ6d pad μηχανισμού.

1. **Γενίκευσε τον collector edges:** το `collectFoundationPadEdgeTargets` → κοινό `collectFootprintEdgeTargets(entities, predicate)` (ή νέο `collectColumnEdgeTargets`) που παράγει `polylineEdgeTargets` από το `geometry.footprint.vertices` **κάθε** column (όλα τα kinds) + (προαιρετικά) wall outline. **Reuse** `polylineEdgeTargets` (closed) — μηδέν νέα geometry. ⚠️ Κύκλος (`circular`) → ΟΧΙ polygon edges (μένει bbox/special· δες §4).
2. **Νέο/κοινό bucket στο `SceneSnapTargets`:** π.χ. `footprintEdgeTargets` (ή επέκτεινε το `padEdgeTargets` σε γενικό «point-member edges»). Καταναλώνεται ΜΟΝΟ από τον column/foundation-pad resolver (όπως το `padEdgeTargets`) → wall/beam tools αμετάβλητα.
3. **Στον resolver:** πέρασε τα column/wall footprint edges από το `resolveColumnPadEdgeSnap` (γενίκευσέ το → `resolveFootprintEdgeSnap`, ίδια λογική). Πρόσθεσέ το ως tier στο `nearestHit` **με προτεραιότητα έναντι του bbox** (ή **αντικατέστησε** το bbox path για μη-ορθογώνιες/στραμμένες — δες §4).
4. **Διατήρησε τις Revit συμπεριφορές που ΔΕΝ αφορούν flush:** center-on-axis (§3.9 wall, §3.11 slab/beam, μέσω `axisFrame`), overlap «extend instead» (κοντές άκρες δοκαριού), polar/rect magnet. Το νέο edge-snap αντικαθιστά **μόνο** το «flush σε παρειά footprint».
5. **Στροφή commit:** η κολόνα είναι 2-click place→rotate (ADR-508): το faceSnap.rotation (λοξή παρειά) φαίνεται στο **awaitingPosition** ghost· μετά το 1ο κλικ η γωνία ορίζεται από το 2ο κλικ (ίδιο με σήμερα — μηδέν αλλαγή ροής). Επιβεβαίωσε ότι αυτό καλύπτει το ζητούμενο «να ακολουθεί τις λοξές παρειές» (= preview), αλλιώς δες §4.

---

## 4. ❓ ΑΝΟΙΧΤΑ ΣΗΜΕΙΑ (ρώτα τον Giorgio με συγκεκριμένο παράδειγμα/νούμερα ΠΡΙΝ προχωρήσεις)
- **Ορθογώνια κολόνα — bbox ή edges;** Σήμερα η ορθογώνια/axis-aligned κολόνα παίρνει το **bbox 9-handle** (corner anchors via thirds). Αν τη γυρίσεις σε edges (όπως το πέδιλο) αλλάζει η αίσθηση (flush-beside + corner αντί 9-handle). Προτείνεται: **edges για ΟΛΕΣ** (ένα SSoT path, Revit-grade) ή **bbox μόνο για axis-aligned, edges για στραμμένες/μη-ορθογώνιες**; (το 2ο = μικρότερο regression, αλλά 2 paths). **Δείξε στον Giorgio αριθμητικό παράδειγμα** (π.χ. ορθογώνια 40×60 cm: bbox 9-handle vs edge flush+corner).
- **Στραμμένη ΟΡΘΟΓΩΝΙΑ κολόνα (rotation≠0):** το bbox την «ισιώνει». Με edges → ακολουθεί τη στροφή. Επιβεβαίωσε ότι αυτό θες (μάλλον ΝΑΙ).
- **Κυκλική κολόνα στόχος:** δεν έχει polygon παρειές. Να μείνει bbox/ειδική (ή circumference §3.12); (μάλλον εκτός scope — κράτα την ως έχει).
- **Τοίχοι:** να ακολουθεί ΚΑΙ τις λοξές παρειές τοίχου/Γ-τοίχου με τον ΙΔΙΟ edge-snap; (ο τοίχος έχει ήδη center-on-axis slant μέσω `axisFrame`· το flush σε λοξή παρειά τοίχου σήμερα είναι bbox). Πιθανότατα ΝΑΙ.
- **«Λοξό στοιχείο» / «σύνθετο με ένα σκέλος σε γωνία»:** επιβεβαίωσε ότι εννοεί L/T/U/composite columns + walls όπου ένα σκέλος είναι μη-ορθογώνιο (όχι κάποιο νέο entity type).

---

## 5. ⚠️ ΣΥΓΚΡΟΥΣΗ — ΑΛΛΟΣ AGENT ΣΤΑ ΙΔΙΑ ΑΡΧΕΙΑ
Άλλος agent δουλεύει ΕΝΕΡΓΑ στα `column-face-snap*.ts`, `*-snap-targets.ts`, `bim/placement/*`, `mouse-handler-up.ts`, ADR-514/398/508. **Re-grep/re-read στην αρχή· stage ΜΟΝΟ τα δικά σου· μη δημιουργήσεις παράλληλο SSoT — ευθυγραμμίσου** με τον edge-snap/targets SSoT που ήδη υπάρχουν (Φ6d).

---

## 6. ΕΠΑΛΗΘΕΥΣΗ
- **jest:** (α) `member-snap-targets`/`scene-snap-targets` — column footprint → N edges στο νέο bucket (πολυγωνική=N, ορθογώνια=4)· (β) `column-face-snap` core — λοξή/πολυγωνική κολόνα-στόχος → ghost `rotation ≠ 0` + position στη λοξή παρειά + γωνία-με-γωνία στο εξωτερικό τρίτο· (γ) regression: ορθογώνια axis-aligned κολόνα + slab/line/wall/beam tiers ΑΜΕΤΑΒΛΗΤΟΙ (μηδέν αλλαγή στα υπάρχοντα ~10 column-preview jest). Δες ως πρότυπο τα Φ6d tests: `bim/framing/__tests__/scene-snap-targets.test.ts`, `hooks/drawing/__tests__/foundation-preview-helpers.test.ts` (slant + corner tests).
- **Browser (Giorgio):** εργαλείο **Κολόνα** → φάντασμα κοντά σε **πολυγωνική/Γ/Τ/Π/λοξή** κολόνα ή τοιχίο/τοίχο-σκέλος → κουμπώνει **flush στη λοξή παρειά** (φάντασμα στραμμένο όπως η παρειά) + **γωνία-με-γωνία** στο εξωτερικό τρίτο. Το ίδιο για **πέδιλο** (ήδη δουλεύει — μηδέν regression).
- ⚠️ CHECK 6B/6D (drawing/preview canvas + snap) → stage **ADR-040 + ADR-514 (+ ADR-398/ADR-508)** μαζί.

## 7. ΣΧΕΤΙΚΑ ADR
- **ADR-514** (Unified BIM Cursor Snap — ο εγκέφαλος· Φ6d = το pad edge-snap πρότυπο· εδώ ζει η γενίκευση).
- **ADR-398** (Column placement snap — 9-handle, face-snap, polar/rect magnet, CL dims).
- **ADR-508** (Unified linear-member framing — `resolveLinearMemberFaceSnap` axis-relative SSoT).
- **ADR-040** (preview canvas perf — architecture-critical).

## 8. EXACT ANCHORS (re-grep — μπορεί να μετακινήθηκαν)
- Bug: `bim/columns/column-face-snap.ts` → `buildFaceTargets`, `resolveForTarget`, `resolveColumnFaceSnapFromTargets` (tiers + `nearestHit`).
- Πρότυπο (reuse/γενίκευσε): ίδιο αρχείο → `resolveColumnPadEdgeSnap`· `bim/framing/member-snap-targets.ts` → `collectFoundationPadEdgeTargets` + `polylineEdgeTargets`· `bim/framing/scene-snap-targets.ts` → `padEdgeTargets` field + `collectSceneSnapTargets`.
- Axis-relative engine: `bim/framing/linear-member-face-snap.ts` → `resolveLinearMemberFaceSnap` (+ `GhostFaceFrame`).
- Helpers: `bim/columns/column-face-snap-helpers.ts` → `pickThird`(via member-face-third)/`edgeFlushAnchor`/`edgeNearFace`/`axisAlignmentRotationDeg`/`isAxisAligned`.
- Footprint data: `bim/geometry/column-geometry.ts` → `footprint:{vertices}` (world-baked, όλα τα kinds)· `bim/types/column-types.ts` → `ColumnKind`.
- Preview consumers: `hooks/drawing/column-preview-helpers.ts` (`generateColumnPreview`) + `foundation-preview-helpers.ts` (`generateFoundationPadPreview`) — καλούν την κοινή `placement-ghost-assembly` (ADR-514 Φ6d) → **μηδέν αλλαγή εκεί** (η διόρθωση είναι στον resolver/targets).
