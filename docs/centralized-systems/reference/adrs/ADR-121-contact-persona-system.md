# ADR-121: Contact Persona System — Role-Based Dynamic Fields

| Field | Value |
|-------|-------|
| **Status** | IMPLEMENTED |
| **Date** | 2026-02-08 |
| **Category** | Contact Management / CRM |
| **Impact** | Individual Contact Forms, IKA Integration |

## Context

Individual contacts (physical persons) in the construction industry can hold multiple roles simultaneously: a person can be a construction worker, an engineer, a client, and a property owner. Each role requires specific data fields (e.g., IKA number for workers, TEE registry for engineers).

Previously, all fields were shown for all contacts, making the form unusable. The form needed progressive disclosure based on the person's actual roles.

## Decision

Implement the **SAP Business Partner "Role/Persona" pattern**:

- Each individual contact can have 0-N active "personas" (ιδιότητες)
- Each persona activates a conditional tab with role-specific fields
- Personas are toggled via chip badges (click = on/off)
- Persona data is embedded in the contact document (not a subcollection)
- Deactivation is soft-delete (status='inactive', data preserved for re-activation)

## Persona Types (9)

| Type | Fields | Priority |
|------|--------|----------|
| `construction_worker` | ikaNumber, insuranceClassId, triennia, dailyWage, specialtyCode, efkaRegistrationDate | P0 |
| `engineer` | teeRegistryNumber, engineerSpecialty, licenseClass, ptdeNumber | P0 |
| `accountant` | oeeNumber, accountingClass | P1 |
| `lawyer` | barAssociationNumber, barAssociation | P1 |
| `property_owner` | propertyCount, ownershipNotes | P1 |
| `client` | clientSince, clientCategory, preferredContactMethod | P1 |
| `supplier` | supplierCategory, paymentTermsDays | P2 |
| `notary` | notaryRegistryNumber, notaryDistrict | P2 |
| `real_estate_agent` | licenseNumber, agency | P2 |

## Architecture

### Type System
- **`PersonaType`**: Union of 9 string literals
- **`PersonaData`**: Discriminated union with per-persona interfaces
- **Type guards**: `isConstructionWorkerPersona()`, `isEngineerPersona()`, etc.
- **Location**: `src/types/contacts/personas.ts`

### Configuration (SSoT)
- **`PERSONA_SECTIONS`**: `Record<PersonaType, PersonaSectionConfig[]>` — fields per persona
- **`PERSONA_METADATA`**: Icons, labels, display order for selector
- **`getMergedIndividualSections()`**: Merges standard + persona sections dynamically
- **Location**: `src/config/persona-config.ts`

### UI — Transparent Field Routing
- **PersonaSelector**: Chip badge toggle component (`role="switch"`, `aria-checked`)
- **Dynamic sections**: `getMergedIndividualSections()` injects persona tabs (order 100+)
- **Enhanced formData**: Persona field values flattened to top level for transparent rendering
- **Wrapped handlers**: `onChange`/`onSelectChange` detect persona fields via lookup map and route to `formData.personaData[personaType][fieldId]`
- **Zero changes** to `IndividualFormRenderer` — persona fields render identically to standard fields

### Persistence
- **Save**: `mapActivePersonas()` creates `PersonaData[]` from form state
- **Load**: Reverse extraction using `getPersonaFields()` as SSoT for field names
- **Firestore**: Embedded array on contact document (`personas?: PersonaData[]`)
- **All optional fields use `?? null`** (Firestore rejects undefined)

### IKA Integration
- `useProjectWorkers` checks for `construction_worker` persona
- Enriches `insuranceClassId` and `specialty` from persona data
- Supplements (does not replace) existing IKA system

## Files

### Created
| File | Purpose |
|------|---------|
| `src/types/contacts/personas.ts` | Type system (PersonaType, PersonaData, type guards, utilities) |
| `src/config/persona-config.ts` | SSoT for persona sections, fields, metadata |
| `src/components/contacts/personas/PersonaSelector.tsx` | Chip badge toggle UI |

### Modified
| File | Change |
|------|--------|
| `src/types/contacts/contracts.ts` | Added `personas?: PersonaData[]` to IndividualContact |
| `src/types/contacts/index.ts` | Barrel export for personas |
| `src/types/ContactFormTypes.ts` | Added `activePersonas`, `personaData` to ContactFormData |
| `src/config/individual-config.ts` | Added personas section (order 2.5) |
| `src/constants/property-statuses-enterprise.ts` | Added persona labels, icons, field labels, section labels |
| `src/i18n/locales/el/contacts.json` | Greek translations for persona system |
| `src/i18n/locales/en/contacts.json` | English translations for persona system |
| `src/components/ContactFormSections/UnifiedContactTabbedSection.tsx` | Dynamic sections, persona selector, field routing |
| `src/utils/contactForm/mappers/individual.ts` | Save mapper — FormData to PersonaData[] |
| `src/utils/contactForm/fieldMappers/individualMapper.ts` | Load mapper — PersonaData[] to FormData |
| `src/components/projects/ika/hooks/useProjectWorkers.ts` | IKA enrichment from persona |

## Edge Cases

| Scenario | Decision |
|----------|----------|
| Persona removal | Soft delete: status='inactive', data preserved |
| Default values | All persona fields start as `null` |
| Validation | Format only (e.g., 11 digits AMKA), no required fields on personas |
| Existing contacts without personas | Backward compatible — `personas` field is optional |
| Multiple personas | Supported — same person = Worker + Client + etc. |
| Field ID conflicts | None — all persona field IDs are unique vs standard fields |

## Consequences

### Positive
- Progressive disclosure: only relevant fields shown per role
- Backward compatible: existing contacts work unchanged
- Config-driven: adding new persona = config + i18n only
- IKA integration: worker data flows automatically to project compliance

### Negative
- Increased complexity in form data routing (wrapped handlers)
- Persona data stored as embedded array (bounded at 9 max, acceptable)
