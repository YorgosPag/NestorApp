# PERF-001: Layout Providers Audit

- Status: Analysis Complete
- Date: 2026-01-11
- Scope: `src/app/(app)/layout.tsx` providers and global listeners

## Executive Summary

14 providers wrap all routes. 2 are P0 offenders setting up global Firestore listeners on mount.

## Current Provider Stack (layout.tsx)

```
ThemeProvider
  I18nProvider
    FirebaseAuthProvider
      UserRoleProvider
        FloorplanProvider
          NotificationProvider
            SharedPropertiesProvider     ← P0 OFFENDER
              NavigationProvider         ← Uses P0 real-time hooks
                PhotoPreviewProvider
                  SidebarProvider
                    [children]
```

---

## P0 OFFENDERS - Global Firestore Listeners

### 1. SharedPropertiesProvider (CRITICAL)

**Location**: `src/contexts/SharedPropertiesProvider.tsx`

**Problem**:
```typescript
// Line 94 - Sets up onSnapshot on mount
const unsubscribe = onSnapshot(
  collection(db, COLLECTIONS.UNITS),  // ← ENTIRE units collection
  (snapshot) => { ... }
);
```

**Impact**:
- Listens to ALL units on EVERY route
- Routes that don't need properties still pay the cost
- Memory: holds entire units collection in state

**Recommendation**:
- Move to lazy initialization (load only when needed)
- Or scope to specific routes via route-level provider

---

### 2. NavigationContext Real-time Hooks (HIGH)

**Location**: `src/components/navigation/core/NavigationContext.tsx`

**Problem**:
```typescript
// Lines 56-69 - Two global listeners
const { buildingsByProject, ... } = useRealtimeBuildings();  // ← onSnapshot(buildings)
const { unitsByBuilding, ... } = useRealtimeUnits();         // ← onSnapshot(units)
```

**Impact**:
- 2 additional Firestore listeners on ALL routes
- Real-time building/unit counts even on routes that don't display them

**Recommendation**:
- Consider whether all routes need real-time counts
- Alternative: On-demand loading when expanding navigation tree

---

## SAFE - No Changes Needed

| Provider | Reason |
|----------|--------|
| ThemeProvider | State only, no listeners |
| I18nProvider | Static translations |
| FirebaseAuthProvider | Auth critical path |
| UserRoleProvider | Role critical path |
| FloorplanProvider | State only, no listeners |
| NotificationProvider | State only |
| PhotoPreviewProvider | State only, modal conditional |
| SidebarProvider | UI state only |

---

## DO NOT TOUCH (Critical Infrastructure)

- **FirebaseAuthProvider** - Auth gates, security critical
- **UserRoleProvider** - RBAC, security critical
- **ThemeProvider** - Core UX
- **I18nProvider** - Core UX
- **SidebarProvider** - Layout essential

---

## Recommended Actions

### Quick Win (No behavior change):

1. **SharedPropertiesProvider → Lazy boundary**
   - Wrap only routes that need it
   - Or: lazy-init on first `useSharedProperties()` call

### Medium Effort:

2. **NavigationContext real-time → On-demand**
   - Load building/unit counts only when user expands project in nav
   - Bootstrap provides initial counts, real-time updates on interaction

### Metrics to Track:

- `/audit` route cold load time
- Network tab: Firestore reads count on initial load
- Memory: heap snapshot with/without global listeners

---

## Validation

After implementing fixes:
- [ ] `/audit` loads without units collection listener (if not needed)
- [ ] Navigation shows counts from bootstrap (not real-time) initially
- [ ] Real-time updates only when user navigates to project details
- [ ] No regression in features that depend on real-time data
