# HANDOFF — Foundation: cross-level Properties panel (bug) + ανάθεση επιπέδου ανά kind (διερεύνηση)

**Ημ/νία:** 2026-06-18 · **Γλώσσα: ΠΑΝΤΑ Ελληνικά.** · **Τύπος: 🔴 PLAN-FIRST** (bug-fix + διερεύνηση).
**Full Enterprise + Full SSoT + Revit-grade (GOL).** · **Επόμενο ελεύθερο ADR = 484** (το 483 το κράτησε ο canvas-diagrams agent — επιβεβαίωσε με `ls docs/centralized-systems/reference/adrs/ | grep ADR-`).

> ⚠️ **Shared working tree** με άλλον agent (κάνει ADR-483 canvas M/V/N diagrams). **git add ΜΟΝΟ τα δικά σου, ΠΟΤΕ `-A`.**
> **commit/push = Giorgio (ΟΧΙ εσύ). tsc = Giorgio** (N.17 — ένα tsc τη φορά, εσύ ΜΗΝ τρέξεις). **jest = τρέχει κανονικά.**
> 🔴 **ΠΡΙΝ ΓΡΑΨΕΙΣ ΚΩΔΙΚΑ: ΥΠΟΧΡΕΩΤΙΚΟ SSoT AUDIT (grep §3) → πίνακας reuse vs new.** Εντολή Giorgio: χρησιμοποίησε υπάρχοντα patterns, ΜΗΝ φτιάξεις διπλότυπα.
> 🔴 **PLAN MODE** — παρουσίασε plan, περίμενε «προχώρα» πριν υλοποιήσεις.

---

## 0. TL;DR — δύο συνδεδεμένα θέματα στα πέδιλα/θεμελιώσεις

Ο Giorgio παρατήρησε στο 3D (building «Κτήριο Α1», όροφος «Ισόγειο»):
- **(A) BUG — cross-level Properties:** όταν επιλέγει πέδιλο που ανήκει σε **άλλο** επίπεδο από τον ενεργό όροφο, το δεξί panel «Ιδιότητες» μένει **άδειο** («Επίλεξε ένα στοιχείο…») και ΔΕΝ εμφανίζεται contextual ribbon tab. Όταν το πέδιλο ανήκει στον **ενεργό** όροφο → το panel **γεμίζει** κανονικά (Στατικά/Οπλισμός/Ποσότητες). Στα στιγμιότυπα: **πράσινο πέδιλο (active) δουλεύει, καφέ πέδιλο (cross-level) δεν δουλεύει.**
- **(B) ΔΙΕΡΕΥΝΗΣΗ — ανάθεση επιπέδου ανά kind:** ο Giorgio βλέπει πεδιλοδοκούς/πέδιλα σε **διαφορετικά υψόμετρα ΚΑΙ διαφορετικά επίπεδα** (πράσινα «στο Ισόγειο», καφέ «στη θεμελίωση»). Ρωτά **γιατί**. Πρέπει να επιβεβαιωθεί αν η ανάθεση **level/floorId** εξαρτάται από το kind (πιθανό bug) ή αν πρόκειται απλώς για διαφορά **υψομέτρου** στον **ίδιο** foundation-level που *μοιάζει* με «άλλο επίπεδο».

**Στόχος (Revit way):** όπως στη Revit, ένα στοιχείο θεμελίωσης επιλέγεται και δείχνει τις ιδιότητές του **ανεξαρτήτως** του ενεργού view/level (single selection truth → ένα properties resolution). Και η τοποθέτηση level πρέπει να είναι **συνεπής & κατανοητή** (όλα τα foundation στοιχεία στον foundation-level, με σωστά relative υψόμετρα).

---

## 1. ✅ ΗΔΗ ΕΠΙΒΕΒΑΙΩΜΕΝΑ (από προηγούμενο investigation — ΜΗΝ τα ξανα-ανακαλύψεις)

### 1.1 Τα χρώματα = **by design**, ανά kind (ΟΧΙ bug)
`src/subapps/dxf-viewer/bim/materials/material-catalog-defs.ts:72-75` (ADR-445, «ΔΙΑΚΡΙΤΕΣ ΧΡΟΙΕΣ»):
- `elem-foundation-pad` → `0x8a5a3c` (sienna/**καφέ**) = μεμονωμένο πέδιλο
- `elem-foundation-strip` → `0x2f7d6a` (**πράσινο**/teal) = λωριδωτό πέδιλο
- `elem-foundation-tie-beam` → `0xb5651d` (πορτοκαλί-καφέ) = συνδετήρια/πεδιλοδοκός
- 3D: `bim-3d/converters/foundation-to-three.ts:91` → `getElementMaterial3D(\`foundation-${foundation.kind}\`)`
→ **Απάντηση «γιατί 2 χρώματα»:** κάθε kind έχει δικό του χρώμα (Revit-style category colours). ΔΕΝ χρειάζεται διόρθωση — αλλά αξίζει να το εξηγήσεις/τεκμηριώσεις στο ADR.

### 1.2 Τα υψόμετρα = **by design**, ανά kind (ΟΧΙ bug)
`src/subapps/dxf-viewer/bim/types/foundation-types.ts` → `defaultFoundationTopElevationMm(kind)` (γρ. ~348-352):
- `tie-beam` → `DEFAULT_TIE_BEAM_TOP_ELEVATION_MM` (**ψηλότερα** — κάθεται ΠΑΝΩ στα πέδιλα, EC8)
- `pad` / `strip` → `DEFAULT_FOUNDATION_TOP_ELEVATION_MM` (στάθμη θεμελίωσης)
- `FoundationKind = 'pad' | 'strip' | 'tie-beam'` (γρ. 47)
→ **Απάντηση «γιατί διαφορετικά υψόμετρα»:** οι συνδετήριες κάθονται ψηλότερα από τα πέδιλα. By design.

### 1.3 Το Properties panel **υπάρχει & είναι σωστά wired** (ΟΧΙ missing panel)
- `ui/wall-advanced-panel/BimPropertiesRouter.tsx:63-65` → `isFoundationEntity(selected) → <FoundationPropertiesTab>`. ✅
- `ui/foundation-advanced-panel/FoundationPropertiesTab.tsx` + `FoundationAdvancedPanel.tsx` ✅ (mirror Column/Beam panels)
- `types/entities.ts:806` `isFoundationEntity = type === 'foundation'`· `:874-880` `isBimEntity` **περιλαμβάνει** `'foundation'` ✅
- Άρα **δεν λείπει panel** — λείπει το **resolution του cross-level entity**.

### 1.4 🎯 ΡΙΖΑ του (A) — cross-level resolution (ΥΨΗΛΗ ΒΕΒΑΙΟΤΗΤΑ)
Ο router + το tab βρίσκουν το επιλεγμένο entity με:
```
currentScene.entities.find((e) => e.id === primarySelectedId)   // BimPropertiesRouter.tsx:43-46 + FoundationPropertiesTab.tsx:45-49
```
ΑΛΛΑ τα πέδιλα είναι **cross-level model SSoT** (collection `floorplan_foundations`, στον **foundation-level** του κτιρίου) και **αφαιρούνται ρητά** από τα entities ενός κανονικού ορόφου:
```
src/subapps/dxf-viewer/hooks/useFoundationLevelSync.ts:69-72  → stripFootings = entities.filter(e => !isFoundationEntity(e))
```
Στο 3D εμφανίζονται cross-level μέσω ξεχωριστού store (`app/FoundationPersistenceHost.tsx` → `bim-3d/stores/Bim3DEntitiesStore.ts` `setFoundations`). Η 3D→universal selection γέφυρα (`bim-3d/systems/selection/use-3d-selection-universal-bridge.ts`) θέτει σωστά `primarySelectedId` = footing id. **Όμως** το `currentScene.entities` του ενεργού (μη-foundation) ορόφου **δεν** περιέχει το footing → `find` επιστρέφει `null` → άδειο panel + κανένα contextual tab.
→ Πράσινο (strip) **στον ενεργό όροφο** = στο currentScene → δουλεύει. Καφέ (pad) **σε άλλο επίπεδο** = όχι στο currentScene → άδειο. **Αυτή είναι η διαφορά.**

---

## 2. 🔍 ΤΙ ΜΕΝΕΙ ΝΑ ΔΙΕΡΕΥΝΗΣΕΙΣ ΠΡΙΝ ΤΟ PLAN

### 2.1 (B) Γιατί διαφορετικά **ΕΠΙΠΕΔΑ**; (το ανοιχτό ερώτημα)
Διαπίστωσε **ντετερμινιστικά** αν η ανάθεση level/floorId ενός foundation εξαρτάται από το kind, ή αν όλα πάνε στον ίδιο foundation-level και η «διαφορά επιπέδου» που βλέπει ο Giorgio είναι στην πραγματικότητα διαφορά **υψομέτρου** (§1.2). Entry points:
```
src/subapps/dxf-viewer/bim/foundations/add-foundation-to-scene.ts          ← πού/σε ποιο level μπαίνει νέο foundation
src/subapps/dxf-viewer/hooks/tools/useSpecialTools.ts                       ← foundation placement tool
src/subapps/dxf-viewer/systems/levels/building-foundation-level.ts          ← resolveBuildingFoundationLevel / resolveBuildingIdForLevel / resolveFloorElevationMm
src/subapps/dxf-viewer/hooks/useFoundationLevelSync.ts                      ← cross-level sync (target = foundation level όταν ≠ active)
src/subapps/dxf-viewer/bim/foundations/foundation-firestore-service.ts      ← floorplan_foundations model SSoT (createFoundationFirestoreService, foundationDocToEntity)
src/subapps/dxf-viewer/bim/persistence/bim-floor-scope.ts                   ← resolveBimPersistenceScope (durable floorId scope)
```
- **Υπόθεση εργασίας:** ΟΛΑ τα foundation kinds ανήκουν στον **έναν** foundation-level του κτιρίου· τα tie-beams απλώς ζωγραφίζονται ψηλότερα. Αν ισχύει → το «διαφορετικά επίπεδα» είναι **παρανόηση υψομέτρου**, και η μόνη πραγματική διόρθωση είναι το (A). **ΕΠΙΒΕΒΑΙΩΣΕ το, μην το υποθέσεις.**
- Αν όντως διαφορετικά kinds → διαφορετικά levels (bug) → πρόσθεσε δεύτερο slice στο plan.

### 2.2 Σχετικά ADRs που ΠΡΕΠΕΙ να διαβάσεις (cross-level foundation αρχιτεκτονική)
```
ADR-459 (Phase 0 — foundation-level SSoT, cross-level organism)
ADR-463 (Foundation Reinforcement UX + Properties panel)
ADR-469 (cross-floor per-entity BIM load — anti-vanish)  ← MEMORY: reference_cross_floor_per_entity_bim_load
ADR-420/399 (BIM persistence scope — durable floorId)    ← MEMORY: reference_bim_persistence_scope_ssot
```
adr-index: `docs/centralized-systems/reference/adrs/` + `docs/centralized-systems/reference/adr-index.md`.

---

## 3. 🔴 ΥΠΟΧΡΕΩΤΙΚΟ SSoT AUDIT (GREP) — ΤΡΕΞΕ ΠΡΙΝ ΓΡΑΨΕΙΣ· παραδοτέο = πίνακας reuse vs new

```
# Πώς ΟΛΟΙ οι consumers resolve-άρουν το primary-selected entity (μην φτιάξεις νέο μηχανισμό):
grep -rn "primarySelectedId\|getPrimaryId\|currentScene.entities.find" src/subapps/dxf-viewer/ui src/subapps/dxf-viewer/app

# Υπάρχει ΗΔΗ store/helper που δίνει τα cross-level footings ως entities (το 3D τα παίρνει από κάπου);
grep -rn "setFoundations\|getFoundations\|Bim3DEntitiesStore\|modelFootings" src/subapps/dxf-viewer

# Πώς το contextual ribbon tab resolve-άρει τον τύπο selection (πρέπει να ενημερωθεί ΜΑΖΙ με το panel — ίδιο SSoT):
grep -rn "resolveContextualTrigger\|contextual.*tab\|Ιδιότητες Θεμελίωσης\|foundationContextual" src/subapps/dxf-viewer/ui/ribbon

# Μήπως υπάρχει ΗΔΗ ενοποιημένος entity resolver (SSoT) που να ψάχνει σε πολλαπλές πηγές;
grep -rn "resolveSelectedEntity\|findEntityById\|entityById\|useSelectedEntity" src/subapps/dxf-viewer

# Foundation panel + tab + dispatcher (reuse — ΜΗΝ διπλασιάσεις):
grep -rn "FoundationPropertiesTab\|FoundationAdvancedPanel\|useFoundationParamsDispatcher" src/subapps/dxf-viewer
```
**Boy-Scout (N.0.2):** αν βρεις ότι Column/Beam tabs + ribbon contextual κάνουν το ΙΔΙΟ `currentScene.find`, η σωστή λύση είναι **ΕΝΑΣ κοινός resolver** (SSoT) που ψάχνει active scene **+** foundation-model store — reused από router/tab/contextual. ΜΗΝ βάλεις cross-level lookup μόνο στο foundation tab (διπλότυπο/ασυνέπεια).

---

## 4. 🎯 ΚΑΤΕΥΘΥΝΣΗ ΛΥΣΗΣ (Revit-grade, Full SSoT) — πρότεινέ την στο plan, ΜΗΝ κωδικοποιήσεις πριν την έγκριση

**Αρχή (Revit): ΜΙΑ αλήθεια επιλογής → ΕΝΑ entity resolution, ανεξάρτητο από το ενεργό view/level.**
- Δημιούργησε/εντόπισε **ΕΝΑΝ SSoT resolver** `resolveSelectedBimEntity(primarySelectedId)` που ψάχνει: (1) active `currentScene.entities`, (2) **fallback** στο foundation-model store (τα cross-level footings που ήδη τροφοδοτούν το 3D). Επιστρέφει το entity + το home level του.
- **Reuse** το από: `BimPropertiesRouter`, `FoundationPropertiesTab`, και το **contextual ribbon tab resolver** (ώστε να εμφανίζεται «Ιδιότητες Θεμελίωσης» και cross-level).
- Πηγή των cross-level footings: ΟΧΙ νέο fetch — χρησιμοποίησε την **ίδια** πηγή που ήδη γεμίζει το 3D (`Bim3DEntitiesStore`/`useFoundationLevelSync.modelFootings`). **Μηδέν διπλό Firestore subscription.**
- **Write path:** πρόσεξε ότι ο `useFoundationParamsDispatcher` γράφει στο σωστό (foundation) scope/level — όχι στον ενεργό όροφο. Επιβεβαίωσε με `resolveBimPersistenceScope` (ADR-420/399, durable floorId).
- **Read-only ασφάλεια:** αν η επεξεργασία cross-level είναι ρίσκο, v1 = **read-only** εμφάνιση ιδιοτήτων cross-level (Revit δείχνει· edit μπορεί να απαιτεί μετάβαση στο foundation view). Απόφαση στο plan.

**N.7.2 checklist + δήλωση ✅/⚠️/❌ Google-level στο τέλος.**

---

## 5. SCOPE

### ✅ ΕΝΤΟΣ
1. Διερεύνηση (B) §2.1 → ξεκάθαρη απάντηση «γιατί διαφορετικά επίπεδα» (+ διόρθωση ΑΝ είναι πραγματικό bug ανάθεσης level).
2. Fix (A): cross-level πέδιλο → δείχνει ιδιότητες (panel) **και** contextual ribbon tab, μέσω **κοινού** resolver (SSoT).
3. i18n el+en αν χρειαστούν νέα keys (N.11). Jest για τον resolver (pure).
4. *(προαιρετικά)* secondary cosmetic: `bim-3d/properties/QuickProperties3DHoverPopover.tsx` (no `case 'foundation'` → δεν δείχνει hover tooltip) + `bim-3d/accessibility/focus-order.ts` (`SEMANTIC_TYPE_ORDER` χωρίς `'foundation'`). Μικρά — μόνο αν ταιριάζουν στο slice.

### ❌ ΕΚΤΟΣ
- Τα χρώματα ανά kind (§1.1) — by design, ΜΗΝ τα αλλάξεις (μόνο τεκμηρίωση).
- Ο canvas M/V/N diagrams (ADR-483) — το κάνει **άλλος agent**, ΜΗΝ τον αγγίξεις.
- Ο FEM solver / ADR-481/482 — committed, εκτός.

---

## 6. ROADMAP / DELIVERABLES (PHASE 3 — N.0.1 / N.15)
- **ADR-484** (new — cross-level foundation properties resolution + level-assignment clarification) + **adr-index** (2 πίνακες) + **`local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`** (1-2 γραμμές, ΜΟΝΟ τι εκκρεμεί) + **MEMORY** — ίδιο σύνολο/commit.
- **commit = Giorgio.** Εσύ ετοιμάζεις (`git add` ΜΟΝΟ δικά σου), σταματάς, αναφέρεις.

## 7. TEST ΣΕΝΑΡΙΟ (έτοιμο)
Building **«Κτήριο Α1»** (`bldg_58f47bf1-4d41-4276-9929-bed8f1aa1a9d`), όροφος **«Ισόγειο»**: 4 κολόνες + 4 πεδιλοδοκοί + 4 δοκοί + 1 πλάκα, + foundation-level με πέδιλα. **Repro (A):** στο Ισόγειο, διάλεξε **καφέ** πέδιλο (cross-level) → panel άδειο (BUG)· διάλεξε **πράσινο** (active) → panel γεμάτο (OK). **Verify fix:** καφέ πέδιλο → panel γεμάτο + contextual tab «Ιδιότητες Θεμελίωσης».

## 8. ⚠️ COLLISION WARNING (μάθημα από αυτή τη συνεδρία)
Άλλος agent δουλεύει **ταυτόχρονα** στο ίδιο working tree (ADR-483 canvas). **ΠΡΙΝ ξεκινήσεις:** `git status` — δες τι αγγίζει εκείνος, ΜΗΝ πιάσεις τα ίδια αρχεία, **git add ΜΟΝΟ τα δικά σου**. Αν δεις ξένες αλλαγές σε αρχείο που χρειάζεσαι → re-read πριν edit, σταμάτα & ρώτα τον Giorgio αν συγκρούεστε.

## 9. ΚΑΝΟΝΕΣ (απαράβατοι — CLAUDE.md)
≤40 γρ/function, ≤500 γρ/code-file, μηδέν `any`/`as any`/`@ts-ignore`, μηδέν hardcoded strings (i18n el+en), μηδέν inline styles / div-soup, Select = `@/components/ui/select` (ADR-001). PLAN MODE υποχρεωτικό. **Απάντα στα Ελληνικά πάντα.**
