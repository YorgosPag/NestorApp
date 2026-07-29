# ADR-728 — Snap: broad phase, αναστολή κατά τη navigation, και ο προϋπολογισμός του καρέ

**Status:** Phase 0 (ΑΝΑΓΝΩΡΙΣΗ) — ΟΛΟΚΛΗΡΩΜΕΝΗ · **Φ0.1 ΥΛΟΠΟΙΗΜΕΝΗ (2026-07-29)** · Φ1–Φ5 ΕΚΚΡΕΜΟΥΝ
**Ημερομηνία:** 2026-07-29
**Σχετικά:** **ADR-726** (frame budget — αυτό το ADR **διορθώνει τη διάγνωσή του**, βλ. §2) ·
ADR-040 Φ11 (ο decoupled snap scheduler — η απόφαση που **μετακίνησε** το πρόβλημα) ·
ADR-597 / ADR-363 / ADR-378 / ADR-408 / ADR-580 / ADR-642 (οι engines) ·
CLAUDE.md N.0.2 / N.7.2 / N.12 / N.17 / N.18
**Κώδικας που γράφτηκε σε Phase 0:** **ΚΑΝΕΝΑΣ.**

> ⚠️ **Ο ένοχος άλλαξε.** Το ADR-726 §5 ονομάζει «ΚΥΡΙΑ ΥΠΟΨΙΑ» το bitmap cache (Φ3). Η πρώτη
> μέτρηση **ανά σύστημα** (2026-07-29) έδειξε ότι το bitmap cache είναι **2,3%** και το
> snap detection **97,4%**. Το §2 τεκμηριώνει γιατί η προηγούμενη διάγνωση ήταν εύλογη αλλά λάθος.

> 🔴🔴 **ΚΑΙ ΜΕΤΑ ΞΑΝΑΑΛΛΑΞΕ — ΔΙΑΒΑΣΕ ΤΟ §2.2 ΠΡΙΝ ΑΠΟ ΟΤΙΔΗΠΟΤΕ ΑΛΛΟ.**
> Η **δεύτερη** μέτρηση, στο **ίδιο dev build** αλλά με **χειρονομία που περιείχε pan**, έδωσε
> **ακριβώς το αντίστροφο**: `frame:dxf-canvas` **83,2%** (avg **14,6ms**) και
> `frame:snap-detection` **14,8%** (avg **2,11ms**). Και το per-engine attribution της Φ0.1
> **αναίρεσε τη μηχανική αιτία του §3.2**: οι πέντε ακριβότερες engines **έχουν ήδη spatial index**·
> οι index-less που κατηγορήθηκαν είναι **αμελητέες** (`snap:intersection` = **1,9ms σε 26΄΄**).
> ⇒ **Η Φ2 (broad phase) ΔΕΝ είναι πλέον τεκμηριωμένη ως θεραπεία.** Βλ. §2.2 και §5.
> ⇒ **Καμία μέτρηση δεν έχει γίνει ακόμη σε production build.** Ό,τι ακολουθεί είναι dev.

---

## 1. Το εύρημα, με τρεις ανεξάρτητους μάρτυρες

Η αξία δεν είναι στο μέγεθος του ποσοστού· είναι στο ότι **τρεις πηγές που δεν εξαρτώνται μεταξύ
τους** λένε το ίδιο. Το ADR-726 ξόδεψε τέσσερις λανθασμένες διαγνώσεις επειδή κάθε φορά στηριζόταν
σε **ένα** όργανο.

| # | Μάρτυρας | Τι είπε |
|---|---|---|
| 1 | **Το δικό μας όργανο** (`__dxfPerf.distribution()`, ADR-726 Φ1/Α0) | `frame:snap-detection` = **6.121,9 από 6.282,2 ms** του `frame:TOTAL` = **97,4%** |
| 2 | **Ο ίδιος ο Chrome** (`[Violation]`, δεν τον γράψαμε εμείς) | `UnifiedFrameScheduler.ts:186 — 'requestAnimationFrame' handler took **67ms / 52ms / 51ms**` |
| 3 | **Ο κώδικας** (§3) | 17 από τις 26 engines σαρώνουν **και τις 2.910** οντότητες, ανά κίνηση |

### 1.1 Η κατανομή — γιατί είναι **σπασμωδικό** και όχι «αργό»

| stage | count | avg | max | total | % του `TOTAL` |
|---|---|---|---|---|---|
| `frame:TOTAL` | 411 | 15,3 | 203,5 | 6.282,2 | 100% |
| **`frame:snap-detection`** | **122** | **50,2** | **203,0** | **6.121,9** | 🔴 **97,4%** |
| `frame:dxf-canvas` | 51 | 2,8 | 39,3 | 143,2 | 2,3% |

`122 / 411` = το snap τρέχει σε **30% των καρέ** — αλλά όταν τρέχει κοστίζει **50ms**, με ουρά ως
**203ms**. Δηλαδή **ένα στα τρία καρέ πετάει 50ms**. Ο μέσος όρος όλων των καρέ (15,3ms) θα έλεγε
«μια χαρά». Αυτή είναι ακριβώς η αίσθηση που ο χρήστης περιγράφει ως «σπασμωδικό» και που το
median κρύβει — ο κανόνας του ADR-726 §4, τώρα σε δεύτερη εφαρμογή.

### 1.2 Εγκυρότητα — τι κρατήθηκε και τι πετάχτηκε

| Έλεγχος | Αποτέλεσμα |
|---|---|
| Production build; | ❌ **ΟΧΙ** — dev (`Fast Refresh`, `turbopack-hot-reloader`, `react-dom-client.development.js`)· μία εκτέλεση περιείχε rebuild **12.176ms** |
| `visibilityState === 'visible'` | ✅ (αλλιώς η γέφυρα θα απέρριπτε τα δείγματα — κατέγραψε 411) |
| `document.hasFocus()` | ❌ **false** — το focus ήταν στην κονσόλα |

**ΠΕΤΑΧΤΗΚΕ ολόκληρη η γραμμή `frame:INTERVAL`** (`avg 60,4ms`, `p95 80,2ms`, **`max 12.719ms`**).
Το 12,7 **δευτερόλεπτα** δεν είναι καρέ — είναι κενό throttling από **occluded window**, το ακριβές
σενάριο Windows που προειδοποιεί το ADR-726 §1.2.

> 🔴 **Κενό στο όργανο, τεκμηριωμένο εδώ:** ο μηχανισμός `forgetPreviousFrame()`
> (`frame-scheduler-perf-bridge.ts:101`) φρουρεί **μόνο** το `visibilityState`, **όχι** το
> `hasFocus()`. Το ADR-726 §13.5 είχε δηλώσει αυτή την ασυμμετρία ως ανοιχτό σημείο #3· εδώ
> **πληρώθηκε** για πρώτη φορά. Βλ. §7.1.

**ΚΡΑΤΗΘΗΚΑΝ οι γραμμές per-stage.** Είναι **διάρκειες εκτέλεσης**, όχι διαστήματα: το throttling
του browser δεν αλλάζει πόσο κάνει μια συνάρτηση **όταν** τρέχει. Έγκυρες ως **σχετική κατάταξη**
(οι απόλυτες τιμές είναι dev-φουσκωμένες με άγνωστο συντελεστή — ADR-726 §4.2).

---

## 2. Γιατί το ADR-726 έδειξε λάθος ένοχο — και γιατί ήταν εύλογο

Το ADR-726 §4.Β μέτρησε ότι το bitmap cache **ξαναχτίζεται σε 131 από 137 καρέ** (hit rate 4%) και
συμπέρανε ότι είναι ο κύριος ένοχος του pan/zoom. Το **counts** ήταν σωστό. Το **συμπέρασμα** όχι.

| | |
|---|---|
| Τι μετρήθηκε τότε | **Πόσο συχνά** ξαναχτίζεται (counts) |
| Τι υποτέθηκε | Ότι το «συχνά» συνεπάγεται «ακριβά» |
| Τι μετρήθηκε τώρα | **Πόσο κοστίζει**: `avg 2,8ms`, `total 143,2ms` = **2,3%** |

Ο **ίδιος ο κανόνας §2.1 του ADR-726** το προέβλεπε: *«τα per-canvas counts είναι έγκυρα· τα
per-canvas **ms** από τέτοιο wrapper απαγορεύεται να αναφερθούν ως κόστος»*. Το βήμα από «131
rebuilds» σε «άρα ο rebuild είναι ο ένοχος» είναι **ακριβώς** το απαγορευμένο βήμα, σε άλλη μορφή.

> **Ο ένατος κανόνας αυτής της σειράς:** **η συχνότητα δεν είναι κόστος.** Ένα cache με hit rate
> 4% που κοστίζει 2,8ms ανά αστοχία είναι **υγιές**. Ένα σύστημα που τρέχει στο 30% των καρέ και
> κοστίζει 50ms είναι **η κατάρρευση**.

**Συνέπεια:** η **Φ3 του ADR-726 υποβιβάζεται** από «ΚΥΡΙΑ ΥΠΟΨΙΑ» σε «μελλοντική βελτιστοποίηση
του 2,3%». Δεν ακυρώνεται — απλά δεν είναι εδώ η δουλειά. Το ADR-726 ενημερώνεται αναλόγως.

### 2.2 🔴 …και μετά **αυτό** το ADR έπεσε στο ίδιο λάθος. Δεύτερη μέτρηση, αντίστροφη εικόνα.

Η **δεύτερη** μέτρηση έγινε στο **ίδιο dev build**, με το όργανο της Φ0.1 ενεργό, και με χειρονομία
που περιείχε **πραγματικό pan** (`pan-pending` count **184**· στην πρώτη η γραμμή **δεν υπήρχε
καθόλου**).

| stage | 1η μέτρηση (χωρίς pan) | **2η μέτρηση (με pan)** |
|---|---|---|
| `frame:dxf-canvas` | 2,8ms · **2,3%** | **14,6ms · 83,2%** |
| `frame:snap-detection` | 50,2ms · **97,4%** | **2,11ms · 14,8%** |

**Καμία από τις δύο δεν είναι λάθος.** Είναι **δύο διαφορετικές χειρονομίες**:

> **Σε pan/zoom ο χρόνος πάει στο bitmap cache. Σε απλή κίνηση δείκτη πάει στο snap.**
> Το ADR-726 Φ3 είχε δίκιο **για το σενάριο που παραπονιέται ο χρήστης** (pan/zoom).
> Το §1 αυτού του ADR είχε δίκιο για **άλλο** σενάριο και το γενίκευσε.

**Ο δέκατος κανόνας: ένα προφίλ χωρίς δηλωμένη χειρονομία δεν είναι προφίλ.** Ο πίνακας του §1
δεν κατέγραφε *τι έκανε το χέρι*. Η ίδια παράλειψη με το `visibilityState` (§1.2 του ADR-726): μια
συνθήκη που δεν καταγράφεται ανά δείγμα, **θα** παραχθεί λάθος συμπέρασμα.

#### Και η **μηχανική αιτία** του §3.2 αναιρέθηκε

Το Φ0.1 έδωσε το per-engine attribution — και δεν έδειξε αυτό που προέβλεψε το §3.2:

| engine | total (26΄΄) | avg | max | index; |
|---|---|---|---|---|
| `snap:bim_corner` | 94,4 | 0,79 | **33,4** | ✅ |
| `snap:endpoint` | 62,3 | 0,52 | 3,2 | ✅ |
| `snap:midpoint` | 59,3 | 0,50 | 3,7 | ✅ |
| `snap:bim_center` | 51,0 | 0,43 | **30,7** | ✅ |
| `snap:bim_midpoint` | 47,4 | 0,40 | 2,9 | ✅ |
| **`snap:intersection`** | **1,9** | 0,016 | 0,1 | ❌ |
| `snap:complex_*` | ~2,0 | — | — | ✅ |

🔴 **Οι πέντε ακριβότερες έχουν ΗΔΗ spatial index. Οι index-less είναι αμελητέες.** Η πρόβλεψη του
§3.2 («οι 17 χωρίς index σαρώνουν 2.910 ⇒ 50ms») ήταν **λάθος**.

Παρατήρηση που κατευθύνει την επόμενη έρευνα: `avg 0,79` με **`max 33,4`** σε 119 κλήσεις σημαίνει
**μία** ακριβή εκτέλεση και 118 φθηνές — προφίλ **ανακατασκευής index**, όχι ερωτήματος. Χωρίς το
ένα δείγμα ο μέσος πέφτει στα ~0,5ms. **Υπόθεση, αμέτρητη.**

**Τι επιβιώνει από το §3:** το `snap:ENTITIES` μετρήθηκε **2910, σταθερά, σε κάθε αναζήτηση** — το
διπλότυπο του §3.3 **υπάρχει** και είναι πραγματικό. Απλά **δεν είναι ο ένοχος του lag**. Η Φ2
υποβιβάζεται από «θεραπεία» σε «καθαρότητα SSoT με αβέβαιο κέρδος» μέχρι να υπάρξει μέτρηση που τη
δικαιολογεί.

**Τι δεν ξέρουμε ακόμη:** και οι δύο μετρήσεις είναι **dev**. Δεν έχει γίνει **καμία** μέτρηση σε
production build (ADR-726 Φ5). Υποψήφιες μεταβλητές που **δεν** απομονώθηκαν: pan έναντι zoom,
επίπεδο μεγέθυνσης (σε πλήρες zoom-out το `worldRadiusAt` μεγαλώνει ⇒ το ίδιο ερώτημα index
επιστρέφει **πολύ περισσότερα** σημεία), και θέρμανση του JIT (η 1η μέτρηση έτρεξε αμέσως μετά από
`Fast Refresh` **12.176ms**).

### 2.1 Και το ίδιο το `snap-scheduler.ts` δήλωνε λάθος αριθμό

Η κεφαλίδα του (γρ. 4) γράφει:

> *«`findSnapPoint` is **1-5ms** of synchronous main-thread work»*

**Μετρήθηκε 50,2ms — δεκαπλάσιο.** Ο αριθμός γράφτηκε στο ADR-040 Φ11 και **δεν ξαναμετρήθηκε
ποτέ**, ενώ στο μεταξύ προστέθηκαν engines (ADR-597 BIM ×3, ADR-378 TEXT, ADR-408 MEP, ADR-580
grips, ADR-642 complex ×3) και το σχέδιο μεγάλωσε. Ίδιο μοτίβο με το «91 unprotected» του N.12 και
το «0 violations» του N.11: **ένας αριθμός σε σχόλιο είναι ισχυρισμός με ημερομηνία λήξης.**

---

## 3. Η αιτία, στον κώδικα — **δεν υπάρχει broad phase**

### 3.1 Ο orchestrator παραδίδει τα πάντα σε όλους

`snapping/orchestrator/SnapContextManager.ts:29-41`:

```ts
createEngineContext(cursorPoint, entities, excludeEntityId): SnapEngineContext {
  return {
    entities,                                   // ← ΟΛΟΚΛΗΡΟΣ ο πίνακας: 2.910 οντότητες
    worldRadiusAt: (point) => this.worldRadiusAt(point),   // ← το aperture ως ΣΥΝΑΡΤΗΣΗ:
    worldRadiusForType: (point, t) => …,                   //   «φιλτράρισε μόνη σου»
    perModePxTolerance: …,
    excludeEntityId,
    maxCandidates: 8,
  };
}
```

`snapping/orchestrator/SnapOrchestrator.ts:143-151` το περνά **αυτούσιο** σε κάθε enabled engine:

```ts
for (const snapType of settings.priority) {
  if (!settings.enabledTypes.has(snapType)) continue;
  const engine = this.registry.getEngine(snapType);
  const result = engine.findSnapCandidates(cursorPoint, context);   // ← ίδιο context, 2.910 οντότητες
  …
}
```

**Το aperture δεν είναι φίλτρο — είναι σύσταση.** Κάθε engine είναι υπεύθυνη να το εφαρμόσει μόνη
της, και το `SnapEngineContext` (`shared/BaseSnapEngine.ts:15-22`) δεν έχει κανέναν τρόπο να το
επιβάλει.

### 3.2 Και οι μισές δεν την ακολουθούν

Επαληθευμένο με ανάγνωση, `snapping/engines/`:

```ts
for (const entity of context.entities) { … }   // NearestSnapEngine.ts:57
for (const entity of context.entities) { … }   // PerpendicularSnapEngine.ts:66  (+ εμφωλευμένος βρόχος vertices, γρ. 127)
for (const entity of context.entities) { … }   // WallFaceSnapEngine.ts:72
```

**Απογραφή (grep-verified, 2026-07-29):**

| | engines |
|---|---|
| ✅ **Με** spatial index (9) | `BimCharacteristic` · `Center` · `ComplexLinetype` · `DimDefPoint` · `DimLine` · `Endpoint` · `MepConnector` · `Midpoint` · `Node` |
| ❌ **Χωρίς** spatial index (17) | `ConstructionPoint` · `Extension` · `Grid` · `Guide` · `Insertion` · **`Intersection`** · `Nearest` · `Near` · `OrthoTrack` · `Parallel` · **`Perpendicular`** · `Quadrant` · `RotationPoint` · `SelectedGrip` · `Tangent` · **`Text`** · **`WallFace`** |

Οι 17 **δεν είναι όλες επικίνδυνες**: `Grid` είναι αναλυτική (μηδέν οντότητες), `Guide` /
`ConstructionPoint` / `RotationPoint` / `SelectedGrip` διαβάζουν δικά τους μικρά stores. **Οι
επικίνδυνες είναι όσες σαρώνουν `context.entities`** — και τρεις από αυτές είναι **ενεργές από
προεπιλογή**: `INTERSECTION`, `BIM_WALL_FACE`, `TEXT` (`extended-types.ts:193-215`, **22 ενεργοί
τύποι**).

> ⚠️ **Το ακριβές per-engine attribution ΔΕΝ έχει μετρηθεί** (§5, Φ0.1). Το ότι το snap συνολικά
> είναι 97,4% είναι μετρημένο· το **ποια** engine το τρώει είναι **συμπερασμένο από τον κώδικα**.
> Το ADR-726 έπεσε τέσσερις φορές ακριβώς σε αυτό το κενό. **Δεν διορθώνουμε πριν μετρήσουμε.**

### 3.3 Το διπλότυπο (N.0.2)

Η ερώτηση «**ποιες οντότητες είναι κοντά στον κέρσορα;**» απαντιέται **26 φορές ανά κίνηση** — 9
φορές με ιδιωτικό spatial index, 17 φορές με ωμή σάρωση. Είναι **μία** ερώτηση με **μία** σωστή
απάντηση, και πρέπει να απαντιέται **μία φορά, πριν από όλες**.

Είναι το ίδιο σχήμα με το ιστορικό περιστατικό `if (options.grips) renderGrips()` σε 7 renderers —
με τη διαφορά ότι εδώ το διπλότυπο **δεν είναι απλώς άσχημο, είναι ο ένοχος του lag**.

### 3.4 🟢 Και η υποδομή **υπάρχει ήδη** — απλά στο λάθος επίπεδο

```
src/subapps/dxf-viewer/core/spatial/
  ISpatialIndex.ts · BaseSpatialIndex.ts · GridSpatialIndex.ts
  QuadTreeSpatialIndex.ts · PointHashGrid.ts · SpatialIndexFactory.ts · SpatialUtils.ts
```

Πλήρες, δοκιμασμένο SSoT χωρικού ευρετηρίου, με factory (`SpatialFactory.forSnapping(bounds)`) και
ενσωματωμένο helper στη βάση (`BaseSnapEngine.initializeSpatialIndex`, γρ. 144).

**Χρησιμοποιείται από 9 engines με ιδιωτικό αντίγραφο η καθεμία, και καθόλου στο επίπεδο του
orchestrator — όπου ανήκει.**

⇒ Η θεραπεία **δεν χτίζει νέο σύστημα**. Παίρνει τον **υπάρχοντα** SSoT και τον τοποθετεί **μία
φορά, στο σωστό επίπεδο**, αντί για εννιά φορές στο λάθος. Αυτό είναι κυριολεκτικά ο ορισμός των
N.0.2 / N.12.

### 3.5 Το snap τρέχει **και ενώ κάνεις pan**

`systems/cursor/mouse-handler-move.ts:286`:

```ts
if (snapEnabled && findSnapPoint && !isGripDragging) {
  requestSnapDetection({ worldPos, activeTool, findSnapPoint, setSnapResults });
}
```

Ο guard `!refs.panStateRef.current.isPanning` **υπάρχει** — αλλά μόνο στο **hover** (γρ. 301).
Στο snap **λείπει**. Κατά το pan υπολογίζουμε σημεία έλξης που κανείς δεν πρόκειται να
χρησιμοποιήσει, μπροστά ακριβώς από τη ζωγραφική που ο χρήστης περιμένει.

### 3.6 Η Φ11 του ADR-040 **μετακίνησε** το πρόβλημα, δεν το έλυσε

Η Φ11 έβγαλε το `findSnapPoint` από τον `mousemove` handler και το έβαλε σε rAF slot του
`UnifiedFrameScheduler` — σωστή κίνηση για τον **σταυρόνημα** (που πράγματι έγινε 1:1). Αλλά η
δουλειά έμεινε **στο ίδιο νήμα, στο ίδιο καρέ, και τώρα κάθεται μπροστά από τη ζωγραφική**.

Το `registerRenderCallback('snap-detection', …, RENDER_PRIORITIES.NORMAL, …)`
(`snap-scheduler.ts:176`) την βάζει στην **ίδια** ουρά με τον `dxf-canvas`. Ο
`UnifiedFrameScheduler.processFrame` τα τρέχει **σειριακά** (γρ. 246-268). Άρα 50ms snap ⇒ 50ms
καθυστέρηση στην εικόνα.

> **Μάθημα:** «decoupled» σημαίνει «σε άλλο **νήμα** ή άλλο **budget**». Το «σε άλλο **slot** του
> ίδιου συγχρονισμένου βρόχου» δεν είναι decoupling — είναι αναδιάταξη.

---

## 4. Τι κάνουν οι μεγάλοι (έρευνα 2026-07-29, πριν τον σχεδιασμό)

### 4.1 AutoCAD — το APERTURE **είναι** broad phase

> *«Object snap applies only to objects **inside or crossing the object snap target box**.»*
> *«Depending on the complexity of your drawing, you can increase or decrease the area that is
> influenced by object snaps.»*

Ένα κουτί ~10-12 pixel γύρω από τον σταυρόνημα, και η γεωμετρία τρέχει **μόνο** σε ό,τι το τέμνει.
Το φίλτρο είναι **ένα** και **πρώτο** — δεν επαναλαμβάνεται ανά snap mode. Το APERTURE είναι
ρυθμιζόμενο **ακριβώς επειδή** είναι ο μοχλός απόδοσης σε πυκνά σχέδια.

### 4.2 Physics / game engines — broad phase → narrow phase

> *«The broad phase efficiently generates a candidate list … while excluding object pairs that
> cannot possibly collide. The broad phase is responsible for **eliminating the bulk of the
> work**, using relatively fast algorithms.»*
> *«Narrow phase … is typically computationally intense, and thus **cannot be performed on every
> pair** in the time between frames.»*

Το σχήμα είναι σαράντα ετών και καθολικό. **Ο δικός μας snap έχει μόνο narrow phase** — τρέχει την
ακριβή γεωμετρία σε κάθε ζεύγος (κέρσορας × οντότητα), 26 φορές.

### 4.3 Revit — αναστολή δουλειάς κατά τη navigation

> *«To optimize view navigation, Revit **suspends** certain graphic effects (such as fill patterns
> and ambient shadows) … during camera manipulation (**pan, orbit, and zoom**).»*

Η αρχή: **δουλειά που δεν φαίνεται κατά τη χειρονομία, δεν γίνεται.** Το §3.5 είναι η παράβαση
αυτής της αρχής.

### 4.4 Chrome — `scheduler.yield()`

Stable από **Chrome 129 (Σεπτ. 2024)**, υποστηρίζεται από όλους τους μεγάλους browsers εκτός
Safari. Επιτρέπει σε μια εργασία να **παραχωρήσει** το νήμα ώστε ο browser να εξυπηρετήσει input
υψηλότερης προτεραιότητας, και μετά να **συνεχίσει από εκεί που έμεινε** — χωρίς να πάει στο τέλος
της ουράς όπως το `setTimeout(0)`.

⚠️ Το `isInputPending()` **δεν** προτείνεται πλέον από τη Google (*«can return false negatives and
does not account for other performance-critical work like animations and rendering updates»*).
Απορρίπτεται ρητά ως επιλογή εδώ.

### 4.5 Τι **δεν** εφαρμόζεται

- **WebWorker για το snap.** Το `findSnapPoint` διαβάζει ζωντανά stores (`AllGripsStore`,
  `GuideStore`, `columnToolBridgeStore`, `ImmediateSnapStore`) και επιστρέφει σύγχρονα στον ghost
  του ίδιου καρέ. Η μεταφορά θα απαιτούσε αντιγραφή/συγχρονισμό ολόκληρης της σκηνής ανά μεταβολή
  — μεταφέρει τον χρόνο, δεν τον εξαλείφει, και προσθέτει sync κόστος. **Επανεξέταση μόνο αν** τα
  Φ1-Φ3 δεν φτάσουν τα κριτήρια του §6.
- **WebGL/GPU.** Μηχάνημα-στόχος χωρίς GPU (ADR-726 §7.1). Απαγορευμένο ρητά.

---

## 5. Η αρχιτεκτονική — τέσσερα επίπεδα

Σειρά κατά **απόδοση ανά ρίσκο**. Κάθε φάση είναι **ανεξάρτητα αναστρέψιμη** και **ανεξάρτητα
μετρήσιμη** — καμία δεν προϋποθέτει την επόμενη.

### Φ0.1 — 🔴 ΠΡΩΤΑ: attribution **ανά engine** (μηδέν διόρθωση) ✅ **ΕΓΙΝΕ 2026-07-29**

**Δεν διορθώνουμε πριν μάθουμε ποια engine.** Το `snap-detection` είναι σήμερα **μία γραμμή** στο
`console.table`· χρειάζεται να γίνει **26**.

Το εργαλείο **υπάρχει ήδη**: `withPerf(stage, fn)` (`systems/cursor/mouse-handler-perf.ts`), το ίδιο
που ήδη τυλίγει τα `hit-test-entity`, `world-coord-calc` κ.λπ. **Μηδέν νέο σύστημα** — ένα
`withPerf(\`snap:${snapType}\`, () => engine.findSnapCandidates(...))` στον βρόχο του
`SnapOrchestrator` (γρ. 151), πίσω από το **υπάρχον** flag `dxf-perf-trace`.

⚠️ Το κόστος του ίδιου του probe αλλοιώνει τη μέτρηση (ADR-726 §2.2): **26 ζεύγη
`performance.now()` ανά κλήση**. Έγκυρη είναι μόνο η **σχετική κατάταξη** μεταξύ engines — αρκετό
για να απαντήσει «ποια».

**Παραδοτέο:** πίνακας `snap:<TYPE>` ταξινομημένος κατά `total`. Χωρίς αυτόν, τα Φ1-Φ3 είναι εικασία.

#### Τι υλοποιήθηκε (2026-07-29)

**Ένα αρχείο** — `snapping/orchestrator/SnapOrchestrator.ts`. Δύο εξαγόμενες σταθερές
(`SNAP_ENGINE_STAGE_PREFIX = 'snap:'`, `SNAP_ENTITY_COUNT_STAGE`), ίδιο ιδίωμα με το
`FRAME_STAGE_PREFIX` της γέφυρας της Φ1 του ADR-726. **Μηδέν νέο σύστημα μετρήσεων, μηδέν νέο
global, μηδέν νέα εξάρτηση** — ο **υπάρχων** `withPerf` / `recordSample`, το **υπάρχον** flag
`dxf-perf-trace`, ο **υπάρχων** aggregator.

**Δεύτερη γραμμή, όχι χρόνος:** το `snap:ENTITIES` καταγράφει **πόσες οντότητες παραδίδονται** ανά
αναζήτηση. Σήμερα = ολόκληρη η σκηνή (§3.1). Είναι το ίδιο μέγεθος που η Φ2 υποχρεούται να ρίξει
σε ~5-20 ⇒ **η ίδια γραμμή τεκμηριώνει το πρόβλημα και θα αποδείξει τη θεραπεία**, χωρίς δεύτερο
όργανο.

**Boy-scout (N.7.1) — δεν ήταν προαιρετικό:** το `findSnapPoint` ήταν **83 γραμμές** (όριο 40).
Εξήχθησαν `collectCandidates()` (ο βρόχος των engines) και `hasEnoughCandidates()` (το ζεύγος
sub-pixel early-exit + `maxCandidates`). Αποτέλεσμα **21 / 35 / 13** γραμμές κώδικα, αρχείο 314
(όριο 500). Ο `collectCandidates` είναι **ακριβώς** το σημείο όπου θα μπει το broad phase της Φ2 —
το μόνο σημείο που βλέπει ταυτόχρονα κέρσορα, engines και ανοχές.

**Δοκιμές: 9 νέες** (`orchestrator/__tests__/SnapOrchestrator.collect-candidates.test.ts`). Ο
φάκελος **δεν υπήρχε**: ο orchestrator του snap ήταν **ατεστάριστος**. Ο `SnapCandidateProcessor`
και ο `SnapContextManager` μένουν **πραγματικοί** στο test — μόνο το registry είναι mocked, ώστε η
διαδρομή επιλογής νικητή να ελέγχεται αληθινά και όχι σε διπλότυπό της.

**Mutation-verified (2/2) — τα πράσινα δεν αρκούσαν:**

| Μετάλλαξη | Αποτέλεσμα |
|---|---|
| `earlyReturn` αγνοείται μετά το `collectCandidates` | ✅ **1 κόκκινο**, ακριβώς το σωστό test |
| `recordSample(ENTITIES)` μετακινήθηκε **μετά** το early-return | ✅ **1 κόκκινο**, ακριβώς το σωστό test |

⚠️ **Τίμια οριοθέτηση:** επαληθεύτηκαν οι **δύο διαδρομές που όντως άλλαξαν**. Τα υπόλοιπα 7 tests
(`maxCandidates`, `enabledTypes`, null-guard, disabled) καρφώνουν κώδικα που **μεταφέρθηκε
αυτούσιος** — είναι άγκυρες παλινδρόμησης **για τη Φ2**, όχι απόδειξη της τωρινής αλλαγής.

**Παλινδρόμηση:** `snapping/` **25 suites / 258 tests** πράσινα. `jscpd:diff` **μηδέν clones**.
**Μηδέν αλλαγή συμπεριφοράς** — με κλειστό flag το `withPerf` καλεί τη συνάρτηση ασύλητη.

**Πώς διαβάζεται:** `localStorage.setItem('dxf-perf-trace','1')` → `__dxfPerfRefresh()` →
`__dxfPerf.reset()` → ανθρώπινο pan/zoom → `__dxfPerf.distribution()`. Οι γραμμές `snap:*`
απαντούν «ποια engine», η `snap:ENTITIES` απαντά «πόσο μεγάλο είναι το πρόβλημα».

### Φ1 — Αναστολή κατά τη navigation (Revit parity)

Το snap **δεν τρέχει** όσο διαρκεί χειρονομία navigation. Δύο πύλες, όχι μία:

| Χειρονομία | Πύλη |
|---|---|
| **pan drag** | `panStateRef.current.isPanning` — ο **υπάρχων** guard του hover (γρ. 301), εφαρμοσμένος και στο snap |
| **wheel burst** | Παράθυρο σιωπής μετά το τελευταίο wheel event, με λήξη στο idle |

⚠️ **Δεν αρκεί ο `isPanning`**: το wheel-zoom δεν περνά από `panState`. Δύο ανεξάρτητες διαδρομές
navigation ⇒ **μία** έννοια «είμαι σε χειρονομία πλοήγησης», σε **ένα** μέρος.

> **SSoT:** η έννοια δεν υπάρχει σήμερα πουθενά. Δεν προστίθεται `if (isPanning)` σε N σημεία —
> δημιουργείται **ένας** αναγνώστης κατάστασης πλοήγησης (`NavigationGestureStore`, ίδιο ιδίωμα με
> `ImmediateTransformStore` / `HoverStore`: module singleton, μηδέν React). Καταναλωτής **ένας**
> σήμερα (ο snap scheduler)· η ύπαρξή του είναι που εμποδίζει τον δεύτερο να γράψει το δικό του.

**Ρίσκο:** χαμηλό. **Δεν αλλάζει καμία γεωμετρία** — αλλάζει **πότε** τρέχει.
**Συμπεριφορά χρήστη:** ο δείκτης OSNAP σβήνει όσο σέρνεις — **ταυτόσημο με AutoCAD/Revit**.

### Φ2 — ΕΝΑ broad phase, στον orchestrator (AutoCAD APERTURE parity) — **η θεραπεία**

Το `SnapEngineContext` παύει να παραδίδει `entities: EntityModel[]` (2.910) και παραδίδει
**`candidates`** — μόνο ό,τι τέμνει το aperture box, υπολογισμένο **μία φορά** με τον υπάρχοντα
`ISpatialIndex` (§3.4).

```
                 ΣΗΜΕΡΑ                                    ΜΕΤΑ ΤΗ Φ2
   cursor ──┬─→ engine 1  ── σαρώνει 2.910          cursor ─→ [broad phase]  ── ΜΙΑ φορά
            ├─→ engine 2  ── σαρώνει 2.910                        │  ~5-20 υποψήφιοι
            ├─→ …                                                 ├─→ engine 1  ── 20
            └─→ engine 26 ── σαρώνει 2.910                        ├─→ …
                                                                  └─→ engine 26 ── 20
```

**Κρίσιμη ιδιότητα σχεδιασμού: καμία από τις 26 engines δεν αλλάζει γραμμή.** Λαμβάνουν τον ίδιο
τύπο, την ίδια σημασιολογία — απλά ο πίνακας είναι μικρότερος. Οι 9 με ιδιωτικό index συνεχίζουν
να δουλεύουν (το index τους απλά γίνεται περιττό και αφαιρείται σε επόμενη φάση, **όχι εδώ**).

**Τρία σημεία που θα κρίνουν την ορθότητα:**

1. **Το aperture δεν είναι ένα.** Το `perModePxTolerance` (`extended-types.ts`) δίνει διαφορετική
   ανοχή ανά τύπο (5-8px). Το broad phase πρέπει να χρησιμοποιήσει το **μέγιστο** ενεργό — αλλιώς
   κόβει υποψηφίους που μια πιο ανεκτική engine θα δεχόταν. **Υπερ-εκτίμηση είναι ασφαλής·
   υπο-εκτίμηση αλλάζει συμπεριφορά.**
2. **Engines που ΔΕΝ διαβάζουν `entities`** (`Grid`, `Guide`, `ConstructionPoint`, `RotationPoint`,
   `SelectedGrip`) δεν επηρεάζονται. Το broad phase φιλτράρει **μόνο** το `entities` πεδίο.
3. **Engines με μη-τοπική γεωμετρία.** `Extension` / `Parallel` / `OrthoTrack` / `Tangent`
   δουλεύουν με **προεκτάσεις** — μια οντότητα εκτός aperture μπορεί να παράγει υποψήφιο **μέσα**
   σε αυτό. Αυτές **δεν** μπορούν να πάρουν το φιλτραρισμένο σύνολο χωρίς αλλαγή συμπεριφοράς.
   ⇒ Το `SnapEngineContext` κρατά **δύο** πεδία: `candidates` (φιλτραρισμένο, το κανονικό μονοπάτι)
   και `allEntities` (πλήρες, **μόνο** για τις μη-τοπικές). Ρητό, τεκμηριωμένο, και κάθε νέα engine
   που θα ζητήσει `allEntities` θα πρέπει να **αιτιολογήσει γιατί**.
   ⚠️ Καμία από τις 4 μη-τοπικές δεν είναι ενεργή by default (`extended-types.ts:193`).

**Ρίσκο:** μεσαίο. **Δικλείδα:** το broad phase μπορεί να γυρίσει σε pass-through (`candidates =
entities`) με μία σταθερά ⇒ ταυτόσημη συμπεριφορά με σήμερα, ως άγκυρα παλινδρόμησης στα tests.

### Φ3 — Προϋπολογισμός καρέ αντί για throttle χρόνου

`snap-scheduler.ts:167` — `if (now - lastRunMs < SNAP_DETECTION_THROTTLE) return;`

Throttle **χρόνου** (~30fps), **κανένα όριο κόστους**. Ένα σύστημα που κοστίζει 50ms και τρέχει
«κάθε 33ms» δεν τρέχει στα 30fps — **κορένει το νήμα**. Ο προϋπολογισμός πρέπει να μετράει τι
**κόστισε**, όχι πότε **έτρεξε**: αν η προηγούμενη εκτέλεση ξεπέρασε το budget, η επόμενη αραιώνει.

Με τη Φ2 πετυχημένη αυτό γίνεται δικλείδα ασφαλείας, όχι κύρια θεραπεία — **και γι' αυτό μένει**:
είναι ο μηχανισμός που εμποδίζει την επόμενη engine να ξαναφέρει το πρόβλημα σιωπηλά.

### Φ4 — `scheduler.yield()` (προαιρετικό, μόνο αν χρειαστεί)

Παραχώρηση νήματος μέσα στον βρόχο των engines όταν εκκρεμεί input. **Δεν μπαίνει** αν τα Φ1-Φ3
πιάσουν τα κριτήρια του §6 — δεν προσθέτουμε μηχανισμό που δεν χρειάζεται.
⚠️ Απαιτεί fallback για Safari.

### Φ5 — 🧠 Negative-space early-out (πέρα από την τρέχουσα πρακτική)

Το AutoCAD φιλτράρει με aperture σε **κάθε** κίνηση. Υπάρχει μια κλάση κινήσεων όπου **δεν
χρειάζεται καν το φιλτράρισμα**:

> Αν το προηγούμενο ερώτημα επέστρεψε «κανένα snap εντός ακτίνας *R*» και ο κέρσορας μετακινήθηκε
> κατά *d*, τότε για κάθε **d < R − aperture** η απάντηση παραμένει **αποδεδειγμένα** «κανένα» —
> από την **τριγωνική ανισότητα**, με μηδέν γεωμετρικό υπολογισμό.

Δεν είναι ευρετικό: είναι μετρικό φράγμα, **δεν μπορεί** να δώσει λάθος απάντηση. Απαιτεί το broad
phase να επιστρέφει και την **απόσταση του κοντινότερου απορριφθέντος** — φθηνό, ο index την
υπολογίζει ήδη.

Σε μια κάτοψη ο κέρσορας περνά πάνω από **κενό χώρο** στη συντριπτική πλειοψηφία των κινήσεων.
Το ίδιο σχήμα (sphere tracing) είναι τυπικό στα distance-field renderers· δεν εντοπίστηκε σε CAD
snap engine.

⚠️ **Μπαίνει ΜΟΝΟ αν η μέτρηση μετά τη Φ2 δείξει ότι αξίζει.** Δεν χτίζουμε πάνω σε εντύπωση —
είναι ακριβώς το λάθος που αυτό το ADR διορθώνει.

---

## 6. Κριτήρια αποδοχής

Κληρονομούνται από το ADR-726 §5 (**ορατό tab, υπό input, production build, p90 όχι median**) και
συμπληρώνονται με δύο ειδικά:

| Μετρικό | Στόχος | Κόκκινο |
|---|---|---|
| `frame:snap-detection` **avg** | ≤ **2ms** | > 8ms |
| `frame:snap-detection` **p99** | ≤ **8ms** | > 16,7ms |
| Μερίδιο του `frame:TOTAL` | ≤ **20%** | > 40% |
| p90 `frame:INTERVAL` υπό input | ≤ 16,7ms | > 33ms |
| Καρέ > 70ms | ≤ 1% | > 5% |
| **Συμπεριφορική ισοδυναμία** | **100%** — ίδια snap points, ίδιοι νικητές, ίδιες προτεραιότητες | οποιαδήποτε απόκλιση |

Το τελευταίο δεν είναι διακοσμητικό: το snap είναι **σημασιολογία**, όχι απόδοση. Ένα snap που
έγινε γρήγορο αλλά κουμπώνει αλλού είναι **παλινδρόμηση ορθότητας**. Η Φ2 απαιτεί χαρακτηρισμό της
**ζωντανής** συμπεριφοράς πριν την αλλαγή (μοτίβο ADR-587 capability anchors).

**Και ένα κριτήριο διαδικασίας:** κάθε φάση μετριέται **χωριστά**. Η σύγχρονη υλοποίηση δύο φάσεων
δεν επιτρέπει την απόδοση του κέρδους — ακριβώς το λάθος που έκανε το ADR-726 να αποδώσει το lag
στο bitmap cache.

---

## 7. Ό,τι πρέπει να διορθωθεί αλλού

### 7.1 Το όργανο πρέπει να φρουρεί και το `hasFocus()`

`frame-scheduler-perf-bridge.ts:111` ελέγχει `visibilityState`, όχι `hasFocus()`. Στα Windows ο
Chrome throttle-άρει **καλυμμένο** παράθυρο ενώ το `visibilityState` παραμένει `'visible'` — και
τότε το `frame:INTERVAL` καταγράφει κενά **12.719ms** ως «διάστημα καρέ», δηλητηριάζοντας
max/p99/avg. Το ADR-726 §1.2 **το είχε προβλέψει ρητά**· το §13.5 το δήλωσε ανοιχτό ως #3.

⇒ Ο κανόνας εγκυρότητας επεκτείνεται: **`visibilityState === 'visible' ΚΑΙ hasFocus()`**, αλλιώς
`forgetPreviousFrame()`. Ανήκει στο ADR-726 (είναι το όργανό του), αλλά καταγράφεται εδώ γιατί
**εδώ πληρώθηκε**.

### 7.2 Το ADR-726 §5 πρέπει να υποβιβάσει τη Φ3

Βλ. §2. Το bitmap cache είναι **2,3%**. Η Φ3 παύει να είναι «ΚΥΡΙΑ ΥΠΟΨΙΑ».

### 7.3 Ο αριθμός «1-5ms» πρέπει να φύγει από τη κεφαλίδα του `snap-scheduler.ts`

Είναι μετρημένα **50,2ms**. Ένας αριθμός σε σχόλιο χωρίς ημερομηνία και χωρίς όργανο είναι
παγίδα για τον επόμενο (§2.1).

---

## 8. Τι **δεν** θα γίνει

1. **Καμία αφαίρεση snap engine ή snap type.** Το πρόβλημα είναι **πώς** καλούνται, όχι το ότι
   υπάρχουν. Η λειτουργικότητα δεν μειώνεται.
2. **Καμία αλλαγή στη σημασιολογία προτεραιότητας** (`priority` array, `SnapCandidateProcessor`,
   ADR-580 grab-the-grip precedence, ADR-597 starvation fix). Η Φ2 αλλάζει **ποιες οντότητες**
   εξετάζονται, ποτέ **ποιος νικά**.
3. **Καμία νέα εξάρτηση** (N.5 δεν ενεργοποιείται) — ο spatial index υπάρχει.
4. **Κανένα WebWorker** χωρίς μέτρηση που να το δικαιολογεί (§4.5).
5. **Καμία υλοποίηση πριν το Φ0.1.** Το per-engine attribution είναι προϋπόθεση, όχι πολυτέλεια.
6. **Κανένα νούμερο από dev build, hidden/unfocused tab, ή σκέτο median** (ADR-726 §7).

---

## 9. Changelog

| Ημ/νία | Αλλαγή |
|---|---|
| 2026-07-29 (γ) | 🔴🔴 **ΤΟ ΟΡΓΑΝΟ ΤΗΣ Φ0.1 ΑΝΑΙΡΕΣΕ ΤΗ ΔΙΑΓΝΩΣΗ ΑΥΤΟΥ ΤΟΥ ΙΔΙΟΥ ΤΟΥ ADR** (νέα §2.2). Δεύτερη μέτρηση, **ίδιο dev build**, χειρονομία **με pan** (`pan-pending` **184**· στην πρώτη η γραμμή δεν υπήρχε **καθόλου**): `frame:dxf-canvas` **83,2%** (avg **14,6ms**) έναντι `frame:snap-detection` **14,8%** (avg **2,11ms**) — **ακριβώς αντίστροφα** από το §1. **Καμία από τις δύο δεν είναι λάθος: είναι δύο χειρονομίες.** Σε pan/zoom ο χρόνος πάει στο bitmap cache· σε απλή κίνηση δείκτη στο snap. Το ADR-726 Φ3 είχε δίκιο **για το σενάριο που παραπονιέται ο χρήστης**· το §1 είχε δίκιο για άλλο και **το γενίκευσε**. **Δέκατος κανόνας: ένα προφίλ χωρίς δηλωμένη χειρονομία δεν είναι προφίλ** — ίδια παράλειψη με το `visibilityState`, σε άλλη μεταβλητή. **Και η μηχανική αιτία του §3.2 αναιρέθηκε:** το per-engine attribution έδειξε ότι οι **πέντε ακριβότερες engines έχουν ΗΔΗ spatial index** (`bim_corner` 94,4ms · `endpoint` 62,3 · `midpoint` 59,3 · `bim_center` 51,0 · `bim_midpoint` 47,4) ενώ οι index-less που κατηγορήθηκαν είναι **αμελητέες** (`snap:intersection` = **1,9ms σε 26΄΄**) ⇒ **η Φ2 υποβιβάζεται** από «θεραπεία» σε «καθαρότητα SSoT με αβέβαιο κέρδος». Επιβιώνει το `snap:ENTITIES` = **2910 σταθερά** — το διπλότυπο του §3.3 είναι πραγματικό, απλά **δεν είναι ο ένοχος**. Νέα υπόθεση προς έλεγχο (**αμέτρητη**): `avg 0,79` με `max 33,4` σε 119 κλήσεις = **μία** ακριβή εκτέλεση ⇒ προφίλ **ανακατασκευής index**, όχι ερωτήματος. **Μη απομονωμένες μεταβλητές:** pan vs zoom, επίπεδο μεγέθυνσης (πλήρες zoom-out ⇒ μεγαλύτερο `worldRadiusAt` ⇒ το ίδιο ερώτημα index επιστρέφει πολύ περισσότερα σημεία), θέρμανση JIT (η 1η μέτρηση έτρεξε αμέσως μετά από `Fast Refresh` **12.176ms**). ⚠️ **Και οι δύο μετρήσεις είναι dev· καμία production ακόμη.** Το όργανο επαληθεύτηκε ως προς τη συνέπειά του: άθροισμα `snap:*` ≈ **339ms** έναντι `frame:snap-detection` **346,1ms**. **Μηδέν κώδικας, μηδέν commit.** |
| 2026-07-29 (β) | **Φ0.1 ΥΛΟΠΟΙΗΘΗΚΕ — attribution ανά engine, μηδέν νέο σύστημα** (§5 Φ0.1). Ένα αρχείο (`SnapOrchestrator.ts`): ο **υπάρχων** `withPerf` τυλίγει κάθε `engine.findSnapCandidates`, πίσω από το **υπάρχον** flag `dxf-perf-trace`, στον **υπάρχοντα** aggregator — η μία γραμμή `frame:snap-detection` γίνεται **26**. Δεύτερη γραμμή `snap:ENTITIES` = **πόσες οντότητες παραδίδονται** ανά αναζήτηση: το ίδιο μέγεθος που η Φ2 υποχρεούται να ρίξει από 2.910 σε ~20, άρα **η ίδια γραμμή τεκμηριώνει το πρόβλημα και θα αποδείξει τη θεραπεία**. Boy-scout N.7.1 (**όχι προαιρετικό**): το `findSnapPoint` ήταν **83 γραμμές** ⇒ εξήχθησαν `collectCandidates()` + `hasEnoughCandidates()` ⇒ **21/35/13** γραμμές κώδικα· ο `collectCandidates` είναι **ακριβώς** το σημείο της Φ2. **9 νέες δοκιμές** σε φάκελο που **δεν υπήρχε** — ο orchestrator του snap ήταν **ατεστάριστος**· processor + contextManager μένουν πραγματικοί, μόνο το registry είναι mocked. **Mutation-verified 2/2** (αγνόηση `earlyReturn` → 1 κόκκινο· μετακίνηση του `recordSample` μετά το early-return → 1 κόκκινο) με **ρητή οριοθέτηση**: τα υπόλοιπα 7 tests καρφώνουν κώδικα που μεταφέρθηκε αυτούσιος — άγκυρες **για τη Φ2**, όχι απόδειξη της τωρινής αλλαγής. Παλινδρόμηση `snapping/` **25 suites / 258 tests** πράσινα· `jscpd:diff` μηδέν clones· **μηδέν αλλαγή συμπεριφοράς**. **Μηδέν commit.** |
| 2026-07-29 | **Δημιουργία. Phase 0 (αναγνώριση) ολοκληρωμένη· μηδέν κώδικας.** Η πρώτη μέτρηση **ανά σύστημα** αναίρεσε τη διάγνωση του ADR-726: `snap-detection` **97,4%**, bitmap cache **2,3%** (§1, §2) — πέμπτη λανθασμένη διάγνωση της σειράς, **αποτραπείσα πριν γραφτεί κώδικας πάνω της**. Αιτία, grep-verified: **δεν υπάρχει broad phase** — ο `SnapContextManager` παραδίδει και τις **2.910** οντότητες σε **κάθε** μία από τις **26** engines, και **17** από αυτές δεν έχουν spatial index (§3). Η ίδια ερώτηση απαντιέται **26 φορές ανά κίνηση** (§3.3, N.0.2). Το SSoT χωρικού ευρετηρίου **υπάρχει ήδη** (`core/spatial/`) και χρησιμοποιείται σε **9 ιδιωτικά αντίγραφα**, ποτέ στο επίπεδο του orchestrator (§3.4) ⇒ η θεραπεία **δεν χτίζει νέο σύστημα**. Τεκμηριώθηκε ότι η **Φ11 του ADR-040 μετακίνησε** τη δουλειά σε rAF slot του ΙΔΙΟΥ συγχρονισμένου βρόχου, δεν την αποσύνδεσε (§3.6), και ότι η κεφαλίδα του `snap-scheduler.ts` δήλωνε **1-5ms** ενώ μετρήθηκαν **50,2ms** (§2.1). Έρευνα: AutoCAD APERTURE ως broad phase, broad/narrow phase, αναστολή του Revit στη navigation, `scheduler.yield()` (Chrome 129+), απόρριψη `isInputPending()` (§4). Σχέδιο Φ0.1-Φ5 (§5) με **Φ0.1 = per-engine attribution ΠΡΙΝ από κάθε διόρθωση** και **Φ5 = negative-space early-out** πέρα από την τρέχουσα πρακτική. Κριτήρια αποδοχής με **συμπεριφορική ισοδυναμία 100%** (§6). Εντοπίστηκε κενό στο ΙΔΙΟ το όργανο: φρουρεί `visibilityState` αλλά **όχι** `hasFocus()` ⇒ `frame:INTERVAL` δηλητηριασμένο με δείγμα **12.719ms** (§7.1) — ανοιχτό σημείο #3 του ADR-726 §13.5, τώρα πληρωμένο. **Μηδέν commit.** |

---

## 10. Πηγές (έρευνα 2026-07-29)

- [AutoCAD — APERTURE (Command)](https://help.autodesk.com/cloudhelp/2020/ENU/AutoCAD-Core/files/GUID-C8603032-7E55-4EEF-B2DF-CD2FD9EDEF91.htm)
- [AutoCAD Tutorial — Object Snap (CADTutor)](https://www.cadtutor.net/tutorials/autocad/object-snap.php)
- [Broad Phase Collision Detection Using Spatial Partitioning (Build New Games)](http://buildnewgames.com/broad-phase-collision-detection/)
- [Physics — Broad phase and Narrow phase (Newcastle University)](https://research.ncl.ac.uk/game/mastersdegree/gametechnologies/physicstutorials/6accelerationstructures/Physics%20-%20Spatial%20Acceleration%20Structures.pdf)
- [Slow performance when navigating Revit views Pan/Zoom/Orbit (Autodesk)](https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/Slow-performance-when-navigating-Revit-views-Pan-Zoom-Orbit.html)
- [WICG — `scheduler.yield()` and continuations](https://github.com/WICG/scheduling-apis/blob/main/explainers/yield-and-continuation.md)
- [MDN — `Scheduling.isInputPending()`](https://developer.mozilla.org/en-US/docs/Web/API/Scheduling/isInputPending)
- [Chrome for Developers — Better JS scheduling with `isInputPending()`](https://developer.chrome.com/docs/capabilities/web-apis/isinputpending)
