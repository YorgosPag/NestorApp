# ADR-063: Company Isolation via Custom Claims

| Metadata | Value |
|----------|-------|
| **Category** | Security & Auth |
| **Status** | ✅ Active |
| **Date** | 2026-01-18 |
| **Decision Makers** | Enterprise Security Team |
| **Related** | ADR-060 (Building Storage), RFC v6 Authorization & RBAC |

## Context

The Enterprise File Storage System requires tenant isolation to ensure users can only access files belonging to their company. The storage rules use `belongsToCompany(companyId)` to enforce this.

This ADR documents the existing implementation of company isolation via Firebase Custom Claims.

## Decision

**Option A: Custom Claims** (IMPLEMENTED)

Company isolation is enforced through Firebase Custom Claims set on the user's ID token.

## Implementation Evidence

### 1. Custom Claims Structure

```typescript
// Set via adminAuth.setCustomUserClaims(uid, claims)
interface CustomClaims {
  companyId: string;      // Tenant anchor - REQUIRED
  globalRole: GlobalRole; // Role - REQUIRED
  mfaEnrolled: boolean;   // MFA status
}
```

**Source**: `src/lib/auth/auth-context.ts:139-166`

### 2. Admin API for Setting Claims

**Endpoint**: `POST /api/admin/set-user-claims`

**Security**:
- Permission: `users:users:manage`
- Roles: `super_admin`, `company_admin`
- Tenant Isolation: `company_admin` can ONLY manage users in their own company
- Super Admin Bypass: `super_admin` can manage users across all companies

**Source**: `src/app/api/admin/set-user-claims/route.ts`

```typescript
// Tenant isolation enforcement (line 140-154)
if (ctx.globalRole === 'company_admin' && companyId !== ctx.companyId) {
  return NextResponse.json({
    success: false,
    message: 'Forbidden',
    error: 'company_admin can only manage users within their own company'
  }, { status: 403 });
}

// Set claims (line 194-201)
const newClaims = {
  companyId,
  globalRole,
  mfaEnrolled: false,
};
await adminAuth.setCustomUserClaims(uid, newClaims);
```

### 3. Token Refresh

When custom claims are updated:
1. User must **re-authenticate** or **force token refresh**
2. Client calls `user.getIdToken(true)` to get new token
3. New token contains updated claims

**UI Implementation**: `src/app/account/security/page.tsx` provides "Refresh Permissions" button.

### 4. Auth Context Extraction

**Source**: `src/lib/auth/auth-context.ts:194-224`

```typescript
export async function buildRequestContext(request: NextRequest): Promise<RequestContext> {
  const token = extractBearerToken(request);
  const decodedToken = await verifyIdToken(token);
  const claims = extractCustomClaims(decodedToken);

  return {
    uid: decodedToken.uid,
    email: decodedToken.email || '',
    companyId: claims.companyId,    // Used for tenant isolation
    globalRole: claims.globalRole,
    mfaEnrolled: claims.mfaEnrolled ?? false,
    isAuthenticated: true,
  };
}
```

### 5. Storage Rules Integration

**Source**: `storage.rules:46-54`

```javascript
// Get user's companyId from custom claims
function getUserCompanyId() {
  return request.auth.token.companyId;
}

// Check if user belongs to the specified company
function belongsToCompany(companyId) {
  return isAuthenticated() && getUserCompanyId() == companyId;
}
```

### 6. Audit Trail

All claims updates are logged to Firestore:
- Collection: `/companies/{companyId}/audit_logs`
- Function: `logClaimsUpdated(ctx, uid, previousClaims, newClaims, reason)`
- Source: `src/lib/auth/audit.ts`

### 7. Onboarding Flow

New users without claims:
1. User registers via Firebase Auth
2. Admin invites user via `/api/admin/set-user-claims`
3. User refreshes token to receive claims
4. User can now access company resources

## Consequences

### Positive
- Claims are cryptographically signed in Firebase ID token
- No additional database reads for authorization
- Fast validation at Storage Rules level
- Audit trail for all claims changes

### Negative
- Requires token refresh after claims update
- Admin must manually set claims for new users
- Claims max size: 1000 bytes

### Risks Mitigated
- **Cross-tenant access**: Prevented by `belongsToCompany()` check
- **Privilege escalation**: `company_admin` cannot modify other companies
- **Unauthorized claims modification**: Admin-only API with RBAC

## References

- Firebase Custom Claims: https://firebase.google.com/docs/auth/admin/custom-claims
- RFC v6: Authorization & RBAC System
- `src/app/api/admin/set-user-claims/route.ts`
- `src/lib/auth/auth-context.ts`
- `storage.rules`
