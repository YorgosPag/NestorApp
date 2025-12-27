# 📋 BRIDGE MIGRATION INVENTORY
**Generated:** 2025-12-27
**Phase 0 Audit Results**

## 📊 **BASELINE METRICS**

| **Metric** | **Current Count** | **Phase 1 Target** | **Final Target** |
|------------|------------------|-------------------|------------------|
| 🔴 Hardcoded `bg-background` | **122 usages** | <30 usages | 0 usages |
| 📁 Files with hardcoded | **78 files** | <30 files | 0 files |
| 🌉 Bridge `colors.bg.*` | **1,391 usages** | +200 usages | 100% coverage |
| 🎯 useSemanticColors hook | **574 usages** | +100 usages | 100% coverage |

## 🎯 **PHASE 1: APP SHELL MIGRATION** (Week 1)
**Risk Level:** 🟡 MEDIUM | **Impact:** 🔴 HIGH

### ✅ **PRIORITY FILES** (Migrate First):

| File | Hardcoded Count | Risk | Impact | Notes |
|------|----------------|------|--------|-------|
| `src/app/layout.tsx` | 1-2 | LOW | HIGH | Root layout - affects all pages |
| `src/app/(app)/layout.tsx` | 1-2 | LOW | HIGH | App wrapper layout |
| `src/components/app-header.tsx` | 3-5 | LOW | HIGH | Global header component |
| `src/app/navigation/page.tsx` | 2-3 | LOW | MED | Main navigation page |

**MIGRATION PATTERN:**
```typescript
// BEFORE (hardcoded)
<div className="bg-background border rounded-lg">

// AFTER (bridge)
const colors = useSemanticColors();
<div className={`${colors.bg.primary} border rounded-lg`}>
```

## 🎯 **PHASE 2: BATCH MIGRATIONS** (Weeks 2-4)

### **Batch 2A: Sales Pages** (Week 2)
```
src/app/sales/available-apartments/page.tsx
src/app/sales/available-parking/page.tsx
src/app/sales/available-storage/page.tsx
src/app/sales/sold/page.tsx
```

### **Batch 2B: Space Pages** (Week 3)
```
src/app/spaces/apartments/page.tsx
src/app/spaces/common/page.tsx
src/app/spaces/parking/page.tsx
src/app/spaces/storage/page.tsx
```

### **Batch 2C: Components** (Week 4)
```
src/components/building-management/BuildingsPage/*.tsx
src/components/contacts/*.tsx
src/components/crm/*.tsx
```

## 🚫 **FREEZE RULES** (Effective Immediately)

### ❌ **PROHIBITED PATTERNS:**
- ✋ **NO new `bg-background` usage** in any components
- ✋ **NO new CSS variable creation** (`--bg-*` patterns)
- ✋ **MANDATORY useSemanticColors()** for all new color access

### ✅ **APPROVED PATTERNS:**
```typescript
// ✅ CORRECT - Bridge API usage
const colors = useSemanticColors();
<div className={colors.bg.primary}>

// ❌ PROHIBITED - Hardcoded usage
<div className="bg-background">
```

## 📊 **PROGRESS TRACKING**

### **Daily Metrics:**
- [ ] Hardcoded `bg-background` count: **122** → Target: **<100**
- [ ] Bridge API usage count: **1,391** → Target: **>1,500**
- [ ] Files with hardcoded: **78** → Target: **<60**

### **Weekly Checkpoints:**
- **Week 1**: App shell migration complete, hardcoded count <90
- **Week 2**: Sales pages complete, hardcoded count <60
- **Week 3**: Space pages complete, hardcoded count <30
- **Week 4**: Component batches complete, hardcoded count <5

## 🚦 **GO/NO-GO GATE 1 CRITERIA**

**✅ PROCEED TO PHASE 1 IF:**
- [ ] Complete inventory documented (this file)
- [ ] Freeze rules communicated to team
- [ ] Baseline metrics captured and confirmed
- [ ] Migration patterns validated on 1-2 sample files

**❌ STOP IF:**
- Audit reveals >200 files needing migration
- Bridge mapping has fundamental gaps
- Team lacks bandwidth for 1-week commitment
- TypeScript compilation errors in critical paths

## 📍 **FILES REQUIRING MIGRATION**

<details>
<summary>Complete list of 78 files with bg-background (Click to expand)</summary>

```
src/app/(app)/layout.tsx
src/app/(light)/layout.tsx
src/app/admin/link-units/page.tsx
src/app/buildings/error.tsx
src/app/layout.tsx
src/app/navigation/page.tsx
src/app/properties/page.tsx
src/app/sales/available-apartments/page.tsx
src/app/sales/available-parking/page.tsx
src/app/sales/available-storage/page.tsx
src/app/sales/page.tsx
src/app/sales/sold/page.tsx
src/app/spaces/apartments/page.tsx
src/app/spaces/common/page.tsx
src/app/spaces/page.tsx
src/app/spaces/parking/page.tsx
src/app/spaces/storage/page.tsx
src/app/units/page.tsx
src/components/app-header.tsx
src/components/building-management/BuildingsPage/BuildingsHeader.tsx
[... 58 more files - see bg-background-files.txt for complete list]
```
</details>

---

**📌 NEXT STEPS:**
1. **Team Communication**: Announce freeze rules and migration plan
2. **Sample Migration**: Test migration pattern on 1-2 files
3. **Phase 1 Kickoff**: Begin app shell migration (if Gate 1 passes)
4. **Daily Tracking**: Monitor progress via automated metrics

**🎯 SUCCESS = Single source of truth for colors with zero hardcoded usage!**