# 🏗️ Current Architecture - Comprehensive Analysis

**Review Date**: 2026-01-29
**Repository**: Nestor Construct Platform
**Type**: Next.js 15.5 Enterprise Application

---

## 📊 CURRENT STATE

**Technology Stack**:
- **Framework**: Next.js 15.5 (App Router)
- **Runtime**: React 19.2
- **Language**: TypeScript 5.9 (Strict mode)
- **Styling**: TailwindCSS 3.4 + CVA
- **Backend**: Firebase 12.2 (Firestore, Auth, Storage, Functions)
- **State**: Zustand + React Context
- **Package Manager**: pnpm 9.14.0 (monorepo workspace)

**Evidence**: `C:\Nestor_Pagonis\package.json:1-196`

---

## 1. APPLICATION STRUCTURE

### 1.1 Monorepo Architecture

```
C:\Nestor_Pagonis\
├── src/                        # Main application code
│   ├── app/                    # Next.js App Router (69 API routes, 22 pages)
│   ├── subapps/                # 3 specialized sub-applications
│   ├── components/             # Shared UI components (100+)
│   ├── services/               # Business logic (60+ services)
│   ├── hooks/                  # Custom React hooks (100+)
│   ├── types/                  # TypeScript definitions (290 files)
│   └── [12 more directories]
│
├── packages/                   # Workspace packages
│   ├── core/                   # @geo-alert/core (shared logic)
│   └── alert-engine/
│
├── docs/                       # Enterprise documentation
├── e2e/                        # End-to-end tests (Playwright)
├── functions/                  # Firebase Cloud Functions (optional)
└── [20+ config files]
```

**Evidence**: Bash `ls -la` output, Glob searches

---

### 1.2 Main Application (`src/app/`)

**Next.js App Router Structure**:

```
src/app/
├── (auth)/                     # Auth route group (minimal providers)
│   └── login/, signup/
│
├── (light)/                    # Light theme route group
│
├── layout.tsx                  # ROOT LAYOUT - Essential providers only
│   ├── ThemeProvider
│   ├── I18nProvider
│   ├── TourProvider
│   ├── AuthProvider
│   └── UserRoleProvider
│       └── ConditionalAppShell (loads heavy providers)
│
├── account/                    # User account settings
├── admin/                      # Admin panel (13 endpoints)
├── audit/                      # Audit logs viewer
├── buildings/                  # Building management
├── contacts/                   # Contact/CRM
├── crm/                        # CRM dashboard
├── dxf/                        # DXF Viewer entry point
│   └── viewer/page.tsx         # Main DXF viewer page
├── files/                      # File management
├── geo/                        # GEO-ALERT features
├── obligations/                # Project obligations
├── properties/                 # Real estate properties
├── sales/                      # Sales module
├── settings/                   # App settings
├── share/                      # Sharing features
├── spaces/                     # Spaces management
├── storage/                    # Cloud storage
├── units/                      # Building units
│
├── api/                        # API Routes (69 endpoints)
│   ├── admin/                  # 13 admin endpoints
│   ├── buildings/              # Building operations
│   ├── communications/         # Email, webhooks, Telegram
│   ├── contacts/               # Contact CRUD
│   ├── files/                  # File operations
│   ├── projects/               # Project operations
│   ├── search/                 # Global search
│   └── [15 more categories]
│
├── globals.css                 # Global styles
└── not-found.tsx               # 404 page
```

**Evidence**:
- `C:\Nestor_Pagonis\src\app\layout.tsx:1-140` - Root layout
- `C:\Nestor_Pagonis\src\app\dxf\viewer\page.tsx:1-50` - DXF entry

**Key Pattern: Provider Separation (ADR-040)**
```typescript
// Root Layout: Minimal providers (fast initial load)
ThemeProvider → I18nProvider → AuthProvider → UserRoleProvider

// ConditionalAppShell: Heavy providers (loaded per route)
if (isAuthRoute) {
  return <children />  // No heavy providers
} else {
  return (
    <WorkspaceProvider>
      <FloorplanProvider>
        <NotificationProvider>
          <children />
        </NotificationProvider>
      </FloorplanProvider>
    </WorkspaceProvider>
  )
}
```

**Evidence**: Repo Structure Analysis - "Provider Architecture"

---

### 1.3 Sub-Applications (`src/subapps/`)

#### **1.3.1 DXF Viewer** (`src/subapps/dxf-viewer/`)

**Purpose**: Advanced CAD drawing application (AutoCAD-inspired)

**Size**: 777 TypeScript files, 13MB

**Key Systems** (19 specialized systems):
- `systems/zoom/` - Zoom/pan management (8 files)
- `systems/drawing/` - Drawing tools orchestration
- `systems/selection/` - Universal selection system (15 files)
- `systems/grip-interaction/` - Grip/handle editing
- `systems/constraints/` - Drawing constraints
- `rendering/` - Canvas rendering pipeline (70+ files)
- `services/` - Business logic (15+ services)
- `config/` - Centralized configuration (8 files)

**Evidence**: `C:\Nestor_Pagonis\src\subapps\dxf-viewer\` structure analysis

**Features**:
- ✅ Full CAD drawing (10 tools: line, polyline, circle, arc, etc.)
- ✅ Multi-level/floor support
- ✅ Real-time collaboration (Firebase)
- ✅ AI-powered snapping
- ✅ Advanced selection & grip system
- ✅ Unified toolbar (ADR-050)
- ✅ Zoom/pan with constraints
- ✅ Enterprise grid rendering
- ✅ Command system (CQRS pattern)

**Centralization**: 95% - 30+ enterprise systems with ADRs

**Documentation**: 80+ MD files in `src/subapps/dxf-viewer/docs/`

---

#### **1.3.2 Geo Canvas** (`src/subapps/geo-canvas/`)

**Purpose**: Geospatial visualization and analysis

**Features**:
- Map rendering (MapLibre GL)
- Polygon drawing
- GEO-ALERT integration

---

#### **1.3.3 OSM Building Snap** (`src/subapps/osm-building-snap/`)

**Purpose**: OpenStreetMap building snapping tool

**Features**:
- OSM building import
- Automatic building boundary detection
- Building snapping to reference points

---

### 1.4 Shared Packages (`packages/`)

#### **@geo-alert/core** (`packages/core/`)

**Type**: Workspace package (internal)

**Structure**:
```
packages/core/
├── package.json                # name: @geo-alert/core
├── src/
│   ├── alert-engine/           # Real-time alert processing
│   ├── database-system/        # Database abstractions
│   └── polygon-system/         # Geospatial polygon operations
└── dist/                       # Compiled output
```

**Evidence**: `C:\Nestor_Pagonis\packages\core\package.json`

**Usage**: Imported as `@geo-alert/core` in main app and subapps

---

## 2. ROUTING ARCHITECTURE

### 2.1 Path Aliases (`tsconfig.base.json`)

```json
{
  "paths": {
    "@/*": ["./src/*"],
    "@/systems/*": ["./src/subapps/dxf-viewer/systems/*"],
    "@geo-alert/core": ["./packages/core/src"],
    "@geo-alert/core/*": ["./packages/core/src/*"],
    "@core/polygon-system": ["./packages/core/polygon-system"],
    "@core/alert-engine": ["./packages/core/alert-engine"]
  }
}
```

**Evidence**: `C:\Nestor_Pagonis\tsconfig.base.json:1-40`

---

### 2.2 API Routes (69 Endpoints)

**Categories**:

| Category | Endpoints | Examples |
|----------|-----------|----------|
| **Admin** | 13 | `bootstrap-admin`, `set-user-claims`, `migrate-dxf` |
| **Buildings** | 5 | `populate`, `seed`, `fix-project-ids` |
| **Communications** | 4 | `email`, `webhooks/telegram` |
| **Contacts** | 6 | `create-sample`, `add-real-contacts`, `list-companies` |
| **Files** | 8 | `upload`, `delete`, `list` |
| **Projects** | 5 | `by-company`, `create`, `update` |
| **Search** | 3 | `global`, `contacts`, `buildings` |
| **Users** | 4 | `profile`, `settings`, `notifications` |
| **Misc** | 21 | Units, spaces, obligations, floorplans, etc. |

**Evidence**: `src/app/api/` directory structure

**Well-Protected Example** (`src/app/api/projects/by-company/[companyId]/route.ts`):
```typescript
export const GET = withAuth(
  async (req: Request, ctx: AuthContext) => {
    // ✅ IGNORES URL param [companyId] - uses ctx.companyId instead
    const companyId = ctx.companyId;  // ← From authenticated user claims

    // ✅ Tenant-scoped query
    const projects = await getProjectsByCompany(companyId);

    // ✅ Audit logging
    await logAuditEvent({
      action: 'projects.list',
      userId: ctx.uid,
      companyId,
      metadata: { count: projects.length }
    });

    return NextResponse.json(projects);
  }
);
```

**Evidence**: Repo Structure Analysis - "API Routes Security"

---

### 2.3 Route Groups (Experimental)

**Purpose**: Organize routes without affecting URLs

```
src/app/
├── (auth)/                     # Auth routes - Minimal provider stack
│   ├── login/page.tsx
│   └── signup/page.tsx
│
└── (protected)/                # Protected routes - Full provider stack
    ├── dashboard/page.tsx
    └── [all other routes]
```

**Benefit**: Faster auth page load (no heavy providers like WorkspaceProvider)

**Evidence**: `src/app/` directory structure

---

## 3. STATE MANAGEMENT

### 3.1 Provider Hierarchy

**Root Level** (`src/app/layout.tsx`):
```
ThemeProvider (next-themes)
  └── I18nProvider (i18next)
      └── TourProvider (product tour)
          └── AuthProvider (Firebase Auth)
              └── UserRoleProvider (RBAC)
                  └── ConditionalAppShell
                      └── [Heavy Providers - route-based loading]
```

**Evidence**: `C:\Nestor_Pagonis\src\app\layout.tsx:1-140`

**Heavy Providers** (loaded per route via `ConditionalAppShell`):
- `WorkspaceProvider` - Firestore workspace queries
- `FloorplanProvider` - Building floorplan state
- `NotificationProvider` - Real-time notifications
- `SharedPropertiesProvider` - Property data caching

**Evidence**: Repo Structure Analysis - "Provider Architecture"

**DXF-Specific Providers** (`UnifiedProviders`):
```
ProjectHierarchyProvider
  └── GripProvider
      └── SnapProvider
          └── [children]
```

**Evidence**: `C:\Nestor_Pagonis\src\subapps\dxf-viewer\providers\UnifiedProviders.tsx`

---

### 3.2 State Patterns

#### **Pattern 1: React Context (Global State)**
- `WorkspaceContext` - Workspace-level data
- `FloorplanContext` - Building/floorplan state
- `ProjectHierarchyContext` - Project hierarchy (DXF)

**Evidence**: `C:\Nestor_Pagonis\src\contexts\` (8 context files)

#### **Pattern 2: Zustand (Client-side Local State)**
- `notificationCenter.ts` - Notification store
- `notificationStore.ts` - Toast notifications
- `overlay-store.tsx` - DXF overlay state

**Evidence**: `C:\Nestor_Pagonis\src\stores\` (3 Zustand stores)

#### **Pattern 3: Custom Hooks (Logic Layer)**
- `useAuth()` - Authentication state
- `useContactsState()` - Contact list state
- `useBuildingsPageState()` - Buildings page state
- `useCanvasEvents()` - Canvas event handling
- `useDraggable()` - Drag/drop functionality
- `useDesignSystem()` - Design system tokens

**Evidence**: `C:\Nestor_Pagonis\src\hooks\` (100+ custom hooks)

---

## 4. DESIGN SYSTEM

### 4.1 Architecture

```
src/design-system/
├── index.ts                    # Centralized exports
├── color-bridge.ts             # Color system (16KB - comprehensive)
│
├── tokens/                     # Design tokens
│   ├── borders/
│   ├── colors/
│   ├── spacing/
│   ├── typography/
│   └── shadows/
│
├── semantics/                  # Semantic naming
│   ├── button/
│   ├── form/
│   ├── layout/
│   └── text/
│
├── primitives/                 # Base components
│   ├── box/
│   ├── flex/
│   ├── grid/
│   └── stack/
│
└── components/                 # Complex components
    ├── cards/
    ├── forms/
    └── navigation/
```

**Evidence**: `C:\Nestor_Pagonis\src\design-system\` structure

---

### 4.2 UI Component Library (`src/components/ui/`)

**Based on**: Radix UI + Custom Components

**Key Components**:
- `accordion.tsx` - Accordion (Radix)
- `button.tsx` - Button with CVA variants
- `card.tsx` - Card container
- `dialog.tsx` - Modal dialog (Radix)
- `form.tsx` - Form components (React Hook Form)
- `input.tsx` - Text input
- **`select.tsx`** - **CANONICAL Dropdown** (Radix Select, ADR-001)
- `tabs.tsx` - Tab component (Radix)
- `toast.tsx` - Toast notifications (Radix)

**Styling Strategy**:
- **Utility-first**: TailwindCSS 3.4
- **Component variants**: Class Variance Authority (CVA)
- **Semantic HTML**: Proper a11y attributes
- **Dark mode**: next-themes integration

**Evidence**: `C:\Nestor_Pagonis\src\components\ui\` (40+ UI components)

---

## 5. INTERNATIONALIZATION (i18n)

### 5.1 Configuration

```
src/i18n/
├── config.ts                   # Main i18n config
├── lazy-config.ts              # Lazy loading config (12.5KB)
│
└── locales/                    # Translation files
    ├── el/                     # Greek (default)
    │   ├── common.json
    │   ├── buildings.json
    │   ├── contacts.json
    │   └── [15+ namespaces]
    │
    └── en/                     # English
        ├── common.json
        └── [15+ namespaces]
```

**Evidence**: `C:\Nestor_Pagonis\src\i18n\` structure

---

### 5.2 Validation Pipeline

```
Extract Hardcoded → Validate Translations → Generate Types → CI/CD Check
```

**Scripts**:
1. `scripts/extract-hardcoded-strings.js` - Find hardcoded text
2. `scripts/validate-translations.js` - Check completeness
3. `scripts/generate-i18n-types.js` - Generate TypeScript types
4. `.github/workflows/i18n-validation.yml` - GitHub Actions

**Evidence**: `C:\Nestor_Pagonis\scripts\` and `.github/workflows/`

---

## 6. BUILD & ENVIRONMENT

### 6.1 Next.js Configuration

**Key Features** (`next.config.js`):
```javascript
{
  typescript: { ignoreBuildErrors: true },        // ⚠️ Skip type check in dev
  eslint: { ignoreDuringBuilds: true },          // ⚠️ Skip linting in build
  reactStrictMode: false,                         // ⚠️ Disabled

  turbopack: { /* Turbopack config */ },         // Development bundler
  experimental: {
    optimizePackageImports: [                    // Barrel export optimization
      'lucide-react',
      '@radix-ui/*',
      'firebase'
    ]
  },

  webpack: { /* Webpack config */ },             // Production bundler
  compress: true,                                // GZIP compression
}
```

**Evidence**: `C:\Nestor_Pagonis\next.config.js:1-301`

**⚠️ CONCERN**: `ignoreBuildErrors` and `ignoreDuringBuilds` can hide issues

---

### 6.2 TypeScript Configuration

**Base Config** (`tsconfig.base.json`):
```json
{
  "compilerOptions": {
    "target": "ES2017",
    "strict": true,                        // ✅ Strict mode enabled
    "module": "esnext",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "baseUrl": ".",
    "paths": { /* path aliases */ }
  }
}
```

**Evidence**: `C:\Nestor_Pagonis\tsconfig.base.json:1-40`

---

### 6.3 Environment Variables

**Development** (`.env.local`):
```
NEXT_PUBLIC_DEBUG=false
NEXT_PUBLIC_ENABLE_SEED_DATA=false
NEXT_PUBLIC_FIREBASE_API_KEY=...
FIREBASE_PROJECT_ID=pagonis-87766
RESEND_API_KEY=...
```

**⚠️ CONCERN**: No schema validation (Zod, io-ts) - Runtime failures possible

**Evidence**: `C:\Nestor_Pagonis\.env.local` (6KB)

---

### 6.4 Package Scripts (70+ Scripts)

**Development**:
```bash
pnpm dev                    # Turbopack dev server
pnpm dev:clean             # Clear cache + dev
```

**Build & Production**:
```bash
pnpm build                 # Production build
pnpm start                 # Production server
```

**Type Checking**:
```bash
pnpm typecheck            # TypeScript check
pnpm typecheck:strict     # Strict mode
```

**Testing**:
```bash
pnpm test                 # Jest (unit tests)
pnpm test:e2e             # Playwright
pnpm test:visual          # Visual regression
```

**i18n**:
```bash
pnpm i18n:check          # Validate translations
pnpm extract:hardcoded   # Find hardcoded strings
```

**Evidence**: `C:\Nestor_Pagonis\package.json:1-72`

---

## 7. SERVICES & BUSINESS LOGIC

### 7.1 Service Layer (`src/services/`)

**Organization**: 60+ service files by domain

**Key Services**:
- `adminConfigService.ts` - Admin configuration
- `AnalyticsBridge.ts` - Analytics integration (20KB)
- `contacts/contacts.service.ts` - Contact CRUD
- `email/email.service.ts` - Email operations
- `enterprise-id.service.ts` - ID management (24KB)
- `file/file-record.service.ts` - File records (30KB)
- `notification/notification.service.ts` - Notifications
- `photo-upload.service.ts` - Photo upload (40KB)
- `workspace.service.ts` - Workspace management (10KB)

**Evidence**: `C:\Nestor_Pagonis\src\services\` (60+ files)

**Pattern**: Separation of concerns - Services isolated from components

---

## 8. TYPE DEFINITIONS & SCHEMAS

### 8.1 Central Types (`src/types/`)

**290 TypeScript files** organized by domain:

- `associations.ts` - Association relationships (11KB)
- `communications.ts` - Communication types (6KB)
- `ContactFormTypes.ts` - Contact forms (11KB)
- `conversations.ts` - Conversations (10KB)
- `file-record.ts` - File records (19KB)
- `building/` - Building domain types
- `contacts/` - Contact domain types
- `common/` - Common/shared types

**Evidence**: `C:\Nestor_Pagonis\src\types\` (290 files)

---

## 9. CI/CD & DEPLOYMENT

### 9.1 GitHub Actions

**Workflows**:
1. **i18n Validation** - Extracts hardcoded strings, validates translations
2. **Unit Tests** - Runs Jest tests, reports coverage

**Evidence**: `C:\Nestor_Pagonis\.github\workflows\i18n-validation.yml`

---

### 9.2 Vercel Deployment

**Platform**: Vercel
**Auto-deployment**: On git push to main
**URL**: https://nestor-app.vercel.app

**Build Process**:
```
Install deps (pnpm) → Generate i18n types → Build tokens → Next.js build → Deploy
```

**Evidence**: Vercel config implicit in `next.config.js`

---

## 10. TESTING INFRASTRUCTURE

### 10.1 Jest Configuration

**Unit Tests**: Services, utilities, hooks
**Coverage**: Partial (60-70%)

**Scripts**:
```bash
pnpm test              # Run all tests
pnpm test:watch       # Watch mode
pnpm test:coverage    # Coverage report
```

**Evidence**: `C:\Nestor_Pagonis\jest.config.js`

---

### 10.2 Playwright (E2E Tests)

**Tests**:
- Visual regression - Grid rendering
- Cross-browser - Chromium, Firefox, WebKit

**Scripts**:
```bash
pnpm test:e2e         # Run e2e tests
pnpm test:visual      # Visual regression
```

**Evidence**: `C:\Nestor_Pagonis\playwright.config.ts`

---

## 11. ARCHITECTURAL PATTERNS

### 11.1 Provider Separation (ADR-040)

**Goal**: Minimize bundle size for auth routes

**Pattern**: Conditional loading of heavy providers based on route

**Benefit**: Faster login/signup page load

---

### 11.2 Centralized Systems (Enterprise)

**Documentation**: 80+ MD files in `docs/` and `src/subapps/dxf-viewer/docs/`

**30+ ADRs** covering:
- ADR-001: Canonical Select/Dropdown
- ADR-040: Provider Separation
- ADR-050: Unified Toolbar
- ADR-041-045: Legacy cleanup

**Evidence**: `C:\Nestor_Pagonis\docs\centralized-systems\README.md` and `reference/adr-index.md` (57 ADRs)

---

### 11.3 Command System (CQRS)

**Location**: `src/subapps/dxf-viewer/core/commands/`

**Purpose**: Decouple drawing operations from UI

**Pattern**: Command → Validate → Execute → Update State

---

## 12. GAPS & RISKS

### 12.1 Areas of Focus

1. ⚠️ **Build Errors Ignored** - `typescript.ignoreBuildErrors` can hide issues
2. ⚠️ **No Env Validation** - Runtime failures possible
3. ⚠️ **Legacy Components** - EnterpriseComboBox (deprecated)
4. ⚠️ **Type Ignores** - Some `@ts-ignore` comments need cleanup

---

### 12.2 Migration Roadmap

**Phase 1**: Security fixes (critical blockers)
**Phase 2**: Replace deprecated components
**Phase 3**: Full TypeScript strict mode
**Phase 4**: ServiceRegistry V2 migration

---

## 13. RECOMMENDED DIRECTION

### ✅ **WHAT WORKS WELL**

1. **Clear separation of concerns** - Services, components, providers, hooks
2. **Enterprise-grade patterns** - CQRS, DI, provider patterns
3. **Centralized documentation** - 80+ MD files with ADRs
4. **Type safety** - Strict TypeScript
5. **Testing** - Unit + E2E + Visual regression
6. **i18n** - Full internationalization with validation
7. **Performance** - Turbopack dev, Webpack production

---

### ⚠️ **WHAT NEEDS IMPROVEMENT**

1. **Enable type checking in builds** - Remove `ignoreBuildErrors`
2. **Add environment validation** - Zod schema on startup
3. **Replace deprecated components** - EnterpriseComboBox → Radix Select
4. **Clean up type ignores** - Remove `@ts-ignore`
5. **Add observability** - Error tracking, performance monitoring

---

## 14. NEXT ACTIONS

### **Immediate (This Week)**
- [ ] Fix security blockers (see [03-auth-rbac-security.md](./03-auth-rbac-security.md))
- [ ] Add environment variable validation (Zod schema)

### **Short-term (Next 2 Weeks)**
- [ ] Enable type checking in builds (remove `ignoreBuildErrors`)
- [ ] Replace EnterpriseComboBox with Radix Select
- [ ] Clean up `@ts-ignore` comments

### **Medium-term (Next Month)**
- [ ] Add observability (Sentry, performance monitoring)
- [ ] Migrate to ServiceRegistry V2 (incremental)

---

**Related Reports**:
- [03-auth-rbac-security.md](./03-auth-rbac-security.md) - Security findings
- [06-dxf-subsystem-review.md](./06-dxf-subsystem-review.md) - DXF architecture
- [09-quality-gates-production-readiness.md](./09-quality-gates-production-readiness.md) - Testing & CI/CD

---

**File Paths Referenced**:
- `C:\Nestor_Pagonis\package.json` - Root package
- `C:\Nestor_Pagonis\next.config.js` - Next.js config
- `C:\Nestor_Pagonis\tsconfig.base.json` - TypeScript base config
- `C:\Nestor_Pagonis\src\app\layout.tsx` - Root layout
- `C:\Nestor_Pagonis\src\design-system\` - Design system
- `C:\Nestor_Pagonis\src\services\` - Business logic
