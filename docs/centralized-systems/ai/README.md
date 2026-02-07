# AI Architecture Suite - Enterprise Automation Platform

> **Decision Record**: [ADR-169 - Modular AI Architecture](../reference/adrs/ADR-169-modular-ai-architecture.md)
> **Status**: DRAFT - Requirements Gathering
> **Author**: Γιώργος Παγώνης + Claude Code (Anthropic AI)

---

## Overview

Enterprise AI automation platform βασισμένο σε **Modular Architecture** με Universal Pipeline. Κάθε use case είναι ξεχωριστό module που συνδέεται στην κεντρική pipeline.

---

## Document Suite

### Core

| Έγγραφο | Περιεχόμενο | Γραμμές |
|---------|-------------|---------|
| [ADR-169](../reference/adrs/ADR-169-modular-ai-architecture.md) | Decision record (umbrella) - Context, Decision, Alternatives, Decision Log | ~200 |
| [pipeline.md](./pipeline.md) | Universal Pipeline + Cross-Cutting Patterns (company detection, routing, escalation, audit) | ~280 |

### Use Cases

| Σενάριο | Περιγραφή | Κρίσιμα PRE |
|---------|-----------|-------------|
| [UC-001](./use-cases/UC-001-appointment.md) | Αίτημα Ραντεβού Πελάτη | PRE-001, PRE-002 |
| [UC-002](./use-cases/UC-002-invoice.md) | Τιμολόγιο Προμηθευτή | PRE-003 (για 3-Way) |
| [UC-003](./use-cases/UC-003-notary-documents.md) | Αίτημα Συμβολαιογράφου | PRE-004, PRE-005 |
| [UC-004](./use-cases/UC-004-in-app-requests.md) | In-App Αιτήματα (ιστοσελίδα) | — |
| [UC-005](./use-cases/UC-005-property-search.md) | Αναζήτηση Ακινήτων | PRE-002 |
| [UC-006](./use-cases/UC-006-outbound-send.md) | Εντολή Αποστολής (Outbound) | — |
| [UC-007](./use-cases/UC-007-reports.md) | Αναφορές On-Demand | — |
| [UC-008](./use-cases/UC-008-dashboards.md) | AI-Powered Dashboards | — |

### Specifications

| Spec | Περιεχόμενο |
|------|-------------|
| [contracts.md](./contracts.md) | Module Contracts (Zod schemas), Versioning, Config-Driven Thresholds, Replay Protection, Data Retention |
| [reliability.md](./reliability.md) | State Machine, Job Queue, Retries, DLQ, Timeouts, Concurrency |
| [observability.md](./observability.md) | Correlation IDs, Metrics, Alerts |
| [security.md](./security.md) | Inbound Verification, Attachment Safety, Prompt Injection Defense, Tenant Isolation |
| [governance.md](./governance.md) | Prompt/Model Registry, Evaluation Set, Drift Monitoring, Operational Runbooks |
| [prerequisites.md](./prerequisites.md) | PRE-001~PRE-005 (Calendar, Leads, Procurement, Percentage Table, Specifications) |

---

## Quick Start

1. **Αρχιτεκτονική Απόφαση** → Διάβασε [ADR-169](../reference/adrs/ADR-169-modular-ai-architecture.md) (γιατί αυτή η αρχιτεκτονική)
2. **Pipeline** → Διάβασε [pipeline.md](./pipeline.md) (πώς λειτουργεί)
3. **Σενάρια** → Διάβασε το UC που σε ενδιαφέρει (τι κάνει)
4. **Specs** → Διάβασε contracts/reliability/security (πώς φτιάχνεται)

---

## Implementation Priority

| Φάση | Τι υλοποιείται | Dependencies |
|------|----------------|--------------|
| **Φάση 0** | Pipeline core (Intake → Understand → Propose → Execute) | Ήδη υπάρχει βάση (email pipeline) |
| **Φάση 1** | UC-001 (Ραντεβού) + UC-005 (Αναζήτηση Ακινήτων) | PRE-001 (Calendar), PRE-002 (Leads) |
| **Φάση 2** | UC-002 (Τιμολόγια) + UC-003 (Έγγραφα) | PRE-004 (Percentage Table) |
| **Φάση 3** | UC-006 (Outbound) + UC-007 (Reports) + UC-008 (Dashboards) | — |
