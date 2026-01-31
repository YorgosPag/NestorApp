# 🔍 **FILTER SYSTEM**

> **Enterprise Documentation**: Centralized filtering, search, and data query systems

**📊 Stats**: 2 ADRs | Last Updated: 2026-01-31

---

## 🎯 **RELATED ADRs**

| ADR | Decision | Status |
|-----|----------|--------|
| **ADR-029** | Global Search System v1 | ✅ APPROVED |
| **ADR-051** | Enterprise Filter System Centralization | ✅ APPROVED |

---

## 🔍 **ADR-029: GLOBAL SEARCH SYSTEM V1**

**Date**: 2026-01-25
**Status**: ✅ APPROVED

### Decision

Unified search API with Greek-friendly text handling.

### Canonical API

```typescript
// API Endpoint
POST /api/search

// Request
interface SearchRequest {
  query: string;
  entityTypes?: EntityType[];
  limit?: number;
  offset?: number;
}

// Response
interface SearchResponse {
  results: SearchResult[];
  total: number;
  hasMore: boolean;
}
```

### Features

- Greek-friendly search (diacritics handling)
- Prefix matching
- Tenant isolation
- Entity type filtering

---

## 🎯 **ADR-051: ENTERPRISE FILTER SYSTEM CENTRALIZATION**

**Date**: 2026-01-29
**Status**: ✅ APPROVED

### Decision

Centralize all filtering logic to `AdvancedFilters` component system.

### Canonical Components

```typescript
// ✅ CANONICAL
import { AdvancedFilters } from '@/components/core/AdvancedFilters';
import { useGenericFilters } from '@/components/core/AdvancedFilters/hooks/useGenericFilters';
import { applyFilters } from '@/components/core/AdvancedFilters/utils/applyFilters';
```

### Deprecated (DELETED)

```typescript
// ❌ DELETED - 7 files removed
// - useFilterState.ts
// - useFilteredProjects.ts
// - useFilteredBuildings.ts
// - useFilteredUnits.ts
// - useFilteredContacts.ts
// - FilterPanel.tsx (old)
// - FilterDropdown.tsx (old)
```

### Migration

| Before | After | Code Reduction |
|--------|-------|----------------|
| 7 separate hooks | 1 `useGenericFilters` | 85% |
| 7 filter UIs | 1 `AdvancedFilters` | 79% |
| Scattered logic | Centralized `applyFilters` | Single source |

### Usage Example

```typescript
import { AdvancedFilters } from '@/components/core/AdvancedFilters';
import { useGenericFilters } from '@/components/core/AdvancedFilters/hooks/useGenericFilters';

function ProjectList() {
  const { filters, setFilters, filteredData } = useGenericFilters({
    data: projects,
    filterConfig: PROJECT_FILTER_CONFIG
  });

  return (
    <div>
      <AdvancedFilters
        config={PROJECT_FILTER_CONFIG}
        filters={filters}
        onChange={setFilters}
      />
      <ProjectTable data={filteredData} />
    </div>
  );
}
```

### Consumers Migrated

16 components now use the centralized system:

1. ProjectList
2. BuildingList
3. UnitList
4. ContactList
5. DrawingList
6. AlertList
7. TaskList
8. ReportList
9. DocumentList
10. PhotoGallery
11. SearchResults
12. DashboardWidgets
13. ExportDialog
14. BulkActions
15. ImportWizard
16. ArchiveView

---

## 📚 **RELATED DOCUMENTATION**

- **[ADR Index](../reference/adr-index.md)** - Complete ADR listing
- **[Search System](../ui-systems/search-system.md)** - Search UI components
- **[State Management](./state-management.md)** - Filter state handling

---

> **🔄 Last Updated**: 2026-01-31
>
> **👥 Maintainers**: Γιώργος Παγώνης + Claude Code (Anthropic AI)
