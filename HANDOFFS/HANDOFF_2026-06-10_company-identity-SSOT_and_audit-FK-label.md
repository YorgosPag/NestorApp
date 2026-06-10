# HANDOFF — 2026-06-10 — Company Identity SSOT (#2) + Audit FK id+label (#1)

- **Date**: 2026-06-10
- **Author**: Opus 4.8 (έλεγχος DB/Storage session)
- **Status**: 🔴 PENDING IMPLEMENTATION — recognition ΕΓΙΝΕ, κώδικας ΟΧΙ ακόμα
- **Γλώσσα απάντησης**: Ελληνικά (ΠΑΝΤΑ — CLAUDE.md LANGUAGE RULE)
- **Στόχος ποιότητας**: FULL ENTERPRISE + FULL SSOT, Revit-grade. ΟΧΙ μπακάλικο.

---

## 0. ΚΡΙΣΙΜΑ CONSTRAINTS (διάβασέ τα ΠΡΩΤΑ)

- 🔴 **COMMIT τον κάνει ο Giorgio, ΟΧΙ εσύ** (N.(-1)). Μην κάνεις commit/push ποτέ.
- 🔴 **Shared working tree με άλλον agent** → `git add` **ΜΟΝΟ τα δικά σου αρχεία**, **ΠΟΤΕ `git add -A`**. Το tree περιέχει ήδη ADR-437 (space-separator) + ADR-436 (foundation) + boiler δουλειά άλλων agents.
- **ADR-driven workflow** (N.0.1): code = source of truth. Διάβασε κώδικα → ενημέρωσε ADR → υλοποίησε → ξανα-ενημέρωσε ADR. Ίδιο commit.
- **N.8 execution mode**: το #2 είναι πιθανώς orchestrator-scale (auth/onboarding + company + accounting domains, 5+ αρχεία). ΡΩΤΑ τον Giorgio πριν orchestrator.
- **N.17 single-tsc**: πριν τρέξεις `tsc`, έλεγξε ότι δεν τρέχει άλλος. ΕΝΑ tsc τη φορά.
- **Firebase project**: `pagonis-87766` (live). Tenant: `comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757`.

---

## 1. ΠΛΑΙΣΙΟ — Τι έγινε σε αυτή τη συνεδρία

Ο Giorgio άδειασε τη DB (κράτησε 9 protected collections) + Storage (κράτησε `bim-mesh-library/`), και ζήτησε **baseline → εγγραφές → diff**.

**Baseline/after αρχεία (root):**
- `C:\Nestor_Pagonis\local_db_storage_baseline_2026-06-10.json`
- `C:\Nestor_Pagonis\local_db_storage_AFTER_2026-06-10.json`

Ο Giorgio δημιούργησε χειροκίνητα: contact(νομικό πρόσωπο ALFA) → company → project(ΕΡΓΟ 1) → building(Κτήριο Α) → 2 floors → property(Μεζονέτα 140τμ, 2 ορόφων).

**Diff = 10 νέες collections, 22 νέα docs, μηδέν garbage.** Ο πυρήνας είναι enterprise (enterprise IDs παντού, tenant isolation, audit trail, CQRS search_documents, σωστό multi-level μοντέλο μεζονέτας).

**4 ευρήματα ποιότητας** — τα 2 actionable:

| # | Εύρημα | Κρίση |
|---|--------|-------|
| **#1** | Audit trail: FK fields (`projectId`/`buildingId`/`linkedCompanyId`) κρατούν **ΟΝΟΜΑΤΑ** αντί IDs στα `changes[].newValue` | ADR-195 **by-design** (denormalization), αλλά **lossy** — καταστρέφει το canonical id. Fix = additive labels. **ENTERPRISE-correct.** |
| **#2** | `companies/{id}.name = "Georgios Pagonis"` (user displayName fallback) αντί νομικού ονόματος | Σύμπτωμα. Ρίζα = **company identity σκορπισμένη σε 3 SSOT** + reactive creation. |
| #3 | Μεζονέτα: 2ος όροφος `levelData` όλα μηδέν | data-entry, όχι bug. SKIP. |
| #4 | `dxf_viewer_levels` default level `floorId:null` | αναμενόμενο. SKIP. |

> ⚠️ Νωρίτερα στη συνεδρία το #1 παρουσιάστηκε ως «bug» — **διόρθωση**: είναι σκόπιμη ADR-195 πολιτική. Το fix είναι **enhancement** (id canonical + label), όχι bugfix.

---

## 2. FIX #1 — Audit: κράτα canonical id + πρόσθεσε value-label (ENTERPRISE, ΕΤΟΙΜΟ)

**Pattern**: SAP/event-sourcing audit → immutable canonical reference + denormalized display snapshot. Σήμερα το όνομα **πατάει** το id· πρέπει να συνυπάρχουν.

### Recognition map (ΕΓΙΝΕ — μην ξανα-ψάξεις):
- **`src/services/entity-audit.service.ts`**
  - `recordChange()` (≈145-190): απλός writer, γράφει `changes` ως έχουν στο `entity_audit_trail`. ΔΕΝ κάνει transformation.
  - `diffFieldsWithResolution()` (≈221-249): **ΕΔΩ η humanization** — μετά το `diffFields`, για κάθε change με resolver, **overwrites** `oldValue`/`newValue` με το resolved όνομα (το id χάνεται).
- **`src/types/audit-trail.ts`** (≈122-143): `AuditFieldChange` = `field`, `oldValue`, `newValue`, `label?` (το `label`=όνομα ΠΕΔΙΟΥ, ΟΧΙ τιμής). **Δεν υπάρχει** `newValueLabel`/`oldValueLabel`.
- **`src/lib/firestore/entity-creation.service.ts`** (≈341): `createEntity` → καλεί `diffFieldsWithResolution` όταν δοθούν `auditFieldResolvers` (building/floor/property path).
- Resolvers ορίζονται στα routes:
  - Building: `src/app/api/buildings/route.ts` (≈251-265) — resolver `projectId`→`projects/{id}.name`.
  - Floor: `src/app/api/floors/floors.handlers.ts` (≈180-190) — resolvers `buildingId`+`projectId`.
  - Property: `src/app/api/properties/create/route.ts` (≈190-201) — resolvers `buildingId`+`projectId`.
- **`src/app/api/projects/list/project-create.handler.ts`** (≈159-194, ιδίως 159-165): **manual** overwrite — `auditBody.linkedCompanyId = linkedCompanyName` ΠΡΙΝ το `diffFields` (διαφορετικό μονοπάτι, ίδιο αποτέλεσμα).
- ADR: **`docs/centralized-systems/reference/adrs/ADR-195-entity-audit-trail.md`** (APPROVED).

### Plan #1 (additive, μη-breaking):
1. `src/types/audit-trail.ts` → **+`newValueLabel?: string|null`, `oldValueLabel?: string|null`** στο `AuditFieldChange`.
2. `src/services/entity-audit.service.ts` `diffFieldsWithResolution` → resolved όνομα στο `*Label`, **το raw id ΜΕΝΕΙ** στο `oldValue`/`newValue`.
3. `src/app/api/projects/list/project-create.handler.ts` → σταμάτα το manual overwrite· χρησιμοποίησε resolver/label (ευθυγράμμιση με τα άλλα 3).
4. **Audit-display UI reader** → δείξε `*Label` αν υπάρχει, αλλιώς `value`. (TODO: εντόπισε τον reader — ψάξε consumers του `AuditFieldChange`/`entity_audit_trail`/`useEntityAudit`.)
5. **ADR-195 amendment** + changelog (πολιτική: «id canonical + denormalized label», όχι «name in value»).
6. **CHECK 3.17** (entity-audit baseline `.entity-audit-coverage-baseline.json`) — additive field, επιβεβαίωσε ότι δεν σπάει pre-commit.
- Scope: ~5-6 αρχεία. Tests: ενημέρωσε/πρόσθεσε για `diffFieldsWithResolution`.

---

## 3. FIX #2 — Company Identity SSOT (ΧΡΕΙΑΖΕΤΑΙ RECOGNITION ΠΡΩΤΑ)

### Γιατί το αρχικό μου plan ήταν ΜΠΑΚΑΛΙΚΟ (μην το επαναλάβεις):
«Διάβασε `accounting_settings/company_profile.businessName`» = hack:
- Global doc **χωρίς `companyId`** → σπάει multi-tenant isolation (2η εταιρεία → λάθος όνομα).
- Διορθώνει σύμπτωμα, όχι ρίζα.

### Η ρίζα (3 SSOT για 1 ταυτότητα = καμία):
- `companies/{id}.name` (tenant workspace — fallback displayName)
- `accounting_settings/company_profile.businessName` (global, ΑΦΜ/ΔΟΥ)
- `contacts` type=company (clients· ο tenant ΔΕΝ έχει δικό του link σήμερα — `companies/{id}.contactId = null`)

Επίσης **reactive** creation: το `companies/{id}` φτιάχνεται ως side-effect σε session/audit (`ensureCompanyDocument`) με fallback, αντί **proactive** στο onboarding με πραγματικό όνομα (N.7.2 #1).

### Enterprise κατεύθυνση (ΠΡΟΣ ΕΠΙΒΕΒΑΙΩΣΗ μετά το recognition):
1. **Μία per-tenant SSOT**: `companies/{id}.contactId` → contact type=company = η **δική του** νομική οντότητα (legalName/tradeName/ΑΦΜ/ΔΟΥ), ίδιο μοτίβο με clients.
2. **Proactive**: όνομα γράφεται στο onboarding/registration, όχι reactive fallback.
3. `ensureCompanyDocument` = μόνο safety-net που διαβάζει το per-tenant SSOT (contact via `contactId`), ποτέ global doc.
4. `accounting_settings/company_profile` → per-tenant ή consumer του ίδιου SSOT.

### Recognition TODO (read-only ΠΡΙΝ plan):
- `src/services/company-document.service.ts` — `ensureCompanyDocument` (callers: `src/app/api/auth/session/route.ts:124`, `src/app/api/admin/bootstrap-company/route.ts:129`, `src/lib/auth/audit-core.ts:169`).
- `src/services/company/company-name-resolver.ts` — `resolveCompanyDisplayName` (priority: name→companyName→tradeName→legalName→displayName→fallback). **Ήδη υποστηρίζει legalName** — απλώς δεν τροφοδοτείται.
- **Onboarding/registration flow**: `src/app/api/auth/complete-registration/route.ts`, `src/services/onboarding/onboarding-state-service.ts`, `src/app/api/projects/bootstrap/bootstrap-queries.ts` — **πώς/πότε δημιουργείται ο tenant + αν υπάρχει tenant→contact link**.
- `accounting_settings/company_profile` schema + scope (global vs per-tenant).
- ADRs: **ADR-210** (company materialization Phase 3), ADR-312 (company-name-resolver). Πιθανό **νέο ADR** για «Tenant Identity SSOT» (επόμενο ελεύθερο: **ADR-438**, ΑΠΟΦΥΓΕ ADR-145).
- **Δεδομένα tenant**: `comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757`· νομικό όνομα `ΠΑΓΩΝΗΣ Ενεργειακή Κατασκευαστική Α.Ε.`· ΑΦΜ `801832652`· ΔΟΥ `ΦΑΕ Θεσσαλονίκης`.

---

## 4. ΕΠΟΜΕΝΑ ΒΗΜΑΤΑ (σειρά)

1. **#1 πρώτα** (έτοιμο, enterprise): υλοποίησε το Plan #1 (5-6 αρχεία) + tests + ADR-195 amend. ΜΗΝ commit.
2. **#2 μετά**: recognition onboarding/tenant-identity → φέρε **σωστό** enterprise plan στον Giorgio → έγκριση (N.8: πιθανό orchestrator) → υλοποίηση.
3. Ενημέρωσε `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + ADRs + adr-index (N.15) στο ίδιο context.
4. Παρέδωσε λίστα δικών σου αρχείων για να κάνει **ο Giorgio** το commit (git add ΜΟΝΟ δικά σου).

## 5. ΤΙ ΝΑ ΜΗΝ ΚΑΝΕΙΣ
- ❌ `git commit` / `git push` (ο Giorgio).
- ❌ `git add -A` (shared tree).
- ❌ Το μπακάλικο #2 (global `company_profile` ως πηγή).
- ❌ Να πατήσεις το raw id στο audit (το #1 είναι ΑΚΡΙΒΩΣ να το αποφύγεις).
- ❌ Να μπερδέψεις το contact ALFA (client) με τη νομική οντότητα του tenant.
