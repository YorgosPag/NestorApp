# HANDOFF — Revit-grade compound wall: ο σοβάς ως additive skin (ΟΧΙ DNA layer)

**Ημερομηνία:** 2026-06-21
**ADR:** ADR-449 (structural finish skin) — κύριο· ADR-447 (wall type catalog/DNA), ADR-396 (ETICS) — επηρεάζονται
**Vision:** ADR-487 (living structural organism)
**Status:** SPEC LOCKED + Slice X3/X3.1 DONE (uncommitted). Επόμενο = Slice X4 (η μεγάλη ενοποίηση).

---

## 🎯 ΣΤΟΧΟΣ (απόφαση Giorgio 2026-06-21, Revit/big-player + FULL SSOT)

**Ο σοβάς ΔΕΝ είναι DNA layer.** Το `WallDna` κρατά **ΜΟΝΟ δομικές + μόνωση** στρώσεις (τούβλο/μπετόν + EPS).
Ο σοβάς = **additive skin** μέσω του ΥΠΑΡΧΟΝΤΟΣ structural-finish silhouette (ADR-449), με δικό υλικό+πάχος,
που **προεξέχει** από τον δομικό πυρήνα — **ακριβώς όπως ήδη κολώνες/δοκάρια** (`StructuralFinishSpec`).

Αυτή είναι η σύμβαση που **ήδη γράφει** το ADR-449: *«στατικός πυρήνας = immutable SSoT· σοβάς = additive δέρμα,
ΠΟΤΕ stored στο width/depth»*. Ο τοίχος είναι ο μόνος που δεν την υιοθέτησε.

---

## 🔴 ΤΟ ΠΡΟΒΛΗΜΑ ΠΟΥ ΛΥΝΟΥΜΕ (browser-confirmed Giorgio)

Μετά το Slice X3 (ο τοίχος έγινε silhouette-member) → **ΔΙΠΛΟΣ σοβάς**:
1. **DNA σοβάς** — `WallRenderer.ts:153 → drawDnaLayerLines()` → `wall-layer-lines-2d.ts:wallLayerBoundaryPolylines`
   ζωγραφίζει boundary lines των DNA plaster layers (`side:'exterior'` 25mm / `side:'interior'` 15mm).
2. **Silhouette σοβάς** — ο νέος (X3).

Επίσης ο silhouette σοβάς **«μπαίνει μέσα»** (δεν προεξέχει): το core του = `inset(full, 15)` → μέσα στο full
thickness που ΗΔΗ περιέχει τον DNA σοβά. Και **λείπει top-cap** (Giorgio use-case: περίφραξη = θεμέλιο + τούβλα +
**σοβατισμένη κορυφή**).

---

## ✅ ΤΙ ΕΧΕΙ ΗΔΗ ΓΙΝΕΙ (Slice X3 + X3.1, UNCOMMITTED, tested GREEN)

Ο τοίχος μπήκε στην ΙΔΙΑ merged silhouette με κολόνες/δοκάρια (σβήνει στις επαφές μέσω `safeUnion`). Render-wiring
fix ώστε μεμονωμένος τοίχος να δείχνει σοβά **και στα 2 άκρα** (το geometry ήταν ήδη σωστό — 4 segments).

| Αρχείο | Αλλαγή |
|---|---|
| `bim/finishes/wall-finish-source.ts` **[NEW]** | `wallHasPlasterSkin(dna)` + `wallToSilhouetteMember(wall, skinMm, zExtent)` — core = `insetPolygonMiter(full, skin)`. **⚠️ Στο X4 το inset ΦΕΥΓΕΙ** (core = πλήρες δομικό footprint, σοβάς προεξέχει). |
| `bim/finishes/structural-finish-scene-silhouette.ts` **[MOD]** | `computeStructuralFinishSilhouette`: split walls → members (με σοβά) / obstacles (parapet/fence). Coverage obstacles = μόνο bare walls. sceneUnits fallback σε τοίχο. classifier από ΟΛΟΥΣ τους walls. |
| `canvas-v2/dxf-canvas/dxf-renderer-frame-builders.ts` **[MOD]** | guard `columns===0 && beams===0` → `&& walls===0` (αλλιώς μεμονωμένος τοίχος → null). +walls sceneUnits fallback. **⚠️ canvas file → CHECK 6D → stage ADR.** |
| `bim-3d/scene/bim-scene-structural-finish-sync.ts` **[MOD]** | NEW wall grouping loop (resolve ανά building, `isWallTilted` exclude) → `g.walls` ως member. **⚠️ 3Δ shared tree (ADR-446/452 άλλου agent) → stage ΜΟΝΟ δικές μου γραμμές.** |
| `bim/finishes/__tests__/wall-finish-source.test.ts` **[NEW]** | 9 jest (has-plaster, member core, parapet→null, walls-only silhouette, contact-subtraction). |
| `canvas-v2/dxf-canvas/__tests__/structural-finish-silhouette-2d.test.ts` **[MOD]** | +1 jest (μεμονωμένος τοίχος → ≥2 άκρα segments). |
| `docs/.../ADR-449-structural-finish-skin.md` **[MOD]** | Slice X3 + X3.1 changelog/roadmap/status. |

**Tests:** 10 νέα + 139 structural-finish/3D + 78 wall/column = GREEN, μηδέν regression.
**tsc:** ΔΕΝ έτρεξα (N.17 — έτρεχε άλλου agent· 3-αρχεία rule). 🔴 τρέξε στο X4.

---

## 📐 ΤΟ ΣΧΕΔΙΟ — Slice X4 (4 ενοποιημένα sub-issues, κοινή ρίζα «core vs full»)

### A) DNA = ΜΟΝΟ δομικό + μόνωση (αφαίρεση plaster layers)
- `bim/types/wall-dna-types.ts` → `createDefault*Dna()`: αφαίρεση των `side:'exterior'`/`'interior'` **plaster**
  layers (`mat-plaster-ext`/`mat-plaster-int`). Κράτα **core** (τούβλο/μπετόν) + **EPS μόνωση**
  (`isInsulationMaterial` → ΜΕΝΕΙ· δεν είναι σοβάς). Π.χ. exterior 25+210+15 → **210**· EPS variant 100+25+210+15 → **100+210**.
- ⚠️ `totalThickness` αλλάζει → επηρεάζει `WallParams.thickness` (SSoT = dna.totalThickness), `computeWallGeometry`,
  BOQ, `wall-type-auto-assign` (matches DNA), ADR-396 ETICS envelope. **GREP τα ΟΛΑ πριν αλλάξεις (βλ. AUDIT).**

### B) Πηγή σοβά τοίχου = `StructuralFinishSpec` (ΟΧΙ DNA) — ίδιο με κολόνα/δοκάρι
- `WallParams += finish?: StructuralFinishSpec` (mirror `ColumnParams.finish`/`BeamParams.finish`).
  Default `createDefaultStructuralFinishSpec()` στο wall factory (`wall.factory.ts`/`wall-completion.ts`).
- `wall-finish-source.ts`: **αφαίρεση inset** → core = `wallFootprintPolygon(wall)` (= πλέον καθαρό δομικό, αφού DNA
  χωρίς σοβά). Ο resolver προσθέτει skin **outward → ΠΡΟΕΞΕΧΕΙ** (όπως κολόνα). Skin/υλικό από `wall.params.finish`.

### C) ΣΟΒΑΣ ΟΧΙ ΔΙΠΛΟΣ — αφαίρεση DNA plaster render
- `WallRenderer.ts:153 drawDnaLayerLines` + `wall-layer-lines-2d.ts`: αφού το DNA δεν έχει πια plaster, οι boundary
  lines δείχνουν μόνο core↔insulation (σωστό). **Αν legacy τοίχος έχει ακόμη plaster στο DNA → MIGRATION (βλ. κάτω).**
  **⚠️ WallRenderer = ADR-040 micro-leaf → CHECK 6B/6D → stage ADR-040.**

### D) Ασύμμετρο ext/int πάχος (το αρχικό X4)
- `StructuralFinishSpec` += optional `exteriorThickness?` (fallback `thickness`). `structural-finish-resolver.ts`
  `buildSegment`: `thickness = classification==='exterior' ? (spec.exteriorThickness ?? spec.thickness) : spec.thickness`.
- **🔓 ΑΝΟΙΧΤΗ ΑΠΟΦΑΣΗ:** το merged silhouette τρέχει **ΕΝΑ** `spec` για ΟΛΑ τα members → per-classification
  thickness θα κάνει ΚΑΙ τις εξωτερικές παρειές κολόνας/δοκαριού 25mm (σήμερα 15). Δύο δρόμοι:
  (i) **ομοιόμορφο κέλυφος** ext=25 για όλα (Revit-correct, αλλά browser-verify κολόνες)·
  (ii) **ξεχωριστό silhouette pass** για τοίχους με δικό spec (περισσότερος κώδικας, απομονώνει κολόνες).
  → Ρώτησε Giorgio με concrete παράδειγμα ΠΡΙΝ κωδικοποιήσεις το C.

### E) Top-cap σοβάς (περίφραξη)
- ΕΛΕΥΘΕΡΗ κορυφή τοίχου (`topBinding:'unconnected'` ή parapet/fence χωρίς δοκάρι/πλάκα από πάνω) → οριζόντιος σοβάς.
- **REUSE Slice 11:** `bim/finishes/structural-finish-horizontal.ts` (`computeStructuralHorizontalFinishFaces`) +
  `bim-3d/converters/structural-finish-horizontal-3d.ts` (`buildHorizontalFinishSkin`) — ήδη υπάρχει για top caps/soffits
  κολόνας/δοκαριού. Επέκτεινε για wall top footprint. **ΜΗΝ γράψεις νέο horizontal system.**

---

## 🔍 SSOT AUDIT — ΥΠΟΧΡΕΩΤΙΚΑ GREP ΠΡΙΝ ΟΠΟΙΟΝΔΗΠΟΤΕ ΚΩΔΙΚΑ

```
# Πού ζει ο wall plaster σήμερα (DNA path) — προς αφαίρεση/migration:
grep -rn "drawDnaLayerLines\|wallLayerBoundaryPolylines\|wall-layer-lines-2d" src/subapps/dxf-viewer/
grep -rn "mat-plaster-int\|mat-plaster-ext" src/subapps/dxf-viewer/bim/
grep -rn "side: 'exterior'\|side: 'interior'\|isInsulationMaterial" src/subapps/dxf-viewer/bim/

# Το additive-skin SSoT να ΞΑΝΑΧΡΗΣΙΜΟΠΟΙΗΣΕΙΣ (μην ξαναγράψεις):
grep -rn "StructuralFinishSpec\|createDefaultStructuralFinishSpec\|isFinishActive" src/subapps/dxf-viewer/bim/
grep -rn "computeStructuralHorizontalFinishFaces\|buildHorizontalFinishSkin" src/subapps/dxf-viewer/

# Consumers του wall thickness/DNA (αν αλλάξει totalThickness):
grep -rn "totalThickness\|resolveWallThicknessMm\|getDefaultDnaForCategory\|wall-type-auto-assign" src/subapps/dxf-viewer/
grep -rn "wallHasExteriorInsulation\|envelopeFunction\|ADR-396" src/subapps/dxf-viewer/bim/

# BOQ: πού μετριέται ο σοβάς τοίχου σήμερα (DNA layer area → silhouette area):
grep -rn "wall.*finish\|plaster.*area\|FinishBoqContribution" src/subapps/dxf-viewer/bim/services/
```

**Στόχος audit:** να επιβεβαιώσεις ότι (1) ο σοβάς θα παράγεται από **ΕΝΑ** SSoT (silhouette + `StructuralFinishSpec`),
(2) επαναχρησιμοποιείς το horizontal-finish SSoT για το top-cap, (3) δεν σπας ADR-396 ETICS (η EPS μένει DNA layer).

---

## 🔄 MIGRATION (legacy persisted τοίχοι με DNA plaster)

Υπάρχοντες τοίχοι στο Firestore έχουν DNA με plaster layers (250mm). Στρατηγική (Revit-grade, μηδέν data loss):
- **Runtime tolerate (προτεινόμενο Slice X4):** αν `wallHasPlasterSkin(dna)` ΑΛΛΑ ΟΧΙ `params.finish` → **legacy τοίχος**:
  render DNA lines (παλιό), **ΟΧΙ** silhouette member (μηδέν διπλό). Νέοι τοίχοι (DNA χωρίς plaster + `finish` spec)
  → silhouette. Έτσι το X4 δεν σπάει τα παλιά + μηδέν διπλό.
- **Boy-scout migration on touch (DEFER):** όταν ο χρήστης επεξεργάζεται legacy τοίχο → strip plaster από DNA +
  inject `finish` spec (1-time, undoable).

---

## ⚠️ CONSTRAINTS (ΑΠΑΡΑΒΑΤΑ)
- **COMMIT: ΜΟΝΟ ο Giorgio.** Εσύ ΠΟΤΕ commit/push (N.(-1)).
- **Shared working tree** (άλλος agent) → `git add` **ΜΟΝΟ τα δικά σου αρχεία**, ποτέ `git add -A`.
- **ADR-040:** WallRenderer/canvas αρχεία → CHECK 6B/6D → stage ADR-040 + ADR-449 στο ίδιο commit.
- **N.17:** ΕΝΑ tsc τη φορά (έλεγξε `Get-CimInstance ... tsc` πριν).
- **N.0.1:** update ADR-449 (+447 για DNA, +470 αν visibility) + ΕΚΚΡΕΜΟΤΗΤΕΣ + adr-index + MEMORY στο ίδιο commit.
- **N.2/N.3:** μηδέν `any`/`as any`/inline styles. **N.7.1:** αρχεία <500, functions <40.

## ✅ ΣΕΙΡΑ ΥΛΟΠΟΙΗΣΗΣ (προτεινόμενη)
1. SSOT AUDIT (grep πάνω) → χάρτης τι υπάρχει.
2. Ρώτησε Giorgio την ΑΝΟΙΧΤΗ ΑΠΟΦΑΣΗ του C (ομοιόμορφο κέλυφος vs ξεχωριστό wall pass) με concrete παράδειγμα.
3. B+C (πηγή=spec, αφαίρεση inset, αφαίρεση DNA plaster + runtime-tolerate legacy) → ο διπλός σοβάς φεύγει + προεξέχει.
4. A (DNA defaults χωρίς plaster) + migration tolerate.
5. D (ασύμμετρο) μετά την απόφαση #2.
6. E (top-cap, reuse Slice 11).
7. Tests + ADR + ΕΚΚΡΕΜΟΤΗΤΕΣ + MEMORY. tsc (N.17). Παράδωσε για browser-verify + commit (Giorgio).

## 🧪 REGRESSION GUARD
Τρέξε: `npx jest structural-finish wall-finish-source silhouette-2d wall-completion wall-trims column-grips-free-corner`
(πρέπει να μένει GREEN: ~227 tests). Νέο jest για: DNA χωρίς plaster· σοβάς προεξέχει (core=full)· ασύμμετρο ext≠int·
top-cap ελεύθερης κορυφής· legacy τοίχος (DNA plaster) → μηδέν silhouette.
