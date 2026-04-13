# ADR-300: Project Status Pill — Google-grade Header State (Linear pattern)

**Status**: ✅ IMPLEMENTED
**Date**: 2026-04-13
**Category**: UI / Information Architecture
**Supersedes**: status-as-form-field pattern in `PermitsAndStatusTab`

---

## Context

Στην καρτέλα **Γενικά** του project, το πεδίο `status` ζούσε ως τελευταίο
form field μέσα σε container με τίτλο **"Άδειες & Κατάσταση"**
(`PermitsAndStatusTab`). Αυτό ήταν λάθος για τρεις λόγους:

1. **Σημασιολογική σύγχυση**. Τα υπόλοιπα πεδία του container ήταν metadata
   οικοδομικής άδειας (αριθμός πρωτοκόλλου, εκδούσα αρχή, ημερομηνία έκδοσης).
   Το `status` είναι **lifecycle state** του project (`planning`,
   `in_progress`, `completed`, `on_hold`, `cancelled`) — διαφορετική ευθύνη.
   Το όνομα του container με "και" (PermitsAndStatus) ήταν code smell:
   ένας container = μία ευθύνη.

2. **Λάθος visual hierarchy**. Το status είναι το πιο σαρωμένο σημείο ενός
   project (Nielsen Norman F-pattern). Ζούσε **τελευταίο, στο bottom** της
   καρτέλας, μέσα σε λάθος container.

3. **State-as-form-field anti-pattern**. Η Google δεν βάζει ποτέ το state
   ενός entity σε accordion form field. State είναι **chrome**, όχι content:
   - Gmail: labels/unread στο header του thread
   - Google Docs: "Saved/Sharing" pill πάνω δεξιά
   - Linear: status chip δίπλα στον τίτλο, click → popover
   - Notion: status property στο top της page
   - GitHub: open/closed badge δίπλα στον τίτλο

Επιπλέον, το dropdown έδειχνε μόνο 3 από τα 5 active statuses
(missing `on_hold`, `cancelled`) — silent feature gap.

---

## Decision

Μεταφέρουμε το `status` **έξω από το form** και το κάνουμε **interactive
status pill** στον τίτλο του project (`ProjectDetailsHeader`), δίπλα στο
όνομα. Click → popover με όλα τα active statuses → optimistic update →
direct API call (παρακάμπτει το form/auto-save path).

### Αρχιτεκτονική

1. **Νέο component**: `src/components/projects/ProjectStatusPill.tsx`
   - Trigger: `ProjectBadge` από το SSoT `UnifiedBadgeSystem`
   - Popover: `@/components/ui/popover` (Radix)
   - Statuses: `ACTIVE_PROJECT_STATUSES` από `@/constants/project-statuses`
     (5 values: `planning`, `in_progress`, `completed`, `on_hold`, `cancelled`)
   - Optimistic local state + rollback on error
   - Mutation: `updateProjectClient(projectId, { status: next })`
   - Notification σε αποτυχία μέσω `useNotifications()`

2. **EntityDetailsHeader extension**: Προστέθηκε νέο optional prop
   `titleAdornment?: React.ReactNode` που render-άρει inline δίπλα στον
   `<h3>` τίτλο. Backwards-compatible — όλα τα άλλα entity headers
   (Contact/Building/Unit) μπορούν να το χρησιμοποιήσουν στο μέλλον.

3. **ProjectDetailsHeader**: Δημιουργεί το pill (memoized) και το περνάει
   στο `EntityDetailsHeader.titleAdornment`.

4. **project-details.tsx**: Περνάει `onStatusChange={refetchProject}` ώστε
   μετά από επιτυχή μεταβολή pill να γίνεται sync το parent state.

5. **PermitsAndStatusTab → PermitsTab**: Το container μετονομάστηκε σε
   `PermitsTab` και έχασε το status block. Πλέον έχει **μία και μόνη**
   ευθύνη: στοιχεία οικοδομικής άδειας.

### Γιατί όχι auto-save path;
Το status είναι atomic state change — δεν χρειάζεται να περάσει από το
form/dirty/auto-save lifecycle. Linear/Gmail pattern: state change είναι
άμεσο, ένα click. Επιπλέον, το pill λειτουργεί **εκτός edit mode** — δεν
χρειάζεται ο χρήστης να μπει σε edit mode για να αλλάξει status, όπως
δεν το χρειάζεται στο Linear/Gmail.

---

## Consequences

### Θετικά
- ✅ **Visual hierarchy**: Το status είναι πλέον στο πιο ορατό σημείο
- ✅ **One click**: Click pill → popover → select. No accordion expand,
  no edit mode, no save button
- ✅ **Bug fix**: Όλα τα 5 active statuses είναι πλέον διαθέσιμα (πριν: 3)
- ✅ **SRP**: `PermitsTab` έχει μία ευθύνη. Όνομα = ευθύνη.
- ✅ **Reusable slot**: Το `titleAdornment` είναι διαθέσιμο σε όλα τα
  entity headers — Contact status pill, Building status pill, κ.ο.κ.
- ✅ **Boy Scout**: 15 missing-i18n-key violations του παλιού
  `PermitsAndStatusTab` καθαρίστηκαν ολοκληρωτικά (baseline 4762 → 4747)

### Trade-offs
- ⚠️ Το pill παρακάμπτει το version check (`_v`) — concurrent edit
  conflict στο status είναι unlikely αλλά δυνατό. Αν χρειαστεί, μπορεί
  να προστεθεί στο μέλλον.
- ⚠️ Το `UnifiedEntityHeaderSystem.tsx` (SSoT) τροποποιήθηκε με 1 νέο
  optional prop. Αυτό είναι additive και backwards-compatible, αλλά
  κάθε αλλαγή σε SSoT απαιτεί προσοχή.

---

## Files Touched

**Created**:
- `src/components/projects/ProjectStatusPill.tsx` (νέο component)
- `src/components/projects/PermitsTab.tsx` (renamed from PermitsAndStatusTab)
- `adrs/ADR-300-project-status-pill-google-grade.md` (αυτό το ADR)

**Modified**:
- `src/core/entity-headers/UnifiedEntityHeaderSystem.tsx` (titleAdornment slot)
- `src/components/projects/ProjectDetailsHeader.tsx` (pill injection)
- `src/components/projects/project-details.tsx` (onStatusChange wiring)
- `src/components/projects/general-tab/GeneralProjectTab.tsx` (PermitsTab import)
- `src/i18n/locales/el/projects.json` (statusPill + permitsTab + permits keys)
- `src/i18n/locales/en/projects.json` (same)
- `.i18n-missing-keys-baseline.json` (-15 violations, file removal)

**Deleted**:
- `src/components/projects/PermitsAndStatusTab.tsx`

---

## Changelog

- **2026-04-13** — Initial implementation. Pill σε production.
