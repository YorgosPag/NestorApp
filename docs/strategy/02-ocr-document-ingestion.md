# Strategy Document: OCR Document Ingestion

**Document ID**: STRATEGY-002
**Created**: 2026-01-29
**Status**: APPROVED
**Owner**: Architecture Team

---

## 1. Executive Summary

This document defines the strategy for implementing OCR (Optical Character Recognition) capabilities in the Nestor Construct Platform. The platform currently has **no OCR implementation**. This strategy establishes a document processing pipeline using **PaddleOCR** as the primary engine with **Tesseract** as fallback.

### Decision

> **Option B: PaddleOCR as primary engine** with Tesseract fallback for edge cases.

### Key Benefits

- **Apache 2.0 License** - Zero licensing costs
- **Best-in-class Accuracy** - Outperforms Tesseract on modern documents
- **Greek Language Support** - Critical for Greek market
- **Human-in-the-Loop** - Confidence thresholds for manual review

---

## 2. Current State Analysis

### 2.1 Existing Implementation

**Status**: **NO OCR EXISTS**

Files are uploaded to Firebase Storage but no text extraction occurs.

### 2.2 Document Types in System

| Document Type | Volume | OCR Benefit |
|---------------|--------|-------------|
| **Invoices** | High | Extract amounts, supplier, dates |
| **Contracts** | Medium | Extract key terms, parties, dates |
| **Floor Plans** | High | Extract room labels, dimensions |
| **Receipts** | High | Expense tracking, VAT extraction |

### 2.3 Business Value

| Use Case | Without OCR | With OCR |
|----------|-------------|----------|
| **Invoice Processing** | Manual data entry (5 min) | Auto-extract (5 sec) |
| **Supplier Lookup** | Manual VAT search | Auto-match by VAT/IBAN |
| **Document Search** | Filename only | Full-text search |

---

## 3. Options Analysis

### Option A: Tesseract (Classic OSS)

| Aspect | Assessment |
|--------|------------|
| **License** | Apache 2.0 |
| **Accuracy** | Good (85-90% on clean documents) |
| **Greek Support** | Yes (requires language pack) |

**Verdict**: **FALLBACK OPTION** - Good as secondary engine

---

### Option B: PaddleOCR (RECOMMENDED)

| Aspect | Assessment |
|--------|------------|
| **License** | Apache 2.0 |
| **Accuracy** | Excellent (92-97% on modern documents) |
| **Greek Support** | Yes (requires model download) |

**Pros**:
- State-of-the-art accuracy
- End-to-end (detection + recognition)
- Table structure recognition

**Verdict**: **RECOMMENDED** - Best accuracy in free tier

---

### Option C: Cloud OCR (Google Vision, AWS Textract)

| Aspect | Assessment |
|--------|------------|
| **License** | Pay-per-use |
| **Accuracy** | Excellent |

**Cons**:
- Per-page/per-document costs
- Data leaves infrastructure
- Privacy concerns (EU data)

**Verdict**: **NOT RECOMMENDED** - Cost and privacy concerns

---

## 4. Decision

### 4.1 Final Decision: **PaddleOCR** + **Tesseract fallback**

### 4.2 Decision Matrix

| Criterion | Weight | Option A | Option B | Option C |
|-----------|--------|----------|----------|----------|
| **Cost** | 30% | 10 | 10 | 3 |
| **Accuracy** | 30% | 7 | 9 | 10 |
| **Privacy** | 20% | 10 | 10 | 4 |
| **Integration** | 10% | 8 | 7 | 9 |
| **Maintenance** | 10% | 8 | 8 | 10 |
| **TOTAL** | 100% | **8.5** | **9.0** | **5.9** |

---

## 5. Implementation Architecture

### 5.1 Pipeline Architecture

```
Document Ingestion (Email, Telegram, Upload, n8n)
    │
    ▼
OCR Microservice
    ├── Preprocessing (enhance, deskew, denoise)
    ├── PaddleOCR Engine (detection + recognition)
    └── Post-processing (entity extraction, classification)
    │
    ▼
Human-in-the-Loop Router
    ├── High confidence (>90%) → Auto-approve
    ├── Medium (70-90%) → Flag for review
    └── Low (<70%) → Manual review required
    │
    ▼
Data Storage (Firestore + Firebase Storage)
```

### 5.2 API Contract

```yaml
# POST /api/v1/ocr/process
Request:
  Content-Type: multipart/form-data
  Body:
    file: <document image/PDF>
    options:
      language: "el"
      extractEntities: true
      classify: true

Response:
  Body:
    success: boolean
    confidence: number
    text: string
    entities:
      vatNumbers: string[]
      ibans: string[]
      dates: string[]
      amounts: Money[]
    classification:
      type: "invoice" | "contract" | "receipt" | "other"
      confidence: number
    supplier:
      id: string
      name: string
      matchConfidence: number
```

### 5.3 Entity Extraction Patterns

```python
# Greek VAT Number (AFM)
VAT_PATTERN = r'\b[0-9]{9}\b'

# Greek IBAN
IBAN_PATTERN = r'\bGR\d{2}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{3}\b'

# Date patterns (Greek format)
DATE_PATTERNS = [
    r'\d{2}/\d{2}/\d{4}',     # 31/12/2024
    r'\d{2}-\d{2}-\d{4}',     # 31-12-2024
]
```

---

## 6. Human-in-the-Loop Design

### 6.1 Confidence Thresholds

| Confidence Level | Range | Action | UI Indicator |
|------------------|-------|--------|--------------|
| **High** | 90-100% | Auto-approve | Green checkmark |
| **Medium** | 70-89% | Flag for review | Yellow warning |
| **Low** | 0-69% | Require manual | Red flag |

### 6.2 Learning Loop

1. User corrects OCR error
2. Correction logged with original
3. Patterns analyzed for systematic errors
4. Engine tuning recommendations generated

---

## 7. Supplier Resolution

### 7.1 Matching Strategy

```
OCR Extract → Match Engine → Contact DB

VAT: 123456789  →  1. Exact VAT match (99%)
IBAN: GR12...   →  2. Exact IBAN match (95%)
Name: ABC Ltd   →  3. Fuzzy name match (80%)
```

| Match Type | Confidence | Action |
|------------|------------|--------|
| **Exact VAT** | 99% | Auto-link |
| **Exact IBAN** | 95% | Auto-link |
| **Fuzzy Name (>90%)** | 80% | Suggest |
| **No Match** | 0% | Create new or manual |

---

## 8. PII & Retention Policy

| Data Type | Handling | Retention |
|-----------|----------|-----------|
| **VAT Numbers** | Store encrypted | Permanent |
| **IBANs** | Store encrypted | Permanent |
| **Personal Names** | Store with consent | Per GDPR |
| **ID Numbers** | Do NOT store | Immediate delete |

**GDPR Compliance**: User consent required, right to deletion, EU region only.

---

## 9. Quality Gates

| Gate | Requirement | Status |
|------|-------------|--------|
| **G1** | Service health endpoint | Pending |
| **G2** | Process simple image | Pending |
| **G3** | Process PDF (multi-page) | Pending |
| **G4** | Greek text accuracy > 90% | Pending |
| **G5** | Entity extraction accuracy > 85% | Pending |
| **G6** | Human review queue functional | Pending |
| **G7** | Supplier matching functional | Pending |

---

## 10. Acceptance Criteria

### Functional
- [ ] **AC-1**: System extracts text from uploaded images
- [ ] **AC-2**: System extracts text from PDF documents
- [ ] **AC-3**: Greek text recognition accuracy > 90%
- [ ] **AC-4**: VAT/IBAN extraction accuracy > 95%
- [ ] **AC-5**: Documents classified correctly > 85%
- [ ] **AC-6**: Low-confidence items appear in review queue

### Non-Functional
- [ ] **AC-7**: Processing time < 10 seconds per page
- [ ] **AC-8**: System handles 100 documents/hour
- [ ] **AC-9**: Fallback to Tesseract if PaddleOCR fails

---

## 11. Security Considerations

| Concern | Mitigation |
|---------|------------|
| **Unauthenticated access** | Internal network only |
| **Malicious files** | File type validation, virus scan |
| **DoS** | File size limits (50MB), rate limiting |
| **Data leakage** | No persistent storage in service |

---

## 12. Related Documents

- **Orchestrator Strategy**: [04-orchestrator-n8n.md](./04-orchestrator-n8n.md)
- **Messaging Strategy**: [05-messaging-unification.md](./05-messaging-unification.md)
- **Architecture Review**: `docs/architecture-review/07-automation-integrations.md`
- **PaddleOCR Docs**: https://paddlepaddle.github.io/PaddleOCR/

---

## 13. Local_Protocol Compliance

> **MANDATORY**: All implementation PRs for this strategy MUST comply with Local_Protocol (CLAUDE.md) as a **non-negotiable quality gate**.

### Required Compliance Checks

| Rule | Requirement | Enforcement |
|------|-------------|-------------|
| **ZERO `any`** | No TypeScript `any` types | PR blocked if found |
| **ZERO `as any`** | No type casting to `any` | PR blocked if found |
| **ZERO `@ts-ignore`** | No TypeScript ignores | PR blocked if found |
| **ZERO inline styles** | Use design tokens only | PR blocked if found |
| **ZERO duplicates** | Use centralized systems | PR blocked if found |
| **ZERO hardcoded values** | Use config/constants | PR blocked if found |

### Pre-PR Checklist

Before any PR implementing this strategy:

- [ ] Searched for existing code (Grep/Glob)
- [ ] No `any` types in new code
- [ ] Uses centralized systems from `centralized_systems.md`
- [ ] No inline styles (uses design tokens)
- [ ] Asked permission before creating new files
- [ ] TypeScript compiles without errors

### Violation Consequences

**Any PR violating Local_Protocol will be REJECTED regardless of functionality.**

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-29 | Claude (Anthropic AI) | Initial strategy document |
