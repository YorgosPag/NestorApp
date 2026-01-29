# Strategy Documents - Enterprise Technology Decisions

**Created**: 2026-01-29
**Owner**: Architecture Team
**Status**: Active

---

## Executive Summary

This directory contains **enterprise-grade strategy documents** for technology decisions in the Nestor Construct Platform. Each document follows a structured format with:

- **Options A/B/C** analysis
- **Final decision** with justification
- **Quality gates** and acceptance criteria
- **Security considerations**

### Guiding Principle

> **"Strongest free OSS first"** - Prioritize open-source solutions with strong community support and zero licensing fees, while maintaining enterprise-grade quality.

---

## Document Index

| # | Document | Decision | Status | Priority |
|---|----------|----------|--------|----------|
| 01 | [DXF Technology Decision](./01-dxf-technology-decision.md) | **ezdxf** (Python service) | Ready | High |
| 02 | [OCR Document Ingestion](./02-ocr-document-ingestion.md) | **PaddleOCR** + Tesseract fallback | Ready | High |
| 03 | [AI Layer Architecture](./03-ai-layer-architecture.md) | **Genkit + RAG** (pgvector) | Ready | Medium |
| 04 | [Orchestrator - n8n](./04-orchestrator-n8n.md) | **n8n self-hosted** | Ready | High |
| 05 | [Messaging Unification](./05-messaging-unification.md) | **Meta Cloud API** (WhatsApp) | Ready | Medium |
| 06 | [Web Monitoring Agents](./06-web-monitoring-agents.md) | **n8n scheduled** workflows | Ready | Low |

---

## Technology Stack Summary

### Chosen Technologies

| Area | Technology | License | Why Chosen |
|------|------------|---------|------------|
| **DXF Export** | ezdxf | MIT | Strongest OSS, full DXF R12-R2018 support |
| **OCR** | PaddleOCR | Apache 2.0 | Best accuracy in free tier |
| **Workflow** | n8n | Fair-code | Self-hosted, zero SaaS fees |
| **AI/RAG** | Genkit + pgvector | Apache 2.0 | Already integrated, Supabase compatible |
| **WhatsApp** | Meta Cloud API | Commercial | Direct API, lower cost than Twilio |

### Rejected Alternatives

| Technology | Why Rejected |
|------------|--------------|
| ODA SDK | Commercial licensing, cost prohibitive |
| Google Vision OCR | Per-page costs, vendor lock-in |
| Make.com | SaaS fees, data sovereignty concerns |
| Twilio WhatsApp | Higher per-message costs |

---

## Paid Exceptions & Waivers

> **Policy**: All technologies must be "strongest free OSS first". The following are **exceptions** that require explicit business justification before implementation.

### Exception Registry

| Technology | License Type | Exception Reason | Status | Business Justification Required |
|------------|--------------|------------------|--------|--------------------------------|
| **WhatsApp (Meta Cloud API)** | Commercial | No free WhatsApp API exists | Opt-in only | Must demonstrate user demand + ROI |
| **LLM (Gemini/OpenAI)** | Pay-per-use | No OSS LLM with equivalent quality | Opt-in only | Must have cost ceiling + fallback plan |
| **Embeddings (OpenAI)** | Pay-per-use | OSS alternatives exist but lower quality | Phase 2 | Evaluate OSS alternatives first |
| **n8n** | Fair-code | Not pure OSS (restrictions on SaaS resale) | Accepted | Self-hosted use is free, acceptable |

### Waiver Process

1. **Request**: Developer submits waiver with business case
2. **Review**: Architecture team evaluates alternatives
3. **Approval**: Explicit sign-off with cost ceiling
4. **Monitor**: Monthly cost review

### Fallback Requirements

For each paid service, an **OSS fallback** must be documented:

| Paid Service | OSS Fallback | When to Use |
|--------------|--------------|-------------|
| WhatsApp | Telegram + Email | Default channels |
| Gemini LLM | Llama 3 (self-hosted) | Cost exceeds ceiling |
| OpenAI Embeddings | Sentence-Transformers | Phase 1 default |

---

## Current State vs Target State

### Gap Analysis

| Capability | Current | Target | Gap |
|------------|---------|--------|-----|
| **DXF Import** | dxf-parser v1.1.2 | Keep | None |
| **DXF Export** | None | ezdxf service | **HIGH** |
| **OCR** | None | PaddleOCR pipeline | **HIGH** |
| **Workflow Orchestration** | None | n8n self-hosted | **HIGH** |
| **RAG/Vector Search** | None | pgvector + embeddings | **MEDIUM** |
| **WhatsApp** | Declared, not implemented | Meta Cloud API | **MEDIUM** |
| **Scheduled Jobs** | None | n8n cron workflows | **MEDIUM** |

---

## Related Documentation

- **Architecture Review**: [docs/architecture-review/](../architecture-review/00-index.md)
- **Security Audit**: [SECURITY_AUDIT_REPORT.md](../../SECURITY_AUDIT_REPORT.md)
- **ADR Index**: [docs/adr/README.md](../adr/README.md)
- **Centralized Systems**: [DXF centralized_systems.md](../../src/subapps/dxf-viewer/docs/centralized_systems.md)

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-29 | Claude (Anthropic AI) | Initial strategy documents |

---

**Next**: Read [01-dxf-technology-decision.md](./01-dxf-technology-decision.md) for DXF export strategy.
