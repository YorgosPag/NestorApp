# ADR-647 — R12 Associative-Hatch: πλήρης πιστότητα μοτίβου (R14_HATCH_DATA pattern-def)

**Status:** Proposed (οδηγός υλοποίησης — Φ1 pending)
**Date:** 2026-07-13
**Domain:** dxf-viewer / import parser / hatch SSoT
**Related:** ADR-635 (R12 associative-hatch INSERT → HATCH), ADR-507 (hatch system + inlinePattern SSoT),
ADR-644 (#7d export prefers inlinePattern), ADR-643 (hatch image-fill — ξεχωριστό path, άλλος agent)

> **Στόχος:** 100% αμφίδρομη πιστότητα γραμμοσκιάσεων AutoCAD ⇄ Nestor. Ό,τι εισάγεται από AutoCAD
> να φαίνεται **πανομοιότυπο** στον canvas, και ό,τι εξάγεται να ανοίγει **πανομοιότυπο** στο AutoCAD.

---

## Context

Ο Giorgio ανέφερε δύο προβλήματα σε πραγματικό αρχείο (`Αδείας.Κάτοψη ισογείου.dxf`, 42MB):
1. **Κάποιες γραμμοσκιάσεις ΔΕΝ εισάγονται** (αόρατες στον canvas).
2. **Όσες εισάγονται δεν είναι πανομοιότυπες** μετά το export στο AutoCAD.

### Διόρθωση διάγνωσης (ground-truth από τα ΙΔΙΑ τα αρχεία)

Το προηγούμενο handoff υπέθεσε ότι το root cause είναι τα **EdgePath boundaries στον native HATCH**
(`convertHatch`). **Δεν ισχύει γι' αυτό το αρχείο.** Ανάλυση με python analyzers:

| Αρχείο | Έκδοση | Hatch μηχανισμός |
|---|---|---|
| `Αδείας.Κάτοψη ισογείου.dxf` (42MB, ΤΟ ΚΥΡΙΟ) | **AC1009 / R12** | ACAD/HATCH XDATA σε anonymous-block INSERT |
| `KADOS.ΓΡΑΜΜΟΣΚΙΑΣΕΙΣ-AUTOCAD.dxf` (26MB) | **AC1009 / R12** | ίδιο (XDATA) |
| `ΓΡΑΜΜΟΣΚΙΑΣΗ-AUTOCAD.dxf` (121KB) | AC1032 / R2018 | native HATCH (1 PolylinePath) |

Σε **R12 δεν υπάρχει native HATCH** → οι γραμμοσκιάσεις περνούν από τον
`dxf-hatch-xdata-converter.ts` (`tryConvertInsertHatch`), **όχι** από τον `convertHatch`.

Ανάλυση των 117 R12 hatches του κύριου αρχείου:

```
INSERTs με ACAD/HATCH XDATA : 117
Boundary: polyline          : 106
Boundary: line-edges        :  11
Boundary: curved (arc/…)    :   0   ← ΚΑΝΕΝΑ καμπύλο όριο· το EdgePath ΔΕΝ φταίει εδώ
Patterns: ANSI31(35) HEX(33) GRASS(17) NET(17) SQUARE(8) GRATE(7)
```

### Τα δύο ΠΡΑΓΜΑΤΙΚΑ root causes

- **#1 «δεν εισάγονται»:** ο render (`hatch-pattern-geometry.ts` `buildHatchEntitySegments`)
  επιστρέφει `[]` (**αόρατο**) όταν το pattern δεν είναι στο catalog **ΚΑΙ** δεν υπάρχει
  `inlinePattern`. Το **GRATE λείπει από τον catalog** → οι 7 GRATE γίνονται αόρατες.
- **#2 «όχι πανομοιότυπες»:** ο `tryConvertInsertHatch` διαβάζει pattern **name/scale/angle** αλλά
  **ΟΧΙ τον πλήρη ορισμό μοτίβου** που υπάρχει μέσα στο `R14_HATCH_DATA`. Έτσι HEX/ANSI31/NET/SQUARE
  βασίζονται στο catalog def (που μπορεί να διαφέρει από τον πραγματικό AutoCAD def) → όχι πιστό
  render **και** όχι πιστό export. Ο native `convertHatch` το διαβάζει ήδη (`parseInlinePatternLines`,
  codes 53/43-49) — ο R12 path έμεινε **ασύμμετρος**.

---

## Locked spec — `R14_HATCH_DATA` pattern definition (decode-first)

Δομή του `1001 ACAD / 1000 HATCH / 1002 { … 1002 }` XDATA block:

```
1070 <flags=19>
1000 <patternName>            ← π.χ. HEX
1040 <scale>                  ← π.χ. 0.005
1040 <angleRad>              ← συνολική γωνία (rad)
1000 R14_HATCH_DATA
1000 <handle>
  …elevation/normal matrix (1011/1021/1031 × rows, 1040 elev, 1010/1020/1030 normal)…
1000 <patternName>            ← boundary section ΞΕΚΙΝΑ μετά από εδώ (findR14BoundaryStart)
── BOUNDARY ──
1070 <a>  1070 <b>  1071 <numPaths>
  ανά path:  1071 <flag=7>  1070 <hasBulge 0|1>  1070 1  1071 <numVerts>
             numVerts × (1040 x, 1040 y [, 1040 bulge αν hasBulge=1])
             1071 0                       ← τερματιστής path
  (ή edge-list: 1070 1 + 4×1040 ανά ακμή· 1070 2/3/4 = arc/ellipse/spline → fallback)
── PATTERN DEFINITION ──                  ← ΝΕΟ: εδώ το fix (parseR14PatternLines)
1070 <fillFlag 0|1>  1070 1
1040 <angleRad>  1040 <scale>            ← overall (redundant με το head)
1070 0  1070 <numFamilies>               ← numFamilies ∈ 1..8
  ανά family:
    1040 <angleRad>                       ← ΤΕΛΙΚΗ γωνία γραμμής (baked, rad)
    1040 <baseX>  1040 <baseY>            ← σημείο αναφοράς (world, phase)
    1040 <deltaX>  1040 <deltaY>          ← WORLD-space offset vector
    1070 <numDashes>                       ← 0 = solid
    numDashes × 1040 <dashLen>            ← >0 γραμμή, <0 κενό (final scaled)
── TRAILER ──
1040 0.0  1071 1  1040 <seedX>  1040 <seedY>  1040 0.0
```

### GROUND-TRUTH validation (ΕΚΤΕΛΕΣΤΗΚΕ — όχι μόνο spec/μνήμη)

Το anonymous block `*X#` περιέχει τις **ΑΚΡΙΒΕΙΣ exploded LINEs** που ζωγράφισε το AutoCAD. Σύγκριση
του parsed pattern-def με αυτές (γωνία / perpendicular spacing / dash length / **phase**):

| Pattern | block | Parsed (angle° / perp / dash) | REAL lines (angle° / spacing / maxlen) | phase residual |
|---|---|---|---|---|
| ANSI31 | `*X418` | 45° / 0.03175 / solid | 45° / **0.03175** / solid | **2.9e-09** ✅ |
| HEX | `*X416` | 90/210/150° / 0.027496 / 0.01588 | 30/90/150° / **0.02749** / **0.01588** | **≤9.1e-09** ✅ |
| SQUARE | `*X458` | 0/90° / 0.127 / dash 0.127 | 0/90° / **0.127** / **0.127** | ✅ |
| GRATE | `*X492` | 0/90° / 0.079375 & 0.3175 / solid | 0/90° / **0.07937 & 0.3175** / solid | **≤8.7e-11** ✅ |

- **210°≡30°** (mod 180) → γωνίες ταιριάζουν.
- **perpendicular spacing** των πραγματικών γραμμών = το un-rotated `local_delta` perp **στα ~1e-9** →
  το un-rotation ΕΠΙΒΕΒΑΙΩΘΗΚΕ εμπειρικά, ΟΧΙ αριθμητικά-από-υπόθεση.
- **phase residual ~1e-9**: κάθε πραγματική γραμμή πέφτει ΑΚΡΙΒΩΣ στο lattice
  `kOrigin=−uy·baseX+ux·baseY + i·spacing` → το `base → pl.origin` δίνει το ΣΩΣΤΟ phase.
- **along-line DASH-START phase** (κενό #2, ΚΛΕΙΣΤΟ): φιλτράροντας μόνο ΠΛΗΡΗ dashes (τα clipped-στο-
  boundary έχουν αυθαίρετα άκρα), όλα ξεκινούν στο lattice `sOrigin=ux·baseX+uy·baseY (+i·dx)` με
  **spread ~1e-9…1e-11** (HEX 3 families, SQUARE 2 families). → το `base` δίνει ΚΑΙ perpendicular ΚΑΙ
  along-line phase. Πλήρες dash phase locked.
- **⚠️ Διόρθωση μνήμης:** αρχικά υπέθεσα SQUARE delta=0.254 (από μνήμη acad.pat)· το ground-truth
  απέδειξε **0.127**. Το decode-first νίκησε τη μνήμη — γι' αυτό ΔΕΝ γράφουμε κώδικα από μνήμη.

### Boundary bulges — scope & format (κενό #1, ΚΛΕΙΣΤΟ)

Σάρωση και των 117 R12 hatches: **μόνο 7 έχουν boundary bulges (όλα GRATE), 11 τόξα** συνολικά.
- **stride vs `hasBulge` flag: 0 mismatches** → το `1070 <hasBulge 0|1>` (πριν το `1070 1 / 1071 nVerts`)
  προβλέπει ΑΞΙΟΠΙΣΤΑ το stride (2 vs 3)· να προτιμηθεί από την count-inference.
- 3ο value/vertex = **standard DXF bulge** = tan(θ/4): −0.41421→**τεταρτοκύκλιο 90°**, −0.37114→81.4° ✓.
- Υλοποίηση: όταν `hasBulge` & bulge≠0 → tessellate το τόξο με το υπάρχον SSoT
  `geometry-bulge-utils.bulgeToPolyline` (ADR-510) — μηδέν νέα arc math (N.18). Μικρό scope, καθαρό.

### 3 κρίσιμες σημασίες (αλλιώς «γλιστράει» το μοτίβο)

1. **Γωνίες σε RADIANS** → μετατροπή σε μοίρες (`radToDeg`). Είναι ήδη ΤΕΛΙΚΕΣ (base+global baked).
2. **`delta` = WORLD-space vector**, ενώ ο render (`buildPatternLineSegments`) θέλει **line-local**
   `[along-line stagger, perpendicular spacing]` (όπως το `PatternLine.delta`). → **un-rotate κατά −angle**:
   ```
   c = cos(angleRad); s = sin(angleRad)
   localDx =  deltaWx·c + deltaWy·s      // κατά μήκος (stagger)
   localDy = −deltaWx·s + deltaWy·c      // κάθετη απόσταση (spacing)
   ```
   **Αριθμητική επαλήθευση:** ANSI31 world(−0.0224506, +0.0224506) @45° → local(0, 0.03175) =
   0.125″×25.4×0.01 ✓. HEX και οι 3 families → ίδιο local(0, 0.027496306577) ✓.
3. **Όλα baked σε world units** (= `acad.pat` × 25.4 × scale × rotation) → map **1:1** στο
   `PatternLine`, **ακριβώς όπως** ο native `parseInlinePatternLines`. Ο render/export τα διαβάζουν
   με `scale=1, angleDeg=0` (ήδη υπάρχον μονοπάτι, ADR-507 Φ6 / ADR-644 #7d).

---

## Decision

### Φ1 — `parseR14PatternLines` → `inlinePattern` (ΤΟ ΚΥΡΙΟ FIX)

1. **Shared SSoT helper** `makeInlinePattern(patternName, lines)` στο `dxf-hatch-converter.ts`
   (εξάγεται· ο native `convertHatch` το χρησιμοποιεί ήδη μέσω inline object → refactor να καλεί το
   helper). **N.18:** ο R12 parser το ΞΑΝΑχρησιμοποιεί — μηδέν sibling clone του inlinePattern wrapper.
2. **`parseR14PatternLines(pairs): PatternLine[]`** στο `dxf-hatch-xdata-converter.ts`:
   εντοπίζει το pattern-def fingerprint (`1070 0|1 / 1070 1 / 1040 / 1040 / 1070 0 / 1070 <1..8>`),
   διαβάζει `numFamilies` families με τη σημασία παραπάνω (rad→deg, world-delta un-rotation), defensive
   stop σε `1002` / end-of-pairs (τα υπάρχοντα tests έχουν truncated tail).
3. **`tryConvertInsertHatch`** → περνά `inlinePattern` (μέσω `makeInlinePattern`) στο
   `buildHatchSceneEntity`.
4. **Placement transform** (`transformInsertHatch` / `applyBlockTransformGeometry`): το
   `inlinePattern.origin` (+ angle/delta/dashes) πρέπει να ριδάρει τον ΙΔΙΟ block transform με το
   boundary (block-local → world), αλλιώς phase misalignment σε non-identity INSERTs (KADOS,
   ADR-635 test #182). Για το κύριο αρχείο (INSERT @0,0, scale1, angle0) = identity → no-op, αλλά
   υλοποιείται σωστά για completeness.

### Φ2 — GRATE στον catalog (belt-and-suspenders)
Προσθήκη `GRATE` (acad.pat def) στο `hatch-pattern-catalog.ts` — για GRATE που δημιουργεί ο χρήστης
μέσα στον Nestor (χωρίς πρωτότυπο). Το preserve-native της Φ1 καλύπτει το import.

### Φ2b — R14 boundary bulges (μικρό, scoped· 7 GRATE hatches)
Όταν `hasBulge`=1 → stride-3, tessellate ανά ζεύγος vertices με `bulgeToPolyline` (SSoT). Το pattern
γίνεται ήδη σωστό από τη Φ1· αυτό ακριβοποιεί μόνο το *outline* κοντά στα 11 τόξα. Scope & format
κλειστά (βλ. παραπάνω) — απομένει μόνο η υλοποίηση.

### Φ3 — (χαμηλή προτεραιότητα, εκτός scope· τεκμηριωμένα)
- **multi-path polyline boundary bug:** `extractR14BoundaryPaths` σπάει στον 1ο `1071 0` → χάνει
  islands (NET έχει 2 paths). Επηρεάζει island clipping, όχι ορατότητα/μοτίβο.
- **native HATCH EdgePath/bulge** (R2018 αρχεία με καμπύλα όρια) — κανένα τρέχον αρχείο δεν το έχει.

> **Πλήρως άγνωστα που ΔΕΝ χρειάζεται ο parser** (τεκμηριωμένα για ειλικρίνεια): το head `1070 19`
> και το per-pattern `fillFlag` (`1070 0|1`· GRATE=1) — δεν επηρεάζουν το render, δεν τα διαβάζουμε.

---

## Files (Φ1)

- `utils/dxf-hatch-converter.ts` — export `makeInlinePattern` helper· refactor `convertHatch` να το καλεί.
- `utils/dxf-hatch-xdata-converter.ts` — **νέο** `parseR14PatternLines` + wiring στο `tryConvertInsertHatch`.
- `utils/dxf-block-expander.ts` — `inlinePattern` transform στο `transformInsertHatch` (non-identity INSERT).
- `data/hatch-pattern-catalog.ts` — προσθήκη `GRATE` (Φ2).
- `utils/__tests__/dxf-hatch-xdata-converter.test.ts` — R14 pattern-def fixtures (ANSI31 solid, SQUARE
  dash/gap, HEX 3-family spacing), assert `inlinePattern.lines` (angle°, un-rotated delta, dashes).

## Validation

- **Re-import** `Αδείας` 42MB → μέτρηση ορατών hatches (στόχος 117/117· GRATE ορατά).
- **Round-trip** (ezdxf 1.4.4, MIT, `python`): import→export→re-read· σύγκριση pattern def.
- **Ground-truth ΜΕΣΑ στο αρχείο:** το anonymous block `*X#` περιέχει τις **ακριβείς** exploded LINEs
  που ζωγράφισε το AutoCAD → overlay του parsed inlinePattern render με αυτές = απόδειξη σωστού decode.
- **AutoCAD F2** (Giorgio): ο μόνος αξιόπιστος τελικός έλεγχος· ezdxf πιο ανεκτικό από AutoCAD.

## Consequences

- ✅ GRATE + κάθε pattern (catalog-miss ή catalog-mismatch) render 1:1 με AutoCAD, **χωρίς εξάρτηση
  catalog** (preserve-native round-trip, όπως Revit/ArchiCAD).
- ✅ Export πανομοιότυπο (render+export προτιμούν ήδη `inlinePattern`, ADR-644 #7d) → λύνει #1 **και** #2.
- ✅ Συμμετρία με τον native HATCH path (ADR-507 Φ6) — ίδιο `inlinePattern` SSoT, ίδιο render/export.
- ⚠️ Γνωστά κενά (Φ3): R14 boundary bulges (GRATE) & multi-path polyline islands (NET) — δεν εμποδίζουν
  την ορατότητα/πιστότητα μοτίβου· τεκμηριωμένα.

## Changelog

- **2026-07-13** — ADR δημιουργήθηκε ως οδηγός υλοποίησης μετά από decode-first ανάλυση 6 R14 patterns
  (ANSI31/SQUARE/NET/HEX/GRASS/GRATE) στο `Αδείας.Κάτοψη ισογείου.dxf`.
- **2026-07-13 (b)** — **GROUND-TRUTH validation ΕΚΤΕΛΕΣΤΗΚΕ:** parsed pattern-def vs πραγματικές
  exploded LINEs του `*X#` block σε ANSI31/HEX/SQUARE/GRATE. angle + perpendicular spacing (un-rotation)
  + phase (base→origin) + dash length ταιριάζουν **στα ~1e-9**. Διορθώθηκε λάθος μνήμης (SQUARE 0.254→**0.127**).
- **2026-07-13 (c)** — **ΤΑ 2 ΕΝΑΠΟΜΕΙΝΑΝΤΑ ΚΕΝΑ ΚΛΕΙΣΤΑ:** (1) along-line **dash-start phase** locked
  εμπειρικά (full-dash residual spread ~1e-9…1e-11, HEX+SQUARE)· (2) **boundary bulges** scoped (7/117
  hatches, όλα GRATE, 11 τόξα· `hasBulge` flag 0 mismatches· format = DXF bulge tan(θ/4)). **Η ΕΡΕΥΝΑ
  ΟΛΟΚΛΗΡΩΘΗΚΕ — το format είναι πλήρως εμπειρικά κλειδωμένο.** Υλοποίηση (Φ1+Φ2+Φ2b) σε ΝΕΑ συνεδρία.
