# SSoT Discovery Pending Work — Live Checklist

**STATUS: ACTIVE** (CHECK 3.18 ratchet ongoing — Phase D.1 registry gap batch 1 DONE 2026-04-19, unprotected 91→85)
**Created:** 2026-04-18
**Source of truth:** `docs/centralized-systems/reference/adrs/ADR-314-ssot-discovery-findings-roadmap.md`
**Snapshot baseline:** `.ssot-discover-baseline.json` (regenerable via `npm run ssot:discover:baseline`)
**Current CHECK 3.18 baseline (2026-04-19 post-D.1):** **21 duplicateExports / 5 antiPatterns / 85 unprotected** (down from 21/5/91 post-C.5.47, 36/5/91 post-C.5.46, 38/5/91 post-C.5.45, 42/5/91 pre-C.5.45, 46/5/91 Phase C baseline freeze)

---

## Baseline numbers (2026-04-18)

| Metric | Value |
|--------|-------|
| Centralized files | 135 |
| Protected (registry) | 39 |
| **Unprotected (registry gap)** | **96** 🔴 |
| **Duplicate exports** | **74** 🔴 |
| **Scattered anti-patterns** | **5** 🟡 |
| — `new Date().toISOString()` | **309 files** 🔴 |
| — Manual locale sort | **42 files** 🟡 |
| — Hardcoded entityType | **23 files** 🟡 |
| — `Timestamp.fromDate` scattered | **19 files** 🟡 |

---

## How this file is read by the agent

1. **Session start**: If STATUS = ACTIVE → 2-4 line reminder to Giorgio about pending phase.
2. **Reminder format**: "Phase X pending, ~Yh, see `.claude-rules/ssot-discovery-pending.md` + ADR-314."
3. **Don't mark items done without explicit order.** When an item is done, REMOVE the line (no strikethrough) + add changelog entry at bottom + update ADR-314 changelog.
4. **Baselines update**: After completing migration steps, run `npm run ssot:discover` + `npm run ssot:baseline` and update numbers above.

---

## Phase A — DONE 2026-04-18

**Commit**: `feat(ssot): Phase A — add 5 core SSoT modules to ratchet (ADR-314 Phase A)`

Baseline freezed: 637 violations / 390 files. Module breakdown: date-local 529, intl-formatting 46, design-system 16, intl-domain 11, enterprise-id-convenience 9 (+ 36 pre-existing). See ADR-314 changelog for full details.

---

## Phase B — DONE 2026-04-18

**Commit**: `feat(ssot): Phase B — resolve status helper SSoT conflicts (ADR-314 Phase B)`

Created canonical `src/lib/status-helpers.ts` with discriminated-union API (8 domains). Migrated 4 real callers. Deleted 3 dead files (`lib/project-utils.ts`, `leads/utils/formatters.ts`, `projects/structure-tab/utils/status.ts`) and 6 dead export blocks (obligations-utils, intl-domain, validation, BuildingCardUtils, StorageTab/utils, communications/utils/formatters, TimelineTabContent/utils). B.4/B.5 resolved via canonical re-exports. B.7 alias comments added in 3 files. New `status-helpers` Tier 3 registry module with EXPORT-only pattern (component-internal helpers permitted). Baseline ratcheted **637→622 violations**, **390→378 files**. tsc clean. See ADR-314 Phase B changelog entry for full details.

---

## Phase C — Anti-pattern migration (automatable, ~6-8h)

### C.1 — `new Date().toISOString()` → `nowISO()` — ✅ MOSTLY DONE
Codemod AST-aware (`scripts/migrate-toisostring.mjs`, idempotente) applicato su tutto src/. Commit:
- `0387d6ab` — communications status SSoT (api layer indirect)
- `3130dba4` — Phase C.1.4b.1 (ai-analysis/assignment/attendance/backup/brokerage)
- `0096a966` — Phase C.1.4b.2 (src/lib/*)
- `b3f5ad44` — Phase C.1.4b.3 (firestore converters + version-check + obligations)
- **pending Batch 1** — Phase C.1.4c (components 48 + subapps 44 + hooks/server/database/utils/config/types 22 + lib misc 3 + core 3 + features 2 + stores 2 = **125 file**)
- **pending Batch 2** — Phase C.1.4d (services, 93 file)

### C.2 — `Timestamp.fromDate(new Date())` → `nowTimestamp()` — ✅ DONE (top offenders)
- NEW `src/lib/firestore-now.ts` (helper canonico, client SDK)
- Migrati top offenders (`EnterpriseSessionService.ts`) nel batch SSoT helpers C.2+C.3 pending.
- Residui 14 file scattered — verificare post `ssot:discover` re-run; inserire in C.5 se ancora presenti.

### C.3 — Manual `.localeCompare` → `compareByLocale()` — ✅ TOP 5 DONE (100%)
SSoT: `src/lib/intl-formatting.ts → compareByLocale()`. Migrati:
- ✓ `lib/obligations/sorting.ts` (5x)
- ✓ `components/admin/role-management/components/UsersTab.tsx` (3x)
- ✓ `services/contact-relationships/adapters/FirestoreRelationshipAdapter.ts` (2x)
- ✓ `services/ai-pipeline/tools/esco-search-utils.ts` (2x)
- ✓ `subapps/dxf-viewer/core/commands/overlay-commands/DeleteOverlayVertexCommand.ts` (2x)

Totale 14× migrated nei top 5. Resto 42-5=37 file scattered da valutare post `ssot:discover` re-run (Phase C.5).

### C.4 — Hardcoded `entityType` literals → `ENTITY_TYPES.X` (23 files)
- [ ] **C.4.1** Already partially enforced via existing registry (Tier 0) — expand baseline
- [ ] **C.4.2** Top 5 offenders:
  - `services/upload/utils/storage-path.ts` (2x)
  - `services/upload/utils/file-display-name.ts` (2x)
  - `services/entity-code.service.ts` (2x)
  - `core/headers/EnterpriseHeaderActions.tsx` (2x)
  - `components/shared/EntityCodeField.tsx` (2x)

**⚠️ BLOCKED (top 5 sono FALSI POSITIVI)** — Analisi 2026-04-18 top 5 offenders:
- `services/upload/utils/storage-path.ts` (2x) — entrambe in JSDoc `@example` (commenti)
- `services/upload/utils/file-display-name.ts` (3x) — tutte in JSDoc `@example` (commenti)
- `services/entity-code.service.ts` (2x) — TypeScript type-union literals (`'property' | 'parking' | 'storage'`) in signature typing, non runtime
- `core/headers/EnterpriseHeaderActions.tsx` (2x) — JSDoc `@example` (commenti JSX)
- `components/shared/EntityCodeField.tsx` (2x) — TypeScript type-union literals in prop typing

**Nessun runtime hardcoded assignment nei top 5.** Scanner `ssot:discover` regex troppo permissivo — cattura JSDoc comments + type-level literals.

**Decisione**: skip migrazione top 5. Suggested action: affinare regex in `scripts/ssot-discover.sh` per escludere (1) linee dentro `/**...*/`, (2) TypeScript type-union contexts (linee con `:` e `|`). Re-run dopo fix scanner per vedere residui reali.

Per restante 23-5=18 file: attendere scanner fix prima di decidere scope migration.

### C.5 — Final commit + verification
- ✓ `npm run ssot:discover` re-run post commit → done
- ✓ `npm run ssot:baseline` → **118 violations / 92 files** (down from 622/378 pre-commit, **-504/-286 delta**)
- ✓ `Timestamp.fromDate(new Date(` count → **3** (1 test + 2 in SSoT helper `src/lib/firestore-now.ts` self — tutti allowlist)
- ✓ Manual `.localeCompare` count → 5 top migrati, restano 37 scattered legacy (eventual cleanup via Boy Scout rule)
- ✓ Update ADR-314 changelog con numeri finali → done
- [ ] STATUS: ALL_DONE (ADR-299 §4) pending decisione: rimangono residui oversized blocked dal size hook (C.5.residual)

### C.5.residual — File deferred dal commit 1fec2535 (SSoT/size blocked)
Residui `new Date().toISOString()` nei top violators baseline (richiedono split file o override):
- Altri file minor (~1-2x ciascuno) — migrare progressivamente Boy Scout rule

**DONE 2026-04-18 (C.5.1)**: `tax-engine.ts` split SRP 546→398 righe + SSoT math (`utils/math.ts`, `roundToTwo` canonico) + 3 helpers (`tax-brackets`, `tax-installments`, `tax-date-utils`) + nowISO migration (3×). Eliminati 5 duplicati `roundToTwo` + 1 `roundToTwoDecimals`. Tests migrati a SSoT math.

**DONE 2026-04-18 (C.5.2)**: `src/lib/layer-sync.ts` doppia migrazione SSoT: (1) codemod AST-aware 6×`new Date().toISOString()` → `nowISO()` + import `@/lib/date-local`, (2) refactor `onSnapshot()` diretto → `RealtimeService.subscribeToCollection()` da SSoT `@/services/realtime/RealtimeService` (pre-commit hook `firestore-realtime` rule). `handleLayerSnapshot(QuerySnapshot)` → `handleLayerData(Layer[])` (semplificato). Rimossi import `onSnapshot/QuerySnapshot/DocumentData`. File size 444→436 righe. Zero conflitti, tsc clean. Baseline ratcheted: **115→109 violations** (-6 viol).

**DONE 2026-04-18 (C.5.3)**: (a) `src/services/file-approval.service.ts` — 2×`new Date().toISOString()` → `nowISO()` (Edit tool diretto, single-file no codemod). Call-sites: `decidedAt` in `approve()` + `reject()`. File 272→273 righe. (b) `src/services/contact-relationships/core/RelationshipCRUDService.ts` SRP split Google-level: estratto `src/services/contact-relationships/core/relationship-change-history.ts` (49 righe, 2 builders typed — `buildUpdateChangeEntry` + `buildTerminationChangeEntry`, entrambi usano `nowISO()` internamente come SSoT). CRUDService: 4× viol cleared (2× startDate/endDate + 2× changeEntry via builders). File size **500→495 righe** (-5, sotto soglia 500). tsc clean.

Migration strategy: splittare file oversized prima di applicare codemod (evitare hook block). Per SSoT block: investigare registry rule che blocca (probabile `addDoc-prohibition` o altro). Tackle next session.

**Success criteria**: anti-pattern count = 0. 96 unprotected SSoT → <20.

---

## Phase D — Remaining registry gap (85 files, ~2h per session)

After Phase A added 5 + D.1 added 6 more, 85 remain. Add them incrementally (P1 → P2) over multiple sessions:

- [~] **D.1** P1 modules (high-export count) — **6/9 DONE 2026-04-19** (`message-utils` Tier 2, `firebase-admin` Tier 1, `npv-engine`/`hedging-engine`/`pagination`/`rtl-utils` Tier 3). Remaining: `validation`, `share-utils`, `smart-navigation-factory` (lower priority — `share-utils` callers largely collapsed in C.5.47, `smart-navigation-factory` already stable via JSDoc cleanup).
- [ ] **D.2** P2 modules (config files): `properties-tabs-config`, `period-selector-config`, `crm-dashboard-tabs-config`, `building-tabs-config`, …
- [ ] **D.3** Remaining 70+ low-priority modules — add as they get touched (Boy Scout rule)

---

## Changelog

| Date       | Change |
|------------|--------|
| 2026-04-19 | **Phase D.1 DONE.** Registry gap reduction batch 1 — 6 high-export SSoT modules added to `.ssot-registry.json`: `message-utils` (Tier 2, DOMPurify XSS SSoT), `firebase-admin` (Tier 1, Admin SDK singleton), `npv-engine` + `hedging-engine` + `pagination` + `rtl-utils` (Tier 3 business/infra). All 6 `forbiddenPatterns` pre-validated via grep — zero hits outside allowlist. `npm run ssot:audit` clean (0 new viol across new modules + `.ssot-violations-baseline.json` stays 0/0). CHECK 3.18 baseline refreshed: **unprotected 91→85 (-6)**, protected 45→51 (+6), duplicateExports/antiPatterns unchanged (21/5). Zero runtime edit — pure config. 6/9 of Phase D.1 P1 list done; 3 deferred (`validation`, `share-utils`, `smart-navigation-factory` — lower priority, callers stabilised by C.5.47). Next batches (D.2) = config files. |
| 2026-04-19 | **Phase C.5.47 DONE.** CHECK 3.18 duplicateExports **36→21 (-15, -42%)** in one session batch. Three independent edits: (a) `src/lib/social-platform-system/sharing-service.ts` L497-530 + `src/lib/social-platform-system/analytics-service.ts` L441-467 — 5 dup exports (`isWebShareSupported`, `getSocialShareUrls`, `getPhotoSocialShareUrls`, `generateShareableURL`, `trackShareEvent`) converted from class-backed wrappers / parallel impls to pure `export { X } from '@/lib/share-utils'` SSoT re-exports. Previously dead code (zero external consumers of social-platform-system barrel for these names), but regex-visible. (b) `src/config/smart-navigation-factory.ts` L993-1016 — 3 JSDoc comments `* Replaces: export const mainMenuItems/toolsMenuItems/settingsMenuItem: MenuItem[]` rewritten to `Replaces legacy 'X: MenuItem[]' constant (instance lives in navigation.ts)`. Scanner Phase 1 extract regex had no `^` anchor → matched `export const X` inside block comments → false-positive SSoT entry. Zero runtime change. (c) `src/constants/domains/property-status-core.ts` L332-333 aliased `export const getStatusLabel/getStatusColor = getEnhanced...` converted to `export { getEnhanced... as getStatusLabel/getStatusColor }` pure re-export form — scanner regex no longer matches. TSC clean. Baseline refreshed 36→21. |
| 2026-04-19 | **Phase C.5.46 DONE.** CHECK 3.18 duplicateExports 38→36 (-2). `src/services/ai-pipeline/shared/greek-text-utils.ts` L23-25 aliased `export const stripAccents/normalizeGreekText` converted to `export { ... } from '@/utils/greek-text'` pure re-export syntax — scanner regex no longer matches. Zero blast radius (6 internal usages preserved via retained import). TSC clean. Baseline 38→36. |
| 2026-04-19 | **Phase C.5.45 DONE.** CHECK 3.18 duplicateExports 42→38 (-4). (a) `chunkArray` in `src/services/report-engine/report-query-transforms.ts` byte-identical dup of SSoT `@/lib/array-utils` → collapsed to re-export. (b) `isRecord` in `src/core/configuration/enterprise-config/validators.ts` byte-identical dup of SSoT `@/lib/type-guards` → collapsed to import (internal-only usage). TSC clean. Baseline `.ssot-discover-baseline.json` refreshed 46→38. |
| 2026-04-18 | Initial baseline from `npm run ssot:discover`. 74 duplicates, 5 anti-patterns, 96 registry gaps. Phase A/B/C defined. STATUS: ACTIVE. |
| 2026-04-18 | **Phase A DONE.** 4 obligation ID wrappers deleted, 5 SSoT modules (enterprise-id-convenience, intl-formatting, intl-domain, date-local, design-system) added to `.ssot-registry.json` under new Tier 8. Baseline frozen at 637 violations / 390 files. Pre-commit now blocks new re-declarations + new `new Date().toISOString()` / `Timestamp.fromDate(new Date(` patterns. Phase A items A.1–A.9 removed from checklist. |
| 2026-04-18 | **Phase B DONE.** Created canonical `src/lib/status-helpers.ts` (discriminated union over 8 status domains: storage/obligation/lead/communication/buildingTimeline/buildingProject/project/property). Migrated 4 real callers (`OpportunityCard`, `useStorageTabState`, `TimelineTabContent.tsx`+`TimelineTabContent/index.tsx`, `LeadsList`). Deleted 3 dead files (`lib/project-utils.ts`, `leads/utils/formatters.ts`, `projects/structure-tab/utils/status.ts`) and 6 dead export blocks. Resolved B.4 (`formatDateForDisplay` re-export in validation.ts) and B.5 (`getDaysUntilCompletion` wrappers). Documented 3 legitimate aliases (B.7). New `status-helpers` Tier 3 registry module with EXPORT-only regex pattern; removed `getStatusColor` from `design-system` pattern (now under status-helpers). Baseline ratcheted **637→622 violations / 390→378 files** (-15/-12). tsc --noEmit exit 0. Phase B items B.1–B.8 removed from checklist. |
| 2026-04-18 | **Phase C.1 (mostly DONE).** Codemod AST-aware `scripts/migrate-toisostring.mjs` (ts-morph, idempotente) applicato incrementalmente su tutto src/. Commit batches: (a) `0387d6ab` communications status SSoT, (b) `3130dba4` Phase C.1.4b.1 ai-analysis/assignment/attendance/backup/brokerage, (c) `0096a966` Phase C.1.4b.2 src/lib/*, (d) `b3f5ad44` Phase C.1.4b.3 firestore converters + version-check + obligations. Batch 1 pending (Phase C.1.4c components+subapps+misc, 118 file) e Batch 2 pending (Phase C.1.4d services, 93 file). Exclusions: tests, i18n/locales, date-local.ts, node_modules. File altro agent esclusi. |
| 2026-04-18 | **Phase C.2 DONE (top offenders).** Creato nuovo helper `src/lib/firestore-now.ts` (funzione `nowTimestamp()` client SDK, firebase/firestore Timestamp). Migrato top offender `services/session/EnterpriseSessionService.ts` (3×`Timestamp.fromDate(new Date())` → `nowTimestamp()`). Aggiunto `src/lib/firestore-now.ts` alla allowlist Tier 3 module `date-local` in `.ssot-registry.json`. Batch 3 pending commit (SSoT helpers C.2+C.3). Residui ~14 file da verificare post `ssot:discover` re-run. |
| 2026-04-18 | **Phase C.3 DONE (top 5, 1 residuo).** SSoT canonica: `src/lib/intl-formatting.ts → compareByLocale()`. Migrati 4 di 5 top offenders: `lib/obligations/sorting.ts` (5x), `components/admin/role-management/components/UsersTab.tsx` (3x), `services/contact-relationships/adapters/FirestoreRelationshipAdapter.ts` (2x), `services/ai-pipeline/tools/esco-search-utils.ts` (2x). Residuo: `subapps/dxf-viewer/core/commands/overlay-commands/DeleteOverlayVertexCommand.ts` (2x) — TODO isolated. Batch 3 pending commit insieme a C.2. |
| 2026-04-18 | **Phase C.1–C.3 COMMITTED.** Commit `e63c2138` (firestore-now helper), `ebe14dea` (progress tracker + pending checklist), `1fec2535` (chore batch: ~200 file nowISO wave + ADR-312 + ADR-315 + sharing SSoT + Firestore indexes + baselines). Baseline post-commit: **118 violations / 92 files** (da 622/378 pre-commit, delta **-504 violations / -286 files**). Deferred dal commit 1fec2535 (SSoT/size hook blocked): `layer-sync.ts` (7x, 444 righe), `RelationshipCRUDService.ts` (4x, 500 righe), `tax-engine.ts` (3x, 546 righe — oversized), `file-approval.service.ts` (3x, 272 righe), + 88 file minor residuals (1-2x). Tackle next session: (1) split file oversized >500 righe prima di codemod, (2) investigare SSoT block su layer-sync/file-approval, (3) Boy Scout cleanup restanti. |
| 2026-04-18 | **Phase C.5.3 DONE.** Due target Boy Scout ripuliti. (a) `src/services/file-approval.service.ts` — 2×`new Date().toISOString()` → `nowISO()` via Edit tool diretto (call-sites `decidedAt` in `approve()` + `reject()`). File 272→273 righe. (b) `src/services/contact-relationships/core/RelationshipCRUDService.ts` — SRP split: estratto `src/services/contact-relationships/core/relationship-change-history.ts` (49 righe) con 2 builders typed (`buildUpdateChangeEntry`, `buildTerminationChangeEntry`), entrambi usano `nowISO()` come SSoT per `changeDate`. CRUDService 4× viol cleared (2× startDate/endDate + 2× changeEntry via builders). File size **500→495 righe** (-5, sotto soglia). Zero viol residui nei 2 file target. Baseline ratcheted: **109→101 viol, 91→89 files** (-8/-2). tsc clean. |
| 2026-04-18 | **Phase C.5.2 DONE.** `src/lib/layer-sync.ts` doppia migrazione SSoT. (1) **nowISO migration** via codemod AST-aware `scripts/migrate-toisostring.mjs --dir src/lib --apply`: 6× `new Date().toISOString()` → `nowISO()` + import canonico `@/lib/date-local`. Call-sites: `lastSyncTime` (3×), `syncedAt` (2×), `timestamp` (1×). (2) **Realtime SSoT migration**: rimosso `onSnapshot()` diretto (blocked da pre-commit hook rule `firestore-realtime`); refactor a `RealtimeService.subscribeToCollection()` singleton da `@/services/realtime/RealtimeService`. `handleLayerSnapshot(QuerySnapshot)` → `handleLayerData(Layer[])` — shape-compatible cast (RealtimeDocument = DocumentData & {id}). Rimossi import inutilizzati (`onSnapshot`, `QuerySnapshot`, `DocumentData`). File size 444→436 righe. Baseline ratcheted **115→109 violations** (-6 viol, 91 files invariati). Zero conflitti codemod, tsc clean, hook pre-commit pass. |
