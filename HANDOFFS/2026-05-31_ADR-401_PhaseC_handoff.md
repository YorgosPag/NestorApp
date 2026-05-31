# HANDOFF — ADR-401 BIM Wall Top/Base Constraints (Attach-to-Structural)

**Ημερομηνία:** 2026-05-31
**Μοντέλο:** Opus 4.8
**Κατάσταση:** Phase C ΥΛΟΠΟΙΗΜΕΝΟ — **pending commit** + 🔴 browser verify
**Επόμενο:** Giorgio θα διαλέξει Phase D / E / F (βλ. §6)

---

## 1. ΤΙ ΟΛΟΚΛΗΡΩΘΗΚΕ ΑΥΤΗ ΤΗ ΣΥΝΕΔΡΙΑ (Phase C)

**Στόχος Phase C:** associative structural-attach — ο «κολλημένος» (attached) τοίχος να ακολουθεί το δοκάρι/πλάκα που τον στηρίζει.

**ΚΡΙΣΙΜΟ ΕΥΡΗΜΑ (code = source of truth):** Η οπτική συσχέτιση host→attached-wall **ΗΔΗ λειτουργούσε** μέσω fresh-recompute:
- `BimSceneLayer.syncWalls` (3D), `section-intersect` (2D τομή) και `wall-boq-feed` (BOQ) ξαναχτίζουν το `WallTopProfile` από τη ζωντανή σκηνή σε **ΚΑΘΕ resync**.
- `use-bim3d-sync` re-runs σε κάθε entity change.
- Άρα host move/rotate/resize ακολουθείται **αυτόματα**.

**Συνέπεια — αναθεωρημένο scope (Revit/ArchiCAD/Bentley parity):** Το αρχικό πλάνο (persisted `cascadeStructuralAttachForHosts` + server batch mirror του `floor-height-cascade.service.ts`) **απορρίφθηκε** ως dead-code/αντι-SSoT:
- Θα έγραφε γεωμετρία που κανείς δεν διαβάζει.
- Beam/slab μετακινούνται **μόνο client-side** → κανένα server trigger υπάρχει.
- Industry: ο client ΕΙΝΑΙ ο geometry engine· το client persistence (geometry+bbox) ΕΙΝΑΙ ο «server».
- Ο Giorgio ρώτησε ρητά «τι θα έκαναν οι μεγάλοι παίκτες» → επιβεβαιώθηκε client-only.

**ΥΛΟΠΟΙΗΘΗΚΕ το πραγματικό κενό = detach-on-host-delete warning:** Όταν σβήνεις δοκάρι/πλάκα που στηρίζει attached τοίχο, ο τοίχος έπεφτε **σιωπηλά** σε baseline. Τώρα βγάζει non-blocking warning (Revit "Top Constraint no longer valid").

### Αρχεία που άλλαξαν/δημιουργήθηκαν (Phase C)

| Αρχείο | Τύπος | Τι |
|--------|-------|-----|
| `bim/walls/wall-structural-attach-coordinator.ts` | **NEW** | `notifyWallsOnHostDeletion(deletedHostIds, sceneManager)` — βρίσκει affected attached τοίχους & εκπέμπει event. ΟΧΙ mutation. |
| `bim/cascade/bim-cascade-resolver.ts` | MOD | **NEW** `findAttachedWalls(hostIds, entities)` — reverse-lookup SSoT (mirror του `findHostedOpenings`, direction beam/slab→wall). |
| `systems/events/EventBus.ts` | MOD | **NEW** event `bim:wall-attach-host-missing` στο `DrawingEventMap`. |
| `hooks/useDxfViewerNotifications.ts` | **NEW** | Thin subscriber → `toast.warning` (sonner). Mounted στο `DxfViewerContent`. |
| `core/commands/entity-commands/DeleteEntityCommand.ts` | MOD | Wire `notifyWallsOnHostDeletion` σε `DeleteEntityCommand.execute` + `DeleteMultipleEntitiesCommand.execute` (μετά removeEntity). |
| `app/DxfViewerContent.tsx` | MOD | import + κλήση `useDxfViewerNotifications()`. |
| `i18n/locales/el|en/dxf-viewer-shell.json` | MOD | NEW key `attachToStructural.hostMissing` (+3/+3 γραμμές, minimal). |
| `bim/walls/__tests__/wall-structural-attach-coordinator.test.ts` | **NEW** | 9 tests. |

**Σχεδιαστική απόφαση (Revit parity):** ΟΧΙ mutation του `attachTopToIds`. Ο resolver εξουδετερώνει gracefully τα missing hosts (`missingHostIds` → baseline top). Κρατώντας το ref, **undo της διαγραφής ξανα-attach-άρει αυτόματα**.

### Verification
- **9/9** νέα tests PASS (`wall-structural-attach-coordinator.test.ts`).
- **Regression 42/42** (cascade-resolver + DeleteEntity + wall-opening-coordinator + structural-attach).
- **tsc = 0 errors** (total).

### Docs ενημερωμένα (κανόνας N.15)
- ADR-401: status header + §5 Phase C + §8 changelog row.
- adr-index.md: regenerated (`node docs/centralized-systems/reference/scripts/generate-adr-index.cjs`).
- `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`: Phase C → ΥΛΟΠΟΙΗΜΕΝΟ.
- Memory: `project_adr401_wall_top_constraints.md` + `MEMORY.md`.

---

## 2. ⚠️ ENVIRONMENT INCIDENT (ΔΙΑΒΑΣΕ ΤΟ)

Αυτή η συνεδρία ξεκίνησε **μετά από κόλλημα υπολογιστή**. Το περιβάλλον είχε:
- **Output corruption** — tool reads επέστρεφαν παραπλανητικό περιεχόμενο.
- **Replayed-command backlog** — παλιές queued εντολές εκτελέστηκαν ξανά.

Αυτό οδήγησε σε αρχικά λάθη που **ΟΛΑ διορθώθηκαν**:
- Μάντεψα λάθος path `core/events/EventBus` → σωστό είναι `systems/events/EventBus`.
- Μάντεψα ανύπαρκτο namespace `dxf-viewer-bim.json` → σωστό είναι `dxf-viewer-shell.json`.
- Χρησιμοποίησα ανύπαρκτα symbols `emitDxfViewerEvent`/`subscribeDxfViewerEvent`/`DxfViewerEventMap`.
- Ένα Write παραλίγο να σβήσει τη `DeleteMultipleEntitiesCommand` (ADR-390) — επανήλθε πλήρως.

**Ο τελικός κώδικας είναι verified via jest/tsc/node-fs, ΟΧΙ via Read-tool cache.**

**Για το επόμενο session:** Το πραγματικό EventBus API είναι `EventBus.emit(type, payload)` / `EventBus.on(type, handler)` με ΕΝΑ interface `DrawingEventMap` στο `src/subapps/dxf-viewer/systems/events/EventBus.ts`.

---

## 3. PENDING COMMIT (ΔΕΝ ΕΓΙΝΕ COMMIT)

Ο Giorgio θα δώσει εντολή commit. Τα **δικά μου** αρχεία Phase C:
```
M  docs/centralized-systems/reference/adr-index.md
M  docs/centralized-systems/reference/adrs/ADR-401-...attach-to-structural.md
M  src/i18n/locales/el/dxf-viewer-shell.json
M  src/i18n/locales/en/dxf-viewer-shell.json
M  src/subapps/dxf-viewer/app/DxfViewerContent.tsx
M  src/subapps/dxf-viewer/bim/cascade/bim-cascade-resolver.ts
A  src/subapps/dxf-viewer/bim/walls/__tests__/wall-structural-attach-coordinator.test.ts
A  src/subapps/dxf-viewer/bim/walls/wall-structural-attach-coordinator.ts
M  src/subapps/dxf-viewer/core/commands/entity-commands/DeleteEntityCommand.ts
A  src/subapps/dxf-viewer/hooks/useDxfViewerNotifications.ts
M  src/subapps/dxf-viewer/systems/events/EventBus.ts
```

⚠️ **ΠΡΟΣΟΧΗ — ΟΧΙ δικά μου (άλλος agent, ΜΗΝ τα κάνεις stage):**
```
 M src/subapps/dxf-viewer/bim/geometry/footprint-region-classifier.ts
?? src/subapps/dxf-viewer/bim/stores/envelope-floor-slabs-store.ts
?? src/subapps/dxf-viewer/hooks/data/useEnvelopeFloorSlabs.ts
```
Επίσης υπάρχει pending δουλειά **ADR-402** (gizmo, `bim-3d/animation/` + `bim-3d/gizmo/`) από προηγούμενη συνεδρία — άσχετη με Phase C. Χρησιμοποίησε `git add <specific files>`, ΠΟΤΕ `git add -A`.

---

## 4. 🔴 BROWSER VERIFY (εκκρεμεί)

Δοκίμασε: τοποθέτησε attached τοίχο κάτω από δοκάρι → **σβήσε το δοκάρι** → πρέπει να εμφανιστεί toast warning «Ο τοίχος έχασε το δομικό στήριγμα κορυφής». Ο τοίχος πέφτει σε baseline ύψος (σωστό). Undo → ξανα-attach.

---

## 5. ΤΙ ΕΧΕΙ ΓΙΝΕΙ ΣΥΝΟΛΙΚΑ ΣΤΟ ADR-401

- ✅ **Phase A** — resolver SSoT (`wall-top-profile.ts`, lower-envelope σκαλωτή/κεκλιμένη) + types + `topBinding='attached'` + `attachTopToIds[]` + Zod.
- ✅ **Phase B1** — host-plan builder SSoT + full-profile 2D section.
- ✅ **Phase B2** — stepped/sloped 3D wall solid (3 converter paths) + syncWalls wiring.
- ✅ **Phase B3a** — profile-aware `computeWallGeometry` (area/volume/bbox) + BOQ feed.
- ✅ **Phase B3b** — ETICS Z1 πλήρες σκαλωτό κέλυφος (per-edge variable top).
- ✅ **Phase B3c** — 2D plan cut-state = no-op confirmed + doc.
- ✅ **Phase C** — associative attach (fresh-recompute) + detach-on-host-delete warning. **← ΑΥΤΗ Η ΣΥΝΕΔΡΙΑ**

Όλα pending commit + 🔴 browser verify.

---

## 6. ΕΠΟΜΕΝΕΣ ΦΑΣΕΙΣ (ο Giorgio θα διαλέξει)

### Phase D — Auto-attach UX
Όταν τοποθετείται δοκάρι **πάνω** σε τοίχους → οι τοίχοι attach-άρουν αυτόματα από κάτω (με undo).
- Hook: `useSpecialTools.ts:406` `onBeamCreated` (+ slab commit).
- NEW `AttachWallsTopCommand` (undoable, batch).
- Detect: `polygonIntersectionAreaMm2` (shared/polygon-utils) — ποιοι τοίχοι είναι κάτω από το footprint.
- Μόνο `topBinding='storey-ceiling'` τοίχοι attach-άρουν (δεν πειράζουμε unconnected/absolute).

### Phase E — Manual attach/detach ribbon + κεκλιμένη στέγη
- Ribbon κουμπιά «Κόλλησε κορυφή σε…» / «Αποκόλληση» (Revit parity, multi-host).
- Wall-top vertical grip.
- Manual-height-edit-breaks-attach.
- **E2 — κεκλιμένη στέγη/δοκάρι:** ο 3D sloped-wedge path (`buildSlopedWallPieceGeometry`) ΗΔΗ ΕΙΝΑΙ ΕΤΟΙΜΟΣ από B2· λείπει **μόνο ο roof host adapter** (mirror των `beamHostInput`/`slabHostInput`).
- Base-attach (δοκός θεμελίωσης).

### Phase F — Column mirror
Γενίκευση όλου του attach συστήματος και στις κολώνες (ίδιος resolver + coordinator). Το `attachTopToIds` είναι ήδη στο shared `WallTopBinding`/column alias.

---

## 7. ΣΧΕΤΙΚΑ MEMORY FILES
- `project_adr401_wall_top_constraints.md` (κύριο — πλήρες detail)
- `project_adr363_hosted_opening_cascade.md` (το pattern που καθρεφτίζουμε)
- `feedback_derived_geometry_central_cascade.md`
- `feedback_multi_agent_stage_race.md` (γιατί ΟΧΙ `git add -A`)
