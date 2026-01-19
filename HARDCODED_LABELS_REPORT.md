# HARDCODED LABELS REPORT
## Αναφορά Ελληνικών Labels που Χρειάζονται i18n

**Ημερομηνία Ενημέρωσης**: 2026-01-18
**Σύνολο Αρχείων με Hardcoded Labels**: 72 αρχεία
**Σύνολο Hardcoded Greek Strings**: 500+

---

## ΚΑΤΑΣΤΑΣΗ ΟΛΟΚΛΗΡΩΣΗΣ

| Κατάσταση | Αρχεία |
|-----------|--------|
| ✅ Ολοκληρώθηκαν | 55+ |
| ⏳ Εκκρεμούν | 72 |

---

## ΕΞΟΝΥΧΙΣΤΙΚΗ ΕΡΕΥΝΑ - ΠΛΗΡΗ ΑΠΟΤΕΛΕΣΜΑΤΑ

Η παρακάτω λίστα περιέχει **ΟΛΕΣ** τις περιπτώσεις hardcoded Greek strings που βρέθηκαν στην εφαρμογή (εξαιρούνται τα `src/i18n/locales/` translation files).

---

## 🔴 ΚΡΙΣΙΜΑ - Lib/Utils Files (Core Logic)

### 1. toast-presets.ts
**Path**: `src/lib/toast-presets.ts`
**Lines**: 5, 10, 15, 20, 25
**Labels**: 5

```typescript
Line 5:  title: "Επιτυχία"
Line 10: title: "Σφάλμα"
Line 15: title: "Προειδοποίηση"
Line 20: title: "Ενημέρωση"
Line 25: title: "Φόρτωση..."
```

---

### 2. validation.ts
**Path**: `src/utils/validation.ts`
**Lines**: 15-56
**Labels**: 42

```typescript
// Field validations (15-31):
'Το όνομα είναι υποχρεωτικό'
'Το επώνυμο είναι υποχρεωτικό'
'Η επωνυμία είναι υποχρεωτική'
'Το email δεν είναι έγκυρο'
'Το τηλέφωνο δεν είναι έγκυρο'
// ... και άλλα

// Generic validations (34-56):
'Αυτό το πεδίο είναι υποχρεωτικό'
'Πρέπει να είναι τουλάχιστον {min} χαρακτήρες'
'Δεν μπορεί να υπερβαίνει τους {max} χαρακτήρες'
```

---

### 3. contactFormUtils.ts
**Path**: `src/utils/contactFormUtils.ts`
**Lines**: 23-26
**Labels**: 4

```typescript
'Φυσικό Πρόσωπο'
'Εταιρεία'
'Δημόσια Υπηρεσία'
'Επαφή'
```

---

### 4. share-utils.ts
**Path**: `src/lib/share-utils.ts`
**Line**: 187
**Labels**: 1

```typescript
'Δείτε αυτά τα ενδιαφέροντα ακίνητα από την Nestor Construct!'
```

---

### 5. property-utils.ts
**Path**: `src/lib/property-utils.ts`
**Lines**: 44, 73, 84-90
**Labels**: 9

```typescript
Line 44: label: 'Άγνωστο'
Line 73: label: 'Άγνωστο'
Lines 84-90:
  'Στούντιο', 'Γκαρσονιέρα', 'Διαμέρισμα 2Δ',
  'Διαμέρισμα 3Δ', 'Μεζονέτα', 'Κατάστημα', 'Αποθήκη'
```

---

### 6. project-utils.ts
**Path**: `src/lib/project-utils.ts`
**Lines**: 79-84
**Labels**: 6

```typescript
'planning': 'Σχεδιασμός'
'in_progress': 'Σε εξέλιξη'
'completed': 'Ολοκληρωμένο'
'on_hold': 'Σε αναμονή'
'cancelled': 'Ακυρωμένο'
'default': 'Άγνωστο'
```

---

### 7. pdf-utils.ts
**Path**: `src/lib/pdf-utils.ts`
**Lines**: 82, 91, 98, 104, 156-163, 186, 212, 401
**Labels**: 12

```typescript
'Μόνο αρχεία PDF επιτρέπονται'
'Το αρχείο είναι πολύ μεγάλο (μέγιστο 50MB)'
'Το αρχείο είναι μεγάλο και μπορεί να χρειαστεί περισσότερος χρόνος για upload'
'Το όνομα του αρχείου περιέχει ειδικούς χαρακτήρες που μπορεί να προκαλέσουν προβλήματα'
'Σφάλμα κατά την αποστολή'
'Δεν έχετε δικαίωμα'
'Άγνωστο σφάλμα κατά τη διαχείριση του PDF'
```

---

### 8. obligations/validation.ts
**Path**: `src/lib/obligations/validation.ts`
**Lines**: 14-67, 92-96
**Labels**: 12

```typescript
'Ο τίτλος είναι υποχρεωτικός'
'Το όνομα έργου είναι υποχρεωτικό'
'Η εταιρεία ανάδοχου είναι υποχρεωτική'
'Απαιτείται τουλάχιστον ένας ιδιοκτήτης'
'Το έγγραφο δεν περιέχει ενότητες'
'Ο τίτλος ενότητας είναι υποχρεωτικός'
'Ο αριθμός ενότητας είναι υποχρεωτικός'
'Η ενότητα δεν έχει περιεχόμενο'
'Το περιεχόμενο της ενότητης είναι πολύ σύντομο'
'Ο τίτλος άρθρου είναι υποχρεωτικός'
'Ο αριθμός άρθρου είναι υποχρεωτικός'
```

---

### 9. data-cleaning.ts
**Path**: `src/utils/contactForm/utils/data-cleaning.ts`
**Lines**: 245-283
**Labels**: 15

```typescript
'Το όνομα είναι υποχρεωτικό...'
'Το επώνυμο είναι υποχρεωτικό...'
'Το όνομα εταιρείας είναι υποχρεωτικό...'
// Και άλλες validation strings
```

---

## 🟠 FEATURES - Units Toolbar & Sidebar

### 10. UnitsToolbar.tsx
**Path**: `src/features/units-toolbar/UnitsToolbar.tsx`
**Lines**: 73, 93, 104
**Labels**: 3

```typescript
placeholder="Γρήγορη αναζήτηση μονάδων..."
tooltip="Προχωρημένα Εργαλεία"
tooltip="Βοήθεια και Οδηγίες (F1)"
```

---

### 11. ToolbarFiltersMenu.tsx
**Path**: `src/features/units-toolbar/components/ToolbarFiltersMenu.tsx`
**Line**: 39
**Labels**: 1

```typescript
tooltip="Φίλτρα και Προβολή"
```

---

### 12. ToolbarExportMenu.tsx
**Path**: `src/features/units-toolbar/components/ToolbarExportMenu.tsx`
**Lines**: 27, 47
**Labels**: 2

```typescript
tooltip="Εξαγωγή Δεδομένων"
tooltip="Εισαγωγή Δεδομένων"
```

---

### 13. RefreshButton.tsx
**Path**: `src/features/units-toolbar/components/RefreshButton.tsx`
**Line**: 10
**Labels**: 1

```typescript
tooltip="Ανανέωση Δεδομένων (F5)"
```

---

### 14. ProjectFiltersMenu.tsx
**Path**: `src/features/units-toolbar/components/ProjectFiltersMenu.tsx`
**Line**: 36
**Labels**: 1

```typescript
tooltip="Φίλτρα και Προβολή"
```

---

### 15. UnitsSidebar.tsx
**Path**: `src/features/units-sidebar/UnitsSidebar.tsx`
**Lines**: 121, 128
**Labels**: 2

```typescript
aria-label="Επεξεργασία Μονάδας"
aria-label="Διαγραφή Μονάδας"
```

---

### 16. UnitDetailsHeader.tsx
**Path**: `src/features/units-sidebar/components/UnitDetailsHeader.tsx`
**Lines**: 26-27
**Labels**: 2

```typescript
title="Επιλέξτε μια μονάδα"
subtitle="Δεν έχει επιλεγεί μονάδα"
```

---

### 17. FloorPlanTab.tsx
**Path**: `src/features/units-sidebar/components/FloorPlanTab.tsx`
**Line**: 60
**Labels**: 1

```typescript
title="Κάτοψη Μονάδας"
```

---

## 🟠 FEATURES - Property & Read-Only Viewer

### 18. PropertyViewerWithLayers.tsx
**Path**: `src/features/read-only-viewer/components/PropertyViewerWithLayers.tsx`
**Lines**: 219, 228, 245
**Labels**: 3

```typescript
aria-label="Πληροφορίες"
aria-label="Φόρτωση"
customLabel="Προβολή μόνο"
```

---

### 19. SearchBar.tsx
**Path**: `src/features/property-grid/components/SearchBar.tsx`
**Line**: 11
**Labels**: 1

```typescript
placeholder="Αναζήτηση ακινήτου..."
```

---

### 20. ReadOnlyBanner.tsx
**Path**: `src/features/property-details/components/ReadOnlyBanner.tsx`
**Line**: 16
**Labels**: 1

```typescript
customLabel="Δημόσια Προβολή"
```

---

## 🟠 CORE - Headers, Modals, Progress

### 21. ThemeProgressBar.tsx
**Path**: `src/core/progress/ThemeProgressBar.tsx`
**Line**: 25
**Labels**: 1

```typescript
label = "Πρόοδος"
```

---

### 22. PhotoPreviewModal.tsx
**Path**: `src/core/modals/PhotoPreviewModal.tsx`
**Lines**: 618-784
**Labels**: 15

```typescript
aria-label="Εργαλεία Φωτογραφίας"
title="Προηγούμενη φωτογραφία"
title="Επόμενη φωτογραφία"
title="Μικρότερο"
title="Μεγαλύτερο"
title="Περιστροφή"
title="Λήψη"
title="Κλείσιμο"
aria-label="Εμφάνιση Φωτογραφίας"
aria-label="Πληροφορίες Φωτογραφίας"
aria-label="Τύπος Επαφής"
aria-label="Πληροφορίες Εστίασης"
```

---

### 23. examples.tsx (headers)
**Path**: `src/core/headers/examples.tsx`
**Lines**: 29-202
**Labels**: 30+

```typescript
title: "Διαχείριση Επαφών"
subtitle: "Κεντρικό ευρετήριο..."
title: "Διαχείριση Έργων"
// Και πολλά ακόμα examples
```

---

### 24. EnterpriseHeaderActions.tsx
**Path**: `src/core/headers/EnterpriseHeaderActions.tsx`
**Lines**: 48, 87, 117, 126, 226, 232, 238, 244
**Labels**: 8

```typescript
entityType="έργο"
entityType="κτίριο"
entityType="επαφή"
entityType="μονάδα"
```

---

### 25. constants/index.ts (enterprise-system)
**Path**: `src/core/headers/enterprise-system/constants/index.ts`
**Lines**: 176-180
**Labels**: 5

```typescript
"Αναζήτηση..."
"Αναζήτηση επαφών..."
"Αναζήτηση έργων..."
"Αναζήτηση κτιρίων..."
"Αναζήτηση αρχείων..."
```

---

### 26. DetailsContainer.tsx
**Path**: `src/core/containers/DetailsContainer.tsx`
**Lines**: 15-16
**Labels**: 2

```typescript
title = "Κάντε μια επιλογή"
description = "Επιλέξτε ένα στοιχείο..."
```

---

### 27. enterprise-messages-system.ts
**Path**: `src/core/configuration/enterprise-messages-system.ts`
**Lines**: 187-208
**Labels**: 20+

```typescript
// Empty state messages για επαφές, έργα, κτίρια, αποθήκες, μονάδες
```

---

## 🟠 COMPONENTS - Generic, Landing, Photos

### 28. LandingPage.tsx
**Path**: `src/components/landing/LandingPage.tsx`
**Lines**: 91-95
**Labels**: 5

```typescript
<SelectItem value="Στούντιο">
<SelectItem value="Γκαρσονιέρα">
<SelectItem value="Διαμέρισμα">
<SelectItem value="Μεζονέτα">
<SelectItem value="Αποθήκη">
```

---

### 29. PhotosPreview.tsx
**Path**: `src/components/generic/utils/PhotosPreview.tsx`
**Lines**: 112, 121
**Labels**: 2

```typescript
title="Λογότυπο Εταιρείας"
title="Φωτογραφία Εκπροσώπου"
```

---

### 30. PhotoPreviewCard.tsx
**Path**: `src/components/generic/utils/PhotoPreviewCard.tsx`
**Lines**: 25, 149, 177-221
**Labels**: 8

```typescript
title="Κλικ για προεπισκόπηση"
altText="Λογότυπο Εταιρείας"
emptyText="Δεν υπάρχει λογότυπο"
// Και ακόμα
```

---

### 31. PhotoGrid.tsx
**Path**: `src/components/generic/utils/PhotoGrid.tsx`
**Line**: 25
**Labels**: 1

```typescript
customLabel="Προσθήκη Φωτογραφίας"
```

---

## 🟠 SUBAPPS - Geo-Canvas

### 32. CitizenDrawingInterface.tsx
**Path**: `src/subapps/geo-canvas/components/CitizenDrawingInterface.tsx`
**Line**: 476
**Labels**: 1

```typescript
title="Αναζήτηση διεύθυνσης ή GPS"
```

---

### 33. BoundaryLayerControlPanel.tsx
**Path**: `src/subapps/geo-canvas/components/BoundaryLayerControlPanel.tsx`
**Lines**: 153, 301
**Labels**: 2

```typescript
title="Αφαίρεση layer"
'Κάντε κλικ "Προσθήκη Boundary"...'
```

---

### 34. AdminBoundaryDemo.tsx
**Path**: `src/subapps/geo-canvas/components/AdminBoundaryDemo.tsx`
**Line**: 83
**Labels**: 1

```typescript
placeholder="π.χ. Δήμος Αθηναίων..."
```

---

### 35. AddressSearchPanel.tsx
**Path**: `src/subapps/geo-canvas/components/AddressSearchPanel.tsx`
**Lines**: 434-435
**Labels**: 2

```typescript
"π.χ. Λεωφόρος Κηφισίας 123, Μαρούσι..."
"π.χ. Δήμος Αθηναίων, Περιφέρεια..."
```

---

### 36. administrative-types.ts
**Path**: `src/subapps/geo-canvas/types/administrative-types.ts`
**Lines**: 185, 237-240, 380-406
**Labels**: 20+

```typescript
// Administrative regions:
'Ελλάδα', 'Αττική', 'Κεντρική Μακεδονία', etc.
// Major cities:
'Δήμος Αθηναίων', 'Δήμος Θεσσαλονίκης', etc.
```

---

## 🟠 SUBAPPS - DXF-Viewer UI

### 37. LevelSelectionStep.tsx
**Path**: `src/subapps/dxf-viewer/ui/wizard/LevelSelectionStep.tsx`
**Line**: 123
**Labels**: 1

```typescript
placeholder="Εισάγετε όνομα επιπέδου (π.χ. Υπόγειο, 2ος Όροφος)"
```

---

### 38. CalibrationStep.tsx
**Path**: `src/subapps/dxf-viewer/ui/wizard/CalibrationStep.tsx`
**Lines**: 58, 138
**Labels**: 2

```typescript
aria-label="Επιλογή μονάδων"
placeholder="π.χ. 100"
```

---

### 39. ToolButton.tsx
**Path**: `src/subapps/dxf-viewer/ui/toolbar/ToolButton.tsx`
**Line**: 115
**Labels**: 1

```typescript
title="Περισσότερες επιλογές"
```

---

### 40. OverlayToolbar.tsx
**Path**: `src/subapps/dxf-viewer/ui/OverlayToolbar.tsx`
**Lines**: 255, 269, 288, 301
**Labels**: 4

```typescript
title="Αντιγραφή (D)"
title="Διαγραφή (Del)"
title="Αναίρεση (Ctrl+Z)"
title="Επανάληψη (Ctrl+Y)"
```

---

### 41. OverlayProperties.tsx
**Path**: `src/subapps/dxf-viewer/ui/OverlayProperties.tsx`
**Line**: 146
**Labels**: 1

```typescript
placeholder="π.χ. A-12, P-034"
```

---

### 42. OverlayList.tsx
**Path**: `src/subapps/dxf-viewer/ui/OverlayList.tsx`
**Lines**: 108, 168, 177
**Labels**: 3

```typescript
placeholder="Αναζήτηση..."
title="Επεξεργασία"
title="Διαγραφή"
```

---

### 43. usePanelContentRenderer.tsx
**Path**: `src/subapps/dxf-viewer/ui/hooks/usePanelContentRenderer.tsx`
**Lines**: 61, 70, 103, 114
**Labels**: 4

```typescript
loadingText="Φόρτωση διαχείρισης επιπέδων..."
loadingText="Φόρτωση επιπέδων..."
loadingText="Φόρτωση ιεραρχίας..."
loadingText="Φόρτωση παλέτας χρωμάτων..."
```

---

### 44. CursorSettingsPanel.tsx
**Path**: `src/subapps/dxf-viewer/ui/CursorSettingsPanel.tsx`
**Lines**: 387, 406, 416, 426
**Labels**: 4

```typescript
label="Ενεργοποιηση Σταυρονηματος"
label="Ενδειξεις Snap (Συνδεδεμενο)"
label="Εμφανιση Συντεταγμενων (Συνδεδεμενο)"
label="Δυναμικη Εισαγωγη (Συνδεδεμενο)"
```

---

### 45. CoordinateCalibrationOverlay.tsx
**Path**: `src/subapps/dxf-viewer/ui/CoordinateCalibrationOverlay.tsx`
**Lines**: 110, 165
**Labels**: 2

```typescript
title="Κλείσιμο"
aria-label="Περιοχή τεστ ακρίβειας συντεταγμένων"
```

---

### 46. ProSnapToolbar.tsx
**Path**: `src/subapps/dxf-viewer/ui/components/ProSnapToolbar.tsx`
**Lines**: 161, 199
**Labels**: 2

```typescript
title="Ενεργοποίηση/Απενεργοποίηση Object Snap (F3)"
title="Ενεργοποίηση βασικών λειτουργιών"
```

---

### 47. CursorColorPalette.tsx
**Path**: `src/subapps/dxf-viewer/ui/components/palettes/CursorColorPalette.tsx`
**Lines**: 170-208
**Labels**: 10

```typescript
label="Γέμισμα", description="Εσωτερικό κουτιού"
label="Περίγραμμα", description="Εξωτερική γραμμή"
label="Είδος Περιγράμματος", description="Τύπος γραμμής..."
// Και ακόμα για άλλα color selectors
```

---

### 48. LevelPanel.tsx
**Path**: `src/subapps/dxf-viewer/ui/components/LevelPanel.tsx`
**Lines**: 162, 324, 335, 360
**Labels**: 4

```typescript
"Το όνομα δεν μπορεί να είναι κενό."
title="Μετονομασία επιπέδου"
title="Διαγραφή επιπέδου"
placeholder="Όνομα νέου επιπέδου..."
```

---

### 49. LayerItem.tsx
**Path**: `src/subapps/dxf-viewer/ui/components/layers/LayerItem.tsx`
**Lines**: 216, 232, 266, 275, 284
**Labels**: 5

```typescript
title={isLayerExpanded ? "Σύμπτυξη στοιχείων" : "Ανάπτυξη στοιχείων"}
title="Αλλαγή χρώματος"
title={layer.visible ? "Απόκρυψη" : "Εμφάνιση"}
title="Μετονομασία layer"
title="Διαγραφή"
```

---

### 50. SearchInput.tsx (layers)
**Path**: `src/subapps/dxf-viewer/ui/components/layers/components/SearchInput.tsx`
**Line**: 24
**Labels**: 1

```typescript
placeholder="Αναζήτηση layers και entities..."
```

---

### 51. MergePanel.tsx
**Path**: `src/subapps/dxf-viewer/ui/components/layers/components/MergePanel.tsx`
**Lines**: 46, 62, 78
**Labels**: 3

```typescript
title="Συγχώνευση επιλεγμένων entities"
title="Συγχώνευση επιλεγμένων layers"
title="Συγχώνευση επιλεγμένων color groups"
```

---

### 52. EntityCard.tsx
**Path**: `src/subapps/dxf-viewer/ui/components/layers/components/EntityCard.tsx`
**Lines**: 97, 159, 178, 192
**Labels**: 4

```typescript
title="Αλλαγή χρώματος entity"
title={entity.visible === false ? "Εμφάνιση" : "Απόκρυψη"}
title="Μετονομασία entity"
title="Διαγραφή"
```

---

### 53. ColorGroupItem.tsx
**Path**: `src/subapps/dxf-viewer/ui/components/layers/ColorGroupItem.tsx`
**Lines**: 149, 156, 170, 201, 216, 225
**Labels**: 6

```typescript
title="Κλικ για επιλογή όλων των entities..."
title={isExpanded ? "Σύμπτυξη" : "Ανάπτυξη"}
title="Αλλαγή χρώματος Color Group"
title={allVisible ? "Απόκρυψη Color Group" : "Εμφάνιση Color Group"}
title="Μετονομασία Color Group"
title="Διαγραφή Color Group"
```

---

### 54. LayerList.tsx (layer-manager)
**Path**: `src/subapps/dxf-viewer/ui/components/layer-manager/LayerList.tsx`
**Line**: 66
**Labels**: 1

```typescript
title="Περισσότερες επιλογές"
```

---

### 55. LayerHeader.tsx (layer-manager)
**Path**: `src/subapps/dxf-viewer/ui/components/layer-manager/LayerHeader.tsx`
**Lines**: 21, 30, 39
**Labels**: 3

```typescript
title={isConnected ? "Συνδεδεμένο - Real-time sync..." : "Αποσυνδεδεμένο"}
title="Προσθήκη νέου layer"
title="Ρυθμίσεις"
```

---

### 56. LayerFilters.tsx (layer-manager)
**Path**: `src/subapps/dxf-viewer/ui/components/layer-manager/LayerFilters.tsx`
**Line**: 24
**Labels**: 1

```typescript
placeholder="Αναζήτηση layers..."
```

---

### 57. SelectionSettings.tsx
**Path**: `src/subapps/dxf-viewer/ui/components/dxf-settings/settings/special/SelectionSettings.tsx`
**Lines**: 137, 175, 297, 335
**Labels**: 4

```typescript
title="Επιλογή Χρώματος Γεμίσματος Window"
title="Επιλογή Χρώματος Περιγράμματος Window"
title="Επιλογή Χρώματος Γεμίσματος Crossing"
title="Επιλογή Χρώματος Περιγράμματος Crossing"
```

---

### 58-63. Ruler & Other Settings (DXF)

| File | Line | Label |
|------|------|-------|
| RulerMinorLinesSettings.tsx | 222 | "Επιλογή Χρώματος Δευτερευουσών Γραμμών Χάρακα" |
| RulerMajorLinesSettings.tsx | 222 | "Επιλογή Χρώματος Κύριων Γραμμών Χάρακα" |
| RulerBackgroundSettings.tsx | 202 | "Επιλογή Χρώματος Φόντου Χάρακα" |
| EntitiesSettings.tsx | 440+ | Πολλές περιγραφές |
| CursorSettings.tsx | 125 | "Επιλογή Χρώματος Κέρσορα" |
| CrosshairBehaviorSettings.tsx | 115 | "Επιλογή Χρώματος Crosshair" |
| CrosshairAppearanceSettings.tsx | 119 | "Επιλογή Χρώματος Σταυρώνυματος" |
| TextSettings.tsx | 347, 353 | aria-labels |

---

## 🟡 TYPES - Constants & Mock Data

### 64. unit.ts
**Path**: `src/types/unit.ts`
**Line**: 6
**Labels**: 7

```typescript
// Union type με hardcoded Greek:
'Στούντιο' | 'Γκαρσονιέρα' | 'Διαμέρισμα 2Δ' |
'Διαμέρισμα 3Δ' | 'Μεζονέτα' | 'Κατάστημα' | 'Αποθήκη'
```

---

### 65. storage/constants.ts
**Path**: `src/types/storage/constants.ts`
**Lines**: 7-59
**Labels**: 25+

```typescript
// Floor labels:
'Υπόγειο', 'Ισόγειο', etc.
// Features:
'Ηλεκτρικό ρεύμα', 'Φυσικός φωτισμός', etc.
// Parking features:
'Πρίζα φόρτισης EV', 'Κλειστό', etc.
// Status labels:
'Διαθέσιμο', 'Πωλήθηκε', etc.
```

---

### 66. project.ts
**Path**: `src/types/project.ts`
**Lines**: 41-45
**Labels**: 5

```typescript
'planning': 'Σχεδιασμός'
'in_progress': 'Σε εξέλιξη'
'completed': 'Ολοκληρωμένο'
'on_hold': 'Σε αναμονή'
'cancelled': 'Ακυρωμένο'
```

---

### 67. parking.ts
**Path**: `src/types/parking.ts`
**Lines**: 55-57
**Labels**: 3

```typescript
'underground': 'Υπόγεια'
'covered': 'Σκεπαστή'
'open': 'Υπαίθρια'
```

---

### 68. mock-obligations.ts
**Path**: `src/types/mock-obligations.ts`
**Lines**: 83-137
**Labels**: 15+

```typescript
// Mock data με hardcoded Greek:
'Συγγραφή Υποχρεώσεων - Οικόπεδο Αθανασιάδη'
'Επέκταση Θέρμης'
'Αθανασιάδης Απόστολος', 'Αθανασιάδης Αντώνης'
'Θεσσαλονίκη', 'Σαμοθράκης 16, Κορδελιό'
'Παπαδόπουλος Γεώργιος'
```

---

### 69. usePropertyState.ts
**Path**: `src/hooks/usePropertyState.ts`
**Lines**: 73-114
**Labels**: 10+

```typescript
// Mock property objects:
'Διαμέρισμα Α1', 'Διαμέρισμα 2Δ', 'Κτίριο Alpha', etc.
```

---

## 🟢 BUILDING FEATURES (Σημαντικό - 171 labels)

### 70. building-features-i18n.ts
**Path**: `src/utils/building-features-i18n.ts`
**Lines**: 89-170
**Labels**: 171 (!)

**ΣΗΜΕΙΩΣΗ**: Αυτό είναι ένα **reverse lookup utility** που μετατρέπει Greek database strings σε i18n keys.
Οι μεταφράσεις υπάρχουν στο `building.storageForm.features.building.*`

```typescript
// Δείγμα entries:
'Συστήματα ασφαλείας' → i18n key
'Μηχανική Ασφάλεια' → i18n key
'Έξοδοι Κινδύνου' → i18n key
'Πυρόσβεση' → i18n key
'Ενεργειακή Κλάση Α+' → i18n key
// ... 166 ακόμα entries
```

---

## ΣΤΑΤΙΣΤΙΚΑ ΣΥΝΟΨΗΣ

| Κατηγορία | Αρχεία | Labels |
|-----------|--------|--------|
| 🔴 Lib/Utils (Core Logic) | 9 | ~100 |
| 🟠 Features (Units, Property) | 12 | ~35 |
| 🟠 Core (Headers, Modals) | 7 | ~85 |
| 🟠 Components (Generic, Photos) | 4 | ~16 |
| 🟠 Subapps - Geo-Canvas | 5 | ~26 |
| 🟠 Subapps - DXF-Viewer UI | 27 | ~80 |
| 🟡 Types & Mock Data | 6 | ~70 |
| 🟢 Building Features | 1 | 171 |
| **ΣΥΝΟΛΟ** | **72** | **~580** |

---

## ΠΡΟΤΕΡΑΙΟΤΗΤΑ ΕΡΓΑΣΙΩΝ

### Phase 1: Core Logic (HIGHEST PRIORITY)
Αυτά τα αρχεία επηρεάζουν τη λειτουργικότητα σε όλη την εφαρμογή:

1. `toast-presets.ts` - 5 labels (toasts εμφανίζονται παντού)
2. `validation.ts` - 42 labels (validation errors)
3. `pdf-utils.ts` - 12 labels (PDF handling)
4. `obligations/validation.ts` - 12 labels
5. `data-cleaning.ts` - 15 labels

### Phase 2: Features UI
Τα features components χρησιμοποιούνται άμεσα από τους χρήστες:

1. Units Toolbar components (8 labels)
2. Units Sidebar components (5 labels)
3. Property Viewer components (5 labels)

### Phase 3: Core UI Components
1. PhotoPreviewModal.tsx (15 labels)
2. EnterpriseHeaderActions.tsx (8 labels)
3. DetailsContainer.tsx (2 labels)
4. enterprise-messages-system.ts (20+ labels)

### Phase 4: DXF-Viewer UI (27 files)
Μεγάλη ομάδα με ~80 hardcoded labels

### Phase 5: Types & Constants
1. unit.ts - Union type refactoring
2. storage/constants.ts
3. project.ts
4. parking.ts

---

## ΟΔΗΓΙΕΣ ΜΕΤΑΤΡΟΠΗΣ

### Για Toast Presets:
```typescript
// ΠΡΙΝ:
title: "Επιτυχία"

// ΜΕΤΑ:
title: 'toast.success' // i18n key
// + translation στο common.json
```

### Για Validation Messages:
```typescript
// ΠΡΙΝ:
'Το όνομα είναι υποχρεωτικό'

// ΜΕΤΑ:
'validation.name.required' // i18n key
// Components που καλούν validation θα κάνουν t(errorKey)
```

### Για Type Union Labels:
```typescript
// ΠΡΙΝ (unit.ts):
type UnitType = 'Στούντιο' | 'Γκαρσονιέρα' | ...

// ΜΕΤΑ:
type UnitType = 'studio' | 'bedsit' | ... // English keys
// + mapping object: UNIT_TYPE_LABELS['studio'] = 'unit.types.studio'
```

---

## CHANGELOG

| Ημερομηνία | Αλλαγές |
|------------|---------|
| 2026-01-18 | Αρχική αναφορά - 280+ αρχεία |
| 2026-01-18 | Ολοκλήρωση Phase 1 Critical Configs (6/6) |
| 2026-01-18 | Ολοκλήρωση Space Management (5/5 active) |
| 2026-01-18 | Ολοκλήρωση Navigation components (3/3) |
| 2026-01-18 | **ΕΞΟΝΥΧΙΣΤΙΚΗ ΕΡΕΥΝΑ**: Πλήρης σάρωση όλης της εφαρμογής. Βρέθηκαν 72 αρχεία με 500+ hardcoded Greek strings. |

---

**Generated by**: Claude Opus 4.5 (Anthropic)
**Last Updated**: 2026-01-18
