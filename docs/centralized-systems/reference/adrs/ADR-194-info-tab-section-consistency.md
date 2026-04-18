# ADR-194: Info Tab Section Consistency — Unified Section Order

## Status: ✅ IMPLEMENTED

## Date: 2026-03-10

## Context

Η καρτέλα "Πληροφορίες" (Info tab) στους τρεις τύπους χώρων (Μονάδες, Αποθήκες, Θέσεις Στάθμευσης) είχε
**διαφορετικές ενότητες, διαφορετική σειρά, και διαφορετική ονομασία**, δημιουργώντας σύγχυση στον χρήστη.

### Προβλήματα πριν το ADR-194:
1. **Ονομασία Card 1**: Units="Ταυτότητα Μονάδας" vs Storage/Parking="Βασικές Πληροφορίες"
2. **Storage**: Λείπουν Notes — form state είχε `notes` αλλά δεν εμφανιζόταν
3. **Parking**: Λανθασμένος τίτλος — Card λέει "Περιγραφή" αλλά δείχνει Notes
4. **Storage**: Λείπει Metadata Card — lastUpdated, owner (χάθηκε στο ADR-193)
5. **Parking**: Λείπει Metadata Card — createdAt, updatedAt, createdBy (χάθηκε στο ADR-193)

## Decision

Ενοποίηση section order σύμφωνα με enterprise patterns (SAP RE-FX, Procore, Salesforce):

> Ίδιες ενότητες, ίδια σειρά, ίδια ονόματα σε ΟΛΟΥΣ τους entity types. Αλλάζουν μόνο τα πεδία.

### Unified Section Order:

| # | Section Name | Icon | Color | Storage | Parking |
|---|-------------|------|-------|---------|---------|
| 1 | **Ταυτότητα** | Warehouse/Car | blue | Όνομα, Τύπος, Κατάσταση, Εμβαδόν | Κωδικός, Τύπος, Κατάσταση, Εμβαδόν |
| 2 | **Τοποθεσία** | MapPin | emerald | Κτίριο, Όροφος | Όροφος, Θέση, Building ID |
| 3 | **Περιγραφή & Σημειώσεις** / **Σημειώσεις** | StickyNote | violet | Περιγραφή + Σημειώσεις | Σημειώσεις |
| 4 | **Πληροφορίες Ενημέρωσης** | Calendar | slate | Τελ. Ενημέρωση, Κάτοχος | Δημιουργία, Ενημέρωση, Δημιουργός |

## Changes

### StorageGeneralTab.tsx
- Card 1 title: `basicInfo` → `identity` ("Ταυτότητα")
- Card 3: icon `Layers` → `StickyNote`, title `description` → `descriptionNotes`
- Card 3: Added Notes textarea below Description
- **New Card 4**: Metadata — Calendar icon, lastUpdated + owner (always disabled)

### ParkingGeneralTab.tsx
- Card 1 title: `basicInfo` → `identity` ("Ταυτότητα")
- Card 3 title: `fields.description` → `notes` ("Σημειώσεις")
- **New Card 4**: Metadata — Calendar icon, createdAt + updatedAt + createdBy (always disabled)

### i18n (4 files)
- Added `general.identity` key to storage.json and parking.json (el + en)

## Files Changed
- `src/components/space-management/StoragesPage/StorageDetails/tabs/StorageGeneralTab.tsx`
- `src/components/space-management/ParkingPage/ParkingDetails/tabs/ParkingGeneralTab.tsx`
- `src/i18n/locales/el/storage.json`
- `src/i18n/locales/en/storage.json`
- `src/i18n/locales/el/parking.json`
- `src/i18n/locales/en/parking.json`

## Canonical Component — SSoT (Phase 2, 2026-04-19)

**Card 3 (Description & Notes) is rendered via a shared, presentational component**:

- **File**: `src/components/shared/space-info/DescriptionNotesCard.tsx`
- **Props**: `description`, `notes`, `isEditing`, `onDescriptionChange`, `onNotesChange`, `labels: { title, description, notes }`
- **Styling**: `Card` + `CardHeader` + `CardTitle` with `StickyNote` icon (violet) and typography/icon/colors tokens resolved via design-system hooks (`useIconSizes`, `useTypography`, `useSemanticColors`).
- **i18n**: translated labels are passed in by the caller (pattern ADR-280 — per-entity namespace).
- **Registry**: `.ssot-registry.json` → `description-notes-card` (tier 3). New inline re-implementations are blocked by the SSoT ratchet pre-commit hook.

### Consumers

| Entity | File | Labels source |
|---|---|---|
| Storage | `src/components/space-management/StoragesPage/StorageDetails/tabs/StorageGeneralTab.tsx` | `storage.general.descriptionNotes` + `storage.general.fields.description` + `storage.general.fields.notes` |
| Parking | `src/components/space-management/ParkingPage/ParkingDetails/tabs/ParkingGeneralTab.tsx` | `parking.general.descriptionNotes` + `parking.general.fields.description` + `parking.general.fields.notes` |

### Parking — description field added
- `ParkingSpot` interface (`src/types/parking.ts`) gained an optional `description?: string` so Parking has the SAME UI as Storage (Card 3 with two textareas).
- `ParkingFormState.description` initialised from `parking.description || ''`, saved via diff in both create and edit paths of `handleSave`.
- Resolves the "pending decision" comment originally present at the bottom of `ParkingGeneralTab.tsx` (removed in this phase).

## Changelog

- **2026-03-10** — Initial implementation: unified section order across Storage/Parking/Units (Phase 1).
- **2026-04-19** — Phase 2 (SSoT): extracted Card 3 to `DescriptionNotesCard` (shared, presentational). Storage refactored to consume it. Parking re-introduced Card 3 via the shared component and gained `description` field on its type/form/save path. Registry entry `description-notes-card` added to `.ssot-registry.json`. Locale keys `general.descriptionNotes` + `general.fields.description` + `general.fields.notes` added to `parking.json` (el + en).
- **2026-04-19** — Phase 2.1 (backend persistence parity): parking API routes missed `description` on POST create, PATCH update, and the Firestore read-back mapper, while storage had it everywhere. Saved values were silently dropped and reload returned empty textareas. Fix: added `description` to `CreateParkingSchema` + `entitySpecificFields` (`/api/parking`), `UpdateParkingSchema` + `updateData` (`/api/parking/[id]`), and `mapParkingDoc` (`src/lib/firestore-mappers.ts`) — now parity with storage. Description + notes now persist end-to-end on parking spots.

## Related ADRs
- ADR-193: Field Display Domain Separation (predecessor — caused metadata card removal)
- ADR-280: i18n Namespace per-domain (Phase 2 keeps labels per-entity, not centralized)
- ADR-294: SSoT Ratchet Enforcement (guarantees no future inline duplication)
