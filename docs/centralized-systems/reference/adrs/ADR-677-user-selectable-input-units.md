# ADR-677 — Επιλογή Μονάδας από τον Χρήστη (mm/cm/m) για Δημιουργία / Μετακίνηση / Μετασχηματισμό Οντοτήτων

**Status:** 🚧 ΣΕ ΕΞΕΛΙΞΗ — **Φάσεις 1 + 2α + 2β + 2γ ✅** (2026-07-18) · **pending Φάση 2δ** (η μονάδα λείπει από την αριστερή παλέτα Ιδιοτήτων + τα advanced panels — βλ. §7), 3, 4 · Discovery: 2026-07-18 (Opus 4.8, 5-agent orchestrated audit)
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
| Δημιουργία — πλάτος κουφώματος (opening-width ring) | display unit | ✅ ΝΑΙ (Φάση 2α — G1 έκλεισε) |
| Μετακίνηση/grip-drag/stretch — direct-distance | display unit | ✅ ΝΑΙ |
| HUD μήκους/γωνίας (drag) | display unit | ✅ ΝΑΙ |
| Ruler ticks / dimension pills / entity labels / X-Y readout | display unit | ✅ ΝΑΙ |
| Βήμα snap F9 («βήμα») | display unit (store μένει mm) | ✅ ΝΑΙ (Φάση 2α — G2 έκλεισε) |
| Ribbon comboboxes διαστάσεων («Πλάτος» 700/800/900…) | display unit (presets μένουν mm) | ✅ ΝΑΙ (Φάση 2β — G7 έκλεισε) |
| Ribbon comboboxes — **ένδειξη** μονάδας στην οθόνη | σύμβολο μέσα στο πεδίο, δυναμικό | ✅ ΝΑΙ (Φάση 2γ — 13 ετικέτες «(mm)» καθαρίστηκαν) |
| **Αριστερή παλέτα Ιδιοτήτων** — Γεωμετρία γραμμής (Μήκος/Γωνία/Αρχή/Τέλος/Δ) | display unit (μετατροπή στον bridge) | ⚠️ ΤΙΜΗ ναι, **ΕΝΔΕΙΞΗ όχι** (βλ. Φάση 2δ) |
| Ribbon comboboxes πλήθους / μοιρών / ποσοστού / DN | αυτούσια, **by design** | ➖ Δ/Υ — δεν είναι μήκη (§7.2) |
| Ribbon comboboxes μεγεθών ΧΑΡΤΙΟΥ (ύψος κειμένου, βέλη) | mm χαρτιού, σταθερά | ➖ Δ/Υ — paper-length, όπως στο Revit (§7.2) |
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

**Φάση 2α — Εναρμόνιση G1 + G2.** ✅ **ΟΛΟΚΛΗΡΩΘΗΚΕ 2026-07-18.**
- **G1:** το `opening-width-ring-config.ts` **δεν μετατράπηκε — απλοποιήθηκε**. Το bespoke `openingWidthMmField` ήταν structural clone του κοινού `lengthRingField` με μόνη διαφορά τη μονάδα, οπότε **διαγράφηκε ολόκληρο** και το config καλεί πλέον τον κοινό builder. Το G1 ήταν ταυτόχρονα unit-ασυνέπεια **και** διπλότυπο· μία διαγραφή έλυσε και τα δύο (N.0.2 / N.18).
- **G2:** το βήμα F9 άλλαξε **μόνο στο σύνορο UI** (`CadStatusBar.SnapToggleWithStep`): presets + τιμή + `unitSuffix` περνούν από `toDisplay`/`fromDisplay`/`DISPLAY_UNIT_LABELS`. Το `cad-toggle-state` και το `grip-step-quantize.ts` **παραμένουν καθαρά mm** — κανένα quantization δεν έμαθε για display units (canonical-mm ακέραιο, ADR-462).
- **i18n διόρθωση:** το `cadDock.statusBar.snapStepTitle` έγραφε **«Βήμα πρόσδεσης (mm)» / «Snap step (mm)»** — hardcoded μονάδα σε label που πλέον ψεύδεται. Αφαιρέθηκε το `(mm)` σε el **και** en· η μονάδα φαίνεται δυναμικά στο `unitSuffix`.

**Φάση 2β — G7 (ribbon numeric comboboxes).** ✅ **ΟΛΟΚΛΗΡΩΘΗΚΕ 2026-07-18.** Δρόμος Β, με μία
ουσιώδη αναθεώρηση του σχεδίου που προέκυψε από το audit (§7.2).

- **Το σύνορο μπήκε σε ΕΝΑ σημείο** — `RibbonCombobox.tsx`, πάνω από τη διακλάδωση editable/Select
  ώστε να καλύπτει και τα `editable:false` αριθμητικά πεδία. Μετατρέπονται: preset ladder, τρέχουσα
  τιμή, `min`/`max` όρια (δηλωμένα σε mm), και το commit πίσω σε mm.
- **Κανένα από τα preset arrays δεν άλλαξε.** Τα mm έμειναν mm στα data αρχεία, όπως ορίζει ο δρόμος Β.
- **Νέο SSoT μετατροπής:** `ui/ribbon/units/ribbon-display-unit.ts`. Το `toDisp`/`fromDisp` του
  Line-Tool bridge **μετακόμισε εκεί** (re-export για σταθερότητα διαδρομής) — δεύτερη δήλωση θα ήταν
  ακριβώς το sibling clone που κυνηγά το CHECK 3.28 (N.18).
- **Ταξινόμηση αντί boolean flag:** κάθε αριθμητικό combobox δηλώνει `numericInput.quantityKind`
  (`RibbonQuantityKind`). Μόνο το `'model-length'` μετατρέπεται· κάθε άλλη κατηγορία —
  **και η απουσία δήλωσης** — περνά αυτούσια. Ο λόγος της ασυμμετρίας στο §7.2.
- **Κάλυψη:** 188 δηλώσεις σε 39 αρχεία (112 `model-length`, 76 μη-διαστατικά).
- **Κατάλογος tabs σε pure module:** ο inline κατάλογος του `app/ribbon-contextual-config.ts`
  εξήχθη στο `ui/ribbon/data/contextual-tabs-registry.ts`, ώστε το anchor να διατρέχει κάθε
  contextual tab χωρίς να φορτώνει React/5 zustand stores.
- **Tests:** `ui/ribbon/units/__tests__/ribbon-display-unit.test.ts` (15) +
  `ui/ribbon/data/__tests__/ribbon-quantity-kind-coverage.test.ts` (9, εκ των οποίων ο έλεγχος
  πληρότητας). Regression: 66 suites / 726 tests πράσινα σε όλο το `ui/ribbon`.

**Φάση 2γ — το UI γύρω από τον μηχανισμό.** ✅ **ΟΛΟΚΛΗΡΩΘΗΚΕ 2026-07-18.**

1. **Οι 13 ετικέτες που έλεγαν ψέματα καθαρίστηκαν** (el **και** en) — ίδιο ακριβώς σφάλμα με το
   `snapStepTitle` της Φάσης 2α, σε 13 σημεία (`stairEditor.waistThickness`, `floorFinishEditor.*`,
   `mepUnderfloorEditor.*`, `wallCoveringEditor.height`, `thermalSpaceEditor.ceilingHeightMm` κ.ά.).
   **Τρία «(mm)» έμειναν ανέγγιχτα γιατί λένε αλήθεια:** `connectorDiameter` (DN καταλόγου) +
   `scaleBar.barHeight/labelHeight` (χιλιοστά **χαρτιού**).
2. **Η μονάδα φαίνεται πλέον μέσα στο πεδίο** (Revit «900.0 mm»): `unitSuffixFor(kind, unit)` στο
   `ribbon-display-unit.ts` → `RibbonCombobox` → νέο prop `unitSuffix` του `RibbonEditableCombobox`.
   Το σύμβολο **δεν είναι i18n** — είναι φυσική σημειογραφία όπως το «°», SSoT `DISPLAY_UNIT_LABELS`
   (N.11 αφορά μεταφράσιμο κείμενο). Εμφανίζεται **μόνο** σε `model-length` και **μόνο** όταν το πεδίο
   διαβάζεται αριθμητικό — στη μεικτή επιλογή «—» θα σχολίαζε το τίποτα. Ίδιος κανόνας με το
   `StatusBarEditableCombobox` («Ελεύθερο» κρύβει το suffix). Η μονάδα μπαίνει **και** στο accessible
   name του input: το ορατό σύμβολο είναι `aria-hidden`, οπότε χωρίς αυτό ένας χρήστης screen reader
   θα άκουγε σκέτο «Πλάτος 0.900» — η αφαίρεση του «(mm)» θα ήταν καθαρή απώλεια γι' αυτόν.
3. **Το combobox ΣΥΝΔΡΟΜΕΙ πλέον στη μονάδα** (`useDisplayUnit`), δεν την διαβάζει μόνο. Η Φάση 2β
   καλούσε `toDisp`, που ρωτά το `displayUnitState` την ώρα του render· **χωρίς συνδρομή ένα ανοιχτό
   ribbon συνέχιζε να δείχνει χιλιοστά** μετά την αλλαγή μονάδας, ώσπου κάτι άλλο να προκαλέσει
   re-render. Low-frequency store (κλικ στη status bar, όχι ανά frame) → εκτός της απαγόρευσης
   ADR-040, και το combobox **είναι** leaf, όχι orchestrator.

**Η θωράκιση διπλής μετατροπής άλλαξε στόχο — το handoff ήταν μπαγιάτικο.** Το σχέδιο έλεγε «τα 8
Geometry keys έχουν `options: []` άρα δεν πήραν δήλωση». Το anchor βγήκε **κενό**: τα 8 πεδία **δεν
είναι καθόλου ribbon commands** — μετακόμισαν στην **αριστερή παλέτα Ιδιοτήτων** (ADR-510 Φ2E #5,
«geometry = Ctrl+1, ποτέ ribbon»). Ένα anchor που φιλτράρει άδειο σύνολο περνά για πάντα χωρίς να
ελέγχει τίποτα (ADR-587 §6.1: «anchor χωρίς gate είναι σχόλιο» — εδώ, anchor χωρίς **αντικείμενο**).
Γράφτηκαν δύο **αληθινά** anchors στη θέση του:
- **κανένα** Geometry key δεν είναι ribbon command (πιάνει την επιστροφή τους στο ribbon)·
- **κανένα** Geometry πεδίο της παλέτας δεν δηλώνει `quantityKind` — ο τύπος το επιτρέπει συντακτικά,
  αλλά η παλέτα **δεν** εφαρμόζει το σύνορο, οπότε η δήλωση θα ήταν ψέμα που δεν κάνει τίποτα: ο
  επόμενος που θα καλωδιώσει τη μονάδα εκεί θα την εμπιστευόταν και θα διπλασίαζε τη μετατροπή.

**Tests:** +5 στο `ribbon-display-unit.test.ts` (unitSuffixFor ανά kind), +5 νέο
`RibbonEditableCombobox.unit-suffix.test.tsx` (ορατό σύμβολο, accessible name, κρύψιμο σε μεικτή/
χωρίς-μονάδα, presets dropdown), +7 στο `ribbon-quantity-kind-coverage.test.ts` — εκ των οποίων ο
**φύλακας των ετικετών**: καμία ετικέτα `model-length` πεδίου δεν επιτρέπεται να περιέχει μονάδα, σε
el **και** en. Η διόρθωση των 13 ήταν διόρθωση· **αυτό** είναι η εγγύηση ότι δεν θα ξανασυμβεί σιωπηλά
όταν κάποιος αντιγράψει παλιά ετικέτα σε νέο πεδίο. **67 suites / 753 tests πράσινα** στο `ui/ribbon`.

**Ρίζα του κενού #1:** το checklist ρωτούσε «χρειάστηκαν **νέα** i18n keys;» (όχι) αντί για «ποια
**υπάρχοντα** keys αχρηστεύει η αλλαγή;» (13). Η αλλαγή μονάδας δεν προσθέτει κείμενο — **ακυρώνει**
υπάρχον. Κάθε μελλοντική φάση μονάδων πρέπει να κάνει το δεύτερο ερώτημα.

**Φάση 2δ — η ίδια ασυνέπεια στις υπόλοιπες επιφάνειες.** ⏳ **ΕΚΚΡΕΜΕΙ.**
Το σύνορο της Φάσης 2β/2γ καλύπτει **μόνο** το ribbon. Ανοιχτά, με φθίνουσα σοβαρότητα:
- **Αριστερή παλέτα Ιδιοτήτων — Γεωμετρία γραμμής**: η τιμή έρχεται ήδη σε display unit (ο bridge
  κάνει `toDisp`), αλλά ο `EntityPropertyRow.EditableRow` **δεν δείχνει καμία μονάδα** — σκέτο «0.900».
  Ακριβώς το πρόβλημα #2 της 2γ, σε άλλη επιφάνεια.
- **Advanced panels / dialogs / reports**: ~41 κλειδιά με «(mm)» (`stairAdvancedPanel`,
  `beamAdvancedPanel`, `wallAdvancedPanel`, `columnDetail`, `thermalStudyReport`, `viewRange`,
  `autoDimension`, `multiSelection.properties`). Αυτά **δεν** πέρασαν από το σύνορο — δείχνουν όντως
  χιλιοστά, άρα οι ετικέτες τους λένε **αλήθεια**. Είναι κενό **εναρμόνισης**, όχι ψέματος: το ίδιο
  μέγεθος εμφανίζεται σε μέτρα στο ribbon και σε χιλιοστά στο panel.

**Φάση 3 — Καθαρισμός (G3 + G5).**
Αφαίρεση ή διόρθωση του legacy Ctrl+L path στο `DynamicInputOverlay.tsx` (latent 100× bug· επιβεβαίωση ότι είναι όντως unreachable πριν τη διαγραφή). Διόρθωση stale σχολίου `StairToThreeConverter.ts:9`.

**Φάση 4 — Project-scoped persistence (G6).**
Firestore `projects/{id}/dxfSettings.displayUnit` με localStorage ως fallback. Προσοχή: **CHECK 3.10** (queries με `where()` θέλουν `companyId`) και **N.6** (enterprise IDs, `setDoc` όχι `addDoc`). Precedence: project → localStorage → default.

**Φάση 5 — ΞΕΧΩΡΙΣΤΟ ADR: σκάλες σε canonical-mm (G4).**
Δεν ανήκει σε αυτό το ADR. Θα χρειαστεί persisted `sceneUnits` στο `StairParams`, κατάργηση του `inferSceneUnitsFromWidth` heuristic, και data migration για υπάρχουσες σκάλες. Ενημέρωση `.claude-rules/pending-ratchet-work.md:481` (που σήμερα λέει «leave as-is»).

### 7.1 Γιατί το G7 χωρίστηκε σε δική του φάση (2β) — και ο δρόμος που επιλέχθηκε

Το SSoT audit της Φάσης 2 ανέτρεψε την εκτίμηση του §5 G7 («ribbon comboboxes διαστάσεων»).
Η πραγματική επιφάνεια είναι **92 hardcoded mm preset arrays σε 25 αρχεία** στο
`ui/ribbon/data/contextual-*-tab.ts` (κουφώματα, υποστυλώματα, δοκοί, θεμελιώσεις, πλάκες, στέγες,
σκάλες, 15 MEP tabs, ηλεκτρικοί πίνακες). Επιπλέον, όλο το stack είναι **unit-blind by construction**:
ούτε το `RibbonComboboxOption` (`ui/ribbon/types/ribbon-types.ts:34-49`) ούτε το
`RibbonEditableCombobox` έχουν πεδίο μονάδας ή format/parse callback.

**⚠️ Παγίδα που εντοπίστηκε:** τα 92 arrays **δεν είναι όλα μήκη** — περιέχουν `countOptions`
(πλήθος βαθμίδων), μοίρες (κλίση τοίχου), ποσοστά. Ένα τυφλό πέρασμα όλων μέσα από `toDisplay`
θα μετέτρεπε το «16 βαθμίδες» σε «0.016». Ο διαχωρισμός πρέπει να είναι **ρητός**, όχι κατά
όνομα μεταβλητής.

**Απόφαση Giorgio (2026-07-18): δρόμος Β — ένα σύνορο μονάδας, όχι 92 μετατροπές.**

| | Δρόμος Α (μετατροπή στην πηγή) | **Δρόμος Β (επιλέχθηκε)** |
|---|---|---|
| Τι αλλάζει | 92 arrays σε 25 αρχεία + prop contract | ~3 αρχεία υποδομής |
| Πού ζει η μονάδα | σε κάθε data αρχείο | **ένα** σημείο: `RibbonCombobox` dispatcher |
| Counts/μοίρες | χειροκίνητος διαχωρισμός ×92 | εξαιρούνται **by design** (opt-in flag) |

Τα presets **μένουν γραμμένα σε mm** — ένα κούφωμα 900mm είναι φυσικό μέγεθος προϊόντος, όχι
προτίμηση εμφάνισης (ίδια λογική με τα Revit type names «0915 x 2134mm»). Ο μετατροπέας μπαίνει
στο `RibbonCombobox.tsx:156-172`: mm → display unit στο render, display → mm στο commit. Ποια
commands είναι διαστατικά δηλώνεται **ρητά** με flag στο command definition.

Precedent για το μοτίβο: `ui/ribbon/hooks/useRibbonLineToolBridge.helpers.ts:155-162`
(`toDisp`/`fromDisp`) — το μοναδικό ήδη unit-aware σημείο του ribbon.

### 7.2 Τι ανέτρεψε το audit της Φάσης 2β — από boolean flag σε ταξινόμηση ποσότητας

Το §7.1 προδιέγραφε «opt-in flag ανά command» και άφηνε ανοιχτό το ερώτημα *αν η αναλογία
διαστατικών/μη-διαστατικών αντιστρέφει τη σχεδίαση*. Η πλήρης σάρωση των 42 αρχείων απάντησε και
τα δύο — και άλλαξε τη μορφή της δήλωσης.

**Εύρημα 1 — καμία πλευρά δεν είναι «λίγη».** 191 αριθμητικά comboboxes: **112 διαστατικά, 79
μη-διαστατικά**. Το πλήθος δεν μπορεί να κρίνει την κατεύθυνση (η υπόθεση «αν είναι ~90, αντίστρεψε»
προϋπέθετε φθηνή πλευρά· δεν υπάρχει). **Την κρίνει η ασυμμετρία της αστοχίας:**

| | Ξεχνώ δήλωση σε **opt-in** | Ξεχνώ εξαίρεση σε **opt-out** |
|---|---|---|
| Αποτέλεσμα | το πεδίο μένει σε mm | «16 βαθμίδες» → «0.016» |
| Ορατότητα | άμεσα ορατό δίπλα στα διπλανά πεδία | σιωπηλό |
| Ζημιά | καμία — λάθος ένδειξη | **αλλοίωση δεδομένων** |

Άρα opt-in, ανεξάρτητα από το ότι είναι οι 112 και όχι οι 79. Το ίδιο σκεπτικό είναι γραμμένο και
στο doc-comment του `RibbonQuantityKind`, ώστε να μην «βελτιστοποιηθεί» αργότερα από κάποιον που
μετράει μόνο γραμμές.

**Εύρημα 2 — υπάρχει ΤΡΙΤΗ κατηγορία που το §7.1 δεν προέβλεπε: μήκη ΧΑΡΤΙΟΥ.** Το `dim.text.height`
(2.5–10, ISO), το `dim.override.arrowSize` και το `text.font.height` **είναι** χιλιοστά — αλλά
χιλιοστά στο τυπωμένο φύλλο, όχι του κτιρίου. Ύψος κειμένου 2.5 mm μένει 2.5 mm όποια κι αν είναι η
μονάδα του έργου· έτσι ακριβώς συμπεριφέρονται τα annotation μεγέθη στο Revit. Ένα boolean
`isDimensional` θα τα κατέτασσε λάθος **και προς τις δύο κατευθύνσεις** (μήκη μεν, μη μετατρέψιμα δε)
και θα απαιτούσε δεύτερο flag. Στην ίδια κατηγορία προσετέθησαν και τα `scaleBar.barHeight` /
`labelHeight` (πάχος και ύψος αριθμών της γραφικής κλίμακας).

**Συνέπεια: `quantityKind` αντί boolean.** Κάθε πεδίο δηλώνει *τι ποσότητα είναι* — `model-length`,
`paper-length`, `screen-px`, `angle`, `count`, `percent`, `ratio`, `nominal-diameter`, `power`,
`pressure`, `temperature`, `volume`, `mass`, `dimensionless`. Αυτό είναι το μοντέλο του Revit
(κάθε παράμετρος δηλώνει Length / Angle / Number / Slope / Piping Diameter, με δικό της κανόνα στα
Project Units) και όχι δική μας επινόηση — ο πήχης «αν οι μεγάλοι δεν το προτείνουν, ακολουθούμε
τους μεγάλους». Πρακτικό κέρδος: όταν αύριο ζητηθούν μοίρες→βαθμοί ή W→kW, η υποδομή υπάρχει και
το μόνο που αλλάζει είναι ο μετατροπέας — όχι 191 δηλώσεις.

**Οι ονομαστικές διάμετροι (DN)** ταξινομήθηκαν ως `nominal-diameter`, όχι μήκος: το DN80 **ονομάζει**
προϊόν καταλόγου, δεν το μετράει — ίδιο ακριβώς σκεπτικό με το «κούφωμα 900mm = φυσικό μέγεθος
προϊόντος» που κράτησε τα presets σε mm.

**Ο έλεγχος πληρότητας.** Η opt-in σχεδίαση αγοράζει ασφάλεια με τίμημα «μπορεί να ξεχαστεί πεδίο»,
και σε ~190 πεδία που μεγαλώνουν, το μάτι δεν αρκεί. Το `ribbon-quantity-kind-coverage.test.ts`
διατρέχει κάθε contextual + default tab, εντοπίζει κάθε αριθμητικό combobox με το **ίδιο** κριτήριο
που χρησιμοποιεί ο dispatcher (`isNumericOptionList` — όχι ανεξάρτητη επανυλοποίηση) και απαιτεί ρητή
δήλωση. Παράλειψη = κόκκινο test, όχι παράπονο χρήστη (ADR-587 §6.1: «anchor χωρίς gate δεν είναι
anchor — είναι σχόλιο»). **Δηλωμένο όριο:** πεδία με δυναμική λίστα από bridge (`options: []`) δεν
έχουν στατική λίστα να επιθεωρηθεί· σήμερα κανένα τους δεν είναι διαστατικό.

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

- **2026-07-18 (Opus 4.8) — ✅ ΦΑΣΗ 2γ ΥΛΟΠΟΙΗΘΗΚΕ — το UI συμβαδίζει πλέον με τον μηχανισμό.** **(1)** Οι **13 ετικέτες** που έγραφαν «(mm)»/«(χιλ.)» ενώ το πεδίο έδειχνε μέτρα καθαρίστηκαν σε **el ΚΑΙ en** (26 γραμμές, μηδέν άλλη αλλαγή στα locale JSONs — επιβεβαιωμένο με byte-identical round-trip πριν την εγγραφή)· τα **3 σωστά «(mm)»** (DN καταλόγου + 2 μεγέθη **χαρτιού**) έμειναν ανέγγιχτα. **(2)** Νέο `unitSuffixFor(kind, unit)` στο `ribbon-display-unit.ts` → `RibbonCombobox` → prop `unitSuffix` του `RibbonEditableCombobox`: το σύμβολο ζωγραφίζεται **μέσα** στο πεδίο (Revit «900.0 mm»), μόνο σε `model-length`, μόνο όταν το πεδίο διαβάζεται αριθμητικό (η μεικτή επιλογή «—» δεν παίρνει μονάδα — ίδιος κανόνας με το «Ελεύθερο» του `StatusBarEditableCombobox`), και **μπαίνει και στο accessible name** του input γιατί το ορατό σύμβολο είναι `aria-hidden` — αλλιώς η αφαίρεση του «(mm)» θα ήταν καθαρή απώλεια για χρήστη screen reader. Το σύμβολο **δεν πήγε σε i18n**: φυσική σημειογραφία όπως το «°», SSoT `DISPLAY_UNIT_LABELS`. **(3) Βρέθηκε live bug της Φάσης 2β:** το combobox **διάβαζε** τη μονάδα (`toDisp` → `displayUnitState`) χωρίς να **συνδρομεί** — ένα ανοιχτό ribbon συνέχιζε να δείχνει χιλιοστά μετά την αλλαγή μονάδας ώσπου κάτι άλλο να προκαλέσει re-render· προστέθηκε `useDisplayUnit()` (low-frequency store, leaf — εκτός απαγόρευσης ADR-040). **(4) Η θωράκιση διπλής μετατροπής άλλαξε στόχο: το handoff ήταν λάθος.** Έλεγε «τα 8 Geometry keys έχουν `options: []` άρα δεν πήραν δήλωση»· στην πραγματικότητα **δεν είναι καθόλου ribbon commands** — μετακόμισαν στην αριστερή παλέτα (ADR-510 Φ2E #5). Το anchor όπως σχεδιάστηκε φιλτράριζε **άδειο σύνολο** και θα περνούσε για πάντα χωρίς να ελέγχει τίποτα· το έπιασε το δίχτυ ασφαλείας `expect(length).toBeGreaterThanOrEqual(8)` → `Received: 0`. Αντικαταστάθηκε από **δύο anchors με αντικείμενο**: κανένα Geometry key δεν είναι ribbon command· κανένα Geometry πεδίο της **παλέτας** δεν δηλώνει `quantityKind` (ο τύπος το επιτρέπει, η παλέτα δεν εφαρμόζει το σύνορο → η δήλωση θα ήταν ψέμα που δεν κάνει τίποτα). **(5) Νέο εύρημα → Φάση 2δ:** ο `EntityPropertyRow.EditableRow` της παλέτας δείχνει τη γεωμετρία σε display unit **χωρίς καμία ένδειξη μονάδας** — το ίδιο πρόβλημα #2, σε άλλη επιφάνεια. **Tests: +17** (5 `unitSuffixFor` ανά kind· 5 νέο `RibbonEditableCombobox.unit-suffix.test.tsx`· 7 στο coverage anchor, εκ των οποίων ο **φύλακας ετικετών** el+en που κάνει την επανάληψη του σφάλματος κόκκινο test). **67 suites / 753 tests πράσινα** σε όλο το `ui/ribbon`. `jscpd:diff` καθαρό στα 3 αρχεία κώδικα. **ΟΧΙ tsc (N.17).** Δεν έγινε commit (N.-1).
- **2026-07-18 (Opus 4.8) — ✅ ΦΑΣΗ 2β ΥΛΟΠΟΙΗΘΗΚΕ (G7) — δρόμος Β, με αναθεώρηση της μορφής της δήλωσης.** Το σύνορο μονάδας μπήκε σε **ΕΝΑ** σημείο (`RibbonCombobox.tsx`, πάνω από τη διακλάδωση editable/Select ώστε να πιάνει και τα `editable:false`): μετατρέπονται presets, τρέχουσα τιμή, `min`/`max` (δηλωμένα σε mm) και το commit επιστρέφει mm. **Κανένα preset array δεν άλλαξε** — ο πυρήνας παρέμεινε canonical-mm. Νέο SSoT `ui/ribbon/units/ribbon-display-unit.ts`· το `toDisp`/`fromDisp` του Line-Tool bridge **μετακόμισε** εκεί (re-export) αντί να δηλωθεί δεύτερη φορά (N.18). **Το audit ανέτρεψε δύο υποθέσεις του §7.1** (νέο §7.2): (α) η αναλογία είναι **112 διαστατικά / 79 μη**, δηλαδή **καμία φθηνή πλευρά** — άρα την κατεύθυνση την κρίνει η **ασυμμετρία της αστοχίας** (ξεχασμένο opt-in = μένει mm, ορατό, ακίνδυνο· ξεχασμένο opt-out = «16 βαθμίδες»→«0.016», σιωπηλή αλλοίωση), όχι το πλήθος· (β) βρέθηκε **τρίτη κατηγορία που δεν είχε προβλεφθεί — μήκη ΧΑΡΤΙΟΥ** (`dim.text.height` 2.5mm ISO, `arrowSize`, `text.font.height`, `scaleBar.barHeight/labelHeight`): είναι μήκη αλλά μένουν σταθερά, όπως τα annotation μεγέθη στο Revit. Ένα boolean `isDimensional` θα τα κατέτασσε λάθος **και προς τις δύο κατευθύνσεις**. Γι' αυτό το flag έγινε **ταξινόμηση `quantityKind`** 14 κατηγοριών (μοντέλο Revit «parameter type» → Project Units)· μόνο το `'model-length'` μετατρέπεται, **η απουσία δήλωσης δεν μετατρέπει**. Οι DN διάμετροι → `nominal-diameter` (ονομάζουν προϊόν καταλόγου, δεν το μετρούν — ίδιο σκεπτικό με το «κούφωμα 900mm»). **188 δηλώσεις σε 39 αρχεία** (112 `model-length`, 76 μη-διαστατικά), μέσω 6 παράλληλων agents με ρητή ταξινόμηση ανά command. **Έλεγχος πληρότητας** (`ribbon-quantity-kind-coverage.test.ts`): διατρέχει κάθε contextual + default tab με το **ίδιο** κριτήριο που χρησιμοποιεί ο dispatcher (`isNumericOptionList`, όχι επανυλοποίηση) και απαιτεί ρητή δήλωση — παράλειψη = κόκκινο test· δηλωμένο όριο τα bridge-driven `options: []`. Ο κατάλογος contextual tabs εξήχθη σε pure module (`contextual-tabs-registry.ts`) ώστε το anchor να τρέχει χωρίς React/stores. **66 suites / 726 tests πράσινα** σε όλο το `ui/ribbon` (+24 νέα). `jscpd:diff` καθαρό στα αρχεία υποδομής· στα data αρχεία τα ευρήματα αποδείχθηκαν **προϋπάρχοντα** (clones σε γραμμές 38-164, δικές μου αλλαγές από 84-256 και κάτω — `git diff -U0`), δηλαδή baseline-unaware θόρυβος, όχι νέα δίδυμα. Δεν έγινε commit (N.-1).
- **2026-07-18 (Opus 4.8) — ✅ ΦΑΣΗ 2α ΥΛΟΠΟΙΗΘΗΚΕ (G1 + G2)· το G7 χωρίστηκε σε Φάση 2β.** **G1:** το bespoke `openingWidthMmField` αποδείχθηκε structural clone του κοινού `lengthRingField` με μόνη διαφορά τη μονάδα → **διαγράφηκε ολόκληρο**· το `OPENING_WIDTH_RING_CONFIG` καλεί πλέον τον κοινό builder (unit-ασυνέπεια + διπλότυπο λύθηκαν με μία διαγραφή). **G2:** το βήμα F9 μετατρέπεται **μόνο στο σύνορο UI** (`CadStatusBar.SnapToggleWithStep` → `toDisplay`/`fromDisplay`/`DISPLAY_UNIT_LABELS`)· τα `cad-toggle-state` + `grip-step-quantize.ts` **μένουν καθαρά mm** — κανένα quantization δεν έμαθε για display units. **i18n:** το `snapStepTitle` έγραφε hardcoded «(mm)» και πλέον ψευδόταν → αφαιρέθηκε σε el **και** en. **Ο υπάρχων `opening-width-ring-config.test.ts` κατοχύρωνε το ΑΝΤΙΘΕΤΟ** (mm-native, 2026-07-18) → ξαναγράφτηκε ώστε να κωδικοποιεί την απόφαση #2/#3 **μαζί με ρητή προειδοποίηση «δεν είναι bug, είναι απόφαση»**, ώστε να μην αναιρεθεί κατά λάθος· +1 test παρότητας με τον κοινό builder. **489/489 πράσινα** (dynamic-input 268, grips+statusbar 221). `jscpd:diff` καθαρό. **Το G7 ΔΕΝ υλοποιήθηκε:** το audit βρήκε **92 preset arrays σε 25 αρχεία** (όχι «τα comboboxes Πλάτος») + unit-blind prop contract + **παγίδα**: μέσα τους υπάρχουν counts/μοίρες που ένα τυφλό `toDisplay` θα κατέστρεφε («16 βαθμίδες» → «0.016»). Ο Giorgio επέλεξε **δρόμο Β** — ένα σύνορο μονάδας στο `RibbonCombobox` dispatcher με opt-in flag, presets μένουν mm (νέο §7.1). Δεν έγινε commit (N.-1).
- **2026-07-18 (Opus 4.8) — ✅ ΦΑΣΗ 1 ΥΛΟΠΟΙΗΘΗΚΕ + η απόφαση #5 ΑΝΑΘΕΩΡΗΘΗΚΕ.** `config/units.ts`: `DEFAULT_DISPLAY_UNIT` `'cm'` → **`'m'`** (η μοναδική αλλαγή συμπεριφοράς). **Το shortcut κύκλου μονάδας ΑΠΟΡΡΙΦΘΗΚΕ** (νέο §6.1, εγκρίθηκε από τον Giorgio): κανένας από τους μεγάλους δεν εναλλάσσει μονάδα με πλήκτρο (Revit `UN`→dialog, AutoCAD `UNITS`→dialog, ArchiCAD→Preferences), και μετά την απόφαση #7 (input-unit = display-unit) η μονάδα διερμηνεύει **κάθε πληκτρολογούμενο αριθμό** — ένα κατά λάθος πάτημα θα έκανε το `3` να γίνει 3mm αντί 3m σιωπηλά. **SSoT audit πριν τον κώδικα (νέο §8.1):** το `DEFAULT_DISPLAY_PRECISION['m']` ήταν **ήδη 3** (καμία αλλαγή τιμής — μόνο σχόλιο + anchor)· ο μόνος καταναλωτής του default είναι το `display-unit-state.ts` (κανένα hardcoded `'cm'`)· βρέθηκε το κανονικό shortcut registry (`config/keyboard-shortcuts.ts`) και **4 υπάρχοντα αντίγραφα** cycle-helper — ένα 5ο θα ήταν sibling clone. **Μηδέν νέα i18n keys, μηδέν νέο store, μηδέν νέο σύστημα.** Tests: +6 anchors στο υπάρχον `config/__tests__/units-format.test.ts` (default=`m`, precision 3 σε length/area/coordinate, round-trip 895mm↔0.895m, BIM πλάτη 700/800/900/2500/3000/12345, «τυπωμένο 3 = 3 μέτρα», ανά-χιλιοστό σάρωση 890-910mm). **472/472 πράσινα** σε 35 suites (units, display-length-format, dimensions, move-readout, ribbon bridge, persist smoke). `jscpd:diff` καθαρό. Δεν έγινε commit (N.-1).
- **2026-07-18 (Opus 4.8) — Q&A γύρος 2: ΟΛΑ ΤΑ ΕΡΩΤΗΜΑΤΑ ΚΛΕΙΣΑΝ.** `DEFAULT_DISPLAY_PRECISION['m'] = **3 δεκαδικά**` (ώστε το 0,895 να εκφράζει 895mm). **Καμία μηχανική migration** — ο Giorgio είναι ο μοναδικός χρήστης και η εφαρμογή δεν έχει βγει σε παραγωγή· η αλλαγή default είναι απλή αλλαγή σταθεράς. §7β = κανένα ανοιχτό ερώτημα· έτοιμο για Φάση 1.
- **2026-07-18 (Opus 4.8) — Q&A Giorgio → ΑΠΟΦΑΣΕΙΣ κλειδώθηκαν (§6) + πλάνο 5 φάσεων (§7).** Default → **μέτρα**· **πλήρης εναρμόνιση** όλων των πεδίων εισόδου (αναιρεί συνειδητά το mm-native opening-width fix της ίδιας μέρας)· **project-scoped Firestore** persistence· **dropdown + shortcut κύκλου**· σκάλες (G4) → **ξεχωριστό μεταγενέστερο ADR**. Δύο αποφάσεις πάρθηκαν από τον agent (ενιαίο input=display unit· 3Δ χωρίς ξεχωριστό χειρισμό) — σημειωμένες ως τέτοιες. Παραμένουν ανοιχτά: ακρίβεια δεκαδικών σε `m`, one-time reset localStorage. **Καμία αλλαγή κώδικα ακόμη.** Δεν έγινε commit (N.-1).
- **2026-07-18 (Opus 4.8) — ADR δημιουργήθηκε (Phase 1 Recognition, N.0.1).** 5-agent orchestrated audit (units SSoT / 2Δ creation / 3Δ scene / move-grip / UI) κατέγραψε την τρέχουσα κατάσταση του κώδικα: το ζητούμενο user-selectable input-unit feature είναι ήδη ~85% υλοποιημένο μέσω του display-unit stack (ADR-462 Phase 2 / ADR-357 §5.5). Καταγράφηκαν 7 ασυνέπειες/κενά (G1–G7) + 3 επιλογές πορείας + 7 ανοιχτά ερωτήματα. **Καμία αλλαγή κώδικα** — pending αποφάσεις Q&A. Δεν έγινε commit (N.-1).
