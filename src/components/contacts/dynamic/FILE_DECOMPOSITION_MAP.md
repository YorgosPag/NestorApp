# 📂 ENTERPRISE FILE DECOMPOSITION MAP

## 🎯 ΣΥΓΚΕΚΡΙΜΕΝΟΣ ΧΑΡΤΗΣ ΑΡΧΕΙΩΝ ΓΙΑ ΔΙΑΣΠΑΣΗ

**Source File**: `UniversalCommunicationManager.tsx` (434 γραμμές)
**Target Architecture**: 7 αρχεία + directory structure

---

## 📋 ΑΡΧΕΙΑ ΠΡΟΣ ΔΗΜΙΟΥΡΓΙΑ

### 🏢 1. HOOKS DIRECTORY
**Path**: `src/components/contacts/dynamic/hooks/`

#### 1a. useCommunicationOperations.ts
```
📍 Full Path: src/components/contacts/dynamic/hooks/useCommunicationOperations.ts
📊 Estimated Size: 50-70 lines
🎯 Content Source: Lines 83-148 from UniversalCommunicationManager.tsx

Extracted Functions:
- addItem() → Lines 83-108
- updateItem() → Lines 110-127
- removeItem() → Lines 129-138
- setPrimary() → Lines 140-148
```

#### 1b. useResponsiveLayout.ts
```
📍 Full Path: src/components/contacts/dynamic/hooks/useResponsiveLayout.ts
📊 Estimated Size: 20-30 lines
🎯 Content Source: Lines 69-77 from UniversalCommunicationManager.tsx

Extracted Functions:
- Desktop detection logic → Lines 70-77
- Window resize handling → Lines 73-76
- Responsive state management → Lines 70, 72
```

#### 1c. index.ts (Barrel Export)
```
📍 Full Path: src/components/contacts/dynamic/hooks/index.ts
📊 Estimated Size: 10-15 lines
🎯 Content: New barrel export file

Export Structure:
export { useCommunicationOperations } from './useCommunicationOperations';
export { useResponsiveLayout } from './useResponsiveLayout';
```

---

### 🏢 2. LAYOUTS DIRECTORY
**Path**: `src/components/contacts/dynamic/layouts/`

#### 2a. MobileCommunicationLayout.tsx
```
📍 Full Path: src/components/contacts/dynamic/layouts/MobileCommunicationLayout.tsx
📊 Estimated Size: 80-100 lines
🎯 Content Source: Lines 180-289 + 417-456 from UniversalCommunicationManager.tsx

Extracted Sections:
- renderItemFields() function → Lines 180-289 (MOBILE portion)
- Mobile action buttons → Lines 422-453
- Mobile fieldset rendering → Lines 190-288
```

#### 2b. DesktopTableLayout.tsx
```
📍 Full Path: src/components/contacts/dynamic/layouts/DesktopTableLayout.tsx
📊 Estimated Size: 80-120 lines
🎯 Content Source: Lines 307-415 from UniversalCommunicationManager.tsx

Extracted Sections:
- Phone desktop table → Lines 307-334
- Email desktop table → Lines 335-361
- Website desktop table → Lines 362-387
- Social desktop table → Lines 388-415
```

#### 2c. CommunicationEmptyState.tsx
```
📍 Full Path: src/components/contacts/dynamic/layouts/CommunicationEmptyState.tsx
📊 Estimated Size: 30-40 lines
🎯 Content Source: Lines 458-465 from UniversalCommunicationManager.tsx

Extracted Sections:
- Empty state section → Lines 459-465
- Add button logic → Lines 467-477
```

#### 2d. index.ts (Barrel Export)
```
📍 Full Path: src/components/contacts/dynamic/layouts/index.ts
📊 Estimated Size: 10-15 lines
🎯 Content: New barrel export file

Export Structure:
export { MobileCommunicationLayout } from './MobileCommunicationLayout';
export { DesktopTableLayout } from './DesktopTableLayout';
export { CommunicationEmptyState } from './CommunicationEmptyState';
```

---

### 🏢 3. REFACTORED MAIN COMPONENT

#### 3a. UniversalCommunicationManager.tsx (REFACTORED)
```
📍 Full Path: src/components/contacts/dynamic/UniversalCommunicationManager.tsx
📊 Target Size: 60-80 lines (από 434)
🎯 Content: Orchestrator pattern implementation

Retained Sections:
- Import statements → Lines 1-36 (Updated imports)
- Component props → Lines 60-65
- Main component structure → Lines 298-479 (Simplified)
- Component composition logic → New implementation

Removed/Delegated:
- CRUD operations → Moved to useCommunicationOperations hook
- Responsive logic → Moved to useResponsiveLayout hook
- Mobile rendering → Moved to MobileCommunicationLayout component
- Desktop rendering → Moved to DesktopTableLayout component
- Empty state → Moved to CommunicationEmptyState component
```

---

## 🗂️ DIRECTORY STRUCTURE BEFORE/AFTER

### 📋 BEFORE (Current State)
```
src/components/contacts/dynamic/
├── UniversalCommunicationManager.tsx          (434 lines) ⚠️
├── communication/                             (✅ Good structure)
│   ├── types/
│   ├── config/
│   ├── renderers/
│   └── utils/
└── DynamicContactArrays.tsx
```

### 📋 AFTER (Target State)
```
src/components/contacts/dynamic/
├── UniversalCommunicationManager.tsx          (60-80 lines) ✅
├── UniversalCommunicationManager.tsx.BACKUP-20251228-0230  (Backup)
├── ENTERPRISE_REFACTORING_PLAN.md            (Enterprise docs)
├── FILE_DECOMPOSITION_MAP.md                 (This file)
├──
├── hooks/                                     (🆕 NEW)
│   ├── index.ts                              (Barrel)
│   ├── useCommunicationOperations.ts         (50-70 lines)
│   └── useResponsiveLayout.ts                (20-30 lines)
├──
├── layouts/                                   (🆕 NEW)
│   ├── index.ts                              (Barrel)
│   ├── MobileCommunicationLayout.tsx         (80-100 lines)
│   ├── DesktopTableLayout.tsx                (80-120 lines)
│   └── CommunicationEmptyState.tsx           (30-40 lines)
├──
├── communication/                             (✅ No changes)
│   ├── types/
│   ├── config/
│   ├── renderers/
│   └── utils/
└── DynamicContactArrays.tsx                  (✅ No changes)
```

---

## 🔗 IMPORT/EXPORT DEPENDENCIES

### 📥 NEW IMPORTS (After Refactoring)

#### UniversalCommunicationManager.tsx
```typescript
// Existing imports (unchanged)
import React, { useCallback, useState, useEffect } from 'react';
// ... existing UI imports

// 🆕 NEW: Internal hooks
import { useCommunicationOperations } from './hooks/useCommunicationOperations';
import { useResponsiveLayout } from './hooks/useResponsiveLayout';

// 🆕 NEW: Layout components
import {
  MobileCommunicationLayout,
  DesktopTableLayout,
  CommunicationEmptyState
} from './layouts';
```

#### useCommunicationOperations.ts
```typescript
import { useCallback } from 'react';
import type {
  CommunicationItem,
  CommunicationConfig,
  CommunicationFieldValue
} from '../communication/types';
import { generateSocialUrl } from '../communication/utils';
```

#### Layout Components
```typescript
import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
// ... other UI imports
import type { CommunicationItem, CommunicationConfig } from '../communication/types';
```

---

## 🧩 CODE MIGRATION MATRIX

| Original Section | Lines | Target File | New Lines |
|------------------|-------|-------------|-----------|
| Responsive Logic | 69-77 | useResponsiveLayout.ts | 10-20 |
| CRUD Operations | 83-148 | useCommunicationOperations.ts | 40-60 |
| Mobile Rendering | 180-289 | MobileCommunicationLayout.tsx | 60-80 |
| Desktop Tables | 307-415 | DesktopTableLayout.tsx | 70-100 |
| Empty State | 458-465 | CommunicationEmptyState.tsx | 20-30 |
| Add Button | 467-477 | CommunicationEmptyState.tsx | 10 |
| Main Component | 298-479 | UniversalCommunicationManager.tsx | 40-60 |

**Total Original**: 434 lines → **Total Refactored**: ~300 lines (7 files)
**Reduction**: ~30% code volume + Improved maintainability

---

## 🚀 EXECUTION ORDER

### Phase 1: Infrastructure
1. Create `hooks/` directory
2. Create `layouts/` directory
3. Create barrel export files (`index.ts`)

### Phase 2: Business Logic Extraction
1. Extract → `useCommunicationOperations.ts`
2. Extract → `useResponsiveLayout.ts`
3. Test hooks independently

### Phase 3: UI Component Extraction
1. Extract → `MobileCommunicationLayout.tsx`
2. Extract → `DesktopTableLayout.tsx`
3. Extract → `CommunicationEmptyState.tsx`
4. Test layout components

### Phase 4: Main Component Refactoring
1. Refactor `UniversalCommunicationManager.tsx`
2. Update imports and compose components
3. Integration testing

---

## ✅ VERIFICATION CHECKLIST

- [ ] All 7 target files created
- [ ] Original backup preserved
- [ ] Import/export chains work correctly
- [ ] No functionality regression
- [ ] TypeScript compilation successful
- [ ] All tests passing
- [ ] Performance metrics maintained
- [ ] Code review completed

---

**Document Version**: 1.0
**Created**: 2025-12-28
**Purpose**: Detailed implementation guide for enterprise refactoring
**Owner**: Development Team