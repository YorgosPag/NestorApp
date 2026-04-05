---
name: Accounting Subapp Pending Tasks
description: Analysis of unimplemented features in accounting subapp (ACC-000 to ACC-017) — 9 pending items identified
type: project
---

Full analysis at `docs/ACCOUNTING-PENDING-TASKS.md` (created 2026-03-17).

**Top 3 priorities:**
1. Invoice PDF Generation (ACC-002) — zero code exists, needs PDF library
2. Invoice Email Sending (ACC-002) — placeholder button in InvoiceActionsMenu.tsx, Mailgun ready
3. APY/Withholding Certificate (ACC-000 §7.3) — types+logic exist, generation missing

**Blocked:**
- myDATA/AADE (ACC-003) — stub exists, needs AADE credentials from Giorgos

**Quick wins:**
- Custom Expense Categories (ACC-001 §10.1) — hardcoded 24, needs user-defined
- Dividend Payment UI (ACC-016) — tax logic ready, UI missing

**Future phases:** TEE e-Amoives, E-Adeies, Open Banking PSD2, Bulk Operations

**How to apply:** When Giorgos asks about accounting work, reference this analysis for priority decisions.
