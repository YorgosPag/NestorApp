# ADR-583 — Βιβλιοθήκη Συμβόλων Σχεδίασης (Annotation Symbol Library — Βορράς / Κλίμακα / Σήμα Τομής)

| Field | Value |
|---|---|
| Status | ✅ **Φ1 + Φ2a + Φ2b + Φ2c + contextual tab DONE** — 2026-07-08, Opus 4.8. Ο Βορράς **αποδίδεται, τοποθετείται (ένα κλικ), επιλέγεται/hit-testάρεται, έχει interactive grips (move+rotation με live ghost), ΚΑΙ contextual tab (picker στυλ/μέγεθος/γωνία)**. Φ2b: `AnnotationSymbolRenderer` + converters + composite/contract register + bounds + hit-test + tool `north-arrow` + ribbon + i18n + NORTH/NA aliases + selection store. Φ2c grips (lightweight ADR-561 path): move→`calculateMovedGeometry` case, rotation→`RotateEntityCommand`→`rotateEntity` case· κοινό commit helper με arc (N.18)· hot-grip FSM + glyph registry + live rotation ghost. Contextual tab («Σύμβολο Βορρά», trigger `north-arrow`): command-keys + bridge (`useRibbonAnnotationSymbolBridge`→selection store) + tab data (3 comboboxes) + composer wiring (`useDxfBimBridges`/`useRibbonCommands`) + trigger (`ribbon-contextual-config`) + i18n el+en. Follow-on kinds (scale-bar/section-mark) = γρήγορα, το catalog architecture έτοιμο. Βορράς = reference kind. **Φ0 επέκτασης (2026-07-09): text/arc primitives + `annotation-kind-registry` SSoT → το catalog δέχεται πλέον σύμβολα με κείμενο/τόξα (grid bubbles, callouts, section/elevation marks, revision clouds) και νέο kind-tool = 1 γραμμή registry. Φ1a (2026-07-09): kind-derived UI (ΕΝΑ tab για όλα τα kinds). Φ1b (2026-07-09): ΠΡΩΤΟ νέο kind ΜΕ tool — `section-mark`. Φ1c (2026-07-09): ΜΑΖΙΚΗ batch ΟΛΩΝ των point-glyph kinds — grid-bubble/elevation-mark/detail-callout/revision-tag (8 σύμβολα, arc primitive proof). **Πλήρης point-glyph βιβλιοθήκη = 14 σύμβολα / 6 kinds.** **Φ2 (2026-07-09, Φ2.0–Φ2.5) DONE: Γραφική Κλίμακα (`scale-bar`) ΩΣ ΞΕΧΩΡΙΣΤΟΣ scene-entity type** (`type:'scale-bar'`, sibling του `dimension`/`center-mark` — ΟΧΙ kind αυτής της family, βλ. D3/D5 revision), με 2-click placement (αρχή+άξονας/μήκος), 4 στυλ (alternating/hollow/line-ticks/double), nice-number length snap (1·2·5×10ⁿ), two-formula split (μήκος=πραγματικό/scale-invariant, πάχος/labels=annotative), WYSIWYG ghost, και 3 grips (move/rotation/**LENGTH-resize** — τεκμηριωμένη εξαίρεση στο D5). ΕΚΤΟΣ (linear/area, χωριστή φάση): revision-cloud/match-line/break-line.** |
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

`AnnotationSymbolEntity { type:'annotation-symbol'; position; rotation; kind; symbolId; sizeMm }`. Ένα type καλύπτει όλα τα **fixed-ratio point-glyph** kinds (`'north-arrow' | 'section-mark' | 'grid-bubble' | 'elevation-mark' | 'detail-callout' | 'revision-tag'`), επεκτάσιμο. ⚠️ **Revised Φ2.5 (2026-07-09):** το `scale-bar` ΔΕΝ έγινε kind αυτής της family — βλ. §7 Φ2 changelog + D5 παρακάτω· ο ρόλος `'scale-bar'` που ήταν reserved εδώ στο `AnnotationSymbolKind` αφαιρέθηκε.

### D4 — Catalog SSoT modeled στο `dim-arrowhead-blocks.ts`

`config/annotation-symbol-catalog.ts` → `Readonly<Record<string, AnnotationSymbolDefinition>>`. Κάθε def: `{ id, kind, labelKey (i18n), geometry: unit-space primitives (line/polyline/arc/triangle/text), origin }`. Resolver `getAnnotationSymbol(id)` + `listAnnotationSymbols(kind)`. Ribbon options **generated** από catalog. Static ids (camelCase, π.χ. `northArrowSimple`, `northArrowStar`), **ΟΧΙ** enterprise-id (τα enterprise-ids είναι μόνο για persisted Firestore docs).

### D5 — Grips: **move + rotation μόνο** (χωρίς resize)

Τα σύμβολα έχουν σταθερή αναλογία → όχι corner/edge resize. Adapter πάνω στο `centred-box-grips.ts` φιλτραρισμένο σε move+rotation. Rotation-handle από `rotation-handle-policy.ts`. Το μέγεθος αλλάζει από το contextual tab (`sizeMm`), όχι από grip-drag.

> ⚠️ **Τεκμηριωμένη εξαίρεση (`scale-bar`, Φ2, 2026-07-09):** η γραφική κλίμακα ΔΕΝ είναι fixed-ratio glyph αυτής της family (D3) — είναι ξεχωριστός `type:'scale-bar'` με **δυναμικό πραγματικό `length`** (Revit/QGIS parity: η μπάρα ΕΙΝΑΙ «10 m»). Γι' αυτό έχει **3ο grip kind, LENGTH-resize** (πέρα από move+rotation), μοναδική εξαίρεση στον κανόνα «όχι resize» του D5 — βλ. `bim/scale-bar/scale-bar-grips.ts`. Η τιμή του grip ξανα-κβαντίζεται πάντα μέσω `snapScaleBarLength()` (1·2·5×10ⁿ), ποτέ ελεύθερο drag.

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
| 2026-07-09 | Opus 4.8 | **Φ2 «έξυπνες λαβές» (Γραφική Κλίμακα — Φάση 2 του «αύξηση λαβών όπου εφικτό», Giorgio).** Στόχος: η μπάρα να έχει περισσότερες **λειτουργικές** λαβές (ώστε να φαίνεται/επεξεργάζεται σε multi-select, όπου το MOVE+ROTATION glyph κρύβονται). Ο Giorgio διάλεξε «έξυπνες λαβές» (ΟΧΙ 4 γωνίες σαν τοίχο) γιατί το scale-bar έχει ΔΥΟ ασύμμετρα μεγέθη: **μήκος** = πραγματική απόσταση (κουμπώνει 1-2-5) και **ύψος** = annotative paper-mm. **Από 3 → 5 grips** (`ScaleBarGripKind` +2 literals): προστέθηκαν `scale-bar-length-start` (λαβή στο ΑΡΙΣΤΕΡΟ άκρο / '0' tick — κρατά το δεξί σταθερό, μετακινεί `position` + rederive `angleRad`/`length` μέσω του ΙΔΙΟΥ `deriveScaleBarAxis` SSoT· τα δύο άκρα = συμμετρικά length handles) + `scale-bar-height` (λαβή στη μέση της ΠΑΝΩ ακμής — αλλάζει ΜΟΝΟ το `barHeightMm` μέσω **SCALE-FREE λόγου** `newPerp/oldPerp`, ώστε ο drawingScale factor να ακυρώνεται → μηδέν store read στο drag, clamp σε `MIN_SCALE_BAR_HEIGHT_MM`). Θέση της height λαβής = top-edge midpoint με perp offset = LIVE annotative thickness (`paperHeightToModel` + frame-time `drawingScale`, `sceneUnits='mm'` — parity `annotationSymbolModelSizeLive`, ώστε render ≡ hit-test). Και τα 5 δρομολογούνται με το υπάρχον `commitScaleBarGripDrag` (ΕΝΑ entry) + το ghost (`apply-entity-preview.ts` μέσω `gripKindOf(preview,'scale-bar')`) → **preview ≡ commit BY IDENTITY** χωρίς αλλαγή στα δύο αυτά σημεία (μόνο ο `applyScaleBarGripDrag` switch πήρε 2 cases). Όλες οι νέες λαβές `type:'vertex'` (STRUCTURAL, default 'square' glyph) → πάντα ορατές σε επιλεγμένη μπάρα (survive grip-type toggles + ADR-559 §multi-select). Αρχεία: `hooks/grip-kinds-primitives.ts` (union+docs), `bim/scale-bar/scale-bar-grips.ts` (emission+2 drags). Tests: `scale-bar-grips.test.ts` (5 grips + length-start snap + height ratio/clamp), 7/7 GREEN· jscpd:diff καθαρό· ΟΧΙ tsc (N.17). ⚠️ Άσχετο pre-existing fail σε `scale-bar-primitives.test.ts` (label '0', render primitives — άλλου agent, δεν αγγίχτηκε). Browser-verify: Giorgio. |
| 2026-07-09 | Opus 4.8 | **Φ2.6 — HOVER-highlight hit-test fix (Γραφική Κλίμακα).** Bug (Giorgio): hover πάνω στη μπάρα ΔΕΝ φώτιζε, ενώ ήταν marquee-selectable. Root cause = split: το marquee path (`entity-bounds-ssot.ts` `resolveEntityBounds`, Twin-B, Φ2.4) είχε `scale-bar` provider, αλλά το **spatial-index hover/click path** (`hitTestingService`→`HitTester`→`BoundsCalculator`+`performDetailedHitTest`) παρέλειπε το νέο type σε **3 στάδια** (κλασικό «EntityModel vs scene = 2 converters» + bounds gap): (1) `services/hit-test-entity-model.ts` `convertDxfEntityToEntityModel` — no case → `default` γδύνει τα flat params → κενό entity στον index· (2) `rendering/hitTesting/Bounds.ts` `BoundsCalculator.calculateEntityBounds` — no case → `null` → πετιέται από τον index (+`console.warn`)· (3) `rendering/hitTesting/hit-test-entity-tests.ts` `performDetailedHitTest` — no case → default AABB (ανακριβές σε στραμμένη μπάρα). **Fix (mirror annotation-symbol, full SSoT):** νέο **`bim/scale-bar/scale-bar-hit.ts`** = ΜΙΑ πηγή για το precise pick (`scaleBarModelHalfThickness[Live]` + `hitTestScaleBarAxis` — axis-corridor gated by LIVE annotative half-thickness, mirror `annotation-symbol-model-size.ts`)· `ScaleBarRenderer.hitTest` **делегάρει** πλέον εκεί (σβήστηκε το inline duplication → N.18 anti-clone)· προστέθηκαν οι 3 cases (converter passthrough· `calculateScaleBarBounds` = axis-extent bbox από `computeScaleBarGeometry` padded κατά half-thickness live ώστε το broad-phase να καλύπτει το ±half-thickness corridor· narrow-phase → `hitTestScaleBarAxis`). **Νέο test** `rendering/hitTesting/__tests__/scale-bar-hit-test.test.ts` (pins και τα 3 gaps: converter δεν γδύνει params, finite bbox με perpendicular pad, precise hit on-axis/miss-off-axis + rotated non-degenerate). Jest sweep 64/64 (hitTesting + bounds-twins + ScaleBarRenderer)· jscpd:diff καθαρό. Browser-verify: Giorgio. |
| 2026-07-09 | Opus 4.8 | **Φ2.5 — i18n + ADR closeout + tests + self-guard (Γραφική Κλίμακα, τέλος Φ2).** i18n: `ribbon.commands.scaleBar`(+Tooltip) ήδη υπήρχαν (Φ2.2)· προστέθηκε νέα ενότητα `properties.tabs.commands.scaleBarEditor` (el+en) — `style`+4 `styleOptions` (alternating/hollow/lineTicks/double)+`unit`+`divisions`+`subdivisions`+`barHeight`+`labelHeight`+`labelPlacement`+2 `labelPlacementOptions` (below/above), mirror `annotationSymbolEditor`· προετοιμασία για μελλοντικό contextual tab (δεν υπάρχει ακόμα UI consumer — βλ. Φ2.2 pending note). **ADR revision (D3/D5, §2.1):** αφαιρέθηκε το `'scale-bar'` literal από `AnnotationSymbolKind` (`types/annotation-symbol.ts`) — ήταν dead reservation (ποτέ δεν wired σε catalog/kind-registry, verified by grep)· D3 ενημερώθηκε ώστε η λίστα kinds να είναι μόνο τα 6 πραγματικά fixed-ratio point-glyph kinds· D5 πήρε τεκμηριωμένη εξαίρεση: το `scale-bar` έχει 3ο **LENGTH-resize grip** (μοναδική εξαίρεση στο «όχι resize» της family), γιατί ΔΕΝ είναι μέλος αυτής της family πλέον — είναι ξεχωριστός `type:'scale-bar'` (βλ. `types/scale-bar.ts`, ADR-583 Φ2.0). **Νέα tests**: `rendering/entities/__tests__/ScaleBarRenderer.test.ts` (smoke — 4 στυλ rendering χωρίς throw + hitTest hit-on-segment/miss-off-segment) + `bim/scale-bar/__tests__/build-scale-bar-entity.test.ts` (2-click build → snapped nice-number `length` + σωστό `angleRad` για οριζόντιο/κάθετο/διαγώνιο άξονα). Coverage golden-pin suites (`entity-render-coverage`/`tool-creates-entity-coverage`/grip coverages) ήδη περιείχαν `'scale-bar'` από Φ2.1–Φ2.4 — καμία αλλαγή χρειάστηκε. Final self-guard: πλήρες σχετικό jest sweep + `jscpd:diff` σε ΟΛΑ τα scale-bar αρχεία Φ2.0–Φ2.5 — βλ. session tool-report για ακριβή counts. Κλείνει το ADR-583 Φ2 (Γραφική Κλίμακα) ως πλήρες vertical slice: entity+geometry+renderer+tool+preview+grips+i18n+ADR+tests. |
| 2026-07-08 | Opus 4.8 | Φ1 recognition (8 parallel readers) + διαδικτυακή έρευνα + απόφαση αρχιτεκτονικής (D1–D6). ADR δημιουργήθηκε. |
| 2026-07-08 | Opus 4.8 | Φ2a core: `types/annotation-symbol.ts` (entity + guard) + `config/annotation-symbol-catalog.ts` (2 north-arrow variants, unit-space primitives, resolvers) + declaration layer: EntityType union (`base-entity.ts`), `Entity` union + import/guard re-export (`entities.ts`), `ENTITY_TYPE_MAPPING` key (`dxf-export.types.ts`). Καθαρό checkpoint (μη compile-forcing). |
| 2026-07-08 | Opus 4.8 | **Contextual tab dual-mode (επιλογή τοποθετημένου → επεξεργασία)**. Ο `useRibbonAnnotationSymbolBridge` έγινε dual-mode (mirror `useRibbonLineToolBridge`): επιλεγμένος Βορράς → read/write του entity μέσω generic `UpdateEntityCommand` (undoable· patch `symbolId`/`sizeMm`/`rotation`)· καμία επιλογή (tool active) → selection store defaults. `resolveContextualTrigger`: `annotation-symbol` → ANNOTATION_SYMBOL_CONTEXTUAL_TRIGGER (selection priority, γραμμή 281). Props `{levelManager, universalSelection}` περνούν μέσω `useDxfBimBridges(p)`. Πριν: το tab άνοιγε ΜΟΝΟ tool-active (bug — ο Giorgio επέλεγε τοποθετημένο σύμβολο & δεν άνοιγε). jscpd καθαρό. |
| 2026-07-08 | Opus 4.8 | **Contextual tab UI (picker στυλ/μέγεθος/γωνία)**. Νέα: `ui/ribbon/hooks/bridge/annotation-symbol-command-keys.ts` (commandKeys + guards) · `ui/ribbon/hooks/useRibbonAnnotationSymbolBridge.ts` (read/write `annotation-symbol-selection-store`, variant options από catalog) · `ui/ribbon/data/contextual-annotation-symbol-tab.ts` (tab «Σύμβολο Βορρά», 3 comboboxes: variant/sizeMm/rotation, trigger `annotation-symbol-tool-active`). Wiring: selection store +`rotationDeg` (+ placement το διαβάζει ως initial rotation) · `ribbon-contextual-config.ts` (import + CONTEXTUAL_TABS list + trigger `activeTool==='north-arrow'`) · composer `useDxfBimBridges.ts` (instantiate+return) + `useDxfViewerRibbon.ts` (thread) + `useRibbonCommands-types.ts` (props) + `useRibbonCommands.ts` (dispatch onComboboxChange/getComboboxState) · i18n el+en (tabs/panels/commands.annotationSymbolEditor). jscpd καθαρό (διαφορετικό από floorplan). |
| 2026-07-08 | Opus 4.8 | **Φ2c grips (move + rotation + live ghost)**. Lightweight path (ADR-561, ΟΧΙ params-driven): `AnnotationSymbolGripKind` (`grip-kinds-primitives.ts`) + re-exports (`grip-kinds`/`grip-types`/`useGripMovement`) + `GripInfo`/`UnifiedGripInfo` πεδίο + `wrapDxfGrip` forward · grip SSoT `bim/annotation-symbols/annotation-symbol-grips.ts` (move cross + rotation handle, annotative offset, canonical `rotatePoint`) + `computeDxfEntityGrips` case + `AnnotationSymbolRenderer.getGrips` (shape via `gripGlyphShape`) · transforms: `rotateEntity` case (position+rotation, mirror text) + `calculateMovedGeometry` case (position translate) · commit: `commitAnnotationSymbolGripDrag` **κοινός helper με `commitArcGripDrag`** (`commitRotationAboutAnchorPoint`, N.18 anti-clone) + dispatch gates (rotation→RotateEntityCommand, move→`commitWholeEntityMove`) · hot-grip: FSM registry `wall-hot-grip-fsm` (`annotation-symbol-move/rotation`) + `hotGripKindOf` resolver + `grip-mouse-handlers` extractor · live ghost: `DxfGripDragPreview`+`EntityPreviewTransform` πεδίο + `grip-projections`+`grip-drag-preview-transform` forward + `apply-entity-preview` rotation branch (move ghost auto μέσω `calculateMovedGeometry`). Επαλήθευση: grip-rotate-dispatch 5/5 + render-coverage 15/15 ✅· jscpd καθαρό (clone εξήχθη). |
| 2026-07-09 | Opus 4.8 | **Φ1c επέκτασης — ΜΑΖΙΚΗ προσθήκη ΟΛΩΝ των point-glyph kinds (μία session).** Αφού το Φ1b απέδειξε το 8-step μοτίβο, τα υπόλοιπα **single-click** σύμβολα προστέθηκαν batch (ΟΧΙ 1-1): **4 νέα kinds × 2 variants = 8 σύμβολα** — `grid-bubble` (`gridBubbleCircle`/`gridBubbleHexagon`), `elevation-mark` (`elevationLevel` datum τρίγωνο+τιμή / `elevationTag` bubble+βέλος), `detail-callout` (`detailCallout` split / **`detailCalloutArc`** — ΠΡΩΤΗ χρήση του `arc` primitive σε πραγματικό σύμβολο, hook arc + leader + bubble), `revision-tag` (`revisionTagDelta` τρίγωνο / `revisionTagHexagon`). Νέος helper `hexagon(r, solid)` στο catalog (SSoT, δύο kinds τον μοιράζονται — N.18). Wiring ανά kind (ίδιο 8-step): `AnnotationSymbolKind` union +4 · `annotation-kind-registry` +4 γραμμές (→ routing/placement/trigger/tab **αυτόματα**) · ToolType +4 · `tool-definitions` (+4 TOOL_INFO, +4 `TOOL_CREATES_ENTITY`) · `insert-tab` +4 buttons · `RibbonButtonIcon` +4 cases · `CommandAliasRegistry` +8 aliases (GRID/GB, ELEV/EL, CALLOUT/DETAIL, REVTAG/REV) · i18n el+en (variant labels + ribbon commands+tooltips). Coverage golden pins loop-άρουν και τα 5 νέα kinds. **ΕΚΤΟΣ (χωριστή φάση — linear/area, ΔΕΝ ταιριάζουν στο single-click point μοντέλο):** `scale-bar` (δυναμικό μήκος+length grip), `revision-cloud` (area outline), `match-line` (long line), `break-line` (stretched). Verify: 38/38 tests (tool-creates-entity + resolve-tool-active-trigger + render-coverage) ✅· jscpd καθαρό (8 αρχεία). **Πλήρης point-glyph βιβλιοθήκη: north-arrow(4)+section-mark(2)+grid-bubble(2)+elevation-mark(2)+detail-callout(2)+revision-tag(2) = 14 σύμβολα, 6 kinds.** |
| 2026-07-09 | Opus 4.8 | **Φ1b επέκτασης — ΠΡΩΤΟ νέο kind ΜΕ νέο tool: `section-mark` (πλήρες vertical slice).** Απόδειξη ότι το kind-agnostic θεμέλιο δουλεύει: νέο ορατό+τοποθετήσιμο+επιλέξιμο σύμβολο με **μηδέν** αλλαγή σε render/grips/bounds/hit-test/store/tab/placement (όλα κλειδώνουν στο `type==='annotation-symbol'`). Industry-standard geometry (Revit section head / AutoCAD split callout): **2 variants** στο catalog με υπάρχοντα primitives — `sectionMarkArrow` (bubble κύκλος + γράμμα «A» + γεμάτο βέλος κατεύθυνσης θέασης, tip κάτω @0°) + `sectionMarkSplit` (κύκλος διαιρεμένος οριζόντια σε detail «A»/sheet «1» + βέλος). Wiring (8 σημεία, north-arrow πρότυπο): (1) **catalog** 2 defs `kind:'section-mark'`· (2) **`annotation-kind-registry`** +1 γραμμή `{kind:'section-mark',toolId:'section-mark'}` → routing/placement/trigger/contextual-tab **αυτόματα** (registry-driven)· (3) **ToolType** union `\| 'section-mark'`· (4) **`tool-definitions`** TOOL_INFO entry + `TOOL_CREATES_ENTITY['section-mark']='annotation-symbol'` (DERIVED onto `createsEntityType`)· (5) **`insert-tab`** κουμπί «Σημάδι Τομής» στο panel Σύμβολα· (6) **`RibbonButtonIcon`** icon case (bubble+«A»+βέλος)· (7) **`CommandAliasRegistry`** `SECTION`/`SEC` aliases· (8) **i18n el+en** — variant labels (`annotationSymbol.sectionMark.{arrow,split}`) + `ribbon.commands.sectionMark`(+Tooltip) + **generic tab title** (`annotationSymbolProperties`: «Σύμβολο Βορρά»→«Σύμβολο Σχεδίασης» / «North Arrow»→«Annotation Symbol», αφού ο tab είναι πλέον shared cross-kind). Coverage golden pins: `tool-creates-entity` + `resolve-tool-active-trigger` (section-mark → annotation-symbol / shared trigger). **Το bridge γεμίζει τα section-mark variants runtime** (`variantOptionsForKind(activeKind)`) μόλις ενεργοποιηθεί το tool — μηδέν αλλαγή στο tab data. Verify: jscpd καθαρό (6 αρχεία)· tool-creates-entity + resolve-tool-active-trigger 23/23 + render-coverage 15/15 = 38/38 ✅. **Εκκρεμεί Φ1c+**: επόμενα kinds (`grid-bubble`/`elevation-mark`/`detail-callout`/`break-line`/`match-line`/`revision-cloud`) με το ίδιο 8-step μοτίβο· `scale-bar`/tags εκτός (§2.1). |
| 2026-07-09 | Opus 4.8 | **Φ1a επέκτασης — kind-derived UI refactor + text-primitive proof.** Το UI έπαψε να είναι hardcoded σε `'north-arrow'`, ώστε ΕΝΑ contextual tab να εξυπηρετεί ΟΛΑ τα kinds (mirror MEP-segment): (1) **selection store kind-aware** (`activeKind` + per-kind slices `perKind`· `setActiveKind` save/load· top-level `symbolId/sizeMm/rotationDeg` API αμετάβλητο → placement handler + bridge αδιάφοροι)· (2) **bridge `variantOptionsForKind(kind)`** — options από selected entity `kind` (edit) ή `activeKind` (placement), όχι module-level `'north-arrow'`· (3) **activation sync** στο `ribbon-contextual-config.ts` (effect: `activeTool`→`annotationKindForTool`→`setActiveKind`)· (4) **`resolve-tool-active-trigger` registry-driven** (`...ANNOTATION_KIND_CONFIGS.map(...)` → κάθε annotation tool στο ίδιο trigger, όχι per-kind γραμμή). **Text-primitive proof**: 2 νέοι Βορράδες που ασκούν το νέο `text` primitive — `northArrowCompass` (ring + N/E/S/W γράμματα) + `northArrowCircledN` (κυκλωμένο "N" + βέλος) + i18n el/en. Backward-compatible (`activeKind` init 'north-arrow'). Verify: jscpd καθαρό (5)· render-coverage 15/15 + tool-active-trigger + contextual-trigger golden 36/36 ✅. **Εκκρεμεί Φ1b**: πρώτο νέο kind ΜΕ νέο tool (section-mark: ToolType literal + tool-def + ribbon button/icon/alias). Grips/bounds/hit-test/render/store/tab = ήδη kind-agnostic → μένει μόνο tool/ribbon wiring ανά kind. |
| 2026-07-09 | Opus 4.8 | **Φ0 επέκτασης βιβλιοθήκης — kind-agnostic θεμέλια** (πριν προστεθούν τα σύμβολα της §2.1). **Tier C primitives**: `AnnotationSymbolArc` (world-CCW γωνίες, negate + `counterclockwise=false` για το Y-flip, mirror `ArcRenderer`) + `AnnotationSymbolText` (`heightFrac`×modelSize×scale, `buildUIFont`, upright-by-default ώστε αριθμοί/γράμματα να διαβάζονται σε rotated glyph, **δεν** mirror-άρει — Y-flip είναι αριθμητικό στο `worldToScreen`) στο `AnnotationSymbolPrimitive` union + νέα `stampPrimitive` cases (`config/annotation-symbol-catalog.ts`, `rendering/entities/AnnotationSymbolRenderer.ts`, `MIN_LABEL_SCREEN_PX` guard, `rot` περνά στο stamp). **Tier B SSoT**: `config/annotation-kind-registry.ts` (`ANNOTATION_KIND_CONFIGS` array → `ANNOTATION_SYMBOL_TOOL_IDS`/`isAnnotationSymbolTool`/`annotationKindForTool` — νέο kind tool = 1 γραμμή, όχι scattered `activeTool==='north-arrow'` literals/N.18). Consumers: `useCanvasClickHandler` routing → `isAnnotationSymbolTool(activeTool)` (ΜΙΑ branch για όλα)· `handleAnnotationSymbolClick(worldPoint, activeTool, p)` → `kind` derived από `getAnnotationSymbol(symbolId).kind` (όχι literal) + `tool=activeTool`. Backward-compatible (Βορράς ταυτόσημος). jscpd καθαρό (5 αρχεία). **Εκκρεμεί Φ1**: πρώτα νέα kinds + kind-derived selection-store/contextual-tab (μεταφέρθηκε από Φ0 → οδηγείται από 2ο kind ώστε να είναι testable end-to-end, όχι speculative). |
| 2026-07-08 | Opus 4.8 | **Φ2b wiring (ορατό + τοποθετήσιμο + επιλέξιμο)**. Νέα: `rendering/entities/AnnotationSymbolRenderer.ts` (annotative unit-space stamping, reuse `paperHeightToModel`) · `bim/annotation-symbols/annotation-symbol-model-size.ts` (annotative size SSoT· renderer+bounds+hit-test) · `state/annotation-symbol-selection-store.ts` (ενεργή variant/μέγεθος). Wiring: `DxfAnnotationSymbol`+union+type (`dxf-types.ts`) · scene converter (`dxf-scene-entity-converter.ts`) · render converter never-guard (`dxf-renderer-entity-model.ts`) · register `EntityRendererComposite` (+scene-units μέσω `setDimensionSceneUnits`) · `renderable-entity-type.ts` DXF_RENDERABLE_TYPES · `entity-render-contract.ts` (dxf 2D-only) · bounds `entity-bounds.ts`+`Bounds.ts` · hit-test `hit-test-entity-tests.ts`+`hit-test-entity-model.ts` · tool `ui/toolbar/types.ts`+`tool-definitions.ts`+placement `canvas-click-tool-handlers.ts`(`handleAnnotationSymbolClick`→`completeEntity`)+route `useCanvasClickHandler.ts` · ribbon Insert-tab panel «Σύμβολα» (`insert-tab.ts`)+icon `RibbonButtonIcon.tsx` · i18n el+en (`dxf-viewer-shell.json`: panel/command/tooltip + `annotationSymbol.northArrow.simple/star`) · NORTH/NA aliases (`CommandAliasRegistry.ts`). Επαλήθευση: `entity-render-coverage.test.ts` 15/15 ✅· jscpd diff καθαρό. **Φ2c pending**: grips move+rotation (params-driven commit subsystem) + contextual tab UI. |
