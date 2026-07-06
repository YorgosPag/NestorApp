# ADR-557: Text / MText λαβές με ΠΛΗΡΗ parity ορθογώνιου τοίχου/κολόνας (SSoT)

| Πεδίο | Τιμή |
|---|---|
| **Status** | 🟢 Slices 1-5 + **Φ-attachment** (H+V real-metrics) IMPLEMENTED (UNCOMMITTED) — grips + οριζόντια browser-verified· **κάθετο (visual/em split) 🔴 εκκρεμεί browser-verify** (Giorgio 2026-07-07) |
| **Date** | 2026-06-30 |
| **Last Updated** | 2026-07-07 |
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
- **HORIZONTAL** — `x` κέντρο από το `offsetForJustification` (`text-engine/layout/attachment-point.ts`, ADR-344 Φ3· μόνο η στήλη L/C/R) μέσω `horizontalCenterOffset` πάνω στο **πραγματικό glyph advance** (`measureTextAdvanceWorld`). Το **VISUAL** box μετά **inset-άρει** το advance box κατά τα glyph **side bearings** (`horizontalInkFractions`: leading = `inkLeft/advance`, trailing = `(advance−inkRight)/advance`) → αγκαλιάζει τα γράμματα ΚΑΙ αριστερά/δεξιά (Giorgio 2026-07-07: «επεκτείνεται προς τα έξω»). ZERO inset για MTEXT (πλάτος = explicit frame) + no-font.
- **VERTICAL — ΔΥΟ boxes** (η σύμβαση «visual bounds vs edit box» των μεγάλων editors):
  - `resolveTextBox` (**VISUAL**) — αγκαλιάζει τα ΖΩΓΡΑΦΙΣΜΕΝΑ glyphs: baseline εκεί που τον τοποθετεί ο renderer (**font** ascent/descent ανά attachment row, mirror `TextRenderer.fillGlyphRun`) + extent = πραγματικό glyph **INK** (cap height για κεφαλαία, +descenders για g/p/y), μέσω `measureTextVerticalRatios` (`text-vertical-metrics.ts`). Είναι το box για **2D grips + hover frame + hitTest** → λαβές/πλαίσιο ≡ γράμματα (Giorgio 2026-07-07: το em-box ήταν ~0.19·em ψηλότερο πάνω· μετρημένο 93 units πάνω από το cap-top).
  - `resolveTextEmBox` (**NOMINAL**) — το προ-metrics em box (`emVerticalRatios`), για το **3D textured plane** (`dxf-text-3d`) + **culling**, που είναι em-based (το 3D canvas ζωγραφίζει το glyph κεντραρισμένο σε em cell) και ΔΕΝ πρέπει να ακολουθήσει το cap box.
  ```
  center = position + R(rotationDeg)·{ horizontalCenterOffset, ((top+bottom)/2)·h }
  halfLength = ((top−bottom)/2)·h      // visual: top−bottom = inkAscent+inkDescent
  ```
- `textBoxToPosition(frame, entity)` — inverse του **VISUAL** box (ίδια ratios) → resize/rotate κρατά καρφωμένο το attachment point (Revit/AutoCAD).
- `textVisualExtentRatio(entity)` — visual extent ÷ em (= inkAscent+inkDescent) — ο διαιρέτης που το resize χρησιμοποιεί για να ανακτήσει το ονομαστικό `height` από το τραβηγμένο box height (χωρίς jump στο release· em-path → 1.0).
- `textBoxCornersWorld` (visual) / `textEmBoxCornersWorld` (em) / `textBoxAABB` (em) — rotation-aware γωνίες + AABB.

**Consumers:**
- `text-grips.ts` — `textToRectFrame` = re-export του `resolveTextBox` (visual)· `framePatch` → `height = boxHeight / textVisualExtentRatio` (visual→nominal), `position` → `textBoxToPosition`.
- `dxf-text-3d.ts` — anchor mesh στο `resolveTextEmBox().center` (em· ώστε το 3D κείμενο να ΜΗΝ μετακινηθεί ~53 units σε 277-unit τίτλο).
- `TextRenderer.hitTest` — rotation-aware test στο VISUAL box· 2D hover frame stroke `textBoxCornersWorld` (visual) → φωτεινό πλαίσιο ≡ γράμματα.
- `getEntityBBox` (`dxf-viewport-culling.ts`) → `textBoxAABB` (em· γενναιόδωρο cull, δεν pop-άρει το κείμενο στην άκρη).
- `dxf-entity-outline.ts` (3D hover halo) → `textEmBoxCornersWorld` (em· ταιριάζει με το 3D plane).

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
- **2026-07-07 (Φ-attachment ΟΡΙΖΟΝΤΙΟ — glyph ink side-bearing inset, «επεκτείνεται προς τα έξω»)** — Μετά το κάθετο fix, browser-verify: πάνω/κάτω κουμπώνει τέλεια αλλά **δεξιά/αριστερά το box επεκτεινόταν έξω** από τα γράμματα (glyph side bearings — το πλάτος ήταν το pen **advance**, όχι το ink). **FIX:** το vertical-metrics SSoT γενικεύτηκε σε **`measureTextGlyphInk`** (full glyph ink box H+V: font metrics + ink extent + `inkLeft`/`inkRight`/`advance`, μία λήψη `getBoundingBox()`). Το VISUAL box inset-άρει το advance box κατά τα side bearings (`horizontalInkFractions`)· ΝΕΟ `textVisualWidthRatio` (= 1 − bearings) οδηγεί το resize inverse (`framePatch.widthFactor = newVisualWidth / (baseAdvance · widthRatio)` → box holds, no jump). ZERO inset για MTEXT/no-font (byte-identical). Consumers/tests αμετάβλητα (default stub: ink spans full advance → visual==advance). ΝΕΟ `text-box-horizontal.test.ts` (side-bearing stub → box hugs left+right, E-resize round-trip). Stub επεκτάθηκε (`inkLeftEm`/`inkRightEm`). **665 jest GREEN.** 🔴 εκκρεμεί browser-verify.
- **2026-07-07 (Φ-attachment ΚΑΘΕΤΟ — visual glyph-ink box, «μεγάλο κενό πάνω»)** — Το box ύψος χρησιμοποιούσε το ονομαστικό em, ενώ ο renderer ζωγραφίζει τα caps στο ~0.71·em πάνω στο baseline (baseline τοποθετημένο κατά το **font ascent** ~0.905·em) → το πλαίσιο/λαβές ~0.19·em ψηλότερα, μεγάλο κενό πάνω (μετρημένο με temp `[VBOX-DIAG]`: για «ΤΕΣΤ» Liberation Sans, box top **93 units** πάνω από το cap-top, inkDescent=0). **FIX (real metrics, όπως Revit/Figma):** ΝΕΟ SSoT `text-engine/fonts/text-vertical-metrics.ts` `measureTextVerticalRatios` (font ascent/descent για baseline anchor + glyph **INK** bbox `getPath().getBoundingBox()` για extent· nominal fallback από `TEXT_METRICS_RATIOS`, +ΝΕΟ `CAP_HEIGHT_RATIO=0.7`· ο flaky CSS `actualBoundingBox*` tier παραλείφθηκε σκόπιμα — μετρήθηκε `-17` στη μηχανή Giorgio). **«Visual bounds vs edit box» split:** `resolveTextBox` = VISUAL cap/ink box (2D grips/hover/hitTest ≡ γράμματα)· ΝΕΟ `resolveTextEmBox` = nominal em box (3D plane + culling, μηδέν 3D regression — αλλιώς το 3D κείμενο μετακινούνταν ~53 units). Resize inverse μέσω `textVisualExtentRatio` (visual→nominal· `framePatch` διαιρεί το box height, ώστε το resize να ΜΗΝ σπάσει — box holds, no jump). Consumers repointed: `dxf-text-3d`→`resolveTextEmBox`, `dxf-entity-outline`→`textEmBoxCornersWorld`, `textBoxAABB`→em. ΝΕΑ tests: `text-vertical-metrics.test.ts` + `text-box-vertical.test.ts` (cap stub 0.7/0 → box αγκαλιάζει caps + resize round-trip no-jump). Stub επεκτάθηκε (`getBoundingBox`· default ink=metrics → VISUAL≡em → **όλα τα προϋπάρχοντα geometry tests πράσινα αμετάβλητα**). **628 jest GREEN.** 🔴 εκκρεμεί browser-verify.
- **2026-07-07 (TEMP diagnostics αφαιρέθηκαν)** — Αφαιρέθηκαν ΟΛΑ τα προσωρινά διαγνωστικά (`[TEXTBOX-DIAG]`/`logTextBoxDiag`/throttle map στον `TextRenderer`, `[GRIP-HIT-DIAG]` στον `grip-mouse-handlers` +orphaned `UnifiedGripInfo` import, `[TEXT-COMMIT-DIAG]`/`[TEXT-COMMIT-AFTER]` στον `grip-parametric-text-commits`, το νέο `[VBOX-DIAG]`) πριν το commit. Grep `TEMP-DIAG|*-DIAG|logTextBoxDiag` → 0 hits.
- **2026-07-06/07 (Φ-attachment ΟΡΙΖΟΝΤΙΟ — real glyph advance + durable height + projection SSoT)** — (α) Το πλάτος του box χρησιμοποιούσε monospace προσέγγιση (`len·h·0.6`) ενώ ο renderer ζωγραφίζει με πραγματικό proportional advance → box off οριζόντια. FIX: ΝΕΟ `text-engine/fonts/text-advance.ts` `measureTextAdvanceWorld` (3-tier: opentype `getGlyphRun`→CSS `measureText`→monospace)· `effectiveTextWidth`+`baseTextAdvanceWorld` το χρησιμοποιούν· `framePatch` inverse μέσω `baseTextAdvanceWorld` (deltaW=0 verified). (β) **Durable resize height:** το ύψος ζει στο `textNode.runs[].style.height` (`resolveTextHeight` το διαβάζει πρώτο) → flat `height` write σκιαζόταν same-tick· FIX `scaleTextNodeRunHeights` (`utils/text-node-utils.ts`) γράφει scaled textNode + `UpdateTextTransformCommand.textNode`. (γ) **Projection SSoT:** ΝΕΟ `bim/text/project-scene-text.ts` `projectSceneTextToDxf` (scene→DxfText, preview≡commit)· ο ghost (`apply-entity-preview.ts`) inject-άρει flat text/height ώστε ο `TextRenderer` να μη κάνει early-return. ΝΕΑ tests `text-advance.test.ts` + `_stub-font.ts` (deterministic 0.6 ratio) + `text-node-utils.test.ts`.
- **2026-07-06 (TEMP diagnostic — box-vs-glyph offset instrumentation)** — Προσωρινό (`REMOVE BEFORE COMMIT`) διαγνωστικό logging στον `TextRenderer.render` (`logTextBoxDiag` + throttle map, 1 log/400ms/entity) που μετρά την οριζόντια απόκλιση ανάμεσα στο **geometry box** (grips/hover/hit-test, `resolveTextBox` → monospace προσέγγιση) και τα **πραγματικά ζωγραφισμένα glyphs** (real font metrics `getGlyphRun`, else `ctx.measureText`) — για να εντοπιστεί γιατί οι λαβές/hover frame κάθονται μετατοπισμένα σε σχέση με το κείμενο (ADR-557 Φ-attachment follow-up). **Καθαρά instrumentation**: `console.log('[TEXTBOX-DIAG]', …)` πριν το `ctx.restore()`, καμία αλλαγή στη ζωγραφική/geometry/commit. Committed κατόπιν ρητής εντολής Giorgio (2026-07-06) ώστε να διατηρηθεί το working tree καθαρό· να **αφαιρεθεί** πριν το production polish του box-vs-glyph fix. Co-staged: ADR-557 (CHECK 6D). 🟡 TEMP.
- **2026-07-06 (MTEXT ghost regression re-fix — triage)** — Το `apply-entity-preview.ts:237` guard είχε **αναιρεθεί** από `'text'||'mtext'` πίσω σε μόνο `'text'` (commit `0878ed54`, 30/6) με σχόλιο-αιτιολογία «MTEXT normalised to 'text' at scene→Dxf conversion» → **λάθος γι' αυτό το pipeline**: το mtext→text normalize (`dxf-text-entity-converter.ts:49`) συμβαίνει ΜΟΝΟ στο render/hit-test pipeline (`dxf-scene-entity-converter`)· το ghost-preview παίρνει το **raw scene entity** (`useGripGhostPreview.getEntity`) με `type==='mtext'`, και το `normalizePreviewEntity` μαπάρει μόνο `lwpolyline→polyline`. Αποτέλεσμα: το ζωντανό ghost χανόταν ξανά σε MTEXT grip-drag (regression του ba33b0c2). **FIX:** επαναφορά `entity.type === 'text' || entity.type === 'mtext'` + διόρθωση του παραπλανητικού σχολίου. Το `apply-entity-preview-text.test.ts` (regression guard) ήταν pre-existing failing → τώρα GREEN (move + MTEXT corner resize width 800→860). Triage 16 pre-existing tests.
- **2026-06-30 (Φ-attachment, drag-response fix)** — «το κείμενο δεν ανταποκρίνεται στις λαβές»: το live ghost (`applyEntityPreview`) αγνοούσε MTEXT (έλεγχε μόνο `type==='text'`, ενώ το commit δεχόταν `'mtext'`) → καμία ζωντανή απόκριση· + το box έχανε το attachment στο drag (scene entity → `textNode.attachment`, commit δεν το περνούσε). FIX: ghost δέχεται `'text'|'mtext'`· `resolveTextBox` διαβάζει `textNode.attachment` → `textStyle` → TL· commit `projectSceneTextToDxf` κουβαλά `textStyle` (`extractFirstRunStyle`). ΝΕΟ `apply-entity-preview-text.test.ts`. 87 jest GREEN.
- **2026-06-30 (Φ-attachment)** — Attachment-aware text-box SSoT. ΝΕΟ `bim/text/text-box.ts` (`resolveTextBox`/`textBoxToPosition`/`textBoxCornersWorld`/`textBoxAABB`) reuse `offsetForJustification` (ADR-344). Ενοποίησε 4 ασύμφωνες box πηγές (grips/3D mesh/hitTest/getEntityBBox) σε ΕΝΑ· νέο 2D hover frame· grip box + 3D mesh + hitTest + cull + 3D outline όλα attachment-aware → λαβές=κείμενο=hover frame, 2Δ≡3Δ. 🔴 εκκρεμεί browser-verify (BR/TL/MC/rotation) + commit (Giorgio).
- **2026-06-30** — Slices 1-5 υλοποιήθηκαν (UNCOMMITTED). Browser-verified: 10 λαβές σωστά τοποθετημένες 2D + 3D (Giorgio). Renumber ADR-551→**557** (collision με census ADR στο shared tree). Εκκρεμεί commit (Giorgio).
