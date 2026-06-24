# ADR-517 — Πλήρης παρ-ομοιότητα λαβών: pad πέδιλο ↔ ορθογώνια κολόνα

- **Status**: DONE (UNCOMMITTED — pending browser-verify + commit)
- **Date**: 2026-06-24
- **Authors**: Opus (research + architecture + implementation), Giorgio (product owner)
- **Discipline**: Structural (`structural`)
- **Επόμενο ελεύθερο ADR μετά**: ADR-518
- **Σχετικά ADR**: ADR-436 (foundation discipline — owns foundation grips), ADR-363 (rect column grips / Slice C+F), ADR-397 (move/rotation glyph behavior SSoT), ADR-048 (unified grip rendering)

---

## 1. Context — Γιατί

Ο Giorgio ζήτησε να μελετηθεί το σύστημα λαβών της **ορθογώνιας κολόνας** στο `/dxf/viewer` —
σταυρός μετακίνησης με **4 αυτόνομα βελάκια** (κάθε βελάκι δική του λειτουργία, όχι ενιαίος σταυρός),
σήμα περιστροφής στο μέσο κέντρου↔μέσης-πλευράς, **4 λαβές μέσου πλευράς**, **4 γωνιακές λαβές** —
και να εφαρμοστεί **πανομοιότυπη** συμπεριφορά στο **πέδιλο** («εφάρμοσε τον ίδιο ακριβώς κώδικα»).

Η διερεύνηση (read του πραγματικού κώδικα· **code = source of truth**, N.0.1) έδειξε ότι το πέδιλο
**ΗΔΗ μοιράζεται όλα τα κρίσιμα SSoT** με την κολόνα (ADR-436 Slice 1b/1c): `rect-grip-engine`,
`grip-glyph-registry`, hot-grip FSM (`HOT_GRIP_OP_REGISTRY`), `move-glyph-frame`, `grip-registry`.
Δεν χρειαζόταν **καμία νέα υποδομή**. Υπήρχε **μόνο ένα κενό εκπομπής** μεταξύ
`column-rect-adapter.rectColumnGrips` και `foundation-grips.getFoundationGrips` (pad):

| Λαβή | Κολόνα `rectColumnGrips` | Pad πέδιλο (πριν) | Ενέργεια |
|------|:---:|:---:|---|
| `*-center` σταυρός μετακίνησης (4 αυτόνομα βελάκια) | ✅ `gripIndex 0`, `type:'center'`, `movesEntity:true` | ❌ δεν εκπεμπόταν (μόνο Alt+drag) | **Εκπομπή** |
| `*-rotation` σήμα περιστροφής | ✅ τοπικό `(0,−depth/4)` (midway) | ⚠️ τοπικό `(0,−length/2)` (στο πρόσωπο) | **Μετακίνηση στο `−length/4`** |
| `*-width` (E μέσο πλευράς) | ✅ | ✅ | — |
| `*-depth` / `*-length` (N μέσο πλευράς) | ✅ | ✅ | — |
| `*-edge-w` (W μέσο πλευράς) | ✅ `gripIndex 8` | ❌ | **Προσθήκη** |
| `*-edge-s` (S μέσο πλευράς) | ✅ `gripIndex 9` | ❌ | **Προσθήκη** |
| 4 γωνιακές λαβές | ✅ `4..7` | ✅ `4..7` | — |
| **Σύνολο** | **10** | **7 → 10** | |

**Σημείωση για την περιστροφή:** η κολόνα (Giorgio 2026-06-15, ADR-363 Slice F special-case)
τοποθετεί το σήμα περιστροφής **στο μέσο** της νοητής γραμμής κέντρου→νότιας-μέσης (τοπικό
`(0,−depth/4)`) — **ακριβώς** όπως το περιέγραψε ο Giorgio. Το πέδιλο το είχε στο νότιο **πρόσωπο**
(`−length/2`, γενική `rotation-handle-policy`). Η μετακίνηση στο `−length/4` είναι (α) πιστή παρ-ομοιότητα
και (β) **αναγκαία** ώστε να μην συμπίπτει με το νέο `foundation-edge-s` (στο `−length/2`).

## 2. Decision — Τι αποφασίστηκε (Giorgio, plan mode 2026-06-24)

1. **Εύρος = μόνο `pad`** (ορθογώνιο πέδιλο) — το ακριβές ανάλογο της ορθογώνιας κολόνας. Τα γραμμικά
   πέδιλα (`strip`/`tie-beam`) είναι ανάλογα τοίχου/δοκού και κρατούν parity τοίχου/δοκού (7-grip
   axis-box, ADR-436 2026-06-11) — **αμετάβλητα**.
2. **Ναι, εκπομπή ορατού σταυρού μετακίνησης** (`foundation-center`) — πανομοιότυπο με την ορθογώνια
   κολόνα (που ξανα-πρόσθεσε το center MOVE grip για rect, ADR-363 Slice C).
3. **Πλήρες SSoT reuse, μηδέν διπλότυπα** — κανένα νέο rendering/registry/engine.

## 3. Υλοποίηση — SSoT reuse (μηδέν νέο μηχανισμό)

**Επιβεβαιωμένη έτοιμη υποδομή (καμία αλλαγή):**
- `bim/grips/grip-glyph-registry.ts` → `'foundation-center':'move'` + `'foundation-rotation':'rotation'` (ήδη)
- `hooks/grips/wall-hot-grip-fsm.ts` → `'foundation-center':'move'` + `hotGripKindOf` διαβάζει `foundationGripKind` (ήδη)
- `bim/grips/move-glyph-frame.ts` → `resolveMoveGlyphFrame` υποστηρίζει ρητά `foundation pad` (περιστρεφόμενα βελάκια) (ήδη)
- `hooks/grips/grip-registry.ts` → προσαρτά αυτόματα `moveGlyphFrame`+`moveGlyphMmScale` σε κάθε grip με hot-grip op `'move'` (ήδη)
- `bim/grips/rect-grip-engine.ts` → corner/edge resize (opposite-element-fixed) — κοινό με κολόνα/τοίχο

**Αλλαγές (4 αρχεία κώδικα + tests):**
- `hooks/grip-kinds.ts` — `FoundationGripKind += 'foundation-edge-w' | 'foundation-edge-s'`.
- `bim/foundations/foundation-grips-pad-frame.ts` — `export computeCentroidWorld`· νέες
  `edgeWHandleWorld` (`localToWorld({x:−width/2,y:0})`) / `edgeSHandleWorld` (`localToWorld({x:0,y:−length/2})`)
  (καθρέφτης `rectColumnGrips`)· `rotationHandleWorld` → `localToWorld({x:0,y:−length/4})` (καθρέφτης
  column rect)· νέος `FOUNDATION_EDGE_MAP` (`width`/`edge-w`/`length`/`edge-s` → `{axis,near}`, mirror
  `COLUMN_EDGE_MAP`).
- `bim/foundations/foundation-grips.ts` — `getFoundationGrips` (pad): εκπομπή `foundation-center`
  (gripIndex 0) + `foundation-edge-w` (8) + `foundation-edge-s` (9), ίδια σειρά/δείκτες με
  `rectColumnGrips`· `applyFoundationGripDrag` (pad): τα inline `width`/`length` blocks
  ενοποιήθηκαν σε **ένα** `applyRectEdgeDrag` μέσω `FOUNDATION_EDGE_MAP` (DRY, καλύπτει αυτόματα και τα 4 edges).

**Σταθερότητα (γιατί δουλεύει χωρίς άλλη αλλαγή):** το rotation drag (`rotateAroundPosition`) διαβάζει
το ΙΔΙΟ `rotationHandleWorld` SSoT → η λαβή δεν «πηδά» στο πιάσιμο παρά τη μετακίνηση στο `−length/4`.
Το 6-click pivot (`rotateAroundPivot`) δεν διαβάζει τη θέση της λαβής → αμετάβλητο.

## 4. Testing

`bim/foundations/__tests__/foundation-grips.test.ts` — **42/42 GREEN**:
- pad εκπέμπει **10 grips** (center + rotation + 4 edges + 4 corners), σταθεροί δείκτες.
- `foundation-center` → `type:'center'`, `movesEntity:true`, θέση = centroid· τα υπόλοιπα `movesEntity:false`.
- `foundation-edge-w`/`-edge-s` θέσεις = W/S μέσα πλευρών· rotation στο `−length/4` (midway).
- drag `edge-w`/`edge-s` → resize της σωστής πλευράς με αντίθετη σταθερή + clamp `MIN_FOUNDATION_DIMENSION_MM`.
- regression: strip/tie-beam **7 grips αμετάβλητα**· `apply-entity-preview-foundation` + `foundation-from-grid` πράσινα (27/27).

ΕΚΤΟΣ ADR-040 (pure grip geometry — δεν αγγίζει micro-leaf canvas αρχιτεκτονική). **CHECK 6D**: τα grip
αρχεία αγγίζουν το canvas-drawing pipeline → stage **ADR-517 + ADR-436** στο commit.

## 5. Changelog

| Date | Author | Change |
|------|--------|--------|
| 2026-06-24 | Opus | Αρχική σύνταξη + υλοποίηση. Pad πέδιλο → πλήρης rect-column grip parity: εκπομπή `foundation-center` (σταυρός μετακίνησης 4 αυτόνομων βελακιών) + 2 νέες λαβές μέσου πλευράς (`foundation-edge-w`/`-edge-s`) + μετακίνηση σήματος περιστροφής στο `−length/4` (midway, καθρέφτης κολόνας — αποφεύγει σύμπτωση με edge-s). FULL SSoT reuse (μηδέν νέο rendering/registry/engine — όλα ήδη συνδεδεμένα από ADR-436 Slice 1b). 4 αρχεία κώδικα + tests. 42/42 foundation-grips jest + 27/27 regression GREEN. Εύρος = μόνο pad (Giorgio)· strip/tie-beam parity τοίχου/δοκού αμετάβλητο. 🔴 browser-verify + commit. |
