# ADR-677 — Επιλογή Μονάδας από τον Χρήστη (mm/cm/m) για Δημιουργία / Μετακίνηση / Μετασχηματισμό Οντοτήτων

**Status:** ✅ ΑΠΟΦΑΣΙΣΜΕΝΟ (Q&A Giorgio 2026-07-18) — **pending υλοποίηση Φάσεων 1-4** · Discovery: 2026-07-18 (Opus 4.8, 5-agent orchestrated audit)
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
| Δημιουργία — μήκος τοίχου/γραμμής (ring) | display unit (cm def.) | ✅ ΝΑΙ |
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
| 5 | Discoverability | **Dropdown + keyboard shortcut κύκλου** `mm→cm→m` |
| 6 | Σκάλες (G4) | **ΝΑΙ, αλλά σε ξεχωριστή μεταγενέστερη φάση/ADR** — δεν μπλέκεται με τη δουλειά της μονάδας |
| 7 | Ενιαίο vs χωριστό input/display | **ΕΝΑ setting** (input-unit = display-unit), Revit/AutoCAD-style. *Απόφαση agent — συνεπές με την «πλήρη εναρμόνιση»· δύο ανεξάρτητες ρυθμίσεις θα ήταν ακριβώς η ασυνέπεια που καταργούμε* |
| 8 | 3Δ καμβάς | **Κανένας ξεχωριστός χειρισμός** — ακολουθεί ήδη τον ίδιο επιλογέα μέσω `move-readout`. *Απόφαση agent* |

**⚠️ Συνέπεια της απόφασης #1+#3 που έγινε δεκτή συνειδητά:** το G1 (mm-native πλάτος κουφώματος) είχε μπει ως **σκόπιμο fix την ίδια μέρα (2026-07-18)**. Η απόφαση #2/#3 το **αναιρεί**. Αν στην πράξη αποδειχθεί δύσχρηστο (πληκτρολόγηση `0.9` αντί `900`), επανεξετάζεται — τεκμηριωμένο εδώ ώστε να μη χαθεί το ιστορικό.

---

## 7. Πλάνο υλοποίησης (μία φάση = μία συνεδρία, ≤70% context)

**Καμία φάση δεν απαιτεί νέο store — όλα plug-άρουν στο υπάρχον `displayUnitState` / `useDisplayUnit` / `config/units.ts`.**

**Φάση 1 — Default `m` + shortcut κύκλου.**
`config/units.ts`: `DEFAULT_DISPLAY_UNIT = 'm'` (+ έλεγχος `DEFAULT_DISPLAY_PRECISION['m']` ώστε να μη χαθεί ακρίβεια σε mm-κλίμακα — μέτρα με 2 δεκαδικά κόβουν στο εκατοστό· πιθανώς χρειάζεται 3). Νέο keyboard shortcut κύκλου `mm→cm→m` στο υπάρχον shortcut registry, καλώντας `displayUnitState.setUnit`. i18n keys για το shortcut label. Tests: round-trip `toDisplay`/`fromDisplay` σε `m`.

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
- **Ακρίβεια σε μέτρα:** με 2 δεκαδικά, το `0,90` δεν μπορεί να εκφράσει 895mm. Το `DEFAULT_DISPLAY_PRECISION` για `m` πρέπει να επανεξεταστεί (πιθανώς 3 δεκαδικά).
- **Υπάρχοντες χρήστες:** όποιος έχει ήδη `dxf:displayUnit` στο localStorage δεν επηρεάζεται από την αλλαγή default — μόνο νέοι. Να αποφασιστεί αν θέλουμε one-time reset.
- **CHECK 6D/6B:** πολλά από τα αγγιζόμενα αρχεία είναι render-path → απαιτούν staged ADR στο commit.
- **N.17:** κανένα `tsc` από τον πράκτορα σε καμία φάση.

---

## 7β. Ανοιχτά ερωτήματα που ΠΑΡΑΜΕΝΟΥΝ

1. **Ακρίβεια δεκαδικών σε `m`** — 2 ή 3 δεκαδικά; (επηρεάζει αν μπορείς να δηλώσεις 895mm)
2. **One-time reset** του υπάρχοντος localStorage ώστε οι ήδη-χρήστες να δουν το νέο default `m`;

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

---

## 9. Changelog

- **2026-07-18 (Opus 4.8) — Q&A Giorgio → ΑΠΟΦΑΣΕΙΣ κλειδώθηκαν (§6) + πλάνο 5 φάσεων (§7).** Default → **μέτρα**· **πλήρης εναρμόνιση** όλων των πεδίων εισόδου (αναιρεί συνειδητά το mm-native opening-width fix της ίδιας μέρας)· **project-scoped Firestore** persistence· **dropdown + shortcut κύκλου**· σκάλες (G4) → **ξεχωριστό μεταγενέστερο ADR**. Δύο αποφάσεις πάρθηκαν από τον agent (ενιαίο input=display unit· 3Δ χωρίς ξεχωριστό χειρισμό) — σημειωμένες ως τέτοιες. Παραμένουν ανοιχτά: ακρίβεια δεκαδικών σε `m`, one-time reset localStorage. **Καμία αλλαγή κώδικα ακόμη.** Δεν έγινε commit (N.-1).
- **2026-07-18 (Opus 4.8) — ADR δημιουργήθηκε (Phase 1 Recognition, N.0.1).** 5-agent orchestrated audit (units SSoT / 2Δ creation / 3Δ scene / move-grip / UI) κατέγραψε την τρέχουσα κατάσταση του κώδικα: το ζητούμενο user-selectable input-unit feature είναι ήδη ~85% υλοποιημένο μέσω του display-unit stack (ADR-462 Phase 2 / ADR-357 §5.5). Καταγράφηκαν 7 ασυνέπειες/κενά (G1–G7) + 3 επιλογές πορείας + 7 ανοιχτά ερωτήματα. **Καμία αλλαγή κώδικα** — pending αποφάσεις Q&A. Δεν έγινε commit (N.-1).
