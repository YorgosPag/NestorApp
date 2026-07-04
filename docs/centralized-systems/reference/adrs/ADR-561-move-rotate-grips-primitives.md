# ADR-561 — Σταυρός Μετακίνησης + Σημάδι Περιστροφής σε Primitives (polyline / circle / arc / rectangle)

- **Status**: ✅ IMPLEMENTED (UNCOMMITTED) — 2026-07-01 · 🔴 εκκρεμεί browser-verify
- **Category**: DXF Viewer — Canvas & Rendering / Grips
- **Related**: ADR-397 (BIM grip glyph behavior SSoT — MOVE 4-arrow / ROTATION curved),
  ADR-363 Slice F/G.5 (plain DXF line rotation + ¼-west MOVE cross),
  ADR-557 (Text/MText rect-box grip parity), ADR-519 (κυκλική κολόνα — μόνο move, όχι rotation),
  ADR-188 (RotateEntityCommand), ADR-559 (quadrant grips visible ≡ pickable)

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
  `'polyline-move'` (centroid) + `'polyline-rotation'` στα υπάρχοντα vertex/edge grips. Placement:
  **rectangle** (μέσω `rectangle-detect.ts::asOrientedRect`) → oriented rect-box (handle γέρνει με
  το σχήμα)· **γενική polyline** → axis-aligned bbox. Rotation commit → `commitPolylineRotationGripDrag`.
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
