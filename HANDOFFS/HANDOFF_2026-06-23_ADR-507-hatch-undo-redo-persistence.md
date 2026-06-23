# HANDOFF — ADR-507: Hatch UNDO (ανάρεση) / REDO (επαναφορά) + σωστές εγγραφές Firestore

**Ημ/νία:** 2026-06-23
**ADR:** ADR-507 (Hatch Creation System) + ADR-390 (Symmetric BIM delete/undo persistence)
**Στόχος:** Revit-grade, **FULL ENTERPRISE + FULL SSoT, μηδέν διπλότυπα.**
**Γλώσσα:** απαντάς στον Giorgio **στα Ελληνικά.**
**⚠️ Shared working tree** — δουλεύει κι άλλος agent. **ΠΟΤΕ `git add -A`. COMMIT κάνει ΜΟΝΟ ο Giorgio.**
**⚠️ N.17:** ΕΝΑ tsc τη φορά (full tsc → OOM exit 134· δεν είναι σφάλμα κώδικα).

---

## 1. ΤΙ ΘΕΛΕΙ Ο GIORGIO (η δουλειά της νέας συνεδρίας)

Έχουμε ήδη τοποθετήσει γραμμοσκιάσεις (pick-point, ADR-507 Φ3 — δουλεύει σωστά, δες §3).
Τώρα θέλει να **δοκιμάσουμε + υλοποιήσουμε** το **undo (ανάρεση)** ΚΑΙ το **redo (επαναφορά)** για γραμμοσκιάσεις, και να επιβεβαιώσουμε ότι **στη βάση δεδομένων γίνονται οι ΣΩΣΤΕΣ εγγραφές**:

- **undo δημιουργίας** γραμμοσκίασης → το entity φεύγει από τη σκηνή **ΚΑΙ** το Firestore doc **διαγράφεται** (ή σημαδεύεται), και **ΔΕΝ** επαναϋδρώνεται από το subscribe.
- **redo** → το entity επανέρχεται **ΚΑΙ** το doc ξαναγράφεται (action='restored'/'created'), με το **ίδιο id**.
- (Επόμενο) **undo/redo διαγραφής** (delete tool) — symmetric.
- (Επόμενο) **undo/redo edit** (grip/move/ribbon property) — re-persist του σωστού payload.

Workflow Giorgio (όπως στην προηγούμενη συνεδρία): σταδιακά τοποθετεί/κάνει undo-redo, και ο agent **ελέγχει τη βάση μέσω firestore MCP** για να επιβεβαιώσει σωστές εγγραφές.

---

## 2. ⛔ ΥΠΟΧΡΕΩΤΙΚΟ ΠΡΩΤΟ ΒΗΜΑ — SSoT AUDIT (grep ΠΡΙΝ γράψεις κώδικα, εντολή Giorgio)

**ΥΠΑΡΧΕΙ ΗΔΗ ΩΡΙΜΟ SSoT για undo/redo persistence (ADR-390) — ΧΡΗΣΙΜΟΠΟΙΗΣΕ ΤΟ, μη φτιάξεις νέο.**

```bash
# Το SSoT restore-on-undo (re-create doc στο undo-διαγραφής / redo-δημιουργίας):
src/subapps/dxf-viewer/hooks/data/useBimEntityRestoredPersistEffect.ts   # ADR-390
# Το αδελφό move-persist (undo/redo μετακίνησης):
grep -rn "useBimEntityMovedPersistEffect" src/subapps/dxf-viewer/hooks/data
# Ποια events εκπέμπουν οι commands στο undo/redo (ΚΛΕΙΔΙ):
grep -rn "bim:entity-restore-requested\|delete-requested\|drawing:entity-created\|drawing:complete" src/subapps/dxf-viewer/core/commands/entity-commands
# Πρότυπο ΩΡΙΜΗΣ persistence με undo/redo (mirror): floor-finish (ADR-419) + column:
src/subapps/dxf-viewer/hooks/data/useFloorFinishPersistence.ts
src/subapps/dxf-viewer/hooks/data/useColumnPersistence.ts            # καλεί useBimEntityRestoredPersistEffect
# Το ΤΡΕΧΟΝ (απλοποιημένο) hatch persistence — εδώ θα προσθέσεις undo/redo wiring:
src/subapps/dxf-viewer/hooks/data/useHatchPersistence.ts
src/subapps/dxf-viewer/bim/hatch/hatch-firestore-service.ts
```

**Κανόνας:** αν υπάρχει αντίστοιχος μηχανισμός → χρησιμοποίησέ τον. Το hatch ΠΡΕΠΕΙ να μπει στο **ίδιο** ADR-390 pattern με τα BIM entities (column/floor-finish), όχι σε ξεχωριστό.

---

## 3. ⛔ ΕΠΑΛΗΘΕΥΜΕΝΑ (ΜΗΝ τα ξαναψάχνεις από το μηδέν)

1. **Η δημιουργία + persistence δουλεύει 100%** (επιβεβαιωμένο με σταδιακό DB-audit, 9 hatches): κάθε κλικ → **1 doc, 1 ring, ακριβώς η περιοχή του ghost**, μηδέν επικάλυψη/διπλοεγγραφή, incl. 3 στοιβαγμένα στο ίδιο κελί. Το `preview ≡ commit` fix (`handleHatchPickPointClick` → `getAutoAreaPreview()`) έκλεισε το παλιό «ξεχείλισμα σε όμορες περιοχές». **UNCOMMITTED** (το committαρει ο Giorgio).
2. **Αρχιτεκτονική undo/redo persistence (ADR-390), ήδη σε χρήση από BIM entities:**
   - **create execute/redo** → `drawing:entity-created` / `drawing:complete` → first-save.
   - **create undo** → command εκπέμπει `bim:*-delete-requested` → διαγραφή doc.
   - **delete execute** → `bim:*-delete-requested` → διαγραφή doc.
   - **delete undo (restore)** → `DeleteEntityCommand.undo()` εκπέμπει **`bim:entity-restore-requested`** → `useBimEntityRestoredPersistEffect` → re-create doc (action='restored').
   - Δες `BimCopyCommand.ts` (σχόλιο 11-12) για το πλήρες τρίπτυχο execute/undo/redo.
3. **ΤΟ ΠΙΘΑΝΟ BUG (επιβεβαίωσέ το με firestore MCP πρώτα):**
   - Το `useHatchPersistence` είναι **«simplified mirror»** — **ΔΕΝ** καλεί `useBimEntityRestoredPersistEffect` ούτε έχει listener για `bim:entity-restore-requested` / delete-on-undo. Στο doc-comment του γράφει ρητά **DEFER: move/grip-edit re-persist**.
   - Το `'hatch'` **ΔΕΝ** είναι στο `BimRestoreEntityType` union του `useBimEntityRestoredPersistEffect.ts` → ακόμα κι αν το `DeleteEntityCommand.undo()` εκπέμψει restore, **κανένα hatch hook δεν το ακούει**.
   - Το hatch δημιουργείται με `completeEntity` → `CompoundCommand(CreateEntityCommand + ReorderEntityCommand)`. Στο **undo** το `CreateEntityCommand.undo()` αφαιρεί το entity από τη σκηνή, αλλά (πιθανόν) **δεν** εκπέμπει hatch-delete event → το Firestore doc **μένει**.
   - **Χειρότερο:** το subscribe-loop στο `useHatchPersistence` (γρ. 153-168) **ξανα-προσθέτει** το entity από το Firestore doc (`if (!existing && !dirty) push hatchDocToEntity`) → **το undo «αναιρείται» οπτικά** (η γραμμοσκίαση ξαναεμφανίζεται). Ο μόνος guard είναι `deletedIdsRef` (tombstone), που σήμερα γεμίζει **μόνο** από το explicit `deleteHatch` (delete tool), **ΟΧΙ** από undo-of-create.

---

## 4. ΥΠΟΘΕΣΗ ΛΥΣΗΣ (επιβεβαίωσε & εξειδίκευσε μετά το audit — Revit-grade, SSoT)

Στόχος: το hatch να μπει στο **ίδιο** ADR-390 τρίπτυχο με τα BIM entities, ΧΩΡΙΣ νέο μηχανισμό.

- **(α) create-undo → delete doc + tombstone:** βεβαιώσου ότι ο command path του hatch εκπέμπει delete-signal στο undo-of-create (ή πρόσθεσε hatch στο fan-out), και ότι το `useHatchPersistence` το ακούει → `deleteHatch`/`deletedIdsRef.add(id)` ώστε το subscribe-loop να **ΜΗΝ** το ξαναπροσθέσει.
- **(β) create-redo / delete-undo → restore doc:** πρόσθεσε `'hatch'` στο `BimRestoreEntityType` + κάλεσε `useBimEntityRestoredPersistEffect('hatch', isHatchEntity, serviceRef, pendingFirstSaveIdsRef, deletedIdsRef, persistRestore)` στο `useHatchPersistence`. `persistRestore` = re-create doc με το **ίδιο id** (reuse `saveHatch`/`hatchEntityToSaveInput`).
- **(γ) ΠΡΟΣΟΧΗ subscribe-loop:** μετά από κάθε undo/redo, βεβαιώσου ότι ο guard `pendingFirstSaveIdsRef`/`deletedIdsRef`/`dirtyIdsRef` δεν αφήνει stale snapshot να αναιρέσει την ενέργεια (race με Firestore Watch). Mirror το ακριβές pattern του `useColumnPersistence` / `useFloorFinishPersistence`.
- **DEFER (αν δεν φτάσει ο χρόνος):** undo/redo για **edit** (grip/move/ribbon) — `useBimEntityMovedPersistEffect`. Πες το ρητά στον Giorgio.

⚠️ **Έλεγξε ΠΡΩΤΑ ποια events εκπέμπει όντως ο command path του hatch** (CreateEntityCommand vs CreateBimEntityCommand — το hatch χρησιμοποιεί το γενικό `CreateEntityCommand` μέσω `completeEntity`, ΟΧΙ το BIM). Ίσως χρειαστεί το hatch να μπει στο delete/restore fan-out του `DeleteEntityCommand` (έλεγξε αν το `'hatch'` περνά το BIM type-guard εκεί).

---

## 5. REPRO + DB AUDIT (firestore MCP)

- **URL:** `localhost:3000/dxf/viewer?...lvl=lvl_0d347bab-dafc-4c62-83a6-3035c9d1a43e` (project Nestor, Ισόγειο).
- **Collection:** `floorplan_hatches` (top-level, companyId+floorId scoped).
- **Scope φίλτρα για query (τρέχον test floor):**
  - `companyId == comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757`
  - `projectId == proj_533d7d91-6824-4f03-a96c-a709dc89f004`
  - `floorplanId == file_e1ed97b5-6e9f-41f2-8018-1371e8b90789`
  - `floorId == flr_926d2b1f-e250-4792-9425-b586260fcf33`
- **Τρέχουσα κατάσταση:** 9 hatches στη βάση (καθαρά, 1 ring έκαστο). Πιθανόν ο Giorgio τα σβήσει για καθαρό baseline.
- **Τεστ ροή:** πρόσθεσε hatch → `firestore_count` (+1) → **undo** → count (ΠΡΕΠΕΙ −1) → **redo** → count (+1, ίδιο id) → επανέλαβε για delete tool. Σύγκρινε `boundaryPaths`/`fillType` πριν/μετά.

---

## 6. ΑΡΧΕΙΑ ΠΟΥ ΘΑ ΑΓΓΙΞΕΙΣ (εκτίμηση)

- `hooks/data/useHatchPersistence.ts` — **ΠΥΡΗΝΑΣ** (wire ADR-390 restore + create-undo delete + subscribe-loop guards).
- `hooks/data/useBimEntityRestoredPersistEffect.ts` — πρόσθεσε `'hatch'` στο `BimRestoreEntityType` union.
- ίσως `core/commands/entity-commands/DeleteEntityCommand.ts` / `CreateEntityCommand.ts` — αν το hatch δεν περνά το BIM delete/restore fan-out (έλεγξε ΠΡΩΤΑ).
- Tests: `hooks/data/__tests__/` (αν υπάρχει hatch-persistence test) + commands tests. Πρόσθεσε undo/redo persistence test.
- ADR-507 + ADR-390 changelog + auto-memory `reference_hatch_persistence.md` / `reference_hatch_pick_point_phase3.md`.
- ⚠️ **CHECK 6B/6D:** αν αγγίξεις entity renderer/canvas → stage ADR-040 + ADR-507 (ο Giorgio στο commit).

---

## 7. ΚΑΝΟΝΕΣ

- **ΟΧΙ commit / ΟΧΙ push / ΟΧΙ `git add -A`** — ο Giorgio κάνει commit (shared tree).
- **FULL SSoT — grep audit ΠΡΩΤΑ** (§2). Reuse ADR-390, μηδέν διπλότυπο.
- Jest GREEN πριν παραδώσεις· tsc μόνο αν χρειαστεί (N.17, OOM-aware, ΕΝΑ τη φορά).
- Revit-grade, FULL ENTERPRISE. Απαντάς **στα Ελληνικά**.
- Στο τέλος: ADR changelog + auto-memory update.
- **ADR-driven workflow (N.0.1):** code = source of truth· αν ο κώδικας ≠ ADR → ενημέρωσε ΠΡΩΤΑ το ADR.

---

## 8. UNCOMMITTED ΤΩΡΑ (μην τα χαλάσεις)

- `handleHatchPickPointClick` preview ≡ commit fix (`canvas-click-tool-handlers.ts`) — ✅ browser-verified, εκκρεμεί commit.
- Άλλος agent πρόσθεσε «Επιλογή γραμμοσκίασης» hit-test στο ίδιο αρχείο (`performDetailedHitTest` + `disarmHatchSelect`) — **shared tree, μην το αγγίξεις**.
- ADR-507 changelog + memory ήδη ενημερωμένα για το preview≡commit fix.
