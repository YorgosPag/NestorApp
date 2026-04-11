# ADR-147: Unified Share Surface — ShareSurfaceShell + Pluggable PermissionPanel

| Metadata | Value |
|----------|-------|
| **Status** | 🟢 ACCEPTED — Phase A + Phase B Implemented |
| **Date** | 2026-04-11 |
| **Category** | UI Components / Centralization |
| **Canonical Location** | `src/components/ui/sharing/` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `ShareSurfaceShell` + `useShareFlow` + `PermissionPanel` slot interface from `src/components/ui/sharing/`
- **Decision**: Extract a presentation-only primitive (modal chrome + state machine) and let each sharing feature plug in its own `PermissionPanel` with its own ACL semantics.
- **Status**: 🟢 Phase A (types, shell, hook) + Phase B (ShareModal + ShareDialog migrated) IMPLEMENTED.
- **Date**: 2026-04-11

---

## Context

Δύο παραγωγικές ροές κοινοποίησης συνυπάρχουν χωρίς κοινή UI υποδομή:

1. **Contact sharing** — `src/components/ui/ShareModal.tsx` (461 γρ.)
   - Permission model: **user-auth** (SMTP email, social platforms via λογαριασμό χρήστη, CRM channels)
   - Entry: `src/components/contacts/list/ContactsList.tsx` (`handleShareContact`)
   - Sub-components: `SharePlatformGrid`, `EmailShareForm`, `ContactChannelPicker`, `ChannelShareForm`, `PhotoPickerGrid`, `CopyActionsSection`

2. **File sharing** — `src/components/shared/files/ShareDialog.tsx` (307 γρ.) + `src/services/file-share.service.ts` (281 γρ.)
   - Permission model: **link-token** (HMAC-style tokens, SHA-256 password, expiration, download limits)
   - Firestore collection: `file_shares`
   - Service API: `createFileShareWithPolicy` μέσω `file-mutation-gateway.ts`

**Προβλήματα που οδήγησαν στο ADR:**

- `ShareModal.tsx` έχει ήδη 461 γραμμές — πλησιάζει το 500-line ceiling (SOS N.7.1). Το `handlePlatformShare` είναι ~100 γραμμές, παραβιάζει ήδη τον κανόνα των 40 γραμμών/function.
- Μηδενική κοινή UI υποδομή: δύο διαφορετικά `<Dialog>` chrome, δύο state machines, δύο loading/error patterns.
- **Έρχονται 3ο + 4ο sharing feature** (share project, share building). Χωρίς shared primitive, κάθε νέο feature θα forkάρει τρίτο/τέταρτο modal από path-of-least-resistance.

**Google-level observation:** Το σωστό abstraction εξάγεται όταν υπάρχουν ≥2 concrete implementations — έχουμε ακριβώς 2. Αν περιμέναμε το 3ο, θα χτιζόταν ως αντίγραφο ενός εκ των δύο και μετά θα κάναμε refactor σε 3 σημεία αντί για 2.

---

## Decision

Εξαγωγή τριών layers:

### Layer 1: Types (SSoT)

`src/types/sharing.ts` — ορίζει:

```typescript
export type ShareFlowStatus = 'idle' | 'configuring' | 'submitting' | 'success' | 'error';
export type SharePermissionModel = 'user-auth' | 'link-token';

export interface ShareableEntity<T extends string = string> {
  kind: T;               // 'contact' | 'file' | 'project' | 'building' | ...
  id: string;
  title: string;         // short name for header
  subtitle?: string;     // optional muted line
  companyId?: string;    // tenant binding
}

export interface ShareFlowState<TResult> {
  status: ShareFlowStatus;
  error: string | null;
  result: TResult | null;
}

export interface PermissionPanelProps<TDraft, TResult> {
  entity: ShareableEntity;
  draft: TDraft;
  onDraftChange: (next: TDraft) => void;
  onSubmit: () => void;
  onCancel: () => void;
  state: ShareFlowState<TResult>;
}

export interface ShareSurfaceShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entity: ShareableEntity;
  labels: {
    title: string;
    subtitle?: string;
    closeLabel: string;
    errorPrefix: string;
  };
  status: ShareFlowStatus;
  error: string | null;
  children: React.ReactNode;
  headerIcon?: React.ReactNode;
  footer?: React.ReactNode;
}
```

### Layer 2: Presentational shell

`src/components/ui/sharing/ShareSurfaceShell.tsx` — `<Dialog>` chrome + semantic `<header>`/`<section>`/`<footer>`, accepts `children` as the PermissionPanel slot. **Zero business logic**, namespace-agnostic (labels via props).

`src/components/ui/sharing/ShareStatusBanner.tsx` — μικρό sub-component για error/loading rendering.

### Layer 3: State machine hook

`src/components/ui/sharing/useShareFlow.ts` — generic:

```typescript
export function useShareFlow<TDraft, TResult>(options: {
  initialDraft: TDraft;
  submit: (draft: TDraft) => Promise<TResult>;
}): {
  state: ShareFlowState<TResult>;
  draft: TDraft;
  setDraft: (next: TDraft | ((prev: TDraft) => TDraft)) => void;
  submit: () => Promise<void>;
  reset: () => void;
};
```

- Transitions: `idle → configuring → submitting → success | error`
- Double-submit guard: `if (status === 'submitting') return`
- Unmount-safe: `isMounted` ref ώστε async results μετά το close να αγνοούνται
- Error logging: μέσω `createModuleLogger`

### Layer 4: Concrete panels (Phase B)

- `UserAuthPermissionPanel` — φιλοξενεί `SharePlatformGrid` + `EmailShareForm` + `ContactChannelPicker` + `ChannelShareForm` + `PhotoPickerGrid`
- `LinkTokenPermissionPanel` — φιλοξενεί expiration/password/maxDownloads/note form + result state

---

## Consequences

**Positive:**
- (+) Νέο sharing feature = PermissionPanel + `useShareFlow` call, ~30 min.
- (+) `ShareModal` πέφτει από 461 → ~80 γραμμές thin wrapper.
- (+) `handlePlatformShare` splittάρεται σε sub-functions <40 γραμμές (SOS N.7.1 compliance).
- (+) Κοινό semantic HTML, accessibility, design tokens σε ένα μέρος.
- (+) Commits 4-5 είναι independently revertable — αν σπάσει το ένα flow, το άλλο μένει migrated.

**Negative:**
- (−) Ένα επίπεδο indirection για αναγνώστες — mitigated με αυτό το ADR + JSDoc headers σε κάθε module.
- (−) Δύο παραγωγικές ροές αγγίζονται στα Phase B commits — mitigated με zero-behavior-change rule + manual testing checklist.

**Neutral:**
- Service layer (`FileShareService`, `createFileShareWithPolicy`) **ΔΕΝ** αλλάζει. Αυτό είναι αυστηρά UI/orchestration refactor.

---

## Migration Plan

### Phase A — Primitive layer (non-production-touching) ✅ IMPLEMENTED

1. **Commit 1**: ADR-147 markdown + adr-index.md entry
2. **Commit 2**: `shareSurface.*` i18n keys σε `src/i18n/locales/{el,en}/common-shared.json`
3. **Commit 3**: `src/types/sharing.ts` + `src/components/ui/sharing/{ShareSurfaceShell,ShareStatusBanner,useShareFlow,index}.ts(x)`

Τα commits 1-3 ΔΕΝ αγγίζουν production flows. Ο νέος κώδικας είναι unused μέχρι το Phase B.

### Phase B — Migration (production-critical) ✅ IMPLEMENTED

4. **Commit 4** (`c86e01f3`): Migrated `ShareDialog.tsx` → thin wrapper over `ShareSurfaceShell` + new `LinkTokenPermissionPanel` (+ `LinkTokenForm`, `LinkTokenResult`, `types.ts`). Legacy 307-line dialog reduced to ~130-line wrapper. `createFileShareWithPolicy` call site untouched.
5. **Commit 5**: Migrated `ShareModal.tsx` → thin wrapper (~110 γρ.) + new `UserAuthPermissionPanel` (~285 γρ.) + `usePlatformShareController` hook (~220 γρ.) + `PhotoPickerStep` (~70 γρ.). Legacy 461-line modal split into 4 files, `handlePlatformShare` broken into <40-line helpers (`resolveFacebookUrl`, `shareToAppDirect`, `shareToSocialWindow`).
6. **Commit 6**: ADR-147 changelog + status update (this commit).

**Zero behavior change guarantee:** καμία αλλαγή σε `ShareModalProps`, `ShareDialogProps`, `useShareModal()`. Όλοι οι call sites (`ContactsList.tsx`, `FilesList.tsx`, κλπ) δουλεύουν χωρίς αλλαγές.

**Διατήρηση edge cases:**
- `ShareDialog` `setTimeout(…, 200)` reset-after-close → διατηρείται στο `handleClose` του νέου thin wrapper.
- `ContactChannelPicker` reset-on-reopen (ShareModal γρ. 76-87) → μεταφέρεται σε `useEffect` του `UserAuthPermissionPanel`.
- Photo picker state transitions → `PhotoPickerStep` με identical prop shape.

---

## Testing Strategy

Manual testing on `localhost:3000` μετά από κάθε Phase B commit:

**Contact share (ShareModal path):**
1. Social platforms (Facebook, Twitter, κλπ) — new window opens, modal closes
2. Copy actions — clipboard + notification
3. Email form — SMTP send + success notification
4. CRM channel sub-flow — `ContactChannelPicker` search → channel select → form send
5. Photo share path — picker → select → confirm → clipboard + app
6. Back-navigation σε channel/photo picker

**File share (ShareDialog path):**
1. Happy path — default 72h expiration → Create → URL + Copy → close → reopen με reset state
2. With password — SHA-256 hash + success screen "password protected"
3. With 1h expiration — success screen shows "expires in 1 hour"
4. With max downloads — success screen shows limit
5. Error path — offline → error banner → cancel works
6. Double-submit guard — rapid clicks → one network request

**Regression:**
- `useShareModal()` hook call sites
- EL ↔ EN switch, zero raw i18n keys
- Dark mode rendering
- No console errors / hydration warnings

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `ShareModal` re-export breaks consumers | Low | High | Re-export default + named + `ShareModalProps` + `useShareModal`. Grep audit before landing. |
| Photo-picker state regression | Medium | High | Identical prop shape in `PhotoPickerStep`; dedicated test checklist item. |
| `setTimeout(200)` reset lost | Medium | Medium | Preserve inside `handleClose` με explicit comment. |
| Double-submit race | Low | High | `useShareFlow.submit` guards on `status === 'submitting'`. |
| i18n key collision | Low | Low | Prefix `shareSurface.*` chosen distinctly από υπάρχοντα `share.*`. |
| `UserAuthPermissionPanel` > 500 γραμμές | Medium | Medium | Pre-split σε `PlatformShareController` + `PhotoPickerStep`. |
| Service signature drift | Low | High | **Services untouched** — νέα panels παίρνουν `submit` ως prop. |
| Modal closes during in-flight submit | Low | Medium | `isMounted` ref στο `useShareFlow`. |

---

## Out of Scope

- Photo share history (`photo_shares` collection, `src/services/photo-share-history.service.ts`)
- Backend services (`FileShareService`, `createFileShareWithPolicy`, API routes)
- Firestore security rules
- Future "share project" / "share building" features (θα landάρουν ως ξεχωριστά adapters)
- Genericization του `ContactChannelPicker` → `RecipientPicker` (explicitly deferred σε μελλοντικό ADR)
- Changes σε `ShareModalProps.shareData` / `ShareDialogProps`
- Tests — manual testing posture per project convention

---

## File Manifest

### Phase A (non-production)

- `src/types/sharing.ts` — types SSoT
- `src/components/ui/sharing/ShareSurfaceShell.tsx` — presentational chrome
- `src/components/ui/sharing/ShareStatusBanner.tsx` — status/error display
- `src/components/ui/sharing/useShareFlow.ts` — state machine hook
- `src/components/ui/sharing/index.ts` — barrel exports
- `src/i18n/locales/el/common-shared.json` — +`shareSurface.*` keys
- `src/i18n/locales/en/common-shared.json` — +`shareSurface.*` keys

### Phase B (production migration)

- `src/components/ui/sharing/panels/UserAuthPermissionPanel.tsx`
- `src/components/ui/sharing/panels/user-auth/PlatformShareController.tsx`
- `src/components/ui/sharing/panels/user-auth/PhotoPickerStep.tsx`
- `src/components/ui/sharing/panels/LinkTokenPermissionPanel.tsx`
- `src/components/ui/sharing/panels/link-token/LinkTokenForm.tsx`
- `src/components/ui/sharing/panels/link-token/LinkTokenResult.tsx`
- `src/components/ui/ShareModal.tsx` — reduced to thin wrapper (~80 γρ.)
- `src/components/shared/files/ShareDialog.tsx` — reduced to thin wrapper (~90 γρ.)

---

## Companion / Related

- **ADR-001**: Select/Dropdown Component (Radix) — `ShareSurfaceShell` βασίζεται στο ίδιο `@/components/ui/dialog` primitive
- **ADR-156**: Centralization Gap Audit — αυτό το ADR είναι εν μέρει ανταπόκριση σε εκκρεμείς κεντρικοποιήσεις UI
- **SOS N.7.1**: File Size Standards — το τρέχον `ShareModal.tsx` (461 γρ.) είναι ο άμεσος triggering factor

---

## Changelog

- **2026-04-11**: Phase A implemented (commits 1-3) — ADR + i18n keys + primitive layer (`ShareSurfaceShell`, `ShareStatusBanner`, `useShareFlow`, `types/sharing.ts`).
- **2026-04-11**: Phase B implemented (commits 4-6) — both production sharing flows migrated.
  - `ShareDialog.tsx`: 307 → ~130 γρ. via `LinkTokenPermissionPanel`.
  - `ShareModal.tsx`: 461 → ~110 γρ. via `UserAuthPermissionPanel`.
  - `handlePlatformShare` split into <40-line helpers.
  - Public APIs (`ShareDialogProps`, `ShareModalProps`, `useShareModal()`) unchanged — zero call-site impact at `FilePreviewPanel.tsx`, `ContactsList.tsx`, etc.
  - Services (`FileShareService`, `createFileShareWithPolicy`, email / channel API routes) untouched.
