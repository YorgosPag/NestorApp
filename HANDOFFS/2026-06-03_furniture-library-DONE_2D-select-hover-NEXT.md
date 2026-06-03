# HANDOFF — 2D επιλογή + hover-highlight για τα έπιπλα (furniture)

**Ημερομηνία:** 2026-06-03
**Τύπος:** Μικρό, στοχευμένο fix (2 αρχεία, mirror υπάρχοντος pattern). ΟΧΙ νέα αρχιτεκτονική.
**Μοντέλο:** **Sonnet 4.6 αρκεί** (2 cases σε switch, πρότυπο έτοιμο). Opus μόνο αν προκύψει κάτι cross-cutting.
**Σχετικά ADR:** ADR-410 (furniture) · ADR-406 (mep-fixture = το πρότυπο) · ADR-040 (canvas perf).

---

## 🎯 ΤΙ ΘΕΛΕΙ Ο GIORGIO
«Θέλω να μπορώ να **επιλέγω** τα έπιπλα στο 2Δ και να **φωτίζονται κατά το hover**.»

---

## ✅ ΤΙ ΗΔΗ ΔΟΥΛΕΥΕΙ (RECOGNITION — επιβεβαιωμένο 2026-06-03)
Ο renderer + τα bounds είναι **ΗΔΗ έτοιμα** — μην τα ξαναφτιάξεις:
- `bim/renderers/FurnitureRenderer.ts` έχει ΗΔΗ: `hitTest()` (bbox + `pointInPolygon` στο footprint), **hover glow** όταν `phaseManager.determinePhase()` → phase `'highlighted'` (γρ. 64-73), και `applyPhaseStyle` για το selection styling.
- `rendering/hitTesting/Bounds.ts` έχει ΗΔΗ `case 'furniture':` → `calculateBimEntityBounds` (γρ. 134).
- Το έπιπλο ΥΠΑΡΧΕΙ στο `DxfScene`: `hooks/canvas/dxf-scene-entity-converter.ts` (case 'furniture' ~γρ. 334), `canvas-v2/dxf-canvas/dxf-types.ts` ('furniture' στο union), `dxf-renderer-entity-model.ts` (case 'furniture'). `EntityRendererComposite` έχει registered τον `FurnitureRenderer`.

## 🐞 ΤΟ ΑΚΡΙΒΕΣ ΚΕΝΟ (root cause — γιατί δεν δουλεύει σήμερα)
Και το hover ΚΑΙ το click-select περνούν από το **spatial index** του `HitTestingService`. Το index γεμίζει στο `HitTestingService.updateScene()` → `convertToEntityModel()` (switch). **ΔΕΝ υπάρχει `case 'furniture'`** σε αυτό το switch (`services/HitTestingService.ts`, ~γρ. 316-411) → το έπιπλο πέφτει στο `default:` (γρ. 408) που επιστρέφει stripped `baseModel` **χωρίς `geometry`** → `BoundsCalculator.calculateBimEntityBounds()` επιστρέφει `null` → το έπιπλο **εξαφανίζεται από το spatial index** → ποτέ δεν γίνεται hover ούτε click-select.

Δεύτερο, μικρότερο κενό: το **marquee** (window/crossing) select (`systems/selection/shared/selection-duplicate-utils.ts`, `calculateEntityBounds()` switch ~γρ. 157-263) δεν έχει `case 'furniture'` → δεν επιλέγεται με drag-κουτί.

---

## 🔧 Η ΔΙΟΡΘΩΣΗ — 2 ΑΡΧΕΙΑ (mirror του `mep-fixture`)

### Αρχείο 1 (ΚΥΡΙΟ — λύνει hover + click): `src/subapps/dxf-viewer/services/HitTestingService.ts`
1. Import (κοντά στα υπόλοιπα `compute*Geometry`, ~γρ. 29):
   ```ts
   import { computeFurnitureGeometry } from '../bim/furniture/furniture-geometry';
   ```
2. Στο `convertToEntityModel()`, **ΑΚΡΙΒΩΣ μετά** το `case 'mep-fixture':` block (γρ. 330-334), πρόσθεσε — 1:1 mirror:
   ```ts
   // ADR-410 — furniture χρειάζεται geometry-recompute fallback (mirror mep-fixture):
   // FurnitureEntity από Firestore μπορεί να φτάσει πριν hydrate-αριστεί το geometry cache·
   // χωρίς `geometry.bbox` ο BoundsCalculator το πετάει από το spatial index → no hover/select.
   case 'furniture': {
     const fn = entity as unknown as Partial<import('../bim/types/furniture-types').FurnitureEntity>;
     const geometry = fn.geometry ?? (fn.params ? computeFurnitureGeometry(fn.params) : undefined);
     return buildBimEntityModel('furniture', { ...(entity as object), geometry } as typeof entity, baseModel);
   }
   ```
   > ⚠️ Επιβεβαίωσε ότι το `buildBimEntityModel` δέχεται `'furniture'` ως `BimElementType` (το `mep-fixture`/`electrical-panel` περνούν ίδιο type string). Αν ο τύπος του 1ου arg είναι στενός `BimElementType` που ΔΕΝ περιλαμβάνει `'furniture'`, πρόσθεσέ το εκεί (μικρό· grep `BimElementType`).

### Αρχείο 2 (marquee select): `src/subapps/dxf-viewer/systems/selection/shared/selection-duplicate-utils.ts`
Στο `calculateEntityBounds()` switch, μετά το `case 'mep-segment':` (~γρ. 226), πρόσθεσε fall-through:
```ts
case 'furniture':   // ADR-410 — marquee select
  return calculateBimEntity2DBounds(entity as unknown as Entity);
```
(ή πρόσθεσε `case 'furniture':` στη λίστα των fall-through cases που ήδη καταλήγουν στο `calculateBimEntity2DBounds`.)

### 🧹 Boy-Scout (ΠΡΟΑΙΡΕΤΙΚΟ): το `'railing'` έχει ΤΟ ΙΔΙΟ κενό
Και στα 2 αρχεία λείπει ΚΑΙ `case 'railing'`. Αν θες πλήρη κάλυψη, πρόσθεσε παράλληλα `case 'railing'` (με `computeRailingGeometry` από `../bim/railings/railing-geometry`). **ΟΧΙ υποχρεωτικό** — ο Giorgio ζήτησε έπιπλα. Κάν' το μόνο αν θες, αλλιώς σημείωσέ το στο `pending-ratchet-work.md`.

---

## 🔬 VERIFY
- `NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit` — **ΑΛΛΙΩΣ OOM δείχνει ΨΕΥΔΩΣ «0 errors»**. Περίμενε ΓΝΩΣΤΑ pre-existing errors **άλλου agent** (ΟΧΙ regression): `mesh-to-object3d.ts:124`, `bim_family_type` (propagate-entity-rename, incremental-backup), `mepSegments` (Bim3DReadOnlyOverlay, bim3d-resync), `DxfMepSegment`, `WallDna` (EditWallTypeDialog), QuickPropertiesHoverPopover. **Μηδέν νέα στα δικά σου 2 αρχεία.**
- `npx jest "furniture"` → 23/23 (δεν αλλάζει).
- 🔴 **Browser:** πέρνα το ποντίκι πάνω σε έπιπλο → πρέπει να **φωτίζεται** (hover glow)· κλικ → **επιλέγεται**· drag-κουτί → marquee select.
- ⚠️ **ADR-040 staging:** τα `HitTestingService.ts` / `selection-duplicate-utils.ts` **ΔΕΝ** είναι στη λίστα micro-leaf (CHECK 6B/6C/6D). Πιθανότατα ΔΕΝ χρειάζεται ADR-040 staging. Αν όμως το pre-commit CHECK 6 μπλοκάρει, stage `ADR-410-cc0-mesh-furniture-import.md`.

---

## ⚠️ ΚΡΙΣΙΜΟ ΠΛΑΙΣΙΟ (ΜΗΝ το αγνοήσεις)
- 🌐 **Ελληνικά πάντα.**
- 🚫 **COMMIT/PUSH κάνει ΜΟΝΟ ο Giorgio.** Ποτέ εσύ. Ποτέ `--no-verify`. (N.(-1))
- 🌳 **SHARED working tree με άλλον agent.** `git add` **ΜΟΝΟ** τα 2 δικά σου αρχεία· **ΠΟΤΕ** `git add -A`.
  **WIP άλλου agent ΑΥΤΗ ΤΗ ΣΤΙΓΜΗ (ΜΗΝ τα πειράξεις):** ADR-412 BIM family types (`firestore.rules`, `firestore-collections.ts`, `enterprise-id-*`, `bim/family-types/`, `bim-family-type.*`, `propagate-entity-rename`, `incremental-backup`) + MEP duct/pipe segments (`mepSegments`, `DxfMepSegment`, `Bim3DReadOnlyOverlay`, `bim3d-resync`, `QuickPropertiesHoverPopover`) + wall-types WIP (`wall-types.ts`, `wall.schemas.ts`, `wall-firestore-service.ts`, `useWallPersistence.ts`, `wall-persistence-helpers.ts`, `WallPersistenceHost.tsx`, `useWallSoftLock.ts`, `useWallTypeReresolution.ts`, `RibbonPanel.tsx`, `contextual-wall-tab.ts`, `AssignWallTypeCommand.ts`, `RibbonWallFamilyTypeWidget.tsx`, `RibbonWallTypePropertiesWidget.tsx`, `useWallFamilyTypeController.ts`, `EditWallTypeDialog.tsx`).
- 🗑️ **Εκκρεμεί διαγραφή temp φακέλου `C:\Nestor_Pagonis\.sofa-lib`** (untracked, κλειδωμένος από handle στο τέλος της προηγ. συνεδρίας). Σβήσ' τον με node `fs.rmSync('.sofa-lib',{recursive:true,force:true,maxRetries:10,retryDelay:700})` (rm/PowerShell μπλοκαρισμένα).

---

## 🧾 TRACKING UPDATE (N.15 — όλα στο τέλος, ίδιο commit)
- `ADR-410-cc0-mesh-furniture-import.md` → νέο changelog entry (2D select+hover για furniture· κενό=`convertToEntityModel` case· fix mirror mep-fixture).
- `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` → ομάδα ADR-410, νέα γραμμή «2D select+hover έπιπλα».
- Memory: `~/.claude/projects/C--Nestor-Pagonis/memory/project_adr410_cc0_furniture_import.md` + `MEMORY.md` index.

---

## 📌 ΠΡΟΗΓΟΥΜΕΝΗ ΣΥΝΕΔΡΙΑ — ΤΙ ΟΛΟΚΛΗΡΩΘΗΚΕ (context)
Βιβλιοθήκη επίπλων **31 έπιπλα** (ADR-410 v2.0/v2.1 + ADR-409 v1.5): 4 καναπέδες + 20 μοντέρνα PBR (Sketchfab CC-BY) σε 14 kinds· διαγράφηκαν 3 Kenney κρεβάτια + `chair_01`· διορθώθηκε scale bug (×1000) σε 20 GLB. **9 αρχεία pending commit (κάνει ο Giorgio):** `furniture-catalog.ts`, `furniture-types.ts`, `furniture.schemas.ts`, `bim-to-atoe-mapping.ts`, `furniture-completion.test.ts`, `el/dxf-viewer-shell.json`, `en/dxf-viewer-shell.json`, `ADR-410.md`, `ADR-409.md`. Αν ο Giorgio ΔΕΝ έχει κάνει ακόμη commit, ΜΗΝ τα πειράξεις — είναι έτοιμα.
