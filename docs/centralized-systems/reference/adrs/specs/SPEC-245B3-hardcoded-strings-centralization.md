# SPEC-245B3: Hardcoded Strings Centralization

> **Parent ADR**: ADR-245 (API Routes & String Centralization)
> **Status**: ✅ IMPLEMENTED
> **Date**: 2026-03-19
> **Scope**: Document IDs, Field Names, Entity Status Values

---

## Summary

Καθολική κεντρικοποίηση hardcoded strings σε 3 φάσεις:

### Phase A: Document IDs → SYSTEM_DOCS

**8 νέα entries** στο `SYSTEM_DOCS` registry (`src/config/firestore-collections.ts`):

| Constant | Value | Collection |
|----------|-------|------------|
| `SYSTEM_SETTINGS` | `settings` | system |
| `AI_TOOL_ANALYTICS` | `ai_tool_analytics` | settings |
| `ACCT_COMPANY_PROFILE` | `company_profile` | accounting_settings |
| `ACCT_PARTNERS` | `partners` | accounting_settings |
| `ACCT_MEMBERS` | `members` | accounting_settings |
| `ACCT_SHAREHOLDERS` | `shareholders` | accounting_settings |
| `ACCT_SERVICE_PRESETS` | `service_presets` | accounting_settings |
| `ACCT_EFKA_USER_CONFIG` | `user_config` | accounting_efka_config |

**19 αντικαταστάσεις** σε 7 αρχεία.

### Phase B: Field Names → FIELDS

**Νέο αρχείο**: `src/config/firestore-field-constants.ts`

14 field name constants:
`COMPANY_ID`, `STATUS`, `BUILDING_ID`, `PROJECT_ID`, `CONTACT_ID`, `UNIT_ID`, `FLOOR_ID`, `ENTITY_TYPE`, `ENTITY_ID`, `TYPE`, `CREATED_BY`, `CREATED_AT`, `UPDATED_AT`, `IS_DELETED`

**~200+ αντικαταστάσεις** σε ~60 αρχεία — covers ~80% of all `.where()`/`.orderBy()` calls.

### Phase C: Status Values → Constants

**Νέο αρχείο**: `src/constants/entity-status-values.ts`

3 status domains:
- `ENTITY_STATUS`: ACTIVE, INACTIVE, ARCHIVED, SUSPENDED
- `PROJECT_STATUS`: ACTIVE, ARCHIVED, COMPLETED, SUSPENDED, CONSTRUCTION
- `QUEUE_STATUS`: PENDING, PROCESSING, COMPLETED, FAILED, DEAD_LETTER

**~50 αντικαταστάσεις** σε ~12 αρχεία.

---

## Files Created

1. `src/config/firestore-field-constants.ts` — Field name registry
2. `src/constants/entity-status-values.ts` — Status value registry

## Files Modified

- `src/config/firestore-collections.ts` — +8 SYSTEM_DOCS entries
- ~70 service/API files — replaced hardcoded strings with constants

## Changelog

| Date | Change |
|------|--------|
| 2026-03-19 | Initial implementation — Phases A+B+C |
