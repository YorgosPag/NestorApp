# HANDOFF — 2026-06-02 — ADR-406 DONE (committed+deployed) → MEP fixture canvas bug NEXT

> **Γλώσσα:** Giorgio γράφει/διαβάζει Ελληνικά → απαντάς ΠΑΝΤΑ Ελληνικά.
> **Μοντέλο:** Sonnet αρκεί (στοχευμένο bugfix 2-4 αρχεία)· Opus αν αποδειχθεί cross-cutting.
> **Mode:** PHASE 1 RECOGNITION → fix → verify. ΟΧΙ orchestrator (μικρό scope).

---

## 0) ΚΡΙΣΙΜΟΙ ΚΑΝΟΝΕΣ (ΜΗΝ ΤΟΥΣ ΠΑΡΑΒΕΙΣ)
- 🚨 **COMMIT/PUSH ΤΑ ΚΑΝΕΙ Ο GIORGIO, ΟΧΙ ΕΣΥ** (N.-1). Ποτέ `git commit`/`push` αυτόνομα.
- 🚨 **SHARED WORKING TREE με άλλον agent.** ΠΟΤΕ `git add -A`, ΠΟΤΕ `git checkout/restore` σε αρχεία άλλου. Μόνο specific `git add <file>`· πριν → `git diff --cached` έλεγχος.
  - **Γνωστά ΞΕΝΑ uncommitted αρχεία (ADR-363 Φ3c, ΜΗΝ τα αγγίξεις):** `src/subapps/dxf-viewer/hooks/useDxfViewerNotifications.ts`, `src/subapps/dxf-viewer/ui/dialogs/ColumnPerimeterConfirmDialog.tsx`.
- 🚨 ΠΟΤΕ `--no-verify`. SSoT + GOL + i18n (μηδέν hardcoded). `any`/`as any`/`@ts-ignore` απαγορευμένα.

---

## 1) ΤΙ ΟΛΟΚΛΗΡΩΘΗΚΕ — ADR-406 Point-Based MEP Fixture (Φωτιστικό)

**Πλήρες vertical slice, COMMITTED + DEPLOYED:**
- Feature commit **`cdada318`** (63 αρχεία) · Security rules commit **`63974a2c`**.
- Firestore **indexes deployed** + **rules deployed** στο `pagonis-87766` (μηδέν drift, deployed==committed).
- Generic EntityType `'mep-fixture'` + kind/category `'light-fixture'` (discipline=electrical)· free-point placement (2D + 3D raycast)· 2D family-symbol + 3D solid· persist (setDoc + `generateMepFixtureId`)· discipline visibility reuse ADR-405. **43/43 tests, tsc 0.**
- Λεπτομέρειες: `docs/centralized-systems/reference/adrs/ADR-406-point-based-mep-fixture.md` + memory `project_adr406_mep_fixture.md`.

---

## 2) ΤΟ BUG (να διορθωθεί ΤΩΡΑ)

**Συμπτώματα Giorgio:** «Επιλέγω Δομικά Στοιχεία → "Φωτιστικό", κάνω κλικ στον καμβά → δεν βλέπω να γίνεται τίποτα.»

**Runtime logs (2026-06-02 09:50, dev) — ΚΡΙΣΙΜΑ:**
```
[API] 400: Invalid entityType. Valid: contact, building, property, project, parking,
  storage, wall, opening, slab, slab-opening, column, beam, stair
 POST /api/audit-trail/record 400 in 581ms   (×2 — δύο κλικ)
```

**Τι αποδεικνύουν τα logs:**
- ✅ Το **tool ΛΕΙΤΟΥΡΓΕΙ**: το click φτάνει στο commit path (`useMepFixtureTool.onCanvasClick` → `buildMepFixtureEntity` → `onMepFixtureCreated` → persist → `recordMepFixtureChange`). Άρα η ενεργοποίηση + click routing + entity build **δουλεύουν**.
- ❌ Το audit POST επιστρέφει **400** γιατί το `'mep-fixture'` λείπει από το **server-side** allowlist (≠ client `audit-tracked-fields.ts` που ΕΧΕΙ ενημερωθεί).

### 🐛 BUG #1 — Server-side audit entityType allowlist (CONFIRMED, εύκολο)
Το `'mep-fixture'` λείπει από **3** server-side Sets + πιθανώς τον τύπο `AuditEntityType`:
- `src/app/api/audit-trail/record/route.ts:35` — `VALID_ENTITY_TYPES` (αυτό πετάει το 400 στα logs)
- `src/app/api/audit-trail/global/route.ts:62` — `VALID_ENTITY_TYPES`
- `src/app/api/audit-trail/[entityType]/[entityId]/route.ts:27` — `VALID_ENTITY_TYPES`
- **`AuditEntityType`** type (από `@/types/audit-trail`) — πρόσθεσε `'mep-fixture'` (αλλιώς το Set literal δεν θα κάνει type-check)· έλεγξε επίσης `getTrackedFieldsForEntityAuditType` (ΗΔΗ έχει `'mep-fixture'` branch — ADR-406).
- **Fix:** πρόσθεσε `'mep-fixture'` στον τύπο + στα 3 Sets. Αυτό κάνει το audit να περνά (200). **ΑΛΛΑ** το audit είναι fire-and-forget (`.catch(()=>{})`) → **ΔΕΝ** είναι η αιτία του «δεν εμφανίζεται».

### 🐛 BUG #2 — Το fixture ΔΕΝ εμφανίζεται στον 2D καμβά (το κύριο παράπονο, χρειάζεται RECOGNITION)
Το entity δημιουργείται (logs το αποδεικνύουν) αλλά δεν ζωγραφίζεται. **Δεν προλάβαμε root-cause.** PHASE 1 RECOGNITION checklist — βάλε runtime logs/breakpoints στη σειρά και βρες πού σπάει:

1. **`onMepFixtureCreated` → `addMepFixtureToScene`** (`bim/mep-fixtures/add-mep-fixture-to-scene.ts` → `appendEntityToScene`): επιβεβαίωσε ότι `accessor.currentLevelId` ΔΕΝ είναι null (αλλιώς **no-op** — δεν προστίθεται στο scene). Σε ένα νέο/μη-αποθηκευμένο σχέδιο μπορεί να μην υπάρχει active level.
2. **2D dispatch** (`rendering/core/EntityRendererComposite.ts`): `renderers.get('mep-fixture')` → επιβεβαίωσε ότι ο `MepFixtureRenderer.render` ΚΑΛΕΙΤΑΙ για το νέο entity.
3. **Visibility gate** (`MepFixtureRenderer.render` → `resolveIsEntityVisible({category:'light-fixture', discipline}, {objectStyles, disciplineVisibility, layer})`):
   - `disciplineVisibility` DEFAULT = `{}` (κενό, βλ. `config/bim-render-settings-types.ts:60` `?? {}`). Ο resolver κρύβει μόνο αν `=== false`· `undefined` → visible. **Άρα ΘΕΩΡΗΤΙΚΑ ΟΚ** — αλλά επιβεβαίωσέ το (μήπως ο ADR-405 resolver μετατρέπει undefined→false για non-listed disciplines; ΕΛΕΓΞΕ `bim/visibility/visibility-resolver.ts` την 5η source).
   - `objectStyles['light-fixture']`: το `DEFAULT_OBJECT_STYLES` ΕΧΕΙ entry, αλλά το **store state** μπορεί να αρχικοποιήθηκε από persisted settings που ΔΕΝ έχουν το νέο category → undefined (resolver: undefined→visible, OK). Επιβεβαίωσε.
4. **Geometry/scale**: `computeMepFixtureGeometry` χρησιμοποιεί `sceneUnits` (mm→canvas `s`). Σε σχέδιο **μέτρων** πρόσεξε το γνωστό 1000× pattern (βλ. memory `project_adr402_meterscale_vanish_fix`). Επιβεβαίωσε ότι το footprint πέφτει ΣΤΟ click point + σωστή κλίμακα (όχι microscopic/εκτός viewport). Το `getSceneUnits` στο tool διαβάζει `resolveSceneUnits(levelManager.getLevelScene(lid))`.
5. **3D**: αν το 2D δουλέψει αλλά όχι το 3D → `BimSceneLayer.syncFixtures` + `fixtureToMesh` + `Bim3DEntitiesStore.fixtures` (feed από `MepFixturePersistenceHost`).

**Πιο πιθανά (priority):** (1) currentLevelId null → append no-op · (3) visibility resolver κρύβει electrical · (4) scale/position. Ξεκίνα από #1 και #3.

---

## 3) ΑΡΧΕΙΑ-ΚΛΕΙΔΙΑ (όλα ADR-406, committed)
- Tool: `hooks/drawing/useMepFixtureTool.ts` · `mep-fixture-completion.ts` · `bim/mep-fixtures/add-mep-fixture-to-scene.ts`
- Click routing: `hooks/canvas/useCanvasClickHandler.ts` (PRIORITY 4.92) · `canvas-click-types.ts` · `CanvasSection.tsx`
- Render 2D: `bim/renderers/MepFixtureRenderer.ts` · `rendering/core/EntityRendererComposite.ts`
- Geometry/visibility: `bim/mep-fixtures/mep-fixture-geometry.ts` · `bim/visibility/visibility-resolver.ts` (ADR-405) · `config/bim-object-styles.ts` · `bim/discipline/bim-discipline.ts`
- Persist: `hooks/data/useMepFixturePersistence.ts` · `app/MepFixturePersistenceHost.tsx` · `bim/mep-fixtures/mep-fixture-firestore-service.ts`
- 3D: `bim-3d/scene/BimSceneLayer.ts` (syncFixtures) · `bim-3d/converters/BimToThreeConverter.ts` (fixtureToMesh) · `bim-3d/stores/Bim3DEntitiesStore.ts`
- Audit (BUG #1): `src/app/api/audit-trail/{record,global,[entityType]/[entityId]}/route.ts` + `@/types/audit-trail`

---

## 4) SSoT / πρότυπο
Πάντα πρότυπο η **κολώνα** (column): `useColumnTool`, `ColumnRenderer`, `columnToMesh`, `useColumnPersistence`, `column-audit-client`. Το fixture είναι 1:1 mirror. Αν κάτι δουλεύει στο column αλλά όχι στο fixture → σύγκρινε τα δύο paths.

---

**TL;DR:** ADR-406 DONE+committed (`cdada318`+`63974a2c`)+deployed. Το tool δουλεύει (commit τρέχει). **BUG #1**: πρόσθεσε `'mep-fixture'` στα 3 server audit `VALID_ENTITY_TYPES` + `AuditEntityType` (confirmed 400). **BUG #2**: το fixture δεν renders — RECOGNITION από #1 (currentLevelId null→append no-op) & #3 (visibility resolver). Commit ο Giorgio, shared tree (specific add μόνο, 2 ξένα αρχεία ΜΗΝ αγγίξεις).
