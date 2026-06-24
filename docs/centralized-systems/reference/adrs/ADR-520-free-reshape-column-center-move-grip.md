# ADR-520 — Center MOVE grip σε free-reshape / composite κολόνες

- **Status**: **Accepted — Implemented** (2026-06-25)
- **Date**: 2026-06-25
- **Domain**: DXF Viewer — BIM / Columns / Grips
- **Author**: κατόπιν εντολής Giorgio (2026-06-25)
- **Related**: ADR-518 (Polygon column grips — καθιέρωσε `columnCenterMoveGrip`· flagged αυτή τη φάση
  ως «μελλοντική»), ADR-519 (Circular column grips), ADR-363/449 (free reshape στατικής διατομής),
  ADR-397 (move/rotation glyph SSoT + move-glyph zones)
- **Ratchet impact**: ΚΑΝΕΝΑ νέο registry/ratchet — pure reuse `columnCenterMoveGrip` + move-glyph zones.
  Ένα νέο export στο `polygon-interior-point.ts` (`interiorAnchorPointWithClearance`).

---

## 1. Context — γιατί υπάρχει αυτό το ADR

Ο Giorgio ανέφερε (στιγμιότυπο 2026-06-24): μια **composite** κολόνα (προκύπτει από **συγχώνευση δύο
επικαλυπτόμενων στηλών**) εμφανίζει λαβές (γωνιών/πλευρών + περιστροφή) αλλά **ΟΧΙ** το **σημάδι
μετακίνησης με τα 4 αυτόνομα βελάκια** (σταυρός) στο εσωτερικό της. Ζητά: όταν συγχωνεύονται κολόνες
(και γενικά στις free-reshape διατομές, «ανάλογα το σχήμα — εσύ θα το καθορίσεις»), να εμφανίζεται ο
**κεντρικός σταυρός μετακίνησης**, με τον **ίδιο κεντρικοποιημένο κώδικα** (full SSoT, μία πηγή αλήθειας).

Το ADR-518 είχε ρητά σημειώσει αυτή τη φάση ως **μελλοντική**: «center MOVE σε όλα τα free-reshape kinds».

## 2. Findings — η τρέχουσα κατάσταση (CODE = SOURCE OF TRUTH)

### 2.1 Τι εκπέμπει το `freeCornerReshapeGrips` (composite / L / T / U-polygon, πριν το ADR-520)
`bim/columns/column-poly-vertex-grips.ts` → **rotation** (`column-rotation`) στο **εσωτερικό σημείο**
(`interiorAnchorPoint`) + λαβή ανά **κορυφή** (`column-poly-vertex-i`) + λαβή ανά **μέσο πλευράς**
(`column-poly-edge-i`). **ΚΑΝΕΝΑ center MOVE grip.**

### 2.2 Γιατί `interiorAnchorPoint` (όχι bbox-centre)
Για **κοίλα** σχήματα (Γ/Τ, ή concave composite) το bbox-centre πέφτει στην **εγκοπή** (κενό). Το
`interiorAnchorPoint` (`polygon-interior-point.ts`) δίνει σημείο **εγγυημένα μέσα στο υλικό** με μέγιστη
clearance — εκεί κάθεται η περιστροφή.

### 2.3 Ο σταυρός 4-βελακιών είναι ΗΔΗ SSoT
`columnCenterMoveGrip(entity)` (ADR-518) + glyph `'column-center'→'move'` (`grip-glyph-registry`) +
5 pickable ζώνες (`move-glyph-zones`) + `resolveMoveGlyphFrame` (διαβάζει `params.rotation` → ο σταυρός
ευθυγραμμίζεται με τους τοπικούς άξονες του σώματος). **Καμία αλλαγή** σε render/hit-test/commit.

## 3. Decision

Το `freeCornerReshapeGrips` εκπέμπει πλέον **center MOVE + rotation + κορυφές + μέσα-πλευρών**:

```
free-reshape (composite / L / T / U-polygon — ADR-520):
  0      → center MOVE  (column-center, glyph 'move' = 4 ξεχωριστά βελάκια)  ← στο interiorAnchorPoint
  1      → rotation     (column-rotation)                                    ← interiorAnchorPoint −offset
  10+i   → λαβή ανά κορυφή (column-poly-vertex-i)
  100+i  → λαβή ανά μέσο   (column-poly-edge-i)
```

### 3.1 Θέση σταυρού = `interiorAnchorPoint` (όχι centroid)
Ο σταυρός μπαίνει στο **body-interior** σημείο (reuse του ΙΔΙΟΥ `interiorAnchorPoint` που χρησιμοποιεί
η περιστροφή) ώστε για κοίλα σχήματα να ΜΗΝ πέφτει στην εγκοπή. Reuse του `columnCenterMoveGrip` SSoT,
**το οποίο επεκτάθηκε με προαιρετική παράμετρο θέσης** (`columnCenterMoveGrip(entity, position?)`): convex
kinds → default bbox-centroid· free-reshape → `interiorAnchorPoint(verts)`. Η **δομή** του grip ζει σε ΕΝΑ
σημείο (το SSoT helper)· οι callers δίνουν ΜΟΝΟ το «πού» όταν το centroid είναι ανασφαλές — όχι spread-override
στο call site (Google-level single source).

### 3.2 Σύγκρουση σταυρού ↔ περιστροφής — ΚΡΙΣΙΜΗ απόφαση
Η περιστροφή ήταν ΚΑΙ ΑΥΤΗ στο `interiorAnchorPoint` → θα συνέπιπτε με τον νέο σταυρό. **Λύση** (mirror
ορθογώνιας/πολυγωνικής `−depth/4`): η περιστροφή μετατοπίζεται προς τα **κάτω** (local −Y) κατά
`min(depth/4, clearance·0.85)`. Το **φράγμα από την clearance** εγγυάται ότι μένει **μέσα στο σώμα**
ακόμη και σε κοίλα Γ/Τ (ο εγγεγραμμένος δίσκος ακτίνας `clearance` γύρω από το interior σημείο είναι
όλος εντός του πολυγώνου). Νέο export `interiorAnchorPointWithClearance` (το σημείο **και** η clearance).

### 3.3 Emission ≡ Drag (μηδέν jump)
Το rotation **drag** (`rotateAroundPosition`) διαβάζει το `freeReshapeRotationWorld(params)` — το ΙΔΙΟ
(πλέον με offset) που εκπέμπει το emission → η λαβή δεν «πηδά» στο πιάσιμο. Ο σταυρός (`column-center`)
δρομολογείται στο `moveCenter` (translate `position`) — δεν διαβάζει θέση, οπότε μηδέν jump.

### 3.4 Εύρος = όλα τα free-reshape (όχι μόνο composite)
Επειδή το `freeCornerReshapeGrips` είναι ΕΝΑ μονοπάτι για composite + Γ + Τ + Π-polygon, ο σταυρός
εμφανίζεται σε **όλα** — ομοιόμορφη συμπεριφορά, ένα SSoT. (Giorgio: «ανάλογα το σχήμα — εσύ θα το
καθορίσεις».) Μηδέν regression σε render/commit (όλα keyed σε υπάρχοντα grip-kinds).

## 4. Αρχεία που άλλαξαν

| Αρχείο | Αλλαγή |
|---|---|
| `bim/columns/column-grip-utils.ts` | `columnCenterMoveGrip(entity, position?)` — προαιρετική θέση (default centroid)· το SSoT helper κρατά τη δομή, οι callers δίνουν θέση μόνο όταν χρειάζεται |
| `bim/geometry/shared/polygon-interior-point.ts` | Νέο `interiorAnchorPointWithClearance` (point+clearance)· `interiorAnchorPoint` = thin wrapper |
| `bim/columns/column-poly-vertex-grips.ts` | `freeCornerReshapeGrips` += center MOVE (interiorAnchorPoint, reuse `columnCenterMoveGrip`)· `freeReshapeRotationWorld` offset `−min(depth/4, clearance·0.85)` |
| `bim/columns/__tests__/column-grips-free-corner.test.ts` | center-first emission· νέο describe ADR-520 (composite center inside body· σταυρός≠περιστροφή· click→translate) |
| `bim/columns/__tests__/column-grips.test.ts` | tests 3/4/5: center-first για L/T |
| `bim/columns/__tests__/column-grips-phase2b.test.ts` | composite/U-polygon center-first |

Downstream (registry / move-glyph zones / hit-test / render / commit): **ΜΗΔΕΝ** αλλαγή.

## 5. Scope / μη-στόχοι
- **Εστιασμένο**: center MOVE στο `freeCornerReshapeGrips` (composite + L/T/U-polygon). Δεν αγγίζει
  rectangular/circular/polygon (έχουν ήδη center) ούτε I-shape / U-parametric (παραμετρικά, εκτός).
- Δεν αλλάζει η σημασιολογία rotation/vertex/edge — μόνο προστίθεται ο σταυρός + μετατοπίζεται η περιστροφή.

## 6. Changelog
- **2026-06-25** — ADR-520 δημιουργήθηκε + υλοποιήθηκε. Center MOVE cross (4 αυτόνομα βελάκια) σε
  free-reshape / composite κολόνες, στο body-interior σημείο (reuse `columnCenterMoveGrip` + move-glyph
  zones SSoT). Περιστροφή μετατοπίστηκε προς τα κάτω (clearance-bounded) ώστε να μη συμπίπτει με τον
  σταυρό, μένοντας εγγυημένα μέσα στο σώμα. Νέο `interiorAnchorPointWithClearance`. 110/110 column-grips
  jest GREEN. Υλοποιεί την «μελλοντική φάση» που είχε flag-άρει το ADR-518.
