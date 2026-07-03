# HANDOFF — «Δοκάρι ανάμεσα σε μέλη» (ADR-569): αριστερή άκρη ΔΕΝ ευθυγραμμίζεται (ΑΜΕΣΩΣ)

**Ημερομηνία:** 2026-07-03
**Κατάσταση:** UNCOMMITTED (ο Giorgio κάνει τα commit, ΟΧΙ ο agent). Working tree μοιράζεται με **άλλον agent** — άγγιξε ΜΟΝΟ τα δικά σου αρχεία, ξαναδιάβαζε πριν κάθε edit.
**Επόμενο βήμα:** SSOT audit (grep) → **αναπαραγωγή με τα ΠΡΑΓΜΑΤΙΚΑ footprints** (runtime diagnostic) → surgical fix. Revit/Cinema4D/Figma-level, FULL SSoT, μηδέν διπλότυπα. ΟΧΙ tsc (N.17· jest OK). ΟΧΙ commit.

---

## 1. Τι είναι η εντολή (ADR-569)
Νέα εντολή DXF Viewer (ribbon «Δομικά»): **«Δοκάρι ανάμεσα σε μέλη»** — αλυσίδα κλικ σε κολόνες/τοιχία· κάθε 2ο κλικ φτιάχνει ΑΜΕΣΩΣ δοκάρι ανάμεσα σε προηγούμενο+τρέχον μέλος (+ selection-first reverse flow).

## 2. ✅ Τι ΔΙΟΡΘΩΘΗΚΕ ΗΔΗ σε αυτή τη συνεδρία (UNCOMMITTED, jest 1369/1369 GREEN)

### Fix A — ΛΟΞΑ δοκάρια (face-normal axis)
- **Ρίζα:** ο άξονας `u` οριζόταν **centroid→centroid** → έγερνε όταν τα κέντρα διέφεραν σε Y.
- **Λύση (εντολή Giorgio: «ακολουθεί ΠΑΝΤΑ τις παρειές του πιο κοντινού σκέλους»):** `u` = **κάθετος της facing-ακμής** (face-normal).
- **SSoT (additive):** νέα `closestFacingEdgeBetweenPolygons` + `closestEdgeOnPolygonOutline` στο `bim/geometry/shared/polygon-nearest.ts` (**centroid-probing + 2-step refinement** — mirror του δοκιμασμένου `pairFrame` του `beam-span-snap`· vertex-probing κατέληγε σε γωνία → λάθος κάθετη ακμή). `closestPointOnPolygonOutline` → delegate.
- Άλλαξε ΜΟΝΟ ο ορισμός του `u` στο `computeBeamAxisBetweenMembers`· span face-to-face + lateral flush αμετάβλητα.

### Fix B — associative flush (Revit Location-Line, ADR-529 reuse)
- **Ρίζα:** το `buildBeamBetweenMembers` αποθήκευε flush **centerline** → όταν ο οργανισμός μείωνε το πλάτος, το κέντρο έμενε, η νότια παρειά ξεκόλλαγε.
- **Λύση:** `computeBeamAxisBetweenMembers` επιστρέφει ΚΑΙ `justification` (νέος helper `resolveFlushJustification` μέσω PUBLIC `canonicalAxisNormal`). Το `buildBeamBetweenMembers` αποθηκεύει **location line (=flush παρειά) μέσω `unjustifyAxisPoints`** + `justification` — **ίδιο SSoT pattern με το auto-span `appendCenterlineBeam`** (`use-beam-commit.ts:207`). `computeBeamGeometry`→`justifyAxisPoints` re-derives body → associative με το πλάτος.
- Tests: offset μέλη → `a.y≈b.y`· associative → νότια παρειά μένει y=0 σε width 200→100.

## 3. 🔴 ΤΟ ΑΝΟΙΧΤΟ BUG (προς διόρθωση)

**Στιγμιότυπο:** `C:\Nestor_Pagonis\Στιγμιότυπο οθόνης 2026-07-03 214322.jpg` (δεξιά «OK», αριστερά «ΟΧΙ»).

**Σύμπτωμα:** δοκάρι ανάμεσα σε ΔΥΟ κολόνες. Η **δεξιά** άκρη ευθυγραμμίζεται σωστά (νότια παρειά flush), η **αριστερή ΟΧΙ**.

**Επιβεβαιώσεις από Giorgio (κρίσιμες — καθορίζουν τη ρίζα):**
1. Οι δύο κολόνες έχουν την **ΙΔΙΑ νότια παρειά** (ευθυγραμμισμένες) → είναι **BUG**, όχι θέμα διαφορετικού βάθους.
2. Η αριστερή άκρη είναι λάθος **ΑΜΕΣΩΣ στο 2ο κλικ** (πριν οποιοδήποτε άλλο).
3. **ΔΕΝ** εμφανίστηκε παράθυρο «Προαγωγή σε Γ».

**Άρα ΑΠΟΚΛΕΙΣΤΗΚΑΝ** (πλήρες read-only trace του post-creation pipeline έγινε — βλ. §5): auto-attach/weld (μόνο Z-binding), `reframeBeamEndpointsToColumns`/`cascadeBeamReframe` (ADR-492 — τρέχει μόνο σε `MergeableUpdateCommand`, δηλ. promotion/organism — ΟΧΙ στιγμιαία), `beam-column-cutback` (DERIVED render-only), `useProactiveMemberSizing` (μόνο width, associative-safe).

**Άρα το bug είναι στο ΔΙΚΟ ΜΑΣ placement** (`computeBeamAxisBetweenMembers`), αλλά **ΜΟΝΟ με τα πραγματικά footprints**:
- Για **axis-aligned ορθογώνιες** κολόνες (ίδιο ή διαφορετικό βάθος, ίδια νότια παρειά) ο άξονας βγαίνει **ακριβώς οριζόντιος** και το flush πέφτει **και στα δύο** — αποδείχθηκε αναλυτικά ΚΑΙ με jest (`beam-between-members.test.ts`).
- Επομένως το πρόβλημα εμφανίζεται με **μη-ορθογώνια/στραμμένα** footprints: στραμμένη κολόνα, σχήμα **Γ/L/T**, ή **τοιχείο υπό γωνία** → η `closestFacingEdgeBetweenPolygons` επιστρέφει facing-ακμή που δίνει **υπόλοιπη κλίση** στον `u` (ή λάθος edge), οπότε: (α) πάνω σε μακρύ span η μία άκρη «πιάνει» και η άλλη ξεφεύγει, ΚΑΙ/Ή (β) το lateral `lo = max(pnA.alongMin, pnB.alongMin)` βγαίνει ασύμμετρο επειδή το `n` δεν είναι ακριβώς κατακόρυφο.

## 4. Επόμενο βήμα — πώς να το πιάσεις (Plan)

1. **SSOT audit (grep)** — μην ξαναγράψεις geometry· τα helpers υπάρχουν (§5).
2. **Runtime diagnostic (ΠΡΩΤΑ):** πρόσθεσε προσωρινό `logger.debug`/`console.log` στην `computeBeamAxisBetweenMembers` (`bim/beams/beam-between-members.ts`) που τυπώνει: `footprintA`, `footprintB`, ο `facing.edge`, ο τελικός `u` (ux,uy), το `justification`, και `axis.a/axis.b`. Ζήτα από τον Giorgio να αναπαράγει (2 κλικ στις 2 κολόνες) και να κάνει paste το output. **Αυτό δίνει τα ΠΡΑΓΜΑΤΙΚΑ footprints** → φτιάξε jest που τα αναπαράγει → δες αν ο `u` είναι λοξός ή αν λάθος facing-ακμή επιλέγεται.
3. **Πιθανές αιτίες να ελέγξεις:**
   - `closestFacingEdgeBetweenPolygons`: για Γ/L footprint το centroid πέφτει σε εσοχή → το centroid-probing ίσως πιάνει λάθος σκέλος. Το scoring `scoreA>=scoreB` (face-perpendicular) ίσως χρειάζεται refinement για non-convex.
   - Αν ο `u` βγαίνει σωστά οριζόντιος αλλά το lateral είναι ασύμμετρο → το `lo/hi` overlap με μη-ορθογώνια footprints.
4. **Big-player εναλλακτική (αξιολόγησέ την — ίσως η ΣΩΣΤΗ FULL-SSoT λύση):** αντί για το παράλληλο `computeBeamAxisBetweenMembers`, **reuse** τη μάχιμη span-between-members μηχανή `resolveBeamSpanSnap` / `pairFrame` (`bim/framing/beam-span-snap.ts`, ADR-528/529) που ήδη χειρίζεται facing faces + justification + faceAligned + **είναι consistent με το reframe/framing**. Η δική μας υλοποίηση είναι διπλότυπο concern. Αν το reuse λύνει και το λοξό ΚΑΙ το αριστερό-άκρο, είναι το enterprise-σωστό (ρώτα τον Giorgio για plan approval πριν το μεγάλο refactor).

## 5. Πού ζει ο κώδικας (ΔΙΚΑ ΜΑΣ + reuse)

### Πυρήνας (εδώ γίνεται η διόρθωση)
- `src/subapps/dxf-viewer/bim/beams/beam-between-members.ts` — `computeBeamAxisBetweenMembers` (u=face-normal + `resolveFlushJustification` + επιστρέφει `justification`), `buildBeamBetweenMembers` (unjustify + store location line + justification), `pickStructuralMemberAt`, `getStructuralMemberFootprint2D`, `connectorBetweenMembers/FromMemberToPoint`.
- `src/subapps/dxf-viewer/bim/geometry/shared/polygon-nearest.ts` — SSoT: `closestFacingEdgeBetweenPolygons` (**NEW**, centroid-probing+refinement, ΕΔΩ ίσως το non-convex bug), `closestEdgeOnPolygonOutline` (**NEW**), `closestPointOnPolygonOutline`, `shortestSegmentBetweenPolygons`.

### Reuse (ΜΗΝ ξαναγράψεις)
- `bim/grid/axis-justify.ts` — `justifyAxisPoints`/`unjustifyAxisPoints` (Location-Line SSoT, ADR-441/529).
- `bim/grid/axis-normal.ts` — `canonicalAxisNormal` (orientation-invariant CCW normal).
- `bim/geometry/beam-geometry.ts` — `computeBeamGeometry` → `justifyAxisPoints` (body από location+justification).
- `hooks/drawing/beam-completion.ts` — `completeBeamFromTwoClicks`/`buildDefaultBeamParams` (δέχεται `justification` override, ADR-529).
- `bim/framing/beam-span-snap.ts` — `resolveBeamSpanSnap`/`pairFrame` (ADR-528/529 — η big-player εναλλακτική του §4.4).
- `hooks/drawing/use-beam-commit.ts:207` — `appendCenterlineBeam` (το reference pattern για unjustify+store).

### Preview
- `hooks/tools/useBeamBetweenMembersPreview.ts` — καλεί το ΙΔΙΟ `computeBeamAxisBetweenMembers` (δείχνει body axis· preview ≡ commit). Αν αλλάξει ο άξονας διορθώνεται αυτόματα.

### Tests
- `bim/beams/__tests__/beam-between-members.test.ts` (offset→όχι λοξό, associative→νότια παρειά μένει, no-connector).
- `bim/geometry/shared/__tests__/polygon-nearest.test.ts` (facing edge, offset→vertical).

### Docs / pending
- `docs/centralized-systems/reference/adrs/ADR-569-beam-between-members.md` (changelog ενημερωμένο για Fix A + B).
- `.claude-rules/pending-ratchet-work.md` — item: migration `closestPointOnOutline` του beam-span-snap → SSoT `closestEdgeOnPolygonOutline` (N.0.2).

## 6. Κανόνες / περιορισμοί
- **ΟΧΙ commit/push** (Giorgio). Working tree ΜΟΙΡΑΖΕΤΑΙ — μόνο δικά σου αρχεία, `git add` specific, ξαναδιάβασμα πριν edit.
- **ΟΧΙ tsc** (N.17). **jest OK** (γρήγορα, στοχευμένα).
- **FULL SSoT audit (grep) ΠΡΙΝ κώδικα** — reuse axis-justify/axis-normal/beam-span-snap· μηδέν διπλότυπα.
- Απάντηση στον Giorgio **ΠΑΝΤΑ στα Ελληνικά**.
- **Staging (όταν commitάρει ο Giorgio):** κώδικας + ADR-569 μαζί. (ΔΕΝ αγγίξαμε CanvasSection/ADR-040 σε αυτές τις διορθώσεις.)

## 7. Επαλήθευση όταν διορθωθεί
Reload `http://localhost:3000/dxf/viewer` → εντολή «Δοκάρι ανάμεσα σε μέλη» → 2 κλικ στις 2 ευθυγραμμισμένες κολόνες → **ΚΑΙ οι δύο** άκρες flush στη νότια παρειά, ΑΜΕΣΩΣ. Δοκίμασε ΚΑΙ με Γ/L/στραμμένες κολόνες + τοιχεία.
