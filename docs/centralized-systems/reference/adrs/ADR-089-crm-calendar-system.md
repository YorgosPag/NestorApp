# ADR-089: CRM Calendar System

| Metadata | Value |
|----------|-------|
| **Status** | IMPLEMENTED |
| **Date** | 2026-02-08 |
| **Category** | UI Components / CRM |
| **Canonical Location** | `src/app/crm/calendar/page.tsx` |
| **Author** | Georgios Pagonis + Claude Code (Anthropic AI) |
| **Related** | ADR-001 (Radix Select), ADR-034 (Gantt Chart pattern reference), ADR-070 (Email/AI - appointments source) |

---

## 1. Context

### Vision

To CRM system needs a full calendar view for users to manage their schedule. The existing `CalendarTab` in the CRM Dashboard used **mock data** (hardcoded appointments) and did not display real data from Firestore.

### The Problem

- The CRM dashboard CalendarTab only showed hardcoded mock appointments
- No unified view combining Tasks + Appointments from Firestore
- No create/view event functionality from the calendar
- No Month/Week/Day/Agenda views
- No color-coded event types
- No i18n support for calendar labels (EL/EN)

### Requirements

- New page at `/crm/calendar` with Month/Week/Day/Agenda views
- Display real Tasks (from `tasks` collection) + Appointments (from `appointments` collection)
- Color coding per event type (meeting, call, viewing, follow_up, email, document, appointment, other)
- Event detail dialog on click
- Create event dialog on slot selection
- Full i18n support (EL/EN)
- All UI values from centralized design system (zero hardcoded values)

---

## 2. Decision

### 2.1 Technology Stack

#### Library: react-big-calendar

| Criteria | Value |
|----------|-------|
| **Package** | `react-big-calendar` (npm) |
| **Version** | ^1.x |
| **License** | **MIT** |
| **TypeScript** | `@types/react-big-calendar` |
| **Localizer** | `dateFnsLocalizer` (date-fns already installed) |
| **Locales** | `el` (Greek) + `enUS` (English) |

**Alternatives Considered**:

| Library | License | Verdict |
|---------|---------|---------|
| **react-big-calendar** | MIT | **SELECTED** - Mature, MIT, native date-fns support |
| FullCalendar | MIT (core) | Rejected - heavier, plugin-based architecture |
| react-calendar-timeline | MIT | Rejected - timeline-focused, not calendar views |
| Custom implementation | N/A | Rejected - excessive development effort |

### 2.2 Unified CalendarEvent Type

**SSoT**: `src/types/calendar-event.ts`

```typescript
export type CalendarEventSource = 'task' | 'appointment';
export type CalendarEventType = 'appointment' | 'call' | 'email' | 'meeting'
  | 'viewing' | 'follow_up' | 'document' | 'other';

export interface CalendarEvent {
  id: string;              // "task_xxx" | "appt_xxx" (prefixed to avoid ID collisions)
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  source: CalendarEventSource;
  eventType: CalendarEventType;
  entityId: string;        // Original ID without prefix
  description: string;
  assignedTo: string;
  status: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  companyId: string;
}
```

### 2.3 Service Architecture

```
Browser (CrmCalendarPage)
         |
         v
useCalendarEvents(dateRange)               <-- React hook (auth guard)
         |
         v
CalendarEventService.getCalendarEvents()   <-- Merge service
         |
         +-- TasksRepository.getAll()      <-- Existing (reused)
         +-- AppointmentsRepository.getByDateRange()  <-- New
         |
         v
mappers.ts                                 <-- Pure functions
         |
         +-- taskToCalendarEvent()         <-- CrmTask -> CalendarEvent | null
         +-- appointmentToCalendarEvent()  <-- AppointmentDocument -> CalendarEvent | null
         |
         v
CalendarEvent[]                            <-- Unified, sorted by start date
```

### 2.4 Design Tokens Strategy

The calendar components use the centralized design system exclusively:

| Context | Approach | Hooks/Imports |
|---------|----------|---------------|
| **Tailwind classes** (layout, text) | Design system hooks | `useSpacingTokens()`, `useTypography()`, `useBorderTokens()`, `useIconSizes()`, `useSemanticColors()` |
| **CSSProperties** (react-big-calendar eventStyleGetter) | Raw design tokens | `coreBorderRadius`, `borderWidth`, `typography`, `spacing` from `@/styles/design-tokens` |

**Note**: react-big-calendar's `eventStyleGetter` requires `CSSProperties` objects (not Tailwind classes). For this specific case, raw design token values are imported directly.

### 2.5 Color Scheme (CSS Variables)

**SSoT**: `src/components/crm/calendar/calendar-event-colors.ts`

```typescript
export const CALENDAR_EVENT_COLORS: Record<CalendarEventType, { bg: string; border: string; text: string }> = {
  appointment: { bg: 'hsl(var(--status-info) / 0.15)',    border: 'hsl(var(--status-info))',    text: 'hsl(var(--status-info))' },
  call:        { bg: 'hsl(var(--status-success) / 0.15)', border: 'hsl(var(--status-success))', text: 'hsl(var(--status-success))' },
  meeting:     { bg: 'hsl(var(--chart-3) / 0.15)',        border: 'hsl(var(--chart-3))',        text: 'hsl(var(--chart-3))' },
  viewing:     { bg: 'hsl(var(--status-warning) / 0.15)', border: 'hsl(var(--status-warning))', text: 'hsl(var(--status-warning))' },
  follow_up:   { bg: 'hsl(var(--status-error) / 0.15)',   border: 'hsl(var(--status-error))',   text: 'hsl(var(--status-error))' },
  email:       { bg: 'hsl(var(--chart-4) / 0.15)',        border: 'hsl(var(--chart-4))',        text: 'hsl(var(--chart-4))' },
  document:    { bg: 'hsl(var(--muted) / 0.5)',           border: 'hsl(var(--muted-foreground))', text: 'hsl(var(--foreground))' },
  other:       { bg: 'hsl(var(--muted) / 0.5)',           border: 'hsl(var(--muted-foreground))', text: 'hsl(var(--foreground))' },
};
```

---

## 3. Consequences

### Positive

- Full calendar with 4 views (Month/Week/Day/Agenda) for real CRM data
- Unified view of Tasks + Appointments from separate Firestore collections
- Color-coded event types for visual categorization
- Quick event creation from calendar slot selection
- Reuses existing `TasksRepository` (zero duplication)
- All UI values from centralized design system (enterprise-grade)
- Full i18n support (EL/EN) including calendar labels
- MIT license preserves closed-source status

### Negative

- New dependency: `react-big-calendar` + `@types/react-big-calendar` (mitigated: MIT, mature, widely used)
- eventStyleGetter requires CSSProperties (not Tailwind) — raw design tokens used as workaround
- Create dialog creates CrmTask only (not AppointmentDocument) — MVP simplification

---

## 4. Prohibitions (after this ADR)

- Do NOT create alternative calendar components — use `CrmCalendar` wrapper
- Do NOT use hardcoded colors for event types — use `CALENDAR_EVENT_COLORS` with CSS variables
- Do NOT bypass `CalendarEventService` for fetching merged events
- Do NOT use hardcoded spacing/typography in calendar components — use design system hooks
- Do NOT add new event types without updating both `CalendarEventType` and `CALENDAR_EVENT_COLORS`

---

## 5. File Structure

### New Files Created (2026-02-08)

| File | Role |
|------|------|
| `src/types/calendar-event.ts` | Unified CalendarEvent type (SSoT) |
| `src/services/calendar/contracts.ts` | IAppointmentsRepository, ICalendarEventService interfaces |
| `src/services/calendar/mappers.ts` | taskToCalendarEvent, appointmentToCalendarEvent pure functions |
| `src/services/calendar/AppointmentsRepository.ts` | Firestore CRUD for appointments (tenant-isolated) |
| `src/services/calendar/CalendarEventService.ts` | Merge service (tasks + appointments) |
| `src/hooks/useCalendarEvents.ts` | React hook (auth guard, date range, stats) |
| `src/components/crm/calendar/calendar-event-colors.ts` | Color config (CSS variables) |
| `src/components/crm/calendar/CrmCalendar.tsx` | react-big-calendar wrapper |
| `src/components/crm/calendar/CalendarEventDialog.tsx` | Event detail dialog |
| `src/components/crm/calendar/CalendarCreateDialog.tsx` | Create event dialog |
| `src/app/crm/calendar/page.tsx` | Page route component |

### Modified Files

| File | Change |
|------|--------|
| `src/config/smart-navigation-factory.ts` | +CalendarDays import, +calendar nav item, +label mapping |
| `src/app/crm/page.tsx` | +Calendar card in CRM landing page |
| `src/i18n/locales/en/crm.json` | +calendarPage keys, +sections.calendar |
| `src/i18n/locales/el/crm.json` | +calendarPage keys (Greek), +sections.calendar |

---

## 6. Centralized Systems Used

| System | Usage | File |
|--------|-------|------|
| **useSemanticColors()** | Background, text colors | `page.tsx` |
| **useIconSizes()** | Icon dimensions | `CrmCalendar.tsx`, dialogs |
| **useSpacingTokens()** | Padding, margin, gap, spaceBetween | All UI components |
| **useTypography()** | Heading, body, secondary text | `page.tsx`, `CalendarEventDialog.tsx` |
| **useBorderTokens()** | Border radius classes | `page.tsx` |
| **Raw design tokens** | CSSProperties for eventStyleGetter | `CrmCalendar.tsx` |
| **useAuth()** | Authentication guard | `page.tsx`, `useCalendarEvents.ts` |
| **useTranslation('crm')** | i18n (EL/EN) | All components |
| **Radix Dialog** | Event detail/create dialogs | `CalendarEventDialog.tsx`, `CalendarCreateDialog.tsx` |
| **Radix Select** | Event type selector (ADR-001) | `CalendarCreateDialog.tsx` |
| **TasksRepository** | Existing tasks CRUD (reused) | `CalendarEventService.ts` |
| **COLLECTIONS** | Firestore collection names | `AppointmentsRepository.ts` |
| **smart-navigation-factory** | Sidebar navigation | `smart-navigation-factory.ts` |

---

## 7. Data Sources

### Tasks (existing collection)

- **Collection**: `COLLECTIONS.TASKS`
- **Key fields**: `dueDate` (FirestoreishTimestamp), `type`, `title`, `status`, `priority`
- **Mapping**: `dueDate` -> `start`, `start + 1h` -> `end`
- **Filter**: Tasks without `dueDate` are excluded

### Appointments (existing collection)

- **Collection**: `COLLECTIONS.APPOINTMENTS`
- **Key fields**: `requestedDate` (YYYY-MM-DD string), `requestedTime` (HH:mm string)
- **Mapping**: `requestedDate + requestedTime` -> `start`, `start + 1h` -> `end`
- **Filter**: Appointments without `requestedDate` are excluded
- **Source**: AI Pipeline UC-001 (email ingestion extracts appointment requests)

---

## 8. i18n Keys

Namespace: `crm` -> `calendarPage`

```
calendarPage.title          -> "Calendar" / "Ημερολόγιο"
calendarPage.description    -> "View and manage your schedule" / "Δείτε και διαχειριστείτε το πρόγραμμά σας"
calendarPage.views.*        -> Month/Week/Day/Agenda labels
calendarPage.eventTypes.*   -> 8 event type labels
calendarPage.dialog.*       -> Dialog titles, fields, actions
calendarPage.newEvent       -> "New Event" / "Νέο Γεγονός"
calendarPage.noEvents       -> "No events for this period" / "Δεν υπάρχουν γεγονότα για αυτή την περίοδο"
sections.calendar.*         -> CRM landing page card
```

---

## 9. Future Enhancements (Phase 2+)

| Feature | Priority | Description |
|---------|----------|-------------|
| CalendarTab real data | Medium | Replace mock data in CRM Dashboard CalendarTab with `useCalendarEvents` |
| Drag & drop events | Medium | Move events between dates via drag |
| Recurring events | Low | Weekly/monthly event recurrence |
| User filter | Medium | Filter by assignedTo user |
| Event type filter | Low | Show/hide specific event types |
| Firestore onSnapshot | Medium | Real-time updates instead of polling |
| Appointment creation | Low | Create AppointmentDocument (not just CrmTask) from dialog |

---

## 10. Decision Log

| Date | Decision | Author |
|------|----------|--------|
| 2026-02-08 | ADR Created — CRM Calendar MVP implemented | Georgios Pagonis + Claude Code |
| 2026-02-08 | Library: react-big-calendar (MIT) selected | Georgios Pagonis |
| 2026-02-08 | All hardcoded values replaced with centralized design tokens | Claude Code |

---

*ADR Format based on: Michael Nygard's Architecture Decision Records*
*Enterprise standards inspired by: Autodesk, Adobe, Bentley Systems, SAP, Google*
