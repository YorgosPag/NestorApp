# BOQ Use Cases — Implementation Contracts

**Parent ADR:** [ADR-175 — Quantity Surveying / BOQ](../../centralized-systems/reference/adrs/ADR-175-quantity-surveying-measurements-system.md)
**Date:** 2026-02-11

---

## Αρχιτεκτονική

```
ADR-175 = "Constitution" (όραμα, αποφάσεις, non-negotiables, data model)
    │
    ├── UC-BOQ-001  Manual BOQ CRUD           → Phase 1A + 1B
    ├── UC-BOQ-002  Price Inheritance + Waste  → Phase 1C (price)
    ├── UC-BOQ-003  Gantt Link + Cashflow/EVM  → Phase B + D (EVM)
    ├── UC-BOQ-004  DXF Auto + Verification    → Phase C
    ├── UC-BOQ-005  Subcontractor + Cert + Ret → Phase D
    └── UC-BOQ-006  Excel/PDF Import-Export    → Phase 1C (Excel) + 1D (PDF)
```

---

## Dependency Graph

```
UC-BOQ-001 (Manual CRUD) ──────────────┐
    │                                   │
    ├── UC-BOQ-002 (Price + Waste) ─────┤
    │       │                           │
    │       ├── UC-BOQ-003 (Gantt/EVM)  │
    │       │                           │
    │       ├── UC-BOQ-005 (Subcontract)│
    │       │                           │
    │       └── UC-BOQ-006 (Import/Exp) │
    │                                   │
    └── UC-BOQ-004 (DXF Auto) ─────────┘
```

**Σειρά υλοποίησης:**
1. UC-BOQ-001 (πυρήνας — αναγκαίο για όλα τα υπόλοιπα)
2. UC-BOQ-002 (τιμοκατάλογος — χρειάζεται για σωστή κοστολόγηση)
3. UC-BOQ-006 (import/export — χρειάζεται νωρίς για χρήστες με existing Excel)
4. UC-BOQ-003 (Gantt link — 5D value)
5. UC-BOQ-004 (DXF auto — αυτοματοποίηση)
6. UC-BOQ-005 (subcontractors — advanced controls)

---

## Αρχεία

| ID | Αρχείο | Phase | Status |
|----|--------|-------|--------|
| UC-BOQ-001 | [Manual BOQ CRUD](UC-BOQ-001-manual-boq-crud.md) | 1A + 1B | Draft |
| UC-BOQ-002 | [Price Inheritance + Waste](UC-BOQ-002-price-inheritance-waste.md) | 1C | Draft |
| UC-BOQ-003 | [Gantt Link + Cashflow/EVM](UC-BOQ-003-gantt-link-cashflow-evm.md) | B + D | Draft |
| UC-BOQ-004 | [DXF Auto + Verification](UC-BOQ-004-dxf-auto-verification.md) | C | Draft |
| UC-BOQ-005 | [Subcontractor + Certification](UC-BOQ-005-subcontractor-certification-retainage.md) | D | Draft |
| UC-BOQ-006 | [Excel/PDF Import-Export](UC-BOQ-006-excel-pdf-import-export.md) | 1C + 1D | Draft |

---

## Σχετικές Έρευνες

| Αρχείο | Περιεχόμενο |
|--------|------------|
| `docs/architecture-review/2026-02-11-boq-parallel-research.md` | ΑΤΟΕ, IFC, DXF, Excel |
| `docs/architecture-review/2026-02-11-boq-categories-normalized-spec.md` | Master catalog spec |
| `docs/architecture-review/2026-02-11-boq-parallel-research-2.md` | PDF, Subcontractors, 5D/EVM |
| `docs/architecture-review/2026-02-11-adr175-gap-analysis-report.md` | Gap analysis + proposals |
| `docs/architecture-review/2026-02-11-timeline-gantt-measurements-integration-report.md` | Gantt integration: milestones, M:N links, EVM, tech debt |
