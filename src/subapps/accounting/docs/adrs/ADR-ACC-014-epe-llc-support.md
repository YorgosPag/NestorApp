# ADR-ACC-014: EPE LLC Support (Εταιρεία Περιορισμένης Ευθύνης)

**Status**: IMPLEMENTED
**Date**: 2026-02-12
**Author**: Claude Code (Anthropic AI) + Γιώργος Παγώνης

## Context

Το λογιστικό subapp υποστήριζε Ατομική Επιχείρηση (ADR-ACC-000) και ΟΕ (ADR-ACC-012). Ο τύπος `'epe'` υπήρχε ήδη στο `EntityType` αλλά χωρίς implementation. Η ΕΠΕ έχει θεμελιώδεις διαφορές στη φορολόγηση.

## Decision

Προστέθηκε πλήρης υποστήριξη ΕΠΕ ακολουθώντας το ίδιο discriminated union pattern.

## Βασικές Διαφορές ΕΠΕ

| | Ατομική | ΟΕ | ΕΠΕ |
|---|---|---|---|
| **Φορολόγηση** | Κλιμακωτή 9%-44% | Pass-through | **22% flat** |
| **Μερίσματα** | — | — | **5% φόρος** |
| **Προκαταβολή** | 55% | 55% | **80%** |
| **Τέλος Επιτηδ.** | 650€ | 1.000€ | **1.000€** |
| **Βιβλία** | Β' | Β'/Γ' | **Γ' ΥΠΟΧΡΕΩΤΙΚΑ** |
| **ΕΦΚΑ** | 1 πρόσωπο | Ανά εταίρο | **Μόνο διαχειριστές** |
| **ΓΕΜΗ** | Όχι | Προαιρετικό | **Υποχρεωτικό** |

## Architecture

### Type System
- `Member` interface (entity.ts): memberId, shares, dividendSharePercent, isManager, efkaConfig
- `MemberEFKAConfig` (entity.ts): Ίδια δομή με PartnerEFKAConfig
- `EPECompanyProfile` extends CompanyProfileBase: gemiNumber (required), members[], shareCapital
- `CompanyProfile` union: + EPECompanyProfile
- `EPESetupInput`: Omit<EPECompanyProfile, timestamps>
- `isLlc()` type guard (entity-guards.ts)

### Tax Types (tax.ts)
- `CorporateTaxResult`: 22% flat, 80% prepayment, professionalTax
- `MemberDividendResult`: per-member 5% dividend tax
- `EPETaxResult`: corporateTax + dividends + retainedEarnings

### EFKA Types (efka.ts)
- `ManagerEFKASummary`: per-manager EFKA summary
- `EPEEFKASummary`: managers-only totals

### Tax Engine (tax-engine.ts)
- `calculateCorporateTax()`: 22% flat, 80% prepayment, per-member dividends 5%
- Fixed `estimateTax()`: entity-aware professional tax (was hardcoded 650)

### Tax Config (tax-config.ts)
- `getCorporateTaxRate()`: 22%
- `getDividendTaxRate()`: 5%
- `getPrepaymentRateForEntity()`: sole=55%, oe=55%, epe=80%, ae=80%

### Service (accounting-service.ts)
- `calculateEPETax(fiscalYear)`: orchestrate income/expenses + EFKA managers + corporate tax
- `getEPEEfkaSummary(year)`: filter isManager=true members, calculate per-manager

### Repository (interfaces.ts + firestore-accounting-repository.ts)
- `getMembers()` / `saveMembers()`: Firestore `accounting_settings/members`
- `getMemberEFKAPayments()`: reuses partnerId field in EFKA payments collection

### API Routes
- `POST/PUT /api/accounting/setup`: EPE branch, force bookCategory='double_entry'
- `GET/PUT /api/accounting/members`: CRUD for EPE members (validation: dividendSharePercent sum=100%)
- `GET /api/accounting/tax/estimate`: EPE corporate tax path
- `GET /api/accounting/tax/dashboard`: EPE corporate tax dispatch
- `GET /api/accounting/efka/summary`: EPE managers-only path

### UI Components
- `EntityTypeSelector`: EPE option enabled (removed disabled)
- `MemberRow`: shares, nominal value, capital, manager toggle, EFKA (managers only)
- `MemberManagementSection`: ΓΕΜΗ required, share capital, members list, validation
- `CorporateTaxBreakdown`: 22% flat display, dividends 5%, per-member breakdown
- `SetupPageContent`: handleEntityTypeChange for EPE, force double_entry

### i18n
- el/en accounting.json: members section, corporateTax section, EPE label updated

## Files Changed

### New Files (5)
1. `src/app/api/accounting/members/route.ts`
2. `src/subapps/accounting/components/setup/MemberRow.tsx`
3. `src/subapps/accounting/components/setup/MemberManagementSection.tsx`
4. `src/subapps/accounting/components/tax/CorporateTaxBreakdown.tsx`
5. `src/subapps/accounting/docs/adrs/ADR-ACC-014-epe-llc-support.md`

### Modified Files (16)
1. `src/subapps/accounting/types/entity.ts` — Member, MemberEFKAConfig
2. `src/subapps/accounting/types/company.ts` — EPECompanyProfile, EPESetupInput
3. `src/subapps/accounting/types/tax.ts` — CorporateTaxResult, MemberDividendResult, EPETaxResult
4. `src/subapps/accounting/types/efka.ts` — ManagerEFKASummary, EPEEFKASummary
5. `src/subapps/accounting/types/interfaces.ts` — getMembers, saveMembers, getMemberEFKAPayments
6. `src/subapps/accounting/types/index.ts` — barrel exports
7. `src/subapps/accounting/utils/entity-guards.ts` — isLlc()
8. `src/subapps/accounting/services/config/tax-config.ts` — corporate/dividend/prepayment config
9. `src/subapps/accounting/services/engines/tax-engine.ts` — calculateCorporateTax, fix estimateTax
10. `src/subapps/accounting/services/accounting-service.ts` — calculateEPETax, getEPEEfkaSummary
11. `src/subapps/accounting/services/repository/firestore-accounting-repository.ts` — member CRUD
12. `src/app/api/accounting/setup/route.ts` — EPE branch
13. `src/app/api/accounting/tax/estimate/route.ts` — EPE path
14. `src/app/api/accounting/tax/dashboard/route.ts` — EPE dispatch + fix professionalTax
15. `src/app/api/accounting/efka/summary/route.ts` — EPE managers path
16. `src/subapps/accounting/components/setup/EntityTypeSelector.tsx` — enable EPE
17. `src/subapps/accounting/components/setup/SetupPageContent.tsx` — EPE handling
18. `src/i18n/locales/el/accounting.json` — EPE translations
19. `src/i18n/locales/en/accounting.json` — EPE translations

## Backward Compatibility

- Existing `sole_proprietor` and `oe` data untouched
- `CompanyProfile` union extended (additive change)
- Repository defaults: getMembers() returns [] if no doc exists
- No migration needed for existing Firestore documents

## AE Reuse (2026-02-12)

Η ΑΕ (Ανώνυμη Εταιρεία) μοιράζεται **ίδια φορολόγηση** με ΕΠΕ:
- `calculateCorporateTax()` generalized: `entityType: EntityType = 'epe'` — backward compatible
- `CorporateTaxResult` reused by both EPE and AE
- `CorporateTaxBreakdown` UI component shared
- Βλ. ADR-ACC-015/016/017 για ΑΕ-specific implementation (shareholders, board, EFKA dual-mode)
