# ADR-746 — Σημεία ορισμού διάστασης: ένας αναγνώστης, επισκευή Phase-A1, απομόνωση δηλητηριώδους οντότητας

**Κατάσταση:** Ενεργό
**Ημερομηνία:** 2026-08-01
**Σχετικά:** ADR-362 (Dimension System) · ADR-040 Phase IX (viewport culling) · ADR-726/ADR-743 (bitmap cache) · ADR-510 Φ5 (aggregate poisoning) · ADR-716 Φ7 / ADR-736 (τα δύο προηγούμενα «ξεχάστηκαν τα defPoints»)

---

## Summary

Ένα ζωντανό `TypeError: dim.defPoints is not iterable` έριχνε **ολόκληρο το raster του σχεδίου σε
κάθε καρέ**. Η ρίζα δεν ήταν το ένα call site: **~40 σημεία ρωτούσαν «ποια είναι τα defPoints;» με
5 ασύμβατες πολιτικές** και καμία αρχή δεν απαντούσε. Το ADR εισάγει τον **ΕΝΑ αναγνώστη**
(`resolveDimDefPoints`), **επισκευάζει** τα δεδομένα Phase-A1 αντί να τα πετάει, και προσθέτει
**απομόνωση δηλητηριώδους οντότητας** ώστε καμία μεμονωμένη οντότητα να μην ακυρώνει ξανά τη σκηνή.

---

## 1. Context — ο ζωντανός ένοχος (2026-08-01)

```
[ERROR] [DxfBitmapCache] Bitmap cache rebuild failed
  {"error":{"message":"dim.defPoints is not iterable","name":"TypeError"}}
    at DxfBitmapCache.rebuild            (dxf-bitmap-cache.ts:368)
    at useDxfCanvasRenderer[renderScene]  (dxf-canvas-renderer.ts:212)
    at UnifiedFrameSchedulerImpl.processFrame (UnifiedFrameScheduler.ts:252)
```

### 1.1 Γιατί ήταν πολύ χειρότερο από «θόρυβος στην κονσόλα»

Το throw έπεφτε **μέσα στο `try`** του `DxfBitmapCache.rebuild` → `cacheKey = null` → **κάθε καρέ**
ξαναέχτιζε το raster ΟΛΟΥ του σχεδίου (~3.000 οντότητες) και το ξαναπετούσε. Μία κακοσχηματισμένη
διάσταση κόστιζε **ολόκληρη τη σκηνή, μόνιμα** — άμεση επιβάρυνση στο pan/zoom που κυνηγά το ADR-743.

### 1.2 Η πραγματική ρίζα: πέντε πολιτικές, καμία αρχή

Το `defPoints` διαβάζεται σε **~40 σημεία** με **5 ασύμβατες** πολιτικές ασφάλειας:

| # | Πολιτική | Πού | Ανθεκτικό; |
|---|----------|-----|-----------|
| 1 | `[...(dim.defPoints ?? [])]` | `bounds-primitives.calculateDimensionBounds` | ✅ |
| 2 | `dimEntity?.defPoints ? … : null` | `entity-bounds-ssot.dimensionBounds` | ✅ |
| 3 | `entity.defPoints[i] ?? ORIGIN` (×18) | `dxf-dimension-writer` | ✅ |
| 4 | `if (!pts \|\| pts.length === 0)` | `dimension-renderer-support` | ✅ |
| 5 | **σκέτο `[...dim.defPoints]` / `const [a,b,c] = entity.defPoints`** | `dimension-cull-bounds:78`, `dim-hit-geometry:65/93`, `dim-space-engine`, `DimReassociateCommand`, οι builders | ❌ **ΘΑΝΑΤΗΦΟΡΟ** |

> ⚠️ **Οι γραμμές 1–2 είναι η απόδειξη.** Το κενό `defPoints` ήταν **ήδη γνωστό**: κάποιος το
> συνάντησε και θωράκισε **τον δικό του** call site. Το `entity-bounds-ssot` καλεί την **ΙΔΙΑ**
> `getDimensionWorldBounds` με το viewport culling — έβαλε φύλακα μπροστά της αντί να διορθώσει
> **μέσα** της, οπότε ο δεύτερος καταναλωτής έμεινε εκτεθειμένος και έριξε το raster.
> Αυτό είναι κυριολεκτικά «λύσε το δείγμα, όχι την κλάση».

### 1.3 Γιατί ο TypeScript δεν το έπιασε

Ο τύπος λέει `defPoints: readonly Point2D[]` (υποχρεωτικό), αλλά **κανένα runtime σύνορο δεν το
επιβάλλει**:
- ο type guard είναι `isDimensionEntity = entity.type === 'dimension'` — **τίποτε άλλο**·
- **δεν υπάρχει καμία migration/hydration** για τα @deprecated `startPoint`/`endPoint` κάτοπτρα της Phase A1·
- οι οντότητες φτάνουν από persistence / DXF import / clipboard / undo patches — σύνορα όπου ο
  τύπος είναι **υπόσχεση, όχι εγγύηση**.

Τρίτο επεισόδιο της ίδιας οικογένειας: **ADR-716 Φ7** (η κλίμακα μετακινούσε μόνο τα κάτοπτρα) και
**ADR-736** (το `normalizeEntityPositions` δεν είχε κλάδο `dimension`).

---

## 2. Έρευνα — τι κάνουν οι μεγάλοι παίκτες

| Πηγή | Πρακτική | Τι κρατάμε |
|------|----------|-----------|
| **Revit** (Autodesk: *Audit / model corruption*) | Έλεγχος **στο άνοιγμα**· το corrupt element **απομονώνεται/διαγράφεται σε recovery file**· το μοντέλο ανοίγει. | Επικύρωση στο **σύνορο**, όχι στο hot loop· απομόνωση αντί ακύρωσης. |
| **Alexis King — «Parse, don't validate»** | Ο έλεγχος γίνεται **μία φορά στο σύνορο** και παράγει **πιο περιορισμένο τύπο**· δεν επαναλαμβάνεται σε κάθε αναγνώστη. | Η μορφή του `resolveDimDefPoints`: επιστρέφει διακριτό αποτέλεσμα, όχι boolean. |

**Πού πάμε πιο πέρα από τον Revit:** ο Revit **διαγράφει** το διεφθαρμένο στοιχείο. Εδώ η
πληροφορία **δεν έχει χαθεί** — τα @deprecated `startPoint`/`endPoint`/`textPosition` κουβαλούν την
ίδια γεωμετρία. Άρα **επισκευάζουμε** (`repaired-legacy`) αντί να χάνουμε: ο χρήστης βλέπει τη
διάστασή του με τα **πραγματικά** της όρια, αντί για συντηρητικό κουτί ή σιωπηλή εξαφάνιση.

---

## 3. Απόφαση — τρία στρώματα

### Στρώμα 1 (ρίζα): `systems/dimensions/dimension-def-points.ts` — ο ΕΝΑΣ αναγνώστης

```ts
type DimDefPointsSource = 'canonical' | 'repaired-legacy' | 'degenerate';
resolveDimDefPoints(dim): { points; source; dropped }   // ποτέ δεν πετάει
dimDefPoints(dim): readonly Point2D[]                   // συντομογραφία
```

- **canonical** — έγκυρος πίνακας· φιλτράρονται τα μη-πεπερασμένα σημεία.
- **repaired-legacy** — ανακατασκευή `[o1, o2, dimLineRef]` από τα κάτοπτρα Phase-A1. Το τρίτο
  σημείο έρχεται από `textMidpoint`/`textPosition` και είναι **γεωμετρικά έγκυρο**, όχι μπάλωμα:
  κατά **ISO-129** το κείμενο κάθεται πάνω στη γραμμή διάστασης.
- **degenerate** — τίποτα χρησιμοποιήσιμο. **Ένα μόνο άκρο μετράει ως degenerate**: παράγει
  εκφυλισμένο (μηδενικού εμβαδού) AABB → το culling το κόβει σχεδόν πάντα → **σιωπηλή εξαφάνιση**.
  Ημι-πληροφορία ⇒ καμία πληροφορία. *(Το έπιασε test, όχι review — η πρώτη υλοποίηση επέστρεφε το μονό σημείο.)*

**Φίλτρο μη-πεπερασμένων (ADR-510 Φ5):** ένα `NaN`/`Infinity` σημείο είναι **χειρότερο από crash** —
δεν πετάει, δηλητηριάζει το AABB (`Math.min/max` με NaN → NaN) και το culling απαντά **σιωπηλά λάθος**.
Χρησιμοποιείται το υπάρχον `isValidPointStrict` SSoT· δεν γράφτηκε δεύτερος έλεγχος.

**Τι ΔΕΝ κάνει:** δεν ξετυλίγει το `DxfDimension` wrapper — αυτό έχει ήδη αρχή (`unwrapDxfSubEntity`).

### Στρώμα 2: το «Never throws» γίνεται αληθινό

Το JSDoc του `getDimensionWorldBounds` **υποσχόταν ήδη** «Never throws … returns `null` only for a
dimension with no usable points» — και ο caller είχε γράψει `?? FULL_PLANE_BBOX`, δηλαδή **περίμενε
`null`, όχι εξαίρεση**. Η υπόσχεση επιβάλλεται πλέον στην πηγή, και **οι τοπικοί φύλακες των call
sites αφαιρέθηκαν** ώστε να μην ξαναποκλίνουν.

Διορθώθηκε και ο κοινός πυρήνας `dim-hit-geometry` (γρ. 65/93) — ήταν το **δεύτερο** σημείο στην
ίδια διαδρομή που θα έσκαγε (`undefined.length`), μοιραζόμενο από culling + hit-test + renderer.

### Στρώμα 3 (δίχτυ): `canvas-v2/dxf-canvas/dxf-bbox-quarantine.ts`

Το `getEntityBBox` έχει **8 καταναλωτές** (culling, `scale-preview-lod`, `dxf-selection-framing-bounds`,
`dxf-wireframe-hit-test`, `focus-2d-order` ×3, `DxfToThreeConverter`) — όλοι ήταν εκτεθειμένοι.
Ο φύλακας μπήκε **μέσα** στο `getEntityBBox` (εσωτερικό `computeEntityBBox` + εξαγόμενος wrapper):
ένας φύλακας ανά call site είναι ακριβώς το λάθος που παρήγαγε το αρχικό σφάλμα.

- **Fallback = «πάντα ορατό» (`FULL_PLANE_BBOX`), ποτέ κενό κουτί.** Το culling απαντά σε ΕΝΑ
  ερώτημα — «μπορώ να το παραλείψω με ασφάλεια;». Άγνωστα όρια ⇒ **όχι**. Κενό κουτί θα σήμαινε
  **σιωπηλή εξαφάνιση** — το σφάλμα της κλάσης ADR-362/ADR-568 («αόρατο στο 2D, ανάβει στο hover»).
- **Καραντίνα:** κάθε οντότητα αναφέρεται **ακριβώς μία φορά** (χωρίς αυτό: 60 log/δευτ.), με cap
  20 μοναδικών + μετρητή καταπνιγμένων.
- **Κόστος:** μηδενικό. Το TurboFan βελτιστοποιεί κανονικά `try` που δεν πετάει (εμπόδιο μόνο στο
  παλιό Crankshaft). Πληρώνεται μόνο στην αποτυχία, μία φορά.

---

### Στρώμα 1β — 🚀 ταυτότητα αναφοράς: **§8.1** (fast path, μηδέν αλλοκάτωση)

### Στρώμα 4 (πύλη) — **§8**: η μηχανική εγγύηση που χρειάστηκε μετά τη **δεύτερη** έκρηξη

---

## 4. Γιατί η απομόνωση ΔΕΝ μπήκε στο `DxfRenderer.drawInOrder`

Το «το draw μιας οντότητας πετάει» είναι **διαφορετική κλάση** και παραμένει **ανοιχτή**. Δεν
καλύφθηκε εδώ επειδή αγγίζει αρχεία υπό ADR-040 (CHECK 6B/6D) και θα διεύρυνε το εύρος χωρίς
απόδειξη ότι συμβαίνει. Το `getEntityBBox` καλείται για **κάθε** οντότητα πριν το draw, οπότε
καλύπτει ολόκληρη την κλάση «ο υπολογισμός ορίων πετάει» — που είναι αυτή που έσκασε.

---

## 5. Αρχεία

| Αρχείο | Αλλαγή |
|--------|--------|
| `systems/dimensions/dimension-def-points.ts` | **ΝΕΟ** — ο ΕΝΑΣ αναγνώστης + επισκευή Phase-A1 |
| `canvas-v2/dxf-canvas/dxf-bbox-quarantine.ts` | **ΝΕΟ** — απομόνωση + one-shot διάγνωση |
| `systems/dimensions/dimension-cull-bounds.ts` | SSoT· το «Never throws» γίνεται αληθινό |
| `systems/dimensions/dim-hit-geometry.ts` | SSoT (γρ. 65/93) — το 2ο σημείο που θα έσκαγε |
| `canvas-v2/dxf-canvas/dxf-viewport-culling.ts` | `unwrapDxfSubEntity` + fail-soft `getEntityBBox` |
| `rendering/hitTesting/bounds-primitives.ts` | ο τοπικός `?? []` → SSoT |
| `rendering/hitTesting/entity-bounds-ssot.ts` | ο τοπικός `?.defPoints ?` φύλακας **αφαιρέθηκε** |

**Σάρωση Β (2026-08-01, §8)** — οι υπόλοιποι **18** αναγνώστες + η πύλη:

| Αρχείο | Αλλαγή |
|--------|--------|
| `systems/dimensions/__tests__/defpoints-ssot-gate.test.ts` | **ΝΕΟ** — §8, η πύλη |
| `systems/dimensions/dimension-def-points.ts` | **fast path** — βλ. §8.1: στην κανονική διαδρομή επιστρέφει την **ΙΔΙΑ αναφορά**, μηδέν αλλοκάτωση |
| `systems/dimensions/builders/{angular,chained,linear-aligned,ordinate,radial}-builder.ts` | οι ~15 destructuring αναγνώστες του §7/2· **+ de-dup** στο `radial-builder`: δύο return blocks 14 γραμμών (`radius` / `joggedRadius`) διέφεραν **μόνο** στη φορά περιστροφής κειμένου ⇒ `singleArrowRadialGeometry`. Το έπιασε το CHECK 3.28 (jscpd, N.18) όταν οι δύο συναρτήσεις βρέθηκαν στο **ίδιο diff** |
| `systems/dimensions/{dim-association-service,dim-line-info,dim-snap-geometry,dim-space-engine}.ts` | SSoT |
| `systems/properties/dimension-property-model.ts` | SSoT |
| `utils/dxf-dimension-writer.ts` | 27 σημεία — τα `?? ORIGIN` φύλαγαν **λείπον στοιχείο**, όχι λείποντα πίνακα |
| `rendering/hitTesting/hit-test-annotations.ts` · `rendering/entities/dimension/dimension-renderer-support.ts` | SSoT |
| `canvas-v2/preview-canvas/preview-dimension-renderer.ts` | SSoT |
| `core/commands/entity-commands/DimReassociateCommand.ts` | SSoT |
| `hooks/dimensions/{useDimensionGrips,useDimGripGhostPreview}.ts` · `hooks/useDimensionModify.ts` | SSoT· το `diffDimEntity` **κανονικοποιεί** διάσταση Phase-A1 στην πορεία ενός grip drag |

## 6. Επαλήθευση

- `npm run test:dimension-resilience` → **51 tests / 3 suites** (SSoT + culling + πύλη §8) —
  ήταν 44 στη Σάρωση Α· +4 πύλη, +3 ταυτότητας αναφοράς (§8.1)
- Ευρύτερο regression: **731 tests / 54 suites** (`systems/dimensions` + `rendering/hitTesting` + `selection/shared`) — πράσινα
- `npm run jscpd:diff <19 αρχεία>` (N.18) → **καθαρό**. Η Σάρωση Β ανέδειξε **2 προϋπάρχοντα**
  δίδυμα (δεν τα δημιούργησε — τα **έφερε στο ίδιο diff**, οπότε το CHECK 3.28 τα είδε):
  · `DimReassociateCommand` `execute`/`undo` — το ίδιο preamble «φέρε τη διάσταση + τη συσχέτιση»
    (7 γρ.) → `resolveTarget()`·
  · `radial-builder` `radius`/`joggedRadius` — το ίδιο return block (14 γρ.), με **μοναδική
    διαφορά** τη φορά περιστροφής κειμένου (`outward` vs `jogTailDir`) → `singleArrowRadialGeometry()`.
  Διορθώθηκαν επί τόπου (Boy Scout, N.0.2), με τα 83 σχετικά tests πράσινα.
- ⚠️ Δεν εκτελέστηκε `tsc` — **N.17** (τον κάνει ο Giorgio + το pre-commit hook)

### 6.1 Το κόκκινο suite που ΔΕΝ είναι δικό μας (και πώς αποδείχθηκε)

Το πλήρες regression (**871 suites**) ανέδειξε **1 κόκκινο**: `guide-commands-ssot.test.ts`, με
`Cannot access 'BatchRotateGuidesCommand' before initialization` — **0 failing tests**, δηλαδή
αστοχία **σε επίπεδο module** (κύκλος εισαγωγών, αόρατος σε κάθε στοχευμένο τρέξιμο).

Ο κύκλος: `guide-command-base → guide-command-geometry → rotation-math → geometry-utils →
geometry-rendering-utils → types/entities → types/entity-bounds → entity-bounds-ssot →
GeometryUtils → entity-polylines → block-expander → … → guides/index → guides/commands/index →
guide-rotate-commands → guide-command-base`.

**Δύο ανεξάρτητες αποδείξεις ότι προϋπήρχε** (η υποψία ήταν εύλογη: το `entity-bounds-ssot` είναι
στη μέση της αλυσίδας **και** το αγγίξαμε):
1. **Στατική**: κάθε αρχείο του κύκλου έχει **ίδιο αριθμό imports** με το `15579c97` — καμία νέα
   ακμή. Η αλλαγή μας στο `entity-bounds-ssot` ήταν **μόνο στο σώμα** μιας συνάρτησης.
2. **Εκτελεστική**: `git worktree` στο `15579c97` (πριν από κάθε commit του ADR-746) → το suite
   **έσπαγε ήδη**, με πανομοιότυπο stack.

⚠️ **Το εύρημα που κρατάμε από αυτό**: ο αρχικός φύλακας πεπερασμένου ήταν το `isValidPointStrict`
(`entity-validation-utils`), που κάνει **runtime** import από το `types/entities` — μέσα στον
κύκλο. Δεν έσπασε τίποτα, αλλά με **~20 εισαγωγείς** ο αναγνώστης θα **μετέδιδε** εκείνη τη βαριά
ακμή σε όλο το δέντρο διαστάσεων. Πέρασε στο `config/geometry-constants.isFinitePoint` (**μόνο
type import**, ίδιο `Number.isFinite`), με τον object/null guard τοπικά ως `isFiniteDimPoint`.
**Ίδιος έλεγχος, μηδενικό runtime βάρος.**

**Regression anchor που έχει σημασία:** το test `«η διάσταση διορθώνεται στη ΡΙΖΑ — δεν φτάνει καν
στο δίχτυ»` απαιτεί `quarantinedCount() === 0` για διάσταση χωρίς `defPoints`. Αν γίνει κόκκινο, η
διόρθωση της ρίζας υποχώρησε και το πρόβλημα απλώς **κρύβεται** πίσω από το Στρώμα 3.

---

## 7. Ανοιχτά

1. **Ποιος γεννά διάσταση χωρίς `defPoints`;** Άγνωστο ακόμα. Και οι 12 builders γράφουν `defPoints`
   σωστά ⇒ η πηγή είναι **σύνορο δεδομένων**, όχι δημιουργίας. Το πεδίο `source` το κάνει ορατό:
   `repaired-legacy` σε log ⇒ **δεδομένα προ-ADR-362**· επίμονο `degenerate` ⇒ άλλη, άγνωστη πηγή.
   Ο κώδικας δεν μαντεύει — **επισκευάζει ό,τι μπορεί και αναφέρει τι βρήκε**.
2. ~~**Οι ~15 destructuring αναγνώστες στους builders**~~ → ✅ **ΕΚΛΕΙΣΕ στη Σάρωση Β** (§8).
   Το «Boy-Scout στο επόμενο άγγιγμα» **δεν έφτασε ποτέ**: το δεύτερο crash ήρθε σε λεπτά, όχι σε
   commits. Γι' αυτό η Σάρωση Β δεν σταμάτησε στους builders — μετέτρεψε **όλους** τους αναγνώστες
   και έβαλε πύλη ώστε να μη χρειάζεται τρίτη φορά.
3. **Per-entity isolation στο draw loop** — §4.

---

## 8. Η πύλη — γιατί η πειθαρχία δεν αρκούσε

Η πρώτη σάρωση διόρθωσε **τα δύο σημεία που έσκασαν** και άφησε τα υπόλοιπα ως «Boy-Scout αργότερα»
(§7/2). Το «αργότερα» ήρθε σε **λίγα λεπτά**, από άλλη διαδρομή:

| # | Σφάλμα | Διαδρομή | Πότε |
|---|--------|----------|------|
| 1 | `dim.defPoints is not iterable` | `dimension-cull-bounds` (bitmap cache) | Σάρωση Α |
| 2 | `Cannot read properties of undefined` | `dim-snap-geometry` (μηχανή έλξης) | **μετά** τη «διόρθωση» |

**Η αρχή:** μια συμφωνία που στηρίζεται σε **πειθαρχία** έχει ήδη σπάσει **τρεις** φορές
(ADR-716 Φ7 → ADR-736 → ADR-746). Ό,τι πρέπει να ισχύει σε **κάθε νέο αρχείο** πρέπει να είναι
**μηχανικά ελέγξιμο** — αλλιώς δεν είναι κανόνας, είναι ευχή.

- **Τι μπλοκάρει**: μόνο τις μορφές **ανάγνωσης που όντως πετούν** — `x.defPoints[i]`,
  `x.defPoints.length`, `[...x.defPoints]`, `for…of`, destructuring, `const pts = x.defPoints;`.
- **Τι επιτρέπει**: κάθε **γραφή** (`patch.defPoints = …`, `defPoints: geom.defPoints`). Η πρώτη
  εκδοχή («οτιδήποτε δεν είναι `defPoints:`») παρήγαγε **7 false positives** και θα είχε τη μοίρα
  κάθε θορυβώδους πύλης: αγνόηση, μετά αφαίρεση. Πήχης N.12: ≤10% false positives.
- **Allowlist — 4 εγγραφές, καθεμιά με λόγο** που δεν είναι «ξέρω ότι υπάρχει»: ο ίδιος ο SSoT·
  το `scale-dimension` (το `e.defPoints && {…}` παραλείπει **σκόπιμα** το κλειδί — με `dimDefPoints`
  θα έγραφε πάντα πίνακα, δηλαδή **αλλαγή σημασιολογίας** σε μετασχηματισμό)· το
  `run-cutline-dimension` (plan object του ίδιου tick, όχι σύνορο δεδομένων)· το
  `DimDefPointSnapEngine` (έχει ήδη ρητό `Array.isArray` guard).
- **Self-test**: η πύλη ελέγχει **τον εαυτό της** — ότι πιάνει και τις 6 επικίνδυνες μορφές και ότι
  δεν πιάνει τις 6 νόμιμες. Μια πύλη που δεν πιάνει τίποτα δεν είναι πύλη (ADR-587).

### 8.1 Ο fast path — γιατί ένας SSoT αναγνώστης δεν επιτρέπεται να αλλοκατώνει

Με ~40 καλούντες, ο αναγνώστης έγινε **hot path**. Χωρίς έλεγχο «είναι ήδη άρτιος;» επέστρεφε
**νέο πίνακα σε κάθε κλήση** — και δύο από τους καλούντες τιμωρούν ακριβώς αυτό:

| Καλών | Τι σπάει με νέα αναφορά |
|-------|-------------------------|
| viewport culling | ανά **οντότητα**, ανά **καρέ** (~3.000 × 60/δευτ.) ⇒ σκουπίδια GC στον βρόγχο σχεδίασης |
| `useDimensionGrips` (React memo deps) | νέα αναφορά = «άλλαξε» σε **κάθε** render |

Είναι η κλάση «selector `?? []` ⇒ νέος πίνακας ⇒ ατέρμονος βρόγχος» (ADR-040/366): θα
αντικαθιστούσαμε ένα **crash** με μια **σιωπηλή διαρροή επιδόσεων** — χειρότερη ανταλλαγή, γιατί η
δεύτερη δεν εμφανίζεται σε κανένα stack trace. Στην κανονική διαδρομή ο αναγνώστης επιστρέφει πλέον
την **ίδια αναφορά** που του δόθηκε, παρακάμπτοντας και το wrapper `{points, source, dropped}`:
**μηδέν αλλοκάτωση**, O(n) με n ≤ 5.

⚠️ **Το βρήκε test ταυτότητας αναφοράς, όχι review.** Η ορθότητα ήταν άψογη και με τον αργό δρόμο —
η ζημιά ήταν αμιγώς μη-λειτουργική. Αν αγγίξεις τον αναγνώστη, **κράτα τα anchors ταυτότητας
αναφοράς**: είναι το μόνο όργανο που βλέπει αυτή την κλάση.

**Ένα εύρημα που είναι θεραπεία**: στο `diffDimEntity` το `defPointsEq` έκανε ήδη `a.length` — ωμό
`prev.defPoints` θα έσκαγε το ίδιο. Περνώντας από τον SSoT, **ένα grip drag πάνω σε διάσταση
Phase-A1 κανονικοποιεί τα σημεία της στην πορεία** (ο patch γράφει πάντα πίνακα) αντί να διαιωνίζει
το κενό πεδίο.

## Changelog

- **2026-08-01 (β)** — **Σάρωση Β + πύλη §8.** Το §7/2 έκλεισε: **18 αρχεία** (5 builders, 4
  `systems/dimensions`, writer με 27 σημεία, 2 hit-test, preview, command, 3 hooks, property model)
  πέρασαν στον SSoT. Νέο anchor `defpoints-ssot-gate.test.ts` (**4 tests**, self-test +
  αιτιολογημένο allowlist 4 εγγραφών) στο `test:dimension-resilience`. Αφορμή: **δεύτερο** crash
  ίδιας κλάσης, άλλη διαδρομή, λεπτά μετά την «διόρθωση» της Σάρωσης Α.
- **2026-08-01** — Δημιουργία. Ρίζα του ζωντανού `dim.defPoints is not iterable`: 5 ασύμβατες
  πολιτικές ανάγνωσης, καμία αρχή. Τρία στρώματα (ΕΝΑΣ αναγνώστης + αληθινό «never throws» +
  απομόνωση). Επισκευή Phase-A1 αντί απώλειας. 44 anchors· 731 tests πράσινα· jscpd καθαρό.
