# ADR-508 — Unified Linear-Member Framing SSoT (δοκάρι + τοίχος, ένα ghost)

**Status:** Accepted (uncommitted) — 2026-06-20
**Owners:** DXF Viewer / BIM drawing tools
**Related:** ADR-398 (smart beam ghost — η πηγή), ADR-363 (BIM drawing mode / wall+beam FSM), ADR-514 (unified BIM cursor snap — η wall+beam placement πλέον καλείται μέσω του εγκεφάλου `resolveBimCursorSnap`, Φ3)

---

## Context

Το εργαλείο **Δοκάρι** (ADR-398 §3.3–§3.6) έχει «έξυπνο φάντασμα»: πριν το 1ο κλικ εμφανίζεται
φάντασμα στο σταυρόνημα· κοντά σε υφιστάμενο δοκάρι/κολώνα κουμπώνει κάθετα (T-framing), γλιστράει
στην παρειά με 3 αγκυρώσεις (γωνία/κέντρο/γωνία), γίνεται 🔴 σε ομοαξονικό (duplication), commit με
2 κλικ + auto-flush. Το εργαλείο **Τοίχος** δημιουργούνταν τελείως διαφορετικά: μόνο τελεία-marker
πριν το κλικ, 3-κλικ flow (αρχή→τέλος→πλευρά ευθυγράμμισης), καμία έξυπνη έλξη.

Ο Giorgio ζήτησε **ο τοίχος να δημιουργείται με τον ίδιο ακριβώς τρόπο** όπως το δοκάρι, με
ταυτόσημο φάντασμα, και οι δύο κώδικες **ενοποιημένοι σε μία και μοναδική πηγή αλήθειας**
(full enterprise, full SSoT).

**Αποφάσεις Giorgio (2026-06-20):** (1) ο τοίχος κουμπώνει σε **τοίχους + κολώνες + δοκάρια**·
(2) **κατάργηση 3ου κλικ** — ο ευθύς τοίχος γίνεται 2-κλικ σαν δοκάρι (auto-flush αντί χειροκίνητης
πλευράς)· οι ειδικές λειτουργίες (περιοχή/περίμετρος/καμπύλος/πολυγραμμή) διατηρούνται.

## Κεντρική παρατήρηση

Ο πυρήνας του framing του δοκαριού ήταν **ήδη pure & entity-agnostic** στα μαθηματικά — δούλευε
πάνω σε `{ axis, outline }` targets + column footprints και επέστρεφε centerline `{ start, end,
status }`. Η μόνη «beam» σύνδεση ήταν τα **ονόματα**. Άρα η ενοποίηση = **εξαγωγή generic
«linear-member framing» SSoT** που καταναλώνουν **και το δοκάρι και ο τοίχος**.

## Decision

Νέος ουδέτερος φάκελος **`bim/framing/`** (SSoT):

| Module | Ρόλος |
|--------|-------|
| `member-face-third.ts` | `pickThird` — 3-ζωνική αγκύρωση (zero-import leaf, cycle-proof) |
| `linear-member-face-snap.ts` | `resolveLinearMemberFaceSnap` (T-framing 🟢 / κοντή άκρη 🔴) + `isMemberCollinearOverlap` + `buildMemberTargetFrame` (ΕΝΑ projection SSoT, exported για §end-reference) |
| `member-end-reference-snap.ts` | `resolveMemberEndReferenceSnap` (§end-reference — κορυφή 3-tier flush 1α/2β/3γ, αδελφό ADR-523) |
| `member-column-face-snap.ts` | `resolveMemberColumnFaceSnap` (12-θέσεων face snap) + `MEMBER_GHOST_LEN_MM/CAPTURE_MM` |
| `member-ghost-snap.ts` | `resolveMemberGhostSnapFromStore` — column-priority dispatcher |
| `member-snap-targets.ts` | `collectMemberSnapTargets(entities, { memberKinds })` — generic scene collector |
| `member-column-flush.ts` | `resolveMemberColumnFlushJustification` — geometric side-face flush (free placement) |

**Τα beam αρχεία έγιναν thin adapters** (διατηρούν την ιστορική ταυτότητα + προσαρμογή πεδίου
`beamWidthScene` → `memberWidthScene`) ώστε οι browser-verified beam consumers/tests να μένουν
**byte-for-byte** αμετάβλητοι: `beam-beam-face-snap.ts`, `beam-column-face-snap.ts`,
`beam-face-third.ts`, `beam-column-flush.ts`. Ο `collectBeamSnapTargets` → delegate στον generic
collector με `memberKinds: ['beam']` (συμπεριφορά δοκαριού αμετάβλητη — ΟΧΙ τοίχοι στους στόχους).

**Τοίχος (mirror δοκαριού):**
- `wall-preview-store` → `startAnchored` + `columnFootprints` + `memberTargets` + `setColumns`/`setMembers`.
- `wall-preview-helpers` → `makeWallGhostBeforeClick` (smart ghost στο σταυρόνημα) + `makeWallWysiwygGhost`
  (awaitingEnd, με `ghostStatusColor` overlap). Wall outline για snap = `outerEdge` + αντεστραμμένο
  `innerEdge` (κλειστός δακτύλιος).
- `wall-completion` → `buildAnchoredWallParams` (free auto-flush σε κολόνα μέσω `resolveMemberColumnFlushJustification`).
- `useWallTool` → `syncSceneTargetsToStore` (walls+beams+columns) on activate + on `drawing:entity-created`
  (rAF defer)· `resolveWallStartAnchor` στο 1ο κλικ· **straight 2-κλικ** (`awaitingStart → awaitingEnd → commit`).
- `use-wall-commit` → `commitStraightFromState`: overlap block (`isMemberCollinearOverlap`) + anchored/centerline/auto-flush params.

**Rendering:** ο `PreviewRenderer` ΔΕΝ άλλαξε — το `ghostStatusColor` branch είναι entity-agnostic
(διαβάζει `geometry.outline.vertices`). **Κανένα νέο store** — το status ζει inline στο preview entity.

## Wall 2nd-click: relative-polar-to-face (Revit «angle relative to face», 2026-06-21)

**Πρόβλημα (Giorgio + screenshot):** όταν το 1ο κλικ κουμπώνει στην **παρειά υφιστάμενου τοίχου**
(face-anchored start), κατά την περιστροφή του ghost στο 2ο κλικ δεν υπήρχε καμία γωνιακή έλξη
**σχετική ως προς εκείνη την παρειά** — η μία γωνία της βάσης χωνόταν μέσα στον υφιστάμενο τοίχο, η
άλλη άνοιγε κενό. Ζητούμενο: μαγνήτες στις **90° (κάθετα)** + πολλαπλά **15°/30°/45°** ως προς την
παρειά. Στις 90° οι 2 γωνίες της βάσης κάθονται **flush** στην παρειά (όπως Revit).

**Λύση (full SSoT, μηδέν διπλότυπο):**

1. **`applyPolar` (`systems/constraints/polar-utils.ts`) — επέκταση με optional `config.baseAngle = 0`.**
   Το snap γίνεται σε `baseAngle + k·increment` (και `baseAngle + additional`). `baseAngle = 0` ⇒
   **ταυτόσημο** με το world polar (backward-compat, κλειδωμένο με test). ΕΝΑ function καλύπτει
   world ΚΑΙ relative — όχι νέο `applyPolarRelative`.
2. **Capture της κάθετης-στην-παρειά κατεύθυνσης στο 1ο κλικ.** Το `resolveWallStartAnchor`
   (`useWallTool`) υπολογίζει `faceAngle = atan2(snap.end − snap.start)` (το `end − start` του ghost
   = outward face normal, από `linear-member-face-snap`). Αποθηκεύεται ως `startFaceAngle` στο
   `WallToolState` + `wallPreviewStore` (mirror του `startAnchored`). `null` σε free / 🔴 collinear-overlap.
3. **SSoT helper (preview ≡ commit) στο `bim-ortho-reference.ts`:** `getWallFaceRelativeBaseAngle`
   (επιστρέφει το captured angle όταν wall + awaitingEnd + anchored) + `resolveWallFaceRelativePolar`
   (καλεί `applyPolar` με `baseAngle = startFaceAngle`). `baseAngle` = **κάθετο στην παρειά** ⇒ `0°`
   relative = κάθετο (το flush case· οι 2 γωνίες πέφτουν στην παρειά αυτόματα αφού το start είναι ήδη
   flush), `±90°` = παράλληλο. **Auto magnet** — δεν χρειάζεται F10 (το anchoring σε παρειά ΕΙΝΑΙ η
   πρόθεση)· **F8 ortho υπερισχύει** (ρητό world H/V lock). Υπερισχύει του world polar.
4. **Wire σε αμφότερα τα paths:** preview (`drawing-hover-handler`, μετά το ortho/πριν το world polar)
   και commit (`applyBimDrawingConstraint`, που ήδη καλεί ο `useCanvasClickHandler`) διαβάζουν τον
   ΙΔΙΟ helper → ghost === τελικός τοίχος. Το overlay (`drawPolarTrackingLine`) δείχνει την absolute
   γωνία αυτόματα (ο `PolarSnapResult.snappedAngle` είναι world).

**Consequences:** ✅ Revit-grade «angle relative to face»· ✅ `applyPolar` baseAngle = γενικό SSoT
(διαθέσιμο σε κάθε μελλοντικό relative-polar consumer)· ✅ 48 tests (polar-utils baseAngle +
bim-ortho-reference face-relative)· ✅ μηδέν regression στο world polar (baseAngle=0 lock).

## Consequences

- ✅ Μία πηγή αλήθειας για το linear-member framing· δοκάρι + τοίχος μοιράζονται τον ίδιο πυρήνα.
- ✅ Beam tests byte-for-byte πράσινα (aliases)· νέα generic suite `bim/framing/__tests__` (ανεξάρτητη κάλυψη).
- ⚠️ Ο ευθύς τοίχος είναι πλέον 2-κλικ — το χειροκίνητο 3ο κλικ ευθυγράμμισης καταργήθηκε (το auto-flush
  το αντικαθιστά). Το `awaitingAlignment` παραμένει μόνο για το dynamic-input precision path.
- Beam targets παραμένουν beams+columns (ΟΧΙ τοίχοι) — εσκεμμένο, αποφυγή scope creep/regression στο
  browser-verified δοκάρι.

## Changelog

- **2026-07-02 (§wall-hud — live «λευκές ενδείξεις» (γωνία/πάχος/ύψος/μήκος) ΚΑΙ στο σύρσιμο λαβών τοίχου)**
  - **Αίτημα Giorgio**: οι ενδείξεις που εμφανίζονται δίπλα στο φάντασμα τοίχου **κατά τη σχεδίαση** (μετά το 1ο
    κλικ — γωνία/πάχος/ύψος/μήκος σε λευκά κείμενα) να εμφανίζονται **και** όταν, σε ολοκληρωμένο τοίχο,
    σέρνω λαβές για να αλλάξω πλάτος/μήκος. «Θέλω τον ΙΔΙΟ ακριβώς κώδικα — full SSoT, μία πηγή αλήθειας.»
  - **Ρίζα (2 Explore agents — SSoT audit)**: οι λευκές ενδείξεις = το **Wall HUD** (`buildSegmentHudMeta` →
    `paintWallHud`, χρώμα `OVERLAY_LINE_COLORS.alignment`), όχι οι κυανές listening dims. Υπήρχε ήδη leaf
    `useGripDimAnnotation`/`GripDimAnnotationMount` που ζωγραφίζει live διαστάσεις **κατά το σύρσιμο λαβών** —
    αλλά **μόνο** για κολόνα/δοκάρι/πέδιλο (scalar pills)· **οι τοίχοι έλειπαν ρητά** (`isDimPreview` gate + καμία
    `buildWallLabel`). Zero wall dim display στο grip drag σήμερα.
  - **Fix (FULL SSoT reuse, μηδέν νέα σχεδίαση)**:
    - NEW `hooks/drawing/wall-hud-spec-label.ts → buildWallHudSpecLabel(meta)` — **ΜΙΑ** πηγή της ετικέτας
      «πάχος·ύψος» (i18n + display units). Ο `drawing-hover-handler` refactored να την καλεί (το inline
      `i18n.t('tools.wall.hudSpec', …)` αφαιρέθηκε → μηδέν διπλότυπο).
    - `useGripDimAnnotation`: NEW wall branch — `wallGripKind` στο gate + `paintWallGripHud` που παράγει live
      params μέσω του κοινού `applyWallGripDrag` (ίδιος μετασχηματισμός με το grip ghost → preview ≡ HUD),
      μετά `buildSegmentHudMeta` + `paintWallHud` + `buildWallHudSpecLabel`. **Ο ΙΔΙΟΣ ακριβώς κώδικας** με τη
      σχεδίαση — ίδια νούμερα/painters/οπτική γλώσσα. ΟΧΙ pill (το HUD τοποθετείται στον άξονα του τοίχου).
  - **Εύρος**: εμφανίζεται σε λαβές που αλλάζουν διαστάσεις (start/end/thickness/corner/curve/vertex).
    Εξαιρούνται `wall-midpoint` (καθαρή μετακίνηση) & `wall-rotation` (έχει ήδη ένδειξη φοράς ADR-397 §15) μέσω
    `WALL_HUD_SKIP`. Layer: ο ΙΔΙΟΣ PreviewCanvas, `clearMode:'skip-clear'` (πάνω από το grip ghost, ADR-040 leaf).
  - **Tests**: κανένα νέο — thin glue πάνω σε ήδη-δοκιμασμένα SSoT (`buildSegmentHudMeta`, `applyWallGripDrag`,
    `paintWallHud`/`paintWallHudCore` — `wall-hud-paint-projector.test.ts` πράσινο). Δεν υπάρχει test harness για
    canvas/i18n hooks· αποφεύχθηκε τεχνητό mock. 🔴 browser-verify.

- **2026-07-01 (§rotated-column — τοίχος/δοκάρι κουμπώνει στις ΛΟΞΕΣ παρειές περιστραμμένης ορθογώνιας κολόνας)**
  - **Αίτημα Giorgio**: «ορθογώνια κολόνα τοποθετημένη **υπό γωνία** στην κάτοψη· επιλέγω *τοίχος* για να κολλήσω
    τον τοίχο στις παρειές της. Ο τοίχος **δεν αναγνωρίζει τις κλίσεις** — κάθεται πάντα οριζόντιος ή κάθετος.»
  - **Ρίζα (2 Explore agents — SSoT audit, επιβεβ. end-to-end)**: η διαδρομή τοίχου/δοκαριού→κολόνας
    (`resolveBimCursorSnap` → `resolveMemberGhostSnapFromStore` → **`resolveMemberColumnFaceSnap`**) δούλευε
    **αποκλειστικά με AABB** (`footprintBounds`, `pickDominantFace` μόνο E/W/N/S, normals μόνο `(±1,0)/(0,±1)`) →
    «ίσιωνε» κάθε περιστραμμένη κολόνα στο ορθογώνιο-περίβλημά της. Ο rotation-aware SSoT (`footprintEdgeTargets`
    → `resolveFootprintEdgeSnap`) που ΗΔΗ χρησιμοποιεί το εργαλείο **κολόνας** (ADR-514 Φ6d) δεν δινόταν ποτέ στον
    τοίχο. **SSoT gap**, όχι έλλειψη μηχανισμού.
  - **Fix (ZERO new geometry, FULL SSoT reuse)**: το `resolveMemberColumnFaceSnap` γενικεύτηκε ώστε, για
    **πραγματικό ορθογώνιο** footprint (4 κορυφές, u⊥v) που είναι **περιστραμμένο**, να φέρνει τον cursor στο
    **τοπικό πλαίσιο** της κολόνας (`RectFrame` u/v μέσω NEW `rectWorldToLocal`/`rectDirToWorld` στο `rect-frame.ts`),
    να τρέχει την **ΙΔΙΑ** axis-aligned λογική (face-flush + 3-thirds + **center-to-centroid** magnet — πλήρες parity)
    και να γυρνά start/end/faceFrame στον κόσμο (`rectLocalToWorld` + rotate dirs). Τα βαθμωτά (facePerp/along/
    ghostHalfWidth/outwardSign) είναι rotation-invariant → αμετάβλητα.
  - **Μηδέν regression**: ίσιες κολόνες / κύκλοι (πολλές κορυφές) / πολύγωνα Γ-Τ-Π → `null` από το rotated-guard →
    πέφτουν στο **byte-identical** ιστορικό AABB path. Το axis-aligned quantization grid μένει ακριβώς ίδιο.
  - **Ένα fix, τρία αποτελέσματα**: ο ίδιος resolver τροφοδοτεί (α) το ghost-πριν-το-κλικ, (β) το captured
    `startFaceAngle` (→ face-relative polar 2ου κλικ, ADR-508 §angle-relative-to-face), (γ) το flush endpoint →
    ο τοίχος «βλέπει» την πραγματική κλίση παντού.
  - **Tests**: +6 `member-ghost-snap.test.ts` (45° E-face stub@45° + faceFrame u/v· 45° center-to-centroid parity·
    30° faceFrame axis/perp· far→null· axis-aligned μη-παλινδρόμηση· dispatcher rotated). 27/27 GREEN + 41/41
    συγγενικά (endpoint + beam→column) regression.
  - **Εκκρεμεί (Phase 2, αν χρειαστεί μετά browser-verify)**: καθαρό σενάριο «τοίχος από έξω, το ΑΚΡΟ μπήγεται
    κάθετα στη λοξή παρειά» — το endpoint snap σήμερα μόνο *μετακινεί* το σημείο (δεν *περιστρέφει*). Πιθανό
    face-relative angle magnet στο άκρο (καθρέφτης του start-magnet).

- **2026-07-01 (§end-reference — κορυφή κάθετου τοίχου: 3-tier flush 1α/2β/3γ, end-cap αδελφό του ADR-523)**
  - **Αίτημα Giorgio (2 στιγμιότυπα)**: «σχεδιάζω οριζόντιο τοίχο κοντά στη **βόρεια μικρή παρειά (κορυφή)**
    υφιστάμενου κάθετου τοίχου. Καθώς κατεβάζω τον κέρσορα θέλω 3 διαδοχικά κουμπώματα: (A) **νότια παρειά
    φαντάσματος 3γ ≡ κορυφή** (φάντασμα όλο πάνω), (B) **κέντρο άξονα 2β ≡ κορυφή** (μισό-μισό), (Γ) **βόρεια
    παρειά 1α ≡ κορυφή** (φάντασμα όλο μέσα).» Η γραμμή αναφοράς = **ΙΔΙΑ κορυφή** και στα 3 στάδια (επιβεβ.).
  - **Ρίζα (3 Explore agents — SSoT audit)**: η συμπεριφορά είναι ο **end-cap** αντίστοιχος της μακριάς-παρειάς
    ADR-523 (column-head). Ο dispatcher `resolveMemberGhostSnapFromStore` (καλείται από before-click ghost ΚΑΙ
    endpoint) είχε **μόνο** body Τ-framing (🟢, στη μακριά παρειά) + συγγραμμική επέκταση (🔴, στην άκρη)· **κανένα**
    κάθετο 3-tier κούμπωμα στην κορυφή. Το υπάρχον end branch (`status:'overlap'`) δίνει το κέντρο της κοντής άκρης,
    όχι reference-line alignment.
  - **Fix (ZERO new mechanism, FULL SSoT reuse)**: NEW pure `member-end-reference-snap.ts →
    resolveMemberEndReferenceSnap`. Reuse `buildMemberTargetFrame` (το ήδη-υπάρχον private frame builder του
    `linear-member-face-snap` — **exported**, μηδέν διπλό projection: a/u/p + cursor along/perp + outline έκταση).
    Καρδιά: για κορυφή `E ∈ {alongMin, alongMax}` και ghostHalf = πάχος_νέου/2, οι **3 υποψήφιες θέσεις άξονα
    φαντάσματος** κατά `u` = `E + {−ghostHalf, 0, +ghostHalf}` (φέρνουν 1α/2β/3γ flush)· **nearest-wins** στο
    `|cursorAlong − υποψήφια|`. Η αντιστοίχιση γίνεται κατά τον **άξονα** `u` του υφιστάμενου (όχι τον κάθετο `n`
    όπως ADR-523) — γιατί η κορυφή κείτεται στο `alongMin/alongMax`. Το stub βγαίνει κάθετα προς την πλευρά του
    κέρσορα (`side = sign(cPerp)`), start πάνω στην παρειά εκείνης της πλευράς.
  - **Gate (συνύπαρξη χωρίς μάχη)**: (a) perp — `|cPerp| ≥ h/2` (on-axis → αφήνεται στη συγγραμμική επέκταση 🔴)
    & `|cPerp| ≤ h + capture`· (b) along — `residual ≤ max(ghostHalf, capture/2)` (βαθιά στο σώμα → αφήνεται στο
    body Τ-framing 🟢). **Wire**: tier ΠΡΙΝ το `resolveLinearMemberFaceSnap` στον dispatcher → **ΕΝΑΣ** chokepoint,
    preview ≡ commit by construction (καλύπτει ΚΑΙ το before-click ghost ΚΑΙ το endpoint snap).
  - **Tests**: +12 `member-end-reference-snap.test.ts` (3 στάδια A/B/Γ ανατολικά + δυτική πλευρά + κάτω κορυφή ×2
    + on-axis null + deep-body null + far null + zero-width null + 2 dispatcher wiring). 69/69 GREEN (12 νέα + 57
    προϋπάρχοντα framing regression — το rename `TargetFrame→MemberTargetFrame`/`buildTargetFrame→
    buildMemberTargetFrame` δεν έσπασε τίποτα).
  - **Follow-up (Giorgio): κέντρο περιστροφής = κορυφή σε ΟΛΕΣ τις βαθμίδες (Revit location line)**: μετά το
    1ο κλικ το pivot ΔΕΝ είναι ο άξονας του φαντάσματος αλλά το **σημείο επαφής στην κορυφή** — Στάδιο A→ΝΔ
    γωνία, Στάδιο B→μέσο δυτικής, Στάδιο Γ→ΒΔ γωνία (ίδιο physical σημείο, διαφορετική γραμμή φαντάσματος
    πάνω του). Υλοποίηση = **Revit «location line + justification»** (ZERO new mechanism, reuse `axis-justify`/
    `computeWallAlignmentOffset`): ο snap επιστρέφει πλέον `start`/`end` = η **location line ΠΑΝΩ στην κορυφή**
    (pivot) + `justification` ανά βαθμίδα (`off=0→'center'`, `off≠0→'left'/'right'` ανάλογα με `side`, ώστε ο
    canonical normal να «κρεμάσει» το σώμα σωστά)· το σώμα προκύπτει με τον ΥΠΑΡΧΟΝΤΑ `alignmentPoint`
    (NEW SSoT `alignmentPointForWallJustification` στο `wall-completion.ts`· 'center'→null=κεντραρισμένο).
    Threading: `MemberGhostSnapResult.justification` (υπήρχε) → `resolveWallStartAnchor` → `WallToolState.
    startJustification` + `wallPreviewStore.startJustification` → before-click ghost + awaitingEnd ghost
    (`makeWallWysiwygGhost`) + commit (`commitStraightFromState`). **preview ≡ commit** (ΙΔΙΟ alignmentPoint και
    στα 3 σημεία). +6 tests (justification ανά βαθμίδα/πλευρά + **full-chain**: snap→alignment→`buildDefaultWallParams`
    βάζει τον body axis ΑΚΡΙΒΩΣ στο `g` ∈ {1150,1000,850} → επικυρώνει το sign του justification). 16/16 GREEN.
  - **Follow-up 2 (Giorgio): corner-cap (γωνία Γ) ΑΝΤΙ 🔴 ομοαξονικού — κέρσορας ΒΟΡΕΙΑ της κορυφής & ΕΝΤΟΣ
    πλάτους**: πριν, κέρσορας βόρεια της κορυφής & κοντά στον άξονα → 🔴 ομοαξονικό φάντασμα (block duplicate).
    Τώρα → **οριζόντιο φάντασμα γωνίας**, **νότια παρειά flush στην κορυφή** (ΠΑΝΤΑ, Giorgio), σώμα έξω από το
    υφιστάμενο. Η «πίσω-κάτω» γωνία έχει **ΜΟΝΟ 3 διακριτές θέσεις** (Giorgio, καμία ενδιάμεση): **στενή κεντρική
    ζώνη** (`|cPerp| ≤ 0.25·h`, tunable `CORNER_CAP_AXIS_SNAP_FRACTION`) → **μέσο κορυφής** (απλώνεται ανατολικά)·
    δεξιά → **ΒΔ γωνία** (perpMin, ανατολικά)· αριστερά → **ΒΑ γωνία** (perpMax, δυτικά). [Ιστορικό: 1ο 1B-sliding →
    Giorgio «μόνο 3, καμία ενδιάμεση» → discrete.] NEW pure `resolveMemberEndCornerCapSnap` (ίδιο αρχείο· reuse
    `buildMemberTargetFrame` + ΟΛΟ το location-line+
    `justification` του Follow-up 1: start=η γωνία ΠΑΝΩ στην κορυφή=pivot, σώμα κρέμεται έξω). Gate: `|cPerp| ≤ h`
    (μέχρι την παρειά) ΚΑΙ `cAlong` πέρα από κορυφή (εντός capture). Wire: **ΥΨΗΛΟΤΕΡΗ προτεραιότητα** στον
    dispatcher (ΠΡΙΝ το 3-tier) → το 🔴 ομοαξονικό αντικαθίσταται από 🟢 γωνία (οριζόντιο=μη-παράλληλο, δεν πέφτει
    στο `isMemberCollinearOverlap`). Διαχωρισμός: on-axis/βόρεια εντός πλάτους → corner-cap· **σαφώς στο πλάι**
    (`|cPerp|>h`) → 3-tier (Follow-up 1). +11 tests (αν./άξονα/δυτ. + 3-διακριτές-θέσεις/boundary κεντρικής ζώνης +
    εκτός-πλάτους/εντός-σώματος/μακριά null + κάτω κορυφή + **full-chain** νότια-flush + dispatcher 🟢-αντί-🔴).
    27/27 end-ref + 1240/1240 framing/walls/columns GREEN.
  - ✅ Google-level: YES — αδελφό ενός proven pattern (ADR-523), ΕΝΑ projection SSoT (zero διπλό geometry),
    nearest-wins + 3 διακριτές θέσεις, orientation-agnostic, location line = Revit-grade associative pivot (reuse
    axis-justify SSoT), gate ώστε μηδέν regression σε body/overlap/3-tier. ⚠️ faceFrame (listening dims) = TODO.
    🔴 browser-verify (Giorgio). ⚠️ Pre-existing (ΟΧΙ από εδώ): 10 obsolete failures σε `useWallTool.test.tsx`/
    `floorplan-symbol-completion.test.ts` (περιμένουν legacy 3-click `awaitingAlignment`).
  - **Cross-ref**: ADR-523 (η μακριάς-παρειάς column-head αδελφή)· ADR-441/ADR-529 (`axis-justify` location-line SSoT).

- **2026-07-01 (§center-snap — κέντρο άξονα ΤΟΙΧΟΥ ↔ ΚΕΝΤΡΟ κολόνας, nearest-wins με τις παρειές)**
  - **Αίτημα Giorgio (στιγμιότυπο)**: «σχεδιάζω κάθετο τοίχο προς κολόνα· καθώς κατεβαίνω, αντί να κεντράρει
    το κέντρο άξονα του φαντάσματος στο **κέντρο** της κολόνας, με αναγκάζει είτε στη ΝΔ είτε στη ΝΑ **παρειά**.
    Θέλω να προσφέρονται **ΚΑΙ** κέντρο-σε-κέντρο **ΚΑΙ** face-flush, με **το κοντινότερο να κερδίζει**.»
  - **Ρίζα (3 Explore + 1 Plan agent)**: START (`makeWallGhostBeforeClick`) ΚΑΙ END (`resolveWallEndpointSnap`)
    καταλήγουν στην ίδια pure `resolveMemberColumnFaceSnap`, που επέστρεφε **μόνο** face-flush contact
    (`resolveContinuousColumnFace`). Το ιστορικό `mid`-third center magnet **είχε αφαιρεθεί** (2026-06-24,
    «συνεχώς ομαλά») → το centroid δεν έπαιζε κανέναν ρόλο. Το Layer-1 OSNAP `BIM_CENTER` παρακάμπτεται
    αρχιτεκτονικά (Layer-2 placement early-return εντός 600mm).
  - **Fix (ZERO new mechanism, FULL SSoT reuse)**: NEW `resolveColumnCenterSnap` (chokepoint
    `member-column-face-snap.ts`, σερβίρει start+end+commit) = **center-to-centroid** candidate (mirror του
    ADR-398 §3.9 αλλά αντίστροφη φορά: τοίχος→κέντρο κολόνας). Nearest-wins: κέντρο κερδίζει όταν
    `dCenter ≤ dFace` **Ή** `dCenter ≤ centerCapture`. **Magnet ζώνη απαραίτητη** (`min(halfX,halfY)·0.5`,
    = ¼ της μικρότερης πλήρους διάστασης, mirror §3.9 «εσωτερικής μισής ζώνης»): η face-flush επαφή
    ολισθαίνει με τον cursor (πάντα μικρό `dFace`) → σκέτο nearest-wins θα έκανε το κέντρο να μην κερδίζει
    σχεδόν ποτέ. Reuse `footprintCenter` (NEW μικρός SSoT helper στο `footprint-face-frame.ts`,
    αντικαθιστά inline `cx/cy`) + `buildCenteredAxisFaceFrame` (μετακινήθηκε `bim/columns/
    column-face-snap-helpers.ts` → `bim/framing/linear-member-face-snap.ts` για να μην εξαρτάται το
    `bim/framing` από το `bim/columns`· re-export alias byte-for-byte για column consumers).
  - **Ροή τύπου**: `MemberColumnFaceSnap` shape αμετάβλητο → dispatcher/`MemberGhostSnapResult` ανέπαφα. END
    κρατά `snap.start`(=centroid)· START before-click `snap.end`=centroid+ghostLen·outwardNormal → το 2ο
    κλικ βγαίνει κάθετα (status `'neutral'`). `resolveWallFaceRelativePolar` ΑΜΕΤΑΒΛΗΤΟ (override σε
    resolver-level φτάνει και εκτός-άξονα centroid).
  - **Tests**: +6 `member-ghost-snap.test.ts` (center-wins/face-wins/tie-break center-biased/magnet
    boundary/dispatcher) +2 `member-endpoint-snap.test.ts` (END center, orientation-agnostic off-axis). Όλα
    τα προϋπάρχοντα regression (cursor x=700 → dCenter μακριά → face αμετάβλητο) πράσινα. 57+187 GREEN.
  - ✅ Google-level: YES — ΕΝΑ chokepoint (start+end+commit, preview≡commit by construction), nearest-wins
    με υπάρχον SSoT pattern, μηδέν διπλό geometry, orientation-agnostic AABB. 🔴 browser-verify (Giorgio).
  - **Cross-ref**: ADR-398 §3.9 (το mirror center-on-axis + relocation του `buildCenteredAxisFaceFrame`).

- **2026-06-30 (§line-cyan — κυανές listening dimensions + flush/κάθετο κούμπωμα ΚΑΙ στη ΓΡΑΜΜΗ, ίδιος εγκέφαλος έλξης με τον τοίχο)**
  - **Αίτημα Giorgio**: «όταν σχεδιάζω τοίχο κοντά σε υφιστάμενη οντότητα βλέπω ΚΥΑΝΕΣ ενδείξεις (gap-left/
    gap-right/κέντρο) και το φάντασμα κάθεται κάθετα/flush πάνω στην παρειά. Θέλω την ΙΔΙΑ συμπεριφορά στη
    γραμμή — τον ίδιο κώδικα, μια πηγή αλήθειας. (Πλήρης parity: κάθετο stub πριν το κλικ.)»
  - **SSoT audit (2 Explore agents)**: (§A) η αλυσίδα των κυανών είναι **ήδη tool-agnostic** από άκρη σε άκρη
    (`GhostFaceFrame → resolveGhostFaceDimensions → resolveGhostFaceDimensionsMeta → faceDimensions →
    drawing-hover-handler:294-298 → paintGhostFaceDimensions`)· ο consumer ΔΕΝ έχει `if (tool==='wall')`. (§B) το
    flush κούμπωμα είναι ο **«Εγκέφαλος Έλξης» ADR-514** (`resolveBimCursorSnap`)· ο τοίχος τον καλεί στο
    `resolveWallStartAnchor`/`resolveWallEndpointSnap`. **Η ΜΟΝΗ ασυμμετρία**: η γραμμή έκανε μόνο Layer-1 OSNAP,
    ποτέ Layer-2 member face-snap.
  - **Fix (ZERO new mechanism — όλα τα anti-goals του handoff τηρήθηκαν)**:
    (1) NEW `BimSnapToolKind 'line'` στο `bim-cursor-snap.ts` — zero-width (ταυτόσημο με `polygon-vertex`,
    ξεχωριστό όνομα για σαφήνεια)· το σημείο πατά ΑΚΡΙΒΩΣ στην παρειά + `faceFrame` → κυανές.
    (2) NEW SSoT `hooks/drawing/line-preview-helpers.ts` (αδελφός του `wall-preview-helpers`): ΕΝΑΣ πυρήνας
    `resolveLineFaceSnapAt` (`resolveBimCursorSnap` zero-width, ΧΩΡΙΣ `findSnapPoint` anti-double-snap),
    `generateLinePreview` (πριν το κλικ → κάθετο stub flush· awaiting-end → άκρο flush· κυανές μέσω του ΚΟΙΝΟΥ
    `resolveGhostFaceDimensionsMeta`), `resolveLineCommitPoint` (commit entry — ΙΔΙΟΣ πυρήνας → preview ≡ commit).
    (3) `ExtendedLineEntity.faceDimensions` (ΙΔΙΟ canonical πεδίο με `PlacementOverlayFields`).
    (4) `drawing-preview-generator` → νέος `tool==='line'` branch (stub/awaiting-end ghost ή fall-through).
    (5) `applyPreviewStyling` → το `liveDimHud` gate-άρεται σε `worldPoints.length>=2` (ΟΧΙ HUD στο pre-click stub,
    mirror του wall `wantHud=false`).
    (6) `useDrawingHandlers.onDrawingPoint` → commit-time `resolveLineCommitPoint` (μετά tracking + length/angle lock).
  - **Συνέπεια**: μηδέν νέος painter, μηδέν νέο overlay-meta πεδίο, μηδέν δεύτερος snap μηχανισμός. **preview ≡ commit
    by construction** (ίδιος πυρήνας έλξης στον ίδιο OSNAP-snapped cursor). `drawing-hover-handler` ΑΜΕΤΑΒΛΗΤΟΣ.
  - ✅ Google-level: YES — full reuse του ADR-514 εγκεφάλου + ADR-508 §dim SSoT· η γραμμή = γραμμικό μέλος μηδενικού πλάτους.
  - **Scope: ΜΟΝΟ στο 1ο κλικ (Giorgio follow-up «μετά το 1ο κλικ να μην κολλάει, να περιστρέφεται»)**: το flush/
    κάθετο κούμπωμα + κυανές ισχύουν **ΜΟΝΟ πριν/στο 1ο κλικ** (η αρχή κάθεται flush στην παρειά). ΜΕΤΑ το 1ο κλικ
    (awaiting-end) η γραμμή περιστρέφεται **ΕΛΕΥΘΕΡΑ** γύρω από την αρχή — καμία έλξη flush κατά μήκος του σώματος της
    υφιστάμενης γραμμής (μόνο κανονικό OSNAP). `generateLinePreview` → `null` όταν `tempPoints.length≠0`· το commit
    face-snap gate-άρεται σε `drawingState.tempPoints.length===0`. (Διαφορά από τον τοίχο, που έχει ΚΑΙ endpoint face-snap.)
  - **Stub length (Giorgio follow-up «πολύ μεγάλο»)**: ο εγκέφαλος παράγει stub `MEMBER_GHOST_LEN_MM`=1200mm (ΑΚΡΙΒΩΣ
    όσο ο τοίχος — αριθμητικά επιβεβαιωμένο), αλλά η **λεπτή** γραμμή στα 1.2m διαβάζεται οπτικά υπερμεγέθης (ο χοντρός
    τοίχος όχι). NEW tunable `LINE_GHOST_STUB_LEN_MM`=300mm κόβει ΜΟΝΟ το οπτικό stub πριν το κλικ (`clampStubLength`,
    διατηρεί την κάθετη φορά)· η διαμήκης θέση + οι κυανές (`faceFrame`) ΔΕΝ επηρεάζονται· το πραγματικό μήκος της
    γραμμής μετά το κλικ ΑΜΕΤΑΒΛΗΤΟ.
  - **SSoT centralization (Giorgio audit — «μηδέν διπλότυπα, μία πηγή αλήθειας»)**: το audit στον νέο κώδικα βρήκε
    **2 διπλότυπα** (1 δικό μου + 1 προϋπάρχον) → κεντρικοποιήθηκαν:
    · **`resizeSegmentToLength(start,end,length)`** NEW στο `rendering/entities/shared/geometry-vector-utils.ts` — η
      γεωμετρία «μετακίνησε το άκρο σε δοθέν μήκος κατά μήκος της διεύθυνσης» ήταν αντιγραμμένη ως min-clamp (wall
      `clampPreviewMinLength`) + max-clamp (line `clampStubLength`). Τώρα ΜΙΑ πηγή· wall+line την καλούν (η συνθήκη
      min/max μένει στον caller).
    · **`getDefaultLayerId()`** NEW στο `stores/LayerStore.ts` — το one-liner `getLayer(DXF_DEFAULT_LAYER)?.id ?? ''`
      ήταν **ΠΡΟΫΠΑΡΧΟΝ διπλότυπο σε 9 αρχεία** (beam/column/foundation/slab/wall/line/xline/wall-covering preview
      helpers + generator). Κεντρικοποιήθηκε (ADR-358 id-only WRITE)· και τα 10 σημεία (9 + το δικό μου) μεταναστεύθηκαν
      → ΜΙΑ πηγή, 10 αντίγραφα διαγράφηκαν. (Οι 2 inline `?id` παραλλαγές διαφορετικού type contract — flagged, όχι εδώ.)
  - **Tests**: NEW `line-preview-helpers.test.ts` (8/8 GREEN): stub flush/κάθετο + κοντό μήκος (~300mm), faceFrame→dims, awaiting-end flush,
    preview≡commit, μακριά→null/αυτούσιο, armed ImmediateSnap. Regression: brain + column/foundation preview suites 58/58 GREEN.
    tsc DEFERRED (N.17).
  - **🔴 Browser-verify + commit (Giorgio)**. Όρια/flag: η precedence «length/angle lock (Δαχτυλίδι) vs face-snap» στη
    γραμμή = lock-then-face-snap (symmetric preview/commit)· πιθανή μελλοντική ευθυγράμμιση με τον τοίχο («lock νικά»).
    **NEW**: `line-preview-helpers.ts`, `BimSnapToolKind 'line'`, `ExtendedLineEntity.faceDimensions`. **MOD**:
    `bim-cursor-snap.ts`, `drawing-types.ts`, `drawing-preview-generator.ts`, `drawing-preview-partial.ts`, `useDrawingHandlers.ts`.

- **2026-06-30 (§line-hud — η ΓΡΑΜΜΗ δείχνει το ΙΔΙΟ live HUD μήκους+γωνίας με τον τοίχο, κοινός painter)**
  - **Αίτημα Giorgio**: «όταν σχεδιάζω τοίχο βλέπω μήκος/πάχος/γωνία στο φάντασμα· στη γραμμή όχι. Βάλε
    τις ίδιες ενδείξεις στη γραμμή με τον ΙΔΙΟ κώδικα, μία πηγή αλήθειας. Ναι ή όχι;» → **ΝΑΙ**, ο painter
    ήταν ήδη tool-agnostic.
  - **SSoT audit (2 Explore agents)**: ο `paintWallHudCore` (`wall-hud-paint.ts`) παίρνει μόνο 2 σημεία +
    γωνία + labels μέσω generic `WallHudProjector` — **μηδέν wall import**. Η γραμμή ήδη έδειχνε ΦΤΩΧΟ
    inline label (μήκος+γωνία ως κείμενο, ADR-510 Φ1) μέσω `renderLine`· έλειπε η πλούσια **aligned ISO-129
    διάσταση** που έχει ο τοίχος. Διαφορά τοίχου↔γραμμής = ΜΟΝΟ πάχος/ύψος (BIM στερεό· η γραμμή δεν έχει).
  - **Fix (ZERO new mechanism)**: (1) NEW SSoT factory `buildSegmentHudMeta(start,end,sceneUnits,thicknessMm=0,
    heightMm=0)` στο `wall-hud-paint.ts` — ΕΝΑΣ υπολογισμός μήκους(mm)/γωνίας για τοίχο ΚΑΙ γραμμή,
    **reuse των κοινών SSoT** `calculateWorldDistance` + `calculateAngle`→`radToDeg`→`normalizeAngleDeg`
    (ADR-068· ίδια αλυσίδα με `renderLine`/dimensions — μηδέν inline `Math.atan2`/`hypot`/`%360`)· ο wall
    `buildWallHudMeta` τώρα **delegate** (εξάλειψη διπλού atan2/length). (2) `paintWallHudCore` παραλείπει το
    spec label όταν είναι κενό (γραμμή = χωρίς BIM ταυτότητα). (3) `applyPreviewStyling` κρεμάει `liveDimHud`
    (`ExtendedLineEntity`) **ΜΟΝΟ** στο line tool (όχι measure-distance), thickness/height=0, scene canonical-mm.
    (4) `renderLine` παραλείπει τα δικά του inline labels όταν υπάρχει `liveDimHud` (**μηδέν διπλό μήκος/γωνία**·
    measure-distance κρατά τα δικά του). (5) `drawing-hover-handler` ζωγραφίζει το `liveDimHud` μέσω του **ΙΔΙΟΥ**
    `drawWallHud → paintWallHudCore` (κενό specLabel).
  - **Συνέπεια**: το HUD δείχνει τον **ίδιο** αριθμό μήκους με το παλιό label (`formatLengthForDisplay`, canonical mm).
    Ο radial command ring (ADR-513) ΔΕΝ αντιγράφηκε — είναι wall-specific (πάχος/ύψος wedges)· εκτός εμβέλειας.
  - ✅ Google-level: YES — ΕΝΑΣ painter + ΜΙΑ factory για τοίχο+γραμμή, μηδέν διπλότυπη μηχανή/inline label.
  - **Tests**: +5 στο `wall-hud-paint-projector.test.ts` (factory length/angle/normalize/wall-passthrough + κενό
    specLabel → μόνο μήκος+γωνία). **9/9 GREEN.** Pre-existing red suites `useWallTool`/`floorplan-symbol-completion`
    επιβεβαιωμένα ΑΣΧΕΤΑ (stash-verified: αποτυγχάνουν & χωρίς αυτές τις αλλαγές). tsc DEFERRED (N.17).
  - **🔴 Φ2 / όρια**: angular/ordinate άσχετα· η γραμμή=canonical-mm (όπως το προϋπάρχον label). Πιθανή μελλοντική
    μετονομασία `wallHud`/`drawWallHud`→`liveDimHud`/`drawLiveDimHud` (cosmetic, ευρύ rename) flagged, όχι blocker.
    **NEW**: `buildSegmentHudMeta`, `ExtendedLineEntity.liveDimHud`. **MOD**: `wall-hud-paint.ts`, `wall-preview-helpers.ts`,
    `drawing-preview-partial.ts`, `preview-entity-renderers.ts`, `drawing-hover-handler.ts`, `drawing-types.ts`.
    **🔴 Pending (Giorgio)**: browser-verify (σχεδίασε γραμμή → aligned διάσταση μήκους + γωνία όπως τοίχος) + commit.

- **2026-06-20** — Δημιουργία. Εξαγωγή `bim/framing/` SSoT· beam files → aliases· wall ghost + 2-κλικ FSM.
- **2026-06-21** — Wall 2nd-click **relative-polar-to-face** (Revit «angle relative to face»):
  `applyPolar` +optional `baseAngle` (SSoT, backward-compat)· capture `startFaceAngle` στο 1ο κλικ
  (`WallToolState` + `wallPreviewStore`)· `getWallFaceRelativeBaseAngle` + `resolveWallFaceRelativePolar`
  (`bim-ortho-reference`, preview≡commit)· wire σε `drawing-hover-handler` (preview) + `applyBimDrawingConstraint`
  (commit). 90° relative ⇒ κάθετο + 2 base γωνίες flush. 48 jest GREEN. **Uncommitted.**
- **2026-06-21 (fix)** — η πράσινη ένδειξη έδειχνε την **απόλυτη** γωνία κόσμου (π.χ. «41.9°») ενώ ο
  τοίχος ήταν ορατά κάθετος. NEW `faceRelativeDisplayAngle` (polar-utils SSoT) → το tooltip δείχνει τη
  γωνία **σχετικά ως προς την παρειά** (κάθετο ⇒ 90°, παράλληλο ⇒ 0°, διαγώνιες 15/30/45/60/75)· η
  γραμμή ίχνους μένει στην απόλυτη κατεύθυνση. Wire στο `drawing-hover-handler`. +5 jest (53 σύνολο).
- **2026-06-21 (zoom-adaptive βήμα)** — **(α)** το ΜΗΚΟΣ του τοίχου στο 2ο κλικ κουμπώνει σε σταθερά
  zoom-adaptive βήματα· **(β)** το ΓΛΙΣΤΡΗΜΑ του φαντάσματος κατά μήκος παρειάς υφιστάμενου τοίχου
  κουμπώνει στο ίδιο βήμα. **ΙΔΙΟ SSoT με τα ίχνη ευθυγράμμισης** (`adaptive-distance-snap`): NEW
  `quantizeMagnitude` (scalar core που μοιράζονται `quantizeAlongPath` + face-snap). (α) μέσα στο
  `resolveWallFaceRelativePolar(point, worldPerPixel)` → preview (`drawing-hover-handler`) + commit
  (`applyBimDrawingConstraint`, worldPerPixel από `useCanvasClickHandler`). (β) optional
  `slideStepScene` στο `resolveLinearMemberFaceSnap`· ο dispatcher `resolveMemberGhostSnapFromStore`
  παίρνει `worldPerPixel` και υπολογίζει το step μία φορά· wall callers (`useWallTool` click +
  `wall-preview-helpers` ghost) το περνούν, **το δοκάρι (alias) ΟΧΙ → byte-for-byte αμετάβλητο**. 76 jest.
- **2026-06-21 (SSoT cleanup)** — κεντρικοποίηση του επαναλαμβανόμενου idiom `1/Math.max(scale,0.001)` /
  `px/Math.max(scale,0.001)` (9 σημεία) σε NEW zero-import leaf `rendering/utils/viewport-scale.ts`
  (`worldPerPixel` + `pixelsToWorld` + `MIN_VIEW_SCALE`). Υιοθετήθηκε σε όλα τα drawing/tracking/rulers
  call sites (drawing-hover-handler, useCanvasClickHandler, useWallTool, wall-preview-helpers,
  useDrawingHandlers, RulersGridSystem). Εξάλειψη scattered magic `0.001`. +8 jest (93 σύνολο).
  99 jest πράσινα (framing core + beam aliases + wall-preview-store + wall-completion). 🔴 browser-verify + commit.
- **2026-06-21 (§dim — listening dimensions στο wall ghost)** — Revit-style temporary/listening
  dimensions καθώς το φάντασμα τοίχου γλιστράει 🟢 πάνω σε παρειά υφιστάμενου μέλους. Giorgio:
  «πάντα 3 νούμερα ταυτόχρονα» → gap αριστερό άκρο→αριστερή base γωνία φαντάσματος, gap δεξιά base
  γωνία→δεξί άκρο, και κέντρο-παρειάς→άξονα φαντάσματος. **FULL SSoT reuse, μηδέν διπλότυπο**:
  (1) `resolveLinearMemberFaceSnap` **εκθέτει** το ήδη-υπολογισμένο `faceFrame` (alongMin/Max +
  centerAlong + half + axis/perp· μηδέν νέο projection)· (2) NEW pure `bim/framing/ghost-face-dim-references.ts`
  (αδελφό του `bim/walls/opening-dim-references.ts` — «offsets κατά μήκος άξονα προς πλησιέστερη
  αναφορά»· υπολογίζει τις 3 αποστάσεις + witness points + zoom-adaptive perpendicular offsets,
  drops flush/zero)· (3) NEW thin `canvas-v2/preview-canvas/ghost-face-dim-paint.ts` που χτίζει
  transient `aligned` DimensionEntity ([p1,p2,dimLineRef]) και ΖΩΓΡΑΦΙΖΕΙ μέσω του **ADR-362
  `renderPreviewDimension` SSoT** (ο μόνος 2D dim renderer — μηδέν 2ος path) με στυλ `ISO_129_TEMPLATE`·
  (4) metadata `faceDimensions` κρεμασμένο στο ghost entity (`toWysiwygPreviewEntity`, mirror
  `ghostStatusColor`)· (5) `wall-preview-helpers.makeWallGhostBeforeClick` υπολογίζει+attach (μόνο 🟢,
  ΟΧΙ 🔴 overlap)· (6) thin `PreviewRenderer.drawGhostFaceDimensions` + `PreviewCanvas` handle (mirror
  `drawTrackingAlignment`)· (7) `drawing-hover-handler` διαβάζει το metadata + ζωγραφίζει overlay μετά
  το `drawPreview`. **ΜΑΘΗΜΑ/fix (browser, Giorgio): οι γραμμές φαίνονταν, τα νούμερα ΟΧΙ** — ο
  ADR-362 renderer σκόπιμα ΔΕΝ auto-scale-άρει το κείμενο (text=dimtxt·dimscale·scale ≈ sub-pixel σε
  τυπικό zoom). NEW opt `textScreenScaled` στο `renderPreviewDimension` (το `4/scale` ζει ΜΟΝΟ μέσα
  στον renderer — μηδέν duplication στο call site) → text ~10px σε κάθε zoom για ephemeral dims.
  21 jest (ghost-face-dim-references 6 + paint smoke 2 + linear-member-face-snap/member-ghost regression).
  tsc clean. ⚠️ CHECK 6B/6D (PreviewRenderer/PreviewCanvas/drawing-hover-handler) → stage ADR-040 + ADR-362.
  Μόνο WALLS (το beam alias παίρνει faceFrame αλλά δεν attach-άρει dims — trivial extension αν χρειαστεί).
  🔴 browser-verify (numbers readable σε zoom· flush drops) + commit.
- **2026-06-21 (§dim browser fixes, Giorgio)** — **(1)** νούμερα σε **ΜΕΤΡΑ**: το text format άρεται
  μέσω του υπάρχοντος SSoT `formatLengthForDisplay(mm, {unit:'m'})` (config/display-length-format)
  ως dim `userText` override — αρχιτεκτονική σύμβαση, ανεξάρτητα από status-bar unit. **(2)** «η γραμμή
  περνά μέσα από το κείμενο» → `dimtfill:'backgroundColor'` (DIMTFILL μάσκα) με χρώμα = live canvas bg
  (`resolveDxfCanvasBackgroundHex` SSoT)· NEW προαιρετικό `canvasBackground` στο `renderPreviewDimension`
  (threaded στο `renderDimensionText` που ήδη υποστηρίζει τη μάσκα). **(3) Boy-Scout κεντρικοποίηση**
  (Giorgio «πλήρη κεντρικοποίηση»): το tracking tooltip (`drawing-hover-handler`) έφτιαχνε χειροκίνητα
  `formatDisplayValue(mm,unit) + DISPLAY_UNIT_LABELS[unit]` → αντικαταστάθηκε με `formatLengthForDisplay`
  (−3 imports). Τα υπόλοιπα `DISPLAY_UNIT_LABELS[]` (CadStatusBar selector, PropertiesPalette/QuickProperties
  input-suffix) είναι legit standalone labels, ΟΧΙ duplicates. 22 jest GREEN, tsc clean.
- **2026-06-22 (§opening-conflict — wall ghost 🔴 ΜΠΛΟΚΑΡΕΙ μπροστά από άνοιγμα, 3D)** — όταν ο
  κάθετος τοίχος-φάντασμα (T-framing στην παρειά host) θα **έκοβε** πόρτα/παράθυρο του host, γίνεται
  **🔴 + block commit** (ίδιο μονοπάτι με το short-end overlap). 3D έλεγχος: κατακόρυφη τομή
  `[baseOffset, +height] ∩ [sillHeight, +height]` **ΚΑΙ** οριζόντια `[abut−t/2, abut+t/2] ∩
  [offsetFromStart, +width]` κατά τον host άξονα. **ΕΝΑΣ κανόνας πόρτα/παράθυρο** (sillHeight). **FULL
  SSoT reuse, μηδέν νέος μηχανισμός (Giorgio audit):** (1) NEW pure `bim/walls/wall-opening-conflict.ts`
  (`wallGhostBlocksOpening` + `resolveWallOpeningConflictForHost`) — **reuse `getEntityZExtents` (ADR-452)**
  για το κατακόρυφο εύρος ΚΑΙ τοίχου ΚΑΙ ανοίγματος, **`projectPointToWallOffsetMm`** (opening-geometry)
  για το `abut`, **`getSiblingOpeningsOnWall`** (opening-siblings) για φιλτράρισμα ανά `wallId`·
  (2) **Revit-grade host = snapped reference (Giorgio «τι θα έκανε η Revit;»):** ο host ΔΕΝ ξανα-βρίσκεται
  γεωμετρικά — `MemberGhostSnapResult` **εκθέτει `targetId`** (το `best` target που ΗΔΗ επέλεξε ο
  `resolveLinearMemberFaceSnap`)· διαδίδεται live στο preview ΚΑΙ ως locked `WallToolState.anchoredHostId`
  (+ `wall-preview-store`) στο awaitingEnd/commit → ΜΙΑ πηγή αλήθειας για τον host (μηδέν re-derive)·
  (3) `scene-snap-targets` += `wallEntities`+`openings` (1 pass στον ίδιο collector → preview≡commit)·
  (4) gate στον SSoT `buildWallGhostEntity` (wall-preview-helpers) — conflict ⇒ 🔴 + κρύβει listening
  dims + `openingConflict` meta· (5) commit block στο `use-wall-commit.commitStraightFromState` (ίδιο
  `resolveWallOpeningConflictForHost`, host = `anchoredHostId`)· (6) tooltip: `openingConflict.bandMm`
  meta → `drawing-hover-handler` το μεταφράζει (`i18n.t('tools.wall.openingCutConflict', {range})`, el+en·
  reuse `formatLengthForDisplay`) → thin `PreviewRenderer.drawGhostConflictTooltip` (reuse `drawOverlayLabel`,
  overlap red). 13 jest (πόρτα/παράθυρο/μερική/άγγιγμα/host-by-reference). **Κλειδωμένο (Giorgio):** οριζόντιο
  εύρος = πάχος ghost· tooltip = κείμενο + εύρος ύψους· host = snapped reference (ΟΧΙ perpendicular re-derive).
  ⚠️ CHECK 6B/6D (PreviewRenderer/PreviewCanvas/drawing-hover-handler) → stage ADR-040. 🔴 browser-verify + commit.
- **2026-06-22 (§wall-hud — ζωντανή ταυτότητα τοίχου κατά τη σχεδίαση)** — όταν ο χρήστης τραβά τοίχο
  (awaitingEnd) μακριά από άλλα αντικείμενα, ο τοίχος-φάντασμα φαίνεται σαν **έτοιμο διαστασιολογημένο
  αρχιτεκτονικό σχέδιο**: (1) **aligned διάσταση μήκους** κάτω από τον τοίχο (μεγαλώνει live), (2)
  **γωνία** `∠ θ` στην αρχή, (3) ετικέτα **πάχος · ύψος** στη μέση (η BIM ταυτότητα — όχι μόνο
  γεωμετρία). Διαφοροποίηση από big players: AutoCAD/Revit dynamic input δείχνουν μόνο μικρό πεδίο
  μήκος/γωνία· εμείς δείχνουμε **ζωντανά τα BIM μεγέθη**. **FULL SSoT, μηδέν bespoke draw:** εξήχθη
  `paintAlignedOverlayDimension` από το `ghost-face-dim-paint` (κοινό aligned-dim SSoT: `renderPreviewDimension`
  ADR-362 + overlay-line-style) → το μοιράζονται listening-dims ΚΑΙ HUD· NEW `wall-hud-paint.ts`
  (`paintWallHud` + `WallHudMeta`) συνθέτει dim + `drawOverlayLabel` (×2) + `formatLengthForDisplay`/
  `formatAngleLocale`· `wall-preview-helpers.buildWallHudMeta` εξάγει αριθμητικό `wallHud` meta από τον
  χτισμένο τοίχο (gated σε ευθύ awaitingEnd/footprint· `wantHud`)· `drawing-hover-handler` μεταφράζει το
  spec (`i18n.t('tools.wall.hudSpec', {thickness,height})`, el+en) + καλεί `PreviewRenderer.drawWallHud`·
  thin `PreviewCanvas` facade. Χρώμα HUD = ουδέτερο γκρι (διακριτό από cyan listening dims). **Κλειδωμένο
  (Giorgio):** στυλ «Αρχιτεκτονικό» (διαστάσεις πάνω στον τοίχο). ⚠️ CHECK 6B/6D (PreviewRenderer/
  PreviewCanvas/drawing-hover-handler) → stage ADR-040. 🔴 tsc + browser-verify + commit.
- **2026-06-23 (§center/flush μαγνήτες — Giorgio bug «δεν κεντράρει σε κοντή γραμμή»)** — όταν ο τοίχος
  κούμπωνε την παρειά του σε **κοντή γραμμή** (π.χ. 25cm), δεν καθόταν στο **μέσο** της: άφηνε 1,5/2,5cm
  (5mm offset). **ΡΙΖΑ:** στο T-framing (`resolveLinearMemberFaceSnap`) το `centerAlong` ακολουθούσε τον
  cursor κουμπωμένο σε **regular grid** (`quantizeMagnitude(cAlong, slideStepScene)`, anchored στην αρχή
  της γραμμής) → **έχανε** το μέσο/flush. Λείπαν οι «μαγνήτες» χαρακτηριστικών θέσεων που έχει ήδη η
  **κολόνα** (`resolveMemberColumnFaceSnap`: lo→flush, mid→κέντρο, hi→flush). **FIX:** NEW pure
  `magnetizeGhostCenterAlong` — το centerline κουμπώνει στο **κέντρο** της παρειάς ή **flush** σε κάθε
  κοντή άκρη όταν ο raw cursor είναι εντός `radius=slideStepScene`, αλλιώς συνεχής/grid ολίσθηση (ΜΕΤΑΞΥ
  μαγνητών αμετάβλητη). Gated σε `slideStepScene` (τοίχος)· **δοκάρι αμετάβλητο**. Υλοποιεί το documented
  intent του `lineTarget`/`edgeBandTarget` («flush εκατέρωθεν + center»). 5 jest (center/flush/free-slide·
  26 σύνολο). 🔴 browser-verify + commit. (Pre-existing άσχετο fail `beam-grips.test` rotation-grip
  standoff = grip-domain, uncommitted άλλου agent — ΟΧΙ δικό μου.)
- **2026-06-24 (ΠΛΗΡΗΣ ΕΝΟΠΟΙΗΣΗ τοίχου↔κολώνας — Giorgio «FULL ENOPOIHSH, FULL SSoT»)** — ο τοίχος
  τώρα ολισθαίνει «ρευστά» γύρω από **κάθε** μέλος, σε **αμφότερα** τα άκρα, όπως η κολώνα. Δύο διαφορές
  λύθηκαν: **#1 — συνεχής ολίσθηση στις κολώνες (wall START):** το `resolveMemberColumnFaceSnap` έπαψε
  να ΠΗΔΑΕΙ σε 12 διακριτές θέσεις· έγινε **ΣΥΝΕΧΕΣ** (mirror του `resolveLinearMemberFaceSnap` + του
  column-tool `resolveForTarget`): `clamp` διαμήκης θέσης + reuse του ΙΔΙΟΥ `magnetizeGhostCenterAlong`
  (3 anchors: κέντρο + flush άκρα) + **έκθεση `GhostFaceFrame`** → listening dimensions ΚΑΙ στις κολόνες.
  NEW pure helpers `slideAlongFace`/`resolveContinuousColumnFace` (N.7.1 ≤40γρ.)· νέο optional
  `slideStepScene` στο `MemberColumnFaceSnapOptions`· ο dispatcher υπολογίζει το step **μία φορά** και το
  περνά ΚΑΙ στο column branch + επιστρέφει `faceFrame`. **#2 — face-snap στο ENDPOINT (wall awaitingEnd):**
  NEW pure `bim/walls/wall-endpoint-snap.ts` (`resolveWallEndpointSnap`) = **point snap** που κάνει reuse
  τον ΙΔΙΟ dispatcher και κρατά το `snap.start` (flush σημείο). Wire σε preview (`wall-preview-helpers`,
  πριν το `clampPreviewMinLength`, + endpoint listening dims) ΚΑΙ commit (`useWallTool` awaitingEnd) →
  **preview ≡ commit**. **Precedence (Giorgio):** face-snap > ORTHO (CAD-standard osnap>ortho)·
  **length/angle lock (Δαχτυλίδι) νικά** το face-snap → NEW `isLengthAngleLockActive` (SSoT στο
  `length-angle-lock`, reuse `DynamicInputLockStore`). **Layering:** `buildColumnBboxFaceFrame`
  μετακινήθηκε `bim/columns/column-face-snap-helpers` → `bim/framing/linear-member-face-snap` (SSoT home
  του `GhostFaceFrame`· αποφυγή κύκλου `framing→columns`) + re-export alias για τους column consumers·
  `magnetizeGhostCenterAlong` έγινε `export`. **ΠΑΡΕΝΕΡΓΕΙΑ ΔΟΚΑΡΙΟΥ (διαφανώς):** το δοκάρι μοιράζεται
  τον ίδιο resolver → το δοκάρι-σε-κολώνα έγινε **κι αυτό συνεχές** (χωρίς magnet, αφού το δοκάρι δεν
  περνά `slideStepScene`) — **εσωτερικά συνεπές** με τη συμπεριφορά του δοκαριού στα μέλη (που ήταν ήδη
  συνεχής). beam-column-face-snap tests ενημερωμένα σε συνεχή. **Αμετάβλητα:** column-priority (`neutral`),
  🟢/🔴 overlap, opening-conflict (host = start `anchoredHostId`), curved/polyline. 109 jest GREEN
  (member-ghost-snap + wall-endpoint-snap + beam-column-face-snap + column-face-snap)· framing/walls/beams/
  columns sweep 1196/1197 (το 1 fail = pre-existing `beam-grips` rotation-grip, άλλου agent). ⚠️ CHECK
  6B/6D (wall-preview-helpers/useWallTool drawing path) → stage ADR-040. 🔴 browser-verify + commit.
- **2026-06-24 (fix — «να ολισθαίνει ΠΛΗΡΩΣ», Giorgio)** — ο τοίχος **ακόμη** μετακινούνταν σε σταθερά
  βήματα στην παρειά (όχι ρευστά). ΡΙΖΑ: το `slideStepScene` (zoom-adaptive quantize 2026-06-21β) +
  ο magnet (radius=step, 2026-06-23) — σε normal zoom το step είναι τεράστιο → η ολίσθηση «κούμπωνε» σε
  βήματα/3 ζώνες. Η **κολώνα** (gold standard) ολισθαίνει ΚΑΘΑΡΑ συνεχώς (`resolveForTarget` = σκέτο
  `clamp`, μηδέν quantize/magnet). **FIX:** ο τοίχος **έπαψε να περνά `worldPerPixel`** στο face-snap
  (`useWallTool.resolveWallStartAnchor` + endpoint commit· `wall-preview-helpers` ghost + endpoint) →
  `slideStepScene` undefined → **πλήρως συνεχής ολίσθηση** START+END, ίδια με την κολώνα. Το `wpp` μένει
  ΜΟΝΟ για το screen-relative offset των listening dims. Η capability quantize/magnet (`slideStepScene`/
  `magnetizeGhostCenterAlong`) **διατηρείται** στον resolver (gated· ανενεργή) → re-enable με ένα όρισμα
  αν ζητηθεί «soft» center/flush snap. **Αναιρεί** το 2026-06-21β (slide-quantize) + 2026-06-23 (magnet)
  ΓΙΑ ΤΟΝ ΤΟΙΧΟ (το «δεν κεντράρει σε κοντή γραμμή» μπορεί να επανέλθει — αναμονή browser-verify). 94 jest
  GREEN. 🔴 browser-verify + commit.
- **2026-06-24 (proportional fine slide step — Giorgio «συνεχή και ομαλή κίνηση»)** — αντικατάσταση του
  pure-continuous ΚΑΙ του παλιού zoom-adaptive βήματος με **γεωμετρικά παραγόμενο αναλογικό βήμα**: η
  κυρίαρχη (μεγάλη) παρειά μήκους `L` διαιρείται ανά **1cm** (`DOMINANT_DIVISION_MM`) → `N = round(L/1cm)`·
  το βήμα ολίσθησης = **`πλάτος_μέλους / N`**. Παράδειγμα Giorgio: παρειά 2.5m ÷ 1cm = 250 τμήματα· νέος
  τοίχος 0.25m ÷ 250 = **1mm βήμα** → οπτικά συνεχές & ομαλό αλλά deterministic/αναλογικό πλέγμα. NEW pure
  SSoT `proportionalSlideStep(faceLen, memberWidth, dominantUnit)` (linear-member-face-snap)· reuse ΚΑΙ στο
  column branch (`member-column-face-snap.slideAlongFace`) ΚΑΙ στο member branch. Ο dispatcher υπολογίζει
  ΜΙΑ φορά `dominantUnitScene = 1cm·f` (αντικατέστησε το `worldPerPixel`/`adaptiveDistanceStep` param —
  αφαιρέθηκε· κανένας caller δεν το περνά). **Ο magnet (κέντρο/flush, 2026-06-23) ΔΙΑΤΗΡΕΙΤΑΙ & αυτο-
  κλιμακώνεται:** radius = βήμα → σε κοντή παρειά (25cm→βήμα 8.4mm) ο magnet κεντράρει (το «κενό σε κοντή
  γραμμή» ΔΕΝ επανέρχεται)· σε μεγάλη παρειά (2.5m→βήμα 1mm) αμελητέος → ομαλό. Ισχύει σε **τοίχο + δοκάρι
  + κολώνα** (κοινός dispatcher· beam consistent). opts `slideStepScene` → `dominantUnitScene` (rename +
  νέα σημασιολογία: μονάδα διαίρεσης, όχι έτοιμο βήμα). 67 jest GREEN στα 4 snap suites (framing/walls/beams
  sweep 688/689· το 1 fail = pre-existing `beam-grips`). 🔴 browser-verify + commit.
- **2026-06-24 (fix — «πηδάει άκρες↔κέντρο», Giorgio browser-verify)** — στη μικρή παρειά το φάντασμα
  **πηδούσε** άκρες→κέντρο→άκρες αντί ομαλά. ΡΙΖΑ: (1) η **3-ζωνική μετατόπιση** `baseShift` (lo→+half,
  mid→0, hi→−half) στο `resolveLinearMemberFaceSnap` έκανε το centerline να **πηδά ±half** στα όρια των
  τρίτων· (2) ο `magnetizeGhostCenterAlong` (κέντρο/flush anchors) πρόσθετε επιπλέον grabbing. **FIX
  (FULL SSoT):** αντικατάσταση και των δύο με **ΣΥΝΕΧΕΣ centerline = (quantized) cursor, clamped εντός
  παρειάς `[alongMin+half, alongMax−half]`** (μέλος ευρύτερο → κεντράρισμα). Αυτό δίνει: ομαλή κίνηση
  ΧΩΡΙΣ άλματα + **auto edge-flush στα άκρα** (centerline=insLo ⇒ πλάγια ακμή flush) — διατηρεί το intent
  του παλιού shift/magnet ΧΩΡΙΣ διακριτότητα. Εφαρμόστηκε ΚΑΙ στο `member-column-face-snap.slideAlongFace`
  (ίδιο inset clamp). **Διαγράφηκε** ο `magnetizeGhostCenterAlong` (αχρησιμοποίητος· un-export) + το
  `pickThird` import από linear (το `third` μένει μόνο column-side metadata, από τη ζώνη **του cursor**).
  Affects τοίχο+δοκάρι+κολώνα (κοινός resolver· beam-beam/beam-column tests → inset values). 691/692 jest
  (1 fail = pre-existing `beam-grips`). 🔴 browser-verify + commit.
- **2026-06-24 (endpoint face-snap ενοποίηση τοίχου↔δοκαριού — 2ο κλικ)** — το ΑΚΡΟ (2ο κλικ) του τοίχου
  είχε ήδη flush face-snap + listening dims + Shift 1cm βήμα (`wall-endpoint-snap`)· **το δοκάρι ΟΧΙ**.
  Ο μηχανισμός ήταν ήδη 100% generic (καλεί τον κοινό `resolveMemberGhostSnapFromStore` + το move-SSoT
  `applyMoveFineStepAboutAnchor`· το «wall» ήταν μόνο όνομα). **FIX (FULL SSoT, μηδέν διπλότυπο):**
  γενίκευση σε **NEW `bim/framing/member-endpoint-snap.ts`** (`MemberEndpointSnap`,
  `resolveMemberEndpointSnap`, `resolveMemberEndpointWithFineStep`) δίπλα στον dispatcher που χρησιμοποιεί·
  το `bim/walls/wall-endpoint-snap.ts` → **thin re-export** (wall-named aliases, byte-for-byte για wall
  consumers + test· mirror του beam-adapter pattern). **Wire δοκάρι:** preview (`beam-preview-helpers.
  generateBeamPreview` awaitingEnd → endpoint snap + fine-step + `endFaceFrame`→listening dims στο
  `makeBeamWysiwygGhost`) + commit (`useBeamTool.onCanvasClick` awaitingEnd → `resolveMemberEndpointSnap`
  πριν το `commitTwoClickFromState`) → preview ≡ commit. Target set δοκαριού = `['beam','slab']` (ίδιο με
  το START του, consistency). Το δοκάρι **δεν** έχει length/angle lock (wall-only ADR-513) → χωρίς lock
  branch (απλούστερο από τον τοίχο). Curved → raw cursor (αμετάβλητο, mirror τοίχου). **ADR-514 Φ5
  registry:** το νέο leaf προστέθηκε στο allowlist του module `bim-cursor-snap` (legit direct
  `resolveMemberGhostSnapFromStore` call· canonical END leaf, distinct από τον brain). 16 jest νέα/re-export
  (member+wall endpoint) + 76 beam/framing regression GREEN. 🔴 tsc + browser-verify + commit (CHECK 6D:
  stage ADR-508 + ADR-040· + `.ssot-registry.json`).
- **2026-06-30 (§wall-hud — DECISION RECORD: γιατί ΛΕΥΚΟ/γκρι vs ΣΙΕΛ διαστάσεις — ΟΧΙ bug)** — ο Giorgio
  ρώτησε αν είναι σωστός ο διπλός χρωματισμός των live wall-ghost διαστάσεων (screenshot 2026-06-30): οι
  **δικές** του τοίχου (μήκος `2.695 m`, spec `πάχος · ύψος`, γωνία `∠`) είναι **ουδέτερο γκρι**
  (`OVERLAY_LINE_COLORS.alignment = '#CCCCCC'`, near-white σε σκούρο καμβά), οι **σχεσιακές** αποστάσεις
  προς γειτονικές παρειές (`0,181 / 0,354 / 0,717 m`) είναι **ΣΙΕΛ** (`OVERLAY_LINE_COLORS.listeningDim =
  '#29B6F6'`). **Συμπέρασμα: ΣΩΣΤΟ — ΚΑΜΙΑ αλλαγή.** (1) SSoT audit (grep): ΕΝΑ palette
  `OVERLAY_LINE_COLORS`, 2 μηχανισμοί (`wall-hud-paint` γκρι vs `ghost-face-dim-paint` σιελ), μηδέν inline
  hex / 3ος μηχανισμός — η διαφοροποίηση είναι εσκεμμένη («distinct mechanism colour»). (2) Big-player
  επιβεβαίωση: **Revit** «listening dimensions» = ξεχωριστό μπλε temporary για system-driven μετρήσεις·
  **Figma** οι red measurement lines (απόσταση-σε-γείτονα) είναι **σκόπιμα ξεχωριστό, μη-παραμετροποιήσιμο**
  χρώμα από το selection/own χρώμα· **AutoCAD** otrack/polar tracking traces = διακριτό accent. Η universal
  αρχή: **own identity ≠ relational/inference dims** → διαφορετικό χρώμα. Η ορολογία μας (`listeningDim`)
  ήδη καθρεφτίζει τις Revit listening dimensions. Συνεπώς το «όλα σιελ» θα **έχανε** τη διάκριση «τι χτίζω»
  vs «πού βρίσκομαι ως προς υπάρχουσα γεωμετρία». Καμία αλλαγή κώδικα/jest (decision-only).
- **2026-06-30 (§wall-hud / §label-layout — anti-collision των live wall-ghost labels σε ΚΑΘΕΤΟ/λοξό τοίχο)** —
  ο Giorgio (2 screenshots) ανέφερε ότι σε **κάθετο** τοίχο-φάντασμα το HUD spec «πάχος 0,210 m · ύψος 3,000 m»
  **πέφτει πάνω** στο μήκος «2,600 m» (σε οριζόντιο όχι). **Root (επιβεβαιωμένο γεωμετρικά):** ο `paintWallHudCore`
  τοποθετούσε spec/μήκος σε **αντίθετες πλευρές** με σταθερό perpendicular offset (`labelOff = halfT +
  LABEL_CLEAR_PX·wpp`) που **αγνοούσε το πλάτος του κειμένου**. Σε απότομο τοίχο η κάθετη γίνεται σχεδόν
  οριζόντια → η perpendicular συνιστώσα σε screen-Y μικραίνει ΚΑΙ το πλατύ spec-text «γεφυρώνει» απέναντι πάνω
  στον αριθμό. **FIX (FULL SSoT, big-player Revit/AutoCAD «dim text gap»):** NEW pure SSoT
  `canvas-v2/preview-canvas/overlay-label-layout.ts` (`measureOverlayLabelBox` + `boxHalfExtentAlong` +
  `clearanceForBox`) — **text-box-aware** clearance: η ΚΟΝΤΙΝΗ ακμή κάθε label κάθεται ακριβώς `baseClearPx` πέρα
  από τον άξονα **ανεξάρτητα γωνίας** (κάθετο → καθαρίζει το μισό ΠΛΑΤΟΣ, οριζόντιο → το μισό ΥΨΟΣ). Επεκτείνει
  το ΣΥΜΒΟΛΑΙΟ μη-επικάλυψης που ξεκίνησε το `CURSOR_LABEL_SLOTS` (overlay-text-style.ts) — «μη-επικάλυψη =
  ΣΥΜΒΟΛΑΙΟ, όχι σύμπτωση». `paintWallHudCore`: spec + γωνία πλέον box-aware (διατηρεί world-offset→toScreen, ίδιο
  μοτίβο call-counts → μηδέν test regression). **ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ (Giorgio order):** το `drawLabelBeyond`
  (ghost-face-dim-paint.ts — μοιραζόμενο από listening-dims ΚΑΙ μήκος) δρομολογήθηκε στον ΙΔΙΟ SSoT → όλοι οι
  overlay αριθμοί box-aware (η κοντινή ακμή πέρα από τη dim line, ποτέ πάνω της). 24/24 jest GREEN
  (`overlay-label-layout` νέο + `wall-hud-paint-projector` 7 + `ghost-face-dim-paint` 5). **Case A (cross-layer,
  RESOLVED):** το κίτρινο snap-label «Επί άξονα τοίχου» (`SnapIndicatorGlyph.tsx`, SVG/DOM overlay, anchored στο
  snap point) έπεφτε στο canvas **dim pill** («L=… t=…», `bim-dim-labels.ts drawEntityDimLabel`, κάτω από το
  κέντρο). Διαφορετικά layers (DOM vs canvas) → ο canvas pill θα ήταν **stale** αν τον έκανα snap-aware (το snap
  store δεν re-render-άρει αξιόπιστα το entity canvas), ενώ το snap label re-renders με το snap. **FIX:** το snap
  **label** μπαίνει σε ΞΕΧΩΡΙΣΤΗ baseline ΠΑΝΩ από το glyph (το glyph μένει στο snap point) μέσω NEW pure SSoT
  `snapLabelTop` (στο ίδιο `overlay-label-layout.ts`) — big-player «separate baselines» (Revit/Figma: own dim ≠
  transient inference label). Το dim pill (κάτω από το κέντρο) και το snap label (πάνω από το glyph) δεν
  μοιράζονται πια band. Συνολικά 13 jest στο νέο SSoT. 🔴 browser-verify + commit (CHECK 6D: stage ADR-508 +
  ADR-040· NEW overlay-label-layout.ts + mod wall-hud-paint.ts + ghost-face-dim-paint.ts + SnapIndicatorGlyph.tsx
  + 2 test).
