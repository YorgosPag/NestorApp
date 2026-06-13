# HANDOFF — Έλεγχος αυτόματης δημιουργίας BIM σε άδεια βάση (Session 2)

**Ημερομηνία:** 2026-06-13
**Branch:** `main` | **Μοντέλο:** Opus
**⚠️ Το working tree ΜΟΙΡΑΖΕΤΑΙ με άλλον agent** → `git add` ΜΟΝΟ δικά μου αρχεία. **COMMIT τον κάνει ο Giorgio, ΟΧΙ ο agent (N.-1).**
**Στόχος ποιότητας:** FULL ENTERPRISE + FULL SSOT, όπως Revit (Giorgio).

---

## 🎯 ΤΙ ΚΑΝΟΥΜΕ

Ο Giorgio **άδειασε τη βάση** (έμειναν μόνο config collections). Ελέγχουμε **βήμα-βήμα** τι παράγει το pipeline αυτόματης δημιουργίας οντοτήτων σε καθαρή κατάσταση: σωστά **enterprise IDs** (N.6), **`companyId`** tenant-scope, **cascade/bindings**. Ο έλεγχος είναι **read-only μέσω Firestore MCP** μετά από κάθε ενέργεια που κάνει ο Giorgio στο UI.

**Εργαλεία ελέγχου (Firestore MCP, deferred):** φόρτωσέ τα με `ToolSearch query "select:mcp__firestore__firestore_list_collections,mcp__firestore__firestore_count,mcp__firestore__firestore_query,mcp__firestore__firestore_get_document"`.

---

## ✅ ΒΗΜΑΤΑ ΚΑΤΑΧΩΡΗΣΗΣ ΠΟΥ ΕΓΙΝΑΝ (με τη σειρά) — ΟΛΑ VERIFIED ENTERPRISE-GRADE

**Baseline (άδεια βάση):** 9 config collections — `users`, `user_preferences`, `user_2fa_settings`, `user_notification_settings`, `config`, `settings`, `system`, `accounting_settings`, `accounting_invoice_counters`. Καμία BIM collection.

| # | Ενέργεια Giorgio (UI) | Νέες collections | Verify |
|---|---|---|---|
| 1 | Δημιουργία **επαφής** «ALFA ΚΑΤΑΣΚΕΥΑΣΤΙΚΗ Α.Ε.» | `contacts` (`cont_`) + `entity_audit_trail` (`eaud_`, `source:cdc`) + `search_documents` (deterministic id `contact_<id>`) | ✅ `cont_` enterprise id, `companyId comp_9c7c1a50…`, audit diff 6 πεδίων, idempotent search upsert |
| 2 | Δημιουργία **έργου** «ΕΡΓΟ 1» | `projects` (`proj_`) + `counters/projects` (sequential) + `companies` (`comp_` = tenant doc) | ✅ `projectCode PRJ-001` από atomic counter· `linkedCompanyId → cont_…`· tenant company «ΠΑΓΩΝΗΣ Ενεργειακή Κατασκευαστική Α.Ε.» |
| 3 | Δημιουργία **κτιρίου** «Κτήριο 1» | `buildings` (`bldg_`) | ✅ `projectId → proj_…`, `category residential`, audit+search cascade |
| 4 | Δημιουργία **3 ορόφων** (Ισόγειο/1ος/2ος) | `floors` (`flr_` ×3) | ✅ **cascade ADR-450/451**: elevation 0→3→6 m (βήμα = height 3)· `buildingId`+`projectId` |
| 5 | **Εισαγωγή Κάτοψης (Wizard)** — DXF Ισογείου | `files` (`file_`) + `dxf_viewer_levels` (`lvl_` ×2) | ✅ DXF parse 166 entities→scene.json, Windows-1253, thumbnail· level «Ισόγειο» δένει `floorId → flr_4e7868ba…` + `sceneFileId` |
| 6 | **Τοποθέτηση 4 οδηγών** (κάναβος) | `floorplan_grid_guides` (`grd_`, single-doc/όροφο) | ⚠️ **ΠΡΩΤΗ φορά χάθηκαν** (count 0) → **2η φορά persistάρησαν** (`grd_e11944a1…`, 4 guides, scope `flr_4e7868ba…`)· hard-refresh → επανήλθαν ✅ |

**Πλήρης ιεραρχία (όλη συνεπής, scoped κάτω από `comp_9c7c1a50…`):**
```
contact (ALFA) ─linkedCompanyId─► project (PRJ-001) ─► building (Κτήριο 1) ─► 3 floors (0/3/6m)
                                                                                  └─► DXF level «Ισόγειο» + 4 guides
```

---

## 🔧 ΔΥΟ FIXES ΠΟΥ ΕΓΙΝΑΝ ΣΤΗ SESSION — **UNCOMMITTED** (commit ο Giorgio)

### FIX 1 — Grid-guides persistence flush-on-ready (ADR-441)
**Bug:** Το βήμα 6 αποκάλυψε ότι το ΠΡΩΤΟ batch οδηγών χανόταν στο reload. Root cause (`useGridGuidePersistence.ts`):
- `floorplanId` = `levelManager.fileRecordId` λύνεται **αργά** (αφού δέσει το DXF), ενώ το `floorId` νωρίς.
- (Α) ο debounced `doSave` έκανε silent `return` όταν `serviceRef` ήταν `null` → οι οδηγοί στον κάμβο αλλά **όχι στη βάση**.
- (Β) το subscribe effect εξαρτιόταν μόνο από `scopeKey` → δεν ξανατρέχει όταν αργήσει το `floorplanId` → ούτε subscription/save.

**Fix:** NEW `serviceReady` state (στα deps του subscribe effect → re-run όταν δέσει το scope) + flush-on-ready (capture pending store guides ΠΡΙΝ το per-floor reset· αν remote κενό → `restoreSnapshotsToStore` once → debounced save persistάρει· `pendingSettled` guard· remote-wins). Boy-Scout: εξαγωγή `restoreSnapshotsToStore` SSoT (DRY με `hydrate`).
**Αρχεία (δικά μου):** `src/subapps/dxf-viewer/hooks/data/useGridGuidePersistence.ts` + NEW `__tests__/useGridGuidePersistence.test.tsx` (**4 jest PASS**).
**ΕΚΤΟΣ ADR-040.** IDE clean.
🔴 **Browser-verify:** βάλε οδηγούς ΑΜΕΣΩΣ με το άνοιγμα κάτοψης (πριν δέσει το scene) → hard-refresh → πρέπει να επιβιώνουν.

### FIX 2 — Company doc audit-field parity (ADR-210)
**Bug:** Το materialized `companies/{comp_*}` doc είχε μόνο `createdBy`/`createdAt`, ενώ ΟΛΑ τα entity docs (μέσω `buildCommonFields` στο `entity-creation.service`) φέρουν `_lastModifiedBy`/`_lastModifiedByName`/`_lastModifiedAt`.
**Fix (`company-document.service.ts`):** NEW `resolveActorDisplayName(db, uid)` helper· `ensureCompanyDocument` stampάρει τα 3 fields + `performedByName: actorName` στο audit· DRY (μία resolution τροφοδοτεί name-fallback + audit stamp)· `repairCompanyDocument` stampάρει επίσης. `CompanyDocument` type +3 optional fields· `getCompanyDocument` τα surfaceάρει.
**Αρχεία (δικά μου):** `src/services/company-document.service.ts` + `src/types/company.ts`. IDE clean.
**ΣΗΜ:** η **lazy materialization** (phantom→real on-demand) είναι **by-design** (ADR-210 Phase 3)· eager provision-at-registration = **ADR-439 Phase 3 (provision-tenant), DEFERRED** — product-απόφαση Giorgio, ΜΗΝ το αλλάξεις μονομερώς.
🔴 **Browser-verify:** νέος tenant → `companies` doc φέρει `_lastModifiedBy`/`_lastModifiedByName`.

**Τεκμηρίωση ενημερωμένη (N.15):** ADR-441 changelog, ADR-210 changelog, `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`.

---

## ▶️ ΕΠΟΜΕΝΟ ΒΗΜΑ ΣΤΗ ΝΕΑ ΣΥΝΕΔΡΙΑ — ΕΛΕΓΧΟΙ ΔΗΜΙΟΥΡΓΙΑΣ BIM ΜΕ ΒΑΣΗ ΤΟΥΣ ΟΔΗΓΟΥΣ

Οι οδηγοί υπάρχουν τώρα (4, persisted). Ο Giorgio θα τρέξει τις εντολές **αυτόματης δημιουργίας BIM «από κάναβο»** (ADR-441 GRID-FIRST). Για **κάθε** εντολή: query την αντίστοιχη collection και verify **enterprise ID + `companyId` + `guideBindings` (associative hosting) + scope `floorId`/`projectId`**.

| Εντολή «από κάναβο» | Collection | Prefix | Τι να ελέγξεις |
|---|---|---|---|
| Εσχάρα θεμελίωσης / Πεδιλοδοκοί | `floorplan_foundations` | `fnd_` | strips ανά segment, `guideBindings`, justification, junction-miter γωνίες |
| Συνδετήριες δοκοί | `floorplan_foundations` | `fnd_` | `kind:tie-beam`, elevation −500 (ΠΑΝΩ από strip −1000), corner-miter |
| Κολώνες από κάναβο | `floorplan_columns` | `col_`? | μία ανά τομή X×Y, `center-x`/`center-y` bindings, foundation-base continuity |
| Τοίχοι από κάναβο | `floorplan_walls` | `wall_`? | ανά segment, σταματούν στις ΠΑΡΕΙΕΣ κολωνών (face-trim), `guideBindings` |
| Δοκάρια από κάναβο | `floorplan_beams` | `beam_`? | ανά segment, frame-into κολωνών, `topElevation`=storey ceiling |
| Πλάκες/Εδαφόπλακα/Δάπεδα | `floorplan_slabs` | `slab_`? | εδαφόπλακα ground @FFL· δάπεδα ανά φάτνωμα clipped· 4-axis bindings |

**Κρίσιμο (cascade να επιβεβαιωθεί ζωντανά):** κολώνα→δοκάρι auto-attach· τοίχος top/base attach· storey-aware elevations· floor-elevation cascade· follow-on-move (σύρε άξονα→hosted entities ακολουθούν + persist μετά reload).

**Σχετικά ADR (committed):** ADR-441 (grid-first), ADR-450/451 (floor cascade + vertical setup), ADR-448 (storey-aware), ADR-449 (σοβάς), ADR-452 (cut-plane). Δες `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + `MEMORY.md` για τις pending λεπτομέρειες.

---

## ⚠️ ΚΑΝΟΝΕΣ (CLAUDE.md)
- **Γλώσσα:** πάντα Ελληνικά.
- **ΟΧΙ commit/push** χωρίς ρητή εντολή Giorgio (N.-1)· **ΟΧΙ `--no-verify`** (N.-1.1).
- `git add` **ΜΟΝΟ δικά μου** αρχεία (shared tree).
- **ΕΝΑ `tsc` τη φορά** — έλεγξε για ενεργό tsc άλλου agent πριν τρέξεις (N.17)· προτίμα IDE diagnostics (`mcp__ide__getDiagnostics`) για 1-2 αρχεία.
- Μετά από υλοποίηση: update `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (μόνο τι εκκρεμεί) + ADR changelog (N.15).
- Enterprise: setDoc+enterprise-id (N.6), όχι `any`/`as any` (N.2), όχι inline styles (N.3), 500/40 γραμμές (N.7.1).
