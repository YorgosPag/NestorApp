# HANDOFF — Search SSoT refactor (next steps)

**Date**: 2026-04-22 (late evening)
**Prior session**: Opus 4.7, ADR-029 Phase A + B + C completed
**Recommended model next session**: Sonnet 4.6 (remaining work is scoped cleanup, not cross-cutting architecture)

---

## 1. What's already done (committed to `main`, NOT pushed)

| Hash | Commit | Scope |
|------|--------|-------|
| `95781565` | fix(projects): dedupe soft-delete audit + clear trash UI selection | 2 pending fixes from previous handoff |
| `9c9fdc09` | hotfix(search): contact title companyName + serviceName fallback (ADR-029) | Phase A — unblocks ALFA "Unknown" title bug |
| `588340c4` | chore(functions): add missing collections to firestore mirror (ADR-029 Phase B prep) | Adds PROPERTIES/PARKING_SPACES/STORAGE/OPPORTUNITIES/COMMUNICATIONS/TASKS to functions `COLLECTIONS` mirror |
| `f1a79639` | feat(functions/search): SSoT mirror + enable all entity-type triggers (ADR-029 Phase B) | Core structural — 10 Firestore triggers, mirror file, helper split |
| `12c431ab` | feat(search): SSoT sync guard + serviceName contact title fallback (ADR-029 Phase C) | Phase C — sync script + SSoT serviceName fallback. ⚠️ **See §4 — accidentally includes 3 other-agent files** |

ADR-029 (`docs/centralized-systems/reference/adrs/ADR-029-global-search-system-v1.md`) fully rewritten with architecture, decision, mirror diff policy, entity coverage table, deployment notes, GOL checklist, full changelog.

---

## 2. Parallel agent (ADR-316 Project Showcase) — NEVER touch these files

Giorgio has another Claude agent working on ADR-316 feature in parallel. Already committed:

- `633de05a feat(project-showcase): ADR-316 foundation — types + i18n + ShareEntityType`
- `33bb5e42 feat(project-showcase): F1 — snapshot builder + label maps (ADR-316)`

**Do NOT touch anything under:**

- `src/types/sharing.ts`, `src/types/project-showcase.ts`
- `src/services/project-showcase/**`
- `src/services/pdf/ProjectShowcasePDFService.ts`, `src/services/pdf/renderers/ProjectShowcaseRenderer.ts`
- `src/app/api/projects/[projectId]/showcase/**`, `src/app/api/project-showcase/**`
- `src/services/sharing/resolvers/project-showcase.resolver.ts`, `src/services/sharing/resolvers/index.ts`
- `src/components/project-showcase/**`
- `src/components/shared/pages/SharedFilePageContent.tsx`, `src/components/shared/pages/useSharedFilePageState.ts`, `src/components/shared/pages/SharedProjectShowcasePageContent.tsx`
- `src/components/projects/ProjectDetailsHeader.tsx`, `src/components/projects/project-details.tsx`
- `src/i18n/locales/**/showcase.json`, `src/i18n/locales/**/projects.json`
- `.ssot-registry.json` (both agents want to add modules — **coordinate with Giorgio**)
- `docs/.../adr-index.md` (both may update)
- `docs/.../ADR-316-project-showcase.md`

### Git hygiene under multi-agent concurrency

The prior session hit the documented "multi-agent git add race": pre-commit
hook ran slow, other agent did `git add` during the hook window, their new
files landed in my commit (`12c431ab`).

**Mandatory next session:**

1. `git add <specific-file>` — never `-A` / `-u` / `.`
2. Before staging, always `git status --short` to see what the *other* agent has staged
3. **Commit with explicit file args** — not from index alone:
   `git commit -- file1 file2 file3 -m "..."`
   This ignores whatever is in the index and only commits the listed files, so
   the hook-window race cannot add foreign files.
4. After the background commit completes, `git show --stat <hash>` to verify
   no foreign files sneaked in.

---

## 3. Remaining work (pick next step with Giorgio)

### Step N+1 — Decide on commit `12c431ab` (foreign-file bleed)

`12c431ab` unintentionally bundled 3 ADR-316 files:

- `src/app/api/project-showcase/[token]/route.ts`
- `src/services/pdf/ProjectShowcasePDFService.ts`
- `src/services/project-showcase/labels.ts`

Options:

- **A (safer for history)**: `git reset --mixed HEAD~1`, unstage the ADR-316
  files, re-commit Phase C files only via
  `git commit -- <my-files> -m "..."`. No push has happened — safe.
- **B (pragmatic)**: leave it. The commit is content-valid; attribution is
  slightly off but the ADR-316 files are still present in tree for the other
  agent to reference. Add a note in the next commit explaining the bleed.

**Giorgio to decide.** If A, run it FIRST before anything else this session.

### Step N+2 — Deploy the Cloud Functions

Phase B adds 8 new Firestore triggers. They don't fire until deployed.
Requires Giorgio's explicit order (deployment = shared infra change):

```bash
cd functions && npm run build
firebase deploy --only \
  functions:onProjectWrite,\
  functions:onBuildingWrite,\
  functions:onPropertyWrite,\
  functions:onContactWrite,\
  functions:onFileWrite,\
  functions:onParkingWrite,\
  functions:onStorageWrite,\
  functions:onOpportunityWrite,\
  functions:onCommunicationWrite,\
  functions:onTaskWrite \
  --project pagonis-87766
```

Then back-fill the ALFA contact `search_documents/contact_cont_ba3c…` to
verify `title: "ALFA"` via `POST /api/admin/search-backfill`.

### Step N+3 — Remove client fire-and-forget reindex calls (14 sites)

Now that triggers are the canonical writer, the client `apiClient.post(API_ROUTES.SEARCH_REINDEX, …)` calls are redundant. Each failure raised the silent-miss bug Phase A just fixed. Remove from:

- `src/services/contacts.service.ts` lines 230, 378
- `src/services/communications.service.ts` line 170
- `src/services/opportunities-server.service.ts` lines 99, 167, 202 (also has direct collection write — inspect before removing)
- `src/app/api/projects/[projectId]/project-mutations.service.ts` line 150 (update handler)
- `src/app/api/projects/list/project-create.handler.ts` line 235
- `src/app/api/buildings/route.ts` line 276, `building-update.handler.ts` line 137
- `src/app/api/properties/create/route.ts` line 200
- `src/app/api/parking/route.ts` line 152, `parking/[id]/route.ts` line 159
- `src/app/api/storages/route.ts` line 280, `storages/[id]/route.ts` line 149
- `src/services/ai-pipeline/tools/handlers/contact-handler.ts` lines 262-263

Rules:
- Only remove AFTER the deploy in Step N+2 is verified live.
- Keep `/api/search/reindex` endpoint — it's still used by the admin backfill route.
- One commit per domain (contacts, projects, buildings, properties, parking, storages, ai-pipeline) to keep diffs reviewable.
- Run `npm run test:ai-pipeline:all` when touching the ai-pipeline handler.

### Step N+4 — Register SSoT module + update ADR index

Deferred from this session due to multi-agent contention:

- `.ssot-registry.json` — add `search-index-config` module (Tier 3) with
  `forbiddenPatterns` blocking ad-hoc SEARCH_INDEX_CONFIG redeclaration
  outside the two canonical files. Allowlist: `src/config/search-index-config.ts`, `functions/src/search/search-config.mirror.ts`.
- `docs/centralized-systems/reference/adr-index.md` — confirm ADR-029 entry
  reflects the 2026-04-22 revision (may already be fine; just check).
- `.husky/pre-commit` or `scripts/check-ssot.mjs` — optionally wire
  `npm run search-config:sync` into the pre-commit pipeline.

**Coordinate with Giorgio** — these files are shared. The other agent's F8
step will also touch `.ssot-registry.json`.

---

## 4. First-message prompt for the new session

```
Leggi docs/handoffs/2026-04-22-search-ssot-next-steps.md e segui la §3.

Step N+1: decidi con me se resettare il commit 12c431ab (§3 opzione A o B).
Poi fermati e chiedi conferma prima di procedere a Step N+2 (deploy).

Regole:
- Altro agente lavora in parallelo su ADR-316 Project Showcase.
  File vietati: vedi §2 del handoff.
- Git: solo `git commit -- <file1> <file2> -m "..."` con file espliciti.
  Mai `git add -A` né `git commit` da indice puro.
- Senza ordine esplicito mio: no firebase deploy, no git push.
- GOL + SSOT attivi.

Model: Sonnet 4.6 è sufficiente (cleanup scoped, non architettura).
```

---

## 5. Files that belong to me (safe to modify)

Main app:
- `src/config/search-index-config.ts` — SSoT
- `src/lib/search/**`
- `src/services/contacts.service.ts`, `src/services/communications.service.ts`, `src/services/opportunities-server.service.ts`
- Project mutation handlers listed in §3 Step N+3
- `src/app/api/buildings/**`, `properties/**`, `parking/**`, `storages/**` (route files only)
- `src/services/ai-pipeline/tools/handlers/contact-handler.ts`
- `scripts/check-search-config-sync.js`

Cloud Functions:
- `functions/src/search/**`
- `functions/src/index.ts`
- `functions/src/config/firestore-collections.ts`

Docs:
- `docs/centralized-systems/reference/adrs/ADR-029-global-search-system-v1.md`
- `docs/handoffs/2026-04-22-search-ssot-next-steps.md` (this file)
