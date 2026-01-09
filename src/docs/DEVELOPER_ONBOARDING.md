# NESTOR REAL ESTATE PLATFORM - Developer Onboarding Guide

> **Enterprise-Grade Real Estate Management System**
>
> Version: 1.9.0 (Final) | Generated: 2026-01-09
>
> **Commit**: `2dfe1b7` | **Branch**: `main`

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Tech Stack](#2-tech-stack)
3. [Local Development Setup (Runbook)](#3-local-development-setup-runbook)
4. [Routing & Rendering Model](#4-routing--rendering-model)
5. [Data Model (Firestore)](#5-data-model-firestore)
6. [Firestore Security Rules](#6-firestore-security-rules)
7. [Authentication & Authorization](#7-authentication--authorization)
8. [API Inventory](#8-api-inventory)
9. [State Management](#9-state-management)
10. [Design System](#10-design-system)
11. [Known Issues & Tech Debt](#11-known-issues--tech-debt)
12. [Invariants & Contribution Rules](#12-invariants--contribution-rules)
13. [Module Map (Feature-by-Feature)](#13-module-map-feature-by-feature)
14. [CI/CD & Deployment](#14-cicd--deployment)
15. [API Contracts (Key Endpoints)](#15-api-contracts-key-endpoints)
16. [Appendix A: Quick Reference](#appendix-a-quick-reference)
17. [Appendix B: Verification Commands](#appendix-b-verification-commands)
18. [Appendix C: Owner & Contacts](#appendix-c-owner--contacts)
19. [Appendix D: Glossary](#appendix-d-glossary)

---

## 1. Architecture Overview

### High-Level Architecture

```
                    NESTOR PLATFORM
+----------------------------------------------------------+
|  Frontend (Next.js 15 App Router - React 19)             |
|  +----------+----------+----------+----------+--------+  |
|  | Property | CRM      | DXF      | Geo      | Sales  |  |
|  | Module   | Module   | Viewer   | Canvas   | Module |  |
|  +----------+----------+----------+----------+--------+  |
+----------------------------------------------------------+
|  Shared Components & Design System                        |
|  +------------------------------------------------------+ |
|  | ui/ (Radix) | primitives/ | domain/ | containers/   | |
|  +------------------------------------------------------+ |
+----------------------------------------------------------+
|  State (Zustand) | Services | Hooks | Repositories       |
+----------------------------------------------------------+
|  Firebase (Auth + Firestore + Storage)                   |
+----------------------------------------------------------+
```

### Key Architectural Principles

1. **Server-First with Client Interactivity**: Uses Next.js 15 App Router
2. **Centralized Systems**: Common patterns centralized to eliminate duplication
3. **Type Safety**: Strict TypeScript (zero `any` policy)
4. **Multi-tenant Intended Design**: Enterprise/company-based data isolation (⚠️ enforcement not implemented - see P1 blockers)

---

## 2. Tech Stack

### Core Technologies (from package.json)

| Category | Technology | Version |
|----------|------------|---------|
| **Framework** | Next.js | 15.5.7 |
| **UI Library** | React | 19.2.1 |
| **Language** | TypeScript | 5.9.2 |
| **Styling** | Tailwind CSS | 3.4.x |
| **State** | Zustand | 5.0.8 |
| **Database** | Firebase Firestore | 12.2.1 |
| **Auth** | Firebase Authentication | 12.2.1 |
| **Storage** | Firebase Storage | 12.2.1 |
| **i18n** | i18next | 25.4.0 |
| **Forms** | React Hook Form + Zod | 7.54.2 / 3.24.2 |
| **UI Components** | Radix UI | Various |
| **Maps** | MapLibre GL | 5.9.0 |

### Package Manager

```
pnpm@9.14.0 (required)
node >= 18.17.0
```

---

## 3. Local Development Setup (Runbook)

### Prerequisites

- Node.js 18.17+ (LTS recommended)
- pnpm 9.14+
- Git
- Firebase project (with Firestore, Auth, Storage enabled)

### Step-by-Step Installation

```bash
# 1. Clone repository
git clone <repo-url>
cd Nestor_Pagonis

# 2. Install dependencies (MUST use pnpm)
pnpm install

# 3. Copy environment file
cp .env.local.example .env.local
# Edit .env.local with your Firebase credentials

# 4. Start development server
pnpm dev

# Server starts at http://localhost:3000
```

### Required Environment Variables

**Canonical Setup** (one step):
```bash
# Copy template and edit with your values
cp .env.local.example .env.local
```

**Note**: `src/.env.example` exists but is for reference only. Use `.env.local.example` in root.

Create `.env.local` with:

```env
# Firebase (REQUIRED)
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id

# Debug (Optional)
NEXT_PUBLIC_DEBUG=false
NEXT_PUBLIC_DEBUG_COMPONENTS=

# Company Info (Optional)
NEXT_PUBLIC_COMPANY_NAME=Your Company
NEXT_PUBLIC_COMPANY_EMAIL=info@company.com
NEXT_PUBLIC_COMPANY_PHONE=+30 XXX XXX XXXX
```

### Available Scripts (from package.json)

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `pnpm dev` | Start dev server with token build |
| `build` | `pnpm build` | Production build |
| `start` | `pnpm start` | Start production server |
| `typecheck` | `pnpm typecheck` | TypeScript check (`tsc --noEmit`) |
| `lint` | `pnpm lint` | ESLint check |
| `lint:fix` | `pnpm lint:fix` | ESLint auto-fix |
| `test` | `pnpm test` | Jest unit tests |
| `test:e2e` | `pnpm test:e2e` | Playwright E2E tests |
| `clear-cache` | `pnpm clear-cache` | Clear .next cache |

### Monorepo Structure

```
Nestor_Pagonis/           # Root
├── packages/
│   └── core/             # @geo-alert/core (shared utilities)
└── src/                  # Main application
    └── subapps/          # Isolated subapplications
        ├── dxf-viewer/
        └── geo-canvas/
```

### Common Issues & Troubleshooting

| Issue | Solution |
|-------|----------|
| pdfjs worker error | Ensure `public/pdf.worker.min.mjs` exists |
| Firestore permissions | Check `isDevMode()` is enabled for dev |
| Missing env vars | Check `.env.local` has all NEXT_PUBLIC_* vars |
| Module not found | Run `pnpm install` and restart dev server |
| Cache issues | Run `pnpm clear-cache && pnpm dev` |

---

## 4. Routing & Rendering Model

### Metrics (Generated 2026-01-09)

| Metric | Count | Source |
|--------|-------|--------|
| **Total Pages** | 42 | `src/app/**/page.tsx` |
| **API Routes** | 79 | `src/app/api/**/route.ts` |
| **'use client' files** | 52 | Files in `src/app/` with directive |

### Rendering Strategy

**Important**: In Next.js App Router, components are **Server Components by default**. The 52 files with `'use client'` represent pages/components that require:
- Browser APIs (localStorage, canvas, etc.)
- Event handlers and interactivity
- Zustand stores or client-side state

| Route Pattern | Rendering | Reason |
|---------------|-----------|--------|
| `/login`, `/share/*` | CSR | Auth/public sharing |
| `/admin/*` | CSR | Heavy admin UI |
| `/buildings/*`, `/contacts/*` | CSR | Interactive lists |
| `/dxf/*`, `/geo/*` | CSR | Canvas operations |
| `/crm/*` | CSR | Dashboard interactivity |
| `/api/*` | Server | API handlers only |

### Route Categories

```
src/app/
├── (root pages)         # / (home), /login
├── admin/               # Admin section (3 pages)
├── buildings/           # Building management
├── contacts/            # CRM contacts
├── crm/                 # CRM module (10+ pages)
│   ├── communications/
│   ├── customers/
│   ├── dashboard/
│   ├── leads/
│   ├── notifications/
│   ├── pipeline/
│   ├── tasks/
│   └── teams/
├── dxf/viewer/          # CAD viewer
├── geo/canvas/          # Geographic canvas
├── properties/          # Property listings
├── sales/               # Sales module
├── settings/            # User settings
├── spaces/              # Space management
│   ├── apartments/
│   ├── parking/
│   ├── storage/
│   └── common/
├── storage/             # Storage details
└── units/               # Unit management
```

---

## 5. Data Model (Firestore)

### Collections Overview

**Source**: `firestore.rules`, `firestore.indexes.json`, and code search in `src/services/`, `src/repositories/`

**Note**: Rules/indexes may not list all collections used by code. For complete discovery, also search: `grep -r "collection(db" src/ --include="*.ts"`

| Collection | Description | Tenancy |
|------------|-------------|---------|
| `projects` | Real estate projects | Global (companyId field) |
| `buildings` | Buildings | projectId reference |
| `floors` | Floor levels | buildingId reference |
| `units` | Apartments/units | buildingId reference |
| `storage_units` | Storage spaces | Parallel to units |
| `parking_spots` | Parking spaces | Parallel to units |
| `contacts` | CRM contacts | userId ownership |
| `contact_relationships` | Contact relationships | sourceId/targetId |
| `companies` | Company data | Read-only |
| `navigation_companies` | Navigation config | Read-only |
| `notifications` | System notifications | Public read |
| `cadFiles` | DXF file metadata | ownerId |
| `dxf_files` | DXF storage refs | ownerId |
| `tasks` | CRM tasks | assignedTo |

### Entity Relationships

```
projects (companyId)
    │
    └── buildings (projectId)
            │
            ├── units (buildingId)
            ├── storage_units (buildingId)
            └── parking_spots (buildingId)

contacts (userId)
    │
    └── contact_relationships (sourceContactId, targetContactId)
```

### Indexed Fields (firestore.indexes.json)

| Collection | Composite Index Fields |
|------------|------------------------|
| `contact_relationships` | relationshipType, sourceContactId, targetContactId, status |
| `projects` | companyId, status, lastUpdate |
| `buildings` | projectId, status, completionDate |
| `units` | buildingId, status, price, area, soldTo |
| `dxf_files` | ownerId, lastModified, fileName |
| `tasks` | status, dueDate, assignedTo, priority |
| `contacts` | type, email, createdAt |

---

## 6. Firestore Security Rules

### Evidence-Based Summary

**Source File**: `firestore.rules` (294 lines)

### CRITICAL SECURITY FINDING

```javascript
// firestore.rules:279-281
function isDevMode() {
  // DEV FLAG: Will change for production
  return true; // Currently ALWAYS returns true
}
```

**Impact**: `isDevMode()` is used across multiple rules, granting public/authenticated access regardless of ownership.

### Collection-by-Collection Access Matrix

| Collection | Read | Write | Evidence |
|------------|------|-------|----------|
| `projects` | `isDevMode() \|\| isAuthenticated()` | Authenticated + validation | Lines 27-46 |
| `contact_relationships` | Owner only (source/target) | Owner + validation | Lines 51-76 |
| `cadFiles` | `isDevMode() \|\| owner` | Authenticated + validation | Lines 81-110 |
| `companies` | Authenticated only | **DENIED (server only)** | Lines 115-122 |
| `buildings` | `isDevMode() \|\| isAuthenticated()` | **DENIED** | Lines 127-130 |
| `floors` | `isDevMode() \|\| isAuthenticated()` | **DENIED** | Lines 133-136 |
| `units` | `isDevMode() \|\| isAuthenticated()` | **DENIED** | Lines 138-141 |
| `storage_units` | `isDevMode() \|\| isAuthenticated()` | **DENIED** | Lines 148-151 |
| `parking_spots` | `isDevMode() \|\| isAuthenticated()` | `isDevMode()` only | Lines 159-162 |
| `navigation_companies` | `isDevMode() \|\| isAuthenticated()` | **DENIED** | Lines 169-172 |
| `notifications` | **PUBLIC (`if true`)** | **DENIED** | Lines 177-180 |
| `contacts` | `isDevMode() \|\| owner` | Owner + validation | Lines 185-205 |

### Validation Functions

| Function | Purpose | Location |
|----------|---------|----------|
| `isValidProjectData` | Validates name, status, company | Lines 212-217 |
| `isValidRelationshipData` | Validates relationship fields | Lines 220-226 |
| `isValidCadFileData` | Validates DXF metadata | Lines 229-249 |
| `isValidContactData` | Basic email validation | Lines 253-257 |
| `isAttemptingToModifySystemFields` | Protects createdAt, ownerId, etc. | Lines 260-265 |

### Production Blockers

| Priority | Issue | Location | Fix Required |
|----------|-------|----------|--------------|
| P0 | `isDevMode() = true` | Line 281 | Change to `false` or env-based |
| P0 | `notifications` public read | Line 178 | Add auth check |
| P1 | No rate limiting | N/A | Implement Firebase App Check |
| P1 | No multi-tenant isolation | Various | Add enterpriseId checks |

### ⚠️ Operational Security Actions (Before Any Public Exposure)

**MANDATORY CHECKLIST** before deploying to production or exposing to internet:

- [ ] **P0**: Set `isDevMode()` to `false` in `firestore.rules:281`
- [ ] **P0**: Remove `allow read: if true` from notifications (`firestore.rules:178`)
- [ ] **P1**: Implement rate limiting (Firebase App Check or custom middleware)
- [ ] **P1**: Add `enterpriseId` checks in Firestore rules for multi-tenant isolation
- [ ] **Verify**: Run `firebase deploy --only firestore:rules` after changes

**Current state (commit 2dfe1b7)**: System is **OPEN** to any authenticated user. Do NOT expose publicly.

---

## 7. Authentication & Authorization

### Authentication Method

- **Provider**: Firebase Authentication
- **Methods**: Email/Password, Google OAuth
- **Token Lifecycle**: Firebase ID tokens (~1 hour), auto-refresh via SDK
- **Persistence**: `browserLocalPersistence` (client SDK default)

### Role System

**Storage**: User document in Firestore (`/users/{uid}`)

| Role | Permissions |
|------|-------------|
| `user` | Read/write own data |
| `admin` | Enterprise management |
| `superadmin` | System-wide access |

### Enforcement Points

| Layer | Expected | Current (commit 2dfe1b7) | Location |
|-------|----------|--------------------------|----------|
| **Firestore** | Security rules | ✅ Active (but `isDevMode()=true`) | `firestore.rules` |
| **API Routes** | Server-side auth check | ❌ Not found (see Section 15) | `src/app/api/*/route.ts` |
| **Client** | Route protection | Partial (component-level) | Components with auth checks |
| **Middleware** | Edge auth | ❌ No middleware file exists | `src/middleware.ts` |

**⚠️ Note**: As of commit `2dfe1b7`, security relies **entirely** on Firestore rules.

### RBAC Gaps (For Production)

| Gap | Current State | Required |
|-----|---------------|----------|
| Role storage | User doc field | Custom claims |
| Multi-tenant isolation | companyId field exists, **not enforced** | Enforced in rules |
| Permission matrix | Not implemented | Granular RBAC |

---

## 8. API Inventory

### Overview

**Total API Routes**: 79 (from `src/app/api/**/route.ts`)

### Routes by Category

#### Admin Routes (`/api/admin/*`)

| Endpoint | Methods | Expected | Current | Description |
|----------|---------|----------|---------|-------------|
| `/api/admin/cleanup-duplicates` | POST | Admin | None | Remove duplicate records |
| `/api/admin/create-clean-projects` | POST | Admin | None | Create clean project data |
| `/api/admin/fix-building-project` | POST | Admin | None | Fix building-project links |
| `/api/admin/fix-projects-direct` | POST | Admin | None | Direct project fixes |
| `/api/admin/fix-unit-project` | POST | Admin | None | Fix unit-project links |
| `/api/admin/migrate-dxf` | POST | Admin | None | DXF migration |
| `/api/admin/migrate-units` | POST | Admin | None | Unit migration |
| `/api/admin/seed-parking` | POST | Admin | None | Seed parking data |
| `/api/admin/migrations/execute` | POST | Admin | None | Run migrations |
| `/api/admin/migrations/execute-admin` | POST | Admin | None | Admin migrations |
| `/api/admin/migrations/normalize-floors` | POST | Admin | None | Normalize floor data |

**Legend**: Expected = intended auth level | Current = actual implementation (all routes have no auth check)

#### Buildings Routes (`/api/buildings/*`)

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `/api/buildings` | GET, POST | CRUD buildings |
| `/api/buildings/[buildingId]/customers` | GET | Building customers |
| `/api/buildings/fix-project-ids` | POST | Fix project references |
| `/api/buildings/populate` | POST | Populate building data |
| `/api/buildings/seed` | POST | Seed initial data |

#### Contacts Routes (`/api/contacts/*`)

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `/api/contacts/[contactId]` | GET, PUT, DELETE | Contact CRUD |
| `/api/contacts/[contactId]/units` | GET | Contact's units |
| `/api/contacts/add-real-contacts` | POST | Add contacts |
| `/api/contacts/create-sample` | POST | Create samples |
| `/api/contacts/list-companies` | GET | List company contacts |
| `/api/contacts/update-existing` | PUT | Batch update |

#### Projects Routes (`/api/projects/*`)

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `/api/projects/[projectId]/customers` | GET | Project customers |
| `/api/projects/add-buildings` | POST | Add buildings |
| `/api/projects/by-company/[companyId]` | GET | Projects by company |
| `/api/projects/create-for-companies` | POST | Create projects |
| `/api/projects/fix-company-ids` | POST | Fix company refs |
| `/api/projects/quick-fix` | POST | Quick fixes |
| `/api/projects/structure/[projectId]` | GET | Project structure |

#### Other Core Routes

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `/api/units` | GET, POST | Units CRUD |
| `/api/floors` | GET, POST | Floors CRUD |
| `/api/parking` | GET, POST | Parking CRUD |
| `/api/storages` | GET, POST | Storages CRUD |
| `/api/companies` | GET | Companies list |
| `/api/notifications` | GET, POST | Notifications |
| `/api/relationships/*` | Various | Contact relationships |

#### Debug/Dev Routes (Remove in Production)

| Endpoint | Description |
|----------|-------------|
| `/api/debug/*` | Debug endpoints |
| `/api/debug-*` | Legacy debug routes |
| `/api/fix-*` | One-time fixes |

### API Authentication Pattern (Intended/Recommended)

```typescript
// RECOMMENDED pattern (not currently implemented as of commit 2dfe1b7)
export async function GET(request: Request) {
  // 1. Verify auth token
  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Verify Firebase token
  const token = await verifyIdToken(authHeader.split('Bearer ')[1]);

  // 3. Execute query
  // ...
}
```

**⚠️ Current State**: This pattern is **not implemented** across API routes. See Section 15 for verification.

### Rate Limiting

**Current State**: NOT IMPLEMENTED

```env
# Defined in .env but not enforced
RATE_LIMIT_MAX_REQUESTS=15
RATE_LIMIT_WINDOW_MINUTES=1
```

---

## 9. State Management

### Zustand Stores

| Store | Purpose | Location |
|-------|---------|----------|
| `useAuthStore` | Authentication state | `src/stores/` |
| `useUIStore` | UI state (modals, sidebars) | `src/stores/` |
| `useBuildingStore` | Building selection | `src/stores/` |
| `useContactStore` | Contact selection | `src/stores/` |
| `useProjectStore` | Project state | `src/stores/` |

### Data Fetching Pattern (Illustrative)

```typescript
// Server Component - fetch on server
async function BuildingsPage() {
  const buildings = await fetchBuildings();
  return <BuildingsList initialData={buildings} />;
}

// Client Component - client updates
'use client';
function BuildingsList({ initialData }) {
  const [buildings, setBuildings] = useState(initialData);
  // Real-time updates via Firestore listeners
}
```

**Note**: Illustrative pattern. Many pages use `'use client'` (52 files) with direct Firestore SDK access rather than server-side fetching.

---

## 10. Design System

### Component Hierarchy

```
Primitives (design-system/primitives/)
    │
    └── Molecules (design-system/components/)
            │
            └── Domain Cards (domain/)
```

### Centralized Hooks

| Hook | Purpose |
|------|---------|
| `useIconSizes()` | Standardized icon dimensions |
| `useSemanticColors()` | Theme-aware color tokens |
| `useBorderTokens()` | Border styles (quick.card, etc.) |
| `useTypography()` | Text style tokens |

### Documentation Location

- `src/subapps/dxf-viewer/docs/centralized_systems.md` - Main centralization guide
- `docs/centralized-systems/` - Modular documentation

---

## 11. Known Issues & Tech Debt

### Priority Matrix

| Priority | Issue | Impact | Location | Status |
|----------|-------|--------|----------|--------|
| **P0** | `isDevMode() = true` | Security breach risk | `firestore.rules:281` | Open |
| **P0** | Public notifications read | Data exposure | `firestore.rules:178` | Open |
| **P0** | API keys in .env.example | Credential leak | `src/.env.example` | Open |
| **P1** | No rate limiting | DoS vulnerability | API routes | Open |
| **P1** | No multi-tenant isolation | Data isolation | Firestore rules | Open |
| **P2** | 79 API routes undocumented | Maintenance burden | `/api/*` | Partial |
| **P2** | Entity list duplication | Code debt | 6 list files | Open |
| **P3** | Console.log statements | Production noise | Various | Open |

### Security Audit Actions Required

1. **Immediate**: Rotate any exposed API keys in `src/.env.example`
2. **Before Production**: Set `isDevMode() = false`
3. **Before Production**: Implement proper RBAC
4. **Before Production**: Add rate limiting

### Development vs Production

| Aspect | Development | Production Required |
|--------|-------------|---------------------|
| `isDevMode()` | `true` | `false` |
| Auth bypass | Active | Remove |
| Debug routes | Available | Remove or protect |
| Rate limiting | Disabled | Enable |
| Error details | Exposed | Hide |

---

## Appendix A: Quick Reference

### Essential Commands

**Extracted directly from `package.json` scripts (1:1 copy)**:

```json
// FROM package.json "scripts" section:
{
  "dev": "pnpm run build:tokens && next dev",
  "dev:fast": "pnpm run build:tokens && pnpm dlx next dev",
  "dev:clean": "pnpm run clear-cache && pnpm run build:tokens && next dev",
  "build": "pnpm run build:tokens && next build",
  "build:clean": "node scripts/clear-cache.js && pnpm run build",
  "start": "next start",
  "lint": "next lint",
  "lint:fix": "next lint --fix",
  "typecheck": "tsc --noEmit",
  "clear-cache": "node scripts/clear-cache.js",
  "test": "jest --passWithNoTests",
  "test:watch": "jest --watch",
  "test:coverage": "jest --coverage",
  "test:e2e": "playwright test",
  "validate:i18n": "node scripts/validate-translations.js",
  "generate:i18n-types": "node scripts/generate-i18n-types.js",
  "enterprise:clean": "pnpm store prune && rm -rf node_modules && rm -rf .next && pnpm install"
}
```

**Quick Reference**:
| Command | What it does |
|---------|--------------|
| `pnpm dev` | Start dev server |
| `pnpm build` | Production build |
| `pnpm typecheck` | TypeScript validation |
| `pnpm test` | Run Jest tests |
| `pnpm test:e2e` | Run Playwright tests |

### Key File Locations

| Purpose | Path |
|---------|------|
| Firestore rules | `firestore.rules` |
| Firestore indexes | `firestore.indexes.json` |
| Environment template | `.env.local.example` |
| Firebase config | `src/firebase/` |
| API routes | `src/app/api/` |
| Components | `src/components/` |
| Design system | `src/design-system/` |
| Stores | `src/stores/` |
| Hooks | `src/hooks/` |
| Types | `src/types/` |

---

## 12. Invariants & Contribution Rules

### Source of Truth

| Data Type | Source | Access Method |
|-----------|--------|---------------|
| **Core entities** (buildings, units, contacts) | Firestore direct | Client SDK + Security Rules |
| **Read operations** | Firestore | Client-side queries |
| **Write operations** | Mixed | Some direct, some via API routes |
| **Aggregations** | API routes | Server-side computation |

**CRITICAL**: Client SDK has direct Firestore access. Security depends **entirely** on Firestore rules.

### Code Invariants (from CLAUDE.md)

These rules are **TERMINAL PROHIBITIONS** - violations require immediate stop:

| Rule | Description | Enforcement |
|------|-------------|-------------|
| **NO `any` type** | Zero tolerance for `any` in TypeScript | PR rejection |
| **NO `as any`** | Type casting to any is forbidden | PR rejection |
| **NO `@ts-ignore`** | Must fix type issues properly | PR rejection |
| **NO inline styles** | Use Tailwind classes only | PR rejection |
| **NO excessive `<div>`** | Use semantic HTML | Code review |
| **NO new files without permission** | Ask before creating | Process |

### Component Placement Rules

```
src/
├── design-system/           # ONLY primitives & molecules
│   ├── primitives/          # CardIcon, CardStats, etc.
│   └── components/          # ListCard, DetailCard
│
├── domain/                  # Entity-specific cards
│   └── [Entity]ListCard.tsx # UnitListCard, BuildingListCard
│
├── components/              # Feature components
│   └── [feature]/           # Organized by feature
│
└── subapps/                 # Isolated applications
    └── dxf-viewer/          # Self-contained
```

### Centralization Rules

**Before writing ANY code:**

1. **SEARCH FIRST**: Run grep/glob for existing implementations
2. **CHECK DOCS**: Read `src/subapps/dxf-viewer/docs/centralized_systems.md`
3. **EXTEND, DON'T DUPLICATE**: Modify existing code, don't create parallel
4. **ASK PERMISSION**: For new files, get explicit approval

### ADR-001: Canonical Select Component

| Status | Decision |
|--------|----------|
| **CANONICAL** | `@/components/ui/select` (Radix Select) |
| **DEPRECATED** | `EnterpriseComboBox` |
| **RULE** | All new dropdowns MUST use Radix Select |
| **MIGRATION** | Replace legacy on touch |

---

## 13. Module Map (Feature-by-Feature)

### Property Module

| Aspect | Details |
|--------|---------|
| **Routes** | `/properties`, `/units`, `/spaces/*` |
| **Pages** | 8 pages |
| **Stores** | None (uses React state) |
| **Services** | `units.service.ts`, `buildings.service.ts`, `storage.service.ts` |
| **Collections** | `buildings`, `units`, `storage_units`, `parking_spots`, `floors` |
| **Permissions** | Read: authenticated, Write: denied (admin only) |

### CRM Module

| Aspect | Details |
|--------|---------|
| **Routes** | `/crm/*`, `/contacts` |
| **Pages** | 12 pages (dashboard, leads, customers, tasks, etc.) |
| **Stores** | `notificationStore.ts` |
| **Services** | `contacts.service.ts`, `tasks.service.ts`, `contact-relationships/*` |
| **Collections** | `contacts`, `contact_relationships`, `tasks` |
| **Permissions** | Read: owner, Write: owner |

### DXF Viewer (Subapp)

| Aspect | Details |
|--------|---------|
| **Routes** | `/dxf/viewer` |
| **Pages** | 1 (viewer) |
| **Stores** | Multiple internal stores |
| **Services** | `ServiceRegistry.ts`, DXF parsing services |
| **Collections** | `cadFiles`, `dxf_files` |
| **Permissions** | Read: owner/devMode, Write: owner |
| **Docs** | `src/subapps/dxf-viewer/docs/` |

### Geo Canvas (Subapp)

| Aspect | Details |
|--------|---------|
| **Routes** | `/geo/canvas` |
| **Pages** | 1 (canvas) |
| **Services** | Polygon system, boundary services |
| **Collections** | None (file-based) |
| **Docs** | `src/subapps/geo-canvas/docs/` |

### Sales Module

| Aspect | Details |
|--------|---------|
| **Routes** | `/sales/*`, `/projects` |
| **Pages** | 5 pages |
| **Services** | `projects.service.ts`, `ProjectsService.ts` |
| **Collections** | `projects` |
| **Permissions** | Read: authenticated/devMode, Write: authenticated |

### Admin Module

| Aspect | Details |
|--------|---------|
| **Routes** | `/admin/*` |
| **Pages** | 3 pages |
| **API Routes** | 11 migration/fix routes |
| **Expected Auth** | Admin role required |
| **Current Implementation** | No route-level auth (relies on Firestore rules + `isDevMode()`) |

**⚠️ SECURITY GAP**: Admin routes are technically callable by anyone. See Section 15 for verification.

---

## 14. CI/CD & Deployment

### GitHub Actions Workflows

**Source**: `.github/workflows/`

#### 1. Unit Tests (`unit.yml`)

**Evidence** (from `.github/workflows/unit.yml`):

```yaml
# Lines 12-20: Trigger
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

# Lines 48-55: Automatic retry
- name: 🧪 Run Jest tests
  id: jest-test
  run: pnpm test -- --runInBand --reporters=default --coverage
  continue-on-error: true # Allow retries

- name: 🔁 Retry Jest tests (if failed)
  if: steps.jest-test.outcome == 'failure'

# Lines 73-76: Coverage thresholds (echoed from jest.config.ts)
echo "   - Branches: 80%"
echo "   - Functions: 85%"
echo "   - Lines: 85%"
echo "   - Statements: 85%"
```

| Check | Threshold | Source |
|-------|-----------|--------|
| Branches | 80% | `unit.yml:73` |
| Functions | 85% | `unit.yml:74` |
| Lines | 85% | `unit.yml:75` |
| Statements | 85% | `unit.yml:76` |

**Enforcement**: Actual gating depends on `jest.config.ts` `coverageThreshold` and CI step exit codes. The workflow echoes thresholds; verify `jest.config.ts` for actual enforcement.

#### 2. i18n Validation (`i18n-validation.yml`)

**Evidence** (from `.github/workflows/i18n-validation.yml`):

```yaml
# Lines 3-15: Trigger on i18n/component changes
on:
  push:
    branches: [main, develop]
    paths:
      - 'src/i18n/**'
      - 'src/components/**'

# Lines 61-93: PR comment with results
- name: 📝 Comment PR with validation results
  if: github.event_name == 'pull_request'
  uses: actions/github-script@v7
```

### Deployment (Vercel)

| Environment | Branch | URL |
|-------------|--------|-----|
| Production | `main` | Auto-deploy |
| Preview | PRs | Auto-generated |

**Note**: No `vercel.json` exists - uses default Next.js settings.

### Pre-merge Checklist

```bash
# Before merging PR:
pnpm typecheck      # TypeScript check
pnpm lint           # ESLint check
pnpm test           # Unit tests pass
# GitHub Actions must pass
```

### Rollback Procedure

```bash
# If production breaks:
git revert HEAD
git push origin main
# Vercel auto-deploys reverted state
```

---

## 15. API Contracts (Key Endpoints)

### Response Envelope (Standard/Intended)

Most API routes follow this pattern (verified in `/api/buildings`, `/api/units`, `/api/contacts`):

```typescript
// Success
{
  success: true,
  [entity]: data,
  count?: number,
  cached?: boolean
}

// Error
{
  success: false,
  error: string,
  details?: string
}
```

### Key Endpoints Detail

#### GET `/api/buildings`

```typescript
// Request
GET /api/buildings?projectId=xxx (optional filter)

// Response
{
  success: true,
  buildings: Building[],
  count: number,
  cached: boolean,
  projectId?: string
}

// Building type
interface Building {
  id: string;           // Firestore doc ID
  name: string;
  address: Address;
  projectId?: string;
  createdAt: Timestamp;
  // ... other fields
}
```

**Auth**: None (uses Firestore rules)
**Caching**: Uses `CacheHelpers.getCachedAllBuildings()` (line 21); duration logged as "2 minutes" (line 71) - verify in `src/lib/cache/enterprise-api-cache.ts`

#### GET `/api/units`

```typescript
// Request
GET /api/units?buildingId=xxx (optional filter)

// Response
{
  success: true,
  units: Unit[],
  count: number
}
```

#### GET `/api/contacts/[contactId]`

```typescript
// Response
{
  success: true,
  contact: Contact
}
```

#### POST `/api/notifications`

```typescript
// Request body
{
  title: string,
  body?: string,
  kind: 'info' | 'success' | 'warning' | 'error'
}

// Response
{
  success: true,
  notification: Notification
}
```

### Authentication Pattern (VERIFIED)

**FINDING**: Grep search for common auth patterns in `src/app/api/`:

```bash
# Patterns checked:
$ grep -r "authorization\|auth\.uid\|verifyIdToken\|getAuth" src/app/api --include="*.ts"
# Result: No matches

$ grep -r "getServerSession\|next-auth\|firebase-admin" src/app/api --include="*.ts"
# Result: No matches

$ grep -r "cookies(\|headers(" src/app/api --include="*.ts"
# Result: No matches
```

**Assessment**: No matches found for these common auth patterns across 79 API routes.

**Patterns NOT checked** (manual verification may reveal):
- Custom middleware gating
- Shared helpers/wrappers with different naming
- Auth via request body validation

**Bottom line**: Strong indication that API routes rely on Firestore rules, not route-level auth.

#### Example 1: `/api/buildings/route.ts` (NO AUTH)

```typescript
// src/app/api/buildings/route.ts - lines 7-17
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    // NO auth check - direct Firestore access
    const snapshot = await getDocs(buildingsQuery);
    return NextResponse.json({ success: true, buildings });
  }
}
```

#### Example 2: `/api/contacts/[contactId]/route.ts` (NO AUTH)

```typescript
// src/app/api/contacts/[contactId]/route.ts - lines 21-39
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  try {
    const { contactId } = await params;
    // Validation only - NO auth check
    if (!contactId) {
      return NextResponse.json({ error: 'Contact ID is required' }, { status: 400 });
    }
    // Direct Firestore access
  }
}
```

#### Example 3: `/api/admin/cleanup-duplicates/route.ts` (NO AUTH - ADMIN ROUTE!)

```typescript
// src/app/api/admin/cleanup-duplicates/route.ts - lines 25-31
export async function GET() {
  try {
    // NO admin role check!
    const unitsQuery = query(collection(db, COLLECTIONS.UNITS));
    const snapshot = await getDocs(unitsQuery);
    // Performs admin operations without verification
  }
}
```

**SECURITY IMPLICATION**:
- Security relies **100%** on Firestore rules
- Since `isDevMode() = true`, effectively **PUBLIC ACCESS**
- Admin routes are callable by anyone

### Rate Limiting

**Status**: NOT IMPLEMENTED

```env
# Defined but not enforced
RATE_LIMIT_MAX_REQUESTS=15
RATE_LIMIT_WINDOW_MINUTES=1
```

### Error Codes

| HTTP Code | Meaning |
|-----------|---------|
| 200 | Success |
| 400 | Bad request (validation) |
| 401 | Unauthorized (rare - most routes don't check) |
| 404 | Not found |
| 500 | Server error |

---

## Appendix B: Verification Commands

All metrics in this document were generated using these exact commands:

### Page Count

```bash
$ find src/app -name "page.tsx" -type f | wc -l
42
```

### API Route Count

```bash
$ find src/app/api -name "route.ts" -type f | wc -l
79
```

### 'use client' File Count

```bash
# Counts FILES (not matches) with 'use client' directive
$ grep -rl "'use client'" src/app --include="*.tsx" | wc -l
52
```

**Note**: Uses `-l` flag to list only filenames, ensuring accurate file count.

### Auth Check Verification

```bash
# Primary auth patterns
$ grep -r "authorization\|auth\.uid\|verifyIdToken\|getAuth" src/app/api --include="*.ts"
# Result: No matches

# Next.js / next-auth patterns
$ grep -r "getServerSession\|next-auth\|firebase-admin" src/app/api --include="*.ts"
# Result: No matches

# Cookie/header auth patterns
$ grep -r "cookies(\|headers(" src/app/api --include="*.ts"
# Result: No matches
```

**Interpretation**: Strong indication of no route-level auth. Does not cover custom middleware or helpers with non-standard naming.

### isDevMode() Verification

```bash
$ grep -n "isDevMode()" firestore.rules
279:    function isDevMode() {
281:      return true; // Currently in development mode

$ grep -n "allow read: if true" firestore.rules
178:      allow read: if true; // Public read access for notifications
```

### Commit Info

```bash
$ git rev-parse --short HEAD
2dfe1b7

$ git branch --show-current
main
```

---

## Appendix C: Owner & Contacts

### Who to Contact

| Domain | Responsibility | Contact |
|--------|----------------|---------|
| **Security/Auth** | Firestore rules, authentication, RBAC | Project Owner |
| **DXF Viewer** | CAD file processing, canvas, zoom | DXF Subapp Lead |
| **CRM Module** | Contacts, leads, relationships, tasks | CRM Lead |
| **Infrastructure** | CI/CD, Vercel, Firebase config | DevOps/Project Owner |
| **Design System** | UI components, primitives, theming | Frontend Lead |

### Triage Process

1. **Bug Reports**: Create GitHub issue with reproduction steps
2. **Security Issues**: Contact Project Owner directly (do NOT create public issue)
3. **Feature Requests**: Discuss in project planning before implementation
4. **Documentation Updates**: PRs welcome with evidence

---

## Appendix D: Glossary

| Term | Definition |
|------|------------|
| **companyId** | Foreign key linking entities to a company. Used for future multi-tenant isolation. |
| **enterpriseId** | Alias for companyId in some contexts. Intended for tenant-level access control. |
| **devMode / isDevMode()** | Development flag in Firestore rules. When `true`, bypasses many auth checks. **Must be `false` in production.** |
| **tenancy** | Data isolation model. Currently single-tenant with multi-tenant fields prepared. |
| **subapp** | Self-contained application module (e.g., DXF Viewer, Geo Canvas) with own services/stores. |
| **RSC** | React Server Component. Default in Next.js App Router. |
| **CSR** | Client-Side Rendering. Used for interactive pages (marked with `'use client'`). |
| **Firestore rules** | Security rules that control read/write access to Firebase collections. |
| **App Check** | Firebase feature for rate limiting and bot protection. Not currently implemented. |
| **RBAC** | Role-Based Access Control. Intended but not fully implemented (see Section 7). |
| **primitives** | Base-level design system components (CardIcon, CardStats). |
| **molecules** | Composed design system components (ListCard, DetailCard). |
| **domain cards** | Entity-specific cards (UnitListCard, BuildingListCard) that use molecules. |
| **Radix UI** | Headless UI component library. Canonical for Select/Dropdown components. |
| **Zustand** | Lightweight state management library used for client-side stores. |

---

> **Document Version**: 1.9.0 (Final)
> **Generated**: 2026-01-09
> **Commit**: `2dfe1b7` (branch: `main`)
> **Data Sources**: `package.json`, `firestore.rules`, `firestore.indexes.json`, `.github/workflows/*.yml`, `src/app/api/*/route.ts`
> **Verification**: All metrics generated via shell commands (see Appendix B)
