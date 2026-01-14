# RFC: Authorization & RBAC System

**Status**: Draft v6 - ENTERPRISE READY (All P0 Security + Deploy Fixes Applied)
**Author**: Enterprise Team
**Date**: 2026-01-14
**Scope**: Role-Based Access Control with Relationship-Based Extensions

---

## 1. Overview

This RFC defines the authorization system for the Nestor application, implementing enterprise-grade Role-Based Access Control (RBAC) with relationship-based extensions for delegation.

### Key Principles

- **Authentication ≠ Authorization**: Google Sign-in identifies WHO the user is; this system defines WHAT they can do/see
- **Multi-tenant**: Every user belongs to a `companyId` (tenant anchor)
- **Relationship-based access**: Beyond roles, access is determined by relationships (ownership, delegation, project membership)
- **Defense in depth**: Enforcement at 3 layers (Firestore Rules, API Middleware, UI)
- **Zero hardcoded values**: All configuration via environment/secrets
- **Zero `any` types**: Strong typing for all data structures

### Access Control Layers

| Layer | Scope | Purpose |
|-------|-------|---------|
| A - Global Roles | Company-wide | Admin/tenant management |
| B - Project Membership | Per project | Collaboration within projects |
| C - Unit Ownership & Grants | Per unit | Customer/legal delegation |
| D - Public | Internet | Sanitized public listings |

---

## 2. Data Classification

All data MUST be classified before defining access rules:

| Class | Examples | Default Access |
|-------|----------|----------------|
| **Public** | Site listings, marketing | Anyone |
| **Internal** | Project execution, CRM notes | Company internal |
| **Confidential** | Financial, invoices, costing | Restricted + MFA |
| **Legal** | Contracts, personal data | Restricted + MFA + Audit |

---

## 3. Firestore Data Model

### 3.1 Collections Schema

```
/companies/{companyId}
  - name: string
  - createdAt: Timestamp
  - settings: CompanySettings

/users/{uid}
  - email: string
  - displayName: string
  - companyId: string (tenant anchor - REQUIRED)
  - globalRole: GlobalRole
  - contactId?: string (link to CRM contact if applicable)
  - status: 'active' | 'suspended' | 'pending_invitation'
  - createdAt: Timestamp
  - updatedAt: Timestamp
  - lastLoginAt?: Timestamp

/contacts/{contactId}
  - companyId: string (REQUIRED)
  - type: 'individual' | 'company' | 'service'
  - displayName: string
  - ... (CRM fields)

/roles/{roleId}
  - name: string
  - description: string
  - permissions: PermissionId[]
  - level: number (hierarchy, lower = more access)
  - isProjectRole: boolean
  - createdAt: Timestamp

/permissionSets/{setId}
  - name: string
  - permissions: PermissionId[]
  - description: string

/projects/{projectId}
  - companyId: string (REQUIRED)
  - name: string
  - status: 'active' | 'archived' | 'completed'
  - createdAt: Timestamp

/projects/{projectId}/members/{uid}
  - companyId: string (DUPLICATED for rules efficiency)
  - projectId: string (DUPLICATED for rules efficiency)
  - roleId: string
  - permissionSetIds: string[]
  - effectivePermissions: string[] (PRECOMPUTED - updated by backend on role/set change)
  - addedAt: Timestamp
  - addedBy: string

/buildings/{buildingId}
  - projectId: string (REQUIRED)
  - companyId: string (REQUIRED)
  - name: string
  - ...

/units/{unitId}
  - projectId: string (REQUIRED)
  - buildingId: string (REQUIRED)
  - companyId: string (REQUIRED)
  - status: UnitStatus
  - ...

/units/{unitId}/owners/{uid}
  - companyId: string (DUPLICATED for rules efficiency)
  - projectId: string (DUPLICATED for rules efficiency)
  - unitId: string (DUPLICATED for rules efficiency)
  - addedAt: Timestamp
  - addedBy: string
  - notes?: string

/units/{unitId}/grants/{granteeUid}  (DOC ID = granteeUid for efficient lookup)
  - companyId: string (DUPLICATED for rules efficiency)
  - projectId: string (DUPLICATED for rules efficiency)
  - unitId: string (DUPLICATED for rules efficiency)
  - scopes: GrantScope[]
  - expiresAt: Timestamp (REQUIRED)
  - createdAt: Timestamp
  - createdBy: string
  - reason: string (audit)
  - revokedAt?: Timestamp
  - revokedBy?: string

/publicListings/{listingId}
  - sourceUnitId: string
  - projectId: string
  - publishedAt: Timestamp
  - publishedBy: string
  - title: string
  - description: string
  - price?: number
  - images: string[]
  - status: 'active' | 'sold' | 'reserved'
  (NO sensitive data: owner info, contracts, financials)

// P0-4 FIX: Tenant-scoped conversations (prevents cross-tenant data leak)
/companies/{companyId}/conversations/{conversationId}
  - projectId?: string (optional, for project-specific conversations)
  - channel: CommunicationChannel
  - status: 'active' | 'closed' | 'archived'
  - participants: string[]
  - createdAt: Timestamp
  - updatedAt: Timestamp
  - lastMessageAt?: Timestamp

/companies/{companyId}/conversations/{conversationId}/messages/{messageId}
  - direction: 'inbound' | 'outbound'
  - content: { text?: string, attachments?: string[] }
  - senderName: string
  - deliveryStatus: 'sent' | 'delivered' | 'failed'
  - createdAt: Timestamp

// P0-2 FIX: Add companyId for tenant isolation
/audit_logs/{logId}
  - companyId: string (REQUIRED - tenant isolation)
  - action: AuditAction
  - actorId: string
  - targetId: string
  - targetType: AuditTargetType
  - previousValue: AuditChangeValue | null
  - newValue: AuditChangeValue | null
  - timestamp: Timestamp
  - metadata: AuditMetadata
```

### 3.2 TypeScript Types (Zero `any`)

```typescript
// src/lib/auth/types.ts

// Global roles (coarse-grained, in claims)
export type GlobalRole =
  | 'super_admin'     // Break-glass, system-wide
  | 'company_admin'   // Company management
  | 'internal_user'   // Internal staff
  | 'external_user';  // Customers, partners

// Project roles (fine-grained)
export type ProjectRole =
  | 'project_manager'
  | 'architect'
  | 'engineer'
  | 'site_manager'
  | 'accountant'
  | 'sales_agent'
  | 'data_entry'
  | 'viewer'
  | 'vendor';         // External suppliers

// Permission Registry (TYPED - no free strings allowed)
export const PERMISSIONS = {
  // Communications
  'comm:conversations:list': true,
  'comm:conversations:view': true,
  'comm:conversations:update': true,
  'comm:messages:view': true,
  'comm:messages:send': true,

  // Projects
  'projects:projects:view': true,
  'projects:projects:create': true,
  'projects:projects:update': true,
  'projects:projects:delete': true,
  'projects:members:view': true,
  'projects:members:manage': true,
  'projects:floors:view': true,

  // Units
  'units:units:view': true,
  'units:units:update': true,

  // DXF
  'dxf:files:view': true,
  'dxf:files:upload': true,
  'dxf:layers:view': true,
  'dxf:layers:manage': true,
  'dxf:annotations:edit': true,

  // CRM
  'crm:contacts:view': true,
  'crm:contacts:create': true,
  'crm:contacts:update': true,
  'crm:contacts:export': true,

  // Finance
  'finance:invoices:view': true,
  'finance:invoices:update': true,
  'finance:invoices:approve': true,

  // Legal
  'legal:documents:view': true,
  'legal:ownership:view': true,
  'legal:ownership:manage': true,
  'legal:grants:view': true,
  'legal:grants:create': true,
  'legal:grants:revoke': true,
  'legal:contracts:view': true,

  // Listings
  'listings:listings:publish': true,

  // Users & Settings
  'users:users:view': true,
  'users:users:manage': true,
  'settings:settings:view': true,
  'settings:settings:manage': true,

  // Reports
  'reports:reports:view': true,
  'reports:reports:create': true,

  // Photos & Progress
  'photos:photos:upload': true,
  'progress:progress:update': true,

  // Orders (for vendors)
  'orders:orders:view': true,
  'deliveries:deliveries:view': true,
  'specs:specs:view': true,
} as const;

// Permission ID derived from registry (compile-time safety)
export type PermissionId = keyof typeof PERMISSIONS;

// Grant Scopes Registry (TYPED - for delegation)
export const GRANT_SCOPES = {
  'unit:read_basic': true,
  'unit:docs:view_basic': true,
  'unit:dxf:view': true,
  'unit:status:view': true,
  'unit:messages:view': true,
  'legal:documents:view': true,
  'legal:contracts:view': true,
} as const;

export type GrantScope = keyof typeof GRANT_SCOPES;

// Audit Actions Registry (TYPED)
export const AUDIT_ACTIONS = {
  'role_changed': true,
  'permission_granted': true,
  'permission_revoked': true,
  'grant_created': true,
  'grant_revoked': true,
  'access_denied': true,
  'claims_updated': true,
  'ownership_changed': true,
  'system_bootstrap': true,
} as const;

export type AuditAction = keyof typeof AUDIT_ACTIONS;

// Audit Target Types Registry (TYPED)
export const AUDIT_TARGET_TYPES = {
  'user': true,
  'project': true,
  'unit': true,
  'role': true,
  'grant': true,
  'api': true,
} as const;

export type AuditTargetType = keyof typeof AUDIT_TARGET_TYPES;

// Typed audit change value (NO any!)
export interface AuditChangeValue {
  type: 'role' | 'permission' | 'grant' | 'status' | 'membership';
  value: string | string[] | Record<string, unknown>;
}

export interface AuditMetadata {
  ipAddress?: string;
  userAgent?: string;
  path?: string;
  reason?: string;
}
```

### 3.3 Predefined Roles

```typescript
// src/lib/auth/roles.ts
// P0-1 FIX: NO WILDCARDS - only valid PermissionId from registry

import type { PermissionId } from './types';

interface RoleDefinition {
  name: string;
  permissions: PermissionId[];  // MUST be from PERMISSIONS registry
  level: number;
  isProjectRole: boolean;
  isBypass?: boolean;  // For super_admin only
}

export const PREDEFINED_ROLES: Record<string, RoleDefinition> = {
  // ============================================================
  // GLOBAL ROLES (bypass or explicit permissions)
  // ============================================================

  super_admin: {
    name: 'Υπερ-Διαχειριστής',
    permissions: [],  // P0-1 FIX: NO permissions list - bypass in API/rules
    level: 0,
    isProjectRole: false,
    isBypass: true    // Handled in hasPermission() as early return
  },

  company_admin: {
    name: 'Διαχειριστής Εταιρείας',
    // P0-1 FIX: Explicit PermissionId[] - no wildcards
    permissions: [
      'users:users:view',
      'users:users:manage',
      'projects:projects:view',
      'projects:projects:create',
      'projects:projects:update',
      'projects:projects:delete',
      'projects:members:view',
      'projects:members:manage',
      'settings:settings:view',
      'settings:settings:manage',
    ],
    level: 1,
    isProjectRole: false
  },

  // ============================================================
  // PROJECT ROLES (explicit permissions only)
  // ============================================================

  project_manager: {
    name: 'Υπεύθυνος Έργου',
    permissions: [
      'projects:projects:view',
      'projects:projects:update',
      'projects:members:view',
      'projects:members:manage',
      'projects:floors:view',
      'units:units:view',
      'units:units:update',
      'dxf:files:view',
      'dxf:files:upload',
      'dxf:layers:view',
      'reports:reports:view',
      'reports:reports:create',
      'photos:photos:upload',
      'progress:progress:update',
    ],
    level: 2,
    isProjectRole: true
  },

  architect: {
    name: 'Αρχιτέκτονας',
    permissions: [
      'dxf:files:view',
      'dxf:layers:view',
      'projects:floors:view',
      'units:units:view',
    ],
    level: 3,
    isProjectRole: true
  },

  site_manager: {
    name: 'Εργοταξιάρχης',
    permissions: [
      'photos:photos:upload',
      'progress:progress:update',
      'reports:reports:view',
      'reports:reports:create',
      'units:units:view',
    ],
    level: 4,
    isProjectRole: true
  },

  accountant: {
    name: 'Λογιστής',
    permissions: [
      'finance:invoices:view',
      'finance:invoices:update',
      'reports:reports:view',
    ],
    level: 4,
    isProjectRole: true
  },

  sales_agent: {
    name: 'Πωλητής',
    permissions: [
      'crm:contacts:view',
      'crm:contacts:create',
      'crm:contacts:update',
      'units:units:view',
      'comm:conversations:list',
      'comm:conversations:view',
      'comm:messages:view',
      'comm:messages:send',
    ],
    level: 4,
    isProjectRole: true
  },

  vendor: {
    name: 'Προμηθευτής',
    permissions: [
      'orders:orders:view',
      'deliveries:deliveries:view',
      'specs:specs:view',
    ],
    level: 5,
    isProjectRole: true
  },

  viewer: {
    name: 'Θεατής',
    // P0-1 FIX: Explicit view permissions - no '*:view' wildcard
    permissions: [
      'projects:projects:view',
      'projects:floors:view',
      'units:units:view',
      'dxf:files:view',
      'dxf:layers:view',
      'reports:reports:view',
    ],
    level: 6,
    isProjectRole: true
  }
};
```

### 3.4 Permission Sets (Add-ons)

```typescript
// src/lib/auth/permission-sets.ts
// P0-C FIX: Strict typing + MFA flag naming consistency

import type { PermissionId } from './types';

// P0-C FIX: Typed interface
interface PermissionSetDefinition {
  name: string;
  permissions: PermissionId[];  // MUST be from PERMISSIONS registry
  requiresMfaEnrolled?: boolean;  // P0-C FIX: Consistent with claims naming
}

export const PERMISSION_SETS: Record<string, PermissionSetDefinition> = {
  dxf_editor: {
    name: 'DXF Editor',
    permissions: ['dxf:files:view', 'dxf:files:upload', 'dxf:layers:manage', 'dxf:annotations:edit']
  },
  dxf_uploader: {
    name: 'DXF Upload Only',
    permissions: ['dxf:files:upload']
  },
  finance_approver: {
    name: 'Finance Approver',
    permissions: ['finance:invoices:view', 'finance:invoices:approve'],
    requiresMfaEnrolled: true  // P0-C FIX: Renamed from requiresMfa
  },
  legal_viewer: {
    name: 'Legal Viewer',
    permissions: ['legal:documents:view'],
    requiresMfaEnrolled: true  // P0-C FIX: Renamed from requiresMfa
  },
  crm_exporter: {
    name: 'CRM Export',
    permissions: ['crm:contacts:export']
  },
  comm_staff: {
    name: 'Communications Staff',
    permissions: ['comm:conversations:list', 'comm:conversations:view', 'comm:messages:send']
  }
};
```

---

## 4. Custom Claims Contract

Firebase Auth Custom Claims for **coarse-grained** authorization (fast, no Firestore reads).

### 4.1 Claims Structure

```typescript
interface CustomClaims {
  // Required
  companyId: string;        // Tenant isolation
  globalRole: GlobalRole;   // Coarse access level

  // Optional
  mfaEnrolled?: boolean;    // P0 FIX: "enrolled" NOT "verified this session"
  emailVerified?: boolean;  // Email verification status
}

/**
 * P0 IMPORTANT: MFA Semantics
 *
 * mfaEnrolled = user HAS enrolled MFA (TOTP/SMS/etc)
 * This does NOT mean "verified this session"
 *
 * For MFA-required actions (finance, legal):
 * 1. Check mfaEnrolled claim exists
 * 2. Trigger re-auth / MFA flow via Firebase Auth re-authentication
 * 3. Server verifies fresh token from re-auth
 *
 * DO NOT rely on boolean claim for "currently verified" - use token freshness
 */
```

### 4.2 Setting Claims (Admin SDK - Server Only)

```typescript
// src/lib/auth/claims.ts

import { getAuth } from 'firebase-admin/auth';

export async function setUserClaims(
  uid: string,
  claims: CustomClaims,
  actorId: string
): Promise<void> {
  // Validate claims before setting
  if (!claims.companyId || !claims.globalRole) {
    throw new Error('Invalid claims: companyId and globalRole required');
  }

  await getAuth().setCustomUserClaims(uid, claims);

  // Audit log
  await logAuditEvent({
    action: 'claims_updated',
    actorId,
    targetId: uid,
    targetType: 'user',
    newValue: { type: 'role', value: claims }
  });
}
```

### 4.3 Token Refresh

After updating claims, user must refresh token:
- Sign out + sign in, OR
- `user.getIdToken(true)` force refresh

---

## 5. Firestore Security Rules

### 5.1 Helper Functions (Fail-Safe)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ============================================================
    // HELPER FUNCTIONS (FAIL-SAFE)
    // ============================================================

    function isAuthenticated() {
      return request.auth != null;
    }

    function getUserCompanyId() {
      return request.auth.token.companyId;
    }

    function getGlobalRole() {
      return request.auth.token.globalRole;
    }

    function isSuperAdmin() {
      return isAuthenticated() && getGlobalRole() == 'super_admin';
    }

    // P0-B FIX: TENANT-BOUND helpers (prevent cross-tenant escalation)
    // These ensure company_admin/internal_user can only operate within their tenant

    function isSuperAdminOnly() {
      return isAuthenticated() && getGlobalRole() == 'super_admin';
    }

    // DEPRECATED: Use isCompanyAdminOfCompany(companyId) for tenant data
    function isCompanyAdmin() {
      return isAuthenticated() && getGlobalRole() in ['super_admin', 'company_admin'];
    }

    // DEPRECATED: Use isInternalUserOfCompany(companyId) for tenant data
    function isInternalUser() {
      return isAuthenticated() && getGlobalRole() in ['super_admin', 'company_admin', 'internal_user'];
    }

    function belongsToCompany(companyId) {
      return isAuthenticated() && getUserCompanyId() == companyId;
    }

    // P0-B FIX: Tenant-bound company admin (prevents cross-tenant writes)
    function isCompanyAdminOfCompany(companyId) {
      return isSuperAdminOnly() ||
             (getGlobalRole() == 'company_admin' && belongsToCompany(companyId));
    }

    // P0-B FIX: Tenant-bound internal user (prevents cross-tenant reads)
    function isInternalUserOfCompany(companyId) {
      return isSuperAdminOnly() ||
             (getGlobalRole() in ['company_admin', 'internal_user'] && belongsToCompany(companyId));
    }

    // FAIL-SAFE: Check exists() before get()
    function isProjectMember(projectId) {
      return isAuthenticated() &&
        exists(/databases/$(database)/documents/projects/$(projectId)/members/$(request.auth.uid));
    }

    // FAIL-SAFE: Only call after confirming member exists
    function getProjectMembership(projectId) {
      return get(/databases/$(database)/documents/projects/$(projectId)/members/$(request.auth.uid)).data;
    }

    // P0 FIX: Use precomputed effectivePermissions (no wildcards in rules)
    // effectivePermissions is updated by backend when role/permissionSets change
    // SYNTAX FIX: Boolean expression (no if blocks in Firestore rules)
    function hasProjectPermission(projectId, permission) {
      let memberDoc = /databases/$(database)/documents/projects/$(projectId)/members/$(request.auth.uid);
      return isAuthenticated()
        && exists(memberDoc)
        && (permission in get(memberDoc).data.effectivePermissions);
    }

    // Unit ownership check
    function isUnitOwner(unitId) {
      return isAuthenticated() &&
        exists(/databases/$(database)/documents/units/$(unitId)/owners/$(request.auth.uid));
    }

    // Unit grant check with scope (P0 FIX: doc ID = granteeUid)
    function hasUnitGrant(unitId, scope) {
      let grantDoc = /databases/$(database)/documents/units/$(unitId)/grants/$(request.auth.uid);
      return isAuthenticated()
        && exists(grantDoc)
        && scope in get(grantDoc).data.scopes
        && get(grantDoc).data.expiresAt > request.time
        && get(grantDoc).data.revokedAt == null;
    }
```

### 5.2 Collection Rules

```javascript
    // ============================================================
    // COMPANIES
    // SYNTAX FIX: Use isCompanyAdminOfCompany for super_admin system-wide access
    // ============================================================
    match /companies/{companyId} {
      allow read: if belongsToCompany(companyId) || isSuperAdminOnly();
      allow write: if isCompanyAdminOfCompany(companyId);
    }

    // ============================================================
    // ROLES (P0-6 FIX: Locked down - read internal, write super_admin only)
    // ============================================================
    match /roles/{roleId} {
      allow read: if isInternalUser();
      allow write: if isSuperAdmin();  // Or use: if false; for server-only
    }

    // ============================================================
    // PERMISSION SETS (P0-6 FIX: Same as roles)
    // ============================================================
    match /permissionSets/{setId} {
      allow read: if isInternalUser();
      allow write: if isSuperAdmin();  // Or use: if false; for server-only
    }

    // ============================================================
    // USERS
    // P0-A FIX: Split create/update/delete (resource.data doesn't exist on create)
    // P0-B FIX: Use tenant-bound helpers
    // ============================================================
    match /users/{uid} {
      // Self read always
      allow read: if isAuthenticated() && request.auth.uid == uid;
      // Company internal can read colleagues (tenant-bound)
      allow read: if isInternalUserOfCompany(resource.data.companyId);

      // Self update limited fields
      allow update: if isAuthenticated() && request.auth.uid == uid &&
        request.resource.data.diff(resource.data).affectedKeys()
          .hasOnly(['displayName', 'photoURL', 'preferences']);

      // P0-A FIX: Separate create (uses request.resource.data)
      allow create: if isCompanyAdminOfCompany(request.resource.data.companyId);

      // P0-A FIX: Separate update/delete (uses resource.data)
      allow update: if isCompanyAdminOfCompany(resource.data.companyId);
      allow delete: if isCompanyAdminOfCompany(resource.data.companyId);
    }

    // ============================================================
    // PROJECTS
    // P0-A/B FIX: Tenant-bound + split create/update
    // ============================================================
    match /projects/{projectId} {
      allow read: if belongsToCompany(resource.data.companyId) || isProjectMember(projectId);

      // P0-A FIX: create uses request.resource.data
      allow create: if isCompanyAdminOfCompany(request.resource.data.companyId);

      // P0-B FIX: update requires tenant match
      allow update: if (isProjectMember(projectId) && hasProjectPermission(projectId, 'projects:projects:update')) ||
                       isCompanyAdminOfCompany(resource.data.companyId);

      // P0-A FIX: delete uses resource.data
      allow delete: if isCompanyAdminOfCompany(resource.data.companyId);

      // Members subcollection
      // P0-B FIX: Prevent cross-tenant membership injection
      match /members/{memberId} {
        // Read: project member or company admin of project's company
        allow read: if isProjectMember(projectId) ||
                       isCompanyAdminOfCompany(get(/databases/$(database)/documents/projects/$(projectId)).data.companyId);

        // P0-B FIX: Write requires membership to be in same company as project
        // One parent get() allowed here (admin action, not hot-path)
        allow create: if (hasProjectPermission(projectId, 'projects:members:manage') ||
                          isCompanyAdminOfCompany(get(/databases/$(database)/documents/projects/$(projectId)).data.companyId)) &&
                         request.resource.data.companyId == get(/databases/$(database)/documents/projects/$(projectId)).data.companyId;

        allow update, delete: if hasProjectPermission(projectId, 'projects:members:manage') ||
                                 isCompanyAdminOfCompany(resource.data.companyId);
      }
    }

    // ============================================================
    // UNITS
    // P0-A/B FIX: Tenant-bound + split create/update
    // ============================================================
    match /units/{unitId} {
      // Read: internal of same company + project member, or owner, or grantee
      allow read: if (isInternalUserOfCompany(resource.data.companyId) &&
                      isProjectMember(resource.data.projectId)) ||
                     isUnitOwner(unitId) ||
                     hasUnitGrant(unitId, 'unit:read_basic');

      // P0-A FIX: create uses request.resource.data
      allow create: if isInternalUserOfCompany(request.resource.data.companyId) &&
                       hasProjectPermission(request.resource.data.projectId, 'units:units:update');

      // P0-A FIX: update/delete uses resource.data
      allow update, delete: if isProjectMember(resource.data.projectId) &&
                               hasProjectPermission(resource.data.projectId, 'units:units:update');

      // Owners subcollection
      // P0-1 FIX: CRITICAL - Validate subdoc matches parent unit to prevent injection
      match /owners/{ownerId} {
        allow read: if isCompanyAdminOfCompany(resource.data.companyId) ||
                       (isInternalUserOfCompany(resource.data.companyId) &&
                        isProjectMember(resource.data.projectId) &&
                        hasProjectPermission(resource.data.projectId, 'legal:ownership:view'));

        // P0-1 FIX: CRITICAL - 1 parent get() to validate subdoc matches parent unit
        // This prevents cross-tenant injection attack
        allow create: if (isCompanyAdminOfCompany(request.resource.data.companyId) ||
                          (isInternalUserOfCompany(request.resource.data.companyId) &&
                           hasProjectPermission(request.resource.data.projectId, 'legal:ownership:manage'))) &&
                         // P0-1 MANDATORY: Subdoc must match parent unit
                         request.resource.data.unitId == unitId &&
                         request.resource.data.companyId == get(/databases/$(database)/documents/units/$(unitId)).data.companyId &&
                         request.resource.data.projectId == get(/databases/$(database)/documents/units/$(unitId)).data.projectId;

        allow update, delete: if isCompanyAdminOfCompany(resource.data.companyId) ||
                                 hasProjectPermission(resource.data.projectId, 'legal:ownership:manage');
      }

      // Grants subcollection
      // P0-1 FIX: CRITICAL - Validate subdoc matches parent unit to prevent injection
      match /grants/{granteeUid} {
        // Grantee can read their own grant, or staff with permission
        allow read: if isAuthenticated() && (
          granteeUid == request.auth.uid ||
          (isInternalUserOfCompany(resource.data.companyId) &&
           hasProjectPermission(resource.data.projectId, 'legal:grants:view'))
        );

        // P0-1 FIX: CRITICAL - 1 parent get() to validate subdoc matches parent unit
        // This prevents attacker from creating grant on unit of another tenant
        allow create: if isInternalUserOfCompany(request.resource.data.companyId) &&
                         hasProjectPermission(request.resource.data.projectId, 'legal:grants:create') &&
                         request.resource.data.expiresAt != null &&
                         request.resource.data.scopes.size() > 0 &&
                         // P0-1 MANDATORY: Subdoc must match parent unit
                         request.resource.data.unitId == unitId &&
                         request.resource.data.companyId == get(/databases/$(database)/documents/units/$(unitId)).data.companyId &&
                         request.resource.data.projectId == get(/databases/$(database)/documents/units/$(unitId)).data.projectId;

        // Update: only revocation allowed
        allow update: if isInternalUserOfCompany(resource.data.companyId) &&
                         hasProjectPermission(resource.data.projectId, 'legal:grants:revoke') &&
                         request.resource.data.diff(resource.data).affectedKeys().hasOnly(['revokedAt', 'revokedBy']);
      }
    }

    // ============================================================
    // CONVERSATIONS (Communications - Phase 1)
    // P0-4 FIX: Tenant-scoped path prevents cross-tenant data leak
    // Path: /companies/{companyId}/conversations/{conversationId}
    // ============================================================
    match /companies/{companyId}/conversations/{conversationId} {
      // Simple and secure: belongsToCompany(companyId) enforces tenant isolation
      allow read: if belongsToCompany(companyId) && isInternalUser();
      allow list: if belongsToCompany(companyId) && isInternalUser();
      allow create: if belongsToCompany(companyId) && isInternalUser();
      allow update: if belongsToCompany(companyId) && isInternalUser();

      match /messages/{messageId} {
        allow read: if belongsToCompany(companyId) && isInternalUser();
        allow create: if belongsToCompany(companyId) && isInternalUser();
      }
    }

    // ============================================================
    // PUBLIC LISTINGS (Sanitized - No Sensitive Data)
    // P0-3 FIX: Split create/update/delete + tenant validation
    // ============================================================
    match /publicListings/{listingId} {
      allow read: if true;  // Public

      // P0-3 FIX: create uses request.resource.data + tenant validation via parent get()
      allow create: if isProjectMember(request.resource.data.projectId) &&
                       hasProjectPermission(request.resource.data.projectId, 'listings:listings:publish') &&
                       // P0-3 MANDATORY: Validate project belongs to user's tenant
                       belongsToCompany(get(/databases/$(database)/documents/projects/$(request.resource.data.projectId)).data.companyId);

      // P0-3 FIX: update/delete uses resource.data (existing doc)
      allow update, delete: if isProjectMember(resource.data.projectId) &&
                               hasProjectPermission(resource.data.projectId, 'listings:listings:publish');
    }

    // ============================================================
    // AUDIT LOGS (Write via Cloud Functions only)
    // P0-2 FIX: Tenant-bound read (prevent cross-tenant audit log leak)
    // ============================================================
    match /audit_logs/{logId} {
      // P0-2 FIX: Use tenant-bound helper - company_admin can only see their tenant's logs
      allow read: if isCompanyAdminOfCompany(resource.data.companyId) ||
                     (isAuthenticated() && resource.data.actorId == request.auth.uid);
      allow write: if false; // Cloud Functions only
    }

  } // end documents
} // end service
```

---

## 6. API Middleware Pattern

### 6.1 Auth Context Builder

```typescript
// src/lib/auth/auth-context.ts

import { getAuth } from 'firebase-admin/auth';
import type { NextRequest } from 'next/server';

export interface AuthContext {
  uid: string;
  email: string;
  companyId: string;
  globalRole: GlobalRole;
  mfaEnrolled: boolean;  // P0 FIX: enrolled, not "verified this session"
  isAuthenticated: true;
}

export interface UnauthenticatedContext {
  isAuthenticated: false;
  reason: 'missing_token' | 'invalid_token' | 'missing_claims';
}

export type RequestContext = AuthContext | UnauthenticatedContext;

export async function buildAuthContext(request: NextRequest): Promise<RequestContext> {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return { isAuthenticated: false, reason: 'missing_token' };
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await getAuth().verifyIdToken(idToken);

    // Validate required claims
    if (!decodedToken.companyId || !decodedToken.globalRole) {
      console.warn(`User ${decodedToken.uid} missing required claims`);
      return { isAuthenticated: false, reason: 'missing_claims' };
    }

    return {
      uid: decodedToken.uid,
      email: decodedToken.email || '',
      companyId: decodedToken.companyId as string,
      globalRole: decodedToken.globalRole as GlobalRole,
      mfaEnrolled: decodedToken.mfaEnrolled === true,  // P0 FIX
      isAuthenticated: true
    };
  } catch (error) {
    console.error('Auth context build failed:', error);
    return { isAuthenticated: false, reason: 'invalid_token' };
  }
}
```

### 6.2 Permission Checker (Request-Scoped)

```typescript
// src/lib/auth/permissions.ts

import { getFirestore } from 'firebase-admin/firestore';
import type { AuthContext } from './auth-context';
import type { PermissionId } from './types';

// P0 FIX: Request-scoped cache interface (NO global Map in serverless)
export interface PermissionCache {
  get(key: string): string[] | undefined;
  set(key: string, permissions: string[]): void;
}

// Default no-op cache for v1 (safe in serverless)
export const noOpCache: PermissionCache = {
  get: () => undefined,
  set: () => {},
};

// Request-scoped memoization (pass cache per request)
export async function hasPermission(
  ctx: AuthContext,
  permission: PermissionId,
  projectId?: string,
  cache: PermissionCache = noOpCache
): Promise<boolean> {
  // Super admin bypass
  if (ctx.globalRole === 'super_admin') {
    return true;
  }

  // Company admin has company-level permissions (explicit, no wildcards)
  if (ctx.globalRole === 'company_admin') {
    const companyAdminPermissions: PermissionId[] = [
      'users:users:view',
      'users:users:manage',
      'projects:projects:view',
      'projects:projects:create',
      'projects:projects:update',
      'projects:projects:delete',
      'settings:settings:view',
      'settings:settings:manage',
    ];
    if (companyAdminPermissions.includes(permission)) {
      return true;
    }
  }

  // Check project-specific permission
  if (projectId) {
    const effectivePermissions = await getEffectivePermissions(ctx.uid, projectId, cache);
    return effectivePermissions.includes(permission);
  }

  return false;
}

async function getEffectivePermissions(
  uid: string,
  projectId: string,
  cache: PermissionCache
): Promise<string[]> {
  const cacheKey = `${uid}:${projectId}`;
  const cached = cache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const db = getFirestore();
  const memberDoc = await db.collection('projects').doc(projectId)
    .collection('members').doc(uid).get();

  if (!memberDoc.exists) {
    return [];
  }

  // P0 FIX: Use precomputed effectivePermissions (no runtime expansion)
  const memberData = memberDoc.data()!;
  const permissions = memberData.effectivePermissions || [];

  // Cache for this request only
  cache.set(cacheKey, permissions);

  return permissions;
}

// Helper: Create request-scoped cache
export function createRequestCache(): PermissionCache {
  const store = new Map<string, string[]>();
  return {
    get: (key) => store.get(key),
    set: (key, value) => store.set(key, value),
  };
}
```

### 6.3 API Route Middleware

```typescript
// src/lib/auth/middleware.ts

import { NextRequest, NextResponse } from 'next/server';
import { buildAuthContext, type AuthContext } from './auth-context';
import { hasPermission } from './permissions';
import { logAuditEvent } from './audit';

type ApiHandler = (
  request: NextRequest,
  context: AuthContext
) => Promise<NextResponse>;

interface MiddlewareOptions {
  requiredPermission?: PermissionId;
  projectIdParam?: string;
  requireMfaEnrolled?: boolean;  // P0 FIX: checks enrollment, then triggers re-auth flow
}

export function withAuth(handler: ApiHandler, options: MiddlewareOptions = {}) {
  return async (request: NextRequest, routeContext?: { params: Record<string, string> }) => {
    const authCtx = await buildAuthContext(request);

    if (!authCtx.isAuthenticated) {
      await logAuditEvent({
        action: 'access_denied',
        actorId: 'anonymous',
        targetType: 'api',
        newValue: {
          type: 'status',
          value: { path: request.nextUrl.pathname, reason: authCtx.reason }
        }
      });

      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    // MFA enrollment check (P0 FIX: checks enrollment, client must trigger re-auth)
    if (options.requireMfaEnrolled && !authCtx.mfaEnrolled) {
      return NextResponse.json(
        { error: 'MFA Enrollment Required', code: 'MFA_ENROLLMENT_REQUIRED' },
        { status: 403 }
      );
    }
    // NOTE: For MFA-required actions, also verify token freshness (auth_time claim)
    // Implementation: check decodedToken.auth_time is within acceptable window

    // Permission check
    if (options.requiredPermission) {
      const projectId = options.projectIdParam && routeContext?.params
        ? routeContext.params[options.projectIdParam]
        : undefined;

      const permitted = await hasPermission(authCtx, options.requiredPermission, projectId);

      if (!permitted) {
        await logAuditEvent({
          action: 'access_denied',
          actorId: authCtx.uid,
          targetType: 'api',
          newValue: {
            type: 'permission',
            value: {
              path: request.nextUrl.pathname,
              permission: options.requiredPermission,
              reason: 'insufficient_permissions'
            }
          }
        });

        return NextResponse.json(
          { error: 'Forbidden', code: 'PERMISSION_DENIED' },
          { status: 403 }
        );
      }
    }

    return handler(request, authCtx);
  };
}
```

---

## 7. Migration & Bootstrap Plan

### 7.1 Environment Variables (NO Hardcoding)

```bash
# .env.local (NEVER commit)
BOOTSTRAP_OWNER_EMAIL=<owner-email>
BOOTSTRAP_COMPANY_NAME=<company-name>
FIREBASE_SERVICE_ACCOUNT_PATH=<path-to-key>
```

### 7.2 Bootstrap Script

```typescript
// scripts/bootstrap-authorization.ts
// Run ONCE via CLI: npx ts-node scripts/bootstrap-authorization.ts

import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { PREDEFINED_ROLES } from '../src/lib/auth/roles';
import { PERMISSION_SETS } from '../src/lib/auth/permission-sets';

async function bootstrap() {
  // Validate environment
  const ownerEmail = process.env.BOOTSTRAP_OWNER_EMAIL;
  const companyName = process.env.BOOTSTRAP_COMPANY_NAME;
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

  if (!ownerEmail || !companyName || !serviceAccountPath) {
    throw new Error('Missing required environment variables');
  }

  initializeApp({ credential: cert(serviceAccountPath) });
  const db = getFirestore();
  const auth = getAuth();

  console.log('Creating predefined roles...');
  for (const [roleId, roleData] of Object.entries(PREDEFINED_ROLES)) {
    await db.collection('roles').doc(roleId).set({
      ...roleData,
      createdAt: new Date()
    });
  }

  console.log('Creating permission sets...');
  for (const [setId, setData] of Object.entries(PERMISSION_SETS)) {
    await db.collection('permissionSets').doc(setId).set({
      ...setData,
      createdAt: new Date()
    });
  }

  console.log('Creating initial company...');
  const companyRef = await db.collection('companies').add({
    name: companyName,
    createdAt: new Date(),
    settings: {}
  });

  console.log('Setting super_admin claims...');
  const ownerUser = await auth.getUserByEmail(ownerEmail);
  // P0-5 FIX: Use mfaEnrolled (not mfa)
  await auth.setCustomUserClaims(ownerUser.uid, {
    companyId: companyRef.id,
    globalRole: 'super_admin',
    mfaEnrolled: false  // P0-5 FIX
  });

  await db.collection('users').doc(ownerUser.uid).set({
    email: ownerEmail,
    displayName: ownerUser.displayName || '',
    companyId: companyRef.id,
    globalRole: 'super_admin',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date()
  });

  // Audit log
  await db.collection('audit_logs').add({
    action: 'system_bootstrap',
    actorId: 'system',
    targetId: companyRef.id,
    targetType: 'company',
    previousValue: null,
    newValue: { type: 'status', value: { companyId: companyRef.id, superAdmin: ownerUser.uid } },
    timestamp: new Date(),
    metadata: { reason: 'Initial system bootstrap' }
  });

  console.log('Bootstrap complete!');
  console.log(`Company ID: ${companyRef.id}`);
  console.log(`Super Admin: ${ownerEmail}`);
}

bootstrap().catch(console.error);
```

---

## 8. Permission Map (Collection Policy)

### Phase 1 Endpoints (Communications)

**P0-D FIX: API routes use `ctx.companyId` (from auth context) - NO companyId param.**
**Firestore path: `companies/{ctx.companyId}/conversations/...`**

| Endpoint | Method | Permission | Firestore Path |
|----------|--------|------------|----------------|
| `/api/conversations` | GET | `comm:conversations:list` | `companies/{ctx.companyId}/conversations` |
| `/api/conversations/[id]` | GET | `comm:conversations:view` | `companies/{ctx.companyId}/conversations/{id}` |
| `/api/conversations/[id]/messages` | GET | `comm:messages:view` | `companies/{ctx.companyId}/conversations/{id}/messages` |
| `/api/conversations/[id]/send` | POST | `comm:messages:send` | `companies/{ctx.companyId}/conversations/{id}/messages` |

**Note:** API does NOT accept `companyId` as parameter - always uses `ctx.companyId` from auth context.

### Future Endpoints

| Endpoint | Method | Permission | Additional Checks |
|----------|--------|------------|-------------------|
| `/api/units/[id]/documents` | GET | `docs:documents:view` | owner OR grant(scope) |
| `/api/units/[id]/grants` | POST | `legal:grants:create` | audit + expiry required |
| `/api/public/listings` | GET | *none* | Public |
| `/api/listings` | POST | `listings:listings:publish` | projectMember |

---

## 9. Implementation Checklist

### Phase 1: Core Authorization

- [ ] Create `/src/lib/auth/types.ts`
- [ ] Create `/src/lib/auth/roles.ts`
- [ ] Create `/src/lib/auth/permission-sets.ts`
- [ ] Create `/src/lib/auth/auth-context.ts`
- [ ] Create `/src/lib/auth/permissions.ts`
- [ ] Create `/src/lib/auth/middleware.ts`
- [ ] Create `/src/lib/auth/audit.ts`
- [ ] Deploy updated Firestore Rules
- [ ] Run bootstrap script
- [ ] Update Communications API endpoints

### Phase 2: Unit Ownership & Grants

- [ ] Create grants collection structure
- [ ] Implement grant creation API
- [ ] Implement grant revocation API
- [ ] Add grant-based access to units/documents

### Phase 3: Public Listings

- [ ] Create publicListings collection
- [ ] Implement listing publish workflow
- [ ] Sanitize data for public exposure

---

## 10. References

- [Firebase Custom Claims](https://firebase.google.com/docs/auth/admin/custom-claims)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Autodesk Construction Cloud Permissions](https://construction.autodesk.com/tools/construction-team-and-user-permissions/)
- [OWASP Access Control Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Access_Control_Cheat_Sheet.html)
