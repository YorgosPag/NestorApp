# HANDOFF — Floorplan REPLACE σε όροφο (πλήρες cleanup DB + Storage, χωρίς orphans)

> **Ημερομηνία:** 2026-06-07
> **Γλώσσα:** ΠΑΝΤΑ Ελληνικά.
> **Commit:** ΜΟΝΟ ο Giorgio (N.(-1)). ⚠️ **Working tree ΜΟΙΡΑΖΕΤΑΙ με άλλον agent** — άγγιξε μόνο σχετικά αρχεία.
> **Μοντέλο:** Opus (multi-domain: DXF viewer wizard + file/storage lifecycle + BIM persistence + ref-counting).
> **Εργαλεία:** Firestore MCP (`firestore_query`/`firestore_list_collections`/`firestore_get_document`/`firestore_update_document`/`firestore_delete_document`) + Storage MCP (`storage_list_files`/`storage_get_metadata`/`storage_delete_file`). Project: **pagonis-87766**.

---

## ΤΙ ΘΑ ΚΑΝΕΙ Ο GIORGIO (το σενάριο προς έλεγχο)
Θα χρησιμοποιήσει τον **ίδιο οδηγό «Εισαγωγή Κάτοψης (Wizard)»** και θα προσθέσει στον **ίδιο 1ο όροφο** μια **ΝΕΑ** κάτοψη DXF.

**Αναμενόμενη Revit-grade συμπεριφορά:**
1. Ο wizard **προειδοποιεί** ότι υπάρχει ήδη καταχωρημένη κάτοψη στον όροφο και ότι αν συνεχίσει **θα διαγραφούν ΤΑ ΠΑΝΤΑ** (και οι DXF οντότητες ΚΑΙ οι BIM οντότητες).
2. Αν συνεχίσει → **πλήρης αντικατάσταση**: διαγράφονται όλα τα παλιά (DB + Storage) και αντικαθίστανται με τα δεδομένα του νέου DXF, **και στο Storage και στη Βάση**.
3. **ΜΗΔΕΝ orphans** — ούτε στο Firestore, ούτε στο Storage.

## ΤΙ ΝΑ ΕΛΕΓΞΕΙΣ (μέθοδος, σταδιακά)
1. **ΠΡΙΝ** ο Giorgio κάνει replace → πάρε baseline (τα IDs παρακάτω είναι ήδη το baseline, αλλά επαλήθευσέ τα: `firestore_list_collections` + query στις BIM collections + `storage_list_files` στο floor path).
2. **Ο Giorgio κάνει το replace** (θα σου πει «έτοιμο»).
3. **ΜΕΤΑ** επαλήθευσε:
   - **Firestore:** τα ΠΑΛΙΑ ids (walls/columns/openings/slabs/boq_items + το παλιό `files` doc + ο παλιός `dxf_viewer_levels.sceneFileId`/scene) έχουν **διαγραφεί**, και υπάρχουν **ΝΕΑ** με νέο `file_*` id + νέες BIM οντότητες (αν το νέο DXF παράγει).
   - **Storage:** το παλιό `file_4cf70e99-….dxf` (+ `.processed.json` + `.thumbnail.png`) **διαγράφηκε**, υπάρχει νέο αρχείο. **ΚΑΝΕΝΑ ορφανό** στο παλιό path.
   - **Audit:** entries `deleted` για τα παλιά + `created` για τα νέα (ADR-379/380).
   - **search_documents:** το παλιό file doc αντικαταστάθηκε/διαγράφηκε.

## ⚠️ ΥΠΟΨΙΑ ΓΙΑ BUG (γιατί αυτό το task)
Υπάρχει ΗΔΗ **ορφανό δέντρο στο Storage** από προηγούμενο άδειασμα → **το cleanup-on-delete/replace ΜΑΛΛΟΝ ΔΕΝ καθαρίζει πλήρως το Storage** (ή/και τα BIM docs). Δες §«ΓΝΩΣΤΟ ORPHAN». Αν το replace αφήσει orphans → **πραγματικό bug** → ψάξε τον κώδικα του wizard + του delete/replace lifecycle (βλ. §ΠΟΥ ΝΑ ΨΑΞΕΙΣ).

---

## BASELINE — ΤΡΕΧΟΥΣΑ ΚΑΤΑΣΤΑΣΗ ΠΡΙΝ ΤΟ REPLACE (verified 2026-06-07)

**IDs ιεραρχίας:**
- Company: `comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757`
- Project: `proj_867d006a-e721-42ec-abdd-f351a80590ab`
- Building: `bldg_b139ab81-7998-4d4f-8259-55b4057b2884` («Κτήριο 1»)
- 1ος Όροφος (στόχος): `flr_ea148848-8aed-49d8-b201-f2935e883f67`
- 2ος Όροφος: `flr_b56e8ebc-8180-4f51-b028-04c95fbd793a`

**Τρέχουσα κάτοψη 1ου ορόφου (προς αντικατάσταση):**
- `files/file_4cf70e99-ef01-4c75-a756-a637e3c778bb` (originalFilename «Ισόγειο 1.dxf», entityType `floor`, entityId=1ος όροφος, domain construction / category floorplans, `linkedTo:['building:bldg_b139ab81']`, processed 1169 entities).
- Storage: `companies/comp_9c7c1a50…/projects/proj_867d006a…/entities/floor/flr_ea148848…/domains/construction/categories/floorplans/files/file_4cf70e99….dxf` (+ `.processed.json` + `.thumbnail.png`).

**dxf_viewer_levels (2 docs):**
- `lvl_9ec374bf-d873-41da-8a25-904b42fe86e3` → 1ος όροφος (`floorId=flr_ea148848`, `sceneFileId: null` — η σκηνή φορτώνει από το files doc/processed.json, **by-design** verified).
- `lvl_8099e96f-fdb2-43ac-8ec9-f0e4a20c3bc1` → default «Επίπεδο 1» (`floorId: null`, `sceneFileId: file_9788c0a0…` **DANGLING** — δεν υπάρχει στη `files` collection· γενικός καμβάς, χαμηλή προτεραιότητα — δες §ΠΑΡΑΤΗΡΗΣΕΙΣ).

**BIM οντότητες 1ου ορόφου (όλες με `floorId=flr_ea148848`, `companyId`, `projectId`, `floorplanId=file_4cf70e99`, `layerId=lvl_9ec374bf`):**
- `floorplan_walls`: `wall_6840a520-6815-4761-83e0-ddc97560d429`, `wall_80166da1-6c5c-4c83-8982-8b4d5082765e`
- `floorplan_columns`: `col_9d897e2a-9efd-4676-9f79-22259c4506b4`, `col_c874b43f-268e-4057-8516-f1b2b48a4880`
- `floorplan_openings`: `opening_71072467-3a08-4e34-9a9b-2f9cfae5886e` (πόρτα Θ.101, wallId=wall_80166da1)
- `floorplan_slabs`: `slab_2488aa9b-5226-421e-ae1c-36bb82a0f7f3`
- `boq_items`: **6** (`source: bim-auto`, `scope: floor`, `linkedFloorId=flr_ea148848`) — π.χ. `boq_bim_col_9d897e2a…`, `boq_bim_col_c874b43f…`, `boq_bim_opening_sig_file_4cf70e99…_door_900_2100_0_inward` (+ walls/slab).
- `entity_audit_trail`: 13 συνολικά (6 BIM `created`).

## ΓΝΩΣΤΟ ORPHAN (απόδειξη ατελούς cleanup — ΜΗΝ το σβήσεις χωρίς εντολή)
Storage δέντρο που ανήκει σε **διαγραμμένο** project/floor (ΔΕΝ υπάρχουν στο Firestore, ΟΧΙ `files` doc):
`companies/comp_9c7c1a50…/projects/proj_7d08ec31-71b9-4bb4-a61e-a666406a4cab/entities/floor/flr_a376666d-6cc1-4c04-97db-6904c6d3a233/domains/…`
→ Δηλαδή η διαγραφή project/floor (ή προηγούμενο «άδειασμα») **άφησε αρχεία στο Storage**. Πιθανή ίδια ρίζα με το replace-cleanup.

---

## ΠΟΥ ΝΑ ΨΑΞΕΙΣ ΤΟΝ ΚΩΔΙΚΑ (RECOGNITION πριν fix — N.0.1)
- **Wizard εισαγωγής κάτοψης** (το «Εισαγωγή Κάτοψης (Wizard)»): ψάξε `LevelPanel` / wizard onComplete / `findOrCreateLevelForFloor` (`systems/levels/level-floor-resolution.ts`, ADR-420) + `onSceneImported`→`handleFileImportWithEncoding`→`handleFileImport`.
- **File lifecycle / delete:** `files` collection writers + ref-counting (`linkedTo`) — grep `floor-floorplan`, `entities/floor`, file-mutation/delete service (π.χ. `floor-mutation-gateway`, file delete API).
- **BIM purge ανά floorplan/floor:** οι 20 BIM persistence services κλειδώνουν σε `floorId` (ADR-420 `bim/persistence/bim-floor-scope.ts`). Σε replace πρέπει να σβήνουν τα BIM της παλιάς κάτοψης. Grep για delete-by-floorId / clear-scene.
- **Storage delete:** grep `storage.delete` / `path-sanitizer` / διαγραφή `.dxf`+`.processed.json`+`.thumbnail.png`.
- **boq_items cleanup:** auto-BOQ (ADR-376 grouper, `boq_bim_*` ids) — πρέπει να σβήνονται μαζί με τα BIM source entities.
- ADRs: **ADR-420** (BIM floor-scope), **ADR-029** (search index), **ADR-376/379/380** (BOQ/audit), ADR-281 (soft-delete).

---

## ΕΚΚΡΕΜΗ ΑΠΟ ΠΡΟΗΓΟΥΜΕΝΗ ΣΥΝΕΔΡΙΑ (μην τα ξαναϋλοποιήσεις — έγιναν, pending commit)
- 🟢 **BUG #5 floor search deep-link** — DONE + ✅ browser-verified. 🔴 pending: **commit** + **production search reindex/backfill** ΟΛΩΝ των floors (νέο FLOOR routeTemplate· τα 2 test docs ενημερώθηκαν χειροκίνητα). Handoff: `HANDOFFS/2026-06-07_bug5-floor-search-deeplink.md`. (+i18n fix `common-shared.json search.entityTypes.floor` + `ENTITY_DISPLAY_ORDER` FLOOR.)
- 🟢 **Entity-creation Round 1/2** — verified (status SSoT / floor.units / levelData / flat area / storage / BIM). 🔴 pending: commit + deploy functions + reindex.
- ⚠️ Pending-ratchet: προϋπάρχον PARKING `searchableFields` mirror drift (ADR-029) — ο Giorgio αποφασίζει κατεύθυνση.

## ΠΑΡΑΤΗΡΗΣΕΙΣ (low priority, ΟΧΙ blockers)
- Dangling default-level `sceneFileId: file_9788c0a0` (δες baseline) — ίσως ζει σε ξεχωριστό V2 scene-store ή dangling. Καθάρισε/διερεύνησε μόνο αν προκύψει.
- `boq_items.createdBy: null` (auto bim-auto) — by-design.
- Opening Θ.101 `hasCodeViolations: true` (widthExceedsThicknessRatio) — σωστό validation feature.

## ΚΑΝΟΝΕΣ-ΚΛΕΙΔΙΑ
- 🌐 ΠΑΝΤΑ Ελληνικά. ⚠️ ΟΧΙ commit/push (Giorgio). ⚠️ Working tree ΚΟΙΝΟ → μόνο σχετικά αρχεία.
- Πρώτα RECOGNITION (διάβασε κώδικα + ADRs), επιβεβαίωσε baseline, μετά (αν χρειαστεί fix) Plan Mode. 100% ειλικρίνεια.
