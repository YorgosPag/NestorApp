# ADR-319: Contact Address Type Registry (SSoT)

**Status**: Implemented
**Date**: 2026-04-23
**Category**: Contacts / Address Management / i18n SSoT
**Supersedes (partial)**: legacy `CompanyAddress.type: 'headquarters' | 'branch'` union

## Context

Before this ADR every address attached to a contact (individual, company, or
service) was stored with `type: 'headquarters' | 'branch'`. That pair matches
the company mental model but is meaningless for individuals — an individual's
home is not a "headquarters" and their holiday house is not a "branch". The
single shared renderer (`AddressesSectionWithFullscreen`, consolidated under
ADR-318) hardcoded those two labels for every contact type, so users saw
"Υποκατάστημα" when adding a second address to a natural person.

Meanwhile, `ProjectAddressType` (`src/types/project/addresses.ts`) already
covered project-side semantics (`site / entrance / delivery / legal / ...`).
Those keys are project-centric and do not overlap with the contact domain
beyond incidental cases (`other`). Reusing that union would conflate two
unrelated vocabularies.

## Decision

Introduce a dedicated SSoT for contact-scope address types:
`src/types/contacts/address-types.ts` exports the union `ContactAddressType`,
a metadata registry `CONTACT_ADDRESS_TYPE_METADATA`, and three helpers:

- `getAddressTypesForContact(contactType)` — keys allowed for that scope
- `getPrimaryAddressType(contactType)` — canonical primary slot (HQ equivalent)
- `getDefaultSecondaryAddressType(contactType)` — default for new secondary
  addresses (`branch` for companies, `office` for individuals)

### Taxonomy

| Key | Label (el) | Scope |
|-----|------------|-------|
| `headquarters` | Έδρα | company, service (primary) |
| `branch` | Υποκατάστημα | company, service |
| `warehouse` | Αποθήκη | company, service |
| `showroom` | Έκθεση | company, service |
| `factory` | Εργοστάσιο | company, service |
| `office` | Γραφείο | individual, company, service |
| `home` | Κατοικία | individual (primary) |
| `vacation` | Εξοχικό | individual |
| `other` | Άλλη (+ custom text) | all |

Labels live in `src/i18n/locales/{el,en}/addresses.json` under `types.*` —
no hardcoded Greek/English anywhere in the component tree (SOS. N.11).

### Free-text override (`other`)

`CompanyAddress.customLabel?: string` carries the user-provided label when
the type is `other`. Labels resolve via `resolveContactAddressLabel(type,
customLabel, tAddr)` — custom text wins when non-empty, otherwise the
locale key wins.

### Positional invariant (HQ = index 0)

`companyAddresses[0]` is always the primary slot regardless of its semantic
`type`. Previous code searched `find(a => a.type === 'headquarters')` which
silently failed for individuals (their primary is `home`, not `headquarters`).
The renderer and all mutation helpers now rely on index 0.

## Architecture

### Registry SSoT
- **Path**: `src/types/contacts/address-types.ts`
- **Exports**: `ContactAddressType`, `CONTACT_ADDRESS_TYPES`,
  `CONTACT_ADDRESS_TYPE_METADATA`, `getAddressTypesForContact`,
  `getPrimaryAddressType`, `getDefaultSecondaryAddressType`,
  `isValidContactAddressType`

### UI controls
- **`AddressTypeSelector`** (`src/components/contacts/addresses/AddressTypeSelector.tsx`)
  — Radix Select (ADR-001) of keys allowed for the contact scope, plus an
  inline text input when `other` is picked
- **`resolveContactAddressLabel`** (`src/components/contacts/addresses/contactAddressLabel.ts`)
  — pure helper the cards use to render a human-readable type label

### Form data extensions
- `ContactFormData.primaryAddressType?: ContactAddressType` — semantic type
  of the flat-field HQ
- `ContactFormData.primaryAddressCustomLabel?: string` — free-text when
  `primaryAddressType === 'other'`
- `CompanyAddress.type: ContactAddressType` (widened from the old pair)
- `CompanyAddress.customLabel?: string`

### Renderer integration
- `AddressesSectionWithFullscreen`: HQ card + inline form show
  `AddressTypeSelector`; label uses `resolveContactAddressLabel`. The
  positional invariant (HQ = index 0) replaces the old
  `find(type === 'headquarters')` lookup.
- `CompanyAddressesSection`: every branch card/form shows
  `AddressTypeSelector`; `createEmptyBranch` defaults to
  `getDefaultSecondaryAddressType(contactType)` so adding a second address
  on an individual produces `office`, not `branch`.
- `ContactAddressMapPreview`: pin labels resolve via the shared helper so
  map pins match the card labels (incl. custom text for `other`).

### Persistence
- `mappers/company.ts` and `utils/contacts/EnterpriseContactSaver.ts`
  persist the semantic `type` key (or `customLabel` for `other`) as the
  `AddressInfo.label`. No more hardcoded Greek in mapper layers.

## Google-level checklist

| # | Question | Answer |
|---|----------|--------|
| 1 | Proactive or reactive? | Proactive — default type picked at create time from the contact scope |
| 2 | Race condition possible? | No — single `setFormData` update per interaction |
| 3 | Idempotent? | Yes — same type/custom input produces the same state |
| 4 | Belt-and-suspenders? | Yes — `getPrimaryAddressType` fallback when `formData.primaryAddressType` absent; `isValidContactAddressType` guard on persistence reads |
| 5 | Single Source of Truth? | Yes — one registry owns keys, scopes, primary flags; one locale namespace owns labels |
| 6 | Fire-and-forget or await? | N/A — sync state updates |
| 7 | Who owns lifecycle? | `AddressTypeSelector` owns UI state; `address-types.ts` owns semantics |

## Rejected alternatives

1. **Extend `ProjectAddressType` with contact-side keys** — conflates two
   domains. Project labels already leak into IDs and queries; a single union
   would make future divergence (e.g. branch-specific metadata) impossible.
2. **Per-contact-type separate unions** — would have meant duplicating the
   few shared keys (`office`, `other`) and forking the UI. One registry
   with a `scope` filter is smaller and safer.
3. **Free-text only (no enum)** — flexible but un-translatable and unfit for
   counts/filters. The `other` + `customLabel` escape hatch already covers
   the long-tail case.

## Changelog

| Date | Author | Change |
|------|--------|--------|
| 2026-04-23 | Giorgio Pagonis | Initial registry, UI controls, form/persistence wiring, positional HQ invariant. Fixes "Υποκατάστημα" appearing on individual contacts and enables Κατοικία / Εξοχικό / Γραφείο / Έδρα / Υποκατάστημα / Έκθεση / Εργοστάσιο / Αποθήκη / Άλλο (+ custom) across all contact scopes. |
| 2026-04-23 | Giorgio Pagonis | **Public-service taxonomy split (GOL + SSOT)**: `service`-scope contacts (Greek public administration) were sharing the company taxonomy — "Έδρα / Υποκατάστημα / Αποθήκη / Έκθεση / Εργοστάσιο" is wrong for a ministry/KEP. Introduced proper keys verified against official Greek public-administration structure: `central_service` (Κεντρική Υπηρεσία), `regional_service` (Περιφερειακή Υπηρεσία), `annex` (Παράρτημα), `citizen_service_center` (ΚΕΠ), `department` (Τμήμα). Restricted `headquarters / branch / warehouse / showroom / factory` to `company` scope only — they no longer appear on public-service dropdowns. `getDefaultSecondaryAddressType` returns `regional_service` for services. `getPrimaryAddressType` returns `central_service` for services. |
