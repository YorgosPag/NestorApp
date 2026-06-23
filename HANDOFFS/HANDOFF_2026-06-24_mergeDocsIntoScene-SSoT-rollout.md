# HANDOFF — Κεντρικοποίηση ΟΛΩΝ των snapshot→scene diff-merge loops στο `mergeDocsIntoScene` SSoT

**Ημ/νία:** 2026-06-24
**ADRs:** ADR-390 (symmetric delete/undo) · ADR-397 (baseline seed) · ADR-412 (wall/slab/roof type-wins) · ADR-421 (opening type) · ADR-408 (MEP connector projection) · ADR-440 (opening host-lookup) · ADR-402 (stair seed-before) · ADR-040 (`'remote-echo'` origin)
**Στόχος:** Revit-grade, **FULL ENTERPRISE + FULL SSoT, μηδέν διπλότυπα.** Απαντάς στον Giorgio **στα Ελληνικά.**
**⚠️ Shared working tree** — δουλεύει κι άλλος agent. **ΠΟΤΕ `git add -A`. COMMIT κάνει ΜΟΝΟ ο Giorgio.**
**⚠️ N.17:** ΕΝΑ tsc τη φορά (full tsc → OOM exit 134· δεν είναι σφάλμα κώδικα). Verify με jest.

---

## 1. ΤΙ ΘΕΛΕΙ Ο GIORGIO (διαταγή)

Κάθε per-entity persistence hook (column/wall/opening/beam/slab/mep/…) έχει **copy-pasted** το ΙΔΙΟ «Firestore snapshot → scene diff-merge» loop. **ΔΙΑΤΑΓΗ Giorgio:** κεντρικοποίησέ τα **ΟΛΑ** στον ήδη υπάρχοντα γενικό SSoT `mergeDocsIntoScene`. Είναι ~26 υλοποιήσεις. Μηδέν διπλότυπα, FULL SSoT, όπως η Revit.

**ΠΡΙΝ γράψεις κώδικα → ΠΡΑΓΜΑΤΙΚΟ SSoT audit (grep)** για να επιβεβαιώσεις ότι ο generic χωράει κάθε περίπτωση· επέκτεινε τον generic με callbacks αντί να ξαναγράφεις loop.

---

## 2. ✅ ΗΔΗ ΕΓΙΝΕ (η βάση — ΜΗΝ το ξαναφτιάξεις)

NEW γενικός SSoT: **`src/subapps/dxf-viewer/hooks/data/merge-docs-into-scene.ts`** →
`mergeDocsIntoScene<TDoc, TEntity, TComparable>(docs, levelId, lm, config, refs)` (+test `__tests__/merge-docs-into-scene.test.ts`, 12 jest).

**Συμπεριφορά (byte-equivalent με το πρώην inline loop):**
1. partition scene σε «δικά μου» (type-guard) + others
2. ανά doc: skip αν `deleted`· add αν λείπει & όχι `dirty`· keep local αν `dirty`· keep αν `isWithinGrace`· replace αν `dequal(entityComparable(entity), docComparable(doc))` διαφέρει
3. ADR-397 baseline seed: `if(!lastSavedBaseline.has(id)) set(id, docComparable(doc))`
4. ADR-390 drop scene entities με εξαφανισμένο doc εκτός `dirty|pending`
5. write μόνο αν `mutated`, origin `'remote-echo'`

**Config:** `{ isEntity, docToEntity, entityComparable, docComparable }`
**Refs:** `{ dirty, deleted, pending, isWithinGrace, lastSavedBaseline }`

**Migrated ΗΔΗ (πρότυπα — αντίγραψέ τα):**
- **column** → `hooks/data/column-persistence-helpers.ts` `mergeColumnDocsIntoScene` = thin adapter (comparable = `params`).
- **hatch** → `hooks/data/useHatchPersistence.ts` (inline subscribe καλεί τον generic· comparable = `pickHatchData(e)` ⇄ `doc.data`).

---

## 3. ⛔ SSoT AUDIT — ΠΛΗΡΗΣ ΧΑΡΤΟΓΡΑΦΗΣΗ (επαλήθευσέ την με grep, ΜΗΝ την εμπιστευτείς τυφλά)

Grep: `grep -rn "function merge\w*DocsIntoScene\|setLevelScene(.*'remote-echo'" src/subapps/dxf-viewer/hooks/data src/subapps/dxf-viewer/bim`

### TIER 1 — ΚΑΘΑΡΑ (1:1 με τον generic, comparable=`params`· εύκολο)
Inline loops σε `use*Persistence.ts` — εξάγεις σε thin adapter που καλεί τον generic (όπως hatch):
| Entity | Αρχείο | Type-guard |
|---|---|---|
| Beam | `hooks/data/useBeamPersistence.ts` (~167-237) | `isBeam` |
| SlabOpening | `hooks/data/useSlabOpeningPersistence.ts` (~154-214) | `isSlabOpening` |
| Railing | `hooks/data/useRailingPersistence.ts` | `isRailing` |
| Foundation | `hooks/data/useFoundationPersistence.ts` | `isFoundation` |
| Furniture | `hooks/data/useFurniturePersistence.ts` | `isFurniture` |
| FloorplanSymbol | `hooks/data/useFloorplanSymbolPersistence.ts` | `isFloorplanSymbol` |
| ThermalSpace | `hooks/data/useThermalSpacePersistence.ts` | `isThermalSpaceEntity` |
| SpaceSeparator | `hooks/data/useSpaceSeparatorPersistence.ts` | `isSpaceSeparatorEntity` |
| WallCovering | `hooks/data/useWallCoveringPersistence.ts` | `isWallCoveringEntity` |

### TIER 2 — TYPE-RESOLUTION (dual-baseline: params + typeLink· χρειάζεται ΕΠΕΚΤΑΣΗ generic)
| Entity | Αρχείο | Απόκλιση |
|---|---|---|
| Wall | `hooks/data/wall-persistence-helpers.ts` `mergeWallDocsIntoScene` (~280-356) | ADR-412 «type always wins» — comparable = **effective (type-resolved) params** via `wallEntityDiffersFromDoc`· **2 baselines** (params + typeLink) |
| Slab | `hooks/data/useSlabPersistence.ts` (~162-229) | `slabEntityDiffersFromDoc`· dual baseline |
| Roof | `hooks/data/useRoofPersistence.ts` (~147-221) | `roofEntityDiffersFromDoc`· dual baseline (params + typeLink) |
| Opening | `bim/walls/opening-doc-hydration.ts` `mergeOpeningDocsIntoScene` (~103-191) | ADR-421 type + **ADR-440 HOST-WALL LOOKUP**: `docToEntity` επιστρέφει `null` αν λείπει ο host wall → skip + retry επόμενο snapshot· dual baseline (params + link) |

### TIER 3 — MEP CONNECTOR PROJECTION (ADR-408· χρειάζεται ΕΠΕΚΤΑΣΗ generic)
`docToEntity` πρέπει να δει το **existing** entity (project live `systemIds` πάνω στο fresh doc-entity για να μη γίνεται ping-pong). Comparable μετά την projection.
| Entity | Αρχείο |
|---|---|
| MepFixture | `hooks/data/useMepFixturePersistence.ts` (~140-217, `projectConnectorSystemIds`) |
| MepBoiler | `hooks/data/useMepBoilerPersistence.ts` (~146-222) |
| MepRadiator | `hooks/data/useMepRadiatorPersistence.ts` |
| MepWaterHeater | `hooks/data/useMepWaterHeaterPersistence.ts` |
| MepUnderfloor | `hooks/data/useMepUnderfloorPersistence.ts` |
| MepManifold | `hooks/data/useMepManifoldPersistence.ts` |
| ElectricalPanel | `hooks/data/useElectricalPanelPersistence.ts` |

### TIER 4 — EDGE CASES (ειδική προσοχή)
| Entity | Αρχείο | Απόκλιση |
|---|---|---|
| MepSegment | `hooks/data/useMepSegmentPersistence.ts` (~149-223) | **Three-way orphan guard**: drop ΜΟΝΟ αν `lastSavedParams.has(id)` (ήταν persisted) **ΚΑΙ** doc εξαφανίστηκε — γιατί segments από DXF `scene.json` δεν έχουν ακόμα doc (αλλιώς σωλήνες εξαφανίζονται σε hard refresh). |
| Stair | `bim/.../stair-snapshot-merge.ts` `mergeStairSnapshot` (~50-112) + `use-stair-persistence.ts` | Επιστρέφει `{entities, mutated}` (caller owns `setLevelScene`)· compare **params ΚΑΙ editingBy**· ADR-402 seed baseline **ΠΡΙΝ** το existing check. **Ίσως μείνει semi-special** (αξιολόγησε). |

---

## 4. ΣΧΕΔΙΑΣΜΟΣ ΕΠΕΚΤΑΣΗΣ ΤΟΥ GENERIC (FULL SSoT — η ουσία της δουλειάς)

Ο generic ΠΡΕΠΕΙ να μεγαλώσει με **optional callbacks** ώστε να απορροφήσει ΟΛΕΣ τις αποκλίσεις, ΧΩΡΙΣ κανείς consumer να ξαναγράφει loop. Πρότεινε & υλοποίησε (Revit-grade):
- **Dual-baseline (Tier 2):** `seedBaselines?(doc)` ή δεύτερο optional baseline map + `docSecondaryComparable?`. Ή κάνε το `entityComparable`/`docComparable` να επιστρέφουν σύνθετο object {params, typeLink} → ένα dequal καλύπτει και τα δύο (προτιμότερο — single comparable, μηδέν δεύτερος μηχανισμός). **Audit:** δες πώς το wall/opening helper διαβάζει type-resolved params (reuse τους υπάρχοντες `wallEntityDiffersFromDoc`/`openingEntityDiffersFromDoc`/`slabEntityDiffersFromDoc`/`roofEntityDiffersFromDoc` — ΜΗΝ ξαναγράψεις type-resolution).
- **docToEntity με existing (Tier 3 MEP):** άλλαξε signature σε `docToEntity(doc, existing?)` ώστε το MEP να κάνει `projectConnectorSystemIds`. Reuse τον υπάρχοντα `projectConnectorSystemIds` (SSoT, ΜΗΝ τον ξαναγράψεις).
- **docToEntity → null = skip (Tier 2 Opening / ADR-440):** επίτρεψε `docToEntity` να γυρίσει `null` → ο generic κάνει skip (keep existing αν υπάρχει, αλλιώς μην προσθέσεις).
- **Orphan-drop override (Tier 4 MepSegment):** optional `shouldDropOrphan?(id, refs)` (default = `!dirty && !pending`)· το MepSegment προσθέτει `&& lastSavedBaseline.has(id)`.
- **Stair:** αξιολόγησε αν αξίζει· αν ναι, optional `seedBaselineBeforeExisting` flag + δεύτερο comparable (editingBy). Αλλιώς άφησέ το semi-special με σχόλιο γιατί.

**ΑΡΧΗ:** κάθε callback έχει sensible default ώστε τα Tier-1 να μένουν τετριμμένα. Κάθε επέκταση = optional, μηδέν breakage στα ήδη migrated (column/hatch).

---

## 5. ΣΕΙΡΑ ΥΛΟΠΟΙΗΣΗΣ (incremental, jest GREEN σε κάθε βήμα)

1. **Tier 1** (9 entities) — πιο ασφαλές, χτίζει εμπιστοσύνη. Κάθε ένα: εξάγεις adapter `mergeXDocsIntoScene` (mirror column) ή inline call (mirror hatch) → καλεί generic.
2. **Tier 3 MEP** (7) — αφού προστεθεί το `docToEntity(doc, existing)`.
3. **Tier 2 type-resolution** (4: wall/slab/roof/opening) — αφού λυθεί το dual-baseline + null-skip.
4. **Tier 4** (mepSegment, stair) — τελευταία.
5. Σε ΚΑΘΕ migration: **jest GREEN** του αντίστοιχου persistence test (αν υπάρχει) + του `merge-docs-into-scene.test.ts`. Γράψε νέο test αν λείπει.

**ΜΗΝ** αγγίξεις 8+ hooks σε ένα commit — ο Giorgio committαρει σταδιακά. Δούλεψε ανά Tier/entity.

---

## 6. ΚΑΝΟΝΕΣ

- **ΟΧΙ commit / ΟΧΙ push / ΟΧΙ `git add -A`** — ο Giorgio committαρει (shared tree).
- **FULL SSoT — grep audit ΠΡΩΤΑ.** Reuse υπάρχοντες type-resolution helpers + `projectConnectorSystemIds`. Μηδέν νέο διπλότυπο. Αν βρεις άλλα προϋπάρχοντα διπλότυπα → κεντρικοποίησέ τα (διαταγή Giorgio).
- Jest GREEN πριν παραδώσεις· tsc μόνο αν χρειαστεί (N.17, OOM-aware, ΕΝΑ τη φορά).
- Revit-grade, FULL ENTERPRISE. Απαντάς **στα Ελληνικά**.
- **ADR-driven (N.0.1):** ενημέρωσε ADR-390 changelog (νέο §: «mergeDocsIntoScene SSoT rollout») + auto-memory.
- Ο Giorgio κάνει σκληρό SSoT audit («κεντρικοποιημένο; διπλότυπο; θα το έκανε έτσι η Google;») — να είσαι έτοιμος, 100% ειλικρίνεια.

---

## 7. ⚠️ UNCOMMITTED ΤΩΡΑ (προηγούμενη συνεδρία — ΜΗΝ τα χαλάσεις, ο Giorgio θα τα committαρει)

Δουλειά «hatch undo/redo persistence + dual-authority fix + 3 dedup» — UNCOMMITTED, 120 jest GREEN:
- **NEW:** `core/commands/entity-commands/HatchLifecycleSignalCommand.ts` (+test)· `hooks/data/merge-docs-into-scene.ts` (+test).
- **Lifecycle SSoT:** `systems/events/bim-entity-lifecycle-events.ts` (NEW `emitBimEntityRestoreRequested` = ο 3ος αδελφός create/delete/restore· +case 'hatch')· `systems/events/drawing-event-map-bim.ts` (`bim:entity-restore-requested` entityType = **canonical SSoT** 25 τύπων).
- **Restore refactor (4 callers → SSoT):** `DeleteEntityCommand.ts` (+ ΕΝΑ `as const` tuple → Set+union)· `MergeColumnsCommand.ts`· `bim/transforms/bim-clone-persistence.ts` (+ `broadcastBimCloneDeleted` delegate → `emitBimEntityDeleteRequested`, fix floor-finish gap)· `hooks/data/useBimEntityRestoredPersistEffect.ts` (`BimRestoreEntityType` = **derived** από event-map).
- **Hatch lifecycle:** `useHatchPersistence.ts` (restore effect wire + migrate σε `mergeDocsIntoScene`)· `bim/hatch/hatch-completion.ts` (+signal command)· `hooks/canvas/smart-delete-bim-events.ts` (+hatch).
- **Dual-authority fix:** `systems/levels/scene-bim-load-policy.ts` (rename `isBimOrStairEntity` → **`isPerEntityPersistedEntity`** + `isHatchEntity`· +test). → Το hatch πετιέται από scene.json στο load → `floorplan_hatches` = single SSoT → **μηδέν phantom**.
- **column migrate:** `hooks/data/column-persistence-helpers.ts` (delegate → generic).
- **ADR-507 changelog** ενημερωμένο.
- ⚠️ **CHECK 6B/6D:** στο commit ο Giorgio να stage-άρει ADR-040 + ADR-390 + ADR-507 (DeleteEntityCommand/canvas).

🔴 **ΕΚΚΡΕΜΕΙ browser-verify (Giorgio):** σβήσε collection `floorplan_hatches` → hard refresh → η γραμμοσκίαση πρέπει να **ΦΥΓΕΙ** (όχι phantom)· + undo/redo/delete DB-sync μέσω firestore MCP.

---

## 8. ΣΥΝΟΨΗ ΓΙΑ ΓΡΗΓΟΡΟ ΞΕΚΙΝΗΜΑ

«Υπάρχει `mergeDocsIntoScene` SSoT (column+hatch το χρησιμοποιούν ήδη). Μετέφερε ΟΛΑ τα υπόλοιπα ~24 persistence merge-loops εκεί, ανά Tier (1=καθαρά, 2=type-resolution dual-baseline, 3=MEP projection, 4=edge). Επέκτεινε τον generic με optional callbacks (docToEntity(doc,existing), null-skip, dual-comparable, shouldDropOrphan) reusing υπάρχοντες helpers. SSoT audit ΠΡΩΤΑ, μηδέν διπλότυπα, jest GREEN, ΟΧΙ commit.»
