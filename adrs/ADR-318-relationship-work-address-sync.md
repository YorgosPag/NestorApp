# ADR-318: Relationship Work Address Sync — Auto-copy Company Address to Individual

**Status**: Implemented
**Date**: 2026-04-23
**Category**: Contacts / Relationships / Address Management

## Context

When a professional relationship (employment, ownership) is created between an `individual` contact and a `company`/`service` contact, the individual's work address is typically the company's address. Previously this had to be entered manually, creating data redundancy and potential inconsistency.

## Decision

After any employment or ownership relationship is saved via `useRelationshipForm`, a fire-and-forget side effect copies the company's primary address into the individual's `individualAddresses` array as `type: 'work'`.

**Trigger types** (from `EMPLOYMENT_RELATIONSHIP_TYPES` + `OWNERSHIP_RELATIONSHIP_TYPES`):
- Employment: `employee`, `manager`, `director`, `executive`, `intern`, `contractor`, `civil_servant`, `department_head`, `ministry_official`
- Ownership: `shareholder`, `board_member`, `chairman`, `ceo`, `partner`

**Conditions**:
- One contact must be `individual`, the other `company` or `service`
- Company must have at least one address in `addresses[0]`
- No-op if company has no address data

**Upsert semantics**: If the individual already has a `type: 'work'` entry in `individualAddresses`, it is replaced. No duplicates.

## Architecture

### New Service
- **Path**: `src/services/contact-relationships/work-address-sync.service.ts`
- **Export**: `syncWorkAddressOnRelationship(relationship: Partial<ContactRelationship>): Promise<void>`
- **Pattern**: Fire-and-forget — caller catches errors independently (non-critical side effect)
- **Storage**: Direct `updateDoc` on `contacts/{individualId}` with `{ individualAddresses: [...] }`

### Hook Integration
- **Path**: `src/components/contacts/relationships/hooks/useRelationshipForm.ts`
- **Trigger point**: After `createRelationshipWithPolicy` / `updateRelationshipWithPolicy` succeeds
- **Error handling**: `logger.warn` — never surfaces to user, never blocks relationship save

## Data Flow

```
useRelationshipForm.handleSubmit
  → createRelationshipWithPolicy (awaited)
  → syncWorkAddressOnRelationship (fire-and-forget)
      → getContact(sourceId) + getContact(targetId) in parallel
      → identify individual + company from types
      → read company.addresses[0]
      → upsert individualAddresses[type='work']
      → updateDoc(contacts/{individualId}, { individualAddresses })
```

## Google-level checklist

| # | Question | Answer |
|---|----------|--------|
| 1 | Proactive or reactive? | Proactive — runs at the right lifecycle moment (post-save) |
| 2 | Race condition possible? | No — sequential: relationship saved → then sync |
| 3 | Idempotent? | Yes — upsert, calling twice = same result |
| 4 | Belt-and-suspenders? | Yes — fire-and-forget with warn log, relationship save unaffected |
| 5 | SSoT? | Yes — one service owns the sync logic |
| 6 | Fire-and-forget or await? | Fire-and-forget — non-critical side effect |
| 7 | Who owns lifecycle? | `WorkAddressSyncService.syncWorkAddressOnRelationship` |

## Changelog

| Date | Author | Change |
|------|--------|--------|
| 2026-04-23 | Giorgio Pagonis | Initial implementation |
