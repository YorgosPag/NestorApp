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

- **Phase 1 = L-shape** (single beam, bearing arm — η περίπτωση των πρώτων στιγμιότυπων, πλήρως tested).
- **Phase 2 = T-shape** (dual beam, T-junction — βλ. §9). U/I/composite → `null` (ο caller κρατά τα raw
  params — **μηδέν regression**)· καθαρά fast-follow.
- **Handedness:** deterministic placement (foot στην πλευρά που προκύπτει από `u_span`, flipY=false)·
  ο χρήστης κάνει mirror αν θέλει την άλλη πλευρά (ADR-492 reframe χειρίζεται το mirror).
- **DEFER:** dedicated flange-thickness grip + panel field (το smart-fit το ορίζει αυτόματα· τα υπάρχοντα
  T grips παραμένουν σωστά μέσω του de-dup `materializeTshape`). 1-beam T-shape fit. U/I/composite.

---

## 9. Phase 2 — T-shape dual-beam (T-junction)

`Στιγμιότυπο οθόνης 2026-06-19 004244.jpg`.

**Πρόβλημα:** ορθογωνική κολώνα με **ΔΥΟ κάθετα δοκάρια** κολλημένα (T-junction). Αλλαγή σε **Τ
(T-shape)** → το Τ μπαίνει **έκκεντρο/λάθος προσανατολισμένο** (περιστραμμένος σταυρός): ο command-time
hook καλούσε fit μόνο για L-shape, και το single-beam bearing-arm μοντέλο δεν αρκεί — το Τ θέλει **δύο**
δοκάρια να ορίσουν ταυτόχρονα rotation + θέση + πάχη **δύο** σκελών.

**Απόφαση (Revit-canonical):** κάθε σκέλος του Τ γίνεται **δομική συνέχεια** του αντίστοιχου δοκαριού:
- **πέλμα (flange)** ∥ το **συνεχόμενο** δοκάρι (ο κόμβος εσωτερικός στο span του)· `flangeThickness =
  flangeBeam.width`, flange centerline ≡ άξονάς του.
- **κορμός (web)** ∥ το **καταλήγον** δοκάρι (το ένα άκρο του στον κόμβο)· `webThickness = webBeam.width`,
  web centerline ≡ άξονάς του.

Επειδή `πάχος σκέλους == πλάτος δοκαριού` **ΚΑΙ** `centerline ≡ άξονας`, **και οι δύο παρειές** κάθε
σκέλους πέφτουν flush αυτόματα — το «flush» (α1/α2, β1/β2 του στιγμιότυπου) είναι **συνέπεια** της συνέχειας.

### 9.1 Κρίσιμο gap (γεωμετρία)

Το `flangeDepth` (πάχος πέλματος, Y) ήταν **hard-coded `depth/3`** σε ΔΥΟ σημεία (`buildTshapeLocal` +
`column-variant-grips`). **NEW `ColumnTshapeParams.flangeThickness?`** (mirror `webThickness`) →
override-able· default `depth/3` (back-compat). De-dup σε ΕΝΑ SSoT default (`materializeTshape`).

### 9.2 Μαθηματικά (κλειστή λύση, anchor='center' — ίδιο μοτίβο §4)

- **rotation:** τοπικό +Y (κορμός→πέλμα) = `−u_webOut` (αντίθετο της φοράς που εκτείνεται το
  κορμός-δοκάρι) → `θ = atan2(−target.x, target.y)`, `target = −u_webOut`.
- **κόμβος** `N` = τομή των δύο αξόνων (`lineIntersectionPoint`)· σε τοπικές mm = `P_local =
  (0, D/2 − flangeThickness/2)` (τομή flange-centerline × web-centerline).
- **`position = N − R(θ)·(P_local·s)`**· `W = max(width, webThickness)`, `D = max(depth, flangeThickness
  + webThickness)`, `flangeLength = W` (πέλμα = πλήρες bbox-πλάτος).
- **flange vs web:** το δοκάρι με τον κόμβο **εσωτερικό** στο span (μεγαλύτερη απόσταση κόμβου από τα άκρα
  του) = flange (συνεχές)· το άλλο = web (καταλήγει).

### 9.3 Υλοποίηση (extend — μηδέν διπλότυπα)

| # | Αλλαγή | Αρχείο |
|---|--------|--------|
| 1 | **NEW** `ColumnTshapeParams.flangeThickness?` + Zod | `bim/types/column-types.ts`, `column.schemas.ts` |
| 2 | `buildTshapeLocal`: `flangeDepth = override?.flangeThickness ?? depth/3` | `bim/geometry/column-geometry.ts` |
| 3 | `materializeTshape` επιστρέφει & `flangeThickness`· 2 handle positions το χρησιμοποιούν (**de-dup** `depth/3`)· `mergeTshape` το διατηρεί (+flipY) | `bim/columns/column-variant-grips.ts` |
| 4 | hard-error `flangeThickness ≤0 ∥ > depth` | `bim/validators/column-validator.ts` |
| 5 | **NEW** pure `lineIntersectionPoint(p0,u0,p1,u1)` (γενική τομή αξόνων) | `bim/geometry/shared/polygon-axis-projection.ts` (re-export `polygon-utils`) |
| 5b | **NEW** SSoT `rotationDegToAlignLocalY(target)` (κλειστή λύση «rotation ώστε τοπικό +Y → διάνυσμα», με απόδειξη) — de-dup του raw `atan2(−x,y)` που ήταν σε Phase 1 + Phase 2 | `bim/grips/grip-math.ts` |
| 6 | **NEW** `alignTShapeColumnToFramingBeams` + `alignColumnOnTypeChange` dispatcher + ΕΝΑ `beamEndsByProximity` SSoT (de-dup 3 inline near/far υπολογισμών) — reuse `unitVector`/`rotateVector`/`rotationDegToAlignLocalY`/`lineIntersectionPoint`/`mmToSceneUnits` | `bim/columns/column-beam-align.ts` |
| 7 | command-time gate σε **κάθε** type-change → `alignColumnOnTypeChange` | `ui/ribbon/hooks/bridge/useColumnParamsDispatcher.ts` |
| 8 | **+9 jest** (H+V/διαγώνιο ζεύγος, bbox grow, <2/μη-κάθετα/non-T → null, dispatcher) | `bim/columns/__tests__/column-beam-align.test.ts` |

**Full automation:** ΗΔΗ wired (`bim:column-params-updated` → organism/foundation/loads/reinforce). Μηδέν
νέο trigger — command-time, ΕΝΑ emit (μάθημα ADR-492 freeze).

### 9.4 Edge cases / DEFER
- **Ακριβώς 2 κάθετα** → ιδανικό Τ. `<2` ή μη-κάθετα → `null` (catalog fallback, μηδέν regression).
  `>2` → καλύτερο κάθετο ζεύγος (κόμβος πλησιέστερα στο κέντρο κολώνας).
- Beam endpoints μετά το reshape: ο cutback (ADR-458) τα χειρίζεται οπτικά· αναλυτικό μήκος → ADR-492 reframe.

## 10. Phase 3 — L-shape dual-beam corner (Γ στη ΓΩΝΙΑ)

`Στιγμιότυπο οθόνης 2026-06-19 014157.jpg`.

**Πρόβλημα:** ορθογωνικό πλαίσιο δοκαριών με **κολώνες τύπου Γ (L-shape) στις ΓΩΝΙΕΣ**· σε κάθε γωνία
**ΔΥΟ κάθετα δοκάρια ΚΑΤΑΛΗΓΟΥΝ** (corner junction). Η αλλαγή σε Γ καλούσε τη Phase 1 (single-beam
bearing-arm) → ευθυγραμμιζόταν **ΜΟΝΟ** το ένα σκέλος στο πλησιέστερο δοκάρι· το δεύτερο σκέλος έμενε
catalog-default (`armLength = depth/3`) → **δεν πατούσε** στην παρειά του 2ου δοκαριού (μπακάλικο).

**Διαφορά από Phase 2 (T):** το Τ έχει συμμετρικό πέλμα + ένα δοκάρι «περνά ευθεία»· το **Γ είναι
ασύμμετρο** και **ΚΑΙ ΤΑ ΔΥΟ δοκάρια καταλήγουν** → handedness και στους δύο άξονες.

**Απόφαση (Revit-canonical):** κάθε σκέλος του Γ γίνεται **δομική συνέχεια** του αντίστοιχου δοκαριού:
- **κατακόρυφο σκέλος** (πάχος `armWidth`, τοπικό +Y) ∥ το ένα δοκάρι· `armWidth = (vertical-leg
  beam).width`, centerline ≡ άξονάς του.
- **οριζόντιο σκέλος / foot** (πάχος `armLength`, τοπικό +X) ∥ το άλλο· `armLength = (foot beam).width`,
  centerline ≡ άξονάς του.

Η **γωνία** του Γ κάθεται στον **κόμβο** N = τομή των δύο αξόνων· τα δύο ελεύθερα άκρα βλέπουν προς
τα ανοίγματα. Επειδή `πάχος σκέλους == πλάτος δοκαριού` ΚΑΙ `centerline ≡ άξονας`, **και οι δύο
παρειές** κάθε σκέλους πέφτουν flush αυτόματα (συνέπεια της συνέχειας).

### 10.1 Handedness — κλειστή λύση cross-product (ΟΧΙ 4 hard-coded γωνίες)

**Κρίσιμη επαλήθευση (γιατί ΔΕΝ χρειάζεται `flipX`/`flipY`):** μετά το `rotationDegToAlignLocalY(u_v)`
ισχύει `R(θ)·(0,1) = u_v` (CCW), άρα `R(θ)·(1,0) = (u_v.y, −u_v.x)` ⇒ ο foot δείχνει **πάντα** στη φορά
με `cross(u_v, foot_out) = −1`. Επομένως αρκεί να **διαλέξουμε ποιο δοκάρι είναι το κατακόρυφο σκέλος**
βάσει του **προσήμου του cross-product** των δύο outward διευθύνσεων (`crossZ(outA, outB) < 0`): η σωστή
γωνία και για τις 4 γωνίες προκύπτει από τη **συνεχή rotation + τη χειρότητα** — scale/rotation-invariant,
μηδέν per-corner if. Το πιθανό gap «`ColumnLshapeParams` έχει μόνο `flipY`» **δεν υφίσταται** για το corner
case: `flipY` παραμένει `false`.

### 10.2 Μαθηματικά (κλειστή λύση, anchor='center' — ίδιο μοτίβο §4/§9.2)

- **κόμβος** `N` = τομή των δύο αξόνων (`bestPerpendicularPair` → `lineIntersectionPoint`).
- **outward** κάθε δοκαριού από τον κόμβο = `unitVector(N, beamEndsByProximity(beam, N).far)`.
- **rotation:** `θ = rotationDegToAlignLocalY(u_verticalOut)`.
- **`P_local`** = `(−W/2 + armWidth/2, −D/2 + armLength/2)` (mm· ο κόμβος = τομή leg-centerlines,
  flipY=false) → **`position = N − R(θ)·(P_local·s)`**.
- **bbox:** `W = max(width, armWidth)`, `D = max(depth, armLength)`.

### 10.3 Υλοποίηση (extend — μηδέν διπλότυπα)

| # | Αλλαγή | Αρχείο |
|---|--------|--------|
| 1 | **NEW** `alignLShapeColumnToFramingBeams` (reuse `bestPerpendicularPair`/`beamAxes`/`beamEndsByProximity`/`unitVector`/`rotateVector`/`rotationDegToAlignLocalY`/`mmToSceneUnits`) + local `crossZ` (2-vector chirality, single-use· δεν υπάρχει shared 2-vector cross SSoT — οι υπάρχοντες είναι 3-point `crossZ(o,a,b)` ή Vec3 ή inline line-intersection denominators) | `bim/columns/column-beam-align.ts` |
| 2 | Dispatcher L branch → `alignLShapeColumnToFramingBeams(...) ?? alignColumnToFramingBeam(...)` (dual-leg όταν 2 κάθετα· αλλιώς single-beam Phase 1 — μηδέν regression) | `bim/columns/column-beam-align.ts` |
| 3 | **+9 jest** (Γ στις 4 γωνίες ορθογωνίου: άξονας≡δοκάρι + πάχος=beam.width + κόμβος flush + handedness ανά γωνία· bbox grow· `<2`/μη-κάθετα/non-L → null· dispatcher dual-leg) | `bim/columns/__tests__/column-beam-align.test.ts` |

**Ο hook `useColumnParamsDispatcher` δεν αλλάζει** — καλεί ήδη τον dispatcher (command-time, ΕΝΑ emit →
ADR-492 safe). **Full automation** ήδη wired (`bim:column-params-updated` → organism/foundation/loads/
reinforce → διατομές/οπλισμός κολώνας + πέδιλο + δοκάρια). Μηδέν νέο trigger.

### 10.4 Edge cases / DEFER
- **Ακριβώς 2 κάθετα σε γωνία** → ιδανικό Γ. **1 δοκάρι** → single-beam bearing-arm (Phase 1, μηδέν
  regression). **>2** → καλύτερο κάθετο ζεύγος (κόμβος πλησιέστερα στο κέντρο). **μη-κάθετα** → `null`.
- Beam endpoints μετά το reshape: cutback (ADR-458) οπτικά· αναλυτικό μήκος → ADR-492 reframe.

## 8. Changelog

- **2026-06-19** — Αρχική υλοποίηση (Phase 1, L-shape). 7 jest GREEN. UNCOMMITTED.
- **2026-06-19** — SSoT audit (Giorgio): de-dup χειροκίνητου unit-vector → reuse `unitVector` (grip-math). 7 jest GREEN.
- **2026-06-19** — **Phase 2 (T-shape dual-beam, §9):** NEW `flangeThickness` field + `alignTShapeColumnToFramingBeams` + `alignColumnOnTypeChange` dispatcher + `lineIntersectionPoint` SSoT + de-dup `flangeDepth`. column-beam-align 16 jest / 147 touched-suite jest GREEN. UNCOMMITTED.
- **2026-06-19** — **SSoT audit (Giorgio):** de-dup 2 μοτίβα που είχαν μείνει — (α) raw `atan2(−x,y)` ×2 → NEW `rotationDegToAlignLocalY` (grip-math), (β) near/far endpoint ×3 → ΕΝΑ `beamEndsByProximity`. 133 jest GREEN, tsc 0 errors στα touched files (τα 7 project errors = άλλων agents).
- **2026-06-19** — **Phase 3 (L-shape dual-beam corner, §10):** NEW `alignLShapeColumnToFramingBeams` — Γ σε γωνία με 2 κάθετα δοκάρια που καταλήγουν· κάθε σκέλος = δομική συνέχεια του δοκαριού του· **handedness με πρόσημο cross-product** (ΟΧΙ 4 hard-coded γωνίες· επαληθεύτηκε ότι `flipX`/`flipY` ΔΕΝ χρειάζονται). Dispatcher L branch → dual-leg ?? single-beam fallback. **+9 jest → 25 column-beam-align GREEN.** UNCOMMITTED.
