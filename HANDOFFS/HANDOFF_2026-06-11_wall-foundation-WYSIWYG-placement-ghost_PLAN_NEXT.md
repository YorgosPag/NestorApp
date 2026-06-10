# HANDOFF — WYSIWYG placement preview για Τοίχο + Πεδιλοδοκό/Συνδετήρια (αντί για πράσινες γραμμές)

**Date:** 2026-06-11 · **Branch:** main · **Shared working tree** (άλλος agent δουλεύει ταυτόχρονα)

> ⚠️ **ΚΑΝΟΝΕΣ (απαράβατοι):** ΠΟΤΕ `git commit`/`push` — **ο Giorgio κάνει commit**. `git add` **ΜΟΝΟ τα δικά σου αρχεία**, **ΠΟΤΕ `-A`** (shared tree). N.17: ΕΝΑ tsc τη φορά (έλεγξε για άλλον πρώτα). Renderer/canvas/preview touch → stage ADR-040 changelog (CHECK 6B/6D). **Απάντα στον Giorgio ΕΛΛΗΝΙΚΑ.** Ξεκίνα με **Plan Mode** + πρότεινε μοντέλο (cross-cutting → Opus).
>
> 🎯 **Στόχος ποιότητας (Giorgio):** FULL ENTERPRISE + FULL SSOT, όπως **Revit**. **SEARCH FIRST**.

---

## 1. ΤΙ ΘΕΛΕΙ Ο GIORGIO (το πρόβλημα)

Όταν διαλέγει την εντολή **Τοίχος** ή **Πεδιλοδοκός/Συνδετήρια** και κινεί το ποντίκι (2-click placement, **πριν** ολοκληρωθεί), η **προεπισκόπηση** δείχνει **πράσινες παράλληλες γραμμές** (σχηματικό πλαίσιο/περίγραμμα), ΟΧΙ τον πραγματικό τοίχο/πεδιλοδοκό.

**Θέλει:** κατά το placement να σχεδιάζεται **απευθείας το πραγματικό στοιχείο (WYSIWYG)** — ίδιο fill/hatch/πάχος/στυλ/χρώμα όπως εμφανίζεται **μόλις ολοκληρωθεί** — όχι πράσινες γραμμές. (Επιβεβαιώθηκε ρητά: «ΝΑΙ ΣΩΣΤΑ».)

---

## 2. ΡΙΖΑ — γιατί βγαίνουν πράσινες γραμμές (πλήρης χάρτης pipeline)

**Σημαντικό:** η ΓΕΩΜΕΤΡΙΑ υπολογίζεται ΗΔΗ σωστά κάθε mousemove· το πρόβλημα είναι ΜΟΝΟ το **rendering** (flat green polyline outline αντί για πραγματικό render).

### Current GREEN-LINE preview path
```
mousemove
→ hooks/drawing/drawing-hover-handler.ts:~214   updatePreview(pt)
→ hooks/drawing/useUnifiedDrawing.tsx:~268       resolveBimToolTempPoints()  (reads wall/foundation preview stores)
→ hooks/drawing/drawing-preview-generator.ts     generatePreviewEntity('wall' | 'foundation-strip'|'foundation-tie-beam')
     wall       → hooks/drawing/wall-preview-helpers.ts  makeWallFootprintGhost()/makeWallPolylineGhost()
                  → buildDefaultWallParams() + computeWallGeometry()  → ΗΔΗ σωστή γεωμετρία (outer/inner edge ring)
                  → ΦΤΙΑΧΝΕΙ PolylineEntity { color: UI_COLORS.BRIGHT_GREEN, opacity:0.55, preview:true }
     foundation → hooks/drawing/foundation-preview-helpers.ts  makeFoundationBandGhost()
                  → buildDefaultFoundationParams() + computeFoundationGeometry()  → ΗΔΗ σωστή γεωμετρία (footprint.vertices)
                  → ΦΤΙΑΧΝΕΙ PolylineEntity { color: UI_COLORS.BRIGHT_GREEN, opacity:0.60, preview:true }
→ hooks/drawing/drawing-hover-handler.ts:~230    previewCanvasRef.current.drawPreview(entity)
→ canvas-v2/preview-canvas/PreviewCanvas.tsx:~305  renderer.drawPreview(...)
→ canvas-v2/preview-canvas/PreviewRenderer.ts:~274  ctx.strokeStyle = opts.color  ← '#00ff00' (DEFAULT_PREVIEW_OPTIONS)
→ canvas-v2/preview-canvas/preview-entity-renderers.ts:~108  renderPolyline() → ctx.stroke()   ← Η ΠΡΑΣΙΝΗ ΓΡΑΜΜΗ
```

- **Green color SSoT:** `config/color-config.ts` `PREVIEW_DEFAULTS.color = UI_COLORS.BRIGHT_GREEN '#00ff00'` + `canvas-v2/preview-canvas/preview-renderer-types.ts` `DEFAULT_PREVIEW_OPTIONS.color`. (⚠️ Αλλαγή ΕΔΩ επηρεάζει ΟΛΑ τα drawing tools — line/circle/polyline — ΟΧΙ εδώ η λύση.)
- Το `PreviewRenderer` ξέρει μόνο type `'polyline'`/`'line'`/κ.λπ. και κάνει uniform stroke· αγνοεί fill/hatch/lineweight/category color.

### Real renderers (committed entities ΜΟΝΟ — δεν είναι στο preview path)
- `bim/renderers/WallRenderer.ts` `render(entity, options)` — θέλει πλήρες `WallEntity { .params, .geometry=computeWallGeometry }`. Σχεδιάζει outer/inner edges, category fill, hatch, axis, cut-plane, opening cutouts.
- `bim/renderers/FoundationRenderer.ts` `render(entity, options)` — θέλει `FoundationEntity { .params, .geometry.footprint.vertices }`. Σχεδιάζει dashed hidden-line footprint, kind fill, RC hatch, centerline (strip/tie-beam), center cross (pad).
- Καλούνται από `rendering/core/EntityRendererComposite.ts` στο ΚΥΡΙΟ DXF canvas. Επεκτείνουν `BaseEntityRenderer` (θέλουν `this.ctx`, `this.transform`, `this.worldToScreen`, `this.phaseManager`).

### Reusable GHOST SSoT (grip-drag / Move tool — ΟΧΙ placement)
- `rendering/ghost/draw-ghost-entity.ts` `drawGhostEntity(ctx, entity, transform, viewport)` — έχει ΗΔΗ `case 'wall'` + `case 'foundation'` (silhouette polygon, caller-controlled color/alpha). [Προστέθηκαν πρόσφατα.]
- `hooks/tools/useGripGhostPreview.ts` (RAF) → `apply-entity-preview.ts` `applyEntityPreview` → `drawGhostEntity`. **Λειτουργεί ΜΟΝΟ σε committed entities (edit), ΟΧΙ σε placement.**

### 2-points → params builders (pure· καλούνται ΗΔΗ mid-placement)
- Wall: `hooks/drawing/wall-completion.ts` `buildDefaultWallParams(start, end, overrides, sceneUnits, alignmentPoint?)` + `bim/geometry/wall-geometry.ts` `computeWallGeometry(params, kind)`.
- Foundation: `hooks/drawing/foundation-completion.ts` `buildDefaultFoundationParams(start, kind, {axisEnd:end})` + `computeFoundationGeometry(params)` · `completeFoundationFromTwoClicks(...)` · `buildFoundationEntity(params, layerId)` · `bim/foundations/foundation-from-wall.ts` `buildStripFromWall(...)`.

---

## 3. ΠΡΟΤΕΙΝΟΜΕΝΗ ΛΥΣΗ (FULL SSOT — Revit-grade)

**Η σωστή enterprise/SSoT λύση = render του placement preview με τους ΙΔΙΟΥΣ πραγματικούς renderers** (`WallRenderer`/`FoundationRenderer`), ΟΧΙ νέο/παράλληλο preview κώδικα. Έτσι το preview **είναι** εξ ορισμού identical με το τελικό (WYSIWYG), μηδέν duplication.

### Βήματα (high-level — ο επόμενος agent κάνει Plan Mode):
1. **Mid-placement → synthetic full entity:** στα `wall-preview-helpers.ts` / `foundation-preview-helpers.ts`, αντί για `PolylineEntity` (green ring), φτιάξε **πλήρες `WallEntity` / `FoundationEntity`** με `.params` + `.geometry` (η γεωμετρία ΗΔΗ υπολογίζεται — απλώς wrap σε entity με `preview:true`). Reuse `buildWallEntity`/`buildFoundationEntity` factories.
2. **Render το synthetic entity με τον πραγματικό renderer στο PreviewCanvas context:** το decision point είναι `hooks/drawing/drawing-hover-handler.ts:~229-230` (σήμερα πάντα `previewCanvasRef.current.drawPreview(entity)` → green). Πρόσθεσε branch: αν το preview entity είναι `wall`/`foundation`, render μέσω WallRenderer/FoundationRenderer (ή του `EntityRendererComposite`) πάνω στο preview canvas 2D ctx + transform, με phase = «ghost/preview» styling (π.χ. translucent/μειωμένο alpha για να ξεχωρίζει ότι είναι preview, αλλά WYSIWYG μορφή).
3. **BaseEntityRenderer wiring:** οι real renderers θέλουν `ctx/transform/worldToScreen/phaseManager`. Δες πώς το `EntityRendererComposite` τους instantiate-άρει· πιθανώς reuse composite ή ένα ελαφρύ single-renderer pass στο preview canvas. **SEARCH FIRST** για υπάρχον «render entity to arbitrary ctx» helper (μην φτιάξεις νέο αν υπάρχει).
4. **Preview styling SSoT:** αν θες το ghost να φαίνεται «preview» (π.χ. ελαφρώς διάφανο), κάν' το μέσω phase state / RenderOptions, ΟΧΙ hardcoded χρώμα. WYSIWYG = ίδιο fill/hatch/lineweight, απλώς (προαιρετικά) μειωμένο opacity.

### Εναλλακτική (πιο γρήγορη, λιγότερο πλήρης): route μέσω `drawGhostEntity` (silhouette μόνο — outer/inner ring χωρίς hatch/fill). Δίνει σωστό **σχήμα** + caller-controlled χρώμα (όχι πράσινο), αλλά ΟΧΙ πλήρες fill/hatch. **Ο Giorgio ζήτησε «όπως το τελικό» → προτίμησε την πλήρη λύση (real renderers).**

---

## 4. ΡΙΣΚΑ / ΠΡΟΣΟΧΗ
- **ADR-040 (CHECK 6B/6D):** `drawing-hover-handler.ts`, `PreviewRenderer.ts`, `preview-entity-renderers.ts`, οι BIM renderers = canvas/preview-critical → **stage ADR-040 changelog**. ΜΗΝ βάλεις `useSyncExternalStore` σε orchestrators. Το preview path είναι imperative (zero React re-render) — κράτα το έτσι (RAF/direct ctx write).
- **Shared tree:** τα `wall-preview-store`/`foundation-preview-store`/`useFoundationTool` πιθανώς τα αγγίζει κι άλλος agent (foundation Slice 2 + space-separator). `git add` ΜΟΝΟ δικά σου.
- **Μην αλλάξεις** το `DEFAULT_PREVIEW_OPTIONS.color` / `PREVIEW_DEFAULTS` (επηρεάζει ΟΛΑ τα tools). Η αλλαγή πρέπει να είναι **per-tool** (wall/foundation), όχι global.
- **Performance:** το render τρέχει κάθε mousemove — οι real renderers κάνουν hatch/fill (πιο βαρύ από 1 stroke). Έλεγξε FPS· αν χρειαστεί, skip hatch σε preview (zoom-out guard ήδη υπάρχει στους renderers).
- **Curved/polyline wall + pad foundation:** το ίδιο pattern· βεβαιώσου ότι καλύπτεις όλα τα kinds (ή τουλάχιστον straight wall + strip/tie-beam που ανέφερε ο Giorgio).
- **Άλλα tools:** ο Giorgio ανέφερε Τοίχο + Πεδιλοδοκό. Πιθανόν να θέλει το ίδιο και σε κολώνα/πέδιλο/δοκό αργότερα → σχεδίασε το SSoT helper γενικό (entity-type-agnostic «render preview entity με τον πραγματικό renderer») ώστε να επεκτείνεται.

## 5. VERIFY
- Browser: διάλεξε Τοίχο → κίνησε ποντίκι → πρέπει να φαίνεται **πραγματικός τοίχος** (fill/hatch/πάχος), όχι πράσινες γραμμές. Ίδιο για Πεδιλοδοκό/Συνδετήρια. Ολοκλήρωσε → το τελικό === preview.
- `npx tsc --noEmit` (N.17). Jest στα drawing/preview helpers αν υπάρχουν.

## 6. ΣΧΕΤΙΚΟ ΥΠΑΡΧΟΝ (ΕΚΚΡΕΜΟΤΗΤΕΣ)
- `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` line ~45: «LIVE-GHOST OVERLAY gap (ADR-415/ADR-437)» — floorplan-symbol + space-separator δεν έχουν preview field → παρόμοιο θέμα live ghost. Ίδιο SSoT μπορεί να τα καλύψει.

---

## 7. QUICK COMMANDS
```
# Πού βγαίνει το green stroke:
#   canvas-v2/preview-canvas/PreviewRenderer.ts  +  preview-entity-renderers.ts (renderPolyline)
# Πού φτιάχνεται το green preview entity:
#   hooks/drawing/wall-preview-helpers.ts  +  hooks/drawing/foundation-preview-helpers.ts
# Decision point (dispatch):
#   hooks/drawing/drawing-hover-handler.ts (~229-230)
# Real renderers να reuse:
#   bim/renderers/WallRenderer.ts  +  bim/renderers/FoundationRenderer.ts  (via EntityRendererComposite)
```
