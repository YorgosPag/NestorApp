# ADR-557: Text / MText λαβές με ΠΛΗΡΗ parity ορθογώνιου τοίχου/κολόνας (SSoT)

| Πεδίο | Τιμή |
|---|---|
| **Status** | 🟢 Slices 1-5 + **Φ-attachment** IMPLEMENTED (UNCOMMITTED) — grips browser-verified· Φ-attachment 🔴 εκκρεμεί browser-verify (Giorgio 2026-06-30) |
| **Date** | 2026-06-30 |
| **Last Updated** | 2026-06-30 |
| **Category** | Canvas & Rendering / Grips |
| **Location** | `src/subapps/dxf-viewer/` (`bim/text/`, `hooks/grips/`, `rendering/{entities,ghost}/`, `core/commands/text/`, `bim-3d/{converters,grips}/`, `canvas-v2/dxf-canvas/`) |
| **Author** | Claude (κατόπιν εντολής Giorgio) |
| **Related ADRs** | **ADR-363** (rect-grip-engine + column adapter = το πρότυπο), ADR-436 (pad adapter), ADR-397 (glyph registry SSoT), ADR-507 §8 (`MergeableUpdateCommand`), ADR-040 (preview canvas), ADR-537 (3D raw-dxf grips), ADR-530 (glyph text render), ADR-108 (text-metrics ratios) |

---

## Summary

Όταν επιλέγεις **ορθογώνιο τοίχο/κολόνα** → 8 λαβές (4 γωνίες + 4 μέσα-πλευράς) + 1 move + 1 rotation. Ο Giorgio ζήτησε **τον ΙΔΙΟ ΑΚΡΙΒΩΣ κώδικα** στα **ΚΕΙΜΕΝΑ** (TEXT + MTEXT): ίδιες λαβές, ίδιο resize/move/rotate, **μία πηγή αλήθειας, όχι διπλότυπο**.

Λύση: ΝΕΟ entity-agnostic adapter `bim/text/text-grips.ts` που **καλεί** τον κοινό πυρήνα `rect-grip-engine`/`rect-frame` (ίδιος κώδικας με τοίχο/κολόνα/πέδιλο), αντικαθιστώντας την παλιά μονή «position grip» του κειμένου. Εκπέμπει **10 grips** και στα 3 paths (2D interaction, 2D visual render, 3D viewport) + live ghost (preview ≡ commit) + minimal commit (`UpdateTextTransformCommand`).

- **MTEXT**: πλάτος = το πραγματικό `MTextEntity.width`.
- **TEXT (απλό)**: πλάτος = ΝΕΟ `widthFactor` (AutoCAD TEXT X-scale) + οριζόντιο `ctx.scale(widthFactor,1)` στον renderer.

---

## Context — δύο κρίσιμα ευρήματα audit (το αρχικό πλάνο τα έχασε)

### 1. ΔΥΟ ξεχωριστά grip συστήματα (όχι ένα)
Το αρχικό πλάνο υπέθεσε ότι το emission ζει μόνο στο `computeDxfEntityGrips` (`hooks/grip-computation.ts`). Στην πραγματικότητα:

| Σύστημα | Συνάρτηση | Τι τροφοδοτεί |
|---|---|---|
| Interaction (hit-test) + **3D render** | `computeDxfEntityGrips` → `getTextGrips` | `GripRegistryPublisher`→`AllGripsStore`· `grip-3d-dxf-raw-grips` |
| **2D VISUAL render** (ζωγραφική τετραγώνων) | `BaseEntityRenderer.getGrips()` **per-entity** | `renderGrips`→`PhaseManager.renderPhaseGrips` |

Αν αλλάξεις μόνο το πρώτο, το 3D δείχνει 10 λαβές αλλά ο 2D καμβάς δείχνει την παλιά **1**. **Και τα δύο** πρέπει να επιστρέφουν το ίδιο grip set → και τα δύο καλούν `getTextGrips`. (Mirror `ColumnRenderer.getGrips` → `getColumnGrips`.)

### 2. Λάθος σύμβαση άγκυρας bbox (`entity-bounds.ts`)
Το αρχικό πλάνο §7 παρέπεμψε στο `entity-bounds.ts` που τοποθετεί `position` = **πάνω-αριστερά** (box προς τα **κάτω**, `minY = position.y − h`). Η **πραγματική** τοποθέτηση κειμένου της εφαρμογής (επιβεβαιωμένη από τον 3D text converter `dxf-text-3d.ts`: *«baseline-left, matching the 2D anchor + getEntityBBox lower-left corner»*, `mesh.center = position + (w/2, +h/2)`) είναι `position` = **κάτω-αριστερά**, box προς τα **ΠΑΝΩ**. Η λάθος σύμβαση έβαζε τις λαβές **κάτω από** το κείμενο (ίδια λάθος θέση 2D **και** 3D, αφού κοινό `getTextGrips`). Διόρθωση: `textToRectFrame` centre = `position + R(θ)·(w/2, +h/2)`.

---

## Decision — αρχιτεκτονική (μηδέν διπλότυπο)

**Κοινός πυρήνας (reuse, ΟΧΙ αντιγραφή math):** `bim/grips/rect-frame.ts` + `rect-grip-engine.ts` (opposite-corner/edge fixed) — ο ίδιος που χρησιμοποιούν τοίχος/κολόνα/πέδιλο.

**ΝΕΟ adapter `bim/text/text-grips.ts`** (πρότυπο: `column-rect-adapter.ts`):
- `textToRectFrame(dxfText)` — `position` (κάτω-αριστερά) + `widthFactor`/`width` + `rotation` → centroid `RectFrame`. Defensive: `resolveBoxHeight` (fallback 2.5) + `naturalTextWidth` ανέχεται undefined `text` (pure, δεν σκάει).
- `getTextGrips(entity)` — 10 `GripInfo` (mirror `rectColumnGrips`): center MOVE (0) + rotation (1) + 4 edges (2,3,8,9) + 4 corners (4..7). Rotation handle = `rotationHandleMidwayOffset` (ίδια πολιτική με κολόνα).
- `applyTextGripDrag(kind, {entity,delta,currentPos?,ortho?,pivot?})` → `TextTransformPatch {position?,rotation?,height?,width?,widthFactor?}`. ΕΝΑ pure transform· pivot περιστροφής = bbox-centre + re-home `position` (Figma-like).

**Διάκριση MTEXT vs TEXT:** `width != null` ⇒ MTEXT (patch `width`)· αλλιώς TEXT (patch `widthFactor`). Ο converter (`dxf-text-entity-converter.ts`) κουβαλά `width` μόνο σε MTEXT, `widthFactor` μόνο σε TEXT.

**Commit:** ΝΕΟ minimal `UpdateTextTransformCommand` (extends `MergeableUpdateCommand`) που γράφει **top-level** πεδία (`position/rotation/height/fontSize/width|widthFactor`) — ΟΧΙ το `UpdateTextGeometryCommand` (κενά: γράφει `textNode.rotation` ενώ ο renderer διαβάζει flat `rotation`· αγνοεί `width` χωρίς `columns`). Drag-merge → ένα undo.

**Glyph render (TEXT X-scale):** `TextRenderer` προσθέτει **μόνο** οριζόντιο `ctx.scale(widthFactor,1)` γύρω από το text origin, ΜΕΤΑ την υπάρχουσα rotation (μηδέν αλλαγή rotation/zoom math)· `widthFactor === 1` → byte-identical legacy path. `scaleText` (toolbar Scale) τιμά `widthFactor *= |sx|` (Boy-Scout consistency με `scaleMText`).

**Glyph icons:** `grip-glyph-registry` → `text-move`='move', `text-rotation`='rotation' (4-βέλη / καμπύλο βέλος, ίδιο SSoT με κολόνα).

### ΧΩΡΙΣ mirror grip (δεν ζητήθηκε).

---

## Files (Slices)

- **Slice 1 (foundation):** `grip-kinds.ts` (`TextGripKind`), `grip-types.ts`, `grip-computation-types.ts`, `useGripMovement.ts`, `dxf-types.ts` (`DxfText.width?/widthFactor?`), `entities.ts` (`TextEntity.widthFactor?`), ΝΕΟ `bim/text/text-grips.ts` + tests.
- **Slice 2 (emission):** `dxf-text-entity-converter.ts` (carry width/widthFactor), `grip-computation.ts` (`case 'text'` → `getTextGrips`).
- **Slice 3 (commit+ghost):** ΝΕΟ `UpdateTextTransformCommand.ts`, ΝΕΟ `grip-parametric-text-commits.ts` (+re-export), `grip-commit-adapters.ts` (dispatch), `grip-projections.ts`, `grip-drag-preview-transform.ts`, `apply-entity-preview.ts`, `entity-preview-types.ts`, `unified-grip-types.ts`, `grip-registry.ts` (forward `textGripKind`).
- **Slice 4 (2D render parity + widthFactor):** `TextRenderer.getGrips` (10 grips, mirror Column) + horizontal `widthFactor` scale + hitTest width, `grip-glyph-registry.ts`, `entity-bounds.ts`, `scale-entity-transform.ts`.
- **Slice 5:** αυτό το ADR.

**Tests:** `bim/text/__tests__/text-grips.test.ts` (geometry/resize/rotation/round-trip), `hooks/__tests__/grip-computation-text.test.ts` (emission=10).

---

## Φ-attachment — Attachment-aware Text-Box SSoT (2026-06-30)

### Πρόβλημα (Giorgio)
«ΚΕΙΜΕΝΑ, ΦΩΤΕΙΝΟ ΠΛΑΙΣΙΟ HOVER ΚΑΙ ΛΑΒΕΣ δεν συμπίπτουν, ούτε 2Δ ούτε 3Δ· και είναι σε **διαφορετικές θέσεις** 2Δ vs 3Δ (όχι full parity)· το hover frame δεν εμφανίζεται καθόλου στο 2Δ.»

### Root cause (διόρθωση του ευρήματος #2 πιο πάνω)
Η `position` ενός κειμένου είναι το **attachment point** (9-point grid TL/TC/.../BR, MTEXT group 71) — **ΟΧΙ** πάντα κάτω-αριστερά. Το Slice-1 finding #2 κωδικοποίησε σταθερά **BL** (lower-left, box προς τα πάνω) βασισμένο στο σχόλιο του `dxf-text-3d.ts`. Αυτό είναι σωστό **μόνο** για baseline-left κείμενο· για κάθε άλλο attachment (π.χ. **BR** στο screenshot) η BL σύμβαση τοποθετεί το box σε λάθος μεριά. Επιπλέον υπήρχαν **4 ασύμφωνες πηγές** box, όλες attachment-blind:

| Σημείο | Σύμβαση πριν | Σύμπτωμα |
|---|---|---|
| `textToRectFrame` (grips) | BL (lower-left, +x/+y) | λαβές σε λάθος μεριά |
| `dxf-text-3d.ts` (3D mesh) | BL (lower-left, +x/+y) | 3D κείμενο σε λάθος θέση |
| `TextRenderer.hitTest` | TL (top-left, +x/−y) | άλλη σύμβαση |
| `getEntityBBox` (cull + 3D hover frame) | συμμετρικό ±h | λάθος, αλλά ορατό frame |

Ο **2D renderer** είναι η μόνη σωστή πηγή: διαβάζει `textStyle.textAlign`(L/C/R) + `textStyle.textBaseline`(T/M/B) (παράγωγα attachment, `extractFirstRunStyle`). Default renderer = `top/left` (**TL**) → κείμενο **κάτω-δεξιά**, ενώ grips+3D (BL) → **πάνω-δεξιά** → εξ ου 2Δ(κάτω)≠3Δ(πάνω) **και** λαβές≠κείμενο ακόμη και χωρίς attachment.

### Λύση — ΕΝΑ box SSoT, N consumers (reuse, μηδέν διπλότυπο)
ΝΕΟ `bim/text/text-box.ts` (pure):
- `resolveTextBox(entity): RectFrame` — attachment-aware centre. **Reuse** του υπάρχοντος `offsetForJustification` (`text-engine/layout/attachment-point.ts`, ADR-344 Φ3· **κανένα** re-implement του 9-point πίνακα). Mapping y-down→world y-up:
  ```
  {dx,dy} = offsetForJustification(just,{w,h})   // y-down → top-left corner
  localCenter = { x: dx + w/2, y: -(dy + h/2) }   // → world y-up box centre
  center = position + R(rotationDeg)·localCenter
  ```
  `just` = `textBaseline`{T,M,B}+`textAlign`{L,C,R}, default **TL**. Επαλήθευση: **BL** → (+w/2,+h/2) = ταυτόσημο με την παλιά συμπεριφορά (μηδέν regression baseline-left)· **TL** → (+w/2,−h/2)· **BR** → (−w/2,+h/2).
- `textBoxToPosition(frame, entity)` — inverse με το ΙΔΙΟ `offsetForJustification` στα νέα w,h → resize/rotate κρατά καρφωμένο το attachment point (Revit/AutoCAD).
- `textBoxCornersWorld` / `textBoxAABB` — rotation-aware γωνίες + AABB.
- Width/height SSoT (`effectiveTextWidth`/`resolveBoxHeight`/`naturalTextWidth`) μετακινήθηκαν εδώ· `text-grips.ts` τα re-exports.

**Consumers (όλοι διαβάζουν το ΕΝΑ box):**
- `text-grips.ts` — `textToRectFrame` = re-export του `resolveTextBox`· `rectFrameToPosition` → `textBoxToPosition`.
- `dxf-text-3d.ts` — anchor mesh στο `resolveTextBox().center` (plane size font-measured αμετάβλητο· μόνο re-center → 2Δ≡3Δ).
- `TextRenderer.hitTest` — rotation-aware test στο SSoT box· **ΝΕΟ 2D hover frame** (stroke `textBoxCornersWorld`, `HOVER_HIGHLIGHT`) → το φωτεινό πλαίσιο εμφανίζεται πλέον και στο 2Δ.
- `getEntityBBox` (`dxf-viewport-culling.ts`) → `textBoxAABB` (culling/pick = ό,τι ζωγραφίζεται).
- `dxf-entity-outline.ts` (3D hover halo) → `textBoxCornersWorld` (rotation-aware = λαβές).

**ΟΧΙ αλλαγή** στη rotation/zoom/scale math του `renderTextContent` (guard αρχείου τηρήθηκε — μόνο anchor/box/hitTest + additive hover frame).

### Drag-response fix (Giorgio: «πιάνω τις λαβές και τις μετακινώ, το κείμενο ΔΕΝ ανταποκρίνεται»)
Εμπειρικό trace ΟΛΟΥ του pipeline (όχι μεμονωμένα) βρήκε **2 κενά** στο live ghost / commit:
1. **MTEXT αγνοούνταν στο live ghost.** Ο `applyEntityPreview` λαμβάνει το **scene entity**, του οποίου ο τύπος είναι `'text'` **Ή** `'mtext'`. Το branch έλεγχε μόνο `entity.type === 'text'` → για MTEXT επέστρεφε το ίδιο ref → `transformed === entity` → ο ghost παρακάμπτεται → **καμία ζωντανή απόκριση** (το commit όμως ήδη δεχόταν `'mtext'` → ασυμφωνία). FIX: `entity.type === 'text' || entity.type === 'mtext'` (mirror του commit).
2. **Το box έχανε το attachment στο drag.** Το scene entity κουβαλά το attachment στο `textNode.attachment` (όχι στο `textStyle`), και το `projectSceneTextToDxf` (commit) δεν το περνούσε → `resolveTextBox` έπεφτε σε TL. FIX: ο `resolveTextBox` διαβάζει `textNode.attachment` πρώτα (scene path), μετά `textStyle` (flat path)· το commit `projectSceneTextToDxf` κουβαλά `textStyle` μέσω του υπάρχοντος `extractFirstRunStyle`. Έτσι το box στο ghost + commit ταυτίζεται με τις λαβές που έπιασε ο χρήστης (TL..BR).

**Tests:** ΝΕΟ `bim/text/__tests__/text-box.test.ts` (9-point grid centre, default=TL, corners pin anchor, 2Δ≡3Δ move-grip===centre, inverse round-trip incl. rotation, AABB, `textNode.attachment`). ΝΕΟ `rendering/ghost/__tests__/apply-entity-preview-text.test.ts` (TEXT+**MTEXT** move/corner ghost regression). Updated: `text-grips.test.ts` (`text()` helper ρητά BL), `dxf-wireframe-hit-test.test.ts` (νέο attachment-aware bbox). 87 jest GREEN.

---

## Boy-Scout / γνωστά εκκρεμή
- `text-engine/interaction/TextGripGeometry.ts` + `TextGripHandler.ts` = ασύνδετο παλιό σύστημα (4 γωνίες+move+rotation+mirror, δική του math). **Μερικώς αντικαθιστούμενο** — να αποσυρθεί όταν επιβεβαιωθεί zero-usage.
- ✅ **ΛΥΘΗΚΕ (Φ-attachment):** `TextRenderer.hitTest` + `getEntityBBox` ενοποιήθηκαν στο attachment-aware `text-box.ts` SSoT (τέλος της down/lower-left/±h ασυμφωνίας· hover frame πλέον ορατό στο 2Δ).

---

## Changelog
- **2026-07-06 (MTEXT ghost regression re-fix — triage)** — Το `apply-entity-preview.ts:237` guard είχε **αναιρεθεί** από `'text'||'mtext'` πίσω σε μόνο `'text'` (commit `0878ed54`, 30/6) με σχόλιο-αιτιολογία «MTEXT normalised to 'text' at scene→Dxf conversion» → **λάθος γι' αυτό το pipeline**: το mtext→text normalize (`dxf-text-entity-converter.ts:49`) συμβαίνει ΜΟΝΟ στο render/hit-test pipeline (`dxf-scene-entity-converter`)· το ghost-preview παίρνει το **raw scene entity** (`useGripGhostPreview.getEntity`) με `type==='mtext'`, και το `normalizePreviewEntity` μαπάρει μόνο `lwpolyline→polyline`. Αποτέλεσμα: το ζωντανό ghost χανόταν ξανά σε MTEXT grip-drag (regression του ba33b0c2). **FIX:** επαναφορά `entity.type === 'text' || entity.type === 'mtext'` + διόρθωση του παραπλανητικού σχολίου. Το `apply-entity-preview-text.test.ts` (regression guard) ήταν pre-existing failing → τώρα GREEN (move + MTEXT corner resize width 800→860). Triage 16 pre-existing tests.
- **2026-06-30 (Φ-attachment, drag-response fix)** — «το κείμενο δεν ανταποκρίνεται στις λαβές»: το live ghost (`applyEntityPreview`) αγνοούσε MTEXT (έλεγχε μόνο `type==='text'`, ενώ το commit δεχόταν `'mtext'`) → καμία ζωντανή απόκριση· + το box έχανε το attachment στο drag (scene entity → `textNode.attachment`, commit δεν το περνούσε). FIX: ghost δέχεται `'text'|'mtext'`· `resolveTextBox` διαβάζει `textNode.attachment` → `textStyle` → TL· commit `projectSceneTextToDxf` κουβαλά `textStyle` (`extractFirstRunStyle`). ΝΕΟ `apply-entity-preview-text.test.ts`. 87 jest GREEN.
- **2026-06-30 (Φ-attachment)** — Attachment-aware text-box SSoT. ΝΕΟ `bim/text/text-box.ts` (`resolveTextBox`/`textBoxToPosition`/`textBoxCornersWorld`/`textBoxAABB`) reuse `offsetForJustification` (ADR-344). Ενοποίησε 4 ασύμφωνες box πηγές (grips/3D mesh/hitTest/getEntityBBox) σε ΕΝΑ· νέο 2D hover frame· grip box + 3D mesh + hitTest + cull + 3D outline όλα attachment-aware → λαβές=κείμενο=hover frame, 2Δ≡3Δ. 🔴 εκκρεμεί browser-verify (BR/TL/MC/rotation) + commit (Giorgio).
- **2026-06-30** — Slices 1-5 υλοποιήθηκαν (UNCOMMITTED). Browser-verified: 10 λαβές σωστά τοποθετημένες 2D + 3D (Giorgio). Renumber ADR-551→**557** (collision με census ADR στο shared tree). Εκκρεμεί commit (Giorgio).
