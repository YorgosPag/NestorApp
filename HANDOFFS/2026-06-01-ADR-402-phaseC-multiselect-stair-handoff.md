# HANDOFF — ADR-402 Phase C: Multi-select 3Δ centroid resize + Sub-Phase 1 stair

**Ημερομηνία σύνταξης:** 2026-05-31
**Συντάκτης:** Developer A (Opus 4.8, SOLO)
**Θέμα:** ADR-402 — 3D Viewport BIM Element Editing
**Επόμενες φάσεις (2, ξεχωριστές):** (Α) Multi-select 3Δ centroid resize/move/rotate · (Β) Sub-Phase 1 stair editing
**Κατάσταση εκκίνησης:** Phase A + Phase B (resize ΟΛΩΝ + axis-Y + **snap-during-drag**) ✅ DONE (pending commit). Καθαρό ξεκίνημα για Phase C.

---

## 0. ΠΡΩΤΟ ΒΗΜΑ ΟΤΑΝ ΞΕΚΙΝΗΣΕΙΣ

1. **Έλεγξε git status/log** — όλη η Phase A/B (gizmo + snap) μπορεί να είναι **uncommitted** ή **committed** (αν ο Giorgio έδωσε εντολή). ΜΗΝ υποθέσεις, ΜΗΝ μπλέξεις φάσεις.
2. **Διάβασε** το ADR-402 doc (Status + τα 3 τελευταία changelog entries: snap, resize-όλων, resize-scaffold).
3. **Διάβασε τη memory** `project_adr402_genarc_gizmo_port.md` (πλήρες state) + `project_adr402_3d_bim_editing.md`.
4. **Phase 1 recognition (ADR-driven):** διάβασε τον κώδικα ΠΡΙΝ γράψεις (θέσεις-κλειδιά §3).
5. **🚨 N.8 EXECUTION MODE:** Η φάση Α (multi-select) είναι **cross-cutting** (store widening + ~6 consumers, 2+ domains). Ζήτα από τον Giorgio Plan Mode ή Orchestrator ΠΡΙΝ ξεκινήσεις (μην το τρέξεις σαν simple execution).

---

## 1. ΑΠΟΦΑΣΗ ΣΕΙΡΑΣ (πρόταση Developer A)

**Κάνε ΠΡΩΤΑ τη φάση Α (multi-select)** — είναι η φυσική ολοκλήρωση του Phase B (το gizmo+snap+resize δουλεύουν για ένα στοιχείο· το multi είναι το τελευταίο κομμάτι του ίδιου domain). Η φάση Β (stair) είναι **νέο domain** με δικά της design questions και αξίζει ξεχωριστή συνεδρία.

⚠️ **ΡΩΤΑ ΤΟΝ GIORGIO** ποια φάση θέλει πρώτη — μπορεί να προτιμά το stair. Μην αποφασίσεις μόνος σου τη σειρά· πρότεινε και περίμενε.

---

## 2. ΦΑΣΗ Α — MULTI-SELECT 3Δ (centroid move/rotate/resize)

### Στόχος
Επιλογή πολλών BIM στοιχείων στο 3Δ (Shift/Ctrl+click) → ΕΝΑ gizmo στο **centroid** της ομάδας → move/rotate/resize σε ΟΛΑ μαζί, ΕΝΑ undo step.

### Τι λείπει σήμερα (recognition έγινε)
Όλη η αλυσίδα είναι **single-select**:
- `Selection3DStore` (`stores/Selection3DStore.ts`): `selectedBimId: string|null` + `selectedBimType: string|null`. Actions `selectEntity(id,type)` / `clearSelection()`.
- `Bim3DEditStore` (`stores/Bim3DEditStore.ts`): `editEntityId: string|null` + `editBimType`. Action `activateMove(id, type)`.
- `ThreeJsSceneManager.selectBimEntity(bimId)` (`scene/ThreeJsSceneManager.ts:393`): single → `selectionHighlighter.onSelect(bimId)` + `Selection3DStore.selectEntity`. `null` → clear.
- `use-bim3d-pointer-handlers.ts:42-53` `handleClick`: raycast → `selectBimEntity(hit?.bimId ?? null)` (ΚΑΘΕ κλικ αντικαθιστά· Alt=orbit pivot ΗΔΗ, Shift/Ctrl ΑΧΡΗΣΙΜΟΠΟΙΗΤΑ).
- `use-bim3d-edit-interaction.ts`: `syncFromSelection()` (γρ. 107-117) διαβάζει `selectedBimId` (single) → `activateMove`. `computeEditAnchor` (handlers, γρ. ~67) = bbox ΕΝΟΣ entityId.
- handlers `dispatchOutcome` (γρ. ~139) + `buildEditCommand`: single `entityId`.

### Σχέδιο (store widening + consumers)
1. **`Selection3DStore` → multi:** `selectedBimIds: string[]` + `selectedBimTypes: Record<id,type>` (ή `Map`). Πρόσθεσε `toggleEntity(id,type)` (Shift/Ctrl additive), κράτα `selectEntity` (replace=single) + `clearSelection`. **Κράτα backward-compat getter** `selectedBimId` (= first/last) αν το διαβάζουν panels — ΑΛΛΙΩΣ ενημέρωσε όλους τους consumers (grep παρακάτω).
2. **`selectionHighlighter`:** σήμερα `onSelect(id)` single. Χρειάζεται multi-highlight (set of ids). Δες `scene/` highlighter — **πιθανώς ξεχωριστό domain, πρόσεξε τα όρια**.
3. **`Bim3DEditStore` → multi:** `editEntityIds: string[]` (+ κράτα `editEntityId` getter για compat). `activateMove(ids[], types)`.
4. **`handleClick`** (`use-bim3d-pointer-handlers.ts`): `e.shiftKey || e.ctrlKey` → `toggleEntity`· αλλιώς `selectEntity` (replace). (Mirror του 2Δ selection — δες `systems/selection/SelectionSystem.tsx` για το pattern.)
5. **`computeEditAnchor`** → **union bbox ΟΛΩΝ** των ids → centre = centroid (το `findBimEntityWorldBox` ήδη κάνει union ανά mesh· κάνε loop+union τα boxes).
6. **`dispatchOutcome`/`buildEditCommand`:**
   - **Move:** loop `MoveEntityCommand` ανά id με ΙΔΙΟ delta, τυλιγμένα σε ΕΝΑ undo step (ψάξε batch/composite command pattern· `RotateEntityCommand` ΗΔΗ δέχεται `string[]` → δες αν υπάρχει `MoveEntitiesCommand` ή composite).
   - **Rotate:** `RotateEntityCommand([...ids], centroidPivot, angle, sm)` — **ΗΔΗ δέχεται array** (handlers γρ. ~161 περνά `[c.entityId]`). Σχεδόν δωρεάν.
   - **Resize (centroid scale):** ΤΟ ΔΥΣΚΟΛΟ. Revit-style scale περί centroid = κάθε στοιχείο μεγαλώνει **ΚΑΙ** μετακινείται. Για BIM params αυτό είναι σύνθετο (δες §4 design questions). Πιθανή πρώτη έκδοση: resize **ανενεργό** σε multi-select (gizmo δείχνει μόνο move+rotate handles όταν >1 selected), centroid resize ως δεύτερο βήμα.
7. **Snap σε multi:** ο snapFn (Phase B) χτίζεται από τα grips ΕΝΟΣ entity. Σε multi → χαρακτηριστικά σημεία ΟΛΩΝ (union offsets) ή απενεργοποίησέ το σε multi πρώτα. Design question.

### Consumers να ελεγχθούν (grep `selectedBimId`):
`BimEntityCardPanel.tsx`, `section-scene-sync.ts`, `use3DShortcuts.ts`, `BimViewport3D.tsx`, `scene-manager-a11y.ts`, `use-bim-entity-proxy-accessibility.ts`, `AriaLiveRegion.tsx`, `scene-framing-bounds.ts`, `Section2DPanel.tsx`. **Κάθε ένας: τι κάνει με single id; σπάει σε multi;**

---

## 3. ΦΑΣΗ Β — SUB-PHASE 1 STAIR EDITING (3Δ)

### Κατάσταση σήμερα
- Οι σκάλες παίρνουν **μόνο BASE_HANDLES** (move + rotate-Y) από το `activeHandlesFor` (`bim-gizmo-overlay.ts`) — δεν υπάρχει `stair` στο `RESIZE_HANDLES_BY_TYPE`.
- `MoveEntityCommand`/`RotateEntityCommand` είναι **type-agnostic** → η σκάλα **πιθανώς ήδη μετακινείται/περιστρέφεται** στο 3Δ. **ΕΠΑΛΗΘΕΥΣΕ το πρώτα στον browser** πριν γράψεις κώδικα.
- Το `bim3d-resize-bridge.ts` ΔΕΝ έχει `computeStairResizeParams` (οι σκάλες έχουν σύνθετη multi-flight γεωμετρία: straight/L/U/Γ, `getStairGrips` 5-13 grips).

### Τι πιθανώς θέλει η φάση
Stair-specific resize/parametric editing στο 3Δ (πλάτος/ύψος σκαλιού/αριθμός βαθμίδων). **Σύνθετο** — οι σκάλες δεν είναι απλό box. **Recognition-first + design questions ΥΠΟΧΡΕΩΤΙΚΑ** (βλ. §4).

### Reference
- `bim/stairs/stair-grips.ts` (`getStairGrips`), `computeStairGeometry`, ADR-358/393 (stair grips v1+v2: straight hides width/length, L/U/Γ 4 corners read-from-geometry).
- Memory `project_adr393_stair_extended_grips.md`.

---

## 4. ΑΝΟΙΧΤΑ DESIGN QUESTIONS — ρώτησε τον Giorgio (ΑΠΛΑ ελληνικά + παραδείγματα, ΕΝΑ-ΕΝΑ)

> Κανόνας (feedback): απλά ελληνικά, ΟΧΙ τεχνικοί όροι, ΥΠΟΧΡΕΩΤΙΚΑ παραδείγματα, μία ερώτηση τη φορά.

**Για multi-select (φάση Α):**
1. **Πώς διαλέγω πολλά;** Με Shift+click, Ctrl+click, ή και τα δύο; (Παράδειγμα: στο AutoCAD κρατάς Shift για να προσθέσεις στοιχείο στην επιλογή.) Θες και «κουτί επιλογής» (σύρσιμο γύρω από πολλά) ή μόνο click-ένα-ένα προς το παρόν;
2. **Το resize σε πολλά τι κάνει;** (α) μεγαλώνουν ΟΛΑ μαζί γύρω από το κέντρο της ομάδας (σαν να τραβάς γωνία κουτιού — μεγαλώνουν ΚΑΙ απομακρύνονται)· ή (β) προς το παρόν στα πολλά επιτρέπουμε ΜΟΝΟ μετακίνηση+περιστροφή, και το resize μένει για ένα-ένα; *(Πρόταση: ξεκίνα με β — move+rotate σε πολλά, resize μόνο σε ένα· centroid scale δεύτερο βήμα.)*
3. **Snap σε πολλά;** Όταν σέρνεις πολλά μαζί, να κουμπώνει η γωνία οποιουδήποτε από αυτά, ή να σβήνει το snap στα πολλά; *(Πρόταση: snap από τα χαρακτηριστικά σημεία όλων.)*

**Για stair (φάση Β):**
4. **Τι θες να αλλάζεις στη σκάλα μέσα από το 3Δ;** Μόνο θέση/περιστροφή (που ίσως δουλεύει ήδη), ή και διαστάσεις (πλάτος σκάλας, ύψος); — Επηρεάζει αν χρειάζεται νέο stair resize SSoT.

---

## 5. ΚΡΙΣΙΜΗ ΓΝΩΣΗ ΑΡΧΙΤΕΚΤΟΝΙΚΗΣ (θέσεις-κλειδιά)

- **Stores:** `bim-3d/stores/Selection3DStore.ts` (single→multi), `bim-3d/stores/Bim3DEditStore.ts` (single→multi).
- **Selection flow:** `bim-3d/viewport/use-bim3d-pointer-handlers.ts:42` `handleClick` → `ThreeJsSceneManager.selectBimEntity` (`scene/ThreeJsSceneManager.ts:393`) → `selectionHighlighter` + store.
- **Edit hook:** `bim-3d/animation/use-bim3d-edit-interaction.ts` (`syncFromSelection` γρ.107, `applyActiveState` γρ.86).
- **Handlers:** `bim-3d/animation/bim3d-edit-interaction-handlers.ts` (`computeEditAnchor` γρ.~67 union-bbox, `dispatchOutcome` γρ.~139, `buildEditCommand` γρ.~156 — rotate ΗΔΗ array).
- **Snap (Phase B, μην το σπάσεις):** `bim-3d/gizmo/bim3d-snap-bridge.ts` (`makeMoveSnapFn`/`makeResizeSnapFn`), bridge `setSnapFn`/`getActiveSnapWorld`.
- **Commands:** `core/commands/entity-commands/{Move,Rotate,Update*Params}Command`. **Ψάξε για composite/batch command** για multi-move-σε-ένα-undo.
- **2Δ reference για multi-select pattern:** `systems/selection/SelectionSystem.tsx`.

---

## 6. ΚΑΝΟΝΕΣ / ΟΡΙΑ (ΑΥΣΤΗΡΑ)

- **Φάση Α αγγίζει:** `bim-3d/stores/*` (Selection3D/Bim3DEdit), `bim-3d/animation/*` (hook+handlers), `bim-3d/viewport/use-bim3d-pointer-handlers`, `bim-3d/scene/ThreeJsSceneManager.selectBimEntity` + selectionHighlighter, + consumers που σπάνε + tests + ADR-402 + trackers N.15.
- **ΠΡΟΣΟΧΗ στο `ThreeJsSceneManager` (όριο 499/500 γρ.)** — αν φουσκώσει, split σε helper (όπως ήδη γίνεται με `scene-manager-actions.ts`).
- **ΜΗΝ αγγίξεις:** `bim/walls|beams|slabs|columns|stairs` (μόνο κλήση command/grips SSoT), `snapping/*` (μόνο κλήση engine), `coordinate-transforms.ts` (μόνο import). Τις `core/commands` μόνο **κλήση/σύνθεση**, ΟΧΙ αλλαγή λογικής εντολής.
- **ΠΟΤΕ** `git add -A` — μόνο συγκεκριμένα αρχεία.
- **ΠΟΤΕ** commit/push χωρίς ρητή εντολή Giorgio (N.(-1)).
- **N.8:** Multi-select = cross-cutting → Plan Mode/Orchestrator, ΡΩΤΑ ΠΡΩΤΑ.
- **N.15 trackers** μετά: ADR-402 changelog + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + memory `project_adr402_genarc_gizmo_port.md` + MEMORY.md index.

---

## 7. DEFINITION OF DONE (φάση Α)
- [ ] Shift/Ctrl+click προσθέτει/αφαιρεί στοιχείο από την επιλογή (3Δ)
- [ ] Gizmo ανοίγει στο centroid της ομάδας (union bbox)
- [ ] Move πολλών = ΕΝΑ undo step· Rotate πολλών περί centroid· (resize: ό,τι αποφασιστεί §4.Q2)
- [ ] Snap συμπεριφορά κατά §4.Q3
- [ ] Όλοι οι `selectedBimId` consumers ΟΚ σε multi (κανένας δεν σπάει)
- [ ] `npx jest src/subapps/dxf-viewer/bim-3d` ΟΛΑ PASS + `npx tsc --noEmit` 0 errors
- [ ] ADR-402 + trackers N.15 ενημερωμένα
- [ ] 🔴 browser verify από Giorgio

---

## 8. ΠΑΓΙΔΕΣ
- Terminal noise + PowerShell `$_` αλλοίωση → χρησιμοποίησε Grep/Read/Glob ή απλό git/jest/tsc μέσω bash.
- ΜΗΝ βάζεις fragile bash στο ΙΔΙΟ parallel μπλοκ με Edits.
- **Backward-compat:** αν widen-άρεις store από single→multi, ΟΛΟΙ οι consumers (9+) πρέπει να δουλεύουν· βάλε getter `selectedBimId` = first για ομαλή μετάβαση, ΑΛΛΑ έλεγξε ότι δεν κρύβει bug.
- `selectionHighlighter` single→multi μπορεί να είναι δικό του domain — αν είναι μεγάλο, flag το ως ξεχωριστό.
- Stair: ΜΗΝ υποθέσεις ότι δεν δουλεύει το move/rotate — επαλήθευσε στον browser ΠΡΩΤΑ.
