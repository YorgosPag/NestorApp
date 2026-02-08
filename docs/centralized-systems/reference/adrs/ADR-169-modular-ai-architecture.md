# ADR-169: Modular AI Architecture - Enterprise Automation Platform

| Metadata | Value |
|----------|-------|
| **Status** | DRAFT - Requirements Gathering |
| **Date** | 2026-02-07 |
| **Category** | AI Architecture / Enterprise Automation |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## 1. Context

### Vision

Η εφαρμογή πρέπει να γίνει **enterprise-class**, πλήρως αυτοματοποιημένη και πανέξυπνη. Οι χρήστες πρέπει να κερδίζουν χρόνο - μηδέν χαμένος χρόνος σε γραφειοκρατία. Η εφαρμογή πρέπει να ξεχωρίζει από τις υπόλοιπες εφαρμογές στην Ελλάδα και να είναι σαν τις εφαρμογές μεγάλων παγκόσμιων κατασκευαστριών εταιρειών λογισμικού.

### Αρχιτεκτονική Αρχή

Η AI αρχιτεκτονική πρέπει να είναι **MODULAR (αρθρωτή)**. Κάθε use case είναι ένα ξεχωριστό module που συνδέεται σε μια κεντρική AI pipeline.

### AI Model Policy

Τα AI models ορίζονται ως **capability tiers** (δεν δένουμε σε ονόματα μοντέλων):

| Tier | Σκοπός | Τρέχον Mapping (2026-02) |
|------|--------|--------------------------|
| **FAST** | Γρήγορο, οικονομικό, απλές εργασίες | `gpt-4o-mini` |
| **QUALITY** | Ισχυρό, πολύπλοκες εργασίες, πειστική γραφή | `gpt-4o` |
| **VISION** | Ανάγνωση εικόνων/σκαναρισμένων (ίδιο API, κόστος tokens/χρήση) | `gpt-4o` (multimodal) |

Αλλαγή mapping μέσω config - χωρίς code change. Βλ. [governance.md](../../ai/governance.md) → Model Registry.

---

## 2. Decision

Υιοθετούμε **Modular AI Architecture** με Universal Pipeline (7 βήματα) και Module Interface Contracts. Κάθε use case είναι ξεχωριστό module που συνδέεται στην κεντρική pipeline. Cross-cutting patterns (company detection, role-based routing, escalation, audit trail) εφαρμόζονται σε όλα τα modules.

### Alternatives Considered

| Εναλλακτική | Γιατί απορρίφθηκε |
|-------------|-------------------|
| **Monolithic AI Agent** | Ένα μεγάλο prompt που κάνει τα πάντα → δύσκολο maintenance, hallucinations, δεν κλιμακώνει |
| **Per-channel pipelines** | Ξεχωριστή pipeline για email, Telegram, in-app → διπλότυπος κώδικας, ασυνέπειες |
| **Vendor-specific automations** | Zapier/n8n/Make → vendor lock-in, δεν ελέγχουμε τη λογική, κόστος κλιμάκωσης |
| **No-AI manual workflows** | Χειροκίνητο triage/routing → αργό, κοστοβόρο, δεν κλιμακώνει |

### Consequences

**Θετικές**:
- Modular = εύκολη προσθήκη νέων use cases χωρίς αλλαγή στο pipeline
- Shared patterns = consistency σε όλα τα σενάρια
- AI tiers = ελαχιστοποίηση κόστους (FAST για απλά, QUALITY για πολύπλοκα)
- Role-based = ασφάλεια + σωστή δρομολόγηση

**Αρνητικές / Κίνδυνοι**:
- Εξάρτηση από OpenAI API (mitigated: provider interface, εύκολη αλλαγή)
- Κόστος AI tokens (mitigated: FAST tier, reports χωρίς AI, caching)
- Πολυπλοκότητα pipeline (mitigated: clear module contracts, observability)
- Ασφάλεια inbound (mitigated: βλ. [security.md](../../ai/security.md))

### Out of Scope

- Real-time voice/video communication
- AI training / fine-tuning custom models
- Multi-language UI (η εφαρμογή είναι EL/EN, AI απαντάει σε οποιαδήποτε γλώσσα)
- Integration με ERP/SAP (μελλοντικό αν χρειαστεί)
- Mobile native app (web-first, responsive)

---

## 3. Decision Log (Accepted Decisions)

| # | Ερώτημα | Απόφαση | Status |
|---|---------|---------|--------|
| D-001 | Ποια κανάλια επικοινωνίας θα υποστηρίξουμε; | **Φάση 1**: Email (ήδη λειτουργικό) + Telegram. **Φάση 2**: Messenger, SMS. **Φάση 3**: In-app. | **DECIDED** |
| D-002 | Πώς θα γίνεται η αναγνώριση εγγράφων; | **3 διαδρομές**: PDF ψηφιακό = text extraction, Σκαναρισμένο = VISION tier (ίδιο API/infra, κόστος tokens ανά χρήση), Φωτογραφία = αίτημα επανααποστολής. | **DECIDED** |
| D-003 | Ποιος εγκρίνει κάθε τύπο ενέργειας; | **10 ρόλοι**: architect, civilEngineer, mechanicalEngineer, siteManager, salesManager, procurementManager, secretary, accountant, owner, defaultResponsible. | **DECIDED** |
| D-004 | Πώς θα δομηθεί ο πίνακας ποσοστών; | **"Structured Data First, PDF Second"**: Δομημένα δεδομένα στο Firestore (ανά Project), αυτόματη εξαγωγή PDF, εισαγωγή Excel/PDF μέσω AI. | **DECIDED** |
| D-005 | Ποιο AI model ανά σενάριο; | **FAST** (gpt-4o-mini): triage, intent, text PDF. **QUALITY** (gpt-4o): Vision, πωλήσεις, 3-Way Matching. Config-driven tiers. | **DECIDED** |
| D-006 | Templates απαντήσεων; | **Υβριδικό**: Templates για τυπικά μηνύματα, ελεύθερη AI γραφή για πωλησιακά. Configurable ανά εταιρεία. | **DECIDED** |
| D-007 | Ημερολόγιο; | **Πρέπει να φτιαχτεί από το μηδέν.** Υπάρχει μόνο πρόχειρο στο CRM. | **DECIDED** |
| D-008 | Εξερχόμενα μηνύματα; | **Απάντηση στο ίδιο κανάλι**. Email=Mailgun (έτοιμο), Telegram=Bot API (πλήρης υλοποίηση), In-app=notifications. | **DECIDED** |
| D-009 | Τιμές στον ενδιαφερόμενο; | **Configurable ανά Project**: `full` (default) / `range` / `hidden`. | **DECIDED** |
| D-010 | Audit trail; | **Πλήρες** με αναζήτηση, φιλτράρισμα, αναφορές. Κάθε ενέργεια AI καταγράφεται. | **DECIDED** |

---

## 4. Τεχνολογικό Stack

| Component | Τεχνολογία | Status |
|-----------|-----------|--------|
| **AI Provider** | OpenAI — Model Policy tiers (FAST/QUALITY/VISION) | ✅ Implemented |
| **Backend** | Next.js 15 API Routes | ✅ Implemented |
| **Database** | Firebase Firestore | ✅ Implemented |
| **File Storage** | Firebase Storage | ✅ Implemented |
| **Email Inbound** | Mailgun Webhooks | ✅ Implemented |
| **Email Outbound** | Mailgun API | ✅ Implemented |
| **Messaging** | Telegram Bot API (webhooks, search, admin, CRM) | ✅ Implemented |
| **In-app Notifications** | Notification system (βασικό) | 🔄 Needs Extension |
| **Reports** | exceljs (Excel) + pdfkit/react-pdf (PDF) | 📋 Planned |
| **Dashboards** | Chart library (TBD - recharts/chart.js/tremor) | 📋 Planned |
| **Hosting** | Vercel (Hobby plan) | ✅ Implemented |

Config-driven model mapping (χωρίς code change):
```
AI_TIER_FAST=gpt-4o-mini
AI_TIER_QUALITY=gpt-4o
AI_TIER_VISION=gpt-4o
```

---

## 5. Μελλοντικά Σενάρια (Backlog)

| UC | Περιγραφή | Status |
|----|-----------|--------|
| UC-009 | Internal Operator Workflow (Inbox triage, preview/diff, approve, override, bulk, feedback) | ✅ Documented |
| UC-010 | Ερώτηση Κατάστασης (Status Inquiry) | ✅ Documented |
| UC-011 | Αναφορά Ελαττώματος / Παράπονο (Defect Reporting) | ✅ Documented |
| UC-012 | Υποβολή Εγγράφων — Document Submission (αρχειοθέτηση, checklist tracking) | BACKLOG |
| UC-013 | Τράπεζα / Δημόσιο — External Entity Communication (δάνεια, άδειες, deadlines) | BACKLOG |
| UC-014 | Πώληση Ακινήτου — Property Sale Process (9 στάδια, lead → παράδοση κλειδιών) | ✅ Documented |
| UC-015 | Αδειοδότηση — Building Permit Process (7 στάδια, μελέτες → περαίωση) | ✅ Documented |
| UC-016 | Προμήθεια — Procurement Process (10 στάδια, ανάγκη → προσφορές → συμφωνία → πληρωμή) | ✅ Documented |
| UC-017 | Φάσεις Κατασκευής — Construction Phase Tracking (Gantt chart, progress %, timeline) | BACKLOG |
| UC-018 | Ημερήσιο Briefing — Daily Briefing ανά ρόλο (8 ρόλοι, urgent/σήμερα/εκκρεμότητες/KPIs) | ✅ Documented |
| UC-019 | Υπενθυμίσεις & Follow-up — Αυτόματες + χειροκίνητες, κλιμάκωση, smart cancel | ✅ Documented |
| UC-020 | Εσωτερικό Handoff — Ανάθεση/μεταφορά μεταξύ ρόλων (secretary→accountant, κ.λπ.) | BACKLOG |
| UC-021 | Πολυεπίπεδη Έγκριση — Approval chains (>10K€ → procurementManager + owner) | BACKLOG |
| UC-022 | Cross-Project Overview — Ενοποιημένη εικόνα ανοιχτών θεμάτων σε όλα τα έργα ανά ρόλο | BACKLOG |
| UC-023 | Παράδοση Ακινήτου — Property Handover (7 στάδια, προετοιμασία → κλειδιά → εγγύηση) | ✅ Documented |
| UC-024 | Εργατική Συμμόρφωση — Labor & Social Security Compliance (ΕΦΚΑ, ένσημα, ΕΡΓΑΝΗ II, παρουσιολόγιο) | ✅ Documented |
| UC-025 | Κοστολόγηση Έργου — Project Costing & Budget Tracking (budget vs actual, predictions, alerts) | ✅ Documented |
| UC-026 | Ταμειακές Ροές — Cash Flow Forecasting (εισροές/εκροές, forecast 3-6 μηνών, what-if) | ✅ Documented |
| UC-027 | Ασφάλεια Εργοταξίου — Site Safety & Incidents (ατυχήματα, ΜΑΠ, Τεχνικός Ασφαλείας, patterns) | ✅ Documented |
| UC-028 | Πιστοποιήσεις — Certifications & Licenses (εργαζομένων + υπεργολάβων, auto-block σε λήξη) | ✅ Documented |
| UC-029 | Βάση Γνώσης — Institutional Knowledge Base (AI Q&A, ιστορικά, best practices, πηγές) | ✅ Documented |
| UC-030 | Μικροέξοδα Εργοταξίου — Petty Cash Management (ταμείο, limits, approvals, VISION αποδείξεων) | ✅ Documented |
| UC-031 | Πρόγραμμα Πληρωμών Αγοραστή — Payment Plan Management (CLP milestones, multi-method, mortgage tracking, checks, alerts) | ✅ Documented |

---

## 6. Document Suite

Η πλήρης τεκμηρίωση της AI αρχιτεκτονικής βρίσκεται στο **[docs/centralized-systems/ai/](../../ai/README.md)**:

### Core
| Έγγραφο | Περιεχόμενο |
|---------|-------------|
| **[Pipeline](../../ai/pipeline.md)** | Universal Pipeline (7 βήματα) + Cross-Cutting Patterns (company detection, routing, escalation, audit, γλώσσα, διευκρινίσεις) |

### Use Cases (25 σενάρια)
| UC | Σενάριο | Link |
|----|---------|------|
| UC-001 | Αίτημα Ραντεβού Πελάτη | [UC-001](../../ai/use-cases/UC-001-appointment.md) |
| UC-002 | Τιμολόγιο Προμηθευτή | [UC-002](../../ai/use-cases/UC-002-invoice.md) |
| UC-003 | Αίτημα Συμβολαιογράφου | [UC-003](../../ai/use-cases/UC-003-notary-documents.md) |
| UC-004 | In-App Αιτήματα | [UC-004](../../ai/use-cases/UC-004-in-app-requests.md) |
| UC-005 | Αναζήτηση Ακινήτων | [UC-005](../../ai/use-cases/UC-005-property-search.md) |
| UC-006 | Εντολή Αποστολής (Outbound) | [UC-006](../../ai/use-cases/UC-006-outbound-send.md) |
| UC-007 | Αναφορές On-Demand | [UC-007](../../ai/use-cases/UC-007-reports.md) |
| UC-008 | AI-Powered Dashboards | [UC-008](../../ai/use-cases/UC-008-dashboards.md) |
| UC-009 | Internal Operator Workflow | [UC-009](../../ai/use-cases/UC-009-internal-operator-workflow.md) |
| UC-010 | Ερώτηση Κατάστασης | [UC-010](../../ai/use-cases/UC-010-status-inquiry.md) |
| UC-011 | Αναφορά Ελαττώματος | [UC-011](../../ai/use-cases/UC-011-defect-reporting.md) |
| UC-014 | Πώληση Ακινήτου (9 στάδια) | [UC-014](../../ai/use-cases/UC-014-property-sale-process.md) |
| UC-015 | Αδειοδότηση (7 στάδια) | [UC-015](../../ai/use-cases/UC-015-building-permit-process.md) |
| UC-016 | Προμήθεια (10 στάδια) | [UC-016](../../ai/use-cases/UC-016-procurement-process.md) |
| UC-018 | Ημερήσιο Briefing (8 ρόλοι) | [UC-018](../../ai/use-cases/UC-018-daily-briefing.md) |
| UC-019 | Υπενθυμίσεις & Follow-up | [UC-019](../../ai/use-cases/UC-019-reminders-followup.md) |
| UC-023 | Παράδοση Ακινήτου (6 στάδια) | [UC-023](../../ai/use-cases/UC-023-property-handover.md) |
| UC-024 | Εργατική Συμμόρφωση (ΕΦΚΑ/ΕΡΓΑΝΗ) | [UC-024](../../ai/use-cases/UC-024-labor-compliance.md) |
| UC-025 | Κοστολόγηση Έργου | [UC-025](../../ai/use-cases/UC-025-project-costing.md) |
| UC-026 | Ταμειακές Ροές (Cash Flow) | [UC-026](../../ai/use-cases/UC-026-cash-flow.md) |
| UC-027 | Ασφάλεια Εργοταξίου | [UC-027](../../ai/use-cases/UC-027-site-safety.md) |
| UC-028 | Πιστοποιήσεις & Άδειες | [UC-028](../../ai/use-cases/UC-028-certifications.md) |
| UC-029 | Βάση Γνώσης Εταιρείας | [UC-029](../../ai/use-cases/UC-029-knowledge-base.md) |
| UC-030 | Μικροέξοδα Εργοταξίου (Petty Cash) | [UC-030](../../ai/use-cases/UC-030-petty-cash.md) |
| UC-031 | Πρόγραμμα Πληρωμών Αγοραστή (Payment Plans) | [UC-031](../../ai/use-cases/UC-031-payment-plan-management.md) |

### Specifications
| Spec | Περιεχόμενο | Link |
|------|-------------|------|
| Contracts | Module Contracts (Zod), Versioning, Thresholds, Replay, Retention | [contracts.md](../../ai/contracts.md) |
| Reliability | State Machine, Queue, Retries, DLQ, Timeouts | [reliability.md](../../ai/reliability.md) |
| Observability | Correlation IDs, Metrics, Alerts | [observability.md](../../ai/observability.md) |
| Security | Verification, Attachments, Prompt Injection, Tenant Isolation | [security.md](../../ai/security.md) |
| Governance | Prompt/Model Registry, Evaluation, Drift, Runbooks | [governance.md](../../ai/governance.md) |
| Prerequisites | PRE-001~PRE-005 (Calendar, Leads, Procurement, Percentage Table, Specifications) | [prerequisites.md](../../ai/prerequisites.md) |

---

## 7. Changelog

| Ημερομηνία | Αλλαγή |
|------------|--------|
| 2026-02-07 | Initial draft - UC-001~UC-003 καταγράφηκαν |
| 2026-02-07 | D-001~D-010 DECIDED. Cross-cutting patterns: Company Detection, Escalation, Role-Based Routing, Audit Trail, Γλώσσα, Διευκρινίσεις, Ελλιπή Έγγραφα |
| 2026-02-07 | UC-004~UC-008 καταγράφηκαν. PRE-001~PRE-005 ορίστηκαν |
| 2026-02-07 | Enterprise Review: Model Policy tiers, Vision cost fix, Tech Stack alignment, Module Contracts (Zod + timestampIso + z.enum) |
| 2026-02-07 | Enterprise Sections: Orchestration, Observability, Security, Governance, Escalation Precision, Contract Versioning, Config-Driven Thresholds, Replay Protection, Data Retention, Operational Runbooks |
| 2026-02-07 | **Document Split**: ADR-169 → umbrella. Περιεχόμενο μεταφέρθηκε σε `docs/centralized-systems/ai/` (pipeline, use-cases, contracts, reliability, observability, security, governance, prerequisites) |
| 2026-02-08 | **UC-001 Phase 2**: Email confirmation reply via Mailgun. Shared utilities centralized (`contact-lookup.ts`, `mailgun-sender.ts`). UC-001 + UC-003 refactored to use shared code |

---

*ADR Format based on: Michael Nygard's Architecture Decision Records*
*Enterprise standards inspired by: Autodesk, Adobe, Bentley Systems, SAP, Google*
