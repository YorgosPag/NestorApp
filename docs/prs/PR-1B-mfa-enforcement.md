# PR-1B: MFA Enforcement for Admin Roles

**Status**: Ready for Testing
**Created**: 2026-01-29
**Author**: Claude (Anthropic AI)
**Priority**: BLOCKER #2 (Security Gate)

---

## Executive Summary

This PR enforces **mandatory MFA enrollment** for all admin/broker/builder roles. Users with these roles cannot access admin APIs without having two-factor authentication enabled.

### Key Changes

1. **MFA Policy Configuration**: Defined `MFA_REQUIRED_ROLES` constant
2. **Gate 5 Added**: New MFA check in `requireAdminContext()`
3. **AdminContext Extended**: Added `mfaEnrolled` field
4. **Audit Logging**: MFA denials logged for security monitoring

---

## Security Analysis

### MFA Requirement Matrix

| Role | MFA Required | Rationale |
|------|--------------|-----------|
| `admin` | ✅ YES | Full system access |
| `broker` | ✅ YES | Access to client data |
| `builder` | ✅ YES | Access to project data |
| Regular users | ❌ NO | Basic access only |

### Attack Vectors Mitigated

| Attack | Before PR-1B | After PR-1B |
|--------|--------------|-------------|
| **Credential stuffing** | Full admin access | Blocked at MFA |
| **Phishing** | Password = compromise | MFA required |
| **Session hijacking** | Token = access | Still needs MFA enrollment |

---

## Implementation Details

### 1. MFA Policy Configuration

**File**: `src/server/admin/admin-guards.ts`

```typescript
/**
 * 🔐 PR-1B: MFA ENFORCEMENT CONFIGURATION
 *
 * Roles that REQUIRE MFA enrollment for access.
 * Per Local_Protocol: mandatory MFA for broker/builder/admin.
 */
const MFA_REQUIRED_ROLES: AdminRole[] = ['admin', 'broker', 'builder'];

function roleRequiresMfa(role: AdminRole): boolean {
  return MFA_REQUIRED_ROLES.includes(role);
}
```

### 2. Gate 5: MFA Enforcement

Added after role verification in `requireAdminContext()`:

```typescript
// Gate 5: MFA Enforcement (PR-1B)
const mfaEnrolled = decodedToken.mfaEnrolled === true;

if (roleRequiresMfa(role) && !mfaEnrolled) {
  console.log(`🔐 [ADMIN_GUARDS] MFA DENIED: User ${email} (${role}) - MFA not enrolled`);

  return {
    success: false,
    error: `MFA enrollment required for ${role} role. Please enable two-factor authentication.`,
  };
}
```

### 3. AdminContext Extension

```typescript
export interface AdminContext {
  uid: string;
  email: string;
  role: AdminRole;
  operationId: string;
  environment: string;
  mfaEnrolled: boolean;  // NEW: Added for PR-1B
}
```

---

## Authentication Flow

```
┌────────────────────────────────────────────────────────────────────┐
│                    requireAdminContext()                            │
├────────────────────────────────────────────────────────────────────┤
│  Gate 1: Environment Check                                          │
│          └── Uses centralized security config                       │
│                                                                      │
│  Gate 2: Token Extraction                                           │
│          └── Bearer token from Authorization header                 │
│                                                                      │
│  Gate 3: Token Verification                                         │
│          └── Firebase Admin SDK verifyIdToken                       │
│                                                                      │
│  Gate 4: Admin Role Check                                           │
│          └── Must be admin/broker/builder                           │
│                                                                      │
│  Gate 5: MFA Enforcement (NEW - PR-1B)                              │
│          └── If role requires MFA → check mfaEnrolled claim         │
│          └── If not enrolled → DENY with clear error                │
│                                                                      │
│  ✅ SUCCESS: Return AdminContext with mfaEnrolled status            │
└────────────────────────────────────────────────────────────────────┘
```

---

## Existing MFA Infrastructure

The codebase already has comprehensive MFA infrastructure:

| Component | Location | Status |
|-----------|----------|--------|
| **EnterpriseTwoFactorService** | `src/services/two-factor/` | ✅ Complete |
| **TOTP Enrollment** | `EnterpriseTwoFactorService.ts` | ✅ Complete |
| **Backup Codes** | `EnterpriseTwoFactorService.ts` | ✅ Complete |
| **Enrollment UI** | `src/components/account/TwoFactorEnrollment.tsx` | ✅ Complete |
| **Custom Claims** | `mfaEnrolled` in Firebase | ✅ Complete |
| **AuthContext** | Includes `mfaEnrolled` | ✅ Complete |
| **Permission System** | MFA check in `hasPermission()` | ✅ Complete |

---

## User Experience

### For Existing Admins Without MFA

When an admin/broker/builder without MFA tries to access admin APIs:

1. **API Response**:
   ```json
   {
     "error": "MFA enrollment required for admin role. Please enable two-factor authentication."
   }
   ```

2. **Console Log** (for audit):
   ```
   🔐 [ADMIN_GUARDS] MFA DENIED: User admin@example.com (admin) - MFA not enrolled
   ```

3. **User Action Required**:
   - Navigate to Account Settings
   - Enable Two-Factor Authentication
   - Scan QR code with authenticator app
   - Save backup codes

### MFA Enrollment Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  1. User Profile Settings                                        │
│     └── Click "Enable 2FA"                                       │
│                                                                   │
│  2. QR Code Display                                              │
│     └── Scan with Google Authenticator / Authy                   │
│     └── Manual secret key option available                       │
│                                                                   │
│  3. Verification                                                  │
│     └── Enter 6-digit code from app                              │
│                                                                   │
│  4. Backup Codes                                                  │
│     └── Display 10 backup codes                                  │
│     └── Download / copy option                                   │
│                                                                   │
│  5. Custom Claims Update                                          │
│     └── mfaEnrolled: true                                        │
│     └── User can now access admin APIs                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Development Mode

In development environment without a token:

```typescript
// Development bypass assumes MFA enrolled
return {
  success: true,
  context: {
    uid: 'dev-admin',
    email: 'dev@localhost',
    role: 'admin',
    operationId,
    environment,
    mfaEnrolled: true,  // Dev bypass
  },
};
```

**Note**: This allows local development without MFA setup.

---

## Testing

### Manual Test Cases

1. **Admin without MFA**:
   - Expected: 403 with MFA required error
   - Verify audit log entry

2. **Admin with MFA enrolled**:
   - Expected: 200, access granted
   - Verify `mfaEnrolled: true` in context

3. **Broker without MFA**:
   - Expected: 403 with MFA required error

4. **Development mode**:
   - Expected: Access granted (bypass)

### Test Commands

```bash
# Run existing admin tests
pnpm test -- --grep "admin"

# Manual API test (without MFA)
curl -X GET http://localhost:3000/api/admin/buildings \
  -H "Authorization: Bearer <token_without_mfa>"
# Expected: 403 MFA required

# Manual API test (with MFA)
curl -X GET http://localhost:3000/api/admin/buildings \
  -H "Authorization: Bearer <token_with_mfa>"
# Expected: 200 success
```

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Existing admins locked out | High | Medium | Clear error message + enrollment UI |
| MFA enrollment issues | Low | High | Backup codes available |
| Development friction | Low | Low | Dev bypass in place |

---

## Rollback Plan

If issues found after merge:

1. Comment out Gate 5 in `requireAdminContext()`
2. Deploy updated `admin-guards.ts`
3. All admins regain access

```typescript
// Temporarily disable MFA enforcement
// Gate 5: MFA Enforcement (PR-1B) - DISABLED FOR ROLLBACK
// if (roleRequiresMfa(role) && !mfaEnrolled) { ... }
```

---

## Acceptance Criteria

- [x] **AC-1**: `MFA_REQUIRED_ROLES` constant defined
- [x] **AC-2**: `roleRequiresMfa()` helper function created
- [x] **AC-3**: Gate 5 added to `requireAdminContext()`
- [x] **AC-4**: `AdminContext` includes `mfaEnrolled` field
- [x] **AC-5**: MFA denial logged for audit
- [x] **AC-6**: Development bypass includes `mfaEnrolled: true`
- [ ] **AC-7**: Manual testing with/without MFA tokens

---

## Local_Protocol Compliance

- [x] No `any` types
- [x] No `as any`
- [x] No `@ts-ignore`
- [x] No inline styles
- [x] No duplicates (uses existing MFA infrastructure)
- [x] No hardcoded values (roles in constant array)

---

## Files Changed

| File | Change |
|------|--------|
| `src/server/admin/admin-guards.ts` | Added MFA enforcement (Gate 5) |
| `docs/prs/PR-1B-mfa-enforcement.md` | This documentation |

---

## Next Steps

After this PR is merged:

1. **PR-1C**: Rate Limiting
2. **Communicate to admins**: MFA enrollment required
3. **Monitor**: Watch for MFA denial logs

---

## Related Documentation

- **MFA Service**: `src/services/two-factor/EnterpriseTwoFactorService.ts`
- **MFA Component**: `src/components/account/TwoFactorEnrollment.tsx`
- **Permission System**: `src/lib/auth/permissions.ts`
- **Custom Claims**: `src/lib/auth/types.ts`

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-29 | Claude (Anthropic AI) | Initial PR documentation |
