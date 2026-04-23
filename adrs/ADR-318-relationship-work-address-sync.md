# ADR-318: Live Derivation of Work Address from Professional Relationships

**Status**: Implemented
**Date**: 2026-04-23
**Category**: Contacts / Relationships / Address Management

## Context

When a professional relationship (employment, ownership) is created between an `individual` contact and a `company`/`service` contact, the individual's work address is typically the company's address. The Διευθύνσεις tab of the individual should display this work address automatically.

Earlier approaches (on-save copy, retroactive sync) violated SSoT: the relationship is already the source of truth. Copying company address to the individual's `individualAddresses` creates two places holding the same data, with all the sync hazards (stale copies, orphaned entries when company address changes, race conditions when company data is updated).

## Decision

**Live derivation** — no data copy, no Firestore writes. When the individual's Διευθύνσεις tab renders, it loads the individual's relationships on demand, picks the employment/ownership ones, fetches each linked company's primary address, and renders read-only work-address cards under the editable `IndividualAddressesSection`. SSoT: the relationship + company address remain the single truth; the tab is a view.

**Trigger types** (from `EMPLOYMENT_RELATIONSHIP_TYPES` + `OWNERSHIP_RELATIONSHIP_TYPES`):
- Employment: `employee`, `manager`, `director`, `executive`, `intern`, `contractor`, `civil_servant`, `department_head`, `ministry_official`
- Ownership: `shareholder`, `board_member`, `chairman`, `ceo`, `partner`

**Conditions**:
- One contact must be `individual`, the other `company` or `service`
- Company must have `addresses[0]` populated
- Derived cards are read-only — user edits the company address at its source

## Architecture

### New Hook
- **Path**: `src/components/contacts/relationships/hooks/useDerivedWorkAddresses.ts`
- **Signature**: `useDerivedWorkAddresses(individualId): { derived: DerivedWorkAddress[], loading }`
- **Behavior**:
  1. Fetches `ContactRelationshipService.getContactRelationships(individualId)` (cached)
  2. Filters employment/ownership
  3. Resolves the "other side" contact for each (company/service)
  4. Builds an `IndividualAddress` (type='work') from `company.addresses[0]`
  5. Returns `DerivedWorkAddress[]` enriched with `companyId`, `companyName`, `relationshipLabel`
- **No writes, no mutations**

### Renderer Integration — SSoT (single component for individual + company)
- **Path**: `src/components/contacts/dynamic/AddressesSectionWithFullscreen.tsx`
- The `addresses` section uses one renderer for **all contact types** (individual, company, service). The previous individual-only `AddressWithMap` duplicate component was deleted.
- Inside `AddressesSectionWithFullscreen`, `useDerivedWorkAddresses(formData.id)` runs for every contact:
  - For `individual`: returns work addresses from employment/ownership relationships → cards rendered
  - For `company`/`service`: hook filter (`other.type === 'company' | 'service'`) yields `[]` → cards skipped
- Derived cards render below `CompanyAddressesSection` as read-only `SharedAddressActionCard` with label `Εργασία — <companyName>`
- No edit/delete buttons (derived = no user actions)

### Mapper Fix (ancillary)
- **Path**: `src/utils/contactForm/fieldMappers/individualMapper.ts`
- Propagates `individualAddresses` from Firestore to `formData` (needed so user-added extra addresses survive round-trips)

## Data Flow

```
Individual contact details opened
  → AddressWithMap renders
  → useDerivedWorkAddresses(individualId)
      → ContactRelationshipService.getContactRelationships(individualId)
      → filter employment/ownership types
      → Promise.all(companyIds.map(getContact))
      → for each company with addresses[0]: build DerivedWorkAddress
  → Renderer maps result to read-only SharedAddressActionCard list
  → Home (flat) + user-added extras (editable) + derived works (read-only)
```

## Google-level checklist

| # | Question | Answer |
|---|----------|--------|
| 1 | Proactive or reactive? | Proactive — renders on view, no stale data |
| 2 | Race condition possible? | No — each render is a fresh derivation |
| 3 | Idempotent? | Yes — pure function of current Firestore state |
| 4 | Belt-and-suspenders? | N/A — SSoT removes the class of errors |
| 5 | SSoT? | Yes — relationship + company address are the only sources |
| 6 | Fire-and-forget or await? | Client-side derivation; no async mutation |
| 7 | Who owns lifecycle? | `useDerivedWorkAddresses` hook |

## Rejected alternatives

1. **On-save copy to `individualAddresses`**: fails when user edits company address (individual copy goes stale). Violates SSoT.
2. **Retroactive sync on mount**: heals relationships pre-existing the feature, but still duplicates data and requires mount of `ContactRelationshipManager` (which is lazy-loaded with the tab).
3. **Sync via Cloud Function trigger on relationship writes**: robust but heavy. Users edit company addresses without touching relationships; the sync would miss those updates.

## Changelog

| Date | Author | Change |
|------|--------|--------|
| 2026-04-23 | Giorgio Pagonis | Initial implementation — on-save sync (superseded) |
| 2026-04-23 | Giorgio Pagonis | Read path fix in `individualMapper` + positional invariant in sync |
| 2026-04-23 | Giorgio Pagonis | Added retroactive sync on relationships load (superseded) |
| 2026-04-23 | Giorgio Pagonis | **Replaced with live derivation** — new `useDerivedWorkAddresses` hook, removed sync service + on-save hook. Zero Firestore writes; relationship is SSoT. |
| 2026-04-23 | Giorgio Pagonis | **Bugfix**: renderer key was `address` (singular) — never matched section.id `addresses` (plural). `AddressWithMap` was dead code; tab fell back to company-style core renderer. Renamed key to `addresses` in `buildIndividualRenderers`; removed dead `address` key from `buildServiceRenderers`. |
| 2026-04-23 | Giorgio Pagonis | **SSoT consolidation (GOL + SSOT)**: deleted duplicate `AddressWithMap` component (individual-only renderer). One `AddressesSectionWithFullscreen` now serves individual + company + service. `useDerivedWorkAddresses` moved inside that component; returns `[]` for company/service via existing semantic filter. Individual address tab visually identical to company address tab. |
| 2026-04-23 | Giorgio Pagonis | **Bugfix**: individual schema (`src/config/individual-config.ts`) uses sectionId `address` (singular); company schema uses `addresses` (plural). Core renderer was registered only under `addresses` → individual fell back to default field-by-field rendering (4 flat fields, no HQ card, no map). Registered `AddressesSectionWithFullscreen` under both keys (`addresses` and `address`) in `buildCoreRenderers` — same component, two registry keys, schema files untouched. |
