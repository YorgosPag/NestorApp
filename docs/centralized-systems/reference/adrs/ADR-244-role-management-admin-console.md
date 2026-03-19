# ADR-244: Role Management Admin Console

| Metadata | Value |
|----------|-------|
| **Status** | IMPLEMENTED (Phase A + Phase B) |
| **Date** | 2026-03-19 |
| **Category** | Security & Auth |
| **Planned Location** | `src/app/admin/role-management/page.tsx` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |
| **Related ADRs** | ADR-020 (Centralized Auth), ADR-024 (Environment Security), ADR-063 (Company Isolation), ADR-068 (Rate Limiting) |

---

## Summary

Σχεδιασμός ολοκληρωμένου Role Management Admin Console για τη διαχείριση RBAC (Role-Based Access Control) μέσα από γραφικό περιβάλλον. Το ADR τεκμηριώνει την **έρευνα αρχιτεκτονικής**, τα ευρήματα, και το σχέδιο υλοποίησης.

**ΣΗΜΕΙΩΣΗ**: Αυτό είναι ADR τεκμηρίωσης/έρευνας — η υλοποίηση θα γίνει σε μελλοντικό phase.

---

## 1. Context

### 1.1 Τρέχουσα Κατάσταση Auth System

Η εφαρμογή διαθέτει **ολοκληρωμένο RBAC σύστημα** (RFC v6) με:

| Component | Location | Status |
|-----------|----------|--------|
| **Types & Registry** | `src/lib/auth/types.ts` | ✅ Implemented — 65+ permissions, 4 global roles, 9 project roles |
| **Role Definitions** | `src/lib/auth/roles.ts` | ✅ Implemented — 11 predefined roles, hierarchy levels 0-6 |
| **Permission Sets** | `src/lib/auth/permission-sets.ts` | ✅ Implemented — 9 add-on sets (MFA-gated) |
| **Permission Checker** | `src/lib/auth/permissions.ts` | ✅ Implemented — Server-side, request-scoped cache |
| **Audit Logging** | `src/lib/auth/audit.ts` | ✅ Implemented — Full audit trail in Firestore |
| **Claims Repair UI** | `src/app/admin/users/claims-repair/page.tsx` | ✅ Implemented — Super admin only |

### 1.2 Τι Λείπει

| Gap | Impact | Priority |
|-----|--------|----------|
| **Admin Console UI** | Ο Γιώργος πρέπει να χρησιμοποιεί Claims Repair UI ή Firebase Console | HIGH |
| **User Role Assignment** | Δεν υπάρχει γραφικό UI για αλλαγή global roles | HIGH |
| **Project Member Management** | Δεν υπάρχει UI για assign/remove project members | MEDIUM |
| **Permission Set Assignment** | Δεν υπάρχει UI για manage permission sets per user | MEDIUM |
| **Audit Log Viewer** | Δεν υπάρχει UI για view audit trail | LOW |
| **Role Matrix Visualization** | Δεν υπάρχει overview ποιος έχει τι | LOW |

### 1.3 Αρχιτεκτονικά Constraints

1. **Firebase Custom Claims**: Τα global roles αποθηκεύονται στα claims (max 1000 bytes) — αλλαγή απαιτεί Admin SDK (server-side only)
2. **Tenant Isolation**: Κάθε operation πρέπει να φιλτράρει κατά `companyId` (ADR-063)
3. **Audit Trail**: Κάθε role/permission αλλαγή ΠΡΕΠΕΙ να καταγράφεται (compliance)
4. **Super Admin Only**: Μόνο `super_admin` role μπορεί να διαχειριστεί ρόλους
5. **Rate Limiting**: Τα admin API endpoints ΠΡΕΠΕΙ να έχουν `withSensitiveRateLimit` (ADR-068)
6. **Enterprise ID**: Τα documents ΠΡΕΠΕΙ να δημιουργούνται με `enterprise-id.service.ts` (ADR-017)

---

## 2. Decision

### 2.1 Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│              Role Management Admin Console            │
│                 /admin/role-management                 │
├─────────────────────────────────────────────────────┤
│                                                       │
│  ┌─── Tab 1: Users ──────────────────────────────┐  │
│  │  • List all company users                      │  │
│  │  • View current global role + project roles    │  │
│  │  • Change global role (dropdown)               │  │
│  │  • Assign/remove permission sets               │  │
│  └───────────────────────────────────────────────┘  │
│                                                       │
│  ┌─── Tab 2: Roles & Permissions ────────────────┐  │
│  │  • Role matrix (role × permission grid)        │  │
│  │  • Permission set details                      │  │
│  │  • Read-only (roles are predefined)            │  │
│  └───────────────────────────────────────────────┘  │
│                                                       │
│  ┌─── Tab 3: Audit Log ─────────────────────────┐  │
│  │  • Timeline of role/permission changes         │  │
│  │  • Filter by user, action, date               │  │
│  │  • Exportable (CSV/JSON)                       │  │
│  └───────────────────────────────────────────────┘  │
│                                                       │
│  ┌─── Tab 4: Project Members ────────────────────┐  │
│  │  • Select project → view members               │  │
│  │  • Assign project roles                        │  │
│  │  • Manage permission sets per member            │  │
│  └───────────────────────────────────────────────┘  │
│                                                       │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│                   API Layer                            │
│                                                       │
│  POST /api/admin/role-management/users                │
│  PATCH /api/admin/role-management/users/:uid/role     │
│  POST /api/admin/role-management/project-members      │
│  GET  /api/admin/role-management/audit-log             │
│                                                       │
│  Middleware: withAuth + withSensitiveRateLimit         │
│  All operations: Audit logged                          │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│                 Data Layer                              │
│                                                       │
│  Firebase Auth (Custom Claims) ← Global Roles          │
│  Firestore /companies/{cId}/                           │
│    ├── members/{uid}         ← Company Users           │
│    ├── projects/{pId}/                                 │
│    │   └── members/{uid}     ← Project Roles           │
│    └── audit_logs/{autoId}   ← Audit Trail             │
│                                                       │
└─────────────────────────────────────────────────────┘
```

### 2.2 Existing Auth Infrastructure (Source of Truth)

#### Global Roles (Custom Claims)

```typescript
// src/lib/auth/types.ts
export const GLOBAL_ROLES = [
  'super_admin',     // Level 0 — Break-glass, system-wide access
  'company_admin',   // Level 1 — Company management
  'internal_user',   // Level 2 — Internal staff
  'external_user',   // Level 3 — Customers, partners
] as const;
```

#### Project Roles (Firestore)

```typescript
// src/lib/auth/types.ts
export type ProjectRole =
  | 'project_manager'  // Level 2
  | 'architect'        // Level 3
  | 'engineer'         // Level 3
  | 'site_manager'     // Level 4
  | 'accountant'       // Level 4
  | 'sales_agent'      // Level 4
  | 'data_entry'       // Level 5
  | 'viewer'           // Level 6
  | 'vendor';          // Level 5
```

#### Permission Registry (65+ permissions)

Pattern: `domain:resource:action`

| Domain | Permissions Count |
|--------|------------------|
| Communications (`comm:`) | 6 |
| Projects (`projects:`) | 8 |
| Units (`units:`) | 4 |
| Buildings (`buildings:`) | 4 |
| DXF (`dxf:`) | 5 |
| CRM (`crm:`) | 10 |
| Finance (`finance:`) | 3 |
| Legal (`legal:`) | 7 |
| Admin (`admin:`) | 5 |
| Others | 13+ |

#### Permission Sets (Add-on Bundles)

| Set ID | Name | MFA Required |
|--------|------|-------------|
| `dxf_editor` | DXF Editor | No |
| `dxf_uploader` | DXF Upload Only | No |
| `finance_approver` | Finance Approver | **Yes** |
| `legal_viewer` | Legal Viewer | **Yes** |
| `legal_manager` | Legal Manager | **Yes** |
| `crm_exporter` | CRM Export | No |
| `comm_staff` | Communications Staff | No |
| `listing_publisher` | Listing Publisher | No |
| `report_creator` | Report Creator | No |

### 2.3 API Endpoints Design

#### `GET /api/admin/role-management/users`

Λίστα όλων των χρηστών εταιρείας με τα roles τους.

```typescript
// Response
interface UserListResponse {
  users: Array<{
    uid: string;
    email: string;
    displayName: string | null;
    photoURL: string | null;          // Avatar (Google/Clerk pattern)
    globalRole: GlobalRole;
    status: 'active' | 'suspended';  // Salesforce/Okta pattern
    mfaEnrolled: boolean;
    lastSignIn: string | null;
    projectCount: number;             // Quick reference count
    projectMemberships: Array<{
      projectId: string;
      projectName: string;
      roleId: string;
      permissionSetIds: string[];
    }>;
  }>;
  total: number;
  nextCursor: string | null;          // Cursor-based pagination (AWS/Auth0 pattern)
}

// Query params
interface UserListQuery {
  search?: string;       // Search-as-you-type (Google IAM pattern)
  globalRole?: string;   // Filter by role
  status?: string;       // Filter by status
  sortBy?: 'name' | 'email' | 'lastSignIn' | 'globalRole';  // Sortable columns (Salesforce)
  sortOrder?: 'asc' | 'desc';
  limit?: number;        // Default 25, max 100
  cursor?: string;       // Cursor-based pagination
}
```

**Implementation Notes**:
- Χρήση Firebase Admin SDK `auth().listUsers()` + Firestore company members
- Φιλτράρισμα κατά `companyId` (tenant isolation)
- Cursor-based pagination (AWS/Auth0 enterprise pattern — NOT offset-based)
- Search-as-you-type: Server-side filtering by `displayName` ή `email` (Google IAM pattern)
- Sortable columns: Client-side sort for loaded page, server-side for cross-page (Salesforce pattern)

#### `PATCH /api/admin/role-management/users/:uid/role`

Αλλαγή global role χρήστη (Google IAM "Grant Access" + Microsoft Entra "Self-Protection" pattern).

```typescript
// Request
interface ChangeRoleRequest {
  newRole: GlobalRole;
  reason: string;  // Υποχρεωτικό για audit (Okta/Salesforce compliance pattern)
}

// Response
interface ChangeRoleResponse {
  success: boolean;
  previousRole: GlobalRole;
  newRole: GlobalRole;
  requiresReLogin: true;  // Firebase Custom Claims constraint
  auditLogId: string;     // Reference to audit entry
}

// Implementation — Enterprise Middleware Stack (Google/AWS/Salesforce level)
// ┌─────────────────────────────────────────────────────────┐
// │ Request → Rate Limiter → Auth → Role Check →            │
// │ Tenant Isolation → Self-Protection → Handler → Audit    │
// └─────────────────────────────────────────────────────────┘
//
// 1. Rate Limiter: withSensitiveRateLimit (10 req/min)
// 2. Auth Verification: withAuth — verified Firebase token
// 3. Role Check: caller must be super_admin
// 4. Tenant Isolation: target user belongs to same companyId
// 5. Self-Protection: cannot demote self (Microsoft Entra pattern — prevent lockout)
// 6. Handler: Update Firebase Custom Claims via Admin SDK
// 7. Audit Log: logRoleChange(ctx, targetUid, oldRole, newRole, reason)
// 8. Return: success + requiresReLogin flag (Firebase claims propagate on next token refresh)
```

#### `POST /api/admin/role-management/project-members`

Manage project member roles.

```typescript
// Request
interface ProjectMemberRequest {
  action: 'assign' | 'update' | 'remove';
  projectId: string;
  uid: string;
  roleId?: string;           // Required for assign/update
  permissionSetIds?: string[]; // Optional add-ons
  reason: string;
}
```

#### `GET /api/admin/role-management/audit-log`

Ανάκτηση audit trail (enterpriseready.io / Google / Zendesk enterprise standard).

```typescript
// Query params
interface AuditLogQuery {
  startDate?: string;    // ISO 8601
  endDate?: string;
  actorId?: string;      // Linked actor filter (enterpriseready.io pattern)
  targetId?: string;
  action?: AuditAction;
  limit?: number;        // Default 50, max 200
  cursor?: string;       // Cursor-based pagination
  format?: 'json';       // Response format (CSV export handled separately)
}

// Response — Enterprise Audit Entry
interface AuditLogEntry {
  id: string;
  timestamp: string;          // Server time (NTP synced)
  actor: {                    // Ποιος έκανε την αλλαγή
    uid: string;
    displayName: string;
    email: string;
    photoURL: string | null;  // Avatar for timeline view
  };
  action: AuditAction;        // Verb: role_changed, permission_granted, member_added, κλπ
  target: {                    // Ποιον/τι αφορά
    uid: string;
    displayName: string;
    email: string;
  };
  details: {
    previousValue: string | null;  // Τι ήταν πριν
    newValue: string | null;       // Τι έγινε μετά
    reason: string;                // Γιατί (compliance)
    projectId?: string;            // Αν αφορά project-scoped αλλαγή
  };
  metadata: {
    ipAddress: string;             // Location tracking (enterprise compliance)
    userAgent: string;
  };
}

// Export endpoint (separate for SIEM integration — Splunk/Datadog)
// GET /api/admin/role-management/audit-log/export?format=csv&startDate=...&endDate=...
```

### 2.4 UI Components Design (Enterprise-Grade — Google/Salesforce/Okta Level)

#### Tab 1: Users Management (Google Workspace Admin Console Pattern)

**Table Columns** (Google Workspace + Salesforce + Okta best practices):

| # | Column | Component | Enterprise Source |
|---|--------|-----------|-------------------|
| 1 | Avatar + Name | `Avatar` + text | Google Workspace, Clerk |
| 2 | Email | text | Universal |
| 3 | Global Role | `Badge` (color-coded) | Google IAM, Okta — `super_admin`=red, `company_admin`=blue, `internal_user`=green, `external_user`=gray |
| 4 | Status | `Badge` (variant) | Salesforce, Okta — Active/Suspended/Pending |
| 5 | MFA Status | icon badge | Auth0, Okta — Shield icon: enrolled=green, not=orange |
| 6 | Project Count | number | Custom — Quick reference |
| 7 | Last Sign-In | relative date | Google Workspace, Salesforce |
| 8 | Actions | dropdown menu | Universal — Edit role, View details, Suspend |

**Enterprise UX patterns**:
- **Search-as-you-type** input στο header (Google IAM pattern)
- **Sortable columns** — click header to sort (Salesforce pattern)
- **Cursor-based pagination** — "Load more" button (AWS/Auth0 pattern)
- **Bulk actions** — multi-select checkbox + bulk role change (Salesforce/Google Workspace)
- **Expandable row** — click row → `UserDetailPanel` slides open (Google Workspace pattern)

| Component | Description |
|-----------|-------------|
| `UserTable` | DataTable με 8 columns (βλ. πίνακα πάνω), search, sort, pagination |
| `RoleChangeDialog` | **Google IAM "Grant Access" 4-step pattern**: 1) Select user, 2) Select role (Radix Select with descriptions), 3) Add reason (audit compliance), 4) Confirm + warning "User must re-login" |
| `PermissionSetManager` | Checkbox list of permission sets + MFA badge per set (Salesforce Permission Set pattern) |
| `UserDetailPanel` | Expandable panel: full permission breakdown, project memberships, login history |

#### Tab 2: Role Matrix (Read-Only — Google IAM permissions.cloud Pattern)

| Component | Description |
|-----------|-------------|
| `RolePermissionMatrix` | **Role × Permission Grid** (Google IAM permissions.cloud): Rows = roles (13 total), Columns = permission domains (collapsible groups: comm, projects, dxf, crm, finance, legal, admin), Cells = ✅/❌ checkmarks |
| `PermissionSetCard` | **Salesforce Permission Set Card pattern**: Card per set — name, description, included permissions list, MFA badge (if `requiresMfaEnrolled`), user count badge |
| `RoleHierarchyDiagram` | **Google Workspace hierarchy visualization**: Visual tree with level numbers: super_admin(L0) → company_admin(L1) → project_manager(L2) → architect/engineer(L3) → site_manager/accountant(L4) → data_entry/vendor(L5) → viewer(L6) |

#### Tab 3: Audit Log (enterpriseready.io / Google / Zendesk Level)

| Component | Description |
|-----------|-------------|
| `AuditTimeline` | **Timeline view** (not just table) — scannable recent activity with avatar, action verb, target, timestamp. Linked actors: click actor → filter by that user (enterpriseready.io pattern) |
| `AuditFilters` | Date range picker, actor select, target select, action type multi-select (Google Cloud Audit pattern) |
| `AuditExport` | Export as **CSV** (human-readable) + **JSON** (SIEM integration: Splunk/Datadog) |

**Enterprise audit log principles** (enterpriseready.io):
- **Append-only**: Logs are immutable — never deleted or modified
- **Linked actors**: Click on actor name → filter all actions by that user
- **Previous/New value**: Every change shows before/after state
- **IP tracking**: For compliance and forensics

#### Tab 4: Project Members (AWS IAM Identity Center 3-Step Wizard Pattern)

| Component | Description |
|-----------|-------------|
| `ProjectSelector` | Radix Select (ADR-001) with project list, search-as-you-type |
| `MemberTable` | DataTable: Avatar+Name, Project Role (badge), Permission Sets (chips), Added By, Date Added, Actions |
| `AssignMemberDialog` | **AWS 3-step wizard**: Step 1 — Select users (multi-select with search), Step 2 — Select role + permission sets, Step 3 — Review & Submit (with reason for audit) |

### 2.5 Security Requirements

| Requirement | Implementation |
|-------------|---------------|
| **Authentication** | `withAuth` middleware — verified Firebase token |
| **Authorization** | `super_admin` only — `isRoleBypass(ctx.globalRole)` |
| **Tenant Isolation** | All queries filtered by `ctx.companyId` |
| **Rate Limiting** | `withSensitiveRateLimit` (10 req/min) |
| **Audit Trail** | Every mutation logged via `src/lib/auth/audit.ts` |
| **MFA Gating** | Permission sets with `requiresMfaEnrolled` shown with badge |
| **Self-Protection** | Cannot demote own role (prevent lockout) |
| **Input Validation** | Zod schemas for all request bodies |
| **CSRF Protection** | Server-side validation of origin header |

---

## 3. Existing Admin Pages (Reference Architecture)

Η εφαρμογή ήδη έχει admin pages που ακολουθούν consistent patterns:

| Page | Path | Purpose |
|------|------|---------|
| Claims Repair | `/admin/users/claims-repair` | Fix missing claims |
| AI Inbox | `/admin/ai-inbox` | AI-classified email inbox |
| Operator Inbox | `/admin/operator-inbox` | Manual email triage |
| Database Update | `/admin/database-update` | Data migration tools |
| Enterprise Migration | `/admin/enterprise-migration` | Schema migration |
| Search Backfill | `/admin/search-backfill` | Search index rebuild |
| Setup | `/admin/setup` | Initial system setup |

**Common Patterns** (to follow):
- `'use client'` with `useAuth()` hook
- `apiClient` for authenticated API calls (enterprise-api-client)
- Radix Select (ADR-001) for dropdowns
- `useTranslation()` for i18n
- `useSpacingTokens()` + `useLayoutClasses()` for design system
- Semantic HTML (`<main>`, `<section>`, `<form>`)
- Error boundaries via `error.tsx`

---

## 4. Implementation Phases

### Phase 1: Users Tab + Core API (MVP)

**Scope**: List users, view roles, change global role

**Files to Create**:
```
src/app/admin/role-management/
├── page.tsx                         # Main page with tabs
├── error.tsx                        # Error boundary
├── components/
│   ├── UserTable.tsx                # User list with roles
│   ├── RoleChangeDialog.tsx         # Modal for role change
│   └── UserDetailPanel.tsx          # Expanded user details

src/app/api/admin/role-management/
├── users/route.ts                   # GET: list users
└── users/[uid]/role/route.ts        # PATCH: change role
```

**Estimated Complexity**: Medium (leverages existing auth infrastructure heavily)

### Phase 2: Role Matrix + Permission Sets

**Scope**: Read-only role visualization, permission set assignment

**Additional Files**:
```
src/app/admin/role-management/components/
├── RolePermissionMatrix.tsx         # Role × Permission grid
├── PermissionSetManager.tsx         # Assign/remove sets
└── PermissionSetCard.tsx            # Set details card
```

### Phase 3: Audit Log Viewer

**Scope**: View and filter audit trail

**Additional Files**:
```
src/app/admin/role-management/components/
├── AuditTimeline.tsx                # Timeline UI
├── AuditFilters.tsx                 # Filter controls
└── AuditExport.tsx                  # CSV/JSON export

src/app/api/admin/role-management/
└── audit-log/route.ts               # GET: query audit logs
```

### Phase 4: Project Member Management

**Scope**: Assign users to projects, manage project roles

**Additional Files**:
```
src/app/admin/role-management/components/
├── ProjectMemberTab.tsx             # Project member management
├── AssignMemberDialog.tsx           # Add member to project
└── ProjectSelector.tsx              # Project dropdown

src/app/api/admin/role-management/
└── project-members/route.ts         # POST: manage members
```

---

## 5. Alternatives Considered

### Option A: Extend Claims Repair Page
**Rejected**: Claims Repair is a debug tool, not a management UI. Different UX requirements.

### Option B: Firebase Console Only
**Rejected**: Requires Firebase access, not user-friendly, no tenant isolation, no audit trail.

### Option C: Third-Party Admin Panel (e.g., AdminJS, Retool)
**Rejected**: License concerns (CLAUDE.md N.5), external dependency, doesn't leverage existing auth infrastructure.

### Option D (Selected): Custom Admin Console
**Why**: Full control, leverages existing RBAC infrastructure, consistent with existing admin pages, proper audit trail, tenant-isolated.

---

## 6. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Custom Claims size limit (1000 bytes) | Only store `globalRole` + `companyId` in claims. Fine-grained permissions in Firestore |
| User must re-login after role change | Display warning in UI. Consider future: force token refresh via Cloud Function |
| Super admin lockout (demotes self) | Prevent self-demotion in API validation |
| Stale permission cache | Use request-scoped cache (already implemented in `permissions.ts`) |
| Performance with many users | Cursor-based pagination, limit 50 per page |

---

## 7. Changelog

| Date | Version | Change |
|------|---------|--------|
| 2026-03-19 | 1.0.0 | Initial research and architecture ADR created |
| 2026-03-19 | 1.1.0 | Enterprise research findings — Google/AWS/Microsoft/Salesforce/Okta/Auth0/Clerk patterns |
| 2026-03-19 | 1.2.0 | Added Suspend/Reactivate endpoint (Google Workspace pattern). Removed `pending_invitation` status — no invitation system exists. User status derived from Firebase Auth `disabled` field. |
| 2026-03-19 | 1.3.0 | Access control: `company_admin` gets read-only access (Google Workspace pattern). Read endpoints accept both `super_admin` + `company_admin`. Mutation endpoints remain `super_admin` only. UI hides action buttons for `company_admin`. |
| 2026-03-19 | 1.4.0 | Simplified to single-fetch (no pagination) — <200 users expected. All filtering, sorting, search done client-side. Removed cursor-based pagination, server-side sorting, query params from GET users endpoint. |
| 2026-03-19 | 1.5.0 | **Data model change**: Created `companies/{cId}/members/{uid}` subcollection (Google Workspace pattern). Profile data stays in `users/{uid}`, RBAC data moves to subcollection. One-time bootstrap migration endpoint added. Only 2 test users — trivial migration. |
| 2026-03-19 | 1.6.0 | **Source of Truth**: `companies/{cId}/members/{uid}.globalRole` is SSoT. Firebase claims = sync copy. `users/{uid}.globalRole` removed (no duplicate). Role change = atomic dual-write (Firestore + claims). |
| 2026-03-19 | 1.7.0 | **2-scope permission sets** (Google pattern): Org-level (`companies/{cId}/members/{uid}.permissionSetIds`) applies to ALL projects. Project-level (`projects/{pId}/members/{uid}.permissionSetIds`) applies to ONE project. New endpoint: `PATCH /users/:uid/permission-sets` for org-level. |
| 2026-03-19 | 2.0.0 | **Phase A IMPLEMENTED**: 19 new files created. Page shell (4 tabs), Users tab (table + search + filters + RoleChangeDialog + PermissionSetManager + UserDetailPanel), Roles tab (RolePermissionMatrix + PermissionSetCards + RoleHierarchyDiagram), 5 API endpoints (GET users, PATCH role, PATCH status, PATCH permission-sets, POST bootstrap), CompanyMemberDocument type, i18n keys (en+el), navigation entry. Tabs 3-4 placeholder (Phase B). |
| 2026-03-19 | 3.0.0 | **Phase B IMPLEMENTED**: Audit Log Tab + Project Members Tab. **Audit Log**: GET audit-log (cursor-based pagination + filters), GET audit-log/export (CSV/JSON download, super_admin only), AuditTab, AuditTimeline (grouped by date, clickable actors/targets), AuditFilters, AuditExport. **Project Members**: GET/POST project-members (list/assign/update/remove), ProjectMembersTab (project selector + member table), MemberTable, AssignMemberDialog (3-step wizard). **Data model**: 3 new audit actions (member_added, member_removed, member_updated), new AuditChangeValue type 'project_member'. i18n keys (en+el) for both tabs. 10 new files, 5 modified. |

---

## 8. Industry Research — Enterprise RBAC Patterns

Αναλυτική έρευνα από 9 enterprise πλατφόρμες για τον τρόπο που χειρίζονται role management, UI patterns, backend API, και audit logging.

### 8.1 Google Cloud IAM

**UI Patterns**:
- **Console UI**: IAM & Admin page — πίνακας principals με roles, "Grant Access" button
- **Grant Access Workflow**: 3-step dialog — Select principal (email search) → Select role (searchable dropdown with role descriptions & categories) → Review & Save
- **Edit Permissions Pane**: Inline edit role στο table row, "Add another role" button, delete icon per role
- **permissions.cloud**: Community-built Role × Permission grid — rows = roles, columns = permissions grouped by service

**Backend Patterns**:
- REST API: `setIamPolicy()`, `getIamPolicy()`, `testIamPermissions()`
- Policy model: `{bindings: [{role, members, condition}]}`
- Conditional role bindings (time-based, resource-based)

**Takeaways για εμάς**:
- ✅ Searchable role dropdown με descriptions → RoleChangeDialog
- ✅ Role × Permission grid → RolePermissionMatrix
- ✅ Inline edit pattern → UserTable actions

### 8.2 Google Workspace Admin Console

**UI Patterns**:
- **Admin Roles page**: List of pre-built roles (Super Admin, Groups Admin, User Management Admin, κλπ)
- **Custom Roles**: Create role → name + description → select privileges from categorized list
- **Privilege Categories**: Collapsible groups (Organization Units, Users, Groups, Security, κλπ)
- **User list**: Avatar + Name + Email + Role + Status + Last sign-in + Actions

**Backend Patterns**:
- Directory API: `admin.roles.list()`, `admin.roleAssignments.insert()`
- Pre-built roles immutable, custom roles editable
- Role hierarchy: Super Admin > delegated admin roles > user roles

**Takeaways για εμάς**:
- ✅ User table columns (Avatar, Name, Email, Role, Status, Last sign-in) → UserTable
- ✅ Collapsible privilege categories → RolePermissionMatrix domain groups
- ✅ Role hierarchy visualization → RoleHierarchyDiagram

### 8.3 Microsoft Entra ID (Azure AD)

**UI Patterns**:
- **Role Assignment**: 3-scope system — tenant-wide / application-scoped / admin-unit-scoped
- **Privileged Identity Management (PIM)**: "Eligible" roles (just-in-time activation, time-limited)
- **Self-Protection**: Cannot remove own Global Administrator role (prevent lockout)
- **Justification field**: Required for role activation (audit compliance)

**Backend Patterns**:
- Microsoft Graph API: `POST /roleManagement/directory/roleAssignments`
- Scoped assignments: `directoryScopeId` determines scope
- PIM: eligible vs active assignments, approval workflows

**Takeaways για εμάς**:
- ✅ Self-protection rule → Cannot demote own role (already in our design)
- ✅ Justification/reason field → Required in ChangeRoleRequest (audit compliance)
- ✅ Scoped roles concept → Global roles vs Project-scoped roles (already in our model)

### 8.4 AWS IAM Identity Center

**UI Patterns**:
- **3-Step Assignment Wizard**: Step 1 → Select Users/Groups, Step 2 → Select AWS Accounts, Step 3 → Select Permission Sets → Review & Submit
- **Permission Sets**: Bundles of policies, assignable to users per account
- **Group-based assignment**: Assign roles to groups, not individual users (best practice)

**Backend Patterns**:
- `CreateAccountAssignment()` API
- Permission sets = policy bundles (analogous to our PermissionSets)
- Multi-account model (analogous to our multi-company/multi-project)

**Takeaways για εμάς**:
- ✅ 3-step wizard pattern → AssignMemberDialog (Select users → Select role+permissions → Review)
- ✅ Permission Set bundling → Already in our model (`permissionSetIds` in ProjectMember)
- ✅ Cursor-based pagination → Already planned

### 8.5 Auth0 Dashboard

**UI Patterns**:
- **Roles page**: CRUD interface — create role, assign permissions, assign to users
- **Permissions tab per role**: Checkbox grid of available permissions
- **Users tab per role**: List of users with this role, "Assign Users" button
- **MFA indicator**: Badge showing MFA enrollment status

**Backend Patterns**:
- Management API: `POST /api/v2/roles`, `POST /api/v2/roles/{id}/permissions`
- Pagination: cursor-based (`page`, `per_page`, `include_totals`)
- Rate limiting: Management API has strict rate limits per tier

**Takeaways για εμάς**:
- ✅ MFA enrollment badge per user → UserTable MFA column
- ✅ Permissions checkbox per role → PermissionSetManager
- ✅ Strict rate limiting on management APIs → withSensitiveRateLimit

### 8.6 Okta Admin Console

**UI Patterns**:
- **Custom Admin Roles**: 3-element model — Admin (user) + Role (set of permissions) + Resource Set (scope)
- **Resource Sets**: Define which resources (apps, groups, users) a role can manage
- **Scalability**: Max 100 custom roles, 10,000 resource sets per org
- **Delegated administration**: Admin can only manage resources in their scope

**Backend Patterns**:
- `POST /api/v1/iam/roles` — create custom role
- `POST /api/v1/iam/resource-sets` — create resource set
- `POST /api/v1/iam/roles/{roleId}/bindings` — bind role to resource set for admin

**Takeaways για εμάς**:
- ✅ 3-element model reference → Scalable architecture for future custom roles
- ✅ Resource set concept → Could map to project-scoped permissions
- ℹ️ Scalability limits noted for future reference

### 8.7 Salesforce

**UI Patterns**:
- **Profiles + Permission Sets + Permission Set Groups**: Layered permission model
- **Permission Set Groups**: Bundle multiple permission sets into one assignable unit
- **Muting Permissions**: Remove specific permissions from a group without editing the set
- **Sortable user table**: Click column headers to sort
- **Bulk actions**: Multi-select users → mass role change

**Backend Patterns**:
- `PermissionSetAssignment` sObject: junction between User and PermissionSet
- `PermissionSetGroup` sObject: groups of permission sets
- `MutingPermissionSet`: Subtract permissions from a group

**Takeaways για εμάς**:
- ✅ Permission Set Groups → Future enhancement: bundle our PermissionSets
- ✅ Sortable columns → UserTable sortable by all columns
- ✅ Bulk actions → Future enhancement: multi-select + mass role change
- ℹ️ Muting concept noted for future (complex, not needed now)

### 8.8 Clerk (Next.js Native)

**UI Patterns**:
- **Organizations**: Multi-tenant role management built for Next.js
- **Metadata-based roles**: Roles stored in `publicMetadata` (similar to Firebase Custom Claims)
- **Dashboard RBAC**: Visual role assignment in dashboard
- **Pre-built components**: `<OrganizationSwitcher>`, `<Protect>` for conditional rendering

**Backend Patterns**:
- `clerkClient.organizations.updateOrganizationMembership()`
- Role stored in organization membership metadata
- Claims propagate on next session refresh (same as Firebase)

**Takeaways για εμάς**:
- ✅ Metadata-based roles = Firebase Custom Claims (validates our approach)
- ✅ Claims propagation delay = Firebase token refresh (same constraint)
- ✅ Next.js integration patterns → Reference for our implementation

### 8.9 Enterprise SaaS Patterns (enterpriseready.io)

**Audit Log Guide** (industry standard):
- **Required columns**: Timestamp, Actor, Action (verb), Target, Previous Value, New Value
- **Timeline view**: Not just a flat table — scannable, visual, recent activity feed
- **Linked actors**: Click on actor → filter all activity by that person
- **Export**: CSV (human-readable) + JSON (SIEM: Splunk, Datadog, Sumo Logic)
- **Immutability**: Audit logs are append-only — never modified or deleted
- **IP tracking**: Source IP for every action (compliance & forensics)
- **Searchable**: Full-text search across all audit fields

**Takeaways για εμάς**:
- ✅ Timeline view → AuditTimeline component
- ✅ Linked actors → Click actor in log → filter by that user
- ✅ CSV + JSON export → AuditExport component
- ✅ Immutable append-only → Already in our audit.ts design

---

## 9. Google-Level UI Specification

Ακριβής specification του UI βασισμένη στα enterprise research findings. Κάθε component σχεδιασμένο σε επίπεδο Google/Salesforce.

### 9.1 User Management Table (Tab 1)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Role Management                                           [+ Grant Access]   │
├──────────────────────────────────────────────────────────────────────────────┤
│ [🔍 Search users by name or email...              ] [Role ▾] [Status ▾]     │
├──────────────────────────────────────────────────────────────────────────────┤
│ ☐ │ User              │ Email            │ Role          │ Status │ MFA │ #P │ Last Login  │ Actions │
│───┼───────────────────┼──────────────────┼───────────────┼────────┼─────┼────┼─────────────┼─────────│
│ ☐ │ 🟣 Γ. Παγώνης    │ g@pagonis.gr     │ 🔴 Super Admin│ Active │ 🛡️  │ 12 │ 2 hours ago │ [⋯]    │
│ ☐ │ 🔵 Μ. Νικολάου   │ m@pagonis.gr     │ 🔵 Company    │ Active │ 🛡️  │ 8  │ 1 day ago   │ [⋯]    │
│ ☐ │ 🟢 Α. Δημητρίου  │ a@pagonis.gr     │ 🟢 Internal   │ Active │ ⚠️  │ 3  │ 3 days ago  │ [⋯]    │
│ ☐ │ ⚪ Κ. Πελάτης     │ k@customer.com   │ ⚪ External    │ Pending│ —   │ 1  │ Never       │ [⋯]    │
├──────────────────────────────────────────────────────────────────────────────┤
│                                              Showing 1-25 of 47  [Load More]│
└──────────────────────────────────────────────────────────────────────────────┘
```

**Column Specifications**:

| Column | Width | Content | Sort | Source |
|--------|-------|---------|------|--------|
| Checkbox | 40px | Multi-select for bulk actions | — | Salesforce |
| Avatar + Name | 200px | Colored avatar circle + full name | ✅ asc/desc | Google Workspace |
| Email | 200px | Primary email address | ✅ asc/desc | Universal |
| Global Role | 140px | Color-coded Badge: `super_admin`=red, `company_admin`=blue, `internal_user`=green, `external_user`=gray | ✅ by hierarchy | Google IAM, Okta |
| Status | 80px | Badge: Active=green, Suspended=yellow, Pending=gray | ✅ | Salesforce, Okta |
| MFA | 50px | Shield icon: enrolled=green 🛡️, not=orange ⚠️, N/A=dash | ✅ | Auth0, Okta |
| Projects | 50px | Number of project memberships | ✅ | Custom |
| Last Login | 120px | Relative date (e.g., "2 hours ago") | ✅ | Google Workspace |
| Actions | 60px | `⋯` dropdown: Edit Role, View Details, Suspend/Activate | — | Universal |

**Badge Color Mapping** (using existing `Badge` 11 variants):

| Role | Badge Variant | Color |
|------|--------------|-------|
| `super_admin` | `destructive` | Red |
| `company_admin` | `default` (primary) | Blue |
| `internal_user` | `success` | Green |
| `external_user` | `secondary` | Gray |

### 9.2 Grant Access / Role Change Dialog (Google IAM Pattern)

```
┌─────────────────────────────────────────────────┐
│ ✏️  Change Role                            [✕]  │
├─────────────────────────────────────────────────┤
│                                                  │
│  User: Μ. Νικολάου (m@pagonis.gr)               │
│  Current Role: 🔵 Company Admin                  │
│                                                  │
│  ┌─ New Role ──────────────────────────────┐    │
│  │ [🔍 Search roles...                   ▾]│    │
│  │                                          │    │
│  │  🔴 Super Admin                          │    │
│  │     System-wide access, break-glass      │    │
│  │  🔵 Company Admin  ← current             │    │
│  │     Company management, all projects     │    │
│  │  🟢 Internal User                        │    │
│  │     Internal staff, assigned projects    │    │
│  │  ⚪ External User                         │    │
│  │     Customers, partners, limited access  │    │
│  └──────────────────────────────────────────┘    │
│                                                  │
│  Reason for change: *                            │
│  ┌──────────────────────────────────────────┐    │
│  │ Promoted to company admin for Q2 2026    │    │
│  └──────────────────────────────────────────┘    │
│                                                  │
│  ⚠️ User must re-login for changes to apply      │
│                                                  │
│              [Cancel]  [Confirm Change]           │
└─────────────────────────────────────────────────┘
```

**Dialog Specifications**:
- **Component**: `Dialog` (existing, CVA size variants) — size `md`
- **Role Selector**: `Select` (Radix, ADR-001) with role descriptions
- **Reason Field**: `Textarea` — required, min 10 characters (Okta/Salesforce compliance)
- **Warning Banner**: Always visible — Firebase claims constraint
- **Self-protection**: If target = current user → "Confirm Change" disabled + tooltip "Cannot change own role"
- **Confirm**: Shows summary before executing (Google IAM review step)

### 9.3 Role Permission Matrix (Tab 2 — Google IAM permissions.cloud Pattern)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Roles & Permissions                                                          │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ▼ Role Hierarchy                                                            │
│  ┌────────────────────────────────────────────────────────────────┐          │
│  │  L0  🔴 Super Admin ─────────────────────────────── (all)      │          │
│  │   └─ L1  🔵 Company Admin ───────────────────────── (company)  │          │
│  │       └─ L2  Project Manager ────────────────────── (project)  │          │
│  │           ├─ L3  Architect ──────────────────────── (assigned)  │          │
│  │           ├─ L3  Engineer ──────────────────────── (assigned)   │          │
│  │           └─ L4  Site Manager / Accountant / Sales  (limited)  │          │
│  │               └─ L5  Data Entry / Vendor ────────── (minimal)  │          │
│  │                   └─ L6  Viewer ─────────────────── (read-only)│          │
│  └────────────────────────────────────────────────────────────────┘          │
│                                                                              │
│  ▼ Permission Matrix                                                         │
│  ┌─────────────────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┐       │
│  │                  │ comm │ proj │ units│ bldg │ dxf  │ crm  │admin │       │
│  ├─────────────────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┤       │
│  │ Super Admin     │  ✅   │  ✅   │  ✅   │  ✅   │  ✅   │  ✅   │  ✅   │       │
│  │ Company Admin   │  ✅   │  ✅   │  ✅   │  ✅   │  ✅   │  ✅   │  ✅   │       │
│  │ Project Manager │  ✅   │  ✅   │  ✅   │  ✅   │  ✅   │  ✅   │  ❌   │       │
│  │ Architect       │  ✅   │  📖   │  ✅   │  ✅   │  ✅   │  📖   │  ❌   │       │
│  │ Engineer        │  ✅   │  📖   │  📖   │  📖   │  ✅   │  ❌   │  ❌   │       │
│  │ Viewer          │  📖   │  📖   │  📖   │  📖   │  📖   │  📖   │  ❌   │       │
│  └─────────────────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┘       │
│  Legend: ✅ = Full access  📖 = Read-only  ❌ = No access                      │
│                                                                              │
│  ▼ Permission Sets (Add-on Bundles)                                          │
│  ┌────────────────────┐ ┌────────────────────┐ ┌────────────────────┐       │
│  │ 📦 DXF Editor      │ │ 📦 Finance Approver│ │ 📦 Legal Viewer    │       │
│  │ dxf:draw:*         │ │ finance:approve:*  │ │ legal:view:*       │       │
│  │ dxf:layers:*       │ │ finance:report:*   │ │ legal:docs:read    │       │
│  │ 3 permissions      │ │ 🛡️ MFA Required     │ │ 🛡️ MFA Required     │       │
│  │ 5 users assigned   │ │ 2 users assigned   │ │ 1 user assigned    │       │
│  └────────────────────┘ └────────────────────┘ └────────────────────┘       │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Matrix Specifications**:
- **Data source**: `PREDEFINED_ROLES` + `PERMISSIONS` from existing auth code — computed at render time
- **Collapsible domain groups**: Click domain header to expand individual permissions (Google IAM pattern)
- **Permission Set Cards**: Salesforce pattern — name, description, permissions list, MFA badge, user count
- **Role Hierarchy**: Visual tree with level numbers, color-coded per global/project scope
- **Read-only**: Roles are predefined — this tab is informational only

### 9.4 Audit Log Viewer (Tab 3 — enterpriseready.io Pattern)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Audit Log                                                 [📥 Export ▾]      │
├──────────────────────────────────────────────────────────────────────────────┤
│ [📅 Date Range    ▾] [👤 Actor     ▾] [🎯 Target   ▾] [⚡ Action    ▾]     │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  🔵 Today                                                                    │
│  ┌──────────────────────────────────────────────────────────────────┐        │
│  │ 14:32  🟣 Γ. Παγώνης changed role of Μ. Νικολάου               │        │
│  │        company_admin → internal_user                              │        │
│  │        Reason: "Temporary demotion during audit"                  │        │
│  │        IP: 192.168.1.100                                          │        │
│  ├──────────────────────────────────────────────────────────────────┤        │
│  │ 11:15  🟣 Γ. Παγώνης granted permission_set to Α. Δημητρίου    │        │
│  │        Added: dxf_editor                                          │        │
│  │        Reason: "Needs DXF access for project Σαντορίνη"          │        │
│  ├──────────────────────────────────────────────────────────────────┤        │
│  │ 09:00  🟣 Γ. Παγώνης added member to project                    │        │
│  │        Project: "Κατοικία Γλυφάδα" → Κ. Πελάτης as viewer        │        │
│  │        Reason: "Client access to their project"                   │        │
│  └──────────────────────────────────────────────────────────────────┘        │
│                                                                              │
│  🔵 Yesterday                                                                │
│  ┌──────────────────────────────────────────────────────────────────┐        │
│  │ 16:45  🔵 Μ. Νικολάου removed member from project               │        │
│  │        Project: "Γραφεία Κηφισιάς" → Vendor X                     │        │
│  │        Reason: "Contract ended"                                   │        │
│  └──────────────────────────────────────────────────────────────────┘        │
│                                                                              │
│                                              Showing 1-50  [Load More]       │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Audit Log Specifications**:
- **Timeline grouping**: Grouped by date (Today, Yesterday, specific dates) — enterpriseready.io pattern
- **Linked actors**: Actor names are clickable → auto-populates Actor filter
- **Before/After values**: Always shown for every change
- **Reason**: Always shown (compliance requirement)
- **IP address**: Shown for forensic purposes
- **Export dropdown**: CSV (for spreadsheets) + JSON (for SIEM integration)
- **Immutable**: No delete/edit actions on log entries

### 9.5 Project Member Assignment (Tab 4 — AWS 3-Step Wizard)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Project Members                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ Project: [Κατοικία Γλυφάδα                    ▾]        [+ Add Member]       │
├──────────────────────────────────────────────────────────────────────────────┤
│ │ Member          │ Role             │ Permission Sets      │ Added    │ ⋯  │
│ ├─────────────────┼──────────────────┼──────────────────────┼──────────┼────│
│ │ 🟣 Γ. Παγώνης  │ Project Manager  │ —                    │ Jan 2026 │ ⋯  │
│ │ 🟢 Α. Δημητρίου│ Architect        │ [DXF Editor]         │ Feb 2026 │ ⋯  │
│ │ ⚪ Κ. Πελάτης   │ Viewer           │ —                    │ Mar 2026 │ ⋯  │
└──────────────────────────────────────────────────────────────────────────────┘

── Add Member Dialog (AWS 3-Step Wizard) ──

Step 1/3: Select Users
┌──────────────────────────────────────────────┐
│ [🔍 Search by name or email...            ]  │
│ ☐ Μ. Νικολάου (m@pagonis.gr)                │
│ ☑ Π. Αντωνίου (p@pagonis.gr)                │
│ ☐ Δ. Κωνσταντίνου (d@vendor.com)            │
│                              [Next →]         │
└──────────────────────────────────────────────┘

Step 2/3: Select Role & Permissions
┌──────────────────────────────────────────────┐
│ Project Role: [Engineer                    ▾]│
│                                              │
│ Permission Sets (optional):                  │
│ ☑ DXF Editor                                 │
│ ☐ Finance Approver 🛡️                        │
│ ☐ CRM Export                                 │
│                              [← Back] [Next →]│
└──────────────────────────────────────────────┘

Step 3/3: Review & Confirm
┌──────────────────────────────────────────────┐
│ Adding 1 member to "Κατοικία Γλυφάδα":      │
│                                              │
│ • Π. Αντωνίου → Engineer + DXF Editor        │
│                                              │
│ Reason: *                                    │
│ [Assigned for MEP engineering phase       ]  │
│                                              │
│                        [← Back] [Confirm]     │
└──────────────────────────────────────────────┘
```

---

## 10. Google-Level Backend Specification

Αναλυτικό backend design βασισμένο στα enterprise patterns (Google/AWS/Microsoft/Salesforce).

### 10.1 Enterprise Middleware Stack

Κάθε admin API endpoint ακολουθεί αυστηρό middleware pipeline:

```
┌─────────────────────────────────────────────────────────────────┐
│                    REQUEST PIPELINE                               │
│                                                                   │
│  Client Request                                                   │
│       │                                                           │
│       ▼                                                           │
│  ┌─────────────────┐                                             │
│  │ 1. Rate Limiter  │  withSensitiveRateLimit (10 req/min)       │
│  │    (ADR-068)     │  Prevents brute force & resource exhaustion│
│  └────────┬────────┘                                             │
│           ▼                                                       │
│  ┌─────────────────┐                                             │
│  │ 2. Auth Verify   │  withAuth — Firebase token verification    │
│  │    (ADR-020)     │  Extract uid, companyId, globalRole        │
│  └────────┬────────┘                                             │
│           ▼                                                       │
│  ┌─────────────────┐                                             │
│  │ 3. Role Check    │  Verify caller is super_admin              │
│  │                  │  isRoleBypass(ctx.globalRole)               │
│  └────────┬────────┘                                             │
│           ▼                                                       │
│  ┌─────────────────┐                                             │
│  │ 4. Tenant        │  Filter all queries by ctx.companyId       │
│  │    Isolation     │  (ADR-063: Company Isolation)              │
│  │                  │  Verify target belongs to same company      │
│  └────────┬────────┘                                             │
│           ▼                                                       │
│  ┌─────────────────┐                                             │
│  │ 5. Input         │  Zod schema validation on request body     │
│  │    Validation    │  Type-safe, no `any`, enterprise standards │
│  └────────┬────────┘                                             │
│           ▼                                                       │
│  ┌─────────────────┐                                             │
│  │ 6. Self-         │  Cannot modify own role (Microsoft Entra)  │
│  │    Protection    │  Prevents admin lockout scenarios           │
│  └────────┬────────┘                                             │
│           ▼                                                       │
│  ┌─────────────────┐                                             │
│  │ 7. Handler       │  Business logic execution                  │
│  │                  │  Firebase Admin SDK operations              │
│  └────────┬────────┘                                             │
│           ▼                                                       │
│  ┌─────────────────┐                                             │
│  │ 8. Audit Log     │  Append-only log via audit.ts              │
│  │    (immutable)   │  actor, action, target, prev/new, reason   │
│  └────────┬────────┘                                             │
│           ▼                                                       │
│  Response (JSON)                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 10.2 API Endpoint Details

#### Endpoint 1: List Users

```
GET /api/admin/role-management/users
```

| Aspect | Detail |
|--------|--------|
| **Middleware** | Rate Limit → Auth → Role Check (super_admin) → Tenant Isolation |
| **Query Params** | `search`, `globalRole`, `status`, `sortBy`, `sortOrder`, `limit`, `cursor` |
| **Data Sources** | Firebase Auth (`listUsers()`) + Firestore (`companies/{cId}/members`) |
| **Tenant Isolation** | Only return users where `companyId === ctx.companyId` |
| **Pagination** | Cursor-based (Firebase `pageToken` + Firestore `startAfter`) |
| **Caching** | No cache — always fresh data for admin operations |
| **Response** | `UserListResponse` (see Section 2.3) |

**Implementation approach** (Google/AWS pattern):
1. Fetch company member UIDs from Firestore
2. Batch-fetch Firebase Auth records for those UIDs
3. Batch-fetch project memberships from Firestore
4. Merge, filter, sort, paginate server-side
5. Return combined response

#### Endpoint 2: Change Global Role

```
PATCH /api/admin/role-management/users/:uid/role
```

| Aspect | Detail |
|--------|--------|
| **Middleware** | Rate Limit → Auth → Role Check → Tenant Isolation → Self-Protection → Validation |
| **Request Body** | `{ newRole: GlobalRole, reason: string }` — Zod validated |
| **Validation** | Reason required, min 10 chars. Target must be in same company. Cannot change own role. |
| **Firebase Operation** | `auth().setCustomUserClaims(uid, { ...existingClaims, globalRole: newRole })` |
| **Audit Entry** | `{ actor, action: 'role_changed', target, prev: oldRole, new: newRole, reason }` |
| **Response** | `ChangeRoleResponse` + `requiresReLogin: true` |
| **Side Effects** | User's next token refresh will pick up new claims (Firebase constraint) |

#### Endpoint 3: Manage Project Members

```
POST /api/admin/role-management/project-members
```

| Aspect | Detail |
|--------|--------|
| **Middleware** | Rate Limit → Auth → Role Check → Tenant Isolation → Validation |
| **Request Body** | `ProjectMemberRequest` — action: `assign` / `update` / `remove` |
| **Firestore Path** | `companies/{cId}/projects/{pId}/members/{uid}` |
| **Document ID** | `enterprise-id.service.ts` generator (ADR-017) for new member docs |
| **Validation** | User exists, project exists, role is valid, permission sets are valid |
| **Audit Entry** | `{ actor, action: 'member_[assigned|updated|removed]', target, details }` |

#### Endpoint 4: Audit Log Query

```
GET /api/admin/role-management/audit-log
```

| Aspect | Detail |
|--------|--------|
| **Middleware** | Rate Limit → Auth → Role Check → Tenant Isolation |
| **Query Params** | `startDate`, `endDate`, `actorId`, `targetId`, `action`, `limit`, `cursor` |
| **Firestore Path** | `companies/{cId}/audit_logs` collection |
| **Composite Index** | `companyId` + `timestamp` DESC (required for efficient queries) |
| **Pagination** | Cursor-based on `timestamp` field |
| **Max Results** | 200 per request (enterprise standard) |

#### Endpoint 5: Audit Log Export

```
GET /api/admin/role-management/audit-log/export
```

| Aspect | Detail |
|--------|--------|
| **Middleware** | Rate Limit (stricter: 2 req/min) → Auth → Role Check → Tenant Isolation |
| **Query Params** | `format` (csv/json), `startDate`, `endDate` |
| **Max Range** | 90 days per export (prevent memory overload) |
| **Response** | `Content-Type: text/csv` or `application/json`, `Content-Disposition: attachment` |
| **Purpose** | SIEM integration (Splunk/Datadog) + Compliance audits |

### 10.3 Data Model

```typescript
// Firestore: companies/{companyId}/audit_logs/{autoId}
interface AuditLogDocument {
  id: string;                    // Enterprise ID (ADR-017)
  companyId: string;             // Tenant isolation (ADR-063)
  timestamp: Timestamp;          // Server timestamp
  actor: {
    uid: string;
    displayName: string;
    email: string;
  };
  action: AuditAction;           // 'role_changed' | 'member_added' | 'member_removed' |
                                 // 'member_updated' | 'permission_set_granted' |
                                 // 'permission_set_revoked' | 'user_suspended' |
                                 // 'user_activated'
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
    requestId: string;           // Correlation ID for debugging
  };
}

// Composite Firestore Indexes Required:
// 1. companyId ASC + timestamp DESC  (main query)
// 2. companyId ASC + actor.uid ASC + timestamp DESC  (filter by actor)
// 3. companyId ASC + target.uid ASC + timestamp DESC  (filter by target)
// 4. companyId ASC + action ASC + timestamp DESC  (filter by action type)
```

### 10.4 Existing Components for Reuse

| Component | Path | Usage in Admin Console |
|-----------|------|----------------------|
| `Table` | `src/components/ui/table.tsx` | UserTable, MemberTable, AuditTimeline base |
| `Dialog` | `src/components/ui/dialog.tsx` | RoleChangeDialog, AssignMemberDialog (CVA size variants) |
| `Tabs` | `src/components/ui/tabs.tsx` | 4-tab layout (Users, Roles, Audit, Projects) |
| `Badge` | `src/components/ui/badge.tsx` | Role badges (11 variants), Status badges, MFA badges |
| `Select` | `src/components/ui/select.tsx` | Role dropdown, Project selector (ADR-001: ONLY this) |
| `apiClient` | `src/lib/api/enterprise-api-client.ts` | All authenticated API calls |
| `withAuth` | `src/lib/auth/middleware.ts` | Route protection middleware |
| `requireAdminForPage` | `src/server/admin/admin-guards.ts` | Page-level authorization |
| `useSpacingTokens` | `src/hooks/useSpacingTokens.ts` | Consistent spacing |
| `useLayoutClasses` | `src/hooks/useLayoutClasses.ts` | Layout patterns |
| `useTypography` | `src/hooks/useTypography.ts` | Typography system |
| `PREDEFINED_ROLES` | `src/lib/auth/roles.ts` | Role definitions (13 roles, hierarchy levels) |
| `PERMISSIONS` | `src/lib/auth/types.ts` | Permission registry (65+ permissions) |
| `PERMISSION_SETS` | `src/lib/auth/permission-sets.ts` | 9 add-on bundles with MFA gating |
| `logRoleChange` | `src/lib/auth/audit.ts` | Existing audit logging function |
| `generateId` | `src/services/enterprise-id.service.ts` | Enterprise ID generation (ADR-017) |

### 10.5 Security Checklist (Implementation Gate)

Κάθε endpoint ΠΡΕΠΕΙ να περνάει αυτά τα gates πριν γίνει merge:

| # | Gate | Implementation | Verified |
|---|------|---------------|----------|
| 1 | **Rate Limiting** | `withSensitiveRateLimit` wrapper (ADR-068) | ☐ |
| 2 | **Authentication** | `withAuth` middleware — Firebase token | ☐ |
| 3 | **Authorization** | `super_admin` check via `isRoleBypass()` | ☐ |
| 4 | **Tenant Isolation** | `companyId` filter on ALL queries (ADR-063) | ☐ |
| 5 | **Input Validation** | Zod schema, no `any` type | ☐ |
| 6 | **Self-Protection** | Cannot modify own role | ☐ |
| 7 | **Audit Trail** | Every mutation → audit log entry | ☐ |
| 8 | **Enterprise IDs** | `setDoc()` + enterprise-id.service (ADR-017) | ☐ |
| 9 | **Semantic HTML** | `<main>`, `<section>`, `<form>` (no div soup) | ☐ |
| 10 | **No `any`/`as any`** | TypeScript strict mode | ☐ |
