# ADR-439 — Tenant Identity SSoT & Provisioning

- **Status**: IN PROGRESS — **Phase 1 (identity derivation) DONE + BROWSER-VERIFIED LIVE**· **Phase 2a (per-tenant repository + migration endpoint) DONE + MIGRATION RUN LIVE**· **Phase 2b (αφαίρεση transitional fallback) DONE** (code+tests, pending commit)· **Phase 2c (5 accounting sibling singletons → per-tenant) DONE** (code+tests, pending commit + live-migration)· Phase 3 (tenant provisioning) PLANNED
- **Date**: 2026-06-10
- **Authors**: Opus (recognition + architecture + implementation), Giorgio (product owner)
- **Domain**: Identity / Multi-tenancy / Accounting
- **Επόμενο ελεύθερο ADR μετά**: ADR-440
- **Σχετικά ADR**: ADR-210 (enterprise ID standardization + company document materialization), ADR-017 (enterprise IDs), ADR-312 (company name resolver SSoT), ADR-195 (entity audit trail), ADR-326 (org structure), ADR-ACC-000 (accounting company profile)

---

## 1. Context — Γιατί

**Σύμπτωμα:** `companies/{id}.name = "Georgios Pagonis"` (user displayName) αντί της νομικής επωνυμίας «ΠΑΓΩΝΗΣ Ενεργειακή Κατασκευαστική Α.Ε.».

**Ρίζα — 3 διάσπαρτες πηγές ταυτότητας, καμία SSoT:**

| Πηγή | Πρόβλημα |
|------|----------|
| `companies/{id}.name` | **Reactive** materialization (`session/route.ts` → `ensureCompanyDocument(id, undefined, uid)`) → πέφτει στο user `displayName`. `contactId = null`. |
| `contacts/{companyId}` (type=company, self-contact) | **ΔΕΝ ΥΠΑΡΧΕΙ** — convention στον κώδικα/τύπους (`CompanyDocument.name` «denormalized FROM CONTACT»), το doc ποτέ δεν φτιάχτηκε. |
| `accounting_settings/company_profile` | **GLOBAL singleton** (σταθερό doc id, χωρίς `companyId` στο path). Έχει ΟΛΗ τη σωστή νομική ταυτότητα (businessName/ΑΦΜ/ΔΟΥ/ΚΑΔ/entityType/μέτοχοι), αλλά δεν είναι tenant-scoped. |

Ο τύπος `CompanyDocument` τεκμηρίωνε ένα **μισο-χτισμένο self-contact design** (`name` denormalized from contact, `contactId` FK → contacts type=company) που τα δεδομένα ΔΕΝ υλοποιούν: self-contact δεν υπάρχει· η νομική ταυτότητα ζει στο accounting domain.

---

## 2. Decision — SSoT (Revit/Google-grade)

**Revit `ProjectInformation` (singleton) + Google Org/Account Settings = ίδιο μοτίβο:** ΜΙΑ canonical, tenant-scoped «Organization Profile» = SSoT· display name = derived cache· ο tenant **ΠΟΤΕ self-contact** (το `contacts` collection είναι για εξωτερικούς πελάτες/προμηθευτές).

> **ΑΠΟΦΑΣΗ:** Η **per-tenant** `company_profile` εγγραφή (`accounting_settings/{companyId}`) είναι η **legal-identity SSoT**. Το `companies/{id}.name` είναι **derived cache** μέσω `resolveCompanyDisplayName`. **ΚΑΝΕΝΑ self-contact.** Το σχόλιο «denormalized from contact» αντικαθίσταται με «derived from per-tenant company profile». Code + data = source of truth, υπερισχύει του μισο-χτισμένου self-contact design.

Priority στον `company-name-resolver` (ήδη υποστηρίζει legalName, απλώς δεν τροφοδοτούνταν):
`name → companyName(explicit contact override) → tradeName(profile) → legalName(profile businessName) → displayName(user, last resort) → identifier fallback`.

---

## 3. Architecture — 3 Phases (σειριακά, με checkpoint του Giorgio)

### PHASE 1 — Identity derivation ✅ DONE (code+tests, pending verify+commit)

Λύνει το «Georgios Pagonis» **τώρα**, χωρίς να μετακινήσει δεδομένα ακόμα.

- **NEW** `src/services/company/company-legal-identity.ts` — `readCompanyLegalIdentity(companyId)`: διαβάζει **per-tenant** `accounting_settings/{companyId}` (SSoT)· `@transitional` fallback στο legacy global `accounting_settings/company_profile` ώσπου να τρέξει η Phase 2 migration. Επιστρέφει `{ businessName?, tradeName? }` ή `null`.
- **MOD** `company-document.service.ts`:
  - `ensureCompanyDocument` — τροφοδοτεί `resolveCompanyDisplayName` με profile `legalName`/`tradeName`· user `displayName` = ΤΕΛΕΥΤΑΙΟ fallback.
  - `repairCompanyDocument` — **fix bug**: διάβαζε user `displayName` και έγραφε κατευθείαν στο `companies.name` **παρακάμπτοντας** τον resolver· τώρα re-derive μέσω profile + resolver, no-op αν το όνομα είναι ήδη σωστό, audit `oldValue` = προηγούμενο όνομα.
- **MOD** `bootstrap-company/route.ts` — ρέει contact override στο `ensureCompanyDocument` (όχι `undefined`).
- **MOD** `types/company.ts` — comments → «derived from per-tenant company profile»· `contactId` = optional external FK (όχι self-contact).
- **Tests** — `company-legal-identity.test.ts` (7/7): per-tenant-first, transitional global fallback, tradeName, null cases, no hardcoded paths.

**CHECKPOINT Giorgio**: ✅ BROWSER-VERIFIED LIVE 2026-06-10 — `PATCH /api/admin/bootstrap-company` (repair) σε ζωντανή βάση `pagonis-87766` επέστρεψε `name: "ΠΑΓΩΝΗΣ Ενεργειακή Κατασκευαστική Α.Ε."` (από «Georgios Pagonis»), αποδεικνύοντας end-to-end profile→resolver→write. Σημείωση: `ensureCompanyDocument` είναι create-if-not-exists → υπάρχουσες εγγραφές διορθώνονται μόνο μέσω της repair ή της Phase 2 migration.

### PHASE 2a — Accounting profile → per-tenant + migration endpoint ✅ DONE (code+tests, pending live-migration + commit)

Κάνει το profile per-tenant **διαφανώς**: όλοι οι server consumers διαβάζουν μέσω του repository, οπότε αλλαγή ΜΟΝΟ του doc-id τα μεταφέρει όλα.

- **MOD** `firestore-accounting-repository.ts` — `getCompanySetup`/`saveCompanySetup` doc id `SYSTEM_DOCS.ACCT_COMPANY_PROFILE` → `this.tenant.companyId`· κράτησε backward-compat entityType + companyId stamping + createdAt preserve· αφαιρέθηκε το πλέον αχρησιμοποίητο `SYSTEM_DOCS` import. `firestore.rules:3433` gate-by-body-companyId → **zero rules change**· καμία index change.
- **MOD** `sales/[propertyId]/accounting-event/route.ts` — GET diagnostic hardcoded `companyId:'system'` → `getCompanyId()` (αλλιώς μετά τη migration false-negative health).
- **NEW** `src/app/api/admin/migrate-accounting-profile/route.ts` — one-time migration (μοτίβο `bootstrap-company`): `GET` = dry-run/preview (super_admin, zero writes, READY_TO_MIGRATE/ALREADY_MIGRATED/NO_SOURCE)· `POST` = execute (super_admin + `withSensitiveRateLimit`, **idempotent**): `setDoc(accounting_settings/{companyId}, {...global, companyId, updatedAt})` (N.6 doc id = companyId, ΟΧΙ addDoc)· global doc άθικτο (rollback safety)· audit μέσω `logSystemOperation`.
- **MOD** comments — `types/company.ts` (path → `{companyId}`), `firestore-collections.ts` (`ACCT_COMPANY_PROFILE` = legacy/migration-only).
- **Tests** — repository company-setup (per-tenant doc-id + null + entityType backfill + companyId stamp + createdAt preserve) + migration route (dry-run zero-write, idempotent no-op, companyId stamped, global intact, super_admin gate). 21/21 pass (μαζί με τα Phase 1).

**CHECKPOINT Giorgio**: ✅ MIGRATION RUN LIVE 2026-06-10 — `GET` preview → `READY_TO_MIGRATE`· `POST` execute → `MIGRATED` (businessName «ΠΑΓΩΝΗΣ Ενεργειακή Κατασκευαστική Α.Ε.» αντιγράφηκε στο `accounting_settings/comp_9c7c1a50…` με σφραγισμένο companyId). Global doc άθικτο.

### PHASE 2b — Αφαίρεση transitional fallback ✅ DONE (code+tests, pending commit)

- **MOD** `company-legal-identity.ts` — αφαιρέθηκε ο `@transitional` global fallback· `readCompanyLegalIdentity` διαβάζει **per-tenant only** (`accounting_settings/{companyId}`)· καθαρίστηκε JSDoc + αφαιρέθηκε αχρησιμοποίητο `SYSTEM_DOCS` import.
- **MOD** `company-legal-identity.test.ts` — το «falls back to global» case έγινε «does NOT fall back» (per-tenant absent → null, ανεξάρτητα του legacy global doc)· per-tenant-first + null/blank cases αμετάβλητα. 21/21 pass.
- Εκτελέστηκε ΜΟΝΟ μετά την επιβεβαιωμένη live migration (αλλιώς θα έσπαγε το identity derivation του υπάρχοντος tenant).

### PHASE 2c — Accounting sibling singletons → per-tenant ✅ DONE (code+tests, pending commit + live-migration)

Κάνει per-tenant **όλους** τους εναπομείναντες accounting global singletons (5 στο `accounting_settings` + 1 EFKA config), ώστε το accounting domain να γίνει **100% συνεπώς** multi-tenant (όχι μισό: επωνυμία per-tenant, μέτοχοι ακόμα global).

- **Doc-id convention (SSoT)** — επειδή το profile κάθεται ήδη σε bare `accounting_settings/{companyId}`, οι αδελφοί πάνε σε **composite** `accounting_settings/{companyId}__<type>` μέσω **ΕΝΟΣ** pure helper. **NEW** `services/repository/accounting-doc-ids.ts` — `accountingDocId(companyId, type)` + `AccountingSingletonType` union (`partners|members|shareholders|service_presets|matching_config`). Κάθε doc κουβαλά bare `companyId` field → `firestore.rules:3433` gate-by-body-companyId περνά **με zero rules/index change**· το `__` δεν εμφανίζεται σε `comp_<uuid>` ids (μηδέν αμφισημία). Απορρίφθηκε subcollection (`companies/{id}/accounting/{type}`) γιατί θα άλλαζε collection path → rules+index change.
- **MOD** `accounting-repo-entities.ts` (partners/members/shareholders get+save) + `accounting-repo-financial.ts` (service_presets get+save) — doc-id μέσω `accountingDocId(tenant.companyId, …)`· **service_presets save τώρα σφραγίζει `companyId`** (πριν έγραφε μόνο `presets, updatedAt` → client reads θα έσπαγαν στους rules). Μηδέν call-site change (το `tenant` ρέει ήδη).
- **EFKA user config** (6ος singleton, ξεχωριστή collection `accounting_efka_config`) — `getEFKAUserConfig`/`saveEFKAUserConfig` doc-id `SYSTEM_DOCS.ACCT_EFKA_USER_CONFIG` (global `user_config`) → **bare `tenant.companyId`** (mirror του profile· μία config/tenant → όχι composite). `saveEFKAUserConfig` **τώρα σφραγίζει `companyId`** (πριν δεν το έκανε). `firestore.rules:3447` gate-by-body-companyId → zero rules change.
- **matching_config (latent bug fix)** — ο `MatchingEngine` τρέχει **server-side** (bank/candidates|match|match-batch routes) αλλά το `loadMatchingConfig` διάβαζε με **client** firebase SDK (`getApp()`) → στον server πάντα catch → `DEFAULT`. Δηλαδή ο engine ποτέ δεν διάβασε αποθηκευμένο config. **NEW** `accounting-repo-config.ts` (`getMatchingConfig`/`saveMatchingConfig`, Admin SDK, composite id, stamp companyId) + `IAccountingRepository` interface + repository delegation· `matching-engine.ts:getConfig` → `this.repository.getMatchingConfig()` (companyId από TenantContext, χωρίς client SDK). **Client UI** `useMatchingConfig.ts` → companyId μέσω υπάρχοντος `useCompanyId()` (ADR-201, client-safe) + composite id + stamp companyId στο write.
- **MOD** `firestore-collections.ts` — legacy/migration-only σχόλια στα 5 `ACCT_*` doc ids (διατηρούνται ως migration source).
- **NEW** `src/app/api/admin/migrate-accounting-singletons/route.ts` — one-time migration (μοτίβο `migrate-accounting-profile`), **γενικό descriptor** (collection + legacy doc-id + target doc-id fn) ώστε να καλύπτει και τα 5 του `accounting_settings` (composite) και το EFKA (ξεχωριστή collection, bare): `GET` dry-run/preview (super_admin, per-singleton status, zero writes)· `POST` execute (super_admin + `withSensitiveRateLimit`, **idempotent ανά singleton**): `setDoc(target, {...global, companyId, updatedAt})`· globals άθικτα (rollback)· `logSystemOperation` audit.
- **Tests** — `accounting-doc-ids` (helper) + repository singletons (κάθε get/save → per-tenant doc, service_presets+EFKA stamp companyId, matching_config per-tenant) + migration route (per-singleton dry-run/idempotent/companyId-stamped/globals-intact/super_admin gate, 6 entries incl EFKA). 20 νέα pass· 282/282 accounting engines+repository regression· tsc καθαρό. Zero rules/index change.

**CHECKPOINT Giorgio**: ✅ MIGRATION RUN 2026-06-11 (super_admin browser): `GET`/`POST` → όλα τα 6 `NO_SOURCE` (no-op — ο tenant δεν είχε ποτέ legacy global data στα 6· τίποτα προς μετάφραση, μηδέν απώλεια). ✅ `matching_config` BROWSER-VERIFIED end-to-end: αλλαγή threshold → save → F5 reload → η τιμή επιβίωσε (write+read στο `accounting_settings/{companyId}__matching_config`). 🔴 PENDING μόνο commit.

### PHASE 3 — Tenant provisioning (PLANNED, risk ΥΨΗΛΟ — αγγίζει login path)

- **NEW** `POST /api/admin/provision-tenant`: `generateCompanyId()` → `ensureCompanyDocument` → seed empty `company_profile/{newId}` → `setClaimsWithMirror(adminUid,{companyId,globalRole:'company_admin'})` → `company_members/{adminUid}`.
- `complete-registration` — support `companyId` από invite-token, `DEFAULT_COMPANY_ID` fallback.
- `auth-context.ts` + `require-project-for-page.ts` — missing claim = hard fail σε multi-tenant, πίσω από dev flag. **Checkpoint Giorgio ΠΡΙΝ.**

### 🚫 ΕΚΤΟΣ scope
- 13+ webhook callers `getCompanyId()` (inbound channel→company routing) = ξεχωριστό πρόβλημα.
- ~~Άλλοι 5 accounting global singletons~~ = ✅ έγινε στο Phase 2c.
- Διαγραφή legacy global docs (company_profile + 5 singletons) = future cleanup (rollback-safety τώρα).

---

## 4. Consequences

- ✅ Η νομική επωνυμία γίνεται η μοναδική πηγή display name· τέλος ο user-displayName-as-company-name regression.
- ✅ Per-tenant-first αρχιτεκτονική → μονοπάτι προς αληθινό multi-tenant (Phase 3).
- ✅ Ο transitional global fallback αφαιρέθηκε (Phase 2b) μετά την επιβεβαιωμένη live migration· η ταυτότητα διαβάζεται πλέον per-tenant only.
- ✅ Zero rules/index change για Phase 2 (gate-by-body-companyId ήδη)· η migration σφραγίζει `companyId` ώστε να περνούν οι rules σε μελλοντικά client reads.
- ✅ Per-tenant doc-id αλλαγή μόνο στο repository → όλοι οι accounting consumers γίνονται tenant-scoped διαφανώς (μηδέν call-site change).
- ✅ (Phase 2c) Το accounting domain γίνεται πλήρως multi-tenant· το `accountingDocId()` είναι η SSoT για το composite doc-id convention (μηδέν σκορπισμένο `__`).
- ✅ (Phase 2c) Διορθώθηκε latent bug: ο server `MatchingEngine` διάβαζε config με client SDK → πάντα `DEFAULT`· τώρα διαβάζει per-tenant μέσω repository (Admin SDK).

---

## 5. Changelog

- **2026-06-10** — ADR created. **Phase 1 implemented** (Opus): `company-legal-identity.ts` (NEW) + `company-document.service.ts`/`bootstrap-company/route.ts`/`types/company.ts` (MOD) + `company-legal-identity.test.ts` (7/7 pass). Phase 2 & 3 planned, awaiting Giorgio checkpoints.
- **2026-06-10** — **Phase 1 BROWSER-VERIFIED LIVE**: `PATCH /api/admin/bootstrap-company` (repair) στη ζωντανή βάση `pagonis-87766` διόρθωσε `companies/comp_9c7c1a50….name` → «ΠΑΓΩΝΗΣ Ενεργειακή Κατασκευαστική Α.Ε.». Pending μόνο commit (Giorgio).
- **2026-06-10** — **Phase 2a implemented** (Opus): repository per-tenant doc-id (`firestore-accounting-repository.ts` MOD) + health-check fix (`sales/.../accounting-event/route.ts` MOD) + one-time migration endpoint (`admin/migrate-accounting-profile/route.ts` NEW, idempotent/dry-run-first/admin-gated) + stale-comment cleanup (`types/company.ts`, `firestore-collections.ts`). Tests: repository company-setup (NEW) + migration route (NEW), 21/21 pass. Zero rules/index change.
- **2026-06-10** — **Phase 2a MIGRATION RUN LIVE** (Giorgio, super_admin browser): `GET` → `READY_TO_MIGRATE`· `POST` → `MIGRATED`· `accounting_settings/comp_9c7c1a50…` δημιουργήθηκε με businessName «ΠΑΓΩΝΗΣ Ενεργειακή Κατασκευαστική Α.Ε.» + companyId. Global doc άθικτο.
- **2026-06-10** — **Phase 2b implemented** (Opus): αφαίρεση `@transitional` global fallback από `readCompanyLegalIdentity` (per-tenant only) + JSDoc/import cleanup + test reshape («does NOT fall back»). 21/21 pass, tsc καθαρό. Pending μόνο commit (Giorgio).
- **2026-06-10** — **Phase 2c implemented** (Opus): **6** accounting global singletons → per-tenant (5 `accounting_settings` siblings + EFKA config). **NEW** `accounting-doc-ids.ts` (SSoT `accountingDocId` + `AccountingSingletonType`), `accounting-repo-config.ts` (matching_config Admin read/write), `admin/migrate-accounting-singletons/route.ts` (idempotent migration, generic collection+source+target descriptor). **MOD** `accounting-repo-entities.ts` (partners/members/shareholders composite doc-id + **EFKA config bare `{companyId}` doc-id + stamp companyId**), `accounting-repo-financial.ts` (service_presets composite + stamp companyId), `interfaces.ts` (`getMatchingConfig`/`saveMatchingConfig`), `firestore-accounting-repository.ts` (delegation), `matching-engine.ts` (getConfig via repository — fixed server-side client-SDK latent bug), `useMatchingConfig.ts` (useCompanyId + composite id + stamp), `firestore-collections.ts` (legacy comments ×6). Tests: helper + repository singletons (incl EFKA) + migration route (6 entries, 20 νέα), 282/282 accounting regression, tsc καθαρό. Zero rules/index change. Pending commit + live-migration (Giorgio).
