# ADR-677 — Επιλογή Μονάδας από τον Χρήστη (mm/cm/m) για Δημιουργία / Μετακίνηση / Μετασχηματισμό Οντοτήτων

**Status:** 🔍 Discovery/Analysis — **pending αποφάσεις Giorgio (Q&A)** · 2026-07-18 (Opus 4.8, 5-agent orchestrated audit)
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

## 6. Πώς προχωράμε μπροστά — προτεινόμενες επιλογές

**Καμία επιλογή δεν απαιτεί νέο store ή νέα υποδομή — όλα πλug-άρουν στο `displayUnitState` / `useDisplayUnit` / `config/units.ts`.**

**Βήμα 0 (μηδενικού κόστους): Discoverability.** Αν ο σκοπός καλύπτεται ήδη από τον υπάρχοντα dropdown, ίσως αρκεί: (α) πιο εμφανής θέση/στιλ, (β) keyboard shortcut κύκλου `mm→cm→m` (π.χ. πλήκτρο), (γ) tooltip/onboarding. **Πρόταση: ξεκινάμε από εδώ πριν αγγίξουμε pipeline.**

**Επιλογή Α — «Πλήρης εναρμόνιση» (Revit-grade consistency):** ΟΛΑ τα σημεία εισόδου σέβονται τον επιλογέα — εναρμονίζουμε G1 (opening-width), G2 (βήμα F9), G7 (ribbon comboboxes), αφαιρούμε G3. Ένα project unit, παντού. Καθαρότερο UX, μεγαλύτερο scope.

**Επιλογή Β — «Συνειδητές εξαιρέσεις» (τεκμηριωμένο status quo):** Κρατάμε συγκεκριμένα πεδία mm-native (πλάτος κουφώματος, βήμα) γιατί οι επαγγελματίες τα σκέφτονται σε mm ακόμη κι όταν το project δουλεύει σε m — όπως το Revit κρατά κάποια πεδία σε project units κι άλλα σταθερά. Απλώς **τεκμηριώνουμε** τη λογική και **διορθώνουμε το latent bug G3 + το stale σχόλιο G5**. Μικρό scope, χαμηλό ρίσκο.

**Επιλογή Γ — «Α + persistence».** Επιπλέον υλοποιούμε το G6 (project-scoped Firestore override) ώστε η μονάδα να ταξιδεύει με το project/χρήστη, όχι με τον browser.

**Ορθογώνιο ερώτημα — «input unit» vs «display unit»:** σήμερα είναι **ΕΝΑ** setting (ό,τι βλέπεις, τόσο πληκτρολογείς — Revit/AutoCAD-style). Ο Giorgio μιλά για «τιμές μετακίνησης/μετασχηματισμού/δημιουργίας», που είναι input. Πρέπει να επιβεβαιωθεί ότι θέλουμε **ενιαίο** input+display unit (προτεινόμενο) και όχι δύο ανεξάρτητα.

---

## 7. Ανοιχτά ερωτήματα (για το Q&A)

1. **Default μονάδα:** να μείνει `cm`, ή να γίνει `m` (πιο φυσικό για αρχιτεκτονική κλίμακα), ή `mm`;
2. **Discoverability:** αρκεί ο υπάρχων dropdown, ή θέλεις και keyboard shortcut κύκλου μονάδας + πιο εμφανή ένδειξη;
3. **Ενιαίο vs χωριστό:** input-unit = display-unit (ΕΝΑ setting, προτεινόμενο) ή δύο ανεξάρτητες ρυθμίσεις;
4. **Εξαιρέσεις (G1/G2/G7):** πλήρης εναρμόνιση (Επιλογή Α) ή συνειδητές mm-native εξαιρέσεις (Επιλογή Β) για πλάτος κουφώματος / βήμα F9 / ribbon comboboxes;
5. **Persistence:** per-browser (σήμερα) ή project-scoped Firestore (G6);
6. **Σκάλες (G4):** να τις φέρουμε στο canonical-mm (migration + persisted `sceneUnits`) ή να μείνουν «leave as-is»;
7. **3Δ:** χρειάζεσαι ξεχωριστό χειρισμό μονάδας στον 3Δ καμβά ή αρκεί που ακολουθεί τον ίδιο επιλογέα;

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

- **2026-07-18 (Opus 4.8) — ADR δημιουργήθηκε (Phase 1 Recognition, N.0.1).** 5-agent orchestrated audit (units SSoT / 2Δ creation / 3Δ scene / move-grip / UI) κατέγραψε την τρέχουσα κατάσταση του κώδικα: το ζητούμενο user-selectable input-unit feature είναι ήδη ~85% υλοποιημένο μέσω του display-unit stack (ADR-462 Phase 2 / ADR-357 §5.5). Καταγράφηκαν 7 ασυνέπειες/κενά (G1–G7) + 3 επιλογές πορείας + 7 ανοιχτά ερωτήματα. **Καμία αλλαγή κώδικα** — pending αποφάσεις Q&A. Δεν έγινε commit (N.-1).
