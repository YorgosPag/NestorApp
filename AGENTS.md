# Agent Instructions (Binding)

This repository uses `Local_Protocol.txt` as the single, binding source of truth for engineering standards and acceptance rules.

## Mandatory startup
- Before doing any work, read `Local_Protocol.txt` and follow it.
- If anything in this file conflicts with `Local_Protocol.txt`, `Local_Protocol.txt` wins.

## Non-negotiables (enforced by Local_Protocol.txt)
- ZERO hardcoded values (design tokens & domain constants/configs must come from centralized systems)
- ZERO `any`
- NO inline styles
- NO duplicates (mandatory repo-wide pre-check before writing code)
- Semantic DOM (no div-soup)
- Security/OWASP checks where relevant
- **LOCAL quality gate (ONLY this runs on the dev machine)**: `npx tsc --noEmit` (typecheck)
- **DO NOT run locally**: `lint`, `tests`, `build` — these are extremely heavy (4-14 GB RAM) and freeze the machine. They run on Vercel/CI servers after `git push`.
- Stop immediately if compliance is not possible; do not proceed without an explicit waiver and remediation plan.

## Deployment
- **ONLY use `git push origin main`** for deployment — Vercel auto-deploys from GitHub.
- **NEVER run `npx vercel`, `npx vercel --prod`, or `vercel deploy`** — these execute a full `next build` locally (4-8 GB RAM, 5-10 min) and freeze the machine. The Vercel servers do the build remotely after git push.

## Working mode
- Prefer small, single-topic diffs.
- Always provide evidence (commands run + results) for the typecheck gate.
- **NEVER run locally**: `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm run enterprise:validate`, `npx vercel` — the dev machine has 4 cores / 24 GB RAM and these commands cause system freeze.
