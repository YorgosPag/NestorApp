# HANDOFF — 2026-06-10 — Company Identity SSoT + Per-Tenant + Tenant Provisioning (#2, Phases 1-3)

- **Date**: 2026-06-10
- **Author**: Opus 4.8 (recognition + plan session)
- **Status**: 🔴 PENDING IMPLEMENTATION — recognition ΟΛΟΚΛΗΡΩΘΗΚΕ + plan ΕΓΚΡΙΘΗΚΕ από Giorgio, κώδικας ΟΧΙ ακόμα
- **Γλώσσα απάντησης**: Ελληνικά (ΠΑΝΤΑ — CLAUDE.md LANGUAGE RULE)
- **Στόχος ποιότητας**: FULL ENTERPRISE + FULL SSOT, Revit-grade. ΟΧΙ μπακάλικο. (Ρητή εντολή Giorgio: «όπως οι μεγάλοι παίχτες, όπως η Revit».)
- **Execution mode (εγκεκριμένο)**: Plan Mode, **σειριακά Phase 1 → 2 → 3 με checkpoint του Giorgio μεταξύ τους**. Phase 3 αγγίζει login path → checkpoint ΥΠΟΧΡΕΩΤΙΚΟ πριν.

---

## 0. ΚΡΙΣΙΜΑ CONSTRAINTS (διάβασέ τα ΠΡΩΤΑ)

- 🔴 **COMMIT/PUSH τα κάνει ο Giorgio, ΟΧΙ εσύ** (N.(-1)). Ποτέ commit/push.
- 🔴 **Shared working tree με άλλους agents** → `git add` **ΜΟΝΟ τα δικά σου αρχεία**, **ΠΟΤΕ `git add -A`**. Το tree περιέχει ADR-437/436/438/422 + boiler δουλειά άλλων.
- **ADR-driven workflow** (N.0.1): code = source of truth. Διάβασε κώδικα → ενημέρωσε ADR → υλοποίησε → ξανα-ενημέρωσε. Ίδιο commit.
- **N.17 single-tsc**: πριν τρέξεις `tsc`, έλεγξε ότι δεν τρέχει άλλος. ΕΝΑ tsc τη φορά.
- **Firebase project**: `pagonis-87766` (live). Tenant: `comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757`.
- **ADR αριθμός**: επόμενος ελεύθερος = **ADR-439** (το ADR-438 πιάστηκε σήμερα — Audit Log Retention/TTL). ΑΠΟΦΥΓΕ ADR-145.

---

## 1. ΠΡΟΪΣΤΟΡΙΑ — #1 (Audit FK id+label) = DONE, εκκρεμεί ΜΟΝΟ commit του Giorgio

Στην προηγούμενη συνεδρία ολοκληρώθηκε ΠΛΗΡΩΣ το **#1 (Audit FK canonical id + display label)**, ADR-195 enterprise enhancement. **Code+tests+ADR γραμμένα, μηδέν diagnostics, 5/5 jest pass.** Δεν έγινε commit (ο Giorgio τον κάνει). Τα δικά μας αρχεία για commit (μην -A):
```
src/types/audit-trail.ts
src/services/entity-audit.service.ts
src/services/__tests__/entity-audit-resolution.test.ts
src/app/api/projects/list/project-create.handler.ts
src/app/api/projects/[projectId]/project-mutations.service.ts
src/components/shared/audit/audit-timeline-entry.tsx
docs/centralized-systems/reference/adrs/ADR-195-entity-audit-trail.md
```
Πολιτική #1: FK fields κρατούν canonical id στο `oldValue/newValue` + νέα optional `oldValueLabel/newValueLabel` για display· UI reader (`audit-timeline-entry.tsx`) προτιμά `*Label`, αλλιώς fallback `formatFieldAwareValue` (forward-only, μηδέν backfill). **Αν δεν έχει γίνει commit ακόμα, μην το ξανα-αγγίξεις — απλώς θύμισέ το στον Giorgio.**

---

## 2. #2 — ΤΟ ΠΡΟΒΛΗΜΑ & Η ΑΠΟΦΑΣΗ SSoT (Revit/Google-grade)

### Σύμπτωμα
`companies/{id}.name = "Georgios Pagonis"` (user displayName fallback) αντί νομικής επωνυμίας.

### Ρίζα: 3 διάσπαρτες πηγές ταυτότητας = καμία SSoT
- `companies/{id}.name` — **reactive** materialization (`session/route.ts:124` → `ensureCompanyDocument(id, undefined, uid)`) → πέφτει σε user displayName. `contactId = null`.
- `contacts/{companyId}` type=company (self-contact) — **ΔΕΝ ΥΠΑΡΧΕΙ** (convention στον κώδικα, doc ποτέ δεν φτιάχτηκε).
- `accounting_settings/company_profile` — **GLOBAL singleton** (σταθερό doc id `'company_profile'`, χωρίς companyId στο path). Έχει ΟΛΗ τη σωστή νομική ταυτότητα.

### Πραγματικά δεδομένα (live DB, read-only — verified)
- `contacts/comp_9c7c1a50…` → **404 (δεν υπάρχει)**.
- `companies/comp_9c7c1a50…` → `{ name: "Georgios Pagonis", contactId: null, status: active, plan: free, createdBy: WKBWEg3DSfcdSbLNJfzGEW3vkct1 }`.
- `accounting_settings/company_profile` → πλήρες: `businessName: "ΠΑΓΩΝΗΣ Ενεργειακή Κατασκευαστική Α.Ε."`, `vatNumber: "801832652"`, `taxOffice: "ΦΑΕ Θεσσαλονίκης"`, `address: "Σαμοθράκης 16"`, `city: "Θεσσαλονίκη"`, `postalCode: "56334"`, `phone: "2310559595"`, `entityType: "ae"`, `mainKad: {41.20.10.01…}`, `shareCapital: 25000`, `bookCategory: "double_entry"`. **ΣΗΜΑΝΤΙΚΟ: δεν έχει καν `companyId` field** (orphan global).

### ⚠️ Απόφαση SSoT (ΕΓΚΕΚΡΙΜΕΝΗ από Giorgio μετά από Revit/Google ανάλυση)
Ο τύπος `CompanyDocument` (`src/types/company.ts:57-76`) τεκμηριώνει `name` ως «denormalized FROM CONTACT» + `contactId` ως «FK → contacts type=company» → **μισο-χτισμένο self-contact design**. ΑΛΛΑ τα δεδομένα: self-contact δεν υπάρχει, η νομική ταυτότητα (ΑΦΜ/ΔΟΥ/ΚΑΔ/entityType/μέτοχοι) ζει accounting-domain.

**Revit (ProjectInfo singleton) + Google (Org/Account Settings) = ίδιο μοτίβο:** ΜΙΑ canonical tenant-scoped «Organization Profile» εγγραφή = SSoT· display name = derived cache· ο tenant ΠΟΤΕ self-contact (contacts = εξωτερικοί πελάτες/προμηθευτές).

→ **ΕΠΙΛΟΓΗ: `company_profile` (per-tenant) = legal-identity SSoT. `companies/{id}.name` = derived cache (μέσω `resolveCompanyDisplayName`). Accounting/invoices ήδη διαβάζουν το profile. ΚΑΝΕΝΑ self-contact.** Το «denormalized from contact» σχόλιο ΑΝΤΙΚΑΘΙΣΤΑΤΑΙ με «derived from per-tenant company profile». Αυτό υπερισχύει του μισο-χτισμένου self-contact design (code+data = source of truth).

---

## 3. RECOGNITION MAP (file:line — ΕΓΙΝΕ, μην ξανα-ψάξεις)

### Identity core
- `src/config/tenant.ts:26` — `TENANT_COMPANY_ID = 'comp_9c7c1a50-…'` hardcoded· `:32` LEGACY alias· `:46-48` `getCompanyId()` (env `NEXT_PUBLIC_DEFAULT_COMPANY_ID` → fallback constant).
- `src/services/company-document.service.ts` — `ensureCompanyDocument` (138-226· name resolve 147-169, περνά `{id, name}` στον resolver με name=user displayName)· `repairCompanyDocument` (241-294· **bug** :261 διαβάζει `userData.displayName` και γράφει κατευθείαν στο `companies.name` ΧΩΡΙΣ resolver)· `getCompanyDocument` (90-121).
- `src/services/company/company-name-resolver.ts` — `resolveCompanyName`/`resolveCompanyDisplayName` SSoT· priority `name→companyName→tradeName→legalName→displayName→fallback`. **Υποστηρίζει ήδη legalName, απλώς δεν τροφοδοτείται.**
- `src/types/company.ts:57-76` — `CompanyDocument` type (name «denormalized FROM CONTACT», contactId «FK→contacts type=company»). :37 stale path comment.
- `src/app/api/auth/session/route.ts:124` — `ensureCompanyDocument(companyId, undefined, uid)` (reactive trigger, undefined contactData = η ρίζα).
- `src/app/api/admin/bootstrap-company/route.ts` — διαβάζει `contacts/{companyId}.companyName` (Step 2, :118-123) αλλά **το πετά** (Step 3 :129 περνά `undefined`). Bug. Targets `LEGACY_TENANT_COMPANY_ID`.

### Resolver consumers (ήδη σωστοί — μην σπάσεις)
- `src/app/api/companies/mapper.ts:66`, `bootstrap-queries.ts:126,272`, `navigation/auto-fix-missing-companies/fix-handler.ts:146`, `contacts.service.ts:153`, `company/company-branding-resolver.ts:270,307,374`.
- Direct reads `companies/{id}.name`: `bootstrap-queries.ts:174` (fallback), `company-document.service.ts:105`, `SuperAdminCompanyContext.tsx:74`, `header/CompanySwitcher.tsx:53`.

### Accounting (Phase 2)
- `src/subapps/accounting/services/repository/firestore-accounting-repository.ts` — `getCompanySetup()` :84 reads `ACCOUNTING_SETTINGS.doc(ACCT_COMPANY_PROFILE)` (FIXED global id)· `saveCompanySetup()` :98 same path, companyId μόνο στο body (:103)· constructor :78 `tenant` διαθέσιμο· backward-compat :88-90 (entityType→sole_proprietor, ΚΡΑΤΑ το).
- `src/config/firestore-collections.ts:230` `ACCOUNTING_SETTINGS='accounting_settings'`· `:613` `ACCT_COMPANY_PROFILE='company_profile'`. Άλλοι 5 global singletons same pattern (partners/members/shareholders/service_presets/matching_config :615-625) = future batch, ΕΚΤΟΣ scope.
- `src/subapps/accounting/types/company.ts` — `CompanyProfileBase` (40-96)· variants SoleProprietor(102)/OE(112)/EPE(124)/AE(138)· `CompanySetupInput` (174). :37 stale path comment.
- Consumers profile (διαβάζουν για display/docs): `accounting/setup/route.ts:60,87,164`· `invoices/[id]/send-email/route.ts:128`· `tax/estimate:53`·`tax/dashboard:80`·`efka/summary:53`· `sales-accounting-bridge.ts:71,80,169,207,250`· `sales-accounting-helpers.ts:124` (`buildIssuer` → businessName)· `tax-engine.ts:147`· `invoice-pdf-exporter.ts:77`· `InvoiceForm.tsx:97`· `CreateAPYCertificateDialog.tsx:189`· `useCompanySetup.ts:44,70,82`.
- **FLAG**: `src/app/api/sales/[propertyId]/accounting-event/route.ts:138` φτιάχνει bridge με hardcoded `companyId:'system'` → μετά τη migration θα διαβάζει κενό (health-check GET, δεν crash-άρει αλλά λάθος).
- `firestore.rules:3433-3444` — `match /accounting_settings/{docId}`: gate **by body companyId** (read `isInternalUserOfCompany(resource.data.companyId)`, create/update check body), **ΟΧΙ by path**. → αλλαγή doc id σε per-tenant = **zero rules change**. (Υπάρχον first-create race για μη-υπαρκτό doc — preexisting.)
- `firestore.indexes.json` — **κανένα** accounting_settings index. Zero index change.
- `src/subapps/accounting/services/create-accounting-services.ts:41` — `createAccountingServices({companyId: ctx.companyId, userId: ctx.uid})` → `tenant.companyId` διαθέσιμο στο repo layer (zero plumbing).

### Provisioning primitives (Phase 3 — ΟΛΑ υπάρχουν)
- `src/services/enterprise-id-convenience.ts:10` `generateCompanyId()` → `comp_<uuid>` (prefix `comp`, `enterprise-id-prefixes.ts:9`).
- `src/lib/auth/set-claims-with-mirror.ts:38` `setClaimsWithMirror(uid, claims)` → setCustomUserClaims + mirror `users/{uid}.claimsUpdatedAt`. Caller δίνει ΠΛΗΡΕΣ claims payload.
- `src/app/api/admin/set-user-claims/claims-handler.ts:122` `handleSetUserClaims` — arbitrary companyId, company_admin gate :149.
- `ensureCompanyDocument` (πάνω) = atomic create-if-not-exists company doc.
- Single-tenant crutches να αντιμετωπιστούν: `complete-registration/route.ts:82` (DEFAULT_COMPANY_ID σε ΟΛΟΥΣ)· `auth-context.ts:176` + `require-project-for-page.ts:63` (silent fallback σε env companyId όταν λείπει claim = login path RISK)· `tenant.ts:26` constant.
- **NO existing "create tenant" flow.** `CreateCompanyQuickLink.tsx` φτιάχνει contact, ΟΧΙ tenant. Onboarding services (`onboarding-state-service.ts`, `projects/bootstrap/bootstrap-queries.ts`) = data/state μόνο, ΟΧΙ provisioning.

---

## 4. ΕΓΚΕΚΡΙΜΕΝΟ PLAN (3 phases, σειριακά με checkpoints)

### PHASE 1 — Identity derivation (λύνει το "Georgios Pagonis" τώρα) · ~4 αρχεία · risk ΧΑΜΗΛΟ
1. `company-document.service.ts` — `ensureCompanyDocument` + `repairCompanyDocument`: διαβάζουν **per-tenant `company_profile`** (businessName/tradeName) και ταΐζουν `resolveCompanyDisplayName`· user displayName = ΤΕΛΕΥΤΑΙΟ fallback. Fix bug :261.
2. `bootstrap-company/route.ts` — profile/contact ρέει στο `ensureCompanyDocument` (όχι undefined).
3. Σχόλια `company-document.service.ts` / `types/company.ts` → «derived from per-tenant company profile».
4. Tests + ADR-439 section.
**CHECKPOINT Giorgio** (browser verify: `companies/{id}.name` δείχνει «ΠΑΓΩΝΗΣ … Α.Ε.»).

### PHASE 2 — Accounting profile → per-tenant · ~5 αρχεία + migration · risk ΜΕΣΑΙΟ
5. `firestore-accounting-repository.ts:84,98` — doc id `ACCT_COMPANY_PROFILE` → **`this.tenant.companyId`** (get+save). Rules zero change.
6. `sales/[propertyId]/accounting-event/route.ts:138` — fix hardcoded `companyId:'system'`.
7. Stale comments (`types/company.ts:37`, collections doc-id αν χρειαστεί).
8. **One-time migration script** (read-only μέχρι έγκριση εκτέλεσης): copy `accounting_settings/company_profile` → `accounting_settings/comp_9c7c1a50-…` (+ stamp companyId). Giorgio τρέχει.
9. Tests.
**CHECKPOINT Giorgio**.

### PHASE 3 — Tenant provisioning (αληθινό multi-tenant) · ~4-5 αρχεία · risk ΥΨΗΛΟ (login path)
10. **NEW** `POST /api/admin/provision-tenant`: `generateCompanyId()` → `ensureCompanyDocument` → seed empty `company_profile/{newId}` → `setClaimsWithMirror(adminUid,{companyId,globalRole:'company_admin'})` → `company_members/{adminUid}`.
11. `complete-registration` — support `companyId` από invite-token, `DEFAULT_COMPANY_ID` fallback.
12. ⚠️ `auth-context.ts:176` + `require-project-for-page.ts:63` — missing claim = hard fail σε multi-tenant, πίσω από dev flag (μην σπάσει dev login). **Checkpoint Giorgio ΠΡΙΝ — αγγίζει login.**

### 🚫 ΕΚΤΟΣ scope (ονόμασέ τα, μην σιωπήσεις)
- 13+ webhook callers `getCompanyId()` (WhatsApp/Telegram/Messenger/Instagram/AI-pipeline/contact-linker) = inbound channel→company routing, ξεχωριστό πρόβλημα.
- Άλλοι 5 accounting global singletons (partners/members/shareholders/service_presets/matching_config) = future batch.

---

## 5. N.15 / ADR υποχρεώσεις (ίδιο commit με κώδικα)
- **ADR-439 NEW** «Tenant Identity SSoT & Provisioning» (status, architecture, 3 phases, changelog).
- `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (root) — entry ανά phase (❌→✅ + ημερομηνία).
- `docs/centralized-systems/reference/adr-index.md` — **ΠΡΟΣΟΧΗ: shared tree, οπότε ΜΗΝ το αγγίξεις αν το επεξεργάζεται άλλος· πρόσθεσε ADR-439 μόνο αν καθαρό.**
- Memory MEMORY.md pointer αν χρειαστεί.

## 6. ΤΙ ΝΑ ΜΗΝ ΚΑΝΕΙΣ
- ❌ commit/push (Giorgio).
- ❌ `git add -A` (shared tree· ΜΟΝΟ δικά σου).
- ❌ self-contact για τον tenant (η απόφαση είναι Organization Profile, ΟΧΙ self-contact).
- ❌ global `company_profile` ως πηγή (το «μπακάλικο» — γι' αυτό το per-tenant).
- ❌ Phase 3 χωρίς checkpoint Giorgio (login path).
- ❌ Να σπάσεις τους ήδη-σωστούς resolver consumers (§3).
