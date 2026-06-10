# ADR-440 — Accounting Entity-Data SSoT (partners / members / shareholders)

- **Status**: DONE (code + tests) — 🔴 pending browser-verify + commit (Giorgio)
- **Date**: 2026-06-11
- **Authors**: Opus 4.8 (recognition + architecture + implementation), Giorgio (product owner)
- **Domain**: Accounting / Multi-tenancy / Data Modeling
- **Επόμενο ελεύθερο ADR μετά**: ADR-441
- **Σχετικά ADR**: ADR-439 (tenant identity SSoT & provisioning — Phase 2c per-tenant accounting singletons), ADR-ACC-000 (accounting company profile), ADR-ACC-012 (ΟΕ partners), ADR-ACC-014 (ΕΠΕ members), ADR-ACC-015 (ΑΕ shareholders)

---

## 1. Context — Γιατί (split-brain SSoT)

Τα **partners (ΟΕ) / members (ΕΠΕ) / shareholders (ΑΕ)** αποθηκεύονταν σε **ΔΥΟ** μέρη που **δεν συγχρονίζονταν**:

| Πηγή | Ποιος έγραφε/διάβαζε | Πρόβλημα |
|------|---------------------|----------|
| **(Α) Profile-embedded** — `accounting_settings/{companyId}`, core πεδία του discriminated union `CompanyProfile` (`OE.partners`, `EPE.members`, `AE.shareholders`) | **Setup form** (η ΜΟΝΗ ζωντανή write-UI) μέσω `saveCompanySetup` | Η σωστή, ζωντανή πηγή — αλλά κανείς reader δεν τη διάβαζε. |
| **(Β) Standalone singleton** — `accounting_settings/{companyId}__{partners\|members\|shareholders}` (ADR-439 Phase 2c· πρώην global) | **tax/EFKA engines** (`calculateAETax`, `calculatePartnershipTax`, `calculateEPETax`, οι EFKA summaries) | Κενό doc — κανείς δεν το γράφει. |

**Το bug:** η UI έγραφε στο (Α), τα engines διάβαζαν από το (Β), τίποτα δεν συγχρόνιζε. → Μέτοχοι/εταίροι που εισάγει ο χρήστης ήταν **αόρατοι** στον φόρο ΑΕ + EFKA. Με κενά και τα δύο σήμερα → κανένα ορατό σύμπτωμα, αλλά λανθασμένος υπολογισμός μόλις μπουν δεδομένα.

**Πώς προέκυψε:** μισο-τελειωμένη migration προς singleton — χτίστηκαν API routes (`/api/accounting/{partners,members,shareholders}`) + `usePartners` hook + repo methods + τα engines άλλαξαν να διαβάζουν singleton, ΑΛΛΑ το Setup form ποτέ δεν συνδέθηκε να γράφει singleton (συνεχίζει στο profile) και dedicated singleton write-UI δεν υπάρχει. Αποτέλεσμα: το singleton write-path ήταν **νεκρός κώδικας με μηδέν consumers** (το `usePartners` ήταν exported μόνο στο barrel· `useMembers`/`useShareholders` ποτέ δεν υπήρξαν).

---

## 2. Decision — profile-embedded = SSoT (Revit/Google-grade)

**Revit `ProjectInformation` / Google Org Settings μοτίβο:** μία canonical δομή ορίζει την οντότητα· οι καταναλωτές διαβάζουν από εκεί, δεν κρατούν δεύτερο αντίγραφο.

> **ΑΠΟΦΑΣΗ (Option A):** Τα partners/members/shareholders ζουν **μόνο** στο per-tenant company profile (`accounting_settings/{companyId}`), όπως ήδη δηλώνει ο τύπος (`AECompanyProfile` *έχει* `shareholders` εξ ορισμού). Οι readers (tax/EFKA) διαβάζουν από το profile μέσω **ΕΝΟΣ** SSoT accessor (το υπάρχον `getCompanySetup()` + pure entityType-discriminator). Το νεκρό singleton write-path **αποσύρεται** ολόκληρο.

**Απορρίφθηκε — Option B (singleton = SSoT):** θα απαιτούσε να γράφει το Setup form στα singletons και να αφαιρεθούν core πεδία από τον `CompanyProfile` τύπο → σπάει το discriminated-union identity model, μεγαλύτερο/επικίνδυνο refactor. Δεν αξίζει.

**Semantics (κρίσιμο):** `shareholders` (ΑΕ) ≠ `partners` (ΟΕ) ≠ `members` (ΕΠΕ). Ο accessor επιστρέφει το σωστό array ανά `entityType`· για μη-ταιριαστή μορφή → `[]` (π.χ. `getShareholders` σε ΟΕ profile = `[]`).

---

## 3. Architecture — αλλαγές

### SSoT accessor (NEW)
- **NEW** `services/repository/profile-entity-accessors.ts` — pure `getProfilePartners/getProfileMembers/getProfileShareholders(profile)`: `oe→partners`, `epe→members`, `ae→shareholders`, αλλιώς `[]`.
- **MOD** `firestore-accounting-repository.ts` — `getPartners/getMembers/getShareholders` διαβάζουν πλέον `await this.getCompanySetup()` + accessor (ΕΝΑΣ profile-read SSoT = το `getCompanySetup`). Ίδιο interface → οι callers (`accounting-service`, `accounting-efka-operations`) **αμετάβλητοι**.

### Retire dead singleton write-path
- **MOD** `accounting-repo-entities.ts` — αφαιρέθηκαν `getPartners/savePartners/getMembers/saveMembers/getShareholders/saveShareholders` (singleton readers/writers). Μένουν ΜΟΝΟ τα EFKA payment queries + EFKA user config (ξεχωριστή collection).
- **MOD** `types/interfaces.ts` — αφαιρέθηκαν `savePartners/saveMembers/saveShareholders` (τα `getX` μένουν, profile-backed).
- **MOD** `services/audited-repository-wrapper.ts` — αφαιρέθηκαν τα 3 `saveX` bindings.
- **DELETE** `app/api/accounting/{partners,members,shareholders}/route.ts` (3 dead routes· GET+PUT, μηδέν external callers — μόνο το dead hook).
- **DELETE** `hooks/usePartners.ts` + **MOD** `hooks/index.ts` (αφαίρεση export).
- **MOD** `config/domain-constants.ts` — αφαίρεση αχρησιμοποίητου `ACCOUNTING.PARTNERS` route constant (δεν υπήρχαν MEMBERS/SHAREHOLDERS constants).

### Tests
- **NEW** `__tests__/profile-entity-accessors.test.ts` — entityType-discrimination + semantics (ΑΕ→shareholders, ΟΕ profile→getShareholders=[], null→[]).
- **MOD** `firestore-accounting-repository.singletons.test.ts` — αφαιρέθηκαν τα 3 partners/members/shareholders singleton cases (μένουν service_presets/matching_config/EFKA).
- **MOD** `tax-engine.test.ts`, `vat-engine.test.ts` — αφαιρέθηκαν τα `saveX` από τα mock repositories.

### Τι ΔΕΝ άλλαξε (συνειδητά)
- `CompanyProfile` τύπος — κρατά τα `partners/members/shareholders` ως **SSoT** (core identity).
- `AccountingSingletonType` union (`accounting-doc-ids.ts`) — κρατά `'partners'|'members'|'shareholders'` literals ώστε να **μη σπάσει** το ADR-439 Phase 2c migration script (shared tree, pending commit). Types-only, αβλαβές· οι suffix-docs απλώς δεν διευθυνσιοδοτούνται πλέον.
- `firestore.rules` — gate-by-body-companyId καλύπτει ήδη το profile → **zero rules change, zero index change**.
- Issuer-identity readers (`InvoiceForm`/`InvoiceDetails`/`APY`) — διαβάζουν profile για businessName/ΑΦΜ, όχι arrays· δεν αγγίχθηκαν.

---

## 4. Consequences

**Θετικά:**
- ΕΝΑ source of truth — οι μέτοχοι/εταίροι που εισάγει ο χρήστης γίνονται **ορατοί** στον φόρο + EFKA.
- Ταιριάζει με το domain model (discriminated union).
- Αφαιρέθηκε νεκρός κώδικας (3 routes + 1 hook + 6 repo methods + interface noise).

**Validation hardening (DONE — δεύτερο pass):**
- Το παλιό PUT route-validation (άθροισμα shares = 100%, ΑΦΜ 9-ψήφιο, board-role) έτρεχε **μόνο στο νεκρό path** → χάθηκε όταν αφαιρέθηκαν τα routes. Μεταφέρθηκε σε **SSoT validator** `services/validation/entity-arrays-validator.ts` που καλεί το ζωντανό `PUT /api/accounting/setup` ανά entityType.
  - **Ενσυνείδητη απόκλιση:** κενό array = έγκυρο (incremental setup — ο χρήστης σώζει profile πριν συμπληρώσει όλους τους μετόχους)· το 100%-sum invariant επιβάλλεται **μόνο όταν το array ΔΕΝ είναι κενό** (ακριβώς η περίπτωση που αλλιώς σιωπηλά μισ-υπολογίζει φόρο/μερίσματα).
  - **ΑΕ efkaMode = server-derived** (`deriveShareholderEfkaModes`) — δεν εμπιστευόμαστε client για derived πεδίο (Εγκύκλιοι ΕΦΚΑ 4/2017, 17/2017).
- 13 νέα jest (validator).

**Audit trail σε αλλαγές ιδιοκτησίας/μερισμάτων (DONE — τρίτο pass):**
- Το `saveCompanySetup` ήταν **pass-through (χωρίς audit)** → αλλαγές μετόχων/εταίρων/μελών & ποσοστών (material ownership data) δεν άφηναν ίχνος.
- **NEW** `services/audit/company-ownership-audit.ts` (pure `diffCompanyOwnership`, reuse των profile accessors) + **MOD** `audited-repository-wrapper.ts`: το `saveCompanySetup` έγινε **audited mutation** (read-before → save → diff → log). Εκπέμπει `COMPANY_PROFILE_UPDATED` ΜΟΝΟ όταν αλλάζει ιδιοκτησία (added/removed/share-%) ή νομική μορφή (signal-rich log· καθαρές αλλαγές διεύθυνσης/τηλεφώνου δεν λογάρονται εδώ).
- NEW audit types: `COMPANY_PROFILE_UPDATED` event + `company_profile` entity type. Rich delta = JSON string στο flat metadata. 7 νέα jest.
- **ΕΥΡΗΜΑ (honesty):** ο `createAuditedRepository` (Phase 1c) ήταν **ΑΣΥΝΔΕΤΟΣ** — δεν τον καλούσε καμία route → ΟΛΟ το accounting audit (invoices/journals/…) ήταν dead infrastructure. Συνέδεσα **μόνο** τη `PUT /api/accounting/setup` (wrap repository με `createAuditedRepository(repo, uid, companyId)`)· οι υπόλοιπες routes παραμένουν ασύνδετες — **ξεχωριστό pre-existing cross-cutting gap, εκτός ADR-440 scope** (βλ. §4).

**Trade-offs / γνωστά:**
- ✅ Orphan singleton docs: **live-verified κενά** (δεν υπάρχουν) → καμία cleanup/migration. Closed.
- 🔴 **Ξεχωριστό cross-cutting gap (NOT ADR-440):** ο `createAuditedRepository` δεν καλείται από καμία route εκτός της setup (που μόλις συνδέθηκε). Invoices/journals/bank/period audit είναι **ασύνδετα** → καμία route δεν παράγει accounting audit entries. Θέλει ξεχωριστό ADR/εργασία (wrap ΟΛΩΝ των mutating routes). Σημειώθηκε στο `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`.
- **DEFER (polish, όχι μπακάλικο):** route-level integration test για το setup wiring· πλήρες schema-parse (Zod) αντί `as` casts στα non-money πεδία· optimistic concurrency στο `saveCompanySetup` (read-then-write).

**Relationship με ADR-439 Phase 2c:** 3 από τα 5 accounting sibling singletons (partners/members/shareholders) **καταργούνται** ως active write/read paths. matching_config / service_presets / EFKA config μένουν per-tenant ως έχουν.

---

## 5. Verification

- `npx jest src/subapps/accounting` → **371/371 pass** (4 accessor + 13 validator + 7 ownership-audit tests + tax/vat/EFKA regression).
- **Live Firestore verify (`pagonis-87766`, 2026-06-11):** τα 3 singleton docs `{companyId}__{partners|members|shareholders}` **ΔΕΝ υπάρχουν** → μηδέν orphan data, καμία migration. Ο live tenant = ΑΕ με `shareholders: []` → το bug ήταν συμπτωματικά αόρατο (κενά και τα δύο)· το fix ασφαλές· επιβεβαιώνει ότι «κενό array = επιτρεπτό» ήταν σωστή απόφαση (αλλιώς ο tenant δεν θα μπορούσε να σώσει profile).
- `tsc --noEmit` → καθαρό για τα θιγόμενα αρχεία.
- 🔴 Browser-verify (Giorgio): ΑΕ setup με μετόχους → `calculateAETax` τους βλέπει.

---

## Changelog

- **2026-06-11** — ADR-440 created. Option A (profile = SSoT) implemented: NEW `profile-entity-accessors.ts` + test· repository getters → profile-backed· retired dead singleton write-path (3 routes + `usePartners` hook + 6 repo methods + interface/wrapper/domain-constants cleanup)· singletons/tax/vat tests updated. (Committed 033440b7/7e126e77 + fix ef5bd34f matching-config wrapper binding.)
- **2026-06-11 (validation hardening)** — NEW `services/validation/entity-arrays-validator.ts` (SSoT) + 13 tests· wired into `PUT /api/accounting/setup`: per-entity shape validation + 100%-sum (when non-empty) + ΑΕ server-derived efkaMode. Closes the gap where the live write path saved partners/members/shareholders unvalidated after the dead routes were removed. 364/364 accounting tests green.
- **2026-06-11 (audit trail)** — NEW `services/audit/company-ownership-audit.ts` (pure `diffCompanyOwnership`) + 7 tests· `saveCompanySetup` in the audited wrapper → audited mutation emitting `COMPANY_PROFILE_UPDATED` on ownership/legal-form change· +audit types (`COMPANY_PROFILE_UPDATED`, `company_profile`). Discovered `createAuditedRepository` was unwired everywhere → wired it into `PUT /api/accounting/setup` (`createAuditedRepository(repo, uid, companyId)`); flagged the broader unwired-audit gap for a separate ADR. Live Firestore verified: zero orphan singleton docs. 371/371 accounting tests green. tsc clean (only 6 unrelated dxf-viewer errors). Pending browser-verify + commit (Giorgio).
