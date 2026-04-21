# Claude Memory - Nestor Pagonis Project

## Quality Standard
- [Google-level quality](feedback_google_quality_standard.md) — All solutions at Google engineering level. No patched solutions, proper architecture, root cause fixes.

## AI Pipeline Testing
- [AI Pipeline Mandatory Testing](feedback_ai_pipeline_mandatory_testing.md) — When touching ai-pipeline code: RUN tests + WRITE new tests. Pre-commit hook enforces. Google Presubmit Pattern.

## Critical Workflow Rules
- [ADR-Driven Workflow (4 Phases)](feedback_adr_driven_workflow.md) — NON-NEGOTIABLE: Phase 1 Plan Mode (code→ADR update), Phase 2 Implementation, Phase 3 ADR Update, Phase 4 Commit
- [ADR Phase 3 MANDATORY](feedback_adr_phase3_mandatory.md) — NEVER commit code without ADR update in the SAME commit. Fixed 2026-03-12.
- [No push without explicit order](feedback_no_push_without_order.md) — NON-NEGOTIABLE: NEVER git push without explicit order from Giorgio
- [Only commit, NEVER push](feedback_only_commit_no_push.md) — Only commit autonomously. Push ONLY with explicit order. Reinforced 2026-03-24.
- [Never ask about commit/push](feedback_never_ask_commit_push.md) — NEVER ask "do you want a commit?" — Giorgio says so himself

## Pending Work
- [Ratchet Backlog — ADR-299 live checklist](pending-ratchet-work.md) — **STATUS: ALL_DONE** (2026-04-14). Scenario A+B completati. Nuovo ratchet? Set STATUS: ACTIVE e aggiungi righe.
- [SSoT Discovery Pending — ADR-314 baseline](ssot-discovery-pending.md) — **STATUS: ACTIVE** (2026-04-18). 74 duplicates, 5 anti-patterns, 96 registry gaps. Phase A/B/C roadmap.
- [ADR-233 Building Code — 3 Pending Items](project_adr233_building_code_pending.md) — HIGH: uniqueness validation, MEDIUM: BuildingsList.tsx, LOW: unit tests (2026-04-05)
- [Notification SSoT — Boy Scout Migration](pending-notification-migration.md) — **STATUS: ACTIVE** (2026-04-22). ~100 file usano ancora `useNotifications()` diretto. 3 domain hook esistenti (contacts/projects/files). Quando tocchi un file con `useNotifications` → menzionalo a Giorgio.

## Code Architecture
- [File size → EXTRACT, never trim](feedback_file_size_extract_not_trim.md) — When hook blocks for size: create new module, NEVER cut comments/code. Google SRP.
- [No hardcoded i18n defaultValue (SOS. N.11)](feedback_no_hardcoded_i18n_defaultvalue.md) — NEVER `defaultValue: 'literal text'` — only `defaultValue: ''`. Enforced by hook + ESLint (2026-04-05).

## Pre-commit Hook
- [Disable slow pre-commit checks](feedback_disable_slow_precommit.md) — No tsc/prettier/madge/eslint in hook. Run on-demand only.

## Firestore Security
- **CHECK 3.10**: Every `query()` + `where()` MUST include `where('companyId', '==', companyId)` — otherwise permission-denied
- Baseline: `.firestore-companyid-baseline.json` (48 violations, 30 files, 2026-04-10)
- `npm run firestore:audit` — check progress vs baseline

## Language Rule (2026-04-13)
- Giorgio writes in Greek. Claude ALWAYS responds in Italian. NEVER English, NEVER Greek. Token savings ~60% on output. See CLAUDE.md top section.

## User Preferences

### Vercel Deploy Limit — Work on localhost
- [No Vercel deploy when limit reached](feedback_no_vercel_deploy_limit.md) — When 100 deploys/day limit hit, work on localhost:3000. DO NOT push.
- [No push — Vercel queue overloaded 2026-03-14](feedback_no_push_vercel.md) — 100+ deployments stuck build queue. Only commit, NO push until further notice.

### "Safety checkpoint" = commit + push ONLY
- Does NOT mean BACKUP_SUMMARY.json or enterprise-backup.ps1
- Just: `git add` → `git commit` → `git push origin main`
- Backup ZIP ONLY when explicitly requested

## Key Learnings

### Environment Variables on Vercel
- NEVER use `echo` to pipe env vars — adds trailing newline
- USE `printf` instead: `printf "value" | npx vercel env add NAME production --yes`
- Always add `.trim()` in code as defensive measure

### Firestore: NEVER write undefined values
- Firestore accepts `null` but REJECTS `undefined`
- Every optional field must use `?? null`. Pattern: `reason: params.reason ?? null`
- For optional object fields: conditional spread `...(value ? { field: value } : {})`
- Fixed in: audit-service, appointment-module, operator-inbox-service, email-channel-adapter

### Shared Email Rendering Components
- Location: `src/components/shared/email/EmailContentRenderer.tsx`
- Extracted from AIInboxClient.tsx for reuse across AI Inbox, Operator Inbox
- Components: SafeHTMLContent, EmailContentWithSignature, RenderContentWithLinks
- Features: XSS protection (DOMPurify), 3 URL patterns, signature detection (ADR-073)

### OpenAI Structured Outputs — Strict Mode Rules
- NEVER use `oneOf`/`anyOf` at root level with `strict: true`
- Split discriminated unions into separate schemas, select by context
- ALL properties must be in `required` array
- Optional fields → nullable: `type: ['string', 'null']` AND listed in `required`
- ALL objects must have `additionalProperties: false`
- Use `stripNullValues()` before Zod validation
- Schemas: AI_MESSAGE_INTENT_SCHEMA, AI_DOCUMENT_CLASSIFY_SCHEMA
- Fixed in: ai-analysis-config.ts, OpenAIAnalysisProvider.ts

### Firestore Composite Indexes
- Queries with `.where().orderBy()` require composite index
- Deploy: `firebase deploy --only firestore:indexes --project pagonis-87766`
- Index building takes 2-5 min — may return empty during build
- FAILED_PRECONDITION disappears before index is fully populated

### Firebase CLI
- Installed globally. Project ID: `pagonis-87766`. User authenticated.

### Email Pipeline Architecture (ADR-070, ADR-071)
- Status: FULLY OPERATIONAL (2026-02-06)
- Mailgun webhook → `email_ingestion_queue` → `after()` triggers processing
- Routing rules: `system/settings` → `integrations.emailInboundRouting`
- `claimNextQueueItems()` uses composite index on `status` + `createdAt`
- AI Provider: OpenAI `gpt-4o-mini`. AI Inbox reads Firestore `messages` collection. IDs: `msg_email_XXXXX`

### Vercel Hobby Plan Limitations
- Cron: only daily, no hourly. Workaround: Next.js 15 `after()`
- CRITICAL: Default serverless timeout = 10s. Set `export const maxDuration = 60` for routes using `after()` with OpenAI
- `feedTelegramToPipeline` must be awaited (NOT fire-and-forget) before `after()`

### Project Structure
- Centralized systems: `docs/centralized-systems/README.md`
- ADR index: `docs/centralized-systems/reference/adr-index.md`
- Firestore collections SSoT: `src/config/firestore-collections.ts`
- Navigation: `src/config/smart-navigation-factory.ts`
- i18n locales: `src/i18n/locales/{en,el}/navigation.json`

### Vercel Environment Variables (Production)
- Email/AI vars set 2026-02-06: OPENAI_API_KEY, AI_PROVIDER=openai, OPENAI_TEXT_MODEL, OPENAI_VISION_MODEL, MAILGUN_WEBHOOK_SIGNING_KEY, MAILGUN_DOMAIN, MAILGUN_API_KEY

### ADR-145: Super Admin AI Assistant (2026-02-09)
- Status: OPERATIONAL. Super Admin: Giorgio Pagonis (Telegram: St€ F@no, userId: 5618410820)
- Registry: Firestore `settings/super_admin_registry` with 5-min cached resolver
- UC Modules: UC-010 (contact search+list), UC-011 (project status), UC-012 (send email), UC-013 (business stats), UC-014 (fallback)
- AI Prompt: `ADMIN_COMMAND_SYSTEM` in ai-analysis-config.ts
- RULE: Always update ADR files when changing admin system modules

### Workflow Rule: Always Update ADR Files
- Giorgio explicitly requested: update ADR files for every change
- ANY change to pipeline/admin/UC modules → update corresponding ADR
- Primary: ADR-145, ADR-134. Also ADR-080 changelog when relevant

### ADR-170: Attendance QR + GPS Geofencing + Photo (2026-02-09)
- Status: IMPLEMENTED — 14 new files, 5 modified, 0 TS errors
- Services: `src/services/attendance/`. API: `/api/attendance/`
- Worker: `/attendance/check-in/[token]` — public, mobile-first, no auth
- Firestore: `attendance_qr_tokens` (server-only write, Admin SDK)
- Security: HMAC-SHA256, daily rotation, withHeavyRateLimit
- Env: `ATTENDANCE_QR_SECRET` on Vercel production. Extends ADR-090 Phase 4A

### ADR-171: Autonomous AI Agent with Agentic Tool Calling (2026-02-10)
- Status: Phase 1 IMPLEMENTED
- Core: firestore-schema-map.ts (25 schemas), agentic-tool-definitions.ts (8 tools), agentic-tool-executor.ts, agentic-loop.ts (max 5 iter, 50s timeout), chat-history-service.ts (20 msgs, 24h TTL)
- Modified: pipeline-orchestrator.ts (executeAgenticPath), firestore-collections.ts (+AI_CHAT_HISTORY)
- Architecture: Admin commands → agentic loop → AI calls tools iteratively
- Firestore: `ai_chat_history`, key: `${channel}_${senderId}`

### Accounting Subapp — Phase 1 COMPLETE (2026-02-10)
- 10 modules for sole proprietor. Location: `src/subapps/accounting/` — portable, independent ADRs (ACC-xxx)
- ADRs: 11 (ACC-000 to ACC-010). Services: `createAccountingServices()` factory
- API: `/api/accounting/` — invoices, journal, vat, tax/estimate, bank, efka, assets, documents, setup
- AI Document Processing: OpenAIDocumentAnalyzer → gpt-4o-mini vision, 2 strict schemas
- myDATA ΑΑΔΕ: stub ready, credentials pending
- withStandardRateLimit: `segmentData?: { params: Promise<{ id: string }> }`

### TypeScript Check Workflow
- RULE: commit+push FIRST → then `tsc --noEmit` in background
- User doesn't wait — Vercel build catches errors anyway
- If error found in background → fix + new commit immediately
- Known pre-existing errors (ignored): FloorplanGallery.tsx(727), ParkingHistoryTab.tsx(121,172), LayerCanvas.tsx(220)

## Pending Tasks
- Firebase IAM: DONE — `serviceusage.serviceUsageConsumer` role granted
- Diagnostic code in webhook GET endpoint can be cleaned up later
- Operator Inbox: polling → onSnapshot (requires Firestore rules for `ai_pipeline_queue`)
- [Accounting Pending Tasks](project_accounting_pending_tasks.md) — 9 features (2026-03-17), top: Invoice PDF, Email, APY Certificate
