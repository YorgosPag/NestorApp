# HANDOFF — 2026-06-10 — ADR-439 Phase 2: Accounting Profile → Per-Tenant + Migration

- **Date**: 2026-06-10
- **Author**: Opus 4.8 (Phase 1 implementer + Phase 2 recognition)
- **Status**: 🔴 PENDING IMPLEMENTATION — Phase 1 DONE+browser-verified+committed-by-Giorgio· Phase 2 recognition ΟΛΟΚΛΗΡΩΘΗΚΕ, κώδικας ΟΧΙ ακόμα
- **Γλώσσα απάντησης**: Ελληνικά (ΠΑΝΤΑ — CLAUDE.md LANGUAGE RULE)
- **Στόχος ποιότητας**: FULL ENTERPRISE + FULL SSOT, Revit-grade (ρητή εντολή Giorgio: «όπως οι μεγάλοι παίχτες, όπως η Revit»). ΟΧΙ μπακάλικο.
- **Execution mode**: Plan Mode → υλοποίηση. Phase 2 = ~5 αρχεία + migration endpoint. Risk ΜΕΣΑΙΟ (αγγίζει live data μέσω migration). **Checkpoint Giorgio πριν την εκτέλεση της migration.**

---

## 0. ΚΡΙΣΙΜΑ CONSTRAINTS (διάβασε ΠΡΩΤΑ)

- 🔴 **COMMIT/PUSH τα κάνει ο Giorgio, ΟΧΙ εσύ** (N.(-1)). Ποτέ.
- 🔴 **Shared working tree με άλλους agents** → `git add` **ΜΟΝΟ τα δικά σου αρχεία**, **ΠΟΤΕ `git add -A`**.
- **ADR-driven workflow** (N.0.1): code = source of truth. Διάβασε → ενημέρωσε ADR-439 → υλοποίησε → ξανα-ενημέρωσε. Ίδιο commit.
- **N.17 single-tsc**: πριν τρέξεις `tsc`, έλεγξε ότι δεν τρέχει άλλος. ΕΝΑ tsc τη φορά.
- **Firebase project**: `pagonis-87766` (live). Tenant: `comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757`.
- **ADR**: συνεχίζεις στο ΥΠΑΡΧΟΝ `ADR-439-tenant-identity-ssot-and-provisioning.md` (μην φτιάξεις νέο). Επόμενο ελεύθερο ADR αν χρειαστεί = ADR-440.
- **i18n / N.11**: μηδέν hardcoded UI strings (το Phase 2 είναι κυρίως server/data — απίθανο να χρειαστεί νέο key).

---

## 1. ΠΡΟΪΣΤΟΡΙΑ — Phase 1 = DONE + BROWSER-VERIFIED LIVE

ADR-439 Phase 1 (identity derivation) ολοκληρώθηκε, επιβεβαιώθηκε σε ζωντανή βάση (`PATCH /api/admin/bootstrap-company` repair → `companies/{id}.name = "ΠΑΓΩΝΗΣ Ενεργειακή Κατασκευαστική Α.Ε."`), 7/7 jest, tsc καθαρό. **Commit τον κάνει ο Giorgio** (αν δεν έχει γίνει ακόμα, μην τα ξανα-αγγίξεις). Αρχεία Phase 1 (μην -A):
```
src/services/company/company-legal-identity.ts            (NEW)
src/services/company-document.service.ts                  (MOD)
src/app/api/admin/bootstrap-company/route.ts              (MOD)
src/types/company.ts                                      (MOD)
src/services/__tests__/company-legal-identity.test.ts     (NEW)
docs/centralized-systems/reference/adrs/ADR-439-tenant-identity-ssot-and-provisioning.md  (NEW)
docs/centralized-systems/reference/adr-index.md           (MOD)
local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt                                     (MOD)
```

**Κλειδωμένη απόφαση SSoT** (μην την ξανα-συζητήσεις): per-tenant `company_profile` (`accounting_settings/{companyId}`) = legal-identity SSoT· `companies/{id}.name` = derived cache· ΚΑΝΕΝΑ self-contact. Revit ProjectInformation / Google Org-settings μοτίβο.

---

## 2. PHASE 2 — ΣΤΟΧΟΣ

Σήμερα η νομική ταυτότητα ζει σε **GLOBAL singleton** `accounting_settings/company_profile` (σταθερό doc id, χωρίς companyId στο path — «μπακάλικο»). Phase 2 = κάνε το **per-tenant**: `accounting_settings/{companyId}`. Αυτό είναι το τελευταίο κομμάτι που εμποδίζει το αληθινό multi-tenant στο accounting domain.

**ΧΡΥΣΟ ΕΥΡΗΜΑ (recognition):** Όλοι οι server consumers διαβάζουν το profile **μέσω του repository** (`FirestoreAccountingRepository`, instantiated με `createAccountingServices(tenant)`). Το client hook `useCompanySetup` διαβάζει μέσω **API route** (`/api/accounting/setup`), ΟΧΙ client-direct Firestore. → Αλλάζοντας ΜΟΝΟ το doc-id μέσα στο repository, **ΟΛΟΙ** οι consumers γίνονται per-tenant διαφανώς. Μικρή, καθαρή επιφάνεια.

---

## 3. RECOGNITION MAP (file:line — ΕΓΙΝΕ, μην ξανα-ψάξεις)

### Το core change (repository)
- `src/subapps/accounting/services/repository/firestore-accounting-repository.ts`:
  - `:78` constructor `private readonly tenant: TenantContext` → `this.tenant.companyId` ΔΙΑΘΕΣΙΜΟ.
  - `getCompanySetup()` `:82-93` — `:84` `db.collection(COLLECTIONS.ACCOUNTING_SETTINGS).doc(SYSTEM_DOCS.ACCT_COMPANY_PROFILE).get()` → άλλαξε σε `.doc(this.tenant.companyId)`. **ΚΡΑΤΑ** το backward-compat `:88-90` (`if (!raw.entityType) raw.entityType = 'sole_proprietor'`).
  - `saveCompanySetup()` `:95-112` — `:98` ίδιο doc → `.doc(this.tenant.companyId)`. **ΚΡΑΤΑ** το `companyId: this.tenant.companyId` stamping στο body (`:103`) — γίνεται κιόλας. **ΚΡΑΤΑ** το `createdAt` preserve (`:105-107`).
- `SYSTEM_DOCS.ACCT_COMPANY_PROFILE` (`firestore-collections.ts:613` = `'company_profile'`) — **ΜΗΝ το σβήσεις** (το χρειάζεται ακόμα η migration + το transitional fallback). Απλώς σταματά να το χρησιμοποιεί το repository.

### Μοναδικοί άλλοι αναγνώστες/γραφείς του doc
- `src/services/company/company-legal-identity.ts:78` — το `@transitional` global fallback (Phase 1). **ΑΦΑΙΡΕΣΕ το ΜΟΝΟ ΜΕΤΑ** την επιβεβαίωση της migration (βλ. §4 sequencing).
- ΚΑΝΕΝΑΣ άλλος. (Grep `ACCT_COMPANY_PROFILE` → μόνο repository ×2 + company-legal-identity + tests + docs.)

### Health-check bug
- `src/app/api/sales/[propertyId]/accounting-event/route.ts:138` — `new SalesAccountingBridge({ companyId: 'system', userId: 'system' })` σε **GET diagnostic**. Μετά τη migration, `companyId:'system'` → δεν υπάρχει per-tenant doc → `checkSetup()` επιστρέφει null (λάθος health). **FIX**: χρησιμοποίησε τον πραγματικό tenant: `import { getCompanyId } from '@/config/tenant'` → `{ companyId: getCompanyId(), userId: 'system' }`. (Το POST path χρησιμοποιεί ήδη `ctx.companyId` μέσω withAuth — ΟΚ.)

### Firestore Rules — ZERO CHANGE (επιβεβαιωμένο)
- `firestore.rules:3433-3445` `match /accounting_settings/{docId}`:
  - read: super-admin **Ή** (`resource.data.companyId` υπάρχει ΚΑΙ `isInternalUserOfCompany(companyId)`).
  - create: `request.resource.data.companyId == getUserCompanyId()`.
  - update: `canWriteAccountingSingleton(companyId)` + companyId immutable.
  - **Gate = by-body-companyId, ΟΧΙ by-path** → αλλαγή doc-id σε per-tenant = **μηδέν rules change**. ΠΡΟΫΠΟΘΕΣΗ: το per-tenant doc ΠΡΕΠΕΙ να φέρει `companyId` field (η migration το σφραγίζει· το `saveCompanySetup` ήδη το γράφει).
- `firestore.indexes.json` — **κανένα** accounting_settings index → μηδέν index change.
- ⚠️ Το ΥΠΑΡΧΟΝ global doc `accounting_settings/company_profile` φέρεται ως **orphan χωρίς companyId field** → non-super-admin client read θα αποτύγχανε, αλλά οι server reads (Admin SDK μέσω repository) **παρακάμπτουν** τους rules. Γι' αυτό δεν έσπασε ποτέ. Η migration το διορθώνει στο per-tenant doc.

### Stale comments (καθάρισε — Boy Scout)
- `src/subapps/accounting/types/company.ts:37` — `Firestore path: accounting_settings/company_profile` → `accounting_settings/{companyId}` (ADR-439).
- `firestore-collections.ts:611-613` — προαιρετικά σχόλιο ότι το `ACCT_COMPANY_PROFILE` είναι πλέον legacy/migration-only doc id.

### Plumbing (μηδέν αλλαγή — ήδη έτοιμο)
- `src/subapps/accounting/services/create-accounting-services.ts:41` — `createAccountingServices(tenant: TenantContext)` → `new FirestoreAccountingRepository(tenant)`. Ο tenant ρέει ήδη παντού.
- `useCompanySetup.ts:63,90` — fetch `API_ROUTES.ACCOUNTING.SETUP.BASE` (server). Διαφανές.

---

## 4. ΠΛΑΝΟ PHASE 2 (Revit/Google-grade, με σωστό sequencing)

### Βήμα Α — Repository per-tenant (code)
1. `firestore-accounting-repository.ts` `:84` & `:98` → doc id `SYSTEM_DOCS.ACCT_COMPANY_PROFILE` → `this.tenant.companyId`. Κράτα backward-compat + companyId stamping + createdAt preserve.
2. Fix `sales/[propertyId]/accounting-event/route.ts:138` → `getCompanyId()` αντί `'system'`.
3. Stale comments (§3).

### Βήμα Β — One-time migration (NEW, idempotent, dry-run-first, admin-gated, audit-logged)
4. **NEW** `src/app/api/admin/migrate-accounting-profile/route.ts` (μοτίβο `bootstrap-company/route.ts`):
   - `GET` = **dry-run/preview** (super_admin): διάβασε `accounting_settings/company_profile` (global) + `accounting_settings/{companyId}` (per-tenant) → ανάφερε τι θα γίνει (exists/missing, businessName). ΜΗΔΕΝ write.
   - `POST` = **execute** (super_admin, `withSensitiveRateLimit`): **idempotent** — αν per-tenant doc υπάρχει ήδη → `ALREADY_MIGRATED`, no-op. Αλλιώς `setDoc(accounting_settings/{companyId}, { ...global, companyId })` (**N.6**: doc id = companyId = enterprise id· `setDoc`, ΟΧΙ `addDoc`). Stamp `companyId` + `updatedAt`. Άφησε το global doc άθικτο (rollback safety). Audit μέσω `logSystemOperation`.
   - ΠΡΟΣΟΧΗ: Admin SDK παρακάμπτει rules → η migration δουλεύει ανεξάρτητα. Αλλά σφράγισε `companyId` για να ισχύουν οι rules στα ΜΕΛΛΟΝΤΙΚΑ client reads.
5. **CHECKPOINT Giorgio**: τρέχει πρώτα `GET` (preview), μετά `POST` (execute) από browser console (credentials:'include', super_admin). Επιβεβαίωση: `accounting_settings/comp_9c7c1a50…` υπάρχει με σωστό businessName + companyId.

### Βήμα Γ — Αφαίρεση transitional fallback (ΜΟΝΟ μετά το Βήμα Β επιβεβαιωμένο)
6. `company-legal-identity.ts` — αφαίρεσε το `@transitional` global fallback (`:75-79` το `if (!snap.exists) snap = ...ACCT_COMPANY_PROFILE`). Κράτα ΜΟΝΟ per-tenant read. Ενημέρωσε JSDoc (διώξε το `@transitional` block) + το test (`company-legal-identity.test.ts` — αφαίρεσε/αναμόρφωσε το «falls back to global» case· κράτα per-tenant-first + null cases).
   - ⚠️ **ΜΗΝ** το κάνεις πριν τρέξει η migration — αλλιώς σπάει το identity derivation για τον υπάρχοντα tenant (το per-tenant doc δεν θα υπάρχει). Γι' αυτό είναι ξεχωριστό βήμα/commit (Phase 2b) ΜΕΤΑ το checkpoint.

### Βήμα Δ — Tests
7. Update repository test (αν υπάρχει) ή NEW: getCompanySetup/saveCompanySetup χτυπούν `accounting_settings/{companyId}`, ΟΧΙ global. Migration route test (idempotent: 2η εκτέλεση = no-op· dry-run = μηδέν write· companyId stamped).

### 🚫 ΕΚΤΟΣ scope Phase 2
- Άλλοι 5 accounting global singletons (`partners`/`members`/`shareholders`/`service_presets`/`matching_config`, `firestore-collections.ts:614-625`) = future batch, ΙΔΙΟ μοτίβο. Ονόμασέ τα, μην τα αγγίξεις.
- Phase 3 (tenant provisioning + login path) = ξεχωριστό, checkpoint Giorgio ΠΡΙΝ.

---

## 5. N.15 / ADR υποχρεώσεις (ίδιο commit με κώδικα)
- **ADR-439** — ενημέρωσε §3 PHASE 2 (PLANNED → DONE), Consequences, Changelog. ΜΗΝ φτιάξεις νέο ADR.
- `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` — ενημέρωσε τη γραμμή ADR-439 (Phase 2 done → μένει Phase 3· ή DEFER αναπροσαρμογή). 1-2 γραμμές, ΜΟΝΟ τι εκκρεμεί.
- `docs/centralized-systems/reference/adr-index.md` — ADR-439 ΥΠΑΡΧΕΙ ήδη (status update αν θες· shared tree → άγγιξε μόνο αν καθαρό).
- Memory: `~/.claude/projects/C--Nestor-Pagonis/memory/project_adr439_tenant_identity_ssot.md` + MEMORY.md pointer.

## 6. ΤΙ ΝΑ ΜΗΝ ΚΑΝΕΙΣ
- ❌ commit/push (Giorgio). ❌ `git add -A` (shared tree· ΜΟΝΟ δικά σου).
- ❌ Αφαίρεση transitional fallback ΠΡΙΝ τρέξει η migration (σπάει τον υπάρχοντα tenant).
- ❌ `addDoc`/auto-id για τη migration — `setDoc(doc(companyId))` (N.6).
- ❌ Πείραγμα των άλλων 5 global singletons (future batch).
- ❌ Διαγραφή του global doc στη migration (κράτα το για rollback safety· future cleanup ξεχωριστά).
- ❌ Αλλαγή firestore.rules / indexes (gate-by-body-companyId ήδη καλύπτει· zero change).
- ❌ Phase 3 χωρίς checkpoint Giorgio.
