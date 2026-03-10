# ADR-192: Master-Detail Navigation — Building Space Tabs

| Field | Value |
|-------|-------|
| **Status** | ✅ ACCEPTED |
| **Date** | 2026-03-10 |
| **Category** | UI / Navigation / Building Management |
| **Affects** | UnitsTabContent, StorageTab, ParkingTabContent, BuildingSpaceTable, BuildingSpaceCardGrid |

---

## Context

Τα tabs Μονάδες/Αποθήκες/Parking στη Διαχείριση Κτιρίων είχαν inline expandable rows
με `SpaceFloorplanInline` (PDF viewer, file manager). Αυτό δημιουργούσε:

- **Information overload**: Ο χρήστης βλέπει πίνακα + embedded viewer ταυτόχρονα
- **Performance issues**: PDF viewer + file list σε κάθε expanded row
- **UX σύγχυση**: Ο χρήστης δεν ξέρει αν πρέπει να κάνει expand ή navigate

### Industry Standard

SAP, Procore, Salesforce, Google Workspace χρησιμοποιούν **master-detail pattern**:
- Ο πίνακας (master) δείχνει μόνο συνοπτικά δεδομένα
- Η πλοήγηση στη detail σελίδα γίνεται με κλικ στο eye icon
- Η detail page περιέχει πλήρη στοιχεία + documents + floorplan

---

## Decision

1. **Αφαίρεση expand/collapse** από τα shared components (`BuildingSpaceTable`, `BuildingSpaceCardGrid`)
2. **Αφαίρεση `SpaceFloorplanInline`** import/usage από Units, Storage, Parking tabs
3. **Eye icon (onView)** πλοηγεί στη detail page αντί για no-op `() => {}`
4. **URLs**:
   - Units: `/units?unitId={id}`
   - Storage: `/spaces/storage?storageId={id}`
   - Parking: `/spaces/parking?parkingId={id}`

### Εξαίρεση

**Floors tab** μένει ως έχει — χρησιμοποιεί custom `<table>` (ΟΧΙ shared components)
με `FloorFloorplanInline`. Δεν υπάρχει detail page για floors.

---

## Consequences

### Positive
- Καθαρότερο UI: Ο πίνακας δείχνει μόνο summary data
- Καλύτερο performance: Δεν φορτώνονται PDF viewers inline
- Consistent UX: Master-detail pattern σύμφωνα με industry standards
- Απλούστερο codebase: Λιγότερα props στα shared components

### Negative
- Ο χρήστης χρειάζεται ένα extra click για να δει details (αναμενόμενο σε master-detail)

---

## Files Changed

| File | Change |
|------|--------|
| `shared/BuildingSpaceTable.tsx` | Remove expand column + expanded row rendering |
| `shared/BuildingSpaceCardGrid.tsx` | Remove expand button + expanded section |
| `tabs/UnitsTabContent.tsx` | onView → `router.push('/units?unitId=X')` |
| `StorageTab.tsx` | onView → `router.push('/spaces/storage?storageId=X')` |
| `tabs/ParkingTabContent.tsx` | onView → `router.push('/spaces/parking?parkingId=X')` |
| `tabs/FloorsTabContent.tsx` | **No changes** |
