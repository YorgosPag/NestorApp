# ADR-519 — Circular Column Grips (parity με ορθογώνια: σταυρός + 4 τεταρτημόρια)

- **Status**: **Accepted — Implemented** (2026-06-24)
- **Date**: 2026-06-24
- **Domain**: DXF Viewer — BIM / Columns / Grips
- **Author**: κατόπιν εντολής Giorgio (2026-06-24)
- **Related**: ADR-518 (Polygon column grips — αδελφό), ADR-363 (Column parametric grips — base + rect),
  ADR-397 (BIM grip glyph behavior SSoT — move/rotation glyph + move-glyph zones), ADR-188 (canonical `rotatePoint`)
- **Ratchet impact**: ΚΑΝΕΝΑ νέο registry/ratchet — pure reuse υπαρχόντων SSoT (grip-glyph registry,
  move-glyph zones, `columnCenterMoveGrip`). ΕΝΑ νέο focused adapter module (`column-circular-adapter.ts`),
  αδελφός του `column-rect-adapter.ts`.

---

## 1. Context — γιατί υπάρχει αυτό το ADR

Ζητήθηκε (Giorgio, 2026-06-24): η **στρόγγυλη κολόνα** (`kind === 'circular'`) να αποκτήσει τις λαβές
της **ορθογώνιας** με τον **ίδιο ακριβώς κώδικα** (full enterprise, full SSoT, μία πηγή αλήθειας):

1. Στο **κέντρο**, το **σημάδι μετακίνησης με 4 βελάκια** — κάθε βελάκι **ΞΕΧΩΡΙΣΤΟ** (δική του
   κατευθυντική λειτουργία), όχι ενιαίος σταυρός.
2. **4 λαβές στην περιφέρεια** στις **κορυφές τεταρτημορίων** (Β/Α/Ν/Δ) — επιλογή/μετακίνηση
   (Alt+drag) + **μεγέθυνση της ακτίνας** (διαμέτρου).
3. **Χωρίς σήμα περιστροφής** — απόφαση Giorgio: ο κύκλος είναι **rotationally symmetric**, η περιστροφή
   δεν αλλάζει τίποτα οπτικά (το rotation drag είναι ήδη no-op για circular).

## 2. Findings — η τρέχουσα κατάσταση (CODE = SOURCE OF TRUTH)

### 2.1 Τι είχε η στρόγγυλη (πριν το ADR-519)
Μόνο **1 grip** (`column-grips.ts:162`): `column-width` στο world +X (ακτίνα). **Κανένα κέντρο, καμία
άλλη λαβή τεταρτημορίου.**

### 2.2 Τι εκπέμπει η ορθογώνια (`rectColumnGrips`) + το κοινό SSoT
| Index | Λαβή | `columnGripKind` | Glyph |
|---|---|---|---|
| 0 | κέντρο — μετακίνηση | `column-center` (μέσω `columnCenterMoveGrip` SSoT) | `move` (4 ξεχωριστά βελάκια) |
| 2,3,8,9 | 4 μέσα πλευρών E/N/W/S | `column-{width,depth,edge-w,edge-s}` | `square` |
| 1 / 4–7 | rotation / 4 γωνίες | `column-rotation` / `column-corner-*` | rotation / square |

Το `columnCenterMoveGrip(entity)` (ADR-518, `column-grip-utils.ts:104`) είναι **ένα** σημείο που παράγει
το center MOVE grip — το reuse-άρει ΚΑΙ η circular.

### 2.3 Τα «4 ξεχωριστά βελάκια» + το glyph είναι ΗΔΗ SSoT
Όπως στο ADR-518: το `column-center` → glyph `'move'` (`grip-glyph-registry`) → 5 pickable ζώνες
(`move-glyph-zones`: center + x±/y±). Το `resolveMoveGlyphFrame` διαβάζει `params.rotation` (circular=0)
→ world-aligned σταυρός. **Καμία αλλαγή** εδώ — η circular κληρονομεί τα 4 αυτόνομα βελάκια απλώς
εκπέμποντας `column-center`.

## 3. Decision

Η στρόγγυλη κολόνα εκπέμπει **πλήρες set** με **reuse** υπαρχόντων SSoT, μέσω ΝΕΟΥ adapter
(`column-circular-adapter.ts`, αδελφός του `column-rect-adapter.ts`):

```
circular (πλήρες set — ADR-519):
  0 → center MOVE (column-center,  glyph 'move' = 4 ξεχωριστά βελάκια — columnCenterMoveGrip SSoT)
  2 → width  (E quadrant, +X)  ┐
  3 → depth  (N quadrant, +Y)  │ ΙΔΙΑ 4 kinds με τα μέσα-πλευρών της ορθογώνιας →
  8 → edge-w (W quadrant, −X)  │ glyph 'square', hit-test, dim labels: μηδέν νέο
  9 → edge-s (S quadrant, −Y)  ┘
  (ΧΩΡΙΣ rotation — κύκλος = rotationally symmetric)
```

### 3.1 Reuse των ΙΔΙΩΝ grip-kinds (όχι νέα)
Τα 4 τεταρτημόρια χρησιμοποιούν **τα ίδια** `column-{width,depth,edge-w,edge-s}` με τα 4 μέσα-πλευρών
της ορθογώνιας → «πανομοιότυπο» downstream (render 'square', hit-test, labels) **χωρίς νέα kinds**.

### 3.2 Resize semantics — γιατί διαφέρει σκόπιμα από την ορθογώνια
Κάθε quadrant κάνει **συμμετρικό diameter resize περί κέντρου** (factor 2): `newWidth = max(MIN,
width + 2·(sign·component))`, `position` σταθερό. Ο κύκλος ΔΕΝ έχει ανεξάρτητες πλευρές — **μία ακτίνα,
κεντραρισμένη** — οπότε opposite-edge-fixed (ορθογώνια) δεν έχει νόημα. Αυτό ταυτίζεται με το ΥΠΑΡΧΟΝ
circular `resizeWidth` (factor 2) — γενικεύτηκε στους 4 άξονες (E:+x, W:−x, N:+y, S:−y).

### 3.3 Emission ≡ Drag + downstream = ΜΗΔΕΝ αλλαγή
Glyph registry, move-glyph zones, hit-testing, rendering: **όλα keyed σε grip-kinds που ήδη υπάρχουν**
(`column-center`, `column-{width,depth,edge-w,edge-s}`). Η νέα δυνατότητα προκύπτει αποκλειστικά από
**emission + ένα resize adapter** — απόδειξη SSoT.

### 3.4 Χωρίς περιστροφή (Giorgio)
Δεν εκπέμπεται `column-rotation` για circular. Το rotation drag παραμένει defensive no-op
(`rotateAroundPosition` → `if circular return originalParams`).

## 4. Αρχεία που άλλαξαν

| Αρχείο | Αλλαγή |
|---|---|
| `bim/columns/column-circular-adapter.ts` | **ΝΕΟ** — `isCircularColumn`, `CIRCULAR_QUADRANT_MAP`, `circularColumnGrips` (reuse `columnCenterMoveGrip`), `applyCircularColumnGrip` (symmetric diameter resize) |
| `bim/columns/column-grips.ts` | circular branch → `circularColumnGrips(entity)`· `applyColumnGripDrag` += `applyCircularColumnGrip`· **αφαιρέθηκε** το dead circular branch στο `resizeWidth` (N.0.2, μία πηγή) |
| `bim/columns/__tests__/column-grips.test.ts` | circular → 5 grips (center + 4 quadrants)· quadrant θέσεις Β/Α/Ν/Δ· διάμετρος resize (E/N/W/S, factor 2, clamp)· rotation no-op |

Downstream (registry / move-glyph / hit-test / render / commit): **ΜΗΔΕΝ** αλλαγή.

## 5. Scope / μη-στόχοι
- **Εστιασμένο**: μόνο `circular`. Δεν αγγίζει rectangular/polygon/L/T/U/I/composite → **μηδέν regression**.
- Δεν προστίθεται σήμα περιστροφής (περιττό σε συμμετρικό κύκλο).

## 6. Changelog
- **2026-06-24** — ADR-519 δημιουργήθηκε + υλοποιήθηκε. Πλήρες set λαβών στρόγγυλης κολόνας (center MOVE
  4-βελάκια + 4 quadrant λαβές Β/Α/Ν/Δ που μεγαλώνουν την ακτίνα) με reuse υπαρχόντων SSoT
  (`columnCenterMoveGrip`, grip-glyph registry, move-glyph zones) + ΝΕΟ `column-circular-adapter.ts`
  (αδελφός `column-rect-adapter.ts`). Χωρίς rotation (κύκλος συμμετρικός). 104/104 column-grips jest GREEN.
