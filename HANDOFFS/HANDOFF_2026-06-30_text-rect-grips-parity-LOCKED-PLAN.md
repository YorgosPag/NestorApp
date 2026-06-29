# HANDOFF — Λαβές κειμένου με ΠΛΗΡΗ parity ορθογώνιου τοίχου (SSoT) — POST-AUDIT, LOCKED PLAN

**Ημερομηνία:** 2026-06-30 (νέα/καθαρή συνεδρία)
**Subapp:** DXF Viewer (`src/subapps/dxf-viewer`)
**Status:** 🟢 PLAN LOCKED — audit ΟΛΟΚΛΗΡΩΘΗΚΕ, αποφάσεις κλειδωμένες. Ξεκίνα ΚΑΤΕΥΘΕΙΑΝ κώδικα (ΟΧΙ ξανά audit). Model = Opus (cross-cutting).
**Αντικαθιστά:** `HANDOFF_2026-06-30_text-entity-rect-grips-parity-with-wall.md` (εκείνο ήταν NOT STARTED· οι οδηγίες audit του είναι πλέον DONE εδώ).

---

## 0. Πλαίσιο εκτέλεσης (ΚΡΙΣΙΜΟ)
- ⚠️ **Working tree ΜΟΙΡΑΖΕΤΑΙ με άλλον agent.** Άγγιξε ΜΟΝΟ τα αρχεία του task. **Ξαναδιάβασε κάθε αρχείο ΠΡΙΝ το edit** (μπορεί να άλλαξε).
- ⚠️ **COMMIT τον κάνει ο Giorgio, ΟΧΙ εσύ.** Ετοίμασε, σταμάτα, ανέφερε. Ποτέ `git commit`/`push`/`--no-verify`.
- ⚠️ **ΟΧΙ `tsc`/typecheck (N.17).** Μόνο targeted jest.
- 🌐 **Απαντάς ΠΑΝΤΑ Ελληνικά.**
- 🏛️ Full enterprise + FULL SSoT + «μεγάλοι παίκτες» (Revit/Figma/AutoCAD). Reuse, μηδέν διπλότυπα.
- 📋 Execution mode: **Plan Mode, single agent** (επιβεβαιωμένο από Giorgio).

---

## 1. ΑΙΤΗΜΑ (λόγια Giorgio)
> Όταν επιλέγω **ορθογώνιο τοίχο** → **8 λαβές** (4 γωνίες + 4 μέσα-πλευράς) + **1 move** + **1 rotation**. Θέλω **τον ΙΔΙΟ ΑΚΡΙΒΩΣ κώδικα** στα **ΚΕΙΜΕΝΑ**: ίδιες λαβές, ίδια resize/move/rotate. **ΜΙΑ πηγή αλήθειας**, όχι διπλότυπο.

UX-στόχος: κείμενο «DDD» στον 2D καμβά → bounding-box με 4 γωνίες + 4 μέσα + move + rotation, Figma/AutoCAD-grade.

---

## 2. ΚΛΕΙΔΩΜΕΝΕΣ ΑΠΟΦΑΣΕΙΣ (από Q&A με Giorgio)
1. **8 λαβές + move + rotation = 10 grips total. ΧΩΡΙΣ mirror** (δεν το ζήτησε).
2. **Resize semantics = πλήρες parity (ανεξάρτητο X/Y)**: δεξιά/αριστερά λαβή → οριζόντιο πλάτος μόνο· πάνω/κάτω → ύψος· γωνία → ομοιόμορφο.
3. **Δουλεύει για ΚΑΙ ΤΑ ΔΥΟ: TEXT + MTEXT.**
   - **MTEXT**: πλάτος = το **πραγματικό** `width` (MTextEntity.width). Μηδέν νέο πεδίο.
   - **TEXT (απλό)**: πλάτος = **νέο `widthFactor`** (AutoCAD TEXT X-scale).
4. **Πυρήνας = κοινός `rect-grip-engine.ts`/`rect-frame.ts`** (ΙΔΙΟΣ κώδικας με τοίχο/κολόνα). ΟΧΙ world-axis ScaleEntityCommand (παραμορφώνει περιστραμμένο κείμενο).
5. **Commit = minimal ΝΕΑ command** που κάνει patch top-level πεδία. **ΟΧΙ** το `UpdateTextGeometryCommand` (έχει κενά — βλ. §4).
6. **Rotation → top-level `rotation`** (αυτό διαβάζει ο renderer), ΟΧΙ `textNode.rotation`.

---

## 3. ΑΡΧΙΤΕΚΤΟΝΙΚΗ — SSoT που ΕΠΑΝΑΧΡΗΣΙΜΟΠΟΙΕΙΤΑΙ (μηδέν διπλότυπο)

**Ο κοινός πυρήνας ορθογώνιου box (entity-agnostic):**
- `bim/grips/rect-frame.ts` → `RectFrame {center, rotationDeg, halfWidth, halfLength}` + readers `rectCornerWorld(frame,corner)`, `rectEdgeWorld(frame,edge)`, `rectLocalWorld(frame,lx,ly)`, σταθερά `RECT_CORNERS`.
- `bim/grips/rect-grip-engine.ts` → `applyRectCornerDrag(frame,corner,worldDelta,limits,ortho?)`, `applyRectEdgeDrag(frame,edge,worldDelta,limits)` (local-axis σωστό, opposite-corner/edge fixed).
- **Πρότυπο adapter:** `bim/columns/column-rect-adapter.ts` (`columnToRectFrame`/`rectFrameToColumnParams`/`rectColumnGrips`/`applyRectColumnGrip`) + `bim/columns/column-grip-utils.ts` (`columnCenterMoveGrip`, `columnRotationHandleMidwayWorld`, rotation handle policy). **Μίμησέ το για το text adapter.**

**Πώς εκπέμπει ο rect-column 10 grips** (= το target σου): `rectColumnGrips` = center-move (gripIndex 0) + rotation (1) + width/depth edges (2,3) + edge-w/edge-s (8,9) + 4 corners (4..7).

---

## 4. ΕΥΡΗΜΑΤΑ AUDIT — η ΑΛΗΘΕΙΑ του μοντέλου κειμένου (code = source of truth)

### 4.1 Τρία type representations (ΔΙΑΦΟΡΕΤΙΚΑ, σε διαφορετικά layers)
- **`DxfText`** (`canvas-v2/dxf-canvas/dxf-types.ts:170`): flat `{position, text, height, rotation?, textStyle?}`. **ΟΧΙ `textNode`, ΟΧΙ `width`. ΔΕΝ υπάρχει `DxfMText` στο `DxfEntityUnion`** (δες `dxf-types.ts:515`). Αυτό είναι το shape στο **render/grip-computation layer**.
- **`TextEntity`/`MTextEntity`** (`types/entities.ts:142,158`): τα **SceneModel entities**. `textNode?` (optional!), top-level `rotation?`, `height?`/`fontSize?`. **MTextEntity έχει REQUIRED `width: number`** (το AutoCAD frame). Εδώ ζει το πραγματικό πλάτος.
- **`DxfTextSceneEntity`** (`core/commands/text/types.ts:20`): command-layer view, `textNode` REQUIRED, `width?` (mtext). Το γράφει το `CreateTextCommand`.

### 4.2 ⚠️ ΓΕΦΥΡΑ ΜΟΝΤΕΛΟΥ (ο κύριος κίνδυνος — ΛΥΣΗ παρακάτω)
Ο converter `hooks/canvas/dxf-scene-entity-converter.ts:179–203` μετατρέπει **ΚΑΙ text ΚΑΙ mtext** σε ΕΝΑ flat `DxfText` τύπου `'text'`, **πετώντας `textNode` + `width`** (σχόλιο γρ.184: «mtext normalised to 'text' because DxfEntityUnion has no mtext variant»).
- Άρα στο `computeDxfEntityGrips` (`hooks/grip-computation.ts:82`, `case 'text':82→201-207`) φτάνει flat `DxfText`: διαθέσιμα `position/height/rotation`, **ΟΧΙ width/textNode**.
- **ΔΕΝ υπάρχει `case 'mtext'`** πουθενά στο grip-computation (grep = 0).
- **ΛΥΣΗ:** πέρασε το effective box-`width` (+ `widthFactor`) στο `DxfText` ΜΕΣΑ στον converter (MTEXT→`e.width`· TEXT→`text.length*height*0.6*widthFactor`), ώστε το emission να διαβάζει `entity.width` άμεσα. Πρόσθεσε `width?`/`widthFactor?` στο `DxfText` type.

### 4.3 ⚠️ `UpdateTextGeometryCommand` ΕΧΕΙ ΚΕΝΑ → ΜΗΝ το χρησιμοποιήσεις ως commit
(`core/commands/text/UpdateTextGeometryCommand.ts`) `GeometryPatch {position?, rotation?, width?}`:
- Γράφει **`textNode.rotation`** (ΟΧΙ top-level `rotation`) — αλλά ο **renderer διαβάζει το flat `rotation`** (converter `:202` διαβάζει `e.rotation`) → **rotation desync**.
- `width` γράφεται μόνο αν υπάρχει `textNode.columns` — αλλιώς **αγνοείται σιωπηλά** (ισχύει για ΟΛΑ τα normal single-column MTEXT + όλα τα TEXT).
- Συμπέρασμα: **όχι καθαρό single commit path.** Γι' αυτό → ΝΕΑ minimal command (top-level fields).

### 4.4 Υπάρχον ΑΣΥΝΔΕΤΟ σύστημα (μην το reuse-άρεις ως math)
`text-engine/interaction/TextGripGeometry.ts` (`computeGrips`) + `TextGripHandler.ts` (`buildPatch`): **μόνο 4 γωνίες + move + rotation + mirror, resize μόνο MTEXT, δική του math (ΟΧΙ rect-engine)**. Δεν είναι συνδεδεμένο (μόνο tests). **ΔΕΝ καλύπτει το αίτημα** (λείπουν τα 4 μέσα-πλευράς + parity). Boy-Scout: σημείωσέ το ως μερικώς αντικαθιστούμενο στο ADR· ΜΗΝ αντιγράψεις τη math του.

### 4.5 `scaleText`/`scaleMText` (`systems/scale/scale-entity-transform.ts:79,87`)
- `scaleMText`: `width*=sx`, `height*=sy` → MTEXT **ήδη** ανεξάρτητο. (Χρήσιμο ως αναφορά mapping, ΟΧΙ ως commit path — world-axis.)
- `scaleText`: μόνο `sy` (αγνοεί `sx`). **Πρόσθεσε** εδώ `widthFactor: (e.widthFactor??1)*Math.abs(sx)` όταν προσθέσεις το πεδίο (για να δουλεύει και το toolbar Scale tool σε TEXT — Boy-Scout consistency).

### 4.6 bbox SSoT
- Font-aware canonical: `text-engine/layout/text-layout-engine.ts:133` `getBoundingBox(node, opts): Rect` (χρειάζεται textNode+Font — βαρύ).
- Approx font-free: `types/entity-bounds.ts:65` (text: `len*height*0.6`), `:75` (mtext: `entity.width`). **Για grip box χρησιμοποίησε flat formula** (text: `len*height*0.6*widthFactor`· mtext: `width`) ώστε να δουλεύει χωρίς Font/textNode — ίδιο που κάνει ήδη το hitTest του `TextRenderer.ts:272`.

---

## 5. PIPELINE — ακριβή seam points (από audit)
- **Emission:** `hooks/grip-computation.ts` `case 'text'` (γρ.201). Πρόσθεσε `textGripKind` grips.
- **Commit dispatcher:** `hooks/grips/grip-commit-adapters.ts` → `commitDxfGripDragModeAware` (γρ.165). Πρόσθεσε `if (grip.textGripKind) { commitTextGripDrag(grip,delta,deps); return; }` ΠΡΙΝ το stretch fallback (μετά τα άλλα parametric branches).
- **Commit impl:** `hooks/grips/grip-parametric-commits.ts` (πρότυπο `commitColumnGripDrag` γρ.338 / centred-box `grip-parametric-centred-box-commits.ts`). Νέα `commitTextGripDrag` → `applyTextGripDrag` + ΝΕΑ minimal command.
- **Ghost preview (ghost===commit):**
  - `hooks/grips/grip-projections.ts` `buildDxfDragPreview` (γρ.101) → spread `textGripKind` (παράλληλα με `columnGripKind` γρ.151-153).
  - `hooks/tools/grip-drag-preview-transform.ts` `toEntityPreviewTransform` → pass-through `textGripKind`.
  - `rendering/ghost/apply-entity-preview.ts` `applyEntityPreview` (γρ.106) → branch `textGripKind && entity.type==='text'` καλώντας την **ΙΔΙΑ** `applyTextGripDrag`.
- **Types:** `hooks/grips/unified-grip-types.ts` (`UnifiedGripInfo` + `DxfGripDragPreview`: πεδίο `textGripKind?`), `hooks/grip-computation-types.ts` (`DxfGripDragPreview`), `rendering/ghost/entity-preview-types.ts` (`EntityPreviewTransform`).
- **GripInfo discriminator:** `hooks/grip-types.ts` (`textGripKind?: TextGripKind` + re-export) + `hooks/grip-kinds.ts` (νέο `TextGripKind` union).

---

## 6. ΧΑΡΤΗΣ ΑΡΧΕΙΩΝ (~14-16, 3 domains)
**A. Grip plumbing/types**
1. `hooks/grip-kinds.ts` — ΝΕΟ `TextGripKind = 'text-move'|'text-rotation'|'text-corner-ne|nw|sw|se'|'text-edge-e|w|n|s'` (mirror column kinds· ΧΩΡΙΣ mirror).
2. `hooks/grip-types.ts` — `textGripKind?` στο `GripInfo` + re-export.
3. `hooks/grip-computation-types.ts` — `textGripKind?` στο `DxfGripDragPreview`.
4. `hooks/grip-computation.ts` — `case 'text'`: emission 10 grips μέσω text adapter.
5. `hooks/canvas/dxf-scene-entity-converter.ts` — πέρασε `width`/`widthFactor` στο `DxfText`.

**B. Text adapter (ΝΕΟ — ο πυρήνας reuse)**
6. `bim/text/text-grips.ts` (ΝΕΟ): `textToRectFrame(dxfText)` (bbox center/half από position+height+width/widthFactor+rotation — προσοχή position=ΠΑΝΩ-ΑΡΙΣΤΕΡΑ, βλ. §7) + `getTextGrips(entity): GripInfo[]` (reuse `rectCornerWorld`/`rectEdgeWorld` + `columnCenterMoveGrip`-style + rotation handle) + `applyTextGripDrag(kind, {entity,delta,currentPos?,ortho,pivot?}): TextTransformPatch` (reuse `applyRectCornerDrag`/`applyRectEdgeDrag` → RectFrame → patch {position,rotation,height,width|widthFactor}).

**C. Commit**
7. `core/commands/text/UpdateTextTransformCommand.ts` (ΝΕΟ minimal· πρότυπο μοτίβο snapshot/patch· top-level fields· drag-merge isDragging· audit). *Πρώτα grep για τυχόν υπάρχον generic top-level patch command για reuse.*
8. `hooks/grips/grip-parametric-commits.ts` — `commitTextGripDrag`.
9. `hooks/grips/grip-commit-adapters.ts` — dispatch branch.

**D. Ghost preview**
10. `hooks/grips/grip-projections.ts`, 11. `hooks/tools/grip-drag-preview-transform.ts`, 12. `rendering/ghost/apply-entity-preview.ts` (+`apply-entity-preview-helpers.ts`), 13. `rendering/ghost/entity-preview-types.ts`, `hooks/grips/unified-grip-types.ts`.

**E. Model/rendering (widthFactor)**
14. `canvas-v2/dxf-canvas/dxf-types.ts` — `DxfText.width?`, `DxfText.widthFactor?`.
15. `types/entities.ts` — `TextEntity.widthFactor?`.
16. `rendering/entities/TextRenderer.ts` ⚠️ guarded — οριζόντιο `ctx.scale(widthFactor,1)` γύρω από origin + pivot περιστροφής (ΜΗΝ αγγίξεις τη rotation/zoom math που προειδοποιεί το header· πρόσθεσε ΜΟΝΟ horizontal scale). Update `hitTest` (γρ.272 `width`) + `getGrips`.
17. `types/entity-bounds.ts` — text bbox με `widthFactor`.
18. `systems/scale/scale-entity-transform.ts` — `scaleText` honors `widthFactor` (§4.5).

**F.** Tests (pure: grip count=10 + positions· `applyTextGripDrag` corner/edge/rotation· widthFactor bounds) + ΝΕΟ **ADR** (επόμενο free number — έλεγξε `adr-index.md`· ΑΠΟΦΥΓΕ 145).

---

## 7. ΓΕΩΜΕΤΡΙΑ — προσοχή
- **`position` του text = ΠΑΝΩ-ΑΡΙΣΤΕΡΑ** (από `entity-bounds`/`hitTest`: `minX=position.x`, `maxX=position.x+width`, `maxY=position.y`, `minY=position.y-height`). Δηλαδή το κείμενο εκτείνεται **δεξιά + προς τα κάτω** (world −y). Το RectFrame.center = `{position.x+width/2, position.y-height/2}` (πριν rotation).
- **Rotation pivot:** ο renderer περιστρέφει γύρω από `screenPos` (=`position`, πάνω-αριστερά), βλ. `TextRenderer.ts:126-128`. Όταν περιστρέφεις από λαβή με κέντρο το bbox-center, **πρέπει να αναπροσαρμόσεις `position`** ώστε το οπτικό κέντρο να μένει σταθερό (mirror του `rotateAroundPivot` της κολόνας). Ή κράτα pivot=position για συνέπεια με τον renderer — **απόφαση υλοποίησης: pivot=bbox-center + re-home position** (Figma-like, αυτό ζήτησε ο Giorgio).
- **widthFactor=1** για υπάρχοντα TEXT (default). `CHAR_WIDTH_MONOSPACE=0.6` (`config/text-rendering-config.ts:836`).

---

## 8. ΣΕΙΡΑ ΥΛΟΠΟΙΗΣΗΣ (μικρά reversible slices)
1. **Foundation** (μηδέν ρίσκο): types+plumbing (#1-3,14,15) + pure `text-grips` adapter (#6) **+ jest tests** (grip count/positions/applyTextGripDrag). ΔΕΝ αγγίζει TextRenderer.
2. **Emission** (#4,5): `case 'text'` 10 grips + converter width carry.
3. **Commit + ghost** (#7-13).
4. **widthFactor render+bounds** (#16-18) ⚠️ guarded TextRenderer — προσεκτικά, browser-verify.
5. **ADR** + handoff update.
Μετά κάθε slice → ανέφερε, ο Giorgio αποφασίζει commit.

---

## 9. ΤΙ ΝΑ ΜΗΝ ΚΑΝΕΙΣ
- ❌ Δεύτερο grip renderer/store — όλα μέσω `computeDxfEntityGrips`+`UnifiedGripRenderer`+`AllGripsStore`.
- ❌ Αντιγραφή rect-grip math — **κάλεσε** `rect-grip-engine`/`rect-frame`.
- ❌ `UpdateTextGeometryCommand` ως commit (κενά §4.3). ❌ world-axis `ScaleEntityCommand` (παραμόρφωση περιστραμμένου).
- ❌ Math του `TextGripHandler` (partial, §4.4).
- ❌ Αλλαγή rotation/zoom math στον `TextRenderer` (μόνο πρόσθεση horizontal scale).
- ❌ mirror grip. ❌ commit/push. ❌ αρχεία εκτός scope (shared tree).

---

## 10. Πρώτη κίνηση νέας συνεδρίας
1. Δήλωσε Opus + προαιρετικά Plan Mode (το πλάνο είναι έτοιμο εδώ).
2. Ξεκίνα Slice 1 (§8). Ξαναδιάβασε κάθε αρχείο πριν edit (shared tree).
3. ΟΧΙ tsc· targeted jest. COMMIT = Giorgio.
