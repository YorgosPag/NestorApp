# Claude Memory - Nestor Pagonis Project

## Critical Safety Rules
- [NEVER checkout other agent files](feedback_never_checkout_other_agent_files.md) — ΠΟΤΕ git checkout/restore σε αρχεία άλλου agent. Μόνο git reset HEAD. 3 ώρες χαμένες 2026-04-06.

## Quality Standard
- [Google-level quality](feedback_google_quality_standard.md) — Όλες οι λύσεις σε επίπεδο Google engineering. Καμία μπαλωμένη λύση, proper architecture, root cause fixes.

## AI Pipeline Testing
- [AI Pipeline Mandatory Testing](feedback_ai_pipeline_mandatory_testing.md) — Όταν αγγίζεις ai-pipeline κώδικα: ΤΡΕΞΕ tests + ΓΡΑΨΕ νέα tests. Pre-commit hook enforces. Google Presubmit Pattern.

## Critical Workflow Rules
- [ADR-296 update after each phase](feedback_adr296_update_after_phase.md) — ΑΔΙΑΠΡΑΓΜΑΤΕΥΤΟ: μετά κάθε φάση i18n cleanup, ενημέρωσε ADR-296 progress tracker + changelog
- [ADR-Driven Workflow (4 Phases)](feedback_adr_driven_workflow.md) — ΑΔΙΑΠΡΑΓΜΑΤΕΥΤΟΣ: Φάση 1 Plan Mode (κώδικας→ενημέρωση ADR), Φάση 2 Υλοποίηση, Φάση 3 Ενημέρωση ADR, Φάση 4 Commit
- [ADR Phase 3 MANDATORY](feedback_adr_phase3_mandatory.md) — ΠΟΤΕ μην κάνεις commit κώδικα χωρίς ADR update στο ΙΔΙΟ commit. Διορθώθηκε 2026-03-12.
- [No push without explicit order](feedback_no_push_without_order.md) — ΑΔΙΑΠΡΑΓΜΑΤΕΥΤΟ: ΠΟΤΕ git push χωρίς ρητή εντολή από τον Γιώργο
- [Only commit, NEVER push](feedback_only_commit_no_push.md) — Μόνο commit αυτόνομα. Push ΜΟΝΟ με ρητή εντολή. Ενισχύθηκε 2026-03-24.
- [Never ask about commit/push](feedback_never_ask_commit_push.md) — ΠΟΤΕ μη ρωτάς "θέλεις commit;" — ο Γιώργος λέει μόνος του

## Pending Work
- [ADR-233 Building Code — 3 Pending Items](project_adr233_building_code_pending.md) — HIGH: uniqueness validation, MEDIUM: BuildingsList.tsx, LOW: unit tests (2026-04-05)

## Code Architecture
- [File size → blank lines first, then split](feedback_file_size_blank_lines_first.md) — Hook block: 1) αφαίρεσε κενές γραμμές 2) ΠΟΤΕ σχόλια 3) αν πάλι >500 → split
- [File size → EXTRACT, never trim](feedback_file_size_extract_not_trim.md) — Όταν hook μπλοκάρει για size: δημιούργησε νέο module, ΠΟΤΕ μην κόβεις σχόλια/κώδικα. Google SRP.
- [No hardcoded i18n defaultValue (SOS. N.11)](feedback_no_hardcoded_i18n_defaultvalue.md) — ΠΟΤΕ `defaultValue: 'literal text'` — μόνο `defaultValue: ''`. Enforced by hook + ESLint (2026-04-05).

## Commit Workflow
- [Commit runs in background](feedback_commit_background.md) — git commit ΠΑΝΤΑ run_in_background. Συνέχισε εργασία. Fix issues μετά.
- [Firebase deploy in background](feedback_firebase_deploy_background.md) — firebase deploy ΠΑΝΤΑ run_in_background. Συνέχισε εργασία.

## Pre-commit Hook
- [Disable slow pre-commit checks](feedback_disable_slow_precommit.md) — No tsc/prettier/madge/eslint in hook. Run on-demand only.
- [i18n Ratchet Pattern](feedback_i18n_ratchet_pattern.md) — 473 violations baseline (2026-04-05). Counts only decrease. New files=zero tolerance. `npm run i18n:audit` / `i18n:baseline`.
- [SSoT Ratchet Enforcement](feedback_ssot_ratchet_enforcement.md) — 53 violations, 44 files, 40 modules in 6 tiers (ADR-294 v3.0).
- [grep ERE — NEVER (?:)](feedback_grep_no_noncapturing_groups.md) — GNU grep 3.0 ERE silently breaks `(?:...)`. Always `(...)`.
- [Firestore companyId annotation placement](feedback_firestore_companyid_annotation_placement.md) — Scanner forward-only. Inline comments MUST go INSIDE query() block, not above. Phase 10C.4 regression.

## Pending Work
- [SSoT Violations Cleanup](project_ssot_violations_cleanup.md) — 53 violations: domain-constants (29), entity-creation (17), misc (7). Phase 1 next.

## User Preferences

### Vercel Deploy Limit — Work on localhost
- [No Vercel deploy when limit reached](feedback_no_vercel_deploy_limit.md) — Όταν εξαντλούνται τα 100 deploys/day, δουλεύουμε σε localhost:3000. ΜΗΝ κάνεις push.
- [No push — Vercel queue overloaded 2026-03-14](feedback_no_push_vercel.md) — 100+ deployments κόλλησαν build queue. Μόνο commit, ΟΧΙ push μέχρι νεωτέρας.

### "Safety checkpoint" = commit + push ΜΟΝΟ
- **ΔΕΝ** σημαίνει BACKUP_SUMMARY.json
- **ΔΕΝ** σημαίνει enterprise-backup.ps1
- Απλά: `git add` → `git commit` → `git push origin main`
- Backup ZIP γίνεται ΜΟΝΟ όταν ζητηθεί ρητά

## Key Learnings

### Environment Variables on Vercel
- **NEVER use `echo` to pipe env vars** - it adds a trailing newline character
- **USE `printf` instead**: `printf "value" | npx vercel env add NAME production --yes`
- Always add `.trim()` in code as defensive measure for env vars

### Firestore: NEVER write undefined values
- Firestore accepts `null` but REJECTS `undefined`
- **Every** optional field in Firestore documents must use `?? null`
- Pattern: `reason: params.reason ?? null` (NOT `reason: params.reason`)
- For optional object fields, use conditional spread: `...(value ? { field: value } : {})`
- Fixed 3 times: audit-service, appointment-module, operator-inbox-service, email-channel-adapter

### Shared Email Rendering Components
- **Location**: `src/components/shared/email/EmailContentRenderer.tsx`
- Extracted from `AIInboxClient.tsx` for reuse across: AI Inbox, Operator Inbox
- Components: `SafeHTMLContent`, `EmailContentWithSignature`, `RenderContentWithLinks`
- Features: XSS protection (DOMPurify), 3 URL patterns, signature detection (ADR-073)

### OpenAI Structured Outputs — Strict Mode Rules
- **NEVER use `oneOf` or `anyOf` at root level** with `strict: true`
- Split discriminated unions into **separate schemas**, select based on context
- **ALL properties** must be listed in `required` array
- Optional fields → nullable: `type: ['string', 'null']` AND listed in `required`
- **ALL objects** must have `additionalProperties: false`
- Use `stripNullValues()` before Zod validation (OpenAI returns null, Zod expects omitted)
- Two schemas: `AI_MESSAGE_INTENT_SCHEMA` + `AI_DOCUMENT_CLASSIFY_SCHEMA`
- Fixed in: `ai-analysis-config.ts`, `OpenAIAnalysisProvider.ts`

### Firestore Composite Indexes
- Queries with `.where('field1', '==', value).orderBy('field2', 'asc')` require a **composite index**
- Firebase deploy for indexes: `firebase deploy --only firestore:indexes --project pagonis-87766`
- Index building takes 2-5 minutes after deploy - may return empty results while building
- The `FAILED_PRECONDITION` error disappears before the index is fully populated

### Firebase CLI
- Installed globally: `npm install -g firebase-tools`
- Project ID: `pagonis-87766`
- User is already authenticated

### Email Pipeline Architecture (ADR-070, ADR-071)
- **Status**: FULLY OPERATIONAL (2026-02-06)
- Mailgun webhook → enqueue to `email_ingestion_queue` → `after()` triggers processing
- Routing rules in `system/settings` → `integrations.emailInboundRouting`
- `claimNextQueueItems()` uses composite index on `status` + `createdAt`
- Worker processes batch with concurrency control and timeout
- **AI Provider**: OpenAI `gpt-4o-mini` (activated 2026-02-06)
- AI Inbox reads from Firestore `messages` collection (NOT `communications`)
- Document IDs format: `msg_email_XXXXX`

### Diagnostic Endpoint Pattern
- Added diagnostic GET to webhook endpoint for runtime debugging
- Shows: routing rules, queue status, batch processing test
- Useful for debugging production issues without code changes

### Vercel Hobby Plan Limitations
- Cron: Only daily (`0 0 * * *`), no hourly
- Workaround: Use Next.js 15 `after()` for immediate processing after webhook
- **CRITICAL**: Default serverless function timeout = 10s! Must set `export const maxDuration = 60;` in route.ts for endpoints using `after()` with OpenAI calls
- Routes with `after()` that call OpenAI TWICE (classify + reply) MUST have maxDuration
- `feedTelegramToPipeline` must be awaited (NOT fire-and-forget) before `after()` to prevent race condition

### Project Structure
- Centralized systems docs: `docs/centralized-systems/README.md`
- ADR index: `docs/centralized-systems/reference/adr-index.md`
- Firestore collections SSoT: `src/config/firestore-collections.ts`
- Navigation config: `src/config/smart-navigation-factory.ts`
- i18n locales: `src/i18n/locales/{en,el}/navigation.json`

### Vercel Environment Variables (Production)
- All email/AI env vars set as of 2026-02-06:
  - `OPENAI_API_KEY`, `AI_PROVIDER=openai`, `OPENAI_TEXT_MODEL`, `OPENAI_VISION_MODEL`
  - `MAILGUN_WEBHOOK_SIGNING_KEY`, `MAILGUN_DOMAIN`, `MAILGUN_API_KEY`
- Firebase IAM issue: `serviceusage.serviceUsageConsumer` role needed for session sync (non-blocking)

### ADR-145: Super Admin AI Assistant (2026-02-09)
- **Status**: OPERATIONAL in production
- **Super Admin**: Γιώργος Παγώνης (Telegram pseudonym: St€ F@no, userId: 5618410820)
- **Registry**: Firestore `settings/super_admin_registry` with 5-min cached resolver
- **Pipeline**: Same pipeline, admin mode via `AdminCommandMeta` → auto-approve
- **UC Modules**: UC-010 (contact search+list), UC-011 (project status), UC-012 (send email), UC-013 (business stats), UC-014 (fallback)
- **AI Prompt**: `ADMIN_COMMAND_SYSTEM` in `ai-analysis-config.ts` — separate from customer intents
- **Key fixes**: UC-010 has dual mode (search by name / list all), UC-013 detects stats type by keywords
- **RULE**: Always update ADR files when making changes to admin system modules

### Workflow Rule: Always Update ADR Files
- Γιώργος explicitly requested: "θέλω κάθε φορά να ενημερώνεις και τα αρχεία ADR"
- When making ANY change to pipeline modules, admin system, or UC modules → update corresponding ADR
- Primary ADR files: `ADR-145-super-admin-ai-assistant.md`, `ADR-134-uc-modules-expansion-telegram-channel.md`
- Also update `ADR-080-ai-pipeline-implementation.md` changelog when relevant

### ADR-170: Attendance QR + GPS Geofencing + Photo (2026-02-09)
- **Status**: IMPLEMENTED — 14 new files, 5 modified, 0 TS errors
- **Services**: `src/services/attendance/` — geofence-service, qr-token-service, attendance-server-service
- **API Routes**: `/api/attendance/` — qr/generate, qr/validate, check-in, geofence
- **Worker Page**: `/attendance/check-in/[token]` — public, mobile-first, no auth
- **Admin Components**: QrCodePanel + GeofenceConfigMap in TimesheetTabContent
- **Hooks**: `useGeolocation` (GPS), `usePhotoCapture` (camera + compression)
- **Firestore**: `attendance_qr_tokens` collection (server-only write via Admin SDK)
- **Security**: HMAC-SHA256 tokens, daily rotation, withHeavyRateLimit on public endpoints
- **Env Var**: `ATTENDANCE_QR_SECRET` set on Vercel production (2026-02-09)
- **Extends**: ADR-090 Phase 4A

### ADR-171: Autonomous AI Agent with Agentic Tool Calling (2026-02-10)
- **Status**: Phase 1 IMPLEMENTED — 6 new files, 3 modified, 0 TS errors
- **Core files**:
  - `src/config/firestore-schema-map.ts` — 25 collection schemas for AI awareness
  - `src/services/ai-pipeline/tools/agentic-tool-definitions.ts` — 8 generic tools
  - `src/services/ai-pipeline/tools/agentic-tool-executor.ts` — Secure execution engine
  - `src/services/ai-pipeline/agentic-loop.ts` — Multi-step reasoning (max 5 iter, 50s timeout)
  - `src/services/ai-pipeline/chat-history-service.ts` — 20 msgs, 24h TTL
- **Modified**: `pipeline-orchestrator.ts` (new `executeAgenticPath()`), `firestore-collections.ts` (+AI_CHAT_HISTORY), `index.ts` (barrel exports)
- **Architecture**: Admin commands → agentic loop → AI calls tools iteratively → final answer
- **Replaces**: Hardcoded UC-010~016 routing for admin (legacy modules kept for customer path)
- **ADR ID conflict**: Plan said ADR-156 but it was taken (Voice Transcription) → used ADR-171
- **Firestore**: `ai_chat_history` collection, key: `${channel}_${senderId}`

### Accounting Subapp — Phase 1 COMPLETE (2026-02-10)
- **Status**: All 10 modules implemented for sole proprietor (ατομική επιχείρηση)
- **Location**: `src/subapps/accounting/` — portable subapp with independent ADR numbering (ACC-xxx)
- **ADRs**: 11 ADRs (ACC-000 to ACC-010) in `src/subapps/accounting/docs/adrs/`
- **Services**: `createAccountingServices()` factory → service, repository, vatEngine, taxEngine, depreciationEngine, documentAnalyzer
- **API Routes**: All under `/api/accounting/` — invoices, journal, vat, tax/estimate, bank, efka, assets, documents, setup
- **AI Document Processing**: `OpenAIDocumentAnalyzer` → gpt-4o-mini vision, 2 strict JSON schemas, async processing via POST
- **Navigation**: 8 sub-items in sidebar (Calculator icon)
- **myDATA ΑΑΔΕ**: Types + interface ready, stub — credentials pending
- **withStandardRateLimit pattern**: Use `segmentData?: { params: Promise<{ id: string }> }` (NOT destructured `{ params }`)

### TypeScript Check: COMMIT+PUSH ΠΡΩΤΑ, ΕΛΕΓΧΟΣ ΣΤΟ BACKGROUND
- **ΚΑΝΟΝΑΣ**: ΠΡΩΤΑ `git commit` + `git push` → ΜΕΤΑ `tsc --noEmit` στο background
- Ο χρήστης ΔΕΝ περιμένει τον έλεγχο — το Vercel build πιάνει errors ούτως ή άλλως
- Αν βρεθεί error στο background → fix + νέο commit αμέσως
- Φιλτράρισμα ΜΟΝΟ αλλαγμένων αρχείων: `tsc --noEmit 2>&1 | grep -E "file1|file2"`
- **Γνωστά pre-existing errors** (αγνοούνται):
  - `FloorplanGallery.tsx(727)` — RefObject null
  - `ParkingHistoryTab.tsx(121,172)` — unknown toDate
  - `LayerCanvas.tsx(220)` — arg type '5' vs '4'

## Project State
- [Test data — will be wiped before production](project_test_data_pre_production.md) — Όλα τα Firestore/Storage data είναι δοκιμαστικά. Δεν χρειάζεται backward compat.

## Security
- [Security Hardening Phase 4](project_security_hardening_phase4.md) — 5 issues resolved (2026-04-08). Storage+Firestore rules deployed. Cloud Functions pending deploy.

## Pending Tasks
- Firebase IAM: ✅ DONE — `serviceusage.serviceUsageConsumer` role granted
- Diagnostic code in webhook GET endpoint can be cleaned up later
- Operator Inbox: Upgrade polling → onSnapshot (requires Firestore rules for `ai_pipeline_queue`)
- [Accounting Pending Tasks](project_accounting_pending_tasks.md) — 9 pending features identified (2026-03-17), top: Invoice PDF, Email, APY Certificate
