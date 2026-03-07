# ADR-191: Ιεραρχικό Σύστημα Upload Μελετών Οικοδομικής Άδειας

## Status: ✅ APPROVED

## Date: 2026-03-08

## Context

Η εφαρμογή υποστηρίζει upload εγγράφων μέσω flat entry points (17 για Projects, 13 για Buildings).
Οι μηχανικοί χρειάζονται δομημένο σύστημα upload τεχνικών μελετών σύμφωνα με τη νομοθεσία (ν. 4495/2017, ΝΟΚ).

### Απαιτήσεις
- **7 κατηγορίες μελετών** αντιστοιχισμένες στη νομοθεσία
- **2-step UI** (κατηγορία → έγγραφα) αντί flat grid
- **Per-floor entries** δυναμικά από Firestore floors collection
- **Entity distribution**: γενικές μελέτες → Project, τεχνικές → Building/Floor
- **Backward compatibility**: τα υπάρχοντα entry points παραμένουν ανέπαφα

## Decision

### Αρχιτεκτονική

#### 1. Data Model Extension (`upload-entry-points.ts`)
- Νέος τύπος `StudyGroup` (7 τιμές) ως optional πεδίο στο `UploadEntryPoint`
- Νέο πεδίο `perFloor?: boolean` για template entries που αναπτύσσονται δυναμικά
- Zero breaking changes — τα πεδία είναι optional

#### 2. Study Groups Config (`study-groups-config.ts`)
Ξεχωριστό config αρχείο με metadata (icon, color, description) για κάθε κατηγορία μελέτης.

#### 3. Entry Points (~48 νέα entries)
- **Project-level** (administrative, fiscal, energy, site): ~26 entries
- **Building-level** (architectural, structural, mechanical): ~22 static + N×perFloor
- Order ranges 100-719 (δεν συγκρούονται με existing 1-99)

#### 4. HierarchicalEntryPointSelector Component
2-step UI component:
- Step 1: Grid κατηγοριών (7 κάρτες)
- Step 2: Flat grid εγγράφων εντός κατηγορίας
- Cross-group search
- Warning για missing floors σε perFloor entries

#### 5. Integration
- `EntityFilesManager` → νέο `floors?: FloorInfo[]` prop
- `BuildingContractsTab` → fetch floors + pass down
- Conditional rendering: flat (contacts) vs hierarchical (projects/buildings)
- Existing entries χωρίς `group` → "Γενικά Έγγραφα" section

### Entity Distribution

| Group | Entity Level | Entries |
|-------|-------------|---------|
| Διοικητικά/Νομικά | project | 9 |
| Φορολογικά/Ασφαλιστικά | project | 7 |
| Αρχιτεκτονικά/Πολεοδομικά | building | 7+N |
| Στατικά | building | 6+2N |
| Η/Μ | building | 9+6N |
| Ενεργειακά | project | 4 |
| Εργοταξιακά/Περιβαλλοντικά | project | 6 |

### File Naming
Το κεντρικοποιημένο `buildFileDisplayName()` χρησιμοποιεί `purpose` + `descriptors`.
Per-floor entries περνάνε floor name ως descriptor: `"Κάτοψη - Κτίριο Α - Ισόγειο"`.

## Consequences

### Θετικά
- Δομημένη οργάνωση σύμφωνα με νομοθεσία
- Per-floor entries χωρίς duplication
- Πλήρης backward compatibility
- Reusable 2-step pattern

### Αρνητικά
- Μεγαλύτερο config αρχείο (~48 entries)
- Νέο component dependency (HierarchicalEntryPointSelector)

## Files

### New
- `src/config/study-groups-config.ts`
- `src/components/shared/files/HierarchicalEntryPointSelector.tsx`

### Modified
- `src/config/upload-entry-points.ts`
- `src/components/shared/files/EntityFilesManager.tsx`
- `src/components/building-management/tabs/BuildingContractsTab.tsx`
- `src/i18n/locales/el/files.json`
- `src/i18n/locales/en/files.json`
