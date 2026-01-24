# 🏢 **UNIT FIELDS SYSTEM**

> **Enterprise Unit Property Management**
>
> Complete system για διαχείριση extended unit fields (layout, areas, orientations, systems, features)

**📅 Implemented**: 2026-01-24 | **Status**: ✅ **PRODUCTION READY**

---

## 📋 **OVERVIEW**

Το Unit Fields System παρέχει πλήρη διαχείριση extended fields για μονάδες ακινήτων:

| Category | Fields | Purpose |
|----------|--------|---------|
| **Layout** | bedrooms, bathrooms, wc | Room configuration |
| **Areas** | gross, net, balcony, terrace, garden | Square meters |
| **Orientation** | 8 compass directions | Sun exposure |
| **Condition** | new, excellent, good, needs-renovation | Property state |
| **Energy** | A+ to G classes | Energy certification |
| **Systems** | heating, cooling | HVAC configuration |
| **Finishes** | flooring, frames, glazing | Material specs |
| **Features** | interior, security | Amenities & safety |

---

## 🏗️ **ARCHITECTURE**

### Component Hierarchy

```
UnitsSidebar
  └── UniversalTabsRenderer
        └── PropertyDetailsContent
              └── UnitFieldsBlock  ← CORE COMPONENT
                    ├── Layout Section
                    ├── Areas Section
                    ├── Orientation Section
                    ├── Condition & Energy Section
                    ├── Systems Section
                    ├── Finishes Section
                    └── Features Section
```

### Data Flow (Updated 2026-01-24)

```
┌─────────────────────────────────────────────────────────────┐
│                    USER INTERACTION                          │
│  UnitFieldsBlock.handleSave()                               │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    PROP CHAIN                                │
│  onUpdateProperty(unitId, updates)                          │
│    └── PropertyDetailsContent.safeOnUpdateProperty          │
│          └── additionalData.onUpdateProperty (UnitsSidebar) │
│                └── safeViewerPropsWithFloors.handleUpdate   │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    HOOK                                      │
│  useUnitsSidebar.handleUpdateProperty()                     │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    FIRESTORE SERVICE                         │
│  updateUnit(unitId, updates)                                │
│    └── Firestore Document Updated ✅                         │
└─────────────────────────────────────────────────────────────┘
```

### ⚠️ Important Notes

1. **Firestore Rules**: ✅ **ENTERPRISE SECURITY (2026-01-24)**: Η collection `units` έχει πλήρη tenant isolation:
   - **READ**: Μόνο χρήστες που ανήκουν στην εταιρεία του project (via `belongsToProjectCompany`)
   - **UPDATE**: Μόνο company admins της εταιρείας του project + field allowlist + invariants
   - **Field Allowlist**: `name`, `description`, `layout`, `areas`, `orientations`, `condition`, `energyClass`, `systemsOverride`, `finishes`, `energy`, `interiorFeatures`, `securityFeatures`, `updatedAt`, `updatedBy`, `operationalStatus`, `unitCoverage`
   - **Invariants Protected**: `project`, `buildingId`, `floorId`, `id` (δεν αλλάζουν από client)
   - ⚠️ Το `isAuthenticated()` **ΑΠΑΓΟΡΕΥΕΤΑΙ** σε multi-tenant εφαρμογή χωρίς tenant isolation
2. **Undefined Values**: Firestore ΔΕΝ δέχεται `undefined` - πρέπει να φιλτράρονται πριν το save
3. **Prop Chain**: Το `onUpdateProperty` περνάει μέσω `additionalData` του `UniversalTabsRenderer`
4. **Unit Type Translation**: Το `property.type` πρέπει να περνάει από i18n: `t(\`types.${property.type}\`)`
5. **Areas Display**: Χρήση `areas.gross` με fallback στο legacy `area` field
6. **Future Enhancement**: Callable Function `updateUnitFields` για πλήρες audit trail (mid-term)

---

## 🔄 **UI UPDATES (2026-01-24)**

### PropertyMeta Component Changes
| Change | Before | After |
|--------|--------|-------|
| **Type Translation** | `{property.type}` (raw) | `{tUnits(\`types.${property.type}\`)}` (i18n) |
| **Area Display** | `property.area` (legacy) | `property.areas?.gross ?? property.area` |
| **Edit Button** | In footer | In header (next to title) |

### UnitFieldsBlock Component Changes
| Change | Description |
|--------|-------------|
| **Name Field** | Νέο editable πεδίο για όνομα μονάδας |
| **Description Field** | Νέο editable πεδίο για περιγραφή |
| **Identity Section** | Νέα section στην αρχή του edit form |
| **Error Handling** | Toast notifications για permission denied |

### UnitType Canonical Codes
```typescript
// NEW: Canonical English codes (data layer)
type UnitType = 'studio' | 'apartment' | 'apartment_1br' | 'apartment_2br' |
                'apartment_3br' | 'maisonette' | 'shop' | 'office' | 'storage' |
                // Legacy Greek (backward compatibility)
                'Στούντιο' | 'Γκαρσονιέρα' | 'Διαμέρισμα 2Δ' | ...
```

---

## 📁 **FILES & LOCATIONS**

### Core Component

| File | Purpose | Lines |
|------|---------|-------|
| `src/features/property-details/components/UnitFieldsBlock.tsx` | Main edit form | 875 |

### Types

| File | Purpose |
|------|---------|
| `src/types/property-viewer.ts` | Property interface with Unit Fields |
| `src/types/unit.ts` | UnitModel type definition |
| `src/constants/unit-features-enterprise.ts` | Type definitions & enums |

### i18n

| File | Purpose |
|------|---------|
| `src/i18n/locales/el/units.json` | Greek translations |
| `src/i18n/locales/en/units.json` | English translations |

### Services

| File | Purpose |
|------|---------|
| `src/services/units.service.ts` | Firestore CRUD operations |
| `src/features/units-sidebar/hooks/useUnitsSidebar.ts` | Firestore persistence hook |
| `src/features/units-sidebar/UnitsSidebar.tsx` | Prop chain για `onUpdateProperty` |
| `firestore.rules` | Security rules (`allow update: if isSuperAdminOnly()` - security stub) |

---

## 🔧 **USAGE**

### Importing UnitFieldsBlock

```tsx
import { UnitFieldsBlock } from '@/features/property-details/components/UnitFieldsBlock';
```

### Basic Usage

```tsx
<UnitFieldsBlock
  property={selectedUnit}
  onUpdateProperty={handleUpdateProperty}
  isReadOnly={false}
/>
```

### Props Interface

```typescript
interface UnitFieldsBlockProps {
  /** Property data with extended fields */
  property: Property;
  /** Callback for property updates */
  onUpdateProperty: (propertyId: string, updates: Partial<Property>) => void;
  /** Read-only mode */
  isReadOnly?: boolean;
  /** Edit mode controlled by parent (Lifting State pattern) */
  isEditMode?: boolean;
  /** Callback to exit edit mode after save/cancel */
  onExitEditMode?: () => void;
}
```

---

## 🎨 **UI SPECIFICATIONS**

### Edit Mode

| Section | Input Type | Options |
|---------|-----------|---------|
| **Bedrooms** | Number input | 0-20 |
| **Bathrooms** | Number input | 0-10 |
| **WC** | Number input | 0-5 |
| **Areas** | Number inputs | step: 0.1 |
| **Orientation** | Multi-select buttons | Β, ΒΑ, Α, ΝΑ, Ν, ΝΔ, Δ, ΒΔ |
| **Condition** | Radix Select | new, excellent, good, needs-renovation |
| **Energy** | Radix Select | A+, A, B, C, D, E, F, G |
| **Heating** | Radix Select | central, autonomous, heat-pump, solar, none |
| **Cooling** | Radix Select | central-air, split-units, fan-coil, none |
| **Flooring** | Multi-select buttons | tiles, wood, laminate, marble, carpet |
| **Frames** | Radix Select | aluminum, pvc, wood |
| **Glazing** | Radix Select | single, double, triple, energy |
| **Interior** | Multi-select buttons | fireplace, jacuzzi, sauna, etc. |
| **Security** | Multi-select buttons | alarm, security-door, cctv, etc. |

### View Mode

- Icons με semantic colors (violet, cyan, amber, etc.)
- Compact badges για features
- Conditional rendering (εμφάνιση μόνο αν υπάρχουν data)

---

## 🏛️ **ENTERPRISE PATTERNS**

### 1. ADR-001 Compliance
Όλα τα dropdowns χρησιμοποιούν **Radix Select** (`@/components/ui/select`)

### 2. Centralized Tokens
```tsx
const spacing = useSpacingTokens();
const iconSizes = useIconSizes();
const { quick } = useBorderTokens();
```

### 3. i18n Support
```tsx
const { t } = useTranslation('units');

// Usage
t('fields.layout.bedrooms')  // "Υπνοδωμάτια"
t('orientation.short.north') // "Β"
t('condition.excellent')     // "Άριστο"
```

### 4. Type Safety
```typescript
import type {
  OrientationType,
  ConditionType,
  EnergyClassType,
  HeatingType,
  CoolingType,
  FlooringType,
  FrameType,
  GlazingType,
  InteriorFeatureCodeType,
  SecurityFeatureCodeType
} from '@/constants/unit-features-enterprise';
```

### 5. Semantic HTML
```tsx
<fieldset>
  <legend className="sr-only">{t('fields.layout.bedrooms')}</legend>
  <article>
    <Label htmlFor="bedrooms">...</Label>
    <Input id="bedrooms" />
  </article>
</fieldset>
```

---

## 🧪 **TESTING**

### Manual Test Steps

1. Navigate to `/units`
2. Select a unit from list
3. Click edit icon (pencil) in "Χαρακτηριστικά Μονάδας" section
4. Fill in various fields
5. Click "Αποθήκευση" (Save)
6. Hard refresh (Ctrl+F5)
7. Verify data persisted

### TypeScript Verification

```bash
npx tsc --noEmit --skipLibCheck
```

---

## 📝 **i18n KEYS REFERENCE**

### Layout
```json
"fields.layout.bedrooms": "Υπνοδωμάτια"
"fields.layout.bathrooms": "Μπάνια"
"fields.layout.wc": "WC"
```

### Areas
```json
"fields.areas.sectionTitle": "Εμβαδά"
"fields.areas.gross": "Μικτό εμβαδόν"
"fields.areas.net": "Καθαρό εμβαδόν"
"fields.areas.balcony": "Μπαλκόνι"
"fields.areas.terrace": "Βεράντα"
"fields.areas.garden": "Κήπος"
```

### Orientation
```json
"orientation.sectionTitle": "Προσανατολισμός"
"orientation.short.north": "Β"
"orientation.short.northeast": "ΒΑ"
// ... κτλ
```

### Condition
```json
"condition.sectionTitle": "Κατάσταση"
"condition.new": "Νέο"
"condition.excellent": "Άριστο"
"condition.good": "Καλό"
"condition.needs-renovation": "Χρειάζεται ανακαίνιση"
```

### Energy
```json
"energy.class": "Ενεργειακή κλάση"
```

### Systems
```json
"systems.sectionTitle": "Συστήματα"
"systems.heating.label": "Θέρμανση"
"systems.cooling.label": "Ψύξη"
```

### Finishes
```json
"finishes.sectionTitle": "Φινιρίσματα"
"finishes.flooring.label": "Δάπεδα"
"finishes.frames.label": "Κουφώματα"
"finishes.glazing.label": "Υαλοπίνακες"
```

### Features
```json
"features.sectionTitle": "Χαρακτηριστικά"
"features.interior.label": "Εσωτερικά"
"features.security.label": "Ασφάλεια"
```

---

## 🔗 **RELATED DOCUMENTATION**

- **[Property Types](../../../src/types/property-viewer.ts)** - Property interface definition
- **[Unit Features Enterprise](../../../src/constants/unit-features-enterprise.ts)** - Type definitions
- **[Units Service](../../../src/services/units.service.ts)** - Firestore service
- **[Design Tokens](../design-system/tokens.md)** - Spacing, icons, colors

---

## 📈 **METRICS**

| Metric | Value |
|--------|-------|
| **Component Lines** | 875 |
| **i18n Keys** | 80+ |
| **Field Sections** | 7 |
| **Input Types** | 4 (number, select, multi-select, buttons) |
| **Firestore Fields** | 12 nested objects |

---

> **💡 Tip**: Για νέα fields, ακολούθησε το ίδιο pattern: Type → i18n → UI → Service
>
> **🔄 Last Updated**: 2026-01-24
>
> **👥 Maintainer**: Claude Code (Anthropic AI)
