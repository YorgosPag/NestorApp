# 🔍 **GLOBAL SEARCH SYSTEM v1**

> **Enterprise-Grade Search Architecture**
>
> Κεντρικοποιημένο σύστημα αναζήτησης για όλες τις οντότητες της εφαρμογής

**📊 Status**: PR#1 Complete | **Version**: 1.0.0 | **Date**: 2026-01-25

---

## 🎯 **OVERVIEW**

Το Global Search v1 παρέχει **unified search experience** για όλες τις οντότητες:
- Projects, Buildings, Units
- Contacts
- Files

### **Key Features**

| Feature | Description | Status |
|---------|-------------|--------|
| **Greek-Friendly Search** | Normalization για ελληνικά (τόνοι, κεφαλαία) | ✅ |
| **Prefix Matching** | Firestore-native autocomplete | ✅ |
| **Deep Links** | Direct navigation σε entity pages | ✅ |
| **Entity Grouping** | Results grouped by entityType | ✅ |
| **Tenant Isolation** | Multi-tenant via companyId | ✅ |
| **Audit Logging** | Privacy-conscious logging | ✅ |

### **Non-Goals (v1)**

- ❌ AI/LLM-powered search
- ❌ Full-text search (Firestore limitation)
- ❌ Fuzzy matching
- ❌ Search analytics dashboard

---

## 🏗️ **ARCHITECTURE**

### **Data Flow**

```
User Query → API Gateway → Firestore Query → Results → UI
     ↓            ↓              ↓            ↓
 Normalize    Auth Check    Tenant Filter   Group by Type
```

### **Components**

| Component | Location | Purpose |
|-----------|----------|---------|
| **Types** | `src/types/search.ts` | Type definitions |
| **Config** | `src/config/search-index-config.ts` | Index configuration |
| **API** | `src/app/api/search/route.ts` | Search Gateway |
| **Collection** | `searchDocuments` | Firestore index |

---

## 📁 **FILE STRUCTURE**

```
src/
├── types/
│   └── search.ts                    # Type definitions (200+ lines)
├── config/
│   └── search-index-config.ts       # Index configuration (180+ lines)
├── app/api/
│   └── search/
│       └── route.ts                 # API Gateway (250+ lines)
└── lib/
    └── search/
        └── search.ts                # Greek normalization (existing)
```

---

## 🔧 **TYPE DEFINITIONS**

### **SearchDocument** (Firestore Schema)

```typescript
interface SearchDocument {
  // === Identity ===
  tenantId: string;              // companyId - tenant isolation
  entityType: SearchEntityType;  // 'project' | 'building' | 'unit' | 'contact' | 'file'
  entityId: string;              // Original entity ID

  // === Display ===
  title: string;                 // Primary display
  subtitle: string;              // Secondary info
  status: string;                // Entity status

  // === Search Fields ===
  search: {
    normalized: string;          // Greek-normalized text
    prefixes: string[];          // For prefix matching
  };

  // === Access Control ===
  audience: 'internal' | 'external';
  requiredPermission: string;

  // === Navigation ===
  links: {
    href: string;                // Route path
    routeParams: Record<string, string>;
  };

  // === Timestamps ===
  createdAt: Timestamp;
  updatedAt: Timestamp;
  indexedAt: Timestamp;
}
```

### **SearchEntityType**

```typescript
const SEARCH_ENTITY_TYPES = {
  PROJECT: 'project',
  BUILDING: 'building',
  UNIT: 'unit',
  CONTACT: 'contact',
  FILE: 'file',
} as const;

type SearchEntityType = 'project' | 'building' | 'unit' | 'contact' | 'file';
```

### **SearchResult** (API Response)

```typescript
interface SearchResult {
  entityType: SearchEntityType;
  entityId: string;
  title: string;
  subtitle: string;
  href: string;
}
```

---

## ⚙️ **INDEX CONFIGURATION**

### **Per-Entity Configuration**

```typescript
// src/config/search-index-config.ts

const SEARCH_INDEX_CONFIG: SearchIndexConfigMap = {
  project: {
    collection: 'projects',
    titleField: 'name',
    subtitleFields: ['address', 'city'],
    searchableFields: ['name', 'address', 'city', 'projectCode'],
    statusField: 'status',
    audience: 'internal',
    requiredPermission: 'projects:projects:view',
    routeTemplate: '/projects/{id}',
  },
  contact: {
    collection: 'contacts',
    titleField: (doc) => doc.displayName || `${doc.firstName} ${doc.lastName}`,
    subtitleFields: ['email', 'phone'],
    searchableFields: ['displayName', 'firstName', 'lastName', 'email'],
    statusField: 'status',
    audience: 'internal',
    requiredPermission: 'crm:contacts:view',
    routeTemplate: '/contacts/{id}',
  },
  // ... building, unit, file
};
```

---

## 🌐 **API REFERENCE**

### **GET /api/search**

**Authentication**: Required (withAuth middleware)

**Permission**: `search:global:execute`

#### **Query Parameters**

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `q` | string | Yes | - | Search query (min 2 chars) |
| `types` | string | No | all | Comma-separated entity types |
| `limit` | number | No | 10 | Results per type (max 50) |

#### **Example Request**

```bash
GET /api/search?q=παγώνης&types=contact,project&limit=5
```

#### **Success Response**

```json
{
  "success": true,
  "results": [
    {
      "entityType": "contact",
      "entityId": "abc123",
      "title": "Γιώργος Παγώνης",
      "subtitle": "george@example.com",
      "href": "/contacts/abc123"
    }
  ],
  "query": {
    "normalized": "παγωνης",
    "types": ["contact", "project"]
  }
}
```

#### **Error Response**

```json
{
  "success": false,
  "error": "Query too short"
}
```

---

## 🔒 **SECURITY**

### **Access Control**

| Layer | Implementation |
|-------|----------------|
| **Authentication** | `withAuth` middleware |
| **Permission** | `search:global:execute` |
| **Tenant Isolation** | `tenantId == companyId` filter |
| **Audience Filter** | `audience == 'internal'` for authenticated |

### **Audit Logging**

```typescript
// Privacy-conscious: Does NOT log actual query text
{
  action: 'data_accessed',
  targetId: 'global_search',
  targetType: 'api',
  metadata: {
    queryLength: 12,        // NOT the query itself
    resultCount: 5,
    entityTypes: ['contact'],
    audience: 'internal',
  }
}
```

---

## 🇬🇷 **GREEK SEARCH SUPPORT**

### **Normalization**

Χρησιμοποιεί το existing `normalizeSearchText` από `src/lib/search/search.ts`:

```typescript
// Input: "ΓΙΏΡΓΟΣ Παγώνης"
// Output: "γιωργος παγωνης"

const normalized = normalizeSearchText(query);
```

### **Features**

- ✅ Lowercase conversion
- ✅ Accent/diacritic removal (ά → α, ή → η)
- ✅ Whitespace normalization
- ✅ Greek-specific character handling

---

## 📊 **FIRESTORE INDEXES**

### **Required Composite Indexes**

```
Collection: searchDocuments

Index 1: tenantId + audience + entityType + updatedAt (DESC)
Index 2: tenantId + search.prefixes (array-contains-any) + updatedAt (DESC)
```

### **Query Strategy**

```typescript
// Hybrid search: prefix + normalized filter
searchCollection
  .where('tenantId', '==', tenantId)
  .where('entityType', '==', entityType)
  .where('audience', '==', 'internal')
  .where('search.prefixes', 'array-contains-any', prefixes)
  .orderBy('updatedAt', 'desc')
  .limit(limit)
```

---

## 🚀 **USAGE EXAMPLES**

### **Basic Search**

```typescript
// Client-side fetch
const response = await fetch('/api/search?q=παγώνης');
const data = await response.json();

if (data.success) {
  data.results.forEach(result => {
    console.log(`${result.title} → ${result.href}`);
  });
}
```

### **Filtered Search**

```typescript
// Search only contacts and projects
const response = await fetch('/api/search?q=test&types=contact,project&limit=20');
```

---

## 📈 **CONFIGURATION CONSTANTS**

```typescript
// src/types/search.ts

const SEARCH_CONFIG = {
  DEFAULT_LIMIT: 10,        // Default results per type
  MAX_LIMIT: 50,            // Maximum results per type
  DEBOUNCE_MS: 300,         // Client-side debounce
  CACHE_TTL_MS: 300000,     // 5 minutes SWR cache
  MIN_QUERY_LENGTH: 2,      // Minimum query length
  MAX_PREFIX_LENGTH: 5,     // Max prefix for array-contains
};
```

---

## 🔜 **ROADMAP**

### **PR#2: Index Triggers** ✅ **COMPLETE**

- ✅ Cloud Functions για automatic indexing
- ✅ Triggers για project, contact create/update/delete
- ✅ Backfill script για existing data

**Files Created:**
- `functions/src/search/indexBuilder.ts` - Helper για building SearchDocument
- `functions/src/search/indexTriggers.ts` - Firestore triggers
- `scripts/search-backfill.ts` - Backfill script

**Backfill Usage:**
```bash
# Dry run (show what would be indexed)
npx ts-node scripts/search-backfill.ts --dry-run

# Execute backfill for all entities
npx ts-node scripts/search-backfill.ts --execute

# Execute for specific type
npx ts-node scripts/search-backfill.ts --execute --type=contact
```

### **PR#3: UI Command Palette** ✅ **COMPLETE**

- ✅ `GlobalSearchDialog.tsx` - Command Palette component
- ✅ `SearchResultItem.tsx` - Result item rendering
- ✅ `useGlobalSearch.ts` - React hook για search API
- ✅ `Cmd+K` / `Ctrl+K` keyboard shortcut
- ✅ Result grouping by entity type
- ✅ Keyboard navigation (↑↓ Enter Escape)
- ✅ i18n translations (EL/EN)

**Files Created:**
- `src/components/search/GlobalSearchDialog.tsx` - Main command palette
- `src/components/search/SearchResultItem.tsx` - Result item + group components
- `src/components/search/index.ts` - Centralized exports
- `src/hooks/useGlobalSearch.ts` - Search hook με debouncing

**Usage:**
```tsx
// Dialog ανοίγει αυτόματα με ⌘K / Ctrl+K
// Ή χειροκίνητα:
import { GlobalSearchDialog } from '@/components/search';

// Uncontrolled (auto keyboard shortcut)
<GlobalSearchDialog />

// Controlled
const [open, setOpen] = useState(false);
<GlobalSearchDialog open={open} onOpenChange={setOpen} />
```

**Hook Usage:**
```tsx
import { useGlobalSearch } from '@/hooks/useGlobalSearch';

const { query, setQuery, results, isLoading, error } = useGlobalSearch({
  debounceMs: 300,
  limit: 10,
});
```

### **PR#4+: Extensions**

- Buildings, Units, Files indexing
- External/public search endpoint
- Search analytics

---

## 📚 **RELATED DOCUMENTATION**

- **[API Quick Reference](../reference/api-quick-reference.md)** - Complete API reference
- **[Data Systems](../data-systems/index.md)** - Data architecture
- **[Configuration](../configuration/index.md)** - App configuration

---

## 🔗 **SOURCE FILES**

| File | Lines | Purpose |
|------|-------|---------|
| `src/types/search.ts` | ~350 | Type definitions |
| `src/config/search-index-config.ts` | ~180 | Index configuration |
| `src/app/api/search/route.ts` | ~250 | API Gateway |
| `src/lib/search/search.ts` | existing | Greek normalization |
| `src/components/search/GlobalSearchDialog.tsx` | ~450 | Command Palette UI |
| `src/components/search/SearchResultItem.tsx` | ~260 | Result item components |
| `src/hooks/useGlobalSearch.ts` | ~250 | Search hook με debouncing |
| `functions/src/search/indexBuilder.ts` | ~400 | Search document builder |
| `functions/src/search/indexTriggers.ts` | ~200 | Firestore triggers |
| `scripts/search-backfill.ts` | ~490 | Backfill script |

---

> **💡 Tip**: Για quick testing χρησιμοποίησε: `curl -H "Authorization: Bearer TOKEN" "http://localhost:3000/api/search?q=test"`
>
> **🔄 Last Updated**: 2026-01-25
>
> **👥 Maintainers**: Γιώργος Παγώνης + Claude Code (Anthropic AI)
