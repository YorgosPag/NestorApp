# HANDOFF — Tekton `.TEK` export, ΦΑΣΗ 2: Κουφώματα + Έπιπλα (ADR-512)

**Ημερομηνία:** 2026-06-21
**Προηγούμενο:** Φάση 1 (ΤΟΙΧΟΙ) ✅ **BROWSER-VERIFIED στον Τέκτονα** (εμφάνιση + διαστάσεις σωστά). UNCOMMITTED.
**Στόχος νέας συνεδρίας:** εξαγωγή **κουφωμάτων** (πόρτες/παράθυρα → nested `<open>`) + **επίπλων** (`<object>`) στο `.TEK`, **FULL ENTERPRISE + FULL SSOT**, Revit-grade.

---

## 0. ΚΑΝΟΝΕΣ (ΑΠΑΡΑΒΑΤΟΙ)
- **Commit ΜΟΝΟ ο Giorgio** — εσύ ΠΟΤΕ (N.(-1)).
- **Working tree ΜΟΙΡΑΖΕΤΑΙ με άλλον agent** → stage/άγγιξε **ΜΟΝΟ δικά σου αρχεία**, ΠΟΤΕ `git add -A`.
- **ΠΡΙΝ γράψεις κώδικα → ΠΡΑΓΜΑΤΙΚΟ SSoT audit (grep)**, reuse υπάρχοντα, **μηδέν διπλότυπα** (ρητή απαίτηση Giorgio· βλ. §4).
- GOL + SSOT. tsc: ΕΝΑ τη φορά (N.17 — έλεγξε για άλλον tsc πρώτα· συχνά τρέχει άλλου agent → ΠΕΡΙΜΕΝΕ).
- Απαντάς **ΕΛΛΗΝΙΚΑ**.

## 1. ΤΙ ΕΧΕΙ ΓΙΝΕΙ (Φάση 1 — μην το ξαναφτιάξεις)
Το σημερινό `.TEK` (Τέκτων v9.1, fileversion 516) είναι **απλό XML, UTF-8** (το παλιό v5.1/2011 = brace/token, ΑΛΛΗ μορφή — αγνόησέ το). Νέα 4η μορφή εξαγωγής «TEK» στο unified export (ADR-505).

**Αρχιτεκτονική = TEMPLATE-BASED:** sanitized σκελετός (head+global+building+άδειο floor, μηδέν usid/SID/runtime) + **inject records** στους markers `<!--TEK_WALL_RECORDS-->` / `<!--TEK_OBJECT_RECORDS-->`. Lazy-loaded.

**NEW αρχεία (όλα δικά μου):**
- `src/subapps/dxf-viewer/export/core/tek/tek-skeleton.template.ts` — AUTO-GEN sanitized σκελετός + markers (data file).
- `…/tek/tek-record-templates.ts` — AUTO-GEN `WALL_RECORD_TEMPLATE` (placeholders {{ID}}/{{NAME}}/{{HEIGHT}}/{{ELEVATION}}/{{COLOR}}/{{XMATRIX}}/**{{OPEN}}**).
- `…/tek/tek-types.ts` — `TekWall`/`TekXMatrix`.
- `…/tek/tek-geometry.ts` — `MM_TO_M`/`mmToMeters` (reuse `sceneUnitsToMeters`), `buildWallXMatrix`.
- `…/tek/tek-xml-writer.ts` — `tekNum`/`colorHex6`/`xmatrixXml`/`buildWallRecordXml`/`injectTekEntities` (escapeXml re-export από SSoT).
- `…/tek/bim-to-tek.ts` — `collectTekWalls` (straight walls).
- `export/formats/tek-export-adapter.ts` — `assembleTekDocument` (pure) + `buildTekDocument` (lazy) + `exportFloorToTek`.
- `src/lib/xml/escape-xml.ts` — **NEW app-wide SSoT** XML escape.
- ADR-512 + adr-index + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + memory.

**Wiring (MOD):** `export/types.ts` (`ExportFormat`+='tek')· `export-service.ts` (`runTekExport`)· `ui/components/export/{ExportDialog,useExportDialogState}` (FORMAT_OPTIONS+'tek', tek=BIM-required scope)· i18n `export.formats.tek` el+en.

**xmatrix DECODED+CALIBRATED (column-major — ΚΡΙΣΙΜΟ):**
`point(u,v) → X=x00·u+x10·v+x20, Y=x01·u+x11·v+x21`. Άρα **length axis=(x00,x01)=E−S**, **thickness axis=(x10,x11)=n̂·thickness**, `(x20,x21)=παρειά (=centerline−n̂·t/2)`. Όλα σε **ΜΕΤΡΑ**. height/elevation σε ΜΕΤΡΑ.
⚠️ **ΜΑΘΗΜΑ:** το αρχικό decode από **οριζόντιο** δείγμα ήταν degenerate (x01=x10=0)· πρώτη έκδοση (row-major) έβγαλε **ρόμβους** σε λοξούς τοίχους → fix = **transpose**. Για κάθε νέο affine (objects!), χρησιμοποίησε **λοξό** δείγμα.

**Μονάδες:** BIM coords (start/end/position) = scene units → μέτρα μέσω **`sceneUnitsToMeters(u)`** (SSoT, scene-units.ts). Διαστάσεις (mm) → μέτρα μέσω `mmToMeters` (=`*sceneUnitsToMeters('mm')`). ΜΗΝ ξαναγράψεις conversion.

**Tests:** 15 jest στο `export/core/tek/__tests__/tek-export.test.ts` + adapter test. 102 export-suite GREEN.

## 2. ΕΠΟΜΕΝΟ ΒΗΜΑ — ΦΑΣΗ 2
### 2a. Κουφώματα (πόρτες/παράθυρα → nested `<open>`)
- Στον Τέκτονα το κούφωμα ζει **μέσα** στον host `<wall>` record, στο `<open>…</open>` (στο δείγμα ήταν άδειο → marker `{{OPEN}}` ήδη υπάρχει στο WALL_RECORD_TEMPLATE).
- BIM πηγή: `bim/types/opening-types.ts` — `params.{wallId, offsetFromStart, width, height, sillHeight, kind}` (door/window). Γεωμετρία `geometry.{position, rotation, outline}`.
- Mapper: ομαδοποίησε openings ανά `wallId`· για κάθε wall, χτίσε το `<open>` XML (ένα `<record>` ανά κούφωμα) και πέρασέ το ως `openXml` στο `TekWall`. Ο writer ήδη το εγχέει στο `{{OPEN}}`.
- **Χρειάζεται OPEN record schema** → δες §3 (δείγμα).

### 2b. Έπιπλα (`<object>`)
- BIM πηγή: `bim/types/furniture-types.ts` — `params.{position, rotationDeg, widthMm, depthMm, heightMm, kind}`· `geometry.footprint`.
- Νέο `OBJECT_RECORD_TEMPLATE` (auto-gen από δείγμα) + `collectTekObjects` → inject στο `<!--TEK_OBJECT_RECORDS-->` (ο adapter περνά ήδη `objectsXml` — τώρα `''`).
- Object xmatrix = rotation(rotationDeg)+translate (μέτρα). **Χρειάζεται object record schema + έλεγχος convention με ΛΟΞΟ (περιστραμμένο) δείγμα.**

## 3. ΤΙ ΧΡΕΙΑΖΟΜΑΙ ΑΠΟ ΤΟΝ GIORGIO (δείγματα — controlled)
Σχεδίασέ τα στον **σημερινό Τέκτονα**, save `.tek` + πρόσθεσε `.txt`, δώσε path:
1. **`κουφωμα.tek`**: 1 τοίχος + **1 πόρτα** + **1 παράθυρο** πάνω του (σε γνωστές θέσεις/πλάτη). → decode του `<open>` record.
2. **`επιπλο.tek`**: 1 **αντικείμενο/έπιπλο** σε **λοξή γωνία** (π.χ. 30°) σε γνωστή θέση. → decode object `<object>` record + xmatrix (λοξό για να μη ξαναπέσουμε στο degenerate).

## 4. SSoT AUDIT — ΚΑΝΕ GREP ΠΡΙΝ ΓΡΑΨΕΙΣ (μηδέν διπλότυπα)
- **Μονάδες:** reuse `sceneUnitsToMeters` (`utils/scene-units.ts`) — ΜΗΝ φτιάξεις νέο. (Ήδη έγινε λάθος μια φορά: `metersPerCanvasUnit` = διπλότυπο → διαγράφηκε.)
- **XML escape:** reuse `src/lib/xml/escape-xml.ts` (NEW SSoT). (⚠️ το `services/dxf-raster/svg-from-dxf-scene.ts` έχει δικό του ΕΠΙΤΗΔΕΣ — bundle isolation, ΜΗΝ το αγγίξεις.)
- **Hex χρώμα:** υπάρχουν `parseHex`/`normalizeHex` (`ui/color/utils.ts`, `config/color-math.ts`) — αν χρειαστείς color-math, reuse.
- **Opening/furniture geometry:** reuse `OpeningEntity.geometry`/`FurnitureEntity.geometry` + type guards (`isOpeningEntity`/`isFurnitureEntity` αν υπάρχουν — grep).
- **xmatrix builder:** reuse/γενίκευσε το `buildWallXMatrix` pattern (column-major) για objects· ΜΗΝ γράψεις 2ο affine builder από το μηδέν — δες αν βγαίνει κοινό `buildXMatrix(originM, uAxisM, vAxisM)`.
- **Number/format:** `tekNum`/`colorHex6` (tek-xml-writer) υπάρχουν — reuse.

## 5. VERIFY
- jest `export/` πράσινα· tsc (N.17 σειριακά — έλεγξε για άλλον tsc πρώτα).
- Browser iterative στον Τέκτονα: τοίχος+πόρτα+παράθυρο εμφανίζονται σωστά (θέση/πλάτος/ύψος ποδιάς)· έπιπλο σε σωστή θέση+γωνία. **Λοξά δείγματα** για να πιάσεις convention bugs.
- N.15: ADR-512 (changelog+status) + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + adr-index + memory.

## 6. Reference
- ADR: `docs/centralized-systems/reference/adrs/ADR-512-tekton-tek-export.md` (πλήρες decode+architecture+changelog).
- Memory: `~/.claude/projects/C--Nestor-Pagonis/memory/reference_tekton_tek_export.md` (decode/lessons) + [[reference_unified_export_system]] (ADR-505 βάση).
- Decoded δείγματα (Giorgio's, στο Downloads): `TOIXOS.tek.txt` (καθαρός τοίχος), `Ισόγειο_Ισόγειο.tek.txt` (4 λοξοί τοίχοι — το output μας), `ΠΡΟΒΑ.tek.txt` (αρχιτεκτονικό με wall/open/object schema), Μπαλάσκας v5.1 (παλιό στατικό data model, reference για Φ3).
- Μελλοντικό Φ3 (στατικά pillar/beam/slab/footing) → align με ADR-487 (living structural organism)· χρειάζεται μοντέρνο v9.1 δείγμα με ΓΕΜΑΤΟ στατικό.
