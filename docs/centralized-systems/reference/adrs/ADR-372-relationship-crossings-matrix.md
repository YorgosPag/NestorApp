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

> Rewritten 2026-11-21 against the current code. The original `getAvailableRelationshipTypes`
> no longer exists — filtering moved to the pure SSoT `relationship-orientation.ts` (§8.3).

### `utils/relationship-types.ts`
- Visual properties only (`VISUAL_REGISTRY`: icon, colour) per type. No filtering, no labels.
- Labels come from the locale via `relationshipRoleLabelKey(type, side)` (§8.3 / §Β1).
- `allowedFor` removed from `RelationshipTypeConfig` — filtering is 100% SSoT-driven.

### `config/relationship-form-presets.ts`
- `getRelationshipTypeOptions(currentType, t, currentValue?, pickedType?)` → `getOfferedOrientedRoles(currentType, pickedType)`;
  each option value is the **oriented** role (`encodeOrientedRole`), so the stored direction never
  depends on the card the user started from. A saved value missing from the list is prepended (decoded).
- `getHolderRoleOptions(currentType, t, pickedType)` — only roles the PICKED contact holds (plain type
  values), for «role of X at Y» flows (quote signatory); the server orients with `pickedSide: 'source'`.

### `RelationshipFormData` / `RelationshipFormFields`
- `targetContactType?: ContactType` on the form data; the fields component accepts a `targetContactType?`
  prop and falls back to `formData.targetContactType`.

### `RelationshipForm`
- `handleContactSelect` captures `contact.type` → `formData.targetContactType` and keeps the chosen
  role only when the picked contact's type is unchanged (avoids a stale invalid role).

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
| `src/types/contacts/relationships/core/relationship-orientation.ts` | §8 SSoT: `RELATIONSHIP_TYPES`, `isSymmetricRelationshipType`, `getOrientedRolesForCrossing`, `CONTACT_OFFERED_RELATIONSHIP_TYPES`, `getOfferedOrientedRoles`, `orientRelationship`, label keys, encode/decode |
| `src/components/contacts/relationships/hooks/relationship-form-orientation.ts` | §8 form side of the orientation (role ↔ stored direction) |
| `src/services/contact-relationships/core/relationship-field-codec.ts` | §8.6 structured channels + `contactInfo` projection + calendar-day codec |
| `src/services/contact-relationships/core/relationship-change-history.ts` | §8.6 `diffChangedFields()` — real changes only, no-op save writes nothing |

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
- **Vocabulary root (a1, CHECK 3.73 `relationship-type`)**: `RELATIONSHIP_TYPES` is the `as const` tuple in `core/relationship-types.ts`; `RelationshipType = (typeof RELATIONSHIP_TYPES)[number]`; ``PropertyRelationshipType = Extract<RelationshipType, `property_${string}`>``. Tuple order = dropdown order (same as the former `Object.keys(RELATIONSHIP_METADATA)`). `VISUAL_REGISTRY` is `Record<Exclude<RelationshipType, PropertyRelationshipType>, …>` — a new role without an icon no longer compiles.
- **Org chart (a2)** — `RelationshipTypeMetadata` += `orgChartLevel: number | null` (one field answers «member of the target organisation's org chart?» and «which level?») and `isManagerial` (people manager). Industry: Workday supervisory organisation (manager role = position in the org, never the title), SAP SuccessFactors position hierarchy + «Is People Manager», Salesforce/HubSpot/Dynamics «Reports To» — membership/level/management are properties of the ROLE, never per-file lists and never guessed from free text. Levels: 1 employee·intern·contractor·civil_servant·ministry_official · 2 manager · 3 director·department_head · 4 executive · 5 ceo · 6 chairman · `null` for the rest (board, shareholders, outside parties). Managerial: manager·director·executive·department_head·ceo·chairman. Derived: `ORG_CHART_RELATIONSHIP_TYPES` (= the former `HIERARCHY_IMPACT_RELATIONSHIP_TYPES`, now aliased to it), `MANAGERIAL_RELATIONSHIP_TYPES`, `orgChartLevelOf`, `isManagerialRelationshipType`, `TOP_LEVEL_ORG_CHART_LEVEL = 3`. Department head = highest-level managerial member (no separate flag). Custom types: `null`/`false`.
- **Position presets** moved to the domain leaf `core/relationship-positions.ts` (`POSITION_PRESETS` + `managerial` flag on director/manager/supervisor, `isManagerialPosition`). `isManagerialRelationship` (`utils/type-guards.ts`) = role flag OR preset flag — the ONE managerial judgement for statistics, navigation and the summary hook. Free-text titles are not guessed (keyword matching on «manager»/«ceo»/«διευθυντής» removed, with the 3 `navigation.positionKeywords.*` keys).
- Offered roles (`relationship-orientation.ts`): `RELATIONSHIP_TYPES` (imported from the root), `isSymmetricRelationshipType` (unknown/custom ⇒ symmetric), `CONTACT_OFFERED_RELATIONSHIP_TYPES` (every type except `isProperty` — ADR-244, owned by the property module; read from the flag, not from which types have an icon), `getOfferedOrientedRoles(currentType, pickedType?)` (without `pickedType`: every role the current contact can take part in, deduplicated, first occurrence wins). Sole consumer: `relationship-form-presets.ts` (`getRelationshipTypeOptions`, `getHolderRoleOptions`).
- SSoT `src/types/contacts/relationships/core/relationship-orientation.ts`: `getOrientedRolesForCrossing`, `orientRelationship`, `isStoredCrossingValid`, `otherContactIdOf`/`otherSideOf`/`orientedRoleOf`, `relationshipRoleLabelKey`, `encode/decodeOrientedRole`, `resolveRelationshipTypeInput`.
- Writers that now orient through it: contact form (`useRelationshipForm` + `relationship-form-orientation.ts`), `RelationshipCRUDService` (validates the stored crossing; duplicate check oriented — the old one threw inside its own try/catch and never rejected), AI `relationship-handler` (+ `relationship-type-input.ts`: Greek words from the locale, kinship aliases, auto-flip when only the reverse crossing is valid), procurement `commit-signatory-service` (signatory = holder; static metadata from the registry, not a hand-written ANY copy).
- Validator: `validateBusinessRules` = `isStoredCrossingValid` (one rule); messages are i18n keys with `labelParams` (`crossingNotAllowed`, `sameContactSameType`); `isValidRelationshipType` derived.
- Removed: `RECIPROCAL_MAPPINGS`, `createReciprocalRelationship`, `relationship-reciprocal-ops.ts`, governance `affectsReciprocal`, `role-mappings-config.ts` (+ `NEXT_PUBLIC_ROLE_*` in `.env.example`; `.ssot-registry.json` module re-pointed to `relationship-role-labels`, forbidding `Record<RelationshipType, string>`), dead `getRelationshipDisplayLabel`/`getRelationshipBadgeColor`.
- Display: `RelationshipCard`, `RecentRelationshipsSection` read the role of the OTHER contact from the viewer's side; dropdown disables used **oriented** values. Edit-load now loads the OTHER contact (it used to load the stored target, i.e. possibly the current contact itself).
- Server registry labels derive from the locale JSON; inverse labels are matched too («Πελάτης» → `vendor`). Custom types are `symmetric: true`.

### 8.4 §Β3 departments
`UNASSIGNED_DEPARTMENT_KEY` + `departmentGroupKey()` (domain, `structures/organization.ts`); `departmentInfo.name: string | null`; UI `resolveDepartmentLabel()` (preset key → i18n, sentinel → «Χωρίς τμήμα», free text verbatim). The form stores the preset **key**. CSV export: empty cell + ID columns instead of `'Unknown'`.

### 8.5 Open (not done in this pass)
- ~~Data migration of the 4 inverted records~~ → done: re-oriented from the edit form (`orientRelationship()` → `updateRelationshipWithPolicy` → `changeHistory` + `recordRelationshipAudit`), **no new writer**. `rel_8123…`, `rel_0cb0…`, `rel_5613…` live 2026-11-21; `rel_2646…` after §8.6 deployed (verified: no-op save wrote no `changeHistory`, same `updatedAt`).
- ~~`position` label-vs-key~~ → done 2026-11-21: `resolvePositionLabel` + shared `resolvePresetOrFreeText` (preset KEY stored, free text verbatim — Salesforce/HubSpot «Title» model).

Remaining (plan + file:line in `HANDOFFS/2026-11-21_ΕΠΑΦΕΣ_ΤΑΥΤΟΤΗΤΑ-ΕΚΔΟΤΗ_ADR-372-8.5_ΣΧΕΔΙΟ_handoff.md`):
- **b1** Relationship channel «Type» empty: the channel owner kind is taken from the card, not from the role holder; auto-copy of the other contact's channels → explicit «Copy from contact».
- ~~**b4** Contact search = `JSON.stringify(...).includes`~~ → done 2026-11-21: ONE engine `matchesAllSearchTokens(fields, term)` (`src/lib/search/search.ts`, per-word AND over fields, any order, Greek-normalized) + ONE field list `contactSearchFields(contact)` (`src/types/contacts/helpers.ts`: names, legal/trade name, VAT, employer/position, emails, phones — no ids/dates). Consumers: `searchContacts` (→ `ContactSearchManager`), `contactsPageFilters`, `ContactsList`, `employee-selector.service`, and procurement `quote-search` free text. Not done (report only): `getAll` per keystroke; 3 other AND-token copies (`catalog/derived/search-prefixes.ts`, `lib/esco/token-search.ts`, `lib/geo/admin-area-search.ts`).
- **b5 (data)** 2 records with an invented start instant (`rel_2d0d7053…`, `rel_6bb161fa…`) → `null` from the edit form, after b1 deploys (no script).

### 8.6 Lossless edit round trip — structured channels · calendar days · real diff (2026-11-21)
**Measured live** (`rel_2646…`): opening + saving a relationship UNCHANGED would have (α) written `«+30 +30 2310686440 (13)»` — the stored display string was loaded into `PhoneInfo.number` and re-prefixed by `formatPhoneDisplay`; (β) wiped `startDate` — `createRelationship` stored `startDate || nowISO()`, an invented **instant** that `<input type="date">` cannot show; (γ) logged all 10 form fields as changed when 2 were.

**Industry practice** (HubSpot / Salesforce): channels are structured and the display string is a projection; an empty date is «unknown», never «now»; field history records only real changes.

**Decision** — SSoT `services/contact-relationships/core/relationship-field-codec.ts` (pure):
- `ContactRelationship.phones[]` / `emails[]` (`PhoneInfo` / `EmailInfo`) = **truth**; `contactInfo.businessPhone|businessEmail` = `projectContactInfo()` projection (other `contactInfo` fields preserved; a removed phone is removed — the old fallback kept the stale string).
- Legacy records (string only) are read via `parsePhoneDisplay()` — the exact inverse of `formatPhoneDisplay`, next to it in `utils/contacts/formatPhoneDisplay.ts`. The formatter no longer prefixes a number that is already international (`+…`) ⇒ an already-doubled value heals on the next save.
- Days: `relationshipCalendarDay()` = `normalizeCalendarDay` (SSoT) or, for a legacy instant, the operator day it named (`calendarDayOf`). Create stores `null` when blank (no `nowISO()`); termination uses `todayRelationshipDay()`; updates go through `normalizeUpdateDays()`.
- `diffChangedFields()` (`relationship-change-history.ts`, `dequal`): `changedFields` = only real changes (`null`/`''`/`[]` equivalent); **a save that changes nothing writes nothing** (idempotent, no history/audit noise).
- Out of scope here, tracked in §8.5: the same `|| nowISO()` start-day invention in the bulk/import services (b5).

---

## 7. Changelog

| Date | Author | Change |
|------|--------|--------|
| 2026-05-23 | AI Agent | Initial implementation — ADR-372 |
| 2026-11-21 | AI Agent (Opus) | §8 reciprocal-role model: directed crossings + `symmetric`, synonyms merged (supplier/client/customer/advisor/protege), `inverseTypes` labels, `relationship-orientation.ts` SSoT, twin records removed, oriented duplicate check, «Unknown» → `UNASSIGNED_DEPARTMENT_KEY` (Β1/Β2/Β3) |
| 2026-11-21 | AI Agent (Opus) | §8.6 lossless edit round trip: structured `phones[]`/`emails[]` + `contactInfo` projection, `parsePhoneDisplay` inverse, calendar-day codec (no invented `nowISO()` start day), real-diff `changedFields` + no-op save; §8.5 re-orientation via the edit form (3/4 live) |
| 2026-11-21 | AI Agent (Opus) | Docs only: §4 rewritten against the current code (`getAvailableRelationshipTypes` gone → `getOfferedOrientedRoles` / `getHolderRoleOptions`); §6 += orientation / form-orientation / field codec / change history; §8.3 += `RELATIONSHIP_TYPES`, `isSymmetricRelationshipType`, `CONTACT_OFFERED_RELATIONSHIP_TYPES`, `getOfferedOrientedRoles` (from `7a5a3220`); §8.5 = what remains (a1–a4, b1–b5), items misplaced in §8.6 moved back; 4th inverted record (`rel_2646…`) done live |
| 2026-11-21 | AI Agent (Opus) | §8.5 a3: removed the 7 dead `relationships.form.validation.*` crossing messages of the pre-§8.3 validator (`individualEmploymentIndividual`, `invalidTypeForService`, `shareholderRequiresCompany`, `companyCannotBeEmployee`, `serviceCannotBeEmployee`, `employmentRequiresCompanyTarget`, `governmentRequiresService`; el+en, 0 consumers — replaced by `crossingNotAllowed`) + the 3 old KAD picker keys (ADR-ACC-013); regenerated `src/types/i18n.ts` |
| 2026-11-21 | AI Agent (Opus) | §8.5 b2: `OrganizationTree` badge shows `resolvePositionLabel` / the held-role label (`relationshipRoleLabelKey(type,'source')`) instead of raw keys («(sales_rep)»); 5 render-time `logger.info` removed. b5 (code): deleted `services/contact-relationships/bulk/` (3 files, 1,007 lines — reachable only from 3 `ContactRelationshipExtendedService` methods with 0 callers, also removed) which invented start days (`startDate \|\| nowISO()`) |
| 2026-11-21 | AI Agent (Opus) | §8.5 a1+a2 (§8.3): `RELATIONSHIP_TYPES` `as const` root + CHECK 3.73 vocabulary `relationship-type` (`.domain-vocabulary.json`); `VISUAL_REGISTRY` bound to the type. Registry += `orgChartLevel` / `isManagerial`; ~12 hand-written hierarchy lists (helpers, Extended/Query/Search/CRUD/OrganizationHierarchy services, governance, `managementTypes` ×3, `type-guards`) now derived — org-chart members were 3 incompatible sets (5/7/9 types) and `ceo`/`chairman` never reached the chart. Position presets → `core/relationship-positions.ts` with `managerial`; keyword guessing on free-text titles removed (+ 3 i18n keys). Research: Workday supervisory org, SAP SuccessFactors position hierarchy, Salesforce `ReportsTo`, Dynamics 365 org charts |
| 2026-11-21 | AI Agent (Opus) | §8.5 b3: `filterOptions` (`searchable-combobox-matching.ts`) ranks BEFORE the `maxDisplayed` cut-off — match-sorter tiers `OPTION_MATCH_RANK` (value = · label = · value starts · label starts · secondary starts · label word starts · contains), stable within a tier, same match set as the old substring; every combobox (KAD «4100» now shows `41.00` first instead of ΓΕΜΗ mid-matches like `01.11.41`). a4: unit tests for `src/lib/kad` (`kad-resolve`, `kad-catalog-shape`, `kad-list-paste`, fixture through the real `indexKadCatalog`) + `searchable-combobox-matching.test.ts` |
| 2026-11-21 | AI Agent (Opus) | §8.5 b4: contact search per word — `matchesAllSearchTokens` + `contactSearchFields` replace 4 divergent engines (`JSON.stringify` scan in `searchContacts`, display-name-only `toLowerCase` in `contactsPageFilters`, whole-phrase `matchesSearchTerm` in `ContactsList`, `toLowerCase` OR in `employee-selector.service`); procurement `quote-search` free text now uses the same engine (same semantics). Tests: `search.test.ts`, `contactsPageFilters.test.ts` (Google Contacts / Gmail model: AND of words, any field, any order) |
