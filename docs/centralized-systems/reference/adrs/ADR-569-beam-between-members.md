# ADR-569 — Δοκάρι ανάμεσα σε μέλη (Beam between two structural members)

- **Status:** Accepted (implemented, UNCOMMITTED 2026-07-03)
- **Domain:** DXF Viewer subapp — BIM structural drawing tools
- **Related:** ADR-363 (BIM drawing mode / beam tool), ADR-528/529 (beam auto-span facing faces), ADR-567 (structural no-overlap placement), ADR-040 (preview-canvas micro-leaf perf)

## Context

Ο Giorgio ζήτησε (2026-07-03) μια νέα εντολή που δημιουργεί δοκάρια **επιλέγοντας μέλη** (κολόνες/τοιχία), όχι ελεύθερα σημεία:

- Ενεργοποιείς την εντολή και κάνεις **σειριακά κλικ** σε κολόνες ή τοιχία. Το πρώτο κλικ ορίζει το πρώτο μέλος· στο **δεύτερο κλικ δημιουργείται ΑΜΕΣΩΣ** δοκάρι ανάμεσα στα δύο μέλη. Το δεύτερο μέλος γίνεται η **αρχή του επόμενου** δοκαριού → συνεχής **αλυσίδα** (κλικ-3 → δοκάρι 2→3, κλικ-4 → δοκάρι 3→4, κ.ο.κ.).
- **Αντίστροφη ροή:** αν υπάρχουν ήδη **δύο (ή περισσότερα) επιλεγμένα μέλη** (φαίνονται οι λαβές) και πατήσεις την εντολή, δημιουργείται **αμέσως** δοκάρι ανάμεσά τους (ανά διαδοχικό ζεύγος), και η εντολή μένει armed για συνέχεια της αλυσίδας.

## Decision

### Γεωμετρία — «πιο σύντομη διαδρομή = παρειές» (Giorgio)

Το δοκάρι δημιουργείται με άξονα την **πιο σύντομη διαδρομή** ανάμεσα στα δύο σχήματα κάτοψης (footprints) των μελών: τα **δύο πλησιέστερα σημεία των περιγραμμάτων** τους — δηλαδή τις αντικριστές **παρειές** (Giorgio: «το πιο κοντινό είναι οι παρειές»). Για δύο κολόνες αυτό ταυτίζεται με κατεύθυνση κέντρο→κέντρο με άκρα στις παρειές· για κολόνα↔μακρύ τοίχο δίνει το πλησιέστερο σημείο του τοίχου (όχι το μέσον του).

Νέο canonical SSoT: `bim/geometry/shared/polygon-nearest.ts`
- `closestPointOnPolygonOutline(outline, target)` — πλησιέστερο σημείο κλειστού περιγράμματος (χτισμένο στο ΚΟΙΝΟ `getNearestPointOnLine`).
- `shortestSegmentBetweenPolygons(polyA, polyB)` — ζεύγος πλησιέστερων σημείων δύο πολυγώνων· `null` σε εφαπτόμενα/επικαλυπτόμενα (κανένα καθαρό κενό). Το idiom υπήρχε μόνο ως **private** αντίγραφο στο `beam-span-snap.ts` (`closestPointOnOutline`)· εδώ γίνεται exported SSoT (πιθανή μελλοντική υιοθέτηση από το `beam-span-snap`, Boy-Scout N.0.2).

### FULL SSoT reuse — μηδέν διπλότυπα

- **Pick τοίχου:** `pickWallEntityAt` (ίδιο SSoT με «Δοκάρι από τοίχο», ADR-363).
- **Pick κολόνας:** `isPointInPolygon` (ίδιο SSoT με το column hit-test).
- **Footprint μέλους:** `resolveMemberFootprintVertices` (κολόνα) + `closedRingFromEdges` (τοίχος).
- **Κατασκευή entity:** `completeBeamFromTwoClicks` → `buildBeamEntity` (ίδιο builder/validator/geometry/finish με το freehand δοκάρι).
- **Commit:** `appendEntityToScene(levelManager, beam, 'beam')` — **ΙΔΙΟ** path με το freehand δοκάρι: undo (`CreateBimEntityCommand` + `CommandHistory`), Firestore autosave (`useBeamPersistence` ακούει `drawing:entity-created` tool='beam'), ADR-567 structural-overlap guard.
- **Live ghost:** shared `useCanvasGhostPreview` harness (ADR-398 §4) + store-driven mount (ADR-040 inert), mirror του wall-split knife preview (ADR-363 §5.6). Preview ≡ commit (ίδια `shortestSegmentBetweenPolygons`).

### Νέα αρχεία

| Αρχείο | Ρόλος |
|--------|-------|
| `bim/geometry/shared/polygon-nearest.ts` | SSoT nearest-point / nearest-segment μεταξύ πολυγώνων (παρειά→παρειά) |
| `bim/beams/beam-between-members.ts` | pure: pick μέλους + footprint + connector + `buildBeamBetweenMembers` |
| `systems/beam-between-members/BeamBetweenMembersStore.ts` | anchor store (zero React, ADR-040) για το live ghost |
| `hooks/tools/useBeamBetweenMembersPreview.ts` | ghost draw delegate (harness) |
| `hooks/drawing/useBeamBetweenMembersTool.ts` | React FSM: αλυσίδα + αντίστροφη ροή |

### Wiring (edits)

Tool id `'beam-between-members'` (`ui/toolbar/types.ts`, `systems/tools/tool-definitions.ts` category `drawing`) · click routing (`canvas-click-tool-types.ts`, `canvas-click-types.ts`, `canvas-click-bim-dispatch.ts` RAW worldPoint) · lifecycle + instantiate (`hooks/tools/useSpecialTools.ts`) · pass-through (`useCanvasClickHandler.ts`, `CanvasSection.tsx`) · preview mount (`canvas-layer-stack-tool-preview-mounts.tsx` + `canvas-layer-stack-preview-mounts.tsx`) · ribbon button «Δομικά» (`ui/ribbon/data/structural-tab.ts`) · i18n (`el/en dxf-viewer-shell.json`).

## Consequences

- Το δοκάρι γεννιέται με **default beam params** (πλάτος/ύψος/στάθμη defaults). Μελλοντικά: σύνδεση με τα ribbon overrides του beam contextual tab (fast-follow).
- Αν δύο μέλη εφάπτονται/επικαλύπτονται → κανένα καθαρό κενό → δεν δημιουργείται δοκάρι για το ζεύγος (skip).
- ADR-040: το ghost ρέει από store-driven leaf (orchestrator inert)· το CanvasSection αγγίζεται μόνο για click routing pass-through.

## Changelog

- **2026-07-06 (unique ribbon glyph — triage)** — Το κουμπί «Δοκάρι ανάμεσα σε μέλη» μοιραζόταν το icon token `struct-beam-single` με το plain «Δοκάρι» → το ADR-443 unique-glyph regression test έσπαγε (29/30). Δόθηκε **distinct composed glyph** μέσω του υπάρχοντος SSoT (νέο `between-members` method fragment στο `STRUCTURAL_METHOD_FRAGMENTS`, token `struct-beam-between`). Λεπτομέρειες: ADR-443 changelog 2026-07-06. `structural-tab.test.ts` GREEN.
- **2026-07-03** — Αρχική υλοποίηση (UNCOMMITTED). Αλυσίδα + αντίστροφη ροή + live ghost. Νέο SSoT `polygon-nearest`. Jest: `polygon-nearest.test.ts`, `beam-between-members.test.ts`.
- **2026-07-03 (lateral placement — Giorgio)** — Το δοκάρι κρεμόταν νότια: ο connector έπαιρνε το «πιο κοντινό ζεύγος» (γωνία=νότια ακμή) → ο άξονας έπεφτε στη νότια παρειά. **Fix (decoupled 2 άξονες):** νέο pure `computeBeamAxisBetweenMembers` (reuse `polygon2DCentroid` + `projectPolygonOnAxis`, ίδιο SSoT με ADR-528). **Διαμήκης** = παρειά-προς-παρειά (`alongMax_A`→`alongMin_B`). **Πλευρικός flush κατά φορά** (Giorgio): 2ο κλικ δεξιά (`dx≥0`)→νότια-flush στο `lo` της κοινής επικάλυψης· αριστερά→βόρεια-flush στο `hi`. Επειδή `lo`/`hi` = άκρες επικάλυψης, το flush πέφτει αυτόματα στην **παρειά της στενότερης** οντότητας → πατάει και στα δύο, μηδέν κρέμασμα. `{u,n}` ορθοκανονική βάση, `P=O+s·u+t·n`. preview≡commit (ίδιο `computeBeamAxisBetweenMembers`). 6 νέα jest (19 σύνολο). Επιβεβαιωμένο από 2 στιγμιότυπα Giorgio.
- **2026-07-03 (λοξά δοκάρια — Giorgio)** — Τα δοκάρια έβγαιναν **λοξά/κεκλιμένα** όταν οι κολόνες δεν ήταν τέλεια ευθυγραμμισμένες. **Ρίζα:** στο `computeBeamAxisBetweenMembers` ο διαμήκης άξονας `u` οριζόταν **κέντρο→κέντρο** (`polygon2DCentroid A → B`)· όταν τα κέντρα διέφεραν σε Y (διαφορετικό βάθος ή μικρο-offset εισηγμένων DXF θέσεων), ο `u` έγερνε → όλος ο άξονας λοξός. **Απόφαση (Giorgio):** «ακολουθεί ΠΑΝΤΑ τις παρειές του πιο κοντινού σκέλους» → η διεύθυνση = **κάθετος της facing-ακμής** (face-normal), ώστε το δοκάρι να μένει **ορθογώνιο στην παρειά** (ποτέ λοξό) και flush στο κοντινότερο μέλος. **FULL SSoT (additive, μηδέν διπλότυπα):** νέα `closestFacingEdgeBetweenPolygons` + `closestEdgeOnPolygonOutline` στο `polygon-nearest.ts` (centroid-probing + 2-step refinement — ίδιο δοκιμασμένο πρότυπο με το `pairFrame` του `beam-span-snap`· vertex-probing κατέληγε σε γωνία → λάθος κάθετη ακμή). Το `computeBeamAxisBetweenMembers` άλλαξε **ΜΟΝΟ** τον ορισμό του `u` (span face-to-face + lateral flush αμετάβλητα). `closestPointOnPolygonOutline` έγινε delegate στο edge-core (ΕΝΑ edge-walk). Regression jest: offset μέλη (κέντρα σε διαφορετικό Y) → `axis.a.y ≈ axis.b.y` (ορθογώνιο). Εφαπτόμενα μέλη → `no-connector` (ενοποίηση με τον οπτικό connector, ήταν degenerate `build-failed`). 6 νέα jest (26 στο ζεύγος suites)· 1321/1321 σε beams+framing+geometry. **Pending (N.0.2):** migration του private `closestPointOnOutline` του `beam-span-snap` → SSoT `closestEdgeOnPolygonOutline` (committed ADR-528/529, shared tree → dedicated pass).
- **2026-07-03 (associative flush — Giorgio)** — Το δοκάρι έμπαινε σωστά νότια-flush, αλλά μετά τον **αυτόματο επαναϋπολογισμό διατομών/οπλισμού** του οργανισμού (που μειώνει το πλάτος) «ξεκόλλαγε» από τη νότια παρειά. **Ρίζα:** το `buildBeamBetweenMembers` αποθήκευε τον flush **centerline** (σταθερός άξονας) → με μικρότερο πλάτος το κέντρο έμενε, η νότια παρειά μετακινούνταν βόρεια. **Fix (Revit Location-Line, ADR-529 SSoT):** το `computeBeamAxisBetweenMembers` επιστρέφει πλέον ΚΑΙ το `justification` (νέος `resolveFlushJustification` — map νότια/βόρεια/κέντρο → 'left'/'right'/'center' μέσω του PUBLIC `canonicalAxisNormal`). Το `buildBeamBetweenMembers` αποθηκεύει **location line (= flush παρειά) μέσω `unjustifyAxisPoints`** + `justification` (ΟΧΙ centerline) — **ίδιο SSoT pattern με το auto-span `appendCenterlineBeam`**. Το `computeBeamGeometry` re-derives το body με offset → η νότια παρειά ΜΕΝΕΙ αγκυρωμένη σε ΟΠΟΙΟ πλάτος (associative, χωρίς listener). Preview αμετάβλητο (δείχνει body axis). Regression jest: `justification==='left'` + stored location line στη νότια παρειά (y=0) + `justifyAxisPoints` για width 200 ΚΑΙ 100 → νότια παρειά ΑΚΟΜΗ y=0. 1369/1369 σε beams+framing+grid+geometry.
- **2026-07-03 (hover/selection fix)** — Το ghost ενεργοποιούνταν μόνο μετά το 1ο pick → κανένας φωτισμός με hover στην αρχή. Fix: **native hover** μέσω `entityPickingActive += 'beam-between-members'` (CanvasSection) → το μέλος κάτω από τον κέρσορα φωτίζεται σε όλη τη διάρκεια (ίδιο SSoT με «Δοκάρι από τοίχο»/HoverStore). Το δικό μου overlay κρατά πλέον **μόνο** persistent «επιλεγμένο» highlight (γέμισμα+περίγραμμα) του **anchor**: με τη δημιουργία δοκαριού το anchor προωθείται στο 2ο μέλος → σβήνει το 1ο, μένει φωτισμένο μόνο το 2ο (περιμένοντας το επόμενο κλικ). Αφαιρέθηκε το διπλό overlay-hover outline.
- **2026-07-03 (§Τ-mirror — δοκάρι μέσα στα σκέλη, Giorgio)** — Σε **δύο Τ-κολόνες καθρέφτη** (spine + οριζόντιος βραχίονας, βραχίονες αντικριστοί & ευθυγραμμισμένοι σε κοινή ζώνη y) το δοκάρι έπεφτε στον **νότιο πάτο του spine** αντί να φωλιάσει **μέσα στα ευθυγραμμισμένα σκέλη** (ΛΑΘΟΣ-ΤΩΡΑ vs ΣΩΣΤΟ-ΘΕΛΩ, στιγμιότυπο 223324). **Ρίζα:** το `computeBeamAxisBetweenMembers` υπολόγιζε την πλευρική επικάλυψη `[lo,hi]` προβάλλοντας **ΟΛΟΚΛΗΡΟ** το footprint κάθε μέλους (`projectPolygonOnAxis(footprintA/B)`) → για Τ/Γ μέλη περιλάμβανε το ψηλό spine → `lo` = νότιος πάτος spine → νότια-flush εκεί. **Fix (context-free, μηδέν «ανίχνευση Τ»):** η πλευρική επικάλυψη υπολογίζεται πλέον από την **facing-παρειά** (το cross-section στη θέση σύνδεσης), όχι από το footprint — reuse `projectPolygonOnAxis` στα `facing.segA`/`segB` (η ακμή ως 2-point «πολύγωνο»). Το `closestFacingEdgeBetweenPolygons` εκθέτει πλέον ΚΑΙ τις δύο facing-παρειές (`segA`, `segB` — additive, μη-breaking). Έτσι για **Τ/Γ** μέλη η επικάλυψη = ΜΟΝΟ το αντικριστό **σκέλος** (βραχίονας) → το δοκάρι φωλιάζει στη ζώνη των σκελών· για **ορθογώνια** η facing-παρειά = όλο το ύψος → **ίδιο νότιο-flush όπως πριν** (μηδέν regression). Span αμετάβλητο (παρειά-προς-παρειά). Regression jest: Τ-καθρέφτης (πραγματικά footprints Giorgio) → centerline στη ζώνη σκελών (575), ΟΧΙ στον πάτο spine (~125)· τα 27 προϋπάρχοντα (ορθογώνια/Γ) πράσινα → **29/29** στο ζεύγος suites.
- **2026-07-03 (§Τ-mirror center-axis — Giorgio)** — Επέκταση: για **ομοαξονικά Τ** ο άξονας του δοκαριού πρέπει να ευθυγραμμίζεται με τον **κοινό άξονα των βραχιόνων** (κέντρο), όχι νότια-flush. **Fix:** ανίχνευση «προεξέχων βραχίονας» (facing-band στενότερη από το πλήρες footprint) και για ΤΑ ΔΥΟ μέλη + **ομοαξονικότητα** (`|centerA−centerB| ≤ 0.25·bandDepth`) → `flush='center'` (`t=(lo+hi)/2`) → `justification='center'`. Έτσι ο άξονας μένει **κεντραρισμένος στον κοινό άξονα** ακόμη κι όταν ο οργανισμός αλλάζει το πλάτος (associative), αντί να ξεκολλήσει νότια. Ορθογώνια/Γ (facing = όλη η παρειά → όχι «βραχίονας») → **νότια/βόρειο-flush αμετάβλητο** (μηδέν regression). Reuse `projectPolygonOnAxis` (full extent) για την ανίχνευση. Jest: ομοαξονικοί βραχίονες → `justification==='center'` + άξονας στο 575 για ΔΥΟ διαφορετικά πλάτη (associative) → **30/30**.
