# HANDOFF — Βηματική μετακίνηση 1 cm με πλήκτρο (Shift/Alt) κατά το drag μέλους

**Ημ/νία:** 2026-06-24
**Τύπος:** Νέο feature (DXF/BIM Viewer — move/drag). Revit-grade, **FULL ENTERPRISE + FULL SSoT**.
**Γλώσσα:** Απαντάς στον Giorgio **ΣΤΑ ΕΛΛΗΝΙΚΑ.**

---

## 🚨 ΚΑΝΟΝΕΣ ΣΥΝΕΔΡΙΑΣ (απαράβατοι)
- **COMMIT/PUSH κάνει ΜΟΝΟ ο Giorgio.** ΠΟΤΕ εσύ. **Το working tree μοιράζεται με ΑΛΛΟΝ agent** → ΠΟΤΕ `git add -A`, stage μόνο τα δικά σου specific αρχεία (ο Giorgio committκαι).
- **ΠΡΙΝ ΑΠΟ ΚΑΘΕ ΓΡΑΜΜΗ ΚΩΔΙΚΑ → ΠΡΑΓΜΑΤΙΚΟ SSoT AUDIT (grep)** για REUSE υπάρχοντος κώδικα· μηδέν διπλότυπα. Ο Giorgio κάνει σκληρό audit («κεντρικοποιημένο; υπάρχει ήδη; διπλότυπο; θα το έκανε έτσι η Revit;»).
- **FULL ENTERPRISE + FULL SSoT**, όπως οι μεγάλοι παίκτες (Revit). Όχι `any`/`as any`· functions ≤40 γρ., files ≤500 γρ. (N.7.1)· i18n για user-facing strings (N.11).
- **N.14:** non-trivial → δήλωσε μοντέλο (**Opus** — cross-subsystem move + input) & περίμενε «ok».
- **N.8:** αν αγγίξεις 5+ αρχεία / 2+ domains → πρότεινε Plan Mode/Orchestrator, πάρε έγκριση.
- **N.17:** ΕΝΑ tsc τη φορά (τρέχει συχνά άλλος agent — έλεγξε με `Get-CimInstance` πριν)· verify με **jest**.
- **ADR-driven (N.0.1):** code = source of truth· ενημέρωσε ADR + changelog στο τέλος.
- **100% ειλικρίνεια** — αν δεν ξέρεις, πες το.

---

## 1. ΤΟ ΖΗΤΟΥΜΕΝΟ (αναφορά Giorgio)

Κατά τη **μετακίνηση** (drag) ενός μέλους — **τοίχου** (κυρίως· αλλά ενιαία και για κολώνα/δοκάρι) — όταν ο χρήστης **κρατά Shift Ή Alt**, η μετακίνηση να γίνεται σε **βήματα του 1 εκατοστού** (incremental 1 cm snap του delta). Revit-grade «snap increments».

**Στόχος:** καθαρή βηματική μετακίνηση, FULL SSoT (reuse του υπάρχοντος move + grid-snap), preview ≡ commit.

---

## 2. SSoT AUDIT — ΞΕΚΙΝΑ ΑΠΟ ΕΔΩ (grep ΠΡΙΝ γράψεις κώδικα)

⚠️ **Μην εμπιστευτείς τυφλά τις παρακάτω υποθέσεις — επιβεβαίωσέ τες με grep/read** (ο κώδικας είναι η αλήθεια· το handoff μπορεί να είναι stale).

Πιθανά σημεία προς audit/reuse:
- **Ενιαίο move command (ADR-049 «unified move», Revit `MoveElement dx,dy,dz`):** grep `move-entity-cascade`, `calculateBimMovedGeometry`, `MoveCommand`, `useGripMovement`, `GripDragStore`. Εκεί υπολογίζεται το delta της μετακίνησης (2D + 3D). **Εκεί μπαίνει το 1cm-step gating.**
- **Grid-snap SSoT:** `systems/grid/grid-snap.ts` → `snapToGrid` (ADR-049). **ΑΥΤΟ είναι το SSoT** για βηματική στρογγυλοποίηση — πέρασε το move delta από `snapToGrid(step=1cm)` όταν είναι ενεργό το modifier. ΜΗΝ γράψεις νέο rounding helper (μάθημα: είχε γραφτεί διπλότυπο `snapPointsToGrid` → ο Giorgio το έκοψε στο audit).
- **Modifier state κατά το drag:** grep πώς διαβάζονται Shift/Alt στο mouse-move/drag (π.χ. `e.shiftKey`, `e.altKey`, `mouse-handler-move`, `useCentralizedMouseHandlers`, `GripDragStore`). **ΚΡΙΣΙΜΟ:** βρες αν Shift/Alt **έχουν ήδη ρόλο** στο drag (συνήθως **Shift = ORTHO**/περιορισμός άξονα, **Alt = αντιγραφή/copy-move**). Αν ναι → ΣΥΓΚΡΟΥΣΗ· ρώτησε τον Giorgio ποιο πλήκτρο θα κάνει το 1cm-step, ή πρότεινε άλλο (π.χ. το ένα ortho, το άλλο step).
- **Move preview ghost:** βρες πού ζωγραφίζεται το preview της μετακίνησης ώστε **preview ≡ commit** (το ίδιο snapped delta και στα δύο).
- **Step μονάδα:** 1 cm = 10 mm σε mm-scene· χρησιμοποίησε `mmToSceneUnits` (SSoT) για τη μετατροπή — ΟΧΙ hardcoded.

**Παράδειγμα προσέγγισης (μετά το audit):** στο σημείο που υπολογίζεται το move delta, `const step = isStepModifierDown() ? 10 * mmToSceneUnits(units) : 0; const d = step ? snapToGrid(rawDelta, step) : rawDelta;` — gated, reuse, preview≡commit.

---

## 3. ΑΝΟΙΧΤΑ ΣΗΜΕΙΑ (ρώτησε τον Giorgio)
- **Ποιο πλήκτρο** κάνει το 1cm-step (Shift ή Alt;) — εξαρτάται από το τι κάνουν ήδη. Πρότεινε με βάση τα ευρήματα του audit.
- **Snap του delta ή της απόλυτης θέσης;** (incremental βήμα κίνησης vs απόλυτο πλέγμα 1cm). Ο Giorgio είπε «σε βήματα του 1 cm» → πιθανότατα **βήμα του delta** (κάθε 1cm μετατόπιση). Επιβεβαίωσε με συγκεκριμένο αριθμητικό παράδειγμα.

---

## 4. ΕΠΑΛΗΘΕΥΣΗ
- **jest** για το pure step/snap logic (νέο/επεκταμένο suite).
- **Browser (Giorgio):** σύρε τοίχο κρατώντας το modifier → κινείται σε καθαρά βήματα 1 cm· χωρίς modifier → ελεύθερα. Ίδιο σε κολώνα/δοκάρι.
- Ενημέρωσε **ADR-049** (move) + changelog.

---

## 5. ⚠️ ΕΚΚΡΕΜΕΙ ΑΠΟ ΠΡΟΗΓΟΥΜΕΝΗ ΣΥΝΕΔΡΙΑ (UNCOMMITTED — ο Giorgio θα κάνει commit/browser-verify)

**ADR-508 — Πλήρης ενοποίηση face-snap τοίχου↔κολώνας (ρευστή ολίσθηση).** Ολοκληρωμένο, **691/692 jest GREEN** (το 1 fail = προϋπάρχον `beam-grips`, ΑΛΛΟΥ agent — ΟΧΙ δικό μας). **Εκκρεμεί browser-verify + commit από Giorgio.** Μην το πειράξεις εκτός αν στο ζητήσει· απλώς να ξέρεις τι είναι uncommitted στο tree:

**Τι κάνει:** ο τοίχος ολισθαίνει **πλήρως ομαλά** γύρω από μέλη/κολώνες (proportional fine βήμα = παρειά÷1cm→N, βήμα=πλάτος/N· + face-snap στο ENDPOINT)· centerline συνεχές clamped εντός παρειάς `[αρχή+μισό, τέλος−μισό]` (auto edge-flush, **χωρίς άλματα 3-ζωνών/magnet** — ο `magnetizeGhostCenterAlong` διαγράφηκε).

**Αλλαγμένα αρχεία (stage ΜΟΝΟ αυτά + ADR-508· shared tree):**
- `bim/framing/linear-member-face-snap.ts` (proportionalSlideStep + inset clamp· export buildColumnBboxFaceFrame· del magnetize)
- `bim/framing/member-column-face-snap.ts` (συνεχές + faceFrame + inset clamp + DOMINANT_DIVISION_MM)
- `bim/framing/member-ghost-snap.ts` (dispatcher → dominantUnitScene· αφαιρ. worldPerPixel)
- `bim/columns/column-face-snap-helpers.ts` (re-export buildColumnBboxFaceFrame)
- `systems/dynamic-input/length-angle-lock.ts` (NEW `isLengthAngleLockActive`)
- `bim/walls/wall-endpoint-snap.ts` (**NEW** — endpoint point-snap)
- `hooks/drawing/wall-preview-helpers.ts` (endpoint snap wiring + dims)
- `hooks/drawing/useWallTool.ts` (commit precedence: lock > face-snap)
- tests: `member-ghost-snap` / `wall-endpoint-snap`(NEW) / `beam-column-face-snap` / `beam-beam-face-snap` / `linear-member-face-snap`
- `docs/centralized-systems/reference/adrs/ADR-508-unified-linear-member-framing.md` (changelog)

⚠️ CHECK 6B/6D (wall-preview-helpers/useWallTool drawing path) → ο Giorgio να κάνει stage **ADR-040** μαζί στο commit.

---

## 6. ΓΡΗΓΟΡΟ ΞΕΚΙΝΗΜΑ
«Νέο feature: κατά το drag μέλους (τοίχος/κολώνα/δοκάρι), με Shift Ή Alt η μετακίνηση γίνεται σε βήματα 1 cm. FULL ENTERPRISE + FULL SSoT (Revit-grade). SSoT audit (grep) ΠΡΩΤΑ: reuse ADR-049 unified move + `snapToGrid` (`systems/grid/grid-snap.ts`)· βρες αν Shift/Alt έχουν ήδη ρόλο (ortho/copy) → λύσε σύγκρουση με Giorgio. Gated βηματισμός του move delta, preview≡commit, mmToSceneUnits για 1cm. jest + browser. Commit κάνει ο Giorgio. Shared tree — όχι git add -A. Ελληνικά.»
