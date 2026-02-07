# AI Governance & Change Management

> **Parent ADR**: [ADR-169 - Modular AI Architecture](../reference/adrs/ADR-169-modular-ai-architecture.md)

---

## Prompt Registry (Versioned)

- Κάθε AI prompt αποθηκεύεται με **version number**
- Αλλαγή prompt → νέα version → audit trail
- Rollback σε προηγούμενη version αν κάτι πάει στραβά

**Δομή**:
```
prompts/
  ├─ intent-detection/
  │    ├─ v1.md (initial)
  │    ├─ v2.md (improved invoice detection)
  │    └─ current → v2
  ├─ sales-response/
  │    ├─ v1.md
  │    └─ current → v1
  └─ invoice-validation/
       ├─ v1.md
       └─ current → v1
```

---

## Model Registry (Versioned)

Mapping FAST/QUALITY/VISION → model IDs σε config:

| Tier | Τρέχον Mapping | Σκοπός |
|------|----------------|--------|
| **FAST** | `gpt-4o-mini` | Email triage, intent detection, text PDF, NL queries |
| **QUALITY** | `gpt-4o` | Πωλησιακά μηνύματα, 3-Way Matching, predictive analytics |
| **VISION** | `gpt-4o` (multimodal) | Σκαναρισμένα τιμολόγια, φωτογραφίες εγγράφων |

- Αλλαγή model → νέα version → testing → deploy
- Αλλαγή config **χωρίς code change**:
  ```
  AI_TIER_FAST=gpt-4o-mini
  AI_TIER_QUALITY=gpt-4o
  AI_TIER_VISION=gpt-4o
  ```

---

## Evaluation Set (Golden Test Data)

- Σετ γνωστών emails/τιμολογίων με σωστές απαντήσεις
- **Regression checks**: Πριν αλλαγή prompt/model → τρέχουν τα golden tests
- Αν accuracy πέσει → η αλλαγή δεν γίνεται deploy

**Παράδειγμα Golden Set**:

| Input | Expected Intent | Expected Confidence |
|-------|----------------|-------------------|
| "Θα ήθελα ραντεβού την Τρίτη" | `appointment_request` | >90% |
| PDF τιμολόγιο σκυροδέματος | `invoice` | >95% |
| "Ψάχνω γκαρσονιέρα μέχρι 100.000€" | `property_search` | >90% |
| "Στείλε τα ΚΑΕΚ στον συμβολαιογράφο" | `document_request` | >85% |

---

## Drift Monitoring

- Παρακολούθηση confidence scores στον χρόνο
- Αν πέφτει confidence/accuracy → αυτόματη επιστροφή σε **approval-only mode**
- Ειδοποίηση owner: "Η ακρίβεια του AI μειώθηκε - απενεργοποιήθηκε η αυτόματη έγκριση"

**Threshold**:
- Μέσος confidence < 75% σε 24h → alert
- Μέσος confidence < 60% σε 24h → auto-switch σε approval-only

---

## Operational Runbooks

| Περίπτωση | Operator Steps |
|-----------|----------------|
| **DLQ items** | 1. Έλεγχος λόγου αποτυχίας. 2. Διόρθωση (data fix / config change). 3. Replay item. 4. Αν αποτύχει ξανά → manual handling. |
| **Vendor outage (Mailgun/OpenAI)** | 1. Alerts fire. 2. Queue αποθηκεύει αιτήματα. 3. Μόλις επανέλθει vendor → auto-retry. 4. Αν >2h → ειδοποίηση πελατών. |
| **Cost spike** | 1. Alert fire. 2. Έλεγχος αν είναι legitimate traffic ή abuse. 3. Αν abuse → rate limit. 4. Αν legitimate → αύξηση threshold ή αλλαγή σε FAST tier. |
| **Drift → approval-only** | 1. Alert fire. 2. Όλα αιτήματα σε manual approval. 3. Έλεγχος golden test set. 4. Fix prompt/model. 5. Regression test. 6. Restore auto-approval. |

---

## Human-in-the-Loop UX Requirements (BACKLOG)

> **Status**: BACKLOG — Καταγραφή απαιτήσεων για μελλοντική υλοποίηση (βλ. UC-009)

- **Preview & Diff**: Πριν κάθε approval, ο operator βλέπει ακριβώς τι θα σταλεί/δημιουργηθεί (email text, recipients, attachments) + diff από template
- **Safe Override**: One-click "Take over" — pause automation, χειροκίνητη ολοκλήρωση, resume pipeline με πλήρες audit
- **Policy Waivers**: Ελεγχόμενη παράκαμψη policy (reason + approver + expiry) αντί ad-hoc εξαιρέσεων
- **Structured Feedback**: UI για "Correct intent/entities" που τροφοδοτεί metrics, test set updates, prompt change requests
- **Operator Playbooks**: In-product οδηγοί ανά use case — τι ελέγχω, πότε εγκρίνω, πότε κλιμακώνω
