# HANDOFF — 2026-06-10 — ADR-439 Phase 2c: Accounting Sibling Singletons → Per-Tenant

- **Date**: 2026-06-10
- **Author**: Opus 4.8 (Phase 2a/2b implementer + Phase 2c recognition)
- **Status**: 🔴 PENDING IMPLEMENTATION — recognition ΟΛΟΚΛΗΡΩΘΗΚΕ (file:line μέσα), κώδικας ΟΧΙ ακόμα
- **Γλώσσα απάντησης**: Ελληνικά ΠΑΝΤΑ (CLAUDE.md LANGUAGE RULE)
- **Στόχος**: FULL ENTERPRISE + FULL SSOT, Revit-grade. ΟΧΙ μπακάλικο.
- **Execution mode**: **Plan Mode** (5+ αρχεία, 2 επιφάνειες server+client). Υπάρχει **μία αρχιτεκτονική απόφαση** που θέλει την έγκρισή σου ΠΡΙΝ τον κώδικα (βλ. §2).

---

## 0. ΚΡΙΣΙΜΑ CONSTRAINTS (διάβασε ΠΡΩΤΑ)

- 🔴 **COMMIT/PUSH τα κάνει ο Giorgio, ΟΧΙ ο agent** (N.(-1)). Ποτέ.
- 🔴 **Shared working tree με άλλον agent** → `git add` **ΜΟΝΟ τα δικά σου αρχεία**, **ΠΟΤΕ `git add -A`**.
- **Συνεχίζεις στο ΥΠΑΡΧΟΝ ADR-439** (μην φτιάξεις νέο· τα 5 singletons είναι ήδη γραμμένα ως "future batch" εκεί). Επόμενο ελεύθερο ADR αν χρειαστεί = ADR-440.
- **N.6**: Firestore writes με `setDoc` + enterprise-id· ΟΧΙ `addDoc`. Η migration γράφει doc id ντετερμινιστικά (βλ. §2).
- **N.17 single-tsc**: πριν τρέξεις `tsc`, έλεγξε ότι δεν τρέχει άλλος.
- **Firebase project**: `pagonis-87766` (live). Tenant: `comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757` (`LEGACY_TENANT_COMPANY_ID`).
- **Προαπαιτούμενο**: Phase 2a/2b (company-profile per-tenant + migration endpoint) είναι **DONE + MIGRATION RUN LIVE**, εκκρεμεί ΜΟΝΟ ο commit του Giorgio. Το Phase 2c πατάει πάνω σε αυτά.

---

## 1. ΠΡΟΪΣΤΟΡΙΑ — Πού είμαστε

ADR-439 = Tenant Identity SSoT. Phase 1 (identity derivation) + Phase 2a (company-profile → per-tenant repository + idempotent migration endpoint `/api/admin/migrate-accounting-profile`) + Phase 2b (αφαίρεση transitional fallback) = **DONE, migration έτρεξε live**. Το `accounting_settings/{companyId}` (bare doc id) είναι τώρα η legal-identity SSoT.

**Phase 2c** = κάνε per-tenant και τους **υπόλοιπους accounting global singletons**, ώστε το accounting domain να γίνει **συνεπώς** multi-tenant (τώρα είναι μισό: η επωνυμία per-tenant, οι μέτοχοι/εταίροι ακόμα global).

---

## 2. 🚨 ΑΡΧΙΤΕΚΤΟΝΙΚΗ ΑΠΟΦΑΣΗ — ΧΡΕΙΑΖΕΤΑΙ ΕΓΚΡΙΣΗ GIORGIO ΠΡΙΝ ΤΟΝ ΚΩΔΙΚΑ

**Το πρόβλημα (collision):** Το Phase 2a έβαλε το profile σε **bare** `accounting_settings/{companyId}`. Αν οι 5 αδελφοί πάνε κι αυτοί σε bare `{companyId}` → **όλοι συγκρούονται σε ΕΝΑ doc**. Δεν γίνεται.

**Σύσταση Opus (Revit/Google-grade):** doc-id **suffix convention** στην ίδια collection:
```
accounting_settings/{companyId}                     ← profile (identity, ήδη live· ιστορικά bare)
accounting_settings/{companyId}__partners
accounting_settings/{companyId}__members
accounting_settings/{companyId}__shareholders
accounting_settings/{companyId}__service_presets
accounting_settings/{companyId}__matching_config    ← ΜΟΝΟ αν αποφασιστεί tenant-data (βλ. §3.B)
```
- Κάθε doc **κουβαλά `companyId` field** (bare) → οι Firestore rules `match /accounting_settings/{docId}` (gate-by-body-companyId) περνούν **με μηδέν rules change**, ανεξαρτήτως doc-id.
- Το `__` separator δεν εμφανίζεται σε enterprise ids (που είναι `comp_<uuid>`) → μηδέν αμφισημία.
- **ΕΝΑΛΛΑΚΤΙΚΗ που ΑΠΟΡΡΙΠΤΕΤΑΙ**: subcollection `companies/{companyId}/accounting/{type}` = καθαρότερο θεωρητικά, ΑΛΛΑ αλλάζει collection path → **rules + index change + μεγαλύτερο refactor**. Δεν αξίζει τώρα· το suffix convention είναι zero-rules-change και επεκτάσιμο.

➡️ **ΠΡΩΤΟ ΒΗΜΑ ΝΕΑΣ ΣΥΝΕΔΡΙΑΣ: επιβεβαίωσε αυτή την απόφαση με τον Giorgio (Plan Mode), μετά υλοποίησε.**

---

## 3. RECOGNITION MAP (file:line — ΕΓΙΝΕ, μην ξανα-ψάξεις)

### A) Surface A — server repository (Admin SDK), TRIVIAL mirror του company-profile

Όλες οι functions παίρνουν ήδη `tenant: TenantContext` → `tenant.companyId` διαθέσιμο. Αλλαγή = doc-id `SYSTEM_DOCS.X` → composite per-tenant id.

| Singleton | Read | Write | Stamps companyId; |
|---|---|---|---|
| **partners** | `accounting-repo-entities.ts:25` | `:35` | ✅ ήδη (`:38`) |
| **members** | `accounting-repo-entities.ts:68` | `:78` | ✅ ήδη (`:81`) |
| **shareholders** | `accounting-repo-entities.ts:111` | `:121` | ✅ ήδη (`:124`) |
| **service_presets** | `accounting-repo-financial.ts:263-266` | `:276-278` | ⚠️ **ΟΧΙ** (`:279-282` γράφει μόνο `presets, updatedAt`) → **ΠΡΟΣΘΕΣΕ `companyId: tenant.companyId`** αλλιώς client reads αποτυγχάνουν στους rules |

- Wiring: `firestore-accounting-repository.ts` καλεί `entities.getPartners(this.tenant)` / `financial.getServicePresets(this.tenant)` κ.λπ. → `tenant` ρέει ήδη παντού. Μηδέν call-site change.
- **ΠΡΟΣΟΧΗ**: `getPartners/getMembers/getShareholders` επιστρέφουν `data.partners ?? []` (το doc είναι wrapper `{ partners: [...] }`). Κράτα το σχήμα — άλλαξε ΜΟΝΟ το doc-id.

### B) Surface B — matching_config = CLIENT-DIRECT (web SDK), ΔΙΑΦΟΡΕΤΙΚΟ + ΑΜΦΙΛΕΓΟΜΕΝΟ

**ΠΡΩΤΑ ΑΠΟΦΑΣΗ ΠΡΟΪΟΝΤΟΣ (Giorgio):** Το `matching_config` είναι **scoring weights/thresholds του matching engine** — δηλαδή **tuning αλγορίθμου**, ΟΧΙ δεδομένα πελάτη όπως μέτοχοι. Νόμιμα μπορεί να μείνει **GLOBAL system-config** (κάθε tenant ίδιος αλγόριθμος). Αν μείνει global → **ΔΕΝ είναι μπακάλικο, είναι σωστό**, και **γλιτώνεις εντελώς την client-direct επιφάνεια** (χαμηλότερο ρίσκο).
- Αν Giorgio θέλει per-tenant tuning → τότε migrate. Διαφορετικά **SKIP** το matching_config.

Αν αποφασιστεί per-tenant, η επιφάνεια (μεγαλύτερη — client SDK, ΟΧΙ Admin):
- `matching-engine.ts:48-61` `loadMatchingConfig()` — dynamic `firebase/firestore` `doc(db, ACCOUNTING_SETTINGS, ACCT_MATCHING_CONFIG)` (client read). Χρειάζεται client companyId.
- `useMatchingConfig.ts:40` (read), `:64-65` (write `setDoc(..., { merge:true })`) — client hook, έχει `useAuth().user`. Client companyId: βρες client-safe getter (π.χ. από `user` claims / υπάρχον client tenant helper) — **ΟΧΙ** `@/config/tenant` server `getCompanyId()` σε client component.
- Το client write **ΔΕΝ** σφραγίζει companyId → πρόσθεσε `companyId` στο body (αλλιώς rules block).
- **Migration**: το global `matching_config` doc δεν έχει companyId → stamp on copy.

### C) Firestore rules / indexes
- `firestore.rules` `match /accounting_settings/{docId}` = **gate-by-body-companyId** (επιβεβαιώθηκε στο Phase 2a, §3 του προηγούμενου handoff). Composite doc-id `{companyId}__type` με body.companyId=bare → **zero rules change**. ⚠️ **ΕΠΙΒΕΒΑΙΩΣΕ ξανά** το block (γραμμές ~3433-3445) στην αρχή της νέας συνεδρίας πριν υποθέσεις.
- `firestore.indexes.json` — κανένα accounting_settings index → **zero index change**.

### D) Constants (μην σβήσεις — migration + legacy)
- `firestore-collections.ts:617-628` `ACCT_PARTNERS/MEMBERS/SHAREHOLDERS/SERVICE_PRESETS/MATCHING_CONFIG` = legacy global doc ids. Κράτα τα (migration source). Πρόσθεσε σχόλιο legacy/migration-only (όπως έγινε στο `ACCT_COMPANY_PROFILE:611-613`).

---

## 4. ΠΛΑΝΟ PHASE 2c (Plan Mode → υλοποίηση, σωστό sequencing)

### Βήμα 0 — Plan Mode + έγκριση
1. Επιβεβαίωσε §2 (suffix convention) + §3.B (matching_config: global vs per-tenant) με Giorgio.
2. Re-confirm rules block (§3.C).

### Βήμα Α — Helper SSoT για τα composite doc-ids (μην hardcode-άρεις `__`)
3. **NEW** μικρό pure helper (π.χ. `src/subapps/accounting/services/repository/accounting-doc-ids.ts`): `accountingDocId(companyId, type)` → `` `${companyId}__${type}` `` με enum/union των types. **ΕΝΑΣ** ορισμός του convention = SSoT (μην σκορπίσεις το `__` σε 5 σημεία).

### Βήμα Β — Server repository per-tenant (Surface A, 4 docs)
4. `accounting-repo-entities.ts` (partners/members/shareholders) + `accounting-repo-financial.ts` (service_presets) → doc-id μέσω `accountingDocId(tenant.companyId, ...)`. **ΠΡΟΣΘΕΣΕ companyId stamping στο service_presets** (`:279-282`).

### Βήμα Γ — (ΜΟΝΟ αν per-tenant) matching_config client (Surface B)
5. `matching-engine.ts:loadMatchingConfig` + `useMatchingConfig.ts` (read+write) → composite id + client companyId + stamp companyId στο write. (SKIP αν Giorgio το κρατήσει global.)

### Βήμα Δ — Migration (NEW ή extend, idempotent, dry-run-first, admin-gated)
6. **Σύσταση**: **NEW** `src/app/api/admin/migrate-accounting-singletons/route.ts` (μοτίβο `migrate-accounting-profile`), που μεταφέρει και τα 4 (ή 5) global → composite per-tenant σε **ΕΝΑ** idempotent pass:
   - `GET` = dry-run/preview (super_admin, zero writes): ανά singleton → exists/missing source + target.
   - `POST` = execute: για κάθε singleton, αν target υπάρχει → skip· αλλιώς `setDoc({companyId}__type, { ...global, companyId, updatedAt })`. Global docs άθικτα (rollback). Audit `logSystemOperation`.
   - Idempotent: 2η εκτέλεση = όλα ALREADY_MIGRATED.
7. **CHECKPOINT Giorgio**: GET preview → POST execute από browser console (super_admin, `credentials:'include'`).

### Βήμα Ε — Tests
8. Repository tests: get/save κάθε singleton χτυπά `{companyId}__type`, ΟΧΙ legacy· service_presets τώρα σφραγίζει companyId. Migration route test (idempotent, dry-run zero-write, companyId stamped, globals intact). (matching_config: αν per-tenant, hook test.)

### 🚫 ΕΚΤΟΣ scope 2c
- Διαγραφή legacy global docs = future cleanup (κράτα για rollback).
- Phase 3 (tenant provisioning + login path) = ξεχωριστό, checkpoint Giorgio ΠΡΙΝ.
- Αλλαγή του ήδη-live profile doc-id (μένει bare `{companyId}`).

---

## 5. N.15 / ADR υποχρεώσεις (ίδιο commit με κώδικα)
- **ADR-439** — §3 πρόσθεσε PHASE 2c (DONE), Consequences, Changelog. ΜΗΝ νέο ADR.
- `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` — ενημέρωσε τη γραμμή ADR-439 (1-2 γραμμές, μόνο τι εκκρεμεί).
- `adr-index.md` — status (shared tree → μόνο αν καθαρό).
- Memory: `project_adr439_tenant_identity_ssot.md` + MEMORY.md pointer.

## 6. ΤΙ ΝΑ ΜΗΝ ΚΑΝΕΙΣ
- ❌ commit/push (Giorgio). ❌ `git add -A` (shared tree· ΜΟΝΟ δικά σου).
- ❌ bare `{companyId}` doc-id για τα 5 (collision με το profile) — χρησιμοποίησε το convention §2.
- ❌ Hardcode `__` σε πολλά σημεία — ΕΝΑ helper SSoT (§4 Βήμα Α).
- ❌ `addDoc`/auto-id (N.6).
- ❌ Διαγραφή legacy global docs στη migration.
- ❌ Per-tenant matching_config ΧΩΡΙΣ απόφαση Giorgio (ίσως σωστά global system-config).
- ❌ `@/config/tenant` server `getCompanyId()` μέσα σε client component (useMatchingConfig).
- ❌ Αλλαγή firestore.rules/indexes (gate-by-body-companyId καλύπτει· επιβεβαίωσε πρώτα).
