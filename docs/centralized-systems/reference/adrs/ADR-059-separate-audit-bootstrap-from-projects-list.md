# ADR-059: Separate /api/projects/bootstrap from /api/projects/list

| Metadata | Value |
|----------|-------|
| **Category** | Backend Systems |
| **Status** | ✅ Active |
| **Date** | 2026-01-11 |
| **Updated** | 2026-03-31 (route rename /audit → /projects, ADR-268) |
| **Owners** | Platform / Backend |

## Related
  - ADR-001: Avoid barrel imports in UI (generic mappings)
  - ADR-268: Route Rename /audit → /projects
  - API: /api/projects/bootstrap
  - API: /api/projects/list

## Context

The application needs:
1) A fast initial load for the Projects area and Navigation sidebar.
2) A projects listing for the Projects grid and other UI surfaces.

We identified two different data consumption patterns:
- NavigationContext uses `/api/projects/bootstrap` to hydrate navigation state (companies + project summaries) with caching and request de-duplication.
- Projects grid (and related UI) needs a projects list with fields required for grid rendering and filtering.

A coupling risk exists if `/api/projects/bootstrap` becomes a generic projects API:
- Scope creep: bootstrap starts accumulating unrelated fields and contracts driven by multiple consumers.
- Increased blast radius: changes for one consumer break others.
- Cache semantics conflict: bootstrap caching and payload shape are optimized for navigation bootstrap, not for general listing.
- Performance regressions: growing bootstrap payload increases critical path cost for routes that only need navigation.

## Decision

We will keep responsibilities separated:
- `/api/projects/bootstrap` remains **navigation bootstrap-only** (navigation hydration contract).
- `/api/projects/list` becomes the **single canonical projects listing API** for grids/lists and similar consumers.

Client consumption:
- Navigation sidebar: uses `/api/projects/bootstrap`.
- Projects grid list: uses `/api/projects/list` (no direct Firestore reads from client hooks).

## Rationale

This separation:
- Preserves clear bounded contexts and stable contracts.
- Reduces accidental shared-chunk/data-contract pollution.
- Enables independent caching strategies (TTL, payload size, scope).
- Minimizes critical-path payload and avoids "one endpoint to rule them all".

## Consequences

### Positive
- Clear ownership and change control per endpoint.
- Safer evolution of project listing fields without impacting navigation bootstrap.
- Predictable performance characteristics for the projects route.

### Negative / Trade-offs
- Two endpoints may query overlapping collections at different times.
- Requires consistent shared mapping/normalization logic (status normalization, ISO timestamps) across endpoints.

## Guardrails

- Do not add "general listing" fields to `/api/projects/bootstrap`.
- Add new grid/list fields only to `/api/projects/list`.
- Prefer shared internal utilities for:
  - status normalization
  - timestamp serialization (ISO)
  - cache helpers (TTL, source tagging)
- Keep the ESLint guardrail forbidding `@/components/generic` barrel imports to prevent performance regressions at the UI module graph level.

## Validation

- Network on initial `/projects`:
  - Navigation: `/api/projects/bootstrap`
  - Projects list: `/api/projects/list`
- No direct client Firestore project listing queries.
- Performance regression checks: cold compile/time and route load baselines tracked after changes.

## Changelog

| Date | Change |
|------|--------|
| 2026-01-11 | Initial decision |
| 2026-03-31 | Updated all references from `/api/audit/bootstrap` → `/api/projects/bootstrap` per ADR-268 route rename |
