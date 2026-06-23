# HANDOFF — Η κολόνα ΕΞΑΦΑΝΙΖΕΤΑΙ μετά το auto-πέδιλο + εναλλαγή ορόφου

**Ημερομηνία:** 2026-06-23
**Προτεραιότητα:** 🔴 ΣΟΒΑΡΟ (απώλεια δεδομένων — η κολόνα χάνεται από 2D + 3D)
**Working tree:** ⚠️ ΜΟΙΡΑΖΕΤΑΙ με άλλον agent — ΜΗΝ κάνεις commit (ο Giorgio κάνει commit). Stage μόνο τα δικά σου.
**Μοντέλο:** Opus (cross-cutting: foundations + persistence + levels + 3D).

---

## 1. ΣΥΜΠΤΩΜΑ (Giorgio, αυτολεξεί)

1. Τοποθετώ κολόνα σε περιοχή (adopt-rect) → δημιουργείται κολόνα 25×100 στο **ισόγειο**.
2. **Ταυτόχρονα** δημιουργείται αυτόματα **πέδιλο** στη **θεμελίωση** (auto-foundation — σωστό από μόνο του).
3. Πάω στο **3D / ισόγειο** → βλέπω την κολόνα ✓.
4. Πάω στη **θεμελίωση** → βλέπω το πέδιλο ✓.
5. **Επιστρέφω στο ισόγειο** → η κολόνα **ΕΞΑΦΑΝΙΣΤΗΚΕ** — και από το 3D ΚΑΙ από την κάτοψη του 2D καμβά. 🔴

Δηλαδή: η εναλλαγή ορόφου (που κάνει reload σκηνής από Firestore) «χάνει» την κολόνα. Το πέδιλο επιβιώνει, η κολόνα όχι.

## 2. ΖΗΤΟΥΜΕΝΟ (Giorgio)

- FULL ENTERPRISE + FULL SSOT, **όπως Revit** (hosted element regeneration, σταθερά IDs, cross-level integrity).
- **ΠΡΙΝ τον κώδικα: πραγματικό SSoT audit (grep)** — μην φτιάξεις διπλότυπο· υπάρχει ήδη ολόκληρο auto-foundation σύστημα (δες §4).
- 100% honesty. Διάγνωση με **μέτρηση** (diagnostic logs detection→proposal→params→persist), όχι μαντεψιά — αυτή η μέθοδος δούλεψε στο προηγούμενο bug (δες §6).

## 3. ΥΠΟΨΗΦΙΕΣ ΡΙΖΕΣ (να επιβεβαιωθούν με logs — ΜΗΝ τις θεωρήσεις δεδομένες)

- **(Α) Persistence race / wrong scope:** Η κολόνα ίσως δεν persist-άρεται ΣΩΣΤΑ (ή σε λάθος level scope), οπότε στο επόμενο level-switch reload από Firestore «δεν υπάρχει» → εξαφανίζεται. Ο `foundation-cross-level-writer` γράφει το πέδιλο σε ΑΛΛΟ scope (foundation floorId) ενώ ο ενεργός όροφος είναι το ισόγειο· πιθανή σύγκρουση `SceneWriteOrigin` / scope όταν επιστρέφεις.
- **(Β) Auto-foundation reconcile διαγράφει λάθος:** Ο `auto-foundation-reconcile` βγάζει `removeFootingIds` (πέδιλα), ΟΧΙ κολόνες — ΑΛΛΑ το `executeGrouped` (atomic undo: column-create + footing-derive στο ΙΔΙΟ step) ίσως, σε reload/re-run, να αναιρεί/χαλάει την κολόνα. Έλεγξε τη γκρουπαρισμένη εντολή.
- **(Γ) Base re-home στη θεμελίωση:** `column-hosting-strategy` / `derive-params-from-guides` ίσως αλλάζουν `baseOffset`/binding της κολόνας ώστε η βάση να «κατεβαίνει» στη θεμελίωση → φεύγει από το level-filter του ισογείου (2D + 3D). Αλλά τότε θα εμφανιζόταν στη θεμελίωση — ο Giorgio ΔΕΝ τη βλέπει εκεί → λιγότερο πιθανό, αλλά έλεγξέ το.
- **(Δ) Adopt-specific:** Μήπως συμβαίνει ΜΟΝΟ σε adopt κολόνες (όχι σε κανονική 2-click τοποθέτηση); Το adopt πρόσφατα πήρε `autoSized:false` (δες §6) — έλεγξε αν το flag επηρεάζει τον organism/foundation reconcile (π.χ. κάποιο φίλτρο «μόνο auto-sized»).
  **ΠΡΩΤΟ ΒΗΜΑ:** αναπαρήγαγε ΚΑΙ με κανονική 2-click κολόνα — αν εξαφανίζεται κι αυτή → ΟΧΙ adopt-specific, είναι foundation/persistence γενικά.

## 4. SSoT AUDIT — ΥΠΑΡΧΟΝΤΑ ΣΥΣΤΗΜΑΤΑ (REUSE, ΜΗΝ ΞΑΝΑΦΤΙΑΞΕΙΣ)

Auto-foundation (ADR-459 Phase 7 / ADR-500):
- `hooks/useAutoFoundationDesign.tsx` — reactive shell· αντιδρά σε `drawing:entity-created`, `bim:column-params-updated`, `bim:entities-moved`, `bim:column-delete-requested`, `bim:structural-loads-computed`. Coalesced/microtask, `executeGrouped` atomic undo.
- `hooks/auto-foundation-design-core.ts` — `runAutoFoundationDesign` (SSoT πυρήνας, κοινός με `runAutoStudy`).
- `bim/foundations/auto-foundation-layout.ts` — `planFoundationLayout` (επιθυμητό layout).
- `bim/foundations/auto-foundation-reconcile.ts` — pure diff (creates/updates/`removeFootingIds`)· matching μέσω `ColumnParams.footingId` FK. Tol: `RECONCILE_POSITION_TOL_MM=50` κ.λπ.
- `bim/foundations/foundation-cross-level-writer.ts` — γράφει πέδιλο σε **foundation scope** ενώ ενεργός = άλλος όροφος (fire-and-forget Firestore + scene mutation όταν φορτωμένη).
- `bim/foundations/foundation-column-attach-coordinator.ts` — attach κολόνα↔πέδιλο (FK `footingId`).
- `app/FoundationPersistenceHost.tsx` — persistence host (listener `drawing:entity-created`).
- `hooks/useStructuralFootingConnect.ts`, `useAutoFoundationDesign.tsx`.

Column creation + persistence:
- `hooks/drawing/useColumnTool.ts` → `commitColumnAt` → `onColumnCreated(entity)` → `bim/columns/add-column-to-scene.ts` (`addColumnToScene` → `appendEntityToScene(..., 'column')` → broadcast `drawing:entity-created`).
- `app/ColumnPersistenceHost.tsx` — column first-save listener.
- `bim/persistence/bim-floor-scope.ts` — `resolveBimPersistenceScope` (level scope SSoT).
- `hooks/scene/scene-write-origin.ts` — `SceneWriteOrigin` (subscription vs local-write).

Levels: `state/foundation-level-store.ts`, `systems/levels/building-foundation-level.ts` (`FoundationLevelTarget`).

## 5. ΠΡΟΤΕΙΝΟΜΕΝΗ ΡΟΗ ΕΡΕΥΝΑΣ (μέθοδος που δούλεψε)

1. **Reproduce + diagnostic logs** (console.warn, temp, eslint-disable, marker «REMOVE»):
   - Στο `appendEntityToScene` / `ColumnPersistenceHost`: log entity.id + levelId/scope τη στιγμή του create ΚΑΙ της Firestore save (επιβεβαίωσε ότι persist-άρεται και σε ΠΟΙΟ scope).
   - Στο level-switch reload: log αν το column id υπάρχει στη σκηνή που φορτώνεται για το ισόγειο.
   - Στο `auto-foundation-reconcile` / `executeGrouped`: log τι entities δημιουργεί/διαγράφει/update-άρει.
2. Εντόπισε **σε ΠΟΙΟ ακριβώς βήμα** χάνεται η κολόνα (create→persist→foundation-derive→level-switch→reload). Ίδια τακτική με §6.
3. Αφού βρεθεί η ρίζα → FULL SSoT fix (reuse υπάρχοντα modules §4) + jest + tsc (N.17: ΕΝΑΣ tsc τη φορά, έλεγξε για άλλον agent πρώτα).
4. ADR-459 changelog update (PHASE 3). ΜΗΝ commit (Giorgio).

## 6. ΣΧΕΤΙΚΟ ΠΡΟΗΓΟΥΜΕΝΟ (ίδια συνεδρία — μπορεί να αλληλεπιδρά)

Μόλις διορθώθηκε (✅browser-verified, UNCOMMITTED) το adopt-rect size bug:
- `bim/columns/column-adopt-rect.ts`, `hooks/drawing/useColumnTool.ts`, `hooks/drawing/column-completion.ts`, `ADR-398-...md` (+MEMORY).
- Η adopt κολόνα δημιουργείται πλέον με **`autoSized: false`** (ρητή διάσταση, ο auto-sizer ADR-499 δεν την αγγίζει) και **πυρήνας = περιοχή ακριβώς + σοβάς γύρω**.
- ⚠️ Αυτά είναι UNCOMMITTED στο shared working tree. Δες `memory/reference_column_adopt_autosized_lock.md`.
- **Σκέψη:** μήπως το `autoSized:false` αλληλεπιδρά με τον foundation organism (φίλτρο/reconcile); Πρώτο πράγμα να αποκλειστεί (§3-Δ).

## 7. ΜΗΝ ΚΑΝΕΙΣ

- ❌ Commit/push (Giorgio).
- ❌ Νέο foundation/persistence subsystem — υπάρχει ήδη (§4), REUSE.
- ❌ Παράλληλο tsc (N.17 — έλεγξε για άλλον agent πρώτα).
- ❌ Να θεωρήσεις δεδομένη οποιαδήποτε υπόθεση χωρίς log-μέτρηση.
