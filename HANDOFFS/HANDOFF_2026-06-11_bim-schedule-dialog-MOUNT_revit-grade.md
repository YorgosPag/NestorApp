# HANDOFF — Mount BIM Schedule dialog στο live UI (Revit-grade «Schedules»)

**Date:** 2026-06-11 · **Branch:** main · **Shared working tree** (άλλος agent δουλεύει ταυτόχρονα — grips: column/beam/axis-box/wall) · **Μοντέλο: Opus**

> 🎯 **ΕΝΤΟΛΗ GIORGIO:** «ΟΠΩΣ ΟΙ ΜΕΓΑΛΟΙ ΠΑΙΧΤΕΣ, ΟΠΩΣ Η REVIT — ΥΛΟΠΟΙΗΣΗ ΜΕ ΣΥΣΤΗΜΑ, FULL ENTERPRISE + FULL SSOT.» **SEARCH FIRST** (τα signatures παρακάτω είναι ΗΔΗ επιβεβαιωμένα 2026-06-11 — code=SoT, ξανα-confirm μόνο αν κάτι δεν ταιριάζει). Απάντα **ΕΛΛΗΝΙΚΑ**.
>
> ⚠️ **ΚΑΝΟΝΕΣ (απαράβατοι):** ΠΟΤΕ `git commit`/`push` — **ο Giorgio κάνει commit**. `git add` **ΜΟΝΟ τα δικά σου αρχεία**, **ΠΟΤΕ `-A`** (shared tree). **N.17: ΕΝΑ tsc τη φορά** (έλεγξε process πρώτα). function ≤40γρ, file ≤500γρ, no `any`/`as any`, i18n ICU. Renderer/canvas/scene-write/guide touch → stage **ADR-040** (CHECK 6B/6D).

---

## 0. ΔΙΑΒΑΣΕ ΠΡΩΤΑ (Recognition — N.0.1 Phase 1)
1. **`docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md` §6 Phase 8** (BIM Schedule export — η οθόνη χτίστηκε εδώ· **έμεινε dormant/μη-mounted**).
2. **`ADR-441-foundation-strip-grid-auto-design.md` §10 Slice 4** — η θεμελίωση συνδέθηκε ΗΔΗ στο schedule (preset/columns/registry/net-volume). Αυτό το handoff = **ενεργοποίηση** της οθόνης ώστε να φανεί.
3. **`ADR-040-preview-canvas-performance.md`** — ΜΟΝΟ αν αγγίξεις canvas (region-pick tool· βλ. §4 Phase 2). Το dialog host **δεν** είναι canvas.
4. Αυτό το handoff (§2 signatures· §3 σχέδιο).

---

## 1. ΤΙ ΕΓΙΝΕ ΗΔΗ (DONE — μένει browser-verify+commit από Giorgio)
- **ADR-441 Slice JOIN** (corner-fill γωνιών εσχάρας, follow-move-safe μέσω `GuideBinding.extend`).
- **ADR-441 Slice 4** (BOQ θεμελίωσης + net-volume safeUnion): η θεμελίωση είναι ΗΔΗ schedulable — `mapFoundation`, `FOUNDATION_COLUMNS`, `PRESET_REGISTRY['foundation']`, `ScheduleEntityType +'foundation'`, `AnyBimEntity +FoundationEntity`, toggle `+'foundation'`, i18n el/en. Καθαρός όγκος μέσω `bim/geometry/foundation-grid-boq.ts` + `hooks/data/foundation-boq-feed.ts` (`applyFoundationGridNet`, ΗΔΗ καλείται μέσα στο `BimScheduleDialog` useMemo). 24+238 jest + tsc καθαρό.

## 1.1 ΤΟ ΠΡΟΒΛΗΜΑ ΠΟΥ ΛΥΝΕΙΣ
Το **`BimScheduleDialog` ΔΕΝ είναι mounted πουθενά** (κανένα `<BimScheduleDialog`, κανένα value-import, ο hook `useBimScheduleExport` έχει **0 consumers**). Ολόκληρη η οθόνη BIM Schedule είναι **φτιαγμένη αλλά κοιμισμένη**. Το ribbon button **υπάρχει ήδη** (Analyze tab, «Πίνακας BIM») αλλά το action `'open-schedule-dialog'` **δεν τυγχάνεται** πουθενά → κλικ = no-op.

**ΣΤΟΧΟΣ (Revit-grade):** ribbon «Πίνακας BIM» → ανοίγει dialog → τροφοδοτημένος με ΟΛΑ τα live BIM entities + lookups → ο μηχανικός βλέπει/εξάγει πίνακες (incl. «Θεμελιώσεις» με net όγκο).

---

## 2. SSoT / SIGNATURES — REUSE αυτούσια (ΕΠΙΒΕΒΑΙΩΜΕΝΑ 2026-06-11)

| Τι | Πού | Σημείωση |
|---|---|---|
| **Dialog props** | `ui/components/bim-schedule/BimScheduleDialog.tsx` (`BimScheduleDialogProps`, ~γρ.85-111) | REQUIRED: `open`, `onOpenChange`, `entities: readonly AnyBimEntity[]`, `lookups: ScheduleLookups`, `availableFloors: FilterOption[]`, `availableCategories: FilterOption[]`, `selectionIds: readonly string[]`, `activeRegion: BoundingBox3D\|null`, `onRequestRegionPick(snapshot)`, `onClearRegion()`. Optional: `availableBuildings?`, `initialEntityType?`, `initialFilters?`, `initialFormat?`. |
| **State hook (REUSE)** | `hooks/useBimScheduleExport.ts` | Επιστρέφει `{ openDialog, pendingRegionPick, dialogProps (Pick: open/onOpenChange/activeRegion/onRequestRegionPick/onClearRegion/initial*), onRegionPickCommit, onRegionPickCancel }`. Ο host **spread**-άρει `dialogProps` + δίνει τα 5 domain props (entities/lookups/availableFloors/availableCategories/selectionIds). |
| **Entity source (REUSE)** | `ui/text-toolbar/hooks/useCurrentSceneModel.ts` (`useCurrentSceneModel(): SceneModel\|null`) | `scene?.entities` = όλα τα entities του τρέχοντος level. Filter/cast σε `AnyBimEntity[]`. |
| **AnyBimEntity** | `bim/schedule/schedule-presets.ts` | union: wall/opening/slab/slab-opening/column/beam/stair/**foundation** (8 τύποι, στενότερο από `isBimEntity`). |
| **ScheduleLookups** | `bim/schedule/types.ts` | `{ floor, material, floorFinish, building?, translateKind? }`. **ΔΕΝ υπάρχει production builder** → φτιάξε **NEW SSoT** (βλ. §3 βήμα 2). Reference inline builder: `ui/components/bim-openings/OpeningSchedulePdfHost.tsx` `buildLookupsFromLevels`. |
| **Floor labels** | `levelManager.levels` (`systems/levels/config.ts` `Level.name`) ή `useLevels()` | `availableFloors = levels.map(l => ({id:l.id, label:l.name}))` + `floor` resolver. |
| **Material i18n** | `bim/materials/construction-materials.ts` `constructionMaterialLabelKey(id)` + `t(key)` (ns `dxf-viewer-shell`) | resolver `material`. |
| **Building resolver** | `src/hooks/useFirestoreBuildings.ts` | `building` resolver + `availableBuildings`. Optional (single-building → omit). |
| **Ribbon button (ΥΠΑΡΧΕΙ)** | `ui/ribbon/data/analyze-tab.ts` γρ.39-44 | `action:'open-schedule-dialog'`, label `ribbon.commands.bimSchedule` («Πίνακας BIM»). Registered ΗΔΗ στο Analyze tab. **Καμία αλλαγή ribbon data.** |
| **Action dispatch pattern (REUSE)** | `app/useDxfViewerCallbacks.ts` `wrappedHandleAction` (~γρ.154-290) | Mirror **thermal-envelope** (γρ.195): `if (action==='open-schedule-dialog') { EventBus.emit('bim:schedule-dialog-requested', {}); return; }`. |
| **Host mount pattern (REUSE)** | `app/DxfViewerDialogs.tsx` (mount) + `app/dxf-viewer-lazy-components.tsx` (lazy) + `ui/text-toolbar/DxfFindReplaceHost.tsx` (clean 56γρ host example) | Mirror `DxfFindReplaceHost` + thermal-envelope EventBus-subscribe host. |
| **Region-pick (Phase 2)** | `hooks/tools/useScheduleRegionPickTool.ts` (`SCHEDULE_REGION_PICK_TOOL`, `{activeTool,onCommit,onCancel}`) | Canvas 2-click bbox tool. Touches canvas → **ADR-040**. v1 → defer (activeRegion=null). |

---

## 3. ΣΧΕΔΙΟ — Mount Revit-grade (FULL SSoT)

### Phase 1 — Άνοιγμα dialog με live data (NO region-pick) — ΚΥΡΙΟ

1. **EventBus event type:** πρόσθεσε `'bim:schedule-dialog-requested'` στο event map (ίδιο σημείο με `bim:thermal-envelope-requested` — grep το για να βρεις το αρχείο τύπων events). Payload `{}`.
2. **NEW `hooks/data/useBimScheduleLookups.ts` (SSoT):** pure-ish hook που χτίζει `ScheduleLookups` + `availableFloors`/`availableCategories`/`availableBuildings` από `useLevels()` + `useFirestoreBuildings()` + `construction-materials` + `useTranslation`. (Αντικαθιστά τον inline `buildLookupsFromLevels` — κάν' τον SSoT, μετά migrate-on-touch το OpeningSchedulePdfHost αν θες Boy-Scout.) `availableCategories` = unique `params.material` + unique `kind` από τη λίστα entities (useMemo).
3. **NEW `app/BimScheduleHost.tsx`** (mirror `DxfFindReplaceHost` + thermal host):
   - `useBimScheduleExport()` → `{ openDialog, dialogProps, ... }`.
   - `useCurrentSceneModel()` → `entities = (scene?.entities ?? []) filtered/cast σε AnyBimEntity[]` (useMemo). Πρόσεξε: filter στους 8 schedule τύπους (όχι MEP/furniture) — χρησιμοποίησε type-guards από `types/entities.ts` ή narrow by `type`.
   - `useBimScheduleLookups(entities)` → lookups + available*.
   - `useEffect(() => EventBus.on('bim:schedule-dialog-requested', openDialog), [openDialog])` (cleanup unsub).
   - render `<BimScheduleDialog {...dialogProps} entities={entities} lookups={lookups} availableFloors={...} availableCategories={...} availableBuildings={...} selectionIds={selectionIds} />`.
   - props: `selectionIds` (από DxfViewerContent selectedEntityIds). region-pick props Phase 1 → `onRequestRegionPick` no-op/hidden ή πέρασε τα hook callbacks αλλά μην ενεργοποιήσεις το tool ακόμη (activeRegion=null).
4. **Lazy export:** πρόσθεσε `BimScheduleHost` στο `app/dxf-viewer-lazy-components.tsx` (`React.lazy`).
5. **Mount:** στο `app/DxfViewerDialogs.tsx` (μετά `ThermalEnvelopeHost`) → `<React.Suspense fallback={hiddenFallback}><BimScheduleHost selectionIds={selectedEntityIds} /></React.Suspense>`. Πρόσθεσε `selectionIds` στο `DxfViewerDialogsProps` αν δεν υπάρχει (διαθέσιμο στο `DxfViewerContent`).
6. **Action intercept:** στο `app/useDxfViewerCallbacks.ts` `wrappedHandleAction` πρόσθεσε το `if (action==='open-schedule-dialog')` EventBus emit (mirror thermal-envelope, ΠΡΙΝ το τελικό `handleAction` passthrough).

**Αποτέλεσμα Phase 1:** ribbon «Πίνακας BIM» → ανοίγει dialog → όλες οι disciplines (incl. «Θεμελιώσεις» με net όγκο). Export CSV/XLSX/PDF δουλεύει (ήδη υλοποιημένο).

### Phase 2 — Region-pick (προαιρετικό, ΟΧΙ v1)
Wire `useScheduleRegionPickTool` (activeTool toggle όταν `pendingRegionPick`, handleClick/handleEscape στο canvas pipeline, rubber-band overlay store). **Touches canvas → ADR-040 (CHECK 6B/6D).** Defer εκτός αν ο Giorgio το ζητήσει — Phase 1 δίνει πλήρη schedule χωρίς αυτό.

### 3.4 ΣΕΙΡΑ (incremental, tsc serialized)
EventBus type → useBimScheduleLookups (+test) → BimScheduleHost → lazy+mount → action intercept → tsc → browser.

### 3.5 ΡΙΣΚΑ
1. **Entity cast/filter:** `scene.entities` είναι το ευρύ union· filter στους 8 schedule τύπους πριν το cast σε AnyBimEntity (αλλιώς MEP/furniture μπαίνουν στο 'combined' λάθος). Χρησιμοποίησε type-guards, ΟΧΙ `as any`.
2. **selectionIds source:** βεβαιώσου ότι περνά live (selection-only filter axis το χρειάζεται). Διαθέσιμο στο DxfViewerContent.
3. **Lookups SSoT:** κάν' το hook, μην κάνεις copy τον inline builder του OpeningSchedulePdfHost (N.0.2).
4. **Region-pick:** αν το πιάσεις, ADR-040 staging + canvas tool integration (μεγαλύτερο scope).
5. **shared tree:** άλλος agent στα grips — git add ΜΟΝΟ δικά σου.

---

## 4. ΚΑΝΟΝΕΣ / WORKING TREE
- **Δικά σου (NEW):** `app/BimScheduleHost.tsx`, `hooks/data/useBimScheduleLookups.ts` (+test). **MOD:** `app/DxfViewerDialogs.tsx`, `app/dxf-viewer-lazy-components.tsx`, `app/useDxfViewerCallbacks.ts`, event-map types. **Stage ADR-040** μόνο αν πιάσεις Phase 2 (region-pick canvas).
- **ΑΛΛΟΥ agent (ΜΗΝ αγγίξεις):** grips (column/beam/axis-box/wall), accounting. **ΠΟΤΕ `git add -A`.**
- N.17: ΕΝΑ tsc τη φορά (`Get-CimInstance Win32_Process ... *tsc*` πρώτα).
- N.15 docs: ADR-363 §6 Phase 8 changelog (dialog mounted) + ADR-441 (foundation πλέον ορατή) + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + MEMORY. **ΜΗΝ** adr-index (shared tree).
- **COMMIT ΤΟΝ ΚΑΝΕΙ Ο GIORGIO.**

## 5. QUICK START
1. Recognition: ADR-363 §6 Phase 8 + §2 signatures αυτού του handoff.
2. `git status` (Slice JOIN+4 ΗΔΗ στο working tree/committed· grips από άλλον agent — μην τα αγγίξεις).
3. Phase 1 incremental (§3.4). tsc serialized. ΜΗΝ commit/push.
4. Browser-verify: ribbon **Analyze → «Πίνακας BIM»** → dialog ανοίγει → discipline **«Θεμελιώσεις»** → βλέπεις λωρίδες εσχάρας με **net** όγκο (άθροισμα στήλης = καθαρός όγκος, χωρίς διπλομέτρηση κόμβων) → δοκίμασε export XLSX.
