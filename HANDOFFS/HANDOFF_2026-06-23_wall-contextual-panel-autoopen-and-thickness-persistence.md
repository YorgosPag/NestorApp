# HANDOFF — Τοίχος: (A) auto-open contextual tab + αριστερό panel στην εντολή, (B) πάχος δεν σώζεται (Firestore)

**Ημ/νία:** 2026-06-23
**Τύπος:** 2 tasks — (A) UX wiring (ribbon contextual tab + left property panel on tool-activate), (B) persistence bug fix (wall thickness δεν σώζεται μετά από refresh). **FULL ENTERPRISE + FULL SSoT, Revit-grade.**
**Μοντέλο:** Opus (2 domains: ribbon/panel UI + Firestore persistence· cross-cutting· πιθανώς 5+ αρχεία).
**⚠️ Working tree SHARED με άλλον agent** — `git add` ΜΟΝΟ δικά σου αρχεία, **ΠΟΤΕ** `git add -A`. **COMMIT ο Giorgio, ΟΧΙ εσύ** (N.(-1)).
**Γλώσσα:** απαντάς ΠΑΝΤΑ στα Ελληνικά.

---

## 0. ΖΗΤΟΥΜΕΝΟ (Giorgio, verbatim πνεύμα)

1. **(A)** Όταν επιλέγω την εντολή **-Τοίχος-** να ανοίγει **αυτόματα** ΚΑΙ το **contextual tab** «Ιδιότητες Τοίχου» (πάνω ribbon) ΚΑΙ οι **παράμετροι αριστερά** (το property panel με «ΣΥΝΘΕΣΗ ΣΤΡΩΣΕΩΝ» / Πυρήνας / Πάχος). Σήμερα εμφανίζονται μόνο όταν **επιλέγω** υπάρχοντα τοίχο, όχι όταν ενεργοποιώ το **εργαλείο σχεδίασης**.
2. **(B)** Όταν αλλάζω **πάχος** τοίχου (αριστερό panel, layer composition) και πατάω **«Αποθήκευση τώρα»**, **δεν αποθηκεύεται**: μετά από **refresh (F5)** η τιμή επανέρχεται στο παλιό πάχος → **Firestore δεν σώζει** τη νέα τιμή.

**Revit-grade, FULL SSoT, μηδέν διπλότυπα.**

---

## 1. ⚠️ ΥΠΟΧΡΕΩΤΙΚΟ SSoT AUDIT (GREP) ΠΡΙΝ ΚΩΔΙΚΑ — εντολή Giorgio

Πριν γράψεις ΟΤΙΔΗΠΟΤΕ, τρέξε grep για να βρεις τον υπάρχοντα κώδικα και να τον **reuse**, ΟΧΙ διπλότυπο:

```
# (A) Πώς αποφασίζεται το ενεργό contextual tab (tool vs selection) + πώς ανοίγει το αριστερό panel
grep -n "useActiveContextualTrigger\|WALL_CONTEXTUAL_TRIGGER\|COLUMN_CONTEXTUAL_TRIGGER\|activeTool" src/subapps/dxf-viewer/app/ribbon-contextual-config.ts
grep -n "visibleContextualTabs\|activeContextualTab\|setActiveTab\|auto.*activate" src/subapps/dxf-viewer/ui/ribbon/components/RibbonRoot.tsx
grep -rn "isWallEntity\|isColumnEntity\|selected &&\|activeTool" src/subapps/dxf-viewer/ui/wall-advanced-panel/BimPropertiesRouter.tsx
grep -n "useSelectedWall\|primarySelectedId\|useResolvedSelectedEntity" src/subapps/dxf-viewer/ui/wall-advanced-panel/WallPropertiesTab.tsx src/subapps/dxf-viewer/ui/wall-advanced-panel/hooks/useSelectedWall.ts
# Υπάρχει ΗΔΗ draw-time defaults SSoT για τον τοίχο; (overrides bridge)
grep -n "wallToolBridgeStore\|setParamOverrides\|WallParamOverrides\|buildDefaultWallParams" src/subapps/dxf-viewer/ui/ribbon/hooks/bridge/wall-tool-bridge-store.ts src/subapps/dxf-viewer/hooks/drawing/wall-completion.ts

# (B) Η ΑΛΥΣΙΔΑ persistence πάχους — πού σπάει
grep -n "saveNow\|persist\|selectedWallRef\|primarySelectedWall\|persistOnce" src/subapps/dxf-viewer/hooks/data/useWallPersistence.ts
grep -n "wallUpdatePatch\|migrateParamsToMm\|params:\|thickness\|dna\|updateWall\|saveWall" src/subapps/dxf-viewer/hooks/data/wall-persistence-helpers.ts
grep -n "dispatchPatch\|UpdateWallParamsCommand\|thickness\|totalThickness\|dna" src/subapps/dxf-viewer/ui/wall-advanced-panel/sections/WallDnaSection.tsx src/subapps/dxf-viewer/ui/wall-advanced-panel/commands/dispatchWallParamPatch.ts
sed -n '1,120p' src/subapps/dxf-viewer/core/commands/entity-commands/UpdateWallParamsCommand.ts
# UpdateWallParamsCommand = μέλος της οικογένειας MergeableUpdateCommand<TPatch> (ADR-507 §8)
grep -rn "class UpdateWallParamsCommand\|extends MergeableUpdateCommand\|setLevelScene\|applyPatch\|serialize" src/subapps/dxf-viewer/core/commands/entity-commands/UpdateWallParamsCommand.ts
```

---

## 2. ΕΥΡΗΜΑΤΑ ΕΡΕΥΝΑΣ (2026-06-23 — μην τα ξανα-ανακαλύψεις)

### PART A — contextual tab + αριστερό panel

- **Contextual tab (πάνω ribbon):** ΥΠΑΡΧΕΙ ΗΔΗ λογική ενεργοποίησης ΓΙΑ ΤΟ ΕΡΓΑΛΕΙΟ:
  `app/ribbon-contextual-config.ts` → `useActiveContextualTrigger()` (~149-337). Στο **tool-fallback** (όταν δεν υπάρχει selection) επιστρέφει `WALL_CONTEXTUAL_TRIGGER` για `activeTool === 'wall' || isWallRegionTool(...) || 'wall-from-perimeter'` (~243-247). Η κολώνα έχει ίδιο pattern (~255-262).
  → Επιβεβαίωσε ΓΙΑΤΙ δεν ανοίγει/εστιάζει για τον Giorgio: `ui/ribbon/components/RibbonRoot.tsx` (~74-100) κάνει **auto-activate** το πρώτο visible contextual tab όταν αλλάζει το `visibleContextualTabs`. Πιθανό: το selection trigger υπερισχύει, ή το auto-switch δεν τρέχει σε tool-activate, ή χρειάζεται explicit setActiveTab on wall-tool activate.
- **Αριστερό panel:** `ui/wall-advanced-panel/BimPropertiesRouter.tsx` (~38-86) — δείχνει panel **ΜΟΝΟ σε επιλεγμένη οντότητα**: `const selected = useResolvedSelectedEntity(...); if (selected && isWallEntity(selected)) return <WallPropertiesTab/>` (~46-50). **Δεν** ελέγχει καθόλου `activeTool`. Ίδιο και για column/beam/slab/foundation (~53-72) → **όλα** απαιτούν selection.
  - `WallPropertiesTab.tsx` (~34-50) → `useSelectedWall(primarySelectedId, currentScene)` επιστρέφει `null` χωρίς selection → empty state.
- **Draw-time defaults SSoT:** ο τοίχος ΗΔΗ έχει `wallToolBridgeStore.setParamOverrides` (draw params: category/height/thickness/flip/tilt) — το **πάνω** contextual tab το χρησιμοποιεί (μέσω `useRibbonWallBridge`). Άρα το «draft τοίχος για το panel» πρέπει να διαβάζει/γράφει ΑΥΤΟ το SSoT (ΟΧΙ νέο store).

### PART B — πάχος δεν σώζεται (Firestore· repro: F5 → revert)

Αλυσίδα (φαίνεται σωστή «στα χαρτιά» — βρες πού σπάει):
1. Αλλαγή πάχους core layer → `WallDnaSection.tsx` (~37-45) `onChange` → `dispatchPatch(wall, { dna: next, thickness: next.totalThickness })` (SSoT invariant: thickness ≡ dna.totalThickness).
2. `dispatchWallParamPatch.ts` `useWallParamsDispatcher` (~49-69): `merged={...wall.params,...patch}` → `detachSidesAffectedByVerticalEdit` → `executeCommand(new UpdateWallParamsCommand(wall.id, next, wall.params, sm, false, wall.kind))`. **Ενημερώνει SCENE** μέσω `LevelSceneManagerAdapter(getLevelScene,setLevelScene,currentLevelId)`.
3. «Αποθήκευση τώρα» → `WallPersistenceSection.tsx` (~84) `onClick={() => void saveNow()}`.
4. `useWallPersistence.ts`: `saveNow()` (~285-293) → καθαρίζει timer → `persist(wall)`. `persistOnce()` (~197-245) → `saveWall()`/`updateWall()`. **ΚΡΙΣΙΜΟ:** `selectedWallRef.current = primarySelectedWall` (~132-133) — το `saveNow` σώζει ΑΥΤΗ την αναφορά.
5. Firestore patch: `wall-persistence-helpers.ts` `wallUpdatePatch(entity)` (~174) γράφει `params: entity.params` (περιλαμβάνει thickness + dna). ⚠️ Υπάρχει `migrateParamsToMm(params)` (~29-43) που **πολλαπλασιάζει** `thickness`/`dna.totalThickness`/`layers[].thickness` επί `k` (unit migration) — **ΕΛΕΓΞΕ** μήπως γίνεται double-convert/round-trip distortion στο read.

**ΥΠΟΨΙΕΣ ΡΙΖΑΣ (επιβεβαίωσε με grep/trace, ΜΗΝ μαντέψεις):**
- **(πιθανότερο)** `saveNow` διαβάζει **stale** `primarySelectedWall`: το `UpdateWallParamsCommand` ενημερώνει το **scene** (setLevelScene), αλλά το `primarySelectedWall` prop στο `useWallPersistence` δεν re-sync-άρει με τα νέα params πριν το `saveNow` → Firestore παίρνει το **παλιό** thickness. (Έλεγξε αν το `primarySelectedWall` παράγεται από `getLevelScene()` φρέσκο μετά το command, ή είναι snapshot.)
- ή το auto-save debounce (~256-283) τρέχει με stale state και «κλειδώνει» το παλιό· το `saveNow` clear-άρει timer αλλά όχι in-flight write.
- ή το `migrateParamsToMm` στο **read** ξανα-εφαρμόζει `k` → η τιμή «επανέρχεται» (αν το saved ήταν ήδη mm).
- ή `UpdateWallParamsCommand` (MergeableUpdateCommand<TPatch>, ADR-507 §8) ΔΕΝ commit-άρει σωστά το patch στο scene (απίθανο — undo/redo δουλεύει· αλλά επιβεβαίωσε `applyPatch`/`setLevelScene`).

---

## 3. ΠΡΟΤΕΙΝΟΜΕΝΗ ΥΛΟΠΟΙΗΣΗ (κλείδωσε σε Plan Mode πριν τον κώδικα)

### PART A
1. **Αριστερό panel on tool-activate** — `BimPropertiesRouter.tsx`: επέκτεινε το gate ώστε όταν `activeTool === 'wall'` (& καμία selection) να δείχνει το `WallPropertiesTab` σε **draft mode** που διαβάζει/γράφει τα draw-defaults από το **`wallToolBridgeStore`** (SSoT — ΟΧΙ νέο store, ΟΧΙ entity). Κάνε το **generic/Revit-grade**: ίδιο pattern για column/beam (μην το hardcode μόνο στον τοίχο αν γίνεται SSoT factory). Πρόσεξε: το `WallPropertiesTab`/`useSelectedWall` περιμένει `WallEntity` — χρειάζεται «virtual/draft wall» από `buildDefaultWallParams(overrides)` ή adapter (reuse, μηδέν διπλό param-resolution).
2. **Contextual tab auto-focus** — αν δεν εστιάζει στο tool-activate, διόρθωσε το auto-activate στο `RibbonRoot.tsx`/`useActiveContextualTrigger` ώστε το tool trigger να ανοίγει & να εστιάζει το tab (reuse την υπάρχουσα λογική).

### PART B
- Διόρθωσε το **πραγματικό σημείο που σπάει** (από το audit): πιθανότατα να εξασφαλίσεις ότι το `saveNow`/`persistOnce` σώζει την **φρέσκια** οντότητα από το `getLevelScene()` (post-command) ΟΧΙ stale prop· ή να διορθώσεις το `migrateParamsToMm` round-trip. **Reuse** την υπάρχουσα persistence SSoT (`useWallPersistence` + `wallUpdatePatch`), ΜΗΝ φτιάξεις παράλληλο write path. Enterprise IDs (N.6) — ο τοίχος ήδη υπάρχει (update, όχι create).
- **Test:** αλλαγή πάχους → Αποθήκευση → **F5** → η τιμή ΠΑΡΑΜΕΝΕΙ. (+ undo/redo ακέραιο, ADR-507 §8.)

---

## 4. ΚΡΙΣΙΜΑ ΑΡΧΕΙΑ
**Part A:** `app/ribbon-contextual-config.ts`, `ui/ribbon/components/RibbonRoot.tsx`, `ui/wall-advanced-panel/BimPropertiesRouter.tsx`, `ui/wall-advanced-panel/WallPropertiesTab.tsx` (+`hooks/useSelectedWall.ts`), `ui/ribbon/hooks/bridge/wall-tool-bridge-store.ts`, `hooks/drawing/wall-completion.ts` (buildDefaultWallParams).
**Part B:** `hooks/data/useWallPersistence.ts`, `hooks/data/wall-persistence-helpers.ts`, `ui/wall-advanced-panel/sections/{WallPersistenceSection,WallDnaSection}.tsx`, `ui/wall-advanced-panel/commands/dispatchWallParamPatch.ts`, `core/commands/entity-commands/UpdateWallParamsCommand.ts`.
**Σχετικά ADR:** ADR-363 (wall drawing/panel), ADR-507 §8 (MergeableUpdateCommand base — [[reference_mergeable_update_command_base]]), ADR-031 (command-history), ADR-017/210/294 (enterprise IDs), ADR-001 (Radix Select αν αγγίξεις dropdown).

## 5. ΚΑΝΟΝΕΣ ΕΚΤΕΛΕΣΗΣ
- **SSoT audit (grep §1) ΠΡΙΝ κώδικα** — εντολή Giorgio. Reuse, μηδέν διπλότυπα. **Plan Mode πρώτα** (κλείδωσε approach).
- **N.17:** ΕΝΑΣ tsc τη φορά (έλεγξε process πριν). **N.11:** strings → i18n (el+en· locale JSON πρώτα). **N.(-1.1):** ΟΧΙ `--no-verify`.
- **Shared tree:** `git add` ΜΟΝΟ δικά σου. **COMMIT ο Giorgio.** jest + tsc + browser-verify.
- N.15: μετά την υλοποίηση → ADR changelog + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + adr-index + MEMORY (ίδιο commit, αλλά commit=Giorgio).

## 6. DEFINITION OF DONE
- **(A)** Επιλογή εντολής Τοίχος → ανοίγει αυτόματα ΚΑΙ το contextual tab «Ιδιότητες Τοίχου» ΚΑΙ το αριστερό property panel (σε draft mode από draw-defaults SSoT), Revit-grade.
- **(B)** Αλλαγή πάχους + Αποθήκευση → **persist** (μένει μετά από F5)· undo/redo ακέραιο· μηδέν διπλό persistence path.
- FULL SSoT (μηδέν διπλότυπα, audit-verified)· i18n el+en· jest GREEN· tsc clean· browser-verified. **Commit: Giorgio.**
