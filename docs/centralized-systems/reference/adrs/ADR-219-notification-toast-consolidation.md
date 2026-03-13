# ADR-219: Notification/Toast System Consolidation

## Status
✅ **IMPLEMENTED** — 2026-03-13

## Context
Το project χρησιμοποιούσε **2 ανταγωνιστικές toast libraries**: `sonner` (canonical, στο NotificationProvider) και `react-hot-toast` (legacy, σε 25+ αρχεία). Αυτό δημιουργούσε:
- Ασυνεπή UX (διαφορετικά styles, θέσεις, animations)
- Duplicate `<Toaster/>` components (5 instances)
- Αδυναμία global control (rate limiting, dedup, i18n)

## Decision
**Ένα μοναδικό notification system** μέσω `useNotifications()` hook + `sonner` (μόνο μέσα στο `NotificationProvider`).

### Κανόνες (ΤΕΡΜΑΤΙΚΟΙ)
1. **ΑΠΑΓΟΡΕΥΕΤΑΙ** `import toast from 'react-hot-toast'` — η library αφαιρέθηκε
2. **ΑΠΑΓΟΡΕΥΕΤΑΙ** `import { toast } from 'sonner'` σε οποιοδήποτε component/hook
3. **ΜΟΝΑΔΙΚΟΣ ΤΡΟΠΟΣ**: `import { useNotifications } from '@/providers/NotificationProvider'`
4. **ΜΟΝΑΔΙΚΟ `<Toaster/>`**: Αυτό μέσα στο `NotificationProvider` — κανένα άλλο

### Migration Pattern
```typescript
// ❌ ΠΡΙΝ (react-hot-toast / direct sonner)
import toast from 'react-hot-toast';
toast.success(t('saved'));
toast.error(t('failed'));

// ✅ ΜΕΤΑ (useNotifications)
import { useNotifications } from '@/providers/NotificationProvider';
const { success, error, info, warning } = useNotifications();
success(t('saved'));
error(t('failed'));
```

## Consequences

### Τι αφαιρέθηκε
- `react-hot-toast` dependency (npm uninstall)
- `src/components/ToasterClient.tsx` (ΔΙΑΓΡΑΦΗ)
- 5x duplicate `<Toaster/>` components
- 28 direct `react-hot-toast` imports
- 2 direct `sonner` imports (εκτός NotificationProvider)

### Τι παραμένει
- `src/providers/NotificationProvider.tsx` — Enterprise provider (sonner, i18n, rate limiting, accessibility, dedup)
- `src/types/notifications.ts` — TypeScript types
- `useNotifications()` hook — χρησιμοποιείται τώρα σε **60+ αρχεία**

### Μετρικές
| Metric | Πριν | Μετά |
|--------|------|------|
| Toast libraries | 2 | 1 (sonner, μόνο μέσω provider) |
| `<Toaster/>` instances | 5 | 1 (μέσα στο NotificationProvider) |
| Direct toast imports | 30 | 0 |
| Αρχεία migrated | — | 33 |
| Toast calls αντικατεστημένα | — | ~151 |

## Files Changed (Migration)

### Batch 1: Toaster Cleanup
- `src/components/ToasterClient.tsx` — DELETED
- `src/app/components/ConditionalAppShell.tsx` — Removed ToasterClient import/usage
- `src/app/crm/tasks/page.tsx` — Removed `<Toaster/>` + import
- `src/app/crm/leads/[id]/page.tsx` — Removed `<Toaster/>` + import
- `src/app/crm/calendar/page.tsx` — Removed `<Toaster/>` + import

### Batch 2: Form Error Handler
- `src/utils/form-error-handler.ts` — Replaced react-hot-toast with useNotifications

### Batch 3: CRM Components
- `src/components/crm/SendMessageModal.tsx` — sonner → useNotifications
- `src/components/crm/CommunicationsIntegration.tsx` — sonner → useNotifications
- `src/components/crm/dashboard/TasksTab.tsx` — react-hot-toast → useNotifications
- `src/components/crm/calendar/CalendarCreateDialog.tsx` — react-hot-toast → useNotifications
- `src/components/leads/hooks/useLeadsList.ts` — react-hot-toast → useNotifications
- `src/app/crm/leads/[id]/components/QuickActions.tsx` — react-hot-toast → useNotifications

### Batch 4: Contacts/Building
- `src/components/contacts/list/ContactsList.tsx`
- `src/components/contacts/tabs/ContactBankingTab.tsx`
- `src/components/building-management/StorageTab.tsx`
- `src/components/building-management/tabs/UnitsTabContent.tsx`
- `src/components/building-management/tabs/GeneralTabContent/BuildingAddressesCard.tsx`
- `src/components/building-management/hooks/useBuildingForm.ts`

### Batch 5: Forms/Hooks
- `src/hooks/useProjectForm.ts`
- `src/components/units/hooks/useUnitForm.ts`
- `src/features/property-details/components/UnitFieldsBlock.tsx`
- `src/components/property/PropertyDetails.tsx`

### Batch 6: Inbox/Email/Maps
- `src/app/admin/ai-inbox/AIInboxClient.tsx`
- `src/app/admin/operator-inbox/OperatorInboxClient.tsx`
- `src/components/email/hooks/useSendEmailModal.ts`
- `src/hooks/inbox/useRealtimeTriageCommunications.ts`
- `src/components/shared/addresses/AddressMap.tsx`

### Batch 7: Subapps/Other
- `src/subapps/geo-canvas/floor-plan-system/components/FloorPlanControlPointPicker.tsx`
- `src/subapps/dxf-viewer/ui/components/tests-modal/examples/advanced-usage.tsx`
- `src/components/projects/tabs/ProjectLocationsTab.tsx`
- `src/components/projects/ika/components/LiveWorkerMap.tsx`

### Batch 8: Cleanup
- `package.json` — Removed `react-hot-toast` dependency

## Changelog
| Date | Change |
|------|--------|
| 2026-03-13 | Initial implementation — Full migration from react-hot-toast to useNotifications |
