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

**Trade-offs / γνωστά:**
- Το παλιό PUT route-validation (άθροισμα shares = 100%, ΑΦΜ 9-ψήφιο) έτρεχε **μόνο στο νεκρό path**. Η ζωντανή write-UI (Setup form) κάνει client-side validation. **DEFER:** προαιρετική προσθήκη server-side share-sum validation στο `saveCompanySetup` (pre-existing gap, εκτός scope).
- **DEFER:** καθαρισμός orphan singleton docs `{companyId}__{partners|members|shareholders}` (κενά τώρα, μη επείγον).

**Relationship με ADR-439 Phase 2c:** 3 από τα 5 accounting sibling singletons (partners/members/shareholders) **καταργούνται** ως active write/read paths. matching_config / service_presets / EFKA config μένουν per-tenant ως έχουν.

---

## 5. Verification

- `npx jest src/subapps/accounting` → **351/351 pass** (incl. 4 νέα accessor tests, tax/vat/EFKA regression).
- `tsc --noEmit` → καθαρό για τα θιγόμενα αρχεία.
- 🔴 Browser-verify (Giorgio): ΑΕ setup με μετόχους → `calculateAETax` τους βλέπει.

---

## Changelog

- **2026-06-11** — ADR-440 created. Option A (profile = SSoT) implemented: NEW `profile-entity-accessors.ts` + test· repository getters → profile-backed· retired dead singleton write-path (3 routes + `usePartners` hook + 6 repo methods + interface/wrapper/domain-constants cleanup)· singletons/tax/vat tests updated. 351/351 accounting tests green. Pending browser-verify + commit (Giorgio).
