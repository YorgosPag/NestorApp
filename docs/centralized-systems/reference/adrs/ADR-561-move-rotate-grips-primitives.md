# ADR-561 — Σταυρός Μετακίνησης + Σημάδι Περιστροφής σε Primitives (polyline / circle / arc / rectangle)

- **Status**: ✅ IMPLEMENTED (UNCOMMITTED) — 2026-07-01 · 🔴 εκκρεμεί browser-verify
- **Category**: DXF Viewer — Canvas & Rendering / Grips
- **Related**: ADR-397 (BIM grip glyph behavior SSoT — MOVE 4-arrow / ROTATION curved),
  ADR-363 Slice F/G.5 (plain DXF line rotation + ¼-west MOVE cross),
  ADR-557 (Text/MText rect-box grip parity), ADR-519 (κυκλική κολόνα — μόνο move, όχι rotation),
  ADR-188 (RotateEntityCommand), ADR-559 (quadrant grips visible ≡ pickable),
  ADR-357 Φ12 / ADR-560 (grip copy SSoT — `RotateEntityCommand.copyMode` / `CtrlKeyTracker`),
  ADR-049 (inverted-ghost dim· copy → αρχική solid)

## Context

Όταν επιλέγεται **τοίχος** στο 2D DXF viewer, εμφανίζονται πλήρεις λαβές: 4 κορυφών +
4 μέσων πλευρών + **σταυρός μετακίνησης** (4 αυτόνομα βελάκια — κάθε βελάκι ανοίγει
πεδίο τιμής για directional move-by-value) + **σημάδι περιστροφής** (τόξο).

Οι βασικές οντότητες σχεδίασης **πολύγραμμη / κύκλος / τόξο / ορθογώνιο** είχαν ΜΟΝΟ
vertex / edge / quadrant grips — κανένα σημάδι μετακίνησης ή περιστροφής. Ζητούμενο
(Giorgio 2026-07-01): να αποκτήσουν σταυρό μετακίνησης + σημάδι περιστροφής όπως ο τοίχος.

Το μοτίβο ήταν ήδη λυμένο & κεντρικοποιημένο για DXF primitives: το **line** (ADR-363
Slice F/G) και το **text** (ADR-557) έχουν σταυρό + περιστροφή μέσω κοινών SSoT. Το
ADR-561 επεκτείνει το ΙΔΙΟ μοτίβο — μηδέν νέος μηχανισμός.

## Αρχιτεκτονική grips (pipeline + SSoT — ό,τι βρέθηκε στην έρευνα)

| Ρόλος | Αρχείο |
|-------|--------|
| Παραγωγή grips (interaction) | `hooks/grip-computation.ts` → `computeDxfEntityGrips()` (`switch(type)`) |
| Παραγωγή grips (render) | κάθε `*Renderer.getGrips()` — hand-emit ΞΕΧΩΡΙΣΤΑ (⚠️ διπλότυπο) |
| Glyph shape SSoT | `bim/grips/grip-glyph-registry.ts` → `GRIP_GLYPH_REGISTRY` / `gripGlyphShape` |
| Hot-grip op SSoT | `hooks/grips/wall-hot-grip-fsm.ts` → `HOT_GRIP_OP_REGISTRY` / `hotGripKindOf` |
| MOVE-glyph orientation | `bim/grips/move-glyph-frame.ts` → `resolveMoveGlyphFrame` (frame → directional move) |
| 4 αυτόνομα βελάκια | `GripShapeRenderer.renderMoveGlyph` + `move-glyph-zones.ts` + `grip-mouse-handlers.runDirectionalMove` (click → `getPromptDialogStore().prompt()`) |
| Commit dispatch | `hooks/grips/grip-commit-adapters.ts` → `commitDxfGripDragModeAware` (`if (grip.xKind) commitX(...)`) |

**Templates**: `systems/line/line-grips.ts::getLineGrips` (axis primitive, rotation μέσω
`RotateEntityCommand`) + `bim/text/text-grips.ts::getTextGrips` (rect-box, `rotationHandleMidwayOffset`).

**Κρίσιμο εύρημα**: το `rectangle`/`rect` scene entity **μετατρέπεται σε closed `polyline`**
(4 vertices) στο DXF pipeline (`dxf-scene-entity-converter` → `rectangleToVertices`), οπότε
η polyline διαδρομή κατέχει ΟΛΑ τα ορθογώνια. Το `rotation` field του rectangle **αγνοείται**
από converter / selection / render (παράγουν πάντα axis-aligned vertices από corner1/corner2).

## Απόφαση

Επέκταση του κοινού grip μοτίβου σε circle / arc / polyline μέσω νέων pure SSoT modules
που καταναλώνονται ΚΑΙ από το interaction path (`computeDxfEntityGrips`) ΚΑΙ από το render
path (`*Renderer.getGrips`) — έτσι interaction ≡ render (ενοποιεί και το προϋπάρχον διπλότυπο).

### Αποφάσεις Giorgio (AskUserQuestion)

1. **Κύκλος** → ΜΟΝΟ σταυρός μετακίνησης, **ΟΧΙ** περιστροφή (γεωμετρικά συμμετρικός·
   parity με κυκλική κολόνα ADR-519).
2. **Ορθογώνιο** → **rect-box parity** (σαν κολόνα/κείμενο): το σημάδι περιστροφής κάθεται
   σε σταθερή πλευρά και **γέρνει μαζί με το σχήμα**.

### Το 5-θέσεων template (ανά νέο kind)

1. `grip-kinds.ts` → νέο union (`CircleGripKind` / `ArcGripKind` / +`PolylineGripKind`).
2. `grip-glyph-registry.ts` → `'x-move' → 'move'`, `'x-rotation' → 'rotation'`.
3. `wall-hot-grip-fsm.ts` → `HOT_GRIP_OP_REGISTRY` + `hotGripKindOf` (νέοι discriminators).
4. νέο `*-grips.ts` SSoT → grip generator· `computeDxfEntityGrips` + `*Renderer.getGrips` το καλούν.
5. commit branch στο `commitDxfGripDragModeAware` (μόνο rotation· move πέφτει στο translate path).

### Ανά οντότητα

- **Circle** (`systems/circle/circle-grips.ts`) — centre `'circle-move'` (4-arrow glyph +
  directional prompt + whole-entity translate) + 4 quadrants. Καμία περιστροφή. Move = υπάρχον
  translate path (κανένα νέο commit).
- **Arc** (`systems/arc/arc-grips.ts`) — centre `'arc-move'` + start/end/mid (ως τώρα) +
  `'arc-rotation'` handle midway (`rotationHandleMidwayOffset(2·radius)` = −radius/2 κάτω από κέντρο).
  Rotation commit → `commitArcGripDrag` → `RotateEntityCommand` (pivot = κέντρο).
- **Polyline** (`systems/polyline/polyline-grips.ts::getPolylineMoveRotateGrips`) — προσθέτει
  `'polyline-move'` + `'polyline-rotation'` στα υπάρχοντα vertex/edge grips. Placement:
  **rectangle** (μέσω `rectangle-detect.ts::asOrientedRect`) → oriented rect-box (handle γέρνει με
  το σχήμα)· **γενική polyline** → στο **μεγαλύτερο segment** (`rectangle-detect.ts::longestPolylineSegment`),
  στα ¼ σημεία του, μέσω του **ίδιου** `axisQuarter{Rotation,Move}HandleWorld` SSoT με τη γραμμή
  (πάντα ΠΑΝΩ σε ακμή· βλ. changelog 2026-07-05). Rotation commit → `commitPolylineRotationGripDrag`.
- **Rectangle** — καλύπτεται από την polyline διαδρομή (converter → polyline). Στο rotation, ένα
  scene `rectangle` **εκρήγνυται σε polyline** με τα rotated vertices (μέσω `UpdateEntityCommand`),
  γιατί το rectangle scene shape δεν έχει λειτουργικό rotation (βλ. Context). Semantically exact
  (περιστραμμένο ορθογώνιο = κλειστή 4-vertex polyline)· μετά η περιστροφή είναι καθαρή polyline.

### `resolveMoveGlyphFrame` επέκταση

Circle / arc / polyline / rectangle → επιστρέφουν **WORLD-aligned identity frame** (αντί για
`null`), ώστε το per-arm directional move-by-value (τα 4 αυτόνομα βελάκια με πεδίο τιμής) να
ενεργοποιείται· βελάκια δείχνουν world E/N/W/S. Χωρίς frame, ο σταυρός σχεδιαζόταν αλλά τα
βελάκια έμεναν αδρανή (το ακριβές bug που είχε το line πριν το Slice G.5).

## Consequences

- **(+)** Πλήρης parity με τοίχο/line/text· ένα κοινό glyph + hot-grip + commit pipeline.
- **(+)** Ενοποίηση προϋπάρχοντος διπλότυπου: circle/arc/polyline grips τώρα SSoT (interaction ≡ render).
- **(+)** Το rectangle rotation γίνεται επιτέλους σωστό (explode-to-polyline), χωρίς να αγγιχτεί
  το εύθραυστο converter/selection/render rectangle path.
- **(−)** Το rectangle μετατρέπεται μόνιμα σε polyline στην πρώτη περιστροφή (undoable· αναμενόμενο).
- **Δοκιμές**: 27 νέα jest (circle/arc/polyline/rectangle-detect grips + dispatch) + move-glyph-frame
  ενημερωμένο· ΟΧΙ tsc (κανόνας N.17). ⚠️ 1 pre-existing failure (`grip-commit-alt-bypass`, άσχετο).

## Αρχεία

**Νέα**: `systems/circle/circle-grips.ts`, `systems/arc/arc-grips.ts`,
`systems/polyline/polyline-grips.ts`, `systems/polyline/rectangle-detect.ts`,
`hooks/grips/grip-primitive-rotate-commits.ts` (+ 5 colocated `__tests__`).
**Τροποποιημένα**: `hooks/grip-kinds.ts`, `hooks/grip-types.ts`, `hooks/useGripMovement.ts`,
`hooks/grips/unified-grip-types.ts`, `hooks/grips/grip-registry.ts`,
`hooks/grips/wall-hot-grip-fsm.ts`, `hooks/grips/grip-commit-adapters.ts`,
`hooks/grips/grip-parametric-commits.ts`, `hooks/grip-computation.ts`,
`bim/grips/grip-glyph-registry.ts`, `bim/grips/move-glyph-frame.ts` (+test),
`rendering/entities/{Circle,Arc,Polyline}Renderer.ts`.

## Changelog

- **2026-07-05** — 🐛 **Ενωμένες γραμμές (`lwpolyline`) → εμφάνιση φαντάσματος σε ΟΛΑ τα grip gestures (reshape/edge/move/rotation)** (Giorgio:
  «όταν μετακινώ/περιστρέφω σκέλος ή ολόκληρο το σύστημα των ενωμένων γραμμών, δεν εμφανίζεται το φάντασμα»).
  **Root cause**: το JOIN σε γωνία δίνει scene `type:'lwpolyline'` (το `JoinEntityCommand` το κρατά ως έχει), αλλά
  ΟΛΟ το ghost/preview pipeline είναι keyed σε `'polyline'`: (α) `useGripGhostPreview.getEntity` επιστρέφει το **raw
  scene entity** (`'lwpolyline'`), (β) το `applyEntityPreview` + `applyClassicEntityPreview` έχουν μόνο `'polyline'`
  branches → `transformed === entity` → **κανένα φάντασμα**, (γ) το `buildEntityModelFromDxf` (ghost renderer) δεν
  έχει `case 'lwpolyline'`. Το κύριο canvas δούλευε γιατί περνά τον converter (`lwpolyline→polyline`, ADR-186)· το
  ghost διάβαζε raw. **Fix (ΟΧΙ αλλαγή merge/JoinEntityCommand)**: νέος SSoT helper `normalizePreviewEntity(entity)`
  (`rendering/ghost/apply-entity-preview.ts`) που κάνει normalize το discriminator `lwpolyline→polyline` (shallow clone,
  ίδιο shape) — **ίδιος κανόνας ADR-186 με τον committed converter**. Καλείται μία φορά στο preview boundary
  (`useGripGhostPreview`, μετά το `getEntity`) → ΟΛΟ το downstream (transform + ghost render + τα ίχνη/βέλη γωνίας του
  προηγούμενου changelog) βλέπει `'polyline'` και πυροδοτείται σωστά. Ένα σημείο, reusable από body-drag/Move-tool όταν
  χρειαστεί. **Αρχεία**: `rendering/ghost/apply-entity-preview.ts` (+test), `rendering/ghost/index.ts`,
  `hooks/tools/useGripGhostPreview.ts`.
- **2026-07-05** — ✨ **Polyline vertex reshape → πλήρη ίχνη ευθυγράμμισης + βέλη γωνίας + κυανές ενδείξεις (parity με τη γραμμή)** (Giorgio:
  «όταν μετακινώ ένα άκρο ενωμένης γραμμής θέλω να εμφανίζονται τα λευκά+κίτρινα+Polar ίχνη, τα πράσινα/κόκκινα βέλη
  γωνίας, ΚΑΙ οι κυανές ενδείξεις — όλα κεντρικοποιημένα»). **Root cause**: το reshape preview δούλευε ήδη, αλλά το
  `useGripGhostPreview` έδινε `alignAnchors` + direction arc **μόνο** για `isLineEntity` → polyline vertex drag =
  κανένα ίχνος/βέλος/κυανό. **Fix (καθαρά additive wiring· ΚΑΝΕΝΑΣ νέος μηχανισμός)**: **(A)** νέος pure SSoT
  `getPolylineGripAlignmentAnchors(gripIndex, vertices, closed)` (`polyline-grips.ts`) — mirror του
  `getLineGripAlignmentAnchors`: η συρόμενη κορυφή τραβάει από τις **σταθερές γειτονικές** κορυφές ⊕ ambient·
  τροφοδοτεί το **ίδιο** `resolveActionAlignmentTracking`/`paintActionAlignmentTracking` → λευκά/κίτρινα AutoAlign +
  Polar + κυανά ambient hints. **(B)** το **ίδιο** κεντρικό `paintDirectionArc` (🟢/🔴) για endpoint ανοιχτής polyline
  (grip 0 ή n−1 → μονοσήμαντο pivot = η μία γειτονική κορυφή, ίδιο με line endpoint· interior/corner κορυφή = μόνο ίχνη,
  όχι arc). **+ Boy-Scout κεντρικοποίηση (N.0.2)**: το «endpoint-reshape arc» tail (`refDir/curDir → rotateSweepDegFromDirs →
  paintDirectionArc`) ήταν διπλότυπο (line block + το νέο polyline block) → εξήχθη σε **έναν** module-level helper
  `paintEndpointReshapeArc(ctx, fixedW, origMovedW, movedW, t, vp)`· και τα δύο (line + polyline) τον καλούν (μηδέν drift).
  **Αρχεία**: `systems/polyline/polyline-grips.ts` (+test), `hooks/tools/useGripGhostPreview.ts`.
- **2026-07-05** — 🐛 **FREE-rotate reference axis γενικής polyline = άξονας του μεγαλύτερου segment (όχι οριζόντιος)** (Giorgio:
  «όταν ορίζω κέντρο περιστροφής σε ενωμένες γραμμές, η διακεκομμένη γραμμή αναφοράς να ταυτίζεται με τον
  άξονα της γραμμής, πάντοτε»). **Root cause**: `resolveRotateReferenceAnchor` (`bim/grips/rotate-reference-axis.ts`)
  για γενική (μη-ορθογώνια) polyline έπεφτε στο `resolveMoveGlyphFrame`, που δίνει **world-aligned IDENTITY frame**
  → major axis = οριζόντιος κόσμος → διακεκομμένη αναφορά **οριζόντια**. **Fix**: νέο `polylineReferenceAnchor`
  branch (πριν το identity fallback) — major axis = κατεύθυνση του **μεγαλύτερου segment** (`longestPolylineSegment`,
  ίδιο SSoT με τα grips), flipped προς το body (bbox center) με τον **ίδιο** `proj > ε ? +major : −major` κανόνα
  τοίχου/ορθογωνίου → η αναφορά coaxial με την κυρίαρχη γραμμή. Η **collinear** ένωση (`type:'line'`) ήδη σωστή
  (`resolveMoveGlyphFrame` → `fromAxis`). **+ Boy-Scout κεντρικοποίηση (N.0.2)**: το «orient toward body»
  μοτίβο (`dir=−major; if proj>ε dir=+major; return pivot+dir`) ήταν διπλότυπο **3×** στο ίδιο αρχείο
  (rectangle + generic + το νέο polyline) → εξήχθη σε **έναν** shared helper `anchorTowardBody(pivot, majorUnit, centre)`·
  και τα 3 families τον καλούν (μηδέν drift). **Αρχεία**: `bim/grips/rotate-reference-axis.ts` (+test).
- **2026-07-05** — 🐛 **JOIN σε γωνία → transform glyph ΠΑΝΩ στη γεωμετρία (όχι κενό bbox-center)** (Giorgio:
  «όταν ενώνω 2 γραμμές σε γωνία, ο σταυρός μετακίνησης + το βέλος περιστροφής κάθονται στον κενό χώρο
  αντί πάνω στη γραμμή»). **Root cause**: το JOIN σε γωνία δίνει `lwpolyline` → `getPolylineMoveRotateGrips`
  **GENERIC branch** έβαζε MOVE στο axis-aligned-**bbox center** — που για ανοιχτή «Γ»/«L» πέφτει σε κενό
  χώρο (δεν ακουμπά καμία ακμή) → floating handles. **Fix (grip-placement μόνο· ΟΧΙ merge logic)**: το
  GENERIC branch τοποθετεί πλέον **και τα δύο** handles στο **μεγαλύτερο segment** της polyline, στα ¼ σημεία
  του, κάνοντας **reuse** το **υπάρχον** `axisQuarter{Rotation,Move}HandleWorld` SSoT (`bim/grips/axis-box-grips.ts`)
  που ήδη χρησιμοποιεί η ίσια γραμμή (`systems/line/line-grips.ts`) → **μηδέν νέα placement formula**, πλήρες
  parity line↔polyline, πάντα ΠΑΝΩ σε σχεδιασμένη ακμή (Giorgio AskUserQuestion 2026-07-05: «στο μεγαλύτερο
  κομμάτι, ¼ & ¾»). Rotation = ¼-east / move = ¼-west του segment (compass tie-break → συμμετρικά γύρω από
  το κέντρο· για κάθετο leg → rotation κοντά στο ελεύθερο άκρο, move κοντά στη γωνία). Νέος pure helper
  `longestPolylineSegment` (`rectangle-detect.ts`). Degenerate ring → fallback στο bbox-center. Η **collinear**
  ένωση δίνει `type:'line'` → ήδη σωστό μέσω `getLineGrips` (verified). **Αρχεία**: `systems/polyline/polyline-grips.ts`,
  `systems/polyline/rectangle-detect.ts` (+test). Rectangle branch αμετάβλητο.
- **2026-07-05** — ✨ **Ctrl + drag ΑΚΡΟΥ/ΚΟΡΥΦΗΣ = ROTATE-COPY (μεντεσές) με όλα τα ίχνη** (Giorgio:
  «πατάω & κρατάω κλικ σε άκρο + Control → αντίγραφο που περιστρέφεται γύρω από το άκρο· στο release νέα
  γραμμή ενωμένη στο άκρο· η αρχική μένει· ΟΛΑ τα ίχνη περιστροφής να τρέχουν»· εύρος **γραμμή + τόξο +
  polyline**· ΕΝΑ αντίγραφο/release· αρχική **solid** + φάντασμα αντιγράφου· Ctrl-copy **και στη λαβή
  περιστροφής grip 3**). **SSoT audit**: ~95% υπήρχε ήδη → μηδέν νέος μηχανισμός. **(1) Copy commit**:
  `commitLineGripDrag` (grip-linear-commits.ts) + `commitArcGripDrag`/`commitPolylineRotationGripDrag`
  (grip-primitive-rotate-commits.ts) περνούν πλέον `copyMode = GripCopyModeStore.enabled ||
  CtrlKeyTracker` στο **υπάρχον** `RotateEntityCommand.copyMode` (ADR-357 Φ12· clone+id+undo/redo)· ίδιο
  copy-trigger με το move-copy → καλύπτει ΚΑΙ το grip-3 Ctrl-copy. Rect-copy = **νέα** closed polyline
  (`CreateEntityCommand`, inherit layer/style) αντί explode-in-place (το scene rect αγνοεί `rotation`).
  **(2) Trigger**: νέος pure SSoT `hooks/grips/ctrl-endpoint-rotate-copy.ts` `resolveCtrlEndpointRotateCopy`
  (αυστηρό gate: Ctrl + PLAIN vertex line/arc/polyline → pivot=άκρο + synthetic rotation-kind grip)·
  `runGripMouseDown` προ-γεμίζει το free-rotate (step `rotate-free`, `hotGripBase`=άκρο, baseline μείζονος
  άξονα, arm rotation-snap targets) — mirror του `advanceHotGripPick`. Χωρίς Ctrl → αμετάβλητο stretch.
  Preview + commit δρομολογούνται αυτόματα μέσω του synthetic kind (μηδέν νέος preview/commit κώδικας).
  **(3) Copy-ghost** (⚠️ ADR-040 hot files, CHECK 6B/6D): νέο `gripDragIsCopy` στα `DxfRenderOptions`
  (dxf-types.ts) → ο `dxf-canvas-renderer` ΔΕΝ dim-άρει την αρχική όταν copy (μένει solid, ADR-049
  inverted-ghost gate)· `CanvasLayerStack` το υπολογίζει με plain getSnapshot (CHECK 6C-safe).
  **🎯 SSoT κεντρικοποίηση (Boy-Scout N.0.2, κατά ρητή διαταγή Giorgio «μηδέν διπλότυπα»)**: (α) νέο
  `systems/grip/grip-copy-intent.ts` `isGripCopyIntent()` — ΕΝΑ predicate («Copy» toggle ‖ live Ctrl/⌘)·
  αντικατέστησε το ΙΔΙΟ inline expression σε **4 σημεία** (το προϋπάρχον move-copy `grip-commit-adapters:219`
  + τα 3 νέα rotate-copy: line/primitive commits + `CanvasLayerStack`). (β) νέο `seedRotateFreeStep`
  (`grip-hotgrip-actions.ts`) — ΕΝΑΣ free-rotate seed (major-axis baseline + snap targets), shared από τον
  κανονικό centre-pick (`advanceHotGripPick`) ΚΑΙ τη νέα Ctrl-endpoint χειρονομία (mouse-down)· εξάλειψε το
  5-γραμμο inline duplicate. **Tests**: `ctrl-endpoint-rotate-copy.test.ts` (gate/regression) +
  `RotateEntityCommand.copy.test.ts` (hinge geometry + undo) + `grip-copy-intent.test.ts` (predicate).
  jest ✅ 20/20 νέα + 25/25 regression. 🔴 εκκρεμεί browser-verify (γραμμή/τόξο/polyline rotate-copy: ghost
  αντιγράφου + όλα τα ίχνη + hinge στο άκρο + grip-3 Ctrl-copy).
- **2026-07-05** — ✨ **Άξονας αναφοράς περιστροφής ΟΡΘΟΓΩΝΙΟΥ = ΠΛΗΡΕΣ SSoT του ΤΟΙΧΟΥ, ΕΝΑΣ άξονας**
  (Giorgio: «μελέτησε πώς περιστρέφεται ο τοίχος και βάλε τον ΙΔΙΟ κώδικα στο τετράγωνο· θέλω ΕΝΑΝ άξονα,
  όχι δύο»). ⚠️ Αντικαθιστά μια προηγούμενη λάθος προσπάθεια (σταυρός 2 αξόνων + gating σε 8 λαβές —
  **καταργήθηκε πλήρως**: διαγράφηκε το `rect-rotation-reference.ts` + το wiring στον resolver έγινε
  revert). **Root cause**: ο τοίχος στη free-rotate ζωγραφίζει ΕΝΑΝ διακεκομμένο άξονα αναφοράς 0°
  (`paintDirectionArc`, pivot→`anchorPos`), όπου `anchorPos = pivot + refDir` και `refDir` =
  `resolveRotateReferenceAnchor` (ο κύριος άξονας του τοίχου, προς το σώμα). Το ορθογώνιο έπαιρνε
  `IDENTITY_FRAME` (world) από το `resolveMoveGlyphFrame` → ο άξονας έδειχνε world-δυτικά, ΟΧΙ στην
  (γυρισμένη) πλευρά. **Fix (ίδιο SSoT τοίχου)**: επέκταση `bim/grips/rotate-reference-axis.ts` με
  branch ορθογωνίου (`rectReferenceAnchor`) που ανακτά τον oriented frame από τα vertices (SSoT
  `asOrientedRect` + `rectOrPolylineVertices`) και δίνει τον άξονα της **μείζονος πλευράς προς το σώμα**
  με το ΙΔΙΟ flip-rule (`proj>ε ? +major : −major`) + `MAJOR_AXIS_PROJ_EPS` που χρησιμοποιεί ο τοίχος →
  το υπάρχον `paintDirectionArc` ζωγραφίζει αυτόματα τον ΕΝΑΝ ομοαξονικό άξονα (μηδέν νέο rendering,
  μηδέν σταυρός). Non-rect (γραμμή/τόξο/generic polyline) → fall-through, μηδέν regression. **Bonus fix**:
  ο κύκλος (συμμετρικός, χωρίς λαβή περιστροφής) → ρητό `null` (το `move-glyph-frame` IDENTITY του commit
  `08cf7f6a` είχε σπάσει το `circle→null` test — αποκαταστάθηκε, χωρίς άγγιγμα του `move-glyph-frame.ts`).
  **Boy-Scout dedup**: νέο SSoT `rectOrPolylineVertices` (`rectangle-detect.ts`) — ο commit
  (`commitPolylineRotationGripDrag`) το χρησιμοποιεί αντί inline `rectangleSceneVertices` (καταργήθηκε).
  **Tests**: `rotate-reference-axis.test.ts` +5 rectangle cases (NE/SW corner→major toward body· scene
  rectangle· tilted 90°· taller-than-wide). jest ✅ 37/37. 🔴 εκκρεμεί browser-verify.
- **2026-07-05** — 🐛 **polyline / rectangle rotation LIVE GHOST + rotate-preview SSoT κεντρικοποίηση**
  (Giorgio: «θέλω τον ίδιο ακριβώς κώδικα περιστροφής της γραμμής και στο τετράγωνο» + SSoT audit «μην
  δημιουργείς διπλότυπα, κεντρικοποίησε και τα προϋπάρχοντα»). ΙΔΙΑ οικογένεια bug με το τόξο: commit
  (`commitPolylineRotationGripDrag`) + hot-grip FSM (`polyline-rotation`→`'rotate'`) δούλευαν ήδη· έλειπε
  ΜΟΝΟ η γεωμετρία του ghost (βέλη + POLAR/AutoAlign ίχνη είναι ήδη generic → εμφανίστηκαν μόνα τους).
  **Wiring** (mirror του arc): `hooks/grip-computation-types.ts` (`DxfGripDragPreview` +`polylineGripKind`
  +`arcGripKind` — Boy-Scout N.0.2: το arc fix το ξέχασε), `rendering/ghost/entity-preview-types.ts`
  (+`polylineGripKind`), `hooks/tools/grip-drag-preview-transform.ts` (pass-through),
  `hooks/grips/grip-projections.ts` (`buildRotateReferencePreview` forward),
  `rendering/ghost/apply-entity-preview.ts` (arc + polyline rotation branches).
  **🎯 SSoT κεντρικοποίηση (η ουσία)**: αντί για per-primitive `applyArcRotationDrag` /
  `applyPolylineRotationDrag` (που ήταν verbatim αντίγραφα των arc/polyline cases του `rotateEntity`),
  ΕΝΑΣ κοινός SSoT `hooks/grips/primitive-rotation-drag.ts` — `resolveSweptRotationDeg` (guarded
  anchor-relative swept angle) + `applyPrimitiveRotationDrag(entity, {anchor,currentPos,pivot})` που
  **delegate-άρει τη γεωμετρία στο ΕΝΑ `rotateEntity`** που τρέχει το commit (`RotateEntityCommand`).
  ⇒ preview ≡ commit **by identity**, όχι hand-kept parity. **Καταργήθηκαν** τα δύο bespoke helpers
  (arc-grips.ts, polyline-grips.ts) + το commit `resolveRotation` χρησιμοποιεί πλέον το ίδιο
  `resolveSweptRotationDeg` (commit ↔ preview twins). Το `line` δεν ρουτάρεται εδώ — μένει στη
  διαφορετική (κι αυτή κεντρική) `axis-box` μηχανή, parity με τον τοίχο, χωρίς fork. **Tests**: νέο
  `hooks/grips/__tests__/primitive-rotation-drag.test.ts` (swept-guard + arc/polyline patch === `rotateEntity`
  + degenerate→null)· τα per-helper describes αφαιρέθηκαν. jest ✅ 26/26 (5 suites). 🔴 εκκρεμεί
  browser-verify: 1 περιστροφή τετραγώνου (ghost + βέλη + ίχνη) + ειδική απαίτηση «ομοαξονικός βραχίονας
  αναφοράς με πλευρά ορθογωνίου» (verify-then-decide — αγγίζει το κοινό free-rotate flow line/arc).
- **2026-07-04** — 🐛 **arc rotation LIVE GHOST fix** (Giorgio: «όταν πατάω το σημάδι περιστροφής
  δεν εμφανίζεται preview ghost του τόξου»). Το **commit** του arc rotation δούλευε (`commitArcGripDrag`
  → `RotateEntityCommand`), αλλά το **preview** έκοβε: (1) το `EntityPreviewTransform` δεν είχε πεδίο
  `arcGripKind`· (2) το `toEntityPreviewTransform` δεν το προωθούσε· (3) το `buildRotateReferencePreview`
  δεν το προωθούσε (ενώ προωθούσε `lineGripKind`)· (4) το `applyEntityPreview` δεν είχε arc-rotation
  branch → `transformed === entity` → μηδέν ghost. Fix (mirror του `line-rotation` path, full SSoT):
  νέο pure `applyArcRotationDrag` (`systems/arc/arc-grips.ts`) = thin adapter πάνω στα ΙΔΙΑ
  `sweptAngleDegAboutPivot` + `rotatePoint` + `normalizeAngleDeg` primitives που τρέχει το commit
  (`rotateEntity` arc case) → preview ≡ commit by construction, μηδέν νέα rotate math. **Τροποποιημένα**:
  `rendering/ghost/entity-preview-types.ts` (+`arcGripKind`), `hooks/tools/grip-drag-preview-transform.ts`
  (pass-through), `hooks/grips/grip-projections.ts` (`buildRotateReferencePreview` forward),
  `rendering/ghost/apply-entity-preview.ts` (arc-rotation branch), `systems/arc/arc-grips.ts`
  (`applyArcRotationDrag` + parity tests vs `rotateEntity`). jest ✅.
- **2026-07-01** — Αρχική υλοποίηση (UNCOMMITTED). circle=μόνο move· arc+polyline=move+rotation·
  rectangle μέσω polyline (oriented rect-box placement + explode-to-polyline στο rotation).
  Αποφάσεις Giorgio μέσω AskUserQuestion. 🔴 εκκρεμεί browser-verify (`/dxf/viewer`).
