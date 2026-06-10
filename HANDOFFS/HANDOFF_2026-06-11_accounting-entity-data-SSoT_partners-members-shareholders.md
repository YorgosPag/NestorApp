# HANDOFF — 2026-06-11 — Accounting Entity-Data SSoT (partners / members / shareholders)

- **Date**: 2026-06-11
- **Author**: Opus 4.8 (ADR-439 Phase 2c implementer + this recognition)
- **Status**: 🔴 PENDING IMPLEMENTATION — recognition ΟΛΟΚΛΗΡΩΘΗΚΕ (file:line μέσα), κώδικας ΟΧΙ ακόμα
- **Γλώσσα απάντησης**: Ελληνικά ΠΑΝΤΑ (CLAUDE.md LANGUAGE RULE)
- **Στόχος**: FULL ENTERPRISE + FULL SSOT, Revit-grade. ΟΧΙ μπακάλικο.
- **Execution mode**: **Plan Mode** (split-brain σε ~8 αρχεία, 2 επιφάνειες). Μία αρχιτεκτονική απόφαση (§2) — προτεινόμενη, θέλει confirm μέσω plan.

---

## 0. ΚΡΙΣΙΜΑ CONSTRAINTS (διάβασε ΠΡΩΤΑ)

- 🔴 **COMMIT/PUSH τα κάνει ο Giorgio, ΟΧΙ ο agent** (N.(-1)). Ποτέ.
- 🔴 **Shared working tree με άλλον agent** → `git add` **ΜΟΝΟ τα δικά σου αρχεία**, **ΠΟΤΕ `git add -A`**.
- **N.6**: Firestore writes με `setDoc` + ντετερμινιστικό doc id (όχι addDoc).
- **N.17 single-tsc**: πριν τρέξεις `tsc`, έλεγξε ότι δεν τρέχει άλλος.
- **Firebase project**: `pagonis-87766` (live). Tenant: `comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757` (`LEGACY_TENANT_COMPANY_ID`).
- **ADR**: Πρότεινε **ΝΕΟ ADR-440** (Accounting Entity-Data SSoT) — distinct concern από το ADR-439 (tenant identity). Εναλλακτικά ADR-439 Phase 2d. Επόμενο ελεύθερο = ADR-440.

---

## 1. ΤΟ ΠΡΟΒΛΗΜΑ — Split-brain στα partners / members / shareholders

Τα **partners (ΟΕ) / members (ΕΠΕ) / shareholders (ΑΕ)** αποθηκεύονται σε **ΔΥΟ** μέρη που **δεν συγχρονίζονται**:

- **(Α) Profile-embedded** — μέσα στο `accounting_settings/{companyId}` (company profile). Είναι **core πεδία του discriminated union** `CompanyProfile` (`company.ts:117` partners, `:129` members, `:143` shareholders). **Γράφονται από το Setup form** (η ΜΟΝΗ ζωντανή write-UI).
- **(Β) Standalone singleton** — `accounting_settings/{companyId}__{partners|members|shareholders}` (μετά το ADR-439 Phase 2c· πρώην global). **Διαβάζονται από τα tax/EFKA engines.**

**Το bug:** η UI γράφει στο (Α), τα engines διαβάζουν από το (Β), τίποτα δεν συγχρονίζει. → Μέτοχοι/εταίροι που εισάγει ο χρήστης είναι **αόρατοι** στον φόρο ΑΕ + EFKA (διαβάζουν κενό singleton). Και τα δύο κενά τώρα → κανένα ορατό σύμπτωμα, αλλά λανθασμένο μόλις μπουν δεδομένα.

**Πώς προέκυψε:** φαίνεται μισο-τελειωμένη migration προς singleton — χτίστηκαν API routes + hooks + repo methods + τα engines άλλαξαν να διαβάζουν singleton, ΑΛΛΑ το Setup form ποτέ δεν συνδέθηκε να γράφει singleton (συνεχίζει στο profile), και η dedicated singleton-UI δεν υπάρχει.

> ⚠️ **Σχέση με ADR-439 Phase 2c**: Το Phase 2c έκανε per-tenant τα 6 accounting singletons (μηχανικά). Αν αυτό το task **αποσύρει** το partners/members/shareholders singleton (βλ. §2 Option A), τότε 3 από εκείνα τα singletons **καταργούνται** — δεν είναι σπατάλη, απλώς αφαιρούνται. Τα matching_config / service_presets / EFKA per-tenant μένουν ως έχουν.

---

## 2. 🚨 ΑΡΧΙΤΕΚΤΟΝΙΚΗ ΑΠΟΦΑΣΗ — SSoT: profile-embedded vs singleton

**Option A — PROFILE-EMBEDDED = SSoT (ΣΥΣΤΑΣΗ Opus, Revit-grade):**
- Τα partners/members/shareholders ζουν **μόνο** στο profile (όπως δηλώνει ο τύπος: AE *έχει* shareholders εξ ορισμού). Η Setup form ήδη γράφει εκεί.
- Τα **readers (tax/EFKA)** διαβάζουν από το profile μέσω **ΕΝΟΣ** accessor (π.χ. `repository.getShareholders()` που εσωτερικά διαβάζει `getCompanySetup()` με entityType-discrimination), όχι από ξεχωριστό doc.
- **Αποσύρεται** το dead singleton write-path: `/api/accounting/{partners,members,shareholders}` routes + `usePartners/useMembers/useShareholders` hooks (μηδέν consumers) + οι singleton `saveX` (ή redirect στο profile).
- **Pro**: ταιριάζει με το domain model (discriminated union), η ζωντανή write-UI ήδη εκεί, αφαιρεί dead code, ΕΝΑ doc. **Con**: οι readers πρέπει να χειριστούν entityType discrimination.

**Option B — SINGLETON = SSoT (ΑΠΟΡΡΙΠΤΕΤΑΙ):**
- Η Setup form πρέπει να γράφει στα singletons· αφαιρούνται τα πεδία από τον `CompanyProfile` τύπο.
- **Con**: σπάει το discriminated-union identity model· ο τύπος χάνει core πεδία· μεγαλύτερο/πιο επικίνδυνο refactor. Δεν αξίζει.

➡️ **ΣΥΣΤΑΣΗ: Option A.** Νέα συνεδρία → Plan Mode → confirm μέσω plan (η έγκριση plan = επιβεβαίωση Α), μετά υλοποίηση. (Memory feedback: «κάνε εσύ την enterprise/Revit απόφαση + ζήτα μόνο έγκριση plan».)

---

## 3. RECOGNITION MAP (file:line — ΕΓΙΝΕ, μην ξανα-ψάξεις)

### A) WRITE → profile-embedded (η ζωντανή write-UI)
- `components/setup/SetupPageContent.tsx:178` `saveSetup(formData)` (formData = CompanySetupInput **με** partners/members/shareholders). `handleEntityTypeChange:139-165` = αρχικοποίηση πεδίων ανά μορφή (ΟΧΙ stripping).
- `hooks/useCompanySetup.ts:81-110` `saveSetup` → `PUT /api/accounting/setup` με **όλο** το data (μηδέν strip).
- `app/api/accounting/setup/route.ts:164` `repository.saveCompanySetup(data)`.
- `repository/firestore-accounting-repository.ts:97-113` `saveCompanySetup` → γράφει **όλο** το `data` (incl. partners/members/shareholders) στο `accounting_settings/{companyId}` (μηδέν strip· stamps companyId + preserve createdAt).
- Setup sub-UI (γράφει σε formData→profile, ΟΧΙ singleton): `components/setup/ShareholderManagementSection.tsx`, `ShareholderRow.tsx` (+ αντίστοιχα partners/members sections).

### B) READ ← singleton (τα engines — εδώ είναι το mismatch)
- `services/accounting-service.ts:236` `getPartners()` · `:275` `getMembers()` · `:320` `getShareholders()` (calculateAETax) · `:369` `getPartnershipEfkaSummary` (→ getPartners).
- `services/accounting-efka-operations.ts:37` `getPartners()` · `:102` `getMembers()` · `:169` `getShareholders()`.
- `app/api/accounting/efka/summary/route.ts:56` → `service.getPartnershipEfkaSummary`.

### C) DEAD singleton write-path (μηδέν UI consumers — υποψήφιο για αφαίρεση)
- `app/api/accounting/partners/route.ts:62` GET `getPartners` · `:116` POST `savePartners`. Ομοίως `members/route.ts:65,122`, `shareholders/route.ts:90,153`.
- `hooks/usePartners.ts` (+ `useMembers`/`useShareholders`) — exported στο `hooks/index.ts`, **κανένα component δεν τα χρησιμοποιεί** (grep: μόνο το barrel).

### D) Singleton repo methods (Phase 2c — τώρα per-tenant composite)
- `repository/accounting-repo-entities.ts` `getPartners:23`/`savePartners:32`/`getMembers:66`/`saveMembers:75`/`getShareholders:109`/`saveShareholders:118` → `accountingDocId(tenant.companyId, …)`. (Αν Option A: αυτά γίνονται profile-readers ή αφαιρούνται.)
- `types/interfaces.ts` `getPartners/saveX` δηλώσεις.

### E) Profile readers ΓΙΑ identity (ΟΧΙ entity arrays — άσχετοι, μην τους σπάσεις)
- `invoices/forms/InvoiceForm.tsx:78,151` `buildIssuerSnapshot(profile)` (businessName/ΑΦΜ) · `invoices/details/InvoiceDetails.tsx:36` · `apy-certificates/CreateAPYCertificateDialog.tsx:84` — διαβάζουν `useCompanySetup().profile` για **issuer identity**, όχι partners/shareholders.

### F) Type
- `types/company.ts:117` (OE.partners) · `:129` (EPE.members) · `:143` (AE.shareholders) — core discriminated-union πεδία. **ΜΗΝ τα αφαιρέσεις** (Option A τα κρατά ως SSoT).

### G) Firestore rules
- `firestore.rules:3433` `accounting_settings/{docId}` = gate-by-body-companyId. Profile (bare {companyId}) ήδη καλύπτεται → **zero rules change** για Option A. Αν αφαιρεθούν singleton docs, καμία rule δεν χρειάζεται προσθήκη.

---

## 4. ΠΛΑΝΟ (Option A — Plan Mode → υλοποίηση)

### Βήμα 0 — Plan Mode + confirm Option A (μέσω plan)

### Βήμα Α — Ενοποίησε τους readers στο profile (SSoT)
- Κάνε τους `getPartners/getMembers/getShareholders` του repository να διαβάζουν από `getCompanySetup()` (profile) με entityType-discrimination: AE→`profile.shareholders`, OE→`profile.partners`, EPE→`profile.members`, αλλιώς `[]`. **ΕΝΑΣ** accessor = SSoT· οι callers (accounting-service, efka-operations) μένουν αμετάβλητοι (ίδιο interface).
- **ΠΡΟΣΟΧΗ semantics**: shareholders (ΑΕ) ≠ partners (ΟΕ) ≠ members (ΕΠΕ). Ο accessor επιστρέφει το σωστό array ανά entityType· για μη-ταιριαστή μορφή → `[]` (π.χ. getShareholders σε ΟΕ profile = []).

### Βήμα Β — Retire dead singleton write-path
- Αφαίρεσε `savePartners/saveMembers/saveShareholders` (ή κάνε τα no-op/throw) + τα `/api/accounting/{partners,members,shareholders}` POST handlers + `usePartners/useMembers/useShareholders` hooks (μηδέν consumers). GET handlers → είτε αφαίρεση είτε read-through στο profile accessor (αν κάποιο external τα χτυπά — ΕΛΕΓΞΕ πρώτα).
- Καθάρισε `interfaces.ts` δηλώσεις αναλόγως. **Dead-code ratchet (CHECK 3.22)**: μπορεί να χρειαστεί baseline update — δες `.deadcode-baseline.json`.

### Βήμα Γ — (προαιρετικό) future cleanup
- Αφαίρεση τυχόν orphan singleton docs `{companyId}__{partners|members|shareholders}` από Firestore (κενά τώρα· future, μη επείγον).

### Βήμα Δ — Tests
- Repository accessor: AE profile με shareholders → `getShareholders()` τα επιστρέφει· ΟΕ profile → `getShareholders()` = []· `getPartners()` από OE.partners κ.λπ.
- Regression: accounting-service tax/EFKA suites (calculateAETax, partnership EFKA) με profile-sourced data.
- Επιβεβαίωσε ότι τα 282/282 Phase 2c tests + accounting suites μένουν πράσινα (κάποια singleton tests ίσως αφαιρεθούν/αλλάξουν).

### 🚫 ΕΚΤΟΣ scope
- Τα service_presets / matching_config / EFKA config singletons (Phase 2c) — μένουν per-tenant ως έχουν (ΟΧΙ profile-embedded· δεν είναι identity).
- ADR-439 Phase 3 (provisioning/login) — ξεχωριστό.
- Διαγραφή legacy global docs (rollback-safety).

---

## 5. N.15 / ADR υποχρεώσεις (ίδιο commit με κώδικα)
- **ΝΕΟ ADR-440** (ή ADR-439 Phase 2d) — Context/Decision (Option A)/Consequences/Changelog.
- `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` — 1-2 γραμμές (τι εκκρεμεί).
- `adr-index.md` — μόνο αν καθαρό (shared tree).
- Memory: νέο `project_*` αρχείο + MEMORY.md pointer· link [[project_adr439_tenant_identity_ssot]].

## 6. ΤΙ ΝΑ ΜΗΝ ΚΑΝΕΙΣ
- ❌ commit/push (Giorgio). ❌ `git add -A` (shared tree· ΜΟΝΟ δικά σου).
- ❌ Αφαίρεση partners/members/shareholders από τον `CompanyProfile` τύπο (Option A τα κρατά ως SSoT· είναι core identity).
- ❌ Σπάσιμο των issuer-identity readers (InvoiceForm/InvoiceDetails/APY — διαβάζουν profile για businessName, όχι arrays).
- ❌ Blind αφαίρεση GET singleton routes χωρίς έλεγχο external callers.
- ❌ Να μπερδέψεις τη semantics: shareholders≠partners≠members ανά entityType.

---

## 7. ΚΑΤΑΣΤΑΣΗ ADR-439 Phase 2c (προηγούμενη δουλειά — έτοιμη, pending commit)
6 accounting singletons → per-tenant, 282/282 jest, tsc καθαρό, migration έτρεξε (no-op — μηδέν legacy data), matching_config browser-verified. 🔴 Εκκρεμεί ΜΟΝΟ ο commit του Giorgio (Phase 2a/2b+2c μαζί). Handoff: `HANDOFFS/HANDOFF_2026-06-10_ADR-439_Phase2c_accounting-singletons-per-tenant.md`.
