# ADR-644 — DXF AutoCAD R2018 Structural Compliance (handles / APPID / subclass / LTYPE)

> **Status:** 🟢 **Φάση A IMPLEMENTED** (δομικά — το αρχείο ΑΝΟΙΓΕΙ) · UNCOMMITTED · επόμενο: **Φάση B** (πιστότητα — #8 ελληνική γραμματοσειρά, #7 hatch pattern scale)
> **Date:** 2026-07-12
> **Subapp:** `src/subapps/dxf-viewer`
> **Author:** Giorgio + agent (Opus 4.8)
> **Related:** ADR-507 (Hatch system — #6 pixel-size), ADR-636 (DXF import/export coverage — HEADER/TABLES/encoding), ADR-642 (Complex linetypes — embedded-text `0xA0` handle block), ADR-635 (DXF import), ADR-505 (client-side DXF writer), ADR-017/210/294 (Enterprise IDs)

---

## 1. Πλαίσιο / Problem Statement

Ο Giorgio εισάγει πραγματικό AutoCAD DXF (`Αδείας.Κάτοψη ισογείου.dxf`, 42MB, AutoCAD-valid), το
βλέπει σωστά στον Nestor, αλλά η **εξαγωγή** από τον Nestor **δεν άνοιγε** στο AutoCAD (Architecture
2021, R2018/AC1032): «**Invalid or incomplete DXF input — drawing discarded**», μαύρη οθόνη, crash.

Ο client-side writer (`export/core/dxf-ascii-writer.ts`, ADR-505/636) γράφει «μινιμαλιστικό» DXF που
**δηλώνει** R2018 αλλά **δεν πληροί** την αυστηρότητα του AutoCAD. Με **ezdxf 1.4.4** (strict readfile +
`doc.audit()`) + **AutoCAD F2 text-window** εντοπίστηκαν 8 ανεξάρτητα, επιβεβαιωμένα root causes. Τα
#1 (HATCH `AcDbEntity`) & #2 (VPORT/extents) διορθώθηκαν στην ADR-507/636. Το **ADR-644** καλύπτει τα
**δομικά** που εμποδίζουν το άνοιγμα (Φάση A):

| # | Root cause | AutoCAD error |
|---|---|---|
| **#6** | HATCH εκπέμπει πάντα `47 0.0` (pixel size) | «Error: expected group code 98» |
| **#5** | Κανένα handle (group 5) σε entities/records· καμία `$HANDSEED` | «Bad handle 0: already in use» |
| **#3** | Λείπει APPID table ενώ τα layers γράφουν XDATA (`1001 Nestor*`) | «Premature end of object / drawing discarded» |
| **#9** | Λείπουν subclass markers (`100 AcDb…TableRecord`) στα table records | R2018 strict abort |
| **#4** | LTYPE table δεν ορίζει κάθε referenced linetype (skip-άρει ISO + entity group-6) | «Bad linetype name ACAD_ISO03W100» |

### 1.1 Κρίσιμο εύρημα (SSoT audit) — ο writer ήταν «handle-less» με 2 απομονωμένα reserved blocks

Πριν το ADR-644 ο writer ήταν «otherwise handle-less» εκτός από **δύο hardcoded reserved blocks** που
βασίζονταν στην υπόθεση «κανένα άλλο handle» — υπόθεση που **σπάει** μόλις μπουν global handles:

| Reserved block | Πηγή | ADR-644 |
|---|---|---|
| MLINE dict `0x2A` / styles `0x2B…` | `dxf-ascii-mline-writer.ts` | **Ενοποιήθηκε** στον allocator (gated) |
| Embedded-text STYLE `0xA0…` (complex ltype) | `dxf-layer-table-writer.ts` (ADR-642) | **Αφέθηκε** (κάτω από το `0x100` base → καμία σύγκρουση· round-trip reader το χρειάζεται deterministic) |

## 2. Απόφαση (industry alignment — ezdxf ground truth)

Πιστότητα δομής προς ό,τι παράγει το **ezdxf** για R2018 (big-player ground truth, MIT): μοναδικά
handles παντού, `$HANDSEED`, APPID table, subclass markers σε table headers + records, πλήρες LTYPE.

### 2.1 #5 — ΕΝΑΣ handle allocator + lazy-injection στον `pair` sink

- **ΝΕΟ SSoT** `export/core/dxf-ascii-handle-allocator.ts` — `createHandleAllocator()` → `{ next(),
  seedHex() }`, μονότονο hex base `0x100`, pure/deterministic.
- Ο writer **wrap-άρει τον `pair` sink**: μετά από κάθε `0 <TYPE>` (εκτός structural
  `SECTION/ENDSEC/TABLE/ENDTAB/EOF`) η επόμενη `pair` κλήση εκπέμπει `5 <handle>` — **εκτός** αν το
  record κουβαλά ήδη δικό του handle (`5` entities/objects, `105` DIMSTYLE). ⇒ **όλα** τα
  `pair`-based entities παίρνουν handle **χωρίς αλλαγή υπογραφής** (μηδέν churn στους ~15 emitters).
- **`$HANDSEED`** στο HEADER με backfill (η τιμή ≥ κάθε handle είναι γνωστή μόνο στο τέλος → placeholder
  index + `out[idx] = seedHex()`).
- Τα table records (VPORT/APPID/LTYPE/LAYER/STYLE/DIMSTYLE) εκπέμπουν handle **ρητά** (χρειάζονται και
  owner `330` + subclass), οπότε ο sink τα προσπερνά (βλέπει το `5`/`105`).

### 2.2 #3 APPID / #9 subclass — table structure

- **APPID** (`emitAppidTable`, `EXPORT_APPID_NAMES`): `ACAD` + τα 6 Nestor app names — **mirror** του
  `emitLayerXData` (SSoT, keep in lockstep). Εκπέμπεται πριν το LAYER table.
- **Subclass markers**: table headers `5/330 0/100 AcDbSymbolTable`· records `5/330 <tableHandle>/
  100 AcDbSymbolTableRecord/100 AcDb…TableRecord`. **DIMSTYLE ειδικό**: header +`100 AcDbDimStyleTable`,
  record handle = group **105** (όχι 5). Πηγή αλήθειας: minimal ezdxf R2018 dump (βλ. §4).

### 2.3 #4 — πλήρες LTYPE (adapter = SSoT της πολιτικής)

`collectCustomLinetypesForExport` σαρώνει **layers + entities** (`linetypeName` group 6) και **INCLUDES
ISO** (το AutoCAD ΔΕΝ auto-create-άρει linetypes από DXF). Resolve ανά name: LinetypeRegistry (incl.
imported `ACAD_ISO*`) → built-in catalog → minimal CONTINUOUS stand-in. Το `emitLtypeTable` έγινε «dumb»
(εκπέμπει ό,τι του δίνεται· σταμάτησε να skip-άρει ISO) + `74 0` μετά από κάθε `49` (R2018).

### 2.4 Gating (zero regression)

Όλα τα παραπάνω ενεργοποιούνται **μόνο** στο professional AutoCAD path: `emitHandles = wantHeader &&
!explode`. Bare `writeDxfAscii(entities)` (unit tests) + Tekton (`explode`) + round-trip callers
(`writeLayerTable`/`writeDimStyleTable` χωρίς allocator) κρατούν **byte-identical** handle-less envelope.

## 3. Αρχεία

```
ΝΕΟ  export/core/dxf-ascii-handle-allocator.ts   # #5 SSoT allocator
     export/core/dxf-ascii-writer.ts             # #5 wrap pair + $HANDSEED backfill + gate + thread
     export/core/dxf-ascii-tables-writer.ts      # #3 APPID + #9 subclass (VPORT/STYLE/DIMSTYLE) + helpers
     utils/dxf-layer-table-writer.ts             # #9 LAYER/LTYPE subclass+handle (gated) + #4 emitLtypeTable + 74
     utils/dxf-dimstyle-writer.ts                # #9 DIMSTYLE 105 handle + subclass (gated)
     export/core/dxf-ascii-hatch-writer.ts       # #6 μην εκπέμπεις 47 0
     export/core/dxf-ascii-mline-writer.ts       # #5 ενοποίηση reserved handles → allocator (gated)
     export/formats/dxf-export-adapter.ts        # #4 collect ALL linetypes (layers+entities+ISO)
```

## 4. Tests / Validation

- **Jest**: `export/core/__tests__/dxf-r2018-compliance.test.ts` (8/8) — μοναδικά handles, `$HANDSEED` >
  max, APPID (ACAD+6 Nestor), subclass markers, ISO linetype ορισμένο + `74`, ΟΧΙ `47 0`, DIMSTYLE `105`,
  Tekton gating byte-identical. Καμία regression: **389/389** export tests + όλα τα round-trip suites
  (layers/mline/dimstyle/textstyle/leader/point/mtext/complex-linetype).
- **ezdxf 1.4.4 ground truth**: minimal R2018 dump (structure reference) + strict `ezdxf.readfile` +
  `recover.readfile` audit πάνω στο πραγματικό Nestor output → **OK strict, 0 errors, 0 fixes** (και για
  το DIMSTYLE/BLOCKS `105` path). Πριν: strict FAIL.
- **Ground truth (εκκρεμεί):** ο Giorgio κάνει re-export → ανοίγει `1ος Όροφος`+`Ισόγειο` στο AutoCAD →
  **F2** (πρέπει να ΑΝΟΙΓΕΙ, χωρίς «drawing discarded»).

## 5. Γνωστά ρίσκα / follow-ups

- **Entity owner (330) + subclass**: τα minimal entities παίρνουν μόνο bare handle (όχι `330` owner /
  `100 AcDbEntity`/`AcDb<Class>` πλην HATCH). ezdxf strict OK· αν το AutoCAD F2 ζητήσει → επόμενο iteration.
- **BLOCK_RECORD table**: δεν εκπέμπεται (BLOCKS/INSERT/dimension `*Dn`). ezdxf auto-create-άρει· AutoCAD TBD.
- **Embedded-text `0xA0` handles** (ADR-642): δείχνουν σε STYLE records που δεν υπάρχουν στο STYLE table —
  pre-existing ADR-642 concern· σπάνιο σε κατόψεις· εκτός Φάσης A.

## 6. Changelog
- **2026-07-13 — 🎉 ΤΟ ΑΡΧΕΙΟ ΑΝΟΙΞΕ ΣΤΟ AUTOCAD (Φάση A ΟΛΟΚΛΗΡΩΘΗΚΕ) → Φάση B (πιστότητα), UNCOMMITTED:**
  Μετά από 8 iterations δομικών fixes το export ανοίγει. Απομένουν 2 θέματα πιστότητας:
  - **#8 κείμενα «?»:** το STYLE table έγραφε font `txt` (txt.shx, χωρίς ελληνικά glyphs) → όλα τα
    ελληνικά ως «?». Fix: `resolveExportFont` → Greek-capable TrueType (`Arial.ttf`, `GREEK_CAPABLE_FONT`)
    για τα `txt`/`Standard` styles (τόσο το mandatory `Standard` όσο και τα `collectTextStyles`).
  - **#7 γραμμοσκιάσεις αόρατες:** το pattern geometry (43-46/49) + group 41 δεν πολλαπλασιάζονταν με το
    coordinate scale `s`, ενώ το boundary ναι. mm-scene→m-output (s=0.001): boundary 1000mm→1m αλλά offset
    31.75mm έμενε 31.75 → 31.75m σε 1m hatch = ΑΟΡΑΤΟ (τα 116 hatches διαβάζονταν από ezdxf αλλά έβγαιναν
    κενά). Fix: `eff = resolveEffectiveHatchScale × s` → pattern + 41 σε output units (WYSIWYG με canvas
    που δουλεύει σε scene units). Επιβεβαιωμένο: ezdxf pre-scale-άρει το definition (offset scale=2 = 2×
    scale=1) + κρατά 41 — ίδια σύμβαση. 393/393 tests (s=1 byte-identical), jscpd clean. Εκκρεμεί F2.
- **2026-07-13 — #9i Root Named Object Dictionary (AutoCAD F2 iteration #8, UNCOMMITTED):** Όγδοο
  re-export → «**File lacks the NamedObject dictionary**» (global). Το `(9).dxf` δεν είχε **καθόλου**
  OBJECTS section (καμία MLINE, η image hatch→solid) → κανένα root NOD. Ο R2018 απαιτεί το root Named
  Object Dictionary. Fix: το professional path εκπέμπει **πάντα** OBJECTS section με root NOD (owner 0)
  + standard (κενό) `ACAD_GROUP` dict, και αναφέρει `ACAD_MLINESTYLE`/`ACAD_IMAGE_DICT` όταν υπάρχουν.
  ezdxf: 0 errors, `doc.rootdict` αναγνωρίζεται. 392/392 tests, jscpd clean. Εκκρεμεί νέο AutoCAD F2
  (πιθανό επόμενο: ACAD_LAYOUT με Model layout — αν το ζητήσει).
- **2026-07-13 — #9h Bogus linetype «0» σε entities (AutoCAD F2 iteration #7, UNCOMMITTED):** Μετά το
  timeout το export παρήχθη & άνοιξε ΠΟΛΥ πιο μακριά (γρ.4556, past blocks) → «**Bad linetype name 0**»
  σε LINE (block member, layer «01»). Διάγνωση στο `(9).dxf`: 28 entities φέρουν group `6 0` (imported
  stray token)· το «0» εξαιρείται από το LTYPE table (IMPLICIT) → undefined. Επιβεβαιώθηκε ότι ΟΛΑ τα
  άλλα referenced linetypes ορίζονται (ACAD_ISO03/07/10W100, HIDDEN2, LTP-*, Dashed, Divide) + όλα τα
  layers (0/01/04/…) υπάρχουν. Fix: `emitEntityStyle` skip group 6 όταν το όνομα είναι «0»/blank →
  ByLayer inherit. 391/391 tests, jscpd clean. Εκκρεμεί νέο AutoCAD F2.
- **2026-07-13 — Export-blocker: image-fill pre-pass πάγωμα (defensive timeout, UNCOMMITTED):** Το export
  **κόλλησε** (δεν παρήγαγε DXF) — ΟΧΙ ο writer (stress test 2209 entities → 100ms), αλλά ο **image-fill
  pre-pass** (`resolveImageFillsForDxf` → `decodeImageForExport`, ADR-643 Φ5b): ο Giorgio διέγραψε ένα hatch
  image material (404 `bmat_…`) και το `await img.decode()` σε `crossOrigin` εικόνα που λείπει **δεν
  settle-άρει ποτέ** (Chromium gotcha). Fix (έγκριση Giorgio, αρχείο ADR-643): `withTimeout` (8s) γύρω από
  resolve/decode/fetch → missing image πέφτει στο υπάρχον solid fallback αντί να παγώνει. 390/390 tests,
  jscpd clean. (Σχετικό: ADR-643 Φ5b.) **Επίσης:** ο άλλος agent εξήγαγε το `writeEntity` σε
  `dxf-ascii-entity-dispatch.ts` — οι ADR-644 αλλαγές (r2018/professional/owner) **επιβίωσαν** (verified).
- **2026-07-12 — #9g BLOCK_RECORD entry ανά block (AutoCAD F2 iteration #6, UNCOMMITTED):** Έκτο
  re-export → «**Invalid Block Name:NEW_BNBBNLOCK**» (BLOCK, γρ.1342 — το «ARC» του μηνύματος
  παραπλανά). Διάγνωση στο **πραγματικό** export του Giorgio (`Ισόγειο (8).dxf`): 10 named blocks
  («NEW_BLOCK» variations) + 96 INSERTs, **καμία διάσταση**. Root: τα named blocks στο BLOCKS section
  **δεν είχαν BLOCK_RECORD entry** (δηλώναμε μόνο *Model_Space/*Paper_Space)· το ezdxf τα auto-create-άρει
  (masked το bug), το AutoCAD **όχι** → απορρίπτει. Fix: pre-allocate BLOCK_RECORD handle **ανά block name**
  (named + resolvable `*Dn`) στον writer → το BLOCK_RECORD table εκπέμπει record ανά block, και κάθε BLOCK
  definition owner (330) δείχνει στο ίδιο handle. N.18: κοινό `emitBlockBegin`/`emitBlockEnd` SSoT (named +
  dim + space blocks). ezdxf: 0 errors, block_records ⊇ named/dim blocks (verified). 389/389 tests, jscpd clean.
- **2026-07-12 — #9f *Model_Space/*Paper_Space BLOCK defs + entity owner (AutoCAD F2 iteration #5, UNCOMMITTED):**
  Πέμπτο re-export → «**Invalid Block Name:NEW_BNBBNLOCK**» (garbled = parser **desync**). Root: το
  BLOCK_RECORD table δηλώνει `*Model_Space`/`*Paper_Space` αλλά το BLOCKS section **δεν** τα όριζε →
  το AutoCAD, διαβάζοντας τα entities, αποσυγχρονιζόταν. Το ezdxf ground-truth δείχνει ότι το BLOCKS
  **πάντα** αρχίζει με τους δύο ορισμούς. Fix: (α) το professional BLOCKS section εκπέμπεται **πάντα**
  και ξεκινά με `*Model_Space`+`*Paper_Space` BLOCK defs· (β) τα δύο BLOCK_RECORD handles
  **pre-allocated** στον writer ώστε record ⇄ BLOCK def ⇄ entity owner (330) να δείχνουν στο **ίδιο**
  handle· (γ) κάθε top-level entity απέκτησε `330 <*Model_Space handle>`. ezdxf: 0 errors, entity
  owner == msp block-record handle (verified). 388/388 tests, jscpd clean. Εκκρεμεί νέο AutoCAD F2.
- **2026-07-12 — #9e Entity subclass markers (AutoCAD F2 iteration #4, UNCOMMITTED):** Τέταρτο
  re-export → «**Class separator for class AcDbEntity expected**» σε ARC. Ο R2018 απαιτεί σε **κάθε
  entity** την πλήρη αλυσίδα subclass markers (`100 AcDbEntity` + common codes ΠΡΙΝ τη γεωμετρία, μετά
  `100 AcDb<Class>`) — τα «minimal R12-style» entities δεν την είχαν (το ρίσκο του §5). Fix: κάθε
  emitter απέκτησε R2018 shape (`EntityR2018` ctx) — LINE→AcDbLine, CIRCLE→AcDbCircle, ARC→AcDbCircle+
  AcDbArc, POINT→AcDbPoint, POLYLINE→AcDb2dPolyline (+VERTEX/SEQEND), SOLID→AcDbTrace, 3DFACE→AcDbFace,
  LEADER→AcDbLeader, TEXT→AcDbText×2 (vertical-just quirk), MTEXT→AcDbMText, INSERT→AcDbBlockReference,
  BLOCK/ENDBLK→AcDbBlockBegin/End (named + dimension `*Dn` blocks). Τα common style codes (6/48/370/440)
  μετακινήθηκαν ΜΕΣΑ στο AcDbEntity block. Gated (`professional = emitHandles`, **excludes R12/AC1009**
  → bare legacy). ezdxf strict + audit: 0 errors, γεωμετρία (center/radius/angles/verts/text) επιβεβαιωμένα
  ανά τύπο. 387/387 export tests, jscpd clean. Εκκρεμεί νέο AutoCAD F2. **Owner 330 παραλείπεται** (DXFIN
  → model space)· BLOCK_RECORD `*Model_Space` υπάρχει.
- **2026-07-12 — #9d Mandatory DEFAULT entries ανά table (AutoCAD F2 iteration #3, UNCOMMITTED):**
  Τρίτο re-export → «**Missing Default entry ByLayer in SymbolTable:LTYPE**». Ο R2018 απαιτεί **default
  entries** μέσα σε κάθε table: **LTYPE** → `ByBlock`/`ByLayer`/`Continuous`· **LAYER** → `0`· **STYLE**
  → `Standard`· **DIMSTYLE** → `Standard`. Fix (professional path, gated): prepend τα LTYPE defaults +
  synthetic layer `0` (αν λείπει) + `Standard` STYLE + `Standard` DIMSTYLE (= `NESTOR_DEFAULT_TEMPLATE`
  renamed). ezdxf strict + audit: 0 errors· επιβεβαιωμένα ByBlock/ByLayer/Continuous/0/Standard. 386/386
  export tests, jscpd clean. Εκκρεμεί νέο AutoCAD F2.
- **2026-07-12 — #9c ΟΛΟΙ οι 9 mandatory symbol tables (AutoCAD F2 iteration #2, UNCOMMITTED):**
  Δεύτερο re-export → «**Missing SymbolTable:VIEW**». Ο R2018 απαιτεί **και τους 9** standard symbol
  tables παρόντες (ακόμη κι άδειους), σε κανονική σειρά: **VPORT → LTYPE → LAYER → STYLE → VIEW → UCS →
  APPID → DIMSTYLE → BLOCK_RECORD**. Λείπαν VIEW/UCS/BLOCK_RECORD (+ STYLE/DIMSTYLE ήταν content-gated →
  θα έλειπαν σε text-less/dim-less export). Fix: professional branch στο `emitTablesSection` που εκπέμπει
  και τους 9 πάντα (empty VIEW/UCS· BLOCK_RECORD με `*Model_Space`+`*Paper_Space`· STYLE/DIMSTYLE empty-ok).
  Legacy branch (no allocator) αμετάβλητο. ezdxf strict + audit: 0 errors· block records auto-created για
  τα `*Dn` (⇒ AutoCAD DXFIN το ίδιο). 88/88 tests. Εκκρεμεί νέο AutoCAD F2.
- **2026-07-12 — #9b PlotStyleName (390) + $PSTYLEMODE (AutoCAD F2 iteration #1, UNCOMMITTED):** Μετά το
  πρώτο re-export ο AutoCAD (Arch 2021) έδωσε «**Error in LAYER Table — Did not receive PlotStyleName**».
  Ο R2018 (AC1032) απαιτεί **hard-pointer PlotStyleName (group 390)** σε **κάθε** LAYER record. Fix:
  `$PSTYLEMODE = 1` στο HEADER (color-dependent/CTB — code `290`, επιβεβαιωμένο από ezdxf ground-truth) +
  `390 0` (null handle, έγκυρο σε CTB) σε κάθε LAYER record (gated στον allocator → round-trip
  byte-identical). ezdxf strict + audit: 0 errors. 9/9 compliance tests. Εκκρεμεί νέο AutoCAD F2.
- **2026-07-12 — Φάση A IMPLEMENTED (Opus 4.8, UNCOMMITTED):** #6/#5/#3/#9/#4 όπως §2. ΕΝΑΣ handle
  allocator + lazy-injection sink· APPID + subclass markers (ezdxf-verified)· πλήρες LTYPE (layers+
  entities+ISO). ezdxf strict read + audit: 0 errors/0 fixes (ήταν strict FAIL). 389/389 export tests
  πράσινα, μηδέν regression (gating). Εκκρεμεί AutoCAD F2 από Giorgio + Φάση B (#8 font, #7 hatch scale).
