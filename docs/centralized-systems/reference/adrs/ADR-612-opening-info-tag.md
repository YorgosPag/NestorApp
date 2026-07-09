# ADR-612 — Πινακίδα Ανοίγματος (Opening Info Tag)

| Field | Value |
|---|---|
| Status | ✅ **PHASE_1_DONE** — 2026-07-09. Νέος non-BIM annotation entity type `'opening-info-tag'` (sibling του `scale-bar`, ADR-583 Φ2): κουτί 120×80 world-mm, κλειδωμένη αναλογία 3:2, ΜΙΑ διάσταση DOF (`widthMm`), 3 editable αριθμητικά κελιά (Μήκος πάνω πλήρες πλάτος· Ποδιά/Ύψος κάτω 60/60 split), single-click τοποθέτηση, inline επεξεργασία τιμών από τον χρήστη (χειροκίνητα, ΟΧΙ auto-derive από BIM άνοιγμα σε v1). |
| Date | 2026-07-09 |
| Owner | Giorgio / Claude (Opus 4.8) |
| Related | **ADR-583** (Annotation Symbol Library + Γραφική Κλίμακα — sibling scene-entity pattern που ακολουθείται εδώ)· **ADR-376** (Opening Tags — Mark pill, ΔΙΑΦΟΡΕΤΙΚΟ entity, βλ. §6)· **ADR-362** (dimension pill / canvas-pill SSoT, lightweight non-BIM template)· **ADR-397** (`appendEntityToScene` SSoT)· **ADR-040** (canvas micro-leaf architecture)· **ADR-550** (renderable-entity-type contract)· **ADR-557** (render vs scene converter parity)· **ADR-017/210/294** (enterprise IDs N.6) |

---

## 1. Context — τι ζήτησε ο Giorgio

Ο 2D καμβάς είχε ήδη το **Opening Tag** (ADR-376 — Mark pill: `Θ.01`, `Π.02`, ...) που ταυτοποιεί ΠΟΙΟ άνοιγμα είναι. Αυτό ΔΕΝ δείχνει **διαστάσεις**. Ζητήθηκε μια **δεύτερη, ανεξάρτητη annotation**: μια «πινακίδα ανοίγματος» — ένα μικρό ορθογώνιο πλαίσιο με 3 αριθμητικά πεδία (Μήκος πάνω, Ποδιά+Ύψος κάτω) που ο μηχανικός τοποθετεί με ένα κλικ δίπλα σε ένα άνοιγμα και συμπληρώνει χειροκίνητα τις τιμές — ίδιο πνεύμα με τη «Γραφική Κλίμακα» (ADR-583 Φ2): νέο, ανεξάρτητο, world-scaled scene entity, ΟΧΙ επέκταση υπάρχοντος pill/glyph family.

---

## 2. Σχήμα — ASCII diagram

Κουτί **120×80 mm** (world units, 3:2 locked aspect). Μονή διάσταση ελευθερίας: `widthMm` (120 default) — το `heightMm` παράγεται πάντα ως `widthMm × (2/3)`.

```
┌──────────────────────────────┐
│                               │
│        Μήκος (Length)        │  ← πάνω κελί, πλήρες πλάτος (120×~26.7)
│                               │
├───────────────┬───────────────┤
│                │                │
│  Ποδιά (Sill)  │ Ύψος (Height)  │  ← κάτω 2 κελιά, 60|60 split (60×~53.3 έκαστο)
│                │                │
└───────────────┴───────────────┘
        60mm            60mm
◄──────────────120mm──────────────►
```

- **Πάνω κελί** (πλήρες πλάτος `widthMm`, ύψος `heightMm/3`): **Μήκος** — το οριζόντιο άνοιγμα.
- **Κάτω-αριστερό κελί** (`widthMm/2`, `heightMm × 2/3`): **Ποδιά** — ύψος περβαζιού/στηθαίου από το δάπεδο.
- **Κάτω-δεξί κελί** (`widthMm/2`, `heightMm × 2/3`): **Ύψος** — καθαρό ύψος ανοίγματος.

Κάθε κελί = ένα αριθμητικό, inline-επεξεργάσιμο πεδίο (χωρίς μονάδα μέτρησης εμφανιζόμενη μέσα στο κελί — mm/cm/m sync με το drawing unit setting, όπως τα dimension labels).

---

## 3. Decisions

### D1 — Ξεχωριστός scene-entity type `'opening-info-tag'`, sibling του `scale-bar`

**ΟΧΙ** επέκταση του ADR-376 Mark pill (`OpeningTagRenderer`) — εκείνο είναι ταυτοποίηση 1 τιμής (`Θ.01`), δεμένο 1-προς-1 με ένα `Opening` entity μέσω `OpeningParams.mark`, auto-numbered, non-editable-shape. **ΟΧΙ** μέλος της ADR-583 `annotation-symbol` family (fixed-ratio **point-glyph**, καμία εσωτερική επεξεργάσιμη τιμή/κελί) — η πινακίδα έχει **3 ανεξάρτητα δυναμικά αριθμητικά πεδία** εσωτερικά, όχι static γεωμετρία γύρω από insertion point.

Πιο κοντινό προηγούμενο: **`scale-bar`** (ADR-583 Φ2, `types/scale-bar.ts`) — και τα δύο είναι **ελεύθερα (freestanding), non-BIM, world-scaled, single-click-placed** annotation entities με δικό τους renderer/geometry module, ΟΧΙ δεμένα σε BIM element. Η πινακίδα ακολουθεί το ίδιο μοτίβο 1-προς-1 (types → primitives → geometry → renderer → tool → grips → i18n), με τη διαφορά ότι το «περιεχόμενο» είναι 3 editable αριθμοί αντί για tick-marks.

`OpeningInfoTagEntity extends BaseEntity { type:'opening-info-tag'; position; rotation; widthMm; lengthValue; sillValue; heightValue }` — plain `BaseEntity` (πρότυπο `CenterMarkEntity`/`ScaleBarEntity`), **ΟΧΙ** `BimEntity`. Χωρίς IFC export, 3D mesh, per-floor Firestore collection. Ρέει στο generic scene entities array + `.scene.json` snapshot.

### D2 — WORLD units (annotative-free), single sizing DOF `widthMm`, locked 3:2 aspect

Σε αντίθεση με τα ADR-583 annotation symbols (annotative, paper-mm × drawingScale), η πινακίδα ανοίγματος κλιμακώνεται σε **world units** — μεγαλώνει/μικραίνει με το zoom μαζί με το ίδιο το άνοιγμα που περιγράφει (φυσικό μέγεθος 120×80mm στο σχέδιο, σαν μικρό block δίπλα στο κούφωμα). `heightMm = widthMm × (2/3)` πάντα — **μία** μόνο διάσταση ελευθερίας (`widthMm`) ώστε το πλαίσιο να μη «σακουλιάζει» σε λάθος αναλογία. Grip-resize (μελλοντικό) θα αλλάζει μόνο το `widthMm`, mirror του `scale-bar-length` uniform-DOF pattern.

### D3 — 3 αριθμοί εισάγονται ΧΕΙΡΟΚΙΝΗΤΑ (v1) — όχι auto-derive από BIM άνοιγμα

v1 δεν διαβάζει `OpeningParams.width/height/sillHeight` από γειτονικό BIM opening· ο μηχανικός γράφει τις τιμές inline. Λόγος: αποσύνδεση από συγκεκριμένο opening επιτρέπει ελεύθερη τοποθέτηση (π.χ. σε καθαρά 2D σχέδια χωρίς BIM openings, ή σε λεπτομέρειες/τομές όπου το «άνοιγμα» δεν έχει αντίστοιχο scene entity). **Follow-on (μελλοντική φάση, ΕΚΤΟΣ v1 scope):** προαιρετικό «binding» σε επιλεγμένο `Opening` entity → auto-fill + live-sync των 3 τιμών, με δυνατότητα manual override.

### D4 — Single-click placement

Ίδιο μοτίβο με τα ADR-583 point-glyph σύμβολα (Βορράς, section-mark, κ.λπ.): ένα κλικ στον καμβά τοποθετεί το κουτί στο default μέγεθος (120×80mm) με τις 3 τιμές αρχικά κενές/μηδενικές, έτοιμες για inline edit. **ΟΧΙ** 2-click όπως το scale-bar (δεν χρειάζεται άξονας/κατεύθυνση — το κουτί είναι πάντα axis-aligned στο rotation του entity, default 0°).

---

## 4. Architecture — πρωτογενή modules + registration points

### 4.1 Πρωτογενή νέα modules (SSoT, mirror scale-bar)

| Module | Ρόλος |
|---|---|
| `bim/opening-info-tag/opening-info-tag-primitives.ts` | Frame-space γεωμετρία primitives — τα 3 κελιά (πάνω πλήρες πλάτος, κάτω 60/60 split) ως unit-space ορθογώνια + διαχωριστικές γραμμές, βάσει `widthMm`/`heightMm` (2:3 aspect). |
| `bim/opening-info-tag/opening-info-tag-geometry.ts` | World-space υπολογισμός: `computeOpeningInfoTagGeometry(entity)` → box corners + 3 cell rects σε world coordinates (position + rotation + widthMm/heightMm derived). |
| `rendering/entities/OpeningInfoTagRenderer.ts` | `extends BaseEntityRenderer` — σχεδιάζει το πλαίσιο + 2 διαχωριστικές γραμμές + τις 3 τρέχουσες τιμές ως κείμενο (reuse text-stamping pattern από `AnnotationSymbolRenderer`/dimension labels). |
| Inline editor (νέο hook/component, mirror υπάρχον inline-edit pattern π.χ. dimension override ή mark editor ADR-376) | Click-to-edit σε κάθε κελί → μικρό input overlay πάνω στο κελί, commit → `UpdateEntityCommand` patch στο αντίστοιχο πεδίο (`lengthValue`/`sillValue`/`heightValue`). |

### 4.2 Registration points (mirror scale-bar/annotation-symbol 10-render + 3-selection pipeline, ADR-583 §3.6)

Ομαδοποιημένα κατά concern (~30 αρχεία σύνολο, ΠΛΗΡΗΣ vertical slice):

**Types / union (5):**
`types/opening-info-tag.ts` (νέο — entity + guard `isOpeningInfoTagEntity`, πρότυπο `types/scale-bar.ts`) · `types/base-entity.ts` (EntityType literal) · `types/entities.ts` (union + guard re-export, **ΟΧΙ** `isBimEntityType`) · `types/dxf-export.types.ts` (`ENTITY_TYPE_MAPPING` → null/skip v1) · `types/entity-bounds.ts`.

**Render pipeline (6):**
`canvas-v2/dxf-canvas/dxf-types.ts` (`DxfOpeningInfoTag` variant) · `hooks/canvas/dxf-scene-entity-converter.ts` (case, αλλιώς `default→null`=αόρατο) · `canvas-v2/dxf-canvas/dxf-renderer-entity-model.ts` (exhaustive `never`-guard case) · `rendering/core/EntityRendererComposite.ts` (register `OpeningInfoTagRenderer`) · `rendering/contract/renderable-entity-type.ts` (`DXF_RENDERABLE_TYPES`, 2D-only) · `rendering/entities/entity-render-contract.ts`.

**Hit-test / bounds (4):**
`services/hit-test-entity-model.ts` (converter passthrough, ΟΧΙ γδύνει params) · `rendering/hitTesting/Bounds.ts` (`calculateEntityBounds` case — bbox από τα 3 κελιά) · `rendering/hitTesting/hit-test-entity-tests.ts` (precise hit — point-in-rect στο rotated box) · `entity-bounds-ssot.ts` (marquee-select provider).

**Placement tool (5):**
`ui/toolbar/types.ts` (`ToolType` literal `'opening-info-tag'`) · `systems/tools/tool-definitions.ts` (`TOOL_INFO` entry + `TOOL_CREATES_ENTITY['opening-info-tag']='opening-info-tag'`) · `hooks/canvas/canvas-click-tool-handlers.ts` (`handleOpeningInfoTagClick` → single-click `completeEntity` με default `widthMm=120`) · `hooks/canvas/useCanvasClickHandler.ts` (route) · `systems/command-line/CommandAliasRegistry.ts` (alias, π.χ. `OINFO`/`OIT`).

**Grips (2, v1 minimal):**
`hooks/grip-computation.ts` (case — move + rotation μόνο v1, mirror annotation-symbol Φ2c πριν τις corner-λαβές) · `bim/opening-info-tag/opening-info-tag-grips.ts` (νέο — move+rotation adapter, πρότυπο `annotation-symbol-grips.ts`).

**Inline editor (2-3):**
Νέο editor module/hook (§4.1) · click-dispatch wiring ώστε κλικ πάνω σε κελί επιλεγμένης πινακίδας (ΟΧΙ σε νέο placement) να ανοίγει το inline input αντί να ξεκινά νέο drag.

**Ribbon / UI (4):**
Ribbon button σε panel «Σύμβολα»/Annotate (mirror `insert-tab.ts` όπου μπήκαν τα ADR-583 σύμβολα) · `RibbonButtonIcon.tsx` (νέο icon case) · `app/ribbon-contextual-config.ts` (προαιρετικό contextual trigger, follow-on) · command-keys αν χρειαστεί dual-mode bridge.

**i18n (2 — DONE στο Φ1, βλ. §5):**
`i18n/locales/el/dxf-viewer-shell.json` (`ribbon.commands.openingInfoTag`+Tooltip) · `i18n/locales/en/dxf-viewer-shell.json` (ίδιο) · `i18n/locales/el/dxf-viewer.json` (`opening.infoTag.entityName`+`editorPlaceholder`) · `i18n/locales/en/dxf-viewer.json` (ίδιο).

**Coverage/tests golden pins (πολλαπλά):**
`render-coverage`/`tool-creates-entity-coverage`/`resolve-tool-active-trigger` κ.λπ. suites που loop-άρουν όλα τα entity types θα χρειαστούν το νέο type προστεθειμένο (mirror κάθε προηγούμενο νέο entity σε αυτό το repo).

---

## 5. Φ1 scope (2026-07-09) — τι κλείδωσε τώρα

Αυτό το ADR (Φ1 = **recognition + i18n keys**) καθορίζει την αρχιτεκτονική (D1–D4) και προσθέτει τα βασικά i18n κλειδιά ώστε το follow-on implementation vertical slice (§4.2) να έχει labels/tooltips έτοιμα:

- `ribbon.commands.openingInfoTag` = "Πινακίδα Ανοίγματος" / "Opening Info Tag"
- `ribbon.commands.openingInfoTagTooltip` = "Τοποθέτηση πινακίδας ανοίγματος με ένα κλικ (Μήκος/Ποδιά/Ύψος)" / "Place an opening info tag with a single click (Length/Sill/Height)"
- `opening.infoTag.entityName` = "Πινακίδα Ανοίγματος" / "Opening Info Tag"
- `opening.infoTag.editorPlaceholder` = "" (κενό — N.11 επιτρέπει μόνο κενό `defaultValue`)

**Εκκρεμεί (Φ2, implementation):** όλα τα modules/registration points του §4.

---

## 6. Σχέση με ADR-376 (Opening Tag Mark pill) και ADR-583 (scale-bar sibling pattern)

| | ADR-376 Opening Tag (Mark pill) | ADR-612 Opening Info Tag (ΝΕΟ) |
|---|---|---|
| Σκοπός | **Ταυτοποίηση** — ποιο άνοιγμα (`Θ.01`) | **Διαστάσεις** — πόσο μεγάλο (Μήκος/Ποδιά/Ύψος) |
| Σχέση με `Opening` entity | 1-προς-1 δεμένο, `OpeningParams.mark`, auto-numbered | Ελεύθερο/ανεξάρτητο (v1), χειροκίνητες τιμές |
| Σχήμα | Pill (στρογγυλεμένο ορθογώνιο), `canvas-pill` SSoT | Ορθογώνιο 3-κελιών, 120×80mm 3:2 |
| Sizing | Screen-constant px (σαν UI chrome) | **World units** (annotative-free, world-scaled) |
| Επεξεργάσιμο περιεχόμενο | Ένα string (`mark`), override μέσω ribbon | 3 ανεξάρτητα αριθμητικά πεδία, inline edit |
| Entity type | Δεν είναι δικό του entity — attribute πάνω στο `Opening` | Δικό του scene entity `type:'opening-info-tag'` |

Τα δύο **συνυπάρχουν, δεν αλληλοεπικαλύπτονται** — ένα άνοιγμα μπορεί να έχει ΚΑΙ Mark pill (ταυτότητα) ΚΑΙ, προαιρετικά δίπλα, μια Opening Info Tag (διαστάσεις), όπως σε πραγματικά αρχιτεκτονικά σχέδια.

Η αρχιτεκτονική μοτίβο (νέος sibling scene-entity type, world/annotative sizing decision, single-click ή multi-click placement, ξεχωριστός primitives/geometry/renderer module ανά kind, ίδιο 10-render+3-selection registration checklist) είναι **ρητά δανεισμένη από το ADR-583 §3–5** (Βορράς + Γραφική Κλίμακα) — βλ. εκεί για το πλήρες τεκμηριωμένο pipeline και τις παγίδες (§3.5 screen-space vs annotative confusion, §3.6 EntityModel vs scene = 2 converters).

---

## 7. Consequences

- ✅ Καθαρός διαχωρισμός από το Mark pill (ταυτότητα) — καμία σύγχυση ρόλων.
- ✅ Μέγιστη επαναχρήση αρχιτεκτονικού μοτίβου από scale-bar/annotation-symbol (ελάχιστος νέος «σχεδιαστικός» κώδικας, μόνο τα 3-κελιά primitives + inline editor είναι πραγματικά νέα).
- ⚠️ v1 δεν κάνει auto-derive/binding από BIM opening — χειροκίνητη συμπλήρωση τιμών (follow-on αν ζητηθεί).
- ✅ Grips (Φ2, wall-parity): MOVE (κέντρο, 4-arrow) + ROTATION (μέση πάνω μεγάλης ακμής, ON-edge) + 4 γωνιακές SIZE λαβές (locked 3:2, resize γύρω από το κέντρο). ΚΑΜΙΑ λαβή στη μέση ακμής (Giorgio 2026-07-09).
- ⚠️ DXF export v1: `null` mapping (skip) — native block export = follow-on.

---

## 8. Changelog

| Ημ/νία | Model | Αλλαγή |
|---|---|---|
| 2026-07-09 | Opus 4.8 | **Φ1 — recognition + αρχιτεκτονική απόφαση (D1–D4) + i18n keys.** Νέος entity type `'opening-info-tag'` (sibling `scale-bar`, ADR-583). ADR δημιουργήθηκε: σχήμα (120×80, 3:2, 3 κελιά), world-unit sizing μία DOF (`widthMm`), χειροκίνητες τιμές v1, single-click placement, πλήρες registration checklist (~30 αρχεία, §4.2). i18n: `ribbon.commands.openingInfoTag`(+Tooltip) σε `dxf-viewer-shell.json` el/en· `opening.infoTag.entityName`+`editorPlaceholder` σε `dxf-viewer.json` el/en. **Εκκρεμεί Φ2**: πλήρες implementation vertical slice (types/primitives/geometry/renderer/tool/grips/editor/tests). |
| 2026-07-09 | Opus 4.8 | **Φ3 — wall-parity interaction (hot-grip rotate + move/resize traces).** Η λαβή περιστροφής opt-in στη shared **click-armed hot-grip rotate flow** (mirror `scale-bar-rotation`, Giorgio «όπως ο τοίχος»): `+'opening-info-tag-rotation':'rotate'` στο `HOT_GRIP_OP_REGISTRY` (`wall-hot-grip-fsm.ts`)· `applyOpeningInfoTagGripDrag` πήρε optional `rotate?:{pivot,anchor}` → orbit περί picked centre (`sweptAngleDegAboutPivot`+`rotatePoint`)· commit (`grip-opening-info-tag-commit.ts`) + ghost (`apply-entity-preview.ts`) διαβάζουν `BimRotateHotGripStore`. **Axis-ghost πλήρης ταύτιση με πλευρές**: `+opening-info-tag` branch στο `move-glyph-frame.ts` (reads `angleRad`) → `resolveRotateReferenceAnchor` coaxial με τις ακμές (+ move-glyph arrow rotation). **Move→κυανές clearance dims**: `+opening-info-tag`→`worldCorners` στο `entity-footprint-for-dims.ts`. **Resize→λευκές side dims**: `+opening-info-tag-size` branch στο `grip-ghost-preview-hud-helpers.ts` (4 ακμές, `paintWallHud`). 100% reuse, μηδέν νέα γεωμετρία· 158 tests πράσινα· jscpd καθαρό. |
| 2026-07-09 | Opus 4.8 | **Φ2 — wall-parity grips + default cell text.** Grips ξαναδιαμορφώθηκαν (`opening-info-tag-grips.ts`) σε στυλ τοίχου (Giorgio): ROTATION handle μεταφέρθηκε από offset-outward (`halfHeight·1.5`) → **ON τη μέση της πάνω μεγάλης ακμής** (`v = halfHeight`)· η μονή γωνιακή SIZE λαβή → **4 γωνιακές** SIZE λαβές (ίδιο `-size` kind → ίδιος `applyOpeningInfoTagGripDrag`, resize γύρω από το κέντρο, 3:2 lock)· MOVE cross παραμένει στο κέντρο. ΚΑΜΙΑ mid-edge λαβή. `DEFAULT_OPENING_INFO_TAG_TEXT` `''` → **`'0.00'`** (κεντραρισμένο, editable, scale-άρει με resize μέσω world-unit `textHeightMm`). Kind-based commit/ghost → μηδέν αλλαγή σε dispatch/coverage type-lists. |
