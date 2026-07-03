# HANDOFF — ADR-568 «Γεφύρωση με Κούφωμα»: fix swing-arc (2Δ) + 3Δ opening

**Ημερομηνία:** 2026-07-03
**Status:** 🟡 FEATURE + 2Δ CULL FIX ΕΤΟΙΜΑ (UNCOMMITTED) — μένει ΕΝΑ στοχευμένο fix (opening creation path)
**ADR:** ADR-568 (feature) + ADR-040 (cull fix)
**Commit:** ⚠️ ΤΟΝ ΚΑΝΕΙ Ο GIORGIO — ΠΟΤΕ ο agent (N.(-1)).
**Working tree:** ⚠️ ΜΟΙΡΑΖΕΤΑΙ με άλλους agents — άγγιξε ΜΟΝΟ τα αρχεία της feature, ΟΧΙ `git add -A`.

---

## 🎯 ΤΟ ΕΝΑ ΠΟΥ ΜΕΝΕΙ

Μετά τη γεφύρωση, στο 2Δ **λείπει το τεταρτημόριο φοράς (swing arc)** και το κούφωμα **δεν εμφανίζεται στο 3Δ**.
**Ρίζα (διαγνωσμένη):** το `executeBridge` προσθέτει το κούφωμα μέσω `CreateBimEntityCommand`, που **παρακάμπτει** το
finalization cascade. Όλα τα κανονικά κουφώματα (opening tool + ADR-533 detector) περνούν από το SSoT
**`buildOpeningResolvers(levelManager).onOpeningCreated(entity)`** (`hooks/tools/useSpecialTools-opening.ts:53-72`), που:
1. ενημερώνει το `hostedOpeningIds` του host τοίχου (νέο wall object → re-cut **2Δ ΚΑΙ 3Δ** + cascade που ξαναϋπολογίζει
   πλήρες `geometry` **με `hingeArc`/`hingeAnchor`**),
2. κάνει `setLevelScene(...[...entities, opening])`,
3. εκπέμπει **σύγχρονα** `drawing:entity-created {entity, tool:'opening'}` → `OpeningPersistenceHost` + 3Δ sync.

Το `CreateBimEntityCommand` (α) δεν αλλάζει το wall object (baked hostedOpeningIds στη δημιουργία → κανένα re-cut), (β)
εκπέμπει deferred (microtask). Αποτέλεσμα: μερικό geometry (outline ναι → cutout+label φαίνονται· hingeArc όχι → **χωρίς
τόξο** — `drawSwing` bail-out στο `opening-overlay-drawing.ts:115`) + κανένα 3Δ (`Bim3DEntitiesStore.openings` δεν το παίρνει).

### Απόδειξη ότι το geometry/coords ΕΙΝΑΙ σωστά (DB-verified, ΜΗΝ ξανακυνηγήσεις coord bug)
- `opening_acc2892d`: kind door, `wallId`=merged, `offsetFromStart:1700`, `width:699.999` (=το κενό), height 2100, στο **17M**.
- Host merged `wall_54d810f5`: (17.137.018, 4.192.517→4.189.217), πάχος 100, **17M** — οι 2 τοίχοι-πηγή διαγράφηκαν. ✓
- Το tool είναι **coordinate-faithful**· το «μακριά στο origin» ήταν πειραματικοί τοίχοι κοντά στο origin, ΟΧΙ bug.

---

## ✅ Η ΔΙΟΡΘΩΣΗ (στοχευμένη, ~1 αρχείο)

**Αρχείο:** `src/subapps/dxf-viewer/hooks/tools/useWallGapOpeningTool.ts`

Αντικατέστησε στο `executeBridge` το κομμάτι δημιουργίας κουφώματος (τώρα `CreateBimEntityCommand` + `CompositeCommand`)
με το **proven path**:
1. Άλλαξε τον τύπο prop `LevelManagerLike` → **full** `LevelsHookReturn` (import από `../../systems/levels`) ώστε να
   περνά στο `buildOpeningResolvers` (το `useModifyTools` ήδη περνά full `ReturnType<typeof useLevels>` — δες γρ. 41/50).
2. Imports: **DROP** `CreateBimEntityCommand`, `CompositeCommand`. **ADD** `import { buildOpeningResolvers } from './useSpecialTools-opening';`
   (κράτα `resolveSceneUnits` — ήδη μπήκε).
3. Ροή `executeBridge` (κράτα ΟΛΟ το merge κομμάτι όπως είναι — canMergeWalls gate, buildMergedWallParams, mergedId,
   collectMergedOpenings, WallMergeCommand, `EventBus.emit('bim:wall-merge-committed', ...)`):
   - Χτίσε `mergedBase` με `hostedOpeningIds: reHostedIds` (**ΜΟΝΟ** τα re-hosted, **ΟΧΙ** το gap-opening id — έτσι το
     `onOpeningCreated` δημιουργεί νέο wall object → re-cut).
   - `merged` = mergedBase (πέρνα το στο WallMergeCommand + στο event).
   - `executeCommand(new WallMergeCommand({wallA:a, wallB:b, merged, openingUpdates}, sm))` + emit event (όπως τώρα).
   - **ΜΕΤΑ** το commit, αν `gap && gap.gapMm >= MIN_GAP_FOR_OPENING_MM`:
     ```ts
     const res = buildOpeningEntity(buildGapOpeningParams(mergedId, gap), mergedBase, layerId, resolveSceneUnits(scene));
     if (res.ok) { buildOpeningResolvers(levelManager).onOpeningCreated(res.entity); placedOpening = true; }
     ```
   - `selectEntities?.([mergedId])`; toast `wallGapOpening.bridged`/`.merged` βάσει `placedOpening`.
4. **Undo tradeoff (γνωστό, αποδεκτό):** το `onOpeningCreated` ΔΕΝ είναι undoable command → Ctrl+Z της γεφύρωσης αφήνει
   ορφανό κούφωμα (όπως ΟΛΑ τα κουφώματα της εφαρμογής). Γράψ' το ως γνωστό όριο στο ADR-568 §5 (follow-up: wrap σε command).

> ⚠️ Είχε ήδη δοκιμαστεί μερικώς αυτό το refactor και έγινε revert. Ο λόγος revert ΗΤΑΝ λάθος (νόμιζα ότι το
> CreateBimEntityCommand αρκεί επειδή το 2Δ κούφωμα φάνηκε — αλλά το ΠΛΗΡΕΣ κούφωμα, arc+3Δ, θέλει το proven path).

---

## ✅ ΤΙ ΕΙΝΑΙ ΗΔΗ ΕΤΟΙΜΟ (UNCOMMITTED — μην τα ξαναφτιάξεις)

### Feature ADR-568 (πλήρες, 13+jest πράσινα)
- NEW `bim/walls/wall-gap-opening.ts` (`buildGapOpeningParams`, `GAP_OPENING_KIND`).
- `bim/walls/wall-merge.ts` +`computeWallGap`/`WallGap`/`MIN_GAP_FOR_OPENING_MM=400` (reuse private wallAxis/scalarAlong,
  disjoint-interval). +`bim/walls/__tests__/wall-gap-opening.test.ts` (13 tests).
- NEW `hooks/tools/useWallGapOpeningTool.ts` (mirror useWallMergeTool· ΕΔΩ γίνεται το fix παραπάνω).
- Wiring: `ui/toolbar/types.ts`, `systems/tools/tool-definitions.ts`, `ui/ribbon/data/contextual-wall-tab.ts`,
  `ui/ribbon/components/buttons/RibbonButtonIcon.tsx` (icon `bim-wall-gap-opening`→DoorOpen), `hooks/tools/useModifyTools.ts`,
  `components/dxf-layout/CanvasSection.tsx`, `hooks/canvas/useCanvasClickHandler.ts` (+`canvas-click-types.ts`),
  `hooks/canvas/useCanvasEscapeRegistrations.ts` (+`useCanvasKeyboardShortcuts.types.ts`).
- i18n el+en: `wallGapOpening.*` + `ribbon.commands.wallEditor.gapOpening`.
- Docs: NEW `ADR-568-wall-gap-auto-opening.md` + adr-index (2 πίνακες).

### 2Δ cull fix (ADR-040, ΕΠΙΒΕΒΑΙΩΜΕΝΟ ΟΤΙ ΔΟΥΛΕΥΕΙ στο browser)
- `canvas-v2/dxf-canvas/dxf-viewport-culling.ts`: NEW `case 'opening'` → nested `openingEntity.geometry.bbox` (openings
  culled στο 17M γιατί ο converter τα τυλίγει nested, όχι top-level όπως wall/beam). +3 jest στο `dxf-viewport-culling.test.ts` (14/14).
- ADR-040 changelog entry (2026-07-03) + ADR-568 §7.
- **ΣΗΜΕΙΩΣΗ latent:** `slab`/`slab-opening` έχουν ΙΔΙΟ nesting → ίδιο cull bug (flagged· ένα pre-existing test δηλώνει
  top-level shape για slab → θέλει reconciliation). Follow-up, ΟΧΙ τώρα.

### pending-ratchet
- Flagged: εξαγωγή `useWallPickScaffold` (scene-helpers 3× διπλότυπα split/merge/gap-opening).

---

## 🔍 VERIFY (μετά το fix, ο Giorgio)
1. jest: `npx jest src/subapps/dxf-viewer/bim/walls/__tests__/wall-gap-opening.test.ts src/subapps/dxf-viewer/canvas-v2/dxf-canvas/__tests__/dxf-viewport-culling.test.ts` → πράσινα.
2. Browser: 2 ομοαξονικοί τοίχοι με κενό ≥40cm → «Γεφύρωση με Κούφωμα» → ΕΝΑΣ τοίχος + πόρτα στο κενό **ΜΕ τεταρτημόριο
   φοράς σε 2Δ** + **ορατή στο 3Δ** (cutout + door mesh). Δοκίμασε ΚΑΙ σε γεωαναφερμένη κάτοψη (~17M) — εκεί ήταν το bug.
3. ΟΧΙ tsc (N.17).

## 🚫 ΜΗΝ
- Μην ξανακυνηγήσεις «coordinate bug» — DB-verified ότι το tool είναι σωστό στο 17M.
- Μην πειράξεις το cull fix (δουλεύει).
- Μην κάνεις `git add -A` / commit χωρίς εντολή Giorgio.

## Commit (όταν πει ο Giorgio) — stage:
code+tests (wall-gap-opening.ts, wall-merge.ts, useWallGapOpeningTool.ts, useSpecialTools-opening import, wiring 9,
dxf-viewport-culling.ts+test) + i18n (2) + docs (ADR-568, ADR-040, adr-index) + pending-ratchet.
