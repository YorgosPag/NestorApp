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

## 12. Implementation Plan (Phased)

> **🚫 NO DXF CODING BEFORE PR-1C PASS** — This section is documentation-only until Security Gates complete.

> **BLOCKING DEPENDENCY**: PR-1C (Rate Limiting) MUST be PASS before Phase 1 coding begins.

### Phase 0: Documentation & Contracts (CURRENT - No Security Gate Dependency)

**Timeline**: Immediate (can run parallel to Security Stream)

| Task | Deliverable | Status | Owner |
|------|-------------|--------|-------|
| **P0.1** | DXF Subsystem Audit Report | ✅ Complete | `docs/architecture-review/06-dxf-subsystem-review.md` |
| **P0.2** | ADR: DXF Export Architecture | ✅ Complete | This document |
| **P0.3** | API Contract (types/schemas) | ✅ Complete | `src/subapps/dxf-viewer/types/dxf-export.types.ts` (600+ lines, ADR-052) |
| **P0.4** | Test Strategy (Golden Files) | ✅ Complete | [DXF_EXPORT_TEST_STRATEGY.md](../testing/DXF_EXPORT_TEST_STRATEGY.md) |
| **P0.5** | Storage Strategy Document | ✅ Complete | [DXF_EXPORT_STORAGE_STRATEGY.md](./DXF_EXPORT_STORAGE_STRATEGY.md) |

**Acceptance**: All docs reviewed and approved before Phase 1.

---

### Phase 1: Microservice Skeleton (REQUIRES: PR-1C PASS + All Gates Green)

**Timeline**: After Security Gates complete
**Status**: ✅ **SKELETON COMPLETE** (2026-01-30) - Feature flag OFF pending PR-1C

| Task | Deliverable | Dependency | Acceptance Criteria | Status |
|------|-------------|------------|---------------------|--------|
| **P1.1** | Docker container setup | None | `docker build` succeeds | ✅ Complete |
| **P1.2** | FastAPI skeleton | P1.1 | `/health` returns 200 | ✅ Complete |
| **P1.3** | ezdxf integration | P1.2 | Can create empty DXF in memory | ✅ Complete |
| **P1.4** | POST `/api/v1/dxf/export` | P1.3 | Returns valid DXF bytes | ✅ Complete |
| **P1.5** | Feature flag in app | P1.4 | Export button hidden by default | ✅ Complete (FEATURE_FLAG_ENABLED=false) |
| **P1.6** | Basic integration test | P1.5 | App → Service → DXF file | ✅ Complete (pytest) |

**Location**: `services/dxf-export/` (Python microservice)
**Documentation**: `services/dxf-export/README.md`

**Acceptance**: G1, G2 from Quality Gates (Section 7) pass.

---

### Phase 2: Full Entity Support

**Timeline**: After Phase 1 validated

| Task | Deliverable | Entity Types |
|------|-------------|--------------|
| **P2.1** | Line entities | LINE, XLINE, RAY |
| **P2.2** | Polyline entities | LWPOLYLINE, POLYLINE, SPLINE |
| **P2.3** | Circular entities | CIRCLE, ARC, ELLIPSE |
| **P2.4** | Text entities | TEXT, MTEXT |
| **P2.5** | Overlay conversion | POLYGON → LWPOLYLINE (closed) |
| **P2.6** | Layer preservation | Layer names, colors, visibility |
| **P2.7** | Greek text encoding | UTF-8 with ezdxf encoding |

**Acceptance**: G3 (complex DXF export) passes.

---

### Phase 3: Validation & Round-Trip

**Timeline**: After Phase 2

| Task | Deliverable | Test Method |
|------|-------------|-------------|
| **P3.1** | POST `/api/v1/dxf/validate` | Validate DXF structure |
| **P3.2** | Round-trip test suite | Import → Export → Import comparison |
| **P3.3** | AutoCAD compatibility | Open exported DXF in AutoCAD |
| **P3.4** | BricsCAD compatibility | Open exported DXF in BricsCAD |
| **P3.5** | Golden file comparison | Byte-level or structural diff |

**Acceptance**: G4, G5 from Quality Gates pass.

---

### Phase 4: Production Hardening

**Timeline**: After Phase 3

| Task | Deliverable | Metric |
|------|-------------|--------|
| **P4.1** | Load testing | 100 concurrent exports *(PLACEHOLDER - final value in SSoT config)* |
| **P4.2** | Rate limiting integration | Uses centralized rate-limit system |
| **P4.3** | Security scan | Container + dependencies |
| **P4.4** | Monitoring/alerting | Health checks, error rates |
| **P4.5** | Documentation | API docs, runbook |
| **P4.6** | Feature flag removal | Export enabled for all users |

**Acceptance**: G6, G7 from Quality Gates pass. Production deployment approved.

---

### Gantt Overview (Conceptual)

```
Phase 0 (Docs)      ████████░░░░░░░░░░░░░░░░  (NOW - Parallel to Security)
Security Gates      ░░░░████████░░░░░░░░░░░░  (PR-0/1A/1B/1C)
Phase 1 (Skeleton)  ░░░░░░░░░░░░████░░░░░░░░  (After Gates Green)
Phase 2 (Entities)  ░░░░░░░░░░░░░░░░████░░░░  (After Phase 1)
Phase 3 (Validate)  ░░░░░░░░░░░░░░░░░░░░██░░  (After Phase 2)
Phase 4 (Harden)    ░░░░░░░░░░░░░░░░░░░░░░██  (Before Production)
```

---

## 13. Test Strategy (Golden Files)

> **🚫 NO DXF CODING BEFORE PR-1C PASS** — This section is documentation-only until Security Gates complete.

> **📚 COMPREHENSIVE DOCUMENTATION**: For full enterprise test strategy, see **[DXF_EXPORT_TEST_STRATEGY.md](../testing/DXF_EXPORT_TEST_STRATEGY.md)** which includes:
> - 20 Golden File fixtures specification
> - Round-trip testing methodology
> - CAD compatibility matrix (AutoCAD, BricsCAD, LibreCAD)
> - CI/CD pipeline configuration
> - Performance benchmarks

### 13.1 Golden File Approach

**Definition**: Golden files are reference DXF files with known-good output. Tests compare generated output against these baselines.

```
tests/
└── dxf-export/
    ├── fixtures/           # Input data (JSON scene models)
    │   ├── simple-lines.json
    │   ├── complex-floor-plan.json
    │   └── greek-text-labels.json
    │
    ├── golden/             # Expected output (DXF files)
    │   ├── simple-lines.dxf
    │   ├── complex-floor-plan.dxf
    │   └── greek-text-labels.dxf
    │
    └── __tests__/
        ├── export.test.ts           # Unit tests
        ├── round-trip.test.ts       # Import → Export → Import
        └── golden-comparison.test.ts # Golden file diff
```

---

### 13.2 Test Categories

| Category | Description | Count | Priority |
|----------|-------------|-------|----------|
| **Unit Tests** | Individual entity conversion | 15+ | P0 |
| **Integration Tests** | App → Service → DXF | 5+ | P1 |
| **Golden File Tests** | Output comparison | 10+ | P1 |
| **Round-Trip Tests** | Import → Export → Import | 5+ | P2 |
| **Compatibility Tests** | AutoCAD/BricsCAD open | 3+ | P2 |
| **Load Tests** | Concurrent exports | 3+ | P3 |

---

### 13.3 Golden File Fixtures

| Fixture | Entities | Purpose | Complexity |
|---------|----------|---------|------------|
| **simple-lines.json** | 5 LINE entities | Basic export validation | Low |
| **polyline-shapes.json** | 3 LWPOLYLINE (open + closed) | Polyline handling | Medium |
| **circles-arcs.json** | CIRCLE, ARC, ELLIPSE | Circular entity support | Medium |
| **text-labels.json** | TEXT, MTEXT (Greek) | Text + encoding | Medium |
| **complex-floor-plan.json** | 50+ mixed entities | Real-world scenario | High |
| **overlays-to-dxf.json** | 10 Overlay polygons | Overlay → DXF conversion | Medium |
| **multi-layer.json** | Entities on 5 layers | Layer preservation | Medium |

---

### 13.4 Comparison Strategy

```python
# Golden file comparison approaches (in ezdxf service)

def compare_dxf_files(generated: str, golden: str) -> ComparisonResult:
    """
    Strategy 1: Structural comparison (RECOMMENDED)
    - Parse both DXF files with ezdxf
    - Compare entity counts, types, coordinates
    - Ignore metadata (timestamps, software version)
    """
    gen_doc = ezdxf.readfile(generated)
    gold_doc = ezdxf.readfile(golden)

    return ComparisonResult(
        entity_count_match=len(gen_doc.modelspace()) == len(gold_doc.modelspace()),
        entity_types_match=get_entity_types(gen_doc) == get_entity_types(gold_doc),
        coordinates_match=compare_coordinates(gen_doc, gold_doc, tolerance=0.001),
        layers_match=get_layers(gen_doc) == get_layers(gold_doc)
    )
```

---

### 13.5 Test Execution

```bash
# Unit tests (microservice)
cd services/dxf-export
pytest tests/unit/ -v

# Integration tests (app + service)
pnpm test:dxf-export

# Golden file tests
pytest tests/golden/ -v --golden-dir=tests/golden/

# Round-trip tests
pytest tests/round_trip/ -v

# Update golden files (when intentionally changing output)
pytest tests/golden/ -v --update-golden
```

---

### 13.6 CI/CD Integration

> **⚠️ ILLUSTRATIVE EXAMPLE ONLY**: Do NOT modify `.github/workflows/quality-gates.yml` until PR-1C PASS and Security stream approval. All numeric values (ports, timeouts) are PLACEHOLDERS — final values will be defined in centralized SSoT config.

```yaml
# .github/workflows/quality-gates.yml (FUTURE addition - DO NOT IMPLEMENT YET)

dxf-export-tests:
  runs-on: ubuntu-latest
  needs: [lint, typecheck]
  steps:
    - uses: actions/checkout@v4

    - name: Start ezdxf service
      run: docker-compose up -d dxf-export-service

    - name: Wait for service health
      run: |
        # PLACEHOLDERS: timeout (30s) and port (8080) - final values from SSoT config
        timeout 30 bash -c 'until curl -s http://localhost:8080/health; do sleep 1; done'

    - name: Run golden file tests
      run: pytest tests/golden/ -v

    - name: Run round-trip tests
      run: pytest tests/round_trip/ -v

    - name: Upload test artifacts
      if: failure()
      uses: actions/upload-artifact@v4
      with:
        name: dxf-test-failures
        path: tests/dxf-export/failures/
```

---

### 13.7 Golden File Update Policy

| Scenario | Action | Approval Required |
|----------|--------|-------------------|
| **Bug fix** | Update golden if output improves | Code review |
| **New entity type** | Add new golden file | Code review |
| **Intentional format change** | Update all affected golden files | Architecture review |
| **Accidental regression** | Fix code, NOT golden file | Mandatory |

**Rule**: Golden files are updated via `--update-golden` flag, NEVER manually edited.

---

### 13.8 Checklist for Merge (DXF Export PRs)

Before any DXF Export PR can be merged:

- [ ] **Local_Protocol**: Zero `any`, zero hardcoded, zero duplicates
- [ ] **Security Gates**: PR-1C PASS (rate limiting production-grade)
- [ ] **Unit Tests**: All pass
- [ ] **Golden File Tests**: All pass (no unexpected diff)
- [ ] **Round-Trip Tests**: Import → Export → Import matches
- [ ] **Compatibility**: Opened in AutoCAD/BricsCAD without errors
- [ ] **TypeScript**: `pnpm typecheck` passes
- [ ] **Lint**: `pnpm lint` passes
- [ ] **Build**: `pnpm build` succeeds

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-29 | Claude (Anthropic AI) | Initial strategy document |
| 1.1 | 2026-01-29 | Claude #2 (DXF Stream) | Added Section 12: Implementation Plan (Phased) |
| 1.2 | 2026-01-29 | Claude #2 (DXF Stream) | Added Section 13: Test Strategy (Golden Files) |
| 1.3 | 2026-01-29 | Claude #2 (DXF Stream) | Polishing: Added "No DXF coding" locks, PLACEHOLDER notes, CI/CD disclaimer |
