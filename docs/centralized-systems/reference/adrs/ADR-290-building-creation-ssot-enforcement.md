# ADR-290: Building Creation SSoT Enforcement

**Status**: Accepted
**Date**: 2026-04-05
**Related**: ADR-233 (Entity Coding System), ADR-238 (Entity Creation Centralization), ADR-284 (Building Creation Policy), ADR-017 (Enterprise ID Generation)

## Context

Η συλλογή `buildings` υποτίθεται ότι ακολουθεί την SSoT οντοτήτων από το
ADR-238: κάθε εγγραφή πρέπει να περνά από το `createEntity('building', …)` στο
`src/lib/firestore/entity-creation.service.ts`, ώστε να κερδίζει αυτόματα τα
common fields (audit, `linkedCompanyId`, `companyId`, server timestamps,
`createdBy`), την τεκμηριωμένη audit trail (`logAuditEvent`) και την ενιαία
συμπεριφορά με τα υπόλοιπα entity types (floor, unit, storage, parking).

Στον τρέχοντα κώδικα η δημιουργία κτιρίου γίνεται από **τρία** σημεία και
**δύο** από αυτά παρακάμπτουν το `createEntity()`:

| Σημείο | File | SSoT | ADR-233 `code` |
|--------|------|:---:|:---:|
| UI κανονική ροή (AddBuildingDialog) | `src/components/building-management/hooks/useBuildingForm.ts` → POST `/api/buildings` | ✅ | ✅ user-editable + `suggestNextBuildingCode()` |
| UI inline create (GeneralTab) | `src/components/building-management/tabs/GeneralTabContent.tsx` → POST `/api/buildings` | ✅ | ❌ λείπει `code` από το payload |
| Admin bulk (seed / populate) | `src/server/admin/building-instantiation-handler.ts` → άμεσο `.set()` | ❌ παράκαμψη | ❌ `BuildingPayload` δεν έχει `code` field |

### Το πρόβλημα

1. **`building-instantiation-handler.ts`** (χρησιμοποιείται από `POST /api/buildings/seed`
   και `POST /api/buildings/populate`) καλεί `buildingsCollection.doc(buildingId).set(buildingData)`
   απευθείας. Αυτό παρακάμπτει:
   - `linkedCompanyId: null` (ADR-238 common field)
   - Πραγματικό `createdBy = ctx.uid` — το handler περνά hardcoded string
     (`"seed-operation"` / `"populate-operation"`) αντί για τον admin uid.
   - `logAuditEvent('data_created', …)` στο Firestore audit trail (ο τοπικός
     `audit()` helper γράφει μόνο console logs).
   - Το server-side uniqueness check του ADR-233 §3.4 στο route handler, καθώς
     δεν περνά από το `/api/buildings` POST.
   - Αυτόματη `projectId` propagation από το parent project doc.

2. **`GeneralTabContent.tsx`** στέλνει create payload **χωρίς `code`** ενώ το
   `CreateBuildingSchema` στο route απαιτεί `code: z.string().min(1)`. Αυτή η
   ροή αποτυγχάνει με 400 validation error (ή, με το `.passthrough()` του
   schema, περνά κτίριο χωρίς `code` — silent ADR-233 violation).

3. Δύο admin break-glass endpoints (`create-clean-projects`,
   `migrate-enterprise-ids`) επίσης γράφουν απευθείας με `.set()`, αλλά είναι
   super_admin-only tools (dev seeding / ID migration) και τεκμηριώνονται ως
   known exceptions.

## Decision

Καθιερώνεται ρητά ότι το **`createEntity('building', …)` είναι το μοναδικό
entry point για Firestore writes στη συλλογή `buildings`** σε όλες τις ροές
εφαρμογής (UI + admin bulk). Η δήλωση αυτή ευθυγραμμίζει το building creation
με την SSoT που ήδη καθόρισαν τα ADR-238 (όλες οι entity types) και ADR-286
(DXF levels).

### Allegedly single source of truth (αλλαγές)

**1) `src/server/admin/building-instantiation-handler.ts`** — refactor από
άμεσο `.set()` σε `createEntity('building', …)`:

- Εισάγεται adapter `buildAuthContextFromAdmin(adminContext)` που μετατρέπει
  τον `AdminContext` (admin-guards) σε `AuthContext` (auth types) ώστε να
  περνάει στο `createEntity()`. Ο admin χρησιμοποιεί `globalRole: 'super_admin'`.
- Το field `code` γίνεται server-side derived: αν ο template δεν περιέχει
  `code`, καλείται νέος helper `fetchBuildingCodesForProject(db, projectId)`
  (Admin SDK query στη `buildings` collection φιλτραρισμένη με `projectId`)
  και `suggestNextBuildingCode(existingCodes)` για κάθε νέο κτίριο.
- Τα template-specific fields (`sourceTemplateId`, `sourceTemplateKey`,
  `operationId`, `company` string, `legalInfo` / `technicalSpecs` /
  `financialData`) περνούν ως `entitySpecificFields` στο `createEntity()`.
- Τα manual common fields (`createdAt`, `updatedAt`, `companyId`) αφαιρούνται
  — παρέχονται αυτόματα από το service.
- Το idempotency check `buildingExistsForTemplate()` διατηρείται **πριν** την
  κλήση του `createEntity()`.
- Το local `BuildingDocument` interface διαγράφεται (μαζί με τον manual
  `createBuildingDocument()` helper) — ο κώδικας γίνεται ένα inline payload
  build μέσα στο loop.

**2) `src/services/admin-building-templates.service.ts`** — το
`BuildingPayload` interface αποκτά προαιρετικό πεδίο `code?: string`, ώστε οι
admin templates να μπορούν (προαιρετικά) να ορίζουν explicit code αντί για
auto-generation.

**3) `src/components/building-management/tabs/GeneralTabContent.tsx`** —
πριν την κλήση του `createBuildingWithPolicy()`, καλείται
`getBuildingCodesByProject(projectId)` + `suggestNextBuildingCode()` για να
συμπληρωθεί το `code` field στο payload. Η ροή ευθυγραμμίζεται με την ήδη
σωστή ροή του `AddBuildingDialog` (useBuildingForm.ts).

### Known exceptions (documented)

Οι ακόλουθες ροές παραμένουν με άμεσο `.set()` ως προσωρινές εξαιρέσεις,
τεκμηριώνονται εδώ για ιχνηλασιμότητα:

- `src/app/api/admin/create-clean-projects/route.ts` — super_admin dev
  seeding tool, δεν τρέχει σε production user flow.
- `src/app/api/admin/migrate-enterprise-ids/route.ts` — ID migration
  break-glass tool, μία φορά ανά migration batch.

Σε μελλοντικό ADR θα μεταφερθούν και αυτές στο `createEntity()` εφόσον γίνει
αναβάθμιση του service ώστε να δέχεται externally-generated IDs (migration
scenarios).

## Consequences

### Θετικές

- **Ενιαία συμπεριφορά** για όλες τις ροές building creation (UI + admin).
- **Audit trail πλήρες**: κάθε δημιουργία κτιρίου (ακόμα και από admin bulk)
  γράφει `data_created` entry στο Firestore audit log με τον πραγματικό
  admin uid.
- **ADR-238 common fields** (`linkedCompanyId`, `companyId`, server
  timestamps) παρέχονται από ένα σημείο — καμία διαφορά ανά ροή.
- **ADR-233 `code` compliance παντού**: κανένα κτίριο δεν γράφεται πλέον
  χωρίς `code`. Ο server-side uniqueness check (per-project) τρέχει στο
  canonical route, και ο auto-generation fallback χρησιμοποιεί την ίδια
  `suggestNextBuildingCode()` utility που χρησιμοποιεί το AddBuildingDialog.
- **Λιγότερος κώδικας**: ~70 γραμμές manual payload build στον admin handler
  αντικαθίστανται από μία κλήση `createEntity()`.

### Ρίσκα / trade-offs

- Η admin seed/populate ροή **αλλάζει shape**: τα νέα documents θα έχουν
  `linkedCompanyId: null` και audit entries που πριν έλειπαν. Υπάρχοντα
  documents (που δημιουργήθηκαν από seed πριν το refactor) δεν μεταναστεύουν
  — η διαφορά είναι αποδεκτή, τα νέα docs είναι strictly ADR-compliant.
- Το `AdminContext → AuthContext` adapter χρειάζεται `email` και
  `mfaEnrolled` (τα οποία υπάρχουν στο `AdminContext`). Αν μελλοντικά
  αλλάξει το `AuthContext` shape, ο adapter πρέπει να ενημερωθεί.
- Η auto-generation του `code` στον admin handler κάνει έναν extra read
  ανά template (fetch existing codes per project). Acceptable: admin seed
  flows τρέχουν σπάνια και με μικρό αριθμό templates (1–10).

## Implementation Notes

**Files modified:**
- `src/server/admin/building-instantiation-handler.ts` — major refactor
- `src/services/admin-building-templates.service.ts` — add `code?: string`
- `src/components/building-management/tabs/GeneralTabContent.tsx` — fix
  payload to include auto-suggested `code`
- `docs/centralized-systems/reference/adrs/ADR-290-building-creation-ssot-enforcement.md` (new)
- `docs/centralized-systems/reference/adr-index.md` (regenerated)

**Reused utilities:**
- `createEntity()` — `src/lib/firestore/entity-creation.service.ts`
- `suggestNextBuildingCode()` — `src/config/entity-code-config.ts`
- `getBuildingCodesByProject()` — `src/components/building-management/building-services.ts` (client)
- `buildingExistsForTemplate()` / `getExistingBuildingId()` — `src/services/admin-building-templates.service.ts` (idempotency)
- `generateBuildingId()` — `src/services/enterprise-id.service.ts` (invoked internally by `createEntity`)

**Verification:**
- TypeScript: `npx tsc --noEmit` (background).
- Manual:
  - UI κανονική ροή (AddBuildingDialog) δημιουργεί κτίριο → έλεγχος
    `code`, `linkedCompanyId`, audit entry.
  - UI inline ροή (GeneralTab) δημιουργεί κτίριο με auto `code`.
  - `POST /api/buildings/seed` (super_admin) δημιουργεί κτίρια με
    `linkedCompanyId: null`, πραγματικό `createdBy = adminContext.uid`,
    audit entries στο Firestore.
  - Uniqueness: `code = "Κτήριο Α"` σε project που ήδη το έχει → 409.
  - Idempotent seed: δεύτερο call → όλα `skipped`.

## Changelog

- **2026-04-05**: Accepted — initial refactor του
  `building-instantiation-handler` σε `createEntity()` + fix του
  `GeneralTabContent` για `code` field.
