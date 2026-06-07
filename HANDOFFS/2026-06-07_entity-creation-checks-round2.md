# HANDOFF — Entity Creation Checks ROUND 2 (καθαρή βάση, σταδιακή επαλήθευση)

> **Ημερομηνία:** 2026-06-07
> **Τι κάνουμε:** Ο Giorgio ΞΑΝΑ-άδειασε βάση + Storage. Επαναλαμβάνουμε **σταδιακό έλεγχο** ότι ΚΑΘΕ δημιουργία οντότητας γράφει σωστά (Firestore + Storage), τώρα ΜΕ τις διορθώσεις του Round 1 ενεργές.
> **Working tree:** ⚠️ ΜΟΙΡΑΖΕΤΑΙ με άλλον agent — μόνο σχετικά αρχεία. **Commit κάνει ΜΟΝΟ ο Giorgio** (N.(-1)).
> **Γλώσσα:** Πάντα Ελληνικά.

---

## 0. ΠΡΩΤΗ ΕΝΕΡΓΕΙΑ ΤΗΣ ΝΕΑΣ ΣΥΝΕΔΡΙΑΣ
**ΠΡΙΝ ξεκινήσει ο Giorgio οποιοδήποτε βήμα**, ο agent βλέπει την **τρέχουσα κατάσταση βάσης + Storage** ώστε να ξέρει το baseline (τι υπάρχει ήδη) και να αναγνωρίζει τι γράφτηκε μετά από κάθε ενέργεια:
1. `firestore_list_collections` → καταγραφή ποιες collections υπάρχουν + counts.
2. `storage_list_files` (root) → καταγραφή αρχείων.
Ανάφερε το baseline στον Giorgio σε σύντομο πίνακα και περίμενε να κάνει το 1ο βήμα.

## 1. ΣΥΛΛΟΓΕΣ ΠΟΥ ΔΕΝ ΑΔΕΙΑΣΤΗΚΑΝ (σταθερές — αγνόησέ τες ως «προϋπάρχουσες»)
`accounting_invoice_counters`, `accounting_settings`, `companies`, `config`, `dxf_viewer_levels`, `settings`, `system`, `user_2fa_settings`, `user_notification_settings`, `user_preferences`, `users`.

> ⚠️ Διαφορά από Round 1: αυτή τη φορά **ΔΕΝ** αναφέρθηκαν ως διατηρημένα τα `entity_audit_trail` και `dxf_viewer_levels` με τον ίδιο τρόπο — η λίστα παραπάνω είναι η αυθεντική του Giorgio για το Round 2. Ό,τι ΔΕΝ είναι σε αυτή τη λίστα θεωρείται **αδειασμένο** και κάθε νέα εγγραφή εκεί είναι αποτέλεσμα των βημάτων μας. (Αν δεις `entity_audit_trail` άδειο, είναι ΟΚ — θα ξαναγεμίσει με τα audit entries.)

## 2. ΜΕΘΟΔΟΣ ΕΛΕΓΧΟΥ (ανά βήμα δημιουργίας)
Μετά από κάθε ενέργεια του Giorgio:
1. `firestore_list_collections` → ποιες collections/counts άλλαξαν vs baseline.
2. `firestore_query` στη νέα/αλλαγμένη collection → επιβεβαίωσε:
   - **Enterprise ID prefix** (`cont_`,`proj_`,`bldg_`,`flr_`,`prop_`,`pk_`/`stor_` κλπ) — από `enterprise-id.service.ts`.
   - **`companyId`** (tenant isolation) σε όλα.
   - **Audit fields**: `createdBy`, `_lastModifiedBy`, `_lastModifiedByName`, timestamps.
   - **Διασυνδέσεις** (π.χ. `projectId`, `buildingId`, `floorId`, `linkedCompanyId`).
3. Παράπλευρα writes: `search_documents` (index) + `entity_audit_trail` (audit, με resolved ονόματα).
4. `storage_list_files` όταν αφορά αρχεία.

## 3. ✅ ΤΙ ΕΙΧΕ ΔΟΥΛΕΨΕΙ ΣΩΣΤΑ ΣΤΟ ROUND 1 (αναμένεται πάλι ΟΚ)
Ιεραρχία **Εταιρεία → Επαφή → Έργο → Κτίριο → Όροφος**: όλα έγραψαν σωστά (enterprise IDs + companyId + search + audit + links + project counters PRJ-001). Αν κάτι αλλάξει εδώ → νέο regression, ανάφερέ το.

## 4. 🟢 ΟΙ 4 ΔΙΟΡΘΩΣΕΙΣ ROUND 1 — ΤΙ ΝΑ ΕΠΑΛΗΘΕΥΣΕΙΣ ΣΤΗ ΜΟΝΑΔΑ (Property/μεζονέτα)
Οι διορθώσεις είναι **στον κώδικα** (pending Giorgio commit + deploy). Όταν φτάσουμε στη δημιουργία Μονάδας, επιβεβαίωσε στο `prop_*`:

1. **Status SSoT** → `commercialStatus: "unavailable"` (default νέας μονάδας, ΟΧΙ «reserved»/«for-sale»). Legacy `status` == `commercialStatus` (mirror). Το `search_documents` της μονάδας έχει `status` == `commercialStatus` (τώρα διαβάζει το SSoT πεδίο).
2. **`floors.units`** → ο/οι όροφος/-οι που φιλοξενεί η μονάδα έχουν `units >= 1` (μεζονέτα = +1 σε ΚΑΘΕ όροφο των `levels[]`).
   - ⚠️ **ΚΡΙΣΙΜΟ:** το `floors.units` συντηρείται από **Cloud Function** `onPropertyWriteFloorUnits` (`functions/src/aggregation/floorUnitsAggregation.ts`). **Δουλεύει ΜΟΝΟ αν τα functions έχουν γίνει deploy** (`firebase deploy --only functions`) ή τρέχει ο emulator. Αν ο Giorgio ΔΕΝ έχει κάνει deploy → το `floors.units` θα μείνει 0 και αυτό **ΔΕΝ είναι regression**, είναι «δεν deploy-αρίστηκε ακόμα». Ρώτα/σημείωσέ το.
3. **`levelData`** → ΚΑΘΕ επίπεδο της μεζονέτας έχει **πλήρες schema** (`areas:{gross,net,balcony,terrace,garden}`, `layout:{bedrooms,bathrooms,wc}`, `orientations:[]`) — **ΟΧΙ κενό `{}`**.
4. **Legacy flat `area`** → ίσο με `areas.gross` (όχι 0 όταν areas.gross>0).

## 5. 🟡 ΕΚΚΡΕΜΕΣ ΑΠΟ ROUND 1 (μη διορθωμένο)
**BUG #5** — Floor `search_documents`: `links.href = "/buildings/bldg_…"` ενώ `routeParams.id = "flr_…"` (κλικ στον όροφο πάει στο κτίριο). Χαμηλή προτεραιότητα — διόρθωσε μόνο αν ζητηθεί.

## 6. ΜΕΤΑ ΤΗΝ ΙΕΡΑΡΧΙΑ — ΕΠΟΜΕΝΑ ΒΗΜΑΤΑ
Συνέχισε σταδιακά:
- **Storage uploads** (φωτογραφίες / έγγραφα / DXF αρχεία) — έλεγχος storage path (company-scoped), `files` collection, ref-counting.
- **BIM entities από τον DXF viewer** (τοίχοι/κολώνες/openings κλπ) — έλεγχος floor-scoped persistence (ADR-420 floorId), companyId.

## 7. ΑΡΧΕΙΑ ROUND 1 (για context, ΜΗΝ τα ξανα-υλοποιήσεις — έγιναν)
- `src/lib/firestore/property-write-normalizer.ts` (NEW, single writer create+patch)
- `src/constants/commercial-statuses.ts` (DEFAULT_COMMERCIAL_STATUS + αμφίδρομο deriveLegacyStatusFromCommercial)
- `src/services/multi-level.service.ts` (buildEmptyLevelData / buildSeededLevelData)
- `functions/src/aggregation/floorUnitsAggregation.ts` (NEW Cloud Function) + register σε `functions/src/index.ts`
- search statusField → `commercialStatus`: `src/config/search-index-config.ts` + `functions/src/search/search-config.mirror.ts`
- routes: `properties/create/route.ts`, `properties/[id]/route.ts`, `[id]/property-patch-helpers.ts`
- UI (αφαίρεση hardcoded status): `usePolygonHandlers.ts`, `UnitQuickCreateSheet.tsx`, `UnitsPageContent.tsx`, `property-fields-save-handler.ts`, `useAutoLevelCreation.ts`, `types/property-viewer.ts`
- Tests: 46 PASS. ADR-236 changelog + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` ενημερωμένα.

## ΚΑΝΟΝΕΣ-ΚΛΕΙΔΙΑ
- 🌐 Απαντάς ΠΑΝΤΑ Ελληνικά.
- ⚠️ ΟΧΙ commit/push (κάνει ο Giorgio). ⚠️ Working tree ΚΟΙΝΟ με άλλον agent — μόνο σχετικά αρχεία.
- Πρώτα baseline (§0), μετά έλεγχος ανά βήμα (§2). 100% ειλικρίνεια — αν κάτι είναι λάθος, πες το.
