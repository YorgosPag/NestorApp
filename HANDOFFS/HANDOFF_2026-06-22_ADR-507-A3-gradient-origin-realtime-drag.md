# HANDOFF — ADR-507 Φ5 A3: Real-time gradient origin κατά το drag (WYSIWYG ghost)

> **Ημ/νία:** 2026-06-22 · **Origin:** Giorgio — «όταν μετακινώ τη λαβή gradient origin, να αλλάζει η διαβάθμιση σε ΠΡΑΓΜΑΤΙΚΟ ΧΡΟΝΟ, όχι μόνο στο release».
> **Ποιότητα:** FULL ENTERPRISE + FULL SSoT, **Revit/AutoCAD-grade**. ΟΧΙ διπλότυπα, ΟΧΙ forced abstraction.
> **Commit:** ΜΟΝΟ ο Giorgio. **Working tree:** ΜΟΙΡΑΖΕΤΑΙ με άλλον agent → `git add` ΜΟΝΟ δικά σου.
> **Master ADR:** `docs/centralized-systems/reference/adrs/ADR-507-hatch-creation-system.md` (§8 changelog, entries «Φ5 gap A1/A2/A3»).

---

## 0. ⚠️ ΠΡΩΤΟ ΒΗΜΑ — ΥΠΟΧΡΕΩΤΙΚΟ SSoT AUDIT (grep) ΠΡΙΝ ΓΡΑΨΕΙΣ ΚΩΔΙΚΑ

Ο Giorgio κάνει σκληρό audit («δημιούργησες διπλότυπο; υπάρχει ήδη SSoT; θα το έκανε έτσι η Revit;»). Το tree αλλάζει ζωντανά (άλλος agent).

```bash
# Ο κεντρικός real-time ghost μηχανισμός (χρησιμοποιείται ΠΑΝΤΟΥ στο grip drag + placement):
cat src/subapps/dxf-viewer/rendering/ghost/apply-entity-preview.ts      # preview entity ΑΝΑ drag frame
cat src/subapps/dxf-viewer/rendering/ghost/draw-ghost-entity.ts         # ΖΩΓΡΑΦΙΖΕΙ το ghost (25 cases — ΛΕΙΠΕΙ 'hatch')
cat src/subapps/dxf-viewer/canvas-v2/preview-canvas/bim-preview-render.ts  # WYSIWYG: ghost μέσω ΠΡΑΓΜΑΤΙΚΩΝ renderers (το πρότυπο)
# Η gradient render SSoT:
cat src/subapps/dxf-viewer/rendering/entities/HatchRenderer.ts          # fillGradient(paths, gradient, origin?)
cat src/subapps/dxf-viewer/bim/hatch/hatch-gradient.ts                  # resolveGradientStops, normalizeGradientShift
# Πώς ρέει το preview entity στο ghost:
grep -rn "applyEntityPreview\|drawGhostEntity\|useGripGhostPreview" src/subapps/dxf-viewer --include=*.ts --include=*.tsx | grep -iv __tests__
```

---

## 1. ΤΙ ΛΕΙΠΕΙ (η ρίζα — επαληθευμένο με grep)

Το A3 (gradient origin με draggable λαβή) **ΛΕΙΤΟΥΡΓΕΙ** (browser-verified από Giorgio): η λαβή εμφανίζεται στο κέντρο, σέρνεται, και στο **release** η διαβάθμιση μετακινείται + persist + ΕΝΑ undo.

**ΤΟ ΚΕΝΟ:** κατά το drag (πριν το release) το gradient fill **ΔΕΝ** επαναζωγραφίζεται live.

**ΡΙΖΑ (grep-verified):**
- Ο live ghost ζωγραφίζεται από `drawGhostEntity` (`rendering/ghost/draw-ghost-entity.ts`) — **25 cases, ΚΑΝΕΝΑ `case 'hatch'`** → το hatch πέφτει στο `default` (γρ.456) που ζωγραφίζει μόνο γενικό περίγραμμα.
- Το `applyEntityPreview` (`rendering/ghost/apply-entity-preview.ts`) **ΗΔΗ** χειρίζεται την origin λαβή σωστά (branch που πρόσθεσα στο A3): `isHatchOriginGripKind(hatchGripKind)` → επιστρέφει preview entity με νέο `patternOrigin`. **Δηλαδή το preview entity ΕΧΕΙ ήδη το σωστό live origin** — απλώς ο `drawGhostEntity` δεν ξέρει να ζωγραφίσει το gradient fill του hatch.

**Συμπέρασμα:** το preview-entity pipeline είναι έτοιμο· λείπει ΜΟΝΟ το **draw** του gradient fill στο ghost.

---

## 2. 🎯 ΖΗΤΟΥΜΕΝΟ — Revit-grade WYSIWYG ghost για hatch

Κατά το drag της origin λαβής (και ιδανικά ΚΑΘΕ hatch grip), το ghost να δείχνει το **πραγματικό gradient fill** με το live `patternOrigin`, ΟΧΙ μόνο περίγραμμα. Preview === commit render.

### Προτεινόμενη SSoT προσέγγιση (mirror υπάρχοντος pattern — ΟΧΙ νέο)

Ο Giorgio έχει ΗΔΗ το πρότυπο: **`BimPreviewRenderer`** (`canvas-v2/preview-canvas/bim-preview-render.ts`) ζωγραφίζει synthetic BIM entities (wall/foundation/…) μέσω των **ΠΡΑΓΜΑΤΙΚΩΝ entity renderers** αντί για schematic outline (ADR-363/436 WYSIWYG placement preview). Αυτό είναι το ίδιο SSoT principle.

**Άρα:** πρόσθεσε `case 'hatch'` στο `drawGhostEntity` που ζωγραφίζει το hatch **μέσω του πραγματικού `HatchRenderer`** (που ήδη έχει `fillGradient(paths, gradient, origin?)` με υποστήριξη origin από το A3). Έτσι το ghost = ακριβώς ό,τι θα δει στο release (gradient + shift + origin), με μηδέν δεύτερη render math.

**SSoT κανόνες:**
- ΜΗΝ ξαναγράψεις gradient math — reuse `HatchRenderer.fillGradient` / `hatch-gradient.ts` (`resolveGradientStops`, `normalizeGradientShift`).
- Έλεγξε πώς ο `BimPreviewRenderer` instantiα-ρει & καλεί τους πραγματικούς renderers στο preview ctx (instance bound στο preview canvas) → mirror ΑΚΡΙΒΩΣ.
- Πρόσεξε το transform/worldToScreen: ο `HatchRenderer` διαβάζει live transform· βεβαιώσου ότι ο ghost περνά το ίδιο (δες πώς το κάνει ο BimPreviewRenderer).
- ⚠️ **CHECK 6D** (canvas: drawGhostEntity / HatchRenderer / preview) → stage `ADR-040` + `ADR-507`.
- Αν χρειαστεί νέο label/UI → N.11 i18n el+en (δεν αναμένεται· είναι render-only).

### Εναλλακτική (αν το BimPreviewRenderer pattern δεν ταιριάζει)
Inline gradient fill στο `case 'hatch'` του `drawGhostEntity` καλώντας απευθείας τη SSoT γεωμετρία gradient — αλλά ΜΟΝΟ αν το reuse του HatchRenderer αποδειχθεί δύσκολο (πρώτα δοκίμασε το renderer-reuse, είναι το πιο SSoT).

---

## 3. ΚΑΤΑΣΤΑΣΗ A1/A2/A3 (UNCOMMITTED — έτοιμα για commit Giorgio)

Όλα **jest GREEN + tsc-clean στα δικά μου αρχεία**, browser-verified.

| Gap | Τι | Αρχεία (git add ΜΟΝΟ αυτά) |
|---|---|---|
| **A1** | `lineweightMm` passthrough στο entity-model converter | `canvas-v2/dxf-canvas/dxf-renderer-entity-model.ts` + `__tests__/dxf-renderer-entity-model-hatch.test.ts`[NEW] |
| **A2** | gradient `461` shift visual + UI «Μετατόπιση» | `bim/hatch/{hatch-gradient,hatch-gradient-build,hatch-draw-defaults-store}.ts`, `rendering/entities/HatchRenderer.ts`, `ui/ribbon/{hooks/bridge/hatch-command-keys,hooks/useRibbonHatchBridge,data/contextual-hatch-tab}.ts`, `bim/hatch/__tests__/{hatch-gradient,hatch-gradient-build}.test.ts`, i18n el+en `dxf-viewer-shell` |
| **A3** | gradient origin με draggable λαβή (reuse `patternOrigin`) | `hooks/grip-kinds.ts`, `bim/hatch/hatch-grips.ts`, `core/commands/entity-commands/UpdateHatchOriginCommand.ts`[NEW], `rendering/entities/HatchRenderer.ts`, `hooks/grip-computation.ts`, `rendering/ghost/apply-entity-preview.ts`, `hooks/grips/grip-parametric-footprint-commits.ts`, `bim/hatch/__tests__/hatch-grips.test.ts`, `hooks/__tests__/grip-computation-bim-domain-entity.test.ts`, `core/commands/entity-commands/__tests__/UpdateHatchOriginCommand.test.ts`[NEW] |
| Docs | ADR-507 changelog (3 entries) + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` |

**A3 SSoT κλειδιά (reuse στο real-time task):**
- `hatch-grips.ts`: `applyHatchOriginGripDrag(origin,delta,rectilinear)→Point2D`, `isHatchOriginGripKind`, `hatchBounds`/`hatchBoundsCenter` (SSoT bbox).
- `HatchGripKind` (grip-kinds.ts) += `'hatch-gradient-origin'`.
- ΔΥΟ grip πηγές που συμφωνούν: `HatchRenderer.getGrips` (**DISPLAY**) + `computeDxfEntityGrips` (**INTERACTION**, `hatchGripKind`) — και οι δύο εκπέμπουν την origin λαβή ΜΟΝΟ όταν `fillType==='gradient'`, ίδια θέση `patternOrigin ?? hatchBoundsCenter`.
- `UpdateHatchOriginCommand extends MergeableUpdateCommand<Point2D>` (drag → ΕΝΑ undo).

**🐞 ΜΑΘΗΜΑ A3 (κρίσιμο):** Τα **ορατά** grips ζωγραφίζονται από `Renderer.getGrips` (μέσω `BaseEntityRenderer.renderGrips`), ΟΧΙ από `computeDxfEntityGrips` (αυτό = interaction). Αρχικά πρόσθεσα την λαβή μόνο στο computeDxfEntityGrips → ήταν draggable αλλά ΑΟΡΑΤΗ. **Κάθε νέα λαβή πρέπει να μπει ΚΑΙ στις ΔΥΟ.** (Ίδιο μοτίβο ισχύει για το real-time: το ghost render είναι ξεχωριστό από το preview-entity compute.)

---

## 4. ΞΕΝΑ / ΠΡΟΫΠΑΡΧΟΝΤΑ (ΜΗΝ τα staγe ως δικά σου)
- **Build-fix (έγινε):** `canvas-v2/preview-canvas/PreviewRenderer.ts` — αφαιρέθηκε διπλό import `drawOverlayLabel` (ήταν build-breaking, ξένου agent· column rect-snap). 1 γραμμή. Ο Giorgio αποφασίζει αν θα το συμπεριλάβει.
- **Προϋπάρχον tsc error (ΟΧΙ δικό μου):** `hooks/grips/grip-parametric-commits.ts:435` — `sceneManager.getEntities()` possibly undefined (`getEntities?` optional στο ISceneManager). Foundation pad sizing (ADR-503), ξένου agent.

---

## 5. ΚΑΝΟΝΕΣ
- **N.8/N.14:** ΠΡΙΝ από κάθε υπο-εργασία → πρότεινε execution mode + μοντέλο, περίμενε «ok». Το real-time task = ~2-4 αρχεία (ghost render), 1 domain → Plan/Sonnet (αλλά κάνε πρώτα SSoT audit & δείξε πλάνο).
- **N.17:** ΕΝΑ tsc τη φορά — έλεγξε process πριν.
- **CHECK 6D:** ό,τι αγγίζει canvas (drawGhostEntity/HatchRenderer) → stage ADR-040 + ADR-507.
- **N.15:** μετά την υλοποίηση → ADR-507 changelog + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + MEMORY, ίδιο commit.
- **COMMIT = Giorgio.** `git add` ΜΟΝΟ δικά σου (shared tree).

## 6. VERIFY
jest → tsc (N.17 background) → browser-verify (`/dxf/viewer`: gradient hatch → επίλεξε → σύρε origin λαβή → **το gradient fill ακολουθεί LIVE κατά το drag**, όχι μόνο στο release· release → ίδιο αποτέλεσμα· F5 persist) → docs → ΣΤΟΠ για commit (Giorgio).
