# ADR-518 — Polygon Column Grips (πλήρες set λαβών, parity με ορθογώνια)

- **Status**: **Accepted — Implemented** (2026-06-24)
- **Date**: 2026-06-24
- **Domain**: DXF Viewer — BIM / Columns / Grips
- **Author**: κατόπιν εντολής Giorgio (2026-06-24)
- **Related**: ADR-363 (Column parametric grips — base + variants + free reshape),
  ADR-397 (BIM grip glyph behavior SSoT — move/rotation glyph + move-glyph zones),
  ADR-398 (Column magnet / placement), ADR-188 (canonical `rotatePoint`)
- **Ratchet impact**: ΚΑΝΕΝΑ νέο module/ratchet — pure reuse υπαρχόντων SSoT (grip-glyph
  registry, move-glyph zones, rect-grip-engine, free-reshape per-vertex/edge).

---

## 1. Context — γιατί υπάρχει αυτό το ADR

Ζητήθηκε (Giorgio, 2026-06-24): η **πολυγωνική κολόνα** (`kind === 'polygon'`, κανονικό
N-gon) να αποκτήσει **τις ίδιες λαβές** που έχει η **ορθογώνια** και **με τον ίδιο τρόπο
που εμφανίζονται**:

1. **Λαβή σε κάθε γωνία** της πολυγωνικής κολόνας.
2. **Λαβή σε κάθε μέσο πλευράς** της πολυγωνικής κολόνας.
3. Στο **κέντρο**, το **σημάδι μετακίνησης με τα 4 βελάκια** — όπου **κάθε βελάκι είναι
   ΞΕΧΩΡΙΣΤΟ** (δική του λειτουργία), **όχι** ενιαίος σταυρός.
4. **Σημάδι περιστροφής** τοποθετημένο **ανάμεσα σε μία λαβή και το κέντρο** της κολόνας.

Απαίτηση: **μία και μοναδική πηγή αλήθειας (full SSoT)**, full enterprise, **μηδέν
διπλότυπα** — «ίδιος κώδικας με την ορθογώνια».

## 2. Findings — η τρέχουσα κατάσταση (CODE = SOURCE OF TRUTH)

### 2.1 Τι εκπέμπει η ορθογώνια (`rectColumnGrips`, `column-rect-adapter.ts`)

| Index | Λαβή | `columnGripKind` | Glyph |
|---|---|---|---|
| 0 | κέντρο — μετακίνηση | `column-center` | `move` (4 ξεχωριστά βελάκια) |
| 1 | περιστροφή | `column-rotation` | `rotation` (καμπύλο τόξο) |
| 2,3,8,9 | 4 μέσα πλευρών E/N/W/S | `column-{width,depth,edge-w,edge-s}` | `square` |
| 4–7 | 4 γωνίες | `column-corner-{ne,nw,sw,se}` | `square` |

> ⚠️ **Παρωχημένο σχόλιο**: το `column-grips.ts` (Φ1G.5 Slice 2) ισχυρίζεται ότι το
> `column-center` (gripIndex 0) «δεν εκπέμπεται πλέον». **Το `rectColumnGrips:132` το όντως
> εκπέμπει** (re-added 2026-06-15) — γι' αυτό φαίνεται στην ορθογώνια. Το ADR-518 ευθυγραμμίζει
> το σχόλιο με τον κώδικα: το center MOVE **είναι ζωντανό** για τα true-rectangle + (τώρα) polygon.

### 2.2 Τα «4 ξεχωριστά βελάκια» είναι ΗΔΗ SSoT

Το move glyph είναι **5 pickable ζώνες** (`move-glyph-zones.ts`: `center` + `x+/x-/y+/y-`),
κάθε βελάκι = κατευθυντική μετακίνηση σε τοπικό άξονα (`directionForZone`). Ενεργοποιείται
**αυτόματα** από το grip-kind `column-center` μέσω του `grip-glyph-registry` (`'column-center' →
'move'`). **Καμία αλλαγή δεν απαιτείται** εδώ — η πολυγωνική κληρονομεί τα 4 βελάκια απλώς
εκπέμποντας `column-center`.

### 2.3 Τι είχε η πολυγωνική (πριν το ADR-518)

Μόνο **2 λαβές** (`column-grips.ts:173`): rotation (έξω, stand-off) + width. **Καμία γωνία,
κανένα μέσο, κανένα κέντρο.**

### 2.4 Υπάρχον SSoT για γωνίες + μέσα πλευρών

Το `freeCornerReshapeGrips` (`column-poly-vertex-grips.ts:186`) εκπέμπει ήδη **λαβή ανά κορυφή**
(`column-poly-vertex-i`) + **λαβή ανά μέσο πλευράς** (`column-poly-edge-i`) πάνω στο rendered
footprint, και το χρησιμοποιούν L/T/U/composite. Το drag κάνει **materialize σε `composite`**
(`materializeColumnLocalPolygonMm` → `buildLocalFootprint` με `case 'polygon'` — επιβεβαιωμένο
ότι υποστηρίζει regular polygon). Δηλαδή το «free reshape γωνίας/πλευράς» **υπάρχει ήδη** —
απλώς η `kind === 'polygon'` έβγαινε νωρίς και δεν το άγγιζε.

## 3. Decision

Η πολυγωνική κολόνα εκπέμπει **πλήρες set** με **reuse** των υπαρχόντων SSoT:

```
polygon (πλήρες set — ADR-518):
  0      → center MOVE     (column-center,        glyph 'move' = 4 ξεχωριστά βελάκια)
  1      → rotation        (column-rotation,      glyph 'rotation')
  10+i   → λαβή ανά κορυφή (column-poly-vertex-i, glyph 'square')
  100+i  → λαβή ανά μέσο   (column-poly-edge-i,   glyph 'square')
```

### 3.1 Θέση rotation — ΚΡΙΣΙΜΗ απόφαση

Το `interiorAnchorPoint` (που χρησιμοποιεί το `freeCornerReshapeGrips`) για **convex** polygon
**≈ centroid** (ρητά τεκμηριωμένο στο `polygon-interior-point.ts`). Αν η πολυγωνική χρησιμοποιούσε
σκέτο `freeCornerReshapeGrips`, το rotation handle θα έπεφτε **πάνω στο κέντρο** → **σύγκρουση με
το move glyph**. Ο Giorgio απαιτεί ρητά το rotation «**ανάμεσα σε μία λαβή και το κέντρο**».

**Λύση** (mirror της ορθογώνιας): το polygon rotation πάει στο `localToWorld({x:0, y:−dimY/4})`
— **ακριβώς το ίδιο pattern** με το rectangular (`localToWorld({x:0, y:−depth/4})`): μισό δρόμο
από το κέντρο προς το κάτω edge-midpoint, `dimY` = το πραγματικό N-gon bbox (`polygonBboxMm`).
**Ποτέ** πάνω στο centroid (όπου κάθεται το move) **ούτε** πάνω στην περίμετρο (όπου κάθονται
οι λαβές γωνιών/πλευρών).

### 3.2 Emission ≡ Drag συγχρονισμός

Το `usesFreeReshapeGrips` **ΔΕΝ** περιλαμβάνει το `polygon` — έτσι το rotation **drag**
(`rotateAroundPosition`) διαβάζει το `rotationHandleWorld(params)`, **το ίδιο** σημείο που
εκπέμπει το emission. Μηδέν «jump» στο πιάσιμο. (Το vertex/edge drag δεν εξαρτάται από το
`usesFreeReshapeGrips` — δρομολογείται από το grip-kind prefix `column-poly-`.)

### 3.3 SSoT helper για το center MOVE

Το `columnCenterMoveGrip(entity)` (νέο, στο `column-grip-utils.ts`) είναι **ένα** σημείο που
παράγει το gripIndex-0 center grip· το χρησιμοποιούν **ΚΑΙ** το `rectColumnGrips` (Boy-Scout
dedup του πρώην inline) **ΚΑΙ** το `polygonReshapeGrips` → μηδέν διπλότυπο (N.0.2).

### 3.4 Downstream = ΜΗΔΕΝ αλλαγή

Glyph registry, move-glyph zones, hit-testing, rendering, drag transforms: **όλα keyed σε
grip-kinds που ήδη υπάρχουν** (`column-center`, `column-rotation`, `column-poly-vertex-*`,
`column-poly-edge-*`). Αυτή είναι η απόδειξη του SSoT — η νέα δυνατότητα προκύπτει αποκλειστικά
από **emission**, χωρίς να αγγίζει render/hit-test/commit.

## 4. Αυτο-συνέπεια (γιατί δεν επικαλύπτονται οι λαβές)

| Κατάσταση | move | rotation | Επικάλυψη; |
|---|---|---|---|
| regular polygon | centroid | `−dimY/4` (μετατοπισμένο) | **Όχι** |
| μετά από reshape → `composite` | — (δεν εκπέμπεται) | `interiorAnchorPoint` | **Όχι** (δεν υπάρχει move) |

## 5. Scope / μη-στόχοι

- **Εστιασμένο**: center MOVE μόνο σε `polygon` (+ rectangular που ήδη το έχει). **Δεν** αγγίζει
  L/T/U/composite behavior → **μηδέν regression**.
- Μετά το πρώτο reshape η πολυγωνική γίνεται `composite` (custom διατομή) — καθιερωμένο pattern
  (ίδιο με L/T). Τότε ισχύει το `freeCornerReshapeGrips` (rotation σε interior, χωρίς center move).
  Μελλοντική φάση (αν ζητηθεί): center MOVE σε όλα τα free-reshape kinds.

## 6. Αρχεία που άλλαξαν

| Αρχείο | Αλλαγή |
|---|---|
| `bim/columns/column-grip-utils.ts` | Νέο `columnCenterMoveGrip` SSoT· `rotationHandleWorld` polygon branch → `−dimY/4` |
| `bim/columns/column-rect-adapter.ts` | `rectColumnGrips` reuse `columnCenterMoveGrip` (dedup inline) |
| `bim/columns/column-poly-vertex-grips.ts` | Extract `perVertexAndEdgeGrips`· νέο `polygonReshapeGrips`· `freeCornerReshapeGrips` reuse |
| `bim/columns/column-grips.ts` | polygon branch → `polygonReshapeGrips(entity)` |
| `bim/columns/__tests__/*` | polygon → grips 0/1/10+/100+· regression L/T/U |

## 7. Changelog

- **2026-06-24** — ADR-518 δημιουργήθηκε + υλοποιήθηκε. Πλήρες set λαβών πολυγωνικής κολόνας
  (center MOVE 4-βελάκια + rotation + λαβή/κορυφή + λαβή/μέσο-πλευράς) με reuse υπαρχόντων SSoT.
  Νέα θέση rotation (`−dimY/4`, parity με ορθογώνια) για αποφυγή σύγκρουσης με το centroid move.
  Νέο `columnCenterMoveGrip` SSoT (dedup του inline στο `rectColumnGrips`).
