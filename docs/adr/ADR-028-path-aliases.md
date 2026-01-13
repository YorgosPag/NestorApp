# ADR-028: Path Aliases Strategy

**Status**: Accepted
**Date**: 2026-01-13
**Deciders**: Enterprise Architecture Team

## Context

The codebase uses TypeScript path aliases for cleaner imports. Without a centralized strategy, aliases proliferate in various tsconfig files leading to:
- Duplication and conflicts
- Inconsistent naming conventions
- Module resolution issues across different build contexts

## Decision

### Canonical Source of Truth

All path aliases MUST be defined in `tsconfig.base.json` (root level).

### Allowed Prefixes

| Prefix | Domain | Usage |
|--------|--------|-------|
| `@/*` | App source | Main application code in `src/` |
| `@/systems/*` | DXF Systems | DXF viewer systems (legacy compatibility) |
| `@geo-alert/core` | Core Package | Shared core library |
| `@geo-alert/core/*` | Core Package | Submodules of core |
| `@core/polygon-system` | Core Subsystem | Polygon system package |
| `@core/polygon-system/*` | Core Subsystem | Polygon system submodules |
| `@core/alert-engine` | Core Subsystem | Alert engine package |
| `@core/alert-engine/*` | Core Subsystem | Alert engine submodules |

### Rules

1. **No ad-hoc aliases**: New aliases require ADR update and review
2. **Central definition only**: Sub-project tsconfigs MUST NOT define `compilerOptions.paths`
3. **Extends required**: All sub-project tsconfigs MUST extend from root or base
4. **Package exception**: `packages/*/tsconfig.json` may define package-internal aliases for standalone builds

### Adding New Aliases

Before adding a new alias:
1. Verify it doesn't duplicate existing functionality
2. Determine the appropriate prefix based on domain
3. Update `tsconfig.base.json`
4. Update this ADR with the new prefix

### Verification

Run this command to check for duplicate paths definitions:
```bash
grep -r "\"paths\"" --include="tsconfig*.json" | grep -v node_modules
```

Expected result: Only `tsconfig.base.json` and `packages/core/tsconfig.json` should define paths.

## Consequences

### Positive
- Single source of truth for all aliases
- Consistent module resolution across IDE, build, and test
- Clear governance for new aliases

### Negative
- Requires coordination for new alias additions
- Package builds may need extra configuration

## References

- `tsconfig.base.json` - Canonical alias definitions
- `config/quality-gates/ts-error-budget.json` - Related governance config
