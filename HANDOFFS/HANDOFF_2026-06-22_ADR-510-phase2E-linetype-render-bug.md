# HANDOFF — ADR-510 Φ2E: επιλεγμένη γραμμή αλλάζει linetype αλλά ΔΕΝ φαίνεται στο canvas

> **Ημερομηνία:** 2026-06-22 · **Status:** Φ2E #1 feature ΕΤΟΙΜΟ & UNCOMMITTED· απομένει 1 render bug.
> **Commit: ΜΟΝΟ ο Giorgio.** Shared working tree (ενεργοί agents). Απάντα στα Ελληνικά.

---

## 0. ΤΙ ΔΟΥΛΕΥΕΙ ΗΔΗ (Φ2E #1 — ΜΗΝ το ξαναφτιάξεις)
Επιλέγεις γραμμή → ανοίγει contextual tab «Στυλ Γραμμής» → αλλάζεις linetype/lineweight/color με undo.
Dual-mode bridge (mirror hatch). Αρχεία (UNCOMMITTED, tsc clean, 12 jest GREEN):
- NEW `types/style-editable-primitives.ts` (SSoT predicate)
- `app/ribbon-contextual-config.ts` (grouped case → LINE_TOOL_CONTEXTUAL_TRIGGER για selected primitive)
- `ui/ribbon/hooks/useRibbonLineToolBridge.ts` (dual-mode: selected→UpdateEntityCommand· καμία→QuickStyle· linetype options=live LinetypeRegistry) **+ TEMP DIAGNOSTIC console.warn στο onComboboxChange — ΑΦΑΙΡΕΣΕ ΤΟ**
- `ui/ribbon/hooks/__tests__/useRibbonLineToolBridge.test.tsx` (12 tests)
- `app/useDxfViewerRibbon.ts` (περνά {levelManager, universalSelection})
- `rendering/entities/BaseEntityRenderer.ts` (Boy-Scout: διαγράφηκε νεκρή `applyEntityStyle`→ΕΝΑ style SSoT· ⚠️ADR-040 CHECK 6D)
- ADR-510 changelog ενημερωμένο.

## 1. ΤΟ BUG (το μόνο που απομένει)
Με τη γραμμή ΕΠΙΛΕΓΜΕΝΗ, αλλαγή linetype → **καμία οπτική αλλαγή στο canvas**.

## 2. ΤΙ ΑΠΟΚΛΕΙΣΤΗΚΕ ΟΡΙΣΤΙΚΑ (runtime-verified — ΜΗΝ ξαναψάξεις εδώ)
Console diagnostic απέδειξε, στην πραγματική αλλαγή:
```
[Φ2E onComboboxChange] value:'DashDot', selectedFound:true, selectedType:'line',
                       resolvedDef:'DashDot', resolvedPattern:'[12.7,-6.35,0,-6.35]'
```
➡️ **write φτάνει στη σωστή γραμμή ✓ · linetype resolve-άρει σε έγκυρο dash pattern ✓.**
Επίσης verified by static trace:
- `getPrimaryId()` === prop `primarySelectedId` (DxfViewerContent:197) — ΜΙΑ πηγή, καμία διπλοτυπία.
- `currentScene = currentLevelId ? getLevelScene(currentLevelId) : null` (useSceneState:47) — ίδιος gated source· το bridge βρίσκει την οντότητα.
- write μηχανισμός ταυτόσημος με working `QuickPropertiesMiniPanel` + working `useRibbonColumnBridge` (όλα `useCommandHistory().execute` + `LevelSceneManagerAdapter(levelManager.getLevelScene/setLevelScene/currentLevelId)`).
- routing OK: `useRibbonCommands.ts:245-247 isLineToolRibbonKey → lineToolBridge.onComboboxChange`.
- DxfRenderer batch path (`canvas-v2/dxf-canvas/DxfRenderer.ts:158-182`) εφαρμόζει dash ΑΛΛΑ **παρακάμπτει την επιλεγμένη** (γρ.152 `_selectionSet.has(id) continue`). Η επιλεγμένη πάει per-entity (`renderEntityUnified:286` → `LineRenderer.render` → `renderWithPhases` → `setupStyle:327 applyEntityLinetypeDash`).
- `dxf-scene-entity-converter.ts:116` μεταφέρει `linetypeName`. bitmap cache invalidate σε sceneRef change (`dxf-bitmap-cache.ts:98`).

**ΚΡΙΤΙΚΗ ΑΝΑΦΟΡΑ:** το ίδιο μέσω **QuickPropertiesMiniPanel (διπλό-κλικ)** ο Giorgio είπε «ΝΑΙ αλλάζει» — άρα ο μηχανισμός write+render ΛΕΙΤΟΥΡΓΕΙ για selected line. Άρα η διαφορά είναι λεπτή.

## 3. ΕΚΚΡΕΜΕΙ — ΠΡΩΤΗ ΕΝΕΡΓΕΙΑ ΝΕΑΣ ΣΥΝΕΔΡΙΑΣ
**ΤΕΣΤ (β) ΑΠΑΝΤΗΘΗΚΕ: ΟΧΙ** → ακόμη και μετά την αποεπιλογή, η γραμμή **ΔΕΝ** γίνεται διακεκομμένη. Άρα **καθόλου repaint** — το canvas δεν ξαναζωγραφίζει το νέο linetype. (Δεν είναι selected-render-path· είναι re-render.)

**Explore (2η διερεύνηση) πόρισμα:** οι δομές ribbon-path vs QuickProperties είναι **ΤΑΥΤΟΣΗΜΕΣ** — ίδιο global `useCommandHistory().execute`, ίδιο `LevelSceneManagerAdapter`, ίδιο `levelManager.setLevelScene`. ΔΕΝ βρέθηκε structural διαφορά. Σχετικά σημεία:
- `hooks/scene/useSceneManager.ts:30-45 setLevelScene`: guard `if (prev[levelId] === scene) return;` μετά `setLevelScenes(next)` (React state bump).
- `useAutoSaveSceneManager.ts:196-203` wrap· `LevelsSystem.tsx:218-227 setLevelScene` (sceneManagerRef.current).
- re-render chain: setLevelScenes → DxfViewerContent re-render → `useSceneState.ts:47 currentScene=getLevelScene(currentLevelId)` → `CanvasSection` → `useDxfSceneConversion` memo[currentScene] → DxfScene → `dxf-bitmap-cache.ts:98 sceneRef!==scene` invalidate.
- QuickProperties executeCommand = `CanvasSection.tsx:~125/489` `useCommandHistory().execute` (ΟΧΙ wrapped) — δηλαδή ΙΔΙΟ με ribbon.

**ΥΠΟΘΕΣΗ ΡΙΖΑΣ (να επιβεβαιωθεί runtime):** μετά το ribbon write, το `currentScene` **δεν αλλάζει reference** → useDxfSceneConversion memo δεν recompute → bitmap cache δεν invalidate → μηδέν repaint. Πιθανές αιτίες: (i) το command `execute()` κάνει silent no-op (`UpdateEntityCommand.execute:36-39 getEntity→null return`) αν ο adapter.getEntity δεν βρει την entity στο σωστό level· (ii) ο guard `prev[levelId]===scene` μπλοκάρει (το adapter επιστρέφει ίδιο scene ref;)· (iii) το `levelManager.setLevelScene` που έχει το ribbon είναι ΑΛΛΟ instance/closure από αυτό που τρέφει το `setLevelScenes` state.

**🟢 ΚΟΡΥΦΑΙΑ ΕΝΔΕΙΞΗ (Giorgio, 2026-06-22):** «η γραμμή στο canvas είναι ΠΡΑΣΙΝΗ — μήπως κρύβεται κάτι από κάτω;» → η ΠΡΑΣΙΝΗ = χρώμα ΕΠΙΛΕΓΜΕΝΗΣ οντότητας (selection highlight). Άρα η επιλεγμένη γραμμή ζωγραφίζεται με selection-style που πιθανότατα είναι **συμπαγές πράσινο stroke** και **κρύβει το dash**. **ΨΑΞΕ ΠΡΩΤΑ ΕΔΩ:** `rendering/entities/phase-manager*` (η `'selected'` φάση — `applyPhaseStyle`)· πώς ζωγραφίζεται το selection highlight (συμπαγές; πάχος;)· γιατί το `setupStyle:327 applyEntityLinetypeDash` (που τρέχει ΜΕΤΑ το applyPhaseStyle) δεν επιβάλλει dash στο selected stroke — μήπως το selection highlight είναι ΞΕΧΩΡΙΣΤΟ pass/stroke (π.χ. glow/double-stroke) που αγνοεί το dash. ⚠️ Συνδύασε με (β)=ΟΧΙ: έλεγξε ΚΑΙ αν, μετά από πραγματικό deselect, η batch γραμμή είναι solid (→ το write δεν persist-άρει) Ή dashed-αλλά-κρυμμένη-όσο-selected.

**NEXT-SESSION PLAN (runtime instrumentation — απαραίτητο):**
1. Βάλε temp log στο `hooks/scene/useSceneManager.ts setLevelScene`: log `levelId`, `prev[levelId]===scene` (guard hit;), `entity count`. Άλλαξε linetype από (α) ribbon (β) QuickProperties. Σύγκρινε: καλείται; guard μπλοκάρει; νέο scene ref;
2. Βάλε temp log στο `UpdateEntityCommand.execute` (μετά `getEntity`): είναι null; (silent no-op). Αν null → ο adapter ψάχνει λάθος level/scene.
3. Αν το command no-op-άρει: σύγκρινε `LevelSceneManagerAdapter.getEntity/getLatestScene` level vs το level όπου ζει η entity_13 (`lvl_21982f3b-...`). Πιθανό: το ribbon `levelManager.currentLevelId` ≠ level της entity τη στιγμή του event, ή ο adapter διαβάζει stale scene.
4. Αφού βρεθεί η ρίζα → fix → επαλήθευση canvas + undo.

## 4. BUG #2 (ξεχωριστό, προϋπάρχον — ΟΧΙ Φ2E)
Νέα γραμμή χωρίς edit → refresh → **χάνεται** (Giorgio επιβεβαίωσε). Οι DXF primitives δεν persist-άρονται ανά-οντότητα· μόνο scene-blob auto-save (`useAutoSaveSceneManager` origin='local-edit'). Χωριστό θέμα/ADR.

## 5. ΚΑΝΟΝΕΣ
ΕΝΑ tsc (N.17)· μηδέν any· i18n el+en· git add ΜΟΝΟ δικά μου· commit ΜΟΝΟ Giorgio. ⚠️ ΑΦΑΙΡΕΣΕ το TEMP diagnostic console.warn από το `useRibbonLineToolBridge.ts` (+ το `resolveLinetype` import αν μένει αχρησιμοποίητο) πριν το commit.
