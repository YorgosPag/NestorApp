# HANDOFF — ADR-396 v2 Φάση 6b (ETICS per-region override panel)

**Ημερομηνία:** 2026-05-31
**Μοντέλο:** Opus 4.8
**Κατάσταση εισόδου:** Φ6a (per-element ribbon override) ΥΛΟΠΟΙΗΜΕΝΟ — **pending commit** + 🔴 browser verify. Φ6b = ΕΠΟΜΕΝΟ (δεν ξεκίνησε).
**Domain lock:** ΑΓΓΙΖΕΙΣ ΜΟΝΟ ETICS αρχεία — `bim/geometry/footprint*`, `bim/geometry/envelope*`, `bim/stores/envelope*`, `bim/services/envelope*`, `hooks/data/useEnvelope*`, `ui/components/bim-envelope/*`, σχετικά i18n. **ΜΗΝ** αγγίξεις `bim/walls/`, `bim-3d/gizmo/`, `bim-3d/scene/` (δουλεύουν άλλοι agents).

---

## 1. ΤΙ ΕΙΝΑΙ Η Φ6b

Ο Giorgio (αυτή η session) απάντησε «**και τα δύο**» στο πώς θα μπει το UI override του `envelopeFunction`:
- **Φ6a (DONE):** per-element combobox «Θερμοπρόσοψη» (Αυτόματο/Εξωτερικό/Εσωτερικό) στα contextual ribbon tabs τοίχου/κολώνας/δοκαριού.
- **Φ6b (ΑΥΤΟ):** **per-region panel** μέσα στο `ThermalEnvelopeDialog` — λίστα με τα **ανιχνευμένα όρια** του ορόφου (εξωτερικό περίγραμμα / αίθριο / δωμάτιο) και dropdown override **ανά region**, που γράφει το `envelopeFunction` σε **ΟΛΑ** τα στοιχεία που σχηματίζουν εκείνο το όριο.

**Στόχος UX (Revit-style):** ο χρήστης βλέπει «Εξωτερικό περίγραμμα», «Αίθριο 1», «Δωμάτιο 2» κ.λπ. και μπορεί να πει π.χ. «αυτό το δωμάτιο να μονωθεί κι αυτό» (→ exterior σε όλα τα boundary elements του) ή «αυτό το αίθριο να ΜΗΝ μονωθεί» (→ interior).

---

## 2. ΑΡΧΙΤΕΚΤΟΝΙΚΗ — ΤΑ ΚΟΜΜΑΤΙΑ ΥΠΑΡΧΟΥΝ ΗΔΗ (μην ξαναγράψεις)

### 2.1. Region detection (SSoT έτοιμο)
- `computeBuildingFootprint(walls, columns, beams, sceneUnits)` → `BuildingFootprintResult` (`bim/geometry/building-footprint.ts`).
- `classifyFootprintRegions(footprint, slabsAbove, opts?)` → `FootprintClassificationResult` (`bim/geometry/footprint-region-classifier.ts`):
  - `.rings / .exterior / .atria / .interiorRooms / .openStructures` — κάθε `ClassifiedFootprintRing` = `{ ring, role, insulated, coverageAbove }`.
  - `role: 'exterior' | 'atrium' | 'interior-room' | 'open-structure'`.

### 2.2. 🔑 Region → element ids (ΤΟ ΚΛΕΙΔΙ ΤΗΣ Φ6b)
`ClassifiedFootprintRing.ring` είναι `FootprintRing` (`building-footprint.ts`) που έχει:
```ts
readonly edges: readonly FootprintEdge[];   // 1:1 με τις ακμές του ring
// FootprintEdge = { a, b, sourceEntityId: string|null, sourceEntityType: 'wall'|'column'|'beam'|null }
```
→ Τα **distinct `edges[].sourceEntityId` (≠ null)** ενός region = τα στοιχεία που σχηματίζουν εκείνο το όριο. **Αυτό** γράφεις. (Επιβεβαιωμένο: `buildRing` στο `building-footprint.ts:261` γεμίζει `sourceEntityId` per edge.)

### 2.3. Data model + engine consumption (έτοιμα, Φ4+Φ5)
- `EnvelopeFunction = 'exterior' | 'interior'` (`bim/types/thermal-envelope-types.ts`), `undefined` = auto. Πεδίο σε `WallParams/ColumnParams/BeamParams` (`.strict()` Zod, optional).
- `collectEnvelopeOverrides([...walls, ...columns, ...beams])` → `Map<id, EnvelopeFunction>` (`bim/geometry/envelope-shell.ts`) — **διάβασε** το current state ανά region (αν όλα τα boundary elements ίδια τιμή → δείξε αυτή· αλλιώς «—/mixed»).
- `computeEnvelopeShell(walls, columns, beams, spec, overridesById, slabsAbove, {sceneUnits})` → `{chains}`. Το override **ήδη** σέβεται από τον engine (Φ5B). Άρα η Φ6b = ΜΟΝΟ write path + UI· καμία αλλαγή engine.

### 2.4. Host/Dialog (πού μπαίνει το UI)
- `ui/components/bim-envelope/ThermalEnvelopeHost.tsx` — owns draft spec, έχει `getLevelScene/setLevelScene`, `currentLevelId`, `levels`, και υπολογίζει `slabsAbove` μέσω `resolveSlabsAboveForLevel(getEnvelopeFloorSlabs().slabs, .floors, level.floorId)`. **Εδώ** θα υπολογίσεις τα regions του τρέχοντος ορόφου (φόρτωσε scene → filter walls/columns/beams → `computeBuildingFootprint` → `classifyFootprintRegions(footprint, slabsAbove)`).
- `ui/components/bim-envelope/ThermalEnvelopeDialog.tsx` — pure UI (controlled). **Εδώ** προσθέτεις νέο `<section>` με τη λίστα regions + dropdown ανά region (mirror του zones fieldset· Radix `Select` ADR-001 + `Label htmlFor`).

### 2.5. Πώς γράφεται το override (write path)
Δύο επιλογές — **διάλεξε batch για ΕΝΑ undo entry (Revit parity):**
- `UpdateWallParamsCommand` / `UpdateColumnParamsCommand` / `UpdateBeamParamsCommand` (`core/commands/entity-commands/`) — per entity, undoable. Πολλά elements ανά region → πολλά undo entries (κακό UX).
- **ΕΛΕΓΞΕ:** `bim/cascade/bim-bulk-update-builder.ts` — αν batch-άρει πολλαπλά param updates σε ΕΝΑ undo step, χρησιμοποίησέ το (1 undo ανά «εφαρμογή region override»). Αν όχι, σκέψου νέο batch command.
- Mirror του υπάρχοντος apply path: `ThermalEnvelopeHost.applyPerElement` ήδη κάνει `setLevelScene(...)` + `EventBus.emit('bim:envelope-applied', {entities: changed})` ώστε τα persistence hooks να γράψουν+audit-άρουν. **Reuse αυτό το pattern** — γράψε `envelopeFunction` στα entity params, `setLevelScene`, emit, και μετά **ξανα-apply** το spec (ή markAllCanvasDirty) ώστε ο engine να ξανα-υπολογίσει το shell με τα νέα overrides.

### 2.6. SSoT για τη χαρτογράφηση (νέο, μικρό)
Φτιάξε **ΕΝΑ** νέο pure module, π.χ. `bim/services/envelope-region-override.service.ts` (ή `bim/geometry/`), με:
- `buildRegionOverrideTargets(classification)` → λίστα `{ regionId, role, label, elementIds: string[], currentFn: EnvelopeFunction | 'mixed' | undefined }` (distinct sourceEntityIds ανά ring + read current από `collectEnvelopeOverrides`).
- `applyRegionEnvelopeFunction(elementIds, fn, scene)` → επιστρέφει patched entities + changed (pure, mirror `applyAssignmentsToEntities`). Ο Host το dispatch-άρει.
- **Pure, μηδέν React/Firestore** (test-friendly) — ο Host κάνει το wiring.

---

## 3. ΠΡΟΤΕΙΝΟΜΕΝΑ ΑΡΧΕΙΑ (ETICS only)

| Αρχείο | Τύπος | Τι |
|--------|-------|-----|
| `bim/services/envelope-region-override.service.ts` | **NEW** | SSoT: regions→targets + apply (§2.6). |
| `bim/services/__tests__/envelope-region-override.service.test.ts` | **NEW** | targets από classification (distinct ids, mixed-state) + apply patch/clear. |
| `ui/components/bim-envelope/ThermalEnvelopeDialog.tsx` | MOD | +section «Όρια / Regions» με dropdown ανά region. Νέα props `regions` + `onRegionFunctionChange`. |
| `ui/components/bim-envelope/ThermalEnvelopeHost.tsx` | MOD | υπολογίζει regions του τρέχοντος ορόφου (footprint+classify) + handler που γράφει override + re-apply. |
| `src/i18n/locales/{el,en}/dxf-viewer-shell.json` | MOD | `ribbon.commands.thermalEnvelope.regions.*` (title/role labels: exterior/atrium/room + dropdown auto/exterior/interior). N.11. |
| ADR-396 §3.1.7 (ή νέο §3.1.8) + §8 changelog + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + adr-index + memory | MOD | Κανόνας N.15. |

**Reuse (μηδέν διπλότυπο):** το dropdown auto/exterior/interior υπάρχει ήδη ως SSoT — `ENVELOPE_FUNCTION_OPTIONS` + `read/parseEnvelopeFunctionValue` στο `ui/ribbon/hooks/bridge/envelope-function-param.ts` (Φ6a). Σκέψου αν αξίζει να μετακινηθεί σε neutral location (π.χ. `bim/types/thermal-envelope-types.ts`) ώστε να το μοιραστούν ribbon ΚΑΙ dialog (αλλιώς το dialog import-άρει από ribbon = ελαφρώς λάθος direction). **Καθάρισε on the spot αν χρειαστεί (N.0.2).**

---

## 4. 🟡 DESIGN QUESTION ΓΙΑ ΤΟΝ GIORGIO (ρώτα ΠΡΙΝ υλοποιήσεις — απλά ελληνικά + παράδειγμα, [[feedback_questions_simple_greek_examples]])

Ένα boundary element (π.χ. τοίχος) μπορεί να ανήκει στο **εξωτερικό περίγραμμα** ΚΑΙ ταυτόχρονα σε ένα **δωμάτιο/αίθριο** (διαφορετικές ακμές του ίδιου τοίχου σε διαφορετικά rings — π.χ. λεπτός τοίχος μεταξύ έξω και αίθριου). Άρα ένα override «αίθριο→interior» μπορεί να συγκρουστεί με «εξωτερικό→exterior» στο ΙΔΙΟ element.

**Ρώτα:** Όταν ένας τοίχος ανήκει σε 2 όρια, ποιο override νικάει; (α) το τελευταίο που πάτησε ο χρήστης· (β) προτεραιότητα region-type (π.χ. αίθριο > εξωτερικό)· (γ) per-element (Φ6a) πάντα νικάει το per-region. Δώσε παράδειγμα με 2 δωμάτια + 1 αίθριο.

**Default πρότασή σου (αν πει «ότι προτείνεις»):** το per-region γράφει σε όλα τα distinct ids του ring· αν element ανήκει σε 2 regions, **τελευταίο write νικάει** (απλό, προβλέψιμο, ο χρήστης βλέπει το αποτέλεσμα ζωντανά + undo). Το Φ6a per-element παραμένει η «λεπτή» παράκαμψη.

---

## 5. PENDING COMMIT Φ6a (ΔΕΝ έγινε commit — N.(-1), περιμένει εντολή Giorgio)

**Δικά μου αρχεία Φ6a (ΟΧΙ `git add -A` — multi-agent stage race, [[feedback_multi_agent_stage_race]]):**
```
?? src/subapps/dxf-viewer/ui/ribbon/hooks/bridge/envelope-function-param.ts
?? src/subapps/dxf-viewer/ui/ribbon/hooks/bridge/__tests__/envelope-function-param.test.ts
?? src/subapps/dxf-viewer/ui/ribbon/hooks/bridge/__tests__/wall-param-helpers-envelope.test.ts
 M src/subapps/dxf-viewer/ui/ribbon/hooks/bridge/{wall,column,beam}-command-keys.ts
 M src/subapps/dxf-viewer/ui/ribbon/hooks/bridge/wall-param-helpers.ts
 M src/subapps/dxf-viewer/ui/ribbon/hooks/useRibbon{Column,Beam}Bridge.ts
 M src/subapps/dxf-viewer/ui/ribbon/hooks/__tests__/useRibbonColumnBridge.test.tsx
 M src/subapps/dxf-viewer/ui/ribbon/data/contextual-{wall,column,beam}-tab.ts
 M src/i18n/locales/{el,en}/dxf-viewer-shell.json
 M docs/centralized-systems/reference/adrs/ADR-396-bim-external-thermal-envelope-etics.md
 M local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt
```
⚠️ Το `ΥΠΟΧΡΕΩΤΙΚΑ_ΒΗΜΑΤΑ.txt` (M) + `i18n/.../dxf-viewer-shell.json` αν τα αγγίξει άλλος agent → verify `git diff --cached` ΠΡΙΝ commit.

---

## 6. ΑΡΧΙΤΕΚΤΟΝΙΚΑ ΣΗΜΕΙΑ-ΚΛΕΙΔΙΑ (να μη χαθεί χρόνος)

- **Routing παγίδα ribbon (Φ6a μάθημα):** ο composer `useRibbonCommands` δρομολογεί combobox μέσω `isXRibbonStringKey(key)` — το key ΠΡΕΠΕΙ να είναι στο `*_RIBBON_STRING_KEYS`. (Δεν αφορά τη Φ6b που είναι dialog, αλλά καλό να ξέρεις.)
- **`.strict()` Zod enum:** το `envelopeFunction` ΔΕΝ δέχεται literal `'auto'` → πάντα γράψε `undefined` για clear (το `parseEnvelopeFunctionValue('auto')` επιστρέφει `{ fn: undefined }`).
- **Units:** τα footprint/edge coords είναι **canvas units** (ίδιος χώρος με `WallGeometry.outerEdge`). Το `computeBuildingFootprint` παίρνει `sceneUnits` (default `walls[0]?.params.sceneUnits ?? 'mm'`).
- **WallForEnvelope/ColumnForEnvelope/BeamForFootprint:** ο applicator κάνει απλό `entities.filter(isWallEntity)` κ.λπ. και τα περνά κατευθείαν — δες `envelope-element-applicator.ts:118` (`computeEnvelopeAssignments`) για το ακριβές pattern φόρτωσης scene→footprint.
- **slabsAbove:** πάρ' το ΑΚΡΙΒΩΣ όπως ο Host (`getEnvelopeFloorSlabs()` + `resolveSlabsAboveForLevel`) ώστε τα regions (αίθριο vs δωμάτιο) να ταυτίζονται με ό,τι ζωγραφίζει το 2D/3D.
- **i18n ns:** `dxf-viewer-shell` (ΟΧΙ `dxf-viewer-bim`).
- **jest:** ΠΑΝΤΑ από repo root: `npx jest --testPathPatterns="<pat>"` (το subapp-level invocation σπάει — βλ. [[project_dxf_vitest_to_jest_testinfra]]). jest globals, ΟΧΙ vitest.
- **Pre-commit:** τα ETICS dialog/host/service αρχεία ΔΕΝ είναι στη micro-leaf list ADR-040 → καμία CHECK 6B/6D. (Αν αγγίξεις `EnvelopeOverlay.tsx`/`bim-envelope-scene-builder.ts` → CHECK 6B/6D → stage ADR-040· αλλά η Φ6b ΔΕΝ πρέπει να τα αγγίξει.)
- **ΟΧΙ commit/push** χωρίς ρητή εντολή Giorgio (N.(-1)). ΟΧΙ `git add -A`.

---

## 7. ΣΧΕΤΙΚΑ MEMORY / DOCS
- `project_adr396_etics_thermal_envelope.md` (κύριο — STATE, Φ6a ενημερωμένο, Φ6b στα «Επόμενα»)
- ADR-396 §3.1.2/§3.1.3 (data model + ταξινόμηση), §3.1.7 (Φ6a), §8 changelog
- `bim/geometry/footprint-region-classifier.ts` + `building-footprint.ts` (region + edges attribution)
- `bim/geometry/envelope-shell.ts` (`collectEnvelopeOverrides`, `computeEnvelopeShell`)
- `feedback_questions_simple_greek_examples.md` (πώς να ρωτήσεις το §4), `feedback_completeness_over_mvp.md`, `feedback_centralize_on_the_spot.md`
