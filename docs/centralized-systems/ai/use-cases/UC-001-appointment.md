# UC-001: Αίτημα Ραντεβού Πελάτη

> **Parent ADR**: [ADR-169 - Modular AI Architecture](../../reference/adrs/ADR-169-modular-ai-architecture.md)
> **Pipeline**: [pipeline.md](../pipeline.md)
> **Implementation**: [ADR-080](../../reference/adrs/ADR-080-ai-pipeline-implementation.md) Section 9
> **Prerequisites**: [PRE-001](../prerequisites.md#pre-001-enterprise-calendar-system), [PRE-002](../prerequisites.md#pre-002-leads-system)

## Implementation Status

| Feature | Status |
|---------|--------|
| AppointmentModule (IUCModule) | **IMPLEMENTED** (2026-02-07) |
| Module registration bootstrap | **IMPLEMENTED** (2026-02-07) |
| Contact lookup by email | **IMPLEMENTED** (MVP: scan, Phase 2: indexed) |
| Date/time extraction from AI entities | **IMPLEMENTED** (2026-02-07) |
| Appointment creation in Firestore | **IMPLEMENTED** (2026-02-07) |
| Draft reply template (Greek) | **IMPLEMENTED** (2026-02-08) |
| Confirmation email via Mailgun | **IMPLEMENTED** (2026-02-08) |
| Shared utilities centralization | **IMPLEMENTED** (2026-02-08) — `contact-lookup.ts`, `mailgun-sender.ts` |
| Calendar availability check | **IMPLEMENTED** (2026-02-08) — `availability-check.ts` (ADR-103) |
| AI Operator Briefing (conflict detection) | **IMPLEMENTED** (2026-02-08) — operatorBriefing in proposal (ADR-103) |
| AI-generated dynamic replies | **IMPLEMENTED** (2026-02-09) — `ai-reply-generator.ts`, replaces static template |
| Smart matching scenarios A/B/C | Phase 2 |
| Lead creation for unknown senders | Phase 2 (PRE-002) |

---

## Trigger

Πελάτης στέλνει μήνυμα ζητώντας ραντεβού

## Ροή

1. **Intake**: Email/μήνυμα εισέρχεται στο σύστημα
2. **Acknowledge**: Άμεση απάντηση → "Λάβαμε το αίτημά σας, θα σας απαντήσουμε σύντομα"
3. **Understand**: AI αναγνωρίζει → intent: `appointment_request`
4. **Company Detection** (Multi-Signal - κατά σειρά προτεραιότητας):
   - **Σήμα 1 - Email παραλήπτη** (πιο αξιόπιστο): Κάθε εταιρεία/έργο έχει δικό του email (π.χ. `info@alysida.gr` → ΑΛΥΣΙΔΑ ΑΕ). Δουλεύει ήδη μέσω Mailgun routing.
   - **Σήμα 2 - Γνωστή επαφή**: Αν ο αποστολέας υπάρχει ως contact στο σύστημα, συνδεδεμένος με εταιρεία/έργο.
   - **Σήμα 3 - Περιεχόμενο μηνύματος**: Ο πελάτης αναφέρει έργο, περιοχή, κτίριο → AI αντιστοιχίζει.
   - **Σήμα 4 - Fallback**: AI ρωτάει ευγενικά τον πελάτη για ποιο έργο/περιοχή ενδιαφέρεται, ή δρομολογεί σε γενικό υπεύθυνο.
5. **Lookup**:
   - Βρίσκει τον **υπεύθυνο πωλήσεων** της εταιρείας
   - Ελέγχει το **ημερολόγιο** του υπεύθυνου
   - Εντοπίζει **κενές ώρες/ημέρες**
   - Ελέγχει αν ο αποστολέας υπάρχει ως **Contact** ή **Lead** στο σύστημα
6. **Smart Appointment Matching** (3 υπο-σενάρια):

   **Α. Ζητά συγκεκριμένη ώρα → Υπεύθυνος ΕΙΝΑΙ διαθέσιμος**:
   - Propose → "Ο πελάτης X ζητά ραντεβού Τρίτη 10:00 - είσαι διαθέσιμος. Επιβεβαιώνεις;"

   **Β. Ζητά συγκεκριμένη ώρα → Υπεύθυνος ΔΕΝ είναι διαθέσιμος**:
   - AI βρίσκει **3 πιο κοντινές εναλλακτικές**:
     - Ίδια μέρα, διαφορετική ώρα (π.χ. Τρίτη 11:00 ή 14:00)
     - Επόμενη μέρα, ίδια ώρα (π.χ. Τετάρτη 10:00)
     - Πιο κοντινό κενό γενικά
   - Propose → "Ο πελάτης ζήτησε Τρίτη 10:00 αλλά δεν είσαι διαθέσιμος. Εναλλακτικές: [1, 2, 3]. Ποια προτιμάς;"
   - Μετά την έγκριση → στέλνει στον πελάτη: "Η Τρίτη 10:00 δεν είναι διαθέσιμη. Σας προτείνουμε: [εναλλακτικές]"

   **Γ. Ζητά γενικά (π.χ. "επόμενη εβδομάδα", "κάποιο πρωινό")**:
   - AI φιλτράρει ημερολόγιο βάσει κριτηρίων
   - Propose → Λίστα διαθέσιμων ωρών στον υπεύθυνο

7. **Approve**: Ο υπεύθυνος επιλέγει ώρα ή προτείνει εναλλακτική
   - **ΚΑΝΟΝΑΣ**: Ποτέ δεν κλείνει ραντεβού χωρίς έγκριση υπευθύνου
8. **Lead/Contact Management**:
   - Αν ο αποστολέας είναι **νέος** → δημιουργία Lead (status: `new`)
   - Αν υπάρχει ήδη ως **Lead** → ενημέρωση Lead (status: `contacted`)
   - Αν υπάρχει ως **Contact** → σύνδεση αιτήματος με υπάρχουσα επαφή
9. **Execute**: Αποστολή απάντησης στον πελάτη μέσω email/Telegram/κ.λπ.

## Κανάλια επικοινωνίας

Email, Telegram, In-app, κ.λπ.

## Routing

| Ρόλος | Fallback |
|-------|----------|
| `salesManager` | `defaultResponsible` |

## Email Reply Implementation (2026-02-08)

### Pipeline Flow
```
Email "Θέλω ραντεβού" → AI detects appointment_request
→ LOOKUP: Contact search + date/time extraction
→ PROPOSE: Draft confirmation email + appointment data (operator preview)
→ Operator approves → EXECUTE:
  1. Create appointment in Firestore (appointments collection)
  2. Send confirmation email via Mailgun (centralized sender)
→ ACKNOWLEDGE: Verify email delivery status
```

### Confirmation Email Template (Greek)
```
Αγαπητέ/ή [Όνομα],

Σας ευχαριστούμε για το ενδιαφέρον σας και το αίτημα ραντεβού.

Το ραντεβού σας έχει εγκριθεί για [ημερομηνία] στις [ώρα].
(ή: Θα επικοινωνήσουμε μαζί σας σύντομα αν δεν υπάρχει ημ/ώρα)

Σε περίπτωση που χρειαστεί αλλαγή ή ακύρωση, παρακαλούμε ενημερώστε μας εγκαίρως.

Με εκτίμηση,
```

### Shared Utilities
| Utility | Path | Purpose |
|---------|------|---------|
| `findContactByEmail()` | `services/ai-pipeline/shared/contact-lookup.ts` | Sender identification |
| `sendReplyViaMailgun()` | `services/ai-pipeline/shared/mailgun-sender.ts` | Email delivery |

### Design Decisions
- Email failure is **non-fatal** — appointment is still created even if email fails
- `draftReply` is included in the proposal so operator can preview the email
- Fallback: if `draftReply` is missing (e.g. operator modified actions), reply is built on-the-fly

---

## AI Model Tier

**FAST** (intent detection, calendar matching)
