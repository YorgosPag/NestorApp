# 🏢 **ENTITY SYSTEMS**

> **Enterprise Documentation**: Entity linking, ID generation, uploads, and management

**📊 Stats**: 8 ADRs | Last Updated: 2026-01-31

---

## 🎯 **RELATED ADRs**

| ADR | Decision | Status |
|-----|----------|--------|
| **ADR-012** | Entity Linking Service | ✅ APPROVED |
| **ADR-016** | Navigation Breadcrumb Path System | ✅ APPROVED |
| **ADR-017** | Enterprise ID Generation | ✅ APPROVED |
| **ADR-018** | Unified Upload Service | ✅ APPROVED |
| **ADR-018.1** | Photos Tab Base Template | ✅ APPROVED |
| **ADR-025** | Unit Linking System | ✅ APPROVED |
| **ADR-052** | DXF Export API Contract | ✅ APPROVED |
| **ADR-054** | Enterprise Upload System Consolidation | ✅ APPROVED |

---

## 🔗 **ADR-012: ENTITY LINKING SERVICE**

**Date**: 2026-01-07
**Status**: ✅ APPROVED

### Decision

Centralize all entity linking operations through a single service.

### Canonical Service

```typescript
import { EntityLinkingService } from '@/services/entity-linking';

// Features
- Retry logic with exponential backoff
- Cache invalidation
- Audit trail for all operations
- Optimistic updates
```

---

## 🧭 **ADR-016: NAVIGATION BREADCRUMB PATH SYSTEM**

**Date**: 2026-01-10
**Status**: ✅ APPROVED

### Decision

Use lightweight breadcrumb refs for navigation display.

### Canonical API

```typescript
import { syncBreadcrumb } from '@/contexts/NavigationContext';

// Type: Lightweight display-only reference
interface BreadcrumbEntityRef {
  id: string;
  name: string;
  type: EntityType;
}
```

---

## 🆔 **ADR-017: ENTERPRISE ID GENERATION**

**Date**: 2026-01-11
**Status**: ✅ APPROVED

### Decision

Use enterprise ID service for all ID generation.

### Canonical Service

```typescript
// ✅ CANONICAL
import { generateId } from '@/services/enterprise-id.service';

const id = generateId('entity'); // Returns: 'entity_abc123...'

// ❌ PROHIBITED
const id = Math.random().toString(36); // Not unique, not traceable
```

---

## 📤 **ADR-018: UNIFIED UPLOAD SERVICE**

**Date**: 2026-01-11
**Status**: ✅ APPROVED

### Decision

Gateway + Strategy Pattern for all file uploads.

### Canonical Service

```typescript
import { UnifiedUploadService } from '@/services/upload';

// Supports: Images, Documents, DXF files
// Features: Progress tracking, validation, retry
```

---

## 📷 **ADR-018.1: PHOTOS TAB BASE TEMPLATE**

**Date**: 2026-01-11
**Status**: ✅ APPROVED

### Decision

Reusable base template for all entity photo tabs.

### Canonical Component

```typescript
import { PhotosTabBase } from '@/components/generic/config/photo-config/PhotosTabBase';

// Result: 79% code reduction across entity photo tabs
```

---

## 🏠 **ADR-025: UNIT LINKING SYSTEM**

**Date**: 2026-01-24
**Status**: ✅ APPROVED

### Decision

Specialized components for building/unit relationships.

### Canonical Components

```typescript
import { BuildingSelectorCard } from '@/components/units/BuildingSelectorCard';
import { LinkedSpacesCard } from '@/components/units/LinkedSpacesCard';

// Pattern: Dependency Injection + Real-time Firestore
```

---

## 📄 **ADR-052: DXF EXPORT API CONTRACT**

**Date**: 2026-01-30
**Status**: ✅ APPROVED

### Decision

Type-safe contract for DXF export operations.

### Canonical Types

```typescript
import type {
  DxfExportOptions,
  DxfExportResult,
  DxfExportError
} from '@/types/dxf-export.types';

// Coverage:
// - 18 entity mappings
// - 7 DXF versions
// - 17 error codes
```

---

## 📤 **ADR-054: ENTERPRISE UPLOAD SYSTEM CONSOLIDATION**

**Date**: 2026-01-30
**Status**: ✅ APPROVED

### Decision

5 canonical components for upload pipeline.

### Pipeline

```
pending → upload → finalize
```

### Canonical Components

1. `FileDropzone` - Drag & drop interface
2. `UploadProgress` - Progress tracking
3. `FilePreview` - Preview before upload
4. `UploadManager` - Queue management
5. `UploadComplete` - Success confirmation

---

## 📚 **RELATED DOCUMENTATION**

- **[ADR Index](../reference/adr-index.md)** - Complete ADR listing
- **[State Management](./state-management.md)** - Context providers
- **[Photo System](../ui-systems/photo-system.md)** - Media management

---

> **🔄 Last Updated**: 2026-01-31
>
> **👥 Maintainers**: Γιώργος Παγώνης + Claude Code (Anthropic AI)
