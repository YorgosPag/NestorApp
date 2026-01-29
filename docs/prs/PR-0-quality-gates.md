# PR-0: Quality Gates & Repo Safety Net

**Status**: Ready for Merge
**Created**: 2026-01-29
**Author**: Claude (Anthropic AI)

---

## What

Added comprehensive CI/CD quality gates that run on **every PR** to ensure code quality before merge.

## Why

Before this PR, the repository had:
- Unit tests (partial coverage)
- i18n validation (only on path changes)
- **NO lint enforcement on PRs**
- **NO typecheck on all PRs**
- **NO build verification on PRs**

This created risk of broken code being merged.

## How Tested

1. Workflow file validated for YAML syntax
2. All jobs defined with proper dependencies
3. Timeout limits set to prevent hanging jobs
4. Concurrency control to cancel stale runs

## Changes

### New Files

| File | Purpose |
|------|---------|
| `.github/workflows/quality-gates.yml` | Master CI workflow with 4 gates |
| `docs/prs/PR-0-quality-gates.md` | This PR documentation |

### Quality Gates Implemented

| Gate | Command | Blocks Merge? |
|------|---------|---------------|
| **Lint** | `pnpm lint` | YES |
| **TypeCheck** | `pnpm typecheck` | YES |
| **Unit Tests** | `pnpm test` | YES |
| **Build** | `pnpm build` | YES |

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Build fails due to missing env vars | Medium | Low | Dummy env vars provided for CI |
| Tests timeout | Low | Low | 15-minute timeout with passWithNoTests |
| Cache issues | Low | Low | pnpm cache enabled |

## Rollback Plan

Delete `.github/workflows/quality-gates.yml` to revert.

## Branch Protection (Manual Step Required)

After merging this PR, enable branch protection on `main`:

1. Go to **Settings → Branches → Branch protection rules**
2. Add rule for `main`
3. Enable:
   - **Require status checks to pass before merging**
   - Select: `Gate 1: Lint`, `Gate 2: TypeCheck`, `Gate 3: Unit Tests`, `Gate 4: Build`
   - **Require branches to be up to date before merging**

## Local_Protocol Compliance

- [x] No `any` types
- [x] No `as any`
- [x] No `@ts-ignore`
- [x] No inline styles
- [x] No duplicates
- [x] No hardcoded values (uses env vars)

---

## Next PR

**PR-1A: Firestore Tenant Isolation** - Security Blocker #1
