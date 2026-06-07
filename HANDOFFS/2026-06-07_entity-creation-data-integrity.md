# HANDOFF — Entity Creation Data Integrity (Revit-grade, FULL ENTERPRISE + FULL SSOT)

> **Ημερομηνία:** 2026-06-07
> **Κατάσταση:** 🔴 4 data-integrity bugs εντοπίστηκαν, **ΚΑΝΕΝΑ δεν διορθώθηκε ακόμα**. Νέα συνεδρία ξεκινά τις διορθώσεις.
> **Working tree:** ⚠️ ΜΟΙΡΑΖΕΤΑΙ με άλλον agent — ΜΗΝ αγγίξεις άσχετα αρχεία, ΜΗΝ κάνεις commit (commit κάνει ΜΟΝΟ ο Giorgio).
> **Ποιότητα:** FULL ENTERPRISE + FULL SSOT, «σαν Revit». Όχι hacks, όχι duplicates, όχι scattered code.

---

## 1. ΤΙ ΚΑΝΟΥΜΕ (context)

Ο Giorgio **άδειασε τη βάση και το Storage** για να ελέγξουμε σταδιακά ότι **κάθε δημιουργία οντότητας** στο app γράφει σωστά στη Firestore + Storage (enterprise IDs, tenant isolation, search index, audit trail, σωστές διασυνδέσεις).

**Συλλογές που ΔΕΝ αδειάστηκαν** (σταθερές): `accounting_invoice_counters`, `accounting_settings`, `companies`, `config`, `dxf_viewer_levels`, `entity_audit_trail`, `settings`, `system`, `user_2fa_settings`, `user_notification_settings`, `user_preferences`, `users`.

**Μέθοδος ελέγχου (το κάναμε με Firestore MCP tools):**
1. `firestore_list_collections` πριν & μετά κάθε ενέργεια → ποιες collections/counts άλλαξαν.
2. `firestore_query` στη νέα/αλλαγμένη collection → επιβεβαίωση enterprise ID prefix, `companyId`, audit fields (`createdBy`/`_lastModifiedBy`/`_lastModifiedByName`), διασυνδέσεις.
3. Επιβεβαίωση παράπλευρων writes: `search_documents` (index αναζήτησης) + `entity_audit_trail` (audit).
4. `storage_list_files` για Storage.

---

## 2. ΤΙ ΕΛΕΓΧΘΗΚΕ ΚΑΙ ΔΟΥΛΕΥΕΙ ✅ (μην το ξανατσεκάρεις, είναι ΟΚ)

Ροή ιεραρχίας: **Επαφή → Έργο → Κτίριο → Όροφος → Μονάδα**. Όλα έγραψαν σωστά:

| Οντότητα | Doc ID | Collection | Σωστά writes |
|---|---|---|---|
| Εταιρεία (tenant) | `comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757` | companies | baseline |
| Επαφή «ALFA ΚΑΤΑΣΚΕΥΑΣΤΙΚΗ Α.Ε.» | `cont_92aad186-2d95-4b1c-91b0-a0b7932e2ace` | contacts | + search_documents + audit |
| Έργο «ΕΡΓΟ Α» (PRJ-001) | `proj_7d08ec31-71b9-4bb4-a61e-a666406a4cab` | projects | + counters(projects:next=2) + search + audit, linkedCompanyId→επαφή |
| Κτίριο «Κτήριο Α» | `bldg_7ecebda2-47d0-40a5-926c-5b7daa189987` | buildings | + search + audit, projectId→έργο |
| Όροφος «Ισόγειο» (number 0, elev 0) | `flr_a376666d-6cc1-4c04-97db-6904c6d3a233` | floors | + search + audit, buildingId+projectId |
| Όροφος «1ος Όροφος» (number 1, elev 3) | `flr_62b9e9b4-619c-41c8-acb0-cb7cb66d1c46` | floors | + search + audit |
| Μονάδα «Μεζονέτα 130 τ.μ.» (A-ME-0.01) | `prop_98385d3c-05e4-4ff4-8564-2216b096dcd7` | properties | + search + audit, multi-level 2 ορόφων |

**Storage:** άδειο (0 αρχεία) — δεν δοκιμάστηκε ακόμα upload.

Επιβεβαιωμένα σωστά μοτίβα (SSoT που ΗΔΗ δουλεύει — να τα ΣΕΒΑΣΤΕΙΣ/ΕΠΑΝΑΧΡΗΣΙΜΟΠΟΙΗΣΕΙΣ):
- Enterprise IDs με prefix (`cont_`, `proj_`, `bldg_`, `flr_`, `prop_`) — `enterprise-id.service.ts`.
- `companyId` tenant isolation σε όλα.
- Auto `search_documents` index (prefixes, requiredPermission, links).
- `entity_audit_trail` με resolved ονόματα (π.χ. `projectId → "ΕΡΓΟ Α"`), collection-change tracking.
- Σειριακός κωδικός έργου από `counters` (atomic, `next`/`totalGenerated`).

---

## 3. ΤΑ 4 ΠΡΟΒΛΗΜΑΤΑ ΠΟΥ ΒΡΕΘΗΚΑΝ 🔴 (όλα στη δημιουργία Μονάδας/Property)

Όλα εμφανίστηκαν στο `prop_98385d3c-05e4-4ff4-8564-2216b096dcd7`.

### 🔴 BUG #1 — Τριπλό / ασύμφωνο `status` (ΚΥΡΙΟ)
Το property έχει **τρία** πεδία status που δεν συμφωνούν:
- `operationalStatus: "draft"`
- `commercialStatus: "for-sale"`
- `status: "reserved"`  ← και το **search_documents** πήρε ΑΥΤΟ (`status: "reserved"`)

**Πρόβλημα:** Ποιο είναι το SSoT για το status; Από πού προκύπτει το `reserved` (ο χρήστης δεν το επέλεξε — operational=draft, commercial=for-sale). Η αναζήτηση δείχνει «reserved» ενώ λειτουργικά είναι «draft».
**Revit/Enterprise στόχος:** ΕΝΑ SSoT για κάθε διάσταση status. Το legacy γενικό `status` πρέπει είτε να καταργηθεί είτε να παράγεται ντετερμινιστικά από operational/commercial. Το search index να δείχνει το σωστό.

### 🔴 BUG #2 — Μετρητής `units` ορόφου ΔΕΝ ενημερώνεται
Παρόλο που η μεζονέτα αναφέρει `flr_a376…` + `flr_62b9…`, **και οι δύο όροφοι έχουν `units: 0`**. Ο όροφος «δεν ξέρει» ότι φιλοξενεί μονάδα.
**Στόχος:** Όταν δημιουργείται/μετακινείται/διαγράφεται property, ο `units` των συνδεδεμένων ορόφων να ενημερώνεται (SSoT — proactive, idempotent, belt-and-suspenders). Προσοχή multi-level: μετράει σε όλους τους ορόφους που αγγίζει ή μόνο στον primary; (απόφαση Revit-style — μάλλον count σε όλους όπου εμφανίζεται, ή στον primary· να το ξεκαθαρίσεις με Giorgio).

### 🔴 BUG #3 — `levelData` 2ου επιπέδου άδειο `{}`
Στο multi-level property:
- `levelData["flr_a376666d…"]` = πλήρες (areas, layout, orientations)
- `levelData["flr_62b9e9b4…"]` = `{}` ΑΔΕΙΟ
**Στόχος:** Για μεζονέτα, κάθε επίπεδο πρέπει να έχει δικά του δεδομένα (ή σαφή κανόνα κληρονομικότητας). Είτε να απαιτείται συμπλήρωση, είτε default seed, είτε σαφές «inherits from primary».

### 🔴 BUG #4 — Legacy flat fields `area: 0` & `floor: 0` δεν συγχρονίζονται
Το πραγματικό εμβαδό είναι `areas.gross: 130`, αλλά το παλιό `area: 0`. Ομοίως `floor: 0` ενώ υπάρχει `levels[]`.
**Στόχος:** Είτε κατάργηση legacy πεδίων (SSoT = `areas`/`levels`), είτε ντετερμινιστικός υπολογισμός τους από το SSoT ώστε παλιά components να μη δείχνουν «0 τ.μ.».

### 🟡 BUG #5 (δευτερεύον) — Floor search href↔id mismatch
Στο `search_documents` του ορόφου: `links.href = "/buildings/bldg_…"` αλλά `routeParams.id = "flr_…"`. Κλικ στο αποτέλεσμα «Ισόγειο» πάει στο κτίριο, όχι σε σελίδα ορόφου. Χαμηλή προτεραιότητα — διόρθωσε αν προκύψει deep-link ορόφου.

---

## 4. ΠΩΣ ΞΕΚΙΝΑΣ ΣΤΗ ΝΕΑ ΣΥΝΕΔΡΙΑ

1. **PHASE 1 (Recognition):** Βρες τα services/handlers δημιουργίας property. Πιθανά σημεία: `src/**/properties/**`, property creation service, search-index sync, floor `units` aggregation. Διάβασε **τον κώδικα πρώτα** (CODE = SOURCE OF TRUTH), βρες σχετικά ADR (property types: ⚠️ υπάρχει `ADR-145-property-types-ssot.md`), σύγκρινε ADR↔code.
2. **Επιβεβαίωσε με Giorgio** τις αποφάσεις SSoT πριν γράψεις (ποιο status είναι κανονικό· count units σε primary ή όλους· levelData inherit ή required).
3. **PHASE 2:** Υλοποίηση FULL ENTERPRISE + FULL SSOT (proactive, idempotent, ένα SSoT ανά δεδομένο· N.7.2 checklist).
4. **PHASE 3:** Update ADR(s) + changelog + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + adr-index (κανόνας N.15).
5. **PHASE 4:** ΟΧΙ commit από agent — ο Giorgio κάνει commit.

**Επαλήθευση μετά τη διόρθωση:** ξανατρέξε τη ροή δημιουργίας μονάδας στο `http://localhost:3000/dxf/viewer` (ή property module) και με Firestore MCP επιβεβαίωσε: ένα συνεπές status, `floors.units` σωστό, `levelData` πλήρες, `area`/`floor` συγχρονισμένα.

## 5. ΜΕΤΑ ΤΙΣ ΔΙΟΡΘΩΣΕΙΣ — ΣΥΝΕΧΕΙΑ ΑΠΟ ΕΔΩ
Συνεχίζουμε τους σταδιακούς ελέγχους δημιουργίας οντοτήτων (επόμενα: Storage uploads — φωτογραφίες/έγγραφα/DXF αρχεία, BIM entities από τον DXF viewer). Baseline καθαρό· κάθε νέα εγγραφή ελέγχεται όπως στο §1.

---

## ΚΑΝΟΝΕΣ-ΚΛΕΙΔΙΑ (από CLAUDE.md)
- 🌐 Απαντάς ΠΑΝΤΑ στα Ελληνικά.
- ❌ Όχι `any`/`as any`/`@ts-ignore`. Όχι inline styles. Semantic HTML.
- ❌ Όχι `addDoc`/`Date.now()` IDs — ΜΟΝΟ `enterprise-id.service.ts`.
- ❌ Όχι hardcoded strings — i18n SSoT.
- ⚠️ Working tree ΚΟΙΝΟ με άλλον agent — μόνο σχετικά αρχεία.
- ⚠️ ΟΧΙ commit/push χωρίς ρητή εντολή Giorgio.
- 500 lines/file, 40 lines/function max.
