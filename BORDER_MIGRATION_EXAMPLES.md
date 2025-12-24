# 🎯 BORDER MIGRATION - PRACTICAL EXAMPLES & PATTERNS

## 📋 **STEP-BY-STEP MIGRATION PROCESS**

### **ΒΗΜΑ 1: Read το αρχείο**
```typescript
// Read tool to understand current structure
```

### **ΒΗΜΑ 2: Add Import**
```typescript
// ❌ ΠΡΙΝ:
import React from 'react';
import { Button } from '@/components/ui/button';

// ✅ ΜΕΤΑ:
import React from 'react';
import { Button } from '@/components/ui/button';
import { useBorderTokens } from '@/hooks/useBorderTokens';
```

### **ΒΗΜΑ 3: Add Hook Usage**
```typescript
// ❌ ΠΡΙΝ:
export function MyComponent() {
  return (

// ✅ ΜΕΤΑ:
export function MyComponent() {
  const { quick } = useBorderTokens();
  return (
```

### **ΒΗΜΑ 4: Replace Borders**
```typescript
// ❌ ΠΡΙΝ:
<div className="border rounded-lg p-4">

// ✅ ΜΕΤΑ:
<div className={`${quick.card} p-4`}>
```

---

## 🔧 **COMMON PATTERNS & REPLACEMENTS**

### **Pattern 1: Card Containers**
```typescript
// ❌ ΠΡΙΝ:
className="border rounded-lg"
className="bg-card border rounded-lg"
className="p-4 border rounded-lg shadow"

// ✅ ΜΕΤΑ:
className={`${quick.card}`}
className={`bg-card ${quick.card}`}
className={`p-4 ${quick.card} shadow`}
```

### **Pattern 2: Table Containers**
```typescript
// ❌ ΠΡΙΝ:
className="border rounded-md"
className="overflow-hidden border rounded-md"

// ✅ ΜΕΤΑ:
className={`${quick.table}`}
className={`overflow-hidden ${quick.table}`}
```

### **Pattern 3: Status Borders**
```typescript
// ❌ ΠΡΙΝ:
className="border-red-200 border rounded-lg bg-red-50"
className="border-green-200 border rounded-lg bg-green-50"

// ✅ ΜΕΤΑ:
const { getStatusBorder } = useBorderTokens();
className={`${getStatusBorder('error')} bg-red-50`}
className={`${getStatusBorder('success')} bg-green-50`}
```

### **Pattern 4: Complex Multi-Class**
```typescript
// ❌ ΠΡΙΝ:
className="flex items-center gap-2 p-3 bg-white dark:bg-gray-800 border rounded-lg hover:shadow-md transition-all"

// ✅ ΜΕΤΑ:
className={`flex items-center gap-2 p-3 bg-white dark:bg-gray-800 ${quick.card} hover:shadow-md transition-all`}
```

---

## ⚠️ **SPECIAL CASES & EXCEPTIONS**

### **🚫 DO NOT CHANGE: Animation Borders**
```typescript
// ❌ ΜΗΝ ΑΛΛΑΞΕΙΣ αυτά (animations):
className="border-2 border-blue-500 animate-pulse"
className={`border-4 ${isLoading ? 'animate-spin border-t-blue-500' : ''}`}

// ✅ LEAVE AS IS - έχουν animation logic
```

### **🚫 DO NOT CHANGE: Conditional Complex Borders**
```typescript
// ❌ ΜΗΝ ΑΛΛΑΞΕΙΣ αυτά (complex conditions):
className={cn(
  "border-2",
  isSelected ? "border-blue-500" : "border-transparent",
  isHovered && "border-gray-300"
)}

// ✅ LEAVE AS IS - έχουν conditional logic
```

### **✅ DO CHANGE: Simple Rounded Borders**
```typescript
// ✅ ΑΛΛΑΞΕ αυτά (simple patterns):
className="border rounded"
className="border rounded-sm"
className="border rounded-lg"
className="border rounded-md"
className="border-2 rounded-lg"
```

---

## 🎯 **DOMAIN-SPECIFIC GUIDANCE**

### **DXF-VIEWER Components (Agent A) - 🔥 HIGH PRIORITY:**
- **DxfViewerComponents.styles.ts (14 violations):** Central styling file - affects all DXF components
- **LandingPage.tsx (9 violations):** User entry point - high visibility
- **Canvas3DControls.tsx (6 violations):** 3D controls for CAD functionality
- **PropertyViewer.tsx (5 violations):** Property inspection panels
- **BuildingViewer.tsx (4 violations):** Building visualization components
- **Technical Notes:** Watch for CAD-specific border animations, color picker borders may have complex logic

### **GEO-CANVAS Components (Agent B) - ✅ COMPLETED:**
**Achievement Summary:**
- ✅ 15 files successfully migrated (100% completion)
- ✅ 46 border violations resolved
- ✅ Enterprise-grade implementation using `useBorderTokens`
- ✅ Zero TypeScript errors introduced
- ✅ All patterns: `border rounded-lg` → `${quick.card}`, `border rounded-md` → `${quick.table}`

### **UI COMPONENTS (Agent C) - 🟡 FOUNDATIONAL PRIORITY:**
- **ui/dialog.tsx (7 violations):** Dialog system used throughout app
- **ui/dropdown-menu.tsx (5 violations):** Dropdown components everywhere
- **ui/input.tsx (4 violations):** Input field system - foundational
- **ui/select.tsx (3 violations):** Select components
- **Contact/Project Cards:** Use `quick.card` for business logic components
- **Forms & Tables:** Use `quick.input` and `quick.table` consistently

### **PACKAGES & UTILITIES (Agent D) - 🟢 CLEANUP PRIORITY:**
- **packages/core/ (high impact):** Core utilities affecting multiple domains
- **packages/ui/ (medium impact):** Shared UI library components
- **packages/forms/ & packages/alerts/:** Specialized utility components
- **src/config/, src/utils/, src/lib/:** Configuration and utility files
- **Low-priority pages:** Admin interfaces, settings, documentation pages

---

## 🔍 **VERIFICATION CHECKLIST**

### **After Each File:**
- [ ] Added `useBorderTokens` import
- [ ] Added `const { quick } = useBorderTokens();` hook usage
- [ ] Replaced all `border rounded-*` patterns
- [ ] Maintained all other className logic
- [ ] No TypeScript errors introduced

### **Every 5 Files:**
- [ ] Run TypeScript check on domain
- [ ] Verify no hardcoded borders remain
- [ ] Check import statements are correct

### **Every 10 Files:**
- [ ] Full compilation test
- [ ] Report progress to coordination
- [ ] Update personal tracking

---

## 📊 **PROGRESS TRACKING TEMPLATE**

```markdown
## Agent [X] Progress Report - [Timestamp]

### ✅ Completed Files (X/Total):
1. [file1.tsx] - [violations] violations fixed
2. [file2.tsx] - [violations] violations fixed
...

### 🔄 Currently Working:
- [current_file.tsx] - [estimated_violations] violations

### ⚠️ Issues Encountered:
- [issue1]: [solution]
- [issue2]: [solution]

### 📈 Statistics:
- **Files Remaining:** X
- **Violations Fixed:** X
- **Estimated Completion:** X minutes
- **TypeScript Status:** ✅ Clean / ⚠️ [X] errors
```

---

## 🚀 **QUICK REFERENCE CHEAT SHEET**

```typescript
// IMPORTS
import { useBorderTokens } from '@/hooks/useBorderTokens';

// HOOK USAGE
const { quick, getStatusBorder, createBorder } = useBorderTokens();

// COMMON REPLACEMENTS
"border rounded-lg"     → `${quick.card}`
"border rounded-md"     → `${quick.table}`
"border rounded"        → `${quick.card}`
"border rounded-sm"     → `${quick.card}`

// STATUS BORDERS
getStatusBorder('error')    // red border
getStatusBorder('success')  // green border
getStatusBorder('warning')  // yellow border
getStatusBorder('info')     // blue border

// CUSTOM BORDERS (rare)
createBorder('medium', 'hsl(var(--muted-foreground))', 'dashed')
```

---

---

## 📊 **UPDATED AUDIT FINDINGS (2024 SESSION)**

### ✅ **COMPLETED WORK:**
```
Agent B (GEO-CANVAS): 15 files, 46 violations ✅ DONE
- Quality: Enterprise-grade ⭐⭐⭐⭐⭐
- TypeScript errors: 0
- Implementation: 100% centralized using useBorderTokens
- Documentation: Updated centralized_systems.md
```

### 🔍 **NEW COMPREHENSIVE AUDIT RESULTS:**
```
Total Remaining: 218 violations across 100 files

DOMAIN BREAKDOWN:
🔥 DXF-Viewer: 59 violations (HIGH IMPACT)
🟡 Components/UI: 32+ violations (FOUNDATIONAL)
🟢 Packages: 9 violations (LOW PRIORITY)
📁 Scattered: Rest across config/utils/pages
```

### 🎯 **STRATEGIC RECOMMENDATIONS:**

**IMMEDIATE (Agent A):** Focus DXF-Viewer domain
- Highest violation count (59)
- User-facing critical components
- CAD functionality impact

**FOUNDATIONAL (Agent C):** UI Components next
- Core UI elements used everywhere
- Dialog, input, select, dropdown systems
- Multiplier effect across entire app

**CLEANUP (Agent D):** Packages & utilities last
- Lower user impact
- Utility and configuration files
- Easy wins for completion

---

**🎯 Ready for parallel execution! Each agent can now work independently with clear, updated guidelines based on comprehensive audit findings.**