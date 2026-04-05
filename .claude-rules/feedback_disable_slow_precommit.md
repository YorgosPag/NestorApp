---
name: Disable slow pre-commit checks
description: Pre-commit hook must be fast — no tsc, prettier, madge, eslint. Run on-demand only.
type: feedback
---

Pre-commit hook checks 2 (ESLint), 7 (tsc), 8 (Prettier), 9 (madge) DISABLED.
**Why:** Γιώργος complained about 60-120s delay on every commit. Even small i18n changes triggered full tsc.
**How to apply:** Never re-enable these checks in pre-commit. Run them manually only when Γιώργος asks.
Remaining fast checks: reserved filenames, project rules, file sizes, AI pipeline tests, secrets scan.
