# ADR-496 — Έξυπνη ευθυγράμμιση κολώνας στο πλαισιωτικό δοκάρι κατά την αλλαγή τύπου

**Status:** ✅ APPROVED · **Ημ/νία:** 2026-06-19 · **Συνεισφέρει στο:** ADR-487 (Living Structural Organism vision) · **Χτίζει επάνω:** ADR-494 (footprint-based framing detection), ADR-363 §5.6/§5.7 (column kinds + flush), ADR-492 (associative beam re-frame)

---

## 1. Πρόβλημα (στιγμιότυπο-απόδειξη)

`Στιγμιότυπο οθόνης 2026-06-18 235720.jpg` (+ context `…231904.jpg`).

2 κολώνες 40×40 + πέδιλα, ενωμένες με δοκάρι (`w=250 d=700`) στις εσωτερικές παρειές (πλήρως
μελετημένος οργανισμός). Ο χρήστης **άλλαξε τον τύπο της αριστερής κολώνας** `rectangular →
L-shape`. Η **ADR-494** έλυσε το *στατικό* σκέλος (η L αναγνωρίζεται ως στήριξη, όχι πρόβολος).

**Σύμπτωμα (γεωμετρικό):** το νέο L μπαίνει **έκκεντρο** — το σκέλος του δεν «πατά» στο δοκάρι.
Πράσινες σημειώσεις: βέλος «1» → αριστερή παρειά #1 του δοκαριού· «α» (κυκλωμένο) → η λεπτή όψη
του σκέλους της L.

## 2. Root cause

Στο `useColumnParamsDispatcher` η αλλαγή τύπου περνά **αυτούσια** στο `UpdateColumnParamsCommand`
(ίδιο `position`/`anchor`, μόνο `kind` αλλάζει). Το `buildLshapeLocal` στήνει το L **γύρω από το
ίδιο insertion point** με catalog defaults (`armWidth=width/3`, `armLength=depth/3`) → ασύμμετρο
footprint γύρω από το `position` → το σκέλος δεν πέφτει στον άξονα/παρειά του δοκαριού →
**έκκεντρο**. Κανείς δεν «ταιριάζει» το νέο σχήμα στον φορέα.

> **Αρχή (Giorgio):** τα αποθηκευμένα είδη κολώνας είναι απλά catalog διατομές για να δείχνουν
> τύπους· κατά την αλλαγή το σύστημα πρέπει να είναι **ΕΞΥΠΝΟ** και να **ΤΟΠΟΘΕΤΕΙ** σωστά τη νέα
> κολώνα ταιριάζοντάς την στον οργανισμό. Το **δοκάρι είναι ο reference** — η **κολώνα προσαρμόζεται**.

## 3. Απόφαση (Revit-canonical)

Όταν αλλάζει ο τύπος σε **ασύμμετρη** διατομή (L-shape v1), η νέα κολώνα ταιριάζεται στον φορέα
ώστε ένα σκέλος της («**bearing arm**») να γίνεται **δομική συνέχεια του δοκαριού**:

1. **πάχος bearing arm = πλάτος δοκαριού** (`armWidth == beam.width`)
2. **άξονας bearing arm ≡ άξονας δοκαριού** (perpendicular-coincident centerline)
3. η **ελεύθερη όψη «α»** του bearing arm **flush** στην παρειά #1 (near-end) του δοκαριού
4. το **δεύτερο σκέλος** ακολουθεί αυτόματα (η παρειά του = παρειά δοκαριού — derived)

**Bearing arm = το κατακόρυφο σκέλος του L** (στο `buildLshapeLocal`: το σκέλος με πάχος
`armWidth`, που εκτείνεται σε όλο το `depth` στον τοπικό άξονα +Y, με ελεύθερο άκρο στην κορυφή
`+D/2` και τη γωνία/foot στη βάση).

```
        ┌──┐  ← κατακόρυφο σκέλος (bearing arm)
        │  │     · πάχος armWidth = beam.width (w)   ← (3)
        │  │     · άξονας ≡ άξονας δοκαριού          ← (2)
        │  ├───────════════════════  ΔΟΚΑΡΙ (w=250)
        │  │  α↑ όψη «α» flush στην παρειά #1        ← (1)
   ─────┴──┘
   οριζόντιο σκέλος (foot) — παρειά flush στην πλευρά δοκαριού  ← (4, derived)
```

## 4. Μαθηματικά (κλειστή λύση, anchor='center')

Με κεντρικό anchor ο transform γίνεται `world = position + R(rotation)·p_local`
(`centredPolyToWorld`). Για να πιάσουμε το near-end centerline του bearing arm (`P_local`) στην
παρειά του δοκαριού (`E_n`) με τον bearing arm συγγραμμικό στον άξονα `u_span`:

- **`rotation = θ`** ώστε `R(θ)·(0,1) = u_span` → `θ = atan2(−u_span.x, u_span.y)`
- **`P_local`** = `(−W/2 + armWidth/2, +D/2)` (mm· flipY=false: σκέλος αριστερά, ελεύθερο άκρο κορυφή)
- **`position = E_n − R(θ)·(P_local·s)`** (αντιστροφή — μηδέν per-engine cos/sin)

όπου `E_n` = το άκρο του δοκαριού πλησιέστερα στο κέντρο της κολώνας (παρειά #1), `u_span` =
μοναδιαία φορά προς το μακρινό άκρο (άνοιγμα), `w` = `beam.params.width`, `s = mmToSceneUnits`.
Εγγύηση `W,D ≥ armWidth` (το bbox χωρά το bearing arm).

## 5. Υλοποίηση (full SSOT — extend, μηδέν διπλότυπα)

| # | Αλλαγή | Αρχείο |
|---|--------|--------|
| 1 | **NEW** pure SSoT `alignColumnToFramingBeam(column, nextParams, framingBeams) → ColumnParams \| null` (reuse `rotateVector`/`mmToSceneUnits`) | `bim/columns/column-beam-align.ts` |
| 2 | **NEW** `findBeamsFramingColumn(column, entities)` — reverse του `findColumnsFramedByBeamForGraph`, reuse **`beamFramesColumn`** (ADR-494) | `bim/columns/column-structural-attach-coordinator.ts` |
| 3 | Command-time hook: αλλαγή τύπου → L-shape ⇒ fit ΠΡΙΝ το command (ΕΝΑ command/emit) | `ui/ribbon/hooks/bridge/useColumnParamsDispatcher.ts` |
| 4 | **NEW** 7 jest (οριζόντιο/κατακόρυφο/λοξό δοκάρι· flush+axis+width· near-end· clamp· fallback· non-L) | `bim/columns/__tests__/column-beam-align.test.ts` |

**Reuse (μηδέν νέα detection/flush/geometry/math):** `beamFramesColumn` + `projectColumnFootprintOnAxis`
(ADR-494), `unitVector` + `rotateVector` → `rotatePoint` (grip-math SSoT, ADR-188), `mmToSceneUnits`,
`centredPolyToWorld` (ADR-363 Slice F). Το concern (column→beam align) είναι **νέο** SSoT — δίδυμο του
αντίστροφου `resolveBeamColumnFlushJustification` (beam→column flush, ADR-363 §5.7)· δεν υπάρχει
προϋπάρχον module για column placement-on-type-change.

## 6. Full automation (ADR-487)

Ο proactive κύκλος ακούει **ήδη** `bim:column-params-updated` (επιβεβαιωμένο: `useStructuralOrganism`
/ `useAutoFoundationDesign` / `useProactiveStructuralLoads` / `useProactiveOrganismReinforce` /
`useColumnPersistence`). Άρα το command-time fit + το **υπάρχον** emit → **πλήρης αυτόματη
επανα-μελέτη** (διατομές/οπλισμός κολώνας + πέδιλο + οπλισμοί πεδίλου + διατομές/οπλισμός δοκαριού).
Κανένα νέο re-trigger — **command-time, ΕΝΑ emit** (μάθημα ADR-492: ΠΟΤΕ reactive effect που
re-emit-άρει geometry event μέσα σε proactive κύκλο → freeze).

## 7. Scope & DEFER

- **v1 = L-shape μόνο** (η περίπτωση των στιγμιότυπων, πλήρως tested). T/U/I/composite → `null`
  (ο caller κρατά τα raw params — **μηδέν regression**)· καθαρά fast-follow (ίδιο bearing-arm μοτίβο).
- **Handedness:** deterministic placement (foot στην πλευρά που προκύπτει από `u_span`, flipY=false)·
  ο χρήστης κάνει mirror αν θέλει την άλλη πλευρά (ADR-492 reframe χειρίζεται το mirror).
- **2 δοκάρια** (corner κολώνα) → v1 ευθυγραμμίζει στο πλησιέστερο· true dual-leg alignment = DEFER.

## 8. Changelog

- **2026-06-19** — Αρχική υλοποίηση (v1 L-shape). 7 jest GREEN. UNCOMMITTED.
- **2026-06-19** — SSoT audit (Giorgio): de-dup χειροκίνητου unit-vector → reuse `unitVector` (grip-math). 7 jest GREEN.
