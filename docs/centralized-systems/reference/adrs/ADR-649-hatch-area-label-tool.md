# ADR-649 — Εργαλείο «Ετικέτα Εμβαδού Γραμμοσκίασης» (Hatch Area Label)

- **Status**: 🔵 PROPOSED
- **Date**: 2026-07-13
- **Category**: DXF Viewer / Annotation / Hatch
- **Σχετικά**: ADR-507 (Hatch Creation System), ADR-557 (Center Measurement Label), ADR-344 (Enterprise Text Engine), ADR-462 (Canonical mm units), ADR-057 (`completeEntity` unified pipeline), ADR-040 (event-time SSoT reads)

---

## Context (το πρόβλημα)

Ο χρήστης θέλει, με το ποντίκι, να **διαβάζει το εμβαδόν μιας γραμμοσκίασης** και να
**τοποθετεί μόνιμη ετικέτα-κείμενο** με αυτό το εμβαδόν μέσα στο σχέδιο (annotation που
επιλέγεται / μετακινείται / σβήνεται / υποστηρίζει undo — όχι εφήμερο overlay/tooltip).

Υπήρχε ήδη το `auto-measure-area` (κλικ μέσα σε πολύγωνο → υπολογισμός εμβαδού) αλλά δείχνει
**screen-space HTML panel** (`AutoAreaResultStore` + `AutoAreaResultPanel`), όχι entity στο
σχέδιο. Επίσης όλα τα δομικά κομμάτια (εμβαδόν hatch, format, centroid, text entity, pattern→
υλικό) υπήρχαν ήδη ως SSoT — έλειπε μόνο η **ενορχήστρωση 2 κλικ**.

## Decision (η λύση)

Νέο **2-κλικ placement/creation tool** `'hatch-area-label'` (category `drawing`):

1. **Κλικ 1** — `pickTopHatchAt` (even-odd SSoT) διαλέγει τη γραμμοσκίαση κάτω από τον κέρσορα,
   την κλειδώνει στην FSM και την highlight-άρει (`replaceEntitySelection`).
2. **Κλικ 2** — χτίζει `TextEntity` με το εμβαδόν και το commit μέσω `completeEntity`
   (undo + persistence + `drawing:complete`). **Θέση (hybrid, επιλογή Giorgio):** αν το 2ο κλικ
   πέσει ΜΕΣΑ στην ίδια γραμμοσκίαση → **centroid** (`polygon2DAreaCentroid`)· αλλιώς → **σημείο
   του κλικ**. Μετά το commit επαναφορά στη φάση 1 (συνεχής χρήση, AutoCAD-style).

**Κείμενο (i18n, N.11):** «Εμβαδόν: 25,00 m²», και όταν το `HatchEntity.patternName` αντιστοιχεί
σε αναγνωρίσιμο υλικό (`HATCH_PATTERN_CATALOG`) → «Εμβαδόν **γρασιδιού**: 25,00 m²». Η γενική
(genitive) ζει ΜΟΝΟ στο locale (`hatchAreaLabel.materials.<key>`), με `i18n.exists` guard·
MISS → fallback στο σκέτο «Εμβαδόν: …». (EN: `of grass`/`of concrete`/… → «Area of grass: …».)

**Hover highlight (parity με «Επιλογή»):** όσο το εργαλείο είναι ενεργό, το mousemove φωτίζει τη
γραμμοσκίαση κάτω από τον κέρσορα μέσω του ΙΔΙΟΥ `HoverStore` SSoT — reuse του armed
«Επιλογή γραμμοσκίασης» branch στο `useAutoAreaMouseMove` (`setHoveredEntity(pickTopHatchAt(...))`,
ΟΧΙ create-ghost). Καθάρισμα (`setHoveredEntity(null)`) στο deactivate.

**Μέγεθος κειμένου (fit-to-hatch):** το ύψος ΔΕΝ κλιμακώνεται με το `drawingScale` (έβγαζε
δυσανάλογα μεγάλα κείμενα)· `fitHatchLabelHeight` το παράγει από το bbox (`boundsOfPoints`) της
γραμμοσκίασης — ~85% του πλάτους (μέσο πλάτος χαρακτήρα 0.6×) με cap 35% του ύψους — ώστε να
χωράει πάντα, ανεξάρτητα κλίμακας/μονάδων. Κεντραρισμένο (attachment `MC`).

### Reuse (μηδέν re-implementation)

| Ανάγκη | SSoT |
|---|---|
| Εμβαδόν (mm², outer−islands) | `computeHatchAreaMm2` (`bim/hatch/hatch-completion.ts`) |
| Format ενεργής μονάδας | `formatAreaForDisplay` (`config/display-length-format.ts`) |
| Pick hatch (even-odd) | `pickTopHatchAt` (`bim/hatch/hatch-pick-at.ts`) |
| Centroid (area-weighted) | `polygon2DAreaCentroid` (`bim/geometry/shared/polygon-utils.ts`) |
| pattern → υλικό | `HATCH_PATTERN_CATALOG[patternName].labelKey` → i18n |
| textNode (unit-safe ύψος) | `makeRun`/`makeParagraph`/`makeNode` + `paperHeightToModel` |
| commit + undo + persistence | `completeEntity` (`hooks/drawing/completeEntity.ts`) |
| enterprise id | `generateEntityId` (N.6) |

### Αρχιτεκτονική (auto-area pattern, ADR-040-safe)

- **Pure builders**: `bim/hatch/hatch-area-label.ts` (`buildHatchAreaLabelText`,
  `resolveHatchMaterialGenitive`, `resolveHatchLabelAnchor`, `buildHatchAreaLabelTextNode`,
  `buildHatchAreaLabelEntity`).
- **FSM store** (vanilla, event-time): `bim/hatch/hatch-area-label-store.ts`
  (`awaitingHatch` → `awaitingPlacement`). Ο click handler διαβάζει live getter (ΟΧΙ React snapshot).
- **Click handler**: `handleHatchAreaLabelClick` (`hooks/canvas/canvas-click-tool-handlers.ts`),
  dispatch από `useCanvasClickHandler` PRIORITY 1.72 (πριν το unified accumulator).
- **Lifecycle**: `hooks/drawing/useHatchAreaLabelTool.ts` (reset FSM + status prompt σε
  activate/deactivate), wired στο `useSpecialTools-placement-tools.ts`.
- **Registration**: `ToolType 'hatch-area-label'`· `TOOL_DEFINITIONS` (category `drawing` ⇒
  `isInDrawingMode=true`, ώστε το mouse-up select block να ΜΗΝ τρέχει παράλληλα → κανένα διπλό
  select)· `TOOL_CREATES_ENTITY: 'text'`· ribbon κουμπί στο Annotate/Measure panel.

## Consequences

- ✅ Η ετικέτα είναι κανονικό `TextEntity` — select/move/delete/undo, persist όπως κάθε text.
- ✅ Το εμβαδόν παραμένει συνεπές με τα υπόλοιπα readouts (ίδιο `computeHatchAreaMm2` +
  `formatAreaForDisplay` που ήδη χρησιμοποιεί το `RibbonHatchListWidget`).
- ~~⚠️ Η ετικέτα **δεν** ενημερώνεται αυτόματα αν αλλάξει το όριο της γραμμοσκίασης~~ →
  **ΑΡΘΗΚΕ 2026-07-27**: η ετικέτα είναι πλέον **associative** (βλ. §associative παρακάτω).
  Το `areaSourceId` κάνει τον σύνδεσμο ρητό· **η απουσία του παραμένει έγκυρη κατάσταση**
  (ετικέτες φτιαγμένες πριν την αλλαγή μένουν στιγμιότυπα — καμία αναδρομική μετάλλαξη).
- ⚠️ Γενικές (genitive) υπάρχουν μόνο για ~15 ground/construction/metal/insulation patterns·
  τα υπόλοιπα πέφτουν καθαρά στο «Εμβαδόν: …».

---

## §associative — Η ζωντανή ετικέτα (2026-07-27)

**Αίτημα Giorgio:** «η ετικέτα είναι στιγμιότυπο — το θέλω associative, να ενημερώνεται μόνο του.»

### A.1 Ο σύνδεσμος

Νέο **προαιρετικό** `TextEntity.areaSourceId` — η οντότητα από την οποία μετρήθηκε το εμβαδόν.
Παρόν ⇒ associative· απόν ⇒ σκέτο κείμενο. **Η απουσία είναι έγκυρη κατάσταση, όχι σφάλμα**:
ετικέτες φτιαγμένες πριν την αλλαγή παραμένουν στιγμιότυπα και δεν μεταλλάσσονται αναδρομικά.

### A.2 🔴 ΚΑΝΕΝΑΣ ΝΕΟΣ ΜΗΧΑΝΙΣΜΟΣ — και ΠΟΤΕ reactive effect

Ο `cascadeAreaLabels` είναι **ένας ακόμη reconciler** της υπάρχουσας universal SSoT του
**ADR-540** (`bim/cascade/associative-geometry-reconcile`), δίπλα στα «ανοίγματα → τοίχος» και
«δοκάρια → όψεις κολόνας». Κληρονομεί **δωρεάν** και τα δύο call sites της — γι' αυτό η
**γραμμοσκίαση δούλεψε με μηδέν νέα καλωδίωση**: το `UpdateHatchBoundaryCommand` **είναι**
`MergeableUpdateCommand`.

Ανήκει στην κατηγορία **scene-derived** (όχι delta-follower): το εμβαδόν δεν «ακολουθεί» μια
μετατόπιση — **ξαναμετριέται** από την τρέχουσα σκηνή.

🔴 **ADR-492 §4 — μην το αγνοήσεις:** effect που άκουγε `bim:entities-moved` και ξανα-εξέπεμπε
geometry event έκανε **βρόχο** με τον proactive analysis cycle → **storm/freeze**. Ο
επανυπολογισμός τρέχει **σύγχρονα μέσα στην εντολή**, και η **ιδεμποτεντικότητα** (ίδιο κείμενο
⇒ κανένα patch ⇒ κανένα emit) είναι ο μηχανισμός που κάνει τον κύκλο να συγκλίνει. Αν πέσει η
ιδεμποτεντικότητα, η εφαρμογή **παγώνει** — δεν «γράφει λίγο παραπάνω».

### A.3 Τρεις trigger αλλαγής πηγής, ένας reconciler

| Trigger | Πού συνδέθηκε |
|---|---|
| Σύρσιμο λαβής (hatch **και** τοπογραφική) | ο **υπάρχων** `reconcileAssociativeGeometry` — μηδέν νέα καλωδίωση για τη γραμμοσκίαση· η τοπογραφική περνά από το `MoveTopoSurveyPointCommand` (ADR-662 §13) |
| **Διαγραφή** πηγής | **ΝΕΟ** `reconcileAssociativeGeometryOnDelete` — αδελφός του υπάρχοντος `…OnCreate`. Το delete ήταν το **τρίτο, ακάλυπτο** σκέλος του κύκλου ζωής (single **και** bulk delete· αλλιώς «σβήνω 1 → ένδειξη, σβήνω 2 → ψέμα») |
| «Αναδημιουργία» επιφάνειας | `useTopoSurfaceEntity.generate` — σταθερό id, άρα οι ετικέτες μένουν συνδεδεμένες, αλλά το εμβαδόν άλλαξε |

⚠️ Το delete hook τρέχει **ΜΟΝΟ** τον area-label reconciler, **όχι** ολόκληρο τον geometry
cascade — με το ίδιο σκεπτικό που το create path τρέχει υποσύνολο: οι geometry cascades έχουν
δική τους διαδρομή διαγραφής και το να κληθούν εδώ θα άλλαζε **σιωπηλά** συμπεριφορά
τοίχων/σκαλών που καμία ανάγκη δεν το ζήτησε.

### A.4 Σβησμένη πηγή — έρευνα, και η απόφαση

| Παίκτης | Τι κάνει όταν σβηστεί η πηγή |
|---|---|
| **Revit** | Η ετικέτα **ΔΕΝ** σβήνει· γίνεται *orphaned* και δείχνει **`?`** αντί για τιμή. Μένει στην όψη και **τυπώνεται/εξάγεται** έτσι. |
| **AutoCAD FIELD** (Object → Area) | Το πεδίο δείχνει **`####`** όταν το αντικείμενο αναφοράς σβηστεί. |

**Συγκλίνουν, και κανένας δεν κάνει το προφανές:** ούτε διαγραφή, ούτε σιωπηλό πάγωμα — **κράτα
την ετικέτα, σήμανε την αναφορά ως άκυρη**. Απόφαση Giorgio: το ίδιο, με `####` (σύμβαση DXF,
και το έργο είναι DXF-native) και **πρόθεμα άθικτο** — «Εμβαδόν: ####» λέει ταυτόχρονα τι
έλειπε και ότι λείπει. Ένας αριθμός που δεν αντιστοιχεί πια σε τίποτα είναι **χειρότερος** από
κανέναν αριθμό.

**Το undo δεν χρειάστηκε διαδρομή «un-orphan»:** ο reconciler διαβάζει την τρέχουσα σκηνή, οπότε
όταν η πηγή επιστρέφει βρίσκει αληθινό εμβαδόν και ξαναγράφει τον πραγματικό αριθμό — ίδιος
κώδικας, καμία κατάσταση να ξεσυγχρονιστεί.

### A.5 Τι ΔΕΝ αγγίζει ο επανυπολογισμός

- **Θέση**: ο χρήστης μπορεί να έχει σύρει την ετικέτα· associative recompute **δεν** είναι
  άδεια να του τη μετακινήσουμε.
- **Μέγεθος κειμένου**: annotation **στυλ**, όχι παράγωγο μέγεθος. Επανα-εφαρμογή του
  `fitAreaLabelHeight` θα έκανε την ετικέτα να **αναπηδά** σε κάθε σύρσιμο λαβής· η Revit κάνει
  το αντίθετο (το tag κρατά το μέγεθος του τύπου του, μόνο η **τιμή** ενημερώνεται).

### A.6 Επαλήθευση

35 πράσινα σε 2 σουίτες. Το `area-label-cascade.test.ts` τρέχει **παραμετρικά** τα ίδια σενάρια
για **γραμμοσκίαση ΚΑΙ τοπογραφική επιφάνεια** — αν κάποιος γράψει topo-only κλάδο, σπάει
(N.18). Κλειδώνονται ρητά: αλλαγή ⇒ νέος αριθμός· **ιδεμποτεντικό** (2ο+3ο πέρασμα = μηδέν
εγγραφές, μετρημένες)· πύλη κόστους (άσχετο `changedId` ⇒ καμία σάρωση)· ορφάνεμα → επιστροφή·
θέση και μέγεθος αμετάβλητα.

🔴 **Καμία ζωντανή επαλήθευση στον browser** — απαιτεί χειροκίνητο έλεγχο.


## Changelog

- **2026-07-13** — Αρχική υλοποίηση (2-κλικ tool, hybrid anchor, pattern→genitive label,
  reuse όλων των SSoT). Νέα αρχεία: `hatch-area-label.ts`, `hatch-area-label-store.ts`,
  `useHatchAreaLabelTool.ts`. i18n: `hatchAreaLabel.*` + `ribbon.commands/tooltips.hatchAreaLabel`
  (el+en).
- **2026-07-13 (feedback Giorgio)** — (1) **Hover highlight** parity με «Επιλογή» (reuse του
  armed-hatch-select branch στο `useAutoAreaMouseMove` + cleanup στο deactivate). (2) **Fit-to-hatch
  μέγεθος κειμένου** (`fitHatchLabelHeight` από bbox, αντικατέστησε το `paperHeightToModel×
  drawingScale` που έβγαζε πολύ μεγάλα κείμενα) + κεντραρισμένο run (`MC`).
- **2026-07-13 (feedback Giorgio)** — Δεύτερο σημείο εισόδου: κουμπί «Ετικέτα Εμβαδού» και στο
  **contextual tab της γραμμοσκίασης** (`contextual-hatch-tab.ts`, panel `hatch-actions`). Ίδιο
  `commandKey: 'hatch-area-label'` → κανένα νέο wiring.
- **2026-07-27 — ΓΕΝΙΚΕΥΘΗΚΕ: το εργαλείο δεν είναι πια hatch-only** (πλήρες σκεπτικό:
  **ADR-662 §12**). Ο Giorgio ζήτησε το ΙΔΙΟ 2-κλικ πάνω σε **τοπογραφική επιφάνεια**·
  απόφασή του: γενίκευση αυτού του εργαλείου, ΟΧΙ δεύτερο δίδυμο.
  - **Πού ζει πλέον ο κώδικας**: `bim/hatch/hatch-area-label{,-store}.ts` →
    **`systems/measure/area-label{,-store}.ts`**· `hooks/drawing/useHatchAreaLabelTool.ts` →
    **`useAreaLabelTool.ts`** (git mv — το ιστορικό διατηρήθηκε). Το FSM κρατά `entityId`
    (ήταν `hatchId`) και η φάση 1 λέγεται `awaitingEntity` (ήταν `awaitingHatch`).
  - **Ποιοι τύποι επιτρέπονται**: το λέει **ΜΟΝΟ** το νέο `systems/measure/entity-area-facts.ts`.
    Νέος τύπος με εμβαδόν ⇒ αλλαγή **μόνο εκεί** — μηδέν κλάδος σε pick/hover/FSM/κείμενο/builder.
  - **Το εμβαδόν της γραμμοσκίασης ΔΕΝ άλλαξε**: ίδιο `computeHatchAreaMm2` (outer − islands).
    Η τοπογραφική επιφάνεια χρησιμοποιεί **τρίγωνα TIN**, γιατί τα rings της δεν έχουν
    αξιόπιστο προσανατολισμό (ADR-662 §12.2) — **σκόπιμα διαφορετική γεωμετρία ανά τύπο**.
  - **Δεύτερη γραμμή** στην ετικέτα («Επιφάνεια εδάφους») **μόνο** για οντότητες με ανάγλυφο·
    η γραμμοσκίαση παραμένει μονόγραμμη (`surface3DMm2: null`).
  - **i18n**: namespace `hatchAreaLabel.*` → **`areaLabel.*`** (el+en) + νέο `surfacePrefix`·
    `status.awaitingHatch` → `status.awaitingEntity` με ενημερωμένη διατύπωση. Τα
    `ribbon.commands/tooltips.hatchAreaLabel` **έμειναν** (το ορατό label ήταν ήδη γενικό).
  - **Tool id `hatch-area-label` ΔΕΝ μετονομάστηκε** — εσωτερικό αναγνωριστικό σε 9 σημεία,
    μηδέν όφελος χρήστη. Τεκμηριωμένο ως ιστορικό σε `tool-definitions.ts` + `ui/toolbar/types.ts`.
  - **Τρίτο σημείο εισόδου**: κουμπί «Ετικέτα Εμβαδού» και στο **contextual tab της
    τοπογραφικής επιφάνειας** (`contextual-topo-surface-tab.ts`). Ίδιο `commandKey` → μηδέν wiring.
  - ~~Το ⚠️ «στιγμιότυπο, όχι associative» **ισχύει ακέραιο**~~ → **ΑΡΘΗΚΕ την ίδια μέρα**, βλ. παρακάτω.
- **2026-07-27 — ASSOCIATIVE (§associative)**. Το ⚠️ «στιγμιότυπο, όχι associative» των
  Consequences **αίρεται**. Νέο προαιρετικό `TextEntity.areaSourceId`· νέος
  `systems/measure/area-label-cascade.ts` (`cascadeAreaLabels`) **μέσα** στην υπάρχουσα SSoT του
  **ADR-540** — κανένας νέος μηχανισμός, καμία reactive διαδρομή (ADR-492 §4). Νέο lifecycle hook
  `reconcileAssociativeGeometryOnDelete` (single + bulk delete, + undo/redo). Ορφανή αναφορά =
  `####` με πρόθεμα άθικτο (σύγκλιση Revit «?» / AutoCAD FIELD «####» — έρευνα §A.4). Θέση και
  μέγεθος κειμένου **δεν** αγγίζονται. Ένας μηχανισμός για γραμμοσκίαση **και** τοπογραφική
  επιφάνεια (τεστ παραμετρικά και στους δύο τύπους). Τεστ: 35 πράσινα / 2 σουίτες.
