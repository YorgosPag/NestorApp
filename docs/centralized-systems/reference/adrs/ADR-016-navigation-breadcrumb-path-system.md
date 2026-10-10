# ADR-016: Navigation Breadcrumb Path System

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Updated** | 2026-03-12 |
| **Category** | UI Components |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

Δύο τύποι breadcrumb καλύπτουν **κάθε σελίδα** της εφαρμογής:

| Τύπος | Component | Χρήση |
|-------|-----------|-------|
| **Entity Breadcrumb** | `NavigationBreadcrumb` | Entity hierarchy: Company → Project → Building → Unit |
| **Module Breadcrumb** | `ModuleBreadcrumb` | Module path: Αρχική → CRM → Εργασίες |

---

## 1. NavigationBreadcrumb (Entity Hierarchy)

- **File**: `src/components/navigation/components/NavigationBreadcrumb.tsx`
- **Context**: `syncBreadcrumb()` from `NavigationContext`
- **Type**: `BreadcrumbEntityRef` (lightweight display-only)
- **Ιεραρχία**: Companies → Projects → Buildings → Units/Storage/Parking
- **URLs**: Via `ContextualNavigationService.generateRoute()`

### Σελίδες που χρησιμοποιούν NavigationBreadcrumb

| Route | Header Component |
|-------|------------------|
| `/navigation` | NavigationBreadcrumb + NavigationTree |
| `/projects` | ProjectsHeader.tsx |
| `/buildings` | BuildingsHeader.tsx |
| `/units` | UnitsHeader.tsx |
| `/spaces/parking` | ParkingsHeader.tsx |
| `/spaces/storage` | StoragesHeader.tsx |
| `/properties` | PropertiesHeader.tsx |
| `/files` | FileManagerPageContent.tsx |
| `/sales/available-*` | SalesAvailableHeader.tsx |

---

## 2. ModuleBreadcrumb (Module Path)

- **File**: `src/components/shared/ModuleBreadcrumb.tsx`
- **Pattern**: Auto-generates breadcrumb from URL path via `usePathname()`
- **i18n**: `navigation.module.*` keys (EL + EN)
- **Visual**: Colored lucide icons per module, `→` separator (matches NavigationBreadcrumb), `hidden sm:flex`
- **Placement**: INSIDE page headers (PageHeader `breadcrumb` prop, or manual `<header>` elements)

### Route → Breadcrumb Mapping

```
/crm                     → 🏠 Αρχική → 📊 CRM
/crm/tasks               → 🏠 Αρχική → 📊 CRM → 📋 Εργασίες
/crm/calendar            → 🏠 Αρχική → 📊 CRM → 📅 Ημερολόγιο
/crm/leads               → 🏠 Αρχική → 📊 CRM → 🎯 Leads
/crm/pipeline            → 🏠 Αρχική → 📊 CRM → 🔀 Pipeline
/crm/communications      → 🏠 Αρχική → 📊 CRM → 📞 Επικοινωνίες
/sales                   → 🏠 Αρχική → 💲 Πωλήσεις
/spaces                  → 🏠 Αρχική → 🏗️ Χώροι
/obligations             → 🏠 Αρχική → ⚖️ Υποχρεώσεις
/contacts                → 🏠 Αρχική → 👥 Επαφές
/accounting              → 🏠 Αρχική → 🧮 Λογιστικό
/accounting/*            → 🏠 Αρχική → 🧮 Λογιστικό → [sub]
/account/profile         → 🏠 Αρχική → 👤 Λογαριασμός → Προφίλ
/account/preferences     → 🏠 Αρχική → 👤 Λογαριασμός → Προτιμήσεις
/account/privacy         → 🏠 Αρχική → 👤 Λογαριασμός → Απόρρητο
/account/security        → 🏠 Αρχική → 👤 Λογαριασμός → Ασφάλεια
/account/notifications   → 🏠 Αρχική → 👤 Λογαριασμός → Ειδοποιήσεις
/admin/ai-inbox          → 🏠 Αρχική → ⚙️ Διαχείριση → AI Inbox
/admin/operator-inbox    → 🏠 Αρχική → ⚙️ Διαχείριση → Operator Inbox
```

### Σελίδες + Τοποθέτηση

| Route | Placement | File |
|-------|-----------|------|
| `/crm` | Inside header div | `src/app/crm/page.tsx` |
| `/crm/tasks` | PageHeader `breadcrumb` prop | `src/app/crm/tasks/page.tsx` |
| `/crm/calendar` | Inside `<header>` element | `src/app/crm/calendar/page.tsx` |
| `/crm/leads` | Inside `<header>` wrapper | `src/app/crm/leads/page.tsx` |
| `/crm/pipeline` | Inside `<header>` wrapper | `src/app/crm/pipeline/page.tsx` |
| `/crm/communications` | PageHeader `breadcrumb` prop | `src/app/crm/communications/page.tsx` |
| `/sales` | Inside header div | `src/app/sales/page.tsx` |
| `/spaces` | Inside header div | `src/app/spaces/page.tsx` |
| `/obligations` | Inside `<header>` element | `src/app/obligations/page.tsx` |
| `/contacts` | ContactsHeader → PageHeader `breadcrumb` | `src/components/contacts/ContactsPageContent.tsx` |
| `/accounting` | Above (no header to target) | `src/app/accounting/page.tsx` |
| `/account/*` (5 pages) | Account layout `<header>` | `src/app/account/layout.tsx` |
| `/admin/ai-inbox` | AIInboxHeader → PageHeader `breadcrumb` | `src/app/admin/ai-inbox/AIInboxClient.tsx` |
| `/admin/operator-inbox` | PageHeader `breadcrumb` prop | `src/app/admin/operator-inbox/OperatorInboxClient.tsx` |

### Εξαιρέσεις (χωρίς breadcrumb)

- `/` — Home page (root)
- `/(auth)/*` — Login/auth pages
- `/share/*`, `/shared/*` — Public pages
- `/debug/*`, `/test-*`, `/demo/*` — Dev pages
- `/data-deletion`, `/privacy-policy`, `/terms` — Legal pages
- `/attendance/check-in/*` — Public QR page
- `/dxf/viewer` — Has its own DxfBreadcrumb

---

## API Reference

### useBreadcrumbSync (ADR-016 §3 — Centralized hook)

**File**: `src/components/navigation/core/hooks/useBreadcrumbSync.ts`

Centralizes `syncBreadcrumb()` calls across all entity pages. Each entity type uses the correct resolution strategy internally — callers pass only the entity descriptor.

```tsx
import { useBreadcrumbSync } from '@/components/navigation/core/hooks/useBreadcrumbSync';

// project
useBreadcrumbSync(selectedProject ? { type: 'project', id: selectedProject.id, name: selectedProject.name, companyId: selectedProject.companyId, linkedCompanyId: selectedProject.linkedCompanyId, company: selectedProject.company } : null);

// building
useBreadcrumbSync(selectedBuilding?.projectId ? { type: 'building', id: selectedBuilding.id, name: selectedBuilding.name, projectId: selectedBuilding.projectId } : null);

// property  (uses hierarchy API internally — Admin SDK, tenant-safe)
useBreadcrumbSync(selectedProperty ? { type: 'property', id: selectedProperty.id, name: selectedProperty.name } : null);

// space (parking / storage)
useBreadcrumbSync(
  selectedParking ? { type: 'space', id: selectedParking.id, name: selectedParking.number, spaceType: 'parking', buildingId: selectedParking.buildingId, projectId: String(selectedParking.projectId) } : null,
  { buildings }
);
```

**Resolution strategies per type:**

| Type | Strategy |
|------|----------|
| `project` | NavigationContext `projects` → resolved company name from bootstrap step 3.6 |
| `building` | NavigationContext `projects` → `project.company` name |
| `property` | Hierarchy API `/api/properties/[id]/hierarchy` (Admin SDK) — cancellable async |
| `space` | `options.buildings` (from `useFirestoreBuildings`) + NavigationContext `projects` |

### ModuleBreadcrumb

```tsx
import { ModuleBreadcrumb } from '@/components/shared/ModuleBreadcrumb';

<ModuleBreadcrumb className="px-6 pt-4" />
```

| Prop | Type | Description |
|------|------|-------------|
| `className` | `string?` | Additional CSS classes |

### Adding a new route

Add the URL segment to `SEGMENT_CONFIG` in `ModuleBreadcrumb.tsx` (with `labelKey`, `icon`, and `color`) and add the corresponding i18n key to `navigation.module.*` in both `el/navigation.json` and `en/navigation.json`.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-01-01 | Initial: NavigationBreadcrumb for entity hierarchy |
| 2026-03-12 | Added ModuleBreadcrumb for module/dashboard pages (18 pages) |
| 2026-03-12 | Fix: moved breadcrumb INSIDE headers, `→` separator, colored icons per module |
| 2026-04-24 | Added `useBreadcrumbSync` hook — centralized SSoT for all 5 entity page types (project/building/property/parking/storage). Eliminates per-page useEffect scatter. |
| 2026-10-04 | 🔴 **Στο breadcrumb δεν εμφανίζεται ποτέ η ταυτότητα της εταιρείας.** Τρία σημεία του `useBreadcrumbSync` (έργο · κτίριο · χώρος) έγραφαν `όνομα \|\| companyId` ⇒ αμέσως μετά τη δημιουργία έργου η γραμμή έδειχνε `cont_…` (μετρημένο ζωντανά). Νέο `hooks/breadcrumb-company-name.ts`: `breadcrumbCompanyName` (όνομα έργου πλοήγησης → όνομα οντότητας → `companies` της πλοήγησης → **κενό**) και `projectBreadcrumbTrail` (οι δύο κρίκοι που μοιράζονται κτίριο και χώρος). Κενό όνομα ⇒ το `NavigationBreadcrumb` **παραλείπει** τον κρίκο. Το effect εξαρτάται πλέον και από όνομα/εταιρεία της οντότητας, ώστε να ξανασυγχρονίζει όταν τα μάθει. Tests: `breadcrumb-company-name.test.ts` (6). |
| 2026-10-10 | **Το κοινό breadcrumb και στον DXF Viewer — ίδιος κώδικας, όχι αντίγραφο.** Νέο φύλλο `dxf-viewer/components/dxf-layout/ViewerLocationBreadcrumb.tsx` στη δεξιά άκρη του `ViewerContextStrip` (ADR-782 §25): είναι **μόνο** ο προσαρμογέας «κατάσταση θεατή → περιγραφικό οντότητας»· η ιεραρχία λύνεται από το `useBreadcrumbSync` και η απόδοση είναι το `NavigationBreadcrumb`. **Δύο βαθμίδες**: ενεργό κτίριο (`useActiveBuildingId`, ADR-845 §7.15) χωρίς επιλεγμένη περιοχή ⇒ `type: 'building'` (Εταιρεία → Έργο → Κτίριο)· επιλεγμένη περιοχή με `linked.propertyId` ⇒ `type: 'property'` (… → Ακίνητο). Το ειδικότερο κερδίζει, και η αποεπιλογή **γυρίζει στο κτίριο** αντί να σβήνει τη γραμμή. Αποδίδεται μόνο όταν το `NavigationContext` έχει λύσει **αυτή** την οντότητα (το context είναι καθολικό ⇒ όσο τρέχει το αίτημα κρατά την προηγούμενη). Ο **όροφος** δεν είναι κρίκος (τον δείχνει το `FloorTabBar`). Tests: `viewer-location-breadcrumb.test.tsx` (7). ⚠️ Εκτός εμβέλειας: (α) περιοχές συνδεδεμένες με **θέση στάθμευσης/αποθήκη** (ο κλάδος `space` θέλει λίστα κτιρίων)· (β) επίπεδα-κατόψεις **ακινήτου** (`floorplanType: 'unit'`) — το `Level` δεν κρατά `propertyId`, μόνο `entityLabel`, άρα σταματούν στο κτίριο· (γ) το παλαιό `DxfBreadcrumb` της παλέτας (… → **Όροφος**, μη κλικαριστό — άλλο περιεχόμενο, δική του απόδοση). |
