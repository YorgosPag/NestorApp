# ADR-244 SPEC — Phase B: Audit Log Tab + Project Members Tab + API

| Metadata | Value |
|----------|-------|
| **ADR** | ADR-244 (Role Management Admin Console) |
| **Phase** | B (2η conversation υλοποίησης) |
| **Scope** | Tab 3 (Audit Log) + Tab 4 (Project Members) + 2 API endpoints + new audit actions |
| **Date** | 2026-03-19 |
| **Prerequisite** | Phase A ολοκληρωμένη |
| **Estimated Files** | 9 νέα + 3 τροποποιήσεις |

---

## 1. Deliverables Overview

### Τι δημιουργείται στη Φάση Β:

| # | Αρχείο | Τύπος | Περιγραφή |
|---|--------|-------|-----------|
| 1 | `src/app/admin/role-management/components/AuditTab.tsx` | NEW | Tab 3 container — timeline + filters + export |
| 2 | `src/app/admin/role-management/components/AuditTimeline.tsx` | NEW | Timeline view — grouped by date |
| 3 | `src/app/admin/role-management/components/AuditFilters.tsx` | NEW | Filter controls — date, actor, target, action |
| 4 | `src/app/admin/role-management/components/AuditExport.tsx` | NEW | Export dropdown — CSV + JSON |
| 5 | `src/app/admin/role-management/components/ProjectMembersTab.tsx` | NEW | Tab 4 container — project selector + member table |
| 6 | `src/app/admin/role-management/components/MemberTable.tsx` | NEW | DataTable — project members |
| 7 | `src/app/admin/role-management/components/AssignMemberDialog.tsx` | NEW | AWS 3-step wizard — add member to project |
| 8 | `src/app/api/admin/role-management/audit-log/route.ts` | NEW | GET — query audit logs |
| 9 | `src/app/api/admin/role-management/project-members/route.ts` | NEW | POST — manage project members |

### Τι τροποποιείται:

| # | Αρχείο | Αλλαγή |
|---|--------|--------|
| 10 | `src/app/admin/role-management/page.tsx` | Αφαίρεση "coming soon" από Tabs 3-4, import AuditTab + ProjectMembersTab |
| 11 | `src/app/admin/role-management/types.ts` | Προσθήκη audit + project member types |
| 12 | `src/lib/auth/audit.ts` | Προσθήκη νέων audit convenience wrappers (αν δεν υπάρχουν ήδη) |

### Τι ΔΕΝ δημιουργείται (ήδη υπάρχει από Phase A):

- ❌ page.tsx (μόνο τροποποίηση)
- ❌ UserTable, RoleChangeDialog, PermissionSetManager (Phase A)
- ❌ RolePermissionMatrix, PermissionSetCard, RoleHierarchyDiagram (Phase A)
- ❌ API endpoints users/ (Phase A)

---

## 2. File Specifications

---

### 2.1 `AuditTab.tsx` — Audit Log Tab Container

**Path**: `src/app/admin/role-management/components/AuditTab.tsx`

```typescript
// === IMPORTS ===
import { useState, useCallback, useEffect } from 'react';

// API
import { apiClient } from '@/lib/api/enterprise-api-client';

// Design System
import { useSpacingTokens } from '@/hooks/useSpacingTokens';

// Local Components
import { AuditTimeline } from './AuditTimeline';
import { AuditFilters } from './AuditFilters';
import { AuditExport } from './AuditExport';

// Types
import type { AuditLogEntry, AuditLogFilters } from '../types';
```

**State**:
```typescript
entries: AuditLogEntry[]
filters: AuditLogFilters
isLoading: boolean
nextCursor: string | null
```

**Behavior**:
- Fetches audit logs via `apiClient.get('/api/admin/role-management/audit-log', { params })`
- Passes filter state to `AuditFilters` (controlled)
- Passes entries to `AuditTimeline` (grouped by date)
- "Load More" for pagination
- Semantic: `<section>` → `<header>` (filters + export) + `<AuditTimeline>` + `<footer>` (pagination)

---

### 2.2 `AuditTimeline.tsx` — Timeline View

**Path**: `src/app/admin/role-management/components/AuditTimeline.tsx`

```typescript
// === IMPORTS ===
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { SEMANTIC_TYPOGRAPHY_TOKENS } from '@/hooks/useTypography';

// Types
import type { AuditLogEntry } from '../types';
```

**Props interface**:
```typescript
interface AuditTimelineProps {
  entries: AuditLogEntry[];
  onActorClick: (actorId: string) => void;   // Linked actors — filter by actor
  onTargetClick: (targetId: string) => void;  // Linked targets — filter by target
}
```

**Behavior** (enterpriseready.io pattern):
- Groups entries by date: "Today", "Yesterday", specific dates (e.g., "March 17, 2026")
- Each entry shows:
  - Time (HH:MM)
  - Actor avatar + name (clickable → linked actor filter)
  - Action verb (human-readable, color-coded badge)
  - Target name (clickable → linked target filter)
  - Before/After values (if applicable)
  - Reason text
  - IP address (small text, forensic)
- Empty state: "No audit entries found" message

**Grouping utility**:
```typescript
function groupEntriesByDate(entries: AuditLogEntry[]): Map<string, AuditLogEntry[]> {
  // Groups by: 'today' | 'yesterday' | 'YYYY-MM-DD'
}
```

**Action verb mapping**:
```typescript
const ACTION_LABELS: Record<AuditAction, { label: string; badgeVariant: string }> = {
  role_changed: { label: 'changed role of', badgeVariant: 'warning' },
  permission_set_granted: { label: 'granted permission set to', badgeVariant: 'success' },
  permission_set_revoked: { label: 'revoked permission set from', badgeVariant: 'destructive' },
  member_added: { label: 'added member to project', badgeVariant: 'info' },
  member_removed: { label: 'removed member from project', badgeVariant: 'destructive' },
  member_updated: { label: 'updated member role in project', badgeVariant: 'warning' },
  user_suspended: { label: 'suspended user', badgeVariant: 'destructive' },
  user_activated: { label: 'activated user', badgeVariant: 'success' },
};
```

**Semantic HTML**:
```html
<section aria-label="Audit Timeline">
  <!-- Per date group -->
  <article>
    <h3>Today</h3>
    <ol> <!-- ordered list of events -->
      <li> <!-- each event -->
        <time>14:32</time>
        <span>Actor</span> <span>action</span> <span>Target</span>
        <dl> <!-- details as definition list -->
          <dt>Previous</dt><dd>company_admin</dd>
          <dt>New</dt><dd>internal_user</dd>
          <dt>Reason</dt><dd>...</dd>
        </dl>
      </li>
    </ol>
  </article>
</section>
```

---

### 2.3 `AuditFilters.tsx` — Filter Controls

**Path**: `src/app/admin/role-management/components/AuditFilters.tsx`

```typescript
// === IMPORTS ===
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';

// Auth types
import { AUDIT_ACTIONS } from '@/lib/auth/types';
```

**Props interface**:
```typescript
interface AuditFiltersProps {
  filters: AuditLogFilters;
  onFiltersChange: (filters: AuditLogFilters) => void;
  actors: Array<{ uid: string; displayName: string }>;   // For actor dropdown
  targets: Array<{ uid: string; displayName: string }>;   // For target dropdown
}
```

**Filter controls**:
1. **Date Range**: 2 date inputs (start + end) — native HTML `<input type="date">`
2. **Actor**: Radix Select — populated from fetched users
3. **Target**: Radix Select — populated from fetched users
4. **Action Type**: Radix Select — populated from `AUDIT_ACTIONS` constant
5. **Clear Filters**: Button to reset all

**Semantic**: `<form>` with `<fieldset>` + `<legend>` "Filters"

---

### 2.4 `AuditExport.tsx` — Export Dropdown

**Path**: `src/app/admin/role-management/components/AuditExport.tsx`

```typescript
// === IMPORTS ===
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// API
import { apiClient } from '@/lib/api/enterprise-api-client';
```

**Props interface**:
```typescript
interface AuditExportProps {
  filters: AuditLogFilters;   // Current filters → sent as export params
  disabled: boolean;           // Disable when no entries
}
```

**Behavior**:
- Dropdown button with 2 options: "Export CSV", "Export JSON"
- On click: Downloads file via API call
- CSV: `Content-Disposition: attachment; filename=audit-log-YYYY-MM-DD.csv`
- JSON: `Content-Disposition: attachment; filename=audit-log-YYYY-MM-DD.json`
- Uses `window.URL.createObjectURL()` for client-side download trigger

**API call**:
```typescript
// For CSV:
const response = await fetch('/api/admin/role-management/audit-log/export?' + params, {
  headers: { Authorization: `Bearer ${token}` }
});
const blob = await response.blob();
// Create download link...

// NOTE: Export endpoint is part of audit-log/route.ts (same file, separate handler)
// OR separate route: audit-log/export/route.ts
```

**Σημείωση**: Η export λειτουργία μπορεί να υλοποιηθεί ως:
- Option A: Ξεχωριστό route `audit-log/export/route.ts`
- Option B: Query param `?export=csv` στο existing `audit-log/route.ts`

Η απόφαση θα ληφθεί κατά την υλοποίηση. Recommendation: **Option A** (separation of concerns).

---

### 2.5 `ProjectMembersTab.tsx` — Project Members Tab Container

**Path**: `src/app/admin/role-management/components/ProjectMembersTab.tsx`

```typescript
// === IMPORTS ===
import { useState, useCallback, useEffect } from 'react';

// API
import { apiClient } from '@/lib/api/enterprise-api-client';

// UI
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

// Design System
import { useSpacingTokens } from '@/hooks/useSpacingTokens';

// Local Components
import { MemberTable } from './MemberTable';
import { AssignMemberDialog } from './AssignMemberDialog';

// Types
import type { ProjectMemberEntry, ProjectSummary } from '../types';
```

**State**:
```typescript
selectedProjectId: string | null
projects: ProjectSummary[]          // Fetched list of company projects
members: ProjectMemberEntry[]       // Members of selected project
isLoading: boolean
showAssignDialog: boolean
```

**Behavior**:
- Fetches projects list on mount: `apiClient.get('/api/projects')` (existing endpoint)
- On project select → fetches members via project-members API
- "Add Member" button opens `AssignMemberDialog`
- Semantic: `<section>` → `<header>` (project selector + add button) + `<MemberTable>`

**Project fetch**: Χρησιμοποιεί existing projects API (ΔΕΝ δημιουργείται νέο endpoint).

---

### 2.6 `MemberTable.tsx` — Project Members DataTable

**Path**: `src/app/admin/role-management/components/MemberTable.tsx`

```typescript
// === IMPORTS ===
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
```

**Props interface**:
```typescript
interface MemberTableProps {
  members: ProjectMemberEntry[];
  onEditMember: (member: ProjectMemberEntry) => void;
  onRemoveMember: (member: ProjectMemberEntry) => void;
}
```

**Columns** (from ADR-244 Section 9.5):
1. Avatar + Name
2. Project Role — Badge (role name)
3. Permission Sets — chips/badges for each set
4. Added By — who assigned this member
5. Date Added — formatted date
6. Actions — Edit role, Remove member

**Confirmation dialog pattern** (destructive actions only):
- **Edit member role** → ΟΧΙ extra confirmation (το dialog ήδη έχει reason + confirm)
- **Remove member** → `showConfirmDialog()` πριν την εκτέλεση + reason field (destructive action)

**Semantic**: Standard `<Table>` components, no div soup.

---

### 2.7 `AssignMemberDialog.tsx` — 3-Step Wizard

**Path**: `src/app/admin/role-management/components/AssignMemberDialog.tsx`

```typescript
// === IMPORTS ===
import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogFooter,
  DialogTitle, DialogDescription
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';

// API
import { apiClient } from '@/lib/api/enterprise-api-client';

// Auth
import { PREDEFINED_ROLES, getProjectRoles } from '@/lib/auth/roles';
import { PERMISSION_SETS, getAllPermissionSetIds, requiresMfaEnrollment } from '@/lib/auth/permission-sets';
import type { ProjectRole } from '@/lib/auth/types';
```

**Props interface**:
```typescript
interface AssignMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  existingMemberUids: string[];    // To exclude already-assigned users
  onSuccess: () => void;
}
```

**State**:
```typescript
step: 1 | 2 | 3                             // Wizard step
selectedUsers: CompanyUser[]                  // Step 1 selections
searchTerm: string                            // Step 1 search
availableUsers: CompanyUser[]                 // Fetched from users API
selectedRole: ProjectRole | null              // Step 2
selectedPermissionSets: string[]              // Step 2
reason: string                                // Step 3 — min 10 chars
isSubmitting: boolean
error: string | null
```

**3-Step Wizard** (AWS IAM Identity Center pattern):

**Step 1 — Select Users**:
- Search input with debounce
- Fetches company users via existing Phase A API: `GET /api/admin/role-management/users`
- Filters out `existingMemberUids`
- Multi-select checkboxes
- "Next →" button (disabled if no selection)

**Step 2 — Select Role & Permissions**:
- Project Role: Radix Select populated from `getProjectRoles()`
- Permission Sets: Checkbox list (same as PermissionSetManager from Phase A)
- MFA badges on relevant sets
- "← Back" + "Next →" buttons

**Step 3 — Review & Confirm**:
- Summary: "Adding N member(s) to [Project Name]"
- List each user → role + permission sets
- Reason textarea (required, min 10 chars)
- "← Back" + "Confirm" buttons

**API Call** (on confirm):
```typescript
// For each selected user:
await apiClient.post('/api/admin/role-management/project-members', {
  action: 'assign',
  projectId,
  uid: user.uid,
  roleId: selectedRole,
  permissionSetIds: selectedPermissionSets,
  reason,
});
```

**Dialog size**: `lg`

---

### 2.8 `audit-log/route.ts` — Audit Log Query API

**Path**: `src/app/api/admin/role-management/audit-log/route.ts`

```typescript
// === IMPORTS ===
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Middleware
import { withAuth } from '@/lib/auth/middleware';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';

// Auth
import { isRoleBypass } from '@/lib/auth/roles';
import type { AuthContext } from '@/lib/auth/types';
import type { PermissionCache } from '@/lib/auth/permissions';

// Firebase Admin
import { getAdminFirestore } from '@/lib/firebase/admin';

// Collections
import { COLLECTIONS } from '@/config/firestore-collections';
```

**Endpoint**: `GET /api/admin/role-management/audit-log`

**Query Parameters** (Zod validated):
```typescript
const AuditLogQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  actorId: z.string().optional(),
  targetId: z.string().optional(),
  action: z.string().optional(),           // AuditAction value
  limit: z.coerce.number().min(1).max(200).optional().default(50),
  cursor: z.string().optional(),
});
```

**Middleware pipeline**: `withSensitiveRateLimit(withAuth(handler, { requiredGlobalRoles: ['super_admin', 'company_admin'] }))`

> **Σημείωση**: Read-only endpoint — δέχεται και `company_admin` (Google Workspace pattern).
> Τα mutation endpoints (POST project-members) δέχονται ΜΟΝΟ `super_admin`.

**Implementation approach**:
1. Validate query params with Zod
2. Build Firestore query on `companies/{companyId}/audit_logs`
3. Apply filters: startDate/endDate (Timestamp range), actorId (`actor.uid`), targetId (`target.uid`), action
4. Order by `timestamp` DESC
5. Apply cursor (startAfter)
6. Limit results
7. Fetch actor/target display info from docs (already embedded in audit entries)
8. Return paginated response

**Response type**:
```typescript
interface AuditLogResponse {
  success: true;
  data: {
    entries: AuditLogEntry[];
    total: number;                  // Approximate count
    nextCursor: string | null;
    actors: Array<{ uid: string; displayName: string }>;   // For filter dropdowns
    targets: Array<{ uid: string; displayName: string }>;
  };
}
```

**Composite Indexes** (may need deployment):
```json
// firestore.indexes.json
{
  "collectionGroup": "audit_logs",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "timestamp", "order": "DESCENDING" }
  ]
}
```

**Σημείωση**: Η existing `audit_logs` subcollection ήδη γράφεται από `logRoleChange()` κλπ.
Ελέγξε κατά υλοποίηση αν η δομή ταιριάζει με `AuditLogEntry` type ή χρειάζεται mapping.

**Export variant** (αν Option A):

**Path**: `src/app/api/admin/role-management/audit-log/export/route.ts`

```typescript
// Same imports as audit-log/route.ts + streaming
import { withHeavyRateLimit } from '@/lib/middleware/with-rate-limit'; // Stricter: 2 req/min

const ExportQuerySchema = z.object({
  format: z.enum(['csv', 'json']),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});
```

**Behavior**:
- Max 90 days range per export
- Fetches ALL matching entries (up to 10,000)
- CSV: Headers + rows, proper escaping
- JSON: Array of entries
- Response headers: `Content-Type`, `Content-Disposition: attachment`
- Rate limit: `withHeavyRateLimit` (stricter than standard)

---

### 2.9 `project-members/route.ts` — Manage Project Members API

**Path**: `src/app/api/admin/role-management/project-members/route.ts`

```typescript
// === IMPORTS ===
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Middleware
import { withAuth } from '@/lib/auth/middleware';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';

// Auth
import { isRoleBypass } from '@/lib/auth/roles';
import { PREDEFINED_ROLES, getProjectRoles } from '@/lib/auth/roles';
import { PERMISSION_SETS, getAllPermissionSetIds } from '@/lib/auth/permission-sets';
import { logAuditEvent } from '@/lib/auth/audit';
import type { AuthContext } from '@/lib/auth/types';
import type { PermissionCache } from '@/lib/auth/permissions';

// Firebase Admin
import { getAdminFirestore } from '@/lib/firebase/admin';

// Collections
import { COLLECTIONS } from '@/config/firestore-collections';

// Enterprise ID
import { generateId } from '@/services/enterprise-id.service';
```

**Endpoint**: `POST /api/admin/role-management/project-members`

**Request Body** (Zod validated):
```typescript
const ProjectMemberRequestSchema = z.object({
  action: z.enum(['assign', 'update', 'remove']),
  projectId: z.string().min(1),
  uid: z.string().min(1),
  roleId: z.string().optional(),                    // Required for assign/update
  permissionSetIds: z.array(z.string()).optional(),  // Optional add-ons
  reason: z.string().min(10, 'Reason must be at least 10 characters'),
}).refine(
  (data) => {
    if (data.action === 'assign' || data.action === 'update') {
      return !!data.roleId;
    }
    return true;
  },
  { message: 'roleId is required for assign/update actions', path: ['roleId'] }
);
```

**Middleware pipeline**: `withSensitiveRateLimit(withAuth(handler, { requiredGlobalRoles: ['super_admin'] }))`

**Implementation — 3 actions**:

**Action: `assign`**
1. Verify project exists in `companies/{companyId}/projects/{projectId}`
2. Verify user exists and belongs to same company
3. Verify user NOT already a member of this project
4. Verify `roleId` is valid project role (`getProjectRoles()` check)
5. Verify all `permissionSetIds` are valid (`getAllPermissionSetIds()` check)
6. Create member doc: `companies/{cId}/projects/{pId}/members/{uid}`
   - Use `setDoc()` (UID as document ID — natural key, NOT auto-generated)
7. Audit log: `logAuditEvent(ctx, 'member_added', uid, 'user', { ... })`
8. Return success

**Action: `update`**
1. Verify member exists in project
2. Verify `roleId` is valid project role
3. Verify all `permissionSetIds` are valid
4. Update member doc with new role + permission sets
5. Audit log: `logAuditEvent(ctx, 'member_updated', uid, 'user', { previousRole, newRole, ... })`
6. Return success

**Action: `remove`**
1. Verify member exists in project
2. Delete member doc (or soft-delete with `status: 'removed'`)
3. Audit log: `logAuditEvent(ctx, 'member_removed', uid, 'user', { ... })`
4. Return success

**Response type**:
```typescript
interface ProjectMemberResponse {
  success: true;
  data: {
    action: 'assign' | 'update' | 'remove';
    projectId: string;
    uid: string;
    auditLogId: string;
  };
}
```

**Error responses**:
- 400: Invalid request body (Zod errors)
- 400: Invalid roleId (not a project role)
- 400: Invalid permissionSetId
- 403: Not super_admin
- 404: Project not found or not in same company
- 404: User not found or not in same company
- 409: User already a member (for assign)
- 409: User not a member (for update/remove)
- 429: Rate limited

**Security checks**:
- ✅ Rate limiting (withSensitiveRateLimit)
- ✅ Auth verification (withAuth)
- ✅ super_admin only (requiredGlobalRoles)
- ✅ Tenant isolation (project + user in same companyId)
- ✅ Input validation (Zod schema + refine)
- ✅ Audit trail (logAuditEvent for every action)
- ✅ Document ID: UID as natural key (setDoc, NOT addDoc)

**Member document structure**:
```typescript
interface ProjectMemberDocument {
  uid: string;
  roleId: string;                    // ProjectRole
  permissionSetIds: string[];
  addedBy: string;                   // Actor UID
  addedAt: Timestamp;                // Server timestamp
  updatedAt: Timestamp | null;
  status: 'active' | 'removed';
}
```

---

## 3. Modified Files

### 3.1 `page.tsx` — Activate Tabs 3-4

**Αλλαγή**: Remove "coming soon" placeholders, add real components

```typescript
// ADD IMPORTS:
import { AuditTab } from './components/AuditTab';
import { ProjectMembersTab } from './components/ProjectMembersTab';

// REPLACE placeholder TabsContent for 'audit' and 'projects':
// FROM: <TabsContent value="audit"><section>Coming soon...</section></TabsContent>
// TO:   <TabsContent value="audit"><AuditTab /></TabsContent>
```

### 3.2 `types.ts` — New Types for Phase B

**Προσθήκες**:

```typescript
// Audit types
export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: {
    uid: string;
    displayName: string;
    email: string;
    photoURL: string | null;
  };
  action: AuditAction;
  target: {
    uid: string;
    displayName: string;
    email: string;
  };
  details: {
    previousValue: string | null;
    newValue: string | null;
    reason: string;
    projectId: string | null;
    projectName: string | null;
    permissionSetId: string | null;
  };
  metadata: {
    ipAddress: string;
    userAgent: string;
    requestId: string;
  };
}

export type AuditAction =
  | 'role_changed'
  | 'permission_set_granted'
  | 'permission_set_revoked'
  | 'member_added'
  | 'member_removed'
  | 'member_updated'
  | 'user_suspended'
  | 'user_activated';

export interface AuditLogFilters {
  startDate: string | null;
  endDate: string | null;
  actorId: string | null;
  targetId: string | null;
  action: AuditAction | null;
}

// Project Members types
export interface ProjectSummary {
  id: string;
  name: string;
  memberCount: number;
}

export interface ProjectMemberEntry {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  roleId: string;
  roleName: string;
  permissionSetIds: string[];
  addedBy: string;
  addedByName: string;
  addedAt: string;
  status: 'active' | 'removed';
}
```

### 3.3 `src/lib/auth/audit.ts` — New Audit Wrappers

**Ελέγξε κατά υλοποίηση** αν αυτά ήδη υπάρχουν. Αν ΟΧΙ, πρόσθεσε:

```typescript
// New convenience wrappers for project member actions:
export function logMemberAdded(
  ctx: AuthContext,
  targetUid: string,
  projectId: string,
  projectName: string,
  roleId: string,
  reason?: string
): void { /* ... */ }

export function logMemberRemoved(
  ctx: AuthContext,
  targetUid: string,
  projectId: string,
  projectName: string,
  previousRole: string,
  reason?: string
): void { /* ... */ }

export function logMemberUpdated(
  ctx: AuthContext,
  targetUid: string,
  projectId: string,
  projectName: string,
  previousRole: string,
  newRole: string,
  reason?: string
): void { /* ... */ }

export function logPermissionSetGranted(
  ctx: AuthContext,
  targetUid: string,
  permissionSetId: string,
  reason?: string
): void { /* ... */ }

export function logPermissionSetRevoked(
  ctx: AuthContext,
  targetUid: string,
  permissionSetId: string,
  reason?: string
): void { /* ... */ }
```

**ΣΗΜΕΙΩΣΗ**: Η existing `audit.ts` ήδη έχει `logPermissionGranted` και `logPermissionRevoked`.
Ελέγξε αν αυτά αρκούν ή χρειάζονται νέες specific wrappers για project member context.

---

## 4. Anti-Duplicate Checklist (Phase B specific)

| Concern | Check | Resolution |
|---------|-------|------------|
| Date picker component | Native HTML `<input type="date">` | ΟΧΙ new DatePicker — keep simple |
| Export/Download utility | Check existing download utils | Reuse if exists, else minimal new |
| Project list fetching | Use existing projects API | ΟΧΙ νέο projects endpoint |
| Audit log reading | Read from existing `audit_logs` collection | ΟΧΙ νέα collection |
| Member document path | `companies/{cId}/projects/{pId}/members/{uid}` | Follow existing Firestore structure |
| Select component | `@/components/ui/select` ONLY | ADR-001 |
| Audit convenience functions | Check existing `audit.ts` | Extend, don't duplicate |

---

## 5. Firestore Queries & Indexes

### Audit Log Queries

**Primary query** (no filters):
```typescript
db.collection(`companies/${companyId}/audit_logs`)
  .orderBy('timestamp', 'desc')
  .limit(50)
```

**With date range**:
```typescript
.where('timestamp', '>=', startDate)
.where('timestamp', '<=', endDate)
.orderBy('timestamp', 'desc')
```

**With actor filter**:
```typescript
.where('actor.uid', '==', actorId)
.orderBy('timestamp', 'desc')
// REQUIRES composite index: actor.uid ASC + timestamp DESC
```

**With action filter**:
```typescript
.where('action', '==', actionType)
.orderBy('timestamp', 'desc')
// REQUIRES composite index: action ASC + timestamp DESC
```

### Required Composite Indexes

```json
// firestore.indexes.json — deploy with: firebase deploy --only firestore:indexes
[
  {
    "collectionGroup": "audit_logs",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "actor.uid", "order": "ASCENDING" },
      { "fieldPath": "timestamp", "order": "DESCENDING" }
    ]
  },
  {
    "collectionGroup": "audit_logs",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "target.uid", "order": "ASCENDING" },
      { "fieldPath": "timestamp", "order": "DESCENDING" }
    ]
  },
  {
    "collectionGroup": "audit_logs",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "action", "order": "ASCENDING" },
      { "fieldPath": "timestamp", "order": "DESCENDING" }
    ]
  }
]
```

**ΣΗΜΕΙΩΣΗ**: Αυτά τα indexes αφορούν subcollections κάτω από `companies/{cId}`.
Ελέγξε αν χρειάζεται `collectionGroup` query ή `COLLECTION` scope αρκεί.

---

## 6. i18n Keys Required (Phase B)

```json
// src/i18n/locales/en/admin.json — additions
{
  "roleManagement": {
    "auditTab": {
      "title": "Audit Log",
      "filters": {
        "legend": "Filters",
        "dateRange": "Date Range",
        "startDate": "From",
        "endDate": "To",
        "actor": "Changed by",
        "target": "Applied to",
        "action": "Action Type",
        "allActors": "All users",
        "allTargets": "All users",
        "allActions": "All actions",
        "clearFilters": "Clear Filters"
      },
      "export": {
        "button": "Export",
        "csv": "Export as CSV",
        "json": "Export as JSON"
      },
      "timeline": {
        "today": "Today",
        "yesterday": "Yesterday",
        "empty": "No audit entries found",
        "loadMore": "Load More",
        "showing": "Showing {{count}} entries",
        "reason": "Reason",
        "previousValue": "Previous",
        "newValue": "New"
      },
      "actions": {
        "role_changed": "changed role of",
        "permission_set_granted": "granted permission set to",
        "permission_set_revoked": "revoked permission set from",
        "member_added": "added member to project",
        "member_removed": "removed member from project",
        "member_updated": "updated member role in project",
        "user_suspended": "suspended user",
        "user_activated": "activated user"
      }
    },
    "projectMembers": {
      "title": "Project Members",
      "selectProject": "Select a project",
      "searchProjects": "Search projects...",
      "addMember": "Add Member",
      "noProject": "Select a project to view its members",
      "noMembers": "No members assigned to this project",
      "table": {
        "member": "Member",
        "role": "Role",
        "permissionSets": "Permission Sets",
        "addedBy": "Added By",
        "dateAdded": "Date Added",
        "actions": "Actions"
      },
      "assign": {
        "title": "Add Member to Project",
        "step1": "Select Users",
        "step2": "Select Role & Permissions",
        "step3": "Review & Confirm",
        "searchUsers": "Search by name or email...",
        "selectRole": "Project Role",
        "permissionSets": "Permission Sets (optional)",
        "review": "Adding {{count}} member(s) to \"{{project}}\"",
        "reason": "Reason",
        "reasonPlaceholder": "Explain why these members are being added...",
        "back": "Back",
        "next": "Next",
        "confirm": "Confirm",
        "success": "Member(s) added successfully"
      },
      "remove": {
        "title": "Remove Member",
        "confirm": "Are you sure you want to remove {{name}} from this project?",
        "reason": "Reason for removal",
        "success": "Member removed successfully"
      },
      "edit": {
        "title": "Edit Member Role",
        "success": "Member role updated successfully"
      }
    }
  }
}
```

Greek equivalents in `el/admin.json`.

---

## 7. Testing Approach (Verification — Phase B)

1. **TypeScript compilation**: `npx tsc --noEmit` (background)
2. **Manual testing — Audit Tab**:
   - Navigate to `/admin/role-management` → Audit Log tab
   - Verify timeline renders existing audit entries
   - Test filters (date range, actor, target, action)
   - Test CSV + JSON export
   - Test linked actors (click actor → filter auto-populates)
3. **Manual testing — Project Members Tab**:
   - Select project → verify members load
   - Add member (3-step wizard) → verify audit entry created
   - Update member role → verify audit entry
   - Remove member → verify audit entry
4. **Security testing**:
   - Non-super_admin → 403 on all endpoints
   - Cross-company member assignment → rejected

---

## 8. Dependencies on Phase A

Τα ακόλουθα components/endpoints από Phase A **ΠΡΕΠΕΙ** να υπάρχουν:

| Dependency | Used By (Phase B) | Purpose |
|------------|-------------------|---------|
| `page.tsx` (tab shell) | Τροποποιείται | Activate tabs 3-4 |
| `types.ts` (shared types) | Τροποποιείται | Add audit + member types |
| `GET /api/admin/role-management/users` | AssignMemberDialog Step 1 | Fetch available users |
| `UserTable` pattern | MemberTable | Same table pattern |
| `RoleChangeDialog` pattern | AssignMemberDialog | Same dialog + form pattern |
| `PermissionSetManager` | AssignMemberDialog Step 2 | Same checkbox list pattern |

---

*End of Phase B Specification*
