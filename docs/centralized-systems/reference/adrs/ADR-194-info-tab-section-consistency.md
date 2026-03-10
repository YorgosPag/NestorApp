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

## Related ADRs
- ADR-193: Field Display Domain Separation (predecessor — caused metadata card removal)
