# Strategy Document: DXF Technology Decision

**Document ID**: STRATEGY-001
**Created**: 2026-01-29
**Status**: APPROVED
**Owner**: Architecture Team

---

## 1. Executive Summary

This document formalizes the technology decision for DXF (Drawing Exchange Format) handling in the Nestor Construct Platform. The platform currently has **import-only** capability using `dxf-parser`. This strategy adds **export functionality** using `ezdxf` as a Python microservice.

### Decision

> **Option B: Python microservice with ezdxf** for DXF export and validation, keeping existing `dxf-parser` for import.

### Key Benefits

- **MIT License** - Zero licensing costs
- **Full DXF Support** - R12 to R2018
- **Export Capability** - Missing feature filled
- **Strongest OSS** - Most active community, best documentation

---

## 2. Current State Analysis

### 2.1 Existing Implementation

**File**: `src/subapps/dxf-viewer/io/dxf-import.ts`

```typescript
// Current: dxf-parser v1.1.2 (import only)
export class DxfImportService {
  async importDxfFile(file: File, encoding?: string): Promise<DxfImportResult> {
    // Uses dxf-parser internally via DxfSceneBuilder
    const scene = DxfSceneBuilder.buildScene(content);
    return { success: true, scene, stats };
  }
}
```

### 2.2 Current Capabilities

| Capability | Status | Details |
|------------|--------|---------|
| **Import DXF** | Yes | dxf-parser v1.1.2, Greek encoding support |
| **Export DXF** | **NO** | Missing - critical gap |
| **Validate DXF** | Partial | Basic scene validation only |
| **Edit DXF** | Yes | In-memory modifications via overlays |
| **Layer Support** | Yes | Full layer management |

### 2.3 Critical Gap

Users can import DXF, add overlays, view and navigate. Users **cannot** export modified DXF back to file or save overlays as DXF entities.

---

## 3. Options Analysis

### Option A: Keep dxf-parser + Add dxf-writer (Node.js)

| Aspect | Assessment |
|--------|------------|
| **License** | MIT |
| **DXF Versions** | Limited (R12, R2000) |
| **Maintenance** | Low activity (last commit 2020) |

**Verdict**: **NOT RECOMMENDED** - Too limited for enterprise use

---

### Option B: Python Microservice with ezdxf (RECOMMENDED)

| Aspect | Assessment |
|--------|------------|
| **License** | MIT |
| **DXF Versions** | Full (R12-R2018) |
| **Maintenance** | Very active (weekly commits) |

**Pros**:
- Strongest OSS DXF library in existence
- Full DXF R12-R2018 support
- Export, import, validation all-in-one
- Used by industry (FreeCAD, BricsCAD plugins)

**Verdict**: **RECOMMENDED** - Enterprise-grade solution

---

### Option C: ODA SDK (Commercial)

| Aspect | Assessment |
|--------|------------|
| **License** | Commercial ($$$) |
| **DXF Versions** | Full + DWG |

**Verdict**: **NOT RECOMMENDED** - Cost prohibitive

---

## 4. Decision

### 4.1 Final Decision: **Option B - ezdxf Python Microservice**

### 4.2 Decision Criteria

| Criterion | Weight | Option A | Option B | Option C |
|-----------|--------|----------|----------|----------|
| **Cost** | 30% | 10 | 10 | 2 |
| **DXF Support** | 25% | 4 | 10 | 10 |
| **Maintenance** | 20% | 3 | 9 | 8 |
| **Integration** | 15% | 9 | 6 | 5 |
| **Future-proof** | 10% | 3 | 9 | 9 |
| **TOTAL** | 100% | **5.65** | **8.85** | **6.35** |

---

## 5. Implementation Architecture

### 5.1 Service Architecture

```
Next.js Application
    │
    ├── DXF Viewer (existing)
    │   └── dxf-parser for import
    │
    └── DXF Export Service Client
        └── src/subapps/dxf-viewer/services/dxf-export.ts
                │
                │ HTTP/REST
                ▼
        ezdxf Microservice (Docker)
        ├── POST /api/v1/dxf/export
        ├── POST /api/v1/dxf/validate
        └── GET  /api/v1/health
```

### 5.2 API Contract

```yaml
# POST /api/v1/dxf/export
Request:
  Body:
    entities: Entity[]
    layers: Layer[]
    settings:
      dxfVersion: "R2018"
      units: "metric"
      encoding: "UTF-8"

Response:
  Content-Type: application/octet-stream
  Body: <DXF file bytes>
```

### 5.3 Entity Mapping

| Nestor Entity | ezdxf Entity |
|---------------|--------------|
| `SceneEntity (LINE)` | `doc.modelspace().add_line()` |
| `SceneEntity (POLYLINE)` | `doc.modelspace().add_lwpolyline()` |
| `SceneEntity (CIRCLE)` | `doc.modelspace().add_circle()` |
| `Overlay (POLYGON)` | `doc.modelspace().add_lwpolyline()` (closed) |
| `Overlay (TEXT)` | `doc.modelspace().add_mtext()` |

---

## 6. Migration Strategy (Strangler Fig Pattern)

1. **Phase 1**: Deploy ezdxf service (no production traffic)
2. **Phase 2**: Add export button in UI (calls ezdxf)
3. **Phase 3**: Optional: Migrate import validation to ezdxf
4. **Phase 4**: Optional: Full import migration (if needed)

**Rollback Plan**: Keep dxf-parser for import, ezdxf is additive only.

---

## 7. Quality Gates

| Gate | Requirement | Status |
|------|-------------|--------|
| **G1** | Service health endpoint responds | Pending |
| **G2** | Export simple DXF (lines only) | Pending |
| **G3** | Export complex DXF (all entity types) | Pending |
| **G4** | Round-trip test (import → export → import) | Pending |
| **G5** | Golden file comparison tests | Pending |
| **G6** | Load test (100 concurrent exports) | Pending |
| **G7** | Security scan (container, dependencies) | Pending |

---

## 8. Acceptance Criteria

### Functional
- [ ] **AC-1**: User can export current DXF view as file
- [ ] **AC-2**: Exported DXF opens correctly in AutoCAD/BricsCAD
- [ ] **AC-3**: Overlays are included in export as native DXF entities
- [ ] **AC-4**: Layer structure is preserved
- [ ] **AC-5**: Greek text renders correctly

### Non-Functional
- [ ] **AC-6**: Export completes in < 5 seconds for typical floor plan
- [ ] **AC-7**: Service handles 50 concurrent users
- [ ] **AC-8**: Service restarts automatically on failure

---

## 9. Security Considerations

| Concern | Mitigation |
|---------|------------|
| **Unauthenticated access** | Service behind internal network only |
| **Malicious DXF upload** | File size limits, sanitization |
| **DoS via large files** | Rate limiting, timeout (30s) |
| **Container escape** | Minimal base image, no root |

---

## 10. Related Documents

- **Current Implementation**: `src/subapps/dxf-viewer/io/dxf-import.ts`
- **Centralized Systems**: `src/subapps/dxf-viewer/docs/centralized_systems.md`
- **Architecture Review**: `docs/architecture-review/06-dxf-subsystem-review.md`
- **ezdxf Documentation**: https://ezdxf.readthedocs.io/

---

## 11. Local_Protocol Compliance

> **MANDATORY**: All implementation PRs for this strategy MUST comply with Local_Protocol (CLAUDE.md) as a **non-negotiable quality gate**.

### Required Compliance Checks

| Rule | Requirement | Enforcement |
|------|-------------|-------------|
| **ZERO `any`** | No TypeScript `any` types | PR blocked if found |
| **ZERO `as any`** | No type casting to `any` | PR blocked if found |
| **ZERO `@ts-ignore`** | No TypeScript ignores | PR blocked if found |
| **ZERO inline styles** | Use design tokens only | PR blocked if found |
| **ZERO duplicates** | Use centralized systems | PR blocked if found |
| **ZERO hardcoded values** | Use config/constants | PR blocked if found |

### Pre-PR Checklist

Before any PR implementing this strategy:

- [ ] Searched for existing code (Grep/Glob)
- [ ] No `any` types in new code
- [ ] Uses centralized systems from `centralized_systems.md`
- [ ] No inline styles (uses design tokens)
- [ ] Asked permission before creating new files
- [ ] TypeScript compiles without errors

### Violation Consequences

**Any PR violating Local_Protocol will be REJECTED regardless of functionality.**

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-29 | Claude (Anthropic AI) | Initial strategy document |
