# ADR-372 — Contact Relationship Bidirectional Crossing Matrix

**Status:** IMPLEMENTED  
**Date:** 2026-05-23  
**Author:** AI Agent (Giorgio Pagonis)  
**Extends:** ADR-318 (Relationship Metadata SSoT)

---

## 1. Context

The contact relationship system supports three contact types:
- `individual` — natural person
- `company` — legal entity
- `service` — public agency / government body

Previously, each relationship type had a single `allowedFor: ContactType[]` field that controlled
the **source** (page owner) filter only. This created two major UX problems:

1. **individual → company/service**: An individual opening their own contact page and trying to add a
   relationship with a company (e.g. "I work here as employee") would see only personal types
   (friend, family, colleague) — because `employee.allowedFor = ['company', 'service']`, not `individual`.

2. **company → company**: A company relating to another company would see `employee` in the list,
   which is semantically invalid (a company cannot be an employee of another company).

Salesforce, HubSpot, and Microsoft Dynamics all model relationships with explicit (source, target)
crossing matrices rather than single-axis allowlists.

---

## 2. Decision

Replace the single-axis `allowedFor` filter with a **bidirectional crossing matrix** per relationship type.

### New field: `allowedCrossings: CrossingPair[]`

```ts
interface CrossingPair {
  source: ContactType;   // the contact whose page initiated the relationship
  target: ContactType;   // the contact on the other side
}
```

For each relationship type, `allowedCrossings` declares every valid `(source → target)` pair
explicitly. The legacy `allowedFor` field is **derived** (not authored) by collecting the
distinct source types across all crossings — guaranteeing zero divergence.

```ts
// META() factory auto-derives allowedFor:
const allowedFor = [...new Set(allowedCrossings.map(c => c.source))];
```

### Helper functions added to SSoT

| Function | Description |
|----------|-------------|
| `isCrossingAllowed(type, source, target)` | Boolean gate for one crossing |
| `getRelationshipTypesForCrossing(source, target)` | All types valid for a crossing |
| `buildCrossingsForSources(sources)` | Default crossings for custom (dynamic) types |

---

## 3. Crossing Matrix

### Employment types (employee, manager, director, executive, intern, contractor)

| Source ↓ \ Target → | individual | company | service |
|---|---|---|---|
| **individual** | — | ✅ "I work here" | ✅ "I'm civil-servant equivalent" |
| **company** | ✅ "This person works for us" | — | — |
| **service** | ✅ "This person works for us" | — | — |

### Ownership types (shareholder, board_member, chairman, ceo)

| Source ↓ \ Target → | individual | company | service |
|---|---|---|---|
| **individual** | — | ✅ | — |
| **company** | ✅ | — (except shareholder*) | — |

*`shareholder`: company ↔ company allowed (company owns shares of another).

### Partner

All: individual↔company, company↔company, company↔service.

### Professional services (consultant, advisor, representative)

All: {individual,company} ↔ {company,service}.

### Government (civil_servant, department_head, ministry_official, elected_official, appointed_official, mayor, deputy_mayor, regional_governor)

Strictly: individual ↔ service.

### Commercial (vendor, client, supplier, customer)

Any crossing (all 9) — freelancers, B2B, B2G, G2B.

### Competitor

individual↔individual, individual↔company, company↔company.

### Personal (mentor, protege, colleague, friend, family)

individual → individual only.

### business_contact, other

All 9 crossings (catch-all / generic).

---

## 4. UI Layer Changes

### `relationship-types.ts`
- Expanded `VISUAL_REGISTRY` from 11 → 31 types (all SSoT types, minus ADR-244 property types
  which belong to the property module UI).
- `allowedFor` removed from `RelationshipTypeConfig` — filtering is now 100% SSoT-driven.
- `getAvailableRelationshipTypes(sourceType, targetType?)`:
  - With `targetType` → calls `getRelationshipTypesForCrossing(source, target)`.
  - Without `targetType` → source-only fallback via SSoT `allowedFor` (backward compat).

### `relationship-form-presets.ts`
- `getRelationshipTypeOptions(sourceType, t, currentValue?, targetType?)` — fourth param added.

### `RelationshipFormData`
- Added optional `targetContactType?: ContactType`.

### `RelationshipFormFields`
- Added optional `targetContactType?` prop; falls back to `formData.targetContactType`.

### `RelationshipForm`
- `handleContactSelect` now captures `contact.type` → `formData.targetContactType`.
- Resets `relationshipType` when the selected target changes (avoids stale invalid type).

---

## 5. Limitations & Follow-ups

| Item | Description |
|------|-------------|
| **Edit mode target type** | When editing an existing relationship, `targetContactType` is `undefined` because only `targetContactId` is stored in the record. Filter falls back to source-only mode (shows broader list). Resolution: `handleEdit` should fetch target contact type via `ContactsService.getById`. Tracked as follow-up. |
| **Custom types** | Dynamic (user-created) types created via `findOrCreateRelationshipType` use `buildCrossingsForSources(allowedFor)` which allows any target. A future AI-assisted inference step could refine this. |

---

## 6. Files Changed

| File | Change |
|------|--------|
| `src/types/contacts/relationships/core/relationship-metadata.ts` | `CrossingPair` type, `allowedCrossings` field, `META()` derivation, 3 new helper functions |
| `src/components/contacts/relationships/utils/relationship-types.ts` | Full VISUAL_REGISTRY (31 types), `allowedFor` removed, routing to SSoT |
| `src/components/contacts/relationships/config/relationship-form-presets.ts` | `targetType?` param |
| `src/components/contacts/relationships/RelationshipFormFields.tsx` | `targetContactType?` prop |
| `src/components/contacts/relationships/RelationshipForm.tsx` | Capture + reset on contact select |
| `src/components/contacts/relationships/types/relationship-manager.types.ts` | `targetContactType?` on `RelationshipFormData` |
| `src/services/contact-relationships/relationship-type-registry.ts` | `buildDefaultMetadata` uses `buildCrossingsForSources` |

---

## 7. Changelog

| Date | Author | Change |
|------|--------|--------|
| 2026-05-23 | AI Agent | Initial implementation — ADR-372 |
