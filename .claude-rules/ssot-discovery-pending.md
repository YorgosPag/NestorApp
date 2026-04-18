# SSoT Discovery Pending Work — Live Checklist

**STATUS: ACTIVE**
**Created:** 2026-04-18
**Source of truth:** `docs/centralized-systems/reference/adrs/ADR-314-ssot-discovery-findings-roadmap.md`
**Snapshot baseline:** `/tmp/ssot-full.txt` (regenerable via `npm run ssot:discover`)

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

## Phase B — Resolve SSoT conflicts (medium risk, ~3-4h)

### B.1 — Decide canonical status helpers SSoT
- [ ] **B.1.1** Choose: new `src/lib/status-helpers.ts` with discriminated union (domain: property/obligation/lead/building/storage) vs keeping separate per-domain modules
- [ ] **B.1.2** Document decision in ADR-314 (new section "Canonical Status Helpers")
- [ ] **B.1.3** Implement canonical `getStatusColor(domain, status, colors?)` + `getStatusLabel(domain, status, t?)` + `getStatusIcon(domain, status)`

### B.2 — Migrate callers of `getStatusColor` (9 files)
- [ ] `components/building-management/BuildingCard/BuildingCardUtils.ts:49`
- [ ] `components/building-management/StorageTab/utils.ts:11`
- [ ] `components/building-management/tabs/TimelineTabContent/utils.ts:62`
- [ ] `components/communications/utils/formatters.ts:21`
- [ ] `components/leads/utils/formatters.ts:4`
- [ ] `lib/design-system.ts` (canonical already? verify)
- [ ] `lib/obligations-utils.ts` (decide: delete or keep as domain-specific wrapper)
- [ ] `lib/project-utils.ts` (decide: delete or keep)

### B.3 — Migrate callers of `getStatusLabel` (5 files)
- [ ] `components/building-management/BuildingCard/BuildingCardUtils.ts:18`
- [ ] `components/building-management/StorageTab/utils.ts:34`
- [ ] `constants/domains/property-status-core.ts:332`
- [ ] `lib/intl-domain.ts:157`
- [ ] `lib/obligations-utils.ts:145`
- [ ] `lib/project-utils.ts:108`

### B.4 — Resolve `formatDateForDisplay` conflict
- [ ] Choose between `lib/intl-domain.ts:262` and `utils/validation.ts:326` (circular: each re-imports the other)
- [ ] Delete duplicate, fix imports

### B.5 — Resolve `getDaysUntilCompletion` conflict
- [ ] Choose between `lib/intl-domain.ts:326` and `lib/project-utils.ts:21`
- [ ] Delete duplicate

### B.6 — Add resolved SSoT to registry
- [ ] `.ssot-registry.json` entry for status helpers module
- [ ] Ratchet baseline

### B.7 — Document legitimate aliases
- [ ] `subapps/dxf-viewer/overlays/types.ts:76-83` — `STATUS_COLORS = PROPERTY_STATUS_COLORS` (alias, add comment "legitimate re-export")
- [ ] `config/navigation.ts:51-65` — `mainMenuItems/toolsMenuItems/settingsMenuItem` from smart-navigation-factory (verify: alias or duplicate)
- [ ] `services/ai-pipeline/shared/greek-text-utils.ts:23-24` — `stripAccents/normalizeGreekText` (alias, OK)

### B.8 — Commit + ADR update
- [ ] `feat(ssot): Phase B — resolve status helper SSoT conflicts (ADR-314 Phase B)`
- [ ] Update ADR-314 changelog

**Success criteria**: zero SSoT conflicts, each exported symbol has exactly one declaring file.

---

## Phase C — Anti-pattern migration (automatable, ~6-8h)

### C.1 — `new Date().toISOString()` → `nowISO()` (309 files)
- [ ] **C.1.1** Verify `nowISO()` exists in `src/lib/date-local.ts`; add if missing
- [ ] **C.1.2** Write codemod script (`scripts/migrate-toisostring.ts` using ts-morph or jscodeshift)
- [ ] **C.1.3** Dry-run on `src/app/api/` (smallest directory first)
- [ ] **C.1.4** Commit per-directory batches: `refactor(date-local): migrate X files to nowISO() (ADR-314 Phase C.1)`
- [ ] **C.1.5** Directory sequence: `api/` → `services/` → `lib/` → `components/` → `subapps/`
- [ ] **C.1.6** Add to ratchet after each batch

### C.2 — `Timestamp.fromDate(new Date())` → `nowTimestamp()` (19 files)
- [ ] **C.2.1** Add `nowTimestamp()` helper to `date-local.ts` if missing
- [ ] **C.2.2** Migrate top 5 offenders:
  - `app/api/communications/webhooks/telegram/crm/store.ts` (14x)
  - `services/session/EnterpriseSessionService.ts` (6x)
  - `server/comms/email-adapter.ts` (6x)
  - `services/user-notification-settings/UserNotificationSettingsService.ts` (5x)
  - `server/comms/orchestrator.ts` (4x)
- [ ] **C.2.3** Migrate remaining 14 files

### C.3 — Manual `.localeCompare` → `sortByLocale()` (42 files)
- [ ] **C.3.1** Verify `sortByLocale()` signature in `intl-formatting.ts`
- [ ] **C.3.2** Codemod or manual migration (context-dependent, may not be fully automatable)
- [ ] **C.3.3** Top 5 offenders:
  - `lib/obligations/sorting.ts` (5x)
  - `components/admin/role-management/components/UsersTab.tsx` (3x)
  - `subapps/dxf-viewer/core/commands/overlay-commands/DeleteOverlayVertexCommand.ts` (2x)
  - `services/contact-relationships/adapters/FirestoreRelationshipAdapter.ts` (2x)
  - `services/ai-pipeline/tools/esco-search-utils.ts` (2x)

### C.4 — Hardcoded `entityType` literals → `ENTITY_TYPES.X` (23 files)
- [ ] **C.4.1** Already partially enforced via existing registry (Tier 0) — expand baseline
- [ ] **C.4.2** Top 5 offenders:
  - `services/upload/utils/storage-path.ts` (2x)
  - `services/upload/utils/file-display-name.ts` (2x)
  - `services/entity-code.service.ts` (2x)
  - `core/headers/EnterpriseHeaderActions.tsx` (2x)
  - `components/shared/EntityCodeField.tsx` (2x)

### C.5 — Final commit + verification
- [ ] All anti-patterns → 0 new occurrences possible
- [ ] `npm run ssot:discover` re-run → anti-patterns count should be 0 (only false positives)
- [ ] Update ADR-314 changelog with final numbers

**Success criteria**: anti-pattern count = 0. 96 unprotected SSoT → <20.

---

## Phase D — Remaining registry gap (91 files, ~2h per session)

After Phase A adds 5 SSoT to registry, 91 remain. Add them incrementally (P1 → P2) over multiple sessions:

- [ ] **D.1** P1 modules (high-export count): `message-utils`, `rtl-utils`, `hedging-engine`, `validation`, `pagination`, `npv-engine`, `firebaseAdmin`, `share-utils`, `smart-navigation-factory`
- [ ] **D.2** P2 modules (config files): `properties-tabs-config`, `period-selector-config`, `crm-dashboard-tabs-config`, `building-tabs-config`, …
- [ ] **D.3** Remaining 76+ low-priority modules — add as they get touched (Boy Scout rule)

---

## Changelog

| Date       | Change |
|------------|--------|
| 2026-04-18 | Initial baseline from `npm run ssot:discover`. 74 duplicates, 5 anti-patterns, 96 registry gaps. Phase A/B/C defined. STATUS: ACTIVE. |
| 2026-04-18 | **Phase A DONE.** 4 obligation ID wrappers deleted, 5 SSoT modules (enterprise-id-convenience, intl-formatting, intl-domain, date-local, design-system) added to `.ssot-registry.json` under new Tier 8. Baseline frozen at 637 violations / 390 files. Pre-commit now blocks new re-declarations + new `new Date().toISOString()` / `Timestamp.fromDate(new Date(` patterns. Phase A items A.1–A.9 removed from checklist. |
