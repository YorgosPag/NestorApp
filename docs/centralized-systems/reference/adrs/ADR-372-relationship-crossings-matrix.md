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

## 8. Reciprocal-role model — §Β1 (one vocabulary) · §Β2 (direction) · §Β3 (no «Unknown») — 2026-11-21

### 8.1 Problem (measured, 2026-11-21)
- **§Β1** — four pairs shared one Greek label in the dropdown (`manager`/`director` «Διευθυντής», `consultant`/`advisor` «Σύμβουλος», `vendor`/`supplier` «Προμηθευτής», `client`/`customer` «Πελάτης»). Eleven hand-written lists enumerated the types (validator ×3, AI ×2, registry labels EL/EN, legacy label/colour maps, `role-mappings-config`, reciprocal map, hierarchy) and had drifted (`isValidRelationshipType` knew 31 of 37).
- **§Β2** — direction lived only in `useRelationshipForm` (a hard-coded 4-type swap) while the validator judged "sides": shareholder worked only from the person card, employee only from the company card. **4 of the 6** stored relationships were company→person (inverted).
- **§Β3** — the hierarchy services emitted the English literal `'Unknown'` as a department name; the UI's i18n fallback was dead code. The form stored the *translated label* of a preset department, not its key.

### 8.2 Industry practice → Nestor decision
HubSpot *paired association labels*, Dynamics 365 *reciprocal connection roles*, Salesforce FSC `ReciprocalRole.InverseRole`: a directed relationship is **one role with two readings**; synonyms are one role. FSC stores a **second record** for the inverse and syncs it with triggers.
**Nestor stores exactly ONE record in CANONICAL direction** (`source` IS <role> OF `target`) and derives the inverse reading at display time from the viewer's side — no twin record, nothing to sync, nothing to drift.

### 8.3 Model
- `RelationshipTypeMetadata.symmetric` (new). Directed types declare crossings **once, canonical** (`PAIR(holder → other)`), symmetric types keep `BIDIR`.
- Merged synonyms (removed from the union; input aliases only, `RELATIONSHIP_TYPE_INPUT_ALIASES`): `supplier`→`vendor`; `client`,`customer`→ inverse of `vendor`; `protege`→ inverse of `mentor`; `advisor`→`consultant`. Data using them: **0**.
- Labels: `relationships.types.<segment>` (holder) + `relationships.inverseTypes.<segment>` (other side: «Εργαζόμενος σε», «Μέτοχος σε», «Πελάτης», «Καθοδηγούμενος»). `manager` = «Υπεύθυνος», `director` = «Διευθυντής». Uniqueness asserted when the locale was generated.
- SSoT `src/types/contacts/relationships/core/relationship-orientation.ts`: `getOrientedRolesForCrossing`, `orientRelationship`, `isStoredCrossingValid`, `otherContactIdOf`/`otherSideOf`/`orientedRoleOf`, `relationshipRoleLabelKey`, `encode/decodeOrientedRole`, `resolveRelationshipTypeInput`.
- Writers that now orient through it: contact form (`useRelationshipForm` + `relationship-form-orientation.ts`), `RelationshipCRUDService` (validates the stored crossing; duplicate check oriented — the old one threw inside its own try/catch and never rejected), AI `relationship-handler` (+ `relationship-type-input.ts`: Greek words from the locale, kinship aliases, auto-flip when only the reverse crossing is valid), procurement `commit-signatory-service` (signatory = holder; static metadata from the registry, not a hand-written ANY copy).
- Validator: `validateBusinessRules` = `isStoredCrossingValid` (one rule); messages are i18n keys with `labelParams` (`crossingNotAllowed`, `sameContactSameType`); `isValidRelationshipType` derived.
- Removed: `RECIPROCAL_MAPPINGS`, `createReciprocalRelationship`, `relationship-reciprocal-ops.ts`, governance `affectsReciprocal`, `role-mappings-config.ts` (+ `NEXT_PUBLIC_ROLE_*` in `.env.example`; `.ssot-registry.json` module re-pointed to `relationship-role-labels`, forbidding `Record<RelationshipType, string>`), dead `getRelationshipDisplayLabel`/`getRelationshipBadgeColor`.
- Display: `RelationshipCard`, `RecentRelationshipsSection` read the role of the OTHER contact from the viewer's side; dropdown disables used **oriented** values. Edit-load now loads the OTHER contact (it used to load the stored target, i.e. possibly the current contact itself).
- Server registry labels derive from the locale JSON; inverse labels are matched too («Πελάτης» → `vendor`). Custom types are `symmetric: true`.

### 8.4 §Β3 departments
`UNASSIGNED_DEPARTMENT_KEY` + `departmentGroupKey()` (domain, `structures/organization.ts`); `departmentInfo.name: string | null`; UI `resolveDepartmentLabel()` (preset key → i18n, sentinel → «Χωρίς τμήμα», free text verbatim). The form stores the preset **key**. CSV export: empty cell + ID columns instead of `'Unknown'`.

### 8.5 Open (not done in this pass)
- Data migration of the 4 inverted records (needs Giorgio's explicit OK).
- CHECK 3.73 registration of the `relationship-type` vocabulary and deriving the hierarchy lists (`organization-hierarchy-helpers.ts`) from metadata flags.
- ~~`position` label-vs-key~~ → done 2026-11-21: `resolvePositionLabel` + shared `resolvePresetOrFreeText` (preset KEY stored, free text verbatim — Salesforce/HubSpot «Title» model).

---

## 7. Changelog

| Date | Author | Change |
|------|--------|--------|
| 2026-05-23 | AI Agent | Initial implementation — ADR-372 |
| 2026-11-21 | AI Agent (Opus) | §8 reciprocal-role model: directed crossings + `symmetric`, synonyms merged (supplier/client/customer/advisor/protege), `inverseTypes` labels, `relationship-orientation.ts` SSoT, twin records removed, oriented duplicate check, «Unknown» → `UNASSIGNED_DEPARTMENT_KEY` (Β1/Β2/Β3) |
