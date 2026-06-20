# ADR-507 — Hatch Creation System (Γραμμοσκιάσεις στο DXF Viewer)

> **Status:** 🟢 SPECIFICATION COMPLETE — Q&A ολοκληρώθηκε (10 ερωτήσεις), έτοιμο για υλοποίηση
> **Date:** 2026-06-20
> **Subapp:** `src/subapps/dxf-viewer`
> **Author:** Giorgio + agent
> **Related:** ADR-505 (Unified Export), ADR-419 (Floor Finish hatch), ADR-363 §5.5/§3.6 (BIM material hatch), ADR-449 (Structural Finish Skin), ADR-040 (canvas performance), ADR-001 (Select component)

---

## 1. Πλαίσιο / Problem Statement

Ο Giorgio θέλει να ενσωματώσουμε στην υπο-εφαρμογή **DXF Viewer** (`http://localhost:3000/dxf/viewer`) τη
δυνατότητα **δημιουργίας γραμμοσκιάσεων (hatches)** — όπως ακριβώς το κάνει η AutoCAD με την εντολή `HATCH`/`BHATCH`.

Σήμερα ο χρήστης μπορεί να σχεδιάσει γραμμές, κύκλους, τόξα, πολυγραμμές, κείμενο κ.λπ., αλλά **δεν μπορεί να
γεμίσει μια κλειστή περιοχή** με μοτίβο γραμμοσκίασης (π.χ. σκυρόδεμα, τούβλο, άμμος, διαγώνιες γραμμές) ή με
συμπαγές χρώμα / διαβάθμιση (gradient).

### 1.1 Κρίσιμο εύρημα στον υπάρχοντα κώδικα

Ο τύπος `HatchEntity` **υπάρχει ήδη σκαρωμένος αλλά είναι «νεκρός»** (δεν χρησιμοποιείται πουθενά end-to-end):

| Επίπεδο | Κατάσταση | Αρχείο |
|---|---|---|
| TypeScript τύπος `HatchEntity` | ✅ Ορισμένος (στο `Entity` union, με type guard) | `types/entities.ts:531-543`, `types/base-entity.ts:38`, `:766` |
| Canvas renderer | ❌ **Δεν υπάρχει** | θα είναι `rendering/entities/HatchRenderer.ts` |
| Εγγραφή στον DXF writer | ❌ **Ρητά αναβλημένη** (ADR-505 §Deferrals) | `export/core/dxf-ascii-writer.ts:140` (`// hatch → skipped`) |
| Ανάγνωση από DXF reader | ⚠️ Tokenized αλλά **πετιέται σιωπηλά** | `utils/dxf-entity-converters.ts` (no `case 'HATCH'`) |
| Tool δημιουργίας | ❌ Δεν υπάρχει | θα είναι `hooks/drawing/useHatchTool.ts` |
| Ribbon κουμπί | ❌ Δεν υπάρχει | `ui/ribbon/data/home-tab-draw.ts` |

Άρα **δεν ξεκινάμε από το μηδέν** — χτίζουμε πάνω σε υπάρχοντα θεμέλια.

### 1.2 Υπάρχοντα SSoT προς επαναχρήση

| SSoT | Αρχείο | Ρόλος στο hatch |
|---|---|---|
| `buildAxisAlignedHatch()` | `bim/geometry/shared/polygon-hatch-utils.ts` | Παράγει παράλληλες γραμμές σε bbox — βάση για pattern geometry |
| `drawHatch()` μοτίβο | `bim/renderers/FloorFinishRenderer.ts` | Canvas: `ctx.clip()` + παράλληλες → αντιγράφουμε το μοτίβο |
| `handleAutoAreaClick()` | `systems/auto-area/auto-area-hit.ts` + `canvas-click-tool-handlers.ts` | Pick-point boundary detection (Τρόπος Β) |
| `pointInPolygon`, shoelace | `bim/geometry/shared/polygon-utils.ts` | Γεωμετρικές βοηθητικές |
| `useBeamTool` lifecycle | `hooks/drawing/useBeamTool.ts` | Πρότυπο state-machine για tool |

---

## 2. Έρευνα: Πώς χειρίζεται η AutoCAD τις γραμμοσκιάσεις

*(Πηγές: Autodesk DXF Reference 2007/2011/2012/2018/2023/2024, ezdxf docs, netDXF. Επιβεβαιωμένο 3-0 από adversarial verification.)*

### 2.1 Τύποι γραμμοσκίασης (hatch types)

| Τύπος | Περιγραφή | DXF `76` | DXF `70` |
|---|---|---|---|
| **Solid fill** | Συμπαγές γέμισμα με ένα χρώμα | — | `1` |
| **User-defined** | Παράλληλες/σταυρωτές γραμμές· γωνία + απόσταση ορίζει ο χρήστης | `0` | `0` |
| **Predefined pattern** | Έτοιμο μοτίβο βιβλιοθήκης (`ANSI31`, `AR-CONC`, `BRICK`…) | `1` | `0` |
| **Custom** | Μοτίβο από εξωτερικό `.PAT` αρχείο | `2` | `0` |
| **Gradient fill** | Ομαλή διαβάθμιση 1 ή 2 χρωμάτων | — | (group `450=1`) |

### 2.2 Μορφή αρχείου PAT (pattern definition)

```
*PatternName, optional description
angle, x-origin, y-origin, delta-x, delta-y [, dash1, dash2, ...]
```

- **angle** — γωνία οικογένειας γραμμών (μοίρες).
- **x-origin, y-origin** — σημείο αναφοράς.
- **delta-x** — μετατόπιση κατά μήκος γραμμής μεταξύ διαδοχικών dash.
- **delta-y** — κάθετη απόσταση παράλληλων γραμμών («πόσο πυκνά»).
- **dash1, dash2…** — θετικό = γραμμή, αρνητικό = κενό, `0` = κουκκίδα.
- Ένα μοτίβο = μία ή **πολλές** γραμμές αναφοράς (σταυρωτό = 2 γραμμές, 0° + 90°).

Παράδειγμα `ANSI31` (διαγώνιες 45°): `45, 0, 0, 0, 3.175`

### 2.3 Η οντότητα HATCH στο DXF (subclass `AcDbHatch`) — group codes

**Κεφαλίδα οντότητας:**

| Code | Σημασία | Τιμές / Σημειώσεις |
|---|---|---|
| `100` | Subclass marker | `AcDbHatch` |
| `10/20/30` | Elevation point (OCS) | X,Y=0· Z=elevation |
| `210/220/230` | Extrusion / normal direction | default `0,0,1` |
| `2` | Pattern name | `SOLID`, `ANSI31`, `AR-CONC`… |
| `70` | Solid fill flag | `0`=pattern, `1`=solid |
| `71` | Associativity flag | `0`=non-assoc, `1`=assoc |
| `91` | Πλήθος boundary paths (loops) | int — **πρέπει να ταιριάζει ακριβώς** |

**Ανά boundary path (επαναλαμβάνεται `91` φορές):**

| Code | Σημασία | Τιμές |
|---|---|---|
| `92` | Boundary path type flag (bit-coded) | `1`=external, `2`=polyline, `4`=derived, `8`=textbox, `16`=outermost |
| `93` | Πλήθος vertices (αν polyline) ή edges (αν edge-defined) | int |
| `72` | (polyline) has-bulge flag / (edge-defined) edge type | edge: `1`=line `2`=arc `3`=ellipse `4`=spline |
| `73` | (polyline) is-closed flag | `0/1` |
| `10/20` | Κορυφές / σημεία ακμών | + `42` bulge (προαιρετικό) |
| `97` | (associative) πλήθος handles | |
| `330` | (associative) handle πηγαίου αντικειμένου | επαναλαμβάνεται × `97` |

**Hatch style & pattern:**

| Code | Σημασία | Τιμές |
|---|---|---|
| `75` | Island detection style | `0`=Normal(odd-parity), `1`=Outer, `2`=Ignore |
| `76` | Pattern type | `0`=user-defined, `1`=predefined, `2`=custom |
| `52` | Pattern angle (degrees) | pattern fill only |
| `41` | Pattern scale / spacing | pattern fill only |
| `77` | Double flag (user-defined cross-hatch) | `0/1` |
| `78` | Πλήθος pattern definition lines | int |

**Ανά pattern definition line (επαναλαμβάνεται `78` φορές):**

| Code | Σημασία |
|---|---|
| `53` | Γωνία γραμμής |
| `43/44` | Base point X/Y |
| `45/46` | Offset (delta) X/Y |
| `79` | Πλήθος dash lengths |
| `49` | Μήκος dash (επαναλαμβάνεται × `79`) |

**Misc + gradient:**

| Code | Σημασία | Τιμές |
|---|---|---|
| `47` | Pixel size (ray-casting density) | |
| `98` | Πλήθος seed points | + `10/20` ανά seed |
| `450` | Gradient flag | `0`=solid hatch, `1`=gradient |
| `452` | Gradient colors | `0`=two-color, `1`=single-color |
| `453` | Πλήθος χρωμάτων | `0`=solid, `2`=gradient |
| `460` | Γωνία gradient (radians) | |
| `461` | Gradient shift/centered | 0.0–1.0 |
| `462` | Color tint | 0.0–1.0 |
| `470` | Gradient name | `LINEAR`, `CYLINDER`, `INVCYLINDER`, `SPHERICAL`, `INVSPHERICAL`, `HEMISPHERICAL`, `CURVED` |

### 2.4 Ορισμός ορίου (boundary)

- **Polyline boundary path** (`92` bit 2): κορυφές + bulges. **Το απλούστερο & πιο διαλειτουργικό** — αυτό χρησιμοποιούμε.
- **Edge-defined path**: ξεχωριστές ακμές (line/arc/ellipse/spline) — πολύπλοκο, για μελλοντική φάση.
- **Pick-point detection**: η AutoCAD κάνει ray-casting / flood-fill από το σημείο κλικ → βρίσκει κλειστό όριο → εφαρμόζει island detection.

### 2.5 Island detection (group `75`)

- **Normal `0`** — εναλλάξ: εξωτερικό γεμίζει → πρώτο νησί κενό → επόμενο γεμίζει… (AutoCAD default, **δικό μας default**).
- **Outer `1`** — γεμίζει ΜΟΝΟ τον εξωτερικό δακτύλιο, όλα τα εσωτερικά κενά.
- **Ignore `2`** — αγνοεί νησιά, γεμίζει τα πάντα.

### 2.6 Gotchas / διαλειτουργικότητα

1. **Polyline boundary** για programmatic creation — αποφεύγεις edge codes & handles.
2. `10/20` ορίου = OCS· για 2D με normal `(0,0,1)` ≡ WCS.
3. Για solid: `70=1`, pattern name `SOLID`, **καθόλου** pattern definition lines (`78=0`).
4. **Μετρητές πρέπει να ταιριάζουν ακριβώς**: `91`=paths, `93`=vertices/edges, `78`/`79`/`98` — αναντιστοιχία → AutoCAD απορρίπτει.
5. Σειρά group codes έχει σημασία· pattern lines ακολουθούν το `78`.
6. Για associative: κάθε boundary path χρειάζεται `97` + `330` (handles) → το εξαρτώμενο DXF object model.

---

## 3. Αποφάσεις (Q&A — ΚΛΕΙΣΤΟ)

| # | Ερώτηση | Απάντηση Giorgio | Επίπτωση στο σχέδιο |
|---|---|---|---|
| Q1 | Πώς δείχνει ο χρήστης την περιοχή; | **Και οι 2 τρόποι (Α + Β), όπως η AutoCAD** | Tool: 2 modes· Α=κλικ σε κλειστή πολυγραμμή· Β=pick-point (auto-area SSoT). Φ1=Α, Φ3=Β. |
| Q2 | Τι είδη γεμίσματος; | **Όλα** (solid, user-defined, predefined, gradient) | 4 `fillType` values· Φ1=solid+user-defined, Φ2=predefined, Φ5=gradient. |
| Q3 | Island detection default; | **Normal** — AutoCAD default, πιο επαγγελματικό. Και οι 3 επιλογές στο panel. | `islandStyle: 'normal'\|'outer'\|'ignore'`· DXF `75=0/1/2`· canvas: evenodd (Φ4). |
| Q4 | Associative ή non-associative; | **Associative** | `boundaryEntityIds: string[]`· DXF `71=1` + `97/330`· reactive recalc on boundary change (Φ7). |
| Q5 | Μέγεθος κατάλογου patterns; | **Πλήρης 30+ όπως AutoCAD** | `data/hatch-pattern-catalog.ts`: ANSI, AR-*, EARTH, GRAVEL, STEEL, CORK κ.λπ. + i18n el/en. |
| Q6 | UX flow: ρυθμίσεις πρώτα ή κλικ πρώτα; | **Β — κλικ πρώτα, ρυθμίσεις στο contextual panel** | Default solid, αμέσως ορατό· contextual panel για pattern/scale/angle/color/islandStyle. |
| Q7 | Hatch origin / base point; | **Revit style — χρήστης ορίζει σημείο· full enterprise SSoT** | `HatchEntity.patternOrigin?: Point2D`· NEW `hatch-origin.ts` (pure)· `HatchOriginStore` (tool-time)· default = lower-left corner of bounding box (Revit default). |
| Q8 | Layer assignment; | **Απόφαση agent (Revit/AutoCAD pattern):** dedicated `ΓΡΑΜΜΟΣΚΙΑΣΗ` default layer, αλλά ακολουθεί το active layer αν ο χρήστης το έχει αλλάξει | `HatchEntity.layer` = `'ΓΡΑΜΜΟΣΚΙΑΣΗ'` by default· configurable στο contextual panel (dropdown active layers). |
| Q9 | Transparency / opacity; | **Απόφαση agent (AutoCAD 2011+ / Revit):** YES — `opacity: number` (0-100%) | `HatchEntity.opacity?: number` default `100`· canvas: `ctx.globalAlpha`· DXF: group `440` (transparency, 0=opaque, 255=transparent)· slider στο contextual panel. |
| Q10 | Πολλές περιοχές σε μία εντολή; | **Απόφαση agent:** κάθε pick = ξεχωριστό `HatchEntity` (simpler, enterprise) | Ο χρήστης κάνει πολλά κλικ → κάθε κλικ = νέο entity με τις ίδιες ρυθμίσεις (ίδιο pattern/scale/color)· ESC = τέλος εντολής. |

---

## 4. Αρχιτεκτονική (ΟΡΙΣΤΙΚΗ)

### 4.1 Αρχή SSoT

**«Μία γεωμετρία → canvas + DXF»** — η ίδια περιγραφή μοτίβου τροφοδοτεί ΚΑΙ τον canvas renderer ΚΑΙ τον DXF writer, μέσω κεντρικής `hatch-pattern-geometry.ts`.

### 4.2 Επέκταση `HatchEntity` (MOD `types/entities.ts`)

```typescript
export type HatchFillType = 'solid' | 'user-defined' | 'predefined' | 'gradient';
export type HatchIslandStyle = 'normal' | 'outer' | 'ignore';
export type HatchGradientName =
  | 'LINEAR' | 'CYLINDER' | 'INVCYLINDER'
  | 'SPHERICAL' | 'INVSPHERICAL' | 'HEMISPHERICAL' | 'CURVED';

export interface HatchEntity extends BaseEntity {
  type: 'hatch';
  // Geometry
  boundaryPaths: Point2D[][];        // κύριο + νησιά (closed rings, OCS)
  seedPoints?: Point2D[];            // pick-point sources (για round-trip)
  boundaryEntityIds?: string[];      // associative: IDs οντοτήτων-ορίου (Φ7)
  // Fill
  fillType: HatchFillType;           // default: 'solid'
  islandStyle: HatchIslandStyle;     // default: 'normal' (DXF 75=0)
  // Solid / color
  fillColor?: string;                // hex · solid + gradient color A
  // User-defined lines
  lineAngle?: number;                // μοίρες (default 0)
  lineSpacing?: number;              // σε DXF units (default 5)
  doubleCrossHatch?: boolean;        // DXF 77
  // Predefined pattern
  patternName?: string;              // 'ANSI31', 'AR-CONC'…
  patternScale?: number;             // DXF 41 (default 1.0)
  patternAngle?: number;             // DXF 52 (default 0)
  // Gradient
  gradientName?: HatchGradientName;  // DXF 470 (default 'LINEAR')
  gradientColor2?: string;           // hex · two-color gradient
  gradientAngle?: number;            // DXF 460 (radians)
  gradientShift?: number;            // DXF 461 (0.0-1.0)
  gradientTint?: number;             // DXF 462 (0.0-1.0, single-color)
  // Pattern origin — Revit style (Q7)
  patternOrigin?: Point2D;           // σημείο από το οποίο ξεκινάει το μοτίβο· default = lower-left bbox
  // Appearance (Q9)
  opacity?: number;                  // 0-100, default 100· DXF group 440 (0=opaque, 255=transparent)
  // Layer (Q8) — κληρονομείται από BaseEntity.layer· default 'ΓΡΑΜΜΟΣΚΙΑΣΗ'
}
```

### 4.3 Modules — πλήρης λίστα

| # | Module | Ρόλος | NEW/MOD | Φάση |
|---|---|---|---|---|
| 1 | `types/entities.ts` | Επέκταση `HatchEntity` (§4.2) | MOD | Φ1 |
| 2 | `data/hatch-pattern-catalog.ts` | 30+ PAT-derived patterns: `{ name, label_el, label_en, lines: PatternLine[] }` | NEW | Φ1 |
| 3 | `bim/geometry/shared/hatch-pattern-geometry.ts` | SSoT: boundary + pattern → render segments (επαναχρήση `buildAxisAlignedHatch`) | NEW | Φ1 |
| 4 | `rendering/entities/HatchRenderer.ts` | Canvas renderer (thin consumer #3· μοτίβο `FloorFinishRenderer`) | NEW | Φ1 |
| 5 | `rendering/core/EntityRendererComposite.ts` | Register `'hatch'` → `HatchRenderer` | MOD | Φ1 |
| 6 | `export/core/dxf-ascii-writer.ts` (`emitHatch`) | Εγγραφή `AcDbHatch` (polyline boundary, non-assoc πρώτα) | MOD | Φ1 |
| 7 | `hooks/drawing/useHatchTool.ts` | Tool: idle→selectBoundary→committed· mode A (Φ1) + mode B (Φ3) | NEW | Φ1/Φ3 |
| 8 | `hooks/canvas/canvas-click-tool-types.ts` | `HatchToolLike` interface | MOD | Φ1 |
| 9 | `hooks/canvas/canvas-click-tool-handlers.ts` | Route `hatch` tool clicks | MOD | Φ1 |
| 10 | `ui/ribbon/data/home-tab-draw.ts` | Κουμπί «Γραμμοσκίαση» (`commandKey: 'hatch'`) | MOD | Φ1 |
| 11 | `ui/contextual/contextual-hatch-tab.ts` | Contextual panel: fillType, patternName, scale, angle, color, islandStyle | NEW | Φ1 |
| 12 | `i18n/locales/{el,en}/dxf-viewer.json` | `ribbon.commands.hatch`, `tools.hatch.*` | MOD | Φ1 |
| 13 | `i18n/locales/{el,en}/dxf-viewer-shell.json` | `hatch.patterns.*`, `hatch.properties.*`, `hatch.islandStyle.*` | MOD | Φ1 |
| 14 | `utils/dxf-entity-converters.ts` | `case 'HATCH'` → `HatchEntity` (DXF import) | MOD | Φ6 |
| 15 | `bim/geometry/shared/hatch-origin.ts` | SSoT για pattern origin: `resolvePatternOrigin(entity)` → lower-left bbox default, override από `patternOrigin` field | NEW | Φ1 |
| 16 | `hooks/drawing/useHatchOriginPicker.ts` | Tool sub-hook: εκκρεμεί κλικ → ορίζει `patternOrigin` στο entity (Revit «Set Origin» mode) | NEW | Φ2 |
| 17 | Associative reactive system | Subscription: boundary entity change → `recomputeHatchBoundary()` | NEW | Φ7 |

### 4.4 UX Flow (Τρόπος Β — click-first)

```
1. Χρήστης κλικάρει «Γραμμοσκίαση» στο ribbon
2. Tool ενεργοποιείται (cursor αλλάζει)
3α. [Τρόπος Α] Χρήστης κλικάρει ΠΑΝΩ σε κλειστή πολυγραμμή/rect
    → boundary = τα vertices της πολυγραμμής
3β. [Τρόπος Β] Χρήστης κλικάρει ΜΕΣΑ σε περιοχή
    → `handleAutoAreaClick()` βρίσκει το κλειστό όριο αυτόματα
4. Δημιουργείται HatchEntity (solid fill, Normal island, default color)
   → εμφανίζεται ΑΜΕΣΑ στο canvas
5. Contextual panel ανοίγει δεξιά:
   [Τύπος: Solid ▼] [Μοτίβο: — ] [Κλίμακα: 1.0] [Γωνία: 0°]
   [Χρώμα: ■] [Νησιά: Normal ▼]
6. Χρήστης αλλάζει ρυθμίσεις → live preview στο canvas
```

### 4.5 ADR-040 compliance (canvas performance)

- `HatchRenderer` = **leaf consumer** — μόνο `useSyncExternalStore` για hatch entities.
- **Καμία** high-freq subscription σε orchestrators (`CanvasSection`, `CanvasLayerStack`).
- Pattern geometry computation = **pure function** (δεν αλλάζει κατά το render loop).
- Για πυκνά μοτίβα: cache computed segments (hash: boundaryPaths + patternName + scale + angle).

### 4.6 DXF writer — `emitHatch()` (non-associative polyline boundary)

```
0\nHATCH\n
5\n{handle}\n
100\nAcDbEntity\n
8\n{layer}\n
100\nAcDbHatch\n
10\n0.0\n  20\n0.0\n  30\n0.0\n    ← elevation
210\n0.0\n 220\n0.0\n 230\n1.0\n   ← normal
2\n{patternName}\n
70\n{solidFlag}\n
71\n0\n                              ← non-associative (Φ1-6)
91\n{pathCount}\n
[ανά path:]
  92\n{pathTypeFlag}\n               ← 1+2=3 (external polyline)
  93\n{vertexCount}\n
  72\n0\n                            ← no bulge
  73\n1\n                            ← closed
  [ανά vertex: 10\nx\n 20\ny\n]
75\n{islandStyle}\n                  ← 0/1/2
76\n{patternType}\n
[αν pattern: 52\n{angle}\n 41\n{scale}\n 78\n{lineCount}\n ...]
47\n0.0442\n                        ← default pixel size
98\n{seedCount}\n
[ανά seed: 10\nx\n 20\ny\n]
```

**Solid hatch**: `70=1`, `patternName=SOLID`, `78=0` (καθόλου pattern lines).

---

## 5. Κατάλογος Predefined Patterns (`data/hatch-pattern-catalog.ts`)

30+ patterns, PAT-derived, με ελληνική + αγγλική ετικέτα:

| ID | Ελληνικά | English | Κατηγορία |
|---|---|---|---|
| `ANSI31` | Διαγώνιες 45° | Diagonal lines 45° | Γενικά |
| `ANSI32` | Σταυρωτές 45° | Cross-hatch 45° | Γενικά |
| `ANSI33` | Τεθλασμένες | Angled cross | Γενικά |
| `ANSI34` | Μεγάλες διαγώνιες | Wide diagonal | Γενικά |
| `ANSI35` | Κεκλιμένες | Slanted | Γενικά |
| `ANSI36` | Μεγάλες σταυρωτές | Wide cross | Γενικά |
| `ANSI37` | Πλέγμα 45° | Diamond grid | Γενικά |
| `ANSI38` | Κεκλιμένες πυκνές | Dense slanted | Γενικά |
| `AR-CONC` | Σκυρόδεμα | Concrete | Κατασκευή |
| `AR-BRSTD` | Τούβλο (πρότυπο) | Brick standard | Κατασκευή |
| `AR-B816` | Τούβλο 8×16 | Brick 8×16 | Κατασκευή |
| `AR-B88` | Τούβλο 8×8 | Brick 8×8 | Κατασκευή |
| `AR-HBONE` | Ψαροκόκαλο | Herringbone | Κατασκευή |
| `AR-SAND` | Άμμος | Sand | Κατασκευή |
| `EARTH` | Χώμα | Earth | Έδαφος |
| `GRAVEL` | Χαλίκι | Gravel | Έδαφος |
| `GRASS` | Γρασίδι | Grass | Έδαφος |
| `MUDST` | Λάσπη | Mud / Silt | Έδαφος |
| `STEEL` | Χάλυβας | Steel | Μέταλλο |
| `CROSS` | Σταυρωτό | Cross | Μέταλλο |
| `CORK` | Φελλός / Μόνωση | Cork / Insulation | Μόνωση |
| `INSUL` | Θερμομόνωση | Thermal insulation | Μόνωση |
| `DOTS` | Κουκκίδες | Dots | Ειδικά |
| `PLAST` | Πλαστικό | Plastic | Ειδικά |
| `PLASTI` | Πλαστικό (τεχνικό) | Plastic (technical) | Ειδικά |
| `BOX` | Κουτιά | Boxes | Ειδικά |
| `BRICK` | Τούβλο (απλό) | Brick (simple) | Κατασκευή |
| `BRSTONE` | Τούβλο + πέτρα | Brick-stone | Κατασκευή |
| `GOST_GLASS` | Γυαλί (GOST) | Glass (GOST) | Ειδικά |
| `WOOD` | Ξύλο | Wood | Ειδικά |
| `SOLID` | Συμπαγές | Solid fill | Βασικά |

---

## 6. Πλάνο Φάσεων

| Φάση | Scope | Modules | Σημείωση |
|---|---|---|---|
| **Φ1** | Solid + user-defined· Τρόπος Α (κλικ σε κλειστή πολυγραμμή)· canvas + DXF write· contextual panel | 1-13 | ΘΕΜΕΛΙΟ |
| **Φ2** | Predefined patterns (30+ κατάλογος)· scale/angle· pattern catalog UI | 2, UI | Requires Φ1 |
| **Φ3** | Pick-point mode (Τρόπος Β)· `auto-area` SSoT | 7 (extension) | Requires Φ1 |
| **Φ4** | Island detection με τρύπες (Normal/Outer/Ignore)· multi-boundary canvas· evenodd fill rule | 3, 4, 11 | Requires Φ3 |
| **Φ5** | Gradient fill· canvas gradient· DXF 450-470 | 1(ext), 4(ext), 6(ext) | Requires Φ1 |
| **Φ6** | DXF import (reader converter `case 'HATCH'`)· round-trip | 14 | Requires Φ1 |
| **Φ7** | Associative hatch· `boundaryEntityIds`· reactive recalc· DXF `71=1`+`97/330` | 15 | Requires Φ6 · πολύπλοκο |

---

## 7. Συνέπειες (Consequences)

**Θετικά:**
- Πλήρης παριτότητα με AutoCAD hatch (BHATCH-level UX).
- Ενεργοποίηση «νεκρού» `HatchEntity` — ήδη στο type system.
- Round-trip: import DXF με hatch → render → export → AutoCAD-compatible.
- Πλήρης SSoT: μία γεωμετρία → canvas + DXF, μηδέν διπλότυπο.

**Κόστος / ρίσκα:**
- Ορθότητα group-code μετρητών (gotcha §2.6.4) — κρίσιμο.
- Associative (Φ7): σημαντική πολυπλοκότητα reactive system.
- Performance σε πυκνά μοτίβα μεγάλων περιοχών → segment caching αναγκαίο.
- Boundary detection με αλληλεπικαλυπτόμενα σχήματα → edge cases.

---

## 8. Changelog

- **2026-06-20** — DRAFT δημιουργήθηκε. Βαθιά έρευνα AutoCAD hatch (deep-research workflow, 102 agents, πηγές Autodesk DXF ref 2007-2024 + ezdxf). Χαρτογράφηση υπάρχοντος κώδικα (HatchEntity «νεκρό», SSoT προς επαναχρήση). Clarifying Q&A 2 γύροι (10 ερωτήσεις συνολικά): Q1-6 = γεμίσματα/τρόποι/island/assoc/catalog/UX-flow· Q7-10 = hatch origin (Revit style), dedicated layer, opacity, multi-area. Όλες αποφάσεις οριστικές. Status: SPECIFICATION COMPLETE → έτοιμο για υλοποίηση.
