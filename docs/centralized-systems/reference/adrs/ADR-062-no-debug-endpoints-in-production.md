# ADR-062: No Debug/Admin Analysis Endpoints in Production

| Metadata | Value |
|----------|-------|
| **Category** | Security |
| **Status** | ✅ Active |
| **Date** | 2026-01-17 |
| **Owners** | Security / Platform |

## Related
  - AUTHZ Phase 2 (Role-Based Access Control)
  - SECURITY_AUDIT_REPORT.md
  - Fortune 500 Security Standards

## Context

During AUTHZ Phase 2 migration, a security audit identified **4 unprotected debug/analysis endpoints** that exposed sensitive business data:

1. `/api/debug/projects-analysis` - Exposed ALL projects, companies, orphan projects, business structure
2. `/api/debug/buildings-floors-analysis` - Exposed ALL buildings, floors, orphan floors
3. `/api/debug/buildings-floors-admin` - **CRITICAL** - Used Admin SDK with elevated Firestore permissions
4. `/api/analyze-companies` - Exposed ALL companies, VAT numbers, duplicates, business intelligence

**Risk Assessment:**
- **HIGH** - Total data exposure (projects, buildings, companies, VAT)
- **CRITICAL** - Admin SDK endpoint bypassed Firestore security rules
- **Zero authentication** - Public HTTP endpoints accessible to anyone
- **Business intelligence leakage** - Company relationships, project structure, orphan detection

**Fortune 500 Standard:**
Debug and analysis endpoints **MUST NOT** exist in production environments. They represent:
- Attack surface expansion
- Data breach vectors
- Compliance violations (GDPR, SOC 2)
- Audit trail gaps

## Decision

We establish the following **non-negotiable security policy**:

### 1. **NO Debug/Admin Endpoints in Production**
- Debug, analysis, and admin utility endpoints **SHALL NOT** be deployed as HTTP routes
- Production builds **MUST** exclude all debug endpoint directories
- Any endpoint with names containing `debug`, `analysis`, `admin-util`, or similar **SHALL** be rejected at code review

### 2. **Offline Tooling for Ops/Debug**
- Operational debugging and data analysis **SHALL** be performed via:
  - **Offline scripts** in `scripts/` directory (e.g., `analyze-buildings.js`, `check-all-buildings.js`)
  - **Firebase Admin SDK** scripts executed locally with explicit operator authorization
  - **CI/CD pipeline tools** (GitHub Actions, Vercel CLI) with proper authentication
- **NO HTTP exposure** for debug operations

### 3. **Admin Operations via Protected Endpoints**
- Administrative operations that MUST be HTTP-accessible **SHALL**:
  - Use `withAuth` middleware with permission checks (e.g., `admin:migrations:execute`)
  - Require `super_admin` role for critical operations
  - Include audit logging (`logMigrationExecuted`, `logDataFix`, etc.)
  - Follow **least privilege** principle

### 4. **Code Review Requirements**
- All new endpoints **MUST** pass security review:
  - Authentication/authorization checks present
  - No public data exposure without business justification
  - Audit logging for sensitive operations
  - Rate limiting considerations

## Rationale

### Security Benefits
- **Zero attack surface** for debug utilities
- **Defense in depth** - No accidental exposure of debug endpoints
- **Compliance** - Meets Fortune 500, SOC 2, ISO 27001 standards
- **Audit trail** - All admin operations logged and traceable

### Operational Benefits
- **Explicit authorization** - Offline scripts require conscious operator execution
- **Version control** - Debug scripts tracked in git, not hidden in HTTP routes
- **Testing** - Offline scripts easier to test and maintain
- **Documentation** - Scripts self-document their purpose

### Development Benefits
- **Clear separation** - Production endpoints vs. debug utilities
- **No accidental deployment** - Scripts directory not deployed to Vercel
- **Faster iteration** - Debug scripts don't require HTTP API design

## Consequences

### Positive
- ✅ **Eliminated 4 attack vectors** - All debug endpoints return 404
- ✅ **Reduced data exposure** - No public access to business intelligence
- ✅ **Improved compliance** - Meets enterprise security standards
- ✅ **Better audit trail** - Offline scripts leave clear execution logs
- ✅ **Developer clarity** - Obvious separation between production and debug code

### Negative
- ❌ **No browser-based debugging** - Operators must use terminal/scripts
- ❌ **Extra setup** - New developers need Firebase Admin SDK credentials
- ⚠️ **Learning curve** - Team must adopt offline script patterns

### Mitigation
- **Documentation** - Maintain `scripts/README.md` with usage examples
- **Training** - Onboard team on Firebase Admin SDK and offline tooling
- **Templates** - Provide script templates for common operations

## Implementation

### Actions Taken (2026-01-17)
1. ✅ **Deleted 4 debug endpoints:**
   - `src/app/api/debug/projects-analysis/route.ts` (144 lines)
   - `src/app/api/debug/buildings-floors-analysis/route.ts` (121 lines)
   - `src/app/api/debug/buildings-floors-admin/route.ts` (192 lines)
   - `src/app/api/analyze-companies/route.ts` (118 lines)
   - **Total: 576 lines removed**

2. ✅ **Verification:**
   - Grep: 0 references in UI/hooks/docs
   - Lint: Exit code 0 (passed)
   - Typecheck: No errors from deleted endpoints
   - Build: Running (verified no import errors)

3. ✅ **Documentation:**
   - Removed reference from `HARDCODED_VALUES_AUDIT_REPORT.md`
   - Created this ADR (ADR-062)

4. ✅ **Git:**
   - Commit: `chore(security): remove public debug analysis endpoints`
   - Pushed to: `crm/communications-ui` branch

### Existing Offline Scripts
The following scripts already provide equivalent functionality:
- `scripts/analyze-buildings.js` - Building structure analysis
- `scripts/check-all-buildings.js` - Building verification
- `scripts/claims.setCompanyId.js` - User claim operations (canonical)
- `scripts/migrations.buildings.backfillCompanyId.js` - Buildings data migration (canonical)
- `scripts/migrate-storages-to-collection.js` - Data migrations

### Future Enforcement
- **Code review checklist:** Verify no new debug endpoints in `/api/debug/`, `/api/analyze-*`, `/api/admin-util/`
- **CI/CD gate:** Add linting rule to reject debug endpoint patterns in production builds
- **Security audits:** Quarterly review of `/api/*` endpoints for compliance

## References

- [AUTHZ Phase 2 RFC](../rfc/authorization-rbac.md)
- [SECURITY_AUDIT_REPORT.md](../../SECURITY_AUDIT_REPORT.md)
- [Fortune 500 Security Standards](https://www.cisecurity.org/controls)
- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)

---

**Policy Effective:** 2026-01-17
**Review Cycle:** Quarterly (Q1 2026, Q2 2026, ...)
**Owner:** Security Team / Platform Engineering
