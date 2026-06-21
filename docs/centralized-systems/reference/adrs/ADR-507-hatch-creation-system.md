# ADR-507 — Hatch Creation System (Γραμμοσκιάσεις στο DXF Viewer)

> **Status:** 🟢 SPECIFICATION COMPLETE v6 — Q&A 10 ερωτήσεις + 44 enterprise features (§5β 12 + §5γ 10 + §5δ 10 automations + §5ε 6 pro/BIM + §5στ 6 modern/AI), 10 φάσεις, έτοιμο για υλοποίηση
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

## 5β. Enterprise «Μαγικά» Features — 2ος γύρος έρευνας

*(Βάσει AutoCAD 2024/2025, Revit 2024, ArchiCAD 27, BricsCAD 24, Vectorworks 2024)*

### 5β.1 Gap Tolerance — AutoCAD `HPGAPTOL`

**Τι κάνει:** Επιτρέπει pick-point hatching σε **μη-τέλεια κλειστά** boundaries. Αν δύο γραμμές δεν ακουμπάνε ακριβώς (μικρό gap), το σύστημα το «γεφυρώνει» αυτόματα έως N units.

```
Χωρίς gap tolerance:         Με gap tolerance = 2mm:
┌──────  ──────┐              ┌──────────────┐
│    GAP!      │  → ❌ FAIL   │   ✅ OK      │
└──────────────┘              └──────────────┘
```

**Υλοποίηση:** `HatchEntity.gapTolerance?: number` (default `0`)· pure fn `closeGapsInBoundary(path, tolerance)` → snap endpoints εντός tolerance · στο contextual panel slider 0-10 units.

**DXF:** group code `1001 HATCHBACKGROUNDCOLOR` + `1070 gaptol` στο XDATA section ή ως HATCH variable.

---

### 5β.2 Inherit Properties (Match Hatch) — AutoCAD MATCHPROP / Revit «Pick from existing»

**Τι κάνει:** Ο χρήστης κλικάρει σε **υπάρχουσα** γραμμοσκίαση → το tool κληρονομεί αυτόματα όλες τις ρυθμίσεις (pattern, scale, angle, color, origin, opacity, islandStyle) → το επόμενο κλικ εφαρμόζει τις ίδιες ρυθμίσεις σε νέα περιοχή.

**UX flow:**
```
[Γραμμοσκίαση] ribbon → [Κληρονόμησε ▼] → κλικ σε υπάρχουσα → ✅ settings αντιγράφηκαν → κλικ σε νέα περιοχή
```

**Υλοποίηση:** sub-mode `'inherit'` στο `useHatchTool`· `resolveHatchFromEntity(entity): HatchSettings`· αποθηκεύεται στο `HatchToolStore.lastUsedSettings` → επαναχρησιμοποιείται αυτόματα για το επόμενο pick.

---

### 5β.3 Draw Order — AutoCAD `HPDRAWORDER` (group code `284`)

**Τι κάνει:** Ορίζει πού εμφανίζεται η γραμμοσκίαση στο z-stack:

| Τιμή | Σημασία | Πότε |
|---|---|---|
| `0` | Χωρίς αλλαγή | — |
| `1` | Πίσω από όλες τις οντότητες | Default (γραμμοσκιάσεις κάτω) |
| `2` | Μπροστά από όλες | — |
| `3` | Πίσω από το boundary | Πιο συχνό επαγγελματικά |
| `4` | Μπροστά από το boundary | — |

**Default επαγγελματικό: `1` (πίσω από όλα)** — οι γραμμές του boundary φαίνονται πάντα.

**Υλοποίηση:** `HatchEntity.drawOrder?: 0|1|2|3|4`· canvas: HatchRenderer render order (πριν ή μετά τα υπόλοιπα entities)· DXF: group `284`.

---

### 5β.4 Background Color — AutoCAD `HPBACKCOLOR` (group code `63`/`421`)

**Τι κάνει:** Γεμίζει το εσωτερικό του boundary με **χρώμα φόντου** και μετά σχεδιάζει το μοτίβο από πάνω. Δημιουργεί εφέ «χρωματιστό φόντο με γραμμές».

```
Χωρίς background:    Με background (γαλάζιο):
│//////////│          │░░░░░░░░░░│  ← γαλάζιο φόντο
│//////////│          │░/░/░/░/░/│  ← διαγώνιες από πάνω
```

**Υλοποίηση:** `HatchEntity.backgroundColor?: string`· canvas: `ctx.fillStyle = backgroundColor` → fill → μετά pattern lines · DXF: group `63` (ACI color) ή `421` (true-color).

---

### 5β.5 🌟 Material → Hatch Mapping (Revit-style Automation) — ΤΟ ΠΙΟ «ΜΑΓΙΚΟ»

**Τι κάνει η Revit:** Κάθε υλικό (Material) έχει ορισμένο **Cut Pattern** (τι εμφανίζεται στην τομή) και **Surface Pattern** (τι εμφανίζεται στην κάτοψη). Όταν τοποθετείς έναν τοίχο από σκυρόδεμα, η τομή του εμφανίζει **αυτόματα** AR-CONC. Δεν χρειάζεται να βάλεις χειροκίνητα γραμμοσκίαση.

**Για το Nestor:** Κάθε BIM entity (κολώνα σκυρόδεμα, τοίχος τούβλο, πλάκα ξύλο…) θα έχει αυτόματα τη σωστή γραμμοσκίαση στις 2D προβολές.

**Υλοποίηση (SSoT):**
```typescript
// NEW: data/material-hatch-map.ts
export const MATERIAL_HATCH_MAP: Record<string, HatchSettings> = {
  'concrete':     { patternName: 'AR-CONC', patternScale: 1.0, fillColor: '#808080' },
  'brick':        { patternName: 'AR-BRSTD', patternScale: 1.0, fillColor: '#CC6633' },
  'wood':         { patternName: 'WOOD', patternScale: 0.5, fillColor: '#8B6914' },
  'steel':        { patternName: 'ANSI31', patternScale: 0.5, fillColor: '#404040' },
  'insulation':   { patternName: 'INSUL', patternScale: 1.0, fillColor: '#FFFF99' },
  'earth':        { patternName: 'EARTH', patternScale: 1.0, fillColor: '#8B4513' },
  'glass':        { fillType: 'solid', fillColor: '#ADD8E6', opacity: 30 },
};

// Auto-hatch when BIM entity has known material:
export function resolveAutoHatch(entity: BimEntity): HatchSettings | null
```

**Trigger:** `FloorFinishEntity` / `ColumnEntity` / `BeamEntity` με γνωστό υλικό → `resolveAutoHatch()` → αν δεν υπάρχει χειροκίνητη γραμμοσκίαση, εφαρμόζεται αυτόματα.

---

### 5β.6 Live Preview on Hover (Ghost Hatch)

**Τι κάνουν AutoCAD 2020+, Revit:** Καθώς ο cursor κινείται πάνω σε μια κλειστή περιοχή, εμφανίζεται **ζωντανό φάντασμα** της γραμμοσκίασης με ημιδιαφάνεια, πριν το κλικ.

**Υλοποίηση:** `HatchGhostRenderer.ts` (mirror `ColumnAnchorGhostRenderer`)· ADR-040-safe (leaf, δεν subscribe σε high-freq)· `HatchGhostStore` (zero React state)· εμφανίζεται κατά το hover πάνω σε detected closed area.

---

### 5β.7 Pattern Thumbnail Preview (Visual Catalog)

**Τι κάνουν Revit / BricsCAD:** Ο κατάλογος μοτίβων δείχνει **miniature preview** κάθε pattern (όχι απλό κείμενο).

**Υλοποίηση:** `HatchPatternPreview` component — mini offscreen canvas 40×40px που ζωγραφίζει κάθε pattern σε μικρογραφία. SSoT: reuse `hatch-pattern-geometry.ts`. Εμφανίζεται στο dropdown του contextual panel.

---

### 5β.8 Smart Auto-Scale (Drawing Unit Aware)

**Τι κάνουν ArchiCAD 27, Vectorworks:** Το spacing του μοτίβου **αυτόματα αναπροσαρμόζεται** βάσει της κλίμακας σχεδίου (1:50, 1:100) ώστε να φαίνεται οπτικά σωστό σε εκτύπωση — όχι πολύ πυκνό, όχι πολύ αραιό.

**Υλοποίηση:** `resolveAdaptivePatternScale(baseScale, drawingScale)` → pure fn· `drawingScale` από `ViewportStore`· εφαρμόζεται κατά render (canvas + DXF export). Override: ο χρήστης μπορεί να «κλειδώσει» manual scale.

---

### 5β.9 Wipeout Masking Hatch

**Τι κάνει AutoCAD WIPEOUT:** Solid λευκή γραμμοσκίαση που **κρύβει** ό,τι βρίσκεται κάτω (χρησιμοποιείται για legend boxes, title blocks, masked labels).

**Υλοποίηση:** `fillType: 'solid'` + `fillColor: '#FFFFFF'` + `drawOrder: 2` (μπροστά από όλα) + dedicated ribbon button «Masking».

---

### 5β.10 Hatch Edit — Double-click / Edit Boundary

**Τι κάνουν AutoCAD + Revit:** Double-click σε υπάρχουσα γραμμοσκίαση → edit mode: μπορείς να **προσθέσεις/αφαιρέσεις loops** (νησιά), να αλλάξεις ρυθμίσεις.

**Υλοποίηση:** `useHatchEditTool` — ξεχωριστό edit hook· double-click trigger (ADR-040 safe)· επιτρέπει `AddLoop` / `RemoveLoop` commands· `HatchLoopEditCommand` → `appendToLast` για undo.

---

### 5β.11 Recent & Favorite Patterns

**Τι κάνουν AutoCAD 2024 Quick Access / BricsCAD:** Τα τελευταία 5 χρησιμοποιηθέντα patterns εμφανίζονται στην κορυφή του dropdown (χωρίς scroll). «Star» για αγαπημένα.

**Υλοποίηση:** `HatchToolStore.recentPatterns: string[]` (max 5, FIFO)· persisted στο `localStorage`· εμφανίζεται ως «Πρόσφατα» section στο pattern dropdown.

---

### 5β.12 Undo-safe Batch Hatch (CompoundCommand)

**Αυτοματοποίηση:** Όταν ο χρήστης κάνει πολλά picks σε μία session (mode B, πολλές περιοχές), **ένα Ctrl+Z** ακυρώνει **όλα** τα picks της session (compound undo) — όχι ένα-ένα. Μοτίβο: `CompoundCommand` (reuse ADR-488 pattern).

---

## 5γ. Enterprise Features — 3ος γύρος (deep analysis)

*(AutoCAD 2024/2025 TRIM/HATCHSEPARATE/HATCHMERGE, Revit 2024 Materials Surface+Cut Pattern, BricsCAD 24, ArchiCAD 27)*

### 5γ.1 🔴 Trim Hatch (TRIM on hatch entity)

**Τι κάνει:** Ο χρήστης σχεδιάζει μια γραμμή που «κόβει» υπάρχουσα γραμμοσκίαση → το τμήμα που είναι εκτός της γραμμής αφαιρείται. Αποτέλεσμα: νέο boundary που ακολουθεί τη γραμμή κοπής.

```
Πριν:                 Μετά TRIM (κόψιμο στα δεξιά):
┌──────────────┐       ┌──────┐
│//////////////│  →    │//////│
│//////////////│       │//////│
└──────────────┘       └──────┘
                  ↑ cutting line εδώ
```

**Υλοποίηση:**
- `TrimHatchCommand` — υπολογίζει τομή cutting line με boundary polygon → `polygon-clip-utils.ts` (SSoT) → νέο boundary · `CompoundCommand` wrapper (1 undo).
- Canvas: ADR-040-safe (leaf re-render).
- Ribbon: ενεργό μόνο όταν επιλεγμένη γραμμοσκίαση + τουλάχιστον 1 cutting entity.

---

### 5γ.2 🔴 Custom PAT File Import (Enterprise Extensibility)

**Τι κάνει:** Ο χρήστης ανεβάζει δικό του `.PAT` αρχείο → parse → προστίθεται στον κατάλογο μόνιμα (localStorage).

```
[+ Εισαγωγή PAT] → file picker → parse PAT syntax → preview → [Αποθήκευση]
→ εμφανίζεται στον κατάλογο στην κατηγορία «Δικά μου»
```

**Υλοποίηση:**
- `parsePat(raw: string): PatternDefinition[]` — pure parser για PAT syntax (angle, origin, delta-x/y, dashes).
- `UserPatternStore` — persisted σε localStorage· merge με `hatch-pattern-catalog.ts` κατά runtime.
- UI: «Εισαγωγή .PAT» κουμπί στον κατάλογο· thumbnail preview αμέσως μετά parse.
- Validation: ελέγχει syntax, μέγιστο 50 patterns, max 1MB.

---

### 5γ.3 🔴 Area Calculation — Αυτόματη Εμφάνιση m²

**Τι κάνει:** Κάθε γραμμοσκίαση γνωρίζει και εμφανίζει αυτόματα το **εμβαδόν** της περιοχής (σε m² ή mm²).

```
Γραμμοσκίαση επιλεγμένη:
┌──────────────┐
│//////////////│   Status bar: «Εμβαδόν: 24.5 m²»
│//////////////│   Tooltip on hover: «24.50 m²»
└──────────────┘   Properties panel: [Εμβαδόν: 24.50 m²] (read-only)
```

**Υλοποίηση:**
- `computeHatchArea(boundaryPaths: Point2D[][]): number` — pure fn· shoelace formula (SSoT `polygon-utils.ts`)· αφαιρεί νησιά (holes).
- `resolveHatchAreaM2(entity: HatchEntity, drawingUnits: 'mm'|'m'): number` — unit-aware.
- Εμφάνιση: contextual panel (read-only field) + status bar + tooltip on hover.
- **Ομαδικό άθροισμα:** αν επιλεγμένες πολλές γραμμοσκιάσεις → «Συνολικό εμβαδόν: 78.3 m²».

---

### 5γ.4 🟠 Select Similar Hatches

**Τι κάνει:** Δεξί κλικ σε γραμμοσκίαση → «Επιλογή ομοίων» → επιλέγει **όλες** τις γραμμοσκιάσεις με ίδιο `patternName` (και προαιρετικά ίδιο scale/color/layer).

**Υλοποίηση:**
- `selectSimilarHatches(source: HatchEntity, criteria: SimilarCriteria)` — pure filter fn.
- `SimilarCriteria: { matchPattern: boolean, matchScale: boolean, matchColor: boolean, matchLayer: boolean }`.
- Context menu entry: «Επιλογή ομοίων γραμμοσκιάσεων».
- Batch edit: μετά από «Select Similar» → contextual panel αλλάζει όλες μαζί.

---

### 5γ.5 🟠 Pattern Search / Filter in Catalog

**Τι κάνει:** Searchbox στον κατάλογο μοτίβων — ο χρήστης γράφει «conc» ή «τούβ» και φιλτράρεται η λίστα σε real-time.

**Υλοποίηση:**
- Search field πάνω από το pattern dropdown.
- Fuzzy match σε `name` + `label_el` + `label_en` + `κατηγορία`.
- Αν 0 αποτελέσματα → «Δεν βρέθηκε μοτίβο».
- Shortcut: `/` για focus στο search field.
- «Δικά μου» patterns εμφανίζονται πάντα πρώτα στα αποτελέσματα.

---

### 5γ.6 🟠 Hatch Lineweight (Pen Weight για Pattern Lines)

**Τι κάνει:** Οι γραμμές του μοτίβου έχουν **δικό τους** πάχος (ανεξάρτητο από το boundary). Σε επαγγελματικά σχέδια, τα boundaries είναι πιο έντονα και τα μοτίβα πιο λεπτά.

```typescript
// HatchEntity extension:
patternLineweight?: number; // σε mm· default 0.09 (very thin)
```

**DXF:** group code `370` (lineweight) στο AcDbEntity subclass.
**Canvas:** `ctx.lineWidth = patternLineweight * canvasScale`.
**Contextual panel:** slider «Πάχος γραμμών μοτίβου» (0.05mm → 0.5mm).

---

### 5γ.7 🟠 Alignment Continuity (Phase-Locked Adjacent Hatches)

**Τι κάνει:** Όταν τοποθετείς **νέα** γραμμοσκίαση δίπλα σε **υπάρχουσα** του ίδιου μοτίβου, τα μοτίβα ευθυγραμμίζονται αυτόματα (ίδια phase, ίδιο origin).

```
ΧΩΡΙΣ alignment:          ΜΕ alignment continuity:
┌──────┬──────┐            ┌──────┬──────┐
│▓▓│▓▓│░░│░░ │            │▓▓│▓▓│▓▓│▓▓ │  ← συνεχές
│──┼──  ──┼── │            │──┼──  ──┼── │
└──────┴──────┘            └──────┴──────┘
```

**Υλοποίηση:**
- `findAdjacentHatch(newBoundary, entities): HatchEntity | null` — ψάχνει γειτονικές γραμμοσκιάσεις ίδιου pattern.
- Αν βρεθεί → `patternOrigin` της νέας = `patternOrigin` της υπάρχουσας (inherited phase).
- Opt-out: checkbox «Ευθυγράμμιση με γειτονικές» στο contextual panel (default: ON).

---

### 5γ.8 🟠 Plan vs Section Pattern (Revit Material Dual-Fill)

**Τι κάνει:** Ίδιο υλικό → **διαφορετικό μοτίβο** ανάλογα με τον τύπο προβολής:
- **Surface Pattern** (κάτοψη / elevation): ό,τι βλέπεις από πάνω (π.χ. κεραμίδια)
- **Cut Pattern** (τομή): ό,τι «κόβεται» (π.χ. AR-CONC για σκυρόδεμα σε τομή)

```typescript
// material-hatch-map.ts extension:
export interface MaterialHatchDefinition {
  surfacePattern: HatchSettings; // κάτοψη / επιφάνεια
  cutPattern: HatchSettings;     // τομή / κόψιμο
}

export const MATERIAL_HATCH_MAP: Record<string, MaterialHatchDefinition> = {
  'concrete': {
    surfacePattern: { fillType: 'solid', fillColor: '#C0C0C0', opacity: 40 },
    cutPattern:     { patternName: 'AR-CONC', patternScale: 1.0, fillColor: '#808080' },
  },
  'brick': {
    surfacePattern: { patternName: 'AR-BRSTD', patternScale: 0.5, fillColor: '#CC6633' },
    cutPattern:     { patternName: 'BRICK', patternScale: 1.0, fillColor: '#CC6633' },
  },
  'wood': {
    surfacePattern: { patternName: 'WOOD', patternScale: 0.5, fillColor: '#8B6914' },
    cutPattern:     { patternName: 'ANSI31', patternScale: 0.3, fillColor: '#8B6914' },
  },
  'steel': {
    surfacePattern: { fillType: 'solid', fillColor: '#606060' },
    cutPattern:     { patternName: 'ANSI31', patternScale: 0.25, fillColor: '#404040' },
  },
  'insulation': {
    surfacePattern: { patternName: 'INSUL', patternScale: 1.0, fillColor: '#FFFF99' },
    cutPattern:     { patternName: 'INSUL', patternScale: 1.0, fillColor: '#FFFF99' },
  },
  'glass': {
    surfacePattern: { fillType: 'solid', fillColor: '#ADD8E6', opacity: 30 },
    cutPattern:     { fillType: 'solid', fillColor: '#ADD8E6', opacity: 60 },
  },
  'earth':  { surfacePattern: { patternName: 'EARTH', patternScale: 1.0, fillColor: '#8B4513' },
              cutPattern:     { patternName: 'EARTH', patternScale: 1.0, fillColor: '#6B3410' } },
};
```

**`resolveAutoHatch(entity, viewType: 'plan'|'section'|'elevation'): HatchSettings | null`**

**Trigger:** `ViewportStore.viewType` (current 2D view mode) → επιλέγει surface vs cut pattern αυτόματα.

---

### 5γ.9 🟡 Separate & Merge Hatches

**Τι κάνει:**
- **Separate:** 1 `HatchEntity` με πολλά `boundaryPaths` → N ξεχωριστά entities.
- **Merge:** N `HatchEntity` ίδιου pattern → 1 entity με πολλά `boundaryPaths`.

**Υλοποίηση:** `SeparateHatchCommand` + `MergeHatchesCommand` · context menu + ribbon «Εργαλεία» tab.

---

### 5γ.10 🟡 Recreate Boundary (Generate Polyline from Hatch)

**Τι κάνει:** Από υπάρχουσα γραμμοσκίαση → δημιουργεί **πολυγραμμή** που αντιστοιχεί στο boundary (για επεξεργασία ή reuse).

**Υλοποίηση:** `RecreateBoundaryCommand` → `boundaryPaths[0]` → νέο `PolylineEntity`· context menu «Δημιουργία ορίου».

---

## 5δ. Automation Features — 4ος γύρος (pure automations)

*(Συμβαίνουν αυτόματα χωρίς user action)*

### 5δ.1 Auto-Hatch on Polygon Close (Completion Trigger)

**Τι κάνει:** Μόλις ο χρήστης **κλείσει** ένα πολύγωνο/πολυγραμμή (τελευταίο vertex = πρώτο) → το σύστημα εντοπίζει το event και:
- Εμφανίζει **micro-popup**: «Γραμμοσκίαση; [Ναι] [Όχι]» (εξαφανίζεται σε 3s)
- Αν «Ναι» → εφαρμόζει αυτόματα το `lastUsedHatchSettings`
- Αν το hatch tool είναι ήδη ενεργό → αμέσως χωρίς popup

**Υλοποίηση:**
- Hook: `useAutoHatchOnClose()` — subscribe σε `drawing-event-map` event `'polyline:closed'`.
- `HatchCompletionStore` — transient state για το micro-popup.
- Opt-in/out: setting `autoHatchOnClose: boolean` (default: OFF για να μην εκπλήσσει νέους χρήστες, ON στις pro ρυθμίσεις).

---

### 5δ.2 Layer → Hatch Auto-Chain (Layer Name Inference)

**Τι κάνει:** Το σύστημα διαβάζει το **όνομα του layer** της επιλεγμένης περιοχής και προτείνει αυτόματα το κατάλληλο hatch pattern:

```typescript
// NEW: data/layer-hatch-inference.ts
export const LAYER_HATCH_INFERENCE: Record<string, HatchSettings> = {
  // Ελληνικά ονόματα layers (Nestor naming convention)
  'ΤΟΙΧΟΙ':           { patternName: 'AR-BRSTD', patternScale: 1.0 },
  'ΤΟΙΧΟΣ-ΣΚΥΡΟΔΕΜΑ': { patternName: 'AR-CONC',  patternScale: 1.0 },
  'ΤΟΙΧΟΣ-ΤΟΥΒΛΟ':    { patternName: 'AR-BRSTD', patternScale: 1.0 },
  'ΚΟΛΟΝΕΣ':          { patternName: 'AR-CONC',  patternScale: 0.8 },
  'ΔΟΚΑΡΙΑ':          { patternName: 'ANSI31',   patternScale: 0.5 },
  'ΠΛΑΚΕΣ':           { patternName: 'AR-CONC',  patternScale: 1.0 },
  'ΕΔΑΦΟΣ':           { patternName: 'EARTH',    patternScale: 1.0 },
  'ΧΩΜΑ':             { patternName: 'EARTH',    patternScale: 1.0 },
  'ΜΟΝΩΣΗ':           { patternName: 'INSUL',    patternScale: 1.0 },
  // English names (AutoCAD convention)
  'WALLS':            { patternName: 'AR-BRSTD', patternScale: 1.0 },
  'CONCRETE':         { patternName: 'AR-CONC',  patternScale: 1.0 },
  'COLUMNS':          { patternName: 'AR-CONC',  patternScale: 0.8 },
  'INSULATION':       { patternName: 'INSUL',    patternScale: 1.0 },
  'EARTH':            { patternName: 'EARTH',    patternScale: 1.0 },
};

export function inferHatchFromLayer(layerName: string): HatchSettings | null
```

**Trigger:** κατά το pick-point (Τρόπος Β) → `inferHatchFromLayer(detectedLayer)` → αν βρεθεί → pre-fills contextual panel (ο χρήστης μπορεί να αλλάξει). ΔΕΝ override ρητά χειροκίνητη επιλογή.

---

### 5δ.3 Room / Zone Auto-Color (Architectural Automation)

**Τι κάνει:** Κλειστές αρχιτεκτονικές περιοχές (δωμάτια) χρωματίζονται **αυτόματα** βάσει τύπου χρήσης — χωρίς να χρειαστεί ο χρήστης να βάλει χειροκίνητα γραμμοσκίαση:

```typescript
// NEW: data/room-type-hatch-map.ts
export const ROOM_TYPE_HATCH_MAP: Record<string, HatchSettings> = {
  'bedroom':     { fillType: 'solid', fillColor: '#B0C4DE', opacity: 40 }, // steel blue
  'living':      { fillType: 'solid', fillColor: '#90EE90', opacity: 40 }, // light green
  'kitchen':     { fillType: 'solid', fillColor: '#FFD700', opacity: 40 }, // gold
  'bathroom':    { fillType: 'solid', fillColor: '#87CEEB', opacity: 40 }, // sky blue
  'corridor':    { fillType: 'solid', fillColor: '#D3D3D3', opacity: 40 }, // light grey
  'office':      { fillType: 'solid', fillColor: '#DDA0DD', opacity: 40 }, // plum
  'storage':     { fillType: 'solid', fillColor: '#F4A460', opacity: 40 }, // sandy brown
  'parking':     { fillType: 'solid', fillColor: '#808080', opacity: 30 }, // grey
  'stairwell':   { fillType: 'solid', fillColor: '#FFA07A', opacity: 40 }, // salmon
};
```

**Trigger:** Αν entity έχει `roomType` property (future BIM entity) → `resolveRoomHatch(roomType)` → auto-apply. Toggle «Χρωματισμός δωματίων» στο ribbon View tab.

**Σημείωση:** Προϋποθέτει Room/Zone entity type (future scope) — η υλοποίηση του mapping γίνεται τώρα, το trigger όταν υπάρχουν Room entities.

---

### 5δ.4 Smart Pattern Suggestion (Context-Aware)

**Τι κάνει:** Κατά το pick-point, **αναλύει τις γειτονικές οντότητες** και προτείνει το πιο πιθανό pattern:

```
Αλγόριθμος:
1. Βρες τις οντότητες που σχηματίζουν το boundary
2. Κοίταξε τις properties τους (material, layer, entityType)
3. Ψήφισε: αν 3/4 boundary entities = concrete → suggest AR-CONC (confidence 75%)
4. Εμφάνισε στο panel: «Προτεινόμενο: Σκυρόδεμα (AR-CONC) [Εφάρμοσε]»
```

**Υλοποίηση:**
- `suggestHatchPattern(boundaryEntityIds: string[], entities: Entity[]): SuggestionResult` — pure fn.
- Voting: `entityType → material → layer → LAYER_HATCH_INFERENCE → MATERIAL_HATCH_MAP`.
- Confidence threshold: ≥60% → εμφάνισε suggestion chip στο panel.
- Ο χρήστης μπορεί να αγνοήσει (1 κλικ dismiss).

---

### 5δ.5 Explode Hatch to Lines

**Τι κάνει:** Μετατρέπει μια `HatchEntity` σε **ξεχωριστές `LineEntity`** (κάθε γραμμή του μοτίβου → ξεχωριστό αντικείμενο). Χρήσιμο για:
- Legacy DXF compatibility (παλιά software που δεν διαβάζουν HATCH)
- Χειροκίνητη επεξεργασία μεμονωμένων γραμμών
- Export σε formats που δεν υποστηρίζουν HATCH

**Υλοποίηση:**
- `ExplodeHatchCommand` — `hatch-pattern-geometry.ts` (SSoT) → segments → `CreateLineCommand[]` → `CompoundCommand`.
- Context menu: «Διάλυση σε γραμμές».
- ⚠️ Warning: «Η γραμμοσκίαση θα μετατραπεί σε {N} γραμμές. Δεν υποστηρίζεται undo πέρα από αυτό το βήμα.»

---

### 5δ.6 Print vs Screen Toggle (No-Plot Hatch)

**Τι κάνει:** Γραμμοσκίαση με **«Μόνο οθόνη»** — φαίνεται στο canvas αλλά **δεν συμπεριλαμβάνεται στο DXF export / print**. Χρήσιμο για:
- Χρωματικές ενδείξεις για τον σχεδιαστή (workflow visualization)
- Πλάνα φάσεων / στάδια κατασκευής
- Room coloring που δεν τυπώνεται

```typescript
// HatchEntity extension:
noPlot?: boolean; // default false· αν true → παραλείπεται από DXF writer + print
```

**Canvas:** εμφανίζεται με ελαφρά hatched overlay στο thumbnail για να δείξει «screen-only».
**DXF writer:** `if (entity.noPlot) return;` — skip εντελώς.
**Contextual panel:** toggle «Μόνο οθόνη (δεν εκτυπώνεται)».

---

### 5δ.7 Density LOD — Level of Detail per Zoom

**Τι κάνει:** Αυτόματη απλοποίηση rendering ανάλογα με το zoom level:

| Zoom | Rendering |
|---|---|
| < 10% (πολύ μακριά) | Solid color (skip pattern εντελώς) |
| 10%-30% | Κάθε 3η γραμμή (1/3 density) |
| 30%-70% | Κανονικό density |
| > 70% | Full detail |

**Γιατί:** Πυκνά μοτίβα σε μεγάλα σχέδια με zoom-out → χιλιάδες γραμμές → lag. Η AutoCAD το κάνει αυτόματα εσωτερικά.

**Υλοποίηση:**
- `resolveHatchLOD(zoom: number): 'solid'|'sparse'|'normal'|'full'` — pure fn.
- `HatchRenderer` διαβάζει LOD από `useViewportZoom()` (leaf hook, ADR-040-safe).
- Cache: invalidate μόνο αν LOD tier αλλάζει (όχι σε κάθε zoom step).

---

### 5δ.8 Auto-Exclude Text from Boundary

**Τι κάνει:** Κατά το pick-point boundary detection, αν υπάρχουν `TextEntity`/`MTextEntity` **μέσα** στην περιοχή → αυτόματα δημιουργείται **«τρύπα»** γύρω τους (island) ώστε το γέμισμα να μην καλύπτει το κείμενο.

```
ΧΩΡΙΣ auto-exclude:      ΜΕ auto-exclude:
┌──────────────┐           ┌──────────────┐
│//////////////│           │///// __ /////│
│/// «Σαλόνι» //│  →       │//// |  | ////│  ← κενό γύρω από text
│//////////////│           │///// ‾‾ /////│
└──────────────┘           └──────────────┘
```

**Υλοποίηση:**
- `extractTextExclusionZones(entities, boundary): Point2D[][]` — βρίσκει text bboxes μέσα στο boundary → επιστρέφει rectangular islands.
- Integrate στο boundary detection pipeline (Φ3) πριν από island detection.
- Opt-out: setting «Εξαίρεση κειμένου» toggle (default: ON).

---

### 5δ.9 Auto Send-to-Back on Create (Explicit Automation)

**Τι κάνει:** Κάθε νέα `HatchEntity` **αυτόματα** τοποθετείται «πίσω από όλες τις άλλες οντότητες» κατά τη δημιουργία — χωρίς να χρειαστεί χειροκίνητο «Αποστολή στο πίσω».

**Γιατί explicit (δεν αρκεί default `drawOrder`):** Ο `drawOrder=1` (DXF 284) αφορά μόνο DXF export. Στο canvas rendering, το z-order εξαρτάται από τη σειρά εισαγωγής. Χρειάζεται ρητή ενέργεια κατά τη δημιουργία:

```typescript
// CreateHatchCommand.execute():
// 1. addEntity(hatch)
// 2. ΑΥΤΟΜΑΤΑ: sendToBack(hatch.id) ← SSoT call, atomic με το undo
```

**Υλοποίηση:**
- `CreateHatchCommand` καλεί `sendToBack(id)` εσωτερικά — ΟΧΙ ξεχωριστή εντολή.
- `drawOrderStore` (existing SSoT) — reuse.
- Opt-out: setting «Αυτόματα πίσω» (default: ON).

---

### 5δ.10 Hatch Template Inheritance (.dwt-style Defaults)

**Τι κάνει:** Default hatch settings ανά project / template — κάθε νέα γραμμοσκίαση ξεκινά με τις σωστές ρυθμίσεις χωρίς χειροκίνητη επιλογή.

**Cascade κληρονομικότητας:**
```
1. Global app defaults
      ↓ override
2. Layer defaults (LAYER_HATCH_INFERENCE)
      ↓ override
3. Material defaults (MATERIAL_HATCH_MAP)
      ↓ override
4. User last-used (HatchHistoryStore)
      ↓ override
5. Explicit user choice (contextual panel)
```

**Υλοποίηση:**
- `HatchDefaultsStore` — persisted (`dxf-hatch-defaults` localStorage key).
- `resolveHatchDefaults(context: HatchContext): HatchSettings` — pure cascade resolver.
- UI: «Αποθήκευση ως προεπιλογή» κουμπί στο contextual panel.
- Import/Export: `.nestor-hatch-template` JSON αρχείο για μοιρασιά μεταξύ projects.

---

## 5ε. Pro / BIM Features — 5ος γύρος (τελευταία 6 αληθινά κενά)

*(Όχι padding — ό,τι πραγματικά λείπει για 99% παρότητα με μεγάλους παίκτες)*

### 5ε.1 🌟 Annotative Hatches — Constant Plot Density (AutoCAD `ANNOTATIVE`)

**Τι κάνει:** Η πυκνότητα του μοτίβου μένει **σταθερή στο τυπωμένο χαρτί** ανεξάρτητα από την κλίμακα/zoom του σχεδίου ή του viewport.

```
Κλίμακα 1:50   →  τουβλάκια τυπώνονται 3mm
Κλίμακα 1:100  →  ΠΑΛΙ 3mm στο χαρτί (ΟΧΙ 1.5mm)
```

**Διαφορά από §5δ.7 (Density LOD):** Το LOD = απλοποίηση rendering για **ταχύτητα οθόνης**. Το Annotative = **σταθερή πυκνότητα εκτύπωσης** (σημασιολογία plotting, όχι performance).

```typescript
// HatchEntity extension:
annotative?: boolean;            // default false
annotationScale?: number;        // π.χ. 50 για 1:50· null = χρησιμοποίησε active viewport scale
```

**Υλοποίηση:**
- `resolveEffectivePatternScale(entity, viewportScale): number` — αν `annotative` → `patternScale × (annotationScale / viewportScale)`.
- `HatchRenderer` διαβάζει effective scale (leaf hook, ADR-040-safe).
- DXF: group code `1001/1070` annotative XDATA (`AcDbHatch` annotative scale) για round-trip.

---

### 5ε.2 🌟 Model Pattern vs Drafting Pattern (Revit/ArchiCAD Semantic)

**Τι κάνει:** Θεμελιώδης διάκριση — το μοτίβο ζει στο «χαρτί» ή στον «τοίχο»:

```
Drafting pattern: τουβλάκια στην κλίμακα σελίδας (scale με το sheet)
Model pattern:    τουβλάκια αληθινά 250mm το καθένα (scale με τη γεωμετρία· μεγεθύνεις → τα μετράς)
```

```typescript
// HatchEntity extension:
patternSpace?: 'drafting' | 'model'; // default 'drafting'
// 'model' → patternScale ερμηνεύεται ως πραγματικές μονάδες (mm), όχι page units
```

**Υλοποίηση:**
- `resolvePatternWorldScale(entity, drawingUnits): number` — `'model'` → spacing σε world mm (σταθερό στον χώρο)· `'drafting'` → spacing σε page units (scale-relative).
- Στο `MATERIAL_HATCH_MAP` (§5β.5): δομικά υλικά (τούβλο, σκυρόδεμα) → `patternSpace: 'model'` (πραγματικές διαστάσεις)· σχηματικά (μόνωση hatch) → `'drafting'`.
- Συνεργάζεται με §5ε.1: model patterns συνήθως ΔΕΝ είναι annotative (ήδη world-scaled).

---

### 5ε.3 🌟 Material Legend / Key Auto-Generation

**Τι κάνει:** Αυτόματος πίνακας υπομνήματος που **χτίζεται μόνος του** από τα hatches του ενεργού σχεδίου:

```
┌─────────────────────────────┐
│ ▨  Σκυρόδεμα                 │
│ ▦  Τούβλο                    │
│ ░  Μόνωση                    │  ← scan όλων των HatchEntity → unique patterns + material meaning
└─────────────────────────────┘
```

**Υλοποίηση:**
- `buildHatchLegend(entities: Entity[]): LegendRow[]` — pure fn· group by `(patternName + material)` → unique rows.
- `HatchLegendEntity` (NEW entity ή composite group) — τοποθετείται με drag στο σχέδιο, **ενημερώνεται live** όταν προστίθενται/αφαιρούνται hatches.
- Reuse: thumbnail rendering (§5β.7) για το swatch κάθε γραμμής.
- i18n: τα ονόματα υλικών από locale keys (όχι hardcoded).
- Trigger: κουμπί «Υπόμνημα Υλικών» στο ribbon.

---

### 5ε.4 🟠 Image / Block Fill (Super-Hatch)

**Τι κάνει:** Γέμισμα περιοχής με **raster εικόνα** ή **μπλοκ** αντί για γραμμικό μοτίβο (φωτορεαλιστικό ξύλο, πέτρα, γκαζόν). ArchiCAD image fills, AutoCAD SUPERHATCH.

```typescript
// HatchFillType extension:
export type HatchFillType = 'solid' | 'user-defined' | 'predefined' | 'gradient' | 'image' | 'block';

// HatchEntity extensions:
imageUrl?: string;        // για 'image' — tiled raster μέσα στο boundary (clip)
imageTileScale?: number;
blockEntityId?: string;   // για 'block' — επαναλαμβανόμενο μπλοκ μέσα στο boundary
```

**Υλοποίηση:**
- `HatchRenderer`: `'image'` → `ctx.createPattern(img, 'repeat')` + clip στο boundary.
- `'block'` → tile το block geometry μέσα στο boundary (reuse pattern-geometry tiling).
- ⚠️ DXF export: το raster image fill ΔΕΝ έχει native HATCH αντιστοιχία → fallback σε IMAGE entity + clip boundary, ή solid color στο `noPlot=false` path. Καταγραφή ως limitation.
- Storage: εικόνες μέσω `enterprise-id.service` + Firebase Storage (company-scoped, security rules).

---

### 5ε.5 🟠 Boundary Set — Performance Scoping (AutoCAD `HPBOUND`)

**Τι κάνει:** Σε τεράστιο σχέδιο, ο χρήστης περιορίζει την ανίχνευση ορίου (pick-point, Τρόπος Β) σε **επιλεγμένα μόνο αντικείμενα** → το flood-fill δεν σαρώνει όλο το σχέδιο → δεν παγώνει.

```
ΧΩΡΙΣ boundary set:  pick-point σαρώνει 50.000 entities → 4s lag
ΜΕ boundary set:     σαρώνει μόνο τα 20 επιλεγμένα → instant
```

**Υλοποίηση:**
- `HatchBoundaryScopeStore` — προαιρετικό `Set<entityId>` (transient).
- `collectAreaCandidates()` (existing SSoT, `auto-area-hit.ts`) δέχεται optional `scopeIds` filter.
- UI: κουμπί «Όρισε αντικείμενα ορίου» στο contextual panel → ο χρήστης επιλέγει → επόμενα picks scoped.
- Default: scan όλων (current behavior)· scope = opt-in για perf.

---

### 5ε.6 🟠 Live Area Field + Quantity Takeoff (Revit/ArchiCAD Schedule)

**Τι κάνει:** Επέκταση του §5γ.3 (one-time m²) σε **ζωντανό πεδίο** + **πίνακα ποσοτήτων υλικών**:

```
Live field:  text entity δίπλα στο hatch → "12.4 m²" → ενημερώνεται όταν αλλάζει το όριο (associative)
Takeoff:     πίνακας → Σκυρόδεμα: 45.2 m² | Τούβλο: 88.1 m² | Μόνωση: 32.0 m²  (άθροισμα ανά υλικό)
```

**Υλοποίηση:**
- `HatchAreaFieldEntity` (NEW) — text entity με `linkedHatchId`· reactive recalc όταν το hatch boundary αλλάζει (συνεργάζεται με Φ8 associative).
- `buildMaterialTakeoff(entities): TakeoffRow[]` — pure fn· group by material → άθροισμα area· reuse `computeHatchArea` (§5γ.3 SSoT).
- `MaterialTakeoffPanel` — live πίνακας στο ribbon Analyze tab· export CSV.
- ⚠️ Scope: το takeoff αγγίζει BIM scheduling — ξεφεύγει λίγο από καθαρό «DXF viewer». Υλοποίηση στην τελευταία φάση (Φ9, opt-in).

---

## 5στ. Modern / AI Tier — 6ος γύρος (η «τελειότητα» 2024-2026)

*(Σύγχρονοι αυτοματισμοί AI / cloud / data-driven — ό,τι κάνουν οι μεγάλοι ΤΩΡΑ, πέρα από κλασικό CAD)*

### 5στ.1 ⭐⭐ Data-Driven Heatmap Hatch — ΤΟ ΜΟΝΑΔΙΚΟ ΜΑΣ ΠΛΕΟΝΕΚΤΗΜΑ

**Τι κάνει:** Το γέμισμα γίνεται **ζωντανός χάρτης θερμότητας** οδηγούμενος από δεδομένα της **υπάρχουσας μηχανής ανάλυσης** (FEM, διαγράμματα M/V/N, utilization ratio).

```
Πλάκα utilization 95%  →  🔴 κόκκινο γέμισμα
Πλάκα utilization 60%  →  🟡 κίτρινο
Πλάκα utilization 40%  →  🟢 πράσινο
```

**Γιατί μοναδικό:** Κανένας DXF viewer δεν το έχει. Εμείς το παίρνουμε **σχεδόν δωρεάν** γιατί τα νούμερα υπάρχουν ήδη (ADR-480/481/483 analytical model, M/V/N).

```typescript
// HatchFillType extension:
// ...| 'data-driven'

// HatchEntity extensions:
dataSource?: 'utilization' | 'moment' | 'shear' | 'axial' | 'deflection' | 'thermal';
dataColorRamp?: 'red-green' | 'blue-red' | 'viridis' | 'grayscale'; // colorblind-safe option
dataRange?: { min: number; max: number };  // null = auto από scene min/max
```

**Υλοποίηση:**
- `resolveDataDrivenColor(entity, analysisResult, ramp): string` — pure fn· διαβάζει το active analysis result SSoT (FEM store)· map value→color μέσω ramp.
- `HatchRenderer`: `'data-driven'` → solid fill με το resolved color· **reactive** σε αλλαγή ανάλυσης (leaf hook, ADR-040-safe).
- Legend auto (§5ε.3): color-ramp scale bar με min/max τιμές.
- Reuse: ΟΛΗ η αλυσίδα ανάλυσης υπάρχει — μόνο το mapping value→color είναι νέο.
- ⚠️ DXF export: το data-driven «παγώνει» στο τρέχον solid color κατά την εξαγωγή (στιγμιότυπο).

---

### 5στ.2 🌟 Construction Phasing Hatches (Revit Phases)

**Τι κάνει:** Κάθε hatch ανήκει σε **φάση κατασκευής**· εμφάνιση/χρωματισμός ανά φάση:

```
Υπάρχον      →  γκρι γέμισμα
Καθαίρεση    →  διαγώνιες διακεκομμένες (κόκκινο)
Νέα κατασκευή →  συμπαγές
```

```typescript
// HatchEntity extension:
constructionPhase?: 'existing' | 'demolition' | 'new' | 'temporary';
```

**Υλοποίηση:**
- `PHASE_HATCH_STYLE_MAP` — προκαθορισμένο style ανά φάση (color + pattern override).
- `PhaseFilterStore` — ποιες φάσεις είναι ορατές (toggle ribbon).
- `HatchRenderer` εφαρμόζει phase override πάνω από το base style· κρύβει αν η φάση είναι off.
- Συνεργάζεται με §5δ.6 (no-plot) για phase-specific εκτυπώσεις.

---

### 5στ.3 🌟 AI Space Detection → Auto-Hatch

**Τι κάνει:** AI/heuristic ανιχνεύει τα **κλειστά δωμάτια** + μαντεύει τύπο (από διαστάσεις/περιεχόμενο) → αυτόματο γέμισμα. Συμπληρώνει το §5δ.3 (που προϋπέθετε γνωστό `roomType`).

```
Αλγόριθμος:
1. Εντόπισε κλειστούς βρόχους τοίχων (reuse auto-area-hit.ts)
2. Μέτρα εμβαδόν + αναλογίες + περιεχόμενα entities
3. Ταξινόμησε: μικρό+υδραυλικά → 'bathroom'· μεγάλο+άνοιγμα → 'living'
4. Auto-apply ROOM_TYPE_HATCH_MAP (§5δ.3) με confidence
```

**Υλοποίηση:**
- `detectEnclosedSpaces(entities): DetectedSpace[]` — pure fn (reuse `collectAreaCandidates` SSoT).
- `classifySpaceType(space): { type, confidence }` — heuristic v1 (rules)· ML-ready interface για future model.
- Trigger: κουμπί «Αυτόματος χρωματισμός χώρων» → batch με preview + confirm.
- ⚠️ Confidence < 50% → δεν χρωματίζει, ζητά επιβεβαίωση.

---

### 5στ.4 🟠 Pattern Aligned-to-Element (Follow Geometry)

**Τι κάνει:** Το μοτίβο **ακολουθεί** την κατεύθυνση του host element (τοίχος/καμπύλη) αντί σταθερής γωνίας. Σε καμπύλο τοίχο, τα τουβλάκια λυγίζουν μαζί του.

```typescript
// HatchEntity extension:
alignToElement?: boolean;        // default false
alignElementId?: string;         // host· η γωνία μοτίβου = εφαπτομένη του element
```

**Υλοποίηση:**
- `resolvePatternAngleAlongElement(point, element): number` — εφαπτομένη γωνία στο σημείο.
- `HatchRenderer`: αν `alignToElement` → ανά segment υπολογίζει local γωνία (piecewise για καμπύλες).
- Reuse: tangent helpers από geometry SSoT (`projectPointOn*` family).

---

### 5στ.5 🟠 Auto Gap-Healing (Active Boundary Closure)

**Τι κάνει:** Πέρα από το §5β.1 (παθητική ανοχή): **σχεδιάζει ενεργά** το τμήμα που κλείνει μικρό κενό στο όριο → εγγυημένα κλειστό boundary. BricsCAD.

```
Κενό 5mm στη γωνία  →  auto-draw closing segment  →  boundary κλειστό, hatch valid
```

**Υλοποίηση:**
- `healBoundaryGaps(loop, tolerance): { healed: Point2D[], addedSegments: Segment[] }` — pure fn.
- Διαφορά από gap tolerance: το tolerance **αγνοεί** το κενό· το healing **το γεμίζει** ρητά (ορατό κλείσιμο).
- Opt-in: «Αυτόματο κλείσιμο κενών» στο contextual panel· εμφανίζει τα added segments με preview.

---

### 5στ.6 🟠 GPU / WebGL Rendering για Μαζικά Hatches

**Τι κάνει:** Για τεράστια hatches (χιλιάδες γραμμές μοτίβου), rendering μέσω **WebGL** αντί canvas2D → χωρίς lag.

**Διαφορά από §5δ.7 (LOD):** Το LOD **απλοποιεί** (λιγότερες γραμμές)· αυτό **επιταχύνει** το πλήρες rendering (instanced draw).

**Υλοποίηση:**
- `HatchWebGLRenderer` — instanced line rendering· fallback σε canvas2D αν δεν υποστηρίζεται WebGL.
- Threshold: > N γραμμές (π.χ. 5.000) → switch σε WebGL path αυτόματα.
- ⚠️ Τεχνικά απαιτητικό· integration με υπάρχον canvas pipeline (ADR-040)· τελευταία προτεραιότητα.

---

### 5στ.7 Out of Scope (ειλικρινής καταγραφή — ΔΕΝ υλοποιούνται εδώ)

| Feature | Γιατί out of scope |
|---|---|
| Real-time multi-user collaboration (live cursors) | Αφορά ΟΛΗ την εφαρμογή, όχι hatch-specific |
| Raster/PDF → AI vectorization (Scan2BIM) | Ξεχωριστό βαρύ subsystem |
| Voice / NL commands («γέμισε τα μπάνια») | App-wide AI scope |

---

## 6. Πλάνο Φάσεων

| Φάση | Scope | Σημείωση |
|---|---|---|
| **Φ1 — ΘΕΜΕΛΙΟ** | Solid + user-defined· Τρόπος Α· canvas + DXF write· contextual panel· draw order· background color· opacity· pattern origin· recent patterns· compound undo· **area calculation** | Χρησιμοποιήσιμο αμέσως |
| **Φ2 — Patterns** | Predefined 30+ κατάλογος· thumbnail preview· **pattern search/filter**· scale/angle· **hatch lineweight**· smart auto-scale· inherit properties· **alignment continuity** | Requires Φ1 |
| **Φ3 — Pick Point** | Τρόπος Β (pick-point)· gap tolerance· live ghost preview | Requires Φ1 |
| **Φ4 — Islands** | Island detection· multi-boundary· evenodd· hatch edit loops· **trim hatch**· **separate/merge**· **recreate boundary** | Requires Φ3 |
| **Φ5 — Gradient** | Gradient fill· canvas gradient· DXF 450-470 | Requires Φ1 |
| **Φ6 — Import** | DXF import `case 'HATCH'`· round-trip· **custom PAT import** | Requires Φ1 |
| **Φ7 — Material Auto** | `MATERIAL_HATCH_MAP` (surface+cut patterns)· `resolveAutoHatch(entity, viewType)`· BIM auto-fill· **plan vs section pattern**· **model vs drafting pattern (5ε.2)**· **select similar**· wipeout masking | Requires Φ2 — «η μαγεία» |
| **Φ8 — Associative** | `boundaryEntityIds`· reactive recalc· DXF `71=1`+`97/330`· **live area field (5ε.6)** | Requires Φ6 · πολύπλοκο |
| **Φ9 — Pro/BIM** | **annotative (5ε.1)**· **material legend (5ε.3)**· **image/block fill (5ε.4)**· **boundary set perf (5ε.5)**· **quantity takeoff (5ε.6)** | Requires Φ7+Φ8 — top-tier, opt-in |
| **Φ10 — Modern/AI** | ⭐ **data-driven heatmap (5στ.1)**· **construction phasing (5στ.2)**· **AI space detection (5στ.3)**· **align-to-element (5στ.4)**· **auto gap-healing (5στ.5)**· **WebGL render (5στ.6)** | Requires Φ7+Φ8+Φ9 — η «τελειότητα»· data-driven αξιοποιεί υπάρχουσα FEM μηχανή |

### 6.1 Session breakdown (υλοποίηση, για χαμηλό context-noise)

Οι 10 φάσεις χωρίζονται σε **9 συνεδρίες** (Φ1 → S1 headless + S2 UI). Πλήρες SSoT audit + ανά-session οδηγίες:
**`HANDOFFS/HANDOFF_2026-06-20_adr507-hatch-implementation.md`** (η νέα συνεδρία ξεκινά από εκεί — μηδέν re-audit).

| Session | Φάση | Verify |
|---|---|---|
| S1 | Φ1a (data+render+DXF I/O core) | jest headless |
| S2 | Φ1b (tool wiring+UX) | browser |
| S3 | Φ2 (patterns) · S4 Φ3+Φ4 (pick-point+islands) · S5 Φ5+Φ6 (gradient+import) | browser |
| S6 | Φ7 (material auto) · S7 Φ8+§5δ (associative+automations) · S8 Φ9 (pro/BIM) · S9 Φ10 (modern/AI) | browser |

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

- **2026-06-21** — **§8 DEFER items (β/γ/δ/ε/στ): κλείσιμο των τελευταίων copy-paste κενών της οικογένειας commands (73 jest GREEN· UNCOMMITTED).** Συνέχεια του `SnapshotTransformCommand` base· το item ζ (cascade-SSoT) έγινε από άλλον agent (Phase 3 παρακάτω) → δεν αγγίχτηκε. item α (Move-as-subclass) DEFER (Giorgio).
  - **(γ)** `MoveEntityCommand.ts:150,368` (η ΜΟΝΗ εναπομείνασα inline window copy): `timeDiff < DEFAULT_MERGE_CONFIG.mergeTimeWindow` → `isWithinMergeWindow(this, other)`. Αφαίρεση `DEFAULT_MERGE_CONFIG` import. Behavior-identical.
  - **(δ)** `geometryFromSnapshot` πήρε optional `{ excludeType?: boolean }` (default ΑΘΙΚΤΟ → κρατά `type`). `Extend`/`TrimEntityCommand.geometryUpdates` υιοθέτησαν `geometryFromSnapshot(entity, { excludeType: true })` — εξάλειψη 2 inline `{ id, type, layer, visible, ...rest }` strips που εξαιρούσαν `type`.
  - **(β)** Vertex dragging-gate consistency: `MoveVertexCommand` + `MoveOverlayVertexCommand` (+`MoveMultipleOverlayVerticesCommand`) πήραν `isDragging` (default `false`) στον ctor + gate στο `canMergeWith` (mirror `canMergeTransform`) + `isDragging` στο serialize· `mergeWith` περνά `true`· `CommandRegistry` deserialize περνά `data.isDragging ?? false`. **Διόρθωση bug:** δύο διακριτά edits ίδιας κορυφής <500ms ΔΕΝ ενώνονται πια. Ο μοναδικός real caller (`useGripMovement` grip-drag END + `overlay-grip-commit-adapters`) είναι seal (false), όπως ο entity-grip — όχι per-frame stream (η απόκλιση από το handoff «→ true» τεκμηριώθηκε: το `false` διορθώνει, το `true` θα διαιώνιζε το bug).
  - **(ε)** NEW `utils/set-equality.ts` `sameSet<T>` SSoT (ουδέτερο util — μηδέν cross-layer dependency). Υιοθέτηση: `BimSelectionHighlighter.sameSet` + `IsolateEffectsStore.sameMembership` (2 γνήσια αντίγραφα) → import shared· `merge-window.sameEntityIdSet` delegate `sameSet(new Set(a), new Set(b))`. `mapsEqual` (mep-segment-trim) = Map+value, εκτός.
  - **(στ)** `.ssot-registry.json` +2 modules (`command-merge-window`, `snapshot-geometry-strip`, tier 3) που μπλοκάρουν νέα inline `DEFAULT_MERGE_CONFIG.mergeTimeWindow` + snapshot-strip εκτός των SSoT. 0 violations (allowlist+exempt μόνο, επιβεβ. grep ΟΛΟ το `src/`) → ΚΑΜΙΑ αλλαγή στο file-based baseline. registry-golden 56 GREEN (ERE valid).
  - **Tests**: NEW `set-equality.test.ts` (6) + `snapshot-geometry.test.ts` (3: default keeps type, excludeType drops, id/layer/visible πάντα strip) + `MoveVertexCommand.test.ts` (6: distinct edits no-merge, drag-merge, identity gates). Υπάρχοντα `merge-window`/`SnapshotTransformCommand`/`transform-copy-mode`/`TrimEntityCommand`/`IsolateEffectsStore`/`BimSelectionHighlighter` GREEN αυτούσια. tsc: 0 errors στο `core/commands/` (10 pre-existing σε bim/hooks/ui — άσχετα).
- **2026-06-21** — **Phase 3: transform pipe + slab-opening self-cascade ΜΕΣΑ στο spine — ολοκλήρωση ασυμμετρίας ADR-487 (18 jest GREEN· UNCOMMITTED).** Μετά το ADR-049 Φ2 (vertical move, committed `a751c40b`), το connected-pipe follow ζούσε ΜΕΣΑ στο Move command αλλά το Rotate/Scale/Mirror το έκανε ΜΟΝΟ στον 3D builder (`withConnectedPipeFollow`) — 2D rotate/scale/mirror MEP host άφηνε τα pipes πίσω· τα slab-openings δεν ακολουθούσαν ΚΑΝΕΝΑ transform. Revit «connected ends move with the element» → φέραμε το follow ΜΕΣΑ στο `SnapshotTransformCommand` spine για ΚΑΘΕ transform (rotate/scale/mirror) σε ΚΑΘΕ χειρονομία (2D + 3D).
  - **Γενίκευση 2 engines (transform-agnostic· reuse 100% του pose-based resolver `mep-move-propagation` «rotation covered for free» — μηδέν νέα geometry math):** NEW `bim/mep-segments/cascade-connected-pipes.ts` (`cascadeConnectedPipes(ids, sm, computeNextParams) → {moved, snapshots}`) + NEW `bim/cascade/cascade-transformed-slab-openings.ts` (`cascadeTransformedSlabOpenings(ids, sm, computePatch) → {moved, snapshots}`). Τα `cascade-connected-pipes-by-delta.ts` + `slab-opening-move-cascade.ts` έγιναν **thin wrappers** (move = delta callback) → Move byte-for-byte ίδιο.
  - **Inject στο spine:** NEW private `runForwardFollowerCascades()` τρέχει ΠΡΙΝ το host `updateEntities` (OLD→NEW anchors), feeding `this.computeUpdates` ΚΑΙ στους δύο engines (ΕΝΑ μονοπάτι, μηδέν per-transform branching — pipes παίρνουν τα extracted NEW params, slab-openings το full patch)· τα moved followers μπαίνουν στο ΕΝΑ `reframeBeamsAndEmit`. **Undo = snapshot-symmetric (Επιλογή Α):** NEW `followerSnapshots` map κρατά τα pre-transform pipes+openings στο execute/redo· `undoInPlace` restore-άρει followers+hosts από snapshot στο ΙΔΙΟ batch + emit-first race-guard (ταιριάζει με το snapshot-restore spine· μηδέν inverse math, αντίθετα με το `reverseDelta` του Move).
  - **Αφαίρεση builder wrap:** `bim3d-edit-command-builders.ts` rotate branch → σκέτο `new RotateEntityCommand(...)` (self-cascade τώρα)· αφαίρεση νεκρών `nextParamsFromPatch` + `calculateBimRotatedGeometry` + `SceneEntity` imports. `withConnectedPipeFollow` μένει ΜΟΝΟ για `endpoint-move` (Update-command stretch ενός άκρου, εκτός scope).
  - **Tests**: NEW `cascade-connected-pipes.test.ts` (8) + `cascade-transformed-slab-openings.test.ts` (6) + `SnapshotTransformCommand.followers.test.ts` (4: spine feeds computeUpdates σε αμφότερους engines· moved followers στο emit· undo restore από snapshot· redo re-run). 18 GREEN· υπάρχοντα cascade+transform suites 149 GREEN (pre-existing `AssignWallTypeCommand` undo-guard άσχετο).
  - **Scope (Giorgio confirm):** Rotate + Scale + Mirror ΚΑΙ slab-openings — πλήρης Revit συμμετρία. **🔴 ΕΚΚΡΕΜΕΙ:** browser-verify (2D+3D pipe/opening follow + persist reload + Ctrl+Z ΕΝΑ βήμα)· commit. ⚠️ CHECK 6B/6D → stage ADR-040 (το spine αγγίζει command path). **ΜΑΘΗΜΑ:** ο pose-based resolver έκανε το follow transform-agnostic χωρίς νέα math· spine = snapshot-restore → snapshot-symmetric undo για followers (ΟΧΙ inverse-transform).
- **2026-06-21** — **§8 follow-up (ΔΕΥΤΕΡΗ οικογένεια): NEW `SnapshotTransformCommand` abstract base — SSoT για το in-place transform spine (Move/Rotate/Scale/Mirror) + `merge-window` helper (27 jest GREEN).** Audit (grep + ανάγνωση κάθε command) **διόρθωσε το handoff**: από τα 8 «υποψήφια», τα `AddVertex`/`RemoveVertex`/`InsertTextToken` έχουν `canMergeWith(): return false` (ΚΑΝΕΝΑ merge boilerplate — εκτός scope)· το `Scale` δεν είχε καν `canMergeWith`.
  - **Decision gate:** ΟΧΙ ενιαίο base για όλη την οικογένεια (3 undo models + 3 stores + ζωντανό deserialization contract = leaky, §2/§4 του handoff). Το γνήσιο, μεγάλο διπλότυπο είναι η **snapshot-transform** οικογένεια: `MoveEntity`(+Multiple)/`Rotate`/`Scale`/`Mirror` επαναλάμβαναν τον ΙΔΙΟ in-place σκελετό (snapshot loop → patch → batch commit → `cascadeHostedOpeningsForWalls` + `reframeBeamsAndEmit`· undo = **emit-restore FIRST** [race guard] → restore → cascade → `reframeBeamsAndEmitAfterRestore`· serialize `{entityIds, entitySnapshots[]}`).
  - **NEW** `core/commands/entity-commands/SnapshotTransformCommand.ts` (template-method base): subclass δίνει ΜΟΝΟ `name`/`type` + `computeUpdates(entity)` (το per-entity patch — delta/rotate/scale/mirror) + `getDescription`/`serialize`. Protected helpers: `executeInPlace`/`undoInPlace`/`redoInPlace` (η εξαλειφόμενη επανάληψη), `undoInPlaceWith(inverse)` (delta-style undo για Move), `canMergeTransform(other, extraMatch)` (type-eq + id-set + dragging + window), `baseTransformData()` (canonical serialize spread, mirror του `baseSerializedData()`).
  - **Copy-path ΕΚΤΟΣ base (σκόπιμα — genuinely divergent):** Rotate/Scale = id-clones· **Mirror = whole-entity clones + BIM clone persistence broadcasts** (`mintBimCloneIdentity`/`broadcastBimClone*`). Αυτά μένουν override στα subclasses (καλούν τα `*InPlace` μόνο για το in-place branch). Forcing copy στο base = leaky.
  - **NEW** `core/commands/merge-window.ts`: `isWithinMergeWindow(earlier, later)` (η μία αληθινά κοινή γραμμή, `< DEFAULT_MERGE_CONFIG.mergeTimeWindow`) + `sameEntityIdSet(a, b)` (order/dup-aware). Εφαρμόστηκε ΚΑΙ στο vertex family: `MoveVertexCommand`, `MoveOverlayVertexCommand` (+Multiple) — μηδέν αλλαγή merge-identity.
  - **Migrations (behavior-identical):** Rotate (angle-add merge + same-pivot)· Scale (no merge)· Mirror (no merge)· Move single+multiple (delta-add merge· **undo = `reverseDelta` recompute** μέσω `undoInPlaceWith`, διατηρημένο ως override = behavior-identical Level 2). In-place undo restore: γεωμετρία **εκτός `{id, layer, visible}`** (κρατά `type` → Scale circle→ellipse reversible· Rotate/Mirror type αμετάβλητο = no-op). Base χρησιμοποιεί batch `updateEntities` (πρώην μόνο MoveMultiple· end-state ίδιο, λιγότερα scene commits).
  - **⚠️ Move μένει χωριστά (ΟΧΙ στη base) — αρχιτεκτονικά σωστό:** ο ADR-049 Φ2 (true 3D vertical move, άλλος agent) έδωσε στο Move δικό του πλουσιότερο cascade SSoT `move-entity-cascade.ts` (retarget pipes + slab-openings + reframe). Τα Rotate/Scale/Mirror **δεν** έχουν αυτό το cascade → η base τους ταιριάζει· το Move έχει δικό του delta-based cascade. Δύο cascade μοντέλα = δύο SSoT (όχι ένα).
  - **Tests**: NEW `merge-window.test.ts` (11) + `SnapshotTransformCommand.test.ts` (13: spine execute/undo/redo, snapshot vs `undoInPlaceWith`, identity-fields preserved, merge gate type/set/dragging, serialize) + `transform-copy-mode.test.ts` (3: Scale/Mirror copy clone/undo/redo + id-stable Mirror). `RotateEntityCommand.bim.test.ts` **GREEN αυτούσιο** (refactor διατήρησε behavior). 27 GREEN. tsc: 0 σφάλματα στο `core/commands/` (pre-existing errors σε bim/hooks/ui από ADR-049/511 commit — άσχετα).
  - **DEFER (νέα συνεδρία):** Level 3 = ενοποίηση Move undo σε snapshot-restore (αφαίρεση override)· vertex dragging-gate consistency (το vertex merge ΔΕΝ έχει `isDragging` gate, το transform έχει — χρειάζεται caller plumbing)· πιθανό `.ssot-registry.json` module (forbid νέο merge skeleton).
- **2026-06-21** — **Follow-up: NEW `MergeableUpdateCommand<TPatch>` abstract base — SSoT για το merge/undo/redo boilerplate (20 jest GREEN· UNCOMMITTED).** Το copy-pasted skeleton (`id`/`timestamp`/`wasExecuted`/ctor + `execute`/`undo`/`redo` + `canMergeWith`/`mergeWith` + `getAffectedEntityIds` + `serialize` envelope) ήταν επαναλαμβανόμενο σε ~24 `Update*ParamsCommand`. SSoT audit (grep): δεν υπήρχε abstract base — όλα `implements ICommand` απευθείας (όχι νέο διπλότυπο, ακολουθούσαν την υπάρχουσα σύμβαση).
  - **NEW** `core/commands/entity-commands/MergeableUpdateCommand.ts` (~135 γρ.): template-method base. Subclass δίνει ΜΟΝΟ `name`/`type` + `applyPatch(patch)` (το geometry recompute του) + `withMergedPatch(next)` (1-liner factory) + `validate` + `getDescription` + προαιρετικό `serializedData()` override. **ΜΗΔΕΝ** merge/undo/redo boilerplate ανά subclass.
  - **`canMergeWith` = type-equality** (`other.type === this.type`) αντί `instanceof <ConcreteSubclass>` — ισοδύναμο (μοναδικό `type` ανά subclass) αλλά ζει στο generic base· ο `instanceof MergeableUpdateCommand` guard ΜΟΝΟΣ θα συγχώνευε λάθος 2 διαφορετικά subclasses στην ίδια οντότητα (test #8 το καλύπτει).
  - **Migrated 18 🟢** (byte-for-byte `applyPatch` + legacy `serialize` keys διατηρημένα): Hatch­Boundary, FloorFinish, Railing, ThermalSpace, FloorplanSymbol, Furniture, ElectricalPanel, Array, Opening, Stair, Roof, Mep{Segment,Fixture,Manifold,Radiator,Boiler,WaterHeater,Underfloor}Params. **Roof** = ειδικό: composite `TPatch={params,typeId}` ώστε το directional `typeId` (next/prev) να ταξιδεύει με τα params μέσα από execute/undo/redo (public ctor + serialize αμετάβλητα).
  - **ΕΚΤΟΣ scope (near-miss, §4):** `UpdateMepSystemParamsCommand` — **δεν δέχεται `ISceneManager`** (στοχεύει `getMepSystemMutator()` port· ctor 4-args) + `undo()` χωρίς `wasExecuted` guard → δεν χωράει στο ISceneManager-based base χωρίς αλλαγή behavior. Έμεινε στο hand-written skeleton (το base είναι opt-in, συνυπάρχουν).
  - **β' γύρος STRUCTURAL (ADR-487) — migrate-αρίστηκαν 6** (Giorgio confirm «δεν είναι hot»): `Update{Column,Beam,Slab,SlabOpening,Foundation,Wall}Params`. Όλα standard εκτός: **SlabOpening** = host-slab resolution (mirror Opening)· **Wall** = constant `kind: WallKind` field (ΟΧΙ directional → απλό private field, ΟΧΙ composite· threaded σε withMergedPatch+serialize) + side-effect `cascadeHostedOpeningsForWalls` στο applyPatch· **Column** διαβάζει `useStructuralSettingsStore` (codeId) μέσα στο applyPatch — όλα μεταφέρθηκαν verbatim. **Σύνολο migrated = 24** (18 🟢 + 6 structural)· μόνο `UpdateMepSystemParams` εκτός.
  - **Tests**: NEW `MergeableUpdateCommand.test.ts` (14: execute/undo/redo, wasExecuted guard, canMerge type-equality + cross-type false, mergeWith keeps-earliest-previousPatch, serialize default + override). Υπάρχοντα command tests (Opening/Stair/Array/Column/Beam/Slab/SlabOpening/roof-family-type/mep-manifold-param-update/bim-bulk-update-builder/envelope-region-override) **GREEN αυτούσια** (311 → 310 pass) — μηδέν αλλαγή public behavior. 2 pre-existing failures (`AssignWallTypeCommand` undo-guard· `use-bim3d-opening-move` THREE `scene.add`) **αποδεδειγμένα άσχετα** (το πρώτο δεν εισάγει το base· το δεύτερο αποτυγχάνει ταυτόσημα με το original Opening — verified με stash). **ΜΑΘΗΜΑ:** byte-for-byte = κράτα τα legacy serialize keys ανά subclass (test ελέγχει `data.openingId`)· composite TPatch λύνει directional extras (Roof typeId), constant field λύνει non-directional extras (Wall kind)· near-miss χωρίς ISceneManager μένει εκτός.
  - **Serialize standardization (Giorgio SSoT push — «θα τα άφηνε έτσι η Google;»):** μετά από audit (grep `.data.<idKey>` + `CommandRegistry` factories) αποδείχθηκε ότι τα per-command legacy serialize keys (`finishId`/`columnId`/…) είναι **νεκρά δεδομένα** — **κανένα** `update-*-params` δεν είναι registered για deserialization, **κανείς** δεν διαβάζει `serialized.data.<idKey>` σε production. Άρα το «byte-for-byte» ήταν cosmetic cargo. **Διαγράφηκαν ΟΛΑ τα 22 `serializedData()` overrides** → κληρονομούν το base default `{ entityId, patch, previousPatch, isDragging }` (ένα ενιαίο shape, καλύτερο για audit). Override μένει ΜΟΝΟ όπου υπάρχει **γνήσια έξτρα state**: **Roof** (`typeChange`) + **Wall** (`kind`) — και αυτά **spread το NEW `baseSerializedData()` helper** του base (μηδέν re-spelling των 4 canonical πεδίων· πρόσθεση ΜΟΝΟ του δικού τους delta → ΕΝΑ ενιαίο shape ακόμα και στα special cases· τα παλιά divergent `roofId`/`wallId`/`params` keys εξαλείφθηκαν). **Καθαρισμός tests:** 5 serialize assertions `data.<idKey>`→`data.entityId` (Slab/SlabOpening/Opening/Beam/Column)· 1 πραγματικός consumer-σε-test (`envelope-region-override.service.test.ts` διάβαζε `data.params` ως inspection convenience) → `data.patch`. roof-family-type test ασφαλές (Roof κρατά `roofId`). **ΜΑΘΗΜΑ:** «byte-for-byte» χωρίς απόδειξη κατανάλωσης = διαιώνιση cargo· verify με registry+grep ΠΡΙΝ κρατήσεις legacy shape.
  - **🔴 ΕΚΚΡΕΜΕΙ:** tsc (N.17)· commit (Giorgio). **DEFER:** ξεχωριστό `MergeableMoveCommand` base για την ΑΛΛΗ οικογένεια merge-commands (Move/Rotate/Vertex/Overlay/Text — διαφορετικό snapshot/delta μοντέλο, ΟΧΙ στο δικό μας base)· πιθανό `.ssot-registry.json` module (forbid νέο copy-paste merge skeleton).
- **2026-06-21** — **S2-persist-fix: ΡΙΖΑ «refresh εξαφανίζει» = Firestore nested-array rejection (browser-confirmed 0 docs).** Μετά το rules+indexes deploy η γραμμοσκίαση ΑΚΟΜΑ χανόταν. Διάγνωση με firestore MCP: `floorplan_hatches` **count=0** (walls=3/columns=7 → ο μηχανισμός+scope δουλεύουν· hatch-specific). ΡΙΖΑ: το `boundaryPaths` είναι `Point2D[][]` (**array-of-arrays**)· το **Firestore απαγορεύει nested arrays ΠΑΝΤΟΥ** (ένα array element δεν επιτρέπεται να είναι array — ΟΥΤΕ μέσα σε map· η αρχική υπόθεση «inside a map είναι ΟΚ» ήταν ΛΑΘΟΣ). Το `setDoc` πετούσε → silent catch στο `persist` → 0 docs. Κανένα άλλο BIM entity δεν αποθηκεύει array-of-arrays (όλα single vertex array) → γι' αυτό μόνο το hatch. **Fix** (`hatch-firestore-service.ts`): NEW `HatchBoundaryRing { vertices: Point2D[] }`· `HatchDocData.boundaryPaths: HatchBoundaryRing[]` (array-of-MAPS, legal)· `serializeBoundaryPaths`/`deserializeBoundaryPaths`· `pickHatchData` wraps στο write, `hatchDocToEntity` unwraps στο read· `saveHatch`/`updateHatch` χρησιμοποιούν `input.data` ως έχει (ήδη serialized — όχι διπλό wrap). Runtime shape (`Point2D[][]`) ΑΜΕΤΑΒΛΗΤΟ. Rules/indexes ΔΕΝ αλλάζουν (το `data` μένει «present»). 16 jest (3 νέα: ring serialization + no-nested-array guard). 🔴 browser-verify: σχεδίαση→refresh→ΠΑΡΑΜΕΝΕΙ. **ΜΑΘΗΜΑ:** ΠΟΤΕ array-of-arrays στο Firestore — τύλιξε κάθε inner array σε map· επαλήθευσε write με `firestore_count`, όχι μόνο «rules deployed».
- **2026-06-21** — **S2-fix-3: grip-MOVE editing (σύρσιμο λαβής μετακινεί κορυφή· 8 jest GREEN· UNCOMMITTED).** Μετά το S2-fix-2 οι λαβές εμφανίζονταν αλλά **το σύρσιμο δεν μετακινούσε την κορυφή** (νεκρές λαβές). ΡΙΖΑ: το grip-DRAG→preview→commit pipeline δεν είχε `hatch` (ο `gripToVertexRefs` έπεφτε σε `default: []` → μηδέν vertexMoves → early-return χωρίς command· κανένα live ghost branch). Λύση: **parametric `hatchGripKind` discriminator**, πιστό mirror του `floor-finish` grip-edit (ΟΧΙ ο `StretchEntityCommand`/`VertexKind` δρόμος που θα μόλυνε το shared vertex chain). **Vertex-move μόνο**· edge-midpoint insertion = DEFER.
  - **Encoding**: `hatch-vertex-${pathIdx}-${vertexIdx}` (το hatch έχει πολλαπλά rings — flat index διφορούμενος). Decode άμεσα σε (pathIdx, vertexIdx).
  - **NEW** `bim/hatch/hatch-grips.ts` — pure `applyHatchGripDrag(gripKind, { originalBoundaryPaths, delta, rectilinear })` → translate `boundaryPaths[p][v]`· immutable (clone μόνο του affected ring)· no-op return-original σε out-of-range/zero-delta· `decodeHatchVertexGripKind`· rectilinear→dominant-axis (mirror floor-finish).
  - **NEW** `core/commands/entity-commands/UpdateHatchBoundaryCommand.ts` — patches `{ boundaryPaths }`· **merge-capable** (`canMergeWith`/`mergeWith`, ADR-031 → συνεχές drag = ΕΝΑ undo· το generic `UpdateEntityCommand` ΔΕΝ έχει merge)· χωρίς derived-geometry recompute (το hatch δεν έχει).
  - **NEW** `commitHatchGripDrag` (`grip-parametric-footprint-commits.ts`, re-export από `grip-parametric-commits.ts`)· dispatch στο `grip-commit-adapters.ts` (`if (grip.hatchGripKind) …`).
  - **Type plumbing** `hatchGripKind` (mirror `floorFinishGripKind` σε 9 αρχεία): `grip-kinds` (NEW `HatchGripKind` type)· `grip-types`· `useGripMovement`· `grip-computation-types` (`DxfGripDragPreview`)· `unified-grip-types` (`UnifiedGripInfo`)· `grip-registry`· `grip-projections` (live-ghost forward — **το floor-finish δεν το είχε καν· το hatch αποκτά πλήρες live preview**)· `grip-drag-preview-transform`· `entity-preview-types`· `apply-entity-preview` (live ghost branch). `grip-computation.ts case 'hatch'` εκπέμπει `hatchGripKind`.
  - **Persistence = ΜΗΔΕΝ νέο**: το `useHatchPersistence` auto-save (`dequal(pickHatchData)`) πιάνει την αλλαγή `boundaryPaths` αυτόματα.
  - **Tests**: NEW `bim/hatch/__tests__/hatch-grips.test.ts` (8: decode, vertex-move, multi-ring island, no-op out-of-range/zero, rectilinear quantize, immutability). **ΜΑΘΗΜΑ:** grip-MOVE νέου type = parametric discriminator πρότυπο floor-finish + merge-capable command· τα `grip-projections`/`apply-entity-preview` είναι ΞΕΧΩΡΙΣΤΑ από το commit. ⚠️ CHECK 6D: ghost/grip αρχεία → stage ADR-507(+ADR-040).
  - **SSoT centralization (boy-scout, N.0.2)**: το ORTHO dominant-axis clamp ήταν private αντίγραφο σε 5 αρχεία (floor-finish/slab/slab-opening/rect-grip-engine grips + νέο hatch) → ενοποιήθηκε σε NEW `bim/grips/ortho-delta.ts` `constrainDeltaToDominantAxis` (και τα 5 import το SSoT, 120 grip jest GREEN). Το merge-command boilerplate (~30 `Update*ParamsCommand`) flagged στο pending-ratchet (base-class refactor, ΟΧΙ νέο διπλότυπο — ακολούθησα την υπάρχουσα σύμβαση).
- **2026-06-21** — **S2-fix-2: hover + select + grips (3 προϋπάρχοντα κενά· 3 jest GREEN· UNCOMMITTED).** Browser-verify αποκάλυψε ότι η γραμμοσκίαση **render-άρει αλλά ΔΕΝ φωτίζεται σε hover, ΔΕΝ επιλέγεται, ΔΕΝ δείχνει λαβές**. ΡΙΖΑ: το draw pipeline (`EntityRendererComposite`→`HatchRenderer`) είναι **ξεχωριστό** από το hit-test/grips pipeline (`HitTestingService`→`HitTester`→`hit-test-entity-model`→`hit-test-entity-tests`· grips→`grip-computation`)· ο `HatchRenderer.hitTest/getGrips` υπάρχει αλλά **δεν φτάνεται ποτέ**. Έλειπε `case 'hatch'` σε 3 σημεία:
  - **(blocker) `services/hit-test-entity-model.ts`**: το `default` στρίπαρε το `boundaryPaths` → `BoundsCalculator.calculateHatchBounds`=null → **δεν έμπαινε στο spatial index** → μηδέν candidates σε hover+click. Fix: `case 'hatch'` που περνά `boundaryPaths` (mirror floor-finish direct entity).
  - **(precision) `rendering/hitTesting/hit-test-entity-tests.ts`**: NEW `hitTestHatch` even-odd point-in-polygon (outer ring − island rings, mirror `HatchRenderer.hitTest`)· χωρίς αυτό το `default` έκανε AABB-only over-select.
  - **(grips) `hooks/grip-computation.ts`**: `case 'hatch'` → vertex grip ανά κορυφή ορίου (mirror `HatchRenderer.getGrips`).
  - **Tests**: +3 `hit-test-bim-entities.test.ts` (μέσα→hit· island-τρύπα→miss even-odd· έξω→miss). **ΜΑΘΗΜΑ:** νέος entity type χρειάζεται `case 'hatch'` και στα ΤΡΙΑ hit-test/grips αρχεία — όχι μόνο renderer-register + draw-converter· draw pipeline ≠ hit-test pipeline. ⚠️ CHECK 6D: stage ADR-507 με grip-computation/hit-testing.
- **2026-06-21** — **S2-persist υλοποιήθηκε (NEW collection `floorplan_hatches`· 15 jest GREEN· UNCOMMITTED).** Bug: η γραμμοσκίαση **χανόταν σε σκληρή ανανέωση** (browser-verified· render/hover/select/εμβαδόν/DXF δούλευαν, persistence έλειπε). ΡΙΖΑ: ο μηχανισμός persistence του viewer (ADR-420) είναι **per-kind `floorplan_*` collections** (ΟΧΙ το dormant `floorplan_overlays`/ADR-340)· το hatch δεν είχε collection/service/loader/hook/rules → δεν γραφόταν πουθενά. Λύση Revit-aligned: η γραμμοσκίαση = Filled Region = persisted element → **mirror του `floor-finish`** (πλησιέστερο area/fill analog).
  - **3 κρίσιμες αρχιτεκτονικές αποφάσεις (επαληθευμένες με ανάγνωση κώδικα):** (1) τα `bim-floor-scope` helpers (`buildBimScopeConstraints`/`bimScopeWriteFields`/`resolveBimPersistenceScope`) είναι **scope-only** (companyId/projectId/floorplanId/floorId) → reuse ως έχουν, παρότι το hatch ΔΕΝ είναι BIM shape (μηδέν `BimValidation`/`kind`/`params`/`geometry`). (2) Το `HatchDoc` αποθηκεύει το flat payload (boundaryPaths + fill fields) κάτω από **ένα `data` sub-key** — single `dequal` diff unit (mirror του floor-finish `params`)· επίσης `boundaryPaths` (`Point2D[][]` nested arrays) επιτρέπεται μόνο μέσα σε map field, ΟΧΙ top-level. (3) **⚠️ ο create event είναι `drawing:complete`, ΟΧΙ `drawing:entity-created`** — το hatch ολοκληρώνει μέσω `completeEntity.ts:276` (το floor-finish εκπέμπει `drawing:entity-created` από `useSpecialTools`)· αντιγραφή verbatim θα ήταν silent never-first-save.
  - **NEW** `bim/hatch/hatch-firestore-service.ts` (`HatchDoc`/`HatchDocData`/`HatchServiceConfig`· CRUD με `setDoc`+`generateHatchId` N.6, ΠΟΤΕ addDoc· pure converters `hatchEntityToSaveInput`/`hatchDocToEntity`/`pickHatchData`)· **NEW** `hooks/data/useHatchPersistence.ts` (mirror floor-finish: first-save σε `drawing:complete`, diff σε `data`, delete σε `bim:hatch-delete-requested`· **DEFER** moved/restored re-persist effects)· **NEW** `app/HatchPersistenceHost.tsx` (mount στο `DxfViewerTopBar`· χωρίς 3D feed — 2D-only fill).
  - **Wiring/registry**: `config/firestore-collections.ts` (+`FLOORPLAN_HATCHES` + στο `FLOOR_SCOPED_BIM_COLLECTIONS`)· `enterprise-id-{prefixes,class,convenience}` (+`HATCH:'hatch'` + `generateHatchId`)· `systems/events/drawing-event-map-bim.ts` (+`bim:hatch-delete-requested`)· `bim/persistence/cross-floor-bim-loader.ts` (+`makeLoader<HatchDoc>('FLOORPLAN_HATCHES', …)`).
  - **SECURITY** `firestore.rules` (+`match /floorplan_hatches` mirror floor-finish· `keys().hasAll(['companyId','projectId','floorplanId','data'])` — **`data` αντί `params`**· companyId tenant isolation + createdBy/createdAt immutability)· `firestore.indexes.json` (+4 composite indexes mirror floor-finish).
  - **Tests**: NEW `bim/hatch/__tests__/hatch-firestore-service.test.ts` (14: enterprise-id N.6/never-addDoc, scope+audit stamping, `data` sub-key, floorId scope, subscribe constraints, pickHatchData strip, converter round-trip, area-over-doc)· +1 `cross-floor-bim-loader.test.ts` count 24→25.
  - **🔴 ΕΚΚΡΕΜΕΙ:** tsc (γραμμή κατειλημμένη — N.17)· browser-verify (σχεδίαση→σκληρή ανανέωση→ΠΑΡΑΜΕΝΕΙ· delete→refresh→δεν επανέρχεται)· **DEPLOY** `firestore.rules` + `firestore.indexes.json` στο Firebase· commit. **DEFER:** move/grip-edit re-persist· S3+ (Φ2 patterns…).
- **2026-06-21** — **S2 browser-verify fixes (2 κενά που δεν έπιαναν τα headless jest).**
  - **(1) FSM point-cap**: το `state-machine/interfaces.ts TOOL_POINT_REQUIREMENTS` δεν είχε `hatch` → fallback `maxPoints:2` έκοβε τα κλικ + το Enter δεν έφτιαχνε τίποτα (ο builder θέλει ≥3). Fix: `hatch: { minPoints:3, maxPoints:Infinity, allowsContinuous:false }` (mirror polygon).
  - **(2) ΚΡΙΣΙΜΟ render-pipeline gap (κληρονομιά S1)**: το committed `HatchEntity` ήταν **αόρατο** στον 2D καμβά γιατί το S1 καταχώρησε ΜΟΝΟ τον `HatchRenderer` στο composite — αλλά το `hatch` έλειπε από **3 σημεία της main-canvas pipeline**: (α) `hooks/canvas/dxf-scene-entity-converter.ts convertEntity` (έπεφτε στο `default`→`return null`→**dropped πριν τον renderer**)· (β) `canvas-v2/dxf-canvas/dxf-types.ts` (NEW `DxfHatch` + στο `DxfEntityUnion`)· (γ) `dxf-renderer-entity-model.ts buildEntityModelFromDxf` (`case 'hatch'`). + `rendering/hitTesting/Bounds.ts` (`calculateHatchBounds` AABB από boundaryPaths → click-select/spatial-index). Viewport culling = conservative default (no-op). **ΜΑΘΗΜΑ:** νέος entity type χρειάζεται και τα ΤΕΣΣΕΡΑ: converter + DxfEntityUnion + entity-model builder + Bounds — όχι μόνο renderer-register· τα headless jest δεν καλύπτουν την canvas pipeline → browser-verify υποχρεωτικό.
- **2026-06-20** — **S2 / Φ1b υλοποιήθηκε (tool wiring + UX, 10 jest GREEN· UNCOMMITTED).** Το «νεκρό» `HatchEntity` έγινε **σχεδιάσιμο από UI** — εργαλείο «Γραμμοσκίαση» (Τρόπος Α: κλικ-κλικ κλειστό όριο). **Αρχιτεκτονική: Path A (generic unified-drawing, mirror του `polygon`)** — δίνει `CreateEntityCommand`+undo δωρεάν· το floor-finish (path B) απορρίφθηκε ως πρότυπο γιατί κάνει direct scene mutation **χωρίς undo**.
  - **NEW `bim/hatch/hatch-draw-defaults-store.ts`**: zero-React imperative store (SSoT για τις προεπιλογές της επόμενης hatch· `useSyncExternalStore`-συμβατό). Διαβάζεται από τον entity builder (mirror `getXLineModeState`) + το bridge (tool-active mode).
  - **NEW `bim/hatch/hatch-completion.ts`**: pure helpers — `buildHatchEntityFromBoundary` (boundary→HatchEntity με defaults)· `computeHatchAreaMm2` (reuse `calculatePolygonArea` SSoT, outer−Σholes)· `buildHatchPostCreateCommands` (§5δ.9 send-to-back).
  - **§5δ.9 auto-send-to-back / compound undo**: opt-in `postCreateCommands` στο **shared `completeEntity`** → τυλίγει `CreateEntityCommand` + `ReorderEntityCommand('back')` σε ΕΝΑ `CompoundCommand` = ΕΝΑ undo (default συμπεριφορά αμετάβλητη για όλα τα άλλα εργαλεία).
  - **Tool wiring (mirror `polygon` παντού)**: `ToolType`/`DrawingTool` unions· `tool-definitions` (`category:'drawing'`, continuous)· **`state-machine/interfaces.ts TOOL_POINT_REQUIREMENTS` `{minPoints:3, maxPoints:Infinity}`** (κρίσιμο — χωρίς αυτό η FSM έπεφτε σε fallback `maxPoints:2`, έκοβε τα κλικ και το Enter δεν έφτιαχνε τίποτα· browser-verify fix)· `createEntityFromTool` `case 'hatch'` + `isEntityComplete=false`· `drawing-preview-generator` (closed-footprint ghost = `generateSlabPreview`)· `ENTITY_TOOLS`+`isFinishable` (useUnifiedDrawing)· `isClosableTool`+continuous (useDrawingHandlers)· `continuousTools` (useCanvasKeyboardShortcuts)· `useToolbarState` drawing list.
  - **Ribbon + shortcut**: home-tab «Γραμμοσκίαση» button (icon `hatch`=Grid3X3)· `keyboard-shortcuts` `H` (AutoCAD HATCH, ελεύθερο)· `useDxfToolbarShortcuts` route.
  - **Contextual tab «Γραμμοσκίαση»** (NEW `contextual-hatch-tab.ts` + `hatch-command-keys.ts` + `useRibbonHatchBridge.ts`): dual mode — επιλεγμένο hatch (generic `UpdateEntityCommand`, μηδέν νέα command) ↔ draw-defaults (tool-active). Panels: Γέμισμα (fillType/color)· Μοτίβο (γωνία/απόσταση/σταυρωτή/island)· Πληροφορίες (**live εμβαδόν** readout, m²)· Ενέργειες (close/delete). Wired σε `ribbon-contextual-config` (2 triggers: tool-active + entity-selected) + `useDxfBimBridges`/`useDxfViewerRibbon`/`useRibbonCommands`(+types,+action). Select = ADR-001· χρώμα = preset combobox (i18n names, N.11).
  - **i18n** el+en (`dxf-viewer-shell.json`): `ribbon.tabs.hatchProperties`, `ribbon.panels.hatch*`, `ribbon.commands.hatch(+Tooltip)`, `ribbon.commands.hatchEditor.*` (+colors).
  - **Render/writer/reader/geometry/area = S1 reuse, ΜΗΔΕΝ re-write.**
  - **🔴 ΕΚΚΡΕΜΕΙ:** browser-verify (`/dxf/viewer`: σχεδίαση→render→contextual tab→εμβαδόν→DXF round-trip) + commit. **DEFER:** S3+ (Φ2 patterns…)· panel-visibility hide-when-solid· auto-select-after-create.
- **2026-06-20** — **S1 / Φ1a υλοποιήθηκε (headless, 42 jest GREEN).** Ενεργοποίηση του «νεκρού» `HatchEntity`:
  - **Type** (`types/entities.ts`): +8 Φ1 πεδία (`fillType`, `islandStyle`, `lineAngle`, `lineSpacing`, `doubleCrossHatch`, `patternOrigin`, `drawOrder`, `gapTolerance`) — backward-compatible, χωρίς διπλασιασμό BaseEntity (opacity/transparency κληρονομούνται).
  - **Property SSoT** (NEW `bim/hatch/hatch-properties.ts`): `isSolidHatch()` + `islandStyleToDxf75()`/`dxf75ToIslandStyle()` + `HatchIslandStyle` type — ΕΝΑ σημείο για render+write+read (αλλιώς η solid-check + island↔code75 λογική τριπλασιαζόταν, N.12). lerp/deg→rad reuse υπαρχόντων `lerpPoint`/`degToRad` SSoT.
  - **Geometry SSoT** (NEW `bim/geometry/shared/hatch-pattern-geometry.ts`): `buildHatchLines(boundaryPaths, {spacing, angle, origin, double, islandStyle})` — wraps το υπάρχον `buildAxisAlignedHatch`/`clipLineToBbox` (N.12 dedup) + γεωμετρικό clip στα boundary polygons με even-odd νησίδες + origin phase-shift. ΜΙΑ γεωμετρία → canvas + exploded DXF.
  - **Renderer** (NEW `rendering/entities/HatchRenderer.ts` + register στο `EntityRendererComposite`): solid (even-odd fill) + user-defined γραμμές (μέσω `buildHatchLines`) + outline· ADR-040 leaf (zero subscriptions). hitTest/getGrips even-odd/boundary vertices.
  - **DXF Writer** (`export/core/dxf-ascii-writer.ts`): `case 'hatch'` → ΚΡΑΤΑ το `dxfFaces`/3DFACE path (ADR-505)· αλλιώς πραγματικό native `HATCH` (boundary loops 91/92/93/10/20· 70 solid flag· 75 island· 76 pattern type· 52/41 angle/scale· 78+pattern-line για έγκυρο user-defined). Lines-mode (Τέκτονας) → exploded LINEs (boundary + user-defined γραμμές μέσω `buildHatchLines`).
  - **DXF Reader** (`utils/dxf-entity-converters.ts` `convertHatch` + route· `dxf-entity-parser.ts`/`dxf-converter-helpers.ts` +ordered `pairs` στο `EntityData`): state-machine parse των boundary loops (τα επαναλαμβανόμενα 10/20 ΔΕΝ χωράνε στο flat `Record` → ordered pairs additive, μηδέν regression στους υπάρχοντες converters). Round-trips boundaryPaths + fillType + islandStyle + lineAngle/lineSpacing + seedPoints + scale.
  - **Tests**: `dxf-ascii-writer.test.ts` (+native HATCH describe)· NEW `dxf-roundtrip-hatch.test.ts` (write→read)· NEW `hatch-pattern-geometry.test.ts` (clip/even-odd/double/origin). 42 pass.
  - **🔴 ΕΚΚΡΕΜΕΙ:** S2 (Φ1b tool wiring + UX, browser-verify) + commit. ΜΗΝ αγγιχτεί tool/ribbon/keyboard ακόμα.
- **2026-06-20** — DRAFT δημιουργήθηκε. Deep-research workflow (102 agents, Autodesk DXF ref 2007-2024 + ezdxf) + κώδικας-χαρτογράφηση. Q&A 10 ερωτήσεις. §5β 12 enterprise features (gap tolerance, inherit, draw order, bg color, material→hatch, ghost, thumbnail, auto-scale, wipeout, hatch edit, recent, compound undo). §5γ 10 ακόμα features (trim hatch, custom PAT import, area calculation, select similar, pattern search, lineweight, alignment continuity, plan vs section dual-pattern, separate/merge, recreate boundary). Φάσεις 8 (Φ7=material automation SSoT). **Σύνολο: 22 enterprise features, 8 φάσεις, 17+ modules.** Status: SPECIFICATION COMPLETE v3.
