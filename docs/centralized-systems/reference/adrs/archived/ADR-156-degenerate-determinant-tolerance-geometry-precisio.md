# ADR-156: Degenerate Determinant Tolerance (GEOMETRY_PRECISION.DENOMINATOR_ZERO)

| Metadata | Value |
|----------|-------|
| **Status** | IMPLEMENTED |
| **Date** | 2026-02-01 |
| **Category** | Data & State |
| **Canonical Location** | `config/tolerance-config.ts` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Status**: ✅ IMPLEMENTED
- **Date**: 2026-02-01
- **Problem**: Hardcoded `1e-10` for determinant zero-check in `circleBestFit()` function
- **Decision**: Replace with existing centralized constant `GEOMETRY_PRECISION.DENOMINATOR_ZERO`
- **Canonical Location**: `config/tolerance-config.ts` → `GEOMETRY_PRECISION.DENOMINATOR_ZERO`
- **File Updated**:
  - `rendering/entities/shared/geometry-utils.ts` - Line 289 (degenerate case check in circleBestFit)
- **Context**: The determinant is the denominator of the linear system solution; same tolerance applies
- **Pattern**: No new constant created - reused existing centralized tolerance
- **Mathematical Use Case**: Detecting collinear points in Kasa circle fit algorithm
- **Companion ADRs**: ADR-079 (Geometric Epsilon/Precision)
