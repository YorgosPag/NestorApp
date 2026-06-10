# HANDOFF — ADR-436 Θεμελίωση / Foundation Discipline → Slice 1-persist (Firestore)

**Date:** 2026-06-10 · **Model:** Opus · **Από:** προηγούμενη συνεδρία (Slice 1b selection+grips DONE)

---

## 0. Γλώσσα & βασικοί κανόνες (CLAUDE.md) — ΔΙΑΒΑΣΕ ΠΡΩΤΑ

- **Απαντάς ΠΑΝΤΑ στα Ελληνικά** (LANGUAGE RULE, overrides everything).
- **ΠΟΤΕ git commit/push** χωρίς ρητή εντολή Giorgio (N.(-1)). **Ο Giorgio κάνει το commit, ΟΧΙ εσύ.**
- **Shared working tree** με άλλον agent → `git add` **ΜΟΝΟ τα δικά σου** αρχεία, ΠΟΤΕ `git add -A`.
- **ΠΟΤΕ `--no-verify`** (N.(-1.1)). Αν κολλήσει pre-commit hook → ανέφερε, μην το παρακάμψεις.
- **N.17:** ΕΝΑ `tsc` τη φορά — έλεγξε ότι δεν τρέχει άλλος ΠΡΙΝ ξεκινήσεις (`Get-WmiObject Win32_Process` filter tsc). Σειριακά, ΠΟΤΕ παράλληλα.
- **ΜΗΝ** αγγίζεις `adr-index.md` (shared tree).
- **N.6 ENTERPRISE IDs:** ΚΑΘΕ Firestore doc με `setDoc()` + ID από `enterprise-id.service`. **ΑΠΑΓΟΡΕΥΕΤΑΙ** `addDoc()`/`.add()`/`.collection().doc()`/`crypto.randomUUID()` (CHECK 3.6 pre-commit BLOCK). Ο `fnd` generator ΥΠΑΡΧΕΙ ΗΔΗ (`generateFoundationId()`).
- **N.11 i18n:** μηδέν hardcoded strings σε `.ts/.tsx` (μόνο locale JSONs). Το Slice 1-persist πιθανότατα ΔΕΝ χρειάζεται νέα UI strings.
- **N.14 model:** **Opus** (cross-cutting persistence + security rules + tests).
- Στόχος (Giorgio, ρητό): **«όπως η Revit / οι μεγάλοι παίκτες, FULL ENTERPRISE + FULL SSOT».** Μηδέν `any`/`as any`/`@ts-ignore`. Search πριν γράψεις· πάρε εσύ τις enterprise/Revit αποφάσεις + ζήτα μόνο έγκριση plan.

---

## 1. Το ΖΗΤΟΥΜΕΝΟ του Slice 1-persist

Σήμερα ο `FoundationPersistenceHost` κάνει **ΜΟΝΟ 3D-store push** (`setFoundations`) — οι θεμελιώσεις **ΔΕΝ σώζονται στο Firestore**, άρα **χάνονται σε κάθε reload / cross-session**. Έργο σου: **πλήρης Firestore persistence** (subscribe / auto-save / delete / entity-audit / collection / **security rules + indexes deploy**), Revit-grade, FULL ENTERPRISE + FULL SSOT.

**ΚΑΘΑΡΟΣ MIRROR = Η ΚΟΛΩΝΑ** (`column`) — structural, point-based, **ΧΩΡΙΣ** connectors/BOQ/buildingId (σε αντίθεση με το MEP water-heater που έχει MEP extras). Ο ίδιος ο `FoundationPersistenceHost` το λέει ρητά: «mirror του `useColumnPersistence` / `ColumnPersistenceHost`». **Διάβασε ΟΛΟ το column persistence πριν γράψεις.**

---

## 2. Τι ΥΠΑΡΧΕΙ ήδη (ΜΗΝ το ξαναγράψεις)

- **Slice 0** (data model): `foundation-types.ts` (discriminated union pad/strip/tie-beam· `FoundationParams`/`FoundationGeometry`/`FoundationEntity`), `foundation.schemas.ts` (Zod), `foundation.factory.ts` (`createFoundation`).
- **Slice 1** (pad full 2Δ+3Δ): geometry/validator/completion/renderer/3D converter/tool/ribbon/`UpdateFoundationParamsCommand`. **`FoundationPersistenceHost.tsx` = ΜΟΝΟ 3D push.**
- **Slice 1b** (selection + grips): spatial-index hit-test fix + parametric grips (rotation/width/length + live ghost + 6-click + Alt-move). 101/101 jest.
- **Enterprise ID:** `fnd` prefix + `generateFoundationId()` **ΥΠΑΡΧΟΥΝ** (`enterprise-id-prefixes.ts:249`, `enterprise-id-convenience.ts:277`).
- **EventBus event:** `bim:foundation-params-updated` ΥΠΑΡΧΕΙ (drawing-event-map· πρόσθεσέ το αν λείπει `bim:foundation-delete-requested`).

**ΔΕΝ υπάρχουν (όλα τα δημιουργείς):** foundation-firestore-service, useFoundationPersistence, foundation-audit-client, `COLLECTIONS.FLOORPLAN_FOUNDATIONS`, rules block, indexes, `FOUNDATION_TRACKED_FIELDS`, rules-test.

---

## 3. ΤΟ ΕΡΓΟ ΣΟΥ — checklist (mirror ΚΟΛΩΝΑ 1:1)

**Πρότυπα (διάβασέ τα ΟΛΑ):**
- `bim/columns/column-firestore-service.ts`
- `hooks/data/useColumnPersistence.ts`
- `app/ColumnPersistenceHost.tsx`
- `bim/columns/column-audit-client.ts`
- `firestore.rules` → `match /floorplan_columns/{columnId}` (γρ. ~3766)
- `firestore.indexes.json` → `floorplan_columns` composite indexes
- `src/config/firestore-collections.ts` → `FLOORPLAN_COLUMNS` + `FLOOR_SCOPED_BIM_COLLECTIONS`
- `src/config/audit-tracked-fields.ts` → `COLUMN_TRACKED_FIELDS` + `getTrackedFieldsForEntityAuditType()`

### NEW files (4)
| # | NEW αρχείο | MIRROR | Foundation delta |
|---|---|---|---|
| 1 | `bim/foundations/foundation-firestore-service.ts` | `column-firestore-service.ts` | collection `COLLECTIONS.FLOORPLAN_FOUNDATIONS`/`'floorplan_foundations'`· `generateFoundationId()`· `FoundationDoc` (`kind: FoundationKind`, `params: FoundationParams`)· `entityToSaveInput` strips `geometry` (re-derive από `computeFoundationGeometry`)· **ΟΧΙ buildingId/connectors** |
| 2 | `hooks/data/useFoundationPersistence.ts` | `useColumnPersistence.ts` | subscribe + diff-merge (dequal) + 500ms auto-save debounce + first-save στο `drawing:entity-created` (`payload.tool==='foundation'`) + delete στο `bim:foundation-delete-requested` + `recordFoundationChange`· **ΟΧΙ BOQ bridge** (Slice 4)· `docToEntity` re-derive geometry |
| 3 | `bim/foundations/foundation-audit-client.ts` | `column-audit-client.ts` | `entityType:'foundation'`· import `FOUNDATION_TRACKED_FIELDS` (MODIFY 2) |
| 4 | `tests/firestore-rules/suites/floorplan-foundations.rules.test.ts` | column/BIM rules-test pattern | read owner/deny-other-tenant· create valid/missing-field-deny/wrong-companyId-deny· update immutable-companyId/createdAt-deny· delete owner/deny-other· super-admin |

### MODIFY files (7)
| # | Αρχείο | Αλλαγή |
|---|---|---|
| 1 | `src/config/firestore-collections.ts` | `FLOORPLAN_FOUNDATIONS: env || 'floorplan_foundations'` + append στο `FLOOR_SCOPED_BIM_COLLECTIONS` |
| 2 | `src/config/audit-tracked-fields.ts` | `FOUNDATION_TRACKED_FIELDS` (kind/layerId/topElevationMm/thicknessMm/width/length/rotation/anchor/profile/material/storeyId — pad union fields) + `case 'foundation'` στο `getTrackedFieldsForEntityAuditType()` |
| 3 | `firestore.rules` | ΝΕΟ `match /floorplan_foundations/{foundationId}` (mirror columns ΑΚΡΙΒΩΣ· create allowlist `hasAll(['companyId','projectId','floorplanId','kind','params'])`· immutable companyId/projectId/floorplanId/createdBy/createdAt· delete owner/admin). **CHECK 3.16 ZERO-TOL on touch** |
| 4 | `firestore.indexes.json` | 4 composite indexes (mirror columns): `companyId+projectId+floorplanId`· `projectId+floorplanId`· `companyId+projectId+floorId` (ADR-420 storey)· `projectId+floorId` |
| 5 | `app/FoundationPersistenceHost.tsx` | επέκταση από 3D-only → full host: props `primarySelectedId/levelManager/projectId/floorplanId/floorId`· call `useFoundationPersistence({...})`· **ΚΡΑΤΑ** το υπάρχον `setFoundations` 3D effect |
| 6 | `app/DxfViewerTopBar.tsx` | `<FoundationPersistenceHost currentScene=.../>` → full props (mirror `<ColumnPersistenceHost>` σειρά). **ΟΧΙ buildingId** |
| 7 | `tests/firestore-rules/_registry/coverage-manifest.ts` | entry `'floorplan_foundations'` (CHECK 3.16 manifest) |

---

## 4. ΚΡΙΣΙΜΑ gotchas (pre-commit BLOCK checks)

- **CHECK 3.16 (ADR-298) ZERO-TOL on touch:** μόλις αγγίξεις `firestore.rules` → ΥΠΟΧΡΕΩΤΙΚΟ rules-test για το νέο collection + manifest entry. Αλλιώς commit blocked.
- **CHECK 3.17 entity-audit RATCHET:** ο writer (firestore-service/hook) ΠΡΕΠΕΙ να καλεί `EntityAuditService.recordChange()` (μέσω του audit-client). Αλλιώς baseline regression.
- **CHECK 3.10 firestore companyId RATCHET:** κάθε `query()` με `where()` ΠΡΕΠΕΙ να φέρει companyId scope. Το `firestoreQueryService` το βάζει αυτόματα (DEFAULT_TENANT_CONFIG companyId) — χρησιμοποίησέ το, μην γράψεις raw `query()`.
- **N.6 / CHECK 3.6:** `setDoc()` + `generateFoundationId()`. ΠΟΤΕ `addDoc`.
- **ADR-420 storey-scoping:** `buildBimScopeConstraints`/`bimScopeWriteFields` (projectId + floorId||floorplanId). Mirror column.
- **ΟΧΙ BOQ/buildingId/connectors:** αυτά είναι MEP/Slice-4. Η θεμελίωση είναι structural — κράτα το καθαρό σαν την κολώνα.
- **Deploy:** ο **Giorgio** κάνει το `firebase deploy --only firestore:rules,firestore:indexes` (ΟΧΙ εσύ· κοστίζει + production). Εσύ ετοιμάζεις rules+indexes+tests.

---

## 5. Verification στο τέλος
- `npx jest foundation` + νέο rules-test πράσινα (rules-test τρέχει με `jest.config.firestore-rules.js` / emulator — δες πώς τρέχουν τα υπάρχοντα BIM rules-tests).
- `tsc --noEmit` (N.17 single) — 0 νέα errors στα δικά σου.
- **Browser (Giorgio):** σχεδίασε πέδιλο → reload → **το πέδιλο παραμένει** (Firestore round-trip)· edit grip → auto-save → reload → αλλαγή διατηρείται· delete → reload → χάθηκε.
- **Giorgio:** browser-verify + **commit** (git add ΜΟΝΟ δικά σου) + **deploy rules/indexes**.

---

## 6. N.15 (μετά την υλοποίηση, ίδιο commit)
ADR-436 changelog + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (γραμμή ADR-436· σήμανε Slice 1-persist) + `MEMORY.md`/`project_adr436_foundation.md`. **ΟΧΙ adr-index** (shared tree).

## 7. Memory pointers
- `~/.claude/projects/C--Nestor-Pagonis/memory/project_adr436_foundation.md` (πλήρες context Slice 0+1+1b + roadmap).
- `~/.claude/projects/C--Nestor-Pagonis/memory/reference_2d_dxf_pipeline_bim_entity.md` (6 render + 3 selection σημεία ανά νέο BIM entity).
- ΜΕΤΑ το Slice 1-persist → roadmap: **Slice 2** (strip/tie-beam line tools)· Slice 1c (live ghost/stepped/sloped/base-attach)· Slice 3 (slab foundation polish)· Slice 4 (BOQ/ATOE + IFC export).
