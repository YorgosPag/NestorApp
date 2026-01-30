# 🧱 **UI COMPONENTS**

> **Enterprise Component Architecture**: Centralized UI components & patterns
>
> Related ADRs: **ADR-001** (Select), **ADR-003** (FloatingPanel), **ADR-013** (Cards), **ADR-023** (Spinner), **ADR-028** (Buttons)

---

## 📋 **ADR-001: Select/Dropdown Component**

**Status**: ✅ APPROVED | **Date**: 2026-01-01

### Decision

| Rule | Description |
|------|-------------|
| **CANONICAL** | `@/components/ui/select` (Radix Select) |
| **DEPRECATED** | `EnterpriseComboBox` |
| **PROHIBITION** | ❌ New dropdown implementations outside Radix Select |

### Migration Strategy: **MIGRATE ON TOUCH**
- No new usage of EnterpriseComboBox
- When touching legacy file → replace with Radix Select
- Goal: Complete elimination without rush

### Legacy Files (7 total)
1. `CrosshairAppearanceSettings.tsx`
2. `CursorSettings.tsx`
3. `LayersSettings.tsx`
4. `SelectionSettings.tsx`
5. `TextSettings.tsx`
6. `DimensionSettings.tsx`
7. `EnterpriseComboBox.tsx`

### Implementation

```typescript
// ✅ CANONICAL: Radix Select
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';

<Select value={value} onValueChange={onChange}>
  <SelectTrigger>
    <SelectValue placeholder="Select..." />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="option1">Option 1</SelectItem>
  </SelectContent>
</Select>

// ❌ DEPRECATED
import { EnterpriseComboBox } from '...'; // DO NOT USE
```

---

## 📋 **ADR-003: Floating Panel Compound Component**

**Status**: ✅ APPROVED | **Date**: 2026-01-02

### Decision

| Rule | Description |
|------|-------------|
| **CANONICAL** | `FloatingPanel` from `@/components/ui/floating` |
| **PATTERN** | Compound Component (Radix UI style) |
| **PROHIBITION** | ❌ New floating panels without FloatingPanel |

### Component Structure

```tsx
import { FloatingPanel } from '@/components/ui/floating';

<FloatingPanel
  defaultPosition={{ x: 100, y: 100 }}
  dimensions={{ width: 340, height: 500 }}
  onClose={handleClose}
>
  <FloatingPanel.Header
    title="My Panel"
    icon={<Activity />}
    actions={<CustomButtons />}
  />
  <FloatingPanel.Content>
    Content here
  </FloatingPanel.Content>
</FloatingPanel>
```

### Sub-components

| Component | Purpose |
|-----------|---------|
| `FloatingPanel` | Root container (context provider, draggable) |
| `FloatingPanel.Header` | Draggable header with title, icon, actions |
| `FloatingPanel.Content` | Content area wrapper |
| `FloatingPanel.Close` | Accessible close button |
| `FloatingPanel.DragHandle` | Dedicated drag handle |

### Features
- ✅ Hydration-safe rendering
- ✅ Centralized `useDraggable` hook
- ✅ Full TypeScript support (zero `any`)
- ✅ ARIA compliant
- ✅ Zero inline styles

---

## 📋 **ADR-013: Enterprise Card System (Atomic Design)**

**Status**: ✅ APPROVED | **Date**: 2026-01-08

### Architecture

```
src/
├── design-system/              # 🏛️ CENTRALIZED
│   ├── primitives/Card/        # 🔹 ATOMS
│   │   ├── CardIcon.tsx
│   │   └── CardStats.tsx
│   └── components/ListCard/    # 🔸 MOLECULES
│       └── ListCard.tsx
└── domain/cards/               # 🔶 ORGANISMS
    ├── ParkingListCard.tsx
    ├── UnitListCard.tsx
    ├── StorageListCard.tsx
    ├── BuildingListCard.tsx
    ├── ContactListCard.tsx
    ├── ProjectListCard.tsx
    └── PropertyListCard.tsx
```

### Implementation

```typescript
// ✅ ENTERPRISE: Use domain cards
import { ParkingListCard, UnitListCard } from '@/domain';

// ✅ ENTERPRISE: Use ListCard for custom
import { ListCard } from '@/design-system';

<ListCard
  entityType="unit"
  title="Διαμέρισμα Α1"
  stats={[{ label: 'Εμβαδόν', value: '85 τ.μ.' }]}
  onClick={handleClick}
>
  <UnitBadge status="available" />
</ListCard>

// ❌ PROHIBITED: Inline implementations
<div className="flex items-center p-4 border rounded-lg">
```

### Result
- **64% Code Reduction**: 22 files → 7 domain cards
- **ZERO Duplicates**: Single PropertyListCard
- **Consistent UX**: Same appearance everywhere

---

## 📋 **ADR-023: Centralized Spinner Component**

**Status**: ✅ APPROVED | **Date**: 2026-01-11

### Decision

```
🏢 CANONICAL: import { Spinner } from '@/components/ui/spinner';
❌ PROHIBITED: import { Loader2 } from 'lucide-react';
```

### Usage

```typescript
import { Spinner } from '@/components/ui/spinner';

<Spinner size="small" />   // 16px - inline buttons
<Spinner size="medium" />  // 24px - cards, sections
<Spinner size="large" />   // 32px - full-page loading
<Spinner size="xl" />      // 48px - hero loading states
```

### Exceptions (allowed to import Loader2)
1. `src/components/ui/spinner.tsx` - The canonical implementation
2. `src/components/ui/ModalLoadingStates.tsx` - Enterprise modal patterns
3. `**/loading.tsx` - Next.js App Router loading files

### ESLint Enforcement
```javascript
"design-system/no-direct-loader-import": "warn"
```

---

## 📋 **ADR-028: Button Component Consolidation**

**Status**: ✅ APPROVED | **Date**: 2026-01-24

### Canonical Hierarchy

```
Level 1 (Global - Main App):
├── @/components/ui/button (Shadcn Button)
│
Level 2 (DXF-Specific):
├── ui/toolbar/ToolButton.tsx (CANONICAL for DXF Toolbar)
│   ├── ToolButton - Toolbar tool buttons with icons
│   └── ActionButton - Toolbar action buttons
│
❌ DEPRECATED: components/shared/BaseButton.tsx exports of ToolButton/ActionButton
```

### Usage

```typescript
// ✅ ENTERPRISE: Main app - Shadcn Button
import { Button } from '@/components/ui/button';
<Button variant="default" size="sm">Save</Button>
<Button variant="destructive">Delete</Button>
<Button variant="ghost" size="icon"><IconSettings /></Button>

// ✅ ENTERPRISE: DXF Toolbar - specialized components
import { ToolButton, ActionButton } from '@/subapps/dxf-viewer/ui/toolbar/ToolButton';
<ToolButton tool={tool} isActive={active} onClick={onClick} />

// ❌ PROHIBITED: Hardcoded buttons
<button style={{ background: 'blue' }}>Bad</button>

// ❌ PROHIBITED: Using deprecated imports
import { ToolButton } from '../components/shared/BaseButton'; // WRONG!
```

### Migration Strategy: **MIGRATE ON TOUCH**
- 49 files to migrate
- No big-bang migration
- Migrate when touching file for other work

---

## 📋 **ADR-050: Unified Toolbar Integration**

**Status**: ✅ APPROVED | **Date**: 2027-01-27

### Decision

| Rule | Description |
|------|-------------|
| **CANONICAL** | `EnhancedDXFToolbar` with collapsible sections |
| **PATTERN** | AutoCAD Ribbon pattern |
| **PROHIBITION** | ❌ Creating new floating toolbars |

### Architecture

```
ui/toolbar/overlay-section/ (480+ lines, 8 files)
├── OverlayToolbarSection.tsx
├── OverlayColorPicker.tsx
└── ...more components
```

Merged floating overlay toolbar into EnhancedDXFToolbar as collapsible Row 2.

---

## 📚 **COMPONENT QUICK REFERENCE**

### Import Paths

| Component | Import |
|-----------|--------|
| Select | `@/components/ui/select` |
| FloatingPanel | `@/components/ui/floating` |
| ListCard | `@/design-system` |
| Domain Cards | `@/domain` |
| Spinner | `@/components/ui/spinner` |
| Button | `@/components/ui/button` |
| ToolButton | `@/subapps/dxf-viewer/ui/toolbar/ToolButton` |

---

> **📍 Full Reference**: [centralized_systems.md](../../../src/subapps/dxf-viewer/docs/centralized_systems.md)
>
> **🔄 Last Updated**: 2026-01-31
