# HANDOFF — Centre-anchored geometry SSoT: anchor-dims fix (#1) + transformFootprint unification (#2)

**Date:** 2026-06-11 · **Model:** Opus · **Branch:** main · **Shared working tree** (άλλος agent δουλεύει ταυτόχρονα)

> ⚠️ **ΚΑΝΟΝΕΣ (απαράβατοι):** ΠΟΤΕ `git commit`/`push` — **ο Giorgio κάνει commit**. `git add` **ΜΟΝΟ τα δικά σου αρχεία**, **ΠΟΤΕ `-A`** (shared tree). N.17: **ΕΝΑ tsc τη φορά** — έλεγξε διεργασίες πρώτα (`Get-CimInstance Win32_Process … *tsc*`). **Απάντα στον Giorgio ΕΛΛΗΝΙΚΑ.**
>
> 🎯 **Στόχος ποιότητας (Giorgio, ρητό ×6):** FULL ENTERPRISE + FULL SSOT, όπως **Revit**. SEARCH FIRST· μηδέν διπλότυπα· μία πηγή αλήθειας.

---

## 0. ΠΟΥ ΒΡΙΣΚΟΜΑΣΤΕ (τι ολοκληρώθηκε — μην το ξανακάνεις)

**ADR-363 Slice F DONE** (2026-06-11, 88 suites / 1110 jest + tsc καθαρό, **όχι ακόμα commit/browser-verify**):
Ενοποίηση «λαβή περιστροφής → απέναντι παρειά (stand-off) από λαβή πάχους» σε **όλες** τις box-grip οικογένειες, + 2 Boy-Scout cleanups. Τρία NEW SSoT modules:

1. **`bim/grips/rotation-handle-policy.ts`** — `ROTATION_HANDLE_OFFSET_MM` (μία πηγή· ήταν τριπλή), `oppositeFace(sign)`, `rotationHandlePerpOffset(halfExtent, dimFaceSign, offset)`.
2. **`bim/grips/grip-math.ts`** `farEdgeSign(offsetComponent)` — ένα axis-agnostic (ήταν διπλό `farEdgeSignX/Y` σε column + foundation).
3. **`bim/grips/centred-anchor-frame.ts`** — `centredCentroidWorld(frame)` + `centredLocalToWorld(frame, localMm)`· interface `CentredAnchorFrame {position, rotationDeg, scale, anchorOffset:{dx,dy}, dimX, dimY}`. Ενοποίησε 3-4 αντίγραφα της centre-anchored anchor-shift→rotate→scale→translate γεωμετρίας + διόρθωσε raw cos/sin.

**Consumers (thin wrappers, behavior-preserving):** `column-grip-utils.ts` (computeCentroidWorld/localToWorld/rotationHandleWorld), `foundation-grips.ts` (pad), `column-anchors.ts` (localToWorld), `axis-box-grips.ts` (rotation), `centred-box-grips.ts` (μόνο σταθερά).

> **ΣΗΜΕΙΩΣΗ memory:** `~/.claude/projects/C--Nestor-Pagonis/memory/reference_rotation_handle_policy_ssot.md` έχει το πλήρες SSoT map. Διάβασέ το.

---

## 1. ΚΡΙΣΙΜΟ ΕΥΡΗΜΑ που οδηγεί ΚΑΙ ΤΑ ΔΥΟ tasks

Το **πραγματικό footprint** μιας κολώνας U-shape/composite/polygon ΔΕΝ είναι `width × depth` — είναι το **bbox των πραγματικών vertices**. Τρεις «πηγές» dims:

| Πηγή | dims για U/composite/polygon | Σωστό; |
|---|---|---|
| **Render** `column-geometry.ts` `transformFootprint:373` | `computeLocalBboxCanvas(local)` (πραγματικό bbox) | ✅ |
| **Grips** `column-grip-utils.ts` `columnFootprintDims` | `polygonBboxMm` / `polygonBackedBboxMm` | ✅ |
| **Anchor-snap** `column-anchors.ts` `localToWorld` | **`width × depth`** | ❌ ΛΑΘΟΣ |

→ Το `column-anchors` είναι ο **μόνος** που διαφωνεί με render+grips. Για U/composite κολώνα, τα anchor-snap σημεία δεν πέφτουν στο ορατό σχήμα. **Revit = μία αλήθεια γεωμετρίας** (render = handles = insertion/anchor).

---

## 2. TASK #1 (ΤΩΡΑ — bug fix, μικρό, χαμηλό ρίσκο)

**Ευθυγράμμισε το `column-anchors.localToWorld` να χρησιμοποιεί τα ΙΔΙΑ dims με render+grips** (πραγματικό poly-bbox για U/composite), ώστε anchor-snap == ορατό footprint.

### Βήματα
1. **SSoT για τα dims:** το `columnFootprintDims(params)` είναι σήμερα **private** στο `bim/columns/column-grip-utils.ts:84`. Κάν' το **export** (ή μετακίνησέ το σε ουδέτερο σημείο αν δημιουργείται circular import column-anchors↔column-grip-utils — **έλεγξε**: το column-grip-utils ΔΕΝ εισάγει column-anchors, οπότε export πιθανότατα ΟΚ).
2. Στο `bim/columns/column-anchors.ts` `localToWorld` (≈ γρ. 149), αντικατέστησε το local dim-block:
   ```ts
   const { dimX, dimY } = params.kind === 'polygon'
     ? polygonBboxMm(params.width, params.polygon?.sides)
     : { dimX: params.width, dimY: params.depth };
   ```
   με:
   ```ts
   const { dimX, dimY } = columnFootprintDims(params);   // SSoT: poly-bbox για U/composite/polygon
   ```
   (Κράτα το circular branch ως έχει — `rotationDeg:0, anchorOffset:{0,0}`.) Το `columnFootprintDims` ήδη καλύπτει polygon + U-shape + composite + else(width/depth), άρα το `polygonBboxMm` import μπορεί να γίνει αχρείαστο εκεί — **καθάρισέ το** αν ναι.
3. **ΠΡΟΣΟΧΗ:** το `columnFootprintDims` καλύπτει polygon ΚΑΙ U/composite. Το παλιό column-anchors κάλυπτε polygon αλλά ΟΧΙ U/composite (έπεφτε σε width/depth). Άρα η αλλαγή **μετακινεί** anchor-snap για U/composite κολώνες ώστε να ταιριάζουν στο ορατό σχήμα — **αυτό είναι το ζητούμενο** (Revit-correct).

### Tests + verify
- `npx jest src/subapps/dxf-viewer/bim/columns --silent` (αν κάποιο test κωδικοποιεί το ΛΑΘΟΣ width/depth για U/composite anchor → ενημέρωσέ το· τα rectangular μένουν αμετάβλητα).
- tsc (N.17: έλεγξε διεργασίες πρώτα): `npx tsc --noEmit` (background).
- **Browser-verify:** U-shape/composite κολώνα με anchor ≠ center → τα 9 anchor σημεία + corner-snap πέφτουν στο πραγματικό περίγραμμα.

---

## 3. TASK #2 (ΞΕΧΩΡΙΣΤΗ ΦΑΣΗ — μεγαλύτερο, visual-critical, phased)

**Στόχος (Revit end-state):** ΕΝΑ geometry transform για render + grips + anchors. Σήμερα υπάρχουν **9 `transformFootprint`** (rendering core ανά οντότητα), όλα re-implement το shift→rotate→translate **με raw cos/sin** (παραβίαση `rotatePoint`/ADR-188 SSoT):

```
column-geometry.ts:356 · electrical-panel-geometry.ts:71 · floorplan-symbol-geometry.ts:67 ·
furniture-geometry.ts:64 · mep-boiler-geometry.ts:85 · mep-fixture-geometry.ts:83 ·
mep-manifold-geometry.ts:84 · mep-radiator-geometry.ts:77 · mep-water-heater-geometry.ts:75
```

### Προσοχή στις διαφορές (μην τις αγνοήσεις)
- Το `transformFootprint` μετασχηματίζει **πολύγωνο (N σημεία)**, όχι ένα handle. Επεξεργάζεται **local σε canvas units ήδη** (το column version: `local` canvas, `dimX = width*s`), ενώ το `centred-anchor-frame.centredLocalToWorld` δέχεται **mm** local + κλιμακώνει εσωτερικά. **Χρειάζεσαι έναν batch helper** ή προσαρμογή units.
- Πρόταση: πρόσθεσε στο `centred-anchor-frame.ts` έναν **`centredPolyToWorld(frame, localCanvasPts)`** που δέχεται προ-κλιμακωμένα local σημεία (canvas) + κάνει shift(anchor, dims-canvas)→rotate→translate μέσω `rotateVector`. Έτσι τα 9 engines γίνονται thin wrappers ΧΩΡΙΣ να αλλάξει η unit-σύμβαση τους.
- Κάθε engine χτίζει **δικό του local geometry** (entity-specific) — αυτό ΜΕΝΕΙ per-entity. Μόνο ο μετασχηματισμός ενοποιείται.

### Phased rollout (ΜΗΝ τα κάνεις όλα μαζί)
1. **Phase 2a:** ενοποίησε ΜΟΝΟ το `column-geometry.transformFootprint` → `centred-anchor-frame` (απόδειξη pattern + σβήσιμο raw cos/sin). Jest column + **browser-verify κάθε column kind** (rect/circular/L/T/I/U/polygon/composite/shear-wall: ορατό σχήμα αμετάβλητο). 
2. **Phase 2b+:** rollout στα υπόλοιπα 8, **ΕΝΑ-ΕΝΑ με browser-verify** ανά οντότητα (panel/furniture/boiler/fixture/manifold/radiator/water-heater/floorplan-symbol).
3. Κάθε phase = δικό του commit (Giorgio).

> **ΓΙΑΤΙ phased:** rendering core· οπτικό regression = ορατό σε ΟΛΑ τα BIM. Revit-grade = αλλάζεις τον geometry core με verification gates, όχι μονομιάς.

---

## 4. N.15 — ΕΝΗΜΕΡΩΣΕΙΣ ΜΕΤΑ ΤΗΝ ΥΛΟΠΟΙΗΣΗ (κάθε task)
1. **ADR-363 changelog** (Slice F section): #1 = «column-anchors dims → columnFootprintDims SSoT (anchor==footprint)»· #2 = νέα Slice (π.χ. «Slice G: transformFootprint → centred-anchor-frame, phased»).
2. **`.claude-rules/pending-ratchet-work.md`:** υπάρχει ήδη entry «ADR-363 Slice F residual» — ενημέρωσέ το/σβήσε τη γραμμή του #1 όταν γίνει, κράτα το #2 ως active μέχρι να ολοκληρωθούν και τα 9.
3. **`local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`:** 1-2 γραμμές 🔴 browser-verify ανά task (ΟΧΙ «τι έγινε» — δες FORMAT header του αρχείου).
4. **ΟΧΙ adr-index** (shared tree). **ΕΚΤΟΣ ADR-040** — εκτός αν το pre-commit hook ζητήσει ADR-040 επειδή άγγιξες renderer-coupled αρχείο (π.χ. column-geometry· τότε stage ADR-040).
5. Memory: ενημέρωσε `reference_rotation_handle_policy_ssot.md` αν αλλάξει το SSoT map.

## 5. ΑΡΧΕΙΑ-ΚΛΕΙΔΙΑ
- SSoT: `bim/grips/centred-anchor-frame.ts`, `bim/grips/grip-math.ts` (farEdgeSign + rotateVector), `bim/grips/rotation-handle-policy.ts`, `bim/grips/rect-frame.ts` (rectLocalWorld).
- #1: `bim/columns/column-anchors.ts` (`localToWorld` ≈149), `bim/columns/column-grip-utils.ts` (`columnFootprintDims:84` — export).
- #2: τα 9 `transformFootprint` (λίστα §3).
- ADR: `docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md` (Slice F).

## 6. ΠΑΡΑΔΟΤΕΟ
**#1:** anchor-snap U/composite κολώνας πέφτει στο ορατό σχήμα (== render). **#2 (Phase 2a):** column footprint render οπτικά αμετάβλητο, raw cos/sin σβησμένο, transform = `centred-anchor-frame`. Commit ο Giorgio (shared tree, git add ΜΟΝΟ δικά σου).
