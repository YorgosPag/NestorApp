# Pending Ratchet Work — Live Checklist

**Last updated:** 2026-04-11
**Source of truth:** `adrs/ADR-299-ratchet-backlog-master-roadmap.md`
**Purpose:** Agent-facing live checklist. Every agent starting a session in this repo MUST (per CLAUDE.md SOS N.13) read this file and report to Giorgio in its first reply what is PENDING, so Giorgio doesn't forget.

---

## How this file is read by the agent

1. **Session start (first reply to Giorgio):** Briefly mention (2-4 lines) what is pending here, unless:
   - Giorgio gives a clear order for independent work (then 1 line: "N pending ratchet tasks in ADR-299, see `.claude-rules/pending-ratchet-work.md` when needed")
   - Giorgio's work is explicitly a **non-ratchet** topic — don't load the reply with unrelated reminders
2. **Reminder format:** One sentence for scope + hours + Giorgio's scenario. Don't write the full ADR-299 — point to it.
3. **Don't mark items as completed without order.** Giorgio decides which ratchet proceeds. If you finish an item, remove the line (no strikethrough) and write a changelog entry below.

---

## Pending tasks (priority order)

### 🔥 CRITICAL PATH (Scenario A — ~21h expected)

- [ ] **ADR-298 Phase B.2** — accounting ΚΦΔ immutability (3 collections: `accounting_audit_log`, `accounting_invoices`, `accounting_journal_entries`). New `role_dual` pattern (user-created vs system-generated). Plan Mode first. **Hours:** 2.5-5 (expected 3.5). Critical: ΚΦΔ Q7 legal compliance.

- [ ] **ADR-298 Phase B.3** — CRM core (4 collections: `contacts`, `opportunities`, `leads`, `activities`). Canonical `tenant_direct` pattern, no new work. **Hours:** 1.5-3.5 (expected 2.5). Critical: high read volume.

- [ ] **ADR-298 Phase B.4** — properties (4 collections: `properties`, `storage_units`, `parking_spots`, `floors`). Existing `admin_write_only` pattern. **Hours:** 1.5-3 (expected 2). Seed helpers reuse.

- [ ] **ADR-298 Phase B.5** — messaging (2 collections: `conversations`, `external_identities`). `tenant_direct` + enum validation. **Hours:** 1-2.5 (expected 1.5).

- [ ] **ADR-298 Phase B.6** — compliance (3 collections: `obligations`, `obligation_transmittals`, `obligation_templates`). Canonical `tenant_direct`. **Hours:** 1-2 (expected 1.5).

- [ ] **CHECK 3.17 Entity Audit Coverage** — 18 files with Firestore writes to audit-tracked collections not calling `EntityAuditService.recordChange()`. Boy Scout cleanup, 15-30 min/file. **Hours:** 4-9 (expected 5.5). Canonical service: `src/services/entity-audit.service.ts`. _(Baseline ratcheted 20→19 in `56d95be4` — admin-link destructive chain; 19→18 absorbed by `f160e750` — admin/migrate-properties break-glass deletion.)_

- [ ] **CHECK 3.13 i18n Resolver Reachability** — 13 files, 378 violations. Keys in static configs (service-config, individual-config, modal-select, dropdown-*-labels) unreachable from runtime resolver. Fix: update `SERVICE_FORM_NAMESPACES` in `src/components/generic/i18n/translate-field-value.ts`. **Hours:** 2-6 (expected 4).

### 🧹 FULL ZERO BACKLOG (Scenario B extras — +~43h expected)

- [ ] **ADR-298 Phase C** — 74 remaining Firestore rules collections in 7 subcategories: C.1 accounting (15), C.2 DXF/CAD/floorplans (15), C.3 file variants (10), C.4 BoQ/ownership/commissions (8), C.5 system-global (11, trivial ~15 min/coll), C.6 ownership-based users (5), C.7 specialized (10). **Hours:** 14-35 (expected 22).

- [ ] **ADR-298 Phase E** — Storage rules coverage. `storage.rules` 12KB, new harness shape, separate future ADR. **Hours:** 4-10 (expected 7).

- [ ] **CHECK 3.8 i18n Missing Keys** — 4,762 legacy violations. `t('key')` calls without matching locale entry + namespace mismatches from ADR-280 split. **Hours:** 8-22 (expected 14). Mass-migration + individual fixes.

---

## Short sentence for session-start reminder

**Copy-paste template for the agent:**

> 📋 Pending ratchet tasks (ADR-299): **~21h critical path (Scenario A)** — ADR-298 Phase B.2→B.6 (16 collections), CHECK 3.17 entity audit (18 files), resolver reachability (13 files). Full zero-backlog = ~64h with Phase C+E+i18n keys (Scenario B). Details: `.claude-rules/pending-ratchet-work.md` + `adrs/ADR-299-ratchet-backlog-master-roadmap.md`.

---

## Changelog

| Date       | Change |
|------------|--------|
| 2026-04-11 | Initial checklist dump from ADR-299 §4/§5. Scenario A = 21h expected, Scenario B = 64h expected. No task completed yet — B.1 attendance already completed before ADR-299. |
| 2026-04-11 | CHECK 3.17 baseline ratcheted 20→19 in commit `56d95be4` (production safety hardening: deletion of `properties/admin-link` destructive chain). Was not a CHECK 3.17 cleanup target — was security deletion that reduced baseline as side-effect. Line updated. Hours estimate unchanged. |
| 2026-04-11 | CHECK 3.17 baseline 19→18 in commit `f160e750` (cluster B triage: deletion of `admin/migrate-properties` break-glass one-shot with hardcoded Greek apartment templates + tenant-specific building IDs). Expected hours updated 6→5.5 (removed 1 file from Boy Scout queue). Cluster (B) — 7 files still pending (migrate-building-features, migrate-company-id, migrate-enterprise-ids route+ops, migrations/execute-admin, migrations/normalize-floors, seed-floors, seed-parking) — deferred to focused per-file wire-up commits. |
