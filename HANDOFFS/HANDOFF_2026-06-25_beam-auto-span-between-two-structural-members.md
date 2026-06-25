# HANDOFF — ΔΟΚΑΡΙ γεφυρώνει ΑΥΤΟΜΑΤΑ το κενό ανάμεσα σε ΔΥΟ ΔΟΜΙΚΑ ΜΕΛΗ (κολόνα/τοίχο) με weld στις παρειές

**Ημ/νία:** 2026-06-25
**Τύπος:** Feature (DXF/BIM Viewer — beam placement, structural span). Revit/ETABS-grade, **FULL ENTERPRISE + FULL SSoT**.
**Νέο ADR:** **ADR-526** (highest filed = 525· ⚠️ **grep `adrs/` ΠΡΙΝ — shared tree, μπορεί να πιάστηκε 526/527 από άλλον agent· πάρε τον επόμενο ελεύθερο**).
**Γλώσσα απαντήσεων στον Giorgio: ΕΛΛΗΝΙΚΑ πάντα.**

---

## 🚨 ΚΑΝΟΝΕΣ ΣΥΝΕΔΡΙΑΣ (απαράβατοι)
- **COMMIT/PUSH κάνει ΜΟΝΟ ο Giorgio.** ΠΟΤΕ εσύ. (N.(-1))
- **Shared working tree με ΑΛΛΟΝ agent** → **ΠΟΤΕ `git add -A`**, stage ΜΟΝΟ τα δικά σου specific αρχεία. Άλλος agent αγγίζει ΕΝΕΡΓΑ column αρχεία (ADR-524 batch-fill: `use-column-batch-fill-suggest.ts`, `column-batch-fill.ts`, `append-columns-with-breakdown.ts`, `useColumnTool.ts`) + πιθανόν snap/framing. **Re-grep/re-read στην αρχή** — γραμμές/exports μετακινούνται.
- **ΠΡΙΝ ΑΠΟ ΚΑΘΕ ΓΡΑΜΜΗ ΚΩΔΙΚΑ → ΠΡΑΓΜΑΤΙΚΟ SSoT AUDIT (grep)** για REUSE· ΜΗΔΕΝ διπλότυπα. Ο Giorgio κάνει σκληρό audit («κεντρικοποιημένο; υπάρχει ήδη SSoT; διπλότυπο; θα το έκανε έτσι η Revit;»). **ΜΑΘΗΜΑ ADR-525:** είχα γράψει inline `dot/sub/perp/rotate` → ο Giorgio το έπιασε → έπρεπε να γίνει reuse του `geometry-vector-utils` (`dotProduct`/`subtractPoints`/`addPoints`/`scalePoint`/`rotatePoint`/`getPerpendicularDirection`). **Grep ΓΙΑ vector-math SSoT ΠΡΙΝ γράψεις ΟΠΟΙΟΔΗΠΟΤΕ inline math.**
- **FULL ENTERPRISE + FULL SSoT, όπως η Revit/ETABS.** ΕΝΑ σημείο αλήθειας· preview ≡ commit by construction. Όχι `any`/`as any`/`@ts-ignore`· functions ≤40 γρ.· files ≤500 γρ. (N.7.1)· i18n (N.11).
- **N.14:** δήλωσε μοντέλο (**Opus** — geometry σε shared core resolver + νέος detector σε shared brain) & περίμενε «ok» πριν την υλοποίηση (εκτός αν ο Giorgio πει «προχώρα»).
- **N.17:** ΕΝΑ tsc τη φορά (έλεγξε `Get-CimInstance … node.exe … tsc` ΠΡΙΝ· full `tsc --noEmit` συχνά OOM-άρει — προτίμησε ts-jest type-check + targeted). Verify με **jest** + browser.
- **ADR-driven (N.0.1):** code = source of truth· διάβασε τον κώδικα ΠΡΙΝ τον ADR· ενημέρωσε ADR + changelog στο τέλος.

---

## 1. ΤΟ ΖΗΤΟΥΜΕΝΟ (λόγια Giorgio + στιγμιότυπο `Στιγμιότυπο οθόνης 2026-06-25 104115.jpg`)

Στο στιγμιότυπο: κάτοψη με **κολόνες/τοίχους κυκλωμένα κόκκινα**, και **κιτρινοπράσινες γραμμές** που τα ενώνουν = «εδώ είναι εφικτό να μπει δοκάρι».

> «Η εφαρμογή να **αναγνωρίζει** όταν επιλέγω την εντολή **Δοκάρι** και βάζω τον κέρσορα **ανάμεσα σε δύο
> τείχια ή δύο κολόνες ή μία κολόνα και ένα τείχιο**, ότι εκεί μπαίνει δοκάρι. Μόλις βάζω τον κέρσορα στην
> **νοητή ευθεία** ανάμεσα στα δύο μέλη, να αντιλαμβάνεται τη θέση τους και να **ενώνει το δοκάρι στις
> κατάλληλες παρειές** αυτών των οντοτήτων.»

**Δηλ.:** το ghost του δοκαριού «κουμπώνει» στη νοητή γραμμή που συνδέει δύο δομικά μέλη (column–column /
wall–wall / column–wall)· τα **δύο άκρα του δοκαριού** προσγειώνονται flush στις **αντικριστές παρειές**
των δύο μελών (weld συμβολής). **= ΑΚΡΙΒΩΣ ΤΟ ΑΝΤΙΣΤΡΟΦΟ του ADR-525** (εκεί: L-κολόνα γεμίζει γωνία 2
δοκαριών· εδώ: δοκάρι γεφυρώνει 2 μέλη).

---

## 2. ✅ FEASIBILITY: **ΝΑΙ**

ΟΧΙ νέο subsystem. Όλα τα building blocks υπάρχουν (βλ. §3). Νέο = (α) detector «κενού δύο μελών» που
βρίσκει το ζεύγος μελών των οποίων η νοητή ευθεία περνά κοντά στον cursor, (β) γεωμετρία προβολής των
άκρων του δοκαριού στις αντικριστές παρειές (start/end), (γ) ένας ακόμη tier/πηγή στον υπάρχοντα beam
path του εγκεφάλου (`resolveBimCursorSnap` toolKind:'beam'), gated `beamSpanGhost`, (δ) weld αυτόματο
(reuse `useStructuralAutoAttach`). **Mirror του ADR-525** (αντίστροφη φορά).

---

## 3. 🔬 SSoT AUDIT — ΤΙ ΗΔΗ ΥΠΑΡΧΕΙ (re-grep ΥΠΟΧΡΕΩΤΙΚΑ — anchors 2026-06-25)

### Το πιο σχετικό πρότυπο (ΑΝΤΙΓΡΑΨΕ ΤΟ — είναι το αντίστροφο):
- **ADR-525 `bim/columns/column-beam-corner-snap.ts`** — `resolveColumnBeamCornerSnap(cursor, beams, sceneUnits)`:
  detector ζεύγους + `lineIntersectionPoint` + `buildMemberAxisFrame` + auto-size + guides + `dist` (nearest-wins).
  Καταναλώνεται ως tier `lCornerHit` στο `resolveColumnFaceSnapFromTargets` (gated `lShapeGhost`), με
  `sizing` flow preview→commit + single-click. **Το νέο feature = ΑΝΑΛΟΓΟ pure module + tier στη beam-πλευρά.**

### Beam tool pipeline (όπου θα μπει ο νέος tier):
- **2-click FSM:** `hooks/drawing/useBeamTool.ts` (`idle → awaitingStart → awaitingEnd → committed`). `startPoint`/`endPoint`.
- **Ghost:** `hooks/drawing/beam-preview-helpers.ts:141` → `resolveBimCursorSnap({ toolKind:'beam', cursor, targets, sceneUnits, memberWidthMm, memberKinds:['wall','beam','slab','line'], magnetOpts })`.
- **Brain:** `bim/placement/bim-cursor-snap.ts` → beam branch → `resolveMemberGhostSnapFromStore(cursor, footprints, members, widthMm, sceneUnits)` → `MemberGhostSnapResult { start, end, status, faceFrame?, targetId? }`.
- **Commit:** `useBeamTool` 2 κλικ· `beam-completion.ts` χτίζει την οντότητα από start/end.

### Στόχοι σκηνής (πηγή των «δύο μελών»):
- `bim/framing/scene-snap-targets.ts` → `SceneSnapTargets`: `footprints` (**ΟΛΕΣ οι κολόνες** ως 2Δ πολύγωνα),
  `wallTargets`/`beamTargets` (`{axis,outline}`), `circularFootprints`. Collected via `collectSceneSnapTargets(entities)`.
- **ΚΟΛΟΝΑ ως μέλος:** οι κολόνες ζουν ως `footprints` (πολύγωνα), ΟΧΙ ως `memberTargets`. Για «μεταξύ 2 κολόνων»
  χρειάζεσαι **κέντρο/παρειές κολόνας** → reuse `footprintBounds` + `pickDominantFace` (`bim/geometry/shared/footprint-face-frame.ts`)
  ή `bim/utils/bim-characteristic-points.ts` (corner/center/midpoint dispatcher — ADR-370). **ΤΟΙΧΟΣ ως μέλος:** `wallTargets` → `buildMemberAxisFrame`.

### Γεωμετρία (ΟΛΑ reuse — μηδέν νέα primitive):
- `bim/columns/column-face-snap-helpers.ts` → **`buildMemberAxisFrame(axis,outline)`** (`{a,u,alongMin,alongMax,halfThickness}`),
  `distanceToMemberSolid`, `buildCenteredAxisFaceFrame`, `clamp`, `axisAlignmentRotationDeg`.
- **Τομή/προβολή ευθειών:** `bim/geometry/shared/polygon-axis-projection.ts` → `lineIntersectionPoint(a0,ua,b0,ub)` + `projectPointOnAxis`.
- **Vector-math SSoT:** `rendering/entities/shared/geometry-vector-utils.ts` → `dotProduct`/`subtractPoints`/`addPoints`/`scalePoint`/`rotatePoint`/`getPerpendicularDirection`. **ΧΡΗΣΙΜΟΠΟΙΗΣΕ ΤΑ — μη γράψεις inline (μάθημα ADR-525).**
- **«Κάθετη/αντικριστή παρειά»:** η παρειά κάθε μέλους που «βλέπει» το άλλο μέλος → επιλογή με sign προβολής
  του άλλου κέντρου στην κάθετο (ίδιο pattern με `outerSign` του ADR-525, αλλά **αντίστροφα**: εδώ θες την
  παρειά **προς** το άλλο μέλος, ΟΧΙ αντίθετα).

### Weld + commit (μηδέν νέος builder):
- **Weld αυτόματο:** `hooks/useStructuralAutoAttach.ts` + `bim/columns/column-structural-attach-coordinator.ts` (ADR-449)
  → μόλις το δοκάρι κάθεται flush στις παρειές, η ένωση γίνεται αυτόματα. **ΜΗΔΕΝ νέος κώδικας weld.**
- **Single-click vs 2-click:** το ADR-525 έκανε single-click (mirror adopt-rect §3.17). Εδώ το δοκάρι είναι
  φυσικά 2-click — αλλά όταν ο span είναι πλήρως ορισμένος (face-to-face), μπορεί να γίνει **single-click**
  (επιβεβαίωσε με Giorgio· βλ. §5).

---

## 4. 🎯 ΠΡΟΤΕΙΝΟΜΕΝΟ ΣΧΕΔΙΟ (επιβεβαίωσε με grep ΠΡΩΤΑ)

**ΝΕΟ pure module** `bim/framing/beam-span-snap.ts` (αδελφός/αντίστροφο του `column-beam-corner-snap.ts`):

1. **Detector «κενού δύο μελών»:** μάζεψε **υποψήφια μέλη** = κολόνες (από `footprints`, κέντρο+παρειές μέσω
   `footprintBounds`) + τοίχοι (`wallTargets` μέσω `buildMemberAxisFrame`). Για κάθε ζεύγος (m1,m2), η **νοητή
   ευθεία κέντρο→κέντρο**· αν ο cursor είναι κάθετα κοντά της (capture) ΚΑΙ ανάμεσα στα δύο μέλη → υποψήφιο.
   Nearest-wins ως προς απόσταση cursor→ευθεία (ή→μέσο του span).
2. **Γεωμετρία (reuse):**
   - Άξονας δοκαριού = η ευθεία κέντρο→κέντρο (ή κάθετη προβολή στις παρειές).
   - **start/end = προβολή στις αντικριστές παρειές** των δύο μελών (η παρειά που «βλέπει» το άλλο μέλος):
     για τοίχο = `axis ± halfThickness` προς το άλλο μέλος· για κολόνα = `pickDominantFace`/bounds προς το άλλο.
     Reuse `lineIntersectionPoint`/`projectPointOnAxis`.
   - Πλάτος δοκαριού = ribbon default (ή aligned με το στενότερο μέλος — ρώτα Giorgio).
   - Map σε `MemberGhostSnapResult { start, end, status:'beam', faceFrame, targetId }`. **Preview ≡ commit.**
3. **Tier στο brain:** νέα πηγή στο beam branch του `resolveBimCursorSnap` (ή στο `resolveMemberGhostSnapFromStore`),
   gated νέο `beamSpanGhost?` flag (threaded από `beam-preview-helpers` + το commit path του `useBeamTool`).
   Priority: ΠΡΩΤΙΣΤΟ όταν ο cursor είναι στη νοητή ευθεία (mirror `lCornerHit`).
4. **Οδηγοί + dims (reuse):** η νοητή ευθεία ως `PlacementAlignmentGuide`· auto-dims μέσω `ghost-face-dim-references`.
5. **Commit + weld:** `beam-completion` με start/end· weld αυτόματο (`useStructuralAutoAttach`).

**ΜΗΔΕΝ νέα geometry primitive πέρα από το detector + το mapping.** Frames/intersection/projection/vector-math/weld = reuse.

---

## 5. ❓ ΑΝΟΙΧΤΑ (ρώτα Giorgio με ΣΥΓΚΕΚΡΙΜΕΝΟ αριθμητικό/οπτικό παράδειγμα ΠΡΙΝ)
- **Πλάτος δοκαριού:** ribbon default (π.χ. 250) ή auto = πλάτος στενότερου μέλους; Παράδειγμα: κολόνα 400×400
  ↔ τοίχος 250 → δοκάρι πλάτος 250 ή 300 (ribbon);
- **Άξονας span:** κέντρο→κέντρο των μελών, ή ευθυγραμμισμένος με μία παρειά (π.χ. εξωτερικό περίγραμμα);
  Revit: συνήθως centerline-to-centerline, με τα άκρα trim στις παρειές.
- **start/end = παρειά (flush) ή κέντρο μέλους (penetration);** Revit framing: το δοκάρι φτάνει στην παρειά
  του support (flush) και το weld/cutback το αναλαμβάνει ο coordinator. Επιβεβαίωσε.
- **Single-click ή 2-click;** Όταν ο cursor αναγνωρίζει το ζεύγος, να commit-άρει με **ένα κλικ** (span πλήρως
  ορισμένος) ή να κρατήσει το 2-click (1ο κλικ=start μέλος, 2ο=end μέλος);
- **Πολλαπλά υποψήφια:** αν 3+ μέλη είναι κοντά, ποιο ζεύγος; (nearest-to-cursor-line· επιβεβαίωσε).
- **Tolerance:** πόσο κοντά στη νοητή ευθεία (capture px/mm); μόνο όταν ο cursor είναι **ανάμεσα** στα μέλη;

---

## 6. ΕΠΑΛΗΘΕΥΣΗ
- **jest (NEW)** `bim/framing/__tests__/beam-span-snap.test.ts`: (α) 2 κολόνες → start/end στις αντικριστές
  παρειές· (β) 2 τοίχοι· (γ) κολόνα+τοίχος· (δ) orientation-agnostic (οριζόντιο/κάθετο/λοξό span)· (ε) gating
  (μη-ζεύγος / cursor εκτός ευθείας → null)· (στ) preview ≡ commit (ίδιος resolver· έλεγχος με `beam-completion`).
- **Browser (Giorgio):** εργαλείο Δοκάρι → cursor ανάμεσα σε 2 κολόνες/τοίχους/μικτό → ghost γεφυρώνει με
  άκρα flush στις παρειές → weld.
- ⚠️ CHECK 6B/6D (snap/preview canvas) → stage **ADR-040 + νέο ADR-526 (+ ADR-508/514/525)** μαζί.

## 7. ΣΧΕΤΙΚΑ ADR
- **ADR-525** (L-κολόνα corner-gap — ΤΟ ΑΝΤΙΣΤΡΟΦΟ ΠΡΟΤΥΠΟ). `adrs/ADR-525-column-beam-corner-gap-l-junction.md`.
- **ADR-508** (Unified linear-member framing — `buildMemberAxisFrame`/`MemberGhostSnapResult`/`GhostFaceFrame`/Τ-framing).
- **ADR-514** (Unified BIM cursor snap — ο εγκέφαλος `resolveBimCursorSnap`).
- **ADR-398** (placement snap — center-on-axis, alignment guides, adopt-rect single-click).
- **ADR-449** (junction weld — `useStructuralAutoAttach`) + **ADR-370** (`bim-characteristic-points`).
- **ADR-040** (preview canvas perf — stage μαζί, CHECK 6B/6D).
- **Νέο ADR:** **ADR-526** (⚠️ grep `adrs/` + `adr-index.md` ΠΡΙΝ — shared τree· highest=525· μπορεί άλλος agent να πιάσει 526). Feature: «Beam auto-span between two structural members».

## 8. EXACT ANCHORS (re-grep — shared tree)
- Πρότυπο (αντίστροφο): `bim/columns/column-beam-corner-snap.ts` → `resolveColumnBeamCornerSnap`.
- Beam ghost/brain: `hooks/drawing/beam-preview-helpers.ts:141` (`resolveBimCursorSnap` toolKind:'beam')· `bim/placement/bim-cursor-snap.ts` (beam branch)· `bim/framing/member-ghost-snap.ts:41` (`resolveMemberGhostSnapFromStore`)· `MemberGhostSnapResult` σε `bim/framing/linear-member-face-snap.ts:99`.
- Beam FSM/commit: `hooks/drawing/useBeamTool.ts` (awaitingStart/awaitingEnd)· `hooks/drawing/beam-completion.ts`.
- Targets: `bim/framing/scene-snap-targets.ts` (`footprints`/`wallTargets`/`beamTargets`)· `bim/framing/member-snap-targets.ts` (`collectMemberSnapTargets`).
- Frames/geometry: `bim/columns/column-face-snap-helpers.ts` (`buildMemberAxisFrame` κ.λπ.)· `bim/geometry/shared/polygon-axis-projection.ts` (`lineIntersectionPoint`/`projectPointOnAxis`)· `bim/geometry/shared/footprint-face-frame.ts` (`footprintBounds`/`pickDominantFace`)· `rendering/entities/shared/geometry-vector-utils.ts` (vector-math SSoT).
- Weld: `hooks/useStructuralAutoAttach.ts` / `bim/columns/column-structural-attach-coordinator.ts`.

## 9. ΣΗΜΕΙΩΣΗ — προηγούμενο task ίδιας συνεδρίας (μη μπερδευτείς)
Στο ΙΔΙΟ working tree ΜΟΛΙΣ ολοκληρώθηκε (UNCOMMITTED, ✅browser-verified) το **ADR-525** (L-κολόνα γεμίζει
γωνιακό κενό 2 κάθετων δοκαριών). Αρχεία ADR-525: `column-beam-corner-snap.ts`(+test), `column-face-snap.ts`,
`bim-cursor-snap.ts`, `placement-ghost-assembly.ts`(+test), `column-preview-helpers.ts`, `column-commit-build.ts`,
`ColumnPlacementGhostStatusStore.ts`, `mouse-handler-up.ts`, `useColumnTool.ts`(γρ.~387), `ADR-525-…md`,
changelog ADR-398/514, `.claude-rules/pending-ratchet-work.md` (cross-product flag). **Εκκρεμεί commit (Giorgio).**
⚠️ Επίσης ΑΛΛΟΣ agent έχει ADR-524 (batch-fill) ΕΝΕΡΓΟ στα ίδια column αρχεία — **re-grep, μην πατήσεις πάνω του.**
Το νέο feature μοιράζεται `bim-cursor-snap.ts` + `scene-snap-targets.ts` + `buildMemberAxisFrame` με το ADR-525 → re-read.
