# ADR-677 — Επιλογή Μονάδας από τον Χρήστη (mm/cm/m) για Δημιουργία / Μετακίνηση / Μετασχηματισμό Οντοτήτων

**Status:** 🚧 ΣΕ ΕΞΕΛΙΞΗ — **Φάση 1 ✅ ΟΛΟΚΛΗΡΩΜΕΝΗ** (2026-07-18) · pending Φάσεις 2-4 · Discovery: 2026-07-18 (Opus 4.8, 5-agent orchestrated audit)
**Σχετικά / εξαρτάται:** ADR-462 (canonical-mm units — η διέπουσα απόφαση), ADR-357 §5.5 (display-unit selector, default `cm`), ADR-358 (stair units + width-heuristic), ADR-368 (import drawing-units override), ADR-513 (Radial Command Ring / direct-distance-entry), ADR-508 (grip/HUD live), ADR-049 (move/grip SSoT), ADR-082 (FormatterRegistry locale engine).
**Αφορμή:** Ερώτημα Giorgio — «κατά τη δημιουργία οντοτήτων DXF BIM/MEP (2Δ ή 3Δ), σε τι μονάδα δουλεύουμε (mm/cm/m); Θέλω ο χρήστης με έναν διακόπτη/επιλογή να διαλέγει αν οι τιμές μετακίνησης / μετασχηματισμού / δημιουργίας θα είναι σε χιλιοστά, εκατοστά ή μέτρα.»

---

## 1. TL;DR — Το κύριο εύρημα

**Το ζητούμενο feature υπάρχει ήδη σε ~85% υλοποιημένο βαθμό — δεν είναι greenfield.** Ο DXF Viewer έχει ήδη:
1. **Σταθερή εσωτερική μονάδα = χιλιοστά (mm), πάντα** (canonical-mm, ADR-462 — όπως το Revit). Ό,τι εισάγεται κλιμακώνεται σε mm κατά το import· καμία οντότητα δεν αποθηκεύεται σε άλλη μονάδα (εξαίρεση: σκάλες — βλ. §5 G4).
2. **Ζωντανό επιλογέα display-μονάδας (`mm`/`cm`/`m`/`in`/`ft`)** στο CAD status bar (`DisplayUnitSelector`), με default `cm`, persist σε `localStorage['dxf:displayUnit']`, και live redraw όλων των readouts.
3. **Η πληκτρολογούμενη τιμή κατά τη ΔΗΜΙΟΥΡΓΙΑ** (μήκος/πάχος/ύψος στο Δαχτυλίδι Εντολών) **ερμηνεύεται ήδη στην επιλεγμένη μονάδα** και μετατρέπεται σε mm (`fromDisplay` / `lengthDisplayToSceneLock`).
4. **Η πληκτρολογούμενη τιμή κατά τη ΜΕΤΑΚΙΝΗΣΗ / GRIP-DRAG / STRETCH** (direct-distance entry) **ερμηνεύεται επίσης ήδη στην επιλεγμένη μονάδα** (ίδιο `lengthDisplayToSceneLock`).
5. **Ο πίνακας HUD** (μήκος/γωνία κατά το drag) εμφανίζει στην επιλεγμένη μονάδα (`formatLengthForDisplay`).

**Άρα το feature δεν χρειάζεται νέα υποδομή — χρειάζεται (α) απόφαση default + discoverability, (β) εξάλειψη 4-5 ασυνεπειών όπου τμήματα του UI ΔΕΝ σέβονται τον επιλογέα, (γ) απόφαση για persistence scope.** Το παρόν ADR καταγράφει την τρέχουσα κατάσταση του **κώδικα** (Phase 1 Recognition, N.0.1) και προτείνει τρόπο να προχωρήσουμε· οι τελικές αποφάσεις λαμβάνονται στο Q&A.

---

## 2. Η αρχιτεκτονική των μονάδων σήμερα (χαρτογράφηση)

### 2.1 Κανονική εσωτερική μονάδα — χιλιοστά (ADR-462)
- **ΟΛΗ η γεωμετρία αποθηκεύεται σε mm, πάντα.** Enforced στο import: `utils/dxf-scene-builder.ts` `buildScene()` → κλιμακώνει κάθε συντεταγμένη source→mm μέσω `scaleEntity` (ADR-348), σφραγίζει `units:'mm'`.
- Τα scene/world coordinates που κλικάρει ο χρήστης (`Point2D`/`Point3D`) είναι **mm by construction**.
- Τα `params` κάθε BIM/MEP οντότητας (πάχος/πλάτος/ύψος/διάμετρος/offset) είναι **mm πάντα** — τεκμηριωμένο στην κεφαλίδα κάθε `bim/types/*-types.ts` («All linear measurements in mm — Nestor convention»).
- Προαιρετικό πεδίο `params.sceneUnits?: SceneUnits` υπάρχει **μόνο** ως hint boundary-conversion για legacy/imported μη-mm σκηνές· απόν ⇒ default `'mm'`.

### 2.2 Ο μηχανισμός επιλογής μονάδας (display-unit stack) — ΗΔΗ ΧΤΙΣΜΕΝΟΣ
Πέντε επίπεδα, όλα με ρητή τεκμηρίωση SSoT:

| Επίπεδο | Αρχείο | Ρόλος |
|---|---|---|
| 1. Καθαρός πίνακας μετατροπών | `config/units.ts` | `DisplayUnit = SceneUnits` (`mm/cm/m/in/ft`)· `DEFAULT_DISPLAY_UNIT = 'cm'`· `toDisplay`/`fromDisplay`/`toDisplayArea`/`formatDisplayValue` (parseable για inputs) |
| 2. Ζωντανό persisted store | `config/display-unit-state.ts` | `displayUnitState.get/set/subscribe`· μοτίβο `cadToggleState`· `localStorage['dxf:displayUnit']` |
| 3. React binding | `hooks/common/useDisplayUnit.ts` | `useSyncExternalStore`· ο setter καλεί `markAllCanvasDirty()` → live redraw |
| 4. Formatter chokepoint (read-only) | `config/display-length-format.ts` | `formatLengthForDisplay`/`formatAreaForDisplay`/`formatCoordinateForDisplay`/`formatSceneLengthForDisplay`/`currentDisplayUnitLabel` |
| 5. UI toggle | `statusbar/CadStatusBar.tsx` → `DisplayUnitSelector` (γρ. 160, 400-434) | Radix `Select` πάνω από `DISPLAY_UNIT_OPTIONS` |

- Χαμηλότερα, ο πίνακας scene-unit μετατροπών: `utils/scene-units.ts` (`mmToSceneUnits`, `sceneUnitsToMeters`, `resolveSceneUnits`, `mmScaleFor`).
- i18n keys υπάρχουν: `cadDock.statusBar.displayUnit` / `.displayUnitDesc` (el: «ΜΟΝΑΔΑ» / «Μονάδα εμφάνισης μετρήσεων», en: «UNIT» / «Measurement display unit»). Τα σύμβολα `mm/cm/m/"/'` δεν είναι i18n'd (physical unit symbols, locale-free — by design).

### 2.3 Είσοδος τιμών κατά τη ΔΗΜΙΟΥΡΓΙΑ (2Δ)
- Pipeline: `hooks/drawing/useUnifiedDrawing.tsx` → `drawing-preview-generator.ts` `generatePreviewEntity(...)` → per-tool `*-completion.ts` (wall/column/slab/beam/opening/MEP). Preview ≡ commit (η μόνη υλοποίηση είναι ο commit builder).
- **Πληκτρολογούμενο μήκος/πάχος/ύψος** μέσω Δαχτυλιδιού (`systems/dynamic-input/ring-config.ts` `lengthRingField`/`numericOverrideField`): η τιμή ερμηνεύεται στην **display μονάδα** και μετατρέπεται → mm → scene μέσω `lengthDisplayToSceneLock` / `fromDisplay`. **✅ Σέβεται ήδη τον επιλογέα.**
- Οι default τιμές (thickness/height/diameter) είναι σταθερές `DEFAULT_*_MM` (mm).

### 2.4 Είσοδος τιμών κατά ΜΕΤΑΚΙΝΗΣΗ / GRIP-DRAG / STRETCH (2Δ)
- Direct-distance entry μέσω Radial Command Ring (`GRIP_LINEAR_RING_CONFIG` / `OPENING_WIDTH_RING_CONFIG`, ADR-513). Η πληκτρολογούμενη τιμή ερμηνεύεται στην **display μονάδα** → mm → scene (`lengthDisplayToSceneLock`), αποθηκεύεται στο `DynamicInputLockStore` (scene units) και εφαρμόζεται από `applyLengthAngleLock` — **ίδια SSoT σε preview & commit**. **✅ Σέβεται ήδη τον επιλογέα.**
- Τα 3 τρέχοντα uncommitted αρχεία (`useGripGhostPreview.ts`, `apply-entity-preview.ts`, `GripDragStore.ts`) δουλεύουν **αμιγώς σε scene units (≈mm)** — καθαρά geometry pass-through, χωρίς unit boundary.
- Ο πίνακας HUD διαβάζει scene-geometry → mm → **display μονάδα** (`formatLengthForDisplay`). **✅ Σέβεται τον επιλογέα.**

### 2.5 3Δ καμβάς
- Ο κόσμος του three.js είναι **πάντα σε μέτρα**, Y-up· η μετατροπή mm→m ψήνεται per-vertex στο build (`sceneUnitsToMeters` για plan XY, `× MM_TO_M` για κατακόρυφα scalars· κανένα `Object3D.scale`).
- 3Δ μετακίνηση/gizmo: το raw world-delta γίνεται mm (`worldToDxfPlan`), και μετά κλιμακώνεται στη native μονάδα της οντότητας μέσω `mmToEntityUnitFactor` πριν το command. Δεν υπάρχει ξεχωριστός 3Δ επιλογέας μονάδας — το 3Δ readout (`TempMoveReadoutOverlay`) περνά από το ίδιο `move-readout` → display-μονάδα.

---

## 3. Πίνακας: πού σέβεται / ΔΕΝ σέβεται τον επιλογέα μονάδας σήμερα

| Σημείο εισόδου/εξόδου | Μονάδα σήμερα | Σέβεται τον επιλογέα; |
|---|---|---|
| Δημιουργία — μήκος τοίχου/γραμμής (ring) | display unit (**m** def. από Φάση 1) | ✅ ΝΑΙ |
| Δημιουργία — πάχος/ύψος override (ring) | display unit | ✅ ΝΑΙ |
| Δημιουργία — πλάτος κουφώματος (opening-width ring) | **hardcoded mm** | ❌ ΟΧΙ (σκόπιμο — βλ. G1) |
| Μετακίνηση/grip-drag/stretch — direct-distance | display unit | ✅ ΝΑΙ |
| HUD μήκους/γωνίας (drag) | display unit | ✅ ΝΑΙ |
| Ruler ticks / dimension pills / entity labels / X-Y readout | display unit | ✅ ΝΑΙ |
| Βήμα snap F9 («βήμα») | **hardcoded mm** (`unitSuffix="mm"`) | ❌ ΟΧΙ (βλ. G2) |
| Ribbon comboboxes «Πλάτος» (700/800/900…) | **hardcoded mm** | ❌ ΟΧΙ (βλ. G7) |
| Legacy Ctrl+L linear lock (`DynamicInputOverlay`) | display-string χωρίς conversion | ⚠️ BUG/dead (βλ. G3) |
| 3Δ move readout | display unit | ✅ ΝΑΙ |
| Σκάλες (αποθήκευση params) | scene units + width-heuristic | ⚠️ απόκλιση (βλ. G4) |

---

## 4. Απάντηση στο άμεσο ερώτημα του Giorgio

> «Σε τι μονάδα δουλεύουμε κατά τη δημιουργία;»

**Εσωτερικά πάντα σε χιλιοστά (mm).** Ό,τι πληκτρολογεί ο χρήστης (μήκος, μετακίνηση, direct-distance) **ερμηνεύεται ήδη στην επιλεγμένη display-μονάδα** (default = εκατοστά) και μετατρέπεται σε mm. Δηλαδή αν ο επιλογέας είναι σε `m` και γράψεις `3`, γίνεται τοίχος 3 μέτρων· αν είναι σε `cm` και γράψεις `300`, το ίδιο. **Ο διακόπτης που ζητάς υπάρχει ήδη** (dropdown στο status bar) — απλώς (α) ίσως δεν είναι εμφανής/discoverable, (β) υπάρχουν σημεία που τον αγνοούν (κουφώματα, βήμα F9, ribbon comboboxes) και πρέπει να αποφασίσουμε αν θα εναρμονιστούν.

---

## 5. Ευρήματα — ασυνέπειες / κενά (για απόφαση)

**G1 — Opening-width ring = hardcoded mm (σκόπιμο, 2026-07-18).** `systems/dynamic-input/opening-width-ring-config.ts` ερμηνεύει την τιμή ως **mm** ανεξαρτήτως επιλογέα, γιατί το ribbon combobox «Πλάτος» δείχνει 700/800/900… mm. Δύο ring fields στο ΙΔΙΟ `DynamicInputLockStore.length` slot ερμηνεύουν πλήκτρα σε διαφορετική μονάδα (display vs mm) ανάλογα με το ενεργό εργαλείο. **Ασυνέπεια UX** — πρέπει να αποφασιστεί ρητά.

**G2 — Βήμα snap F9 = πάντα mm.** `bim/grips/grip-step-quantize.ts` `DEFAULT_GRIP_SNAP_STEP = 50` (mm)· το status-bar field είναι hard-labelled `unitSuffix="mm"`, δεν διαβάζει `displayUnit`. Αν ο χρήστης δουλεύει σε `m`, το βήμα εξακολουθεί να τυπώνεται/ερμηνεύεται σε mm.

**G3 — Legacy Ctrl+L linear lock = latent 100× bug (πιθανόν dead).** `systems/dynamic-input/components/DynamicInputOverlay.tsx` σπρώχνει το raw display-string στο `DynamicInputLockStore.toggle('length', val)` **χωρίς** `lengthDisplayToSceneLock`. Gated σε `activeTool==='line'`, το οποίο πλέον «ΠΑΝΤΑ» δείχνει το Ring → μάλλον unreachable, αλλά είναι latent bug — να αφαιρεθεί ή να διορθωθεί.

**G4 — Σκάλες: απόκλιση από canonical-mm.** Οι `StairParams` αποθηκεύουν `width`/`totalRun`/`basePoint` σε **scene units** χωρίς persisted `sceneUnits` field· η μονάδα **μαντεύεται runtime** από το μέγεθος του `width` (`inferSceneUnitsFromWidth`: <10→m, <100→cm, αλλιώς mm). Ρητά «leave as-is» στο ratchet backlog (`.claude-rules/pending-ratchet-work.md:481`). Νέες σκάλες συμφωνούν στην πράξη (seed από mm-scene)· ρίσκο μόνο για pre-462 / non-mm σκηνές.

**G5 — Stale σχόλιο.** `bim-3d/converters/StairToThreeConverter.ts:9` λέει «already in mm (ADR-358 §5.0)» ενώ ο ίδιος ο κώδικας 30 γραμμές κάτω χρησιμοποιεί width-heuristic. Παραπλανητικό — να διορθωθεί.

**G6 — Persistence scope μόνο localStorage.** Το ADR-357 §5.5 προέβλεπε project-scoped override σε Firestore (`projects/{id}/dxfSettings`) — **δεν υλοποιήθηκε**. Σήμερα η προτίμηση είναι per-browser (localStorage), όχι per-project/per-user στο cloud.

**G7 — Ribbon numeric comboboxes σε hardcoded mm.** Τα comboboxes διαστάσεων (π.χ. «Πλάτος» κουφώματος) δείχνουν σταθερές τιμές mm και δεν ακολουθούν τον επιλογέα — συνδέεται με το G1.

---

## 6. ΑΠΟΦΑΣΕΙΣ (Giorgio, Q&A 2026-07-18)

| # | Ερώτημα | **Απόφαση** |
|---|---|---|
| 1 | Προεπιλεγμένη μονάδα | **Μέτρα (`m`)** — αλλάζει το `DEFAULT_DISPLAY_UNIT` από `'cm'` σε `'m'` (υπερισχύει της απόφασης ADR-357 §5.5 / 2026-05-16) |
| 2 | Εξαιρέσεις G1/G2/G7 | **Επιλογή Α — Πλήρης εναρμόνιση.** ΟΛΑ τα πεδία εισόδου σέβονται τον επιλογέα· ΕΝΑ project unit παντού |
| 3 | Πλάτη κουφωμάτων | **Πλήρης συνέπεια** — τα presets γίνονται `0,70 / 0,80 / 0,90` σε m. Ο Giorgio επιβεβαίωσε ρητά τη συνέπεια της αλλαγής (περισσότερα δεκαδικά στην πληκτρολόγηση) |
| 4 | Persistence | **Project-scoped Firestore** (υλοποίηση του G6 / ADR-357 §5.5) — η μονάδα ταξιδεύει με το project, όχι με τον browser |
| 5 | Discoverability | **ΜΟΝΟ dropdown** — καμία εναλλαγή με πλήκτρο. *(Αναθεωρήθηκε 2026-07-18 στη Φάση 1 — βλ. §6.1)* |
| 6 | Σκάλες (G4) | **ΝΑΙ, αλλά σε ξεχωριστή μεταγενέστερη φάση/ADR** — δεν μπλέκεται με τη δουλειά της μονάδας |
| 7 | Ενιαίο vs χωριστό input/display | **ΕΝΑ setting** (input-unit = display-unit), Revit/AutoCAD-style. *Απόφαση agent — συνεπές με την «πλήρη εναρμόνιση»· δύο ανεξάρτητες ρυθμίσεις θα ήταν ακριβώς η ασυνέπεια που καταργούμε* |
| 8 | 3Δ καμβάς | **Κανένας ξεχωριστός χειρισμός** — ακολουθεί ήδη τον ίδιο επιλογέα μέσω `move-readout`. *Απόφαση agent* |
| 9 | Ακρίβεια δεκαδικών σε `m` | **3 δεκαδικά** — `DEFAULT_DISPLAY_PRECISION['m'] = 3`. Έτσι το `0,895` εκφράζει 895mm· με 2 δεκαδικά θα χανόταν το χιλιοστό |
| 10 | Migration υπαρχόντων χρηστών | **ΔΕΝ ΧΡΕΙΑΖΕΤΑΙ.** Ο Giorgio είναι ο **μοναδικός χρήστης** και η εφαρμογή **δεν έχει βγει σε παραγωγή** (2026-07-18). Καμία μηχανική one-time reset / data migration — απλή αλλαγή default |

### 6.1 Γιατί ΑΠΟΡΡΙΦΘΗΚΕ το shortcut κύκλου μονάδας (αναθεώρηση απόφασης #5, Φάση 1)

Η αρχική απόφαση #5 προέβλεπε **dropdown + shortcut κύκλου** `mm→cm→m`. Στην αρχή της Φάσης 1 ελέγχθηκε
έναντι του πήχη «πρακτική των μεγάλων» και **απορρίφθηκε το shortcut**. Ο Giorgio επιβεβαίωσε (2026-07-18).

**Κανένας από τους μεγάλους δεν εναλλάσσει μονάδα με πλήκτρο:**

| Εργαλείο | Πώς αλλάζει η μονάδα |
|---|---|
| Revit | `UN` → **ανοίγει** το *Project Units* dialog |
| AutoCAD | εντολή `UNITS` → dialog |
| ArchiCAD | Options → Project Preferences → Working Units |

**Ο λόγος είναι σημασιολογικός, όχι αισθητικός.** Μετά την απόφαση #7 (ΕΝΑ setting: input-unit =
display-unit), η μονάδα **δεν είναι πια ρύθμιση εμφάνισης — είναι ο διερμηνέας κάθε επόμενου αριθμού
που πληκτρολογείς**. Ένα hotkey που την αλλάζει σιωπηλά σημαίνει ότι ένα κατά λάθος πάτημα κάνει το
`3` να γίνει 3mm αντί για 3m, **χωρίς κανένα ορατό σφάλμα** — η οντότητα δημιουργείται κανονικά, απλώς
1000× λάθος, και το ανακαλύπτεις όταν μετρήσεις. Αυτή είναι ακριβώς η κατηγορία σιωπηλής καταστροφής
που τα CAD αποφεύγουν κλειδώνοντας τη μονάδα **ανά project**.

Συμφωνεί επίσης με την **απόφαση #4** (project-scoped persistence): αν η μονάδα ταξιδεύει με το project,
τότε είναι ιδιότητα του project — όχι κατάσταση που εναλλάσσεται μέσα στη ροή εργασίας.

**Συνέπειες:** το βήμα 3 της Φάσης 1 (shortcut) **διαγράφηκε**· δεν προστέθηκε εγγραφή στο
`config/keyboard-shortcuts.ts`, δεν χρειάστηκαν νέα i18n keys, δεν γράφτηκε 5ος τοπικός cycle helper
(βλ. §8.1 — υπάρχουν ήδη 4 αντίγραφα του `(idx+1)%len`, ένα ακόμη θα ήταν sibling clone / N.18).
Το υπάρχον `DisplayUnitSelector` dropdown (`CadStatusBar.tsx:160,400-434) παραμένει το **μοναδικό**
σημείο αλλαγής μονάδας.

---

**⚠️ Συνέπεια της απόφασης #1+#3 που έγινε δεκτή συνειδητά:** το G1 (mm-native πλάτος κουφώματος) είχε μπει ως **σκόπιμο fix την ίδια μέρα (2026-07-18)**. Η απόφαση #2/#3 το **αναιρεί**. Αν στην πράξη αποδειχθεί δύσχρηστο (πληκτρολόγηση `0.9` αντί `900`), επανεξετάζεται — τεκμηριωμένο εδώ ώστε να μη χαθεί το ιστορικό.

---

## 7. Πλάνο υλοποίησης (μία φάση = μία συνεδρία, ≤70% context)

**Καμία φάση δεν απαιτεί νέο store — όλα plug-άρουν στο υπάρχον `displayUnitState` / `useDisplayUnit` / `config/units.ts`.**

**Φάση 1 — Default `m`.** ✅ **ΟΛΟΚΛΗΡΩΘΗΚΕ 2026-07-18.**
`config/units.ts`: `DEFAULT_DISPLAY_UNIT` `'cm'` → `'m'`. Το `DEFAULT_DISPLAY_PRECISION['m']` βρέθηκε
**ήδη `3`** (όπως και τα `DEFAULT_AREA_PRECISION['m']` / `DEFAULT_COORDINATE_PRECISION['m']`) — καμία
αλλαγή τιμής, μόνο σχόλιο που καθιστά ρητό ότι το `3` είναι φέρον (απόφαση #9) και όχι καλλωπιστικό.
Το shortcut κύκλου **διαγράφηκε** (§6.1) → μηδέν νέα i18n keys, μηδέν εγγραφή στο shortcut registry.
Tests: 6 νέα anchors στο υπάρχον `config/__tests__/units-format.test.ts`.

**Φάση 2 — Εναρμόνιση εξαιρέσεων (G1 + G2 + G7).**
- G1: `opening-width-ring-config.ts` → από `valueMm` σε `lengthDisplayToSceneLock` (ίδιο μοτίβο με `lengthRingField`).
- G2: `grip-step-quantize.ts` + `CadStatusBar` step field → `unitSuffix` από `currentDisplayUnitLabel()`, τιμή μέσω `fromDisplay`· τα presets μετατρέπονται στη display μονάδα.
- G7: ribbon numeric comboboxes διαστάσεων → presets μέσω `toDisplay`, commit μέσω `fromDisplay`.
- ⚠️ **Απαιτεί SSoT audit πρώτα** (N.0.2): τα 3 σημεία μοιράζονται το ίδιο idiom → πιθανός κοινός helper αντί τριπλότυπου. `npm run jscpd:diff` πριν το «done» (N.18).

**Φάση 3 — Καθαρισμός (G3 + G5).**
Αφαίρεση ή διόρθωση του legacy Ctrl+L path στο `DynamicInputOverlay.tsx` (latent 100× bug· επιβεβαίωση ότι είναι όντως unreachable πριν τη διαγραφή). Διόρθωση stale σχολίου `StairToThreeConverter.ts:9`.

**Φάση 4 — Project-scoped persistence (G6).**
Firestore `projects/{id}/dxfSettings.displayUnit` με localStorage ως fallback. Προσοχή: **CHECK 3.10** (queries με `where()` θέλουν `companyId`) και **N.6** (enterprise IDs, `setDoc` όχι `addDoc`). Precedence: project → localStorage → default.

**Φάση 5 — ΞΕΧΩΡΙΣΤΟ ADR: σκάλες σε canonical-mm (G4).**
Δεν ανήκει σε αυτό το ADR. Θα χρειαστεί persisted `sceneUnits` στο `StairParams`, κατάργηση του `inferSceneUnitsFromWidth` heuristic, και data migration για υπάρχουσες σκάλες. Ενημέρωση `.claude-rules/pending-ratchet-work.md:481` (που σήμερα λέει «leave as-is»).

### Ρίσκα / σημεία προσοχής
- **Ακρίβεια σε μέτρα:** ΛΥΜΕΝΟ — `DEFAULT_DISPLAY_PRECISION['m'] = 3` (απόφαση #9). Έλεγχος ότι τα 3 δεκαδικά δεν σπάνε locale formatting (`FormatterRegistry`) ούτε τα parseable editable inputs (`formatDisplayValue`).
- **Καμία ανησυχία migration:** μοναδικός χρήστης, μη-παραγωγική εφαρμογή (απόφαση #10). Το μόνο πρακτικό: το προσωπικό `localStorage['dxf:displayUnit']` του Giorgio μπορεί να κρατά ήδη `'cm'` — τότε απλά επιλέγει `m` μία φορά από το dropdown, ή καθαρίζει το key. **Δεν γράφουμε κώδικα migration γι' αυτό.**
- **CHECK 6D/6B:** πολλά από τα αγγιζόμενα αρχεία είναι render-path → απαιτούν staged ADR στο commit.
- **N.17:** κανένα `tsc` από τον πράκτορα σε καμία φάση.
- **N.18:** `npm run jscpd:diff` πριν από κάθε «done», ιδίως στη Φάση 2 (3 παρόμοια σημεία = ρίσκο sibling clone).

---

## 7β. Ανοιχτά ερωτήματα

**Κανένα.** Όλα τα ερωτήματα απαντήθηκαν στο Q&A της 2026-07-18. Το ADR είναι έτοιμο για υλοποίηση Φάσης 1.

---

## 8. Αρχεία-κλειδιά (SSoT map)

| Σκοπός | Αρχείο |
|---|---|
| mm↔scene↔metres πίνακας | `src/subapps/dxf-viewer/utils/scene-units.ts` |
| Import-time canonical-mm scaling | `src/subapps/dxf-viewer/utils/dxf-scene-builder.ts` |
| Display-unit pure conversions/const | `src/subapps/dxf-viewer/config/units.ts` |
| Display-unit persisted live store | `src/subapps/dxf-viewer/config/display-unit-state.ts` |
| React binding + live redraw | `src/subapps/dxf-viewer/hooks/common/useDisplayUnit.ts` |
| Read-only formatter chokepoint | `src/subapps/dxf-viewer/config/display-length-format.ts` |
| UI toggle (status bar) | `src/subapps/dxf-viewer/statusbar/CadStatusBar.tsx` (`DisplayUnitSelector`) |
| Ring input → scene lock (creation & grip) | `src/subapps/dxf-viewer/systems/dynamic-input/radial-ring-logic.ts` (`lengthDisplayToSceneLock`), `ring-config.ts`, `grip-linear-ring-config.ts` |
| Opening-width mm-native ring (G1) | `src/subapps/dxf-viewer/systems/dynamic-input/opening-width-ring-config.ts` |
| Βήμα F9 mm-native (G2) | `src/subapps/dxf-viewer/bim/grips/grip-step-quantize.ts` |
| Legacy Ctrl+L (G3) | `src/subapps/dxf-viewer/systems/dynamic-input/components/DynamicInputOverlay.tsx` |
| Entity-native unit factor (wall↔stair divergence) | `src/subapps/dxf-viewer/bim/utils/entity-unit-factor.ts` |
| Σκάλες (G4/G5) | `bim/types/stair-types.ts`, `hooks/drawing/stair-completion.ts`, `bim-3d/converters/StairToThreeConverter.ts` |
| 3Δ mm→m converters | `src/subapps/dxf-viewer/bim-3d/converters/BimToThreeConverter.ts`, `bim-three-structural-converters.ts`, `bim-3d/viewport/coordinate-transforms.ts` |
| 3Δ gizmo → command delta | `src/subapps/dxf-viewer/bim-3d/animation/bim3d-edit-command-builders.ts` |

### 8.1 Ευρήματα SSoT audit (Φάση 1, 2026-07-18) — για τις επόμενες φάσεις

Καταγράφονται εδώ ώστε οι Φάσεις 2-4 να μην ξανακάνουν το ίδιο grep ούτε να χτίσουν παράλληλο σύστημα.

| Ερώτημα | Εύρημα | Συνέπεια |
|---|---|---|
| Ποιος καταναλώνει το `DEFAULT_DISPLAY_UNIT`; | **Μόνο** `config/display-unit-state.ts:37,40` + 1 test. Κανένα hardcoded `'cm'` πουθενά αλλού στο `src/`. | Η αλλαγή default = **μία σταθερά**, χωρίς παρενέργειες. Επιβεβαιώνει το §1 («ήδη ~85% χτισμένο»). |
| Χρειάζεται συντονισμένη αλλαγή precision; | **ΟΧΙ.** `DEFAULT_DISPLAY_PRECISION['m']`, `DEFAULT_AREA_PRECISION['m']`, `DEFAULT_COORDINATE_PRECISION['m']` ήταν **ήδη `3`**. | Η απόφαση #9 ήταν de facto ήδη ικανοποιημένη· προστέθηκε μόνο anchor + σχόλιο ώστε να μη γυρίσει σε 2. |
| Υπάρχει registry shortcuts; | ✅ **ΝΑΙ, κανονικό SSoT:** `config/keyboard-shortcuts.ts` (`ShortcutDefinition` → `ALL_DXF_SHORTCUTS`). Τα F7-F11 στο `DXF_FUNCTION_SHORTCUTS:557-637`, wiring σε **ένα** σημείο: `statusbar/CadStatusBar.tsx:50-65`. Ελεύθερα: F1/F4/F5/F6 (F12 σκόπιμα δεσμευμένο — DevTools). | Αν ΠΟΤΕ χρειαστεί shortcut σε αυτό το ADR, μπαίνει **εκεί** — ποτέ νέο σύστημα. |
| Υπάρχει γενικός «επόμενη τιμή σε λίστα» helper; | ❌ **ΟΧΙ.** 4 τοπικά αντίγραφα του `(idx+1)%len`: `systems/grip/grip-mode-cycle.ts:45`, `hooks/useBimMaterialCycler.ts:70`, `hooks/drawing/use-column-anchor-tab-cycle.ts:41`, `systems/selection/use-selection-cycling.ts`. | Ένα 5ο αντίγραφο = sibling clone (N.18). Αυτό βάρυνε στην απόρριψη του shortcut (§6.1). **Υποψήφιο για κεντρικοποίηση σε άσχετη φάση** — δεν ανήκει σε αυτό το ADR. |
| Κόβει το locale formatting τα 3 δεκαδικά; | ❌ ΟΧΙ. `display-length-format.ts:96,134,147` περνούν `precision` παραμετρικά στον `FormatterRegistry` (ADR-082). | Κανένα ρίσκο από την απόφαση #9. |

---

## 9. Changelog

- **2026-07-18 (Opus 4.8) — ✅ ΦΑΣΗ 1 ΥΛΟΠΟΙΗΘΗΚΕ + η απόφαση #5 ΑΝΑΘΕΩΡΗΘΗΚΕ.** `config/units.ts`: `DEFAULT_DISPLAY_UNIT` `'cm'` → **`'m'`** (η μοναδική αλλαγή συμπεριφοράς). **Το shortcut κύκλου μονάδας ΑΠΟΡΡΙΦΘΗΚΕ** (νέο §6.1, εγκρίθηκε από τον Giorgio): κανένας από τους μεγάλους δεν εναλλάσσει μονάδα με πλήκτρο (Revit `UN`→dialog, AutoCAD `UNITS`→dialog, ArchiCAD→Preferences), και μετά την απόφαση #7 (input-unit = display-unit) η μονάδα διερμηνεύει **κάθε πληκτρολογούμενο αριθμό** — ένα κατά λάθος πάτημα θα έκανε το `3` να γίνει 3mm αντί 3m σιωπηλά. **SSoT audit πριν τον κώδικα (νέο §8.1):** το `DEFAULT_DISPLAY_PRECISION['m']` ήταν **ήδη 3** (καμία αλλαγή τιμής — μόνο σχόλιο + anchor)· ο μόνος καταναλωτής του default είναι το `display-unit-state.ts` (κανένα hardcoded `'cm'`)· βρέθηκε το κανονικό shortcut registry (`config/keyboard-shortcuts.ts`) και **4 υπάρχοντα αντίγραφα** cycle-helper — ένα 5ο θα ήταν sibling clone. **Μηδέν νέα i18n keys, μηδέν νέο store, μηδέν νέο σύστημα.** Tests: +6 anchors στο υπάρχον `config/__tests__/units-format.test.ts` (default=`m`, precision 3 σε length/area/coordinate, round-trip 895mm↔0.895m, BIM πλάτη 700/800/900/2500/3000/12345, «τυπωμένο 3 = 3 μέτρα», ανά-χιλιοστό σάρωση 890-910mm). **472/472 πράσινα** σε 35 suites (units, display-length-format, dimensions, move-readout, ribbon bridge, persist smoke). `jscpd:diff` καθαρό. Δεν έγινε commit (N.-1).
- **2026-07-18 (Opus 4.8) — Q&A γύρος 2: ΟΛΑ ΤΑ ΕΡΩΤΗΜΑΤΑ ΚΛΕΙΣΑΝ.** `DEFAULT_DISPLAY_PRECISION['m'] = **3 δεκαδικά**` (ώστε το 0,895 να εκφράζει 895mm). **Καμία μηχανική migration** — ο Giorgio είναι ο μοναδικός χρήστης και η εφαρμογή δεν έχει βγει σε παραγωγή· η αλλαγή default είναι απλή αλλαγή σταθεράς. §7β = κανένα ανοιχτό ερώτημα· έτοιμο για Φάση 1.
- **2026-07-18 (Opus 4.8) — Q&A Giorgio → ΑΠΟΦΑΣΕΙΣ κλειδώθηκαν (§6) + πλάνο 5 φάσεων (§7).** Default → **μέτρα**· **πλήρης εναρμόνιση** όλων των πεδίων εισόδου (αναιρεί συνειδητά το mm-native opening-width fix της ίδιας μέρας)· **project-scoped Firestore** persistence· **dropdown + shortcut κύκλου**· σκάλες (G4) → **ξεχωριστό μεταγενέστερο ADR**. Δύο αποφάσεις πάρθηκαν από τον agent (ενιαίο input=display unit· 3Δ χωρίς ξεχωριστό χειρισμό) — σημειωμένες ως τέτοιες. Παραμένουν ανοιχτά: ακρίβεια δεκαδικών σε `m`, one-time reset localStorage. **Καμία αλλαγή κώδικα ακόμη.** Δεν έγινε commit (N.-1).
- **2026-07-18 (Opus 4.8) — ADR δημιουργήθηκε (Phase 1 Recognition, N.0.1).** 5-agent orchestrated audit (units SSoT / 2Δ creation / 3Δ scene / move-grip / UI) κατέγραψε την τρέχουσα κατάσταση του κώδικα: το ζητούμενο user-selectable input-unit feature είναι ήδη ~85% υλοποιημένο μέσω του display-unit stack (ADR-462 Phase 2 / ADR-357 §5.5). Καταγράφηκαν 7 ασυνέπειες/κενά (G1–G7) + 3 επιλογές πορείας + 7 ανοιχτά ερωτήματα. **Καμία αλλαγή κώδικα** — pending αποφάσεις Q&A. Δεν έγινε commit (N.-1).
