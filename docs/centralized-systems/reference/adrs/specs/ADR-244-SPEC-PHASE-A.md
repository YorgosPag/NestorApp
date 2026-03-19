# ADR-244 SPEC — Phase A: Users Tab + Roles Matrix Tab + Shared Infrastructure + API

| Metadata | Value |
|----------|-------|
| **ADR** | ADR-244 (Role Management Admin Console) |
| **Phase** | A (1η conversation υλοποίησης) |
| **Scope** | Tab 1 (Users) + Tab 2 (Roles & Permissions) + Page shell + API endpoints |
| **Date** | 2026-03-19 |
| **Estimated Files** | 16 νέα + 3 τροποποιήσεις |

---

## 1. Deliverables Overview

### Τι δημιουργείται στη Φάση Α:

| # | Αρχείο | Τύπος | Περιγραφή |
|---|--------|-------|-----------|
| 1 | `src/app/admin/role-management/page.tsx` | NEW | Main page — 4-tab shell (Tabs 3-4 placeholder) |
| 2 | `src/app/admin/role-management/error.tsx` | NEW | Error boundary |
| 3 | `src/app/admin/role-management/components/UsersTab.tsx` | NEW | Tab 1 — Users table + search + filters |
| 4 | `src/app/admin/role-management/components/UserTable.tsx` | NEW | DataTable — 8 columns, sort, pagination |
| 5 | `src/app/admin/role-management/components/RoleChangeDialog.tsx` | NEW | Google IAM "Grant Access" — 4 steps |
| 6 | `src/app/admin/role-management/components/PermissionSetManager.tsx` | NEW | Checkbox list — assign/remove permission sets |
| 7 | `src/app/admin/role-management/components/UserDetailPanel.tsx` | NEW | Expandable panel — full permission breakdown |
| 8 | `src/app/admin/role-management/components/RolesTab.tsx` | NEW | Tab 2 — Role matrix + permission sets + hierarchy |
| 9 | `src/app/admin/role-management/components/RolePermissionMatrix.tsx` | NEW | Role × Permission grid (read-only) |
| 10 | `src/app/admin/role-management/components/PermissionSetCard.tsx` | NEW | Salesforce-style card per permission set |
| 11 | `src/app/admin/role-management/components/RoleHierarchyDiagram.tsx` | NEW | Visual tree L0-L6 |
| 12 | `src/app/api/admin/role-management/users/route.ts` | NEW | GET — list company users |
| 13 | `src/app/api/admin/role-management/users/[uid]/role/route.ts` | NEW | PATCH — change global role |
| 14 | `src/app/api/admin/role-management/users/[uid]/status/route.ts` | NEW | PATCH — suspend/reactivate user (Google Workspace pattern) |
| 15 | `src/app/api/admin/role-management/users/[uid]/permission-sets/route.ts` | NEW | PATCH — update org-level permission sets |

### Τι τροποποιείται:

| # | Αρχείο | Αλλαγή |
|---|--------|--------|
| 16 | `src/app/api/admin/role-management/bootstrap/route.ts` | NEW | POST — one-time migration: δημιουργεί `companies/{cId}/members/{uid}` από existing `users` collection |
| 17 | `src/config/firestore-collections.ts` | MODIFY | Προσθήκη `COMPANY_MEMBERS` subcollection path |
| 18 | `src/services/enterprise-id.service.ts` | MODIFY | Προσθήκη `generateCompanyMemberId()` generator (prefix: `cmember`) |
| 19 | `src/config/smart-navigation-factory.ts` | MODIFY | Προσθήκη menu item "Role Management" στο admin section |

### Τι ΔΕΝ δημιουργείται (Phase B):

- ❌ AuditTimeline, AuditFilters, AuditExport components
- ❌ ProjectMemberTab, AssignMemberDialog, ProjectSelector components
- ❌ `/api/admin/role-management/audit-log/` endpoint
- ❌ `/api/admin/role-management/project-members/` endpoint
- ❌ Νέα audit actions (member_added, member_removed, member_updated)
- ❌ Audit log export (CSV/JSON)

---

## 2. File Specifications

---

### 2.1 `page.tsx` — Main Page Shell

**Path**: `src/app/admin/role-management/page.tsx`

**Pattern**: Follows `src/app/admin/users/claims-repair/page.tsx`

```typescript
// Directive
'use client';

// === IMPORTS ===

// React
import { useState } from 'react';

// Auth
import { useAuth } from '@/hooks/useAuth';

// i18n
import { useTranslation } from 'react-i18next';

// Design System Hooks
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { SEMANTIC_TYPOGRAPHY_TOKENS } from '@/hooks/useTypography';

// UI Components
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

// Local Components (Phase A)
import { UsersTab } from './components/UsersTab';
import { RolesTab } from './components/RolesTab';
```

**Behavior**:
- 4 tabs: Users | Roles & Permissions | Audit Log (coming soon) | Project Members (coming soon)
- Tabs 3-4 show placeholder `<section>` with "Coming soon — Phase B" message
- **Access control (Google Workspace pattern)**:
  - `super_admin` → full access (read + write — μπορεί να αλλάζει roles, suspend, κλπ)
  - `company_admin` → **read-only** (βλέπει users, roles, matrix — αλλά ΟΛΑ τα action buttons κρυμμένα)
  - Οποιοσδήποτε άλλος → redirect/deny
- Η σελίδα παίρνει `canEdit: boolean` από `useAuth()` → `globalRole === 'super_admin'`
- Το `canEdit` περνάει ως prop σε UsersTab, RolesTab κλπ
- Semantic HTML: `<main>` → `<header>` + `<Tabs>`
- Default active tab: "users"

**Types locally defined**:
```typescript
type TabId = 'users' | 'roles' | 'audit' | 'projects';
```

---

### 2.2 `error.tsx` — Error Boundary

**Path**: `src/app/admin/role-management/error.tsx`

**Pattern**: Standard Next.js error boundary

```typescript
'use client';

// === IMPORTS ===
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
```

**Behavior**:
- Displays error message with retry button
- Logs error to console in development
- Semantic: `<main>` → `<Alert>`

---

### 2.3 `UsersTab.tsx` — Users Tab Container

**Path**: `src/app/admin/role-management/components/UsersTab.tsx`

```typescript
// === IMPORTS ===

// React
import { useState, useCallback } from 'react';

// API Client
import { apiClient } from '@/lib/api/enterprise-api-client';

// UI Components
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

// Auth (for current user uid — self-protection check)
import { useAuth } from '@/hooks/useAuth';

// Notifications (existing Sonner-based system)
import { useNotifications } from '@/providers/NotificationProvider';

// Design System
import { useSpacingTokens } from '@/hooks/useSpacingTokens';

// Local Components
import { UserTable } from './UserTable';
import { RoleChangeDialog } from './RoleChangeDialog';
import { PermissionSetManager } from './PermissionSetManager';
import { UserDetailPanel } from './UserDetailPanel';
```

**Types locally defined** (or in a shared types file within the folder):
```typescript
interface CompanyUser {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  globalRole: GlobalRole;
  status: 'active' | 'suspended';
  mfaEnrolled: boolean;
  lastSignIn: string | null;
  projectCount: number;
  projectMemberships: ProjectMembership[];
}

interface ProjectMembership {
  projectId: string;
  projectName: string;
  roleId: string;
  permissionSetIds: string[];
}

interface UserListFilters {
  search: string;
  globalRole: GlobalRole | 'all';
  status: 'all' | 'active' | 'suspended';
  sortBy: 'name' | 'email' | 'lastSignIn' | 'globalRole';
  sortOrder: 'asc' | 'desc';
}

// Import from auth types
import type { GlobalRole } from '@/lib/auth/types';
```

**State management**:
- `users: CompanyUser[]` — fetched from API (all users in one call — <200 users expected)
- `filters: UserListFilters` — search, role filter, status filter, sort
- `selectedUser: CompanyUser | null` — for RoleChangeDialog / DetailPanel
- `isLoading: boolean`
- `dialogMode: 'role' | 'permissions' | 'detail' | 'suspend' | null`

**Behavior**:
- Fetches ALL users in one call: `apiClient.get('/api/admin/role-management/users')`
- **Client-side filtering/sorting/search** (< 200 users — no pagination needed)
- Search-as-you-type: instant filter on `displayName` / `email` (no debounce needed — client-side)
- Filter dropdowns: GlobalRole (Radix Select) + Status (Radix Select)
- NO pagination — all users loaded at once
- Semantic: `<section>` → `<header>` (search + filters) + `<UserTable>`

---

### 2.4 `UserTable.tsx` — DataTable Component

**Path**: `src/app/admin/role-management/components/UserTable.tsx`

```typescript
// === IMPORTS ===
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { SEMANTIC_TYPOGRAPHY_TOKENS } from '@/hooks/useTypography';

// Auth constants for badge mapping
import { GLOBAL_ROLES } from '@/lib/auth/types';
```

**Props interface**:
```typescript
interface UserTableProps {
  users: CompanyUser[];
  currentUserId: string;           // For self-protection visual hint
  canEdit: boolean;                // false for company_admin (read-only mode)
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  onSort: (column: string) => void;
  onSelectUser: (user: CompanyUser) => void;
  onChangeRole: (user: CompanyUser) => void;
  onManagePermissions: (user: CompanyUser) => void;
  onViewDetails: (user: CompanyUser) => void;
  onSuspendUser: (user: CompanyUser) => void;
}
```

**Avatar logic** (Google Workspace pattern):
- Αν `photoURL !== null` → `<img>` με τη φωτογραφία Google (στρογγυλό, 32×32)
- Αν `photoURL === null` → χρωματιστός κύκλος με το πρώτο γράμμα του `displayName`
- Χρώμα κύκλου: deterministic βάσει UID (ίδιο χρώμα πάντα για τον ίδιο χρήστη)
- **Ελέγξε πρώτα** αν υπάρχει Avatar component στο project (Grep: `Avatar`). Αν υπάρχει → reuse.

**8 Columns** (no checkboxes — ενέργειες ανά χρήστη, ΟΧΙ μαζικές):
1. Avatar + Name (sorted by displayName)
2. Email
3. Global Role — Badge variant mapping:
   - `super_admin` → `destructive` (red)
   - `company_admin` → `default` (blue)
   - `internal_user` → `success` (green)
   - `external_user` → `secondary` (gray)
4. Status — Badge variant mapping:
   - `active` → `success`
   - `suspended` → `warning`
   - `pending_invitation` → `secondary`
5. MFA Status — icon: enrolled = shield green, not enrolled = warning orange
6. Project Count — number
7. Last Sign-In — relative date (e.g., "2 hours ago")
8. Actions — dropdown: Edit Role, Manage Permissions, Suspend/Reactivate, View Details
   - Αν `canEdit === false` (company_admin): Εμφανίζεται ΜΟΝΟ "View Details"
   - Αν `canEdit === true` (super_admin): Εμφανίζονται όλες οι επιλογές

**Confirmation dialog pattern** (destructive actions only):
- **Αλλαγή ρόλου** → ΟΧΙ extra confirmation (το RoleChangeDialog ήδη έχει reason + confirm button)
- **Suspend χρήστη** → `showConfirmDialog()` πριν την εκτέλεση + reason field (destructive action)
- **Reactivate χρήστη** → ΟΧΙ confirmation (non-destructive — απλά ξεκλειδώνεις)

**Anti-patterns to avoid**:
- ❌ NO inline styles
- ❌ NO div soup — use `<Table>` components
- ❌ NO `any` type
- ❌ NO custom dropdown — use existing patterns

---

### 2.5 `RoleChangeDialog.tsx` — Role Change Modal

**Path**: `src/app/admin/role-management/components/RoleChangeDialog.tsx`

```typescript
// === IMPORTS ===
import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogFooter,
  DialogTitle, DialogDescription
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

// API
import { apiClient } from '@/lib/api/enterprise-api-client';

// Auth types
import { GLOBAL_ROLES } from '@/lib/auth/types';
import type { GlobalRole } from '@/lib/auth/types';

// Auth role descriptions
import { PREDEFINED_ROLES } from '@/lib/auth/roles';

// Notifications
import { useNotifications } from '@/providers/NotificationProvider';
```

**Notifications** (μετά από κάθε ενέργεια):
```typescript
const { success, error } = useNotifications();
// On success: success('roleManagement.roleChange.success')  → i18n key
// On error:   error('roleManagement.roleChange.error')       → i18n key
```

**Props interface**:
```typescript
interface RoleChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: CompanyUser;
  currentUserId: string;
  onSuccess: () => void;     // Trigger refetch
}
```

**State**:
```typescript
newRole: GlobalRole | null
reason: string              // min 10 chars (Okta/Salesforce compliance)
isSubmitting: boolean
error: string | null
```

**Behavior** (Google IAM 4-step pattern):
1. Display: User info (name, email, current role badge)
2. Select: New role via Radix Select with role descriptions from `PREDEFINED_ROLES`
3. Reason: `<textarea>` — required, min 10 characters
4. Warning banner: "User must re-login for changes to apply" (always visible)
5. Self-protection: If `user.uid === currentUserId` → Confirm button disabled + tooltip

**API Call**:
```typescript
apiClient.patch(`/api/admin/role-management/users/${user.uid}/role`, {
  newRole,
  reason,
});
```

**Dialog size**: `default` (md)

---

### 2.6 `PermissionSetManager.tsx` — Permission Set Assignment

**Path**: `src/app/admin/role-management/components/PermissionSetManager.tsx`

```typescript
// === IMPORTS ===
import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogFooter,
  DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';

// Auth
import { PERMISSION_SETS } from '@/lib/auth/permission-sets';
import { getAllPermissionSetIds, requiresMfaEnrollment } from '@/lib/auth/permission-sets';
```

**Props interface**:
```typescript
interface PermissionSetManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: CompanyUser;
  onSuccess: () => void;
}
```

**Behavior**:
- Checkbox list of all 9 permission sets
- Each set shows: name, description, MFA badge (if `requiresMfaEnrolled`)
- Pre-checked sets = user's current **org-level** permission sets (from `companies/{cId}/members/{uid}.permissionSetIds`)
- Submit: API call to update org-level permission sets
- Semantic: `<form>` with `<fieldset>` per set
- **Org-level vs Project-level** (Google pattern — 2 scopes):
  - **Αυτό το component** = org-level (ισχύει σε ΟΛΑ τα projects)
  - **Phase B** AssignMemberDialog = project-level (ισχύει μόνο σε 1 project)
  - Ο χρήστης βλέπει σε ποιο scope αντιστοιχεί κάθε ανάθεση

**API endpoint needed** (Φάση Α): `PATCH /api/admin/role-management/users/:uid/permission-sets`

---

### 2.7 `UserDetailPanel.tsx` — Expandable User Details

**Path**: `src/app/admin/role-management/components/UserDetailPanel.tsx`

```typescript
// === IMPORTS ===
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableRow, TableCell } from '@/components/ui/table';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';

// Auth
import { PREDEFINED_ROLES, getRole } from '@/lib/auth/roles';
import { PERMISSION_SETS, getPermissionSet } from '@/lib/auth/permission-sets';
import type { GlobalRole } from '@/lib/auth/types';
```

**Props interface**:
```typescript
interface UserDetailPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: CompanyUser;
}
```

**Sections** (5 sections — full user profile):
1. **User Info**: Avatar, name, email, global role badge, status, MFA, last login
2. **Org-Level Permission Sets**: Badges for each org-level set (from `companies/{cId}/members/{uid}.permissionSetIds`)
3. **Project Memberships**: Table — project name, project role, project-level permission sets
4. **Effective Permissions**: Computed full list from global role + org sets + project sets (read-only)
5. **Activity History**: Τελευταίες 10 αλλαγές ρόλου/permissions αυτού του χρήστη (from audit logs, filtered by `target.uid`)
   - Timeline format (μικρογραφία του Audit Tab)
   - Δείχνει: ημερομηνία, ποιος έκανε την αλλαγή, τι άλλαξε, reason
   - **Data source**: `companies/{cId}/audit_logs` filtered by `target.uid === user.uid`, limit 10, ordered by timestamp DESC

**Dialog size**: `lg`

---

### 2.8 `RolesTab.tsx` — Roles & Permissions Tab Container

**Path**: `src/app/admin/role-management/components/RolesTab.tsx`

```typescript
// === IMPORTS ===
import { RolePermissionMatrix } from './RolePermissionMatrix';
import { PermissionSetCard } from './PermissionSetCard';
import { RoleHierarchyDiagram } from './RoleHierarchyDiagram';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
```

**Behavior**:
- Read-only tab — purely informational
- 3 collapsible sections: Role Hierarchy, Permission Matrix, Permission Sets
- Semantic: `<section>` with 3 `<details>` elements (native HTML5 collapsible)

---

### 2.9 `RolePermissionMatrix.tsx` — Role × Permission Grid

**Path**: `src/app/admin/role-management/components/RolePermissionMatrix.tsx`

```typescript
// === IMPORTS ===
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

// Auth — source of truth for matrix data
import { PREDEFINED_ROLES } from '@/lib/auth/roles';
import { PERMISSIONS } from '@/lib/auth/types';
import type { PermissionId } from '@/lib/auth/types';
```

**Behavior**:
- Computed at render time from `PREDEFINED_ROLES` + `PERMISSIONS`
- Rows = All 13 roles (4 global + 9 project)
- Columns = Permission domains (comm, projects, units, buildings, dxf, crm, finance, legal, admin)
- Collapsible domain groups: click domain header → expand individual permissions
- Cells: ✅ (has permission), 📖 (read-only subset), ❌ (no access)
- Legend below matrix

**Data computation**:
```typescript
// Group permissions by domain
const permissionDomains = groupBy(Object.keys(PERMISSIONS), (p) => p.split(':')[0]);

// For each role × domain: check which permissions are granted
function getRoleDomainAccess(roleId: string, domainPerms: PermissionId[]): 'full' | 'partial' | 'none' {
  const rolePerms = PREDEFINED_ROLES[roleId]?.permissions ?? [];
  const granted = domainPerms.filter(p => rolePerms.includes(p));
  if (granted.length === domainPerms.length) return 'full';
  if (granted.length > 0) return 'partial';
  return 'none';
}
```

---

### 2.10 `PermissionSetCard.tsx` — Permission Set Info Card

**Path**: `src/app/admin/role-management/components/PermissionSetCard.tsx`

```typescript
// === IMPORTS ===
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';

// Auth
import type { PermissionId } from '@/lib/auth/types';
```

**Props interface**:
```typescript
interface PermissionSetCardProps {
  setId: string;
  name: string;
  description: string;
  permissions: PermissionId[];
  requiresMfa: boolean;
  userCount: number;           // Phase A: 0 (no user count available yet)
}
```

**Behavior**:
- Salesforce Permission Set Card pattern
- Shows: Name, description, permissions list, MFA badge (if required), user count badge
- Read-only — no actions

---

### 2.11 `RoleHierarchyDiagram.tsx` — Visual Role Hierarchy

**Path**: `src/app/admin/role-management/components/RoleHierarchyDiagram.tsx`

```typescript
// === IMPORTS ===
import { Badge } from '@/components/ui/badge';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';

// Auth
import { PREDEFINED_ROLES } from '@/lib/auth/roles';
```

**Behavior**:
- Pure CSS tree visualization (NO external library)
- Shows hierarchy: L0 → L1 → L2 → L3 → L4 → L5 → L6
- Color-coded badges per role
- Semantic: `<nav aria-label="Role Hierarchy">` with nested `<ul>/<li>`

---

### 2.12 `users/route.ts` — List Users API

**Path**: `src/app/api/admin/role-management/users/route.ts`

```typescript
// === IMPORTS ===
import { NextRequest, NextResponse } from 'next/server';

// Middleware
import { withAuth } from '@/lib/auth/middleware';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';

// Auth
import { isRoleBypass } from '@/lib/auth/roles';
import type { AuthContext } from '@/lib/auth/types';
import type { PermissionCache } from '@/lib/auth/permissions';

// Firebase Admin
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase/admin';

// Collections
import { COLLECTIONS } from '@/config/firestore-collections';
```

**Endpoint**: `GET /api/admin/role-management/users`

**Query Parameters**: Κανένα — φορτώνει ΟΛΟΥΣ τους χρήστες (<200 expected).
Filtering, sorting, search γίνονται **client-side**.

**Middleware pipeline**: `withSensitiveRateLimit(withAuth(handler, { requiredGlobalRoles: ['super_admin', 'company_admin'] }))`

> **Σημείωση**: Ο GET endpoint δέχεται και `company_admin` (read-only access — Google pattern).
> Τα mutation endpoints (PATCH role, PATCH status, POST project-members) δέχονται ΜΟΝΟ `super_admin`.

**Implementation approach** (Google pattern — 2 data sources merged):
1. Fetch RBAC data from `companies/{companyId}/members` subcollection (globalRole, status, permissionSetIds)
2. Batch-fetch profile data from `users/{uid}` documents (email, displayName, photoURL)
3. Batch-fetch Firebase Auth records: `auth().getUsers(uids)` (lastSignIn, mfaEnrolled, disabled)
4. Batch-fetch project memberships: `companies/{cId}/projects/*/members/{uid}`
5. Merge into `CompanyUser[]` (RBAC + Profile + Auth + Projects)
6. Return full list (no pagination — <200 users)

**Response type**:
```typescript
interface UserListResponse {
  success: true;
  data: {
    users: CompanyUser[];
    total: number;
  };
}
```

**Security checks**:
- ✅ Rate limiting (withSensitiveRateLimit)
- ✅ Auth verification (withAuth)
- ✅ super_admin OR company_admin (requiredGlobalRoles) — read-only for company_admin
- ✅ Tenant isolation (query only companyId members)

---

### 2.13 `users/[uid]/role/route.ts` — Change Global Role API

**Path**: `src/app/api/admin/role-management/users/[uid]/role/route.ts`

```typescript
// === IMPORTS ===
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Middleware
import { withAuth } from '@/lib/auth/middleware';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';

// Auth
import { isRoleBypass } from '@/lib/auth/roles';
import { isValidGlobalRole } from '@/lib/auth/types';
import { logRoleChange } from '@/lib/auth/audit';
import type { AuthContext } from '@/lib/auth/types';
import type { PermissionCache } from '@/lib/auth/permissions';

// Firebase Admin
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase/admin';

// Collections
import { COLLECTIONS } from '@/config/firestore-collections';

// Enterprise ID (for audit log)
import { generateRoleAuditId } from '@/services/enterprise-id.service';
```

**Endpoint**: `PATCH /api/admin/role-management/users/:uid/role`

**Request Body** (Zod validated):
```typescript
const ChangeRoleRequestSchema = z.object({
  newRole: z.enum(['super_admin', 'company_admin', 'internal_user', 'external_user']),
  reason: z.string().min(10, 'Reason must be at least 10 characters'),
});
```

**Middleware pipeline**: `withSensitiveRateLimit(withAuth(handler, { requiredGlobalRoles: ['super_admin'] }))`

**Implementation steps**:
1. Parse `uid` from URL params
2. Validate request body with Zod
3. **Self-protection check**: `uid !== ctx.uid` (cannot change own role)
4. **Tenant isolation**: Verify target user belongs to same `companyId`
5. Fetch current role from **source of truth**: `companies/{cId}/members/{uid}.globalRole`
6. **Prevent no-op**: Verify `newRole !== existingRole`
7. **Atomic dual-write** (source of truth + claims sync):
   a. Update Firestore: `companies/{cId}/members/{uid}` → `{ globalRole: newRole, updatedAt: serverTimestamp() }`
   b. Update Firebase claims: `auth().setCustomUserClaims(uid, { ...claims, globalRole: newRole })`
8. **Audit log**: `logRoleChange(ctx, uid, oldRole, newRole, reason)`
9. Return response with `requiresReLogin: true`

**Response type**:
```typescript
interface ChangeRoleResponse {
  success: true;
  data: {
    previousRole: GlobalRole;
    newRole: GlobalRole;
    requiresReLogin: true;
    auditLogId: string;
  };
}
```

**Error responses**:
- 400: Invalid request body (Zod errors)
- 403: Self-protection — "Cannot change own role"
- 403: Not super_admin
- 404: Target user not found or not in same company
- 409: Same role — "User already has this role"
- 429: Rate limited

**Security checks**:
- ✅ Rate limiting (withSensitiveRateLimit — 10 req/min)
- ✅ Auth verification (withAuth)
- ✅ super_admin only (requiredGlobalRoles)
- ✅ Self-protection (cannot change own role)
- ✅ Tenant isolation (target in same companyId)
- ✅ Input validation (Zod schema)
- ✅ Audit trail (logRoleChange)
- ✅ Enterprise ID (generateRoleAuditId for audit doc)

---

### 2.14 `bootstrap/route.ts` — One-Time Migration: Company Members Subcollection

**Path**: `src/app/api/admin/role-management/bootstrap/route.ts`

**Σκοπός**: Δημιουργεί τη subcollection `companies/{cId}/members/{uid}` (Google Workspace pattern).
Τρέχει **μία φορά** — μεταφέρει τα RBAC data από `users/{uid}` στη νέα subcollection.

```typescript
// === IMPORTS ===
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAdminFirestore, getAdminAuth } from '@/lib/firebase/admin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FieldValue } from 'firebase-admin/firestore';
```

**Endpoint**: `POST /api/admin/role-management/bootstrap`

**Middleware pipeline**: `withSensitiveRateLimit(withAuth(handler, { requiredGlobalRoles: ['super_admin'] }))`

**Implementation steps**:
1. Fetch all documents from `users` collection
2. For each user with `companyId`:
   - Create document at `companies/{companyId}/members/{uid}`
   - Document data:
     ```typescript
     {
       uid: string,
       globalRole: string,           // from users doc or Firebase custom claims
       status: 'active',             // default — derived from Firebase Auth disabled
       joinedAt: FieldValue.serverTimestamp(),
       permissionSetIds: [],          // empty — to be assigned later
       addedBy: ctx.uid,             // super_admin who ran bootstrap
     }
     ```
3. **Idempotent**: Αν το document ήδη υπάρχει → skip (δεν overwrite)
4. Return count of created documents

**Response**:
```typescript
{
  success: true,
  data: {
    created: number,    // π.χ. 2
    skipped: number,    // already existed
    total: number,      // total users processed
  }
}
```

**Σημείωση**: Αυτό τρέχει μόνο μία φορά. Μετά, κάθε νέος χρήστης που δημιουργείται
πρέπει να γράφεται ΚΑΙ στο `users/{uid}` ΚΑΙ στο `companies/{cId}/members/{uid}`.

**Νέα Firestore data model** (Google Workspace pattern):
```
users/{uid}                          ← Profile data ΜΟΝΟ (identity)
├── email: string
├── displayName: string | null
├── photoURL: string | null
├── companyId: string
└── createdAt: Timestamp
    ❌ globalRole ΑΦΑΙΡΕΙΤΑΙ — δεν ανήκει εδώ πλέον

companies/{cId}/members/{uid}        ← RBAC data (authorization) — NEW ★ SOURCE OF TRUTH ★
├── uid: string
├── globalRole: GlobalRole           ★ ΚΑΝΟΝΙΚΗ ΠΗΓΗ ΑΛΗΘΕΙΑΣ
├── status: 'active' | 'suspended'
├── joinedAt: Timestamp
├── permissionSetIds: string[]       ← ORG-LEVEL permission sets (ισχύουν σε ΟΛΑ τα projects)
├── addedBy: string                  // who added this member
└── updatedAt: Timestamp | null

companies/{cId}/projects/{pId}/members/{uid}  ← Project-scoped RBAC (ήδη υπάρχει)
├── uid: string
├── roleId: ProjectRole
├── permissionSetIds: string[]       ← PROJECT-LEVEL permission sets (ισχύουν ΜΟΝΟ σε αυτό το project)
├── addedBy: string
├── addedAt: Timestamp
└── status: 'active' | 'removed'

Firebase Custom Claims               ← ΑΝΤΙΓΡΑΦΟ για server-side auth (sync)
├── globalRole: GlobalRole           // Αντίγραφο — ενημερώνεται μαζί
├── companyId: string
└── (max 1000 bytes)
```

**Source of Truth κανόνας**:
- Αλλαγή ρόλου → γράφει ΚΑΙ στο `members/{uid}` ΚΑΙ στα Firebase claims (atomic)
- Αν ποτέ διαφωνούν → η subcollection κερδίζει
- Το `users/{uid}` ΔΕΝ αποθηκεύει πλέον `globalRole` (αποφυγή duplicate)
- Η bootstrap migration αφαιρεί το `globalRole` από `users/{uid}` μετά τη μεταφορά

---

### 2.15 `users/[uid]/permission-sets/route.ts` — Update Org-Level Permission Sets

**Path**: `src/app/api/admin/role-management/users/[uid]/permission-sets/route.ts`

```typescript
// === IMPORTS ===
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/auth/middleware';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { getAllPermissionSetIds } from '@/lib/auth/permission-sets';
import { logAuditEvent } from '@/lib/auth/audit';
import { getAdminFirestore } from '@/lib/firebase/admin';
```

**Endpoint**: `PATCH /api/admin/role-management/users/:uid/permission-sets`

**Request Body** (Zod validated):
```typescript
const UpdatePermissionSetsSchema = z.object({
  permissionSetIds: z.array(z.string()),
  reason: z.string().min(10, 'Reason must be at least 10 characters'),
});
```

**Middleware pipeline**: `withSensitiveRateLimit(withAuth(handler, { requiredGlobalRoles: ['super_admin'] }))`

**Implementation steps**:
1. Parse `uid` from URL params
2. Validate request body — verify all `permissionSetIds` exist in `getAllPermissionSetIds()`
3. **Tenant isolation**: Verify target member exists in `companies/{cId}/members/{uid}`
4. Fetch current `permissionSetIds` from member document
5. Compute diff: added sets, removed sets
6. Update Firestore: `companies/{cId}/members/{uid}` → `{ permissionSetIds, updatedAt }`
7. **Audit log**: One entry per added set (`permission_set_granted`), one per removed set (`permission_set_revoked`)
8. Return response

**Response type**:
```typescript
interface UpdatePermissionSetsResponse {
  success: true;
  data: {
    previousSets: string[];
    newSets: string[];
    added: string[];
    removed: string[];
  };
}
```

**Scope**: Αυτό αφορά **org-level** permission sets (ισχύουν σε όλα τα projects).
Τα project-level permission sets διαχειρίζονται μέσω `POST /project-members` (Phase B).

---

### 2.16 `users/[uid]/status/route.ts` — Suspend/Reactivate User API

**Path**: `src/app/api/admin/role-management/users/[uid]/status/route.ts`

**Pattern**: Google Workspace — Suspend/Reactivate user (πάγωμα χωρίς διαγραφή)

```typescript
// === IMPORTS ===
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Middleware
import { withAuth } from '@/lib/auth/middleware';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';

// Auth
import { isRoleBypass } from '@/lib/auth/roles';
import { logAuditEvent } from '@/lib/auth/audit';
import type { AuthContext } from '@/lib/auth/types';
import type { PermissionCache } from '@/lib/auth/permissions';

// Firebase Admin
import { getAdminAuth } from '@/lib/firebase/admin';
```

**Endpoint**: `PATCH /api/admin/role-management/users/:uid/status`

**Request Body** (Zod validated):
```typescript
const ChangeStatusRequestSchema = z.object({
  action: z.enum(['suspend', 'reactivate']),
  reason: z.string().min(10, 'Reason must be at least 10 characters'),
});
```

**Middleware pipeline**: `withSensitiveRateLimit(withAuth(handler, { requiredGlobalRoles: ['super_admin'] }))`

**Implementation steps**:
1. Parse `uid` from URL params
2. Validate request body with Zod
3. **Self-protection check**: `uid !== ctx.uid` (cannot suspend yourself)
4. **Tenant isolation**: Verify target user belongs to same `companyId`
5. Fetch current user state: `auth().getUser(uid)`
6. **Prevent no-op**: Verify action makes sense (e.g., don't suspend already-suspended)
7. **Firebase operation**: `auth().updateUser(uid, { disabled: action === 'suspend' })`
   - `disabled: true` = Suspended (user cannot log in, tokens invalidated)
   - `disabled: false` = Active (user can log in again)
8. **Audit log**: `logAuditEvent(ctx, action === 'suspend' ? 'user_suspended' : 'user_activated', uid, 'user', { reason })`
9. Return response

**Response type**:
```typescript
interface ChangeStatusResponse {
  success: true;
  data: {
    previousStatus: 'active' | 'suspended';
    newStatus: 'active' | 'suspended';
    auditLogId: string;
  };
}
```

**Error responses**:
- 400: Invalid request body (Zod errors)
- 403: Self-protection — "Cannot suspend yourself"
- 403: Not super_admin
- 404: Target user not found or not in same company
- 409: User already has this status
- 429: Rate limited

**Γιατί αυτή η προσέγγιση (Google pattern)**:
- Suspend ≠ Delete — τα δεδομένα του χρήστη μένουν ανέπαφα
- Άμεση αποτελεσματικότητα — το Firebase `disabled` ακυρώνει τα tokens αμέσως
- Reversible — ο admin μπορεί να κάνει reactivate ανά πάσα στιγμή
- Audit trail — κάθε suspend/reactivate καταγράφεται με reason

**User status mapping** (στο Users API GET response):
```typescript
// Ο status υπολογίζεται από Firebase Auth:
function getUserStatus(firebaseUser: UserRecord): 'active' | 'suspended' {
  return firebaseUser.disabled ? 'suspended' : 'active';
}
// Σημείωση: Το 'pending_invitation' ΑΦΑΙΡΕΙΤΑΙ — δεν υπάρχει invitation system.
// Αν προστεθεί μελλοντικά, θα επεκταθεί τότε.
```

---

## 3. Modified Files

### 3.1 `firestore-collections.ts`

**Αλλαγή**: Προσθήκη collection constant

```typescript
// Προσθήκη στο COLLECTIONS object:
ROLE_AUDIT_LOGS: 'role_audit_logs',
```

**Σημείωση**: Αυτή η collection χρησιμοποιείται μόνο αν αποφασίσουμε ξεχωριστή collection
από το existing `audit_logs`. Αν χρησιμοποιηθεί η existing `companies/{cId}/audit_logs`,
αυτή η αλλαγή δεν χρειάζεται. **Η απόφαση θα ληφθεί κατά την υλοποίηση** βάσει:
- Existing `logRoleChange()` ήδη γράφει σε `companies/{cId}/audit_logs`
- Αν αυτό αρκεί → ΔΕΝ δημιουργούμε νέα collection (KISS)

### 3.2 `enterprise-id.service.ts`

**Αλλαγή**: Προσθήκη ID generator

```typescript
// Prefix
ROLE_AUDIT: 'raudit',

// Generator
export function generateRoleAuditId(): string {
  return generatePrefixedId(ENTERPRISE_ID_PREFIXES.ROLE_AUDIT);
}
```

**Σημείωση**: Μόνο αν χρειαστεί ξεχωριστό document ID (αντί auto-ID).
Η existing `logRoleChange()` χρησιμοποιεί auto-generated IDs. Αν αρκεί → skip.

### 3.3 `smart-navigation-factory.ts`

**Αλλαγή**: Προσθήκη menu item στο admin section

```typescript
// Στο admin navigation items:
{
  id: 'role-management',
  label: 'navigation.admin.roleManagement', // i18n key
  path: '/admin/role-management',
  icon: 'Shield', // ή κατάλληλο icon
  requiredRole: 'super_admin',
}
```

**i18n keys** (σε `src/i18n/locales/{en,el}/navigation.json`):
```json
// en
{ "admin": { "roleManagement": "Role Management" } }
// el
{ "admin": { "roleManagement": "Διαχείριση Ρόλων" } }
```

---

## 4. Shared Types (optional shared file)

**Αν χρειαστεί**: `src/app/admin/role-management/types.ts`

```typescript
import type { GlobalRole } from '@/lib/auth/types';

export interface CompanyUser {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  globalRole: GlobalRole;
  status: 'active' | 'suspended';
  mfaEnrolled: boolean;
  lastSignIn: string | null;
  projectCount: number;
  projectMemberships: ProjectMembership[];
}

export interface ProjectMembership {
  projectId: string;
  projectName: string;
  roleId: string;
  permissionSetIds: string[];
}

export interface UserListFilters {
  search: string;
  globalRole: GlobalRole | 'all';
  status: 'all' | 'active' | 'suspended';
  sortBy: 'name' | 'email' | 'lastSignIn' | 'globalRole';
  sortOrder: 'asc' | 'desc';
}

// Badge variant mapping for roles
export const ROLE_BADGE_VARIANT: Record<GlobalRole, string> = {
  super_admin: 'destructive',
  company_admin: 'default',
  internal_user: 'success',
  external_user: 'secondary',
} as const;

// Role display labels (Greek)
export const ROLE_LABELS: Record<GlobalRole, string> = {
  super_admin: 'Super Admin',
  company_admin: 'Company Admin',
  internal_user: 'Internal User',
  external_user: 'External User',
} as const;
```

---

## 5. Anti-Duplicate Checklist

Πριν την υλοποίηση, βεβαιώσου ότι ΔΕΝ δημιουργείς duplicates:

| Concern | Check | Resolution |
|---------|-------|------------|
| Select component | Μόνο `@/components/ui/select` | ADR-001 — ΚΑΝΕΝΑ custom dropdown |
| Table component | Μόνο `@/components/ui/table` | Existing Table components |
| Dialog component | Μόνο `@/components/ui/dialog` | Existing Dialog with size variants |
| Badge component | Μόνο `@/components/ui/badge` | 11 variants available |
| Tabs component | Μόνο `@/components/ui/tabs` | Existing Tabs components |
| Rate limiting | `withSensitiveRateLimit` from `@/lib/middleware` | ΟΧΙ custom rate limiter |
| Auth middleware | `withAuth` from `@/lib/auth/middleware` | ΟΧΙ custom auth check |
| Audit logging | `logRoleChange` from `@/lib/auth/audit` | ΟΧΙ custom audit function |
| Permission data | `PREDEFINED_ROLES`, `PERMISSIONS`, `PERMISSION_SETS` | ΟΧΙ hardcoded copies |
| API client | `apiClient` from `@/lib/api/enterprise-api-client` | ΟΧΙ fetch/axios |
| ID generation | `enterprise-id.service.ts` | ΟΧΙ inline ID generation |
| Notifications | `useNotifications()` from `@/providers/NotificationProvider` | ΟΧΙ `toast()` direct, ΟΧΙ `alert()`, ΟΧΙ custom toast |

---

## 6. Relative Date Utility

Για τη στήλη "Last Sign-In" χρειάζεται relative date formatting (e.g., "2 hours ago").

**Ελέγξε πρώτα**: Υπάρχει ήδη utility στο project;
- Grep: `formatRelativeDate|timeAgo|formatDistanceToNow`
- Αν υπάρχει → χρησιμοποίησέ το
- Αν ΔΕΝ υπάρχει → δημιούργησε μικρό utility (ΟΧΙ date-fns import):

```typescript
// src/app/admin/role-management/utils/format-relative-date.ts
export function formatRelativeDate(dateString: string | null): string {
  if (!dateString) return 'Never';
  // ... simple implementation
}
```

---

## 7. Firestore Composite Indexes

Πιθανόν χρειάζονται νέα indexes. Αυτό θα αξιολογηθεί κατά την υλοποίηση:

```json
// firestore.indexes.json — αν χρειαστούν
{
  "collectionGroup": "members",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "companyId", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" }
  ]
}
```

---

## 8. i18n Keys Required (Phase A)

```json
// src/i18n/locales/en/admin.json (ή navigation.json)
{
  "roleManagement": {
    "title": "Role Management",
    "tabs": {
      "users": "Users",
      "roles": "Roles & Permissions",
      "audit": "Audit Log",
      "projects": "Project Members"
    },
    "usersTab": {
      "search": "Search users by name or email...",
      "filterRole": "Filter by role",
      "filterStatus": "Filter by status",
      "allRoles": "All Roles",
      "allStatuses": "All Statuses",
      "loadMore": "Load More",
      "showing": "Showing {{from}}-{{to}} of {{total}}"
    },
    "roleChange": {
      "title": "Change Role",
      "currentRole": "Current Role",
      "newRole": "New Role",
      "reason": "Reason for change",
      "reasonPlaceholder": "Explain why this role change is needed...",
      "warning": "User must re-login for changes to apply",
      "selfProtection": "Cannot change your own role",
      "confirm": "Confirm Change",
      "cancel": "Cancel",
      "success": "Role changed successfully",
      "sameRole": "User already has this role"
    },
    "permissionSets": {
      "title": "Permission Sets",
      "mfaRequired": "MFA Required",
      "usersAssigned": "{{count}} users assigned"
    },
    "userDetail": {
      "title": "User Details",
      "globalRole": "Global Role",
      "level": "Level",
      "projectMemberships": "Project Memberships",
      "effectivePermissions": "Effective Permissions"
    },
    "matrix": {
      "title": "Permission Matrix",
      "legend": {
        "full": "Full access",
        "partial": "Read-only",
        "none": "No access"
      }
    },
    "hierarchy": {
      "title": "Role Hierarchy"
    },
    "comingSoon": "Coming soon — Phase B"
  }
}
```

Greek equivalents in `el/admin.json`.

---

## 9. CSS Classes

Κανένα νέο CSS module δεν χρειάζεται. Όλο το styling μέσω:
- Design system hooks: `useSpacingTokens()`, `useLayoutClasses()`, `useTypography()`
- Existing utility classes
- Component variants (Badge variants, Dialog sizes)
- ❌ NO inline styles
- ❌ NO new CSS files (εκτός αν absolutely necessary)

---

## 10. Testing Approach (Verification Only — Phase A)

Μετά την υλοποίηση:
1. **TypeScript compilation**: `npx tsc --noEmit` (background)
2. **Manual testing**: Navigate to `/admin/role-management`
3. **API testing**: Call endpoints via browser console / Postman
4. **Security verification**: Non-super_admin gets 403

---

*End of Phase A Specification*
