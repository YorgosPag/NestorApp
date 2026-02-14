# i18n Raw-Key Audit (Repo-wide)

Date: 2026-02-13
Scope: UI-facing code in `src/components`, `src/hooks`, `src/app`, translation infra in `src/i18n`
Goal: detect places where translation keys are rendered or emitted as raw strings (instead of translated text).

## Method
- Reviewed i18n resources and namespaces under `src/i18n/locales`.
- Ran targeted scans for:
  - `window.confirm(...)` without `t(...)`
  - `toast.*(...)` calls with raw key literals
  - error states assigned with i18n keys and later rendered directly
  - dashboard/title configs carrying key strings without translation in render path
- Manually verified render paths for each high-confidence match.

## Confirmed Findings

1. Critical: Raw key shown in native confirm dialog (Obligations editor)
- `src/components/obligations/section-editor/hooks/useSectionEditorState.ts:28`
- Code uses: `window.confirm("obligations.editor.confirmLeave")`
- Impact: user sees raw key text in confirm dialog.

2. Critical: Raw keys in Leads flow (confirm + toast + error state + UI render)
- Source keys set/emitted:
  - `src/components/leads/hooks/useLeadsList.ts:30`
  - `src/components/leads/hooks/useLeadsList.ts:42`
  - `src/components/leads/hooks/useLeadsList.ts:50`
  - `src/components/leads/hooks/useLeadsList.ts:56`
  - `src/components/leads/hooks/useLeadsList.ts:59`
- Raw error render:
  - `src/components/leads/LeadsList.tsx:46`
- Impact: raw i18n keys can appear in toasts, confirm dialog, and inline error UI.

3. High: Raw keys in Email modal toasts (react-hot-toast)
- `src/components/email/hooks/useSendEmailModal.ts:75`
- `src/components/email/hooks/useSendEmailModal.ts:79`
- `src/components/email/hooks/useSendEmailModal.ts:83`
- `src/components/email/hooks/useSendEmailModal.ts:105`
- `src/components/email/hooks/useSendEmailModal.ts:122`
- Impact: toast messages can display key literals (`email.validation.*`, `email.status.*`, `email.errors.*`).

4. High: Projects structure/customers fallback error keys rendered raw
- Fallback key assignment:
  - `src/components/projects/structure-tab/hooks/useProjectStructure.ts:85`
  - `src/components/projects/customers-tab/hooks/useProjectCustomers.ts:88`
- Raw rendering:
  - `src/components/projects/structure-tab/ProjectStructureTab.tsx:29`
  - `src/components/projects/customers-tab/parts/ErrorCard.tsx:30`
- Impact: when fallback is used, UI can show key literal (`projects.*`).

5. High: Opportunities pipeline errors/notifications use key literals not translated in render path
- Key assignment / notification emit:
  - `src/components/crm/hooks/useOpportunities.ts:29`
  - `src/components/crm/hooks/useOpportunities.ts:30`
- Raw render:
  - `src/components/crm/dashboard/PipelineTab.tsx:86`
- Impact: pipeline error message can display raw key; notification resolver may not resolve `opportunities.*`.

6. High: Relationship statistics cards pass key strings as titles and render them directly
- Key strings produced:
  - `src/components/contacts/relationships/hooks/summary/useRelationshipStatistics.ts:88`
  - `src/components/contacts/relationships/hooks/summary/useRelationshipStatistics.ts:94`
  - `src/components/contacts/relationships/hooks/summary/useRelationshipStatistics.ts:100`
  - `src/components/contacts/relationships/hooks/summary/useRelationshipStatistics.ts:106`
  - `src/components/contacts/relationships/hooks/summary/useRelationshipStatistics.ts:114`
  - `src/components/contacts/relationships/hooks/summary/useRelationshipStatistics.ts:120`
  - `src/components/contacts/relationships/hooks/summary/useRelationshipStatistics.ts:126`
  - `src/components/contacts/relationships/hooks/summary/useRelationshipStatistics.ts:132`
- Passed to dashboard:
  - `src/components/contacts/relationships/summary/StatisticsSection.tsx:68`
- Rendered directly:
  - `src/components/property-management/dashboard/StatsCard.tsx:82`
- Impact: stat card titles can appear as raw keys (`relationships.stats.*`).

7. Medium: Structure editor category labels use key map but render without translation
- Key map:
  - `src/components/obligations/structure-editor/config/categoryLabels.ts:11`
- Rendered directly:
  - `src/components/obligations/structure-editor/parts/SectionCard.tsx:92`
  - `src/components/obligations/structure-editor/parts/SectionCard.tsx:106`
- Impact: category labels can appear as raw keys (`obligations.categories.*`).

## Systemic Root Cause Patterns
- Pattern A: Hooks switched to i18n key literals, but UI render points still output raw strings.
- Pattern B: Direct use of `react-hot-toast` with key literals (no centralized resolver).
- Pattern C: `window.confirm` called with key literals.
- Pattern D: Config/hook-generated title/label keys passed through components that expect final text.

## Notable Infra Gap
- `src/providers/NotificationProvider.tsx` key resolver has limited hardcoded namespaces:
  - `contacts`, `common`, `building`, `projects`, `units`
- Keys like `opportunities.*`, `leads.*`, `email.*`, `relationships.*`, `obligations.*` may not resolve via this path.

## Recommended Fix Order
1. Replace raw `window.confirm("key")` usages with translated text at call site.
2. Stop passing raw keys directly to `react-hot-toast`; translate before calling.
3. For `error` state fields, store display text or translate at render boundary consistently.
4. For dashboard/category configs, either:
   - store translated strings at creation time, or
   - always translate in render components (`StatsCard`, `SectionCard`) via namespace-aware path.
5. Remove namespace allowlist limitation in notification resolver, or use a centralized key parser covering all app namespaces.

## Command Evidence (representative)
- `rg -n -P "window\.confirm\(\s*(?!t\()" src -g "*.{ts,tsx}"`
- `rg -n 'toast\.error\("[a-z]' src/components src/hooks -g "*.{ts,tsx}"`
- `rg -n 'toast\.success\("[a-z]' src/components src/hooks -g "*.{ts,tsx}"`
- `rg -n 'setError\("[a-z][a-z0-9-]*\.[a-zA-Z0-9_.-]+' src/components src/hooks -g "*.{ts,tsx}"`
- `rg -n "useRelationshipStatistics\(|dashboardStats|UnifiedDashboard" src/components/contacts/relationships -g "*.tsx"`
