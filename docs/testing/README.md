# 🧪 TESTING DOCUMENTATION INDEX

> **Enterprise Testing Infrastructure**
> **Last Updated**: 2026-01-30
> **Standard**: SAP/Autodesk/Google Testing Practices

---

## 📚 DOCUMENT CATALOG

| Document | Purpose | Scope | Status |
|----------|---------|-------|--------|
| **[DXF_EXPORT_TEST_STRATEGY.md](./DXF_EXPORT_TEST_STRATEGY.md)** | DXF Export testing methodology | ezdxf microservice, golden files, CAD compatibility | ✅ Active |

---

## 🎯 TESTING PHILOSOPHY

### Core Principles (Enterprise Standard)

1. **Golden File Testing** - Output comparison against verified baseline files
2. **Round-Trip Validation** - Import → Export → Import integrity checks
3. **CAD Compatibility** - Verification in AutoCAD, BricsCAD, LibreCAD
4. **Automated Regression** - CI/CD integration with quality gates

### Test Pyramid

```
                    ▲
                   / \
                  / E2E \           ← 5% (Critical user flows)
                 /───────\
                /         \
               / Integration\        ← 15% (Service interactions)
              /─────────────\
             /               \
            /   Unit Tests    \      ← 80% (Entity conversion)
           /───────────────────\
```

---

## 🔗 CROSS-REFERENCES

### Strategy Documents
- [01-dxf-technology-decision.md](../strategy/01-dxf-technology-decision.md) - Technology selection
- [06-dxf-subsystem-review.md](../architecture-review/06-dxf-subsystem-review.md) - Architecture review

### Type Definitions
- [dxf-export.types.ts](../../src/subapps/dxf-viewer/types/dxf-export.types.ts) - API contract types

### Centralized Systems
- [centralized_systems.md](../../src/subapps/dxf-viewer/docs/centralized_systems.md) - ADR-052

---

## 📊 QUALITY GATES

| Gate | Threshold | Blocking |
|------|-----------|----------|
| **Unit Test Coverage** | ≥80% | Yes |
| **Golden File Tests** | 100% pass | Yes |
| **Round-Trip Tests** | 100% pass | Yes |
| **CAD Compatibility** | AutoCAD 2018+ opens | Yes |
| **TypeScript** | Zero errors | Yes |

---

## 🛠️ TEST INFRASTRUCTURE

### Tools

| Tool | Purpose | Version |
|------|---------|---------|
| **pytest** | Python unit/integration tests | ≥7.0 |
| **Jest** | TypeScript unit tests | ≥29.0 |
| **Playwright** | E2E testing | ≥1.40 |
| **ezdxf** | DXF validation library | ≥1.0 |

### Commands

```bash
# Python microservice tests
cd services/dxf-export
pytest tests/ -v --cov=src

# TypeScript tests
pnpm test:dxf-export

# Golden file tests
pytest tests/golden/ -v

# Update golden baselines (with review)
pytest tests/golden/ --update-golden
```

---

**Maintained by**: Nestor Development Team
**Contact**: Architecture Review Board
