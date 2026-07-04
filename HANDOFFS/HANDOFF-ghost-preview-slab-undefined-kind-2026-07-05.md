# HANDOFF — Runtime TypeError: buildEntityModelFromDxf «Cannot read properties of undefined (reading 'kind')» — 2026-07-05

## 🎯 ΤΟ ΠΡΟΒΛΗΜΑ (νέα συνεδρία — καθαρό context)

Runtime crash κατά το **grip ghost preview μέλους** (member body — κολόνα/δοκός/θεμέλιο/slab):

```
TypeError: Cannot read properties of undefined (reading 'kind')
  at buildEntityModelFromDxf   src/subapps/dxf-viewer/canvas-v2/dxf-canvas/dxf-renderer-entity-model.ts:105:47
  at drawRealEntityPreview     src/subapps/dxf-viewer/rendering/ghost/draw-real-entity-preview.ts:46:40
  at drawMemberBodyGhostWithJoinMiter  src/subapps/dxf-viewer/hooks/tools/useGripGhostPreview.ts:59
  at useGripGhostPreview ...draw  useGripGhostPreview.ts:474
  at useCanvasGhostPreview drawFrame  useCanvasGhostPreview.ts:135 → schedule(160) → raf-coalesced-throttle(102)
  ... CanvasLayerStack → CanvasSection → NormalView → DXFViewerLayout → DxfViewerContent
```

**Code frame (dxf-renderer-entity-model.ts):**
```ts
103 |   case 'slab': {
104 |     const s = entity.slabEntity;
105 |     return { ...base, type:'slab', kind: s.kind, params:s.params, geometry:s.geometry, ... };  // ← s === undefined
```

## 🧠 ΤΙ ΞΕΡΟΥΜΕ (μη-επιβεβαιωμένη υπόθεση — ΧΡΕΙΑΖΕΤΑΙ repro-confirm)

- Η `buildEntityModelFromDxf` (SSoT: DxfEntityUnion → `Entity`) στα cases **με sub-entity payload**
  (`slab`→`entity.slabEntity`, `slab-opening`→`slabOpeningEntity`, `opening`→`openingEntity`,
  `stair`→`stairEntity`, `dimension`→`dimensionEntity`) κάνει **dereference χωρίς guard**. Τα cases
  `wall/beam/column` διαβάζουν `entity.kind` **απευθείας** (χωρίς sub-entity) → δεν σπάνε.
- Ο crash σκάει όταν ένα μοντέλο έχει `type==='slab'` αλλά `slabEntity===undefined`.
- **Πιθανή σύνδεση με πρόσφατη δουλειά:** μόλις ενεργοποιήθηκε (ADR-560 §grip-OSNAP-unified, commit
  `6548344a` + προηγούμενα) το grip Alt-drag OSNAP για **δοκό/θεμέλιο** (Full scope). Ίσως τώρα ο Giorgio
  σέρνει member (foundation/slab-like) που πυροδοτεί το `drawMemberBodyGhostWithJoinMiter` → ghost build →
  crash. **ΠΡΟΣΟΧΗ:** μπορεί να είναι **προϋπάρχον** ή από το **ταυτόχρονο ADR-574 ghost-preview refactor
  του ΑΛΛΟΥ agent** (in-progress: διαγράφει `*GhostRenderer.ts`, τροποποιεί `useMepXGhostPreview`,
  νέο `bim/ghosts/wysiwyg-placement-ghost.ts`). **ΕΠΙΒΕΒΑΙΩΣΕ ΠΡΩΤΑ το ακριβές repro** (ποιον τύπο μέλους
  σέρνει, ποια λαβή, Alt ή όχι) πριν γράψεις κώδικα.

## 🚦 ΕΝΤΟΛΕΣ GIORGIO ΓΙΑ ΤΗ ΝΕΑ ΣΥΝΕΔΡΙΑ (ΑΠΑΡΑΒΑΤΑ)

1. **SSoT AUDIT ΠΡΩΤΑ (πραγματικό grep) — ΠΡΙΝ γράψεις γραμμή κώδικα.** Ψάξε αν υπάρχει ήδη:
   - guard/helper για ασφαλή DxfEntityUnion→Entity (μήπως υπάρχει `isX`/`assertX` ή builder που ΠΑΝΤΑ
     γεμίζει το `slabEntity`). Grep: `buildEntityModelFromDxf`, `slabEntity`, `stairEntity`, `dimensionEntity`,
     `DxfEntityUnion`, `drawMemberBodyGhostWithJoinMiter`, `drawRealEntityPreview`.
   - **ΠΟΥ γεμίζει** το `slabEntity`/sub-entity (upstream builder) — μήπως η ρίζα είναι εκεί (member ghost
     φτιάχνει μοντέλο `type:'slab'` χωρίς payload), ΟΧΙ στο dereference.
   - Reuse υπάρχοντος, **ΜΗΔΕΝ διπλότυπα** (N.0/N.0.2).
2. **Enterprise + FULL SSOT.** Υλοποίηση όπως **Revit / Maxon (Cinema 4D) / Figma-level**. Αν οι μεγάλοι
   παίκτες ΔΕΝ προτείνουν την enterprise προσέγγιση → ακολούθησε τη **δική τους πρακτική**.
3. **Root cause, όχι patch.** Απόφαση: guard στο dereference (defensive) **Ή** fix στον upstream που παράγει
   μοντέλο χωρίς payload — ό,τι είναι το ΠΡΑΓΜΑΤΙΚΟ SSoT σημείο (μην κρύψεις bug με optional chaining τυφλά).
4. **COMMIT/PUSH: μόνο ο Giorgio.** ΠΟΤΕ εσύ. Ετοίμασε, `git add <specific>`, verify `git diff --cached`, STOP.
5. **Shared working tree με άλλον agent.** ΠΟΤΕ `git add -A` / bulk reset / checkout. Άγγιξε ΜΟΝΟ δικά σου
   αρχεία. Τα `*GhostRenderer.ts` (deleted), `useMepXGhostPreview` (M), `wysiwyg-placement-ghost.ts` (??),
   `ADR-537/ThreeJsSceneManager/viewport-camera` = **ΑΛΛΟΥ agent → ΜΗΝ τα αγγίξεις**.
6. **ΟΧΙ tsc** (N.17). jest επιτρέπεται/ενθαρρύνεται.

## 📚 ΚΛΕΙΔΙΑ-ΑΡΧΕΙΑ

- `canvas-v2/dxf-canvas/dxf-renderer-entity-model.ts` — `buildEntityModelFromDxf` (crash γρ.105· switch σε
  `entity.type`, sub-entity cases 90-113 χωρίς guard).
- `rendering/ghost/draw-real-entity-preview.ts` (γρ.46) — καλεί το build.
- `hooks/tools/useGripGhostPreview.ts` (`drawMemberBodyGhostWithJoinMiter` γρ.59, draw γρ.474) — ο member ghost.
- `hooks/tools/useCanvasGhostPreview.ts` (drawFrame 135 / schedule 160) — RAF orchestrator.
- Grep upstream builder του `slabEntity`/`DxfEntityUnion` (πού γεννιέται το μοντέλο του member ghost).

## ✅ ΠΡΟΗΓΟΥΜΕΝΟ ΠΛΑΙΣΙΟ (τι ΜΟΛΙΣ έγινε — μπορεί να είναι σχετικό)

ADR-560 §grip-OSNAP-unified (commit `6548344a` + προηγούμενα του άλλου agent): ενοποιήθηκε το grip Alt-drag
OSNAP σε ΕΝΑ resolver (`systems/cursor/grip-drag-snap-resolver.ts`) + generic member corner-source
(`bim/structural/member-grip-corner-snap.ts`) που **ενεργοποίησε δοκό/θεμέλιο** στο grip snapping. Η
corner-projection δέχεται πλέον μόνο διακριτούς στόχους (`corner-projection-snap.ts`, ADR-560 λ). Αυτό ίσως
έκανε τον Giorgio να σέρνει members που πυροδοτούν το ghost crash. jest GREEN (77). **Άσχετο με το crash
αρχείο** — αλλά ίσως ο trigger.
