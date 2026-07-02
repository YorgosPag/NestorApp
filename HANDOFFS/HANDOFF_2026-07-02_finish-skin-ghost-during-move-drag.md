# HANDOFF — LIVE σοβάς (finish-skin) ghost ΚΑΤΑ ΤΟ MOVE/DRAG οντοτήτων BIM

> **Date:** 2026-07-02
> **Subapp:** `src/subapps/dxf-viewer` (https://nestorconstruct.gr/dxf/viewer)
> **ADR:** ADR-449 (Structural Finish Skin / σοβάς) + ADR-363 (member ghost preview) + ADR-040 (canvas perf)
> **Status:** 🔴 TODO — ΜΟΝΟ wiring (ο μηχανισμός υπάρχει ήδη, δεν καλείται στο move path)

---

## 0. ΤΙ ΘΕΛΕΙ Ο GIORGIO (ακριβώς)

Οι οντότητες BIM (τοίχοι/κολόνες/δοκοί) εμφανίζουν **περιμετρικά τον σοβά** (finish-skin) στην κάτοψη.
Όταν κάνεις **κλικ + drag για ΜΕΤΑΚΙΝΗΣΗ** (body-drag) μιας οντότητας, στην προεπισκόπηση εμφανίζεται
**μόνο το φάντασμα της οντότητας**, ΟΧΙ ο σοβάς. Ο Giorgio θέλει, **σε πραγματικό χρόνο κατά το drag**,
μαζί με το φάντασμα της οντότητας να εμφανίζεται και **το φάντασμα του σοβά** — **ΑΚΡΙΒΩΣ όπως ήδη
συμβαίνει κατά την ΑΛΛΑΓΗ ΔΙΑΣΤΑΣΗΣ (grip resize)**.

Δηλαδή: το live σοβά-preview που ήδη δουλεύει στο **resize** πρέπει να δουλεύει και στο **move/drag**.

---

## 1. 🚨 ΚΑΝΟΝΕΣ ΠΟΥ ΔΕΝ ΠΑΡΑΒΙΑΖΟΝΤΑΙ

1. **Ελληνικά ΠΑΝΤΑ** στις απαντήσεις προς τον Giorgio (CLAUDE.md language rule).
2. **SSoT AUDIT ΠΡΩΤΑ (πραγματικό grep)** πριν γράψεις κώδικα → §4. Reuse, ΟΧΙ διπλότυπα (N.0/N.12/N.0.2).
3. **Big-player quality:** Revit / Maxon (Cinema 4D) / Figma-level, full enterprise + full SSoT. Αν οι μεγάλοι
   δεν προτείνουν κάτι, ακολούθησε **την πρακτική τους**.
4. **❌ COMMIT/PUSH ΤΑ ΚΑΝΕΙ Ο GIORGIO** — ΠΟΤΕ εσύ (N.-1). Ετοίμασε, σταμάτα, ανέφερε.
5. **⚠️ SHARED WORKING TREE** με άλλον agent → **ΠΟΤΕ `git add -A`**. Άγγιξε ΜΟΝΟ τα δικά σου αρχεία.
6. **❌ ΟΧΙ `tsc` / typecheck** (N.17). ✅ jest επιτρέπεται (στοχευμένα).
7. **i18n (N.11):** αν χρειαστεί νέο label → πρώτα key σε `el` ΚΑΙ `en`. (Πιθανόν ΔΕΝ χρειάζεται εδώ —
   είναι καθαρά render/preview, όχι νέο UI string.)
8. **Enterprise TS:** ❌ `any`/`as any`/`@ts-ignore`. Αρχεία ≤500 γρ., functions ≤40 γρ.
9. **ADR-040 CHECK 6B/6D:** αγγίζεις preview/canvas draw path (`useEntityBodyDragPreview` + πιθανόν
   `dxf-renderer-structural-overlays`) → **stage το ADR-040** (ή σχετικό doc) μαζί με τον κώδικα, αλλιώς
   μπλοκάρει το pre-commit. Ενημέρωσε changelog ADR-449 (PHASE 3 του N.0.1).

---

## 2. 🎯 Η ΡΙΖΑ — ο μηχανισμός ΥΠΑΡΧΕΙ, απλώς ΔΕΝ καλείται στο move path

### 2.1 Το LIVE σοβά-preview helper ΥΠΑΡΧΕΙ ΗΔΗ (SSoT, ADR-449)

Αρχείο: **`hooks/tools/grip-ghost-preview-draw-helpers.ts`**
- `export function buildFinishSkinPreviewEntities<E>(sceneEntities, ghostMember, neighbours)` (~γρ. 232) —
  **pure** entity list: όλη η σκηνή με το dragged μέλος (+ mitered γείτονες τοίχου) στη θέση προεπισκόπησης.
- `export function drawStructuralFinishSkinPreview(ctx, sceneEntities, ghostMember, neighbours, t, vp)`
  (~γρ. 259) — **LIVE σοβά preview**. Το σχόλιό της (γρ. 244-248) λέει **ρητά**:
  *«LIVE finish-skin (σοβάς) preview while **moving/rotating/resizing** a member»*.
  Κάνει **SSoT reuse μηδέν νέας geometry**: καλεί τον ΙΔΙΟ scene-level pass που ζωγραφίζει τον committed
  σοβά → `drawStructuralFinishSkin2D` (`canvas-v2/dxf-canvas/dxf-renderer-structural-overlays`), με τη
  σκηνή όπου το μέλος είναι στη θέση preview → το merged silhouette (`computeStructuralFinishSilhouette`)
  ξανασχηματίζεται γύρω από τη ΝΕΑ θέση. Έχει εσωτερικό per-element gate στον διακόπτη σοβά. ADR-040: pure draw.

### 2.2 Καλείται ΜΟΝΟ στο RESIZE — ΟΧΙ στο MOVE

- ✅ **RESIZE (grip drag):** `hooks/tools/useGripGhostPreview.ts` **γρ. 354-388** — υπολογίζει
  `finishPreviewNeighbours` (για τοίχο: `jointNeighbors` mitered) και **μετά** το body ghost καλεί το
  σοβά-preview (ίδια σειρά με committed: plaster μετά το body). **ΑΥΤΟ ΔΟΥΛΕΥΕΙ** — είναι το «όπως στην
  αλλαγή διάστασης» που αναφέρει ο Giorgio.
- ❌ **MOVE (body-drag):** `hooks/tools/useEntityBodyDragPreview.ts` — importάρει ΜΟΝΟ
  `applyEntityPreview` / `makeTranslationPreview` (`rendering/ghost`) + `drawRealEntityPreview`
  (`rendering/ghost/draw-real-entity-preview`). **ΔΕΝ importάρει** το `drawStructuralFinishSkinPreview`.
  → ζωγραφίζει φάντασμα οντότητας **χωρίς** σοβά. **ΑΥΤΟ ΕΙΝΑΙ ΤΟ ΚΕΝΟ.**

**Συμπέρασμα:** Δεν φτιάχνεις τίποτα νέο. **Wire-άρεις τον υπάρχοντα `drawStructuralFinishSkinPreview`
στο move body-drag preview**, καθρεφτίζοντας ό,τι κάνει το `useGripGhostPreview` στο resize.

---

## 3. ΤΟ ΣΧΕΔΙΟ (μετά το δικό σου SSoT audit)

1. **Διάβασε πρώτα** (με τη σειρά):
   - `hooks/tools/grip-ghost-preview-draw-helpers.ts` (η SSoT· ΔΕΣ την ακριβή signature του
     `drawStructuralFinishSkinPreview` + `buildFinishSkinPreviewEntities`).
   - `hooks/tools/useGripGhostPreview.ts` **γρ. ~340-395** (το working reference: πώς υπολογίζει
     `finishPreviewNeighbours` / `jointNeighbors` και πώς + ΠΟΤΕ καλεί το σοβά-preview, gate, σειρά draw).
   - `hooks/tools/useEntityBodyDragPreview.ts` (ΟΛΟ — εδώ θα προσθέσεις την κλήση, μετά το entity ghost).
   - `systems/drag/EntityBodyDragStore.ts` (η κατάσταση του body-drag: ποιο/ποια entity, offset, live θέση).
   - `canvas-v2/dxf-canvas/dxf-renderer-structural-overlays.ts` (`drawStructuralFinishSkin2D` — ο committed pass).

2. **Wire το σοβά-preview στο move:** στο `useEntityBodyDragPreview`, ΜΕΤΑ το `drawRealEntityPreview`
   (ίδια σειρά plaster-after-body με resize), κάλεσε `drawStructuralFinishSkinPreview(ctx, sceneEntities,
   ghostMember, neighbours, t, vp)` για κάθε dragged BIM μέλος.
   - **Reuse την ΙΔΙΑ λογική neighbours** με το `useGripGhostPreview` (τοίχος → mitered `jointNeighbors`·
     κολόνα/δοκός → ό,τι κάνει το resize path). Αν η neighbour-λογική είναι inline στο useGripGhostPreview,
     **βγάλ' την σε shared helper** και κάλεσέ την ΚΑΙ από τα δύο (SSoT, μη διπλασιάσεις).
   - **Multi-select drag:** το body-drag μπορεί να μετακινεί ΠΟΛΛΑ entities μαζί → κάλεσε το preview για
     καθένα (ή τροφοδότησε το merged silhouette με όλα τα ghost μέλη). Επιβεβαίωσε τι δέχεται το helper.
   - **Gate:** ο διακόπτης σοβά έχει ήδη εσωτερικό per-element gate — αλλά επιβεβαίωσε ότι σέβεσαι
     `ShowFinishSkinToggle` / `structural-finish-visibility` (μην ζωγραφίζεις σοβά όταν είναι OFF).

3. **ADR-040:** pure draw, μηδέν νέες store subscriptions στον orchestrator (leaf-level μόνο). Stage ADR-040.

4. **ADR-449 changelog** (N.0.1 PHASE 3): πρόσθεσε entry «σοβά-preview επεκτάθηκε στο move/body-drag
   (reuse `drawStructuralFinishSkinPreview`, μηδέν διπλότυπο)».

---

## 4. SSoT AUDIT TARGETS (grep ΠΡΙΝ γράψεις — reuse, μη διπλασιάσεις)

| Ανάγκη | grep | Αναμενόμενο SSoT |
|---|---|---|
| Σοβά preview draw | `drawStructuralFinishSkinPreview`, `buildFinishSkinPreviewEntities` | `hooks/tools/grip-ghost-preview-draw-helpers.ts` (**ΧΡΗΣΙΜΟΠΟΙΗΣΕ ΤΟ**) |
| Committed σοβά pass | `drawStructuralFinishSkin2D` | `canvas-v2/dxf-canvas/dxf-renderer-structural-overlays.ts` |
| Silhouette geometry | `computeStructuralFinishSilhouette`, `structural-finish-silhouette` | `bim/finishes/structural-finish-silhouette.ts` / `structural-finish-scene-silhouette.ts` |
| Resize reference (πώς καλείται) | `finishPreviewNeighbours`, `jointNeighbors` | `hooks/tools/useGripGhostPreview.ts:~354-388` |
| Move ghost path | `useEntityBodyDragPreview`, `drawRealEntityPreview`, `makeTranslationPreview` | `hooks/tools/useEntityBodyDragPreview.ts` + `rendering/ghost/*` |
| Body-drag state | `EntityBodyDragStore`, `useEntityDrag`, `useMoveEntities` | `systems/drag/EntityBodyDragStore.ts` |
| Σοβά visibility gate | `ShowFinishSkin`, `structural-finish-visibility` | `ui/ribbon/components/ShowFinishSkinToggle.tsx` / `bim/finishes/structural-finish-visibility.ts` |
| Test πρότυπο | `finish-skin-preview-entities` | `hooks/tools/__tests__/finish-skin-preview-entities.test.ts` (mirror για move) |

**Κρίσιμο:** ΜΗΝ φτιάξεις νέο σοβά-geometry/silhouette/draw. Υπάρχει ΟΛΟ. Μόνο **κλήση** στο move path
+ (ίσως) extract της neighbour-λογικής σε shared helper.

---

## 5. VERIFICATION
- **jest** στοχευμένα: mirror του `finish-skin-preview-entities.test.ts` για το move (build entities +
  σωστά neighbours + gate OFF → κενό). Τυχόν extracted neighbour-helper → δικό του test.
- **browser-verify:** τοίχος/κολόνα με ορατό σοβά → κλικ+drag μετακίνηση → **το φάντασμα του σοβά
  ακολουθεί live** γύρω από τη νέα θέση (όπως στο resize)· άσε το κλικ → committed = preview (WYSIWYG).
  Δοκίμασε multi-select drag + σοβά OFF (να ΜΗΝ ζωγραφίζεται).
- ❌ ΟΧΙ `tsc`. ✅ jest OK.

---

## 6. ΤΙ ΝΑ ΜΗΝ ΚΑΝΕΙΣ
- ❌ `git commit` / `git push` / `git add -A` (shared tree· commit = Giorgio).
- ❌ `tsc` / typecheck.
- ❌ Νέο σοβά silhouette/geometry/draw helper — **reuse** `drawStructuralFinishSkinPreview`.
- ❌ Νέα store subscription σε orchestrator (ADR-040 — leaf-only, pure draw).
- ❌ Αγγίγματα άσχετων αρχείων (shared tree με άλλον agent).

---

## 7. ΠΛΑΙΣΙΟ ΑΠΟ ΤΗΝ ΠΡΟΗΓΟΥΜΕΝΗ ΣΥΝΕΔΡΙΑ (UNCOMMITTED — ΜΗΝ ΤΑ ΑΓΓΙΞΕΙΣ)
Στο ίδιο working tree υπάρχουν UNCOMMITTED αλλαγές του ADR-562 (dimension per-part styling: Φ5 Style
Manager + chooser/apply/text-rotation fixes). **Άσχετα με αυτό το task** — μην τα πειράξεις. Ο Giorgio
θα κάνει commit ξεχωριστά. Άγγιξε ΜΟΝΟ τα finish-skin/move-preview αρχεία.
