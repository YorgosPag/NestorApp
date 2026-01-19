# HARDCODED LABELS REPORT

**Ημερομηνία Αναφοράς:** 2026-01-19
**Scope:** Ολόκληρη η εφαρμογή (`src/`)
**Συνολικά Ευρήματα:** ~200+ hardcoded labels

---

## ΣΥΝΟΠΤΙΚΑ ΣΤΑΤΙΣΤΙΚΑ

| Κατηγορία | Instances | Κύρια Hotspots |
|-----------|-----------|----------------|
| Greek Titles | 63 | DXF Viewer Settings, Layers, Toolbar |
| Greek Placeholders | 10 | DynamicInputOverlay, SearchInput, LevelSelection |
| English Placeholders | 35 | Forms, Coordinates, Contact Renderers |
| Greek Aria-Labels | ~20 | Layer components, CRM pages, DXF overlay |
| English Aria-Labels | ~50 | Accessibility elements throughout |
| Headings | 34 | Demo/Dev pages, Admin panels |
| Button Text (sr-only) | 3 | Dialog, Sheet, Alert components |
| SelectValue Placeholders | 2 | DXF components |
| **TOTAL** | **~200+** | **Primarily DXF Viewer subsystem** |

---

## 1. HARDCODED GREEK TITLES (`title="..."`) - 63 INSTANCES

### GripSettings.tsx
**Path:** `src/subapps/dxf-viewer/ui/components/dxf-settings/settings/core/GripSettings.tsx`

| Line | Hardcoded Title |
|------|-----------------|
| 121 | `title="Επαναφορά στις προεπιλεγμένες ρυθμίσεις"` |
| 132 | `title="Επαναφορά στις εργοστασιακές ρυθμίσεις (CAD Standards)"` |
| 171 | `title="Βασικές Ρυθμίσεις"` |
| 238 | `title="Χρώματα Grips"` |
| 254 | `title="Επιλογή Χρώματος Cold Grip"` |
| 270 | `title="Επιλογή Χρώματος Warm Grip"` |
| 286 | `title="Επιλογή Χρώματος Hot Grip"` |
| 302 | `title="Επιλογή Χρώματος Contour Grip"` |
| 315 | `title="Τύποι Grips"` |
| 356 | `title="Προχωρημένες Ρυθμίσεις"` |

### LineSettings.tsx
**Path:** `src/subapps/dxf-viewer/ui/components/dxf-settings/settings/core/LineSettings.tsx`

| Line | Hardcoded Title |
|------|-----------------|
| 408 | `title="Επαναφορά στις προεπιλεγμένες ρυθμίσεις"` |
| 419 | `title="Επαναφορά στις εργοστασιακές ρυθμίσεις (ISO 128 & AutoCAD 2024)"` |
| 458 | `title="Πρότυπα & Εργαλεία"` |
| 496 | `title="Βασικές Ρυθμίσεις"` |
| 567 | `title="Επιλογή Χρώματος Γραμμής"` |
| 622 | `title="Ρυθμίσεις Hover"` |
| 638 | `title="Επιλογή Χρώματος Hover"` |
| 705 | `title="Τελικές Ρυθμίσεις Γραμμής"` |
| 721 | `title="Επιλογή Τελικού Χρώματος"` |
| 788 | `title="Προχωρημένες Ρυθμίσεις"` |

### TextSettings.tsx
**Path:** `src/subapps/dxf-viewer/ui/components/dxf-settings/settings/core/TextSettings.tsx`

- `title="Επαναφορά στις προεπιλεγμένες ρυθμίσεις"`
- `title="Επαναφορά στις εργοστασιακές ρυθμίσεις"`
- `title="Βασικές Ρυθμίσεις Κειμένου"`
- `title="Επιλογή Χρώματος Κειμένου"`
- `title="Ρυθμίσεις Hover"`
- `title="Ρυθμίσεις Επιλεγμένου"`
- `title="Προχωρημένες Ρυθμίσεις"`

### DraggableOverlayToolbar.tsx
**Path:** `src/subapps/dxf-viewer/ui/components/DraggableOverlayToolbar.tsx`

| Line | Hardcoded Title |
|------|-----------------|
| 251 | `title="Αντιγραφή (D)"` |
| 258 | `title="Διαγραφή (Del)"` |
| 272 | `title="Αναίρεση (Ctrl+Z)"` |
| 279 | `title="Επανάληψη (Ctrl+Y)"` |

### LayerItem.tsx
**Path:** `src/subapps/dxf-viewer/ui/components/layers/LayerItem.tsx`

- `title="Αλλαγή χρώματος"`
- `title="Μετονομασία layer"`
- `title="Διαγραφή"`

### ColorGroupItem.tsx
**Path:** `src/subapps/dxf-viewer/ui/components/layers/ColorGroupItem.tsx`

- `title="Αλλαγή χρώματος Color Group"`
- `title="Μετονομασία Color Group"`
- `title="Διαγραφή Color Group"`
- `title="Toggle ορατότητας"`

---

## 2. HARDCODED PLACEHOLDERS (`placeholder="..."`) - 45 INSTANCES

### Greek Placeholders (10 instances)

| File | Placeholder |
|------|-------------|
| `src/subapps/dxf-viewer/ui/components/layers/components/SearchInput.tsx` | `"Αναζήτηση layers και entities..."` |
| `src/subapps/dxf-viewer/ui/wizard/LevelSelectionStep.tsx` | `"Εισάγετε όνομα επιπέδου (π.χ. Υπόγειο, 2ος Όροφος)"` |
| `src/components/ui/email-sharing/EmailShareForm.original.tsx` | `"Προσθέστε ένα προσωπικό μήνυμα..."` |
| `src/subapps/dxf-viewer/systems/dynamic-input/components/DynamicInputOverlay.tsx` | `"π.χ. -1000.56"` |
| `src/subapps/dxf-viewer/systems/dynamic-input/components/DynamicInputOverlay.tsx` | `"π.χ. +750,32"` |
| `src/subapps/dxf-viewer/systems/dynamic-input/components/DynamicInputOverlay.tsx` | `"π.χ. 45 ή 90.5"` |
| `src/subapps/dxf-viewer/systems/dynamic-input/components/DynamicInputOverlay.tsx` | `"π.χ. 100.0"` |
| `src/subapps/dxf-viewer/systems/dynamic-input/components/DynamicInputOverlay.tsx` | `"π.χ. 50.0"` |
| `src/subapps/dxf-viewer/systems/dynamic-input/components/DynamicInputOverlay.tsx` | `"π.χ. 100.0"` |
| `src/subapps/dxf-viewer/components/HierarchicalDestinationSelector.tsx` | `"-- Επιλέξτε Έργο --"` |

### English Placeholders (35 instances)

| File | Placeholder |
|------|-------------|
| `src/components/account/TwoFactorEnrollment.tsx` | `"000000"` |
| `src/components/building-management/StorageForm/form/FormRowCoordinates.tsx` | `"X"`, `"Y"` |
| `src/components/contacts/dynamic/communication/renderers/EmailRenderer.tsx` | `"john@example.com"` |
| `src/components/contacts/dynamic/communication/renderers/PhoneRenderer.tsx` | `"+30"`, `"2310 123456"` |
| `src/components/contacts/dynamic/communication/renderers/SocialRenderer.tsx` | `"john-doe"`, `"https://..."` |
| `src/components/contacts/dynamic/communication/renderers/WebsiteRenderer.tsx` | `"https://example.com"` |
| `src/components/development/ErrorReportingDashboard.tsx` | `"Filter errors..."` |
| `src/subapps/dxf-viewer/ui/components/dxf-settings/controls/LineStyleControl.tsx` | `"Select line style..."` |
| `src/subapps/dxf-viewer/ui/toolbar/ScaleControls.tsx` | `"100"` |
| `src/subapps/dxf-viewer/ui/toolbar/ZoomControls.tsx` | `"100"` |
| `src/subapps/geo-canvas/components/CoordinatePicker.tsx` | `"0.00"`, `"1.0"`, `"Optional description"` |

---

## 3. HARDCODED ARIA-LABELS (`aria-label="..."`) - 70 INSTANCES

### Greek Aria-Labels (~20 instances)

| File | Aria-Label |
|------|------------|
| `src/app/crm/leads/[id]/page.tsx` | `"Φόρτωση σελίδας"` |
| `src/app/crm/leads/[id]/page.tsx` | `"Πλοήγηση lead profile"` |
| `src/app/crm/leads/[id]/page.tsx` | `"Επιστροφή"` |
| `src/app/crm/leads/[id]/page.tsx` | `"Στοιχεία επαφής και γρήγορες ενέργειες"` |
| `src/app/crm/leads/[id]/page.tsx` | `"Εργασίες και ιστορικό επικοινωνίας"` |
| `src/subapps/dxf-viewer/ui/components/layers/ColorGroupItem.tsx` | `"Κλικ για επιλογή όλων των entities..."` |
| `src/subapps/dxf-viewer/ui/components/layers/ColorGroupItem.tsx` | `"Αλλαγή χρώματος Color Group"` |
| `src/subapps/dxf-viewer/ui/components/layers/ColorGroupItem.tsx` | `"Μετονομασία Color Group"` |
| `src/subapps/dxf-viewer/ui/components/layers/ColorGroupItem.tsx` | `"Διαγραφή Color Group"` |
| `src/subapps/dxf-viewer/ui/components/layers/EntityItem.tsx` | `"Αλλαγή χρώματος entity"` |
| `src/subapps/dxf-viewer/ui/components/layers/EntityItem.tsx` | `"Μετονομασία entity"` |
| `src/subapps/dxf-viewer/ui/components/layers/EntityItem.tsx` | `"Διαγραφή"` |
| `src/subapps/dxf-viewer/ui/components/layers/MergeControls.tsx` | `"Συγχώνευση επιλεγμένων entities"` |
| `src/subapps/dxf-viewer/ui/components/layers/MergeControls.tsx` | `"Συγχώνευση επιλεγμένων layers"` |
| `src/subapps/dxf-viewer/ui/components/layers/MergeControls.tsx` | `"Συγχώνευση επιλεγμένων color groups"` |
| `src/subapps/dxf-viewer/ui/components/layers/LayerItem.tsx` | `"Αλλαγή χρώματος"` |
| `src/subapps/dxf-viewer/ui/components/layers/LayerItem.tsx` | `"Μετονομασία layer"` |
| `src/subapps/dxf-viewer/ui/components/layers/LayerItem.tsx` | `"Διαγραφή"` |
| `src/subapps/dxf-viewer/ui/OverlayToolbar.tsx` | `"Ενεργοποίηση/Απενεργοποίηση Object Snap (F3)"` |
| `src/subapps/dxf-viewer/ui/OverlayToolbar.tsx` | `"Ενεργοποίηση βασικών λειτουργιών"` |

### English Aria-Labels (~50 instances)

| File | Aria-Label |
|------|------------|
| `src/app/dashboard/page.tsx` | `"Dashboard"` |
| `src/components/generic/table/PaginationControls.tsx` | `"Pagination"` |
| `src/subapps/dxf-viewer/components/DXFDropzone.tsx` | `"DXF Viewer"`, `"File drop zone"` |
| `src/components/sessions/SessionsList.tsx` | `"Loading sessions"` |
| `src/subapps/dxf-viewer/ui/components/layer-manager/LayerFilters.tsx` | `"Toggle filters"` |
| `src/subapps/dxf-viewer/ui/OverlayToolbar.tsx` | `"File management tools"` |
| `src/components/ui/skeleton.tsx` | `"Loading modal..."`, `"Loading chart..."`, `"Loading sidebar..."` |
| Various | `"Notifications"`, `"Close"`, `"Zoom in"`, `"Zoom out"`, etc. |

---

## 4. HARDCODED HEADING TEXT (`<h1-h6>`) - 34 INSTANCES

### Greek Headings

| File | Heading Text |
|------|--------------|
| `src/app/admin/link-units/page.tsx` | `"Σύνδεση Sold Units με Customers"` |

### English Headings

| File | Heading Text |
|------|--------------|
| `src/app/debug/token-info/page.tsx` | `"User Object:"`, `"Full User Object (Raw):"` |
| `src/app/test-cursor/page.tsx` | `"Test Cursor Settings Panel"` |
| `src/components/compositions/ComponentShowcase/ComponentShowcase.tsx` | `"Component Composition Showcase"` |
| `src/components/compositions/ToolbarShowcase/ToolbarShowcase.tsx` | `"Toolbar Composition Showcase"` |
| `src/components/development/ErrorReportingDashboard.tsx` | `"Error Details"`, `"Summary"`, `"Message"` |
| `src/components/providers/OptimizedAppProvider.tsx` | `"Nextn CRM"`, `"Application Error"`, `"Performance Stats"` |
| `src/components/realtime/NotificationSystem.tsx` | `"Notifications"` |

---

## 5. HARDCODED BUTTON/SR-ONLY TEXT - 3 INSTANCES

| File | Line | Text |
|------|------|------|
| `src/components/ui/dialog.tsx` | 36 | `"Close"` |
| `src/components/ui/sheet.tsx` | 37 | `"Close"` |
| `src/subapps/geo-canvas/components/AlertManagementPanel.tsx` | 129 | `"Close"` |

---

## 6. SELECTVALUE PLACEHOLDERS - 2 INSTANCES

| File | Placeholder |
|------|-------------|
| `src/subapps/dxf-viewer/components/HierarchicalDestinationSelector.tsx` | `"-- Επιλέξτε Έργο --"` |
| `src/subapps/dxf-viewer/ui/components/dxf-settings/controls/LineStyleControl.tsx` | `"Select line style..."` |

---

## ΑΡΧΕΙΑ ΠΟΥ ΧΡΕΙΑΖΟΝΤΑΙ ΑΛΛΑΓΗ (Priority Order)

### Tier 1 - CRITICAL (Greek UI - User-facing)

| # | File | Issues |
|---|------|--------|
| 1 | `src/subapps/dxf-viewer/ui/components/dxf-settings/settings/core/GripSettings.tsx` | 10 titles |
| 2 | `src/subapps/dxf-viewer/ui/components/dxf-settings/settings/core/LineSettings.tsx` | 10 titles |
| 3 | `src/subapps/dxf-viewer/ui/components/dxf-settings/settings/core/TextSettings.tsx` | 11 titles |
| 4 | `src/subapps/dxf-viewer/ui/components/DraggableOverlayToolbar.tsx` | 4 titles |
| 5 | `src/subapps/dxf-viewer/ui/components/layers/LayerItem.tsx` | 3 titles, 3 aria-labels |
| 6 | `src/subapps/dxf-viewer/ui/components/layers/ColorGroupItem.tsx` | 4 titles, 4 aria-labels |
| 7 | `src/subapps/dxf-viewer/ui/components/layers/EntityItem.tsx` | 3 aria-labels |
| 8 | `src/subapps/dxf-viewer/ui/components/layers/MergeControls.tsx` | 3 aria-labels |
| 9 | `src/subapps/dxf-viewer/systems/dynamic-input/components/DynamicInputOverlay.tsx` | 6 placeholders |
| 10 | `src/subapps/dxf-viewer/ui/components/layers/components/SearchInput.tsx` | 1 placeholder |
| 11 | `src/subapps/dxf-viewer/ui/OverlayToolbar.tsx` | 2 aria-labels |

### Tier 2 - IMPORTANT (Placeholders & Forms)

| # | File | Issues |
|---|------|--------|
| 12 | `src/components/contacts/dynamic/communication/renderers/EmailRenderer.tsx` | 1 placeholder |
| 13 | `src/components/contacts/dynamic/communication/renderers/PhoneRenderer.tsx` | 2 placeholders |
| 14 | `src/components/contacts/dynamic/communication/renderers/SocialRenderer.tsx` | 2 placeholders |
| 15 | `src/components/contacts/dynamic/communication/renderers/WebsiteRenderer.tsx` | 1 placeholder |
| 16 | `src/components/building-management/StorageForm/form/FormRowCoordinates.tsx` | 2 placeholders |
| 17 | `src/subapps/geo-canvas/components/CoordinatePicker.tsx` | 5 placeholders |
| 18 | `src/subapps/dxf-viewer/ui/wizard/LevelSelectionStep.tsx` | 1 placeholder |
| 19 | `src/subapps/dxf-viewer/components/HierarchicalDestinationSelector.tsx` | 1 placeholder |

### Tier 3 - NICE TO HAVE (Aria-labels, Demo pages, Dev tools)

| # | File | Issues |
|---|------|--------|
| 20 | `src/app/crm/leads/[id]/page.tsx` | 5 aria-labels |
| 21 | `src/components/ui/dialog.tsx` | 1 sr-only |
| 22 | `src/components/ui/sheet.tsx` | 1 sr-only |
| 23 | `src/components/ui/skeleton.tsx` | 4 aria-labels |
| 24 | `src/app/debug/token-info/page.tsx` | 2 headings |
| 25 | `src/app/test-cursor/page.tsx` | 1 heading |
| 26 | `src/components/compositions/*` | Multiple headings |
| 27 | `src/components/development/ErrorReportingDashboard.tsx` | 3 headings |

---

## ΣΥΜΠΕΡΑΣΜΑ

### Κατανομή ανά Subsystem

| Subsystem | % of Total | Priority |
|-----------|------------|----------|
| DXF Viewer | ~80% | **HIGH** |
| Components (UI) | ~10% | MEDIUM |
| CRM Pages | ~5% | MEDIUM |
| Dev/Debug Pages | ~5% | LOW |

### Προτεινόμενη Στρατηγική

1. **Δημιουργία i18n keys** στο `src/i18n/locales/el/dxf-viewer.json` για όλα τα DXF labels
2. **Αντικατάσταση hardcoded strings** με `t('key')` calls
3. **Testing** για να βεβαιωθούμε ότι όλα τα labels εμφανίζονται σωστά
4. **English translations** στο `src/i18n/locales/en/dxf-viewer.json` αν χρειάζεται multilingual support

### Εκτίμηση Εργασίας

| Tier | Αρχεία | Hardcoded Strings |
|------|--------|-------------------|
| Tier 1 | 11 | ~100 |
| Tier 2 | 8 | ~50 |
| Tier 3 | 7+ | ~50 |
| **Total** | **26+** | **~200+** |

---

*Report generated: 2026-01-19*




❯ src\subapps\dxf-viewer\  Θέλω να ψάξεις μέσα σε αυτόν τον φάκελο και σε όλους τους υποφακέλους και σε όλα τα αρχεία εάν υπάρχουν σκληροκωδικοποιημένα labels τα οποία πρέπει      
  να μεταφραστούν με το σύστημα i 18n                                                                                                                                               

● Explore(Find hardcoded labels for i18n)
  ⎿  Done (26 tool uses · 69.2k tokens · 34m 22s)

● 📊 ΑΠΟΤΕΛΕΣΜΑΤΑ ΕΡΕΥΝΑΣ: Hardcoded Labels για i18n

  Βρέθηκαν 74+ hardcoded strings σε ~30 αρχεία που χρειάζονται i18n.

  ---
  📋 ΣΥΝΟΨΗ ΑΝΑ ΚΑΤΗΓΟΡΙΑ:
  ┌─────────────────────┬────────┬─────────┐
  │      Κατηγορία      │ Αρχεία │ Strings │
  ├─────────────────────┼────────┼─────────┤
  │ PDF Controls Panel  │ 1      │ 17      │
  ├─────────────────────┼────────┼─────────┤
  │ Text/Color Settings │ 8      │ 18      │
  ├─────────────────────┼────────┼─────────┤
  │ Layer Components    │ 4      │ 12      │
  ├─────────────────────┼────────┼─────────┤
  │ Overlay Toolbar     │ 2      │ 6       │
  ├─────────────────────┼────────┼─────────┤
  │ CadDock Layout      │ 1      │ 18      │
  ├─────────────────────┼────────┼─────────┤
  │ Dynamic Input       │ 1      │ 6       │
  ├─────────────────────┼────────┼─────────┤
  │ Άλλα                │ ~10    │ ~10     │
  └─────────────────────┴────────┴─────────┘
  ---
  🔴 ΚΡΙΣΙΜΟΤΕΡΑ ΑΡΧΕΙΑ:

  1. layout/CadDock.tsx - 18 strings (Panel headers, commands)
  2. pdf-background/components/PdfControlsPanel.tsx - 17 strings
  3. ui/components/dxf-settings/settings/core/TextSettings.tsx - 8 strings (ελληνικά)
  4. ui/components/layers/ColorGroupItem.tsx - 6 strings (ελληνικά)
  5. ui/components/DraggableOverlayToolbar.tsx - 5 strings (ελληνικά)

  ---
  🇬🇷 ΕΛΛΗΝΙΚΑ HARDCODED (πρέπει να γίνουν i18n):


  - "Βασικές Ρυθμίσεις Κειμένου"
  - "Αύξηση μεγέθους γραμματοσειράς"
  - "Επιλογή Χρώματος Κειμένου"
  - "Αντιγραφή (D)"
  - "Διαγραφή (Del)"
  - "Αναζήτηση layers και entities..."
  - "Συγχώνευση επιλεγμένων entities"
  - "π.χ. -1000.56" (placeholders)

  ---
  🇬🇧 ΑΓΓΛΙΚΑ HARDCODED:


  - "PDF Background"
  - "Loading..."
  - "Upload PDF"
  - "Object Snap"
  - "Layers"
  - "Properties"
  - "Command History"
  - "Drawing Tools"

  ---
  🎯 ΠΡΟΤΕΙΝΟΜΕΝΗ ΔΟΜΗ i18n KEYS:

  // dxf-viewer namespace
  {
    "panelHeaders": {
      "objectSnap": "Object Snap",
      "layers": "Layers",
      "properties": "Properties",
      "commands": "Commands"
    },
    "pdfPanel": {
      "title": "PDF Background",
      "uploadButton": "Upload PDF",
      "scale": "Scale",
      "rotation": "Rotation"
    },
    "textSettings": {
      "title": "Basic Text Settings",
      "increaseFontSize": "Increase font size"
    },
    "layers": {
      "searchPlaceholder": "Search layers and entities...",
      "mergeEntities": "Merge selected entities"
    }
  }

  ---