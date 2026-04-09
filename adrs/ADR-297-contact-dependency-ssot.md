# ADR-297: Contact Dependency Registry — Single Source of Truth

**Status:** IMPLEMENTED
**Date:** 2026-04-09
**Category:** Data Architecture / SSoT Enforcement
**Author:** Georgios Pagonis + Claude Code

---

## Context

The application had **3 parallel systems** that independently tracked which Firestore collections reference a contact:

1. **Deletion Registry** (`src/config/deletion-registry.ts`) — SSoT only for DELETE operations
2. **5 Impact Preview Services** (`src/lib/firestore/*-impact-preview.service.ts`) — scattered inline Firestore queries
3. **Submission Guard Chain** (`src/utils/contactForm/submission-guard-chain.ts`) — 4 guards, mostly company-only

This created **12 identified gaps** where dependencies known by one system were invisible to others. For example:
- The deletion registry knew about parking/storage ownership, but identity impact previews didn't
- The communication guard only ran for company contacts, ignoring individual/service contacts
- Adding a new dependency required changes in 6+ files across 3 domains

## Decision

Create a **unified Contact Dependency Registry** as the SSoT:

```
contact-dependency-registry.ts  (SSoT — declarative data)
         |
contact-impact-engine.ts  (shared query engine — server-side)
         |
    Impact Preview Services (thin wrappers)
    Deletion Registry (derives contact deps)
```

### Key Design Choices

1. **Declarative registry** — Each dependency declares: id, label, contactTypes, query strategy, and per-scenario behavior
2. **3 query strategies** — Standard (simple where), subcollection (parent → fan out), compound (additional filters)
3. **Scenario-based filtering** — Each dependency defines which scenarios it participates in (deletion, identityChange, communicationChange, etc.)
4. **Field-category gating** — Dependencies can optionally limit to specific field categories (e.g., AMKA changes block attendance records)
5. **Structural compatibility** — Deletion registry derives its contact deps via `deriveDeletionDependencies()`, no circular imports

## Implementation

### New Files
- `src/config/contact-dependency-registry.ts` — Registry types + 17 dependency entries + helpers
- `src/lib/firestore/contact-impact-engine.ts` — Shared query engine with `computeContactImpact()`

### Refactored Files (inline queries → thin wrappers)
- `src/lib/firestore/company-identity-impact-preview.service.ts`
- `src/lib/firestore/address-impact-preview.service.ts`
- `src/lib/firestore/communication-impact-preview.service.ts`
- `src/lib/firestore/contact-identity-impact-preview.service.ts`
- `src/lib/firestore/service-identity-impact-preview.service.ts`
- `src/lib/firestore/cascade-contact-name.service.ts` (preview function only)

### Modified Files
- `src/config/deletion-registry.ts` — Contact deps derived from registry
- `src/utils/contactForm/submission-guard-chain.ts` — Communication guard extended to all types
- `src/app/api/contacts/[contactId]/communication-impact-preview/route.ts` — Passes contactType
- `src/app/api/contacts/[contactId]/name-cascade-preview/route.ts` — Passes contactType
- Dialog components — Added parking/storage/communications counts
- Dialog state types — Extended with new fields
- i18n locales — Added new dependency labels

### Gaps Closed
| Gap | Resolution |
|-----|-----------|
| Individual identity missing parking/storage/opportunities/communications | Registry includes with `identityChange` scenario |
| Service identity missing communications/opportunities | Registry includes with `identityChange` scenario |
| Company identity missing parking/storage | Added to `companyIdentityChange` scenario + dialog |
| Communication guard company-only | Removed type gate, registry filters per contactType |
| Name cascade missing parking/storage | Added to `nameChange` scenario |
| Landowner not shown in update warnings | `projectsAsLandowner` in `identityChange` + `nameChange` |
| 3 systems don't share query definitions | All derive from single registry |

## Registry Structure

Each entry defines:
```typescript
{
  id: string;                    // Unique dependency identifier
  label: string;                 // Greek UI label
  remediation?: string;          // Remediation hint for deletion guard
  contactTypes: ContactType[];   // Which contact types this applies to
  query: ContactQueryStrategy;   // How to query Firestore
  scenarios: {                   // Per-scenario behavior
    deletion?: { mode: 'block' | 'warn' | 'info' },
    identityChange?: { mode, onlyForFieldCategories? },
    // ... etc
  }
}
```

## Adding a New Dependency

**Before (scattered):** Edit 6+ files across 3 domains.

**After (SSoT):** Add ONE entry to `CONTACT_DEPENDENCY_REGISTRY` in `contact-dependency-registry.ts`. All consumers automatically pick it up.

## Changelog

| Date | Change |
|------|--------|
| 2026-04-09 | Initial implementation — 17 dependencies, 6 scenarios, 12 gaps closed |
