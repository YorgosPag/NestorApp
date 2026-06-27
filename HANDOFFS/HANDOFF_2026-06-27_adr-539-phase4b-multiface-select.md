# HANDOFF — ADR-539 «Polygon Mode» · Φ4b (multi-face select με Shift + batch paint = ΕΝΑ undo)

**Date:** 2026-06-27 · **Model:** Opus 4.8 · **Mode:** Plan Mode πρώτα (single domain, ~6 αρχεία)
**Quality:** Maxon Cinema 4D «Polygon Mode» multi-select / Revit «Paint on multiple faces» —
**FULL ENTERPRISE + FULL SSOT, μηδέν διπλότυπα.**

---

## 🎯 ΣΤΟΧΟΣ
Σήμερα η επιλογή όψης είναι **single** (`selectedFace`). Η Φ4b το κάνει **multi**: Shift+κλικ προσθέτει/
αφαιρεί όψεις (σαν το Cinema 4D), N highlight overlays ταυτόχρονα, και κάθε βαφή/καθαρισμός/paste
εφαρμόζεται σε **ΟΛΕΣ** τις επιλεγμένες όψεις με **ΕΝΑ atomic undo step**. Cross-entity (όψεις από
διαφορετικά solids ταυτόχρονα) πρέπει να δουλεύει.

> **Η Φ4a (keyboard + entity-level copy/paste) ΟΛΟΚΛΗΡΩΘΗΚΕ** (πιθανώς ήδη committed — δες §GIT).
> Η Φ4b ΧΤΙΖΕΙ πάνω της: το store/panel/keyboard της Φ4a επεκτείνονται για το set επιλεγμένων όψεων.

---

## 🚨 ΠΡΩΤΟ ΒΗΜΑ — ΥΠΟΧΡΕΩΤΙΚΟ SSoT AUDIT (GREP) ΠΡΙΝ ΓΡΑΨΕΙΣ ΚΩΔΙΚΑ
**Μην εμπιστευτείς τυφλά αυτό το handoff.** Κάνε ΠΡΑΓΜΑΤΙΚΟ grep — reuse ό,τι υπάρχει, ΜΗΝ ξαναγράψεις.
Τα παρακάτω επαληθεύτηκαν με grep/read στις 2026-06-27 — **ξανα-ελέγξέ τα** (shared tree· ίσως άλλαξαν).

### 🔑 ΤΙ ΥΠΑΡΧΕΙ ΗΔΗ (verified — ΜΗΝ το ξαναφτιάξεις)

| Κομμάτι | Τι υπάρχει ΗΔΗ | Πού |
|---------|----------------|-----|
| **Single selection store** | `selectedFace: SelectedFace3D \| null` + `selectFace(face\|null)`. `SelectedFace3D = {bimId, faceKey}` | `bim-3d/stores/PolygonMode3DStore.ts` (55γρ) |
| **Highlight geometry SSoT** | `faceGroupRange(mesh, faceKey)` + `sliceFaceGeometry(geo, start, count)` — slice ΜΙΑΣ όψης από group range. **ΕΝΑ overlay** (`overlay: Mesh\|null`, `targetBimId/FaceKey`). `setTarget`/`refresh`/`dispose` | `bim-3d/systems/selection/FaceSelectionHighlighter.ts` (113γρ) |
| **Manager wiring** | `faceHighlighter` (μπλε) + `faceHoverHighlighter` (κίτρινο) = **single instances**. `setSelectedFace(bimId,faceKey)`→`faceHighlighter.setTarget(...)`+`markSceneDirty`. `refresh()` ×2 μετά από rebuild (γρ.330/356). `setHoveredFace` για hover | `bim-3d/scene/ThreeJsSceneManager.ts` (γρ.79-80,158-159,330,356,409-414) |
| **Click face-pick** | γρ.141-151: Polygon-Mode plain click → `selectFace({bimId,faceKey})` + `manager.setSelectedFace(...)`· miss → clear. **ΧΩΡΙΣ Shift.** ⚠️ ADR-040 6B/6D αρχείο | `bim-3d/viewport/use-bim3d-pointer-handlers.ts` |
| **Entity-level shift-toggle pattern** | γρ.159: `if (e.shiftKey) manager.toggleBimEntity(hit.bimId); else manager.selectBimEntity(hit.bimId)` — **ΑΚΡΙΒΩΣ το pattern που θες για όψεις** (mirror) | ίδιο αρχείο γρ.152-161 |
| **Batch = ΕΝΑ undo** | `CompositeCommand(children[])` — GoF Composite/transaction· `execute()` τρέχει όλα forward, `undo()` reverse. ✅ ΥΠΑΡΧΕΙ | `core/commands/CompositeCommand.ts` |
| **Per-face writer (child)** | `SetFaceAppearanceCommand(entityId, faceKey, value\|null, sceneManager)` — generic base-field, reuse `signalEntitiesAttached` | `core/commands/entity-commands/SetFaceAppearanceCommand.ts` |
| **Apply wiring (single)** | `applyFaceAppearance(levels, bimId, faceKey, value\|null)` — adapter + `getGlobalCommandHistory().execute(cmd)` | `bim-3d/ui/apply-face-appearance.ts` |
| **Panel apply** | `PolygonMaterialPanel.apply(value)` διαβάζει `selectedFace` (single) → `applyFaceAppearance`. Custom color + clear ίδια | `bim-3d/ui/PolygonMaterialPanel.tsx` (134γρ) |
| **Φ4a keyboard** | `use-polygon-clipboard-shortcuts.ts` — paste/clear διαβάζουν `selectedFace` (single) | `bim-3d/viewport/use-polygon-clipboard-shortcuts.ts` |

**ΣΥΜΠΕΡΑΣΜΑ:** Το νέο work = (1) set στο store, (2) Shift-toggle στο click (mirror γρ.159), (3) N overlays
(extend highlighter), (4) batch apply με **CompositeCommand** (ΥΠΑΡΧΕΙ). Καμία νέα geometry, κανένα νέο
command primitive — μόνο **σύνθεση** υπαρχόντων SSoT.

---

## 🏛️ ΠΡΟΤΕΙΝΟΜΕΝΟ ΣΧΕΔΙΟ (κάνε δικό σου audit/Plan Mode πρώτα)

### 1) Store — `PolygonMode3DStore`
- Πρόσθεσε `selectedFaces: readonly SelectedFace3D[]` (source of truth). Κράτα `selectedFace` ως **anchor**
  (primary· το χρειάζονται το panel + το Φ4a entity-level copy που θέλει ένα `bimId`). Anchor = last toggled.
- `toggleFace(face)` (add αν λείπει / remove αν υπάρχει, key = `${bimId}|${faceKey}`), `selectFace(face|null)`
  **κράτα τη σημασία** «replace με single» (sets `selectedFaces=[face]` ή `[]`)· `clearFaces()`.
- ⚠️ Μηδέν high-freq δεδομένα (ADR-040 — όπως τώρα).

### 2) Click — `use-bim3d-pointer-handlers.ts` (⚠️ ADR-040 6B/6D → stage ADR-040+539)
- Στο Polygon-Mode branch (γρ.141): `if (e.shiftKey) togglε στο set· else selectFace(single)`.
  **Mirror ΑΚΡΙΒΩΣ** το entity-level pattern γρ.159 (`toggleBimEntity`/`selectBimEntity`).
- Καλεί `manager.setSelectedFaces(store.getState().selectedFaces)` (νέο, βλ. #4).
- Το context-menu (γρ.185) + drag-drop μένουν single-anchor (μην τα μπλέξεις).

### 3) Highlighter — N overlays
- **Extend** το `FaceSelectionHighlighter` με `setTargets(faces: readonly {bimId,faceKey}[])` που κρατά
  **array** από overlays (αντί ενός). **Reuse `faceGroupRange` + `sliceFaceGeometry` αυτούσια.** `refresh()`
  ξαναχτίζει όλα. Κράτα `setTarget` ως convenience = `setTargets(face ? [face] : [])` (ώστε hover + call-sites
  να μη σπάσουν). Πρόσεξε dispose/clear ΟΛΩΝ των overlays (μηδέν leak).
- ⚠️ Ο `faceHoverHighlighter` μένει **single** (hover = μία όψη). Μόνο ο `faceHighlighter` γίνεται multi.

### 4) Manager — `ThreeJsSceneManager`
- `setSelectedFaces(faces)` → `faceHighlighter.setTargets(faces)` + `markSceneDirty`. Κράτα `setSelectedFace`
  delegating σε `setSelectedFaces(face ? [face] : [])` (backward-compat για context-menu/drag-drop/Φ4a).

### 5) Batch apply = ΕΝΑ undo — **CRITICAL απόφαση**
- ΝΕΟ wiring `applyFaceAppearanceToFaces(levels, faces: SelectedFace3D[], value|null)`:
  φτιάξε N `SetFaceAppearanceCommand` (ένα ανά όψη, ίδιο adapter) → τύλιξέ τα σε **`CompositeCommand`** →
  `getGlobalCommandHistory().execute(composite)`.
- ⚠️ **ΥΠΟΧΡΕΩΤΙΚΟ grep/read ΠΡΙΝ:** `core/commands/CommandHistory.ts` — επιβεβαίωσε ότι το `execute(cmd)`
  ΟΝΤΩΣ καλεί `cmd.execute()` (ώστε το `CompositeCommand.execute()` να τρέξει όλα τα children). Το doc του
  CompositeCommand μιλά για `appendToLast` (children ήδη εκτελεσμένα) — **ΔΙΑΦΟΡΕΤΙΚΟ μονοπάτι**. Εσύ θες
  fresh composite που εκτελείται ΜΙΑ φορά. Αν το `execute` semantics δεν ταιριάζει → εναλλακτικά ΝΕΟ
  `SetFacesAppearanceCommand` (multi-face/multi-entity σε ένα command, mirror `SetFaceAppearanceCommand` με
  Map<entityId, Map<faceKey,value>> snapshots). **Απόφασέ το ΜΕΤΑ το grep, όχι πριν.**
- Cross-entity: τα children έχουν διαφορετικά `entityId` — το CompositeCommand το χειρίζεται (per-child
  `getAffectedEntityIds`). ΟΚ.

### 6) Consumers → apply σε ΟΛΕΣ τις όψεις
- `PolygonMaterialPanel`: `apply(value)` → `applyFaceAppearanceToFaces(levels, selectedFaces, value)`
  (swatch + custom color + clear). Hint: όταν >1 όψη, ίσως «N όψεις» (i18n key, **όχι hardcoded** — N.11·
  αν δεν θες νέα string, άσε το υπάρχον hint).
- Φ4a keyboard (`use-polygon-clipboard-shortcuts.ts`): **paste-face** + **clear** → σε ΟΛΕΣ τις `selectedFaces`
  (μέσω `applyFaceAppearanceToFaces`). **copy-face** = anchor μόνο (αντιγράφεις μία εμφάνιση). Entity-level
  (Shift+C/V) μένει ως είναι (anchor `bimId`).

---

## ⚠️ GUARDS / ΠΕΡΙΟΡΙΣΜΟΙ
- 🔴 **NO COMMIT / NO PUSH — ο GIORGIO κάνει ΟΛΑ τα commits** (N.(-1)). Εσύ: κώδικας + tests + ADR + stage list.
- 🔴 **SHARED WORKING TREE με άλλον agent** (μνήμη: ADR-534 BOQ + Cinema4D selection-outline). Άγγιξε ΜΟΝΟ
  τα αρχεία της Φ4b. **Έλεγξε `git status`/`git log` ΠΡΩΤΑ** — η Φ4a ίσως είναι ήδη committed· χτίσε από πάνω.
  ΜΗΝ revert-άρεις/πειράξεις ξένα uncommitted.
- 🟡 **ADR-040 CHECK 6B/6D:** το `use-bim3d-pointer-handlers.ts` ΕΙΝΑΙ 6B/6D αρχείο → **stage ADR-040 + ADR-539**
  αλλιώς commit blocked. (Store/highlighter/manager/ui/commands ΔΕΝ πιάνονται· ο highlighter είναι
  systems/selection.) Επιβεβαίωσε τι ισχύει για `ThreeJsSceneManager.ts` με τον hook.
- **N.7.1:** <500γρ/αρχείο, <40/function. Highlighter 113γρ, pointer 233γρ, panel 134γρ, store 55γρ → χώρος.
- **N.2:** zero `any`/`as any`/`@ts-ignore`. **N.11:** μηδέν νέα hardcoded i18n.
- **N.17:** ΕΝΑΣ tsc τη φορά (έλεγξε `Get-CimInstance … '*tsc*'` ΠΡΩΤΑ). ⚠️ **`isolatedModules:true`** →
  το ts-jest **ΔΕΝ** κάνει cross-file type-check· full tsc = OOM. Βασίσου σε ts-jest (runtime) + static
  import review + pre-commit hook + browser-verify (όπως η Φ4a).
- **N.14:** Opus (cross-cutting· store+pointer+manager+highlighter+command).

---

## 🔁 REUSE POINTS (μηδέν διπλότυπα) — SUMMARY
`faceGroupRange` + `sliceFaceGeometry` (highlighter geometry SSoT) / `CompositeCommand` (atomic undo) /
`SetFaceAppearanceCommand` (per-face child) / `applyFaceAppearance` / `getGlobalCommandHistory` /
`createLevelSceneManagerAdapter` / entity-level shift-toggle pattern (pointer γρ.159) /
`PolygonMode3DStore` / Φ4a `read-face-appearance` + `apply-entity-face-appearance-map`.

---

## ✅ CHECKLIST Φ4b
- [ ] SSoT audit (grep CommandHistory.execute semantics + ξανα-verify τα παραπάνω)
- [ ] Store: `selectedFaces` set + `toggleFace` + anchor `selectedFace`
- [ ] Click: Shift-toggle (mirror γρ.159) + `setSelectedFaces`
- [ ] Highlighter: `setTargets` N overlays (reuse slicing) + dispose-all + refresh-all· hover μένει single
- [ ] Manager: `setSelectedFaces` (+ `setSelectedFace` delegate)
- [ ] Batch: `applyFaceAppearanceToFaces` = CompositeCommand (ή νέο multi-command αν execute-semantics δεν ταιριάζει) → **ΕΝΑ undo**
- [ ] Panel + Φ4a keyboard (paste/clear) → ΟΛΕΣ οι όψεις
- [ ] Tests: store toggle/anchor, highlighter setTargets (mock mesh/group), batch one-undo (mock-scene-manager + history), pointer shift-branch (αν testable) — + regression (FaceContextMenuStore, polygon-clipboard-key, SetFaceAppearance) = 0 break
- [ ] ADR-539 changelog/roadmap (Φ4b → IMPLEMENTED UNCOMMITTED) + Critical files
- [ ] Declare Google-level (N.7.2) + context health (N.9)
- [ ] 🔴 browser-verify (Shift+κλικ πολλές όψεις → swatch βάφει όλες → 1 Ctrl+Z· cross-entity· Φ4a paste σε όλες) + **commit ο Giorgio** (stage ADR-040+539)

---

## 📎 ΑΝΑΦΟΡΕΣ
- **ADR:** `docs/centralized-systems/reference/adrs/ADR-539-cinema4d-polygon-mode-per-face-appearance.md` (§4 roadmap Φ4b, §7 changelog Φ4a)
- **Master Φ4 handoff:** `HANDOFFS/HANDOFF_2026-06-27_adr-539-phase4-multiface-clipboard-dnd-pbr.md`
- **Memory:** `reference_polygon_mode_foundation_dragdrop_holes.md`
- **Επόμενες υπο-φάσεις:** Φ4c (`bmat_*` drag) · Φ4d (per-face PBR, ADR-413)
