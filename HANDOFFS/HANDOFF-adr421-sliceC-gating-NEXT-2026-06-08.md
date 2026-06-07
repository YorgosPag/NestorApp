# HANDOFF — ADR-421 SLICE C follow-up (a): TYPE-AWARE GATING κουφωμάτων (2026-06-08)

**Γλώσσα:** Ελληνικά. **Working tree:** ΚΟΙΝΟ με άλλον agent — **ΟΧΙ commit/push** (ο Giorgio κάνει commit· `git add` ΜΟΝΟ τα δικά σου αρχεία). **ΜΗΝ αγγίξεις `adr-index.md`.**
**Μοντέλο:** Sonnet 4.6 αρκεί (1 domain, ~4-6 αρχεία ribbon/bridge). **Στόχος ποιότητας (Giorgio):** «όπως η Revit, FULL ENTERPRISE + FULL SSOT».
**Workflow:** N.0.1 ADR-driven — PHASE 1 RECOGNITION πρώτα (διάβασε τον τρέχοντα κώδικα· code = source of truth), μετά Plan Mode (3-5 αρχεία → μπες μόνος σου σε Plan Mode), μετά υλοποίηση.

---

## 0. TL;DR — ΤΙ ΘΑ ΚΑΝΕΙΣ

**Το ADR-421 SLICE C (Opening Family/Type, Revit) είναι ΥΛΟΠΟΙΗΜΕΝΟ & πράσινο** (tsc 0 δικά μου, 190 tests PASS) — **εκκρεμεί μόνο browser-verify + commit (Giorgio).**

**Η δουλειά σου = follow-up (a): TYPE-AWARE GATING.** Όταν ένα κούφωμα είναι **typed** (`opening.typeId` υπάρχει), τα ribbon comboboxes **Kind / Width / Height** πρέπει να γίνονται **read-only** (διέπονται από τον Τύπο — επεξεργασία μέσω «Edit type»), ακριβώς όπως η Revit δείχνει τα type-params greyed στο instance Properties. **Untyped (legacy)** κουφώματα μένουν πλήρως editable (zero regression).

### ΓΙΑΤΙ (το bug που κλείνεις — correctness/Google-level):
Σήμερα, σε typed κούφωμα, αν ο χρήστης αλλάξει Width από το παλιό combobox → ο `useRibbonOpeningBridge` κάνει `UpdateOpeningParamsCommand` που πειράζει ΜΟΝΟ `params.width`. Στο επόμενο catalog re-resolution / reload, το «type wins» (`resolveEffectiveOpeningParams` στο `opening-doc-hydration` + `useOpeningTypeReresolution`) **ξαναγράφει** τη type τιμή → **η αλλαγή χάνεται σιωπηλά (silent edit loss)**. Δεν είναι Google-level.

---

## 1. ΣΥΝΙΣΤΩΜΕΝΗ ΠΡΟΣΕΓΓΙΣΗ (Revit-true, minimal framework change)

**Approach B — thread ένα `disabled` flag μέσα από το `RibbonComboboxState`.** Το πιο Revit-πιστό (type params read-only στο instance) και minimal.

### Σημεία ενσωμάτωσης (recognition-verified 2026-06-08):
1. **`src/subapps/dxf-viewer/ui/ribbon/context/RibbonCommandContext.tsx`** → `RibbonComboboxState` interface (σήμερα `{ value, options }`). **ADD** `readonly disabled?: boolean;`.
2. **`src/subapps/dxf-viewer/ui/ribbon/components/buttons/RibbonCombobox.tsx`** (γρ. ~72 + 116): ήδη διαβάζει `const dynamicState = getComboboxState(command.commandKey)`. **ΑΛΛΑΞΕ** το `disabled={command.comingSoon}` → `disabled={command.comingSoon || dynamicState?.disabled === true}`. (Η τιμή εξακολουθεί να εμφανίζεται read-only — το Radix Select disabled δείχνει το value.)
3. **`src/subapps/dxf-viewer/ui/ribbon/hooks/useRibbonOpeningBridge.ts`** → στο `getComboboxState`, όταν `opening.typeId` υπάρχει ΚΑΙ το field είναι type-governed (`kind` / `width` / `height`), επέστρεψε `{ value, options: [], disabled: true }`. SSoT για το ποια fields gate-άρονται: **reuse `OPENING_OVERRIDABLE_KEYS`** από `family-type-ui-helpers` (περιέχει width/height + frame/material/glazing) **+ `kind`** (το kind ΔΕΝ είναι overridable· διέπεται 100% από τον τύπο). Δηλαδή gate = `kind` + (width/height που είναι type-governed). **sillHeight/handing/openDirection = INSTANCE → ΠΟΤΕ disabled.**
4. **Defense-in-depth** στο `onComboboxChange`: αν κληθεί για gated field ενώ `opening.typeId` (π.χ. προγραμματιστικά), **no-op early-return** (μην dispatch-άρεις `UpdateOpeningParamsCommand`). Έτσι ακόμη κι αν το UI gating παρακαμφθεί, ΔΕΝ υπάρχει silent edit loss.
5. **(Προαιρετικό polish)** tooltip «Διέπεται από τον τύπο — επεξεργασία μέσω Edit type» στο disabled combobox (νέο i18n key el+en `ribbon.commands.bimFamilyType.typeGovernedHint` ή παρόμοιο· N.11 — keys ΠΡΩΤΑ στα locales).

### Πώς ο bridge ξέρει το typeId:
Ο `resolveOpening()` (ήδη στο bridge, γρ. 114) επιστρέφει το `OpeningEntity` πλήρες → `opening.typeId` είναι διαθέσιμο άμεσα. **ΜΗΔΕΝ νέα dependency.**

---

## 2. ΕΝΑΛΛΑΚΤΙΚΗ (αν ο Giorgio θέλει editable-as-override αντί read-only)
**Approach A — route τα width/height edits σε per-instance override** αντί για `UpdateOpeningParamsCommand`:
- Στο `onComboboxChange`, όταν typed + field ∈ {width,height}: dispatch **`AssignOpeningTypeCommand`** με merged `typeOverrides` (reuse pure helper **`resolveOpeningTypeAssignment`** από `family-type-ui-helpers` + `normaliseOpeningOverrides`) → η αλλαγή γίνεται persisted per-instance override (επιβιώνει reload, εμφανίζει το override badge στο `RibbonOpeningTypePropertiesWidget`).
- `kind` typed → detach (`assignType(undefined)` λογική) πριν την αλλαγή, ή block.
- **ΜΕΙΟΝΕΚΤΗΜΑ:** λιγότερο Revit-πιστό (η Revit ΔΕΝ επιτρέπει per-instance override διαστάσεων κουφώματος). **Προτίμησε Approach B** εκτός αν ο Giorgio πει διαφορετικά (ρώτησέ τον με AskUserQuestion στο Plan Mode αν αμφιβάλλεις).

**SSoT που υπάρχει ήδη & θα χρησιμοποιήσεις:** `useOpeningFamilyTypeController` (`setOverride`/`clearOverride`/`assignType`), `resolveOpeningTypeAssignment`, `normaliseOpeningOverrides`, `OPENING_OVERRIDABLE_KEYS`, `AssignOpeningTypeCommand` — όλα στο SLICE C, ΜΗΝ τα ξαναγράψεις.

---

## 3. ΑΡΧΕΙΑ (στοχευμένο git add — ΜΟΝΟ αυτά)
**MOD (Approach B):**
- `src/subapps/dxf-viewer/ui/ribbon/context/RibbonCommandContext.tsx` (RibbonComboboxState += disabled?)
- `src/subapps/dxf-viewer/ui/ribbon/components/buttons/RibbonCombobox.tsx` (disabled OR-clause)
- `src/subapps/dxf-viewer/ui/ribbon/hooks/useRibbonOpeningBridge.ts` (getComboboxState disabled + onComboboxChange guard)
- (αν tooltip) `src/i18n/locales/{el,en}/dxf-viewer-shell.json`

**Tests (NEW/MOD):** test για `useRibbonOpeningBridge.getComboboxState` → επιστρέφει `disabled:true` για kind/width/height όταν typed, `disabled` undefined/false όταν untyped· `onComboboxChange` no-op guard για gated field. (Δες αν υπάρχει ήδη `__tests__/useRibbonOpeningBridge*` να επεκτείνεις.)

**⚠️ Άλλα contextual bridges:** το `RibbonComboboxState.disabled` είναι generic → ΜΗΝ σπάσεις wall/slab/stair/mep bridges (απλώς δεν θέτουν disabled → undefined → editable ως τώρα). Επιβεβαίωσε με tsc.

---

## 4. PRE-COMMIT GATES / ΠΑΓΙΔΕΣ
- **CHECK 6D (ADR-040):** ΔΕΝ αγγίζεις canvas-drawing/renderer (μόνο ribbon context/combobox/bridge) → **δεν χρειάζεται ADR-040 staging.** (Επιβεβαίωσέ το — αν τυχόν αγγίξεις renderer, stage ADR-040.)
- **N.11 i18n:** αν προσθέσεις tooltip key → ΠΡΩΤΑ στα `el` + `en` locales (μηδέν hardcoded/defaultValue).
- **N.7.1:** functions ≤40 γρ, αρχεία ≤500.
- **tsc:** τα ΜΟΝΑ αναμενόμενα errors = τα **4 γνωστά pre-existing** άλλων agents: `mesh-to-object3d.ts(124)`, `DeleteEntityCommand.ts(54)` ('roof'), `drawing-preview-generator.ts(116)` ('floor-finish'), `apply-entity-preview.ts(316)` (readonly tuple). Οτιδήποτε άλλο = δικό σου.
- **Verify:** `npx tsc --noEmit` (ΕΝΑ, background — η μηχανή γονατίζει με πολλαπλά tsc) + `npx jest useRibbonOpeningBridge` (ή τα opening ribbon suites).

---

## 5. ΜΕΤΑ ΤΗΝ ΥΛΟΠΟΙΗΣΗ (N.0.1 PHASE 3 + N.15)
- Update **ADR-421** changelog (follow-up (a) DONE) + **σβήσε** το (a) από `.claude-rules/pending-ratchet-work.md` (μένουν (b) cross-floor opening BOQ + (c) wall→generic command migration).
- Update `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (SLICE C follow-up (a) ✅) + memory `project_adr421_opening_types.md` + `MEMORY.md`.
- **ΜΗΝ** adr-index. Commit = Giorgio.

---

## 6. ΠΛΗΡΕΣ CONTEXT — ΤΙ ΠΑΡΕΔΩΣΕ ΤΟ SLICE C (για να μην ψάχνεις)
Όλα DONE 2026-06-08, **ΜΗΔΕΝ fork** στο generic ADR-412 framework (collection `bim_family_types`/enterprise-id/service/store/resolver/rules category-blind):
- **Types/schema:** `OpeningTypeParams` (kind/width/height/frameWidth?/material?/glazingPanes?/fireRating?) + `BimTypeParamsByCategory.opening`· `OpeningTypeParamsSchema` ορισμένο στο **`opening.schemas.ts`** (reuse `OpeningKindSchema`· **αποφυγή runtime cycle** — το family-type schema το κάνει re-export) + discriminatedUnion branch + `schemaByCategory.opening`· `resolveEffectiveOpeningParams` (legacy fast-path).
- **Instance:** `OpeningEntity.typeId?`/`typeOverrides?` (+schema+factory+`OpeningDoc`/`OpeningUpdateInput` με `null`→`deleteField`+`entityToSaveInput`).
- **Commands:** `AssignOpeningTypeCommand` (effective+geometry+validate+**re-derive operationType**+kind/ifcType lock-step· ΧΩΡΙΣ cascade)· **generic** `UpdateFamilyTypeCommand`+`DeleteFamilyTypeCommand` (το opening τα καταναλώνει).
- **Controller/UI:** `useOpeningFamilyTypeController`+helpers· `RibbonOpeningFamilyTypeWidget`/`RibbonOpeningTypePropertiesWidget`/`EditOpeningTypeDialog`(χωρίς DNA)/`edit-opening-type-store`· panel `opening-family-type` στο `contextual-opening-tab` + RibbonPanel dispatch.
- **Persistence:** `opening-type-resolution.ts` (resolveOpeningEffective/openingEntityDiffersFromDoc/openingTypeLinkChanged/openingUpdateLinkPatch/reresolveSceneOpenings)· hydration «type wins»· `useOpeningPersistence` link-aware auto-save+persist patch· `useOpeningTypeReresolution`· `findOpeningsByTypeId`· dialog mounted στο `OpeningPersistenceHost`.
- **Built-ins/auto:** `getBuiltInOpeningTypes` 1/kind=17· `auto-opening-type.ts` `resolveAutoOpeningTypeId` (διαθέσιμο· **at-create wiring = ΑΚΟΜΗ follow-up**, ΟΧΙ κρίσιμο).
- **Audit/Event:** `AnyFamilyTypeParams`+=OpeningTypeParams· tracked-fields +=width/height/frameWidth/glazingPanes/fireRating· EventBus `bim:family-type-changed` payload +='opening'.
- **i18n:** `ribbon.panels.openingFamilyType` + `bimFamilyType.{paramWidth/Height/FrameWidth/GlazingPanes/FireRating, editTypeOpening*, builtin.opening.*}` (el+en).

### Revit-true split (κλειδωμένο):
TYPE owns kind/width/height/frame/material/glazing/fireRating · INSTANCE owns wallId/offsetFromStart/sillHeight/handing/openDirection · operationType = derived.

### Άλλα εκκρεμή κουφωμάτων (μετά το (a)):
- **(b)** cross-floor opening BOQ re-feed (signature-group `opening-boq-sync`, θέλει `floorplanId` plumbing στο `useFamilyTypeBoqRefeed`). 🟡 χαμηλή προτεραιότητα — geometry re-flow ήδη σωστό.
- **(c)** wall→generic command migration (Boy-Scout· το opening ήδη στα generics).
- **Browser-verify A/B/C** + **commit** (Giorgio).

### Μαθήματα SLICE C (μην πατήσεις τις ίδιες νάρκες):
1. zod type-param schema του opening **πρέπει** να ζει στο `opening.schemas.ts` (όχι `bim-family-type.schemas.ts`) → αλλιώς **runtime import cycle**.
2. EventBus event-map payloads έχουν **hardcoded category unions** — αν προσθέσεις category αλλού, ψάξε `drawing-event-map.ts`.
3. Νέα family-type category → ενημέρωσε `AnyFamilyTypeParams` (audit-client) + `BIM_FAMILY_TYPE_TRACKED_FIELDS`.
