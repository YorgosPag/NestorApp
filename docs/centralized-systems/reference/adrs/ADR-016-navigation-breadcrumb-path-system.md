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
| `/audit` (Projects) | ProjectsHeader.tsx |
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
- **Visual**: Semantic Tailwind colors, `/` separator, Home icon, `hidden sm:flex`

### Route → Breadcrumb Mapping

```
/crm                     → Αρχική / CRM
/crm/tasks               → Αρχική / CRM / Εργασίες
/crm/calendar            → Αρχική / CRM / Ημερολόγιο
/crm/leads               → Αρχική / CRM / Leads
/crm/pipeline            → Αρχική / CRM / Pipeline
/crm/communications      → Αρχική / CRM / Επικοινωνίες
/sales                   → Αρχική / Πωλήσεις
/spaces                  → Αρχική / Χώροι
/obligations             → Αρχική / Υποχρεώσεις
/contacts                → Αρχική / Επαφές
/accounting              → Αρχική / Λογιστικό
/accounting/*            → Αρχική / Λογιστικό / [sub]
/account/profile         → Αρχική / Λογαριασμός / Προφίλ
/account/preferences     → Αρχική / Λογαριασμός / Προτιμήσεις
/account/privacy         → Αρχική / Λογαριασμός / Απόρρητο
/account/security        → Αρχική / Λογαριασμός / Ασφάλεια
/account/notifications   → Αρχική / Λογαριασμός / Ειδοποιήσεις
/admin/ai-inbox          → Αρχική / Διαχείριση / AI Inbox
/admin/operator-inbox    → Αρχική / Διαχείριση / Operator Inbox
```

### Σελίδες που χρησιμοποιούν ModuleBreadcrumb

| Route | File |
|-------|------|
| `/crm` | `src/app/crm/page.tsx` |
| `/crm/tasks` | `src/app/crm/tasks/page.tsx` |
| `/crm/calendar` | `src/app/crm/calendar/page.tsx` |
| `/crm/leads` | `src/app/crm/leads/page.tsx` |
| `/crm/pipeline` | `src/app/crm/pipeline/page.tsx` |
| `/crm/communications` | `src/app/crm/communications/page.tsx` |
| `/sales` | `src/app/sales/page.tsx` |
| `/spaces` | `src/app/spaces/page.tsx` |
| `/obligations` | `src/app/obligations/page.tsx` |
| `/contacts` | `src/app/contacts/page.tsx` |
| `/accounting` | `src/app/accounting/page.tsx` |
| `/account/profile` | `src/app/account/profile/page.tsx` |
| `/account/preferences` | `src/app/account/preferences/page.tsx` |
| `/account/privacy` | `src/app/account/privacy/page.tsx` |
| `/account/security` | `src/app/account/security/page.tsx` |
| `/account/notifications` | `src/app/account/notifications/page.tsx` |
| `/admin/ai-inbox` | `src/app/admin/ai-inbox/page.tsx` |
| `/admin/operator-inbox` | `src/app/admin/operator-inbox/page.tsx` |

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

### ModuleBreadcrumb

```tsx
import { ModuleBreadcrumb } from '@/components/shared/ModuleBreadcrumb';

<ModuleBreadcrumb className="px-6 pt-4" />
```

| Prop | Type | Description |
|------|------|-------------|
| `className` | `string?` | Additional CSS classes |

### Adding a new route

Add the URL segment to `SEGMENT_LABEL_MAP` in `ModuleBreadcrumb.tsx` and add the corresponding i18n key to `navigation.module.*` in both `el/navigation.json` and `en/navigation.json`.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-01-01 | Initial: NavigationBreadcrumb for entity hierarchy |
| 2026-03-12 | Added ModuleBreadcrumb for module/dashboard pages (18 pages) |
