# ADR-583 — Βιβλιοθήκη Συμβόλων Σχεδίασης (Annotation Symbol Library — Βορράς / Κλίμακα / Σήμα Τομής)

| Field | Value |
|---|---|
| Status | ✅ **Φ1 + Φ2a + Φ2b + Φ2c + contextual tab DONE** — 2026-07-08, Opus 4.8. Ο Βορράς **αποδίδεται, τοποθετείται (ένα κλικ), επιλέγεται/hit-testάρεται, έχει interactive grips (move+rotation με live ghost), ΚΑΙ contextual tab (picker στυλ/μέγεθος/γωνία)**. Φ2b: `AnnotationSymbolRenderer` + converters + composite/contract register + bounds + hit-test + tool `north-arrow` + ribbon + i18n + NORTH/NA aliases + selection store. Φ2c grips (lightweight ADR-561 path): move→`calculateMovedGeometry` case, rotation→`RotateEntityCommand`→`rotateEntity` case· κοινό commit helper με arc (N.18)· hot-grip FSM + glyph registry + live rotation ghost. Contextual tab («Σύμβολο Βορρά», trigger `north-arrow`): command-keys + bridge (`useRibbonAnnotationSymbolBridge`→selection store) + tab data (3 comboboxes) + composer wiring (`useDxfBimBridges`/`useRibbonCommands`) + trigger (`ribbon-contextual-config`) + i18n el+en. Follow-on kinds (scale-bar/section-mark) = γρήγορα, το catalog architecture έτοιμο. Βορράς = reference kind. |
| Date | 2026-07-08 |
| Owner | Giorgio / Claude (Opus 4.8) |
| Related | **ADR-362** (center-mark — lightweight non-BIM annotation, το βασικό template)· **ADR-415** (floorplan-symbol — pipeline tool/ribbon precedent)· **ADR-344/375** (annotation-scale SSoT `paperHeightToModel`)· **ADR-406** (pure-vector 2D symbol)· **ADR-397** (`appendEntityToScene` SSoT)· **ADR-040** (canvas micro-leaf)· **ADR-550** (renderable-entity-type contract)· **ADR-017/210/294** (enterprise IDs N.6)· **ADR-557** (render vs scene converter parity) |

---

## 1. Context — τι ζήτησε ο Giorgio

> «Ένας μηχανικός όταν σχεδιάζει σε αρχιτεκτονικό σχέδιο, θέλει να έχει και μια **βιβλιοθήκη σημάτων** π.χ. τον **Βορρά**. Εμείς τέτοια βιβλιοθήκη δεν έχουμε. Ψάξε στο διαδίκτυο τι βάζουν σε μια τέτοια βιβλιοθήκη οι μεγάλοι παίκτες και πώς ακριβώς το κάνουν.»

Ζητούμενο = διαδικτυακή έρευνα (τι/πώς) → ADR → υλοποίηση.

---

## 2. Έρευνα στο διαδίκτυο — τι βάζουν & πώς το κάνουν οι μεγάλοι παίκτες

Πηγές: US National CAD Standard (UDS Module 6 — Symbols), Autodesk (AutoCAD/Civil 3D dynamic north arrows, annotative blocks), Revit annotation families, ArchBlocks, Architizer (114 CAD symbols).

### 2.1 ΤΙ βάζουν — «annotation symbols», ξεχωριστή κατηγορία από τα δομικά στοιχεία

| Κατηγορία | Σύμβολα |
|---|---|
| **Προσανατολισμός / Κλίμακα** | Βορράς (πολλά στυλ), γραμμική κλίμακα (scale bar), datum/benchmark point |
| **Αναφορές φύλλων** | Section marks (σήμα τομής), elevation callouts, detail callouts/bubbles, level/spot elevation, grid bubbles (άξονες), break lines, match lines, revision clouds/tags, key plan |
| **Tags** | door/window/room tags (report δεδομένων μοντέλου) |

**Κρίσιμο συμπέρασμα:** «βιβλιοθήκη σημάτων» = **annotation symbols**, εννοιολογικά ξεχωριστά από τα building elements (πόρτες/παράθυρα/έπιπλα, που τα έχουμε ήδη ως BIM entities).

### 2.2 ΠΩΣ το κάνουν — 5 τεχνικά χαρακτηριστικά

1. **Annotative (κλίμακο-ανεξάρτητα ως προς το χαρτί).** Σχεδιάζονται στο μέγεθος που θα **τυπωθεί** (π.χ. 10mm), και κλιμακώνονται αυτόματα με την κλίμακα σχεδίου 1:N. Revit: annotation families «fixed size related to printing». AutoCAD: annotative blocks.
2. **Παραμετρικά blocks/families, όχι flat γεωμετρία.** AutoCAD dynamic block (Rotation + Scale + visibility states). Revit Generic Annotation family (2D, δεν διαβάζει μοντέλο).
3. **Ο Βορράς περιστρέφεται.** Civil 3D dynamic north arrow «κουμπώνει» στο viewport → auto-rotate σε True/Project North.
4. **Τυποποίηση κατά standard.** NCS UDS Module 6: κάθε σύμβολο = μοναδικό ID (MasterFormat + 3ψήφια κατάληξη) + προκαθορισμένη γραφική.
5. **Οργάνωση σε categories με preview.** Design Center / ArchBlocks: drag-drop από catalog με θυμβίες.

---

## 3. Έρευνα στην εφαρμογή — τι υπάρχει ήδη (8 parallel readers, 2026-07-08)

### 3.1 Δεν υπάρχει κανένα north-arrow / annotation-symbol (greenfield)

Εξαντλητικό grep (`north`, `NorthArrow`, `annotation symbol`, `sectionMark`) → **μηδέν hits** ως annotation symbol. Υπάρχει ένα άσχετο text-template `scale-bar` (κείμενο `{{drawing.scale}}`, ΟΧΙ γραφικό) και ένα άσχετο structural `axis-cut-line-renderer` (cut-plane, ΟΧΙ section-mark annotation) — **false friends**, να μη συγχέονται.

### 3.2 Δύο πρότυπα βάρους για νέο entity type

| Πρότυπο | Παράδειγμα | Βάρος | IFC/3D/Firestore |
|---|---|---|---|
| **Lightweight** ✅ | `CenterMarkEntity` (ADR-362, `types/center-mark.ts`) — plain `extends BaseEntity` | ~15 αρχεία | **Κανένα** — ρέει στο generic scene array |
| Heavy | `FloorplanSymbolEntity` (ADR-415) — `extends BimEntity` + `IfcEntityMixin` | ~25–98 αρχεία | Per-floor Firestore collection, IFC export, isolate-by-BimCategory, 3D mesh |

### 3.3 Annotative sizing SSoT ήδη υπάρχει (dimensions)

`utils/annotation-scale.ts` → `paperHeightToModel(paperMm, drawingScale, units)` + `resolveEffectiveDimscale(rawDimscale, drawingScale)`. Το χρησιμοποιούν αυτούσιο **και** το μέγεθος βέλους (`dimasz`) **και** το ύψος κειμένου (`dimtxt`) στα dimensions, unit-system-independent (mm/cm/m → ίδιο φυσικό μέγεθος). Ρέει από το View-ribbon `drawingScale` (1:N, `state/drawing-scale-store.ts`).

### 3.4 Catalog διανυσματικών glyphs SSoT — το κοντινότερο ανάλογο

`systems/dimensions/dim-arrowhead-blocks.ts` → `ARROWHEAD_BLOCKS: Readonly<Record<string, ArrowheadBlockDefinition>>` (17 AutoCAD blocks). Κάθε def = **unit-space** γεωμετρία (apex στο [0,0], 1.0 = 1×dimasz) από πρωτογενή `ArrowheadPrimitive` (line/triangle/circle). Stamping loop `renderArrowhead(ctx, block, {anchor, direction, unitPx, ...})` (translate→rotate→scale→stamp, `lineWidth=1/unitPx`) — **γενικός oriented-glyph stamper, όχι dimension-specific**.

### 3.5 Screen-space vs annotative — προσοχή στη σύγχυση

- **Grips/rulers/rotation-pivot** = screen-constant (σταθερά px, ΔΕΝ ×`transform.scale`). SSoT pattern: `CoordinateTransforms.worldToScreen` μία φορά + raw px. Παράδειγμα: `rendering/ui/rotation-pivot-marker.ts`.
- **Dimensions/κείμενο/βέλη** = annotative world-anchored (paper-mm × drawingScale × `transform.scale`) → μεγαλώνουν με zoom, σταθερά ως προς το χαρτί.
- ⚠️ `rendering/entities/annotative-resolver.ts` = **παγίδα** (DXF annotative TEXT height, ΟΧΙ screen-constant).

### 3.6 Pipeline εγγραφής νέου type — checklist 10 render + 3 selection

Επιβεβαιωμένο live path (ΟΧΙ το dead `EntityPass.ts`/`OverlayPass.ts`):
`Entity[]` → `dxf-scene-entity-converter.convertEntity()` (case υποχρεωτικό, αλλιώς `default→null` = αόρατο) → `DxfEntityUnion` → `DxfRenderer` → `dxf-renderer-entity-model.buildEntityModelFromDxf()` (exhaustive `never` guard) → `EntityRendererComposite.render()` (`renderers.get(type)`).

### 3.7 Grips SSoT

`bim/grips/rect-frame.ts` + `rect-grip-engine.ts` → `centred-box-grips.ts` (centre-anchored move+rotation[+corners], το χρησιμοποιούν 8 entities). Adapter ~40 γραμμές (πρότυπο `floorplan-symbol-grips.ts`). Rotation-handle placement: `rotation-handle-policy.ts`. Η **ίδια** `getXGrips()` καλείται και από τον renderer και από `hooks/grip-computation.ts` — να μην αποκλίνουν.

### 3.8 Tool/Ribbon/i18n pipeline

Πρότυπο floorplan-symbol: `ToolType` union (`ui/toolbar/types.ts`) → `TOOL_DEFINITIONS` → tool hook + `createToolBridgeStore` → click dispatch (`canvas-click-*-dispatch.ts`) → ribbon button (commandKey === ToolType) + `RibbonButtonIcon` case + contextual tab + `app/ribbon-contextual-config.ts` trigger → i18n keys σε **el + en** (N.11, μηδέν hardcoded).

---

## 4. Decision — αρχιτεκτονική επιλογή (enterprise, Revit-grade)

### D1 — Lightweight **non-BIM** annotation entity `'annotation-symbol'`

Μοντέλο στο `CenterMarkEntity` (plain `BaseEntity`), **ΟΧΙ** `BimEntity`. Λόγος: ο Βορράς / η κλίμακα / το σήμα τομής είναι **σχεδιαστική σημείωση (paper decoration)**, όχι δομικό στοιχείο. **Χωρίς** IFC export, 3D mesh, isolate-by-BimCategory, ξεχωριστό per-floor Firestore collection. Ρέει στο generic scene entities array + `.scene.json` snapshot, όπως center-mark/dimension/text. → ΔΕΝ προστίθεται στο `isBimEntityType`.

### D2 — Sizing **annotative** (paper-mm × drawingScale), reuse `annotation-scale.ts`

Reuse αυτούσιο `paperHeightToModel` + `resolveEffectiveDimscale`, όπως τα dimension βέλη/κείμενο. Ταιριάζει με AutoCAD annotative blocks (§2.2#1): σταθερό **μέγεθος χαρτιού** ανά κλίμακα 1:N, μεγαλώνει/μικραίνει με zoom μαζί με το υπόλοιπο σχέδιο. **ΟΧΙ** screen-constant px (αυτό είναι για UI chrome). Δίνει σωστό WYSIWYG plot.

### D3 — Ένα entity type με `kind` discriminator + `symbolId` → catalog

`AnnotationSymbolEntity { type:'annotation-symbol'; position; rotation; kind; symbolId; sizeMm }`. Ένα type καλύπτει όλα τα kinds (`'north-arrow' | 'scale-bar' | 'section-mark'`), επεκτάσιμο.

### D4 — Catalog SSoT modeled στο `dim-arrowhead-blocks.ts`

`config/annotation-symbol-catalog.ts` → `Readonly<Record<string, AnnotationSymbolDefinition>>`. Κάθε def: `{ id, kind, labelKey (i18n), geometry: unit-space primitives (line/polyline/arc/triangle/text), origin }`. Resolver `getAnnotationSymbol(id)` + `listAnnotationSymbols(kind)`. Ribbon options **generated** από catalog. Static ids (camelCase, π.χ. `northArrowSimple`, `northArrowStar`), **ΟΧΙ** enterprise-id (τα enterprise-ids είναι μόνο για persisted Firestore docs).

### D5 — Grips: **move + rotation μόνο** (χωρίς resize)

Τα σύμβολα έχουν σταθερή αναλογία → όχι corner/edge resize. Adapter πάνω στο `centred-box-grips.ts` φιλτραρισμένο σε move+rotation. Rotation-handle από `rotation-handle-policy.ts`. Το μέγεθος αλλάζει από το contextual tab (`sizeMm`), όχι από grip-drag.

### D6 — Tool/Ribbon: mirror του floorplan-symbol pipeline

Single-click placement + rotation preview. Ribbon button σε panel «Σημειώσεις»/Annotate (grep για υπάρχον annotation panel πριν νέο). Contextual tab: επιλογή kind/variant + μέγεθος + γωνία. i18n el+en.

### Scope v1

**Βορράς** ως reference kind (2–3 variants), με το catalog architecture έτοιμο για scale-bar + section-mark ως γρήγορα follow-ons.

---

## 5. Implementation plan — αρχεία

**Νέα αρχεία:**
1. `types/annotation-symbol.ts` — `AnnotationSymbolEntity`, `AnnotationSymbolKind`, guard `isAnnotationSymbolEntity` (πρότυπο `center-mark.ts`).
2. `config/annotation-symbol-catalog.ts` — catalog SSoT (πρότυπο `dim-arrowhead-blocks.ts`).
3. `rendering/entities/AnnotationSymbolRenderer.ts` — `extends BaseEntityRenderer` (reuse annotation-scale + arrowhead stamping pattern).
4. `bim/annotation-symbols/annotation-symbol-grips.ts` — move+rotation adapter.
5. `hooks/drawing/useAnnotationSymbolTool.ts` — placement state machine.
6. `ui/ribbon/hooks/bridge/annotation-symbol-tool-bridge-store.ts` + bridge hook + command-keys.
7. `ui/ribbon/data/contextual-annotation-symbol-tab.ts`.

**Επεξεργασία (registration points):**
`types/base-entity.ts` (EntityType) · `types/entities.ts` (union + guard, **ΟΧΙ** isBimEntityType) · `types/dxf-export.types.ts` (ENTITY_TYPE_MAPPING → null/INSERT) · `types/entity-bounds.ts` · `canvas-v2/dxf-canvas/dxf-types.ts` (DxfAnnotationSymbol) · `hooks/canvas/dxf-scene-entity-converter.ts` · `canvas-v2/dxf-canvas/dxf-renderer-entity-model.ts` · `rendering/core/EntityRendererComposite.ts` · `rendering/contract/renderable-entity-type.ts` (DXF_RENDERABLE_TYPES) · `services/hit-test-entity-model.ts` · `rendering/hitTesting/Bounds.ts` · `rendering/hitTesting/hit-test-entity-tests.ts` · `hooks/grip-computation.ts` · `ui/toolbar/types.ts` + `systems/tools/tool-definitions.ts` · click dispatch · ribbon button + `RibbonButtonIcon` + `ribbon-contextual-config` · `i18n/locales/{el,en}/dxf-viewer-shell.json` · `systems/command-line/CommandAliasRegistry.ts` (NORTH alias).

---

## 6. Consequences

- ✅ Σωστή σημασιολογία: annotation ≠ building element (καθαρό BIM/IFC domain).
- ✅ Μέγιστη επαναχρήση SSoT (annotation-scale, arrowhead stamping, centred-box grips, tool/ribbon pipeline) → ελάχιστος νέος κώδικας.
- ✅ WYSIWYG annotative συμπεριφορά, ίδια με τα dimensions.
- ⚠️ Ο Βορράς v1 δεν auto-rotate σε True/Project North (χειροκίνητη γωνία). Follow-on αν χρειαστεί.
- ⚠️ DXF export v1: `null` mapping (composite/skip) — native INSERT export = follow-on.

---

## 7. Changelog

| Ημ/νία | Model | Αλλαγή |
|---|---|---|
| 2026-07-08 | Opus 4.8 | Φ1 recognition (8 parallel readers) + διαδικτυακή έρευνα + απόφαση αρχιτεκτονικής (D1–D6). ADR δημιουργήθηκε. |
| 2026-07-08 | Opus 4.8 | Φ2a core: `types/annotation-symbol.ts` (entity + guard) + `config/annotation-symbol-catalog.ts` (2 north-arrow variants, unit-space primitives, resolvers) + declaration layer: EntityType union (`base-entity.ts`), `Entity` union + import/guard re-export (`entities.ts`), `ENTITY_TYPE_MAPPING` key (`dxf-export.types.ts`). Καθαρό checkpoint (μη compile-forcing). |
| 2026-07-08 | Opus 4.8 | **Contextual tab dual-mode (επιλογή τοποθετημένου → επεξεργασία)**. Ο `useRibbonAnnotationSymbolBridge` έγινε dual-mode (mirror `useRibbonLineToolBridge`): επιλεγμένος Βορράς → read/write του entity μέσω generic `UpdateEntityCommand` (undoable· patch `symbolId`/`sizeMm`/`rotation`)· καμία επιλογή (tool active) → selection store defaults. `resolveContextualTrigger`: `annotation-symbol` → ANNOTATION_SYMBOL_CONTEXTUAL_TRIGGER (selection priority, γραμμή 281). Props `{levelManager, universalSelection}` περνούν μέσω `useDxfBimBridges(p)`. Πριν: το tab άνοιγε ΜΟΝΟ tool-active (bug — ο Giorgio επέλεγε τοποθετημένο σύμβολο & δεν άνοιγε). jscpd καθαρό. |
| 2026-07-08 | Opus 4.8 | **Contextual tab UI (picker στυλ/μέγεθος/γωνία)**. Νέα: `ui/ribbon/hooks/bridge/annotation-symbol-command-keys.ts` (commandKeys + guards) · `ui/ribbon/hooks/useRibbonAnnotationSymbolBridge.ts` (read/write `annotation-symbol-selection-store`, variant options από catalog) · `ui/ribbon/data/contextual-annotation-symbol-tab.ts` (tab «Σύμβολο Βορρά», 3 comboboxes: variant/sizeMm/rotation, trigger `annotation-symbol-tool-active`). Wiring: selection store +`rotationDeg` (+ placement το διαβάζει ως initial rotation) · `ribbon-contextual-config.ts` (import + CONTEXTUAL_TABS list + trigger `activeTool==='north-arrow'`) · composer `useDxfBimBridges.ts` (instantiate+return) + `useDxfViewerRibbon.ts` (thread) + `useRibbonCommands-types.ts` (props) + `useRibbonCommands.ts` (dispatch onComboboxChange/getComboboxState) · i18n el+en (tabs/panels/commands.annotationSymbolEditor). jscpd καθαρό (διαφορετικό από floorplan). |
| 2026-07-08 | Opus 4.8 | **Φ2c grips (move + rotation + live ghost)**. Lightweight path (ADR-561, ΟΧΙ params-driven): `AnnotationSymbolGripKind` (`grip-kinds-primitives.ts`) + re-exports (`grip-kinds`/`grip-types`/`useGripMovement`) + `GripInfo`/`UnifiedGripInfo` πεδίο + `wrapDxfGrip` forward · grip SSoT `bim/annotation-symbols/annotation-symbol-grips.ts` (move cross + rotation handle, annotative offset, canonical `rotatePoint`) + `computeDxfEntityGrips` case + `AnnotationSymbolRenderer.getGrips` (shape via `gripGlyphShape`) · transforms: `rotateEntity` case (position+rotation, mirror text) + `calculateMovedGeometry` case (position translate) · commit: `commitAnnotationSymbolGripDrag` **κοινός helper με `commitArcGripDrag`** (`commitRotationAboutAnchorPoint`, N.18 anti-clone) + dispatch gates (rotation→RotateEntityCommand, move→`commitWholeEntityMove`) · hot-grip: FSM registry `wall-hot-grip-fsm` (`annotation-symbol-move/rotation`) + `hotGripKindOf` resolver + `grip-mouse-handlers` extractor · live ghost: `DxfGripDragPreview`+`EntityPreviewTransform` πεδίο + `grip-projections`+`grip-drag-preview-transform` forward + `apply-entity-preview` rotation branch (move ghost auto μέσω `calculateMovedGeometry`). Επαλήθευση: grip-rotate-dispatch 5/5 + render-coverage 15/15 ✅· jscpd καθαρό (clone εξήχθη). |
| 2026-07-08 | Opus 4.8 | **Φ2b wiring (ορατό + τοποθετήσιμο + επιλέξιμο)**. Νέα: `rendering/entities/AnnotationSymbolRenderer.ts` (annotative unit-space stamping, reuse `paperHeightToModel`) · `bim/annotation-symbols/annotation-symbol-model-size.ts` (annotative size SSoT· renderer+bounds+hit-test) · `state/annotation-symbol-selection-store.ts` (ενεργή variant/μέγεθος). Wiring: `DxfAnnotationSymbol`+union+type (`dxf-types.ts`) · scene converter (`dxf-scene-entity-converter.ts`) · render converter never-guard (`dxf-renderer-entity-model.ts`) · register `EntityRendererComposite` (+scene-units μέσω `setDimensionSceneUnits`) · `renderable-entity-type.ts` DXF_RENDERABLE_TYPES · `entity-render-contract.ts` (dxf 2D-only) · bounds `entity-bounds.ts`+`Bounds.ts` · hit-test `hit-test-entity-tests.ts`+`hit-test-entity-model.ts` · tool `ui/toolbar/types.ts`+`tool-definitions.ts`+placement `canvas-click-tool-handlers.ts`(`handleAnnotationSymbolClick`→`completeEntity`)+route `useCanvasClickHandler.ts` · ribbon Insert-tab panel «Σύμβολα» (`insert-tab.ts`)+icon `RibbonButtonIcon.tsx` · i18n el+en (`dxf-viewer-shell.json`: panel/command/tooltip + `annotationSymbol.northArrow.simple/star`) · NORTH/NA aliases (`CommandAliasRegistry.ts`). Επαλήθευση: `entity-render-coverage.test.ts` 15/15 ✅· jscpd diff καθαρό. **Φ2c pending**: grips move+rotation (params-driven commit subsystem) + contextual tab UI. |
